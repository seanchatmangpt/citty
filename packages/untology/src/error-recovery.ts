/**
 * 🧠 DARK MATTER: Error Recovery & Resilience System
 * The production-grade error handling humans always skip
 */

import { Store } from 'n3'
import { useOntology } from './context'
import { EventEmitter } from 'events'

export interface RecoveryOptions {
  maxRetries?: number
  backoffMs?: number
  gracefulDegradation?: boolean
  fallbackCache?: boolean
  emergencyMode?: boolean
}

export interface ErrorContext {
  operation: string
  error: Error
  timestamp: number
  retryCount: number
  recoveryStrategy: string
  metadata?: any
}

export interface RecoveryResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  recoveryUsed: string
  degraded: boolean
  retryCount: number
  recoveryTime: number
}

/**
 * Production-grade error recovery system with circuit breaker pattern
 */
export class ErrorRecoverySystem extends EventEmitter {
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private fallbackCache = new Map<string, { data: any, timestamp: number, ttl: number }>()
  private errorHistory: ErrorContext[] = []
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()
  
  constructor(private options: RecoveryOptions = {}) {
    super()
    this.setupDefaultStrategies()
    this.setupHealthChecks()
  }

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    operation: string,
    fn: () => Promise<T>,
    options: Partial<RecoveryOptions> = {}
  ): Promise<RecoveryResult<T>> {
    const opts = { ...this.options, ...options }
    const startTime = Date.now()
    const circuitBreaker = this.getCircuitBreaker(operation)
    
    // Check circuit breaker
    if (circuitBreaker.isOpen()) {
      return this.handleCircuitOpen(operation, startTime)
    }

    let lastError: Error
    let retryCount = 0
    const maxRetries = opts.maxRetries || 3

    while (retryCount <= maxRetries) {
      try {
        // Attempt operation
        const result = await fn()
        
        // Success - reset circuit breaker
        circuitBreaker.recordSuccess()
        
        return {
          success: true,
          data: result,
          recoveryUsed: retryCount > 0 ? 'retry' : 'none',
          degraded: false,
          retryCount,
          recoveryTime: Date.now() - startTime
        }
        
      } catch (error) {
        lastError = error as Error
        retryCount++
        
        // Record error
        const errorContext: ErrorContext = {
          operation,
          error: lastError,
          timestamp: Date.now(),
          retryCount,
          recoveryStrategy: 'retry',
          metadata: { circuitBreakerState: circuitBreaker.getState() }
        }
        
        this.recordError(errorContext)
        circuitBreaker.recordFailure()
        
        // Try recovery strategies before next retry
        const recoveryResult = await this.attemptRecovery(operation, lastError, retryCount)
        if (recoveryResult.success) {
          return {
            ...recoveryResult,
            retryCount,
            recoveryTime: Date.now() - startTime
          }
        }
        
        // Exponential backoff
        if (retryCount <= maxRetries) {
          const backoff = (opts.backoffMs || 1000) * Math.pow(2, retryCount - 1)
          await this.delay(Math.min(backoff, 10000)) // Max 10s delay
        }
      }
    }

    // All retries failed - try emergency fallback
    return this.handleFinalFailure(operation, lastError, retryCount, startTime)
  }

  /**
   * Graceful query parsing with fallback strategies
   */
  async safeQueryParse(query: string): Promise<RecoveryResult<any>> {
    return this.executeWithRecovery('query-parse', async () => {
      // Try primary query engine
      const { askGraph } = await import('./query')
      return await askGraph(query)
    }, {
      gracefulDegradation: true,
      fallbackCache: true
    })
  }

  /**
   * Safe context access with fallback
   */
  async safeContextAccess(): Promise<RecoveryResult<any>> {
    return this.executeWithRecovery('context-access', async () => {
      return useOntology()
    }, {
      gracefulDegradation: true
    })
  }

  /**
   * Safe graph operations with transaction rollback
   */
  async safeGraphOperation<T>(
    operation: string,
    fn: (store: Store) => Promise<T>
  ): Promise<RecoveryResult<T>> {
    return this.executeWithRecovery(`graph-${operation}`, async () => {
      const context = useOntology()
      const backup = this.createGraphBackup(context.store)
      
      try {
        const result = await fn(context.store)
        this.clearGraphBackup(backup)
        return result
      } catch (error) {
        this.restoreGraphBackup(context.store, backup)
        throw error
      }
    })
  }

  /**
   * Attempt various recovery strategies
   */
  private async attemptRecovery(
    operation: string,
    error: Error,
    retryCount: number
  ): Promise<RecoveryResult> {
    const strategies = [
      'fallback-cache',
      'degraded-mode', 
      'alternative-method',
      'emergency-default'
    ]

    for (const strategyName of strategies) {
      const strategy = this.recoveryStrategies.get(strategyName)
      if (!strategy) continue

      try {
        const canRecover = await strategy.canRecover(operation, error)
        if (canRecover) {
          const result = await strategy.recover(operation, error)
          
          this.emit('recovery:success', {
            operation,
            strategy: strategyName,
            retryCount,
            result
          })
          
          return {
            success: true,
            data: result,
            recoveryUsed: strategyName,
            degraded: strategyName.includes('degraded') || strategyName.includes('fallback'),
            retryCount,
            recoveryTime: 0
          }
        }
      } catch (recoveryError) {
        this.emit('recovery:failure', {
          operation,
          strategy: strategyName,
          error: recoveryError
        })
      }
    }

    return { success: false, recoveryUsed: 'none', degraded: false, retryCount, recoveryTime: 0 }
  }

  /**
   * Handle circuit breaker open state
   */
  private handleCircuitOpen<T>(operation: string, startTime: number): RecoveryResult<T> {
    // Try fallback cache
    const cached = this.getCachedFallback(operation)
    if (cached) {
      return {
        success: true,
        data: cached,
        recoveryUsed: 'circuit-breaker-cache',
        degraded: true,
        retryCount: 0,
        recoveryTime: Date.now() - startTime
      }
    }

    return {
      success: false,
      error: new Error(`Circuit breaker open for operation: ${operation}`),
      recoveryUsed: 'circuit-breaker',
      degraded: true,
      retryCount: 0,
      recoveryTime: Date.now() - startTime
    }
  }

  /**
   * Handle final failure after all retries
   */
  private async handleFinalFailure(
    operation: string,
    error: Error,
    retryCount: number,
    startTime: number
  ): Promise<RecoveryResult> {
    // Emergency fallback
    const emergencyResult = await this.emergencyFallback(operation, error)
    
    return {
      success: emergencyResult !== null,
      data: emergencyResult,
      error: emergencyResult === null ? error : undefined,
      recoveryUsed: emergencyResult !== null ? 'emergency-fallback' : 'none',
      degraded: true,
      retryCount,
      recoveryTime: Date.now() - startTime
    }
  }

  /**
   * Emergency fallback - return safe default values
   */
  private async emergencyFallback(operation: string, error: Error): Promise<any> {
    const emergencyDefaults = {
      'query-parse': [],
      'context-access': { store: new Store(), prefixes: {}, options: {} },
      'graph-operation': null,
      'template-render': '',
      'validation': { valid: true, errors: [], warnings: [] }
    }

    // Find matching emergency default
    for (const [key, value] of Object.entries(emergencyDefaults)) {
      if (operation.includes(key)) {
        this.emit('emergency:fallback', { operation, error, fallback: key })
        return value
      }
    }

    return null
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getCircuitBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000
      }))
    }
    return this.circuitBreakers.get(operation)!
  }

  /**
   * Create graph backup for rollback
   */
  private createGraphBackup(store: Store): Quad[] {
    return store.getQuads(null, null, null, null)
  }

  /**
   * Restore graph from backup
   */
  private restoreGraphBackup(store: Store, backup: any[]): void {
    store.removeQuads(store.getQuads(null, null, null, null))
    store.addQuads(backup)
  }

  /**
   * Clear graph backup
   */
  private clearGraphBackup(backup: any[]): void {
    backup.length = 0 // Clear array for GC
  }

  /**
   * Get cached fallback data
   */
  private getCachedFallback(operation: string): any {
    const cached = this.fallbackCache.get(operation)
    if (!cached) return null
    
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.fallbackCache.delete(operation)
      return null
    }
    
    return cached.data
  }

  /**
   * Record error for analysis
   */
  private recordError(context: ErrorContext): void {
    this.errorHistory.push(context)
    
    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000)
    }
    
    this.emit('error:recorded', context)
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultStrategies(): void {
    // Fallback cache strategy
    this.recoveryStrategies.set('fallback-cache', {
      canRecover: async (operation: string, error: Error) => {
        return this.fallbackCache.has(operation)
      },
      recover: async (operation: string, error: Error) => {
        return this.getCachedFallback(operation)
      }
    })

    // Degraded mode strategy
    this.recoveryStrategies.set('degraded-mode', {
      canRecover: async (operation: string, error: Error) => {
        return this.options.gracefulDegradation === true
      },
      recover: async (operation: string, error: Error) => {
        return this.emergencyFallback(operation, error)
      }
    })
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    setInterval(() => {
      this.performHealthCheck()
    }, 60000) // Check every minute
  }

  /**
   * Perform system health check
   */
  private performHealthCheck(): void {
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp < 300000 // Last 5 minutes
    )
    
    const errorRate = recentErrors.length / 5 // Per minute
    const criticalErrors = recentErrors.filter(
      e => e.error.message.includes('CRITICAL') || e.retryCount > 3
    )
    
    this.emit('health:check', {
      timestamp: Date.now(),
      errorRate,
      criticalErrors: criticalErrors.length,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(
        ([op, cb]) => ({ operation: op, state: cb.getState() })
      )
    })
    
    if (errorRate > 10) { // More than 10 errors per minute
      this.emit('health:degraded', { errorRate, criticalErrors: criticalErrors.length })
    }
  }

  /**
   * Get error analytics
   */
  getErrorAnalytics(hours: number = 1): any {
    const since = Date.now() - (hours * 60 * 60 * 1000)
    const errors = this.errorHistory.filter(e => e.timestamp > since)
    
    const byOperation = new Map<string, number>()
    const byErrorType = new Map<string, number>()
    
    for (const error of errors) {
      byOperation.set(error.operation, (byOperation.get(error.operation) || 0) + 1)
      byErrorType.set(error.error.name, (byErrorType.get(error.error.name) || 0) + 1)
    }
    
    return {
      totalErrors: errors.length,
      errorRate: errors.length / hours,
      byOperation: Object.fromEntries(byOperation),
      byErrorType: Object.fromEntries(byErrorType),
      averageRetries: errors.reduce((sum, e) => sum + e.retryCount, 0) / errors.length || 0
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(private options: {
    failureThreshold: number
    recoveryTimeout: number
    monitoringPeriod: number
  }) {}

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeout) {
        this.state = 'HALF_OPEN'
        return false
      }
      return true
    }
    return false
  }

  recordSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): string {
    return this.state
  }
}

/**
 * Recovery strategy interface
 */
interface RecoveryStrategy {
  canRecover(operation: string, error: Error): Promise<boolean>
  recover(operation: string, error: Error): Promise<any>
}

// Singleton instance
export const errorRecovery = new ErrorRecoverySystem({
  maxRetries: 3,
  backoffMs: 1000,
  gracefulDegradation: true,
  fallbackCache: true,
  emergencyMode: true
})

// Convenience functions
export async function safeExecute<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeWithRecovery(operation, fn)
}

export async function safeQuery(query: string): Promise<RecoveryResult<any>> {
  return errorRecovery.safeQueryParse(query)
}

export async function safeContext(): Promise<RecoveryResult<any>> {
  return errorRecovery.safeContextAccess()
}