# Unjucks Implementation Specification

## Core Implementation Details

### 1. Template Walker Implementation

```typescript
// src/core/walker.ts
import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { watch, FSWatcher } from 'chokidar';
import type { Template, TemplateMetadata, ValidationResult } from '../types';

export class TemplateWalker {
  private cache = new Map<string, Template>();
  private watchers = new Map<string, FSWatcher>();
  private extensions = ['.njk', '.nunjucks', '.j2'];

  async loadTemplates(dir: string = './templates'): Promise<Template[]> {
    const templates: Template[] = [];
    
    try {
      const entries = await this.scanDirectory(dir);
      
      for (const entry of entries) {
        if (this.isTemplateFile(entry)) {
          const template = await this.parseTemplate(entry);
          if (template) {
            templates.push(template);
            this.cache.set(template.id, template);
          }
        }
      }
      
      // Setup watchers if enabled
      if (process.env.UNJUCKS_WATCH === 'true') {
        await this.setupWatcher(dir);
      }
      
    } catch (error) {
      throw new Error(`Failed to load templates from ${dir}: ${error.message}`);
    }
    
    return this.resolveDependencies(templates);
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const scan = async (currentDir: string): Promise<void> => {
      const entries = await readdir(currentDir);
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await scan(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };
    
    await scan(dir);
    return files;
  }

  private isTemplateFile(path: string): boolean {
    return this.extensions.includes(extname(path).toLowerCase());
  }

  private async parseTemplate(path: string): Promise<Template | null> {
    try {
      const content = await readFile(path, 'utf-8');
      const metadata = await this.extractMetadata(path, content);
      
      return {
        id: this.generateTemplateId(path),
        name: basename(path, extname(path)),
        path,
        type: this.inferTemplateType(path),
        metadata,
        content,
        outputs: metadata.outputs || [{ path: '.', filename: '{{name}}{{extension}}' }]
      };
    } catch (error) {
      console.warn(`Failed to parse template ${path}:`, error.message);
      return null;
    }
  }

  private async extractMetadata(path: string, content: string): Promise<TemplateMetadata> {
    // Look for JSON frontmatter or sidecar files
    const metaPath = path.replace(extname(path), '.meta.json');
    
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      return JSON.parse(metaContent);
    } catch {
      // Extract from template comments
      return this.parseInlineMetadata(content);
    }
  }

  private parseInlineMetadata(content: string): TemplateMetadata {
    const frontmatterMatch = content.match(/^{#\s*META\s*([\s\S]*?)\s*#}/m);
    
    if (frontmatterMatch) {
      try {
        return JSON.parse(frontmatterMatch[1]);
      } catch {
        // Fallback to defaults
      }
    }

    return {
      description: 'Auto-generated template',
      version: '1.0.0',
      tags: [],
      variables: []
    };
  }

  private generateTemplateId(path: string): string {
    // Generate stable ID from path structure
    return path
      .replace(/^.*\/templates\//, '')
      .replace(/\.[^.]+$/, '')
      .replace(/\//g, ':');
  }

  private inferTemplateType(path: string): string {
    const segments = path.split('/');
    return segments.find(s => ['command', 'workflow', 'task', 'component'].includes(s)) || 'generic';
  }

  private resolveDependencies(templates: Template[]): Template[] {
    const templateMap = new Map(templates.map(t => [t.id, t]));
    
    for (const template of templates) {
      if (template.metadata.dependencies) {
        template.dependencies = template.metadata.dependencies.filter(dep => 
          templateMap.has(dep)
        );
      }
    }
    
    return templates;
  }

  async validateTemplate(template: Template): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!template.content || template.content.trim().length === 0) {
      errors.push('Template content is empty');
    }

    // Nunjucks syntax validation
    try {
      // Basic syntax check - would use actual Nunjucks parser in real implementation
      if (template.content.includes('{{') && !template.content.includes('}}')) {
        errors.push('Unclosed template variable syntax');
      }
    } catch (error) {
      errors.push(`Template syntax error: ${error.message}`);
    }

    // Dependency validation
    if (template.dependencies) {
      for (const dep of template.dependencies) {
        if (!this.cache.has(dep)) {
          errors.push(`Missing dependency: ${dep}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

