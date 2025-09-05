import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import {
  walkTemplates,
  resolveTemplate,
  listGenerators,
  listActions,
  getGeneratorInfo,
  parseTemplateMetadata,
  findTemplates,
  templateExists,
  getTemplateContent,
  extractTemplateVariables
} from '../src/walker'
import { TemplateNotFoundError } from '../src/types'

const TEST_DIR = resolve('./test-templates')

describe('Template Walker', () => {
  beforeEach(() => {
    // Create test template structure
    mkdirSync(TEST_DIR, { recursive: true })
    
    // Create component generator
    mkdirSync(`${TEST_DIR}/component/new`, { recursive: true })
    writeFileSync(
      `${TEST_DIR}/component/new/index.njk`,
      `---
to: src/components/{{ name }}.tsx
---
export const {{ name }} = () => <div>{{ name }}</div>`
    )
    
    mkdirSync(`${TEST_DIR}/component/test`, { recursive: true })
    writeFileSync(
      `${TEST_DIR}/component/test/test.njk`,
      `import { {{ name }} } from './{{ name }}'`
    )
    
    // Create service generator
    mkdirSync(`${TEST_DIR}/service/crud`, { recursive: true })
    writeFileSync(
      `${TEST_DIR}/service/crud/service.njk`,
      `class {{ name }}Service {}`
    )
    
    // Create generator metadata
    writeFileSync(
      `${TEST_DIR}/component/generator.json`,
      JSON.stringify({
        name: 'React Component Generator',
        description: 'Generates React components',
        author: 'Test'
      })
    )
  })

  afterEach(() => {
    // Clean up test templates
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('walkTemplates', () => {
    it('should find all templates', async () => {
      const templates = await walkTemplates(TEST_DIR)
      
      expect(templates).toHaveLength(3)
      expect(templates.map(t => `${t.generator}/${t.action}`)).toContain('component/new')
      expect(templates.map(t => `${t.generator}/${t.action}`)).toContain('component/test')
      expect(templates.map(t => `${t.generator}/${t.action}`)).toContain('service/crud')
    })

    it('should parse metadata', async () => {
      const templates = await walkTemplates(TEST_DIR)
      const componentNew = templates.find(t => t.generator === 'component' && t.action === 'new')
      
      expect(componentNew?.metadata).toBeDefined()
      expect(componentNew?.metadata?.to).toBe('src/components/{{ name }}.tsx')
    })

    it('should handle empty directory', async () => {
      const emptyDir = `${TEST_DIR}/empty`
      mkdirSync(emptyDir)
      
      const templates = await walkTemplates(emptyDir)
      expect(templates).toHaveLength(0)
    })
  })

  describe('resolveTemplate', () => {
    it('should resolve existing template', async () => {
      const template = await resolveTemplate('component', 'new', [TEST_DIR])
      
      expect(template.generator).toBe('component')
      expect(template.action).toBe('new')
      expect(template.path).toContain('index.njk')
    })

    it('should throw for non-existent template', async () => {
      await expect(
        resolveTemplate('missing', 'action', [TEST_DIR])
      ).rejects.toThrow(TemplateNotFoundError)
    })

    it('should check multiple paths', async () => {
      const altDir = `${TEST_DIR}-alt`
      mkdirSync(`${altDir}/alt/action`, { recursive: true })
      writeFileSync(`${altDir}/alt/action/template.njk`, 'alt template')
      
      try {
        const template = await resolveTemplate('alt', 'action', [TEST_DIR, altDir])
        expect(template.path).toContain(altDir)
      } finally {
        rmSync(altDir, { recursive: true, force: true })
      }
    })
  })

  describe('listGenerators', () => {
    it('should list all generators', async () => {
      const generators = await listGenerators([TEST_DIR])
      
      expect(generators).toEqual(['component', 'service'])
    })

    it('should handle non-existent path', async () => {
      const generators = await listGenerators(['/non/existent'])
      expect(generators).toEqual([])
    })
  })

  describe('listActions', () => {
    it('should list actions for generator', async () => {
      const actions = await listActions('component', [TEST_DIR])
      
      expect(actions).toEqual(['new', 'test'])
    })

    it('should return empty for unknown generator', async () => {
      const actions = await listActions('unknown', [TEST_DIR])
      expect(actions).toEqual([])
    })
  })

  describe('getGeneratorInfo', () => {
    it('should get generator info with metadata', async () => {
      const info = await getGeneratorInfo('component', [TEST_DIR])
      
      expect(info).not.toBeNull()
      expect(info?.name).toBe('component')
      expect(info?.actions).toEqual(['new', 'test'])
      expect(info?.templates).toBe(2)
      expect(info?.metadata.name).toBe('React Component Generator')
    })

    it('should return null for unknown generator', async () => {
      const info = await getGeneratorInfo('unknown', [TEST_DIR])
      expect(info).toBeNull()
    })
  })

  describe('parseTemplateMetadata', () => {
    it('should parse YAML frontmatter', async () => {
      const metadata = await parseTemplateMetadata(`${TEST_DIR}/component/new/index.njk`)
      
      expect(metadata).toBeDefined()
      expect(metadata?.to).toBe('src/components/{{ name }}.tsx')
    })

    it('should parse JS frontmatter', async () => {
      const testFile = `${TEST_DIR}/test.njk`
      writeFileSync(testFile, `//---
to: output.js
inject: true
//---
content`)
      
      const metadata = await parseTemplateMetadata(testFile)
      expect(metadata?.to).toBe('output.js')
      expect(metadata?.inject).toBe(true)
    })

    it('should return undefined for no frontmatter', async () => {
      const testFile = `${TEST_DIR}/plain.njk`
      writeFileSync(testFile, 'plain template')
      
      const metadata = await parseTemplateMetadata(testFile)
      expect(metadata).toBeUndefined()
    })
  })

  describe('findTemplates', () => {
    it('should find templates by pattern', async () => {
      const templates = await findTemplates('component/*', [TEST_DIR])
      
      expect(templates).toHaveLength(2)
      expect(templates.every(t => t.generator === 'component')).toBe(true)
    })

    it('should support wildcards', async () => {
      const templates = await findTemplates('*/new', [TEST_DIR])
      
      expect(templates).toHaveLength(1)
      expect(templates[0].action).toBe('new')
    })
  })

  describe('templateExists', () => {
    it('should return true for existing template', async () => {
      const exists = await templateExists('component', 'new', [TEST_DIR])
      expect(exists).toBe(true)
    })

    it('should return false for non-existent template', async () => {
      const exists = await templateExists('missing', 'template', [TEST_DIR])
      expect(exists).toBe(false)
    })
  })

  describe('getTemplateContent', () => {
    it('should get template content', async () => {
      const content = await getTemplateContent('component', 'test', [TEST_DIR])
      expect(content).toContain("import { {{ name }} from './{{ name }}'")
    })

    it('should throw for missing template', async () => {
      await expect(
        getTemplateContent('missing', 'template', [TEST_DIR])
      ).rejects.toThrow()
    })
  })

  describe('extractTemplateVariables', () => {
    it('should extract Nunjucks variables', () => {
      const content = `
        Hello {{ name }}!
        {% for item in items %}
          {{ item.value | upper }}
        {% endfor %}
        {% if flag %}{{ message }}{% endif %}
      `
      
      const variables = extractTemplateVariables(content)
      expect(variables).toContain('name')
      expect(variables).toContain('item')
      expect(variables).toContain('items')
      expect(variables).toContain('flag')
      expect(variables).toContain('message')
    })

    it('should handle no variables', () => {
      const variables = extractTemplateVariables('Plain text')
      expect(variables).toEqual([])
    })
  })
})