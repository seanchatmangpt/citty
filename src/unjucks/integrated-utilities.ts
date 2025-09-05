/**
 * 🔧 INTEGRATED UTILITIES: High-level convenience functions
 * Production-ready wrapper functions that combine multiple systems
 */

import { semanticContextManager } from './semantic-context'
import { performanceProfiler } from './performance-profiler'
import { errorRecoverySystem } from './error-recovery'
import { developerTools } from './developer-tools'
import { productionMonitor } from './production-monitoring'

/**
 * Execute function with semantic context propagation
 */
export async function withSemanticContext<T>(
  operation: string,
  fn: (context: any) => Promise<T> | T,
  initialContext: any = {},
  options: any = {}
): Promise<T> {
  const context = semanticContextManager.createContext(initialContext, options.dimensions)
  const sessionId = developerTools.startDebugSession(`semantic-context:${operation}`, { context })
  
  try {
    developerTools.addDebugStep(sessionId, 'processing', 'Executing with semantic context')
    
    // Propagate context based on strategy
    const propagatedContext = await semanticContextManager.propagateContext(
      context,
      options.strategy || 'cascade',
      options.filters
    )
    
    const result = await fn(propagatedContext)
    
    developerTools.addDebugStep(sessionId, 'output', 'Semantic context execution completed', { result })
    return result
    
  } catch (error) {
    developerTools.addDebugStep(sessionId, 'error', `Semantic context execution failed: ${error.message}`)
    throw error
  } finally {
    developerTools.endDebugSession(sessionId)
  }
}

/**
 * Execute function with comprehensive performance monitoring
 */
export async function withPerformanceMonitoring<T>(
  operation: string,
  fn: () => Promise<T> | T,
  options: { enableProfiling?: boolean; enableTracing?: boolean } = {}
): Promise<{ result: T; metrics: any; insights: string[] }> {
  const { enableProfiling = true, enableTracing = true } = options
  
  // Start monitoring
  const span = enableTracing ? productionMonitor.startTrace(operation) : null
  const sessionId = enableProfiling ? developerTools.startDebugSession(`perf-monitor:${operation}`) : null
  
  try {
    // Profile the operation
    const profiledResult = await performanceProfiler.profile(operation, fn, {
      templateSize: 0,
      contextSize: 0
    })
    
    // Finish monitoring
    if (span) productionMonitor.finishTrace(span, { success: true })
    if (sessionId) developerTools.endDebugSession(sessionId, profiledResult.result)
    
    // Generate insights
    const insights = performanceProfiler.getInsights()
    
    return {
      result: profiledResult.result,
      metrics: profiledResult.metrics,
      insights: insights.slice(0, 5) // Top 5 insights
    }
    
  } catch (error) {
    if (span) productionMonitor.finishTrace(span, { success: false, error: error.message })
    if (sessionId) developerTools.endDebugSession(sessionId, undefined, error)
    
    productionMonitor.createAlert('error', `Performance monitoring failed for ${operation}: ${error.message}`, 'performance-monitor')
    throw error
  }
}

/**
 * Execute function with comprehensive error recovery and fallback strategies
 */
export async function withErrorRecovery<T>(
  operation: string,
  fn: () => Promise<T> | T,
  context: any = {},
  fallbacks: Array<() => Promise<T> | T> = []
): Promise<T> {
  const span = productionMonitor.startTrace(`error-recovery:${operation}`)
  
  try {
    // Execute with built-in error recovery
    const result = await errorRecoverySystem.executeWithRecovery(operation, fn, context)
    
    productionMonitor.finishTrace(span, { success: true, recoveryUsed: false })
    return result
    
  } catch (primaryError) {
    productionMonitor.recordMetric('error_recovery.primary_failures', 1, { operation })
    
    // Try fallback strategies
    for (let i = 0; i < fallbacks.length; i++) {
      try {
        developerTools.trace(`Attempting fallback ${i + 1}/${fallbacks.length} for ${operation}`)
        
        const result = await fallbacks[i]()
        
        productionMonitor.recordMetric('error_recovery.fallback_success', 1, { operation, fallback: i })
        productionMonitor.finishTrace(span, { success: true, recoveryUsed: true, fallbackUsed: i })
        
        return result
        
      } catch (fallbackError) {
        productionMonitor.recordMetric('error_recovery.fallback_failures', 1, { operation, fallback: i })
        developerTools.trace(`Fallback ${i + 1} failed: ${fallbackError.message}`)
      }
    }
    
    // All strategies failed
    productionMonitor.createAlert('critical', `All recovery strategies failed for ${operation}`, 'error-recovery', {
      primaryError: primaryError.message,
      fallbacksAttempted: fallbacks.length
    })
    
    productionMonitor.finishTrace(span, { success: false, recoveryUsed: true })
    throw primaryError
  }
}

