import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestEnvironment } from '../utils/test-environment'
import { TestDataManager } from '../utils/test-data-manager'
import { MockServices } from '../utils/mock-services'
import axios from 'axios'

describe('Marketplace Transaction Integrity Tests', () => {
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

  describe('Transaction Creation and Validation', () => {
    it('should create transactions with proper validation', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      expect(buyer).toBeDefined()
      expect(seller).toBeDefined()
      expect(asset).toBeDefined()

      // Create transaction
      const transactionResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          buyer_id: buyer!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(transactionResponse.status).toBe(201)
      expect(transactionResponse.data.transaction_id).toBeDefined()
      expect(transactionResponse.data.status).toBe('pending')
      expect(transactionResponse.data.amount).toBe(asset!.price)
      expect(transactionResponse.data.currency).toBe('USD')
      expect(transactionResponse.data.created_at).toBeDefined()

      // Verify transaction validation
      const validationResponse = await axios.get(
        `${services.marketplace.apiUrl}/transactions/${transactionResponse.data.transaction_id}/validate`
      )

      expect(validationResponse.status).toBe(200)
      expect(validationResponse.data.valid).toBe(true)
      expect(validationResponse.data.validation_checks.asset_exists).toBe(true)
      expect(validationResponse.data.validation_checks.seller_authorized).toBe(true)
      expect(validationResponse.data.validation_checks.buyer_verified).toBe(true)
      expect(validationResponse.data.validation_checks.amount_correct).toBe(true)
    })

    it('should prevent invalid transactions', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')

      // Test with non-existent asset
      const invalidAssetResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: 'non-existent-asset',
          seller_id: seller!.id,
          buyer_id: buyer!.id,
          amount: 100,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(invalidAssetResponse.status).toBe(404)
      expect(invalidAssetResponse.data.error).toBe('asset_not_found')

      // Test with incorrect seller
      const asset = dataManager.getAsset('asset-model-001')
      const wrongSeller = dataManager.getUser('user-buyer-002')

      const wrongSellerResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: wrongSeller!.id, // Wrong seller
          buyer_id: buyer!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(wrongSellerResponse.status).toBe(403)
      expect(wrongSellerResponse.data.error).toBe('unauthorized_seller')

      // Test with incorrect amount
      const wrongAmountResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          buyer_id: buyer!.id,
          amount: asset!.price * 0.5, // Wrong amount
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(wrongAmountResponse.status).toBe(400)
      expect(wrongAmountResponse.data.error).toBe('incorrect_amount')
    })
  })

  describe('Payment Processing', () => {
    it('should process payments securely and atomically', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      // Create transaction
      const transactionResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(transactionResponse.status).toBe(201)
      const transactionId = transactionResponse.data.transaction_id

      // Process payment
      const paymentResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions/${transactionId}/process-payment`,
        {
          payment_details: {
            card_token: 'tok_test_visa_4242',
            billing_address: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zip: '12345',
              country: 'US'
            }
          }
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(paymentResponse.status).toBe(200)
      expect(paymentResponse.data.payment_status).toBe('processed')
      expect(paymentResponse.data.payment_id).toBeDefined()
      expect(paymentResponse.data.transaction_status).toBe('completed')

      // Verify atomic completion
      const completedTransactionResponse = await axios.get(
        `${services.marketplace.apiUrl}/transactions/${transactionId}`,
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(completedTransactionResponse.status).toBe(200)
      expect(completedTransactionResponse.data.status).toBe('completed')
      expect(completedTransactionResponse.data.payment_confirmed).toBe(true)
      expect(completedTransactionResponse.data.asset_transferred).toBe(true)
      expect(completedTransactionResponse.data.completed_at).toBeDefined()

      // Verify seller receives payment
      const sellerBalanceResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${seller!.id}/balance`,
        {
          headers: { 'Authorization': `Bearer ${seller!.apiKey}` }
        }
      )

      expect(sellerBalanceResponse.status).toBe(200)
      expect(sellerBalanceResponse.data.pending_earnings).toBeGreaterThanOrEqual(asset!.price * 0.9) // After fees
    })

    it('should handle payment failures gracefully', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      // Create transaction
      const transactionResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(transactionResponse.status).toBe(201)
      const transactionId = transactionResponse.data.transaction_id

      // Attempt payment with invalid card
      const failedPaymentResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions/${transactionId}/process-payment`,
        {
          payment_details: {
            card_token: 'tok_test_declined',
            billing_address: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zip: '12345',
              country: 'US'
            }
          }
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(failedPaymentResponse.status).toBe(400)
      expect(failedPaymentResponse.data.error).toBe('payment_declined')

      // Verify transaction status is correctly updated
      const failedTransactionResponse = await axios.get(
        `${services.marketplace.apiUrl}/transactions/${transactionId}`,
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(failedTransactionResponse.status).toBe(200)
      expect(failedTransactionResponse.data.status).toBe('failed')
      expect(failedTransactionResponse.data.failure_reason).toBe('payment_declined')
      expect(failedTransactionResponse.data.asset_transferred).toBe(false)

      // Verify no money was transferred
      const sellerBalanceResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${seller!.id}/balance`,
        {
          headers: { 'Authorization': `Bearer ${seller!.apiKey}` }
        }
      )

      expect(sellerBalanceResponse.status).toBe(200)
      // Balance should not include the failed transaction
      expect(sellerBalanceResponse.data.pending_earnings).not.toBeGreaterThanOrEqual(asset!.price * 0.9)
    })

    it('should handle partial refunds correctly', async () => {
      // First, complete a successful transaction
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      const transactionResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      const transactionId = transactionResponse.data.transaction_id

      await axios.post(
        `${services.marketplace.apiUrl}/transactions/${transactionId}/process-payment`,
        {
          payment_details: {
            card_token: 'tok_test_visa_4242',
            billing_address: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zip: '12345',
              country: 'US'
            }
          }
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      // Request partial refund
      const refundAmount = asset!.price * 0.3 // 30% refund
      const refundResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions/${transactionId}/refund`,
        {
          amount: refundAmount,
          reason: 'partial_dissatisfaction',
          refund_type: 'partial'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(refundResponse.status).toBe(200)
      expect(refundResponse.data.refund_id).toBeDefined()
      expect(refundResponse.data.refund_amount).toBe(refundAmount)
      expect(refundResponse.data.refund_status).toBe('processed')

      // Verify transaction reflects partial refund
      const updatedTransactionResponse = await axios.get(
        `${services.marketplace.apiUrl}/transactions/${transactionId}`,
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(updatedTransactionResponse.status).toBe(200)
      expect(updatedTransactionResponse.data.refunds).toBeDefined()
      expect(updatedTransactionResponse.data.refunds).toHaveLength(1)
      expect(updatedTransactionResponse.data.refunds[0].amount).toBe(refundAmount)
      expect(updatedTransactionResponse.data.net_amount).toBe(asset!.price - refundAmount)
    })
  })

  describe('Transaction State Management', () => {
    it('should maintain consistent transaction states', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      // Create transaction
      const transactionResponse = await axios.post(
        `${services.marketplace.apiUrl}/transactions`,
        {
          asset_id: asset!.id,
          seller_id: seller!.id,
          amount: asset!.price,
          currency: 'USD',
          payment_method: 'credit_card'
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      const transactionId = transactionResponse.data.transaction_id

      // Verify initial state
      expect(transactionResponse.data.status).toBe('pending')

      // Track state transitions
      const states = ['pending']
      
      // Process payment - should transition to 'processing'
      const paymentProcess = axios.post(
        `${services.marketplace.apiUrl}/transactions/${transactionId}/process-payment`,
        {
          payment_details: {
            card_token: 'tok_test_visa_4242',
            billing_address: {
              street: '123 Test St',
              city: 'Test City',
              state: 'TS',
              zip: '12345',
              country: 'US'
            }
          }
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      // Monitor state during processing
      const stateMonitoring = setInterval(async () => {
        try {
          const stateResponse = await axios.get(
            `${services.marketplace.apiUrl}/transactions/${transactionId}/state`,
            {
              headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
            }
          )
          
          const currentState = stateResponse.data.status
          if (states[states.length - 1] !== currentState) {
            states.push(currentState)
          }
        } catch (error) {
          // Handle monitoring errors
        }
      }, 100) // Check every 100ms

      await paymentProcess
      clearInterval(stateMonitoring)

      // Verify valid state transitions
      expect(states).toContain('pending')
      expect(states).toContain('processing')
      expect(states).toContain('completed')

      // Verify no invalid state transitions occurred
      const validTransitions = {
        'pending': ['processing', 'failed', 'cancelled'],
        'processing': ['completed', 'failed'],
        'completed': ['refunded'],
        'failed': [],
        'cancelled': [],
        'refunded': []
      }

      for (let i = 1; i < states.length; i++) {
        const prevState = states[i - 1]
        const currentState = states[i]
        expect(validTransitions[prevState]).toContain(currentState)
      }
    })

    it('should handle concurrent transaction attempts', async () => {
      const buyers = [
        dataManager.getUser('user-buyer-001'),
        dataManager.getUser('user-buyer-002')
      ]
      const seller = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')

      // Both buyers attempt to purchase the same asset simultaneously
      const concurrentPurchases = buyers.map(buyer =>
        axios.post(
          `${services.marketplace.apiUrl}/transactions`,
          {
            asset_id: asset!.id,
            seller_id: seller!.id,
            amount: asset!.price,
            currency: 'USD',
            payment_method: 'credit_card'
          },
          {
            headers: { 'Authorization': `Bearer ${buyer!.apiKey}` },
            validateStatus: () => true
          }
        )
      )

      const results = await Promise.allSettled(concurrentPurchases)
      const successfulPurchases = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      )

      // For exclusive assets, only one should succeed
      if (asset!.metadata.exclusive) {
        expect(successfulPurchases).toHaveLength(1)
      } else {
        // For non-exclusive assets, both can succeed
        expect(successfulPurchases.length).toBeGreaterThan(0)
      }

      // If one failed, it should be due to availability, not system error
      const failedPurchases = results.filter(r => 
        r.status === 'fulfilled' && r.value.status >= 400
      )

      failedPurchases.forEach((result: any) => {
        expect(result.value.data.error).toBe('asset_not_available')
      })
    })
  })

  describe('Transaction History and Reporting', () => {
    it('should maintain comprehensive transaction history', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      const seller = dataManager.getUser('user-provider-001')

      // Create multiple transactions
      const assets = dataManager.getAllAssets().slice(0, 3)
      const transactionIds: string[] = []

      for (const asset of assets) {
        const transactionResponse = await axios.post(
          `${services.marketplace.apiUrl}/transactions`,
          {
            asset_id: asset.id,
            seller_id: asset.provider,
            amount: asset.price,
            currency: 'USD',
            payment_method: 'credit_card'
          },
          {
            headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
          }
        )

        expect(transactionResponse.status).toBe(201)
        transactionIds.push(transactionResponse.data.transaction_id)

        // Complete the transaction
        await axios.post(
          `${services.marketplace.apiUrl}/transactions/${transactionResponse.data.transaction_id}/process-payment`,
          {
            payment_details: {
              card_token: 'tok_test_visa_4242',
              billing_address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zip: '12345',
                country: 'US'
              }
            }
          },
          {
            headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
          }
        )
      }

      // Get buyer's transaction history
      const buyerHistoryResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${buyer!.id}/transactions`,
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(buyerHistoryResponse.status).toBe(200)
      expect(buyerHistoryResponse.data.transactions).toHaveLength.greaterThanOrEqual(3)

      // Verify transaction details in history
      buyerHistoryResponse.data.transactions.forEach((transaction: any) => {
        expect(transaction.buyer_id).toBe(buyer!.id)
        expect(transaction.status).toBe('completed')
        expect(transaction.amount).toBeGreaterThan(0)
        expect(transaction.created_at).toBeDefined()
        expect(transaction.completed_at).toBeDefined()
      })

      // Get seller's transaction history
      const sellerHistoryResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${seller!.id}/transactions`,
        {
          params: { role: 'seller' },
          headers: { 'Authorization': `Bearer ${seller!.apiKey}` }
        }
      )

      expect(sellerHistoryResponse.status).toBe(200)
      expect(sellerHistoryResponse.data.transactions.length).toBeGreaterThan(0)

      // Verify seller transaction details
      sellerHistoryResponse.data.transactions.forEach((transaction: any) => {
        expect(transaction.seller_id).toBe(seller!.id)
        expect(transaction.net_earnings).toBeDefined()
        expect(transaction.commission_fee).toBeDefined()
      })
    })

    it('should generate accurate financial reports', async () => {
      const reportingPeriod = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        end_date: new Date().toISOString()
      }

      // Generate revenue report
      const revenueReportResponse = await axios.post(
        `${services.marketplace.apiUrl}/reporting/revenue`,
        {
          period: reportingPeriod,
          breakdown_by: ['asset_type', 'seller', 'payment_method']
        },
        {
          headers: { 'Authorization': `Bearer ${dataManager.getUser('user-admin-001')!.apiKey}` }
        }
      )

      expect(revenueReportResponse.status).toBe(200)
      expect(revenueReportResponse.data.total_revenue).toBeGreaterThanOrEqual(0)
      expect(revenueReportResponse.data.total_transactions).toBeGreaterThanOrEqual(0)
      expect(revenueReportResponse.data.average_transaction_value).toBeGreaterThanOrEqual(0)

      expect(revenueReportResponse.data.breakdown_by_asset_type).toBeDefined()
      expect(revenueReportResponse.data.breakdown_by_seller).toBeDefined()
      expect(revenueReportResponse.data.breakdown_by_payment_method).toBeDefined()

      // Generate reconciliation report
      const reconciliationResponse = await axios.post(
        `${services.marketplace.apiUrl}/reporting/reconciliation`,
        {
          period: reportingPeriod,
          include_refunds: true,
          include_fees: true
        },
        {
          headers: { 'Authorization': `Bearer ${dataManager.getUser('user-admin-001')!.apiKey}` }
        }
      )

      expect(reconciliationResponse.status).toBe(200)
      expect(reconciliationResponse.data.total_gross_sales).toBeDefined()
      expect(reconciliationResponse.data.total_refunds).toBeDefined()
      expect(reconciliationResponse.data.total_fees_collected).toBeDefined()
      expect(reconciliationResponse.data.net_revenue).toBeDefined()

      // Verify mathematical accuracy
      const expectedNetRevenue = 
        reconciliationResponse.data.total_gross_sales -
        reconciliationResponse.data.total_refunds -
        reconciliationResponse.data.total_fees_collected

      expect(Math.abs(reconciliationResponse.data.net_revenue - expectedNetRevenue)).toBeLessThan(0.01)
    })

    it('should support transaction filtering and search', async () => {
      const buyer = dataManager.getUser('user-buyer-001')

      // Test various filter combinations
      const filterTests = [
        {
          name: 'By status',
          params: { status: 'completed' }
        },
        {
          name: 'By amount range',
          params: { min_amount: 100, max_amount: 1000 }
        },
        {
          name: 'By date range',
          params: {
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
          }
        },
        {
          name: 'By asset type',
          params: { asset_type: 'model' }
        }
      ]

      for (const filterTest of filterTests) {
        const filterResponse = await axios.get(
          `${services.marketplace.apiUrl}/users/${buyer!.id}/transactions`,
          {
            params: filterTest.params,
            headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
          }
        )

        expect(filterResponse.status).toBe(200)
        expect(filterResponse.data.transactions).toBeDefined()
        expect(filterResponse.data.total_count).toBeGreaterThanOrEqual(0)

        // Verify filter is applied correctly
        if (filterTest.params.status) {
          filterResponse.data.transactions.forEach((tx: any) => {
            expect(tx.status).toBe(filterTest.params.status)
          })
        }

        if (filterTest.params.min_amount) {
          filterResponse.data.transactions.forEach((tx: any) => {
            expect(tx.amount).toBeGreaterThanOrEqual(filterTest.params.min_amount)
          })
        }

        if (filterTest.params.max_amount) {
          filterResponse.data.transactions.forEach((tx: any) => {
            expect(tx.amount).toBeLessThanOrEqual(filterTest.params.max_amount)
          })
        }
      }

      // Test search functionality
      const searchResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${buyer!.id}/transactions/search`,
        {
          params: { query: 'neural network', search_fields: ['asset_name', 'asset_description'] },
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(searchResponse.status).toBe(200)
      expect(searchResponse.data.transactions).toBeDefined()
      expect(searchResponse.data.search_metadata).toBeDefined()
      expect(searchResponse.data.search_metadata.query).toBe('neural network')
    })
  })
})