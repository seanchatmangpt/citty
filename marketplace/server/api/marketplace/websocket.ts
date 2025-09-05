import { Server as SocketServer } from 'socket.io'
import type { Server } from 'http'

interface MarketplaceUpdate {
  type: 'item_update' | 'new_item' | 'item_deleted' | 'price_change' | 'transaction_update'
  data: any
  timestamp: Date
  userId?: string
}

interface UserActivity {
  userId: string
  action: 'view' | 'search' | 'purchase' | 'favorite'
  itemId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

class MarketplaceWebSocket {
  private io: SocketServer
  private connectedUsers = new Map<string, Set<string>>() // userId -> Set of socketIds
  private userSessions = new Map<string, { socketId: string, joinedAt: Date, lastActivity: Date }>()
  
  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)

      // Handle user authentication
      socket.on('authenticate', (data: { userId: string, token?: string }) => {
        try {
          // In production, verify JWT token here
          const { userId } = data
          
          // Store user session
          this.userSessions.set(socket.id, {
            socketId: socket.id,
            joinedAt: new Date(),
            lastActivity: new Date()
          })

          // Track user connections
          if (!this.connectedUsers.has(userId)) {
            this.connectedUsers.set(userId, new Set())
          }
          this.connectedUsers.get(userId)!.add(socket.id)

          // Join user-specific room
          socket.join(`user:${userId}`)
          socket.join('marketplace')

          socket.emit('authenticated', {
            success: true,
            userId,
            socketId: socket.id,
            timestamp: new Date()
          })

          console.log(`User ${userId} authenticated on socket ${socket.id}`)
        } catch (error) {
          socket.emit('authentication_error', { error: 'Authentication failed' })
        }
      })

      // Handle marketplace subscriptions
      socket.on('subscribe_to_category', (category: string) => {
        socket.join(`category:${category}`)
        socket.emit('subscribed', { type: 'category', value: category })
      })

      socket.on('subscribe_to_item', (itemId: string) => {
        socket.join(`item:${itemId}`)
        socket.emit('subscribed', { type: 'item', value: itemId })
      })

      socket.on('unsubscribe_from_category', (category: string) => {
        socket.leave(`category:${category}`)
        socket.emit('unsubscribed', { type: 'category', value: category })
      })

      socket.on('unsubscribe_from_item', (itemId: string) => {
        socket.leave(`item:${itemId}`)
        socket.emit('unsubscribed', { type: 'item', value: itemId })
      })

      // Handle user activity tracking
      socket.on('user_activity', (activity: Omit<UserActivity, 'timestamp'>) => {
        const fullActivity: UserActivity = {
          ...activity,
          timestamp: new Date()
        }

        // Update last activity
        const session = this.userSessions.get(socket.id)
        if (session) {
          session.lastActivity = new Date()
        }

        // Broadcast activity to interested parties (analytics, recommendations)
        this.io.to('marketplace').emit('marketplace_activity', {
          type: 'user_activity',
          data: fullActivity,
          timestamp: new Date()
        })

        console.log(`User activity: ${activity.userId} performed ${activity.action}`)
      })

      // Handle search queries for recommendations
      socket.on('search_query', (query: { 
        query: string
        filters?: any
        userId?: string 
      }) => {
        // This can be used to provide real-time search suggestions
        // or track search analytics
        this.broadcastToRoom('marketplace', {
          type: 'search_activity',
          data: {
            ...query,
            timestamp: new Date(),
            socketId: socket.id
          },
          timestamp: new Date()
        })
      })

      // Handle item interactions
      socket.on('item_view', (data: { itemId: string, userId?: string }) => {
        // Track item views for analytics and recommendations
        const update: MarketplaceUpdate = {
          type: 'item_update',
          data: {
            action: 'view',
            itemId: data.itemId,
            userId: data.userId,
            socketId: socket.id
          },
          timestamp: new Date(),
          userId: data.userId
        }

        // Broadcast to item subscribers
        this.broadcastToRoom(`item:${data.itemId}`, update)
      })

