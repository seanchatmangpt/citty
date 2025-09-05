/**
 * Weaver Forge JavaScript Reference Implementation for Citty Pro
 * 
 * This implements the core concepts from OpenTelemetry Weaver Forge
 * adapted for JavaScript CLI generation with semantic conventions.
 * 
 * Architecture:
 * 1. Schema Resolution - Parse YAML semantic conventions
 * 2. Context Building - Apply JQ-style filters and transformations
 * 3. Template Rendering - Use Jinja2-compatible templates
 * 4. Code Generation - Output production-ready CLI code
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import nunjucks from 'nunjucks';
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { trace, metrics } from '@opentelemetry/api';
import consola from 'consola';

// Semantic convention types based on OpenTelemetry specs
export interface SemanticConvention {
  groups: ConventionGroup[];
  _registry?: {
    namespace?: string;
    version?: string;
  };
}

export interface ConventionGroup {
  id: string;
  type: 'span' | 'event' | 'metric' | 'resource' | 'scope';
  brief: string;
  note?: string;
  prefix?: string;
  extends?: string;
  stability?: 'stable' | 'experimental' | 'deprecated';
  deprecated?: string;
  attributes: ConventionAttribute[];
  constraints?: ConventionConstraint[];
}

export interface ConventionAttribute {
  id: string;
  type: 'string' | 'int' | 'double' | 'boolean' | 'string[]' | 'int[]' | 'double[]' | 'boolean[]';
  brief: string;
  examples?: any[];
  requirement_level: 'required' | 'conditionally_required' | 'recommended' | 'opt_in';
  stability?: 'stable' | 'experimental' | 'deprecated';
  deprecated?: string;
  note?: string;
  tag?: string;
}

export interface ConventionConstraint {
  any_of?: string[];
  include?: string;
}

export interface WeaverConfig {
  schema_url?: string;
  excluded_namespaces?: string[];
  text_maps?: Record<string, any>;
  template_syntax?: {
    block_start?: string;
    block_end?: string;
    variable_start?: string;
    variable_end?: string;
  };
}

export interface GenerationContext {
  root_namespace: string;
  version: string;
  groups: ConventionGroup[];
  attributes: ConventionAttribute[];
  metrics?: any[];
  ctx?: any;
}

export interface TemplateFilter {
  (data: any): any;
}

/**
 * Core Weaver Forge implementation for JavaScript
 */
export class WeaverForgeJS {
  private config: WeaverConfig;
  private env: nunjucks.Environment;
  private conventions: Map<string, SemanticConvention> = new Map();
  private filters: Map<string, TemplateFilter> = new Map();
  private tracer = trace.getTracer('weaver-forge-js');
  private meter = metrics.getMeter('weaver-forge-js');

  constructor(config: WeaverConfig = {}) {
    this.config = config;
    this.setupNunjucks();
    this.registerBuiltinFilters();
  }

  /**
   * Setup Nunjucks environment with custom configuration
   */
  private setupNunjucks(): void {
    const syntax = this.config.template_syntax || {};
    
    this.env = nunjucks.configure({ 
      autoescape: false,
      tags: {
        blockStart: syntax.block_start || '{%',
        blockEnd: syntax.block_end || '%}',
        variableStart: syntax.variable_start || '{{',
        variableEnd: syntax.variable_end || '}}',
      }
    });

    // Add debug function for template debugging
    this.env.addGlobal('debug', (obj: any, label?: string) => {
      consola.info(`Debug${label ? ` (${label})` : ''}:`, obj);
      return '';
    });
  }

