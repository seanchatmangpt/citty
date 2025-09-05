/**
 * 🧠 DARK MATTER: Incremental Rendering System
 * The performance optimization that makes template generation actually scale
 */

import { createHash } from 'crypto'
import { join, dirname, relative } from 'path'
import { existsSync } from 'fs'
import { mkdir, writeFile, readFile, access } from 'fs/promises'
import { EventEmitter } from 'events'
import chalk from 'chalk'

export interface RenderCache {
  hash: string
  content: string
  dependencies: string[]
  timestamp: number
  metadata: {
    templatePath: string
    outputPath: string
    contextHash: string
    size: number
  }
}

export interface IncrementalOptions {
  cacheDir: string
  maxCacheAge: number
  maxCacheSize: number
  enableCompression: boolean
  trackDependencies: boolean
}

export interface RenderJob {
  id: string
  templatePath: string
  outputPath: string
  context: any
  priority: number
  dependencies: string[]
}

export interface RenderResult {
  cached: boolean
  duration: number
  sizeBytes: number
  dependencies: string[]
  cacheHit: boolean
}

/**
 * Intelligent incremental rendering with dependency tracking
 */
export class IncrementalRenderer extends EventEmitter {
  private cache: Map<string, RenderCache> = new Map()
  private renderQueue: Map<string, RenderJob> = new Map()
  private processing = new Set<string>()
  private options: Required<IncrementalOptions>
  private stats = {
    hits: 0,
    misses: 0,
    renders: 0,
    saves: 0
  }

  constructor(options: Partial<IncrementalOptions> = {}) {
    super()
    
    this.options = {
      cacheDir: options.cacheDir || '.cache/unjucks',
      maxCacheAge: options.maxCacheAge || 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: options.maxCacheSize || 1000,
      enableCompression: options.enableCompression !== false,
      trackDependencies: options.trackDependencies !== false
    }
    
    this.loadCache()
  }

  /**
   * Render template with incremental caching
   */
  async render(
    templatePath: string,
    outputPath: string,
    context: any,
    dependencies: string[] = []
  ): Promise<RenderResult> {
    const startTime = Date.now()
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(templatePath, context, dependencies)
    
    // Check cache
    const cached = await this.checkCache(cacheKey, dependencies)
    if (cached) {
      this.stats.hits++
      
      // Ensure output exists
      if (existsSync(outputPath)) {
        return {
          cached: true,
          duration: Date.now() - startTime,
          sizeBytes: cached.content.length,
          dependencies: cached.dependencies,
          cacheHit: true
        }
      }
    }
    
    this.stats.misses++
    
    // Create render job
    const job: RenderJob = {
      id: cacheKey,
      templatePath,
      outputPath,
      context,
      priority: this.calculatePriority(templatePath, outputPath),
      dependencies
    }
    
    // Queue or execute immediately
    return this.executeRender(job)
  }

  /**
   * Execute render job
   */
  private async executeRender(job: RenderJob): Promise<RenderResult> {
    const startTime = Date.now()
    
    // Prevent duplicate processing
    if (this.processing.has(job.id)) {
      return this.waitForCompletion(job.id)
    }
    
    this.processing.add(job.id)
    
    try {
      // Import renderer (avoid circular dependency)
      const { renderTemplate } = await import('./renderer')
      
      // Execute render
      const content = await renderTemplate(job.templatePath, job.context)
      
      // Create cache entry
      const cacheEntry: RenderCache = {
        hash: job.id,
        content,
        dependencies: job.dependencies,
        timestamp: Date.now(),
        metadata: {
          templatePath: job.templatePath,
          outputPath: job.outputPath,
          contextHash: this.hashContext(job.context),
          size: content.length
        }
      }
      
      // Store in cache
      await this.storeCache(job.id, cacheEntry)
      
      // Write output file
      await this.writeOutput(job.outputPath, content)
      
      this.stats.renders++
      this.stats.saves++
      
      const result: RenderResult = {
        cached: false,
        duration: Date.now() - startTime,
        sizeBytes: content.length,
        dependencies: job.dependencies,
        cacheHit: false
      }
      
      this.emit('render:complete', { job, result })
      
      return result
      
    } catch (error) {
      this.emit('render:error', { job, error })
      throw error
      
    } finally {
      this.processing.delete(job.id)
    }
  }

