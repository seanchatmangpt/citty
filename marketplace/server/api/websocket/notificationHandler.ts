import { Server as SocketIOServer } from 'socket.io'

interface Notification {
  id: string
  userId: string
  type: 'bid' | 'auction_won' | 'auction_lost' | 'auction_ending' | 'payment' | 'message' | 'system'
  title: string
  message: string
  data?: any
  read: boolean
  createdAt: Date
  expiresAt?: Date
}

interface UserSession {
  userId: string
  socketId: string
  connectedAt: Date
  lastActivity: Date
  preferences?: {
    enablePushNotifications: boolean
    enableEmailNotifications: boolean
    notificationTypes: string[]
  }
}

// Store user sessions and notifications
const userSessions = new Map<string, UserSession[]>() // userId -> sessions
const userNotifications = new Map<string, Notification[]>() // userId -> notifications
const socketToUser = new Map<string, string>() // socketId -> userId

export function setupNotificationWebSocket(io: SocketIOServer) {
  const notificationNamespace = io.of('/notifications')

  notificationNamespace.on('connection', (socket) => {
    console.log(`User connected to notifications WebSocket: ${socket.id}`)

    // Handle user authentication
    socket.on('authenticate', (data: { userId: string, token: string }) => {
      try {
        // In a real app, validate the JWT token here
        if (!data.userId || !data.token) {
          socket.emit('authentication_error', {
            message: 'Invalid credentials',
            timestamp: new Date(),
          })
          return
        }

        const userId = data.userId
        const session: UserSession = {
          userId,
          socketId: socket.id,
          connectedAt: new Date(),
          lastActivity: new Date(),
          preferences: {
            enablePushNotifications: true,
            enableEmailNotifications: true,
            notificationTypes: ['bid', 'auction_won', 'auction_ending', 'payment'],
          },
        }

        // Store session
        if (!userSessions.has(userId)) {
          userSessions.set(userId, [])
        }
        userSessions.get(userId)!.push(session)
        socketToUser.set(socket.id, userId)

        // Join user's personal notification room
        socket.join(`user-${userId}`)

        socket.emit('authenticated', {
          success: true,
          userId,
          timestamp: new Date(),
        })

        // Send unread notifications count
        const unreadCount = getUserUnreadNotificationCount(userId)
        socket.emit('unread_count', {
          count: unreadCount,
          timestamp: new Date(),
        })

        // Send recent notifications
        const recentNotifications = getUserRecentNotifications(userId, 10)
        socket.emit('recent_notifications', {
          notifications: recentNotifications,
          timestamp: new Date(),
        })

        console.log(`User ${userId} authenticated for notifications`)

      } catch (error) {
        socket.emit('authentication_error', {
          message: 'Authentication failed',
          timestamp: new Date(),
        })
      }
    })

    // Handle getting notification history
    socket.on('get_notifications', (data: { page?: number, limit?: number, type?: string, unreadOnly?: boolean }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const { page = 1, limit = 20, type, unreadOnly = false } = data
      let notifications = userNotifications.get(userId) || []

      // Filter by type
      if (type) {
        notifications = notifications.filter(n => n.type === type)
      }

      // Filter unread only
      if (unreadOnly) {
        notifications = notifications.filter(n => !n.read)
      }

      // Sort by creation date (newest first)
      notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      // Pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedNotifications = notifications.slice(startIndex, endIndex)

      socket.emit('notifications', {
        notifications: paginatedNotifications,
        pagination: {
          page,
          limit,
          total: notifications.length,
          totalPages: Math.ceil(notifications.length / limit),
          hasNext: endIndex < notifications.length,
          hasPrev: page > 1,
        },
        filters: { type, unreadOnly },
        timestamp: new Date(),
      })
    })

    // Handle marking notifications as read
    socket.on('mark_read', (data: { notificationId?: string, markAll?: boolean }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const notifications = userNotifications.get(userId) || []
      let markedCount = 0

      if (data.markAll) {
        // Mark all notifications as read
        notifications.forEach(n => {
          if (!n.read) {
            n.read = true
            markedCount++
          }
        })
      } else if (data.notificationId) {
        // Mark specific notification as read
        const notification = notifications.find(n => n.id === data.notificationId)
        if (notification && !notification.read) {
          notification.read = true
          markedCount = 1
        }
      }

      if (markedCount > 0) {
        const unreadCount = getUserUnreadNotificationCount(userId)
        socket.emit('notifications_marked_read', {
          markedCount,
          unreadCount,
          timestamp: new Date(),
        })

        // Update unread count for all user sessions
        notificationNamespace.to(`user-${userId}`).emit('unread_count', {
          count: unreadCount,
          timestamp: new Date(),
        })
      }
    })

    // Handle deleting notifications
    socket.on('delete_notification', (data: { notificationId: string }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const notifications = userNotifications.get(userId) || []
      const notificationIndex = notifications.findIndex(n => n.id === data.notificationId)

      if (notificationIndex !== -1) {
        notifications.splice(notificationIndex, 1)
        socket.emit('notification_deleted', {
          notificationId: data.notificationId,
          timestamp: new Date(),
        })
      } else {
        socket.emit('error', { message: 'Notification not found' })
      }
    })

    // Handle notification preferences update
    socket.on('update_preferences', (data: { preferences: any }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      // Update user session preferences
      const userSessionsList = userSessions.get(userId) || []
      const session = userSessionsList.find(s => s.socketId === socket.id)
      if (session) {
        session.preferences = { ...session.preferences, ...data.preferences }
      }

      socket.emit('preferences_updated', {
        preferences: session?.preferences,
        timestamp: new Date(),
      })
    })

    // Handle test notification (for development)
    socket.on('send_test_notification', (data: { type?: string }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const testNotification = createNotification(
        userId,
        data.type || 'system',
        'Test Notification',
        'This is a test notification to verify the system is working correctly.',
        { test: true }
      )

      sendNotificationToUser(userId, testNotification, notificationNamespace)
    })

    // Handle activity tracking
    socket.on('activity', () => {
      const userId = socketToUser.get(socket.id)
      if (userId) {
        const userSessionsList = userSessions.get(userId) || []
        const session = userSessionsList.find(s => s.socketId === socket.id)
        if (session) {
          session.lastActivity = new Date()
        }
      }
    })

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() })
    })

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      const userId = socketToUser.get(socket.id)
      console.log(`User disconnected from notifications: ${socket.id}, reason: ${reason}`)

      if (userId) {
        // Remove session
        const userSessionsList = userSessions.get(userId) || []
        const sessionIndex = userSessionsList.findIndex(s => s.socketId === socket.id)
        if (sessionIndex !== -1) {
          userSessionsList.splice(sessionIndex, 1)
          if (userSessionsList.length === 0) {
            userSessions.delete(userId)
          }
        }
        
        socketToUser.delete(socket.id)
      }
    })
  })

  // Clean up expired notifications periodically
  setInterval(() => {
    cleanupExpiredNotifications()
  }, 3600000) // Every hour

  // Clean up inactive sessions
  setInterval(() => {
    cleanupInactiveSessions(notificationNamespace)
  }, 300000) // Every 5 minutes

  return notificationNamespace
}