/**
 * Execute function with comprehensive debugging and introspection
 */
export async function withDebugging<T>(
  operation: string,
  fn: () => Promise<T> | T,
  options: {
    enableBreakpoints?: boolean
    enableWatching?: boolean
    enableTracing?: boolean
  } = {}
): Promise<{ result: T; debugReport: any }> {
  const { enableBreakpoints = false, enableWatching = false, enableTracing = true } = options
  
  // Setup debugging
  if (enableTracing) developerTools.setTracing(true)
  
  const sessionId = developerTools.startDebugSession(operation)
  
  try {
    // Add initial debug step
    developerTools.addDebugStep(sessionId, 'input', 'Starting debugging session', { options })
    
    // Setup breakpoints if enabled
    if (enableBreakpoints) {
      developerTools.setBreakpoint(operation, 'processing')
    }
    
    // Setup watches if enabled
    if (enableWatching) {
      developerTools.watch('memory_usage', () => process.memoryUsage().heapUsed)
      developerTools.watch('timestamp', () => Date.now())
    }
    
    developerTools.addDebugStep(sessionId, 'processing', 'Executing function with debugging enabled')
    
    const result = await fn()
    
    developerTools.addDebugStep(sessionId, 'output', 'Function execution completed', { result })
    
    // Evaluate watches
    const watchResults = enableWatching ? developerTools.evaluateWatches({}) : {}
    
    const debugReport = developerTools.generateDebugReport(sessionId)
    
    return { result, debugReport: { ...debugReport, watches: watchResults } }
    
  } catch (error) {
    developerTools.addDebugStep(sessionId, 'error', `Debugging failed: ${error.message}`)
    
    const debugReport = developerTools.generateDebugReport(sessionId)
    throw new Error(`Debugging failed: ${error.message}. Debug report: ${JSON.stringify(debugReport)}`)
    
  } finally {
    developerTools.endDebugSession(sessionId)
    
    // Cleanup
    if (enableWatching) {
      developerTools.unwatch('memory_usage')
      developerTools.unwatch('timestamp')
    }
  }
}

/**
 * Execute function with full production monitoring stack
 */
