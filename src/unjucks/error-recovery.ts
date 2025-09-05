/**
 * 🚨 FINISHING TOUCH: Advanced Error Recovery and Resilience
 * Production-grade error handling that keeps systems running
 */

import { EventEmitter } from 'events'

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation: string
  input?: any
  context?: any
  stackTrace: string
  timestamp: number
  recoveryAttempts: number
  severity: ErrorSeverity
  metadata?: Record<string, any>
}

export interface RecoveryStrategy {
  name: string
  condition: (error: Error, context: ErrorContext) => boolean
  recover: (error: Error, context: ErrorContext) => Promise<any>
  maxAttempts: number
  backoffMs: number
}

export interface FallbackChain {
  primary: string | Function
  fallbacks: Array<string | Function>
  validate?: (result: any) => boolean
}

export class ErrorRecoverySystem extends EventEmitter {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()
  private fallbackChains: Map<string, FallbackChain> = new Map()
  private errorHistory: Map<string, ErrorContext[]> = new Map()
  private circuitBreakers: Map<string, {
    failures: number
    lastFailure: number
    state: 'closed' | 'open' | 'half-open'
  }> = new Map()
  
  constructor() {
    super()
    this.setupDefaultStrategies()
  }
  
  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy)
    this.emit('strategy:registered', { name: strategy.name })
  }
  
  /**
   * Register a fallback chain
   */
  registerFallbackChain(operation: string, chain: FallbackChain): void {
    this.fallbackChains.set(operation, chain)
    this.emit('fallback:registered', { operation })
  }
  
  /**
   * Execute operation with error recovery
   */
  async executeWithRecovery<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context: any = {}
  ): Promise<T> {
    const startTime = Date.now()
    let lastError: Error | null = null
    let recoveryAttempts = 0
    
    // Check circuit breaker
    const breakerState = this.getCircuitBreakerState(operation)
    if (breakerState === 'open') {
      throw new Error(`Circuit breaker open for operation: ${operation}`)
    }
    
    // Try primary execution
    try {
      const result = await fn()
      this.recordSuccess(operation)
      return result
    } catch (error) {
      lastError = error as Error
      this.recordFailure(operation, error as Error)
    }
    
    // Try recovery strategies
    for (const strategy of this.recoveryStrategies.values()) {
      const errorContext: ErrorContext = {
        operation,
        input: context.input,
        context,
        stackTrace: lastError!.stack || '',
        timestamp: startTime,
        recoveryAttempts,
        severity: this.assessSeverity(lastError!, operation),
        metadata: context.metadata
      }
      
      if (strategy.condition(lastError!, errorContext) && 
          recoveryAttempts < strategy.maxAttempts) {
        
        try {
          // Backoff delay
          if (recoveryAttempts > 0) {
            await this.delay(strategy.backoffMs * Math.pow(2, recoveryAttempts))
          }
          
          this.emit('recovery:attempt', { 
            operation, 
            strategy: strategy.name, 
            attempt: recoveryAttempts + 1 
          })
          
          const result = await strategy.recover(lastError!, errorContext)
          
          this.emit('recovery:success', { 
            operation, 
            strategy: strategy.name,
            attempts: recoveryAttempts + 1
          })
          
          return result
        } catch (recoveryError) {
          recoveryAttempts++
          lastError = recoveryError as Error
          
          this.emit('recovery:failed', { 
            operation, 
            strategy: strategy.name,
            error: recoveryError
          })
        }
      }
    }
    
    // Try fallback chain
    const fallbackChain = this.fallbackChains.get(operation)
    if (fallbackChain) {
      try {
        const result = await this.executeFallbackChain(operation, fallbackChain, context)
        return result
      } catch (fallbackError) {
        lastError = fallbackError as Error
      }
    }
    
    // Record final failure
    this.recordFinalFailure(operation, lastError!, {
      operation,
      input: context.input,
      context,
      stackTrace: lastError!.stack || '',
      timestamp: startTime,
      recoveryAttempts,
      severity: ErrorSeverity.CRITICAL
    })
    
    throw lastError!
  }
  
  /**
   * Execute fallback chain
   */
  private async executeFallbackChain<T>(
    operation: string,
    chain: FallbackChain,
    context: any
  ): Promise<T> {
    const attempts = [chain.primary, ...chain.fallbacks]
    
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]
      
      try {
        this.emit('fallback:attempt', { operation, fallback: i, total: attempts.length })
        
        let result: T
        if (typeof attempt === 'string') {
          // Template name fallback
          result = await this.executeFallbackTemplate(attempt, context)
        } else {
          // Function fallback
          result = await attempt(context)
        }
        
        // Validate result if validator provided
        if (chain.validate && !chain.validate(result)) {
          throw new Error(`Fallback validation failed for attempt ${i}`)
        }
        
        this.emit('fallback:success', { operation, fallback: i })
        return result
      } catch (error) {
        this.emit('fallback:failed', { operation, fallback: i, error })
        
        if (i === attempts.length - 1) {
          throw error
        }
      }
    }
    
    throw new Error('All fallback attempts exhausted')
  }
  
  /**
   * Get error recovery report
   */
  getRecoveryReport(operation?: string): any {
    if (operation) {
      const history = this.errorHistory.get(operation) || []
      const breaker = this.circuitBreakers.get(operation)
      
      return {
        operation,
        totalErrors: history.length,
        recentErrors: history.slice(-10),
        errorsByseverity: this.groupBySeverity(history),
        recoverySuccessRate: this.calculateRecoveryRate(history),
        circuitBreaker: breaker,
        recommendations: this.generateRecommendations(operation, history)
      }
    }
    
    return {
      operations: Array.from(this.errorHistory.keys()),
      totalErrors: Array.from(this.errorHistory.values()).flat().length,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      topProblematicOperations: this.getTopProblematicOperations()
    }
  }
  
  /**
   * Generate health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical'
    details: any
  } {
    const operations = Array.from(this.errorHistory.keys())
    let criticalCount = 0
    let degradedCount = 0
    
    for (const operation of operations) {
      const breaker = this.circuitBreakers.get(operation)
      const recentErrors = this.getRecentErrors(operation, 300000) // 5 minutes
      
      if (breaker?.state === 'open' || recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length > 0) {
        criticalCount++
      } else if (recentErrors.length > 5) {
        degradedCount++
      }
    }
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (criticalCount > 0) {
      status = 'critical'
    } else if (degradedCount > operations.length * 0.3) {
      status = 'degraded'
    }
    
    return {
      status,
      details: {
        totalOperations: operations.length,
        criticalOperations: criticalCount,
        degradedOperations: degradedCount,
        openCircuitBreakers: Array.from(this.circuitBreakers.entries())
          .filter(([_, breaker]) => breaker.state === 'open')
          .map(([op]) => op)
      }
    }
  }
  
  // Private methods
  
  private setupDefaultStrategies(): void {
    // Retry strategy
    this.registerStrategy({
      name: 'retry',
      condition: (error, context) => 
        error.message.includes('timeout') || 
        error.message.includes('ECONNRESET') ||
        context.severity <= ErrorSeverity.MEDIUM,
      recover: async (error, context) => {
        // Simple retry - would be enhanced with actual retry logic
        throw error
      },
      maxAttempts: 3,
      backoffMs: 1000
    })
    
    // Cache fallback strategy
    this.registerStrategy({
      name: 'cache-fallback',
      condition: (error, context) => 
        context.metadata?.cacheAvailable === true,
      recover: async (error, context) => {
        // Return cached result if available
        return context.metadata?.cachedResult
      },
      maxAttempts: 1,
      backoffMs: 0
    })
    
    // Template degradation strategy  
    this.registerStrategy({
      name: 'template-degradation',
      condition: (error, context) => 
        context.operation.includes('template') &&
        error.message.includes('template'),
      recover: async (error, context) => {
        // Use minimal template
        return this.getMinimalTemplate(context.operation)
      },
      maxAttempts: 1,
      backoffMs: 0
    })
    
    // Default response strategy
    this.registerStrategy({
      name: 'default-response',
      condition: () => true, // Last resort
      recover: async (error, context) => {
        return this.getDefaultResponse(context.operation)
      },
      maxAttempts: 1,
      backoffMs: 0
    })
  }
  
  private getCircuitBreakerState(operation: string): 'closed' | 'open' | 'half-open' {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return 'closed'
    
    const now = Date.now()
    const timeoutMs = 60000 // 1 minute
    
    if (breaker.state === 'open' && now - breaker.lastFailure > timeoutMs) {
      breaker.state = 'half-open'
    }
    
    return breaker.state
  }
  
  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (breaker) {
      breaker.failures = 0
      breaker.state = 'closed'
    }
  }
  
  private recordFailure(operation: string, error: Error): void {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        failures: 0,
        lastFailure: 0,
        state: 'closed'
      })
    }
    
    const breaker = this.circuitBreakers.get(operation)!
    breaker.failures++
    breaker.lastFailure = Date.now()
    
    if (breaker.failures >= 5) {
      breaker.state = 'open'
      this.emit('circuit-breaker:open', { operation })
    }
  }
  
  private recordFinalFailure(operation: string, error: Error, context: ErrorContext): void {
    if (!this.errorHistory.has(operation)) {
      this.errorHistory.set(operation, [])
    }
    
    this.errorHistory.get(operation)!.push(context)
    
    // Keep only recent history to prevent memory bloat
    const history = this.errorHistory.get(operation)!
    if (history.length > 100) {
      this.errorHistory.set(operation, history.slice(-50))
    }
    
    this.emit('error:final', { operation, error, context })
  }
  
  private assessSeverity(error: Error, operation: string): ErrorSeverity {
    if (error.message.includes('critical') || error.message.includes('fatal')) {
      return ErrorSeverity.CRITICAL
    }
    if (error.message.includes('timeout') || error.message.includes('connection')) {
      return ErrorSeverity.HIGH
    }
    if (error.message.includes('validation') || error.message.includes('parse')) {
      return ErrorSeverity.MEDIUM
    }
    return ErrorSeverity.LOW
  }
  
  private async executeFallbackTemplate(templateName: string, context: any): Promise<any> {
    // Would integrate with actual template system
    return `<!-- Fallback template: ${templateName} -->`
  }
  
  private getMinimalTemplate(operation: string): string {
    return `<!-- Minimal template for ${operation} -->\n<div class="error">Service temporarily unavailable</div>`
  }
  
  private getDefaultResponse(operation: string): any {
    return {
      error: true,
      message: 'Service temporarily unavailable',
      operation,
      timestamp: new Date().toISOString()
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  private groupBySeverity(history: ErrorContext[]): Record<string, number> {
    const groups = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const error of history) {
      groups[error.severity]++
    }
    return groups
  }
  
  private calculateRecoveryRate(history: ErrorContext[]): number {
    if (history.length === 0) return 1
    
    const recovered = history.filter(e => e.recoveryAttempts > 0).length
    return recovered / history.length
  }
  
  private generateRecommendations(operation: string, history: ErrorContext[]): string[] {
    const recommendations: string[] = []
    
    if (history.length > 50) {
      recommendations.push('Consider adding more robust error handling')
    }
    
    const recentCritical = history.filter(e => 
      e.severity === ErrorSeverity.CRITICAL && 
      Date.now() - e.timestamp < 3600000 // 1 hour
    )
    
    if (recentCritical.length > 0) {
      recommendations.push('Investigate critical errors in the last hour')
    }
    
    const breaker = this.circuitBreakers.get(operation)
    if (breaker?.state === 'open') {
      recommendations.push('Circuit breaker is open - check downstream dependencies')
    }
    
    return recommendations
  }
  
  private getTopProblematicOperations(): Array<{ operation: string; errorCount: number }> {
    return Array.from(this.errorHistory.entries())
      .map(([operation, history]) => ({ operation, errorCount: history.length }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10)
  }
  
  private getRecentErrors(operation: string, withinMs: number): ErrorContext[] {
    const history = this.errorHistory.get(operation) || []
    const cutoff = Date.now() - withinMs
    return history.filter(e => e.timestamp > cutoff)
  }
}

// Global error recovery system
export const errorRecoverySystem = new ErrorRecoverySystem()

// Convenience wrapper function
export async function withErrorRecovery<T>(
  operation: string,
  fn: () => Promise<T> | T,
  context?: any
): Promise<T> {
  return errorRecoverySystem.executeWithRecovery(operation, fn, context)
}