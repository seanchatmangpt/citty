import { CompoundIntelligenceMultiplier, MemoryLayer } from '../interfaces/memory-types';
import { IMemoryLayer } from '../interfaces/memory-layer-interface';
import { ContextValidationEngine } from './context-validation-engine';
import { EvolutionTracking } from './evolution-tracking';
import { PredictiveLoadingEngine } from './predictive-loading';

interface IntelligenceComponent {
  id: string;
  type: 'contextual' | 'predictive' | 'adaptive' | 'collaborative';
  weight: number;
  performance: number;
  contribution: number;
  lastUpdate: Date;
}

interface SynergyPattern {
  components: string[];
  multiplier: number;
  confidence: number;
  frequency: number;
  effectiveness: number;
}

interface IntelligenceMetrics {
  overallIntelligence: number;
  componentBreakdown: Record<string, number>;
  synergyEffects: Record<string, number>;
  improvementRate: number;
  optimalConfiguration: Record<string, number>;
}

/**
 * Compound Intelligence Multiplier Engine
 * Combines and amplifies intelligence from multiple sources:
 * - Contextual intelligence from validation patterns
 * - Predictive intelligence from loading patterns
 * - Adaptive intelligence from evolution tracking
 * - Collaborative intelligence from cross-layer synergies
 */
export class CompoundIntelligenceEngine {
  private components = new Map<string, IntelligenceComponent>();
  private synergyPatterns = new Map<string, SynergyPattern>();
  private intelligenceHistory: Array<{ timestamp: Date, intelligence: CompoundIntelligenceMultiplier }> = [];
  
  private currentMultiplier: CompoundIntelligenceMultiplier = {
    baseIntelligence: 1.0,
    multipliers: {
      contextual: 1.0,
      predictive: 1.0,
      adaptive: 1.0,
      collaborative: 1.0
    },
    totalMultiplier: 1.0,
    effectiveness: 1.0
  };

  constructor(
    private layers: Map<MemoryLayer, IMemoryLayer>,
    private validationEngine: ContextValidationEngine,
    private evolutionEngine: EvolutionTracking,
    private predictiveEngine: PredictiveLoadingEngine
  ) {
    this.initializeComponents();
    this.startIntelligenceLoop();
  }

  /**
   * Calculate current compound intelligence multiplier
   */
  async calculateIntelligenceMultiplier(): Promise<CompoundIntelligenceMultiplier> {
    // Update component performances
    await this.updateComponentPerformances();
    
    // Calculate individual multipliers
    const contextual = await this.calculateContextualMultiplier();
    const predictive = await this.calculatePredictiveMultiplier();
    const adaptive = await this.calculateAdaptiveMultiplier();
    const collaborative = await this.calculateCollaborativeMultiplier();
    
    // Apply synergy effects
    const synergyBonus = this.calculateSynergyBonus([
      contextual, predictive, adaptive, collaborative
    ]);
    
    // Calculate total multiplier
    const totalMultiplier = (contextual * predictive * adaptive * collaborative) + synergyBonus;
    
    // Calculate effectiveness based on historical performance
    const effectiveness = this.calculateEffectiveness(totalMultiplier);
    
    this.currentMultiplier = {
      baseIntelligence: 1.0,
      multipliers: {
        contextual,
        predictive,
        adaptive,
        collaborative
      },
      totalMultiplier,
      effectiveness
    };
    
    // Record in history
    this.intelligenceHistory.push({
      timestamp: new Date(),
      intelligence: { ...this.currentMultiplier }
    });
    
    // Limit history size
    if (this.intelligenceHistory.length > 1000) {
      this.intelligenceHistory.splice(0, 500);
    }
    
    return this.currentMultiplier;
  }

  /**
   * Get current intelligence state
   */
  getCurrentIntelligence(): CompoundIntelligenceMultiplier {
    return { ...this.currentMultiplier };
  }

