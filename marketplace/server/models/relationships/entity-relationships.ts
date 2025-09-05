import { z } from 'zod';
import {
  DimensionalRelationshipSchema,
  DimensionalAttributeSchema,
  VectorEmbeddingSchema
} from '../base/dimensional-schema.js';

/**
 * Entity Relationship Models for Marketplace
 * Defines complex relationships between marketplace entities with dimensional support
 */

// Relationship types for marketplace entities
export const RelationshipTypeSchema = z.enum([
  // Item relationships
  'similar_to',
  'complementary',
  'alternative',
  'bundle_contains',
  'variant_of',
  'upgrade_to',
  'accessory_for',
  'replacement_for',
  
  // User relationships
  'follows',
  'blocks',
  'trusts',
  'collaborates_with',
  'recommends',
  'endorsed_by',
  
  // Transaction relationships
  'purchased_together',
  'frequently_bought',
  'cross_sells',
  'up_sells',
  'viewed_together',
  
  // Business relationships
  'supplies',
  'partners_with',
  'competes_with',
  'distributes',
  'manufactures',
  'resells',
  
  // Content relationships
  'references',
  'mentions',
  'reviews',
  'compares',
  'features',
  
  // Category relationships
  'subcategory_of',
  'related_category',
  'popular_in',
  
  // Location relationships
  'ships_to',
  'available_in',
  'near',
  'serves'
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

// Relationship strength calculation methods
export const RelationshipStrengthMethodSchema = z.enum([
  'manual',
  'frequency_based',
  'time_decay',
  'user_interaction',
  'ml_prediction',
  'semantic_similarity',
  'collaborative_filtering',
  'content_based',
  'hybrid'
]);

export type RelationshipStrengthMethod = z.infer<typeof RelationshipStrengthMethodSchema>;

// Entity relationship with marketplace-specific properties
export const MarketplaceRelationshipSchema = DimensionalRelationshipSchema.extend({
  relationshipType: RelationshipTypeSchema,
  
  // Strength calculation
  strengthMethod: RelationshipStrengthMethodSchema.default('manual'),
  strengthComponents: z.object({
    frequency: z.number().min(0).max(1).optional(),
    recency: z.number().min(0).max(1).optional(),
    userInteraction: z.number().min(0).max(1).optional(),
    semanticSimilarity: z.number().min(0).max(1).optional(),
    contextualRelevance: z.number().min(0).max(1).optional(),
    businessValue: z.number().min(0).max(1).optional()
  }).optional(),
  
  // Context information
  context: z.object({
    source: z.enum(['user_behavior', 'ml_model', 'manual_curation', 'business_rule', 'data_analysis']),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.object({
      type: z.string(),
      value: z.any(),
      weight: z.number().min(0).max(1),
      timestamp: z.coerce.date()
    })).optional(),
    tags: z.array(z.string()).optional()
  }),
  
  // Temporal properties
  temporal: z.object({
    seasonal: z.boolean().default(false),
    seasonPattern: z.array(z.number()).optional(), // 12 months
    trending: z.boolean().default(false),
    peakPeriods: z.array(z.object({
      start: z.coerce.date(),
      end: z.coerce.date(),
      intensity: z.number().min(0).max(1)
    })).optional()
  }).optional(),
  
  // Business metrics
  business: z.object({
    revenue: z.number().min(0).optional(),
    profit: z.number().optional(),
    volume: z.number().int().nonnegative().optional(),
    conversionRate: z.number().min(0).max(1).optional(),
    customerValue: z.number().min(0).optional()
  }).optional(),
  
  // Quality metrics
  quality: z.object({
    accuracy: z.number().min(0).max(1).optional(),
    precision: z.number().min(0).max(1).optional(),
    recall: z.number().min(0).max(1).optional(),
    f1Score: z.number().min(0).max(1).optional(),
    userSatisfaction: z.number().min(0).max(1).optional()
  }).optional(),
  
  // Display properties
  display: z.object({
    label: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    priority: z.number().int().min(0).max(10).default(5),
    visible: z.boolean().default(true)
  }).optional()
});

export type MarketplaceRelationship = z.infer<typeof MarketplaceRelationshipSchema>;

// Relationship graph for complex queries
export const RelationshipGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    properties: z.record(z.any()).optional(),
    embedding: VectorEmbeddingSchema.optional()
  })),
  edges: z.array(MarketplaceRelationshipSchema),
  metadata: z.object({
    totalNodes: z.number().int().nonnegative(),
    totalEdges: z.number().int().nonnegative(),
    density: z.number().min(0).max(1),
    components: z.number().int().positive(),
    averageClusteringCoefficient: z.number().min(0).max(1).optional(),
    diameter: z.number().int().nonnegative().optional()
  })
});

