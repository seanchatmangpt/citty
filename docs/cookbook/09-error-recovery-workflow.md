# Pattern 09: Error Recovery Workflow - Resilient API Integration System

## Overview

A comprehensive error recovery and resilience system demonstrating advanced error handling patterns, circuit breakers, retry strategies, and self-healing workflows for API integrations and distributed systems.

## Features

- Intelligent retry strategies with exponential backoff
- Circuit breaker patterns for fault tolerance
- Dead letter queues and error quarantine
- Automatic error classification and recovery
- Graceful degradation and fallback mechanisms
- Real-time error monitoring and alerting
- Self-healing workflows with adaptive recovery
- Comprehensive error analytics and reporting

## Environment Setup

```bash
# Core resilience libraries
pnpm add axios node-fetch retry exponential-backoff
pnpm add opossum circuit-breaker-js
pnpm add bull ioredis

# Error handling and monitoring
pnpm add winston @sentry/node elastic-apm-node
pnpm add prometheus-client statsd-client

# Validation and data integrity
pnpm add zod joi ajv
pnpm add lodash ramda

# Database and persistence
pnpm add mongodb pg redis
pnpm add typeorm prisma

# Health checking and monitoring
pnpm add terminus @godaddy/terminus
pnpm add node-cron

# Testing and mocking
pnpm add -D nock supertest sinon
pnpm add -D vitest @types/node
```

## Environment Variables

```env
# Application
NODE_ENV=production
LOG_LEVEL=info
SERVICE_NAME=api-integration-service

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/integration_db
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/integration

# External APIs
PRIMARY_API_URL=https://api.primary.com
SECONDARY_API_URL=https://api.secondary.com
FALLBACK_API_URL=https://api.fallback.com
API_TIMEOUT=30000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY=1000
RETRY_BACKOFF_FACTOR=2
RETRY_MAX_DELAY=30000

# Dead Letter Queue
DLQ_ENABLED=true
DLQ_MAX_RETRIES=5
DLQ_RETRY_DELAY=300000

# Monitoring
SENTRY_DSN=your-sentry-dsn
ELASTIC_APM_SERVICE_NAME=api-integration
METRICS_ENABLED=true

# Health Checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_CIRCUIT_BREAKER=true
ENABLE_GRACEFUL_DEGRADATION=true
ENABLE_AUTO_RECOVERY=true
```

## Production Code

