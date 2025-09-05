/**
 * Performance Optimization Composable
 * Provides intelligent caching, prefetching, and performance monitoring
 */

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size
  staleWhileRevalidate?: boolean // Return stale data while refetching
}

export interface PrefetchOptions {
  priority?: 'low' | 'medium' | 'high'
  condition?: () => boolean
  delay?: number
}

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: Date
  context?: Record<string, any>
}

export const usePerformance = () => {
  // LRU Cache implementation
  const cache = new Map<string, {
    data: any
    timestamp: Date
    ttl: number
    hits: number
  }>()
  
  const metrics = ref<PerformanceMetric[]>([])
  const maxMetrics = 100

  // Performance timing utilities
  const measurePerformance = <T>(
    name: string,
    operation: () => T | Promise<T>,
    context?: Record<string, any>
  ): T | Promise<T> => {
    const startTime = performance.now()
    
    const recordMetric = (value: number) => {
      const metric: PerformanceMetric = {
        name,
        value,
        timestamp: new Date(),
        context
      }
      
      metrics.value.unshift(metric)
      if (metrics.value.length > maxMetrics) {
        metrics.value = metrics.value.slice(0, maxMetrics)
      }
    }

    if (operation instanceof Function && operation.constructor.name === 'AsyncFunction') {
      return (operation as () => Promise<T>)().then(result => {
        recordMetric(performance.now() - startTime)
        return result
      }).catch(error => {
        recordMetric(performance.now() - startTime)
        throw error
      })
    } else {
      const result = operation() as T
      recordMetric(performance.now() - startTime)
      return result
    }
  }

  // Smart caching with TTL and LRU eviction
  const cacheSet = (key: string, data: any, options: CacheOptions = {}) => {
    const {
      ttl = 300000, // 5 minutes default
      maxSize = 100
    } = options

    // LRU eviction
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value
      cache.delete(oldestKey)
    }

    cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
      hits: 0
    })
  }

  const cacheGet = (key: string, options: CacheOptions = {}): any | null => {
    const entry = cache.get(key)
    if (!entry) return null

    const now = Date.now()
    const age = now - entry.timestamp.getTime()

    // Check if expired
    if (age > entry.ttl) {
      cache.delete(key)
      return null
    }

    // Update hit count and move to end (LRU)
    entry.hits++
    cache.delete(key)
    cache.set(key, entry)

    return entry.data
  }

  // Cache with stale-while-revalidate pattern
  const cacheWithSWR = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> => {
    const cached = cacheGet(key, options)
    
    if (cached && !options.staleWhileRevalidate) {
      return cached
    }

    // If we have stale data, return it immediately and refetch in background
    if (cached && options.staleWhileRevalidate) {
      // Background refetch
      fetcher().then(freshData => {
        cacheSet(key, freshData, options)
      }).catch(error => {
        console.warn('Background refetch failed:', error)
      })
      
      return cached
    }

    // No cached data, fetch fresh
    try {
      const data = await measurePerformance(
        `cache-miss-${key}`,
        fetcher,
        { cacheKey: key }
      ) as T
      
      cacheSet(key, data, options)
      return data
    } catch (error) {
      // Return stale data if available during error
      if (cached) {
        console.warn('Fetcher failed, returning stale data:', error)
        return cached
      }
      throw error
    }
  }

  // Intelligent prefetching
  const prefetchQueue = new Map<string, {
    fetcher: () => Promise<any>
    options: PrefetchOptions
    scheduled: boolean
  }>()

  const prefetch = (
    key: string,
    fetcher: () => Promise<any>,
    options: PrefetchOptions = {}
  ) => {
    const {
      priority = 'low',
      condition = () => true,
      delay = 0
    } = options

    // Don't prefetch if already cached
    if (cacheGet(key)) return

    // Add to prefetch queue
    prefetchQueue.set(key, {
      fetcher,
      options,
      scheduled: false
    })

    // Schedule prefetch based on priority
    const scheduleTime = priority === 'high' ? 0 : priority === 'medium' ? 100 : 1000
    
    setTimeout(() => {
      executePrefetch(key)
    }, scheduleTime + delay)
  }

  const executePrefetch = async (key: string) => {
    const item = prefetchQueue.get(key)
    if (!item || item.scheduled) return

    // Check condition before prefetching
    if (!item.options.condition?.()) {
      prefetchQueue.delete(key)
      return
    }

    item.scheduled = true

    try {
      const data = await measurePerformance(
        `prefetch-${key}`,
        item.fetcher,
        { prefetch: true, cacheKey: key }
      )
      
      cacheSet(key, data, { ttl: 600000 }) // 10 minute TTL for prefetched data
      prefetchQueue.delete(key)
    } catch (error) {
      console.warn('Prefetch failed:', key, error)
      prefetchQueue.delete(key)
    }
  }

  // Image optimization and lazy loading
  const optimizeImage = (src: string, options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpg' | 'png'
  } = {}) => {
    const { width, height, quality = 80, format } = options
    
    // In production, this would integrate with image optimization service
    // For now, return optimized URL structure
    const params = new URLSearchParams()
    if (width) params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    if (quality !== 80) params.set('q', quality.toString())
    if (format) params.set('f', format)
    
    const hasParams = params.toString()
    return hasParams ? `${src}?${params.toString()}` : src
  }

  // Resource hints for browser optimization
  const addResourceHint = (href: string, rel: 'preload' | 'prefetch' | 'dns-prefetch' | 'preconnect') => {
    if (process.client) {
      const existing = document.querySelector(`link[href="${href}"][rel="${rel}"]`)
      if (existing) return

      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      
      if (rel === 'preload') {
        // Determine resource type
        if (href.match(/\.(js|mjs)$/)) link.as = 'script'
        else if (href.match(/\.css$/)) link.as = 'style'
        else if (href.match(/\.(jpg|jpeg|png|webp|avif|gif|svg)$/)) link.as = 'image'
        else if (href.match(/\.(woff|woff2|ttf|otf)$/)) link.as = 'font'
      }
      
      document.head.appendChild(link)
    }
  }

  // Bundle splitting and dynamic imports
  const lazyImport = <T>(
    importFn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> => {
    return measurePerformance(
      'dynamic-import',
      async () => {
        try {
          return await importFn()
        } catch (error) {
          if (fallback) {
            console.warn('Dynamic import failed, using fallback:', error)
            return fallback()
          }
          throw error
        }
      },
      { dynamicImport: true }
    ) as Promise<T>
  }

  // Performance monitoring
  const getPerformanceStats = computed(() => {
    const recentMetrics = metrics.value.slice(0, 50)
    
    const byName = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = []
      }
      acc[metric.name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>)

    const stats = Object.entries(byName).map(([name, values]) => ({
      name,
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)] || 0
    }))

    return {
      totalMetrics: metrics.value.length,
      cacheSize: cache.size,
      cacheHitRate: calculateCacheHitRate(),
      prefetchQueueSize: prefetchQueue.size,
      performanceByOperation: stats
    }
  })

  const calculateCacheHitRate = (): number => {
    const entries = Array.from(cache.values())
    if (entries.length === 0) return 0
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    const totalRequests = entries.length + totalHits
    
    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
  }

  // Memory management
  const clearCache = () => {
    cache.clear()
  }

  const clearMetrics = () => {
    metrics.value = []
  }

  const cleanup = () => {
    clearCache()
    clearMetrics()
    prefetchQueue.clear()
  }

  // Automatic cleanup on unmount
  onUnmounted(cleanup)

  return {
    // Caching
    cacheGet,
    cacheSet,
    cacheWithSWR,
    
    // Prefetching
    prefetch,
    
    // Performance measurement
    measurePerformance,
    
    // Optimization utilities
    optimizeImage,
    addResourceHint,
    lazyImport,
    
    // Stats and monitoring
    getPerformanceStats,
    metrics: readonly(metrics),
    
    // Management
    clearCache,
    clearMetrics,
    cleanup
  }
}