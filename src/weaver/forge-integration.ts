/**
 * Weaver Forge Integration for Citty
 * 
 * Integrates Weaver Forge for semantic convention-based code generation:
 * - Parse semantic conventions from YAML
 * - Generate CLI commands from conventions  
 * - Create OpenTelemetry instrumentation from semantic attributes
 * - Use Jinja2 templates for code generation
 * - Support multi-target output (TypeScript, Go, Rust)
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { existsSync } from 'node:fs';

// Types for semantic conventions
export interface SemanticConventionAttribute {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'boolean[]';
  brief: string;
  examples?: string[] | string | number | boolean;
  requirement_level: 'required' | 'conditionally_required' | 'recommended' | 'opt_in';
  stability?: 'stable' | 'experimental' | 'deprecated';
  deprecated?: string;
  note?: string;
  tag?: string;
  prefix?: string;
  namespace?: string;
}

export interface SemanticConventionRegistry {
  groups: SemanticConventionGroup[];
  attributes: SemanticConventionAttribute[];
  metrics?: SemanticConventionMetric[];
  resource_attributes?: SemanticConventionAttribute[];
}

export interface SemanticConventionGroup {
  id: string;
  type: 'span' | 'event' | 'metric' | 'resource' | 'scope';
  brief: string;
  note?: string;
  prefix?: string;
  extends?: string;
  stability?: 'stable' | 'experimental' | 'deprecated';
  deprecated?: string;
  attributes: SemanticConventionAttribute[];
  constraints?: Array<{
    any_of?: string[];
    include?: string;
  }>;
}

export interface SemanticConventionMetric {
  id: string;
  type: 'counter' | 'histogram' | 'gauge' | 'updowncounter';
  brief: string;
  instrument: string;
  unit: string;
  stability?: 'stable' | 'experimental' | 'deprecated';
  deprecated?: string;
  attributes?: SemanticConventionAttribute[];
}

// JQ Filter types
export interface JQFilter {
  name: string;
  query: string;
  options?: {
    exclude_namespaces?: string[];
    include_stability?: ('stable' | 'experimental' | 'deprecated')[];
    include_deprecated?: boolean;
  };
}

// Template configuration
export interface TemplateConfig {
  template: string;
  filter?: string;
  application_mode: 'single' | 'each';
  output?: string;
  parameters?: Record<string, any>;
}

export interface WeaverForgeConfig {
  text_maps?: Record<string, Record<string, string>>;
  templates: TemplateConfig[];
  default_prefix?: string;
  whitespace_control?: {
    trim_blocks?: boolean;
    lstrip_blocks?: boolean;
  };
  params?: Record<string, any>;
}

// Custom Jinja filters for semantic conventions
export const SemanticConventionFilters = {
  /**
   * Convert to snake_case
   */
  snakeCase(value: string): string {
    return value
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  },

  /**
   * Convert to camelCase
   */
  camelCase(value: string): string {
    return value
      .split(/[_\-\s]+/)
      .map((word, index) => 
        index === 0 ? word.toLowerCase() : 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  },

  /**
   * Convert to PascalCase
   */
  pascalCase(value: string): string {
    return value
      .split(/[_\-\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  },

  /**
   * Convert to kebab-case
   */
  kebabCase(value: string): string {
    return value
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  },

  /**
   * Convert to SCREAMING_SNAKE_CASE
   */
  constantCase(value: string): string {
    return this.snakeCase(value).toUpperCase();
  },

  /**
   * Generate TypeScript type from semantic convention attribute
   */
  toTypeScriptType(attribute: SemanticConventionAttribute): string {
    switch (attribute.type) {
      case 'string': {
        return 'string';
      }
      case 'number': {
        return 'number';
      }
      case 'boolean': {
        return 'boolean';
      }
      case 'string[]': {
        return 'string[]';
      }
      case 'number[]': {
        return 'number[]';
      }
      case 'boolean[]': {
        return 'boolean[]';
      }
      default: {
        return 'unknown';
      }
    }
  },

  /**
   * Generate Go type from semantic convention attribute
   */
  toGoType(attribute: SemanticConventionAttribute): string {
    switch (attribute.type) {
      case 'string': {
        return 'string';
      }
      case 'number': {
        return 'float64';
      }
      case 'boolean': {
        return 'bool';
      }
      case 'string[]': {
        return '[]string';
      }
      case 'number[]': {
        return '[]float64';
      }
      case 'boolean[]': {
        return '[]bool';
      }
      default: {
        return 'interface{}';
      }
    }
  },

  /**
   * Generate Rust type from semantic convention attribute
   */
  toRustType(attribute: SemanticConventionAttribute): string {
    switch (attribute.type) {
      case 'string': {
        return 'String';
      }
      case 'number': {
        return 'f64';
      }
      case 'boolean': {
        return 'bool';
      }
      case 'string[]': {
        return 'Vec<String>';
      }
      case 'number[]': {
        return 'Vec<f64>';
      }
      case 'boolean[]': {
        return 'Vec<bool>';
      }
      default: {
        return 'serde_json::Value';
      }
    }
  },

  /**
   * Generate documentation comment
   */
  toDocComment(brief: string, note?: string, examples?: any): string[] {
    const lines = [brief];
    
    if (note) {
      lines.push('', note);
    }
    
    if (examples) {
      lines.push('', 'Examples:');
      const exampleList = Array.isArray(examples) ? examples : [examples];
      for (const example of exampleList) lines.push(`  - ${example}`);
    }
    
    return lines;
  },

  /**
   * Sort attributes by requirement level and name
   */
  sortAttributes(attributes: SemanticConventionAttribute[]): SemanticConventionAttribute[] {
    const levelOrder = { required: 0, conditionally_required: 1, recommended: 2, opt_in: 3 };
    
    return [...attributes].sort((a, b) => {
      const levelDiff = levelOrder[a.requirement_level] - levelOrder[b.requirement_level];
      return levelDiff === 0 ? a.id.localeCompare(b.id) : levelDiff;
    });
  },

  /**
   * Filter attributes by stability
   */
  filterByStability(
    attributes: SemanticConventionAttribute[],
    include: ('stable' | 'experimental' | 'deprecated')[]
  ): SemanticConventionAttribute[] {
    return attributes.filter(attr => 
      !attr.stability || include.includes(attr.stability)
    );
  },

  /**
   * Group attributes by namespace
   */
  groupByNamespace(attributes: SemanticConventionAttribute[]): Record<string, SemanticConventionAttribute[]> {
    return attributes.reduce((groups, attr) => {
      const namespace = attr.namespace || attr.prefix || 'default';
      if (!groups[namespace]) {
        groups[namespace] = [];
      }
      groups[namespace].push(attr);
      return groups;
    }, {} as Record<string, SemanticConventionAttribute[]>);
  },
};

/**
 * JQ-like data transformation engine for semantic conventions
 */
export class JQProcessor {
  private filters: Map<string, JQFilter> = new Map();

  constructor() {
    this.registerDefaultFilters();
  }

  private registerDefaultFilters(): void {
    // Group attributes by their semantic group
    this.filters.set('semconv_grouped_attributes', {
      name: 'semconv_grouped_attributes',
      query: 'group_by(.prefix // .namespace // "default") | map({key: .[0].prefix // .[0].namespace // "default", value: .})'
    });

    // Filter stable attributes only
    this.filters.set('stable_attributes', {
      name: 'stable_attributes',
      query: 'map(select(.stability == "stable" or .stability == null))'
    });

    // Group metrics by type
    this.filters.set('metrics_by_type', {
      name: 'metrics_by_type',
      query: 'group_by(.type) | map({key: .[0].type, value: .})'
    });

    // Extract required attributes
    this.filters.set('required_attributes', {
      name: 'required_attributes',
      query: 'map(select(.requirement_level == "required"))'
    });

    // Sort attributes by name
    this.filters.set('sorted_attributes', {
      name: 'sorted_attributes',
      query: 'sort_by(.id)'
    });
  }

  registerFilter(filter: JQFilter): void {
    this.filters.set(filter.name, filter);
  }

  async applyFilter(data: any, filterName: string): Promise<any> {
    const filter = this.filters.get(filterName);
    if (!filter) {
      throw new Error(`Filter '${filterName}' not found`);
    }

    return this.executeJQQuery(data, filter);
  }

  private async executeJQQuery(data: any, filter: JQFilter): Promise<any> {
    // Simplified JQ-like processing
    // In a full implementation, you'd use a proper JQ library
    switch (filter.name) {
      case 'semconv_grouped_attributes': {
        if (Array.isArray(data)) {
          const grouped = data.reduce((acc, item) => {
            const key = item.prefix || item.namespace || 'default';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
          }, {});
          return Object.entries(grouped).map(([key, value]) => ({ key, value }));
        }
        return data;
      }

      case 'stable_attributes': {
        if (Array.isArray(data)) {
          return data.filter(item => !item.stability || item.stability === 'stable');
        }
        return data;
      }

      case 'metrics_by_type': {
        if (Array.isArray(data)) {
          const grouped = data.reduce((acc, item) => {
            const key = item.type || 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
          }, {});
          return Object.entries(grouped).map(([key, value]) => ({ key, value }));
        }
        return data;
      }

      case 'required_attributes': {
        if (Array.isArray(data)) {
          return data.filter(item => item.requirement_level === 'required');
        }
        return data;
      }

      case 'sorted_attributes': {
        if (Array.isArray(data)) {
          return [...data].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }
        return data;
      }

      default: {
        return data;
      }
    }
  }
}

/**
 * Template processor using Jinja2-like syntax
 */
export class TemplateProcessor {
  private jqProcessor: JQProcessor;
  private config: WeaverForgeConfig;

  constructor(config: WeaverForgeConfig) {
    this.jqProcessor = new JQProcessor();
    this.config = config;
  }

  async processTemplate(templatePath: string, data: any, outputPath: string): Promise<void> {
    const templateContent = await readFile(templatePath, 'utf-8');
    const processedData = data;
    
    // Apply JQ filter if specified in template config
    const templateConfig = this.config.templates.find(t => 
      t.template === basename(templatePath)
    );
    
    let filteredData = processedData;
    if (templateConfig?.filter) {
      filteredData = await this.jqProcessor.applyFilter(processedData, templateConfig.filter);
    }

    const rendered = await this.renderTemplate(templateContent, filteredData, templateConfig?.parameters);
    
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered);
  }

  private async renderTemplate(template: string, data: any, params?: Record<string, any>): Promise<string> {
    // Simplified template rendering - in production you'd use a proper Jinja2 library
    let rendered = template;
    
    // Replace simple variables {{ variable }}
    rendered = rendered.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value === undefined ? match : String(value);
    });

    // Replace loops {% for item in items %}...{% endfor %}
    rendered = rendered.replace(
      /\{%\s*for\s+(\w+)\s+in\s+(\w+(?:\.\w+)*)\s*%\}(.*?)\{%\s*endfor\s*%\}/gs,
      (match, itemVar, arrayPath, loopBody) => {
        const array = this.getNestedValue(data, arrayPath);
        if (!Array.isArray(array)) return match;
        
        return array.map(item => {
          return loopBody.replace(
            new RegExp(`\\{\\{\\s*${itemVar}(?:\\.(\\w+))?\\s*\\}\\}`, 'g'),
            (innerMatch: string, prop: string) => {
              const value = prop ? item[prop] : item;
              return value === undefined ? innerMatch : String(value);
            }
          );
        }).join('');
      }
    );

    // Apply custom filters {{ value | filter }}
    rendered = rendered.replace(
      /\{\{\s*(\w+(?:\.\w+)*)\s*\|\s*(\w+)\s*\}\}/g,
      (match, path, filterName) => {
        const value = this.getNestedValue(data, path);
        if (value === undefined) return match;
        
        const filterMethod = (SemanticConventionFilters as any)[filterName];
        if (typeof filterMethod === 'function') {
          return String(filterMethod(value));
        }
        
        return String(value);
      }
    );

    return rendered;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }
}

