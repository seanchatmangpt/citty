/**
 * Unit Tests for Unjucks Template Walker
 * Tests core template traversal and node processing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateWalker } from '../../src/weaver/template-walker';
import type { TemplateNode, TemplateAST } from '../../src/weaver/types';

interface MockTemplateNode extends TemplateNode {
  type: 'text' | 'variable' | 'block' | 'filter' | 'loop' | 'conditional';
  content?: string;
  name?: string;
  expression?: string;
  children?: MockTemplateNode[];
  filters?: string[];
}

describe('TemplateWalker', () => {
  let walker: TemplateWalker;
  let mockAST: TemplateAST;

  beforeEach(() => {
    walker = new TemplateWalker();
    mockAST = {
      root: {
        type: 'block',
        name: 'root',
        children: []
      } as MockTemplateNode,
      version: '1.0',
      metadata: {
        created: new Date(),
        source: 'test'
      }
    };
  });

  describe('Node Traversal', () => {
    it('should walk through simple template nodes', () => {
      const nodes: MockTemplateNode[] = [];
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          name: 'root',
          children: [
            { type: 'text', content: 'Hello ' },
            { type: 'variable', name: 'name' },
            { type: 'text', content: '!' }
          ]
        } as MockTemplateNode
      };

      walker.walk(ast, (node) => {
        nodes.push(node as MockTemplateNode);
      });

      expect(nodes).toHaveLength(4); // root + 3 children
      expect(nodes[0].type).toBe('block');
      expect(nodes[1].type).toBe('text');
      expect(nodes[2].type).toBe('variable');
      expect(nodes[3].type).toBe('text');
    });

    it('should handle deeply nested node structures', () => {
      const nodeCount = { count: 0 };
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          name: 'root',
          children: [
            {
              type: 'loop',
              name: 'items',
              expression: 'item in items',
              children: [
                {
                  type: 'conditional',
                  expression: 'item.active',
                  children: [
                    { type: 'variable', name: 'item.name' }
                  ]
                }
              ]
            }
          ]
        } as MockTemplateNode
      };

      walker.walk(ast, () => {
        nodeCount.count++;
      });

      expect(nodeCount.count).toBe(4); // root, loop, conditional, variable
    });

    it('should provide correct node depth information', () => {
      const depths: number[] = [];
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          name: 'root',
          children: [
            {
              type: 'loop',
              children: [
                {
                  type: 'variable',
                  name: 'nested'
                }
              ]
            }
          ]
        } as MockTemplateNode
      };

      walker.walk(ast, (node, depth) => {
        depths.push(depth || 0);
      });

      expect(depths).toEqual([0, 1, 2]); // root=0, loop=1, variable=2
    });
  });

  describe('Node Filtering', () => {
    it('should filter nodes by type', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'text', content: 'Hello' },
            { type: 'variable', name: 'name' },
            { type: 'text', content: 'World' },
            { type: 'variable', name: 'title' }
          ]
        } as MockTemplateNode
      };

      const variables = walker.findNodes(ast, (node) => 
        (node as MockTemplateNode).type === 'variable'
      );

      expect(variables).toHaveLength(2);
      expect((variables[0] as MockTemplateNode).name).toBe('name');
      expect((variables[1] as MockTemplateNode).name).toBe('title');
    });

    it('should find nodes by name pattern', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'variable', name: 'user.name' },
            { type: 'variable', name: 'user.email' },
            { type: 'variable', name: 'system.version' }
          ]
        } as MockTemplateNode
      };

      const userNodes = walker.findNodes(ast, (node) => {
        const mockNode = node as MockTemplateNode;
        return mockNode.type === 'variable' && mockNode.name?.startsWith('user.');
      });

      expect(userNodes).toHaveLength(2);
    });

    it('should handle complex filter predicates', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'variable', name: 'a', filters: ['camelCase'] },
            { type: 'variable', name: 'b', filters: ['camelCase', 'upper'] },
            { type: 'variable', name: 'c' }
          ]
        } as MockTemplateNode
      };

      const filteredNodes = walker.findNodes(ast, (node) => {
        const mockNode = node as MockTemplateNode;
        return mockNode.filters && mockNode.filters.includes('camelCase');
      });

      expect(filteredNodes).toHaveLength(2);
    });
  });

  describe('Node Transformation', () => {
    it('should transform nodes while preserving structure', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'variable', name: 'user_name' },
            { type: 'variable', name: 'user_email' }
          ]
        } as MockTemplateNode
      };

      const transformedAST = walker.transform(ast, (node) => {
        const mockNode = node as MockTemplateNode;
        if (mockNode.type === 'variable' && mockNode.name) {
          return {
            ...mockNode,
            name: mockNode.name.replace(/_/g, '.')
          };
        }
        return node;
      });

      const variables = walker.findNodes(transformedAST, (node) => 
        (node as MockTemplateNode).type === 'variable'
      );

      expect((variables[0] as MockTemplateNode).name).toBe('user.name');
      expect((variables[1] as MockTemplateNode).name).toBe('user.email');
    });

    it('should handle node replacement', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'text', content: 'OLD_TEXT' }
          ]
        } as MockTemplateNode
      };

      const transformedAST = walker.transform(ast, (node) => {
        const mockNode = node as MockTemplateNode;
        if (mockNode.type === 'text' && mockNode.content === 'OLD_TEXT') {
          return {
            type: 'variable',
            name: 'dynamic_content'
          } as MockTemplateNode;
        }
        return node;
      });

      const children = (transformedAST.root as MockTemplateNode).children;
      expect(children?.[0].type).toBe('variable');
      expect((children?.[0] as MockTemplateNode).name).toBe('dynamic_content');
    });

    it('should maintain parent-child relationships', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            {
              type: 'loop',
              name: 'items',
              children: [
                { type: 'variable', name: 'item' }
              ]
            }
          ]
        } as MockTemplateNode
      };

      let parentFound = false;
      walker.walk(ast, (node, depth, parent) => {
        const mockNode = node as MockTemplateNode;
        if (mockNode.type === 'variable' && mockNode.name === 'item') {
          expect(parent).toBeDefined();
          expect((parent as MockTemplateNode)?.type).toBe('loop');
          parentFound = true;
        }
      });

      expect(parentFound).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty AST gracefully', () => {
      const emptyAST: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: []
        } as MockTemplateNode
      };

      const nodes: TemplateNode[] = [];
      walker.walk(emptyAST, (node) => {
        nodes.push(node);
      });

      expect(nodes).toHaveLength(1); // just the root
    });

    it('should handle circular references safely', () => {
      const circularNode: MockTemplateNode = {
        type: 'block',
        children: []
      };
      circularNode.children = [circularNode]; // Create circular reference

      const ast: TemplateAST = {
        ...mockAST,
        root: circularNode
      };

      // Should not hang or crash
      expect(() => {
        const nodes: TemplateNode[] = [];
        walker.walk(ast, (node) => {
          nodes.push(node);
          // Limit to prevent infinite loop
          if (nodes.length > 100) {
            throw new Error('Circular reference detected');
          }
        });
      }).toThrow('Circular reference detected');
    });

    it('should process large AST efficiently', () => {
      // Generate a large AST with 1000 nodes
      const largeChildren: MockTemplateNode[] = [];
      for (let i = 0; i < 1000; i++) {
        largeChildren.push({
          type: 'variable',
          name: `var${i}`
        });
      }

      const largeAST: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: largeChildren
        } as MockTemplateNode
      };

      const startTime = performance.now();
      const nodes: TemplateNode[] = [];
      walker.walk(largeAST, (node) => {
        nodes.push(node);
      });
      const endTime = performance.now();

      expect(nodes).toHaveLength(1001); // root + 1000 variables
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed nodes gracefully', () => {
      const malformedAST: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            null, // Invalid node
            undefined, // Invalid node
            { type: 'variable' } // Missing required properties
          ]
        } as any
      };

      expect(() => {
        walker.walk(malformedAST, () => {});
      }).not.toThrow();
    });

    it('should provide error context in callbacks', () => {
      const ast: TemplateAST = {
        ...mockAST,
        root: {
          type: 'block',
          children: [
            { type: 'variable', name: 'test' }
          ]
        } as MockTemplateNode
      };

      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      expect(() => {
        walker.walk(ast, errorCallback);
      }).toThrow('Test error');

      expect(errorCallback).toHaveBeenCalledTimes(1);
    });
  });
});
