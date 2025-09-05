import { defineCommand } from "../../src/index.js";
import { traceCommand } from "../../src/otel/instrumentation.js";
import { WeaverForgeJS } from "../weaver-forge-js.js";
import { OllamaGenerator } from "../../src/ai/ollama-generator.js";
import consola from "consola";
import { existsSync } from "node:fs";
import { join } from "node:path";
import ora from "ora";

export default defineCommand({
  meta: {
    name: "generate",
    description: "🚀 Generate production-grade CLIs from natural language or semantic conventions",
  },
  args: {
    prompt: {
      type: "string",
      description: "Natural language description of the CLI to generate",
      required: false,
    },
    schema: {
      type: "string", 
      description: "Path to semantic conventions YAML schema",
      alias: "s",
      valueHint: "path/to/schema.yaml",
    },
    output: {
      type: "string",
      description: "Output directory for generated CLI",
      alias: "o",
      default: "./generated-cli",
    },
    name: {
      type: "string",
      description: "Name for the generated CLI package",
      alias: "n",
    },
    model: {
      type: "string",
      description: "AI model to use for generation",
      default: "qwen3-coder:30b",
      valueHint: "model-name",
    },
    template: {
      type: "string",
      description: "Template to use for generation",
      default: "typescript-cli",
      options: ["typescript-cli", "javascript-cli", "minimal", "full-stack"],
    },
    features: {
      type: "string",
      description: "Comma-separated list of features to include",
      valueHint: "otel,tests,docs",
    },
    complexity: {
      type: "string",
      description: "CLI complexity level",
      default: "medium",
      options: ["simple", "medium", "complex"],
    },
    style: {
      type: "string", 
      description: "CLI style preference",
      default: "modern",
      options: ["modern", "classic", "minimal"],
    },
    author: {
      type: "string",
      description: "Author name for package.json",
      valueHint: "Your Name",
    },
    license: {
      type: "string",
      description: "License for the package",
      default: "MIT",
    },
    includeOtel: {
      type: "boolean",
      description: "Include OpenTelemetry instrumentation",
      default: true,
      alias: "otel",
    },
    includeTests: {
      type: "boolean", 
      description: "Generate test files",
      default: true,
      alias: "tests",
    },
    includeDocs: {
      type: "boolean",
      description: "Generate documentation",
      default: true,
      alias: "docs",
    },
    dryRun: {
      type: "boolean",
      description: "Show what would be generated without creating files",
      alias: "dry",
    },
    verbose: {
      type: "boolean",
      description: "Show detailed progress information",
      alias: "v",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing output directory",
      alias: "f",
    },
  },
  
  async run({ args }) {
    return traceCommand('generate-cli', async (span) => {
      const {
        prompt,
        schema,
        output,
        name,
        model,
        template,
        features,
        complexity,
        style,
        author,
        license,
        includeOtel,
        includeTests,
        includeDocs,
        dryRun,
        verbose,
        force
      } = args;

      // Validate inputs
      if (!prompt && !schema) {
        consola.error("❌ Either --prompt or --schema must be provided");
        process.exit(1);
      }

      if (existsSync(output) && !force && !dryRun) {
        consola.error(`❌ Output directory ${output} already exists. Use --force to overwrite.`);
        process.exit(1);
      }

      span.setAttributes({
        'citty.generation.type': schema ? 'schema-based' : 'prompt-based',
        'citty.generation.model': model,
        'citty.generation.complexity': complexity,
        'citty.generation.template': template,
        'citty.generation.output': output
      });

      let spinner = ora("🔄 Initializing Citty Pro generation...").start();

      try {
        // Phase 1: Generate CLI structure
        let cliStructure: any;
        
        if (schema) {
          // Schema-based generation using Weaver Forge
          spinner.text = "📋 Loading semantic conventions schema...";
          
          if (!existsSync(schema)) {
            throw new Error(`Schema file not found: ${schema}`);
          }

          const forge = new WeaverForgeJS();
          const conventions = await forge.loadConventions(schema);
          
          if (verbose) {
            consola.info(`✅ Loaded ${conventions.groups.length} convention groups`);
          }

          spinner.text = "🔧 Generating CLI from semantic conventions...";
          
          const packageName = name || `cli-from-${conventions._registry?.namespace || 'conventions'}`;
          
          if (dryRun) {
            spinner.succeed("🔍 Dry run complete - Schema-based generation");
            consola.box(`
📦 Package: ${packageName}
📋 Groups: ${conventions.groups.length}
🎯 Commands: ${conventions.groups.map(g => g.id).join(', ')}
📁 Output: ${output}
🏗️  Template: ${template}
            `);
            return;
          }

          await forge.generateCLI(conventions, output, {
            packageName,
            version: "1.0.0",
            description: `CLI generated from semantic conventions`,
            author,
            includeOTel,
            includeTests,
          });

          cliStructure = {
            name: packageName,
            description: `CLI generated from semantic conventions`,
            commands: conventions.groups.map(g => ({
              name: g.id,
              description: g.brief,
              type: 'command'
            }))
          };

        } else {
          // AI-based generation using natural language prompt
          spinner.text = `🧠 Generating CLI with ${model}...`;
          
          const generator = new OllamaGenerator(model);
          
          // Check if Ollama is available
          const { available, model: availableModel } = await generator.checkAvailability();
          if (!available) {
            throw new Error(`Ollama model ${model} is not available. Please ensure Ollama is running and the model is installed.`);
          }
          
          if (verbose) {
            consola.info(`✅ Using model: ${availableModel}`);
          }

          const featureList = features ? features.split(',').map(f => f.trim()) : [];

          cliStructure = await generator.generateFromPrompt({
            prompt: prompt!,
            model,
            complexity: complexity as any,
            style: style as any,
            includeSubcommands: complexity !== 'simple',
            outputFormat: 'json',
            features: featureList,
          });

          if (verbose) {
            consola.info("✅ AI generation complete");
            consola.info(`📋 Generated: ${cliStructure.name} with ${(cliStructure.args || []).length} arguments`);
          }

          if (dryRun) {
            spinner.succeed("🔍 Dry run complete - AI-based generation");
            consola.box(`
📦 Package: ${name || cliStructure.name}
📝 Description: ${cliStructure.description}
🎯 Commands: ${cliStructure.subCommands?.length || 0} subcommands
📁 Output: ${output}
🤖 Model: ${model}
            `);
            return;
          }

          // Use Weaver Forge to generate the actual project structure
          spinner.text = "🔧 Building project structure...";
          
          // Convert AI-generated structure to semantic conventions format
          const conventions = aiStructureToConventions(cliStructure);
          
          const forge = new WeaverForgeJS();
          await forge.generateCLI(conventions, output, {
            packageName: name || cliStructure.name,
            version: "1.0.0", 
            description: cliStructure.description,
            author,
            includeOTel,
            includeTests,
          });
        }

        // Phase 2: Post-processing and enhancements
        spinner.text = "⚡ Adding production enhancements...";
        
        await addProductionEnhancements(output, {
          includeDocs,
          includeOtel,
          template,
          verbose
        });

        // Phase 3: Final validation and setup
        spinner.text = "✅ Validating generated CLI...";
        
        const validationResults = await validateGeneratedCLI(output);
        
        if (validationResults.errors.length > 0) {
          throw new Error(`Validation failed: ${validationResults.errors.join(', ')}`);
        }

        spinner.succeed("🎉 CLI generation completed successfully!");

        // Display results
        consola.box(`
🎯 Generated CLI: ${cliStructure.name}
📁 Location: ${output}
🏗️  Template: ${template}
📦 Features: ${[
  includeOtel && '🔍 OpenTelemetry',
  includeTests && '🧪 Tests', 
  includeDocs && '📚 Documentation'
].filter(Boolean).join(', ')}

🚀 Next steps:
  cd ${output}
  npm install
  npm run build
  npm start --help
        `);

        if (verbose) {
          consola.info("🔍 Generated files:");
          consola.info(`  - package.json`);
          consola.info(`  - tsconfig.json`);
          consola.info(`  - src/cli.ts`);
          consola.info(`  - src/commands/*.ts`);
          if (includeOtel) consola.info(`  - src/instrumentation.ts`);
          if (includeTests) consola.info(`  - test/*.test.ts`);
          if (includeDocs) consola.info(`  - README.md`);
        }

      } catch (error) {
        spinner.fail("❌ Generation failed");
        consola.error(error);
        
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        
        process.exit(1);
      } finally {
        span.end();
      }
    });
  },
});