  /**
   * Optimize intelligence configuration
   */
  async optimizeIntelligence(): Promise<{
    optimizations: string[];
    expectedGains: Record<string, number>;
    recommendations: string[];
  }> {
    const analysis = await this.analyzeIntelligencePatterns();
    const optimizations: string[] = [];
    const expectedGains: Record<string, number> = {};
    const recommendations: string[] = [];

    // Optimize component weights
    for (const [componentId, component] of this.components.entries()) {
      const optimalWeight = this.calculateOptimalWeight(component);
      const currentWeight = component.weight;
      
      if (Math.abs(optimalWeight - currentWeight) > 0.1) {
        component.weight = optimalWeight;
        const improvement = Math.abs(optimalWeight - currentWeight) * component.performance;
        expectedGains[componentId] = improvement;
        optimizations.push(`Adjusted ${componentId} weight from ${currentWeight.toFixed(2)} to ${optimalWeight.toFixed(2)}`);
      }
    }

    // Identify and strengthen beneficial synergies
    for (const [patternId, pattern] of this.synergyPatterns.entries()) {
      if (pattern.effectiveness > 1.2 && pattern.frequency > 10) {
        const strengthening = Math.min(0.5, (pattern.effectiveness - 1.0) * 0.1);
        pattern.multiplier += strengthening;
        optimizations.push(`Strengthened synergy pattern: ${patternId}`);
        expectedGains[`synergy_${patternId}`] = strengthening;
      }
    }

    // Generate recommendations based on analysis
    if (analysis.underperformingComponents.length > 0) {
      recommendations.push(`Focus on improving: ${analysis.underperformingComponents.join(', ')}`);
    }

    if (analysis.missingSynergies.length > 0) {
      recommendations.push(`Explore synergies between: ${analysis.missingSynergies.join(', ')}`);
    }

    if (analysis.improvementRate < 0.05) {
      recommendations.push('Intelligence growth is stagnating - consider introducing new components');
    }

    return { optimizations, expectedGains, recommendations };
  }

  /**
   * Predict intelligence evolution
   */
  async predictIntelligenceEvolution(timeHorizon: number = 7): Promise<{
    prediction: CompoundIntelligenceMultiplier;
    confidence: number;
    keyFactors: string[];
    scenarios: Array<{ name: string; multiplier: CompoundIntelligenceMultiplier; probability: number }>;
  }> {
    if (this.intelligenceHistory.length < 10) {
      return {
        prediction: this.currentMultiplier,
        confidence: 0.1,
        keyFactors: ['Insufficient historical data'],
        scenarios: []
      };
    }

    const trends = this.analyzeIntelligenceTrends();
    const prediction = this.extrapolateTrends(trends, timeHorizon);
    const confidence = this.calculatePredictionConfidence(trends);
    
    // Identify key factors influencing evolution
    const keyFactors = this.identifyKeyFactors(trends);
    
    // Generate scenarios
    const scenarios = this.generateEvolutionScenarios(prediction, trends);
    
    return { prediction, confidence, keyFactors, scenarios };
  }

  /**
   * Get detailed intelligence metrics
   */
  async getIntelligenceMetrics(): Promise<IntelligenceMetrics> {
    const componentBreakdown: Record<string, number> = {};
    for (const [id, component] of this.components.entries()) {
      componentBreakdown[id] = component.performance * component.weight;
    }

    const synergyEffects: Record<string, number> = {};
    for (const [id, pattern] of this.synergyPatterns.entries()) {
      synergyEffects[id] = pattern.multiplier * pattern.effectiveness;
    }

    const improvementRate = this.calculateImprovementRate();
    const optimalConfiguration = this.calculateOptimalConfiguration();

    return {
      overallIntelligence: this.currentMultiplier.totalMultiplier,
      componentBreakdown,
      synergyEffects,
      improvementRate,
      optimalConfiguration
    };
  }

  /**
   * Apply intelligence boost to a specific operation
   */
  async applyIntelligenceBoost<T>(
    operation: () => Promise<T>,
    context: {
      type: string;
      layer?: MemoryLayer;
      complexity?: number;
      priority?: number;
    }
  ): Promise<{ result: T; multiplier: number; components: string[] }> {
    const startTime = performance.now();
    
    // Select relevant intelligence components
    const relevantComponents = this.selectRelevantComponents(context);
    const contextMultiplier = this.calculateContextMultiplier(relevantComponents, context);
    
    // Apply intelligence enhancement
    const enhancedOperation = this.enhanceOperation(operation, contextMultiplier);
    
    // Execute enhanced operation
    const result = await enhancedOperation();
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Record performance improvement
    this.recordIntelligenceApplication(relevantComponents, contextMultiplier, executionTime);
    
    return {
      result,
      multiplier: contextMultiplier,
      components: relevantComponents.map(c => c.id)
    };
  }

