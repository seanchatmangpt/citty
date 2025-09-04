/**
 * OpenTelemetry Auto-Instrumentation for CLI Applications
 * Provides automatic tracing, metrics, and logging for CLI tools
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, metrics, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import consola from 'consola';
import { z } from 'zod';

// Configuration schema
const TelemetryConfigSchema = z.object({
  serviceName: z.string().default('citty-cli'),
  serviceVersion: z.string().default('1.0.0'),
  environment: z.string().default('development'),
  enableTracing: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableLogging: z.boolean().default(true),
  exporters: z.object({
    traces: z.array(z.enum(['console', 'jaeger', 'otlp'])).default(['console']),
    metrics: z.array(z.enum(['console', 'prometheus', 'otlp'])).default(['console']),
    logs: z.array(z.enum(['console', 'otlp'])).default(['console'])
  }).default({
    traces: ['console'],
    metrics: ['console'],
    logs: ['console']
  }),
  sampling: z.object({
    rate: z.number().min(0).max(1).default(0.1),
    strategy: z.enum(['always_on', 'always_off', 'trace_id_ratio']).default('trace_id_ratio')
  }).default({
    rate: 0.1,
    strategy: 'trace_id_ratio'
  }),
  resource: z.object({
    attributes: z.record(z.string(), z.any()).optional()
  }).optional()
});

export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;

// Global SDK instance
let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry instrumentation
 */
export function initializeTelemetry(config?: Partial<TelemetryConfig>): NodeSDK {
  if (isInitialized) {
    consola.warn('OpenTelemetry already initialized, returning existing instance');
    return sdk!;
  }

  // Load config from file if exists
  const configFromFile = loadConfigFromFile();
  const finalConfig = TelemetryConfigSchema.parse({
    ...configFromFile,
    ...config
  });

  consola.info('🔧 Initializing OpenTelemetry instrumentation...');

  // Create resource
  const resource = Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: finalConfig.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: finalConfig.serviceVersion,
      'service.environment': finalConfig.environment,
      'telemetry.sdk.name': 'citty-pro',
      'telemetry.sdk.version': '1.0.0',
      ...finalConfig.resource?.attributes
    })
  );

  // Setup exporters and processors
  const traceExporter = setupTraceExporter(finalConfig);
  const metricReader = setupMetricReader(finalConfig);

  // Create SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some instrumentations that might be noisy for CLI apps
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false }
      })
    ]
  });

  // Initialize SDK
  sdk.start();
  isInitialized = true;

  consola.success('✅ OpenTelemetry initialized successfully');
  consola.info(`   Service: ${finalConfig.serviceName}@${finalConfig.serviceVersion}`);
  consola.info(`   Environment: ${finalConfig.environment}`);
  consola.info(`   Tracing: ${finalConfig.enableTracing ? '✅' : '❌'}`);
  consola.info(`   Metrics: ${finalConfig.enableMetrics ? '✅' : '❌'}`);

  return sdk;
}

/**
 * Setup trace exporter based on configuration
 */
function setupTraceExporter(config: TelemetryConfig): any {
  // For now, just use console exporter
  if (config.exporters.traces.includes('console')) {
    return new ConsoleSpanExporter();
  }
  return undefined;
}

/**
 * Setup metric reader based on configuration
 */
function setupMetricReader(config: TelemetryConfig): any {
  // Use Prometheus if requested, otherwise console
  if (config.exporters.metrics.includes('prometheus')) {
    return new PrometheusExporter({
      port: 9464,
    }, () => {
      consola.info('Prometheus metrics server started on port 9464');
    });
  }
  
  if (config.exporters.metrics.includes('console')) {
    return new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 30_000
    });
  }
  
  return undefined;
}

/**
 * Load configuration from file
 */
function loadConfigFromFile(): Partial<TelemetryConfig> {
  const configFiles = [
    'telemetry.config.js',
    'telemetry.config.json',
    '.telemetryrc.json',
    'package.json'
  ];

  for (const configFile of configFiles) {
    const configPath = join(process.cwd(), configFile);
    
    if (existsSync(configPath)) {
      try {
        if (configFile === 'package.json') {
          const pkg = JSON.parse(readFileSync(configPath, 'utf8'));
          if (pkg.telemetry) {
            consola.info(`📝 Loaded telemetry config from ${configFile}`);
            return pkg.telemetry;
          }
        } else if (configFile.endsWith('.json')) {
          const config = JSON.parse(readFileSync(configPath, 'utf8'));
          consola.info(`📝 Loaded telemetry config from ${configFile}`);
          return config;
        }
      } catch (error) {
        consola.warn(`Failed to load config from ${configFile}:`, (error as Error).message);
      }
    }
  }

  return {};
}

/**
 * Gracefully shutdown telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk && isInitialized) {
    consola.info('🛑 Shutting down OpenTelemetry...');
    await sdk.shutdown();
    isInitialized = false;
    sdk = null;
    consola.success('✅ OpenTelemetry shut down successfully');
  }
}

/**
 * CLI Command tracing decorator
 */
export function traceCommand(name: string, version?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('cli-commands', version || '1.0.0');
      
      return tracer.startActiveSpan(`command.${name}`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          'cli.command.name': name,
          'cli.command.args': JSON.stringify(args)
        }
      }, async (span) => {
        try {
          const result = await originalMethod.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Metric collection utilities
 */
export class CLIMetrics {
  private static meter = metrics.getMeter('cli-metrics', '1.0.0');
  
  // Command execution counter
  static commandExecutions = this.meter.createCounter('cli_command_executions_total', {
    description: 'Total number of CLI command executions'
  });
  
  // Command duration histogram
  static commandDuration = this.meter.createHistogram('cli_command_duration_seconds', {
    description: 'CLI command execution duration in seconds'
  });
  
  // Error counter
  static commandErrors = this.meter.createCounter('cli_command_errors_total', {
    description: 'Total number of CLI command errors'
  });
  
  // Active commands gauge
  static activeCommands = this.meter.createUpDownCounter('cli_active_commands', {
    description: 'Number of currently active CLI commands'
  });

  /**
   * Record command execution
   */
  static recordExecution(commandName: string, duration: number, success: boolean) {
    const labels = { command: commandName, success: success.toString() };
    
    this.commandExecutions.add(1, labels);
    this.commandDuration.record(duration / 1000, labels);
    
    if (!success) {
      this.commandErrors.add(1, { command: commandName });
    }
  }

  /**
   * Record active command change
   */
  static recordActiveCommand(commandName: string, delta: number) {
    this.activeCommands.add(delta, { command: commandName });
  }
}

/**
 * Command performance monitoring decorator
 */
export function monitorPerformance(commandName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      CLIMetrics.recordActiveCommand(commandName, 1);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        CLIMetrics.recordExecution(commandName, duration, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        CLIMetrics.recordExecution(commandName, duration, false);
        throw error;
      } finally {
        CLIMetrics.recordActiveCommand(commandName, -1);
      }
    };

    return descriptor;
  };
}

/**
 * Auto-setup for CLI applications
 */
export function setupCLITelemetry(config?: Partial<TelemetryConfig>) {
  // Initialize on import if NODE_ENV is not test
  if (process.env.NODE_ENV !== 'test') {
    initializeTelemetry(config);

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      await shutdownTelemetry();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      await shutdownTelemetry();
      process.exit(0);
    });
  }
}

// Auto-initialize if config is provided via environment
if (process.env.CITTY_TELEMETRY_ENABLED === 'true') {
  setupCLITelemetry({
    serviceName: process.env.CITTY_SERVICE_NAME,
    serviceVersion: process.env.CITTY_SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development'
  });
}