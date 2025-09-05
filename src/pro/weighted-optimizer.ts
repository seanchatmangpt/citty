// Weighted Optimizer - 80/20 Rule Implementation
import type { WeightedOptimizer, WeightedStrategy } from '../types/citty-pro';

export class WeightedOptimizerImpl implements WeightedOptimizer {
  public strategies: WeightedStrategy[] = [];
  public threshold: number;
  private performanceHistory: Map<string, number[]> = new Map();
  
  constructor(threshold = 0.8) { // 80% threshold by default
    this.threshold = threshold;
    this.initializeDefaultStrategies();
  }
  
  private initializeDefaultStrategies(): void {
    // Default strategies following 80/20 principle
    this.strategies = [
      {
        id: 'high-impact',
        weight: 10,
        priority: 'critical',
        evaluate: (metrics) => {
          // High impact items get maximum score
          const impact = metrics.impact || metrics.importance || 0;
          return impact > 80 ? 100 : impact;
        }
      },
      {
        id: 'quick-wins',
        weight: 8,
        priority: 'high',
        evaluate: (metrics) => {
          // Quick wins: Low effort, good return
          const effort = metrics.effort || metrics.complexity || 50;
          const value = metrics.value || metrics.benefit || 50;
          return effort < 20 && value > 60 ? 90 : (value - effort) / 2;
        }
      },
      {
        id: 'core-functionality',
        weight: 7,
        priority: 'high',
        evaluate: (metrics) => {
          // Core features always get good scores
          const isCore = metrics.core || metrics.essential || false;
          const usage = metrics.usage || metrics.frequency || 0;
          return isCore ? 85 : usage > 70 ? 70 : usage;
        }
      },
      {
        id: 'performance-critical',
        weight: 6,
        priority: 'medium',
        evaluate: (metrics) => {
          // Performance-critical paths
          const latency = metrics.latency || 0;
          const throughput = metrics.throughput || 0;
          return latency < 100 ? 80 : throughput > 1000 ? 70 : 50;
        }
      },
      {
        id: 'user-facing',
        weight: 5,
        priority: 'medium',
        evaluate: (metrics) => {
          // User-facing features get priority
          const userImpact = metrics.userImpact || metrics.visibility || 0;
          return userImpact > 50 ? userImpact : userImpact * 0.8;
        }
      },
      {
        id: 'low-priority',
        weight: 1,
        priority: 'low',
        evaluate: (metrics) => {
          // Everything else gets minimal weight
          return metrics.priority === 'low' ? 10 : 20;
        }
      }
    ];
  }
  
  optimize(input: any[], metrics?: Record<string, number>): any[] {
    if (!input || input.length === 0) {
      return input;
    }
    
    // Apply 80/20 rule: Focus on the 20% that gives 80% value
    const cutoffIndex = Math.ceil(input.length * 0.2);
    
    // Score and sort items
    const scored = input.map(item => {
      const itemMetrics = this.extractMetrics(item, metrics);
      const score = this.calculateScore(itemMetrics);
      
      // Track performance for learning
      const itemId = this.getItemId(item);
      if (!this.performanceHistory.has(itemId)) {
        this.performanceHistory.set(itemId, []);
      }
      this.performanceHistory.get(itemId)!.push(score);
      
      return { item, score, metrics: itemMetrics };
    });
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    
    // Apply threshold - take items until we reach 80% of total value
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    const targetScore = totalScore * this.threshold;
    
    let accumulatedScore = 0;
    let optimizedCount = 0;
    
    for (const s of scored) {
      accumulatedScore += s.score;
      optimizedCount++;
      
      if (accumulatedScore >= targetScore) {
        break;
      }
    }
    
    // Ensure we at least take the minimum (20% rule)
    optimizedCount = Math.max(optimizedCount, cutoffIndex);
    
    // Return optimized items with metadata
    const optimized = scored.slice(0, optimizedCount).map(s => ({
      ...s.item,
      _optimized: true,
      _score: s.score,
      _rank: scored.indexOf(s) + 1
    }));
    
    const rest = scored.slice(optimizedCount).map(s => ({
      ...s.item,
      _optimized: false,
      _score: s.score,
      _rank: scored.indexOf(s) + 1
    }));
    
    return [...optimized, ...rest];
  }
  
