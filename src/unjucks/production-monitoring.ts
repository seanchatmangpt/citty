/**
 * 📊 FINISHING TOUCH: Production Monitoring and Observability
 * Enterprise-grade monitoring for semantic template systems in production
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { performanceProfiler } from './performance-profiler'
import { errorRecoverySystem } from './error-recovery'
import { developerTools } from './developer-tools'

export interface MetricData {
  name: string
  value: number
  timestamp: number
  tags: Record<string, string>
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'rate'
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  source: string
  timestamp: number
  resolved: boolean
  metadata: Record<string, any>
}

export interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: number
  responseTime: number
  details: string
  metadata?: Record<string, any>
}

export interface SLAMetrics {
  availability: number
  errorRate: number
  responseTime: {
    p50: number
    p95: number
    p99: number
  }
  throughput: number
  period: {
    start: number
    end: number
  }
}

export interface TraceSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  startTime: number
  endTime?: number
  tags: Record<string, any>
  logs: Array<{
    timestamp: number
    fields: Record<string, any>
  }>
}

export class ProductionMonitor extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map()
  private alerts: Map<string, Alert> = new Map()
  private healthChecks: Map<string, HealthCheck> = new Map()
  private traces: Map<string, TraceSpan[]> = new Map()
  private baselines: Map<string, number> = new Map()
  private alertThresholds: Map<string, { warning: number; critical: number }> = new Map()
  private slaTargets: Map<string, { availability: number; errorRate: number; responseTime: number }> = new Map()
  
  private metricsInterval: NodeJS.Timeout | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private alertingEnabled: boolean = true
  
  constructor() {
    super()
    this.setupDefaultBaselines()
    this.setupDefaultThresholds()
    this.setupDefaultSLAs()
    this.startBackgroundTasks()
  }
  
  /**
   * Record a metric measurement
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    unit: MetricData['unit'] = 'count'
  ): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit
    }
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    this.metrics.get(name)!.push(metric)
    
    // Keep only recent metrics (last hour)
    const cutoff = Date.now() - (60 * 60 * 1000)
    const filtered = this.metrics.get(name)!.filter(m => m.timestamp > cutoff)
    this.metrics.set(name, filtered)
    
    // Check for alert conditions
    this.checkAlerts(name, value, tags)
    
    this.emit('metric:recorded', { metric })
  }
  
  /**
   * Start a distributed trace
   */
  startTrace(operationName: string, tags: Record<string, any> = {}): TraceSpan {
    const traceId = this.generateId()
    const spanId = this.generateId()
    
    const span: TraceSpan = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      tags,
      logs: []
    }
    
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, [])
    }
    this.traces.get(traceId)!.push(span)
    
    this.emit('trace:start', { span })
    return span
  }
  
  /**
   * Finish a trace span
   */
  finishTrace(span: TraceSpan, tags: Record<string, any> = {}): void {
    span.endTime = Date.now()
    span.tags = { ...span.tags, ...tags }
    
    // Record timing metric
    this.recordMetric(
      `trace.duration`,
      span.endTime - span.startTime,
      { operation: span.operationName },
      'ms'
    )
    
    this.emit('trace:finish', { span })
  }
  
  /**
   * Add log to trace span
   */
  logToTrace(span: TraceSpan, fields: Record<string, any>): void {
    span.logs.push({
      timestamp: Date.now(),
      fields
    })
  }
  
  /**
   * Register a health check
   */
  registerHealthCheck(
    name: string,
    checkFn: () => Promise<{ status: HealthCheck['status']; details: string; metadata?: any }>
  ): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      lastCheck: 0,
      responseTime: 0,
      details: 'Not checked yet'
    })
    
    // Store the check function for later execution
    this.on(`healthcheck:${name}`, checkFn)
    
    this.emit('healthcheck:registered', { name })
  }
  
  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = []
    
    for (const [name, healthCheck] of this.healthChecks) {
      const start = Date.now()
      
      try {
        // Emit the health check event and wait for result
        const checkResult = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Health check timeout')), 5000)
          
          this.once(`healthcheck:result:${name}`, (result) => {
            clearTimeout(timeout)
            resolve(result)
          })
          
          this.emit(`healthcheck:${name}`)
        })
        
        const responseTime = Date.now() - start
        
        const updated: HealthCheck = {
          name,
          status: checkResult.status,
          lastCheck: Date.now(),
          responseTime,
          details: checkResult.details,
          metadata: checkResult.metadata
        }
        
        this.healthChecks.set(name, updated)
        results.push(updated)
        
        // Record health check metrics
        this.recordMetric(
          'healthcheck.response_time',
          responseTime,
          { check: name },
          'ms'
        )
        
        this.recordMetric(
          'healthcheck.status',
          checkResult.status === 'healthy' ? 1 : 0,
          { check: name }
        )
        
      } catch (error) {
        const responseTime = Date.now() - start
        
        const updated: HealthCheck = {
          name,
          status: 'unhealthy',
          lastCheck: Date.now(),
          responseTime,
          details: error.message
        }
        
        this.healthChecks.set(name, updated)
        results.push(updated)
        
        this.createAlert('critical', `Health check failed: ${name}`, 'healthcheck', {
          check: name,
          error: error.message
        })
      }
    }
    
    this.emit('healthchecks:complete', { results })
    return results
  }
  
  /**
   * Create an alert
   */
  createAlert(
    severity: Alert['severity'],
    message: string,
    source: string,
    metadata: Record<string, any> = {}
  ): void {
    const alert: Alert = {
      id: this.generateId(),
      severity,
      message,
      source,
      timestamp: Date.now(),
      resolved: false,
      metadata
    }
    
    this.alerts.set(alert.id, alert)
    
    if (this.alertingEnabled) {
      this.emit('alert:created', { alert })
      
      // Auto-escalate critical alerts
      if (severity === 'critical') {
        this.emit('alert:critical', { alert })
      }
    }
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      this.emit('alert:resolved', { alert })
    }
  }
  
  /**
   * Get current SLA metrics
   */
  getSLAMetrics(period: { start: number; end: number }): SLAMetrics {
    const metrics = this.getMetricsInPeriod(period)
    
    // Calculate availability (uptime percentage)
    const healthCheckMetrics = metrics.filter(m => m.name === 'healthcheck.status')
    const totalChecks = healthCheckMetrics.length
    const healthyChecks = healthCheckMetrics.filter(m => m.value === 1).length
    const availability = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100
    
    // Calculate error rate
    const errorMetrics = metrics.filter(m => m.name === 'error.count')
    const requestMetrics = metrics.filter(m => m.name === 'request.count')
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.value, 0)
    const totalRequests = requestMetrics.reduce((sum, m) => sum + m.value, 0)
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    
    // Calculate response time percentiles
    const responseTimeMetrics = metrics
      .filter(m => m.name === 'response.time')
      .map(m => m.value)
      .sort((a, b) => a - b)
    
    const p50 = this.percentile(responseTimeMetrics, 0.5)
    const p95 = this.percentile(responseTimeMetrics, 0.95)
    const p99 = this.percentile(responseTimeMetrics, 0.99)
    
    // Calculate throughput (requests per second)
    const periodDurationSeconds = (period.end - period.start) / 1000
    const throughput = periodDurationSeconds > 0 ? totalRequests / periodDurationSeconds : 0
    
    return {
      availability,
      errorRate,
      responseTime: { p50, p95, p99 },
      throughput,
      period
    }
  }
  
  /**
   * Get comprehensive monitoring report
   */
  getMonitoringReport(): any {
    const now = Date.now()
    const lastHour = now - (60 * 60 * 1000)
    
    // Get SLA metrics for last hour
    const slaMetrics = this.getSLAMetrics({ start: lastHour, end: now })
    
    // Get active alerts
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
    
    // Get health check status
    const healthChecks = Array.from(this.healthChecks.values())
    const healthyChecks = healthChecks.filter(hc => hc.status === 'healthy').length
    const overallHealth = healthChecks.length > 0 ? (healthyChecks / healthChecks.length) * 100 : 100
    
    // Get top metrics
    const topMetrics = this.getTopMetrics(10)
    
    // Get recent traces
    const recentTraces = this.getRecentTraces(20)
    
    return {
      timestamp: now,
      summary: {
        overallHealth: overallHealth >= 90 ? 'healthy' : overallHealth >= 70 ? 'degraded' : 'unhealthy',
        healthPercentage: overallHealth,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length
      },
      sla: slaMetrics,
      alerts: activeAlerts.slice(0, 10), // Latest 10 alerts
      healthChecks,
      metrics: topMetrics,
      traces: recentTraces,
      baselines: Object.fromEntries(this.baselines),
      recommendations: this.generateRecommendations()
    }
  }
  
  /**
   * Enable or disable alerting
   */
  setAlerting(enabled: boolean): void {
    this.alertingEnabled = enabled
    this.emit('alerting:toggled', { enabled })
  }
  
  /**
   * Set alert thresholds for a metric
   */
  setAlertThreshold(metric: string, warning: number, critical: number): void {
    this.alertThresholds.set(metric, { warning, critical })
    this.emit('threshold:updated', { metric, warning, critical })
  }
  
  /**
   * Set SLA targets
   */
  setSLATargets(
    service: string,
    targets: { availability: number; errorRate: number; responseTime: number }
  ): void {
    this.slaTargets.set(service, targets)
    this.emit('sla:updated', { service, targets })
  }
  
  /**
   * Export monitoring data
   */
  exportData(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusFormat()
    }
    
    return JSON.stringify({
      metrics: Object.fromEntries(this.metrics),
      alerts: Array.from(this.alerts.values()),
      healthChecks: Array.from(this.healthChecks.values()),
      traces: Object.fromEntries(this.traces),
      baselines: Object.fromEntries(this.baselines)
    }, null, 2)
  }
  
  /**
   * Destroy monitor and cleanup
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    this.removeAllListeners()
    this.metrics.clear()
    this.alerts.clear()
    this.healthChecks.clear()
    this.traces.clear()
  }
  
  // Private methods
  
  private setupDefaultBaselines(): void {
    // Establish performance baselines
    this.baselines.set('response.time.p95', 200) // 200ms
    this.baselines.set('error.rate', 1) // 1%
    this.baselines.set('availability', 99.9) // 99.9%
    this.baselines.set('memory.usage', 512 * 1024 * 1024) // 512MB
    this.baselines.set('template.render.time', 50) // 50ms
  }
  
  private setupDefaultThresholds(): void {
    // Setup default alert thresholds
    this.setAlertThreshold('response.time', 500, 1000) // ms
    this.setAlertThreshold('error.rate', 5, 10) // percent
    this.setAlertThreshold('memory.usage', 80, 95) // percent
    this.setAlertThreshold('template.render.time', 100, 500) // ms
  }
  
  private setupDefaultSLAs(): void {
    // Setup default SLA targets
    this.setSLATargets('template-system', {
      availability: 99.9,
      errorRate: 1,
      responseTime: 200
    })
  }
  
  private startBackgroundTasks(): void {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics()
    }, 30000)
    
    // Run health checks every 2 minutes
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks()
    }, 120000)
  }
  
  private collectSystemMetrics(): void {
    const memory = process.memoryUsage()
    const now = Date.now()
    
    this.recordMetric('system.memory.heap_used', memory.heapUsed, {}, 'bytes')
    this.recordMetric('system.memory.heap_total', memory.heapTotal, {}, 'bytes')
    this.recordMetric('system.memory.external', memory.external, {}, 'bytes')
    
    // Integrate with existing systems
    const profilerReport = performanceProfiler.getReport()
    if (profilerReport?.totalMetrics) {
      this.recordMetric('profiler.total_metrics', profilerReport.totalMetrics)
    }
    
    const errorReport = errorRecoverySystem.getRecoveryReport()
    if (errorReport?.totalErrors) {
      this.recordMetric('errors.total', errorReport.totalErrors)
    }
  }
  
  private checkAlerts(metricName: string, value: number, tags: Record<string, string>): void {
    const thresholds = this.alertThresholds.get(metricName)
    if (!thresholds) return
    
    const baseline = this.baselines.get(metricName)
    const deviation = baseline ? ((value - baseline) / baseline) * 100 : 0
    
    if (value >= thresholds.critical || Math.abs(deviation) > 100) {
      this.createAlert(
        'critical',
        `Metric ${metricName} exceeded critical threshold: ${value}`,
        'threshold-monitor',
        { metric: metricName, value, threshold: thresholds.critical, tags }
      )
    } else if (value >= thresholds.warning || Math.abs(deviation) > 50) {
      this.createAlert(
        'warning',
        `Metric ${metricName} exceeded warning threshold: ${value}`,
        'threshold-monitor',
        { metric: metricName, value, threshold: thresholds.warning, tags }
      )
    }
  }
  
  private getMetricsInPeriod(period: { start: number; end: number }): MetricData[] {
    const result: MetricData[] = []
    
    for (const metrics of this.metrics.values()) {
      const filtered = metrics.filter(
        m => m.timestamp >= period.start && m.timestamp <= period.end
      )
      result.push(...filtered)
    }
    
    return result
  }
  
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }
  
  private getTopMetrics(limit: number): Array<{ name: string; count: number; latest: number }> {
    return Array.from(this.metrics.entries())
      .map(([name, metrics]) => ({
        name,
        count: metrics.length,
        latest: metrics.length > 0 ? metrics[metrics.length - 1].value : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
  
  private getRecentTraces(limit: number): TraceSpan[] {
    const allTraces: TraceSpan[] = []
    
    for (const traces of this.traces.values()) {
      allTraces.push(...traces)
    }
    
    return allTraces
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // Analyze recent metrics for recommendations
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved && Date.now() - alert.timestamp < 3600000) // Last hour
    
    if (recentAlerts.length > 10) {
      recommendations.push('High alert volume detected - consider adjusting thresholds')
    }
    
    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical')
    if (criticalAlerts.length > 0) {
      recommendations.push(`${criticalAlerts.length} critical alerts need immediate attention`)
    }
    
    const unhealthyChecks = Array.from(this.healthChecks.values())
      .filter(hc => hc.status === 'unhealthy')
    
    if (unhealthyChecks.length > 0) {
      recommendations.push(`${unhealthyChecks.length} health checks are failing`)
    }
    
    return recommendations
  }
  
  private exportPrometheusFormat(): string {
    const lines: string[] = []
    
    for (const [name, metrics] of this.metrics) {
      const latest = metrics[metrics.length - 1]
      if (latest) {
        lines.push(`# HELP ${name} Metric from production monitor`)
        lines.push(`# TYPE ${name} gauge`)
        
        const tagsStr = Object.entries(latest.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',')
        
        lines.push(`${name}{${tagsStr}} ${latest.value} ${latest.timestamp}`)
      }
    }
    
    return lines.join('\n')
  }
  
  private generateId(): string {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 16)
  }
}

// Global production monitor instance
export const productionMonitor = new ProductionMonitor()

// Integration with existing systems
productionMonitor.on('metric:recorded', ({ metric }) => {
  developerTools.trace(`Metric recorded: ${metric.name} = ${metric.value}`, { metric })
})

productionMonitor.on('alert:created', ({ alert }) => {
  developerTools.trace(`Alert created: ${alert.severity} - ${alert.message}`, { alert })
})

// Setup default health checks
productionMonitor.registerHealthCheck('template-system', async () => {
  try {
    // Check template system health
    const report = performanceProfiler.getReport()
    const insights = performanceProfiler.getInsights()
    
    if (insights.some(insight => insight.includes('slow'))) {
      return { status: 'degraded', details: 'Template system performance degraded' }
    }
    
    return { status: 'healthy', details: 'Template system operating normally' }
  } catch (error) {
    return { status: 'unhealthy', details: error.message }
  }
})

productionMonitor.registerHealthCheck('error-recovery', async () => {
  try {
    const health = errorRecoverySystem.getHealthStatus()
    return {
      status: health.status === 'critical' ? 'unhealthy' : 
             health.status === 'degraded' ? 'degraded' : 'healthy',
      details: `Error recovery system: ${health.status}`,
      metadata: health.details
    }
  } catch (error) {
    return { status: 'unhealthy', details: error.message }
  }
})

// Convenience functions
export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>,
  unit?: MetricData['unit']
): void {
  productionMonitor.recordMetric(name, value, tags, unit)
}

export function createAlert(
  severity: Alert['severity'],
  message: string,
  source: string,
  metadata?: Record<string, any>
): void {
  productionMonitor.createAlert(severity, message, source, metadata)
}

export function startTrace(operationName: string, tags?: Record<string, any>): TraceSpan {
  return productionMonitor.startTrace(operationName, tags)
}

export function finishTrace(span: TraceSpan, tags?: Record<string, any>): void {
  productionMonitor.finishTrace(span, tags)
}

// Monitoring decorator for TypeScript
export function monitorOperation(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const operation = operationName || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function (...args: any[]) {
      const span = startTrace(operation, { method: propertyKey })
      const startTime = Date.now()
      
      try {
        recordMetric(`${operation}.requests`, 1)
        
        const result = await originalMethod.apply(this, args)
        
        const duration = Date.now() - startTime
        recordMetric(`${operation}.response_time`, duration, {}, 'ms')
        recordMetric(`${operation}.success`, 1)
        
        finishTrace(span, { success: true })
        return result
        
      } catch (error) {
        const duration = Date.now() - startTime
        recordMetric(`${operation}.response_time`, duration, {}, 'ms')
        recordMetric(`${operation}.errors`, 1)
        
        finishTrace(span, { success: false, error: error.message })
        
        createAlert('error', `Operation ${operation} failed: ${error.message}`, 'decorator', {
          operation,
          error: error.stack
        })
        
        throw error
      }
    }
    
    return descriptor
  }
}