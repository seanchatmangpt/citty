/**
 * Performance monitoring and optimization utilities
 */

import { performance } from 'node:perf_hooks'
import { getCacheStats } from './cache'

export interface PerformanceMetrics {
  renderTime: number
  templateDiscovery: number
  cacheHitRate: number
  memoryUsage: NodeJS.MemoryUsage
  timestamp: number
}

export interface PerformanceHooks {
  onRenderStart?: (templatePath: string) => void
  onRenderEnd?: (templatePath: string, duration: number) => void
  onCacheHit?: (key: string, type: 'template' | 'discovery' | 'result') => void
  onCacheMiss?: (key: string, type: 'template' | 'discovery' | 'result') => void
  onMemoryWarning?: (usage: NodeJS.MemoryUsage) => void
  onPerformanceReport?: (metrics: PerformanceMetrics) => void
}

class PerformanceMonitor {
  private hooks: PerformanceHooks = {}
  private metrics: PerformanceMetrics[] = []
  private renderTimings = new Map<string, number>()
  private memoryCheckInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.startMemoryMonitoring()
  }

  /**
   * Register performance hooks
   */
  registerHooks(hooks: PerformanceHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Start render timing
   */
  startRender(templatePath: string): void {
    const start = performance.now()
    this.renderTimings.set(templatePath, start)
    this.hooks.onRenderStart?.(templatePath)
  }

  /**
   * End render timing
   */
  endRender(templatePath: string): number {
    const start = this.renderTimings.get(templatePath)
    if (!start) return 0
    
    const duration = performance.now() - start
    this.renderTimings.delete(templatePath)
    this.hooks.onRenderEnd?.(templatePath, duration)
    
    return duration
  }

  /**
   * Record cache hit
   */
  recordCacheHit(key: string, type: 'template' | 'discovery' | 'result'): void {
    this.hooks.onCacheHit?.(key, type)
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(key: string, type: 'template' | 'discovery' | 'result'): void {
    this.hooks.onCacheMiss?.(key, type)
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const cacheStats = getCacheStats()
    const memoryUsage = process.memoryUsage()
    
    // Calculate average render time from recent renders
    const recentMetrics = this.metrics.slice(-10)
    const avgRenderTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length
      : 0

    // Calculate cache hit rate across all caches
    const totalHits = Object.values(cacheStats).reduce((sum, stats) => sum + (stats.size || 0), 0)
    const totalAccesses = Object.values(cacheStats).reduce((sum, stats) => sum + (stats.totalAccesses || 0), 0)
    const cacheHitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0

    const metrics: PerformanceMetrics = {
      renderTime: avgRenderTime,
      templateDiscovery: 0, // Would need to track this separately
      cacheHitRate,
      memoryUsage,
      timestamp: Date.now()
    }

    this.metrics.push(metrics)
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    this.hooks.onPerformanceReport?.(metrics)
    
    return metrics
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    current: PerformanceMetrics
    average: Partial<PerformanceMetrics>
    trends: {
      renderTime: number[]
      memoryUsage: number[]
      cacheHitRate: number[]
    }
    recommendations: string[]
  } {
    const current = this.getMetrics()
    const recent = this.metrics.slice(-20)
    
    const average = recent.length > 0 ? {
      renderTime: recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length,
      cacheHitRate: recent.reduce((sum, m) => sum + m.cacheHitRate, 0) / recent.length
    } : {}

    const trends = {
      renderTime: recent.map(m => m.renderTime),
      memoryUsage: recent.map(m => m.memoryUsage.heapUsed / (1024 * 1024)), // MB
      cacheHitRate: recent.map(m => m.cacheHitRate)
    }

    const recommendations = this.generateRecommendations(current, average)

    return {
      current,
      average,
      trends,
      recommendations
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    current: PerformanceMetrics, 
    average: Partial<PerformanceMetrics>
  ): string[] {
    const recommendations: string[] = []
    
    // Memory usage recommendations
    const heapUsedMB = current.memoryUsage.heapUsed / (1024 * 1024)
    if (heapUsedMB > 500) {
      recommendations.push('High memory usage detected. Consider clearing unused caches.')
    }
    
    // Cache hit rate recommendations
    if (current.cacheHitRate < 0.7) {
      recommendations.push('Low cache hit rate. Consider increasing cache TTL or size.')
    }
    
    // Render time recommendations
    if (current.renderTime > 100) {
      recommendations.push('Slow template rendering detected. Consider template optimization or caching.')
    }
    
    // General recommendations
    const cacheStats = getCacheStats()
    const totalCacheSize = Object.values(cacheStats).reduce((sum, stats) => sum + stats.size, 0)
    
    if (totalCacheSize < 10) {
      recommendations.push('Low cache utilization. Templates may not be cached effectively.')
    }
    
    return recommendations
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage()
      const heapUsedMB = usage.heapUsed / (1024 * 1024)
      
      // Warn if heap usage exceeds 1GB
      if (heapUsedMB > 1000) {
        this.hooks.onMemoryWarning?.(usage)
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
    }
    
    this.renderTimings.clear()
    this.metrics = []
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Performance measurement decorator
 */
export function measurePerformance<T extends any[], R>(
  name: string,
  fn: (...args: T) => R
): (...args: T) => R {
  return function(...args: T): R {
    const start = performance.now()
    
    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result && typeof result === 'object' && 'then' in result) {
        return (result as Promise<any>).finally(() => {
          const duration = performance.now() - start
          console.debug(`${name} completed in ${duration.toFixed(2)}ms`)
        }) as R
      }
      
      const duration = performance.now() - start
      console.debug(`${name} completed in ${duration.toFixed(2)}ms`)
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.debug(`${name} failed after ${duration.toFixed(2)}ms`)
      throw error
    }
  }
}

/**
 * Batch performance measurements
 */
export function measureBatch<T>(
  name: string,
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  const start = performance.now()
  
  return Promise.all(operations.map(op => op()))
    .finally(() => {
      const duration = performance.now() - start
      console.debug(`${name} batch (${operations.length} operations) completed in ${duration.toFixed(2)}ms`)
    })
}

/**
 * Create performance-optimized function with automatic caching
 */
export function optimizeFunction<T extends any[], R>(
  fn: (...args: T) => R,
  options: {
    name?: string
    cacheKey?: (...args: T) => string
    ttl?: number
  } = {}
): (...args: T) => R {
  const cache = new Map<string, { value: R; timestamp: number }>()
  const { name = 'optimized-function', cacheKey, ttl = 60000 } = options
  
  return function(...args: T): R {
    // Generate cache key
    const key = cacheKey ? cacheKey(...args) : JSON.stringify(args)
    
    // Check cache
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttl) {
      performanceMonitor.recordCacheHit(key, 'result')
      return cached.value
    }
    
    performanceMonitor.recordCacheMiss(key, 'result')
    
    // Measure execution
    const start = performance.now()
    const result = fn(...args)
    const duration = performance.now() - start
    
    // Cache result
    cache.set(key, { value: result, timestamp: Date.now() })
    
    // Cleanup old entries
    if (cache.size > 1000) {
      const now = Date.now()
      for (const [k, entry] of cache) {
        if (now - entry.timestamp > ttl) {
          cache.delete(k)
        }
      }
    }
    
    console.debug(`${name} executed in ${duration.toFixed(2)}ms`)
    
    return result
  }
}

/**
 * Resource cleanup utility
 */
export class ResourceManager {
  private resources = new Set<{ destroy(): void }>()
  
  register<T extends { destroy(): void }>(resource: T): T {
    this.resources.add(resource)
    return resource
  }
  
  cleanup(): void {
    for (const resource of this.resources) {
      try {
        resource.destroy()
      } catch (error) {
        console.warn('Error cleaning up resource:', error)
      }
    }
    this.resources.clear()
  }
}

// Global resource manager
export const resourceManager = new ResourceManager()

/**
 * Automatic cleanup on process exit
 */
process.on('beforeExit', () => {
  performanceMonitor.destroy()
  resourceManager.cleanup()
})

process.on('SIGTERM', () => {
  performanceMonitor.destroy()
  resourceManager.cleanup()
  process.exit(0)
})

process.on('SIGINT', () => {
  performanceMonitor.destroy()
  resourceManager.cleanup()
  process.exit(0)
})