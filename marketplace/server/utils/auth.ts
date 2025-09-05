import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import { ApiError } from './errors'

export interface AuthUser {
  id: string
  email: string
  role: string
  permissions: string[]
}

export interface AuthRequest {
  user?: AuthUser
}

/**
 * Validate JWT token and extract user information
 */
export async function validateJWT(token: string): Promise<AuthUser> {
  try {
    const config = useRuntimeConfig()
    const decoded = jwt.verify(token, config.jwtSecret) as any
    
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || ['read'],
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid authentication token'
      })
    }
    throw error
  }
}

/**
 * Extract user from Authorization header
 */
export async function getUserFromEvent(event: H3Event): Promise<AuthUser | null> {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.replace('Bearer ', '')
    return await validateJWT(token)
  } catch (error) {
    return null
  }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await getUserFromEvent(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
  return user
}

/**
 * Require specific role middleware
 */
export async function requireRole(event: H3Event, roles: string[]): Promise<AuthUser> {
  const user = await requireAuth(event)
  
  if (!roles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions'
    })
  }
  
  return user
}

/**
 * Require specific permission middleware
 */
export async function requirePermission(event: H3Event, permission: string): Promise<AuthUser> {
  const user = await requireAuth(event)
  
  if (!user.permissions.includes(permission) && !user.permissions.includes('admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: `Permission required: ${permission}`
    })
  }
  
  return user
}

/**
 * Check if user has permission (non-throwing)
 */
export async function hasPermission(event: H3Event, permission: string): Promise<boolean> {
  try {
    const user = await getUserFromEvent(event)
    if (!user) return false
    
    return user.permissions.includes(permission) || user.permissions.includes('admin')
  } catch {
    return false
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: Partial<AuthUser>, expiresIn = '24h'): string {
  const config = useRuntimeConfig()
  
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      permissions: user.permissions || ['read'],
    },
    config.jwtSecret,
    { expiresIn }
  )
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt')
  return bcrypt.hash(password, 12)
}

/**
 * Verify password using bcrypt
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const bcrypt = await import('bcrypt')
  return bcrypt.compare(password, hashedPassword)
}