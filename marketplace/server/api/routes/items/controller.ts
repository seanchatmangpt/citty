import { Request, Response } from 'express'
import { ApiError, NotFoundError, ForbiddenError } from '../../utils/errors.js'
import { cacheLayer, invalidateCache } from '../../middleware/cache.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

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

// Initialize some mock data
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
    }
  ]

  sampleItems.forEach(item => {
    mockDatabase.items.set(item.id, item)
  })
}

initMockData()

export const itemController = {
  // GET /api/items - List items with filtering and pagination
  async getItems(req: Request, res: Response) {
    const {
      q,
      category,
      tags,
      minPrice,
      maxPrice,
      condition,
      location,
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query as any

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
      const tagArray = Array.isArray(tags) ? tags : [tags]
      items = items.filter(item => 
        tagArray.some((tag: string) => item.tags.includes(tag))
      )
    }

    if (minPrice !== undefined) {
      items = items.filter(item => item.price >= parseFloat(minPrice))
    }

    if (maxPrice !== undefined) {
      items = items.filter(item => item.price <= parseFloat(maxPrice))
    }

    if (condition && condition.length > 0) {
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

    res.json({
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
    })
  },

  // GET /api/items/:id - Get item details
  async getItem(req: Request, res: Response) {
    const { id } = req.params
    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    if (!item.isActive) {
      throw new NotFoundError('Item', id)
    }

    res.json({
      success: true,
      data: { item },
    })
  },

  // POST /api/items - Create new item
  async createItem(req: AuthRequest, res: Response) {
    const itemData = req.body
    const userId = req.user!.id

    const newItem: Item = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      sellerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      favorites: 0,
      isActive: true,
    }

    mockDatabase.items.set(newItem.id, newItem)

    // Invalidate relevant caches
    await invalidateCache('items:list')
    await invalidateCache(`user:${userId}:items`)

    res.status(201).json({
      success: true,
      data: { item: newItem },
      message: 'Item created successfully',
    })
  },

  // PUT /api/items/:id - Update item
  async updateItem(req: AuthRequest, res: Response) {
    const { id } = req.params
    const updates = req.body
    const userId = req.user!.id
    const userRole = req.user!.role

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    // Check ownership or admin privileges
    if (item.sellerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only update your own items')
    }

    const updatedItem: Item = {
      ...item,
      ...updates,
      id, // Prevent ID changes
      sellerId: item.sellerId, // Prevent seller changes
      updatedAt: new Date(),
    }

    mockDatabase.items.set(id, updatedItem)

    // Invalidate caches
    await invalidateCache('items:list')
    await invalidateCache(`item:${id}`)
    await invalidateCache(`user:${userId}:items`)

    res.json({
      success: true,
      data: { item: updatedItem },
      message: 'Item updated successfully',
    })
  },

  // DELETE /api/items/:id - Delete item
  async deleteItem(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    // Check ownership or admin privileges
    if (item.sellerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only delete your own items')
    }

    mockDatabase.items.delete(id)

    // Clean up related data
    mockDatabase.views.delete(id)
    mockDatabase.favorites.delete(id)

    // Invalidate caches
    await invalidateCache('items:list')
    await invalidateCache(`item:${id}`)
    await invalidateCache(`user:${userId}:items`)

    res.json({
      success: true,
      message: 'Item deleted successfully',
    })
  },

  // POST /api/items/:id/images - Upload images
  async uploadImages(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    if (item.sellerId !== userId && req.user!.role !== 'admin') {
      throw new ForbiddenError('You can only upload images to your own items')
    }

    // Mock image upload - in production, this would handle file uploads
    const mockImageUrls = [
      `/images/${id}-${Date.now()}-1.jpg`,
      `/images/${id}-${Date.now()}-2.jpg`,
    ]

    const updatedItem = {
      ...item,
      images: [...item.images, ...mockImageUrls],
      updatedAt: new Date(),
    }

    mockDatabase.items.set(id, updatedItem)

    await invalidateCache(`item:${id}`)

    res.json({
      success: true,
      data: { 
        item: updatedItem,
        uploadedImages: mockImageUrls,
      },
      message: 'Images uploaded successfully',
    })
  },

  // DELETE /api/items/:id/images/:imageId - Delete image
  async deleteImage(req: AuthRequest, res: Response) {
    const { id, imageId } = req.params
    const userId = req.user!.id

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    if (item.sellerId !== userId && req.user!.role !== 'admin') {
      throw new ForbiddenError('You can only delete images from your own items')
    }

    const imageIndex = parseInt(imageId)
    if (imageIndex < 0 || imageIndex >= item.images.length) {
      throw new NotFoundError('Image')
    }

    const updatedImages = item.images.filter((_, index) => index !== imageIndex)
    const updatedItem = {
      ...item,
      images: updatedImages,
      updatedAt: new Date(),
    }

    mockDatabase.items.set(id, updatedItem)

    await invalidateCache(`item:${id}`)

    res.json({
      success: true,
      data: { item: updatedItem },
      message: 'Image deleted successfully',
    })
  },

  // GET /api/items/:id/similar - Get similar items
  async getSimilarItems(req: Request, res: Response) {
    const { id } = req.params
    const limit = parseInt(req.query.limit as string) || 10

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    const allItems = Array.from(mockDatabase.items.values())
      .filter(i => i.id !== id && i.isActive)

    // Simple similarity algorithm based on category, tags, and price range
    const similarItems = allItems
      .map(i => {
        let score = 0
        
        // Category match
        if (i.category === item.category) score += 3
        
        // Tag overlap
        const commonTags = i.tags.filter(tag => item.tags.includes(tag))
        score += commonTags.length

        // Price similarity (within 50% range)
        const priceDiff = Math.abs(i.price - item.price) / item.price
        if (priceDiff <= 0.5) score += 2

        return { item: i, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item)

    res.json({
      success: true,
      data: { 
        similar: similarItems,
        basedOn: {
          category: item.category,
          tags: item.tags,
          priceRange: item.price,
        },
      },
    })
  },

  // POST /api/items/:id/view - Track item view
  async trackView(req: Request, res: Response) {
    const { id } = req.params
    
    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    // Update view count
    const updatedItem = {
      ...item,
      views: item.views + 1,
    }

    mockDatabase.items.set(id, updatedItem)

    res.json({
      success: true,
      data: { views: updatedItem.views },
      message: 'View tracked successfully',
    })
  },

  // POST /api/items/:id/favorite - Add to favorites
  async addToFavorites(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    if (!mockDatabase.favorites.has(id)) {
      mockDatabase.favorites.set(id, new Set())
    }

    const itemFavorites = mockDatabase.favorites.get(id)!
    itemFavorites.add(userId)

    // Update item favorites count
    const updatedItem = {
      ...item,
      favorites: itemFavorites.size,
    }

    mockDatabase.items.set(id, updatedItem)

    res.json({
      success: true,
      data: { favorites: updatedItem.favorites },
      message: 'Item added to favorites',
    })
  },

  // DELETE /api/items/:id/favorite - Remove from favorites
  async removeFromFavorites(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    const itemFavorites = mockDatabase.favorites.get(id)
    if (itemFavorites) {
      itemFavorites.delete(userId)

      // Update item favorites count
      const updatedItem = {
        ...item,
        favorites: itemFavorites.size,
      }

      mockDatabase.items.set(id, updatedItem)

      res.json({
        success: true,
        data: { favorites: updatedItem.favorites },
        message: 'Item removed from favorites',
      })
    } else {
      res.json({
        success: true,
        data: { favorites: item.favorites },
        message: 'Item was not in favorites',
      })
    }
  },

  // GET /api/items/:id/history - Get item history
  async getItemHistory(req: Request, res: Response) {
    const { id } = req.params

    const item = mockDatabase.items.get(id)

    if (!item) {
      throw new NotFoundError('Item', id)
    }

    // Mock price history
    const priceHistory = [
      { date: item.createdAt, price: item.price, event: 'listed' },
      { date: new Date(item.createdAt.getTime() + 86400000), price: item.price * 0.9, event: 'price_drop' },
      { date: new Date(), price: item.price, event: 'price_update' },
    ]

    const viewHistory = [
      { date: item.createdAt, views: 0 },
      { date: new Date(Date.now() - 86400000 * 7), views: Math.floor(item.views * 0.3) },
      { date: new Date(Date.now() - 86400000 * 3), views: Math.floor(item.views * 0.7) },
      { date: new Date(), views: item.views },
    ]

    res.json({
      success: true,
      data: {
        priceHistory,
        viewHistory,
        statusHistory: [
          { date: item.createdAt, status: 'active', event: 'Item listed' },
          { date: item.updatedAt, status: 'active', event: 'Item updated' },
        ],
      },
    })
  },

  // POST /api/items/bulk - Bulk operations
  async bulkOperations(req: AuthRequest, res: Response) {
    const { operation, itemIds, data } = req.body

    if (!operation || !itemIds || !Array.isArray(itemIds)) {
      throw new ApiError(400, 'Invalid bulk operation request')
    }

    const results: any[] = []

    for (const itemId of itemIds) {
      const item = mockDatabase.items.get(itemId)
      
      if (!item) {
        results.push({ itemId, success: false, error: 'Item not found' })
        continue
      }

      try {
        switch (operation) {
          case 'activate':
            mockDatabase.items.set(itemId, { ...item, isActive: true, updatedAt: new Date() })
            results.push({ itemId, success: true, operation: 'activated' })
            break
          
          case 'deactivate':
            mockDatabase.items.set(itemId, { ...item, isActive: false, updatedAt: new Date() })
            results.push({ itemId, success: true, operation: 'deactivated' })
            break
          
          case 'update':
            if (data) {
              mockDatabase.items.set(itemId, { ...item, ...data, id: itemId, updatedAt: new Date() })
              results.push({ itemId, success: true, operation: 'updated' })
            } else {
              results.push({ itemId, success: false, error: 'No data provided for update' })
            }
            break
          
          case 'delete':
            mockDatabase.items.delete(itemId)
            results.push({ itemId, success: true, operation: 'deleted' })
            break
          
          default:
            results.push({ itemId, success: false, error: 'Unknown operation' })
        }
      } catch (error: any) {
        results.push({ itemId, success: false, error: error.message })
      }
    }

    // Invalidate caches after bulk operations
    await invalidateCache('items:list')

    res.json({
      success: true,
      data: {
        operation,
        results,
        summary: {
          total: itemIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
      },
    })
  },
}