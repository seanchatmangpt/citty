import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { validateJWT } from '~/server/utils/auth'
import { ApiError } from '~/server/utils/errors'

interface AuctionUpdate {
  type: 'bid' | 'end' | 'extend' | 'status_change'
  auctionId: string
  data: any
  timestamp: Date
}

interface ConnectedUser {
  userId?: string
  socketId: string
  watchedAuctions: Set<string>
  connectedAt: Date
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

interface Auction {
  id: string
  itemId: string
  status: 'upcoming' | 'active' | 'ended' | 'cancelled'
  currentPrice: number
  bidIncrement: number
  endTime: Date
  sellerId: string
  highestBidder?: string
  totalBids: number
}

// Store connected users and their subscriptions
const connectedUsers = new Map<string, ConnectedUser>()
const auctionRooms = new Map<string, Set<string>>() // auctionId -> Set of socketIds
const mockAuctions = new Map<string, Auction>()
const mockBids = new Map<string, Bid[]>()

// Initialize mock auction data
function initMockAuctionData() {
  if (mockAuctions.size === 0) {
    const auction: Auction = {
      id: 'auction-1',
      itemId: 'item-1',
      status: 'active',
      currentPrice: 150.00,
      bidIncrement: 5.00,
      endTime: new Date(Date.now() + 3600000), // 1 hour from now
      sellerId: 'seller-1',
      totalBids: 3,
    }
    
    mockAuctions.set(auction.id, auction)
    mockBids.set(auction.id, [])
  }
}

// Initialize data
initMockAuctionData()

// WebSocket server instance
let io: SocketIOServer | null = null

/**
 * Initialize WebSocket server for auctions
 */
export function initializeAuctionWebSocket(server?: any) {
  if (io) return io
  
  const httpServer = server || createServer()
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ["https://marketplace.citty.pro"] 
        : ["http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST"]
    },
    path: '/api/marketplace/websocket/auctions'
  })
  
  const auctionNamespace = io.of('/auctions')

  auctionNamespace.on('connection', (socket) => {
    console.log(`User connected to auctions WebSocket: ${socket.id}`)

    // Store user connection
    const user: ConnectedUser = {
      socketId: socket.id,
      watchedAuctions: new Set(),
      connectedAt: new Date(),
    }
    connectedUsers.set(socket.id, user)

    // Handle user authentication
    socket.on('authenticate', async (data: { userId: string, token: string }) => {
      try {
        if (data.token) {
          const validatedUser = await validateJWT(data.token)
          user.userId = validatedUser.id
          connectedUsers.set(socket.id, user)
          
          socket.emit('authenticated', { 
            success: true,
            userId: validatedUser.id,
            timestamp: new Date(),
          })
        } else {
          socket.emit('authentication_error', { 
            message: 'Token required',
            timestamp: new Date(),
          })
        }
      } catch (error) {
        socket.emit('authentication_error', { 
          message: 'Invalid credentials',
          timestamp: new Date(),
        })
      }
    })

    // Handle auction room joining
    socket.on('join_auction', (data: { auctionId: string }) => {
      const { auctionId } = data
      
      if (!auctionId) {
        socket.emit('error', { message: 'Auction ID required' })
        return
      }

      // Join the auction room
      socket.join(`auction-${auctionId}`)
      user.watchedAuctions.add(auctionId)
      
      // Track room membership
      if (!auctionRooms.has(auctionId)) {
        auctionRooms.set(auctionId, new Set())
      }
      auctionRooms.get(auctionId)!.add(socket.id)

      socket.emit('joined_auction', {
        auctionId,
        timestamp: new Date(),
        viewerCount: auctionRooms.get(auctionId)?.size || 1,
      })

      // Broadcast to other users in the auction
      socket.to(`auction-${auctionId}`).emit('user_joined', {
        auctionId,
        viewerCount: auctionRooms.get(auctionId)?.size || 1,
        timestamp: new Date(),
      })

      console.log(`User ${socket.id} joined auction ${auctionId}`)
    })

    // Handle leaving auction room
    socket.on('leave_auction', (data: { auctionId: string }) => {
      const { auctionId } = data

      socket.leave(`auction-${auctionId}`)
      user.watchedAuctions.delete(auctionId)
      
      const auctionRoom = auctionRooms.get(auctionId)
      if (auctionRoom) {
        auctionRoom.delete(socket.id)
        if (auctionRoom.size === 0) {
          auctionRooms.delete(auctionId)
        }
      }

      socket.emit('left_auction', {
        auctionId,
        timestamp: new Date(),
      })

      // Broadcast updated viewer count
      socket.to(`auction-${auctionId}`).emit('user_left', {
        auctionId,
        viewerCount: auctionRooms.get(auctionId)?.size || 0,
        timestamp: new Date(),
      })

      console.log(`User ${socket.id} left auction ${auctionId}`)
    })

    // Handle real-time bidding
    socket.on('place_bid', async (data: { auctionId: string, amount: number, maxBid?: number }) => {
      try {
        const { auctionId, amount, maxBid } = data

        if (!user.userId) {
          socket.emit('bid_error', { 
            message: 'Authentication required to bid',
            auctionId,
          })
          return
        }

        // Validate bid
        const bidValidation = await validateBid(auctionId, user.userId, amount)
        
        if (!bidValidation.valid) {
          socket.emit('bid_error', {
            message: bidValidation.error,
            auctionId,
            timestamp: new Date(),
          })
          return
        }

        // Process the bid
        const bidResult = await processBid(auctionId, user.userId, amount, maxBid)

        if (bidResult.success) {
          // Emit to all users watching this auction
          auctionNamespace.to(`auction-${auctionId}`).emit('new_bid', {
            auctionId,
            bid: bidResult.bid,
            auction: bidResult.auction,
            timestamp: new Date(),
          })

          // Send confirmation to bidder
          socket.emit('bid_placed', {
            auctionId,
            bid: bidResult.bid,
            isWinning: bidResult.bid.isWinning,
            timestamp: new Date(),
          })

          // If auction was extended due to late bid
          if (bidResult.extended) {
            auctionNamespace.to(`auction-${auctionId}`).emit('auction_extended', {
              auctionId,
              newEndTime: bidResult.auction.endTime,
              reason: 'Auto-extension due to late bid',
              timestamp: new Date(),
            })
          }
        } else {
          socket.emit('bid_error', {
            message: bidResult.error,
            auctionId,
            timestamp: new Date(),
          })
        }

      } catch (error: any) {
        socket.emit('bid_error', {
          message: error.message || 'Failed to place bid',
          auctionId: data.auctionId,
          timestamp: new Date(),
        })
      }
    })

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() })
    })

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected from auctions: ${socket.id}, reason: ${reason}`)
      
      // Clean up user data
      const user = connectedUsers.get(socket.id)
      if (user) {
        // Remove from all auction rooms
        for (const auctionId of user.watchedAuctions) {
          const auctionRoom = auctionRooms.get(auctionId)
          if (auctionRoom) {
            auctionRoom.delete(socket.id)
            if (auctionRoom.size === 0) {
              auctionRooms.delete(auctionId)
            } else {
              // Notify remaining users of updated viewer count
              socket.to(`auction-${auctionId}`).emit('user_left', {
                auctionId,
                viewerCount: auctionRoom.size,
                timestamp: new Date(),
              })
            }
          }
        }
        
        connectedUsers.delete(socket.id)
      }
    })
  })

  // Periodic auction status updates
  setInterval(() => {
    broadcastAuctionUpdates(auctionNamespace)
  }, 30000) // Every 30 seconds

  return io
}

// Helper functions
async function validateBid(auctionId: string, userId: string, amount: number) {
  const auction = mockAuctions.get(auctionId)
  
  if (!auction) {
    return { valid: false, error: 'Auction not found' }
  }

  if (auction.sellerId === userId) {
    return { valid: false, error: 'Cannot bid on your own auction' }
  }

  if (auction.status !== 'active') {
    return { valid: false, error: 'Auction is not active' }
  }

  if (new Date() > auction.endTime) {
    return { valid: false, error: 'Auction has ended' }
  }

  const minBidAmount = auction.currentPrice + auction.bidIncrement
  if (amount < minBidAmount) {
    return { valid: false, error: `Bid must be at least $${minBidAmount.toFixed(2)}` }
  }

  return { valid: true }
}

async function processBid(auctionId: string, userId: string, amount: number, maxBid?: number) {
  const auction = mockAuctions.get(auctionId)
  if (!auction) {
    return { success: false, error: 'Auction not found' }
  }

  const bid: Bid = {
    id: `bid-${Date.now()}`,
    auctionId,
    bidderId: userId,
    amount,
    maxBid,
    timestamp: new Date(),
    isWinning: true,
    isAutoBid: false,
  }

  // Update auction
  auction.currentPrice = amount
  auction.highestBidder = userId
  auction.totalBids += 1

  // Store bid
  const auctionBids = mockBids.get(auctionId) || []
  auctionBids.push(bid)
  mockBids.set(auctionId, auctionBids)

  // Check if auction should be extended
  const timeRemaining = auction.endTime.getTime() - Date.now()
  const extended = timeRemaining < 5 * 60 * 1000 // Less than 5 minutes

  if (extended) {
    auction.endTime = new Date(Date.now() + 5 * 60 * 1000) // Extend by 5 minutes
  }

  mockAuctions.set(auctionId, auction)

  return {
    success: true,
    bid,
    auction,
    extended,
  }
}

function broadcastAuctionUpdates(namespace: any) {
  for (const [auctionId, auction] of mockAuctions.entries()) {
    if (auction.status === 'active') {
      const update = {
        type: 'time_update' as const,
        auctionId,
        data: {
          timeRemaining: Math.max(0, auction.endTime.getTime() - Date.now()),
          currentPrice: auction.currentPrice,
          totalBids: auction.totalBids,
          status: auction.status,
        },
        timestamp: new Date(),
      }
      
      namespace.to(`auction-${auctionId}`).emit('auction_update', update)
    }
  }
}

// Export functions for external use
export const auctionWebSocket = {
  broadcastAuctionUpdate(update: AuctionUpdate) {
    if (io) {
      const auctionNamespace = io.of('/auctions')
      auctionNamespace.to(`auction-${update.auctionId}`).emit('auction_update', update)
    }
  },

  broadcastBidUpdate(auctionId: string, bid: Bid, auction: Auction) {
    if (io) {
      const auctionNamespace = io.of('/auctions')
      auctionNamespace.to(`auction-${auctionId}`).emit('new_bid', {
        auctionId,
        bid,
        auction,
        timestamp: new Date(),
      })
    }
  },

  getAuctionViewerCount(auctionId: string): number {
    return auctionRooms.get(auctionId)?.size || 0
  },

  getConnectedUserCount(): number {
    return connectedUsers.size
  },
}

export default defineEventHandler(async (event) => {
  // This endpoint provides WebSocket connection info
  return {
    success: true,
    data: {
      endpoint: '/api/marketplace/websocket/auctions',
      namespace: '/auctions',
      connectedUsers: connectedUsers.size,
      activeAuctions: Array.from(mockAuctions.keys()).length,
    }
  }
})