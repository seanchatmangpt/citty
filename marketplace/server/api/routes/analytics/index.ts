import { Router } from 'express'
import { analyticsController } from './controller.js'
import { validate, schemas, validateParams } from '../../middleware/validation.js'
import { requirePermission, requireRole } from '../../middleware/auth.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// GET /api/analytics/overview - Get analytics overview
router.get('/overview',
  requireRole(['admin', 'seller']),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getOverview)
)

// GET /api/analytics/sales - Get sales analytics
router.get('/sales',
  requireRole(['admin', 'seller']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getSalesAnalytics)
)

// GET /api/analytics/users - Get user analytics
router.get('/users',
  requireRole(['admin']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getUserAnalytics)
)

// GET /api/analytics/items - Get item performance analytics
router.get('/items',
  requireRole(['admin', 'seller']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getItemAnalytics)
)

// GET /api/analytics/revenue - Get revenue analytics
router.get('/revenue',
  requireRole(['admin']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getRevenueAnalytics)
)

// GET /api/analytics/conversion - Get conversion analytics
router.get('/conversion',
  requireRole(['admin', 'seller']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getConversionAnalytics)
)

// GET /api/analytics/geographic - Get geographic analytics
router.get('/geographic',
  requireRole(['admin']),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getGeographicAnalytics)
)

// GET /api/analytics/trends - Get trending analytics
router.get('/trends',
  requireRole(['admin', 'seller']),
  validate(schemas.analyticsQuery, 'query'),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getTrendAnalytics)
)

// GET /api/analytics/cohort - Get cohort analysis
router.get('/cohort',
  requireRole(['admin']),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getCohortAnalysis)
)

// GET /api/analytics/funnel - Get conversion funnel
router.get('/funnel',
  requireRole(['admin', 'seller']),
  cacheHelpers.analyticsCache,
  asyncHandler(analyticsController.getFunnelAnalysis)
)

// GET /api/analytics/realtime - Get real-time analytics
router.get('/realtime',
  requireRole(['admin', 'seller']),
  asyncHandler(analyticsController.getRealtimeAnalytics)
)

// POST /api/analytics/custom - Create custom analytics query
router.post('/custom',
  requireRole(['admin']),
  asyncHandler(analyticsController.createCustomQuery)
)

// GET /api/analytics/export - Export analytics data
router.get('/export',
  requireRole(['admin', 'seller']),
  asyncHandler(analyticsController.exportAnalytics)
)

export { router as analyticsRoutes }