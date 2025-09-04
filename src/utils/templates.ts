import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import nunjucks from "nunjucks";
import yaml from "yaml";

// Embed template strings directly to avoid file path issues in build
export const ONTOLOGY_DEFINITIONS = `# Citty CLI Ontology Templates

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix citty: <http://example.org/citty#> .
@prefix cmd: <http://example.org/citty/command#> .
@prefix arg: <http://example.org/citty/argument#> .
@prefix type: <http://example.org/citty/type#> .`;

export const COMMAND_TEMPLATE = `import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "{{ command.name }}",
    description: "{{ command.description }}",
    version: "{{ command.version | default('1.0.0') }}"
  },
  run({ args }) {
    console.log("Running {{ command.name }} with args:", args);
  }
});`;

export const MAIN_COMMAND_TEMPLATE = `import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "{{ command.name }}",
    description: "{{ command.description }}",
    version: "{{ command.version | default('1.0.0') }}"
  }
});

runMain(main);`;

// Keep the prefixes as a string for now
export const ONTOLOGY_PREFIXES = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix citty: <http://example.org/citty#> .
@prefix cmd: <http://example.org/citty/command#> .
@prefix arg: <http://example.org/citty/argument#> .
@prefix type: <http://example.org/citty/type#> .
`;

/**
 * Template context for Weaver Forge
 */
export interface TemplateContext {
  name: string;
  description: string;
  version?: string;
  author?: string;
  license?: string;
  repository?: string;
  commands?: Array<{
    name: string;
    description: string;
    args: any[];
  }>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  includeOpenTelemetry?: boolean;
  includeTests?: boolean;
  includeDocs?: boolean;
}

/**
 * Weaver Forge integration for semantic convention-based code generation
 * Based on OpenTelemetry Weaver Forge (https://github.com/open-telemetry/weaver)
 */
class WeaverForge {
  private templates: Map<string, string> = new Map();
  private semanticConventions: Map<string, any> = new Map();
  
  constructor() {
    this.initializeTemplates();
    this.loadSemanticConventions();
  }
  
  /**
   * Initialize built-in templates
   */
  private initializeTemplates() {
    // Package.json template
    this.templates.set('package.json', `{
  "name": "{{ name }}",
  "version": "{{ version | default('1.0.0') }}",
  "description": "{{ description }}",
  {%- if author %}
  "author": "{{ author }}",
  {%- endif %}
  "license": "{{ license | default('MIT') }}",
  {%- if repository %}
  "repository": "{{ repository }}",
  {%- endif %}
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "{{ name }}": "./bin/cli.js"
  },
  "scripts": {{ scripts | dump(2) }},
  "dependencies": {{ dependencies | dump(2) }},
  "devDependencies": {{ devDependencies | dump(2) }}
}`);
    
    // Main CLI entry point template
    this.templates.set('src/cli.ts', `#!/usr/bin/env node
import { runMain } from "citty";
{%- if includeOpenTelemetry %}
import "./utils/telemetry.js";
{%- endif %}
import { commands } from "./commands/index.js";
import { logger } from "./utils/logger.js";

const main = {
  meta: {
    name: "{{ name }}",
    description: "{{ description }}",
    version: "{{ version | default('1.0.0') }}",
  },
  subCommands: commands,
};

runMain(main).catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});`);
    
    // Commands index template
    this.templates.set('src/commands/index.ts', `{%- for command in commands %}
import {{ command.name }}Command from "./{{ command.name }}.js";
{%- endfor %}

export const commands = {
  {%- for command in commands %}
  {{ command.name }}: {{ command.name }}Command,
  {%- endfor %}
};`);
    
    // Logger utility template
    this.templates.set('src/utils/logger.ts', `import consola from "consola";

export const logger = consola.create({
  defaults: {
    tag: "{{ name }}",
  },
});

export default logger;`);
    
    // OpenTelemetry setup template
    this.templates.set('src/utils/telemetry.ts', `import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ConsoleSpanExporter } from "@opentelemetry/exporter-console";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "{{ name }}",
    [SemanticResourceAttributes.SERVICE_VERSION]: "{{ version | default('1.0.0') }}",
  }),
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": {
        enabled: true,
      },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown()
    .then(() => console.log("Telemetry terminated"))
    .catch((error) => console.error("Error terminating telemetry", error))
    .finally(() => process.exit(0));
});`);
    
    // TypeScript config template
    this.templates.set('tsconfig.json', `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}`);
    
    // Vitest config template
    this.templates.set('vitest.config.ts', `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist",
        "test",
        "*.config.*",
      ],
    },
  },
});`);
    
    // README template
    this.templates.set('README.md', `# {{ name }}

{{ description }}

## Installation

