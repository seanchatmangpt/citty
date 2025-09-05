#!/usr/bin/env node
// Citty Pro Framework Demo CLI
import { defineCommand, runMain } from 'citty';
import { z } from 'zod';
import {
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle,
  registerCoreHooks,
  hooks,
  createDefaultContext,
  registerPlugin,
  applyPlugins,
  createOtelPlugin
} from '../src/pro';

// Register core hooks
registerCoreHooks();

// Register OTEL plugin for observability
const otelPlugin = createOtelPlugin({
  serviceName: 'citty-pro-demo',
  enableTracing: true,
  enableMetrics: true,
  enableLogs: process.env.DEBUG === 'true'
});
registerPlugin('otel', otelPlugin);

// ============= Define Tasks =============

// Task 1: Validate input data
const validateDataTask = defineTask({
  id: 'validate-data',
  in: z.object({
    text: z.string().min(1),
    format: z.enum(['json', 'yaml', 'text']).optional()
  }),
  out: z.object({
    valid: z.boolean(),
    normalized: z.string(),
    format: z.string()
  }),
  run: async (input) => {
    console.log('📋 Validating input data...');
    
    // Normalize and validate
    const normalized = input.text.trim().toLowerCase();
    const format = input.format || 'text';
    
    return {
      valid: true,
      normalized,
      format
    };
  }
});

// Task 2: Process data
const processDataTask = defineTask({
  id: 'process-data',
  in: z.object({
    normalized: z.string(),
    format: z.string()
  }),
  out: z.object({
    processed: z.boolean(),
    result: z.any(),
    statistics: z.object({
      length: z.number(),
      words: z.number(),
      format: z.string()
    })
  }),
  run: async (input) => {
    console.log('⚙️  Processing data...');
    
    // Process based on format
    let result: any;
    switch (input.format) {
      case 'json':
        try {
          result = JSON.parse(input.normalized);
        } catch {
          result = { text: input.normalized };
        }
        break;
      case 'yaml':
        result = { yaml_content: input.normalized };
        break;
      default:
        result = input.normalized.toUpperCase();
    }
    
    const statistics = {
      length: input.normalized.length,
      words: input.normalized.split(/\s+/).length,
      format: input.format
    };
    
    return {
      processed: true,
      result,
      statistics
    };
  }
});

// Task 3: Generate report
const generateReportTask = defineTask({
  id: 'generate-report',
  run: async (input: any) => {
    console.log('📊 Generating report...');
    
    const report = {
      summary: `Processed ${input.statistics.words} words in ${input.statistics.format} format`,
      timestamp: new Date().toISOString(),
      details: input
    };
    
    return report;
  }
});

// ============= Define Workflow =============

const dataProcessingWorkflow = defineWorkflow({
  id: 'data-processing-pipeline',
  seed: (ctx) => ({
    startTime: ctx.now(),
    context: {
      cwd: ctx.cwd,
      session: Math.random().toString(36).substring(7)
    }
  }),
  steps: [
    {
      id: 'validate',
      use: validateDataTask,
      select: (state, ctx) => state.input
    },
    {
      id: 'process',
      use: processDataTask,
      select: (state) => state.validate
    },
    {
      id: 'report',
      use: generateReportTask,
      select: (state) => state.process,
      as: 'final_report'
    }
  ]
});

// ============= Define AI Commands =============

