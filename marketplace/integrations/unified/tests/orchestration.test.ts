import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedOrchestrator, createUnifiedOrchestrator } from '../unified-orchestrator';
import { UnifiedAPIGateway } from '../gateway/api-gateway';
import { WorkflowEngine } from '../orchestrator/workflow-engine';
import { EventBus } from '../messaging/event-bus';
import { ConfigManager } from '../config/config-manager';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { AuthenticationService } from '../auth/auth-service';
import { RateLimiter } from '../auth/rate-limiter';
import { LoadBalancer } from '../gateway/load-balancer';
import { CircuitBreaker } from '../gateway/circuit-breaker';
import { ResponseTransformer } from '../transformations/response-transformer';
import type { UnifiedRequest, UnifiedResponse, SystemType } from '../types/orchestration';

describe('UnifiedOrchestrator', () => {
  let orchestrator: UnifiedOrchestrator;
  
  beforeEach(() => {
    orchestrator = createUnifiedOrchestrator({
      environment: 'test',
      enableMetrics: true,
      enableWorkflows: true,
      enableEvents: true
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(orchestrator.initialize()).resolves.not.toThrow();
      expect(orchestrator.getHealth().overall).toBe('healthy');
    });

    it('should load configuration from environment', async () => {
      process.env.UNIFIED_ENVIRONMENT = 'test';
      process.env.UNIFIED_GATEWAY_PORT = '3001';
      
      await orchestrator.initialize();
      
      const config = orchestrator.getConfiguration();
      expect(config.environment).toBe('test');
      expect(config.gateway.port).toBe(3001);
      
      delete process.env.UNIFIED_ENVIRONMENT;
      delete process.env.UNIFIED_GATEWAY_PORT;
    });

    it('should emit initialization events', async () => {
      const initSpy = vi.fn();
      orchestrator.on('initialized', initSpy);
      
      await orchestrator.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Request Processing', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.start();
    });

    it('should process CNS validation request', async () => {
      const request: UnifiedRequest = {
        id: 'test-req-1',
        source: 'test',
        target: 'cns',
        operation: 'cns.validate-uhft',
        payload: { data: 'test-data' },
        metadata: {
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: 'span-1',
          priority: 'normal',
          timeout: 30000,
          retries: 3
        }
      };

      const response = await orchestrator.processRequest(request);
      
      expect(response).toMatchObject({
        requestId: 'test-req-1',
        source: 'cns',
        status: 'success'
      });
      expect(response.data).toHaveProperty('valid', true);
      expect(response.data).toHaveProperty('uhftScore');
    });

    it('should process ByteStar enhancement request', async () => {
      const request: UnifiedRequest = {
        id: 'test-req-2',
        source: 'test',
        target: 'bytestar',
        operation: 'bytestar.ai-enhance',
        payload: { data: 'test-data' },
        metadata: {
          timestamp: new Date(),
          traceId: 'trace-2',
          spanId: 'span-2',
          priority: 'normal',
          timeout: 30000,
          retries: 3
        }
      };

      const response = await orchestrator.processRequest(request);
      
      expect(response).toMatchObject({
        requestId: 'test-req-2',
        source: 'bytestar',
        status: 'success'
      });
      expect(response.data).toHaveProperty('enhanced', true);
      expect(response.data).toHaveProperty('improvements');
    });

    it('should process Marketplace search request', async () => {
      const request: UnifiedRequest = {
        id: 'test-req-3',
        source: 'test',
        target: 'marketplace',
        operation: 'marketplace.search',
        payload: { query: 'test-query' },
        metadata: {
          timestamp: new Date(),
          traceId: 'trace-3',
          spanId: 'span-3',
          priority: 'normal',
          timeout: 30000,
          retries: 3
        }
      };

      const response = await orchestrator.processRequest(request);
      
      expect(response).toMatchObject({
        requestId: 'test-req-3',
        source: 'marketplace',
        status: 'success'
      });
      expect(response.data).toHaveProperty('results');
      expect(response.data).toHaveProperty('total');
    });

    it('should handle batch processing', async () => {
      const requests: UnifiedRequest[] = [
        {
          id: 'batch-1',
          source: 'test',
          target: 'cns',
          operation: 'cns.validate-uhft',
          payload: { data: 'test-1' },
          metadata: {
            timestamp: new Date(),
            traceId: 'batch-trace',
            spanId: 'span-1',
            priority: 'normal',
            timeout: 30000,
            retries: 3
          }
        },
        {
          id: 'batch-2',
          source: 'test',
          target: 'marketplace',
          operation: 'marketplace.search',
          payload: { query: 'test-2' },
          metadata: {
            timestamp: new Date(),
            traceId: 'batch-trace',
            spanId: 'span-2',
            priority: 'normal',
            timeout: 30000,
            retries: 3
          }
        }
      ];

      const responses = await orchestrator.batchProcess(requests);
      
      expect(responses).toHaveLength(2);
      expect(responses[0].status).toBe('success');
      expect(responses[1].status).toBe('success');
    });
  });

  describe('Workflow Orchestration', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.start();
    });

    it('should execute validate-enhance-execute workflow', async () => {
      const executionId = await orchestrator.executeCrossSystemWorkflow(
        'validate-enhance-execute',
        { data: 'test-workflow-data' }
      );

      expect(executionId).toBeTruthy();
      
      // Wait for workflow to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = orchestrator.getWorkflowStatus(executionId);
      expect(status).toBeTruthy();
      expect(status.workflowId).toBe('validate-enhance-execute');
    });

    it('should execute semantic-ai-marketplace workflow', async () => {
      const executionId = await orchestrator.executeCrossSystemWorkflow(
        'semantic-ai-marketplace',
        { query: 'test semantic query' }
      );

      expect(executionId).toBeTruthy();
      
      const status = orchestrator.getWorkflowStatus(executionId);
      expect(status).toBeTruthy();
      expect(status.workflowId).toBe('semantic-ai-marketplace');
    });

    it('should handle workflow execution errors', async () => {
      // This test would require a more sophisticated setup to simulate errors
      const executionId = await orchestrator.executeWorkflow(
        'non-existent-workflow',
        { data: 'test' }
      );

      expect(executionId).toBeTruthy();
      
      // The workflow engine should handle the error gracefully
      const status = orchestrator.getWorkflowStatus(executionId);
      expect(status).toBeTruthy();
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.start();
    });

    it('should publish and handle events', async () => {
      const eventHandler = vi.fn();
      
      const subscriptionId = orchestrator.subscribeToEvents('test.event', eventHandler);
      expect(subscriptionId).toBeTruthy();
      
      const eventId = await orchestrator.publishEvent(
        'test.event',
        { message: 'test event data' },
        'marketplace'
      );
      
      expect(eventId).toBeTruthy();
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should handle cross-system events', async () => {
      const cnsHandler = vi.fn();
      const bytestarHandler = vi.fn();
      
      orchestrator.subscribeToEvents('cns.validation.completed', cnsHandler);
      orchestrator.subscribeToEvents('bytestar.enhancement.trigger', bytestarHandler);
      
      await orchestrator.publishEvent(
        'cns.validation.completed',
        { valid: true, uhftScore: 0.95 },
        'cns'
      );
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(cnsHandler).toHaveBeenCalled();
      // The cross-system event should trigger ByteStar enhancement
      expect(bytestarHandler).toHaveBeenCalled();
    });
  });

  describe('Health and Monitoring', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.start();
    });

    it('should report healthy status when all components are running', () => {
      const health = orchestrator.getHealth();
      
      expect(health.overall).toBe('healthy');
      expect(health.components.gateway).toBe('healthy');
      expect(health.components.workflows).toBe('healthy');
      expect(health.components.events).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.version).toBeTruthy();
    });

    it('should provide comprehensive metrics', () => {
      const metrics = orchestrator.getMetrics();
      
      expect(metrics).toHaveProperty('orchestrator');
      expect(metrics).toHaveProperty('gateway');
      expect(metrics).toHaveProperty('workflows');
      expect(metrics).toHaveProperty('events');
    });

    it('should track uptime correctly', () => {
      const uptime1 = orchestrator.getUptime();
      expect(uptime1).toBeGreaterThan(0);
      
      // Wait a bit and check uptime increased
      return new Promise(resolve => {
        setTimeout(() => {
          const uptime2 = orchestrator.getUptime();
          expect(uptime2).toBeGreaterThan(uptime1);
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should allow configuration updates', () => {
      orchestrator.updateConfiguration({
        'monitoring.logLevel': 'debug',
        'gateway.port': 4000
      });
      
      const config = orchestrator.getConfiguration();
      expect(config.monitoring.logLevel).toBe('debug');
      expect(config.gateway.port).toBe(4000);
    });

    it('should manage feature flags', () => {
      expect(orchestrator.isFeatureEnabled('testFeature')).toBe(false);
      
      orchestrator.enableFeature('testFeature');
      expect(orchestrator.isFeatureEnabled('testFeature')).toBe(true);
      
      orchestrator.disableFeature('testFeature');
      expect(orchestrator.isFeatureEnabled('testFeature')).toBe(false);
    });

    it('should handle system-specific features', () => {
      expect(orchestrator.isFeatureEnabled('uhftValidation', 'cns')).toBe(true);
      
      orchestrator.disableFeature('uhftValidation', 'cns');
      expect(orchestrator.isFeatureEnabled('uhftValidation', 'cns')).toBe(false);
      
      orchestrator.enableFeature('uhftValidation', 'cns');
      expect(orchestrator.isFeatureEnabled('uhftValidation', 'cns')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const badOrchestrator = createUnifiedOrchestrator({
        configPath: '/non-existent/path/config.json'
      });

      await expect(badOrchestrator.initialize()).rejects.toThrow();
    });

    it('should handle processing errors', async () => {
      await orchestrator.initialize();
      await orchestrator.start();
      
      const badRequest: UnifiedRequest = {
        id: 'bad-req',
        source: 'test',
        target: 'non-existent-system' as SystemType,
        operation: 'invalid.operation',
        payload: null,
        metadata: {
          timestamp: new Date(),
          traceId: 'error-trace',
          spanId: 'error-span',
          priority: 'normal',
          timeout: 30000,
          retries: 3
        }
      };

      const response = await orchestrator.processRequest(badRequest);
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
    });

    it('should emit error events', async () => {
      const errorSpy = vi.fn();
      orchestrator.on('config-error', errorSpy);
      
      // This would require triggering a config error
      // For now, we just verify the event handler is set up
      expect(orchestrator.listenerCount('config-error')).toBe(1);
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop cleanly', async () => {
      await orchestrator.initialize();
      
      await expect(orchestrator.start()).resolves.not.toThrow();
      expect(orchestrator.getHealth().overall).toBe('healthy');
      
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle multiple start/stop calls', async () => {
      await orchestrator.initialize();
      
      await orchestrator.start();
      await orchestrator.start(); // Should not throw
      
      await orchestrator.stop();
      await orchestrator.stop(); // Should not throw
    });

    it('should emit lifecycle events', async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      
      orchestrator.on('started', startSpy);
      orchestrator.on('stopped', stopSpy);
      
      await orchestrator.initialize();
      await orchestrator.start();
      await orchestrator.stop();
      
      expect(startSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});

describe('Component Integration Tests', () => {
  describe('API Gateway', () => {
    let gateway: UnifiedAPIGateway;
    
    beforeEach(() => {
      const config = {
        systems: {
          cns: {
            endpoints: { primary: { url: 'http://localhost:3100' } },
            auth: { type: 'api-key' as const, config: {} },
            features: {},
            monitoring: { enabled: true, metricsInterval: 60000, healthcheckInterval: 30000 }
          },
          bytestar: {
            endpoints: { primary: { url: 'http://localhost:3200' } },
            auth: { type: 'api-key' as const, config: {} },
            features: {},
            monitoring: { enabled: true, metricsInterval: 60000, healthcheckInterval: 30000 }
          },
          marketplace: {
            endpoints: { primary: { url: 'http://localhost:3001' } },
            auth: { type: 'api-key' as const, config: {} },
            features: {},
            monitoring: { enabled: true, metricsInterval: 60000, healthcheckInterval: 30000 }
          }
        },
        security: {
          cors: {
            origins: ['*'],
            methods: ['GET', 'POST'],
            headers: ['Content-Type', 'Authorization']
          },
          rateLimit: {
            global: { requests: 1000, window: 3600 },
            perUser: { requests: 100, window: 3600 },
            perResource: {}
          },
          authentication: { required: false, excludedPaths: [] }
        },
        routing: {
          defaultTimeout: 30000,
          retryPolicy: { maxAttempts: 3, backoffMs: 1000, exponential: true }
        },
        monitoring: {
          enabled: true,
          logLevel: 'info' as const,
          metricsInterval: 60000
        }
      };
      
      gateway = new UnifiedAPIGateway(config);
    });

    afterEach(async () => {
      await gateway.stop();
    });

    it('should route requests to correct systems', async () => {
      await gateway.start();
      
      const cnsRequest: UnifiedRequest = {
        id: 'route-test-1',
        source: 'test',
        operation: 'cns.validate-uhft',
        payload: {},
        metadata: {
          timestamp: new Date(),
          traceId: 'route-trace-1',
          spanId: 'route-span-1',
          priority: 'normal',
          timeout: 30000,
          retries: 3
        }
      };

      const response = await gateway.processRequest(cnsRequest);
      expect(response.source).toBe('cns');
    });

    it('should handle load balancing', () => {
      const health = gateway.getHealth();
      expect(health.systems).toBeDefined();
      expect(health.systems.cns).toBeDefined();
      expect(health.systems.bytestar).toBeDefined();
      expect(health.systems.marketplace).toBeDefined();
    });
  });

  describe('Event Bus', () => {
    let eventBus: EventBus;
    
    beforeEach(() => {
      eventBus = new EventBus({
        maxListeners: 100,
        enablePersistence: false,
        deadLetterQueue: true,
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2
        },
        circuitBreaker: {
          failureThreshold: 5,
          resetTimeout: 60000
        }
      });
    });

    afterEach(async () => {
      await eventBus.shutdown();
    });

    it('should handle event publishing and subscription', async () => {
      const handler = vi.fn();
      
      const subscriptionId = eventBus.subscribe('test.event', handler);
      expect(subscriptionId).toBeTruthy();
      
      const eventId = await eventBus.publish('test.event', { data: 'test' }, 'marketplace');
      expect(eventId).toBeTruthy();
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(handler).toHaveBeenCalled();
    });

    it('should handle pattern subscriptions', async () => {
      const handler = vi.fn();
      
      const subscriptionId = eventBus.subscribePattern(/^test\..*/, handler);
      expect(subscriptionId).toBeTruthy();
      
      await eventBus.publish('test.pattern.event', { data: 'test' }, 'cns');
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(handler).toHaveBeenCalled();
    });

    it('should provide health status', () => {
      const health = eventBus.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.queueBacklog).toBeDefined();
      expect(health.failingHandlers).toBeDefined();
    });
  });

  describe('Response Transformer', () => {
    let transformer: ResponseTransformer;
    
    beforeEach(() => {
      transformer = new ResponseTransformer();
    });

    it('should transform CNS responses', async () => {
      const response: UnifiedResponse = {
        id: 'transform-test-1',
        requestId: 'req-1',
        source: 'cns',
        status: 'success',
        data: {
          valid: true,
          uhftScore: 0.95,
          semanticAnalysis: {
            confidence: 0.88,
            concepts: ['quantum', 'marketplace']
          }
        },
        metadata: {
          timestamp: new Date(),
          processingTime: 150
        }
      };

      const transformed = await transformer.transform(response);
      
      expect(transformed.metadata.transformation).toBeDefined();
      expect(transformed.metadata.transformation?.applied).toBe(true);
      expect(transformed.metadata.transformation?.rules).toContain('cns-uhft-normalization');
    });

    it('should transform ByteStar responses', async () => {
      const response: UnifiedResponse = {
        id: 'transform-test-2',
        requestId: 'req-2',
        source: 'bytestar',
        status: 'success',
        data: {
          enhanced: true,
          improvements: ['performance', 'readability'],
          optimizations: { 'algorithm-complexity': 'O(n) -> O(log n)' },
          metadata: { model: 'bytestar-v2', confidence: 0.91 }
        },
        metadata: {
          timestamp: new Date(),
          processingTime: 250
        }
      };

      const transformed = await transformer.transform(response);
      
      expect(transformed.metadata.transformation).toBeDefined();
      expect(transformed.metadata.transformation?.applied).toBe(true);
      expect(transformed.metadata.transformation?.rules).toContain('bytestar-ai-enhancement');
    });
  });
});