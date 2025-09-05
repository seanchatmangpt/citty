// Template configuration for citty-pro Nunjucks templates
const filters = require('./_filters');

module.exports = {
  // Template engine configuration
  engine: 'nunjucks',
  
  // Global template variables
  globals: {
    currentDate: () => new Date().toISOString(),
    currentYear: () => new Date().getFullYear(),
    timestamp: () => Date.now(),
    uuid: () => require('crypto').randomUUID(),
  },

  // Custom filters
  filters,

  // Template directories
  templateDirs: [
    'templates/command/new',
    'templates/workflow/new', 
    'templates/task/new',
    'templates/docs'
  ],

  // Output configuration
  output: {
    // Preserve file extensions from front matter
    preserveExtensions: true,
    
    // Create directories if they don't exist
    createDirs: true,
    
    // File naming conventions
    naming: {
      kebabCase: true,
      preserveCase: false
    }
  },

  // Template categories
  categories: {
    command: {
      description: 'CLI command templates',
      templates: ['index.ts.njk', 'test.spec.ts.njk', 'README.md.njk'],
      requiredVars: ['name', 'description', 'arguments']
    },
    
    workflow: {
      description: 'Workflow orchestration templates', 
      templates: ['workflow.ts.njk', 'tasks.ts.njk', 'config.yaml.njk'],
      requiredVars: ['name', 'description', 'tasks']
    },
    
    task: {
      description: 'Task implementation templates',
      templates: ['task.ts.njk', 'schema.ts.njk', 'types.ts.njk'],
      requiredVars: ['name', 'description', 'inputs', 'outputs']
    },
    
    docs: {
      description: 'Documentation generation templates',
      templates: ['api.md.njk', 'cli-help.txt.njk', 'changelog.md.njk'],
      requiredVars: ['module', 'description']
    }
  },

  // Validation schemas for template variables
  validation: {
    command: {
      name: { type: 'string', required: true, pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/ },
      description: { type: 'string', required: true, minLength: 10 },
      arguments: { type: 'array', required: true },
      category: { type: 'string', default: 'General' },
      version: { type: 'string', default: '1.0.0' }
    },
    
    workflow: {
      name: { type: 'string', required: true, pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/ },
      description: { type: 'string', required: true, minLength: 10 },
      tasks: { type: 'array', required: true, minLength: 1 },
      parallel: { type: 'boolean', default: false },
      version: { type: 'string', default: '1.0.0' }
    },
    
    task: {
      name: { type: 'string', required: true, pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/ },
      description: { type: 'string', required: true, minLength: 10 },
      inputs: { type: 'array', required: true },
      outputs: { type: 'array', required: true },
      category: { type: 'string', default: 'Tasks' },
      version: { type: 'string', default: '1.0.0' }
    },
    
    docs: {
      module: { type: 'string', required: true },
      description: { type: 'string', required: true, minLength: 10 },
      packageName: { type: 'string' },
      apiVersion: { type: 'string', default: '1.0.0' }
    }
  },

  // Default template variables
  defaults: {
    repoOwner: 'citty',
    repoName: 'citty-pro',
    repoUrl: 'https://github.com/citty/citty-pro',
    packageName: 'citty-pro',
    license: 'MIT',
    author: 'Citty Team',
    currentDate: new Date().toISOString().split('T')[0],
    generatedBy: 'citty-pro template generator'
  },

  // Template preprocessing
  preprocessing: {
    // Remove empty lines
    removeEmptyLines: false,
    
    // Trim whitespace
    trimWhitespace: true,
    
    // Convert line endings
    lineEndings: 'unix'
  },

  // Post-processing hooks
  postProcessing: {
    // Format TypeScript files
    typescript: {
      enabled: true,
      prettier: true,
      eslint: false
    },
    
    // Format YAML files  
    yaml: {
      enabled: true,
      indent: 2,
      quotingType: '"'
    },
    
    // Format Markdown files
    markdown: {
      enabled: true,
      prettier: true
    }
  },

  // Template inheritance
  inheritance: {
    // Base template for all commands
    commandBase: 'templates/command/_base.njk',
    
    // Base template for all workflows
    workflowBase: 'templates/workflow/_base.njk',
    
    // Base template for all tasks
    taskBase: 'templates/task/_base.njk'
  },

  // Context processors
  contextProcessors: [
    // Add ontology context
    (context) => {
      context.ontology = context.ontology || {};
      return context;
    },
    
    // Add helper methods
    (context) => {
      context.helpers = {
        formatDate: (date) => new Date(date).toISOString().split('T')[0],
        generateId: () => require('crypto').randomUUID().split('-')[0],
        slugify: (str) => filters.kebabCase(str)
      };
      return context;
    },
    
    // Process feature flags
    (context) => {
      context.hasVerboseLogging = context.arguments?.some(arg => arg.name === 'verbose') || context.hasFlags;
      context.hasErrorHandling = context.errorHandling !== false;
      context.hasDefaultTests = context.tests === undefined || context.hasDefaultTests !== false;
      return context;
    }
  ],

  // Template examples
  examples: {
    command: {
      name: 'build',
      description: 'Build the project with specified configuration',
      arguments: [
        {
          name: 'config',
          type: 'string',
          description: 'Configuration file path',
          required: true,
          example: './build.config.json'
        },
        {
          name: 'output',
          type: 'string', 
          description: 'Output directory',
          default: './dist',
          example: './build'
        }
      ],
      hasFlags: true,
      category: 'Build'
    },
    
    workflow: {
      name: 'deploy',
      description: 'Deploy application to specified environment',
      tasks: [
        {
          id: 'build',
          name: 'Build Application',
          description: 'Compile and bundle application'
        },
        {
          id: 'test', 
          name: 'Run Tests',
          description: 'Execute test suite',
          dependsOn: ['build']
        },
        {
          id: 'deploy',
          name: 'Deploy to Server',
          description: 'Upload and activate application',
          dependsOn: ['test']
        }
      ],
      parallel: false
    },
    
    task: {
      name: 'fileProcessor',
      description: 'Process files with specified transformations',
      inputs: [
        {
          name: 'filePath',
          type: 'string',
          description: 'Path to input file'
        },
        {
          name: 'transformations',
          type: 'array',
          description: 'List of transformations to apply'
        }
      ],
      outputs: [
        {
          name: 'processedFile',
          type: 'string', 
          description: 'Path to processed file'
        },
        {
          name: 'metadata',
          type: 'object',
          description: 'Processing metadata'
        }
      ]
    }
  }
};