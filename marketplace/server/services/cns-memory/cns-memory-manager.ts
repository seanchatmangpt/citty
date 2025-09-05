import { MemoryLayer, MemoryEntry, MemoryQuery, MemoryOperation, CompoundIntelligenceMultiplier } from './interfaces/memory-types';
import { IMemoryLayer } from './interfaces/memory-layer-interface';
import { L1SessionMemory } from './layers/l1-session-memory';
import { L2ContextMemory } from './layers/l2-context-memory';
import { L3PatternMemory } from './layers/l3-pattern-memory';
import { L4PredictionMemory } from './layers/l4-prediction-memory';
import { ContextValidationEngine } from './engines/context-validation-engine';
import { EvolutionTracking } from './engines/evolution-tracking';
import { PredictiveLoadingEngine } from './engines/predictive-loading';
import { CompoundIntelligenceEngine } from './engines/compound-intelligence';

interface CNSConfiguration {
  enableValidation: boolean;
  enableEvolution: boolean;
  enablePredictiveLoading: boolean;
  enableIntelligenceMultiplier: boolean;
  autoHealing: boolean;
  metricsCollection: boolean;
}

interface CNSMetrics {
  layerMetrics: Record<MemoryLayer, any>;
  validationHealth: any;
  evolutionStats: any;
  predictionStats: any;
  intelligenceMetrics: any;
  overallHealth: number;
  systemLoad: number;
}

/**
 * CNS Memory Manager - Central Nervous System Memory Layer Integration
 * 
 * Manages all four memory layers with integrated intelligence engines:
 * - L1: Session critical data (100% retention)
 * - L2: Request context with SPR compression (80% token reduction)  
 * - L3: Application patterns (10KB O(1) access)
 * - L4: ML predictions (50KB, 85% accuracy)
 * 
 * Features:
 * - Context validation and healing
 * - Evolution tracking
 * - Predictive loading optimization
 * - Compound intelligence multiplier
 */
export class CNSMemoryManager {
  private layers: Map<MemoryLayer, IMemoryLayer> = new Map();
  private validationEngine: ContextValidationEngine;
  private evolutionEngine: EvolutionTracking;
  private predictiveEngine: PredictiveLoadingEngine;
  private intelligenceEngine: CompoundIntelligenceEngine;
  
  private operationHistory: MemoryOperation[] = [];
  private systemMetrics: CNSMetrics;
  
  constructor(private config: CNSConfiguration = {
    enableValidation: true,
    enableEvolution: true,
    enablePredictiveLoading: true,
    enableIntelligenceMultiplier: true,
    autoHealing: true,
    metricsCollection: true
  }) {
    this.initializeLayers();
    this.initializeEngines();
    this.initializeMetrics();
    this.startSystemMonitoring();
  }

  /**
   * Initialize the CNS Memory System
   */
  async initialize(): Promise<void> {
    console.log('Initializing CNS Memory System...');
    
    // Initialize all layers
    for (const [layer, instance] of this.layers.entries()) {
      console.log(`Initializing ${layer} layer...`);
      await instance.validate();
    }
    
    // Initialize engines
    if (this.config.enableValidation) {
      console.log('Context validation engine ready');
    }
    
    if (this.config.enableEvolution) {
      console.log('Evolution tracking engine ready');
    }
    
    if (this.config.enablePredictiveLoading) {
      console.log('Predictive loading engine ready');
    }
    
    if (this.config.enableIntelligenceMultiplier) {
      console.log('Compound intelligence engine ready');
    }
    
    console.log('CNS Memory System initialized successfully');
  }

  /**
   * Store data in appropriate memory layer with intelligence enhancement
   */
  async store<T>(
    key: string,
    value: T,
    layer: MemoryLayer,
    options: {
      ttl?: number;
      priority?: number;
      tags?: string[];
      context?: Record<string, any>;
    } = {}
  ): Promise<MemoryEntry<T>> {
    const operation: MemoryOperation = {
      type: 'write',
      layer,
      key,
      data: value,
      options,
      timestamp: new Date()
    };

    this.recordOperation(operation);

    // Apply intelligence enhancement
    const enhanced = this.config.enableIntelligenceMultiplier ? 
      await this.intelligenceEngine.applyIntelligenceBoost(
        async () => await this.executeStore(key, value, layer, options),
        { type: 'write', layer, complexity: this.calculateComplexity(value) }
      ) : 
      { result: await this.executeStore(key, value, layer, options), multiplier: 1, components: [] };

    // Record access pattern for predictive loading
    if (this.config.enablePredictiveLoading) {
      this.predictiveEngine.recordAccess(key, layer, options.context ?? {});
    }

    return enhanced.result;
  }

