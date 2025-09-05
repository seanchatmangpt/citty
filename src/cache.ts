/**
 * Cache Module for Performance Optimization
 * Provides caching functionality for templates, ontologies, and generated content
 */

export interface CacheEntry<T = any> {
  value: T
  timestamp: number
  ttl?: number
  hits: number
}

export interface CacheOptions {
  maxSize?: number
  defaultTtl?: number
  cleanupInterval?: number
}

export interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRate: number
}

/**
 * In-memory cache with TTL support
 */
export class MemoryCache<T = any> {
  private store = new Map<string, CacheEntry<T>>()
  private options: Required<CacheOptions>
  private stats = { hits: 0, misses: 0 }
  private cleanupTimer?: NodeJS.Timeout

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTtl: options.defaultTtl || 5 * 60 * 1000, // 5 minutes
      cleanupInterval: options.cleanupInterval || 60 * 1000 // 1 minute
    }

    // Start cleanup timer
    this.startCleanup()
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key)
    
    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      this.stats.misses++
      return undefined
    }

    // Update stats
    entry.hits++
    this.stats.hits++
    
    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Check size limit
    if (this.store.size >= this.options.maxSize && !this.store.has(key)) {
      // Remove oldest entry
      const oldestKey = this.store.keys().next().value
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.options.defaultTtl,
      hits: 0
    }

    this.store.set(key, entry)
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.store.get(key)
    
    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0
    }
  }

  /**
   * Get or set pattern - if key exists, return it; otherwise compute and cache
   */
  async getOrSet(
    key: string, 
    factory: () => T | Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const existing = this.get(key)
    if (existing !== undefined) {
      return existing
    }

    const value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.options.cleanupInterval)

    // Prevent keeping the process alive
    this.cleanupTimer.unref?.()
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}

/**
 * Cache manager for different cache types
 */
export class CacheManager {
  private caches = new Map<string, MemoryCache>()

  /**
   * Get or create a cache instance
   */
  getCache<T = any>(name: string, options?: CacheOptions): MemoryCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MemoryCache<T>(options))
    }
    return this.caches.get(name) as MemoryCache<T>
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
  }

  /**
   * Get stats for all caches
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {}
    
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats()
    }
    
    return stats
  }

  /**
   * Destroy all caches
   */
  destroy(): void {
    for (const cache of this.caches.values()) {
      cache.destroy()
    }
    this.caches.clear()
  }
}

// Default cache instances
export const defaultCache = new MemoryCache()
export const templateCache = new MemoryCache<string>({ defaultTtl: 10 * 60 * 1000 }) // 10 min
export const ontologyCache = new MemoryCache({ defaultTtl: 30 * 60 * 1000 }) // 30 min
export const cacheManager = new CacheManager()

// Convenience functions
export const cache = {
  get: <T>(key: string) => defaultCache.get(key) as T | undefined,
  set: <T>(key: string, value: T, ttl?: number) => defaultCache.set(key, value, ttl),
  has: (key: string) => defaultCache.has(key),
  delete: (key: string) => defaultCache.delete(key),
  clear: () => defaultCache.clear(),
  getOrSet: <T>(key: string, factory: () => T | Promise<T>, ttl?: number) =>
    defaultCache.getOrSet(key, factory, ttl),
  stats: () => defaultCache.getStats()
}

export default cache