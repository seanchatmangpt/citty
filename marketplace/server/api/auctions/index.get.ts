import { z } from 'zod'

const auctionQuerySchema = z.object({
  status: z.enum(['active', 'ended', 'upcoming', 'all']).default('active'),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  endingSoon: z.coerce.boolean().optional(), // Auctions ending within 24 hours
  sortBy: z.enum(['endTime', 'price', 'bids', 'created']).default('endTime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
})

// Mock auction database
const mockAuctions = [
  {
    id: 'auction-1',
    itemId: '1',
    itemName: 'Vue CLI Template Pro',
    itemCategory: 'web',
    sellerId: 'user-1',
    sellerName: 'John Doe',
    startPrice: 25.00,
    currentPrice: 89.50,
    buyNowPrice: 150.00,
    bidIncrement: 5.00,
    startTime: new Date('2024-03-01T10:00:00Z'),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: 'active' as const,
    totalBids: 12,
    uniqueBidders: 7,
    currentBidder: 'user-5',
    reserveMet: true,
    isReserveAuction: true,
    reservePrice: 50.00,
    autoExtend: true,
    extendMinutes: 5,
    images: ['/images/vue-template-auction-1.jpg'],
    watchers: 23,
    createdAt: new Date('2024-02-25T09:00:00Z')
  },
  {
    id: 'auction-2', 
    itemId: '2',
    itemName: 'Advanced Auth Plugin',
    itemCategory: 'authentication',
    sellerId: 'user-2',
    sellerName: 'Jane Smith',
    startPrice: 40.00,
    currentPrice: 65.00,
    buyNowPrice: 100.00,
    bidIncrement: 5.00,
    startTime: new Date('2024-02-28T14:00:00Z'),
    endTime: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours from now
    status: 'active' as const,
    totalBids: 8,
    uniqueBidders: 5,
    currentBidder: 'user-7',
    reserveMet: true,
    isReserveAuction: false,
    autoExtend: true,
    extendMinutes: 10,
    images: ['/images/auth-plugin-auction-1.jpg'],
    watchers: 15,
    createdAt: new Date('2024-02-20T11:00:00Z')
  },
  {
    id: 'auction-3',
    itemId: '3',
    itemName: 'Database Migration Tool',
    itemCategory: 'database',
    sellerId: 'user-3',
    sellerName: 'Database Corp',
    startPrice: 75.00,
    currentPrice: 120.00,
    buyNowPrice: 200.00,
    bidIncrement: 10.00,
    startTime: new Date('2024-03-05T16:00:00Z'),
    endTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // Ended 2 hours ago
    status: 'ended' as const,
    totalBids: 18,
    uniqueBidders: 11,
    currentBidder: 'user-9',
    winningBidder: 'user-9',
    reserveMet: true,
    isReserveAuction: true,
    reservePrice: 100.00,
    autoExtend: false,
    images: ['/images/database-tool-auction-1.jpg'],
    watchers: 31,
    createdAt: new Date('2024-02-28T12:00:00Z')
  }
]

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, auctionQuerySchema.parse)
    
    let auctions = [...mockAuctions]
    
    // Apply status filter
    if (query.status !== 'all') {
      auctions = auctions.filter(auction => auction.status === query.status)
    }
    
    // Apply category filter
    if (query.category) {
      auctions = auctions.filter(auction => auction.itemCategory === query.category)
    }
    
    // Apply price filters
    if (query.minPrice !== undefined) {
      auctions = auctions.filter(auction => auction.currentPrice >= query.minPrice!)
    }
    
    if (query.maxPrice !== undefined) {
      auctions = auctions.filter(auction => auction.currentPrice <= query.maxPrice!)
    }
    
    // Filter for ending soon (within 24 hours)
    if (query.endingSoon) {
      const twentyFourHours = 24 * 60 * 60 * 1000
      const now = Date.now()
      auctions = auctions.filter(auction => {
        if (auction.status !== 'active') return false
        return auction.endTime.getTime() - now <= twentyFourHours
      })
    }
    
    // Apply sorting
    auctions.sort((a, b) => {
      let comparison = 0
      
      switch (query.sortBy) {
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
      }
      
      return query.sortOrder === 'desc' ? -comparison : comparison
    })
    
    // Apply pagination
    const startIndex = (query.page - 1) * query.limit
    const endIndex = startIndex + query.limit
    const paginatedAuctions = auctions.slice(startIndex, endIndex)
    
    // Add computed fields for each auction
    const enrichedAuctions = paginatedAuctions.map(auction => {
      const now = Date.now()
      const endTime = auction.endTime.getTime()
      const timeRemaining = Math.max(0, endTime - now)
      
      return {
        ...auction,
        timeRemaining,
        timeRemainingFormatted: formatTimeRemaining(timeRemaining),
        isEndingSoon: timeRemaining <= 24 * 60 * 60 * 1000 && auction.status === 'active',
        hasEnded: timeRemaining === 0,
        nextBidAmount: auction.currentPrice + auction.bidIncrement,
        priceIncrease: auction.currentPrice - auction.startPrice,
        priceIncreasePercent: ((auction.currentPrice - auction.startPrice) / auction.startPrice) * 100
      }
    })
    
    // Generate facets
    const categories = [...new Set(auctions.map(auction => auction.itemCategory))]
    const statusCounts = {
      active: mockAuctions.filter(a => a.status === 'active').length,
      ended: mockAuctions.filter(a => a.status === 'ended').length,
      upcoming: mockAuctions.filter(a => a.status === 'upcoming').length
    }
    
    return {
      success: true,
      data: {
        auctions: enrichedAuctions,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: auctions.length,
          totalPages: Math.ceil(auctions.length / query.limit),
          hasNext: endIndex < auctions.length,
          hasPrev: query.page > 1
        },
        facets: {
          categories: categories.map(cat => ({
            value: cat,
            count: auctions.filter(a => a.itemCategory === cat).length
          })),
          statusCounts,
          endingSoonCount: auctions.filter(a => {
            const timeLeft = a.endTime.getTime() - Date.now()
            return timeLeft <= 24 * 60 * 60 * 1000 && a.status === 'active'
          }).length
        },
        summary: {
          totalActiveAuctions: statusCounts.active,
          totalValue: auctions.reduce((sum, a) => sum + a.currentPrice, 0),
          avgCurrentPrice: auctions.length > 0 
            ? auctions.reduce((sum, a) => sum + a.currentPrice, 0) / auctions.length 
            : 0
        }
      }
    }
    
  } catch (error: any) {
    console.error('Get auctions error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Auction service error'
    })
  }
})

function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Ended'
  
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24))
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}