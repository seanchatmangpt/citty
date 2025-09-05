/**
 * Adaptive Test Execution Engine
 * Self-healing infrastructure with intelligent retry mechanisms
 */

import { Docker } from 'dockerode';
import { createClient } from 'redis';
import { Queue, Worker } from 'bull';
import { Logger } from '../utils/logger.js';
import { TestSuite, TestResult, ExecutionEnvironment, RetryStrategy } from '../types/execution-types.js';

export class AdaptiveExecutor {
  private docker: Docker;
  private redis: any;
  private testQueue: Queue;
  private worker: Worker;
  private logger: Logger;
  private environments: Map<string, ExecutionEnvironment> = new Map();
  private healthCheckers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.logger = new Logger('AdaptiveExecutor');
    this.docker = new Docker();
    this.initializeRedis();
    this.initializeQueue();
  }

  private async initializeRedis(): Promise<void> {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.redis.on('error', (error: any) => {
      this.logger.error('Redis connection error', error);
    });
    
    await this.redis.connect();
  }

  private initializeQueue(): void {
    this.testQueue = new Queue('test execution', {
      redis: {
        port: 6379,
        host: 'localhost'
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    this.worker = new Worker('test execution', async (job) => {
      return await this.executeTestJob(job.data);
    });

    this.worker.on('completed', (job, result) => {
      this.logger.info(`Test job ${job.id} completed`, result);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Test job ${job?.id} failed`, err);
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Adaptive Executor');
    await this.setupBaseImages();
    await this.startHealthMonitoring();
    this.logger.info('Adaptive Executor initialized');
  }

  private async setupBaseImages(): Promise<void> {
    const baseImages = [
      'node:18-alpine',
      'python:3.11-alpine',
      'selenium/standalone-chrome:latest',
      'postgres:15-alpine',
      'redis:7-alpine'
    ];

    for (const image of baseImages) {
      try {
        await this.docker.pull(image);
        this.logger.info(`Pulled base image: ${image}`);
      } catch (error) {
        this.logger.warn(`Failed to pull image ${image}`, error);
      }
    }
  }

  async executeTestSuite(testSuite: TestSuite): Promise<TestResult[]> {
    this.logger.info(`Executing test suite: ${testSuite.id}`);
    
    // Dynamic environment provisioning
    const environment = await this.provisionEnvironment(testSuite);
    
    // Intelligent test partitioning
    const testBatches = await this.partitionTests(testSuite.tests, environment);
    
    // Execute tests with adaptive strategies
    const results: TestResult[] = [];
    
    for (const batch of testBatches) {
      const batchResults = await this.executeBatch(batch, environment);
      results.push(...batchResults);
    }

    // Cleanup environment
    await this.cleanupEnvironment(environment);
    
    this.logger.info(`Test suite execution completed. ${results.length} tests executed`);
    return results;
  }

  private async provisionEnvironment(testSuite: TestSuite): Promise<ExecutionEnvironment> {
    const envId = `env_${testSuite.id}_${Date.now()}`;
    
    this.logger.info(`Provisioning environment: ${envId}`);
    
    // Determine required services based on test requirements
    const requiredServices = this.analyzeServiceRequirements(testSuite);
    
    const containers: any[] = [];
    
    // Start database if needed
    if (requiredServices.includes('database')) {
      const dbContainer = await this.docker.createContainer({
        Image: 'postgres:15-alpine',
        Env: [
          'POSTGRES_DB=testdb',
          'POSTGRES_USER=test',
          'POSTGRES_PASSWORD=test'
        ],
        HostConfig: {
          PublishAllPorts: true
        }
      });
      
      await dbContainer.start();
      containers.push({ name: 'database', container: dbContainer });
    }

    // Start browser if needed
    if (requiredServices.includes('browser')) {
      const browserContainer = await this.docker.createContainer({
        Image: 'selenium/standalone-chrome:latest',
        HostConfig: {
          PublishAllPorts: true,
          ShmSize: 2147483648 // 2GB shared memory
        }
      });
      
      await browserContainer.start();
      containers.push({ name: 'browser', container: browserContainer });
    }

    // Start application container
    const appContainer = await this.docker.createContainer({
      Image: testSuite.environment?.image || 'node:18-alpine',
      Cmd: testSuite.environment?.startCommand || ['npm', 'start'],
      WorkingDir: '/app',
      Env: testSuite.environment?.variables || [],
      HostConfig: {
        PublishAllPorts: true,
        Binds: testSuite.environment?.volumes || []
      }
    });
    
    await appContainer.start();
    containers.push({ name: 'app', container: appContainer });

    const environment: ExecutionEnvironment = {
      id: envId,
      containers,
      services: requiredServices,
      createdAt: new Date(),
      status: 'running'
    };

    this.environments.set(envId, environment);
    
    // Wait for services to be ready
    await this.waitForServicesReady(environment);
    
    // Start health monitoring
    this.startEnvironmentHealthCheck(environment);
    
    return environment;
  }

  private analyzeServiceRequirements(testSuite: TestSuite): string[] {
    const services: string[] = [];
    
    // Analyze test content to determine required services
    testSuite.tests.forEach(test => {
      if (test.steps.some(step => step.includes('database') || step.includes('sql'))) {
        services.push('database');
      }
      if (test.steps.some(step => step.includes('browser') || step.includes('click') || step.includes('navigate'))) {
        services.push('browser');
      }
      if (test.steps.some(step => step.includes('api') || step.includes('http'))) {
        services.push('api');
      }
    });
    
    return [...new Set(services)]; // Remove duplicates
  }

  private async waitForServicesReady(environment: ExecutionEnvironment): Promise<void> {
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // 2 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      let allReady = true;
      
      for (const service of environment.containers) {
        const isReady = await this.checkServiceHealth(service);
        if (!isReady) {
          allReady = false;
          break;
        }
      }
      
      if (allReady) {
        this.logger.info(`Environment ${environment.id} is ready`);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }
    
    throw new Error(`Environment ${environment.id} failed to become ready within ${maxWaitTime}ms`);
  }

  private async checkServiceHealth(service: any): Promise<boolean> {
    try {
      const inspect = await service.container.inspect();
      return inspect.State.Running;
    } catch (error) {
      return false;
    }
  }

  private startEnvironmentHealthCheck(environment: ExecutionEnvironment): void {
    const checkInterval = setInterval(async () => {
      try {
        for (const service of environment.containers) {
          const isHealthy = await this.checkServiceHealth(service);
          if (!isHealthy) {
            this.logger.warn(`Service ${service.name} is unhealthy, attempting self-healing`);
            await this.healService(service, environment);
          }
        }
      } catch (error) {
        this.logger.error('Health check failed', error);
      }
    }, 10000); // Check every 10 seconds
    
    this.healthCheckers.set(environment.id, checkInterval);
  }

  private async healService(service: any, environment: ExecutionEnvironment): Promise<void> {
    this.logger.info(`Healing service: ${service.name}`);
    
    try {
      // Try to restart the container
      await service.container.restart();
      
      // Wait for it to be ready again
      await this.waitForServiceReady(service);
      
      this.logger.info(`Service ${service.name} healed successfully`);
    } catch (error) {
      this.logger.error(`Failed to heal service ${service.name}`, error);
      
      // If restart fails, recreate the container
      await this.recreateService(service, environment);
    }
  }

  private async waitForServiceReady(service: any): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      const isReady = await this.checkServiceHealth(service);
      if (isReady) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }
    
    throw new Error(`Service ${service.name} failed to become ready after healing`);
  }

  private async recreateService(service: any, environment: ExecutionEnvironment): Promise<void> {
    this.logger.info(`Recreating service: ${service.name}`);
    
    try {
      // Remove the old container
      await service.container.remove({ force: true });
      
      // Create and start a new one (simplified - would need original config)
      const newContainer = await this.docker.createContainer({
        Image: 'node:18-alpine', // Would use original image
        HostConfig: {
          PublishAllPorts: true
        }
      });
      
      await newContainer.start();
      
      // Update the service reference
      service.container = newContainer;
      
      this.logger.info(`Service ${service.name} recreated successfully`);
    } catch (error) {
      this.logger.error(`Failed to recreate service ${service.name}`, error);
      throw error;
    }
  }

  private async partitionTests(tests: any[], environment: ExecutionEnvironment): Promise<any[][]> {
    // Intelligent test partitioning based on:
    // 1. Test dependencies
    // 2. Resource requirements
    // 3. Execution time estimates
    // 4. Parallel execution capabilities
    
    const batches: any[][] = [];
    const batchSize = this.calculateOptimalBatchSize(tests, environment);
    
    // Group tests by type and dependencies
    const groupedTests = this.groupTestsByType(tests);
    
    for (const [testType, typeTests] of Object.entries(groupedTests)) {
      for (let i = 0; i < (typeTests as any[]).length; i += batchSize) {
        batches.push((typeTests as any[]).slice(i, i + batchSize));
      }
    }
    
    return batches;
  }

  private calculateOptimalBatchSize(tests: any[], environment: ExecutionEnvironment): number {
    // Calculate based on available resources and test complexity
    const baseSize = 5;
    const containerCount = environment.containers.length;
    const testComplexity = this.calculateAverageComplexity(tests);
    
    return Math.max(1, Math.floor(baseSize * containerCount / testComplexity));
  }

  private groupTestsByType(tests: any[]): { [key: string]: any[] } {
    return tests.reduce((groups, test) => {
      const type = test.type || 'default';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(test);
      return groups;
    }, {});
  }

  private calculateAverageComplexity(tests: any[]): number {
    // Simple complexity calculation based on number of steps
    const totalSteps = tests.reduce((sum, test) => sum + (test.steps?.length || 1), 0);
    return totalSteps / tests.length;
  }

  private async executeBatch(batch: any[], environment: ExecutionEnvironment): Promise<TestResult[]> {
    this.logger.info(`Executing batch of ${batch.length} tests`);
    
    const results: TestResult[] = [];
    const promises = batch.map(test => this.executeTestWithRetry(test, environment));
    
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          testId: batch[index].id,
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          logs: []
        });
      }
    });
    
    return results;
  }

  private async executeTestWithRetry(test: any, environment: ExecutionEnvironment): Promise<TestResult> {
    const retryStrategy: RetryStrategy = {
      maxAttempts: test.retryConfig?.maxAttempts || 3,
      baseDelay: test.retryConfig?.baseDelay || 1000,
      maxDelay: test.retryConfig?.maxDelay || 10000,
      backoffMultiplier: test.retryConfig?.backoffMultiplier || 2
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryStrategy.maxAttempts; attempt++) {
      try {
        this.logger.info(`Executing test ${test.id}, attempt ${attempt}`);
        
        const result = await this.executeSingleTest(test, environment);
        
        if (result.status === 'passed') {
          return result;
        }
        
        // If test failed but not due to infrastructure, don't retry
        if (!this.isInfrastructureError(result.error)) {
          return result;
        }
        
        lastError = new Error(result.error);
        
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Test ${test.id} attempt ${attempt} failed: ${lastError.message}`);
      }
      
      // Wait before retry (except for last attempt)
      if (attempt < retryStrategy.maxAttempts) {
        const delay = Math.min(
          retryStrategy.baseDelay * Math.pow(retryStrategy.backoffMultiplier, attempt - 1),
          retryStrategy.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All attempts failed
    return {
      testId: test.id,
      status: 'failed',
      error: lastError?.message || 'All retry attempts failed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      logs: [],
      attempts: retryStrategy.maxAttempts
    };
  }

  private async executeSingleTest(test: any, environment: ExecutionEnvironment): Promise<TestResult> {
    const startTime = new Date();
    const logs: string[] = [];
    
    try {
      // Execute test steps
      for (const step of test.steps) {
        logs.push(`Executing step: ${step}`);
        await this.executeStep(step, environment);
      }
      
      // Verify expected result
      const verificationResult = await this.verifyTestResult(test, environment);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        testId: test.id,
        status: verificationResult ? 'passed' : 'failed',
        error: verificationResult ? undefined : 'Verification failed',
        startTime,
        endTime,
        duration,
        logs
      };
      
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        testId: test.id,
        status: 'failed',
        error: (error as Error).message,
        startTime,
        endTime,
        duration,
        logs
      };
    }
  }

  private async executeStep(step: string, environment: ExecutionEnvironment): Promise<void> {
    // This would implement actual test step execution
    // For now, simulate step execution
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    
    // Randomly simulate some failures for demo
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error(`Step failed: ${step}`);
    }
  }

  private async verifyTestResult(test: any, environment: ExecutionEnvironment): Promise<boolean> {
    // Implement result verification logic
    // For now, simulate verification
    return Math.random() > 0.1; // 90% pass rate
  }

  private isInfrastructureError(error?: string): boolean {
    if (!error) return false;
    
    const infrastructureErrors = [
      'connection refused',
      'timeout',
      'network error',
      'service unavailable',
      'container stopped',
      'dns resolution failed'
    ];
    
    return infrastructureErrors.some(infraError => 
      error.toLowerCase().includes(infraError)
    );
  }

  async executeTestJob(jobData: any): Promise<any> {
    // Queue-based test execution
    const { testSuite } = jobData;
    
    try {
      const results = await this.executeTestSuite(testSuite);
      return { success: true, results };
    } catch (error) {
      throw new Error(`Test execution failed: ${(error as Error).message}`);
    }
  }

  private async cleanupEnvironment(environment: ExecutionEnvironment): Promise<void> {
    this.logger.info(`Cleaning up environment: ${environment.id}`);
    
    // Stop health monitoring
    const healthChecker = this.healthCheckers.get(environment.id);
    if (healthChecker) {
      clearInterval(healthChecker);
      this.healthCheckers.delete(environment.id);
    }
    
    // Stop and remove containers
    for (const service of environment.containers) {
      try {
        await service.container.stop();
        await service.container.remove();
      } catch (error) {
        this.logger.warn(`Failed to cleanup container ${service.name}`, error);
      }
    }
    
    // Remove environment from tracking
    this.environments.delete(environment.id);
    
    this.logger.info(`Environment ${environment.id} cleaned up`);
  }

  async getResourceUsage(): Promise<any> {
    const stats = {
      activeEnvironments: this.environments.size,
      totalContainers: 0,
      queueStats: await this.testQueue.getWaiting().then(jobs => jobs.length)
    };
    
    for (const env of this.environments.values()) {
      stats.totalContainers += env.containers.length;
    }
    
    return stats;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Adaptive Executor');
    
    // Cleanup all environments
    for (const environment of this.environments.values()) {
      await this.cleanupEnvironment(environment);
    }
    
    // Close worker and queue
    await this.worker.close();
    await this.testQueue.close();
    
    // Close Redis connection
    await this.redis.disconnect();
    
    this.logger.info('Adaptive Executor shutdown complete');
  }
}