/**
 * Main Weaver Forge integration class
 */
export class WeaverForge {
  private templateProcessor: TemplateProcessor;
  private jqProcessor: JQProcessor;
  private config: WeaverForgeConfig;
  private registryPath: string;

  constructor(configPath: string, registryPath: string) {
    this.registryPath = registryPath;
    this.jqProcessor = new JQProcessor();
    // Config will be loaded in init()
    this.config = { templates: [] };
    this.templateProcessor = new TemplateProcessor(this.config);
  }

  async initialize(): Promise<void> {
    // Load configuration
    try {
      const configContent = await readFile(join(this.registryPath, 'weaver.yaml'), 'utf-8');
      this.config = parseYaml(configContent) as WeaverForgeConfig;
      this.templateProcessor = new TemplateProcessor(this.config);
    } catch {
      console.warn('No weaver.yaml found, using default configuration');
      this.config = this.getDefaultConfig();
      this.templateProcessor = new TemplateProcessor(this.config);
    }
  }

  async loadSemanticConventions(): Promise<SemanticConventionRegistry> {
    const registry: SemanticConventionRegistry = {
      groups: [],
      attributes: [],
      metrics: [],
      resource_attributes: []
    };

    // Load all YAML files from the registry
    await this.loadYamlFilesRecursively(this.registryPath, registry);
    
    return registry;
  }

