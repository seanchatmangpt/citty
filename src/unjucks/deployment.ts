/**
 * Production Deployment Configuration
 * 20/80 Dark Matter - Enterprise Features
 */

import { defineConfig } from 'citty';
import { resolve } from 'pathe';
import { readFile, writeFile } from 'node:fs/promises';
import { $fetch } from 'ofetch';
import { hash } from 'ohash';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  features: {
    caching: boolean;
    parallel: boolean;
    telemetry: boolean;
    errorRecovery: boolean;
    hotReload: boolean;
  };
  performance: {
    maxConcurrency: number;
    cacheSize: number;
    timeout: number;
    memoryLimit: number;
  };
  security: {
    validateOntologies: boolean;
    sanitizeOutput: boolean;
    maxFileSize: number;
    allowedDomains: string[];
  };
  monitoring: {
    endpoint?: string;
    apiKey?: string;
    sampleRate: number;
    errorReporting: boolean;
  };
}

/**
 * Production deployment configurations
 */
export const deploymentConfigs: Record<string, DeploymentConfig> = {
  development: {
    environment: 'development',
    features: {
      caching: false,
      parallel: false,
      telemetry: true,
      errorRecovery: false,
      hotReload: true
    },
    performance: {
      maxConcurrency: 2,
      cacheSize: 100,
      timeout: 30000,
      memoryLimit: 512 * 1024 * 1024
    },
    security: {
      validateOntologies: false,
      sanitizeOutput: false,
      maxFileSize: 10 * 1024 * 1024,
      allowedDomains: ['*']
    },
    monitoring: {
      sampleRate: 1.0,
      errorReporting: true
    }
  },
  
  staging: {
    environment: 'staging',
    features: {
      caching: true,
      parallel: true,
      telemetry: true,
      errorRecovery: true,
      hotReload: false
    },
    performance: {
      maxConcurrency: 4,
      cacheSize: 1000,
      timeout: 60000,
      memoryLimit: 1024 * 1024 * 1024
    },
    security: {
      validateOntologies: true,
      sanitizeOutput: true,
      maxFileSize: 50 * 1024 * 1024,
      allowedDomains: ['*.staging.citty.pro']
    },
    monitoring: {
      endpoint: process.env.TELEMETRY_ENDPOINT,
      apiKey: process.env.TELEMETRY_API_KEY,
      sampleRate: 0.5,
      errorReporting: true
    }
  },
  
  production: {
    environment: 'production',
    features: {
      caching: true,
      parallel: true,
      telemetry: true,
      errorRecovery: true,
      hotReload: false
    },
    performance: {
      maxConcurrency: 8,
      cacheSize: 10000,
      timeout: 120000,
      memoryLimit: 2048 * 1024 * 1024
    },
    security: {
      validateOntologies: true,
      sanitizeOutput: true,
      maxFileSize: 100 * 1024 * 1024,
      allowedDomains: ['*.citty.pro', '*.unjs.io']
    },
    monitoring: {
      endpoint: process.env.TELEMETRY_ENDPOINT,
      apiKey: process.env.TELEMETRY_API_KEY,
      sampleRate: 0.1,
      errorReporting: true
    }
  }
};

/**
 * Health check system
 */
export class HealthChecker {
  private config: DeploymentConfig;
  private lastCheck: Date = new Date();
  private status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async check(): Promise<{
    status: string;
    timestamp: Date;
    checks: Record<string, boolean>;
    metrics: any;
  }> {
    const checks: Record<string, boolean> = {};
    
    // Memory check
    const memUsage = process.memoryUsage();
    checks.memory = memUsage.heapUsed < this.config.performance.memoryLimit;
    
    // Template availability
    try {
      const { listGenerators } = await import('./index');
      const generators = listGenerators();
      checks.templates = generators.length > 0;
    } catch {
      checks.templates = false;
    }
    
    // Ontology service
    try {
      const { createOntology, findEntities } = await import('../untology');
      await createOntology();
      checks.ontology = true;
    } catch {
      checks.ontology = false;
    }
    
    // Monitoring endpoint (if configured)
    if (this.config.monitoring.endpoint) {
      try {
        await $fetch(this.config.monitoring.endpoint, { 
          timeout: 5000,
          method: 'HEAD'
        });
        checks.monitoring = true;
      } catch {
        checks.monitoring = false;
      }
    }
    
    // Determine overall status
    const failedChecks = Object.values(checks).filter(v => !v).length;
    if (failedChecks === 0) {
      this.status = 'healthy';
    } else if (failedChecks <= 1) {
      this.status = 'degraded';
    } else {
      this.status = 'unhealthy';
    }
    
    this.lastCheck = new Date();
    
    return {
      status: this.status,
      timestamp: this.lastCheck,
      checks,
      metrics: {
        memory: memUsage,
        uptime: process.uptime(),
        pid: process.pid
      }
    };
  }

