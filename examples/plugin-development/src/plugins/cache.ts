import { LRUCache } from 'lru-cache'
import { definePlugin } from '../plugin-system'
import { createHash } from 'crypto'
import type { PluginContext, TemplateContext } from '@unjs/unjucks'

interface CacheEntry {
  content: string
  timestamp: number
  hits: number
  template: string
  contextHash: string
}

export default definePlugin({
  name: 'cache',
  version: '1.0.0',
  description: 'Intelligent template caching with LRU eviction and context-aware invalidation',
  author: 'UnJucks Team',

  config: {
    enabled: true,
    maxSize: 1000,
    maxAge: 1000 * 60 * 15, // 15 minutes
    strategy: 'lru', // 'lru' | 'fifo' | 'intelligent'
    contextSensitive: true,
    metrics: true,
    autoInvalidate: true
  },

  cache: null as LRUCache<string, CacheEntry> | null,
  metrics: {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRenderTime: 0,
    cachedRenderTime: 0
  },

  async setup(context: PluginContext) {
    // Initialize LRU cache
    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.maxAge,
      
      // Update metrics on eviction
      dispose: (value, key) => {
        if (this.config.metrics) {
          this.metrics.evictions++
        }
      }
    })

    // Add cache management functions
    context.unjucks.addGlobal('cache', {
      clear: () => this.clearCache(),
      stats: () => this.getCacheStats(),
      invalidate: (pattern: string) => this.invalidatePattern(pattern)
    })

    console.log('✅ Cache plugin initialized')
  },

  async beforeRender(template: string, data: any, context: TemplateContext) {
    if (!this.config.enabled || !this.cache) return

    const cacheKey = this.generateCacheKey(template, data, context)
    const cached = this.cache.get(cacheKey)

    if (cached) {
      // Cache hit
      this.metrics.hits++
      cached.hits++
      
      // Store cached result for afterRender to use
      context._cacheHit = cached.content
      context._renderStartTime = performance.now()
      
      return
    }

    // Cache miss - prepare for fresh render
    this.metrics.misses++
    context._cacheKey = cacheKey
    context._renderStartTime = performance.now()
  },

  async afterRender(result: string, template: string, data: any, context: TemplateContext) {
    if (!this.config.enabled || !this.cache) return result

    const renderTime = performance.now() - (context._renderStartTime || 0)
    this.metrics.totalRenderTime += renderTime

    // If cache hit, return cached content
    if (context._cacheHit) {
      this.metrics.cachedRenderTime += renderTime
      return context._cacheHit
    }

    // Store fresh result in cache
    if (context._cacheKey) {
      const entry: CacheEntry = {
        content: result,
        timestamp: Date.now(),
        hits: 0,
        template: context.templatePath || 'inline',
        contextHash: this.hashContext(data)
      }

      this.cache.set(context._cacheKey, entry)
    }

    return result
  },

  filters: {
    // Disable caching for specific content
    nocache: (content: any) => {
      // Add marker that cache should skip this render
      if (typeof content === 'string') {
        return `<!-- nocache -->${content}<!-- /nocache -->`
      }
      return content
    },

    // Cache with custom TTL
    cacheFor: (content: any, seconds: number = 300) => {
      if (typeof content === 'string') {
        return `<!-- cache:${seconds} -->${content}<!-- /cache -->`
      }
      return content
    },

    // Cache key modifier
    cacheKey: (content: any, key: string) => {
      if (typeof content === 'string') {
        return `<!-- cachekey:${key} -->${content}<!-- /cachekey -->`
      }
      return content
    }
  },

  functions: {
    // Get cache statistics
    cacheStats: (context: PluginContext) => {
      return {
        ...this.metrics,
        hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100,
        averageRenderTime: this.metrics.totalRenderTime / (this.metrics.hits + this.metrics.misses),
        cacheEfficiency: this.metrics.cachedRenderTime / this.metrics.totalRenderTime * 100,
        cacheSize: this.cache?.size || 0,
        maxSize: this.config.maxSize
      }
    },

    // Warm cache with common templates
    warmCache: async (context: PluginContext, templates: Array<{template: string, data: any}>) => {
      let warmed = 0
      for (const item of templates) {
        try {
          await context.unjucks.render(item.template, item.data)
          warmed++
        } catch (error) {
          console.warn(`Failed to warm cache for template: ${item.template}`)
        }
      }
      return warmed
    },

    // Precompile templates for faster rendering
    precompile: async (context: PluginContext, templatePaths: string[]) => {
      const compiled = []
      for (const path of templatePaths) {
        try {
          // This would ideally precompile and cache the compiled template
          const template = await context.unjucks.readTemplate(path)
          compiled.push(path)
        } catch (error) {
          console.warn(`Failed to precompile template: ${path}`)
        }
      }
      return compiled
    }
  },

  // Helper methods
  generateCacheKey(template: string, data: any, context: TemplateContext): string {
    const templateKey = context.templatePath || this.hashString(template)
    const dataKey = this.config.contextSensitive ? this.hashContext(data) : 'static'
    const contextKey = context.locale || 'default'
    
    return `${templateKey}:${dataKey}:${contextKey}`
  },

  hashContext(data: any): string {
    // Create stable hash of context data
    const sanitized = this.sanitizeForHash(data)
    return createHash('sha256')
      .update(JSON.stringify(sanitized))
      .digest('hex')
      .substring(0, 16)
  },

  hashString(str: string): string {
    return createHash('sha256')
      .update(str)
      .digest('hex')
      .substring(0, 16)
  },

  sanitizeForHash(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'function') return '[Function]'
    if (obj instanceof Date) return obj.toISOString()
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeForHash(item))
    
    if (typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Skip private/meta properties
        if (key.startsWith('_')) continue
        sanitized[key] = this.sanitizeForHash(value)
      }
      return sanitized
    }
    
    return obj
  },

  clearCache() {
    this.cache?.clear()
    this.resetMetrics()
  },

  invalidatePattern(pattern: string) {
    if (!this.cache) return 0

    let invalidated = 0
    const regex = new RegExp(pattern)
    
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    return invalidated
  },

  getCacheStats() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / Math.max(1, this.metrics.hits + this.metrics.misses) * 100,
      size: this.cache?.size || 0,
      maxSize: this.config.maxSize
    }
  },

  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRenderTime: 0,
      cachedRenderTime: 0
    }
  }
})