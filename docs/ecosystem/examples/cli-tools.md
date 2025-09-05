# CLI Tool Generation Examples

UnJucks excels at generating complete CLI tools and command-line interfaces. This guide shows real-world examples of creating production-ready CLI applications with semantic descriptions.

## 🛠️ Complete CLI Framework Generation

### Example 1: Docker Management CLI

Generate a comprehensive Docker management tool from semantic descriptions:

```typescript
// docker-cli-generator.ts
import { generateFromOntology } from '@unjs/unjucks'

const dockerOntology = `
@prefix : <http://docker-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .

:dockerCLI a cli:CLI ;
  cli:name "docker-helper" ;
  cli:description "Advanced Docker management toolkit" ;
  cli:version "1.0.0" ;
  cli:hasCommand :containers, :images, :networks, :volumes, :compose .

# Container Management Commands
:containers a cli:CommandGroup ;
  cli:name "containers" ;
  cli:description "Container lifecycle management" ;
  cli:hasSubcommand :containerList, :containerStart, :containerStop, :containerLogs .

:containerList a cli:Command ;
  cli:name "list" ;
  cli:alias "ls" ;
  cli:description "List all containers" ;
  cli:hasOption :listAll, :listFormat, :listFilter .

:containerStart a cli:Command ;
  cli:name "start" ;
  cli:description "Start one or more containers" ;
  cli:hasArgument :containerNames ;
  cli:hasOption :interactive, :attach .

:containerStop a cli:Command ;
  cli:name "stop" ;
  cli:description "Stop running containers" ;
  cli:hasArgument :containerNames ;
  cli:hasOption :timeout, :force .

:containerLogs a cli:Command ;
  cli:name "logs" ;
  cli:description "Fetch container logs" ;
  cli:hasArgument :containerName ;
  cli:hasOption :follow, :tail, :since .

# Image Management Commands
:images a cli:CommandGroup ;
  cli:name "images" ;
  cli:description "Docker image management" ;
  cli:hasSubcommand :imageList, :imageBuild, :imagePush, :imagePull .

:imageBuild a cli:Command ;
  cli:name "build" ;
  cli:description "Build image from Dockerfile" ;
  cli:hasArgument :buildContext ;
  cli:hasOption :dockerfile, :tag, :noCache .

# Options Definitions
:listAll a cli:Option ;
  cli:name "all" ;
  cli:shortName "a" ;
  cli:type "boolean" ;
  cli:description "Show all containers (default shows just running)" .

:listFormat a cli:Option ;
  cli:name "format" ;
  cli:shortName "f" ;
  cli:type "string" ;
  cli:description "Pretty-print containers using a Go template" .

:interactive a cli:Option ;
  cli:name "interactive" ;
  cli:shortName "i" ;
  cli:type "boolean" ;
  cli:description "Keep STDIN open even if not attached" .

:follow a cli:Option ;
  cli:name "follow" ;
  cli:shortName "f" ;
  cli:type "boolean" ;
  cli:description "Follow log output" .

:tail a cli:Option ;
  cli:name "tail" ;
  cli:type "string" ;
  cli:default "all" ;
  cli:description "Number of lines to show from the end of the logs" .
`

// Generate complete CLI project
const result = await generateFromOntology(dockerOntology, 'citty-cli', {
  context: {
    framework: 'citty',
    language: 'typescript',
    packageManager: 'pnpm',
    features: ['colored-output', 'progress-bars', 'config-file', 'auto-completion']
  }
})

// Generated files:
// - package.json
// - src/cli.ts
// - src/commands/containers.ts
// - src/commands/images.ts
// - src/utils/docker-api.ts
// - README.md
// - tests/
```

**Generated CLI Structure:**

```typescript
// Generated: src/cli.ts
import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'

const main = defineCommand({
  meta: {
    name: 'docker-helper',
    version: '1.0.0',
    description: 'Advanced Docker management toolkit'
  },
  subCommands: {
    containers: () => import('./commands/containers').then(r => r.default),
    images: () => import('./commands/images').then(r => r.default),
    networks: () => import('./commands/networks').then(r => r.default),
    volumes: () => import('./commands/volumes').then(r => r.default),
    compose: () => import('./commands/compose').then(r => r.default)
  },
  setup(ctx) {
    // Global CLI setup
    consola.options.formatOptions.colors = true
  }
})

if (import.meta.main) {
  runMain(main)
}

export default main
```

