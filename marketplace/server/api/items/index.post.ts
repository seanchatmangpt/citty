import { z } from 'zod'
import jwt from 'jsonwebtoken'

const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    url: z.string().url().optional()
  }),
  repository: z.string().url().optional(),
  keywords: z.array(z.string()).min(1).max(20),
  license: z.string().min(1),
  type: z.enum(['template', 'plugin', 'workflow', 'tool']),
  category: z.string().min(1),
  price: z.number().min(0).max(10000),
  tags: z.array(z.string()).min(1).max(10),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']).default('new'),
  location: z.object({
    country: z.string().min(1),
    state: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional()
  }),
  shipping: z.object({
    available: z.boolean().default(true),
    cost: z.number().min(0).optional(),
    methods: z.array(z.string()).default(['digital'])
  }),
  specifications: z.record(z.any()).default({}),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['file', 'directory'])
  })).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
  hooks: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional()
})

// Mock user authentication
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

// Mock database - replace with actual database
const mockItems = new Map()

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

    // Validate request body
    const body = await readBody(event)
    const itemData = createItemSchema.parse(body)

    // Create new item
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      sellerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      downloads: 0,
      rating: 0,
      verified: false,
      views: 0,
      favorites: 0,
      isActive: true
    }

    // Store item (mock)
    mockItems.set(newItem.id, newItem)

    // In production: 
    // - Save to database
    // - Validate files and content
    // - Process images/assets
    // - Send notifications
    // - Update search indexes

    setResponseStatus(event, 201)
    return {
      success: true,
      data: { item: newItem },
      message: 'Item created successfully'
    }

  } catch (error: any) {
    console.error('Create item error:', error)

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