export async function withProductionMonitoring<T>(
  operation: string,
  fn: () => Promise<T> | T,
  options: {
    enableMetrics?: boolean
    enableAlerting?: boolean
    enableTracing?: boolean
    enableHealthChecks?: boolean
    slaTargets?: { responseTime: number; errorRate: number; availability: number }
  } = {}
): Promise<{
  result: T
  metrics: any
  health: any
  alerts: any[]
  recommendations: string[]
}> {
  const {
    enableMetrics = true,
    enableAlerting = true,
    enableTracing = true,
    enableHealthChecks = true,
    slaTargets
  } = options
  
  // Set SLA targets if provided
  if (slaTargets) {
    productionMonitor.setSLATargets(operation, slaTargets)
  }
  
  const span = enableTracing ? productionMonitor.startTrace(operation) : null
  const startTime = Date.now()
  
  try {
    // Record start metrics
    if (enableMetrics) {
      productionMonitor.recordMetric(`${operation}.requests`, 1)
      productionMonitor.recordMetric('system.memory.start', process.memoryUsage().heapUsed, {}, 'bytes')
    }
    
    // Execute function
    const result = await fn()
    
    const duration = Date.now() - startTime
    
    // Record success metrics
    if (enableMetrics) {
      productionMonitor.recordMetric(`${operation}.response_time`, duration, {}, 'ms')
      productionMonitor.recordMetric(`${operation}.success`, 1)
      productionMonitor.recordMetric('system.memory.end', process.memoryUsage().heapUsed, {}, 'bytes')
    }
    
    // Finish trace
    if (span) productionMonitor.finishTrace(span, { success: true, duration })
    
    // Run health checks if enabled
    const healthChecks = enableHealthChecks ? await productionMonitor.runHealthChecks() : []
    
    // Get monitoring report
    const report = productionMonitor.getMonitoringReport()
    
    return {
      result,
      metrics: {
        duration,
        memoryUsage: process.memoryUsage(),
        responseTime: duration
      },
      health: {
        status: report.summary.overallHealth,
        checks: healthChecks
      },
      alerts: report.alerts.slice(0, 5), // Recent alerts
      recommendations: report.recommendations
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Record error metrics
    if (enableMetrics) {
      productionMonitor.recordMetric(`${operation}.response_time`, duration, {}, 'ms')
      productionMonitor.recordMetric(`${operation}.errors`, 1)
    }
    
    // Create alert
    if (enableAlerting) {
      productionMonitor.createAlert('error', `Operation ${operation} failed: ${error.message}`, 'production-monitor', {
        operation,
        error: error.stack,
        duration
      })
    }
    
    // Finish trace
    if (span) productionMonitor.finishTrace(span, { success: false, error: error.message, duration })
    
    throw error
  }
}

/**
 * Comprehensive system health check
 */
export async function getSystemHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'critical'
  components: Record<string, any>
  recommendations: string[]
  alerts: any[]
}> {
  const components = {
    monitoring: productionMonitor.getMonitoringReport(),
    profiling: {
      insights: performanceProfiler.getInsights(),
      report: performanceProfiler.getReport()
    },
    errorRecovery: errorRecoverySystem.getHealthStatus(),
    debugging: {
      activeSessions: developerTools.listDebugSessions().length,
      traceEnabled: true // Would check actual state
    }
  }
  
  // Determine overall health
  let overall: 'healthy' | 'degraded' | 'critical' = 'healthy'
  
  if (components.errorRecovery.status === 'critical' || components.monitoring.summary.criticalAlerts > 0) {
    overall = 'critical'
  } else if (
    components.errorRecovery.status === 'degraded' || 
    components.monitoring.summary.healthPercentage < 90 ||
    components.profiling.insights.some(insight => insight.includes('slow'))
  ) {
    overall = 'degraded'
  }
  
  // Collect recommendations
  const recommendations = [
    ...components.monitoring.recommendations,
    ...components.profiling.insights.slice(0, 3)
  ]
  
  return {
    overall,
    components,
    recommendations: recommendations.slice(0, 10), // Top 10
    alerts: components.monitoring.alerts
  }
}

/**
 * Initialize all production systems with optimal defaults
 */
export function initializeProductionSystems(options: {
  enableMonitoring?: boolean
  enableProfiling?: boolean
  enableErrorRecovery?: boolean
  enableDebugging?: boolean
} = {}): void {
  const {
    enableMonitoring = true,
    enableProfiling = true,
    enableErrorRecovery = true,
    enableDebugging = false // Debug mode off by default in production
  } = options
  
  if (enableMonitoring) {
    // Setup default monitoring
    productionMonitor.setAlerting(true)
    
    // Register default health checks
    productionMonitor.registerHealthCheck('system-memory', async () => {
      const usage = process.memoryUsage()
      const heapUsedMB = usage.heapUsed / 1024 / 1024
      
      if (heapUsedMB > 1000) { // > 1GB
        return { status: 'unhealthy', details: `High memory usage: ${heapUsedMB.toFixed(2)}MB` }
      } else if (heapUsedMB > 500) { // > 500MB
        return { status: 'degraded', details: `Elevated memory usage: ${heapUsedMB.toFixed(2)}MB` }
      }
      
      return { status: 'healthy', details: `Memory usage: ${heapUsedMB.toFixed(2)}MB` }
    })
  }
  
  if (enableProfiling) {
    // Start automatic cleanup
    setInterval(() => {
      performanceProfiler.cleanup(7) // Keep 7 days of data
    }, 24 * 60 * 60 * 1000) // Daily cleanup
  }
  
  if (enableErrorRecovery) {
    // Setup default error recovery strategies already handled in constructor
    console.log('Error recovery system initialized with default strategies')
  }
  
  if (enableDebugging) {
    developerTools.setTracing(true)
    console.log('Debug tracing enabled')
  }
  
  console.log('Production systems initialized successfully')
}

/**
 * Graceful shutdown of all systems
 */
export async function shutdownProductionSystems(): Promise<void> {
  console.log('Shutting down production systems...')
  
  try {
    // Stop monitoring
    productionMonitor.setAlerting(false)
    
    // Clear caches
    performanceProfiler.cleanup(0) // Clear all data
    
    // Disable debugging
    developerTools.setTracing(false)
    
    // Destroy systems
    productionMonitor.destroy()
    
    console.log('Production systems shutdown complete')
  } catch (error) {
    console.error('Error during production systems shutdown:', error)
    throw error
  }
}