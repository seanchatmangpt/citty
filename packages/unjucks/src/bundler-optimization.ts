/**
 * Bundle size optimization utilities
 * Tree-shaking, lazy loading, and bundle analysis
 */

import type { RenderOptions } from './types'

/**
 * Lazy loading wrapper for heavy dependencies
 */
export class LazyModule<T> {
  private _module: Promise<T> | undefined
  private _instance: T | undefined

  constructor(private loader: () => Promise<T>) {}

  async getInstance(): Promise<T> {
    if (this._instance) {
      return this._instance
    }

    if (!this._module) {
      this._module = this.loader()
    }

    this._instance = await this._module
    return this._instance
  }

  isLoaded(): boolean {
    return this._instance !== undefined
  }
}

/**
 * Optimized N3 features - only load what we need
 */
export const optimizedN3 = {
  // Lazy load Store only when needed
  Store: new LazyModule(async () => {
    const { Store } = await import('n3')
    return Store
  }),

  // Lazy load Parser only when needed
  Parser: new LazyModule(async () => {
    const { Parser } = await import('n3')
    return Parser
  }),

  // Lazy load Writer only when needed
  Writer: new LazyModule(async () => {
    const { Writer } = await import('n3')
    return Writer
  }),

  // DataFactory is lightweight, can be loaded immediately
  DataFactory: (() => {
    let factory: any
    return {
      async getInstance() {
        if (!factory) {
          const { DataFactory } = await import('n3')
          factory = DataFactory
        }
        return factory
      }
    }
  })()
}

/**
 * Tree-shakable utility functions
 */
export const utils = {
  // String utilities (tree-shakable)
  stringUtils: new LazyModule(async () => ({
    camelCase: (str: string) => 
      str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : ''),
    
    pascalCase: (str: string) => {
      const camel = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      return camel.charAt(0).toUpperCase() + camel.slice(1)
    },
    
    kebabCase: (str: string) =>
      str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
         .replace(/[\s_]+/g, '-')
         .replace(/^-/, ''),
    
    snakeCase: (str: string) =>
      str.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
         .replace(/[\s-]+/g, '_')
         .replace(/^_/, '')
  })),

  // Array utilities (tree-shakable)
  arrayUtils: new LazyModule(async () => ({
    unique: <T>(arr: T[]) => [...new Set(arr)],
    compact: <T>(arr: T[]) => arr.filter(Boolean),
    flatten: <T>(arr: T[][]) => arr.flat(),
    chunk: <T>(arr: T[], size: number) => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    },
    pluck: <T, K extends keyof T>(arr: T[], key: K) => arr.map(item => item[key])
  })),

  // Object utilities (tree-shakable)
  objectUtils: new LazyModule(async () => ({
    pick: <T extends object, K extends keyof T>(obj: T, ...keys: K[]) => {
      const result = {} as Pick<T, K>
      for (const key of keys) {
        if (key in obj) result[key] = obj[key]
      }
      return result
    },
    
    omit: <T extends object, K extends keyof T>(obj: T, ...keys: K[]) => {
      const result = { ...obj } as Omit<T, K>
      for (const key of keys) {
        delete (result as any)[key]
      }
      return result
    },
    
    merge: <T extends object>(target: T, ...sources: Partial<T>[]): T => {
      return Object.assign(target, ...sources)
    }
  }))
}

/**
 * Bundle analysis utilities
 */
export interface BundleStats {
  totalSize: number
  modules: Array<{
    name: string
    size: number
    loaded: boolean
  }>
  treeshakingEfficiency: number
  lazyLoadingUtilization: number
}

export class BundleAnalyzer {
  private loadedModules = new Set<string>()
  private moduleLoaders = new Map<string, LazyModule<any>>()

  registerModule(name: string, module: LazyModule<any>): void {
    this.moduleLoaders.set(name, module)
  }

  async getStats(): Promise<BundleStats> {
    const modules = Array.from(this.moduleLoaders.entries()).map(([name, module]) => ({
      name,
      size: this.estimateModuleSize(name),
      loaded: module.isLoaded()
    }))

    const totalSize = modules.reduce((sum, mod) => sum + mod.size, 0)
    const loadedSize = modules
      .filter(mod => mod.loaded)
      .reduce((sum, mod) => sum + mod.size, 0)

    const treeshakingEfficiency = totalSize > 0 ? 1 - (loadedSize / totalSize) : 1
    const lazyLoadingUtilization = modules.filter(mod => !mod.loaded).length / modules.length

    return {
      totalSize,
      modules,
      treeshakingEfficiency,
      lazyLoadingUtilization
    }
  }

