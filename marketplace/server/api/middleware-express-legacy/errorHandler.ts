import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/errors.js'

export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500
  let message = 'Internal server error'
  let details: any = {}

  // Handle custom API errors
  if (error instanceof ApiError) {
    statusCode = error.statusCode
    message = error.message
    details = error.details
  } 
  // Handle validation errors
  else if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation error'
    details = { errors: error.message }
  }
  // Handle MongoDB/database errors
  else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    statusCode = 400
    message = 'Database error'
    if (process.env.NODE_ENV === 'development') {
      details = { error: error.message }
    }
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
  }
  // Handle file upload errors
  else if (error.name === 'MulterError') {
    statusCode = 400
    message = 'File upload error'
    details = { error: error.message }
  }
  // Handle rate limit errors
  else if (error.name === 'TooManyRequestsError') {
    statusCode = 429
    message = 'Too many requests'
  }
  // Generic errors
  else {
    if (process.env.NODE_ENV === 'development') {
      details = { 
        error: error.message,
        stack: error.stack 
      }
    }
  }

  // Log error
  console.error(`[${new Date().toISOString()}] ${statusCode} - ${message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  })

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ...details,
    },
  })
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Route ${req.originalUrl} not found`)
  next(error)
}