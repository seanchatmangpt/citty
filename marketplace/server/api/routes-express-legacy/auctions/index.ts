import { Router } from 'express'
import { auctionController } from './controller.js'
import { validate, schemas, validateParams } from '../../middleware/validation.js'
import { requirePermission } from '../../middleware/auth.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// POST /api/auctions - Create new auction
router.post('/',
  requirePermission('create'),
  validate(schemas.createAuction),
  asyncHandler(auctionController.createAuction)
)

// GET /api/auctions - List active auctions
router.get('/',
  cacheHelpers.searchCache,
  asyncHandler(auctionController.getAuctions)
)

// GET /api/auctions/:id - Get auction details
router.get('/:id',
  validateParams.id,
  cacheHelpers.itemCache,
  asyncHandler(auctionController.getAuction)
)

// POST /api/auctions/:id/bid - Place bid
router.post('/:id/bid',
  validateParams.id,
  requirePermission('create'),
  validate(schemas.placeBid),
  asyncHandler(auctionController.placeBid)
)

// GET /api/auctions/:id/bids - Get auction bid history
router.get('/:id/bids',
  validateParams.id,
  cacheHelpers.itemCache,
  asyncHandler(auctionController.getBidHistory)
)

// PUT /api/auctions/:id/extend - Extend auction duration
router.put('/:id/extend',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(auctionController.extendAuction)
)

// POST /api/auctions/:id/end - End auction early
router.post('/:id/end',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(auctionController.endAuction)
)

// GET /api/auctions/:id/watchers - Get auction watchers
router.get('/:id/watchers',
  validateParams.id,
  requirePermission('read'),
  asyncHandler(auctionController.getWatchers)
)

// POST /api/auctions/:id/watch - Watch auction
router.post('/:id/watch',
  validateParams.id,
  requirePermission('read'),
  asyncHandler(auctionController.watchAuction)
)

// DELETE /api/auctions/:id/watch - Unwatch auction
router.delete('/:id/watch',
  validateParams.id,
  requirePermission('read'),
  asyncHandler(auctionController.unwatchAuction)
)

// GET /api/auctions/ending-soon - Get auctions ending soon
router.get('/ending-soon',
  cacheHelpers.searchCache,
  asyncHandler(auctionController.getEndingSoon)
)

// GET /api/auctions/popular - Get popular auctions
router.get('/popular',
  cacheHelpers.recommendationCache,
  asyncHandler(auctionController.getPopularAuctions)
)

// POST /api/auctions/:id/auto-bid - Set up auto-bidding
router.post('/:id/auto-bid',
  validateParams.id,
  requirePermission('create'),
  asyncHandler(auctionController.setupAutoBid)
)

export { router as auctionRoutes }