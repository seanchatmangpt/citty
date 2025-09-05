/**
 * Error Recovery and Monitoring System - Production Polish Feature
 * Sophisticated error tracking, recovery mechanisms, and health monitoring
 */

import { ref, reactive, computed } from 'vue';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  type: 'javascript' | 'network' | 'validation' | 'business' | 'security' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId: string;
    component?: string;
    action?: string;
    props?: Record<string, any>;
    state?: Record<string, any>;
  };
  fingerprint: string;
  count: number;
  resolved: boolean;
  tags: string[];
  breadcrumbs: ErrorBreadcrumb[];
  performance: {
    memory: number;
    timing: PerformanceTiming;
    networkSpeed: string;
  };
  recovery: {
    attempted: boolean;
    successful: boolean;
    strategy: string;
    retries: number;
  };
}

export interface ErrorBreadcrumb {
  timestamp: Date;
  category: 'navigation' | 'user' | 'system' | 'network' | 'console';
  message: string;
  level: 'info' | 'warn' | 'error';
  data?: Record<string, any>;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | string;
  priority: number;
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  handler: (error: Error, context: any) => Promise<boolean>;
}

export interface HealthCheck {
  id: string;
  name: string;
  description: string;
  interval: number;
  timeout: number;
  checker: () => Promise<HealthStatus>;
  dependencies: string[];
}

export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
  timestamp: Date;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  performanceMetrics: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  networkMetrics: {
    latency: number;
    bandwidth: string;
    connectionType: string;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number;
  actions: Array<{
    type: 'email' | 'slack' | 'webhook' | 'sms';
    config: Record<string, any>;
  }>;
}

