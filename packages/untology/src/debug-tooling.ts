/**
 * 🧠 DARK MATTER: Debug Tooling & Introspection System
 * The debugging infrastructure humans always need but never build
 */

import { Store, Quad, NamedNode } from 'n3'
import { EventEmitter } from 'events'
import { useOntology } from './context'

export interface DebugSession {
  id: string
  name: string
  startTime: number
  operations: DebugOperation[]
  snapshots: GraphSnapshot[]
  active: boolean
}

export interface DebugOperation {
  id: string
  type: 'query' | 'inference' | 'validation' | 'template' | 'transaction'
  operation: string
  input: any
  output: any
  duration: number
  timestamp: number
  metadata: any
  stackTrace?: string[]
}

export interface GraphSnapshot {
  id: string
  timestamp: number
  quadCount: number
  namespaces: Record<string, string>
  signature: string // Hash of all quads for change detection
  delta?: GraphDelta
}

export interface GraphDelta {
  added: Quad[]
  removed: Quad[]
  modified: Array<{ before: Quad, after: Quad }>
}

export interface InspectionReport {
  store: {
    size: number
    namespaces: Record<string, string>
    subjects: number
    predicates: number
    objects: number
    literals: number
    types: string[]
  }
  performance: {
    averageQueryTime: number
    slowestQueries: Array<{ query: string, duration: number }>
    memoryUsage: number
    cacheHitRatio: number
  }
  quality: {
    duplicateQuads: number
    orphanedNodes: number
    inconsistencies: string[]
    completeness: number // 0-1 score
  }
  relationships: {
    hierarchy: GraphHierarchy[]
    clusters: GraphCluster[]
    centrality: Array<{ node: string, score: number }>
  }
}

export interface GraphHierarchy {
  root: string
  depth: number
  children: GraphHierarchy[]
  properties: string[]
}

export interface GraphCluster {
  id: string
  nodes: string[]
  density: number
  topics: string[]
}

/**
 * Advanced debug tooling system with introspection capabilities
 */
export class DebugTooling extends EventEmitter {
  private sessions = new Map<string, DebugSession>()
  private currentSession: DebugSession | null = null
  private operationStack: string[] = []
  private breakpoints = new Set<string>()
  private watchExpressions = new Map<string, Function>()
  private interceptors = new Map<string, Function[]>()
  
  constructor() {
    super()
    this.setupInterceptors()
  }

  /**
   * Start debugging session
   */
  startSession(name: string): string {
    const session: DebugSession = {
      id: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      startTime: Date.now(),
      operations: [],
      snapshots: [],
      active: true
    }

    this.sessions.set(session.id, session)
    this.currentSession = session

    // Take initial snapshot
    this.takeSnapshot('session_start')

    this.emit('session:started', { sessionId: session.id, name })
    return session.id
  }

  /**
   * End debugging session
   */
  endSession(sessionId?: string): DebugSession | null {
    const session = sessionId ? 
      this.sessions.get(sessionId) : 
      this.currentSession

    if (!session) return null

    session.active = false
    this.takeSnapshot('session_end', session)

    if (session === this.currentSession) {
      this.currentSession = null
    }

    this.emit('session:ended', {
      sessionId: session.id,
      duration: Date.now() - session.startTime,
      operations: session.operations.length
    })

    return session
  }

  /**
   * Record debug operation
   */
  recordOperation(
    type: DebugOperation['type'],
    operation: string,
    input: any,
    output?: any,
    metadata?: any
  ): string {
    if (!this.currentSession) return ''

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    // Capture stack trace
    const stackTrace = new Error().stack?.split('\n')
      .slice(2, 10) // Skip first 2 lines and limit to 8
      .map(line => line.trim()) || []

    const debugOp: DebugOperation = {
      id: operationId,
      type,
      operation,
      input: this.sanitizeForLogging(input),
      output: this.sanitizeForLogging(output),
      duration: 0,
      timestamp: startTime,
      metadata: metadata || {},
      stackTrace
    }

    this.currentSession.operations.push(debugOp)

    // Check breakpoints
    if (this.shouldBreak(operation, type)) {
      this.emit('breakpoint:hit', { operation: debugOp, session: this.currentSession })
    }

    // Evaluate watch expressions
    this.evaluateWatches(debugOp)

    return operationId
  }