  private initializeComponents(): void {
    // Contextual intelligence component
    this.components.set('contextual', {
      id: 'contextual',
      type: 'contextual',
      weight: 0.25,
      performance: 0.8,
      contribution: 0.2,
      lastUpdate: new Date()
    });

    // Predictive intelligence component
    this.components.set('predictive', {
      id: 'predictive',
      type: 'predictive',
      weight: 0.25,
      performance: 0.75,
      contribution: 0.2,
      lastUpdate: new Date()
    });

    // Adaptive intelligence component
    this.components.set('adaptive', {
      id: 'adaptive',
      type: 'adaptive',
      weight: 0.25,
      performance: 0.85,
      contribution: 0.2,
      lastUpdate: new Date()
    });

    // Collaborative intelligence component
    this.components.set('collaborative', {
      id: 'collaborative',
      type: 'collaborative',
      weight: 0.25,
      performance: 0.7,
      contribution: 0.2,
      lastUpdate: new Date()
    });

    // Initialize synergy patterns
    this.initializeSynergyPatterns();
  }

  private initializeSynergyPatterns(): void {
    // Context-Predictive synergy
    this.synergyPatterns.set('context-predictive', {
      components: ['contextual', 'predictive'],
      multiplier: 1.15,
      confidence: 0.8,
      frequency: 0,
      effectiveness: 1.1
    });

    // Adaptive-Collaborative synergy
    this.synergyPatterns.set('adaptive-collaborative', {
      components: ['adaptive', 'collaborative'],
      multiplier: 1.12,
      confidence: 0.75,
      frequency: 0,
      effectiveness: 1.08
    });

    // Triple synergy: Context-Predictive-Adaptive
    this.synergyPatterns.set('context-predictive-adaptive', {
      components: ['contextual', 'predictive', 'adaptive'],
      multiplier: 1.25,
      confidence: 0.7,
      frequency: 0,
      effectiveness: 1.2
    });

    // Full synergy: All components
    this.synergyPatterns.set('full-synergy', {
      components: ['contextual', 'predictive', 'adaptive', 'collaborative'],
      multiplier: 1.4,
      confidence: 0.6,
      frequency: 0,
      effectiveness: 1.3
    });
  }

  private async updateComponentPerformances(): Promise<void> {
    // Update contextual intelligence performance
    const contextualComponent = this.components.get('contextual')!;
    const validationStats = this.validationEngine.getValidationStats();
    contextualComponent.performance = validationStats.recentSuccessRate;
    contextualComponent.lastUpdate = new Date();

    // Update predictive intelligence performance
    const predictiveComponent = this.components.get('predictive')!;
    const predictiveStats = this.predictiveEngine.getStatistics();
    predictiveComponent.performance = predictiveStats.predictionAccuracy;
    predictiveComponent.lastUpdate = new Date();

    // Update adaptive intelligence performance
    const adaptiveComponent = this.components.get('adaptive')!;
    const evolutionStats = this.evolutionEngine.getEvolutionStats();
    adaptiveComponent.performance = Math.min(1.0, evolutionStats.avgFitness * 1.2);
    adaptiveComponent.lastUpdate = new Date();

    // Update collaborative intelligence performance
    const collaborativeComponent = this.components.get('collaborative')!;
    const layerSynergy = await this.calculateLayerSynergy();
    collaborativeComponent.performance = layerSynergy;
    collaborativeComponent.lastUpdate = new Date();
  }

  private async calculateContextualMultiplier(): Promise<number> {
    const component = this.components.get('contextual')!;
    const baseMultiplier = 1.0 + (component.performance * component.weight);
    
    // Boost based on validation success rate
    const validationStats = this.validationEngine.getValidationStats();
    const validationBoost = validationStats.recentSuccessRate > 0.9 ? 1.1 : 1.0;
    
    return baseMultiplier * validationBoost;
  }