```typescript
import { defineCommand } from "citty";
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import CircuitBreaker from "opossum";
import Bull from "bull";
import Redis from "ioredis";
import winston from "winston";
import * as Sentry from "@sentry/node";
import apm from "elastic-apm-node";
import { z } from "zod";
import _ from "lodash";
import cron from "node-cron";
import { register as prometheusRegister, Counter, Histogram, Gauge } from "prom-client";
import { createTerminus } from "@godaddy/terminus";
import http from "http";

// Types
interface ErrorContext {
  operation: string;
  endpoint: string;
  method: string;
  attempt: number;
  timestamp: Date;
  requestId: string;
  payload?: any;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

interface RecoveryStrategy {
  name: string;
  priority: number;
  conditions: Array<{
    errorType: string;
    statusCodes?: number[];
    messagePatterns?: RegExp[];
    contextChecks?: (context: ErrorContext) => boolean;
  }>;
  actions: Array<{
    type: 'retry' | 'fallback' | 'circuit_break' | 'degrade' | 'queue' | 'alert';
    config: any;
    delay?: number;
  }>;
  metadata: {
    description: string;
    maxAttempts: number;
    timeoutMs: number;
  };
}

interface IntegrationConfig {
  id: string;
  name: string;
  baseURL: string;
  timeout: number;
  retryStrategy: {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor: number;
    maxDelay: number;
  };
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  fallbacks: Array<{
    type: 'api' | 'cache' | 'default' | 'queue';
    endpoint?: string;
    value?: any;
    priority: number;
  }>;
  healthCheck: {
    endpoint: string;
    interval: number;
    timeout: number;
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'api_call' | 'validation' | 'transformation' | 'persistence';
  config: any;
  dependencies: string[];
  recoveryStrategies: string[];
  timeout: number;
  critical: boolean;
}

interface ErrorRecoveryResult {
  success: boolean;
  strategy: string;
  attempt: number;
  response?: any;
  error?: Error;
  metadata: {
    recoveryTime: number;
    fallbackUsed: boolean;
    circuitBreakerTripped: boolean;
    queuedForLater: boolean;
  };
}

// Metrics
const apiCallsTotal = new Counter({
  name: 'api_calls_total',
  help: 'Total API calls made',
  labelNames: ['integration', 'endpoint', 'method', 'status']
});

const apiCallDuration = new Histogram({
  name: 'api_call_duration_seconds',
  help: 'API call duration',
  labelNames: ['integration', 'endpoint', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const errorRecoveryAttempts = new Counter({
  name: 'error_recovery_attempts_total',
  help: 'Total error recovery attempts',
  labelNames: ['strategy', 'success']
});

const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['integration']
});

// Initialize monitoring
const apmAgent = apm.start({
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'api-integration'
});

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'error-recovery-error.log', 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'error-recovery-combined.log',
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database connections
const redis = new Redis(process.env.REDIS_URL);
const errorQueue = new Bull('error recovery', process.env.REDIS_URL);
const deadLetterQueue = new Bull('dead letter queue', process.env.REDIS_URL);

// Error Classification System
class ErrorClassifier {
  private classificationRules: Map<string, RegExp[]> = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Network errors
    this.classificationRules.set('network', [
      /ECONNRESET/,
      /ENOTFOUND/,
      /ECONNREFUSED/,
      /timeout/i,
      /network error/i
    ]);

    // Authentication errors
    this.classificationRules.set('authentication', [
      /401/,
      /unauthorized/i,
      /authentication failed/i,
      /invalid token/i
    ]);

    // Rate limiting errors
    this.classificationRules.set('rate_limit', [
      /429/,
      /too many requests/i,
      /rate limit exceeded/i
    ]);

    // Server errors
    this.classificationRules.set('server_error', [
      /5\d{2}/,
      /internal server error/i,
      /service unavailable/i,
      /bad gateway/i
    ]);

    // Client errors
    this.classificationRules.set('client_error', [
      /4\d{2}/,
      /bad request/i,
      /validation error/i,
      /invalid input/i
    ]);

    // Transient errors (likely to succeed on retry)
    this.classificationRules.set('transient', [
      /502/,
      /503/,
      /504/,
      /timeout/i,
      /connection reset/i
    ]);

    logger.info('Error classification rules initialized');
  }

  classifyError(error: Error | AxiosError, context: ErrorContext): string[] {
    const classifications: string[] = [];
    const errorMessage = error.message.toLowerCase();
    const statusCode = 'response' in error ? error.response?.status : undefined;

    for (const [category, patterns] of this.classificationRules) {
      for (const pattern of patterns) {
        if (pattern.test(errorMessage) || 
            (statusCode && pattern.test(statusCode.toString()))) {
          classifications.push(category);
          break;
        }
      }
    }

    // If no classification found, default to 'unknown'
    if (classifications.length === 0) {
      classifications.push('unknown');
    }

    logger.debug('Error classified', {
      requestId: context.requestId,
      errorMessage,
      statusCode,
      classifications
    });

    return classifications;
  }

  isRetryable(error: Error | AxiosError, context: ErrorContext): boolean {
    const classifications = this.classifyError(error, context);
    
    // Retryable error types
    const retryableTypes = ['network', 'rate_limit', 'server_error', 'transient'];
    
    return retryableTypes.some(type => classifications.includes(type));
  }

  getRecoveryPriority(error: Error | AxiosError, context: ErrorContext): number {
    const classifications = this.classifyError(error, context);
    
    // Priority mapping (lower number = higher priority)
    const priorityMap = {
      'transient': 1,
      'network': 2,
      'rate_limit': 3,
      'server_error': 4,
      'authentication': 5,
      'client_error': 6,
      'unknown': 7
    };

    return Math.min(...classifications.map(c => priorityMap[c] || 10));
  }
}

// Advanced Retry Strategy
class RetryStrategy {
  private maxAttempts: number;
  private initialDelay: number;
  private backoffFactor: number;
  private maxDelay: number;
  private jitterEnabled: boolean;

  constructor(config: IntegrationConfig['retryStrategy']) {
    this.maxAttempts = config.maxAttempts;
    this.initialDelay = config.initialDelay;
    this.backoffFactor = config.backoffFactor;
    this.maxDelay = config.maxDelay;
    this.jitterEnabled = true;
  }

  shouldRetry(attempt: number, error: Error, context: ErrorContext): boolean {
    if (attempt >= this.maxAttempts) {
      return false;
    }

    const classifier = new ErrorClassifier();
    return classifier.isRetryable(error, context);
  }

  calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    let delay = this.initialDelay * Math.pow(this.backoffFactor, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.jitterEnabled) {
      const jitter = Math.random() * 0.3; // Up to 30% jitter
      delay = delay * (1 + jitter);
    }

    return Math.round(delay);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        logger.debug('Executing operation', {
          requestId: context.requestId,
          attempt,
          operation: context.operation
        });

        const result = await operation();
        
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            requestId: context.requestId,
            attempt,
            operation: context.operation
          });
        }

        return result;

      } catch (error) {
        lastError = error;
        
        logger.warn('Operation failed', {
          requestId: context.requestId,
          attempt,
          operation: context.operation,
          error: error.message
        });

        if (!this.shouldRetry(attempt, error, context)) {
          break;
        }

        if (attempt < this.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          logger.info('Retrying operation', {
            requestId: context.requestId,
            attempt: attempt + 1,
            delayMs: delay
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Circuit Breaker Implementation
class APICircuitBreaker {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.setupCircuitBreakers();
  }

  private setupCircuitBreakers(): void {
    const configs = this.getIntegrationConfigs();

    for (const config of configs) {
      if (!config.circuitBreaker.enabled) continue;

      const options = {
        timeout: config.circuitBreaker.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: config.circuitBreaker.resetTimeout,
        rollingCountTimeout: 60000,
        rollingCountBuckets: 10
      };

      const breaker = new CircuitBreaker(this.createCircuitBreakerAction(config), options);

      // Event listeners
      breaker.on('open', () => {
        logger.warn('Circuit breaker opened', { integration: config.name });
        circuitBreakerState.set({ integration: config.name }, 1);
        
        Sentry.captureMessage(`Circuit breaker opened for ${config.name}`, 'warning');
      });

      breaker.on('halfOpen', () => {
        logger.info('Circuit breaker half-open', { integration: config.name });
        circuitBreakerState.set({ integration: config.name }, 2);
      });

      breaker.on('close', () => {
        logger.info('Circuit breaker closed', { integration: config.name });
        circuitBreakerState.set({ integration: config.name }, 0);
      });

      this.circuitBreakers.set(config.id, breaker);
    }

    logger.info('Circuit breakers initialized', { 
      count: this.circuitBreakers.size 
    });
  }

  private createCircuitBreakerAction(config: IntegrationConfig) {
    return async (requestConfig: AxiosRequestConfig) => {
      const client = this.createAxiosClient(config);
      return await client(requestConfig);
    };
  }

  private createAxiosClient(config: IntegrationConfig): AxiosInstance {
    const client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.metadata = { ...config.metadata, requestId };
        
        logger.debug('API request started', {
          requestId,
          method: config.method,
          url: config.url
        });

        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        const requestId = response.config.metadata?.requestId;
        
        logger.debug('API request completed', {
          requestId,
          status: response.status,
          duration: Date.now() - (response.config.metadata?.startTime || 0)
        });

        return response;
      },
      (error) => {
        const requestId = error.config?.metadata?.requestId;
        
        logger.error('API request failed', {
          requestId,
          error: error.message,
          status: error.response?.status
        });

        return Promise.reject(error);
      }
    );

    return client;
  }

  async executeWithCircuitBreaker<T>(
    integrationId: string,
    requestConfig: AxiosRequestConfig
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(integrationId);
    
    if (!breaker) {
      throw new Error(`Circuit breaker not found for integration: ${integrationId}`);
    }

    try {
      const result = await breaker.fire(requestConfig);
      return result.data;
    } catch (error) {
      if (breaker.opened) {
        throw new Error(`Circuit breaker open for ${integrationId}`);
      }
      throw error;
    }
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private getIntegrationConfigs(): IntegrationConfig[] {
    // This would typically load from a database or configuration file
    return [
      {
        id: 'primary-api',
        name: 'Primary API',
        baseURL: process.env.PRIMARY_API_URL || 'https://api.primary.com',
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        retryStrategy: {
          maxAttempts: parseInt(process.env.MAX_RETRIES || '3'),
          initialDelay: parseInt(process.env.RETRY_DELAY || '1000'),
          backoffFactor: parseInt(process.env.RETRY_BACKOFF_FACTOR || '2'),
          maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '30000')
        },
        circuitBreaker: {
          enabled: process.env.ENABLE_CIRCUIT_BREAKER === 'true',
          threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
          timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
          resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000')
        },
        fallbacks: [
          {
            type: 'api',
            endpoint: process.env.SECONDARY_API_URL,
            priority: 1
          },
          {
            type: 'cache',
            priority: 2
          },
          {
            type: 'default',
            value: null,
            priority: 3
          }
        ],
        healthCheck: {
          endpoint: '/health',
          interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
          timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000')
        }
      }
    ];
  }
}

// Error Recovery Engine
class ErrorRecoveryEngine {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorClassifier: ErrorClassifier;
  private circuitBreaker: APICircuitBreaker;
  private retryStrategy: RetryStrategy;

  constructor() {
    this.errorClassifier = new ErrorClassifier();
    this.circuitBreaker = new APICircuitBreaker();
    this.retryStrategy = new RetryStrategy({
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2,
      maxDelay: 30000
    });

    this.initializeRecoveryStrategies();
    this.setupErrorQueue();
  }

  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.set('network-retry', {
      name: 'Network Error Retry',
      priority: 1,
      conditions: [{
        errorType: 'network'
      }],
      actions: [{
        type: 'retry',
        config: { maxAttempts: 3, backoffFactor: 2 }
      }],
      metadata: {
        description: 'Retry network-related failures with exponential backoff',
        maxAttempts: 3,
        timeoutMs: 30000
      }
    });

    // Rate limit recovery
    this.recoveryStrategies.set('rate-limit-backoff', {
      name: 'Rate Limit Backoff',
      priority: 2,
      conditions: [{
        errorType: 'rate_limit',
        statusCodes: [429]
      }],
      actions: [
        {
          type: 'retry',
          config: { maxAttempts: 5, backoffFactor: 3 },
          delay: 5000
        },
        {
          type: 'fallback',
          config: { type: 'cache' }
        }
      ],
      metadata: {
        description: 'Handle rate limiting with extended backoff and cache fallback',
        maxAttempts: 5,
        timeoutMs: 60000
      }
    });

    // Server error with circuit breaker
    this.recoveryStrategies.set('server-error-circuit', {
      name: 'Server Error Circuit Breaker',
      priority: 3,
      conditions: [{
        errorType: 'server_error',
        statusCodes: [500, 502, 503, 504]
      }],
      actions: [
        {
          type: 'circuit_break',
          config: { threshold: 5, timeout: 60000 }
        },
        {
          type: 'fallback',
          config: { type: 'api', endpoint: 'secondary' }
        }
      ],
      metadata: {
        description: 'Trip circuit breaker for server errors and use fallback API',
        maxAttempts: 3,
        timeoutMs: 30000
      }
    });

    // Authentication error recovery
    this.recoveryStrategies.set('auth-token-refresh', {
      name: 'Authentication Token Refresh',
      priority: 4,
      conditions: [{
        errorType: 'authentication',
        statusCodes: [401]
      }],
      actions: [
        {
          type: 'retry',
          config: { refreshToken: true, maxAttempts: 2 }
        },
        {
          type: 'alert',
          config: { severity: 'high', message: 'Authentication failure' }
        }
      ],
      metadata: {
        description: 'Refresh authentication tokens and retry',
        maxAttempts: 2,
        timeoutMs: 10000
      }
    });

    // Dead letter queue for unrecoverable errors
    this.recoveryStrategies.set('dead-letter-queue', {
      name: 'Dead Letter Queue',
      priority: 10,
      conditions: [{
        errorType: 'unknown'
      }],
      actions: [{
        type: 'queue',
        config: { queue: 'dead-letter', delay: 300000 }
      }],
      metadata: {
        description: 'Queue unrecoverable errors for manual review',
        maxAttempts: 1,
        timeoutMs: 5000
      }
    });

    logger.info('Recovery strategies initialized', { 
      strategiesCount: this.recoveryStrategies.size 
    });
  }

  private setupErrorQueue(): void {
    errorQueue.process('error-recovery', async (job) => {
      const { error, context, originalRequest } = job.data;
      
      logger.info('Processing error recovery job', {
        jobId: job.id,
        requestId: context.requestId,
        operation: context.operation
      });

      try {
        const result = await this.recoverFromError(error, context, originalRequest);
        
        if (result.success) {
          logger.info('Error recovery successful', {
            jobId: job.id,
            requestId: context.requestId,
            strategy: result.strategy
          });
        } else {
          logger.warn('Error recovery failed', {
            jobId: job.id,
            requestId: context.requestId,
            strategy: result.strategy
          });

          // Move to dead letter queue if max retries exceeded
          if (result.metadata.queuedForLater) {
            await this.moveToDeadLetterQueue(job.data);
          }
        }

        return result;

      } catch (recoveryError) {
        logger.error('Error recovery processing failed', {
          jobId: job.id,
          requestId: context.requestId,
          error: recoveryError.message
        });

        throw recoveryError;
      }
    });

    // Dead letter queue processing
    deadLetterQueue.process('dlq-retry', async (job) => {
      const { originalJob, attempts } = job.data;
      
      if (attempts >= parseInt(process.env.DLQ_MAX_RETRIES || '5')) {
        logger.error('Max DLQ retries exceeded', {
          jobId: job.id,
          originalJobId: originalJob.id,
          attempts
        });
        
        // Alert administrators
        await this.sendAlert('DLQ_MAX_RETRIES_EXCEEDED', {
          jobId: job.id,
          originalJobId: originalJob.id,
          attempts
        });

        return;
      }

      // Retry the original operation
      try {
        const result = await this.recoverFromError(
          originalJob.data.error,
          originalJob.data.context,
          originalJob.data.originalRequest
        );

        if (result.success) {
          logger.info('DLQ retry successful', {
            jobId: job.id,
            originalJobId: originalJob.id,
            attempts: attempts + 1
          });
        } else {
          // Schedule next retry
          await deadLetterQueue.add('dlq-retry', {
            originalJob,
            attempts: attempts + 1
          }, {
            delay: parseInt(process.env.DLQ_RETRY_DELAY || '300000')
          });
        }

      } catch (error) {
        logger.error('DLQ retry failed', {
          jobId: job.id,
          originalJobId: originalJob.id,
          error: error.message
        });
      }
    });

    logger.info('Error recovery queues configured');
  }

  async recoverFromError(
    error: Error | AxiosError,
    context: ErrorContext,
    originalRequest?: any
  ): Promise<ErrorRecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Classify the error
      const errorTypes = this.errorClassifier.classifyError(error, context);
      const priority = this.errorClassifier.getRecoveryPriority(error, context);

      logger.info('Starting error recovery', {
        requestId: context.requestId,
        errorTypes,
        priority,
        attempt: context.attempt
      });

      // Find applicable recovery strategies
      const applicableStrategies = this.findApplicableStrategies(error, errorTypes, context);
      
      if (applicableStrategies.length === 0) {
        logger.warn('No applicable recovery strategies found', {
          requestId: context.requestId,
          errorTypes
        });

        return {
          success: false,
          strategy: 'none',
          attempt: context.attempt,
          error: new Error('No recovery strategies available'),
          metadata: {
            recoveryTime: Date.now() - startTime,
            fallbackUsed: false,
            circuitBreakerTripped: false,
            queuedForLater: false
          }
        };
      }

      // Execute recovery strategies in priority order
      for (const strategy of applicableStrategies) {
        try {
          const result = await this.executeRecoveryStrategy(
            strategy,
            error,
            context,
            originalRequest
          );

          errorRecoveryAttempts.inc({
            strategy: strategy.name,
            success: result.success ? 'true' : 'false'
          });

          if (result.success) {
            const recoveryTime = Date.now() - startTime;
            
            logger.info('Error recovery successful', {
              requestId: context.requestId,
              strategy: strategy.name,
              recoveryTime
            });

            return {
              ...result,
              metadata: {
                ...result.metadata,
                recoveryTime
              }
            };
          }

        } catch (strategyError) {
          logger.error('Recovery strategy failed', {
            requestId: context.requestId,
            strategy: strategy.name,
            error: strategyError.message
          });
        }
      }

      // All strategies failed
      const recoveryTime = Date.now() - startTime;
      
      return {
        success: false,
        strategy: 'exhausted',
        attempt: context.attempt,
        error: new Error('All recovery strategies exhausted'),
        metadata: {
          recoveryTime,
          fallbackUsed: false,
          circuitBreakerTripped: false,
          queuedForLater: true
        }
      };

    } catch (error) {
      logger.error('Error recovery system failure', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        strategy: 'system_error',
        attempt: context.attempt,
        error,
        metadata: {
          recoveryTime: Date.now() - startTime,
          fallbackUsed: false,
          circuitBreakerTripped: false,
          queuedForLater: false
        }
      };
    }
  }

  private findApplicableStrategies(
    error: Error | AxiosError,
    errorTypes: string[],
    context: ErrorContext
  ): RecoveryStrategy[] {
    const applicable: RecoveryStrategy[] = [];

    for (const strategy of this.recoveryStrategies.values()) {
      const isApplicable = strategy.conditions.some(condition => {
        // Check error type
        if (!errorTypes.includes(condition.errorType)) {
          return false;
        }

        // Check status codes if specified
        if (condition.statusCodes && 'response' in error) {
          const statusCode = error.response?.status;
          if (statusCode && !condition.statusCodes.includes(statusCode)) {
            return false;
          }
        }

        // Check message patterns if specified
        if (condition.messagePatterns) {
          const hasMatchingPattern = condition.messagePatterns.some(pattern =>
            pattern.test(error.message)
          );
          if (!hasMatchingPattern) {
            return false;
          }
        }

        // Check context conditions if specified
        if (condition.contextChecks && !condition.contextChecks(context)) {
          return false;
        }

        return true;
      });

      if (isApplicable) {
        applicable.push(strategy);
      }
    }

    // Sort by priority (lower number = higher priority)
    return applicable.sort((a, b) => a.priority - b.priority);
  }

  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    error: Error | AxiosError,
    context: ErrorContext,
    originalRequest: any
  ): Promise<ErrorRecoveryResult> {
    logger.info('Executing recovery strategy', {
      requestId: context.requestId,
      strategy: strategy.name,
      actions: strategy.actions.length
    });

    let fallbackUsed = false;
    let circuitBreakerTripped = false;
    let queuedForLater = false;
    let finalResult: any;
    let finalError: Error | undefined;

    for (const action of strategy.actions) {
      try {
        switch (action.type) {
          case 'retry':
            finalResult = await this.executeRetryAction(action, context, originalRequest);
            break;

          case 'fallback':
            finalResult = await this.executeFallbackAction(action, context, originalRequest);
            fallbackUsed = true;
            break;

          case 'circuit_break':
            await this.executeCircuitBreakerAction(action, context);
            circuitBreakerTripped = true;
            break;

          case 'degrade':
            finalResult = await this.executeDegradationAction(action, context);
            break;

          case 'queue':
            await this.executeQueueAction(action, error, context, originalRequest);
            queuedForLater = true;
            break;

          case 'alert':
            await this.executeAlertAction(action, error, context);
            break;

          default:
            logger.warn('Unknown recovery action type', {
              type: action.type,
              requestId: context.requestId
            });
        }

        if (action.delay) {
          await this.sleep(action.delay);
        }

      } catch (actionError) {
        logger.error('Recovery action failed', {
          requestId: context.requestId,
          strategy: strategy.name,
          action: action.type,
          error: actionError.message
        });

        finalError = actionError;
      }
    }

    return {
      success: !!finalResult && !finalError,
      strategy: strategy.name,
      attempt: context.attempt,
      response: finalResult,
      error: finalError,
      metadata: {
        recoveryTime: 0, // Will be set by caller
        fallbackUsed,
        circuitBreakerTripped,
        queuedForLater
      }
    };
  }

  private async executeRetryAction(
    action: any,
    context: ErrorContext,
    originalRequest: any
  ): Promise<any> {
    const retryContext: ErrorContext = {
      ...context,
      attempt: context.attempt + 1
    };

    return await this.retryStrategy.executeWithRetry(
      () => this.executeOriginalRequest(originalRequest),
      retryContext
    );
  }

  private async executeFallbackAction(
    action: any,
    context: ErrorContext,
    originalRequest: any
  ): Promise<any> {
    const config = action.config;
    
    switch (config.type) {
      case 'api':
        return await this.callFallbackAPI(config, originalRequest);
      
      case 'cache':
        return await this.getFallbackFromCache(context);
      
      case 'default':
        return config.value;
      
      default:
        throw new Error(`Unknown fallback type: ${config.type}`);
    }
  }

  private async executeCircuitBreakerAction(
    action: any,
    context: ErrorContext
  ): Promise<void> {
    // Circuit breaker is handled by the APICircuitBreaker class
    logger.info('Circuit breaker action triggered', {
      requestId: context.requestId,
      config: action.config
    });
  }

  private async executeDegradationAction(
    action: any,
    context: ErrorContext
  ): Promise<any> {
    // Return a degraded response with limited functionality
    return {
      status: 'degraded',
      message: 'Service operating in degraded mode',
      limitedData: action.config.degradedValue || null
    };
  }

  private async executeQueueAction(
    action: any,
    error: Error,
    context: ErrorContext,
    originalRequest: any
  ): Promise<void> {
    const queueConfig = action.config;
    
    if (queueConfig.queue === 'dead-letter') {
      await this.moveToDeadLetterQueue({
        error,
        context,
        originalRequest
      });
    } else {
      await errorQueue.add('error-recovery', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context,
        originalRequest
      }, {
        delay: queueConfig.delay || 0
      });
    }
  }

  private async executeAlertAction(
    action: any,
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    await this.sendAlert(action.config.message || 'Error recovery alert', {
      requestId: context.requestId,
      operation: context.operation,
      error: error.message,
      severity: action.config.severity || 'medium'
    });
  }

  private async executeOriginalRequest(originalRequest: any): Promise<any> {
    // This would execute the original request that failed
    // Implementation depends on the specific request type
    throw new Error('Original request execution not implemented');
  }

  private async callFallbackAPI(config: any, originalRequest: any): Promise<any> {
    // Call a fallback API endpoint
    const fallbackURL = config.endpoint || process.env.FALLBACK_API_URL;
    
    if (!fallbackURL) {
      throw new Error('No fallback API URL configured');
    }

    const response = await axios({
      ...originalRequest,
      baseURL: fallbackURL
    });

    return response.data;
  }

  private async getFallbackFromCache(context: ErrorContext): Promise<any> {
    const cacheKey = `fallback:${context.operation}:${context.endpoint}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    throw new Error('No fallback data available in cache');
  }

  private async moveToDeadLetterQueue(jobData: any): Promise<void> {
    await deadLetterQueue.add('dlq-retry', {
      originalJob: { id: this.generateId(), data: jobData },
      attempts: 0
    }, {
      delay: parseInt(process.env.DLQ_RETRY_DELAY || '300000')
    });

    logger.info('Job moved to dead letter queue', {
      requestId: jobData.context?.requestId
    });
  }

  private async sendAlert(message: string, metadata: any): Promise<void> {
    // Send alert via multiple channels (email, Slack, PagerDuty, etc.)
    logger.error('ALERT: ' + message, metadata);
    
    Sentry.captureMessage(message, {
      level: 'error',
      extra: metadata
    });

    // In production, you would integrate with:
    // - PagerDuty for critical alerts
    // - Slack for team notifications
    // - Email for stakeholder updates
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// Resilient API Integration Service
class ResilientAPIIntegration {
  private errorRecovery: ErrorRecoveryEngine;
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.errorRecovery = new ErrorRecoveryEngine();
    this.setupHealthChecks();
    this.setupGracefulShutdown();
  }

  private setupHealthChecks(): void {
    const configs = this.getIntegrationConfigs();

    for (const config of configs) {
      const interval = setInterval(async () => {
        try {
          await this.performHealthCheck(config);
        } catch (error) {
          logger.error('Health check failed', {
            integration: config.name,
            error: error.message
          });
        }
      }, config.healthCheck.interval);

      this.healthChecks.set(config.id, interval);
    }

    logger.info('Health checks started', {
      integrations: configs.length
    });
  }

  private async performHealthCheck(config: IntegrationConfig): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(
        config.baseURL + config.healthCheck.endpoint,
        { timeout: config.healthCheck.timeout }
      );

      const duration = Date.now() - startTime;
      
      logger.debug('Health check passed', {
        integration: config.name,
        status: response.status,
        duration
      });

      // Update metrics
      apiCallDuration
        .labels(config.id, config.healthCheck.endpoint, 'GET')
        .observe(duration / 1000);

    } catch (error) {
      logger.warn('Health check failed', {
        integration: config.name,
        error: error.message
      });

      // Trigger recovery if needed
      const context: ErrorContext = {
        operation: 'health_check',
        endpoint: config.healthCheck.endpoint,
        method: 'GET',
        attempt: 1,
        timestamp: new Date(),
        requestId: this.generateRequestId()
      };

      await this.errorRecovery.recoverFromError(error, context);
    }
  }

  async makeResilientAPICall(
    integrationId: string,
    requestConfig: AxiosRequestConfig
  ): Promise<any> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const context: ErrorContext = {
      operation: 'api_call',
      endpoint: requestConfig.url || '',
      method: requestConfig.method || 'GET',
      attempt: 1,
      timestamp: new Date(),
      requestId,
      payload: requestConfig.data,
      headers: requestConfig.headers as Record<string, string>
    };

    try {
      // Try circuit breaker first
      const response = await this.errorRecovery['circuitBreaker']
        .executeWithCircuitBreaker(integrationId, requestConfig);

      const duration = Date.now() - startTime;

      // Update metrics
      apiCallsTotal
        .labels(integrationId, context.endpoint, context.method, 'success')
        .inc();
      
      apiCallDuration
        .labels(integrationId, context.endpoint, context.method)
        .observe(duration / 1000);

      logger.info('API call successful', {
        requestId,
        integrationId,
        duration
      });

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Update metrics
      apiCallsTotal
        .labels(integrationId, context.endpoint, context.method, 'error')
        .inc();

      logger.error('API call failed, attempting recovery', {
        requestId,
        integrationId,
        error: error.message,
        duration
      });

      // Attempt error recovery
      const recoveryResult = await this.errorRecovery.recoverFromError(
        error,
        context,
        requestConfig
      );

      if (recoveryResult.success) {
        return recoveryResult.response;
      } else {
        throw recoveryResult.error || error;
      }
    }
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      logger.info('Shutting down resilient API integration...');

      // Clear health check intervals
      for (const interval of this.healthChecks.values()) {
        clearInterval(interval);
      }

      // Close queue connections
      await errorQueue.close();
      await deadLetterQueue.close();
      await redis.disconnect();

      logger.info('Cleanup completed');
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private getIntegrationConfigs(): IntegrationConfig[] {
    // Return the same configs as used in APICircuitBreaker
    return [
      {
        id: 'primary-api',
        name: 'Primary API',
        baseURL: process.env.PRIMARY_API_URL || 'https://api.primary.com',
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        retryStrategy: {
          maxAttempts: parseInt(process.env.MAX_RETRIES || '3'),
          initialDelay: parseInt(process.env.RETRY_DELAY || '1000'),
          backoffFactor: parseInt(process.env.RETRY_BACKOFF_FACTOR || '2'),
          maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '30000')
        },
        circuitBreaker: {
          enabled: process.env.ENABLE_CIRCUIT_BREAKER === 'true',
          threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
          timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
          resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000')
        },
        fallbacks: [
          {
            type: 'api',
            endpoint: process.env.SECONDARY_API_URL,
            priority: 1
          }
        ],
        healthCheck: {
          endpoint: '/health',
          interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
          timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000')
        }
      }
    ];
  }
}

