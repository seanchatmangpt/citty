/**
 * Citty command for Weaver Forge integration
 */

import { defineCommand } from '../command';
import { WeaverForge } from './forge-integration';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const createWeaverCommand = () => defineCommand({
  meta: {
    name: 'weaver',
    description: 'Generate code from OpenTelemetry Semantic Conventions using Weaver Forge',
  },
  args: {
    registry: {
      type: 'string',
      description: 'Path to semantic convention registry directory',
      required: true,
      valueHint: './semantic-conventions',
    },
    output: {
      type: 'string',
      description: 'Output directory for generated code',
      default: './generated',
      valueHint: './generated',
    },
    config: {
      type: 'string',
      description: 'Path to weaver.yaml configuration file',
      valueHint: './weaver.yaml',
    },
    target: {
      type: 'enum',
      description: 'Target language for code generation',
      options: ['typescript', 'go', 'rust', 'all'],
      default: 'typescript',
    },
    mode: {
      type: 'enum',
      description: 'Generation mode',
      options: ['cli', 'otel', 'templates', 'all'],
      default: 'all',
    },
    filter: {
      type: 'string',
      description: 'JQ filter to apply to semantic conventions',
      valueHint: 'stable_attributes',
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: 'v',
    },
  },
  subCommands: {
    init: defineCommand({
      meta: {
        name: 'init',
        description: 'Initialize Weaver Forge configuration',
      },
      args: {
        registry: {
          type: 'string',
          description: 'Path to semantic convention registry directory',
          required: true,
        },
        template: {
          type: 'enum',
          description: 'Configuration template to use',
          options: ['basic', 'cli', 'otel', 'custom'],
          default: 'basic',
        },
      },
      async run({ args }) {
        console.log('🔧 Initializing Weaver Forge configuration...');
        
        const configPath = join(args.registry, 'weaver.yaml');
        
        if (existsSync(configPath)) {
          console.log('⚠️  Configuration already exists:', configPath);
          return;
        }

        const { WeaverTemplateManager } = await import('./template-manager');
        const templateManager = new WeaverTemplateManager();
        await templateManager.createInitialConfig(args.registry, args.template);
        
        console.log('✅ Weaver configuration initialized:', configPath);
      },
    }),

    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate code from semantic conventions',
      },
      args: {
        registry: {
          type: 'string',
          description: 'Path to semantic convention registry directory',
          required: true,
        },
        output: {
          type: 'string',
          description: 'Output directory for generated code',
          default: './generated',
        },
        mode: {
          type: 'enum',
          description: 'Generation mode',
          options: ['cli', 'otel', 'templates', 'all'],
          default: 'all',
        },
      },
      async run({ args }) {
        console.log('🚀 Generating code from semantic conventions...');
        console.log('📁 Registry:', args.registry);
        console.log('📂 Output:', args.output);
        console.log('🎯 Mode:', args.mode);

        if (!existsSync(args.registry)) {
          console.error('❌ Registry directory not found:', args.registry);
          process.exit(1);
        }

        const forge = new WeaverForge('', args.registry);
        await forge.initialize();

        try {
          switch (args.mode) {
            case 'cli': {
              await forge.generateCLICommands(args.output);
              console.log('✅ CLI commands generated');
              break;
            }
            
            case 'otel': {
              await forge.generateOpenTelemetryInstrumentation(args.output);
              console.log('✅ OpenTelemetry instrumentation generated');
              break;
            }
            
            case 'templates': {
              await forge.generateCode(args.output);
              console.log('✅ Template-based code generated');
              break;
            }
            
            case 'all': {
              await forge.generateCLICommands(join(args.output, 'commands'));
              await forge.generateOpenTelemetryInstrumentation(join(args.output, 'otel'));
              await forge.generateCode(join(args.output, 'templates'));
              console.log('✅ All code generated');
              break;
            }
          }
        } catch (error) {
          console.error('❌ Generation failed:', error);
          process.exit(1);
        }
      },
    }),

    validate: defineCommand({
      meta: {
        name: 'validate',
        description: 'Validate semantic convention registry',
      },
      args: {
        registry: {
          type: 'string',
          description: 'Path to semantic convention registry directory',
          required: true,
        },
        strict: {
          type: 'boolean',
          description: 'Enable strict validation',
        },
      },
      async run({ args }) {
        console.log('🔍 Validating semantic convention registry...');
        console.log('📁 Registry:', args.registry);

        if (!existsSync(args.registry)) {
          console.error('❌ Registry directory not found:', args.registry);
          process.exit(1);
        }

        const { SemanticConventionValidator } = await import('./validator');
        const validator = new SemanticConventionValidator();
        
        try {
          const result = await validator.validate(args.registry, { strict: args.strict });
          
          if (result.isValid) {
            console.log('✅ Registry validation passed');
            console.log(`📊 Found ${result.stats.groups} groups, ${result.stats.attributes} attributes`);
          } else {
            console.log('❌ Registry validation failed');
            for (const error of result.errors) console.log(`  - ${error}`);
            process.exit(1);
          }
        } catch (error) {
          console.error('❌ Validation failed:', error);
          process.exit(1);
        }
      },
    }),

    templates: defineCommand({
      meta: {
        name: 'templates',
        description: 'Manage Weaver Forge templates',
      },
      subCommands: {
        list: defineCommand({
          meta: {
            name: 'list',
            description: 'List available templates',
          },
          args: {
            registry: {
              type: 'string',
              description: 'Path to semantic convention registry directory',
              required: true,
            },
          },
          async run({ args }) {
            const { WeaverTemplateManager } = await import('./template-manager');
            const templateManager = new WeaverTemplateManager();
            const templates = await templateManager.listTemplates(args.registry);
            
            console.log('📋 Available templates:');
            for (const template of templates) {
              console.log(`  - ${template.name}: ${template.description}`);
            }
          },
        }),

        create: defineCommand({
          meta: {
            name: 'create',
            description: 'Create a new template',
          },
          args: {
            registry: {
              type: 'string',
              description: 'Path to semantic convention registry directory',
              required: true,
            },
            name: {
              type: 'string',
              description: 'Template name',
              required: true,
            },
            type: {
              type: 'enum',
              description: 'Template type',
              options: ['cli', 'otel', 'custom'],
              default: 'custom',
            },
          },
          async run({ args }) {
            const { WeaverTemplateManager } = await import('./template-manager');
            const templateManager = new WeaverTemplateManager();
            
            await templateManager.createTemplate(args.registry, args.name, args.type);
            console.log(`✅ Template created: ${args.name}`);
          },
        }),
      },
    }),
  },
  async run({ args }) {
    console.log('🌊 Weaver Forge - Semantic Convention Code Generator');
    console.log();
    
    if (!existsSync(args.registry)) {
      console.error('❌ Registry directory not found:', args.registry);
      console.log('💡 Use "weaver init <registry-path>" to create initial configuration');
      process.exit(1);
    }

    const forge = new WeaverForge(args.config || '', args.registry);
    await forge.initialize();

    if (args.verbose) {
      console.log('📁 Registry:', args.registry);
      console.log('📂 Output:', args.output);
      console.log('🎯 Target:', args.target);
      console.log('🔧 Mode:', args.mode);
      console.log();
    }

    try {
      switch (args.mode) {
        case 'cli': {
          console.log('🚀 Generating CLI commands...');
          await forge.generateCLICommands(args.output);
          break;
        }
        
        case 'otel': {
          console.log('🚀 Generating OpenTelemetry instrumentation...');
          await forge.generateOpenTelemetryInstrumentation(args.output);
          break;
        }
        
        case 'templates': {
          console.log('🚀 Generating from templates...');
          await forge.generateCode(args.output);
          break;
        }
        
        case 'all': {
          console.log('🚀 Generating all outputs...');
          await forge.generateCLICommands(join(args.output, 'commands'));
          await forge.generateOpenTelemetryInstrumentation(join(args.output, 'otel'));
          await forge.generateCode(join(args.output, 'templates'));
          break;
        }
      }

      console.log(`✅ Code generation completed! Check ${args.output}`);
    } catch (error) {
      console.error('❌ Generation failed:', error);
      if (args.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  },
});