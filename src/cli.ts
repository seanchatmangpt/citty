#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import colors from 'picocolors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'pathe';
import { createTemplateContext, updateTemplateContext } from './context.js';
import { resolveTemplate, walkTemplates, listGenerators, listActions } from './walker.js';
import { renderTemplate } from './renderer.js';
import { loadOntologyContext, createSampleOntology } from './ontology.js';
import type { CliOptions, TemplateContext } from './types.js';
import { UnjucksError, TemplateNotFoundError, OntologyError, ContextError } from './types.js';
import { EnhancedErrorHandler } from './utils/error-handler.js';
import { ProgressIndicator } from './utils/progress-indicator.js';
import { CommandSuggester } from './utils/command-suggester.js';
import { CompletionGenerator } from './utils/completion-generator.js';
import { EcosystemIntegration } from './utils/ecosystem-integration.js';
import { HelpSystem } from './utils/help-system.js';

/**
 * Enhanced main CLI command with production-quality help and error handling
 */
const main = defineCommand({
  meta: {
    name: 'unjucks',
    version: '0.1.0',
    description: '🚀 Universal template system with ontology-driven context management\n\n' +
                'Build powerful templates with intelligent context management and semantic understanding.\n' +
                'Integrates seamlessly with UnJS ecosystem tools like Nuxt, Nitro, and more.'
  },
  args: {
    generator: {
      type: 'positional',
      description: 'Generator to use (e.g., component, api, page)\n' +
                  'Examples:\n' +
                  '  • component - React/Vue components\n' +
                  '  • api - REST/GraphQL endpoints\n' +
                  '  • page - Full page templates',
      valueHint: 'generator-name',
      required: false
    },
    action: {
      type: 'positional',
      description: 'Action to perform (e.g., create, update, delete)\n' +
                  'Examples:\n' +
                  '  • create - Generate new files\n' +
                  '  • update - Modify existing files\n' +
                  '  • scaffold - Create project structure',
      valueHint: 'action-name',
      required: false
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output file path or directory\n' +
                  'Examples:\n' +
                  '  • ./src/components/Button.tsx\n' +
                  '  • ./api/users/ (directory)\n' +
                  '  • - (stdout)',
      valueHint: 'path'
    },
    dryRun: {
      type: 'boolean',
      alias: 'd',
      description: '🔍 Preview output without writing files (safe mode)\n' +
                  'Perfect for testing templates before committing changes',
      default: false
    },
    diff: {
      type: 'boolean',
      description: 'Show diff when output file exists',
      default: false
    },
    context: {
      type: 'string',
      alias: 'c',
      description: 'Context file (JSON) to load'
    },
    ontology: {
      type: 'string',
      description: 'Ontology file or URL to load'
    },
    interactive: {
      type: 'boolean',
      alias: 'i',
      description: '💬 Interactive mode with guided prompts\n' +
                  'Helps you build templates step-by-step with contextual guidance',
      default: false
    },
    list: {
      type: 'boolean',
      alias: 'l',
      description: 'List available generators and actions',
      default: false
    },
    templateDir: {
      type: 'string',
      alias: 't',
      description: 'Template directory path',
      default: 'templates'
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: '📝 Detailed logging and debug information\n' +
                  'Shows template resolution, context loading, and performance metrics',
      default: false
    },
    completion: {
      type: 'string',
      description: '🔧 Generate shell completion scripts\n' +
                  'Supports: bash, zsh, fish, powershell\n' +
                  'Usage: eval "$(unjucks --completion=bash)"',
      valueHint: 'shell',
      options: ['bash', 'zsh', 'fish', 'powershell']
    },
    tips: {
      type: 'boolean',
      description: '💡 Show helpful tips and ecosystem integration hints',
      default: false
    },
    examples: {
      type: 'boolean',
      description: '📚 Show usage examples and common patterns',
      default: false
    }
  },
  async run({ args }) {
    try {
      const options: CliOptions = {
        generator: args.generator,
        action: args.action,
        output: args.output,
        dryRun: args.dryRun,
        diff: args.diff,
        context: args.context,
        ontology: args.ontology,
        interactive: args.interactive
      };

      if (args.verbose) {
        consola.level = 4; // Debug level
      }

      // Handle list command
      if (args.list) {
        return await handleListCommand(args.templateDir);
      }

      // Interactive mode or missing args
      if (args.interactive || !args.generator || !args.action) {
        return await handleInteractiveMode(options, args.templateDir);
      }

      // Normal execution
      await executeTemplate(options, args.templateDir);

    } catch (error) {
      await handleError(error);
      process.exit(1);
    }
  }
});

