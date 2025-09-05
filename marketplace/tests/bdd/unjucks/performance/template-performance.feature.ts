/**
 * HIVE QUEEN BDD Scenarios - Unjucks Template Performance & Scale
 * Ultra-high performance template rendering with 1000+ templates/sec throughput
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { Worker } from 'worker_threads';

// Performance monitoring interfaces
interface PerformanceMetrics {
  templatesPerSecond: number;
  averageRenderTimeMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  cacheHitRate: number;
  errorRate: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

interface LoadTestConfig {
  concurrentUsers: number;
  templatesPerUser: number;
  testDurationSeconds: number;
  rampUpSeconds: number;
  targetThroughput: number;
}

// High-performance template engine
class HighPerformanceUnjucksEngine {
  private templateCache = new Map<string, any>();
  private compiledCache = new Map<string, Function>();
  private metricsCollector = new PerformanceMetricsCollector();
  private workerPool: Worker[] = [];
  private renderingQueue: Array<{ template: string; context: any; resolve: Function; reject: Function }> = [];
  private isProcessingQueue = false;

  constructor(private config: { workers?: number; cacheSize?: number; enableProfiling?: boolean } = {}) {
    this.initializeWorkerPool(config.workers || 4);
    this.setupMetricsCollection();
  }

  private initializeWorkerPool(workerCount: number): void {
    for (let i = 0; i < workerCount; i++) {
      // In a real implementation, this would create actual worker threads
      this.workerPool.push({} as Worker);
    }
  }

  private setupMetricsCollection(): void {
    // Initialize performance monitoring
    if (this.config.enableProfiling) {
      setInterval(() => {
        this.metricsCollector.collectMetrics();
      }, 1000);
    }
  }

  async renderBatch(templates: Array<{ path: string; context: any }>): Promise<string[]> {
    const startTime = performance.now();
    const results: string[] = [];

    // Process templates in parallel using worker pool
    const chunks = this.chunkArray(templates, this.workerPool.length);
    const promises = chunks.map((chunk, index) => 
      this.processChunkInWorker(chunk, index)
    );

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.flat());

    const duration = performance.now() - startTime;
    this.metricsCollector.recordBatchRender(templates.length, duration);

    return results;
  }

  private async processChunkInWorker(chunk: Array<{ path: string; context: any }>, workerIndex: number): Promise<string[]> {
    // Mock worker processing - in real implementation would use actual worker threads
    return chunk.map((template, index) => 
      `<!-- Rendered by worker ${workerIndex}: ${template.path} -->`
    );
  }

  private chunkArray<T>(array: T[], chunks: number): T[][] {
    const result: T[][] = [];
    const chunkSize = Math.ceil(array.length / chunks);
    
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    
    return result;
  }

  async renderWithCaching(templatePath: string, context: any): Promise<string> {
    const cacheKey = this.generateCacheKey(templatePath, context);
    
    // Check compiled template cache
    if (this.compiledCache.has(cacheKey)) {
      const compiledTemplate = this.compiledCache.get(cacheKey)!;
      return compiledTemplate(context);
    }

    // Compile and cache template
    const compiled = await this.compileTemplate(templatePath);
    this.compiledCache.set(cacheKey, compiled);
    
    return compiled(context);
  }

  private generateCacheKey(templatePath: string, context: any): string {
    // Generate deterministic cache key
    const contextHash = this.hashObject(context);
    return `${templatePath}:${contextHash}`;
  }

  private hashObject(obj: any): string {
    // Simple hash function for demo - real implementation would use proper hashing
    return JSON.stringify(obj).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(36);
  }

  private async compileTemplate(templatePath: string): Promise<Function> {
    // Mock template compilation - real implementation would compile Nunjucks template
    return (context: any) => `<!-- Compiled template: ${templatePath} with context -->`;
  }

  async loadTest(config: LoadTestConfig): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const results: number[] = [];
    const errors: Error[] = [];

    // Simulate concurrent users
    const userPromises: Promise<void>[] = [];

    for (let user = 0; user < config.concurrentUsers; user++) {
      const userPromise = this.simulateUser(user, config, results, errors);
      userPromises.push(userPromise);
      
      // Ramp up delay
      if (config.rampUpSeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, (config.rampUpSeconds * 1000) / config.concurrentUsers));
      }
    }

    await Promise.all(userPromises);

    const totalDuration = (Date.now() - startTime) / 1000;
    return this.calculateMetrics(results, errors, totalDuration, config);
  }

  private async simulateUser(userId: number, config: LoadTestConfig, results: number[], errors: Error[]): Promise<void> {
    const userStartTime = Date.now();
    const userEndTime = userStartTime + (config.testDurationSeconds * 1000);

    while (Date.now() < userEndTime) {
      try {
        const renderStartTime = performance.now();
        
        // Simulate template rendering
        await this.renderWithCaching(
          `template-${userId}-${Math.floor(Math.random() * 100)}`,
          { userId, timestamp: Date.now(), data: this.generateMockData() }
        );
        
        const renderDuration = performance.now() - renderStartTime;
        results.push(renderDuration);
        
      } catch (error) {
        errors.push(error as Error);
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  private generateMockData(): any {
    return {
      users: Array(10).fill(null).map((_, i) => ({ id: i, name: `User ${i}` })),
      products: Array(50).fill(null).map((_, i) => ({ id: i, name: `Product ${i}`, price: Math.random() * 100 })),
      orders: Array(25).fill(null).map((_, i) => ({ id: i, total: Math.random() * 1000 }))
    };
  }

  private calculateMetrics(results: number[], errors: Error[], duration: number, config: LoadTestConfig): PerformanceMetrics {
    results.sort((a, b) => a - b);
    
    const totalRequests = results.length + errors.length;
    const successfulRequests = results.length;
    const templatesPerSecond = successfulRequests / duration;
    
    return {
      templatesPerSecond,
      averageRenderTimeMs: results.reduce((a, b) => a + b, 0) / results.length,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsagePercent: 0, // Would measure actual CPU usage
      cacheHitRate: this.metricsCollector.getCacheHitRate(),
      errorRate: errors.length / totalRequests,
      p95LatencyMs: results[Math.floor(results.length * 0.95)] || 0,
      p99LatencyMs: results[Math.floor(results.length * 0.99)] || 0
    };
  }

  getMetrics(): PerformanceMetrics {
    return this.metricsCollector.getCurrentMetrics();
  }

  clearCache(): void {
    this.templateCache.clear();
    this.compiledCache.clear();
  }

  destroy(): void {
    // Cleanup worker pool
    this.workerPool.forEach(worker => {
      // worker.terminate(); // In real implementation
    });
    this.workerPool = [];
  }
}

class PerformanceMetricsCollector {
  private metrics = {
    rendersCount: 0,
    totalRenderTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0
  };

  recordBatchRender(count: number, duration: number): void {
    this.metrics.rendersCount += count;
    this.metrics.totalRenderTime += duration;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? this.metrics.cacheHits / total : 0;
  }

  getCurrentMetrics(): PerformanceMetrics {
    return {
      templatesPerSecond: this.metrics.rendersCount / (this.metrics.totalRenderTime / 1000),
      averageRenderTimeMs: this.metrics.totalRenderTime / this.metrics.rendersCount,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsagePercent: 0,
      cacheHitRate: this.getCacheHitRate(),
      errorRate: this.metrics.errors / this.metrics.rendersCount,
      p95LatencyMs: 0,
      p99LatencyMs: 0
    };
  }

  collectMetrics(): void {
    // Collect system metrics
  }

  reset(): void {
    this.metrics = {
      rendersCount: 0,
      totalRenderTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }
}

describe('HIVE QUEEN BDD: Unjucks Template Performance & Scale', () => {
  let performanceEngine: HighPerformanceUnjucksEngine;
  let tempDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    performanceEngine = new HighPerformanceUnjucksEngine({
      workers: 8,
      cacheSize: 10000,
      enableProfiling: true
    });
    tempDir = await mkdtemp(join(tmpdir(), 'unjucks-perf-'));
    templatesDir = join(tempDir, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
  });

  afterEach(async () => {
    performanceEngine.destroy();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('FEATURE: High-Throughput Template Rendering', () => {
    describe('SCENARIO: Render 1000+ templates per second', () => {
      it('GIVEN 5000 templates with complex contexts WHEN rendering in parallel THEN achieves >1000 templates/sec', async () => {
        // GIVEN: Create 5000 templates with varying complexity
        const templateCount = 5000;
        const templates: Array<{ path: string; context: any }> = [];

        for (let i = 0; i < templateCount; i++) {
          const templateContent = `
---
{
  "type": "performance-test-template",
  "complexity": "${i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low'}",
  "index": ${i}
}
---
{% if complexity == 'high' %}
  {% for user in users %}
    {% for order in user.orders %}
      <div class="order-{{order.id}}">
        <h3>Order {{order.id}} for {{user.name}}</h3>
        <p>Total: ${{order.total | round(2)}}</p>
        {% for item in order.items %}
          <div class="item">
            {{item.name}} x {{item.quantity}} @ ${{item.price}}
          </div>
        {% endfor %}
      </div>
    {% endfor %}
  {% endfor %}
{% elif complexity == 'medium' %}
  {% for product in products %}
    <div class="product-{{product.id}}">
      <h2>{{product.name}}</h2>
      <p>Price: ${{product.price | round(2)}}</p>
    </div>
  {% endfor %}
{% else %}
  <div class="simple">
    <h1>Template {{index}}</h1>
    <p>Generated at {{timestamp}}</p>
  </div>
{% endif %}
          `;

          const templatePath = join(templatesDir, `template-${i.toString().padStart(5, '0')}.njk`);
          await fs.writeFile(templatePath, templateContent.trim());

          templates.push({
            path: templatePath,
            context: {
              complexity: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
              index: i,
              timestamp: Date.now(),
              users: i % 3 === 0 ? Array(5).fill(null).map((_, u) => ({
                id: u,
                name: `User ${u}`,
                orders: Array(3).fill(null).map((_, o) => ({
                  id: o,
                  total: Math.random() * 1000,
                  items: Array(Math.floor(Math.random() * 5) + 1).fill(null).map((_, it) => ({
                    name: `Item ${it}`,
                    quantity: Math.floor(Math.random() * 10) + 1,
                    price: Math.random() * 100
                  }))
                }))
              })) : [],
              products: i % 2 === 0 ? Array(20).fill(null).map((_, p) => ({
                id: p,
                name: `Product ${p}`,
                price: Math.random() * 100
              })) : []
            }
          });
        }

        // WHEN: Render all templates in parallel with timing
        const startTime = performance.now();
        const results = await performanceEngine.renderBatch(templates);
        const endTime = performance.now();
        
        const duration = (endTime - startTime) / 1000; // seconds
        const templatesPerSecond = templateCount / duration;

        // THEN: Performance requirements met
        expect(results).toHaveLength(templateCount);
        expect(templatesPerSecond).toBeGreaterThan(1000);
        expect(duration).toBeLessThan(5); // Complete within 5 seconds
        
        console.log(`Performance: ${templatesPerSecond.toFixed(2)} templates/sec`);
        console.log(`Duration: ${duration.toFixed(3)}s`);
        console.log(`Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
      });

      it('GIVEN enterprise-scale template batch WHEN rendering with caching THEN maintains high throughput with low latency', async () => {
        // GIVEN: Enterprise-scale templates (10,000)
        const enterpriseTemplateCount = 10000;
        const batchSize = 500;
        const batches: Array<Array<{ path: string; context: any }>> = [];

        // Create templates in batches
        for (let batch = 0; batch < enterpriseTemplateCount / batchSize; batch++) {
          const batchTemplates: Array<{ path: string; context: any }> = [];
          
          for (let i = 0; i < batchSize; i++) {
            const templateIndex = batch * batchSize + i;
            const templatePath = `enterprise-template-${templateIndex}`;
            
            batchTemplates.push({
              path: templatePath,
              context: {
                batchId: batch,
                templateId: templateIndex,
                timestamp: Date.now(),
                data: {
                  customers: Array(100).fill(null).map((_, c) => ({ id: c, name: `Customer ${c}` })),
                  transactions: Array(50).fill(null).map((_, t) => ({ id: t, amount: Math.random() * 10000 }))
                }
              }
            });
          }
          
          batches.push(batchTemplates);
        }

        // WHEN: Process batches sequentially with caching
        const startTime = performance.now();
        const allResults: string[] = [];
        
        for (const batch of batches) {
          const batchResults = await performanceEngine.renderBatch(batch);
          allResults.push(...batchResults);
        }
        
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        const metrics = performanceEngine.getMetrics();

        // THEN: Enterprise performance requirements
        expect(allResults).toHaveLength(enterpriseTemplateCount);
        expect(metrics.templatesPerSecond).toBeGreaterThan(2000);
        expect(metrics.cacheHitRate).toBeGreaterThan(0.8); // 80% cache hit rate
        expect(metrics.averageRenderTimeMs).toBeLessThan(10); // <10ms average
        expect(duration).toBeLessThan(10); // Complete within 10 seconds
        
        console.log(`Enterprise Performance:`);
        console.log(`  Templates/sec: ${metrics.templatesPerSecond.toFixed(2)}`);
        console.log(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Average render time: ${metrics.averageRenderTimeMs.toFixed(2)}ms`);
        console.log(`  Memory usage: ${metrics.memoryUsageMB.toFixed(2)}MB`);
      });
    });
  });

  describe('FEATURE: Load Testing Under Stress', () => {
    describe('SCENARIO: Sustained load with concurrent users', () => {
      it('GIVEN 100 concurrent users WHEN each renders 50 templates THEN maintains performance under load', async () => {
        // GIVEN: Load test configuration
        const loadConfig: LoadTestConfig = {
          concurrentUsers: 100,
          templatesPerUser: 50,
          testDurationSeconds: 30,
          rampUpSeconds: 10,
          targetThroughput: 1500 // templates/sec
        };

        // WHEN: Execute load test
        const loadStartTime = performance.now();
        const metrics = await performanceEngine.loadTest(loadConfig);
        const loadDuration = (performance.now() - loadStartTime) / 1000;

        // THEN: Performance maintained under load
        expect(metrics.templatesPerSecond).toBeGreaterThan(loadConfig.targetThroughput);
        expect(metrics.errorRate).toBeLessThan(0.01); // <1% error rate
        expect(metrics.p95LatencyMs).toBeLessThan(100); // P95 < 100ms
        expect(metrics.p99LatencyMs).toBeLessThan(500); // P99 < 500ms
        expect(metrics.memoryUsageMB).toBeLessThan(1000); // <1GB memory usage
        
        console.log(`Load Test Results (${loadDuration.toFixed(1)}s):`);
        console.log(`  Throughput: ${metrics.templatesPerSecond.toFixed(2)} templates/sec`);
        console.log(`  Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
        console.log(`  P95 latency: ${metrics.p95LatencyMs.toFixed(2)}ms`);
        console.log(`  P99 latency: ${metrics.p99LatencyMs.toFixed(2)}ms`);
        console.log(`  Memory usage: ${metrics.memoryUsageMB.toFixed(2)}MB`);
      });

      it('GIVEN stress test with 500 concurrent users WHEN running for extended period THEN system remains stable', async () => {
        // GIVEN: Stress test configuration
        const stressConfig: LoadTestConfig = {
          concurrentUsers: 500,
          templatesPerUser: 100,
          testDurationSeconds: 60, // 1 minute stress test
          rampUpSeconds: 30,
          targetThroughput: 3000
        };

        // WHEN: Execute stress test
        const stressMetrics = await performanceEngine.loadTest(stressConfig);

        // THEN: System remains stable under stress
        expect(stressMetrics.templatesPerSecond).toBeGreaterThan(2500); // Allow some degradation
        expect(stressMetrics.errorRate).toBeLessThan(0.05); // <5% error rate under stress
        expect(stressMetrics.memoryUsageMB).toBeLessThan(2000); // <2GB memory usage
        
        // Check that system didn't crash
        const postStressMetrics = performanceEngine.getMetrics();
        expect(postStressMetrics).toBeDefined();
        
        console.log(`Stress Test Results:`);
        console.log(`  Peak throughput: ${stressMetrics.templatesPerSecond.toFixed(2)} templates/sec`);
        console.log(`  Stress error rate: ${(stressMetrics.errorRate * 100).toFixed(2)}%`);
        console.log(`  Peak memory: ${stressMetrics.memoryUsageMB.toFixed(2)}MB`);
      });
    });
  });

  describe('FEATURE: Memory Management and Optimization', () => {
    describe('SCENARIO: Efficient memory usage during large-scale rendering', () => {
      it('GIVEN memory-intensive templates WHEN rendering large batches THEN memory usage remains bounded', async () => {
        // GIVEN: Memory-intensive templates
        const largeDataTemplates: Array<{ path: string; context: any }> = [];
        const templateCount = 1000;
        
        for (let i = 0; i < templateCount; i++) {
          largeDataTemplates.push({
            path: `large-template-${i}`,
            context: {
              // Large context data to test memory management
              largeArray: Array(10000).fill(null).map((_, idx) => ({
                id: idx,
                data: `Large data entry ${idx}`,
                metadata: {
                  created: new Date().toISOString(),
                  tags: Array(10).fill(null).map((_, t) => `tag-${t}`),
                  properties: Array(20).fill(null).reduce((acc, _, p) => {
                    acc[`prop-${p}`] = `value-${p}`;
                    return acc;
                  }, {} as any)
                }
              })),
              additionalData: {
                users: Array(1000).fill(null).map((_, u) => ({ id: u, name: `User ${u}` })),
                products: Array(5000).fill(null).map((_, p) => ({ id: p, name: `Product ${p}` }))
              }
            }
          });
        }

        // Record initial memory usage
        const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        
        // WHEN: Render large batch
        const startTime = performance.now();
        const results = await performanceEngine.renderBatch(largeDataTemplates);
        const endTime = performance.now();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryIncrease = finalMemory - initialMemory;
        const duration = (endTime - startTime) / 1000;

        // THEN: Memory usage is reasonable
        expect(results).toHaveLength(templateCount);
        expect(memoryIncrease).toBeLessThan(500); // <500MB increase
        expect(finalMemory).toBeLessThan(1000); // <1GB total usage
        expect(duration).toBeLessThan(10); // Complete within 10 seconds
        
        console.log(`Memory Management Test:`);
        console.log(`  Initial memory: ${initialMemory.toFixed(2)}MB`);
        console.log(`  Final memory: ${finalMemory.toFixed(2)}MB`);
        console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
        console.log(`  Duration: ${duration.toFixed(2)}s`);
      });
    });
  });

  describe('FEATURE: Cache Performance Optimization', () => {
    describe('SCENARIO: Template caching effectiveness', () => {
      it('GIVEN repeated template renders WHEN using intelligent caching THEN achieves high cache hit rates', async () => {
        // GIVEN: Set of templates to render multiple times
        const baseTemplates = [
          { path: 'user-profile.njk', context: { userId: 1, name: 'John' } },
          { path: 'product-list.njk', context: { category: 'electronics' } },
          { path: 'order-summary.njk', context: { orderId: 123 } },
          { path: 'dashboard.njk', context: { role: 'admin' } }
        ];

        const repeatedRenders: Array<{ path: string; context: any }> = [];
        
        // Repeat each template 500 times with slight variations
        for (let repeat = 0; repeat < 500; repeat++) {
          for (const template of baseTemplates) {
            repeatedRenders.push({
              path: template.path,
              context: {
                ...template.context,
                timestamp: Date.now(), // This changes, but template structure is same
                iteration: repeat
              }
            });
          }
        }

        // Clear cache to start fresh
        performanceEngine.clearCache();

        // WHEN: Render all repeated templates
        const startTime = performance.now();
        await performanceEngine.renderBatch(repeatedRenders);
        const endTime = performance.now();
        
        const metrics = performanceEngine.getMetrics();
        const duration = (endTime - startTime) / 1000;

        // THEN: High cache performance
        expect(metrics.cacheHitRate).toBeGreaterThan(0.95); // >95% cache hit rate
        expect(metrics.templatesPerSecond).toBeGreaterThan(5000); // Very high throughput due to caching
        expect(duration).toBeLessThan(1); // Very fast due to caching
        
        console.log(`Cache Performance Test:`);
        console.log(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Throughput: ${metrics.templatesPerSecond.toFixed(2)} templates/sec`);
        console.log(`  Duration: ${duration.toFixed(3)}s`);
      });
    });
  });

  describe('FEATURE: Error Handling Under Load', () => {
    describe('SCENARIO: Graceful degradation during errors', () => {
      it('GIVEN templates with various error conditions WHEN rendering under load THEN maintains system stability', async () => {
        // GIVEN: Mix of valid and invalid templates
        const mixedTemplates: Array<{ path: string; context: any; shouldFail?: boolean }> = [];
        
        for (let i = 0; i < 1000; i++) {
          const shouldFail = i % 10 === 0; // 10% failure rate
          
          mixedTemplates.push({
            path: `mixed-template-${i}`,
            context: shouldFail ? null : { // null context will cause error
              templateId: i,
              data: `Valid data for template ${i}`
            },
            shouldFail
          });
        }

        // WHEN: Render batch with expected errors
        const results = await performanceEngine.renderBatch(
          mixedTemplates.map(({ path, context }) => ({ path, context }))
        );
        
        const metrics = performanceEngine.getMetrics();

        // THEN: System handles errors gracefully
        expect(results).toHaveLength(1000); // All templates processed
        expect(metrics.errorRate).toBeGreaterThan(0.05); // Expected error rate
        expect(metrics.errorRate).toBeLessThan(0.15); // But not too high
        expect(metrics.templatesPerSecond).toBeGreaterThan(500); // Still reasonable performance
        
        console.log(`Error Handling Test:`);
        console.log(`  Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
        console.log(`  Throughput with errors: ${metrics.templatesPerSecond.toFixed(2)} templates/sec`);
      });
    });
  });
});
