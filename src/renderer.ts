import nunjucks from 'nunjucks';
import { readFileSync } from 'node:fs';
import { dirname } from 'pathe';
import type { TemplateContext, TemplateFilter, TemplateOptions, RenderResult } from './types.js';
import { UnjucksError } from './types.js';
import { useTemplateContext } from './context.js';

/**
 * Built-in filters for common string transformations
 */
const BUILT_IN_FILTERS: Record<string, TemplateFilter> = {
  // Case transformations
  camelCase: (str: string) => {
    return String(str)
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  },

  kebabCase: (str: string) => {
    return String(str)
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
  },

  pascalCase: (str: string) => {
    return String(str)
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
        return word.toUpperCase();
      })
      .replace(/\s+/g, '');
  },

  snakeCase: (str: string) => {
    return String(str)
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  },

  // Pluralization (basic implementation)
  pluralize: (str: string, count?: number) => {
    if (count !== undefined && count === 1) {
      return str;
    }
    
    const word = String(str);
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    } else if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
      return word + 'es';
    } else {
      return word + 's';
    }
  },

  singularize: (str: string) => {
    const word = String(str);
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    } else if (word.endsWith('es') && word.length > 3) {
      return word.slice(0, -2);
    } else if (word.endsWith('s') && word.length > 1) {
      return word.slice(0, -1);
    } else {
      return word;
    }
  },

  // Utilities
  timestamp: () => {
    return new Date().toISOString();
  },

  uuid: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // JSON utilities
  stringify: (obj: any, indent = 2) => {
    return JSON.stringify(obj, null, indent);
  },

  parse: (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  },

  // Array utilities
  first: (arr: any[]) => Array.isArray(arr) ? arr[0] : arr,
  last: (arr: any[]) => Array.isArray(arr) ? arr[arr.length - 1] : arr,
  join: (arr: any[], separator = ', ') => Array.isArray(arr) ? arr.join(separator) : String(arr),

  // String utilities
  truncate: (str: string, length = 100, suffix = '...') => {
    const text = String(str);
    return text.length <= length ? text : text.substring(0, length) + suffix;
  },

  capitalize: (str: string) => {
    const text = String(str);
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  title: (str: string) => {
    return String(str).replace(/\\w\\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
};

/**
 * Template renderer class that wraps Nunjucks
 */
export class TemplateRenderer {
  private env: nunjucks.Environment;
  private customFilters: Record<string, TemplateFilter> = {};

  constructor(options: TemplateOptions = {}) {
    // Configure Nunjucks environment
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader([]), // We'll set paths dynamically
      {
        autoescape: options.autoescape ?? true,
        throwOnUndefined: options.throwOnUndefined ?? true,
        trimBlocks: options.trimBlocks ?? true,
        lstripBlocks: options.lstripBlocks ?? true,
        tags: options.tags
      }
    );

    // Register built-in filters
    this.registerFilters(BUILT_IN_FILTERS);
  }

  /**
   * Registers custom filters
   */
  registerFilters(filters: Record<string, TemplateFilter>): void {
    Object.entries(filters).forEach(([name, filter]) => {
      this.env.addFilter(name, filter);
      this.customFilters[name] = filter;
    });
  }

  /**
   * Registers a single filter
   */
  registerFilter(name: string, filter: TemplateFilter): void {
    this.env.addFilter(name, filter);
    this.customFilters[name] = filter;
  }

  /**
   * Gets all registered filters
   */
  getFilters(): Record<string, TemplateFilter> {
    return { ...BUILT_IN_FILTERS, ...this.customFilters };
  }

  /**
   * Renders a template from file path
   */
  async renderTemplate(
    templatePath: string,
    context?: TemplateContext
  ): Promise<RenderResult> {
    const startTime = Date.now();
    
    try {
      // Use provided context or fall back to template context
      const renderContext = context || this.getMergedContext();
      
      // Read template content
      const templateContent = readFileSync(templatePath, 'utf-8');
      
      // Set up file system loader for includes/extends
      const templateDir = dirname(templatePath);
      const oldOptions = {
        autoescape: true,
        throwOnUndefined: true,
        trimBlocks: true,
        lstripBlocks: true
      };
      this.env = new nunjucks.Environment(
        new nunjucks.FileSystemLoader([templateDir, '.']),
        oldOptions
      );
      
      // Re-register filters after environment recreation
      this.registerFilters({ ...BUILT_IN_FILTERS, ...this.customFilters });
      
      // Render template
      const output = this.env.renderString(templateContent, renderContext);
      
      const duration = Date.now() - startTime;
      
      return {
        output,
        metadata: {
          template: templatePath,
          context: renderContext,
          timestamp: new Date(),
          duration
        }
      };
    } catch (error) {
      throw new UnjucksError(
        `Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RENDER_FAILED',
        { templatePath, error }
      );
    }
  }

  /**
   * Renders a template from string content
   */
  async renderString(
    templateContent: string,
    context?: TemplateContext
  ): Promise<RenderResult> {
    const startTime = Date.now();
    
    try {
      // Use provided context or fall back to template context
      const renderContext = context || this.getMergedContext();
      
      // Render template
      const output = this.env.renderString(templateContent, renderContext);
      
      const duration = Date.now() - startTime;
      
      return {
        output,
        metadata: {
          template: '<string>',
          context: renderContext,
          timestamp: new Date(),
          duration
        }
      };
    } catch (error) {
      throw new UnjucksError(
        `String template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RENDER_FAILED',
        { templateContent: templateContent.substring(0, 100) + '...', error }
      );
    }
  }

  /**
   * Precompiles a template for better performance
   */
  precompileTemplate(templatePath: string): string {
    try {
      const templateContent = readFileSync(templatePath, 'utf-8');
      return nunjucks.precompileString(templateContent, {
        name: templatePath
      });
    } catch (error) {
      throw new UnjucksError(
        `Template precompilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRECOMPILE_FAILED',
        { templatePath, error }
      );
    }
  }

  /**
   * Validates template syntax
   */
  validateTemplate(templateContent: string): boolean {
    try {
      this.env.renderString(templateContent, {});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets merged context from template context
   */
  private getMergedContext(): TemplateContext {
    try {
      return useTemplateContext();
    } catch {
      return {};
    }
  }
}

/**
 * Default renderer instance
 */
export const defaultRenderer = new TemplateRenderer();

/**
 * Convenience function to render a template
 */
export async function renderTemplate(
  templatePath: string,
  context?: TemplateContext,
  options?: TemplateOptions
): Promise<RenderResult> {
  const renderer = options ? new TemplateRenderer(options) : defaultRenderer;
  return renderer.renderTemplate(templatePath, context);
}

/**
 * Convenience function to render a string template
 */
export async function renderString(
  templateContent: string,
  context?: TemplateContext,
  options?: TemplateOptions
): Promise<RenderResult> {
  const renderer = options ? new TemplateRenderer(options) : defaultRenderer;
  return renderer.renderString(templateContent, context);
}

/**
 * Registers filters with the default renderer
 */
export function registerFilters(filters: Record<string, TemplateFilter>): void {
  defaultRenderer.registerFilters(filters);
}

/**
 * Registers a single filter with the default renderer
 */
export function registerFilter(name: string, filter: TemplateFilter): void {
  defaultRenderer.registerFilter(name, filter);
}

/**
 * Gets all available filters
 */
export function getAvailableFilters(): Record<string, TemplateFilter> {
  return defaultRenderer.getFilters();
}