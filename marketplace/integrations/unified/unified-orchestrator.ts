import { EventEmitter } from 'events';
import { UnifiedAPIGateway, createUnifiedGateway } from './gateway/api-gateway';
import { WorkflowEngine } from './orchestrator/workflow-engine';
import { EventBus } from './messaging/event-bus';
import { ConfigManager, configManager } from './config/config-manager';
import { Logger } from './monitoring/logger';
import { MetricsCollector } from './monitoring/metrics-collector';
import { AuthenticationService } from './auth/auth-service';
import { 
  UnifiedRequest, 
  UnifiedResponse, 
  SystemType, 
  Event,
  Workflow,
  CrossSystemWorkflow 
} from './types/orchestration';

interface OrchestrationOptions {
  configPath?: string;
  environment?: 'development' | 'staging' | 'production';
  enableMetrics?: boolean;
  enableWorkflows?: boolean;
  enableEvents?: boolean;
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    gateway: 'healthy' | 'degraded' | 'unhealthy';
    workflows: 'healthy' | 'degraded' | 'unhealthy';
    events: 'healthy' | 'degraded' | 'unhealthy';
    systems: Record<SystemType, 'healthy' | 'degraded' | 'unhealthy'>;
  };
  uptime: number;
  version: string;
  timestamp: Date;
}

export class UnifiedOrchestrator extends EventEmitter {
  private config: ConfigManager;
  private logger: Logger;
  private metrics?: MetricsCollector;
  private gateway?: UnifiedAPIGateway;
  private workflowEngine?: WorkflowEngine;
  private eventBus?: EventBus;
  private auth?: AuthenticationService;
  private startTime: Date;
  private isRunning: boolean = false;
  private options: OrchestrationOptions;

