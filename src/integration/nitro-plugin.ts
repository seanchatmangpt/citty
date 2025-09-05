/**
 * ⚡ Nitro Plugin: Server-Side Template Processing
 * High-performance server-side template compilation and caching
 * Integrated with Nitro's build system and runtime
 */

import type { Nitro, NitroApp } from 'nitropack'
import { resolve, join } from 'pathe'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { defu } from 'defu'
import { MemoryCache } from '../cache'
import { UNJUCKS } from '../unjucks'
import { loadGraph, toContext } from '../untology'
import { createTemplateContext } from '../context'

export interface UnjucksNitroOptions {
  /**
   * Templates directory
   * @default './templates'
   */
  templatesDir?: string
  
  /**
   * Ontology directory
   * @default './ontology'
   */
  ontologyDir?: string
  
  /**
   * Cache templates in memory
   * @default true
   */
  enableCache?: boolean
  
  /**
   * Cache TTL in milliseconds
   * @default 5 * 60 * 1000 (5 minutes)
   */
  cacheTtl?: number
  
  /**
   * Precompile templates at build time
   * @default true
   */
  precompile?: boolean
  
  /**
   * Maximum memory usage for cache (bytes)
   * @default 256MB
   */
  maxMemoryUsage?: number
  
  /**
   * Enable development mode features
   * @default process.env.NODE_ENV === 'development'
   */
  dev?: boolean
  
  /**
   * Global context for all templates
   */
  globalContext?: Record<string, any>
  
  /**
   * Route patterns for template serving
   * @default ['/templates/**', '/api/templates/**']
   */
  routePatterns?: string[]
  
  /**
   * Auto-generate API routes for templates
   * @default true
   */
  generateApiRoutes?: boolean
}

const DEFAULT_OPTIONS: Required<UnjucksNitroOptions> = {
  templatesDir: './templates',
  ontologyDir: './ontology',
  enableCache: true,
  cacheTtl: 5 * 60 * 1000,
  precompile: true,
  maxMemoryUsage: 256 * 1024 * 1024,
  dev: process.env.NODE_ENV === 'development',
  globalContext: {},
  routePatterns: ['/templates/**', '/api/templates/**'],
  generateApiRoutes: true
}

/**
 * Template compilation cache
 */
interface CompiledTemplate {
  content: string
  compiledAt: number
  hash: string
  ontologyContext?: any
}

class UnjucksNitroEngine {
  private cache: MemoryCache<CompiledTemplate>
  private options: Required<UnjucksNitroOptions>
  private templateContext: any
  private ontologyLoaded = false
  
  constructor(options: UnjucksNitroOptions = {}) {
    this.options = defu(options, DEFAULT_OPTIONS)
    this.cache = new MemoryCache({
      defaultTtl: this.options.cacheTtl,
      maxSize: Math.floor(this.options.maxMemoryUsage / 1024) // Convert to KB
    })
  }
  
  async initialize(nitro: Nitro) {
    // Initialize template context
    const templatesDir = resolve(nitro.options.rootDir, this.options.templatesDir)
    const ontologyDir = resolve(nitro.options.rootDir, this.options.ontologyDir)
    
    try {
      this.templateContext = await createTemplateContext({
        templatesDir,
        outputDir: join(nitro.options.buildDir, 'unjucks-runtime'),
        cache: this.options.enableCache
      })
      
      // Load ontology files
      await this.loadOntologies(ontologyDir)
      
      console.log('[unjucks-nitro] Template engine initialized')
    } catch (error) {
      console.error('[unjucks-nitro] Failed to initialize:', error)
      throw error
    }
  }
  
  async loadOntologies(ontologyDir: string) {
    if (!existsSync(ontologyDir)) {
      console.warn('[unjucks-nitro] Ontology directory not found:', ontologyDir)
      return
    }
    
    try {
      const { glob } = await import('fast-glob')
      const ontologyFiles = await glob(['**/*.ttl', '**/*.jsonld', '**/*.n3'], {
        cwd: ontologyDir,
        onlyFiles: true
      })
      
      for (const file of ontologyFiles) {
        const ontologyPath = join(ontologyDir, file)
        await loadGraph(ontologyPath)
      }
      
      this.ontologyLoaded = true
      console.log(`[unjucks-nitro] Loaded ${ontologyFiles.length} ontology files`)
    } catch (error) {
      console.error('[unjucks-nitro] Failed to load ontologies:', error)
    }
  }
  
