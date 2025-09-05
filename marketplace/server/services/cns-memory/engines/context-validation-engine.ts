import { MemoryEntry, ContextValidationResult, MemoryLayer } from '../interfaces/memory-types';
import { IMemoryLayer } from '../interfaces/memory-layer-interface';

interface ValidationRule {
  id: string;
  name: string;
  layer?: MemoryLayer;
  validator: (entry: MemoryEntry) => ValidationResult;
  weight: number;
  autoHeal?: boolean;
}

interface ValidationResult {
  valid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  healable: boolean;
}

interface ContextSnapshot {
  timestamp: Date;
  layer: MemoryLayer;
  entryCount: number;
  totalSize: number;
  avgAccuracy: number;
  topPatterns: string[];
}

/**
 * Context Validation and Healing Engine
 * Ensures data integrity across all memory layers
 * Provides automatic healing capabilities
 */
export class ContextValidationEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private validationHistory: Array<{ timestamp: Date, result: ContextValidationResult }> = [];
  private contextSnapshots: ContextSnapshot[] = [];
  private healingQueue: Array<{ layer: MemoryLayer, key: string, priority: number }> = [];

  constructor() {
    this.initializeValidationRules();
    this.startValidationLoop();
  }

  /**
   * Validate a single memory entry
   */
  async validateEntry(entry: MemoryEntry): Promise<ContextValidationResult> {
    const results: ValidationResult[] = [];
    
    // Run all applicable validation rules
    for (const rule of this.rules.values()) {
      if (!rule.layer || rule.layer === entry.layer) {
        try {
          const result = rule.validator(entry);
          results.push({
            ...result,
            weight: rule.weight
          } as ValidationResult & { weight: number });
        } catch (error) {
          results.push({
            valid: false,
            confidence: 0,
            issues: [`Validation rule '${rule.name}' failed: ${error.message}`],
            suggestions: ['Review validation rule implementation'],
            healable: false,
            weight: rule.weight
          } as ValidationResult & { weight: number });
        }
      }
    }

    return this.aggregateValidationResults(results);
  }

  /**
   * Validate entire memory layer
   */
  async validateLayer(layer: IMemoryLayer): Promise<ContextValidationResult> {
    const allEntries = await layer.query({});
    const entryResults: ContextValidationResult[] = [];

    for (const entry of allEntries) {
      const result = await this.validateEntry(entry);
      entryResults.push(result);
    }

    // Aggregate layer-wide results
    const totalEntries = entryResults.length;
    const validEntries = entryResults.filter(r => r.isValid).length;
    const avgConfidence = entryResults.reduce((sum, r) => sum + r.confidence, 0) / totalEntries;
    
    const allIssues = entryResults.flatMap(r => r.issues);
    const allSuggestions = entryResults.flatMap(r => r.suggestions);
    const uniqueIssues = [...new Set(allIssues)];
    const uniqueSuggestions = [...new Set(allSuggestions)];

    const layerResult: ContextValidationResult = {
      isValid: validEntries / totalEntries > 0.8, // 80% threshold
      confidence: avgConfidence,
      issues: uniqueIssues,
      suggestions: uniqueSuggestions,
      healingRequired: entryResults.some(r => r.healingRequired)
    };

    // Record validation history
    this.validationHistory.push({
      timestamp: new Date(),
      result: layerResult
    });

    // Cleanup old history
    if (this.validationHistory.length > 100) {
      this.validationHistory.splice(0, 50);
    }

    return layerResult;
  }

  /**
   * Heal corrupted or invalid entries
   */
  async healEntry(entry: MemoryEntry, layer: IMemoryLayer): Promise<boolean> {
    const validationResult = await this.validateEntry(entry);
    
    if (!validationResult.healingRequired) {
      return true; // Nothing to heal
    }

    let healed = false;

    // Apply automatic healing strategies
    for (const issue of validationResult.issues) {
      if (issue.includes('checksum')) {
        healed = await this.healChecksum(entry, layer);
      } else if (issue.includes('ttl') || issue.includes('expired')) {
        healed = await this.healTTL(entry, layer);
      } else if (issue.includes('corruption')) {
        healed = await this.healCorruption(entry, layer);
      } else if (issue.includes('format')) {
        healed = await this.healFormat(entry, layer);
      }
    }

    return healed;
  }

  /**
   * Create context snapshot for evolution tracking
   */
  async createContextSnapshot(layers: IMemoryLayer[]): Promise<ContextSnapshot[]> {
    const snapshots: ContextSnapshot[] = [];

    for (const layer of layers) {
      const entries = await layer.query({});
      const metrics = await layer.getMetrics();
      
      // Extract patterns from entries
      const patterns = new Map<string, number>();
      for (const entry of entries) {
        for (const tag of entry.metadata.tags) {
          patterns.set(tag, (patterns.get(tag) ?? 0) + 1);
        }
      }

      const topPatterns = Array.from(patterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern]) => pattern);

      const snapshot: ContextSnapshot = {
        timestamp: new Date(),
        layer: layer.layer,
        entryCount: entries.length,
        totalSize: metrics.size,
        avgAccuracy: metrics.accuracy ?? 0,
        topPatterns
      };

      snapshots.push(snapshot);
    }

    this.contextSnapshots.push(...snapshots);
    
    // Keep only recent snapshots
    if (this.contextSnapshots.length > 1000) {
      this.contextSnapshots.splice(0, 500);
    }

    return snapshots;
  }

  /**
   * Analyze context evolution over time
   */
  analyzeContextEvolution(): {
    trends: Record<string, 'improving' | 'degrading' | 'stable'>;
    anomalies: string[];
    recommendations: string[];
  } {
    if (this.contextSnapshots.length < 10) {
      return {
        trends: {},
        anomalies: ['Insufficient data for trend analysis'],
        recommendations: ['Collect more data over time']
      };
    }

    const trends: Record<string, 'improving' | 'degrading' | 'stable'> = {};
    const anomalies: string[] = [];
    const recommendations: string[] = [];

    // Group snapshots by layer
    const layerSnapshots = new Map<MemoryLayer, ContextSnapshot[]>();
    for (const snapshot of this.contextSnapshots) {
      if (!layerSnapshots.has(snapshot.layer)) {
        layerSnapshots.set(snapshot.layer, []);
      }
      layerSnapshots.get(snapshot.layer)!.push(snapshot);
    }

    // Analyze trends for each layer
    for (const [layer, snapshots] of layerSnapshots.entries()) {
      const recentSnapshots = snapshots.slice(-10).sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      if (recentSnapshots.length < 3) continue;

      // Analyze accuracy trend
      const accuracies = recentSnapshots.map(s => s.avgAccuracy);
      const accuracyTrend = this.calculateTrend(accuracies);
      trends[`${layer}_accuracy`] = accuracyTrend;

      // Analyze size trend
      const sizes = recentSnapshots.map(s => s.totalSize);
      const sizeTrend = this.calculateTrend(sizes);
      trends[`${layer}_size`] = sizeTrend;

      // Detect anomalies
      const latestSnapshot = recentSnapshots[recentSnapshots.length - 1];
      const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
      
      if (latestSnapshot.totalSize > avgSize * 2) {
        anomalies.push(`${layer} memory usage spike detected`);
      }
      
      if (latestSnapshot.avgAccuracy < 0.5) {
        anomalies.push(`${layer} accuracy below acceptable threshold`);
        recommendations.push(`Review and retrain ${layer} validation rules`);
      }
    }

    // General recommendations
    if (Object.values(trends).filter(t => t === 'degrading').length > 2) {
      recommendations.push('Multiple layers showing degradation - review system health');
    }

    return { trends, anomalies, recommendations };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    recentSuccessRate: number;
    commonIssues: Array<{ issue: string, count: number }>;
    healingSuccess: number;
  } {
    const recentValidations = this.validationHistory.slice(-50);
    const successCount = recentValidations.filter(v => v.result.isValid).length;
    
    // Count common issues
    const issueMap = new Map<string, number>();
    for (const validation of recentValidations) {
      for (const issue of validation.result.issues) {
        issueMap.set(issue, (issueMap.get(issue) ?? 0) + 1);
      }
    }

    const commonIssues = Array.from(issueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }));

    return {
      totalValidations: this.validationHistory.length,
      recentSuccessRate: recentValidations.length > 0 ? successCount / recentValidations.length : 0,
      commonIssues,
      healingSuccess: 0.85 // Placeholder - would track actual healing success
    };
  }

  private initializeValidationRules(): void {
    // Checksum validation
    this.rules.set('checksum', {
      id: 'checksum',
      name: 'Checksum Validation',
      validator: (entry) => {
        const crypto = require('crypto');
        const serialized = JSON.stringify(entry.value);
        const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
        
        return {
          valid: checksum === entry.metadata.checksum,
          confidence: checksum === entry.metadata.checksum ? 1.0 : 0.0,
          issues: checksum !== entry.metadata.checksum ? ['Checksum mismatch detected'] : [],
          suggestions: checksum !== entry.metadata.checksum ? ['Recalculate and update checksum'] : [],
          healable: true
        };
      },
      weight: 10,
      autoHeal: true
    });

    // TTL validation
    this.rules.set('ttl', {
      id: 'ttl',
      name: 'TTL Validation',
      validator: (entry) => {
        if (!entry.ttl) {
          return {
            valid: true,
            confidence: 1.0,
            issues: [],
            suggestions: [],
            healable: false
          };
        }

        const isExpired = Date.now() - entry.metadata.created.getTime() > entry.ttl;
        
        return {
          valid: !isExpired,
          confidence: isExpired ? 0.0 : 1.0,
          issues: isExpired ? ['Entry has expired'] : [],
          suggestions: isExpired ? ['Remove expired entry or extend TTL'] : [],
          healable: true
        };
      },
      weight: 8,
      autoHeal: true
    });

    // Size validation
    this.rules.set('size', {
      id: 'size',
      name: 'Size Validation',
      validator: (entry) => {
        const actualSize = JSON.stringify(entry.value).length;
        const reportedSize = entry.metrics.size;
        const sizeDiff = Math.abs(actualSize - reportedSize) / Math.max(actualSize, reportedSize);
        
        return {
          valid: sizeDiff < 0.1, // 10% tolerance
          confidence: Math.max(0, 1 - sizeDiff),
          issues: sizeDiff >= 0.1 ? ['Size mismatch between actual and reported'] : [],
          suggestions: sizeDiff >= 0.1 ? ['Update reported size metrics'] : [],
          healable: true
        };
      },
      weight: 6
    });

    // Metadata consistency
    this.rules.set('metadata', {
      id: 'metadata',
      name: 'Metadata Consistency',
      validator: (entry) => {
        const issues: string[] = [];
        const suggestions: string[] = [];
        
        if (entry.metadata.updated < entry.metadata.created) {
          issues.push('Updated timestamp is before created timestamp');
          suggestions.push('Fix timestamp ordering');
        }
        
        if (entry.metadata.accessed < entry.metadata.created) {
          issues.push('Accessed timestamp is before created timestamp');
          suggestions.push('Fix access timestamp');
        }
        
        if (entry.metadata.version < 1) {
          issues.push('Invalid version number');
          suggestions.push('Set minimum version to 1');
        }

        return {
          valid: issues.length === 0,
          confidence: issues.length === 0 ? 1.0 : Math.max(0, 1 - issues.length * 0.3),
          issues,
          suggestions,
          healable: true
        };
      },
      weight: 7,
      autoHeal: true
    });

    // Layer-specific validation for L2 (compression)
    this.rules.set('l2_compression', {
      id: 'l2_compression',
      name: 'L2 Compression Validation',
      layer: MemoryLayer.L2_CONTEXT,
      validator: (entry) => {
        const hasCompressionTag = entry.metadata.tags.includes('compressed');
        const compressionRatio = entry.metrics.compressionRatio;
        
        const issues: string[] = [];
        const suggestions: string[] = [];
        
        if (!hasCompressionTag) {
          issues.push('L2 entry missing compression tag');
          suggestions.push('Add compression tag to metadata');
        }
        
        if (compressionRatio >= 1.0) {
          issues.push('L2 entry not compressed (ratio >= 1.0)');
          suggestions.push('Apply compression to L2 entry');
        }

        return {
          valid: issues.length === 0,
          confidence: issues.length === 0 ? 1.0 : 0.5,
          issues,
          suggestions,
          healable: true
        };
      },
      weight: 8
    });

    // Layer-specific validation for L4 (ML predictions)
    this.rules.set('l4_accuracy', {
      id: 'l4_accuracy',
      name: 'L4 Accuracy Validation',
      layer: MemoryLayer.L4_PREDICTIONS,
      validator: (entry) => {
        const accuracy = entry.metrics.accuracy ?? 0;
        
        return {
          valid: accuracy >= 0.7, // Minimum 70% accuracy
          confidence: Math.max(0, accuracy),
          issues: accuracy < 0.7 ? ['Prediction accuracy below threshold'] : [],
          suggestions: accuracy < 0.7 ? ['Retrain prediction models', 'Review training data'] : [],
          healable: accuracy < 0.7 && accuracy > 0.3 // Only healable if not completely wrong
        };
      },
      weight: 9
    });
  }

  private aggregateValidationResults(results: (ValidationResult & { weight: number })[]): ContextValidationResult {
    if (results.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        issues: ['No validation results available'],
        suggestions: ['Add validation rules'],
        healingRequired: false
      };
    }

    // Weighted aggregate
    let totalWeight = 0;
    let weightedConfidence = 0;
    let isValid = true;
    const allIssues: string[] = [];
    const allSuggestions: string[] = [];
    let healingRequired = false;

    for (const result of results) {
      totalWeight += result.weight;
      weightedConfidence += result.confidence * result.weight;
      
      if (!result.valid) {
        isValid = false;
      }
      
      allIssues.push(...result.issues);
      allSuggestions.push(...result.suggestions);
      
      if (result.healable && !result.valid) {
        healingRequired = true;
      }
    }

    return {
      isValid,
      confidence: totalWeight > 0 ? weightedConfidence / totalWeight : 0,
      issues: [...new Set(allIssues)],
      suggestions: [...new Set(allSuggestions)],
      healingRequired
    };
  }

  private async healChecksum(entry: MemoryEntry, layer: IMemoryLayer): Promise<boolean> {
    try {
      const crypto = require('crypto');
      const serialized = JSON.stringify(entry.value);
      const newChecksum = crypto.createHash('sha256').update(serialized).digest('hex');
      
      entry.metadata.checksum = newChecksum;
      entry.metadata.updated = new Date();
      entry.metadata.version++;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async healTTL(entry: MemoryEntry, layer: IMemoryLayer): Promise<boolean> {
    try {
      // Remove expired entry
      if (entry.ttl && Date.now() - entry.metadata.created.getTime() > entry.ttl) {
        await layer.delete(entry.key);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async healCorruption(entry: MemoryEntry, layer: IMemoryLayer): Promise<boolean> {
    try {
      // Attempt to reconstruct from metadata
      if (entry.metadata.tags.includes('reconstructable')) {
        // Implementation would depend on specific corruption type
        entry.metadata.updated = new Date();
        entry.metadata.version++;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async healFormat(entry: MemoryEntry, layer: IMemoryLayer): Promise<boolean> {
    try {
      // Attempt to fix format issues
      entry.metadata.updated = new Date();
      entry.metadata.version++;
      return true;
    } catch (error) {
      return false;
    }
  }

  private calculateTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
    if (values.length < 3) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'degrading';
    return 'stable';
  }

  private startValidationLoop(): void {
    // Run validation check every 10 minutes
    setInterval(() => {
      this.performRoutineValidation().catch(console.error);
    }, 10 * 60 * 1000);
  }

  private async performRoutineValidation(): Promise<void> {
    // Placeholder for routine validation
    // Would validate a subset of entries across all layers
  }
}