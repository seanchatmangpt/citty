import { LRUCache } from 'lru-cache'
import crypto from 'crypto'

// Cache middleware for Nuxt API routes
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

const cache = new LRUCache<string, CacheEntry>({
  max: 1000, // Maximum number of cached responses
  ttl: 5 * 60 * 1000, // Default 5 minutes TTL
})

// Cache configuration for different endpoints
const cacheConfig = {
  '/api/items': { ttl: 2 * 60 * 1000, vary: ['page', 'limit', 'category'] }, // 2 minutes
  '/api/search': { ttl: 5 * 60 * 1000, vary: ['q', 'category', 'page'] }, // 5 minutes
  '/api/auctions': { ttl: 30 * 1000, vary: ['status', 'page'] }, // 30 seconds (more dynamic)
  '/api/marketplace/featured': { ttl: 10 * 60 * 1000, vary: [] }, // 10 minutes
  default: { ttl: 5 * 60 * 1000, vary: [] }
}

export default defineEventHandler(async (event) => {
  // Only cache GET requests to API routes
  if (event.node.req.method !== 'GET' || !event.node.req.url?.startsWith('/api/')) {
    return
  }
  
  const url = new URL(event.node.req.url, 'http://localhost')
  const pathname = url.pathname
  
  // Skip caching for certain endpoints
  const noCacheEndpoints = ['/api/auth', '/api/transactions', '/api/user']
  if (noCacheEndpoints.some(endpoint => pathname.includes(endpoint))) {
    return
  }
  
  // Determine cache config for this endpoint
  let config = cacheConfig.default
  for (const [path, conf] of Object.entries(cacheConfig)) {
    if (path !== 'default' && pathname.includes(path)) {
      config = conf
      break
    }
  }
  
  // Create cache key based on URL and varying parameters
  const varyingParams: Record<string, string> = {}
  for (const param of config.vary) {
    const value = url.searchParams.get(param)
    if (value) {
      varyingParams[param] = value
    }
  }
  
  const cacheKeyData = {
    path: pathname,
    params: varyingParams,
    userAgent: getHeader(event, 'user-agent') || ''
  }
  
  const cacheKey = crypto
    .createHash('md5')
    .update(JSON.stringify(cacheKeyData))
    .digest('hex')
  
  // Check cache
  const cached = cache.get(cacheKey)
  const now = Date.now()
  
  if (cached && (now - cached.timestamp) < cached.ttl) {
    // Cache hit - return cached response
    setResponseHeaders(event, {
      'X-Cache': 'HIT',
      'X-Cache-TTL': Math.ceil((cached.ttl - (now - cached.timestamp)) / 1000).toString(),
      'Cache-Control': `public, max-age=${Math.ceil((cached.ttl - (now - cached.timestamp)) / 1000)}`
    })
    
    return cached.data
  }
  
  // Cache miss - continue to route handler
  // We'll store the response in the cache after the route handler executes
  
  // Hook into the response to cache it
  event.context.cacheKey = cacheKey
  event.context.cacheConfig = config
  
  setResponseHeaders(event, {
    'X-Cache': 'MISS'
  })
})

// Helper function to cache responses (called from API routes)
export function cacheResponse(event: any, data: any, customTTL?: number) {
  const cacheKey = event.context.cacheKey
  const config = event.context.cacheConfig
  
  if (cacheKey && config) {
    const ttl = customTTL || config.ttl
    
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    })
    
    setResponseHeaders(event, {
      'X-Cache-Status': 'STORED',
      'Cache-Control': `public, max-age=${Math.ceil(ttl / 1000)}`
    })
  }
  
  return data
}

// Helper function to invalidate cache entries
export function invalidateCache(pattern: string) {
  const keys = Array.from(cache.keys())
  const toDelete = keys.filter(key => key.includes(pattern))
  
  toDelete.forEach(key => cache.delete(key))
  
  console.log(`🗑️ Cache invalidated: ${toDelete.length} entries for pattern '${pattern}'`)
}

// Helper function to get cache stats
export function getCacheStats() {
  return {
    size: cache.size,
    calculatedSize: cache.calculatedSize,
    hitRatio: cache.hits / (cache.hits + cache.misses),
    hits: cache.hits,
    misses: cache.misses
  }
}