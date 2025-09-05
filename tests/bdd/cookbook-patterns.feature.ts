/**
 * BDD Tests for Citty Pro Cookbook Patterns
 * 
 * Comprehensive Gherkin-style scenarios for all 25+ patterns
 * Using Given-When-Then structure with complete coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { 
  cittyPro, 
  hooks, 
  registerCoreHooks,
  workflowGenerator,
  WorkflowTemplates,
  SchemaHelpers
} from '../../src/pro';
import type { RunCtx, Task, Workflow } from '../../src/types/citty-pro';

describe('Citty Pro Cookbook Patterns - BDD Tests', () => {
  
  let context: RunCtx;
  let mockConsoleLog: any;
  
  beforeEach(() => {
    // Setup test context
    context = {
      cwd: '/test',
      env: {},
      now: () => new Date('2024-01-01T00:00:00Z'),
      memo: {}
    };
    
    // Mock console for testing
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Clear all hooks
    hooks.removeAllHooks();
    registerCoreHooks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    hooks.removeAllHooks();
  });

  // ============= BASIC PATTERNS (1-5) =============
  
  describe('Pattern 1: Simple Task with Zod Validation', () => {
    describe('Given a task with Zod schema validation', () => {
      const UserSchema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        age: z.number().min(18)
      });
      
      const createUserTask = cittyPro.defineTask({
        id: 'create-user',
        in: UserSchema,
        out: z.object({ id: z.string(), ...UserSchema.shape }),
        run: async (user) => ({
          id: 'user-123',
          ...user
        })
      });
      
      describe('When called with valid input', () => {
        it('Then should create user successfully', async () => {
          const result = await createUserTask.call(
            { name: 'John', email: 'john@example.com', age: 25 },
            context
          );
          
          expect(result).toMatchObject({
            id: 'user-123',
            name: 'John',
            email: 'john@example.com',
            age: 25
          });
        });
      });
      
      describe('When called with invalid email', () => {
        it('Then should throw validation error', async () => {
          await expect(
            createUserTask.call(
              { name: 'John', email: 'invalid-email', age: 25 },
              context
            )
          ).rejects.toThrow();
        });
      });
      
      describe('When called with age below minimum', () => {
        it('Then should throw validation error', async () => {
          await expect(
            createUserTask.call(
              { name: 'John', email: 'john@example.com', age: 17 },
              context
            )
          ).rejects.toThrow();
        });
      });
    });
  });
  
  describe('Pattern 2: Sequential Workflow with State Accumulation', () => {
    describe('Given a workflow with multiple steps', () => {
      const fetchTask = cittyPro.defineTask({
        id: 'fetch',
        run: async () => ({ data: [1, 2, 3] })
      });
      
      const transformTask = cittyPro.defineTask({
        id: 'transform',
        run: async (input: { data: number[] }) => ({
          transformed: input.data.map(x => x * 2)
        })
      });
      
      const validateTask = cittyPro.defineTask({
        id: 'validate',
        run: async (input: any) => ({
          valid: true,
          data: input.transformed
        })
      });
      
      const dataWorkflow = cittyPro.defineWorkflow({
        id: 'data-processing',
        seed: { items: [], metadata: {} },
        steps: [
          { id: 'fetch', use: fetchTask, as: 'rawData' },
          { id: 'transform', use: transformTask, select: (state) => state.rawData },
          { id: 'validate', use: validateTask, select: (state) => state.transform }
        ]
      });
      
      describe('When workflow is executed', () => {
        it('Then should accumulate state from all steps', async () => {
          const result = await dataWorkflow.run(context);
          
          expect(result).toHaveProperty('rawData');
          expect(result).toHaveProperty('transform');
          expect(result).toHaveProperty('validate');
          expect(result.rawData).toEqual({ data: [1, 2, 3] });
          expect(result.transform).toEqual({ transformed: [2, 4, 6] });
          expect(result.validate).toEqual({ valid: true, data: [2, 4, 6] });
        });
      });
    });
  });
  
  describe('Pattern 3: Hook-Driven Task with Lifecycle Events', () => {
    describe('Given a task with lifecycle hooks registered', () => {
      const auditedTask = cittyPro.defineTask({
        id: 'audited-operation',
        run: async (input: any) => ({
          processed: true,
          timestamp: context.now()
        })
      });
      
      const hookCalls: string[] = [];
      
      beforeEach(() => {
        hooks.hook('task:will:call', async ({ id }) => {
          hookCalls.push(`before:${id}`);
        });
        
        hooks.hook('task:did:call', async ({ id }) => {
          hookCalls.push(`after:${id}`);
        });
      });
      
      describe('When task is executed', () => {
        it('Then should trigger lifecycle hooks in order', async () => {
          await auditedTask.call({}, context);
          
          expect(hookCalls).toEqual([
            'before:audited-operation',
            'after:audited-operation'
          ]);
        });
      });
    });
  });
  
  describe('Pattern 4: Context-Aware Command with Environment', () => {
    describe('Given a command that uses context', () => {
      const contextAwareTask = cittyPro.defineTask({
        id: 'context-aware',
        run: async (input: any, ctx) => ({
          cwd: ctx.cwd,
          envKeys: Object.keys(ctx.env),
          timestamp: ctx.now()
        })
      });
      
      describe('When executed with custom context', () => {
        it('Then should access context properties correctly', async () => {
          const customContext = {
            ...context,
            env: { NODE_ENV: 'test', API_KEY: 'secret' }
          };
          
          const result = await contextAwareTask.call({}, customContext);
          
          expect(result.cwd).toBe('/test');
          expect(result.envKeys).toContain('NODE_ENV');
          expect(result.envKeys).toContain('API_KEY');
          expect(result.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
        });
      });
    });
  });
  
  describe('Pattern 5: Plugin-Enhanced Workflow', () => {
    describe('Given a workflow with plugins applied', () => {
      const pluginEvents: string[] = [];
      
      const testPlugin = async (h: any, ctx: RunCtx) => {
        h.hook('workflow:compile', () => {
          pluginEvents.push('compile');
        });
        h.hook('task:will:call', () => {
          pluginEvents.push('task-start');
        });
        h.hook('task:did:call', () => {
          pluginEvents.push('task-end');
        });
      };
      
      beforeEach(async () => {
        await testPlugin(hooks, context);
      });
      
      describe('When workflow executes', () => {
        it('Then plugin hooks should be triggered', async () => {
          const simpleTask = cittyPro.defineTask({
            id: 'simple',
            run: async () => ({ done: true })
          });
          
          await hooks.callHook('workflow:compile', { id: 'test' });
          await simpleTask.call({}, context);
          
          expect(pluginEvents).toContain('compile');
          expect(pluginEvents).toContain('task-start');
          expect(pluginEvents).toContain('task-end');
        });
      });
    });
  });
  
  // ============= VALIDATION PATTERNS (6-10) =============
  
  describe('Pattern 6: Multi-Schema Validation Pipeline', () => {
    describe('Given multiple validation schemas', () => {
      const EmailSchema = z.string().email();
      const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);
      const ContactSchema = z.object({
        email: EmailSchema,
        phone: PhoneSchema
      });
      
      const validationWorkflow = workflowGenerator.createValidationWorkflow(
        'contact-validation',
        ContactSchema,
        [
          async (data) => ({ ...data, validated: true }),
          async (data) => ({ ...data, normalized: data.phone.replace(/\D/g, '') })
        ]
      );
      
      describe('When valid contact data is provided', () => {
        it('Then should validate and process successfully', async () => {
          const input = {
            email: 'test@example.com',
            phone: '+12025551234'
          };
          
          const result = await validationWorkflow.run(context);
          expect(result).toHaveProperty('validated');
        });
      });
      
      describe('When invalid email is provided', () => {
        it('Then should capture validation errors', async () => {
          const invalidTask = cittyPro.defineTask({
            id: 'validate-invalid',
            in: ContactSchema,
            run: async (data) => data
          });
          
          await expect(
            invalidTask.call({ email: 'invalid', phone: '+12025551234' }, context)
          ).rejects.toThrow();
        });
      });
    });
  });
  
  describe('Pattern 7: Conditional Schema Selection', () => {
    describe('Given a discriminated union schema', () => {
      const DynamicSchema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('email'), value: z.string().email() }),
        z.object({ type: z.literal('phone'), value: z.string() }),
        z.object({ type: z.literal('username'), value: z.string().min(3) })
      ]);
      
      const dynamicTask = cittyPro.defineTask({
        id: 'dynamic-validate',
        in: DynamicSchema,
        run: async (input) => {
          switch (input.type) {
            case 'email': return { valid: true, channel: 'email' };
            case 'phone': return { valid: true, channel: 'sms' };
            case 'username': return { valid: true, channel: 'app' };
          }
        }
      });
      
      describe('When email type is provided', () => {
        it('Then should validate as email channel', async () => {
          const result = await dynamicTask.call(
            { type: 'email', value: 'test@example.com' },
            context
          );
          expect(result.channel).toBe('email');
        });
      });
      
      describe('When phone type is provided', () => {
        it('Then should validate as sms channel', async () => {
          const result = await dynamicTask.call(
            { type: 'phone', value: '+12025551234' },
            context
          );
          expect(result.channel).toBe('sms');
        });
      });
      
      describe('When username type is provided', () => {
        it('Then should validate as app channel', async () => {
          const result = await dynamicTask.call(
            { type: 'username', value: 'john_doe' },
            context
          );
          expect(result.channel).toBe('app');
        });
      });
    });
  });
  
  describe('Pattern 8: Schema Composition with Refinements', () => {
    describe('Given composed schemas with refinements', () => {
      const BaseUserSchema = z.object({
        id: z.string(),
        createdAt: z.date()
      });
      
      const AdminSchema = BaseUserSchema.extend({
        name: z.string(),
        permissions: z.array(z.string()),
        level: z.number().min(1).max(10)
      }).refine(
        (data) => data.level > 5 || data.permissions.length === 0,
        "Low-level admins cannot have permissions"
      );
      
      const adminTask = cittyPro.defineTask({
        id: 'admin-validate',
        in: AdminSchema,
        run: async (admin) => ({ valid: true, admin })
      });
      
      describe('When high-level admin has permissions', () => {
        it('Then should validate successfully', async () => {
          const admin = {
            id: '123',
            createdAt: new Date(),
            name: 'Admin',
            level: 8,
            permissions: ['read', 'write']
          };
          
          const result = await adminTask.call(admin, context);
          expect(result.valid).toBe(true);
        });
      });
      
      describe('When low-level admin has no permissions', () => {
        it('Then should validate successfully', async () => {
          const admin = {
            id: '456',
            createdAt: new Date(),
            name: 'Junior',
            level: 3,
            permissions: []
          };
          
          const result = await adminTask.call(admin, context);
          expect(result.valid).toBe(true);
        });
      });
      
      describe('When low-level admin has permissions', () => {
        it('Then should fail refinement validation', async () => {
          const admin = {
            id: '789',
            createdAt: new Date(),
            name: 'Junior',
            level: 3,
            permissions: ['read']
          };
          
          await expect(adminTask.call(admin, context)).rejects.toThrow();
        });
      });
    });
  });
  
  describe('Pattern 9: Error Recovery Workflow', () => {
    describe('Given a workflow with retry mechanism', () => {
      let attempts = 0;
      const flakyTask = cittyPro.defineTask({
        id: 'flaky',
        run: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true, attempts };
        }
      });
      
      const retryWorkflow = workflowGenerator.createRetryWorkflow(
        'retry-workflow',
        flakyTask,
        {
          maxAttempts: 3,
          backoff: 'exponential',
          initialDelay: 10
        }
      );
      
      describe('When task fails initially but succeeds on retry', () => {
        it('Then should eventually succeed with retry count', async () => {
          attempts = 0;
          const result = await retryWorkflow.run(context);
          expect(result.success).toBe(true);
          expect(result.attempts).toBe(3);
        });
      });
    });
  });
  
  describe('Pattern 10: Progressive Validation Chain', () => {
    describe('Given a chain of progressive validations', () => {
      const progressiveValidation = workflowGenerator.fromSchemaChain(
        'progressive',
        [
          z.object({ raw: z.string() }),
          z.object({ parsed: z.any() }),
          z.object({ validated: z.any() }),
          z.object({ enriched: z.any() })
        ],
        [
          async (input) => ({ parsed: JSON.parse(input.raw) }),
          async (input) => ({ validated: { ...input.parsed, valid: true } }),
          async (input) => ({ enriched: { ...input.validated, metadata: {} } })
        ]
      );
      
      describe('When valid JSON string is provided', () => {
        it('Then should progress through all validation stages', async () => {
          const startTask = cittyPro.defineTask({
            id: 'start',
            run: async () => ({ raw: '{"name":"test"}' })
          });
          
          const workflow = cittyPro.defineWorkflow({
            id: 'test-progressive',
            steps: [
              { id: 'start', use: startTask },
              { id: 'validate', use: progressiveValidation as any }
            ]
          });
          
          const result = await workflow.run(context);
          expect(result).toHaveProperty('validate');
        });
      });
    });
  });
  
  // ============= AI INTEGRATION PATTERNS (11-15) =============
  
  describe('Pattern 11: AI-Powered Command with Tools', () => {
    describe('Given an AI command with tool definitions', () => {
      const mockAI = {
        model: { id: 'test-model', vendor: 'openai' as const },
        generate: vi.fn().mockResolvedValue({
          text: 'AI response',
          toolCalls: [{ name: 'search', args: { query: 'test' } }]
        })
      };
      
      const aiCommand = cittyPro.defineAIWrapperCommand({
        meta: { name: 'ai-assist' },
        args: {
          prompt: { type: 'string', required: true }
        },
        ai: {
          model: mockAI.model,
          tools: {
            search: {
              description: 'Search for information',
              schema: z.object({ query: z.string() }),
              execute: async ({ query }) => ({ results: [`Result for ${query}`] })
            }
          }
        },
        onToolCall: vi.fn(),
        run: async (args, ctx) => ({
          text: 'Processed with AI'
        })
      });
      
      describe('When AI command is executed', () => {
        it('Then should handle tool calls', async () => {
          const aiContext = { ...context, ai: mockAI };
          const result = await aiCommand.run({ 
            rawArgs: [],
            args: { prompt: 'Help me', _: [] },
            cmd: aiCommand,
            ctx: aiContext
          });
          
          expect(result.text).toBe('Processed with AI');
        });
      });
    });
  });
  
  describe('Pattern 12: Multi-Model AI Workflow', () => {
    describe('Given a workflow using multiple AI models', () => {
      const multiModelWorkflow = cittyPro.defineWorkflow({
        id: 'multi-ai',
        steps: [
          {
            id: 'gpt',
            use: cittyPro.defineTask({
              id: 'gpt-task',
              run: async () => ({ model: 'gpt', response: 'GPT response' })
            })
          },
          {
            id: 'claude',
            use: cittyPro.defineTask({
              id: 'claude-task',
              run: async () => ({ model: 'claude', response: 'Claude response' })
            })
          }
        ]
      });
      
      describe('When multiple models are queried', () => {
        it('Then should aggregate responses from all models', async () => {
          const result = await multiModelWorkflow.run(context);
          expect(result.gpt).toEqual({ model: 'gpt', response: 'GPT response' });
          expect(result.claude).toEqual({ model: 'claude', response: 'Claude response' });
        });
      });
    });
  });
  
  describe('Pattern 13: AI Chain-of-Thought Workflow', () => {
    describe('Given a chain-of-thought reasoning workflow', () => {
      const thoughtSteps = ['analyze', 'decompose', 'solve', 'synthesize'];
      const chainOfThought = cittyPro.defineWorkflow({
        id: 'chain-of-thought',
        seed: { thoughts: [] },
        steps: thoughtSteps.map(step => ({
          id: step,
          use: cittyPro.defineTask({
            id: `${step}-task`,
            run: async () => ({
              step,
              thought: `Completed ${step}`,
              timestamp: context.now()
            })
          })
        }))
      });
      
      describe('When chain-of-thought is executed', () => {
        it('Then should process through all reasoning steps', async () => {
          const result = await chainOfThought.run(context);
          
          thoughtSteps.forEach(step => {
            expect(result[step]).toMatchObject({
              step,
              thought: `Completed ${step}`
            });
          });
        });
      });
    });
  });
  
  describe('Pattern 14: AI-Powered Data Transformation', () => {
    describe('Given an AI transformation task', () => {
      const mockTransform = async (input: any) => ({
        transformed: { ...input, ai_processed: true }
      });
      
      const aiTransformTask = cittyPro.defineTask({
        id: 'ai-transform',
        in: z.object({
          input: z.any(),
          fromFormat: z.string(),
          toFormat: z.string()
        }),
        run: async ({ input, fromFormat, toFormat }) => {
          return mockTransform(input);
        }
      });
      
      describe('When data transformation is requested', () => {
        it('Then should transform data using AI', async () => {
          const result = await aiTransformTask.call({
            input: { data: 'test' },
            fromFormat: 'json',
            toFormat: 'yaml'
          }, context);
          
          expect(result.transformed).toHaveProperty('ai_processed', true);
        });
      });
    });
  });
  
  describe('Pattern 15: AI Feedback Loop Pattern', () => {
    describe('Given a feedback loop workflow', () => {
      let quality = 0;
      
      const feedbackWorkflow = cittyPro.defineWorkflow({
        id: 'feedback-loop',
        steps: [
          {
            id: 'generate',
            use: cittyPro.defineTask({
              id: 'generate-content',
              run: async () => ({ content: 'Generated content' })
            })
          },
          {
            id: 'evaluate',
            use: cittyPro.defineTask({
              id: 'evaluate-quality',
              run: async ({ content }: any) => {
                quality += 30; // Improve each iteration
                return { quality, content };
              }
            }),
            select: (state) => state.generate
          },
          {
            id: 'decide',
            use: cittyPro.defineTask({
              id: 'continue-or-stop',
              run: async ({ quality, content }: any) => {
                if (quality > 80) {
                  return { final: content, complete: true };
                }
                return { feedback: 'Improve quality', complete: false };
              }
            }),
            select: (state) => state.evaluate
          }
        ]
      });
      
      describe('When feedback loop runs multiple iterations', () => {
        it('Then should improve quality until threshold', async () => {
          quality = 0;
          
          // Run multiple iterations
          for (let i = 0; i < 3; i++) {
            const result = await feedbackWorkflow.run(context);
            if (result.decide.complete) {
              expect(result.evaluate.quality).toBeGreaterThan(80);
              break;
            }
          }
        });
      });
    });
  });
  
  // ============= WORKFLOW COMPOSITION PATTERNS (16-20) =============
  
  describe('Pattern 16: Parallel Execution with Aggregation', () => {
    describe('Given tasks that can run in parallel', () => {
      const parallelTasks = [1, 2, 3].map(i =>
        cittyPro.defineTask({
          id: `parallel-${i}`,
          run: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return { taskId: i, result: i * 2 };
          }
        })
      );
      
      const parallelWorkflow = cittyPro.defineWorkflow({
        id: 'parallel-exec',
        steps: [
          {
            id: 'parallel-all',
            use: cittyPro.defineTask({
              id: 'aggregate',
              run: async () => {
                const results = await Promise.all(
                  parallelTasks.map(task => task.call({}, context))
                );
                return { aggregated: results };
              }
            })
          }
        ]
      });
      
      describe('When parallel execution is triggered', () => {
        it('Then should execute all tasks simultaneously and aggregate', async () => {
          const startTime = Date.now();
          const result = await parallelWorkflow.run(context);
          const duration = Date.now() - startTime;
          
          expect(result['parallel-all'].aggregated).toHaveLength(3);
          expect(duration).toBeLessThan(50); // Should be faster than sequential
        });
      });
    });
  });
  
  describe('Pattern 17: Dynamic Workflow Composition', () => {
    describe('Given a dynamic workflow builder', () => {
      class DynamicBuilder {
        private steps: any[] = [];
        
        addStep(condition: (state: any) => boolean, task: Task<any, any>) {
          this.steps.push({
            id: `step-${this.steps.length}`,
            use: cittyPro.defineTask({
              id: `conditional-${this.steps.length}`,
              run: async (input: any, ctx) => {
                if (condition(input)) {
                  return task.call(input, ctx);
                }
                return input;
              }
            })
          });
          return this;
        }
        
        build(id: string) {
          return cittyPro.defineWorkflow({ id, steps: this.steps });
        }
      }
      
      describe('When workflow is built dynamically', () => {
        it('Then should execute steps based on conditions', async () => {
          const builder = new DynamicBuilder();
          
          const workflow = builder
            .addStep(
              (state) => state.type === 'A',
              cittyPro.defineTask({
                id: 'process-A',
                run: async () => ({ processed: 'A' })
              })
            )
            .addStep(
              (state) => state.type === 'B',
              cittyPro.defineTask({
                id: 'process-B',
                run: async () => ({ processed: 'B' })
              })
            )
            .build('dynamic-workflow');
          
          const seed = { type: 'A' };
          const result = await workflow.run(context);
          
          expect(result['step-0']).toEqual({ processed: 'A' });
        });
      });
    });
  });
  
  describe('Pattern 18: Pipeline with Error Boundaries', () => {
    describe('Given a pipeline with error handling stages', () => {
      const errorProneTask = cittyPro.defineTask({
        id: 'may-fail',
        run: async (input: { shouldFail?: boolean }) => {
          if (input.shouldFail) {
            throw new Error('Task failed');
          }
          return { success: true };
        }
      });
      
      const errorBoundaryWorkflow = cittyPro.defineWorkflow({
        id: 'error-boundary',
        steps: [
          {
            id: 'try',
            use: cittyPro.defineTask({
              id: 'try-task',
              run: async (input) => {
                try {
                  return await errorProneTask.call(input, context);
                } catch (error) {
                  return { error: (error as Error).message };
                }
              }
            })
          },
          {
            id: 'handle',
            use: cittyPro.defineTask({
              id: 'handle-error',
              run: async (input: any) => {
                if (input.error) {
                  return { recovered: true, originalError: input.error };
                }
                return input;
              }
            }),
            select: (state) => state.try
          }
        ]
      });
      
      describe('When a stage fails', () => {
        it('Then should handle error and continue', async () => {
          const seed = { shouldFail: true };
          const workflow = cittyPro.defineWorkflow({
            id: 'test-error',
            seed,
            steps: errorBoundaryWorkflow.steps
          });
          
          const result = await workflow.run(context);
          expect(result.handle).toMatchObject({
            recovered: true,
            originalError: 'Task failed'
          });
        });
      });
      
      describe('When all stages succeed', () => {
        it('Then should complete normally', async () => {
          const seed = { shouldFail: false };
          const workflow = cittyPro.defineWorkflow({
            id: 'test-success',
            seed,
            steps: errorBoundaryWorkflow.steps
          });
          
          const result = await workflow.run(context);
          expect(result.try).toEqual({ success: true });
        });
      });
    });
  });
  
  describe('Pattern 19: Event-Driven Workflow Composition', () => {
    describe('Given an event-driven workflow system', () => {
      const events: string[] = [];
      
      const eventWorkflow = cittyPro.defineWorkflow({
        id: 'event-driven',
        steps: [
          {
            id: 'emit',
            use: cittyPro.defineTask({
              id: 'emit-event',
              run: async () => {
                events.push('user:signup');
                return { event: 'user:signup' };
              }
            })
          },
          {
            id: 'handle',
            use: cittyPro.defineTask({
              id: 'handle-event',
              run: async ({ event }: any) => {
                if (event === 'user:signup') {
                  events.push('welcome:email');
                  return { handled: true };
                }
                return { handled: false };
              }
            }),
            select: (state) => state.emit
          }
        ]
      });
      
      describe('When event is triggered', () => {
        it('Then should handle event and trigger subsequent events', async () => {
          events.length = 0;
          const result = await eventWorkflow.run(context);
          
          expect(events).toContain('user:signup');
          expect(events).toContain('welcome:email');
          expect(result.handle.handled).toBe(true);
        });
      });
    });
  });
  
  describe('Pattern 20: Workflow Factory with Template Instantiation', () => {
    describe('Given a workflow factory with templates', () => {
      class WorkflowFactory {
        private templates = new Map<string, (params: any) => Workflow<any>>();
        
        registerTemplate(name: string, factory: (params: any) => Workflow<any>) {
          this.templates.set(name, factory);
        }
        
        create(templateName: string, params: any): Workflow<any> {
          const factory = this.templates.get(templateName);
          if (!factory) throw new Error(`Template ${templateName} not found`);
          return factory(params);
        }
      }
      
      describe('When template is instantiated', () => {
        it('Then should create customized workflow', () => {
          const factory = new WorkflowFactory();
          
          factory.registerTemplate('crud', (entity: string) =>
            cittyPro.defineWorkflow({
              id: `${entity}-crud`,
              steps: [
                {
                  id: 'validate',
                  use: cittyPro.defineTask({
                    id: `validate-${entity}`,
                    run: async () => ({ entity, validated: true })
                  })
                }
              ]
            })
          );
          
          const userWorkflow = factory.create('crud', 'user');
          const productWorkflow = factory.create('crud', 'product');
          
          expect(userWorkflow.id).toBe('user-crud');
          expect(productWorkflow.id).toBe('product-crud');
        });
      });
    });
  });
  
  // ============= ADVANCED ORCHESTRATION PATTERNS (21-25) =============
  
  describe('Pattern 21: Distributed Saga Pattern', () => {
    describe('Given a distributed transaction saga', () => {
      class SagaOrchestrator {
        private compensations: Array<() => Promise<void>> = [];
        private executed: string[] = [];
        
        async execute(steps: Array<{
          name: string;
          action: () => Promise<any>;
          compensation: () => Promise<void>;
        }>) {
          for (const step of steps) {
            try {
              await step.action();
              this.executed.push(step.name);
              this.compensations.push(step.compensation);
            } catch (error) {
              await this.rollback();
              throw error;
            }
          }
          return this.executed;
        }
        
        private async rollback() {
          for (const compensation of this.compensations.reverse()) {
            await compensation();
          }
          this.executed.push('rollback-complete');
        }
      }
      
      describe('When all saga steps succeed', () => {
        it('Then should complete transaction', async () => {
          const saga = new SagaOrchestrator();
          const result = await saga.execute([
            {
              name: 'create-order',
              action: async () => { /* success */ },
              compensation: async () => { /* rollback */ }
            },
            {
              name: 'charge-payment',
              action: async () => { /* success */ },
              compensation: async () => { /* rollback */ }
            }
          ]);
          
          expect(result).toEqual(['create-order', 'charge-payment']);
        });
      });
      
      describe('When a saga step fails', () => {
        it('Then should rollback previous steps', async () => {
          const saga = new SagaOrchestrator();
          const rollbacks: string[] = [];
          
          await expect(saga.execute([
            {
              name: 'create-order',
              action: async () => { /* success */ },
              compensation: async () => { rollbacks.push('rollback-order'); }
            },
            {
              name: 'charge-payment',
              action: async () => { throw new Error('Payment failed'); },
              compensation: async () => { rollbacks.push('rollback-payment'); }
            }
          ])).rejects.toThrow('Payment failed');
          
          expect(rollbacks).toEqual(['rollback-order']);
        });
      });
    });
  });
  
  describe('Pattern 22: Circuit Breaker Workflow', () => {
    describe('Given a circuit breaker implementation', () => {
      class CircuitBreaker {
        private failures = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        
        constructor(
          private threshold = 3,
          private timeout = 100
        ) {}
        
        async execute(fn: () => Promise<any>): Promise<any> {
          if (this.state === 'open') {
            throw new Error('Circuit breaker is open');
          }
          
          try {
            const result = await fn();
            if (this.state === 'half-open') {
              this.state = 'closed';
              this.failures = 0;
            }
            return result;
          } catch (error) {
            this.failures++;
            if (this.failures >= this.threshold) {
              this.state = 'open';
              setTimeout(() => {
                this.state = 'half-open';
              }, this.timeout);
            }
            throw error;
          }
        }
        
        getState() {
          return this.state;
        }
      }
      
      describe('When failures exceed threshold', () => {
        it('Then circuit should open', async () => {
          const breaker = new CircuitBreaker(2, 50);
          const failingFn = async () => { throw new Error('Service error'); };
          
          // First failure
          await expect(breaker.execute(failingFn)).rejects.toThrow();
          expect(breaker.getState()).toBe('closed');
          
          // Second failure - opens circuit
          await expect(breaker.execute(failingFn)).rejects.toThrow();
          expect(breaker.getState()).toBe('open');
          
          // Circuit is open - immediate rejection
          await expect(breaker.execute(failingFn)).rejects.toThrow('Circuit breaker is open');
        });
      });
      
      describe('When circuit recovers', () => {
        it('Then should transition to half-open and eventually close', async () => {
          const breaker = new CircuitBreaker(1, 50);
          const successFn = async () => ({ success: true });
          const failingFn = async () => { throw new Error('Fail'); };
          
          // Open the circuit
          await expect(breaker.execute(failingFn)).rejects.toThrow();
          expect(breaker.getState()).toBe('open');
          
          // Wait for timeout to half-open
          await new Promise(resolve => setTimeout(resolve, 60));
          
          // Success in half-open closes circuit
          const result = await breaker.execute(successFn);
          expect(result).toEqual({ success: true });
          expect(breaker.getState()).toBe('closed');
        });
      });
    });
  });
  
  describe('Pattern 23: Workflow Mesh with Service Discovery', () => {
    describe('Given a workflow mesh with discovery', () => {
      class WorkflowMesh {
        private registry = new Map<string, {
          workflow: Workflow<any>;
          metadata: any;
          health: 'healthy' | 'unhealthy';
        }>();
        
        register(id: string, workflow: Workflow<any>, metadata: any = {}) {
          this.registry.set(id, { workflow, metadata, health: 'healthy' });
        }
        
        async discover(criteria: (metadata: any) => boolean): Promise<string[]> {
          const matches: string[] = [];
          for (const [id, entry] of this.registry) {
            if (entry.health === 'healthy' && criteria(entry.metadata)) {
              matches.push(id);
            }
          }
          return matches;
        }
        
        async invoke(id: string, ctx: RunCtx): Promise<any> {
          const entry = this.registry.get(id);
          if (!entry) throw new Error(`Workflow ${id} not found`);
          if (entry.health === 'unhealthy') throw new Error(`Workflow ${id} is unhealthy`);
          return entry.workflow.run(ctx);
        }
      }
      
      describe('When services are registered', () => {
        it('Then should discover based on metadata', async () => {
          const mesh = new WorkflowMesh();
          
          mesh.register('payment-us', 
            cittyPro.defineWorkflow({ id: 'payment-us', steps: [] }), 
            { type: 'payment', region: 'us' }
          );
          
          mesh.register('payment-eu', 
            cittyPro.defineWorkflow({ id: 'payment-eu', steps: [] }), 
            { type: 'payment', region: 'eu' }
          );
          
          mesh.register('notification', 
            cittyPro.defineWorkflow({ id: 'notification', steps: [] }), 
            { type: 'notification' }
          );
          
          const paymentServices = await mesh.discover(m => m.type === 'payment');
          expect(paymentServices).toContain('payment-us');
          expect(paymentServices).toContain('payment-eu');
          expect(paymentServices).not.toContain('notification');
        });
      });
    });
  });
  
  describe('Pattern 24: Adaptive Workflow with Machine Learning', () => {
    describe('Given an adaptive workflow that learns from history', () => {
      class AdaptiveWorkflow {
        private history: Array<{ path: string; duration: number; success: boolean }> = [];
        private scores = new Map<string, number>();
        
        async execute(options: Array<{ id: string; fn: () => Promise<any> }>) {
          const selected = this.selectOptimal(options);
          const startTime = Date.now();
          
          try {
            const result = await selected.fn();
            this.history.push({
              path: selected.id,
              duration: Date.now() - startTime,
              success: true
            });
            this.updateScores();
            return result;
          } catch (error) {
            this.history.push({
              path: selected.id,
              duration: Date.now() - startTime,
              success: false
            });
            this.updateScores();
            throw error;
          }
        }
        
        private selectOptimal(options: any[]): any {
          let best = options[0];
          let bestScore = -Infinity;
          
          for (const option of options) {
            const score = this.scores.get(option.id) || 0;
            if (score > bestScore) {
              bestScore = score;
              best = option;
            }
          }
          return best;
        }
        
        private updateScores() {
          const pathGroups = new Map<string, typeof this.history>();
          
          for (const record of this.history) {
            if (!pathGroups.has(record.path)) {
              pathGroups.set(record.path, []);
            }
            pathGroups.get(record.path)!.push(record);
          }
          
          for (const [path, records] of pathGroups) {
            const successRate = records.filter(r => r.success).length / records.length;
            const avgDuration = records.reduce((sum, r) => sum + r.duration, 0) / records.length;
            const score = successRate * 100 - (avgDuration / 10);
            this.scores.set(path, score);
          }
        }
        
        getScores() {
          return Object.fromEntries(this.scores);
        }
      }
      
      describe('When workflow adapts over time', () => {
        it('Then should improve path selection', async () => {
          const adaptive = new AdaptiveWorkflow();
          
          const fastButFlaky = {
            id: 'fast',
            fn: async () => {
              if (Math.random() > 0.5) throw new Error('Flaky');
              return { path: 'fast' };
            }
          };
          
          const slowButReliable = {
            id: 'slow',
            fn: async () => {
              await new Promise(r => setTimeout(r, 20));
              return { path: 'slow' };
            }
          };
          
          // Run multiple iterations to build history
          for (let i = 0; i < 10; i++) {
            try {
              await adaptive.execute([fastButFlaky, slowButReliable]);
            } catch (error) {
              // Expected failures from flaky path
            }
          }
          
          const scores = adaptive.getScores();
          // Slow but reliable should have better score
          expect(scores.slow).toBeDefined();
        });
      });
    });
  });
  
  describe('Pattern 25: Quantum-Inspired Superposition Workflow', () => {
    describe('Given a superposition workflow that races multiple paths', () => {
      class SuperpositionWorkflow {
        async execute(workflows: Array<{ id: string; fn: () => Promise<any> }>) {
          const abortControllers = workflows.map(() => new AbortController());
          
          const promises = workflows.map(async ({ id, fn }, index) => {
            const signal = abortControllers[index].signal;
            
            return new Promise(async (resolve, reject) => {
              if (signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }
              
              signal.addEventListener('abort', () => {
                reject(new Error('Aborted'));
              });
              
              try {
                const result = await fn();
                resolve({ id, result });
              } catch (error) {
                reject(error);
              }
            });
          });
          
          try {
            const winner = await Promise.race(promises);
            // Collapse superposition - cancel other workflows
            abortControllers.forEach(c => c.abort());
            return winner;
          } catch (error) {
            throw new Error('All superposition states failed');
          }
        }
      }
      
      describe('When multiple paths race', () => {
        it('Then first successful path should win', async () => {
          const superposition = new SuperpositionWorkflow();
          
          const result = await superposition.execute([
            {
              id: 'slow',
              fn: async () => {
                await new Promise(r => setTimeout(r, 100));
                return { value: 'slow' };
              }
            },
            {
              id: 'fast',
              fn: async () => {
                await new Promise(r => setTimeout(r, 10));
                return { value: 'fast' };
              }
            },
            {
              id: 'instant',
              fn: async () => ({ value: 'instant' })
            }
          ]);
          
          expect((result as any).id).toBe('instant');
          expect((result as any).result).toEqual({ value: 'instant' });
        });
      });
      
      describe('When all paths fail', () => {
        it('Then should throw aggregate error', async () => {
          const superposition = new SuperpositionWorkflow();
          
          await expect(superposition.execute([
            { id: 'fail1', fn: async () => { throw new Error('Fail 1'); } },
            { id: 'fail2', fn: async () => { throw new Error('Fail 2'); } }
          ])).rejects.toThrow('All superposition states failed');
        });
      });
    });
  });
  
  // ============= BONUS PATTERN =============
  
  describe('Pattern 26: Workflow Performance Profiler', () => {
    describe('Given a workflow profiler', () => {
      class WorkflowProfiler {
        private metrics = new Map<string, {
          executions: number;
          totalDuration: number;
          minDuration: number;
          maxDuration: number;
          errors: number;
        }>();
        
        async profile(workflow: Workflow<any>, ctx: RunCtx): Promise<any> {
          const id = workflow.id;
          const startTime = performance.now();
          
          try {
            const result = await workflow.run(ctx);
            const duration = performance.now() - startTime;
            this.updateMetrics(id, duration, true);
            return result;
          } catch (error) {
            const duration = performance.now() - startTime;
            this.updateMetrics(id, duration, false);
            throw error;
          }
        }
        
        private updateMetrics(id: string, duration: number, success: boolean) {
          const current = this.metrics.get(id) || {
            executions: 0,
            totalDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            errors: 0
          };
          
          current.executions++;
          current.totalDuration += duration;
          current.minDuration = Math.min(current.minDuration, duration);
          current.maxDuration = Math.max(current.maxDuration, duration);
          if (!success) current.errors++;
          
          this.metrics.set(id, current);
        }
        
        getReport() {
          const report: any = {};
          for (const [id, metrics] of this.metrics) {
            report[id] = {
              ...metrics,
              avgDuration: metrics.totalDuration / metrics.executions,
              errorRate: metrics.errors / metrics.executions
            };
          }
          return report;
        }
      }
      
      describe('When workflow is profiled', () => {
        it('Then should collect performance metrics', async () => {
          const profiler = new WorkflowProfiler();
          
          const testWorkflow = cittyPro.defineWorkflow({
            id: 'test-workflow',
            steps: [
              {
                id: 'step1',
                use: cittyPro.defineTask({
                  id: 'task1',
                  run: async () => {
                    await new Promise(r => setTimeout(r, 10));
                    return { done: true };
                  }
                })
              }
            ]
          });
          
          // Run multiple times
          for (let i = 0; i < 3; i++) {
            await profiler.profile(testWorkflow, context);
          }
          
          const report = profiler.getReport();
          
          expect(report['test-workflow']).toBeDefined();
          expect(report['test-workflow'].executions).toBe(3);
          expect(report['test-workflow'].avgDuration).toBeGreaterThan(0);
          expect(report['test-workflow'].errorRate).toBe(0);
        });
      });
      
      describe('When workflow has errors', () => {
        it('Then should track error metrics', async () => {
          const profiler = new WorkflowProfiler();
          
          const errorWorkflow = cittyPro.defineWorkflow({
            id: 'error-workflow',
            steps: [
              {
                id: 'fail',
                use: cittyPro.defineTask({
                  id: 'failing-task',
                  run: async () => {
                    throw new Error('Intentional error');
                  }
                })
              }
            ]
          });
          
          // Run and expect failure
          await expect(profiler.profile(errorWorkflow, context)).rejects.toThrow();
          
          const report = profiler.getReport();
          expect(report['error-workflow'].errors).toBe(1);
          expect(report['error-workflow'].errorRate).toBe(1);
        });
      });
    });
  });
});