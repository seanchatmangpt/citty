// tests/unit/citty-pro-ai-wrapper.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { z } from 'zod';
import { defineAIWrapperCommand } from '../../src/pro/ai-wrapper-command';
import type { 
  AIWrapperCommandSpec, 
  Command, 
  RunCtx, 
  AITool,
  ProviderAIModel,
  ArgsDef 
} from '../../src/types/citty-pro.d.ts';

describe('Citty Pro AI Wrapper Commands', () => {
  let mockConsoleLog: any;

  beforeEach(() => {
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('Basic AI Wrapper Command Creation', () => {
    it('should create AI wrapper command with basic configuration', async () => {
      // Arrange
      const mockModel: ProviderAIModel = {
        id: faker.string.uuid(),
        vendor: 'ollama',
        options: { temperature: 0.7 }
      };

      const spec: AIWrapperCommandSpec<ArgsDef, RunCtx> = {
        meta: {
          name: faker.lorem.word(),
          description: faker.lorem.sentence()
        },
        args: {
          input: { type: 'string', description: 'Input text' }
        },
        ai: {
          model: mockModel,
          system: 'You are a helpful assistant'
        },
        run: async (args, ctx) => ({
          text: `Processed: ${args.input}`
        })
      };

      // Act
      const command = defineAIWrapperCommand(spec);

      // Assert
      expect(command.meta).toEqual(spec.meta);
      expect(command.args).toEqual(spec.args);
    });

    it('should execute command with AI context integration', async () => {
      // Arrange
      const mockModel: ProviderAIModel = {
        id: 'test-model',
        vendor: 'ollama'
      };

      const mockGenerateResponse = {
        text: faker.lorem.paragraph(),
        toolCalls: []
      };

      const mockBaseAI = {
        generate: vi.fn().mockResolvedValue(mockGenerateResponse)
      };

      const spec: AIWrapperCommandSpec<{ prompt: any }, RunCtx> = {
        meta: { name: 'ai-test' },
        args: {
          prompt: { type: 'string', description: 'AI prompt' }
        },
        ai: {
          model: mockModel,
          system: 'Test system prompt'
        },
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({
            prompt: args.prompt,
            system: 'Custom system'
          });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { prompt: faker.lorem.sentence(), _: [] };

      // Act
      const result = await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(mockBaseAI.generate).toHaveBeenCalledWith({
        prompt: args.prompt,
        tools: {},
        system: 'Custom system'
      });
      expect(result.text).toBe(mockGenerateResponse.text);
    });
  });

  describe('AI Tools Integration', () => {
    it('should register and merge AI tools correctly', async () => {
      // Arrange
      const calculatorTool: AITool = {
        description: 'Performs mathematical calculations',
        schema: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number(),
          b: z.number()
        }),
        execute: ({ operation, a, b }) => {
          switch (operation) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': return b !== 0 ? a / b : 'Division by zero';
          }
        }
      };

      const mockModel: ProviderAIModel = {
        id: 'math-model',
        vendor: 'ollama'
      };

      const mockBaseAI = {
        generate: vi.fn().mockResolvedValue({
          text: 'Calculation result',
          toolCalls: []
        })
      };

      const spec: AIWrapperCommandSpec<{ query: any }, RunCtx> = {
        meta: { name: 'math-ai' },
        args: {
          query: { type: 'string', description: 'Math query' }
        },
        ai: {
          model: mockModel,
          tools: { calculator: calculatorTool },
          system: 'You are a math assistant'
        },
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({
            prompt: args.query,
            tools: { 
              extra_tool: {
                description: 'Extra tool',
                schema: z.string(),
                execute: (input) => `Extra: ${input}`
              }
            }
          });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { query: 'What is 2 + 3?', _: [] };

      // Act
      await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(mockBaseAI.generate).toHaveBeenCalledWith({
        prompt: args.query,
        tools: expect.objectContaining({
          calculator: calculatorTool,
          extra_tool: expect.any(Object)
        }),
        system: 'You are a math assistant'
      });
    });

    it('should handle tool call callbacks', async () => {
      // Arrange
      const mockTool: AITool = {
        description: 'Test tool',
        schema: z.object({ value: z.string() }),
        execute: ({ value }) => `Processed: ${value}`
      };

      const mockModel: ProviderAIModel = {
        id: 'tool-model',
        vendor: 'ollama'
      };

      const toolCallResults: Array<{ name: string; args: any }> = [];
      const onToolCall = vi.fn().mockImplementation((name, args) => {
        toolCallResults.push({ name, args });
      });

      const mockBaseAI = {
        generate: vi.fn().mockResolvedValue({
          text: 'Tool response',
          toolCalls: [
            { name: 'test_tool', args: { value: faker.lorem.word() } },
            { name: 'test_tool', args: { value: faker.lorem.word() } }
          ]
        })
      };

      const spec: AIWrapperCommandSpec<{ input: any }, RunCtx> = {
        meta: { name: 'tool-test' },
        args: {
          input: { type: 'string', description: 'Input' }
        },
        ai: {
          model: mockModel,
          tools: { test_tool: mockTool }
        },
        onToolCall,
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({
            prompt: args.input
          });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { input: faker.lorem.sentence(), _: [] };

      // Act
      await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(onToolCall).toHaveBeenCalledTimes(2);
      expect(toolCallResults).toHaveLength(2);
      toolCallResults.forEach(result => {
        expect(result.name).toBe('test_tool');
        expect(result.args).toHaveProperty('value');
      });
    });
  });

  describe('Planning Integration', () => {
    it('should execute planning phase when planner provided', async () => {
      // Arrange
      const mockModel: ProviderAIModel = {
        id: 'planning-model',
        vendor: 'anthropic'
      };

      const mockBaseAI = {
        generate: vi.fn()
          .mockResolvedValueOnce({ text: 'Planning complete', toolCalls: [] }) // Plan call
          .mockResolvedValueOnce({ text: 'Execution complete', toolCalls: [] }) // Main call
      };

      const plannerPrompt = faker.lorem.paragraph();
      const spec: AIWrapperCommandSpec<{ task: any }, RunCtx> = {
        meta: { name: 'planning-command' },
        args: {
          task: { type: 'string', description: 'Task description' }
        },
        ai: {
          model: mockModel,
          system: 'You are a planner'
        },
        plan: (args, ctx) => `Plan for: ${args.task}. Context: ${ctx.cwd}`,
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({
            prompt: `Execute: ${args.task}`
          });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { task: faker.lorem.sentence(), _: [] };

      // Act
      await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(mockBaseAI.generate).toHaveBeenCalledTimes(2);
      expect(mockBaseAI.generate).toHaveBeenNthCalledWith(1, {
        prompt: `Plan for: ${args.task}. Context: ${mockCtx.cwd}`,
        tools: {},
        system: 'You are a planner'
      });
      expect(mockBaseAI.generate).toHaveBeenNthCalledWith(2, {
        prompt: `Execute: ${args.task}`,
        tools: {},
        system: 'You are a planner'
      });
    });
  });

  describe('Fallback AI Generation', () => {
    it('should use simulated AI when no base generator available', async () => {
      // Arrange
      const mockModel: ProviderAIModel = {
        id: 'fallback-model',
        vendor: 'local'
      };

      const spec: AIWrapperCommandSpec<{ prompt: any }, RunCtx> = {
        meta: { name: 'fallback-test' },
        args: {
          prompt: { type: 'string', description: 'Prompt' }
        },
        ai: {
          model: mockModel,
          system: 'Test system'
        },
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({
            prompt: args.prompt
          });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
        // No AI provided - should use fallback
      };

      const command = defineAIWrapperCommand(spec);
      const args = { prompt: faker.lorem.sentence(), _: [] };

      // Act
      const result = await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('[AI] Model:', mockModel.id);
      expect(mockConsoleLog).toHaveBeenCalledWith('[AI] Prompt:', args.prompt);
      expect(result.text).toContain('[Simulated AI response for:');
      expect(result.text).toContain(args.prompt);
    });

    it('should log tools when using fallback AI', async () => {
      // Arrange
      const mockModel: ProviderAIModel = {
        id: 'tools-model',
        vendor: 'local'
      };

      const testTool: AITool = {
        description: 'Test tool',
        schema: z.string(),
        execute: (input) => input
      };

      const spec: AIWrapperCommandSpec<{ input: any }, RunCtx> = {
        meta: { name: 'tools-fallback' },
        args: {
          input: { type: 'string', description: 'Input' }
        },
        ai: {
          model: mockModel,
          tools: { test_tool: testTool, another_tool: testTool }
        },
        run: async (args, ctx) => {
          await ctx.ai!.generate({
            prompt: args.input,
            tools: { extra_tool: testTool }
          });
          return { text: 'done' };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      const command = defineAIWrapperCommand(spec);
      const args = { input: faker.lorem.word(), _: [] };

      // Act
      await command.run({ 
        args, 
        rawArgs: [], 
        cmd: command, 
        ctx: mockCtx 
      });

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[AI] Tools:', 
        expect.stringContaining('test_tool')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[AI] Tools:', 
        expect.stringContaining('extra_tool')
      );
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary command configurations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1 }),
          description: fc.string(),
          modelId: fc.string({ minLength: 1 }),
          system: fc.string()
        }),
        async (config) => {
          // Arrange
          const mockModel: ProviderAIModel = {
            id: config.modelId,
            vendor: 'ollama'
          };

          const spec: AIWrapperCommandSpec<{ text: any }, RunCtx> = {
            meta: {
              name: config.name,
              description: config.description
            },
            args: {
              text: { type: 'string', description: 'Input text' }
            },
            ai: {
              model: mockModel,
              system: config.system
            },
            run: async (args) => ({ text: `Processed: ${args.text}` })
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act
          const command = defineAIWrapperCommand(spec);
          const result = await command.run({
            args: { text: faker.lorem.word(), _: [] },
            rawArgs: [],
            cmd: command,
            ctx: mockCtx
          });

          // Assert
          expect(command.meta?.name).toBe(config.name);
          expect(command.meta?.description).toBe(config.description);
          expect(result).toHaveProperty('text');
        }
      ));
    });

    it('should handle arbitrary tool configurations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1 }),
            description: fc.string()
          }),
          { minLength: 0, maxLength: 3 }
        ),
        async (toolConfigs) => {
          // Arrange
          const tools: Record<string, AITool> = {};
          toolConfigs.forEach(({ name, description }) => {
            tools[name] = {
              description,
              schema: z.string(),
              execute: (input) => `Tool ${name}: ${input}`
            };
          });

          const mockModel: ProviderAIModel = {
            id: faker.string.uuid(),
            vendor: 'ollama'
          };

          const spec: AIWrapperCommandSpec<{ input: any }, RunCtx> = {
            ai: { model: mockModel, tools },
            run: async () => ({ text: 'success' })
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act & Assert - Should not throw
          const command = defineAIWrapperCommand(spec);
          await expect(command.run({
            args: { input: faker.lorem.word(), _: [] },
            rawArgs: [],
            cmd: command,
            ctx: mockCtx
          })).resolves.toBeDefined();
        }
      ));
    });
  });

  describe('Error Handling', () => {
    it('should handle AI generation errors gracefully', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const mockBaseAI = {
        generate: vi.fn().mockRejectedValue(new Error(errorMessage))
      };

      const spec: AIWrapperCommandSpec<{ prompt: any }, RunCtx> = {
        ai: {
          model: { id: 'error-model', vendor: 'ollama' }
        },
        run: async (args, ctx) => {
          await ctx.ai!.generate({ prompt: args.prompt });
          return { text: 'success' };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { prompt: faker.lorem.sentence(), _: [] };

      // Act & Assert
      await expect(command.run({
        args,
        rawArgs: [],
        cmd: command,
        ctx: mockCtx
      })).rejects.toThrow(errorMessage);
    });

    it('should handle tool execution errors', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const errorTool: AITool = {
        description: 'Error tool',
        schema: z.string(),
        execute: () => {
          throw new Error(errorMessage);
        }
      };

      const mockBaseAI = {
        generate: vi.fn().mockResolvedValue({
          text: 'AI response',
          toolCalls: [{ name: 'error_tool', args: 'test' }]
        })
      };

      const spec: AIWrapperCommandSpec<{ input: any }, RunCtx> = {
        ai: {
          model: { id: 'error-tool-model', vendor: 'ollama' },
          tools: { error_tool: errorTool }
        },
        onToolCall: async (name, input, ctx) => {
          const tool = spec.ai.tools![name];
          if (tool) {
            tool.execute(input, ctx);
          }
        },
        run: async (args, ctx) => {
          const response = await ctx.ai!.generate({ prompt: args.input });
          return { text: response.text };
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date(),
        ai: mockBaseAI
      };

      const command = defineAIWrapperCommand(spec);
      const args = { input: faker.lorem.word(), _: [] };

      // Act & Assert
      await expect(command.run({
        args,
        rawArgs: [],
        cmd: command,
        ctx: mockCtx
      })).rejects.toThrow(errorMessage);
    });
  });

  describe('BDD-style Scenarios', () => {
    describe('Given an AI wrapper command with tools', () => {
      describe('When AI makes tool calls', () => {
        it('Then tools should be executed with correct parameters', async () => {
          // Given
          const weatherTool: AITool = {
            description: 'Get weather information',
            schema: z.object({
              city: z.string(),
              units: z.enum(['celsius', 'fahrenheit']).default('celsius')
            }),
            execute: ({ city, units }) => 
              `Weather in ${city}: 22°${units === 'celsius' ? 'C' : 'F'}`
          };

          const toolCallHandler = vi.fn();
          const mockBaseAI = {
            generate: vi.fn().mockResolvedValue({
              text: 'Here is the weather',
              toolCalls: [
                { name: 'weather', args: { city: 'Paris', units: 'celsius' } }
              ]
            })
          };

          const spec: AIWrapperCommandSpec<{ query: any }, RunCtx> = {
            ai: {
              model: { id: 'weather-model', vendor: 'openai' },
              tools: { weather: weatherTool }
            },
            onToolCall: toolCallHandler,
            run: async (args, ctx) => {
              const response = await ctx.ai!.generate({ prompt: args.query });
              return { text: response.text };
            }
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date(),
            ai: mockBaseAI
          };

          // When
          const command = defineAIWrapperCommand(spec);
          await command.run({
            args: { query: 'What is the weather in Paris?', _: [] },
            rawArgs: [],
            cmd: command,
            ctx: mockCtx
          });

          // Then
          expect(toolCallHandler).toHaveBeenCalledWith(
            'weather',
            { city: 'Paris', units: 'celsius' },
            expect.objectContaining({ ai: expect.any(Object) })
          );
        });
      });
    });

    describe('Given an AI wrapper command with planning', () => {
      describe('When the command is executed', () => {
        it('Then planning should occur before main execution', async () => {
          // Given
          const executionOrder: string[] = [];
          const mockBaseAI = {
            generate: vi.fn()
              .mockImplementationOnce(async ({ prompt }) => {
                executionOrder.push(`plan: ${prompt}`);
                return { text: 'Plan created', toolCalls: [] };
              })
              .mockImplementationOnce(async ({ prompt }) => {
                executionOrder.push(`execute: ${prompt}`);
                return { text: 'Task completed', toolCalls: [] };
              })
          };

          const spec: AIWrapperCommandSpec<{ task: any }, RunCtx> = {
            ai: { model: { id: 'planner-model', vendor: 'anthropic' } },
            plan: (args) => `Create plan for: ${args.task}`,
            run: async (args, ctx) => {
              const response = await ctx.ai!.generate({
                prompt: `Execute task: ${args.task}`
              });
              return { text: response.text };
            }
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date(),
            ai: mockBaseAI
          };

          // When
          const command = defineAIWrapperCommand(spec);
          const result = await command.run({
            args: { task: 'build website', _: [] },
            rawArgs: [],
            cmd: command,
            ctx: mockCtx
          });

          // Then
          expect(executionOrder).toEqual([
            'plan: Create plan for: build website',
            'execute: Execute task: build website'
          ]);
          expect(result.text).toBe('Task completed');
        });
      });
    });
  });
});