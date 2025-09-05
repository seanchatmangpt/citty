// Context management
export {
  useOntology,
  hasOntology,
  withOntology,
  setOntologyContext,
  clearOntologyContext,
  createFreshContext,
  type OntologyContext
} from './context'

// Core 80% API
export {
  loadGraph,
  findEntities,
  findRelations,
  getValue,
  getValues,
  addTriple,
  removeTriples,
  hasTriple,
  graphSize,
  clearGraph
} from './core'

// Query API
export {
  askGraph,
  queryTriples
} from './query'

// Export API
export {
  exportTurtle,
  exportJsonLd,
  exportNTriples,
  toContextObjects
} from './export'

// Advanced 20% features - DARK MATTER
export {
  sparqlQuery,
  validateShacl,
  inferOwl,
  mergeGraphs,
  createGraph,
  parseTurtle,
  createStreamParser,
  isIsomorphic,
  blankNode,
  namedNode,
  literal,
  equals,
  getNamespaces,
  addNamespace,
  subGraph,
  getStatistics
} from './advanced'

// Inference engine - DARK MATTER
export {
  infer,
  addInferenceRule,
  explainInference,
  inferenceEngine
} from './inference'

// SPARQL engine - DARK MATTER
export {
  sparqlEngine,
  parseQuery
} from './sparql-engine'

// Error recovery & resilience - DARK MATTER
export {
  errorRecovery,
  safeExecute,
  safeQuery,
  safeContext,
  type RecoveryResult,
  type ErrorContext,
  type RecoveryOptions
} from './error-recovery'

// Memory management - DARK MATTER
export {
  memoryManager,
  getMemoryPressure,
  cleanupMemory,
  forceGC,
  analyzeMemoryTrends,
  type MemoryStats,
  type MemoryPressureInfo,
  type CleanupTask
} from './memory-management'

// Debug tooling & introspection - DARK MATTER
export {
  debugTools,
  startDebugSession,
  recordDebugOperation,
  takeDebugSnapshot,
  inspectSystem,
  addDebugBreakpoint,
  type DebugSession,
  type DebugOperation,
  type InspectionReport
} from './debug-tooling'

// Natural language interface - DARK MATTER
export {
  NaturalLanguageEngine,
  naturalLanguageEngine,
  askNaturalLanguage,
  chatWithData,
  explainSemanticData,
  suggestDataQueries,
  type OllamaProvider,
  type NaturalLanguageQuery,
  type NaturalLanguageResponse
} from './natural-language-engine'

// Re-export useful N3 types
export type { Quad, Term, NamedNode, Literal } from 'n3'
export type { 
  InferenceRule, 
  InferenceResult 
} from './inference'
export type { 
  SPARQLBinding, 
  SPARQLResult
} from './sparql-engine'