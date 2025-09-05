/**
 * Security Middleware for Unjucks Template System
 * Comprehensive security measures to prevent injection and traversal attacks
 */

import { resolve, normalize, isAbsolute, extname, basename } from 'pathe'
import { existsSync } from 'node:fs'
import { 
  SecurityConfig, 
  ContentSecurityPolicy,
  SecurityError,
  PathTraversalError,
  UrlValidationError,
  TemplateSecurityError
} from './types'

// Default security configuration
const DEFAULT_SECURITY_CONFIG: Required<SecurityConfig> = {
  enabled: true,
  pathTraversalProtection: true,
  fileExtensionValidation: true,
  allowedExtensions: ['.njk', '.nunjucks', '.j2', '.jinja2', '.html', '.htm', '.txt'],
  templateSizeLimit: 1024 * 1024, // 1MB
  templateComplexityLimit: 50, // max recursion depth
  htmlEscaping: true,
  urlValidation: true,
  urlTimeout: 5000, // 5 seconds
  urlSizeLimit: 10 * 1024 * 1024, // 10MB
  allowedProtocols: ['http:', 'https:'],
  allowedDomains: [], // empty = allow all
  contentSecurityPolicy: {
    enabled: true,
    dangerousConstructs: [
      'eval(',
      'Function(',
      'setTimeout(',
      'setInterval(',
      'require(',
      'import(',
      'process.',
      '__proto__',
      'constructor.constructor'
    ],
    maxLoopIterations: 1000,
    maxIncludeDepth: 10,
    allowEval: false,
    allowArbitraryCode: false
  }
}

/**
 * Security middleware class
 */
export class SecurityMiddleware {
  private config: Required<SecurityConfig>

  constructor(config?: SecurityConfig) {
    this.config = {
      ...DEFAULT_SECURITY_CONFIG,
      ...config,
      contentSecurityPolicy: {
        ...DEFAULT_SECURITY_CONFIG.contentSecurityPolicy,
        ...config?.contentSecurityPolicy
      }
    }
  }

  /**
   * Validate and sanitize a file path
   */
  validatePath(filePath: string, basePath?: string): string {
    if (!this.config.enabled || !this.config.pathTraversalProtection) {
      return filePath
    }

    // Normalize the path
    const normalizedPath = normalize(filePath)
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new PathTraversalError(filePath, { normalizedPath })
    }

