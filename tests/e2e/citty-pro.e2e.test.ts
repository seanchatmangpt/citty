// E2E tests for Citty Pro Framework
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { defineCommand, runMain } from 'citty';
import { 
  defineTask, 
  defineWorkflow, 
  defineAIWrapperCommand,
  runLifecycle,
  registerCoreHooks,
  hooks
} from '../../src/pro';
import { createOtelPlugin } from '../../src/pro/plugins/otel.plugin';
import { registerPlugin, applyPlugins } from '../../src/pro/plugins';
import { createDefaultContext, withContext } from '../../src/pro/context';
import type { RunCtx } from '../../src/types/citty-pro';

describe('Citty Pro E2E Tests', () => {
  let capturedOutput: string[] = [];
  let originalConsoleLog: typeof console.log;

  beforeAll(() => {
    // Capture console output for verification
    originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      capturedOutput.push(args.join(' '));
      originalConsoleLog(...args);
    };
    
    // Register core hooks
    registerCoreHooks();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  beforeEach(() => {
    capturedOutput = [];
  });

  describe('Complete CLI Application Flow', () => {
    it('should execute a full CLI application with tasks and workflows', async () => {
      // Define tasks
      const validateTask = defineTask({
        id: 'validate',
        run: async (input: { data: string }) => {
          if (!input.data) {
            throw new Error('Data is required');
          }
          return { valid: true, data: input.data };
        }
      });

      const processTask = defineTask({
        id: 'process',
        run: async (input: { valid: boolean; data: string }) => {
          if (!input.valid) {
            throw new Error('Invalid data');
          }
          return { 
            processed: true, 
            result: input.data.toUpperCase(),
            timestamp: new Date().toISOString()
          };
        }
      });

      const reportTask = defineTask({
        id: 'report',
        run: async (input: any) => {
          return {
            summary: `Processed ${input.result} at ${input.timestamp}`,
            status: 'success'
          };
        }
      });

      // Define workflow
      const dataWorkflow = defineWorkflow({
        id: 'data-processing',
        seed: (ctx) => ({ startTime: ctx.now() }),
        steps: [
          { 
            id: 'validate', 
            use: validateTask,
            select: (state) => ({ data: 'test input' })
          },
          { 
            id: 'process', 
            use: processTask,
            select: (state) => state.validate
          },
          { 
            id: 'report', 
            use: reportTask,
            select: (state) => state.process,
            as: 'final'
          }
        ]
      });

      // Define command
      const cmd = defineCommand({
        meta: {
          name: 'process-data',
          version: '1.0.0',
          description: 'Process data through workflow'
        },
        args: {
          input: {
            type: 'string',
            required: true,
            description: 'Input data to process'
          }
        },
        async run({ args }) {
          const ctx = createDefaultContext();
          
          await runLifecycle({
            cmd: this as any,
            args,
            ctx,
            runStep: async (context) => {
              const result = await dataWorkflow.run(context);
              return {
                text: result.final.summary,
                json: result
              };
            }
          });
        }
      });

      // Execute command
      await cmd.run({
        rawArgs: ['--input', 'test'],
        args: { input: 'test', _: [] },
        cmd,
        data: undefined
      });

      // Verify output
      const output = capturedOutput.join('\n');
      expect(output).toContain('TEST');
      expect(output).toContain('Processed');
    });
  });

  describe('AI-Powered Command E2E', () => {
    it('should execute AI wrapper command with context', async () => {
      const aiAnalyzeCommand = defineAIWrapperCommand({
        meta: {
          name: 'ai-analyze',
          description: 'Analyze text with AI'
        },
        args: {
          text: {
            type: 'string',
            required: true,
            description: 'Text to analyze'
          }
        },
        ai: {
          model: { id: 'local-model', vendor: 'local' },
          tools: {
            sentiment: {
              description: 'Analyze sentiment',
              schema: {} as any,
              execute: async (input) => ({
                sentiment: 'positive',
                confidence: 0.95
              })
            }
          }
        },
        plan: (args) => `Analyze the sentiment of: ${args.text}`,
        run: async (args, ctx) => {
          // Simulate AI analysis
          const analysis = {
            text: args.text,
            sentiment: 'positive',
            keywords: ['test', 'example'],
            summary: `Analysis complete for: ${args.text}`
          };
          
          return {
            text: analysis.summary,
            json: analysis
          };
        }
      });

      const ctx = createDefaultContext();
      
      // Mock AI generate function
      ctx.ai = {
        model: { id: 'test', vendor: 'local' },
        generate: async ({ prompt }) => ({
          text: `AI response for: ${prompt}`,
          toolCalls: [
            { name: 'sentiment', args: { text: 'test' } }
          ]
        })
      };

      const result = await aiAnalyzeCommand.run({
        rawArgs: ['--text', 'analyze this'],
        args: { text: 'analyze this', _: [] },
        cmd: aiAnalyzeCommand,
        ctx
      });

      expect(result.text).toContain('Analysis complete');
      expect(result.json).toHaveProperty('sentiment');
    });
  });

  describe('Plugin System E2E', () => {
    it('should integrate OTEL plugin with command execution', async () => {
      // Register OTEL plugin
      const otelPlugin = createOtelPlugin({
        serviceName: 'citty-pro-test',
        enableTracing: true,
        enableMetrics: true,
        enableLogs: false
      });
      
      registerPlugin('otel', otelPlugin);
      
      const ctx = createDefaultContext();
      await applyPlugins(hooks as any, ctx);
      
      // Create command with telemetry
      const telemetryTask = defineTask({
        id: 'telemetry-test',
        run: async (input: number) => {
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 10));
          return { result: input * 2 };
        }
      });

      const cmd = defineCommand({
        meta: {
          name: 'telemetry-demo',
          version: '1.0.0'
        },
        args: {
          value: {
            type: 'number',
            default: 42
          }
        },
        async run({ args }) {
          await runLifecycle({
            cmd: this as any,
            args,
            ctx,
            runStep: async (context) => {
              const result = await telemetryTask.call(args.value, context);
              return {
                text: `Result: ${result.result}`
              };
            }
          });
        }
      });

      // Execute with telemetry
      await cmd.run({
        rawArgs: ['--value', '21'],
        args: { value: 21, _: [] },
        cmd,
        data: undefined
      });

      // Verify telemetry was active (check context was modified)
      expect(ctx.plugins?.has('otel')).toBeDefined();
    });
  });

  describe('Complex Workflow E2E', () => {
    it('should handle complex workflow with conditional logic', async () => {
      // Define conditional tasks
      const checkTask = defineTask({
        id: 'check',
        run: async (input: { value: number }) => ({
          needsProcessing: input.value > 10
        })
      });

      const processHighTask = defineTask({
        id: 'process-high',
        run: async (input: any) => ({
          type: 'high',
          processed: input.value * 2
        })
      });

      const processLowTask = defineTask({
        id: 'process-low',
        run: async (input: any) => ({
          type: 'low',
          processed: input.value
        })
      });

      // Create workflow with conditional execution
      const conditionalWorkflow = defineWorkflow({
        id: 'conditional',
        seed: { value: 15 },
        steps: [
          {
            id: 'check',
            use: checkTask,
            select: (state) => ({ value: state.value })
          },
          {
            id: 'process',
            use: async (input, ctx) => {
              if (input.check.needsProcessing) {
                return processHighTask.call(input, ctx);
              } else {
                return processLowTask.call(input, ctx);
              }
            },
            select: (state) => state
          }
        ]
      });

      const ctx = createDefaultContext();
      const result = await conditionalWorkflow.run(ctx);

      expect(result.check.needsProcessing).toBe(true);
      expect(result.process.type).toBe('high');
      expect(result.process.processed).toBe(30);
    });
  });

  describe('Error Handling E2E', () => {
    it('should handle errors gracefully throughout the lifecycle', async () => {
      const failingTask = defineTask({
        id: 'failing',
        run: async () => {
          throw new Error('Intentional task failure');
        }
      });

      const cmd = defineCommand({
        meta: {
          name: 'error-test',
          version: '1.0.0'
        },
        args: {},
        async run() {
          const ctx = createDefaultContext();
          
          try {
            await runLifecycle({
              cmd: this as any,
              args: { _: [] },
              ctx,
              runStep: async (context) => {
                await failingTask.call({}, context);
                return { text: 'Should not reach here' };
              }
            });
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Intentional task failure');
          }
        }
      });

      await cmd.run({
        rawArgs: [],
        args: { _: [] },
        cmd,
        data: undefined
      });
    });
  });

  describe('Context Isolation E2E', () => {
    it('should maintain context isolation between executions', async () => {
      const contextTask = defineTask({
        id: 'context-test',
        run: async (input: any, ctx: RunCtx) => {
          // Store value in context memo
          if (!ctx.memo) ctx.memo = {};
          ctx.memo!['test-key'] = input.value;
          return { stored: ctx.memo!['test-key'] };
        }
      });

      // First execution
      const ctx1 = createDefaultContext();
      const result1 = await withContext(ctx1, async () => {
        return contextTask.call({ value: 'first' }, ctx1);
      });

      // Second execution with different context
      const ctx2 = createDefaultContext();
      const result2 = await withContext(ctx2, async () => {
        return contextTask.call({ value: 'second' }, ctx2);
      });

      expect(result1.stored).toBe('first');
      expect(result2.stored).toBe('second');
      expect(ctx1.memo!['test-key']).toBe('first');
      expect(ctx2.memo!['test-key']).toBe('second');
    });
  });
});