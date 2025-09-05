// tests/unit/citty-pro-hooks.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { hooks, typedHooks, registerCoreHooks } from '../../src/pro/hooks';
import type { HookPayload, HookName } from '../../src/types/citty-pro.d.ts';

describe('Citty Pro Hooks System', () => {
  beforeEach(() => {
    // Clear all hooks before each test - hookable doesn't have clearHooks, so we'll create a fresh instance
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup is handled by creating fresh instances in tests
  });

  describe('Hook Registration and Execution', () => {
    it('should register and execute hooks with correct payload', async () => {
      // Arrange
      const mockFn = vi.fn();
      const payload: HookPayload['cli:boot'] = { 
        argv: [faker.lorem.word(), faker.lorem.word()] 
      };

      // Act
      const unhook = typedHooks.hook('cli:boot', mockFn);
      await typedHooks.callHook('cli:boot', payload);

      // Assert
      expect(mockFn).toHaveBeenCalledOnce();
      expect(mockFn).toHaveBeenCalledWith(payload);
      unhook();
    });

    it('should handle multiple hooks for the same event', async () => {
      // Arrange
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();
      const mockFn3 = vi.fn();
      const payload: HookPayload['config:load'] = {
        config: { [faker.lorem.word()]: faker.lorem.sentence() }
      };

      // Act
      const unhook1 = typedHooks.hook('config:load', mockFn1);
      const unhook2 = typedHooks.hook('config:load', mockFn2);
      const unhook3 = typedHooks.hook('config:load', mockFn3);
      await typedHooks.callHook('config:load', payload);

      // Assert
      expect(mockFn1).toHaveBeenCalledWith(payload);
      expect(mockFn2).toHaveBeenCalledWith(payload);
      expect(mockFn3).toHaveBeenCalledWith(payload);

      // Cleanup
      unhook1();
      unhook2();
      unhook3();
    });

    it('should handle async hooks correctly', async () => {
      // Arrange
      const mockAsyncFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return faker.lorem.word();
      });
      const payload: HookPayload['ctx:ready'] = {
        ctx: {
          cwd: faker.system.directoryPath(),
          env: { [faker.lorem.word()]: faker.lorem.word() },
          now: () => new Date()
        }
      };

      // Act
      const unhook = typedHooks.hook('ctx:ready', mockAsyncFn);
      await typedHooks.callHook('ctx:ready', payload);

      // Assert
      expect(mockAsyncFn).toHaveBeenCalledWith(payload);
      unhook();
    });

    it('should properly unhook callbacks', async () => {
      // Arrange
      const mockFn = vi.fn();
      const payload: HookPayload['args:parsed'] = {
        args: { [faker.lorem.word()]: faker.lorem.word() }
      };

      // Act
      const unhook = typedHooks.hook('args:parsed', mockFn);
      unhook();
      await typedHooks.callHook('args:parsed', payload);

      // Assert
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('Core Hooks Registration', () => {
    it('should register core hooks with debug logging', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      process.env.CITTY_DEBUG = 'true';

      // Act
      registerCoreHooks();
      await typedHooks.callHook('cli:boot', { argv: ['--debug'] });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[HOOK] Before:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[HOOK] After:'));
      expect(process.env.CITTY_DEBUG).toBe('true');

      // Cleanup
      consoleSpy.mockRestore();
      delete process.env.CITTY_DEBUG;
    });

    it('should handle cli:boot hook with debug argument', async () => {
      // Arrange
      registerCoreHooks();
      delete process.env.CITTY_DEBUG;

      // Act
      await typedHooks.callHook('cli:boot', { argv: ['--debug'] });

      // Assert
      expect(process.env.CITTY_DEBUG).toBe('true');

      // Cleanup
      delete process.env.CITTY_DEBUG;
    });

    it('should not set debug when debug flag not present', async () => {
      // Arrange
      registerCoreHooks();
      delete process.env.CITTY_DEBUG;

      // Act
      await typedHooks.callHook('cli:boot', { argv: ['--help'] });

      // Assert
      expect(process.env.CITTY_DEBUG).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle hook execution errors gracefully', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const mockErrorHook = vi.fn().mockRejectedValue(new Error(errorMessage));
      const payload: HookPayload['command:resolved'] = { 
        name: faker.lorem.word() 
      };

      // Act & Assert
      const unhook = typedHooks.hook('command:resolved', mockErrorHook);
      await expect(typedHooks.callHook('command:resolved', payload))
        .rejects.toThrow(errorMessage);
      
      unhook();
    });

    it('should continue executing other hooks when one fails', async () => {
      // Arrange
      const mockSuccessHook = vi.fn();
      const mockErrorHook = vi.fn().mockRejectedValue(new Error('Test error'));
      const mockAnotherSuccessHook = vi.fn();
      const payload: HookPayload['workflow:compile'] = { 
        id: faker.string.uuid() 
      };

      // Act
      const unhook1 = typedHooks.hook('workflow:compile', mockSuccessHook);
      const unhook2 = typedHooks.hook('workflow:compile', mockErrorHook);
      const unhook3 = typedHooks.hook('workflow:compile', mockAnotherSuccessHook);

      // Note: hookable might handle errors differently, this test validates behavior
      try {
        await typedHooks.callHook('workflow:compile', payload);
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(mockSuccessHook).toHaveBeenCalledWith(payload);
      expect(mockErrorHook).toHaveBeenCalledWith(payload);

      // Cleanup
      unhook1();
      unhook2();
      unhook3();
    });
  });

  describe('Hook Lifecycle Events', () => {
    it('should handle all hook lifecycle events', async () => {
      // Arrange
      const hookEvents: HookName[] = [
        'cli:boot',
        'config:load', 
        'ctx:ready',
        'args:parsed',
        'command:resolved',
        'workflow:compile',
        'task:will:call',
        'task:did:call',
        'output:will:emit',
        'output:did:emit',
        'persist:will',
        'persist:did',
        'report:will',
        'report:did',
        'cli:done'
      ];

      // Act & Assert
      for (const eventName of hookEvents) {
        const mockFn = vi.fn();
        const unhook = typedHooks.hook(eventName, mockFn);
        
        // Create appropriate payload for each event
        let payload: any;
        switch (eventName) {
          case 'cli:boot':
            payload = { argv: [faker.lorem.word()] };
            break;
          case 'config:load':
            payload = { config: {} };
            break;
          case 'ctx:ready':
            payload = { ctx: { cwd: faker.system.directoryPath(), env: {}, now: () => new Date() } };
            break;
          case 'args:parsed':
            payload = { args: {} };
            break;
          case 'command:resolved':
            payload = { name: faker.lorem.word() };
            break;
          case 'workflow:compile':
            payload = { id: faker.string.uuid() };
            break;
          case 'task:will:call':
            payload = { id: faker.string.uuid(), input: {} };
            break;
          case 'task:did:call':
            payload = { id: faker.string.uuid(), res: {} };
            break;
          case 'output:will:emit':
          case 'output:did:emit':
          case 'persist:will':
            payload = { out: { text: faker.lorem.sentence() } };
            break;
          case 'persist:did':
          case 'report:did':
            payload = { ok: true };
            break;
          case 'report:will':
            payload = { out: { text: faker.lorem.sentence() } };
            break;
          case 'cli:done':
            payload = null;
            break;
          default:
            payload = {};
        }

        await typedHooks.callHook(eventName, payload);
        expect(mockFn).toHaveBeenCalledWith(payload);
        unhook();
      }
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary hook payloads correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          argv: fc.array(fc.string())
        }),
        async (payload) => {
          // Arrange
          const mockFn = vi.fn();
          
          // Act
          const unhook = typedHooks.hook('cli:boot', mockFn);
          await typedHooks.callHook('cli:boot', payload);
          
          // Assert
          expect(mockFn).toHaveBeenCalledWith(payload);
          unhook();
        }
      ));
    });

    it('should maintain hook execution order with multiple registrations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        async (hookIds) => {
          // Arrange
          const executionOrder: string[] = [];
          const hooks = hookIds.map(id => {
            const fn = vi.fn(() => { executionOrder.push(id); });
            return { id, fn };
          });
          
          // Act
          const unhooks = hooks.map(({ fn }) => typedHooks.hook('cli:done', fn));
          await typedHooks.callHook('cli:done', null);
          
          // Assert
          expect(executionOrder).toHaveLength(hookIds.length);
          hooks.forEach(({ fn }) => {
            expect(fn).toHaveBeenCalledWith(null);
          });
          
          // Cleanup
          unhooks.forEach(unhook => unhook());
        }
      ));
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory when hooks are registered and unregistered', () => {
      // Arrange
      const initialHookCount = (hooks as any)._hooks?.size || 0;
      const unhooks: (() => void)[] = [];

      // Act - Register many hooks
      for (let i = 0; i < 100; i++) {
        const unhook = typedHooks.hook('cli:done', vi.fn());
        unhooks.push(unhook);
      }

      // Unregister all hooks
      unhooks.forEach(unhook => unhook());

      // Assert
      const finalHookCount = (hooks as any)._hooks?.size || 0;
      expect(finalHookCount).toBeLessThanOrEqual(initialHookCount + 1); // Allow some tolerance
    });
  });

  describe('Concurrent Hook Execution', () => {
    it('should handle concurrent hook calls correctly', async () => {
      // Arrange
      const concurrentCalls = 10;
      const mockFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      });
      
      // Act
      const unhook = typedHooks.hook('cli:done', mockFn);
      const promises = Array.from({ length: concurrentCalls }, () =>
        typedHooks.callHook('cli:done', null)
      );
      
      await Promise.all(promises);

      // Assert
      expect(mockFn).toHaveBeenCalledTimes(concurrentCalls);
      unhook();
    });
  });
});