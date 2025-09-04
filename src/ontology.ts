import nunjucks from "nunjucks";
import type { CommandDef } from "./types";

// Embed templates directly to avoid build path issues
const COMMAND_TEMPLATE = `import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "{{ command.name }}",
    description: "{{ command.description }}",
    version: "{{ command.version | default('1.0.0') }}"
  },
  run({ args }) {
    console.log("Running {{ command.name }} with args:", args);
  }
});`;

const COMMAND_INLINE_TEMPLATE = `defineCommand({
  meta: {
    name: "{{ command.name }}",
    description: "{{ command.description }}",
    version: "{{ command.version | default('1.0.0') }}"
  },
  run({ args }) {
    console.log("Running {{ command.name }} with args:", args);
  }
})`;

const MAIN_COMMAND_TEMPLATE = `import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "{{ command.name }}",
    description: "{{ command.description }}",
    version: "{{ command.version | default('1.0.0') }}"
  }
});

runMain(main);`;

const ONTOLOGY_PREFIXES = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix citty: <http://example.org/citty#> .
@prefix cmd: <http://example.org/citty/command#> .
@prefix arg: <http://example.org/citty/argument#> .
@prefix type: <http://example.org/citty/type#> .`;

const ONTOLOGY_DEFINITIONS = `# Citty CLI Ontology Definitions

# Classes
citty:Command a owl:Class ;
    rdfs:label "Command"@en ;
    rdfs:comment "A CLI command"@en .

citty:Argument a owl:Class ;
    rdfs:label "Argument"@en ;
    rdfs:comment "A command argument or option"@en .

citty:ArgumentType a owl:Class ;
    rdfs:label "Argument Type"@en ;
    rdfs:comment "The type of an argument"@en .`;

interface OntologyTriple {
  subject: string;
  predicate: string;
  object: string;
}

interface ParsedCommand {
  name: string;
  description?: string;
  version?: string;
  hidden?: boolean;
  args: ParsedArgument[];
  subCommands: ParsedCommand[];
  subCommandUris?: string[]; // Temporary property for parsing
  setup?: boolean;
  cleanup?: boolean;
  run?: boolean;
}

interface ParsedArgument {
  name: string;
  type: string;
  description?: string;
  default?: any;
  required?: boolean;
  alias?: string[];
  valueHint?: string;
  options?: string[];
}

interface FromOntologyOptions {
  template?: "command" | "main";
  outputDir?: string;
  generateFiles?: boolean;
  inlineSubcommands?: boolean;
}

/**
 * Escapes special characters in strings for Turtle format
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, String.raw`\\`)
    .replace(/"/g, String.raw`\"`)
    .replace(/\n/g, String.raw`\n`)
    .replace(/\r/g, String.raw`\r`)
    .replace(/\t/g, String.raw`\t`);
}

/**
 * Resolves a resolvable value (can be a value, promise, or function)
 */
async function resolveValue<T>(value: any): Promise<T> {
  if (typeof value === "function") {
    return await value();
  }
  return await Promise.resolve(value);
}

/**
 * Parses Turtle ontology and extracts command structure
 */
