import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createTemplateContext,
  useTemplateContext,
  tryUseTemplateContext,
  hasTemplateContext,
  updateTemplateContext,
  clearTemplateContext,
  withTemplateContext,
  getContextValue,
  setContextValue,
  deleteContextValue,
  hasContextValue,
  mergeContexts,
  cloneContext,
  exportContext,
  importContext,
  getContextMetadata,
  interpolate
} from '../src/context'

describe('Context Management', () => {
  afterEach(() => {
    clearTemplateContext()
  })

  describe('createTemplateContext', () => {
    it('should create a new context with metadata', () => {
      const context = createTemplateContext({ foo: 'bar' })
      expect(context.foo).toBe('bar')
      expect(context._meta).toBeDefined()
      expect(context._meta?.version).toBe('1.0.0')
      expect(context._meta?.created).toBeInstanceOf(Date)
    })

    it('should set context globally', () => {
      createTemplateContext({ test: true })
      expect(hasTemplateContext()).toBe(true)
      expect(useTemplateContext().test).toBe(true)
    })
  })

  describe('useTemplateContext', () => {
    it('should throw if no context exists', () => {
      expect(() => useTemplateContext()).toThrow('No template context available')
    })

    it('should return the current context', () => {
      createTemplateContext({ value: 42 })
      const context = useTemplateContext()
      expect(context.value).toBe(42)
    })
  })

  describe('tryUseTemplateContext', () => {
    it('should return undefined if no context', () => {
      expect(tryUseTemplateContext()).toBeUndefined()
    })

    it('should return context if exists', () => {
      createTemplateContext({ exists: true })
      expect(tryUseTemplateContext()?.exists).toBe(true)
    })
  })

  describe('updateTemplateContext', () => {
    it('should merge updates with existing context', () => {
      createTemplateContext({ a: 1, b: 2 })
      updateTemplateContext({ b: 3, c: 4 })
      
      const context = useTemplateContext()
      expect(context.a).toBe(1)
      expect(context.b).toBe(3)
      expect(context.c).toBe(4)
    })

    it('should update metadata timestamp', () => {
      createTemplateContext()
      const originalUpdated = useTemplateContext()._meta?.updated
      
      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        updateTemplateContext({ new: 'value' })
        const newUpdated = useTemplateContext()._meta?.updated
        expect(newUpdated).not.toEqual(originalUpdated)
      }, 10)
    })
  })

  describe('getContextValue', () => {
    it('should get value by dot notation path', () => {
      createTemplateContext({
        user: {
          profile: {
            name: 'Alice'
          }
        }
      })
      
      expect(getContextValue('user.profile.name')).toBe('Alice')
    })

    it('should return default value if path not found', () => {
      createTemplateContext({ foo: 'bar' })
      expect(getContextValue('missing.path', 'default')).toBe('default')
    })
  })

  describe('setContextValue', () => {
    it('should set value by dot notation path', () => {
      createTemplateContext()
      setContextValue('deep.nested.value', 42)
      
      const context = useTemplateContext()
      expect(context.deep.nested.value).toBe(42)
    })

    it('should overwrite existing values', () => {
      createTemplateContext({ existing: { value: 'old' } })
      setContextValue('existing.value', 'new')
      
      expect(getContextValue('existing.value')).toBe('new')
    })
  })

  describe('deleteContextValue', () => {
    it('should delete value by path', () => {
      createTemplateContext({ remove: { this: 'value' } })
      const deleted = deleteContextValue('remove.this')
      
      expect(deleted).toBe(true)
      expect(hasContextValue('remove.this')).toBe(false)
    })

    it('should return false if path not found', () => {
      createTemplateContext()
      expect(deleteContextValue('not.exists')).toBe(false)
    })
  })

  describe('hasContextValue', () => {
    it('should check if value exists', () => {
      createTemplateContext({ check: { exists: true } })
      
      expect(hasContextValue('check.exists')).toBe(true)
      expect(hasContextValue('check.missing')).toBe(false)
    })

    it('should return false if no context', () => {
      expect(hasContextValue('anything')).toBe(false)
    })
  })

  describe('withTemplateContext', () => {
    it('should run function with specific context', async () => {
      createTemplateContext({ global: true })
      
      const result = await withTemplateContext(
        { local: true } as any,
        () => {
          return useTemplateContext().local
        }
      )
      
      expect(result).toBe(true)
      expect(useTemplateContext().global).toBe(true)
    })
  })

  describe('mergeContexts', () => {
    it('should merge multiple contexts', () => {
      const merged = mergeContexts(
        { a: 1, b: 2 },
        { b: 3, c: 4 },
        { d: 5 }
      )
      
      expect(merged.a).toBe(1)
      expect(merged.b).toBe(3)
      expect(merged.c).toBe(4)
      expect(merged.d).toBe(5)
    })
  })

  describe('cloneContext', () => {
    it('should create a deep copy', () => {
      createTemplateContext({ 
        original: { 
          nested: { value: 42 } 
        } 
      })
      
      const cloned = cloneContext()
      cloned.original.nested.value = 100
      
      expect(useTemplateContext().original.nested.value).toBe(42)
    })
  })

  describe('export/import', () => {
    it('should export context as JSON', () => {
      createTemplateContext({ export: 'test' })
      const json = exportContext()
      
      expect(json).toContain('"export"')
      expect(json).toContain('"test"')
    })

    it('should import context from JSON', () => {
      const json = '{"imported": true, "value": 42}'
      const context = importContext(json)
      
      expect(context.imported).toBe(true)
      expect(context.value).toBe(42)
    })

    it('should throw on invalid JSON', () => {
      expect(() => importContext('invalid json')).toThrow('Failed to import context')
    })
  })

  describe('interpolate', () => {
    it('should interpolate template variables', () => {
      createTemplateContext({ name: 'World', count: 42 })
      
      const result = interpolate('Hello {{name}}! Count: {{count}}')
      expect(result).toBe('Hello World! Count: 42')
    })

    it('should handle missing variables', () => {
      createTemplateContext({ exists: 'yes' })
      
      const result = interpolate('{{exists}} but {{missing}}')
      expect(result).toBe('yes but {{missing}}')
    })

    it('should use custom context', () => {
      createTemplateContext({ global: 'value' })
      
      const result = interpolate('{{custom}}', { custom: 'local' })
      expect(result).toBe('local')
    })
  })
})