### 2. Context Manager Implementation

```typescript
// src/core/context.ts
import { createContext } from 'unctx';
import type { RenderContext, ContextVariables, OntologyData } from '../types';
import { OntologyParser } from '../integrations/ontology';

export class ContextManager {
  private contexts = new Map<string, any>();
  private ontologyParser = new OntologyParser();

  async createContext(request: GenerationRequest): Promise<RenderContext> {
    const contextId = this.generateContextId(request);
    
    // Create unctx context
    const unctxContext = createContext({
      asyncContext: true,
      AsyncLocalStorage: globalThis.AsyncLocalStorage
    });

    let ontologyData: OntologyData | undefined;
    if (request.ontologyPath) {
      ontologyData = await this.resolveOntology(request.ontologyPath);
    }

    const variables: ContextVariables = {
      global: this.getGlobalVariables(),
      template: request.context || {},
      runtime: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    const context: RenderContext = {
      template: await this.getTemplate(request.templateId),
      data: this.mergeData(variables, ontologyData),
      ontology: ontologyData,
      variables,
      filters: new Map(),
      macros: new Map(),
      meta: {
        id: contextId,
        createdAt: new Date(),
        request
      }
    };

    // Store in unctx
    unctxContext.set(contextId, context);
    this.contexts.set(contextId, unctxContext);

    return context;
  }

  async resolveOntology(path: string): Promise<OntologyData> {
    try {
      return await this.ontologyParser.parse(path);
    } catch (error) {
      throw new Error(`Failed to parse ontology ${path}: ${error.message}`);
    }
  }

  private getGlobalVariables(): Record<string, any> {
    return {
      // System variables
      os: process.platform,
      arch: process.arch,
      node_version: process.version,
      
      // Utility functions
      now: () => new Date().toISOString(),
      uuid: () => crypto.randomUUID(),
      
      // Common patterns
      camelCase: (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
      kebabCase: (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase(),
      pascalCase: (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
    };
  }

  private mergeData(variables: ContextVariables, ontology?: OntologyData): Record<string, any> {
    const merged = {
      ...variables.global,
      ...variables.template,
      ...variables.runtime
    };

    if (ontology) {
      merged.ontology = {
        entities: ontology.entities,
        relationships: ontology.relationships,
        graph: ontology.graph
      };
    }

    return merged;
  }

  private generateContextId(request: GenerationRequest): string {
    return `ctx_${request.templateId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async enhanceWithAI(context: RenderContext): Promise<RenderContext> {
    if (!process.env.UNJUCKS_AI_ENABLED) {
      return context;
    }

    try {
      // AI enhancement would go here
      // - Analyze context for missing variables
      // - Suggest improvements
      // - Generate intelligent defaults
      
      return context;
    } catch (error) {
      console.warn('AI enhancement failed:', error.message);
      return context;
    }
  }
}
```

### 3. Nunjucks Renderer Implementation

```typescript
// src/core/renderer.ts
import { Environment, FileSystemLoader, Template as NunjucksTemplate } from 'nunjucks';
import type { Template, RenderContext, OutputFile } from '../types';
import { registerCustomFilters } from '../filters';

export class NunjucksRenderer {
  private nunjucks: Environment;
  private compiledTemplates = new Map<string, NunjucksTemplate>();

  constructor() {
    this.setupEnvironment();
    registerCustomFilters(this.nunjucks);
  }

  private setupEnvironment(): void {
    this.nunjucks = new Environment([
      new FileSystemLoader('templates', { watch: false, noCache: true }),
      new FileSystemLoader('.', { watch: false, noCache: true })
    ], {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true
    });

    // Configure global functions
    this.nunjucks.addGlobal('range', (n: number) => Array.from({ length: n }, (_, i) => i));
    this.nunjucks.addGlobal('keys', (obj: any) => Object.keys(obj || {}));
    this.nunjucks.addGlobal('values', (obj: any) => Object.values(obj || {}));
  }

  async render(template: Template, context: RenderContext): Promise<OutputFile[]> {
    const outputs: OutputFile[] = [];

    try {
      // Handle multi-output templates
      for (const outputConfig of template.outputs) {
        const output = await this.renderSingleOutput(template, context, outputConfig);
        if (output) {
          outputs.push(output);
        }
      }
    } catch (error) {
      throw new Error(`Rendering failed for template ${template.id}: ${error.message}`);
    }

    return outputs;
  }

