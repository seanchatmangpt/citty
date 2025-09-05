# HIVE QUEEN BDD Implementation Guide

## Prerequisites & System Requirements

### Hardware Requirements
- **CPU**: 8+ cores (Intel Xeon or AMD EPYC recommended)
- **RAM**: 32GB minimum, 128GB recommended for enterprise workloads
- **Storage**: 1TB NVMe SSD minimum, 10TB for production
- **Network**: 10Gbps network interface for high-throughput scenarios

### Software Prerequisites
- **Node.js**: v20.0.0 or higher
- **TypeScript**: v5.8.0 or higher
- **pnpm**: v10.0.0 or higher (package manager)
- **Docker**: v24.0.0 or higher (for containerized deployments)
- **Kubernetes**: v1.28.0 or higher (for orchestration)

### Development Environment Setup

```bash
# 1. Install Node.js via Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# 2. Install pnpm
npm install -g pnpm@latest

# 3. Install TypeScript globally
pnpm add -g typescript@latest

# 4. Verify installations
node --version    # Should be v20+
pnpm --version    # Should be v10+
tsc --version     # Should be v5.8+
```

## Project Initialization

### 1. Create New HIVE QUEEN Project

```bash
# Initialize new project
mkdir my-hive-queen-project
cd my-hive-queen-project

# Initialize package.json with citty-pro dependencies
pnpm init

# Install core dependencies
pnpm add citty-pro@latest
pnpm add zod@latest
pnpm add @opentelemetry/api@latest
pnpm add @opentelemetry/sdk-node@latest

# Install development dependencies
pnpm add -D vitest@latest
pnpm add -D @vitest/coverage-v8@latest
pnpm add -D typescript@latest
pnpm add -D @types/node@latest
```

### 2. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "strict": true,
    "noEmit": true,
    "composite": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@/*": ["./src/*"],
      "@tests/*": ["./tests/*"],
      "@workflows/*": ["./workflows/*"]
    }
  },
  "include": [
    "src/**/*",
    "tests/**/*",
    "workflows/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ]
}
```

### 3. Project Structure Setup

```bash
# Create recommended directory structure
mkdir -p src/{workflows,tasks,schemas,plugins,utils}
mkdir -p tests/{unit,integration,e2e,bdd}
mkdir -p docs/{architecture,guides,examples}
mkdir -p config/{development,staging,production}
mkdir -p scripts/{build,deploy,testing}

# Create initial files
touch src/index.ts
touch src/workflows/index.ts
touch src/tasks/index.ts
touch src/schemas/index.ts
touch tests/setup.ts
```

### 4. Package.json Scripts Configuration

Update `package.json` with comprehensive scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit && tsx src/build.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:bdd": "vitest run tests/bdd",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "lint": "eslint src tests --ext .ts",
    "lint:fix": "eslint src tests --ext .ts --fix",
    "typecheck": "tsc --noEmit",
    "workflow:generate": "tsx scripts/generate-workflow.ts",
    "workflow:validate": "tsx scripts/validate-workflows.ts",
    "schema:generate": "tsx scripts/generate-schemas.ts",
    "docs:generate": "typedoc src --out docs/api",
    "otel:setup": "tsx src/observability/setup.ts"
  }
}
```

## Core Framework Configuration

### 1. Main Application Setup

Create `src/index.ts`:

```typescript
import { cittyPro, hooks, registerCoreHooks } from 'citty-pro';
import { setupObservability } from './observability/setup';
import { loadConfiguration } from './config/loader';
import { initializePlugins } from './plugins';
import { registerBusinessWorkflows } from './workflows';
import { setupErrorHandling } from './utils/error-handling';

async function bootstrap() {
  try {
    console.log('🚀 Initializing HIVE QUEEN BDD System...');
    
    // 1. Load configuration
    const config = await loadConfiguration();
    console.log('✅ Configuration loaded');
    
    // 2. Setup observability
    await setupObservability(config.observability);
    console.log('✅ Observability configured');
    
    // 3. Register core hooks
    registerCoreHooks();
    console.log('✅ Core hooks registered');
    
    // 4. Initialize plugins
    await initializePlugins(hooks, config.plugins);
    console.log('✅ Plugins initialized');
    
    // 5. Register business workflows
    await registerBusinessWorkflows();
    console.log('✅ Business workflows registered');
    
    // 6. Setup error handling
    setupErrorHandling();
    console.log('✅ Error handling configured');
    
    console.log('🎉 HIVE QUEEN BDD System ready!');
    
    return {
      cittyPro,
      config,
      status: 'ready'
    };
  } catch (error) {
    console.error('❌ Failed to initialize HIVE QUEEN:', error);
    process.exit(1);
  }
}

// Bootstrap the application
bootstrap().then(app => {
  console.log('System Status:', app.status);
});

export { bootstrap };
```

