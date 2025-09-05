import { getUserFromEvent } from '~/server/utils/auth'

/**
 * Global authentication middleware for Nuxt server
 * Adds user information to context if authenticated
 */
export default defineEventHandler(async (event) => {
  // Skip auth for public routes
  const url = getRequestURL(event)
  const publicRoutes = [
    '/api/marketplace/items',
    '/api/marketplace/search',
    '/api/marketplace/featured',
    '/api/marketplace/auctions',
    '/api/auth/login',
    '/api/auth/register',
    '/_nuxt',
    '/favicon.ico',
    '/images',
    '/public'
  ]
  
  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(route => url.pathname.startsWith(route))
  
  if (isPublicRoute) {
    return
  }
  
  // Try to get user from token (non-blocking)
  const user = await getUserFromEvent(event)
  
  // Store user in context for use in API routes
  if (user) {
    event.context.user = user
  }
  
  // Log authentication attempts for security monitoring
  if (url.pathname.startsWith('/api/')) {
    const authHeader = getHeader(event, 'authorization')
    console.log(`API Request: ${event.node.req.method} ${url.pathname}, Auth: ${user ? 'authenticated' : 'anonymous'}`)
  }
})