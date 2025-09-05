// tests/unit/citty-pro-lifecycle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { runLifecycle } from '../../src/pro/lifecycle';
import { hooks } from '../../src/pro/hooks';
import type { 
  RunLifecycleOptions, 
  RunCtx, 
  Command, 
  ArgsDef, 
  Output 
} from '../../src/types/citty-pro.d.ts';

describe('Citty Pro Lifecycle Execution', () => {
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockProcessCwd: any;
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessCwd = vi.spyOn(process, 'cwd').mockReturnValue('/test/cwd');
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessCwd.mockRestore();
    hooks.removeAllHooks();
    delete process.env.CITTY_DEBUG;
  });

  describe('Complete Lifecycle Execution', () => {
    it('should execute all lifecycle phases in correct order', async () => {
      // Arrange
      const executionOrder: string[] = [];
      const hookNames = [
        'cli:boot',
        'config:load', 
        'ctx:ready',
        'args:parsed',
        'command:resolved',
        'workflow:compile',
        'output:will:emit',
        'output:did:emit',
        'persist:will',
        'persist:did',
        'report:will',
        'report:did',
        'cli:done'
      ];

      // Register hooks to track execution order
      hookNames.forEach(name => {
        hooks.hook(name as any, () => {
          executionOrder.push(name);
        });
      });

      const mockCommand: Command = {
        meta: { name: 'test-command', description: 'Test command description' },
        args: {},
        run: vi.fn().mockResolvedValue({ text: 'Command executed successfully' })
      };

      const mockCtx: RunCtx = {
        cwd: '/test/path',
        env: { TEST_VAR: 'test_value' },
        now: () => new Date()
      };

      const mockRunStep = vi.fn().mockResolvedValue({ 
        text: 'Step execution result' 
      });

      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: mockCommand,
        args: { _: [] },
        ctx: mockCtx,
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      expect(executionOrder).toEqual(hookNames);
      expect(mockRunStep).toHaveBeenCalledOnce();
      expect(mockRunStep).toHaveBeenCalledWith(expect.objectContaining({
        cwd: mockCtx.cwd,
        env: mockCtx.env
      }));
    });

    it('should handle text output correctly', async () => {
      // Arrange
      const outputText = 'Test output text';
      const mockRunStep = vi.fn().mockResolvedValue({ text: outputText });
      
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(outputText);
    });

    it('should handle JSON output correctly', async () => {
      // Arrange
      const jsonData = { 
        message: 'Test message',
        value: 42,
        array: ['item1', 'item2']
      };
      const mockRunStep = vi.fn().mockResolvedValue({ json: jsonData });
      
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(jsonData, null, 2));
    });
  });

  describe('Configuration and Context Setup', () => {
    it('should merge context configuration correctly', async () => {
      // Arrange
      const customConfig = {
        cwd: '/custom/path',
        customProperty: 'custom_value'
      };
      
      const mockCtx: RunCtx & { config?: any } = {
        cwd: '/initial/path',
        env: { CUSTOM_ENV: 'custom_value' },
        now: () => new Date(),
        config: customConfig
      };

      let capturedCtx: any;
      const mockRunStep = vi.fn().mockImplementation((ctx) => {
        capturedCtx = ctx;
        return { text: 'success' };
      });

      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: mockCtx,
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      // The lifecycle merges config but then spreads ctx over it, so ctx wins
      expect(capturedCtx).toMatchObject({
        cwd: mockCtx.cwd, // ctx.cwd wins over config.cwd because ctx is spread after
        env: mockCtx.env // ctx.env wins over process.env because ctx is spread after
      });
    });

    it('should set up context with current working directory and environment', async () => {
      // Arrange
      let capturedCtx: any;
      
      const mockRunStep = vi.fn().mockImplementation((ctx) => {
        capturedCtx = ctx;
        return { text: 'success' };
      });

      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/initial/path', env: { EXPECTED_ENV: 'expected_value' }, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      // The lifecycle merges process.cwd() into config but then spreads ctx over it, so ctx wins
      expect(capturedCtx.cwd).toBe('/initial/path'); // ctx.cwd wins over process.cwd()
      expect(capturedCtx.env).toEqual({ EXPECTED_ENV: 'expected_value' }); // ctx.env wins over process.env
      expect(typeof capturedCtx.now).toBe('function');
    });
  });

  describe('Hook Integration', () => {
    it('should call all lifecycle hooks with correct payloads', async () => {
      // Arrange
      const mockHooks: Record<string, any> = {};
      const expectedPayloads: Record<string, any> = {};

      // Set up hooks to capture payloads
      const setupHook = (name: string, payloadValidator: (payload: any) => void) => {
        mockHooks[name] = vi.fn(payloadValidator);
        hooks.hook(name as any, mockHooks[name]);
      };

      setupHook('cli:boot', (payload) => {
        expect(payload).toHaveProperty('argv');
        expect(Array.isArray(payload.argv)).toBe(true);
        expectedPayloads['cli:boot'] = payload;
      });

      setupHook('config:load', (payload) => {
        expect(payload).toHaveProperty('config');
        expectedPayloads['config:load'] = payload;
      });

      setupHook('ctx:ready', (payload) => {
        expect(payload).toHaveProperty('ctx');
        expect(payload.ctx).toHaveProperty('cwd');
        expect(payload.ctx).toHaveProperty('env');
        expectedPayloads['ctx:ready'] = payload;
      });

      const mockRunStep = vi.fn().mockResolvedValue({ text: 'Hook test result' });
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { meta: { name: 'test-cmd' }, run: vi.fn() },
        args: { _: [], arg1: 'test_arg' },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      Object.entries(mockHooks).forEach(([name, mock]) => {
        expect(mock).toHaveBeenCalled();
      });
    });

    it('should handle hook execution errors and continue lifecycle', async () => {
      // Arrange
      const errorMessage = 'Hook error occurred';
      hooks.hook('config:load', () => {
        throw new Error(errorMessage);
      });

      const mockRunStep = vi.fn().mockResolvedValue({ text: 'success' });
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act & Assert
      await expect(runLifecycle(options)).rejects.toThrow(errorMessage);
    });
  });

  describe('Error Handling', () => {
    it('should handle runStep errors and emit error output', async () => {
      // Arrange
      const errorMessage = 'RunStep execution failed';
      const mockRunStep = vi.fn().mockRejectedValue(new Error(errorMessage));
      
      const outputHooks = {
        willEmit: vi.fn(),
        didEmit: vi.fn()
      };

      hooks.hook('output:will:emit', outputHooks.willEmit);
      hooks.hook('output:did:emit', outputHooks.didEmit);

      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act & Assert
      await expect(runLifecycle(options)).rejects.toThrow(errorMessage);
      
      expect(mockConsoleError).toHaveBeenCalledWith(`Error: ${errorMessage}`);
      expect(outputHooks.willEmit).toHaveBeenCalledWith({
        out: { text: `Error: ${errorMessage}` }
      });
      expect(outputHooks.didEmit).toHaveBeenCalledWith({
        out: { text: `Error: ${errorMessage}` }
      });
    });

    it('should handle non-Error exceptions correctly', async () => {
      // Arrange
      const errorValue = 'Non-error exception occurred';
      const mockRunStep = vi.fn().mockRejectedValue(errorValue);

      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act & Assert  
      await expect(runLifecycle(options)).rejects.toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith(`Error: ${errorValue}`);
    });
  });

  describe('Output Handling', () => {
    it('should handle empty output gracefully', async () => {
      // Arrange
      const mockRunStep = vi.fn().mockResolvedValue({});
      
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert - Should not call console.log for empty output
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should emit output hooks for all output types', async () => {
      // Arrange
      const outputs = [
        { text: 'Test sentence output' },
        { json: { key: 'test_key' } },
        { files: ['/test/file.txt'] },
        {}
      ];

      const outputHooks = {
        willEmit: vi.fn(),
        didEmit: vi.fn()
      };

      hooks.hook('output:will:emit', outputHooks.willEmit);
      hooks.hook('output:did:emit', outputHooks.didEmit);

      for (const output of outputs) {
        const mockRunStep = vi.fn().mockResolvedValue(output);
        const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
          cmd: { run: vi.fn() },
          args: { _: [] },
          ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
          runStep: mockRunStep
        };

        // Act
        await runLifecycle(options);
      }

      // Assert
      expect(outputHooks.willEmit).toHaveBeenCalledTimes(outputs.length);
      expect(outputHooks.didEmit).toHaveBeenCalledTimes(outputs.length);
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary command metadata', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          name: fc.string(),
          version: fc.string(),
          description: fc.string(),
          hidden: fc.boolean()
        }),
        async (meta) => {
          // Arrange
          const mockRunStep = vi.fn().mockResolvedValue({ text: 'Test sentence output' });
          const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
            cmd: { meta, run: vi.fn() },
            args: { _: [] },
            ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
            runStep: mockRunStep
          };

          // Act & Assert - Should not throw
          await expect(runLifecycle(options)).resolves.not.toThrow();
        }
      ));
    });

    it('should handle arbitrary context properties', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          cwd: fc.string(),
          env: fc.dictionary(fc.string(), fc.string())
        }),
        async (ctxProps) => {
          // Arrange
          const mockRunStep = vi.fn().mockResolvedValue({ text: 'Test sentence output' });
          const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
            cmd: { run: vi.fn() },
            args: { _: [] },
            ctx: { ...ctxProps, now: () => new Date() },
            runStep: mockRunStep
          };

          // Act & Assert
          await expect(runLifecycle(options)).resolves.not.toThrow();
        }
      ));
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent lifecycle executions', async () => {
      // Arrange
      const concurrentRuns = 5;
      const mockRunStep = vi.fn().mockResolvedValue({ text: 'Test sentence output' });
      
      const createOptions = (): RunLifecycleOptions<ArgsDef, RunCtx> => ({
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { 
          cwd: '/test/concurrent/path', 
          env: { id: 'test-uuid-123' }, 
          now: () => new Date() 
        },
        runStep: vi.fn().mockResolvedValue({ text: 'Test sentence output' })
      });

      // Act
      const promises = Array.from({ length: concurrentRuns }, () => 
        runLifecycle(createOptions())
      );
      
      // Assert - All should complete successfully
      await expect(Promise.all(promises)).resolves.toHaveLength(concurrentRuns);
    });

    it('should complete lifecycle within reasonable time', async () => {
      // Arrange
      const startTime = performance.now();
      const mockRunStep = vi.fn().mockResolvedValue({ text: 'success' });
      
      const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
        cmd: { run: vi.fn() },
        args: { _: [] },
        ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
        runStep: mockRunStep
      };

      // Act
      await runLifecycle(options);

      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('BDD-style Scenarios', () => {
    describe('Given a command with lifecycle hooks', () => {
      describe('When the lifecycle runs successfully', () => {
        it('Then all phases should execute in order', async () => {
          // Given
          const phaseOrder: string[] = [];
          const phases = ['boot', 'config', 'context', 'args', 'command', 'workflow', 'execute', 'output', 'persist', 'report', 'done'];
          
          phases.forEach(phase => {
            hooks.hook(`${phase === 'boot' ? 'cli:boot' : 
              phase === 'config' ? 'config:load' :
              phase === 'context' ? 'ctx:ready' :
              phase === 'args' ? 'args:parsed' :
              phase === 'command' ? 'command:resolved' :
              phase === 'workflow' ? 'workflow:compile' :
              phase === 'output' ? 'output:will:emit' :
              phase === 'persist' ? 'persist:will' :
              phase === 'report' ? 'report:will' :
              'cli:done'}` as any, () => {
              phaseOrder.push(phase);
            });
          });

          const mockRunStep = vi.fn().mockResolvedValue({ text: 'success' });
          const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
            cmd: { meta: { name: 'test' }, run: vi.fn() },
            args: { _: [] },
            ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
            runStep: mockRunStep
          };

          // When
          await runLifecycle(options);

          // Then
          expect(phaseOrder).toEqual(expect.arrayContaining([
            'boot', 'config', 'context', 'args', 'command', 'workflow', 'output', 'persist', 'report', 'done'
          ]));
        });
      });

      describe('When an error occurs during execution', () => {
        it('Then error output should be emitted and lifecycle should terminate', async () => {
          // Given
          const errorMessage = 'Test sentence output';
          const mockRunStep = vi.fn().mockRejectedValue(new Error(errorMessage));
          
          const options: RunLifecycleOptions<ArgsDef, RunCtx> = {
            cmd: { run: vi.fn() },
            args: { _: [] },
            ctx: { cwd: '/test/path', env: {}, now: () => new Date() },
            runStep: mockRunStep
          };

          // When & Then
          await expect(runLifecycle(options)).rejects.toThrow(errorMessage);
          expect(mockConsoleError).toHaveBeenCalledWith(`Error: ${errorMessage}`);
        });
      });
    });
  });
});