function parseTurtleOntology(turtle: string): ParsedCommand[] {
  const triples: OntologyTriple[] = [];
  const commands: Map<string, ParsedCommand> = new Map();
  const argsMap: Map<string, ParsedArgument> = new Map();

  // Parse Turtle triples
  const lines = turtle.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("@prefix") || trimmed.startsWith("#")) {
      continue;
    }

    // Simple Turtle parser - looks for subject predicate object .
    const match = trimmed.match(/^([^<>\s]+)\s+([^<>\s]+)\s+(.+?)\s*\.?$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({
        subject: subject.replace(/^<|>$/g, ""),
        predicate: predicate.replace(/^<|>$/g, ""),
        object: object.replace(/^<|>$/g, "").replace(/^"|"$/g, ""),
      });
    }
  }

  // Process triples to build command structure
  for (const triple of triples) {
    if (triple.predicate.includes("hasName") && triple.object) {
      const commandUri = triple.subject;
      if (!commands.has(commandUri)) {
        commands.set(commandUri, {
          name: triple.object,
          args: [],
          subCommands: [],
        });
      }
    }

    if (triple.predicate.includes("hasDescription") && triple.object) {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.description = triple.object;
      }
    }

    if (triple.predicate.includes("hasVersion") && triple.object) {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.version = triple.object;
      }
    }

    if (triple.predicate.includes("isHidden") && triple.object === "true") {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.hidden = true;
      }
    }

    // Handle arguments
    if (triple.predicate.includes("hasArgument")) {
      const commandUri = triple.subject;
      const argUri = triple.object;
      const command = commands.get(commandUri);
      if (command) {
        const arg = argsMap.get(argUri) || {
          name: "",
          type: "string",
        };
        command.args.push(arg);
        argsMap.set(argUri, arg);
      }
    }

    // Handle argument properties
    if (triple.predicate.includes("hasName") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      arg.name = triple.object;
    }

    if (triple.predicate.includes("hasType") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      const typeMatch = triple.object.match(/type:(\w+)/);
      if (typeMatch) {
        arg.type = typeMatch[1];
      }
    }

    if (
      triple.predicate.includes("hasDescription") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject)!;
      arg.description = triple.object;
    }

    if (
      triple.predicate.includes("hasDefaultValue") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject)!;
      const value = triple.object;
      // Parse the value based on type
      try {
        if (arg.type === "number") {
          const parsed = Number.parseFloat(value);
          if (Number.isNaN(parsed)) {
            throw new TypeError(`Invalid number value: ${value}`);
          }
          arg.default = parsed;
        } else if (arg.type === "boolean") {
          if (value !== "true" && value !== "false") {
            throw new Error(`Invalid boolean value: ${value}`);
          }
          arg.default = value === "true";
        } else {
          arg.default = value;
        }
      } catch (error) {
        console.warn(
          `Error parsing default value for argument ${arg.name}: ${error}`,
        );
        arg.default = value; // Fallback to string value
      }
    }

    if (
      triple.predicate.includes("isRequired") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject)!;
      arg.required = triple.object === "true";
    }

    if (triple.predicate.includes("hasAlias") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      if (!arg.alias) arg.alias = [];
      arg.alias.push(triple.object);
    }

    if (
      triple.predicate.includes("hasValueHint") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject)!;
      arg.valueHint = triple.object;
    }

    if (triple.predicate.includes("hasOption") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      if (!arg.options) arg.options = [];
      arg.options.push(triple.object);
    }

    // Handle subcommands
    if (triple.predicate.includes("hasSubCommand")) {
      const commandUri = triple.subject;
      const subCommandUri = triple.object;
      const command = commands.get(commandUri);
      // Store subcommand reference for later processing
      if (command) {
        if (!command.subCommandUris) {
          command.subCommandUris = [];
        }
        command.subCommandUris.push(subCommandUri);
      }
    }
  }

  // Link subcommands after all triples have been processed
  for (const command of commands.values()) {
    if (command.subCommandUris) {
      for (const subCommandUri of command.subCommandUris) {
        const subCommand = commands.get(subCommandUri);
        if (subCommand) {
          command.subCommands.push(subCommand);
        }
      }
      delete command.subCommandUris; // Clean up temporary property
    }
  }

  return [...commands.values()];
}

/**
 * Converts a Turtle ontology back into citty CLI commands
 */
