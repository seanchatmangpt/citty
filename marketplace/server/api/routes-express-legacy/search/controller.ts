import { Request, Response } from 'express'
import { ApiError } from '../../utils/errors.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

interface SearchQuery {
  q?: string
  category?: string
  tags?: string[]
  minPrice?: number
  maxPrice?: number
  condition?: string[]
  location?: string
  sortBy?: 'price' | 'date' | 'relevance' | 'popularity'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
  facets?: string[]
}

interface SearchResult {
  items: any[]
  facets: {
    categories: { name: string, count: number }[]
    tags: { name: string, count: number }[]
    conditions: { name: string, count: number }[]
    priceRanges: { range: string, min: number, max: number, count: number }[]
    locations: { name: string, count: number }[]
  }
  suggestions: string[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  searchTime: number
}

// Mock search index and analytics
const mockSearchData = {
  savedSearches: new Map<string, any[]>(),
  searchHistory: [] as any[],
  popularTerms: new Map<string, number>(),
  suggestions: [
    'vintage leather jacket',
    'macbook pro',
    'iphone 14',
    'vintage watch',
    'gaming laptop',
    'designer handbag',
    'vintage vinyl records',
    'professional camera',
  ],
}

export const searchController = {
  // GET /api/search - Multi-dimensional search
  async search(req: Request, res: Response) {
    const startTime = Date.now()
    const query = req.query as SearchQuery

    // Build Elasticsearch-style query (mock implementation)
    const searchFilters: any = {
      bool: {
        must: [],
        filter: [],
        should: [],
      },
    }

    // Text search
    if (query.q) {
      searchFilters.bool.must.push({
        multi_match: {
          query: query.q,
          fields: ['title^2', 'description', 'tags'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      })
    }

    // Category filter
    if (query.category) {
      searchFilters.bool.filter.push({
        term: { category: query.category },
      })
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      searchFilters.bool.filter.push({
        terms: { tags: query.tags },
      })
    }

    // Price range
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const rangeFilter: any = { range: { price: {} } }
      if (query.minPrice !== undefined) rangeFilter.range.price.gte = query.minPrice
      if (query.maxPrice !== undefined) rangeFilter.range.price.lte = query.maxPrice
      searchFilters.bool.filter.push(rangeFilter)
    }

    // Condition filter
    if (query.condition && query.condition.length > 0) {
      searchFilters.bool.filter.push({
        terms: { condition: query.condition },
      })
    }

    // Location filter
    if (query.location) {
      searchFilters.bool.should.push(
        { match: { 'location.country': query.location } },
        { match: { 'location.state': query.location } },
        { match: { 'location.city': query.location } }
      )
      searchFilters.bool.minimum_should_match = 1
    }

    // Mock search execution (in production, this would use Elasticsearch/Solr)
    const mockResults = await executeSearch(searchFilters, {
      sortBy: query.sortBy || 'relevance',
      sortOrder: query.sortOrder || 'desc',
      page: query.page || 1,
      limit: query.limit || 20,
      includeFacets: query.facets && query.facets.length > 0,
    })

    const searchTime = Date.now() - startTime

    // Track search for analytics
    if (query.q) {
      const currentCount = mockSearchData.popularTerms.get(query.q) || 0
      mockSearchData.popularTerms.set(query.q, currentCount + 1)
    }

    const result: SearchResult = {
      ...mockResults,
      searchTime,
    }

    res.json({
      success: true,
      data: result,
      meta: {
        query: searchFilters,
        executionTime: searchTime,
      },
    })
  },

  // GET /api/search/facets - Get available search facets
  async getFacets(req: Request, res: Response) {
    // Mock facet aggregation
    const facets = {
      categories: [
        { name: 'electronics', count: 1250 },
        { name: 'clothing', count: 850 },
        { name: 'home', count: 620 },
        { name: 'books', count: 430 },
        { name: 'sports', count: 320 },
      ],
      tags: [
        { name: 'vintage', count: 180 },
        { name: 'new', count: 95 },
        { name: 'rare', count: 65 },
        { name: 'collectible', count: 45 },
        { name: 'handmade', count: 38 },
      ],
      conditions: [
        { name: 'new', count: 2100 },
        { name: 'like-new', count: 980 },
        { name: 'good', count: 650 },
        { name: 'fair', count: 280 },
        { name: 'poor', count: 90 },
      ],
      priceRanges: [
        { range: '$0-$25', min: 0, max: 25, count: 450 },
        { range: '$25-$100', min: 25, max: 100, count: 1200 },
        { range: '$100-$500', min: 100, max: 500, count: 800 },
        { range: '$500-$1000', min: 500, max: 1000, count: 350 },
        { range: '$1000+', min: 1000, max: Infinity, count: 200 },
      ],
      locations: [
        { name: 'USA', count: 2800 },
        { name: 'Canada', count: 450 },
        { name: 'UK', count: 380 },
        { name: 'Germany', count: 290 },
        { name: 'Australia', count: 180 },
      ],
    }

    res.json({
      success: true,
      data: { facets },
    })
  },

  // GET /api/search/suggestions - Autocomplete suggestions
  async getSuggestions(req: Request, res: Response) {
    const { q, limit = 10 } = req.query as { q?: string, limit?: number }

    if (!q || typeof q !== 'string') {
      return res.json({
        success: true,
        data: { suggestions: mockSearchData.suggestions.slice(0, limit) },
      })
    }

    const searchTerm = q.toLowerCase()
    const suggestions = mockSearchData.suggestions
      .filter(suggestion => suggestion.toLowerCase().includes(searchTerm))
      .slice(0, limit)

    // Add popular search terms that match
    const popularSuggestions = Array.from(mockSearchData.popularTerms.entries())
      .filter(([term]) => term.toLowerCase().includes(searchTerm))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term)

    const allSuggestions = [...new Set([...suggestions, ...popularSuggestions])]
      .slice(0, limit)

    res.json({
      success: true,
      data: {
        suggestions: allSuggestions,
        query: q,
      },
    })
  },

  // POST /api/search/saved - Save search query
  async saveSearch(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) {
      throw new ApiError(401, 'Authentication required to save searches')
    }

    const { name, query, alerts = false } = req.body

    if (!name || !query) {
      throw new ApiError(400, 'Name and query are required')
    }

    const savedSearch = {
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      alerts,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
    }

    if (!mockSearchData.savedSearches.has(userId)) {
      mockSearchData.savedSearches.set(userId, [])
    }

    const userSearches = mockSearchData.savedSearches.get(userId)!
    userSearches.push(savedSearch)

    res.json({
      success: true,
      data: { savedSearch },
      message: 'Search saved successfully',
    })
  },

