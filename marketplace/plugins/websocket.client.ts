// Native WebSocket Plugin for Nuxt/Nitro Integration
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const isDev = process.dev
  
  // WebSocket connection management
  let ws: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let pingTimer: NodeJS.Timeout | null = null
  
  // Connection state
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)
  const subscriptions = new Set<string>()
  
  // Message handlers
  const messageHandlers = new Map<string, Function[]>()
  
  // WebSocket URL - use unified Nitro endpoint
  const getWebSocketUrl = () => {
    const baseUrl = config.public.appUrl || 'http://localhost:3002'
    return baseUrl.replace('http', 'ws') + '/_ws'
  }
  
  // Register message handler
  const on = (type: string, handler: Function) => {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, [])
    }
    messageHandlers.get(type)!.push(handler)
  }
  
  // Remove message handler
  const off = (type: string, handler: Function) => {
    const handlers = messageHandlers.get(type)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  // Send message
  const send = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
      return true
    }
    console.warn('WebSocket not connected, message not sent:', data)
    return false
  }
  
  // Connect to WebSocket
  const connect = () => {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return
    }
    
    try {
      const wsUrl = getWebSocketUrl()
      console.log('🔌 Connecting to WebSocket:', wsUrl)
      
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        isConnected.value = true
        connectionError.value = null
        
        // Clear reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        
        // Start ping timer
        startPingTimer()
        
        // Re-subscribe to rooms
        subscriptions.forEach(room => {
          send({ type: 'join_room', room })
        })
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle system messages
          if (data.type === 'pong') {
            // Pong received, connection is alive
            return
          }
          
          // Call registered handlers
          const handlers = messageHandlers.get(data.type)
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(data)
              } catch (error) {
                console.error('WebSocket handler error:', error)
              }
            })
          }
          
          // Emit to global event bus if available
          if (process.client && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }))
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error)
        }
      }
      
      ws.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.code, event.reason)
        isConnected.value = false
        
        // Stop ping timer
        if (pingTimer) {
          clearInterval(pingTimer)
          pingTimer = null
        }
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000) {
          scheduleReconnect()
        }
      }
      
      ws.onerror = (error) => {
        console.error('🚨 WebSocket error:', error)
        connectionError.value = 'WebSocket connection error'
        isConnected.value = false
      }
      
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      connectionError.value = 'Failed to connect to WebSocket'
      scheduleReconnect()
    }
  }
  
  // Disconnect WebSocket
  const disconnect = () => {
    if (ws) {
      ws.close(1000, 'Client disconnect')
      ws = null
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
    
    isConnected.value = false
    subscriptions.clear()
  }
  
  // Schedule reconnect
  const scheduleReconnect = () => {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        if (!isConnected.value) {
          console.log('🔄 Attempting to reconnect...')
          connect()
        }
      }, 5000) // 5 second delay
    }
  }
  
  // Start ping timer to keep connection alive
  const startPingTimer = () => {
    if (pingTimer) {
      clearInterval(pingTimer)
    }
    
    pingTimer = setInterval(() => {
      if (isConnected.value) {
        send({ type: 'ping' })
      }
    }, 30000) // Ping every 30 seconds
  }
  
  // Subscribe to room
  const joinRoom = (room: string) => {
    subscriptions.add(room)
    if (isConnected.value) {
      send({ type: 'join_room', room })
    }
  }
  
  // Unsubscribe from room
  const leaveRoom = (room: string) => {
    subscriptions.delete(room)
    if (isConnected.value) {
      send({ type: 'leave_room', room })
    }
  }
  
  // Auction-specific methods
  const joinAuction = (auctionId: string) => {
    joinRoom(`auction:${auctionId}`)
  }
  
  const leaveAuction = (auctionId: string) => {
    leaveRoom(`auction:${auctionId}`)
  }
  
  const placeBid = (auctionId: string, amount: number, bidder?: string) => {
    return send({
      type: 'auction_bid',
      auctionId,
      amount,
      bidder,
      timestamp: new Date().toISOString()
    })
  }
  
  // Marketplace-specific methods
  const subscribeToItem = (itemId: string) => {
    joinRoom(`item:${itemId}`)
  }
  
  const unsubscribeFromItem = (itemId: string) => {
    leaveRoom(`item:${itemId}`)
  }
  
  const updateItem = (itemId: string, updates: any) => {
    return send({
      type: 'marketplace_update',
      itemId,
      updates,
      timestamp: new Date().toISOString()
    })
  }
  
  // Notification-specific methods
  const subscribeToNotifications = (userId: string) => {
    joinRoom(`user:${userId}`)
  }
  
  const unsubscribeFromNotifications = (userId: string) => {
    leaveRoom(`user:${userId}`)
  }
  
  // Auto-connect on client-side
  if (process.client && !isDev) {
    // Connect after a small delay to allow page to load
    setTimeout(connect, 1000)
  }
  
  // Cleanup on page unload
  if (process.client) {
    window.addEventListener('beforeunload', disconnect)
  }
  
  return {
    provide: {
      websocket: {
        // Connection management
        connect,
        disconnect,
        isConnected: readonly(isConnected),
        connectionError: readonly(connectionError),
        
        // Message handling
        on,
        off,
        send,
        
        // Room management
        joinRoom,
        leaveRoom,
        
        // Auction methods
        auction: {
          join: joinAuction,
          leave: leaveAuction,
          placeBid
        },
        
        // Marketplace methods
        marketplace: {
          subscribeToItem,
          unsubscribeFromItem,
          updateItem
        },
        
        // Notification methods
        notifications: {
          subscribe: subscribeToNotifications,
          unsubscribe: unsubscribeFromNotifications
        }
      }
    }
  }
})