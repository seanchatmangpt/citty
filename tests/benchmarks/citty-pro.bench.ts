// Performance benchmarks for Citty Pro Framework
import { bench, describe } from 'vitest';
import { 
  defineTask, 
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle 
} from '../../src/pro';
import { hooks } from '../../src/pro/hooks';
import { createDefaultContext } from '../../src/pro/context';
import { z } from 'zod';
import type { RunCtx } from '../../src/types/citty-pro';

describe('Citty Pro Performance Benchmarks', () => {
  
  describe('Task Execution Performance', () => {
    const simpleTask = defineTask({
      id: 'simple',
      run: async (input: number) => input * 2
    });

    const validatedTask = defineTask({
      id: 'validated',
      in: z.number().min(0).max(1000),
      out: z.number(),
      run: async (input) => input * 2
    });

    const ctx = createDefaultContext();

    bench('Simple task execution (no validation)', async () => {
      await simpleTask.call(42, ctx);
    });

    bench('Task with Zod validation', async () => {
      await validatedTask.call(42, ctx);
    });

    bench('Task with hooks', async () => {
      const hookCount = { count: 0 };
      const unhook1 = hooks.hook('task:will:call', () => { hookCount.count++; });
      const unhook2 = hooks.hook('task:did:call', () => { hookCount.count++; });
      
      await simpleTask.call(42, ctx);
      
      unhook1();
      unhook2();
    });
  });

  describe('Workflow Performance', () => {
    const ctx = createDefaultContext();

    // Small workflow (3 tasks)
    const smallWorkflow = defineWorkflow({
      id: 'small',
      steps: [
        { id: 'step1', use: async (input) => ({ a: 1 }) },
        { id: 'step2', use: async (input) => ({ b: 2 }) },
        { id: 'step3', use: async (input) => ({ c: 3 }) }
      ]
    });

    // Medium workflow (10 tasks)
    const mediumWorkflow = defineWorkflow({
      id: 'medium',
      steps: Array.from({ length: 10 }, (_, i) => ({
        id: `step${i}`,
        use: async (input: any) => ({ [`result${i}`]: i * 2 })
      }))
    });

    // Large workflow (50 tasks)
    const largeWorkflow = defineWorkflow({
      id: 'large',
      steps: Array.from({ length: 50 }, (_, i) => ({
        id: `step${i}`,
        use: async (input: any) => ({ [`result${i}`]: i * 2 })
      }))
    });

    bench('Small workflow (3 tasks)', async () => {
      await smallWorkflow.run(ctx);
    });

    bench('Medium workflow (10 tasks)', async () => {
      await mediumWorkflow.run(ctx);
    });

    bench('Large workflow (50 tasks)', async () => {
      await largeWorkflow.run(ctx);
    });

    // Workflow with data transformation
    const transformWorkflow = defineWorkflow({
      id: 'transform',
      seed: { data: Array.from({ length: 100 }, (_, i) => i) },
      steps: [
        {
          id: 'filter',
          use: async (input: any) => ({
            filtered: input.data.filter((n: number) => n % 2 === 0)
          })
        },
        {
          id: 'map',
          use: async (input: any) => ({
            mapped: input.filtered.map((n: number) => n * 2)
          }),
          select: (state) => state.filter
        },
        {
          id: 'reduce',
          use: async (input: any) => ({
            sum: input.mapped.reduce((a: number, b: number) => a + b, 0)
          }),
          select: (state) => state.map
        }
      ]
    });

    bench('Workflow with data transformation', async () => {
      await transformWorkflow.run(ctx);
    });
  });

  describe('Lifecycle Performance', () => {
    const testCommand = {
      meta: { name: 'bench-cmd', version: '1.0.0' },
      args: {},
      run: async () => {}
    };

    bench('Full lifecycle execution', async () => {
      const ctx = createDefaultContext();
      await runLifecycle({
        cmd: testCommand,
        args: { _: [] },
        ctx,
        runStep: async () => ({ text: 'done' })
      });
    });

    bench('Lifecycle with multiple hooks', async () => {
      const ctx = createDefaultContext();
      const unhooks: (() => void)[] = [];
      
      // Register 10 hooks per event
      ['cli:boot', 'ctx:ready', 'output:will:emit', 'cli:done'].forEach(event => {
        for (let i = 0; i < 10; i++) {
          unhooks.push(hooks.hook(event as any, () => {}));
        }
      });

      await runLifecycle({
        cmd: testCommand,
        args: { _: [] },
        ctx,
        runStep: async () => ({ text: 'done' })
      });

      unhooks.forEach(unhook => unhook());
    });
  });

  describe('AI Wrapper Performance', () => {
    const ctx = createDefaultContext();
    
    // Mock AI for benchmarking
    ctx.ai = {
      model: { id: 'bench-model', vendor: 'local' },
      generate: async ({ prompt }) => ({
        text: `Response for: ${prompt}`,
        toolCalls: []
      })
    };

    const simpleAICommand = defineAIWrapperCommand({
      meta: { name: 'ai-bench' },
      args: {},
      ai: {
        model: { id: 'bench', vendor: 'local' }
      },
      run: async () => ({ text: 'done' })
    });

    const complexAICommand = defineAIWrapperCommand({
      meta: { name: 'ai-bench-complex' },
      args: {},
      ai: {
        model: { id: 'bench', vendor: 'local' },
        tools: {
          tool1: {
            schema: z.object({ query: z.string() }),
            execute: async () => ({ result: 'data' })
          },
          tool2: {
            schema: z.object({ value: z.number() }),
            execute: async () => ({ result: 42 })
          }
        }
      },
      plan: () => 'Complex analysis plan',
      onToolCall: async () => {},
      run: async () => ({ text: 'done' })
    });

    bench('Simple AI command', async () => {
      await simpleAICommand.run({
        rawArgs: [],
        args: { _: [] },
        cmd: simpleAICommand,
        ctx
      });
    });

    bench('Complex AI command with tools', async () => {
      await complexAICommand.run({
        rawArgs: [],
        args: { _: [] },
        cmd: complexAICommand,
        ctx
      });
    });
  });

  describe('Context Operations', () => {
    bench('Context creation', () => {
      createDefaultContext();
    });

    bench('Context with memo operations', () => {
      const ctx = createDefaultContext();
      for (let i = 0; i < 100; i++) {
        ctx.memo![`key${i}`] = `value${i}`;
      }
    });

    bench('Context with state map operations', () => {
      const ctx = createDefaultContext();
      if (!ctx.state) ctx.state = new Map();
      for (let i = 0; i < 100; i++) {
        ctx.state.set(`key${i}`, `value${i}`);
      }
      for (let i = 0; i < 100; i++) {
        ctx.state.get(`key${i}`);
      }
    });
  });

  describe('Hook System Performance', () => {
    bench('Hook registration and unregistration', () => {
      const unhooks: (() => void)[] = [];
      for (let i = 0; i < 100; i++) {
        unhooks.push(hooks.hook('cli:boot', () => {}));
      }
      unhooks.forEach(unhook => unhook());
    });

    bench('Hook execution (single handler)', async () => {
      const unhook = hooks.hook('cli:boot', () => {});
      await hooks.callHook('cli:boot', { argv: [] });
      unhook();
    });

    bench('Hook execution (10 handlers)', async () => {
      const unhooks: (() => void)[] = [];
      for (let i = 0; i < 10; i++) {
        unhooks.push(hooks.hook('cli:boot', () => {}));
      }
      await hooks.callHook('cli:boot', { argv: [] });
      unhooks.forEach(unhook => unhook());
    });

    bench('Hook execution (100 handlers)', async () => {
      const unhooks: (() => void)[] = [];
      for (let i = 0; i < 100; i++) {
        unhooks.push(hooks.hook('cli:boot', () => {}));
      }
      await hooks.callHook('cli:boot', { argv: [] });
      unhooks.forEach(unhook => unhook());
    });
  });

  describe('Memory and Allocation', () => {
    bench('Large state accumulation in workflow', async () => {
      const ctx = createDefaultContext();
      const workflow = defineWorkflow({
        id: 'memory-test',
        seed: { data: new Array(1000).fill(0) },
        steps: Array.from({ length: 20 }, (_, i) => ({
          id: `step${i}`,
          use: async (input: any) => ({
            [`array${i}`]: new Array(100).fill(i)
          })
        }))
      });
      
      await workflow.run(ctx);
    });

    bench('Deep object nesting in context', () => {
      const ctx = createDefaultContext();
      let current: any = ctx.memo!;
      for (let i = 0; i < 100; i++) {
        current.nested = { level: i, data: {} };
        current = current.nested.data;
      }
    });
  });

  describe('Validation Performance', () => {
    const simpleSchema = z.object({
      name: z.string(),
      age: z.number()
    });

    const complexSchema = z.object({
      user: z.object({
        id: z.string().uuid(),
        name: z.string().min(3).max(50),
        email: z.string().email(),
        age: z.number().min(0).max(150),
        roles: z.array(z.enum(['admin', 'user', 'guest'])),
        metadata: z.record(z.unknown())
      }),
      settings: z.object({
        theme: z.enum(['light', 'dark', 'auto']),
        notifications: z.boolean(),
        language: z.string().length(2)
      }),
      timestamps: z.object({
        created: z.date(),
        updated: z.date().optional()
      })
    });

    const validSimpleData = { name: 'John', age: 30 };
    const validComplexData = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        roles: ['user'],
        metadata: { foo: 'bar' }
      },
      settings: {
        theme: 'dark',
        notifications: true,
        language: 'en'
      },
      timestamps: {
        created: new Date()
      }
    };

    bench('Simple schema validation', () => {
      simpleSchema.parse(validSimpleData);
    });

    bench('Complex schema validation', () => {
      complexSchema.parse(validComplexData);
    });

    bench('Task with simple validation', async () => {
      const ctx = createDefaultContext();
      const task = defineTask({
        id: 'validated-simple',
        in: simpleSchema,
        run: async (input) => input
      });
      await task.call(validSimpleData, ctx);
    });

    bench('Task with complex validation', async () => {
      const ctx = createDefaultContext();
      const task = defineTask({
        id: 'validated-complex',
        in: complexSchema,
        run: async (input) => input
      });
      await task.call(validComplexData, ctx);
    });
  });
});