import jwt from 'jsonwebtoken'
import { z } from 'zod'

// Login schema validation
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().default(false)
})

// Mock user database - in production, use real database
const mockUsers = [
  {
    id: 'user1',
    email: 'buyer@marketplace.dev',
    password: 'password123', // In production: bcrypt hashed
    name: 'John Buyer',
    role: 'buyer',
    verified: true,
    createdAt: new Date('2024-01-01'),
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  },
  {
    id: 'user2',
    email: 'seller@marketplace.dev',
    password: 'password123', // In production: bcrypt hashed
    name: 'Jane Seller',
    role: 'seller',
    verified: true,
    createdAt: new Date('2024-01-01'),
    preferences: {
      theme: 'dark',
      notifications: true,
      language: 'en'
    }
  },
  {
    id: 'admin',
    email: 'admin@marketplace.dev',
    password: 'admin123', // In production: bcrypt hashed
    name: 'Admin User',
    role: 'admin',
    verified: true,
    createdAt: new Date('2024-01-01'),
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  }
]

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate input
    const credentials = LoginSchema.parse(body)
    const { email, password, rememberMe } = credentials
    
    // Rate limiting check (simplified - in production use proper rate limiting)
    const clientIP = getClientIP(event) || 'unknown'
    // In production, implement proper rate limiting per IP
    
    // Find user
    const user = mockUsers.find(u => u.email === email)
    if (!user) {
      // Don't reveal whether user exists for security
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }
    
    // Verify password (in production, use bcrypt.compare)
    if (user.password !== password) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }
    
    // Check if user is verified
    if (!user.verified) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Account not verified. Please check your email for verification instructions.'
      })
    }
    
    // Generate JWT token
    const config = useRuntimeConfig()
    const jwtSecret = config.jwtSecret || 'your-jwt-secret'
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      verified: user.verified
    }
    
    // Token expiration based on rememberMe
    const expiresIn = rememberMe ? '30d' : '24h'
    const token = jwt.sign(tokenPayload, jwtSecret, { 
      expiresIn,
      issuer: 'marketplace',
      subject: user.id,
      audience: 'marketplace-users'
    })
    
    // Set secure HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 24 hours
      path: '/'
    }
    
    setCookie(event, 'auth-token', token, cookieOptions)
    
    // Return user info (excluding password)
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
      createdAt: user.createdAt,
      preferences: user.preferences,
      lastLogin: new Date()
    }
    
    return {
      success: true,
      message: 'Login successful',
      user: safeUser,
      token, // Also return token for client-side storage if needed
      expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
    }
    
  } catch (error: any) {
    console.error('Login error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid input data',
        data: error.errors
      })
    }
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Login failed. Please try again.'
    })
  }
})