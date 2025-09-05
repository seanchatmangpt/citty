import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestEnvironment } from '../utils/test-environment'
import { MockServices } from '../utils/mock-services'
import axios from 'axios'

describe('CNS Semantic Processing Functional Tests', () => {
  let testEnv: TestEnvironment
  let mockServices: MockServices
  let cnsBaseUrl: string

  beforeAll(async () => {
    testEnv = new TestEnvironment()
    mockServices = new MockServices()
    
    await testEnv.initialize()
    await mockServices.start()
    
    cnsBaseUrl = testEnv.getServices().cns.baseUrl
  })

  afterAll(async () => {
    await mockServices.stop()
    await testEnv.destroy()
  })

  describe('Domain Validation', () => {
    it('should validate domains with 10ns precision', async () => {
      const testCases = [
        'advanced-nlp-model',
        'quantum-optimizer-v2',
        'financial-time-series-data',
        'computer-vision-model'
      ]

      for (const domain of testCases) {
        const startTime = process.hrtime.bigint()
        
        const response = await axios.post(`${cnsBaseUrl}/validate`, {
          domain,
          metadata: { type: 'ai-asset' }
        })

        const endTime = process.hrtime.bigint()
        const actualTime = Number(endTime - startTime)

        expect(response.status).toBe(200)
        expect(response.data.valid).toBe(true)
        expect(response.data.domain).toBe(domain)
        expect(response.data.validationTime).toBe('10ns')
        
        // Verify actual processing is sub-millisecond
        expect(actualTime).toBeLessThan(1000000) // Less than 1ms in nanoseconds
      }
    })

    it('should reject invalid domains', async () => {
      const invalidDomains = [
        '',
        'invalid..domain',
        'domain-with-@-symbol',
        'domain with spaces',
        'a'.repeat(300) // Too long
      ]

      for (const domain of invalidDomains) {
        const response = await axios.post(`${cnsBaseUrl}/validate`, {
          domain
        }, { validateStatus: () => true })

        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })

    it('should provide semantic categorization', async () => {
      const testCases = [
        {
          domain: 'neural-language-model',
          expectedCategory: 'ai-model',
          expectedType: 'neural-network'
        },
        {
          domain: 'financial-dataset-2024',
          expectedCategory: 'dataset',
          expectedType: 'time-series'
        },
        {
          domain: 'optimization-algorithm',
          expectedCategory: 'algorithm',
          expectedType: 'optimization'
        }
      ]

      for (const testCase of testCases) {
        const response = await axios.post(`${cnsBaseUrl}/validate`, {
          domain: testCase.domain
        })

        expect(response.status).toBe(200)
        expect(response.data.semantic.category).toBe(testCase.expectedCategory)
        expect(response.data.semantic.confidence).toBeGreaterThan(0.8)
      }
    })
  })

  describe('Semantic Analysis', () => {
    it('should analyze text with high accuracy', async () => {
      const testCases = [
        {
          text: 'I need a machine learning model for natural language processing tasks',
          expectedIntent: 'search',
          expectedEntities: ['machine learning', 'nlp', 'model'],
          expectedSentiment: 'neutral'
        },
        {
          text: 'Looking for high-performance computer vision algorithms',
          expectedIntent: 'search',
          expectedEntities: ['computer vision', 'algorithms', 'performance'],
          expectedSentiment: 'positive'
        },
        {
          text: 'This dataset is terrible and unusable',
          expectedIntent: 'feedback',
          expectedEntities: ['dataset'],
          expectedSentiment: 'negative'
        }
      ]

      for (const testCase of testCases) {
        const response = await axios.post(`${cnsBaseUrl}/semantic/analyze`, {
          text: testCase.text,
          context: { domain: 'ai-marketplace' }
        })

        expect(response.status).toBe(200)
        expect(response.data.analysis.intent).toBe(testCase.expectedIntent)
        expect(response.data.analysis.confidence).toBeGreaterThan(0.8)
        
        // Check for expected entities
        for (const entity of testCase.expectedEntities) {
          expect(response.data.analysis.entities.some((e: string) => 
            e.toLowerCase().includes(entity.toLowerCase())
          )).toBe(true)
        }
      }
    })

    it('should generate consistent semantic vectors', async () => {
      const text = 'advanced neural network for image classification'
      const requests = []

      // Make 5 identical requests
      for (let i = 0; i < 5; i++) {
        requests.push(
          axios.post(`${cnsBaseUrl}/semantic/analyze`, {
            text,
            context: { domain: 'ai-marketplace' }
          })
        )
      }

      const responses = await Promise.all(requests)
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Vectors should be consistent (within small tolerance)
      const firstVector = responses[0].data.analysis.dimensions.semantic
      
      responses.slice(1).forEach(response => {
        const vector = response.data.analysis.dimensions.semantic
        expect(vector).toHaveLength(firstVector.length)
        
        // Check vector similarity (cosine similarity > 0.95)
        const similarity = cosineSimilarity(firstVector, vector)
        expect(similarity).toBeGreaterThan(0.95)
      })
    })

    it('should handle multilingual input', async () => {
      const multilingualTests = [
        {
          text: 'modelo de aprendizaje automático para procesamiento de lenguaje natural',
          language: 'es',
          expectedEntities: ['modelo', 'aprendizaje', 'lenguaje']
        },
        {
          text: 'machine learning modèle pour traitement du langage naturel',
          language: 'fr',
          expectedEntities: ['machine learning', 'modèle', 'langage']
        },
        {
          text: '自然言語処理のための機械学習モデル',
          language: 'ja',
          expectedEntities: ['機械学習', '自然言語処理', 'モデル']
        }
      ]

      for (const test of multilingualTests) {
        const response = await axios.post(`${cnsBaseUrl}/semantic/analyze`, {
          text: test.text,
          context: { 
            domain: 'ai-marketplace',
            language: test.language
          }
        })

        expect(response.status).toBe(200)
        expect(response.data.analysis.confidence).toBeGreaterThan(0.7)
        expect(response.data.analysis.dimensions).toBeDefined()
      }
    })
  })

  describe('Context-Aware Processing', () => {
    it('should adapt analysis based on context', async () => {
      const text = 'apple machine learning'
      
      // Same text, different contexts
      const contexts = [
        { domain: 'food-industry', expected_entity: 'fruit' },
        { domain: 'technology', expected_entity: 'company' },
        { domain: 'ai-marketplace', expected_entity: 'technology' }
      ]

      for (const context of contexts) {
        const response = await axios.post(`${cnsBaseUrl}/semantic/analyze`, {
          text,
          context: { domain: context.domain }
        })

        expect(response.status).toBe(200)
        expect(response.data.analysis.contextual).toBeDefined()
        
        // Context should influence interpretation
        const hasContextualEntity = response.data.analysis.entities.some(
          (entity: string) => entity.toLowerCase().includes(context.expected_entity)
        )
        
        if (context.domain !== 'ai-marketplace') {
          expect(hasContextualEntity).toBe(true)
        }
      }
    })

    it('should maintain semantic consistency across sessions', async () => {
      const sessionTests = [
        {
          sessionId: 'session-1',
          queries: [
            'neural networks for image processing',
            'deep learning models for computer vision',
            'CNN architectures for image classification'
          ]
        }
      ]

      for (const session of sessionTests) {
        const responses = []
        
        for (const query of session.queries) {
          const response = await axios.post(`${cnsBaseUrl}/semantic/analyze`, {
            text: query,
            context: { 
              domain: 'ai-marketplace',
              session_id: session.sessionId
            }
          })
          
          responses.push(response.data)
        }

        // Check for semantic consistency - related queries should have similar vectors
        for (let i = 1; i < responses.length; i++) {
          const similarity = cosineSimilarity(
            responses[0].analysis.dimensions.semantic,
            responses[i].analysis.dimensions.semantic
          )
          expect(similarity).toBeGreaterThan(0.6) // Related topics
        }
      }
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle high-frequency validation requests', async () => {
      const requestCount = 1000
      const requests = []

      const startTime = Date.now()

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          axios.post(`${cnsBaseUrl}/validate`, {
            domain: `test-domain-${i}`,
            metadata: { batch_test: true }
          })
        )
      }

      const responses = await Promise.allSettled(requests)
      const endTime = Date.now()

      const successCount = responses.filter(r => r.status === 'fulfilled').length
      const totalTime = endTime - startTime
      const throughput = (successCount / totalTime) * 1000

      expect(successCount).toBeGreaterThan(requestCount * 0.95) // 95% success rate
      expect(throughput).toBeGreaterThan(100) // At least 100 validations per second
    })

    it('should maintain accuracy under load', async () => {
      const concurrentRequests = 100
      const testText = 'machine learning model for predictive analytics'
      
      const requests = Array(concurrentRequests).fill(null).map(() =>
        axios.post(`${cnsBaseUrl}/semantic/analyze`, {
          text: testText,
          context: { domain: 'ai-marketplace', load_test: true }
        })
      )

      const responses = await Promise.allSettled(requests)
      const successfulResponses = responses
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value.data)

      expect(successfulResponses.length).toBeGreaterThan(concurrentRequests * 0.9)

      // All successful responses should have consistent analysis
      const firstAnalysis = successfulResponses[0].analysis
      
      successfulResponses.forEach(response => {
        expect(response.analysis.intent).toBe(firstAnalysis.intent)
        expect(Math.abs(response.analysis.confidence - firstAnalysis.confidence)).toBeLessThan(0.1)
      })
    })
  })
})

// Utility function for vector similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0
  
  return dotProduct / (magnitudeA * magnitudeB)
}