  /**
   * Retrieve data with predictive loading and intelligence enhancement
   */
  async retrieve<T>(
    key: string,
    layer: MemoryLayer,
    context: Record<string, any> = {}
  ): Promise<MemoryEntry<T> | null> {
    const operation: MemoryOperation = {
      type: 'read',
      layer,
      key,
      timestamp: new Date()
    };

    this.recordOperation(operation);

    // Use predictive loading if enabled
    if (this.config.enablePredictiveLoading) {
      return await this.predictiveEngine.getWithPredictiveLoading<T>(key, layer, context);
    }

    // Apply intelligence enhancement
    const enhanced = this.config.enableIntelligenceMultiplier ? 
      await this.intelligenceEngine.applyIntelligenceBoost(
        async () => await this.executeRetrieve<T>(key, layer),
        { type: 'read', layer }
      ) : 
      { result: await this.executeRetrieve<T>(key, layer), multiplier: 1, components: [] };

    return enhanced.result;
  }

  /**
   * Query across memory layers with intelligent optimization
   */
  async query(query: MemoryQuery & { 
    layers?: MemoryLayer[]; 
    intelligenceBoost?: boolean;
    context?: Record<string, any>;
  }): Promise<MemoryEntry[]> {
    const layers = query.layers ?? [MemoryLayer.L1_SESSION, MemoryLayer.L2_CONTEXT, MemoryLayer.L3_PATTERNS, MemoryLayer.L4_PREDICTIONS];
    const results: MemoryEntry[] = [];

    // Predict which layers are most likely to have results
    let layersToQuery = layers;
    if (this.config.enablePredictiveLoading && query.context) {
      const predictions = await this.predictiveEngine.getPredictions(query.context, 20);
      const predictedLayers = new Set(predictions.map(p => p.layer));
      layersToQuery = layers.filter(l => predictedLayers.has(l));
      
      // If no predictions, fall back to all layers
      if (layersToQuery.length === 0) {
        layersToQuery = layers;
      }
    }

    // Query each layer
    for (const layerType of layersToQuery) {
      const layer = this.layers.get(layerType);
      if (layer) {
        try {
          const layerResults = await layer.query(query);
          results.push(...layerResults);
        } catch (error) {
          console.error(`Error querying ${layerType}:`, error);
        }
      }
    }

    // Record operation
    const operation: MemoryOperation = {
      type: 'read',
      layer: layers[0], // Primary layer
      key: query.key || 'query',
      options: { query },
      timestamp: new Date()
    };
    this.recordOperation(operation);

    // Sort by priority and relevance
    return results.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Delete entry with cross-layer cleanup
   */
  async delete(key: string, layer?: MemoryLayer): Promise<{ deleted: number; layers: MemoryLayer[] }> {
    let deleted = 0;
    const deletedFromLayers: MemoryLayer[] = [];

    if (layer) {
      // Delete from specific layer
      const layerInstance = this.layers.get(layer);
      if (layerInstance && await layerInstance.delete(key)) {
        deleted++;
        deletedFromLayers.push(layer);
      }
    } else {
      // Delete from all layers
      for (const [layerType, layerInstance] of this.layers.entries()) {
        try {
          if (await layerInstance.delete(key)) {
            deleted++;
            deletedFromLayers.push(layerType);
          }
        } catch (error) {
          console.error(`Error deleting from ${layerType}:`, error);
        }
      }
    }

    // Record operation
    const operation: MemoryOperation = {
      type: 'delete',
      layer: layer || MemoryLayer.L1_SESSION,
      key,
      timestamp: new Date()
    };
    this.recordOperation(operation);

    return { deleted, layers: deletedFromLayers };
  }

  /**
   * Validate system health and trigger healing if needed
   */
  async validateAndHeal(): Promise<{
    validation: Record<MemoryLayer, any>;
    healing: Record<MemoryLayer, number>;
    recommendations: string[];
  }> {
    if (!this.config.enableValidation) {
      return { validation: {}, healing: {}, recommendations: ['Validation disabled'] };
    }

    const validation: Record<MemoryLayer, any> = {};
    const healing: Record<MemoryLayer, number> = {};
    const recommendations: string[] = [];

    for (const [layerType, layer] of this.layers.entries()) {
      try {
        // Validate layer
        const validationResult = await this.validationEngine.validateLayer(layer);
        validation[layerType] = validationResult;

        // Auto-heal if enabled and healing is required
        if (this.config.autoHealing && validationResult.healingRequired) {
          const healedCount = await layer.heal();
          healing[layerType] = healedCount;
          
          if (healedCount > 0) {
            recommendations.push(`Healed ${healedCount} entries in ${layerType}`);
          }
        }

        // Add validation recommendations
        recommendations.push(...validationResult.suggestions);

      } catch (error) {
        console.error(`Error validating ${layerType}:`, error);
        validation[layerType] = { error: error.message };
      }
    }

    return { validation, healing, recommendations };
  }

  /**
   * Optimize system performance
   */
  async optimize(): Promise<{
    evolution: any;
    predictiveLoading: any;
    intelligence: any;
    recommendations: string[];
  }> {
    const results = {
      evolution: null,
      predictiveLoading: null,
      intelligence: null,
      recommendations: [] as string[]
    };

    // Evolution optimization
    if (this.config.enableEvolution) {
      try {
        results.evolution = await this.evolutionEngine.evolvePatterns();
        const evolutionTrends = this.evolutionEngine.analyzeEvolutionTrends();
        results.recommendations.push(...evolutionTrends.recommendations);
      } catch (error) {
        console.error('Evolution optimization failed:', error);
      }
    }

    // Predictive loading optimization
    if (this.config.enablePredictiveLoading) {
      try {
        results.predictiveLoading = await this.predictiveEngine.optimizeLoadingPatterns();
        results.recommendations.push(...results.predictiveLoading.recommendations);
      } catch (error) {
        console.error('Predictive loading optimization failed:', error);
      }
    }

    // Intelligence optimization
    if (this.config.enableIntelligenceMultiplier) {
      try {
        results.intelligence = await this.intelligenceEngine.optimizeIntelligence();
        results.recommendations.push(...results.intelligence.recommendations);
      } catch (error) {
        console.error('Intelligence optimization failed:', error);
      }
    }

    return results;
  }

  /**
   * Get comprehensive system metrics
   */
  async getMetrics(): Promise<CNSMetrics> {
    const layerMetrics: Record<MemoryLayer, any> = {};
    
    // Collect layer metrics
    for (const [layerType, layer] of this.layers.entries()) {
      try {
        layerMetrics[layerType] = await layer.getMetrics();
      } catch (error) {
        layerMetrics[layerType] = { error: error.message };
      }
    }

    // Collect engine metrics
    const validationHealth = this.config.enableValidation ? 
      this.validationEngine.getValidationStats() : null;
    
    const evolutionStats = this.config.enableEvolution ? 
      this.evolutionEngine.getEvolutionStats() : null;
    
    const predictionStats = this.config.enablePredictiveLoading ? 
      this.predictiveEngine.getStatistics() : null;
    
    const intelligenceMetrics = this.config.enableIntelligenceMultiplier ? 
      await this.intelligenceEngine.getIntelligenceMetrics() : null;

    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(layerMetrics, validationHealth);
    const systemLoad = this.calculateSystemLoad();

    this.systemMetrics = {
      layerMetrics,
      validationHealth,
      evolutionStats,
      predictionStats,
      intelligenceMetrics,
      overallHealth,
      systemLoad
    };

    return this.systemMetrics;
  }

  /**
   * Get current intelligence multiplier
   */
  getCurrentIntelligence(): CompoundIntelligenceMultiplier | null {
    if (!this.config.enableIntelligenceMultiplier) {
      return null;
    }
    
    return this.intelligenceEngine.getCurrentIntelligence();
  }

  /**
   * Compress layers to optimize storage
   */
  async compress(layers?: MemoryLayer[]): Promise<Record<MemoryLayer, boolean>> {
    const layersToCompress = layers ?? [MemoryLayer.L2_CONTEXT, MemoryLayer.L3_PATTERNS, MemoryLayer.L4_PREDICTIONS];
    const results: Record<MemoryLayer, boolean> = {};

    for (const layerType of layersToCompress) {
      const layer = this.layers.get(layerType);
      if (layer && layer.compressionEnabled) {
        try {
          await layer.compress();
          results[layerType] = true;
        } catch (error) {
          console.error(`Compression failed for ${layerType}:`, error);
          results[layerType] = false;
        }
      } else {
        results[layerType] = false;
      }
    }

    return results;
  }

  /**
   * Clear specific layer or all layers
   */
  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      const layerInstance = this.layers.get(layer);
      if (layerInstance) {
        await layerInstance.clear();
      }
    } else {
      for (const layerInstance of this.layers.values()) {
        await layerInstance.clear();
      }
    }

