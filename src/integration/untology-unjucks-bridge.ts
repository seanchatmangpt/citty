/**
 * 🧠 DARK MATTER: Untology-Unjucks Integration Bridge
 * The critical connection layer humans always miss
 */

import { loadGraph, askGraph, toContext, exportGraph } from '../untology'
import { generateFromOntology } from '../unjucks'
import { MemoryCache } from '../cache'
import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'
import { createHash } from 'crypto'

export interface BridgeOptions {
  cacheEnabled?: boolean
  cacheTtl?: number
  parallelProcessing?: boolean
  maxWorkers?: number
  sandboxed?: boolean
  memoryLimit?: number
}

export interface GenerationContext {
  ontologySource: string
  templates: string[]
  metadata: Record<string, any>
  timestamp: number
  sessionId: string
}

export interface GenerationResult {
  files: Array<{ path: string; content: string }>
  errors: Error[]
  metrics: {
    duration: number
    templatesProcessed: number
    ontologySize: number
    memoryUsed: number
  }
}

/**
 * The missing link: Connects ontology semantic data to template generation
 * with production-grade features
 */
export class UntologyUnjucksBridge extends EventEmitter {
  private cache: MemoryCache<GenerationResult>
  private workers: Worker[] = []
  private activeGenerations = new Map<string, GenerationContext>()
  private options: Required<BridgeOptions>

  constructor(options: BridgeOptions = {}) {
    super()
    
    this.options = {
      cacheEnabled: options.cacheEnabled !== false,
      cacheTtl: options.cacheTtl || 5 * 60 * 1000,
      parallelProcessing: options.parallelProcessing !== false,
      maxWorkers: options.maxWorkers || 4,
      sandboxed: options.sandboxed !== false,
      memoryLimit: options.memoryLimit || 512 * 1024 * 1024 // 512MB
    }
    
    this.cache = new MemoryCache({ defaultTtl: this.options.cacheTtl })
    
    // Setup process lifecycle hooks
    this.setupLifecycleHooks()
  }

  /**
   * Generate templates from ontology with full integration
   */
  async generate(
    ontologySource: string,
    templates?: string[],
    metadata: Record<string, any> = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now()
    const sessionId = this.generateSessionId(ontologySource)
    
    // Check cache
    if (this.options.cacheEnabled) {
      const cached = this.cache.get(sessionId)
      if (cached) {
        this.emit('cache:hit', { sessionId })
        return cached
      }
    }
    
    const context: GenerationContext = {
      ontologySource,
      templates: templates || [],
      metadata,
      timestamp: startTime,
      sessionId
    }
    
    this.activeGenerations.set(sessionId, context)
    this.emit('generation:start', context)
    
    try {
      // Load ontology into graph
      await loadGraph(ontologySource)
      
      // Query semantic information
      const entities = await this.querySemanticEntities(ontologySource)
      
      // Convert to context objects for templating
      const contextObjects = toContext()
      
      // Enrich with semantic reasoning
      const enrichedContext = await this.enrichWithSemantics(contextObjects, metadata)
      
      // Generate templates
      const result = await this.executeGeneration(
        enrichedContext,
        templates,
        sessionId
      )
      
      // Cache result
      if (this.options.cacheEnabled) {
        this.cache.set(sessionId, result, this.options.cacheTtl)
      }
      
      // Calculate metrics
      result.metrics = {
        duration: Date.now() - startTime,
        templatesProcessed: result.files.length,
        ontologySize: ontologySource.length,
        memoryUsed: process.memoryUsage().heapUsed
      }
      
      this.emit('generation:complete', { sessionId, result })
      return result
      
    } catch (error) {
      this.emit('generation:error', { sessionId, error })
      throw error
    } finally {
      this.activeGenerations.delete(sessionId)
    }
  }

  /**
   * Query semantic entities with natural language
   */
  private async querySemanticEntities(ontologySource: string) {
    const queries = [
      'list all Command',
      'list all Workflow',
      'list all Task',
      'list all Entity'
    ]
    
    const results: Record<string, any> = {}
    
    for (const query of queries) {
      try {
        results[query] = await askGraph(query)
      } catch (error) {
        // Gracefully handle query failures
        results[query] = []
      }
    }
    
    return results
  }

