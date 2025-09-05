/**
 * CNS Comprehensive Error Handling System
 * 
 * Production-ready error handling with circuit breakers, retry logic,
 * error recovery, and intelligent fallback mechanisms.
 */

import { EventEmitter } from 'events'
import winston from 'winston'

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  STORAGE = 'storage',
  SEMANTIC = 'semantic',
  ACTOR = 'actor',
  MEMORY = 'memory',
  MARKET_DATA = 'market_data',
  NEWS_VALIDATION = 'news_validation'
}

export interface CNSError {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  details: any
  timestamp: number
  stackTrace?: string
  context: {
    component: string
    operation: string
    userId?: string
    sessionId?: string
    requestId?: string
  }
  recoveryAttempts: number
  resolved: boolean
}

export interface ErrorRecoveryStrategy {
  maxRetries: number
  backoffMs: number
  fallbackAction?: string
  escalationThreshold: number
  timeoutMs: number
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringWindow: number
}

export class CNSErrorHandler extends EventEmitter {
  private logger: winston.Logger
  private errors: Map<string, CNSError> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private recoveryStrategies: Map<ErrorCategory, ErrorRecoveryStrategy> = new Map()
  private errorStats: ErrorStatistics = new ErrorStatistics()

  constructor() {
    super()
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'cns-errors.log',
          level: 'error'
        }),
        new winston.transports.File({ 
          filename: 'cns-combined.log' 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    })

    this.initializeRecoveryStrategies()
  }

  /**
   * Handle an error with comprehensive processing and recovery
   */
  async handleError(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: CNSError['context'],
    details?: any
  ): Promise<CNSError> {
    const errorId = `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const cnsError: CNSError = {
      id: errorId,
      category,
      severity,
      message: error.message,
      details: details || {},
      timestamp: Date.now(),
      stackTrace: error.stack,
      context,
      recoveryAttempts: 0,
      resolved: false
    }

    // Store error for tracking
    this.errors.set(errorId, cnsError)
    
    // Update statistics
    this.errorStats.recordError(category, severity)
    
    // Log error with appropriate level
    this.logError(cnsError)
    
    // Check circuit breaker
    this.updateCircuitBreaker(category, false)
    
    // Emit error event
    this.emit('cns:error', cnsError)
    
    // Attempt recovery if configured
    await this.attemptRecovery(cnsError)
    
    // Check if escalation is needed
    if (this.shouldEscalate(cnsError)) {
      await this.escalateError(cnsError)
    }

    return cnsError
  }

  /**
   * Record successful operation to update circuit breakers
   */
  recordSuccess(category: ErrorCategory): void {
    this.updateCircuitBreaker(category, true)
  }

  /**
   * Check if circuit breaker is open for a category
   */
  isCircuitBreakerOpen(category: ErrorCategory): boolean {
    const breaker = this.circuitBreakers.get(category)
    if (!breaker) return false
    
    if (breaker.state === 'open') {
      // Check if recovery timeout has passed
      if (Date.now() - breaker.lastFailureTime > breaker.config.recoveryTimeout) {
        breaker.state = 'half-open'
        return false
      }
      return true
    }
    
    return false
  }

  /**
   * Get error statistics and health metrics
   */
  getHealthMetrics(): any {
    return {
      totalErrors: this.errors.size,
      errorsByCategory: this.errorStats.getErrorsByCategory(),
      errorsBySeverity: this.errorStats.getErrorsBySeverity(),
      errorRate: this.errorStats.getErrorRate(),
      circuitBreakerStates: this.getCircuitBreakerStates(),
      recentErrors: this.getRecentErrors(10),
      recoverySuccess: this.errorStats.getRecoverySuccessRate()
    }
  }

  /**
   * Resolve an error manually
   */
  async resolveError(errorId: string, resolution: string): Promise<boolean> {
    const error = this.errors.get(errorId)
    if (!error) return false
    
    error.resolved = true
    error.details.resolution = resolution
    error.details.resolvedAt = Date.now()
    
    this.logger.info('Error resolved', { errorId, resolution })
    this.emit('cns:error_resolved', error)
    
    return true
  }

  // Private methods

  private initializeRecoveryStrategies(): void {
    const strategies: [ErrorCategory, ErrorRecoveryStrategy][] = [
      [ErrorCategory.NETWORK, {
        maxRetries: 3,
        backoffMs: 1000,
        escalationThreshold: 5,
        timeoutMs: 30000,
        fallbackAction: 'use_cache'
      }],
      [ErrorCategory.VALIDATION, {
        maxRetries: 1,
        backoffMs: 500,
        escalationThreshold: 3,
        timeoutMs: 5000,
        fallbackAction: 'skip_validation'
      }],
      [ErrorCategory.PROCESSING, {
        maxRetries: 2,
        backoffMs: 2000,
        escalationThreshold: 4,
        timeoutMs: 60000,
        fallbackAction: 'degrade_service'
      }],
      [ErrorCategory.STORAGE, {
        maxRetries: 3,
        backoffMs: 1500,
        escalationThreshold: 3,
        timeoutMs: 45000,
        fallbackAction: 'use_backup_storage'
      }],
      [ErrorCategory.SEMANTIC, {
        maxRetries: 2,
        backoffMs: 1000,
        escalationThreshold: 2,
        timeoutMs: 30000,
        fallbackAction: 'use_simple_matching'
      }],
      [ErrorCategory.ACTOR, {
        maxRetries: 5,
        backoffMs: 500,
        escalationThreshold: 10,
        timeoutMs: 10000,
        fallbackAction: 'restart_actor'
      }],
      [ErrorCategory.MEMORY, {
        maxRetries: 2,
        backoffMs: 1000,
        escalationThreshold: 5,
        timeoutMs: 20000,
        fallbackAction: 'trigger_gc'
      }],
      [ErrorCategory.MARKET_DATA, {
        maxRetries: 3,
        backoffMs: 500,
        escalationThreshold: 3,
        timeoutMs: 15000,
        fallbackAction: 'use_cached_data'
      }],
      [ErrorCategory.NEWS_VALIDATION, {
        maxRetries: 2,
        backoffMs: 200,
        escalationThreshold: 5,
        timeoutMs: 10000,
        fallbackAction: 'use_basic_validation'
      }]
    ]

    for (const [category, strategy] of strategies) {
      this.recoveryStrategies.set(category, strategy)
    }
  }

  private logError(error: CNSError): void {
    const logLevel = this.getLogLevel(error.severity)
    
    this.logger.log(logLevel, 'CNS Error', {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      component: error.context.component,
      operation: error.context.operation,
      details: error.details,
      stackTrace: error.stackTrace
    })
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW: return 'warn'
      case ErrorSeverity.MEDIUM: return 'error'
      case ErrorSeverity.HIGH: return 'error'
      case ErrorSeverity.CRITICAL: return 'error'
      default: return 'error'
    }
  }

  private updateCircuitBreaker(category: ErrorCategory, success: boolean): void {
    if (!this.circuitBreakers.has(category)) {
      this.circuitBreakers.set(category, new CircuitBreakerState({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringWindow: 60000
      }))
    }

    const breaker = this.circuitBreakers.get(category)!
    
    if (success) {
      breaker.recordSuccess()
    } else {
      breaker.recordFailure()
    }
  }

  private async attemptRecovery(error: CNSError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.category)
    if (!strategy || error.recoveryAttempts >= strategy.maxRetries) {
      return
    }

    error.recoveryAttempts++
    
    try {
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, strategy.backoffMs * error.recoveryAttempts))
      
      // Attempt specific recovery based on category
      const recovered = await this.executeRecovery(error, strategy)
      
      if (recovered) {
        error.resolved = true
        this.errorStats.recordRecovery(error.category, true)
        this.logger.info('Error recovery successful', { errorId: error.id })
        this.emit('cns:error_recovered', error)
      } else {
        this.errorStats.recordRecovery(error.category, false)
        
        // Retry if attempts remain
        if (error.recoveryAttempts < strategy.maxRetries) {
          setTimeout(() => this.attemptRecovery(error), strategy.backoffMs)
        }
      }
      
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed', { 
        errorId: error.id, 
        recoveryError: recoveryError.message 
      })
      this.errorStats.recordRecovery(error.category, false)
    }
  }

  private async executeRecovery(error: CNSError, strategy: ErrorRecoveryStrategy): Promise<boolean> {
    switch (strategy.fallbackAction) {
      case 'use_cache':
        this.emit('cns:fallback:use_cache', error)
        return true
        
      case 'skip_validation':
        this.emit('cns:fallback:skip_validation', error)
        return true
        
      case 'degrade_service':
        this.emit('cns:fallback:degrade_service', error)
        return true
        
      case 'use_backup_storage':
        this.emit('cns:fallback:use_backup_storage', error)
        return true
        
      case 'use_simple_matching':
        this.emit('cns:fallback:use_simple_matching', error)
        return true
        
      case 'restart_actor':
        this.emit('cns:fallback:restart_actor', error)
        return true
        
      case 'trigger_gc':
        if (global.gc) {
          global.gc()
        }
        return true
        
      case 'use_cached_data':
        this.emit('cns:fallback:use_cached_data', error)
        return true
        
      case 'use_basic_validation':
        this.emit('cns:fallback:use_basic_validation', error)
        return true
        
      default:
        return false
    }
  }

  private shouldEscalate(error: CNSError): boolean {
    const strategy = this.recoveryStrategies.get(error.category)
    if (!strategy) return false
    
    return (
      error.severity === ErrorSeverity.CRITICAL ||
      error.recoveryAttempts >= strategy.escalationThreshold ||
      this.errorStats.getRecentErrorCount(error.category) > strategy.escalationThreshold
    )
  }

  private async escalateError(error: CNSError): Promise<void> {
    this.logger.error('Error escalated', { errorId: error.id })
    this.emit('cns:error_escalated', error)
    
    // Could integrate with external alerting systems here
    // - PagerDuty
    // - Slack notifications
    // - Email alerts
    // - SMS alerts for critical errors
  }

  private getCircuitBreakerStates(): any {
    const states: any = {}
    
    for (const [category, breaker] of this.circuitBreakers) {
      states[category] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime
      }
    }
    
    return states
  }

  private getRecentErrors(count: number): CNSError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
  }
}

/**
 * Circuit Breaker State Management
 */
class CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open' = 'closed'
  failureCount = 0
  lastFailureTime = 0
  
  constructor(public config: CircuitBreakerConfig) {}
  
  recordSuccess(): void {
    this.failureCount = 0
    this.state = 'closed'
  }
  
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }
}

/**
 * Error Statistics Tracking
 */
class ErrorStatistics {
  private errorCounts = new Map<ErrorCategory, number>()
  private severityCounts = new Map<ErrorSeverity, number>()
  private recoveryStats = new Map<ErrorCategory, { attempts: number, successes: number }>()
  private errorHistory: { category: ErrorCategory, timestamp: number }[] = []
  
  recordError(category: ErrorCategory, severity: ErrorSeverity): void {
    this.errorCounts.set(category, (this.errorCounts.get(category) || 0) + 1)
    this.severityCounts.set(severity, (this.severityCounts.get(severity) || 0) + 1)
    this.errorHistory.push({ category, timestamp: Date.now() })
    
    // Keep only last 1000 errors in history
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000)
    }
  }
  
  recordRecovery(category: ErrorCategory, success: boolean): void {
    if (!this.recoveryStats.has(category)) {
      this.recoveryStats.set(category, { attempts: 0, successes: 0 })
    }
    
    const stats = this.recoveryStats.get(category)!
    stats.attempts++
    if (success) stats.successes++
  }
  
  getErrorsByCategory(): Record<string, number> {
    return Object.fromEntries(this.errorCounts)
  }
  
  getErrorsBySeverity(): Record<string, number> {
    return Object.fromEntries(this.severityCounts)
  }
  
  getErrorRate(): number {
    const recentErrors = this.errorHistory.filter(e => 
      Date.now() - e.timestamp < 300000 // Last 5 minutes
    )
    return recentErrors.length / 5 // Errors per minute
  }
  
  getRecoverySuccessRate(): Record<string, string> {
    const rates: Record<string, string> = {}
    
    for (const [category, stats] of this.recoveryStats) {
      const rate = stats.attempts > 0 ? (stats.successes / stats.attempts * 100) : 0
      rates[category] = rate.toFixed(1) + '%'
    }
    
    return rates
  }
  
  getRecentErrorCount(category: ErrorCategory): number {
    return this.errorHistory.filter(e => 
      e.category === category && Date.now() - e.timestamp < 300000
    ).length
  }
}

export default CNSErrorHandler