  private estimateModuleSize(moduleName: string): number {
    // Rough estimates in KB
    const sizeEstimates: Record<string, number> = {
      'n3.Store': 150,
      'n3.Parser': 200,
      'n3.Writer': 180,
      'stringUtils': 5,
      'arrayUtils': 8,
      'objectUtils': 10,
      'nunjucks': 300
    }

    return sizeEstimates[moduleName] || 50
  }

  getRecommendations(): string[] {
    const recommendations: string[] = []
    
    // Check which modules are loaded but might not be needed
    for (const [name, module] of this.moduleLoaders) {
      if (module.isLoaded()) {
        recommendations.push(`Consider if ${name} is necessary for your use case`)
      }
    }

    return recommendations
  }
}

/**
 * Optimized regex patterns (compiled once)
 */
export const optimizedRegex = {
  // Template variable extraction
  templateVar: /\{\{([^}]+)\}\}/g,
  
  // Template tag extraction
  templateTag: /\{%\s*(?:for|if|set)\s+(\w+)/g,
  
  // Filter extraction
  filter: /\|\s*(\w+)/g,
  
  // Frontmatter detection
  yamlFrontmatter: /^---\n([\s\S]*?)\n---\n/,
  jsFrontmatter: /^\/\/---\n([\s\S]*?)\n\/\/---\n/,
  htmlFrontmatter: /^<!--\n([\s\S]*?)\n-->\n/,
  
  // Value parsing
  jsonValue: /^[\[{][\s\S]*[\]}]$/,
  numberValue: /^-?\d+(\.\d+)?$/,
  booleanValue: /^(true|false)$/,
  quotedValue: /^["'].*["']$/
}

/**
 * Memory-efficient string interning
 */
export class StringInterner {
  private cache = new Map<string, string>()
  private maxSize = 10000

  intern(str: string): string {
    const existing = this.cache.get(str)
    if (existing) {
      return existing
    }

    // Prevent memory leaks by limiting cache size
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(str, str)
    return str
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryEstimate: this.cache.size * 50 // rough estimate in bytes
    }
  }
}

/**
 * Streaming utilities for large templates
 */
export class StreamingRenderer {
  private chunkSize: number
  
  constructor(options: { chunkSize?: number } = {}) {
    this.chunkSize = options.chunkSize || 8192 // 8KB chunks
  }

  async *processLargeTemplate(
    content: string, 
    processor: (chunk: string) => string
  ): AsyncGenerator<string, void, unknown> {
    for (let i = 0; i < content.length; i += this.chunkSize) {
      const chunk = content.slice(i, i + this.chunkSize)
      yield processor(chunk)
    }
  }

  async renderLargeTemplate(
    content: string,
    processor: (chunk: string) => string
  ): Promise<string> {
    const chunks: string[] = []
    
    for await (const chunk of this.processLargeTemplate(content, processor)) {
      chunks.push(chunk)
    }
    
    return chunks.join('')
  }
}

/**
 * Global instances for optimization
 */
export const globalBundleAnalyzer = new BundleAnalyzer()
export const globalStringInterner = new StringInterner()
export const globalStreamingRenderer = new StreamingRenderer()

// Register core modules
globalBundleAnalyzer.registerModule('n3.Store', optimizedN3.Store)
globalBundleAnalyzer.registerModule('n3.Parser', optimizedN3.Parser)
globalBundleAnalyzer.registerModule('n3.Writer', optimizedN3.Writer)
globalBundleAnalyzer.registerModule('stringUtils', utils.stringUtils)
globalBundleAnalyzer.registerModule('arrayUtils', utils.arrayUtils)
globalBundleAnalyzer.registerModule('objectUtils', utils.objectUtils)

/**
 * Bundle optimization report
 */
export async function generateOptimizationReport(): Promise<{
  bundleStats: BundleStats
  stringInternStats: ReturnType<StringInterner['getStats']>
  recommendations: string[]
}> {
  const bundleStats = await globalBundleAnalyzer.getStats()
  const stringInternStats = globalStringInterner.getStats()
  const bundleRecommendations = globalBundleAnalyzer.getRecommendations()
  
  const recommendations = [
    ...bundleRecommendations,
    ...(bundleStats.lazyLoadingUtilization < 0.5 
      ? ['Consider using more lazy loading for better performance'] 
      : []
    ),
    ...(stringInternStats.size > 5000 
      ? ['High string interning usage - consider increasing max cache size'] 
      : []
    )
  ]

  return {
    bundleStats,
    stringInternStats,
    recommendations
  }
}