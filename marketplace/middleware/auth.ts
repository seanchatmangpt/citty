import jwt from 'jsonwebtoken'

// Authentication middleware for protected routes
export default defineNuxtRouteMiddleware((to, from) => {
  // Skip auth check on client-side rendering for now
  if (process.client) return
  
  // Define routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/profile', 
    '/transactions',
    '/my-items',
    '/sell'
  ]
  
  // Check if current route requires authentication
  const requiresAuth = protectedRoutes.some(route => to.path.startsWith(route))
  
  if (requiresAuth) {
    // Check for authentication token in cookies or headers
    const authCookie = useCookie('auth-token')
    const config = useRuntimeConfig()
    
    if (!authCookie.value) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(authCookie.value, config.jwtSecret) as any
      
      // Store user info in Nuxt state for use in components
      const user = useState('auth.user', () => ({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      }))
      
      // Update user state
      user.value = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      }
      
    } catch (error) {
      // Clear invalid token
      authCookie.value = null
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired token'
      })
    }
  }
})