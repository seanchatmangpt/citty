import { EventEmitter } from 'events';
import { Event, EventSchema, SystemType } from '../types/orchestration';
import { Logger } from '../monitoring/logger';

interface EventBusConfig {
  maxListeners: number;
  enablePersistence: boolean;
  persistencePath?: string;
  deadLetterQueue: boolean;
  retryPolicy: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
  };
}

interface EventHandler {
  id: string;
  pattern: string | RegExp;
  handler: (event: Event) => Promise<void> | void;
  options: {
    retry?: boolean;
    priority?: number;
    timeout?: number;
    deadLetterQueue?: boolean;
  };
  metadata: {
    system?: SystemType;
    createdAt: Date;
    lastExecuted?: Date;
    executionCount: number;
    failureCount: number;
  };
}

interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  active: boolean;
  createdAt: Date;
}

interface DeadLetterEvent {
  originalEvent: Event;
  error: string;
  retryCount: number;
  timestamp: Date;
  handlerId: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure?: Date;
  state: 'closed' | 'open' | 'half-open';
}

export class EventBus extends EventEmitter {
  private config: EventBusConfig;
  private logger: Logger;
  private handlers: Map<string, EventHandler> = new Map();
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventQueue: Event[] = [];
  private deadLetterQueue: DeadLetterEvent[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private processing = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: EventBusConfig) {
    super();
    this.config = {
      maxListeners: 100,
      ...config
    };
    this.logger = new Logger('info');
    this.setMaxListeners(this.config.maxListeners);
    this.startProcessing();
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.processEventQueue();
    }, 100);
  }

  private async processEventQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error('Error processing event queue:', error as Error);
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: Event): Promise<void> {
    const subscriptions = this.subscriptions.get(event.type) || [];
    const matchingHandlers = this.findMatchingHandlers(event);

    // Combine direct subscriptions and pattern-based handlers
    const allHandlers = [
      ...subscriptions.map(s => s.handler),
      ...matchingHandlers
    ];

    // Sort by priority
    allHandlers.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Execute handlers concurrently
    const promises = allHandlers.map(handler => this.executeHandler(handler, event));
    await Promise.allSettled(promises);
  }

  private findMatchingHandlers(event: Event): EventHandler[] {
    const matching: EventHandler[] = [];

    for (const handler of this.handlers.values()) {
      if (this.matchesPattern(event.type, handler.pattern)) {
        matching.push(handler);
      }
    }

    return matching;
  }

  private matchesPattern(eventType: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      // Support wildcards
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(eventType);
      }
      return eventType === pattern;
    }
    return pattern.test(eventType);
  }

  private async executeHandler(handler: EventHandler, event: Event): Promise<void> {
    const circuitBreaker = this.getCircuitBreaker(handler.id);
    
    if (circuitBreaker.state === 'open') {
      if (!this.shouldRetryCircuitBreaker(circuitBreaker)) {
        this.logger.warn(`Circuit breaker open for handler ${handler.id}, skipping event`);
        return;
      }
      circuitBreaker.state = 'half-open';
    }

    try {
      // Apply timeout if specified
      const handlerPromise = handler.handler(event);
      
      let result: any;
      if (handler.options.timeout) {
        result = await Promise.race([
          handlerPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), handler.options.timeout)
          )
        ]);
      } else {
        result = await handlerPromise;
      }

      // Success
      handler.metadata.lastExecuted = new Date();
      handler.metadata.executionCount++;
      
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        circuitBreaker.failures = 0;
      }

      this.emit('handler-success', { handler: handler.id, event: event.id });

    } catch (error) {
      handler.metadata.failureCount++;
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = new Date();

      if (circuitBreaker.failures >= this.config.circuitBreaker.failureThreshold) {
        circuitBreaker.state = 'open';
      }

      this.logger.error(`Handler ${handler.id} failed for event ${event.id}:`, error as Error);
      this.emit('handler-error', { handler: handler.id, event: event.id, error });

      // Handle retry logic
      if (handler.options.retry) {
        await this.retryHandler(handler, event, error as Error);
      } else if (handler.options.deadLetterQueue) {
        this.sendToDeadLetterQueue(event, handler.id, error as Error, 0);
      }
    }
  }

  private getCircuitBreaker(handlerId: string): CircuitBreakerState {
    let breaker = this.circuitBreakers.get(handlerId);
    if (!breaker) {
      breaker = { failures: 0, state: 'closed' };
      this.circuitBreakers.set(handlerId, breaker);
    }
    return breaker;
  }

  private shouldRetryCircuitBreaker(breaker: CircuitBreakerState): boolean {
    if (!breaker.lastFailure) return true;
    
    const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
    return timeSinceLastFailure > this.config.circuitBreaker.resetTimeout;
  }

  private async retryHandler(handler: EventHandler, event: Event, error: Error, attempt: number = 1): Promise<void> {
    const maxRetries = this.config.retryPolicy.maxRetries;
    
    if (attempt > maxRetries) {
      this.logger.error(`Handler ${handler.id} failed after ${maxRetries} retries`);
      if (handler.options.deadLetterQueue) {
        this.sendToDeadLetterQueue(event, handler.id, error, attempt);
      }
      return;
    }

    const delay = Math.min(
      this.config.retryPolicy.initialDelay * Math.pow(this.config.retryPolicy.backoffMultiplier, attempt - 1),
      this.config.retryPolicy.maxDelay
    );

    this.logger.info(`Retrying handler ${handler.id} in ${delay}ms (attempt ${attempt})`);

    setTimeout(async () => {
      try {
        await handler.handler(event);
        handler.metadata.lastExecuted = new Date();
        handler.metadata.executionCount++;
        this.emit('handler-retry-success', { handler: handler.id, event: event.id, attempt });
      } catch (retryError) {
        await this.retryHandler(handler, event, retryError as Error, attempt + 1);
      }
    }, delay);
  }

  private sendToDeadLetterQueue(event: Event, handlerId: string, error: Error, retryCount: number): void {
    if (!this.config.deadLetterQueue) return;

    const deadLetterEvent: DeadLetterEvent = {
      originalEvent: event,
      error: error.message,
      retryCount,
      timestamp: new Date(),
      handlerId
    };

    this.deadLetterQueue.push(deadLetterEvent);
    this.emit('dead-letter-event', deadLetterEvent);

    // Keep dead letter queue manageable
    if (this.deadLetterQueue.length > 1000) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-500);
    }
  }

  // Public API methods

  async publish(eventType: string, data: any, source: SystemType, metadata?: Partial<Event['metadata']>): Promise<string> {
    const event: Event = {
      id: this.generateId(),
      type: eventType,
      source,
      timestamp: new Date(),
      data,
      metadata: {
        version: '1.0',
        ...metadata
      }
    };

    // Validate event schema
    const validatedEvent = EventSchema.parse(event);
    
    this.eventQueue.push(validatedEvent);
    this.emit('event-published', validatedEvent);
    
    this.logger.debug(`Event published: ${eventType}`, {
      eventId: validatedEvent.id,
      source: validatedEvent.source
    });

    return validatedEvent.id;
  }

  subscribe(eventType: string, handler: (event: Event) => Promise<void> | void, options?: {
    retry?: boolean;
    priority?: number;
    timeout?: number;
    deadLetterQueue?: boolean;
    system?: SystemType;
  }): string {
    const handlerId = this.generateId();
    const eventHandler: EventHandler = {
      id: handlerId,
      pattern: eventType,
      handler,
      options: options || {},
      metadata: {
        system: options?.system,
        createdAt: new Date(),
        executionCount: 0,
        failureCount: 0
      }
    };

    this.handlers.set(handlerId, eventHandler);

    // Also add to direct subscriptions for exact matches
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    const subscription: EventSubscription = {
      id: this.generateId(),
      eventType,
      handler: eventHandler,
      active: true,
      createdAt: new Date()
    };

    this.subscriptions.get(eventType)!.push(subscription);

    this.emit('subscription-created', { handlerId, eventType, system: options?.system });
    return handlerId;
  }

  subscribePattern(pattern: string | RegExp, handler: (event: Event) => Promise<void> | void, options?: {
    retry?: boolean;
    priority?: number;
    timeout?: number;
    deadLetterQueue?: boolean;
    system?: SystemType;
  }): string {
    const handlerId = this.generateId();
    const eventHandler: EventHandler = {
      id: handlerId,
      pattern,
      handler,
      options: options || {},
      metadata: {
        system: options?.system,
        createdAt: new Date(),
        executionCount: 0,
        failureCount: 0
      }
    };

    this.handlers.set(handlerId, eventHandler);
    this.emit('pattern-subscription-created', { handlerId, pattern, system: options?.system });
    return handlerId;
  }

  unsubscribe(handlerId: string): boolean {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      return false;
    }

    // Remove from handlers
    this.handlers.delete(handlerId);

    // Remove from direct subscriptions
    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.handler.id === handlerId);
      if (index !== -1) {
        subscriptions.splice(index, 1);
        if (subscriptions.length === 0) {
          this.subscriptions.delete(eventType);
        }
        break;
      }
    }

    // Remove circuit breaker
    this.circuitBreakers.delete(handlerId);

    this.emit('subscription-removed', { handlerId });
    return true;
  }

  // Cross-system event methods

  publishCrossSystem(eventType: string, data: any, targetSystems: SystemType[], metadata?: Partial<Event['metadata']>): Promise<string[]> {
    const promises = targetSystems.map(system => 
      this.publish(`${system}.${eventType}`, data, 'marketplace', {
        ...metadata,
        targetSystem: system
      })
    );
    
    return Promise.all(promises);
  }

  subscribeSystemEvent(system: SystemType, eventType: string, handler: (event: Event) => Promise<void> | void, options?: {
    retry?: boolean;
    priority?: number;
    timeout?: number;
  }): string {
    const fullEventType = `${system}.${eventType}`;
    return this.subscribe(fullEventType, handler, { ...options, system });
  }

  // Workflow integration
  publishWorkflowEvent(workflowId: string, stepId: string, status: 'started' | 'completed' | 'failed', data?: any): Promise<string> {
    return this.publish('workflow.step', {
      workflowId,
      stepId,
      status,
      data
    }, 'marketplace', {
      workflowId,
      stepId
    });
  }

  subscribeWorkflowEvents(workflowId: string, handler: (event: Event) => Promise<void> | void): string {
    return this.subscribePattern(/^workflow\.(step|completed|failed)$/, (event) => {
      if (event.metadata.workflowId === workflowId) {
        handler(event);
      }
    }, {
      system: 'marketplace',
      priority: 10
    });
  }

  // Management and monitoring methods

  getStats(): {
    handlers: number;
    subscriptions: number;
    queueLength: number;
    deadLetterCount: number;
    circuitBreakersOpen: number;
    processedEvents: number;
  } {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.length;
    }

    let openBreakers = 0;
    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.state === 'open') openBreakers++;
    }

    let totalProcessed = 0;
    for (const handler of this.handlers.values()) {
      totalProcessed += handler.metadata.executionCount;
    }

    return {
      handlers: this.handlers.size,
      subscriptions: totalSubscriptions,
      queueLength: this.eventQueue.length,
      deadLetterCount: this.deadLetterQueue.length,
      circuitBreakersOpen: openBreakers,
      processedEvents: totalProcessed
    };
  }

  getHandlerStats(handlerId: string): EventHandler | null {
    return this.handlers.get(handlerId) || null;
  }

  getDeadLetterEvents(): DeadLetterEvent[] {
    return [...this.deadLetterQueue];
  }

  reprocessDeadLetterEvent(deadLetterEventId: number): boolean {
    const deadEvent = this.deadLetterQueue[deadLetterEventId];
    if (!deadEvent) return false;

    this.eventQueue.push(deadEvent.originalEvent);
    this.deadLetterQueue.splice(deadLetterEventId, 1);
    
    this.emit('dead-letter-reprocessed', deadEvent);
    return true;
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
    this.emit('dead-letter-cleared');
  }

  // Health and diagnostics
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    queueBacklog: number;
    failingHandlers: number;
    openCircuitBreakers: number;
    deadLetterBacklog: number;
  } {
    const stats = this.getStats();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let failingHandlers = 0;

    for (const handler of this.handlers.values()) {
      const failureRate = handler.metadata.executionCount > 0 ? 
        handler.metadata.failureCount / handler.metadata.executionCount : 0;
      
      if (failureRate > 0.5) failingHandlers++;
    }

    if (stats.queueLength > 1000 || stats.circuitBreakersOpen > 5 || failingHandlers > 10) {
      status = 'unhealthy';
    } else if (stats.queueLength > 100 || stats.circuitBreakersOpen > 0 || failingHandlers > 0) {
      status = 'degraded';
    }

    return {
      status,
      queueBacklog: stats.queueLength,
      failingHandlers,
      openCircuitBreakers: stats.circuitBreakersOpen,
      deadLetterBacklog: stats.deadLetterCount
    };
  }

  // Shutdown
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining events
    await this.processEventQueue();

    // Clear all data structures
    this.handlers.clear();
    this.subscriptions.clear();
    this.eventQueue.length = 0;
    this.circuitBreakers.clear();

    this.emit('shutdown');
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}