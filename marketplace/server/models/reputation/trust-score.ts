import { z } from 'zod';
import {
  MultiDimensionalEntitySchema,
  TemporalDimensionSchema,
  DimensionalAttributeSchema,
  VectorEmbeddingSchema
} from '../base/dimensional-schema.js';

/**
 * Trust and Reputation Score Models for Marketplace
 * Multi-dimensional trust scoring with temporal decay and context awareness
 */

// Trust score components
export const TrustComponentSchema = z.enum([
  'transaction_history',
  'payment_reliability',
  'delivery_performance',
  'communication_quality',
  'product_accuracy',
  'dispute_resolution',
  'community_feedback',
  'verification_level',
  'platform_tenure',
  'business_credentials',
  'financial_stability',
  'insurance_coverage',
  'certifications',
  'endorsements',
  'network_trust'
]);

export type TrustComponent = z.infer<typeof TrustComponentSchema>;

// Trust context types
export const TrustContextSchema = z.enum([
  'general',
  'product_sales',
  'service_delivery',
  'digital_goods',
  'high_value_items',
  'international_trade',
  'b2b_transactions',
  'subscription_services',
  'marketplace_mediated',
  'direct_trade',
  'bulk_orders',
  'custom_orders'
]);

export type TrustContext = z.infer<typeof TrustContextSchema>;

// Trust score calculation methods
export const TrustCalculationMethodSchema = z.enum([
  'weighted_average',
  'bayesian',
  'beta_distribution',
  'machine_learning',
  'consensus_based',
  'reputation_network',
  'temporal_weighted',
  'context_aware',
  'multi_dimensional'
]);

export type TrustCalculationMethod = z.infer<typeof TrustCalculationMethodSchema>;

// Individual trust metric
export const TrustMetricSchema = z.object({
  component: TrustComponentSchema,
  score: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  
  // Data sources
  sources: z.array(z.object({
    type: z.enum(['transaction', 'review', 'rating', 'verification', 'external', 'ml_inference']),
    id: z.string(),
    timestamp: z.coerce.date(),
    weight: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1)
  })),
  
  // Temporal aspects
  temporal: z.object({
    decayRate: z.number().min(0).max(1).default(0.1),
    halfLife: z.number().int().positive().default(365), // days
    lastUpdate: z.coerce.date(),
    trendDirection: z.enum(['improving', 'declining', 'stable']).optional(),
    trendStrength: z.number().min(0).max(1).optional()
  }),
  
  // Context specificity
  contexts: z.array(z.object({
    context: TrustContextSchema,
    score: z.number().min(0).max(1),
    sampleSize: z.number().int().nonnegative()
  })).default([]),
  
  // Statistical properties
  statistics: z.object({
    mean: z.number().min(0).max(1),
    variance: z.number().min(0),
    sampleSize: z.number().int().nonnegative(),
    outliers: z.number().int().nonnegative().default(0),
    distributionSkew: z.number().optional()
  }),
  
  metadata: z.record(z.any()).optional()
});

export type TrustMetric = z.infer<typeof TrustMetricSchema>;

// Trust score history entry
export const TrustScoreHistorySchema = z.object({
  timestamp: z.coerce.date(),
  score: z.number().min(0).max(1),
  components: z.record(z.number().min(0).max(1)),
  trigger: z.object({
    type: z.enum(['transaction', 'review', 'dispute', 'verification', 'scheduled_update', 'manual_adjustment']),
    id: z.string().optional(),
    description: z.string().optional()
  }),
  change: z.object({
    delta: z.number(),
    percentChange: z.number(),
    significant: z.boolean()
  }),
  context: TrustContextSchema.optional(),
  notes: z.string().optional()
});

export type TrustScoreHistory = z.infer<typeof TrustScoreHistorySchema>;