  private async calculatePredictiveMultiplier(): Promise<number> {
    const component = this.components.get('predictive')!;
    const baseMultiplier = 1.0 + (component.performance * component.weight);
    
    // Boost based on cache hit rate
    const predictiveStats = this.predictiveEngine.getStatistics();
    const cacheBoost = predictiveStats.cacheHitRate > 0.8 ? 1.15 : 1.0;
    
    return baseMultiplier * cacheBoost;
  }

  private async calculateAdaptiveMultiplier(): Promise<number> {
    const component = this.components.get('adaptive')!;
    const baseMultiplier = 1.0 + (component.performance * component.weight);
    
    // Boost based on evolution success
    const evolutionTrends = this.evolutionEngine.analyzeEvolutionTrends();
    const evolutionBoost = evolutionTrends.overallFitness > 0.8 ? 1.2 : 1.0;
    
    return baseMultiplier * evolutionBoost;
  }

  private async calculateCollaborativeMultiplier(): Promise<number> {
    const component = this.components.get('collaborative')!;
    const baseMultiplier = 1.0 + (component.performance * component.weight);
    
    // Boost based on cross-layer collaboration
    const collaborationEfficiency = await this.measureCollaborationEfficiency();
    const collaborationBoost = collaborationEfficiency > 0.85 ? 1.1 : 1.0;
    
    return baseMultiplier * collaborationBoost;
  }

  private calculateSynergyBonus(multipliers: number[]): number {
    let totalBonus = 0;
    
    for (const [patternId, pattern] of this.synergyPatterns.entries()) {
      const componentsActive = pattern.components.every(componentId => {
        const component = this.components.get(componentId);
        return component && component.performance > 0.6;
      });
      
      if (componentsActive) {
        const synergyStrength = pattern.multiplier - 1.0;
        const effectiveness = pattern.effectiveness;
        const frequency = Math.min(1.0, pattern.frequency / 100);
        
        const bonus = synergyStrength * effectiveness * frequency;
        totalBonus += bonus;
        
        // Update pattern frequency
        pattern.frequency++;
      }
    }
    
    return totalBonus;
  }

  private calculateEffectiveness(multiplier: number): number {
    if (this.intelligenceHistory.length < 5) return 1.0;
    
    // Calculate effectiveness based on recent performance
    const recentHistory = this.intelligenceHistory.slice(-10);
    const avgRecentMultiplier = recentHistory.reduce((sum, h) => sum + h.intelligence.totalMultiplier, 0) / recentHistory.length;
    
    const improvement = multiplier / avgRecentMultiplier;
    return Math.min(2.0, Math.max(0.5, improvement));
  }

  private async analyzeIntelligencePatterns(): Promise<{
    underperformingComponents: string[];
    missingSynergies: string[];
    improvementRate: number;
  }> {
    const underperformingComponents: string[] = [];
    const missingSynergies: string[] = [];
    
    // Identify underperforming components
    for (const [id, component] of this.components.entries()) {
      if (component.performance < 0.7) {
        underperformingComponents.push(id);
      }
    }
    
    // Identify potential but unused synergies
    for (const [patternId, pattern] of this.synergyPatterns.entries()) {
      if (pattern.frequency < 5 && pattern.effectiveness > 1.1) {
        missingSynergies.push(patternId);
      }
    }
    
    const improvementRate = this.calculateImprovementRate();
    
    return { underperformingComponents, missingSynergies, improvementRate };
  }

  private calculateOptimalWeight(component: IntelligenceComponent): number {
    // Calculate optimal weight based on performance and contribution
    const performanceWeight = component.performance * 0.7;
    const contributionWeight = component.contribution * 0.3;
    
    return Math.min(1.0, Math.max(0.1, performanceWeight + contributionWeight));
  }

