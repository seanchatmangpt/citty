# Marketplace RESTful API

A comprehensive marketplace API built with Express.js, TypeScript, and citty-pro workflow orchestration, featuring real-time capabilities through WebSocket connections.

## 🚀 Features

### Core Functionality
- **CRUD Operations** - Complete item lifecycle management
- **Multi-dimensional Search** - Advanced search with filters, facets, and sorting
- **ML-powered Recommendations** - Collaborative, content-based, and hybrid recommendation systems
- **Transaction Management** - Full payment processing with escrow and state tracking
- **Real-time Auctions** - WebSocket-powered bidding system with auto-bidding
- **Business Analytics** - Comprehensive reporting and metrics
- **Workflow Automation** - citty-pro integration for automated processes
- **CNS Memory Caching** - Advanced caching layer for optimal performance

### Technical Features
- **OpenAPI 3.0 Specification** - Complete API documentation
- **JWT Authentication** - Secure token-based authentication
- **Role-based Authorization** - Granular permission system
- **Rate Limiting** - Protection against abuse
- **Input Validation** - Comprehensive request validation with Joi
- **Error Handling** - Structured error responses
- **Real-time Communication** - WebSocket support for live updates
- **Caching Strategy** - Multi-layer caching with TTL and invalidation
- **Test Coverage** - Comprehensive test suite with Vitest

## 📁 API Structure

```
/marketplace/server/api/
├── index.ts                    # Main API server with citty integration
├── middleware/                 # Express middleware
│   ├── auth.ts                # JWT authentication
│   ├── cache.ts               # CNS memory caching
│   ├── validation.ts          # Request validation
│   └── errorHandler.ts        # Error handling
├── routes/                    # API endpoint routes
│   ├── items/                 # Item CRUD operations
│   ├── search/                # Multi-dimensional search
│   ├── recommendations/       # ML recommendation engine
│   ├── transactions/          # Payment and escrow
│   ├── auctions/              # Real-time bidding
│   ├── analytics/             # Business intelligence
│   └── workflows/             # citty-pro automation
├── websocket/                 # Real-time handlers
│   ├── auctionHandler.ts      # Auction bidding
│   └── notificationHandler.ts # User notifications
├── utils/                     # Utility functions
│   └── errors.ts              # Custom error classes
├── tests/                     # Test suite
│   ├── items.test.ts          # Item API tests
│   ├── search.test.ts         # Search API tests
│   └── workflows.test.ts      # Workflow API tests
├── openapi.yaml               # OpenAPI 3.0 specification
└── README.md                  # This file
```

## 🛠 Setup & Installation

### Prerequisites
- Node.js 18+
- TypeScript 5+
- citty framework
- Express.js 4+

### Installation

```bash
# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env

# Start development server
pnpm run dev

# Start API server on specific port
pnpm run api --port=3001
```

### Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="your-database-connection-string"

# Authentication
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# External Services
STRIPE_SECRET_KEY="your-stripe-key"
PAYPAL_CLIENT_ID="your-paypal-id"
SENDGRID_API_KEY="your-sendgrid-key"

# Frontend Configuration
FRONTEND_URL="http://localhost:3000"

# Cache Configuration
REDIS_URL="redis://localhost:6379"
CACHE_TTL=300