  /**
   * Check if cached version is valid
   */
  private async checkCache(
    cacheKey: string,
    dependencies: string[]
  ): Promise<RenderCache | null> {
    const cached = this.cache.get(cacheKey)
    if (!cached) return null
    
    // Check age
    if (Date.now() - cached.timestamp > this.options.maxCacheAge) {
      this.cache.delete(cacheKey)
      return null
    }
    
    // Check dependencies if tracking enabled
    if (this.options.trackDependencies) {
      const invalid = await this.checkDependencies(cached.dependencies)
      if (invalid) {
        this.cache.delete(cacheKey)
        return null
      }
    }
    
    return cached
  }

  /**
   * Check if any dependencies have changed
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    for (const dep of dependencies) {
      if (!existsSync(dep)) {
        return true // Dependency deleted
      }
      
      try {
        const stat = await access(dep).then(() => true).catch(() => false)
        if (!stat) return true
      } catch {
        return true
      }
    }
    
    return false
  }

  /**
   * Generate cache key from template and context
   */
  private generateCacheKey(
    templatePath: string,
    context: any,
    dependencies: string[]
  ): string {
    const templateHash = createHash('md5').update(templatePath).digest('hex').substring(0, 8)
    const contextHash = this.hashContext(context)
    const depsHash = createHash('md5').update(dependencies.join('|')).digest('hex').substring(0, 8)
    
    return `${templateHash}-${contextHash}-${depsHash}`
  }

  /**
   * Hash context for comparison
   */
  private hashContext(context: any): string {
    // Deep hash of context object
    const normalized = this.normalizeContext(context)
    const json = JSON.stringify(normalized, Object.keys(normalized).sort())
    return createHash('md5').update(json).digest('hex').substring(0, 8)
  }

  /**
   * Normalize context for consistent hashing
   */
  private normalizeContext(context: any): any {
    if (context === null || context === undefined) {
      return null
    }
    
    if (typeof context !== 'object') {
      return context
    }
    
    if (Array.isArray(context)) {
      return context.map(item => this.normalizeContext(item))
    }
    
    // Sort keys and normalize values
    const normalized: any = {}
    const keys = Object.keys(context).sort()
    
    for (const key of keys) {
      // Skip functions and symbols
      if (typeof context[key] === 'function' || typeof context[key] === 'symbol') {
        continue
      }
      
      normalized[key] = this.normalizeContext(context[key])
    }
    
    return normalized
  }

  /**
   * Calculate render priority
   */
  private calculatePriority(templatePath: string, outputPath: string): number {
    let priority = 0
    
    // Higher priority for index files
    if (templatePath.includes('index') || outputPath.includes('index')) {
      priority += 10
    }
    
    // Higher priority for smaller files (render faster)
    const pathLength = templatePath.length + outputPath.length
    priority += Math.max(0, 100 - pathLength)
    
    // Lower priority for deep nested files
    const depth = templatePath.split('/').length
    priority -= depth * 2
    
    return priority
  }