  async compileTemplate(
    templateId: string,
    context: Record<string, any> = {},
    force = false
  ): Promise<string> {
    const cacheKey = `${templateId}-${JSON.stringify(context)}`
    
    // Check cache first
    if (this.options.enableCache && !force) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        return cached.content
      }
    }
    
    try {
      // Merge contexts
      const mergedContext = {
        ...this.options.globalContext,
        ...context,
        ...(this.ontologyLoaded ? toContext() : {}),
        $nitro: {
          timestamp: new Date().toISOString(),
          templateId,
          cached: false
        }
      }
      
      // Generate from ontology if available
      let result
      if (this.ontologyLoaded) {
        result = await UNJUCKS.generateFromOntology(
          this.options.ontologyDir,
          templateId,
          {
            context: mergedContext,
            cache: this.options.enableCache
          }
        )
      } else {
        // Fallback to direct template rendering
        result = await UNJUCKS.renderTemplate(templateId, mergedContext)
      }
      
      if (!result.success && result.errors) {
        throw new Error(`Template compilation failed: ${result.errors[0]?.message}`)
      }
      
      const compiledContent = result.files?.[0]?.content || ''
      
      // Cache the result
      if (this.options.enableCache) {
        const compiled: CompiledTemplate = {
          content: compiledContent,
          compiledAt: Date.now(),
          hash: this.generateHash(templateId + JSON.stringify(context)),
          ontologyContext: this.ontologyLoaded ? toContext() : undefined
        }
        
        this.cache.set(cacheKey, compiled)
      }
      
      return compiledContent
    } catch (error) {
      console.error(`[unjucks-nitro] Template compilation failed for ${templateId}:`, error)
      throw error
    }
  }
  
  async renderTemplate(
    templateId: string,
    context: Record<string, any> = {},
    options: { contentType?: string; status?: number } = {}
  ) {
    try {
      const content = await this.compileTemplate(templateId, context)
      
      return {
        content,
        headers: {
          'content-type': options.contentType || 'text/html; charset=utf-8',
          'x-template-id': templateId,
          'x-compiled-at': new Date().toISOString(),
          'cache-control': this.options.dev ? 'no-cache' : 'public, max-age=300'
        },
        status: options.status || 200
      }
    } catch (error) {
      return {
        content: this.options.dev 
          ? `<h1>Template Error</h1><pre>${error}</pre>`
          : '<h1>Template Error</h1><p>An error occurred while rendering the template.</p>',
        headers: {
          'content-type': 'text/html; charset=utf-8'
        },
        status: 500
      }
    }
  }
  
  private generateHash(input: string): string {
    // Simple hash function for cache keys
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      stats: this.cache.getStats(),
      memoryUsage: process.memoryUsage()
    }
  }
  
  clearCache(pattern?: string) {
    if (pattern) {
      // Clear cache entries matching pattern
      const keys = Array.from(this.cache.keys())
      const regex = new RegExp(pattern)
      
      for (const key of keys) {
        if (regex.test(key)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }
}

// Global engine instance
let engineInstance: UnjucksNitroEngine | null = null

/**
 * Nitro plugin definition
 */
export default function unjucksNitroPlugin(options: UnjucksNitroOptions = {}) {
  return {
    name: 'unjucks-nitro-plugin',
    configKey: 'unjucks',
    
    async setup(nitro: Nitro) {
      engineInstance = new UnjucksNitroEngine(options)
      await engineInstance.initialize(nitro)
      
      // Add runtime utilities
      nitro.options.runtimeConfig.unjucks = defu(nitro.options.runtimeConfig.unjucks || {}, {
        templatesDir: options.templatesDir || './templates',
        ontologyDir: options.ontologyDir || './ontology',
        enableCache: options.enableCache !== false,
        dev: options.dev ?? process.env.NODE_ENV === 'development'
      })
      
      // Generate API routes if enabled
      if (options.generateApiRoutes !== false) {
        nitro.options.handlers = nitro.options.handlers || []
        
        // Template rendering endpoint
        nitro.options.handlers.push({
          route: '/api/templates/:templateId',
          handler: resolve('./runtime/api/render-template')
        })
        
        // Template list endpoint
        nitro.options.handlers.push({
          route: '/api/templates',
          handler: resolve('./runtime/api/list-templates')
        })
        
        // Cache management endpoint
        nitro.options.handlers.push({
          route: '/api/templates/_cache',
          handler: resolve('./runtime/api/cache-management')
        })
        
        // Ontology endpoint
        nitro.options.handlers.push({
          route: '/api/ontology',
          handler: resolve('./runtime/api/ontology-info')
        })
      }
      
      console.log('[unjucks-nitro] Plugin setup complete')
    },
    
    nitro: {
      experimental: {
        wasm: true
      }
    }
  }
}

/**
 * Get the global engine instance
 */
export function getUnjucksEngine(): UnjucksNitroEngine {
  if (!engineInstance) {
    throw new Error('Unjucks Nitro engine not initialized')
  }
  return engineInstance
}

/**
 * Utility function for handlers
 */
export async function renderTemplateHandler(
  templateId: string,
  context: Record<string, any> = {},
  options: { contentType?: string; status?: number } = {}
) {
  const engine = getUnjucksEngine()
  return engine.renderTemplate(templateId, context, options)
}

/**
 * Development helper for template hot-reload
 */
export function setupTemplateWatcher(nitro: Nitro, templatesDir: string, ontologyDir: string) {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    const chokidar = require('chokidar')
    
    const watcher = chokidar.watch([
      join(templatesDir, '**/*'),
      join(ontologyDir, '**/*')
    ], {
      ignored: /node_modules/,
      ignoreInitial: true
    })
    
    watcher.on('change', (filePath: string) => {
      console.log(`[unjucks-nitro] File changed: ${filePath}`)
      
      if (engineInstance) {
        // Clear relevant cache entries
        engineInstance.clearCache()
        
        // Reload ontologies if ontology file changed
        if (filePath.includes(ontologyDir)) {
          engineInstance.loadOntologies(ontologyDir)
            .catch(error => console.error('Failed to reload ontologies:', error))
        }
      }
    })
    
    // Cleanup on process exit
    process.on('exit', () => {
      watcher.close()
    })
  }
}

export { UnjucksNitroEngine }
export type { UnjucksNitroOptions, CompiledTemplate }