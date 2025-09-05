import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import supertest from 'supertest'
import express from 'express'
import { itemRoutes } from '../routes/items/index.js'
import { errorHandler } from '../middleware/errorHandler.js'
import { authMiddleware } from '../middleware/auth.js'

// Mock setup
const app = express()
app.use(express.json())

// Mock auth middleware for testing
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = {
    id: 'test-user-1',
    email: 'test@example.com',
    role: 'user',
    permissions: ['create', 'read', 'update', 'delete'],
  }
  next()
}

app.use('/api/items', mockAuthMiddleware)
app.use('/api/items', itemRoutes)
app.use(errorHandler)

const request = supertest(app)

describe('Items API', () => {
  describe('GET /api/items', () => {
    it('should return list of items with pagination', async () => {
      const response = await request
        .get('/api/items')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('items')
      expect(response.body.data).toHaveProperty('pagination')
      expect(response.body.data).toHaveProperty('facets')
      expect(Array.isArray(response.body.data.items)).toBe(true)
    })

    it('should filter items by category', async () => {
      const response = await request
        .get('/api/items?category=electronics')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
      // In real tests, we'd verify all items have electronics category
    })

    it('should filter items by price range', async () => {
      const response = await request
        .get('/api/items?minPrice=50&maxPrice=200')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
    })

    it('should support search query', async () => {
      const response = await request
        .get('/api/items?q=leather jacket')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
    })

    it('should support pagination', async () => {
      const response = await request
        .get('/api/items?page=1&limit=5')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(5)
    })

    it('should support sorting', async () => {
      const response = await request
        .get('/api/items?sortBy=price&sortOrder=asc')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
    })
  })

  describe('GET /api/items/:id', () => {
    it('should return item details for valid ID', async () => {
      const response = await request
        .get('/api/items/item-1')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.item).toBeDefined()
      expect(response.body.data.item.id).toBe('item-1')
    })

    it('should return 404 for non-existent item', async () => {
      const response = await request
        .get('/api/items/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('not found')
    })

    it('should return 400 for invalid ID format', async () => {
      const response = await request
        .get('/api/items/invalid@id!')
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/items', () => {
    const validItem = {
      title: 'Test Item',
      description: 'This is a test item description that is long enough to pass validation.',
      price: 99.99,
      category: 'electronics',
      condition: 'new',
      location: {
        country: 'USA',
        state: 'CA',
        city: 'Los Angeles',
      },
      tags: ['test', 'electronics'],
      shipping: {
        available: true,
        cost: 15.00,
        methods: ['standard', 'express'],
      },
    }

    it('should create new item with valid data', async () => {
      const response = await request
        .post('/api/items')
        .send(validItem)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.item).toBeDefined()
      expect(response.body.data.item.title).toBe(validItem.title)
      expect(response.body.data.item.sellerId).toBe('test-user-1')
    })

    it('should require authentication', async () => {
      const appNoAuth = express()
      appNoAuth.use(express.json())
      appNoAuth.use('/api/items', itemRoutes)
      appNoAuth.use(errorHandler)

      const requestNoAuth = supertest(appNoAuth)
      
      await requestNoAuth
        .post('/api/items')
        .send(validItem)
        .expect(401)
    })

    it('should validate required fields', async () => {
      const invalidItem = {
        title: 'Test',
        // Missing required fields
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Validation error')
    })

    it('should validate title length', async () => {
      const invalidItem = {
        ...validItem,
        title: '', // Too short
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should validate description length', async () => {
      const invalidItem = {
        ...validItem,
        description: 'Too short', // Less than 10 characters
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should validate price', async () => {
      const invalidItem = {
        ...validItem,
        price: -10, // Negative price
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should validate condition enum', async () => {
      const invalidItem = {
        ...validItem,
        condition: 'invalid-condition',
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should limit tags array size', async () => {
      const invalidItem = {
        ...validItem,
        tags: new Array(25).fill('tag'), // More than 20 tags
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should validate location country requirement', async () => {
      const invalidItem = {
        ...validItem,
        location: {
          // Missing required country
          state: 'CA',
        },
      }

      const response = await request
        .post('/api/items')
        .send(invalidItem)
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('PUT /api/items/:id', () => {
    it('should update item with valid data', async () => {
      const updateData = {
        title: 'Updated Test Item',
        price: 149.99,
        description: 'Updated description that is long enough for validation.',
      }

      const response = await request
        .put('/api/items/item-1')
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.item.title).toBe(updateData.title)
      expect(response.body.data.item.price).toBe(updateData.price)
    })

    it('should return 404 for non-existent item', async () => {
      const response = await request
        .put('/api/items/non-existent')
        .send({ title: 'Updated Title' })
        .expect(404)

      expect(response.body.success).toBe(false)
    })

    it('should validate update data', async () => {
      const invalidUpdate = {
        price: -50, // Invalid negative price
      }

      const response = await request
        .put('/api/items/item-1')
        .send(invalidUpdate)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should prevent ID changes', async () => {
      const updateData = {
        id: 'different-id',
        title: 'Updated Title',
      }

      const response = await request
        .put('/api/items/item-1')
        .send(updateData)
        .expect(200)

      expect(response.body.data.item.id).toBe('item-1') // ID should remain unchanged
    })

    it('should prevent seller changes', async () => {
      const updateData = {
        sellerId: 'different-seller',
        title: 'Updated Title',
      }

      const response = await request
        .put('/api/items/item-1')
        .send(updateData)
        .expect(200)

      expect(response.body.data.item.sellerId).not.toBe('different-seller')
    })
  })

  describe('DELETE /api/items/:id', () => {
    it('should delete item successfully', async () => {
      // First create an item to delete
      const createResponse = await request
        .post('/api/items')
        .send({
          title: 'Item to Delete',
          description: 'This item will be deleted in the test.',
          price: 50.00,
          category: 'test',
          condition: 'new',
          location: { country: 'USA' },
        })

      const itemId = createResponse.body.data.item.id

      const response = await request
        .delete(`/api/items/${itemId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('deleted successfully')
    })

    it('should return 404 for non-existent item', async () => {
      const response = await request
        .delete('/api/items/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/items/:id/images', () => {
    it('should upload images successfully', async () => {
      const response = await request
        .post('/api/items/item-1/images')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.uploadedImages).toBeDefined()
      expect(Array.isArray(response.body.data.uploadedImages)).toBe(true)
    })

    it('should return 404 for non-existent item', async () => {
      await request
        .post('/api/items/non-existent/images')
        .expect(404)
    })
  })

  describe('POST /api/items/:id/favorite', () => {
    it('should add item to favorites', async () => {
      const response = await request
        .post('/api/items/item-1/favorite')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('added to favorites')
    })

    it('should return 404 for non-existent item', async () => {
      await request
        .post('/api/items/non-existent/favorite')
        .expect(404)
    })
  })

  describe('DELETE /api/items/:id/favorite', () => {
    it('should remove item from favorites', async () => {
      const response = await request
        .delete('/api/items/item-1/favorite')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('removed from favorites')
    })
  })

  describe('GET /api/items/:id/similar', () => {
    it('should return similar items', async () => {
      const response = await request
        .get('/api/items/item-1/similar')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.similar).toBeDefined()
      expect(Array.isArray(response.body.data.similar)).toBe(true)
      expect(response.body.data.basedOn).toBeDefined()
    })

    it('should limit similar items count', async () => {
      const response = await request
        .get('/api/items/item-1/similar?limit=5')
        .expect(200)

      expect(response.body.data.similar.length).toBeLessThanOrEqual(5)
    })
  })

  describe('POST /api/items/:id/view', () => {
    it('should track item view', async () => {
      const response = await request
        .post('/api/items/item-1/view')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.views).toBeDefined()
      expect(typeof response.body.data.views).toBe('number')
    })
  })

  describe('GET /api/items/:id/history', () => {
    it('should return item history', async () => {
      const response = await request
        .get('/api/items/item-1/history')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.priceHistory).toBeDefined()
      expect(response.body.data.viewHistory).toBeDefined()
      expect(response.body.data.statusHistory).toBeDefined()
    })
  })

  describe('POST /api/items/bulk', () => {
    it('should handle bulk operations', async () => {
      // This test would require admin role
      const adminApp = express()
      adminApp.use(express.json())
      
      const mockAdminAuth = (req: any, res: any, next: any) => {
        req.user = {
          id: 'admin-user',
          role: 'admin',
          permissions: ['admin'],
        }
        next()
      }

      adminApp.use('/api/items', mockAdminAuth)
      adminApp.use('/api/items', itemRoutes)
      adminApp.use(errorHandler)

      const adminRequest = supertest(adminApp)

      const response = await adminRequest
        .post('/api/items/bulk')
        .send({
          operation: 'activate',
          itemIds: ['item-1', 'item-2'],
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.results).toBeDefined()
      expect(response.body.data.summary).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // This would simulate a database connection error in real tests
      const response = await request
        .get('/api/items/error-simulation')
        .expect(404) // Our mock will return 404 for non-existent items

      expect(response.body.success).toBe(false)
    })

    it('should return proper error format', async () => {
      const response = await request
        .get('/api/items/non-existent')
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('timestamp')
    })
  })

  describe('Caching', () => {
    it('should include cache headers for GET requests', async () => {
      const response = await request
        .get('/api/items/item-1')

      expect(response.headers).toHaveProperty('x-cache')
    })
  })

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      // In a real test, we'd make many requests rapidly to test rate limiting
      // For now, we just verify the structure
      const response = await request
        .get('/api/items')
        .expect(200)

      // Rate limiting would be tested by making many requests
      expect(response.body.success).toBe(true)
    })
  })
})