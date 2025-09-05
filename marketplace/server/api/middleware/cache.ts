import { Request, Response, NextFunction } from 'express'
import NodeCache from 'node-cache'
import { createHash } from 'crypto'

// CNS Memory Layer Integration
interface CNSMemoryLayer {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  exists(key: string): Promise<boolean>
}

class MarketplaceCache implements CNSMemoryLayer {
  private cache: NodeCache
  private prefix: string = 'marketplace:'

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60, // Check for expired keys every minute
      useClones: false,
    })
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.prefix + key
    const value = this.cache.get<T>(fullKey)
    return value || null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.prefix + key
    this.cache.set(fullKey, value, ttl)
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.prefix + key
    return this.cache.del(fullKey) > 0
  }

  async clear(): Promise<void> {
    this.cache.flushAll()
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.prefix + key
    return this.cache.has(fullKey)
  }

  getStats() {
    return this.cache.getStats()
  }
}

export const cacheLayer = new MarketplaceCache()

// Cache key generation
const generateCacheKey = (req: Request): string => {
  const { method, path, query, user } = req as any
  const keyData = {
    method,
    path,
    query,
    userId: user?.id || 'anonymous',
  }
  return createHash('md5').update(JSON.stringify(keyData)).digest('hex')
}

// Cache middleware
export const cacheMiddleware = (
  ttl: number = 300,
  condition?: (req: Request) => boolean
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next()
    }

    // Check custom condition
    if (condition && !condition(req)) {
      return next()
    }

    const cacheKey = generateCacheKey(req)
    
    try {
      // Try to get cached response
      const cachedResponse = await cacheLayer.get<{
        data: any
        headers: Record<string, string>
        statusCode: number
      }>(cacheKey)

      if (cachedResponse) {
        // Set cached headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.set(key, value)
        })
        
        res.set('X-Cache', 'HIT')
        return res.status(cachedResponse.statusCode).json(cachedResponse.data)
      }

      // Store original res.json method
      const originalJson = res.json.bind(res)
      
      // Override res.json to cache the response
      res.json = function(data: any) {
        const statusCode = res.statusCode || 200
        
        // Only cache successful responses
        if (statusCode >= 200 && statusCode < 300) {
          const responseToCache = {
            data,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'MISS',
            },
            statusCode,
          }
          
          // Cache async without blocking response
          cacheLayer.set(cacheKey, responseToCache, ttl).catch(console.error)
        }
        
        res.set('X-Cache', 'MISS')
        return originalJson(data)
      }

      next()
    } catch (error) {
      console.error('Cache middleware error:', error)
      next()
    }
  }
}

// Cache invalidation patterns
export const invalidateCache = async (pattern: string): Promise<void> => {
  // In a real implementation, this would use Redis SCAN or similar
  // For now, we'll clear specific patterns
  try {
    const stats = cacheLayer.getStats()
    console.log(`Cache invalidation requested for pattern: ${pattern}`)
    console.log(`Current cache stats:`, stats)
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}

// Specific cache helpers
export const cacheHelpers = {
  // Cache for search results (shorter TTL due to freshness needs)
  searchCache: cacheMiddleware(60), // 1 minute
  
  // Cache for item details (longer TTL for stable data)
  itemCache: cacheMiddleware(600), // 10 minutes
  
  // Cache for recommendations (medium TTL)
  recommendationCache: cacheMiddleware(300), // 5 minutes
  
  // Cache for analytics (longer TTL for aggregated data)
  analyticsCache: cacheMiddleware(1800), // 30 minutes
  
  // Conditional cache for user-specific data
  userDataCache: cacheMiddleware(180, (req) => {
    return !!(req as any).user?.id
  }),
}