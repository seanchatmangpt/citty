import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { EventEmitter } from 'events';
import { UNJUCKS } from './index';
import { SemanticContext } from './types';

export interface BenchmarkConfig {
  name: string;
  description: string;
  iterations: number;
  warmupIterations: number;
  template: string;
  context: Record<string, any>;
  expectedOutput?: string;
  timeout: number; // milliseconds
  memory?: {
    maxHeapUsed: number;
    maxRSS: number;
  };
  category: 'rendering' | 'compilation' | 'memory' | 'concurrency' | 'integration';
  tags: string[];
}

export interface BenchmarkResult {
  name: string;
  category: string;
  success: boolean;
  iterations: number;
  timing: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput: {
    operationsPerSecond: number;
    templatesPerSecond: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    peakHeapUsed: number;
    peakRSS: number;
  };
  errors: string[];
  warnings: string[];
  metadata: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    totalMemory: number;
    timestamp: Date;
  };
}

export interface ComparisonResult {
  baseline: string;
  comparison: string;
  improvement: {
    timing: number; // percentage improvement (positive = better)
    throughput: number;
    memory: number;
  };
  significance: 'none' | 'minor' | 'moderate' | 'major';
  verdict: 'faster' | 'slower' | 'similar';
  details: {
    timingDiff: number;
    throughputDiff: number;
    memoryDiff: number;
  };
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: BenchmarkConfig[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface PerformanceProfile {
  templateSize: 'small' | 'medium' | 'large' | 'xlarge';
  complexity: 'simple' | 'moderate' | 'complex';
  dataSize: 'minimal' | 'typical' | 'large' | 'massive';
  expectedPerformance: {
    renderTimeMs: number;
    memoryUsageMB: number;
    throughputOpsPerSec: number;
  };
}

export class UnjucksPerformanceBenchmark extends EventEmitter {
  private results = new Map<string, BenchmarkResult>();
  private suites = new Map<string, BenchmarkSuite>();
  private profiles = new Map<string, PerformanceProfile>();
  private baselines = new Map<string, BenchmarkResult>();
  private running = false;

  constructor() {
    super();
    this.initializeDefaultSuites();
    this.initializePerformanceProfiles();
  }

  private initializeDefaultSuites(): void {
    // Basic rendering benchmark suite
    this.suites.set('basic-rendering', {
      name: 'Basic Rendering',
      description: 'Test basic template rendering performance',
      benchmarks: [
        {
          name: 'simple-variable',
          description: 'Render simple variable interpolation',
          iterations: 10000,
          warmupIterations: 1000,
          template: 'Hello {{ name }}!',
          context: { name: 'World' },
          expectedOutput: 'Hello World!',
          timeout: 5000,
          category: 'rendering',
          tags: ['basic', 'variable']
        },
        {
          name: 'multiple-variables',
          description: 'Render multiple variables',
          iterations: 5000,
          warmupIterations: 500,
          template: '{{ greeting }} {{ name }}, today is {{ day }}!',
          context: { greeting: 'Hello', name: 'Alice', day: 'Monday' },
          timeout: 5000,
          category: 'rendering',
          tags: ['basic', 'multiple-variables']
        },
        {
          name: 'simple-loop',
          description: 'Render simple for loop',
          iterations: 1000,
          warmupIterations: 100,
          template: '{% for item in items %}{{ item }}{% endfor %}',
          context: { items: ['a', 'b', 'c', 'd', 'e'] },
          timeout: 5000,
          category: 'rendering',
          tags: ['loops', 'basic']
        },
        {
          name: 'nested-loops',
          description: 'Render nested for loops',
          iterations: 100,
          warmupIterations: 10,
          template: '{% for group in groups %}{% for item in group.items %}{{ item }}{% endfor %}{% endfor %}',
          context: { 
            groups: Array(5).fill(null).map((_, i) => ({
              items: Array(10).fill(null).map((_, j) => `item-${i}-${j}`)
            }))
          },
          timeout: 10000,
          category: 'rendering',
          tags: ['loops', 'nested', 'complex']
        }
      ]
    });

    // Complex template suite
    this.suites.set('complex-templates', {
      name: 'Complex Templates',
      description: 'Test performance with complex template structures',
      benchmarks: [
        {
          name: 'dashboard-template',
          description: 'Complex dashboard with multiple sections',
          iterations: 100,
          warmupIterations: 10,
          template: `
            <!DOCTYPE html>
            <html>
            <head><title>{{ title }}</title></head>
            <body>
              <header>
                <h1>{{ dashboard.title }}</h1>
                <nav>
                  {% for item in navigation %}
                  <a href="{{ item.url }}">{{ item.title }}</a>
                  {% endfor %}
                </nav>
              </header>
              <main>
                {% for section in dashboard.sections %}
                <section id="{{ section.id }}">
                  <h2>{{ section.title }}</h2>
                  {% if section.type === 'chart' %}
                    <div class="chart">
                      {% for datapoint in section.data %}
                      <div class="bar" style="height: {{ datapoint.value }}%">
                        {{ datapoint.label }}
                      </div>
                      {% endfor %}
                    </div>
                  {% elif section.type === 'table' %}
                    <table>
                      <thead>
                        <tr>
                          {% for header in section.headers %}
                          <th>{{ header }}</th>
                          {% endfor %}
                        </tr>
                      </thead>
                      <tbody>
                        {% for row in section.rows %}
                        <tr>
                          {% for cell in row %}
                          <td>{{ cell }}</td>
                          {% endfor %}
                        </tr>
                        {% endfor %}
                      </tbody>
                    </table>
                  {% endif %}
                </section>
                {% endfor %}
              </main>
            </body>
            </html>
          `,
          context: {
            title: 'Performance Dashboard',
            dashboard: {
              title: 'System Metrics',
              sections: [
                {
                  id: 'cpu-usage',
                  title: 'CPU Usage',
                  type: 'chart',
                  data: Array(20).fill(null).map((_, i) => ({
                    label: `Hour ${i}`,
                    value: Math.random() * 100
                  }))
                },
                {
                  id: 'system-info',
                  title: 'System Information',
                  type: 'table',
                  headers: ['Property', 'Value', 'Status'],
                  rows: Array(15).fill(null).map((_, i) => [
                    `Property ${i}`,
                    `Value ${i}`,
                    i % 3 === 0 ? 'Good' : 'OK'
                  ])
                }
              ]
            },
            navigation: [
              { title: 'Dashboard', url: '/dashboard' },
              { title: 'Reports', url: '/reports' },
              { title: 'Settings', url: '/settings' }
            ]
          },
          timeout: 15000,
          category: 'rendering',
          tags: ['complex', 'html', 'dashboard']
        }
      ]
    });

    // Memory stress test suite
    this.suites.set('memory-stress', {
      name: 'Memory Stress Tests',
      description: 'Test memory usage with large datasets',
      benchmarks: [
        {
          name: 'large-array',
          description: 'Render large array (10k items)',
          iterations: 10,
          warmupIterations: 2,
          template: '{% for item in items %}{{ item.name }}: {{ item.value }}\\n{% endfor %}',
          context: {
            items: Array(10000).fill(null).map((_, i) => ({
              name: `Item ${i}`,
              value: Math.random() * 1000
            }))
          },
          timeout: 30000,
          memory: {
            maxHeapUsed: 500 * 1024 * 1024, // 500MB
            maxRSS: 1024 * 1024 * 1024 // 1GB
          },
          category: 'memory',
          tags: ['stress', 'large-data', 'memory']
        },
        {
          name: 'deep-nesting',
          description: 'Deep nested object rendering',
          iterations: 50,
          warmupIterations: 5,
          template: '{{ data.level1.level2.level3.level4.level5.value }}',
          context: this.generateDeepNestedData(10),
          timeout: 10000,
          category: 'memory',
          tags: ['nested', 'deep', 'object']
        }
      ]
    });

    // Concurrency suite
    this.suites.set('concurrency', {
      name: 'Concurrency Tests',
      description: 'Test performance under concurrent load',
      benchmarks: [
        {
          name: 'concurrent-rendering',
          description: 'Multiple concurrent template renders',
          iterations: 1000,
          warmupIterations: 100,
          template: 'Result: {{ compute(input) }}',
          context: { 
            input: 42,
            compute: (n: number) => n * n + Math.random() * 100
          },
          timeout: 15000,
          category: 'concurrency',
          tags: ['concurrent', 'parallel']
        }
      ]
    });
  }

  private generateDeepNestedData(depth: number): any {
    if (depth === 0) {
      return { value: 'deep value', items: Array(10).fill(null).map((_, i) => `item-${i}`) };
    }
    return {
      [`level${11-depth}`]: this.generateDeepNestedData(depth - 1),
      meta: `Level ${11-depth} metadata`
    };
  }

  private initializePerformanceProfiles(): void {
    this.profiles.set('simple-small', {
      templateSize: 'small',
      complexity: 'simple',
      dataSize: 'minimal',
      expectedPerformance: {
        renderTimeMs: 0.1,
        memoryUsageMB: 1,
        throughputOpsPerSec: 10000
      }
    });

    this.profiles.set('moderate-medium', {
      templateSize: 'medium',
      complexity: 'moderate',
      dataSize: 'typical',
      expectedPerformance: {
        renderTimeMs: 1,
        memoryUsageMB: 5,
        throughputOpsPerSec: 1000
      }
    });

    this.profiles.set('complex-large', {
      templateSize: 'large',
      complexity: 'complex',
      dataSize: 'large',
      expectedPerformance: {
        renderTimeMs: 10,
        memoryUsageMB: 20,
        throughputOpsPerSec: 100
      }
    });

    this.profiles.set('stress-xlarge', {
      templateSize: 'xlarge',
      complexity: 'complex',
      dataSize: 'massive',
      expectedPerformance: {
        renderTimeMs: 100,
        memoryUsageMB: 100,
        throughputOpsPerSec: 10
      }
    });
  }

  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    this.emit('benchmark:start', config.name);
    
    const result: BenchmarkResult = {
      name: config.name,
      category: config.category,
      success: false,
      iterations: 0,
      timing: {
        min: Infinity,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      },
      throughput: {
        operationsPerSecond: 0,
        templatesPerSecond: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        peakHeapUsed: 0,
        peakRSS: 0
      },
      errors: [],
      warnings: [],
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuModel: require('os').cpus()[0].model,
        totalMemory: require('os').totalmem(),
        timestamp: new Date()
      }
    };

    try {
      // Force garbage collection before benchmark
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      const times: number[] = [];
      let peakHeapUsed = initialMemory.heapUsed;
      let peakRSS = initialMemory.rss;

      // Compile template once
      const compiledTemplate = UNJUCKS.compile(config.template);

      // Warmup iterations
      for (let i = 0; i < config.warmupIterations; i++) {
        try {
          await compiledTemplate.render(config.context);
        } catch (error) {
          result.warnings.push(`Warmup iteration ${i} failed: ${error}`);
        }
      }

      // Clear any warmup memory issues
      if (global.gc) {
        global.gc();
      }

      // Main benchmark iterations
      for (let i = 0; i < config.iterations; i++) {
        const startTime = performance.now();
        
        try {
          const output = await compiledTemplate.render(config.context);
          
          if (config.expectedOutput && output !== config.expectedOutput) {
            result.warnings.push(`Output mismatch at iteration ${i}`);
          }
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          times.push(duration);
          
          // Update memory tracking
          const currentMemory = process.memoryUsage();
          peakHeapUsed = Math.max(peakHeapUsed, currentMemory.heapUsed);
          peakRSS = Math.max(peakRSS, currentMemory.rss);
          
          result.iterations++;
          
        } catch (error) {
          result.errors.push(`Iteration ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Check timeout
        if (Date.now() - result.metadata.timestamp.getTime() > config.timeout) {
          result.warnings.push('Benchmark timed out');
          break;
        }
      }

      // Calculate statistics
      if (times.length > 0) {
        times.sort((a, b) => a - b);
        
        result.timing.min = times[0];
        result.timing.max = times[times.length - 1];
        result.timing.mean = times.reduce((sum, time) => sum + time, 0) / times.length;
        result.timing.median = times[Math.floor(times.length / 2)];
        result.timing.p95 = times[Math.floor(times.length * 0.95)];
        result.timing.p99 = times[Math.floor(times.length * 0.99)];
        
        // Calculate standard deviation
        const variance = times.reduce((sum, time) => sum + Math.pow(time - result.timing.mean, 2), 0) / times.length;
        result.timing.stdDev = Math.sqrt(variance);
        
        // Calculate throughput
        const totalTimeSeconds = times.reduce((sum, time) => sum + time, 0) / 1000;
        result.throughput.operationsPerSecond = result.iterations / totalTimeSeconds;
        result.throughput.templatesPerSecond = result.iterations / totalTimeSeconds;
      }

      // Final memory measurement
      const finalMemory = process.memoryUsage();
      result.memory = {
        heapUsed: finalMemory.heapUsed,
        heapTotal: finalMemory.heapTotal,
        external: finalMemory.external,
        rss: finalMemory.rss,
        peakHeapUsed,
        peakRSS
      };

      // Check memory limits
      if (config.memory) {
        if (peakHeapUsed > config.memory.maxHeapUsed) {
          result.warnings.push(`Peak heap usage (${peakHeapUsed}) exceeded limit (${config.memory.maxHeapUsed})`);
        }
        if (peakRSS > config.memory.maxRSS) {
          result.warnings.push(`Peak RSS (${peakRSS}) exceeded limit (${config.memory.maxRSS})`);
        }
      }

      result.success = result.errors.length === 0 && result.iterations > 0;

    } catch (error) {
      result.errors.push(`Benchmark failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.results.set(config.name, result);
    this.emit('benchmark:complete', result);
    
    return result;
  }

  async runSuite(suiteName: string, options: {
    parallel?: boolean;
    filter?: (benchmark: BenchmarkConfig) => boolean;
  } = {}): Promise<BenchmarkResult[]> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Unknown benchmark suite: ${suiteName}`);
    }

    this.running = true;
    this.emit('suite:start', suiteName);

    try {
      if (suite.setup) {
        await suite.setup();
      }

      let benchmarks = suite.benchmarks;
      if (options.filter) {
        benchmarks = benchmarks.filter(options.filter);
      }

      const results: BenchmarkResult[] = [];

      if (options.parallel) {
        // Run benchmarks in parallel
        const promises = benchmarks.map(benchmark => this.runBenchmark(benchmark));
        results.push(...await Promise.all(promises));
      } else {
        // Run benchmarks sequentially
        for (const benchmark of benchmarks) {
          const result = await this.runBenchmark(benchmark);
          results.push(result);
          
          // Small delay between benchmarks to prevent interference
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (suite.teardown) {
        await suite.teardown();
      }

      return results;

    } finally {
      this.running = false;
      this.emit('suite:complete', suiteName);
    }
  }

  async runAllSuites(options: {
    parallel?: boolean;
    suiteFilter?: (suiteName: string) => boolean;
  } = {}): Promise<Map<string, BenchmarkResult[]>> {
    const results = new Map<string, BenchmarkResult[]>();
    
    let suiteNames = Array.from(this.suites.keys());
    if (options.suiteFilter) {
      suiteNames = suiteNames.filter(options.suiteFilter);
    }

    if (options.parallel) {
      const promises = suiteNames.map(async suiteName => {
        const suiteResults = await this.runSuite(suiteName, { parallel: false });
        return [suiteName, suiteResults] as const;
      });
      
      const allResults = await Promise.all(promises);
      allResults.forEach(([suiteName, suiteResults]) => {
        results.set(suiteName, suiteResults);
      });
    } else {
      for (const suiteName of suiteNames) {
        const suiteResults = await this.runSuite(suiteName);
        results.set(suiteName, suiteResults);
      }
    }

    return results;
  }

  compare(baselineName: string, comparisonName: string): ComparisonResult {
    const baseline = this.results.get(baselineName) || this.baselines.get(baselineName);
    const comparison = this.results.get(comparisonName);

    if (!baseline || !comparison) {
      throw new Error('Both baseline and comparison results must exist');
    }

    const timingImprovement = ((baseline.timing.mean - comparison.timing.mean) / baseline.timing.mean) * 100;
    const throughputImprovement = ((comparison.throughput.operationsPerSecond - baseline.throughput.operationsPerSecond) / baseline.throughput.operationsPerSecond) * 100;
    const memoryImprovement = ((baseline.memory.peakHeapUsed - comparison.memory.peakHeapUsed) / baseline.memory.peakHeapUsed) * 100;

    const overallImprovement = (timingImprovement + throughputImprovement + memoryImprovement) / 3;

    let significance: ComparisonResult['significance'];
    if (Math.abs(overallImprovement) < 5) significance = 'none';
    else if (Math.abs(overallImprovement) < 15) significance = 'minor';
    else if (Math.abs(overallImprovement) < 30) significance = 'moderate';
    else significance = 'major';

    let verdict: ComparisonResult['verdict'];
    if (overallImprovement > 5) verdict = 'faster';
    else if (overallImprovement < -5) verdict = 'slower';
    else verdict = 'similar';

    return {
      baseline: baselineName,
      comparison: comparisonName,
      improvement: {
        timing: timingImprovement,
        throughput: throughputImprovement,
        memory: memoryImprovement
      },
      significance,
      verdict,
      details: {
        timingDiff: comparison.timing.mean - baseline.timing.mean,
        throughputDiff: comparison.throughput.operationsPerSecond - baseline.throughput.operationsPerSecond,
        memoryDiff: comparison.memory.peakHeapUsed - baseline.memory.peakHeapUsed
      }
    };
  }

  setBaseline(resultName: string): void {
    const result = this.results.get(resultName);
    if (!result) {
      throw new Error(`No result found with name: ${resultName}`);
    }
    this.baselines.set(resultName, result);
  }

  async generateReport(results: BenchmarkResult[], options: {
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeDetails: boolean;
    compareToBaselines: boolean;
  }): Promise<string> {
    switch (options.format) {
      case 'json':
        return JSON.stringify({
          results,
          metadata: {
            generatedAt: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform
          }
        }, null, 2);

      case 'csv':
        return this.generateCSVReport(results);

      case 'html':
        return this.generateHTMLReport(results, options);

      case 'markdown':
      default:
        return this.generateMarkdownReport(results, options);
    }
  }

  private generateMarkdownReport(results: BenchmarkResult[], options: any): string {
    const report = [
      '# UNJUCKS Performance Benchmark Report',
      `Generated: ${new Date().toISOString()}`,
      `Node.js: ${process.version}`,
      `Platform: ${process.platform} ${process.arch}`,
      '',
      '## Summary',
      ''
    ];

    const successCount = results.filter(r => r.success).length;
    const totalIterations = results.reduce((sum, r) => sum + r.iterations, 0);

    report.push(`- Benchmarks run: ${results.length}`);
    report.push(`- Successful: ${successCount}/${results.length}`);
    report.push(`- Total iterations: ${totalIterations.toLocaleString()}`);
    report.push('');

    // Performance summary table
    report.push('## Performance Results');
    report.push('');
    report.push('| Benchmark | Category | Iterations | Mean (ms) | Median (ms) | P95 (ms) | Ops/sec | Memory (MB) | Status |');
    report.push('|-----------|----------|------------|-----------|-------------|----------|---------|-------------|--------|');

    for (const result of results) {
      const memoryMB = (result.memory.peakHeapUsed / 1024 / 1024).toFixed(1);
      const status = result.success ? '✅' : '❌';
      const opsPerSec = result.throughput.operationsPerSecond.toFixed(0);
      
      report.push(`| ${result.name} | ${result.category} | ${result.iterations} | ${result.timing.mean.toFixed(2)} | ${result.timing.median.toFixed(2)} | ${result.timing.p95.toFixed(2)} | ${opsPerSec} | ${memoryMB} | ${status} |`);
    }

    report.push('');

    // Detailed results if requested
    if (options.includeDetails) {
      report.push('## Detailed Results');
      report.push('');

      for (const result of results) {
        report.push(`### ${result.name}`);
        report.push(`**Category:** ${result.category}`);
        report.push(`**Status:** ${result.success ? 'Success' : 'Failed'}`);
        report.push('');

        report.push('**Timing Statistics:**');
        report.push(`- Mean: ${result.timing.mean.toFixed(2)}ms`);
        report.push(`- Median: ${result.timing.median.toFixed(2)}ms`);
        report.push(`- Min: ${result.timing.min.toFixed(2)}ms`);
        report.push(`- Max: ${result.timing.max.toFixed(2)}ms`);
        report.push(`- P95: ${result.timing.p95.toFixed(2)}ms`);
        report.push(`- P99: ${result.timing.p99.toFixed(2)}ms`);
        report.push(`- StdDev: ${result.timing.stdDev.toFixed(2)}ms`);
        report.push('');

        report.push('**Throughput:**');
        report.push(`- Operations/second: ${result.throughput.operationsPerSecond.toFixed(0)}`);
        report.push(`- Templates/second: ${result.throughput.templatesPerSecond.toFixed(0)}`);
        report.push('');

        report.push('**Memory Usage:**');
        report.push(`- Peak Heap: ${(result.memory.peakHeapUsed / 1024 / 1024).toFixed(1)} MB`);
        report.push(`- Peak RSS: ${(result.memory.peakRSS / 1024 / 1024).toFixed(1)} MB`);
        report.push(`- Final Heap: ${(result.memory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
        report.push('');

        if (result.errors.length > 0) {
          report.push('**Errors:**');
          result.errors.forEach(error => report.push(`- ${error}`));
          report.push('');
        }

        if (result.warnings.length > 0) {
          report.push('**Warnings:**');
          result.warnings.forEach(warning => report.push(`- ${warning}`));
          report.push('');
        }
      }
    }

    // Baseline comparisons if requested
    if (options.compareToBaselines && this.baselines.size > 0) {
      report.push('## Baseline Comparisons');
      report.push('');

      for (const result of results) {
        const baseline = this.baselines.get(result.name);
        if (baseline) {
          try {
            const comparison = this.compare(result.name, result.name);
            report.push(`### ${result.name} vs Baseline`);
            report.push(`**Verdict:** ${comparison.verdict} (${comparison.significance})`);
            report.push(`- Timing: ${comparison.improvement.timing > 0 ? '+' : ''}${comparison.improvement.timing.toFixed(1)}%`);
            report.push(`- Throughput: ${comparison.improvement.throughput > 0 ? '+' : ''}${comparison.improvement.throughput.toFixed(1)}%`);
            report.push(`- Memory: ${comparison.improvement.memory > 0 ? '+' : ''}${comparison.improvement.memory.toFixed(1)}%`);
            report.push('');
          } catch (e) {
            // Skip comparison if it fails
          }
        }
      }
    }

    return report.join('\n');
  }

