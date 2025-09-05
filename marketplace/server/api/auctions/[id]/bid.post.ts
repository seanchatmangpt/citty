import { z } from 'zod'
import jwt from 'jsonwebtoken'

const bidSchema = z.object({
  amount: z.number().min(0.01),
  maxBid: z.number().min(0.01).optional(), // For auto-bidding
  isAutoBid: z.boolean().default(false)
})

// Mock authentication
function verifyToken(token: string) {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.jwtSecret) as { id: string, email: string, role: string }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token'
    })
  }
}

// Mock auction database
const mockAuctions = new Map([
  ['auction-1', {
    id: 'auction-1',
    itemId: '1',
    sellerId: 'user-1',
    startPrice: 25.00,
    currentPrice: 89.50,
    bidIncrement: 5.00,
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'active',
    totalBids: 12,
    currentBidder: 'user-5',
    reservePrice: 50.00,
    reserveMet: true,
    autoExtend: true,
    extendMinutes: 5
  }]
])

const mockBids = new Map() // Store bids by auction ID

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authorization required to place bids'
      })
    }

    const token = authHeader.substring(7)
    const user = verifyToken(token)

    // Get auction ID from route
    const auctionId = getRouterParam(event, 'id')
    if (!auctionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Auction ID required'
      })
    }

    // Validate bid data
    const body = await readBody(event)
    const bidData = bidSchema.parse(body)

    // Get auction
    const auction = mockAuctions.get(auctionId)
    if (!auction) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Auction not found'
      })
    }

    // Validate bid conditions
    if (auction.sellerId === user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot bid on your own auction'
      })
    }

    if (auction.status !== 'active') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Auction is not active'
      })
    }

    if (new Date() > auction.endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Auction has ended'
      })
    }

    const minBidAmount = auction.currentPrice + auction.bidIncrement
    if (bidData.amount < minBidAmount) {
      throw createError({
        statusCode: 400,
        statusMessage: `Bid must be at least $${minBidAmount.toFixed(2)}`
      })
    }

    // Check for recent bid by same user (prevent spam)
    if (!mockBids.has(auctionId)) {
      mockBids.set(auctionId, [])
    }
    
    const auctionBids = mockBids.get(auctionId)
    const recentUserBids = auctionBids.filter((bid: any) => 
      bid.bidderId === user.id && 
      Date.now() - bid.timestamp.getTime() < 10000 // 10 seconds
    )

    if (recentUserBids.length > 0 && !bidData.isAutoBid) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Please wait before placing another bid'
      })
    }

    // Create new bid
    const newBid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      auctionId,
      bidderId: user.id,
      bidderName: 'Anonymous Bidder', // In production, get from user profile
      amount: bidData.amount,
      maxBid: bidData.maxBid,
      isAutoBid: bidData.isAutoBid,
      timestamp: new Date(),
      isWinning: true,
      ipAddress: getClientIP(event)
    }

    // Update auction
    const wasExtended = checkAndExtendAuction(auction)
    
    auction.currentPrice = bidData.amount
    auction.currentBidder = user.id
    auction.totalBids += 1
    
    // Store bid
    auctionBids.push(newBid)
    
    // Check for auto-bids (simplified logic)
    const triggeredAutoBids = processAutoBids(auctionId, bidData.amount, user.id)
    
    // In production, you would:
    // - Save to database
    // - Send real-time updates via WebSocket
    // - Send notifications to watchers
    // - Update search indexes
    // - Log for analytics
    // - Check for reserve price met
    // - Handle proxy bidding
    
    // Simulate WebSocket broadcast (would be real in production)
    // await broadcastBidUpdate(auctionId, newBid, auction)
    
    const response = {
      success: true,
      data: {
        bid: newBid,
        auction: {
          id: auction.id,
          currentPrice: auction.currentPrice,
          totalBids: auction.totalBids,
          timeRemaining: Math.max(0, auction.endTime.getTime() - Date.now()),
          isWinning: newBid.bidderId === auction.currentBidder
        },
        extended: wasExtended,
        autoBidsTriggered: triggeredAutoBids.length > 0,
        autoBids: triggeredAutoBids,
        nextMinBid: auction.currentPrice + auction.bidIncrement
      },
      message: 'Bid placed successfully'
    }

    if (wasExtended) {
      response.message += ` (Auction extended by ${auction.extendMinutes} minutes)`
    }

    return response

  } catch (error: any) {
    console.error('Place bid error:', error)

    if (error.statusCode) {
      throw error
    }

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid bid data',
        data: error.errors
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to place bid'
    })
  }
})

function checkAndExtendAuction(auction: any): boolean {
  if (!auction.autoExtend) return false
  
  const timeRemaining = auction.endTime.getTime() - Date.now()
  const extendThreshold = auction.extendMinutes * 60 * 1000 // Convert to milliseconds
  
  if (timeRemaining < extendThreshold) {
    auction.endTime = new Date(auction.endTime.getTime() + extendThreshold)
    return true
  }
  
  return false
}

function processAutoBids(auctionId: string, currentBid: number, excludeBidder: string): any[] {
  // Simplified auto-bid logic
  // In production, this would check all users with active auto-bids
  const autoBids = []
  
  // Mock: 30% chance of triggering an auto-bid
  if (Math.random() < 0.3) {
    const autoBidAmount = currentBid + 5 // Simple increment
    autoBids.push({
      id: `auto-bid-${Date.now()}`,
      auctionId,
      bidderId: 'auto-bidder-123',
      amount: autoBidAmount,
      isAutoBid: true,
      timestamp: new Date()
    })
  }
  
  return autoBids
}

function getClientIP(event: any): string {
  return getClientIP(event) || 'unknown'
}