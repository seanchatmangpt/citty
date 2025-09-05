import NodeCache from 'node-cache'

// Initialize cache instance with default TTL of 5 minutes
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false
})

/**
 * Cache utility functions
 */
export const useCache = () => {
  return {
    /**
     * Get value from cache
     */
    async get<T = any>(key: string): Promise<T | undefined> {
      return cache.get<T>(key)
    },

    /**
     * Set value in cache with optional TTL
     */
    async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
      return cache.set(key, value, ttl || 300)
    },

    /**
     * Delete value from cache
     */
    async del(key: string | string[]): Promise<number> {
      return cache.del(key)
    },

    /**
     * Check if key exists in cache
     */
    async has(key: string): Promise<boolean> {
      return cache.has(key)
    },

    /**
     * Get cache statistics
     */
    getStats() {
      return cache.getStats()
    },

    /**
     * Clear all cache
     */
    async flush(): Promise<void> {
      cache.flushAll()
    },

    /**
     * Get all keys
     */
    getKeys(): string[] {
      return cache.keys()
    },

    /**
     * Get multiple values
     */
    async mget<T = any>(keys: string[]): Promise<{ [key: string]: T }> {
      return cache.mget(keys)
    },

    /**
     * Set multiple values
     */
    async mset<T = any>(values: Array<{ key: string; val: T; ttl?: number }>): Promise<boolean> {
      return cache.mset(values)
    }
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  items: {
    list: (query: string) => `items:list:${Buffer.from(query).toString('base64')}`,
    detail: (id: string) => `item:${id}`,
    similar: (id: string, limit: number) => `item:${id}:similar:${limit}`,
    history: (id: string) => `item:${id}:history`,
  },
  auctions: {
    list: (query: string) => `auctions:list:${Buffer.from(query).toString('base64')}`,
    detail: (id: string) => `auction:${id}`,
    bids: (id: string) => `auction:${id}:bids`,
  },
  transactions: {
    list: (query: string) => `transactions:list:${Buffer.from(query).toString('base64')}`,
    detail: (id: string) => `transaction:${id}`,
    user: (userId: string) => `user:${userId}:transactions`,
  },
  recommendations: (query: string) => `recommendations:${Buffer.from(query).toString('base64')}`,
  search: {
    results: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
    facets: () => 'search:facets',
  },
  user: {
    profile: (id: string) => `user:${id}:profile`,
    items: (id: string) => `user:${id}:items`,
    favorites: (id: string) => `user:${id}:favorites`,
    orders: (id: string) => `user:${id}:orders`,
  },
  analytics: {
    metrics: (type: string, period: string) => `analytics:${type}:${period}`,
    summary: (date: string) => `analytics:summary:${date}`,
  }
}

/**
 * Cache invalidation helpers
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const keys = cache.keys()
  const keysToDelete = keys.filter(key => key.includes(pattern))
  
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete)
  }
}

/**
 * Cache middleware for search results
 */
export const cacheHelpers = {
  /**
   * Search cache middleware
   */
  searchCache: async (query: any) => {
    const cacheKey = cacheKeys.search.results(JSON.stringify(query))
    const cached = await useCache().get(cacheKey)
    return cached
  },

  /**
   * Item cache middleware
   */
  itemCache: async (itemId: string) => {
    const cacheKey = cacheKeys.items.detail(itemId)
    const cached = await useCache().get(cacheKey)
    return cached
  },

  /**
   * Recommendation cache middleware
   */
  recommendationCache: async (query: any) => {
    const cacheKey = cacheKeys.recommendations(JSON.stringify(query))
    const cached = await useCache().get(cacheKey)
    return cached
  },

  /**
   * User cache middleware
   */
  userCache: async (userId: string, type: string = 'profile') => {
    const cacheKey = cacheKeys.user.profile(userId)
    const cached = await useCache().get(cacheKey)
    return cached
  }
}

/**
 * Cache warming functions
 */
export const cacheWarming = {
  /**
   * Warm up popular items cache
   */
  async warmPopularItems(): Promise<void> {
    // Implementation would fetch popular items and cache them
    console.log('Warming popular items cache...')
  },

  /**
   * Warm up search facets cache
   */
  async warmSearchFacets(): Promise<void> {
    // Implementation would fetch and cache common search facets
    console.log('Warming search facets cache...')
  },

  /**
   * Warm up category listings
   */
  async warmCategories(): Promise<void> {
    // Implementation would fetch and cache category data
    console.log('Warming categories cache...')
  }
}

/**
 * Cache cleanup functions
 */
export const cacheCleanup = {
  /**
   * Clean up expired user sessions
   */
  async cleanExpiredSessions(): Promise<void> {
    const keys = cache.keys().filter(key => key.startsWith('session:'))
    // Logic to check and remove expired sessions
    console.log(`Cleaning ${keys.length} session keys...`)
  },

  /**
   * Clean up old search results
   */
  async cleanOldSearches(): Promise<void> {
    const keys = cache.keys().filter(key => key.startsWith('search:'))
    // Logic to remove old search results
    console.log(`Cleaning ${keys.length} search result keys...`)
  }
}