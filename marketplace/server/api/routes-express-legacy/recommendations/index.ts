import { Router } from 'express'
import { recommendationController } from './controller.js'
import { validate, schemas } from '../../middleware/validation.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// GET /api/recommendations - Get personalized recommendations
router.get('/',
  validate(schemas.getRecommendations, 'query'),
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getRecommendations)
)

// GET /api/recommendations/similar/:itemId - Get items similar to specific item
router.get('/similar/:itemId',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getSimilarItems)
)

// GET /api/recommendations/trending - Get trending items
router.get('/trending',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getTrendingItems)
)

// GET /api/recommendations/popular - Get popular items in category
router.get('/popular',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getPopularItems)
)

// POST /api/recommendations/interaction - Track user interaction for ML
router.post('/interaction',
  asyncHandler(recommendationController.trackInteraction)
)

// GET /api/recommendations/collaborative/:userId - Collaborative filtering recommendations
router.get('/collaborative/:userId',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getCollaborativeRecommendations)
)

// GET /api/recommendations/content/:itemId - Content-based recommendations
router.get('/content/:itemId',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getContentBasedRecommendations)
)

// POST /api/recommendations/feedback - User feedback on recommendations
router.post('/feedback',
  asyncHandler(recommendationController.submitFeedback)
)

// GET /api/recommendations/categories/:category - Category-based recommendations
router.get('/categories/:category',
  cacheHelpers.recommendationCache,
  asyncHandler(recommendationController.getCategoryRecommendations)
)

// POST /api/recommendations/retrain - Trigger ML model retraining (admin only)
router.post('/retrain',
  asyncHandler(recommendationController.triggerModelRetraining)
)

export { router as recommendationRoutes }