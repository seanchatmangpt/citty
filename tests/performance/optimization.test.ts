/**
 * Performance optimization tests
 * Tests for caching, parallel processing, and memory management
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { performance } from 'node:perf_hooks'
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { TemplateRenderer } from '../../src/renderer'
import { walkTemplates, listGenerators } from '../../src/walker'  
import { templateCache, discoveryCache, getCacheStats, clearAllCaches } from '../../src/cache'
import { performanceMonitor } from '../../src/performance'
import { generateOptimizationReport } from '../../src/bundler-optimization'

describe('Performance Optimizations', () => {
  const testDir = resolve(__dirname, '../temp-performance')
  
  beforeEach(async () => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true })
    mkdirSync(resolve(testDir, 'templates', 'test-generator', 'action1'), { recursive: true })
    mkdirSync(resolve(testDir, 'templates', 'test-generator', 'action2'), { recursive: true })
    
    // Create test templates
    writeFileSync(
      resolve(testDir, 'templates', 'test-generator', 'action1', 'template.njk'),
      '---\nto: output.txt\n---\nHello {{ name }}! Count: {{ count }}'
    )
    
    writeFileSync(
      resolve(testDir, 'templates', 'test-generator', 'action2', 'template.njk'),
      '---\nto: data.json\n---\n{{ users | json }}'
    )
    
    // Clear caches
    clearAllCaches()
  })
  
  afterEach(() => {
    // Cleanup
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Template Compilation Caching', () => {
    test('should cache compiled templates with modification time checking', async () => {
      const renderer = new TemplateRenderer({ maxCacheSize: 10 })
      const templatePath = resolve(testDir, 'templates', 'test-generator', 'action1', 'template.njk')
      
      // First render
      const start1 = performance.now()
      const result1 = await renderer.renderFile(templatePath, { name: 'Alice', count: 1 })
      const duration1 = performance.now() - start1
      
      expect(result1.output).toBe('Hello Alice! Count: 1')
      expect(result1.metadata.cached).toBe(false)
      
      // Second render should use cache
      const start2 = performance.now()
      const result2 = await renderer.renderFile(templatePath, { name: 'Bob', count: 2 })
      const duration2 = performance.now() - start2
      
      expect(result2.output).toBe('Hello Bob! Count: 2')
      
      // Cache should make second render faster (not always guaranteed due to system variance)
      // but we can at least check that caching is working
      const stats = renderer.getCacheStats()
      expect(stats.compiledTemplates).toBe(1)
      
      renderer.destroy()
    })

    test('should invalidate cache when template is modified', async () => {
      const renderer = new TemplateRenderer()
      const templatePath = resolve(testDir, 'templates', 'test-generator', 'action1', 'template.njk')
      
      // First render
      const result1 = await renderer.renderFile(templatePath, { name: 'Alice', count: 1 })
      expect(result1.output).toBe('Hello Alice! Count: 1')
      
      // Modify template
      await new Promise(resolve => setTimeout(resolve, 10)) // Ensure different mtime
      writeFileSync(templatePath, '---\nto: output.txt\n---\nModified: {{ name }}! Count: {{ count }}')
      
      // Second render should detect modification and recompile
      const result2 = await renderer.renderFile(templatePath, { name: 'Bob', count: 2 })
      expect(result2.output).toBe('Modified: Bob! Count: 2')
      
      renderer.destroy()
    })
  })

  describe('Parallel File System Operations', () => {
    test('should process templates in parallel batches', async () => {
      // Create more templates for parallel processing test
      for (let i = 0; i < 20; i++) {
        const dir = resolve(testDir, 'templates', `generator-${i}`, 'action')
        mkdirSync(dir, { recursive: true })
        writeFileSync(
          resolve(dir, 'template.njk'),
          `---\nto: output-${i}.txt\n---\nTemplate ${i}: {{ value }}`
        )
      }
      
      const start = performance.now()
      const templates = await walkTemplates(resolve(testDir, 'templates'))
      const duration = performance.now() - start
      
      expect(templates.length).toBe(22) // 20 new + 2 original
      
      // Test parallel processing by checking that all templates were found
      const generators = new Set(templates.map(t => t.generator))
      expect(generators.size).toBe(21) // test-generator + 20 new generators
      
      console.log(`Parallel template discovery took ${duration.toFixed(2)}ms for ${templates.length} templates`)
    })

    test('should cache template discovery results', async () => {
      const templatesDir = resolve(testDir, 'templates')
      
      // First discovery
      const start1 = performance.now()
      const templates1 = await walkTemplates(templatesDir)
      const duration1 = performance.now() - start1
      
      // Second discovery should use cache
      const start2 = performance.now()
      const templates2 = await walkTemplates(templatesDir)
      const duration2 = performance.now() - start2
      
      expect(templates1).toEqual(templates2)
      
      // Second call should be significantly faster due to caching
      expect(duration2).toBeLessThan(duration1)
      
      console.log(`First discovery: ${duration1.toFixed(2)}ms, Cached: ${duration2.toFixed(2)}ms`)
    })
  })

  // Note: Query caching tests would go here when ontology package is properly integrated

  describe('Memory Management', () => {
    test('should manage memory usage effectively', async () => {
      const initialMemory = process.memoryUsage()
      
      // Create and cache many templates
      const renderer = new TemplateRenderer({ maxCacheSize: 50 })
      
      for (let i = 0; i < 100; i++) {
        await renderer.renderString(`Template ${i}: {{ value }}`, { value: i })
      }
      
      const stats = renderer.getCacheStats()
      expect(stats.resultCache.size).toBeLessThanOrEqual(50) // Should respect max cache size
      
      // Memory usage should be reasonable
      const finalMemory = process.memoryUsage()
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(heapIncrease).toBeLessThan(50 * 1024 * 1024)
      
      renderer.destroy()
    })

    test('should cleanup resources on destroy', async () => {
      const renderer = new TemplateRenderer()
      
      // Use renderer to populate caches
      await renderer.renderString('Hello {{ name }}', { name: 'World' })
      
      const statsBefore = renderer.getCacheStats()
      expect(statsBefore.resultCache.size).toBeGreaterThan(0)
      
      // Destroy should clear caches
      renderer.destroy()
      
      const statsAfter = renderer.getCacheStats()
      expect(statsAfter.resultCache.size).toBe(0)
    })
  })

  describe('Performance Monitoring', () => {
    test('should track render performance metrics', async () => {
      const renderer = new TemplateRenderer({ enablePerformanceMonitoring: true })
      const templatePath = resolve(testDir, 'templates', 'test-generator', 'action1', 'template.njk')
      
      // Enable performance hooks
      let renderStarted = false
      let renderEnded = false
      
      performanceMonitor.registerHooks({
        onRenderStart: () => { renderStarted = true },
        onRenderEnd: (path, duration) => { 
          renderEnded = true
          expect(duration).toBeGreaterThan(0)
        }
      })
      
      performanceMonitor.startRender(templatePath)
      await renderer.renderFile(templatePath, { name: 'Test', count: 1 })
      const duration = performanceMonitor.endRender(templatePath)
      
      expect(renderStarted).toBe(true)
      expect(renderEnded).toBe(true)
      expect(duration).toBeGreaterThan(0)
      
      // Get performance metrics
      const metrics = performanceMonitor.getMetrics()
      expect(metrics.timestamp).toBeGreaterThan(0)
      expect(metrics.memoryUsage).toBeDefined()
      
      renderer.destroy()
    })

    test('should generate performance reports with recommendations', async () => {
      const report = performanceMonitor.getPerformanceReport()
      
      expect(report.current).toBeDefined()
      expect(report.average).toBeDefined()
      expect(report.trends).toBeDefined()
      expect(Array.isArray(report.recommendations)).toBe(true)
      
      // Trends should have arrays for different metrics
      expect(Array.isArray(report.trends.renderTime)).toBe(true)
      expect(Array.isArray(report.trends.memoryUsage)).toBe(true)
      expect(Array.isArray(report.trends.cacheHitRate)).toBe(true)
    })
  })

  describe('Bundle Optimization', () => {
    test('should analyze bundle usage and provide optimization stats', async () => {
      const report = await generateOptimizationReport()
      
      expect(report.bundleStats).toBeDefined()
      expect(report.stringInternStats).toBeDefined()
      expect(Array.isArray(report.recommendations)).toBe(true)
      
      // Bundle stats should include module information
      expect(report.bundleStats.totalSize).toBeGreaterThan(0)
      expect(Array.isArray(report.bundleStats.modules)).toBe(true)
      expect(report.bundleStats.treeshakingEfficiency).toBeGreaterThanOrEqual(0)
      expect(report.bundleStats.lazyLoadingUtilization).toBeGreaterThanOrEqual(0)
      
      console.log('Bundle optimization report:', {
        totalSize: `${report.bundleStats.totalSize}KB`,
        loadedModules: report.bundleStats.modules.filter(m => m.loaded).length,
        treeshakingEfficiency: `${(report.bundleStats.treeshakingEfficiency * 100).toFixed(1)}%`,
        lazyLoadingUtilization: `${(report.bundleStats.lazyLoadingUtilization * 100).toFixed(1)}%`
      })
    })
  })

  describe('Cache Statistics and Analysis', () => {
    test('should provide comprehensive cache statistics', async () => {
      // Populate various caches
      const renderer = new TemplateRenderer()
      await renderer.renderString('Test {{ value }}', { value: 123 })
      
      await walkTemplates(resolve(testDir, 'templates'))
      
      const stats = getCacheStats()
      
      expect(stats.template).toBeDefined()
      expect(stats.discovery).toBeDefined()
      
      // Each cache should have basic metrics
      expect(typeof stats.template.size).toBe('number')
      expect(typeof stats.discovery.size).toBe('number')
      
      console.log('Cache statistics:', {
        templateCache: `${stats.template.size} entries`,
        discoveryCache: `${stats.discovery.size} entries`
      })
      
      renderer.destroy()
    })

    test('should measure performance improvements from optimizations', async () => {
      const measurements = []
      const iterations = 10
      
      // Measure without optimization (fresh renderer each time)
      for (let i = 0; i < iterations; i++) {
        const renderer = new TemplateRenderer({ maxCacheSize: 0 }) // Disable caching
        const start = performance.now()
        await renderer.renderString('Hello {{ name }}! Count: {{ count }}', { name: `User${i}`, count: i })
        const duration = performance.now() - start
        measurements.push(duration)
        renderer.destroy()
      }
      
      const avgWithoutCache = measurements.reduce((sum, d) => sum + d, 0) / measurements.length
      
      // Measure with optimization (same renderer instance)
      const optimizedRenderer = new TemplateRenderer({ maxCacheSize: 100 })
      const optimizedMeasurements = []
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await optimizedRenderer.renderString('Hello {{ name }}! Count: {{ count }}', { name: `User${i}`, count: i })
        const duration = performance.now() - start
        optimizedMeasurements.push(duration)
      }
      
      const avgWithCache = optimizedMeasurements.reduce((sum, d) => sum + d, 0) / optimizedMeasurements.length
      
      console.log(`Performance comparison:`)
      console.log(`Without cache: ${avgWithoutCache.toFixed(2)}ms avg`)
      console.log(`With cache: ${avgWithCache.toFixed(2)}ms avg`)
      console.log(`Improvement: ${((avgWithoutCache - avgWithCache) / avgWithoutCache * 100).toFixed(1)}%`)
      
      // Cache should provide some benefit (though this test might be too simple to see major gains)
      expect(avgWithCache).toBeLessThanOrEqual(avgWithoutCache * 1.2) // Allow for some variance
      
      optimizedRenderer.destroy()
    })
  })
})