const aiAnalyzeCommand = defineAIWrapperCommand({
  meta: {
    name: 'analyze',
    description: 'Analyze text using AI capabilities'
  },
  args: {
    text: {
      type: 'string',
      required: true,
      description: 'Text to analyze'
    },
    model: {
      type: 'string',
      default: 'local',
      description: 'AI model to use'
    }
  },
  ai: {
    model: { id: 'demo-model', vendor: 'local' },
    tools: {
      sentiment: {
        description: 'Analyze sentiment of text',
        schema: z.object({ text: z.string() }),
        execute: async (input) => ({
          sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
          confidence: Math.random()
        })
      },
      keywords: {
        description: 'Extract keywords from text',
        schema: z.object({ text: z.string(), limit: z.number().optional() }),
        execute: async (input) => ({
          keywords: input.text.split(' ').slice(0, input.limit || 5)
        })
      }
    },
    system: 'You are a helpful text analysis assistant.'
  },
  plan: (args) => `Analyze the following text for sentiment and keywords: "${args.text}"`,
  onToolCall: async (name, input, ctx) => {
    console.log(`🔧 Tool called: ${name}`);
  },
  run: async (args, ctx) => {
    console.log('🤖 Running AI analysis...');
    
    // Simulate AI analysis
    const analysis = {
      input: args.text,
      length: args.text.length,
      words: args.text.split(' ').length,
      sentiment: 'neutral',
      confidence: 0.75,
      keywords: args.text.split(' ').slice(0, 3)
    };
    
    return {
      text: `Analysis complete! Found ${analysis.keywords.length} keywords with ${analysis.sentiment} sentiment (${(analysis.confidence * 100).toFixed(1)}% confidence)`,
      json: analysis
    };
  }
});

// ============= Main Commands =============

const processCommand = defineCommand({
  meta: {
    name: 'process',
    description: 'Process data through the workflow pipeline'
  },
  args: {
    input: {
      type: 'string',
      required: true,
      description: 'Input data to process'
    },
    format: {
      type: 'enum',
      options: ['json', 'yaml', 'text'],
      default: 'text',
      description: 'Input format'
    }
  },
  async run({ args }) {
    const ctx = createDefaultContext();
    
    // Apply plugins
    await applyPlugins(hooks as any, ctx);
    
    await runLifecycle({
      cmd: this,
      args,
      ctx,
      runStep: async (context) => {
        // Set initial input
        const initialState = {
          input: {
            text: args.input,
            format: args.format
          }
        };
        
        // Run workflow with initial state
        const workflow = defineWorkflow({
          ...dataProcessingWorkflow,
          seed: { ...initialState, startTime: context.now() }
        } as any);
        
        const result = await workflow.run(context);
        
        return {
          text: `✅ ${result.final_report.summary}`,
          json: result
        };
      }
    });
  }
});

const benchmarkCommand = defineCommand({
  meta: {
    name: 'benchmark',
    description: 'Run performance benchmarks'
  },
  args: {
    iterations: {
      type: 'number',
      default: 100,
      description: 'Number of iterations'
    }
  },
  async run({ args }) {
    console.log(`🏃 Running ${args.iterations} iterations...`);
    
    const ctx = createDefaultContext();
    const times: number[] = [];
    
    for (let i = 0; i < args.iterations; i++) {
      const start = performance.now();
      
      await validateDataTask.call(
        { text: `test input ${i}`, format: 'text' },
        ctx
      );
      
      times.push(performance.now() - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log(`
📊 Benchmark Results:
  Iterations: ${args.iterations}
  Average: ${avg.toFixed(2)}ms
  Min: ${min.toFixed(2)}ms
  Max: ${max.toFixed(2)}ms
    `);
  }
});

// ============= Main CLI =============

const main = defineCommand({
  meta: {
    name: 'citty-pro-demo',
    version: '1.0.0',
    description: '🚀 Citty Pro Framework Demo - Advanced CLI with Tasks, Workflows, and AI'
  },
  subCommands: {
    process: processCommand,
    analyze: aiAnalyzeCommand as any,
    benchmark: benchmarkCommand
  },
  args: {
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Enable verbose output'
    }
  },
  async run({ args }) {
    if (args.verbose) {
      process.env.CITTY_DEBUG = 'true';
    }
    
    console.log(`
🚀 Citty Pro Framework Demo

Available commands:
  process    - Process data through workflow pipeline
  analyze    - Analyze text using AI capabilities
  benchmark  - Run performance benchmarks

Examples:
  citty-pro-demo process --input "Hello World" --format text
  citty-pro-demo analyze --text "This is amazing!"
  citty-pro-demo benchmark --iterations 1000

Run 'citty-pro-demo <command> --help' for command-specific help.
    `);
  }
});

// Run the CLI
if (import.meta.main) {
  runMain(main);
}