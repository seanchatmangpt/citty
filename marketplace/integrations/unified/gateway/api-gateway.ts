import { z } from 'zod';
import { EventEmitter } from 'events';
import { 
  UnifiedRequest, 
  UnifiedResponse, 
  SystemType, 
  SystemConfig,
  AuthContext,
  RateLimit,
  UnifiedRequestSchema,
  UnifiedResponseSchema,
  AuthContextSchema,
  RateLimitSchema
} from '../types/orchestration';
import { AuthenticationService } from '../auth/auth-service';
import { RateLimiter } from '../auth/rate-limiter';
import { LoadBalancer } from './load-balancer';
import { CircuitBreaker } from './circuit-breaker';
import { RequestRouter } from './request-router';
import { ResponseTransformer } from '../transformations/response-transformer';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { Logger } from '../monitoring/logger';

interface GatewayConfig {
  systems: Record<SystemType, SystemConfig>;
  security: {
    cors: {
      origins: string[];
      methods: string[];
      headers: string[];
    };
    rateLimit: {
      global: { requests: number; window: number };
      perUser: { requests: number; window: number };
      perResource: Record<string, { requests: number; window: number }>;
    };
    authentication: {
      required: boolean;
      excludedPaths: string[];
    };
  };
  routing: {
    defaultTimeout: number;
    retryPolicy: {
      maxAttempts: number;
      backoffMs: number;
      exponential: boolean;
    };
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsInterval: number;
  };
}

export class UnifiedAPIGateway extends EventEmitter {
  private config: GatewayConfig;
  private auth: AuthenticationService;
  private rateLimiter: RateLimiter;
  private loadBalancer: LoadBalancer;
  private circuitBreaker: CircuitBreaker;
  private router: RequestRouter;
  private responseTransformer: ResponseTransformer;
  private metrics: MetricsCollector;
  private logger: Logger;
  private isRunning: boolean = false;
  private requestQueue: Map<string, UnifiedRequest> = new Map();

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.auth = new AuthenticationService(this.config.security.authentication);
    this.rateLimiter = new RateLimiter(this.config.security.rateLimit);
    this.loadBalancer = new LoadBalancer(this.config.systems);
    this.circuitBreaker = new CircuitBreaker();
    this.router = new RequestRouter(this.config.systems);
    this.responseTransformer = new ResponseTransformer();
    this.metrics = new MetricsCollector(this.config.monitoring);
    this.logger = new Logger(this.config.monitoring.logLevel);

