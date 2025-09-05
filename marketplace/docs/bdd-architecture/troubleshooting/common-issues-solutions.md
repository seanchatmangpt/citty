# HIVE QUEEN BDD Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide covers common issues, diagnostic procedures, and solutions for the HIVE QUEEN BDD architecture in enterprise environments.

## Quick Diagnostic Checklist

### System Health Check
```bash
# Check system status
curl -f http://localhost:3000/health || echo "❌ Health check failed"

# Check metrics endpoint
curl -f http://localhost:9464/metrics || echo "❌ Metrics unavailable"

# Check database connectivity
node -e "require('./dist/utils/db-check.js')" || echo "❌ Database unreachable"

# Check memory usage
free -h | grep Mem

# Check disk space
df -h | grep -E '/$|/var|/tmp'
```

### Performance Baseline Check
```typescript
// System performance diagnostic
class SystemDiagnostics {
  async runDiagnostics(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: new Date(),
      system: await this.getSystemInfo(),
      performance: await this.getPerformanceMetrics(),
      workflows: await this.getWorkflowHealth(),
      database: await this.getDatabaseHealth(),
      dependencies: await this.checkDependencies()
    };
    
    // Generate recommendations
    report.recommendations = await this.generateRecommendations(report);
    
    return report;
  }
  
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: await this.getMemoryUsage(),
      diskIO: await this.getDiskIO(),
      networkLatency: await this.getNetworkLatency(),
      gcMetrics: await this.getGCMetrics()
    };
  }
}
```

---

## Common Issues and Solutions

### 1. Performance Issues

#### Issue: Slow Workflow Execution
**Symptoms:**
- Workflow response times > 5 seconds
- High CPU usage during execution
- Memory leaks over time

**Diagnostic Steps:**
```typescript
// Performance profiling workflow
const performanceProfiler = cittyPro.defineTask({
  id: 'performance-diagnostic',
  run: async (workflowId: string) => {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();
    
    // Profile workflow execution
    const workflow = await workflowRegistry.get(workflowId);
    const result = await workflow.run(context);
    
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    return {
      executionTime: endTime - startTime,
      memoryDelta: {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
      },
      result
    };
  }
});
```

**Solutions:**

1. **Enable Task Parallelization:**
```typescript
// Convert sequential to parallel execution
const optimizedWorkflow = cittyPro.defineWorkflow({
  id: 'optimized-workflow',
  steps: [
    {
      id: 'parallel-tasks',
      use: cittyPro.defineTask({
        id: 'parallel-execution',
        run: async (input) => {
          // Execute independent tasks in parallel
          const results = await Promise.all([
            task1.call(input.data1, context),
            task2.call(input.data2, context),
            task3.call(input.data3, context)
          ]);
          
          return { parallelResults: results };
        }
      })
    }
  ]
});
```

2. **Implement Caching:**
```typescript
// Add caching layer
const cachedTask = cittyPro.defineTask({
  id: 'cached-expensive-operation',
  run: async (input, ctx) => {
    const cacheKey = `expensive-op:${JSON.stringify(input)}`;
    
    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }
    
    // Perform expensive operation
    const result = await expensiveOperation(input);
    
    // Cache result with TTL
    await cache.set(cacheKey, result, { ttl: 300000 }); // 5 minutes
    
    return result;
  }
});
```

3. **Optimize Memory Usage:**
```typescript
// Memory-efficient task implementation
const memoryOptimizedTask = cittyPro.defineTask({
  id: 'memory-optimized',
  run: async (largeDataset: any[], ctx) => {
    // Process in chunks to avoid memory spikes
    const chunkSize = 1000;
    const results = [];
    
    for (let i = 0; i < largeDataset.length; i += chunkSize) {
      const chunk = largeDataset.slice(i, i + chunkSize);
      const chunkResult = await processChunk(chunk);
      results.push(chunkResult);
      
      // Allow garbage collection between chunks
      if (global.gc) {
        global.gc();
      }
    }
    
    return { processedResults: results };
  }
});
```

#### Issue: Memory Leaks
**Symptoms:**
- Gradually increasing memory usage
- Out of memory errors
- Slow garbage collection

**Diagnostic Steps:**
```bash
# Monitor memory usage over time
node --inspect --max-old-space-size=8192 dist/index.js &
PID=$!

# Track memory usage
while kill -0 $PID 2>/dev/null; do
  ps -p $PID -o pid,ppid,pcpu,pmem,rss,time,comm
  sleep 30
done
```

**Solutions:**

