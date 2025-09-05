import nunjucks from 'nunjucks';
import { promises as fs } from 'fs';
import { dirname, basename, extname, resolve } from 'path';
import { glob } from 'glob';
import { TemplateContext, TemplateRenderError } from '../types.js';

export class TemplateEngine {
  private environment: nunjucks.Environment;
  private templateCache: Map<string, string>;

  constructor(templatePaths: string[] = ['./templates']) {
    this.templateCache = new Map();
    
    // Configure Nunjucks environment
    this.environment = nunjucks.configure(templatePaths, {
      autoescape: false,
      throwOnUndefined: true,
      trimBlocks: true,
      lstripBlocks: true,
      cache: true,
    });
    
    this.registerCustomFilters();
    this.registerCustomFunctions();
  }

  private registerCustomFilters(): void {
    // URI manipulation filters
    this.environment.addFilter('localName', (uri: string) => {
      if (typeof uri !== 'string') return uri;
      return uri.split(/[#\/]/).pop() || uri;
    });

    this.environment.addFilter('namespace', (uri: string) => {
      if (typeof uri !== 'string') return uri;
      const lastSlash = uri.lastIndexOf('/');
      const lastHash = uri.lastIndexOf('#');
      const separator = Math.max(lastSlash, lastHash);
      return separator > 0 ? uri.substring(0, separator + 1) : uri;
    });

    this.environment.addFilter('prefix', (uri: string, context: TemplateContext) => {
      if (typeof uri !== 'string') return uri;
      
      for (const [prefix, namespace] of context.ontology.prefixes) {
        if (uri.startsWith(namespace)) {
          return `${prefix}:${uri.substring(namespace.length)}`;
        }
      }
      return uri;
    });

    // String manipulation filters
    this.environment.addFilter('camelCase', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([-_\s]+(.)?)/g, (_, __, letter) => 
        letter ? letter.toUpperCase() : ''
      );
    });

    this.environment.addFilter('pascalCase', (str: string) => {
      if (typeof str !== 'string') return str;
      const camelCase = str.replace(/([-_\s]+(.)?)/g, (_, __, letter) => 
        letter ? letter.toUpperCase() : ''
      );
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    this.environment.addFilter('snakeCase', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([A-Z])/g, '_$1')
        .replace(/[-\s]+/g, '_')
        .toLowerCase()
        .replace(/^_/, '');
    });

    this.environment.addFilter('kebabCase', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([A-Z])/g, '-$1')
        .replace(/[-_\s]+/g, '-')
        .toLowerCase()
        .replace(/^-/, '');
    });

    // Collection filters
    this.environment.addFilter('unique', (arr: any[]) => {
      if (!Array.isArray(arr)) return arr;
      return [...new Set(arr)];
    });

    this.environment.addFilter('sortBy', (arr: any[], property: string) => {
      if (!Array.isArray(arr)) return arr;
      return arr.sort((a, b) => {
        const aVal = a[property];
        const bVal = b[property];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    });

    // Ontology-specific filters
    this.environment.addFilter('superClasses', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getClassHierarchy(classUri, context).slice(1) : [];
    });

    this.environment.addFilter('properties', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getProperties(classUri, context) : [];
    });

    this.environment.addFilter('instances', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getInstances(classUri, context) : [];
    });

    this.environment.addFilter('label', (uri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getLabel(uri, context) : uri;
    });

    this.environment.addFilter('comment', (uri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getComment(uri, context) : null;
    });

    // Advanced ontology filters
    this.environment.addFilter('subClasses', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getSubClasses(classUri, context) : [];
    });

    this.environment.addFilter('objectProperties', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getObjectProperties(classUri, context) : [];
    });

    this.environment.addFilter('dataProperties', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getDataProperties(classUri, context) : [];
    });

    this.environment.addFilter('restrictions', (classUri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getRestrictions(classUri, context) : [];
    });

    this.environment.addFilter('annotations', (uri: string, context: TemplateContext) => {
      const bridge = (context as any).__bridge;
      return bridge ? bridge.getAnnotations(uri, context) : [];
    });

    // Code generation filters
    this.environment.addFilter('javaClass', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.split(/[#\/]/).pop()?.replace(/[^a-zA-Z0-9]/g, '') || str;
    });

    this.environment.addFilter('pythonClass', (str: string) => {
      if (typeof str !== 'string') return str;
      const className = str.split(/[#\/]/).pop()?.replace(/[^a-zA-Z0-9]/g, '') || str;
      return className.charAt(0).toUpperCase() + className.slice(1);
    });

    this.environment.addFilter('sqlTable', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.split(/[#\/]/).pop()?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || str;
    });

    this.environment.addFilter('jsonSchema', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.split(/[#\/]/).pop()?.replace(/[^a-zA-Z0-9]/g, '') || str;
    });

    // Utility filters
    this.environment.addFilter('md5', (str: string) => {
      if (typeof str !== 'string') return str;
      const crypto = require('crypto');
      return crypto.createHash('md5').update(str).digest('hex');
    });

    this.environment.addFilter('sha256', (str: string) => {
      if (typeof str !== 'string') return str;
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(str).digest('hex');
    });

    this.environment.addFilter('base64', (str: string) => {
      if (typeof str !== 'string') return str;
      return Buffer.from(str).toString('base64');
    });

    this.environment.addFilter('slug', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    });

    this.environment.addFilter('truncate', (str: string, length: number = 50, suffix: string = '...') => {
      if (typeof str !== 'string') return str;
      if (str.length <= length) return str;
      return str.substring(0, length) + suffix;
    });

    this.environment.addFilter('capitalize', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    });

    this.environment.addFilter('pluralize', (str: string, count?: number) => {
      if (typeof str !== 'string') return str;
      if (count === 1) return str;
      
      // Simple pluralization rules
      if (str.endsWith('y')) {
        return str.slice(0, -1) + 'ies';
      }
      if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
        return str + 'es';
      }
      return str + 's';
    });

    // Mathematical filters
    this.environment.addFilter('sum', (arr: number[]) => {
      if (!Array.isArray(arr)) return 0;
      return arr.reduce((sum, num) => sum + (typeof num === 'number' ? num : 0), 0);
    });

    this.environment.addFilter('avg', (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      const sum = arr.reduce((sum, num) => sum + (typeof num === 'number' ? num : 0), 0);
      return sum / arr.length;
    });

    this.environment.addFilter('min', (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      return Math.min(...arr.filter(n => typeof n === 'number'));
    });

    this.environment.addFilter('max', (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      return Math.max(...arr.filter(n => typeof n === 'number'));
    });
  }

  private registerCustomFunctions(): void {
    // SPARQL query function
    this.environment.addGlobal('query', async (sparql: string, context: TemplateContext) => {
      return await context.query(sparql);
    });

    // Filter function
    this.environment.addGlobal('filter', (predicate: string, object: string | undefined, context: TemplateContext) => {
      return context.filter(predicate, object);
    });

    // Namespace resolver
    this.environment.addGlobal('ns', (prefix: string, context: TemplateContext) => {
      return context.namespace(prefix);
    });

    // Utility functions
    this.environment.addGlobal('now', () => new Date().toISOString());
    
    this.environment.addGlobal('uuid', () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    });

    // Advanced utility functions
    this.environment.addGlobal('timestamp', () => Date.now());
    
    this.environment.addGlobal('formatDate', (date: Date | string, format: string = 'yyyy-MM-dd') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!(d instanceof Date) || isNaN(d.getTime())) return '';
      
      return format
        .replace('yyyy', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('dd', d.getDate().toString().padStart(2, '0'))
        .replace('HH', d.getHours().toString().padStart(2, '0'))
        .replace('mm', d.getMinutes().toString().padStart(2, '0'))
        .replace('ss', d.getSeconds().toString().padStart(2, '0'));
    });

    this.environment.addGlobal('range', (start: number, end?: number, step: number = 1) => {
      if (end === undefined) {
        end = start;
        start = 0;
      }
      const result = [];
      for (let i = start; i < end; i += step) {
        result.push(i);
      }
      return result;
    });

    this.environment.addGlobal('enumerate', (arr: any[]) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item, index) => ({ index, item }));
    });

    this.environment.addGlobal('groupBy', (arr: any[], key: string) => {
      if (!Array.isArray(arr)) return {};
      return arr.reduce((groups, item) => {
        const groupKey = item[key];
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
        return groups;
      }, {});
    });

    this.environment.addGlobal('flatten', (arr: any[], depth: number = 1) => {
      if (!Array.isArray(arr)) return arr;
      return depth > 0 ? arr.flat(depth) : arr.flat();
    });

    this.environment.addGlobal('zip', (...arrays: any[][]) => {
      const minLength = Math.min(...arrays.map(arr => arr.length));
      const result = [];
      for (let i = 0; i < minLength; i++) {
        result.push(arrays.map(arr => arr[i]));
      }
      return result;
    });

    // String manipulation functions
    this.environment.addGlobal('repeat', (str: string, count: number) => {
      if (typeof str !== 'string' || typeof count !== 'number') return str;
      return str.repeat(Math.max(0, count));
    });

    this.environment.addGlobal('pad', (str: string, length: number, char: string = ' ') => {
      if (typeof str !== 'string') return str;
      return str.padStart(length, char);
    });

    this.environment.addGlobal('reverse', (arr: any[]) => {
      if (!Array.isArray(arr)) return arr;
      return [...arr].reverse();
    });

    // SPARQL-like functions
    this.environment.addGlobal('str', (value: any) => String(value));
    this.environment.addGlobal('lang', (literal: string) => {
      const match = literal.match(/@([a-zA-Z-]+)$/);
      return match ? match[1] : '';
    });
    this.environment.addGlobal('datatype', (literal: string) => {
      const match = literal.match(/\^\^<(.+)>$/);
      return match ? match[1] : '';
    });

    // Math functions
    this.environment.addGlobal('abs', Math.abs);
    this.environment.addGlobal('ceil', Math.ceil);
    this.environment.addGlobal('floor', Math.floor);
    this.environment.addGlobal('round', (num: number, decimals: number = 0) => {
      const factor = Math.pow(10, decimals);
      return Math.round(num * factor) / factor;
    });
    this.environment.addGlobal('random', () => Math.random());
    this.environment.addGlobal('randomInt', (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    });
  }

  async render(templatePath: string, context: TemplateContext): Promise<string> {
    try {
      // Load template content
      let templateContent = this.templateCache.get(templatePath);
      
      if (!templateContent) {
        templateContent = await fs.readFile(templatePath, 'utf-8');
        this.templateCache.set(templatePath, templateContent);
      }
      
      // Add template metadata to context
      const enhancedContext = {
        ...context,
        __template: {
          path: templatePath,
          name: basename(templatePath),
          dir: dirname(templatePath),
          ext: extname(templatePath),
        },
      };
      
      // Render template
      return this.environment.renderString(templateContent, enhancedContext);
      
    } catch (error) {
      throw new TemplateRenderError(
        `Failed to render template: ${error instanceof Error ? error.message : String(error)}`,
        templatePath,
        context
      );
    }
  }

  async renderFromString(template: string, context: TemplateContext): Promise<string> {
    try {
      return this.environment.renderString(template, context);
    } catch (error) {
      throw new TemplateRenderError(
        `Failed to render template string: ${error instanceof Error ? error.message : String(error)}`,
        '<string>',
        context
      );
    }
  }

  async discoverTemplates(patterns: string[]): Promise<string[]> {
    const allTemplates = new Set<string>();
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, { absolute: true });
      matches.forEach(match => allTemplates.add(match));
    }
    
    return Array.from(allTemplates).sort();
  }

  clearCache(): void {
    this.templateCache.clear();
    this.environment.opts.cache = false;
    this.environment.opts.cache = true; // Reset cache
  }

  async validateTemplate(templatePath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };
    
    try {
      // Check if file exists
      await fs.access(templatePath);
      
      // Load and parse template
      const content = await fs.readFile(templatePath, 'utf-8');
      
      // Basic syntax validation by attempting to compile
      try {
        this.environment.compile(content, {
          filename: templatePath,
        });
      } catch (compileError) {
        result.valid = false;
        result.errors.push(`Template compilation failed: ${compileError instanceof Error ? compileError.message : String(compileError)}`);
      }
      
      // Check for common issues
      this.validateTemplateContent(content, result);
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Cannot read template file: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return result;
  }

  private validateTemplateContent(content: string, result: { errors: string[]; warnings: string[] }): void {
    // Check for unmatched brackets
    const openBrackets = (content.match(/\{\{/g) || []).length;
    const closeBrackets = (content.match(/\}\}/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      result.errors.push(`Unmatched template brackets: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Check for unmatched blocks
    const blockStarts = content.match(/\{%\s*(\w+)/g) || [];
    const blockEnds = content.match(/\{%\s*end(\w+)/g) || [];
    
    const startBlocks = blockStarts.map(match => {
      const blockMatch = match.match(/\{%\s*(\w+)/);
      return blockMatch ? blockMatch[1] : '';
    }).filter(Boolean);
    
    const endBlocks = blockEnds.map(match => {
      const blockMatch = match.match(/\{%\s*end(\w+)/);
      return blockMatch ? blockMatch[1] : '';
    }).filter(Boolean);
    
    // Check if all start blocks have corresponding end blocks
    const blockCounts = new Map<string, number>();
    
    for (const block of startBlocks) {
      blockCounts.set(block, (blockCounts.get(block) || 0) + 1);
    }
    
    for (const block of endBlocks) {
      const count = blockCounts.get(block) || 0;
      if (count === 0) {
        result.errors.push(`Unmatched end block: ${block}`);
      } else {
        blockCounts.set(block, count - 1);
      }
    }
    
    for (const [block, count] of blockCounts) {
      if (count > 0) {
        result.errors.push(`Unmatched start block: ${block} (${count} unclosed)`);
      }
    }
    
    // Check for potentially undefined variables
    const variables = content.match(/\{\{\s*([^}|\s]+)/g) || [];
    const undefinedWarnings = new Set<string>();
    
    for (const variable of variables) {
      const varName = variable.replace(/\{\{\s*/, '').split(/[.\[\|]/)[0];
      if (varName && !['loop', 'super', 'self'].includes(varName)) {
        undefinedWarnings.add(varName);
      }
    }
    
    if (undefinedWarnings.size > 0) {
      result.warnings.push(`Variables that might be undefined: ${Array.from(undefinedWarnings).join(', ')}`);
    }
  }

  getTemplateInfo(templatePath: string): {
    variables: string[];
    filters: string[];
    blocks: string[];
    includes: string[];
    extends: string | null;
  } {
    const content = this.templateCache.get(templatePath) || '';
    
    const variables = [...new Set((content.match(/\{\{\s*([^}|\s]+)/g) || [])
      .map(match => match.replace(/\{\{\s*/, '').split(/[.\[\|]/)[0])
      .filter(Boolean))];
    
    const filters = [...new Set((content.match(/\|\s*(\w+)/g) || [])
      .map(match => match.replace(/\|\s*/, '')))];
    
    const blocks = [...new Set((content.match(/\{%\s*block\s+(\w+)/g) || [])
      .map(match => {
        const blockMatch = match.match(/\{%\s*block\s+(\w+)/);
        return blockMatch ? blockMatch[1] : '';
      })
      .filter(Boolean))];
    
    const includes = [...new Set((content.match(/\{%\s*include\s+['"](.*)['"]/g) || [])
      .map(match => {
        const includeMatch = match.match(/\{%\s*include\s+['"](.*)['"]/);
        return includeMatch ? includeMatch[1] : '';
      })
      .filter(Boolean))];
    
    const extendsMatch = content.match(/\{%\s*extends\s+['"](.*)['"]/);
    const extends_ = extendsMatch ? extendsMatch[1] : null;
    
    return {
      variables,
      filters,
      blocks,
      includes,
      extends: extends_,
    };
  }
}