  /**
   * Enrich context with semantic reasoning
   */
  private async enrichWithSemantics(
    context: any,
    metadata: Record<string, any>
  ): Promise<any> {
    return {
      ...context,
      metadata,
      semantics: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        relationships: this.inferRelationships(context),
        patterns: this.detectPatterns(context),
        suggestions: this.generateSuggestions(context)
      }
    }
  }

  /**
   * Execute generation with sandboxing and parallelization
   */
  private async executeGeneration(
    context: any,
    templates: string[] | undefined,
    sessionId: string
  ): Promise<GenerationResult> {
    if (this.options.sandboxed && this.options.parallelProcessing) {
      return this.executeInWorker(context, templates, sessionId)
    }
    
    // Direct execution
    const result = await generateFromOntology(
      await exportGraph('turtle'),
      templates?.[0],
      { cache: false }
    )
    
    return {
      files: result.files || [],
      errors: result.errors || [],
      metrics: {
        duration: 0,
        templatesProcessed: 0,
        ontologySize: 0,
        memoryUsed: 0
      }
    }
  }

  /**
   * Execute in worker thread for sandboxing
   */
  private async executeInWorker(
    context: any,
    templates: string[] | undefined,
    sessionId: string
  ): Promise<GenerationResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const { generateFromOntology } = require('../unjucks');
        
        parentPort.on('message', async ({ context, templates }) => {
          try {
            const result = await generateFromOntology(
              context.ontology,
              templates?.[0],
              { context }
            );
            parentPort.postMessage({ success: true, result });
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        });
      `, { eval: true })
      
      worker.on('message', (msg) => {
        if (msg.success) {
          resolve(msg.result)
        } else {
          reject(new Error(msg.error))
        }
        worker.terminate()
      })
      
      worker.on('error', reject)
      worker.postMessage({ context, templates })
      
      // Timeout protection
      setTimeout(() => {
        worker.terminate()
        reject(new Error('Worker timeout'))
      }, 30000)
    })
  }

  /**
   * Infer relationships from context
   */
  private inferRelationships(context: any): any[] {
    const relationships = []
    
    // Extract relationships from context objects
    if (Array.isArray(context)) {
      for (const obj of context) {
        if (obj.$relationships) {
          relationships.push(...obj.$relationships)
        }
      }
    }
    
    return relationships
  }

  /**
   * Detect patterns in context
   */
  private detectPatterns(context: any): string[] {
    const patterns = []
    
    // Detect common patterns
    if (Array.isArray(context)) {
      if (context.some(obj => obj.type === 'Command')) {
        patterns.push('cli-command-pattern')
      }
      if (context.some(obj => obj.type === 'Workflow')) {
        patterns.push('workflow-orchestration-pattern')
      }
      if (context.some(obj => obj.type === 'Task')) {
        patterns.push('task-execution-pattern')
      }
    }
    
    return patterns
  }

  /**
   * Generate suggestions based on context
   */
  private generateSuggestions(context: any): string[] {
    const suggestions = []
    
    // Generate smart suggestions
    if (Array.isArray(context)) {
      if (context.length === 0) {
        suggestions.push('Add semantic entities to your ontology')
      }
      if (!context.some(obj => obj.type === 'Command')) {
        suggestions.push('Consider adding Command entities for CLI generation')
      }
      if (!context.some(obj => obj.description)) {
        suggestions.push('Add descriptions to improve template generation')
      }
    }
    
    return suggestions
  }

  /**
   * Generate session ID from ontology source
   */
  private generateSessionId(ontologySource: string): string {
    return createHash('sha256')
      .update(ontologySource)
      .update(Date.now().toString())
      .digest('hex')
      .substring(0, 16)
  }

  /**
   * Setup process lifecycle hooks for cleanup
   */
  private setupLifecycleHooks() {
    // Graceful shutdown
    const cleanup = () => {
      this.emit('shutdown:start')
      
      // Terminate workers
      for (const worker of this.workers) {
        worker.terminate()
      }
      
      // Clear cache
      this.cache.clear()
      
      // Cancel active generations
      for (const [sessionId, context] of this.activeGenerations) {
        this.emit('generation:cancelled', { sessionId })
      }
      this.activeGenerations.clear()
      
      this.emit('shutdown:complete')
    }
    
    // Register cleanup handlers
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('beforeExit', cleanup)
    
    // Memory pressure handling
    if (global.gc) {
      setInterval(() => {
        const usage = process.memoryUsage()
        if (usage.heapUsed > this.options.memoryLimit) {
          global.gc()
          this.cache.clear()
          this.emit('memory:pressure', { usage })
        }
      }, 30000)
    }
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    return {
      activeGenerations: this.activeGenerations.size,
      cacheStats: this.cache.getStats(),
      workers: this.workers.length,
      memory: process.memoryUsage()
    }
  }

  /**
   * Destroy bridge and cleanup resources
   */
  destroy() {
    this.removeAllListeners()
    this.cache.destroy()
    for (const worker of this.workers) {
      worker.terminate()
    }
  }
}

// Singleton instance
export const bridge = new UntologyUnjucksBridge()

// Convenience function
export async function generateFromSemanticOntology(
  ontologySource: string,
  templates?: string[],
  options?: BridgeOptions
): Promise<GenerationResult> {
  const bridgeInstance = options ? new UntologyUnjucksBridge(options) : bridge
  return bridgeInstance.generate(ontologySource, templates)
}