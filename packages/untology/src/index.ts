// Context management
export {
  useOntology,
  hasOntology,
  withOntology,
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

// Re-export useful N3 types
export type { Quad, Term, NamedNode, Literal } from 'n3'