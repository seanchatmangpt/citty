import { generateObject } from "ai";
import { ollama } from "ollama-ai-provider-v2";
import { defineCommand } from "../command";
import { toOntology } from "../ontology";
import {
  CommandGenerationSchema,
  type CommandGeneration,
} from "../ontology-to-zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import nunjucks from "nunjucks";

/**
 * Command definition for AI-powered command generation
 */
export const generateAICommand = defineCommand({
  meta: {
    name: "generate-ai",
    description: "Generate CLI commands using Ollama AI with natural language",
    version: "1.0.0",
  },
  args: {
    prompt: {
      type: "string",
      description: "Natural language description of the command to generate",
      required: true,
    },
    model: {
      type: "string",
      description: "Ollama model to use",
      default: "qwen2.5-coder:3b",
    },
    format: {
      type: "enum",
      description: "Output format",
      default: "ontology",
      options: ["ontology", "json", "typescript"],
    },
    output: {
      type: "string",
      description: "Output directory for generated files",
      default: "./generated",
    },
    temperature: {
      type: "number",
      description: "Model temperature (0-1)",
      default: 0.7,
    },
    verbose: {
      type: "boolean",
      description: "Show verbose output",
      default: false,
      alias: "v",
    },
  },
  async run({ args }) {
    const { prompt, model, format, output, temperature, verbose } = args;

    if (verbose) {
      console.log(`🤖 Using Ollama model: ${model}`);
      console.log(`📝 Prompt: ${prompt}`);
      console.log(`🌡️  Temperature: ${temperature}`);
    }

    try {
      // System prompt for command generation
      const systemPrompt = `You are an expert CLI command designer. Generate well-structured CLI commands based on natural language descriptions.
      
      Follow these guidelines:
      - Create clear, intuitive command names
      - Add helpful descriptions for all commands and arguments
      - Use appropriate argument types (string, number, boolean, enum)
      - Include sensible defaults where appropriate
      - Add short aliases for commonly used arguments
      - Follow Unix CLI conventions
      
      Generate a command structure that would be useful for developers.`;

      if (verbose) {
        console.log("\n🔄 Generating command structure with AI...");
      }

      // Create Ollama provider
      const ollamaProvider = ollama;

      // Generate the command structure using AI
      const result = await generateObject({
        model: ollamaProvider(model, {
          baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
        }),
        temperature,
        schema: CommandGenerationSchema,
        system: systemPrompt,
        prompt: `Create a CLI command for: ${prompt}`,
      });

      const generatedCommand = result.object as CommandGeneration;

      if (verbose) {
        console.log("\n✅ Command structure generated successfully!");
        console.log("\n📋 Generated Command:");
        console.log(JSON.stringify(generatedCommand, undefined, 2));
      }

      // Convert to desired format
      switch (format) {
        case "ontology": {
          const ontology = await commandGenerationToOntology(generatedCommand);
          console.log("\n🦉 Ontology Output:");
          console.log(ontology);

          if (output !== "./generated") {
            const outputPath = join(output, `${generatedCommand.name}.ttl`);
            mkdirSync(output, { recursive: true });
            writeFileSync(outputPath, ontology, "utf8");
            console.log(`\n💾 Saved to: ${outputPath}`);
          }
          break;
        }

        case "json": {
          console.log("\n📄 JSON Output:");
          console.log(JSON.stringify(generatedCommand, undefined, 2));

          if (output !== "./generated") {
            const outputPath = join(output, `${generatedCommand.name}.json`);
            mkdirSync(output, { recursive: true });
            writeFileSync(
              outputPath,
              JSON.stringify(generatedCommand, undefined, 2),
              "utf8",
            );
            console.log(`\n💾 Saved to: ${outputPath}`);
          }
          break;
        }

        case "typescript": {
          const tsCode = generateTypeScriptCode(generatedCommand);
          console.log("\n📦 TypeScript Output:");
          console.log(tsCode);

          if (output !== "./generated") {
            const outputPath = join(output, `${generatedCommand.name}.ts`);
            mkdirSync(output, { recursive: true });
            writeFileSync(outputPath, tsCode, "utf8");
            console.log(`\n💾 Saved to: ${outputPath}`);
          }
          break;
        }
      }

      // Generate example usage
      if (verbose) {
        console.log("\n📖 Example Usage:");
        console.log(generateExampleUsage(generatedCommand));
      }
    } catch (error) {
      console.error("\n❌ Error generating command:", error);
      process.exit(1);
    }
  },
});