\`\`\`bash
npm install -g {{ name }}
\`\`\`

## Usage

\`\`\`bash
{{ name }} --help
\`\`\`

## Commands

{%- for command in commands %}
### {{ command.name }}

{{ command.description }}

\`\`\`bash
{{ name }} {{ command.name }} [options]
\`\`\`

{%- endfor %}

## Development

\`\`\`bash
# Install dependencies
{{ packageManager | default('npm') }} install

# Run in development mode
{{ packageManager | default('npm') }} run dev

# Run tests
{{ packageManager | default('npm') }} test

# Build for production
{{ packageManager | default('npm') }} run build
\`\`\`

{%- if includeOpenTelemetry %}
## Observability

This CLI includes OpenTelemetry instrumentation for observability.
Traces are exported to the console by default.
{%- endif %}

## License

{{ license | default('MIT') }}
`);
    
    // Bin wrapper template
    this.templates.set('bin/cli.js', `#!/usr/bin/env node
import "../dist/cli.js";`);
    
    // .gitignore template
    this.templates.set('.gitignore', `node_modules/
dist/
*.log
.DS_Store
.env
.env.*
coverage/
*.tgz`);
  }
  
  /**
   * Load OpenTelemetry semantic conventions
   */
  private loadSemanticConventions() {
    // Load semantic conventions for CLI operations
    this.semanticConventions.set('cli.command', {
      prefix: 'cli',
      attributes: [
        { id: 'cli.command.name', type: 'string', brief: 'The name of the CLI command' },
        { id: 'cli.command.args', type: 'string[]', brief: 'Arguments passed to the command' },
        { id: 'cli.command.exit_code', type: 'int', brief: 'Exit code of the command' },
      ],
    });
    
    this.semanticConventions.set('cli.execution', {
      prefix: 'cli.execution',
      attributes: [
        { id: 'cli.execution.duration', type: 'double', brief: 'Duration of command execution in milliseconds' },
        { id: 'cli.execution.error', type: 'boolean', brief: 'Whether the command resulted in an error' },
        { id: 'cli.execution.error_message', type: 'string', brief: 'Error message if execution failed' },
      ],
    });
  }
  
  /**
   * Generate a project using templates and context
   */
  generateProject(templateName: string, outputDir: string, context: TemplateContext): void {
    // Configure nunjucks
    const env = nunjucks.configure({ autoescape: false });
    
    // Generate each template file
    const filesToGenerate = [
      'package.json',
      'tsconfig.json',
      'README.md',
      '.gitignore',
      'bin/cli.js',
      'src/cli.ts',
      'src/commands/index.ts',
      'src/utils/logger.ts',
    ];
    
    if (context.includeOpenTelemetry) {
      filesToGenerate.push('src/utils/telemetry.ts');
    }
    
    if (context.includeTests) {
      filesToGenerate.push('vitest.config.ts');
    }
    
    // Create directories and generate files
    for (const file of filesToGenerate) {
      const template = this.templates.get(file);
      if (!template) continue;
      
      const filePath = join(outputDir, file);
      const dir = dirname(filePath);
      
      // Ensure directory exists
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // Render template
      const content = env.renderString(template, {
        ...context,
        packageManager: context.scripts ? Object.keys(context.scripts)[0].split(' ')[0] : 'npm',
      });
      
      // Write file
      writeFileSync(filePath, content, 'utf8');
    }
  }
  
  /**
   * Generate code from semantic conventions
   */
  generateFromSemanticConvention(conventionName: string, context: any): string {
    const convention = this.semanticConventions.get(conventionName);
    if (!convention) {
      throw new Error(`Semantic convention '${conventionName}' not found`);
    }
    
    // Generate TypeScript interface from convention
    const interfaceName = conventionName.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
    
    let code = `// Generated from semantic convention: ${conventionName}\n`;
    code += `export interface ${interfaceName}Attributes {\n`;
    
    for (const attr of convention.attributes) {
      const tsType = this.mapSemanticTypeToTS(attr.type);
      const propName = attr.id.split('.').pop();
      code += `  /** ${attr.brief} */\n`;
      code += `  ${propName}?: ${tsType};\n`;
    }
    
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Map semantic convention types to TypeScript
   */
  private mapSemanticTypeToTS(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'string[]': 'string[]',
      'int': 'number',
      'double': 'number',
      'boolean': 'boolean',
    };
    return typeMap[type] || 'any';
  }
  
  /**
   * Load custom templates from YAML definition
   */
  loadTemplatesFromYaml(yamlContent: string): void {
    const config = yaml.parse(yamlContent);
    
    if (config.templates) {
      for (const [name, template] of Object.entries(config.templates)) {
        this.templates.set(name, template as string);
      }
    }
    
    if (config.conventions) {
      for (const [name, convention] of Object.entries(config.conventions)) {
        this.semanticConventions.set(name, convention);
      }
    }
  }
}

// Export singleton instance
export const weaverForge = new WeaverForge();
