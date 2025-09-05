/**
 * Template Renderer for Unjucks
 * Nunjucks wrapper with built-in filters and helpers
 */

import nunjucks from 'nunjucks'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'pathe'
import { useTemplateContext, tryUseTemplateContext } from './context'
import type { 
  RenderOptions, 
  RenderResult, 
  RenderMetadata,
  FilterDefinition,
  TemplateContext,
  RenderError as RenderErrorType
} from './types'
import { RenderError } from './types'

// Global Nunjucks environment
let globalEnv: nunjucks.Environment | null = null

/**
 * Template Renderer class
 */
export class TemplateRenderer {
  private env: nunjucks.Environment
  private filters: Map<string, Function>
  private globals: Map<string, any>

  constructor(options?: RenderOptions) {
    // Create Nunjucks environment
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader('.', {
        noCache: true
      }),
      {
        autoescape: options?.autoescape ?? false,
        throwOnUndefined: options?.throwOnUndefined ?? false,
        trimBlocks: true,
        lstripBlocks: true
      }
    )

    this.filters = new Map()
    this.globals = new Map()

    // Register built-in filters
    this.registerBuiltinFilters()

    // Register custom filters
    if (options?.filters) {
      for (const [name, fn] of Object.entries(options.filters)) {
        this.registerFilter(name, fn)
      }
    }

    // Register globals
    if (options?.globals) {
      for (const [name, value] of Object.entries(options.globals)) {
        this.registerGlobal(name, value)
      }
    }
  }

  /**
   * Register built-in filters
   */
  private registerBuiltinFilters(): void {
    // String case transformations
    this.registerFilter('camelCase', (str: string) => 
      str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : ''))
    
    this.registerFilter('pascalCase', (str: string) => {
      const camel = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      return camel.charAt(0).toUpperCase() + camel.slice(1)
    })
    
    this.registerFilter('kebabCase', (str: string) =>
      str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
         .replace(/[\s_]+/g, '-')
         .replace(/^-/, ''))
    
    this.registerFilter('snakeCase', (str: string) =>
      str.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
         .replace(/[\s-]+/g, '_')
         .replace(/^_/, ''))
    
    this.registerFilter('upperCase', (str: string) => str.toUpperCase())
    this.registerFilter('lowerCase', (str: string) => str.toLowerCase())
    
    // Array filters
    this.registerFilter('first', (arr: any[]) => arr[0])
    this.registerFilter('last', (arr: any[]) => arr[arr.length - 1])
    this.registerFilter('unique', (arr: any[]) => [...new Set(arr)])
    this.registerFilter('compact', (arr: any[]) => arr.filter(Boolean))
    this.registerFilter('flatten', (arr: any[]) => arr.flat())
    this.registerFilter('pluck', (arr: any[], key: string) => arr.map(item => item[key]))
    
    // Object filters
    this.registerFilter('keys', (obj: object) => Object.keys(obj))
    this.registerFilter('values', (obj: object) => Object.values(obj))
    this.registerFilter('entries', (obj: object) => Object.entries(obj))
    this.registerFilter('pick', (obj: any, ...keys: string[]) => {
      const result: any = {}
      for (const key of keys) {
        if (key in obj) result[key] = obj[key]
      }
      return result
    })
    
    // String filters
    this.registerFilter('pluralize', (count: number, singular: string, plural?: string) => {
      return count === 1 ? singular : (plural || singular + 's')
    })
    
    this.registerFilter('truncate', (str: string, length: number, suffix = '...') => {
      if (str.length <= length) return str
      return str.slice(0, length - suffix.length) + suffix
    })
    
    this.registerFilter('padLeft', (str: string, length: number, char = ' ') => {
      return str.padStart(length, char)
    })
    
    this.registerFilter('padRight', (str: string, length: number, char = ' ') => {
      return str.padEnd(length, char)
    })
    
    // Date filters
    this.registerFilter('date', (date: Date | string, format?: string) => {
      const d = typeof date === 'string' ? new Date(date) : date
      if (!format) return d.toISOString()
      
      // Simple date formatting
      return format
        .replace('YYYY', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('DD', d.getDate().toString().padStart(2, '0'))
        .replace('HH', d.getHours().toString().padStart(2, '0'))
        .replace('mm', d.getMinutes().toString().padStart(2, '0'))
        .replace('ss', d.getSeconds().toString().padStart(2, '0'))
    })
    
    this.registerFilter('now', () => new Date())
    
    // JSON filters
    this.registerFilter('json', (obj: any, indent?: number) => 
      JSON.stringify(obj, null, indent))
    
    this.registerFilter('fromJson', (str: string) => JSON.parse(str))
    
    // Path filters
    this.registerFilter('dirname', (path: string) => dirname(path))
    this.registerFilter('basename', (path: string) => {
      const parts = path.split(/[/\\]/)
      return parts[parts.length - 1]
    })
    
    // Logic filters
    this.registerFilter('default', (value: any, defaultValue: any) => 
      value !== undefined && value !== null ? value : defaultValue)
    
    this.registerFilter('ternary', (condition: any, trueValue: any, falseValue: any) =>
      condition ? trueValue : falseValue)
  }

  /**
   * Register a custom filter
   */
  registerFilter(name: string, fn: Function): void {
    this.filters.set(name, fn)
    this.env.addFilter(name, fn)
  }

  /**
   * Register a global variable
   */
  registerGlobal(name: string, value: any): void {
    this.globals.set(name, value)
    this.env.addGlobal(name, value)
  }

  /**
   * Render a template file
   */
  async renderFile(
    templatePath: string, 
    context?: TemplateContext
  ): Promise<RenderResult> {
    const startTime = performance.now()
    
    try {
      // Read template content
      const content = readFileSync(templatePath, 'utf-8')
      
      // Get context
      const ctx = context || tryUseTemplateContext() || {}
      
      // Extract variables from template
      const variables = this.extractVariables(content)
      const usedFilters = this.extractFilters(content)
      
      // Render template
      const output = this.env.renderString(content, ctx)
      
      // Build metadata
      const metadata: RenderMetadata = {
        template: templatePath,
        duration: performance.now() - startTime,
        variables,
        filters: usedFilters
      }
      
      return { output, metadata }
    } catch (error) {
      throw new RenderError(
        `Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`,
        templatePath,
        { error }
      )
    }
  }

  /**
   * Render a template string
   */
  renderString(template: string, context?: TemplateContext): string {
    const ctx = context || tryUseTemplateContext() || {}
    return this.env.renderString(template, ctx)
  }

  /**
   * Extract variables from template
   */
  private extractVariables(content: string): string[] {
    const variables = new Set<string>()
    
    // Match {{ variable }}
    const varRegex = /\{\{([^}]+)\}\}/g
    let match
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1].trim().split(/[|. ]/)[0]
      if (varName) variables.add(varName)
    }
    
    // Match {% for/if/set variable %}
    const tagRegex = /\{%\s*(?:for|if|set)\s+(\w+)/g
    while ((match = tagRegex.exec(content)) !== null) {
      variables.add(match[1])
    }
    
    return Array.from(variables)
  }

  /**
   * Extract used filters from template
   */
  private extractFilters(content: string): string[] {
    const filters = new Set<string>()
    
    // Match | filter
    const filterRegex = /\|\s*(\w+)/g
    let match
    while ((match = filterRegex.exec(content)) !== null) {
      filters.add(match[1])
    }
    
    return Array.from(filters)
  }
}

