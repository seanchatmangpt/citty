# Unjucks Security Features

This document demonstrates the comprehensive security measures implemented in the Unjucks template system.

## Overview

The Unjucks template system includes multiple layers of security protection:

1. **Input Sanitization** - HTML escaping and content validation
2. **Path Traversal Protection** - Prevents directory traversal attacks  
3. **File Extension Validation** - Restricts allowed file types
4. **URL Security** - Validates and restricts remote resource access
5. **Template Content Security Policy** - Blocks dangerous template constructs
6. **Size and Complexity Limits** - Prevents resource exhaustion attacks

## Basic Usage

### Secure Template Rendering

```typescript
import { TemplateRenderer, SecurityConfig } from '@unjs/unjucks'

// Create renderer with security configuration
const securityConfig: SecurityConfig = {
  enabled: true,
  pathTraversalProtection: true,
  fileExtensionValidation: true,
  allowedExtensions: ['.njk', '.html', '.md'],
  htmlEscaping: true,
  urlValidation: true,
  allowedProtocols: ['https:'],
  allowedDomains: ['trusted-domain.com'],
  templateSizeLimit: 1024 * 1024, // 1MB
  contentSecurityPolicy: {
    enabled: true,
    dangerousConstructs: ['eval(', 'Function(', 'require('],
    maxLoopIterations: 1000,
    maxIncludeDepth: 10,
    allowEval: false,
    allowArbitraryCode: false
  }
}

const renderer = new TemplateRenderer({ security: securityConfig })

// Safe template rendering
const template = 'Hello {{ name }}!'
const context = { name: '<script>alert("xss")</script>' }

const result = await renderer.renderString(template, context)
// Output: "Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;!"
```

### Path Traversal Protection

```typescript
import { validatePath, PathTraversalError } from '@unjs/unjucks'

try {
  // These will pass validation
  validatePath('templates/user.njk')
  validatePath('./components/header.njk')
  
  // These will throw PathTraversalError
  validatePath('../../../etc/passwd') // ❌ Path traversal attempt
  validatePath('~/secrets.txt') // ❌ Home directory access
  validatePath('templates/../../../config.json') // ❌ Directory traversal
} catch (error) {
  if (error instanceof PathTraversalError) {
    console.error('Security violation:', error.message)
  }
}
```

### Template Content Validation

```typescript
import { sanitizeTemplateContent, TemplateSecurityError } from '@unjs/unjucks'

try {
  // Safe template content
  const safeTemplate = 'Hello {{ user.name }}! {% for item in items %}{{ item }}{% endfor %}'
  const sanitized = sanitizeTemplateContent(safeTemplate)
  
  // Dangerous template content (will throw TemplateSecurityError)
  const dangerousTemplate = '{{ eval("process.exit(1)") }}'
  sanitizeTemplateContent(dangerousTemplate) // ❌ Security violation
} catch (error) {
  if (error instanceof TemplateSecurityError) {
    console.error('Template security violation:', error.message)
  }
}
```

### URL Validation for Remote Resources

```typescript
import { validateUrl, loadGraph, UrlValidationError } from '@unjs/untology'

const securityConfig = {
  allowedProtocols: ['https:'],
  allowedDomains: ['schema.org', 'www.w3.org'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  urlTimeout: 10000 // 10 seconds
}

try {
  // Load ontology with security validation
  await loadGraph('https://schema.org/ontology.ttl', {
    security: securityConfig
  })
  
  // These URLs will be rejected:
  await loadGraph('http://schema.org/ontology.ttl') // ❌ HTTP not allowed
  await loadGraph('https://evil-site.com/data.ttl') // ❌ Domain not allowed
  await loadGraph('https://localhost/data.ttl') // ❌ Suspicious URL
} catch (error) {
  if (error instanceof UrlValidationError) {
    console.error('URL validation failed:', error.message)
  }
}
```

### Context Data Sanitization

```typescript
import { sanitizeContextData } from '@unjs/unjucks'

// Potentially dangerous context data
const unsafeContext = {
  user: {
    name: '<script>alert("XSS")</script>',
    bio: 'User bio with <img src="x" onerror="alert(\'XSS\')">'
  },
  items: [
    { title: 'Safe title' },
    { title: '<script>document.location="http://evil.com"</script>' }
  ]
}

// Sanitize all string values to prevent XSS
const safeContext = sanitizeContextData(unsafeContext)

console.log(safeContext.user.name)
// Output: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;"

console.log(safeContext.items[1].title)
// Output: "&lt;script&gt;document.location=&quot;http:&#x2F;&#x2F;evil.com&quot;&lt;&#x2F;script&gt;"
```

## Advanced Configuration

### Custom Security Policy

```typescript
import { SecurityMiddleware } from '@unjs/unjucks'

const customSecurity = new SecurityMiddleware({
  enabled: true,
  pathTraversalProtection: true,
  fileExtensionValidation: true,
  allowedExtensions: ['.njk', '.j2', '.html'],
  htmlEscaping: true,
  templateSizeLimit: 512 * 1024, // 512KB
  urlValidation: true,
  allowedProtocols: ['https:'],
  allowedDomains: ['api.company.com', 'cdn.company.com'],
  urlTimeout: 5000,
  urlSizeLimit: 2 * 1024 * 1024, // 2MB
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
      'constructor.constructor',
      'global.',
      'window.'
    ],
    maxLoopIterations: 500,
    maxIncludeDepth: 5,
    allowEval: false,
    allowArbitraryCode: false
  }
})

// Use custom security middleware
const renderer = new TemplateRenderer({
  autoescape: true,
  security: customSecurity.getConfig()
})
```