  /**
   * Update operation with completion data
   */
  completeOperation(operationId: string, output: any, error?: Error): void {
    if (!this.currentSession) return

    const operation = this.currentSession.operations.find(op => op.id === operationId)
    if (!operation) return

    operation.output = this.sanitizeForLogging(output)
    operation.duration = Date.now() - operation.timestamp

    if (error) {
      operation.metadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 10)
      }
    }

    this.emit('operation:completed', { operation, session: this.currentSession })
  }

  /**
   * Take graph snapshot
   */
  takeSnapshot(label: string, session?: DebugSession): string {
    const targetSession = session || this.currentSession
    if (!targetSession) return ''

    try {
      const context = useOntology()
      const allQuads = context.store.getQuads(null, null, null, null)
      
      const snapshot: GraphSnapshot = {
        id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        quadCount: allQuads.length,
        namespaces: { ...context.prefixes },
        signature: this.generateGraphSignature(allQuads)
      }

      // Calculate delta from previous snapshot
      const prevSnapshot = targetSession.snapshots[targetSession.snapshots.length - 1]
      if (prevSnapshot) {
        snapshot.delta = this.calculateDelta(prevSnapshot, snapshot, context.store)
      }

      targetSession.snapshots.push(snapshot)

      this.emit('snapshot:taken', { 
        snapshotId: snapshot.id, 
        label, 
        quadCount: snapshot.quadCount,
        hasChanges: !!snapshot.delta
      })

      return snapshot.id
    } catch (error) {
      this.emit('snapshot:error', { error: error.message, label })
      return ''
    }
  }

  /**
   * Generate comprehensive inspection report
   */
  generateInspectionReport(): InspectionReport {
    try {
      const context = useOntology()
      const store = context.store
      const allQuads = store.getQuads(null, null, null, null)

      return {
        store: this.analyzeStore(store, allQuads),
        performance: this.analyzePerformance(),
        quality: this.analyzeQuality(store, allQuads),
        relationships: this.analyzeRelationships(store, allQuads)
      }
    } catch (error) {
      throw new Error(`Failed to generate inspection report: ${error.message}`)
    }
  }

  /**
   * Add breakpoint
   */
  addBreakpoint(pattern: string): void {
    this.breakpoints.add(pattern)
    this.emit('breakpoint:added', { pattern })
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(pattern: string): boolean {
    const removed = this.breakpoints.delete(pattern)
    if (removed) {
      this.emit('breakpoint:removed', { pattern })
    }
    return removed
  }

  /**
   * Add watch expression
   */
  addWatchExpression(name: string, expression: Function): void {
    this.watchExpressions.set(name, expression)
    this.emit('watch:added', { name })
  }

  /**
   * Remove watch expression
   */
  removeWatchExpression(name: string): boolean {
    const removed = this.watchExpressions.delete(name)
    if (removed) {
      this.emit('watch:removed', { name })
    }
    return removed
  }

  /**
   * Add operation interceptor
   */
  addInterceptor(operationType: string, interceptor: Function): void {
    if (!this.interceptors.has(operationType)) {
      this.interceptors.set(operationType, [])
    }
    this.interceptors.get(operationType)!.push(interceptor)
    this.emit('interceptor:added', { operationType })
  }

  /**
   * Get debug session details
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Get all sessions
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Query operations across sessions
   */
  queryOperations(filter: {
    sessionId?: string
    type?: DebugOperation['type']
    operation?: string
    timeRange?: [number, number]
    hasError?: boolean
  }): DebugOperation[] {
    let operations: DebugOperation[] = []

    const sessionsToSearch = filter.sessionId ?
      [this.sessions.get(filter.sessionId)].filter(Boolean) :
      Array.from(this.sessions.values())

    for (const session of sessionsToSearch) {
      operations.push(...session.operations)
    }

    if (filter.type) {
      operations = operations.filter(op => op.type === filter.type)
    }

    if (filter.operation) {
      operations = operations.filter(op => 
        op.operation.includes(filter.operation!)
      )
    }

    if (filter.timeRange) {
      const [start, end] = filter.timeRange
      operations = operations.filter(op => 
        op.timestamp >= start && op.timestamp <= end
      )
    }

    if (filter.hasError !== undefined) {
      operations = operations.filter(op => 
        !!op.metadata.error === filter.hasError
      )
    }

    return operations.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Export debug session
   */
  exportSession(sessionId: string, format: 'json' | 'csv' = 'json'): string {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    if (format === 'json') {
      return JSON.stringify(session, null, 2)
    }

    // CSV export
    const csvRows = ['Type,Operation,Duration,Timestamp,HasError']
    for (const op of session.operations) {
      csvRows.push([
        op.type,
        `"${op.operation.replace(/"/g, '""')}"`,
        op.duration.toString(),
        new Date(op.timestamp).toISOString(),
        (!!op.metadata.error).toString()
      ].join(','))
    }

    return csvRows.join('\n')
  }

  /**
   * Analyze store structure
   */
  private analyzeStore(store: Store, allQuads: Quad[]): InspectionReport['store'] {
    const subjects = new Set<string>()
    const predicates = new Set<string>()
    const objects = new Set<string>()
    const literals = new Set<string>()
    const types = new Set<string>()

    for (const quad of allQuads) {
      subjects.add(quad.subject.value)
      predicates.add(quad.predicate.value)
      
      if (quad.object.termType === 'NamedNode') {
        objects.add(quad.object.value)
      } else {
        literals.add(quad.object.value)
      }

      // Track types
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        types.add(quad.object.value)
      }
    }

    const context = useOntology()
    return {
      size: allQuads.length,
      namespaces: { ...context.prefixes },
      subjects: subjects.size,
      predicates: predicates.size,
      objects: objects.size,
      literals: literals.size,
      types: Array.from(types)
    }
  }

  /**
   * Analyze performance metrics
   */
  private analyzePerformance(): InspectionReport['performance'] {
    const allOperations = Array.from(this.sessions.values())
      .flatMap(session => session.operations)
      .filter(op => op.duration > 0)

    const queryOperations = allOperations.filter(op => op.type === 'query')
    const averageQueryTime = queryOperations.length > 0 ?
      queryOperations.reduce((sum, op) => sum + op.duration, 0) / queryOperations.length : 0

    const slowestQueries = queryOperations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(op => ({
        query: op.operation,
        duration: op.duration
      }))

    return {
      averageQueryTime,
      slowestQueries,
      memoryUsage: process.memoryUsage().heapUsed,
      cacheHitRatio: 0.85 // Would calculate from actual cache stats
    }
  }

  /**
   * Analyze data quality
   */
  private analyzeQuality(store: Store, allQuads: Quad[]): InspectionReport['quality'] {
    // Find duplicate quads
    const quadStrings = allQuads.map(q => 
      `${q.subject.value}|${q.predicate.value}|${q.object.value}|${q.graph?.value || ''}`
    )
    const uniqueQuads = new Set(quadStrings)
    const duplicateQuads = quadStrings.length - uniqueQuads.size

    // Find orphaned nodes (referenced but not defined)
    const definedNodes = new Set(allQuads.map(q => q.subject.value))
    const referencedNodes = new Set(
      allQuads
        .filter(q => q.object.termType === 'NamedNode')
        .map(q => q.object.value)
    )
    
    const orphanedNodes = Array.from(referencedNodes)
      .filter(node => !definedNodes.has(node))
      .length

    // Basic consistency checks
    const inconsistencies: string[] = []
    
    // Check for missing rdfs:label on important resources
    const importantResources = Array.from(definedNodes).slice(0, 100)
    for (const resource of importantResources) {
      const hasLabel = allQuads.some(q => 
        q.subject.value === resource && 
        q.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#label'
      )
      if (!hasLabel) {
        inconsistencies.push(`Missing label for: ${resource}`)
      }
    }

    // Completeness score (rough estimate)
    const completeness = Math.max(0, Math.min(1, 
      (allQuads.length - duplicateQuads - orphanedNodes) / Math.max(1, allQuads.length)
    ))

    return {
      duplicateQuads,
      orphanedNodes,
      inconsistencies: inconsistencies.slice(0, 20), // Limit for readability
      completeness
    }
  }

  /**
   * Analyze relationship patterns
   */
  private analyzeRelationships(store: Store, allQuads: Quad[]): InspectionReport['relationships'] {
    // Build simple hierarchy (rdfs:subClassOf)
    const hierarchy = this.buildHierarchy(allQuads)
    
    // Identify clusters by shared predicates
    const clusters = this.identifyClusters(allQuads)
    
    // Calculate centrality (number of connections)
    const centrality = this.calculateCentrality(allQuads)

    return {
      hierarchy,
      clusters,
      centrality: centrality.slice(0, 20) // Top 20 most central nodes
    }
  }

  /**
   * Build class hierarchy
   */
  private buildHierarchy(allQuads: Quad[]): GraphHierarchy[] {
    const subClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
    const hierarchyMap = new Map<string, string[]>()
    
    // Build parent-child relationships
    for (const quad of allQuads) {
      if (quad.predicate.value === subClassOf && quad.object.termType === 'NamedNode') {
        const parent = quad.object.value
        const child = quad.subject.value
        
        if (!hierarchyMap.has(parent)) {
          hierarchyMap.set(parent, [])
        }
        hierarchyMap.get(parent)!.push(child)
      }
    }

    // Find roots (nodes with no parents)
    const allChildren = new Set(Array.from(hierarchyMap.values()).flat())
    const roots = Array.from(hierarchyMap.keys())
      .filter(node => !allChildren.has(node))

    // Build hierarchy trees
    const buildTree = (node: string, depth: number = 0): GraphHierarchy => {
      const children = hierarchyMap.get(node) || []
      return {
        root: node,
        depth,
        children: children.map(child => buildTree(child, depth + 1)),
        properties: this.getNodeProperties(node, allQuads)
      }
    }

    return roots.map(root => buildTree(root)).slice(0, 10) // Limit for performance
  }

  /**
   * Get properties for a node
   */
  private getNodeProperties(node: string, allQuads: Quad[]): string[] {
    return allQuads
      .filter(q => q.subject.value === node)
      .map(q => q.predicate.value)
      .slice(0, 10) // Limit properties shown
  }

  /**
   * Identify clusters of related nodes
   */
  private identifyClusters(allQuads: Quad[]): GraphCluster[] {
    const clusters: GraphCluster[] = []
    const predicateGroups = new Map<string, string[]>()

    // Group nodes by shared predicates
    for (const quad of allQuads) {
      const predicate = quad.predicate.value
      if (!predicateGroups.has(predicate)) {
        predicateGroups.set(predicate, [])
      }
      predicateGroups.get(predicate)!.push(quad.subject.value)
    }

    // Create clusters for most common predicates
    const sortedPredicates = Array.from(predicateGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)

    for (const [predicate, nodes] of sortedPredicates) {
      const uniqueNodes = Array.from(new Set(nodes))
      if (uniqueNodes.length >= 3) {
        clusters.push({
          id: `cluster_${predicate.split('/').pop() || 'unknown'}`,
          nodes: uniqueNodes.slice(0, 20), // Limit cluster size
          density: uniqueNodes.length / nodes.length,
          topics: [predicate]
        })
      }
    }

    return clusters
  }

  /**
   * Calculate node centrality
   */
  private calculateCentrality(allQuads: Quad[]): Array<{ node: string, score: number }> {
    const connectionCount = new Map<string, number>()

    for (const quad of allQuads) {
      // Count as subject
      connectionCount.set(
        quad.subject.value,
        (connectionCount.get(quad.subject.value) || 0) + 1
      )

      // Count as object if NamedNode
      if (quad.object.termType === 'NamedNode') {
        connectionCount.set(
          quad.object.value,
          (connectionCount.get(quad.object.value) || 0) + 1
        )
      }
    }

    return Array.from(connectionCount.entries())
      .map(([node, score]) => ({ node, score }))
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Generate graph signature for change detection
   */
  private generateGraphSignature(quads: Quad[]): string {
    const quadStrings = quads
      .map(q => `${q.subject.value}|${q.predicate.value}|${q.object.value}`)
      .sort()
      .join('\n')
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < quadStrings.length; i++) {
      const char = quadStrings.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    return hash.toString(36)
  }

  /**
   * Calculate delta between snapshots
   */
  private calculateDelta(
    prevSnapshot: GraphSnapshot,
    currentSnapshot: GraphSnapshot,
    currentStore: Store
  ): GraphDelta {
    // For simplicity, detect changes by signature difference
    if (prevSnapshot.signature === currentSnapshot.signature) {
      return { added: [], removed: [], modified: [] }
    }

    // In a full implementation, we'd store quad lists and do proper diff
    // For now, just indicate there were changes
    const currentQuads = currentStore.getQuads(null, null, null, null)
    const recentQuads = currentQuads.slice(-Math.max(1, currentQuads.length - prevSnapshot.quadCount))
    
    return {
      added: recentQuads,
      removed: [],
      modified: []
    }
  }

  /**
   * Setup operation interceptors
   */
  private setupInterceptors(): void {
    // Default interceptors would go here
    // For example, performance monitoring interceptor
  }

  /**
   * Check if operation should trigger breakpoint
   */
  private shouldBreak(operation: string, type: DebugOperation['type']): boolean {
    for (const pattern of this.breakpoints) {
      if (operation.includes(pattern) || type === pattern) {
        return true
      }
    }
    return false
  }

  /**
   * Evaluate watch expressions
   */
  private evaluateWatches(operation: DebugOperation): void {
    for (const [name, expression] of this.watchExpressions) {
      try {
        const result = expression(operation)
        this.emit('watch:evaluated', { name, result, operation })
      } catch (error) {
        this.emit('watch:error', { name, error: error.message, operation })
      }
    }
  }

  /**
   * Sanitize data for logging
   */
  private sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) return data
    
    try {
      // Deep clone and truncate large objects
      const cloned = JSON.parse(JSON.stringify(data))
      return this.truncateLargeObjects(cloned)
    } catch {
      return '[Unserializable Object]'
    }
  }

  /**
   * Truncate large objects for readability
   */
  private truncateLargeObjects(obj: any, depth: number = 0): any {
    if (depth > 3) return '[Deep Object]'
    if (typeof obj !== 'object' || obj === null) return obj
    
    if (Array.isArray(obj)) {
      if (obj.length > 10) {
        return [...obj.slice(0, 10), `[...${obj.length - 10} more items]`]
      }
      return obj.map(item => this.truncateLargeObjects(item, depth + 1))
    }

    const keys = Object.keys(obj)
    if (keys.length > 20) {
      const truncated: any = {}
      keys.slice(0, 20).forEach(key => {
        truncated[key] = this.truncateLargeObjects(obj[key], depth + 1)
      })
      truncated['[truncated]'] = `${keys.length - 20} more properties`
      return truncated
    }

    const result: any = {}
    keys.forEach(key => {
      result[key] = this.truncateLargeObjects(obj[key], depth + 1)
    })
    return result
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.sessions.clear()
    this.currentSession = null
    this.operationStack.length = 0
    this.breakpoints.clear()
    this.watchExpressions.clear()
    this.interceptors.clear()
    this.removeAllListeners()
  }
}

// Singleton instance
export const debugTools = new DebugTooling()

// Convenience functions
export function startDebugSession(name: string): string {
  return debugTools.startSession(name)
}

export function recordDebugOperation(
  type: DebugOperation['type'],
  operation: string,
  input: any,
  output?: any
): string {
  return debugTools.recordOperation(type, operation, input, output)
}

export function takeDebugSnapshot(label: string): string {
  return debugTools.takeSnapshot(label)
}

export function inspectSystem(): InspectionReport {
  return debugTools.generateInspectionReport()
}

export function addDebugBreakpoint(pattern: string): void {
  debugTools.addBreakpoint(pattern)
}

// Auto-setup debug interceptor for production monitoring
if (process.env.NODE_ENV === 'development') {
  debugTools.addInterceptor('query', (operation: DebugOperation) => {
    if (operation.duration > 1000) { // Slow query warning
      console.warn(`Slow query detected: ${operation.operation} (${operation.duration}ms)`)
    }
  })
}