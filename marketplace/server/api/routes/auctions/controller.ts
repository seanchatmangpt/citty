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

interface Auction {
  id: string
  itemId: string
  sellerId: string
  title: string
  description: string
  startPrice: number
  currentPrice: number
  reservePrice?: number
  bidIncrement: number
  highestBidder?: string
  totalBids: number
  startTime: Date
  endTime: Date
  status: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'sold'
  autoExtend: boolean
  buyItNowPrice?: number
  watchers: string[]
  createdAt: Date
  updatedAt: Date
}

interface Bid {
  id: string
  auctionId: string
  bidderId: string
  amount: number
  maxBid?: number
  timestamp: Date
  isWinning: boolean
  isAutoBid: boolean
  ip?: string
}

interface AutoBid {
  id: string
  auctionId: string
  bidderId: string
  maxAmount: number
  increment: number
  isActive: boolean
  createdAt: Date
}

// Mock database
const mockAuctionData = {
  auctions: new Map<string, Auction>(),
  bids: new Map<string, Bid[]>(),
  autoBids: new Map<string, AutoBid[]>(),
  watchers: new Map<string, Set<string>>(),
}

// Initialize mock data
const initMockAuctionData = () => {
  const sampleAuction: Auction = {
    id: 'auction-1',
    itemId: 'item-1',
    sellerId: 'user-1',
    title: 'Vintage Leather Jacket Auction',
    description: 'Authentic vintage leather jacket in excellent condition. Starting at $50!',
    startPrice: 50.00,
    currentPrice: 75.00,
    reservePrice: 80.00,
    bidIncrement: 5.00,
    highestBidder: 'user-2',
    totalBids: 3,
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() + 86400000), // 24 hours from now
    status: 'active',
    autoExtend: true,
    buyItNowPrice: 120.00,
    watchers: ['user-2', 'user-3'],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
  }

  mockAuctionData.auctions.set(sampleAuction.id, sampleAuction)

  // Sample bids
  const sampleBids: Bid[] = [
    {
      id: 'bid-1',
      auctionId: 'auction-1',
      bidderId: 'user-2',
      amount: 55.00,
      timestamp: new Date(Date.now() - 1800000),
      isWinning: false,
      isAutoBid: false,
    },
    {
      id: 'bid-2',
      auctionId: 'auction-1',
      bidderId: 'user-3',
      amount: 65.00,
      timestamp: new Date(Date.now() - 900000),
      isWinning: false,
      isAutoBid: false,
    },
    {
      id: 'bid-3',
      auctionId: 'auction-1',
      bidderId: 'user-2',
      amount: 75.00,
      maxBid: 100.00,
      timestamp: new Date(Date.now() - 300000),
      isWinning: true,
      isAutoBid: true,
    },
  ]

  mockAuctionData.bids.set('auction-1', sampleBids)

  // Sample watchers
  mockAuctionData.watchers.set('auction-1', new Set(['user-2', 'user-3', 'user-4']))
}

initMockAuctionData()

