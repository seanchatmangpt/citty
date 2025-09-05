/**
 * Performance optimization unit tests
 * Tests core caching and optimization features
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { performance } from 'node:perf_hooks'
import { LRUCache, MemoryAwareCache } from '../../src/cache'
import { measurePerformance, optimizeFunction } from '../../src/performance'

describe('Performance Optimization Core Features', () => {
  
  describe('LRU Cache', () => {
    test('should cache items with LRU eviction', () => {
      const cache = new LRUCache<string>({ maxSize: 3, ttl: 1000 })
      
      // Add items
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      expect(cache.size()).toBe(3)
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      
      // Add another item, should evict least recently used
      cache.set('key4', 'value4')
      
      expect(cache.size()).toBe(3)
      expect(cache.get('key1')).toBeUndefined() // Should be evicted
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })

    test('should respect TTL expiration', async () => {
      const cache = new LRUCache<string>({ maxSize: 10, ttl: 50 })
      
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 60))
      
      expect(cache.get('key1')).toBeUndefined()
    })

    test('should update access order on get', () => {
      const cache = new LRUCache<string>({ maxSize: 2 })
      
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      
      // Access key1 to make it most recently used
      cache.get('key1')
      
      // Add key3, should evict key2 (not key1)
      cache.set('key3', 'value3')
      
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBeUndefined()
      expect(cache.get('key3')).toBe('value3')
    })

    test('should provide cache statistics', () => {
      const cache = new LRUCache<string>({ maxSize: 5 })
      
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.get('key1') // Increase access count
      cache.get('key1') // Increase access count
      cache.get('key2')
      
      const stats = cache.getStats()
      
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(5)
      expect(stats.totalAccesses).toBe(4)
    })
  })

  describe('Memory Aware Cache', () => {
    test('should monitor memory usage', () => {
      const cache = new MemoryAwareCache<string>({ maxSize: 10, maxMemoryMB: 1 })
      
      // Add some items
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`)
      }
      
      expect(cache.size()).toBe(5)
      
      // Cleanup
      cache.destroy()
    })

    test('should cleanup resources on destroy', () => {
      const cache = new MemoryAwareCache<string>()
      
      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)
      
      cache.destroy()
      expect(cache.size()).toBe(0)
    })
  })

  describe('Performance Measurement', () => {
    test('should measure function execution time', () => {
      const slowFunction = (ms: number) => {
        const start = Date.now()
        while (Date.now() - start < ms) {
          // Busy wait
        }
        return 'done'
      }
      
      const measuredFunction = measurePerformance('test-function', slowFunction)
      
      const start = performance.now()
      const result = measuredFunction(10)
      const duration = performance.now() - start
      
      expect(result).toBe('done')
      expect(duration).toBeGreaterThan(8) // Should take at least ~10ms
    })

    test('should handle async functions', async () => {
      const asyncFunction = async (ms: number) => {
        await new Promise(resolve => setTimeout(resolve, ms))
        return 'async done'
      }
      
      const measuredFunction = measurePerformance('async-test', asyncFunction)
      
      const start = performance.now()
      const result = await measuredFunction(20)
      const duration = performance.now() - start
      
      expect(result).toBe('async done')
      expect(duration).toBeGreaterThan(15) // Should take at least ~20ms
    })
  })

  describe('Function Optimization', () => {
    test('should cache function results', () => {
      let callCount = 0
      
      const expensiveFunction = (x: number) => {
        callCount++
        return x * x
      }
      
      const optimizedFunction = optimizeFunction(expensiveFunction, {
        name: 'square-function',
        cacheKey: (x) => `square:${x}`,
        ttl: 1000
      })
      
      // First call should execute function
      const result1 = optimizedFunction(5)
      expect(result1).toBe(25)
      expect(callCount).toBe(1)
      
      // Second call with same argument should use cache
      const result2 = optimizedFunction(5)
      expect(result2).toBe(25)
      expect(callCount).toBe(1) // Should not increase
      
      // Different argument should execute function again
      const result3 = optimizedFunction(6)
      expect(result3).toBe(36)
      expect(callCount).toBe(2)
    })

    test('should respect TTL for cached function results', async () => {
      let callCount = 0
      
      const expensiveFunction = (x: number) => {
        callCount++
        return x * 2
      }
      
      const optimizedFunction = optimizeFunction(expensiveFunction, {
        name: 'double-function',
        ttl: 50 // 50ms TTL
      })
      
      // First call
      const result1 = optimizedFunction(10)
      expect(result1).toBe(20)
      expect(callCount).toBe(1)
      
      // Second call should use cache
      const result2 = optimizedFunction(10)
      expect(result2).toBe(20)
      expect(callCount).toBe(1)
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 60))
      
      // Third call should re-execute function
      const result3 = optimizedFunction(10)
      expect(result3).toBe(20)
      expect(callCount).toBe(2)
    })
  })

  describe('Performance Regression Detection', () => {
    test('should detect performance differences', () => {
      const fastFunction = () => 'fast'
      const slowFunction = () => {
        // Simulate slow operation
        const start = Date.now()
        while (Date.now() - start < 5) {
          // Busy wait
        }
        return 'slow'
      }
      
      const measurements = []
      
      // Measure fast function
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        fastFunction()
        measurements.push(performance.now() - start)
      }
      
      const fastAvg = measurements.reduce((sum, time) => sum + time, 0) / measurements.length
      
      // Measure slow function
      measurements.length = 0
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        slowFunction()
        measurements.push(performance.now() - start)
      }
      
      const slowAvg = measurements.reduce((sum, time) => sum + time, 0) / measurements.length
      
      // Slow function should take more time
      expect(slowAvg).toBeGreaterThan(fastAvg)
      
      console.log(`Fast function avg: ${fastAvg.toFixed(2)}ms`)
      console.log(`Slow function avg: ${slowAvg.toFixed(2)}ms`)
      console.log(`Performance ratio: ${(slowAvg / fastAvg).toFixed(2)}x`)
    })
  })

  describe('Cache Performance', () => {
    test('should demonstrate cache performance benefits', () => {
      // Without cache - recalculate every time
      let callCount = 0
      const fibonacci = (n: number): number => {
        callCount++
        if (n <= 1) return n
        return fibonacci(n - 1) + fibonacci(n - 2)
      }
      
      // Reset counter
      callCount = 0
      const start1 = performance.now()
      const result1 = fibonacci(20)
      const duration1 = performance.now() - start1
      const calls1 = callCount
      
      // With cache
      const cache = new Map<number, number>()
      callCount = 0
      
      const fibonacciCached = (n: number): number => {
        if (cache.has(n)) return cache.get(n)!
        
        callCount++
        if (n <= 1) {
          cache.set(n, n)
          return n
        }
        
        const result = fibonacciCached(n - 1) + fibonacciCached(n - 2)
        cache.set(n, result)
        return result
      }
      
      const start2 = performance.now()
      const result2 = fibonacciCached(20)
      const duration2 = performance.now() - start2
      const calls2 = callCount
      
      expect(result1).toBe(result2) // Same result
      expect(calls2).toBeLessThan(calls1) // Fewer function calls
      expect(duration2).toBeLessThan(duration1) // Should be faster
      
      console.log(`Without cache: ${calls1} calls, ${duration1.toFixed(2)}ms`)
      console.log(`With cache: ${calls2} calls, ${duration2.toFixed(2)}ms`)
      console.log(`Cache efficiency: ${((calls1 - calls2) / calls1 * 100).toFixed(1)}% fewer calls`)
      console.log(`Speed improvement: ${(duration1 / duration2).toFixed(2)}x faster`)
    })
  })
})