  private async loadYamlFilesRecursively(
    dir: string,
    registry: SemanticConventionRegistry
  ): Promise<void> {
    if (!existsSync(dir)) {
      throw new Error(`Registry path does not exist: ${dir}`);
    }

    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        await this.loadYamlFilesRecursively(fullPath, registry);
      } else if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
        await this.loadYamlFile(fullPath, registry);
      }
    }
  }

  private async loadYamlFile(
    filePath: string,
    registry: SemanticConventionRegistry
  ): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = parseYaml(content);
      
      if (data.groups) {
        registry.groups.push(...data.groups);
      }
      
      if (data.attributes) {
        registry.attributes.push(...data.attributes);
      }
      
      if (data.metrics) {
        registry.metrics!.push(...data.metrics);
      }
      
      if (data.resource_attributes) {
        registry.resource_attributes!.push(...data.resource_attributes);
      }
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error);
    }
  }

  async generateCode(outputDir: string): Promise<void> {
    const registry = await this.loadSemanticConventions();
    
    for (const templateConfig of this.config.templates) {
      const templatePath = join(this.registryPath, 'templates', templateConfig.template);
      
      if (!existsSync(templatePath)) {
        console.warn(`Template not found: ${templatePath}`);
        continue;
      }

      if (templateConfig.application_mode === 'single') {
        const outputPath = join(outputDir, templateConfig.output || templateConfig.template.replace('.j2', ''));
        await this.templateProcessor.processTemplate(templatePath, registry, outputPath);
      } else {
        // Process each group separately
        for (const group of registry.groups) {
          const outputPath = join(
            outputDir,
            templateConfig.output?.replace('{group}', group.id) || 
            `${group.id}_${templateConfig.template.replace('.j2', '')}`
          );
          await this.templateProcessor.processTemplate(templatePath, { group, registry }, outputPath);
        }
      }
    }
  }

  async generateCLICommands(outputDir: string): Promise<void> {
    const registry = await this.loadSemanticConventions();
    
    // Generate CLI commands from semantic convention groups
    for (const group of registry.groups) {
      const commandName = SemanticConventionFilters.kebabCase(group.id.replace(/\./g, '-'));
      const outputPath = join(outputDir, `${commandName}.ts`);
      
      await this.generateCLICommand(group, outputPath);
    }
  }

  private async generateCLICommand(group: SemanticConventionGroup, outputPath: string): Promise<void> {
    const commandName = SemanticConventionFilters.camelCase(group.id.replace(/\./g, ''));
    const commandArgs = group.attributes
      .filter(attr => attr.requirement_level === 'required')
      .map(attr => this.generateArgDefinition(attr))
      .join(',\n    ');

    const commandContent = `
import { defineCommand } from '../index';

export const ${commandName}Command = defineCommand({
  meta: {
    name: '${SemanticConventionFilters.kebabCase(group.id)}',
    description: '${group.brief}',
  },
  args: {
    ${commandArgs}
  },
  async run({ args }) {
    // Implementation for ${group.brief}
    console.log('Executing ${group.id} with args:', args);
    
    // Add your semantic convention implementation here
    ${this.generateImplementationStub(group)}
  },
});
`.trim();

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, commandContent);
  }

  private generateArgDefinition(attr: SemanticConventionAttribute): string {
    const argType = this.mapAttributeToArgType(attr.type);
    const description = attr.brief + (attr.note ? `\n${attr.note}` : '');
    
    return `${SemanticConventionFilters.camelCase(attr.id)}: {
      type: '${argType}',
      description: '${description}',
      ${attr.requirement_level === 'required' ? 'required: true,' : ''}
      ${attr.examples ? `valueHint: '${Array.isArray(attr.examples) ? attr.examples[0] : attr.examples}',` : ''}
    }`;
  }

  private mapAttributeToArgType(semconvType: string): string {
    switch (semconvType) {
      case 'string':
      case 'string[]': {
        return 'string';
      }
      case 'number':
      case 'number[]': {
        return 'number';
      }
      case 'boolean':
      case 'boolean[]': {
        return 'boolean';
      }
      default: {
        return 'string';
      }
    }
  }

  private generateImplementationStub(group: SemanticConventionGroup): string {
    return `
    // OpenTelemetry instrumentation for ${group.id}
    const attributes = {
      ${group.attributes.map(attr => 
        `'${attr.id}': args.${SemanticConventionFilters.camelCase(attr.id)}`
      ).join(',\n      ')}
    };
    
    // Example: Create span with semantic convention attributes
    // const span = tracer.startSpan('${group.id}', { attributes });
    // span.end();
    `.trim();
  }

  private getDefaultConfig(): WeaverForgeConfig {
    return {
      templates: [
        {
          template: 'cli_commands.j2',
          filter: 'semconv_grouped_attributes',
          application_mode: 'each',
          output: 'commands/{group}.ts'
        },
        {
          template: 'otel_attributes.j2',
          filter: 'stable_attributes',
          application_mode: 'single',
          output: 'attributes.ts'
        }
      ],
      whitespace_control: {
        trim_blocks: true,
        lstrip_blocks: true
      }
    };
  }

  /**
   * Generate OpenTelemetry instrumentation from semantic conventions
   */
  async generateOpenTelemetryInstrumentation(outputDir: string): Promise<void> {
    const registry = await this.loadSemanticConventions();
    
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });
    
    // Generate TypeScript OpenTelemetry instrumentation
    const instrumentationContent = this.generateOTelInstrumentation(registry);
    await writeFile(join(outputDir, 'otel-instrumentation.ts'), instrumentationContent);
    
    // Generate attribute constants
    const attributesContent = this.generateAttributeConstants(registry);
    await writeFile(join(outputDir, 'otel-attributes.ts'), attributesContent);
  }

  private generateOTelInstrumentation(registry: SemanticConventionRegistry): string {
    return `
/**
 * OpenTelemetry Instrumentation generated from Semantic Conventions
 */

import { trace, Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SEMANTIC_ATTRIBUTES } from './otel-attributes';

export class SemanticConventionInstrumentation {
  private tracer = trace.getTracer('semantic-convention-instrumentation');

  ${registry.groups.map(group => this.generateGroupInstrumentation(group)).join('\n\n  ')}
}

export const instrumentation = new SemanticConventionInstrumentation();
`.trim();
  }

  private generateGroupInstrumentation(group: SemanticConventionGroup): string {
    const methodName = SemanticConventionFilters.camelCase(group.id);
    const spanKind = this.mapGroupTypeToSpanKind(group.type);
    
    return `
  /**
   * ${group.brief}
   */
  ${methodName}(attributes: {
    ${group.attributes.map(attr => 
      `${SemanticConventionFilters.camelCase(attr.id)}${attr.requirement_level === 'required' ? '' : '?'}: ${SemanticConventionFilters.toTypeScriptType(attr)};`
    ).join('\n    ')}
  }): Span {
    const span = this.tracer.startSpan('${group.id}', {
      kind: ${spanKind},
      attributes: {
        ${group.attributes.map(attr => 
          `[SEMANTIC_ATTRIBUTES.${SemanticConventionFilters.constantCase(attr.id)}]: attributes.${SemanticConventionFilters.camelCase(attr.id)}`
        ).join(',\n        ')}
      }
    });
    
    return span;
  }`.trim();
  }

  private mapGroupTypeToSpanKind(type: string): string {
    switch (type) {
      case 'span': {
        return 'SpanKind.INTERNAL';
      }
      case 'event': {
        return 'SpanKind.INTERNAL';
      }
      default: {
        return 'SpanKind.INTERNAL';
      }
    }
  }

  private generateAttributeConstants(registry: SemanticConventionRegistry): string {
    const allAttributes = [
      ...registry.attributes,
      ...registry.resource_attributes || [],
      ...registry.groups.flatMap(g => g.attributes)
    ];

    return `
/**
 * Semantic Convention Attribute Constants
 */

export const SEMANTIC_ATTRIBUTES = {
  ${allAttributes.map(attr => 
    `${SemanticConventionFilters.constantCase(attr.id)}: '${attr.id}',`
  ).join('\n  ')}
} as const;

export type SemanticAttributeKeys = keyof typeof SEMANTIC_ATTRIBUTES;
export type SemanticAttributeValues = typeof SEMANTIC_ATTRIBUTES[SemanticAttributeKeys];
`.trim();
  }
}