/**
 * Performance cache utilities for Unjucks
 * Implements LRU caching with TTL support
 */

import { readFileSync, statSync } from 'node:fs'
import type { Stats } from 'node:fs'
import type { Template as NunjucksTemplate } from 'nunjucks'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  lastModified?: number
  accessCount: number
}

export interface CacheOptions {
  maxSize?: number
  ttl?: number
  checkFileModification?: boolean
}

/**
 * LRU Cache with TTL support
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = []
  
  constructor(
    private options: CacheOptions = {}
  ) {
    this.options = {
      maxSize: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
      checkFileModification: true,
      ...options
    }
  }

  get(key: string, filePath?: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }

    const now = Date.now()
    
    // Check TTL expiration
    if (this.options.ttl && now - entry.timestamp > this.options.ttl) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return undefined
    }

    // Check file modification time if applicable
    if (filePath && this.options.checkFileModification) {
      try {
        const stats = statSync(filePath)
        if (entry.lastModified && stats.mtimeMs > entry.lastModified) {
          this.cache.delete(key)
          this.removeFromAccessOrder(key)
          return undefined
        }
      } catch {
        // File might have been deleted, invalidate cache
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        return undefined
      }
    }

    // Update access order and count
    entry.accessCount++
    this.updateAccessOrder(key)
    
    return entry.value
  }

  set(key: string, value: T, filePath?: string): void {
    const now = Date.now()
    let lastModified: number | undefined

    // Get file modification time if applicable
    if (filePath && this.options.checkFileModification) {
      try {
        const stats = statSync(filePath)
        lastModified = stats.mtimeMs
      } catch {
        // Ignore if file doesn't exist
      }
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key)
    }

    // Ensure cache size limit
    while (this.cache.size >= (this.options.maxSize || 100)) {
      this.evictLeastRecentlyUsed()
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: now,
      lastModified,
      accessCount: 1
    })
    
    this.accessOrder.push(key)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key)
    this.removeFromAccessOrder(key)
    return result
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  size(): number {
    return this.cache.size
  }

  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalAccesses: number
  } {
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0)
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize || 100,
      hitRate: totalAccesses > 0 ? this.cache.size / totalAccesses : 0,
      totalAccesses
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  private evictLeastRecentlyUsed(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0]
      this.cache.delete(lruKey)
      this.accessOrder.shift()
    }
  }
}

/**
 * Template compilation cache
 */
export class TemplateCache extends LRUCache<NunjucksTemplate> {
  constructor(options?: CacheOptions) {
    super({
      maxSize: 50,
      ttl: 10 * 60 * 1000, // 10 minutes
      checkFileModification: true,
      ...options
    })
  }

  getTemplate(templatePath: string, compilerFn: () => NunjucksTemplate): NunjucksTemplate {
    const cached = this.get(templatePath, templatePath)
    
    if (cached) {
      return cached
    }

    // Compile template and cache it
    const template = compilerFn()
    this.set(templatePath, template, templatePath)
    
    return template
  }
}

/**
 * Template discovery cache
 */
export class DiscoveryCache extends LRUCache<any> {
  constructor(options?: CacheOptions) {
    super({
      maxSize: 200,
      ttl: 30 * 60 * 1000, // 30 minutes
      checkFileModification: false, // Discovery results don't map to single files
      ...options
    })
  }
}

/**
 * Query result cache with predicate indexing
 */
export class QueryCache extends LRUCache<any> {
  private predicateIndex = new Map<string, Set<string>>()
  
  constructor(options?: CacheOptions) {
    super({
      maxSize: 500,
      ttl: 15 * 60 * 1000, // 15 minutes
      checkFileModification: false,
      ...options
    })
  }

  setWithIndex(key: string, value: any, predicates: string[] = []): void {
    this.set(key, value)
    
    // Index by predicates for faster invalidation
    for (const predicate of predicates) {
      if (!this.predicateIndex.has(predicate)) {
        this.predicateIndex.set(predicate, new Set())
      }
      this.predicateIndex.get(predicate)!.add(key)
    }
  }

  invalidateByPredicate(predicate: string): number {
    const keys = this.predicateIndex.get(predicate)
    if (!keys) return 0
    
    let invalidated = 0
    for (const key of keys) {
      if (this.delete(key)) {
        invalidated++
      }
    }
    
    this.predicateIndex.delete(predicate)
    return invalidated
  }

  clear(): void {
    super.clear()
    this.predicateIndex.clear()
  }

  getIndexStats(): {
    predicateCount: number
    averageKeysPerPredicate: number
    totalIndexedKeys: number
  } {
    const totalIndexedKeys = Array.from(this.predicateIndex.values())
      .reduce((sum, keys) => sum + keys.size, 0)
    
    return {
      predicateCount: this.predicateIndex.size,
      averageKeysPerPredicate: this.predicateIndex.size > 0 
        ? totalIndexedKeys / this.predicateIndex.size 
        : 0,
      totalIndexedKeys
    }
  }
}

/**
 * Memory-aware cache with automatic cleanup
 */
export class MemoryAwareCache<T> extends LRUCache<T> {
  private memoryCheckInterval: NodeJS.Timeout | null = null
  private maxMemoryMB: number
  
  constructor(options: CacheOptions & { maxMemoryMB?: number } = {}) {
    super(options)
    this.maxMemoryMB = options.maxMemoryMB || 100
    this.startMemoryMonitoring()
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage()
      const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024)
      
      if (heapUsedMB > this.maxMemoryMB) {
        this.performMemoryCleanup()
      }
    }, 30000) // Check every 30 seconds
  }

  private performMemoryCleanup(): void {
    const originalSize = this.size()
    const targetSize = Math.floor(originalSize * 0.7) // Remove 30% of entries
    
    while (this.size() > targetSize) {
      this.evictLeastRecentlyUsed()
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }

  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
    }
    this.clear()
  }
}

// Global cache instances
export const templateCache = new TemplateCache()
export const discoveryCache = new DiscoveryCache()
export const queryCache = new QueryCache()

/**
 * Get comprehensive cache statistics
 */
export function getCacheStats() {
  return {
    template: templateCache.getStats(),
    discovery: discoveryCache.getStats(),
    query: {
      ...queryCache.getStats(),
      ...queryCache.getIndexStats()
    }
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  templateCache.clear()
  discoveryCache.clear()
  queryCache.clear()
}