1. **Implement Proper Cleanup:**
```typescript
// Proper resource cleanup
class ResourceManager {
  private resources = new Set<Disposable>();
  
  register<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }
  
  async cleanup() {
    for (const resource of this.resources) {
      try {
        await resource.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    }
    this.resources.clear();
  }
}

// Use in workflows
const workflowWithCleanup = cittyPro.defineWorkflow({
  id: 'cleanup-workflow',
  steps: [
    {
      id: 'main-processing',
      use: cittyPro.defineTask({
        id: 'process-with-cleanup',
        run: async (input, ctx) => {
          const resourceManager = new ResourceManager();
          
          try {
            const connection = resourceManager.register(
              await database.connect()
            );
            const fileHandle = resourceManager.register(
              await fs.promises.open(input.filename, 'r')
            );
            
            return await processData(connection, fileHandle);
          } finally {
            await resourceManager.cleanup();
          }
        }
      })
    }
  ]
});
```

2. **Optimize Event Listeners:**
```typescript
// Prevent event listener memory leaks
class EventManager {
  private listeners = new Map<string, Array<{ target: EventTarget, listener: Function }>>();
  
  addEventListener(target: EventTarget, event: string, listener: Function) {
    target.addEventListener(event, listener);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ target, listener });
  }
  
  removeAllListeners() {
    for (const [event, listeners] of this.listeners) {
      for (const { target, listener } of listeners) {
        target.removeEventListener(event, listener);
      }
    }
    this.listeners.clear();
  }
}
```

### 2. Validation and Schema Issues

#### Issue: Schema Validation Failures
**Symptoms:**
- Unexpected validation errors
- Type mismatches
- Schema evolution problems

**Diagnostic Steps:**
```typescript
// Schema validation debugger
const debugValidation = (schema: z.ZodSchema, data: any) => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.log('Validation failed for data:', JSON.stringify(data, null, 2));
    console.log('Errors:', result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: 'received' in err ? err.received : undefined
    })));
  }
  
  return result;
};
```

**Solutions:**

1. **Schema Versioning:**
```typescript
// Versioned schema with backward compatibility
const UserSchemaV1 = z.object({
  name: z.string(),
  email: z.string().email()
});

const UserSchemaV2 = UserSchemaV1.extend({
  phoneNumber: z.string().optional(),
  department: z.string().optional()
});

const UserSchemaV3 = UserSchemaV2.extend({
  preferences: z.object({
    notifications: z.boolean().default(true),
    theme: z.enum(['light', 'dark']).default('light')
  }).optional()
});

// Version-aware validation
class VersionedValidator {
  private schemas = new Map([
    ['1.0', UserSchemaV1],
    ['2.0', UserSchemaV2],
    ['3.0', UserSchemaV3]
  ]);
  
  validate(data: any, version: string = '3.0') {
    const schema = this.schemas.get(version);
    if (!schema) {
      throw new Error(`Unknown schema version: ${version}`);
    }
    
    return schema.parse(data);
  }
  
  migrate(data: any, fromVersion: string, toVersion: string) {
    // Implement migration logic
    const migrations = {
      '1.0->2.0': (data: any) => ({ ...data, phoneNumber: undefined, department: undefined }),
      '2.0->3.0': (data: any) => ({ ...data, preferences: { notifications: true, theme: 'light' } })
    };
    
    const migrationKey = `${fromVersion}->${toVersion}`;
    const migration = migrations[migrationKey];
    
    if (migration) {
      return migration(data);
    }
    
    return data;
  }
}
```

2. **Schema Transformation:**
```typescript
// Data transformation before validation
const transformAndValidate = <T>(
  schema: z.ZodSchema<T>,
  data: any,
  transformers: Array<(data: any) => any> = []
): T => {
  // Apply transformations
  let transformed = data;
  for (const transformer of transformers) {
    transformed = transformer(transformed);
  }
  
  // Validate transformed data
  return schema.parse(transformed);
};

// Common transformers
const commonTransformers = {
  trimStrings: (data: any) => {
    if (typeof data === 'string') return data.trim();
    if (typeof data === 'object' && data !== null) {
      const result = Array.isArray(data) ? [] : {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = commonTransformers.trimStrings(value);
      }
      return result;
    }
    return data;
  },
  
  normalizeEmails: (data: any) => {
    if (data.email && typeof data.email === 'string') {
      data.email = data.email.toLowerCase().trim();
    }
    return data;
  },
  
  convertDates: (data: any) => {
    const dateFields = ['dateOfBirth', 'startDate', 'endDate', 'createdAt', 'updatedAt'];
    for (const field of dateFields) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = new Date(data[field]);
      }
    }
    return data;
  }
};
```

### 3. Workflow Execution Issues

