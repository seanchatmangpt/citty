/**
 * Migrated WebSocket composable using Nuxt-native WebSocket implementation
 * This composable now uses the new useNuxtWebSocket under the hood
 * while maintaining backward compatibility with the existing API
 */

import { useAuctionWebSocket, useNotificationWebSocket } from './useNuxtWebSocket'

export interface MarketplaceUpdate {
  type: 'new_item' | 'item_updated' | 'item_sold' | 'price_change'
  itemId: string
  userId?: string
  data: any
  timestamp: Date
}

export interface UserActivity {
  userId: string
  action: string
  itemId?: string
  metadata?: any
  timestamp: Date
}

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
  authentication?: {
    userId: string
    token?: string
  }
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  // Initialize both auction and notification WebSocket connections
  const auctionWs = useAuctionWebSocket({
    autoConnect: options.autoConnect,
    reconnectAttempts: options.reconnectAttempts,
    reconnectDelay: options.reconnectDelay,
    heartbeatInterval: options.heartbeatInterval,
    authentication: options.authentication
  })

  const notificationWs = useNotificationWebSocket({
    autoConnect: options.autoConnect,
    reconnectAttempts: options.reconnectAttempts,
    reconnectDelay: options.reconnectDelay,
    heartbeatInterval: options.heartbeatInterval,
    authentication: options.authentication
  })

  // Combined state - prioritize auction connection for primary state
  const state = computed<WebSocketState>(() => ({
    connected: auctionWs.state.connected || notificationWs.state.connected,
    authenticated: auctionWs.state.authenticated || notificationWs.state.authenticated,
    reconnecting: auctionWs.state.reconnecting || notificationWs.state.reconnecting,
    error: auctionWs.state.error || notificationWs.state.error,
    userId: auctionWs.state.userId || notificationWs.state.userId,
    socketId: auctionWs.state.socketId || notificationWs.state.socketId
  }))

  // Combined event handlers
  const eventHandlers = new Map<string, Function[]>()

  const on = (event: string, handler: Function) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, [])
    }
    eventHandlers.get(event)!.push(handler)

    // Register with both WebSocket instances
    auctionWs.on(event, handler)
    notificationWs.on(event, handler)
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

    // Unregister from both WebSocket instances
    auctionWs.off(event, handler)
    notificationWs.off(event, handler)
  }

  const emit = (event: string, ...args: any[]) => {
    const handlers = eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  // Connection management - manage both connections
  const connect = (serverUrl?: string) => {
    auctionWs.connect()
    notificationWs.connect()
  }

  const disconnect = () => {
    auctionWs.disconnect()
    notificationWs.disconnect()
  }

  // Authentication - authenticate both connections
  const authenticate = (userId: string, token?: string) => {
    const auctionResult = auctionWs.authenticate(userId, token)
    const notificationResult = notificationWs.authenticate(userId, token)
    return auctionResult && notificationResult
  }

  // Legacy API compatibility methods
  const subscribeToCategory = (category: string) => {
    return notificationWs.subscribe([], [category])
  }

  const unsubscribeFromCategory = (category: string) => {
    return notificationWs.unsubscribe([], [category])
  }

  const subscribeToItem = (itemId: string) => {
    return auctionWs.joinAuction(itemId)
  }

  const unsubscribeFromItem = (itemId: string) => {
    return auctionWs.leaveAuction(itemId)
  }

  // Activity tracking methods
  const trackActivity = (activity: Omit<UserActivity, 'timestamp'>) => {
    if (!state.value.authenticated) return

    const fullActivity = {
      ...activity,
      timestamp: new Date()
    } as UserActivity

    notificationWs.send({
      type: 'track_activity',
      payload: fullActivity
    }, true)
  }

  const trackSearchQuery = (query: string, filters?: any) => {
    if (!state.value.authenticated) return

    notificationWs.send({
      type: 'track_search',
      payload: {
        query,
        filters,
        userId: state.value.userId
      }
    }, true)
  }

  const trackItemView = (itemId: string) => {
    if (!state.value.connected) return

    // Track view in auction WebSocket
    auctionWs.watchAuction(itemId)

    // Also track as general activity if authenticated
    if (state.value.authenticated && state.value.userId) {
      trackActivity({
        userId: state.value.userId,
        action: 'view',
        itemId,
        metadata: { timestamp: new Date().toISOString() }
      })
    }
  }

  const toggleFavorite = (itemId: string, isFavorite: boolean) => {
    if (!state.value.connected || !state.value.userId) return

    notificationWs.send({
      type: 'toggle_favorite',
      payload: {
        itemId,
        userId: state.value.userId,
        isFavorite
      }
    }, true)

    // Track as activity
    trackActivity({
      userId: state.value.userId,
      action: 'favorite',
      itemId,
      metadata: { favorited: isFavorite }
    })
  }

  // Computed properties
  const connectionStatus = computed(() => {
    if (state.value.reconnecting) return 'reconnecting'
    if (state.value.connected && state.value.authenticated) return 'authenticated'
    if (state.value.connected) return 'connected'
    return 'disconnected'
  })

  const hasError = computed(() => !!state.value.error)

  // Combined data sources
  const marketplaceUpdates = computed(() => {
    return [...notificationWs.marketplaceUpdates]
  })

  const userActivities = computed(() => {
    return [...notificationWs.userActivities]
  })

  return {
    // State (backward compatibility)
    state: readonly(state),
    connectionStatus,
    hasError,
    marketplaceUpdates: readonly(marketplaceUpdates),
    userActivities: readonly(userActivities),

    // Additional data from new implementation
    notifications: readonly(notificationWs.notifications),

    // Connection management
    connect,
    disconnect,
    authenticate,

    // Legacy subscription methods
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
    emit,

    // Direct access to underlying WebSocket instances for advanced usage
    auction: auctionWs,
    notifications: notificationWs
  }
}