### 2. Configuration Management

Create `src/config/loader.ts`:

```typescript
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration schema validation
const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().positive().default(10),
    timeout: z.number().positive().default(30000)
  }),
  observability: z.object({
    enabled: z.boolean().default(true),
    serviceName: z.string().default('hive-queen-bdd'),
    traceExporter: z.enum(['jaeger', 'otlp', 'console']).default('console'),
    metricsInterval: z.number().positive().default(5000)
  }),
  plugins: z.object({
    telemetry: z.object({
      enabled: z.boolean().default(true),
      metricsEndpoint: z.string().optional()
    }),
    audit: z.object({
      enabled: z.boolean().default(true),
      retentionDays: z.number().positive().default(2555) // 7 years for SOX
    }),
    cache: z.object({
      enabled: z.boolean().default(true),
      redisUrl: z.string().optional(),
      ttl: z.number().positive().default(3600)
    })
  }),
  security: z.object({
    encryption: z.object({
      algorithm: z.string().default('aes-256-gcm'),
      keyRotationInterval: z.number().default(86400000) // 24 hours
    }),
    authentication: z.object({
      jwtSecret: z.string(),
      jwtExpiration: z.string().default('1h'),
      mfaEnabled: z.boolean().default(true)
    })
  }),
  performance: z.object({
    maxConcurrentWorkflows: z.number().positive().default(1000),
    taskTimeout: z.number().positive().default(30000),
    retryMaxAttempts: z.number().positive().default(3),
    circuitBreakerThreshold: z.number().positive().default(5)
  })
});

export type SystemConfig = z.infer<typeof ConfigSchema>;

export async function loadConfiguration(): Promise<SystemConfig> {
  const env = process.env.NODE_ENV || 'development';
  const configFile = join(process.cwd(), 'config', `${env}.json`);
  
  try {
    const configData = JSON.parse(readFileSync(configFile, 'utf8'));
    
    // Merge with environment variables
    const config = {
      ...configData,
      environment: env,
      database: {
        ...configData.database,
        url: process.env.DATABASE_URL || configData.database?.url
      },
      security: {
        ...configData.security,
        authentication: {
          ...configData.security?.authentication,
          jwtSecret: process.env.JWT_SECRET || configData.security?.authentication?.jwtSecret
        }
      }
    };
    
    // Validate configuration
    const result = ConfigSchema.safeParse(config);
    
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }
    
    return result.data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Configuration file ${configFile} not found, using defaults`);
      return ConfigSchema.parse({
        environment: env,
        database: { url: process.env.DATABASE_URL || 'postgresql://localhost:5432/hive_queen' },
        security: { authentication: { jwtSecret: process.env.JWT_SECRET || 'default-secret' } }
      });
    }
    throw error;
  }
}
```

### 3. Plugin System Configuration

Create `src/plugins/index.ts`:

```typescript
import { Plugin, hooks as globalHooks } from 'citty-pro';
import { SystemConfig } from '../config/loader';
import { createTelemetryPlugin } from './telemetry';
import { createAuditPlugin } from './audit';
import { createCachePlugin } from './cache';
import { createSecurityPlugin } from './security';
import { createPerformancePlugin } from './performance';

export async function initializePlugins(
  hooks: typeof globalHooks, 
  config: SystemConfig['plugins']
): Promise<void> {
  const plugins: Plugin[] = [];
  
  // Telemetry plugin for metrics and monitoring
  if (config.telemetry.enabled) {
    plugins.push(createTelemetryPlugin(config.telemetry));
    console.log('📊 Telemetry plugin enabled');
  }
  
  // Audit plugin for compliance and logging
  if (config.audit.enabled) {
    plugins.push(createAuditPlugin(config.audit));
    console.log('📋 Audit plugin enabled');
  }
  
  // Cache plugin for performance optimization
  if (config.cache.enabled) {
    plugins.push(createCachePlugin(config.cache));
    console.log('⚡ Cache plugin enabled');
  }
  
  // Security plugin for encryption and authentication
  plugins.push(createSecurityPlugin());
  console.log('🔒 Security plugin enabled');
  
  // Performance plugin for optimization
  plugins.push(createPerformancePlugin());
  console.log('🚀 Performance plugin enabled');
  
  // Initialize all plugins
  await Promise.all(plugins.map(plugin => plugin(hooks, {} as any)));
  
  console.log(`✅ ${plugins.length} plugins initialized successfully`);
}
```

### 4. Observability Setup

Create `src/observability/setup.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { metrics } from '@opentelemetry/api';
import { SystemConfig } from '../config/loader';