  constructor(options: OrchestrationOptions = {}) {
    super();
    this.options = {
      environment: 'development',
      enableMetrics: true,
      enableWorkflows: true,
      enableEvents: true,
      ...options
    };

    this.config = configManager;
    this.logger = new Logger('info');
    this.startTime = new Date();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.config.on('config-changed', (event) => {
      this.logger.info('Configuration changed, reloading components');
      this.emit('config-changed', event);
    });

    this.config.on('config-reload-error', (event) => {
      this.logger.error('Configuration reload failed:', event.error);
      this.emit('config-error', event);
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Unified Orchestrator...');

      // Load configuration
      await this.loadConfiguration();

      // Initialize metrics collector
      if (this.options.enableMetrics) {
        await this.initializeMetrics();
      }

      // Initialize authentication
      await this.initializeAuth();

      // Initialize event bus
      if (this.options.enableEvents) {
        await this.initializeEventBus();
      }

      // Initialize workflow engine
      if (this.options.enableWorkflows) {
        await this.initializeWorkflowEngine();
      }

      // Initialize API gateway
      await this.initializeGateway();

      this.logger.info('Unified Orchestrator initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Failed to initialize Unified Orchestrator:', error as Error);
      this.emit('initialization-error', error);
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    // Load from file if specified
    if (this.options.configPath) {
      await this.config.loadFromFile(this.options.configPath);
    }

    // Load from environment variables
    await this.config.loadFromEnvironment();

    // Set environment if specified
    if (this.options.environment) {
      this.config.set('environment', this.options.environment);
    }

    // Update logger level from config
    const logLevel = this.config.getPath<string>('monitoring.logLevel');
    this.logger.setLevel(logLevel as any);
  }

  private async initializeMetrics(): Promise<void> {
    const metricsConfig = this.config.getPath('monitoring');
    this.metrics = new MetricsCollector(metricsConfig);
    await this.metrics.start();
    
    this.logger.info('Metrics collector initialized');
  }

  private async initializeAuth(): Promise<void> {
    const authConfig = this.config.getPath('authentication');
    this.auth = new AuthenticationService(authConfig);
    await this.auth.initialize();
    
    this.logger.info('Authentication service initialized');
  }

  private async initializeEventBus(): Promise<void> {
    const eventConfig = this.config.getPath('eventBus');
    this.eventBus = new EventBus(eventConfig);
    
    // Setup cross-system event handlers
    this.setupCrossSystemEvents();
    
    this.logger.info('Event bus initialized');
  }

  private async initializeWorkflowEngine(): Promise<void> {
    if (!this.metrics) {
      throw new Error('Metrics collector must be initialized before workflow engine');
    }

    // Gateway will be initialized after workflow engine
    this.workflowEngine = new WorkflowEngine(this.gateway!, this.metrics);
    await this.workflowEngine.start();
    
    this.logger.info('Workflow engine initialized');
  }

  private async initializeGateway(): Promise<void> {
    const gatewayConfig = this.config.getPath('gateway');
    const systemsConfig = this.config.getPath('systems');
    const authConfig = this.config.getPath('authentication');

    const unifiedGatewayConfig = {
      systems: systemsConfig,
      security: {
        cors: gatewayConfig.cors,
        rateLimit: gatewayConfig.rateLimit,
        authentication: authConfig
      },
      routing: {
        defaultTimeout: 30000,
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          exponential: true
        }
      },
      monitoring: {
        enabled: true,
        logLevel: this.config.getPath<string>('monitoring.logLevel') as any,
        metricsInterval: this.config.getPath<number>('monitoring.metricsInterval')
      }
    };

    this.gateway = createUnifiedGateway(unifiedGatewayConfig);
    
    // Update workflow engine with gateway reference if it exists
    if (this.workflowEngine) {
      (this.workflowEngine as any).gateway = this.gateway;
    }

    await this.gateway.start();
    
    this.logger.info('Unified API Gateway initialized');
  }

  private setupCrossSystemEvents(): void {
    if (!this.eventBus) return;

    // CNS system events
    this.eventBus.subscribeSystemEvent('cns', 'validation.completed', async (event) => {
      this.logger.debug('CNS validation completed', { eventId: event.id });
      
      // Trigger ByteStar enhancement if validation succeeded
      if (event.data.valid) {
        await this.eventBus!.publishCrossSystem(
          'enhancement.trigger',
          { validationResult: event.data },
          ['bytestar'],
          { correlation: event.metadata.correlation }
        );
      }
    });

    // ByteStar system events
    this.eventBus.subscribeSystemEvent('bytestar', 'enhancement.completed', async (event) => {
      this.logger.debug('ByteStar enhancement completed', { eventId: event.id });
      
      // Trigger Marketplace operations
      await this.eventBus!.publishCrossSystem(
        'operation.trigger',
        { enhancementResult: event.data },
        ['marketplace'],
        { correlation: event.metadata.correlation }
      );
    });

    // Workflow events
    this.eventBus.subscribePattern(/^workflow\./, async (event) => {
      this.logger.debug('Workflow event received', { 
        type: event.type,
        workflowId: event.metadata.workflowId 
      });

      if (this.metrics) {
        this.metrics.recordMetric('workflow.events.total', 1, 'counter', {
          type: event.type,
          source: event.source
        });
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Orchestrator is already running');
      return;
    }

    try {
      if (!this.gateway) {
        throw new Error('Orchestrator must be initialized before starting');
      }

      this.isRunning = true;
      this.logger.info('Starting Unified Orchestrator...');

      // All components should already be started during initialization
      
      this.logger.info(`Unified Orchestrator started successfully on environment: ${this.config.getPath('environment')}`);
      this.emit('started');

    } catch (error) {
      this.isRunning = false;
      this.logger.error('Failed to start Unified Orchestrator:', error as Error);
      this.emit('start-error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('Stopping Unified Orchestrator...');

      // Stop components in reverse order
      if (this.gateway) {
        await this.gateway.stop();
      }

      if (this.workflowEngine) {
        await this.workflowEngine.stop();
      }

      if (this.eventBus) {
        await this.eventBus.shutdown();
      }

      if (this.metrics) {
        await this.metrics.stop();
      }

      this.isRunning = false;
      this.logger.info('Unified Orchestrator stopped');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping Unified Orchestrator:', error as Error);
      this.emit('stop-error', error);
      throw error;
    }
  }

  // Request processing
  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    if (!this.gateway) {
      throw new Error('Gateway not initialized');
    }

    return await this.gateway.processRequest(request);
  }

  // Workflow operations
  async executeWorkflow(workflowId: string, input: any, metadata?: any): Promise<string> {
    if (!this.workflowEngine) {
      throw new Error('Workflow engine not initialized');
    }

    return await this.workflowEngine.executeWorkflow(workflowId, input, metadata);
  }

  async executeCrossSystemWorkflow(
    workflow: CrossSystemWorkflow,
    input: any,
    metadata?: any
  ): Promise<string> {
    if (!this.workflowEngine) {
      throw new Error('Workflow engine not initialized');
    }

    // Map cross-system workflow types to internal workflow IDs
    const workflowMap: Record<CrossSystemWorkflow, string> = {
      'validate-enhance-execute': 'validate-enhance-execute',
      'semantic-ai-marketplace': 'semantic-ai-marketplace',
      'uhft-analysis-optimization': 'uhft-analysis-optimization',
      'end-to-end-processing': 'validate-enhance-execute' // Default to full pipeline
    };

    const workflowId = workflowMap[workflow];
    return await this.workflowEngine.executeWorkflow(workflowId, input, metadata);
  }

  getWorkflowStatus(executionId: string): any {
    if (!this.workflowEngine) {
      throw new Error('Workflow engine not initialized');
    }

    return this.workflowEngine.getExecution(executionId);
  }

  // Event operations
  async publishEvent(eventType: string, data: any, source: SystemType, metadata?: any): Promise<string> {
    if (!this.eventBus) {
      throw new Error('Event bus not initialized');
    }

    return await this.eventBus.publish(eventType, data, source, metadata);
  }

  subscribeToEvents(eventType: string, handler: (event: Event) => void): string {
    if (!this.eventBus) {
      throw new Error('Event bus not initialized');
    }

    return this.eventBus.subscribe(eventType, handler);
  }

  // Health and monitoring
  getHealth(): HealthStatus {
    const gatewayHealth = this.gateway?.getHealth();
    const workflowHealth = this.workflowEngine ? { status: 'healthy' } : { status: 'unhealthy' };
    const eventHealth = this.eventBus?.healthCheck();
    
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!gatewayHealth || gatewayHealth.status === 'down') {
      overallHealth = 'unhealthy';
    } else if (workflowHealth.status !== 'healthy' || eventHealth?.status !== 'healthy') {
      overallHealth = 'degraded';
    }

    return {
      overall: overallHealth,
      components: {
        gateway: gatewayHealth?.status === 'healthy' ? 'healthy' : 'unhealthy',
        workflows: workflowHealth.status as any,
        events: eventHealth?.status || 'unhealthy',
        systems: gatewayHealth?.systems || {} as any
      },
      uptime: Date.now() - this.startTime.getTime(),
      version: this.config.getPath('version'),
      timestamp: new Date()
    };
  }

  getMetrics(): any {
    if (!this.metrics) {
      return { error: 'Metrics not enabled' };
    }

    return {
      orchestrator: this.metrics.getMetrics(),
      gateway: this.gateway?.getMetrics(),
      workflows: this.workflowEngine ? {
        executions: this.workflowEngine.listExecutions().length,
        workflows: this.workflowEngine.listWorkflows().length
      } : null,
      events: this.eventBus?.getStats()
    };
  }

  // Configuration management
  updateConfiguration(updates: any): void {
    for (const [path, value] of Object.entries(updates)) {
      this.config.set(path, value);
    }
  }

  getConfiguration(): any {
    return this.config.get();
  }

  // Feature flags
  isFeatureEnabled(feature: string, system?: SystemType): boolean {
    return this.config.isFeatureEnabled(feature, system);
  }

  enableFeature(feature: string, system?: SystemType): void {
    this.config.enableFeature(feature, system);
  }

  disableFeature(feature: string, system?: SystemType): void {
    this.config.disableFeature(feature, system);
  }

  // System management
  async addSystem(system: SystemType, config: any): Promise<void> {
    this.config.updateSystemConfig(system, config);
    
    if (this.gateway) {
      // Restart gateway to pick up new system configuration
      await this.gateway.stop();
      await this.initializeGateway();
    }
  }

  // Utility methods
  getVersion(): string {
    return this.config.getPath('version');
  }

  getEnvironment(): string {
    return this.config.getPath('environment');
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  // Advanced operations
  async executeComplexWorkflow(
    steps: Array<{ system: SystemType; operation: string; data: any }>,
    metadata?: any
  ): Promise<any[]> {
    if (!this.gateway) {
      throw new Error('Gateway not initialized');
    }

    const results: any[] = [];
    
    for (const step of steps) {
      const request: UnifiedRequest = {
        id: this.generateId(),
        source: 'orchestrator',
        target: step.system,
        operation: step.operation,
        payload: step.data,
        metadata: {
          timestamp: new Date(),
          traceId: this.generateTraceId(),
          spanId: this.generateId(),
          priority: 'normal',
          timeout: 30000,
          retries: 3,
          ...metadata
        }
      };

      const response = await this.gateway.processRequest(request);
      results.push(response);

      // Stop if any step fails
      if (response.status === 'error') {
        break;
      }
    }

    return results;
  }

  async batchProcess(requests: UnifiedRequest[]): Promise<UnifiedResponse[]> {
    if (!this.gateway) {
      throw new Error('Gateway not initialized');
    }

    const promises = requests.map(request => this.gateway!.processRequest(request));
    const results = await Promise.allSettled(promises);

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        id: this.generateId(),
        requestId: 'unknown',
        source: 'orchestrator',
        status: 'error',
        error: {
          code: 'BATCH_PROCESSING_ERROR',
          message: (result as any).reason?.message || 'Unknown error',
          retryable: false
        },
        metadata: {
          timestamp: new Date(),
          processingTime: 0
        }
      } as UnifiedResponse
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateTraceId(): string {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }
}

// Factory function for creating orchestrator instance
export function createUnifiedOrchestrator(options?: OrchestrationOptions): UnifiedOrchestrator {
  return new UnifiedOrchestrator(options);
}

// Default instance
export const orchestrator = new UnifiedOrchestrator();