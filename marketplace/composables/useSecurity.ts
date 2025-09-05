/**
 * Security Composable
 * Provides client-side security utilities, input sanitization, and CSRF protection
 */

export interface SecurityConfig {
  enableCSRFProtection: boolean
  enableXSSProtection: boolean
  enableInputSanitization: boolean
  maxRequestSize: number
  rateLimitWindow: number
  rateLimitMax: number
}

export interface SecurityViolation {
  type: 'xss' | 'csrf' | 'rate-limit' | 'suspicious-activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: string
  timestamp: Date
  userAgent?: string
  ip?: string
}

export const useSecurity = (config: Partial<SecurityConfig> = {}) => {
  const defaultConfig: SecurityConfig = {
    enableCSRFProtection: true,
    enableXSSProtection: true,
    enableInputSanitization: true,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 100
  }

  const securityConfig = { ...defaultConfig, ...config }
  const violations = ref<SecurityViolation[]>([])
  const requestLog = ref<Map<string, number[]>>(new Map())

  // CSRF Token Management
  const csrfToken = ref<string | null>(null)
  
  const generateCSRFToken = (): string => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  const getCSRFToken = async (): Promise<string> => {
    if (!csrfToken.value) {
      try {
        const response = await $fetch('/api/csrf-token')
        csrfToken.value = response.token
      } catch (error) {
        // Fallback to client-generated token
        csrfToken.value = generateCSRFToken()
        console.warn('Failed to get CSRF token from server, using client-generated token')
      }
    }
    return csrfToken.value
  }

  // XSS Protection
  const sanitizeHTML = (input: string): string => {
    if (!securityConfig.enableXSSProtection) return input

    // Create a temporary element to leverage browser's built-in HTML parsing
    const temp = document.createElement('div')
    temp.textContent = input
    let sanitized = temp.innerHTML

    // Remove potentially dangerous attributes and scripts
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /javascript:/gi,
      /data:/gi,
      /vbscript:/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*>/gi,
      /<link\b[^<]*>/gi,
      /<meta\b[^<]*>/gi
    ]

    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '')
    })

    return sanitized
  }

  const validateInput = (input: string, rules: {
    maxLength?: number
    allowedChars?: RegExp
    forbiddenPatterns?: RegExp[]
  } = {}): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (rules.maxLength && input.length > rules.maxLength) {
      errors.push(`Input exceeds maximum length of ${rules.maxLength} characters`)
    }

    if (rules.allowedChars && !rules.allowedChars.test(input)) {
      errors.push('Input contains invalid characters')
    }

    if (rules.forbiddenPatterns) {
      rules.forbiddenPatterns.forEach((pattern, index) => {
        if (pattern.test(input)) {
          errors.push(`Input matches forbidden pattern ${index + 1}`)
        }
      })
    }

    // Check for common XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /data:text\/html/i
    ]

    xssPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        errors.push('Potentially malicious content detected')
        reportViolation({
          type: 'xss',
          severity: 'high',
          details: `XSS pattern detected in input: ${pattern.source}`
        })
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Rate Limiting
  const checkRateLimit = (identifier: string = 'global'): boolean => {
    const now = Date.now()
    const requests = requestLog.value.get(identifier) || []
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(
      timestamp => now - timestamp < securityConfig.rateLimitWindow
    )

    if (recentRequests.length >= securityConfig.rateLimitMax) {
      reportViolation({
        type: 'rate-limit',
        severity: 'medium',
        details: `Rate limit exceeded for identifier: ${identifier}`
      })
      return false
    }

    // Add current request
    recentRequests.push(now)
    requestLog.value.set(identifier, recentRequests)
    
    return true
  }

  // Content Security Policy
  const validateCSP = (): boolean => {
    if (!process.client) return true

    try {
      // Check if CSP is properly configured
      const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
      const hasCSP = metaTags.length > 0
      
      if (!hasCSP) {
        console.warn('Content Security Policy not detected')
        return false
      }

      return true
    } catch (error) {
      console.error('Error validating CSP:', error)
      return false
    }
  }

  // Secure Headers Validation
  const validateSecureHeaders = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      const headers = response.headers

      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'x-xss-protection'
      ]

      const missingHeaders = requiredHeaders.filter(
        header => !headers.has(header)
      )

      if (missingHeaders.length > 0) {
        console.warn('Missing security headers:', missingHeaders)
        return false
      }

      return true
    } catch (error) {
      console.error('Error validating headers:', error)
      return false
    }
  }

  // Secure API Request Wrapper
  const secureRequest = async <T>(
    url: string,
    options: RequestInit & {
      sanitizeResponse?: boolean
      validateResponse?: boolean
    } = {}
  ): Promise<T> => {
    const { sanitizeResponse = true, validateResponse = true, ...fetchOptions } = options

    // Check rate limiting
    if (!checkRateLimit(url)) {
      throw new Error('Rate limit exceeded')
    }

    // Add CSRF token for non-GET requests
    if (securityConfig.enableCSRFProtection && 
        fetchOptions.method && fetchOptions.method !== 'GET') {
      const token = await getCSRFToken()
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'X-CSRF-Token': token
      }
    }

    // Check request size
    if (fetchOptions.body) {
      const size = new Blob([fetchOptions.body as any]).size
      if (size > securityConfig.maxRequestSize) {
        throw new Error('Request payload too large')
      }
    }

    try {
      const response = await $fetch<T>(url, fetchOptions)
      
      // Sanitize response if it's a string
      if (sanitizeResponse && typeof response === 'string') {
        return sanitizeHTML(response) as T
      }
      
      return response
    } catch (error) {
      // Log security-related errors
      if (error instanceof Error) {
        reportViolation({
          type: 'suspicious-activity',
          severity: 'medium',
          details: `Request failed: ${error.message}`
        })
      }
      throw error
    }
  }

  // File Upload Security
  const validateFileUpload = (file: File, options: {
    allowedTypes?: string[]
    maxSize?: number
    scanForMalware?: boolean
  } = {}): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    const {
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      maxSize = 5 * 1024 * 1024, // 5MB
      scanForMalware = true
    } = options

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`)
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum of ${maxSize} bytes`)
    }

    // Basic malware scanning (check for suspicious patterns in filename)
    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.pif', '.vbs', '.js']
    const hasSuspiciousExtension = suspiciousExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    )

    if (hasSuspiciousExtension) {
      errors.push('File appears to be potentially malicious')
      reportViolation({
        type: 'suspicious-activity',
        severity: 'high',
        details: `Suspicious file upload attempt: ${file.name}`
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Security Violation Reporting
  const reportViolation = (violation: Omit<SecurityViolation, 'timestamp' | 'userAgent' | 'ip'>) => {
    const fullViolation: SecurityViolation = {
      ...violation,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      // IP would be determined server-side
    }

    violations.value.unshift(fullViolation)
    
    // Keep only last 100 violations
    if (violations.value.length > 100) {
      violations.value = violations.value.slice(0, 100)
    }

    // Log critical violations
    if (violation.severity === 'critical') {
      console.error('Critical security violation:', fullViolation)
    }

    // Send to security monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      sendToSecurityService(fullViolation)
    }
  }

  const sendToSecurityService = async (violation: SecurityViolation) => {
    try {
      await $fetch('/api/security/violations', {
        method: 'POST',
        body: violation
      })
    } catch (error) {
      console.error('Failed to report security violation:', error)
    }
  }

  // Password Security
  const validatePassword = (password: string): {
    isValid: boolean
    strength: 'weak' | 'medium' | 'strong' | 'very-strong'
    suggestions: string[]
  } => {
    const suggestions: string[] = []
    let score = 0

    // Length check
    if (password.length >= 8) score += 1
    else suggestions.push('Use at least 8 characters')

    if (password.length >= 12) score += 1

    // Character variety
    if (/[a-z]/.test(password)) score += 1
    else suggestions.push('Include lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else suggestions.push('Include uppercase letters')

    if (/\d/.test(password)) score += 1
    else suggestions.push('Include numbers')

    if (/[^A-Za-z0-9]/.test(password)) score += 1
    else suggestions.push('Include special characters')

    // Avoid common patterns
    const commonPatterns = [
      /123/,
      /abc/i,
      /password/i,
      /qwerty/i,
      /(.)\1{2,}/ // Repeated characters
    ]

    if (!commonPatterns.some(pattern => pattern.test(password))) {
      score += 1
    } else {
      suggestions.push('Avoid common patterns or repeated characters')
    }

    const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : score < 6 ? 'strong' : 'very-strong'

    return {
      isValid: score >= 4,
      strength,
      suggestions
    }
  }

  // Security Statistics
  const getSecurityStats = computed(() => {
    const totalViolations = violations.value.length
    const violationsBySeverity = violations.value.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const recentViolations = violations.value.filter(
      v => Date.now() - v.timestamp.getTime() < 3600000 // Last hour
    ).length

    return {
      totalViolations,
      recentViolations,
      violationsBySeverity,
      csrfProtectionEnabled: securityConfig.enableCSRFProtection,
      xssProtectionEnabled: securityConfig.enableXSSProtection
    }
  })

  return {
    // Configuration
    securityConfig,
    
    // Input validation and sanitization
    sanitizeHTML,
    validateInput,
    validatePassword,
    validateFileUpload,
    
    // Request security
    secureRequest,
    getCSRFToken,
    checkRateLimit,
    
    // Security validation
    validateCSP,
    validateSecureHeaders,
    
    // Violation reporting
    reportViolation,
    violations: readonly(violations),
    
    // Statistics
    getSecurityStats
  }
}