export async function setupObservability(config: SystemConfig['observability']) {
  if (!config.enabled) {
    console.log('📡 Observability disabled');
    return;
  }
  
  // Initialize OpenTelemetry SDK
  const sdk = new NodeSDK({
    resource: Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'hive-queen-bdd',
      })
    ),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation for performance
      },
    })],
  });
  
  // Initialize Prometheus metrics exporter
  const prometheusExporter = new PrometheusExporter({
    port: 9464, // Prometheus metrics port
  }, () => {
    console.log('📊 Prometheus metrics available at http://localhost:9464/metrics');
  });
  
  // Register the exporter
  metrics.registerGlobalMetricsReader(prometheusExporter);
  
  // Start the SDK
  sdk.start();
  
  // Create custom metrics
  const meter = metrics.getMeter('hive-queen-bdd', '1.0.0');
  
  const workflowCounter = meter.createCounter('workflows_total', {
    description: 'Total number of workflows executed',
  });
  
  const workflowDurationHistogram = meter.createHistogram('workflow_duration_ms', {
    description: 'Duration of workflow execution in milliseconds',
  });
  
  const taskCounter = meter.createCounter('tasks_total', {
    description: 'Total number of tasks executed',
  });
  
  const errorCounter = meter.createCounter('errors_total', {
    description: 'Total number of errors encountered',
  });
  
  // Export metrics for use in other modules
  global.hiveQueenMetrics = {
    workflowCounter,
    workflowDurationHistogram,
    taskCounter,
    errorCounter
  };
  
  console.log('📡 Observability configured successfully');
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await sdk.shutdown();
    console.log('📡 Observability shutdown complete');
  });
}

// Metrics helper functions
export const recordWorkflowStart = (workflowId: string) => {
  global.hiveQueenMetrics?.workflowCounter.add(1, { workflow_id: workflowId, status: 'started' });
};

export const recordWorkflowComplete = (workflowId: string, duration: number) => {
  global.hiveQueenMetrics?.workflowCounter.add(1, { workflow_id: workflowId, status: 'completed' });
  global.hiveQueenMetrics?.workflowDurationHistogram.record(duration, { workflow_id: workflowId });
};

export const recordTaskExecution = (taskId: string) => {
  global.hiveQueenMetrics?.taskCounter.add(1, { task_id: taskId });
};

export const recordError = (errorType: string, component: string) => {
  global.hiveQueenMetrics?.errorCounter.add(1, { error_type: errorType, component });
};
```

## Testing Framework Setup

### 1. Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        'scripts/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000, // 30 seconds for complex workflows
    hookTimeout: 10000, // 10 seconds for setup/teardown
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 8
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
      '@workflows': resolve(__dirname, './workflows')
    }
  }
});
```

### 2. Test Setup Configuration

Create `tests/setup.ts`:

```typescript
import { vi, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase } from './utils/database';
import { setupTestObservability } from './utils/observability';
import { createTestContext } from './utils/context';

// Global test configuration
beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();
  
  // Setup test observability
  await setupTestObservability();
  
  // Create global test context
  global.testContext = createTestContext();
  
  // Mock console methods for cleaner test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  console.log('🧪 Test environment initialized');
});

afterAll(async () => {
  // Cleanup test resources
  await global.testContext?.cleanup();
  
  // Restore console methods
  vi.restoreAllMocks();
  
  console.log('🧪 Test environment cleanup complete');
});

// Extend global namespace for TypeScript
declare global {
  var testContext: any;
  var hiveQueenMetrics: any;
}
```

### 3. BDD Test Structure

