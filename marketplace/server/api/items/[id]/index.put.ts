import { z } from 'zod'
import jwt from 'jsonwebtoken'

const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  price: z.number().min(0).max(10000).optional(),
  tags: z.array(z.string()).min(1).max(10).optional(),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']).optional(),
  location: z.object({
    country: z.string().min(1),
    state: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional()
  }).optional(),
  shipping: z.object({
    available: z.boolean(),
    cost: z.number().min(0).optional(),
    methods: z.array(z.string())
  }).optional(),
  specifications: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be updated'
})

// Mock authentication
function verifyToken(token: string) {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.jwtSecret) as { id: string, email: string, role: string }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token'
    })
  }
}

// Mock database
const mockItems = new Map([
  ['1', {
    id: '1',
    name: 'Vue CLI Template Pro',
    sellerId: 'user-1',
    price: 49.99,
    isActive: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-10')
  }],
  ['2', {
    id: '2', 
    name: 'Advanced Auth Plugin',
    sellerId: 'user-2',
    price: 79.99,
    isActive: true,
    createdAt: new Date('2023-11-20'),
    updatedAt: new Date('2024-02-28')
  }]
])

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authorization header required'
      })
    }

    const token = authHeader.substring(7)
    const user = verifyToken(token)

    // Get item ID from route
    const itemId = getRouterParam(event, 'id')
    if (!itemId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item ID required'
      })
    }

    // Check if item exists
    const item = mockItems.get(itemId)
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

    // Validate request body
    const body = await readBody(event)
    const updates = updateItemSchema.parse(body)

    // Update item
    const updatedItem = {
      ...item,
      ...updates,
      id: itemId, // Prevent ID changes
      sellerId: item.sellerId, // Prevent seller changes
      updatedAt: new Date()
    }

    // Save updated item (mock)
    mockItems.set(itemId, updatedItem)

    // In production:
    // - Update database record
    // - Invalidate caches
    // - Update search indexes
    // - Send notifications to watchers
    // - Log audit trail

    return {
      success: true,
      data: { item: updatedItem },
      message: 'Item updated successfully'
    }

  } catch (error: any) {
    console.error('Update item error:', error)

    if (error.statusCode) {
      throw error
    }

    // Zod validation errors
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        data: error.errors
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})