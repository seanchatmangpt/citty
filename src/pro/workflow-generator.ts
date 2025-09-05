// Zod-based Workflow Generation System
import { z } from 'zod';
import type { 
  Task, 
  Workflow, 
  StepSpec, 
  WorkflowSeed,
  RunCtx 
} from '../types/citty-pro';
import { defineTask, defineWorkflow } from './index';

// ============= Workflow Ontology Schemas =============

// Base ontology for workflow entities
export const WorkflowEntitySchema = z.object({
  '@type': z.enum(['Task', 'Workflow', 'Pipeline', 'Orchestration']),
  '@id': z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

// Task ontology with semantic meaning
export const TaskOntologySchema = WorkflowEntitySchema.extend({
  '@type': z.literal('Task'),
  input: z.object({
    schema: z.any(), // ZodTypeAny
    example: z.unknown().optional()
  }).optional(),
  output: z.object({
    schema: z.any(), // ZodTypeAny
    example: z.unknown().optional()
  }).optional(),
  capabilities: z.array(z.enum([
    'data-transform',
    'api-call',
    'file-operation',
    'computation',
    'validation',
    'aggregation',
    'notification',
    'ai-generation'
  ])).optional(),
  sideEffects: z.boolean().default(false),
  idempotent: z.boolean().default(true),
  timeout: z.number().optional()
});

// Workflow ontology with composition
export const WorkflowOntologySchema = WorkflowEntitySchema.extend({
  '@type': z.literal('Workflow'),
  steps: z.array(z.object({
    id: z.string(),
    taskRef: z.string(),
    condition: z.object({
      type: z.enum(['always', 'conditional', 'parallel', 'sequential']),
      expression: z.string().optional()
    }).optional(),
    retry: z.object({
      maxAttempts: z.number(),
      backoff: z.enum(['linear', 'exponential', 'fibonacci'])
    }).optional(),
    transform: z.object({
      input: z.string().optional(), // JSONPath expression
      output: z.string().optional()  // JSONPath expression
    }).optional()
  })),
  triggers: z.array(z.enum([
    'manual',
    'schedule',
    'webhook',
    'event',
    'file-watch',
    'api'
  ])).optional(),
  outputs: z.object({
    success: z.any(),
    failure: z.any()
  }).optional()
});

// Pipeline ontology for complex flows
export const PipelineOntologySchema = WorkflowEntitySchema.extend({
  '@type': z.literal('Pipeline'),
  stages: z.array(z.object({
    name: z.string(),
    workflows: z.array(z.string()), // References to workflow IDs
    parallel: z.boolean().default(false),
    continueOnError: z.boolean().default(false)
  })),
  dataFlow: z.object({
    inputs: z.record(z.any()),
    transformations: z.array(z.object({
      from: z.string(),
      to: z.string(),
      mapping: z.string() // JSONPath or transformation expression
    })).optional(),
    outputs: z.record(z.any())
  }).optional()
});

// ============= Workflow Generation Functions =============

export class WorkflowGenerator {
  private tasks = new Map<string, Task<any, any>>();
  private workflows = new Map<string, Workflow<any>>();
  private schemas = new Map<string, z.ZodType<any>>();
  
  /**
   * Register a task with ontology
   */
  registerTask<TIn = any, TOut = any>(
    ontology: z.infer<typeof TaskOntologySchema>,
    implementation: (input: TIn, ctx: RunCtx) => Promise<TOut> | TOut
  ): Task<TIn, TOut> {
    const task = defineTask({
      id: ontology['@id'],
      in: ontology.input?.schema,
      out: ontology.output?.schema,
      run: implementation
    });
    
    this.tasks.set(ontology['@id'], task);
    return task;
  }
  
  /**
   * Generate workflow from ontology
   */
  generateWorkflow<State = any>(
    ontology: z.infer<typeof WorkflowOntologySchema>,
    seed?: WorkflowSeed<State, RunCtx>
  ): Workflow<State> {
    const steps: StepSpec<State, string, any, RunCtx>[] = ontology.steps.map(step => {
      const task = this.tasks.get(step.taskRef);
      if (!task) {
        throw new Error(`Task ${step.taskRef} not found in registry`);
      }
      
      return {
        id: step.id,
        use: task,
        select: step.transform?.input 
          ? (state: State) => this.applyJSONPath(state, step.transform!.input!)
          : undefined
      };
    });
    
    const workflow = defineWorkflow({
      id: ontology['@id'],
      seed,
      steps
    });
    
    this.workflows.set(ontology['@id'], workflow);
    return workflow;
  }
  
  /**
   * Generate pipeline from multiple workflows
   */
  generatePipeline(
    ontology: z.infer<typeof PipelineOntologySchema>
  ): Workflow<any> {
    const pipelineSteps: StepSpec<any, string, any, RunCtx>[] = [];
    
    for (const stage of ontology.stages) {
      if (stage.parallel) {
        // Create parallel execution task
        const parallelTask = defineTask({
          id: `${stage.name}-parallel`,
          run: async (input: any, ctx: RunCtx) => {
            const promises = stage.workflows.map(wfId => {
              const wf = this.workflows.get(wfId);
              if (!wf) throw new Error(`Workflow ${wfId} not found`);
              return wf.run(ctx);
            });
            return Promise.all(promises);
          }
        });
        
        pipelineSteps.push({
          id: stage.name,
          use: parallelTask
        });
      } else {
        // Sequential execution
        for (const wfId of stage.workflows) {
          const wf = this.workflows.get(wfId);
          if (!wf) throw new Error(`Workflow ${wfId} not found`);
          
          pipelineSteps.push({
            id: `${stage.name}-${wfId}`,
            use: defineTask({
              id: `${stage.name}-${wfId}-task`,
              run: async (_: any, ctx: RunCtx) => wf.run(ctx)
            })
          });
        }
      }
    }
    
    return defineWorkflow({
      id: ontology['@id'],
      steps: pipelineSteps
    });
  }
  
  /**
   * Create workflow from Zod schema chain
   */
  fromSchemaChain<T extends z.ZodType<any>[]>(
    id: string,
    schemas: [...T],
    transforms: ((input: any, ctx: RunCtx) => any)[]
  ): Workflow<any> {
    const steps = schemas.map((schema, index) => {
      const task = defineTask({
        id: `${id}-step-${index}`,
        in: index > 0 ? schemas[index - 1] : schema,
        out: schema,
        run: transforms[index]
      });
      
      return {
        id: `step-${index}`,
        use: task
      };
    });
    
    return defineWorkflow({ id, steps });
  }
  
  /**
   * Create validation workflow
   */
  createValidationWorkflow<T>(
    id: string,
    schema: z.ZodType<T>,
    processors: Array<(data: T, ctx: RunCtx) => Promise<T> | T>
  ): Workflow<{ validated: T; errors?: any[] }> {
    const validationTask = defineTask({
      id: `${id}-validation`,
      in: schema,
      out: z.object({
        validated: schema,
        errors: z.array(z.any()).optional()
      }),
      run: async (input: T) => {
        const result = schema.safeParse(input);
        if (!result.success) {
          return {
            validated: input,
            errors: result.error.errors
          };
        }
        return { validated: result.data };
      }
    });
    
    const processingTasks = processors.map((processor, index) =>
      defineTask({
        id: `${id}-process-${index}`,
        run: processor
      })
    );
    
    const steps: StepSpec<any, string, any, RunCtx>[] = [
      { id: 'validate', use: validationTask },
      ...processingTasks.map((task, index) => ({
        id: `process-${index}`,
        use: task,
        select: (state: any) => state.validated
      }))
    ];
    
    return defineWorkflow({ id, steps });
  }
  
  /**
   * Create data transformation workflow
   */
  createTransformWorkflow<TIn, TOut>(
    id: string,
    inputSchema: z.ZodType<TIn>,
    outputSchema: z.ZodType<TOut>,
    transformations: Array<{
      name: string;
      transform: (data: any) => any;
    }>
  ): Workflow<TOut> {
    const steps = transformations.map((t, index) =>
      defineTask({
        id: `${id}-${t.name}`,
        in: index === 0 ? inputSchema : undefined,
        out: index === transformations.length - 1 ? outputSchema : undefined,
        run: async (input: any) => t.transform(input)
      })
    );
    
    return defineWorkflow({
      id,
      steps: steps.map(task => ({
        id: task.id,
        use: task
      }))
    });
  }
  
  /**
   * Create branching workflow with conditions
   */
  createConditionalWorkflow<T>(
    id: string,
    conditions: Array<{
      name: string;
      condition: (data: T) => boolean;
      workflow: Workflow<any>;
    }>,
    defaultWorkflow?: Workflow<any>
  ): Workflow<any> {
    const routerTask = defineTask({
      id: `${id}-router`,
      run: async (input: T, ctx: RunCtx) => {
        for (const { condition, workflow } of conditions) {
          if (condition(input)) {
            return workflow.run(ctx);
          }
        }
        if (defaultWorkflow) {
          return defaultWorkflow.run(ctx);
        }
        throw new Error('No matching condition and no default workflow');
      }
    });
    
    return defineWorkflow({
      id,
      steps: [{ id: 'route', use: routerTask }]
    });
  }
  
  /**
   * Create retry workflow with backoff
   */
  createRetryWorkflow<T>(
    id: string,
    task: Task<T, any>,
    options: {
      maxAttempts: number;
      backoff: 'linear' | 'exponential' | 'fibonacci';
      initialDelay: number;
    }
  ): Workflow<any> {
    const retryTask = defineTask({
      id: `${id}-retry`,
      run: async (input: T, ctx: RunCtx) => {
        let lastError: any;
        const delays = this.calculateBackoffDelays(
          options.maxAttempts,
          options.backoff,
          options.initialDelay
        );
        
        for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
          try {
            return await task.call(input, ctx);
          } catch (error) {
            lastError = error;
            if (attempt < options.maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            }
          }
        }
        
        throw lastError;
      }
    });
    
    return defineWorkflow({
      id,
      steps: [{ id: 'retry', use: retryTask }]
    });
  }
  
  // Helper methods
  private applyJSONPath(data: any, path: string): any {
    // Simple JSONPath implementation
    const parts = path.split('.');
    let result = data;
    for (const part of parts) {
      if (part === '$') continue;
      result = result[part];
    }
    return result;
  }
  
  private calculateBackoffDelays(
    attempts: number,
    strategy: string,
    initial: number
  ): number[] {
    const delays: number[] = [];
    let a = 0, b = initial;
    
    for (let i = 0; i < attempts; i++) {
      switch (strategy) {
        case 'linear':
          delays.push(initial * (i + 1));
          break;
        case 'exponential':
          delays.push(initial * Math.pow(2, i));
          break;
        case 'fibonacci':
          delays.push(b);
          const temp = a + b;
          a = b;
          b = temp;
          break;
      }
    }
    
    return delays;
  }
}

// Export singleton instance
export const workflowGenerator = new WorkflowGenerator();

// ============= Pre-built Workflow Templates =============

export const WorkflowTemplates = {
  // Data processing pipeline
  dataProcessing: (id: string) => {
    const schema = z.object({
      data: z.array(z.unknown()),
      format: z.enum(['json', 'csv', 'xml'])
    });
    
    return workflowGenerator.createTransformWorkflow(
      id,
      schema,
      z.object({ processed: z.array(z.any()), stats: z.any() }),
      [
        { name: 'validate', transform: (d) => d },
        { name: 'normalize', transform: (d) => ({ ...d, normalized: true }) },
        { name: 'enrich', transform: (d) => ({ ...d, enriched: true }) },
        { name: 'aggregate', transform: (d) => ({ processed: d.data, stats: {} }) }
      ]
    );
  },
  
  // API orchestration
  apiOrchestration: (id: string, endpoints: string[]) => {
    const tasks = endpoints.map(endpoint =>
      workflowGenerator.registerTask(
        {
          '@type': 'Task',
          '@id': `fetch-${endpoint}`,
          name: `Fetch from ${endpoint}`,
          capabilities: ['api-call']
        },
        async () => {
          // Simulated API call
          return { endpoint, data: {} };
        }
      )
    );
    
    return workflowGenerator.generateWorkflow({
      '@type': 'Workflow',
      '@id': id,
      name: 'API Orchestration',
      steps: tasks.map((_, index) => ({
        id: `step-${index}`,
        taskRef: `fetch-${endpoints[index]}`
      }))
    });
  }
};

// ============= Schema Helpers =============

export const SchemaHelpers = {
  // Merge multiple schemas
  merge: <T extends z.ZodType<any>[]>(...schemas: T) => {
    return z.intersection(
      schemas[0],
      schemas.slice(1).reduce((acc, schema) => z.intersection(acc, schema))
    );
  },
  
  // Create schema from TypeScript interface
  fromInterface: <T>(example: T): z.ZodType<T> => {
    const schema: any = {};
    for (const [key, value] of Object.entries(example as any)) {
      if (typeof value === 'string') schema[key] = z.string();
      else if (typeof value === 'number') schema[key] = z.number();
      else if (typeof value === 'boolean') schema[key] = z.boolean();
      else if (Array.isArray(value)) schema[key] = z.array(z.any());
      else if (value === null) schema[key] = z.null();
      else if (typeof value === 'object') schema[key] = z.object({});
    }
    return z.object(schema) as any;
  }
};