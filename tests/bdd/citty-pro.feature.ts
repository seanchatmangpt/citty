// tests/bdd/citty-pro.feature.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import { z } from 'zod';

// Import all the framework components
import { hooks, registerCoreHooks } from '../../src/pro/hooks';
import { runLifecycle } from '../../src/pro/lifecycle';
import { defineTask } from '../../src/pro/task';
import { defineWorkflow } from '../../src/pro/workflow';
import { defineAIWrapperCommand } from '../../src/pro/ai-wrapper-command';
import { registerPlugin, applyPlugins } from '../../src/pro/plugins/index';

import type {
  RunCtx,
  Command,
  ArgsDef,
  TaskSpec,
  Plugin,
  AIWrapperCommandSpec,
  ProviderAIModel
} from '../../src/types/citty-pro.d.ts';

/**
 * BDD Feature Tests for Citty Pro Framework
 * 
 * These tests follow Gherkin-style syntax to describe the behavior
 * of the Citty Pro framework from a user's perspective.
 */

describe('Feature: Citty Pro Framework Core Functionality', () => {
  let mockCtx: RunCtx;
  let mockConsoleLog: any;
  let mockConsoleError: any;

  beforeEach(() => {
    mockCtx = {
      cwd: faker.system.directoryPath(),
      env: { NODE_ENV: 'test' },
      now: () => new Date()
    };
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Scenario: Complete CLI Application Lifecycle', () => {
    it('Given a CLI application with hooks, When executed, Then all lifecycle phases complete', async () => {
      // Given a CLI application with lifecycle hooks
      const lifecyclePhases: string[] = [];
      
      // Register hooks to track lifecycle
      registerCoreHooks();
      hooks.hook('cli:boot', () => lifecyclePhases.push('boot'));
      hooks.hook('config:load', () => lifecyclePhases.push('config'));
      hooks.hook('ctx:ready', () => lifecyclePhases.push('context'));
      hooks.hook('args:parsed', () => lifecyclePhases.push('args'));
      hooks.hook('command:resolved', () => lifecyclePhases.push('command'));
      hooks.hook('workflow:compile', () => lifecyclePhases.push('workflow'));
      hooks.hook('output:will:emit', () => lifecyclePhases.push('output'));
      hooks.hook('cli:done', () => lifecyclePhases.push('done'));

      const mockCommand: Command = {
        meta: { name: 'test-cli', version: '1.0.0' },
        run: vi.fn().mockResolvedValue({ text: 'CLI executed successfully' })
      };

      // When the CLI is executed
      await runLifecycle({
        cmd: mockCommand,
        args: { _: [] },
        ctx: mockCtx,
        runStep: async () => ({ text: 'Success' })
      });

      // Then all lifecycle phases should complete in order
      expect(lifecyclePhases).toEqual([
        'boot', 'config', 'context', 'args', 'command', 
        'workflow', 'output', 'done'
      ]);
    });
  });

  describe('Scenario: Task-Based Workflow Execution', () => {
    it('Given a workflow with multiple tasks, When executed, Then tasks run in sequence with state accumulation', async () => {
      // Given a workflow with multiple interconnected tasks
      const userValidationTask = defineTask({
        id: 'validate-user',
        in: z.object({
          name: z.string().min(1),
          email: z.string().email()
        }),
        out: z.object({
          valid: z.boolean(),
          user: z.object({
            name: z.string(),
            email: z.string(),
            id: z.string()
          })
        }),
        run: async (input) => ({
          valid: true,
          user: {
            ...input,
            id: faker.string.uuid()
          }
        })
      });

      const notificationTask = defineTask({
        id: 'send-notification',
        in: z.object({
          user: z.object({
            name: z.string(),
            email: z.string(),
            id: z.string()
          }),
          message: z.string()
        }),
        out: z.object({
          sent: z.boolean(),
          messageId: z.string()
        }),
        run: async (input) => ({
          sent: true,
          messageId: faker.string.uuid()
        })
      });

      const workflow = defineWorkflow({
        id: 'user-onboarding',
        seed: {
          rawUser: {
            name: faker.person.fullName(),
            email: faker.internet.email()
          },
          welcomeMessage: 'Welcome to our platform!'
        },
        steps: [
          {
            id: 'validation',
            use: userValidationTask,
            select: (state) => state.rawUser
          },
          {
            id: 'notification',
            use: notificationTask,
            select: (state) => ({
              user: state.validation.user,
              message: state.welcomeMessage
            })
          }
        ]
      });

      // When the workflow is executed
      const result = await workflow.run(mockCtx);

      // Then the workflow should complete with accumulated state
      expect(result).toHaveProperty('rawUser');
      expect(result).toHaveProperty('welcomeMessage');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('notification');
      
      expect(result.validation.valid).toBe(true);
      expect(result.validation.user.id).toBeDefined();
      expect(result.notification.sent).toBe(true);
      expect(result.notification.messageId).toBeDefined();
    });
  });

  describe('Scenario: AI-Powered Command with Tool Integration', () => {
    it('Given an AI command with tools, When AI makes tool calls, Then tools execute and return results', async () => {
      // Given an AI-powered command with integrated tools
      const calculatorTool = {
        description: 'Performs mathematical calculations',
        schema: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number(),
          b: z.number()
        }),
        execute: ({ operation, a, b }: { operation: string, a: number, b: number }) => {
          switch (operation) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': return b !== 0 ? a / b : 'Cannot divide by zero';
            default: return 'Unknown operation';
          }
        }
      };

      const fileManagerTool = {
        description: 'Manages file operations',
        schema: z.object({
          action: z.enum(['create', 'read', 'delete']),
          filename: z.string(),
          content: z.string().optional()
        }),
        execute: ({ action, filename, content }: any) => {
          switch (action) {
            case 'create': return `File ${filename} created with content: ${content}`;
            case 'read': return `Reading content of ${filename}`;
            case 'delete': return `File ${filename} deleted`;
            default: return 'Unknown file operation';
          }
        }
      };

      const toolCalls: Array<{ name: string; args: any; result: any }> = [];

      const mockModel: ProviderAIModel = {
        id: 'ai-assistant',
        vendor: 'ollama',
        options: { temperature: 0.7 }
      };

      const aiCommand = defineAIWrapperCommand<{ request: any }, RunCtx>({
        meta: {
          name: 'ai-assistant',
          description: 'AI-powered assistant with tools'
        },
        args: {
          request: { type: 'string', description: 'Your request for the AI assistant' }
        },
        ai: {
          model: mockModel,
          tools: {
            calculator: calculatorTool,
            fileManager: fileManagerTool
          },
          system: 'You are a helpful AI assistant with access to calculator and file management tools.'
        },
        plan: (args) => `Create a plan to handle: ${args.request}`,
        onToolCall: async (toolName, toolArgs, ctx) => {
          const tool = toolName === 'calculator' ? calculatorTool : fileManagerTool;
          const result = await tool.execute(toolArgs as any);
          toolCalls.push({ name: toolName, args: toolArgs, result });
        },
        run: async (args, ctx) => {
          // Simulate AI making tool calls
          const mockResponse = {
            text: 'I will help you with calculations and file operations.',
            toolCalls: [
              { name: 'calculator', args: { operation: 'add', a: 10, b: 5 } },
              { name: 'fileManager', args: { action: 'create', filename: 'result.txt', content: '15' } }
            ]
          };

          // Mock AI generate function that returns tool calls
          const aiCtx = ctx as RunCtx & { ai: any };
          aiCtx.ai = {
            model: mockModel,
            generate: async ({ prompt, tools }: any) => mockResponse
          };

          const response = await aiCtx.ai.generate({
            prompt: args.request,
            tools: { calculator: calculatorTool, fileManager: fileManagerTool }
          });

          // Process tool calls
          if (response.toolCalls) {
            for (const toolCall of response.toolCalls) {
              const tool = toolCall.name === 'calculator' ? calculatorTool : fileManagerTool;
              const result = await tool.execute(toolCall.args);
              toolCalls.push({ name: toolCall.name, args: toolCall.args, result });
            }
          }

          return {
            text: `AI Response: ${response.text}\nTool Results: ${toolCalls.map(tc => tc.result).join(', ')}`
          };
        }
      });

      // When the AI command is executed with a request
      const result = await aiCommand.run({
        args: { request: 'Calculate 10 + 5 and save the result to a file', _: [] },
        rawArgs: [],
        cmd: aiCommand,
        ctx: mockCtx
      });

      // Then the AI should use tools and return comprehensive results
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0]).toMatchObject({
        name: 'calculator',
        args: { operation: 'add', a: 10, b: 5 },
        result: 15
      });
      expect(toolCalls[1]).toMatchObject({
        name: 'fileManager',
        args: { action: 'create', filename: 'result.txt', content: '15' }
      });
      expect(result.text).toContain('AI Response:');
      expect(result.text).toContain('Tool Results:');
    });
  });

  describe('Scenario: Plugin System with Lifecycle Integration', () => {
    it('Given plugins that extend functionality, When applied, Then they integrate with hooks and context', async () => {
      // Given multiple plugins that extend the framework
      const telemetryData: Record<string, any> = {};
      const auditLog: Array<{ event: string; timestamp: number; data?: any }> = [];

      const telemetryPlugin: Plugin = async (hooks, ctx) => {
        telemetryData.startTime = Date.now();
        telemetryData.environment = ctx.env.NODE_ENV;
        
        hooks.hook('cli:boot', ({ argv }) => {
          telemetryData.arguments = argv;
        });
        
        hooks.hook('cli:done', () => {
          telemetryData.endTime = Date.now();
          telemetryData.duration = telemetryData.endTime - telemetryData.startTime;
        });

        // Extend context with telemetry functions
        (ctx as any).telemetry = {
          recordMetric: (name: string, value: number) => {
            telemetryData[name] = value;
          }
        };
      };

      const auditPlugin: Plugin = async (hooks, ctx) => {
        const log = (event: string, data?: any) => {
          auditLog.push({ event, timestamp: Date.now(), data });
        };

        hooks.hook('cli:boot', ({ argv }) => log('cli_started', { argv }));
        hooks.hook('command:resolved', ({ name }) => log('command_resolved', { name }));
        hooks.hook('task:will:call', ({ id, input }) => log('task_started', { id }));
        hooks.hook('task:did:call', ({ id, res }) => log('task_completed', { id }));
        hooks.hook('output:will:emit', ({ out }) => log('output_generated', { hasText: !!out.text }));
        hooks.hook('cli:done', () => log('cli_completed'));

        // Extend context with audit functions
        (ctx as any).audit = { log };
      };

      const cachePlugin: Plugin = async (hooks, ctx) => {
        const cache = new Map<string, any>();

        (ctx as any).cache = {
          get: (key: string) => cache.get(key),
          set: (key: string, value: any) => cache.set(key, value),
          has: (key: string) => cache.has(key),
          clear: () => cache.clear()
        };

        hooks.hook('cli:done', () => {
          (ctx as any).telemetry?.recordMetric('cache_size', cache.size);
        });
      };

      // Register all plugins
      registerPlugin('telemetry', telemetryPlugin);
      registerPlugin('audit', auditPlugin);
      registerPlugin('cache', cachePlugin);

      // Apply plugins to enhance the context
      await applyPlugins(hooks, mockCtx);

      // Create a task that uses the enhanced context
      const enhancedTask = defineTask({
        id: 'enhanced-processing',
        run: async (input: string, ctx: any) => {
          // Use cache
          const cacheKey = `processed_${input}`;
          if (ctx.cache.has(cacheKey)) {
            return ctx.cache.get(cacheKey);
          }

          // Process and cache result
          const result = `Processed: ${input}`;
          ctx.cache.set(cacheKey, result);
          
          // Record telemetry
          ctx.telemetry.recordMetric('items_processed', 1);
          
          // Log audit event
          ctx.audit.log('item_processed', { input, result });
          
          return result;
        }
      });

      // When a command uses the enhanced context
      await runLifecycle({
        cmd: {
          meta: { name: 'enhanced-cli' },
          run: vi.fn()
        },
        args: { _: [] },
        ctx: mockCtx,
        runStep: async (ctx) => {
          const result = await enhancedTask.call('test-input', ctx as any);
          return { text: result };
        }
      });

      // Then all plugins should work together seamlessly
      
      // Telemetry should be recorded
      expect(telemetryData.startTime).toBeDefined();
      expect(telemetryData.endTime).toBeDefined();
      expect(telemetryData.duration).toBeGreaterThanOrEqual(0);
      expect(telemetryData.environment).toBe('test');
      expect(telemetryData.items_processed).toBe(1);
      expect(telemetryData.cache_size).toBe(1);

      // Audit log should contain all events
      const eventNames = auditLog.map(entry => entry.event);
      expect(eventNames).toContain('cli_started');
      expect(eventNames).toContain('command_resolved');
      expect(eventNames).toContain('task_started');
      expect(eventNames).toContain('task_completed');
      expect(eventNames).toContain('output_generated');
      expect(eventNames).toContain('cli_completed');
      expect(eventNames).toContain('item_processed');

      // Context should have all plugin extensions
      expect((mockCtx as any).telemetry).toBeDefined();
      expect((mockCtx as any).audit).toBeDefined();
      expect((mockCtx as any).cache).toBeDefined();
    });
  });

  describe('Scenario: Error Handling Across Framework Components', () => {
    it('Given components that may fail, When errors occur, Then they are handled gracefully', async () => {
      // Given a scenario where different components may fail
      const errorLog: Array<{ component: string; error: string; handled: boolean }> = [];

      // Task that may fail
      const unreliableTask = defineTask({
        id: 'unreliable-task',
        run: async (input: { shouldFail: boolean; data: string }) => {
          if (input.shouldFail) {
            throw new Error(`Task failed processing: ${input.data}`);
          }
          return `Successfully processed: ${input.data}`;
        }
      });

      // Plugin that handles errors
      const errorHandlingPlugin: Plugin = async (hooks, ctx) => {
        hooks.hook('task:did:call', ({ id, res }: any) => {
          if (res.error) {
            errorLog.push({
              component: 'task',
              error: res.error,
              handled: true
            });
          }
        });

        (ctx as any).errorHandler = {
          handleError: (component: string, error: Error) => {
            errorLog.push({
              component,
              error: error.message,
              handled: true
            });
          }
        };
      };

      registerPlugin('error-handling', errorHandlingPlugin);
      await applyPlugins(hooks, mockCtx);

      // Workflow with error recovery
      const resilientWorkflow = defineWorkflow({
        id: 'resilient-workflow',
        seed: {
          tasks: [
            { shouldFail: false, data: 'first-item' },
            { shouldFail: true, data: 'second-item' },  // This will fail
            { shouldFail: false, data: 'third-item' }
          ]
        },
        steps: [
          {
            id: 'processFirst',
            use: unreliableTask,
            select: (state) => state.tasks[0]
          },
          {
            id: 'processSecond',
            use: async (state: any, ctx: any) => {
              try {
                return await unreliableTask.call(state.tasks[1], ctx);
              } catch (error) {
                ctx.errorHandler.handleError('workflow', error as Error);
                return `Error handled: ${(error as Error).message}`;
              }
            }
          },
          {
            id: 'processThird',
            use: unreliableTask,
            select: (state) => state.tasks[2]
          }
        ]
      });

      // When the workflow executes with mixed success/failure scenarios
      const result = await resilientWorkflow.run(mockCtx as any);

      // Then errors should be handled gracefully without stopping execution
      expect(result.processFirst).toBe('Successfully processed: first-item');
      expect(result.processSecond).toContain('Error handled:');
      expect(result.processThird).toBe('Successfully processed: third-item');

      // Error handling should be logged
      expect(errorLog).toHaveLength(2); // One from task hook, one from workflow handler
      expect(errorLog.every(entry => entry.handled)).toBe(true);
    });
  });

  describe('Scenario: Complete End-to-End Application Flow', () => {
    it('Given a full application with all framework features, When executed, Then it demonstrates complete integration', async () => {
      // Given a complete application that uses all framework features
      const applicationState = {
        users: [] as Array<{ id: string; name: string; email: string }>,
        metrics: {} as Record<string, number>,
        events: [] as Array<{ type: string; data: any; timestamp: number }>
      };

      // 1. Set up comprehensive plugin system
      const fullStackPlugin: Plugin = async (hooks, ctx) => {
        // Add database simulation
        (ctx as any).db = {
          users: applicationState.users,
          save: (user: any) => {
            applicationState.users.push({ ...user, id: faker.string.uuid() });
            return applicationState.users[applicationState.users.length - 1];
          },
          findByEmail: (email: string) => 
            applicationState.users.find(u => u.email === email)
        };

        // Add event system
        (ctx as any).events = {
          emit: (type: string, data: any) => {
            applicationState.events.push({ type, data, timestamp: Date.now() });
          }
        };

        // Add metrics
        (ctx as any).metrics = {
          increment: (key: string) => {
            applicationState.metrics[key] = (applicationState.metrics[key] || 0) + 1;
          },
          record: (key: string, value: number) => {
            applicationState.metrics[key] = value;
          }
        };

        // Hook into lifecycle
        hooks.hook('cli:boot', () => {
          (ctx as any).metrics.increment('app_starts');
        });
        
        hooks.hook('task:did:call', () => {
          (ctx as any).metrics.increment('tasks_executed');
        });
      };

      registerPlugin('full-stack', fullStackPlugin);
      await applyPlugins(hooks, mockCtx);

      // 2. Define business logic tasks
      const validateUserTask = defineTask({
        id: 'validate-user',
        in: z.object({
          name: z.string().min(1),
          email: z.string().email()
        }),
        run: async (input, ctx: any) => {
          const existing = ctx.db.findByEmail(input.email);
          if (existing) {
            throw new Error(`User with email ${input.email} already exists`);
          }
          return { valid: true, user: input };
        }
      });

      const createUserTask = defineTask({
        id: 'create-user',
        run: async (input: { user: { name: string; email: string } }, ctx: any) => {
          const savedUser = ctx.db.save(input.user);
          ctx.events.emit('user_created', savedUser);
          ctx.metrics.increment('users_created');
          return savedUser;
        }
      });

      const sendWelcomeTask = defineTask({
        id: 'send-welcome',
        run: async (input: { user: { name: string; email: string; id: string } }, ctx: any) => {
          ctx.events.emit('welcome_sent', { userId: input.user.id });
          ctx.metrics.increment('welcome_emails_sent');
          return {
            sent: true,
            messageId: faker.string.uuid(),
            recipient: input.user.email
          };
        }
      });

      // 3. Create comprehensive workflow
      const userRegistrationWorkflow = defineWorkflow({
        id: 'user-registration',
        seed: (ctx: any) => ({
          startTime: ctx.now().getTime(),
          requestId: faker.string.uuid()
        }),
        steps: [
          {
            id: 'validation',
            use: validateUserTask,
            select: (state) => state.userData
          },
          {
            id: 'creation',
            use: createUserTask,
            select: (state) => ({ user: state.validation.user })
          },
          {
            id: 'welcome',
            use: sendWelcomeTask,
            select: (state) => ({ user: state.creation })
          },
          {
            id: 'completion',
            use: (state: any, ctx: any) => {
              const endTime = ctx.now().getTime();
              const duration = endTime - state.startTime;
              ctx.metrics.record('registration_duration', duration);
              return {
                success: true,
                userId: state.creation.id,
                duration,
                requestId: state.requestId
              };
            }
          }
        ]
      });

      // 4. Create AI-powered command that orchestrates everything
      const userRegistrationCommand = defineAIWrapperCommand({
        meta: {
          name: 'register-user',
          description: 'Register a new user with AI assistance'
        },
        args: {
          name: { type: 'string', description: 'User name' },
          email: { type: 'string', description: 'User email' }
        },
        ai: {
          model: { id: 'registration-assistant', vendor: 'ollama' },
          system: 'You are a user registration assistant that helps validate and process user data.',
          tools: {
            validateEmail: {
              description: 'Validate email format and domain',
              schema: z.object({ email: z.string().email() }),
              execute: ({ email }) => ({
                valid: email.includes('@') && email.includes('.'),
                domain: email.split('@')[1]
              })
            }
          }
        },
        plan: (args) => 
          `Plan to register user ${args.name} with email ${args.email}`,
        run: async (args, ctx: any) => {
          // Set up workflow data
          const workflowState = {
            userData: {
              name: args.name,
              email: args.email
            }
          };

          // Execute the complete workflow
          const workflow = defineWorkflow({
            ...userRegistrationWorkflow,
            seed: { ...workflowState, startTime: ctx.now().getTime(), requestId: faker.string.uuid() }
          });

          try {
            const result = await workflow.run(ctx);
            
            return {
              text: `User registration completed successfully!`,
              json: {
                success: true,
                user: result.creation,
                welcome: result.welcome,
                completion: result.completion,
                metrics: applicationState.metrics,
                events: applicationState.events.slice(-5) // Last 5 events
              }
            };
          } catch (error) {
            ctx.metrics.increment('registration_errors');
            return {
              text: `Registration failed: ${(error as Error).message}`,
              json: {
                success: false,
                error: (error as Error).message,
                metrics: applicationState.metrics
              }
            };
          }
        }
      });

      // When the complete application flow is executed
      const userData = {
        name: faker.person.fullName(),
        email: faker.internet.email()
      };

      const result = await runLifecycle({
        cmd: userRegistrationCommand,
        args: { ...userData, _: [] },
        ctx: mockCtx,
        runStep: async (ctx) => {
          return await userRegistrationCommand.run({
            args: { ...userData, _: [] },
            rawArgs: [],
            cmd: userRegistrationCommand,
            ctx
          });
        }
      });

      // Then the complete application should work seamlessly
      
      // User should be created
      expect(applicationState.users).toHaveLength(1);
      expect(applicationState.users[0].name).toBe(userData.name);
      expect(applicationState.users[0].email).toBe(userData.email);
      expect(applicationState.users[0].id).toBeDefined();

      // Metrics should be tracked
      expect(applicationState.metrics.app_starts).toBe(1);
      expect(applicationState.metrics.tasks_executed).toBeGreaterThan(0);
      expect(applicationState.metrics.users_created).toBe(1);
      expect(applicationState.metrics.welcome_emails_sent).toBe(1);
      expect(applicationState.metrics.registration_duration).toBeDefined();

      // Events should be recorded
      const eventTypes = applicationState.events.map(e => e.type);
      expect(eventTypes).toContain('user_created');
      expect(eventTypes).toContain('welcome_sent');

      // Output should be comprehensive
      expect(result).toBeUndefined(); // runLifecycle returns void but logs output
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('User registration completed successfully!')
      );
    });
  });
});