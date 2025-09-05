// tests/unit/citty-pro-workflows.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import fc from 'fast-check';
import { defineWorkflow } from '../../src/pro/workflow';
import { defineTask } from '../../src/pro/task';
import { hooks } from '../../src/pro/hooks';
import type { 
  Workflow, 
  StepSpec, 
  Task, 
  RunCtx,
  StepFn,
  WorkflowSeed 
} from '../../src/types/citty-pro.d.ts';

describe('Citty Pro Workflow System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup handled by fresh test instances
  });

  describe('Basic Workflow Definition and Execution', () => {
    it('should create and execute a simple workflow with function steps', async () => {
      // Arrange
      const workflowId = faker.string.uuid();
      const initialValue = faker.number.int({ min: 1, max: 100 });
      
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'double',
          use: (state: { initial: number }) => state.initial * 2
        },
        {
          id: 'stringify',
          use: (state: { double: number }) => `Result: ${state.double}`
        }
      ];

      const workflow = defineWorkflow({
        id: workflowId,
        seed: { initial: initialValue },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(workflow.id).toBe(workflowId);
      expect(result).toMatchObject({
        initial: initialValue,
        double: initialValue * 2,
        stringify: `Result: ${initialValue * 2}`
      });
    });

    it('should handle workflow with task-based steps', async () => {
      // Arrange
      const addTask = defineTask({
        id: 'add-task',
        run: (input: { a: number; b: number }) => input.a + input.b
      });

      const multiplyTask = defineTask({
        id: 'multiply-task', 
        run: (input: { sum: number; multiplier: number }) => input.sum * input.multiplier
      });

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'sum',
          use: addTask,
          select: (state) => ({ a: state.x, b: state.y })
        },
        {
          id: 'result',
          use: multiplyTask,
          select: (state) => ({ sum: state.sum, multiplier: 3 })
        }
      ];

      const workflow = defineWorkflow({
        id: 'math-workflow',
        seed: { x: 5, y: 10 },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result).toMatchObject({
        x: 5,
        y: 10,
        sum: 15,
        result: 45
      });
    });

    it('should handle async steps correctly', async () => {
      // Arrange
      const asyncTask: StepFn<string, string, RunCtx> = async (input) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return input.toUpperCase();
      };

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'uppercase',
          use: asyncTask,
          select: (state) => state.text
        }
      ];

      const workflow = defineWorkflow({
        id: 'async-workflow',
        seed: { text: faker.lorem.word() },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.uppercase).toBe(result.text.toUpperCase());
    });
  });

  describe('Workflow State Management', () => {
    it('should handle functional seed initialization', async () => {
      // Arrange
      const seedFn: WorkflowSeed<Record<string, any>, RunCtx> = (ctx) => ({
        cwd: ctx.cwd,
        timestamp: ctx.now().getTime(),
        env_count: Object.keys(ctx.env).length
      });

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'summary',
          use: (state: any) => `Working in ${state.cwd} at ${state.timestamp}`
        }
      ];

      const workflow = defineWorkflow({
        id: 'seed-workflow',
        seed: seedFn,
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: { NODE_ENV: 'test', USER: faker.person.firstName() },
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.cwd).toBe(mockCtx.cwd);
      expect(result.env_count).toBe(2);
      expect(result.summary).toContain(mockCtx.cwd);
    });

    it('should handle empty seed correctly', async () => {
      // Arrange
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'first',
          use: () => 'first result'
        },
        {
          id: 'second',
          use: (state: any) => `${state.first} + second`
        }
      ];

      const workflow = defineWorkflow({
        id: 'no-seed-workflow',
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result).toMatchObject({
        first: 'first result',
        second: 'first result + second'
      });
    });

    it('should handle step aliases correctly', async () => {
      // Arrange
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'compute',
          as: 'calculation',
          use: () => faker.number.int()
        },
        {
          id: 'format',
          as: 'display',
          use: (state: any) => `Value: ${state.calculation}`
        }
      ];

      const workflow = defineWorkflow({
        id: 'alias-workflow',
        seed: {},
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result).toHaveProperty('calculation');
      expect(result).toHaveProperty('display');
      expect(result).not.toHaveProperty('compute');
      expect(result).not.toHaveProperty('format');
      expect(result.display).toContain(`Value: ${result.calculation}`);
    });
  });

  describe('Step Selection and Data Flow', () => {
    it('should handle custom step selection', async () => {
      // Arrange
      const userProcessor = defineTask({
        id: 'user-processor',
        run: (user: { firstName: string; lastName: string }) => 
          `${user.firstName} ${user.lastName}`
      });

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'fullName',
          use: userProcessor,
          select: (state) => ({
            firstName: state.user.first,
            lastName: state.user.last
          })
        },
        {
          id: 'greeting',
          use: (state: any) => `Hello, ${state.fullName}!`,
          select: (state) => state // Pass entire state
        }
      ];

      const workflow = defineWorkflow({
        id: 'selection-workflow',
        seed: {
          user: {
            first: faker.person.firstName(),
            last: faker.person.lastName()
          }
        },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.fullName).toBe(`${result.user.first} ${result.user.last}`);
      expect(result.greeting).toBe(`Hello, ${result.fullName}!`);
    });

    it('should pass entire state when no selector provided', async () => {
      // Arrange
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'first',
          use: () => 'value1'
        },
        {
          id: 'second',
          use: (state: any) => {
            // Should receive the entire state including previous steps
            expect(state).toHaveProperty('first');
            expect(state).toHaveProperty('initial');
            return `${state.first}-value2`;
          }
        }
      ];

      const workflow = defineWorkflow({
        id: 'state-pass-workflow',
        seed: { initial: 'seed' },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.second).toBe('value1-value2');
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'success',
          use: () => 'ok'
        },
        {
          id: 'failure',
          use: () => {
            throw new Error(errorMessage);
          }
        }
      ];

      const workflow = defineWorkflow({
        id: 'error-workflow',
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      await expect(workflow.run(mockCtx)).rejects.toThrow(errorMessage);
    });

    it('should handle invalid step configurations', async () => {
      // Arrange
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'invalid',
          use: null as any // Invalid step function
        }
      ];

      const workflow = defineWorkflow({
        id: 'invalid-workflow',
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      await expect(workflow.run(mockCtx))
        .rejects.toThrow(/Invalid step.use in workflow/);
    });

    it('should handle task call failures', async () => {
      // Arrange
      const errorMessage = faker.lorem.sentence();
      const failingTask = defineTask({
        id: 'failing-task',
        run: () => {
          throw new Error(errorMessage);
        }
      });

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'fail',
          use: failingTask
        }
      ];

      const workflow = defineWorkflow({
        id: 'task-error-workflow',
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act & Assert
      await expect(workflow.run(mockCtx)).rejects.toThrow(errorMessage);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle data transformation pipeline', async () => {
      // Arrange
      const rawData = {
        users: [
          { name: faker.person.fullName(), age: faker.number.int({ min: 18, max: 80 }) },
          { name: faker.person.fullName(), age: faker.number.int({ min: 18, max: 80 }) }
        ]
      };

      const filterAdults = defineTask({
        id: 'filter-adults',
        run: (data: typeof rawData) => data.users.filter(user => user.age >= 18)
      });

      const calculateStats = defineTask({
        id: 'calculate-stats', 
        run: (users: Array<{ name: string; age: number }>) => ({
          count: users.length,
          avgAge: users.reduce((sum, u) => sum + u.age, 0) / users.length,
          names: users.map(u => u.name)
        })
      });

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'adults',
          use: filterAdults,
          select: (state) => state.rawData
        },
        {
          id: 'stats',
          use: calculateStats,
          select: (state) => state.adults
        },
        {
          id: 'report',
          use: (state: any) => ({
            title: 'User Report',
            summary: `Found ${state.stats.count} adults with average age ${state.stats.avgAge.toFixed(1)}`,
            details: state.stats.names
          })
        }
      ];

      const workflow = defineWorkflow({
        id: 'data-pipeline',
        seed: { rawData },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.adults).toHaveLength(rawData.users.length); // All should be adults
      expect(result.stats.count).toBe(rawData.users.length);
      expect(result.report.title).toBe('User Report');
      expect(result.report.summary).toContain('adults');
    });

    it('should handle conditional workflow steps', async () => {
      // Arrange
      const condition = faker.datatype.boolean();
      
      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'check',
          use: (state: any) => state.shouldProcess
        },
        {
          id: 'process',
          use: (state: any) => {
            if (state.check) {
              return `Processed: ${state.data}`;
            } else {
              return `Skipped: ${state.data}`;
            }
          }
        }
      ];

      const workflow = defineWorkflow({
        id: 'conditional-workflow',
        seed: { shouldProcess: condition, data: faker.lorem.word() },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const result = await workflow.run(mockCtx);

      // Assert
      expect(result.check).toBe(condition);
      if (condition) {
        expect(result.process).toContain('Processed:');
      } else {
        expect(result.process).toContain('Skipped:');
      }
    });
  });

  describe('Property-based Testing', () => {
    it('should handle arbitrary workflow configurations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          value: fc.integer()
        }),
        async (config) => {
          // Arrange
          const steps: StepSpec<any, string, any, RunCtx>[] = [
            {
              id: 'process',
              use: (state: any) => state.value * 2
            }
          ];

          const workflow = defineWorkflow({
            id: config.id,
            seed: { value: config.value },
            steps
          });

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act
          const result = await workflow.run(mockCtx);

          // Assert
          expect(result.value).toBe(config.value);
          expect(result.process).toBe(config.value * 2);
        }
      ));
    });

    it('should maintain workflow state invariants', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        async (stepIds) => {
          // Filter out potentially problematic property names
          const safeStepIds = stepIds.filter(id => 
            id && 
            !id.startsWith('__') && 
            !['constructor', 'prototype', 'toString', 'valueOf'].includes(id) &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(id) // Valid identifier
          );
          
          if (safeStepIds.length === 0) {
            safeStepIds.push('safe_step');
          }
          
          // Arrange
          const steps: StepSpec<any, string, any, RunCtx>[] = safeStepIds.map(id => ({
            id,
            use: (_state: any) => `${id}-result`
          }));

          const workflow = defineWorkflow({
            id: 'invariant-workflow',
            seed: { initial: 'seed' },
            steps
          });

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // Act
          const result = await workflow.run(mockCtx);

          // Assert
          expect(result).toHaveProperty('initial', 'seed');
          for (const stepId of safeStepIds) {
            expect(result).toHaveProperty(stepId, `${stepId}-result`);
          }
        }
      ));
    });
  });

  describe('Performance and Concurrency', () => {
    it('should execute steps sequentially', async () => {
      // Arrange
      const executionOrder: string[] = [];
      const delay = 10;

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'first',
          use: async () => {
            await new Promise(resolve => setTimeout(resolve, delay));
            executionOrder.push('first');
            return 'first-done';
          }
        },
        {
          id: 'second',
          use: async () => {
            await new Promise(resolve => setTimeout(resolve, delay));
            executionOrder.push('second');
            return 'second-done';
          }
        },
        {
          id: 'third',
          use: async () => {
            executionOrder.push('third');
            return 'third-done';
          }
        }
      ];

      const workflow = defineWorkflow({
        id: 'sequential-workflow',
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      await workflow.run(mockCtx);

      // Assert
      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });

    it('should handle large workflow state efficiently', async () => {
      // Arrange
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: faker.lorem.sentence()
      }));

      const steps: StepSpec<any, string, any, RunCtx>[] = [
        {
          id: 'process',
          use: (state: any) => state.data.length
        },
        {
          id: 'filter', 
          use: (state: any) => state.data.filter((_: any, i: number) => i % 2 === 0).length
        }
      ];

      const workflow = defineWorkflow({
        id: 'large-data-workflow',
        seed: { data: largeData },
        steps
      });

      const mockCtx: RunCtx = {
        cwd: faker.system.directoryPath(),
        env: {},
        now: () => new Date()
      };

      // Act
      const startTime = performance.now();
      const result = await workflow.run(mockCtx);
      const duration = performance.now() - startTime;

      // Assert
      expect(result.process).toBe(1000);
      expect(result.filter).toBe(500);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('BDD-style Scenarios', () => {
    describe('Given a workflow with multiple data processing steps', () => {
      describe('When the workflow is executed', () => {
        it('Then each step should process data from previous steps', async () => {
          // Given
          const initialData = [1, 2, 3, 4, 5];
          
          const steps: StepSpec<any, string, any, RunCtx>[] = [
            {
              id: 'double',
              use: (state: any) => state.numbers.map((n: number) => n * 2)
            },
            {
              id: 'sum',
              use: (state: any) => state.double.reduce((a: number, b: number) => a + b, 0)
            },
            {
              id: 'format',
              use: (state: any) => `Sum of doubled numbers: ${state.sum}`
            }
          ];

          const workflow = defineWorkflow({
            id: 'processing-workflow',
            seed: { numbers: initialData },
            steps
          });

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // When
          const result = await workflow.run(mockCtx);

          // Then
          expect(result.double).toEqual([2, 4, 6, 8, 10]);
          expect(result.sum).toBe(30);
          expect(result.format).toBe('Sum of doubled numbers: 30');
        });
      });
    });

    describe('Given a workflow with error in one step', () => {
      describe('When the workflow is executed', () => {
        it('Then execution should stop and error should be propagated', async () => {
          // Given
          const errorMessage = 'Step failed';
          const steps: StepSpec<any, string, any, RunCtx>[] = [
            {
              id: 'success',
              use: () => 'ok'
            },
            {
              id: 'error',
              use: () => {
                throw new Error(errorMessage);
              }
            },
            {
              id: 'never-reached',
              use: () => 'should not execute'
            }
          ];

          const workflow = defineWorkflow({
            id: 'error-workflow',
            steps
          });

          const mockCtx: RunCtx = {
            cwd: faker.system.directoryPath(),
            env: {},
            now: () => new Date()
          };

          // When & Then
          await expect(workflow.run(mockCtx)).rejects.toThrow(errorMessage);
        });
      });
    });
  });
});