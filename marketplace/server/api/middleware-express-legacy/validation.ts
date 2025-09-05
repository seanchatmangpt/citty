import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { ApiError } from '../utils/errors.js'

// Common validation schemas
export const schemas = {
  // Item schemas
  createItem: Joi.object({
    title: Joi.string().required().min(1).max(200),
    description: Joi.string().required().min(10).max(5000),
    price: Joi.number().positive().precision(2).required(),
    category: Joi.string().required().min(1).max(50),
    tags: Joi.array().items(Joi.string().max(30)).max(20).default([]),
    images: Joi.array().items(Joi.string().uri()).max(10).default([]),
    condition: Joi.string().valid('new', 'like-new', 'good', 'fair', 'poor').required(),
    location: Joi.object({
      country: Joi.string().required(),
      state: Joi.string(),
      city: Joi.string(),
      zipCode: Joi.string(),
    }),
    shipping: Joi.object({
      available: Joi.boolean().default(true),
      cost: Joi.number().min(0).precision(2),
      methods: Joi.array().items(Joi.string()).default(['standard']),
    }).default({}),
    specifications: Joi.object().default({}),
    isActive: Joi.boolean().default(true),
  }),

  updateItem: Joi.object({
    title: Joi.string().min(1).max(200),
    description: Joi.string().min(10).max(5000),
    price: Joi.number().positive().precision(2),
    category: Joi.string().min(1).max(50),
    tags: Joi.array().items(Joi.string().max(30)).max(20),
    images: Joi.array().items(Joi.string().uri()).max(10),
    condition: Joi.string().valid('new', 'like-new', 'good', 'fair', 'poor'),
    location: Joi.object({
      country: Joi.string(),
      state: Joi.string(),
      city: Joi.string(),
      zipCode: Joi.string(),
    }),
    shipping: Joi.object({
      available: Joi.boolean(),
      cost: Joi.number().min(0).precision(2),
      methods: Joi.array().items(Joi.string()),
    }),
    specifications: Joi.object(),
    isActive: Joi.boolean(),
  }),

  // Search schemas
  searchQuery: Joi.object({
    q: Joi.string().max(200),
    category: Joi.string().max(50),
    tags: Joi.array().items(Joi.string()),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    condition: Joi.array().items(Joi.string().valid('new', 'like-new', 'good', 'fair', 'poor')),
    location: Joi.string(),
    sortBy: Joi.string().valid('price', 'date', 'relevance', 'popularity').default('relevance'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    facets: Joi.array().items(Joi.string()),
  }),

  // Transaction schemas
  createTransaction: Joi.object({
    itemId: Joi.string().required(),
    buyerId: Joi.string().required(),
    sellerId: Joi.string().required(),
    amount: Joi.number().positive().precision(2).required(),
    quantity: Joi.number().integer().positive().default(1),
    paymentMethod: Joi.string().valid('credit_card', 'paypal', 'crypto', 'bank_transfer').required(),
    shippingAddress: Joi.object({
      name: Joi.string().required(),
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      country: Joi.string().required(),
    }).required(),
    notes: Joi.string().max(500),
  }),

  // Auction schemas
  createAuction: Joi.object({
    itemId: Joi.string().required(),
    startPrice: Joi.number().positive().precision(2).required(),
    reservePrice: Joi.number().positive().precision(2),
    bidIncrement: Joi.number().positive().precision(2).default(1.00),
    duration: Joi.number().integer().positive().max(2592000).required(), // Max 30 days in seconds
    autoExtend: Joi.boolean().default(false),
    buyItNowPrice: Joi.number().positive().precision(2),
  }),

  placeBid: Joi.object({
    auctionId: Joi.string().required(),
    amount: Joi.number().positive().precision(2).required(),
    maxBid: Joi.number().positive().precision(2),
  }),

  // Workflow schemas
  createWorkflow: Joi.object({
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().max(500),
    triggers: Joi.array().items(Joi.object({
      type: Joi.string().valid('event', 'schedule', 'webhook').required(),
      config: Joi.object().required(),
    })).min(1).required(),
    steps: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      type: Joi.string().required(),
      config: Joi.object().required(),
      conditions: Joi.array().items(Joi.object()),
    })).min(1).required(),
    isActive: Joi.boolean().default(true),
  }),

  // Recommendation schemas
  getRecommendations: Joi.object({
    userId: Joi.string(),
    itemId: Joi.string(),
    type: Joi.string().valid('collaborative', 'content-based', 'hybrid').default('hybrid'),
    limit: Joi.number().integer().min(1).max(50).default(10),
    includeViewed: Joi.boolean().default(false),
    categories: Joi.array().items(Joi.string()),
    priceRange: Joi.object({
      min: Joi.number().min(0),
      max: Joi.number().min(0),
    }),
  }),

  // Analytics schemas
  analyticsQuery: Joi.object({
    metric: Joi.string().valid('sales', 'views', 'users', 'revenue', 'conversion').required(),
    period: Joi.string().valid('hour', 'day', 'week', 'month', 'year').default('day'),
    start: Joi.date().iso(),
    end: Joi.date().iso(),
    groupBy: Joi.array().items(Joi.string()),
    filters: Joi.object(),
  }),
}

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ')
      return next(new ApiError(400, `Validation error: ${errorMessage}`))
    }

    // Replace the request property with the validated and sanitized data
    req[property] = value
    next()
  }
}

// Common parameter validation
export const validateParams = {
  id: validate(Joi.object({
    id: Joi.string().required().pattern(/^[a-zA-Z0-9_-]+$/, 'alphanumeric with dashes and underscores'),
  }), 'params'),
  
  pagination: validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }), 'query'),
}

// File upload validation
export const validateFileUpload = (
  maxSize: number = 5 * 1024 * 1024, // 5MB default
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next()
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat()
    
    for (const file of files as any[]) {
      if (file.size > maxSize) {
        return next(new ApiError(400, `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`))
      }
      
      if (!allowedTypes.includes(file.mimetype)) {
        return next(new ApiError(400, `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`))
      }
    }

    next()
  }
}