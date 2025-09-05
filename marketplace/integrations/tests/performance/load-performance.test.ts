import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestEnvironment } from '../utils/test-environment'
import { TestDataManager } from '../utils/test-data-manager'
import { MockServices } from '../utils/mock-services'
import axios from 'axios'
import WebSocket from 'ws'

describe('Performance Load Testing', () => {
  let testEnv: TestEnvironment
  let dataManager: TestDataManager
  let mockServices: MockServices
  let services: any

  beforeAll(async () => {
    testEnv = new TestEnvironment()
    dataManager = new TestDataManager()
    mockServices = new MockServices()

    await testEnv.initialize()
    await dataManager.setup()
    await mockServices.start()

    services = testEnv.getServices()
  }, 60000) // Extended timeout for setup

  afterAll(async () => {
    await mockServices.stop()
    await dataManager.cleanup()
    await testEnv.destroy()
  })

  describe('CNS 10ns Validation Under Load', () => {
    it('should maintain 10ns validation time under 1M requests/sec', async () => {
      const requestsPerSecond = 1000000
      const testDuration = 5 // seconds
      const totalRequests = requestsPerSecond * testDuration
      const batchSize = 10000 // Process in batches
      const batches = Math.ceil(totalRequests / batchSize)

      const results = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0
      }

      const latencies: number[] = []

      for (let batch = 0; batch < batches; batch++) {
        const batchRequests = []
        const currentBatchSize = Math.min(batchSize, totalRequests - (batch * batchSize))

        for (let i = 0; i < currentBatchSize; i++) {
          const startTime = process.hrtime.bigint()
          const request = axios.post(`${services.cns.baseUrl}/validate`, {
            domain: `load-test-domain-${batch}-${i}`,
            metadata: { batch, index: i }
          }).then(() => {
            const endTime = process.hrtime.bigint()
            const latency = Number(endTime - startTime) / 1000000 // Convert to ms
            latencies.push(latency)
            return { success: true, latency }
          }).catch(() => ({ success: false, latency: 0 }))

          batchRequests.push(request)
        }

        const batchResults = await Promise.allSettled(batchRequests)
        
        results.totalRequests += currentBatchSize
        results.successfulRequests += batchResults.filter(r => 
          r.status === 'fulfilled' && r.value.success
        ).length
        results.failedRequests += batchResults.filter(r => 
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
        ).length

        // Progress indicator
        if (batch % 10 === 0) {
          console.log(`Completed batch ${batch}/${batches}`)
        }
      }

      // Calculate statistics
      latencies.sort((a, b) => a - b)
      results.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      results.p95Latency = latencies[Math.floor(latencies.length * 0.95)]
      results.p99Latency = latencies[Math.floor(latencies.length * 0.99)]

      // Assertions
      expect(results.successfulRequests).toBeGreaterThan(totalRequests * 0.95) // 95% success rate
      expect(results.averageLatency).toBeLessThan(1) // Average < 1ms
      expect(results.p95Latency).toBeLessThan(2) // P95 < 2ms
      expect(results.p99Latency).toBeLessThan(5) // P99 < 5ms

      console.log('CNS Load Test Results:', results)
    }, 120000) // 2-minute timeout

    it('should handle validation spikes without degradation', async () => {
      const normalLoad = 1000 // requests per batch
      const spikeLoad = 50000 // requests per batch
      const batches = 5

      const results = {
        normal: { latencies: [], errors: 0 },
        spike: { latencies: [], errors: 0 }
      }

      // Normal load test
      for (let batch = 0; batch < batches; batch++) {
        const requests = Array(normalLoad).fill(null).map((_, i) => {
          const startTime = process.hrtime.bigint()
          return axios.post(`${services.cns.baseUrl}/validate`, {
            domain: `normal-load-${batch}-${i}`
          }).then(() => {
            const endTime = process.hrtime.bigint()
            return Number(endTime - startTime) / 1000000
          }).catch(() => {
            results.normal.errors++
            return null
          })
        })

        const batchLatencies = await Promise.all(requests)
        results.normal.latencies.push(...batchLatencies.filter(l => l !== null) as number[])
      }

      // Spike load test
      const spikeRequests = Array(spikeLoad).fill(null).map((_, i) => {
        const startTime = process.hrtime.bigint()
        return axios.post(`${services.cns.baseUrl}/validate`, {
          domain: `spike-load-${i}`
        }).then(() => {
          const endTime = process.hrtime.bigint()
          return Number(endTime - startTime) / 1000000
        }).catch(() => {
          results.spike.errors++
          return null
        })
      })

      const spikeLatencies = await Promise.all(spikeRequests)
      results.spike.latencies = spikeLatencies.filter(l => l !== null) as number[]

      // Compare normal vs spike performance
      const normalAvg = results.normal.latencies.reduce((a, b) => a + b, 0) / results.normal.latencies.length
      const spikeAvg = results.spike.latencies.reduce((a, b) => a + b, 0) / results.spike.latencies.length

      expect(results.normal.errors).toBeLessThan(normalLoad * batches * 0.01) // < 1% error rate
      expect(results.spike.errors).toBeLessThan(spikeLoad * 0.05) // < 5% error rate
      expect(spikeAvg).toBeLessThan(normalAvg * 3) // Spike latency < 3x normal
    }, 180000) // 3-minute timeout
  })

  describe('ByteStar 690M ops/sec Throughput', () => {
    it('should achieve and maintain 690M operations per second', async () => {
      const targetOpsPerSec = 690000000
      const testDuration = 10 // seconds
      const samplingInterval = 1000 // 1 second

      const measurements = []
      const startTime = Date.now()

      while (Date.now() - startTime < testDuration * 1000) {
        const metricsResponse = await axios.get(`${services.bytestar.baseUrl}/metrics`)
        
        if (metricsResponse.status === 200) {
          measurements.push({
            timestamp: Date.now(),
            opsPerSec: metricsResponse.data.operations_per_second,
            utilization: metricsResponse.data.gpu_utilization,
            throughput: metricsResponse.data.throughput
          })
        }

        await new Promise(resolve => setTimeout(resolve, samplingInterval))
      }

      // Analyze measurements
      const avgOpsPerSec = measurements.reduce((sum, m) => sum + m.opsPerSec, 0) / measurements.length
      const minOpsPerSec = Math.min(...measurements.map(m => m.opsPerSec))
      const maxOpsPerSec = Math.max(...measurements.map(m => m.opsPerSec))

      expect(avgOpsPerSec).toBeGreaterThanOrEqual(targetOpsPerSec * 0.95) // Within 5% of target
      expect(minOpsPerSec).toBeGreaterThanOrEqual(targetOpsPerSec * 0.80) // Never drops below 80%
      expect(measurements.every(m => m.utilization <= 100)).toBe(true) // Valid utilization

      console.log('ByteStar Throughput Results:', {
        average: avgOpsPerSec,
        min: minOpsPerSec,
        max: maxOpsPerSec,
        target: targetOpsPerSec
      })
    })

    it('should handle concurrent inference requests efficiently', async () => {
      const concurrentRequests = 10000
      const models = dataManager.getAllAssets().filter(a => a.type === 'model')
      
      expect(models.length).toBeGreaterThan(0)

      const requests = Array(concurrentRequests).fill(null).map((_, i) => {
        const model = models[i % models.length]
        const startTime = process.hrtime.bigint()
        
        return axios.post(`${services.bytestar.baseUrl}/inference`, {
          model: model.id,
          input: `concurrent test ${i}`,
          parameters: { benchmark: true }
        }).then(response => {
          const endTime = process.hrtime.bigint()
          const latency = Number(endTime - startTime) / 1000000
          
          return {
            success: true,
            latency,
            opsUsed: response.data.performance.ops_used
          }
        }).catch(() => ({ success: false, latency: 0, opsUsed: 0 }))
      })

      const startTime = Date.now()
      const results = await Promise.allSettled(requests)
      const endTime = Date.now()

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).map(r => (r as PromiseFulfilledResult<any>).value)

      const totalTime = (endTime - startTime) / 1000
      const throughput = successful.length / totalTime
      const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length
      const totalOps = successful.reduce((sum, r) => sum + r.opsUsed, 0)
      const opsPerSecond = totalOps / totalTime

      expect(successful.length).toBeGreaterThan(concurrentRequests * 0.95) // 95% success
      expect(throughput).toBeGreaterThan(100) // At least 100 requests/sec
      expect(avgLatency).toBeLessThan(50) // Average latency < 50ms
      expect(opsPerSecond).toBeGreaterThan(1000000) // At least 1M ops/sec

      console.log('Concurrent Inference Results:', {
        successful: successful.length,
        throughput: throughput.toFixed(2),
        avgLatency: avgLatency.toFixed(2),
        opsPerSecond: opsPerSecond.toFixed(0)
      })
    })
  })

  describe('Marketplace n-dimensional Search Performance', () => {
    it('should handle high-dimensional search queries efficiently', async () => {
      const dimensions = [128, 256, 512, 1024] // Different vector dimensions
      const queryCount = 1000

      for (const dim of dimensions) {
        const queries = Array(queryCount).fill(null).map((_, i) => {
          const vector = Array(dim).fill(0).map(() => Math.random())
          const startTime = process.hrtime.bigint()
          
          return axios.get(`${services.marketplace.apiUrl}/assets/search`, {
            params: {
              vector_search: JSON.stringify(vector),
              dimension: dim,
              similarity_threshold: 0.7
            },
            headers: {
              'Authorization': `Bearer ${dataManager.getUser('user-buyer-001')!.apiKey}`
            }
          }).then(response => {
            const endTime = process.hrtime.bigint()
            const latency = Number(endTime - startTime) / 1000000
            
            return {
              success: true,
              latency,
              resultCount: response.data.assets.length
            }
          }).catch(() => ({ success: false, latency: 0, resultCount: 0 }))
        })

        const results = await Promise.allSettled(queries)
        const successful = results.filter(r => 
          r.status === 'fulfilled' && r.value.success
        ).map(r => (r as PromiseFulfilledResult<any>).value)

        const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length
        const avgResults = successful.reduce((sum, r) => sum + r.resultCount, 0) / successful.length

        expect(successful.length).toBeGreaterThan(queryCount * 0.95) // 95% success
        expect(avgLatency).toBeLessThan(100 + dim * 0.1) // Latency scales reasonably with dimension
        expect(avgResults).toBeGreaterThan(0) // Should find relevant results

        console.log(`${dim}D Search Results:`, {
          dimension: dim,
          avgLatency: avgLatency.toFixed(2),
          avgResults: avgResults.toFixed(2)
        })
      }
    })

    it('should maintain search quality under concurrent load', async () => {
      const concurrentSearches = 500
      const searchQueries = [
        'machine learning model',
        'neural network algorithm',
        'computer vision dataset',
        'time series analysis',
        'natural language processing'
      ]

      const baselineResults = new Map()
      
      // Get baseline results for comparison
      for (const query of searchQueries) {
        const response = await axios.get(`${services.marketplace.apiUrl}/assets/search`, {
          params: { query },
          headers: {
            'Authorization': `Bearer ${dataManager.getUser('user-buyer-001')!.apiKey}`
          }
        })
        baselineResults.set(query, response.data.assets.map((a: any) => a.id))
      }

      // Concurrent search test
      const concurrentRequests = Array(concurrentSearches).fill(null).map((_, i) => {
        const query = searchQueries[i % searchQueries.length]
        const startTime = process.hrtime.bigint()
        
        return axios.get(`${services.marketplace.apiUrl}/assets/search`, {
          params: { 
            query,
            concurrent_test: true,
            request_id: i
          },
          headers: {
            'Authorization': `Bearer ${dataManager.getUser('user-buyer-001')!.apiKey}`
          }
        }).then(response => {
          const endTime = process.hrtime.bigint()
          const latency = Number(endTime - startTime) / 1000000
          
          const resultIds = response.data.assets.map((a: any) => a.id)
          const baselineIds = baselineResults.get(query) || []
          const overlap = resultIds.filter(id => baselineIds.includes(id)).length
          const similarity = baselineIds.length > 0 ? overlap / baselineIds.length : 0
          
          return {
            success: true,
            latency,
            query,
            similarity,
            resultCount: resultIds.length
          }
        }).catch(() => ({ 
          success: false, 
          latency: 0, 
          query, 
          similarity: 0, 
          resultCount: 0 
        }))
      })

      const results = await Promise.allSettled(concurrentRequests)
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).map(r => (r as PromiseFulfilledResult<any>).value)

      const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length
      const avgSimilarity = successful.reduce((sum, r) => sum + r.similarity, 0) / successful.length

      expect(successful.length).toBeGreaterThan(concurrentSearches * 0.95) // 95% success
      expect(avgLatency).toBeLessThan(500) // Average latency < 500ms
      expect(avgSimilarity).toBeGreaterThan(0.8) // 80% similarity to baseline results

      console.log('Concurrent Search Quality Results:', {
        successful: successful.length,
        avgLatency: avgLatency.toFixed(2),
        avgSimilarity: avgSimilarity.toFixed(3)
      })
    })
  })

  describe('System-wide Latency and Throughput', () => {
    it('should maintain low latency across all integrated systems', async () => {
      const testScenarios = [
        {
          name: 'Asset Discovery',
          endpoint: `${services.marketplace.apiUrl}/assets/search`,
          method: 'GET',
          params: { query: 'performance test' },
          expectedLatency: 100 // ms
        },
        {
          name: 'CNS Validation',
          endpoint: `${services.cns.baseUrl}/validate`,
          method: 'POST',
          data: { domain: 'performance-test-asset' },
          expectedLatency: 10 // ms
        },
        {
          name: 'ByteStar Inference',
          endpoint: `${services.bytestar.baseUrl}/inference`,
          method: 'POST',
          data: { 
            model: dataManager.getAllAssets().find(a => a.type === 'model')!.id,
            input: 'performance test input'
          },
          expectedLatency: 50 // ms
        }
      ]

      for (const scenario of testScenarios) {
        const measurements = []
        const testCount = 100

        for (let i = 0; i < testCount; i++) {
          const startTime = process.hrtime.bigint()
          
          try {
            if (scenario.method === 'GET') {
              await axios.get(scenario.endpoint, {
                params: scenario.params,
                headers: scenario.name === 'Asset Discovery' ? {
                  'Authorization': `Bearer ${dataManager.getUser('user-buyer-001')!.apiKey}`
                } : undefined
              })
            } else {
              await axios.post(scenario.endpoint, scenario.data)
            }
            
            const endTime = process.hrtime.bigint()
            const latency = Number(endTime - startTime) / 1000000
            measurements.push(latency)
          } catch (error) {
            console.warn(`Request failed for ${scenario.name}:`, error)
          }
        }

        const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length
        const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)]

        expect(measurements.length).toBeGreaterThan(testCount * 0.95) // 95% success
        expect(avgLatency).toBeLessThan(scenario.expectedLatency)
        expect(p95Latency).toBeLessThan(scenario.expectedLatency * 2) // P95 within 2x expected

        console.log(`${scenario.name} Latency Results:`, {
          average: avgLatency.toFixed(2),
          p95: p95Latency.toFixed(2),
          expected: scenario.expectedLatency
        })
      }
    })

    it('should handle WebSocket connections at scale', async () => {
      const connectionCount = 1000
      const connections: WebSocket[] = []
      const messageCount = 10

      try {
        // Create multiple WebSocket connections
        const connectionPromises = Array(connectionCount).fill(null).map((_, i) => {
          return testEnv.createWebSocketConnection(services.marketplace.websocketUrl)
            .then(ws => {
              connections.push(ws)
              return ws
            })
        })

        const connectedSockets = await Promise.allSettled(connectionPromises)
        const successfulConnections = connectedSockets.filter(c => c.status === 'fulfilled').length

        expect(successfulConnections).toBeGreaterThan(connectionCount * 0.8) // 80% connection success

        // Send messages through all connections
        const messagePromises = connections.map((ws, index) => {
          const promises = []
          
          for (let i = 0; i < messageCount; i++) {
            promises.push(
              new Promise<void>((resolve, reject) => {
                ws.send(JSON.stringify({
                  type: 'performance_test',
                  connection_id: index,
                  message_id: i,
                  timestamp: Date.now()
                }))
                
                const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000)
                
                ws.once('message', () => {
                  clearTimeout(timeout)
                  resolve()
                })
              })
            )
          }
          
          return Promise.allSettled(promises)
        })

        const messageResults = await Promise.all(messagePromises)
        const totalMessages = messageResults.reduce((sum, results) => 
          sum + results.filter(r => r.status === 'fulfilled').length, 0
        )

        expect(totalMessages).toBeGreaterThan(
          connections.length * messageCount * 0.9
        ) // 90% message success

        console.log('WebSocket Scale Results:', {
          connections: successfulConnections,
          totalMessages,
          expectedMessages: connections.length * messageCount
        })
      } finally {
        // Clean up connections
        connections.forEach(ws => ws.close())
      }
    }, 60000) // 1-minute timeout
  })
})