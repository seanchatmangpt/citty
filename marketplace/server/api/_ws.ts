// Nitro WebSocket Handler - Unified Architecture
export default defineWebSocketHandler({
  async open(peer) {
    console.log(`🔌 WebSocket connection opened: ${peer.id}`)
    
    // Send connection confirmation
    peer.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to Citty Pro Marketplace WebSocket',
      timestamp: new Date().toISOString(),
      peerId: peer.id
    }))
  },

  async message(peer, message) {
    try {
      const data = JSON.parse(message.text())
      console.log(`📨 WebSocket message from ${peer.id}:`, data)

      switch (data.type) {
        case 'ping':
          peer.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }))
          break

        case 'join_room':
          // Join a specific room (auction, marketplace, notifications)
          await peer.subscribe(data.room)
          peer.send(JSON.stringify({
            type: 'room_joined',
            room: data.room,
            timestamp: new Date().toISOString()
          }))
          break

        case 'leave_room':
          // Leave a specific room
          await peer.unsubscribe(data.room)
          peer.send(JSON.stringify({
            type: 'room_left',
            room: data.room,
            timestamp: new Date().toISOString()
          }))
          break

        case 'auction_bid':
          // Handle auction bidding
          if (data.auctionId && data.amount) {
            // Broadcast to auction room
            await peer.publish(`auction:${data.auctionId}`, JSON.stringify({
              type: 'new_bid',
              auctionId: data.auctionId,
              amount: data.amount,
              bidder: data.bidder || 'Anonymous',
              timestamp: new Date().toISOString()
            }))

            // Confirm bid to sender
            peer.send(JSON.stringify({
              type: 'bid_confirmed',
              auctionId: data.auctionId,
              amount: data.amount,
              timestamp: new Date().toISOString()
            }))
          }
          break

        case 'marketplace_update':
          // Handle marketplace updates
          if (data.itemId) {
            await peer.publish(`item:${data.itemId}`, JSON.stringify({
              type: 'item_updated',
              itemId: data.itemId,
              updates: data.updates || {},
              timestamp: new Date().toISOString()
            }))
          }
          break

        case 'notification':
          // Handle user notifications
          if (data.userId && data.message) {
            await peer.publish(`user:${data.userId}`, JSON.stringify({
              type: 'notification',
              message: data.message,
              priority: data.priority || 'normal',
              timestamp: new Date().toISOString()
            }))
          }
          break

        default:
          peer.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`,
            timestamp: new Date().toISOString()
          }))
      }
    } catch (error) {
      console.error('WebSocket message error:', error)
      peer.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }))
    }
  },

  async close(peer, event) {
    console.log(`❌ WebSocket connection closed: ${peer.id}`, event.code, event.reason)
  },

  async error(peer, error) {
    console.error(`🚨 WebSocket error for ${peer.id}:`, error)
  }
})