/**
 * Convert AI-generated structure to semantic conventions format
 */
function aiStructureToConventions(cliStructure: any): any {
  return {
    _registry: {
      namespace: 'generated.cli',
      version: '1.0.0'
    },
    groups: [{
      id: cliStructure.name.replace(/[^a-zA-Z0-9]/g, '_'),
      type: 'span',
      brief: cliStructure.description,
      prefix: cliStructure.name,
      stability: 'experimental',
      attributes: (cliStructure.args || []).map((arg: any) => ({
        id: `${cliStructure.name}.${arg.name}`,
        type: mapArgTypeToConventionType(arg.type),
        brief: arg.description,
        examples: arg.examples || [],
        requirement_level: arg.required ? 'required' : 'recommended'
      }))
    }]
  };
}

/**
 * Map CLI argument type to semantic convention type
 */
function mapArgTypeToConventionType(argType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'number': 'int', 
    'boolean': 'boolean',
    'enum': 'string',
    'positional': 'string'
  };
  return typeMap[argType] || 'string';
}

/**
 * Add production-grade enhancements to generated CLI
 */
async function addProductionEnhancements(
  outputPath: string,
  options: {
    includeDocs: boolean;
    includeOtel: boolean;
    template: string;
    verbose: boolean;
  }
): Promise<void> {
  const { includeDocs, includeOtel, template, verbose } = options;

  // Generate README.md
  if (includeDocs) {
    const readmeContent = `# Generated CLI

This CLI was generated using Citty Pro v2026.1.1 with ${template} template.

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`bash
npm start --help
\`\`\`

${includeOtel ? `
## Observability

This CLI includes OpenTelemetry instrumentation:
- Traces are exported to console (development)
- Metrics available at http://localhost:9464/metrics (if Prometheus exporter enabled)

To configure exporters, set environment variables:
- \`OTEL_EXPORTER_OTLP_ENDPOINT\`
- \`OTEL_EXPORTER_JAEGER_ENDPOINT\`
` : ''}

## Development

\`\`\`bash
npm run dev    # Run in development mode
npm test       # Run tests
npm run build  # Build for production
\`\`\`

Generated with ❤️ by [Citty Pro](https://citty-pro.dev)
`;

    await require('node:fs').promises.writeFile(
      join(outputPath, 'README.md'),
      readmeContent,
      'utf-8'
    );
  }

  // Add GitHub Actions workflow
  const workflowDir = join(outputPath, '.github', 'workflows');
  await require('node:fs').promises.mkdir(workflowDir, { recursive: true });
  
  const workflowContent = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        
    - run: npm ci
    - run: npm run build
    - run: npm test
`;

  await require('node:fs').promises.writeFile(
    join(workflowDir, 'ci.yml'),
    workflowContent,
    'utf-8'
  );

  if (verbose) {
    consola.info("✅ Added production enhancements");
  }
}

/**
 * Validate the generated CLI structure
 */
async function validateGeneratedCLI(outputPath: string): Promise<{
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required files exist
  const requiredFiles = [
    'package.json',
    'tsconfig.json', 
    'src/cli.ts'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(outputPath, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // Validate package.json structure
  try {
    const packageJson = JSON.parse(
      await require('node:fs').promises.readFile(join(outputPath, 'package.json'), 'utf-8')
    );

    if (!packageJson.name) errors.push('package.json missing name field');
    if (!packageJson.version) errors.push('package.json missing version field');
    if (!packageJson.bin) warnings.push('package.json missing bin field');
    if (!packageJson.scripts?.build) warnings.push('package.json missing build script');

  } catch (err) {
    errors.push('Invalid package.json format');
  }

  return { errors, warnings };
}