// Helper functions
function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  data?: any,
  expiresAt?: Date
): Notification {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type,
    title,
    message,
    data,
    read: false,
    createdAt: new Date(),
    expiresAt,
  }
}

function sendNotificationToUser(userId: string, notification: Notification, namespace: any) {
  // Store notification
  if (!userNotifications.has(userId)) {
    userNotifications.set(userId, [])
  }
  userNotifications.get(userId)!.push(notification)

  // Send to all user sessions
  namespace.to(`user-${userId}`).emit('new_notification', {
    notification,
    timestamp: new Date(),
  })

  // Update unread count
  const unreadCount = getUserUnreadNotificationCount(userId)
  namespace.to(`user-${userId}`).emit('unread_count', {
    count: unreadCount,
    timestamp: new Date(),
  })

  console.log(`Notification sent to user ${userId}: ${notification.title}`)
}

function getUserUnreadNotificationCount(userId: string): number {
  const notifications = userNotifications.get(userId) || []
  return notifications.filter(n => !n.read && (!n.expiresAt || n.expiresAt > new Date())).length
}

function getUserRecentNotifications(userId: string, limit: number): Notification[] {
  const notifications = userNotifications.get(userId) || []
  return notifications
    .filter(n => !n.expiresAt || n.expiresAt > new Date())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

function cleanupExpiredNotifications() {
  const now = new Date()
  let cleanedCount = 0

  for (const [userId, notifications] of userNotifications.entries()) {
    const validNotifications = notifications.filter(n => !n.expiresAt || n.expiresAt > now)
    const removedCount = notifications.length - validNotifications.length
    
    if (removedCount > 0) {
      userNotifications.set(userId, validNotifications)
      cleanedCount += removedCount
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired notifications`)
  }
}

function cleanupInactiveSessions(namespace: any) {
  const now = Date.now()
  const maxInactiveTime = 24 * 60 * 60 * 1000 // 24 hours
  let cleanedCount = 0

  for (const [userId, sessions] of userSessions.entries()) {
    const activeSessions = sessions.filter(s => 
      now - s.lastActivity.getTime() < maxInactiveTime
    )
    
    const removedCount = sessions.length - activeSessions.length
    if (removedCount > 0) {
      if (activeSessions.length === 0) {
        userSessions.delete(userId)
      } else {
        userSessions.set(userId, activeSessions)
      }
      cleanedCount += removedCount
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive notification sessions`)
  }
}

// Export functions for external use
export const notificationWebSocket = {
  sendNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data?: any,
    expiresAt?: Date,
    io?: SocketIOServer
  ) {
    if (!io) return

    const notification = createNotification(userId, type, title, message, data, expiresAt)
    const namespace = io.of('/notifications')
    sendNotificationToUser(userId, notification, namespace)
  },

  broadcastSystemNotification(
    title: string,
    message: string,
    data?: any,
    io?: SocketIOServer
  ) {
    if (!io) return

    const namespace = io.of('/notifications')
    
    // Send to all connected users
    for (const [userId] of userSessions.entries()) {
      const notification = createNotification(userId, 'system', title, message, data)
      sendNotificationToUser(userId, notification, namespace)
    }
  },

  getConnectedUserCount(): number {
    return userSessions.size
  },

  getUserNotificationCount(userId: string): { total: number, unread: number } {
    const notifications = userNotifications.get(userId) || []
    const validNotifications = notifications.filter(n => !n.expiresAt || n.expiresAt > new Date())
    
    return {
      total: validNotifications.length,
      unread: validNotifications.filter(n => !n.read).length,
    }
  },

  isUserOnline(userId: string): boolean {
    return userSessions.has(userId) && (userSessions.get(userId)?.length || 0) > 0
  },
}