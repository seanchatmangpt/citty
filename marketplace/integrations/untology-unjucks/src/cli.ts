#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { PipelineCoordinator } from './pipeline/coordinator.js';
import { WatchService } from './services/watch-service.js';
import { ValidationService } from './services/validation-service.js';
import { ConfigManager } from './config/config-manager.js';
import { PipelineConfig } from './types.js';

const program = new Command();
const coordinator = new PipelineCoordinator();
const watchService = new WatchService();
const validator = new ValidationService();
const configManager = new ConfigManager();

program
  .name('unjucks')
  .description('Integrated Ontology → Template Pipeline with HIVE QUEEN Orchestration')
  .version('1.0.0');

// Sync command - Auto-generate all artifacts from ontology
program
  .command('sync')
  .description('Auto-generate all artifacts from ontology')
  .option('-c, --config <path>', 'Configuration file path', './unjucks.config.yaml')
  .option('-w, --workers <number>', 'Number of parallel workers', '4')
  .option('--dry-run', 'Show what would be generated without creating files')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();
    
    try {
      const config = await configManager.loadConfig(options.config);
      
      if (options.workers) {
        config.hiveQueen = config.hiveQueen || { enabled: true };
        config.hiveQueen.workers = parseInt(options.workers, 10);
      }
      
      spinner.text = 'Starting pipeline execution...';
      
      // Set up job monitoring
      coordinator.on('job:started', (job) => {
        spinner.text = `Processing job: ${job.id}`;
      });
      
      coordinator.on('phase:started', (phase) => {
        spinner.text = `Phase: ${phase}`;
      });
      
      coordinator.on('template:rendered', (event) => {
        spinner.text = `Rendered: ${event.template}`;
      });
      
      const job = await coordinator.executeJob(config);
      
      spinner.succeed(chalk.green('Pipeline completed successfully!'));
      
      console.log(chalk.blue('\nSummary:'));
      console.log(`  • Ontologies processed: ${job.metrics.ontologiesProcessed}`);
      console.log(`  • Templates rendered: ${job.metrics.templatesRendered}`);
      console.log(`  • Files generated: ${job.metrics.filesGenerated}`);
      
      if (job.metrics.errors.length > 0) {
        console.log(chalk.yellow(`  • Warnings: ${job.metrics.errors.length}`));
        job.metrics.errors.forEach(error => {
          console.log(chalk.yellow(`    - ${error}`));
        });
      }
      
    } catch (error) {
      spinner.fail(chalk.red('Pipeline failed'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Watch command - Real-time regeneration on ontology changes
program
  .command('watch')
  .description('Watch for ontology changes and regenerate automatically')
  .option('-c, --config <path>', 'Configuration file path', './unjucks.config.yaml')
  .option('-d, --debounce <ms>', 'Debounce delay in milliseconds', '500')
  .action(async (options) => {
    const spinner = ora('Starting watch service...').start();
    
    try {
      const config = await configManager.loadConfig(options.config);
      
      // Enable watching in config
      config.watch = config.watch || { enabled: true };
      config.watch.debounce = parseInt(options.debounce, 10);
      
      spinner.succeed('Watch service started');
      console.log(chalk.blue('Watching for changes... Press Ctrl+C to stop'));
      
      // Set up file watching
      watchService.on('change', async (filePath) => {
        console.log(chalk.yellow(`\nDetected change: ${filePath}`));
        const regenerateSpinner = ora('Regenerating...').start();
        
        try {
          const job = await coordinator.executeJob(config);
          regenerateSpinner.succeed('Regeneration completed');
          
          console.log(chalk.green(`Generated ${job.metrics.filesGenerated} files`));
        } catch (error) {
          regenerateSpinner.fail('Regeneration failed');
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
      });
      
      await watchService.watch(config);
      
    } catch (error) {
      spinner.fail('Failed to start watch service');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Validate command - Check ontology-template consistency
program
  .command('validate')
  .description('Validate ontology-template consistency')
  .option('-c, --config <path>', 'Configuration file path', './unjucks.config.yaml')
  .option('--strict', 'Strict validation mode')
  .action(async (options) => {
    const spinner = ora('Running validation...').start();
    
    try {
      const config = await configManager.loadConfig(options.config);
      
      const results = await validator.validate(config, {
        strict: options.strict || false,
      });
      
      if (results.isValid) {
        spinner.succeed(chalk.green('Validation passed'));
      } else {
        spinner.fail(chalk.red('Validation failed'));
        
        console.log(chalk.red('\nValidation Errors:'));
        results.errors.forEach(error => {
          console.log(chalk.red(`  • ${error.message}`));
          if (error.context) {
            console.log(chalk.gray(`    Context: ${JSON.stringify(error.context)}`));
          }
        });
        
        if (results.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          results.warnings.forEach(warning => {
            console.log(chalk.yellow(`  • ${warning.message}`));
          });
        }
        
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('Validation error');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Generate command - Selective generation with filters
program
  .command('generate')
  .description('Generate specific templates with filters')
  .option('-c, --config <path>', 'Configuration file path', './unjucks.config.yaml')
  .option('-t, --template <pattern>', 'Template pattern to match')
  .option('-o, --ontology <pattern>', 'Ontology pattern to match')
  .option('--include <patterns...>', 'Include patterns')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .action(async (options) => {
    const spinner = ora('Generating templates...').start();
    
    try {
      const config = await configManager.loadConfig(options.config);
      
      // Apply filters
      if (options.template) {
        config.templates = config.templates.filter(t =>
          t.path.includes(options.template)
        );
      }
      
      if (options.ontology) {
        config.ontologies = config.ontologies.filter(o =>
          o.path.includes(options.ontology)
        );
      }
      
      if (options.include) {
        // Apply include filters
        const includePatterns = options.include;
        config.templates = config.templates.filter(t =>
          includePatterns.some(pattern => t.path.includes(pattern))
        );
      }
      
      if (options.exclude) {
        // Apply exclude filters
        const excludePatterns = options.exclude;
        config.templates = config.templates.filter(t =>
          !excludePatterns.some(pattern => t.path.includes(pattern))
        );
      }
      
      const job = await coordinator.executeJob(config);
      
      spinner.succeed(chalk.green('Generation completed'));
      console.log(chalk.blue(`Generated ${job.metrics.filesGenerated} files`));
      
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize unjucks configuration')
  .option('-i, --interactive', 'Interactive setup')
  .action(async (options) => {
    const spinner = ora('Initializing configuration...').start();
    spinner.stop();
    
    let config: Partial<PipelineConfig>;
    
    if (options.interactive) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          default: 'my-ontology-project',
        },
        {
          type: 'input',
          name: 'ontologyPath',
          message: 'Ontology file path:',
          default: './ontology.ttl',
        },
        {
          type: 'list',
          name: 'format',
          message: 'Ontology format:',
          choices: ['turtle', 'n3', 'rdf-xml', 'json-ld'],
          default: 'turtle',
        },
        {
          type: 'input',
          name: 'templatesDir',
          message: 'Templates directory:',
          default: './templates',
        },
        {
          type: 'input',
          name: 'outputDir',
          message: 'Output directory:',
          default: './generated',
        },
        {
          type: 'confirm',
          name: 'hiveQueen',
          message: 'Enable HIVE QUEEN orchestration?',
          default: true,
        },
        {
          type: 'number',
          name: 'workers',
          message: 'Number of parallel workers:',
          default: 4,
          when: (answers) => answers.hiveQueen,
        },
        {
          type: 'confirm',
          name: 'watch',
          message: 'Enable file watching?',
          default: true,
        },
      ]);
      
      config = {
        name: answers.name,
        ontologies: [{
          path: answers.ontologyPath,
          format: answers.format,
        }],
        templates: [], // Will be discovered
        output: {
          directory: answers.outputDir,
          clean: true,
        },
        hiveQueen: answers.hiveQueen ? {
          enabled: true,
          workers: answers.workers,
          parallelism: 'templates',
        } : { enabled: false },
        watch: answers.watch ? {
          enabled: true,
          debounce: 500,
        } : { enabled: false },
      };
    } else {
      // Default configuration
      config = {
        name: 'ontology-project',
        ontologies: [{
          path: './ontology.ttl',
          format: 'turtle',
        }],
        templates: [{
          path: './templates/**/*.njk',
          output: '{{ template | replace(".njk", "") }}',
        }],
        output: {
          directory: './generated',
          clean: true,
        },
        hiveQueen: {
          enabled: true,
          workers: 4,
          parallelism: 'templates',
        },
        watch: {
          enabled: true,
          debounce: 500,
        },
      };
    }
    
    const configPath = './unjucks.config.yaml';
    await configManager.saveConfig(configPath, config as PipelineConfig);
    
    console.log(chalk.green(`Configuration saved to ${configPath}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log('  1. Place your ontology file at the specified path');
    console.log('  2. Create template files in the templates directory');
    console.log('  3. Run: unjucks sync');
  });

// Status command - Show pipeline status
program
  .command('status')
  .description('Show pipeline and job status')
  .option('-j, --job <id>', 'Show specific job status')
  .action(async (options) => {
    if (options.job) {
      const job = await coordinator.getJobStatus(options.job);
      if (!job) {
        console.log(chalk.red(`Job not found: ${options.job}`));
        return;
      }
      
      console.log(chalk.blue(`Job: ${job.id}`));
      console.log(`Status: ${job.status}`);
      console.log(`Config: ${job.config.name}`);
      
      if (job.startTime) {
        console.log(`Started: ${job.startTime.toISOString()}`);
      }
      if (job.endTime) {
        console.log(`Ended: ${job.endTime.toISOString()}`);
        console.log(`Duration: ${job.endTime.getTime() - job.startTime!.getTime()}ms`);
      }
      
      console.log('\nMetrics:');
      console.log(`  Ontologies: ${job.metrics.ontologiesProcessed}`);
      console.log(`  Templates: ${job.metrics.templatesRendered}`);
      console.log(`  Files: ${job.metrics.filesGenerated}`);
      
      if (job.metrics.errors.length > 0) {
        console.log('\nErrors:');
        job.metrics.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
      }
    } else {
      console.log(chalk.blue('Unjucks Pipeline Status'));
      console.log('No active jobs'); // TODO: Implement job listing
    }
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.blue('Run "unjucks --help" for available commands'));
  process.exit(1);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught error:', error.message));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled rejection:', reason));
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nShutting down gracefully...'));
  await coordinator.cleanup();
  await watchService.stop();
  process.exit(0);
});

program.parse();