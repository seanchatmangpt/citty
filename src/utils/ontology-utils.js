// Utility functions for ontology operations
import nunjucks from "nunjucks";
import { parseTurtleTriples, buildCommandStructure } from "./turtle-parser.js";
import {
  COMMAND_TEMPLATE,
  MAIN_COMMAND_TEMPLATE,
  ONTOLOGY_PREFIXES,
  ONTOLOGY_DEFINITIONS,
} from "./templates.js";

/**
 * Escapes special characters in strings for Turtle format
 */
export function escapeString(str) {
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
export async function resolveValue(value) {
  if (typeof value === "function") {
    return await value();
  }
  return await Promise.resolve(value);
}

/**
 * Converts a citty CLI command definition into a Turtle ontology
 */
export async function toOntology(command, options = {}) {
  const {
    baseUri = "http://example.org/citty",
    includeDefinitions = true,
    includePrefixes = true,
  } = options;

  const triples = [];

  // Add prefixes and definitions
  if (includePrefixes) {
    triples.push(ONTOLOGY_PREFIXES);
  }
  if (includeDefinitions) {
    triples.push(ONTOLOGY_DEFINITIONS);
  }

  // Generate triples for the command
  await generateCommandTriples(command, triples, baseUri);

  return triples.join("\n");
}

/**
 * Recursively generates triples for a command and its subcommands
 */
async function generateCommandTriples(
  command,
  triples,
  baseUri,
  parentPath = [],
) {
  const meta = await resolveValue(command.meta);
  const args = await resolveValue(command.args);
  const subCommands = await resolveValue(command.subCommands);

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
      const subUri = `${commandUri}/sub/${subName}`;
      triples.push(`${commandUri} citty:hasSubCommand ${subUri} .`);

      // Recursively generate triples for subcommand
      await generateCommandTriples(subCommandResolved, triples, baseUri, [
        ...parentPath,
        subName,
      ]);
    }
  }
}

/**
 * Generates triples for a single argument
 */
function generateArgumentTriples(argName, argDef, argUri, triples) {
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
    const defaultValue =
      typeof argDef.default === "string"
        ? `"${escapeString(argDef.default)}"`
        : argDef.default.toString();
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

/**
 * Converts a Turtle ontology back into citty CLI commands
 */
export async function fromOntology(turtle, options = {}) {
  const { template = "command" } = options;

  const triples = parseTurtleTriples(turtle);
  const commands = buildCommandStructure(triples);

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

  return template === "main"
    ? nunjucks.renderString(MAIN_COMMAND_TEMPLATE, {
        command: mainCommand,
      })
    : nunjucks.renderString(COMMAND_TEMPLATE, {
        command: mainCommand,
      });
}

/**
 * Generates TypeScript files from ontology
 */
export async function generateFromOntology(turtle) {
  const triples = parseTurtleTriples(turtle);
  const commands = buildCommandStructure(triples);

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
  const subCommandContents = {};
  for (const subCommand of mainCommand.subCommands) {
    const content = nunjucks.renderString(COMMAND_TEMPLATE, {
      command: subCommand,
    });
    subCommandContents[subCommand.name] = content;
  }

  return {
    main: mainContent,
    commands: subCommandContents,
  };
}

/**
 * Validates that a Turtle ontology can be converted back to citty commands
 */
export function validateOntology(turtle) {
  try {
    const triples = parseTurtleTriples(turtle);
    const commands = buildCommandStructure(triples);
    return commands.length > 0;
  } catch {
    return false;
  }
}
