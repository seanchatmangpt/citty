// Pattern of Three Architecture - Three-tier execution model
import type { 
  PatternOfThree, 
  ArchitecturalTier, 
  TierType, 
  RunCtx 
} from '../types/citty-pro';
import { hooks } from './hooks';

export class PatternOfThreeImpl implements PatternOfThree {
  public commandTier: ArchitecturalTier;
  public operationsTier: ArchitecturalTier;
  public runtimeTier: ArchitecturalTier;
  
  constructor() {
    // Initialize the three tiers
    this.commandTier = this.createTier('command', 'Command Interface Layer');
    this.operationsTier = this.createTier('operations', 'Operations Processing Layer');
    this.runtimeTier = this.createTier('runtime', 'Runtime Execution Layer');
  }
  
  private createTier(type: TierType, name: string): ArchitecturalTier {
    return {
      type,
      name,
      process: async (input, ctx) => {
        const startTime = performance.now();
        
        try {
          // Call tier-specific hook
          await hooks.callHook('workflow:compile', { id: `tier-${type}` });
          
          // Process based on tier type
          let result = input;
          
          switch (type) {
            case 'command':
              // Command tier: Parse, validate, and prepare
              result = await this.processCommandTier(input, ctx);
              break;
              
            case 'operations':
              // Operations tier: Business logic and optimization
              result = await this.processOperationsTier(input, ctx);
              break;
              
            case 'runtime':
              // Runtime tier: Execute and manage resources
              result = await this.processRuntimeTier(input, ctx);
              break;
          }
          
          const duration = performance.now() - startTime;
          
          // Update metrics
          if (!this[`${type}Tier`].metrics) {
            this[`${type}Tier`].metrics = {
              latency: duration,
              throughput: 1,
              errors: 0
            };
          } else {
            const metrics = this[`${type}Tier`].metrics!;
            metrics.latency = (metrics.latency + duration) / 2; // Rolling average
            metrics.throughput++;
          }
          
          return result;
        } catch (error) {
          // Update error metrics
          if (this[`${type}Tier`].metrics) {
            this[`${type}Tier`].metrics.errors++;
          }
          throw error;
        }
      },
      metrics: {
        latency: 0,
        throughput: 0,
        errors: 0
      }
    };
  }
  
  private async processCommandTier<T>(input: T, ctx: RunCtx): Promise<T> {
    // Command tier processing: Interface and validation
    
    // 1. Input validation
    if (input === null || input === undefined) {
      throw new Error('Invalid input at command tier');
    }
    
    // 2. Context enrichment
    const enriched = {
      ...input as any,
      _tier: 'command',
      _timestamp: ctx.now(),
      _context: {
        cwd: ctx.cwd,
        env: Object.keys(ctx.env || {}).length
      }
    };
    
    // 3. Permission checks (if applicable)
    if (ctx.memo?.requiresAuth && !ctx.memo?.authenticated) {
      throw new Error('Authentication required');
    }
    
    return enriched as T;
  }
  
  private async processOperationsTier<T>(input: T, ctx: RunCtx): Promise<T> {
    // Operations tier: Business logic and optimization
    
    // 1. Apply business rules
    let processed = input as any;
    
    // 2. Optimization (80/20 rule - focus on high-impact operations)
    if (processed._optimize !== false) {
      processed = this.applyOptimizations(processed, ctx);
    }
    
    // 3. Caching logic
    const cacheKey = JSON.stringify(processed).substring(0, 50);
    if (ctx.memo?.cache && ctx.memo.cache[cacheKey]) {
      return ctx.memo.cache[cacheKey] as T;
    }
    
    // 4. Transform data
    processed._tier = 'operations';
    processed._optimized = true;
    
    // Store in cache if enabled
    if (ctx.memo?.cache) {
      ctx.memo.cache[cacheKey] = processed;
    }
    
    return processed as T;
  }
  
