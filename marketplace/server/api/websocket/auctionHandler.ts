import { Server as SocketIOServer } from 'socket.io'
import { ApiError } from '../utils/errors.js'

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

// Store connected users and their subscriptions
const connectedUsers = new Map<string, ConnectedUser>()
const auctionRooms = new Map<string, Set<string>>() // auctionId -> Set of socketIds

export function setupAuctionWebSocket(io: SocketIOServer) {
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
    socket.on('authenticate', (data: { userId: string, token: string }) => {
      // In a real app, validate the JWT token here
      if (data.userId && data.token) {
        user.userId = data.userId
        connectedUsers.set(socket.id, user)
        
        socket.emit('authenticated', { 
          success: true,
          userId: data.userId,
          timestamp: new Date(),
        })
      } else {
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

        // Validate bid (this would typically call the auction controller)
        const bidValidation = await validateBid(auctionId, user.userId, amount)
        
        if (!bidValidation.valid) {
          socket.emit('bid_error', {
            message: bidValidation.error,
            auctionId,
            timestamp: new Date(),
          })
          return
        }

        // Process the bid (mock implementation)
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

          // Check if auto-bids were triggered
          if (bidResult.autoBids && bidResult.autoBids.length > 0) {
            for (const autoBid of bidResult.autoBids) {
              setTimeout(() => {
                auctionNamespace.to(`auction-${auctionId}`).emit('new_bid', {
                  auctionId,
                  bid: autoBid,
                  auction: bidResult.auction,
                  isAutoBid: true,
                  timestamp: new Date(),
                })
              }, 500) // Slight delay for auto-bids
            }
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

    // Handle auction watching/unwatching
    socket.on('watch_auction', (data: { auctionId: string }) => {
      socket.emit('watching_auction', {
        auctionId: data.auctionId,
        timestamp: new Date(),
      })
    })

    socket.on('unwatch_auction', (data: { auctionId: string }) => {
      socket.emit('unwatching_auction', {
        auctionId: data.auctionId,
        timestamp: new Date(),
      })
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

  // Clean up inactive connections
  setInterval(() => {
    cleanupInactiveConnections(auctionNamespace)
  }, 300000) // Every 5 minutes

  return auctionNamespace
}

// Helper functions
async function validateBid(auctionId: string, userId: string, amount: number) {
  // Mock validation - in real app, this would check the database
  const mockAuction = {
    id: auctionId,
    status: 'active',
    currentPrice: 75.00,
    bidIncrement: 5.00,
    endTime: new Date(Date.now() + 3600000),
    sellerId: 'seller-123',
  }

  if (mockAuction.sellerId === userId) {
    return { valid: false, error: 'Cannot bid on your own auction' }
  }

  if (mockAuction.status !== 'active') {
    return { valid: false, error: 'Auction is not active' }
  }

  if (new Date() > mockAuction.endTime) {
    return { valid: false, error: 'Auction has ended' }
  }

  const minBidAmount = mockAuction.currentPrice + mockAuction.bidIncrement
  if (amount < minBidAmount) {
    return { valid: false, error: `Bid must be at least $${minBidAmount.toFixed(2)}` }
  }

  return { valid: true }
}

async function processBid(auctionId: string, userId: string, amount: number, maxBid?: number) {
  // Mock bid processing - in real app, this would update the database
  const mockBid = {
    id: `bid-${Date.now()}`,
    auctionId,
    bidderId: userId,
    amount,
    maxBid,
    timestamp: new Date(),
    isWinning: true,
    isAutoBid: false,
  }

  const mockAuction = {
    id: auctionId,
    currentPrice: amount,
    highestBidder: userId,
    totalBids: 5,
    endTime: new Date(Date.now() + 3600000),
    status: 'active',
  }

  // Check if auction should be extended
  const timeRemaining = mockAuction.endTime.getTime() - Date.now()
  const extended = timeRemaining < 5 * 60 * 1000 // Less than 5 minutes

  if (extended) {
    mockAuction.endTime = new Date(Date.now() + 5 * 60 * 1000) // Extend by 5 minutes
  }

  // Mock auto-bids
  const autoBids = []
  if (Math.random() < 0.3) { // 30% chance of auto-bid
    autoBids.push({
      id: `bid-${Date.now() + 1}`,
      auctionId,
      bidderId: 'auto-bidder-123',
      amount: amount + 5,
      timestamp: new Date(Date.now() + 500),
      isWinning: true,
      isAutoBid: true,
    })
  }

  return {
    success: true,
    bid: mockBid,
    auction: mockAuction,
    extended,
    autoBids,
  }
}

function broadcastAuctionUpdates(namespace: any) {
  // Mock auction updates - in real app, this would query active auctions
  const mockUpdates = [
    {
      type: 'time_update' as const,
      auctionId: 'auction-1',
      data: {
        timeRemaining: Math.max(0, Date.now() + 3600000 - Date.now()),
        status: 'active',
      },
      timestamp: new Date(),
    },
  ]

  for (const update of mockUpdates) {
    namespace.to(`auction-${update.auctionId}`).emit('auction_update', update)
  }
}

function cleanupInactiveConnections(namespace: any) {
  const now = Date.now()
  const maxInactiveTime = 30 * 60 * 1000 // 30 minutes

  for (const [socketId, user] of connectedUsers.entries()) {
    if (now - user.connectedAt.getTime() > maxInactiveTime) {
      console.log(`Cleaning up inactive connection: ${socketId}`)
      
      // Remove from auction rooms
      for (const auctionId of user.watchedAuctions) {
        const auctionRoom = auctionRooms.get(auctionId)
        if (auctionRoom) {
          auctionRoom.delete(socketId)
          if (auctionRoom.size === 0) {
            auctionRooms.delete(auctionId)
          }
        }
      }
      
      connectedUsers.delete(socketId)
    }
  }
}

// Export functions for external use (e.g., from auction controller)
export const auctionWebSocket = {
  broadcastAuctionUpdate(update: AuctionUpdate, io: SocketIOServer) {
    const auctionNamespace = io.of('/auctions')
    auctionNamespace.to(`auction-${update.auctionId}`).emit('auction_update', update)
  },

  broadcastBidUpdate(auctionId: string, bid: any, auction: any, io: SocketIOServer) {
    const auctionNamespace = io.of('/auctions')
    auctionNamespace.to(`auction-${auctionId}`).emit('new_bid', {
      auctionId,
      bid,
      auction,
      timestamp: new Date(),
    })
  },

  getAuctionViewerCount(auctionId: string): number {
    return auctionRooms.get(auctionId)?.size || 0
  },

  getConnectedUserCount(): number {
    return connectedUsers.size
  },
}