/**
 * CNS Memory Layer System - Core Types and Interfaces
 * 
 * Implements a hierarchical memory architecture with:
 * - L1: Session critical data (100% retention)
 * - L2: Request context with SPR compression (80% token reduction)
 * - L3: Application patterns (10KB O(1) access)
 * - L4: ML predictions (50KB, 85% accuracy)
 */

export enum MemoryLayer {
  L1_SESSION = 'L1_SESSION',
  L2_CONTEXT = 'L2_CONTEXT',
  L3_PATTERNS = 'L3_PATTERNS',
  L4_PREDICTIONS = 'L4_PREDICTIONS'
}

export interface MemoryMetrics {
  retentionRate: number;
  compressionRatio: number;
  accessTime: number;
  accuracy?: number;
  size: number;
  lastAccess: Date;
  hitCount: number;
  missCount: number;
}

export interface MemoryEntry<T = any> {
  id: string;
  key: string;
  value: T;
  layer: MemoryLayer;
  ttl?: number;
  priority: number;
  metadata: {
    created: Date;
    updated: Date;
    accessed: Date;
    version: number;
    checksum: string;
    tags: string[];
  };
  metrics: MemoryMetrics;
}

export interface MemoryQuery {
  layer?: MemoryLayer;
  key?: string;
  pattern?: string;
  tags?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export interface MemoryOperation {
  type: 'read' | 'write' | 'delete' | 'compress' | 'heal' | 'predict';
  layer: MemoryLayer;
  key: string;
  data?: any;
  options?: Record<string, any>;
  timestamp: Date;
}

export interface ContextValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  healingRequired: boolean;
}

export interface EvolutionTrackingData {
  patternId: string;
  evolution: {
    stage: number;
    mutations: number;
    fitness: number;
    parentId?: string;
    childrenIds: string[];
  };
  performance: {
    accuracy: number;
    speed: number;
    efficiency: number;
  };
  adaptations: {
    timestamp: Date;
    type: string;
    reason: string;
    impact: number;
  }[];
}

export interface CompoundIntelligenceMultiplier {
  baseIntelligence: number;
  multipliers: {
    contextual: number;
    predictive: number;
    adaptive: number;
    collaborative: number;
  };
  totalMultiplier: number;
  effectiveness: number;
}