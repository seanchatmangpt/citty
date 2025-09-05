/**
 * Unjucks - Universal Template System with Ontology-Driven Context
 * Main entry point
 */

// Export all types
export * from './types'

// Context management
export {
  createTemplateContext,
  useTemplateContext,
  tryUseTemplateContext,
  hasTemplateContext,
  updateTemplateContext,
  clearTemplateContext,
  withTemplateContext,
  getContextValue,
  setContextValue,
  deleteContextValue,
  hasContextValue,
  mergeContexts,
  cloneContext,
  exportContext,
  importContext,
  getContextMetadata,
  interpolate
} from './context'

// Template walker
export {
  walkTemplates,
  resolveTemplate,
  listGenerators,
  listActions,
  getGeneratorInfo,
  parseTemplateMetadata,
  findTemplates,
  templateExists,
  getTemplateContent,
  extractTemplateVariables
} from './walker'

// Template renderer
export {
  TemplateRenderer,
  renderTemplate,
  renderString,
  registerFilter,
  registerFilters,
  registerGlobal,
  registerGlobals,
  createRenderer
} from './renderer'

// Ontology integration
export {
  OntologyManager,
  loadOntologyContext,
  queryEntities,
  expandContext,
  createSampleOntology,
  validateOntologyContext,
  mergeOntologyContexts,
  filterEntities,
  findEntity,
  transformEntity
} from './ontology'

// Performance optimization
export {
  LRUCache,
  TemplateCache,
  DiscoveryCache,
  QueryCache,
  MemoryAwareCache,
  templateCache,
  discoveryCache,
  queryCache,
  getCacheStats,
  clearAllCaches
} from './cache'

export {
  performanceMonitor,
  measurePerformance,
  measureBatch,
  optimizeFunction,
  ResourceManager,
  resourceManager
} from './performance'

export {
  LazyModule,
  optimizedN3,
  utils,
  globalBundleAnalyzer,
  globalStringInterner,
  globalStreamingRenderer,
  generateOptimizationReport
} from './bundler-optimization'

// Version
export const version = '1.0.0'

// Dark Matter Features - Hot Reload & Incremental Rendering
export {
  HotReloadSystem,
  createHotReloadSystem,
  watchTemplates,
  reloadTemplate,
  getTemplateDependencies,
  isTemplateChanged
} from './hot-reload'

export {
  IncrementalRenderer,
  createIncrementalRenderer,
  renderIncremental,
  invalidateCache,
  getCacheKey,
  getRenderStats
} from './incremental-renderer'

export {
  CrossTemplateValidator,
  createCrossTemplateValidator,
  validateTemplates,
  type ValidationError,
  type ValidationResult,
  type ValidationRule
} from './cross-template-validator'

// Security hardening - DARK MATTER
export {
  security,
  validateInput,
  sanitizeContext,
  isSecure,
  addTrustedContent,
  SecurityHardening,
  type SecurityPolicy,
  type SecurityViolation
} from './security-hardening'

// Performance monitoring - DARK MATTER
export {
  performanceMonitor,
  createPerformanceBudget,
  measureTemplateRender,
  analyzeBottlenecks,
  getPerformanceReport,
  PerformanceMonitor,
  type PerformanceBudget,
  type PerformanceMetrics,
  type BottleneckAnalysis
} from './performance-monitoring'

// Transaction safety - DARK MATTER
export {
  transactionManager,
  withTransaction,
  createSavepoint,
  TransactionManager,
  type Transaction,
  type TransactionOptions,
  type SavepointInfo
} from './transaction-safety'

// Streaming & backpressure - DARK MATTER
export {
  streamingEngine,
  createTemplateStream,
  createQueryStream,
  createBatchStream,
  createRateLimitedStream,
  createResilientPipeline,
  StreamingEngine,
  type StreamingOptions,
  type BackpressureState,
  type StreamMetrics,
  type ChunkProcessor
} from './streaming'

// Default export for convenience
export default {
  version,
  createTemplateContext,
  renderTemplate,
  renderString,
  loadOntologyContext,
  createHotReloadSystem,
  createIncrementalRenderer,
  // Dark matter features
  validateInput,
  createPerformanceBudget,
  withTransaction,
  createTemplateStream
}