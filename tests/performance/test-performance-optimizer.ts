import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { performance } from 'perf_hooks'

interface TestMetrics {
  duration: number
  memoryUsage: NodeJS.MemoryUsage
  testCount: number
  passCount: number
  failCount: number
  threads: number
}

interface PerformanceConfig {
  maxTestTimeout: number
  parallelThreads: number
  memoryThreshold: number
  enableCoverage: boolean
}

class TestPerformanceOptimizer {
  private metrics: TestMetrics[] = []
  private config: PerformanceConfig

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      maxTestTimeout: 30000,
      parallelThreads: Math.max(1, Math.floor(require('os').cpus().length * 0.75)),
      memoryThreshold: 500 * 1024 * 1024, // 500MB
      enableCoverage: false,
      ...config
    }
  }

  async measureTestSuite(testPattern: string): Promise<TestMetrics> {
    const startTime = performance.now()
    const initialMemory = process.memoryUsage()

    try {
      // Run test suite with optimized configuration
      const result = execSync(
        `pnpm vitest run ${testPattern} --reporter=json --threads=${this.config.parallelThreads} --testTimeout=${this.config.maxTestTimeout}`,
        {
          encoding: 'utf-8',
          timeout: this.config.maxTestTimeout * 2,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      )

      const endTime = performance.now()
      const finalMemory = process.memoryUsage()

      // Parse test results
      const testResults = JSON.parse(result)
      
      const metrics: TestMetrics = {
        duration: endTime - startTime,
        memoryUsage: {
          rss: finalMemory.rss - initialMemory.rss,
          heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
          external: finalMemory.external - initialMemory.external,
          arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers
        },
        testCount: testResults.numTotalTests || 0,
        passCount: testResults.numPassedTests || 0,
        failCount: testResults.numFailedTests || 0,
        threads: this.config.parallelThreads
      }

      this.metrics.push(metrics)
      return metrics

    } catch (error) {
      throw new Error(`Test execution failed: ${error}`)
    }
  }

  analyzeBottlenecks(): {
    slowTests: string[]
    memoryLeaks: boolean
    threadUtilization: number
    recommendations: string[]
  } {
    if (this.metrics.length === 0) {
      return {
        slowTests: [],
        memoryLeaks: false,
        threadUtilization: 0,
        recommendations: ['No metrics available']
      }
    }

    const latestMetrics = this.metrics[this.metrics.length - 1]
    const recommendations: string[] = []

    // Check for memory issues
    const memoryLeaks = latestMetrics.memoryUsage.heapUsed > this.config.memoryThreshold
    if (memoryLeaks) {
      recommendations.push('Memory usage exceeds threshold - check for memory leaks')
    }

    // Check thread utilization
    const threadUtilization = (latestMetrics.threads / require('os').cpus().length) * 100
    if (threadUtilization < 50) {
      recommendations.push('Low thread utilization - consider increasing parallel threads')
    }

    // Check test duration
    if (latestMetrics.duration > 60000) { // 1 minute
      recommendations.push('Test suite taking too long - consider splitting large test files')
    }

    // Check test isolation
    if (latestMetrics.failCount > 0 && latestMetrics.passCount > 0) {
      recommendations.push('Mixed test results - check for test isolation issues')
    }

    return {
      slowTests: [], // Would need to parse individual test timings
      memoryLeaks,
      threadUtilization,
      recommendations
    }
  }

  generateOptimizedConfig(): object {
    const analysis = this.analyzeBottlenecks()
    
    return {
      test: {
        // Optimize parallel execution
        pool: 'threads',
        poolOptions: {
          threads: {
            minThreads: Math.max(1, this.config.parallelThreads - 2),
            maxThreads: this.config.parallelThreads,
            isolate: true, // Better isolation
            singleThread: false
          }
        },
        
        // Optimize timeouts
        testTimeout: this.config.maxTestTimeout,
        hookTimeout: Math.floor(this.config.maxTestTimeout / 3),
        teardownTimeout: 5000,
        
        // Memory optimization
        clearMocks: true,
        restoreMocks: true,
        unstubGlobals: true,
        
        // Faster test discovery
        cache: {
          dir: 'node_modules/.vitest'
        },
        
        // Optimize reporters
        reporters: analysis.memoryLeaks ? ['verbose'] : ['basic'],
        
        // Coverage optimization
        coverage: this.config.enableCoverage ? {
          provider: 'v8', // Faster than c8
          reporter: ['text-summary'],
          skipFull: true,
          all: false // Only covered files
        } : false,
        
        // File watching optimization
        watch: false,
        
        // Optimize for CI/batch execution
        run: true,
        passWithNoTests: false,
        
        // Test file patterns optimization
        include: [
          'test/**/*.test.ts',
          'tests/unit/**/*.test.ts'
        ],
        exclude: [
          'node_modules/**',
          'dist/**',
          'generated/**',
          '**/node_modules/**',
          '**/*.bench.ts'
        ]
      }
    }
  }

  async createPerformanceReport(): Promise<string> {
    if (this.metrics.length === 0) {
      return 'No performance metrics available'
    }

    const analysis = this.analyzeBottlenecks()
    const latestMetrics = this.metrics[this.metrics.length - 1]
    
    const report = `
# Test Performance Analysis Report

## Summary
- **Total Tests**: ${latestMetrics.testCount}
- **Passed**: ${latestMetrics.passCount}
- **Failed**: ${latestMetrics.failCount}
- **Execution Time**: ${(latestMetrics.duration / 1000).toFixed(2)}s
- **Threads Used**: ${latestMetrics.threads}
- **Thread Utilization**: ${analysis.threadUtilization.toFixed(1)}%

## Memory Usage
- **RSS Delta**: ${(latestMetrics.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB
- **Heap Used**: ${(latestMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
- **Memory Leaks Detected**: ${analysis.memoryLeaks ? 'YES ⚠️' : 'NO ✅'}

## Performance Issues
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Recommendations
${analysis.recommendations.length === 0 ? '- Performance is optimal ✅' : analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Trend Analysis
${this.metrics.length > 1 ? this.analyzeTrends() : '- Not enough data for trend analysis'}
    `.trim()

    return report
  }

  private analyzeTrends(): string {
    if (this.metrics.length < 2) return ''

    const recent = this.metrics.slice(-2)
    const [previous, current] = recent

    const durationChange = ((current.duration - previous.duration) / previous.duration) * 100
    const memoryChange = ((current.memoryUsage.heapUsed - previous.memoryUsage.heapUsed) / Math.max(previous.memoryUsage.heapUsed, 1)) * 100

    return [
      `- Duration trend: ${durationChange > 0 ? '+' : ''}${durationChange.toFixed(1)}%`,
      `- Memory trend: ${memoryChange > 0 ? '+' : ''}${memoryChange.toFixed(1)}%`,
      durationChange > 20 ? '- ⚠️ Significant performance degradation detected' : '',
      memoryChange > 30 ? '- ⚠️ Memory usage increasing significantly' : ''
    ].filter(Boolean).join('\n')
  }
}

export { TestPerformanceOptimizer, type TestMetrics, type PerformanceConfig }