// Main entry point for @unjs/unjucks
export * from './types.js';
export * from './context.js';
export * from './walker.js';
export * from './renderer.js';
export * from './ontology.js';

// Re-export main functionality for convenience
export { 
  createTemplateContext, 
  useTemplateContext, 
  updateTemplateContext 
} from './context.js';

export { 
  walkTemplates, 
  resolveTemplate, 
  listGenerators, 
  listActions 
} from './walker.js';

export { 
  renderTemplate, 
  renderString, 
  registerFilter, 
  registerFilters,
  TemplateRenderer 
} from './renderer.js';

export { 
  loadOntologyContext, 
  queryEntities, 
  expandContext,
  OntologyManager 
} from './ontology.js';