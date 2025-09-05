import { z } from 'zod';

/**
 * Base dimensional schema types for n-dimensional marketplace data models
 * Provides foundational types for multi-dimensional data representation
 */

// Core dimensional types
export const DimensionTypeSchema = z.enum([
  'category',
  'quality',
  'temporal',
  'spatial',
  'semantic',
  'social',
  'economic',
  'trust',
  'reputation',
  'availability',
  'custom'
]);

export type DimensionType = z.infer<typeof DimensionTypeSchema>;

// Vector embedding for semantic search
export const VectorEmbeddingSchema = z.object({
  dimensions: z.number().int().positive(),
  values: z.array(z.number()).refine(
    (arr) => arr.length > 0 && arr.length <= 4096,
    { message: "Vector must have 1-4096 dimensions" }
  ),
  model: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type VectorEmbedding = z.infer<typeof VectorEmbeddingSchema>;

// Coordinate system for spatial dimensions
export const CoordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
  system: z.enum(['cartesian', 'geographic', 'polar']).default('cartesian'),
  unit: z.string().optional(),
  precision: z.number().int().positive().optional()
});

export type Coordinate = z.infer<typeof CoordinateSchema>;

// Temporal dimension for time-based attributes
export const TemporalDimensionSchema = z.object({
  timestamp: z.coerce.date(),
  timezone: z.string().default('UTC'),
  granularity: z.enum(['second', 'minute', 'hour', 'day', 'week', 'month', 'year']),
  duration: z.number().int().positive().optional(),
  recurrence: z.object({
    pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
    interval: z.number().int().positive().default(1),
    endDate: z.coerce.date().optional()
  }).optional()
});

export type TemporalDimension = z.infer<typeof TemporalDimensionSchema>;

