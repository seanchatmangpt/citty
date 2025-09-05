// tests/unit/citty-pro-plugins.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { 
  registerPlugin,
  unregisterPlugin,
  applyPlugins,
  getPlugins,
  hasPlugin
} from '../../src/pro/plugins/index';
import type { Plugin, Hooks, RunCtx } from '../../src/types/citty-pro.d.ts';

describe('Citty Pro Plugin System', () => {
  let mockHooks: Hooks;
  let mockCtx: RunCtx;
  let mockConsoleWarn: any;
  let mockConsoleError: any;

  beforeEach(() => {
    // Clear all plugins before each test
    getPlugins().forEach(name => unregisterPlugin(name));
    
    // Create mock hooks
    mockHooks = {
      hook: vi.fn(),
      callHook: vi.fn()
    };

    // Create mock context
    mockCtx = {
      cwd: faker.system.directoryPath(),
      env: { NODE_ENV: 'test' },
      now: () => new Date(),
      plugins: new Set()
    } as RunCtx & { plugins: Set<string> };

    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all plugins
    getPlugins().forEach(name => unregisterPlugin(name));
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Plugin Registration', () => {
    it('should register a plugin successfully', () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const mockPlugin: Plugin = vi.fn();

      // Act
      registerPlugin(pluginName, mockPlugin);

      // Assert
      expect(hasPlugin(pluginName)).toBe(true);
      expect(getPlugins()).toContain(pluginName);
    });

    it('should replace existing plugin and warn', () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const originalPlugin: Plugin = vi.fn();
      const replacementPlugin: Plugin = vi.fn();

      registerPlugin(pluginName, originalPlugin);

      // Act
      registerPlugin(pluginName, replacementPlugin);

      // Assert
      expect(hasPlugin(pluginName)).toBe(true);
      expect(getPlugins()).toHaveLength(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Plugin "${pluginName}" is already registered and will be replaced`
      );
    });

    it('should register multiple plugins', () => {
      // Arrange
      const pluginNames = Array.from({ length: 3 }, () => faker.lorem.word());
      const plugins = pluginNames.map(() => vi.fn() as Plugin);

      // Act
      pluginNames.forEach((name, index) => {
        registerPlugin(name, plugins[index]);
      });

      // Assert
      expect(getPlugins()).toEqual(expect.arrayContaining(pluginNames));
      expect(getPlugins()).toHaveLength(3);
      pluginNames.forEach(name => {
        expect(hasPlugin(name)).toBe(true);
      });
    });
  });

  describe('Plugin Unregistration', () => {
    it('should unregister existing plugin', () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const mockPlugin: Plugin = vi.fn();
      registerPlugin(pluginName, mockPlugin);

      // Act
      const result = unregisterPlugin(pluginName);

      // Assert
      expect(result).toBe(true);
      expect(hasPlugin(pluginName)).toBe(false);
      expect(getPlugins()).not.toContain(pluginName);
    });

    it('should return false when unregistering non-existent plugin', () => {
      // Arrange
      const nonExistentPlugin = faker.lorem.word();

      // Act
      const result = unregisterPlugin(nonExistentPlugin);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle multiple unregistrations safely', () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const mockPlugin: Plugin = vi.fn();
      registerPlugin(pluginName, mockPlugin);

      // Act
      const firstResult = unregisterPlugin(pluginName);
      const secondResult = unregisterPlugin(pluginName);

      // Assert
      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false);
    });
  });

  describe('Plugin Application', () => {
    it('should apply all registered plugins', async () => {
      // Arrange
      const plugin1 = vi.fn().mockResolvedValue(undefined);
      const plugin2 = vi.fn().mockResolvedValue(undefined);
      const plugin3 = vi.fn().mockResolvedValue(undefined);

      registerPlugin('plugin1', plugin1);
      registerPlugin('plugin2', plugin2);
      registerPlugin('plugin3', plugin3);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(plugin1).toHaveBeenCalledWith(mockHooks, mockCtx);
      expect(plugin2).toHaveBeenCalledWith(mockHooks, mockCtx);
      expect(plugin3).toHaveBeenCalledWith(mockHooks, mockCtx);
    });

    it('should add plugin names to context plugins set', async () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const mockPlugin: Plugin = vi.fn();
      registerPlugin(pluginName, mockPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect((mockCtx as any).plugins.has(pluginName)).toBe(true);
    });

    it('should handle plugins without context.plugins gracefully', async () => {
      // Arrange
      const pluginName = faker.lorem.word();
      const mockPlugin: Plugin = vi.fn();
      registerPlugin(pluginName, mockPlugin);

      const ctxWithoutPlugins = { ...mockCtx };
      delete (ctxWithoutPlugins as any).plugins;

      // Act & Assert - Should not throw
      await expect(applyPlugins(mockHooks, ctxWithoutPlugins))
        .resolves.not.toThrow();
    });

    it('should continue applying plugins even when one fails', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const failingPlugin: Plugin = vi.fn().mockRejectedValue(new Error(errorMessage));
      const successPlugin: Plugin = vi.fn().mockResolvedValue(undefined);

      registerPlugin('failing', failingPlugin);
      registerPlugin('success', successPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(failingPlugin).toHaveBeenCalled();
      expect(successPlugin).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to apply plugin "failing":',
        expect.any(Error)
      );
    });
  });

  describe('Plugin Query Functions', () => {
    it('should return correct plugin list', () => {
      // Arrange
      const pluginNames = Array.from({ length: 3 }, () => faker.lorem.word());
      pluginNames.forEach(name => {
        registerPlugin(name, vi.fn());
      });

      // Act
      const plugins = getPlugins();

      // Assert
      expect(plugins).toEqual(expect.arrayContaining(pluginNames));
      expect(plugins).toHaveLength(3);
    });

    it('should return empty list when no plugins registered', () => {
      // Act
      const plugins = getPlugins();

      // Assert
      expect(plugins).toEqual([]);
    });

    it('should correctly check plugin existence', () => {
      // Arrange
      const existingPlugin = faker.lorem.word();
      const nonExistentPlugin = faker.lorem.word();
      registerPlugin(existingPlugin, vi.fn());

      // Act & Assert
      expect(hasPlugin(existingPlugin)).toBe(true);
      expect(hasPlugin(nonExistentPlugin)).toBe(false);
    });
  });

  describe('Plugin Execution Order', () => {
    it('should execute plugins in registration order', async () => {
      // Arrange
      const executionOrder: string[] = [];
      const createPlugin = (name: string): Plugin => 
        async () => { executionOrder.push(name); };

      const pluginNames = ['first', 'second', 'third'];
      pluginNames.forEach(name => {
        registerPlugin(name, createPlugin(name));
      });

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(executionOrder).toEqual(pluginNames);
    });

    it('should handle async plugin execution correctly', async () => {
      // Arrange
      const delays = [50, 10, 30];
      const executionOrder: string[] = [];
      
      const createAsyncPlugin = (name: string, delay: number): Plugin =>
        async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          executionOrder.push(name);
        };

      delays.forEach((delay, index) => {
        registerPlugin(`plugin${index}`, createAsyncPlugin(`plugin${index}`, delay));
      });

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      // Plugins should execute in registration order, not completion order
      expect(executionOrder).toEqual(['plugin0', 'plugin1', 'plugin2']);
    });
  });

  describe('Real Plugin Examples', () => {
    it('should handle logging plugin correctly', async () => {
      // Arrange
      const logs: string[] = [];
      const loggingPlugin: Plugin = async (hooks, ctx) => {
        hooks.hook('cli:boot', ({ argv }) => {
          logs.push(`CLI started with args: ${argv.join(' ')}`);
        });
        
        hooks.hook('cli:done', () => {
          logs.push('CLI completed');
        });
      };

      registerPlugin('logging', loggingPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(mockHooks.hook).toHaveBeenCalledWith('cli:boot', expect.any(Function));
      expect(mockHooks.hook).toHaveBeenCalledWith('cli:done', expect.any(Function));
    });

    it('should handle metrics plugin correctly', async () => {
      // Arrange
      const metrics: Record<string, number> = {};
      const metricsPlugin: Plugin = async (hooks, ctx) => {
        let startTime: number;
        
        hooks.hook('cli:boot', () => {
          startTime = Date.now();
        });
        
        hooks.hook('cli:done', () => {
          metrics.executionTime = Date.now() - startTime;
          metrics.contextEnvCount = Object.keys(ctx.env).length;
        });
      };

      registerPlugin('metrics', metricsPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(mockHooks.hook).toHaveBeenCalledWith('cli:boot', expect.any(Function));
      expect(mockHooks.hook).toHaveBeenCalledWith('cli:done', expect.any(Function));
    });

    it('should handle file system plugin correctly', async () => {
      // Arrange
      const fileOperations: string[] = [];
      const fsPlugin: Plugin = async (hooks, ctx) => {
        // Simulate adding fs capabilities to context
        (ctx as any).fs = {
          read: async (path: string) => {
            fileOperations.push(`read: ${path}`);
            return 'file content';
          },
          write: async (path: string, data: string) => {
            fileOperations.push(`write: ${path}`);
          }
        };
        
        hooks.hook('persist:will', ({ out }) => {
          fileOperations.push(`persist: ${JSON.stringify(out)}`);
        });
      };

      registerPlugin('filesystem', fsPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect((mockCtx as any).fs).toBeDefined();
      expect((mockCtx as any).fs.read).toBeInstanceOf(Function);
      expect((mockCtx as any).fs.write).toBeInstanceOf(Function);
      expect(mockHooks.hook).toHaveBeenCalledWith('persist:will', expect.any(Function));
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary plugin names and counts', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 10 }),
        async (pluginNames) => {
          // Arrange
          const uniqueNames = [...new Set(pluginNames)]; // Remove duplicates
          const plugins = uniqueNames.map(() => vi.fn() as Plugin);
          
          // Act
          uniqueNames.forEach((name, index) => {
            registerPlugin(name, plugins[index]);
          });
          
          await applyPlugins(mockHooks, mockCtx);
          
          // Assert
          expect(getPlugins()).toEqual(expect.arrayContaining(uniqueNames));
          plugins.forEach(plugin => {
            expect(plugin).toHaveBeenCalledWith(mockHooks, mockCtx);
          });
        }
      ));
    });

    it('should maintain plugin registry invariants', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        async (operations) => {
          // Arrange
          const pluginName = operations[0];
          const mockPlugin: Plugin = vi.fn();
          
          // Act - Register and unregister
          registerPlugin(pluginName, mockPlugin);
          expect(hasPlugin(pluginName)).toBe(true);
          
          const unregisterResult = unregisterPlugin(pluginName);
          
          // Assert
          expect(unregisterResult).toBe(true);
          expect(hasPlugin(pluginName)).toBe(false);
          expect(getPlugins()).not.toContain(pluginName);
        }
      ));
    });
  });

  describe('Error Scenarios', () => {
    it('should handle plugin throwing synchronous errors', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const throwingPlugin: Plugin = () => {
        throw new Error(errorMessage);
      };

      registerPlugin('throwing', throwingPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to apply plugin "throwing":',
        expect.any(Error)
      );
    });

    it('should handle plugin throwing async errors', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const asyncThrowingPlugin: Plugin = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error(errorMessage);
      };

      registerPlugin('async-throwing', asyncThrowingPlugin);

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to apply plugin "async-throwing":',
        expect.any(Error)
      );
    });

    it('should handle plugin with invalid hook calls gracefully', async () => {
      // Arrange
      const invalidPlugin: Plugin = async (hooks) => {
        // Try to call non-existent hook
        (hooks as any).invalidMethod?.();
      };

      registerPlugin('invalid', invalidPlugin);

      // Act & Assert - Should not throw
      await expect(applyPlugins(mockHooks, mockCtx))
        .resolves.not.toThrow();
    });
  });

  describe('BDD-style Scenarios', () => {
    describe('Given a plugin system with multiple plugins', () => {
      describe('When plugins are registered and applied', () => {
        it('Then all plugins should be executed in order', async () => {
          // Given
          const executionLog: string[] = [];
          const createPlugin = (name: string): Plugin => async (hooks, ctx) => {
            executionLog.push(`${name}: started`);
            hooks.hook('cli:boot', () => {
              executionLog.push(`${name}: boot hook`);
            });
            executionLog.push(`${name}: completed`);
          };

          const pluginNames = ['auth', 'logging', 'metrics'];
          pluginNames.forEach(name => {
            registerPlugin(name, createPlugin(name));
          });

          // When
          await applyPlugins(mockHooks, mockCtx);

          // Then
          expect(executionLog).toEqual([
            'auth: started',
            'auth: completed',
            'logging: started', 
            'logging: completed',
            'metrics: started',
            'metrics: completed'
          ]);

          expect(mockHooks.hook).toHaveBeenCalledTimes(3);
        });
      });
    });

    describe('Given a plugin that fails during application', () => {
      describe('When plugins are applied', () => {
        it('Then other plugins should continue to execute', async () => {
          // Given
          const successfulPlugin: Plugin = vi.fn();
          const failingPlugin: Plugin = vi.fn().mockRejectedValue(new Error('Plugin failed'));
          const anotherSuccessfulPlugin: Plugin = vi.fn();

          registerPlugin('success1', successfulPlugin);
          registerPlugin('failing', failingPlugin);
          registerPlugin('success2', anotherSuccessfulPlugin);

          // When
          await applyPlugins(mockHooks, mockCtx);

          // Then
          expect(successfulPlugin).toHaveBeenCalled();
          expect(failingPlugin).toHaveBeenCalled();
          expect(anotherSuccessfulPlugin).toHaveBeenCalled();
          expect(mockConsoleError).toHaveBeenCalledWith(
            'Failed to apply plugin "failing":',
            expect.any(Error)
          );
        });
      });
    });

    describe('Given a plugin with context modifications', () => {
      describe('When the plugin is applied', () => {
        it('Then context should be properly extended', async () => {
          // Given
          const extensionPlugin: Plugin = async (hooks, ctx) => {
            (ctx as any).custom = {
              feature: 'enabled',
              timestamp: Date.now()
            };
          };

          registerPlugin('extension', extensionPlugin);

          // When
          await applyPlugins(mockHooks, mockCtx);

          // Then
          expect((mockCtx as any).custom).toBeDefined();
          expect((mockCtx as any).custom.feature).toBe('enabled');
          expect(typeof (mockCtx as any).custom.timestamp).toBe('number');
        });
      });
    });
  });

  describe('Integration with Plugin Context', () => {
    it('should track applied plugins in context', async () => {
      // Arrange
      const pluginNames = ['plugin1', 'plugin2', 'plugin3'];
      pluginNames.forEach(name => {
        registerPlugin(name, vi.fn());
      });

      // Act
      await applyPlugins(mockHooks, mockCtx);

      // Assert
      pluginNames.forEach(name => {
        expect((mockCtx as any).plugins.has(name)).toBe(true);
      });
    });

    it('should handle context without plugins property', async () => {
      // Arrange
      const simpleCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };
      
      registerPlugin('test', vi.fn());

      // Act & Assert - Should not throw
      await expect(applyPlugins(mockHooks, simpleCtx))
        .resolves.not.toThrow();
    });
  });
});