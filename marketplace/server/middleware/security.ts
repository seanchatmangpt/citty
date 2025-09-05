/**
 * Security middleware for Nuxt server
 * Implements CORS, rate limiting, and security headers
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'

// Rate limiters for different endpoints
const authLimiter = new RateLimiterMemory({
  keyGen: (req: any) => req.ip || 'unknown',
  points: 5, // Number of attempts
  duration: 900, // Per 15 minutes
})

const apiLimiter = new RateLimiterMemory({
  keyGen: (req: any) => req.ip || 'unknown',
  points: 100, // Number of requests
  duration: 60, // Per minute
})

const uploadLimiter = new RateLimiterMemory({
  keyGen: (req: any) => req.ip || 'unknown',
  points: 10, // Number of uploads
  duration: 3600, // Per hour
})

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = getMethod(event)
  const userAgent = getHeader(event, 'user-agent') || ''
  const origin = getHeader(event, 'origin') || ''
  const clientIP = getClientIP(event, { xForwardedFor: true }) || 'unknown'
  
  // Set security headers
  setHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:;",
  })
  
  // Handle CORS for API routes
  if (url.pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://marketplace.citty.pro']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
    
    // Handle preflight OPTIONS requests
    if (method === 'OPTIONS') {
      setHeaders(event, {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400', // 24 hours
      })
      return ''
    }
    
    // Set CORS headers for actual requests
    setHeaders(event, {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Credentials': 'true',
    })
  }
  
  // Block suspicious requests
  const suspiciousPatterns = [
    /\.php$/,
    /\.asp$/,
    /\.jsp$/,
    /wp-admin/,
    /wp-login/,
    /phpmyadmin/,
    /\.env$/,
    /\.git/,
    /\.well-known/,
  ]
  
  if (suspiciousPatterns.some(pattern => pattern.test(url.pathname))) {
    console.warn(`Blocked suspicious request: ${method} ${url.pathname} from ${clientIP}`)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    })
  }
  
  // Block requests with malicious user agents
  const maliciousAgents = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /masscan/i,
    /zgrab/i,
  ]
  
  if (maliciousAgents.some(pattern => pattern.test(userAgent))) {
    console.warn(`Blocked request from suspicious user agent: ${userAgent} from ${clientIP}`)
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }
  
  // Apply rate limiting
  try {
    if (url.pathname.startsWith('/api/auth/')) {
      // Stricter rate limiting for authentication endpoints
      await authLimiter.consume(clientIP)
    } else if (url.pathname.includes('/images') && method === 'POST') {
      // Rate limit file uploads
      await uploadLimiter.consume(clientIP)
    } else if (url.pathname.startsWith('/api/')) {
      // General API rate limiting
      await apiLimiter.consume(clientIP)
    }
  } catch (rateLimiterRes: any) {
    const remainingPoints = rateLimiterRes?.remainingPoints ?? 0
    const msBeforeNext = rateLimiterRes?.msBeforeNext ?? 0
    
    setHeaders(event, {
      'Retry-After': Math.round(msBeforeNext / 1000),
      'X-RateLimit-Limit': String(rateLimiterRes.totalHits ?? 100),
      'X-RateLimit-Remaining': String(remainingPoints),
      'X-RateLimit-Reset': String(new Date(Date.now() + msBeforeNext)),
    })
    
    console.warn(`Rate limit exceeded for ${clientIP}: ${method} ${url.pathname}`)
    
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests'
    })
  }
  
  // Log security events
  if (process.env.NODE_ENV === 'production' && url.pathname.startsWith('/api/')) {
    console.log(`Security check passed: ${method} ${url.pathname} from ${clientIP}`, {
      userAgent: userAgent.substring(0, 100),
      origin,
      timestamp: new Date().toISOString()
    })
  }
})