#### Issue: Workflow State Corruption
**Symptoms:**
- Inconsistent workflow state
- Steps executing out of order
- Lost state between steps

**Diagnostic Steps:**
```typescript
// Workflow state debugger
const stateDebugger = {
  logStateTransition: (workflowId: string, stepId: string, beforeState: any, afterState: any) => {
    console.log(`[${workflowId}] State transition at step ${stepId}:`);
    console.log('Before:', JSON.stringify(beforeState, null, 2));
    console.log('After:', JSON.stringify(afterState, null, 2));
    
    // Detect problematic changes
    const beforeKeys = Object.keys(beforeState);
    const afterKeys = Object.keys(afterState);
    
    const removedKeys = beforeKeys.filter(key => !afterKeys.includes(key));
    const addedKeys = afterKeys.filter(key => !beforeKeys.includes(key));
    
    if (removedKeys.length > 0) {
      console.warn('Removed keys:', removedKeys);
    }
    if (addedKeys.length > 0) {
      console.log('Added keys:', addedKeys);
    }
  }
};

// Enhanced workflow with state debugging
const debugWorkflow = cittyPro.defineWorkflow({
  id: 'debug-workflow',
  steps: [
    {
      id: 'step1',
      use: cittyPro.defineTask({
        id: 'debug-task',
        run: async (input, ctx) => {
          const beforeState = ctx.getWorkflowState();
          
          // Your task logic here
          const result = await yourTaskLogic(input);
          
          const afterState = { ...beforeState, [ctx.currentStep]: result };
          stateDebugger.logStateTransition(ctx.workflowId, ctx.currentStep, beforeState, afterState);
          
          return result;
        }
      })
    }
  ]
});
```

**Solutions:**

1. **State Validation:**
```typescript
// State schema validation
const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  currentStep: z.string(),
  stepResults: z.record(z.any()),
  metadata: z.object({
    startTime: z.number(),
    lastUpdateTime: z.number(),
    executionCount: z.number()
  })
});

const stateValidatedWorkflow = cittyPro.defineWorkflow({
  id: 'state-validated-workflow',
  steps: [
    {
      id: 'validate-state',
      use: cittyPro.defineTask({
        id: 'state-validator',
        run: async (input, ctx) => {
          // Validate current state
          const currentState = ctx.getWorkflowState();
          const validationResult = WorkflowStateSchema.safeParse(currentState);
          
          if (!validationResult.success) {
            throw new WorkflowStateCorruptionError(
              'Workflow state validation failed',
              validationResult.error.errors
            );
          }
          
          return { stateValid: true, state: currentState };
        }
      })
    }
  ]
});
```

2. **State Recovery:**
```typescript
// Automatic state recovery
class WorkflowStateRecovery {
  async recoverCorruptedWorkflow(workflowId: string): Promise<RecoveryResult> {
    try {
      // Get last known good state
      const lastGoodState = await this.getLastKnownGoodState(workflowId);
      
      // Analyze corruption
      const corruption = await this.analyzeCorruption(workflowId);
      
      // Attempt recovery
      if (corruption.recoverable) {
        const recoveredState = await this.performRecovery(lastGoodState, corruption);
        await this.saveRecoveredState(workflowId, recoveredState);
        
        return {
          success: true,
          recoveredState,
          message: 'Workflow state successfully recovered'
        };
      } else {
        return {
          success: false,
          message: 'Workflow state not recoverable, manual intervention required',
          corruption
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error.message}`,
        error
      };
    }
  }
}
```

### 4. Database and Persistence Issues

#### Issue: Database Connection Failures
**Symptoms:**
- Connection timeouts
- Pool exhaustion
- Deadlocks

**Diagnostic Steps:**
```typescript
// Database health monitor
class DatabaseHealthMonitor {
  async checkHealth(): Promise<DatabaseHealth> {
    const checks = await Promise.allSettled([
      this.checkConnectivity(),
      this.checkQueryPerformance(),
      this.checkConnectionPool(),
      this.checkLockStatus(),
      this.checkStorageSpace()
    ]);
    
    return {
      connectivity: checks[0].status === 'fulfilled' ? checks[0].value : checks[0].reason,
      performance: checks[1].status === 'fulfilled' ? checks[1].value : checks[1].reason,
      pool: checks[2].status === 'fulfilled' ? checks[2].value : checks[2].reason,
      locks: checks[3].status === 'fulfilled' ? checks[3].value : checks[3].reason,
      storage: checks[4].status === 'fulfilled' ? checks[4].value : checks[4].reason
    };
  }
  