    // Setup event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.circuitBreaker.on('open', (system: SystemType) => {
      this.logger.warn(`Circuit breaker opened for ${system}`);
      this.emit('circuit-open', { system, timestamp: new Date() });
    });

    this.circuitBreaker.on('close', (system: SystemType) => {
      this.logger.info(`Circuit breaker closed for ${system}`);
      this.emit('circuit-close', { system, timestamp: new Date() });
    });

    this.metrics.on('alert', (alert: any) => {
      this.logger.warn('Metric alert:', alert);
      this.emit('alert', alert);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    try {
      await this.auth.initialize();
      await this.metrics.start();
      
      this.isRunning = true;
      this.logger.info('Unified API Gateway started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start gateway:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.metrics.stop();
      this.isRunning = false;
      this.logger.info('Unified API Gateway stopped');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error stopping gateway:', error);
      throw error;
    }
  }

  async processRequest(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();
    const traceId = request.metadata.traceId;
    
    try {
      this.logger.debug(`Processing request ${request.id}`, { traceId });
      
      // Validate request schema
      const validatedRequest = await this.validateRequest(request);
      
      // Authentication
      const authContext = await this.authenticateRequest(validatedRequest);
      
      // Rate limiting
      await this.checkRateLimit(validatedRequest, authContext);
      
      // Route request to appropriate system
      const targetSystem = this.router.determineTarget(validatedRequest);
      
      // Circuit breaker check
      await this.circuitBreaker.checkAvailability(targetSystem);
      
      // Load balancing
      const endpoint = await this.loadBalancer.selectEndpoint(targetSystem);
      
      // Execute request
      const response = await this.executeRequest(validatedRequest, endpoint, authContext);
      
      // Transform response
      const transformedResponse = await this.responseTransformer.transform(response);
      
      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordRequest(validatedRequest, transformedResponse, processingTime);
      
      this.logger.debug(`Request ${request.id} processed successfully`, { 
        traceId, 
        processingTime 
      });
      
      return transformedResponse;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorResponse = this.createErrorResponse(request, error as Error, processingTime);
      
      this.metrics.recordError(request, error as Error, processingTime);
      this.logger.error(`Request ${request.id} failed:`, error, { traceId });
      
      return errorResponse;
    }
  }

  private async validateRequest(request: any): Promise<UnifiedRequest> {
    try {
      return UnifiedRequestSchema.parse(request);
    } catch (error) {
      throw new Error(`Invalid request schema: ${(error as Error).message}`);
    }
  }

  private async authenticateRequest(request: UnifiedRequest): Promise<AuthContext> {
    if (!this.config.security.authentication.required) {
      return this.createAnonymousContext();
    }

    if (this.isExcludedPath(request.operation)) {
      return this.createAnonymousContext();
    }

    return await this.auth.authenticate(request.security);
  }

  private async checkRateLimit(request: UnifiedRequest, authContext: AuthContext): Promise<void> {
    const identifiers = [
      `global`,
      `user:${authContext.userId || 'anonymous'}`,
      `resource:${request.operation}`,
    ];

    for (const identifier of identifiers) {
      const limit = this.rateLimiter.getLimit(identifier);
      if (limit && await this.rateLimiter.isLimited(identifier)) {
        throw new Error(`Rate limit exceeded for ${identifier}`);
      }
    }
  }

  private async executeRequest(
    request: UnifiedRequest, 
    endpoint: string, 
    authContext: AuthContext
  ): Promise<UnifiedResponse> {
    const system = this.router.determineTarget(request);
    
    try {
      // Add request to queue for monitoring
      this.requestQueue.set(request.id, request);
      
      // Execute based on system type
      let response: UnifiedResponse;
      switch (system) {
        case 'cns':
          response = await this.executeCNSRequest(request, endpoint, authContext);
          break;
        case 'bytestar':
          response = await this.executeBytestarRequest(request, endpoint, authContext);
          break;
        case 'marketplace':
          response = await this.executeMarketplaceRequest(request, endpoint, authContext);
          break;
        default:
          throw new Error(`Unsupported system: ${system}`);
      }
      
      // Remove from queue
      this.requestQueue.delete(request.id);
      
      return response;
      
    } catch (error) {
      this.requestQueue.delete(request.id);
      this.circuitBreaker.recordFailure(system);
      throw error;
    }
  }

  private async executeCNSRequest(
    request: UnifiedRequest, 
    endpoint: string, 
    authContext: AuthContext
  ): Promise<UnifiedResponse> {
    // CNS-specific request execution logic
    const startTime = Date.now();
    
    // Simulate CNS operations
    switch (request.operation) {
      case 'cns.validate-uhft':
        return this.createSuccessResponse(request, {
          valid: true,
          uhftScore: 0.95,
          semanticAnalysis: {
            concepts: ['quantum', 'marketplace', 'optimization'],
            confidence: 0.92
          }
        }, Date.now() - startTime);
        
      case 'cns.semantic-parse':
        return this.createSuccessResponse(request, {
          parsed: true,
          entities: ['product', 'user', 'transaction'],
          relationships: [['product', 'belongs-to', 'user']],
          confidence: 0.88
        }, Date.now() - startTime);
        
      default:
        throw new Error(`Unsupported CNS operation: ${request.operation}`);
    }
  }

  private async executeBytestarRequest(
    request: UnifiedRequest, 
    endpoint: string, 
    authContext: AuthContext
  ): Promise<UnifiedResponse> {
    // ByteStar-specific request execution logic
    const startTime = Date.now();
    
    switch (request.operation) {
      case 'bytestar.ai-enhance':
        return this.createSuccessResponse(request, {
          enhanced: true,
          improvements: ['performance', 'readability', 'efficiency'],
          optimizations: {
            'algorithm-complexity': 'O(n) -> O(log n)',
            'memory-usage': '50% reduction',
            'execution-time': '3x faster'
          }
        }, Date.now() - startTime);
        
      case 'bytestar.generate':
        return this.createSuccessResponse(request, {
          generated: true,
          output: 'AI-generated content based on input parameters',
          metadata: {
            model: 'bytestar-v2',
            confidence: 0.91,
            tokens: 1024
          }
        }, Date.now() - startTime);
        
      default:
        throw new Error(`Unsupported ByteStar operation: ${request.operation}`);
    }
  }

  private async executeMarketplaceRequest(
    request: UnifiedRequest, 
    endpoint: string, 
    authContext: AuthContext
  ): Promise<UnifiedResponse> {
    // Marketplace-specific request execution logic
    const startTime = Date.now();
    
    switch (request.operation) {
      case 'marketplace.search':
        return this.createSuccessResponse(request, {
          results: [
            { id: '1', name: 'Product A', price: 99.99, rating: 4.5 },
            { id: '2', name: 'Product B', price: 149.99, rating: 4.8 }
          ],
          total: 2,
          facets: {
            categories: ['electronics', 'software'],
            priceRanges: ['$50-100', '$100-200']
          }
        }, Date.now() - startTime);
        
      case 'marketplace.purchase':
        return this.createSuccessResponse(request, {
          transactionId: 'txn_' + Math.random().toString(36).substr(2, 9),
          status: 'completed',
          amount: (request.payload as any)?.amount || 0,
          timestamp: new Date().toISOString()
        }, Date.now() - startTime);
        
      default:
        throw new Error(`Unsupported Marketplace operation: ${request.operation}`);
    }
  }

  private createSuccessResponse(
    request: UnifiedRequest, 
    data: any, 
    processingTime: number
  ): UnifiedResponse {
    return {
      id: this.generateId(),
      requestId: request.id,
      source: request.target || request.source,
      status: 'success',
      data,
      metadata: {
        timestamp: new Date(),
        processingTime,
        systemLoad: this.metrics.getCurrentLoad(),
        cacheHit: false
      }
    };
  }

  private createErrorResponse(
    request: UnifiedRequest, 
    error: Error, 
    processingTime: number
  ): UnifiedResponse {
    return {
      id: this.generateId(),
      requestId: request.id,
      source: request.target || request.source,
      status: 'error',
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message,
        details: error.stack,
        retryable: this.isRetryableError(error)
      },
      metadata: {
        timestamp: new Date(),
        processingTime,
        systemLoad: this.metrics.getCurrentLoad()
      }
    };
  }

  private createAnonymousContext(): AuthContext {
    return {
      sessionId: this.generateId(),
      permissions: [],
      roles: ['anonymous'],
      scopes: ['read'],
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  private isExcludedPath(operation: string): boolean {
    return this.config.security.authentication.excludedPaths.includes(operation);
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = ['TIMEOUT', 'CONNECTION_ERROR', 'SERVICE_UNAVAILABLE'];
    return retryableErrors.some(code => error.message.includes(code));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Health and status methods
  getHealth(): { status: string; systems: Record<SystemType, any> } {
    return {
      status: this.isRunning ? 'healthy' : 'down',
      systems: {
        cns: this.circuitBreaker.getStatus('cns'),
        bytestar: this.circuitBreaker.getStatus('bytestar'),
        marketplace: this.circuitBreaker.getStatus('marketplace')
      }
    };
  }

  getMetrics(): any {
    return this.metrics.getMetrics();
  }

  getCurrentLoad(): number {
    return this.requestQueue.size;
  }
}

// Factory function for creating gateway instance
export function createUnifiedGateway(config: GatewayConfig): UnifiedAPIGateway {
  return new UnifiedAPIGateway(config);
}