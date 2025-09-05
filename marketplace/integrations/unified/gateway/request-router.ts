import { SystemType, UnifiedRequest, SystemConfig } from '../types/orchestration';
import { Logger } from '../monitoring/logger';

interface RoutingRule {
  pattern: string | RegExp;
  target: SystemType;
  priority: number;
  conditions?: {
    headers?: Record<string, string>;
    parameters?: Record<string, any>;
    custom?: (request: UnifiedRequest) => boolean;
  };
}

interface RoutingStrategy {
  type: 'round-robin' | 'weighted' | 'least-connections' | 'hash-based';
  config?: any;
}

export class RequestRouter {
  private systems: Record<SystemType, SystemConfig>;
  private rules: RoutingRule[] = [];
  private logger: Logger;
  private strategy: RoutingStrategy;
  private systemLoadMap: Map<SystemType, number> = new Map();

  constructor(systems: Record<SystemType, SystemConfig>, strategy?: RoutingStrategy) {
    this.systems = systems;
    this.logger = new Logger('info');
    this.strategy = strategy || { type: 'round-robin' };
    this.initializeDefaultRules();
    this.initializeSystemLoad();
  }

  private initializeDefaultRules(): void {
    // CNS routing rules
    this.addRule({
      pattern: /^cns\./,
      target: 'cns',
      priority: 100
    });

    this.addRule({
      pattern: 'validate-uhft',
      target: 'cns',
      priority: 90
    });

    this.addRule({
      pattern: 'semantic-parse',
      target: 'cns',
      priority: 90
    });

    // ByteStar routing rules
    this.addRule({
      pattern: /^bytestar\./,
      target: 'bytestar',
      priority: 100
    });

    this.addRule({
      pattern: 'ai-enhance',
      target: 'bytestar',
      priority: 90
    });

    this.addRule({
      pattern: 'generate',
      target: 'bytestar',
      priority: 90
    });

    // Marketplace routing rules
    this.addRule({
      pattern: /^marketplace\./,
      target: 'marketplace',
      priority: 100
    });

    this.addRule({
      pattern: 'search',
      target: 'marketplace',
      priority: 90,
      conditions: {
        custom: (req) => !req.operation.includes('ai-') && !req.operation.includes('semantic')
      }
    });

    this.addRule({
      pattern: 'purchase',
      target: 'marketplace',
      priority: 90
    });

    // Cross-system workflow routing
    this.addRule({
      pattern: 'validate-enhance-execute',
      target: 'cns', // Start with CNS validation
      priority: 80
    });

    this.addRule({
      pattern: 'semantic-ai-marketplace',
      target: 'cns', // Start with semantic parsing
      priority: 80
    });
  }