export type RelationshipGraph = z.infer<typeof RelationshipGraphSchema>;

// User-Item Interaction relationship
export const UserItemInteractionSchema = MarketplaceRelationshipSchema.extend({
  userId: z.string(),
  itemId: z.string(),
  interactionType: z.enum([
    'view',
    'click',
    'add_to_cart',
    'remove_from_cart',
    'purchase',
    'like',
    'dislike',
    'share',
    'save',
    'review',
    'compare',
    'search'
  ]),
  session: z.object({
    id: z.string(),
    timestamp: z.coerce.date(),
    duration: z.number().positive().optional(),
    device: z.string().optional(),
    platform: z.string().optional(),
    referrer: z.string().optional()
  }),
  value: z.number().optional(),
  quantity: z.number().int().positive().default(1),
  metadata: z.record(z.any()).optional()
});

export type UserItemInteraction = z.infer<typeof UserItemInteractionSchema>;

// Item-Item Similarity relationship
export const ItemSimilaritySchema = MarketplaceRelationshipSchema.extend({
  item1Id: z.string(),
  item2Id: z.string(),
  similarityType: z.enum([
    'content_based',
    'collaborative',
    'hybrid',
    'visual',
    'semantic',
    'functional'
  ]),
  similarityScore: z.number().min(0).max(1),
  features: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1),
    similarity: z.number().min(0).max(1)
  })).optional(),
  algorithm: z.string().optional(),
  modelVersion: z.string().optional()
});

export type ItemSimilarity = z.infer<typeof ItemSimilaritySchema>;

// Category relationship hierarchy
export const CategoryRelationshipSchema = MarketplaceRelationshipSchema.extend({
  parentCategoryId: z.string(),
  childCategoryId: z.string(),
  level: z.number().int().nonnegative(),
  path: z.array(z.string()),
  inheritanceRules: z.array(z.object({
    property: z.string(),
    inherit: z.boolean(),
    override: z.boolean().default(false)
  })).optional()
});

export type CategoryRelationship = z.infer<typeof CategoryRelationshipSchema>;

// Location-based relationship
export const LocationRelationshipSchema = MarketplaceRelationshipSchema.extend({
  sourceLocationId: z.string(),
  targetLocationId: z.string(),
  distance: z.number().min(0),
  distanceUnit: z.enum(['km', 'miles', 'm']).default('km'),
  travelTime: z.object({
    driving: z.number().positive().optional(),
    walking: z.number().positive().optional(),
    transit: z.number().positive().optional(),
    cycling: z.number().positive().optional()
  }).optional(),
  accessibility: z.object({
    accessible: z.boolean(),
    restrictions: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional()
  }).optional()
});

export type LocationRelationship = z.infer<typeof LocationRelationshipSchema>;

// Bundle relationship for grouped items
export const BundleRelationshipSchema = MarketplaceRelationshipSchema.extend({
  bundleId: z.string(),
  itemId: z.string(),
  quantity: z.number().int().positive().default(1),
  discount: z.object({
    type: z.enum(['percentage', 'fixed', 'free']),
    value: z.number().min(0)
  }).optional(),
  required: z.boolean().default(false),
  alternatives: z.array(z.string()).optional(),
  displayOrder: z.number().int().nonnegative().default(0)
});