  async startMonitoring(intervalMs = 60000): Promise<void> {
    setInterval(async () => {
      const health = await this.check();
      
      if (health.status === 'unhealthy' && this.config.monitoring.errorReporting) {
        console.error('[HEALTH] System unhealthy:', health);
        
        // Report to monitoring endpoint if configured
        if (this.config.monitoring.endpoint) {
          try {
            await $fetch(this.config.monitoring.endpoint, {
              method: 'POST',
              body: health,
              headers: {
                'Authorization': `Bearer ${this.config.monitoring.apiKey}`
              }
            });
          } catch {
            // Monitoring endpoint itself might be down
          }
        }
      }
    }, intervalMs);
  }
}

/**
 * Error recovery system
 */
export class ErrorRecovery {
  private retryAttempts = new Map<string, number>();
  private circuitBreaker = new Map<string, { failures: number; lastFailure: Date }>();
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async withRecovery<T>(
    operation: () => Promise<T>,
    options: {
      operationId: string;
      maxRetries?: number;
      backoffMs?: number;
      fallback?: () => T;
    }
  ): Promise<T> {
    const { operationId, maxRetries = 3, backoffMs = 1000, fallback } = options;
    
    // Check circuit breaker
    const breaker = this.circuitBreaker.get(operationId);
    if (breaker && breaker.failures >= 5) {
      const timeSinceFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceFailure < 60000) { // 1 minute cooldown
        if (fallback) return fallback();
        throw new Error(`Circuit breaker open for ${operationId}`);
      }
      // Reset after cooldown
      this.circuitBreaker.delete(operationId);
    }
    
    const attempts = this.retryAttempts.get(operationId) || 0;
    
    try {
      const result = await operation();
      
      // Success - reset counters
      this.retryAttempts.delete(operationId);
      this.circuitBreaker.delete(operationId);
      
      return result;
    } catch (error) {
      // Record failure
      const breaker = this.circuitBreaker.get(operationId) || { failures: 0, lastFailure: new Date() };
      breaker.failures++;
      breaker.lastFailure = new Date();
      this.circuitBreaker.set(operationId, breaker);
      
      if (attempts < maxRetries) {
        // Exponential backoff
        const delay = backoffMs * Math.pow(2, attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.retryAttempts.set(operationId, attempts + 1);
        return this.withRecovery(operation, options);
      }
      
      // Max retries exceeded
      this.retryAttempts.delete(operationId);
      
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }
}

/**
 * Get deployment configuration
 */
export function getDeploymentConfig(): DeploymentConfig {
  const env = process.env.NODE_ENV || 'development';
  return deploymentConfigs[env] || deploymentConfigs.development;
}

/**
 * Initialize production features
 */
export async function initializeProduction(): Promise<void> {
  const config = getDeploymentConfig();
  
  // Set up health monitoring
  if (config.monitoring.errorReporting) {
    const healthChecker = new HealthChecker(config);
    await healthChecker.startMonitoring();
  }
  
  // Configure error recovery
  if (config.features.errorRecovery) {
    const recovery = new ErrorRecovery(config);
    
    // Patch global error handler
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('[ERROR RECOVERY] Unhandled rejection:', reason);
      
      // Attempt recovery
      await recovery.withRecovery(
        async () => {
          // Log to monitoring
          if (config.monitoring.endpoint) {
            await $fetch(config.monitoring.endpoint, {
              method: 'POST',
              body: { type: 'unhandledRejection', reason: String(reason) }
            });
          }
        },
        { operationId: 'error-reporting' }
      );
    });
  }
  
  // Set memory limits
  if (config.performance.memoryLimit) {
    // Note: Memory limit should be set via Node.js --max-old-space-size flag
    // v8.setHeapLimit does not exist - this would need process.env or command-line args
    console.warn(`Memory limit ${config.performance.memoryLimit}MB should be set via --max-old-space-size flag`);
  }
}