// Quality dimension with multi-metric support
export const QualityDimensionSchema = z.object({
  score: z.number().min(0).max(1),
  metrics: z.record(z.number()),
  certification: z.array(z.string()).optional(),
  assessments: z.array(z.object({
    assessorId: z.string(),
    score: z.number().min(0).max(1),
    timestamp: z.coerce.date(),
    criteria: z.record(z.number()),
    comments: z.string().optional()
  })).optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type QualityDimension = z.infer<typeof QualityDimensionSchema>;

// Category dimension with hierarchical support
export const CategoryDimensionSchema = z.object({
  primary: z.string(),
  secondary: z.array(z.string()).optional(),
  hierarchy: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  taxonomy: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type CategoryDimension = z.infer<typeof CategoryDimensionSchema>;

// Economic dimension for pricing and value
export const EconomicDimensionSchema = z.object({
  basePrice: z.number().min(0),
  currency: z.string().default('USD'),
  dynamicPricing: z.object({
    enabled: z.boolean().default(false),
    factors: z.array(z.object({
      name: z.string(),
      weight: z.number().min(-1).max(1),
      current: z.number()
    })).optional(),
    algorithm: z.enum(['supply_demand', 'auction', 'dynamic', 'fixed']).default('fixed')
  }).optional(),
  costs: z.record(z.number()).optional(),
  margins: z.record(z.number()).optional(),
  incentives: z.array(z.object({
    type: z.string(),
    value: z.number(),
    conditions: z.record(z.any()).optional()
  })).optional()
});

export type EconomicDimension = z.infer<typeof EconomicDimensionSchema>;

// Social dimension for community aspects
export const SocialDimensionSchema = z.object({
  visibility: z.enum(['public', 'private', 'restricted', 'community']).default('public'),
  interactions: z.object({
    views: z.number().int().nonnegative().default(0),
    likes: z.number().int().nonnegative().default(0),
    shares: z.number().int().nonnegative().default(0),
    comments: z.number().int().nonnegative().default(0),
    bookmarks: z.number().int().nonnegative().default(0)
  }).optional(),
  community: z.object({
    groups: z.array(z.string()).optional(),
    permissions: z.record(z.boolean()).optional(),
    endorsements: z.array(z.object({
      userId: z.string(),
      type: z.string(),
      timestamp: z.coerce.date()
    })).optional()
  }).optional(),
  network: z.object({
    connections: z.array(z.string()).optional(),
    influence: z.number().min(0).max(1).optional(),
    reach: z.number().int().nonnegative().optional()
  }).optional()
});

export type SocialDimension = z.infer<typeof SocialDimensionSchema>;

// Generic dimensional attribute
export const DimensionalAttributeSchema = z.object({
  type: DimensionTypeSchema,
  name: z.string(),
  value: z.any(),
  weight: z.number().min(0).max(1).default(1),
  metadata: z.record(z.any()).optional(),
  timestamp: z.coerce.date().optional(),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type DimensionalAttribute = z.infer<typeof DimensionalAttributeSchema>;

// Multi-dimensional entity base
export const MultiDimensionalEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  dimensions: z.array(DimensionalAttributeSchema),
  vectorEmbedding: VectorEmbeddingSchema.optional(),
  spatialCoordinate: CoordinateSchema.optional(),
  temporalDimension: TemporalDimensionSchema.optional(),
  qualityDimension: QualityDimensionSchema.optional(),
  categoryDimension: CategoryDimensionSchema.optional(),
  economicDimension: EconomicDimensionSchema.optional(),
  socialDimension: SocialDimensionSchema.optional(),
  customDimensions: z.record(z.any()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number().int().positive().default(1)
});

export type MultiDimensionalEntity = z.infer<typeof MultiDimensionalEntitySchema>;

// Dimensional relationship
export const DimensionalRelationshipSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationshipType: z.string(),
  strength: z.number().min(0).max(1).optional(),
  bidirectional: z.boolean().default(false),
  dimensions: z.array(DimensionalAttributeSchema).optional(),
  metadata: z.record(z.any()).optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type DimensionalRelationship = z.infer<typeof DimensionalRelationshipSchema>;

// Dimensional query for search and filtering
export const DimensionalQuerySchema = z.object({
  dimensions: z.array(z.object({
    type: DimensionTypeSchema,
    filters: z.record(z.any()),
    weights: z.record(z.number()).optional(),
    range: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional()
  })).optional(),
  spatialQuery: z.object({
    center: CoordinateSchema,
    radius: z.number().positive(),
    unit: z.string().default('km')
  }).optional(),
  temporalQuery: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    granularity: z.enum(['second', 'minute', 'hour', 'day', 'week', 'month', 'year']).optional()
  }).optional(),
  vectorQuery: z.object({
    embedding: z.array(z.number()),
    similarity: z.enum(['cosine', 'euclidean', 'manhattan', 'dot_product']).default('cosine'),
    threshold: z.number().min(0).max(1).optional(),
    k: z.number().int().positive().default(10)
  }).optional(),
  aggregations: z.array(z.object({
    dimension: DimensionTypeSchema,
    function: z.enum(['sum', 'avg', 'min', 'max', 'count', 'distinct']),
    groupBy: z.array(z.string()).optional()
  })).optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type DimensionalQuery = z.infer<typeof DimensionalQuerySchema>;

// Utility functions for dimensional operations
export const DimensionalUtils = {
  /**
   * Calculate Euclidean distance between two vectors
   */
  euclideanDistance: (a: number[], b: number[]): number => {
    if (a.length !== b.length) throw new Error('Vectors must have same dimensions');
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  },

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity: (a: number[], b: number[]): number => {
    if (a.length !== b.length) throw new Error('Vectors must have same dimensions');
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  },

  /**
   * Normalize vector to unit length
   */
  normalizeVector: (vector: number[]): number[] => {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? vector : vector.map(val => val / magnitude);
  },

  /**
   * Calculate weighted score across multiple dimensions
   */
  calculateDimensionalScore: (dimensions: DimensionalAttribute[]): number => {
    const totalWeight = dimensions.reduce((sum, dim) => sum + dim.weight, 0);
    if (totalWeight === 0) return 0;
    
    return dimensions.reduce((score, dim) => {
      const value = typeof dim.value === 'number' ? dim.value : 0;
      return score + (value * dim.weight);
    }, 0) / totalWeight;
  }
};

export default {
  VectorEmbeddingSchema,
  CoordinateSchema,
  TemporalDimensionSchema,
  QualityDimensionSchema,
  CategoryDimensionSchema,
  EconomicDimensionSchema,
  SocialDimensionSchema,
  DimensionalAttributeSchema,
  MultiDimensionalEntitySchema,
  DimensionalRelationshipSchema,
  DimensionalQuerySchema,
  DimensionalUtils
};