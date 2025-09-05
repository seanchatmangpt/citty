/**
 * End-to-End Integration Tests for Unjucks
 * Tests complete workflow from ontology to generated CLI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
// Mock classes since the actual implementation files don't exist yet
class UnjucksEngine {
  async generateProject(config: ProjectConfig): Promise<GenerationResult> {
    // Mock implementation
    return {
      success: true,
      files: [],
      errors: []
    };
  }
}

class UnjucksCLI {
  // Mock implementation
}
// Mock types since the actual types may not exist
interface ProjectConfig {
  name: string;
  version: string;
  description: string;
  output?: {
    directory: string;
    format?: string;
    packageManager?: string;
  };
  templates?: {
    directory: string;
    engine?: string;
  };
  ontology?: {
    files: string[];
  };
}

interface GenerationResult {
  success: boolean;
  files: string[];
  errors: string[];
}

describe('Unjucks E2E Integration', () => {
  let tempDir: string;
  let projectDir: string;
  let engine: UnjucksEngine;
  let cli: UnjucksCLI;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `unjucks-e2e-test-${Date.now()}`);
    projectDir = join(tempDir, 'test-project');
    await mkdir(projectDir, { recursive: true });
    
    engine = new UnjucksEngine();
    cli = new UnjucksCLI();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete CLI Generation Workflow', () => {
    it('should generate complete CLI from complex ontology', async () => {
      // Create comprehensive ontology
      const ontologyContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Base command class
cmd:BaseCommand a cmd:CommandClass ;
    rdfs:label "Base Command" ;
    cmd:abstract true ;
    cmd:hasArgument cmd:verbose, cmd:config .

# Development commands
cmd:BuildCommand a cmd:Command ;
    rdfs:label "Build Command" ;
    cmd:description "Build the project" ;
    cmd:inheritsFrom cmd:BaseCommand ;
    cmd:category "development" ;
    cmd:hasArgument cmd:target, cmd:watch, cmd:production .

cmd:TestCommand a cmd:Command ;
    rdfs:label "Test Command" ;
    cmd:description "Run project tests" ;
    cmd:inheritsFrom cmd:BaseCommand ;
    cmd:category "development" ;
    cmd:hasArgument cmd:pattern, cmd:coverage .

cmd:ServeCommand a cmd:Command ;
    rdfs:label "Serve Command" ;
    cmd:description "Start development server" ;
    cmd:inheritsFrom cmd:BaseCommand ;
    cmd:category "development" ;
    cmd:hasArgument cmd:port, cmd:host, cmd:https .

# Deployment commands
cmd:DeployCommand a cmd:Command ;
    rdfs:label "Deploy Command" ;
    cmd:description "Deploy to environment" ;
    cmd:inheritsFrom cmd:BaseCommand ;
    cmd:category "deployment" ;
    cmd:hasArgument cmd:environment, cmd:dryRun .

# Common arguments
cmd:verbose a cmd:Argument ;
    rdfs:label "Verbose output" ;
    cmd:description "Enable verbose logging" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .

cmd:config a cmd:Argument ;
    rdfs:label "Config file" ;
    cmd:description "Path to configuration file" ;
    cmd:type "string" ;
    cmd:required false .

# Build-specific arguments
cmd:target a cmd:Argument ;
    rdfs:label "Build target" ;
    cmd:description "Target to build (dev, prod, all)" ;
    cmd:type "string" ;
    cmd:enum ["dev", "prod", "all"] ;
    cmd:default "dev" ;
    cmd:required false .

cmd:watch a cmd:Argument ;
    rdfs:label "Watch mode" ;
    cmd:description "Enable watch mode for rebuilding" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .

cmd:production a cmd:Argument ;
    rdfs:label "Production mode" ;
    cmd:description "Build for production" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .

# Test-specific arguments
cmd:pattern a cmd:Argument ;
    rdfs:label "Test pattern" ;
    cmd:description "Pattern to match test files" ;
    cmd:type "string" ;
    cmd:required false .

cmd:coverage a cmd:Argument ;
    rdfs:label "Coverage report" ;
    cmd:description "Generate coverage report" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .

# Serve-specific arguments
cmd:port a cmd:Argument ;
    rdfs:label "Port number" ;
    cmd:description "Port to run server on" ;
    cmd:type "number" ;
    cmd:default 3000 ;
    cmd:min 1000 ;
    cmd:max 65535 ;
    cmd:required false .

cmd:host a cmd:Argument ;
    rdfs:label "Host address" ;
    cmd:description "Host address to bind to" ;
    cmd:type "string" ;
    cmd:default "localhost" ;
    cmd:required false .

cmd:https a cmd:Argument ;
    rdfs:label "HTTPS mode" ;
    cmd:description "Enable HTTPS" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .

# Deploy-specific arguments
cmd:environment a cmd:Argument ;
    rdfs:label "Environment" ;
    cmd:description "Deployment environment" ;
    cmd:type "string" ;
    cmd:enum ["development", "staging", "production"] ;
    cmd:required true .

cmd:dryRun a cmd:Argument ;
    rdfs:label "Dry run" ;
    cmd:description "Perform dry run without actual deployment" ;
    cmd:type "boolean" ;
    cmd:default false ;
    cmd:required false .
`;

      // Create project configuration
      const projectConfig: ProjectConfig = {
        name: 'test-cli',
        version: '1.0.0',
        description: 'Generated CLI for testing',
        output: {
          directory: join(projectDir, 'generated'),
          format: 'typescript',
          packageManager: 'pnpm'
        },
        templates: {
          directory: join(projectDir, 'templates'),
          engine: 'nunjucks'
        },
        ontology: {
          files: [join(projectDir, 'ontology.ttl')]
        }
      };

      // Create main command template
      const commandTemplate = `
/**
 * {{ command.label }}
 * {{ command.description }}
 */

