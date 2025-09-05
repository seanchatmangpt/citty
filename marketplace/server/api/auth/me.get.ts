import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    // Get token from cookie or Authorization header
    const token = getCookie(event, 'auth-token') || 
                  getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    // Verify JWT token
    const config = useRuntimeConfig()
    const jwtSecret = config.jwtSecret || 'your-jwt-secret'
    
    let decoded: any
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (jwtError) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired token'
      })
    }
    
    // Mock user lookup - in production, query database
    const mockUsers = [
      {
        id: 'user1',
        email: 'buyer@marketplace.dev',
        name: 'John Buyer',
        role: 'buyer',
        verified: true,
        createdAt: new Date('2024-01-01'),
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        },
        stats: {
          itemsPurchased: 12,
          totalSpent: 2450.00,
          favoriteItems: 8,
          reviews: 15
        }
      },
      {
        id: 'user2',
        email: 'seller@marketplace.dev',
        name: 'Jane Seller',
        role: 'seller',
        verified: true,
        createdAt: new Date('2024-01-01'),
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en'
        },
        stats: {
          itemsSold: 45,
          totalRevenue: 8750.00,
          rating: 4.8,
          reviews: 89
        }
      },
      {
        id: 'admin',
        email: 'admin@marketplace.dev',
        name: 'Admin User',
        role: 'admin',
        verified: true,
        createdAt: new Date('2024-01-01'),
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        },
        stats: {
          usersManaged: 1250,
          transactionsProcessed: 5420,
          reportsGenerated: 156
        }
      }
    ]
    
    const user = mockUsers.find(u => u.id === decoded.userId)
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        verified: user.verified,
        createdAt: user.createdAt,
        preferences: user.preferences,
        stats: user.stats,
        lastActive: new Date()
      }
    }
    
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get user information'
    })
  }
})