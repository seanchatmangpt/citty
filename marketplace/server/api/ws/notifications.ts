import { defineWebSocketHandler } from "crossws/adapters/h3"
import type { WebSocketClient } from "crossws/websocket"

interface NotificationClient {
  id: string
  userId?: string
  socketId: string
  subscriptions: Set<string>
  connectedAt: Date
  lastActivity: Date
  isAuthenticated: boolean
  preferences: NotificationPreferences
}

interface NotificationPreferences {
  marketplaceUpdates: boolean
  auctionUpdates: boolean
  userActivities: boolean
  systemAlerts: boolean
  instantNotifications: boolean
}

interface Notification {
  id: string
  type: 'marketplace_update' | 'auction_update' | 'user_activity' | 'system_alert'
  title: string
  message: string
  data?: any
  priority: 'low' | 'medium' | 'high' | 'urgent'
  targetUsers?: string[]
  channels?: string[]
  timestamp: Date
  expiresAt?: Date
  read: boolean
}

interface MarketplaceUpdate {
  type: 'new_item' | 'item_updated' | 'item_sold' | 'price_change'
  itemId: string
  userId?: string
  data: any
  timestamp: Date
}

interface UserActivity {
  userId: string
  action: string
  itemId?: string
  metadata?: any
  timestamp: Date
}

// Global state management
const clients = new Map<string, NotificationClient>()
const connections = new Map<string, WebSocketClient>()
const notifications = new Map<string, Notification>()
const channels = new Map<string, Set<string>>() // channel -> Set of socketIds

