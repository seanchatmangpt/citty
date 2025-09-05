/**
 * Comprehensive Template Validator Tests
 * Tests for all validation rules and security features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ComprehensiveTemplateValidator,
  TemplateSyntaxValidator,
  TemplateSecurityValidator,
  CrossTemplateValidator,
  TemplateSandboxValidator
} from '../../src/validation/comprehensive-template-validator';

describe('TemplateSyntaxValidator', () => {
  let validator: TemplateSyntaxValidator;

  beforeEach(() => {
    validator = new TemplateSyntaxValidator();
  });

  it('should detect valid template syntax', () => {
    const template = `
      <h1>{{ title }}</h1>
      {% for item in items %}
        <p>{{ item.name }}</p>
      {% endfor %}
    `;
    
    const results = validator.validateSyntax(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('should detect unclosed template variables', () => {
    const template = '<h1>{{ title </h1>';
    
    const results = validator.validateSyntax(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Unclosed template variable');
  });

  it('should detect unclosed template blocks', () => {
    const template = '<div>{% if condition </div>';
    
    const results = validator.validateSyntax(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Unclosed template block');
  });

  it('should detect mismatched template blocks', () => {
    const template = `
      {% for item in items %}
        <p>{{ item }}</p>
      {% endif %}
    `;
    
    const results = validator.validateSyntax(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Mismatched template block');
  });

  it('should detect dangerous variables', () => {
    const template = '{{ __import__ }}';
    
    const results = validator.validateSyntax(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Dangerous variable name');
  });
});

describe('TemplateSecurityValidator', () => {
  let validator: TemplateSecurityValidator;

  beforeEach(() => {
    validator = new TemplateSecurityValidator();
  });

  it('should detect hardcoded API keys', () => {
    const template = 'API_KEY="sk-1234567890abcdef"';
    
    const results = validator.validateSecurity(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('hardcoded');
  });

  it('should detect template injection attempts', () => {
    const template = '{{ __import__("os").system("rm -rf /") }}';
    
    const results = validator.validateSecurity(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('code execution');
  });

  it('should detect XSS vulnerabilities', () => {
    const template = '<script>{{ user_input }}</script>';
    
    const results = validator.validateSecurity(template, 'test.html');
    const errors = results.filter(r => r.severity === 'error' || r.severity === 'warning');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should detect unsafe |safe filter usage', () => {
    const template = '{{ user_content | safe }}';
    
    const results = validator.validateSecurity(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('safe filter');
  });

  it('should detect sandbox escape attempts', () => {
    const template = '{{ config.__class__.__bases__ }}';
    
    const results = validator.validateSecurity(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('sandbox escape');
  });

  it('should detect private key exposure', () => {
    const template = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBg...\\n-----END PRIVATE KEY-----';
    
    const results = validator.validateSecurity(template, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Private key');
  });
});

describe('CrossTemplateValidator', () => {
  let validator: CrossTemplateValidator;

  beforeEach(() => {
    validator = new CrossTemplateValidator();
  });

  it('should detect path traversal attempts', () => {
    const template = '{% include "../../../etc/passwd" %}';
    
    const results = validator.validateCrossReferences(template, 'test.j2', '/project');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Path traversal');
  });

  it('should detect absolute path usage', () => {
    const template = '{% extends "/etc/passwd" %}';
    
    const results = validator.validateCrossReferences(template, 'test.j2', '/project');
    const warnings = results.filter(r => r.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('Absolute path');
  });

  it('should detect external URL references', () => {
    const template = '{% include "https://evil.com/template.j2" %}';
    
    const results = validator.validateCrossReferences(template, 'test.j2', '/project');
    const warnings = results.filter(r => r.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('External URL');
  });

  it('should validate template reference syntax', () => {
    const template = '{% include "invalid<>file.j2" %}';
    
    const results = validator.validateCrossReferences(template, 'test.j2', '/project');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Invalid');
  });

  it('should extract template references correctly', () => {
    const template = `
      {% extends "base.j2" %}
      {% include "header.j2" %}
      {% from "utils.j2" import helper %}
      {% import "macros.j2" as macros %}
    `;
    
    const references = validator.extractTemplateReferences(template);
    expect(references).toHaveLength(4);
    expect(references.map(r => r.type)).toEqual(['extend', 'include', 'import', 'import']);
  });
});

describe('TemplateSandboxValidator', () => {
  let validator: TemplateSandboxValidator;

  beforeEach(() => {
    validator = new TemplateSandboxValidator();
  });

  it('should detect dangerous output in rendered content', async () => {
    const template = '<script>alert("{{ danger }}")</script>';
    
    const results = await validator.validateTemplateSandbox(template);
    const errors = results.filter(r => r.severity === 'error' || r.severity === 'warning');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle template execution timeout', async () => {
    // This would require a template that causes infinite loop or long execution
    // For testing, we can mock the timeout scenario
    const template = '{{ range(1000000) }}'; // Large range that might timeout
    
    const results = await validator.validateTemplateSandbox(template);
    // Should not crash, may have timeout warning
    expect(Array.isArray(results)).toBe(true);
  });

  it('should detect event handlers in output', async () => {
    const template = '<div onclick="{{ user_code }}">Click me</div>';
    
    const results = await validator.validateTemplateSandbox(template);
    const warnings = results.filter(r => r.severity === 'warning');
    expect(warnings.some(w => w.message.includes('Event handlers'))).toBe(true);
  });
});

describe('ComprehensiveTemplateValidator', () => {
  let validator: ComprehensiveTemplateValidator;

  beforeEach(() => {
    validator = new ComprehensiveTemplateValidator();
  });

  it('should perform comprehensive validation', async () => {
    const maliciousTemplate = `
      {% extends "../../../etc/passwd" %}
      {{ __import__("os").system("rm -rf /") }}
      <script>{{ user_input }}</script>
      API_KEY="sk-1234567890abcdef"
      {{ config.__class__.__bases__ }}
    `;
    
    const results = await validator.validateTemplate(maliciousTemplate, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(4); // Should catch multiple issues
  });

  it('should analyze performance issues', async () => {
    const complexTemplate = `
      {% for i in range(1000) %}
        {% for j in range(1000) %}
          {% for k in range(1000) %}
            {{ i | upper | lower | title | reverse | join(',') | split(',') }}
          {% endfor %}
        {% endfor %}
      {% endfor %}
    `;
    
    const results = await validator.validateTemplate(complexTemplate, 'test.j2');
    const warnings = results.filter(r => r.severity === 'warning');
    expect(warnings.some(w => w.message.includes('nesting'))).toBe(true);
    expect(warnings.some(w => w.message.includes('complex expression'))).toBe(true);
  });

  it('should validate safe templates without errors', async () => {
    const safeTemplate = `
      {% extends "base.j2" %}
      {% block content %}
        <h1>{{ title | e }}</h1>
        {% for item in items %}
          <p>{{ item.name | e }}</p>
        {% endfor %}
      {% endblock %}
    `;
    
    const results = await validator.validateTemplate(safeTemplate, 'test.j2');
    const errors = results.filter(r => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('should detect mixed security issues', async () => {
    const mixedTemplate = `
      SECRET="abc123"
      {% if user.is_admin %}
        {{ eval(user_code) }}
      {% endif %}
      <div style="{{ user_style | safe }}">Content</div>
    `;
    
    const results = await validator.validateTemplate(mixedTemplate, 'test.j2');
    
    // Should detect: hardcoded secret, code execution, unsafe filter
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(2);
    
    expect(errors.some(e => e.message.includes('hardcoded'))).toBe(true);
    expect(errors.some(e => e.message.includes('code execution') || e.message.includes('eval'))).toBe(true);
    expect(errors.some(e => e.message.includes('safe filter'))).toBe(true);
  });

  it('should validate template file extensions', () => {
    expect(validator.isTemplateFile('template.j2')).toBe(true);
    expect(validator.isTemplateFile('template.jinja2')).toBe(true);
    expect(validator.isTemplateFile('template.html')).toBe(true);
    expect(validator.isTemplateFile('script.js')).toBe(false);
    expect(validator.isTemplateFile('style.css')).toBe(false);
  });

  it('should create comprehensive validation summary', async () => {
    const template = `
      {% extends "base.j2" %}
      {{ dangerous_var }}
      API_KEY="secret123"
    `;
    
    const results = await validator.validateTemplate(template, 'test.j2');
    const summary = validator.createValidationSummary(results, 'test.j2');
    
    expect(summary.filePath).toBe('test.j2');
    expect(summary.totalIssues).toBeGreaterThan(0);
    expect(summary.errors).toBeGreaterThan(0);
    expect(summary.passed).toBe(false);
    expect(summary.summary).toContain('error');
  });
});

// Integration tests
describe('Template Validator Integration', () => {
  it('should handle real-world template patterns', async () => {
    const realTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>{{ page.title | e }}</title>
          <meta name="description" content="{{ page.description | e }}">
      </head>
      <body>
          {% include "partials/header.html" %}
          
          <main>
              {% block content %}
                  {% for post in posts %}
                      <article>
                          <h2>{{ post.title | e }}</h2>
                          <div class="content">{{ post.content | safe }}</div>
                          <time>{{ post.date | dateformat }}</time>
                      </article>
                  {% endfor %}
              {% endblock %}
          </main>
          
          {% include "partials/footer.html" %}
      </body>
      </html>
    `;
    
    const validator = new ComprehensiveTemplateValidator();
    const results = await validator.validateTemplate(realTemplate, 'template.html');
    
    // Should have warning about |safe filter but otherwise be valid
    const errors = results.filter(r => r.severity === 'error');
    expect(errors.length).toBeLessThanOrEqual(1); // Only the |safe filter warning
  });

  it('should handle template with complex logic', async () => {
    const complexTemplate = `
      {% macro render_table(data, columns) %}
          <table>
              <thead>
                  <tr>
                      {% for col in columns %}
                          <th>{{ col.title | e }}</th>
                      {% endfor %}
                  </tr>
              </thead>
              <tbody>
                  {% for row in data %}
                      <tr>
                          {% for col in columns %}
                              <td>
                                  {% if col.type == 'date' %}
                                      {{ row[col.key] | dateformat }}
                                  {% elif col.type == 'number' %}
                                      {{ row[col.key] | round(2) }}
                                  {% else %}
                                      {{ row[col.key] | e }}
                                  {% endif %}
                              </td>
                          {% endfor %}
                      </tr>
                  {% endfor %}
              </tbody>
          </table>
      {% endmacro %}
      
      {{ render_table(users, user_columns) }}
    `;
    
    const validator = new ComprehensiveTemplateValidator();
    const results = await validator.validateTemplate(complexTemplate, 'complex.j2');
    
    // Should be relatively clean with proper escaping
    const errors = results.filter(r => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});