    // If basePath is provided, ensure the resolved path is within it
    if (basePath) {
      const resolvedBase = resolve(basePath)
      const resolvedPath = resolve(basePath, normalizedPath)
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new PathTraversalError(filePath, { resolvedPath, resolvedBase })
      }
    }

    // Validate file extension
    if (this.config.fileExtensionValidation) {
      const ext = extname(normalizedPath).toLowerCase()
      if (ext && !this.config.allowedExtensions.includes(ext)) {
        throw new SecurityError(
          `File extension '${ext}' is not allowed`,
          'EXTENSION_VALIDATION',
          { path: normalizedPath, allowedExtensions: this.config.allowedExtensions }
        )
      }
    }

    return normalizedPath
  }

  /**
   * Validate multiple file paths
   */
  validatePaths(paths: string[], basePath?: string): string[] {
    return paths.map(path => this.validatePath(path, basePath))
  }

  /**
   * Sanitize template content
   */
  sanitizeTemplateContent(content: string, templatePath?: string): string {
    if (!this.config.enabled) {
      return content
    }

    // Check template size limit
    if (content.length > this.config.templateSizeLimit) {
      throw new TemplateSecurityError(
        templatePath || 'unknown',
        `Template size exceeds limit of ${this.config.templateSizeLimit} bytes`,
        { actualSize: content.length, limit: this.config.templateSizeLimit }
      )
    }

    // Apply content security policy
    if (this.config.contentSecurityPolicy.enabled) {
      this.validateTemplateContentSecurity(content, templatePath)
    }

    return content
  }

  /**
   * Validate template content security
   */
  private validateTemplateContentSecurity(content: string, templatePath?: string): void {
    const csp = this.config.contentSecurityPolicy

    // Check for dangerous constructs
    for (const construct of csp.dangerousConstructs) {
      if (content.includes(construct)) {
        throw new TemplateSecurityError(
          templatePath || 'unknown',
          `Dangerous construct detected: ${construct}`,
          { construct }
        )
      }
    }

    // Check template complexity (basic heuristic)
    const includeDepth = this.calculateIncludeDepth(content)
    if (includeDepth > csp.maxIncludeDepth) {
      throw new TemplateSecurityError(
        templatePath || 'unknown',
        `Template include depth exceeds limit of ${csp.maxIncludeDepth}`,
        { actualDepth: includeDepth, limit: csp.maxIncludeDepth }
      )
    }

    // Check for excessive loops (basic heuristic)
    const loopCount = this.countLoopConstructs(content)
    if (loopCount > csp.maxLoopIterations) {
      throw new TemplateSecurityError(
        templatePath || 'unknown',
        `Template loop count exceeds limit of ${csp.maxLoopIterations}`,
        { actualCount: loopCount, limit: csp.maxLoopIterations }
      )
    }
  }

  /**
   * Calculate template include depth (simple heuristic)
   */
  private calculateIncludeDepth(content: string): number {
    const includeMatches = content.match(/\{%\s*include\s+/g) || []
    return includeMatches.length
  }

  /**
   * Count loop constructs in template
   */
  private countLoopConstructs(content: string): number {
    const forMatches = content.match(/\{%\s*for\s+/g) || []
    const whileMatches = content.match(/\{%\s*while\s+/g) || []
    return forMatches.length + whileMatches.length
  }

  /**
   * Sanitize context data to prevent XSS
   */
  sanitizeContextData(data: any): any {
    if (!this.config.enabled || !this.config.htmlEscaping) {
      return data
    }

    return this.deepSanitize(data)
  }

  /**
   * Recursively sanitize object properties
   */
  private deepSanitize(obj: any): any {
    if (typeof obj === 'string') {
      return this.escapeHtml(obj)
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item))
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.deepSanitize(value)
      }
      return sanitized
    }
    
    return obj
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
    
    return text.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match])
  }

  /**
   * Validate URL for security
   */
  async validateUrl(url: string): Promise<void> {
    if (!this.config.enabled || !this.config.urlValidation) {
      return
    }

    let parsedUrl: URL
    
    try {
      parsedUrl = new URL(url)
    } catch (error) {
      throw new UrlValidationError(url, 'Invalid URL format', { error })
    }

    // Check protocol
    if (!this.config.allowedProtocols.includes(parsedUrl.protocol)) {
      throw new UrlValidationError(
        url,
        `Protocol '${parsedUrl.protocol}' is not allowed`,
        { allowedProtocols: this.config.allowedProtocols }
      )
    }

    // Check domain if whitelist is configured
    if (this.config.allowedDomains.length > 0) {
      const hostname = parsedUrl.hostname.toLowerCase()
      const isAllowed = this.config.allowedDomains.some(domain => 
        hostname === domain.toLowerCase() || hostname.endsWith('.' + domain.toLowerCase())
      )
      
      if (!isAllowed) {
        throw new UrlValidationError(
          url,
          `Domain '${hostname}' is not in allowed domains`,
          { allowedDomains: this.config.allowedDomains }
        )
      }
    }

    // Check for suspicious URLs
    if (this.isSuspiciousUrl(parsedUrl)) {
      throw new UrlValidationError(url, 'Suspicious URL detected')
    }
  }

  /**
   * Check if URL is suspicious
   */
  private isSuspiciousUrl(url: URL): boolean {
    const suspicious = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::]',
      '::1'
    ]

    const hostname = url.hostname.toLowerCase()
    
    // Check for localhost variations
    if (suspicious.includes(hostname)) {
      return true
    }

    // Check for private IP ranges
    if (this.isPrivateIp(hostname)) {
      return true
    }

    // Check for suspicious patterns
    if (hostname.includes('..') || hostname.includes('--')) {
      return true
    }

    return false
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIp(hostname: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    
    if (!ipv4Regex.test(hostname)) {
      return false
    }

    const parts = hostname.split('.').map(Number)
    
    // Private IP ranges:
    // 10.0.0.0/8
    // 172.16.0.0/12
    // 192.168.0.0/16
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    )
  }

  /**
   * Create a secure fetch function with timeout and size limits
   */
  createSecureFetch(): (url: string, options?: RequestInit) => Promise<string> {
    return async (url: string, options?: RequestInit): Promise<string> => {
      await this.validateUrl(url)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.urlTimeout)

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        if (!response.ok) {
          throw new UrlValidationError(
            url,
            `HTTP ${response.status}: ${response.statusText}`
          )
        }

        // Check content length
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > this.config.urlSizeLimit) {
          throw new UrlValidationError(
            url,
            `Response too large: ${contentLength} bytes`,
            { limit: this.config.urlSizeLimit }
          )
        }

        const content = await response.text()
        
        // Double-check actual size
        if (content.length > this.config.urlSizeLimit) {
          throw new UrlValidationError(
            url,
            `Response too large: ${content.length} bytes`,
            { limit: this.config.urlSizeLimit }
          )
        }

        return content
      } finally {
        clearTimeout(timeoutId)
      }
    }
  }

  /**
   * Get current security configuration
   */
  getConfig(): Required<SecurityConfig> {
    return { ...this.config }
  }

  /**
   * Update security configuration
   */
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      contentSecurityPolicy: {
        ...this.config.contentSecurityPolicy,
        ...updates.contentSecurityPolicy
      }
    }
  }
}

// Default security middleware instance
let defaultSecurity: SecurityMiddleware | null = null

/**
 * Get or create default security middleware
 */
export function getDefaultSecurity(): SecurityMiddleware {
  if (!defaultSecurity) {
    defaultSecurity = new SecurityMiddleware()
  }
  return defaultSecurity
}

/**
 * Configure default security middleware
 */
export function configureSecurity(config: SecurityConfig): void {
  defaultSecurity = new SecurityMiddleware(config)
}

/**
 * Validate path using default security middleware
 */
export function validatePath(filePath: string, basePath?: string): string {
  return getDefaultSecurity().validatePath(filePath, basePath)
}

/**
 * Sanitize template content using default security middleware
 */
export function sanitizeTemplateContent(content: string, templatePath?: string): string {
  return getDefaultSecurity().sanitizeTemplateContent(content, templatePath)
}

/**
 * Sanitize context data using default security middleware
 */
export function sanitizeContextData(data: any): any {
  return getDefaultSecurity().sanitizeContextData(data)
}

/**
 * Validate URL using default security middleware
 */
export async function validateUrl(url: string): Promise<void> {
  return getDefaultSecurity().validateUrl(url)
}

/**
 * Create secure fetch function using default security middleware
 */
export function createSecureFetch(): (url: string, options?: RequestInit) => Promise<string> {
  return getDefaultSecurity().createSecureFetch()
}