export default defineWebSocketHandler({
  async open(peer) {
    const socketId = generateId()
    const client: NotificationClient = {
      id: socketId,
      socketId,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAuthenticated: false,
      preferences: {
        marketplaceUpdates: true,
        auctionUpdates: true,
        userActivities: false,
        systemAlerts: true,
        instantNotifications: true
      }
    }
    
    clients.set(socketId, client)
    connections.set(socketId, peer as WebSocketClient)
    
    console.log(`Notification WebSocket client connected: ${socketId}`)
    
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
          
        case 'subscribe':
          await handleSubscribe(peer as WebSocketClient, client, data.payload)
          break
          
        case 'unsubscribe':
          await handleUnsubscribe(peer as WebSocketClient, client, data.payload)
          break
          
        case 'update_preferences':
          await handleUpdatePreferences(peer as WebSocketClient, client, data.payload)
          break
          
        case 'mark_read':
          await handleMarkRead(peer as WebSocketClient, client, data.payload)
          break
          
        case 'get_notifications':
          await handleGetNotifications(peer as WebSocketClient, client, data.payload)
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
      console.log(`Notification WebSocket client disconnected: ${socketId}`)
    }
  },

  async error(peer, error) {
    console.error('Notification WebSocket error:', error)
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
  client: NotificationClient,
  payload: { userId: string, token?: string }
) {
  try {
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
      
      // Subscribe to user's personal notification channel
      subscribeToChannel(client.socketId, `user:${userId}`)
      
      peer.send(JSON.stringify({
        type: 'authenticated',
        data: { 
          success: true,
          userId,
          socketId: client.socketId,
          timestamp: new Date()
        }
      }))

      // Send pending notifications
      await sendPendingNotifications(peer, client)
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

async function handleSubscribe(
  peer: WebSocketClient,
  client: NotificationClient,
  payload: { channels?: string[], categories?: string[] }
) {
  const { channels = [], categories = [] } = payload

  // Subscribe to specific channels
  for (const channel of channels) {
    subscribeToChannel(client.socketId, channel)
    client.subscriptions.add(channel)
  }

  // Subscribe to notification categories
  for (const category of categories) {
    subscribeToChannel(client.socketId, `category:${category}`)
    client.subscriptions.add(`category:${category}`)
  }

  peer.send(JSON.stringify({
    type: 'subscribed',
    data: {
      channels,
      categories,
      totalSubscriptions: client.subscriptions.size,
      timestamp: new Date()
    }
  }))
}

async function handleUnsubscribe(
  peer: WebSocketClient,
  client: NotificationClient,
  payload: { channels?: string[], categories?: string[] }
) {
  const { channels = [], categories = [] } = payload

  // Unsubscribe from specific channels
  for (const channel of channels) {
    unsubscribeFromChannel(client.socketId, channel)
    client.subscriptions.delete(channel)
  }

  // Unsubscribe from notification categories
  for (const category of categories) {
    unsubscribeFromChannel(client.socketId, `category:${category}`)
    client.subscriptions.delete(`category:${category}`)
  }

  peer.send(JSON.stringify({
    type: 'unsubscribed',
    data: {
      channels,
      categories,
      totalSubscriptions: client.subscriptions.size,
      timestamp: new Date()
    }
  }))
}

async function handleUpdatePreferences(
  peer: WebSocketClient,
  client: NotificationClient,
  payload: Partial<NotificationPreferences>
) {
  // Update client preferences
  client.preferences = { ...client.preferences, ...payload }

  peer.send(JSON.stringify({
    type: 'preferences_updated',
    data: {
      preferences: client.preferences,
      timestamp: new Date()
    }
  }))
}

async function handleMarkRead(
  peer: WebSocketClient,
  client: NotificationClient,
  payload: { notificationIds: string[] }
) {
  const { notificationIds } = payload
  let markedCount = 0

  for (const notificationId of notificationIds) {
    const notification = notifications.get(notificationId)
    if (notification && !notification.read) {
      notification.read = true
      markedCount++
    }
  }

  peer.send(JSON.stringify({
    type: 'notifications_marked_read',
    data: {
      count: markedCount,
      notificationIds,
      timestamp: new Date()
    }
  }))
}

async function handleGetNotifications(
  peer: WebSocketClient,
  client: NotificationClient,
  payload: { limit?: number, unreadOnly?: boolean }
) {
  const { limit = 50, unreadOnly = false } = payload
  
  if (!client.userId) {
    peer.send(JSON.stringify({
      type: 'error',
      data: { message: 'Authentication required' }
    }))
    return
  }

  // Get user's notifications
  const userNotifications = Array.from(notifications.values())
    .filter(n => {
      // Filter by user
      const isForUser = !n.targetUsers || n.targetUsers.includes(client.userId!)
      if (!isForUser) return false
      
      // Filter by read status
      if (unreadOnly && n.read) return false
      
      // Check if not expired
      if (n.expiresAt && new Date() > n.expiresAt) return false
      
      return true
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)

  peer.send(JSON.stringify({
    type: 'notifications',
    data: {
      notifications: userNotifications,
      total: userNotifications.length,
      unreadCount: userNotifications.filter(n => !n.read).length,
      timestamp: new Date()
    }
  }))
}

async function handleDisconnect(socketId: string) {
  const client = clients.get(socketId)
  if (client) {
    // Remove from all channels
    for (const channel of client.subscriptions) {
      unsubscribeFromChannel(socketId, channel)
    }
    
    clients.delete(socketId)
    connections.delete(socketId)
  }
}

// Channel management
function subscribeToChannel(socketId: string, channel: string) {
  if (!channels.has(channel)) {
    channels.set(channel, new Set())
  }
  channels.get(channel)!.add(socketId)
}

function unsubscribeFromChannel(socketId: string, channel: string) {
  const channelClients = channels.get(channel)
  if (channelClients) {
    channelClients.delete(socketId)
    if (channelClients.size === 0) {
      channels.delete(channel)
    }
  }
}

function broadcastToChannel(channel: string, message: any, excludeSocketId?: string) {
  const channelClients = channels.get(channel)
  if (!channelClients) return

  const messageStr = JSON.stringify(message)
  for (const socketId of channelClients) {
    if (excludeSocketId && socketId === excludeSocketId) continue
    
    const connection = connections.get(socketId)
    if (connection) {
      try {
        connection.send(messageStr)
      } catch (error) {
        console.error(`Failed to send notification to ${socketId}:`, error)
      }
    }
  }
}

async function sendPendingNotifications(peer: WebSocketClient, client: NotificationClient) {
  if (!client.userId) return

  const pendingNotifications = Array.from(notifications.values())
    .filter(n => {
      const isForUser = !n.targetUsers || n.targetUsers.includes(client.userId!)
      const isNotExpired = !n.expiresAt || new Date() <= n.expiresAt
      const isUnread = !n.read
      return isForUser && isNotExpired && isUnread
    })
    .slice(0, 10) // Send only latest 10 pending notifications

  if (pendingNotifications.length > 0) {
    peer.send(JSON.stringify({
      type: 'pending_notifications',
      data: {
        notifications: pendingNotifications,
        count: pendingNotifications.length,
        timestamp: new Date()
      }
    }))
  }
}

// Notification creation and broadcasting
export const notificationWebSocket = {
  // Create and broadcast a notification
  createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const id = generateId()
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false
    }

    notifications.set(id, fullNotification)

    // Broadcast to appropriate channels
    if (notification.channels) {
      for (const channel of notification.channels) {
        broadcastToChannel(channel, {
          type: 'notification',
          data: fullNotification
        })
      }
    }

    // Broadcast to specific users
    if (notification.targetUsers) {
      for (const userId of notification.targetUsers) {
        broadcastToChannel(`user:${userId}`, {
          type: 'notification',
          data: fullNotification
        })
      }
    }

    // Broadcast to category subscribers
    broadcastToChannel(`category:${notification.type}`, {
      type: 'notification',
      data: fullNotification
    })

    return fullNotification
  },

  // Broadcast marketplace update
  broadcastMarketplaceUpdate(update: MarketplaceUpdate) {
    // Filter clients based on preferences
    for (const [socketId, client] of clients.entries()) {
      if (client.isAuthenticated && client.preferences.marketplaceUpdates) {
        const connection = connections.get(socketId)
        if (connection) {
          try {
            connection.send(JSON.stringify({
              type: 'marketplace_update',
              data: update
            }))
          } catch (error) {
            console.error(`Failed to send marketplace update to ${socketId}:`, error)
          }
        }
      }
    }
  },

  // Broadcast user activity
  broadcastUserActivity(activity: UserActivity) {
    // Create notification for activity
    const notification = this.createNotification({
      type: 'user_activity',
      title: 'User Activity',
      message: `User performed action: ${activity.action}`,
      data: activity,
      priority: 'low',
      channels: ['marketplace'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    })

    // Broadcast to interested users
    for (const [socketId, client] of clients.entries()) {
      if (client.isAuthenticated && client.preferences.userActivities) {
        const connection = connections.get(socketId)
        if (connection) {
          try {
            connection.send(JSON.stringify({
              type: 'user_activity',
              data: activity
            }))
          } catch (error) {
            console.error(`Failed to send user activity to ${socketId}:`, error)
          }
        }
      }
    }
  },

  // Get statistics
  getStats() {
    return {
      connectedClients: clients.size,
      totalNotifications: notifications.size,
      totalChannels: channels.size,
      unreadNotifications: Array.from(notifications.values()).filter(n => !n.read).length
    }
  },

  // Clean up expired notifications
  cleanupExpiredNotifications() {
    const now = new Date()
    let cleanedCount = 0

    for (const [id, notification] of notifications.entries()) {
      if (notification.expiresAt && now > notification.expiresAt) {
        notifications.delete(id)
        cleanedCount++
      }
    }

    return cleanedCount
  }
}

// Periodic cleanup
setInterval(() => {
  // Clean up inactive connections
  const now = Date.now()
  const maxInactiveTime = 30 * 60 * 1000 // 30 minutes

  for (const [socketId, client] of clients.entries()) {
    if (now - client.lastActivity.getTime() > maxInactiveTime) {
      console.log(`Cleaning up inactive notification connection: ${socketId}`)
      handleDisconnect(socketId)
    }
  }

  // Clean up expired notifications
  const cleaned = notificationWebSocket.cleanupExpiredNotifications()
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired notifications`)
  }
}, 300000) // Every 5 minutes

// Send periodic heartbeat to all clients
setInterval(() => {
  const heartbeat = JSON.stringify({
    type: 'heartbeat',
    data: { 
      timestamp: new Date(),
      stats: notificationWebSocket.getStats()
    }
  })

  for (const connection of connections.values()) {
    try {
      connection.send(heartbeat)
    } catch (error) {
      console.error('Failed to send heartbeat:', error)
    }
  }
}, 60000) // Every minute