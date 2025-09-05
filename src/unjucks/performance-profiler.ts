/**
 * 📊 FINISHING TOUCH: Performance Profiling and Benchmarking
 * Production-grade performance monitoring for template systems
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

export interface PerformanceMetrics {
  operation: string
  duration: number
  timestamp: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
  cpuBefore?: number
  cpuAfter?: number
  cacheHit?: boolean
  templateSize?: number
  contextSize?: number
  outputSize?: number
}

export interface BenchmarkResult {
  operation: string
  runs: number
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  medianDuration: number
  p95Duration: number
  p99Duration: number
  opsPerSecond: number
  memoryUsage: {
    average: number
    peak: number
    final: number
  }
}

export class PerformanceProfiler extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map()
  private activeOperations: Map<string, { start: number; memoryBefore: number }> = new Map()
  private benchmarkRuns: Map<string, number[]> = new Map()
  
  /**
   * Start profiling an operation
   */
  startOperation(operationId: string, operation: string, context?: any): void {
    const start = performance.now()
    const memoryBefore = process.memoryUsage().heapUsed
    
    this.activeOperations.set(operationId, { start, memoryBefore })
    
    this.emit('operation:start', { operationId, operation, timestamp: start })
  }
  
  /**
   * End profiling an operation
   */
  endOperation(
    operationId: string, 
    operation: string,
    metadata: Partial<PerformanceMetrics> = {}
  ): PerformanceMetrics {
    const active = this.activeOperations.get(operationId)
    if (!active) {
      throw new Error(`Operation ${operationId} was not started`)
    }
    
    const end = performance.now()
    const memoryAfter = process.memoryUsage().heapUsed
    
    const metric: PerformanceMetrics = {
      operation,
      duration: end - active.start,
      timestamp: active.start,
      memoryBefore: active.memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - active.memoryBefore,
      ...metadata
    }
    
    // Store metric
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }
    this.metrics.get(operation)!.push(metric)
    
    // Cleanup
    this.activeOperations.delete(operationId)
    
    this.emit('operation:complete', { operationId, metric })
    
    return metric
  }
  
  /**
   * Profile a function execution
   */
  async profile<T>(
    operation: string,
    fn: () => Promise<T> | T,
    metadata?: Partial<PerformanceMetrics>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    this.startOperation(operationId, operation)
    
    try {
      const result = await fn()
      const metrics = this.endOperation(operationId, operation, {
        ...metadata,
        outputSize: typeof result === 'string' ? result.length : JSON.stringify(result).length
      })
      
      return { result, metrics }
    } catch (error) {
      this.endOperation(operationId, operation, { ...metadata, error: error.message })
      throw error
    }
  }
  
  /**
   * Run benchmark with multiple iterations
   */
  async benchmark<T>(
    operation: string,
    fn: () => Promise<T> | T,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const durations: number[] = []
    const memoryUsages: number[] = []
    let peakMemory = 0
    
    this.emit('benchmark:start', { operation, iterations })
    
    for (let i = 0; i < iterations; i++) {
      const memoryBefore = process.memoryUsage().heapUsed
      const start = performance.now()
      
      await fn()
      
      const end = performance.now()
      const memoryAfter = process.memoryUsage().heapUsed
      
      const duration = end - start
      durations.push(duration)
      memoryUsages.push(memoryAfter)
      
      if (memoryAfter > peakMemory) {
        peakMemory = memoryAfter
      }
      
      // Progress reporting
      if (i % Math.ceil(iterations / 10) === 0) {
        this.emit('benchmark:progress', { 
          operation, 
          completed: i + 1, 
          total: iterations,
          currentDuration: duration
        })
      }
    }
    
    // Calculate statistics
    const sortedDurations = [...durations].sort((a, b) => a - b)
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    
    const result: BenchmarkResult = {
      operation,
      runs: iterations,
      totalDuration,
      averageDuration: totalDuration / iterations,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      medianDuration: sortedDurations[Math.floor(sortedDurations.length / 2)],
      p95Duration: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
      p99Duration: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
      opsPerSecond: (iterations * 1000) / totalDuration,
      memoryUsage: {
        average: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
        peak: peakMemory,
        final: memoryUsages[memoryUsages.length - 1]
      }
    }
    
    // Store benchmark results
    if (!this.benchmarkRuns.has(operation)) {
      this.benchmarkRuns.set(operation, [])
    }
    this.benchmarkRuns.get(operation)!.push(result.averageDuration)
    
    this.emit('benchmark:complete', { operation, result })
    
    return result
  }
  
  /**
   * Get performance report for operation
   */
  getReport(operation?: string): any {
    if (operation) {
      const metrics = this.metrics.get(operation) || []
      if (metrics.length === 0) return null
      
      const durations = metrics.map(m => m.duration)
      const memoryDeltas = metrics.map(m => m.memoryDelta)
      
      return {
        operation,
        totalRuns: metrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        averageMemoryDelta: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
        cacheHitRate: metrics.filter(m => m.cacheHit).length / metrics.length,
        recentMetrics: metrics.slice(-10),
        trends: this.calculateTrends(metrics)
      }
    }
    
    // Overall report
    const allOperations = Array.from(this.metrics.keys())
    return {
      operations: allOperations,
      totalMetrics: Array.from(this.metrics.values()).flat().length,
      reports: Object.fromEntries(
        allOperations.map(op => [op, this.getReport(op)])
      )
    }
  }
  
  /**
   * Get performance insights and recommendations
   */
  getInsights(): string[] {
    const insights: string[] = []
    
    for (const [operation, metrics] of this.metrics) {
      if (metrics.length < 5) continue
      
      const recent = metrics.slice(-10)
      const durations = recent.map(m => m.duration)
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      
      // Slow operations
      if (avgDuration > 1000) {
        insights.push(`⚠️ Operation "${operation}" is slow (avg: ${avgDuration.toFixed(2)}ms)`)
      }
      
      // Memory leaks
      const memoryDeltas = recent.map(m => m.memoryDelta)
      const avgMemoryDelta = memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length
      if (avgMemoryDelta > 1024 * 1024) { // 1MB
        insights.push(`🚰 Operation "${operation}" may have memory leak (avg delta: ${(avgMemoryDelta / 1024 / 1024).toFixed(2)}MB)`)
      }
      
      // Low cache hit rates
      const cacheHitRate = recent.filter(m => m.cacheHit).length / recent.length
      if (cacheHitRate < 0.5 && recent.some(m => m.cacheHit !== undefined)) {
        insights.push(`💾 Operation "${operation}" has low cache hit rate (${(cacheHitRate * 100).toFixed(1)}%)`)
      }
      
      // Performance degradation
      const trend = this.calculateTrend(durations)
      if (trend > 0.2) {
        insights.push(`📈 Operation "${operation}" performance is degrading (trend: +${(trend * 100).toFixed(1)}%)`)
      }
    }
    
    return insights
  }
  
  /**
   * Export metrics for external analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const allMetrics = Array.from(this.metrics.values()).flat()
    
    if (format === 'csv') {
      const headers = ['operation', 'duration', 'timestamp', 'memoryDelta', 'cacheHit']
      const rows = allMetrics.map(m => [
        m.operation,
        m.duration,
        m.timestamp,
        m.memoryDelta,
        m.cacheHit || false
      ])
      
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }
    
    return JSON.stringify(allMetrics, null, 2)
  }
  
  /**
   * Clear old metrics to prevent memory bloat
   */
  cleanup(retentionDays: number = 7): void {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
    
    for (const [operation, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff)
      if (filtered.length !== metrics.length) {
        this.metrics.set(operation, filtered)
        this.emit('cleanup', { 
          operation, 
          removed: metrics.length - filtered.length,
          retained: filtered.length
        })
      }
    }
  }
  
  // Private helper methods
  
  private calculateTrends(metrics: PerformanceMetrics[]): any {
    if (metrics.length < 10) return null
    
    const recent = metrics.slice(-10)
    const older = metrics.slice(-20, -10)
    
    if (older.length === 0) return null
    
    const recentAvg = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
    const olderAvg = older.reduce((sum, m) => sum + m.duration, 0) / older.length
    
    return {
      durationTrend: (recentAvg - olderAvg) / olderAvg,
      memoryTrend: this.calculateTrend(recent.map(m => m.memoryDelta)) -
                   this.calculateTrend(older.map(m => m.memoryDelta))
    }
  }
  
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0
    
    const n = values.length
    const sumX = (n * (n + 1)) / 2
    const sumY = values.reduce((sum, v) => sum + v, 0)
    const sumXY = values.reduce((sum, v, i) => sum + (i + 1) * v, 0)
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const avgY = sumY / n
    
    return slope / avgY // Normalized slope
  }
}

// Global profiler instance
export const performanceProfiler = new PerformanceProfiler()

// Convenience decorators for TypeScript
export function profileMethod(operation?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const operationName = operation || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function (...args: any[]) {
      const { result } = await performanceProfiler.profile(
        operationName,
        () => originalMethod.apply(this, args)
      )
      return result
    }
    
    return descriptor
  }
}