import { describe, it, expect, beforeEach, vi } from 'vitest'
import { $fetch } from 'ofetch'

// Mock the auth utilities
vi.mock('~/server/utils/auth', () => ({
  validateJWT: vi.fn(),
  generateToken: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}))

describe('/api/auth', () => {
  const baseURL = 'http://localhost:3000'
  
  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })
    
    it('should login with valid credentials', async () => {
      const { verifyPassword, generateToken } = vi.mocked(await import('~/server/utils/auth'))
      verifyPassword.mockResolvedValue(true)
      generateToken.mockReturnValue('mock-jwt-token')
      
      const credentials = {
        email: 'user@marketplace.dev',
        password: 'password123'
      }
      
      const response = await $fetch('/api/auth/login', {
        baseURL,
        method: 'POST',
        body: credentials
      })
      
      expect(response.success).toBe(true)
      expect(response.user).toMatchObject({
        email: credentials.email,
        name: expect.any(String),
        role: expect.any(String)
      })
      expect(response.token).toBe('mock-jwt-token')
      expect(response.message).toBe('Login successful')
    })
    
    it('should reject invalid email format', async () => {
      const credentials = {
        email: 'invalid-email',
        password: 'password123'
      }
      
      try {
        await $fetch('/api/auth/login', {
          baseURL,
          method: 'POST',
          body: credentials
        })
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.statusMessage).toContain('Validation error')
      }
    })
    
    it('should reject short password', async () => {
      const credentials = {
        email: 'user@test.com',
        password: '123'
      }
      
      try {
        await $fetch('/api/auth/login', {
          baseURL,
          method: 'POST',
          body: credentials
        })
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
      }
    })
    
    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'nonexistent@test.com',
        password: 'password123'
      }
      
      try {
        await $fetch('/api/auth/login', {
          baseURL,
          method: 'POST',
          body: credentials
        })
        expect.fail('Should have thrown authentication error')
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
        expect(error.statusMessage).toBe('Invalid credentials')
      }
    })
    
    it('should set remember me cookie duration', async () => {
      const { verifyPassword, generateToken } = vi.mocked(await import('~/server/utils/auth'))
      verifyPassword.mockResolvedValue(true)
      generateToken.mockReturnValue('mock-jwt-token')
      
      const credentials = {
        email: 'user@marketplace.dev',
        password: 'password123',
        rememberMe: true
      }
      
      const response = await $fetch('/api/auth/login', {
        baseURL,
        method: 'POST',
        body: credentials
      })
      
      expect(response.success).toBe(true)
      expect(response.expiresAt).toBeDefined()
      
      // Check that expiration is ~30 days for remember me
      const expiresAt = new Date(response.expiresAt)
      const now = new Date()
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeGreaterThan(25) // Allow some tolerance
      expect(daysDiff).toBeLessThan(35)
    })
  })
  
  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await $fetch('/api/auth/logout', {
        baseURL,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
      
      expect(response.success).toBe(true)
      expect(response.message).toBe('Logout successful')
    })
    
    it('should logout even without token', async () => {
      const response = await $fetch('/api/auth/logout', {
        baseURL,
        method: 'POST'
      })
      
      expect(response.success).toBe(true)
    })
  })
  
  describe('GET /api/auth/me', () => {
    it('should return current user info with valid token', async () => {
      const { validateJWT } = vi.mocked(await import('~/server/utils/auth'))
      validateJWT.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        permissions: ['read', 'create']
      })
      
      const response = await $fetch('/api/auth/me', {
        baseURL,
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      })
      
      expect(response.success).toBe(true)
      expect(response.data.user).toMatchObject({
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
        permissions: ['read', 'create']
      })
    })
    
    it('should reject invalid token', async () => {
      const { validateJWT } = vi.mocked(await import('~/server/utils/auth'))
      validateJWT.mockRejectedValue(new Error('Invalid token'))
      
      try {
        await $fetch('/api/auth/me', {
          baseURL,
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        })
        expect.fail('Should have thrown authentication error')
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })
    
    it('should require authorization header', async () => {
      try {
        await $fetch('/api/auth/me', {
          baseURL
        })
        expect.fail('Should have thrown authentication error')
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })
  })
})