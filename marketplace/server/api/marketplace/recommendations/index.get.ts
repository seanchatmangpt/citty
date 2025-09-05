import { z } from 'zod'
import { validateJWT } from '~/server/utils/auth'
import { useCache, cacheKeys } from '~/server/utils/cache'
import { ApiError } from '~/server/utils/errors'

// Validation schema for recommendation query parameters
const recommendationsQuerySchema = z.object({
  userId: z.string().optional(),
  itemId: z.string().optional(),
  type: z.enum(['collaborative', 'content-based', 'hybrid']).default('hybrid'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  includeViewed: z.coerce.boolean().default(false),
  categories: z.array(z.string()).or(z.string()).transform(val => Array.isArray(val) ? val : [val]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
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

// Mock database
const mockDatabase = {
  items: new Map<string, Item>(),
  userViews: new Map<string, Set<string>>(),
  userPurchases: new Map<string, Set<string>>(),
  itemSimilarity: new Map<string, Map<string, number>>(),
}

// Initialize mock data if needed
const initMockData = () => {
  if (mockDatabase.items.size === 0) {
    const sampleItems: Item[] = [
      {
        id: 'item-1',
        title: 'Vintage Leather Jacket',
        description: 'Authentic vintage leather jacket in excellent condition.',
        price: 89.99,
        category: 'clothing',
        tags: ['vintage', 'leather', 'jacket', 'fashion'],
        images: ['/images/jacket1.jpg'],
        condition: 'good',
        location: { country: 'USA', state: 'CA', city: 'Los Angeles' },
        shipping: { available: true, cost: 15.00, methods: ['standard'] },
        specifications: { size: 'M', material: 'Leather' },
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
        description: 'Apple MacBook Pro with M2 chip, barely used.',
        price: 1199.99,
        category: 'electronics',
        tags: ['apple', 'macbook', 'laptop'],
        images: ['/images/macbook1.jpg'],
        condition: 'like-new',
        location: { country: 'USA', state: 'NY', city: 'New York' },
        shipping: { available: true, cost: 25.00, methods: ['standard', 'express'] },
        specifications: { processor: 'M2', storage: '256GB' },
        isActive: true,
        sellerId: 'user-2',
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20'),
        views: 156,
        favorites: 12,
      },
      {
        id: 'item-3',
        title: 'Gaming Chair Pro',
        description: 'Professional gaming chair with ergonomic design.',
        price: 299.99,
        category: 'furniture',
        tags: ['gaming', 'chair', 'furniture'],
        images: ['/images/chair1.jpg'],
        condition: 'new',
        location: { country: 'USA', state: 'TX', city: 'Austin' },
        shipping: { available: true, cost: 30.00, methods: ['standard'] },
        specifications: { color: 'black', material: 'leather' },
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
}

export default defineEventHandler(async (event) => {
  try {
    initMockData()
    
    // Parse and validate query parameters
    const query = getQuery(event)
    const validatedQuery = recommendationsQuerySchema.parse(query)
    
    const {
      userId,
      itemId,
      type,
      limit,
      includeViewed,
      categories,
      minPrice,
      maxPrice,
    } = validatedQuery

    // Check cache first
    const cacheKey = cacheKeys.recommendations(JSON.stringify(validatedQuery))
    const cached = await useCache().get(cacheKey)
    if (cached) {
      return cached
    }

    let recommendations: Item[] = []
    const allItems = Array.from(mockDatabase.items.values()).filter(item => item.isActive)

    if (itemId) {
      // Content-based recommendations based on item similarity
      const targetItem = mockDatabase.items.get(itemId)
      if (!targetItem) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Item not found'
        })
      }

      recommendations = allItems
        .filter(item => item.id !== itemId)
        .map(item => ({
          item,
          score: calculateItemSimilarity(targetItem, item)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(rec => rec.item)
        
    } else if (userId) {
      // Collaborative filtering based on user behavior
      const userViewed = mockDatabase.userViews.get(userId) || new Set()
      const userPurchased = mockDatabase.userPurchases.get(userId) || new Set()
      
      recommendations = allItems
        .filter(item => {
          if (!includeViewed && userViewed.has(item.id)) return false
          if (userPurchased.has(item.id)) return false
          return true
        })
        .map(item => ({
          item,
          score: calculateUserItemScore(userId, item)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(rec => rec.item)
        
    } else {
      // Popular items as default recommendations
      recommendations = allItems
        .sort((a, b) => (b.views + b.favorites) - (a.views + a.favorites))
        .slice(0, limit)
    }

    // Apply additional filters
    if (categories && categories.length > 0) {
      recommendations = recommendations.filter(item => 
        categories.includes(item.category)
      )
    }

    if (minPrice !== undefined) {
      recommendations = recommendations.filter(item => item.price >= minPrice)
    }

    if (maxPrice !== undefined) {
      recommendations = recommendations.filter(item => item.price <= maxPrice)
    }

    const result = {
      success: true,
      data: {
        recommendations: recommendations.slice(0, limit),
        algorithm: type,
        basedOn: itemId ? 'item_similarity' : userId ? 'user_behavior' : 'popularity',
        total: recommendations.length
      }
    }

    // Cache the result
    await useCache().set(cacheKey, result, 600) // 10 minutes

    return result
    
  } catch (error: any) {
    console.error('Recommendations API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper function to calculate item similarity
function calculateItemSimilarity(item1: Item, item2: Item): number {
  let score = 0
  
  // Category match (high weight)
  if (item1.category === item2.category) score += 3
  
  // Tag similarity
  const commonTags = item1.tags.filter(tag => item2.tags.includes(tag))
  score += commonTags.length * 0.5
  
  // Price similarity (within 50% range)
  const priceDiff = Math.abs(item1.price - item2.price) / Math.max(item1.price, item2.price)
  if (priceDiff <= 0.5) score += 2
  
  // Location similarity
  if (item1.location.country === item2.location.country) score += 1
  if (item1.location.state === item2.location.state) score += 0.5
  
  // Condition similarity
  if (item1.condition === item2.condition) score += 1
  
  return score
}

// Helper function to calculate user-item score
function calculateUserItemScore(userId: string, item: Item): number {
  // Mock scoring based on popularity and recency
  const popularityScore = (item.views + item.favorites) / 100
  const recencyScore = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24) // Days old
  
  return popularityScore + Math.max(0, 30 - recencyScore) * 0.1
}