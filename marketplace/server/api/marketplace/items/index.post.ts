import { z } from 'zod'
import { validateJWT, requirePermission } from '~/server/utils/auth'
import { useCache, cacheKeys, invalidateCache } from '~/server/utils/cache'
import { ApiError } from '~/server/utils/errors'

// Validation schema for creating items
const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  price: z.number().positive(),
  category: z.string().min(1).max(50),
  tags: z.array(z.string().max(30)).max(20).default([]),
  images: z.array(z.string().url()).max(10).default([]),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']),
  location: z.object({
    country: z.string(),
    state: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
  }),
  shipping: z.object({
    available: z.boolean().default(true),
    cost: z.number().min(0).optional(),
    methods: z.array(z.string()).default(['standard']),
  }).default({}),
  specifications: z.record(z.any()).default({}),
  isActive: z.boolean().default(true),
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

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and create permission
    const user = await requirePermission(event, 'create')
    
    // Get and validate request body
    const body = await readBody(event)
    const itemData = createItemSchema.parse(body)

    const newItem: Item = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      sellerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      favorites: 0,
    }

    mockDatabase.items.set(newItem.id, newItem)

    // Invalidate relevant caches
    await invalidateCache('items:list')
    await invalidateCache(`user:${user.id}:items`)

    setResponseStatus(event, 201)
    return {
      success: true,
      data: { item: newItem },
      message: 'Item created successfully',
    }
    
  } catch (error: any) {
    console.error('Create item API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        data: error.errors
      })
    }
    
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})