### Development vs Production Security

```typescript
import { configureSecurity } from '@unjs/unjucks'

if (process.env.NODE_ENV === 'production') {
  // Strict security for production
  configureSecurity({
    enabled: true,
    pathTraversalProtection: true,
    fileExtensionValidation: true,
    allowedExtensions: ['.njk'],
    htmlEscaping: true,
    urlValidation: true,
    allowedProtocols: ['https:'],
    allowedDomains: ['api.yourcompany.com'],
    templateSizeLimit: 256 * 1024, // 256KB
    contentSecurityPolicy: {
      enabled: true,
      allowEval: false,
      allowArbitraryCode: false,
      maxLoopIterations: 100,
      maxIncludeDepth: 3
    }
  })
} else {
  // More permissive for development
  configureSecurity({
    enabled: true,
    pathTraversalProtection: true,
    fileExtensionValidation: false, // Allow any file type
    htmlEscaping: false, // Don't escape for easier debugging
    urlValidation: true,
    allowedProtocols: ['http:', 'https:'],
    allowedDomains: [], // Allow all domains
    templateSizeLimit: 2 * 1024 * 1024, // 2MB
    contentSecurityPolicy: {
      enabled: true,
      allowEval: false, // Still block eval
      allowArbitraryCode: false,
      maxLoopIterations: 1000,
      maxIncludeDepth: 10
    }
  })
}
```

### Secure File System Loader

The built-in `SecureFileSystemLoader` automatically applies security validation:

```typescript
import { createRenderer } from '@unjs/unjucks'

const renderer = createRenderer({
  // The renderer automatically uses SecureFileSystemLoader
  // which validates all template paths and content
  security: {
    enabled: true,
    pathTraversalProtection: true,
    fileExtensionValidation: true,
    allowedExtensions: ['.njk', '.html']
  }
})

// Safe template loading
try {
  const result = await renderer.renderFile('./templates/user-profile.njk', {
    user: { name: 'John Doe' }
  })
} catch (error) {
  // Security violations will be caught here
  console.error('Template security error:', error.message)
}
```

## Security Best Practices

1. **Always Enable Security**: Keep security enabled in production environments
2. **Validate File Extensions**: Restrict allowed template file extensions
3. **Sanitize User Input**: Always sanitize user-provided data before rendering
4. **Use HTTPS Only**: Configure URL validation to only allow HTTPS protocols
5. **Whitelist Domains**: Specify allowed domains for remote resource loading
6. **Set Size Limits**: Configure reasonable limits for template and response sizes
7. **Monitor for Violations**: Log and monitor security violations for threats
8. **Regular Updates**: Keep the security configuration updated with new threats

## Error Handling

```typescript
import { 
  SecurityError, 
  PathTraversalError, 
  UrlValidationError, 
  TemplateSecurityError 
} from '@unjs/unjucks'

try {
  await renderer.renderFile(templatePath, context)
} catch (error) {
  if (error instanceof PathTraversalError) {
    console.error('Path traversal attempt:', error.details.path)
  } else if (error instanceof UrlValidationError) {
    console.error('URL validation failed:', error.details.url, error.details.reason)
  } else if (error instanceof TemplateSecurityError) {
    console.error('Template security violation:', error.details.violation)
  } else if (error instanceof SecurityError) {
    console.error('General security error:', error.details.securityType)
  } else {
    console.error('Other error:', error.message)
  }
}
```

## Testing Security Measures

```typescript
import { describe, it, expect } from 'vitest'
import { SecurityMiddleware, PathTraversalError } from '@unjs/unjucks'

describe('Security Tests', () => {
  const security = new SecurityMiddleware()
  
  it('should block path traversal attempts', () => {
    expect(() => security.validatePath('../../../etc/passwd')).toThrow(PathTraversalError)
  })
  
  it('should sanitize XSS attempts', () => {
    const malicious = { script: '<script>alert("xss")</script>' }
    const sanitized = security.sanitizeContextData(malicious)
    expect(sanitized.script).not.toContain('<script>')
  })
  
  it('should block dangerous template constructs', () => {
    expect(() => 
      security.sanitizeTemplateContent('{{ eval("process.exit()") }}')
    ).toThrow(TemplateSecurityError)
  })
})
```

## Migration Guide

If you're upgrading from a previous version without security features:

1. **Update Dependencies**: Ensure you have the latest version with security features
2. **Review Templates**: Check existing templates for any patterns that might be blocked
3. **Configure Security**: Set up appropriate security configuration for your environment  
4. **Test Thoroughly**: Run comprehensive tests to ensure templates still work correctly
5. **Monitor Logs**: Watch for security violations in production and adjust configuration as needed

The security system is designed to be non-breaking by default, but some previously working templates might need updates if they contained potentially dangerous constructs.

## Performance Impact

The security measures are designed to have minimal performance impact:

- **Path validation**: O(1) string operations
- **Content sanitization**: O(n) where n is content length
- **HTML escaping**: O(n) for string content only
- **URL validation**: One-time validation per URL
- **CSP checking**: Pattern matching on template parsing

For high-performance scenarios, you can selectively disable certain security features, but this is not recommended for production environments handling untrusted input.