// Singleton renderer instance
let defaultRenderer: TemplateRenderer | null = null

/**
 * Get or create default renderer
 */
function getDefaultRenderer(): TemplateRenderer {
  if (!defaultRenderer) {
    defaultRenderer = new TemplateRenderer()
  }
  return defaultRenderer
}

/**
 * Render a template file
 */
export async function renderTemplate(
  templatePath: string,
  context?: TemplateContext,
  options?: RenderOptions
): Promise<RenderResult> {
  const renderer = options 
    ? new TemplateRenderer(options)
    : getDefaultRenderer()
  
  return renderer.renderFile(templatePath, context)
}

/**
 * Render a template string
 */
export function renderString(
  template: string,
  context?: TemplateContext,
  options?: RenderOptions
): string {
  const renderer = options
    ? new TemplateRenderer(options)
    : getDefaultRenderer()
  
  return renderer.renderString(template, context)
}

/**
 * Register a filter on the default renderer
 */
export function registerFilter(name: string, fn: Function): void {
  getDefaultRenderer().registerFilter(name, fn)
}

/**
 * Register multiple filters
 */
export function registerFilters(filters: Record<string, Function>): void {
  const renderer = getDefaultRenderer()
  for (const [name, fn] of Object.entries(filters)) {
    renderer.registerFilter(name, fn)
  }
}

/**
 * Register a global on the default renderer
 */
export function registerGlobal(name: string, value: any): void {
  getDefaultRenderer().registerGlobal(name, value)
}

/**
 * Register multiple globals
 */
export function registerGlobals(globals: Record<string, any>): void {
  const renderer = getDefaultRenderer()
  for (const [name, value] of Object.entries(globals)) {
    renderer.registerGlobal(name, value)
  }
}

/**
 * Create a custom renderer
 */
export function createRenderer(options?: RenderOptions): TemplateRenderer {
  return new TemplateRenderer(options)
}