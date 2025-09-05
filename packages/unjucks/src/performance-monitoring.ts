/**
 * 🧠 DARK MATTER: Advanced Performance Monitoring & Real-time Metrics  
 * The production observability humans never implement properly
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

export interface PerformanceMetrics {
  operation: string
  startTime: number
  endTime: number
  duration: number
  memoryBefore: NodeJS.MemoryUsage
  memoryAfter: NodeJS.MemoryUsage
  memoryDelta: number
  success: boolean
  error?: string
  metadata?: any
}

export interface AggregateMetrics {
  operation: string
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
  successRate: number
  errorRate: number
  memoryAvg: number
  memoryMax: number
  throughputPerSecond: number
}

export interface PerformanceBudget {
  operation: string
  maxDuration: number
  maxMemory: number
  maxErrorRate: number
  alertThreshold: number
}

export interface BottleneckAnalysis {
  operation: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'cpu' | 'memory' | 'io' | 'algorithmic'
  description: string
  impact: number // 1-10 scale
  suggestions: string[]
  affectedOperations: string[]
}

/**
 * Production-grade performance monitoring with real-time analysis
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = []
  private activeOperations = new Map<string, { startTime: number, memoryBefore: NodeJS.MemoryUsage }>()
  private budgets: Map<string, PerformanceBudget> = new Map()
  private aggregateCache = new Map<string, { data: AggregateMetrics, timestamp: number }>()
  
  private readonly MAX_METRICS = 10000
  private readonly CACHE_TTL = 60000 // 1 minute
  private readonly ANALYSIS_INTERVAL = 30000 // 30 seconds
  
  private analysisTimer: NodeJS.Timer | null = null

  constructor() {
    super()
    this.startPeriodicAnalysis()
    this.setupDefaultBudgets()
  }

  /**
   * Start measuring performance for an operation
   */
  startMeasurement(operationId: string, operation: string, metadata?: any): void {
    const startTime = performance.now()
    const memoryBefore = process.memoryUsage()
    
    this.activeOperations.set(operationId, { startTime, memoryBefore })
    
    this.emit('measurement:start', {
      operationId,
      operation,
      startTime,
      memoryBefore,
      metadata
    })
  }

  /**
   * End measurement and record metrics
   */
  endMeasurement(
    operationId: string, 
    operation: string, 
    success: boolean = true, 
    error?: string,
    metadata?: any
  ): PerformanceMetrics | null {
    const active = this.activeOperations.get(operationId)
    if (!active) {
      this.emit('measurement:error', { 
        operationId, 
        error: 'No active measurement found' 
      })
      return null
    }

    const endTime = performance.now()
    const memoryAfter = process.memoryUsage()
    const duration = endTime - active.startTime
    const memoryDelta = memoryAfter.heapUsed - active.memoryBefore.heapUsed

    const metric: PerformanceMetrics = {
      operation,
      startTime: active.startTime,
      endTime,
      duration,
      memoryBefore: active.memoryBefore,
      memoryAfter,
      memoryDelta,
      success,
      error,
      metadata
    }

    this.recordMetric(metric)
    this.activeOperations.delete(operationId)
    
    return metric
  }

  /**
   * Measure function execution with automatic instrumentation
   */
  async measureFunction<T>(
    operation: string,
    fn: () => Promise<T> | T,
    metadata?: any
  ): Promise<{ result: T, metrics: PerformanceMetrics }> {
    const operationId = this.generateOperationId()
    let result: T
    let error: string | undefined

    this.startMeasurement(operationId, operation, metadata)

    try {
      result = await fn()
      return {
        result,
        metrics: this.endMeasurement(operationId, operation, true, undefined, metadata)!
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      if (error) {
        this.endMeasurement(operationId, operation, false, error, metadata)
      }
    }
  }

  /**
   * Get aggregate metrics for an operation
   */
  getAggregateMetrics(operation: string, forceRefresh: boolean = false): AggregateMetrics | null {
    // Check cache first
    const cached = this.aggregateCache.get(operation)
    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    const operationMetrics = this.metrics.filter(m => m.operation === operation)
    if (operationMetrics.length === 0) return null

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b)
    const successCount = operationMetrics.filter(m => m.success).length
    const memoryUsages = operationMetrics.map(m => m.memoryDelta)
    
    const timespan = Math.max(
      ...operationMetrics.map(m => m.endTime)
    ) - Math.min(
      ...operationMetrics.map(m => m.startTime)
    )

    const aggregate: AggregateMetrics = {
      operation,
      count: operationMetrics.length,
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      successRate: successCount / operationMetrics.length,
      errorRate: (operationMetrics.length - successCount) / operationMetrics.length,
      memoryAvg: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
      memoryMax: Math.max(...memoryUsages),
      throughputPerSecond: timespan > 0 ? (operationMetrics.length / (timespan / 1000)) : 0
    }

    // Cache result
    this.aggregateCache.set(operation, { data: aggregate, timestamp: Date.now() })
    
    return aggregate
  }

  /**
   * Analyze performance bottlenecks
   */
  analyzeBottlenecks(threshold: number = 1000): BottleneckAnalysis[] {
    const operations = [...new Set(this.metrics.map(m => m.operation))]
    const bottlenecks: BottleneckAnalysis[] = []

    for (const operation of operations) {
      const aggregate = this.getAggregateMetrics(operation)
      if (!aggregate) continue

      const analysis = this.analyzeOperationBottleneck(operation, aggregate, threshold)
      if (analysis) {
        bottlenecks.push(analysis)
      }
    }

    // Sort by impact (highest first)
    return bottlenecks.sort((a, b) => b.impact - a.impact)
  }

  /**
   * Get performance budget violations
   */
  getBudgetViolations(): { operation: string, violations: string[], severity: string }[] {
    const violations: { operation: string, violations: string[], severity: string }[] = []

    for (const [operation, budget] of this.budgets) {
      const aggregate = this.getAggregateMetrics(operation)
      if (!aggregate) continue

      const operationViolations: string[] = []
      let maxSeverity = 'low'

      // Duration violations
      if (aggregate.p95 > budget.maxDuration) {
        operationViolations.push(`P95 duration (${aggregate.p95.toFixed(2)}ms) exceeds budget (${budget.maxDuration}ms)`)
        maxSeverity = aggregate.p95 > budget.maxDuration * 2 ? 'critical' : 'high'
      }

      // Memory violations  
      if (aggregate.memoryMax > budget.maxMemory) {
        operationViolations.push(`Max memory (${this.formatBytes(aggregate.memoryMax)}) exceeds budget (${this.formatBytes(budget.maxMemory)})`)
        maxSeverity = aggregate.memoryMax > budget.maxMemory * 2 ? 'critical' : 'high'
      }

      // Error rate violations
      if (aggregate.errorRate > budget.maxErrorRate) {
        operationViolations.push(`Error rate (${(aggregate.errorRate * 100).toFixed(2)}%) exceeds budget (${(budget.maxErrorRate * 100).toFixed(2)}%)`)
        maxSeverity = 'critical'
      }

      if (operationViolations.length > 0) {
        violations.push({
          operation,
          violations: operationViolations,
          severity: maxSeverity
        })
      }
    }

    return violations
  }

  /**
   * Get real-time performance dashboard data
   */
  getDashboardData(): {
    summary: {
      totalOperations: number
      averageResponseTime: number
      errorRate: number
      throughput: number
      memoryUsage: NodeJS.MemoryUsage
    }
    topOperations: AggregateMetrics[]
    recentBottlenecks: BottleneckAnalysis[]
    budgetViolations: any[]
    trends: { operation: string, trend: 'improving' | 'stable' | 'degrading' }[]
  } {
    const recentMetrics = this.getRecentMetrics(300000) // Last 5 minutes
    const operations = [...new Set(recentMetrics.map(m => m.operation))]
    
    const topOperations = operations
      .map(op => this.getAggregateMetrics(op))
      .filter(Boolean)
      .sort((a, b) => b!.count - a!.count)
      .slice(0, 10) as AggregateMetrics[]

    const summary = {
      totalOperations: recentMetrics.length,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length || 0,
      errorRate: recentMetrics.filter(m => !m.success).length / recentMetrics.length || 0,
      throughput: recentMetrics.length / (5 * 60), // operations per second over 5 minutes
      memoryUsage: process.memoryUsage()
    }

    return {
      summary,
      topOperations,
      recentBottlenecks: this.analyzeBottlenecks().slice(0, 5),
      budgetViolations: this.getBudgetViolations(),
      trends: this.analyzeTrends()
    }
  }

  /**
   * Set performance budget for operation
   */
  setBudget(budget: PerformanceBudget): void {
    this.budgets.set(budget.operation, budget)
    this.emit('budget:set', budget)
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric)
    
    // Keep metrics within limit
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS * 0.8) // Keep 80%
    }

    // Clear aggregate cache for this operation
    this.aggregateCache.delete(metric.operation)
    
    this.emit('metric:recorded', metric)
    
    // Check budget violations immediately
    this.checkBudgetViolation(metric)
  }

  /**
   * Check for budget violations
   */
  private checkBudgetViolation(metric: PerformanceMetrics): void {
    const budget = this.budgets.get(metric.operation)
    if (!budget) return

    const violations: string[] = []
    
    if (metric.duration > budget.maxDuration) {
      violations.push(`Duration (${metric.duration.toFixed(2)}ms) exceeded budget (${budget.maxDuration}ms)`)
    }
    
    if (metric.memoryDelta > budget.maxMemory) {
      violations.push(`Memory (${this.formatBytes(metric.memoryDelta)}) exceeded budget (${this.formatBytes(budget.maxMemory)})`)
    }

    if (violations.length > 0) {
      this.emit('budget:violation', {
        operation: metric.operation,
        metric,
        budget,
        violations
      })
    }
  }

  /**
   * Analyze bottleneck for specific operation
   */
  private analyzeOperationBottleneck(
    operation: string,
    aggregate: AggregateMetrics,
    threshold: number
  ): BottleneckAnalysis | null {
    let severity: BottleneckAnalysis['severity'] = 'low'
    let type: BottleneckAnalysis['type'] = 'cpu'
    let impact = 1
    const suggestions: string[] = []
    
    // Analyze duration
    if (aggregate.p95 > threshold) {
      severity = 'medium'
      impact = Math.min(10, Math.floor(aggregate.p95 / threshold))
      
      if (aggregate.p95 > threshold * 2) severity = 'high'
      if (aggregate.p95 > threshold * 5) severity = 'critical'
      
      suggestions.push('Consider caching or optimization')
      suggestions.push('Profile the operation for CPU bottlenecks')
    }

    // Analyze memory usage
    if (aggregate.memoryMax > 50 * 1024 * 1024) { // 50MB
      type = 'memory'
      if (severity === 'low') severity = 'medium'
      impact = Math.max(impact, 5)
      
      suggestions.push('Implement memory pooling')
      suggestions.push('Review for memory leaks')
      suggestions.push('Consider streaming for large data')
    }

    // Analyze error rate
    if (aggregate.errorRate > 0.05) { // 5% error rate
      if (severity === 'low') severity = 'high'
      impact = Math.max(impact, 8)
      
      suggestions.push('Investigate error patterns')
      suggestions.push('Implement better error handling')
    }

    // Analyze throughput
    if (aggregate.throughputPerSecond < 1 && aggregate.count > 10) {
      type = 'io'
      if (severity === 'low') severity = 'medium'
      impact = Math.max(impact, 6)
      
      suggestions.push('Implement connection pooling')
      suggestions.push('Consider asynchronous processing')
    }

    if (severity === 'low' && impact === 1) return null

    return {
      operation,
      severity,
      type,
      description: this.generateBottleneckDescription(operation, aggregate, type),
      impact,
      suggestions,
      affectedOperations: this.findAffectedOperations(operation)
    }
  }

  /**
   * Generate bottleneck description
   */
  private generateBottleneckDescription(
    operation: string,
    aggregate: AggregateMetrics,
    type: BottleneckAnalysis['type']
  ): string {
    switch (type) {
      case 'cpu':
        return `${operation} shows high CPU usage with P95 of ${aggregate.p95.toFixed(2)}ms`
      case 'memory':
        return `${operation} has high memory consumption (max: ${this.formatBytes(aggregate.memoryMax)})`
      case 'io':
        return `${operation} shows low throughput (${aggregate.throughputPerSecond.toFixed(2)}/s)`
      case 'algorithmic':
        return `${operation} has algorithmic inefficiencies affecting performance`
      default:
        return `${operation} has performance issues requiring investigation`
    }
  }

  /**
   * Find operations affected by bottleneck
   */
  private findAffectedOperations(operation: string): string[] {
    // Simple heuristic: find operations with similar names or patterns
    return this.metrics
      .map(m => m.operation)
      .filter((op, index, arr) => 
        op !== operation && 
        arr.indexOf(op) === index && // unique
        (op.includes(operation) || operation.includes(op))
      )
      .slice(0, 5) // Limit results
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(): { operation: string, trend: 'improving' | 'stable' | 'degrading' }[] {
    const operations = [...new Set(this.metrics.map(m => m.operation))]
    const trends: { operation: string, trend: 'improving' | 'stable' | 'degrading' }[] = []

    for (const operation of operations) {
      const recent = this.metrics
        .filter(m => m.operation === operation && Date.now() - m.endTime < 300000) // Last 5 min
        .slice(-20) // Last 20 measurements

      const older = this.metrics
        .filter(m => m.operation === operation && Date.now() - m.endTime >= 300000) // Before last 5 min
        .slice(-20) // Last 20 measurements before recent

      if (recent.length < 5 || older.length < 5) continue

      const recentAvg = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
      const olderAvg = older.reduce((sum, m) => sum + m.duration, 0) / older.length
      
      const change = (recentAvg - olderAvg) / olderAvg
      
      let trend: 'improving' | 'stable' | 'degrading' = 'stable'
      if (change < -0.1) trend = 'improving'      // 10% improvement
      else if (change > 0.1) trend = 'degrading' // 10% degradation
      
      trends.push({ operation, trend })
    }

    return trends
  }

  /**
   * Get recent metrics within time window
   */
  private getRecentMetrics(windowMs: number): PerformanceMetrics[] {
    const cutoff = Date.now() - windowMs
    return this.metrics.filter(m => m.endTime >= cutoff)
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0
    const index = Math.ceil(sortedArray.length * p) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Setup default performance budgets
   */
  private setupDefaultBudgets(): void {
    const defaultBudgets: PerformanceBudget[] = [
      { operation: 'template-render', maxDuration: 100, maxMemory: 10 * 1024 * 1024, maxErrorRate: 0.01, alertThreshold: 0.05 },
      { operation: 'query-parse', maxDuration: 50, maxMemory: 5 * 1024 * 1024, maxErrorRate: 0.05, alertThreshold: 0.1 },
      { operation: 'graph-load', maxDuration: 500, maxMemory: 50 * 1024 * 1024, maxErrorRate: 0.02, alertThreshold: 0.05 },
      { operation: 'validation', maxDuration: 200, maxMemory: 20 * 1024 * 1024, maxErrorRate: 0.01, alertThreshold: 0.03 },
    ]

    for (const budget of defaultBudgets) {
      this.setBudget(budget)
    }
  }

  /**
   * Start periodic analysis
   */
  private startPeriodicAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      try {
        const bottlenecks = this.analyzeBottlenecks()
        const violations = this.getBudgetViolations()
        
        this.emit('analysis:complete', {
          timestamp: Date.now(),
          bottlenecks,
          violations,
          summary: this.getDashboardData().summary
        })
      } catch (error) {
        this.emit('analysis:error', { error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }, this.ANALYSIS_INTERVAL)
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer)
      this.analysisTimer = null
    }
    
    this.metrics.length = 0
    this.activeOperations.clear()
    this.budgets.clear()
    this.aggregateCache.clear()
    this.removeAllListeners()
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Convenience functions
export function startPerformanceMeasurement(operationId: string, operation: string, metadata?: any): void {
  return performanceMonitor.startMeasurement(operationId, operation, metadata)
}

export function endPerformanceMeasurement(
  operationId: string,
  operation: string,
  success?: boolean,
  error?: string,
  metadata?: any
): PerformanceMetrics | null {
  return performanceMonitor.endMeasurement(operationId, operation, success, error, metadata)
}

export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T> | T,
  metadata?: any
): Promise<{ result: T, metrics: PerformanceMetrics }> {
  return performanceMonitor.measureFunction(operation, fn, metadata)
}

export function getPerformanceDashboard() {
  return performanceMonitor.getDashboardData()
}

export function analyzePerformanceBottlenecks(threshold?: number): BottleneckAnalysis[] {
  return performanceMonitor.analyzeBottlenecks(threshold)
}

// Auto-cleanup on exit
process.on('beforeExit', () => {
  performanceMonitor.destroy()
})