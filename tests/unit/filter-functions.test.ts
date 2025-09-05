/**
 * Unit Tests for Unjucks Filter Functions
 * Tests all template transformation filters
 */

import { describe, it, expect } from 'vitest';
import { UnjucksFilters } from '../../src/weaver/unjucks-filters';
import type { SemanticConventionAttribute } from '../../src/weaver/types';

describe('UnjucksFilters', () => {
  describe('String Case Conversions', () => {
    it('should convert to camelCase', () => {
      expect(UnjucksFilters.camelCase('hello_world')).toBe('helloWorld');
      expect(UnjucksFilters.camelCase('HTTP-Server')).toBe('httpServer');
      expect(UnjucksFilters.camelCase('simple word')).toBe('simpleWord');
      expect(UnjucksFilters.camelCase('already_camelCase')).toBe('alreadyCamelCase');
      expect(UnjucksFilters.camelCase('')).toBe('');
      expect(UnjucksFilters.camelCase('a')).toBe('a');
    });

    it('should convert to PascalCase', () => {
      expect(UnjucksFilters.pascalCase('hello_world')).toBe('HelloWorld');
      expect(UnjucksFilters.pascalCase('http-server')).toBe('HttpServer');
      expect(UnjucksFilters.pascalCase('simple word')).toBe('SimpleWord');
      expect(UnjucksFilters.pascalCase('camelCase')).toBe('CamelCase');
      expect(UnjucksFilters.pascalCase('')).toBe('');
      expect(UnjucksFilters.pascalCase('a')).toBe('A');
    });

    it('should convert to snake_case', () => {
      expect(UnjucksFilters.snakeCase('HelloWorld')).toBe('hello_world');
      expect(UnjucksFilters.snakeCase('HTTPServer')).toBe('h_t_t_p_server');
      expect(UnjucksFilters.snakeCase('simpleWord')).toBe('simple_word');
      expect(UnjucksFilters.snakeCase('already_snake_case')).toBe('already_snake_case');
      expect(UnjucksFilters.snakeCase('')).toBe('');
      expect(UnjucksFilters.snakeCase('A')).toBe('a');
    });

    it('should convert to kebab-case', () => {
      expect(UnjucksFilters.kebabCase('HelloWorld')).toBe('hello-world');
      expect(UnjucksFilters.kebabCase('HTTPServer')).toBe('h-t-t-p-server');
      expect(UnjucksFilters.kebabCase('simpleWord')).toBe('simple-word');
      expect(UnjucksFilters.kebabCase('already-kebab-case')).toBe('already-kebab-case');
      expect(UnjucksFilters.kebabCase('')).toBe('');
      expect(UnjucksFilters.kebabCase('A')).toBe('a');
    });

    it('should convert to CONSTANT_CASE', () => {
      expect(UnjucksFilters.constantCase('HelloWorld')).toBe('HELLO_WORLD');
      expect(UnjucksFilters.constantCase('httpServer')).toBe('HTTP_SERVER');
      expect(UnjucksFilters.constantCase('simple-word')).toBe('SIMPLE_WORD');
      expect(UnjucksFilters.constantCase('ALREADY_CONSTANT')).toBe('ALREADY_CONSTANT');
      expect(UnjucksFilters.constantCase('')).toBe('');
      expect(UnjucksFilters.constantCase('a')).toBe('A');
    });
  });

  describe('Type Conversion Filters', () => {
    it('should convert to TypeScript types', () => {
      const stringAttr: SemanticConventionAttribute = {
        id: 'test.string',
        type: 'string',
        brief: 'Test string',
        requirement_level: 'required'
      };
      
      const numberAttr: SemanticConventionAttribute = {
        id: 'test.number',
        type: 'number',
        brief: 'Test number',
        requirement_level: 'required'
      };
      
      const booleanAttr: SemanticConventionAttribute = {
        id: 'test.boolean',
        type: 'boolean',
        brief: 'Test boolean',
        requirement_level: 'required'
      };
      
      const arrayAttr: SemanticConventionAttribute = {
        id: 'test.array',
        type: 'string[]',
        brief: 'Test array',
        requirement_level: 'required'
      };
      
      expect(UnjucksFilters.toTypeScriptType(stringAttr)).toBe('string');
      expect(UnjucksFilters.toTypeScriptType(numberAttr)).toBe('number');
      expect(UnjucksFilters.toTypeScriptType(booleanAttr)).toBe('boolean');
      expect(UnjucksFilters.toTypeScriptType(arrayAttr)).toBe('string[]');
    });

    it('should convert to Go types', () => {
      const stringAttr: SemanticConventionAttribute = {
        id: 'test.string',
        type: 'string',
        brief: 'Test string',
        requirement_level: 'required'
      };
      
      const numberAttr: SemanticConventionAttribute = {
        id: 'test.number',
        type: 'number',
        brief: 'Test number',
        requirement_level: 'required'
      };
      
      const booleanAttr: SemanticConventionAttribute = {
        id: 'test.boolean',
        type: 'boolean',
        brief: 'Test boolean',
        requirement_level: 'required'
      };
      
      expect(UnjucksFilters.toGoType(stringAttr)).toBe('string');
      expect(UnjucksFilters.toGoType(numberAttr)).toBe('float64');
      expect(UnjucksFilters.toGoType(booleanAttr)).toBe('bool');
    });

    it('should convert to Rust types', () => {
      const stringAttr: SemanticConventionAttribute = {
        id: 'test.string',
        type: 'string',
        brief: 'Test string',
        requirement_level: 'required'
      };
      
      const numberAttr: SemanticConventionAttribute = {
        id: 'test.number',
        type: 'number',
        brief: 'Test number',
        requirement_level: 'required'
      };
      
      const arrayAttr: SemanticConventionAttribute = {
        id: 'test.array',
        type: 'string[]',
        brief: 'Test array',
        requirement_level: 'required'
      };
      
      expect(UnjucksFilters.toRustType(stringAttr)).toBe('String');
      expect(UnjucksFilters.toRustType(numberAttr)).toBe('f64');
      expect(UnjucksFilters.toRustType(arrayAttr)).toBe('Vec<String>');
    });
  });

  describe('Array and Collection Filters', () => {
    it('should sort arrays', () => {
      const numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5];
      expect(UnjucksFilters.sort(numbers)).toEqual([1, 1, 2, 3, 4, 5, 5, 6, 9]);
      
      const strings = ['banana', 'apple', 'cherry', 'date'];
      expect(UnjucksFilters.sort(strings)).toEqual(['apple', 'banana', 'cherry', 'date']);
      
      const objects = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      const sortedByName = UnjucksFilters.sort(objects, 'name');
      expect(sortedByName[0].name).toBe('Alice');
      expect(sortedByName[2].name).toBe('Charlie');
    });

    it('should group arrays by property', () => {
      const items = [
        { category: 'fruit', name: 'apple' },
        { category: 'vegetable', name: 'carrot' },
        { category: 'fruit', name: 'banana' },
        { category: 'vegetable', name: 'spinach' },
        { category: 'fruit', name: 'orange' }
      ];
      
      const grouped = UnjucksFilters.groupBy(items, 'category');
      expect(grouped.fruit).toHaveLength(3);
      expect(grouped.vegetable).toHaveLength(2);
      expect(grouped.fruit.map(item => item.name)).toEqual(['apple', 'banana', 'orange']);
    });

    it('should filter arrays', () => {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const evenNumbers = UnjucksFilters.filter(numbers, (n: number) => n % 2 === 0);
      expect(evenNumbers).toEqual([2, 4, 6, 8, 10]);
      
      const items = [
        { active: true, name: 'item1' },
        { active: false, name: 'item2' },
        { active: true, name: 'item3' },
      ];
      const activeItems = UnjucksFilters.filter(items, (item: any) => item.active);
      expect(activeItems).toHaveLength(2);
      expect(activeItems.map((item: any) => item.name)).toEqual(['item1', 'item3']);
    });

    it('should map arrays', () => {
      const numbers = [1, 2, 3, 4, 5];
      const doubled = UnjucksFilters.map(numbers, (n: number) => n * 2);
      expect(doubled).toEqual([2, 4, 6, 8, 10]);
      
      const items = [
        { name: 'item_one' },
        { name: 'item_two' },
        { name: 'item_three' }
      ];
      const camelCased = UnjucksFilters.map(items, (item: any) => ({
        ...item,
        name: UnjucksFilters.camelCase(item.name)
      }));
      expect(camelCased.map((item: any) => item.name)).toEqual(['itemOne', 'itemTwo', 'itemThree']);
    });

    it('should find unique values', () => {
      const numbers = [1, 2, 2, 3, 3, 3, 4, 4, 5];
      expect(UnjucksFilters.unique(numbers)).toEqual([1, 2, 3, 4, 5]);
      
      const items = [
        { category: 'fruit' },
        { category: 'vegetable' },
        { category: 'fruit' },
        { category: 'grain' },
        { category: 'vegetable' }
      ];
      const uniqueCategories = UnjucksFilters.unique(items, 'category');
      expect(uniqueCategories).toEqual(['fruit', 'vegetable', 'grain']);
    });
  });

  describe('String Manipulation Filters', () => {
    it('should capitalize strings', () => {
      expect(UnjucksFilters.capitalize('hello world')).toBe('Hello world');
      expect(UnjucksFilters.capitalize('HELLO WORLD')).toBe('Hello world');
      expect(UnjucksFilters.capitalize('')).toBe('');
      expect(UnjucksFilters.capitalize('a')).toBe('A');
    });

    it('should title case strings', () => {
      expect(UnjucksFilters.title('hello world')).toBe('Hello World');
      expect(UnjucksFilters.title('the quick brown fox')).toBe('The Quick Brown Fox');
      expect(UnjucksFilters.title('API_ENDPOINT_URL')).toBe('Api Endpoint Url');
      expect(UnjucksFilters.title('')).toBe('');
    });

    it('should truncate strings', () => {
      const longString = 'This is a very long string that should be truncated';
      expect(UnjucksFilters.truncate(longString, 20)).toBe('This is a very long...');
      expect(UnjucksFilters.truncate(longString, 50)).toBe(longString);
      expect(UnjucksFilters.truncate('short', 10)).toBe('short');
      expect(UnjucksFilters.truncate(longString, 20, '***')).toBe('This is a very long***');
    });

    it('should pad strings', () => {
      expect(UnjucksFilters.padStart('123', 6, '0')).toBe('000123');
      expect(UnjucksFilters.padEnd('123', 6, '0')).toBe('123000');
      expect(UnjucksFilters.padStart('already long enough', 5)).toBe('already long enough');
      expect(UnjucksFilters.padEnd('test', 8)).toBe('test    ');
    });

    it('should replace string content', () => {
      expect(UnjucksFilters.replace('hello world', 'world', 'universe')).toBe('hello universe');
      expect(UnjucksFilters.replace('test test test', 'test', 'demo')).toBe('demo demo demo');
      expect(UnjucksFilters.replace('no match', 'xyz', 'abc')).toBe('no match');
    });

    it('should split and join strings', () => {
      expect(UnjucksFilters.split('a,b,c', ',')).toEqual(['a', 'b', 'c']);
      expect(UnjucksFilters.split('hello world', ' ')).toEqual(['hello', 'world']);
      
      expect(UnjucksFilters.join(['a', 'b', 'c'], ', ')).toBe('a, b, c');
      expect(UnjucksFilters.join(['hello', 'world'], ' ')).toBe('hello world');
    });
  });

  describe('Semantic Convention Filters', () => {
    it('should sort attributes by requirement level', () => {
      const attributes: SemanticConventionAttribute[] = [
        { id: 'optional1', requirement_level: 'opt_in', brief: 'Optional 1', type: 'string' },
        { id: 'required1', requirement_level: 'required', brief: 'Required 1', type: 'string' },
        { id: 'recommended1', requirement_level: 'recommended', brief: 'Recommended 1', type: 'string' },
        { id: 'conditional1', requirement_level: 'conditionally_required', brief: 'Conditional 1', type: 'string' },
        { id: 'required2', requirement_level: 'required', brief: 'Required 2', type: 'string' },
      ];
      
      const sorted = UnjucksFilters.sortAttributes(attributes);
      
      expect(sorted[0].requirement_level).toBe('required');
      expect(sorted[1].requirement_level).toBe('required');
      expect(sorted[2].requirement_level).toBe('conditionally_required');
      expect(sorted[3].requirement_level).toBe('recommended');
      expect(sorted[4].requirement_level).toBe('opt_in');
      
      // Within the same requirement level, should be sorted by name
      expect(sorted[0].id).toBe('required1');
      expect(sorted[1].id).toBe('required2');
    });

    it('should filter attributes by stability', () => {
      const attributes: SemanticConventionAttribute[] = [
        { id: 'stable1', stability: 'stable', requirement_level: 'required', brief: 'Stable 1', type: 'string' },
        { id: 'experimental1', stability: 'experimental', requirement_level: 'required', brief: 'Experimental 1', type: 'string' },
        { id: 'deprecated1', stability: 'deprecated', requirement_level: 'required', brief: 'Deprecated 1', type: 'string' },
        { id: 'nostability', requirement_level: 'required', brief: 'No stability', type: 'string' },
      ];
      
      const stable = UnjucksFilters.filterByStability(attributes, ['stable']);
      expect(stable).toHaveLength(2); // stable1 and nostability (no stability = stable)
      expect(stable.map(a => a.id)).toContain('stable1');
      expect(stable.map(a => a.id)).toContain('nostability');
      
      const experimental = UnjucksFilters.filterByStability(attributes, ['experimental']);
      expect(experimental).toHaveLength(1);
      expect(experimental[0].id).toBe('experimental1');
      
      const stableAndExperimental = UnjucksFilters.filterByStability(attributes, ['stable', 'experimental']);
      expect(stableAndExperimental).toHaveLength(3);
    });

    it('should group attributes by namespace', () => {
      const attributes: SemanticConventionAttribute[] = [
        { id: 'http.method', namespace: 'http', requirement_level: 'required', brief: 'HTTP method', type: 'string' },
        { id: 'http.url', namespace: 'http', requirement_level: 'required', brief: 'HTTP URL', type: 'string' },
        { id: 'db.name', namespace: 'db', requirement_level: 'required', brief: 'DB name', type: 'string' },
        { id: 'no.namespace', requirement_level: 'required', brief: 'No namespace', type: 'string' },
      ];
      
      const grouped = UnjucksFilters.groupByNamespace(attributes);
      
      expect(grouped.http).toHaveLength(2);
      expect(grouped.db).toHaveLength(1);
      expect(grouped.default).toHaveLength(1); // no namespace goes to default
      
      expect(grouped.http.map(a => a.id)).toEqual(['http.method', 'http.url']);
      expect(grouped.db[0].id).toBe('db.name');
      expect(grouped.default[0].id).toBe('no.namespace');
    });
  });

  describe('Utility Filters', () => {
    it('should generate documentation comments', () => {
      const simple = UnjucksFilters.toDocComment('Simple description');
      expect(simple).toEqual(['Simple description']);
      
      const withNote = UnjucksFilters.toDocComment('Description', 'Additional note');
      expect(withNote).toEqual(['Description', '', 'Additional note']);
      
      const withExamples = UnjucksFilters.toDocComment(
        'Description',
        undefined,
        ['example1', 'example2']
      );
      expect(withExamples).toEqual([
        'Description',
        '',
        'Examples:',
        '  - example1',
        '  - example2'
      ]);
      
      const complete = UnjucksFilters.toDocComment(
        'Full description',
        'Important note',
        'single-example'
      );
      expect(complete).toEqual([
        'Full description',
        '',
        'Important note',
        '',
        'Examples:',
        '  - single-example'
      ]);
    });

    it('should format dates', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      
      expect(UnjucksFilters.date(date, 'YYYY-MM-DD')).toBe('2024-01-15');
      expect(UnjucksFilters.date(date, 'DD/MM/YYYY')).toBe('15/01/2024');
      expect(UnjucksFilters.date(date, 'YYYY')).toBe('2024');
      
      // Test with string input
      expect(UnjucksFilters.date('2024-01-15', 'YYYY-MM-DD')).toBe('2024-01-15');
      
      // Test with timestamp
      expect(UnjucksFilters.date(1705316200000, 'YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('should convert to JSON', () => {
      const obj = { name: 'test', value: 42, active: true };
      const jsonString = UnjucksFilters.tojson(obj);
      expect(JSON.parse(jsonString)).toEqual(obj);
      
      expect(UnjucksFilters.tojson('string')).toBe('"string"');
      expect(UnjucksFilters.tojson(123)).toBe('123');
      expect(UnjucksFilters.tojson(true)).toBe('true');
      expect(UnjucksFilters.tojson(null)).toBe('null');
      
      // Test pretty printing
      const prettyJson = UnjucksFilters.tojson(obj, 2);
      expect(prettyJson).toContain('\n');
      expect(prettyJson).toContain('  "name": "test"');
    });

    it('should generate default values', () => {
      expect(UnjucksFilters.default(undefined, 'fallback')).toBe('fallback');
      expect(UnjucksFilters.default(null, 'fallback')).toBe('fallback');
      expect(UnjucksFilters.default('', 'fallback')).toBe('fallback');
      expect(UnjucksFilters.default(0, 'fallback')).toBe(0);
      expect(UnjucksFilters.default(false, 'fallback')).toBe(false);
      expect(UnjucksFilters.default('value', 'fallback')).toBe('value');
    });
  });

  describe('Mathematical Filters', () => {
    it('should perform mathematical operations', () => {
      expect(UnjucksFilters.add(5, 3)).toBe(8);
      expect(UnjucksFilters.subtract(10, 4)).toBe(6);
      expect(UnjucksFilters.multiply(6, 7)).toBe(42);
      expect(UnjucksFilters.divide(15, 3)).toBe(5);
      expect(UnjucksFilters.modulo(17, 5)).toBe(2);
    });

    it('should handle mathematical edge cases', () => {
      expect(UnjucksFilters.divide(10, 0)).toBe(Infinity);
      expect(UnjucksFilters.divide(-10, 0)).toBe(-Infinity);
      expect(Number.isNaN(UnjucksFilters.divide(0, 0))).toBe(true);
      
      expect(UnjucksFilters.modulo(10, 0)).toBe(NaN);
    });

    it('should format numbers', () => {
      expect(UnjucksFilters.round(3.14159, 2)).toBe(3.14);
      expect(UnjucksFilters.round(3.14159, 0)).toBe(3);
      expect(UnjucksFilters.round(3.97)).toBe(4);
      
      expect(UnjucksFilters.floor(3.99)).toBe(3);
      expect(UnjucksFilters.ceil(3.01)).toBe(4);
      
      expect(UnjucksFilters.abs(-5)).toBe(5);
      expect(UnjucksFilters.abs(5)).toBe(5);
      expect(UnjucksFilters.abs(0)).toBe(0);
    });
  });

  describe('Validation Filters', () => {
    it('should check data types', () => {
      expect(UnjucksFilters.isString('hello')).toBe(true);
      expect(UnjucksFilters.isString(123)).toBe(false);
      
      expect(UnjucksFilters.isNumber(123)).toBe(true);
      expect(UnjucksFilters.isNumber('123')).toBe(false);
      
      expect(UnjucksFilters.isBoolean(true)).toBe(true);
      expect(UnjucksFilters.isBoolean('true')).toBe(false);
      
      expect(UnjucksFilters.isArray([])).toBe(true);
      expect(UnjucksFilters.isArray([1, 2, 3])).toBe(true);
      expect(UnjucksFilters.isArray('not array')).toBe(false);
      
      expect(UnjucksFilters.isObject({})).toBe(true);
      expect(UnjucksFilters.isObject({ key: 'value' })).toBe(true);
      expect(UnjucksFilters.isObject([])).toBe(false); // Arrays are not objects in this context
      expect(UnjucksFilters.isObject(null)).toBe(false);
    });

    it('should check for empty values', () => {
      expect(UnjucksFilters.isEmpty('')).toBe(true);
      expect(UnjucksFilters.isEmpty([])).toBe(true);
      expect(UnjucksFilters.isEmpty({})).toBe(true);
      expect(UnjucksFilters.isEmpty(null)).toBe(true);
      expect(UnjucksFilters.isEmpty(undefined)).toBe(true);
      
      expect(UnjucksFilters.isEmpty('content')).toBe(false);
      expect(UnjucksFilters.isEmpty([1])).toBe(false);
      expect(UnjucksFilters.isEmpty({ key: 'value' })).toBe(false);
      expect(UnjucksFilters.isEmpty(0)).toBe(false);
      expect(UnjucksFilters.isEmpty(false)).toBe(false);
    });
  });

  describe('Filter Chaining', () => {
    it('should support chaining multiple filters', () => {
      // Test chaining through manual application
      const input = 'hello_world_example';
      const step1 = UnjucksFilters.camelCase(input);
      const step2 = UnjucksFilters.capitalize(step1);
      const step3 = UnjucksFilters.replace(step2, 'Example', 'Test');
      
      expect(step3).toBe('HelloWorldTest');
    });

    it('should handle complex transformations', () => {
      const attributes: SemanticConventionAttribute[] = [
        { id: 'http_request_method', requirement_level: 'required', brief: 'HTTP method', type: 'string' },
        { id: 'http_response_status', requirement_level: 'recommended', brief: 'HTTP status', type: 'number' },
        { id: 'user_session_id', requirement_level: 'opt_in', brief: 'Session ID', type: 'string' },
      ];
      
      // Sort attributes and transform names
      const sorted = UnjucksFilters.sortAttributes(attributes);
      const transformed = UnjucksFilters.map(sorted, (attr: any) => ({
        ...attr,
        camelCaseName: UnjucksFilters.camelCase(attr.id),
        constantName: UnjucksFilters.constantCase(attr.id)
      }));
      
      expect(transformed[0].id).toBe('http_request_method'); // Required first
      expect(transformed[0].camelCaseName).toBe('httpRequestMethod');
      expect(transformed[0].constantName).toBe('HTTP_REQUEST_METHOD');
    });
  });

  describe('Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => UnjucksFilters.camelCase(null as any)).not.toThrow();
      expect(() => UnjucksFilters.camelCase(undefined as any)).not.toThrow();
      
      expect(UnjucksFilters.camelCase(null as any)).toBe('');
      expect(UnjucksFilters.camelCase(undefined as any)).toBe('');
    });

    it('should handle invalid inputs with sensible defaults', () => {
      expect(() => UnjucksFilters.sort(null as any)).not.toThrow();
      expect(() => UnjucksFilters.groupBy(null as any, 'property')).not.toThrow();
      
      expect(UnjucksFilters.sort(null as any)).toEqual([]);
      expect(UnjucksFilters.groupBy(null as any, 'property')).toEqual({});
    });

    it('should handle type mismatches gracefully', () => {
      expect(() => UnjucksFilters.add('not a number' as any, 5)).not.toThrow();
      expect(Number.isNaN(UnjucksFilters.add('not a number' as any, 5))).toBe(true);
      
      expect(() => UnjucksFilters.truncate(123 as any, 5)).not.toThrow();
      expect(UnjucksFilters.truncate(123 as any, 5)).toBe('123');
    });
  });
});