export const auctionController = {
  // POST /api/auctions - Create new auction
  async createAuction(req: AuthRequest, res: Response) {
    const {
      itemId,
      startPrice,
      reservePrice,
      bidIncrement = 1.00,
      duration, // in seconds
      autoExtend = false,
      buyItNowPrice,
    } = req.body

    const sellerId = req.user!.id

    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + duration * 1000)

    const newAuction: Auction = {
      id: `auction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      sellerId,
      title: `Auction for Item ${itemId}`, // In real app, get from item
      description: 'Auction description', // In real app, get from item
      startPrice,
      currentPrice: startPrice,
      reservePrice,
      bidIncrement,
      totalBids: 0,
      startTime,
      endTime,
      status: 'active',
      autoExtend,
      buyItNowPrice,
      watchers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockAuctionData.auctions.set(newAuction.id, newAuction)
    mockAuctionData.bids.set(newAuction.id, [])
    mockAuctionData.watchers.set(newAuction.id, new Set())

    res.status(201).json({
      success: true,
      data: { auction: newAuction },
      message: 'Auction created successfully',
    })
  },

  // GET /api/auctions - List active auctions
  async getAuctions(req: Request, res: Response) {
    const {
      status = 'active',
      category,
      minPrice,
      maxPrice,
      endingSoon,
      page = 1,
      limit = 20,
      sortBy = 'endTime',
      sortOrder = 'asc',
    } = req.query as any

    let auctions = Array.from(mockAuctionData.auctions.values())

    // Filter by status
    if (status !== 'all') {
      auctions = auctions.filter(a => a.status === status)
    }

    // Filter by price range
    if (minPrice !== undefined) {
      auctions = auctions.filter(a => a.currentPrice >= parseFloat(minPrice))
    }

    if (maxPrice !== undefined) {
      auctions = auctions.filter(a => a.currentPrice <= parseFloat(maxPrice))
    }

    // Filter ending soon (next 24 hours)
    if (endingSoon === 'true') {
      const next24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000)
      auctions = auctions.filter(a => a.endTime <= next24Hours && a.status === 'active')
    }

    // Sort auctions
    auctions.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'price':
          comparison = a.currentPrice - b.currentPrice
          break
        case 'endTime':
          comparison = a.endTime.getTime() - b.endTime.getTime()
          break
        case 'bids':
          comparison = a.totalBids - b.totalBids
          break
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime()
          break
        default:
          comparison = a.endTime.getTime() - b.endTime.getTime()
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedAuctions = auctions.slice(startIndex, endIndex)

    // Enhance with additional data
    const enhancedAuctions = paginatedAuctions.map(auction => ({
      ...auction,
      timeRemaining: Math.max(0, auction.endTime.getTime() - Date.now()),
      isEndingSoon: auction.endTime.getTime() - Date.now() < 24 * 60 * 60 * 1000,
      hasReserve: !!auction.reservePrice,
      reserveMet: auction.reservePrice ? auction.currentPrice >= auction.reservePrice : true,
    }))

    res.json({
      success: true,
      data: {
        auctions: enhancedAuctions,
        pagination: {
          page,
          limit,
          total: auctions.length,
          totalPages: Math.ceil(auctions.length / limit),
          hasNext: endIndex < auctions.length,
          hasPrev: page > 1,
        },
        filters: {
          status,
          category,
          minPrice,
          maxPrice,
          endingSoon,
        },
      },
    })
  },

  // GET /api/auctions/:id - Get auction details
  async getAuction(req: Request, res: Response) {
    const { id } = req.params
    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    const bids = mockAuctionData.bids.get(id) || []
    const watchers = mockAuctionData.watchers.get(id) || new Set()

    const auctionDetails = {
      ...auction,
      timeRemaining: Math.max(0, auction.endTime.getTime() - Date.now()),
      isEndingSoon: auction.endTime.getTime() - Date.now() < 60 * 60 * 1000, // 1 hour
      hasReserve: !!auction.reservePrice,
      reserveMet: auction.reservePrice ? auction.currentPrice >= auction.reservePrice : true,
      watcherCount: watchers.size,
      recentBids: bids
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5), // Last 5 bids
    }

    res.json({
      success: true,
      data: { auction: auctionDetails },
    })
  },

  // POST /api/auctions/:id/bid - Place bid
  async placeBid(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { amount, maxBid } = req.body
    const bidderId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    if (auction.sellerId === bidderId) {
      throw new ApiError(400, 'Cannot bid on your own auction')
    }

    if (auction.status !== 'active') {
      throw new ApiError(400, `Cannot bid on ${auction.status} auction`)
    }

    if (new Date() > auction.endTime) {
      throw new ApiError(400, 'Auction has ended')
    }

    const minBidAmount = auction.currentPrice + auction.bidIncrement
    if (amount < minBidAmount) {
      throw new ApiError(400, `Bid must be at least $${minBidAmount.toFixed(2)}`)
    }

    const existingBids = mockAuctionData.bids.get(id) || []

    // Check if user already has the highest bid
    const currentHighestBid = existingBids
      .filter(b => b.isWinning)
      .find(b => b.bidderId === bidderId)

    if (currentHighestBid) {
      throw new ApiError(400, 'You already have the highest bid')
    }

    // Create new bid
    const newBid: Bid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      auctionId: id,
      bidderId,
      amount,
      maxBid,
      timestamp: new Date(),
      isWinning: true,
      isAutoBid: false,
      ip: req.ip,
    }

    // Mark previous winning bids as not winning
    existingBids.forEach(bid => {
      bid.isWinning = false
    })

    existingBids.push(newBid)
    mockAuctionData.bids.set(id, existingBids)

    // Update auction
    const updatedAuction: Auction = {
      ...auction,
      currentPrice: amount,
      highestBidder: bidderId,
      totalBids: auction.totalBids + 1,
      updatedAt: new Date(),
    }

    // Auto-extend if enabled and bid placed in last 5 minutes
    const timeRemaining = auction.endTime.getTime() - Date.now()
    if (auction.autoExtend && timeRemaining < 5 * 60 * 1000) {
      updatedAuction.endTime = new Date(auction.endTime.getTime() + 5 * 60 * 1000)
    }

    mockAuctionData.auctions.set(id, updatedAuction)

    // Process auto-bids from other bidders
    const autoBids = mockAuctionData.autoBids.get(id) || []
    for (const autoBid of autoBids) {
      if (autoBid.bidderId !== bidderId && autoBid.isActive) {
        const nextBidAmount = amount + auction.bidIncrement
        if (nextBidAmount <= autoBid.maxAmount) {
          // Place auto-bid
          const autoBidEntry: Bid = {
            id: `bid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            auctionId: id,
            bidderId: autoBid.bidderId,
            amount: nextBidAmount,
            maxBid: autoBid.maxAmount,
            timestamp: new Date(Date.now() + 100), // Slight delay
            isWinning: true,
            isAutoBid: true,
          }

          // Mark current bid as not winning
          newBid.isWinning = false
          existingBids.push(autoBidEntry)
          
          // Update auction with auto-bid
          updatedAuction.currentPrice = nextBidAmount
          updatedAuction.highestBidder = autoBid.bidderId
          updatedAuction.totalBids += 1

          break // Only one auto-bid per manual bid
        }
      }
    }

    // Final save
    mockAuctionData.bids.set(id, existingBids)
    mockAuctionData.auctions.set(id, updatedAuction)

    res.json({
      success: true,
      data: {
        auction: updatedAuction,
        bid: newBid,
        timeRemaining: Math.max(0, updatedAuction.endTime.getTime() - Date.now()),
      },
      message: 'Bid placed successfully',
    })
  },

  // GET /api/auctions/:id/bids - Get bid history
  async getBidHistory(req: Request, res: Response) {
    const { id } = req.params
    const { page = 1, limit = 50 } = req.query as any

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    const allBids = mockAuctionData.bids.get(id) || []
    const sortedBids = allBids
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedBids = sortedBids.slice(startIndex, endIndex)

    // Anonymize bidder information for privacy
    const anonymizedBids = paginatedBids.map((bid, index) => ({
      id: bid.id,
      amount: bid.amount,
      timestamp: bid.timestamp,
      isWinning: bid.isWinning,
      isAutoBid: bid.isAutoBid,
      bidder: `Bidder ${allBids.length - startIndex - index}`, // Anonymous bidder number
    }))

    res.json({
      success: true,
      data: {
        bids: anonymizedBids,
        pagination: {
          page,
          limit,
          total: allBids.length,
          totalPages: Math.ceil(allBids.length / limit),
          hasNext: endIndex < allBids.length,
          hasPrev: page > 1,
        },
        auctionId: id,
      },
    })
  },

  // PUT /api/auctions/:id/extend - Extend auction
  async extendAuction(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { duration } = req.body // duration in seconds
    const userId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    if (auction.sellerId !== userId && req.user!.role !== 'admin') {
      throw new ForbiddenError('Only the seller can extend the auction')
    }

    if (auction.status !== 'active') {
      throw new ApiError(400, `Cannot extend ${auction.status} auction`)
    }

    const maxExtension = 24 * 60 * 60 * 1000 // 24 hours
    if (duration * 1000 > maxExtension) {
      throw new ApiError(400, 'Cannot extend auction by more than 24 hours')
    }

    const updatedAuction: Auction = {
      ...auction,
      endTime: new Date(auction.endTime.getTime() + duration * 1000),
      updatedAt: new Date(),
    }

    mockAuctionData.auctions.set(id, updatedAuction)

    res.json({
      success: true,
      data: { auction: updatedAuction },
      message: 'Auction extended successfully',
    })
  },

  // POST /api/auctions/:id/end - End auction early
  async endAuction(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { reason } = req.body
    const userId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    if (auction.sellerId !== userId && req.user!.role !== 'admin') {
      throw new ForbiddenError('Only the seller or admin can end the auction')
    }

    if (auction.status !== 'active') {
      throw new ApiError(400, `Cannot end ${auction.status} auction`)
    }

    const updatedAuction: Auction = {
      ...auction,
      status: 'ended',
      endTime: new Date(), // Set end time to now
      updatedAt: new Date(),
    }

    // If there are bids and reserve is met, mark as sold
    if (auction.totalBids > 0) {
      const reserveMet = !auction.reservePrice || auction.currentPrice >= auction.reservePrice
      if (reserveMet) {
        updatedAuction.status = 'sold'
      }
    }

    mockAuctionData.auctions.set(id, updatedAuction)

    res.json({
      success: true,
      data: { auction: updatedAuction },
      message: `Auction ended successfully. Reason: ${reason || 'No reason provided'}`,
    })
  },

  // GET /api/auctions/:id/watchers - Get watchers
  async getWatchers(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    // Only seller and admin can see detailed watcher info
    if (auction.sellerId !== userId && req.user!.role !== 'admin') {
      const watchers = mockAuctionData.watchers.get(id) || new Set()
      return res.json({
        success: true,
        data: { watcherCount: watchers.size },
      })
    }

    const watchers = mockAuctionData.watchers.get(id) || new Set()

    res.json({
      success: true,
      data: {
        watcherCount: watchers.size,
        watchers: Array.from(watchers), // Only for seller/admin
      },
    })
  },

  // POST /api/auctions/:id/watch - Watch auction
  async watchAuction(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    const watchers = mockAuctionData.watchers.get(id) || new Set()
    watchers.add(userId)
    mockAuctionData.watchers.set(id, watchers)

    res.json({
      success: true,
      data: { watcherCount: watchers.size, isWatching: true },
      message: 'Added to watchlist',
    })
  },

  // DELETE /api/auctions/:id/watch - Unwatch auction
  async unwatchAuction(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    const watchers = mockAuctionData.watchers.get(id) || new Set()
    watchers.delete(userId)
    mockAuctionData.watchers.set(id, watchers)

    res.json({
      success: true,
      data: { watcherCount: watchers.size, isWatching: false },
      message: 'Removed from watchlist',
    })
  },

  // GET /api/auctions/ending-soon - Auctions ending soon
  async getEndingSoon(req: Request, res: Response) {
    const { hours = 24, limit = 20 } = req.query as any

    const timeThreshold = new Date(Date.now() + hours * 60 * 60 * 1000)
    const endingSoon = Array.from(mockAuctionData.auctions.values())
      .filter(a => a.status === 'active' && a.endTime <= timeThreshold)
      .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
      .slice(0, limit)
      .map(auction => ({
        ...auction,
        timeRemaining: Math.max(0, auction.endTime.getTime() - Date.now()),
        urgencyLevel: getUrgencyLevel(auction.endTime.getTime() - Date.now()),
      }))

    res.json({
      success: true,
      data: { auctions: endingSoon, threshold: `${hours} hours` },
    })
  },

  // GET /api/auctions/popular - Popular auctions
  async getPopularAuctions(req: Request, res: Response) {
    const { limit = 20 } = req.query as any

    const popular = Array.from(mockAuctionData.auctions.values())
      .filter(a => a.status === 'active')
      .map(auction => {
        const watchers = mockAuctionData.watchers.get(auction.id) || new Set()
        return {
          ...auction,
          watcherCount: watchers.size,
          popularityScore: calculatePopularityScore(auction, watchers.size),
        }
      })
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)

    res.json({
      success: true,
      data: { auctions: popular },
    })
  },

  // POST /api/auctions/:id/auto-bid - Set up auto-bidding
  async setupAutoBid(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { maxAmount, increment } = req.body
    const bidderId = req.user!.id

    const auction = mockAuctionData.auctions.get(id)

    if (!auction) {
      throw new NotFoundError('Auction', id)
    }

    if (auction.sellerId === bidderId) {
      throw new ApiError(400, 'Cannot set up auto-bidding on your own auction')
    }

    if (auction.status !== 'active') {
      throw new ApiError(400, `Cannot set up auto-bidding on ${auction.status} auction`)
    }

    if (maxAmount <= auction.currentPrice) {
      throw new ApiError(400, 'Max amount must be higher than current price')
    }

    const autoBid: AutoBid = {
      id: `autobid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      auctionId: id,
      bidderId,
      maxAmount,
      increment: increment || auction.bidIncrement,
      isActive: true,
      createdAt: new Date(),
    }

    // Remove existing auto-bid for this user
    let existingAutoBids = mockAuctionData.autoBids.get(id) || []
    existingAutoBids = existingAutoBids.filter(ab => ab.bidderId !== bidderId)
    existingAutoBids.push(autoBid)
    mockAuctionData.autoBids.set(id, existingAutoBids)

    res.json({
      success: true,
      data: { autoBid },
      message: 'Auto-bidding set up successfully',
    })
  },
}

// Helper functions
function getUrgencyLevel(timeRemaining: number): 'critical' | 'high' | 'medium' | 'low' {
  const hours = timeRemaining / (60 * 60 * 1000)
  
  if (hours < 1) return 'critical'
  if (hours < 6) return 'high'
  if (hours < 24) return 'medium'
  return 'low'
}

function calculatePopularityScore(auction: Auction, watcherCount: number): number {
  const ageHours = (Date.now() - auction.startTime.getTime()) / (60 * 60 * 1000)
  const timeRemainingHours = (auction.endTime.getTime() - Date.now()) / (60 * 60 * 1000)
  
  let score = 0
  score += auction.totalBids * 10 // Bid activity
  score += watcherCount * 5 // Watcher interest
  score += (auction.currentPrice / auction.startPrice) * 20 // Price appreciation
  
  // Time decay factors
  if (ageHours < 24) score *= 1.5 // Boost for new auctions
  if (timeRemainingHours < 24) score *= 1.3 // Boost for ending soon
  
  return score
}