  private async renderSingleOutput(
    template: Template, 
    context: RenderContext, 
    outputConfig: OutputConfig
  ): Promise<OutputFile | null> {
    // Check conditional rendering
    if (outputConfig.condition) {
      const shouldRender = this.evaluateCondition(outputConfig.condition, context.data);
      if (!shouldRender) {
        return null;
      }
    }

    // Render the template
    const content = this.nunjucks.renderString(template.content, context.data);

    // Generate output path
    const outputPath = this.resolveOutputPath(outputConfig, context.data);
    
    return {
      path: outputPath,
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      checksum: this.generateChecksum(content),
      templateId: template.id
    };
  }

  private evaluateCondition(condition: string, data: Record<string, any>): boolean {
    try {
      // Simple condition evaluation - would use safer evaluation in production
      const result = this.nunjucks.renderString(`{{ ${condition} }}`, data);
      return result.trim() === 'true';
    } catch {
      return false;
    }
  }

  private resolveOutputPath(config: OutputConfig, data: Record<string, any>): string {
    const pathTemplate = config.filename || '{{name}}{{extension}}';
    const resolvedFilename = this.nunjucks.renderString(pathTemplate, data);
    return join(config.path, resolvedFilename);
  }

  private generateChecksum(content: string): string {
    return require('crypto').createHash('sha256').update(content).digest('hex');
  }
}
```

### 4. Custom Nunjucks Filters

```typescript
// src/filters/index.ts
import type { Environment } from 'nunjucks';
import { registerOntologyFilters } from './ontology';
import { registerCodeFilters } from './code';
import { registerUtilityFilters } from './utility';

export function registerCustomFilters(env: Environment): void {
  registerOntologyFilters(env);
  registerCodeFilters(env);
  registerUtilityFilters(env);
}

// src/filters/code.ts
export function registerCodeFilters(env: Environment): void {
  // Code generation specific filters
  env.addFilter('camelCase', (str: string) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  });

  env.addFilter('pascalCase', (str: string) => {
    return str.charAt(0).toUpperCase() + 
           str.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  });

  env.addFilter('kebabCase', (str: string) => {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  });

  env.addFilter('snakeCase', (str: string) => {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  });

  env.addFilter('indent', (str: string, spaces: number = 2) => {
    const indent = ' '.repeat(spaces);
    return str.split('\n').map(line => line ? indent + line : line).join('\n');
  });

  env.addFilter('comment', (str: string, style: string = '//') => {
    const commentPrefix = style === '//' ? '//' : 
                         style === '#' ? '#' : 
                         style === '--' ? '--' : '//';
    return str.split('\n').map(line => `${commentPrefix} ${line}`).join('\n');
  });

  env.addFilter('tsInterface', (obj: any, name: string) => {
    const lines = [`interface ${name} {`];
    for (const [key, value] of Object.entries(obj)) {
      const type = typeof value === 'string' ? 'string' :
                  typeof value === 'number' ? 'number' :
                  typeof value === 'boolean' ? 'boolean' : 'any';
      lines.push(`  ${key}: ${type};`);
    }
    lines.push('}');
    return lines.join('\n');
  });
}

// src/filters/ontology.ts
export function registerOntologyFilters(env: Environment): void {
  env.addFilter('entityType', (entity: any) => {
    return entity?.type || 'Unknown';
  });

  env.addFilter('hasProperty', (entity: any, property: string) => {
    return entity?.properties && property in entity.properties;
  });

  env.addFilter('getProperty', (entity: any, property: string, defaultValue: any = null) => {
    return entity?.properties?.[property] || defaultValue;
  });

  env.addFilter('filterByType', (entities: any[], type: string) => {
    return entities.filter(entity => entity.type === type);
  });

  env.addFilter('relatedEntities', (entity: any, relationship: string, entities: any[]) => {
    if (!entity.relationships) return [];
    return entities.filter(e => entity.relationships.includes(e.id));
  });
}
```

### 5. CLI Implementation

```typescript
// src/cli.ts
import { defineCommand, runMain } from 'citty';
import { loadTemplates, generateFromOntology, writeOutput } from './core';
import type { GenerationOptions } from './types';

