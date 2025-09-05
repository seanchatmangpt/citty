import { EventEmitter } from 'events';
import { UnifiedRequest, UnifiedResponse, SystemType } from '../types/orchestration';

interface MetricPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

interface TimeSeriesMetric {
  name: string;
  points: MetricPoint[];
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  description?: string;
}

interface SystemMetrics {
  requests: {
    total: number;
    success: number;
    error: number;
    timeout: number;
  };
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    rps: number; // requests per second
    peak: number;
  };
  errors: {
    rate: number;
    recent: Array<{
      timestamp: Date;
      error: string;
      operation: string;
    }>;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number; // 0-1
    lastCheck: Date;
  };
}

interface Alert {
  id: string;
  name: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

interface MetricsConfig {
  enabled: boolean;
  logLevel: string;
  metricsInterval: number;
  retentionPeriod: number; // in milliseconds
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    throughput: number;
  };
}

export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private metrics: Map<string, TimeSeriesMetric> = new Map();
  private systemMetrics: Map<SystemType, SystemMetrics> = new Map();
  private alerts: Alert[] = [];
  private requestBuffer: Array<{
    request: UnifiedRequest;
    response: UnifiedResponse;
    processingTime: number;
    timestamp: Date;
  }> = [];
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: MetricsConfig) {
    super();
    this.config = config;
    this.initializeSystemMetrics();
  }

  private initializeSystemMetrics(): void {
    const systems: SystemType[] = ['cns', 'bytestar', 'marketplace'];
    
    for (const system of systems) {
      this.systemMetrics.set(system, {
        requests: { total: 0, success: 0, error: 0, timeout: 0 },
        responseTime: { avg: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { rps: 0, peak: 0 },
        errors: { rate: 0, recent: [] },
        health: { status: 'healthy', score: 1.0, lastCheck: new Date() }
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.collectMetrics();
      this.cleanupOldData();
      this.checkAlerts();
    }, this.config.metricsInterval);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  recordRequest(request: UnifiedRequest, response: UnifiedResponse, processingTime: number): void {
    const timestamp = new Date();
    const system = response.source;

    // Add to buffer for detailed analysis
    this.requestBuffer.push({
      request,
      response,
      processingTime,
      timestamp
    });

    // Update system metrics immediately
    const systemMetric = this.systemMetrics.get(system)!;
    systemMetric.requests.total++;

    switch (response.status) {
      case 'success':
        systemMetric.requests.success++;
        break;
      case 'error':
        systemMetric.requests.error++;
        systemMetric.errors.recent.push({
          timestamp,
          error: response.error?.message || 'Unknown error',
          operation: request.operation
        });
        break;
      case 'timeout':
        systemMetric.requests.timeout++;
        break;
    }

    // Update metrics
    this.recordMetric('requests.total', 1, 'counter', { system, operation: request.operation });
    this.recordMetric(`requests.${response.status}`, 1, 'counter', { system });
    this.recordMetric('response_time', processingTime, 'timer', { system, operation: request.operation });

    // Keep recent errors manageable
    if (systemMetric.errors.recent.length > 100) {
      systemMetric.errors.recent = systemMetric.errors.recent.slice(-50);
    }

    // Keep request buffer manageable
    if (this.requestBuffer.length > 10000) {
      this.requestBuffer = this.requestBuffer.slice(-5000);
    }
  }

  recordError(request: UnifiedRequest, error: Error, processingTime: number): void {
    const system = request.target || request.source;
    const timestamp = new Date();

    // Record error metrics
    this.recordMetric('errors.total', 1, 'counter', { 
      system, 
      operation: request.operation,
      errorType: error.name 
    });

    this.recordMetric('error_response_time', processingTime, 'timer', { system });

    // Update system metrics
    const systemMetric = this.systemMetrics.get(system)!;
    systemMetric.errors.recent.push({
      timestamp,
      error: error.message,
      operation: request.operation
    });
  }

  private recordMetric(name: string, value: number, type: TimeSeriesMetric['type'], tags?: Record<string, string>): void {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = {
        name,
        points: [],
        type,
        description: this.getMetricDescription(name)
      };
      this.metrics.set(name, metric);
    }

    metric.points.push({
      timestamp: new Date(),
      value,
      tags
    });

    // Keep points manageable
    if (metric.points.length > 10000) {
      metric.points = metric.points.slice(-5000);
    }
  }

  private getMetricDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'requests.total': 'Total number of requests',
      'requests.success': 'Number of successful requests',
      'requests.error': 'Number of failed requests',
      'requests.timeout': 'Number of timed out requests',
      'response_time': 'Request processing time in milliseconds',
      'error_response_time': 'Error response time in milliseconds',
      'errors.total': 'Total number of errors',
      'throughput': 'Requests per second',
      'system.cpu': 'CPU utilization percentage',
      'system.memory': 'Memory utilization percentage',
      'system.load': 'Current system load'
    };

    return descriptions[name] || name;
  }

  private collectMetrics(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Calculate throughput and response times
    for (const [system, systemMetric] of this.systemMetrics.entries()) {
      const recentRequests = this.requestBuffer.filter(
        req => req.timestamp > oneMinuteAgo && req.response.source === system
      );

      // Calculate throughput (RPS)
      const rps = recentRequests.length / 60;
      systemMetric.throughput.rps = rps;
      if (rps > systemMetric.throughput.peak) {
        systemMetric.throughput.peak = rps;
      }

      // Calculate response time percentiles
      if (recentRequests.length > 0) {
        const responseTimes = recentRequests
          .map(req => req.processingTime)
          .sort((a, b) => a - b);

        systemMetric.responseTime.avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        systemMetric.responseTime.p50 = this.percentile(responseTimes, 0.5);
        systemMetric.responseTime.p95 = this.percentile(responseTimes, 0.95);
        systemMetric.responseTime.p99 = this.percentile(responseTimes, 0.99);
      }

      // Calculate error rate
      const recentErrors = recentRequests.filter(req => req.response.status === 'error');
      systemMetric.errors.rate = recentRequests.length > 0 ? 
        recentErrors.length / recentRequests.length : 0;

      // Update health score
      systemMetric.health.score = this.calculateHealthScore(systemMetric);
      systemMetric.health.status = this.getHealthStatus(systemMetric.health.score);
      systemMetric.health.lastCheck = now;

      // Record system-level metrics
      this.recordMetric('throughput', rps, 'gauge', { system });
      this.recordMetric('error_rate', systemMetric.errors.rate, 'gauge', { system });
      this.recordMetric('health_score', systemMetric.health.score, 'gauge', { system });
      this.recordMetric('avg_response_time', systemMetric.responseTime.avg, 'gauge', { system });
    }

    // Record overall system metrics
    this.recordSystemMetrics();
  }

  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = percentile * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private calculateHealthScore(metrics: SystemMetrics): number {
    let score = 1.0;

    // Penalize high error rates
    if (metrics.errors.rate > 0.1) score -= 0.4;
    else if (metrics.errors.rate > 0.05) score -= 0.2;
    else if (metrics.errors.rate > 0.01) score -= 0.1;

    // Penalize slow response times
    if (metrics.responseTime.avg > 5000) score -= 0.3;
    else if (metrics.responseTime.avg > 2000) score -= 0.2;
    else if (metrics.responseTime.avg > 1000) score -= 0.1;

    // Penalize low throughput if expected
    if (metrics.throughput.rps < 0.1 && metrics.requests.total > 10) {
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  private getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= 0.8) return 'healthy';
    if (score >= 0.5) return 'degraded';
    return 'unhealthy';
  }

  private recordSystemMetrics(): void {
    // Record current system load
    const currentLoad = this.getCurrentLoad();
    this.recordMetric('system.load', currentLoad, 'gauge');

    // Record memory usage (simulated)
    const memoryUsage = process.memoryUsage();
    this.recordMetric('system.memory.heap_used', memoryUsage.heapUsed, 'gauge');
    this.recordMetric('system.memory.heap_total', memoryUsage.heapTotal, 'gauge');
    this.recordMetric('system.memory.external', memoryUsage.external, 'gauge');
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);

    // Clean up metric points
    for (const metric of this.metrics.values()) {
      metric.points = metric.points.filter(point => point.timestamp > cutoffTime);
    }

    // Clean up request buffer
    this.requestBuffer = this.requestBuffer.filter(req => req.timestamp > cutoffTime);

    // Clean up old error records
    for (const systemMetric of this.systemMetrics.values()) {
      systemMetric.errors.recent = systemMetric.errors.recent.filter(
        error => error.timestamp > cutoffTime
      );
    }

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp > cutoffTime || !alert.acknowledged
    );
  }

  private checkAlerts(): void {
    for (const [system, metrics] of this.systemMetrics.entries()) {
      // Error rate alert
      if (metrics.errors.rate > this.config.alertThresholds.errorRate) {
        this.createAlert(
          'high-error-rate',
          'critical',
          `High error rate detected for ${system}: ${(metrics.errors.rate * 100).toFixed(2)}%`,
          { system, errorRate: metrics.errors.rate }
        );
      }

      // Response time alert
      if (metrics.responseTime.avg > this.config.alertThresholds.responseTime) {
        this.createAlert(
          'high-response-time',
          'warning',
          `High response time detected for ${system}: ${metrics.responseTime.avg.toFixed(2)}ms`,
          { system, responseTime: metrics.responseTime.avg }
        );
      }

      // Health score alert
      if (metrics.health.score < 0.5) {
        this.createAlert(
          'poor-health',
          'critical',
          `Poor health score for ${system}: ${(metrics.health.score * 100).toFixed(2)}%`,
          { system, healthScore: metrics.health.score }
        );
      }
    }
  }

  private createAlert(name: string, level: Alert['level'], message: string, metadata?: Record<string, any>): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      alert.name === name && 
      !alert.acknowledged && 
      alert.metadata?.system === metadata?.system
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: this.generateId(),
      name,
      level,
      message,
      timestamp: new Date(),
      acknowledged: false,
      metadata
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  // Public API methods
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metric] of this.metrics.entries()) {
      result[name] = {
        type: metric.type,
        description: metric.description,
        points: metric.points.slice(-100), // Return last 100 points
        current: metric.points.length > 0 ? metric.points[metric.points.length - 1].value : 0
      };
    }

    return result;
  }

  getSystemMetrics(system?: SystemType): Record<string, SystemMetrics> | SystemMetrics {
    if (system) {
      const metrics = this.systemMetrics.get(system);
      if (!metrics) {
        throw new Error(`Unknown system: ${system}`);
      }
      return metrics;
    }

    const result: Record<string, SystemMetrics> = {};
    for (const [sys, metrics] of this.systemMetrics.entries()) {
      result[sys] = metrics;
    }
    return result;
  }

  getAlerts(includeAcknowledged: boolean = false): Alert[] {
    return this.alerts.filter(alert => includeAcknowledged || !alert.acknowledged);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getCurrentLoad(): number {
    // Simple load calculation based on request buffer size
    return Math.min(this.requestBuffer.length / 100, 1.0);
  }

  getHealthSummary(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    systems: Record<SystemType, 'healthy' | 'degraded' | 'unhealthy'>;
    alerts: number;
    uptime: number;
  } {
    const systems: Record<SystemType, 'healthy' | 'degraded' | 'unhealthy'> = {} as any;
    let overallScore = 0;

    for (const [system, metrics] of this.systemMetrics.entries()) {
      systems[system] = metrics.health.status;
      overallScore += metrics.health.score;
    }

    overallScore /= this.systemMetrics.size;

    return {
      overall: this.getHealthStatus(overallScore),
      systems,
      alerts: this.getAlerts().length,
      uptime: this.isRunning ? Date.now() - (this.intervalId ? 0 : Date.now()) : 0
    };
  }

  // Query methods
  queryMetric(name: string, options?: {
    since?: Date;
    until?: Date;
    tags?: Record<string, string>;
  }): MetricPoint[] {
    const metric = this.metrics.get(name);
    if (!metric) {
      return [];
    }

    let points = metric.points;

    if (options?.since) {
      points = points.filter(p => p.timestamp >= options.since!);
    }

    if (options?.until) {
      points = points.filter(p => p.timestamp <= options.until!);
    }

    if (options?.tags) {
      points = points.filter(p => {
        if (!p.tags) return false;
        return Object.entries(options.tags!).every(([key, value]) => p.tags![key] === value);
      });
    }

    return points;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}