/**
 * Convert CommandGeneration to citty CommandDef format
 */
function commandGenerationToCittyCommand(cmd: CommandGeneration): any {
  const cittyCommand: any = {
    meta: {
      name: cmd.name,
      description: cmd.description,
      version: cmd.version || "1.0.0",
    },
  };

  // Convert arguments
  if (cmd.args && cmd.args.length > 0) {
    cittyCommand.args = {};
    for (const arg of cmd.args) {
      cittyCommand.args[arg.name] = {
        type: arg.type,
        description: arg.description,
        required: arg.required,
        default: arg.default,
        alias: arg.alias?.[0],
        valueHint: arg.valueHint,
        options: arg.options,
      };
    }
  }

  // Convert subcommands recursively
  if (cmd.subCommands && cmd.subCommands.length > 0) {
    cittyCommand.subCommands = {};
    for (const subCmd of cmd.subCommands) {
      cittyCommand.subCommands[subCmd.name] =
        commandGenerationToCittyCommand(subCmd);
    }
  }

  return cittyCommand;
}

/**
 * Convert CommandGeneration to ontology
 */
async function commandGenerationToOntology(
  cmd: CommandGeneration,
): Promise<string> {
  const cittyCommand = commandGenerationToCittyCommand(cmd);
  return toOntology(cittyCommand);
}

/**
 * Generate TypeScript code for the command
 */
function generateTypeScriptCode(cmd: CommandGeneration): string {
  const template = `import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "{{ name }}",
    description: "{{ description }}",
    version: "{{ version }}",
  },
  {%- if args and args.length > 0 %}
  args: {
    {%- for arg in args %}
    {{ arg.name }}: {
      type: "{{ arg.type }}",
      description: "{{ arg.description }}",
      {%- if arg.required %}
      required: true,
      {%- endif %}
      {%- if arg.default !== undefined %}
      default: {{ arg.default | dump }},
      {%- endif %}
      {%- if arg.alias and arg.alias.length > 0 %}
      alias: "{{ arg.alias[0] }}",
      {%- endif %}
      {%- if arg.valueHint %}
      valueHint: "{{ arg.valueHint }}",
      {%- endif %}
      {%- if arg.options and arg.options.length > 0 %}
      options: {{ arg.options | dump }},
      {%- endif %}
    },
    {%- endfor %}
  },
  {%- endif %}
  {%- if subCommands and subCommands.length > 0 %}
  subCommands: {
    {%- for subCmd in subCommands %}
    {{ subCmd.name }}: () => import("./{{ subCmd.name }}").then((r) => r.default),
    {%- endfor %}
  },
  {%- endif %}
  run({ args }) {
    // TODO: Implement command logic
    console.log("Running {{ name }} with args:", args);
  },
});`;

  return nunjucks.renderString(template, cmd);
}

/**
 * Generate example usage for the command
 */
function generateExampleUsage(cmd: CommandGeneration): string {
  let usage = `$ ${cmd.name}`;

  if (cmd.args && cmd.args.length > 0) {
    for (const arg of cmd.args) {
      if (arg.required) {
        usage += ` --${arg.name} <value>`;
      } else if (arg.alias && arg.alias.length > 0) {
        usage += ` [-${arg.alias[0]}]`;
      }
    }
  }

  if (cmd.subCommands && cmd.subCommands.length > 0) {
    usage += `\n\nSubcommands:`;
    for (const subCmd of cmd.subCommands) {
      usage += `\n  ${cmd.name} ${subCmd.name} - ${subCmd.description}`;
    }
  }

  return usage;
}

export default generateAICommand;