export type BundleRelationship = z.infer<typeof BundleRelationshipSchema>;

// Recommendation relationship
export const RecommendationRelationshipSchema = MarketplaceRelationshipSchema.extend({
  recommenderId: z.string(), // User or system making recommendation
  targetId: z.string(), // User receiving recommendation
  itemId: z.string(),
  recommendationType: z.enum([
    'personal',
    'trending',
    'similar_users',
    'frequently_bought',
    'seasonal',
    'promotional',
    'editorial'
  ]),
  score: z.number().min(0).max(1),
  explanation: z.string().optional(),
  feedback: z.object({
    shown: z.boolean().default(false),
    clicked: z.boolean().default(false),
    purchased: z.boolean().default(false),
    dismissed: z.boolean().default(false),
    rating: z.number().min(1).max(5).optional()
  }).default({ shown: false, clicked: false, purchased: false, dismissed: false })
});

export type RecommendationRelationship = z.infer<typeof RecommendationRelationshipSchema>;

// Relationship query for complex graph queries
export const RelationshipQuerySchema = z.object({
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  relationshipTypes: z.array(RelationshipTypeSchema).optional(),
  minStrength: z.number().min(0).max(1).optional(),
  maxDepth: z.number().int().positive().default(3),
  includeMetadata: z.boolean().default(false),
  filters: z.object({
    temporal: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      current: z.boolean().default(true)
    }).optional(),
    context: z.object({
      sources: z.array(z.string()).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).optional()
    }).optional(),
    business: z.object({
      minRevenue: z.number().min(0).optional(),
      minVolume: z.number().int().nonnegative().optional(),
      profitableOnly: z.boolean().default(false)
    }).optional()
  }).optional(),
  aggregations: z.array(z.object({
    field: z.string(),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']),
    groupBy: z.string().optional()
  })).optional(),
  limit: z.number().int().positive().default(100)
});

export type RelationshipQuery = z.infer<typeof RelationshipQuerySchema>;

// Relationship analytics
export const RelationshipAnalyticsSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  analytics: z.object({
    totalRelationships: z.number().int().nonnegative(),
    relationshipTypes: z.record(z.number().int().nonnegative()),
    strengthDistribution: z.object({
      strong: z.number().int().nonnegative(), // > 0.7
      medium: z.number().int().nonnegative(), // 0.3-0.7
      weak: z.number().int().nonnegative() // < 0.3
    }),
    centralityMeasures: z.object({
      degree: z.number().min(0),
      closeness: z.number().min(0).max(1).optional(),
      betweenness: z.number().min(0).max(1).optional(),
      pagerank: z.number().min(0).max(1).optional()
    }),
    communities: z.array(z.object({
      id: z.string(),
      size: z.number().int().positive(),
      cohesion: z.number().min(0).max(1)
    })).optional(),
    temporalPatterns: z.object({
      growthRate: z.number(),
      seasonality: z.array(z.number()).optional(),
      trends: z.array(z.object({
        period: z.string(),
        direction: z.enum(['up', 'down', 'stable']),
        strength: z.number().min(0).max(1)
      })).optional()
    }).optional()
  }),
  computedAt: z.coerce.date(),
  validUntil: z.coerce.date().optional()
});

export type RelationshipAnalytics = z.infer<typeof RelationshipAnalyticsSchema>;

export default {
  MarketplaceRelationshipSchema,
  RelationshipGraphSchema,
  UserItemInteractionSchema,
  ItemSimilaritySchema,
  CategoryRelationshipSchema,
  LocationRelationshipSchema,
  BundleRelationshipSchema,
  RecommendationRelationshipSchema,
  RelationshipQuerySchema,
  RelationshipAnalyticsSchema,
  RelationshipTypeSchema,
  RelationshipStrengthMethodSchema
};