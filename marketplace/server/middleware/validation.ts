/**
 * Global validation middleware for Nuxt server
 * Handles request validation and sanitization
 */

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = getMethod(event)
  
  // Skip validation for non-API routes
  if (!url.pathname.startsWith('/api/')) {
    return
  }
  
  // Validate Content-Type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = getHeader(event, 'content-type') || ''
    
    if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      console.warn(`Invalid Content-Type: ${contentType} for ${method} ${url.pathname}`)
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Content-Type. Expected application/json or multipart/form-data'
      })
    }
  }
  
  // Validate request size
  const contentLength = getHeader(event, 'content-length')
  if (contentLength) {
    const maxSize = url.pathname.includes('/images') ? 10 * 1024 * 1024 : 1024 * 1024 // 10MB for images, 1MB for others
    
    if (parseInt(contentLength) > maxSize) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Request entity too large'
      })
    }
  }
  
  // Sanitize query parameters
  if (url.search) {
    const query = getQuery(event)
    
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        // Check for potential XSS/injection patterns
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+=/i,
          /\beval\(/i,
          /\balert\(/i,
          /'\s*or\s*'1'='1/i,
          /\bunion\s+select/i,
        ]
        
        if (dangerousPatterns.some(pattern => pattern.test(value))) {
          console.warn(`Blocked potentially dangerous query parameter: ${key}=${value}`)
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid query parameter detected'
          })
        }
        
        // URL decode and limit length
        if (value.length > 1000) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Query parameter too long'
          })
        }
      }
    }
  }
  
  // Add validation context for specific routes
  if (url.pathname.includes('/items/')) {
    const itemIdMatch = url.pathname.match(/\/items\/([^/]+)/)
    if (itemIdMatch) {
      const itemId = itemIdMatch[1]
      
      // Validate item ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(itemId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid item ID format'
        })
      }
      
      // Store validated ID in context
      event.context.validatedItemId = itemId
    }
  }
  
  // Validate auction ID format
  if (url.pathname.includes('/auctions/')) {
    const auctionIdMatch = url.pathname.match(/\/auctions\/([^/]+)/)
    if (auctionIdMatch) {
      const auctionId = auctionIdMatch[1]
      
      if (!/^[a-zA-Z0-9_-]+$/.test(auctionId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid auction ID format'
        })
      }
      
      event.context.validatedAuctionId = auctionId
    }
  }
  
  // Validate transaction ID format
  if (url.pathname.includes('/transactions/')) {
    const transactionIdMatch = url.pathname.match(/\/transactions\/([^/]+)/)
    if (transactionIdMatch) {
      const transactionId = transactionIdMatch[1]
      
      if (!/^[a-zA-Z0-9_-]+$/.test(transactionId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid transaction ID format'
        })
      }
      
      event.context.validatedTransactionId = transactionId
    }
  }
})