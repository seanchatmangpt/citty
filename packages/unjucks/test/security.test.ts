/**
 * Security Tests for Unjucks Template System
 * Comprehensive testing of security measures
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  SecurityMiddleware, 
  getDefaultSecurity,
  configureSecurity,
  validatePath,
  sanitizeTemplateContent,
  sanitizeContextData,
  validateUrl,
  createSecureFetch
} from '../src/security'
import { 
  SecurityError,
  PathTraversalError,
  UrlValidationError,
  TemplateSecurityError
} from '../src/types'
import { resolve } from 'pathe'

describe('SecurityMiddleware', () => {
  let security: SecurityMiddleware

  beforeEach(() => {
    security = new SecurityMiddleware()
  })

  describe('Path Validation', () => {
    it('should validate normal paths', () => {
      expect(() => security.validatePath('template.njk')).not.toThrow()
      expect(() => security.validatePath('./templates/test.njk')).not.toThrow()
      expect(() => security.validatePath('/absolute/path/template.njk')).not.toThrow()
    })

    it('should reject path traversal attempts', () => {
      expect(() => security.validatePath('../../../etc/passwd')).toThrow(PathTraversalError)
      expect(() => security.validatePath('templates/../../../secrets.txt')).toThrow(PathTraversalError)
      expect(() => security.validatePath('~/secrets.txt')).toThrow(PathTraversalError)
    })

    it('should validate file extensions', () => {
      const securityWithRestrictions = new SecurityMiddleware({
        fileExtensionValidation: true,
        allowedExtensions: ['.njk', '.html']
      })

      expect(() => securityWithRestrictions.validatePath('template.njk')).not.toThrow()
      expect(() => securityWithRestrictions.validatePath('template.html')).not.toThrow()
      expect(() => securityWithRestrictions.validatePath('malicious.php')).toThrow(SecurityError)
      expect(() => securityWithRestrictions.validatePath('shell.sh')).toThrow(SecurityError)
    })

    it('should validate paths within base directory', () => {
      const basePath = resolve('/safe/templates')
      
      expect(() => security.validatePath('template.njk', basePath)).not.toThrow()
      expect(() => security.validatePath('../template.njk', basePath)).toThrow(PathTraversalError)
    })

    it('should allow disabling path validation', () => {
      const unsecuredSecurity = new SecurityMiddleware({ enabled: false })
      
      expect(() => unsecuredSecurity.validatePath('../../../etc/passwd')).not.toThrow()
    })
  })

  describe('Template Content Validation', () => {
    it('should validate normal template content', () => {
      const content = 'Hello {{ name }}! {% for item in items %}{{ item }}{% endfor %}'
      expect(() => security.sanitizeTemplateContent(content)).not.toThrow()
    })

    it('should reject dangerous constructs', () => {
      const dangerousContent = [
        'Hello {{ eval("console.log(\\'hacked\\')") }}',
        '{{ Function("return process.env")() }}',
        '{{ setTimeout(() => {}, 1000) }}',
        '{{ require("fs").readFileSync("/etc/passwd") }}',
        '{{ constructor.constructor("return process")() }}',
        '{{ __proto__.constructor.constructor("return process")() }}'
      ]

      dangerousContent.forEach(content => {
        expect(() => security.sanitizeTemplateContent(content, 'test.njk')).toThrow(TemplateSecurityError)
      })
    })

    it('should enforce template size limits', () => {
      const securityWithLimits = new SecurityMiddleware({
        templateSizeLimit: 100 // 100 bytes
      })

      const smallContent = 'Hello {{ name }}'
      const largeContent = 'x'.repeat(200)

      expect(() => securityWithLimits.sanitizeTemplateContent(smallContent)).not.toThrow()
      expect(() => securityWithLimits.sanitizeTemplateContent(largeContent)).toThrow(TemplateSecurityError)
    })

    it('should validate template complexity', () => {
      const complexTemplate = Array.from({ length: 15 }, (_, i) => 
        `{% include "template${i}.njk" %}`
      ).join('\\n')

      expect(() => security.sanitizeTemplateContent(complexTemplate)).toThrow(TemplateSecurityError)
    })

    it('should allow custom dangerous construct patterns', () => {
      const customSecurity = new SecurityMiddleware({
        contentSecurityPolicy: {
          enabled: true,
          dangerousConstructs: ['custom_danger(', 'bad_function(']
        }
      })

      expect(() => customSecurity.sanitizeTemplateContent('{{ custom_danger("test") }}')).toThrow(TemplateSecurityError)
      expect(() => customSecurity.sanitizeTemplateContent('{{ bad_function() }}')).toThrow(TemplateSecurityError)
      expect(() => customSecurity.sanitizeTemplateContent('{{ safe_function() }}')).not.toThrow()
    })
  })

  describe('Context Data Sanitization', () => {
    it('should escape HTML entities by default', () => {
      const unsafeData = {
        script: '<script>alert("xss")</script>',
        html: '<img src="x" onerror="alert(\\'xss\\')">',
        quotes: 'Test "quoted" text with \\'single\\' quotes'
      }

      const sanitized = security.sanitizeContextData(unsafeData) as typeof unsafeData

      expect(sanitized.script).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;')
      expect(sanitized.html).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(&#x27;xss&#x27;)&quot;&gt;')
      expect(sanitized.quotes).toBe('Test &quot;quoted&quot; text with &#x27;single&#x27; quotes')
    })

    it('should sanitize nested objects and arrays', () => {
      const nestedData = {
        user: {
          name: '<script>alert("name")</script>',
          preferences: ['<script>alert("pref")</script>', 'normal pref']
        },
        items: [
          { title: '<script>alert("title")</script>' },
          { title: 'safe title' }
        ]
      }

      const sanitized = security.sanitizeContextData(nestedData) as typeof nestedData

      expect(sanitized.user.name).toBe('&lt;script&gt;alert(&quot;name&quot;)&lt;&#x2F;script&gt;')
      expect(sanitized.user.preferences[0]).toBe('&lt;script&gt;alert(&quot;pref&quot;)&lt;&#x2F;script&gt;')
      expect(sanitized.user.preferences[1]).toBe('normal pref')
      expect(sanitized.items[0].title).toBe('&lt;script&gt;alert(&quot;title&quot;)&lt;&#x2F;script&gt;')
      expect(sanitized.items[1].title).toBe('safe title')
    })

    it('should allow disabling HTML escaping', () => {
      const noEscapeSecurity = new SecurityMiddleware({ htmlEscaping: false })
      
      const unsafeData = { script: '<script>alert("test")</script>' }
      const result = noEscapeSecurity.sanitizeContextData(unsafeData)
      
      expect(result.script).toBe('<script>alert("test")</script>')
    })
  })

  describe('URL Validation', () => {
    it('should validate HTTPS URLs by default', async () => {
      await expect(security.validateUrl('https://example.com/data.ttl')).resolves.not.toThrow()
    })

    it('should reject HTTP URLs by default', async () => {
      await expect(security.validateUrl('http://example.com/data.ttl')).rejects.toThrow(UrlValidationError)
    })

    it('should reject invalid URL formats', async () => {
      await expect(security.validateUrl('not-a-url')).rejects.toThrow(UrlValidationError)
      await expect(security.validateUrl('file:///etc/passwd')).rejects.toThrow(UrlValidationError)
    })

    it('should validate allowed protocols', async () => {
      const httpSecurity = new SecurityMiddleware({
        urlValidation: true,
        allowedProtocols: ['http:', 'https:']
      })

      await expect(httpSecurity.validateUrl('http://example.com')).resolves.not.toThrow()
      await expect(httpSecurity.validateUrl('https://example.com')).resolves.not.toThrow()
      await expect(httpSecurity.validateUrl('ftp://example.com')).rejects.toThrow(UrlValidationError)
    })

    it('should validate allowed domains', async () => {
      const restrictedSecurity = new SecurityMiddleware({
        allowedDomains: ['example.com', 'trusted.org']
      })

      await expect(restrictedSecurity.validateUrl('https://example.com/data')).resolves.not.toThrow()
      await expect(restrictedSecurity.validateUrl('https://sub.example.com/data')).resolves.not.toThrow()
      await expect(restrictedSecurity.validateUrl('https://trusted.org/data')).resolves.not.toThrow()
      await expect(restrictedSecurity.validateUrl('https://evil.com/data')).rejects.toThrow(UrlValidationError)
    })

    it('should reject suspicious URLs', async () => {
      const suspiciousUrls = [
        'https://localhost/data',
        'https://127.0.0.1/data',
        'https://0.0.0.0/data',
        'https://192.168.1.1/data',
        'https://10.0.0.1/data',
        'https://172.16.0.1/data'
      ]

      for (const url of suspiciousUrls) {
        await expect(security.validateUrl(url)).rejects.toThrow(UrlValidationError)
      }
    })
  })

  describe('Secure Fetch', () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it('should create a secure fetch function', () => {
      const secureFetch = security.createSecureFetch()
      expect(typeof secureFetch).toBe('function')
    })

    it('should validate URLs before fetching', async () => {
      const secureFetch = security.createSecureFetch()
      
      await expect(secureFetch('http://evil.com')).rejects.toThrow()
    })

    it('should handle fetch timeouts', async () => {
      const timeoutSecurity = new SecurityMiddleware({
        urlTimeout: 100 // 100ms timeout
      })
      
      const secureFetch = timeoutSecurity.createSecureFetch()
      
      // Mock a slow response
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      )
      
      await expect(secureFetch('https://example.com')).rejects.toThrow()
    })

    it('should enforce response size limits', async () => {
      const limitedSecurity = new SecurityMiddleware({
        urlSizeLimit: 50 // 50 bytes limit
      })
      
      const secureFetch = limitedSecurity.createSecureFetch()
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', '100']]),
        text: () => Promise.resolve('x'.repeat(100))
      })
      
      await expect(secureFetch('https://example.com')).rejects.toThrow()
    })
  })

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = security.getConfig()
      
      expect(config.enabled).toBe(true)
      expect(config.pathTraversalProtection).toBe(true)
      expect(config.htmlEscaping).toBe(true)
      expect(config.urlValidation).toBe(true)
      expect(config.allowedProtocols).toEqual(['http:', 'https:'])
    })

    it('should allow configuration updates', () => {
      security.updateConfig({
        htmlEscaping: false,
        allowedProtocols: ['https:']
      })
      
      const config = security.getConfig()
      expect(config.htmlEscaping).toBe(false)
      expect(config.allowedProtocols).toEqual(['https:'])
    })

    it('should merge CSP configuration', () => {
      security.updateConfig({
        contentSecurityPolicy: {
          maxLoopIterations: 500,
          allowEval: true
        }
      })
      
      const config = security.getConfig()
      expect(config.contentSecurityPolicy.maxLoopIterations).toBe(500)
      expect(config.contentSecurityPolicy.allowEval).toBe(true)
      expect(config.contentSecurityPolicy.enabled).toBe(true) // Should preserve existing
    })
  })
})

describe('Global Security Functions', () => {
  beforeEach(() => {
    configureSecurity({}) // Reset to defaults
  })

  it('should provide global configuration', () => {
    configureSecurity({
      htmlEscaping: false,
      pathTraversalProtection: false
    })
    
    const defaultSec = getDefaultSecurity()
    const config = defaultSec.getConfig()
    
    expect(config.htmlEscaping).toBe(false)
    expect(config.pathTraversalProtection).toBe(false)
  })

  it('should provide global validation functions', () => {
    expect(() => validatePath('template.njk')).not.toThrow()
    expect(() => validatePath('../../../etc/passwd')).toThrow()
  })

  it('should provide global sanitization functions', () => {
    const content = 'Hello {{ name }}'
    const sanitized = sanitizeTemplateContent(content)
    expect(sanitized).toBe(content)
    
    const data = { html: '<script>alert("xss")</script>' }
    const sanitizedData = sanitizeContextData(data) as typeof data
    expect(sanitizedData.html).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;')
  })

  it('should provide global URL validation', async () => {
    await expect(validateUrl('https://example.com')).resolves.not.toThrow()
    await expect(validateUrl('http://localhost')).rejects.toThrow()
  })

  it('should provide global secure fetch creation', () => {
    const fetch = createSecureFetch()
    expect(typeof fetch).toBe('function')
  })
})

describe('Security Error Types', () => {
  it('should create PathTraversalError correctly', () => {
    const error = new PathTraversalError('/evil/path')
    
    expect(error).toBeInstanceOf(SecurityError)
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('SECURITY_ERROR')
    expect(error.details.securityType).toBe('PATH_TRAVERSAL')
    expect(error.details.path).toBe('/evil/path')
    expect(error.message).toContain('Path traversal attempt detected')
  })

  it('should create UrlValidationError correctly', () => {
    const error = new UrlValidationError('http://evil.com', 'invalid protocol')
    
    expect(error).toBeInstanceOf(SecurityError)
    expect(error.details.url).toBe('http://evil.com')
    expect(error.details.reason).toBe('invalid protocol')
    expect(error.message).toContain('URL validation failed')
  })

  it('should create TemplateSecurityError correctly', () => {
    const error = new TemplateSecurityError('template.njk', 'dangerous construct')
    
    expect(error).toBeInstanceOf(SecurityError)
    expect(error.details.template).toBe('template.njk')
    expect(error.details.violation).toBe('dangerous construct')
    expect(error.message).toContain('Template security violation')
  })
})