  private generateCSVReport(results: BenchmarkResult[]): string {
    const headers = [
      'Name',
      'Category',
      'Success',
      'Iterations',
      'Mean (ms)',
      'Median (ms)',
      'Min (ms)',
      'Max (ms)',
      'P95 (ms)',
      'P99 (ms)',
      'StdDev (ms)',
      'Ops/sec',
      'Peak Heap (MB)',
      'Peak RSS (MB)',
      'Errors',
      'Warnings'
    ];

    const rows = [headers.join(',')];

    for (const result of results) {
      const row = [
        `"${result.name}"`,
        result.category,
        result.success.toString(),
        result.iterations.toString(),
        result.timing.mean.toFixed(2),
        result.timing.median.toFixed(2),
        result.timing.min.toFixed(2),
        result.timing.max.toFixed(2),
        result.timing.p95.toFixed(2),
        result.timing.p99.toFixed(2),
        result.timing.stdDev.toFixed(2),
        result.throughput.operationsPerSecond.toFixed(0),
        (result.memory.peakHeapUsed / 1024 / 1024).toFixed(1),
        (result.memory.peakRSS / 1024 / 1024).toFixed(1),
        result.errors.length.toString(),
        result.warnings.length.toString()
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private generateHTMLReport(results: BenchmarkResult[], options: any): string {
    // Basic HTML report template
    return `
<!DOCTYPE html>
<html>
<head>
  <title>UNJUCKS Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .success { color: green; }
    .error { color: red; }
    .chart { height: 200px; background-color: #f9f9f9; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>UNJUCKS Performance Benchmark Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Platform: ${process.platform} ${process.arch}</p>
  <p>Node.js: ${process.version}</p>
  
  <h2>Results Summary</h2>
  <table>
    <tr>
      <th>Benchmark</th>
      <th>Category</th>
      <th>Status</th>
      <th>Mean (ms)</th>
      <th>Ops/sec</th>
      <th>Memory (MB)</th>
    </tr>
    ${results.map(result => `
    <tr>
      <td>${result.name}</td>
      <td>${result.category}</td>
      <td class="${result.success ? 'success' : 'error'}">${result.success ? '✅ Success' : '❌ Failed'}</td>
      <td>${result.timing.mean.toFixed(2)}</td>
      <td>${result.throughput.operationsPerSecond.toFixed(0)}</td>
      <td>${(result.memory.peakHeapUsed / 1024 / 1024).toFixed(1)}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
    `.trim();
  }

  async saveResults(filePath: string, results: BenchmarkResult[], format: 'json' | 'markdown' | 'html' | 'csv' = 'json'): Promise<void> {
    const content = await this.generateReport(results, {
      format,
      includeDetails: true,
      compareToBaselines: true
    });

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  getAllResults(): BenchmarkResult[] {
    return Array.from(this.results.values());
  }

  getResult(name: string): BenchmarkResult | undefined {
    return this.results.get(name);
  }

  clearResults(): void {
    this.results.clear();
  }

  getSuites(): BenchmarkSuite[] {
    return Array.from(this.suites.values());
  }

  isRunning(): boolean {
    return this.running;
  }
}

// Export singleton instance
export const performanceBenchmark = new UnjucksPerformanceBenchmark();

// CLI helpers
export const BenchmarkHelpers = {
  async runQuickBench(templateString: string, context: any, iterations = 1000): Promise<BenchmarkResult> {
    const config: BenchmarkConfig = {
      name: 'quick-bench',
      description: 'Quick benchmark run',
      iterations,
      warmupIterations: Math.floor(iterations * 0.1),
      template: templateString,
      context,
      timeout: 30000,
      category: 'rendering',
      tags: ['quick', 'manual']
    };

    return performanceBenchmark.runBenchmark(config);
  },

  async runStandardSuite(): Promise<void> {
    console.log('🚀 Running UNJUCKS standard performance suite...');
    
    const suiteNames = ['basic-rendering', 'complex-templates'];
    
    for (const suiteName of suiteNames) {
      console.log(`\n📊 Running ${suiteName} suite...`);
      const results = await performanceBenchmark.runSuite(suiteName);
      
      const successful = results.filter(r => r.success).length;
      const avgThroughput = results.reduce((sum, r) => sum + r.throughput.operationsPerSecond, 0) / results.length;
      
      console.log(`✅ Completed: ${successful}/${results.length} benchmarks`);
      console.log(`📈 Average throughput: ${avgThroughput.toFixed(0)} ops/sec`);
      
      // Show top performers
      const sortedResults = results
        .filter(r => r.success)
        .sort((a, b) => b.throughput.operationsPerSecond - a.throughput.operationsPerSecond);
      
      if (sortedResults.length > 0) {
        console.log(`🥇 Fastest: ${sortedResults[0].name} (${sortedResults[0].throughput.operationsPerSecond.toFixed(0)} ops/sec)`);
      }
    }
  },

  formatBenchmarkResult(result: BenchmarkResult): string {
    const status = result.success ? '✅' : '❌';
    const memory = (result.memory.peakHeapUsed / 1024 / 1024).toFixed(1);
    
    return [
      `${status} ${result.name}`,
      `  📊 ${result.iterations} iterations in ${result.timing.mean.toFixed(2)}ms avg`,
      `  🚀 ${result.throughput.operationsPerSecond.toFixed(0)} ops/sec`,
      `  💾 ${memory}MB peak memory`,
      `  📈 P95: ${result.timing.p95.toFixed(2)}ms, P99: ${result.timing.p99.toFixed(2)}ms`
    ].join('\n');
  }
};