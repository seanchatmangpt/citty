import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'pathe';
import { 
  renderTemplate, 
  renderString, 
  registerFilter,
  registerFilters,
  TemplateRenderer,
  getAvailableFilters
} from '../../src/renderer.js';
import { createTemplateContext } from '../../src/context.js';

const testDir = './test-templates';

describe('Template Renderer', () => {
  beforeEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    
    // Create test directory and templates
    mkdirSync(testDir, { recursive: true });
    
    // Basic template
    writeFileSync(
      join(testDir, 'basic.njk'),
      'Hello {{ name }}!'
    );
    
    // Template with filters
    writeFileSync(
      join(testDir, 'filters.njk'),
      'Name: {{ name | pascalCase }}\\nSlug: {{ name | kebabCase }}'
    );
    
    // Template with loops
    writeFileSync(
      join(testDir, 'loop.njk'),
      '{% for item in items %}{{ item | upper }}{% if not loop.last %}, {% endif %}{% endfor %}'
    );
  });

  describe('renderString', () => {
    it('should render simple template string', async () => {
      createTemplateContext({ name: 'World' });
      const result = await renderString('Hello {{ name }}!');
      expect(result.output).toBe('Hello World!');
    });

    it('should render with provided context', async () => {
      const result = await renderString('Hi {{ name }}!', { name: 'Alice' });
      expect(result.output).toBe('Hi Alice!');
    });

    it('should include metadata', async () => {
      const result = await renderString('Test', {});
      expect(result.metadata.template).toBe('<string>');
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(typeof result.metadata.duration).toBe('number');
    });
  });

  describe('renderTemplate', () => {
    it('should render template from file', async () => {
      createTemplateContext({ name: 'John' });
      const templatePath = join(testDir, 'basic.njk');
      const result = await renderTemplate(templatePath);
      expect(result.output).toBe('Hello John!');
    });

    it('should render with filters', async () => {
      createTemplateContext({ name: 'hello world' });
      const templatePath = join(testDir, 'filters.njk');
      const result = await renderTemplate(templatePath);
      expect(result.output).toContain('Name: HelloWorld');
      expect(result.output).toContain('Slug: hello-world');
    });

    it('should render loops correctly', async () => {
      createTemplateContext({ items: ['apple', 'banana', 'cherry'] });
      const templatePath = join(testDir, 'loop.njk');
      const result = await renderTemplate(templatePath);
      expect(result.output).toBe('APPLE, BANANA, CHERRY');
    });
  });

  describe('built-in filters', () => {
    it('should have camelCase filter', async () => {
      const result = await renderString('{{ \"hello world\" | camelCase }}');
      expect(result.output).toBe('helloWorld');
    });

    it('should have kebabCase filter', async () => {
      const result = await renderString('{{ \"HelloWorld\" | kebabCase }}');
      expect(result.output).toBe('hello-world');
    });

    it('should have pascalCase filter', async () => {
      const result = await renderString('{{ \"hello world\" | pascalCase }}');
      expect(result.output).toBe('HelloWorld');
    });

    it('should have snakeCase filter', async () => {
      const result = await renderString('{{ \"HelloWorld\" | snakeCase }}');
      expect(result.output).toBe('hello_world');
    });

    it('should have pluralize filter', async () => {
      const result1 = await renderString('{{ \"cat\" | pluralize }}');
      expect(result1.output).toBe('cats');
      
      const result2 = await renderString('{{ \"cat\" | pluralize(1) }}');
      expect(result2.output).toBe('cat');
    });

    it('should have singularize filter', async () => {
      const result = await renderString('{{ \"cats\" | singularize }}');
      expect(result.output).toBe('cat');
    });

    it('should have timestamp filter', async () => {
      const result = await renderString('{{ \"\" | timestamp }}');
      expect(result.output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should have uuid filter', async () => {
      const result = await renderString('{{ \"\" | uuid }}');
      expect(result.output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should have stringify filter', async () => {
      const result = await renderString('{{ obj | stringify }}', { obj: { a: 1 } });
      expect(result.output).toContain('a');
      expect(result.output).toContain('1');
    });
  });

  describe('custom filters', () => {
    it('should register single filter', async () => {
      registerFilter('reverse', (str: string) => str.split('').reverse().join(''));
      const result = await renderString('{{ \"hello\" | reverse }}');
      expect(result.output).toBe('olleh');
    });

    it('should register multiple filters', async () => {
      registerFilters({
        double: (n: number) => n * 2,
        shout: (str: string) => str.toUpperCase() + '!'
      });
      
      const result = await renderString('{{ num | double }} {{ text | shout }}', {
        num: 5,
        text: 'hello'
      });
      expect(result.output).toBe('10 HELLO!');
    });
  });

  describe('TemplateRenderer class', () => {
    it('should create renderer with options', () => {
      const renderer = new TemplateRenderer({
        autoescape: false,
        throwOnUndefined: false
      });
      expect(renderer).toBeInstanceOf(TemplateRenderer);
    });

    it('should render with custom renderer', async () => {
      const renderer = new TemplateRenderer();
      const result = await renderer.renderString('{{ name }}', { name: 'Test' });
      expect(result.output).toBe('Test');
    });
  });

  describe('getAvailableFilters', () => {
    it('should return built-in filters', () => {
      const filters = getAvailableFilters();
      expect(filters).toHaveProperty('camelCase');
      expect(filters).toHaveProperty('kebabCase');
      expect(filters).toHaveProperty('pascalCase');
      expect(filters).toHaveProperty('pluralize');
    });
  });
});