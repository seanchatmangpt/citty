# Comprehensive Template Validation Guide

The Citty template validation system provides comprehensive security, syntax, and performance validation for Jinja2/Nunjucks templates with advanced threat detection and sandboxing capabilities.

## Features

### 🔒 Security Validation
- **Hardcoded Secret Detection**: Finds API keys, passwords, tokens, and certificates
- **Template Injection Protection**: Detects code execution attempts and dangerous functions
- **XSS Protection**: Context-aware XSS vulnerability detection with proper escaping analysis
- **Sandbox Escape Detection**: Identifies attempts to break out of template sandbox
- **Path Traversal Prevention**: Validates template includes and extends for directory traversal

### 🎯 Syntax Validation
- **Template Structure**: Validates Jinja2/Nunjucks syntax and block matching
- **Variable Analysis**: Checks for undefined variables and dangerous names
- **Cross-Reference Validation**: Validates template dependencies and circular references
- **Performance Analysis**: Identifies complex expressions and nested loops

### 🚀 Advanced Features
- **Template Sandboxing**: Safe execution testing in isolated environment
- **Circular Dependency Detection**: Finds circular references between templates
- **Performance Profiling**: Analyzes template complexity and optimization opportunities
- **Comprehensive Reporting**: Detailed security and performance reports

## Usage

### Basic Validation

```bash
# Validate current directory
npx citty validate

# Validate specific file
npx citty validate templates/user-profile.j2

# Validate with JSON output
npx citty validate --format json
```

### Security-Focused Validation

```bash
# Comprehensive security scanning
npx citty validate --comprehensive

# Security-only mode
npx citty validate --security-only

# Enable sandbox testing
npx citty validate --sandbox
```

### Integration in CI/CD

```bash
# Fail build on security issues
npx citty validate --comprehensive --format json | jq '.errors'
if [ $? -eq 2 ]; then
  echo "Critical security issues found!"
  exit 1
fi
```

## Validation Rules

### Security Rules

#### 1. Hardcoded Secrets Detection
```jinja2
<!-- ❌ Bad: Hardcoded API key -->
API_KEY = "sk-1234567890abcdef"

<!-- ✅ Good: Environment variable -->
API_KEY = "{{ env.API_KEY }}"
```

#### 2. Template Injection Prevention
```jinja2
<!-- ❌ Bad: Code execution -->
{{ __import__("os").system("rm -rf /") }}

<!-- ✅ Good: Safe variable access -->
{{ user.name | e }}
```

#### 3. XSS Protection
```jinja2
<!-- ❌ Bad: Unescaped in script context -->
<script>var data = {{ user_input }};</script>

<!-- ✅ Good: Proper JSON encoding -->
<script>var data = {{ user_input | tojson }};</script>

<!-- ❌ Bad: Unsafe filter -->
<div>{{ user_content | safe }}</div>

<!-- ✅ Good: Escaped output -->
<div>{{ user_content | e }}</div>
```

#### 4. Sandbox Escape Prevention
```jinja2
<!-- ❌ Bad: Class hierarchy access -->
{{ config.__class__.__bases__ }}

<!-- ✅ Good: Direct property access -->
{{ config.debug }}
```

### Syntax Rules

#### 1. Block Matching
```jinja2
<!-- ❌ Bad: Mismatched blocks -->
{% for item in items %}
  <p>{{ item }}</p>
{% endif %}

<!-- ✅ Good: Matched blocks -->
{% for item in items %}
  <p>{{ item }}</p>
{% endfor %}
```

#### 2. Variable Safety
```jinja2
<!-- ❌ Bad: Dangerous variable -->
{{ __builtins__ }}

<!-- ✅ Good: Safe variable -->
{{ user.name }}
```

### Cross-Template Rules

#### 1. Path Validation
```jinja2
<!-- ❌ Bad: Path traversal -->
{% include "../../../etc/passwd" %}

<!-- ✅ Good: Relative include -->
{% include "partials/header.html" %}
```

#### 2. Reference Validation
```jinja2
<!-- ❌ Bad: External URL -->
{% include "https://evil.com/template.j2" %}

<!-- ✅ Good: Local template -->
{% include "components/button.j2" %}
```

## Advanced Configuration

### Programmatic Usage

```typescript
import { ComprehensiveTemplateValidator } from '@citty/validation';

const validator = new ComprehensiveTemplateValidator({
  allowedFunctions: ['range', 'len', 'str'],
  maxExecutionTime: 5000,
  restrictFileAccess: true
});

const results = await validator.validateTemplate(
  templateContent, 
  'template.j2'
);

const summary = validator.createValidationSummary(results, 'template.j2');
console.log(summary);
```

### Custom Rules

```typescript
import { ValidationRule } from '@citty/validation';

const customRule: ValidationRule = {
  id: 'custom-rule',
  name: 'Custom Template Rule',
  description: 'Validates custom template patterns',
  category: 'security',
  severity: 'error',
  validate(context) {
    // Custom validation logic
    return [];
  }
};

validator.addRule(customRule);
```

## Security Best Practices

### 1. Template Escaping
- Always escape user input with `|e` filter
- Use `|tojson` for JavaScript context
- Use `|urlencode` for URL context
- Avoid `|safe` filter unless content is trusted

### 2. Template Structure
- Keep templates in dedicated directories
- Use relative paths for includes
- Validate all external template references
- Implement template versioning

### 3. Sandbox Configuration
- Restrict available functions and modules
- Set execution timeouts
- Limit memory usage
- Monitor template performance

### 4. Secret Management
- Use environment variables for all secrets
- Implement proper secret rotation
- Audit template access to sensitive data
- Use dedicated secret management systems

## Error Codes

- **0**: No issues found
- **1**: Warnings or non-critical errors found
- **2**: Critical security issues found

## Integration Examples

### GitHub Actions

```yaml
- name: Validate Templates
  run: |
    npx citty validate --comprehensive --format json > validation-results.json
    if [ $? -eq 2 ]; then
      echo "::error::Critical security issues found in templates"
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
npx citty validate --security-only --format json
exit $?
```

### Docker Integration

```dockerfile
RUN npx citty validate --comprehensive
```

## Troubleshooting

### Common Issues

1. **VM2 Not Available**
   - Install optional dependency: `npm install vm2`
   - Sandbox validation will be limited without VM2

2. **Nunjucks Not Found**
   - Install optional dependency: `npm install nunjucks`
   - Basic syntax validation will be used as fallback

3. **Performance Issues**
   - Reduce template complexity
   - Limit nested loops
   - Use template caching
   - Optimize data preprocessing

### Debug Mode

```bash
DEBUG=citty:validation npx citty validate --comprehensive
```

This will provide detailed logging of the validation process for troubleshooting.

## Support

For issues, questions, or contributions, please visit:
- [GitHub Repository](https://github.com/unjs/citty)
- [Documentation](https://citty.unjs.io)
- [Issue Tracker](https://github.com/unjs/citty/issues)