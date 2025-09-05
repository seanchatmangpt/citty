import { z } from 'zod'
import { validateJWT } from '~/server/utils/auth'
import { useCache, cacheKeys } from '~/server/utils/cache'
import { ApiError } from '~/server/utils/errors'

// Validation schema for auction query parameters
const auctionQuerySchema = z.object({
  status: z.enum(['active', 'ended', 'upcoming', 'all']).default('active'),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['endTime', 'price', 'bids', 'created']).default('endTime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

interface Auction {
  id: string
  itemId: string
  item: {
    id: string
    title: string
    description: string
    images: string[]
    category: string
    condition: string
  }
  sellerId: string
  startPrice: number
  currentPrice: number
  reservePrice?: number
  bidIncrement: number
  startTime: Date
  endTime: Date
  status: 'upcoming' | 'active' | 'ended' | 'cancelled'
  totalBids: number
  highestBidder?: string
  autoExtend: boolean
  buyItNowPrice?: number
  watchers: number
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
}

// Mock database
const mockDatabase = {
  auctions: new Map<string, Auction>(),
  bids: new Map<string, Bid[]>(),
  watchers: new Map<string, Set<string>>(),
}

// Initialize mock data
const initMockData = () => {
  if (mockDatabase.auctions.size === 0) {
    const sampleAuctions: Auction[] = [
      {
        id: 'auction-1',
        itemId: 'item-1',
        item: {
          id: 'item-1',
          title: 'Vintage Rolex Submariner',
          description: 'Authentic 1970s Rolex Submariner in excellent condition.',
          images: ['/images/rolex1.jpg', '/images/rolex2.jpg'],
          category: 'watches',
          condition: 'good'
        },
        sellerId: 'seller-1',
        startPrice: 2500.00,
        currentPrice: 3200.00,
        reservePrice: 3000.00,
        bidIncrement: 50.00,
        startTime: new Date(Date.now() - 86400000), // 1 day ago
        endTime: new Date(Date.now() + 3600000), // 1 hour from now
        status: 'active',
        totalBids: 12,
        highestBidder: 'bidder-1',
        autoExtend: true,
        watchers: 24,
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        id: 'auction-2',
        itemId: 'item-2',
        item: {
          id: 'item-2',
          title: 'Rare Baseball Card Collection',
          description: 'Complete 1985 Topps baseball card set in mint condition.',
          images: ['/images/cards1.jpg'],
          category: 'collectibles',
          condition: 'mint'
        },
        sellerId: 'seller-2',
        startPrice: 150.00,
        currentPrice: 275.00,
        bidIncrement: 10.00,
        startTime: new Date(Date.now() - 172800000), // 2 days ago
        endTime: new Date(Date.now() + 7200000), // 2 hours from now
        status: 'active',
        totalBids: 8,
        highestBidder: 'bidder-2',
        autoExtend: false,
        buyItNowPrice: 400.00,
        watchers: 15,
        createdAt: new Date(Date.now() - 259200000), // 3 days ago
        updatedAt: new Date(Date.now() - 1800000), // 30 minutes ago
      },
      {
        id: 'auction-3',
        itemId: 'item-3',
        item: {
          id: 'item-3',
          title: 'Antique Persian Rug',
          description: 'Beautiful handwoven Persian rug from the 1920s.',
          images: ['/images/rug1.jpg', '/images/rug2.jpg'],
          category: 'home',
          condition: 'good'
        },
        sellerId: 'seller-3',
        startPrice: 800.00,
        currentPrice: 800.00,
        bidIncrement: 25.00,
        startTime: new Date(Date.now() + 86400000), // 1 day from now
        endTime: new Date(Date.now() + 604800000), // 1 week from now
        status: 'upcoming',
        totalBids: 0,
        autoExtend: true,
        watchers: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]
    
    sampleAuctions.forEach(auction => {
      mockDatabase.auctions.set(auction.id, auction)
    })
  }
}

export default defineEventHandler(async (event) => {
  try {
    initMockData()
    
    // Parse and validate query parameters
    const query = getQuery(event)
    const validatedQuery = auctionQuerySchema.parse(query)
    
    const {
      status,
      category,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      limit,
    } = validatedQuery

    // Check cache first
    const cacheKey = cacheKeys.auctions.list(JSON.stringify(validatedQuery))
    const cached = await useCache().get(cacheKey)
    if (cached) {
      return cached
    }

    let auctions = Array.from(mockDatabase.auctions.values())

    // Apply status filter
    if (status !== 'all') {
      auctions = auctions.filter(auction => auction.status === status)
    }

    // Apply category filter
    if (category) {
      auctions = auctions.filter(auction => auction.item.category === category)
    }

    // Apply price filters
    if (minPrice !== undefined) {
      auctions = auctions.filter(auction => auction.currentPrice >= minPrice)
    }

    if (maxPrice !== undefined) {
      auctions = auctions.filter(auction => auction.currentPrice <= maxPrice)
    }

    // Sorting
    auctions.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'endTime':
          comparison = a.endTime.getTime() - b.endTime.getTime()
          break
        case 'price':
          comparison = a.currentPrice - b.currentPrice
          break
        case 'bids':
          comparison = a.totalBids - b.totalBids
          break
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
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

    // Add time remaining for active auctions
    const enrichedAuctions = paginatedAuctions.map(auction => {
      const now = new Date()
      const timeRemaining = auction.status === 'active' && auction.endTime > now 
        ? auction.endTime.getTime() - now.getTime()
        : 0
      
      return {
        ...auction,
        timeRemaining,
        timeRemainingFormatted: timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : null,
        isEndingSoon: timeRemaining > 0 && timeRemaining < 3600000, // Less than 1 hour
      }
    })

    const result = {
      success: true,
      data: {
        auctions: enrichedAuctions,
        pagination: {
          page,
          limit,
          total: auctions.length,
          totalPages: Math.ceil(auctions.length / limit),
          hasNext: endIndex < auctions.length,
          hasPrev: page > 1,
        },
        summary: {
          active: mockDatabase.auctions.size > 0 ? Array.from(mockDatabase.auctions.values()).filter(a => a.status === 'active').length : 0,
          upcoming: mockDatabase.auctions.size > 0 ? Array.from(mockDatabase.auctions.values()).filter(a => a.status === 'upcoming').length : 0,
          ended: mockDatabase.auctions.size > 0 ? Array.from(mockDatabase.auctions.values()).filter(a => a.status === 'ended').length : 0,
        }
      },
    }

    // Cache the result
    await useCache().set(cacheKey, result, 60) // 1 minute for active auctions

    return result
    
  } catch (error: any) {
    console.error('Auctions list API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper function to format time remaining
function formatTimeRemaining(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}