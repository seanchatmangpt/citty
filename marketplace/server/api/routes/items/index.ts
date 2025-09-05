import { Router } from 'express'
import { itemController } from './controller.js'
import { validate, schemas, validateParams } from '../../middleware/validation.js'
import { requirePermission } from '../../middleware/auth.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// GET /api/items - List items with filtering and pagination
router.get('/',
  validate(schemas.searchQuery, 'query'),
  cacheHelpers.searchCache,
  asyncHandler(itemController.getItems)
)

// GET /api/items/:id - Get item details
router.get('/:id',
  validateParams.id,
  cacheHelpers.itemCache,
  asyncHandler(itemController.getItem)
)

// POST /api/items - Create new item (requires authentication)
router.post('/',
  requirePermission('create'),
  validate(schemas.createItem),
  asyncHandler(itemController.createItem)
)

// PUT /api/items/:id - Update item (requires ownership or admin)
router.put('/:id',
  validateParams.id,
  requirePermission('update'),
  validate(schemas.updateItem),
  asyncHandler(itemController.updateItem)
)

// DELETE /api/items/:id - Delete item (requires ownership or admin)
router.delete('/:id',
  validateParams.id,
  requirePermission('delete'),
  asyncHandler(itemController.deleteItem)
)

// POST /api/items/:id/images - Upload images for item
router.post('/:id/images',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(itemController.uploadImages)
)

// DELETE /api/items/:id/images/:imageId - Delete item image
router.delete('/:id/images/:imageId',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(itemController.deleteImage)
)

// GET /api/items/:id/similar - Get similar items
router.get('/:id/similar',
  validateParams.id,
  cacheHelpers.recommendationCache,
  asyncHandler(itemController.getSimilarItems)
)

// POST /api/items/:id/view - Track item view (analytics)
router.post('/:id/view',
  validateParams.id,
  asyncHandler(itemController.trackView)
)

// POST /api/items/:id/favorite - Add to favorites (requires auth)
router.post('/:id/favorite',
  validateParams.id,
  requirePermission('read'),
  asyncHandler(itemController.addToFavorites)
)

// DELETE /api/items/:id/favorite - Remove from favorites (requires auth)
router.delete('/:id/favorite',
  validateParams.id,
  requirePermission('read'),
  asyncHandler(itemController.removeFromFavorites)
)

// GET /api/items/:id/history - Get item price/status history
router.get('/:id/history',
  validateParams.id,
  cacheHelpers.itemCache,
  asyncHandler(itemController.getItemHistory)
)

// POST /api/items/bulk - Bulk item operations (admin only)
router.post('/bulk',
  requirePermission('admin'),
  asyncHandler(itemController.bulkOperations)
)

export { router as itemRoutes }