      // Handle item favoriting
      socket.on('toggle_favorite', (data: { itemId: string, userId: string, isFavorite: boolean }) => {
        const update: MarketplaceUpdate = {
          type: 'item_update',
          data: {
            action: 'favorite_toggle',
            itemId: data.itemId,
            userId: data.userId,
            isFavorite: data.isFavorite
          },
          timestamp: new Date(),
          userId: data.userId
        }

        // Broadcast to item subscribers
        this.broadcastToRoom(`item:${data.itemId}`, update)
      })

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`)

        // Clean up user sessions
        this.userSessions.delete(socket.id)

        // Remove from user connections
        this.connectedUsers.forEach((socketIds, userId) => {
          socketIds.delete(socket.id)
          if (socketIds.size === 0) {
            this.connectedUsers.delete(userId)
          }
        })
      })

      // Handle heartbeat for connection monitoring
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() })
        
        // Update last activity
        const session = this.userSessions.get(socket.id)
        if (session) {
          session.lastActivity = new Date()
        }
      })
    })
  }

  // Public methods for broadcasting updates
  public broadcastItemUpdate(itemId: string, update: Partial<MarketplaceUpdate>) {
    const fullUpdate: MarketplaceUpdate = {
      type: 'item_update',
      data: update.data,
      timestamp: new Date(),
      ...update
    }

    this.io.to(`item:${itemId}`).emit('marketplace_update', fullUpdate)
  }

  public broadcastNewItem(item: any, category?: string) {
    const update: MarketplaceUpdate = {
      type: 'new_item',
      data: item,
      timestamp: new Date()
    }

    // Broadcast to marketplace general room
    this.io.to('marketplace').emit('marketplace_update', update)

    // Broadcast to category-specific room if provided
    if (category) {
      this.io.to(`category:${category}`).emit('marketplace_update', update)
    }
  }

  public broadcastPriceChange(itemId: string, oldPrice: number, newPrice: number, currency = 'USD') {
    const update: MarketplaceUpdate = {
      type: 'price_change',
      data: {
        itemId,
        oldPrice,
        newPrice,
        currency,
        changePercent: ((newPrice - oldPrice) / oldPrice) * 100
      },
      timestamp: new Date()
    }

    this.io.to(`item:${itemId}`).emit('marketplace_update', update)
    this.io.to('marketplace').emit('marketplace_update', update)
  }

  public broadcastTransactionUpdate(transactionId: string, update: any) {
    const marketplaceUpdate: MarketplaceUpdate = {
      type: 'transaction_update',
      data: {
        transactionId,
        ...update
      },
      timestamp: new Date()
    }

    // Broadcast to involved users if specified
    if (update.userId) {
      this.io.to(`user:${update.userId}`).emit('marketplace_update', marketplaceUpdate)
    } else {
      // Broadcast to marketplace general room
      this.io.to('marketplace').emit('marketplace_update', marketplaceUpdate)
    }
  }

  private broadcastToRoom(room: string, data: any) {
    this.io.to(room).emit('marketplace_update', data)
  }

  // Analytics and monitoring
  public getConnectedUsers(): number {
    return this.connectedUsers.size
  }

  public getActiveConnections(): number {
    return this.io.engine.clientsCount
  }

  public getUserConnections(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0
  }

  public getConnectionStats() {
    const now = new Date()
    const activeSessions = Array.from(this.userSessions.values()).filter(
      session => (now.getTime() - session.lastActivity.getTime()) < 5 * 60 * 1000 // 5 minutes
    )

    return {
      totalConnections: this.io.engine.clientsCount,
      uniqueUsers: this.connectedUsers.size,
      activeSessions: activeSessions.length,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys()).filter(room => 
        !this.io.sockets.adapter.sids.has(room) // Filter out socket ID rooms
      )
    }
  }
}

let marketplaceWS: MarketplaceWebSocket | null = null

export function initializeMarketplaceWebSocket(server: Server): MarketplaceWebSocket {
  if (!marketplaceWS) {
    marketplaceWS = new MarketplaceWebSocket(server)
  }
  return marketplaceWS
}

export function getMarketplaceWebSocket(): MarketplaceWebSocket | null {
  return marketplaceWS
}

export { MarketplaceWebSocket }
export type { MarketplaceUpdate, UserActivity }