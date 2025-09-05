import { Request, Response } from 'express'
import { ApiError, NotFoundError, ForbiddenError } from '../../utils/errors.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

interface Transaction {
  id: string
  itemId: string
  buyerId: string
  sellerId: string
  amount: number
  quantity: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'disputed' | 'refunded'
  paymentMethod: 'credit_card' | 'paypal' | 'crypto' | 'bank_transfer'
  paymentStatus: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'
  shippingAddress: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  escrowStatus: 'held' | 'released' | 'refunded'
  fees: {
    platform: number
    payment: number
    total: number
  }
  notes?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  disputeId?: string
}

interface TransactionHistory {
  id: string
  transactionId: string
  status: string
  timestamp: Date
  actor: string
  description: string
  metadata?: any
}

interface Dispute {
  id: string
  transactionId: string
  initiatorId: string
  reason: string
  description: string
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  createdAt: Date
  resolvedAt?: Date
}

// Mock database
const mockTransactionData = {
  transactions: new Map<string, Transaction>(),
  history: new Map<string, TransactionHistory[]>(),
  disputes: new Map<string, Dispute>(),
  escrowHoldings: new Map<string, { amount: number, heldAt: Date }>(),
}

// Initialize mock data
const initMockTransactionData = () => {
  const sampleTransaction: Transaction = {
    id: 'txn-1',
    itemId: 'item-1',
    buyerId: 'user-2',
    sellerId: 'user-1',
    amount: 89.99,
    quantity: 1,
    status: 'completed',
    paymentMethod: 'credit_card',
    paymentStatus: 'captured',
    shippingAddress: {
      name: 'John Doe',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    escrowStatus: 'released',
    fees: {
      platform: 4.50,
      payment: 2.70,
      total: 7.20,
    },
    notes: 'First transaction',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-16T15:30:00Z'),
    completedAt: new Date('2024-01-16T15:30:00Z'),
  }

  mockTransactionData.transactions.set(sampleTransaction.id, sampleTransaction)
  
  // Sample transaction history
  const sampleHistory: TransactionHistory[] = [
    {
      id: 'hist-1',
      transactionId: 'txn-1',
      status: 'pending',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      actor: 'user-2',
      description: 'Transaction created',
    },
    {
      id: 'hist-2',
      transactionId: 'txn-1',
      status: 'processing',
      timestamp: new Date('2024-01-15T10:05:00Z'),
      actor: 'system',
      description: 'Payment authorized',
    },
    {
      id: 'hist-3',
      transactionId: 'txn-1',
      status: 'completed',
      timestamp: new Date('2024-01-16T15:30:00Z'),
      actor: 'user-1',
      description: 'Item shipped and delivered',
    },
  ]
  
  mockTransactionData.history.set('txn-1', sampleHistory)
}

initMockTransactionData()

export const transactionController = {
  // POST /api/transactions - Create new transaction
  async createTransaction(req: AuthRequest, res: Response) {
    const {
      itemId,
      sellerId,
      amount,
      quantity = 1,
      paymentMethod,
      shippingAddress,
      notes,
    } = req.body
    
    const buyerId = req.user!.id

    // Calculate fees
    const platformFeeRate = 0.05 // 5%
    const paymentFeeRate = 0.03 // 3%
    
    const platformFee = amount * platformFeeRate
    const paymentFee = amount * paymentFeeRate
    const totalFees = platformFee + paymentFee

    const newTransaction: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      buyerId,
      sellerId,
      amount,
      quantity,
      status: 'pending',
      paymentMethod,
      paymentStatus: 'pending',
      shippingAddress,
      escrowStatus: 'held',
      fees: {
        platform: platformFee,
        payment: paymentFee,
        total: totalFees,
      },
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockTransactionData.transactions.set(newTransaction.id, newTransaction)

    // Add to transaction history
    const historyEntry: TransactionHistory = {
      id: `hist-${Date.now()}`,
      transactionId: newTransaction.id,
      status: 'pending',
      timestamp: new Date(),
      actor: buyerId,
      description: 'Transaction initiated',
    }
    
    mockTransactionData.history.set(newTransaction.id, [historyEntry])

    // Hold funds in escrow
    mockTransactionData.escrowHoldings.set(newTransaction.id, {
      amount: amount + totalFees,
      heldAt: new Date(),
    })

    res.status(201).json({
      success: true,
      data: { transaction: newTransaction },
      message: 'Transaction created successfully',
    })
  },

  // GET /api/transactions - Get user's transactions
  async getTransactions(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const {
      status,
      role = 'both', // 'buyer', 'seller', 'both'
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any

    let transactions = Array.from(mockTransactionData.transactions.values())

    // Filter by user role
    if (role === 'buyer') {
      transactions = transactions.filter(t => t.buyerId === userId)
    } else if (role === 'seller') {
      transactions = transactions.filter(t => t.sellerId === userId)
    } else {
      transactions = transactions.filter(t => t.buyerId === userId || t.sellerId === userId)
    }

    // Filter by status
    if (status) {
      transactions = transactions.filter(t => t.status === status)
    }

    // Sort
    transactions.sort((a, b) => {
      const aValue = a[sortBy as keyof Transaction] as any
      const bValue = b[sortBy as keyof Transaction] as any
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedTransactions = transactions.slice(startIndex, endIndex)

    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          page,
          limit,
          total: transactions.length,
          totalPages: Math.ceil(transactions.length / limit),
          hasNext: endIndex < transactions.length,
          hasPrev: page > 1,
        },
        summary: {
          total: transactions.length,
          pending: transactions.filter(t => t.status === 'pending').length,
          completed: transactions.filter(t => t.status === 'completed').length,
          disputed: transactions.filter(t => t.status === 'disputed').length,
        },
      },
    })
  },

  // GET /api/transactions/:id - Get transaction details
  async getTransaction(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization
    if (
      transaction.buyerId !== userId && 
      transaction.sellerId !== userId && 
      userRole !== 'admin'
    ) {
      throw new ForbiddenError('You can only view your own transactions')
    }

    // Get transaction history
    const history = mockTransactionData.history.get(id) || []

    // Get dispute info if exists
    const dispute = transaction.disputeId 
      ? mockTransactionData.disputes.get(transaction.disputeId)
      : null

    res.json({
      success: true,
      data: {
        transaction,
        history,
        dispute,
        escrowHolding: mockTransactionData.escrowHoldings.get(id),
      },
    })
  },

  // PUT /api/transactions/:id/status - Update transaction status
  async updateTransactionStatus(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { status, reason } = req.body
    const userId = req.user!.id
    const userRole = req.user!.role

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization
    const isAuthorized = 
      transaction.buyerId === userId || 
      transaction.sellerId === userId || 
      userRole === 'admin'

    if (!isAuthorized) {
      throw new ForbiddenError('You can only update your own transactions')
    }

    const validStatusTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['completed', 'cancelled', 'disputed'],
      completed: ['disputed'],
      cancelled: [],
      disputed: ['resolved', 'closed'],
      refunded: [],
    }

    if (!validStatusTransitions[transaction.status].includes(status)) {
      throw new ApiError(400, `Cannot change status from ${transaction.status} to ${status}`)
    }

    // Update transaction
    const updatedTransaction = {
      ...transaction,
      status,
      updatedAt: new Date(),
      ...(status === 'completed' && { completedAt: new Date() }),
    }

    mockTransactionData.transactions.set(id, updatedTransaction)

    // Add to history
    const historyEntry: TransactionHistory = {
      id: `hist-${Date.now()}`,
      transactionId: id,
      status,
      timestamp: new Date(),
      actor: userId,
      description: reason || `Status changed to ${status}`,
    }

    const existingHistory = mockTransactionData.history.get(id) || []
    existingHistory.push(historyEntry)
    mockTransactionData.history.set(id, existingHistory)

    // Handle escrow release for completed transactions
    if (status === 'completed') {
      const escrowHolding = mockTransactionData.escrowHoldings.get(id)
      if (escrowHolding) {
        updatedTransaction.escrowStatus = 'released'
        // In a real system, this would transfer funds to the seller
        console.log(`Released $${escrowHolding.amount} from escrow for transaction ${id}`)
      }
    }

    res.json({
      success: true,
      data: { transaction: updatedTransaction },
      message: `Transaction status updated to ${status}`,
    })
  },

  // POST /api/transactions/:id/payment - Process payment
  async processPayment(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { paymentToken, billingAddress } = req.body
    const userId = req.user!.id

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    if (transaction.buyerId !== userId) {
      throw new ForbiddenError('Only the buyer can process payment')
    }

    if (transaction.paymentStatus !== 'pending') {
      throw new ApiError(400, `Payment already ${transaction.paymentStatus}`)
    }

    // Mock payment processing
    const paymentResult = await mockPaymentProcessor(
      transaction,
      paymentToken,
      billingAddress
    )

    if (paymentResult.success) {
      const updatedTransaction = {
        ...transaction,
        paymentStatus: 'captured' as const,
        status: 'processing' as const,
        updatedAt: new Date(),
      }

      mockTransactionData.transactions.set(id, updatedTransaction)

      // Add to history
      const historyEntry: TransactionHistory = {
        id: `hist-${Date.now()}`,
        transactionId: id,
        status: 'processing',
        timestamp: new Date(),
        actor: 'payment-system',
        description: 'Payment processed successfully',
        metadata: { paymentId: paymentResult.paymentId },
      }

      const existingHistory = mockTransactionData.history.get(id) || []
      existingHistory.push(historyEntry)
      mockTransactionData.history.set(id, existingHistory)

      res.json({
        success: true,
        data: {
          transaction: updatedTransaction,
          payment: paymentResult,
        },
        message: 'Payment processed successfully',
      })
    } else {
      const updatedTransaction = {
        ...transaction,
        paymentStatus: 'failed' as const,
        updatedAt: new Date(),
      }

      mockTransactionData.transactions.set(id, updatedTransaction)

      res.status(400).json({
        success: false,
        error: {
          message: 'Payment failed',
          details: paymentResult.error,
        },
      })
    }
  },

  // POST /api/transactions/:id/refund - Process refund
  async processRefund(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { reason, amount } = req.body
    const userId = req.user!.id
    const userRole = req.user!.role

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization (seller or admin can initiate refunds)
    if (transaction.sellerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('Only the seller or admin can process refunds')
    }

    if (transaction.paymentStatus !== 'captured') {
      throw new ApiError(400, 'Can only refund captured payments')
    }

    const refundAmount = amount || transaction.amount
    if (refundAmount > transaction.amount) {
      throw new ApiError(400, 'Refund amount cannot exceed transaction amount')
    }

    // Mock refund processing
    const refundResult = await mockRefundProcessor(transaction, refundAmount, reason)

    if (refundResult.success) {
      const updatedTransaction = {
        ...transaction,
        status: 'refunded' as const,
        paymentStatus: 'refunded' as const,
        escrowStatus: 'refunded' as const,
        updatedAt: new Date(),
      }

      mockTransactionData.transactions.set(id, updatedTransaction)

      // Add to history
      const historyEntry: TransactionHistory = {
        id: `hist-${Date.now()}`,
        transactionId: id,
        status: 'refunded',
        timestamp: new Date(),
        actor: userId,
        description: `Refund processed: $${refundAmount}. Reason: ${reason}`,
        metadata: { refundId: refundResult.refundId, refundAmount },
      }

      const existingHistory = mockTransactionData.history.get(id) || []
      existingHistory.push(historyEntry)
      mockTransactionData.history.set(id, existingHistory)

      res.json({
        success: true,
        data: {
          transaction: updatedTransaction,
          refund: refundResult,
        },
        message: 'Refund processed successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: {
          message: 'Refund failed',
          details: refundResult.error,
        },
      })
    }
  },

  // GET /api/transactions/:id/history - Get transaction history
  async getTransactionHistory(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization
    if (
      transaction.buyerId !== userId && 
      transaction.sellerId !== userId && 
      userRole !== 'admin'
    ) {
      throw new ForbiddenError('You can only view history for your own transactions')
    }

    const history = mockTransactionData.history.get(id) || []

    res.json({
      success: true,
      data: {
        history: history.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        transactionId: id,
      },
    })
  },

  // POST /api/transactions/:id/dispute - Create dispute
  async createDispute(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { reason, description } = req.body
    const userId = req.user!.id

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization (buyer or seller can create disputes)
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new ForbiddenError('Only transaction participants can create disputes')
    }

    if (transaction.disputeId) {
      throw new ApiError(400, 'Transaction already has an active dispute')
    }

    const dispute: Dispute = {
      id: `dispute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      transactionId: id,
      initiatorId: userId,
      reason,
      description,
      status: 'open',
      createdAt: new Date(),
    }

    mockTransactionData.disputes.set(dispute.id, dispute)

    // Update transaction
    const updatedTransaction = {
      ...transaction,
      status: 'disputed' as const,
      disputeId: dispute.id,
      updatedAt: new Date(),
    }

    mockTransactionData.transactions.set(id, updatedTransaction)

    // Add to history
    const historyEntry: TransactionHistory = {
      id: `hist-${Date.now()}`,
      transactionId: id,
      status: 'disputed',
      timestamp: new Date(),
      actor: userId,
      description: `Dispute created: ${reason}`,
      metadata: { disputeId: dispute.id },
    }

    const existingHistory = mockTransactionData.history.get(id) || []
    existingHistory.push(historyEntry)
    mockTransactionData.history.set(id, existingHistory)

    res.status(201).json({
      success: true,
      data: {
        dispute,
        transaction: updatedTransaction,
      },
      message: 'Dispute created successfully',
    })
  },

  // GET /api/transactions/escrow/status - Get escrow status
  async getEscrowStatus(req: AuthRequest, res: Response) {
    const userId = req.user!.id

    const userTransactions = Array.from(mockTransactionData.transactions.values())
      .filter(t => t.buyerId === userId || t.sellerId === userId)

    const escrowSummary = {
      totalHeld: 0,
      totalReleased: 0,
      totalRefunded: 0,
      activeHoldings: [] as any[],
    }

    for (const transaction of userTransactions) {
      const escrowHolding = mockTransactionData.escrowHoldings.get(transaction.id)
      
      if (escrowHolding) {
        switch (transaction.escrowStatus) {
          case 'held':
            escrowSummary.totalHeld += escrowHolding.amount
            escrowSummary.activeHoldings.push({
              transactionId: transaction.id,
              amount: escrowHolding.amount,
              heldSince: escrowHolding.heldAt,
              status: transaction.status,
            })
            break
          case 'released':
            escrowSummary.totalReleased += escrowHolding.amount
            break
          case 'refunded':
            escrowSummary.totalRefunded += escrowHolding.amount
            break
        }
      }
    }

    res.json({
      success: true,
      data: { escrowSummary },
    })
  },

  // POST /api/transactions/:id/release-escrow - Release escrow funds
  async releaseEscrow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const transaction = mockTransactionData.transactions.get(id)

    if (!transaction) {
      throw new NotFoundError('Transaction', id)
    }

    // Check authorization (buyer or admin can release escrow)
    if (transaction.buyerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('Only the buyer or admin can release escrow')
    }

    if (transaction.escrowStatus !== 'held') {
      throw new ApiError(400, `Escrow is ${transaction.escrowStatus}, cannot release`)
    }

    const escrowHolding = mockTransactionData.escrowHoldings.get(id)
    if (!escrowHolding) {
      throw new ApiError(400, 'No escrow holding found for this transaction')
    }

    // Release escrow
    const updatedTransaction = {
      ...transaction,
      escrowStatus: 'released' as const,
      status: transaction.status === 'processing' ? 'completed' as const : transaction.status,
      updatedAt: new Date(),
      ...(transaction.status === 'processing' && { completedAt: new Date() }),
    }

    mockTransactionData.transactions.set(id, updatedTransaction)

    // Add to history
    const historyEntry: TransactionHistory = {
      id: `hist-${Date.now()}`,
      transactionId: id,
      status: updatedTransaction.status,
      timestamp: new Date(),
      actor: userId,
      description: `Escrow released: $${escrowHolding.amount}`,
    }

    const existingHistory = mockTransactionData.history.get(id) || []
    existingHistory.push(historyEntry)
    mockTransactionData.history.set(id, existingHistory)

    res.json({
      success: true,
      data: { 
        transaction: updatedTransaction,
        releasedAmount: escrowHolding.amount,
      },
      message: 'Escrow released successfully',
    })
  },

  // GET /api/transactions/analytics/summary - Transaction analytics
  async getTransactionAnalytics(req: AuthRequest, res: Response) {
    const { period = '30d', groupBy = 'day' } = req.query as any

    const allTransactions = Array.from(mockTransactionData.transactions.values())
    
    // Calculate analytics
    const analytics = {
      summary: {
        totalTransactions: allTransactions.length,
        totalVolume: allTransactions.reduce((sum, t) => sum + t.amount, 0),
        avgTransactionSize: allTransactions.length > 0 
          ? allTransactions.reduce((sum, t) => sum + t.amount, 0) / allTransactions.length 
          : 0,
        totalFees: allTransactions.reduce((sum, t) => sum + t.fees.total, 0),
      },
      statusDistribution: {
        pending: allTransactions.filter(t => t.status === 'pending').length,
        processing: allTransactions.filter(t => t.status === 'processing').length,
        completed: allTransactions.filter(t => t.status === 'completed').length,
        cancelled: allTransactions.filter(t => t.status === 'cancelled').length,
        disputed: allTransactions.filter(t => t.status === 'disputed').length,
        refunded: allTransactions.filter(t => t.status === 'refunded').length,
      },
      paymentMethods: {
        credit_card: allTransactions.filter(t => t.paymentMethod === 'credit_card').length,
        paypal: allTransactions.filter(t => t.paymentMethod === 'paypal').length,
        crypto: allTransactions.filter(t => t.paymentMethod === 'crypto').length,
        bank_transfer: allTransactions.filter(t => t.paymentMethod === 'bank_transfer').length,
      },
      trends: generateMockTrends(period, groupBy),
      disputes: {
        totalDisputes: Array.from(mockTransactionData.disputes.values()).length,
        openDisputes: Array.from(mockTransactionData.disputes.values())
          .filter(d => d.status === 'open').length,
        resolvedDisputes: Array.from(mockTransactionData.disputes.values())
          .filter(d => d.status === 'resolved').length,
      },
    }

    res.json({
      success: true,
      data: { analytics, period, groupBy },
    })
  },
}

// Helper functions
async function mockPaymentProcessor(
  transaction: Transaction, 
  paymentToken: string, 
  billingAddress: any
) {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mock payment result (90% success rate)
  if (Math.random() < 0.9) {
    return {
      success: true,
      paymentId: `pay_${Date.now()}`,
      amount: transaction.amount + transaction.fees.total,
      method: transaction.paymentMethod,
      processedAt: new Date(),
    }
  } else {
    return {
      success: false,
      error: 'Payment declined by issuer',
    }
  }
}

async function mockRefundProcessor(
  transaction: Transaction, 
  amount: number, 
  reason: string
) {
  // Simulate refund processing delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Mock refund result (95% success rate)
  if (Math.random() < 0.95) {
    return {
      success: true,
      refundId: `refund_${Date.now()}`,
      amount,
      reason,
      processedAt: new Date(),
      expectedInAccount: '3-5 business days',
    }
  } else {
    return {
      success: false,
      error: 'Refund failed - payment method no longer valid',
    }
  }
}

function generateMockTrends(period: string, groupBy: string) {
  const dataPoints = period === '7d' ? 7 : period === '30d' ? 30 : 365
  const trends = []
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    
    trends.push({
      date: date.toISOString().split('T')[0],
      transactions: Math.floor(Math.random() * 50) + 10,
      volume: Math.floor(Math.random() * 10000) + 1000,
      avgSize: Math.floor(Math.random() * 200) + 50,
    })
  }
  
  return trends
}