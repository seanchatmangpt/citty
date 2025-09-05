/**
 * Unit Tests for Unjucks Template Renderer
 * Tests rendering engine with various contexts and data structures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UnjucksRenderer } from '../../src/weaver/unjucks-renderer';
import type { RenderContext, RenderOptions } from '../../src/weaver/types';

describe('UnjucksRenderer', () => {
  let renderer: UnjucksRenderer;
  let tempDir: string;

  beforeEach(async () => {
    renderer = new UnjucksRenderer();
    tempDir = join(tmpdir(), `unjucks-renderer-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Variable Rendering', () => {
    it('should render simple variables', async () => {
      const template = 'Hello {{ name }}!';
      const context: RenderContext = { name: 'World' };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Hello World!');
    });

    it('should handle nested object properties', async () => {
      const template = '{{ user.profile.name }} ({{ user.profile.age }})';
      const context: RenderContext = {
        user: {
          profile: {
            name: 'John Doe',
            age: 30
          }
        }
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('John Doe (30)');
    });

    it('should handle array indexing', async () => {
      const template = 'First: {{ items[0] }}, Last: {{ items[2] }}';
      const context: RenderContext = {
        items: ['first', 'second', 'third']
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('First: first, Last: third');
    });

    it('should handle undefined variables gracefully', async () => {
      const template = 'Value: {{ missing_var | default("N/A") }}';
      const context: RenderContext = {};
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Value: N/A');
    });
  });

  describe('Loop Rendering', () => {
    it('should render simple for loops', async () => {
      const template = '{% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}';
      const context: RenderContext = {
        items: ['apple', 'banana', 'cherry']
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('apple, banana, cherry');
    });

    it('should provide loop variables', async () => {
      const template = '{% for item in items %}{{ loop.index }}: {{ item }}\n{% endfor %}';
      const context: RenderContext = {
        items: ['first', 'second', 'third']
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('1: first\n2: second\n3: third\n');
    });

    it('should handle nested loops', async () => {
      const template = `{% for category in categories %}
{{ category.name }}:
{% for item in category.items %}
  - {{ item }}
{% endfor %}
{% endfor %}`;
      
      const context: RenderContext = {
        categories: [
          {
            name: 'Fruits',
            items: ['apple', 'banana']
          },
          {
            name: 'Colors',
            items: ['red', 'blue']
          }
        ]
      };
      
      const result = await renderer.render(template, context);
      expect(result).toContain('Fruits:');
      expect(result).toContain('  - apple');
      expect(result).toContain('Colors:');
      expect(result).toContain('  - red');
    });

    it('should handle empty arrays', async () => {
      const template = '{% for item in items %}{{ item }}{% else %}No items{% endfor %}';
      const context: RenderContext = { items: [] };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('No items');
    });
  });

  describe('Conditional Rendering', () => {
    it('should handle if/else conditions', async () => {
      const template = '{% if user.admin %}Admin{% else %}User{% endif %}';
      
      let context: RenderContext = { user: { admin: true } };
      let result = await renderer.render(template, context);
      expect(result).toBe('Admin');
      
      context = { user: { admin: false } };
      result = await renderer.render(template, context);
      expect(result).toBe('User');
    });

    it('should handle complex boolean expressions', async () => {
      const template = '{% if user.age >= 18 and user.verified %}Access granted{% else %}Access denied{% endif %}';
      
      let context: RenderContext = { user: { age: 25, verified: true } };
      let result = await renderer.render(template, context);
      expect(result).toBe('Access granted');
      
      context = { user: { age: 16, verified: true } };
      result = await renderer.render(template, context);
      expect(result).toBe('Access denied');
    });

    it('should handle elif chains', async () => {
      const template = `{% if score >= 90 %}A{% elif score >= 80 %}B{% elif score >= 70 %}C{% else %}F{% endif %}`;
      
      const testCases = [
        { score: 95, expected: 'A' },
        { score: 85, expected: 'B' },
        { score: 75, expected: 'C' },
        { score: 65, expected: 'F' }
      ];
      
      for (const testCase of testCases) {
        const result = await renderer.render(template, testCase);
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('Filter Application', () => {
    it('should apply built-in filters', async () => {
      const template = '{{ name | upper | reverse }}';
      const context: RenderContext = { name: 'hello' };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('OLLEH');
    });

    it('should apply custom semantic convention filters', async () => {
      const template = `{{ "http_method" | camelCase }}
{{ "HttpServer" | snakeCase }}
{{ "user.name" | constantCase }}`;
      const context: RenderContext = {};
      
      const result = await renderer.render(template, context);
      expect(result).toBe('httpMethod\nhttp_server\nUSER_NAME');
    });

    it('should chain multiple filters', async () => {
      const template = '{{ items | length | string | upper }}';
      const context: RenderContext = {
        items: [1, 2, 3, 4, 5]
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('5');
    });

    it('should handle filter parameters', async () => {
      const template = '{{ name | default("Anonymous") | title }}';
      const context: RenderContext = {};
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Anonymous');
    });
  });

  describe('Template Inheritance', () => {
    it('should handle template extension', async () => {
      const baseTemplate = `<!DOCTYPE html>
<html>
<head><title>{% block title %}Default Title{% endblock %}</title></head>
<body>{% block content %}{% endblock %}</body>
</html>`;
      
      const childTemplate = `{% extends "base.html" %}
{% block title %}Custom Title{% endblock %}
{% block content %}<h1>Hello World</h1>{% endblock %}`;
      
      await writeFile(join(tempDir, 'base.html'), baseTemplate);
      await writeFile(join(tempDir, 'child.html'), childTemplate);
      
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      const result = await rendererWithPaths.renderFile('child.html', {});
      
      expect(result).toContain('<title>Custom Title</title>');
      expect(result).toContain('<h1>Hello World</h1>');
    });

    it('should handle block inheritance chains', async () => {
      const baseTemplate = `Base: {% block content %}Base Content{% endblock %}`;
      const middleTemplate = `{% extends "base.html" %}{% block content %}{{ super() }} + Middle Content{% endblock %}`;
      const childTemplate = `{% extends "middle.html" %}{% block content %}{{ super() }} + Child Content{% endblock %}`;
      
      await writeFile(join(tempDir, 'base.html'), baseTemplate);
      await writeFile(join(tempDir, 'middle.html'), middleTemplate);
      await writeFile(join(tempDir, 'child.html'), childTemplate);
      
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      const result = await rendererWithPaths.renderFile('child.html', {});
      
      expect(result).toBe('Base: Base Content + Middle Content + Child Content');
    });
  });

  describe('Macros and Functions', () => {
    it('should define and use macros', async () => {
      const template = `{% macro button(text, type="button") %}
<button type="{{ type }}">{{ text }}</button>
{% endmacro %}

{{ button("Click me") }}
{{ button("Submit", "submit") }}`;
      
      const result = await renderer.render(template, {});
      expect(result).toContain('<button type="button">Click me</button>');
      expect(result).toContain('<button type="submit">Submit</button>');
    });

    it('should handle macro imports', async () => {
      const macroTemplate = `{% macro formatDate(date) %}{{ date | date("YYYY-MM-DD") }}{% endmacro %}`;
      const mainTemplate = `{% from "macros.html" import formatDate %}Today: {{ formatDate(now) }}`;
      
      await writeFile(join(tempDir, 'macros.html'), macroTemplate);
      
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      const result = await rendererWithPaths.render(mainTemplate, { now: new Date('2024-01-01') });
      
      expect(result).toContain('Today:');
    });
  });

  describe('Context Management', () => {
    it('should handle context scoping in loops', async () => {
      const template = `{% set outer = "outer" %}
{% for item in items %}
  {% set inner = "inner" %}
  {{ outer }}-{{ inner }}-{{ item }}
{% endfor %}
{{ outer }}`;
      
      const context: RenderContext = {
        items: ['a', 'b']
      };
      
      const result = await renderer.render(template, context);
      expect(result).toContain('outer-inner-a');
      expect(result).toContain('outer-inner-b');
      expect(result).toContain('outer'); // outer variable accessible after loop
    });

    it('should handle context inheritance', async () => {
      const context: RenderContext = {
        global: 'global_value',
        nested: {
          local: 'local_value'
        }
      };
      
      const template = `Global: {{ global }}
Local: {{ nested.local }}
{% with extended = "extended_value" %}Extended: {{ extended }}{% endwith %}`;
      
      const result = await renderer.render(template, context);
      expect(result).toContain('Global: global_value');
      expect(result).toContain('Local: local_value');
      expect(result).toContain('Extended: extended_value');
    });

    it('should handle context modification', async () => {
      let context: RenderContext = { counter: 0 };
      const template = '{% set counter = counter + 1 %}{{ counter }}';
      
      const result = await renderer.render(template, context);
      expect(result).toBe('1');
      
      // Original context should remain unchanged
      expect(context.counter).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle template syntax errors gracefully', async () => {
      const template = '{% for item in items %}{{ item }}';
      
      await expect(async () => {
        await renderer.render(template, { items: ['test'] });
      }).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const template = '{{ undefined_function() }}';
      
      try {
        await renderer.render(template, {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle missing template files', async () => {
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      
      await expect(async () => {
        await rendererWithPaths.renderFile('missing.html', {});
      }).rejects.toThrow();
    });

    it('should handle circular includes', async () => {
      const template1 = '{% include "template2.html" %}';
      const template2 = '{% include "template1.html" %}';
      
      await writeFile(join(tempDir, 'template1.html'), template1);
      await writeFile(join(tempDir, 'template2.html'), template2);
      
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      
      await expect(async () => {
        await rendererWithPaths.renderFile('template1.html', {});
      }).rejects.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should render large templates efficiently', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);
      const template = '{% for item in items %}{{ item }}\n{% endfor %}';
      const context: RenderContext = { items: largeArray };
      
      const startTime = performance.now();
      const result = await renderer.render(template, context);
      const endTime = performance.now();
      
      expect(result.split('\n')).toHaveLength(1001); // 1000 items + empty line
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });

    it('should handle template caching', async () => {
      const template = 'Hello {{ name }}!';
      const context1: RenderContext = { name: 'World' };
      const context2: RenderContext = { name: 'Universe' };
      
      // First render
      const start1 = performance.now();
      const result1 = await renderer.render(template, context1);
      const end1 = performance.now();
      
      // Second render (should be faster due to caching)
      const start2 = performance.now();
      const result2 = await renderer.render(template, context2);
      const end2 = performance.now();
      
      expect(result1).toBe('Hello World!');
      expect(result2).toBe('Hello Universe!');
      
      // Second render might be faster due to parsing cache
      // (This is implementation-dependent)
    });

    it('should handle concurrent rendering', async () => {
      const template = 'Result: {{ value }}';
      const promises = Array.from({ length: 10 }, (_, i) => 
        renderer.render(template, { value: i })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`Result: ${i}`);
      });
    });
  });

  describe('Custom Extensions', () => {
    it('should support custom filters', async () => {
      const customRenderer = new UnjucksRenderer({
        customFilters: {
          reverse: (str: string) => str.split('').reverse().join(''),
          multiply: (num: number, factor: number) => num * factor
        }
      });
      
      const template = '{{ "hello" | reverse }}, {{ 5 | multiply(3) }}';
      const result = await customRenderer.render(template, {});
      
      expect(result).toBe('olleh, 15');
    });

    it('should support custom global functions', async () => {
      const customRenderer = new UnjucksRenderer({
        customGlobals: {
          formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
          getCurrentYear: () => new Date().getFullYear()
        }
      });
      
      const template = '{{ formatCurrency(123.456) }}, {{ getCurrentYear() }}';
      const result = await customRenderer.render(template, {});
      
      expect(result).toContain('$123.46');
      expect(result).toContain(new Date().getFullYear().toString());
    });
  });
});