// Trust network relationship
export const TrustNetworkRelationshipSchema = z.object({
  id: z.string(),
  trustorId: z.string(), // Entity giving trust
  trusteeId: z.string(), // Entity receiving trust
  
  // Trust values
  directTrust: z.number().min(0).max(1),
  indirectTrust: z.number().min(0).max(1).optional(),
  networkTrust: z.number().min(0).max(1).optional(),
  
  // Relationship properties
  relationshipType: z.enum([
    'business_partner',
    'frequent_customer',
    'supplier',
    'competitor',
    'peer',
    'authority',
    'stranger'
  ]),
  
  strength: z.number().min(0).max(1),
  interactions: z.number().int().nonnegative().default(0),
  
  // Evidence and basis
  evidence: z.array(z.object({
    type: z.string(),
    value: z.any(),
    weight: z.number().min(0).max(1),
    timestamp: z.coerce.date(),
    verified: z.boolean().default(false)
  })),
  
  // Context and conditions
  contexts: z.array(TrustContextSchema).default([]),
  conditions: z.array(z.string()).optional(),
  
  // Temporal properties
  establishedAt: z.coerce.date(),
  lastInteraction: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  
  // Metadata
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

export type TrustNetworkRelationship = z.infer<typeof TrustNetworkRelationshipSchema>;

// Reputation profile
export const ReputationProfileSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: z.enum(['user', 'business', 'product', 'service']),
  
  // Overall reputation metrics
  overall: z.object({
    score: z.number().min(0).max(1),
    rank: z.number().int().positive().optional(),
    percentile: z.number().min(0).max(100).optional(),
    level: z.enum(['new', 'bronze', 'silver', 'gold', 'platinum', 'diamond']).optional()
  }),
  
  // Category-specific reputation
  categories: z.array(z.object({
    category: z.string(),
    score: z.number().min(0).max(1),
    rank: z.number().int().positive().optional(),
    transactions: z.number().int().nonnegative(),
    expertise: z.enum(['novice', 'intermediate', 'expert', 'master']).optional()
  })).default([]),
  
  // Badges and achievements
  badges: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    level: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
    earnedAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
    verified: z.boolean().default(false)
  })).default([]),
  
  // Statistics
  statistics: z.object({
    totalTransactions: z.number().int().nonnegative(),
    successfulTransactions: z.number().int().nonnegative(),
    disputedTransactions: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5).optional(),
    totalReviews: z.number().int().nonnegative(),
    responseRate: z.number().min(0).max(1).optional(),
    responseTime: z.number().positive().optional(), // hours
    completionRate: z.number().min(0).max(1).optional(),
    repeatCustomerRate: z.number().min(0).max(1).optional()
  }),
  
  // Recent activity summary
  recentActivity: z.object({
    period: z.enum(['7d', '30d', '90d']).default('30d'),
    transactions: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5).optional(),
    disputeRate: z.number().min(0).max(1).optional(),
    trendDirection: z.enum(['up', 'down', 'stable']).optional()
  }).optional(),
  
  // Strengths and weaknesses
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  
  // Verification status
  verifications: z.array(z.object({
    type: z.enum(['identity', 'address', 'phone', 'email', 'business', 'tax', 'insurance', 'license']),
    status: z.enum(['verified', 'pending', 'rejected', 'expired']),
    verifiedBy: z.string(),
    verifiedAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
    documents: z.array(z.string()).optional()
  })).default([]),
  
  // Timeline of significant events
  timeline: z.array(z.object({
    timestamp: z.coerce.date(),
    event: z.string(),
    description: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
    magnitude: z.number().min(0).max(1).optional()
  })).default([]),
  
  lastUpdated: z.coerce.date(),
  nextUpdateDue: z.coerce.date().optional()
});

export type ReputationProfile = z.infer<typeof ReputationProfileSchema>;