# File Upload
MAX_FILE_SIZE="10mb"
UPLOAD_PATH="./uploads"
```

## 📚 API Endpoints

### Items API
```
GET    /api/items              # List items with filtering
POST   /api/items              # Create new item
GET    /api/items/:id          # Get item details
PUT    /api/items/:id          # Update item
DELETE /api/items/:id          # Delete item
POST   /api/items/:id/images   # Upload item images
GET    /api/items/:id/similar  # Get similar items
POST   /api/items/:id/view     # Track item view
POST   /api/items/:id/favorite # Add to favorites
```

### Search API
```
GET    /api/search                    # Multi-dimensional search
GET    /api/search/facets             # Available search facets
GET    /api/search/suggestions        # Search autocomplete
POST   /api/search/saved              # Save search query
GET    /api/search/saved              # Get saved searches
GET    /api/search/trending           # Trending searches
POST   /api/search/track              # Track search analytics
```

### Recommendations API
```
GET    /api/recommendations                     # Personalized recommendations
GET    /api/recommendations/similar/:itemId     # Similar items
GET    /api/recommendations/trending            # Trending items
GET    /api/recommendations/popular             # Popular items
POST   /api/recommendations/interaction         # Track user interaction
GET    /api/recommendations/collaborative/:userId # Collaborative filtering
GET    /api/recommendations/content/:itemId     # Content-based filtering
```

### Transactions API
```
POST   /api/transactions                       # Create transaction
GET    /api/transactions                       # Get user transactions
GET    /api/transactions/:id                   # Transaction details
PUT    /api/transactions/:id/status            # Update status
POST   /api/transactions/:id/payment           # Process payment
POST   /api/transactions/:id/refund            # Process refund
GET    /api/transactions/:id/history           # Transaction history
POST   /api/transactions/:id/dispute           # Create dispute
GET    /api/transactions/escrow/status         # Escrow status
```

### Auctions API
```
POST   /api/auctions                   # Create auction
GET    /api/auctions                   # List active auctions
GET    /api/auctions/:id               # Auction details
POST   /api/auctions/:id/bid           # Place bid
GET    /api/auctions/:id/bids          # Bid history
POST   /api/auctions/:id/watch         # Watch auction
GET    /api/auctions/ending-soon       # Ending soon
GET    /api/auctions/popular           # Popular auctions
POST   /api/auctions/:id/auto-bid      # Setup auto-bidding
```

### Analytics API (Admin/Seller only)
```
GET    /api/analytics/overview         # Analytics overview
GET    /api/analytics/sales            # Sales analytics
GET    /api/analytics/users            # User analytics (Admin only)
GET    /api/analytics/items            # Item performance
GET    /api/analytics/revenue          # Revenue analytics (Admin only)
GET    /api/analytics/conversion       # Conversion analytics
GET    /api/analytics/geographic       # Geographic analytics
GET    /api/analytics/trends           # Trend analysis
GET    /api/analytics/realtime         # Real-time analytics
POST   /api/analytics/custom           # Custom queries (Admin only)
```

### Workflows API
```
POST   /api/workflows                          # Create workflow
GET    /api/workflows                          # List workflows
GET    /api/workflows/:id                      # Workflow details
PUT    /api/workflows/:id                      # Update workflow
DELETE /api/workflows/:id                      # Delete workflow
POST   /api/workflows/:id/execute              # Execute workflow
GET    /api/workflows/:id/executions           # Execution history
GET    /api/workflows/executions/:executionId  # Execution details
POST   /api/workflows/:id/pause                # Pause execution
POST   /api/workflows/:id/resume               # Resume execution
GET    /api/workflows/templates                # Workflow templates
POST   /api/workflows/templates/:id/create     # Create from template
GET    /api/workflows/:id/metrics              # Performance metrics
```

## 🔌 WebSocket Events

### Auction Events (Namespace: `/auctions`)
```javascript
// Client Events
socket.emit('authenticate', { userId, token })
socket.emit('join_auction', { auctionId })
socket.emit('place_bid', { auctionId, amount, maxBid })
socket.emit('leave_auction', { auctionId })

// Server Events
socket.on('authenticated', (data) => {})
socket.on('joined_auction', (data) => {})
socket.on('new_bid', (data) => {})
socket.on('auction_extended', (data) => {})
socket.on('user_joined', (data) => {})
socket.on('bid_error', (data) => {})
```

### Notification Events (Namespace: `/notifications`)
```javascript
// Client Events
socket.emit('authenticate', { userId, token })
socket.emit('get_notifications', { page, limit, type })
socket.emit('mark_read', { notificationId })

