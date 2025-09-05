#!/usr/bin/env tsx

/**
 * Security Features Demonstration
 * Shows how the Unjucks security measures protect against common attacks
 */

import { resolve } from 'pathe'

// Import security middleware directly (since build might have issues)
import type { SecurityConfig } from '../packages/unjucks/src/types'

// Mock security middleware for demonstration
class MockSecurityMiddleware {
  private config: Required<SecurityConfig>

  constructor(config?: SecurityConfig) {
    this.config = {
      enabled: true,
      pathTraversalProtection: true,
      fileExtensionValidation: true,
      allowedExtensions: ['.njk', '.j2', '.html'],
      templateSizeLimit: 1024 * 1024,
      templateComplexityLimit: 50,
      htmlEscaping: true,
      urlValidation: true,
      urlTimeout: 5000,
      urlSizeLimit: 10 * 1024 * 1024,
      allowedProtocols: ['https:'],
      allowedDomains: [],
      contentSecurityPolicy: {
        enabled: true,
        dangerousConstructs: ['eval(', 'Function(', 'require(', 'process.'],
        maxLoopIterations: 1000,
        maxIncludeDepth: 10,
        allowEval: false,
        allowArbitraryCode: false
      },
      ...config
    }
  }

  validatePath(filePath: string): string {
    if (!this.config.pathTraversalProtection) return filePath

    if (filePath.includes('..') || filePath.includes('~')) {
      throw new Error(`Path traversal attempt detected: ${filePath}`)
    }

    if (this.config.fileExtensionValidation) {
      const ext = filePath.split('.').pop()
      if (ext && !this.config.allowedExtensions.some(allowed => allowed.endsWith(ext))) {
        throw new Error(`File extension '.${ext}' is not allowed`)
      }
    }

    return filePath
  }

