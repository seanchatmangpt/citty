import { io, type Socket } from 'socket.io-client'
import type { MarketplaceUpdate, UserActivity } from '~/server/api/marketplace/websocket'

interface WebSocketState {
  connected: boolean
  authenticated: boolean
  reconnecting: boolean
  error: string | null
  userId: string | null
  socketId: string | null
}

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    heartbeatInterval = 30000
  } = options

  // Reactive state
  const state = reactive<WebSocketState>({
    connected: false,
    authenticated: false,
    reconnecting: false,
    error: null,
    userId: null,
    socketId: null
  })

  // Socket instance
  let socket: Socket | null = null
  let reconnectCount = 0
  let heartbeatTimer: NodeJS.Timeout | null = null

  // Event emitters
  const marketplaceUpdates = ref<MarketplaceUpdate[]>([])
  const userActivities = ref<UserActivity[]>([])

  // Event handlers
  const eventHandlers = new Map<string, Function[]>()

  const on = (event: string, handler: Function) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, [])
    }
    eventHandlers.get(event)!.push(handler)
  }

  const off = (event: string, handler?: Function) => {
    const handlers = eventHandlers.get(event)
    if (!handlers) return

    if (handler) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    } else {
      eventHandlers.delete(event)
    }
  }

  const emit = (event: string, ...args: any[]) => {
    const handlers = eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  // Connection management
  const connect = (serverUrl?: string) => {
    if (socket?.connected) return

    const url = serverUrl || (process.client ? window.location.origin : 'http://localhost:3000')
    
    socket = io(url, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: false
    })

    setupEventHandlers()
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
    }
    stopHeartbeat()
    state.connected = false
    state.authenticated = false
  }

  // Authentication
  const authenticate = (userId: string, token?: string) => {
    if (!socket?.connected) {
      state.error = 'Socket not connected'
      return false
    }

    socket.emit('authenticate', { userId, token })
    state.userId = userId
    return true
  }

  // Subscriptions
  const subscribeToCategory = (category: string) => {
    socket?.emit('subscribe_to_category', category)
  }

  const unsubscribeFromCategory = (category: string) => {
    socket?.emit('unsubscribe_from_category', category)
  }

  const subscribeToItem = (itemId: string) => {
    socket?.emit('subscribe_to_item', itemId)
  }

  const unsubscribeFromItem = (itemId: string) => {
    socket?.emit('unsubscribe_from_item', itemId)
  }

  // User activity tracking
  const trackActivity = (activity: Omit<UserActivity, 'timestamp'>) => {
    if (!socket?.connected || !state.authenticated) return

    socket.emit('user_activity', activity)
  }

  const trackSearchQuery = (query: string, filters?: any) => {
    if (!socket?.connected || !state.authenticated) return

    socket.emit('search_query', {
      query,
      filters,
      userId: state.userId
    })
  }

  const trackItemView = (itemId: string) => {
    if (!socket?.connected) return

    socket.emit('item_view', {
      itemId,
      userId: state.userId
    })

    // Also track as general activity
    if (state.authenticated && state.userId) {
      trackActivity({
        userId: state.userId,
        action: 'view',
        itemId,
        metadata: { timestamp: new Date().toISOString() }
      })
    }
  }

  const toggleFavorite = (itemId: string, isFavorite: boolean) => {
    if (!socket?.connected || !state.userId) return

    socket.emit('toggle_favorite', {
      itemId,
      userId: state.userId,
      isFavorite
    })

    // Track as activity
    trackActivity({
      userId: state.userId,
      action: 'favorite',
      itemId,
      metadata: { favorited: isFavorite }
    })
  }

  // Event setup
  const setupEventHandlers = () => {
    if (!socket) return

    socket.on('connect', () => {
      state.connected = true
      state.reconnecting = false
      state.error = null
      reconnectCount = 0
      startHeartbeat()
      emit('connected')
    })

    socket.on('disconnect', (reason) => {
      state.connected = false
      state.authenticated = false
      stopHeartbeat()
      emit('disconnected', reason)

      // Auto-reconnect logic
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return
      }

      if (reconnectCount < reconnectAttempts) {
        state.reconnecting = true
        reconnectCount++
        setTimeout(() => {
          socket?.connect()
        }, reconnectDelay * reconnectCount)
      } else {
        state.error = 'Failed to reconnect after maximum attempts'
        emit('reconnect_failed')
      }
    })

    socket.on('authenticated', (data) => {
      state.authenticated = true
      state.socketId = data.socketId
      emit('authenticated', data)
    })

    socket.on('authentication_error', (error) => {
      state.error = error.error
      emit('authentication_error', error)
    })

    socket.on('marketplace_update', (update: MarketplaceUpdate) => {
      marketplaceUpdates.value.unshift(update)
      // Keep only last 100 updates
      if (marketplaceUpdates.value.length > 100) {
        marketplaceUpdates.value = marketplaceUpdates.value.slice(0, 100)
      }
      emit('marketplace_update', update)
    })

    socket.on('marketplace_activity', (activity) => {
      if (activity.type === 'user_activity') {
        userActivities.value.unshift(activity.data)
        // Keep only last 50 activities
        if (userActivities.value.length > 50) {
          userActivities.value = userActivities.value.slice(0, 50)
        }
      }
      emit('marketplace_activity', activity)
    })

    socket.on('subscribed', (data) => {
      emit('subscribed', data)
    })

    socket.on('unsubscribed', (data) => {
      emit('unsubscribed', data)
    })

    socket.on('pong', (data) => {
      // Handle heartbeat response
      emit('pong', data)
    })

    socket.on('connect_error', (error) => {
      state.error = error.message
      emit('connect_error', error)
    })
  }

  // Heartbeat
  const startHeartbeat = () => {
    if (heartbeatTimer) return

    heartbeatTimer = setInterval(() => {
      if (socket?.connected) {
        socket.emit('ping')
      }
    }, heartbeatInterval)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // Computed properties
  const connectionStatus = computed(() => {
    if (state.reconnecting) return 'reconnecting'
    if (state.connected && state.authenticated) return 'authenticated'
    if (state.connected) return 'connected'
    return 'disconnected'
  })

  const hasError = computed(() => !!state.error)

  // Lifecycle
  onMounted(() => {
    if (autoConnect && process.client) {
      connect()
    }
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    state: readonly(state),
    connectionStatus,
    hasError,
    marketplaceUpdates: readonly(marketplaceUpdates),
    userActivities: readonly(userActivities),

    // Connection management
    connect,
    disconnect,
    authenticate,

    // Subscriptions
    subscribeToCategory,
    unsubscribeFromCategory,
    subscribeToItem,
    unsubscribeFromItem,

    // Activity tracking
    trackActivity,
    trackSearchQuery,
    trackItemView,
    toggleFavorite,

    // Event handling
    on,
    off,
    emit
  }
}