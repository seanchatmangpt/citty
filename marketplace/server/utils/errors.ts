/**
 * Custom error classes for the marketplace API
 */

export class ApiError extends Error {
  public statusCode: number
  public isOperational: boolean
  public data?: any

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    data?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.data = data

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, errors?: any) {
    super(400, message, true, errors)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource?: string, id?: string) {
    const message = resource && id 
      ? `${resource} with id '${id}' not found`
      : resource 
      ? `${resource} not found`
      : 'Resource not found'
    
    super(404, message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message)
    this.name = 'ConflictError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message)
    this.name = 'ForbiddenError'
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Too many requests') {
    super(429, message)
    this.name = 'RateLimitError'
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, message)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * Error handler for Nuxt server API routes
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error)

  // Handle known ApiError instances
  if (error instanceof ApiError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
      data: error.data
    })
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: error
    })
  }

  // Handle JWT errors
  if (error && typeof error === 'object' && 'name' in error) {
    if ((error as any).name === 'JsonWebTokenError') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid authentication token'
      })
    }
    if ((error as any).name === 'TokenExpiredError') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication token expired'
      })
    }
  }

  // Handle database errors (if using a database)
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as any
    
    // PostgreSQL duplicate key error
    if (dbError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Resource already exists'
      })
    }
    
    // PostgreSQL foreign key constraint error
    if (dbError.code === '23503') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid reference to related resource'
      })
    }
  }

  // Default to internal server error
  throw createError({
    statusCode: 500,
    statusMessage: 'Internal server error'
  })
}

/**
 * Async wrapper for API route handlers
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      handleApiError(error)
      throw error // This won't be reached due to handleApiError throwing
    }
  }
}

/**
 * Error response formatter
 */
export function formatErrorResponse(error: ApiError | Error) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const response: any = {
    success: false,
    error: {
      message: error.message,
      statusCode: error instanceof ApiError ? error.statusCode : 500
    }
  }

  // Include additional data for ApiError instances
  if (error instanceof ApiError && error.data) {
    response.error.data = error.data
  }

  // Include stack trace in development
  if (!isProduction) {
    response.error.stack = error.stack
  }

  return response
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers() {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    // In production, you might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    // In production, you might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  })
}