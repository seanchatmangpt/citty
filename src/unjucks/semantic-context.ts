/**
 * 🧠 DARK MATTER: Multi-Dimensional Semantic Context System
 * The hidden 80% that makes template contexts actually work
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import type { TemplateContext } from '../types'

// Multi-dimensional context that exists across time, space, and meaning
export interface SemanticContext extends TemplateContext {
  // Temporal dimension - context changes over time
  temporal: {
    created: Date
    modified: Date
    ttl?: number                    // Time to live
    version: number                  // Version for optimistic locking
    history: Array<{                // Context history for time-travel debugging
      timestamp: Date
      snapshot: any
      delta: any
    }>
  }
  
  // Spatial dimension - context exists in hierarchies
  spatial: {
    parent?: SemanticContext        // Parent context for inheritance
    children: Set<SemanticContext>  // Child contexts
    siblings: Set<SemanticContext>  // Sibling contexts for cross-pollination
    depth: number                    // Depth in context tree
    path: string[]                   // Path from root context
  }
  
  // Semantic dimension - context has meaning
  semantic: {
    ontology: Map<string, any>      // Ontological bindings
    types: Map<string, string>      // Type annotations
    constraints: Map<string, any>   // Semantic constraints
    relationships: Map<string, string[]> // Entity relationships
    confidence: Map<string, number>  // Confidence scores 0-1
  }
  
  // Computational dimension - how context behaves
  computational: {
    lazy: Map<string, () => any>    // Lazy-evaluated values
    computed: Map<string, any>      // Computed properties
    watchers: Map<string, Function[]> // Change watchers
    validators: Map<string, Function> // Value validators
    transformers: Map<string, Function> // Value transformers
  }
  
  // Meta dimension - context about context
  meta: {
    fingerprint: string              // Content hash for caching
    dependencies: Set<string>       // Other contexts this depends on
    dependents: Set<string>         // Contexts that depend on this
    mutations: number                // Mutation counter
    frozen: boolean                  // Immutability flag
  }
}

// Context propagation strategies
export enum PropagationStrategy {
  BROADCAST = 'broadcast',           // Propagate to all children
  CASCADE = 'cascade',               // Propagate down the tree
  BUBBLE = 'bubble',                 // Propagate up to parents
  LATERAL = 'lateral',               // Propagate to siblings
  SELECTIVE = 'selective',           // Propagate based on rules
  NONE = 'none'                      // No propagation
}

// Context merge strategies when conflicts arise
export enum MergeStrategy {
  OVERRIDE = 'override',             // New value overrides old
  MERGE = 'merge',                   // Deep merge objects
  APPEND = 'append',                 // Append to arrays
  IGNORE = 'ignore',                 // Keep existing value
  FAIL = 'fail',                     // Throw on conflict
  CALLBACK = 'callback'              // Use custom callback
}

export class SemanticContextManager extends EventEmitter {
  private contexts: Map<string, SemanticContext> = new Map()
  private rootContext: SemanticContext
  private circularRefs: Set<string> = new Set()
  private evaluationCache: Map<string, any> = new Map()
  private resolutionGraph: Map<string, Set<string>> = new Map()
  
  constructor() {
    super()
    this.rootContext = this.createContext('root')
  }
  
  /**
   * Creates a new semantic context with full dimensional support
   */
  createContext(
    id: string, 
    parent?: SemanticContext,
    initialData: Partial<SemanticContext> = {}
  ): SemanticContext {
    const now = new Date()
    
    const context: SemanticContext = {
      ...initialData,
      temporal: {
        created: now,
        modified: now,
        version: 1,
        history: [],
        ...initialData.temporal
      },
      spatial: {
        parent,
        children: new Set(),
        siblings: new Set(),
        depth: parent ? parent.spatial.depth + 1 : 0,
        path: parent ? [...parent.spatial.path, id] : [id],
        ...initialData.spatial
      },
      semantic: {
        ontology: new Map(),
        types: new Map(),
        constraints: new Map(),
        relationships: new Map(),
        confidence: new Map(),
        ...initialData.semantic
      },
      computational: {
        lazy: new Map(),
        computed: new Map(),
        watchers: new Map(),
        validators: new Map(),
        transformers: new Map(),
        ...initialData.computational
      },
      meta: {
        fingerprint: '',
        dependencies: new Set(),
        dependents: new Set(),
        mutations: 0,
        frozen: false,
        ...initialData.meta
      }
    }
    
    // Update fingerprint
    context.meta.fingerprint = this.computeFingerprint(context)
    
    // Link to parent
    if (parent) {
      parent.spatial.children.add(context)
      context.meta.dependencies.add(this.getContextId(parent))
    }
    
    // Store context
    this.contexts.set(id, context)
    
    // Emit creation event
    this.emit('context:created', { id, context })
    
    return context
  }
  
  /**
   * Propagates changes through the context graph
   * This is the dark matter that makes contexts actually work
   */
  propagateChange(
    contextId: string,
    key: string,
    value: any,
    strategy: PropagationStrategy = PropagationStrategy.CASCADE
  ): void {
    const context = this.contexts.get(contextId)
    if (!context || context.meta.frozen) return
    
    // Update context
    this.setContextValue(context, key, value)
    
    // Propagate based on strategy
    switch (strategy) {
      case PropagationStrategy.BROADCAST:
        this.broadcastToAll(context, key, value)
        break
      case PropagationStrategy.CASCADE:
        this.cascadeToChildren(context, key, value)
        break
      case PropagationStrategy.BUBBLE:
        this.bubbleToParents(context, key, value)
        break
      case PropagationStrategy.LATERAL:
        this.propagateToSiblings(context, key, value)
        break
      case PropagationStrategy.SELECTIVE:
        this.selectivePropagation(context, key, value)
        break
    }
    
    // Trigger watchers
    this.triggerWatchers(context, key, value)
    
    // Invalidate caches
    this.invalidateCaches(context, key)
  }
  
  /**
   * Resolves a value through the context inheritance chain
   * Handles lazy evaluation, computed properties, and circular references
   */
  resolveValue(contextId: string, key: string): any {
    // Check for circular reference
    const refKey = `${contextId}:${key}`
    if (this.circularRefs.has(refKey)) {
      throw new Error(`Circular reference detected: ${refKey}`)
    }
    
    this.circularRefs.add(refKey)
    
    try {
      const context = this.contexts.get(contextId)
      if (!context) return undefined
      
      // Check cache first
      const cacheKey = `${context.meta.fingerprint}:${key}`
      if (this.evaluationCache.has(cacheKey)) {
        return this.evaluationCache.get(cacheKey)
      }
      
      let value: any
      
      // 1. Check lazy values
      if (context.computational.lazy.has(key)) {
        value = context.computational.lazy.get(key)!()
        this.evaluationCache.set(cacheKey, value)
        return value
      }
      
      // 2. Check computed properties
      if (context.computational.computed.has(key)) {
        value = context.computational.computed.get(key)
        return value
      }
      
      // 3. Check direct value
      if (key in context) {
        value = (context as any)[key]
        
        // Apply transformer if exists
        if (context.computational.transformers.has(key)) {
          value = context.computational.transformers.get(key)!(value)
        }
        
        return value
      }
      
      // 4. Check parent context (inheritance)
      if (context.spatial.parent) {
        return this.resolveValue(
          this.getContextId(context.spatial.parent),
          key
        )
      }
      
      return undefined
    } finally {
      this.circularRefs.delete(refKey)
    }
  }
  
  /**
   * Merges contexts with conflict resolution
   */
  mergeContexts(
    target: SemanticContext,
    source: SemanticContext,
    strategy: MergeStrategy = MergeStrategy.MERGE
  ): SemanticContext {
    // Track merge in history
    target.temporal.history.push({
      timestamp: new Date(),
      snapshot: this.snapshotContext(target),
      delta: this.computeDelta(target, source)
    })
    
    // Merge based on strategy
    switch (strategy) {
      case MergeStrategy.OVERRIDE:
        Object.assign(target, source)
        break
      case MergeStrategy.MERGE:
        this.deepMerge(target, source)
        break
      case MergeStrategy.APPEND:
        this.appendMerge(target, source)
        break
      case MergeStrategy.IGNORE:
        // Keep target as is
        break
      case MergeStrategy.FAIL:
        const conflicts = this.findConflicts(target, source)
        if (conflicts.length > 0) {
          throw new Error(`Merge conflicts: ${conflicts.join(', ')}`)
        }
        break
    }
    
    // Update metadata
    target.temporal.modified = new Date()
    target.temporal.version++
    target.meta.mutations++
    target.meta.fingerprint = this.computeFingerprint(target)
    
    return target
  }
  
  /**
   * Creates a semantic binding between ontology and context
   */
  bindOntology(
    contextId: string,
    ontologyPath: string,
    binding: any
  ): void {
    const context = this.contexts.get(contextId)
    if (!context) return
    
    context.semantic.ontology.set(ontologyPath, binding)
    
    // Infer types from ontology
    const inferredType = this.inferType(binding)
    if (inferredType) {
      context.semantic.types.set(ontologyPath, inferredType)
    }
    
    // Extract relationships
    const relationships = this.extractRelationships(binding)
    if (relationships.length > 0) {
      context.semantic.relationships.set(ontologyPath, relationships)
    }
    
    // Calculate confidence
    const confidence = this.calculateConfidence(binding)
    context.semantic.confidence.set(ontologyPath, confidence)
    
    this.emit('ontology:bound', { contextId, ontologyPath, binding })
  }
  
  /**
   * Validates context against semantic constraints
   */
  validateContext(context: SemanticContext): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Check semantic constraints
    for (const [key, constraint] of context.semantic.constraints) {
      const value = this.resolveValue(this.getContextId(context), key)
      if (!this.checkConstraint(value, constraint)) {
        errors.push(`Constraint violation for ${key}: ${JSON.stringify(constraint)}`)
      }
    }
    
    // Check validators
    for (const [key, validator] of context.computational.validators) {
      const value = this.resolveValue(this.getContextId(context), key)
      try {
        if (!validator(value)) {
          errors.push(`Validation failed for ${key}`)
        }
      } catch (e: any) {
        errors.push(`Validator error for ${key}: ${e.message}`)
      }
    }
    
    // Check type consistency
    for (const [key, type] of context.semantic.types) {
      const value = this.resolveValue(this.getContextId(context), key)
      if (!this.checkType(value, type)) {
        errors.push(`Type mismatch for ${key}: expected ${type}`)
      }
    }
    
    return { valid: errors.length === 0, errors }
  }
  
  /**
   * Time-travel debugging - restore context to previous state
   */
  restoreSnapshot(contextId: string, timestamp: Date): void {
    const context = this.contexts.get(contextId)
    if (!context) return
    
    const snapshot = context.temporal.history.find(h => 
      h.timestamp.getTime() === timestamp.getTime()
    )
    
    if (snapshot) {
      Object.assign(context, snapshot.snapshot)
      context.temporal.modified = new Date()
      this.emit('context:restored', { contextId, timestamp })
    }
  }
  
  // Private helper methods
  private computeFingerprint(context: SemanticContext): string {
    const content = JSON.stringify({
      data: context,
      version: context.temporal.version
    })
    return createHash('sha256').update(content).digest('hex')
  }
  
  private getContextId(context: SemanticContext): string {
    for (const [id, ctx] of this.contexts) {
      if (ctx === context) return id
    }
    return 'unknown'
  }
  
  private setContextValue(context: SemanticContext, key: string, value: any): void {
    (context as any)[key] = value
    context.temporal.modified = new Date()
    context.meta.mutations++
  }
  
  private broadcastToAll(context: SemanticContext, key: string, value: any): void {
    for (const ctx of this.contexts.values()) {
      if (ctx !== context) {
        this.setContextValue(ctx, key, value)
      }
    }
  }
  
  private cascadeToChildren(context: SemanticContext, key: string, value: any): void {
    for (const child of context.spatial.children) {
      this.setContextValue(child, key, value)
      this.cascadeToChildren(child, key, value)
    }
  }
  
  private bubbleToParents(context: SemanticContext, key: string, value: any): void {
    if (context.spatial.parent) {
      this.setContextValue(context.spatial.parent, key, value)
      this.bubbleToParents(context.spatial.parent, key, value)
    }
  }
  
  private propagateToSiblings(context: SemanticContext, key: string, value: any): void {
    for (const sibling of context.spatial.siblings) {
      this.setContextValue(sibling, key, value)
    }
  }
  
  private selectivePropagation(context: SemanticContext, key: string, value: any): void {
    // Propagate based on semantic relationships
    const relationships = context.semantic.relationships.get(key) || []
    for (const relatedKey of relationships) {
      for (const ctx of this.contexts.values()) {
        if (ctx.semantic.relationships.has(relatedKey)) {
          this.setContextValue(ctx, key, value)
        }
      }
    }
  }
  
  private triggerWatchers(context: SemanticContext, key: string, value: any): void {
    const watchers = context.computational.watchers.get(key) || []
    for (const watcher of watchers) {
      watcher(value, key, context)
    }
  }
  
  private invalidateCaches(context: SemanticContext, key: string): void {
    const pattern = new RegExp(`${context.meta.fingerprint}:.*${key}.*`)
    for (const cacheKey of this.evaluationCache.keys()) {
      if (pattern.test(cacheKey)) {
        this.evaluationCache.delete(cacheKey)
      }
    }
  }
  
  private snapshotContext(context: SemanticContext): any {
    return JSON.parse(JSON.stringify(context))
  }
  
  private computeDelta(target: SemanticContext, source: SemanticContext): any {
    // Simple delta computation - could be enhanced with deep diff
    return { source: this.snapshotContext(source) }
  }
  
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {}
        this.deepMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
  }
  
  private appendMerge(target: any, source: any): void {
    for (const key in source) {
      if (Array.isArray(target[key]) && Array.isArray(source[key])) {
        target[key].push(...source[key])
      } else {
        target[key] = source[key]
      }
    }
  }
  
  private findConflicts(target: any, source: any): string[] {
    const conflicts: string[] = []
    for (const key in source) {
      if (key in target && target[key] !== source[key]) {
        conflicts.push(key)
      }
    }
    return conflicts
  }
  
  private inferType(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }
  
  private extractRelationships(binding: any): string[] {
    const relationships: string[] = []
    // Extract relationships from binding structure
    if (binding && typeof binding === 'object') {
      for (const key in binding) {
        if (key.startsWith('rel:') || key.startsWith('has') || key.startsWith('is')) {
          relationships.push(key)
        }
      }
    }
    return relationships
  }
  
  private calculateConfidence(binding: any): number {
    // Simple confidence calculation based on completeness
    if (!binding) return 0
    if (typeof binding !== 'object') return 1
    
    let fields = 0
    let filled = 0
    
    for (const key in binding) {
      fields++
      if (binding[key] !== null && binding[key] !== undefined) {
        filled++
      }
    }
    
    return fields > 0 ? filled / fields : 0
  }
  
  private checkConstraint(value: any, constraint: any): boolean {
    // Simplified constraint checking
    if (typeof constraint === 'function') {
      return constraint(value)
    }
    return true
  }
  
  private checkType(value: any, expectedType: string): boolean {
    const actualType = this.inferType(value)
    return actualType === expectedType
  }
}

// Global instance for the dark matter that connects everything
export const semanticContextManager = new SemanticContextManager()

/**
 * Create a new semantic context with multi-dimensional structure
 */
export function createSemanticContext(base: any = {}): SemanticContext {
  return semanticContextManager.create(base)
}

/**
 * Propagate context changes across the dimensional space
 */
export function propagateContext(context: SemanticContext, options: PropagationOptions = {}): SemanticContext {
  return semanticContextManager.propagate(context, options)
}

export type ContextSnapshot = SemanticContext
export type PropagationOptions = {
  direction?: 'up' | 'down' | 'lateral' | 'temporal'
  strategy?: ContextPropagationStrategy
  depth?: number
}