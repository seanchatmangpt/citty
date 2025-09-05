/**
 * WebSocket handler for real-time notifications
 */

export class NotificationHandler {
  constructor(io) {
    this.io = io;
    this.userSessions = new Map(); // Map user IDs to socket IDs
    this.notificationQueue = new Map(); // Queue notifications for offline users
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Notification client connected: ${socket.id}`);

      // Authenticate user
      socket.on('authenticate', (data) => {
        const { userId, token } = data;
        if (this.validateUser(userId, token)) {
          this.userSessions.set(userId, socket.id);
          socket.userId = userId;
          socket.join(`user-${userId}`);
          
          // Send queued notifications
          this.deliverQueuedNotifications(userId);
          
          console.log(`User ${userId} authenticated for notifications`);
          socket.emit('authenticated', { success: true });
        } else {
          socket.emit('authentication-failed', { message: 'Invalid credentials' });
        }
      });

      // Mark notification as read
      socket.on('mark-read', (notificationId) => {
        if (socket.userId) {
          this.markNotificationAsRead(socket.userId, notificationId);
        }
      });

      // Mark all notifications as read
      socket.on('mark-all-read', () => {
        if (socket.userId) {
          this.markAllNotificationsAsRead(socket.userId);
        }
      });

      // Subscribe to specific notification types
      socket.on('subscribe', (types) => {
        if (socket.userId && Array.isArray(types)) {
          types.forEach(type => {
            socket.join(`type-${type}`);
          });
          console.log(`User ${socket.userId} subscribed to: ${types.join(', ')}`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.userSessions.delete(socket.userId);
          console.log(`User ${socket.userId} disconnected from notifications`);
        }
      });
    });
  }

  // Send notification to specific user
  sendToUser(userId, notification) {
    const socketId = this.userSessions.get(userId);
    
    if (socketId) {
      // User is online, send immediately
      this.io.to(socketId).emit('notification', {
        ...notification,
        id: this.generateNotificationId(),
        timestamp: new Date().toISOString(),
        read: false
      });
    } else {
      // User is offline, queue notification
      this.queueNotification(userId, notification);
    }
  }

  // Broadcast notification to all users
  broadcast(notification, excludeUsers = []) {
    const broadcastNotification = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date().toISOString(),
      read: false
    };

    this.io.emit('notification', broadcastNotification);
    
    // Queue for offline users (simplified - in production, you'd query your user database)
    console.log('Broadcasting notification:', broadcastNotification.title);
  }

  // Send notification to users subscribed to specific type
  sendToSubscribers(type, notification) {
    const notificationData = {
      ...notification,
      type,
      id: this.generateNotificationId(),
      timestamp: new Date().toISOString(),
      read: false
    };

    this.io.to(`type-${type}`).emit('notification', notificationData);
  }

  // Send notification about marketplace events
  sendMarketplaceNotification(event, data) {
    const notifications = {
      'item-published': {
        title: 'New Item Published',
        message: `${data.authorName} published "${data.itemName}"`,
        type: 'marketplace',
        action: { type: 'view-item', itemId: data.itemId }
      },
      'item-updated': {
        title: 'Item Updated', 
        message: `"${data.itemName}" has been updated`,
        type: 'marketplace',
        action: { type: 'view-item', itemId: data.itemId }
      },
      'download-milestone': {
        title: 'Download Milestone',
        message: `Your item "${data.itemName}" reached ${data.downloads} downloads!`,
        type: 'achievement',
        action: { type: 'view-analytics', itemId: data.itemId }
      },
      'new-review': {
        title: 'New Review',
        message: `${data.reviewerName} reviewed "${data.itemName}"`,
        type: 'review',
        action: { type: 'view-reviews', itemId: data.itemId }
      }
    };

    const notification = notifications[event];
    if (notification) {
      if (data.userId) {
        this.sendToUser(data.userId, notification);
      } else {
        this.sendToSubscribers(notification.type, notification);
      }
    }
  }

  // Private helper methods
  validateUser(userId, token) {
    // In production, validate the JWT token
    // For now, just check if both are provided
    return userId && token;
  }

  queueNotification(userId, notification) {
    if (!this.notificationQueue.has(userId)) {
      this.notificationQueue.set(userId, []);
    }
    
    const queue = this.notificationQueue.get(userId);
    queue.push({
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date().toISOString(),
      read: false
    });

    // Keep only the last 50 notifications per user
    if (queue.length > 50) {
      queue.shift();
    }
  }

  deliverQueuedNotifications(userId) {
    const queue = this.notificationQueue.get(userId);
    if (queue && queue.length > 0) {
      const socketId = this.userSessions.get(userId);
      if (socketId) {
        queue.forEach(notification => {
          this.io.to(socketId).emit('notification', notification);
        });
        
        // Clear the queue after delivery
        this.notificationQueue.delete(userId);
      }
    }
  }

  markNotificationAsRead(userId, notificationId) {
    // In production, update database
    console.log(`Marked notification ${notificationId} as read for user ${userId}`);
  }

  markAllNotificationsAsRead(userId) {
    // In production, update database
    console.log(`Marked all notifications as read for user ${userId}`);
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get notification stats
  getStats() {
    return {
      connectedUsers: this.userSessions.size,
      queuedNotifications: Array.from(this.notificationQueue.values())
        .reduce((total, queue) => total + queue.length, 0)
    };
  }
}

export default function setupNotificationWebSocket(io) {
  return new NotificationHandler(io);
}