  private analyzeIntelligenceTrends(): {
    overall: number;
    components: Record<string, number>;
    volatility: number;
  } {
    if (this.intelligenceHistory.length < 5) {
      return { overall: 0, components: {}, volatility: 0 };
    }
    
    const recentHistory = this.intelligenceHistory.slice(-20);
    
    // Calculate overall trend
    const firstMultiplier = recentHistory[0].intelligence.totalMultiplier;
    const lastMultiplier = recentHistory[recentHistory.length - 1].intelligence.totalMultiplier;
    const overallTrend = (lastMultiplier - firstMultiplier) / recentHistory.length;
    
    // Calculate component trends
    const componentTrends: Record<string, number> = {};
    for (const componentId of ['contextual', 'predictive', 'adaptive', 'collaborative']) {
      const firstValue = recentHistory[0].intelligence.multipliers[componentId as keyof typeof recentHistory[0].intelligence.multipliers];
      const lastValue = recentHistory[recentHistory.length - 1].intelligence.multipliers[componentId as keyof typeof recentHistory[0].intelligence.multipliers];
      componentTrends[componentId] = (lastValue - firstValue) / recentHistory.length;
    }
    
    // Calculate volatility
    const multipliers = recentHistory.map(h => h.intelligence.totalMultiplier);
    const mean = multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length;
    const variance = multipliers.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / multipliers.length;
    const volatility = Math.sqrt(variance);
    
    return { overall: overallTrend, components: componentTrends, volatility };
  }

  private extrapolateTrends(trends: ReturnType<typeof this.analyzeIntelligenceTrends>, days: number): CompoundIntelligenceMultiplier {
    const current = this.currentMultiplier;
    
    // Extrapolate overall multiplier
    const projectedTotal = current.totalMultiplier + (trends.overall * days);
    
    // Extrapolate component multipliers
    const projectedMultipliers = {
      contextual: Math.max(1.0, current.multipliers.contextual + (trends.components.contextual || 0) * days),
      predictive: Math.max(1.0, current.multipliers.predictive + (trends.components.predictive || 0) * days),
      adaptive: Math.max(1.0, current.multipliers.adaptive + (trends.components.adaptive || 0) * days),
      collaborative: Math.max(1.0, current.multipliers.collaborative + (trends.components.collaborative || 0) * days)
    };
    
    return {
      baseIntelligence: current.baseIntelligence,
      multipliers: projectedMultipliers,
      totalMultiplier: Math.max(1.0, projectedTotal),
      effectiveness: current.effectiveness
    };
  }

  private calculatePredictionConfidence(trends: ReturnType<typeof this.analyzeIntelligenceTrends>): number {
    // Base confidence on trend stability (lower volatility = higher confidence)
    const volatilityFactor = Math.max(0.1, 1 - trends.volatility);
    
    // Factor in history length
    const historyFactor = Math.min(1.0, this.intelligenceHistory.length / 50);
    
    return volatilityFactor * historyFactor;
  }

  private identifyKeyFactors(trends: ReturnType<typeof this.analyzeIntelligenceTrends>): string[] {
    const factors: string[] = [];
    
    // Identify most influential components
    const sortedComponents = Object.entries(trends.components)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    
    for (const [component, trend] of sortedComponents.slice(0, 2)) {
      if (Math.abs(trend) > 0.01) {
        factors.push(`${component} intelligence ${trend > 0 ? 'growth' : 'decline'}`);
      }
    }
    
    if (trends.volatility > 0.2) {
      factors.push('High intelligence volatility');
    }
    
    if (factors.length === 0) {
      factors.push('Stable intelligence evolution');
    }
    
    return factors;
  }

  private generateEvolutionScenarios(
    baseline: CompoundIntelligenceMultiplier,
    trends: ReturnType<typeof this.analyzeIntelligenceTrends>
  ): Array<{ name: string; multiplier: CompoundIntelligenceMultiplier; probability: number }> {
    const scenarios = [
      {
        name: 'Optimistic',
        multiplier: {
          ...baseline,
          totalMultiplier: baseline.totalMultiplier * 1.2,
          multipliers: {
            contextual: baseline.multipliers.contextual * 1.15,
            predictive: baseline.multipliers.predictive * 1.2,
            adaptive: baseline.multipliers.adaptive * 1.25,
            collaborative: baseline.multipliers.collaborative * 1.1
          }
        },
        probability: 0.2
      },
      {
        name: 'Pessimistic',
        multiplier: {
          ...baseline,
          totalMultiplier: baseline.totalMultiplier * 0.9,
          multipliers: {
            contextual: baseline.multipliers.contextual * 0.95,
            predictive: baseline.multipliers.predictive * 0.9,
            adaptive: baseline.multipliers.adaptive * 0.85,
            collaborative: baseline.multipliers.collaborative * 0.95
          }
        },
        probability: 0.2
      },
      {
        name: 'Baseline',
        multiplier: baseline,
        probability: 0.6
      }
    ];
    
    return scenarios;
  }