  /**
   * Register built-in JQ-style filters
   */
  private registerBuiltinFilters(): void {
    // Group by filter (similar to JQ's group_by)
    this.filters.set('group_by', (array: any[], key: string) => {
      const groups: Record<string, any[]> = {};
      for (const item of array) {
        const groupKey = this.getNestedValue(item, key);
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
      }
      return Object.entries(groups).map(([key, value]) => ({ key, items: value }));
    });

    // Filter by attribute
    this.filters.set('select', (array: any[], condition: string) => {
      return array.filter(item => this.evaluateCondition(item, condition));
    });

    // Map values
    this.filters.set('map', (array: any[], expression: string) => {
      return array.map(item => this.evaluateExpression(item, expression));
    });

    // Sort by key
    this.filters.set('sort_by', (array: any[], key: string) => {
      return [...array].sort((a, b) => {
        const aVal = this.getNestedValue(a, key);
        const bVal = this.getNestedValue(b, key);
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    });

    // Register filters with Nunjucks
    for (const [name, filter] of this.filters) {
      this.env.addFilter(name, filter);
    }

    // Add additional CLI-specific filters
    this.env.addFilter('camelCase', (str: string) => 
      str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    );
    
    this.env.addFilter('kebabCase', (str: string) => 
      str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
    );
    
    this.env.addFilter('snakeCase', (str: string) => 
      str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    );
  }

  /**
   * Load semantic conventions from YAML files
   */
  async loadConventions(schemaPath: string): Promise<SemanticConvention> {
    return this.tracer.startActiveSpan('load-conventions', async (span) => {
      try {
        span.setAttributes({
          'weaver.schema_path': schemaPath,
          'weaver.operation': 'load_conventions'
        });

        let conventions: SemanticConvention;

        if (schemaPath.endsWith('.yaml') || schemaPath.endsWith('.yml')) {
          const content = await readFile(schemaPath, 'utf-8');
          conventions = parseYaml(content) as SemanticConvention;
        } else {
          // Load from directory
          conventions = await this.loadConventionDirectory(schemaPath);
        }

        // Store in cache
        this.conventions.set(schemaPath, conventions);
        
        span.setStatus({ code: 1 }); // OK
        return conventions;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Load conventions from a directory structure
   */
  private async loadConventionDirectory(dirPath: string): Promise<SemanticConvention> {
    const files = await readdir(dirPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    const conventions: SemanticConvention = { groups: [] };
    
    for (const file of yamlFiles) {
      const filePath = join(dirPath, file);
      const content = await readFile(filePath, 'utf-8');
      const fileConventions = parseYaml(content) as SemanticConvention;
      
      if (fileConventions.groups) {
        conventions.groups.push(...fileConventions.groups);
      }
      
      if (fileConventions._registry) {
        conventions._registry = { ...conventions._registry, ...fileConventions._registry };
      }
    }
    
    return conventions;
  }

  /**
   * Generate code from conventions using templates
   */
  async generateFromTemplate(
    templatePath: string,
    conventions: SemanticConvention,
    outputPath: string,
    context: Partial<GenerationContext> = {}
  ): Promise<void> {
    return this.tracer.startActiveSpan('generate-from-template', async (span) => {
      try {
        span.setAttributes({
          'weaver.template_path': templatePath,
          'weaver.output_path': outputPath,
          'weaver.groups_count': conventions.groups.length
        });

        // Build generation context
        const ctx = this.buildContext(conventions, context);
        
        // Load and render template
        const template = await readFile(templatePath, 'utf-8');
        const rendered = this.env.renderString(template, ctx);
        
        // Ensure output directory exists
        await mkdir(dirname(outputPath), { recursive: true });
        
        // Write generated file
        await writeFile(outputPath, rendered, 'utf-8');
        
        consola.success(`Generated ${outputPath} from ${templatePath}`);
        
        span.setStatus({ code: 1 }); // OK
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Build context for template rendering
   */
  private buildContext(
    conventions: SemanticConvention,
    additionalContext: Partial<GenerationContext> = {}
  ): GenerationContext {
    // Extract attributes from all groups
    const allAttributes: ConventionAttribute[] = [];
    for (const group of conventions.groups) {
      allAttributes.push(...(group.attributes || []));
    }

    return {
      root_namespace: conventions._registry?.namespace || 'citty',
      version: conventions._registry?.version || '1.0.0',
      groups: conventions.groups,
      attributes: allAttributes,
      ctx: {
        groups: conventions.groups,
        attributes: allAttributes,
        ...additionalContext.ctx,
      },
      ...additionalContext,
    };
  }

  /**
   * Generate CLI from semantic conventions
   */
  async generateCLI(
    conventions: SemanticConvention,
    outputDir: string,
    options: {
      packageName?: string;
      version?: string;
      description?: string;
      author?: string;
      includeOTel?: boolean;
      includeTests?: boolean;
    } = {}
  ): Promise<void> {
    const {
      packageName = 'generated-cli',
      version = '1.0.0',
      description = 'Generated CLI from semantic conventions',
      author = 'Citty Pro',
      includeOTel = true,
      includeTests = true,
    } = options;

    // Create output directory
    await mkdir(outputDir, { recursive: true });

    // Generate package.json
    const packageJson = {
      name: packageName,
      version,
      description,
      author,
      type: "module",
      bin: {
        [packageName]: "./dist/cli.js"
      },
      scripts: {
        build: "tsc",
        dev: `node --loader ts-node/esm src/cli.ts`,
        start: "node dist/cli.js",
        test: includeTests ? "vitest" : undefined,
        "test:coverage": includeTests ? "vitest --coverage" : undefined,
      },
      dependencies: {
        "citty": "^0.1.6",
        "consola": "^3.4.0",
        ...(includeOTel && {
          "@opentelemetry/api": "^1.8.0",
          "@opentelemetry/sdk-node": "^0.49.1",
          "@opentelemetry/auto-instrumentations-node": "^0.41.0",
        }),
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        "typescript": "^5.4.0",
        ...(includeTests && {
          "vitest": "^1.4.0",
          "@vitest/coverage-v8": "^1.4.0",
        }),
      }
    };

    await writeFile(
      join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Generate TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "node",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        outDir: "./dist",
        rootDir: "./src",
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "test"]
    };

    await writeFile(
      join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2),
      'utf-8'
    );

    // Generate CLI structure from conventions
    await this.generateCLIFromConventions(conventions, outputDir, {
      includeOTel,
      includeTests,
      packageName
    });

    consola.success(`Generated complete CLI package in ${outputDir}`);
  }

  /**
   * Generate CLI structure from semantic conventions
   */
  private async generateCLIFromConventions(
    conventions: SemanticConvention,
    outputDir: string,
    options: {
      includeOTel: boolean;
      includeTests: boolean;
      packageName: string;
    }
  ): Promise<void> {
    const srcDir = join(outputDir, 'src');
    const commandsDir = join(srcDir, 'commands');
    
    await mkdir(srcDir, { recursive: true });
    await mkdir(commandsDir, { recursive: true });

    // Generate main CLI file
    const cliTemplate = `#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
${options.includeOTel ? `import './instrumentation.js';` : ''}
import consola from 'consola';

const main = defineCommand({
  meta: {
    name: '${options.packageName}',
    description: 'CLI generated from semantic conventions',
    version: '1.0.0'
  },
  subCommands: {
    ${conventions.groups.map(group => 
      `${group.id.replace(/[.-]/g, '_')}: () => import('./commands/${group.id.replace(/[.-]/g, '_')}.js').then(r => r.default)`
    ).join(',\n    ')}
  }
});

runMain(main);
`;

    await writeFile(join(srcDir, 'cli.ts'), cliTemplate, 'utf-8');

    // Generate commands from convention groups
    for (const group of conventions.groups) {
      await this.generateCommandFromGroup(group, commandsDir);
    }

    // Generate OpenTelemetry instrumentation if requested
    if (options.includeOTel) {
      const instrumentationTemplate = `import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
`;

      await writeFile(join(srcDir, 'instrumentation.ts'), instrumentationTemplate, 'utf-8');
    }

    // Generate tests if requested
    if (options.includeTests) {
      const testDir = join(outputDir, 'test');
      await mkdir(testDir, { recursive: true });
      
      for (const group of conventions.groups) {
        await this.generateTestFromGroup(group, testDir);
      }
    }
  }

  /**
   * Generate a command file from a convention group
   */
  private async generateCommandFromGroup(group: ConventionGroup, commandsDir: string): Promise<void> {
    const commandName = group.id.replace(/[.-]/g, '_');
    
    const commandTemplate = `import { defineCommand } from 'citty';
import consola from 'consola';

export default defineCommand({
  meta: {
    name: '${group.id}',
    description: '${group.brief}',
    ${group.deprecated ? `deprecated: '${group.deprecated}',` : ''}
  },
  args: {
    ${group.attributes?.map(attr => this.generateArgFromAttribute(attr)).join(',\n    ') || ''}
  },
  run({ args }) {
    consola.info('Executing ${group.id} command');
    consola.log('Arguments:', args);
    
    // TODO: Implement ${group.id} logic
    ${group.note ? `// Note: ${group.note}` : ''}
  }
});
`;

    await writeFile(join(commandsDir, `${commandName}.ts`), commandTemplate, 'utf-8');
  }

  /**
   * Generate command argument from semantic convention attribute
   */
  private generateArgFromAttribute(attr: ConventionAttribute): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'int': 'number', 
      'double': 'number',
      'boolean': 'boolean',
      'string[]': 'string',
      'int[]': 'string',
      'double[]': 'string',
      'boolean[]': 'string'
    };

    const argName = attr.id.split('.').pop() || attr.id;
    
    return `${argName.replace(/[.-]/g, '_')}: {
      type: '${typeMap[attr.type] || 'string'}',
      description: '${attr.brief}',
      required: ${attr.requirement_level === 'required'},
      ${attr.examples && attr.examples.length > 0 ? `default: ${JSON.stringify(attr.examples[0])},` : ''}
      ${attr.deprecated ? `deprecated: '${attr.deprecated}',` : ''}
    }`;
  }

  /**
   * Generate test file from convention group
   */
  private async generateTestFromGroup(group: ConventionGroup, testDir: string): Promise<void> {
    const commandName = group.id.replace(/[.-]/g, '_');
    
    const testTemplate = `import { describe, it, expect } from 'vitest';
import ${commandName}Command from '../src/commands/${commandName}.js';

describe('${group.id} command', () => {
  it('should be defined', () => {
    expect(${commandName}Command).toBeDefined();
    expect(${commandName}Command.meta.name).toBe('${group.id}');
  });

  it('should have correct metadata', () => {
    expect(${commandName}Command.meta.description).toBe('${group.brief}');
  });

  ${group.attributes?.map(attr => {
    const argName = attr.id.split('.').pop()?.replace(/[.-]/g, '_') || attr.id;
    return `it('should have ${argName} argument', () => {
    expect(${commandName}Command.args.${argName}).toBeDefined();
    expect(${commandName}Command.args.${argName}.description).toBe('${attr.brief}');
  });`;
  }).join('\n\n  ') || ''}
});
`;

    await writeFile(join(testDir, `${commandName}.test.ts`), testTemplate, 'utf-8');
  }

  /**
   * Utility methods for expression evaluation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(item: any, condition: string): boolean {
    // Simple condition evaluation (extend as needed)
    const [path, operator, value] = condition.split(/\s*(==|!=|>|<|>=|<=)\s/);
    const itemValue = this.getNestedValue(item, path);
    
    switch (operator) {
      case '==': return itemValue == value;
      case '!=': return itemValue != value;
      case '>': return itemValue > value;
      case '<': return itemValue < value;
      case '>=': return itemValue >= value;
      case '<=': return itemValue <= value;
      default: return true;
    }
  }

  private evaluateExpression(item: any, expression: string): any {
    // Simple expression evaluation (extend as needed)
    return this.getNestedValue(item, expression);
  }
}

export default WeaverForgeJS;