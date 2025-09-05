import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createTemplateContext, 
  useTemplateContext, 
  updateTemplateContext,
  getContextValue,
  setContextValue,
  hasContextValue,
  validateContextKeys,
  clearTemplateContext,
  serializeContext,
  deserializeContext
} from '../../src/context.js';
import { ContextError } from '../../src/types.js';

describe('Context Management', () => {
  beforeEach(() => {
    // Clear any existing context
    try {
      clearTemplateContext();
    } catch {
      // Ignore if no context exists
    }
  });

  describe('createTemplateContext', () => {
    it('should create empty context', () => {
      const context = createTemplateContext();
      expect(context).toBeDefined();
      expect(typeof context).toBe('object');
    });

    it('should create context with initial data', () => {
      const initialData = { name: 'test', value: 42 };
      const context = createTemplateContext(initialData);
      expect(context.name).toBe('test');
      expect(context.value).toBe(42);
    });
  });

  describe('useTemplateContext', () => {
    it('should throw error when no context exists', () => {
      expect(() => useTemplateContext()).toThrow(ContextError);
    });

    it('should return current context', () => {
      createTemplateContext({ test: 'value' });
      const context = useTemplateContext();
      expect(context.test).toBe('value');
    });
  });

  describe('updateTemplateContext', () => {
    it('should update existing context', () => {
      createTemplateContext({ a: 1 });
      updateTemplateContext({ b: 2 });
      
      const context = useTemplateContext();
      expect(context.a).toBe(1);
      expect(context.b).toBe(2);
    });

    it('should overwrite existing values', () => {
      createTemplateContext({ key: 'original' });
      updateTemplateContext({ key: 'updated' });
      
      const context = useTemplateContext();
      expect(context.key).toBe('updated');
    });
  });

  describe('getContextValue', () => {
    it('should get existing value', () => {
      createTemplateContext({ name: 'John' });
      expect(getContextValue('name')).toBe('John');
    });

    it('should return default value for missing key', () => {
      createTemplateContext({});
      expect(getContextValue('missing', 'default')).toBe('default');
    });

    it('should return undefined for missing key without default', () => {
      createTemplateContext({});
      expect(getContextValue('missing')).toBeUndefined();
    });
  });

  describe('setContextValue', () => {
    it('should set new value', () => {
      createTemplateContext({});
      setContextValue('key', 'value');
      expect(getContextValue('key')).toBe('value');
    });

    it('should update existing value', () => {
      createTemplateContext({ key: 'old' });
      setContextValue('key', 'new');
      expect(getContextValue('key')).toBe('new');
    });
  });

  describe('hasContextValue', () => {
    it('should return true for existing key', () => {
      createTemplateContext({ exists: 'yes' });
      expect(hasContextValue('exists')).toBe(true);
    });

    it('should return false for missing key', () => {
      createTemplateContext({});
      expect(hasContextValue('missing')).toBe(false);
    });

    it('should return true for key with undefined value', () => {
      createTemplateContext({ undef: undefined });
      expect(hasContextValue('undef')).toBe(true);
    });
  });

  describe('validateContextKeys', () => {
    it('should not throw for valid keys', () => {
      createTemplateContext({ a: 1, b: 2 });
      expect(() => validateContextKeys(['a', 'b'])).not.toThrow();
    });

    it('should throw for missing keys', () => {
      createTemplateContext({ a: 1 });
      expect(() => validateContextKeys(['a', 'b'])).toThrow(ContextError);
    });

    it('should throw with correct missing keys', () => {
      createTemplateContext({ a: 1 });
      try {
        validateContextKeys(['a', 'b', 'c']);
      } catch (error) {
        expect(error).toBeInstanceOf(ContextError);
        expect((error as ContextError).details.missingKeys).toEqual(['b', 'c']);
      }
    });
  });

  describe('serialization', () => {
    it('should serialize context to JSON', () => {
      createTemplateContext({ name: 'test', count: 42 });
      const json = serializeContext();
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('test');
      expect(parsed.count).toBe(42);
    });

    it('should deserialize JSON to context data', () => {
      const data = { name: 'test', items: ['a', 'b'] };
      const json = JSON.stringify(data);
      const result = deserializeContext(json);
      expect(result).toEqual(data);
    });

    it('should throw ContextError for invalid JSON', () => {
      expect(() => deserializeContext('invalid json')).toThrow(ContextError);
    });
  });
});