  /**
   * Store cache entry
   */
  private async storeCache(key: string, entry: RenderCache): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= this.options.maxCacheSize) {
      await this.evictOldEntries()
    }
    
    this.cache.set(key, entry)
    
    // Persist to disk if cache directory exists
    await this.persistCache(key, entry)
  }

  /**
   * Evict old cache entries
   */
  private async evictOldEntries(): Promise<void> {
    const entries = Array.from(this.cache.entries())
    
    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
    
    // Remove oldest 20%
    const removeCount = Math.floor(entries.length * 0.2)
    for (let i = 0; i < removeCount; i++) {
      const [key] = entries[i]
      this.cache.delete(key)
      await this.removeCacheFile(key)
    }
    
    this.emit('cache:evicted', { count: removeCount })
  }

  /**
   * Persist cache to disk
   */
  private async persistCache(key: string, entry: RenderCache): Promise<void> {
    try {
      const cacheFile = join(this.options.cacheDir, `${key}.json`)
      await mkdir(dirname(cacheFile), { recursive: true })
      
      const data = JSON.stringify(entry, null, 2)
      await writeFile(cacheFile, data, 'utf-8')
      
    } catch (error) {
      // Silently fail - caching is not critical
      this.emit('cache:persist_error', { key, error })
    }
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      if (!existsSync(this.options.cacheDir)) {
        return
      }
      
      const { glob } = await import('fast-glob')
      const cacheFiles = await glob('*.json', { 
        cwd: this.options.cacheDir, 
        absolute: true 
      })
      
      let loaded = 0
      for (const file of cacheFiles) {
        try {
          const data = await readFile(file, 'utf-8')
          const entry: RenderCache = JSON.parse(data)
          
          // Validate entry
          if (this.validateCacheEntry(entry)) {
            const key = entry.hash
            this.cache.set(key, entry)
            loaded++
          }
        } catch {
          // Skip invalid entries
        }
      }
      
      if (loaded > 0) {
        console.log(chalk.green(`📦 Loaded ${loaded} cached templates`))
      }
      
    } catch (error) {
      // Silently fail - cache loading is not critical
      this.emit('cache:load_error', { error })
    }
  }

  /**
   * Validate cache entry structure
   */
  private validateCacheEntry(entry: any): entry is RenderCache {
    return entry &&
           typeof entry.hash === 'string' &&
           typeof entry.content === 'string' &&
           Array.isArray(entry.dependencies) &&
           typeof entry.timestamp === 'number' &&
           entry.metadata &&
           typeof entry.metadata.templatePath === 'string'
  }

  /**
   * Remove cache file from disk
   */
  private async removeCacheFile(key: string): Promise<void> {
    try {
      const cacheFile = join(this.options.cacheDir, `${key}.json`)
      if (existsSync(cacheFile)) {
        const { unlink } = await import('fs/promises')
        await unlink(cacheFile)
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Write output file
   */
  private async writeOutput(outputPath: string, content: string): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, content, 'utf-8')
  }

  /**
   * Wait for render completion
   */
  private async waitForCompletion(jobId: string): Promise<RenderResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Render timeout for job ${jobId}`))
      }, 30000)
      
      const onComplete = (data: any) => {
        if (data.job.id === jobId) {
          clearTimeout(timeout)
          this.off('render:complete', onComplete)
          this.off('render:error', onError)
          resolve(data.result)
        }
      }
      
      const onError = (data: any) => {
        if (data.job.id === jobId) {
          clearTimeout(timeout)
          this.off('render:complete', onComplete)
          this.off('render:error', onError)
          reject(data.error)
        }
      }
      
      this.on('render:complete', onComplete)
      this.on('render:error', onError)
    })
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0
    
    for (const [key, entry] of this.cache.entries()) {
      const shouldInvalidate = typeof pattern === 'string'
        ? entry.metadata.templatePath.includes(pattern)
        : pattern.test(entry.metadata.templatePath)
      
      if (shouldInvalidate) {
        this.cache.delete(key)
        this.removeCacheFile(key)
        count++
      }
    }
    
    this.emit('cache:invalidated', { pattern, count })
    return count
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear()
    
    try {
      const { rmdir } = await import('fs/promises')
      if (existsSync(this.options.cacheDir)) {
        await rmdir(this.options.cacheDir, { recursive: true })
      }
    } catch {
      // Silently fail
    }
    
    this.emit('cache:cleared')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      processing: this.processing.size,
      queued: this.renderQueue.size
    }
  }

  /**
   * Get cache entries for debugging
   */
  getCacheEntries(): Array<{ key: string; entry: RenderCache }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }))
  }
}

// Singleton instance
export const incrementalRenderer = new IncrementalRenderer()

// Export convenience function
export async function renderIncremental(
  templatePath: string,
  outputPath: string,
  context: any,
  dependencies: string[] = []
): Promise<RenderResult> {
  return incrementalRenderer.render(templatePath, outputPath, context, dependencies)
}