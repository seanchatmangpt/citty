// packages/citty-pro/src/plugins/otel.plugin.ts
import type { Plugin, Hooks, RunCtx } from '../../types/citty-pro';
import { trace, metrics, SpanStatusCode, type Span, type Counter } from '@opentelemetry/api';

export interface OtelPluginOptions {
  serviceName?: string;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogs?: boolean;
}

export function createOtelPlugin(options: OtelPluginOptions = {}): Plugin {
  const {
    serviceName = 'citty-pro',
    enableTracing = true,
    enableMetrics = true,
    enableLogs = true
  } = options;
  
  return async (hooks: Hooks, ctx: RunCtx) => {
    // Get tracer and meter
    const tracer = enableTracing ? trace.getTracer(serviceName, '1.0.0') : null;
    const meter = enableMetrics ? metrics.getMeter(serviceName, '1.0.0') : null;
    
    // Create metrics
    let cliRunsCounter: Counter | null = null;
    let tasksCounter: Counter | null = null;
    let errorsCounter: Counter | null = null;
    
    if (meter) {
      cliRunsCounter = meter.createCounter('cli.runs', {
        description: 'Number of CLI runs'
      });
      
      tasksCounter = meter.createCounter('tasks.executed', {
        description: 'Number of tasks executed'
      });
      
      errorsCounter = meter.createCounter('errors.total', {
        description: 'Total number of errors'
      });
    }
    
    // Track spans
    const activeSpans: Map<string, Span> = new Map();
    
    // CLI Boot
    hooks.hook('cli:boot', async ({ argv }) => {
      if (tracer) {
        const span = tracer.startSpan('cli.boot');
        span.setAttributes({
          'cli.argv': argv.join(' '),
          'cli.service': serviceName
        });
        activeSpans.set('cli.boot', span);
      }
      
      if (cliRunsCounter) {
        cliRunsCounter.add(1, {
          service: serviceName
        });
      }
      
      if (enableLogs) {
        console.log(`[OTEL] CLI boot: ${argv.join(' ')}`);
      }
    });
    
    // Context Ready
    hooks.hook('ctx:ready', async ({ ctx: context }) => {
      const bootSpan = activeSpans.get('cli.boot');
      if (bootSpan) {
        bootSpan.end();
        activeSpans.delete('cli.boot');
      }
      
      if (tracer) {
        const span = tracer.startSpan('cli.session');
        span.setAttributes({
          'session.cwd': context.cwd,
          'session.env_count': Object.keys(context.env || {}).length
        });
        activeSpans.set('cli.session', span);
      }
    });
    
    // Task execution tracking
    hooks.hook('task:will:call', async ({ id, input }) => {
      if (tracer) {
        const span = tracer.startSpan(`task.${id}`, {
          attributes: {
            'task.id': id,
            'task.input_type': typeof input
          }
        });
        activeSpans.set(`task.${id}`, span);
      }
      
      if (enableLogs) {
        console.log(`[OTEL] Task starting: ${id}`);
      }
    });
    
    hooks.hook('task:did:call', async ({ id, res }) => {
      const span = activeSpans.get(`task.${id}`);
      if (span) {
        // Check for errors
        if (res && typeof res === 'object' && 'error' in res) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String((res as any).error)
          });
          
          if (errorsCounter) {
            errorsCounter.add(1, {
              task: id,
              service: serviceName
            });
          }
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
          
          // Track duration if available
          if (res && typeof res === 'object' && '__duration' in res) {
            span.setAttribute('task.duration_ms', (res as any).__duration);
          }
        }
        
        span.end();
        activeSpans.delete(`task.${id}`);
      }
      
      if (tasksCounter) {
        tasksCounter.add(1, {
          task: id,
          service: serviceName
        });
      }
      
      if (enableLogs) {
        console.log(`[OTEL] Task completed: ${id}`);
      }
    });
    
    // Output tracking
    hooks.hook('output:will:emit', async ({ out }) => {
      if (tracer) {
        const span = tracer.startSpan('output.emit');
        span.setAttributes({
          'output.has_text': !!out.text,
          'output.has_json': !!out.json,
          'output.files_count': out.files?.length || 0
        });
        activeSpans.set('output.emit', span);
      }
    });
    
    hooks.hook('output:did:emit', async () => {
      const span = activeSpans.get('output.emit');
      if (span) {
        span.end();
        activeSpans.delete('output.emit');
      }
    });
    
    // CLI completion
    hooks.hook('cli:done', async () => {
      // End all remaining spans
      for (const [name, span] of activeSpans) {
        span.end();
        if (enableLogs) {
          console.log(`[OTEL] Closing span: ${name}`);
        }
      }
      activeSpans.clear();
      
      if (enableLogs) {
        console.log('[OTEL] CLI session completed');
      }
    });
    
    // Add OTEL capabilities to context
    if (ctx.otel) {
      ctx.otel.span = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
        if (!tracer) return fn();
        
        const span = tracer.startSpan(name);
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        } finally {
          span.end();
        }
      };
      
      if (meter) {
        ctx.otel.counter = (name: string) => {
          const counter = meter.createCounter(name);
          return {
            add: (n: number) => counter.add(n, { service: serviceName })
          };
        };
      }
    }
  };
}