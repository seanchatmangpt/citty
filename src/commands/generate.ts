import { defineCommand } from "../command";
import { toOntology, generateFromOntology } from "../ontology";
import { resolveValue } from "../_utils";
import { generateText } from "ai";
import { ollama } from "ollama-ai-provider-v2";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CommandDef } from "../types";

interface GenerateOptions {
  model: string;
  prompt: string;
  output?: string;
  format: "ontology" | "files";
  temperature: number;
  verbose: boolean;
}

/**
 * Generates CLI command structure using Ollama AI
 */
async function generateCLIFromPrompt(
  prompt: string,
  model: string,
  temperature: number,
): Promise<CommandDef> {
  const systemPrompt = `You are a CLI command generator that creates well-structured command definitions for the citty CLI framework.

Given a user's description, generate a complete CommandDef object that includes:
- meta: name, description, and version
- args: properly typed arguments with descriptions, defaults, and validation
- subCommands: any logical subcommands if applicable
- Proper TypeScript types

Return ONLY a valid JSON object that represents a CommandDef. The structure should follow this pattern:

{
  "meta": {
    "name": "command-name",
    "description": "Brief description",
    "version": "1.0.0"
  },
  "args": {
    "argumentName": {
      "type": "string" | "number" | "boolean" | "enum",
      "description": "Argument description",
      "required": true/false,
      "default": "defaultValue",
      "alias": ["shorthand"],
      "valueHint": "hint for user"
    }
  },
  "subCommands": {
    "subCommandName": {
      "meta": { "name": "subCommandName", "description": "Sub description" },
      "args": { ... }
    }
  }
}

Make the command practical, well-documented, and follow CLI best practices.`;

  try {
    const { text } = await generateText({
      model: ollama(model),
      system: systemPrompt,
      prompt: `Create a CLI command for: ${prompt}`,
      temperature,
    });

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }

    const commandDef = JSON.parse(jsonMatch[0]) as CommandDef;

    // Validate basic structure
    const meta = await resolveValue(commandDef.meta);
    if (!meta?.name) {
      throw new Error("Generated command missing required name");
    }

    return commandDef;
  } catch (error) {
    throw new Error(
      `Failed to generate CLI command: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Writes generated files to the output directory
 */
async function writeGeneratedFiles(
  commandDef: CommandDef,
  outputDir: string,
  ontology: string,
): Promise<void> {
  try {
    // Create output directory
    mkdirSync(outputDir, { recursive: true });

    // Write ontology file
    writeFileSync(join(outputDir, "ontology.ttl"), ontology);

    // Generate and write command files
    const generatedFiles = await generateFromOntology(ontology, outputDir);

    // Resolve meta to get the command name
    const meta = await resolveValue(commandDef.meta);
    const commandName = meta?.name || "cli";

    // Write main command file
    writeFileSync(join(outputDir, `${commandName}.ts`), generatedFiles.main);

    // Write subcommand files
    for (const [name, content] of Object.entries(generatedFiles.commands)) {
      writeFileSync(join(outputDir, `${name}.ts`), content);
    }

    console.log(`✓ Generated files written to: ${outputDir}`);
    console.log(`  - ontology.ttl (ontology definition)`);
    console.log(`  - ${commandName}.ts (main command)`);

    if (Object.keys(generatedFiles.commands).length > 0) {
      console.log(
        `  - ${Object.keys(generatedFiles.commands).length} subcommand files`,
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to write files: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate CLI commands using Ollama AI provider",
    version: "1.0.0",
  },
  args: {
    prompt: {
      type: "string",
      description: "Description of the CLI command you want to generate",
      required: true,
      valueHint:
        '"Create a file management CLI with list, copy, and delete commands"',
    },
    model: {
      type: "string",
      description: "Ollama model to use for generation",
      default: "llama3.2",
      alias: ["m"],
      valueHint: "model-name",
    },
    output: {
      type: "string",
      description: "Output directory for generated files",
      alias: ["o"],
      valueHint: "./generated",
    },
    format: {
      type: "enum",
      description: "Output format: ontology only or complete files",
      options: ["ontology", "files"],
      default: "ontology",
      alias: ["f"],
    },
    temperature: {
      type: "number",
      description: "AI generation temperature (0.0-1.0)",
      default: 0.3,
      alias: ["t"],
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
      alias: ["v"],
    },
  },
  async run({ args }) {
    const { prompt, model, output, format, temperature, verbose } =
      args as GenerateOptions;

    if (verbose) {
      console.log(`🤖 Generating CLI command with Ollama model: ${model}`);
      console.log(`📝 Prompt: ${prompt}`);
      console.log(`🌡️  Temperature: ${temperature}`);
    }

    try {
      // Generate command definition using AI
      console.log("🔄 Generating command structure...");
      const commandDef = await generateCLIFromPrompt(
        prompt,
        model,
        temperature,
      );

      if (verbose) {
        console.log("✓ Generated command definition:");
        console.log(JSON.stringify(commandDef, undefined, 2));
      }

      // Convert to ontology
      console.log("🔄 Converting to ontology format...");
      const ontology = await toOntology(commandDef);

      if (format === "ontology") {
        // Just output the ontology
        console.log("✓ Generated ontology:");
        console.log("=".repeat(50));
        console.log(ontology);
      } else if (format === "files") {
        // Generate complete files
        if (!output) {
          throw new Error(
            "Output directory is required when format is 'files'",
          );
        }

        console.log("🔄 Generating command files...");
        await writeGeneratedFiles(commandDef, output, ontology);
      }

      // Resolve meta for final output
      const meta = await resolveValue(commandDef.meta);
      console.log(`\n✅ Successfully generated CLI command: ${meta?.name}`);

      if (verbose && meta?.description) {
        console.log(`📄 Description: ${meta.description}`);
      }
    } catch (error) {
      console.error(
        "❌ Generation failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  },
});

export default generateCommand;
