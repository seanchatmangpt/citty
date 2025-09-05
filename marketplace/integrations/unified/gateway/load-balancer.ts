import { EventEmitter } from 'events';
import { SystemType, SystemConfig } from '../types/orchestration';
import { Logger } from '../monitoring/logger';

interface EndpointHealth {
  url: string;
  healthy: boolean;
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  loadScore: number; // 0-1, lower is better
  activeConnections: number;
}

interface LoadBalancingStrategy {
  type: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'least-response-time' | 'health-based' | 'custom';
  config?: any;
}

interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  unhealthyThreshold: number; // consecutive failures
  healthyThreshold: number; // consecutive successes to mark as healthy
  endpoint?: string; // health check endpoint path
}

export class LoadBalancer extends EventEmitter {
  private logger: Logger;
  private systems: Map<SystemType, SystemConfig> = new Map();
  private endpointHealth: Map<string, EndpointHealth> = new Map();
  private strategy: LoadBalancingStrategy;
  private healthCheckConfig: HealthCheckConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private roundRobinCounters: Map<SystemType, number> = new Map();
  
  constructor(
    systems: Record<SystemType, SystemConfig>,
    strategy?: LoadBalancingStrategy,
    healthCheckConfig?: Partial<HealthCheckConfig>
  ) {
    super();
    this.logger = new Logger('info');
    
    // Initialize systems
    for (const [system, config] of Object.entries(systems) as [SystemType, SystemConfig][]) {
      this.systems.set(system, config);
      this.roundRobinCounters.set(system, 0);
      
      // Initialize endpoint health tracking
      for (const [name, endpoint] of Object.entries(config.endpoints)) {
        this.endpointHealth.set(endpoint.url, {
          url: endpoint.url,
          healthy: true,
          responseTime: 0,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          loadScore: 0,
          activeConnections: 0
        });
      }
    }
    
    this.strategy = strategy || { type: 'round-robin' };
    this.healthCheckConfig = {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      unhealthyThreshold: 3,
      healthyThreshold: 2,
      endpoint: '/health',
      ...healthCheckConfig
    };
    
    if (this.healthCheckConfig.enabled) {
      this.startHealthChecks();
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckConfig.interval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.endpointHealth.keys()).map(url => 
      this.checkEndpointHealth(url)
    );
    
    await Promise.allSettled(healthCheckPromises);
  }