import { defineCommand } from '../index';
{% if command.category %}
import { {{ command.category | camelCase }}Category } from '../categories';
{% endif %}

export const {{ command.name | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ command.name | kebabCase }}',
    description: '{{ command.description }}',
    {% if command.category %}category: '{{ command.category }}',{% endif %}
  },
  args: {
    {% for arg in command.arguments %}
    {{ arg.name | camelCase }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.description }}',
      {% if arg.required %}required: true,{% endif %}
      {% if arg.default is defined %}default: {{ arg.default | tojson }},{% endif %}
      {% if arg.enum %}enum: {{ arg.enum | tojson }},{% endif %}
      {% if arg.min is defined %}min: {{ arg.min }},{% endif %}
      {% if arg.max is defined %}max: {{ arg.max }},{% endif %}
      {% if arg.inherited %}// Inherited from {{ arg.inheritedFrom }}{% endif %}
    },
    {% endfor %}
  },
  async run({ args, meta }) {
    console.log('Executing {{ meta.name }} with arguments:', args);
    
    {% if command.name === 'BuildCommand' %}
    // Build implementation
    if (args.production) {
      console.log('Building for production...');
    } else {
      console.log('Building for {{ args.target }}...');
    }
    
    if (args.watch) {
      console.log('Watch mode enabled');
    }
    {% elif command.name === 'TestCommand' %}
    // Test implementation
    console.log('Running tests...');
    
    if (args.pattern) {
      console.log('Using pattern:', args.pattern);
    }
    
    if (args.coverage) {
      console.log('Generating coverage report...');
    }
    {% elif command.name === 'ServeCommand' %}
    // Serve implementation
    const protocol = args.https ? 'https' : 'http';
    console.log('Starting server at ' + protocol + '://' + args.host + ':' + args.port);
    {% elif command.name === 'DeployCommand' %}
    // Deploy implementation
    if (args.dryRun) {
      console.log('Dry run deployment to ' + args.environment);
    } else {
      console.log('Deploying to ' + args.environment + '...');
    }
    {% endif %}
    
    if (args.verbose) {
      console.log('Verbose mode enabled');
    }
    
    if (args.config) {
      console.log('Using config file: ' + args.config);
    }
  }
});
`;

      // Create index template
      const indexTemplate = `