export class ErrorMonitoringSystem {
  private errors: Map<string, ErrorReport> = new Map();
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private metrics: SystemMetrics;
  private alertSubscribers: Set<(alert: any) => void> = new Set();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private sessionId: string;
  private maxBreadcrumbs = 50;
  private maxErrors = 1000;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.metrics = this.initializeMetrics();
    this.setupDefaultRecoveryStrategies();
    this.setupDefaultHealthChecks();
    this.setupDefaultAlerts();
    this.setupGlobalErrorHandlers();
    this.startBreadcrumbCollection();
  }

  /**
   * Capture and process error
   */
  captureError(
    error: Error,
    context: {
      component?: string;
      action?: string;
      props?: Record<string, any>;
      state?: Record<string, any>;
      userId?: string;
      severity?: ErrorReport['severity'];
      tags?: string[];
    } = {}
  ): string {
    const fingerprint = this.generateFingerprint(error, context);
    
    let errorReport = this.errors.get(fingerprint);
    
    if (errorReport) {
      // Update existing error
      errorReport.count++;
      errorReport.timestamp = new Date();
      errorReport.breadcrumbs = this.getBreadcrumbs();
    } else {
      // Create new error report
      errorReport = {
        id: this.generateId(),
        timestamp: new Date(),
        type: this.categorizeError(error),
        severity: context.severity || this.determineSeverity(error),
        message: error.message,
        stack: error.stack,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          userId: context.userId,
          sessionId: this.sessionId,
          component: context.component,
          action: context.action,
          props: context.props,
          state: context.state
        },
        fingerprint,
        count: 1,
        resolved: false,
        tags: context.tags || [],
        breadcrumbs: this.getBreadcrumbs(),
        performance: this.capturePerformanceInfo(),
        recovery: {
          attempted: false,
          successful: false,
          strategy: '',
          retries: 0
        }
      };

      this.errors.set(fingerprint, errorReport);
    }

    // Attempt recovery
    this.attemptRecovery(errorReport, error, context);

    // Check alert rules
    this.checkAlertRules(errorReport);

    // Limit memory usage
    this.limitErrorStorage();

    return errorReport.id;
  }

  /**
   * Add breadcrumb for error context
   */
  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: ErrorBreadcrumb = {
      ...breadcrumb,
      timestamp: new Date()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Limit breadcrumb history
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Register recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
  }

  /**
   * Start monitoring system health
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.runHealthChecks();

    this.monitoringInterval = setInterval(() => {
      this.runHealthChecks();
      this.updateMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    overall: HealthStatus['status'];
    services: Record<string, HealthStatus>;
    metrics: SystemMetrics;
    uptime: number;
  } {
    const services: Record<string, HealthStatus> = {};
    let healthyCount = 0;
    let totalCount = 0;

    this.healthStatuses.forEach((status, serviceId) => {
      services[serviceId] = status;
      totalCount++;
      if (status.healthy) healthyCount++;
    });

    let overall: HealthStatus['status'] = 'healthy';
    if (healthyCount === 0) {
      overall = 'unhealthy';
    } else if (healthyCount < totalCount) {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      metrics: this.metrics,
      uptime: Date.now() - this.getStartTime()
    };
  }

  /**
   * Get error analytics
   */
  getErrorAnalytics(timeRange: { start: Date; end: Date } = this.getDefaultTimeRange()): {
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{ error: ErrorReport; percentage: number }>;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoveryRate: number;
  } {
    const filteredErrors = Array.from(this.errors.values())
      .filter(error => 
        error.timestamp >= timeRange.start && 
        error.timestamp <= timeRange.end
      );

    const totalErrors = filteredErrors.reduce((sum, error) => sum + error.count, 0);
    
    // Calculate error rate (errors per hour)
    const timeSpanHours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    const errorRate = timeSpanHours > 0 ? totalErrors / timeSpanHours : 0;

    // Top errors by count
    const topErrors = filteredErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(error => ({
        error,
        percentage: totalErrors > 0 ? (error.count / totalErrors) * 100 : 0
      }));

    // Group by type and severity
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    filteredErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + error.count;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + error.count;
    });

    // Calculate recovery rate
    const attemptsWithRecovery = filteredErrors.filter(e => e.recovery.attempted);
    const successfulRecoveries = attemptsWithRecovery.filter(e => e.recovery.successful);
    const recoveryRate = attemptsWithRecovery.length > 0 
      ? (successfulRecoveries.length / attemptsWithRecovery.length) * 100 
      : 0;

    return {
      totalErrors,
      errorRate,
      topErrors,
      errorsByType,
      errorsBySeverity,
      recoveryRate
    };
  }

  /**
   * Export error data for external analysis
   */
  exportErrors(
    format: 'json' | 'csv',
    timeRange?: { start: Date; end: Date }
  ): string {
    const range = timeRange || this.getDefaultTimeRange();
    const filteredErrors = Array.from(this.errors.values())
      .filter(error => 
        error.timestamp >= range.start && 
        error.timestamp <= range.end
      );

    if (format === 'json') {
      return JSON.stringify(filteredErrors, null, 2);
    }

    // CSV format
    const headers = [
      'ID', 'Timestamp', 'Type', 'Severity', 'Message', 'Component', 
      'Action', 'Count', 'Resolved', 'Recovery Attempted', 'Recovery Successful'
    ];

    const rows = filteredErrors.map(error => [
      error.id,
      error.timestamp.toISOString(),
      error.type,
      error.severity,
      error.message.replace(/"/g, '""'),
      error.context.component || '',
      error.context.action || '',
      error.count,
      error.resolved,
      error.recovery.attempted,
      error.recovery.successful
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(callback: (alert: any) => void): void {
    this.alertSubscribers.add(callback);
  }

  /**
   * Resolve error manually
   */
  resolveError(errorId: string, resolution: string): boolean {
    const error = Array.from(this.errors.values()).find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      error.tags.push('resolved');
      this.addBreadcrumb({
        category: 'system',
        message: `Error resolved: ${resolution}`,
        level: 'info',
        data: { errorId, resolution }
      });
      return true;
    }
    return false;
  }

  /**
   * Get error details by ID
   */
  getErrorDetails(errorId: string): ErrorReport | undefined {
    return Array.from(this.errors.values()).find(error => error.id === errorId);
  }

  // Private methods
  private setupDefaultRecoveryStrategies(): void {
    const strategies: RecoveryStrategy[] = [
      {
        id: 'network_retry',
        name: 'Network Retry',
        description: 'Retry failed network requests',
        pattern: /network|fetch|timeout/i,
        priority: 1,
        maxRetries: 3,
        backoffStrategy: 'exponential',
        handler: async (error, context) => {
          if (context.originalRequest) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              await context.originalRequest();
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      },
      {
        id: 'component_reload',
        name: 'Component Reload',
        description: 'Reload component on render errors',
        pattern: /render|component/i,
        priority: 2,
        maxRetries: 1,
        backoffStrategy: 'linear',
        handler: async (error, context) => {
          if (context.component && context.reload) {
            try {
              await context.reload();
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      },
      {
        id: 'fallback_ui',
        name: 'Fallback UI',
        description: 'Show fallback UI on critical errors',
        pattern: /critical|fatal/i,
        priority: 3,
        maxRetries: 1,
        backoffStrategy: 'linear',
        handler: async (error, context) => {
          if (context.showFallback) {
            context.showFallback();
            return true;
          }
          return false;
        }
      }
    ];

    strategies.forEach(strategy => {
      this.recoveryStrategies.set(strategy.id, strategy);
    });
  }

  private setupDefaultHealthChecks(): void {
    const checks: HealthCheck[] = [
      {
        id: 'api_connectivity',
        name: 'API Connectivity',
        description: 'Check if API is reachable',
        interval: 60000,
        timeout: 5000,
        dependencies: [],
        checker: async () => {
          try {
            const start = Date.now();
            const response = await fetch('/api/health', { 
              method: 'GET',
              signal: AbortSignal.timeout(5000)
            });
            const responseTime = Date.now() - start;
            
            return {
              healthy: response.ok,
              status: response.ok ? 'healthy' : 'unhealthy',
              responseTime,
              details: { statusCode: response.status },
              timestamp: new Date()
            };
          } catch (error) {
            return {
              healthy: false,
              status: 'unhealthy',
              responseTime: -1,
              details: { error: (error as Error).message },
              timestamp: new Date()
            };
          }
        }
      },
      {
        id: 'memory_usage',
        name: 'Memory Usage',
        description: 'Monitor memory consumption',
        interval: 30000,
        timeout: 1000,
        dependencies: [],
        checker: async () => {
          const memInfo = this.getMemoryInfo();
          const threshold = 0.9; // 90% threshold
          const healthy = memInfo.percentage < threshold;
          
          return {
            healthy,
            status: healthy ? 'healthy' : memInfo.percentage > 0.95 ? 'unhealthy' : 'degraded',
            responseTime: 0,
            details: memInfo,
            timestamp: new Date()
          };
        }
      }
    ];

    checks.forEach(check => {
      this.healthChecks.set(check.id, check);
    });
  }

  private setupDefaultAlerts(): void {
    const alerts: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: 'error_rate > threshold',
        threshold: 10,
        severity: 'high',
        enabled: true,
        cooldown: 300000,
        actions: [
          {
            type: 'email',
            config: { recipients: ['admin@example.com'] }
          }
        ]
      },
      {
        id: 'critical_error',
        name: 'Critical Error',
        condition: 'error_severity == "critical"',
        threshold: 1,
        severity: 'critical',
        enabled: true,
        cooldown: 60000,
        actions: [
          {
            type: 'slack',
            config: { channel: '#alerts' }
          }
        ]
      }
    ];

    alerts.forEach(alert => {
      this.alertRules.set(alert.id, alert);
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        component: 'global',
        action: 'unhandled_error',
        severity: 'high',
        tags: ['unhandled']
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.captureError(error, {
        component: 'global',
        action: 'unhandled_rejection',
        severity: 'high',
        tags: ['promise', 'unhandled']
      });
    });
  }

  private startBreadcrumbCollection(): void {
    // Collect navigation breadcrumbs
    window.addEventListener('beforeunload', () => {
      this.addBreadcrumb({
        category: 'navigation',
        message: `Leaving page: ${window.location.href}`,
        level: 'info'
      });
    });

    // Collect click events
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.addBreadcrumb({
          category: 'user',
          message: `Clicked ${target.tagName}: ${target.textContent?.slice(0, 50)}`,
          level: 'info',
          data: { tagName: target.tagName, href: (target as HTMLAnchorElement).href }
        });
      }
    });
  }

  private async attemptRecovery(
    errorReport: ErrorReport,
    error: Error,
    context: any
  ): Promise<void> {
    const applicableStrategies = Array.from(this.recoveryStrategies.values())
      .filter(strategy => {
        if (strategy.pattern instanceof RegExp) {
          return strategy.pattern.test(error.message);
        }
        return error.message.toLowerCase().includes(strategy.pattern.toLowerCase());
      })
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of applicableStrategies) {
      if (errorReport.recovery.retries >= strategy.maxRetries) {
        continue;
      }

      errorReport.recovery.attempted = true;
      errorReport.recovery.strategy = strategy.name;
      errorReport.recovery.retries++;

      try {
        const success = await strategy.handler(error, context);
        if (success) {
          errorReport.recovery.successful = true;
          this.addBreadcrumb({
            category: 'system',
            message: `Recovery successful: ${strategy.name}`,
            level: 'info',
            data: { errorId: errorReport.id, strategy: strategy.name }
          });
          break;
        }
      } catch (recoveryError) {
        this.addBreadcrumb({
          category: 'system',
          message: `Recovery failed: ${strategy.name}`,
          level: 'error',
          data: { 
            errorId: errorReport.id, 
            strategy: strategy.name,
            recoveryError: (recoveryError as Error).message
          }
        });
      }
    }
  }

  private async runHealthChecks(): Promise<void> {
    const checks = Array.from(this.healthChecks.values());
    
    await Promise.all(
      checks.map(async (check) => {
        try {
          const status = await Promise.race([
            check.checker(),
            new Promise<HealthStatus>((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
            )
          ]);
          
          this.healthStatuses.set(check.id, status);
        } catch (error) {
          this.healthStatuses.set(check.id, {
            healthy: false,
            status: 'unhealthy',
            responseTime: -1,
            details: { error: (error as Error).message },
            timestamp: new Date()
          });
        }
      })
    );
  }

  private updateMetrics(): void {
    const memInfo = this.getMemoryInfo();
    const perfInfo = this.getPerformanceInfo();

    this.metrics = {
      uptime: Date.now() - this.getStartTime(),
      memoryUsage: memInfo,
      performanceMetrics: perfInfo,
      networkMetrics: {
        latency: this.getNetworkLatency(),
        bandwidth: this.getNetworkBandwidth(),
        connectionType: this.getConnectionType()
      }
    };
  }

  private checkAlertRules(errorReport: ErrorReport): void {
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      let shouldAlert = false;

      switch (rule.condition) {
        case 'error_rate > threshold':
          const recentErrors = Array.from(this.errors.values())
            .filter(e => e.timestamp >= new Date(Date.now() - 60 * 60 * 1000));
          const errorRate = recentErrors.reduce((sum, e) => sum + e.count, 0);
          shouldAlert = errorRate > rule.threshold;
          break;

        case 'error_severity == "critical"':
          shouldAlert = errorReport.severity === 'critical';
          break;
      }

      if (shouldAlert) {
        this.triggerAlert(rule, errorReport);
      }
    });
  }

  private triggerAlert(rule: AlertRule, errorReport: ErrorReport): void {
    const alert = {
      rule,
      error: errorReport,
      timestamp: new Date()
    };

    this.alertSubscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert subscriber:', error);
      }
    });
  }

  // Utility methods
  private generateFingerprint(error: Error, context: any): string {
    const key = `${error.message}:${context.component}:${context.action}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substring(2) + '_' + Date.now();
  }

  private categorizeError(error: Error): ErrorReport['type'] {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('validation')) return 'validation';
    if (message.includes('permission') || message.includes('auth')) return 'security';
    if (message.includes('performance') || message.includes('timeout')) return 'performance';
    return 'javascript';
  }

  private determineSeverity(error: Error): ErrorReport['severity'] {
    const message = error.message.toLowerCase();
    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('error') || message.includes('fail')) return 'high';
    if (message.includes('warn')) return 'medium';
    return 'low';
  }

  private getBreadcrumbs(): ErrorBreadcrumb[] {
    return [...this.breadcrumbs];
  }

  private capturePerformanceInfo(): ErrorReport['performance'] {
    return {
      memory: this.getMemoryUsage(),
      timing: performance.timing,
      networkSpeed: this.getNetworkSpeed()
    };
  }

  private getMemoryInfo(): SystemMetrics['memoryUsage'] {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  private getMemoryUsage(): number {
    const memory = (performance as any).memory;
    return memory ? memory.usedJSHeapSize : 0;
  }

  private getPerformanceInfo(): SystemMetrics['performanceMetrics'] {
    return {
      avgResponseTime: 0, // Would calculate from real metrics
      errorRate: 0, // Would calculate from error history
      throughput: 0 // Would calculate from request metrics
    };
  }

  private getNetworkLatency(): number {
    return 0; // Would measure actual network latency
  }

  private getNetworkBandwidth(): string {
    const connection = (navigator as any).connection;
    return connection ? connection.effectiveType : 'unknown';
  }

  private getConnectionType(): string {
    const connection = (navigator as any).connection;
    return connection ? connection.type : 'unknown';
  }

  private getNetworkSpeed(): string {
    const connection = (navigator as any).connection;
    return connection ? connection.effectiveType : 'unknown';
  }

  private getStartTime(): number {
    return performance.timeOrigin || Date.now();
  }

  private getDefaultTimeRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    return { start, end };
  }

  private limitErrorStorage(): void {
    if (this.errors.size > this.maxErrors) {
      // Remove oldest errors
      const sortedErrors = Array.from(this.errors.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = sortedErrors.slice(0, Math.floor(this.maxErrors * 0.1));
      toRemove.forEach(([fingerprint]) => {
        this.errors.delete(fingerprint);
      });
    }
  }

  private initializeMetrics(): SystemMetrics {
    return {
      uptime: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      performanceMetrics: { avgResponseTime: 0, errorRate: 0, throughput: 0 },
      networkMetrics: { latency: 0, bandwidth: 'unknown', connectionType: 'unknown' }
    };
  }
}

/**
 * Vue 3 Composable
 */
export function useErrorMonitoring() {
  const system = reactive(new ErrorMonitoringSystem());
  const isMonitoring = ref(false);
  const systemHealth = ref(system.getSystemHealth());

  const captureError = (error: Error, context?: any) => {
    return system.captureError(error, context);
  };

  const addBreadcrumb = (breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) => {
    system.addBreadcrumb(breadcrumb);
  };

  const startMonitoring = () => {
    system.startMonitoring();
    isMonitoring.value = true;
    
    // Update health status periodically
    const updateHealth = () => {
      systemHealth.value = system.getSystemHealth();
    };
    
    const interval = setInterval(updateHealth, 30000);
    updateHealth();

    return () => {
      clearInterval(interval);
      system.stopMonitoring();
      isMonitoring.value = false;
    };
  };

  const getAnalytics = (timeRange?: { start: Date; end: Date }) => {
    return system.getErrorAnalytics(timeRange);
  };

  const exportErrors = (format: 'json' | 'csv', timeRange?: { start: Date; end: Date }) => {
    return system.exportErrors(format, timeRange);
  };

  const subscribeToAlerts = (callback: (alert: any) => void) => {
    system.subscribeToAlerts(callback);
  };

  const resolveError = (errorId: string, resolution: string) => {
    return system.resolveError(errorId, resolution);
  };

  const getErrorDetails = (errorId: string) => {
    return system.getErrorDetails(errorId);
  };

  const errorAnalytics = computed(() => system.getErrorAnalytics());

  return {
    captureError,
    addBreadcrumb,
    startMonitoring,
    getAnalytics,
    exportErrors,
    subscribeToAlerts,
    resolveError,
    getErrorDetails,
    isMonitoring: readonly(isMonitoring),
    systemHealth: readonly(systemHealth),
    errorAnalytics
  };
}