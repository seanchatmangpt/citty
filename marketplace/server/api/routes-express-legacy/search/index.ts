import { Router } from 'express'
import { searchController } from './controller.js'
import { validate, schemas } from '../../middleware/validation.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// GET /api/search - Multi-dimensional search with filters
router.get('/',
  validate(schemas.searchQuery, 'query'),
  cacheHelpers.searchCache,
  asyncHandler(searchController.search)
)

// GET /api/search/facets - Get available search facets
router.get('/facets',
  cacheHelpers.analyticsCache,
  asyncHandler(searchController.getFacets)
)

// GET /api/search/suggestions - Get search suggestions/autocomplete
router.get('/suggestions',
  asyncHandler(searchController.getSuggestions)
)

// POST /api/search/saved - Save search query
router.post('/saved',
  asyncHandler(searchController.saveSearch)
)

// GET /api/search/saved - Get user's saved searches
router.get('/saved',
  asyncHandler(searchController.getSavedSearches)
)

// DELETE /api/search/saved/:id - Delete saved search
router.delete('/saved/:id',
  asyncHandler(searchController.deleteSavedSearch)
)

// GET /api/search/trending - Get trending search terms
router.get('/trending',
  cacheHelpers.analyticsCache,
  asyncHandler(searchController.getTrendingSearches)
)

// POST /api/search/track - Track search query for analytics
router.post('/track',
  asyncHandler(searchController.trackSearch)
)

export { router as searchRoutes }