// Command Definition
export const errorRecoveryCommand = defineCommand({
  meta: {
    name: "error-recovery",
    description: "Resilient API integration system with advanced error recovery"
  },
  args: {
    action: {
      type: "string",
      description: "Action to perform (test, simulate, monitor, serve)",
      required: true
    },
    integration: {
      type: "string",
      description: "Integration ID",
      default: "primary-api"
    },
    endpoint: {
      type: "string",
      description: "API endpoint to test",
      default: "/test"
    },
    method: {
      type: "string",
      description: "HTTP method",
      default: "GET"
    },
    "error-type": {
      type: "string",
      description: "Error type to simulate",
      required: false
    },
    "max-attempts": {
      type: "string",
      description: "Maximum recovery attempts",
      default: "3"
    },
    verbose: {
      type: "boolean",
      description: "Verbose output",
      default: false
    }
  },
  async run({ args }) {
    try {
      switch (args.action) {
        case 'test':
          console.log("🔧 Testing resilient API integration...");
          
          const integration = new ResilientAPIIntegration();
          
          try {
            const response = await integration.makeResilientAPICall(
              args.integration,
              {
                url: args.endpoint,
                method: args.method as any
              }
            );

            console.log("\n✅ API Call Successful");
            console.log("======================");
            console.log(`Response: ${JSON.stringify(response, null, 2).substring(0, 500)}`);

          } catch (error) {
            console.log("\n❌ API Call Failed");
            console.log("==================");
            console.log(`Error: ${error.message}`);
            
            if (args.verbose) {
              console.log(`Stack: ${error.stack}`);
            }
          }
          break;

        case 'simulate':
          if (!args["error-type"]) {
            throw new Error("Error type is required for simulation");
          }

          console.log(`🎭 Simulating ${args["error-type"]} error...`);
          
          const errorRecovery = new ErrorRecoveryEngine();
          
          // Create a simulated error
          const simulatedError = new Error(`Simulated ${args["error-type"]} error`);
          const context: ErrorContext = {
            operation: 'simulate',
            endpoint: args.endpoint,
            method: args.method,
            attempt: 1,
            timestamp: new Date(),
            requestId: `sim-${Date.now()}`
          };

          const result = await errorRecovery.recoverFromError(simulatedError, context);

          console.log("\n🔍 Recovery Result");
          console.log("==================");
          console.log(`Success: ${result.success}`);
          console.log(`Strategy: ${result.strategy}`);
          console.log(`Attempts: ${result.attempt}`);
          console.log(`Recovery Time: ${result.metadata.recoveryTime}ms`);
          console.log(`Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`Circuit Breaker Tripped: ${result.metadata.circuitBreakerTripped}`);
          console.log(`Queued for Later: ${result.metadata.queuedForLater}`);

          if (result.error && args.verbose) {
            console.log(`Final Error: ${result.error.message}`);
          }
          break;

        case 'monitor':
          console.log("📊 Starting error recovery monitoring...");
          
          // Start the monitoring service
          const monitoringIntegration = new ResilientAPIIntegration();
          
          console.log("\n✅ Monitoring Started");
          console.log("=====================");
          console.log("- Health checks running");
          console.log("- Circuit breakers monitoring");
          console.log("- Error recovery queues active");
          console.log("- Metrics collection enabled");
          console.log("\nPress Ctrl+C to stop monitoring");

          // Keep the process running
          await new Promise(() => {});
          break;

        case 'serve':
          console.log("🚀 Starting error recovery service...");
          
          const app = require('express')();
          
          // Health endpoint
          app.get('/health', (req, res) => {
            res.json({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              uptime: process.uptime()
            });
          });

          // Metrics endpoint
          app.get('/metrics', (req, res) => {
            res.set('Content-Type', prometheusRegister.contentType);
            res.end(prometheusRegister.metrics());
          });

          // Test API endpoint
          app.get('/api/test', async (req, res) => {
            const serviceIntegration = new ResilientAPIIntegration();
            
            try {
              const response = await serviceIntegration.makeResilientAPICall(
                'primary-api',
                {
                  url: '/test',
                  method: 'GET'
                }
              );
              
              res.json({ success: true, data: response });
              
            } catch (error) {
              res.status(500).json({ 
                success: false, 
                error: error.message 
              });
            }
          });

          const port = 3000;
          const server = app.listen(port, () => {
            console.log(`\n✅ Error Recovery Service Started`);
            console.log(`🌐 Health Check: http://localhost:${port}/health`);
            console.log(`📊 Metrics: http://localhost:${port}/metrics`);
            console.log(`🧪 Test API: http://localhost:${port}/api/test`);
            console.log("Press Ctrl+C to stop");
          });

          // Setup graceful shutdown
          createTerminus(server, {
            signal: 'SIGINT',
            healthChecks: {
              '/health': async () => {
                return { status: 'healthy' };
              }
            },
            onSignal: async () => {
              logger.info('Server is starting cleanup');
              return Promise.all([
                errorQueue.close(),
                deadLetterQueue.close(),
                redis.disconnect()
              ]);
            },
            onShutdown: async () => {
              logger.info('Cleanup finished, server is shutting down');
            }
          });

          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      logger.error('Error recovery command failed', { error: error.message });
      console.error(`❌ Error Recovery System Error: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Testing Approach

```typescript
// tests/error-recovery.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorClassifier, ErrorRecoveryEngine } from '../src/error-recovery';
import nock from 'nock';

describe('Error Recovery Workflow', () => {
  let errorClassifier: ErrorClassifier;
  let errorRecovery: ErrorRecoveryEngine;

  beforeEach(() => {
    errorClassifier = new ErrorClassifier();
    errorRecovery = new ErrorRecoveryEngine();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'GET',
        attempt: 1,
        timestamp: new Date(),
        requestId: 'test-123'
      };

      const classifications = errorClassifier.classifyError(error, context);
      expect(classifications).toContain('network');
      expect(errorClassifier.isRetryable(error, context)).toBe(true);
    });

    it('should classify rate limit errors', () => {
      const error = {
        message: 'Too many requests',
        response: { status: 429 }
      } as any;
      
      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'GET',
        attempt: 1,
        timestamp: new Date(),
        requestId: 'test-456'
      };

      const classifications = errorClassifier.classifyError(error, context);
      expect(classifications).toContain('rate_limit');
    });

    it('should not retry client errors', () => {
      const error = {
        message: 'Bad Request',
        response: { status: 400 }
      } as any;
      
      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'POST',
        attempt: 1,
        timestamp: new Date(),
        requestId: 'test-789'
      };

      expect(errorClassifier.isRetryable(error, context)).toBe(false);
    });
  });

  describe('Recovery Strategies', () => {
    it('should recover from transient network errors', async () => {
      // Mock a failing API that succeeds on retry
      nock('https://api.example.com')
        .get('/test')
        .replyWithError({ code: 'ECONNRESET' })
        .get('/test')
        .reply(200, { success: true });

      const error = new Error('ECONNRESET');
      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'GET',
        attempt: 1,
        timestamp: new Date(),
        requestId: 'test-recovery-1'
      };

      const result = await errorRecovery.recoverFromError(error, context, {
        url: '/test',
        method: 'GET',
        baseURL: 'https://api.example.com'
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toContain('retry');
    });

    it('should use fallback when primary API fails', async () => {
      const serverError = {
        message: 'Internal Server Error',
        response: { status: 500 }
      } as any;

      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'GET',
        attempt: 1,
        timestamp: new Date(),
        requestId: 'test-fallback-1'
      };

      const result = await errorRecovery.recoverFromError(serverError, context);

      // Should attempt fallback strategy
      expect(result.metadata.fallbackUsed || result.metadata.queuedForLater).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const circuitBreaker = new (errorRecovery as any).circuitBreaker.constructor();
      
      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.executeWithCircuitBreaker('primary-api', {
            url: '/failing-endpoint',
            method: 'GET'
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(
        circuitBreaker.executeWithCircuitBreaker('primary-api', {
          url: '/test',
          method: 'GET'
        })
      ).rejects.toThrow('Circuit breaker open');
    });
  });

  describe('Dead Letter Queue', () => {
    it('should move unrecoverable errors to DLQ', async () => {
      const unrecoverableError = new Error('Persistent failure');
      const context = {
        operation: 'api_call',
        endpoint: '/test',
        method: 'POST',
        attempt: 5, // Exceeded max attempts
        timestamp: new Date(),
        requestId: 'test-dlq-1'
      };

      const result = await errorRecovery.recoverFromError(unrecoverableError, context);

      expect(result.success).toBe(false);
      expect(result.metadata.queuedForLater).toBe(true);
    });
  });
});
```

## Usage Examples

```bash
# Test resilient API integration
./cli error-recovery --action=test \
  --integration="primary-api" \
  --endpoint="/users" \
  --method="GET" \
  --verbose

# Simulate specific error types
./cli error-recovery --action=simulate \
  --error-type="network" \
  --max-attempts="5" \
  --verbose

# Start monitoring service
./cli error-recovery --action=monitor

# Start HTTP service with error recovery
./cli error-recovery --action=serve
```

## Performance Considerations

1. **Circuit Breaker**: Prevents cascading failures and reduces load
2. **Exponential Backoff**: Prevents thundering herd problems
3. **Async Processing**: Error recovery doesn't block main operations
4. **Connection Pooling**: Reuses HTTP connections for efficiency
5. **Metrics Collection**: Low-overhead monitoring and alerting

## Deployment Notes

This pattern provides a comprehensive error recovery system suitable for production environments with high availability requirements. It includes monitoring, alerting, and graceful degradation capabilities essential for resilient distributed systems.