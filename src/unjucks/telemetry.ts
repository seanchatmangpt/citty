/**
 * Unjucks Telemetry - Performance monitoring and optimization
 * 20/80 Dark Matter Features - Production v1.0.0
 */

import { performance } from 'node:perf_hooks';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'pathe';

export interface MetricEvent {
  type: 'template_render' | 'ontology_load' | 'file_write' | 'cache_hit' | 'cache_miss';
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
}

export class TelemetryCollector extends EventEmitter {
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
      errors: this.errors.length
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

  // Optimization hints based on metrics
  getOptimizationHints(): string[] {
    const hints: string[] = [];
    const report = this.getReport();
    
    if (report.cacheHitRate < 0.5) {
      hints.push('Low cache hit rate. Consider enabling persistent caching.');
    }
    
    if (report.averageRenderTime > 100) {
      hints.push('Slow template rendering. Consider simplifying templates or enabling parallel processing.');
    }
    
    if (report.memoryUsage.heapUsed > 500 * 1024 * 1024) {
      hints.push('High memory usage. Consider streaming large templates or reducing context size.');
    }
    
    if (report.errors > 0) {
      hints.push(`${report.errors} errors occurred. Check error logs for details.`);
    }
    
    return hints;
  }
}

// Global telemetry instance
export const telemetry = new TelemetryCollector();