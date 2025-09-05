import { TransactionEngine } from '../../../src/transaction-engine'
import type { TransactionContext, TransactionResult } from '../../../src/transaction-engine'
import type { ProductDimension, UserDimension } from '../../../types/dimensional-models'
import { getMarketplaceWebSocket } from './websocket'
import { z } from 'zod'

// Transaction creation schema
const CreateTransactionSchema = z.object({
  buyerId: z.string().min(1),
  sellerId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  metadata: z.record(z.unknown()).optional()
})

// Mock user and product data - in production, fetch from database
function createMockUser(userId: string): UserDimension {
  const userNumber = parseInt(userId.slice(-1)) || 1
  
  return {
    id: userId,
    coordinates: {
      experience: Math.random() * 10,
      trust_score: 3 + Math.random() * 2,
      location_x: Math.random() * 100,
      location_y: Math.random() * 100
    },
    timestamp: new Date(),
    version: 1,
    profile: {
      name: `User${userNumber}`,
      email: `user${userNumber}@marketplace.dev`,
      preferences: {
        price_sensitivity: Math.random(),
        quality_preference: Math.random(),
        speed_preference: Math.random()
      },
      history: []
    },
    behavior: {
      browsingPattern: {
        session_duration: Math.random() * 60,
        pages_viewed: Math.floor(Math.random() * 20),
        searches_performed: Math.floor(Math.random() * 10)
      },
      purchaseHistory: [],
      engagement: {
        reviews_written: Math.floor(Math.random() * 5),
        items_favorited: Math.floor(Math.random() * 10),
        social_shares: Math.floor(Math.random() * 3)
      }
    },
    reputation: {
      score: 3 + Math.random() * 2,
      reviews: Math.floor(Math.random() * 20),
      transactions: Math.floor(Math.random() * 50)
    }
  }
}

function createMockProduct(productId: string): ProductDimension {
  const productNumber = parseInt(productId.slice(-1)) || 1
  const basePrice = [0, 49, 79, 199, 0, 299, 149, 89, 129, 119, 0, 249][productNumber - 1] || 99
  
  return {
    id: productId,
    coordinates: {
      complexity: 4 + Math.random() * 5,
      popularity: 5 + Math.random() * 5,
      maintainability: 6 + Math.random() * 4,
      performance: 7 + Math.random() * 3,
      security: 7 + Math.random() * 3
    },
    timestamp: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
    version: Math.floor(Math.random() * 3) + 1,
    name: `Product ${productId}`,
    description: `Professional marketplace item ${productId} with advanced features`,
    price: {
      base: basePrice,
      currency: 'USD',
      dimensions: {
        complexity_premium: Math.random() * 10,
        popularity_discount: -Math.random() * 5
      }
    },
    categories: ['template', 'plugin', 'workflow'][Math.floor(Math.random() * 3)] === 'template' ? 
      ['cli', 'web'] : ['api', 'library'],
    attributes: {
      downloads: Math.floor(Math.random() * 50000),
      rating: 3.5 + Math.random() * 1.5,
      verified: Math.random() > 0.3,
      tags: ['professional', 'tested', 'documented']
    },
    availability: {
      total: 1000,
      byDimension: {}
    },
    quality: {
      score: 0.7 + Math.random() * 0.3,
      metrics: {
        codeQuality: 0.8 + Math.random() * 0.2,
        documentation: 0.7 + Math.random() * 0.3,
        tests: 0.6 + Math.random() * 0.4
      }
    },
    seller: {
      id: `seller${Math.floor(Math.random() * 5) + 1}`,
      reputation: 4 + Math.random(),
      coordinates: {
        experience: Math.floor(Math.random() * 10),
        reliability: 4 + Math.random(),
        responseTime: 2 + Math.random() * 3
      }
    }
  }
}

// Global transaction engine instance
let transactionEngine: TransactionEngine | null = null

function getTransactionEngine(): TransactionEngine {
  if (!transactionEngine) {
    transactionEngine = new TransactionEngine()
  }
  return transactionEngine
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate request body
    const transactionData = CreateTransactionSchema.parse(body)
    
    const engine = getTransactionEngine()
    
    // Create mock user and product data (in production, fetch from database)
    const buyer = createMockUser(transactionData.buyerId)
    const seller = createMockUser(transactionData.sellerId)
    const product = createMockProduct(transactionData.productId)
    
    // Validate that buyer and seller are different
    if (transactionData.buyerId === transactionData.sellerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Buyer and seller cannot be the same user'
      })
    }
    
    // Create transaction context
    const context: TransactionContext = {
      buyer,
      seller,
      product,
      quantity: transactionData.quantity,
      metadata: transactionData.metadata
    }
    
    // Create the transaction
    const result: TransactionResult = await engine.createTransaction(context)
    
    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Transaction creation failed',
        data: {
          errors: result.errors,
          warnings: result.warnings
        }
      })
    }
    
    // Transform transaction for API response
    const apiTransaction = {
      id: result.transaction.id,
      itemId: result.transaction.product.id,
      itemName: product.name,
      buyerId: result.transaction.buyer.id,
      sellerId: result.transaction.seller.id,
      amount: result.transaction.pricing.final,
      currency: result.transaction.pricing.currency,
      status: result.transaction.status,
      timestamp: result.transaction.timestamp,
      workflowState: {
        currentStep: 'payment_verification',
        completedSteps: ['order_created'],
        remainingSteps: ['payment_verification', 'order_processing', 'fulfillment', 'delivery_confirmation'],
        progress: 0.1,
        metadata: {
          trust_score: result.transaction.metrics.trust,
          distance: result.transaction.metrics.distance,
          similarity: result.transaction.metrics.similarity,
          security_verified: result.transaction.security.verified
        }
      },
      dimensions: {
        trust_score: result.transaction.metrics.trust || 0,
        distance: result.transaction.metrics.distance || 0,
        similarity: result.transaction.metrics.similarity || 0,
        complexity: Object.keys(result.transaction.coordinates).length
      },
      pricing: result.transaction.pricing,
      security: {
        verified: result.transaction.security.verified,
        hash: result.transaction.security.hash.substring(0, 8) + '...',
        risk_level: result.transaction.metrics.trust ? 
          (result.transaction.metrics.trust > 0.8 ? 'low' : 
           result.transaction.metrics.trust > 0.5 ? 'medium' : 'high') : 'unknown'
      },
      warnings: result.warnings
    }
    
    // Broadcast real-time update via WebSocket
    const ws = getMarketplaceWebSocket()
    if (ws) {
      // Notify buyer and seller
      ws.broadcastTransactionUpdate(result.transaction.id, {
        type: 'transaction_created',
        transaction: apiTransaction,
        userId: transactionData.buyerId
      })
      
      ws.broadcastTransactionUpdate(result.transaction.id, {
        type: 'transaction_created',
        transaction: apiTransaction,
        userId: transactionData.sellerId
      })
      
      // Notify item watchers
      ws.broadcastItemUpdate(transactionData.productId, {
        type: 'item_update',
        data: {
          action: 'transaction_created',
          transactionId: result.transaction.id,
          newPurchase: true
        }
      })
    }
    
    return {
      success: true,
      transaction: apiTransaction,
      message: 'Transaction created successfully'
    }
    
  } catch (error: any) {
    console.error('Transaction creation error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid transaction data',
        data: error.errors
      })
    }
    
    // Handle specific transaction errors
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Transaction error: ${error.message || 'Internal server error'}`
    })
  }
})