### Example 2: API Testing CLI

Generate a powerful API testing tool:

```typescript
const apiTestOntology = `
@prefix : <http://api-test-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .
@prefix http: <http://www.w3.org/2011/http#> .

:apiTestCLI a cli:CLI ;
  cli:name "api-tester" ;
  cli:description "Modern API testing and validation toolkit" ;
  cli:version "2.0.0" ;
  cli:hasCommand :request, :test, :mock, :schema, :benchmark .

:request a cli:Command ;
  cli:name "request" ;
  cli:alias "req" ;
  cli:description "Make HTTP requests with advanced features" ;
  cli:hasArgument :url ;
  cli:hasOption :method, :headers, :body, :auth, :timeout, :output .

:test a cli:CommandGroup ;
  cli:name "test" ;
  cli:description "API test suite management" ;
  cli:hasSubcommand :testRun, :testCreate, :testValidate .

:testRun a cli:Command ;
  cli:name "run" ;
  cli:description "Execute API test suites" ;
  cli:hasArgument :testFiles ;
  cli:hasOption :environment, :reporter, :bail, :parallel .

:testCreate a cli:Command ;
  cli:name "create" ;
  cli:description "Create test suite from OpenAPI spec" ;
  cli:hasArgument :specFile ;
  cli:hasOption :output, :coverage, :examples .

:mock a cli:Command ;
  cli:name "mock" ;
  cli:description "Start mock API server" ;
  cli:hasArgument :specFile ;
  cli:hasOption :port, :host, :watch, :cors .

:schema a cli:CommandGroup ;
  cli:name "schema" ;
  cli:description "API schema operations" ;
  cli:hasSubcommand :schemaValidate, :schemaGenerate, :schemaDiff .

:benchmark a cli:Command ;
  cli:name "benchmark" ;
  cli:alias "perf" ;
  cli:description "Performance testing and benchmarking" ;
  cli:hasArgument :targetUrl ;
  cli:hasOption :duration, :connections, :requests, :load-pattern .

# Advanced Options
:method a cli:Option ;
  cli:name "method" ;
  cli:shortName "X" ;
  cli:type "enum" ;
  cli:values ("GET" "POST" "PUT" "DELETE" "PATCH" "HEAD" "OPTIONS") ;
  cli:default "GET" ;
  cli:description "HTTP method to use" .

:headers a cli:Option ;
  cli:name "header" ;
  cli:shortName "H" ;
  cli:type "array" ;
  cli:description "Custom headers (can be used multiple times)" .

:environment a cli:Option ;
  cli:name "env" ;
  cli:shortName "e" ;
  cli:type "string" ;
  cli:description "Test environment configuration" .

:parallel a cli:Option ;
  cli:name "parallel" ;
  cli:shortName "p" ;
  cli:type "number" ;
  cli:default 1 ;
  cli:description "Number of parallel test workers" .
`

const result = await generateFromOntology(apiTestOntology, 'citty-cli-advanced', {
  context: {
    features: [
      'json-schema-validation',
      'openapi-integration',
      'test-reporting',
      'performance-metrics',
      'environment-management',
      'plugin-system'
    ]
  }
})
```

## 🏗️ Framework-Specific Generations

### Citty Framework Integration

```typescript
// citty-specific template with advanced features
const template = `
import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'
import { resolve } from 'pathe'

