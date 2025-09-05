import { z } from 'zod'
import { validateJWT, requirePermission } from '~/server/utils/auth'
import { useCache, cacheKeys, invalidateCache } from '~/server/utils/cache'
import { ApiError, NotFoundError, ForbiddenError } from '~/server/utils/errors'

// Validation schema for updating items
const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).max(50).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']).optional(),
  location: z.object({
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
  shipping: z.object({
    available: z.boolean().optional(),
    cost: z.number().min(0).optional(),
    methods: z.array(z.string()).optional(),
  }).optional(),
  specifications: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
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
    const itemId = getRouterParam(event, 'id')
    
    if (!itemId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item ID is required'
      })
    }
    
    // Require authentication and update permission
    const user = await requirePermission(event, 'update')
    
    // Get and validate request body
    const body = await readBody(event)
    const updates = updateItemSchema.parse(body)

    const item = mockDatabase.items.get(itemId)

    if (!item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Item not found'
      })
    }

    // Check ownership or admin privileges
    if (item.sellerId !== user.id && user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only update your own items'
      })
    }

    const updatedItem: Item = {
      ...item,
      ...updates,
      id: itemId, // Prevent ID changes
      sellerId: item.sellerId, // Prevent seller changes
      updatedAt: new Date(),
    }

    mockDatabase.items.set(itemId, updatedItem)

    // Invalidate caches
    await invalidateCache('items:list')
    await invalidateCache(`item:${itemId}`)
    await invalidateCache(`user:${user.id}:items`)

    return {
      success: true,
      data: { item: updatedItem },
      message: 'Item updated successfully',
    }
    
  } catch (error: any) {
    console.error('Update item API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
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