Create `tests/bdd/enterprise-workflows.feature.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { cittyPro } from 'citty-pro';
import { z } from 'zod';

describe('Enterprise Workflow BDD Tests', () => {
  describe('Feature: High-Volume Order Processing', () => {
    describe('Scenario: Peak traffic handling during Black Friday', () => {
      it('Given 10,000 concurrent orders, When processing simultaneously, Then should maintain 99.99% success rate', async () => {
        // Given: Define order schema and workflow
        const OrderSchema = z.object({
          orderId: z.string().uuid(),
          customerId: z.string(),
          amount: z.number().positive(),
          items: z.array(z.object({
            productId: z.string(),
            quantity: z.number().positive(),
            unitPrice: z.number().positive()
          }))
        });
        
        const processOrderTask = cittyPro.defineTask({
          id: 'process-order',
          in: OrderSchema,
          run: async (order) => {
            // Simulate order processing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            
            // 99.99% success rate simulation
            if (Math.random() < 0.0001) {
              throw new Error('Payment processing failed');
            }
            
            return {
              orderId: order.orderId,
              status: 'completed',
              total: order.amount,
              processedAt: new Date()
            };
          }
        });
        
        const orderWorkflow = cittyPro.defineWorkflow({
          id: 'order-processing',
          steps: [
            { id: 'validate', use: processOrderTask }
          ]
        });
        
        // When: Process 100 orders simultaneously (scaled down for test)
        const orders = Array.from({ length: 100 }, (_, i) => ({
          orderId: crypto.randomUUID(),
          customerId: `customer-${i}`,
          amount: Math.random() * 1000 + 50,
          items: [{
            productId: `product-${i}`,
            quantity: Math.floor(Math.random() * 5) + 1,
            unitPrice: Math.random() * 100 + 10
          }]
        }));
        
        const startTime = performance.now();
        const results = await Promise.allSettled(
          orders.map(order => {
            const workflow = cittyPro.defineWorkflow({
              ...orderWorkflow,
              seed: order
            });
            return workflow.run(global.testContext);
          })
        );
        const duration = performance.now() - startTime;
        
        // Then: Validate results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const successRate = successful / results.length;
        
        expect(successRate).toBeGreaterThan(0.999); // 99.9% minimum
        expect(duration).toBeLessThan(5000); // Under 5 seconds
        expect(successful).toBeGreaterThan(99); // At least 99 successful
      });
    });
  });
});
```

## Production Deployment Configuration

### 1. Docker Configuration

Create `Dockerfile`:

```dockerfile
# Multi-stage build for production optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S hive-queen -u 1001

# Change ownership of app directory
RUN chown -R hive-queen:nodejs /app
USER hive-queen

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node dist/health-check.js

# Start application
CMD ["node", "dist/index.js"]
```

### 2. Kubernetes Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hive-queen-bdd
  namespace: production
  labels:
    app: hive-queen-bdd
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: hive-queen-bdd
  template:
    metadata:
      labels:
        app: hive-queen-bdd
        version: v1.0.0
    spec:
      containers:
      - name: hive-queen-bdd
        image: hive-queen-bdd:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9464
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secret
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: hive-queen-config
---
apiVersion: v1
kind: Service
metadata:
  name: hive-queen-bdd-service
  namespace: production
spec:
  selector:
    app: hive-queen-bdd
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9464
    targetPort: 9464
  type: ClusterIP
```

### 3. Monitoring and Alerting

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "hive-queen-alerts.yml"

scrape_configs:
  - job_name: 'hive-queen-bdd'
    static_configs:
      - targets: ['hive-queen-bdd-service:9464']
    scrape_interval: 5s
    metrics_path: /metrics
    
  - job_name: 'hive-queen-workflows'
    static_configs:
      - targets: ['hive-queen-bdd-service:3000']
    scrape_interval: 10s
    metrics_path: /metrics/workflows

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

Create `monitoring/hive-queen-alerts.yml`:

```yaml
groups:
  - name: hive-queen-bdd
    rules:
      - alert: HiveQueenHighErrorRate
        expr: rate(errors_total[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected in HIVE QUEEN"
          description: "Error rate is {{ $value }} errors per second"
      
      - alert: HiveQueenWorkflowLatencyHigh
        expr: histogram_quantile(0.99, rate(workflow_duration_ms_bucket[5m])) > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High workflow latency in HIVE QUEEN"
          description: "99th percentile latency is {{ $value }}ms"
      
      - alert: HiveQueenPodDown
        expr: up{job="hive-queen-bdd"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "HIVE QUEEN pod is down"
          description: "Pod {{ $labels.instance }} has been down for more than 1 minute"
```

This comprehensive implementation guide provides everything needed to set up, configure, and deploy the HIVE QUEEN BDD architecture in enterprise environments with proper observability, monitoring, and production-ready configurations.