    // Clear operation history
    this.operationHistory = [];
  }

  /**
   * Shutdown CNS system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down CNS Memory System...');
    
    // Save any pending data
    await this.compress();
    
    // Clear engines
    // (Engines would implement cleanup methods)
    
    console.log('CNS Memory System shutdown complete');
  }

  private initializeLayers(): void {
    this.layers.set(MemoryLayer.L1_SESSION, new L1SessionMemory());
    this.layers.set(MemoryLayer.L2_CONTEXT, new L2ContextMemory());
    this.layers.set(MemoryLayer.L3_PATTERNS, new L3PatternMemory());
    this.layers.set(MemoryLayer.L4_PREDICTIONS, new L4PredictionMemory());
  }

  private initializeEngines(): void {
    this.validationEngine = new ContextValidationEngine();
    this.evolutionEngine = new EvolutionTracking();
    this.predictiveEngine = new PredictiveLoadingEngine(this.layers);
    this.intelligenceEngine = new CompoundIntelligenceEngine(
      this.layers,
      this.validationEngine,
      this.evolutionEngine,
      this.predictiveEngine
    );
  }

  private initializeMetrics(): void {
    this.systemMetrics = {
      layerMetrics: {},
      validationHealth: null,
      evolutionStats: null,
      predictionStats: null,
      intelligenceMetrics: null,
      overallHealth: 1.0,
      systemLoad: 0.0
    };
  }

  private async executeStore<T>(
    key: string,
    value: T,
    layer: MemoryLayer,
    options: any
  ): Promise<MemoryEntry<T>> {
    const layerInstance = this.layers.get(layer);
    if (!layerInstance) {
      throw new Error(`Layer ${layer} not found`);
    }

    return await layerInstance.store(key, value, options);
  }

  private async executeRetrieve<T>(key: string, layer: MemoryLayer): Promise<MemoryEntry<T> | null> {
    const layerInstance = this.layers.get(layer);
    if (!layerInstance) {
      throw new Error(`Invalid layer: ${layer}`);
    }

    return await layerInstance.retrieve<T>(key);
  }

  private calculateComplexity(value: any): number {
    const serialized = JSON.stringify(value);
    const size = serialized.length;
    const depth = this.calculateObjectDepth(value);
    
    return Math.min(1, (size / 10000) + (depth / 20));
  }

  private calculateObjectDepth(obj: any, depth: number = 0): number {
    if (depth > 10 || obj === null || typeof obj !== 'object') {
      return depth;
    }

    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      const childDepth = this.calculateObjectDepth(value, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }

    return maxDepth;
  }

  private recordOperation(operation: MemoryOperation): void {
    this.operationHistory.push(operation);
    
    // Keep history manageable
    if (this.operationHistory.length > 10000) {
      this.operationHistory.splice(0, 5000);
    }
  }

  private calculateOverallHealth(layerMetrics: Record<MemoryLayer, any>, validationHealth: any): number {
    let totalHealth = 0;
    let count = 0;

    // Factor in layer health
    for (const metrics of Object.values(layerMetrics)) {
      if (metrics.error) {
        totalHealth += 0.3; // Degraded health for errors
      } else {
        const layerHealth = (metrics.retentionRate ?? 0.5) * (1 - (metrics.size / (metrics.maxSize ?? 1000000)));
        totalHealth += Math.max(0.1, Math.min(1, layerHealth));
      }
      count++;
    }

    // Factor in validation health
    if (validationHealth) {
      totalHealth += validationHealth.recentSuccessRate ?? 0.5;
      count++;
    }

    return count > 0 ? totalHealth / count : 0.5;
  }

  private calculateSystemLoad(): number {
    const recentOps = this.operationHistory.filter(op => 
      Date.now() - op.timestamp.getTime() < 60000 // Last minute
    );

    // Simple load calculation based on operations per minute
    return Math.min(1, recentOps.length / 1000);
  }

  private startSystemMonitoring(): void {
    if (!this.config.metricsCollection) return;

    // Update metrics every 30 seconds
    setInterval(() => {
      this.getMetrics().catch(console.error);
    }, 30000);

    // Run optimization every 10 minutes
    setInterval(() => {
      this.optimize().catch(console.error);
    }, 10 * 60 * 1000);

    // Run validation and healing every hour
    setInterval(() => {
      this.validateAndHeal().catch(console.error);
    }, 60 * 60 * 1000);
  }
}