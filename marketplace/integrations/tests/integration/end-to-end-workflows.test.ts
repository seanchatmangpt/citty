import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestEnvironment } from '../utils/test-environment'
import { TestDataManager } from '../utils/test-data-manager'
import { MockServices } from '../utils/mock-services'
import axios from 'axios'
import WebSocket from 'ws'

describe('End-to-End Workflow Integration Tests', () => {
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
  })

  afterAll(async () => {
    await mockServices.stop()
    await dataManager.cleanup()
    await testEnv.destroy()
  })

  beforeEach(async () => {
    await dataManager.reset()
  })

  describe('Asset Discovery and Purchase Workflow', () => {
    it('should complete full asset discovery to purchase workflow', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const provider = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      expect(buyer).toBeDefined()
      expect(provider).toBeDefined()
      expect(asset).toBeDefined()

      // Step 1: Discover assets using CNS semantic search
      const searchResponse = await axios.post(
        `${services.cns.baseUrl}/semantic/analyze`,
        {
          text: 'advanced natural language processing model',
          context: {
            domain: 'ai-marketplace',
            user_id: buyer!.id
          }
        }
      )

      expect(searchResponse.status).toBe(200)
      expect(searchResponse.data.analysis).toBeDefined()
      expect(searchResponse.data.analysis.entities).toContain('nlp')

      // Step 2: Search marketplace using semantic vectors
      const marketplaceSearchResponse = await axios.get(
        `${services.marketplace.apiUrl}/assets/search`,
        {
          params: {
            query: 'nlp model',
            semantic_vector: JSON.stringify(searchResponse.data.analysis.dimensions.semantic)
          },
          headers: {
            'Authorization': `Bearer ${buyer!.apiKey}`
          }
        }
      )

      expect(marketplaceSearchResponse.status).toBe(200)
      expect(marketplaceSearchResponse.data.assets).toHaveLength.greaterThan(0)

      // Step 3: Get asset details with ByteStar performance metrics
      const assetDetailsResponse = await axios.get(
        `${services.marketplace.apiUrl}/assets/${asset!.id}`,
        {
          headers: {
            'Authorization': `Bearer ${buyer!.apiKey}`
          }
        }
      )

      expect(assetDetailsResponse.status).toBe(200)
      expect(assetDetailsResponse.data.id).toBe(asset!.id)

      // Step 4: Validate asset using CNS
      const validationResponse = await axios.post(
        `${services.cns.baseUrl}/validate`,
        {
          domain: asset!.name.toLowerCase().replace(/\s+/g, '-'),
          metadata: asset!.metadata
        }
      )

      expect(validationResponse.status).toBe(200)
      expect(validationResponse.data.valid).toBe(true)
      expect(validationResponse.data.validationTime).toBe('10ns')

      // Step 5: Get ByteStar performance preview
      const performanceResponse = await axios.post(
        `${services.bytestar.baseUrl}/inference`,
        {
          model: asset!.id,
          input: 'test input for performance evaluation',
          parameters: { preview: true }
        }
      )

      expect(performanceResponse.status).toBe(200)
      expect(performanceResponse.data.performance.ops_used).toBeGreaterThan(0)

      // Step 6: Create purchase transaction
      const purchaseResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: provider!.id,
          payment_method: 'credit_card'
        },
        {
          headers: {
            'Authorization': `Bearer ${buyer!.apiKey}`
          }
        }
      )

      expect(purchaseResponse.status).toBe(201)
      expect(purchaseResponse.data.transaction_id).toBeDefined()

      // Step 7: Verify transaction completion
      const transactionId = purchaseResponse.data.transaction_id
      
      // Wait for transaction processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      const transactionStatusResponse = await axios.get(
        `${services.marketplace.apiUrl}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${buyer!.apiKey}`
          }
        }
      )

      expect(transactionStatusResponse.status).toBe(200)
      expect(transactionStatusResponse.data.status).toBe('completed')

      // Step 8: Verify access to purchased asset
      const accessResponse = await axios.get(
        `${services.marketplace.apiUrl}/assets/${asset!.id}/access`,
        {
          headers: {
            'Authorization': `Bearer ${buyer!.apiKey}`
          }
        }
      )

      expect(accessResponse.status).toBe(200)
      expect(accessResponse.data.access_granted).toBe(true)
      expect(accessResponse.data.download_url).toBeDefined()
    })

    it('should handle workflow failures gracefully', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      
      // Simulate service failure
      mockServices.simulateServiceFailure('cns', 2000)

      // Attempt workflow with failed service
      const searchRequest = axios.post(
        `${services.cns.baseUrl}/semantic/analyze`,
        {
          text: 'test query',
          context: { user_id: buyer!.id }
        }
      )

      // Should handle gracefully with fallback
      await expect(searchRequest).rejects.toThrow()

      // Verify marketplace can still function with reduced capability
      const directSearchResponse = await axios.get(
        `${services.marketplace.apiUrl}/assets/search`,
        {
          params: { query: 'test' },
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(directSearchResponse.status).toBe(200)
    })
  })

  describe('Real-time Data Synchronization', () => {
    it('should maintain data consistency across all systems', async () => {
      const provider = dataManager.getUser('user-provider-001')
      
      // Create WebSocket connections to all services
      const cnsWs = await testEnv.createWebSocketConnection(services.cns.wsUrl)
      const marketplaceWs = await testEnv.createWebSocketConnection(services.marketplace.websocketUrl)

      const cnsUpdates: any[] = []
      const marketplaceUpdates: any[] = []

      cnsWs.on('message', (data) => {
        cnsUpdates.push(JSON.parse(data.toString()))
      })

      marketplaceWs.on('message', (data) => {
        marketplaceUpdates.push(JSON.parse(data.toString()))
      })

      // Create a new asset
      const newAsset = dataManager.createRandomAsset(provider!.id)
      
      const createAssetResponse = await axios.post(
        `${services.marketplace.apiUrl}/assets`,
        newAsset,
        {
          headers: {
            'Authorization': `Bearer ${provider!.apiKey}`
          }
        }
      )

      expect(createAssetResponse.status).toBe(201)

      // Wait for real-time updates
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Verify CNS received validation request
      expect(cnsUpdates).toHaveLength.greaterThan(0)
      
      // Verify marketplace broadcast the new asset
      expect(marketplaceUpdates.some(update => 
        update.type === 'asset_created' && update.asset_id === newAsset.id
      )).toBe(true)

      // Update the asset
      const updatedMetadata = { ...newAsset.metadata, version: '1.1.0' }
      
      const updateAssetResponse = await axios.put(
        `${services.marketplace.apiUrl}/assets/${newAsset.id}`,
        { metadata: updatedMetadata },
        {
          headers: {
            'Authorization': `Bearer ${provider!.apiKey}`
          }
        }
      )

      expect(updateAssetResponse.status).toBe(200)

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verify update propagation
      expect(marketplaceUpdates.some(update => 
        update.type === 'asset_updated' && update.asset_id === newAsset.id
      )).toBe(true)

      cnsWs.close()
      marketplaceWs.close()
    })
  })

  describe('Performance Under Load', () => {
    it('should maintain performance standards under concurrent load', async () => {
      const users = dataManager.getAllUsers()
      const assets = dataManager.getAllAssets()

      // Create concurrent requests
      const concurrentRequests = 50
      const requests = []

      for (let i = 0; i < concurrentRequests; i++) {
        const user = users[i % users.length]
        const asset = assets[i % assets.length]

        // Mix of different operations
        if (i % 3 === 0) {
          // Semantic search
          requests.push(
            axios.post(`${services.cns.baseUrl}/semantic/analyze`, {
              text: `search query ${i}`,
              context: { user_id: user.id }
            })
          )
        } else if (i % 3 === 1) {
          // Asset lookup
          requests.push(
            axios.get(`${services.marketplace.apiUrl}/assets/${asset.id}`, {
              headers: { 'Authorization': `Bearer ${user.apiKey}` }
            })
          )
        } else {
          // ByteStar inference
          requests.push(
            axios.post(`${services.bytestar.baseUrl}/inference`, {
              model: asset.id,
              input: `test input ${i}`
            })
          )
        }
      }

      const startTime = Date.now()
      const responses = await Promise.allSettled(requests)
      const endTime = Date.now()

      const totalTime = endTime - startTime
      const successfulRequests = responses.filter(r => r.status === 'fulfilled').length
      const throughput = (successfulRequests / totalTime) * 1000 // requests per second

      expect(successfulRequests).toBeGreaterThan(concurrentRequests * 0.95) // 95% success rate
      expect(throughput).toBeGreaterThan(10) // At least 10 RPS
      expect(totalTime).toBeLessThan(10000) // Complete within 10 seconds
    })
  })

  describe('Cross-System Feature Interactions', () => {
    it('should handle complex multi-system feature interactions', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const provider = dataManager.getUser('user-provider-001')
      
      // Test: AI-powered asset recommendation
      // 1. Get user behavior data from marketplace
      const behaviorResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${buyer!.id}/behavior`,
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(behaviorResponse.status).toBe(200)

      // 2. Use CNS to analyze preferences semantically
      const preferenceAnalysis = await axios.post(
        `${services.cns.baseUrl}/semantic/analyze`,
        {
          text: behaviorResponse.data.search_history.join(' '),
          context: { 
            type: 'user_preferences',
            user_id: buyer!.id 
          }
        }
      )

      expect(preferenceAnalysis.status).toBe(200)

      // 3. Use ByteStar to generate recommendations
      const recommendationResponse = await axios.post(
        `${services.bytestar.baseUrl}/inference`,
        {
          model: 'recommendation_engine',
          input: {
            user_preferences: preferenceAnalysis.data.analysis,
            available_assets: dataManager.getAllAssets().map(a => a.id)
          }
        }
      )

      expect(recommendationResponse.status).toBe(200)
      expect(recommendationResponse.data.result).toBeDefined()

      // 4. Validate recommendations back through marketplace
      const validatedRecommendations = await axios.post(
        `${services.marketplace.apiUrl}/recommendations/validate`,
        {
          user_id: buyer!.id,
          recommendations: recommendationResponse.data.result.prediction
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(validatedRecommendations.status).toBe(200)
      expect(validatedRecommendations.data.valid_recommendations).toBeDefined()
    })
  })
})