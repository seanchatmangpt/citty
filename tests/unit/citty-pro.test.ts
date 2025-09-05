// London-style BDD tests for Citty Pro Framework
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod';
import {
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle
} from '../../src/pro';
import { hooks } from '../../src/pro/hooks';
import type { RunCtx, Task, Workflow } from '../../src/types/citty-pro';

// Test doubles and mocks
class MockContext implements RunCtx {
  cwd = '/test';
  env = { NODE_ENV: 'test' };
  now = () => new Date('2025-01-01T00:00:00Z');
  memo = {};
  
  ai = {
    model: { id: 'test-model', vendor: 'local' as const },
    generate: vi.fn().mockResolvedValue({
      text: 'Mocked AI response',
      toolCalls: []
    })
  };
  
  otel = {
    span: vi.fn(async (name, fn) => fn()),
    counter: vi.fn(() => ({ add: vi.fn() }))
  };
  
  fs = {
    read: vi.fn().mockResolvedValue('file content'),
    write: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true)
  };
}

describe('Citty Pro Framework - London BDD', () => {
  let mockContext: MockContext;
  let hookSpy: Mock;

  beforeEach(() => {
    mockContext = new MockContext();
    hookSpy = vi.spyOn(hooks, 'callHook');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Task Definition and Execution', () => {
    describe('Given a task with validation', () => {
      const inputSchema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });
      
      const outputSchema = z.object({
        greeting: z.string()
      });
      
      const greetTask = defineTask({
        id: 'greet',
        in: inputSchema,
        out: outputSchema,
        run: async (input) => ({
          greeting: `Hello ${input.name}, age ${input.age}!`
        })
      });

      describe('When called with valid input', () => {
        it('Then should execute successfully and trigger hooks', async () => {
          const result = await greetTask.call(
            { name: 'Alice', age: 30 },
            mockContext
          );

          expect(result).toEqual({
            greeting: 'Hello Alice, age 30!'
          });
          
          expect(hookSpy).toHaveBeenCalledWith('task:will:call', {
            id: 'greet',
            input: { name: 'Alice', age: 30 }
          });
          
          expect(hookSpy).toHaveBeenCalledWith('task:did:call', {
            id: 'greet',
            res: expect.objectContaining({
              greeting: 'Hello Alice, age 30!'
            })
          });
        });
      });

      describe('When called with invalid input', () => {
        it('Then should throw validation error', async () => {
          await expect(
            greetTask.call({ name: 'Bob', age: -5 }, mockContext)
          ).rejects.toThrow('Task greet input validation failed');
        });
      });
    });

    describe('Given a simple task without validation', () => {
      const simpleTask = defineTask({
        id: 'simple',
        run: async (input: string) => `Processed: ${input}`
      });

      describe('When executed', () => {
        it('Then should process input and return output', async () => {
          const result = await simpleTask.call('test input', mockContext);
          expect(result).toBe('Processed: test input');
        });
      });
    });
  });

  describe('Workflow Definition and Execution', () => {
    describe('Given a workflow with multiple tasks', () => {
      const fetchTask = defineTask({
        id: 'fetch',
        run: async () => ({ data: [1, 2, 3] })
      });

      const transformTask = defineTask({
        id: 'transform',
        run: async (input: { data: number[] }) => ({
          sum: input.data.reduce((a, b) => a + b, 0)
        })
      });

      const workflow = defineWorkflow({
        id: 'data-pipeline',
        seed: { initialized: true },
        steps: [
          { id: 'fetch', use: fetchTask },
          { 
            id: 'transform', 
            use: transformTask,
            select: (state) => state.fetch,
            as: 'result'
          }
        ]
      });

      describe('When executed', () => {
        it('Then should execute tasks in sequence and accumulate state', async () => {
          const result = await workflow.run(mockContext);

          expect(result).toEqual({
            initialized: true,
            fetch: { data: [1, 2, 3] },
            result: { sum: 6 }
          });

          expect(hookSpy).toHaveBeenCalledWith('task:will:call', {
            id: 'fetch',
            input: { initialized: true }
          });

          expect(hookSpy).toHaveBeenCalledWith('task:will:call', {
            id: 'transform',
            input: { data: [1, 2, 3] }
          });
        });
      });
    });

    describe('Given a workflow with function steps', () => {
      const workflow = defineWorkflow({
        id: 'function-workflow',
        steps: [
          {
            id: 'step1',
            use: async (input, ctx) => ({ processed: true })
          },
          {
            id: 'step2',
            use: async (input, ctx) => ({ finalized: true }),
            select: (state) => state.step1
          }
        ]
      });

      describe('When executed', () => {
        it('Then should handle function steps correctly', async () => {
          const result = await workflow.run(mockContext);
          
          expect(result).toEqual({
            step1: { processed: true },
            step2: { finalized: true }
          });
        });
      });
    });
  });

  describe('AI Wrapper Command', () => {
    describe('Given an AI wrapper command with tools', () => {
      const mockTool = {
        description: 'Test tool',
        schema: z.object({ query: z.string() }),
        execute: vi.fn().mockResolvedValue({ result: 'tool output' })
      };

      const aiCommand = defineAIWrapperCommand({
        meta: { name: 'ai-analyze' },
        args: {
          input: { type: 'string' as const, required: true }
        },
        ai: {
          model: { id: 'gpt-4', vendor: 'openai' },
          tools: { search: mockTool },
          system: 'You are a helpful assistant'
        },
        plan: (args, ctx) => `Analyze: ${args.input}`,
        onToolCall: vi.fn(),
        run: async (args, ctx) => ({
          text: `Analysis of ${args.input}`
        })
      });

      describe('When executed', () => {
        it('Then should generate plan and handle AI interactions', async () => {
          const result = await aiCommand.run({
            args: { input: 'test data', _: [] },
            ctx: mockContext,
            cmd: aiCommand,
            rawArgs: ['--input', 'test data']
          });

          expect(result).toEqual({
            text: 'Analysis of test data'
          });
        });
      });
    });
  });

  describe('Lifecycle Management', () => {
    describe('Given a command with lifecycle', () => {
      const testCommand = {
        meta: { name: 'test-cmd', version: '1.0.0' },
        args: {},
        run: vi.fn()
      };

      describe('When lifecycle is executed', () => {
        it('Then should trigger all hooks in correct order', async () => {
          const runStep = vi.fn().mockResolvedValue({
            text: 'Command output'
          });

          await runLifecycle({
            cmd: testCommand,
            args: { _: [] },
            ctx: mockContext,
            runStep
          });

          const calls = hookSpy.mock.calls.map(call => call[0]);
          
          expect(calls).toEqual([
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
          ]);
        });
      });

      describe('When lifecycle encounters an error', () => {
        it('Then should handle error gracefully', async () => {
          const runStep = vi.fn().mockRejectedValue(new Error('Test error'));
          
          await expect(
            runLifecycle({
              cmd: testCommand,
              args: { _: [] },
              ctx: mockContext,
              runStep
            })
          ).rejects.toThrow('Test error');
          
          expect(hookSpy).toHaveBeenCalledWith('output:will:emit', {
            out: { text: 'Error: Test error' }
          });
        });
      });
    });
  });

  describe('Hook System', () => {
    describe('Given hooks are registered', () => {
      it('Then should allow hook registration and execution', async () => {
        const mockHandler = vi.fn();
        const unhook = hooks.hook('cli:boot', mockHandler);

        await hooks.callHook('cli:boot', { argv: ['test'] });
        
        expect(mockHandler).toHaveBeenCalledWith({ argv: ['test'] });
        
        unhook();
        
        await hooks.callHook('cli:boot', { argv: ['test2'] });
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Context Integration', () => {
    describe('Given a context with capabilities', () => {
      it('Then should provide AI capabilities', async () => {
        expect(mockContext.ai).toBeDefined();
        
        const result = await mockContext.ai!.generate({
          prompt: 'Test prompt',
          tools: {},
          system: 'Test system'
        });
        
        expect(result.text).toBe('Mocked AI response');
      });

      it('Then should provide OTEL capabilities', async () => {
        expect(mockContext.otel).toBeDefined();
        
        const spanResult = await mockContext.otel!.span('test-span', () => 42);
        expect(spanResult).toBe(42);
        
        const counter = mockContext.otel!.counter!('test-counter');
        counter.add(1);
        
        expect(counter.add).toHaveBeenCalledWith(1);
      });

      it('Then should provide filesystem capabilities', async () => {
        expect(mockContext.fs).toBeDefined();
        
        const content = await mockContext.fs!.read('test.txt');
        expect(content).toBe('file content');
        
        await mockContext.fs!.write('output.txt', 'test data');
        expect(mockContext.fs!.write).toHaveBeenCalledWith('output.txt', 'test data');
        
        const exists = await mockContext.fs!.exists('check.txt');
        expect(exists).toBe(true);
      });
    });
  });
});