import { Request, Response } from 'express'
import { ApiError } from '../../utils/errors.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

interface RecommendationEngine {
  collaborative: (userId: string, options: any) => Promise<any[]>
  contentBased: (itemId: string, options: any) => Promise<any[]>
  hybrid: (userId: string, itemId?: string, options?: any) => Promise<any[]>
}

interface UserInteraction {
  userId: string
  itemId: string
  action: 'view' | 'like' | 'purchase' | 'add_to_cart' | 'share'
  weight: number
  timestamp: Date
  sessionId?: string
  context?: Record<string, any>
}

// Mock recommendation data and ML models
const mockRecommendationData = {
  userInteractions: new Map<string, UserInteraction[]>(),
  itemSimilarities: new Map<string, Map<string, number>>(),
  userProfiles: new Map<string, any>(),
  popularItems: [] as any[],
  trendingItems: [] as any[],
  categoryTrends: new Map<string, any[]>(),
  modelPerformance: {
    collaborative: { accuracy: 0.85, lastTrained: new Date() },
    contentBased: { accuracy: 0.78, lastTrained: new Date() },
    hybrid: { accuracy: 0.91, lastTrained: new Date() },
  },
}

// Initialize mock data
const initializeRecommendationData = () => {
  // Mock user interactions
  const users = ['user-1', 'user-2', 'user-3']
  const items = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5']
  
  users.forEach(userId => {
    const interactions: UserInteraction[] = []
    for (let i = 0; i < Math.random() * 10 + 5; i++) {
      interactions.push({
        userId,
        itemId: items[Math.floor(Math.random() * items.length)],
        action: ['view', 'like', 'purchase', 'add_to_cart'][Math.floor(Math.random() * 4)] as any,
        weight: Math.random() * 5 + 1,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
      })
    }
    mockRecommendationData.userInteractions.set(userId, interactions)
  })

  // Mock trending items
  mockRecommendationData.trendingItems = [
    { itemId: 'item-1', score: 0.95, trend: 'rising' },
    { itemId: 'item-2', score: 0.88, trend: 'stable' },
    { itemId: 'item-3', score: 0.76, trend: 'falling' },
  ]

  // Mock popular items
  mockRecommendationData.popularItems = [
    { itemId: 'item-2', views: 1250, purchases: 85, score: 0.92 },
    { itemId: 'item-1', views: 980, purchases: 62, score: 0.87 },
    { itemId: 'item-4', views: 756, purchases: 48, score: 0.81 },
  ]
}

initializeRecommendationData()

