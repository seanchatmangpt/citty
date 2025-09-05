/**
 * Basic Template Validator Tests
 * Simple tests for template validation functionality
 */

import { describe, it, expect } from 'vitest';

// Simple test to verify template validation concepts
describe('Basic Template Validation', () => {
  it('should detect hardcoded secrets', () => {
    const content = 'API_KEY="sk-1234567890abcdef"';
    const secretPattern = /api[_-]?key\s*[=:]\s*['"'][^'"\s]{10,}['"']/i;
    
    expect(secretPattern.test(content)).toBe(true);
  });

  it('should detect template injection patterns', () => {
    const content = '{{ __import__("os").system("rm -rf /") }}';
    const injectionPattern = /\{\{\s*(?:__import__|eval|exec|compile)\s*\(/g;
    
    expect(injectionPattern.test(content)).toBe(true);
  });

  it('should detect XSS vulnerabilities', () => {
    const content = '<script>{{ user_input }}</script>';
    const xssPattern = /<script[^>]*>\{\{[^}]+\}\}<\/script>/g;
    
    expect(xssPattern.test(content)).toBe(true);
  });

  it('should detect path traversal attempts', () => {
    const content = '{% include "../../../etc/passwd" %}';
    const pathTraversalPattern = /\.\.\//;
    
    expect(pathTraversalPattern.test(content)).toBe(true);
  });

  it('should validate safe templates', () => {
    const content = `
      <h1>{{ title | e }}</h1>
      {% for item in items %}
        <p>{{ item.name | e }}</p>
      {% endfor %}
    `;
    
    // Should not contain dangerous patterns
    const dangerousPatterns = [
      /\{\{\s*(?:__import__|eval|exec|compile)\s*\(/g,
      /api[_-]?key\s*[=:]\s*['"'][^'"\s]{10,}['"']/i,
      /<script[^>]*>\{\{[^}]+\}\}<\/script>/g,
      /\.\.\//
    ];
    
    const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(content));
    expect(hasDangerousPattern).toBe(false);
  });

  it('should extract template variables correctly', () => {
    const content = `
      {{ title }}
      {{ user.name }}
      {% set local_var = "value" %}
      {% for item in items %}
        {{ item.id }}
      {% endfor %}
    `;
    
    const variables = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Extract variables from {{ variable }}
      const varMatches = Array.from(line.matchAll(/\{\{\s*([\w_.]+).*?\}\}/g));
      for (const match of varMatches) {
        variables.push({
          name: match[1],
          line: index + 1,
          context: 'global'
        });
      }
      
      // Extract variables from {% set variable = ... %}
      const setMatches = Array.from(line.matchAll(/\{%\s*set\s+(\w+)\s*=.*?%\}/g));
      for (const match of setMatches) {
        variables.push({
          name: match[1],
          line: index + 1,
          context: 'local'
        });
      }
    });
    
    expect(variables.length).toBeGreaterThan(0);
    expect(variables.some(v => v.name === 'title')).toBe(true);
    expect(variables.some(v => v.name === 'user.name')).toBe(true);
    expect(variables.some(v => v.name === 'local_var' && v.context === 'local')).toBe(true);
  });

  it('should validate template block structure', () => {
    const validTemplate = `
      {% for item in items %}
        <p>{{ item }}</p>
      {% endfor %}
    `;
    
    const invalidTemplate = `
      {% for item in items %}
        <p>{{ item }}</p>
      {% endif %}
    `;
    
    // Simple block matching check
    const extractBlocks = (content: string) => {
      const blocks: string[] = [];
      const lines = content.split('\n');
      
      lines.forEach(line => {
        const blockMatch = line.match(/\{%\s*(\w+)/);
        if (blockMatch) {
          const blockType = blockMatch[1];
          if (['for', 'if', 'block'].includes(blockType)) {
            blocks.push(blockType);
          } else if (blockType.startsWith('end')) {
            const expectedEnd = blockType.substring(3);
            const lastBlock = blocks.pop();
            if (lastBlock !== expectedEnd) {
              throw new Error(`Mismatched block: expected end${lastBlock}, got ${blockType}`);
            }
          }
        }
      });
      
      return blocks.length === 0; // All blocks should be matched
    };
    
    expect(extractBlocks(validTemplate)).toBe(true);
    expect(() => extractBlocks(invalidTemplate)).toThrow();
  });

  it('should detect dangerous variable names', () => {
    const dangerousNames = [
      '__import__', '__builtins__', 'eval', 'exec', 'compile',
      'open', 'file', 'globals', 'locals'
    ];
    
    const isDangerousVariable = (name: string): boolean => {
      return dangerousNames.includes(name.toLowerCase());
    };
    
    expect(isDangerousVariable('__import__')).toBe(true);
    expect(isDangerousVariable('eval')).toBe(true);
    expect(isDangerousVariable('user_name')).toBe(false);
    expect(isDangerousVariable('title')).toBe(false);
  });
});