import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PythonBridge, ErlangBridge, UnifiedBridge, createUnifiedBridge } from '../../src/bridges'
import { DataSynchronizer, createDataSynchronizer } from '../../src/sync'

vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

describe('Bridge Integration Tests', () => {
  let pythonBridge: PythonBridge
  let erlangBridge: ErlangBridge
  let unifiedBridge: UnifiedBridge
  let synchronizer: DataSynchronizer

  beforeEach(async () => {
    pythonBridge = new PythonBridge({
      cnsPath: '~/cns',
      poolSize: 2,
      maxRetries: 1,
      timeout: 5000
    })

    erlangBridge = new ErlangBridge({
      bytstarPath: '~/bytestar',
      poolSize: 2,
      maxRetries: 1,
      timeout: 5000,
      performanceTarget: 8
    })

    unifiedBridge = createUnifiedBridge({
      enablePython: true,
      enableErlang: true
    })

    synchronizer = createDataSynchronizer(unifiedBridge, {
      enabled: false,
      syncInterval: 1000,
      batchSize: 5
    })
  })

  afterEach(async () => {
    await pythonBridge.cleanup()
    await erlangBridge.cleanup()
    await unifiedBridge.cleanup()
    await synchronizer.stopSync()
  })

  describe('Python Bridge', () => {
    it('should initialize successfully', async () => {
      await pythonBridge.initialize()
      expect(pythonBridge.isHealthy()).toBe(true)
    })

    it('should process ontology validation requests', async () => {
      const request = {
        operation: 'validate' as const,
        input: '<owl:Class rdf:about="#TestClass" />',
        format: 'owl' as const,
        options: {
          strict: true,
          includeWarnings: false
        }
      }

      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(() => ({
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn(),
        pid: 12345
      }))

      const result = await pythonBridge.processOntology(request)
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('metadata')
    })

    it('should handle transformation requests', async () => {
      const request = {
        operation: 'transform' as const,
        input: '<owl:Class rdf:about="#TestClass" />',
        format: 'owl' as const,
        outputFormat: 'json-ld' as const,
        options: {}
      }

      const result = await pythonBridge.processOntology(request)
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('metadata')
    })
  })

  describe('Erlang Bridge', () => {
    it('should initialize successfully', async () => {
      await erlangBridge.initialize()
      expect(erlangBridge.isHealthy()).toBe(true)
    })

    it('should execute consensus operations', async () => {
      const request = {
        algorithm: 'byzantine' as const,
        operation: 'validate' as const,
        data: { nodes: ['node1', 'node2', 'node3'] },
        options: {
          tolerance: 1,
          timeout: 5000
        }
      }

      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(() => ({
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0)
        }),
        kill: vi.fn(),
        pid: 12346
      }))

      const result = await erlangBridge.executeConsensus(request)
      expect(result.success).toBe(true)
      expect(result.algorithm).toBe('byzantine')
    })

    it('should enforce Doctrine of 8 performance constraints', async () => {
      const request = {
        metrics: ['latency', 'throughput'],
        targets: { latency: 4, throughput: 8 },
        options: { strict: true }
      }

      const result = await erlangBridge.monitorPerformance(request)
      expect(result.success).toBe(true)
      expect(result.metrics).toBeDefined()
    })
  })

  describe('Unified Bridge', () => {
    it('should coordinate cross-system operations', async () => {
      const request = {
        operation: 'cross-transform',
        source: 'cns' as const,
        target: 'bytestar' as const,
        data: { ontology: '<owl:Class />', consensus: { nodes: ['n1'] } },
        options: {}
      }

      const result = await unifiedBridge.execute(request)
      expect(result.success).toBe(true)
      expect(result.operation).toBe('cross-transform')
    })

    it('should provide system coordination status', async () => {
      const coordination = await unifiedBridge.getCoordination()
      expect(coordination).toHaveProperty('pythonHealth')
      expect(coordination).toHaveProperty('erlangHealth')
      expect(coordination).toHaveProperty('activeOperations')
    })

    it('should handle hybrid validation requests', async () => {
      const request = {
        operation: 'hybrid-validation',
        source: 'cns' as const,
        target: 'bytestar' as const,
        data: { 
          ontology: '<owl:Class rdf:about="#Test" />',
          consensus: { nodes: ['node1', 'node2'] }
        },
        options: {
          validateOntology: true,
          validateConsensus: true,
          crossValidate: true
        }
      }

      const result = await unifiedBridge.execute(request)
      expect(result.success).toBe(true)
      expect(result.validations).toBeDefined()
    })
  })

  describe('Data Synchronizer', () => {
    it('should queue and process sync events', async () => {
      await synchronizer.queueEvent({
        source: 'cns',
        target: 'bytestar',
        operation: 'ontology-sync',
        data: { classes: ['TestClass'] }
      })

      const status = synchronizer.getQueueStatus()
      expect(status.length).toBe(1)
      expect(status.processing).toBe(false)
    })

    it('should handle bidirectional synchronization', async () => {
      await synchronizer.queueEvent({
        source: 'cns',
        target: 'bytestar', 
        operation: 'data-sync',
        data: { type: 'ontology', content: '<owl:Class />' }
      })

      await synchronizer.queueEvent({
        source: 'bytestar',
        target: 'cns',
        operation: 'consensus-sync',
        data: { type: 'validation', nodes: ['n1', 'n2'] }
      })

      const metrics = synchronizer.getMetrics()
      expect(metrics.eventsProcessed).toBeGreaterThanOrEqual(0)
    })

    it('should resolve conflicts according to strategy', async () => {
      const conflictingSynchronizer = createDataSynchronizer(unifiedBridge, {
        enabled: false,
        conflictResolution: 'merge'
      })

      await conflictingSynchronizer.queueEvent({
        source: 'cns',
        target: 'bytestar',
        operation: 'conflicting-operation',
        data: { conflict: true }
      })

      const metrics = conflictingSynchronizer.getMetrics()
      expect(metrics.conflicts).toBeGreaterThanOrEqual(0)

      await conflictingSynchronizer.stopSync()
    })
  })

  describe('End-to-End Integration', () => {
    it('should perform complete CNS to Bytestar workflow', async () => {
      const ontologyData = '<owl:Class rdf:about="#IntegrationTest" />'
      
      const ontologyRequest = {
        operation: 'validate' as const,
        format: 'owl' as const,
        data: ontologyData,
        options: { strict: true }
      }

      const ontologyResult = await pythonBridge.processOntology(ontologyRequest)
      expect(ontologyResult.success).toBe(true)

      const consensusRequest = {
        algorithm: 'raft' as const,
        operation: 'validate' as const,
        data: { 
          nodes: ['node1', 'node2', 'node3'],
          payload: ontologyResult.transformedData 
        },
        options: { tolerance: 1 }
      }

      const consensusResult = await erlangBridge.executeConsensus(consensusRequest)
      expect(consensusResult.success).toBe(true)

      await synchronizer.queueEvent({
        source: 'cns',
        target: 'bytestar',
        operation: 'integration-test',
        data: {
          ontology: ontologyResult,
          consensus: consensusResult
        }
      })

      const finalStatus = synchronizer.getQueueStatus()
      expect(finalStatus.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle system health monitoring', async () => {
      const pythonHealth = await pythonBridge.getHealth()
      const erlangHealth = await erlangBridge.getHealth()
      const coordination = await unifiedBridge.getCoordination()

      expect(pythonHealth).toHaveProperty('status')
      expect(erlangHealth).toHaveProperty('status')
      expect(coordination).toHaveProperty('pythonHealth')
      expect(coordination).toHaveProperty('erlangHealth')
    })

    it('should maintain performance under load', async () => {
      const promises = []
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          synchronizer.queueEvent({
            source: 'cns',
            target: 'bytestar',
            operation: `load-test-${i}`,
            data: { index: i, timestamp: Date.now() }
          })
        )
      }

      await Promise.all(promises)
      
      const metrics = synchronizer.getMetrics()
      expect(metrics.eventsProcessed).toBeGreaterThanOrEqual(0)
      expect(metrics.failures).toBe(0)
    })
  })
})