// ML-powered recommendation engine
const recommendationEngine: RecommendationEngine = {
  // Collaborative filtering using user-item interactions
  async collaborative(userId: string, options: any = {}) {
    const userInteractions = mockRecommendationData.userInteractions.get(userId) || []
    const limit = options.limit || 10

    // Find similar users based on interaction patterns
    const similarUsers = new Map<string, number>()
    
    for (const [otherUserId, otherInteractions] of mockRecommendationData.userInteractions) {
      if (otherUserId === userId) continue
      
      // Calculate user similarity using Cosine similarity
      const similarity = calculateUserSimilarity(userInteractions, otherInteractions)
      if (similarity > 0.3) {
        similarUsers.set(otherUserId, similarity)
      }
    }

    // Get recommendations based on similar users' preferences
    const recommendations = new Map<string, number>()
    const userItemIds = new Set(userInteractions.map(i => i.itemId))

    for (const [similarUserId, similarity] of similarUsers) {
      const similarUserInteractions = mockRecommendationData.userInteractions.get(similarUserId) || []
      
      for (const interaction of similarUserInteractions) {
        if (!userItemIds.has(interaction.itemId)) {
          const score = recommendations.get(interaction.itemId) || 0
          recommendations.set(interaction.itemId, score + (interaction.weight * similarity))
        }
      }
    }

    // Sort and return top recommendations
    return Array.from(recommendations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([itemId, score]) => ({ itemId, score, type: 'collaborative' }))
  },

  // Content-based filtering using item features
  async contentBased(itemId: string, options: any = {}) {
    const limit = options.limit || 10
    
    // Mock item features comparison
    const baseItem = await getItemDetails(itemId)
    if (!baseItem) return []

    const allItems = await getAllItems()
    const similarities = allItems
      .filter(item => item.id !== itemId)
      .map(item => ({
        itemId: item.id,
        score: calculateItemSimilarity(baseItem, item),
        type: 'content-based',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return similarities
  },

  // Hybrid approach combining collaborative and content-based
  async hybrid(userId: string, itemId?: string, options: any = {}) {
    const limit = options.limit || 10
    const collaborativeWeight = options.collaborativeWeight || 0.6
    const contentWeight = options.contentWeight || 0.4

    const recommendations = new Map<string, { score: number, sources: string[] }>()

    // Get collaborative recommendations
    if (userId) {
      const collaborativeRecs = await this.collaborative(userId, { limit: limit * 2 })
      for (const rec of collaborativeRecs) {
        const existing = recommendations.get(rec.itemId) || { score: 0, sources: [] }
        existing.score += rec.score * collaborativeWeight
        existing.sources.push('collaborative')
        recommendations.set(rec.itemId, existing)
      }
    }

    // Get content-based recommendations
    if (itemId) {
      const contentRecs = await this.contentBased(itemId, { limit: limit * 2 })
      for (const rec of contentRecs) {
        const existing = recommendations.get(rec.itemId) || { score: 0, sources: [] }
        existing.score += rec.score * contentWeight
        existing.sources.push('content-based')
        recommendations.set(rec.itemId, existing)
      }
    }

    // Sort and return hybrid recommendations
    return Array.from(recommendations.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([itemId, data]) => ({
        itemId,
        score: data.score,
        type: 'hybrid',
        sources: data.sources,
      }))
  },
}

export const recommendationController = {
  // GET /api/recommendations - Get personalized recommendations
  async getRecommendations(req: AuthRequest, res: Response) {
    const {
      userId,
      itemId,
      type = 'hybrid',
      limit = 10,
      includeViewed = false,
      categories,
      priceRange,
    } = req.query as any

    const targetUserId = userId || req.user?.id

    if (!targetUserId && type === 'collaborative') {
      throw new ApiError(400, 'User ID required for collaborative filtering')
    }

    let recommendations: any[] = []

    switch (type) {
      case 'collaborative':
        recommendations = await recommendationEngine.collaborative(targetUserId, { limit })
        break
      case 'content-based':
        if (!itemId) throw new ApiError(400, 'Item ID required for content-based recommendations')
        recommendations = await recommendationEngine.contentBased(itemId, { limit })
        break
      case 'hybrid':
        recommendations = await recommendationEngine.hybrid(targetUserId, itemId, { limit })
        break
      default:
        throw new ApiError(400, 'Invalid recommendation type')
    }

    // Enhance recommendations with item details
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        const item = await getItemDetails(rec.itemId)
        return {
          ...rec,
          item,
          reason: generateRecommendationReason(rec, targetUserId, itemId),
        }
      })
    )

    res.json({
      success: true,
      data: {
        recommendations: enhancedRecommendations,
        type,
        userId: targetUserId,
        baseItem: itemId,
        metadata: {
          totalGenerated: recommendations.length,
          modelVersion: '1.0.0',
          generatedAt: new Date(),
          performance: mockRecommendationData.modelPerformance[type as keyof typeof mockRecommendationData.modelPerformance],
        },
      },
    })
  },

  // GET /api/recommendations/similar/:itemId - Get similar items
  async getSimilarItems(req: Request, res: Response) {
    const { itemId } = req.params
    const { limit = 10, includeCategory = true } = req.query as any

    const recommendations = await recommendationEngine.contentBased(itemId, { limit })
    
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        const item = await getItemDetails(rec.itemId)
        return {
          ...rec,
          item,
          similarityFactors: await calculateSimilarityFactors(itemId, rec.itemId),
        }
      })
    )

    res.json({
      success: true,
      data: {
        similar: enhancedRecommendations,
        baseItem: await getItemDetails(itemId),
        algorithm: 'content-based-similarity',
      },
    })
  },

  // GET /api/recommendations/trending - Get trending items
  async getTrendingItems(req: Request, res: Response) {
    const { limit = 20, category, period = '24h' } = req.query as any

    let trending = [...mockRecommendationData.trendingItems]

    // Filter by category if specified
    if (category) {
      trending = trending.filter(async (item) => {
        const details = await getItemDetails(item.itemId)
        return details?.category === category
      })
    }

    // Enhance with item details
    const enhancedTrending = await Promise.all(
      trending.slice(0, limit).map(async (item) => ({
        ...item,
        item: await getItemDetails(item.itemId),
        metrics: {
          viewsLast24h: Math.floor(Math.random() * 1000),
          searchAppearances: Math.floor(Math.random() * 500),
          conversionRate: (Math.random() * 0.1 + 0.02).toFixed(3),
        },
      }))
    )

    res.json({
      success: true,
      data: {
        trending: enhancedTrending,
        period,
        category,
        generatedAt: new Date(),
      },
    })
  },

  // GET /api/recommendations/popular - Get popular items
  async getPopularItems(req: Request, res: Response) {
    const { limit = 20, category, timeframe = '7d' } = req.query as any

    let popular = [...mockRecommendationData.popularItems]

    // Filter by category if specified
    if (category) {
      popular = popular.filter(async (item) => {
        const details = await getItemDetails(item.itemId)
        return details?.category === category
      })
    }

    // Enhance with item details
    const enhancedPopular = await Promise.all(
      popular.slice(0, limit).map(async (item) => ({
        ...item,
        item: await getItemDetails(item.itemId),
        ranking: popular.indexOf(item) + 1,
        metrics: {
          viewsPerDay: Math.floor(item.views / 7),
          conversionRate: (item.purchases / item.views).toFixed(3),
          engagementScore: (item.score * 100).toFixed(1),
        },
      }))
    )

    res.json({
      success: true,
      data: {
        popular: enhancedPopular,
        timeframe,
        category,
        generatedAt: new Date(),
      },
    })
  },

  // POST /api/recommendations/interaction - Track user interaction
  async trackInteraction(req: Request, res: Response) {
    const {
      userId,
      itemId,
      action,
      sessionId,
      context = {},
    } = req.body

    if (!userId || !itemId || !action) {
      throw new ApiError(400, 'userId, itemId, and action are required')
    }

    const interaction: UserInteraction = {
      userId,
      itemId,
      action,
      weight: getActionWeight(action),
      timestamp: new Date(),
      sessionId,
      context,
    }

    // Store interaction
    if (!mockRecommendationData.userInteractions.has(userId)) {
      mockRecommendationData.userInteractions.set(userId, [])
    }
    
    const userInteractions = mockRecommendationData.userInteractions.get(userId)!
    userInteractions.push(interaction)

    // Update user profile
    await updateUserProfile(userId, interaction)

    res.json({
      success: true,
      data: {
        tracked: true,
        interaction: {
          id: `interaction-${Date.now()}`,
          ...interaction,
        },
      },
      message: 'Interaction tracked successfully',
    })
  },

  // GET /api/recommendations/collaborative/:userId - Collaborative filtering
  async getCollaborativeRecommendations(req: Request, res: Response) {
    const { userId } = req.params
    const { limit = 10 } = req.query as any

    const recommendations = await recommendationEngine.collaborative(userId, { limit })
    
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => ({
        ...rec,
        item: await getItemDetails(rec.itemId),
        explanation: `Recommended because users with similar preferences also liked this`,
      }))
    )

    res.json({
      success: true,
      data: {
        recommendations: enhancedRecommendations,
        algorithm: 'collaborative-filtering',
        userId,
      },
    })
  },

  // GET /api/recommendations/content/:itemId - Content-based recommendations
  async getContentBasedRecommendations(req: Request, res: Response) {
    const { itemId } = req.params
    const { limit = 10 } = req.query as any

    const recommendations = await recommendationEngine.contentBased(itemId, { limit })
    
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => ({
        ...rec,
        item: await getItemDetails(rec.itemId),
        explanation: 'Recommended based on item features and categories',
      }))
    )

    res.json({
      success: true,
      data: {
        recommendations: enhancedRecommendations,
        algorithm: 'content-based-filtering',
        baseItem: await getItemDetails(itemId),
      },
    })
  },

  // POST /api/recommendations/feedback - Submit recommendation feedback
  async submitFeedback(req: Request, res: Response) {
    const {
      userId,
      itemId,
      recommendationType,
      rating,
      feedback,
      clicked,
      purchased,
    } = req.body

    const feedbackEntry = {
      id: `feedback-${Date.now()}`,
      userId,
      itemId,
      recommendationType,
      rating,
      feedback,
      clicked,
      purchased,
      timestamp: new Date(),
    }

    // Store feedback for model improvement
    console.log('Recommendation feedback received:', feedbackEntry)

    res.json({
      success: true,
      data: { feedbackEntry },
      message: 'Feedback submitted successfully',
    })
  },

  // GET /api/recommendations/categories/:category - Category recommendations
  async getCategoryRecommendations(req: Request, res: Response) {
    const { category } = req.params
    const { limit = 20, sortBy = 'popularity' } = req.query as any

    // Mock category-specific recommendations
    const categoryItems = mockRecommendationData.popularItems
      .filter(async (item) => {
        const details = await getItemDetails(item.itemId)
        return details?.category === category
      })
      .slice(0, limit)

    const enhancedItems = await Promise.all(
      categoryItems.map(async (item) => ({
        ...item,
        item: await getItemDetails(item.itemId),
      }))
    )

    res.json({
      success: true,
      data: {
        recommendations: enhancedItems,
        category,
        sortBy,
        generatedAt: new Date(),
      },
    })
  },

  // POST /api/recommendations/retrain - Trigger model retraining
  async triggerModelRetraining(req: AuthRequest, res: Response) {
    if (req.user?.role !== 'admin') {
      throw new ApiError(403, 'Admin access required')
    }

    const { model = 'all' } = req.body

    // Mock retraining process
    const retrainingJob = {
      id: `retrain-${Date.now()}`,
      model,
      status: 'started',
      startedAt: new Date(),
      estimatedDuration: '2-4 hours',
    }

    // Update model performance (mock)
    setTimeout(() => {
      if (model === 'all' || model === 'collaborative') {
        mockRecommendationData.modelPerformance.collaborative = {
          accuracy: 0.87,
          lastTrained: new Date(),
        }
      }
      if (model === 'all' || model === 'content-based') {
        mockRecommendationData.modelPerformance.contentBased = {
          accuracy: 0.81,
          lastTrained: new Date(),
        }
      }
      if (model === 'all' || model === 'hybrid') {
        mockRecommendationData.modelPerformance.hybrid = {
          accuracy: 0.93,
          lastTrained: new Date(),
        }
      }
    }, 1000)

    res.json({
      success: true,
      data: { retrainingJob },
      message: 'Model retraining started',
    })
  },
}