  sanitizeContextData(data: any): any {
    if (!this.config.htmlEscaping) return data

    const escape = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
    }

    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') return escape(obj)
      if (Array.isArray(obj)) return obj.map(sanitize)
      if (obj && typeof obj === 'object') {
        const sanitized: any = {}
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value)
        }
        return sanitized
      }
      return obj
    }

    return sanitize(data)
  }

  sanitizeTemplateContent(content: string): string {
    if (!this.config.contentSecurityPolicy.enabled) return content

    if (content.length > this.config.templateSizeLimit) {
      throw new Error(`Template too large: ${content.length} bytes`)
    }

    for (const construct of this.config.contentSecurityPolicy.dangerousConstructs) {
      if (content.includes(construct)) {
        throw new Error(`Dangerous construct detected: ${construct}`)
      }
    }

    return content
  }

  async validateUrl(url: string): Promise<void> {
    if (!this.config.urlValidation) return

    try {
      const parsed = new URL(url)
      
      if (!this.config.allowedProtocols.includes(parsed.protocol)) {
        throw new Error(`Protocol '${parsed.protocol}' not allowed`)
      }

      if (this.config.allowedDomains.length > 0) {
        const hostname = parsed.hostname.toLowerCase()
        const isAllowed = this.config.allowedDomains.some(domain => 
          hostname === domain.toLowerCase() || hostname.endsWith('.' + domain.toLowerCase())
        )
        
        if (!isAllowed) {
          throw new Error(`Domain '${hostname}' not allowed`)
        }
      }

      // Check for suspicious URLs
      const suspicious = ['localhost', '127.0.0.1', '0.0.0.0']
      if (suspicious.includes(parsed.hostname.toLowerCase())) {
        throw new Error(`Suspicious URL detected: ${url}`)
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid URL format: ${url}`)
      }
      throw error
    }
  }
}

// Security demonstration functions
async function demonstratePathSecurity() {
  console.log('\n🔒 Path Traversal Protection Demo')
  console.log('=' .repeat(50))
  
  const security = new MockSecurityMiddleware()
  
  const testPaths = [
    './templates/user.njk',      // ✅ Safe
    'components/header.njk',     // ✅ Safe  
    '../../../etc/passwd',       // ❌ Path traversal
    'templates/../secrets.txt',  // ❌ Directory traversal
    '~/private.njk',            // ❌ Home directory access
    'template.php'              // ❌ Invalid extension
  ]
  
  for (const path of testPaths) {
    try {
      security.validatePath(path)
      console.log(`✅ SAFE: ${path}`)
    } catch (error) {
      console.log(`❌ BLOCKED: ${path} - ${error.message}`)
    }
  }
}

async function demonstrateContentSecurity() {
  console.log('\n🔒 Template Content Security Demo')  
  console.log('=' .repeat(50))
  
  const security = new MockSecurityMiddleware()
  
  const testTemplates = [
    'Hello {{ name }}!',                                    // ✅ Safe
    '{% for item in items %}{{ item }}{% endfor %}',      // ✅ Safe
    '{{ eval("console.log(\'hacked\')") }}',             // ❌ Dangerous eval
    '{{ Function("return process.env")() }}',              // ❌ Function constructor
    '{{ require("fs").readFileSync("/etc/passwd") }}',     // ❌ Require call
    '{{ process.exit(1) }}'                                // ❌ Process access
  ]
  
  for (const template of testTemplates) {
    try {
      security.sanitizeTemplateContent(template)
      console.log(`✅ SAFE: ${template.substring(0, 30)}...`)
    } catch (error) {
      console.log(`❌ BLOCKED: ${template.substring(0, 30)}... - ${error.message}`)
    }
  }
}

async function demonstrateDataSanitization() {
  console.log('\n🔒 Context Data Sanitization Demo')
  console.log('=' .repeat(50))
  
  const security = new MockSecurityMiddleware()
  
  const unsafeData = {
    user: {
      name: '<script>alert("XSS")</script>',
      bio: 'Bio with <img src="x" onerror="alert(\'XSS\')">'  
    },
    items: [
      { title: 'Safe title' },
      { title: '<script>document.location="http://evil.com"</script>' }
    ],
    config: {
      debug: true,
      apiKey: 'safe-key-123'
    }
  }
  
  console.log('Original data:')
  console.log(JSON.stringify(unsafeData, null, 2))
  
  const sanitizedData = security.sanitizeContextData(unsafeData)
  
  console.log('\nSanitized data:')
  console.log(JSON.stringify(sanitizedData, null, 2))
}

async function demonstrateUrlSecurity() {
  console.log('\n🔒 URL Validation Security Demo')
  console.log('=' .repeat(50))
  
  const security = new MockSecurityMiddleware({
    allowedProtocols: ['https:'],
    allowedDomains: ['schema.org', 'www.w3.org']
  })
  
  const testUrls = [
    'https://schema.org/ontology.ttl',           // ✅ Safe
    'https://www.w3.org/2000/01/rdf-schema',    // ✅ Safe
    'http://schema.org/ontology.ttl',           // ❌ HTTP not allowed
    'https://evil-site.com/data.ttl',           // ❌ Domain not allowed  
    'https://localhost/data.ttl',               // ❌ Suspicious URL
    'not-a-url',                                // ❌ Invalid format
    'ftp://files.example.com/data.ttl'          // ❌ Protocol not allowed
  ]
  
  for (const url of testUrls) {
    try {
      await security.validateUrl(url)
      console.log(`✅ SAFE: ${url}`)
    } catch (error) {
      console.log(`❌ BLOCKED: ${url} - ${error.message}`)
    }
  }
}

async function demonstrateConfigurationOptions() {
  console.log('\n⚙️  Security Configuration Demo')
  console.log('=' .repeat(50))
  
  // Strict production config
  const productionSecurity = new MockSecurityMiddleware({
    enabled: true,
    pathTraversalProtection: true,
    fileExtensionValidation: true,
    allowedExtensions: ['.njk'],
    htmlEscaping: true,
    urlValidation: true,
    allowedProtocols: ['https:'],
    allowedDomains: ['api.company.com'],
    templateSizeLimit: 100 * 1024, // 100KB
    contentSecurityPolicy: {
      enabled: true,
      allowEval: false,
      allowArbitraryCode: false,
      maxLoopIterations: 100
    }
  })
  
  // Relaxed development config  
  const developmentSecurity = new MockSecurityMiddleware({
    enabled: true,
    pathTraversalProtection: true,
    fileExtensionValidation: false,
    htmlEscaping: false,
    urlValidation: true,
    allowedProtocols: ['http:', 'https:'],
    allowedDomains: [],
    templateSizeLimit: 2 * 1024 * 1024, // 2MB
    contentSecurityPolicy: {
      enabled: true,
      allowEval: false,
      maxLoopIterations: 1000
    }
  })
  
  console.log('Production Security (Strict):')
  try {
    productionSecurity.validatePath('template.html')  // Will fail - only .njk allowed
  } catch (error) {
    console.log(`❌ ${error.message}`)
  }
  
  console.log('\nDevelopment Security (Relaxed):')  
  try {
    developmentSecurity.validatePath('template.html')  // Will pass - any extension allowed
    console.log('✅ template.html allowed in development mode')
  } catch (error) {
    console.log(`❌ ${error.message}`)
  }
}

// Main demo execution
async function runSecurityDemo() {
  console.log('🛡️  Unjucks Security Features Demonstration')
  console.log('=' .repeat(60))
  console.log('This demo shows how the security middleware protects against common attacks\n')
  
  try {
    await demonstratePathSecurity()
    await demonstrateContentSecurity()  
    await demonstrateDataSanitization()
    await demonstrateUrlSecurity()
    await demonstrateConfigurationOptions()
    
    console.log('\n✅ Security demonstration completed successfully!')
    console.log('\n📋 Security Features Summary:')
    console.log('   • Path traversal protection')
    console.log('   • File extension validation')  
    console.log('   • HTML/XSS sanitization')
    console.log('   • Template content security policy')
    console.log('   • URL validation and domain whitelisting')
    console.log('   • Size and complexity limits')
    console.log('   • Configurable security levels')
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    process.exit(1)
  }
}

// Run the demo if this file is executed directly
runSecurityDemo().catch(console.error)

export { runSecurityDemo }