#!/usr/bin/env node
/**
 * Unjucks CLI - Production v1.0.0
 * Full-featured command-line interface with ultrathink definition of done
 */

import { defineCommand, runMain } from 'citty';
import { resolve } from 'pathe';
import { readFile, writeFile, access } from 'node:fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import Table from 'cli-table3';
import { createUnjucks, generateFromOntology, resolveTemplate, renderTemplate, listGenerators } from './index';

// Main command
const main = defineCommand({
  meta: {
    name: 'unjucks',
    version: '1.0.0',
    description: '🎯 Ontology-driven template engine for citty-pro'
  },
  
  args: {
    generator: {
      type: 'positional',
      description: 'Generator name (e.g., command, workflow, task)',
      required: false
    },
    action: {
      type: 'positional', 
      description: 'Action to perform (e.g., new, update, delete)',
      default: 'new'
    }
  },
  
  subCommands: {
    // Generate from templates
    generate: defineCommand({
      meta: {
        description: 'Generate files from templates and ontology'
      },
      args: {
        source: {
          type: 'string',
          alias: 's',
          description: 'Ontology source file (TTL/N3)',
          required: true
        },
        generator: {
          type: 'string',
          alias: 'g',
          description: 'Specific generator to use'
        },
        output: {
          type: 'string',
          alias: 'o',
          description: 'Output directory',
          default: './src'
        },
        'dry-run': {
          type: 'boolean',
          description: 'Preview without writing files',
          default: false
        },
        diff: {
          type: 'boolean',
          description: 'Show diffs for existing files',
          default: false
        }
      },
      async run({ args }) {
        const spinner = ora('Initializing unjucks...').start();
        
        try {
          // Initialize
          await createUnjucks({
            outputDir: args.output,
            dryRun: args['dry-run'],
            showDiff: args.diff
          });
          
          spinner.text = 'Generating from ontology...';
          
          // Generate
          const result = await generateFromOntology(
            resolve(args.source),
            args.generator
          );
          
          spinner.stop();
          
          // Display results
          if (result.success) {
            console.log(chalk.green(`\n✅ Successfully generated ${result.files.length} files`));
            
            const table = new Table({
              head: [chalk.cyan('File'), chalk.cyan('Status')],
              style: { head: [], border: [] }
            });
            
            result.files.forEach(file => {
              table.push([
                file.path,
                args['dry-run'] ? chalk.yellow('Preview') : chalk.green('Created')
              ]);
            });
            
            console.log(table.toString());
            console.log(chalk.dim(`\nCompleted in ${result.duration}ms`));
          } else {
            console.log(chalk.red('\n❌ Generation failed:'));
            result.errors?.forEach(err => console.error(chalk.red(`  - ${err.message}`)));
            process.exit(1);
          }
        } catch (error: any) {
          spinner.fail('Generation failed');
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }
    }),
    
    // List available templates
    list: defineCommand({
      meta: {
        description: 'List available generators and templates'
      },
      args: {
        verbose: {
          type: 'boolean',
          alias: 'v',
          description: 'Show detailed template information',
          default: false
        }
      },
      async run({ args }) {
        const spinner = ora('Loading templates...').start();
        
        try {
          const ctx = await createUnjucks();
          const generators = listGenerators();
          
          spinner.stop();
          
          console.log(chalk.cyan('\n📁 Available Generators:\n'));
          
          if (args.verbose) {
            // Detailed view
            generators.forEach(gen => {
              console.log(chalk.bold(`  ${gen}/`));
              
              const templates = Array.from(ctx.templates.values())
                .filter(t => t.generator === gen);
              
              templates.forEach(t => {
                console.log(chalk.dim(`    └─ ${t.action}`));
                if (t.frontMatter.description) {
                  console.log(chalk.dim(`       ${t.frontMatter.description}`));
                }
              });
              
              console.log();
            });
          } else {
            // Simple list
            generators.forEach(gen => {
              const count = Array.from(ctx.templates.values())
                .filter(t => t.generator === gen).length;
              console.log(`  • ${chalk.green(gen)} ${chalk.dim(`(${count} templates)`)}`);
            });
          }
          
          console.log(chalk.dim(`\n${ctx.templates.size} total templates available`));
        } catch (error: any) {
          spinner.fail('Failed to load templates');
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }
    }),
    
    // Initialize new project
    init: defineCommand({
      meta: {
        description: 'Initialize unjucks in current directory'
      },
      args: {
        force: {
          type: 'boolean',
          alias: 'f',
          description: 'Overwrite existing configuration',
          default: false
        }
      },
      async run({ args }) {
        const spinner = ora('Initializing project...').start();
        
        try {
          // Check for existing config
          const configPath = resolve('.unjucks.json');
          
          try {
            await access(configPath);
            if (!args.force) {
              spinner.stop();
              
              const response = await prompts({
                type: 'confirm',
                name: 'overwrite',
                message: 'Configuration already exists. Overwrite?',
                initial: false
              });
              
              if (!response.overwrite) {
                console.log(chalk.yellow('Initialization cancelled'));
                return;
              }
              
              spinner.start('Initializing project...');
            }
          } catch {
            // Config doesn't exist, proceed
          }
          
          // Create default configuration
          const config = {
            version: '1.0.0',
            templatesDir: './templates',
            outputDir: './src',
            ontologyDir: './ontologies',
            defaultGenerator: 'command',
            options: {
              cache: true,
              parallel: true,
              maxConcurrency: 10
            },
            filters: {},
            prefixes: {
              citty: 'https://citty.pro/ontology#',
              app: 'https://app.local/ontology#'
            }
          };
          
          await writeFile(configPath, JSON.stringify(config, null, 2));
          
          // Create directory structure
          const dirs = ['./templates/command/new', './templates/workflow/new', './templates/task/new', './ontologies'];
          
          for (const dir of dirs) {
            await import('node:fs').then(fs => 
              fs.promises.mkdir(resolve(dir), { recursive: true })
            );
          }
          
          // Create example template
          const exampleTemplate = `---
to: src/commands/{{ name | kebabCase }}.ts
description: Command implementation
---
import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: '{{ name }}',
    description: '{{ description }}'
  },
  run() {
    console.log('Running {{ name }}');
  }
});`;
          
          await writeFile(
            resolve('./templates/command/new/index.ts.njk'),
            exampleTemplate
          );
          
          // Create example ontology
          const exampleOntology = `@prefix citty: <https://citty.pro/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:hello a citty:Command ;
  citty:name "hello" ;
  citty:description "Say hello to the world" ;
  rdfs:label "Hello Command" .`;
          
          await writeFile(
            resolve('./ontologies/example.ttl'),
            exampleOntology
          );
          
          spinner.succeed('Project initialized successfully!');
          
          console.log(chalk.green('\n✨ Unjucks is ready!\n'));
          console.log('  Next steps:');
          console.log(chalk.dim('  1. Edit templates in ./templates/'));
          console.log(chalk.dim('  2. Create ontologies in ./ontologies/'));
          console.log(chalk.dim('  3. Run: unjucks generate -s ontologies/example.ttl'));
          
        } catch (error: any) {
          spinner.fail('Initialization failed');
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }
    }),
    
    // Validate templates
    validate: defineCommand({
      meta: {
        description: 'Validate templates and ontologies'
      },
      args: {
        templates: {
          type: 'string',
          alias: 't',
          description: 'Templates directory to validate',
          default: './templates'
        },
        ontology: {
          type: 'string',
          alias: 'o',
          description: 'Ontology file to validate'
        }
      },
      async run({ args }) {
        const spinner = ora('Validating...').start();
        const issues: string[] = [];
        
        try {
          // Validate templates
          spinner.text = 'Validating templates...';
          const ctx = await createUnjucks({ templatesDir: args.templates });
          
          for (const [id, template] of ctx.templates) {
            // Check for required front matter
            if (!template.frontMatter.to && !template.frontMatter.output) {
              issues.push(`Template ${id}: Missing 'to' or 'output' in front matter`);
            }
            
            // Try to render with empty context
            try {
              await renderTemplate(template, {});
            } catch (error: any) {
              if (error.message.includes('undefined')) {
                // Expected for templates with required variables
              } else {
                issues.push(`Template ${id}: ${error.message}`);
              }
            }
          }
          
          // Validate ontology if provided
          if (args.ontology) {
            spinner.text = 'Validating ontology...';
            
            try {
              const { createOntology, loadGraph, findEntities } = await import('../untology');
              await createOntology();
              await loadGraph(resolve(args.ontology));
              const entities = findEntities();
              
              if (entities.length === 0) {
                issues.push('Ontology contains no entities');
              }
            } catch (error: any) {
              issues.push(`Ontology error: ${error.message}`);
            }
          }
          
          spinner.stop();
          
          if (issues.length === 0) {
            console.log(chalk.green('\n✅ All validations passed!'));
            console.log(chalk.dim(`  ${ctx.templates.size} templates validated`));
          } else {
            console.log(chalk.yellow(`\n⚠️ Found ${issues.length} issues:\n`));
            issues.forEach(issue => {
              console.log(chalk.yellow(`  • ${issue}`));
            });
            process.exit(1);
          }
          
        } catch (error: any) {
          spinner.fail('Validation failed');
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }
    })
  },
  
  async run({ args }) {
    // Interactive mode if no arguments
    if (!args.generator) {
      const spinner = ora('Loading generators...').start();
      
      try {
        await createUnjucks();
        const generators = listGenerators();
        
        spinner.stop();
        
        if (generators.length === 0) {
          console.log(chalk.yellow('\n⚠️ No templates found!'));
          console.log(chalk.dim('  Run "unjucks init" to create a new project'));
          return;
        }
        
        // Interactive prompts
        const responses = await prompts([
          {
            type: 'select',
            name: 'generator',
            message: 'Select a generator',
            choices: generators.map(g => ({ title: g, value: g }))
          },
          {
            type: 'text',
            name: 'action',
            message: 'Action',
            initial: 'new'
          },
          {
            type: 'text',
            name: 'name',
            message: 'Name',
            validate: (v: string) => v.length > 0 || 'Name is required'
          },
          {
            type: 'text',
            name: 'description',
            message: 'Description'
          }
        ]);
        
        if (!responses.generator) {
          console.log(chalk.yellow('Cancelled'));
          return;
        }
        
        // Generate
        const template = resolveTemplate(responses.generator, responses.action);
        if (!template) {
          console.log(chalk.red(`Template ${responses.generator}:${responses.action} not found`));
          process.exit(1);
        }
        
        const rendered = await renderTemplate(template, responses);
        
        console.log(chalk.green(`\n✅ Generated ${rendered.length} file(s):`));
        rendered.forEach(file => {
          console.log(chalk.dim(`  • ${file.path}`));
        });
        
      } catch (error: any) {
        spinner.fail('Failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    } else {
      // Direct generation
      try {
        await createUnjucks();
        
        const template = resolveTemplate(args.generator, args.action);
        if (!template) {
          console.log(chalk.red(`Template ${args.generator}:${args.action} not found`));
          console.log(chalk.dim('Run "unjucks list" to see available templates'));
          process.exit(1);
        }
        
        // Get context from stdin if piped
        let context = {};
        if (!process.stdin.isTTY) {
          const stdin = await readFile(0, 'utf-8');
          context = JSON.parse(stdin);
        }
        
        const rendered = await renderTemplate(template, context);
        
        console.log(chalk.green(`✅ Generated ${rendered.length} file(s)`));
        
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    }
  }
});

// Run CLI
runMain(main);