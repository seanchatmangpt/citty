import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface ResourceUsage {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric>;
  private resourceHistory: ResourceUsage[];
  private startBaseline: NodeJS.CpuUsage;
  private monitoringInterval: NodeJS.Timeout | null;
  private alertThresholds: {
    memoryMB: number;
    cpuPercent: number;
    durationMs: number;
  };

  constructor(options: {
    historySize?: number;
    monitoringIntervalMs?: number;
    alertThresholds?: {
      memoryMB?: number;
      cpuPercent?: number;
      durationMs?: number;
    };
  } = {}) {
    super();
    
    this.metrics = new Map();
    this.resourceHistory = [];
    this.startBaseline = process.cpuUsage();
    this.monitoringInterval = null;
    
    this.alertThresholds = {
      memoryMB: options.alertThresholds?.memoryMB || 500,
      cpuPercent: options.alertThresholds?.cpuPercent || 80,
      durationMs: options.alertThresholds?.durationMs || 10000,
    };
    
    // Start resource monitoring
    if (options.monitoringIntervalMs !== 0) {
      this.startResourceMonitoring(options.monitoringIntervalMs || 1000);
    }
  }

  startTimer(name: string, metadata?: Record<string, any>): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.set(id, {
      name,
      startTime: performance.now(),
      metadata,
    });
    
    this.emit('timer:started', { id, name, metadata });
    return id;
  }

  endTimer(id: string): PerformanceMetric | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      return null;
    }
    
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    this.emit('timer:ended', metric);
    
    // Check for performance alerts
    this.checkPerformanceAlerts(metric);
    
    return metric;
  }

  measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const id = this.startTimer(name, metadata);
    
    return fn()
      .finally(() => {
        this.endTimer(id);
      });
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.startTimer(name, metadata);
    
    try {
      return fn();
    } finally {
      this.endTimer(id);
    }
  }

  private startResourceMonitoring(intervalMs: number): void {
    this.monitoringInterval = setInterval(() => {
      this.captureResourceUsage();
    }, intervalMs);
  }

  private captureResourceUsage(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.startBaseline);
    
    const usage: ResourceUsage = {
      memoryUsage,
      cpuUsage,
      timestamp: Date.now(),
    };
    
    this.resourceHistory.push(usage);
    
    // Keep only recent history (default: 100 samples)
    if (this.resourceHistory.length > 100) {
      this.resourceHistory.shift();
    }
    
    this.emit('resource:captured', usage);
    
    // Check for resource alerts
    this.checkResourceAlerts(usage);
  }

  private checkPerformanceAlerts(metric: PerformanceMetric): void {
    if (metric.duration && metric.duration > this.alertThresholds.durationMs) {
      this.emit('alert:performance', {
        type: 'slow_operation',
        metric,
        threshold: this.alertThresholds.durationMs,
      });
    }
  }

  private checkResourceAlerts(usage: ResourceUsage): void {
    // Memory alert
    const memoryMB = usage.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryMB > this.alertThresholds.memoryMB) {
      this.emit('alert:resource', {
        type: 'high_memory',
        usage,
        value: memoryMB,
        threshold: this.alertThresholds.memoryMB,
      });
    }
    
    // CPU alert (simplified calculation)
    if (this.resourceHistory.length >= 2) {
      const previous = this.resourceHistory[this.resourceHistory.length - 2];
      const timeDiff = usage.timestamp - previous.timestamp;
      const cpuDiff = {
        user: usage.cpuUsage.user - previous.cpuUsage.user,
        system: usage.cpuUsage.system - previous.cpuUsage.system,
      };
      
      const cpuPercent = ((cpuDiff.user + cpuDiff.system) / (timeDiff * 1000)) * 100;
      
      if (cpuPercent > this.alertThresholds.cpuPercent) {
        this.emit('alert:resource', {
          type: 'high_cpu',
          usage,
          value: cpuPercent,
          threshold: this.alertThresholds.cpuPercent,
        });
      }
    }
  }

  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.getMetrics().filter(metric => metric.name === name);
  }

  getAverageTime(name: string): number {
    const metrics = this.getMetricsByName(name).filter(m => m.duration);
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return total / metrics.length;
  }

  getResourceStats(): {
    current: ResourceUsage | null;
    peak: {
      memory: number;
      cpu: number;
    };
    average: {
      memory: number;
      cpu: number;
    };
  } {
    const current = this.resourceHistory[this.resourceHistory.length - 1] || null;
    
    if (this.resourceHistory.length === 0) {
      return {
        current,
        peak: { memory: 0, cpu: 0 },
        average: { memory: 0, cpu: 0 },
      };
    }
    
    let peakMemory = 0;
    let totalMemory = 0;
    let totalCpu = 0;
    
    for (let i = 0; i < this.resourceHistory.length; i++) {
      const usage = this.resourceHistory[i];
      const memoryMB = usage.memoryUsage.heapUsed / 1024 / 1024;
      
      peakMemory = Math.max(peakMemory, memoryMB);
      totalMemory += memoryMB;
      
      // Calculate CPU for this interval
      if (i > 0) {
        const previous = this.resourceHistory[i - 1];
        const timeDiff = usage.timestamp - previous.timestamp;
        const cpuDiff = {
          user: usage.cpuUsage.user - previous.cpuUsage.user,
          system: usage.cpuUsage.system - previous.cpuUsage.system,
        };
        
        const cpuPercent = ((cpuDiff.user + cpuDiff.system) / (timeDiff * 1000)) * 100;
        totalCpu += cpuPercent;
      }
    }
    
    return {
      current,
      peak: {
        memory: peakMemory,
        cpu: 0, // Peak CPU calculation is complex with intervals
      },
      average: {
        memory: totalMemory / this.resourceHistory.length,
        cpu: this.resourceHistory.length > 1 ? totalCpu / (this.resourceHistory.length - 1) : 0,
      },
    };
  }

  generateReport(): {
    summary: {
      totalOperations: number;
      totalDuration: number;
      averageDuration: number;
      operationsByName: Record<string, number>;
    };
    topSlowest: PerformanceMetric[];
    resources: ReturnType<typeof this.getResourceStats>;
    recommendations: string[];
  } {
    const metrics = this.getMetrics().filter(m => m.duration);
    const totalOperations = metrics.length;
    const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0;
    
    // Count operations by name
    const operationsByName: Record<string, number> = {};
    for (const metric of metrics) {
      operationsByName[metric.name] = (operationsByName[metric.name] || 0) + 1;
    }
    
    // Get top 10 slowest operations
    const topSlowest = metrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);
    
    const resources = this.getResourceStats();
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (averageDuration > 1000) {
      recommendations.push('Consider optimizing operations - average duration is high');
    }
    
    if (resources.peak.memory > 256) {
      recommendations.push('Memory usage is high - consider implementing memory-efficient algorithms');
    }
    
    if (topSlowest.length > 0 && topSlowest[0].duration! > 5000) {
      recommendations.push(`Slowest operation (${topSlowest[0].name}) takes ${topSlowest[0].duration!.toFixed(2)}ms`);
    }
    
    const templateOps = metrics.filter(m => m.name.includes('template'));
    if (templateOps.length > 0) {
      const avgTemplateTime = templateOps.reduce((sum, m) => sum + (m.duration || 0), 0) / templateOps.length;
      if (avgTemplateTime > 100) {
        recommendations.push('Template rendering is slow - consider caching or optimization');
      }
    }
    
    return {
      summary: {
        totalOperations,
        totalDuration,
        averageDuration,
        operationsByName,
      },
      topSlowest,
      resources,
      recommendations,
    };
  }

  reset(): void {
    this.metrics.clear();
    this.resourceHistory.length = 0;
    this.startBaseline = process.cpuUsage();
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Utility methods for specific pipeline operations
  
  measureOntologyLoad = (sourcePath: string) => {
    return this.startTimer('ontology:load', { source: sourcePath });
  };

  measureTemplateRender = (templatePath: string) => {
    return this.startTimer('template:render', { template: templatePath });
  };

  measureContextBuild = (ontologyCount: number) => {
    return this.startTimer('context:build', { ontologies: ontologyCount });
  };

  measureFileWrite = (outputPath: string) => {
    return this.startTimer('file:write', { output: outputPath });
  };

  measureValidation = (type: string) => {
    return this.startTimer('validation', { type });
  };

  // Batch timing for multiple operations
  startBatch(name: string): string {
    return this.startTimer(`batch:${name}`);
  }

  endBatch(id: string, itemCount: number): PerformanceMetric | null {
    const metric = this.endTimer(id);
    if (metric && metric.metadata) {
      metric.metadata.itemCount = itemCount;
      metric.metadata.averagePerItem = metric.duration ? metric.duration / itemCount : 0;
    }
    return metric;
  }

  // Record specific operation results
  recordOntologyLoad(sourcePath: string, durationMs: number, success: boolean = true): void {
    const metric: PerformanceMetric = {
      name: 'ontology:load',
      startTime: performance.now() - durationMs,
      endTime: performance.now(),
      duration: durationMs,
      metadata: {
        source: sourcePath,
        success,
        timestamp: new Date().toISOString()
      }
    };

    const id = `ontology-load-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('ontology:loaded', metric);
    
    if (!success) {
      this.emit('alert:ontology_load_failed', { metric, source: sourcePath });
    }
  }

  recordTemplateRender(templatePath: string, durationMs: number, success: boolean = true): void {
    const metric: PerformanceMetric = {
      name: 'template:render',
      startTime: performance.now() - durationMs,
      endTime: performance.now(),
      duration: durationMs,
      metadata: {
        template: templatePath,
        success,
        timestamp: new Date().toISOString()
      }
    };

    const id = `template-render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('template:rendered', metric);
    
    if (!success) {
      this.emit('alert:template_render_failed', { metric, template: templatePath });
    }
  }

  recordFileWrite(outputPath: string, durationMs: number, success: boolean = true): void {
    const metric: PerformanceMetric = {
      name: 'file:write',
      startTime: performance.now() - durationMs,
      endTime: performance.now(),
      duration: durationMs,
      metadata: {
        output: outputPath,
        success,
        timestamp: new Date().toISOString()
      }
    };

    const id = `file-write-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('file:written', metric);
    
    if (!success) {
      this.emit('alert:file_write_failed', { metric, output: outputPath });
    }
  }

  // Cache-related metrics
  recordCacheHit(key: string, type: string): void {
    const metric: PerformanceMetric = {
      name: 'cache:hit',
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      metadata: {
        key,
        type,
        timestamp: new Date().toISOString()
      }
    };

    const id = `cache-hit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('cache:hit', metric);
  }

  recordCacheMiss(key: string, type: string): void {
    const metric: PerformanceMetric = {
      name: 'cache:miss',
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      metadata: {
        key,
        type,
        timestamp: new Date().toISOString()
      }
    };

    const id = `cache-miss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('cache:miss', metric);
  }

  recordValidation(type: string, success: boolean, errorCount: number = 0): void {
    const metric: PerformanceMetric = {
      name: 'validation',
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      metadata: {
        type,
        success,
        errorCount,
        timestamp: new Date().toISOString()
      }
    };

    const id = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(id, metric);
    
    this.emit('validation:completed', metric);
    
    if (!success) {
      this.emit('alert:validation_failed', { metric, type, errorCount });
    }
  }

  // Job and workflow metrics
  recordJobStart(jobId: string, jobType: string): void {
    const metric: PerformanceMetric = {
      name: 'job:start',
      startTime: performance.now(),
      metadata: {
        jobId,
        jobType,
        timestamp: new Date().toISOString()
      }
    };

    this.metrics.set(`job-${jobId}`, metric);
    this.emit('job:started', metric);
  }

  recordJobEnd(jobId: string, success: boolean): void {
    const metric = this.metrics.get(`job-${jobId}`);
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      if (metric.metadata) {
        metric.metadata.success = success;
        metric.metadata.endTimestamp = new Date().toISOString();
      }
      
      this.emit('job:completed', metric);
      
      if (!success) {
        this.emit('alert:job_failed', { metric, jobId });
      }
    }
  }
}