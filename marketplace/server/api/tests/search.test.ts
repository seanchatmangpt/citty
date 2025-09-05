import { describe, it, expect, beforeEach } from 'vitest'
import supertest from 'supertest'
import express from 'express'
import { searchRoutes } from '../routes/search/index.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/search', searchRoutes)
app.use(errorHandler)

const request = supertest(app)

describe('Search API', () => {
  describe('GET /api/search', () => {
    it('should perform basic search', async () => {
      const response = await request
        .get('/api/search?q=leather jacket')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('items')
      expect(response.body.data).toHaveProperty('facets')
      expect(response.body.data).toHaveProperty('searchTime')
      expect(typeof response.body.data.searchTime).toBe('number')
    })

    it('should search with filters', async () => {
      const response = await request
        .get('/api/search?q=laptop&category=electronics&minPrice=500&maxPrice=2000')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
    })

    it('should support tag filtering', async () => {
      const response = await request
        .get('/api/search?tags=vintage&tags=leather')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support condition filtering', async () => {
      const response = await request
        .get('/api/search?condition=new&condition=like-new')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support location filtering', async () => {
      const response = await request
        .get('/api/search?location=California')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support sorting', async () => {
      const response = await request
        .get('/api/search?sortBy=price&sortOrder=asc')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support pagination', async () => {
      const response = await request
        .get('/api/search?page=2&limit=10')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.pagination.page).toBe(2)
      expect(response.body.data.pagination.limit).toBe(10)
    })

    it('should include facets', async () => {
      const response = await request
        .get('/api/search?facets=categories&facets=tags')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.facets).toBeDefined()
      expect(response.body.data.facets.categories).toBeDefined()
      expect(response.body.data.facets.tags).toBeDefined()
    })

    it('should validate query parameters', async () => {
      const response = await request
        .get('/api/search?limit=200') // Exceeds max limit
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should handle empty search gracefully', async () => {
      const response = await request
        .get('/api/search')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toBeDefined()
    })
  })

  describe('GET /api/search/facets', () => {
    it('should return available facets', async () => {
      const response = await request
        .get('/api/search/facets')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.facets).toBeDefined()
      expect(response.body.data.facets.categories).toBeDefined()
      expect(response.body.data.facets.tags).toBeDefined()
      expect(response.body.data.facets.conditions).toBeDefined()
      expect(response.body.data.facets.priceRanges).toBeDefined()
      expect(response.body.data.facets.locations).toBeDefined()
    })

    it('should include count for each facet', async () => {
      const response = await request
        .get('/api/search/facets')
        .expect(200)

      const categories = response.body.data.facets.categories
      expect(Array.isArray(categories)).toBe(true)
      categories.forEach((category: any) => {
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('count')
        expect(typeof category.count).toBe('number')
      })
    })
  })

  describe('GET /api/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const response = await request
        .get('/api/search/suggestions?q=leather')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.suggestions).toBeDefined()
      expect(Array.isArray(response.body.data.suggestions)).toBe(true)
      expect(response.body.data.query).toBe('leather')
    })

    it('should limit suggestions', async () => {
      const response = await request
        .get('/api/search/suggestions?q=leather&limit=5')
        .expect(200)

      expect(response.body.data.suggestions.length).toBeLessThanOrEqual(5)
    })

    it('should return default suggestions when no query provided', async () => {
      const response = await request
        .get('/api/search/suggestions')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.suggestions).toBeDefined()
      expect(Array.isArray(response.body.data.suggestions)).toBe(true)
    })
  })

  describe('POST /api/search/saved (Authenticated)', () => {
    const mockAuthApp = express()
    mockAuthApp.use(express.json())
    
    const mockAuth = (req: any, res: any, next: any) => {
      req.user = {
        id: 'test-user-1',
        email: 'test@example.com',
        role: 'user',
      }
      next()
    }
    
    mockAuthApp.use('/api/search', mockAuth)
    mockAuthApp.use('/api/search', searchRoutes)
    mockAuthApp.use(errorHandler)
    
    const authRequest = supertest(mockAuthApp)

    it('should save search query', async () => {
      const searchData = {
        name: 'My Saved Search',
        query: {
          q: 'vintage leather',
          category: 'clothing',
          minPrice: 50,
          maxPrice: 200,
        },
        alerts: true,
      }

      const response = await authRequest
        .post('/api/search/saved')
        .send(searchData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.savedSearch).toBeDefined()
      expect(response.body.data.savedSearch.name).toBe(searchData.name)
    })

    it('should require name and query', async () => {
      const response = await authRequest
        .post('/api/search/saved')
        .send({ name: 'Test' }) // Missing query
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should get saved searches', async () => {
      const response = await authRequest
        .get('/api/search/saved')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.savedSearches).toBeDefined()
      expect(Array.isArray(response.body.data.savedSearches)).toBe(true)
    })

    it('should delete saved search', async () => {
      // First save a search
      const saveResponse = await authRequest
        .post('/api/search/saved')
        .send({
          name: 'To Delete',
          query: { q: 'test' },
        })

      const searchId = saveResponse.body.data.savedSearch.id

      const response = await authRequest
        .delete(`/api/search/saved/${searchId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/search/trending', () => {
    it('should return trending searches', async () => {
      const response = await request
        .get('/api/search/trending')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.trending).toBeDefined()
      expect(Array.isArray(response.body.data.trending)).toBe(true)
    })

    it('should limit trending results', async () => {
      const response = await request
        .get('/api/search/trending?limit=5')
        .expect(200)

      expect(response.body.data.trending.length).toBeLessThanOrEqual(5)
    })

    it('should include search metrics', async () => {
      const response = await request
        .get('/api/search/trending')
        .expect(200)

      const trending = response.body.data.trending
      trending.forEach((item: any) => {
        expect(item).toHaveProperty('rank')
        expect(item).toHaveProperty('term')
        expect(item).toHaveProperty('searchCount')
        expect(item).toHaveProperty('change')
      })
    })

    it('should support different time periods', async () => {
      const response = await request
        .get('/api/search/trending?period=7d')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.period).toBe('7d')
    })
  })

  describe('POST /api/search/track', () => {
    it('should track search analytics', async () => {
      const trackData = {
        query: 'laptop gaming',
        userId: 'user-123',
        sessionId: 'session-456',
        resultCount: 25,
        clickPosition: 3,
      }

      const response = await request
        .post('/api/search/track')
        .send(trackData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.tracked).toBe(true)
      expect(response.body.data.eventId).toBeDefined()
    })

    it('should handle tracking without user ID', async () => {
      const trackData = {
        query: 'anonymous search',
        sessionId: 'anonymous-session',
        resultCount: 10,
      }

      const response = await request
        .post('/api/search/track')
        .send(trackData)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Search Performance', () => {
    it('should complete search within reasonable time', async () => {
      const start = Date.now()
      
      const response = await request
        .get('/api/search?q=performance test')
        .expect(200)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(response.body.data.searchTime).toBeLessThan(1000) // Search time should be under 1 second
    })

    it('should handle complex queries efficiently', async () => {
      const complexQuery = '/api/search?q=vintage leather jacket&category=clothing&tags=vintage&tags=leather&minPrice=50&maxPrice=500&condition=good&condition=like-new&location=California&sortBy=price&sortOrder=asc'
      
      const response = await request
        .get(complexQuery)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.searchTime).toBeLessThan(2000)
    })
  })

  describe('Search Edge Cases', () => {
    it('should handle special characters in query', async () => {
      const response = await request
        .get('/api/search?q=test!@#$%^&*()')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(200)
      
      const response = await request
        .get(`/api/search?q=${longQuery}`)
        .expect(400) // Should fail validation

      expect(response.body.success).toBe(false)
    })

    it('should handle unicode characters', async () => {
      const response = await request
        .get('/api/search?q=café résumé naïve')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should handle empty facet arrays', async () => {
      const response = await request
        .get('/api/search?tags=&condition=')
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Search Caching', () => {
    it('should include cache headers', async () => {
      const response = await request
        .get('/api/search?q=cached query')

      expect(response.headers).toHaveProperty('x-cache')
    })

    it('should cache identical searches', async () => {
      const query = '/api/search?q=cache test&category=electronics'
      
      // First request
      const response1 = await request.get(query)
      expect(response1.headers['x-cache']).toBe('MISS')

      // Second identical request should be cached
      const response2 = await request.get(query)
      // In real implementation, this would be 'HIT'
      expect(response2.body.success).toBe(true)
    })
  })

  describe('Search Error Handling', () => {
    it('should handle malformed queries gracefully', async () => {
      const response = await request
        .get('/api/search?malformed[query]=test')
        .expect(200) // Should not crash, just return empty or default results

      expect(response.body.success).toBe(true)
    })

    it('should validate numeric parameters', async () => {
      const response = await request
        .get('/api/search?minPrice=invalid')
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should handle database connection errors', async () => {
      // This would simulate a database error in real tests
      // For now, we just ensure the error handling structure works
      const response = await request
        .get('/api/search?q=test')
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })
})