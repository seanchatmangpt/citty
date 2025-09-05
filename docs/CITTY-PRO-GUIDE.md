# Citty Pro Framework - Complete Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Zod Integration](#zod-integration)
4. [Workflow Ontologies](#workflow-ontologies)
5. [Workflow Generation](#workflow-generation)
6. [Hook System](#hook-system)
7. [AI Integration](#ai-integration)
8. [Plugin Development](#plugin-development)
9. [Best Practices](#best-practices)
10. [API Reference](#api-reference)

---

## Introduction

Citty Pro is an advanced CLI framework that extends Citty with powerful features for building enterprise-grade command-line applications. It provides:

- 🔄 **Workflow Orchestration** - Compose complex task pipelines
- ✅ **Zod Validation** - Type-safe schema validation
- 🧠 **AI Integration** - Built-in AI model support
- 🪝 **Hook System** - Observable lifecycle management
- 🔌 **Plugin Architecture** - Extensible functionality
- 📊 **Ontology Support** - Semantic workflow definitions

### Installation

```bash
npm install @citty/pro zod
```

### Quick Start

```typescript
import { cittyPro, hooks, registerCoreHooks } from '@citty/pro';
import { z } from 'zod';

// Initialize
registerCoreHooks();

// Define a simple task
const task = cittyPro.defineTask({
  id: 'hello',
  run: async (input: string) => `Hello, ${input}!`
});

// Execute
const result = await task.call('World', context);
```

---

## Core Concepts

### Tasks
Tasks are the fundamental units of work in Citty Pro. They encapsulate logic with optional validation.

```typescript
const processDataTask = cittyPro.defineTask({
  id: 'process-data',
  in: z.object({
    data: z.array(z.number()),
    operation: z.enum(['sum', 'avg', 'max'])
  }),
  out: z.number(),
  run: async ({ data, operation }) => {
    switch (operation) {
      case 'sum': return data.reduce((a, b) => a + b, 0);
      case 'avg': return data.reduce((a, b) => a + b, 0) / data.length;
      case 'max': return Math.max(...data);
    }
  }
});
```

### Workflows
Workflows compose multiple tasks into complex pipelines with state management.

```typescript
const dataPipeline = cittyPro.defineWorkflow({
  id: 'data-pipeline',
  seed: { raw: null, processed: null },
  steps: [
    { id: 'fetch', use: fetchTask, as: 'raw' },
    { id: 'process', use: processTask, select: (state) => state.raw },
    { id: 'save', use: saveTask, select: (state) => state.process }
  ]
});
```

### Context
The `RunCtx` provides runtime context for tasks and workflows.

```typescript
interface RunCtx {
  cwd: string;                    // Current working directory
  env: Record<string, string>;    // Environment variables
  now: () => Date;                 // Current timestamp
  ai?: AIContext;                  // AI capabilities
  otel?: TelemetryContext;         // Observability
  fs?: FileSystemContext;          // File operations
  memo?: Record<string, unknown>;  // Shared memory
}
```

---

## Zod Integration

### Schema Definition
Define type-safe schemas for input/output validation:

```typescript
// Basic schemas
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive()
});

// Composition
const AdminSchema = UserSchema.extend({
  role: z.literal('admin'),
  permissions: z.array(z.string())
});

// Union types
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), to: z.string().email() }),
  z.object({ type: z.literal('sms'), to: z.string().regex(/^\+\d+$/) }),
  z.object({ type: z.literal('push'), deviceId: z.string() })
]);
```

### Schema-Driven Tasks
Create tasks with automatic validation:

```typescript
const createUserTask = cittyPro.defineTask({
  id: 'create-user',
  in: UserSchema,
  out: UserSchema.extend({ createdAt: z.date() }),
  run: async (user) => ({
    ...user,
    createdAt: new Date()
  })
});

// Validation happens automatically
try {
  await createUserTask.call({ 
    name: 'John',
    email: 'invalid-email' // Will throw validation error
  }, ctx);
} catch (error) {
  // Zod validation error with details
}
```

### Schema Transformations
Transform and refine schemas:

```typescript
const DateStringSchema = z.string().transform(str => new Date(str));
const PasswordSchema = z.string()
  .min(8)
  .refine(val => /[A-Z]/.test(val), 'Must contain uppercase')
  .refine(val => /[0-9]/.test(val), 'Must contain number');

const SecureUserSchema = UserSchema.extend({
  password: PasswordSchema,
  birthDate: DateStringSchema
});
```

---

## Workflow Ontologies

### Ontology Definition
Define semantic workflow structures using ontologies:

```typescript
import { WorkflowOntologySchema, TaskOntologySchema } from '@citty/pro/workflow-generator';

// Define task ontology
const taskOntology = {
  '@type': 'Task' as const,
  '@id': 'data-processor',
  name: 'Data Processing Task',
  description: 'Processes various data formats',
  capabilities: ['data-transform', 'validation'],
  input: {
    schema: z.object({
      format: z.enum(['json', 'csv', 'xml']),
      data: z.string()
    })
  },
  output: {
    schema: z.object({
      processed: z.any(),
      metadata: z.record(z.any())
    })
  },
  sideEffects: false,
  idempotent: true
};

// Validate ontology
const validated = TaskOntologySchema.parse(taskOntology);
```

### Workflow Ontology
Define complex workflow structures:

```typescript
const workflowOntology = {
  '@type': 'Workflow' as const,
  '@id': 'etl-pipeline',
  name: 'ETL Pipeline',
  steps: [
    {
      id: 'extract',
      taskRef: 'data-extractor',
      condition: { type: 'always' }
    },
    {
      id: 'transform',
      taskRef: 'data-transformer',
      condition: { type: 'conditional', expression: 'data.length > 0' },
      retry: { maxAttempts: 3, backoff: 'exponential' }
    },
    {
      id: 'load',
      taskRef: 'data-loader',
      transform: {
        input: '$.transformed',
        output: '$.result'
      }
    }
  ],
  triggers: ['manual', 'schedule'],
  outputs: {
    success: z.object({ count: z.number() }),
    failure: z.object({ error: z.string() })
  }
};
```

### Pipeline Ontology
Define multi-stage pipelines:

```typescript
const pipelineOntology = {
  '@type': 'Pipeline' as const,
  '@id': 'data-processing-pipeline',
  name: 'Multi-Stage Data Pipeline',
  stages: [
    {
      name: 'ingestion',
      workflows: ['fetch-data', 'validate-data'],
      parallel: false,
      continueOnError: false
    },
    {
      name: 'processing',
      workflows: ['transform-data', 'enrich-data'],
      parallel: true,
      continueOnError: true
    },
    {
      name: 'storage',
      workflows: ['save-to-db', 'cache-results'],
      parallel: true,
      continueOnError: false
    }
  ],
  dataFlow: {
    inputs: { source: z.string() },
    transformations: [
      { from: 'ingestion.output', to: 'processing.input', mapping: '$.data' }
    ],
    outputs: { result: z.any() }
  }
};
```

---

## Workflow Generation

### Using the Workflow Generator

```typescript
import { workflowGenerator } from '@citty/pro/workflow-generator';

// Register tasks with ontology
const fetchTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'fetch-api',
    name: 'API Fetcher',
    capabilities: ['api-call']
  },
  async (input: { url: string }) => {
    const response = await fetch(input.url);
    return response.json();
  }
);

// Generate workflow from ontology
const apiWorkflow = workflowGenerator.generateWorkflow(
  {
    '@type': 'Workflow',
    '@id': 'api-workflow',
    name: 'API Data Workflow',
    steps: [
      { id: 'fetch', taskRef: 'fetch-api' },
      { id: 'process', taskRef: 'process-data' }
    ]
  },
  { baseUrl: 'https://api.example.com' }
);
```

### Schema Chain Workflows
Create workflows from schema transformations:

```typescript
const schemaChainWorkflow = workflowGenerator.fromSchemaChain(
  'user-processing',
  [
    z.object({ rawData: z.string() }),
    z.object({ parsed: z.any() }),
    z.object({ validated: UserSchema }),
    z.object({ enriched: UserSchema.extend({ metadata: z.any() }) })
  ],
  [
    async (input) => ({ parsed: JSON.parse(input.rawData) }),
    async (input) => ({ validated: UserSchema.parse(input.parsed) }),
    async (input) => ({ enriched: { ...input.validated, metadata: {} } })
  ]
);
```

### Validation Workflows
Create workflows with built-in validation:

```typescript
const validationWorkflow = workflowGenerator.createValidationWorkflow(
  'user-validation',
  UserSchema.extend({
    password: z.string().min(8),
    confirmPassword: z.string()
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }),
  [
    async (data) => ({ ...data, normalized: true }),
    async (data) => ({ ...data, sanitized: true })
  ]
);
```

### Conditional Workflows
Create branching workflows:

```typescript
const conditionalWorkflow = workflowGenerator.createConditionalWorkflow(
  'conditional-processor',
  [
    {
      name: 'premium',
      condition: (data: any) => data.tier === 'premium',
      workflow: premiumWorkflow
    },
    {
      name: 'standard',
      condition: (data: any) => data.tier === 'standard',
      workflow: standardWorkflow
    }
  ],
  defaultWorkflow // Fallback
);
```

---

## Hook System

### Available Hooks
Citty Pro provides 11 lifecycle hooks:

```typescript
type HookPayload = {
  "cli:boot": { argv: string[] }           // Application startup
  "config:load": { config: any }           // Configuration loaded
  "ctx:ready": { ctx: RunCtx }             // Context initialized
  "args:parsed": { args: any }             // Arguments parsed
  "command:resolved": { name?: string }     // Command identified
  "workflow:compile": { id: string }        // Workflow prepared
  "task:will:call": { id: string; input: any }    // Before task
  "task:did:call": { id: string; res: any }       // After task
  "output:will:emit": { out: Output }       // Before output
  "output:did:emit": { out: Output }        // After output
  "persist:will": { out: Output }           // Before persistence
  "persist:did": { ok: boolean }            // After persistence
  "report:will": { out: Output }            // Before reporting
  "report:did": { ok: boolean }             // After reporting
  "cli:done": null                          // Completion
}
```

### Registering Hooks

```typescript
import { hooks } from '@citty/pro';

// Simple hook
hooks.hook('task:will:call', async ({ id, input }) => {
  console.log(`Starting task ${id} with input:`, input);
});

// Hook with cleanup
const unhook = hooks.hook('task:did:call', async ({ id, res }) => {
  await logToDatabase(id, res);
});

// Remove hook later
unhook();
```

### Creating Hook Middleware

```typescript
function createTimingMiddleware() {
  const timings = new Map<string, number>();
  
  hooks.hook('task:will:call', ({ id }) => {
    timings.set(id, Date.now());
  });
  
  hooks.hook('task:did:call', ({ id }) => {
    const start = timings.get(id);
    if (start) {
      console.log(`Task ${id} took ${Date.now() - start}ms`);
      timings.delete(id);
    }
  });
}
```

---

## AI Integration

### Setting Up AI Context

```typescript
const aiContext = {
  model: { id: 'gpt-4', vendor: 'openai' as const },
  generate: async (opts) => {
    // Your AI provider implementation
    const response = await openai.chat.completions.create({
      model: opts.model.id,
      messages: [
        { role: 'system', content: opts.system || '' },
        { role: 'user', content: opts.prompt }
      ],
      tools: opts.tools ? Object.entries(opts.tools).map(([name, tool]) => ({
        type: 'function',
        function: {
          name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.schema)
        }
      })) : undefined
    });
    
    return {
      text: response.choices[0].message.content || '',
      toolCalls: response.choices[0].message.tool_calls?.map(tc => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
      }))
    };
  }
};
```

### AI Wrapper Commands

```typescript
const aiCommand = cittyPro.defineAIWrapperCommand({
  meta: {
    name: 'ai-assist',
    description: 'AI-powered assistance'
  },
  args: {
    prompt: { type: 'string', required: true },
    model: { type: 'enum', options: ['gpt-4', 'claude-3'], default: 'gpt-4' }
  },
  ai: {
    model: { id: 'gpt-4', vendor: 'openai' },
    system: 'You are a helpful assistant.',
    tools: {
      search: {
        description: 'Search the web',
        schema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // Implement search
          return { results: [] };
        }
      }
    }
  },
  plan: (args, ctx) => `Help with: ${args.prompt}`,
  onToolCall: async (name, input, ctx) => {
    console.log(`Tool called: ${name}`, input);
  },
  run: async (args, ctx) => {
    const response = await ctx.ai!.generate({
      prompt: args.prompt
    });
    return { text: response.text };
  }
});
```

### Multi-Model Orchestration

```typescript
async function multiModelConsensus(prompt: string, ctx: RunCtx) {
  const models = [
    { id: 'gpt-4', vendor: 'openai' },
    { id: 'claude-3', vendor: 'anthropic' },
    { id: 'llama-2', vendor: 'ollama' }
  ];
  
  const responses = await Promise.all(
    models.map(model => 
      ctx.ai!.generate({
        ...ctx.ai,
        model,
        prompt
      })
    )
  );
  
  // Aggregate responses
  return {
    consensus: responses.filter(r => 
      r.text.includes('agree')
    ).length > models.length / 2
  };
}
```

---

## Plugin Development

### Creating a Plugin

```typescript
import type { Plugin, Hooks, RunCtx } from '@citty/pro';

export function createCustomPlugin(options: any): Plugin {
  return async (hooks: Hooks, ctx: RunCtx) => {
    // Setup phase
    hooks.hook('cli:boot', async () => {
      console.log('Plugin initialized');
    });
    
    // Task monitoring
    hooks.hook('task:will:call', async ({ id, input }) => {
      // Pre-task logic
    });
    
    hooks.hook('task:did:call', async ({ id, res }) => {
      // Post-task logic
    });
    
    // Cleanup
    hooks.hook('cli:done', async () => {
      // Cleanup resources
    });
  };
}
```

### Plugin with State

```typescript
export function createStatefulPlugin() {
  const state = {
    taskCount: 0,
    errors: [],
    startTime: Date.now()
  };
  
  return async (hooks: Hooks, ctx: RunCtx) => {
    hooks.hook('task:will:call', () => {
      state.taskCount++;
    });
    
    hooks.hook('task:did:call', ({ res }) => {
      if (res?.error) {
        state.errors.push(res.error);
      }
    });
    
    hooks.hook('report:will', async ({ out }) => {
      const duration = Date.now() - state.startTime;
      console.log(`
        Tasks executed: ${state.taskCount}
        Errors: ${state.errors.length}
        Duration: ${duration}ms
      `);
    });
  };
}
```

### Async Plugin Initialization

```typescript
export function createAsyncPlugin(config: any): Plugin {
  return async (hooks: Hooks, ctx: RunCtx) => {
    // Async initialization
    const connection = await connectToService(config);
    
    hooks.hook('task:did:call', async ({ id, res }) => {
      await connection.log(id, res);
    });
    
    hooks.hook('cli:done', async () => {
      await connection.close();
    });
  };
}
```

---

## Best Practices

### 1. Schema Design
- **Use Branded Types**: Add semantic meaning to primitives
```typescript
const EmailSchema = z.string().email().brand<'Email'>();
const UserIdSchema = z.string().uuid().brand<'UserId'>();
```

### 2. Error Handling
- **Use Error Boundaries**: Wrap workflows in try-catch
```typescript
try {
  await workflow.run(ctx);
} catch (error) {
  if (error instanceof ZodError) {
    // Handle validation errors
  } else if (error instanceof CLIError) {
    // Handle CLI errors
  } else {
    // Handle unexpected errors
  }
}
```

### 3. Performance
- **Use Memoization**: Cache expensive computations
```typescript
const memoizedTask = cittyPro.defineTask({
  id: 'memoized',
  run: async (input: string, ctx) => {
    const key = `memo:${input}`;
    if (ctx.memo?.[key]) {
      return ctx.memo[key];
    }
    const result = await expensiveOperation(input);
    if (ctx.memo) ctx.memo[key] = result;
    return result;
  }
});
```

### 4. Testing
- **Mock Context**: Create test contexts
```typescript
const testContext: RunCtx = {
  cwd: '/test',
  env: {},
  now: () => new Date('2024-01-01'),
  memo: {}
};

const result = await task.call(input, testContext);
```

### 5. Composition
- **Small, Reusable Tasks**: Build complex workflows from simple tasks
```typescript
const atomicTasks = {
  validate: defineTask({ /* ... */ }),
  transform: defineTask({ /* ... */ }),
  persist: defineTask({ /* ... */ })
};

const workflow = defineWorkflow({
  steps: Object.entries(atomicTasks).map(([id, task]) => ({
    id,
    use: task
  }))
});
```

---

## API Reference

### Core Functions

#### `defineTask<TIn, TOut, Ctx>(spec)`
Creates a new task with optional validation.

#### `defineWorkflow<Ctx, State>(spec)`
Creates a workflow from task steps.

#### `defineAIWrapperCommand<T, Ctx>(spec)`
Creates an AI-powered command.

#### `runLifecycle(options)`
Executes the complete CLI lifecycle.

### Workflow Generator

#### `workflowGenerator.registerTask(ontology, implementation)`
Registers a task with semantic ontology.

#### `workflowGenerator.generateWorkflow(ontology, seed)`
Generates workflow from ontology.

#### `workflowGenerator.createValidationWorkflow(id, schema, processors)`
Creates validation-focused workflow.

#### `workflowGenerator.createConditionalWorkflow(id, conditions, default)`
Creates branching workflow.

### Hooks

#### `hooks.hook(name, handler)`
Registers a lifecycle hook.

#### `hooks.callHook(name, payload)`
Manually triggers a hook.

#### `hooks.removeAllHooks()`
Clears all registered hooks.

### Context Functions

#### `withContext(ctx, fn)`
Executes function with context.

#### `useContext()`
Retrieves current context.

#### `requireContext()`
Gets context or throws.

---

## Advanced Examples

### Complete CLI Application

```typescript
import { defineCommand, runMain } from 'citty';
import { cittyPro, hooks, registerCoreHooks } from '@citty/pro';
import { workflowGenerator } from '@citty/pro/workflow-generator';
import { z } from 'zod';

// Initialize
registerCoreHooks();

// Define schemas
const ConfigSchema = z.object({
  input: z.string(),
  output: z.string(),
  format: z.enum(['json', 'yaml', 'toml'])
});

// Create tasks
const tasks = {
  load: workflowGenerator.registerTask(
    {
      '@type': 'Task',
      '@id': 'load-config',
      name: 'Load Configuration',
      capabilities: ['file-operation']
    },
    async (input: z.infer<typeof ConfigSchema>) => {
      // Load implementation
      return { data: {} };
    }
  ),
  
  process: workflowGenerator.registerTask(
    {
      '@type': 'Task',
      '@id': 'process-config',
      name: 'Process Configuration',
      capabilities: ['data-transform']
    },
    async (input: any) => {
      // Process implementation
      return { processed: input };
    }
  )
};

// Create workflow
const configWorkflow = workflowGenerator.generateWorkflow({
  '@type': 'Workflow',
  '@id': 'config-pipeline',
  name: 'Configuration Pipeline',
  steps: [
    { id: 'load', taskRef: 'load-config' },
    { id: 'process', taskRef: 'process-config' }
  ]
});

// Define CLI command
const cmd = defineCommand({
  meta: {
    name: 'config-tool',
    version: '1.0.0',
    description: 'Configuration processing tool'
  },
  args: {
    input: { type: 'string', required: true },
    output: { type: 'string', required: true },
    format: { type: 'enum', options: ['json', 'yaml', 'toml'], default: 'json' }
  },
  run: async ({ args }) => {
    await cittyPro.runLifecycle({
      cmd,
      args,
      ctx: {
        cwd: process.cwd(),
        env: process.env,
        now: () => new Date()
      },
      runStep: async (ctx) => {
        const result = await configWorkflow.run(ctx);
        return { text: `Processed configuration: ${JSON.stringify(result)}` };
      }
    });
  }
});

// Run application
runMain(cmd);
```

---

## Migration Guide

### From Basic Citty

```typescript
// Before (Citty)
const cmd = defineCommand({
  run: async ({ args }) => {
    // Direct implementation
  }
});

// After (Citty Pro)
const task = cittyPro.defineTask({
  id: 'main-task',
  run: async (args) => {
    // Task implementation
  }
});

const cmd = defineCommand({
  run: async ({ args }) => {
    await cittyPro.runLifecycle({
      cmd,
      args,
      ctx: createContext(),
      runStep: async (ctx) => task.call(args, ctx)
    });
  }
});
```

---

## Resources

- [GitHub Repository](https://github.com/unjs/citty)
- [Cookbook with 25+ Patterns](./CITTY-PRO-COOKBOOK.md)
- [API Documentation](./api)
- [Examples](./examples)

## License

MIT License - See LICENSE file for details.