  private extractMetrics(item: any, globalMetrics?: Record<string, number>): Record<string, number> {
    const metrics: Record<string, number> = { ...globalMetrics };
    
    // Extract metrics from item properties
    if (typeof item === 'object' && item !== null) {
      // Common metric properties
      const metricProps = [
        'priority', 'importance', 'impact', 'value', 'benefit',
        'effort', 'complexity', 'cost', 'risk',
        'usage', 'frequency', 'latency', 'throughput',
        'userImpact', 'visibility', 'core', 'essential'
      ];
      
      for (const prop of metricProps) {
        if (prop in item) {
          const value = item[prop];
          if (typeof value === 'number') {
            metrics[prop] = value;
          } else if (typeof value === 'boolean') {
            metrics[prop] = value ? 100 : 0;
          } else if (prop === 'priority') {
            // Map priority strings to numbers
            const priorityMap: Record<string, number> = {
              critical: 100,
              high: 75,
              medium: 50,
              low: 25
            };
            metrics[prop] = priorityMap[value] || 50;
          }
        }
      }
    }
    
    // Apply historical learning
    const itemId = this.getItemId(item);
    const history = this.performanceHistory.get(itemId);
    if (history && history.length > 0) {
      // Use historical average as a factor
      const avgScore = history.reduce((a, b) => a + b, 0) / history.length;
      metrics.historicalScore = avgScore;
    }
    
    return metrics;
  }
  
  private calculateScore(metrics: Record<string, number>): number {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const strategy of this.strategies) {
      const strategyScore = strategy.evaluate(metrics);
      const weightedScore = strategyScore * strategy.weight;
      
      totalScore += weightedScore;
      totalWeight += strategy.weight;
    }
    
    // Normalize score to 0-100
    return totalWeight > 0 ? (totalScore / totalWeight) : 50;
  }
  
  private getItemId(item: any): string {
    // Generate consistent ID for items
    if (typeof item === 'object' && item !== null) {
      if ('id' in item) return String(item.id);
      if ('name' in item) return String(item.name);
      if ('key' in item) return String(item.key);
    }
    
    // Fallback to JSON hash
    return JSON.stringify(item).substring(0, 20);
  }
  
  rebalance(feedback: { id: string; score: number }[]): void {
    // Adjust strategy weights based on feedback
    for (const { id, score } of feedback) {
      const strategy = this.strategies.find(s => s.id === id);
      if (strategy) {
        // Positive feedback increases weight, negative decreases
        const adjustment = score > 50 ? 1.1 : 0.9;
        strategy.weight = Math.max(1, Math.min(10, strategy.weight * adjustment));
        
        // Adjust priority based on performance
        if (score > 80 && strategy.priority !== 'critical') {
          strategy.priority = 'high';
        } else if (score < 30 && strategy.priority !== 'low') {
          strategy.priority = 'medium';
        }
      }
    }
    
    // Re-sort strategies by weight
    this.strategies.sort((a, b) => b.weight - a.weight);
  }
  
  // Add custom strategy
  addStrategy(strategy: WeightedStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.weight - a.weight);
  }
  
  // Remove strategy
  removeStrategy(id: string): boolean {
    const index = this.strategies.findIndex(s => s.id === id);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }
  
  // Get optimization statistics
  getStatistics(): Record<string, any> {
    const totalItems = Array.from(this.performanceHistory.values()).reduce((sum, h) => sum + h.length, 0);
    const avgScores = Array.from(this.performanceHistory.values()).map(history => 
      history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0
    );
    
    return {
      threshold: this.threshold,
      strategyCount: this.strategies.length,
      totalItemsProcessed: totalItems,
      uniqueItems: this.performanceHistory.size,
      averageScore: avgScores.length > 0 ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length : 0,
      topStrategy: this.strategies[0]?.id || 'none',
      strategyWeights: this.strategies.reduce((acc, s) => {
        acc[s.id] = s.weight;
        return acc;
      }, {} as Record<string, number>)
    };
  }
  
  // Clear history (for memory management)
  clearHistory(): void {
    this.performanceHistory.clear();
  }
}

export function createOptimizer(threshold = 0.8): WeightedOptimizer {
  return new WeightedOptimizerImpl(threshold);
}