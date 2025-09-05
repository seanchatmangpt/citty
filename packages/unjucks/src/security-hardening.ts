/**
 * 🧠 DARK MATTER: Security Hardening & Input Validation
 * The critical security layer humans always forget
 */

import { createHash, randomBytes } from 'crypto'
import { readFile } from 'fs/promises'
import { resolve, join, normalize } from 'path'

export interface SecurityPolicy {
  allowUnsafeOperations: boolean
  maxTemplateSize: number
  maxContextDepth: number
  allowedExtensions: string[]
  blockedPatterns: RegExp[]
  sanitizeInput: boolean
  enableSandboxing: boolean
  allowFileAccess: boolean
  allowedDirectories: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: SecurityViolation[]
  warnings: SecurityViolation[]
  sanitized?: any
}

export interface SecurityViolation {
  type: 'path_traversal' | 'code_injection' | 'resource_exhaustion' | 'unsafe_operation' | 'malicious_content'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  location?: string
  suggestion?: string
}

/**
 * Advanced security hardening system with multiple layers
 */
export class SecurityHardening {
  private policy: SecurityPolicy
  private securityNonce: string
  private trustedHashes: Set<string> = new Set()
  private rateLimiter: Map<string, { count: number, resetTime: number }> = new Map()
  
  constructor(policy: Partial<SecurityPolicy> = {}) {
    this.policy = {
      allowUnsafeOperations: false,
      maxTemplateSize: 1024 * 1024, // 1MB
      maxContextDepth: 10,
      allowedExtensions: ['.njk', '.nunjucks', '.j2', '.html', '.md'],
      blockedPatterns: [
        /eval\s*\(/gi,
        /function\s*\(/gi,
        /constructor\s*\(/gi,
        /process\./gi,
        /require\s*\(/gi,
        /import\s+/gi,
        /__proto__/gi,
        /prototype/gi,
        /\.\.\/\.\.\//g, // Path traversal
        /\.\.[\/\\]/g,   // More path traversal
      ],
      sanitizeInput: true,
      enableSandboxing: true,
      allowFileAccess: true,
      allowedDirectories: ['./templates', './src', './examples'],
      ...policy
    }
    
    this.securityNonce = this.generateNonce()
  }

  /**
   * Comprehensive security validation
   */
  async validateSecurity(
    input: any,
    operation: string,
    context?: any
  ): Promise<ValidationResult> {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []
    let sanitized = input

    // Rate limiting check
    const rateLimitViolation = this.checkRateLimit(operation)
    if (rateLimitViolation) {
      errors.push(rateLimitViolation)
    }

    // Input validation
    if (typeof input === 'string') {
      const stringValidation = this.validateString(input, operation)
      errors.push(...stringValidation.errors)
      warnings.push(...stringValidation.warnings)
      if (this.policy.sanitizeInput) {
        sanitized = stringValidation.sanitized
      }
    }

    // Context validation
    if (context) {
      const contextValidation = this.validateContext(context)
      errors.push(...contextValidation.errors)
      warnings.push(...contextValidation.warnings)
    }

    // Path validation for file operations
    if (operation.includes('file') || operation.includes('template')) {
      const pathValidation = await this.validatePath(input)
      errors.push(...pathValidation.errors)
      warnings.push(...pathValidation.warnings)
    }

    // Resource exhaustion checks
    const resourceValidation = this.validateResources(input, operation)
    errors.push(...resourceValidation.errors)
    warnings.push(...resourceValidation.warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized
    }
  }

  /**
   * Validate string content for security issues
   */
  validateString(input: string, operation: string): ValidationResult {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []
    let sanitized = input

    // Size check
    if (input.length > this.policy.maxTemplateSize) {
      errors.push({
        type: 'resource_exhaustion',
        severity: 'high',
        message: `Input too large: ${input.length} bytes (max: ${this.policy.maxTemplateSize})`,
        suggestion: 'Reduce input size or increase limit'
      })
    }

    // Malicious pattern detection
    for (const pattern of this.policy.blockedPatterns) {
      const matches = input.match(pattern)
      if (matches) {
        const severity = this.getPatternSeverity(pattern)
        errors.push({
          type: severity === 'critical' ? 'code_injection' : 'unsafe_operation',
          severity,
          message: `Blocked pattern detected: ${matches[0]}`,
          suggestion: 'Remove or escape the detected pattern'
        })
      }
    }

    // Template-specific validation
    if (operation.includes('template')) {
      const templateValidation = this.validateTemplateContent(input)
      errors.push(...templateValidation.errors)
      warnings.push(...templateValidation.warnings)
    }

    // Sanitization
    if (this.policy.sanitizeInput && errors.length === 0) {
      sanitized = this.sanitizeString(input)
    }

    return { valid: errors.length === 0, errors, warnings, sanitized }
  }

  /**
   * Validate context object for security issues
   */
  validateContext(context: any, depth: number = 0): ValidationResult {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []

    // Depth check
    if (depth > this.policy.maxContextDepth) {
      errors.push({
        type: 'resource_exhaustion',
        severity: 'medium',
        message: `Context depth too deep: ${depth} (max: ${this.policy.maxContextDepth})`,
        suggestion: 'Reduce context nesting'
      })
      return { valid: false, errors, warnings }
    }

    // Type validation
    if (context === null || context === undefined) {
      return { valid: true, errors, warnings }
    }

    // Dangerous properties check
    const dangerousProps = [
      '__proto__', 'constructor', 'prototype',
      'process', 'global', 'require', 'eval',
      'Function', 'Object'
    ]

    for (const prop of dangerousProps) {
      if (prop in context) {
        errors.push({
          type: 'unsafe_operation',
          severity: 'critical',
          message: `Dangerous property detected: ${prop}`,
          location: `context.${prop}`,
          suggestion: 'Remove dangerous property from context'
        })
      }
    }

    // Recursive validation for objects
    if (typeof context === 'object' && context !== null) {
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'object') {
          const nestedValidation = this.validateContext(value, depth + 1)
          errors.push(...nestedValidation.errors.map(err => ({
            ...err,
            location: `context.${key}${err.location ? '.' + err.location : ''}`
          })))
          warnings.push(...nestedValidation.warnings)
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Validate file paths for security issues
   */
  async validatePath(path: string): Promise<ValidationResult> {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []

    if (typeof path !== 'string') {
      return { valid: true, errors, warnings }
    }

    // Path traversal check
    const normalizedPath = normalize(path)
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      errors.push({
        type: 'path_traversal',
        severity: 'critical',
        message: `Path traversal detected: ${path}`,
        suggestion: 'Use relative paths within allowed directories'
      })
    }

    // Directory whitelist check
    if (this.policy.allowFileAccess) {
      const isAllowed = this.policy.allowedDirectories.some(allowed => 
        normalizedPath.startsWith(normalize(allowed))
      )
      
      if (!isAllowed) {
        errors.push({
          type: 'path_traversal',
          severity: 'high',
          message: `Path outside allowed directories: ${path}`,
          suggestion: `Use paths within: ${this.policy.allowedDirectories.join(', ')}`
        })
      }
    }

    // Extension check
    const extension = path.split('.').pop()?.toLowerCase()
    if (extension && !this.policy.allowedExtensions.includes(`.${extension}`)) {
      warnings.push({
        type: 'unsafe_operation',
        severity: 'medium',
        message: `Potentially unsafe file extension: .${extension}`,
        suggestion: `Use allowed extensions: ${this.policy.allowedExtensions.join(', ')}`
      })
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Validate resource consumption
   */
  validateResources(input: any, operation: string): ValidationResult {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []

    // Memory usage estimation
    const inputSize = JSON.stringify(input || {}).length
    if (inputSize > this.policy.maxTemplateSize / 2) {
      warnings.push({
        type: 'resource_exhaustion',
        severity: 'medium',
        message: `Large input detected: ${inputSize} bytes`,
        suggestion: 'Consider processing in chunks'
      })
    }

    // Array/object size limits
    if (Array.isArray(input) && input.length > 10000) {
      errors.push({
        type: 'resource_exhaustion',
        severity: 'high',
        message: `Array too large: ${input.length} items`,
        suggestion: 'Implement pagination or chunking'
      })
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Validate template content specifically
   */
  private validateTemplateContent(content: string): ValidationResult {
    const errors: SecurityViolation[] = []
    const warnings: SecurityViolation[] = []

    // Nunjucks-specific dangerous patterns
    const templatePatterns = [
      /\{\{\s*.*eval.*\}\}/gi,
      /\{\{\s*.*constructor.*\}\}/gi,
      /\{\{\s*.*__proto__.*\}\}/gi,
      /\{\%.*eval.*\%\}/gi,
      /\{\%.*import.*\%\}/gi,
    ]

    for (const pattern of templatePatterns) {
      const matches = content.match(pattern)
      if (matches) {
        errors.push({
          type: 'code_injection',
          severity: 'critical',
          message: `Dangerous template pattern: ${matches[0]}`,
          suggestion: 'Remove or escape the template expression'
        })
      }
    }

    // Check for excessive nesting
    const openTags = (content.match(/\{\%/g) || []).length
    const closeTags = (content.match(/\%\}/g) || []).length
    
    if (openTags !== closeTags) {
      warnings.push({
        type: 'malicious_content',
        severity: 'medium',
        message: 'Unmatched template tags detected',
        suggestion: 'Ensure all template tags are properly closed'
      })
    }

    if (openTags > 1000) {
      errors.push({
        type: 'resource_exhaustion',
        severity: 'high',
        message: `Too many template tags: ${openTags}`,
        suggestion: 'Reduce template complexity'
      })
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(operation: string): SecurityViolation | null {
    const now = Date.now()
    const windowMs = 60000 // 1 minute window
    const maxRequests = 1000 // Max requests per window

    if (!this.rateLimiter.has(operation)) {
      this.rateLimiter.set(operation, { count: 1, resetTime: now + windowMs })
      return null
    }

    const limit = this.rateLimiter.get(operation)!
    
    if (now > limit.resetTime) {
      // Reset window
      limit.count = 1
      limit.resetTime = now + windowMs
      return null
    }

    limit.count++
    
    if (limit.count > maxRequests) {
      return {
        type: 'resource_exhaustion',
        severity: 'high',
        message: `Rate limit exceeded for operation: ${operation}`,
        suggestion: 'Reduce request frequency'
      }
    }

    return null
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      // Remove null bytes
      .replace(/\0/g, '')
      // Escape potential XSS
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      // Remove dangerous function calls
      .replace(/eval\s*\(/gi, 'BLOCKED_eval(')
      .replace(/function\s*\(/gi, 'BLOCKED_function(')
      .replace(/constructor\s*\(/gi, 'BLOCKED_constructor(')
  }

  /**
   * Get pattern severity level
   */
  private getPatternSeverity(pattern: RegExp): SecurityViolation['severity'] {
    const criticalPatterns = [/eval/, /constructor/, /__proto__/, /process\./]
    
    if (criticalPatterns.some(p => p.source === pattern.source)) {
      return 'critical'
    }
    
    return 'high'
  }

  /**
   * Generate secure nonce
   */
  private generateNonce(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Create content hash for trusted content
   */
  createContentHash(content: string): string {
    return createHash('sha256').update(content + this.securityNonce).digest('hex')
  }

  /**
   * Add trusted content hash
   */
  addTrustedHash(hash: string): void {
    this.trustedHashes.add(hash)
  }

  /**
   * Check if content is trusted
   */
  isTrustedContent(content: string): boolean {
    const hash = this.createContentHash(content)
    return this.trustedHashes.has(hash)
  }

  /**
   * Create secure template execution context
   */
  createSecureContext(context: any): any {
    if (!context || typeof context !== 'object') {
      return context
    }

    // Create sanitized copy
    const secure = JSON.parse(JSON.stringify(context))
    
    // Remove dangerous properties
    this.removeDangerousProperties(secure)
    
    // Add security metadata
    secure._security = {
      nonce: this.securityNonce,
      timestamp: Date.now(),
      policy: 'restricted'
    }
    
    return secure
  }

  /**
   * Remove dangerous properties recursively
   */
  private removeDangerousProperties(obj: any): void {
    if (!obj || typeof obj !== 'object') return
    
    const dangerousProps = [
      '__proto__', 'constructor', 'prototype',
      'process', 'global', 'require', 'eval',
      'Function', 'Object'
    ]
    
    for (const prop of dangerousProps) {
      delete obj[prop]
    }
    
    // Recurse into nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        this.removeDangerousProperties(value)
      }
    }
  }

  /**
   * Get security report
   */
  getSecurityReport(): {
    policy: SecurityPolicy
    trustedHashes: number
    rateLimitedOperations: number
    recentViolations: number
  } {
    return {
      policy: this.policy,
      trustedHashes: this.trustedHashes.size,
      rateLimitedOperations: this.rateLimiter.size,
      recentViolations: 0 // Would track in production
    }
  }
}

// Singleton instance with secure defaults
export const security = new SecurityHardening({
  allowUnsafeOperations: false,
  sanitizeInput: true,
  enableSandboxing: true,
  allowFileAccess: true
})

// Convenience functions
export async function validateInput(
  input: any,
  operation: string,
  context?: any
): Promise<ValidationResult> {
  return security.validateSecurity(input, operation, context)
}

export function sanitizeContext(context: any): any {
  return security.createSecureContext(context)
}

export function isSecure(content: string): boolean {
  return security.isTrustedContent(content)
}

export function addTrustedContent(content: string): string {
  const hash = security.createContentHash(content)
  security.addTrustedHash(hash)
  return hash
}