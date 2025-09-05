import { EvolutionTrackingData, MemoryEntry, MemoryLayer } from '../interfaces/memory-types';
import { IMemoryLayer } from '../interfaces/memory-layer-interface';

interface EvolutionPattern {
  id: string;
  type: 'usage' | 'performance' | 'adaptation' | 'learning' | 'optimization';
  generation: number;
  fitness: number;
  parentId?: string;
  childrenIds: string[];
  mutations: EvolutionMutation[];
  createdAt: Date;
  lastEvolution: Date;
}

interface EvolutionMutation {
  id: string;
  type: 'add' | 'modify' | 'remove' | 'combine' | 'split';
  target: string;
  impact: number;
  timestamp: Date;
  success: boolean;
}

interface FitnessMetrics {
  efficiency: number;
  accuracy: number;
  speed: number;
  resourceUsage: number;
  adaptability: number;
}

interface EvolutionEnvironment {
  pressure: number;
  mutationRate: number;
  selectionCriteria: string[];
  survivalThreshold: number;
}

/**
 * Evolution Tracking Engine
 * Monitors and guides the evolution of memory patterns and behaviors
 * Implements genetic algorithms for optimization
 */
export class EvolutionTracking {
  private patterns = new Map<string, EvolutionPattern>();
  private generations = new Map<number, string[]>(); // generation -> pattern IDs
  private mutationHistory: EvolutionMutation[] = [];
  private environment: EvolutionEnvironment = {
    pressure: 0.5,
    mutationRate: 0.1,
    selectionCriteria: ['efficiency', 'accuracy', 'speed'],
    survivalThreshold: 0.6
  };

  private currentGeneration = 0;
  private evolutionStats = {
    totalEvolutions: 0,
    successfulMutations: 0,
    extinctions: 0,
    avgFitness: 0
  };

  constructor() {
    this.initializeEvolutionEnvironment();
    this.startEvolutionLoop();
  }

  /**
   * Track evolution of a memory pattern
   */
  async trackEvolution(
    patternId: string,
    layer: MemoryLayer,
    metrics: FitnessMetrics,
    parentId?: string
  ): Promise<EvolutionTrackingData> {
    const existingPattern = this.patterns.get(patternId);
    
    if (existingPattern) {
      return this.updateExistingPattern(existingPattern, metrics);
    } else {
      return this.createNewPattern(patternId, layer, metrics, parentId);
    }
  }

  /**
   * Evolve patterns based on environmental pressure
   */
  async evolvePatterns(): Promise<{ evolved: number, extinct: number, created: number }> {
    const currentPatterns = Array.from(this.patterns.values());
    let evolved = 0;
    let extinct = 0;
    let created = 0;

    // Selection phase - remove unfit patterns
    for (const pattern of currentPatterns) {
      if (pattern.fitness < this.environment.survivalThreshold) {
        if (this.shouldExtinguish(pattern)) {
          this.patterns.delete(pattern.id);
          extinct++;
          this.evolutionStats.extinctions++;
        }
      }
    }

    // Mutation phase - modify existing patterns
    for (const pattern of currentPatterns) {
      if (this.patterns.has(pattern.id)) { // Still exists after selection
        if (Math.random() < this.environment.mutationRate) {
          const mutated = await this.mutatePattern(pattern);
          if (mutated) {
            evolved++;
            this.evolutionStats.successfulMutations++;
          }
        }
      }
    }

    // Crossover phase - create new patterns from successful ones
    const topPatterns = currentPatterns
      .filter(p => this.patterns.has(p.id))
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, Math.floor(currentPatterns.length * 0.3));

    for (let i = 0; i < topPatterns.length - 1; i += 2) {
      if (Math.random() < 0.3) { // 30% crossover chance
        const offspring = await this.crossoverPatterns(topPatterns[i], topPatterns[i + 1]);
        if (offspring) {
          created++;
        }
      }
    }

    this.currentGeneration++;
    this.evolutionStats.totalEvolutions++;
    this.updateEnvironmentalPressure();

