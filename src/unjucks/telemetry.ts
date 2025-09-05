/**
 * Unjucks Telemetry - Performance monitoring and optimization
 * 20/80 Dark Matter Features - Production v1.0.0
 */

import { performance } from 'node:perf_hooks';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'pathe';

export interface MetricEvent {
  type: 'template_render' | 'ontology_load' | 'file_write' | 'cache_hit' | 'cache_miss' | 
        'template_discover' | 'template_validate' | 'stream_render' | 'parallel_process' |
        'context_sanitize' | 'path_resolve' | 'extension_call';
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  totalDuration: number;
  templateRenders: number;
  averageRenderTime: number;
  cacheHitRate: number;
  fileWrites: number;
  memoryUsage: NodeJS.MemoryUsage;
  errors: number;
  templatesDiscovered: number;
  templatesValidated: number;
  streamingRenders: number;
  parallelProcesses: number;
  contextSanitizations: number;
  pathResolutions: number;
  extensionCalls: number;
  throughputPerSecond: number;
}

export class TelemetryCollector extends EventEmitter {
  // Add method to get metrics by type
  getMetricsByType(type: MetricEvent['type']): MetricEvent[] {
    return this.metrics.filter(m => m.type === type);
  }
  
  // Add method to get average duration by type
  getAverageDurationByType(type: MetricEvent['type']): number {
    const metrics = this.getMetricsByType(type);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  }
  
  // Add method to clear metrics
  clearMetrics(): void {
    this.metrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.errors = [];
  }

  private metrics: MetricEvent[] = [];
  private startTime: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private errors: Error[] = [];

  start(): void {
    this.startTime = performance.now();
    this.metrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.errors = [];
  }

  record(type: MetricEvent['type'], duration: number, metadata?: any): void {
    const event: MetricEvent = {
      type,
      duration,
      timestamp: Date.now(),
      metadata
    };
    
    this.metrics.push(event);
    this.emit('metric', event);
    
    // Track cache metrics
    if (type === 'cache_hit') this.cacheHits++;
    if (type === 'cache_miss') this.cacheMisses++;
  }

  recordError(error: Error): void {
    this.errors.push(error);
    this.emit('error', error);
  }

  async measure<T>(
    type: MetricEvent['type'],
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.record(type, performance.now() - start, metadata);
      return result;
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  getReport(): PerformanceReport {
    const totalDuration = performance.now() - this.startTime;
    const renderMetrics = this.metrics.filter(m => m.type === 'template_render');
    const totalSeconds = totalDuration / 1000;
    
    return {
      totalDuration,
      templateRenders: renderMetrics.length,
      averageRenderTime: renderMetrics.length > 0 
        ? renderMetrics.reduce((sum, m) => sum + m.duration, 0) / renderMetrics.length
        : 0,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0
        ? this.cacheHits / (this.cacheHits + this.cacheMisses)
        : 0,
      fileWrites: this.metrics.filter(m => m.type === 'file_write').length,
      memoryUsage: process.memoryUsage(),
      errors: this.errors.length,
      templatesDiscovered: this.metrics.filter(m => m.type === 'template_discover').length,
      templatesValidated: this.metrics.filter(m => m.type === 'template_validate').length,
      streamingRenders: this.metrics.filter(m => m.type === 'stream_render').length,
      parallelProcesses: this.metrics.filter(m => m.type === 'parallel_process').length,
      contextSanitizations: this.metrics.filter(m => m.type === 'context_sanitize').length,
      pathResolutions: this.metrics.filter(m => m.type === 'path_resolve').length,
      extensionCalls: this.metrics.filter(m => m.type === 'extension_call').length,
      throughputPerSecond: totalSeconds > 0 ? this.metrics.length / totalSeconds : 0
    };
  }

  async exportReport(path: string): Promise<void> {
    const report = {
      ...this.getReport(),
      metrics: this.metrics,
      errors: this.errors.map(e => ({
        message: e.message,
        stack: e.stack
      }))
    };
    
    await writeFile(
      resolve(path),
      JSON.stringify(report, null, 2)
    );
  }

  // Enhanced optimization hints based on comprehensive metrics
  getOptimizationHints(): string[] {
    const hints: string[] = [];
    const report = this.getReport();
    
    // Cache optimization
    if (report.cacheHitRate < 0.3) {
      hints.push('Very low cache hit rate (<30%). Enable caching and consider cache warming.');
    } else if (report.cacheHitRate < 0.6) {
      hints.push('Low cache hit rate (<60%). Consider enabling persistent caching.');
    }
    
    // Performance optimization
    if (report.averageRenderTime > 500) {
      hints.push('Very slow template rendering (>500ms). Consider streaming or parallel processing.');
    } else if (report.averageRenderTime > 100) {
      hints.push('Slow template rendering (>100ms). Consider simplifying templates.');
    }
    
    // Memory optimization
    const memoryMB = report.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB > 1024) {
      hints.push('High memory usage (>1GB). Consider streaming large templates or reducing context size.');
    } else if (memoryMB > 512) {
      hints.push('Moderate memory usage (>512MB). Monitor for memory leaks.');
    }
    
    // Throughput optimization
    if (report.throughputPerSecond < 1 && report.templateRenders > 10) {
      hints.push('Low throughput (<1 op/s). Consider parallel processing or optimization.');
    }
    
    // Streaming recommendation
    if (report.templateRenders > 100 && report.streamingRenders === 0) {
      hints.push('Consider using streaming for large batch operations.');
    }
    
    // Parallel processing recommendation
    if (report.templateRenders > 50 && report.parallelProcesses === 0) {
      hints.push('Consider enabling parallel processing for better performance.');
    }
    
    // Error handling
    if (report.errors > 0) {
      const errorRate = report.errors / report.templateRenders;
      if (errorRate > 0.1) {
        hints.push(`High error rate (${(errorRate * 100).toFixed(1)}%). Review template validation.`);
      } else {
        hints.push(`${report.errors} errors occurred. Check error logs for details.`);
      }
    }
    
    // Context sanitization overhead
    if (report.contextSanitizations > report.templateRenders * 2) {
      hints.push('High context sanitization overhead. Review context complexity.');
    }
    
    // Path resolution overhead
    if (report.pathResolutions > report.templateRenders * 3) {
      hints.push('High path resolution overhead. Consider caching resolved paths.');
    }
    
    return hints;
  }
}

