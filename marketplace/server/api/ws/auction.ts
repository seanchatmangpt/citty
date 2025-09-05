import { defineWebSocketHandler } from "crossws/adapters/h3"
import type { WebSocketClient } from "crossws/websocket"
import { createError } from 'h3'

interface AuctionClient {
  id: string
  userId?: string
  socketId: string
  watchedAuctions: Set<string>
  connectedAt: Date
  lastActivity: Date
  isAuthenticated: boolean
}

interface AuctionRoom {
  id: string
  clients: Set<string>
  lastActivity: Date
}

interface AuctionBid {
  id: string
  auctionId: string
  bidderId: string
  amount: number
  maxBid?: number
  timestamp: Date
  isWinning: boolean
  isAutoBid: boolean
}

interface AuctionUpdate {
  type: 'bid' | 'end' | 'extend' | 'status_change' | 'time_update'
  auctionId: string
  data: any
  timestamp: Date
}

// Global state management
const clients = new Map<string, AuctionClient>()
const rooms = new Map<string, AuctionRoom>()
const connections = new Map<string, WebSocketClient>()

export default defineWebSocketHandler({
  async open(peer) {
    const socketId = generateId()
    const client: AuctionClient = {
      id: socketId,
      socketId,
      watchedAuctions: new Set(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAuthenticated: false
    }
    
    clients.set(socketId, client)
    connections.set(socketId, peer as WebSocketClient)
    
    console.log(`Auction WebSocket client connected: ${socketId}`)
    
    // Send connection acknowledgment
    peer.send(JSON.stringify({
      type: 'connected',
      data: { socketId, timestamp: new Date() }
    }))
  },

  async message(peer, message) {
    try {
      const data = JSON.parse(message.toString())
      const socketId = findSocketId(peer as WebSocketClient)
      const client = clients.get(socketId!)
      
      if (!client) {
        peer.send(JSON.stringify({
          type: 'error',
          data: { message: 'Client not found' }
        }))
        return
      }

      // Update last activity
      client.lastActivity = new Date()
      
      switch (data.type) {
        case 'authenticate':
          await handleAuthenticate(peer as WebSocketClient, client, data.payload)
          break
          
        case 'join_auction':
          await handleJoinAuction(peer as WebSocketClient, client, data.payload)
          break
          
        case 'leave_auction':
          await handleLeaveAuction(peer as WebSocketClient, client, data.payload)
          break
          
        case 'place_bid':
          await handlePlaceBid(peer as WebSocketClient, client, data.payload)
          break
          
        case 'watch_auction':
          await handleWatchAuction(peer as WebSocketClient, client, data.payload)
          break
          
        case 'unwatch_auction':
          await handleUnwatchAuction(peer as WebSocketClient, client, data.payload)
          break
          
        case 'ping':
          peer.send(JSON.stringify({
            type: 'pong',
            data: { timestamp: new Date() }
          }))
          break
          
        default:
          peer.send(JSON.stringify({
            type: 'error',
            data: { message: `Unknown message type: ${data.type}` }
          }))
      }
    } catch (error: any) {
      console.error('WebSocket message error:', error)
      peer.send(JSON.stringify({
        type: 'error',
        data: { message: error.message || 'Invalid message format' }
      }))
    }
  },

  async close(peer, details) {
    const socketId = findSocketId(peer as WebSocketClient)
    if (socketId) {
      await handleDisconnect(socketId)
      console.log(`Auction WebSocket client disconnected: ${socketId}`)
    }
  },

  async error(peer, error) {
    console.error('Auction WebSocket error:', error)
  }
})

// Helper functions
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

function findSocketId(peer: WebSocketClient): string | undefined {
  for (const [socketId, connection] of connections.entries()) {
    if (connection === peer) {
      return socketId
    }
  }
  return undefined
}

async function handleAuthenticate(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { userId: string, token?: string }
) {
  try {
    // In a real application, validate the JWT token here
    const { userId, token } = payload
    
    if (!userId) {
      peer.send(JSON.stringify({
        type: 'authentication_error',
        data: { message: 'User ID required' }
      }))
      return
    }

    // Mock authentication - in production, validate JWT token
    if (token && userId) {
      client.userId = userId
      client.isAuthenticated = true
      
      peer.send(JSON.stringify({
        type: 'authenticated',
        data: { 
          success: true,
          userId,
          socketId: client.socketId,
          timestamp: new Date()
        }
      }))
    } else {
      peer.send(JSON.stringify({
        type: 'authentication_error',
        data: { message: 'Invalid credentials' }
      }))
    }
  } catch (error: any) {
    peer.send(JSON.stringify({
      type: 'authentication_error',
      data: { message: error.message || 'Authentication failed' }
    }))
  }
}

async function handleJoinAuction(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { auctionId: string }
) {
  const { auctionId } = payload
  
  if (!auctionId) {
    peer.send(JSON.stringify({
      type: 'error',
      data: { message: 'Auction ID required' }
    }))
    return
  }

  // Add client to auction room
  if (!rooms.has(auctionId)) {
    rooms.set(auctionId, {
      id: auctionId,
      clients: new Set(),
      lastActivity: new Date()
    })
  }

  const room = rooms.get(auctionId)!
  room.clients.add(client.socketId)
  room.lastActivity = new Date()
  client.watchedAuctions.add(auctionId)

  // Send join confirmation
  peer.send(JSON.stringify({
    type: 'joined_auction',
    data: {
      auctionId,
      viewerCount: room.clients.size,
      timestamp: new Date()
    }
  }))

  // Broadcast to other clients in the room
  broadcastToRoom(auctionId, {
    type: 'user_joined',
    data: {
      auctionId,
      viewerCount: room.clients.size,
      timestamp: new Date()
    }
  }, client.socketId)

  console.log(`Client ${client.socketId} joined auction ${auctionId}`)
}

async function handleLeaveAuction(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { auctionId: string }
) {
  const { auctionId } = payload
  
  const room = rooms.get(auctionId)
  if (room) {
    room.clients.delete(client.socketId)
    client.watchedAuctions.delete(auctionId)

    if (room.clients.size === 0) {
      rooms.delete(auctionId)
    } else {
      // Broadcast updated viewer count
      broadcastToRoom(auctionId, {
        type: 'user_left',
        data: {
          auctionId,
          viewerCount: room.clients.size,
          timestamp: new Date()
        }
      })
    }
  }

  peer.send(JSON.stringify({
    type: 'left_auction',
    data: {
      auctionId,
      timestamp: new Date()
    }
  }))

  console.log(`Client ${client.socketId} left auction ${auctionId}`)
}

async function handlePlaceBid(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { auctionId: string, amount: number, maxBid?: number }
) {
  try {
    const { auctionId, amount, maxBid } = payload

    if (!client.isAuthenticated || !client.userId) {
      peer.send(JSON.stringify({
        type: 'bid_error',
        data: { 
          message: 'Authentication required to bid',
          auctionId
        }
      }))
      return
    }

    // Validate bid
    const bidValidation = await validateBid(auctionId, client.userId, amount)
    if (!bidValidation.valid) {
      peer.send(JSON.stringify({
        type: 'bid_error',
        data: {
          message: bidValidation.error,
          auctionId,
          timestamp: new Date()
        }
      }))
      return
    }

    // Process bid
    const bidResult = await processBid(auctionId, client.userId, amount, maxBid)
    
    if (bidResult.success) {
      // Broadcast new bid to all clients in the auction room
      broadcastToRoom(auctionId, {
        type: 'new_bid',
        data: {
          auctionId,
          bid: bidResult.bid,
          auction: bidResult.auction,
          timestamp: new Date()
        }
      })

      // Send confirmation to bidder
      peer.send(JSON.stringify({
        type: 'bid_placed',
        data: {
          auctionId,
          bid: bidResult.bid,
          isWinning: bidResult.bid.isWinning,
          timestamp: new Date()
        }
      }))

      // Handle auction extension
      if (bidResult.extended) {
        broadcastToRoom(auctionId, {
          type: 'auction_extended',
          data: {
            auctionId,
            newEndTime: bidResult.auction.endTime,
            reason: 'Auto-extension due to late bid',
            timestamp: new Date()
          }
        })
      }

      // Handle auto-bids
      if (bidResult.autoBids && bidResult.autoBids.length > 0) {
        for (const autoBid of bidResult.autoBids) {
          setTimeout(() => {
            broadcastToRoom(auctionId, {
              type: 'new_bid',
              data: {
                auctionId,
                bid: autoBid,
                auction: bidResult.auction,
                isAutoBid: true,
                timestamp: new Date()
              }
            })
          }, 500)
        }
      }
    } else {
      peer.send(JSON.stringify({
        type: 'bid_error',
        data: {
          message: bidResult.error,
          auctionId,
          timestamp: new Date()
        }
      }))
    }
  } catch (error: any) {
    peer.send(JSON.stringify({
      type: 'bid_error',
      data: {
        message: error.message || 'Failed to place bid',
        auctionId: payload.auctionId,
        timestamp: new Date()
      }
    }))
  }
}

async function handleWatchAuction(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { auctionId: string }
) {
  peer.send(JSON.stringify({
    type: 'watching_auction',
    data: {
      auctionId: payload.auctionId,
      timestamp: new Date()
    }
  }))
}

async function handleUnwatchAuction(
  peer: WebSocketClient,
  client: AuctionClient,
  payload: { auctionId: string }
) {
  peer.send(JSON.stringify({
    type: 'unwatching_auction',
    data: {
      auctionId: payload.auctionId,
      timestamp: new Date()
    }
  }))
}

async function handleDisconnect(socketId: string) {
  const client = clients.get(socketId)
  if (client) {
    // Remove from all auction rooms
    for (const auctionId of client.watchedAuctions) {
      const room = rooms.get(auctionId)
      if (room) {
        room.clients.delete(socketId)
        if (room.clients.size === 0) {
          rooms.delete(auctionId)
        } else {
          // Notify remaining clients
          broadcastToRoom(auctionId, {
            type: 'user_left',
            data: {
              auctionId,
              viewerCount: room.clients.size,
              timestamp: new Date()
            }
          })
        }
      }
    }
    
    clients.delete(socketId)
    connections.delete(socketId)
  }
}

// Utility functions
function broadcastToRoom(roomId: string, message: any, excludeSocketId?: string) {
  const room = rooms.get(roomId)
  if (!room) return

  const messageStr = JSON.stringify(message)
  for (const socketId of room.clients) {
    if (excludeSocketId && socketId === excludeSocketId) continue
    
    const connection = connections.get(socketId)
    if (connection) {
      try {
        connection.send(messageStr)
      } catch (error) {
        console.error(`Failed to send message to ${socketId}:`, error)
      }
    }
  }
}

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
  const mockBid: AuctionBid = {
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

// Export utility functions for external use
export const auctionWebSocket = {
  broadcastAuctionUpdate(update: AuctionUpdate) {
    broadcastToRoom(update.auctionId, {
      type: 'auction_update',
      data: update
    })
  },

  broadcastBidUpdate(auctionId: string, bid: any, auction: any) {
    broadcastToRoom(auctionId, {
      type: 'new_bid',
      data: {
        auctionId,
        bid,
        auction,
        timestamp: new Date()
      }
    })
  },

  getAuctionViewerCount(auctionId: string): number {
    return rooms.get(auctionId)?.clients.size || 0
  },

  getConnectedUserCount(): number {
    return clients.size
  },

  getRooms() {
    return rooms
  },

  getClients() {
    return clients
  }
}

// Periodic cleanup and updates
setInterval(() => {
  // Clean up inactive connections
  const now = Date.now()
  const maxInactiveTime = 30 * 60 * 1000 // 30 minutes

  for (const [socketId, client] of clients.entries()) {
    if (now - client.lastActivity.getTime() > maxInactiveTime) {
      console.log(`Cleaning up inactive auction connection: ${socketId}`)
      handleDisconnect(socketId)
    }
  }
}, 300000) // Every 5 minutes

setInterval(() => {
  // Broadcast auction status updates
  const mockUpdates: AuctionUpdate[] = [
    {
      type: 'time_update',
      auctionId: 'auction-1',
      data: {
        timeRemaining: Math.max(0, Date.now() + 3600000 - Date.now()),
        status: 'active',
      },
      timestamp: new Date(),
    },
  ]

  for (const update of mockUpdates) {
    auctionWebSocket.broadcastAuctionUpdate(update)
  }
}, 30000) // Every 30 seconds