# Citty Pro Templates

Production-ready Nunjucks templates for generating citty-pro commands, workflows, tasks, and documentation.

## Template Categories

### 📋 Command Templates (`templates/command/new/`)
- **index.ts.njk** - Command implementation with TypeScript
- **test.spec.ts.njk** - Comprehensive test suite with Vitest  
- **README.md.njk** - Command documentation

### 🔄 Workflow Templates (`templates/workflow/new/`)
- **workflow.ts.njk** - Workflow orchestration logic
- **tasks.ts.njk** - Associated task definitions
- **config.yaml.njk** - YAML configuration

### ⚙️ Task Templates (`templates/task/new/`)
- **task.ts.njk** - Task implementation class
- **schema.ts.njk** - Zod validation schemas
- **types.ts.njk** - TypeScript type definitions

### 📚 Documentation Templates (`templates/docs/`)
- **api.md.njk** - API documentation generation
- **cli-help.txt.njk** - CLI help text generation
- **changelog.md.njk** - Changelog generation

## Features

- **Front-matter routing** for automatic file placement
- **TypeScript-first** with comprehensive type safety
- **Zod validation** for input/output schemas
- **Error handling** patterns built-in
- **JSDoc documentation** generation
- **Ontology context** integration
- **Production patterns** and best practices

## Usage

### Generate a Command

```javascript
const context = {
  name: 'build',
  description: 'Build the project with specified configuration',
  arguments: [
    {
      name: 'config',
      type: 'string',
      description: 'Configuration file path',
      required: true,
      example: './build.config.json'
    }
  ],
  hasFlags: true,
  category: 'Build'
};

// Generates:
// - src/commands/build.ts
// - test/commands/build.test.ts  
// - docs/commands/build.md
```

### Generate a Workflow

```javascript
const context = {
  name: 'deploy',
  description: 'Deploy application to specified environment',
  tasks: [
    {
      id: 'build',
      name: 'Build Application', 
      description: 'Compile and bundle application'
    },
    {
      id: 'deploy',
      name: 'Deploy to Server',
      description: 'Upload and activate application',
      dependsOn: ['build']
    }
  ],
  parallel: false
};

// Generates:
// - src/workflows/deploy.ts
// - src/workflows/tasks/deploy-tasks.ts
// - config/workflows/deploy.yaml
```

### Generate a Task

```javascript
const context = {
  name: 'fileProcessor',
  description: 'Process files with specified transformations',
  inputs: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to input file'
    }
  ],
  outputs: [
    {
      name: 'processedFile', 
      type: 'string',
      description: 'Path to processed file'
    }
  ]
};

// Generates:
// - src/tasks/file-processor.ts
// - src/tasks/schemas/file-processor-schema.ts
// - src/tasks/types/file-processor-types.ts
```

## Template Variables

### Command Template Variables
- `name` - Command name (kebab-case)
- `description` - Command description
- `arguments` - Array of command arguments
- `hasFlags` - Whether to include common flags
- `category` - Command category
- `version` - Command version
- `ontology` - Ontology context for imports/configuration

### Workflow Template Variables  
- `name` - Workflow name
- `description` - Workflow description
- `tasks` - Array of task definitions
- `parallel` - Execute tasks in parallel
- `configuration` - Workflow configuration schema
- `hooks` - Pre/post execution hooks
- `metrics` - Performance metrics to collect

### Task Template Variables
- `name` - Task name
- `description` - Task description  
- `inputs` - Input schema definition
- `outputs` - Output schema definition
- `category` - Task category
- `timeout` - Execution timeout
- `retries` - Retry attempts
- `implementation` - Custom implementation code

### Documentation Template Variables
- `module` - Module name
- `description` - Module description
- `classes` - API classes to document
- `functions` - API functions to document
- `interfaces` - TypeScript interfaces
- `examples` - Code examples

## Custom Filters

The templates include custom Nunjucks filters:

- `kebabCase` - Convert to kebab-case
- `camelCase` - Convert to camelCase  
- `pascalCase` - Convert to PascalCase
- `titleCase` - Convert to Title Case
- `stringify` - JSON stringify
- `yamlValue` - YAML-safe value formatting
- `join` - Array joining with separator
- `pluck` - Extract property from objects array
- `backticks` - Wrap in backticks
- `indent` - Indent text by spaces
- `safe` - Mark content as HTML-safe

## Configuration

Templates are configured via `templates/config.js`:

```javascript
module.exports = {
  engine: 'nunjucks',
  globals: { /* global variables */ },
  filters: { /* custom filters */ },
  categories: { /* template categories */ },
  validation: { /* variable validation */ },
  defaults: { /* default values */ }
};
```

## Advanced Features

### Ontology Integration
Templates support ontology context for:
- Custom imports
- Configuration injection  
- Context-aware generation
- Semantic relationships

### Error Handling Patterns
- Zod validation with detailed errors
- Try-catch blocks with logging
- Exit code management
- Stack trace handling

### Testing Integration
- Vitest test generation
- Mock setup/teardown
- Argument validation tests
- Integration test scaffolding
- Performance test templates

### TypeScript Patterns
- Strict type checking
- Interface generation
- Generic type support
- Utility type creation
- Schema-to-type conversion

## Best Practices

1. **Always validate inputs** with Zod schemas
2. **Include comprehensive error handling**
3. **Add JSDoc comments** for API documentation
4. **Follow TypeScript strict mode**
5. **Include test coverage** for all generated code
6. **Use semantic versioning** for templates
7. **Leverage ontology context** for customization

## Contributing

When adding new templates:

1. Follow existing naming conventions
2. Include front-matter for routing  
3. Add validation schemas
4. Include comprehensive examples
5. Document all template variables
6. Add tests for template generation

## Template Structure

```
templates/
├── command/new/           # Command templates
│   ├── index.ts.njk      # Main command implementation
│   ├── test.spec.ts.njk  # Test suite
│   └── README.md.njk     # Documentation
├── workflow/new/          # Workflow templates  
│   ├── workflow.ts.njk   # Workflow definition
│   ├── tasks.ts.njk      # Task implementations
│   └── config.yaml.njk   # Configuration
├── task/new/              # Task templates
│   ├── task.ts.njk       # Task class
│   ├── schema.ts.njk     # Zod schemas
│   └── types.ts.njk      # TypeScript types
├── docs/                  # Documentation templates
│   ├── api.md.njk        # API docs
│   ├── cli-help.txt.njk  # CLI help
│   └── changelog.md.njk  # Changelog
├── _filters.js           # Custom filters
├── config.js             # Configuration
└── README.md             # This file
```

## License

MIT - See LICENSE for details.