  private async processRuntimeTier<T>(input: T, ctx: RunCtx): Promise<T> {
    // Runtime tier: Execution and resource management
    
    const processed = input as any;
    
    // 1. Resource allocation
    const resources = await this.allocateResources(ctx);
    
    // 2. Execute with monitoring
    if (ctx.otel?.span) {
      return await ctx.otel.span('runtime-execution', async () => {
        processed._tier = 'runtime';
        processed._executed = true;
        processed._resources = resources;
        
        // 3. Cleanup resources after execution
        await this.cleanupResources(resources, ctx);
        
        return processed as T;
      });
    }
    
    // Fallback without telemetry
    processed._tier = 'runtime';
    processed._executed = true;
    processed._resources = resources;
    
    await this.cleanupResources(resources, ctx);
    
    return processed as T;
  }
  
  private applyOptimizations<T>(input: T, ctx: RunCtx): T {
    const data = input as any;
    
    // 80/20 Optimization: Focus on the 20% that matters most
    if (Array.isArray(data)) {
      // For arrays, process only significant items
      const threshold = Math.ceil(data.length * 0.2); // Top 20%
      const significant = data.slice(0, threshold);
      const rest = data.slice(threshold);
      
      return [...significant.map((item: any) => ({ ...item, _priority: 'high' })), ...rest] as T;
    }
    
    if (typeof data === 'object' && data !== null) {
      // For objects, mark critical fields
      const criticalFields = ['id', 'name', 'value', 'result', 'data'];
      const optimized = { ...data };
      
      for (const field of criticalFields) {
        if (field in optimized) {
          optimized[`_${field}_priority`] = 'high';
        }
      }
      
      return optimized as T;
    }
    
    return input;
  }
  
  private async allocateResources(ctx: RunCtx): Promise<Record<string, any>> {
    // Simulate resource allocation
    const resources: Record<string, any> = {
      memory: Math.random() * 100, // MB
      cpu: Math.random() * 4, // cores
      allocated: ctx.now()
    };
    
    // Track allocation
    if (ctx.memo) {
      ctx.memo._allocatedResources = resources;
    }
    
    return resources;
  }
  
  private async cleanupResources(resources: Record<string, any>, ctx: RunCtx): Promise<void> {
    // Simulate resource cleanup
    if (ctx.memo?._allocatedResources) {
      delete ctx.memo._allocatedResources;
    }
    
    // Log cleanup
    if (process.env.CITTY_DEBUG) {
      console.log('[Pattern of Three] Resources cleaned up:', resources);
    }
  }
  
  async execute<T>(input: T, ctx: RunCtx): Promise<T> {
    // Execute through all three tiers in sequence
    
    // Tier 1: Command processing
    const commandResult = await this.commandTier.process(input, ctx);
    
    // Tier 2: Operations processing
    const operationsResult = await this.operationsTier.process(commandResult, ctx);
    
    // Tier 3: Runtime execution
    const runtimeResult = await this.runtimeTier.process(operationsResult, ctx);
    
    return runtimeResult;
  }
  
  // Metrics and monitoring
  getMetrics(): Record<string, any> {
    return {
      command: this.commandTier.metrics,
      operations: this.operationsTier.metrics,
      runtime: this.runtimeTier.metrics,
      total: {
        latency: (this.commandTier.metrics?.latency || 0) +
                 (this.operationsTier.metrics?.latency || 0) +
                 (this.runtimeTier.metrics?.latency || 0),
        throughput: Math.min(
          this.commandTier.metrics?.throughput || 0,
          this.operationsTier.metrics?.throughput || 0,
          this.runtimeTier.metrics?.throughput || 0
        ),
        errors: (this.commandTier.metrics?.errors || 0) +
                (this.operationsTier.metrics?.errors || 0) +
                (this.runtimeTier.metrics?.errors || 0)
      }
    };
  }
  
  // Reset metrics
  resetMetrics(): void {
    [this.commandTier, this.operationsTier, this.runtimeTier].forEach(tier => {
      if (tier.metrics) {
        tier.metrics.latency = 0;
        tier.metrics.throughput = 0;
        tier.metrics.errors = 0;
      }
    });
  }
}

export function createPatternOfThree(): PatternOfThree {
  return new PatternOfThreeImpl();
}