// Server Events
socket.on('new_notification', (data) => {})
socket.on('unread_count', (data) => {})
socket.on('notifications', (data) => {})
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test items.test.ts

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test --watch
```

### Test Categories

- **Unit Tests** - Individual function testing
- **Integration Tests** - API endpoint testing
- **Authentication Tests** - Security testing
- **Performance Tests** - Load and response time testing
- **WebSocket Tests** - Real-time functionality testing

## 🔐 Authentication & Authorization

### Authentication Flow
1. User registration/login with email/password
2. Server generates JWT token with user claims
3. Client includes token in `Authorization: Bearer <token>` header
4. Server validates token and extracts user information

### Authorization Levels
- **Public** - No authentication required
- **User** - Basic authenticated user
- **Seller** - Can create and manage items
- **Admin** - Full system access

### Permissions
```typescript
permissions: [
  'create',    // Create resources
  'read',      // Read resources
  'update',    // Update resources
  'delete',    // Delete resources
  'admin'      // Administrative access
]
```

## 💾 Caching Strategy

### CNS Memory Layers
- **Search Cache** - 60 seconds TTL for search results
- **Item Cache** - 10 minutes TTL for item details
- **Recommendation Cache** - 5 minutes TTL for ML results
- **Analytics Cache** - 30 minutes TTL for aggregated data
- **User Data Cache** - 3 minutes TTL for user-specific data

### Cache Invalidation
- Automatic TTL-based expiration
- Manual invalidation on data changes
- Pattern-based cache clearing
- LRU eviction for memory management

## 🔄 Workflow Integration with citty-pro

### Workflow Types
- **Order Processing** - Automated order fulfillment
- **User Onboarding** - Welcome sequences and setup
- **Inventory Management** - Stock level automation
- **Payment Processing** - Transaction workflows
- **Notification Delivery** - Multi-channel messaging

### citty-pro Steps
```typescript
{
  type: 'citty-pro',
  config: {
    cittyProCommand: 'payment-processor',
    cittyProArgs: {
      orderId: '${order.id}',
      amount: '${order.amount}'
    }
  }
}
```

### Workflow Execution
- Manual trigger via API
- Event-based automatic triggers
- Scheduled execution with cron
- Webhook-triggered workflows

## 📊 Analytics & Monitoring

### Metrics Collected
- **Sales Metrics** - Revenue, conversion rates, order values
- **User Metrics** - Registration, retention, engagement
- **Item Metrics** - Views, favorites, conversion rates
- **Performance Metrics** - Response times, error rates
- **Business Metrics** - GMV, take rates, growth rates

### Real-time Analytics
- Active user counts
- Live transaction monitoring
- Real-time revenue tracking
- Performance dashboards

## 🚀 Performance Optimizations

### Database Optimizations
- Indexed queries for fast searching
- Connection pooling
- Query optimization
- Read replicas for scaling

### API Optimizations
- Response compression
- HTTP/2 support
- Connection keep-alive
- Batch request processing

### Caching Optimizations
- Multi-layer caching strategy
- Cache warming
- Smart invalidation
- CDN integration

## 🔧 Development

### Code Quality
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Pre-commit hooks

### API Documentation
- OpenAPI 3.0 specification
- Interactive documentation
- Code examples
- Response schemas

### Error Handling
- Structured error responses
- Error logging and monitoring
- Graceful degradation
- Client-friendly error messages

## 📈 Scalability

### Horizontal Scaling
- Stateless API design
- Load balancer ready
- Session-less architecture
- Microservice compatible

### Vertical Scaling
- Efficient memory usage
- Connection pooling
- Resource optimization
- Performance monitoring

## 🛡 Security

### Security Measures
- JWT token authentication
- Rate limiting
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Helmet.js security headers

### Data Protection
- Encryption at rest
- Encryption in transit
- Secure password hashing
- PCI compliance for payments
- GDPR compliance features

## 📞 Support & Maintenance

### Health Monitoring
- Health check endpoints
- Application metrics
- Error tracking
- Performance monitoring

### Logging
- Structured logging
- Request/response logging
- Error logging
- Performance logging

### Deployment
- Docker containerization
- Environment configuration
- CI/CD pipeline ready
- Blue-green deployment support

## 🎯 Future Enhancements

### Planned Features
- GraphQL API support
- Advanced ML recommendations
- Multi-language support
- Mobile app APIs
- Blockchain integration
- AI-powered chat support

### Performance Improvements
- Database sharding
- CDN integration
- Edge computing
- Advanced caching strategies

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with citty-pro workflow orchestration for maximum scalability and automation.**