    return { evolved, extinct, created };
  }

  /**
   * Get evolution insights for a specific pattern
   */
  getPatternEvolution(patternId: string): EvolutionTrackingData | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;

    return {
      patternId,
      evolution: {
        stage: pattern.generation,
        mutations: pattern.mutations.length,
        fitness: pattern.fitness,
        parentId: pattern.parentId,
        childrenIds: pattern.childrenIds
      },
      performance: {
        accuracy: this.calculatePatternAccuracy(pattern),
        speed: this.calculatePatternSpeed(pattern),
        efficiency: this.calculatePatternEfficiency(pattern)
      },
      adaptations: pattern.mutations.map(m => ({
        timestamp: m.timestamp,
        type: m.type,
        reason: this.getMutationReason(m),
        impact: m.impact
      }))
    };
  }

  /**
   * Analyze evolution trends across all patterns
   */
  analyzeEvolutionTrends(): {
    overallFitness: number;
    generationStats: Array<{ generation: number, avgFitness: number, patternCount: number }>;
    topPerformers: string[];
    evolutionPressure: number;
    recommendations: string[];
  } {
    const generations = Array.from(this.generations.entries())
      .map(([gen, patternIds]) => ({
        generation: gen,
        avgFitness: this.calculateGenerationFitness(patternIds),
        patternCount: patternIds.length
      }))
      .sort((a, b) => a.generation - b.generation);

    const topPerformers = Array.from(this.patterns.values())
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, 5)
      .map(p => p.id);

    const overallFitness = this.calculateOverallFitness();
    const recommendations = this.generateEvolutionRecommendations();

    return {
      overallFitness,
      generationStats: generations,
      topPerformers,
      evolutionPressure: this.environment.pressure,
      recommendations
    };
  }

  /**
   * Optimize evolution environment based on performance
   */
  optimizeEnvironment(): void {
    const recentPerformance = this.getRecentPerformanceMetrics();
    
    // Adjust mutation rate based on success rate
    if (recentPerformance.mutationSuccessRate < 0.3) {
      this.environment.mutationRate *= 0.9; // Reduce mutation rate
    } else if (recentPerformance.mutationSuccessRate > 0.7) {
      this.environment.mutationRate *= 1.1; // Increase mutation rate
    }

    // Adjust environmental pressure based on diversity
    if (recentPerformance.diversityIndex < 0.5) {
      this.environment.pressure *= 0.9; // Reduce pressure to preserve diversity
    } else if (recentPerformance.diversityIndex > 0.8) {
      this.environment.pressure *= 1.1; // Increase pressure for better fitness
    }

    // Adjust survival threshold based on overall fitness
    if (recentPerformance.avgFitness < 0.6) {
      this.environment.survivalThreshold *= 0.95; // Lower threshold
    } else if (recentPerformance.avgFitness > 0.8) {
      this.environment.survivalThreshold *= 1.05; // Raise threshold
    }

    // Ensure values stay within reasonable bounds
    this.environment.mutationRate = Math.max(0.05, Math.min(0.3, this.environment.mutationRate));
    this.environment.pressure = Math.max(0.2, Math.min(0.8, this.environment.pressure));
    this.environment.survivalThreshold = Math.max(0.3, Math.min(0.9, this.environment.survivalThreshold));
  }

  /**
   * Get detailed evolution statistics
   */
  getEvolutionStats(): {
    totalPatterns: number;
    currentGeneration: number;
    totalEvolutions: number;
    successfulMutations: number;
    extinctions: number;
    avgFitness: number;
    mutationRate: number;
    environmentPressure: number;
    diversityIndex: number;
  } {
    return {
      totalPatterns: this.patterns.size,
      currentGeneration: this.currentGeneration,
      totalEvolutions: this.evolutionStats.totalEvolutions,
      successfulMutations: this.evolutionStats.successfulMutations,
      extinctions: this.evolutionStats.extinctions,
      avgFitness: this.calculateOverallFitness(),
      mutationRate: this.environment.mutationRate,
      environmentPressure: this.environment.pressure,
      diversityIndex: this.calculateDiversityIndex()
    };
  }

  private createNewPattern(
    patternId: string,
    layer: MemoryLayer,
    metrics: FitnessMetrics,
    parentId?: string
  ): EvolutionTrackingData {
    const fitness = this.calculateFitness(metrics);
    const pattern: EvolutionPattern = {
      id: patternId,
      type: this.determinePatternType(layer, metrics),
      generation: parentId ? this.getPatternGeneration(parentId) + 1 : 0,
      fitness,
      parentId,
      childrenIds: [],
      mutations: [],
      createdAt: new Date(),
      lastEvolution: new Date()
    };

    this.patterns.set(patternId, pattern);
    
    // Update parent's children list
    if (parentId) {
      const parent = this.patterns.get(parentId);
      if (parent) {
        parent.childrenIds.push(patternId);
      }
    }

    // Add to generation tracking
    if (!this.generations.has(pattern.generation)) {
      this.generations.set(pattern.generation, []);
    }
    this.generations.get(pattern.generation)!.push(patternId);

    return this.patternToTrackingData(pattern);
  }

  private updateExistingPattern(pattern: EvolutionPattern, metrics: FitnessMetrics): EvolutionTrackingData {
    const newFitness = this.calculateFitness(metrics);
    const fitnessImprovement = newFitness - pattern.fitness;
    
    pattern.fitness = newFitness;
    pattern.lastEvolution = new Date();

    // Record adaptation if significant change
    if (Math.abs(fitnessImprovement) > 0.1) {
      const mutation: EvolutionMutation = {
        id: `adapt_${Date.now()}`,
        type: 'modify',
        target: 'fitness',
        impact: fitnessImprovement,
        timestamp: new Date(),
        success: fitnessImprovement > 0
      };

      pattern.mutations.push(mutation);
      this.mutationHistory.push(mutation);
    }

    return this.patternToTrackingData(pattern);
  }

  private async mutatePattern(pattern: EvolutionPattern): Promise<boolean> {
    const mutationType = this.selectMutationType();
    const mutation: EvolutionMutation = {
      id: `mut_${Date.now()}`,
      type: mutationType,
      target: this.selectMutationTarget(pattern),
      impact: 0,
      timestamp: new Date(),
      success: false
    };

    try {
      const oldFitness = pattern.fitness;
      
      switch (mutationType) {
        case 'add':
          await this.addMutation(pattern);
          break;
        case 'modify':
          await this.modifyMutation(pattern);
          break;
        case 'remove':
          await this.removeMutation(pattern);
          break;
        case 'combine':
          await this.combineMutation(pattern);
          break;
        case 'split':
          await this.splitMutation(pattern);
          break;
      }

      // Recalculate fitness after mutation
      const newFitness = this.evaluatePatternFitness(pattern);
      mutation.impact = newFitness - oldFitness;
      mutation.success = mutation.impact > -0.05; // Accept small negative impacts
      
      pattern.fitness = newFitness;
      pattern.mutations.push(mutation);
      this.mutationHistory.push(mutation);
      
      return mutation.success;
    } catch (error) {
      mutation.success = false;
      pattern.mutations.push(mutation);
      this.mutationHistory.push(mutation);
      return false;
    }
  }

  private async crossoverPatterns(parent1: EvolutionPattern, parent2: EvolutionPattern): Promise<boolean> {
    const offspringId = `offspring_${parent1.id}_${parent2.id}_${Date.now()}`;
    
    // Combine traits from both parents
    const combinedFitness = (parent1.fitness + parent2.fitness) / 2;
    const randomVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
    
    const offspring: EvolutionPattern = {
      id: offspringId,
      type: Math.random() > 0.5 ? parent1.type : parent2.type,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      fitness: Math.max(0, combinedFitness + randomVariation),
      parentId: Math.random() > 0.5 ? parent1.id : parent2.id,
      childrenIds: [],
      mutations: [],
      createdAt: new Date(),
      lastEvolution: new Date()
    };

    this.patterns.set(offspringId, offspring);
    
    // Update both parents' children lists
    parent1.childrenIds.push(offspringId);
    parent2.childrenIds.push(offspringId);

    return true;
  }

  private calculateFitness(metrics: FitnessMetrics): number {
    // Weighted fitness calculation
    const weights = {
      efficiency: 0.25,
      accuracy: 0.30,
      speed: 0.20,
      resourceUsage: 0.15,
      adaptability: 0.10
    };

    return (
      metrics.efficiency * weights.efficiency +
      metrics.accuracy * weights.accuracy +
      metrics.speed * weights.speed +
      (1 - metrics.resourceUsage) * weights.resourceUsage + // Lower resource usage is better
      metrics.adaptability * weights.adaptability
    );
  }

  private determinePatternType(layer: MemoryLayer, metrics: FitnessMetrics): EvolutionPattern['type'] {
    if (metrics.adaptability > 0.8) return 'adaptation';
    if (metrics.accuracy > 0.85 && layer === MemoryLayer.L4_PREDICTIONS) return 'learning';
    if (metrics.speed > 0.9) return 'performance';
    if (metrics.efficiency > 0.8) return 'optimization';
    return 'usage';
  }

  private getPatternGeneration(patternId: string): number {
    const pattern = this.patterns.get(patternId);
    return pattern ? pattern.generation : 0;
  }

  private patternToTrackingData(pattern: EvolutionPattern): EvolutionTrackingData {
    return {
      patternId: pattern.id,
      evolution: {
        stage: pattern.generation,
        mutations: pattern.mutations.length,
        fitness: pattern.fitness,
        parentId: pattern.parentId,
        childrenIds: pattern.childrenIds
      },
      performance: {
        accuracy: this.calculatePatternAccuracy(pattern),
        speed: this.calculatePatternSpeed(pattern),
        efficiency: this.calculatePatternEfficiency(pattern)
      },
      adaptations: pattern.mutations.map(m => ({
        timestamp: m.timestamp,
        type: m.type,
        reason: this.getMutationReason(m),
        impact: m.impact
      }))
    };
  }

  private calculatePatternAccuracy(pattern: EvolutionPattern): number {
    // Extract accuracy from fitness and mutations
    return Math.min(1, pattern.fitness + 0.1);
  }

  private calculatePatternSpeed(pattern: EvolutionPattern): number {
    // Speed based on mutation frequency and success
    const recentMutations = pattern.mutations.filter(m => 
      Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );
    return Math.max(0.1, 1 - recentMutations.length * 0.1);
  }

  private calculatePatternEfficiency(pattern: EvolutionPattern): number {
    // Efficiency based on fitness to mutation ratio
    const mutationCount = pattern.mutations.length;
    if (mutationCount === 0) return pattern.fitness;
    return Math.min(1, pattern.fitness / (mutationCount * 0.1));
  }

  private getMutationReason(mutation: EvolutionMutation): string {
    const reasons = {
      add: 'Environmental pressure',
      modify: 'Performance optimization',
      remove: 'Resource constraints',
      combine: 'Efficiency improvement',
      split: 'Specialization'
    };
    return reasons[mutation.type] || 'Unknown';
  }

  private shouldExtinguish(pattern: EvolutionPattern): boolean {
    // Don't extinguish if it has successful children
    if (pattern.childrenIds.length > 0) {
      const hasSuccessfulChildren = pattern.childrenIds.some(childId => {
        const child = this.patterns.get(childId);
        return child && child.fitness > pattern.fitness;
      });
      if (hasSuccessfulChildren) return false;
    }

    // Don't extinguish if recently created
    const ageInMinutes = (Date.now() - pattern.createdAt.getTime()) / 60000;
    if (ageInMinutes < 60) return false; // Give patterns at least 1 hour

    // Extinguish based on fitness and stagnation
    const stagnationPeriod = Date.now() - pattern.lastEvolution.getTime();
    const stagnationHours = stagnationPeriod / 3600000;
    
    return pattern.fitness < this.environment.survivalThreshold && stagnationHours > 24;
  }

  private selectMutationType(): EvolutionMutation['type'] {
    const types: EvolutionMutation['type'][] = ['add', 'modify', 'remove', 'combine', 'split'];
    const weights = [0.25, 0.35, 0.15, 0.15, 0.10]; // Favor modify and add
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return types[i];
      }
    }
    
    return 'modify';
  }

  private selectMutationTarget(pattern: EvolutionPattern): string {
    const targets = ['fitness', 'efficiency', 'accuracy', 'speed', 'adaptability'];
    return targets[Math.floor(Math.random() * targets.length)];
  }

  private async addMutation(pattern: EvolutionPattern): Promise<void> {
    // Add new capability or optimize existing one
    pattern.fitness += Math.random() * 0.1 - 0.05; // ±5% change
  }

  private async modifyMutation(pattern: EvolutionPattern): Promise<void> {
    // Modify existing behavior
    pattern.fitness += Math.random() * 0.2 - 0.1; // ±10% change
  }

  private async removeMutation(pattern: EvolutionPattern): Promise<void> {
    // Remove inefficient behavior
    pattern.fitness += Math.random() * 0.05; // Small positive change
  }

  private async combineMutation(pattern: EvolutionPattern): Promise<void> {
    // Combine with another pattern's traits
    pattern.fitness += Math.random() * 0.15 - 0.05; // Mostly positive
  }

  private async splitMutation(pattern: EvolutionPattern): Promise<void> {
    // Specialize functionality
    pattern.fitness += Math.random() * 0.1 - 0.02; // Slightly positive bias
  }

  private evaluatePatternFitness(pattern: EvolutionPattern): number {
    // Re-evaluate fitness based on current state
    return Math.max(0, Math.min(1, pattern.fitness));
  }

  private calculateGenerationFitness(patternIds: string[]): number {
    if (patternIds.length === 0) return 0;
    
    const totalFitness = patternIds.reduce((sum, id) => {
      const pattern = this.patterns.get(id);
      return sum + (pattern ? pattern.fitness : 0);
    }, 0);
    
    return totalFitness / patternIds.length;
  }

  private calculateOverallFitness(): number {
    if (this.patterns.size === 0) return 0;
    
    const totalFitness = Array.from(this.patterns.values())
      .reduce((sum, pattern) => sum + pattern.fitness, 0);
    
    return totalFitness / this.patterns.size;
  }

  private calculateDiversityIndex(): number {
    const types = new Map<string, number>();
    
    for (const pattern of this.patterns.values()) {
      types.set(pattern.type, (types.get(pattern.type) ?? 0) + 1);
    }
    
    if (types.size <= 1) return 0;
    
    // Shannon diversity index
    const total = this.patterns.size;
    let diversity = 0;
    
    for (const count of types.values()) {
      const proportion = count / total;
      diversity -= proportion * Math.log2(proportion);
    }
    
    return diversity / Math.log2(types.size); // Normalized to 0-1
  }

  private getRecentPerformanceMetrics(): {
    mutationSuccessRate: number;
    diversityIndex: number;
    avgFitness: number;
  } {
    const recentMutations = this.mutationHistory.filter(m =>
      Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );
    
    const successfulMutations = recentMutations.filter(m => m.success).length;
    const mutationSuccessRate = recentMutations.length > 0 ? successfulMutations / recentMutations.length : 0;
    
    return {
      mutationSuccessRate,
      diversityIndex: this.calculateDiversityIndex(),
      avgFitness: this.calculateOverallFitness()
    };
  }

  private generateEvolutionRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getRecentPerformanceMetrics();
    
    if (stats.avgFitness < 0.6) {
      recommendations.push('Overall fitness is low - consider adjusting environmental pressure');
    }
    
    if (stats.mutationSuccessRate < 0.3) {
      recommendations.push('Mutation success rate is low - reduce mutation rate or improve selection criteria');
    }
    
    if (stats.diversityIndex < 0.4) {
      recommendations.push('Pattern diversity is low - reduce environmental pressure to preserve variety');
    }
    
    if (this.patterns.size < 10) {
      recommendations.push('Pattern population is small - encourage more pattern creation');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Evolution system is performing optimally');
    }
    
    return recommendations;
  }

  private updateEnvironmentalPressure(): void {
    // Gradually adjust pressure based on population and performance
    const populationPressure = Math.max(0, (this.patterns.size - 50) / 100); // Pressure increases with population
    const performancePressure = Math.max(0, 1 - this.calculateOverallFitness()); // Pressure decreases with performance
    
    this.environment.pressure = Math.max(0.2, Math.min(0.8,
      (populationPressure + performancePressure) / 2
    ));
  }

  private initializeEvolutionEnvironment(): void {
    // Set up initial environment parameters
    this.environment = {
      pressure: 0.5,
      mutationRate: 0.1,
      selectionCriteria: ['efficiency', 'accuracy', 'speed'],
      survivalThreshold: 0.6
    };
  }

  private startEvolutionLoop(): void {
    // Run evolution cycle every 30 minutes
    setInterval(() => {
      this.evolvePatterns()
        .then(results => {
          console.log('Evolution cycle completed:', results);
          this.optimizeEnvironment();
        })
        .catch(console.error);
    }, 30 * 60 * 1000);
  }
}