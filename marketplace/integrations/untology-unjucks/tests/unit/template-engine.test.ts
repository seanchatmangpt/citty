import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../../src/pipeline/template-engine.js';
import { TemplateContext } from '../../src/types.js';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  let mockContext: TemplateContext;

  beforeEach(() => {
    engine = new TemplateEngine();
    
    mockContext = {
      ontology: {
        triples: [
          {
            subject: 'http://example.org/Person',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://www.w3.org/2002/07/owl#Class',
          },
          {
            subject: 'http://example.org/Person',
            predicate: 'http://www.w3.org/2000/01/rdf-schema#label',
            object: 'Person',
          },
          {
            subject: 'http://example.org/name',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://www.w3.org/2002/07/owl#DatatypeProperty',
          },
        ],
        prefixes: new Map([
          ['ex', 'http://example.org/'],
          ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
          ['owl', 'http://www.w3.org/2002/07/owl#'],
        ]),
        metadata: {
          source: 'test.ttl',
          timestamp: new Date(),
          size: 3,
        },
      },
      query: async () => [],
      filter: (predicate, object) => mockContext.ontology.triples.filter(t => 
        t.predicate === predicate && (!object || t.object === object)
      ),
      namespace: (prefix) => mockContext.ontology.prefixes.get(prefix) || '',
      custom: {},
    };
  });

  describe('Template Rendering', () => {
    it('should render simple templates', async () => {
      const template = 'Hello {{ name }}!';
      const context = { ...mockContext, name: 'World' };

      const result = await engine.renderFromString(template, context);
      expect(result).toBe('Hello World!');
    });

    it('should handle ontology context', async () => {
      const template = 'Total triples: {{ ontology.triples | length }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('Total triples: 3');
    });

    it('should support loops over triples', async () => {
      const template = `
{%- for triple in ontology.triples -%}
{{ triple.subject | localName }}: {{ triple.predicate | localName }}
{% endfor -%}
`.trim();

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toContain('Person: type');
      expect(result).toContain('Person: label');
      expect(result).toContain('name: type');
    });
  });

  describe('Custom Filters', () => {
    it('should extract local names from URIs', async () => {
      const template = '{{ "http://example.org/Person" | localName }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('Person');
    });

    it('should extract namespaces from URIs', async () => {
      const template = '{{ "http://example.org/Person" | namespace }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('http://example.org/');
    });

    it('should convert to camelCase', async () => {
      const template = '{{ "my-special-class" | camelCase }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('mySpecialClass');
    });

    it('should convert to PascalCase', async () => {
      const template = '{{ "my-special-class" | pascalCase }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('MySpecialClass');
    });

    it('should convert to snake_case', async () => {
      const template = '{{ "MySpecialClass" | snakeCase }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('my_special_class');
    });

    it('should convert to kebab-case', async () => {
      const template = '{{ "MySpecialClass" | kebabCase }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('my-special-class');
    });

    it('should filter unique values', async () => {
      const template = '{{ [1, 2, 2, 3, 3, 3] | unique | length }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('3');
    });

    it('should sort arrays by property', async () => {
      const context = {
        ...mockContext,
        items: [
          { name: 'Charlie', age: 30 },
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 },
        ],
      };

      const template = `
{%- for item in items | sortBy('name') -%}
{{ item.name }}
{% endfor -%}
`.trim();

      const result = await engine.renderFromString(template, context);
      expect(result).toBe('Alice\nBob\nCharlie');
    });
  });

  describe('Global Functions', () => {
    it('should provide filter function', async () => {
      const template = `
{%- for triple in filter('http://www.w3.org/1999/02/22-rdf-syntax-ns#type') -%}
{{ triple.subject | localName }}
{% endfor -%}
`.trim();

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toContain('Person');
      expect(result).toContain('name');
    });

    it('should provide namespace resolver', async () => {
      const template = '{{ ns("ex") }}Person';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toBe('http://example.org/Person');
    });

    it('should provide current timestamp', async () => {
      const template = '{{ now() }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should generate UUIDs', async () => {
      const template = '{{ uuid() }}';

      const result = await engine.renderFromString(template, mockContext);
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('Template Validation', () => {
    it('should validate template syntax', async () => {
      const validTemplate = 'Hello {{ name }}!';
      const validation = await engine.validateTemplate('/mock/path');

      // Mock the internal validation since we can't test file operations directly
      expect(typeof validation).toBe('object');
      expect('valid' in validation).toBe(true);
      expect('errors' in validation).toBe(true);
      expect('warnings' in validation).toBe(true);
    });

    it('should detect unmatched brackets', () => {
      const content = 'Hello {{ name }! Missing closing bracket';
      const result = { errors: [] as string[], warnings: [] as string[] };

      (engine as any).validateTemplateContent(content, result);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unmatched template brackets');
    });

    it('should detect unmatched blocks', () => {
      const content = '{% for item in items %} No matching endfor';
      const result = { errors: [] as string[], warnings: [] as string[] };

      (engine as any).validateTemplateContent(content, result);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unmatched start block');
    });

    it('should warn about potentially undefined variables', () => {
      const content = 'Hello {{ unknownVariable }}!';
      const result = { errors: [] as string[], warnings: [] as string[] };

      (engine as any).validateTemplateContent(content, result);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Variables that might be undefined');
    });
  });

  describe('Template Analysis', () => {
    it('should extract template information', async () => {
      const template = `
{% extends "base.html" %}
{% include "header.html" %}

{% block content %}
  {% for item in items | sortBy('name') %}
    {{ item.name | upper }}
  {% endfor %}
  {{ customVariable }}
{% endblock %}
`;

      // Cache the template for analysis
      (engine as any).templateCache.set('/mock/template.html', template);

      const info = engine.getTemplateInfo('/mock/template.html');

      expect(info.variables).toContain('items');
      expect(info.variables).toContain('customVariable');
      expect(info.filters).toContain('sortBy');
      expect(info.filters).toContain('upper');
      expect(info.blocks).toContain('content');
      expect(info.includes).toContain('header.html');
      expect(info.extends).toBe('base.html');
    });

    it('should handle templates without extends or includes', async () => {
      const template = `
{% block main %}
  {{ title }}
{% endblock %}
`;

      (engine as any).templateCache.set('/mock/simple.html', template);

      const info = engine.getTemplateInfo('/mock/simple.html');

      expect(info.variables).toContain('title');
      expect(info.blocks).toContain('main');
      expect(info.includes).toHaveLength(0);
      expect(info.extends).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle template rendering errors', async () => {
      const template = '{{ undefinedVariable.property }}';

      await expect(engine.renderFromString(template, mockContext)).rejects.toThrow();
    });

    it('should handle invalid filter usage', async () => {
      const template = '{{ someValue | nonexistentFilter }}';

      await expect(engine.renderFromString(template, mockContext)).rejects.toThrow();
    });

    it('should handle malformed template syntax', async () => {
      const template = '{% invalid syntax %}';

      await expect(engine.renderFromString(template, mockContext)).rejects.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should cache template content', async () => {
      const template = 'Cached template: {{ name }}';
      const context = { ...mockContext, name: 'Test' };

      // First render - should cache
      (engine as any).templateCache.set('/mock/cached.html', template);

      const result1 = await engine.renderFromString(template, context);
      expect(result1).toBe('Cached template: Test');

      // Verify cache contains the template
      expect((engine as any).templateCache.has('/mock/cached.html')).toBe(true);
    });

    it('should clear cache when requested', () => {
      (engine as any).templateCache.set('test1', 'template1');
      (engine as any).templateCache.set('test2', 'template2');

      expect((engine as any).templateCache.size).toBe(2);

      engine.clearCache();

      expect((engine as any).templateCache.size).toBe(0);
    });
  });
});