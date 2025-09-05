import { z } from 'zod'
import { validateJWT, requirePermission } from '~/server/utils/auth'
import { useCache, cacheKeys } from '~/server/utils/cache'
import { ApiError, NotFoundError } from '~/server/utils/errors'

// Validation schema for query parameters
const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).or(z.string()).transform(val => Array.isArray(val) ? val : [val]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  condition: z.array(z.enum(['new', 'like-new', 'good', 'fair', 'poor'])).or(z.string()).optional(),
  location: z.string().optional(),
  sortBy: z.enum(['price', 'date', 'relevance', 'popularity']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

interface Item {
  id: string
  title: string
  description: string
  price: number
  category: string
  tags: string[]
  images: string[]
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
  location: {
    country: string
    state?: string
    city?: string
    zipCode?: string
  }
  shipping: {
    available: boolean
    cost?: number
    methods: string[]
  }
  specifications: Record<string, any>
  isActive: boolean
  sellerId: string
  createdAt: Date
  updatedAt: Date
  views: number
  favorites: number
}

// Mock database - In production, this would be a real database
const mockDatabase = {
  items: new Map<string, Item>(),
  views: new Map<string, number>(),
  favorites: new Map<string, Set<string>>(),
}

// Initialize mock data
const initMockData = () => {
  const sampleItems: Item[] = [
    {
      id: 'item-1',
      title: 'Vintage Leather Jacket',
      description: 'Authentic vintage leather jacket in excellent condition. Perfect for fashion enthusiasts.',
      price: 89.99,
      category: 'clothing',
      tags: ['vintage', 'leather', 'jacket', 'fashion'],
      images: ['/images/jacket1.jpg', '/images/jacket2.jpg'],
      condition: 'good',
      location: { country: 'USA', state: 'CA', city: 'Los Angeles' },
      shipping: { available: true, cost: 15.00, methods: ['standard', 'express'] },
      specifications: { size: 'M', brand: 'Unknown', material: 'Genuine Leather' },
      isActive: true,
      sellerId: 'user-1',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
      views: 24,
      favorites: 3,
    },
    {
      id: 'item-2',
      title: 'MacBook Pro 13" M2',
      description: 'Apple MacBook Pro 13-inch with M2 chip, 256GB storage, 8GB RAM. Barely used, in pristine condition.',
      price: 1199.99,
      category: 'electronics',
      tags: ['apple', 'macbook', 'laptop', 'computer'],
      images: ['/images/macbook1.jpg', '/images/macbook2.jpg', '/images/macbook3.jpg'],
      condition: 'like-new',
      location: { country: 'USA', state: 'NY', city: 'New York' },
      shipping: { available: true, cost: 25.00, methods: ['standard', 'express', 'overnight'] },
      specifications: { processor: 'M2', storage: '256GB', memory: '8GB', year: '2023' },
      isActive: true,
      sellerId: 'user-2',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20'),
      views: 156,
      favorites: 12,
    },
    {
      id: 'item-3',
      title: 'Gaming Chair Pro Max',
      description: 'Professional gaming chair with ergonomic design, lumbar support, and premium materials.',
      price: 299.99,
      category: 'furniture',
      tags: ['gaming', 'chair', 'ergonomic', 'furniture'],
      images: ['/images/chair1.jpg', '/images/chair2.jpg'],
      condition: 'new',
      location: { country: 'USA', state: 'TX', city: 'Austin' },
      shipping: { available: true, cost: 30.00, methods: ['standard'] },
      specifications: { color: 'black', material: 'leather', weight: '25kg' },
      isActive: true,
      sellerId: 'user-3',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
      views: 89,
      favorites: 7,
    }
  ]

  sampleItems.forEach(item => {
    mockDatabase.items.set(item.id, item)
  })
}

// Initialize data
if (mockDatabase.items.size === 0) {
  initMockData()
}

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate query parameters
    const query = getQuery(event)
    const validatedQuery = searchQuerySchema.parse(query)
    
    // Check cache first
    const cacheKey = cacheKeys.items.list(JSON.stringify(validatedQuery))
    const cached = await useCache().get(cacheKey)
    if (cached) {
      return cached
    }

    const {
      q,
      category,
      tags,
      minPrice,
      maxPrice,
      condition,
      location,
      sortBy,
      sortOrder,
      page,
      limit,
    } = validatedQuery

    let items = Array.from(mockDatabase.items.values()).filter(item => item.isActive)

    // Apply filters
    if (q) {
      const searchTerm = q.toLowerCase()
      items = items.filter(item => 
        item.title.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    if (category) {
      items = items.filter(item => item.category === category)
    }

    if (tags && tags.length > 0) {
      items = items.filter(item => 
        tags.some((tag: string) => item.tags.includes(tag))
      )
    }

    if (minPrice !== undefined) {
      items = items.filter(item => item.price >= minPrice)
    }

    if (maxPrice !== undefined) {
      items = items.filter(item => item.price <= maxPrice)
    }

    if (condition) {
      const conditionArray = Array.isArray(condition) ? condition : [condition]
      items = items.filter(item => conditionArray.includes(item.condition))
    }

    if (location) {
      items = items.filter(item => 
        item.location.country.toLowerCase().includes(location.toLowerCase()) ||
        item.location.state?.toLowerCase().includes(location.toLowerCase()) ||
        item.location.city?.toLowerCase().includes(location.toLowerCase())
      )
    }

    // Sorting
    items.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'price':
          comparison = a.price - b.price
          break
        case 'date':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'popularity':
          comparison = a.views - b.views
          break
        case 'relevance':
        default:
          comparison = a.favorites - b.favorites
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedItems = items.slice(startIndex, endIndex)

    // Get available categories and facets for filtering
    const allItems = Array.from(mockDatabase.items.values()).filter(item => item.isActive)
    const categories = [...new Set(allItems.map(item => item.category))]
    const allTags = [...new Set(allItems.flatMap(item => item.tags))]
    const conditions = [...new Set(allItems.map(item => item.condition))]

    const result = {
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          page,
          limit,
          total: items.length,
          totalPages: Math.ceil(items.length / limit),
          hasNext: endIndex < items.length,
          hasPrev: page > 1,
        },
        facets: {
          categories,
          tags: allTags.slice(0, 50), // Limit tags for performance
          conditions,
          priceRange: {
            min: Math.min(...allItems.map(item => item.price)),
            max: Math.max(...allItems.map(item => item.price)),
          },
        },
      },
    }

    // Cache the result
    await useCache().set(cacheKey, result, 300) // 5 minutes

    return result
    
  } catch (error: any) {
    console.error('Items list API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})