  // GET /api/search/saved - Get saved searches
  async getSavedSearches(req: AuthRequest, res: Response) {
    const userId = req.user?.id
    if (!userId) {
      throw new ApiError(401, 'Authentication required')
    }

    const userSearches = mockSearchData.savedSearches.get(userId) || []

    res.json({
      success: true,
      data: {
        savedSearches: userSearches.sort((a, b) => 
          new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        ),
      },
    })
  },

  // DELETE /api/search/saved/:id - Delete saved search
  async deleteSavedSearch(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, 'Authentication required')
    }

    const userSearches = mockSearchData.savedSearches.get(userId) || []
    const searchIndex = userSearches.findIndex(search => search.id === id)

    if (searchIndex === -1) {
      throw new ApiError(404, 'Saved search not found')
    }

    userSearches.splice(searchIndex, 1)

    res.json({
      success: true,
      message: 'Saved search deleted successfully',
    })
  },

  // GET /api/search/trending - Get trending searches
  async getTrendingSearches(req: Request, res: Response) {
    const { limit = 20, period = '24h' } = req.query as any

    // Mock trending searches based on popularity
    const trending = Array.from(mockSearchData.popularTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count], index) => ({
        rank: index + 1,
        term,
        searchCount: count,
        change: Math.floor(Math.random() * 200 - 100), // Mock change percentage
      }))

    res.json({
      success: true,
      data: {
        trending,
        period,
        generatedAt: new Date(),
      },
    })
  },

  // POST /api/search/track - Track search for analytics
  async trackSearch(req: Request, res: Response) {
    const { query, userId, sessionId, resultCount, clickPosition } = req.body

    const searchEvent = {
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      userId: userId || null,
      sessionId: sessionId || null,
      resultCount: resultCount || 0,
      clickPosition: clickPosition || null,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }

    mockSearchData.searchHistory.push(searchEvent)

    // Update popular terms
    if (query) {
      const currentCount = mockSearchData.popularTerms.get(query) || 0
      mockSearchData.popularTerms.set(query, currentCount + 1)
    }

    res.json({
      success: true,
      data: { tracked: true, eventId: searchEvent.id },
    })
  },
}

// Helper function to mock search execution
async function executeSearch(query: any, options: any) {
  // Mock search results - in production, this would query Elasticsearch/Solr
  const mockItems = [
    {
      id: 'item-1',
      title: 'Vintage Leather Jacket',
      description: 'Authentic vintage leather jacket in excellent condition.',
      price: 89.99,
      category: 'clothing',
      tags: ['vintage', 'leather', 'jacket'],
      condition: 'good',
      location: { country: 'USA', state: 'CA', city: 'Los Angeles' },
      images: ['/images/jacket1.jpg'],
      sellerId: 'user-1',
      score: 0.95, // Relevance score
    },
    {
      id: 'item-2',
      title: 'MacBook Pro 13" M2',
      description: 'Apple MacBook Pro 13-inch with M2 chip, barely used.',
      price: 1199.99,
      category: 'electronics',
      tags: ['apple', 'macbook', 'laptop'],
      condition: 'like-new',
      location: { country: 'USA', state: 'NY', city: 'New York' },
      images: ['/images/macbook1.jpg'],
      sellerId: 'user-2',
      score: 0.88,
    },
  ]

  // Apply sorting
  if (options.sortBy === 'price') {
    mockItems.sort((a, b) => 
      options.sortOrder === 'desc' ? b.price - a.price : a.price - b.price
    )
  } else if (options.sortBy === 'relevance') {
    mockItems.sort((a, b) => 
      options.sortOrder === 'desc' ? b.score - a.score : a.score - b.score
    )
  }

  // Apply pagination
  const startIndex = ((options.page || 1) - 1) * (options.limit || 20)
  const endIndex = startIndex + (options.limit || 20)
  const paginatedItems = mockItems.slice(startIndex, endIndex)

  return {
    items: paginatedItems,
    facets: {
      categories: [{ name: 'electronics', count: 1 }, { name: 'clothing', count: 1 }],
      tags: [{ name: 'vintage', count: 1 }, { name: 'apple', count: 1 }],
      conditions: [{ name: 'good', count: 1 }, { name: 'like-new', count: 1 }],
      priceRanges: [{ range: '$0-$100', min: 0, max: 100, count: 1 }, { range: '$1000+', min: 1000, max: Infinity, count: 1 }],
      locations: [{ name: 'USA', count: 2 }],
    },
    suggestions: ['leather jacket', 'macbook pro', 'vintage items'],
    pagination: {
      page: options.page || 1,
      limit: options.limit || 20,
      total: mockItems.length,
      totalPages: Math.ceil(mockItems.length / (options.limit || 20)),
      hasNext: endIndex < mockItems.length,
      hasPrev: (options.page || 1) > 1,
    },
  }
}