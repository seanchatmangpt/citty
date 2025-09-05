import { TransactionEngine } from '../../../src/transaction-engine'
import type { TransactionDimension } from '../../../types/dimensional-models'
import { z } from 'zod'

// Transaction query schema
const TransactionQuerySchema = z.object({
  userId: z.string().optional(),
  itemId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'processing', 'completed', 'cancelled', 'disputed']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['timestamp', 'amount', 'status']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

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
    const query = getQuery(event)
    
    // Validate query parameters
    const params = TransactionQuerySchema.parse({
      userId: query.userId as string,
      itemId: query.itemId as string,
      status: query.status as string,
      limit: query.limit ? parseInt(query.limit as string) : 20,
      offset: query.offset ? parseInt(query.offset as string) : 0,
      sortBy: query.sortBy as string || 'timestamp',
      sortOrder: query.sortOrder as string || 'desc'
    })

    const engine = getTransactionEngine()
    let transactions: TransactionDimension[] = []

    // Get transactions based on query parameters
    if (params.userId) {
      transactions = engine.getTransactionHistory(params.userId, params.limit + params.offset)
    } else if (params.itemId) {
      // Get all transactions and filter by item
      const allTransactions = Array.from((engine as any).transactions.values()) as TransactionDimension[]
      transactions = allTransactions.filter(t => t.product.id === params.itemId)
    } else {
      // Get all transactions (admin/monitoring use case)
      const allTransactions = Array.from((engine as any).transactions.values()) as TransactionDimension[]
      transactions = allTransactions
    }

    // Apply status filter
    if (params.status) {
      transactions = transactions.filter(t => t.status === params.status)
    }

    // Apply sorting
    transactions.sort((a, b) => {
      let comparison = 0
      
      switch (params.sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime()
          break
        case 'amount':
          comparison = a.pricing.final - b.pricing.final
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      
      return params.sortOrder === 'asc' ? comparison : -comparison
    })

    // Apply pagination
    const total = transactions.length
    const paginatedTransactions = transactions.slice(params.offset, params.offset + params.limit)
    const hasMore = params.offset + params.limit < total

    // Transform to API response format
    const transformedTransactions = paginatedTransactions.map(transaction => ({
      id: transaction.id,
      itemId: transaction.product.id,
      itemName: `Product ${transaction.product.id}`, // In production, fetch actual item name
      buyerId: transaction.buyer.id,
      sellerId: transaction.seller.id,
      amount: transaction.pricing.final,
      currency: transaction.pricing.currency,
      status: transaction.status,
      timestamp: transaction.timestamp,
      workflowState: {
        currentStep: getWorkflowStep(transaction.status),
        completedSteps: getCompletedSteps(transaction.status),
        remainingSteps: getRemainingSteps(transaction.status),
        progress: getProgress(transaction.status),
        metadata: {
          trust_score: transaction.metrics.trust,
          distance: transaction.metrics.distance,
          similarity: transaction.metrics.similarity,
          security_verified: transaction.security.verified
        }
      },
      dimensions: {
        trust_score: transaction.metrics.trust || 0,
        distance: transaction.metrics.distance || 0,
        similarity: transaction.metrics.similarity || 0,
        complexity: Object.keys(transaction.coordinates).length
      },
      pricing: {
        base: transaction.pricing.base,
        adjustments: transaction.pricing.adjustments,
        final: transaction.pricing.final,
        currency: transaction.pricing.currency
      },
      security: {
        verified: transaction.security.verified,
        hash: transaction.security.hash.substring(0, 8) + '...', // Truncate for security
        risk_level: transaction.metrics.trust ? 
          (transaction.metrics.trust > 0.8 ? 'low' : 
           transaction.metrics.trust > 0.5 ? 'medium' : 'high') : 'unknown'
      }
    }))

    return {
      transactions: transformedTransactions,
      total,
      hasMore,
      pagination: {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      },
      filters: {
        userId: params.userId,
        itemId: params.itemId,
        status: params.status
      }
    }

  } catch (error: any) {
    console.error('Transactions API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Transactions error: ${error.message || 'Internal server error'}`
    })
  }
})

// Helper functions for workflow state
function getWorkflowStep(status: string): string {
  const stepMap: Record<string, string> = {
    'pending': 'payment_verification',
    'confirmed': 'order_processing',
    'processing': 'fulfillment',
    'completed': 'delivery_confirmation',
    'cancelled': 'cancellation_processed',
    'disputed': 'dispute_resolution'
  }
  return stepMap[status] || 'unknown'
}

function getCompletedSteps(status: string): string[] {
  const stepSequence = ['order_created', 'payment_verification', 'order_processing', 'fulfillment', 'delivery_confirmation']
  const statusIndex = {
    'pending': 0,
    'confirmed': 1,
    'processing': 2,
    'completed': 4,
    'cancelled': 0,
    'disputed': 1
  }
  
  const index = statusIndex[status as keyof typeof statusIndex] || 0
  return stepSequence.slice(0, index + 1)
}

function getRemainingSteps(status: string): string[] {
  const stepSequence = ['order_created', 'payment_verification', 'order_processing', 'fulfillment', 'delivery_confirmation']
  const statusIndex = {
    'pending': 0,
    'confirmed': 1,
    'processing': 2,
    'completed': 4,
    'cancelled': 0,
    'disputed': 1
  }
  
  const index = statusIndex[status as keyof typeof statusIndex] || 0
  return status === 'completed' || status === 'cancelled' ? [] : stepSequence.slice(index + 1)
}

function getProgress(status: string): number {
  const progressMap: Record<string, number> = {
    'pending': 0.2,
    'confirmed': 0.4,
    'processing': 0.7,
    'completed': 1.0,
    'cancelled': 0.0,
    'disputed': 0.3
  }
  return progressMap[status] || 0
}