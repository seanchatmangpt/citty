import { describe, it, expect, beforeEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import {
  TemplateRenderer,
  renderTemplate,
  renderString,
  registerFilter,
  registerFilters,
  createRenderer
} from '../src/renderer'
import { createTemplateContext } from '../src/context'

const TEST_DIR = resolve('./test-render')

describe('Template Renderer', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('TemplateRenderer', () => {
    it('should create renderer with options', () => {
      const renderer = new TemplateRenderer({
        autoescape: true,
        throwOnUndefined: true
      })
      
      expect(renderer).toBeInstanceOf(TemplateRenderer)
    })

    it('should register custom filters', () => {
      const renderer = new TemplateRenderer({
        filters: {
          double: (n: number) => n * 2
        }
      })
      
      const result = renderer.renderString('{{ value | double }}', { value: 21 })
      expect(result).toBe('42')
    })

    it('should register globals', () => {
      const renderer = new TemplateRenderer({
        globals: {
          appName: 'TestApp'
        }
      })
      
      const result = renderer.renderString('{{ appName }}')
      expect(result).toBe('TestApp')
    })
  })

  describe('Built-in Filters', () => {
    const renderer = new TemplateRenderer()

    describe('String case filters', () => {
      it('camelCase', () => {
        expect(renderer.renderString('{{ "hello-world" | camelCase }}')).toBe('helloWorld')
        expect(renderer.renderString('{{ "hello_world" | camelCase }}')).toBe('helloWorld')
        expect(renderer.renderString('{{ "hello world" | camelCase }}')).toBe('helloWorld')
      })

      it('pascalCase', () => {
        expect(renderer.renderString('{{ "hello-world" | pascalCase }}')).toBe('HelloWorld')
        expect(renderer.renderString('{{ "hello_world" | pascalCase }}')).toBe('HelloWorld')
      })

      it('kebabCase', () => {
        expect(renderer.renderString('{{ "HelloWorld" | kebabCase }}')).toBe('hello-world')
        expect(renderer.renderString('{{ "hello_world" | kebabCase }}')).toBe('hello-world')
      })

      it('snakeCase', () => {
        expect(renderer.renderString('{{ "HelloWorld" | snakeCase }}')).toBe('hello_world')
        expect(renderer.renderString('{{ "hello-world" | snakeCase }}')).toBe('hello_world')
      })
    })

    describe('Array filters', () => {
      const context = {
        numbers: [3, 1, 4, 1, 5],
        objects: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]
      }

      it('first/last', () => {
        expect(renderer.renderString('{{ numbers | first }}', context)).toBe('3')
        expect(renderer.renderString('{{ numbers | last }}', context)).toBe('5')
      })

      it('unique', () => {
        expect(renderer.renderString('{{ numbers | unique | join(",") }}', context)).toBe('3,1,4,5')
      })

      it('pluck', () => {
        expect(renderer.renderString('{{ objects | pluck("name") | join(",") }}', context)).toBe('Alice,Bob')
      })
    })

    describe('String filters', () => {
      it('pluralize', () => {
        expect(renderer.renderString('{{ 1 | pluralize("item", "items") }}')).toBe('item')
        expect(renderer.renderString('{{ 2 | pluralize("item", "items") }}')).toBe('items')
        expect(renderer.renderString('{{ 2 | pluralize("item") }}')).toBe('items')
      })

      it('truncate', () => {
        const long = 'This is a very long string that needs truncation'
        expect(renderer.renderString('{{ text | truncate(10) }}', { text: long }))
          .toBe('This is...')
        expect(renderer.renderString('{{ text | truncate(10, "…") }}', { text: long }))
          .toBe('This is a…')
      })

      it('padding', () => {
        expect(renderer.renderString('{{ "hi" | padLeft(5) }}')).toBe('   hi')
        expect(renderer.renderString('{{ "hi" | padRight(5, ".") }}')).toBe('hi...')
      })
    })

    describe('Date filters', () => {
      it('date formatting', () => {
        const date = new Date('2024-01-15T10:30:45')
        const result = renderer.renderString('{{ d | date("YYYY-MM-DD HH:mm:ss") }}', { d: date })
        expect(result).toBe('2024-01-15 10:30:45')
      })

      it('now filter', () => {
        const result = renderer.renderString('{{ now() }}')
        expect(new Date(result)).toBeInstanceOf(Date)
      })
    })

    describe('JSON filters', () => {
      it('json stringify', () => {
        const obj = { foo: 'bar', num: 42 }
        expect(renderer.renderString('{{ obj | json }}', { obj }))
          .toBe('{"foo":"bar","num":42}')
        expect(renderer.renderString('{{ obj | json(2) }}', { obj }))
          .toContain('  "foo"')
      })

      it('fromJson', () => {
        const json = '{"test":true}'
        const result = renderer.renderString('{{ str | fromJson | json }}', { str: json })
        expect(result).toBe(json)
      })
    })

    describe('Logic filters', () => {
      it('default', () => {
        expect(renderer.renderString('{{ missing | default("fallback") }}')).toBe('fallback')
        expect(renderer.renderString('{{ value | default("fallback") }}', { value: 'exists' }))
          .toBe('exists')
      })

      it('ternary', () => {
        expect(renderer.renderString('{{ true | ternary("yes", "no") }}')).toBe('yes')
        expect(renderer.renderString('{{ false | ternary("yes", "no") }}')).toBe('no')
      })
    })
  })

  describe('renderTemplate', () => {
    it('should render file template', async () => {
      const templatePath = `${TEST_DIR}/test.njk`
      writeFileSync(templatePath, 'Hello {{ name }}!')
      
      const result = await renderTemplate(templatePath, { name: 'World' })
      
      expect(result.output).toBe('Hello World!')
      expect(result.metadata.template).toBe(templatePath)
      expect(result.metadata.variables).toContain('name')
      expect(result.metadata.duration).toBeGreaterThan(0)
    })

    it('should use context from unctx', async () => {
      const templatePath = `${TEST_DIR}/context.njk`
      writeFileSync(templatePath, '{{ user.name }} ({{ user.age }})')
      
      createTemplateContext({
        user: { name: 'Alice', age: 30 }
      })
      
      const result = await renderTemplate(templatePath)
      expect(result.output).toBe('Alice (30)')
    })

    it('should extract used filters', async () => {
      const templatePath = `${TEST_DIR}/filters.njk`
      writeFileSync(templatePath, '{{ name | upper | truncate(5) }}')
      
      const result = await renderTemplate(templatePath, { name: 'testing' })
      expect(result.metadata.filters).toContain('upper')
      expect(result.metadata.filters).toContain('truncate')
    })
  })

  describe('renderString', () => {
    it('should render string template', () => {
      const output = renderString('{{ greeting }}, {{ name }}!', {
        greeting: 'Hello',
        name: 'World'
      })
      
      expect(output).toBe('Hello, World!')
    })

    it('should handle complex templates', () => {
      const template = `
        {% for item in items %}
          <li>{{ item.name | upper }}: {{ item.value }}</li>
        {% endfor %}
      `
      
      const output = renderString(template, {
        items: [
          { name: 'foo', value: 1 },
          { name: 'bar', value: 2 }
        ]
      })
      
      expect(output).toContain('<li>FOO: 1</li>')
      expect(output).toContain('<li>BAR: 2</li>')
    })
  })

  describe('Custom filters', () => {
    it('should register single filter', () => {
      registerFilter('reverse', (str: string) => str.split('').reverse().join(''))
      
      const output = renderString('{{ "hello" | reverse }}')
      expect(output).toBe('olleh')
    })

    it('should register multiple filters', () => {
      registerFilters({
        double: (n: number) => n * 2,
        triple: (n: number) => n * 3
      })
      
      expect(renderString('{{ 5 | double }}')).toBe('10')
      expect(renderString('{{ 5 | triple }}')).toBe('15')
    })
  })

  describe('Error handling', () => {
    it('should handle missing template file', async () => {
      await expect(
        renderTemplate('/non/existent/template.njk')
      ).rejects.toThrow('Failed to render template')
    })

    it('should handle template syntax errors', () => {
      const renderer = new TemplateRenderer({ throwOnUndefined: true })
      
      expect(() => 
        renderer.renderString('{% invalid syntax %}')
      ).toThrow()
    })
  })
})