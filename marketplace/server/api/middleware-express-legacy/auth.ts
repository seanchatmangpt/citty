import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiError } from '../utils/errors.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      throw new ApiError(401, 'Authentication token required')
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'marketplace-secret-key'
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || ['read'],
    }

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Invalid authentication token'))
    }
    next(error)
  }
}

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'))
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'))
    }

    next()
  }
}

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'))
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin')) {
      return next(new ApiError(403, `Permission required: ${permission}`))
    }

    next()
  }
}