  private calculateImprovementRate(): number {
    if (this.intelligenceHistory.length < 10) return 0;
    
    const recent = this.intelligenceHistory.slice(-10);
    const older = this.intelligenceHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, h) => sum + h.intelligence.totalMultiplier, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.intelligence.totalMultiplier, 0) / older.length;
    
    return (recentAvg - olderAvg) / olderAvg;
  }

  private calculateOptimalConfiguration(): Record<string, number> {
    const optimal: Record<string, number> = {};
    
    // Calculate optimal weights based on performance
    for (const [id, component] of this.components.entries()) {
      optimal[id] = this.calculateOptimalWeight(component);
    }
    
    return optimal;
  }

  private selectRelevantComponents(context: {
    type: string;
    layer?: MemoryLayer;
    complexity?: number;
    priority?: number;
  }): IntelligenceComponent[] {
    const relevant: IntelligenceComponent[] = [];
    
    // Always include contextual for validation
    const contextual = this.components.get('contextual');
    if (contextual) relevant.push(contextual);
    
    // Include predictive for read operations
    if (context.type === 'read' || context.type === 'query') {
      const predictive = this.components.get('predictive');
      if (predictive) relevant.push(predictive);
    }
    
    // Include adaptive for complex operations
    if ((context.complexity ?? 0) > 0.5) {
      const adaptive = this.components.get('adaptive');
      if (adaptive) relevant.push(adaptive);
    }
    
    // Include collaborative for multi-layer operations
    if (context.layer) {
      const collaborative = this.components.get('collaborative');
      if (collaborative) relevant.push(collaborative);
    }
    
    return relevant;
  }

  private calculateContextMultiplier(components: IntelligenceComponent[], context: any): number {
    let multiplier = 1.0;
    
    for (const component of components) {
      const contribution = component.performance * component.weight;
      multiplier += contribution;
    }
    
    // Apply synergy bonuses
    const activeComponentIds = components.map(c => c.id);
    for (const pattern of this.synergyPatterns.values()) {
      if (pattern.components.every(id => activeComponentIds.includes(id))) {
        multiplier *= pattern.multiplier;
      }
    }
    
    return multiplier;
  }

  private enhanceOperation<T>(operation: () => Promise<T>, multiplier: number): () => Promise<T> {
    return async () => {
      // The multiplier effect is conceptual - in practice, this would involve
      // optimizing the operation based on intelligence insights
      return await operation();
    };
  }

  private recordIntelligenceApplication(
    components: IntelligenceComponent[],
    multiplier: number,
    executionTime: number
  ): void {
    // Update component contributions based on results
    for (const component of components) {
      const improvement = (multiplier - 1.0) / components.length;
      component.contribution = (component.contribution + improvement) / 2;
    }
  }

  private async calculateLayerSynergy(): Promise<number> {
    // Measure how well layers work together
    let totalSynergy = 0;
    let count = 0;
    
    for (const [layer1, memoryLayer1] of this.layers.entries()) {
      for (const [layer2, memoryLayer2] of this.layers.entries()) {
        if (layer1 !== layer2) {
          const metrics1 = await memoryLayer1.getMetrics();
          const metrics2 = await memoryLayer2.getMetrics();
          
          // Simple synergy calculation based on complementary performance
          const synergy = 1 - Math.abs(metrics1.retentionRate - metrics2.retentionRate);
          totalSynergy += synergy;
          count++;
        }
      }
    }
    
    return count > 0 ? totalSynergy / count : 0.5;
  }

  private async measureCollaborationEfficiency(): Promise<number> {
    // Measure efficiency of cross-layer operations
    // This is a placeholder - real implementation would measure actual cross-layer performance
    return 0.8;
  }

  private startIntelligenceLoop(): void {
    // Update intelligence every 60 seconds
    setInterval(() => {
      this.calculateIntelligenceMultiplier().catch(console.error);
    }, 60000);
    
    // Optimize intelligence every 10 minutes
    setInterval(() => {
      this.optimizeIntelligence().catch(console.error);
    }, 10 * 60 * 1000);
  }
}