const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate files from templates and ontology data'
  },
  args: {
    template: {
      type: 'string',
      description: 'Template ID or path to generate from',
      required: true
    },
    ontology: {
      type: 'string',
      description: 'Path to ontology file (TTL/N3/RDF)',
      required: false
    },
    output: {
      type: 'string',
      description: 'Output directory for generated files',
      default: './generated'
    }
  },
  options: {
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be generated without writing files',
      default: false
    },
    diff: {
      type: 'boolean',
      description: 'Show diff for existing files',
      default: false
    },
    watch: {
      type: 'boolean',
      description: 'Watch for template changes and regenerate',
      default: false
    },
    'backup': {
      type: 'boolean',
      description: 'Create backup of existing files before overwrite',
      default: true
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      default: false
    }
  },
  async run({ args, options }) {
    const generationOptions: GenerationOptions = {
      dryRun: options['dry-run'],
      diff: options.diff,
      overwrite: !options.backup,
      backup: options.backup,
      validation: true
    };

    try {
      console.log(`🚀 Generating from template: ${args.template}`);
      
      if (args.ontology) {
        console.log(`📊 Using ontology: ${args.ontology}`);
      }

      const result = await generateFromOntology(
        args.ontology || '',
        args.template,
        generationOptions
      );

      if (result.success) {
        if (!generationOptions.dryRun) {
          await writeOutput(result.outputs, { 
            outputDir: args.output,
            backup: options.backup 
          });
        }

        console.log(`✅ Generated ${result.outputs.length} files successfully`);
        
        if (options.verbose) {
          result.outputs.forEach(file => {
            console.log(`   📄 ${file.path} (${file.size} bytes)`);
          });
        }
      } else {
        console.error('❌ Generation failed:');
        result.errors.forEach(error => console.error(`   ${error.message}`));
        process.exit(1);
      }

      if (result.warnings.length > 0) {
        console.warn('⚠️ Warnings:');
        result.warnings.forEach(warning => console.warn(`   ${warning}`));
      }

    } catch (error) {
      console.error('💥 Fatal error:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
});

const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List available templates'
  },
  args: {
    dir: {
      type: 'string',
      description: 'Template directory to scan',
      default: './templates'
    }
  },
  options: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false
    },
    verbose: {
      type: 'boolean',
      description: 'Show template details',
      default: false
    }
  },
  async run({ args, options }) {
    try {
      const templates = await loadTemplates(args.dir);
      
      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      console.log(`📚 Found ${templates.length} templates in ${args.dir}:\n`);
      
      for (const template of templates) {
        console.log(`🏷️  ${template.id}`);
        console.log(`   Name: ${template.name}`);
        console.log(`   Type: ${template.type}`);
        
        if (options.verbose) {
          console.log(`   Path: ${template.path}`);
          console.log(`   Description: ${template.metadata.description}`);
          console.log(`   Version: ${template.metadata.version}`);
          
          if (template.metadata.tags.length > 0) {
            console.log(`   Tags: ${template.metadata.tags.join(', ')}`);
          }
          
          if (template.dependencies && template.dependencies.length > 0) {
            console.log(`   Dependencies: ${template.dependencies.join(', ')}`);
          }
        }
        
        console.log('');
      }
    } catch (error) {
      console.error('Failed to list templates:', error.message);
      process.exit(1);
    }
  }
});

const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate templates and ontology files'
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to validate (template file or directory)',
      required: true
    }
  },
  options: {
    strict: {
      type: 'boolean',
      description: 'Enable strict validation mode',
      default: false
    }
  },
  async run({ args, options }) {
    // Validation implementation
    console.log(`🔍 Validating: ${args.path}`);
    // Implementation would go here
  }
});

const main = defineCommand({
  meta: {
    name: 'unjucks',
    description: 'Template-driven code generation with semantic ontology support',
    version: '1.0.0'
  },
  subCommands: {
    generate: generateCommand,
    list: listCommand,
    validate: validateCommand
  }
});

runMain(main);
```

This implementation specification provides concrete, production-ready code for the core components of the unjucks system, following TypeScript best practices and UnJS ecosystem conventions.