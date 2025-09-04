import { z } from "zod";

interface OntologyTriple {
  subject: string;
  predicate: string;
  object: string;
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

interface ParsedCommand {
  name: string;
  description?: string;
  version?: string;
  hidden?: boolean;
  args: ParsedArgument[];
  subCommands: ParsedCommand[];
}

/**
 * Converts an ontology argument type to a Zod schema
 */
function argTypeToZodSchema(arg: ParsedArgument): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (arg.type) {
    case "string": {
      schema = z.string();
      break;
    }
    case "number": {
      schema = z.number();
      break;
    }
    case "boolean": {
      schema = z.boolean();
      break;
    }
    case "enum": {
      if (arg.options && arg.options.length > 0) {
        // Create enum from options
        const [first, ...rest] = arg.options;
        schema = z.enum([first, ...rest] as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    }
    case "positional": {
      schema = z.string();
      break;
    }
    default: {
      schema = z.string();
    }
  }

  // Add description if available
  if (arg.description) {
    schema = schema.describe(arg.description);
  }

  // Handle optional/required
  if (!arg.required && arg.default === undefined) {
    schema = schema.optional();
  }

  // Handle default values
  if (arg.default !== undefined) {
    schema = schema.default(arg.default);
  }

  return schema;
}

/**
 * Converts a parsed command to a Zod schema
 */
export function commandToZodSchema(command: ParsedCommand): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  // Add metadata fields
  shape.name = z.string().default(command.name).describe("Command name");

  if (command.description) {
    shape.description = z
      .string()
      .default(command.description)
      .describe("Command description");
  }

  if (command.version) {
    shape.version = z
      .string()
      .default(command.version)
      .describe("Command version");
  }

  // Convert arguments to Zod schema
  if (command.args.length > 0) {
    const argsShape: Record<string, z.ZodTypeAny> = {};

    for (const arg of command.args) {
      argsShape[arg.name] = argTypeToZodSchema(arg);
    }

    shape.args = z.object(argsShape).describe("Command arguments");
  }

  // Handle subcommands recursively
  if (command.subCommands.length > 0) {
    const subCommandsShape: Record<string, z.ZodTypeAny> = {};

    for (const subCommand of command.subCommands) {
      subCommandsShape[subCommand.name] = commandToZodSchema(subCommand);
    }

    shape.subCommands = z.object(subCommandsShape).describe("Subcommands");
  }

  return z.object(shape);
}

/**
 * Parse Turtle ontology triples
 */
function parseTurtleTriples(turtle: string): OntologyTriple[] {
  const triples: OntologyTriple[] = [];
  const lines = turtle.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("@prefix") || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([^\s]+)\s+([^\s]+)\s+(.+?)\s*\.$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({
        subject: subject.replace(/^<|>$/g, ""),
        predicate: predicate.replace(/^<|>$/g, ""),
        object: object.replace(/^<|>$/g, "").replace(/^"|"$/g, ""),
      });
    }
  }

  return triples;
}

/**
 * Build command structure from triples
 */
function buildCommandFromTriples(
  triples: OntologyTriple[],
): ParsedCommand | undefined {
  const commands = new Map<string, ParsedCommand>();
  const argsMap = new Map<string, ParsedArgument>();

  // Process triples to build command structure
  for (const triple of triples) {
    if (triple.predicate.includes("hasName") && triple.object) {
      const commandUri = triple.subject;
      if (commands.has(commandUri)) {
        const cmd = commands.get(commandUri)!;
        if (cmd.name) {
          // Command already has a name
        } else {
          cmd.name = triple.object;
        }
      } else {
        commands.set(commandUri, {
          name: triple.object,
          args: [],
          subCommands: [],
        });
      }
    }

    if (triple.predicate.includes("hasDescription") && triple.object) {
      const command = commands.get(triple.subject);
      if (command) {
        command.description = triple.object;
      }
    }

    if (triple.predicate.includes("hasVersion") && triple.object) {
      const command = commands.get(triple.subject);
      if (command) {
        command.version = triple.object;
      }
    }

    // Handle arguments
    if (triple.predicate.includes("hasArgument")) {
      const command = commands.get(triple.subject);
      const argUri = triple.object;
      if (command) {
        const arg = argsMap.get(argUri) || {
          name: "",
          type: "string",
        };
        if (command.args.includes(arg)) {
          // Arg already exists
        } else {
          command.args.push(arg);
        }
        argsMap.set(argUri, arg);
      }
    }

    // Handle argument properties
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
      triple.predicate.includes("isRequired") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject)!;
      arg.required = triple.object === "true";
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

    if (triple.predicate.includes("hasAlias") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      if (!arg.alias) arg.alias = [];
      arg.alias.push(triple.object);
    }

    if (triple.predicate.includes("hasOption") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      if (!arg.options) arg.options = [];
      arg.options.push(triple.object);
    }
  }

  // Update argument names from triples
  for (const triple of triples) {
    if (triple.predicate.includes("hasName") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject)!;
      arg.name = triple.object;
    }
  }

  // Return the main command
  const commandList = [...commands.values()];
  return commandList.length > 0 ? commandList[0] : undefined;
}

/**
 * Converts an ontology string to a Zod schema
 */
export function ontologyToZod(ontology: string): z.ZodObject<any> | undefined {
  try {
    if (!ontology || typeof ontology !== "string") {
      throw new Error("Valid ontology string is required");
    }

    const triples = parseTurtleTriples(ontology);
    if (triples.length === 0) {
      throw new Error("No valid triples found in ontology");
    }

    const command = buildCommandFromTriples(triples);
    if (!command) {
      throw new Error("No valid command structure found in ontology");
    }

    return commandToZodSchema(command);
  } catch (error) {
    console.warn(
      `Failed to convert ontology to Zod schema: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

/**
 * Create a Zod schema for command generation
 */
export const CommandGenerationSchema = z.object({
  name: z.string().describe("The name of the command"),
  description: z
    .string()
    .describe("A brief description of what the command does"),
  version: z
    .string()
    .optional()
    .default("1.0.0")
    .describe("The version of the command"),
  args: z
    .array(
      z.object({
        name: z.string().describe("The name of the argument"),
        type: z
          .enum(["string", "number", "boolean", "enum", "positional"])
          .describe("The type of the argument"),
        description: z
          .string()
          .describe("Description of what the argument does"),
        required: z
          .boolean()
          .optional()
          .describe("Whether the argument is required"),
        default: z.any().optional().describe("Default value for the argument"),
        alias: z
          .array(z.string())
          .optional()
          .describe("Short aliases for the argument"),
        options: z
          .array(z.string())
          .optional()
          .describe("Available options for enum type"),
        valueHint: z.string().optional().describe("Hint for the value format"),
      }),
    )
    .optional()
    .default([])
    .describe("The arguments for the command"),
  subCommands: z
    .array(z.lazy(() => CommandGenerationSchema))
    .optional()
    .describe("Subcommands"),
});

export type CommandGeneration = z.infer<typeof CommandGenerationSchema>;
