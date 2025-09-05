/**
 * Marketplace Models - N-Dimensional Data Models Export
 * 
 * Comprehensive n-dimensional data models for marketplace applications
 * with vector embeddings, multi-party transactions, trust scoring,
 * and advanced workflow management.
 */

// Base dimensional schemas
export * from './base/dimensional-schema.js';

// Entity models
export * from './entities/marketplace-item.js';

// Relationship models
export * from './relationships/entity-relationships.js';

// Transaction models
export * from './transactions/multi-party-transaction.js';

// Reputation and trust models
export * from './reputation/trust-score.js';

// Workflow models
export * from './workflows/marketplace-workflows.js';

// Temporal and scheduling models
export * from './temporal/scheduling-availability.js';

// Utility functions and helpers
export * from './utils/model-utilities.js';

// Re-export commonly used types for convenience
export type {
  // Base types
  VectorEmbedding,
  MultiDimensionalEntity,
  DimensionalAttribute,
  DimensionalQuery,
  Coordinate,
  TemporalDimension,
  
  // Marketplace Item types
  MarketplaceItem,
  ItemSearch,
  CreateMarketplaceItem,
  UpdateMarketplaceItem,
  ItemStatus,
  ItemType,
  
  // Relationship types
  MarketplaceRelationship,
  UserItemInteraction,
  ItemSimilarity,
  RelationshipGraph,
  
  // Transaction types
  MultiPartyTransaction,
  TransactionParty,
  TransactionItem,
  PaymentInfo,
  TransactionQuery,
  
  // Trust and reputation types
  TrustScore,
  ReputationProfile,
  TrustMetric,
  TrustNetworkRelationship,
  
  // Workflow types
  MarketplaceWorkflow,
  WorkflowExecution,
  WorkflowTask,
  WorkflowTemplate,
  
  // Scheduling types
  SchedulingSystem,
  ResourceAvailability,
  TimeSlot,
  AvailabilityQuery,
  
  // Utility types
  ValidationResult,
  TransformationConfig
} from './base/dimensional-schema.js';

export type {
  MarketplaceItem,
  ItemSearch,
  CreateMarketplaceItem,
  UpdateMarketplaceItem
} from './entities/marketplace-item.js';

export type {
  MarketplaceRelationship,
  RelationshipGraph,
  UserItemInteraction,
  ItemSimilarity
} from './relationships/entity-relationships.js';

export type {
  MultiPartyTransaction,
  TransactionParty,
  TransactionItem,
  PaymentInfo
} from './transactions/multi-party-transaction.js';

export type {
  TrustScore,
  ReputationProfile,
  TrustMetric,
  TrustNetworkRelationship
} from './reputation/trust-score.js';

export type {
  MarketplaceWorkflow,
  WorkflowExecution,
  WorkflowTask,
  WorkflowTemplate
} from './workflows/marketplace-workflows.js';

export type {
  SchedulingSystem,
  ResourceAvailability,
  TimeSlot,
  AvailabilityQuery
} from './temporal/scheduling-availability.js';

// Model validation schemas - for runtime validation
export {
  // Base schemas
  MultiDimensionalEntitySchema,
  VectorEmbeddingSchema,
  DimensionalAttributeSchema,
  DimensionalQuerySchema,
  
  // Entity schemas
  MarketplaceItemSchema,
  ItemSearchSchema,
  CreateMarketplaceItemSchema,
  UpdateMarketplaceItemSchema,
  
  // Relationship schemas
  MarketplaceRelationshipSchema,
  RelationshipGraphSchema,
  UserItemInteractionSchema,
  ItemSimilaritySchema,
  
  // Transaction schemas
  MultiPartyTransactionSchema,
  TransactionPartySchema,
  TransactionItemSchema,
  PaymentInfoSchema,
  TransactionQuerySchema,
  
  // Trust and reputation schemas
  TrustScoreSchema,
  ReputationProfileSchema,
  TrustMetricSchema,
  TrustNetworkRelationshipSchema,
  TrustScoreQuerySchema,
  
  // Workflow schemas
  MarketplaceWorkflowSchema,
  WorkflowExecutionSchema,
  WorkflowTaskSchema,
  WorkflowTemplateSchema,
  WorkflowQuerySchema,
  
  // Scheduling schemas
  SchedulingSystemSchema,
  ResourceAvailabilitySchema,
  TimeSlotSchema,
  AvailabilityQuerySchema,
  
  // Utility schemas
  ValidationResultSchema,
  TransformationConfigSchema
} from './base/dimensional-schema.js';

// Utility classes for model operations
export {
  ModelTransformationUtils,
  VectorEmbeddingUtils,
  DimensionalQueryUtils,
  DataValidationUtils,
  CacheUtils
} from './utils/model-utilities.js';

// Dimensional utilities
export { DimensionalUtils } from './base/dimensional-schema.js';

/**
 * Model feature summary:
 * 
 * 🔄 N-Dimensional Data Models:
 * - Multi-dimensional entity support with vector embeddings
 * - Category, quality, temporal, spatial, semantic, social dimensions
 * - Economic dimensions with dynamic pricing support
 * 
 * 🛍️ Marketplace Items:
 * - Physical, digital, service, subscription item types
 * - Advanced inventory management and variants
 * - Media attachments and SEO optimization
 * - Machine learning recommendations
 * 
 * 🔗 Entity Relationships:
 * - Complex relationship modeling with strength calculation
 * - User-item interactions and similarity detection
 * - Category hierarchies and location relationships
 * - Bundle and recommendation relationships
 * 
 * 💰 Multi-Party Transactions:
 * - Support for complex transaction workflows
 * - Multiple party roles and responsibilities
 * - Payment splits and installment support
 * - Comprehensive audit trails
 * 
 * 🏆 Trust & Reputation:
 * - Multi-dimensional trust scoring
 * - Network-based trust propagation
 * - Reputation profiles with badges
 * - Risk assessment and predictive analytics
 * 
 * ⚙️ Workflow Management:
 * - State machine-based workflow execution
 * - Conditional logic and parallel processing
 * - Integration with external systems
 * - Performance metrics and SLA tracking
 * 
 * 📅 Scheduling & Availability:
 * - Advanced resource scheduling system
 * - Recurrence patterns and blackout periods
 * - Conflict detection and resolution
 * - Multi-timezone support
 * 
 * 🛠️ Utilities & Validation:
 * - Comprehensive data validation
 * - Vector embedding operations
 * - Dimensional query building
 * - Caching and performance optimization
 */

export default {
  // Schemas
  MultiDimensionalEntitySchema,
  MarketplaceItemSchema,
  MarketplaceRelationshipSchema,
  MultiPartyTransactionSchema,
  TrustScoreSchema,
  MarketplaceWorkflowSchema,
  SchedulingSystemSchema,
  
  // Utilities
  DimensionalUtils,
  ModelTransformationUtils,
  VectorEmbeddingUtils,
  DimensionalQueryUtils,
  DataValidationUtils,
  CacheUtils
};