/**
 * Performance monitor with automatic optimization suggestions
 */
export class PerformanceMonitor {
  private collector: TelemetryCollector;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds: {
    slowRender: number;
    highMemory: number;
    lowCacheRate: number;
    lowThroughput: number;
  };

  constructor(thresholds = {}) {
    this.collector = new TelemetryCollector();
    this.thresholds = {
      slowRender: 200,
      highMemory: 512 * 1024 * 1024,
      lowCacheRate: 0.5,
      lowThroughput: 5,
      ...thresholds
    };
  }

  start(): void {
    this.collector.start();
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  record(type: MetricEvent['type'], duration: number, metadata?: any): void {
    this.collector.record(type, duration, metadata);
    this.checkThresholds();
  }

  async measure<T>(
    type: MetricEvent['type'],
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    return this.collector.measure(type, fn, metadata);
  }

  getReport(): PerformanceReport {
    return this.collector.getReport();
  }

  getOptimizationHints(): string[] {
    return this.collector.getOptimizationHints();
  }

  async exportReport(path: string): Promise<void> {
    return this.collector.exportReport(path);
  }

  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) return;
    
    this.monitoringInterval = setInterval(() => {
      const report = this.getReport();
      const hints = this.getOptimizationHints();
      
      if (hints.length > 0) {
        console.warn('[PERFORMANCE] Optimization suggestions:', hints);
      }
    }, intervalMs);
  }

  private checkThresholds(): void {
    const report = this.getReport();
    
    // Real-time threshold checking
    if (report.averageRenderTime > this.thresholds.slowRender) {
      this.collector.emit('threshold:slowRender', report);
    }
    
    if (report.memoryUsage.heapUsed > this.thresholds.highMemory) {
      this.collector.emit('threshold:highMemory', report);
    }
    
    if (report.cacheHitRate < this.thresholds.lowCacheRate && report.templateRenders > 10) {
      this.collector.emit('threshold:lowCacheRate', report);
    }
    
    if (report.throughputPerSecond < this.thresholds.lowThroughput && report.templateRenders > 20) {
      this.collector.emit('threshold:lowThroughput', report);
    }
  }
}

// Global telemetry instances
export const telemetry = new TelemetryCollector();
export const performanceMonitor = new PerformanceMonitor();

// Auto-start performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.startMonitoring(60000); // Check every minute
}