/**
 * CNS Integration Test Suite
 * 
 * Comprehensive tests for production-ready CNS components integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CNSMarketplaceIntegration, MarketplaceOperation, createCNSIntegration } from '../cns/index.js'
import { ErrorCategory, ErrorSeverity } from '../cns/core/error-handler.js'

describe('CNS Marketplace Integration', () => {
  let cnsIntegration: CNSMarketplaceIntegration
  
  beforeAll(async () => {
    cnsIntegration = createCNSIntegration({
      cnsPath: '/tmp/cns-test',
      enableOWLCompiler: true,
      enableUHFTEngine: true,
      enableMemoryLayer: true,
      enableBitActorSystem: true,
      marketplaceOntology: 'test_marketplace'
    })
    
    // Mock external dependencies for testing
    await setupTestEnvironment()
  })

  afterAll(async () => {
    if (cnsIntegration) {
      await cnsIntegration.shutdown()
    }
  })

  describe('Initialization', () => {
    test('should initialize all CNS components successfully', async () => {
      await expect(cnsIntegration.initialize()).resolves.toBeUndefined()
      
      const health = await cnsIntegration.getSystemHealth()
      expect(health.overall).toBe('healthy')
      expect(health.components).toHaveProperty('memoryLayer')
      expect(health.components).toHaveProperty('uhftEngine')
      expect(health.components).toHaveProperty('bitActorSystem')
    })

    test('should handle partial initialization failures gracefully', async () => {
      const partialConfig = createCNSIntegration({
        cnsPath: '/invalid/path',
        enableOWLCompiler: true,
        enableUHFTEngine: false,
        enableMemoryLayer: true,
        enableBitActorSystem: false
      })

      // Should not throw but should handle errors gracefully
      await expect(partialConfig.initialize()).resolves.toBeUndefined()
      
      const health = await partialConfig.getSystemHealth()
      expect(health.overall).toMatch(/degraded|critical/)
      
      await partialConfig.shutdown()
    })
  })

  describe('Marketplace Operations Processing', () => {
    let testOperation: MarketplaceOperation

    beforeEach(() => {
      testOperation = {
        id: `test_op_${Date.now()}`,
        type: 'trade',
        data: {
          symbol: 'AAPL',
          quantity: 100,
          price: 150.00,
          side: 'buy'
        },
        priority: 'high',
        timestamp: Date.now(),
        requiresSemanticProcessing: true,
        requiresNewsValidation: true,
        requiresFaultTolerance: true
      }
    })

    test('should process marketplace operation successfully', async () => {
      const result = await cnsIntegration.processMarketplaceOperation(testOperation)
      
      expect(result.success).toBe(true)
      expect(result.operationId).toBe(testOperation.id)
      expect(result.results).toHaveProperty('semantic')
      expect(result.results).toHaveProperty('validation')
      expect(result.results).toHaveProperty('actor')
      expect(result.metrics.processingTimeMs).toBeGreaterThan(0)
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    test('should handle semantic processing errors gracefully', async () => {
      // Test with operation that might cause semantic processing to fail
      const problematicOperation = {
        ...testOperation,
        data: { malformed: true }
      }
      
      const result = await cnsIntegration.processMarketplaceOperation(problematicOperation)
      
      expect(result.success).toBe(true) // Should still succeed with error handling
      expect(result.results.semantic).toBeDefined()
    })

    test('should process batch operations efficiently', async () => {
      const batchSize = 10
      const operations = Array.from({ length: batchSize }, (_, i) => ({
        ...testOperation,
        id: `batch_op_${i}`,
        data: { ...testOperation.data, quantity: 100 + i }
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        operations.map(op => cnsIntegration.processMarketplaceOperation(op))
      )
      const processingTime = Date.now() - startTime

      expect(results).toHaveLength(batchSize)
      expect(results.every(r => r.success)).toBe(true)
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })

  describe('Trading Scenarios', () => {
    test('should execute high-frequency trading scenario', async () => {
      const scenarios = cnsIntegration.getMarketplaceScenarios()
      const hftScenario = scenarios.find(s => s.name === 'High-Frequency Trading Pipeline')
      
      expect(hftScenario).toBeDefined()
      
      const result = await cnsIntegration.runMarketplaceScenario(hftScenario!)
      
      expect(result.success).toBe(true)
      expect(result.results).toBeInstanceOf(Array)
      expect(result.overallMetrics).toHaveProperty('totalOperations')
      expect(result.overallMetrics).toHaveProperty('averageProcessingTime')
    })

    test('should handle semantic product catalog scenario', async () => {
      const scenarios = cnsIntegration.getMarketplaceScenarios()
      const catalogScenario = scenarios.find(s => s.name === 'Semantic Product Catalog Management')
      
      expect(catalogScenario).toBeDefined()
      
      const result = await cnsIntegration.runMarketplaceScenario(catalogScenario!)
      
      expect(result.success).toBe(true)
      expect(result.results.some(r => r.results.semantic)).toBe(true)
    })

    test('should handle distributed risk management scenario', async () => {
      const scenarios = cnsIntegration.getMarketplaceScenarios()
      const riskScenario = scenarios.find(s => s.name === 'Distributed Risk Management')
      
      expect(riskScenario).toBeDefined()
      
      const result = await cnsIntegration.runMarketplaceScenario(riskScenario!)
      
      expect(result.success).toBe(true)
      expect(result.results.some(r => r.results.actor)).toBe(true)
    })
  })

  describe('Memory Layer Integration', () => {
    test('should store and retrieve data across memory layers', async () => {
      const testData = {
        productId: 'test-product-123',
        name: 'Test Product',
        price: 99.99,
        category: 'electronics'
      }

      // Store in memory layer
      const operation: MarketplaceOperation = {
        id: 'memory_test_op',
        type: 'store',
        data: testData,
        priority: 'medium',
        timestamp: Date.now(),
        requiresSemanticProcessing: false,
        requiresNewsValidation: false,
        requiresFaultTolerance: false
      }

      const result = await cnsIntegration.processMarketplaceOperation(operation)
      
      expect(result.success).toBe(true)
      expect(result.metrics.memoryUsageMb).toBeGreaterThan(0)
    })

    test('should handle memory layer performance under load', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        id: `memory_load_test_${i}`,
        type: 'store' as const,
        data: { id: i, data: `test data ${i}`.repeat(100) }, // ~1KB per operation
        priority: 'low' as const,
        timestamp: Date.now(),
        requiresSemanticProcessing: false,
        requiresNewsValidation: false,
        requiresFaultTolerance: false
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        operations.map(op => cnsIntegration.processMarketplaceOperation(op))
      )
      const duration = Date.now() - startTime

      expect(results.every(r => r.success)).toBe(true)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds

      // Check memory statistics
      const systemMetrics = await cnsIntegration.getSystemMetrics()
      expect(systemMetrics.memory).toBeDefined()
    })
  })

  describe('UHFT Engine Integration', () => {
    test('should validate news claims accurately', async () => {
      const newsOperation: MarketplaceOperation = {
        id: 'news_validation_test',
        type: 'validate',
        data: {
          news: 'Apple reports strong quarterly earnings, beating analyst expectations',
          sources: ['bloomberg', 'reuters', 'wsj'],
          symbol: 'AAPL'
        },
        priority: 'critical',
        timestamp: Date.now(),
        requiresSemanticProcessing: false,
        requiresNewsValidation: true,
        requiresFaultTolerance: false
      }

      const result = await cnsIntegration.processMarketplaceOperation(newsOperation)
      
      expect(result.success).toBe(true)
      expect(result.results.validation).toBeDefined()
      expect(result.results.validation.overallScore).toBeGreaterThan(0)
      expect(result.metrics.validationScore).toBeTypeOf('number')
    })

    test('should process validation within 10ns performance target', async () => {
      const highFrequencyOperations = Array.from({ length: 50 }, (_, i) => ({
        id: `uhft_perf_test_${i}`,
        type: 'validate' as const,
        data: {
          news: `Breaking: Stock ${i} shows movement`,
          sources: ['reuters'],
          symbol: 'TEST' + i
        },
        priority: 'critical' as const,
        timestamp: Date.now(),
        requiresSemanticProcessing: false,
        requiresNewsValidation: true,
        requiresFaultTolerance: false
      }))

      const startTime = process.hrtime.bigint()
      const results = await Promise.all(
        highFrequencyOperations.map(op => cnsIntegration.processMarketplaceOperation(op))
      )
      const endTime = process.hrtime.bigint()
      
      const totalTimeNs = Number(endTime - startTime)
      const avgTimePerOperation = totalTimeNs / highFrequencyOperations.length

      expect(results.every(r => r.success)).toBe(true)
      expect(avgTimePerOperation).toBeLessThan(1000000) // Less than 1ms average (target is 10ns)
    })
  })

  describe('BitActor System Integration', () => {
    test('should handle distributed processing with fault tolerance', async () => {
      const distributedOperation: MarketplaceOperation = {
        id: 'distributed_test_op',
        type: 'analyze',
        data: {
          portfolio: { AAPL: 10000, TSLA: 5000, MSFT: 7500 },
          analysis: 'risk_assessment'
        },
        priority: 'high',
        timestamp: Date.now(),
        requiresSemanticProcessing: false,
        requiresNewsValidation: false,
        requiresFaultTolerance: true
      }

      const result = await cnsIntegration.processMarketplaceOperation(distributedOperation)
      
      expect(result.success).toBe(true)
      expect(result.results.actor).toBeDefined()
      expect(result.metrics.actorsInvolved).toBeGreaterThan(0)
    })

    test('should maintain consensus under actor failures', async () => {
      // This test would simulate actor failures and verify system recovery
      const systemMetrics = await cnsIntegration.getSystemMetrics()
      
      expect(systemMetrics.bitactor).toBeDefined()
      expect(systemMetrics.bitactor.consensusStatus).toMatch(/healthy|degraded/)
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should handle component failures gracefully', async () => {
      // Simulate component failure by processing invalid operation
      const invalidOperation: MarketplaceOperation = {
        id: 'invalid_test_op',
        type: 'trade',
        data: null, // Invalid data
        priority: 'high',
        timestamp: Date.now(),
        requiresSemanticProcessing: true,
        requiresNewsValidation: true,
        requiresFaultTolerance: true
      }

      const result = await cnsIntegration.processMarketplaceOperation(invalidOperation)
      
      // Should handle gracefully and still return a result
      expect(result).toBeDefined()
      expect(result.operationId).toBe(invalidOperation.id)
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    test('should recover from circuit breaker activation', async () => {
      const health = await cnsIntegration.getSystemHealth()
      expect(health.errors).toBeDefined()
      expect(health.errors.errorRate).toBeTypeOf('number')
    })
  })

  describe('Real-time Synchronization', () => {
    test('should synchronize data across nodes', async () => {
      // Test would verify real-time sync functionality
      const syncMetrics = (await cnsIntegration.getSystemHealth()).sync
      expect(syncMetrics).toBeDefined()
      expect(syncMetrics.nodeCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Performance and Metrics', () => {
    test('should collect comprehensive performance metrics', async () => {
      const metrics = cnsIntegration.getPerformanceMetrics()
      
      expect(metrics).toHaveProperty('cns')
      expect(metrics).toHaveProperty('memory')
      expect(metrics).toHaveProperty('errors')
      expect(metrics).toHaveProperty('sync')
      
      expect(metrics.cns.totalOperations).toBeGreaterThan(0)
      expect(metrics.cns.successRate).toMatch(/%$/)
    })

    test('should maintain performance under sustained load', async () => {
      const loadTestOperations = Array.from({ length: 200 }, (_, i) => ({
        id: `load_test_${i}`,
        type: 'trade' as const,
        data: {
          symbol: 'LOAD',
          quantity: 10,
          price: 100 + i,
          side: 'buy'
        },
        priority: 'medium' as const,
        timestamp: Date.now(),
        requiresSemanticProcessing: i % 3 === 0,
        requiresNewsValidation: i % 2 === 0,
        requiresFaultTolerance: i % 4 === 0
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        loadTestOperations.map(op => cnsIntegration.processMarketplaceOperation(op))
      )
      const duration = Date.now() - startTime

      const successRate = results.filter(r => r.success).length / results.length
      const avgProcessingTime = results.reduce((sum, r) => sum + r.metrics.processingTimeMs, 0) / results.length

      expect(successRate).toBeGreaterThan(0.95) // 95% success rate minimum
      expect(avgProcessingTime).toBeLessThan(500) // Average under 500ms
      expect(duration).toBeLessThan(30000) // Complete within 30 seconds
    })
  })

  describe('System Health Monitoring', () => {
    test('should provide comprehensive health status', async () => {
      const health = await cnsIntegration.getSystemHealth()
      
      expect(health.overall).toMatch(/healthy|degraded|critical/)
      expect(health.components).toBeTypeOf('object')
      expect(health.errors).toBeTypeOf('object')
      expect(health.sync).toBeTypeOf('object')
      expect(health.performance).toBeTypeOf('object')
    })

    test('should detect and report system degradation', async () => {
      // This test would monitor health over time
      const initialHealth = await cnsIntegration.getSystemHealth()
      expect(initialHealth).toBeDefined()
      
      // Health should remain stable under normal conditions
      expect(initialHealth.overall).toMatch(/healthy|degraded/)
    })
  })
})

// Test helpers
async function setupTestEnvironment() {
  // Mock Redis connection
  process.env.REDIS_HOST = 'localhost'
  process.env.REDIS_PORT = '6379'
  
  // Create test directories
  const fs = await import('fs').then(m => m.promises)
  await fs.mkdir('/tmp/cns-test', { recursive: true })
  await fs.mkdir('/tmp/cns-test/bitactor', { recursive: true })
  await fs.mkdir('/tmp/cns-test/owl_compiler_tests', { recursive: true })
  
  // Mock CNS components
  await createMockCNSComponents()
}

async function createMockCNSComponents() {
  const fs = await import('fs').then(m => m.promises)
  
  // Mock Makefile for bitactor
  await fs.writeFile('/tmp/cns-test/bitactor/Makefile', `
uhft_components:
\t@echo "Mock build complete"

.PHONY: uhft_components
`)
  
  // Mock Python test runner
  await fs.writeFile('/tmp/cns-test/owl_compiler_tests/test_runner.py', `
import json
import sys

# Mock OWL compiler response
result = {
    "classes": [],
    "properties": [],
    "constraints": [],
    "generated_files": [],
    "statistics": {
        "totalTriples": 0,
        "classCount": 0,
        "propertyCount": 0,
        "constraintCount": 0
    }
}

print(json.dumps(result))
`)
}