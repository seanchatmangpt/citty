import { validateJWT, requirePermission } from '~/server/utils/auth'
import { useCache, cacheKeys, invalidateCache } from '~/server/utils/cache'
import { ApiError, NotFoundError, ForbiddenError } from '~/server/utils/errors'

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
    
    // Require authentication and delete permission
    const user = await requirePermission(event, 'delete')

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
        statusMessage: 'You can only delete your own items'
      })
    }

    mockDatabase.items.delete(itemId)

    // Clean up related data
    mockDatabase.views.delete(itemId)
    mockDatabase.favorites.delete(itemId)

    // Invalidate caches
    await invalidateCache('items:list')
    await invalidateCache(`item:${itemId}`)
    await invalidateCache(`user:${user.id}:items`)

    return {
      success: true,
      message: 'Item deleted successfully',
    }
    
  } catch (error: any) {
    console.error('Delete item API error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})