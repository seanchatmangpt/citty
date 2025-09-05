import { Router } from 'express'
import { transactionController } from './controller.js'
import { validate, schemas, validateParams } from '../../middleware/validation.js'
import { requirePermission } from '../../middleware/auth.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// POST /api/transactions - Create new transaction
router.post('/',
  requirePermission('create'),
  validate(schemas.createTransaction),
  asyncHandler(transactionController.createTransaction)
)

// GET /api/transactions - Get user's transactions
router.get('/',
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(transactionController.getTransactions)
)

// GET /api/transactions/:id - Get transaction details
router.get('/:id',
  validateParams.id,
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(transactionController.getTransaction)
)

// PUT /api/transactions/:id/status - Update transaction status
router.put('/:id/status',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(transactionController.updateTransactionStatus)
)

// POST /api/transactions/:id/payment - Process payment
router.post('/:id/payment',
  validateParams.id,
  requirePermission('create'),
  asyncHandler(transactionController.processPayment)
)

// POST /api/transactions/:id/refund - Process refund
router.post('/:id/refund',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(transactionController.processRefund)
)

// GET /api/transactions/:id/history - Get transaction history
router.get('/:id/history',
  validateParams.id,
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(transactionController.getTransactionHistory)
)

// POST /api/transactions/:id/dispute - Create dispute
router.post('/:id/dispute',
  validateParams.id,
  requirePermission('create'),
  asyncHandler(transactionController.createDispute)
)

// GET /api/transactions/escrow/status - Get escrow status
router.get('/escrow/status',
  requirePermission('read'),
  asyncHandler(transactionController.getEscrowStatus)
)

// POST /api/transactions/:id/release-escrow - Release escrow funds
router.post('/:id/release-escrow',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(transactionController.releaseEscrow)
)

// GET /api/transactions/analytics/summary - Transaction analytics
router.get('/analytics/summary',
  requirePermission('admin'),
  cacheHelpers.analyticsCache,
  asyncHandler(transactionController.getTransactionAnalytics)
)

export { router as transactionRoutes }