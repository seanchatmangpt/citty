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

// Version
export const version = '1.0.0'

// Default export for convenience
export default {
  version,
  createTemplateContext,
  renderTemplate,
  renderString,
  loadOntologyContext
}