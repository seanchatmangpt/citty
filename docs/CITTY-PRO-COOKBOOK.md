# Citty Pro Framework - 25 Pattern Cookbook

## Table of Contents
1. [Basic Patterns](#basic-patterns) (1-5)
2. [Validation Patterns](#validation-patterns) (6-10)
3. [AI Integration Patterns](#ai-integration-patterns) (11-15)
4. [Workflow Composition Patterns](#workflow-composition-patterns) (16-20)
5. [Advanced Orchestration Patterns](#advanced-orchestration-patterns) (21-25)

---

## Basic Patterns

### Pattern 1: Simple Task with Zod Validation
```typescript
import { z } from 'zod';
import { cittyPro } from '@citty/pro';

// Define schema
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18)
});

// Create validated task
const createUserTask = cittyPro.defineTask({
  id: 'create-user',
  in: UserSchema,
  out: z.object({ id: z.string(), ...UserSchema.shape }),
  run: async (user) => ({
    id: crypto.randomUUID(),
    ...user
  })
});

// Usage
const user = await createUserTask.call(
  { name: 'John', email: 'john@example.com', age: 25 },
  context
);
```

### Pattern 2: Sequential Workflow with State Accumulation
```typescript
const dataWorkflow = cittyPro.defineWorkflow({
  id: 'data-processing',
  seed: { items: [], metadata: {} },
  steps: [
    {
      id: 'fetch',
      use: fetchDataTask,
      as: 'rawData'
    },
    {
      id: 'transform',
      use: transformTask,
      select: (state) => state.rawData
    },
    {
      id: 'validate',
      use: validateTask,
      select: (state) => state.transform
    }
  ]
});
```

### Pattern 3: Hook-Driven Task with Lifecycle Events
```typescript
import { hooks } from '@citty/pro';

const auditedTask = cittyPro.defineTask({
  id: 'audited-operation',
  run: async (input: any, ctx) => {
    // Task automatically triggers hooks
    return { processed: true, timestamp: ctx.now() };
  }
});

// Register audit hooks
hooks.hook('task:will:call', async ({ id, input }) => {
  console.log(`Starting task ${id}`, input);
});

hooks.hook('task:did:call', async ({ id, res }) => {
  console.log(`Completed task ${id}`, res);
});
```

### Pattern 4: Context-Aware Command with Environment
```typescript
const envCommand = defineCommand({
  meta: { name: 'env-aware' },
  args: {
    env: { type: 'enum', options: ['dev', 'prod'], default: 'dev' }
  },
  run: async ({ args }) => {
    await cittyPro.runLifecycle({
      cmd: envCommand,
      args,
      ctx: {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: args.env },
        now: () => new Date()
      },
      runStep: async (ctx) => ({
        text: `Running in ${ctx.env.NODE_ENV} environment`
      })
    });
  }
});
```

### Pattern 5: Plugin-Enhanced Workflow
```typescript
import { createOtelPlugin, createAINotesPlugin } from '@citty/pro/plugins';

// Register plugins
const otelPlugin = createOtelPlugin({ serviceName: 'citty-app' });
const notesPlugin = createAINotesPlugin({ logPath: './execution.log' });

await applyPlugins([otelPlugin, notesPlugin], hooks, context);

// Now all workflows have telemetry and logging
const monitoredWorkflow = cittyPro.defineWorkflow({
  id: 'monitored',
  steps: [/* steps automatically tracked */]
});
```

---

## Validation Patterns

### Pattern 6: Multi-Schema Validation Pipeline
```typescript
import { workflowGenerator } from '@citty/pro/workflow-generator';

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
```

### Pattern 7: Conditional Schema Selection
```typescript
const DynamicSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), value: z.string().email() }),
  z.object({ type: z.literal('phone'), value: z.string() }),
  z.object({ type: z.literal('username'), value: z.string().min(3) })
]);

const dynamicValidationTask = cittyPro.defineTask({
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
```

### Pattern 8: Schema Composition with Refinements
```typescript
const BaseUserSchema = z.object({
  id: z.string(),
  createdAt: z.date()
});

const ProfileSchema = BaseUserSchema.extend({
  name: z.string(),
  bio: z.string().optional()
});

const AdminSchema = ProfileSchema.extend({
  permissions: z.array(z.string()),
  level: z.number().min(1).max(10)
}).refine(
  (data) => data.level > 5 || data.permissions.length === 0,
  "Low-level admins cannot have permissions"
);
```

### Pattern 9: Error Recovery Workflow
```typescript
const resilientWorkflow = workflowGenerator.createRetryWorkflow(
  'resilient-api-call',
  apiCallTask,
  {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000
  }
);

// With custom error handling
hooks.hook('task:did:call', async ({ id, res }) => {
  if (res?.error) {
    await hooks.callHook('persist:will', {
      out: { text: `Error in ${id}: ${res.error}` }
    });
  }
});
```

### Pattern 10: Progressive Validation Chain
```typescript
const progressiveValidation = workflowGenerator.fromSchemaChain(
  'progressive-validation',
  [
    z.object({ raw: z.string() }),
    z.object({ parsed: z.any() }),
    z.object({ validated: z.any() }),
    z.object({ enriched: z.any() })
  ],
  [
    async (input) => ({ parsed: JSON.parse(input.raw) }),
    async (input) => ({ validated: await validateAgainstAPI(input.parsed) }),
    async (input) => ({ enriched: { ...input.validated, metadata: {} } })
  ]
);
```

---

## AI Integration Patterns

### Pattern 11: AI-Powered Command with Tools
```typescript
const aiCommand = cittyPro.defineAIWrapperCommand({
  meta: { name: 'ai-assist' },
  args: {
    prompt: { type: 'string', required: true }
  },
  ai: {
    model: { id: 'gpt-4', vendor: 'openai' },
    tools: {
      search: {
        description: 'Search for information',
        schema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // Search implementation
          return { results: [] };
        }
      },
      calculate: {
        description: 'Perform calculations',
        schema: z.object({ expression: z.string() }),
        execute: async ({ expression }) => {
          return { result: eval(expression) }; // Simplified
        }
      }
    }
  },
  plan: (args) => `Help user with: ${args.prompt}. Use tools as needed.`,
  onToolCall: async (name, input) => {
    console.log(`AI called tool: ${name}`, input);
  },
  run: async (args, ctx) => ({
    text: await ctx.ai!.generate({
      prompt: args.prompt,
      tools: ctx.ai!.tools
    }).then(r => r.text)
  })
});
```

### Pattern 12: Multi-Model AI Workflow
```typescript
const multiModelWorkflow = cittyPro.defineWorkflow({
  id: 'multi-ai',
  steps: [
    {
      id: 'generate',
      use: cittyPro.defineTask({
        id: 'gpt-generate',
        run: async (input: { prompt: string }, ctx) => {
          const gptCtx = {
            ...ctx,
            ai: {
              model: { id: 'gpt-4', vendor: 'openai' },
              generate: async (opts) => ({ text: 'GPT response' })
            }
          };
          return { gpt: await gptCtx.ai.generate({ prompt: input.prompt }) };
        }
      })
    },
    {
      id: 'validate',
      use: cittyPro.defineTask({
        id: 'claude-validate',
        run: async (input: any, ctx) => {
          const claudeCtx = {
            ...ctx,
            ai: {
              model: { id: 'claude-3', vendor: 'anthropic' },
              generate: async (opts) => ({ text: 'Claude validation' })
            }
          };
          return { validated: true };
        }
      })
    }
  ]
});
```

### Pattern 13: AI Chain-of-Thought Workflow
```typescript
const chainOfThoughtWorkflow = cittyPro.defineWorkflow({
  id: 'chain-of-thought',
  seed: { thoughts: [], conclusion: null },
  steps: [
    {
      id: 'analyze',
      use: aiTask('Analyze the problem'),
      as: 'analysis'
    },
    {
      id: 'decompose',
      use: aiTask('Break down into steps'),
      select: (state) => state.analysis
    },
    {
      id: 'solve',
      use: aiTask('Solve each step'),
      select: (state) => state.decompose
    },
    {
      id: 'synthesize',
      use: aiTask('Combine solutions'),
      select: (state) => state
    }
  ]
});

function aiTask(instruction: string) {
  return cittyPro.defineTask({
    id: `ai-${instruction.toLowerCase().replace(/\s+/g, '-')}`,
    run: async (input: any, ctx) => {
      const result = await ctx.ai!.generate({
        prompt: `${instruction}: ${JSON.stringify(input)}`,
        system: 'You are a problem-solving assistant.'
      });
      return { thought: result.text, timestamp: ctx.now() };
    }
  });
}
```

### Pattern 14: AI-Powered Data Transformation
```typescript
const DataTransformSchema = z.object({
  input: z.any(),
  fromFormat: z.string(),
  toFormat: z.string(),
  rules: z.array(z.string()).optional()
});

const aiTransformTask = cittyPro.defineTask({
  id: 'ai-transform',
  in: DataTransformSchema,
  run: async ({ input, fromFormat, toFormat, rules }, ctx) => {
    const prompt = `
      Transform this ${fromFormat} data to ${toFormat}:
      ${JSON.stringify(input)}
      ${rules ? `Rules: ${rules.join(', ')}` : ''}
    `;
    
    const result = await ctx.ai!.generate({ prompt });
    return { transformed: JSON.parse(result.text) };
  }
});
```

### Pattern 15: AI Feedback Loop Pattern
```typescript
const feedbackWorkflow = cittyPro.defineWorkflow({
  id: 'ai-feedback-loop',
  seed: { iterations: 0, maxIterations: 3, quality: 0 },
  steps: [
    {
      id: 'generate',
      use: cittyPro.defineTask({
        id: 'generate-content',
        run: async (input: any, ctx) => {
          const content = await ctx.ai!.generate({
            prompt: 'Generate content based on feedback'
          });
          return { content: content.text };
        }
      })
    },
    {
      id: 'evaluate',
      use: cittyPro.defineTask({
        id: 'evaluate-quality',
        run: async ({ content }: any, ctx) => {
          const evaluation = await ctx.ai!.generate({
            prompt: `Rate quality 0-100: ${content}`
          });
          return { quality: parseInt(evaluation.text), content };
        }
      }),
      select: (state) => state.generate
    },
    {
      id: 'decide',
      use: cittyPro.defineTask({
        id: 'continue-or-stop',
        run: async ({ quality, content }: any, ctx) => {
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
```

---

## Workflow Composition Patterns

### Pattern 16: Parallel Execution with Aggregation
```typescript
const parallelAggregateWorkflow = workflowGenerator.generateWorkflow(
  {
    '@type': 'Workflow',
    '@id': 'parallel-aggregate',
    name: 'Parallel Data Processing',
    steps: [
      {
        id: 'split',
        taskRef: 'data-splitter',
        condition: { type: 'always' }
      },
      {
        id: 'process-parallel',
        taskRef: 'batch-processor',
        condition: { type: 'parallel' }
      },
      {
        id: 'merge',
        taskRef: 'data-merger',
        condition: { type: 'always' }
      }
    ]
  },
  { chunks: [], results: [] }
);
```

### Pattern 17: Dynamic Workflow Composition
```typescript
class DynamicWorkflowBuilder {
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
          return input; // Pass through
        }
      })
    });
    return this;
  }
  
  build(id: string): Workflow<any> {
    return cittyPro.defineWorkflow({ id, steps: this.steps });
  }
}

// Usage
const dynamicWorkflow = new DynamicWorkflowBuilder()
  .addStep(
    (state) => state.type === 'user',
    userProcessingTask
  )
  .addStep(
    (state) => state.type === 'admin',
    adminProcessingTask
  )
  .build('dynamic-processor');
```

### Pattern 18: Pipeline with Error Boundaries
```typescript
const pipelineWithErrorBoundaries = workflowGenerator.generatePipeline({
  '@type': 'Pipeline',
  '@id': 'safe-pipeline',
  name: 'Error-Safe Pipeline',
  stages: [
    {
      name: 'preprocessing',
      workflows: ['validate', 'sanitize'],
      parallel: false,
      continueOnError: false
    },
    {
      name: 'processing',
      workflows: ['transform', 'enrich'],
      parallel: true,
      continueOnError: true  // Continue even if one fails
    },
    {
      name: 'postprocessing',
      workflows: ['aggregate', 'report'],
      parallel: false,
      continueOnError: false
    }
  ]
});

// Add error recovery
hooks.hook('task:did:call', async ({ id, res }) => {
  if (res?.error && id.includes('processing')) {
    console.log('Processing error, attempting recovery...');
    // Trigger recovery workflow
  }
});
```

### Pattern 19: Event-Driven Workflow Composition
```typescript
import { EventEmitter } from 'events';

class EventDrivenWorkflow extends EventEmitter {
  private workflows = new Map<string, Workflow<any>>();
  
  register(event: string, workflow: Workflow<any>) {
    this.workflows.set(event, workflow);
    
    this.on(event, async (data) => {
      const ctx: RunCtx = {
        cwd: process.cwd(),
        env: process.env,
        now: () => new Date()
      };
      
      const result = await workflow.run(ctx);
      this.emit(`${event}:complete`, result);
    });
  }
  
  async trigger(event: string, data: any) {
    this.emit(event, data);
  }
}

// Usage
const eventWorkflow = new EventDrivenWorkflow();
eventWorkflow.register('user:signup', signupWorkflow);
eventWorkflow.register('user:login', loginWorkflow);
eventWorkflow.register('order:placed', orderWorkflow);

// Trigger workflows
await eventWorkflow.trigger('user:signup', { email: 'user@example.com' });
```

### Pattern 20: Workflow Factory with Template Instantiation
```typescript
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

// Register templates
const factory = new WorkflowFactory();

factory.registerTemplate('crud', (entity: string) => 
  cittyPro.defineWorkflow({
    id: `${entity}-crud`,
    steps: [
      { id: 'validate', use: validateEntityTask },
      { id: 'save', use: saveEntityTask },
      { id: 'index', use: indexEntityTask },
      { id: 'cache', use: cacheEntityTask }
    ]
  })
);

// Create instances
const userCrud = factory.create('crud', 'user');
const productCrud = factory.create('crud', 'product');
```

---

## Advanced Orchestration Patterns

### Pattern 21: Distributed Saga Pattern
```typescript
class SagaOrchestrator {
  private compensations: Array<() => Promise<void>> = [];
  
  async execute(steps: Array<{
    action: () => Promise<any>;
    compensation: () => Promise<void>;
  }>) {
    const results: any[] = [];
    
    for (const step of steps) {
      try {
        const result = await step.action();
        results.push(result);
        this.compensations.push(step.compensation);
      } catch (error) {
        // Rollback in reverse order
        await this.rollback();
        throw error;
      }
    }
    
    return results;
  }
  
  private async rollback() {
    for (const compensation of this.compensations.reverse()) {
      try {
        await compensation();
      } catch (error) {
        console.error('Compensation failed:', error);
      }
    }
  }
}

// Usage
const saga = new SagaOrchestrator();
await saga.execute([
  {
    action: async () => createOrder(),
    compensation: async () => cancelOrder()
  },
  {
    action: async () => chargePayment(),
    compensation: async () => refundPayment()
  },
  {
    action: async () => shipOrder(),
    compensation: async () => cancelShipment()
  }
]);
```

### Pattern 22: Circuit Breaker Workflow
```typescript
class CircuitBreakerWorkflow {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private workflow: Workflow<any>,
    private threshold = 5,
    private timeout = 60000
  ) {}
  
  async execute(ctx: RunCtx): Promise<any> {
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await this.workflow.run(ctx);
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
}
```

### Pattern 23: Workflow Mesh with Service Discovery
```typescript
class WorkflowMesh {
  private registry = new Map<string, {
    workflow: Workflow<any>;
    metadata: any;
    health: 'healthy' | 'degraded' | 'unhealthy';
  }>();
  
  register(id: string, workflow: Workflow<any>, metadata: any = {}) {
    this.registry.set(id, {
      workflow,
      metadata,
      health: 'healthy'
    });
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
    
    try {
      return await entry.workflow.run(ctx);
    } catch (error) {
      // Mark as degraded on error
      entry.health = 'degraded';
      throw error;
    }
  }
  
  async broadcast(criteria: (metadata: any) => boolean, ctx: RunCtx) {
    const ids = await this.discover(criteria);
    return Promise.all(ids.map(id => this.invoke(id, ctx)));
  }
}

// Usage
const mesh = new WorkflowMesh();
mesh.register('payment-processor', paymentWorkflow, { type: 'payment', region: 'us' });
mesh.register('notification-sender', notificationWorkflow, { type: 'notification' });

// Discover and invoke
const paymentServices = await mesh.discover(m => m.type === 'payment');
```

### Pattern 24: Adaptive Workflow with Machine Learning
```typescript
class AdaptiveWorkflow {
  private performanceHistory: Array<{
    path: string[];
    duration: number;
    success: boolean;
  }> = [];
  
  private pathScores = new Map<string, number>();
  
  async execute(
    options: Array<{ id: string; workflow: Workflow<any> }>,
    ctx: RunCtx
  ): Promise<any> {
    // Select best path based on historical performance
    const selectedPath = this.selectOptimalPath(options);
    const startTime = Date.now();
    
    try {
      const result = await selectedPath.workflow.run(ctx);
      
      // Update performance history
      this.performanceHistory.push({
        path: [selectedPath.id],
        duration: Date.now() - startTime,
        success: true
      });
      
      this.updateScores();
      return result;
    } catch (error) {
      this.performanceHistory.push({
        path: [selectedPath.id],
        duration: Date.now() - startTime,
        success: false
      });
      
      this.updateScores();
      throw error;
    }
  }
  
  private selectOptimalPath(options: any[]): any {
    let bestOption = options[0];
    let bestScore = -Infinity;
    
    for (const option of options) {
      const score = this.pathScores.get(option.id) || 0;
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }
    
    return bestOption;
  }
  
  private updateScores() {
    // Simple scoring based on success rate and speed
    const pathGroups = new Map<string, any[]>();
    
    for (const record of this.performanceHistory) {
      const key = record.path.join('-');
      if (!pathGroups.has(key)) {
        pathGroups.set(key, []);
      }
      pathGroups.get(key)!.push(record);
    }
    
    for (const [path, records] of pathGroups) {
      const successRate = records.filter(r => r.success).length / records.length;
      const avgDuration = records.reduce((sum, r) => sum + r.duration, 0) / records.length;
      
      // Score formula: prioritize success rate, penalize slow execution
      const score = successRate * 100 - (avgDuration / 1000);
      this.pathScores.set(path.split('-')[0], score);
    }
  }
}
```

### Pattern 25: Quantum-Inspired Superposition Workflow
```typescript
/**
 * Executes multiple workflow paths simultaneously and collapses
 * to the first successful result (quantum superposition concept)
 */
class SuperpositionWorkflow {
  async execute(
    workflows: Array<{ id: string; workflow: Workflow<any>; weight: number }>,
    ctx: RunCtx
  ): Promise<any> {
    // Sort by weight (probability of success)
    const sorted = workflows.sort((a, b) => b.weight - a.weight);
    
    // Create abort controllers for each workflow
    const controllers = sorted.map(() => new AbortController());
    
    // Execute all workflows simultaneously
    const promises = sorted.map(async ({ id, workflow }, index) => {
      const signal = controllers[index].signal;
      
      return new Promise(async (resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('Aborted'));
          return;
        }
        
        signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
        
        try {
          const result = await workflow.run(ctx);
          resolve({ id, result });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    try {
      // Race all workflows - first success wins
      const winner = await Promise.race(promises);
      
      // "Collapse" the superposition - cancel other workflows
      controllers.forEach(c => c.abort());
      
      console.log(`Workflow ${(winner as any).id} collapsed the superposition`);
      return (winner as any).result;
      
    } catch (error) {
      // All workflows failed
      throw new Error('All superposition states failed');
    }
  }
  
  /**
   * Entangle workflows - link their states
   */
  async entangle(
    workflow1: Workflow<any>,
    workflow2: Workflow<any>,
    correlation: (state1: any, state2: any) => any
  ): Promise<Workflow<any>> {
    return cittyPro.defineWorkflow({
      id: 'entangled-workflow',
      steps: [
        {
          id: 'measure1',
          use: cittyPro.defineTask({
            id: 'measure-1',
            run: async (_, ctx) => workflow1.run(ctx)
          })
        },
        {
          id: 'measure2',
          use: cittyPro.defineTask({
            id: 'measure-2',
            run: async (_, ctx) => workflow2.run(ctx)
          })
        },
        {
          id: 'correlate',
          use: cittyPro.defineTask({
            id: 'correlate-states',
            run: async (state: any) => correlation(state.measure1, state.measure2)
          })
        }
      ]
    });
  }
}

// Usage
const superposition = new SuperpositionWorkflow();

// Multiple paths exist simultaneously until observation
const result = await superposition.execute([
  { id: 'fast', workflow: fastWorkflow, weight: 0.7 },
  { id: 'accurate', workflow: accurateWorkflow, weight: 0.9 },
  { id: 'fallback', workflow: fallbackWorkflow, weight: 0.5 }
], context);
```

---

## Bonus Patterns

### Pattern 26: Workflow Performance Profiler
```typescript
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
    const startMemory = process.memoryUsage();
    
    try {
      const result = await workflow.run(ctx);
      const duration = performance.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory.heapUsed;
      
      this.updateMetrics(id, duration, true);
      
      if (duration > 1000) {
        console.warn(`Slow workflow detected: ${id} took ${duration}ms`);
      }
      
      if (memoryDelta > 50 * 1024 * 1024) {
        console.warn(`High memory usage: ${id} used ${memoryDelta / 1024 / 1024}MB`);
      }
      
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
  
  getReport(): any {
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
```

---

## Summary

This cookbook provides 25+ patterns for leveraging the Citty Pro framework's features:

1. **Basic Patterns** - Foundation for task and workflow creation
2. **Validation Patterns** - Zod-powered schema validation and composition
3. **AI Integration** - Multi-model orchestration and tool usage
4. **Workflow Composition** - Dynamic and conditional workflow building
5. **Advanced Orchestration** - Distributed patterns, circuit breakers, and adaptive execution

Each pattern demonstrates:
- ✅ Zod schema validation
- ✅ TypeScript type safety
- ✅ Hook integration
- ✅ Context management
- ✅ Plugin support
- ✅ AI capabilities
- ✅ Error handling
- ✅ Performance optimization

Use these patterns as building blocks for complex CLI applications with the Citty Pro framework!