// Helper functions
function calculateUserSimilarity(user1Interactions: UserInteraction[], user2Interactions: UserInteraction[]): number {
  const user1Items = new Map(user1Interactions.map(i => [i.itemId, i.weight]))
  const user2Items = new Map(user2Interactions.map(i => [i.itemId, i.weight]))
  
  const commonItems = new Set([...user1Items.keys()].filter(item => user2Items.has(item)))
  
  if (commonItems.size === 0) return 0

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (const item of commonItems) {
    const weight1 = user1Items.get(item) || 0
    const weight2 = user2Items.get(item) || 0
    dotProduct += weight1 * weight2
    norm1 += weight1 * weight1
    norm2 += weight2 * weight2
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

function calculateItemSimilarity(item1: any, item2: any): number {
  let similarity = 0
  
  // Category similarity
  if (item1.category === item2.category) similarity += 0.4
  
  // Tag overlap
  const commonTags = item1.tags.filter((tag: string) => item2.tags.includes(tag))
  similarity += (commonTags.length / Math.max(item1.tags.length, item2.tags.length)) * 0.3
  
  // Price similarity
  const priceDiff = Math.abs(item1.price - item2.price) / Math.max(item1.price, item2.price)
  similarity += (1 - priceDiff) * 0.3
  
  return Math.min(similarity, 1)
}

function getActionWeight(action: string): number {
  const weights = {
    view: 1,
    like: 2,
    add_to_cart: 3,
    share: 2,
    purchase: 5,
  }
  return weights[action as keyof typeof weights] || 1
}

async function getItemDetails(itemId: string) {
  // Mock item lookup
  const mockItems = {
    'item-1': { id: 'item-1', title: 'Vintage Leather Jacket', category: 'clothing', tags: ['vintage', 'leather'], price: 89.99 },
    'item-2': { id: 'item-2', title: 'MacBook Pro 13"', category: 'electronics', tags: ['apple', 'laptop'], price: 1199.99 },
    'item-3': { id: 'item-3', title: 'Designer Handbag', category: 'fashion', tags: ['designer', 'handbag'], price: 450.00 },
  }
  return mockItems[itemId as keyof typeof mockItems] || null
}

async function getAllItems() {
  return [
    { id: 'item-1', title: 'Vintage Leather Jacket', category: 'clothing', tags: ['vintage', 'leather'], price: 89.99 },
    { id: 'item-2', title: 'MacBook Pro 13"', category: 'electronics', tags: ['apple', 'laptop'], price: 1199.99 },
    { id: 'item-3', title: 'Designer Handbag', category: 'fashion', tags: ['designer', 'handbag'], price: 450.00 },
  ]
}

async function calculateSimilarityFactors(itemId1: string, itemId2: string) {
  const item1 = await getItemDetails(itemId1)
  const item2 = await getItemDetails(itemId2)
  
  if (!item1 || !item2) return {}
  
  return {
    categoryMatch: item1.category === item2.category,
    tagOverlap: item1.tags.filter((tag: string) => item2.tags.includes(tag)),
    priceRange: Math.abs(item1.price - item2.price) / Math.max(item1.price, item2.price) < 0.3,
  }
}

function generateRecommendationReason(rec: any, userId?: string, itemId?: string): string {
  const reasons = [
    'Based on your recent activity',
    'Popular among similar users',
    'Matches your preferences',
    'Similar to items you\'ve viewed',
    'Trending in your area',
    'Recently added to platform',
  ]
  return reasons[Math.floor(Math.random() * reasons.length)]
}

async function updateUserProfile(userId: string, interaction: UserInteraction) {
  // Update user profile based on interaction
  let profile = mockRecommendationData.userProfiles.get(userId) || {
    preferences: {},
    categories: {},
    priceRange: { min: 0, max: Infinity },
    lastActivity: new Date(),
  }
  
  // Update preferences
  const item = await getItemDetails(interaction.itemId)
  if (item) {
    item.tags.forEach((tag: string) => {
      profile.preferences[tag] = (profile.preferences[tag] || 0) + interaction.weight
    })
    
    profile.categories[item.category] = (profile.categories[item.category] || 0) + interaction.weight
  }
  
  profile.lastActivity = interaction.timestamp
  mockRecommendationData.userProfiles.set(userId, profile)
}