import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import {
  createTemplateContext,
  renderTemplate,
  loadOntologyContext,
  expandContext,
  listGenerators,
  resolveTemplate
} from '../src'

const TEST_DIR = resolve('./test-integration')
const TEMPLATES_DIR = `${TEST_DIR}/templates`
const OUTPUT_DIR = `${TEST_DIR}/output`

describe('Unjucks Integration Tests', () => {
  beforeEach(() => {
    // Setup test directories
    mkdirSync(TEMPLATES_DIR, { recursive: true })
    mkdirSync(OUTPUT_DIR, { recursive: true })
    
    // Create test templates
    setupTestTemplates()
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  function setupTestTemplates() {
    // Command generator
    mkdirSync(`${TEMPLATES_DIR}/command/new`, { recursive: true })
    writeFileSync(
      `${TEMPLATES_DIR}/command/new/command.njk`,
      `---
to: {{ outputDir }}/commands/{{ name | kebabCase }}.ts
---
import { defineCommand } from 'citty'

export const {{ name | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ name | kebabCase }}',
    description: '{{ description }}'
  },
  args: {
    {% for arg in args %}
    {{ arg.name }}: {
      type: '{{ arg.type }}',
      required: {{ arg.required | default(false) }}
    }{% if not loop.last %},{% endif %}
    {% endfor %}
  },
  async run({ args }) {
    console.log('Running {{ name }}', args)
    {% if hooks %}
    // Hooks
    {% for hook in hooks %}
    await {{ hook }}(args)
    {% endfor %}
    {% endif %}
  }
})`
    )

    // Component generator
    mkdirSync(`${TEMPLATES_DIR}/component/new`, { recursive: true })
    writeFileSync(
      `${TEMPLATES_DIR}/component/new/component.njk`,
      `---
to: {{ outputDir }}/components/{{ name | pascalCase }}.tsx
---
import React from 'react'

interface {{ name | pascalCase }}Props {
  {% for prop in props %}
  {{ prop.name }}: {{ prop.type }}
  {% endfor %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  {{ props | pluck("name") | join(", ") }}
}) => {
  return (
    <div className="{{ name | kebabCase }}">
      <h2>{{ name | title }}</h2>
      {% for prop in props %}
      <p>{{ prop.name }}: {% raw %}{{% endraw %}{{ prop.name }}{% raw %}}{% endraw %}</p>
      {% endfor %}
    </div>
  )
}`
    )

    // Workflow generator
    mkdirSync(`${TEMPLATES_DIR}/workflow/new`, { recursive: true })
    writeFileSync(
      `${TEMPLATES_DIR}/workflow/new/workflow.njk`,
      `---
to: {{ outputDir }}/workflows/{{ id }}.yaml
---
name: {{ name }}
id: {{ id }}
version: {{ version | default("1.0.0") }}

steps:
{% for step in steps %}
  - id: {{ step.id }}
    type: {{ step.type }}
    {% if step.uses %}uses: {{ step.uses }}{% endif %}
    {% if step.inputs %}
    inputs:
      {% for input in step.inputs %}
      {{ input.key }}: {{ input.value }}
      {% endfor %}
    {% endif %}
{% endfor %}

{% if triggers %}
triggers:
{% for trigger in triggers %}
  - event: {{ trigger.event }}
    {% if trigger.schedule %}schedule: {{ trigger.schedule }}{% endif %}
{% endfor %}
{% endif %}`
    )

    // Test ontology
    writeFileSync(
      `${TEST_DIR}/test-ontology.json`,
      JSON.stringify({
        entities: [
          {
            id: 'deploy-cmd',
            type: 'Command',
            properties: {
              name: 'deploy',
              description: 'Deploy application',
              category: 'deployment'
            },
            relations: {
              uses: ['DeployService'],
              triggers: ['DeployWorkflow']
            }
          },
          {
            id: 'user-comp',
            type: 'Component',
            properties: {
              name: 'UserProfile',
              description: 'User profile component'
            },
            relations: {}
          },
          {
            id: 'ci-workflow',
            type: 'Workflow',
            properties: {
              name: 'CI Pipeline',
              id: 'ci-pipeline'
            },
            relations: {
              steps: ['lint', 'test', 'build']
            }
          }
        ],
        namespaces: {
          citty: 'https://citty.pro/ontology#'
        },
        version: '1.0.0'
      })
    )
  }

  describe('End-to-End Template Rendering', () => {
    it('should render command template with context', async () => {
      createTemplateContext({
        name: 'Deploy',
        description: 'Deploy application to environment',
        outputDir: OUTPUT_DIR,
        args: [
          { name: 'env', type: 'string', required: true },
          { name: 'version', type: 'string', required: false }
        ],
        hooks: ['beforeDeploy', 'afterDeploy']
      })

      const template = await resolveTemplate('command', 'new', [TEMPLATES_DIR])
      const result = await renderTemplate(template.path)

      expect(result.output).toContain('deployCommand')
      expect(result.output).toContain('deploy application to environment')
      expect(result.output).toContain('env: {')
      expect(result.output).toContain('beforeDeploy(args)')
      expect(result.metadata.variables).toContain('name')
      expect(result.metadata.variables).toContain('description')
    })

    it('should render component template', async () => {
      createTemplateContext({
        name: 'UserCard',
        outputDir: OUTPUT_DIR,
        props: [
          { name: 'userId', type: 'string' },
          { name: 'userName', type: 'string' },
          { name: 'avatar', type: 'string' }
        ]
      })

      const template = await resolveTemplate('component', 'new', [TEMPLATES_DIR])
      const result = await renderTemplate(template.path)

      expect(result.output).toContain('interface UserCardProps')
      expect(result.output).toContain('userId: string')
      expect(result.output).toContain('userName: string')
      expect(result.output).toContain('avatar: string')
      expect(result.output).toContain('className="user-card"')
    })

    it('should render workflow template', async () => {
      createTemplateContext({
        name: 'Build and Deploy',
        id: 'build-deploy',
        version: '2.0.0',
        outputDir: OUTPUT_DIR,
        steps: [
          { id: 'build', type: 'task', uses: 'build-task' },
          { id: 'test', type: 'task', uses: 'test-task' },
          { id: 'deploy', type: 'task', uses: 'deploy-task' }
        ],
        triggers: [
          { event: 'push', schedule: null },
          { event: 'schedule', schedule: '0 0 * * *' }
        ]
      })

      const template = await resolveTemplate('workflow', 'new', [TEMPLATES_DIR])
      const result = await renderTemplate(template.path)

      expect(result.output).toContain('name: Build and Deploy')
      expect(result.output).toContain('id: build-deploy')
      expect(result.output).toContain('version: 2.0.0')
      expect(result.output).toContain('- id: build')
      expect(result.output).toContain('uses: build-task')
      expect(result.output).toContain('event: push')
      expect(result.output).toContain('schedule: 0 0 * * *')
    })
  })

  describe('Ontology Integration', () => {
    it('should load ontology and expand to context', async () => {
      const ontologyContext = await loadOntologyContext(`${TEST_DIR}/test-ontology.json`)
      
      expect(ontologyContext.entities).toHaveLength(3)
      expect(ontologyContext.namespaces.citty).toBeDefined()

      const expanded = expandContext(ontologyContext.entities)
      
      expect(expanded.commands).toBeDefined()
      expect(expanded.commands).toHaveLength(1)
      expect(expanded.commands[0].name).toBe('deploy')
      
      expect(expanded.components).toBeDefined()
      expect(expanded.workflows).toBeDefined()
    })

    it('should render template with ontology data', async () => {
      const ontologyContext = await loadOntologyContext(`${TEST_DIR}/test-ontology.json`)
      const expanded = expandContext(ontologyContext.entities)
      
      // Add output directory
      expanded.outputDir = OUTPUT_DIR
      expanded.name = expanded.commands[0].name
      expanded.description = expanded.commands[0].description
      expanded.args = []
      
      createTemplateContext(expanded)

      const template = await resolveTemplate('command', 'new', [TEMPLATES_DIR])
      const result = await renderTemplate(template.path)

      expect(result.output).toContain('deployCommand')
      expect(result.output).toContain('Deploy application')
    })
  })

  describe('Multiple Template Rendering', () => {
    it('should render multiple templates in sequence', async () => {
      const generators = await listGenerators([TEMPLATES_DIR])
      expect(generators).toContain('command')
      expect(generators).toContain('component')
      expect(generators).toContain('workflow')

      const results = []

      // Render command
      createTemplateContext({
        name: 'Test',
        description: 'Test command',
        outputDir: OUTPUT_DIR,
        args: []
      })
      
      let template = await resolveTemplate('command', 'new', [TEMPLATES_DIR])
      results.push(await renderTemplate(template.path))

      // Render component
      createTemplateContext({
        name: 'TestComponent',
        outputDir: OUTPUT_DIR,
        props: [{ name: 'test', type: 'boolean' }]
      })
      
      template = await resolveTemplate('component', 'new', [TEMPLATES_DIR])
      results.push(await renderTemplate(template.path))

      expect(results).toHaveLength(2)
      expect(results[0].output).toContain('testCommand')
      expect(results[1].output).toContain('TestComponent')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing generator gracefully', async () => {
      await expect(
        resolveTemplate('missing', 'generator', [TEMPLATES_DIR])
      ).rejects.toThrow('not found')
    })

    it('should handle invalid ontology', async () => {
      writeFileSync(`${TEST_DIR}/invalid.json`, '{"invalid": "ontology"}')
      
      // This should work but entities will be empty
      const context = await loadOntologyContext(`${TEST_DIR}/invalid.json`)
      expect(context.entities).toBeUndefined()
    })

    it('should handle template rendering errors', async () => {
      // Create template with syntax error
      mkdirSync(`${TEMPLATES_DIR}/broken/test`, { recursive: true })
      writeFileSync(
        `${TEMPLATES_DIR}/broken/test/template.njk`,
        '{% invalid syntax %}'
      )

      const template = await resolveTemplate('broken', 'test', [TEMPLATES_DIR])
      
      // Nunjucks should throw on invalid syntax
      await expect(
        renderTemplate(template.path)
      ).rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should render templates quickly', async () => {
      createTemplateContext({
        name: 'Performance',
        description: 'Performance test',
        outputDir: OUTPUT_DIR,
        args: Array.from({ length: 10 }, (_, i) => ({
          name: `arg${i}`,
          type: 'string',
          required: i % 2 === 0
        }))
      })

      const template = await resolveTemplate('command', 'new', [TEMPLATES_DIR])
      
      const startTime = performance.now()
      const result = await renderTemplate(template.path)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100) // Should render in under 100ms
      expect(result.metadata.duration).toBeLessThan(100)
      expect(result.output).toContain('arg9')
    })

    it('should handle large contexts efficiently', async () => {
      const largeContext = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random()
        })),
        outputDir: OUTPUT_DIR
      }

      createTemplateContext(largeContext)

      // Create template that uses the large context
      mkdirSync(`${TEMPLATES_DIR}/perf/test`, { recursive: true })
      writeFileSync(
        `${TEMPLATES_DIR}/perf/test/template.njk`,
        `{% for item in items | first(10) %}
{{ item.id }}: {{ item.name }}
{% endfor %}`
      )

      const template = await resolveTemplate('perf', 'test', [TEMPLATES_DIR])
      const result = await renderTemplate(template.path)

      expect(result.output).toContain('Item 0')
      expect(result.output).toContain('Item 9')
      expect(result.output).not.toContain('Item 10')
    })
  })
})