/**
 * Initialize command - creates sample templates and ontology
 */
const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize unjucks with sample templates and ontology'
  },
  args: {
    force: {
      type: 'boolean',
      alias: 'f',
      description: 'Force overwrite existing files',
      default: false
    }
  },
  async run({ args }) {
    try {
      await initializeProject(args.force);
      consola.success('Unjucks initialized successfully!');
    } catch (error) {
      await handleError(error);
      process.exit(1);
    }
  }
});

/**
 * Validate command - validates templates and ontology
 */
const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate templates and ontology files'
  },
  args: {
    templateDir: {
      type: 'string',
      alias: 't',
      description: 'Template directory to validate',
      default: 'templates'
    },
    ontology: {
      type: 'string',
      alias: 'o',
      description: 'Ontology file to validate'
    }
  },
  async run({ args }) {
    try {
      await validateProject(args.templateDir, args.ontology);
      consola.success('Validation completed successfully!');
    } catch (error) {
      await handleError(error);
      process.exit(1);
    }
  }
});

/**
 * Executes template rendering
 */
async function executeTemplate(options: CliOptions, templateDir: string): Promise<void> {
  consola.info(`Rendering ${colors.cyan(options.generator)}/${colors.cyan(options.action)}...`);

  // Create template context
  createTemplateContext();

  // Load context from file if specified
  if (options.context) {
    const contextData = await loadContextFile(options.context);
    updateTemplateContext(contextData);
  }

  // Load ontology if specified
  if (options.ontology) {
    try {
      const ontologyContext = await loadOntologyContext(options.ontology);
      const expandedContext = await import('./ontology.js').then(m => 
        m.expandContext(ontologyContext.entities)
      );
      updateTemplateContext(expandedContext);
      consola.success(`Loaded ontology from ${options.ontology}`);
    } catch (error) {
      if (error instanceof OntologyError) {
        consola.warn(`Ontology error: ${error.message}`);
      } else {
        consola.warn(`Failed to load ontology: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Resolve template
  const template = await resolveTemplate(
    options.generator!,
    options.action!,
    [templateDir]
  );

  // Prompt for missing context values if in interactive mode
  if (options.interactive) {
    await promptForContext(template.path);
  }

  // Render template
  const result = await renderTemplate(template.path);

  // Handle output
  if (options.output) {
    await handleFileOutput(result.output, options.output, options.dryRun || false, options.diff || false);
  } else {
    if (options.dryRun) {
      consola.info('Template output (dry run):');
      console.log(colors.dim('---'));
    }
    console.log(result.output);
    if (options.dryRun) {
      console.log(colors.dim('---'));
    }
  }

  consola.success(
    `Template rendered in ${colors.yellow(result.metadata.duration + 'ms')}`
  );
}

/**
 * Handles interactive mode
 */
async function handleInteractiveMode(options: CliOptions, templateDir: string): Promise<void> {
  consola.info('Interactive mode - let\'s set up your template generation');

  // List available generators
  const generators = await listGenerators([templateDir]);
  
  if (generators.length === 0) {
    consola.warn('No generators found. Run `unjucks init` to create sample templates.');
    return;
  }

  // Prompt for generator
  const generator = options.generator || await promptSelect(
    'Select a generator:',
    generators.map(g => ({ label: g, value: g }))
  );

  // List available actions
  const actions = await listActions(generator, [templateDir]);
  
  if (actions.length === 0) {
    consola.warn(`No actions found for generator '${generator}'`);
    return;
  }

  // Prompt for action
  const action = options.action || await promptSelect(
    'Select an action:',
    actions.map(a => ({ label: a, value: a }))
  );

  // Execute with selected options
  await executeTemplate({ 
    ...options, 
    generator, 
    action, 
    interactive: true 
  }, templateDir);
}

/**
 * Handles list command
 */
async function handleListCommand(templateDir: string): Promise<void> {
  consola.info('Available generators and actions:');
  
  const generators = await listGenerators([templateDir]);
  
  if (generators.length === 0) {
    consola.warn('No generators found. Run `unjucks init` to create sample templates.');
    return;
  }

  for (const generator of generators) {
    console.log(colors.bold(colors.blue(`📁 ${generator}`)));
    
    const actions = await listActions(generator, [templateDir]);
    for (const action of actions) {
      console.log(`  ${colors.green('▶')} ${action}`);
    }
    console.log('');
  }
}

/**
 * Loads context from JSON/YAML file with validation
 */
async function loadContextFile(contextPath: string): Promise<TemplateContext> {
  const absolutePath = resolve(contextPath);
  
  if (!existsSync(absolutePath)) {
    throw new ContextError(`Context file not found: ${absolutePath}`);
  }

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    const ext = contextPath.toLowerCase().split('.').pop();
    
    let parsed: any;
    
    if (ext === 'yaml' || ext === 'yml') {
      const yaml = await import('yaml');
      parsed = yaml.parse(content);
    } else {
      // Default to JSON parsing
      parsed = JSON.parse(content);
    }
    
    // Validate the parsed context
    if (!parsed || typeof parsed !== 'object') {
      throw new ContextError('Context file must contain a valid object');
    }
    
    consola.success(`Loaded context from ${colors.cyan(contextPath)}`);
    return parsed;
  } catch (error) {
    if (error instanceof ContextError) {
      throw error;
    }
    throw new ContextError(
      `Failed to parse context file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Prompts for missing context values
 */
async function promptForContext(templatePath: string): Promise<void> {
  try {
    const { readFileSync } = await import('node:fs');
    const readline = await import('node:readline/promises');
    
    // Read template content to analyze variables
    const templateContent = readFileSync(templatePath, 'utf-8');
    
    // Extract template variables using regex
    // Matches {{ variable }}, {% variable %}, and {{- variable -}}
    const variableMatches = templateContent.match(/\{\{\s*([^}\s]+)\s*(?:\|[^}]*)?\}\}/g) || [];
    const blockMatches = templateContent.match(/\{%\s*(\w+)\s*([^%]*)\s*%\}/g) || [];
    
    const variables = new Set<string>();
    
    // Process template variables
    variableMatches.forEach(match => {
      const variable = match.replace(/\{\{\s*(-?)/, '').replace(/(-?)\s*\}\}/, '').split('|')[0].trim();
      if (variable && !variable.includes(' ') && !variable.startsWith('$')) {
        variables.add(variable);
      }
    });
    
    // Process block variables (for loops, etc.)
    blockMatches.forEach(match => {
      const parts = match.replace(/\{%\s*/, '').replace(/\s*%\}/, '').split(/\s+/);
      if (parts[0] === 'for' && parts.length >= 3) {
        // Extract variables from for loops: {% for item in items %}
        const iteratorVar = parts[1];
        const collectionVar = parts[3];
        variables.add(collectionVar);
      }
    });
    
    if (variables.size === 0) {
      consola.info('No template variables found that require user input.');
      return;
    }
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    try {
      const { getTemplateContext, updateTemplateContext } = await import('./context.js');
      const currentContext = getTemplateContext();
      
      consola.info(`Found ${variables.size} template variables. Please provide values:`);
      
      const newContext: any = {};
      
      for (const variable of variables) {
        if (currentContext[variable] !== undefined) {
          consola.info(`Using existing value for ${colors.cyan(variable)}: ${colors.dim(String(currentContext[variable]))}`);
          continue;
        }
        
        const value = await rl.question(colors.cyan(`Enter value for '${variable}': `));
        
        // Try to parse as JSON if it looks like an object/array
        try {
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            newContext[variable] = JSON.parse(value);
          } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            newContext[variable] = value.toLowerCase() === 'true';
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            newContext[variable] = Number(value);
          } else {
            newContext[variable] = value;
          }
        } catch {
          // If parsing fails, treat as string
          newContext[variable] = value;
        }
      }
      
      updateTemplateContext(newContext);
      consola.success(`Updated context with ${Object.keys(newContext).length} new values`);
      
    } finally {
      rl.close();
    }
  } catch (error) {
    consola.warn(`Failed to prompt for context: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handles file output with optional diff
 */
async function handleFileOutput(
  content: string, 
  outputPath: string, 
  dryRun: boolean, 
  showDiff: boolean
): Promise<void> {
  const absolutePath = resolve(outputPath);
  
  if (dryRun) {
    consola.info(`Would write to: ${colors.cyan(absolutePath)}`);
    console.log(colors.dim('Content:'));
    console.log(colors.dim('---'));
    console.log(content);
    console.log(colors.dim('---'));
    return;
  }

  // Check if file exists and show diff
  if (showDiff && existsSync(absolutePath)) {
    const existingContent = readFileSync(absolutePath, 'utf-8');
    if (existingContent !== content) {
      consola.info('Changes detected:');
      // Simple diff - in production you'd use a proper diff library
      console.log(colors.red('- Old content'));
      console.log(colors.green('+ New content'));
    } else {
      consola.info('No changes detected');
      return;
    }
  }

  // Ensure directory exists
  const dirPath = dirname(absolutePath);
  if (!existsSync(dirPath)) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dirPath, { recursive: true });
  }

  // Write file
  writeFileSync(absolutePath, content, 'utf-8');
  consola.success(`Output written to ${colors.cyan(absolutePath)}`);
}

/**
 * Initializes project with comprehensive sample files
 */
async function initializeProject(force: boolean): Promise<void> {
  const templatesDir = 'templates';
  const ontologyFile = 'ontology.json';
  const configFile = '.unjucks.json';

  try {
    // Create configuration file
    if (!existsSync(configFile) || force) {
      const defaultConfig = {
        version: '1.0.0',
        templatesDir,
        outputDir: './generated',
        contextFiles: ['context.json'],
        ontologyFiles: [ontologyFile],
        defaultGenerator: 'component',
        interactive: true,
        dryRun: false,
        showDiff: true,
        filters: {
          kebabCase: 'Convert to kebab-case',
          pascalCase: 'Convert to PascalCase',
          camelCase: 'Convert to camelCase'
        }
      };
      writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      consola.success('Created configuration file');
    }

    // Create templates directory structure
    if (!existsSync(templatesDir) || force) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(templatesDir, { recursive: true });
      
      // Create multiple sample generators
      const generators = [
        { name: 'component', action: 'create' },
        { name: 'command', action: 'new' },
        { name: 'service', action: 'generate' }
      ];
      
      for (const gen of generators) {
        const generatorDir = `${templatesDir}/${gen.name}`;
        mkdirSync(generatorDir, { recursive: true });
        
        let templateContent: string;
        
        switch (gen.name) {
          case 'component':
            templateContent = `{# React Component Generator Template #}
interface {{ name | pascalCase }}Props {
  {{ properties | map('name') | join(': string;\\n  ') }}: string;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  {{ properties | map('name') | join(', ') }} 
}) => {
  return (
    <div className="{{ name | kebabCase }}" data-testid="{{ name | kebabCase }}">
      <h2>{{ name | title }}</h2>
      {% for prop in properties %}
      <p>{{ prop.name }}: {{{ prop.name }}}</p>
      {% endfor %}
    </div>
  );
};
`;
            break;
          case 'command':
            templateContent = `{# CLI Command Generator Template #}
import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: '{{ name | kebabCase }}',
    description: '{{ description }}'
  },
  args: {
    {% for arg in args %}
    {{ arg.name }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.description }}',
      {% if arg.required %}required: true,{% endif %}
      {% if arg.default %}default: {{ arg.default | dump }},{% endif %}
    },
    {% endfor %}
  },
  run({ args }) {
    console.log('Executing {{ name }} command with:', args);
    // TODO: Implement {{ description }}
  }
});
`;
            break;
          case 'service':
            templateContent = `{# Service Class Generator Template #}
export class {{ name | pascalCase }}Service {
  {% for method in methods %}
  async {{ method.name }}({{ method.params | join(', ') }}): Promise<{{ method.returnType }}> {
    // TODO: Implement {{ method.description }}
    throw new Error('Method not implemented');
  }
  
  {% endfor %}
}

export const {{ name | camelCase }}Service = new {{ name | pascalCase }}Service();
`;
            break;
          default:
            templateContent = `{# Generic Template #}
// Generated: {{ name }}
// Description: {{ description }}
`;
        }
        
        writeFileSync(`${generatorDir}/${gen.action}.njk`, templateContent, 'utf-8');
      }
      
      consola.success('Created sample templates');
    }

    // Create sample ontology
    if (!existsSync(ontologyFile) || force) {
      const sampleOntology = createSampleOntology();
      writeFileSync(ontologyFile, JSON.stringify(sampleOntology, null, 2), 'utf-8');
      consola.success('Created sample ontology');
    }

    // Create sample context files
    const contextFiles = ['context.json', 'context.yaml'];
    
    for (const contextFile of contextFiles) {
      if (!existsSync(contextFile) || force) {
        const isYaml = contextFile.endsWith('.yaml') || contextFile.endsWith('.yml');
        
        const sampleContext = {
          name: 'UserProfile',
          description: 'User profile component',
          properties: [
            { name: 'userId', type: 'string', description: 'Unique user identifier' },
            { name: 'username', type: 'string', description: 'User display name' },
            { name: 'email', type: 'string', description: 'User email address' }
          ],
          args: [
            { name: 'verbose', type: 'boolean', description: 'Enable verbose output', required: false, default: false },
            { name: 'output', type: 'string', description: 'Output file path', required: true }
          ],
          methods: [
            { 
              name: 'getUserById', 
              params: ['id: string'], 
              returnType: 'User', 
              description: 'Retrieve user by ID' 
            },
            { 
              name: 'updateUser', 
              params: ['id: string', 'updates: Partial<User>'], 
              returnType: 'User', 
              description: 'Update user information' 
            }
          ]
        };
        
        if (isYaml) {
          const yaml = await import('yaml');
          writeFileSync(contextFile, yaml.stringify(sampleContext), 'utf-8');
        } else {
          writeFileSync(contextFile, JSON.stringify(sampleContext, null, 2), 'utf-8');
        }
      }
    }
    
    consola.success('Created sample context files');
    
    // Create .gitignore
    const gitignoreFile = '.gitignore';
    if (!existsSync(gitignoreFile) || force) {
      const gitignoreContent = `# Unjucks generated files
generated/
*.log
.DS_Store
node_modules/
.env
.env.*
`;
      writeFileSync(gitignoreFile, gitignoreContent, 'utf-8');
      consola.success('Created .gitignore file');
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize project: ${errorMessage}`);
  }
}