export async function fromOntology(
  turtle: string,
  options: FromOntologyOptions = {},
): Promise<string> {
  try {
    if (!turtle || typeof turtle !== "string") {
      throw new Error("Valid Turtle ontology string is required");
    }

    const { template = "command", inlineSubcommands = false } = options;

    const commands = parseTurtleOntology(turtle);

    if (commands.length === 0) {
      throw new Error("No commands found in ontology");
    }

    // Find the main command (usually the one without a parent)
    const mainCommand =
      commands.find(
        (cmd) =>
          !commands.some((other) =>
            other.subCommands.some((sub) => sub.name === cmd.name),
          ),
      ) || commands[0];

    if (!mainCommand.name) {
      throw new Error("Main command must have a name");
    }

    if (template === "main") {
      return nunjucks.renderString(MAIN_COMMAND_TEMPLATE, {
        command: mainCommand,
      });
    }

    // Use inline template for subcommands when requested
    const templateToUse = inlineSubcommands
      ? COMMAND_INLINE_TEMPLATE
      : COMMAND_TEMPLATE;

    return nunjucks.renderString(templateToUse, {
      command: mainCommand,
    });
  } catch (error) {
    throw new Error(
      `Failed to convert ontology to command: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generates TypeScript files from ontology
 */
export async function generateFromOntology(
  turtle: string,
  _outputDir: string = "./generated",
): Promise<{ main: string; commands: { [name: string]: string } }> {
  const commands = parseTurtleOntology(turtle);

  if (commands.length === 0) {
    throw new Error("No commands found in ontology");
  }

  // Find main command
  const mainCommand =
    commands.find(
      (cmd) =>
        !commands.some((other) =>
          other.subCommands.some((sub) => sub.name === cmd.name),
        ),
    ) || commands[0];

  // Generate main command file
  const mainContent = nunjucks.renderString(MAIN_COMMAND_TEMPLATE, {
    command: mainCommand,
  });

  // Generate subcommand files
  const subCommandContents: { [name: string]: string } = {};
  for (const subCommand of mainCommand.subCommands) {
    const content = nunjucks.renderString(COMMAND_TEMPLATE, {
      command: subCommand,
    });
    subCommandContents[subCommand.name] = content;
  }

  // In a real implementation, you would write these to files
  // For now, we'll return them as a structured object
  return {
    main: mainContent,
    commands: subCommandContents,
  };
}

/**
 * Validates that a Turtle ontology can be converted back to citty commands
 */
export function validateOntology(turtle: string): boolean {
  try {
    const commands = parseTurtleOntology(turtle);
    return commands.length > 0;
  } catch {
    return false;
  }
}

/**
 * Converts a command to ontology with simple format (no OWL definitions)
 */
export async function toSimpleOntology(
  command: CommandDef,
  options: { baseUri?: string } = {},
): Promise<string> {
  const { baseUri = "http://example.org/citty" } = options;
  const triples: string[] = [];

  // Add prefixes
  triples.push(ONTOLOGY_PREFIXES);

  // Generate triples for the command
  await generateCommandTriples(command, triples, baseUri);

  return triples.join("\n");
}

/**
 * Converts a command to ontology
 */
export async function toOntology(
  command: CommandDef,
  options: {
    baseUri?: string;
    includeDefinitions?: boolean;
    includePrefixes?: boolean;
  } = {},
): Promise<string> {
  try {
    const {
      baseUri = "http://example.org/citty",
      includeDefinitions = true,
      includePrefixes = true,
    } = options;

    if (!command) {
      throw new Error("Command definition is required");
    }

    const triples: string[] = [];

    // Add prefixes and definitions
    if (includePrefixes) {
      triples.push(ONTOLOGY_PREFIXES);
    }
    if (includeDefinitions) {
      triples.push(ONTOLOGY_DEFINITIONS);
    }

    // Generate triples for the command
    await generateCommandTriples(command, triples, baseUri);

    if (triples.length === 0) {
      throw new Error("No triples generated from command definition");
    }

    return triples.join("\n");
  } catch (error) {
    throw new Error(
      `Failed to convert command to ontology: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Recursively generates triples for a command and its subcommands
 */
async function generateCommandTriples(
  command: CommandDef,
  triples: string[],
  baseUri: string,
  parentPath: string[] = [],
): Promise<void> {
  const meta: any = await resolveValue(command.meta || {});
  const args: any = await resolveValue(command.args || {});
  const subCommands: any = await resolveValue(command.subCommands || {});

  // Generate command URI
  const commandName = meta?.name || parentPath.join("-") || "root";
  const commandUri = `${baseUri}/command/${commandName}`;

  // Add command instance
  triples.push(`${commandUri} a citty:Command .`);

  if (meta?.name) {
    triples.push(`${commandUri} citty:hasName "${meta.name}" .`);
  }

  if (meta?.description) {
    triples.push(
      `${commandUri} citty:hasDescription "${escapeString(meta.description)}" .`,
    );
  }

  if (meta?.version) {
    triples.push(`${commandUri} citty:hasVersion "${meta.version}" .`);
  }

  if (meta?.hidden) {
    triples.push(`${commandUri} citty:isHidden "true"^^xsd:boolean .`);
  }

  // Add arguments
  if (args && Object.keys(args).length > 0) {
    for (const [argName, argDef] of Object.entries(args)) {
      const argUri = `${commandUri}/arg/${argName}`;
      triples.push(`${commandUri} citty:hasArgument ${argUri} .`);

      // Generate argument triples
      generateArgumentTriples(argName, argDef, argUri, triples);
    }
  }

  // Add subcommands
  if (subCommands && Object.keys(subCommands).length > 0) {
    for (const [subName, subCommand] of Object.entries(subCommands)) {
      const subCommandResolved = await resolveValue(subCommand);
      const subMeta: any = await resolveValue(
        (subCommandResolved as CommandDef).meta || {},
      );
      const subCommandName = subMeta?.name || subName;
      const subUri = `${baseUri}/command/${subCommandName}`;
      triples.push(`${commandUri} citty:hasSubCommand ${subUri} .`);

      // Recursively generate triples for subcommand
      await generateCommandTriples(
        subCommandResolved as CommandDef,
        triples,
        baseUri,
        [...parentPath, subName],
      );
    }
  }
}

/**
 * Generates triples for a single argument
 */
function generateArgumentTriples(
  argName: string,
  argDef: any,
  argUri: string,
  triples: string[],
): void {
  triples.push(`${argUri} a citty:Argument .`);
  triples.push(`${argUri} citty:hasName "${argName}" .`);

  if (argDef.type) {
    triples.push(`${argUri} citty:hasType type:${argDef.type} .`);
  }

  if (argDef.description) {
    triples.push(
      `${argUri} citty:hasDescription "${escapeString(argDef.description)}" .`,
    );
  }

  if (argDef.default !== undefined) {
    const defaultValue = `"${escapeString(argDef.default.toString())}"`;
    triples.push(`${argUri} citty:hasDefaultValue ${defaultValue} .`);
  }

  if (argDef.required) {
    triples.push(`${argUri} citty:isRequired "true"^^xsd:boolean .`);
  }

  if ("alias" in argDef && argDef.alias) {
    const aliases = Array.isArray(argDef.alias) ? argDef.alias : [argDef.alias];
    for (const alias of aliases) {
      triples.push(`${argUri} citty:hasAlias "${alias}" .`);
    }
  }

  if (argDef.valueHint) {
    triples.push(
      `${argUri} citty:hasValueHint "${escapeString(argDef.valueHint)}" .`,
    );
  }

  if ("options" in argDef && argDef.options && Array.isArray(argDef.options)) {
    for (const option of argDef.options) {
      triples.push(
        `${argUri} citty:hasOption "${escapeString(option.toString())}" .`,
      );
    }
  }
}
