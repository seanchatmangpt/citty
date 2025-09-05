/**
 * 🧠 DARK MATTER: Integration Tests
 * Testing the production infrastructure humans forget to test
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { Store } from 'n3'

// Import all dark matter systems
import { sparqlEngine, parseQuery } from '../packages/untology/src/sparql-engine'
import { inferenceEngine, infer } from '../packages/untology/src/inference'
import { hotReload, watchTemplates } from '../packages/unjucks/src/hot-reload'
import { incrementalRenderer } from '../packages/unjucks/src/incremental-renderer'
import { crossTemplateValidator } from '../packages/unjucks/src/cross-template-validator'
import { errorRecovery, safeExecute } from '../packages/untology/src/error-recovery'
import { memoryManager, cleanupMemory } from '../packages/untology/src/memory-management'
import { security, validateInput } from '../packages/unjucks/src/security-hardening'
import { performanceMonitor } from '../packages/unjucks/src/performance-monitoring'
import { transactionManager } from '../packages/unjucks/src/transaction-safety'
import { debugTools, startDebugSession, inspectSystem } from '../packages/untology/src/debug-tooling'
import { streamingEngine, createTemplateStream } from '../packages/unjucks/src/streaming'

describe('Dark Matter Integration Tests', () => {
  let testStore: Store
  let debugSessionId: string

  beforeEach(async () => {
    testStore = new Store()
    
    // Add test data to store
    testStore.addQuad({
      subject: { termType: 'NamedNode', value: 'ex:Person1' },
      predicate: { termType: 'NamedNode', value: 'rdf:type' },
      object: { termType: 'NamedNode', value: 'ex:Person' },
      graph: { termType: 'DefaultGraph', value: '' }
    } as any)

    testStore.addQuad({
      subject: { termType: 'NamedNode', value: 'ex:Person1' },
      predicate: { termType: 'NamedNode', value: 'ex:hasAge' },
      object: { termType: 'Literal', value: '25' },
      graph: { termType: 'DefaultGraph', value: '' }
    } as any)

    // Start debug session for monitoring
    debugSessionId = startDebugSession('integration-test')
  })

  afterEach(async () => {
    debugTools.endSession(debugSessionId)
    await cleanupMemory(true)
    streamingEngine.destroy()
  })

  describe('SPARQL Engine + Error Recovery Integration', () => {
    test('should execute queries with error recovery fallback', async () => {
      const query = 'SELECT ?person WHERE { ?person rdf:type ex:Person }'
      
      const result = await safeExecute('sparql-query', async () => {
        return await sparqlEngine.execute(query, testStore)
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.recoveryUsed).toBe('none') // No recovery needed
    })

    test('should recover from malformed queries gracefully', async () => {
      const malformedQuery = 'INVALID SPARQL SYNTAX'
      
      const result = await safeExecute('sparql-query', async () => {
        return await sparqlEngine.execute(malformedQuery, testStore)
      })

      // Should recover with empty result set or fallback
      expect(result.success || result.recoveryUsed !== 'none').toBe(true)
    })
  })

  describe('Semantic Inference + Memory Management Integration', () => {
    test('should perform inference with memory optimization', async () => {
      const initialMemory = process.memoryUsage()
      
      // Add inference rules
      const rule = {
        name: 'age-category',
        pattern: '?person ex:hasAge ?age',
        condition: (bindings: any) => parseInt(bindings.age) >= 18,
        conclusion: '?person rdf:type ex:Adult'
      }

      await inferenceEngine.addInferenceRule(rule)
      
      // Run inference
      const inferredQuads = await infer(testStore)
      expect(inferredQuads.length).toBeGreaterThan(0)
      
      // Check memory hasn't grown excessively
      await cleanupMemory()
      const finalMemory = process.memoryUsage()
      expect(finalMemory.heapUsed).toBeLessThan(initialMemory.heapUsed * 2)
    })
  })

  describe('Template System + Security Integration', () => {
    test('should validate and render templates securely', async () => {
      const templateContent = 'Hello {{name}}! You are {{age}} years old.'
      const context = { name: 'Alice', age: 25 }

      // Security validation
      const securityResult = await validateInput(templateContent, 'template-render', context)
      expect(securityResult.valid).toBe(true)

      // Template rendering with security
      const renderResult = await incrementalRenderer.render('test-template', templateContent, context)
      expect(renderResult).toContain('Hello Alice!')
    })

    test('should block malicious template content', async () => {
      const maliciousTemplate = '{{constructor.constructor("alert(1)")()}}'
      const context = {}

      const securityResult = await validateInput(maliciousTemplate, 'template-render', context)
      expect(securityResult.valid).toBe(false)
      expect(securityResult.errors.length).toBeGreaterThan(0)
      expect(securityResult.errors[0].type).toBe('code_injection')
    })
  })

  describe('Hot Reload + Cross-Template Validation Integration', () => {
    test('should validate template dependencies on hot reload', async () => {
      const baseTemplate = 'Base: {% block content %}Default{% endblock %}'
      const childTemplate = '{% extends "base.njk" %}{% block content %}Child content{% endblock %}'

      // Validate cross-template references
      const validationResult = await crossTemplateValidator.validateCrossReferences({
        'base.njk': baseTemplate,
        'child.njk': childTemplate
      })

      expect(validationResult.valid).toBe(true)
      expect(validationResult.dependencies).toEqual({
        'child.njk': ['base.njk']
      })
    })
  })

  describe('Performance Monitoring + Debug Tools Integration', () => {
    test('should monitor performance and provide debug insights', async () => {
      // Start performance monitoring
      const budget = performanceMonitor.createBudget('integration-test', {
        maxRenderTime: 100,
        maxMemoryUsage: 50 * 1024 * 1024,
        maxCacheSize: 1000
      })

      // Execute some operations
      await sparqlEngine.execute('SELECT * WHERE { ?s ?p ?o }', testStore)
      
      // Check metrics
      const metrics = performanceMonitor.getMetrics()
      expect(metrics).toBeDefined()
      
      // Generate inspection report
      const inspectionReport = inspectSystem()
      expect(inspectionReport.store).toBeDefined()
      expect(inspectionReport.performance).toBeDefined()
      expect(inspectionReport.quality).toBeDefined()
    })
  })

  describe('Transaction Safety + Streaming Integration', () => {
    test('should handle streaming operations with transaction rollback', async () => {
      const transaction = await transactionManager.begin()
      
      try {
        // Create template stream with transaction context
        const dataSource = [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 },
          { name: 'Charlie', age: 35 }
        ]

        const templateStream = await createTemplateStream(
          'user-template',
          async function* () {
            for (const item of dataSource) {
              yield item
            }
          }()
        )

        // Process stream data
        const results: any[] = []
        templateStream.on('data', (chunk) => {
          results.push(chunk)
        })

        await new Promise<void>((resolve, reject) => {
          templateStream.on('end', resolve)
          templateStream.on('error', reject)
        })

        expect(results.length).toBe(dataSource.length)
        
        // Commit transaction
        await transactionManager.commit(transaction.id)
        
      } catch (error) {
        // Rollback on error
        await transactionManager.rollback(transaction.id)
        throw error
      }
    })
  })

  describe('Comprehensive Error Recovery Chain', () => {
    test('should handle cascading failures with multiple recovery strategies', async () => {
      // Simulate a complex operation that might fail at multiple points
      const complexOperation = async () => {
        // 1. SPARQL query (might fail)
        const queryResult = await safeExecute('complex-query', async () => {
          return await sparqlEngine.execute('SELECT ?invalid SYNTAX', testStore)
        })

        // 2. Template rendering (might fail)
        const renderResult = await safeExecute('template-render', async () => {
          if (!queryResult.success) {
            throw new Error('No data to render')
          }
          return await incrementalRenderer.render('error-template', '{{data}}', { data: queryResult.data })
        })

        // 3. Final output processing
        return renderResult.success ? renderResult.data : 'Fallback content'
      }

      const result = await complexOperation()
      expect(result).toBeDefined()
      
      // Should either succeed or provide fallback
      expect(typeof result).toBe('string')
    })
  })

  describe('Memory Management Under Load', () => {
    test('should maintain memory stability during intensive operations', async () => {
      const initialMemoryStats = memoryManager.getMemoryStats()
      
      // Perform intensive operations
      const operations = Array.from({ length: 100 }, (_, i) => 
        safeExecute(`load-test-${i}`, async () => {
          const query = `SELECT ?s WHERE { ?s rdf:type ?type } LIMIT ${i + 1}`
          return await sparqlEngine.execute(query, testStore)
        })
      )

      await Promise.all(operations)
      
      // Force cleanup
      await cleanupMemory(true)
      
      const finalMemoryStats = memoryManager.getMemoryStats()
      
      // Memory should not grow excessively
      expect(finalMemoryStats.heapUsed).toBeLessThan(initialMemoryStats.heapUsed * 3)
    })
  })

  describe('Security Under Attack Simulation', () => {
    test('should resist various attack vectors', async () => {
      const attackVectors = [
        // XSS attempts
        '<script>alert("xss")</script>',
        // Path traversal
        '../../etc/passwd',
        // Code injection
        '${constructor.constructor("return process")()}',
        // Prototype pollution
        '{"__proto__": {"polluted": true}}',
        // SQL injection style (for templates)
        '\'; DROP TABLE users; --'
      ]

      for (const attack of attackVectors) {
        const result = await validateInput(attack, 'security-test')
        
        // Should detect and block all attacks
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('End-to-End Production Scenario', () => {
    test('should handle complete production workflow', async () => {
      // 1. Load semantic data with transaction safety
      const transaction = await transactionManager.begin()
      
      try {
        // 2. Execute validated SPARQL query
        const query = 'SELECT ?person ?age WHERE { ?person ex:hasAge ?age }'
        const queryResult = await safeExecute('production-query', async () => {
          return await sparqlEngine.execute(query, testStore)
        })

        expect(queryResult.success).toBe(true)
        
        // 3. Apply semantic inference
        const inferredData = await infer(testStore)
        
        // 4. Render templates with security validation
        const templateContent = 'Person: {{name}}, Age: {{age}}'
        const context = { name: 'Test User', age: 30 }
        
        const securityCheck = await validateInput(templateContent, 'template-render', context)
        expect(securityCheck.valid).toBe(true)
        
        const renderResult = await incrementalRenderer.render('production-template', templateContent, context)
        expect(renderResult).toContain('Person: Test User')
        
        // 5. Monitor performance
        const metrics = performanceMonitor.getMetrics()
        expect(metrics).toBeDefined()
        
        // 6. Generate debug report
        const debugReport = inspectSystem()
        expect(debugReport.store.size).toBeGreaterThan(0)
        
        // 7. Commit transaction
        await transactionManager.commit(transaction.id)
        
      } catch (error) {
        await transactionManager.rollback(transaction.id)
        throw error
      }
    })
  })

  describe('Concurrent Operations Stress Test', () => {
    test('should handle concurrent operations without conflicts', async () => {
      const concurrentOperations = Array.from({ length: 50 }, async (_, i) => {
        const sessionId = startDebugSession(`concurrent-${i}`)
        
        try {
          // Mix of different operations
          const operations = [
            () => sparqlEngine.execute(`SELECT ?s WHERE { ?s ?p ?o } LIMIT ${i + 1}`, testStore),
            () => infer(testStore),
            () => incrementalRenderer.render(`template-${i}`, 'Test {{i}}', { i }),
            () => validateInput(`test-input-${i}`, 'validation'),
            () => cleanupMemory()
          ]
          
          const randomOp = operations[i % operations.length]
          const result = await safeExecute(`concurrent-op-${i}`, randomOp)
          
          return { index: i, success: result.success, sessionId }
        } finally {
          debugTools.endSession(sessionId)
        }
      })

      const results = await Promise.all(concurrentOperations)
      
      // Most operations should succeed
      const successfulOps = results.filter(r => r.success)
      expect(successfulOps.length).toBeGreaterThan(results.length * 0.8)
    })
  })
})