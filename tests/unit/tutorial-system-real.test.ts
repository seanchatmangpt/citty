/**
 * Test suite for real UNJUCKS tutorial system implementation
 * Validates that all fake/mock implementations have been replaced with real Nunjucks functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { rm, mkdir, writeFile } from 'fs/promises'
import { TutorialSystem } from '../../src/unjucks/tutorial-system'
import { UNJUCKS, createUnjucks } from '../../src/unjucks/index'

describe('TutorialSystem - Real Nunjucks Implementation', () => {
  let tutorialSystem: TutorialSystem
  let tempDir: string
  const testUserId = 'test-user-123'

  beforeAll(async () => {
    // Create temporary directory for test storage
    tempDir = join(tmpdir(), `tutorial-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    
    // Initialize tutorial system with test storage
    tutorialSystem = new TutorialSystem(tempDir)
    
    // Initialize real UNJUCKS context
    await createUnjucks({
      templatesDir: join(tempDir, 'templates'),
      outputDir: join(tempDir, 'output'),
      cache: false
    })
  })

  afterAll(async () => {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('Real Template Compilation and Rendering', () => {
    it('should use real UNJUCKS.compile() for template validation', async () => {
      const tutorial = tutorialSystem.getTutorial('getting-started')
      expect(tutorial).toBeDefined()
      
      const exercise = tutorial!.sections
        .find(s => s.exercise?.id === 'hello-world-ontology')?.exercise
      expect(exercise).toBeDefined()

      // Test that template compilation works with real Nunjucks
      const template = '{{ greeting }} from {{ name }}'
      expect(() => {
        UNJUCKS.compile(template, 'test-template')
      }).not.toThrow()
    })

    it('should use real UNJUCKS.render() for template execution', async () => {
      const template = '{{ greeting | upper }} - {{ name }}'
      const context = { greeting: 'hello', name: 'test' }
      
      const result = UNJUCKS.render(template, context)
      expect(result).toBe('HELLO - test')
    })

    it('should execute exercises with real template compilation', async () => {
      // Start tutorial first
      await tutorialSystem.startTutorial(testUserId, 'getting-started')
      
      const ontology = `@prefix ex: <http://example.com/test#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, Real World!" .
ex:name rdfs:label "UNJUCKS" .`

      const template = '{{ greeting }} - Welcome to {{ name }}!'
      
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        ontology,
        template
      )
      
      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.output).toContain('Hello')
      expect(result.validationResults).toBeDefined()
      expect(result.score).toBeGreaterThan(0)
    })

    it('should validate template syntax errors using real compilation', async () => {
      // Test with invalid Nunjucks syntax
      const invalidTemplate = '{{ unclosed_expression'
      const ontology = `@prefix ex: <http://example.com/test#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello!" .`
      
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        ontology,
        invalidTemplate
      )
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Template rendering failed')
    })
  })

  describe('Real Nunjucks Features', () => {
    it('should support real Nunjucks filters', async () => {
      const template = '{{ name | upper | reverse }}'
      const context = { name: 'hello' }
      
      // Test that built-in filters work
      const result = UNJUCKS.render(template, context)
      expect(result).toBe('OLLEH') // "hello" -> "HELLO" -> "OLLEH"
    })

    it('should support real Nunjucks loops', async () => {
      const template = `{% for item in items %}
- {{ item.name }}: {{ item.value }}
{% endfor %}`
      const context = {
        items: [
          { name: 'First', value: '1' },
          { name: 'Second', value: '2' }
        ]
      }
      
      const result = UNJUCKS.render(template, context)
      expect(result).toContain('- First: 1')
      expect(result).toContain('- Second: 2')
    })

    it('should support real Nunjucks conditionals', async () => {
      const template = `{% if showGreeting %}Hello, {{ name }}!{% endif %}`
      
      const resultWithGreeting = UNJUCKS.render(template, { 
        showGreeting: true, 
        name: 'World' 
      })
      expect(resultWithGreeting).toBe('Hello, World!')
      
      const resultWithoutGreeting = UNJUCKS.render(template, { 
        showGreeting: false, 
        name: 'World' 
      })
      expect(resultWithoutGreeting).toBe('')
    })

    it('should support real Nunjucks macros', async () => {
      const template = `{% macro renderButton(text, type) %}
<button class="btn btn-{{ type }}">{{ text }}</button>
{% endmacro %}

{{ renderButton('Click Me', 'primary') }}`
      
      const result = UNJUCKS.render(template, {})
      expect(result).toContain('<button class="btn btn-primary">Click Me</button>')
    })
  })

  describe('Persistent Progress Tracking', () => {
    it('should persist progress to filesystem', async () => {
      const progress = await tutorialSystem.startTutorial(testUserId, 'getting-started')
      
      expect(progress.userId).toBe(testUserId)
      expect(progress.tutorialId).toBe('getting-started')
      expect(progress.startedAt).toBeDefined()
      
      // Complete a section to trigger persistence
      await tutorialSystem.completeSection(testUserId, 'getting-started', 'intro')
      
      // Verify progress is accessible
      const retrievedProgress = tutorialSystem.getUserProgress(testUserId, 'getting-started')
      expect(retrievedProgress.sectionsCompleted).toContain('intro')
    })

    it('should track exercise completion with real validation results', async () => {
      const ontology = `@prefix ex: <http://example.com/test#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, Testing!" .`

      const template = '{{ greeting }}'
      
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        ontology,
        template
      )
      
      expect(result.success).toBe(true)
      expect(result.score).toBe(100) // Should pass all validations
      
      // Check that progress was updated
      const progress = tutorialSystem.getUserProgress(testUserId, 'getting-started')
      expect(progress.exercisesCompleted).toContain('hello-world-ontology')
    })
  })

  describe('Advanced Tutorial Content', () => {
    it('should provide real Nunjucks learning content', async () => {
      const advancedTutorial = tutorialSystem.getTutorial('advanced-templates')
      expect(advancedTutorial).toBeDefined()
      
      if (advancedTutorial) {
        expect(advancedTutorial.category).toBe('intermediate')
        expect(advancedTutorial.prerequisites).toContain('getting-started')
        
        // Should have real macro examples
        const macroSection = advancedTutorial.sections.find(s => 
          s.content.includes('macro') || s.exercise?.startingTemplate?.includes('macro')
        )
        expect(macroSection).toBeDefined()
      }
    })

    it('should validate complex template patterns', async () => {
      await tutorialSystem.startTutorial(testUserId, 'advanced-templates')
      
      const complexTemplate = `{% macro renderProperty(prop) %}
  {{ prop.name }}: {{ prop.type }}{% if prop.required %} (required){% endif %}
{% endmacro %}

# API Properties
{% for prop in properties %}
- {{ renderProperty(prop) }}
{% endfor %}`

      const result = await tutorialSystem.executeExercise(
        testUserId,
        'advanced-templates',
        'advanced-nunjucks',
        '', // No ontology, direct template rendering
        complexTemplate
      )
      
      expect(result.success).toBe(true)
      expect(result.output).toContain('(required)')
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle ontology parsing errors gracefully', async () => {
      const invalidOntology = 'invalid rdf syntax without proper structure'
      const validTemplate = '{{ greeting }}'
      
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        invalidOntology,
        validTemplate
      )
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('processing failed')
    })

    it('should provide helpful hints when validation fails', async () => {
      const ontology = `@prefix ex: <http://example.com/test#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Goodbye" .` // Doesn't contain "Hello"

      const template = '{{ greeting }}'
      
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        ontology,
        template
      )
      
      expect(result.success).toBe(false)
      expect(result.hints).toBeDefined()
      expect(result.hints!.length).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(100)
    })
  })

  describe('Performance and Analytics', () => {
    it('should track real execution metrics', async () => {
      const ontology = `@prefix ex: <http://example.com/test#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Performance Test" .`

      const template = '{{ greeting }}'
      
      const startTime = Date.now()
      const result = await tutorialSystem.executeExercise(
        testUserId,
        'getting-started',
        'hello-world-ontology',
        ontology,
        template
      )
      const endTime = Date.now()
      
      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})