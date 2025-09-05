import { EventEmitter } from 'events';
import { SystemType } from '../types/orchestration';
import { Logger } from '../monitoring/logger';

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before attempting to close
  monitoringPeriod: number; // Time window for failure counting
  volumeThreshold: number; // Minimum requests before considering failure rate
  errorRate: number; // Error rate threshold (0-1)
}

interface CircuitState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  requestCount: number;
  windowStart: Date;
  totalRequests: number;
  totalFailures: number;
}

interface RequestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export class CircuitBreaker extends EventEmitter {
  private logger: Logger;
  private config: CircuitBreakerConfig;
  private states: Map<SystemType, CircuitState> = new Map();
  private recentRequests: Map<SystemType, RequestResult[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();
    this.logger = new Logger('info');
    
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      volumeThreshold: 10,
      errorRate: 0.5, // 50%
      ...config
    };

    this.initializeSystems();
    this.startMonitoring();
  }

  private initializeSystems(): void {
    const systems: SystemType[] = ['cns', 'bytestar', 'marketplace'];
    
    for (const system of systems) {
      this.states.set(system, {
        status: 'closed',
        failureCount: 0,
        successCount: 0,
        requestCount: 0,
        windowStart: new Date(),
        totalRequests: 0,
        totalFailures: 0
      });
      
      this.recentRequests.set(system, []);
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateStates();
      this.cleanupOldRequests();
    }, 5000); // Check every 5 seconds
  }

  private updateStates(): void {
    for (const [system, state] of this.states.entries()) {
      // Update window if needed
      const now = new Date();
      if (now.getTime() - state.windowStart.getTime() >= this.config.monitoringPeriod) {
        this.resetWindow(system);
      }

      // Check if circuit should transition states
      this.evaluateStateTransition(system);
    }
  }

  private resetWindow(system: SystemType): void {
    const state = this.states.get(system)!;
    state.windowStart = new Date();
    state.requestCount = 0;
    state.failureCount = 0;
    state.successCount = 0;
  }

  private evaluateStateTransition(system: SystemType): void {
    const state = this.states.get(system)!;
    const recentRequests = this.recentRequests.get(system)!;
    
    switch (state.status) {
      case 'closed':
        this.evaluateClosedState(system, state, recentRequests);
        break;
        
      case 'open':
        this.evaluateOpenState(system, state);
        break;
        
      case 'half-open':
        this.evaluateHalfOpenState(system, state);
        break;
    }
  }

  private evaluateClosedState(system: SystemType, state: CircuitState, recentRequests: RequestResult[]): void {
    // Check if we have enough requests to evaluate
    if (state.requestCount < this.config.volumeThreshold) {
      return;
    }

    // Calculate error rate
    const errorRate = state.failureCount / state.requestCount;
    
    // Check failure threshold or error rate
    const shouldOpen = 
      state.failureCount >= this.config.failureThreshold || 
      errorRate >= this.config.errorRate;

    if (shouldOpen) {
      this.openCircuit(system, state);
    }
  }

  private evaluateOpenState(system: SystemType, state: CircuitState): void {
    if (!state.nextAttemptTime) {
      return;
    }

    const now = new Date();
    if (now >= state.nextAttemptTime) {
      this.halfOpenCircuit(system, state);
    }
  }

  private evaluateHalfOpenState(system: SystemType, state: CircuitState): void {
    // Close if we have enough successful requests
    if (state.successCount >= this.config.successThreshold) {
      this.closeCircuit(system, state);
    }
    // Open if we get any failure in half-open state
    else if (state.failureCount > 0) {
      this.openCircuit(system, state);
    }
  }

  private openCircuit(system: SystemType, state: CircuitState): void {
    state.status = 'open';
    state.lastFailureTime = new Date();
    state.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    state.successCount = 0;
    
    this.logger.warn(`Circuit breaker opened for ${system}`, {
      failureCount: state.failureCount,
      requestCount: state.requestCount,
      errorRate: state.requestCount > 0 ? state.failureCount / state.requestCount : 0
    });
    
    this.emit('open', system, {
      reason: 'failure-threshold-exceeded',
      failures: state.failureCount,
      requests: state.requestCount,
      nextAttempt: state.nextAttemptTime
    });
  }

  private halfOpenCircuit(system: SystemType, state: CircuitState): void {
    state.status = 'half-open';
    state.failureCount = 0;
    state.successCount = 0;
    
    this.logger.info(`Circuit breaker half-opened for ${system}`);
    
    this.emit('half-open', system);
  }

  private closeCircuit(system: SystemType, state: CircuitState): void {
    state.status = 'closed';
    state.failureCount = 0;
    state.successCount = 0;
    state.lastFailureTime = undefined;
    state.nextAttemptTime = undefined;
    
    this.logger.info(`Circuit breaker closed for ${system}`);
    
    this.emit('close', system);
  }

  private cleanupOldRequests(): void {
    const cutoffTime = new Date(Date.now() - this.config.monitoringPeriod);
    
    for (const [system, requests] of this.recentRequests.entries()) {
      const filteredRequests = requests.filter(req => req.timestamp > cutoffTime);
      this.recentRequests.set(system, filteredRequests);
    }
  }

  // Public API methods

  async checkAvailability(system: SystemType): Promise<void> {
    const state = this.states.get(system);
    if (!state) {
      throw new Error(`Unknown system: ${system}`);
    }

    if (state.status === 'open') {
      const now = new Date();
      const timeUntilRetry = state.nextAttemptTime ? 
        state.nextAttemptTime.getTime() - now.getTime() : 0;
      
      throw new Error(
        `Circuit breaker is open for ${system}. ` +
        `Retry in ${Math.ceil(timeUntilRetry / 1000)} seconds.`
      );
    }
  }

  recordSuccess(system: SystemType, responseTime: number = 0): void {
    const state = this.states.get(system);
    if (!state) {
      this.logger.warn(`Attempted to record success for unknown system: ${system}`);
      return;
    }

    const result: RequestResult = {
      success: true,
      responseTime,
      timestamp: new Date()
    };

    // Update state
    state.requestCount++;
    state.successCount++;
    state.totalRequests++;

    // Add to recent requests
    const recentRequests = this.recentRequests.get(system)!;
    recentRequests.push(result);

    // Keep recent requests manageable
    if (recentRequests.length > 1000) {
      this.recentRequests.set(system, recentRequests.slice(-500));
    }

    this.emit('success', system, result);
  }

  recordFailure(system: SystemType, error: string = 'Unknown error', responseTime: number = 0): void {
    const state = this.states.get(system);
    if (!state) {
      this.logger.warn(`Attempted to record failure for unknown system: ${system}`);
      return;
    }

    const result: RequestResult = {
      success: false,
      responseTime,
      error,
      timestamp: new Date()
    };

    // Update state
    state.requestCount++;
    state.failureCount++;
    state.totalRequests++;
    state.totalFailures++;
    state.lastFailureTime = new Date();

    // Add to recent requests
    const recentRequests = this.recentRequests.get(system)!;
    recentRequests.push(result);

    // Keep recent requests manageable
    if (recentRequests.length > 1000) {
      this.recentRequests.set(system, recentRequests.slice(-500));
    }

    // Immediately evaluate state transition
    this.evaluateStateTransition(system);

    this.emit('failure', system, result);
  }

  // Status and monitoring methods

  getStatus(system: SystemType): {
    status: string;
    failureCount: number;
    successCount: number;
    requestCount: number;
    errorRate: number;
    nextAttemptTime?: Date;
    lastFailureTime?: Date;
    totalRequests: number;
    totalFailures: number;
  } {
    const state = this.states.get(system);
    if (!state) {
      throw new Error(`Unknown system: ${system}`);
    }

    return {
      status: state.status,
      failureCount: state.failureCount,
      successCount: state.successCount,
      requestCount: state.requestCount,
      errorRate: state.requestCount > 0 ? state.failureCount / state.requestCount : 0,
      nextAttemptTime: state.nextAttemptTime,
      lastFailureTime: state.lastFailureTime,
      totalRequests: state.totalRequests,
      totalFailures: state.totalFailures
    };
  }

  getAllStatuses(): Record<SystemType, ReturnType<typeof this.getStatus>> {
    const statuses: Partial<Record<SystemType, ReturnType<typeof this.getStatus>>> = {};
    
    for (const system of this.states.keys()) {
      statuses[system] = this.getStatus(system);
    }
    
    return statuses as Record<SystemType, ReturnType<typeof this.getStatus>>;
  }

  getRecentRequests(system: SystemType, limit: number = 50): RequestResult[] {
    const requests = this.recentRequests.get(system) || [];
    return requests.slice(-limit).reverse(); // Most recent first
  }

  getHealthSummary(): {
    totalSystems: number;
    healthySystems: number;
    openCircuits: number;
    halfOpenCircuits: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  } {
    let openCircuits = 0;
    let halfOpenCircuits = 0;
    
    for (const state of this.states.values()) {
      if (state.status === 'open') openCircuits++;
      if (state.status === 'half-open') halfOpenCircuits++;
    }
    
    const totalSystems = this.states.size;
    const healthySystems = totalSystems - openCircuits - halfOpenCircuits;
    
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (openCircuits > 0) {
      overallHealth = openCircuits >= totalSystems / 2 ? 'unhealthy' : 'degraded';
    } else if (halfOpenCircuits > 0) {
      overallHealth = 'degraded';
    }
    
    return {
      totalSystems,
      healthySystems,
      openCircuits,
      halfOpenCircuits,
      overallHealth
    };
  }

  // Configuration management

  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Circuit breaker configuration updated', this.config);
    this.emit('config-updated', this.config);
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // Manual control methods

  forceOpen(system: SystemType, reason: string = 'Manual intervention'): void {
    const state = this.states.get(system);
    if (!state) {
      throw new Error(`Unknown system: ${system}`);
    }

    this.openCircuit(system, state);
    this.logger.info(`Circuit breaker manually opened for ${system}: ${reason}`);
    this.emit('manual-open', system, reason);
  }

  forceClose(system: SystemType, reason: string = 'Manual intervention'): void {
    const state = this.states.get(system);
    if (!state) {
      throw new Error(`Unknown system: ${system}`);
    }

    this.closeCircuit(system, state);
    this.logger.info(`Circuit breaker manually closed for ${system}: ${reason}`);
    this.emit('manual-close', system, reason);
  }

  reset(system: SystemType): void {
    const state = this.states.get(system);
    if (!state) {
      throw new Error(`Unknown system: ${system}`);
    }

    // Reset to initial state
    state.status = 'closed';
    state.failureCount = 0;
    state.successCount = 0;
    state.requestCount = 0;
    state.windowStart = new Date();
    state.lastFailureTime = undefined;
    state.nextAttemptTime = undefined;

    // Clear recent requests
    this.recentRequests.set(system, []);

    this.logger.info(`Circuit breaker reset for ${system}`);
    this.emit('reset', system);
  }

  resetAll(): void {
    for (const system of this.states.keys()) {
      this.reset(system);
    }
    
    this.logger.info('All circuit breakers reset');
    this.emit('reset-all');
  }

  // Analytics methods

  getFailureAnalysis(system: SystemType, timeRange: number = 3600000): {
    totalFailures: number;
    failureRate: number;
    commonErrors: Array<{ error: string; count: number }>;
    avgResponseTime: number;
    failureTimeDistribution: Array<{ hour: number; failures: number }>;
  } {
    const recentRequests = this.recentRequests.get(system) || [];
    const cutoffTime = new Date(Date.now() - timeRange);
    
    const relevantRequests = recentRequests.filter(req => req.timestamp > cutoffTime);
    const failures = relevantRequests.filter(req => !req.success);
    
    // Count common errors
    const errorCounts = new Map<string, number>();
    for (const failure of failures) {
      if (failure.error) {
        errorCounts.set(failure.error, (errorCounts.get(failure.error) || 0) + 1);
      }
    }
    
    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate average response time for failures
    const avgResponseTime = failures.length > 0 ?
      failures.reduce((sum, req) => sum + req.responseTime, 0) / failures.length : 0;
    
    // Failure distribution by hour
    const hourlyFailures = new Map<number, number>();
    for (const failure of failures) {
      const hour = failure.timestamp.getHours();
      hourlyFailures.set(hour, (hourlyFailures.get(hour) || 0) + 1);
    }
    
    const failureTimeDistribution = Array.from(hourlyFailures.entries())
      .map(([hour, failures]) => ({ hour, failures }))
      .sort((a, b) => a.hour - b.hour);
    
    return {
      totalFailures: failures.length,
      failureRate: relevantRequests.length > 0 ? failures.length / relevantRequests.length : 0,
      commonErrors,
      avgResponseTime,
      failureTimeDistribution
    };
  }

  // Cleanup

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.states.clear();
    this.recentRequests.clear();
    this.removeAllListeners();
    
    this.emit('destroyed');
  }
}