  private async checkConnectivity(): Promise<ConnectivityCheck> {
    const start = Date.now();
    try {
      await db.raw('SELECT 1');
      return {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        latency: Date.now() - start
      };
    }
  }
}
```

**Solutions:**

1. **Connection Pool Optimization:**
```typescript
// Optimized database configuration
const dbConfig = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true'
  },
  pool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 300000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 2000
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

// Connection retry logic
class DatabaseConnection {
  private retryConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 10000,
    factor: 2
  };
  
  async connectWithRetry(): Promise<Database> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const db = knex(dbConfig);
        await db.raw('SELECT 1'); // Test connection
        return db;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.factor, attempt - 1),
            this.retryConfig.maxDelay
          );
          
          console.warn(`Database connection attempt ${attempt} failed, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Database connection failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }
}
```

2. **Transaction Management:**
```typescript
// Robust transaction handling
class TransactionManager {
  async executeWithTransaction<T>(
    operation: (trx: Transaction) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const { timeout = 30000, isolationLevel = 'READ COMMITTED' } = options;
    
    const trx = await db.transaction({ isolationLevel });
    const timeoutHandle = setTimeout(() => {
      trx.rollback(new Error('Transaction timeout'));
    }, timeout);
    
    try {
      const result = await operation(trx);
      await trx.commit();
      clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      await trx.rollback();
      clearTimeout(timeoutHandle);
      
      // Retry logic for specific errors
      if (this.isRetryableError(error)) {
        await this.delay(1000);
        return this.executeWithTransaction(operation, options);
      }
      
      throw error;
    }
  }
  
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '53200', // out_of_memory
      '53300'  // too_many_connections
    ];
    
    return retryableCodes.includes(error.code);
  }
}
```

### 5. AI Integration Issues

#### Issue: AI Tool Execution Failures
**Symptoms:**
- Tool calls not executing
- Timeout errors
- Invalid tool responses

**Diagnostic Steps:**
```typescript
// AI tool diagnostics
class AIToolDiagnostics {
  async diagnoseToolExecution(toolName: string, args: any): Promise<DiagnosticResult> {
    const diagnostic: DiagnosticResult = {
      toolName,
      timestamp: new Date(),
      checks: {}
    };
    
    // Check tool registration
    diagnostic.checks.registration = await this.checkToolRegistration(toolName);
    
    // Validate arguments
    diagnostic.checks.argumentValidation = await this.validateToolArguments(toolName, args);
    
    // Test tool execution
    diagnostic.checks.execution = await this.testToolExecution(toolName, args);
    
    // Check permissions
    diagnostic.checks.permissions = await this.checkToolPermissions(toolName);
    
    return diagnostic;
  }
  
  private async testToolExecution(toolName: string, args: any): Promise<ExecutionCheck> {
    try {
      const tool = await toolRegistry.get(toolName);
      const result = await Promise.race([
        tool.execute(args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), 30000)
        )
      ]);
      
      return {
        status: 'success',
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }
}
```

**Solutions:**

1. **Tool Validation and Recovery:**
```typescript
// Robust AI tool wrapper
const createRobustAITool = (toolConfig: ToolConfig) => {
  return {
    ...toolConfig,
    execute: async (args: any) => {
      const validator = new ToolValidator(toolConfig.schema);
      const recovery = new ToolRecovery();
      
      try {
        // Validate arguments
        const validatedArgs = validator.validate(args);
        
        // Execute with timeout
        const result = await Promise.race([
          toolConfig.execute(validatedArgs),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool timeout')), 30000)
          )
        ]);
        
        // Validate result
        return validator.validateResult(result);
        
      } catch (error) {
        // Attempt recovery
        const recoveryAttempt = await recovery.attemptRecovery(toolConfig, args, error);
        if (recoveryAttempt.success) {
          return recoveryAttempt.result;
        }
        
        // Log failure for analysis
        await errorLogger.logToolFailure(toolConfig.name, args, error);
        throw error;
      }
    }
  };
};
```

2. **AI Model Fallback:**
```typescript
// Multi-model fallback system
class AIModelFallback {
  private models = [
    { id: 'gpt-4', priority: 1, timeout: 30000 },
    { id: 'claude-3', priority: 2, timeout: 45000 },
    { id: 'llama-2', priority: 3, timeout: 60000 }
  ];
  
  async executeWithFallback(prompt: string, tools: any[]): Promise<AIResponse> {
    const sortedModels = [...this.models].sort((a, b) => a.priority - b.priority);
    
    for (const model of sortedModels) {
      try {
        const response = await this.executeWithModel(model, prompt, tools);
        return { ...response, modelUsed: model.id };
      } catch (error) {
        console.warn(`Model ${model.id} failed: ${error.message}`);
        
        // Log failure for monitoring
        await modelHealthMonitor.recordFailure(model.id, error);
        
        // Continue to next model
        continue;
      }
    }
    
    throw new Error('All AI models failed');
  }
}
```

---

## Monitoring and Alerting

### Real-time Issue Detection

```typescript
// Comprehensive monitoring system
class HiveQueenMonitor {
  private alerts = new AlertManager();
  private metrics = new MetricsCollector();
  
  async startMonitoring(): Promise<void> {
    // Performance monitoring
    setInterval(async () => {
      const perfMetrics = await this.collectPerformanceMetrics();
      await this.evaluatePerformanceAlerts(perfMetrics);
    }, 30000); // Every 30 seconds
    
    // Error rate monitoring
    setInterval(async () => {
      const errorRate = await this.calculateErrorRate();
      if (errorRate > 0.01) { // 1% error rate threshold
        await this.alerts.triggerAlert('HIGH_ERROR_RATE', { rate: errorRate });
      }
    }, 60000); // Every minute
    
    // Resource monitoring
    setInterval(async () => {
      const resources = await this.getResourceUtilization();
      await this.evaluateResourceAlerts(resources);
    }, 120000); // Every 2 minutes
  }
  
  private async evaluatePerformanceAlerts(metrics: PerformanceMetrics): Promise<void> {
    // Response time alerts
    if (metrics.avgResponseTime > 5000) {
      await this.alerts.triggerAlert('SLOW_RESPONSE', {
        avgTime: metrics.avgResponseTime,
        threshold: 5000
      });
    }
    
    // Throughput alerts
    if (metrics.requestsPerSecond < 100) {
      await this.alerts.triggerAlert('LOW_THROUGHPUT', {
        current: metrics.requestsPerSecond,
        expected: 100
      });
    }
  }
}
```

### Automated Recovery Procedures

```typescript
// Self-healing system
class SelfHealingSystem {
  private recoveryStrategies = new Map<string, RecoveryStrategy>();
  
  constructor() {
    this.registerRecoveryStrategies();
  }
  
  async handleIssue(issue: SystemIssue): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(issue.type);
    if (!strategy) {
      return { success: false, message: 'No recovery strategy available' };
    }
    
    try {
      const result = await strategy.execute(issue);
      await this.logRecoveryAttempt(issue, result);
      return result;
    } catch (error) {
      await this.escalateIssue(issue, error);
      return { success: false, message: error.message };
    }
  }
  
  private registerRecoveryStrategies(): void {
    // Memory leak recovery
    this.recoveryStrategies.set('MEMORY_LEAK', {
      execute: async (issue) => {
        if (global.gc) {
          global.gc();
        }
        
        // Clear caches
        await cacheManager.clearAll();
        
        // Restart problematic workers
        await workerManager.restartWorkers();
        
        return { success: true, message: 'Memory cleanup completed' };
      }
    });
    
    // Database connection recovery
    this.recoveryStrategies.set('DB_CONNECTION_FAILURE', {
      execute: async (issue) => {
        // Reset connection pool
        await db.destroy();
        await db.initialize();
        
        // Verify connectivity
        await db.raw('SELECT 1');
        
        return { success: true, message: 'Database connection restored' };
      }
    });
    
    // High CPU usage recovery
    this.recoveryStrategies.set('HIGH_CPU_USAGE', {
      execute: async (issue) => {
        // Throttle request processing
        await rateLimiter.enableThrottling();
        
        // Scale down non-critical operations
        await workflowScheduler.pauseNonCriticalWorkflows();
        
        return { success: true, message: 'CPU usage throttling enabled' };
      }
    });
  }
}
```

## Support and Escalation

### Issue Classification Matrix

| Issue Type | Severity | Response Time | Escalation Path |
|------------|----------|---------------|-----------------|
| System Down | Critical | 5 minutes | On-call → Manager → Director |
| Performance Degraded | High | 30 minutes | Team Lead → Manager |
| Workflow Failures | Medium | 2 hours | Developer → Team Lead |
| Schema Issues | Low | 4 hours | Developer |

### Contact Information

- **Critical Issues**: #hive-queen-critical (Slack)
- **General Support**: hive-queen-support@enterprise.com
- **Documentation**: https://docs.hive-queen.enterprise.com
- **GitHub Issues**: https://github.com/enterprise/hive-queen/issues

This comprehensive troubleshooting guide enables enterprise teams to quickly identify, diagnose, and resolve issues in the HIVE QUEEN BDD architecture, ensuring maximum uptime and performance in production environments.