// Main trust score entity
export const TrustScoreSchema = MultiDimensionalEntitySchema.extend({
  entityId: z.string(),
  entityType: z.enum(['user', 'business', 'product', 'service', 'category']),
  
  // Core trust score
  overallScore: z.number().min(0).max(1),
  
  // Trust components breakdown
  components: z.array(TrustMetricSchema),
  
  // Context-specific scores
  contextScores: z.array(z.object({
    context: TrustContextSchema,
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    sampleSize: z.number().int().nonnegative(),
    lastUpdated: z.coerce.date()
  })).default([]),
  
  // Calculation configuration
  calculation: z.object({
    method: TrustCalculationMethodSchema,
    parameters: z.record(z.any()).optional(),
    version: z.string().default('1.0'),
    lastCalculated: z.coerce.date(),
    nextCalculationDue: z.coerce.date().optional()
  }),
  
  // Trust network information
  network: z.object({
    directConnections: z.number().int().nonnegative().default(0),
    networkReach: z.number().int().nonnegative().default(0),
    clusterCoefficient: z.number().min(0).max(1).optional(),
    centralityMeasures: z.object({
      degree: z.number().min(0).optional(),
      betweenness: z.number().min(0).max(1).optional(),
      eigenvector: z.number().min(0).max(1).optional(),
      pagerank: z.number().min(0).max(1).optional()
    }).optional()
  }).default({
    directConnections: 0,
    networkReach: 0
  }),
  
  // Risk assessment
  riskProfile: z.object({
    level: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
    score: z.number().min(0).max(1),
    factors: z.array(z.object({
      factor: z.string(),
      risk: z.number().min(0).max(1),
      description: z.string().optional()
    })),
    mitigation: z.array(z.string()).default([]),
    lastAssessed: z.coerce.date()
  }).optional(),
  
  // Predictive analytics
  predictions: z.object({
    futureScore: z.array(z.object({
      timeframe: z.string(), // e.g., "30d", "90d", "1y"
      predicted: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      factors: z.array(z.string()).optional()
    })).optional(),
    churnRisk: z.number().min(0).max(1).optional(),
    growthPotential: z.number().min(0).max(1).optional(),
    modelVersion: z.string().optional()
  }).optional(),
  
  // Historical data
  history: z.array(TrustScoreHistorySchema).default([]),
  
  // Benchmarking
  benchmarks: z.object({
    industry: z.object({
      average: z.number().min(0).max(1).optional(),
      percentile: z.number().min(0).max(100).optional(),
      topPerformer: z.number().min(0).max(1).optional()
    }).optional(),
    platform: z.object({
      average: z.number().min(0).max(1).optional(),
      percentile: z.number().min(0).max(100).optional(),
      topPerformer: z.number().min(0).max(1).optional()
    }).optional(),
    peer: z.object({
      average: z.number().min(0).max(1).optional(),
      percentile: z.number().min(0).max(100).optional(),
      topPerformer: z.number().min(0).max(1).optional()
    }).optional()
  }).optional(),
  
  // Machine learning features
  mlFeatures: z.object({
    embedding: VectorEmbeddingSchema.optional(),
    featureVector: z.array(z.number()).optional(),
    clusterAssignment: z.string().optional(),
    anomalyScore: z.number().min(0).max(1).optional()
  }).optional(),
  
  // Compliance and regulatory
  compliance: z.object({
    amlScore: z.number().min(0).max(1).optional(),
    kycStatus: z.enum(['pending', 'verified', 'rejected', 'expired']).optional(),
    sanctionsCheck: z.boolean().optional(),
    pep: z.boolean().default(false), // Politically Exposed Person
    lastChecked: z.coerce.date().optional()
  }).optional(),
  
  // Privacy and consent
  privacy: z.object({
    public: z.boolean().default(false),
    shareWithPartners: z.boolean().default(false),
    analyticsConsent: z.boolean().default(true),
    retentionPeriod: z.number().int().positive().optional(), // days
    dataMinimization: z.boolean().default(true)
  }).default({
    public: false,
    shareWithPartners: false,
    analyticsConsent: true,
    dataMinimization: true
  }),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  externalReferences: z.record(z.string()).optional()
});

export type TrustScore = z.infer<typeof TrustScoreSchema>;

// Trust score query schema
export const TrustScoreQuerySchema = z.object({
  entityIds: z.array(z.string()).optional(),
  entityTypes: z.array(z.enum(['user', 'business', 'product', 'service', 'category'])).optional(),
  
  // Score filters
  scoreRange: z.object({
    min: z.number().min(0).max(1).optional(),
    max: z.number().min(0).max(1).optional()
  }).optional(),
  
  contexts: z.array(TrustContextSchema).optional(),
  components: z.array(TrustComponentSchema).optional(),
  
  // Risk filters
  riskLevels: z.array(z.enum(['very_low', 'low', 'medium', 'high', 'very_high'])).optional(),
  
  // Time filters
  updatedSince: z.coerce.date().optional(),
  calculatedSince: z.coerce.date().optional(),
  
  // Network filters
  networkSize: z.object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional()
  }).optional(),
  
  // Aggregations
  aggregations: z.array(z.object({
    field: z.string(),
    function: z.enum(['avg', 'min', 'max', 'sum', 'count']),
    groupBy: z.string().optional()
  })).optional(),
  
  // Sorting and pagination
  sort: z.object({
    field: z.enum(['overallScore', 'lastUpdated', 'networkReach', 'riskScore']).default('overallScore'),
    direction: z.enum(['asc', 'desc']).default('desc')
  }).optional(),
  
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(1000).default(50)
  }).optional(),
  
  // Include options
  include: z.object({
    history: z.boolean().default(false),
    components: z.boolean().default(true),
    network: z.boolean().default(false),
    predictions: z.boolean().default(false),
    benchmarks: z.boolean().default(false)
  }).optional()
});

export type TrustScoreQuery = z.infer<typeof TrustScoreQuerySchema>;

// Trust score creation and update DTOs
export const CreateTrustScoreSchema = TrustScoreSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  history: true
});

export const UpdateTrustScoreSchema = CreateTrustScoreSchema.partial();

export type CreateTrustScore = z.infer<typeof CreateTrustScoreSchema>;
export type UpdateTrustScore = z.infer<typeof UpdateTrustScoreSchema>;

export default {
  TrustScoreSchema,
  ReputationProfileSchema,
  TrustMetricSchema,
  TrustNetworkRelationshipSchema,
  TrustScoreHistorySchema,
  TrustScoreQuerySchema,
  CreateTrustScoreSchema,
  UpdateTrustScoreSchema,
  TrustComponentSchema,
  TrustContextSchema,
  TrustCalculationMethodSchema
};