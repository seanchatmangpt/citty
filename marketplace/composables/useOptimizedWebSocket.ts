/**
 * Optimized WebSocket composable based on CNS real-time pipeline patterns
 * Implements 80/20 optimization: Core channels always connected, advanced features on-demand
 */

export interface PipelineMetrics {
  latency: number
  throughput: number
  status: 'active' | 'error' | 'waiting'
  cpu?: number
}

export interface OptimizedMarketplaceUpdate {
  type: 'new_item' | 'item_updated' | 'item_sold' | 'price_change'
  itemId: string
  userId?: string
  data: any
  timestamp: Date
}

export interface AuctionUpdate {
  type: 'bid_placed' | 'auction_ended' | 'time_extended'
  auctionId: string
  bidAmount?: number
  bidder?: string
  timestamp: Date
}

export interface NotificationUpdate {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  userId?: string
  timestamp: Date
}

interface OptimizedWebSocketState {
  connected: boolean
  authenticated: boolean
  reconnecting: boolean
  error: string | null
  activeChannels: string[]
  metrics: PipelineMetrics
}

export function useOptimizedWebSocket() {
  let socket: WebSocket | null = null
  let reconnectInterval: NodeJS.Timeout | null = null
  const config = useRuntimeConfig()
  
  // 80/20: Core channels that provide 80% of value
  const coreChannels = ['marketplace', 'auctions', 'notifications']
  const advancedChannels = ['analytics', 'social', 'admin', 'debug']
  
  // Reactive state
  const state = ref<OptimizedWebSocketState>({
    connected: false,
    authenticated: false,
    reconnecting: false,
    error: null,
    activeChannels: [],
    metrics: {
      latency: 0,
      throughput: 0,
      status: 'waiting'
    }
  })

  // Data streams (CNS pattern: typed data channels)
  const marketplaceUpdates = ref<OptimizedMarketplaceUpdate[]>([])
  const auctionUpdates = ref<AuctionUpdate[]>([])
  const notifications = ref<NotificationUpdate[]>([])
  
  // Event handlers registry
  const eventHandlers = new Map<string, Function[]>()
  
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

  // CNS Pattern: Pipeline connection with core channel focus
  const connectToPipeline = (callbacks: {
    onMetrics?: (metrics: PipelineMetrics) => void
    onMarketplace?: (update: OptimizedMarketplaceUpdate) => void
    onAuction?: (update: AuctionUpdate) => void
    onNotification?: (update: NotificationUpdate) => void
  } = {}) => {
    
    if (socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      try {
        socket = new WebSocket(config.public.pipelineWsUrl || 'ws://localhost:9000')
        
        socket.onopen = () => {
          console.log('🔌 Connected to optimized pipeline')
          state.value.connected = true
          state.value.error = null
          
          // 80/20: Subscribe to core channels immediately
          socket!.send(JSON.stringify({ 
            type: 'subscribe', 
            channels: coreChannels,
            timestamp: Date.now()
          }))
          
          state.value.activeChannels = [...coreChannels]
          resolve()
        }
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            // Update metrics
            if (data.timestamp) {
              state.value.metrics.latency = Date.now() - data.timestamp
            }
            
            // CNS Pattern: Type-based message routing
            switch (data.type) {
              case 'metrics':
                state.value.metrics = { ...state.value.metrics, ...data.payload }
                callbacks.onMetrics?.(data.payload)
                emit('metrics', data.payload)
                break
                
              case 'marketplace_update':
                const marketplaceUpdate: OptimizedMarketplaceUpdate = {
                  ...data.payload,
                  timestamp: new Date(data.payload.timestamp)
                }
                marketplaceUpdates.value.unshift(marketplaceUpdate)
                if (marketplaceUpdates.value.length > 50) {
                  marketplaceUpdates.value = marketplaceUpdates.value.slice(0, 50)
                }
                callbacks.onMarketplace?.(marketplaceUpdate)
                emit('marketplace', marketplaceUpdate)
                break
                
              case 'auction_update':
                const auctionUpdate: AuctionUpdate = {
                  ...data.payload,
                  timestamp: new Date(data.payload.timestamp)
                }
                auctionUpdates.value.unshift(auctionUpdate)
                if (auctionUpdates.value.length > 50) {
                  auctionUpdates.value = auctionUpdates.value.slice(0, 50)
                }
                callbacks.onAuction?.(auctionUpdate)
                emit('auction', auctionUpdate)
                break
                
              case 'notification':
                const notification: NotificationUpdate = {
                  ...data.payload,
                  timestamp: new Date(data.payload.timestamp)
                }
                notifications.value.unshift(notification)
                if (notifications.value.length > 20) {
                  notifications.value = notifications.value.slice(0, 20)
                }
                callbacks.onNotification?.(notification)
                emit('notification', notification)
                break
                
              default:
                // Handle custom events
                emit(data.type, data.payload)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }
        
        socket.onerror = (error) => {
          console.error('Pipeline WebSocket error:', error)
          state.value.error = 'Connection error'
          reject(error)
        }
        
        socket.onclose = () => {
          console.log('Pipeline connection closed')
          state.value.connected = false
          state.value.activeChannels = []
          
          // Auto-reconnect with exponential backoff
          if (!reconnectInterval) {
            let attempts = 0
            const maxAttempts = 5
            const baseDelay = 1000
            
            const tryReconnect = () => {
              if (attempts >= maxAttempts) {
                state.value.error = 'Max reconnection attempts reached'
                return
              }
              
              state.value.reconnecting = true
              attempts++
              
              setTimeout(() => {
                if (socket?.readyState === WebSocket.CLOSED) {
                  connectToPipeline(callbacks)
                    .then(() => {
                      state.value.reconnecting = false
                      attempts = 0
                    })
                    .catch(() => {
                      tryReconnect()
                    })
                }
              }, baseDelay * Math.pow(2, attempts))
            }
            
            tryReconnect()
          }
        }
        
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        state.value.error = 'Failed to connect'
        reject(error)
      }
    })
  }

  // Advanced channel management (20% of users need this)
  const subscribeToAdvancedChannels = (channels: string[]) => {
    if (!state.value.connected || !socket) return false

    const validChannels = channels.filter(ch => advancedChannels.includes(ch))
    if (validChannels.length === 0) return false

    socket.send(JSON.stringify({
      type: 'subscribe_advanced',
      channels: validChannels,
      timestamp: Date.now()
    }))

    state.value.activeChannels = [...state.value.activeChannels, ...validChannels]
    return true
  }

  const unsubscribeFromAdvancedChannels = (channels: string[]) => {
    if (!state.value.connected || !socket) return false

    socket.send(JSON.stringify({
      type: 'unsubscribe',
      channels: channels,
      timestamp: Date.now()
    }))

    state.value.activeChannels = state.value.activeChannels.filter(
      ch => !channels.includes(ch)
    )
    return true
  }

  const disconnectPipeline = () => {
    if (reconnectInterval) {
      clearInterval(reconnectInterval)
      reconnectInterval = null
    }
    if (socket) {
      socket.close()
      socket = null
    }
    state.value.connected = false
    state.value.activeChannels = []
  }

  const sendCommand = (command: string, data: any = {}) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'command', 
        command, 
        data,
        timestamp: Date.now()
      }))
      return true
    }
    return false
  }

  // Performance monitoring (CNS pattern)
  const getPerformanceMetrics = () => {
    return {
      connected: state.value.connected,
      latency: state.value.metrics.latency,
      throughput: state.value.metrics.throughput,
      activeChannels: state.value.activeChannels.length,
      uptime: socket ? Date.now() - (socket as any)._startTime : 0
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    disconnectPipeline()
    eventHandlers.clear()
  })

  return {
    // State
    state: readonly(state),
    
    // Data streams
    marketplaceUpdates: readonly(marketplaceUpdates),
    auctionUpdates: readonly(auctionUpdates),
    notifications: readonly(notifications),
    
    // Core connection methods (80% of use cases)
    connectToPipeline,
    disconnectPipeline,
    sendCommand,
    
    // Advanced methods (20% of use cases)
    subscribeToAdvancedChannels,
    unsubscribeFromAdvancedChannels,
    getPerformanceMetrics,
    
    // Event handling
    on,
    off,
    emit,
    
    // Computed helpers
    isConnected: computed(() => state.value.connected),
    hasError: computed(() => !!state.value.error),
    connectionStatus: computed(() => {
      if (state.value.reconnecting) return 'reconnecting'
      if (state.value.connected && state.value.authenticated) return 'authenticated'
      if (state.value.connected) return 'connected'
      return 'disconnected'
    })
  }
}

// CNS Pattern: Specialized composables for specific use cases
export function useMarketplaceWebSocket() {
  const ws = useOptimizedWebSocket()
  
  const subscribeToCategory = (category: string) => {
    return ws.sendCommand('subscribe_category', { category })
  }
  
  const subscribeToItem = (itemId: string) => {
    return ws.sendCommand('subscribe_item', { itemId })
  }
  
  return {
    ...ws,
    subscribeToCategory,
    subscribeToItem,
    marketplaceUpdates: ws.marketplaceUpdates
  }
}

export function useAuctionWebSocket() {
  const ws = useOptimizedWebSocket()
  
  const joinAuction = (auctionId: string) => {
    return ws.sendCommand('join_auction', { auctionId })
  }
  
  const leaveAuction = (auctionId: string) => {
    return ws.sendCommand('leave_auction', { auctionId })
  }
  
  const placeBid = (auctionId: string, amount: number) => {
    return ws.sendCommand('place_bid', { auctionId, amount })
  }
  
  return {
    ...ws,
    joinAuction,
    leaveAuction,
    placeBid,
    auctionUpdates: ws.auctionUpdates
  }
}