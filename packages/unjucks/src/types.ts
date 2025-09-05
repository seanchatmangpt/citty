/**
 * Unjucks Type Definitions
 * Production-ready types with full coverage
 */

// Template Types
export interface Template {
  path: string
  relativePath: string
  generator: string
  action: string
  metadata?: TemplateMetadata
}

export interface TemplateMetadata {
  name?: string
  description?: string
  to?: string
  inject?: boolean
  skip?: boolean
  unless?: string
  frontmatter?: Record<string, any>
}

// Context Types
export interface TemplateContext {
  [key: string]: any
  _meta?: ContextMetadata
  _ontology?: OntologyContext
}

export interface ContextMetadata {
  version: string
  created: Date
  updated: Date
  source?: string
}

export interface OntologyContext {
  entities: EntityContext[]
  namespaces: Record<string, string>
  version?: string
}

export interface EntityContext {
  id: string
  type: string
  properties: Record<string, any>
  relations?: Record<string, string[]>
}

// CLI Types
export interface CliOptions {
  generator?: string
  action?: string
  output?: string
  dryRun?: boolean
  diff?: boolean
  context?: string
  ontology?: string
  interactive?: boolean
  data?: Record<string, any>
  templateDir?: string
  verbose?: boolean
}

// Render Types
export interface RenderOptions {
  context?: TemplateContext
  filters?: Record<string, Function>
  globals?: Record<string, any>
  autoescape?: boolean
  throwOnUndefined?: boolean
}

export interface RenderResult {
  output: string
  metadata: RenderMetadata
}

export interface RenderMetadata {
  template: string
  duration: number
  variables: string[]
  filters: string[]
}

// Walker Types
export interface WalkOptions {
  paths?: string[]
  ignore?: string[]
  extensions?: string[]
  followSymlinks?: boolean
}

export interface GeneratorInfo {
  name: string
  path: string
  actions: string[]
  templates: number
  metadata?: Record<string, any>
}

// Filter Types
export interface FilterDefinition {
  name: string
  fn: Function
  async?: boolean
}

// Error Classes
export class UnjucksError extends Error {
  public readonly code: string
  public readonly details?: any

  constructor(message: string, code: string = 'UNJUCKS_ERROR', details?: any) {
    super(message)
    this.name = 'UnjucksError'
    this.code = code
    this.details = details
  }
}

export class TemplateNotFoundError extends UnjucksError {
  constructor(generator: string, action?: string, paths?: string[]) {
    const message = action 
      ? `Template '${generator}/${action}' not found`
      : `Generator '${generator}' not found`
    
    super(message, 'TEMPLATE_NOT_FOUND', { generator, action, paths })
  }
}

export class OntologyError extends UnjucksError {
  constructor(message: string, details?: any) {
    super(message, 'ONTOLOGY_ERROR', details)
  }
}

export class ContextError extends UnjucksError {
  constructor(message: string, details?: any) {
    super(message, 'CONTEXT_ERROR', details)
  }
}

export class RenderError extends UnjucksError {
  constructor(message: string, template?: string, details?: any) {
    super(message, 'RENDER_ERROR', { ...details, template })
  }
}

// Configuration Types
export interface UnjucksConfig {
  templateDirs: string[]
  outputDir?: string
  contextFile?: string
  ontologyFile?: string
  filters?: Record<string, Function>
  globals?: Record<string, any>
  nunjucksOptions?: NunjucksOptions
}

export interface NunjucksOptions {
  autoescape?: boolean
  throwOnUndefined?: boolean
  trimBlocks?: boolean
  lstripBlocks?: boolean
  noCache?: boolean
  web?: {
    useCache?: boolean
    async?: boolean
  }
}

// Plugin Types
export interface UnjucksPlugin {
  name: string
  setup?: (config: UnjucksConfig) => void | Promise<void>
  filters?: Record<string, Function>
  globals?: Record<string, any>
  beforeRender?: (context: TemplateContext, template: Template) => void | Promise<void>
  afterRender?: (result: RenderResult, template: Template) => void | Promise<void>
}

// Hook Types
export type HookFunction = (...args: any[]) => void | Promise<void>

export interface Hooks {
  'template:beforeResolve': (generator: string, action: string) => void
  'template:resolved': (template: Template) => void
  'context:beforeLoad': (source: string) => void
  'context:loaded': (context: TemplateContext) => void
  'render:before': (template: Template, context: TemplateContext) => void
  'render:after': (result: RenderResult, template: Template) => void
  'output:before': (path: string, content: string) => void
  'output:after': (path: string) => void
  'error': (error: Error) => void
}

// Export utility type guards
export function isTemplate(obj: any): obj is Template {
  return obj && 
    typeof obj.path === 'string' &&
    typeof obj.relativePath === 'string' &&
    typeof obj.generator === 'string' &&
    typeof obj.action === 'string'
}

export function isTemplateContext(obj: any): obj is TemplateContext {
  return obj && typeof obj === 'object' && !Array.isArray(obj)
}

export function isOntologyContext(obj: any): obj is OntologyContext {
  return obj &&
    Array.isArray(obj.entities) &&
    typeof obj.namespaces === 'object'
}

export function isRenderResult(obj: any): obj is RenderResult {
  return obj &&
    typeof obj.output === 'string' &&
    obj.metadata &&
    typeof obj.metadata.duration === 'number'
}