{{#each commands}}
const {{ name }}Command = defineCommand({
  meta: {
    name: '{{ name }}',
    description: '{{ description }}'
  },
  args: {
    {{#each arguments}}
    {{ name }}: {
      type: 'positional',
      description: '{{ description }}'{{#if required}},
      required: true{{/if}}
    },
    {{/each}}
  },
  options: {
    {{#each options}}
    {{ name }}: {
      type: '{{ type }}',
      {{#if shortName}}alias: '{{ shortName }}',{{/if}}
      description: '{{ description }}'{{#if default}},
      default: {{#if (eq type "string")}}'{{ default }}'{{else}}{{ default }}{{/if}}{{/if}}
    },
    {{/each}}
  },
  async run({ args, options }) {
    // Implementation for {{ name }} command
    consola.info('Executing {{ name }} command')
    
    {{#if hasSemanticLogic}}
    // Semantic processing
    const context = await buildSemanticContext(args, options)
    const result = await processSemanticCommand('{{ name }}', context)
    {{/if}}
    
    try {
      {{#switch name}}
        {{#case "build"}}
        await buildProject(args, options)
        {{/case}}
        {{#case "test"}}
        await runTests(args, options)
        {{/case}}
        {{#case "deploy"}}
        await deployApplication(args, options)
        {{/case}}
        {{#default}}
        await genericCommandHandler('{{ name }}', args, options)
        {{/default}}
      {{/switch}}
    } catch (error) {
      consola.error(\`{{ name }} command failed:\`, error.message)
      process.exit(1)
    }
  }
})
{{/each}}

const main = defineCommand({
  meta: {
    name: '{{ cli.name }}',
    version: '{{ cli.version }}',
    description: '{{ cli.description }}'
  },
  subCommands: {
    {{#each commands}}
    {{ name }}: {{ name }}Command,
    {{/each}}
  },
  setup(ctx) {
    // Global setup
    consola.options.formatOptions.colors = true
    
    {{#if features.configFile}}
    // Load configuration
    const config = loadConfig()
    ctx.config = config
    {{/if}}
    
    {{#if features.plugins}}
    // Load plugins
    await loadPlugins(ctx)
    {{/if}}
  }
})

if (import.meta.main) {
  runMain(main)
}

export default main
`
```

### Commander.js Integration

```typescript
// Commander.js template generation
const commanderTemplate = `
import { Command } from 'commander'
import { version } from '../package.json'

const program = new Command()

program
  .name('{{ cli.name }}')
  .description('{{ cli.description }}')
  .version(version)

{{#each commands}}
{{#if isGroup}}
// {{ name }} command group
const {{ name }}Command = new Command('{{ name }}')
  .description('{{ description }}')

{{#each subcommands}}
{{ ../name }}Command
  .command('{{ name }}')
  .description('{{ description }}')
  {{#each arguments}}
  .argument('<{{ name }}>', '{{ description }}')
  {{/each}}
  {{#each options}}
  .option('{{#if shortName}}-{{ shortName }}, {{/if}}--{{ name }}{{#if (ne type "boolean")}} <value>{{/if}}', '{{ description }}'{{#if default}}, {{ default }}{{/if}})
  {{/each}}
  .action(async ({{#each arguments}}{{ name }}{{#unless @last}}, {{/unless}}{{/each}}{{#if options}}, options{{/if}}) => {
    const { {{ name }}Handler } = await import('./handlers/{{ ../name }}/{{ name }}')
    await {{ name }}Handler({{#each arguments}}{{ name }}{{#unless @last}}, {{/unless}}{{/each}}{{#if options}}, options{{/if}})
  })
{{/each}}

program.addCommand({{ name }}Command)
{{else}}
// {{ name }} command
program
  .command('{{ name }}')
  .description('{{ description }}')
  {{#each arguments}}
  .argument('<{{ name }}>', '{{ description }}')
  {{/each}}
  {{#each options}}
  .option('{{#if shortName}}-{{ shortName }}, {{/if}}--{{ name }}{{#if (ne type "boolean")}} <value>{{/if}}', '{{ description }}'{{#if default}}, {{ default }}{{/if}})
  {{/each}}
  .action(async ({{#each arguments}}{{ name }}{{#unless @last}}, {{/unless}}{{/each}}{{#if options}}, options{{/if}}) => {
    const { {{ name }}Handler } = await import('./handlers/{{ name }}')
    await {{ name }}Handler({{#each arguments}}{{ name }}{{#unless @last}}, {{/unless}}{{/each}}{{#if options}}, options{{/if}})
  })
{{/if}}
{{/each}}

program.parse()
`
```

## 🚀 Advanced CLI Features

### 1. Interactive CLI with Prompts

```typescript
const interactiveOntology = `
@prefix : <http://interactive-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .
@prefix ui: <http://ui.example.org/> .

:setupWizard a cli:InteractiveCommand ;
  cli:name "setup" ;
  cli:description "Interactive setup wizard" ;
  cli:hasPrompt :projectName, :framework, :features, :deployment .

:projectName a ui:Prompt ;
  ui:type "input" ;
  ui:message "What's your project name?" ;
  ui:validate :validateProjectName .

:framework a ui:Prompt ;
  ui:type "select" ;
  ui:message "Choose your framework:" ;
  ui:choices ("Next.js" "Nuxt" "SvelteKit" "Astro" "Vanilla") .

:features a ui:Prompt ;
  ui:type "multiselect" ;
  ui:message "Select features to include:" ;
  ui:choices ("TypeScript" "Tailwind CSS" "ESLint" "Prettier" "Vitest" "Storybook") .

:deployment a ui:Prompt ;
  ui:type "select" ;
  ui:message "Where will you deploy?" ;
  ui:choices ("Vercel" "Netlify" "Railway" "Docker" "Manual") ;
  ui:conditional :hasDeployment .
`

// Generated interactive CLI
const generatedInteractive = `
import prompts from 'prompts'
import { defineCommand } from 'citty'
import { consola } from 'consola'

export default defineCommand({
  meta: {
    name: 'setup',
    description: 'Interactive setup wizard'
  },
  async run() {
    consola.start('Starting interactive setup...')
    
    const response = await prompts([
      {
        type: 'text',
        name: 'projectName',
        message: 'What\\'s your project name?',
        validate: (value) => {
          if (!value) return 'Project name is required'
          if (!/^[a-zA-Z0-9-_]+$/.test(value)) return 'Invalid project name format'
          return true
        }
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Choose your framework:',
        choices: [
          { title: 'Next.js', value: 'nextjs' },
          { title: 'Nuxt', value: 'nuxt' },
          { title: 'SvelteKit', value: 'sveltekit' },
          { title: 'Astro', value: 'astro' },
          { title: 'Vanilla', value: 'vanilla' }
        ]
      },
      {
        type: 'multiselect',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { title: 'TypeScript', value: 'typescript', selected: true },
          { title: 'Tailwind CSS', value: 'tailwind' },
          { title: 'ESLint', value: 'eslint', selected: true },
          { title: 'Prettier', value: 'prettier', selected: true },
          { title: 'Vitest', value: 'vitest' },
          { title: 'Storybook', value: 'storybook' }
        ]
      },
      {
        type: 'select',
        name: 'deployment',
        message: 'Where will you deploy?',
        choices: [
          { title: 'Vercel', value: 'vercel' },
          { title: 'Netlify', value: 'netlify' },
          { title: 'Railway', value: 'railway' },
          { title: 'Docker', value: 'docker' },
          { title: 'Manual', value: 'manual' }
        ]
      }
    ])
    
    if (!response.projectName) {
      consola.error('Setup cancelled')
      return
    }
    
    consola.info('Setting up project with configuration:')
    console.table(response)
    
    // Generate project based on responses
    await generateProject(response)
    
    consola.success(\`Project \${response.projectName} created successfully!\`)
  }
})
`
```

### 2. Plugin System Integration

```typescript
const pluginSystemOntology = `
@prefix : <http://plugin-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .

:pluginCLI a cli:CLI ;
  cli:name "my-tool" ;
  cli:description "Extensible CLI with plugin system" ;
  cli:hasCommand :plugin, :core ;
  cli:supportsPlugins true .

:plugin a cli:CommandGroup ;
  cli:name "plugin" ;
  cli:description "Plugin management commands" ;
  cli:hasSubcommand :pluginList, :pluginInstall, :pluginUninstall, :pluginSearch .

:pluginInstall a cli:Command ;
  cli:name "install" ;
  cli:description "Install a plugin" ;
  cli:hasArgument :pluginName ;
  cli:hasOption :global, :dev, :registry .

:pluginList a cli:Command ;
  cli:name "list" ;
  cli:description "List installed plugins" ;
  cli:hasOption :global, :format .
`

// Generated plugin system
const pluginCLI = `
import { defineCommand } from 'citty'
import { loadPlugins, installPlugin, listPlugins } from './plugin-manager'

const pluginCommand = defineCommand({
  meta: {
    name: 'plugin',
    description: 'Plugin management commands'
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List installed plugins'
      },
      options: {
        global: {
          type: 'boolean',
          description: 'List global plugins'
        },
        format: {
          type: 'string',
          description: 'Output format (table, json, list)',
          default: 'table'
        }
      },
      async run({ options }) {
        const plugins = await listPlugins({
          global: options.global
        })
        
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify(plugins, null, 2))
            break
          case 'list':
            plugins.forEach(p => console.log(p.name))
            break
          default:
            console.table(plugins)
        }
      }
    }),
    
    install: defineCommand({
      meta: {
        name: 'install',
        description: 'Install a plugin'
      },
      args: {
        pluginName: {
          type: 'positional',
          description: 'Plugin name to install',
          required: true
        }
      },
      options: {
        global: {
          type: 'boolean',
          alias: 'g',
          description: 'Install globally'
        },
        dev: {
          type: 'boolean',
          alias: 'D',
          description: 'Install as dev dependency'
        }
      },
      async run({ args, options }) {
        await installPlugin(args.pluginName, {
          global: options.global,
          dev: options.dev
        })
      }
    })
  }
})

export default pluginCommand
`
```

### 3. Configuration Management

```typescript
const configOntology = `
@prefix : <http://config-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .

:configCLI a cli:CLI ;
  cli:name "config-manager" ;
  cli:description "Configuration management CLI" ;
  cli:hasCommand :config ;
  cli:hasConfigFile ".configrc" ;
  cli:supportsProfiles true .

:config a cli:CommandGroup ;
  cli:name "config" ;
  cli:description "Configuration management" ;
  cli:hasSubcommand :configGet, :configSet, :configList, :configProfile .

:configSet a cli:Command ;
  cli:name "set" ;
  cli:description "Set configuration value" ;
  cli:hasArgument :key, :value ;
  cli:hasOption :profile, :global .

:configProfile a cli:Command ;
  cli:name "profile" ;
  cli:description "Manage configuration profiles" ;
  cli:hasSubcommand :profileList, :profileCreate, :profileSwitch .
`

// Generated configuration system
const configCLI = `
import { defineCommand } from 'citty'
import { loadConfig, saveConfig, createProfile } from './config-manager'

export default defineCommand({
  meta: {
    name: 'config',
    description: 'Configuration management'
  },
  subCommands: {
    set: defineCommand({
      meta: {
        name: 'set',
        description: 'Set configuration value'
      },
      args: {
        key: {
          type: 'positional',
          description: 'Configuration key',
          required: true
        },
        value: {
          type: 'positional', 
          description: 'Configuration value',
          required: true
        }
      },
      options: {
        profile: {
          type: 'string',
          description: 'Configuration profile',
          default: 'default'
        },
        global: {
          type: 'boolean',
          alias: 'g',
          description: 'Set global configuration'
        }
      },
      async run({ args, options }) {
        const config = await loadConfig(options.profile, options.global)
        
        // Support nested keys like "api.timeout"
        const keys = args.key.split('.')
        let current = config
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {}
          }
          current = current[keys[i]]
        }
        
        // Type conversion
        let value = args.value
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (!isNaN(Number(value))) value = Number(value)
        
        current[keys[keys.length - 1]] = value
        
        await saveConfig(config, options.profile, options.global)
        consola.success(\`Set \${args.key} = \${value}\`)
      }
    })
  }
})
`
```

## 📊 Real-World CLI Examples

### Example: Database Migration CLI

```typescript
const migrationOntology = `
@prefix : <http://migration-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .
@prefix db: <http://database.example.org/> .

:migrationCLI a cli:CLI ;
  cli:name "migrate" ;
  cli:description "Database migration management tool" ;
  cli:hasCommand :create, :up, :down, :status, :seed .

:create a cli:Command ;
  cli:name "create" ;
  cli:description "Create a new migration" ;
  cli:hasArgument :migrationName ;
  cli:hasOption :table, :type .

:up a cli:Command ;
  cli:name "up" ;
  cli:description "Run pending migrations" ;
  cli:hasOption :steps, :target, :dryRun .

:down a cli:Command ;
  cli:name "down" ;
  cli:description "Rollback migrations" ;
  cli:hasOption :steps, :target, :force .

:status a cli:Command ;
  cli:name "status" ;
  cli:description "Show migration status" ;
  cli:hasOption :format, :verbose .

:seed a cli:Command ;
  cli:name "seed" ;
  cli:description "Run database seeders" ;
  cli:hasArgument :seedFile ;
  cli:hasOption :env, :force .
`

// Generated with semantic database understanding
const generatedMigrationCLI = await generateFromOntology(migrationOntology, 'citty-cli', {
  context: {
    database: {
      type: 'postgresql',
      migrations: './migrations',
      seeds: './seeds'
    },
    features: ['transaction-support', 'rollback-safety', 'schema-validation']
  }
})
```

### Example: API Documentation CLI

```typescript
const apiDocsOntology = `
@prefix : <http://api-docs-cli.example.org/> .
@prefix cli: <http://cli.example.org/> .
@prefix api: <http://api.example.org/> .

:apiDocsCLI a cli:CLI ;
  cli:name "api-docs" ;
  cli:description "API documentation generator and validator" ;
  cli:hasCommand :generate, :validate, :serve, :export .

:generate a cli:Command ;
  cli:name "generate" ;
  cli:description "Generate documentation from API spec" ;
  cli:hasArgument :specFile ;
  cli:hasOption :output, :theme, :format, :includeExamples .

:validate a cli:Command ;
  cli:name "validate" ;
  cli:description "Validate API specification" ;
  cli:hasArgument :specFile ;
  cli:hasOption :strict, :format, :rules .

:serve a cli:Command ;
  cli:name "serve" ;
  cli:description "Serve documentation with live reload" ;
  cli:hasArgument :specFile ;
  cli:hasOption :port, :watch, :host .

:export a cli:Command ;
  cli:name "export" ;
  cli:description "Export documentation to various formats" ;
  cli:hasArgument :specFile ;
  cli:hasOption :format, :output, :template .
`
```

## 🎯 Best Practices for CLI Generation

### 1. Command Structure Design

```typescript
// Well-structured command hierarchy
const bestPracticesOntology = `
@prefix : <http://best-practices.example.org/> .

# Group related commands
:userManagement a cli:CommandGroup ;
  cli:name "user" ;
  cli:hasSubcommand :userCreate, :userList, :userDelete .

# Consistent naming
:userCreate a cli:Command ;
  cli:name "create" ;  # not "add" or "new"
  cli:alias "c" .      # short alias

# Clear descriptions
:userCreate cli:description "Create a new user account with specified permissions" .

# Logical option grouping
:userCreate cli:hasOption :userName, :userEmail, :userRole, :sendNotification .
`
```

### 2. Error Handling and Validation

```typescript
// Generated with comprehensive error handling
const errorHandlingTemplate = `
export default defineCommand({
  async run({ args, options }) {
    try {
      // Input validation
      if (!args.filename) {
        throw new Error('Filename is required')
      }
      
      if (!fs.existsSync(args.filename)) {
        throw new Error(\`File not found: \${args.filename}\`)
      }
      
      // Process command
      const result = await processFile(args.filename, options)
      
      // Success output
      consola.success(\`Processed \${args.filename} successfully\`)
      
    } catch (error) {
      // Structured error handling
      if (error.code === 'ENOENT') {
        consola.error('File not found:', error.path)
      } else if (error.code === 'EACCES') {
        consola.error('Permission denied:', error.path)
      } else {
        consola.error('Command failed:', error.message)
      }
      
      // Exit with appropriate code
      process.exit(1)
    }
  }
})
`
```

### 3. Progress Indication and Feedback

```typescript
// Generated CLI with rich user feedback
const progressTemplate = `
import { consola } from 'consola'
import ora from 'ora'
import cliProgress from 'cli-progress'

export default defineCommand({
  async run({ args, options }) {
    // Spinner for indeterminate tasks
    const spinner = ora('Processing files...').start()
    
    try {
      const files = await findFiles(args.pattern)
      spinner.succeed(\`Found \${files.length} files\`)
      
      // Progress bar for determinate tasks
      const progressBar = new cliProgress.SingleBar({
        format: 'Processing |{bar}| {percentage}% | {value}/{total} Files | ETA: {eta}s',
        barCompleteChar: '\\u2588',
        barIncompleteChar: '\\u2591',
        hideCursor: true
      })
      
      progressBar.start(files.length, 0)
      
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i])
        progressBar.update(i + 1)
      }
      
      progressBar.stop()
      
      consola.success(\`Successfully processed \${files.length} files\`)
      
    } catch (error) {
      spinner.fail('Processing failed')
      throw error
    }
  }
})
`
```

## 📚 CLI Generation Templates

UnJucks provides pre-built templates for common CLI patterns:

- **`citty-cli`** - Modern CLI with Citty framework
- **`commander-cli`** - Traditional CLI with Commander.js
- **`yargs-cli`** - CLI with Yargs parser
- **`interactive-cli`** - CLI with prompts and wizards
- **`plugin-cli`** - Extensible CLI with plugin system
- **`config-cli`** - CLI with configuration management

## 🔗 Resources

- **[Citty Framework](https://github.com/unjs/citty)** - Modern CLI framework
- **[CLI Best Practices](https://clig.dev/)** - Command line interface guidelines
- **[UnJS Ecosystem](https://unjs.io/)** - Related tools and utilities

---

*Ready to generate your CLI? Try our [interactive CLI builder](https://unjucks.unjs.io/playground/cli) or explore more [examples](../examples/).*