  private async checkEndpointHealth(url: string): Promise<void> {
    const health = this.endpointHealth.get(url)!;
    const healthCheckUrl = url + (this.healthCheckConfig.endpoint || '/health');
    
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would make an HTTP request
      // For now, we'll simulate the health check
      const response = await this.simulateHealthCheck(healthCheckUrl);
      
      const responseTime = Date.now() - startTime;
      health.responseTime = responseTime;
      health.lastCheck = new Date();
      
      if (response.ok) {
        health.consecutiveFailures = 0;
        
        // Mark as healthy if it meets the threshold
        if (!health.healthy && health.consecutiveFailures === 0) {
          health.healthy = true;
          this.logger.info(`Endpoint ${url} marked as healthy`);
          this.emit('endpoint-healthy', { url, responseTime });
        }
      } else {
        this.handleEndpointFailure(health);
      }
      
    } catch (error) {
      this.handleEndpointFailure(health);
      this.logger.error(`Health check failed for ${url}:`, error as Error);
    }
  }

  private async simulateHealthCheck(url: string): Promise<{ ok: boolean }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate occasional failures
    const failureRate = 0.05; // 5% failure rate
    return { ok: Math.random() > failureRate };
  }

  private handleEndpointFailure(health: EndpointHealth): void {
    health.consecutiveFailures++;
    health.lastCheck = new Date();
    
    if (health.healthy && health.consecutiveFailures >= this.healthCheckConfig.unhealthyThreshold) {
      health.healthy = false;
      this.logger.warn(`Endpoint ${health.url} marked as unhealthy after ${health.consecutiveFailures} consecutive failures`);
      this.emit('endpoint-unhealthy', { 
        url: health.url, 
        consecutiveFailures: health.consecutiveFailures 
      });
    }
  }

  async selectEndpoint(system: SystemType): Promise<string> {
    const systemConfig = this.systems.get(system);
    if (!systemConfig) {
      throw new Error(`System not configured: ${system}`);
    }

    const endpoints = Object.entries(systemConfig.endpoints);
    if (endpoints.length === 0) {
      throw new Error(`No endpoints configured for system: ${system}`);
    }

    // Filter healthy endpoints
    const healthyEndpoints = endpoints.filter(([name, config]) => {
      const health = this.endpointHealth.get(config.url);
      return health?.healthy !== false;
    });

    if (healthyEndpoints.length === 0) {
      this.logger.warn(`No healthy endpoints for ${system}, falling back to all endpoints`);
      // Fallback to all endpoints if none are healthy
      return this.selectFromEndpoints(endpoints, system);
    }

    return this.selectFromEndpoints(healthyEndpoints, system);
  }

  private selectFromEndpoints(endpoints: [string, any][], system: SystemType): string {
    switch (this.strategy.type) {
      case 'round-robin':
        return this.selectRoundRobin(endpoints, system);
      
      case 'weighted-round-robin':
        return this.selectWeightedRoundRobin(endpoints, system);
      
      case 'least-connections':
        return this.selectLeastConnections(endpoints);
      
      case 'least-response-time':
        return this.selectLeastResponseTime(endpoints);
      
      case 'health-based':
        return this.selectHealthBased(endpoints);
      
      case 'custom':
        return this.selectCustom(endpoints, system);
      
      default:
        return endpoints[0][1].url;
    }
  }

  private selectRoundRobin(endpoints: [string, any][], system: SystemType): string {
    const counter = this.roundRobinCounters.get(system) || 0;
    const index = counter % endpoints.length;
    this.roundRobinCounters.set(system, counter + 1);
    
    return endpoints[index][1].url;
  }

  private selectWeightedRoundRobin(endpoints: [string, any][], system: SystemType): string {
    // Calculate total weight
    const totalWeight = endpoints.reduce((sum, [name, config]) => 
      sum + (config.weight || 1), 0
    );
    
    const counter = this.roundRobinCounters.get(system) || 0;
    let targetWeight = (counter % totalWeight) + 1;
    this.roundRobinCounters.set(system, counter + 1);
    
    let currentWeight = 0;
    for (const [name, config] of endpoints) {
      currentWeight += config.weight || 1;
      if (targetWeight <= currentWeight) {
        return config.url;
      }
    }
    
    return endpoints[0][1].url;
  }

  private selectLeastConnections(endpoints: [string, any][]): string {
    let minConnections = Infinity;
    let selectedEndpoint = endpoints[0][1].url;
    
    for (const [name, config] of endpoints) {
      const health = this.endpointHealth.get(config.url);
      const connections = health?.activeConnections || 0;
      
      if (connections < minConnections) {
        minConnections = connections;
        selectedEndpoint = config.url;
      }
    }
    
    return selectedEndpoint;
  }

  private selectLeastResponseTime(endpoints: [string, any][]): string {
    let minResponseTime = Infinity;
    let selectedEndpoint = endpoints[0][1].url;
    
    for (const [name, config] of endpoints) {
      const health = this.endpointHealth.get(config.url);
      const responseTime = health?.responseTime || 0;
      
      if (responseTime > 0 && responseTime < minResponseTime) {
        minResponseTime = responseTime;
        selectedEndpoint = config.url;
      }
    }
    
    return selectedEndpoint;
  }

  private selectHealthBased(endpoints: [string, any][]): string {
    // Score based on response time and load
    let bestScore = Infinity;
    let selectedEndpoint = endpoints[0][1].url;
    
    for (const [name, config] of endpoints) {
      const health = this.endpointHealth.get(config.url);
      if (!health) continue;
      
      // Combined score: response time + load + connection count
      const score = (health.responseTime * 0.4) + 
                   (health.loadScore * 100 * 0.3) + 
                   (health.activeConnections * 10 * 0.3);
      
      if (score < bestScore) {
        bestScore = score;
        selectedEndpoint = config.url;
      }
    }
    
    return selectedEndpoint;
  }

  private selectCustom(endpoints: [string, any][], system: SystemType): string {
    // Custom strategy implementation
    const customConfig = this.strategy.config;
    
    if (customConfig?.preferLocal) {
      // Prefer local endpoints
      const localEndpoints = endpoints.filter(([name, config]) => 
        config.url.includes('localhost') || config.url.includes('127.0.0.1')
      );
      if (localEndpoints.length > 0) {
        return this.selectRoundRobin(localEndpoints, system);
      }
    }
    
    // Fallback to round robin
    return this.selectRoundRobin(endpoints, system);
  }

  // Connection tracking
  recordConnectionStart(url: string): void {
    const health = this.endpointHealth.get(url);
    if (health) {
      health.activeConnections++;
    }
  }

  recordConnectionEnd(url: string, responseTime?: number): void {
    const health = this.endpointHealth.get(url);
    if (health) {
      health.activeConnections = Math.max(0, health.activeConnections - 1);
      
      if (responseTime !== undefined) {
        // Update exponential moving average
        const alpha = 0.1;
        health.responseTime = health.responseTime * (1 - alpha) + responseTime * alpha;
      }
    }
  }

  // Load tracking
  updateEndpointLoad(url: string, loadScore: number): void {
    const health = this.endpointHealth.get(url);
    if (health) {
      health.loadScore = Math.max(0, Math.min(1, loadScore));
    }
  }

  // Configuration management
  addEndpoint(system: SystemType, name: string, endpoint: { url: string; weight?: number }): void {
    const systemConfig = this.systems.get(system);
    if (!systemConfig) {
      throw new Error(`System not found: ${system}`);
    }
    
    systemConfig.endpoints[name] = endpoint;
    
    // Initialize health tracking
    this.endpointHealth.set(endpoint.url, {
      url: endpoint.url,
      healthy: true,
      responseTime: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      loadScore: 0,
      activeConnections: 0
    });
    
    this.logger.info(`Endpoint added: ${name} -> ${endpoint.url} for system ${system}`);
    this.emit('endpoint-added', { system, name, url: endpoint.url });
  }

  removeEndpoint(system: SystemType, name: string): boolean {
    const systemConfig = this.systems.get(system);
    if (!systemConfig || !systemConfig.endpoints[name]) {
      return false;
    }
    
    const url = systemConfig.endpoints[name].url;
    delete systemConfig.endpoints[name];
    this.endpointHealth.delete(url);
    
    this.logger.info(`Endpoint removed: ${name} from system ${system}`);
    this.emit('endpoint-removed', { system, name, url });
    return true;
  }

  setEndpointHealth(url: string, healthy: boolean): void {
    const health = this.endpointHealth.get(url);
    if (health) {
      health.healthy = healthy;
      health.consecutiveFailures = healthy ? 0 : this.healthCheckConfig.unhealthyThreshold;
      this.logger.info(`Endpoint ${url} manually set to ${healthy ? 'healthy' : 'unhealthy'}`);
    }
  }

  // Strategy management
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    this.logger.info(`Load balancing strategy changed to: ${strategy.type}`);
    this.emit('strategy-changed', strategy);
  }

  // Monitoring and statistics
  getEndpointStats(): Record<string, EndpointHealth> {
    const stats: Record<string, EndpointHealth> = {};
    for (const [url, health] of this.endpointHealth.entries()) {
      stats[url] = { ...health };
    }
    return stats;
  }

  getSystemStats(system: SystemType): {
    totalEndpoints: number;
    healthyEndpoints: number;
    avgResponseTime: number;
    totalConnections: number;
    roundRobinCounter: number;
  } {
    const systemConfig = this.systems.get(system);
    if (!systemConfig) {
      throw new Error(`System not found: ${system}`);
    }
    
    const endpoints = Object.values(systemConfig.endpoints);
    let healthyCount = 0;
    let totalResponseTime = 0;
    let totalConnections = 0;
    let validResponseTimes = 0;
    
    for (const endpoint of endpoints) {
      const health = this.endpointHealth.get(endpoint.url);
      if (health) {
        if (health.healthy) healthyCount++;
        if (health.responseTime > 0) {
          totalResponseTime += health.responseTime;
          validResponseTimes++;
        }
        totalConnections += health.activeConnections;
      }
    }
    
    return {
      totalEndpoints: endpoints.length,
      healthyEndpoints: healthyCount,
      avgResponseTime: validResponseTimes > 0 ? totalResponseTime / validResponseTimes : 0,
      totalConnections,
      roundRobinCounter: this.roundRobinCounters.get(system) || 0
    };
  }

  getOverallStats(): {
    totalSystems: number;
    totalEndpoints: number;
    healthyEndpoints: number;
    totalConnections: number;
    avgResponseTime: number;
    strategy: string;
  } {
    let totalEndpoints = 0;
    let healthyEndpoints = 0;
    let totalConnections = 0;
    let totalResponseTime = 0;
    let validResponseTimes = 0;
    
    for (const health of this.endpointHealth.values()) {
      totalEndpoints++;
      if (health.healthy) healthyEndpoints++;
      totalConnections += health.activeConnections;
      if (health.responseTime > 0) {
        totalResponseTime += health.responseTime;
        validResponseTimes++;
      }
    }
    
    return {
      totalSystems: this.systems.size,
      totalEndpoints,
      healthyEndpoints,
      totalConnections,
      avgResponseTime: validResponseTimes > 0 ? totalResponseTime / validResponseTimes : 0,
      strategy: this.strategy.type
    };
  }

  // Health check management
  enableHealthChecks(): void {
    if (!this.healthCheckConfig.enabled) {
      this.healthCheckConfig.enabled = true;
      this.startHealthChecks();
      this.logger.info('Health checks enabled');
    }
  }

  disableHealthChecks(): void {
    if (this.healthCheckConfig.enabled) {
      this.healthCheckConfig.enabled = false;
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      this.logger.info('Health checks disabled');
    }
  }

  setHealthCheckConfig(config: Partial<HealthCheckConfig>): void {
    const oldConfig = { ...this.healthCheckConfig };
    this.healthCheckConfig = { ...this.healthCheckConfig, ...config };
    
    // Restart health checks if interval changed
    if (oldConfig.interval !== this.healthCheckConfig.interval && this.healthCheckConfig.enabled) {
      this.disableHealthChecks();
      this.enableHealthChecks();
    }
    
    this.logger.info('Health check configuration updated');
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.systems.clear();
    this.endpointHealth.clear();
    this.roundRobinCounters.clear();
    
    this.emit('destroyed');
  }
}