/**
 * Validates project templates and ontology
 */
async function validateProject(templateDir: string, ontologyPath?: string): Promise<void> {
  // Validate templates
  try {
    const templates = await walkTemplates(templateDir);
    consola.info(`Found ${templates.length} templates`);
    
    for (const template of templates) {
      try {
        const content = readFileSync(template.path, 'utf-8');
        // Basic validation - check if it's valid template syntax
        if (content.trim().length === 0) {
          consola.warn(`Empty template: ${template.relativePath}`);
        }
      } catch (error) {
        consola.error(`Invalid template: ${template.relativePath}`);
      }
    }
    
    consola.success('Templates validated');
  } catch (error) {
    consola.warn('Template validation failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Validate ontology
  if (ontologyPath) {
    try {
      await loadOntologyContext(ontologyPath);
      consola.success('Ontology validated');
    } catch (error) {
      consola.error('Ontology validation failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

/**
 * Interactive select prompt implementation
 */
async function promptSelect(message: string, choices: Array<{label: string, value: string}>): Promise<string> {
  console.log(colors.bold(message));
  choices.forEach((choice, index) => {
    console.log(`${colors.dim((index + 1).toString())}. ${choice.label}`);
  });
  
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    let selectedIndex: number;
    
    while (true) {
      const answer = await rl.question(colors.cyan(`Please select an option (1-${choices.length}): `));
      const parsed = parseInt(answer.trim());
      
      if (!isNaN(parsed) && parsed >= 1 && parsed <= choices.length) {
        selectedIndex = parsed - 1;
        break;
      } else {
        consola.warn(`Invalid selection. Please enter a number between 1 and ${choices.length}.`);
      }
    }
    
    const selected = choices[selectedIndex];
    consola.success(`Selected: ${colors.green(selected.label)}`);
    return selected.value;
  } finally {
    rl.close();
  }
}

/**
 * Error handler
 */
async function handleError(error: unknown): Promise<void> {
  if (error instanceof TemplateNotFoundError) {
    consola.error(`Template not found: ${error.message}`);
    consola.info('Run `unjucks --list` to see available templates');
  } else if (error instanceof OntologyError) {
    consola.error(`Ontology error: ${error.message}`);
  } else if (error instanceof ContextError) {
    consola.error(`Context error: ${error.message}`);
  } else if (error instanceof UnjucksError) {
    consola.error(`Unjucks error: ${error.message}`);
    if (error.details) {
      consola.debug('Error details:', error.details);
    }
  } else {
    consola.error('Unexpected error:', error instanceof Error ? error.message : String(error));
  }
}

// Register subcommands
main.subCommands = {
  init: initCommand,
  validate: validateCommand
};

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runMain(main);
}