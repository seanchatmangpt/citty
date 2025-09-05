/**
 * WebSocket handler for real-time auction functionality
 */

export class AuctionHandler {
  constructor(io) {
    this.io = io;
    this.activeAuctions = new Map();
    this.userBids = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Auction client connected: ${socket.id}`);

      // Join auction room
      socket.on('join-auction', (auctionId) => {
        socket.join(`auction-${auctionId}`);
        console.log(`Client ${socket.id} joined auction ${auctionId}`);
        
        // Send current auction state
        const auction = this.activeAuctions.get(auctionId);
        if (auction) {
          socket.emit('auction-state', auction);
        }
      });

      // Leave auction room
      socket.on('leave-auction', (auctionId) => {
        socket.leave(`auction-${auctionId}`);
        console.log(`Client ${socket.id} left auction ${auctionId}`);
      });

      // Place bid
      socket.on('place-bid', async (data) => {
        try {
          const { auctionId, amount, userId } = data;
          const result = await this.placeBid(auctionId, amount, userId, socket.id);
          
          if (result.success) {
            // Broadcast bid to all clients in auction room
            this.io.to(`auction-${auctionId}`).emit('new-bid', {
              auctionId,
              amount,
              userId,
              timestamp: new Date().toISOString(),
              bidCount: result.bidCount
            });
          } else {
            socket.emit('bid-error', { message: result.message });
          }
        } catch (error) {
          console.error('Bid placement error:', error);
          socket.emit('bid-error', { message: 'Failed to place bid' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Auction client disconnected: ${socket.id}`);
        this.handleDisconnect(socket.id);
      });
    });
  }

  async placeBid(auctionId, amount, userId, socketId) {
    const auction = this.activeAuctions.get(auctionId);
    if (!auction) {
      return { success: false, message: 'Auction not found' };
    }

    if (auction.status !== 'active') {
      return { success: false, message: 'Auction is not active' };
    }

    if (amount <= auction.currentBid) {
      return { success: false, message: 'Bid must be higher than current bid' };
    }

    if (new Date() > new Date(auction.endTime)) {
      return { success: false, message: 'Auction has ended' };
    }

    // Update auction state
    auction.currentBid = amount;
    auction.leadingBidder = userId;
    auction.bidCount = (auction.bidCount || 0) + 1;
    auction.lastBidTime = new Date().toISOString();

    // Store user bid info
    this.userBids.set(socketId, { auctionId, userId, amount });

    return { success: true, bidCount: auction.bidCount };
  }

  createAuction(auctionData) {
    const auctionId = auctionData.id || `auction_${Date.now()}`;
    this.activeAuctions.set(auctionId, {
      ...auctionData,
      id: auctionId,
      status: 'active',
      currentBid: auctionData.startingBid || 0,
      bidCount: 0,
      createdAt: new Date().toISOString()
    });

    // Broadcast new auction to all clients
    this.io.emit('new-auction', this.activeAuctions.get(auctionId));
    
    return auctionId;
  }

  endAuction(auctionId) {
    const auction = this.activeAuctions.get(auctionId);
    if (auction) {
      auction.status = 'ended';
      auction.endedAt = new Date().toISOString();
      
      // Notify all clients in auction room
      this.io.to(`auction-${auctionId}`).emit('auction-ended', {
        auctionId,
        winner: auction.leadingBidder,
        winningBid: auction.currentBid
      });
    }
  }

  getActiveAuctions() {
    return Array.from(this.activeAuctions.values()).filter(
      auction => auction.status === 'active'
    );
  }

  handleDisconnect(socketId) {
    // Clean up user bid data
    this.userBids.delete(socketId);
  }
}

export default function setupAuctionWebSocket(io) {
  return new AuctionHandler(io);
}