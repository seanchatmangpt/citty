import { defineCommand } from 'citty'
import { createServer } from 'http'
import { Server } from 'socket.io'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'

// Route imports
import { itemRoutes } from './routes/items/index.js'
import { searchRoutes } from './routes/search/index.js'
import { recommendationRoutes } from './routes/recommendations/index.js'
import { transactionRoutes } from './routes/transactions/index.js'
import { auctionRoutes } from './routes/auctions/index.js'
import { analyticsRoutes } from './routes/analytics/index.js'
import { workflowRoutes } from './routes/workflows/index.js'

// Middleware imports
import { authMiddleware } from './middleware/auth.js'
import { validationMiddleware } from './middleware/validation.js'
import { cacheMiddleware } from './middleware/cache.js'
import { errorHandler } from './middleware/errorHandler.js'

// WebSocket handlers
import { setupAuctionWebSocket } from './websocket/auctionHandler.js'
import { setupNotificationWebSocket } from './websocket/notificationHandler.js'

export const marketplaceApiCommand = defineCommand({
  meta: {
    name: 'marketplace-api',
    description: 'Start the marketplace REST API server with real-time capabilities',
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to run the API server on',
      default: '3001',
    },
    env: {
      type: 'string',
      description: 'Environment mode',
      default: 'development',
    },
  },
  async run({ args }) {
    const app = express()
    const server = createServer(app)
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
      },
    })

    // Security middleware
    app.use(helmet())
    app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    }))

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    })
    app.use('/api/', limiter)

    // Compression and parsing
    app.use(compression())
    app.use(express.json({ limit: '10mb' }))
    app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Global middleware
    app.use(cacheMiddleware)
    app.use('/api/protected', authMiddleware)

    // API Routes
    app.use('/api/items', itemRoutes)
    app.use('/api/search', searchRoutes)
    app.use('/api/recommendations', recommendationRoutes)
    app.use('/api/transactions', transactionRoutes)
    app.use('/api/auctions', auctionRoutes)
    app.use('/api/analytics', analyticsRoutes)
    app.use('/api/workflows', workflowRoutes)

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      })
    })

    // API documentation endpoint
    app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Marketplace API',
        version: '1.0.0',
        description: 'Comprehensive RESTful API for marketplace operations',
        endpoints: {
          items: '/api/items - CRUD operations for marketplace items',
          search: '/api/search - Multi-dimensional search with filters',
          recommendations: '/api/recommendations - ML-powered recommendations',
          transactions: '/api/transactions - Transaction management',
          auctions: '/api/auctions - Real-time bidding system',
          analytics: '/api/analytics - Business intelligence and reporting',
          workflows: '/api/workflows - Automated process execution',
        },
        websocket: {
          auctions: 'Real-time bidding and auction updates',
          notifications: 'Live user notifications',
        },
      })
    })

    // WebSocket setup
    setupAuctionWebSocket(io)
    setupNotificationWebSocket(io)

    // Error handling
    app.use(errorHandler)

    // Start server
    const port = parseInt(args.port)
    server.listen(port, () => {
      console.log(`🚀 Marketplace API server running on port ${port}`)
      console.log(`📚 API Documentation: http://localhost:${port}/api/docs`)
      console.log(`🔍 Health Check: http://localhost:${port}/health`)
      console.log(`⚡ WebSocket enabled for real-time features`)
    })

    return {
      server,
      app,
      io,
      port,
    }
  },
})