  private initializeSystemLoad(): void {
    for (const systemType of Object.keys(this.systems) as SystemType[]) {
      this.systemLoadMap.set(systemType, 0);
    }
  }

  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    // Sort rules by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(pattern: string | RegExp): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => 
      typeof rule.pattern === 'string' ? 
        rule.pattern !== pattern : 
        rule.pattern.toString() !== pattern.toString()
    );
    return this.rules.length < initialLength;
  }

  determineTarget(request: UnifiedRequest): SystemType {
    // If target is explicitly specified, use it
    if (request.target) {
      this.validateSystem(request.target);
      return request.target;
    }

    // Find matching rule
    for (const rule of this.rules) {
      if (this.matchesRule(request, rule)) {
        this.logger.debug(`Request ${request.id} matched rule: ${rule.pattern} -> ${rule.target}`);
        return rule.target;
      }
    }

    // Fallback to operation-based routing
    return this.determineTargetFromOperation(request.operation);
  }

  private matchesRule(request: UnifiedRequest, rule: RoutingRule): boolean {
    // Check pattern match
    const patternMatch = typeof rule.pattern === 'string' ?
      request.operation.includes(rule.pattern) :
      rule.pattern.test(request.operation);

    if (!patternMatch) {
      return false;
    }

    // Check conditions if specified
    if (rule.conditions) {
      // Header conditions
      if (rule.conditions.headers) {
        const headers = request.metadata.tags || {};
        for (const [key, expectedValue] of Object.entries(rule.conditions.headers)) {
          if (headers[key] !== expectedValue) {
            return false;
          }
        }
      }

      // Parameter conditions
      if (rule.conditions.parameters) {
        const payload = request.payload as any;
        for (const [key, expectedValue] of Object.entries(rule.conditions.parameters)) {
          if (payload?.[key] !== expectedValue) {
            return false;
          }
        }
      }

      // Custom conditions
      if (rule.conditions.custom && !rule.conditions.custom(request)) {
        return false;
      }
    }

    return true;
  }

  private determineTargetFromOperation(operation: string): SystemType {
    // Extract system prefix from operation
    const parts = operation.split('.');
    if (parts.length >= 2) {
      const systemPrefix = parts[0];
      if (this.isValidSystemType(systemPrefix)) {
        return systemPrefix as SystemType;
      }
    }

    // Keyword-based routing
    const lowerOp = operation.toLowerCase();
    
    if (lowerOp.includes('validate') || lowerOp.includes('uhft') || lowerOp.includes('semantic')) {
      return 'cns';
    }
    
    if (lowerOp.includes('ai') || lowerOp.includes('enhance') || lowerOp.includes('generate')) {
      return 'bytestar';
    }
    
    if (lowerOp.includes('search') || lowerOp.includes('purchase') || lowerOp.includes('marketplace')) {
      return 'marketplace';
    }

    // Default fallback
    return 'marketplace';
  }

  private isValidSystemType(value: string): value is SystemType {
    return ['cns', 'bytestar', 'marketplace'].includes(value);
  }

  private validateSystem(system: SystemType): void {
    if (!this.systems[system]) {
      throw new Error(`Unknown system: ${system}`);
    }
  }

  // Load balancing methods
  updateSystemLoad(system: SystemType, load: number): void {
    this.systemLoadMap.set(system, load);
  }

  getSystemLoad(system: SystemType): number {
    return this.systemLoadMap.get(system) || 0;
  }

  getBestEndpoint(system: SystemType): string {
    const systemConfig = this.systems[system];
    if (!systemConfig || !systemConfig.endpoints) {
      throw new Error(`No endpoints configured for system: ${system}`);
    }

    const endpoints = Object.entries(systemConfig.endpoints);
    if (endpoints.length === 0) {
      throw new Error(`No endpoints available for system: ${system}`);
    }

    // Apply routing strategy
    switch (this.strategy.type) {
      case 'round-robin':
        return this.selectRoundRobin(endpoints);
      
      case 'weighted':
        return this.selectWeighted(endpoints);
      
      case 'least-connections':
        return this.selectLeastConnections(endpoints);
      
      case 'hash-based':
        return this.selectHashBased(endpoints);
      
      default:
        return endpoints[0][1].url;
    }
  }

  private selectRoundRobin(endpoints: [string, any][]): string {
    // Simple round-robin implementation
    const timestamp = Date.now();
    const index = Math.floor(timestamp / 1000) % endpoints.length;
    return endpoints[index][1].url;
  }

  private selectWeighted(endpoints: [string, any][]): string {
    // Weighted selection based on endpoint configuration
    const weights = endpoints.map(([name, config]) => config.weight || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < endpoints.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return endpoints[i][1].url;
      }
    }
    
    return endpoints[0][1].url;
  }

  private selectLeastConnections(endpoints: [string, any][]): string {
    // Select endpoint with least active connections
    // In a real implementation, this would track actual connections
    let minLoad = Infinity;
    let selectedEndpoint = endpoints[0][1].url;
    
    for (const [name, config] of endpoints) {
      const load = this.getEndpointLoad(config.url);
      if (load < minLoad) {
        minLoad = load;
        selectedEndpoint = config.url;
      }
    }
    
    return selectedEndpoint;
  }

  private selectHashBased(endpoints: [string, any][]): string {
    // Hash-based selection for sticky sessions
    const hash = this.simpleHash(Date.now().toString());
    const index = hash % endpoints.length;
    return endpoints[index][1].url;
  }

  private getEndpointLoad(url: string): number {
    // Placeholder for endpoint load tracking
    return Math.random() * 100;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Analytics and debugging
  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  getSystemLoads(): Record<SystemType, number> {
    const result: Partial<Record<SystemType, number>> = {};
    for (const [system, load] of this.systemLoadMap.entries()) {
      result[system] = load;
    }
    return result as Record<SystemType, number>;
  }

  testRouting(operation: string): SystemType {
    const mockRequest: UnifiedRequest = {
      id: 'test',
      source: 'marketplace',
      operation,
      payload: {},
      metadata: {
        timestamp: new Date(),
        traceId: 'test-trace',
        spanId: 'test-span',
        priority: 'normal',
        timeout: 30000,
        retries: 3
      }
    };
    
    return this.determineTarget(mockRequest);
  }
}