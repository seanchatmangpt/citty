/**
 * Unjucks Template Renderer for Weaver
 * Renders templates with semantic convention data
 */

import { Environment, FileSystemLoader } from 'nunjucks'
import { UnjucksFilters } from './unjucks-filters'
import type { ParsedOntology } from './ontology-parser'

export interface RenderOptions {
  templateDir?: string
  outputDir?: string
  filters?: Record<string, any>
  globals?: Record<string, any>
  autoescape?: boolean
}

export interface RenderContext {
  ontology: ParsedOntology
  metadata?: Record<string, any>
  [key: string]: any
}

export interface RenderResult {
  output: string
  templatePath: string
  context: RenderContext
  error?: Error
}

/**
 * Unjucks template renderer with semantic convention support
 */
export class UnjucksRenderer {
  private environment: Environment
  private options: RenderOptions

  constructor(options: RenderOptions = {}) {
    this.options = {
      templateDir: options.templateDir || './templates',
      autoescape: options.autoescape !== false,
      ...options
    }

    // Initialize Nunjucks environment
    if (this.options.templateDir) {
      this.environment = new Environment(
        new FileSystemLoader(this.options.templateDir),
        {
          autoescape: this.options.autoescape,
          throwOnUndefined: false,
          trimBlocks: true,
          lstripBlocks: true
        }
      )
    } else {
      this.environment = new Environment(null, {
        autoescape: this.options.autoescape,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      })
    }

    // Register built-in filters
    this.registerFilters()
  }

  /**
   * Register Unjucks filters with the environment
   */
  private registerFilters() {
    const filters = UnjucksFilters.getAllFilters()
    
    for (const [name, filter] of Object.entries(filters)) {
      this.environment.addFilter(name, filter)
    }

    // Register custom filters if provided
    if (this.options.filters) {
      for (const [name, filter] of Object.entries(this.options.filters)) {
        this.environment.addFilter(name, filter)
      }
    }
  }

  /**
   * Render a template with the given context
   */
  async renderTemplate(
    templatePath: string, 
    context: RenderContext
  ): Promise<RenderResult> {
    try {
      // Add globals to context
      const fullContext = {
        ...context,
        ...this.options.globals
      }

      // Render the template
      const output = this.environment.render(templatePath, fullContext)

      return {
        output,
        templatePath,
        context: fullContext
      }
    } catch (error) {
      return {
        output: '',
        templatePath,
        context,
        error: error as Error
      }
    }
  }

  /**
   * Render a template string directly
   */
  async renderString(
    templateString: string, 
    context: RenderContext
  ): Promise<RenderResult> {
    try {
      // Add globals to context
      const fullContext = {
        ...context,
        ...this.options.globals
      }

      // Render the template string
      const output = this.environment.renderString(templateString, fullContext)

      return {
        output,
        templatePath: '<string>',
        context: fullContext
      }
    } catch (error) {
      return {
        output: '',
        templatePath: '<string>',
        context,
        error: error as Error
      }
    }
  }

  /**
   * Render multiple templates with the same context
   */
  async renderMultiple(
    templatePaths: string[], 
    context: RenderContext
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = []

    for (const templatePath of templatePaths) {
      const result = await this.renderTemplate(templatePath, context)
      results.push(result)
    }

    return results
  }

  /**
   * Add a global variable to all render contexts
   */
  addGlobal(name: string, value: any): void {
    this.environment.addGlobal(name, value)
  }

  /**
   * Add a custom filter to the environment
   */
  addFilter(name: string, filter: Function): void {
    this.environment.addFilter(name, filter)
  }

  /**
   * Create a context from ontology data
   */
  createContext(ontology: ParsedOntology, metadata: Record<string, any> = {}): RenderContext {
    return {
      ontology,
      metadata,
      // Convenience accessors
      conventions: ontology.conventions,
      version: ontology.version,
      // Helper functions
      hasConvention: (name: string) => 
        ontology.conventions.some(c => c.name === name),
      getConvention: (name: string) => 
        ontology.conventions.find(c => c.name === name),
      filterConventions: (predicate: (c: any) => boolean) =>
        ontology.conventions.filter(predicate)
    }
  }

  /**
   * Get the underlying Nunjucks environment
   */
  getEnvironment(): Environment {
    return this.environment
  }
}

// Default export
export default UnjucksRenderer