/**
 * {{ project.name }} CLI
 * {{ project.description }}
 * 
 * Generated by Unjucks from semantic ontology
 */

export { defineCommand } from 'citty';

// Individual commands
{% for command in commands | reject('abstract') %}
export { {{ command.name | camelCase }}Command } from './commands/{{ command.name | kebabCase }}';
{% endfor %}

// Command categories
{% for category, categoryCommands in commands | reject('abstract') | groupby('category') %}
export const {{ category | camelCase }}Commands = {
  {% for command in categoryCommands %}
  {{ command.name | camelCase }}: () => import('./commands/{{ command.name | kebabCase }}').then(m => m.{{ command.name | camelCase }}Command),
  {% endfor %}
};
{% endfor %}

// Main CLI definition
export const cli = {
  meta: {
    name: '{{ project.name }}',
    description: '{{ project.description }}',
    version: '{{ project.version }}'
  },
  subCommands: {
    {% for command in commands | reject('abstract') %}
    '{{ command.name | kebabCase }}': () => import('./commands/{{ command.name | kebabCase }}').then(m => m.{{ command.name | camelCase }}Command),
    {% endfor %}
  }
};
`;

      // Create package.json template
      const packageTemplate = `{
  "name": "{{ project.name }}",
  "version": "{{ project.version }}",
  "description": "{{ project.description }}",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "bin": {
    "{{ project.name }}": "./dist/cli.mjs"
  },
  "scripts": {
    "build": "unbuild",
    "dev": "jiti src/cli.ts",
    "lint": "eslint --cache . && prettier -c src",
    "lint:fix": "eslint --cache . --fix && prettier -c src -w",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "citty": "^0.1.6",
    "consola": "^3.4.0"
  },
  "devDependencies": {
    "@types/node": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "typescript": "latest",
    "unbuild": "latest",
    "vitest": "latest",
    "jiti": "latest"
  },
  "files": ["dist"],
  "packageManager": "pnpm@latest"
}
`;

      // Write all files
      await writeFile(join(projectDir, 'ontology.ttl'), ontologyContent);
      await writeFile(join(projectDir, 'project.json'), JSON.stringify(projectConfig, null, 2));
      
      const templatesDir = join(projectDir, 'templates');
      await mkdir(templatesDir, { recursive: true });
      await writeFile(join(templatesDir, 'command.njk'), commandTemplate);
      await writeFile(join(templatesDir, 'index.njk'), indexTemplate);
      await writeFile(join(templatesDir, 'package.json.njk'), packageTemplate);

      // Generate the CLI
      const result: GenerationResult = await engine.generateProject(projectConfig);

      // Verify generation results
      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Check generated files exist
      const generatedDir = join(projectDir, 'generated');
      expect(await fileExists(join(generatedDir, 'package.json'))).toBe(true);
      expect(await fileExists(join(generatedDir, 'src/index.ts'))).toBe(true);
      expect(await fileExists(join(generatedDir, 'src/commands/build-command.ts'))).toBe(true);
      expect(await fileExists(join(generatedDir, 'src/commands/test-command.ts'))).toBe(true);
      expect(await fileExists(join(generatedDir, 'src/commands/serve-command.ts'))).toBe(true);
      expect(await fileExists(join(generatedDir, 'src/commands/deploy-command.ts'))).toBe(true);

      // Verify generated content
      const packageJson = JSON.parse(await readFile(join(generatedDir, 'package.json'), 'utf-8'));
      expect(packageJson.name).toBe('test-cli');
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.bin['test-cli']).toBeDefined();

      const indexContent = await readFile(join(generatedDir, 'src/index.ts'), 'utf-8');
      expect(indexContent).toContain('buildCommand');
      expect(indexContent).toContain('testCommand');
      expect(indexContent).toContain('serveCommand');
      expect(indexContent).toContain('deployCommand');
      expect(indexContent).toContain('developmentCommands');
      expect(indexContent).toContain('deploymentCommands');

      const buildCommandContent = await readFile(join(generatedDir, 'src/commands/build-command.ts'), 'utf-8');
      expect(buildCommandContent).toContain('Build Command');
      expect(buildCommandContent).toContain('Build the project');
      expect(buildCommandContent).toContain('buildCommand');
      expect(buildCommandContent).toContain('target: {');
      expect(buildCommandContent).toContain('watch: {');
      expect(buildCommandContent).toContain('production: {');
      expect(buildCommandContent).toContain('verbose: {');
      expect(buildCommandContent).toContain('// Inherited from BaseCommand');

      const deployCommandContent = await readFile(join(generatedDir, 'src/commands/deploy-command.ts'), 'utf-8');
      expect(deployCommandContent).toContain('environment: {');
      expect(deployCommandContent).toContain('required: true');
      expect(deployCommandContent).toContain('enum: ["development", "staging", "production"]');
    });

    it('should generate CLI with proper TypeScript types', async () => {
      const simpleOntology = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:HelloCommand a cmd:Command ;
    rdfs:label "Hello Command" ;
    cmd:description "Say hello" ;
    cmd:hasArgument cmd:name .

cmd:name a cmd:Argument ;
    rdfs:label "Name" ;
    cmd:description "Name to greet" ;
    cmd:type "string" ;
    cmd:required true .
`;

      const typesTemplate = `
/**
 * Generated TypeScript types for {{ project.name }}
 */

// Command argument types
{% for command in commands %}
export interface {{ command.name | pascalCase }}Args {
  {% for arg in command.arguments %}
  {{ arg.name | camelCase }}{% if not arg.required %}?{% endif %}: {{ arg.type | tsType }};
  {% endfor %}
}
{% endfor %}

// Command result types
{% for command in commands %}
export interface {{ command.name | pascalCase }}Result {
  success: boolean;
  data?: any;
  error?: string;
}
{% endfor %}

// Main CLI interface
export interface CLI {
  {% for command in commands %}
  {{ command.name | camelCase }}(args: {{ command.name | pascalCase }}Args): Promise<{{ command.name | pascalCase }}Result>;
  {% endfor %}
}
`;

      const projectConfig: ProjectConfig = {
        name: 'typed-cli',
        version: '1.0.0',
        description: 'CLI with TypeScript types',
        output: {
          directory: join(projectDir, 'typed-output'),
          format: 'typescript'
        },
        templates: {
          directory: join(projectDir, 'typed-templates')
        },
        ontology: {
          files: [join(projectDir, 'simple.ttl')]
        }
      };

      await writeFile(join(projectDir, 'simple.ttl'), simpleOntology);
      await mkdir(join(projectDir, 'typed-templates'), { recursive: true });
      await writeFile(join(projectDir, 'typed-templates/types.ts.njk'), typesTemplate);

      const result = await engine.generateProject(projectConfig);
      
      expect(result.success).toBe(true);

      const typesContent = await readFile(join(projectDir, 'typed-output/src/types.ts'), 'utf-8');
      expect(typesContent).toContain('export interface HelloCommandArgs');
      expect(typesContent).toContain('name: string;');
      expect(typesContent).toContain('export interface HelloCommandResult');
      expect(typesContent).toContain('export interface CLI');
    });
  });

  describe('CLI Command Execution', () => {
    it('should execute generated CLI commands', async () => {
      // This test would require the generated CLI to be built and executable
      // For now, we'll test the command definitions
      
      const ontologyContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:EchoCommand a cmd:Command ;
    rdfs:label "Echo Command" ;
    cmd:description "Echo input text" ;
    cmd:hasArgument cmd:text .

cmd:text a cmd:Argument ;
    rdfs:label "Text" ;
    cmd:description "Text to echo" ;
    cmd:type "string" ;
    cmd:required true .
`;

      const executableTemplate = `
#!/usr/bin/env node
/**
 * {{ project.name }} CLI Runner
 */

import { runMain } from 'citty';
import { cli } from './index.js';

runMain(cli);
`;

      const commandTemplate = `
import { defineCommand } from 'citty';

export const {{ command.name | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ command.name | kebabCase }}',
    description: '{{ command.description }}'
  },
  args: {
    {% for arg in command.arguments %}
    {{ arg.name | camelCase }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.description }}',
      {% if arg.required %}required: true,{% endif %}
    },
    {% endfor %}
  },
  async run({ args }) {
    {% if command.name === 'EchoCommand' %}
    console.log(args.text);
    return { success: true, output: args.text };
    {% endif %}
  }
});
`;

      const projectConfig: ProjectConfig = {
        name: 'executable-cli',
        version: '1.0.0',
        description: 'Executable CLI test',
        output: {
          directory: join(projectDir, 'executable'),
          format: 'typescript'
        },
        templates: {
          directory: join(projectDir, 'exec-templates')
        },
        ontology: {
          files: [join(projectDir, 'echo.ttl')]
        }
      };

      await writeFile(join(projectDir, 'echo.ttl'), ontologyContent);
      await mkdir(join(projectDir, 'exec-templates'), { recursive: true });
      await writeFile(join(projectDir, 'exec-templates/command.njk'), commandTemplate);
      await writeFile(join(projectDir, 'exec-templates/cli.js.njk'), executableTemplate);

      const result = await engine.generateProject(projectConfig);
      expect(result.success).toBe(true);

      // Test that the command definition is correct
      const commandContent = await readFile(
        join(projectDir, 'executable/src/commands/echo-command.ts'),
        'utf-8'
      );
      
      expect(commandContent).toContain('echoCommand');
      expect(commandContent).toContain('console.log(args.text)');
      expect(commandContent).toContain('return { success: true, output: args.text }');
    });
  });

  describe('Multi-file Generation', () => {
    it('should generate multiple files with proper structure', async () => {
      const ontologyContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:DatabaseCommand a cmd:Command ;
    rdfs:label "Database Command" ;
    cmd:category "database" ;
    cmd:hasSubCommand cmd:CreateCommand, cmd:MigrateCommand .

cmd:CreateCommand a cmd:Command ;
    rdfs:label "Create Command" ;
    cmd:description "Create database" ;
    cmd:parentCommand cmd:DatabaseCommand .

cmd:MigrateCommand a cmd:Command ;
    rdfs:label "Migrate Command" ;
    cmd:description "Run migrations" ;
    cmd:parentCommand cmd:DatabaseCommand .
`;

      const projectStructure = {
        'src/index.ts.njk': 'export * from "./commands";',
        'src/commands/index.ts.njk': `
{% for command in commands | selectattr('category', 'equalto', 'database') %}
export { {{ command.name | camelCase }}Command } from './{{ command.category }}/{{ command.name | kebabCase }}';
{% endfor %}
`,
        'src/commands/database/index.ts.njk': `
{% for command in commands | selectattr('parentCommand') %}
export { {{ command.name | camelCase }}Command } from './{{ command.name | kebabCase }}';
{% endfor %}
`,
        'src/commands/database/base.ts.njk': 'export const DATABASE_BASE = "database";',
        'README.md.njk': `
# {{ project.name }}

{{ project.description }}

## Commands

{% for command in commands %}
### {{ command.name | kebabCase }}

{{ command.description or 'No description available' }}

{% endfor %}
`
      };

      const projectConfig: ProjectConfig = {
        name: 'multi-file-cli',
        version: '1.0.0',
        description: 'Multi-file CLI generation test',
        output: {
          directory: join(projectDir, 'multi-file'),
          format: 'typescript'
        },
        templates: {
          directory: join(projectDir, 'multi-templates')
        },
        ontology: {
          files: [join(projectDir, 'database.ttl')]
        }
      };

      await writeFile(join(projectDir, 'database.ttl'), ontologyContent);
      
      const templatesDir = join(projectDir, 'multi-templates');
      await mkdir(templatesDir, { recursive: true });
      
      for (const [templatePath, content] of Object.entries(projectStructure)) {
        const fullPath = join(templatesDir, templatePath);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content);
      }

      const result = await engine.generateProject(projectConfig);
      expect(result.success).toBe(true);

      // Verify directory structure
      const outputDir = join(projectDir, 'multi-file');
      expect(await fileExists(join(outputDir, 'src/index.ts'))).toBe(true);
      expect(await fileExists(join(outputDir, 'src/commands/index.ts'))).toBe(true);
      expect(await fileExists(join(outputDir, 'src/commands/database/index.ts'))).toBe(true);
      expect(await fileExists(join(outputDir, 'src/commands/database/base.ts'))).toBe(true);
      expect(await fileExists(join(outputDir, 'README.md'))).toBe(true);

      // Verify content
      const readmeContent = await readFile(join(outputDir, 'README.md'), 'utf-8');
      expect(readmeContent).toContain('# multi-file-cli');
      expect(readmeContent).toContain('### database-command');
      expect(readmeContent).toContain('### create-command');
      expect(readmeContent).toContain('### migrate-command');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed ontology gracefully', async () => {
      const malformedOntology = `
@prefix cmd: <incomplete
cmd:BadCommand a cmd:Command
`; // Missing closing > and semicolon

      const projectConfig: ProjectConfig = {
        name: 'error-test',
        version: '1.0.0',
        description: 'Error handling test',
        output: {
          directory: join(projectDir, 'error-output')
        },
        templates: {
          directory: join(projectDir, 'error-templates')
        },
        ontology: {
          files: [join(projectDir, 'malformed.ttl')]
        }
      };

      await writeFile(join(projectDir, 'malformed.ttl'), malformedOntology);
      await mkdir(join(projectDir, 'error-templates'), { recursive: true });
      await writeFile(
        join(projectDir, 'error-templates/command.njk'),
        'export const command = "{{ command.name }}";'
      );

      const result = await engine.generateProject(projectConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('parsing');
    });

    it('should handle missing template files gracefully', async () => {
      const validOntology = `
@prefix cmd: <http://example.org/commands#> .
cmd:TestCommand a cmd:Command .
`;

      const projectConfig: ProjectConfig = {
        name: 'missing-template-test',
        version: '1.0.0',
        description: 'Missing template test',
        output: {
          directory: join(projectDir, 'missing-output')
        },
        templates: {
          directory: join(projectDir, 'missing-templates')
        },
        ontology: {
          files: [join(projectDir, 'valid.ttl')]
        }
      };

      await writeFile(join(projectDir, 'valid.ttl'), validOntology);
      // Don't create the templates directory

      const result = await engine.generateProject(projectConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate output directory permissions', async () => {
      const projectConfig: ProjectConfig = {
        name: 'permission-test',
        version: '1.0.0',
        description: 'Permission test',
        output: {
          directory: '/root/inaccessible' // Typically inaccessible
        },
        templates: {
          directory: join(projectDir, 'templates')
        },
        ontology: {
          files: [join(projectDir, 'test.ttl')]
        }
      };

      await writeFile(join(projectDir, 'test.ttl'), '@prefix cmd: <http://example.org/commands#> .\ncmd:Test a cmd:Command .');
      await mkdir(join(projectDir, 'templates'), { recursive: true });
      await writeFile(join(projectDir, 'templates/test.njk'), 'test');

      const result = await engine.generateProject(projectConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('permission') || error.includes('EACCES'))).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large ontology efficiently', async () => {
      // Generate a large ontology with many commands
      const largeOntologyParts = ['@prefix cmd: <http://example.org/commands#> .'];
      
      for (let i = 0; i < 100; i++) {
        largeOntologyParts.push(`
cmd:Command${i} a cmd:Command ;
    rdfs:label "Command ${i}" ;
    cmd:description "Generated command ${i}" ;
    cmd:hasArgument cmd:arg${i}a, cmd:arg${i}b .`);
        
        largeOntologyParts.push(`
cmd:arg${i}a a cmd:Argument ;
    rdfs:label "Argument ${i}A" ;
    cmd:type "string" ;
    cmd:required true .`);
        
        largeOntologyParts.push(`
cmd:arg${i}b a cmd:Argument ;
    rdfs:label "Argument ${i}B" ;
    cmd:type "number" ;
    cmd:required false .`);
      }

      const largeOntology = largeOntologyParts.join('\n');
      
      const simpleTemplate = `
// Generated command: {{ command.name }}
export const {{ command.name | camelCase }}Command = {
  name: '{{ command.name | kebabCase }}',
  description: '{{ command.description }}',
  args: [
    {% for arg in command.arguments %}
    { name: '{{ arg.name }}', type: '{{ arg.type }}', required: {{ arg.required }} },
    {% endfor %}
  ]
};
`;

      const projectConfig: ProjectConfig = {
        name: 'large-cli',
        version: '1.0.0',
        description: 'Large CLI performance test',
        output: {
          directory: join(projectDir, 'large-output')
        },
        templates: {
          directory: join(projectDir, 'large-templates')
        },
        ontology: {
          files: [join(projectDir, 'large.ttl')]
        }
      };

      await writeFile(join(projectDir, 'large.ttl'), largeOntology);
      await mkdir(join(projectDir, 'large-templates'), { recursive: true });
      await writeFile(join(projectDir, 'large-templates/command.njk'), simpleTemplate);

      const startTime = performance.now();
      const result = await engine.generateProject(projectConfig);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(100); // Should generate 100 command files
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in <5 seconds
    });

    it('should handle concurrent generations', async () => {
      const ontologyContent = `
@prefix cmd: <http://example.org/commands#> .
cmd:ConcurrentCommand a cmd:Command ;
    rdfs:label "Concurrent Test" ;
    cmd:hasArgument cmd:testArg .
cmd:testArg a cmd:Argument ;
    cmd:type "string" .
`;

      const template = 'export const {{ command.name | camelCase }}Command = "{{ command.name }}";';

      // Create multiple project configurations
      const projects = Array.from({ length: 5 }, (_, i) => ({
        name: `concurrent-cli-${i}`,
        version: '1.0.0',
        description: `Concurrent test ${i}`,
        output: {
          directory: join(projectDir, `concurrent-output-${i}`)
        },
        templates: {
          directory: join(projectDir, 'concurrent-templates')
        },
        ontology: {
          files: [join(projectDir, 'concurrent.ttl')]
        }
      } as ProjectConfig));

      await writeFile(join(projectDir, 'concurrent.ttl'), ontologyContent);
      await mkdir(join(projectDir, 'concurrent-templates'), { recursive: true });
      await writeFile(join(projectDir, 'concurrent-templates/command.njk'), template);

      const startTime = performance.now();
      const results = await Promise.all(
        projects.map(config => engine.generateProject(config))
      );
      const endTime = performance.now();

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      expect(endTime - startTime).toBeLessThan(3000); // Should complete concurrently in <3 seconds
    });
  });

  // Helper function to check if file exists
  async function fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
});
