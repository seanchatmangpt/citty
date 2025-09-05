import { defineCommand } from "../../src/index.js";
import { traceCommand } from "../../src/otel/instrumentation.js";
import { WeaverForgeJS } from "../weaver-forge-js.js";
import consola from "consola";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";

export default defineCommand({
  meta: {
    name: "forge", 
    description: "🔧 Weaver Forge - Generate code from semantic conventions with production templates",
  },
  args: {
    schema: {
      type: "string",
      description: "Path to semantic conventions YAML schema or directory",
      alias: "s",
      required: true,
      valueHint: "path/to/schema.yaml",
    },
    output: {
      type: "string",
      description: "Output directory for generated code",
      alias: "o",
      default: "./generated",
    },
    template: {
      type: "string",
      description: "Template file or built-in template name",
      alias: "t",
      valueHint: "template.njk",
    },
    context: {
      type: "string",
      description: "Additional context file (JSON/YAML)",
      alias: "c",
      valueHint: "context.json",
    },
    filter: {
      type: "string",
      description: "JQ-style filter to apply to conventions",
      alias: "f",
      valueHint: '.groups[] | select(.type == "span")',
    },
    mode: {
      type: "string",
      description: "Generation mode",
      default: "single",
      options: ["single", "each", "batch"],
    },
    namespace: {
      type: "string",
      description: "Override namespace from schema",
      alias: "ns",
      valueHint: "my.namespace",
    },
    packageName: {
      type: "string",
      description: "Package name for CLI generation",
      alias: "pkg",
      valueHint: "my-generated-cli",
    },
    includeOtel: {
      type: "boolean",
      description: "Include OpenTelemetry instrumentation",
      default: true,
    },
    includeTests: {
      type: "boolean",
      description: "Generate test files",
      default: true,
    },
    includeDocs: {
      type: "boolean", 
      description: "Generate documentation",
      default: true,
    },
    verbose: {
      type: "boolean",
      description: "Show detailed processing information",
      alias: "v",
    },
    dryRun: {
      type: "boolean",
      description: "Show what would be generated without creating files",
      alias: "dry",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing output directory", 
      alias: "f",
    },
    listTemplates: {
      type: "boolean",
      description: "List available built-in templates",
      alias: "list",
    },
    validate: {
      type: "boolean",
      description: "Validate schema without generating",
    },
  },
  
  async run({ args }) {
    return traceCommand('weaver-forge', async (span) => {
      const {
        schema,
        output,
        template,
        context,
        filter,
        mode,
        namespace,
        packageName,
        includeOtel,
        includeTests,
        includeDocs,
        verbose,
        dryRun,
        force,
        listTemplates,
        validate
      } = args;

      // Handle list templates
      if (listTemplates) {
        await showAvailableTemplates();
        return;
      }

      // Validate inputs
      if (!existsSync(schema)) {
        consola.error(`❌ Schema not found: ${schema}`);
        process.exit(1);
      }

      if (existsSync(output) && !force && !dryRun) {
        consola.error(`❌ Output directory ${output} already exists. Use --force to overwrite.`);
        process.exit(1);
      }

      span.setAttributes({
        'forge.schema_path': schema,
        'forge.output_path': output,
        'forge.mode': mode,
        'forge.template': template || 'built-in',
        'forge.namespace': namespace || 'default'
      });

      const spinner = ora("🔄 Initializing Weaver Forge...").start();

      try {
        // Initialize Weaver Forge
        const forge = new WeaverForgeJS({
          excluded_namespaces: [],
          template_syntax: {
            block_start: '{%',
            block_end: '%}',
            variable_start: '{{',
            variable_end: '}}'
          }
        });

        // Load semantic conventions
        spinner.text = "📋 Loading semantic conventions...";
        const conventions = await forge.loadConventions(schema);

        if (verbose) {
          consola.info(`✅ Loaded schema: ${conventions._registry?.namespace || 'unknown'} v${conventions._registry?.version || '1.0.0'}`);
          consola.info(`📊 Groups: ${conventions.groups.length}`);
          consola.info(`🏷️  Total attributes: ${conventions.groups.reduce((sum, g) => sum + (g.attributes?.length || 0), 0)}`);
        }

        // Override namespace if provided
        if (namespace) {
          conventions._registry = conventions._registry || {};
          conventions._registry.namespace = namespace;
        }

        // Validate only mode
        if (validate) {
          spinner.succeed("✅ Schema validation complete");
          await showSchemaDetails(conventions, verbose);
          return;
        }

        // Apply filters if provided
        let filteredConventions = conventions;
        if (filter) {
          spinner.text = "🔍 Applying filters...";
          filteredConventions = await applyFilter(conventions, filter);
          
          if (verbose) {
            consola.info(`🔍 Filtered to ${filteredConventions.groups.length} groups`);
          }
        }

        // Load additional context if provided
        let additionalContext = {};
        if (context) {
          spinner.text = "📝 Loading additional context...";
          additionalContext = await loadContextFile(context);
          
          if (verbose) {
            consola.info(`📝 Loaded context with ${Object.keys(additionalContext).length} keys`);
          }
        }

        // Generate based on mode
        switch (mode) {
          case 'single':
            await generateSingleOutput(
              forge, 
              filteredConventions, 
              output, 
              template, 
              additionalContext,
              { packageName, includeOtel, includeTests, includeDocs, verbose, dryRun }
            );
            break;
            
          case 'each':
            await generateEachOutput(
              forge,
              filteredConventions,
              output,
              template,
              additionalContext,
              { verbose, dryRun }
            );
            break;
            
          case 'batch':
            await generateBatchOutput(
              forge,
              filteredConventions,
              output,
              template,
              additionalContext,
              { verbose, dryRun }
            );
            break;
        }

        if (!dryRun) {
          spinner.succeed("🎉 Weaver Forge generation completed!");
          
          consola.box(`
🔧 Weaver Forge Complete
📋 Schema: ${conventions._registry?.namespace || 'unknown'}
📁 Output: ${output}
🎯 Mode: ${mode}
📦 Groups processed: ${filteredConventions.groups.length}

🚀 Next steps:
  cd ${output}
  npm install
  npm run build
          `);
        } else {
          spinner.succeed("🔍 Dry run complete");
        }

      } catch (error) {
        spinner.fail("❌ Weaver Forge failed");
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
 * Show available built-in templates
 */
async function showAvailableTemplates(): Promise<void> {
  const templates = [
    {
      name: "typescript-cli",
      description: "Full TypeScript CLI with OpenTelemetry support",
      features: ["TypeScript", "OpenTelemetry", "Tests", "Documentation"]
    },
    {
      name: "javascript-cli", 
      description: "JavaScript CLI with modern ES modules",
      features: ["JavaScript", "ES Modules", "Tests"]
    },
    {
      name: "minimal-cli",
      description: "Minimal CLI with basic functionality",
      features: ["Minimal footprint", "Fast generation"]
    },
    {
      name: "command-template",
      description: "Individual command template",
      features: ["Single command", "Customizable"]
    },
    {
      name: "documentation",
      description: "Generate documentation from conventions",
      features: ["Markdown", "API docs", "Examples"]
    }
  ];

  consola.log(chalk.bold("\n🔧 Available Weaver Forge Templates:\n"));
  
  for (const template of templates) {
    consola.log(`${chalk.cyan(template.name.padEnd(20))} ${template.description}`);
    consola.log(`${' '.repeat(20)} ${chalk.gray('Features:')} ${template.features.join(', ')}\n`);
  }

  consola.log(chalk.yellow("Usage: citty-pro forge --schema schema.yaml --template typescript-cli"));
}

/**
 * Show detailed schema information
 */
async function showSchemaDetails(conventions: any, verbose: boolean): Promise<void> {
  const registry = conventions._registry || {};
  
  consola.box(`
📋 Schema Details
🏷️  Namespace: ${registry.namespace || 'unknown'}
📌 Version: ${registry.version || '1.0.0'}
📊 Groups: ${conventions.groups.length}
🏷️  Total Attributes: ${conventions.groups.reduce((sum: number, g: any) => sum + (g.attributes?.length || 0), 0)}
  `);

  if (verbose) {
    consola.log(chalk.bold("\n📊 Groups Summary:"));
    
    for (const group of conventions.groups) {
      const attributeCount = group.attributes?.length || 0;
      const stability = group.stability || 'unknown';
      const stabilityColor = stability === 'stable' ? chalk.green : 
                            stability === 'experimental' ? chalk.yellow : chalk.red;
      
      consola.log(`  ${chalk.cyan(group.id.padEnd(30))} ${attributeCount.toString().padStart(3)} attrs ${stabilityColor(stability)}`);
      if (group.brief) {
        consola.log(`  ${' '.repeat(30)} ${chalk.gray(group.brief)}`);
      }
    }
  }
}

/**
 * Apply JQ-style filter to conventions
 */
async function applyFilter(conventions: any, filterExpression: string): Promise<any> {
  // This is a simplified filter implementation
  // In production, you'd use a proper JQ implementation
  
  const filtered = { ...conventions };
  
  if (filterExpression.includes('select(.type')) {
    // Extract type from filter: select(.type == "span")
    const typeMatch = filterExpression.match(/type\s*==\s*"([^"]+)"/);
    if (typeMatch) {
      const targetType = typeMatch[1];
      filtered.groups = conventions.groups.filter((g: any) => g.type === targetType);
    }
  }
  
  if (filterExpression.includes('select(.stability')) {
    // Extract stability from filter: select(.stability == "stable") 
    const stabilityMatch = filterExpression.match(/stability\s*==\s*"([^"]+)"/);
    if (stabilityMatch) {
      const targetStability = stabilityMatch[1];
      filtered.groups = conventions.groups.filter((g: any) => g.stability === targetStability);
    }
  }
  
  return filtered;
}

/**
 * Load context file (JSON or YAML)
 */
async function loadContextFile(contextPath: string): Promise<any> {
  if (!existsSync(contextPath)) {
    throw new Error(`Context file not found: ${contextPath}`);
  }

  const content = await require('node:fs').promises.readFile(contextPath, 'utf-8');
  
  if (contextPath.endsWith('.json')) {
    return JSON.parse(content);
  }
  
  if (contextPath.endsWith('.yaml') || contextPath.endsWith('.yml')) {
    return require('yaml').parse(content);
  }
  
  throw new Error(`Unsupported context file format: ${contextPath}`);
}

/**
 * Generate single output file
 */
async function generateSingleOutput(
  forge: WeaverForgeJS,
  conventions: any,
  output: string,
  template: string | undefined,
  additionalContext: any,
  options: any
): Promise<void> {
  const { packageName, includeOtel, includeTests, includeDocs, verbose, dryRun } = options;
  
  if (dryRun) {
    consola.info("🔍 Would generate single CLI package:");
    consola.info(`  📦 Package: ${packageName || conventions._registry?.namespace || 'generated-cli'}`);
    consola.info(`  📁 Output: ${output}`);
    consola.info(`  🎯 Commands: ${conventions.groups.length}`);
    consola.info(`  🔧 Features: ${[includeOtel && 'OpenTelemetry', includeTests && 'Tests', includeDocs && 'Docs'].filter(Boolean).join(', ')}`);
    return;
  }

  // Generate full CLI package
  await forge.generateCLI(conventions, output, {
    packageName: packageName || conventions._registry?.namespace?.replace(/\./g, '-') || 'generated-cli',
    version: conventions._registry?.version || '1.0.0',
    description: `CLI generated from ${conventions._registry?.namespace || 'semantic conventions'}`,
    includeOTel: includeOtel,
    includeTests: includeTests,
  });

  if (verbose) {
    consola.info("✅ Generated CLI package with full structure");
  }
}

/**
 * Generate separate output for each convention group
 */
async function generateEachOutput(
  forge: WeaverForgeJS,
  conventions: any,
  output: string,
  template: string | undefined,
  additionalContext: any,
  options: any
): Promise<void> {
  const { verbose, dryRun } = options;
  
  if (dryRun) {
    consola.info("🔍 Would generate files for each group:");
    for (const group of conventions.groups) {
      consola.info(`  📄 ${group.id}.ts - ${group.brief}`);
    }
    return;
  }

  await require('node:fs').promises.mkdir(output, { recursive: true });
  
  // Generate a command file for each group
  for (const group of conventions.groups) {
    const groupConventions = {
      ...conventions,
      groups: [group]  // Single group
    };
    
    const groupOutput = join(output, `${group.id.replace(/\./g, '-')}`);
    
    await forge.generateCLI(groupConventions, groupOutput, {
      packageName: `cli-${group.id.replace(/\./g, '-')}`,
      version: '1.0.0',
      description: group.brief,
      includeOTel: true,
      includeTests: true,
    });
    
    if (verbose) {
      consola.info(`✅ Generated ${group.id} CLI`);
    }
  }
}

/**
 * Generate batch output with multiple files
 */
async function generateBatchOutput(
  forge: WeaverForgeJS,
  conventions: any,
  output: string,
  template: string | undefined,
  additionalContext: any,
  options: any
): Promise<void> {
  const { verbose, dryRun } = options;
  
  if (dryRun) {
    consola.info("🔍 Would generate batch files:");
    consola.info(`  📦 Main CLI package in ${output}`);
    consola.info(`  📄 Documentation files`);
    consola.info(`  📊 Metrics and schema files`);
    return;
  }

  // Generate main CLI
  await forge.generateCLI(conventions, output, {
    packageName: 'batch-generated-cli',
    version: '1.0.0',
    description: 'Batch generated CLI from multiple conventions',
    includeOTel: true,
    includeTests: true,
  });

  // Generate additional documentation
  const docsDir = join(output, 'docs');
  await require('node:fs').promises.mkdir(docsDir, { recursive: true });
  
  const schemaDoc = `# Schema Documentation

Generated from: ${conventions._registry?.namespace || 'unknown'}
Version: ${conventions._registry?.version || '1.0.0'}

## Groups

${conventions.groups.map((g: any) => `
### ${g.id}

**Type:** ${g.type}  
**Brief:** ${g.brief}  
**Stability:** ${g.stability || 'unknown'}

**Attributes:** ${g.attributes?.length || 0}

${g.attributes?.map((attr: any) => `- \`${attr.id}\` (${attr.type}) - ${attr.brief}`).join('\n') || 'No attributes'}
`).join('\n')}
`;

  await require('node:fs').promises.writeFile(
    join(docsDir, 'schema.md'),
    schemaDoc,
    'utf-8'
  );

  if (verbose) {
    consola.info("✅ Generated batch output with documentation");
  }
}