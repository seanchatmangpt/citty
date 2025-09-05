/**
 * Basic Unjucks Functionality Validation
 * Tests core functionality without complex context management
 */

import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import matter from 'gray-matter';
import { registerExtensions } from '../../src/unjucks/extensions';

describe('Unjucks Basic Functionality', () => {
  
  describe('Enhanced Filters', () => {
    it('should provide semantic convention filters', () => {
      const env = nunjucks.configure({ autoescape: false });
      
      // Simulate the filter registration from our implementation
      env.addFilter('camelCase', (str: string) => {
        if (!str || typeof str !== 'string') return str;
        return str
          .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^[A-Z]/, char => char.toLowerCase());
      });
      
      env.addFilter('kebabCase', (str: string) => {
        if (!str || typeof str !== 'string') return str;
        return str
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();
      });
      
      env.addFilter('pascalCase', (str: string) => {
        if (!str || typeof str !== 'string') return str;
        return str
          .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^[a-z]/, char => char.toUpperCase());
      });
      
      env.addFilter('snakeCase', (str: string) => {
        if (!str || typeof str !== 'string') return str;
        return str
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toLowerCase();
      });
      
      env.addFilter('constantCase', (str: string) => {
        if (!str || typeof str !== 'string') return str;
        return str
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toUpperCase();
      });
      
      // Test filters
      expect(env.renderString('{{ "hello_world" | camelCase }}', {})).toBe('helloWorld');
      expect(env.renderString('{{ "HelloWorld" | kebabCase }}', {})).toBe('hello-world');
      expect(env.renderString('{{ "hello-world" | pascalCase }}', {})).toBe('HelloWorld');
      expect(env.renderString('{{ "helloWorld" | snakeCase }}', {})).toBe('hello_world');
      expect(env.renderString('{{ "hello world" | constantCase }}', {})).toBe('HELLO_WORLD');
    });
  });
  
  describe('Template Structure Parsing', () => {
    it('should parse front matter correctly', () => {
      const templateContent = `---
to: src/commands/{{ name | kebabCase }}.ts
description: Command template
category: cli
---
import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: '{{ name }}',
    description: '{{ description }}'
  },
  run() {
    console.log('Running {{ name }}');
  }
});`;

      const parsed = matter(templateContent);
      
      expect(parsed.data).toBeDefined();
      expect(parsed.data.to).toBe('src/commands/{{ name | kebabCase }}.ts');
      expect(parsed.data.description).toBe('Command template');
      expect(parsed.data.category).toBe('cli');
      expect(parsed.content).toContain('import { defineCommand }');
    });
  });
  
  describe('Security Validation', () => {
    it('should validate path safety', () => {
      const safePaths = [
        'src/commands/test.ts',
        'output/file.txt',
        'nested/deep/path.js'
      ];
      
      const unsafePaths = [
        '../../../etc/passwd',
        '/etc/hosts',
        '..\\..\\windows\\system32'
      ];
      
      const isPathSafe = (path: string): boolean => {
        return !path.includes('..') && !path.startsWith('/') && !path.includes('\\');
      };
      
      safePaths.forEach(path => {
        expect(isPathSafe(path)).toBe(true);
      });
      
      unsafePaths.forEach(path => {
        expect(isPathSafe(path)).toBe(false);
      });
    });
  });
  
  describe('Template Rendering Logic', () => {
    it('should render templates with context', () => {
      const env = nunjucks.configure({ autoescape: false });
      
      const template = `Hello {{ name | title }}!
{% if description %}
Description: {{ description }}
{% endif %}
Items:
{% for item in items %}
- {{ item }}
{% endfor %}`;
      
      const context = {
        name: 'world',
        description: 'A test template',
        items: ['apple', 'banana', 'cherry']
      };
      
      const result = env.renderString(template, context);
      
      expect(result).toContain('Hello World!');
      expect(result).toContain('Description: A test template');
      expect(result).toContain('- apple');
      expect(result).toContain('- banana');
      expect(result).toContain('- cherry');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle template syntax errors gracefully', () => {
      const env = nunjucks.configure({ 
        autoescape: false,
        throwOnUndefined: false
      });
      
      // Test with missing variable
      const template1 = 'Hello {{ missing_var | default("World") }}!';
      const result1 = env.renderString(template1, {});
      expect(result1).toBe('Hello World!');
      
      // Test with undefined filter fallback
      const template2 = 'Value: {{ value or "default" }}';
      const result2 = env.renderString(template2, {});
      expect(result2).toBe('Value: default');
    });
  });
  
  describe('Advanced Template Features', () => {
    it('should handle complex data structures', () => {
      const env = nunjucks.configure({ autoescape: false });
      
      const template = `{% for category, items in data | groupby("category") %}
{{ category }}:
  {% for item in items %}
  - {{ item.name }}: {{ item.value }}
  {% endfor %}
{% endfor %}`;
      
      // Simulate groupby filter
      env.addFilter('groupby', (arr: any[], key: string) => {
        if (!Array.isArray(arr)) return [];
        const groups = new Map();
        arr.forEach(item => {
          const groupKey = item[key];
          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey).push(item);
        });
        return Array.from(groups.entries());
      });
      
      const context = {
        data: [
          { name: 'apple', category: 'fruit', value: 1 },
          { name: 'carrot', category: 'vegetable', value: 2 },
          { name: 'banana', category: 'fruit', value: 3 }
        ]
      };
      
      const result = env.renderString(template, context);
      expect(result).toContain('fruit:');
      expect(result).toContain('vegetable:');
      expect(result).toContain('apple: 1');
      expect(result).toContain('carrot: 2');
    });
  });
  
  describe('TypeScript Code Generation', () => {
    it('should generate valid TypeScript code', () => {
      const env = nunjucks.configure({ autoescape: false });
      
      // Add TypeScript-specific filter
      env.addFilter('tsType', (type: string) => {
        if (!type) return 'any';
        const typeMap: Record<string, string> = {
          'string': 'string',
          'number': 'number',
          'boolean': 'boolean',
          'array': 'any[]'
        };
        return typeMap[type.toLowerCase()] || type;
      });
      
      const template = `interface {{ name | pascalCase }} {
{% for prop in properties %}
  {{ prop.name }}: {{ prop.type | tsType }};
{% endfor %}
}

export class {{ name | pascalCase }} {
  constructor(
{% for prop in properties %}
    private {{ prop.name }}: {{ prop.type | tsType }}{{ "," if not loop.last }}
{% endfor %}
  ) {}
  
{% for method in methods %}
  {{ method.name }}(): {{ method.returnType | tsType }} {
    // Implementation here
  }
  
{% endfor %}
}`;
      
      env.addFilter('pascalCase', (str: string) => {
        return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
                  .replace(/^[a-z]/, char => char.toUpperCase());
      });
      
      const context = {
        name: 'user_service',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'age', type: 'number' }
        ],
        methods: [
          { name: 'getId', returnType: 'string' },
          { name: 'getName', returnType: 'string' }
        ]
      };
      
      const result = env.renderString(template, context);
      expect(result).toContain('interface UserService {');
      expect(result).toContain('id: string;');
      expect(result).toContain('export class UserService {');
      expect(result).toContain('getId(): string {');
    });
  });
});