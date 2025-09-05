// tests/unit/citty-pro-tasks.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { z } from 'zod';
import { defineTask } from '../../src/pro/task';
import { hooks } from '../../src/pro/hooks';
import type { TaskSpec, Task, RunCtx } from '../../src/types/citty-pro.d.ts';

describe('Citty Pro Task System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup handled by fresh test instances
  });

  describe('Task Definition and Execution', () => {
    it('should create and execute a basic task', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const inputData = { message: faker.lorem.sentence() };
      const outputData = { result: faker.lorem.sentence() };
      const mockRunFn = vi.fn().mockResolvedValue(outputData);

      const taskSpec: TaskSpec<typeof inputData, typeof outputData> = {
        id: taskId,
        run: mockRunFn
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: { NODE_ENV: 'test' },
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      const result = await task.call(inputData, mockCtx);

      // Assert
      expect(task.id).toBe(taskId);
      expect(mockRunFn).toHaveBeenCalledWith(inputData, mockCtx);
      expect(result).toEqual(outputData);
    });

    it('should handle synchronous tasks', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const inputValue = faker.number.int();
      const outputValue = inputValue * 2;

      const taskSpec: TaskSpec<number, number> = {
        id: taskId,
        run: (input) => input * 2  // Synchronous function
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      const result = await task.call(inputValue, mockCtx);

      // Assert
      expect(result).toBe(outputValue);
    });

    it('should validate input with Zod schema', async () => {
      // Arrange
      const inputSchema = z.object({
        name: z.string().min(1),
        age: z.number().positive()
      });

      const taskSpec: TaskSpec<z.infer<typeof inputSchema>, string> = {
        id: faker.string.uuid(),
        in: inputSchema,
        run: (input) => `Hello ${input.name}, age ${input.age}`
      };

      const validInput = {
        name: faker.person.fullName(),
        age: faker.number.int({ min: 1, max: 100 })
      };

      const invalidInput = {
        name: '', // Invalid: empty string
        age: -5   // Invalid: negative number
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      const task = defineTask(taskSpec);

      // Act & Assert - Valid input
      const result = await task.call(validInput, mockCtx);
      expect(result).toBe(`Hello ${validInput.name}, age ${validInput.age}`);

      // Act & Assert - Invalid input
      await expect(task.call(invalidInput as any, mockCtx))
        .rejects.toThrow(/input validation failed/);
    });

    it('should validate output with Zod schema', async () => {
      // Arrange
      const outputSchema = z.object({
        success: z.boolean(),
        data: z.string()
      });

      const taskSpec: TaskSpec<string, z.infer<typeof outputSchema>> = {
        id: faker.string.uuid(),
        out: outputSchema,
        run: (input) => ({
          success: true,
          data: input.toUpperCase()
        })
      };

      const input = faker.lorem.word();
      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      const result = await task.call(input, mockCtx);

      // Assert
      expect(result).toMatchObject({
        success: true,
        data: input.toUpperCase()
      });
    });

    it('should handle output validation failures', async () => {
      // Arrange
      const outputSchema = z.object({
        required: z.string()
      });

      const taskSpec: TaskSpec<string, any> = {
        id: faker.string.uuid(),
        out: outputSchema,
        run: () => ({ wrong: 'format' }) // Invalid output
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      const task = defineTask(taskSpec);
      await expect(task.call('input', mockCtx))
        .rejects.toThrow(/output validation failed/);
    });
  });

  describe('Hook Integration', () => {
    it('should call pre and post hooks with correct data', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const inputData = { value: faker.lorem.word() };
      const outputData = { result: faker.lorem.word() };

      const preHook = vi.fn();
      const postHook = vi.fn();

      hooks.hook('task:will:call', preHook);
      hooks.hook('task:did:call', postHook);

      const taskSpec: TaskSpec<typeof inputData, typeof outputData> = {
        id: taskId,
        run: vi.fn().mockResolvedValue(outputData)
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      const result = await task.call(inputData, mockCtx);

      // Assert
      expect(preHook).toHaveBeenCalledWith({
        id: taskId,
        input: inputData
      });

      expect(postHook).toHaveBeenCalledWith({
        id: taskId,
        res: expect.objectContaining({
          ...outputData,
          __duration: expect.any(Number)
        })
      });

      expect(result).toEqual(outputData);
    });

    it('should call post hook with error information on failure', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const errorMessage = faker.lorem.sentence();
      const postHook = vi.fn();

      hooks.hook('task:did:call', postHook);

      const taskSpec: TaskSpec<string, string> = {
        id: taskId,
        run: vi.fn().mockRejectedValue(new Error(errorMessage))
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      const task = defineTask(taskSpec);
      await expect(task.call('input', mockCtx))
        .rejects.toThrow(errorMessage);

      expect(postHook).toHaveBeenCalledWith({
        id: taskId,
        res: { error: errorMessage }
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track task execution duration', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const delay = 100;
      const postHook = vi.fn();

      hooks.hook('task:did:call', postHook);

      const taskSpec: TaskSpec<void, string> = {
        id: taskId,
        run: async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          return 'completed';
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      await task.call(undefined, mockCtx);

      // Assert
      expect(postHook).toHaveBeenCalledWith({
        id: taskId,
        res: expect.objectContaining({
          __duration: expect.any(Number)
        })
      });

      const duration = postHook.mock.calls[0][0].res.__duration;
      expect(duration).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
    });
  });

  describe('Error Handling', () => {
    it('should handle task execution errors', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const errorMessage = faker.lorem.sentence();

      const taskSpec: TaskSpec<string, string> = {
        id: taskId,
        run: () => {
          throw new Error(errorMessage);
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      const task = defineTask(taskSpec);
      await expect(task.call('input', mockCtx))
        .rejects.toThrow(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const errorValue = faker.lorem.sentence();
      const postHook = vi.fn();

      hooks.hook('task:did:call', postHook);

      const taskSpec: TaskSpec<string, string> = {
        id: taskId,
        run: () => {
          throw errorValue; // Non-Error exception
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      const task = defineTask(taskSpec);
      await expect(task.call('input', mockCtx)).rejects.toThrow();

      expect(postHook).toHaveBeenCalledWith({
        id: taskId,
        res: { error: errorValue }
      });
    });

    it('should handle Zod validation errors with custom messages', async () => {
      // Arrange
      const inputSchema = z.object({
        required: z.string().min(1, 'Must not be empty')
      });

      const taskSpec: TaskSpec<z.infer<typeof inputSchema>, string> = {
        id: faker.string.uuid(),
        in: inputSchema,
        run: (input) => `Value: ${input.required}`
      };

      const invalidInput = { required: '' };
      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      const task = defineTask(taskSpec);
      await expect(task.call(invalidInput as any, mockCtx))
        .rejects.toThrow(/input validation failed/);
    });
  });

  describe('Complex Data Types', () => {
    it('should handle complex nested objects', async () => {
      // Arrange
      const inputSchema = z.object({
        user: z.object({
          name: z.string(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean()
          })
        }),
        metadata: z.array(z.string())
      });

      const outputSchema = z.object({
        greeting: z.string(),
        config: z.record(z.string(), z.any())
      });

      const taskSpec: TaskSpec<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
        id: faker.string.uuid(),
        in: inputSchema,
        out: outputSchema,
        run: (input) => ({
          greeting: `Hello ${input.user.name}`,
          config: {
            theme: input.user.preferences.theme,
            notifications: input.user.preferences.notifications,
            tags: input.metadata
          }
        })
      };

      const input = {
        user: {
          name: faker.person.fullName(),
          preferences: {
            theme: 'dark' as const,
            notifications: true
          }
        },
        metadata: [faker.lorem.word(), faker.lorem.word()]
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const task = defineTask(taskSpec);
      const result = await task.call(input, mockCtx);

      // Assert
      expect(result).toMatchObject({
        greeting: `Hello ${input.user.name}`,
        config: {
          theme: 'dark',
          notifications: true,
          tags: input.metadata
        }
      });
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary string inputs correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string(),
        async (input) => {
          // Arrange
          const taskSpec: TaskSpec<string, string> = {
            id: faker.string.uuid(),
            run: (str) => str.toUpperCase()
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act
          const task = defineTask(taskSpec);
          const result = await task.call(input, mockCtx);

          // Assert
          expect(result).toBe(input.toUpperCase());
        }
      ));
    });

    it('should handle arbitrary numeric computations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 1, maxLength: 10 }),
        async (numbers) => {
          // Arrange
          const taskSpec: TaskSpec<number[], number> = {
            id: faker.string.uuid(),
            run: (nums) => nums.reduce((sum, n) => sum + n, 0)
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act
          const task = defineTask(taskSpec);
          const result = await task.call(numbers, mockCtx);

          // Assert
          const expectedSum = numbers.reduce((sum, n) => sum + n, 0);
          expect(result).toBe(expectedSum);
        }
      ));
    });
  });

  describe('Concurrent Task Execution', () => {
    it('should handle concurrent task calls correctly', async () => {
      // Arrange
      const taskId = faker.string.uuid();
      const concurrentCalls = 10;
      
      const taskSpec: TaskSpec<number, number> = {
        id: taskId,
        run: async (input) => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return input * 2;
        }
      };

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      const task = defineTask(taskSpec);

      // Act
      const promises = Array.from({ length: concurrentCalls }, (_, i) =>
        task.call(i, mockCtx)
      );
      
      const results = await Promise.all(promises);

      // Assert
      results.forEach((result, index) => {
        expect(result).toBe(index * 2);
      });
    });
  });

  describe('BDD-style Scenarios', () => {
    describe('Given a task with input validation', () => {
      describe('When valid input is provided', () => {
        it('Then the task should execute successfully', async () => {
          // Given
          const schema = z.object({ value: z.number().positive() });
          const taskSpec: TaskSpec<z.infer<typeof schema>, string> = {
            id: 'validation-task',
            in: schema,
            run: (input) => `Result: ${input.value}`
          };

          const validInput = { value: 42 };
          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // When
          const task = defineTask(taskSpec);
          const result = await task.call(validInput, mockCtx);

          // Then
          expect(result).toBe('Result: 42');
        });
      });

      describe('When invalid input is provided', () => {
        it('Then validation error should be thrown', async () => {
          // Given
          const schema = z.object({ value: z.number().positive() });
          const taskSpec: TaskSpec<z.infer<typeof schema>, string> = {
            id: 'validation-task',
            in: schema,
            run: (input) => `Result: ${input.value}`
          };

          const invalidInput = { value: -1 };
          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // When & Then
          const task = defineTask(taskSpec);
          await expect(task.call(invalidInput as any, mockCtx))
            .rejects.toThrow(/input validation failed/);
        });
      });
    });

    describe('Given a long-running task', () => {
      describe('When executed', () => {
        it('Then duration should be tracked in hooks', async () => {
          // Given
          const postHook = vi.fn();
          hooks.hook('task:did:call', postHook);

          const taskSpec: TaskSpec<void, string> = {
            id: 'long-task',
            run: async () => {
              await new Promise(resolve => setTimeout(resolve, 50));
              return 'done';
            }
          };

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // When
          const task = defineTask(taskSpec);
          await task.call(undefined, mockCtx);

          // Then
          expect(postHook).toHaveBeenCalledWith(
            expect.objectContaining({
              id: 'long-task',
              res: expect.objectContaining({
                __duration: expect.any(Number)
              })
            })
          );

          const duration = postHook.mock.calls[0][0].res.__duration;
          expect(duration).toBeGreaterThan(40); // Should be at least 40ms
        });
      });
    });
  });
});