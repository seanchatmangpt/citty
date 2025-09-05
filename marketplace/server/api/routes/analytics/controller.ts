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

interface AnalyticsData {
  metrics: Record<string, number>
  dimensions: Record<string, any>
  timeRange: { start: Date, end: Date }
  granularity: 'hour' | 'day' | 'week' | 'month'
}

// Mock analytics database
const mockAnalyticsData = {
  sales: generateMockSalesData(),
  users: generateMockUserData(),
  items: generateMockItemData(),
  revenue: generateMockRevenueData(),
  geographic: generateMockGeographicData(),
  realtime: generateMockRealtimeData(),
}

export const analyticsController = {
  // GET /api/analytics/overview - Analytics overview
  async getOverview(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role
    const { period = '30d' } = req.query as any

    const overview = {
      summary: {
        totalSales: userRole === 'admin' ? 45680 : getUserSalesTotal(userId),
        totalRevenue: userRole === 'admin' ? 2840000 : getUserRevenue(userId),
        activeUsers: userRole === 'admin' ? 12540 : null,
        totalItems: userRole === 'admin' ? 8920 : getUserItemCount(userId),
        conversionRate: userRole === 'admin' ? 3.4 : getUserConversionRate(userId),
        avgOrderValue: userRole === 'admin' ? 127.50 : getUserAvgOrderValue(userId),
      },
      trends: {
        salesGrowth: 12.5,
        revenueGrowth: 18.3,
        userGrowth: userRole === 'admin' ? 8.7 : null,
        itemGrowth: 22.1,
      },
      topCategories: [
        { name: 'Electronics', sales: 15420, revenue: 892000 },
        { name: 'Fashion', sales: 12380, revenue: 654000 },
        { name: 'Home & Garden', sales: 8920, revenue: 445000 },
        { name: 'Sports', sales: 6210, revenue: 312000 },
        { name: 'Books', sales: 4680, revenue: 156000 },
      ],
      recentActivity: generateRecentActivity(userRole, userId),
      alerts: generateAnalyticsAlerts(userRole, userId),
    }

    res.json({
      success: true,
      data: { overview, period },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/sales - Sales analytics
  async getSalesAnalytics(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role
    const {
      metric = 'sales',
      period = 'day',
      start,
      end,
      groupBy,
      filters = {},
    } = req.query as any

    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end ? new Date(end) : new Date()

    const salesData = mockAnalyticsData.sales
    let filteredData = userRole === 'admin' ? salesData : salesData.filter(s => s.sellerId === userId)

    // Apply filters
    if (filters.category) {
      filteredData = filteredData.filter(s => s.category === filters.category)
    }

    const analytics = {
      summary: {
        totalSales: filteredData.reduce((sum, s) => sum + s.quantity, 0),
        totalRevenue: filteredData.reduce((sum, s) => sum + s.amount, 0),
        avgOrderValue: filteredData.length > 0 
          ? filteredData.reduce((sum, s) => sum + s.amount, 0) / filteredData.length 
          : 0,
        uniqueCustomers: new Set(filteredData.map(s => s.buyerId)).size,
      },
      timeSeries: generateTimeSeries(filteredData, period, startDate, endDate),
      breakdown: groupBy ? generateBreakdown(filteredData, groupBy) : null,
      topPerformers: getTopPerformers(filteredData, 'items'),
      metrics: {
        conversionRate: calculateConversionRate(filteredData),
        repeatCustomerRate: calculateRepeatCustomerRate(filteredData),
        avgTimeToSale: calculateAvgTimeToSale(filteredData),
      },
    }

    res.json({
      success: true,
      data: { analytics, timeRange: { start: startDate, end: endDate } },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/users - User analytics
  async getUserAnalytics(req: AuthRequest, res: Response) {
    const {
      metric = 'users',
      period = 'day',
      start,
      end,
      groupBy,
    } = req.query as any

    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end ? new Date(end) : new Date()

    const userData = mockAnalyticsData.users

    const analytics = {
      summary: {
        totalUsers: userData.length,
        activeUsers: userData.filter(u => u.lastActive > startDate).length,
        newUsers: userData.filter(u => u.registeredAt > startDate).length,
        retainedUsers: userData.filter(u => u.isRetained).length,
      },
      userGrowth: generateTimeSeries(userData, period, startDate, endDate, 'registrations'),
      activityMetrics: {
        avgSessionDuration: 18.5, // minutes
        avgPageViews: 12.3,
        bounceRate: 32.1, // percentage
        returnVisitorRate: 45.8, // percentage
      },
      demographicsBreakdown: {
        ageGroups: [
          { group: '18-24', count: 2150, percentage: 17.1 },
          { group: '25-34', count: 4280, percentage: 34.1 },
          { group: '35-44', count: 3420, percentage: 27.3 },
          { group: '45-54', count: 1890, percentage: 15.1 },
          { group: '55+', count: 800, percentage: 6.4 },
        ],
        genderDistribution: [
          { gender: 'Female', count: 6720, percentage: 53.6 },
          { gender: 'Male', count: 5580, percentage: 44.5 },
          { gender: 'Other', count: 240, percentage: 1.9 },
        ],
      },
      cohortAnalysis: generateCohortData(userData),
    }

    res.json({
      success: true,
      data: { analytics, timeRange: { start: startDate, end: endDate } },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/items - Item analytics
  async getItemAnalytics(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role
    const {
      metric = 'views',
      period = 'day',
      start,
      end,
      groupBy = 'category',
    } = req.query as any

    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end ? new Date(end) : new Date()

    const itemData = mockAnalyticsData.items
    let filteredData = userRole === 'admin' ? itemData : itemData.filter(i => i.sellerId === userId)

    const analytics = {
      summary: {
        totalItems: filteredData.length,
        activeListings: filteredData.filter(i => i.status === 'active').length,
        totalViews: filteredData.reduce((sum, i) => sum + i.views, 0),
        totalSales: filteredData.reduce((sum, i) => sum + i.sales, 0),
        avgViewsPerItem: filteredData.length > 0 
          ? filteredData.reduce((sum, i) => sum + i.views, 0) / filteredData.length 
          : 0,
      },
      performance: {
        topViewedItems: filteredData
          .sort((a, b) => b.views - a.views)
          .slice(0, 10)
          .map(i => ({
            id: i.id,
            title: i.title,
            views: i.views,
            sales: i.sales,
            conversionRate: ((i.sales / Math.max(i.views, 1)) * 100).toFixed(2),
          })),
        topSellingItems: filteredData
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 10)
          .map(i => ({
            id: i.id,
            title: i.title,
            sales: i.sales,
            revenue: i.revenue,
            views: i.views,
          })),
      },
      categoryBreakdown: generateBreakdown(filteredData, 'category'),
      priceAnalysis: {
        avgPrice: filteredData.length > 0 
          ? filteredData.reduce((sum, i) => sum + i.price, 0) / filteredData.length 
          : 0,
        priceRanges: [
          { range: '$0-$50', count: filteredData.filter(i => i.price <= 50).length },
          { range: '$51-$100', count: filteredData.filter(i => i.price > 50 && i.price <= 100).length },
          { range: '$101-$500', count: filteredData.filter(i => i.price > 100 && i.price <= 500).length },
          { range: '$500+', count: filteredData.filter(i => i.price > 500).length },
        ],
      },
      qualityMetrics: {
        avgRating: 4.2,
        reviewCount: 8540,
        returnRate: 2.1, // percentage
        complaintRate: 0.8, // percentage
      },
    }

    res.json({
      success: true,
      data: { analytics, timeRange: { start: startDate, end: endDate } },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/revenue - Revenue analytics
  async getRevenueAnalytics(req: AuthRequest, res: Response) {
    const {
      metric = 'revenue',
      period = 'day',
      start,
      end,
      groupBy,
    } = req.query as any

    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = end ? new Date(end) : new Date()

    const revenueData = mockAnalyticsData.revenue

    const analytics = {
      summary: {
        totalRevenue: revenueData.reduce((sum, r) => sum + r.amount, 0),
        platformFees: revenueData.reduce((sum, r) => sum + r.platformFee, 0),
        paymentFees: revenueData.reduce((sum, r) => sum + r.paymentFee, 0),
        netRevenue: revenueData.reduce((sum, r) => sum + r.netAmount, 0),
        avgTransactionSize: revenueData.length > 0 
          ? revenueData.reduce((sum, r) => sum + r.amount, 0) / revenueData.length 
          : 0,
      },
      revenueStreams: [
        {
          name: 'Platform Fees',
          amount: revenueData.reduce((sum, r) => sum + r.platformFee, 0),
          percentage: 15.2,
        },
        {
          name: 'Payment Processing Fees',
          amount: revenueData.reduce((sum, r) => sum + r.paymentFee, 0),
          percentage: 8.7,
        },
        {
          name: 'Subscription Fees',
          amount: 45000,
          percentage: 12.1,
        },
        {
          name: 'Advertisement Revenue',
          amount: 28000,
          percentage: 7.6,
        },
      ],
      timeSeries: generateTimeSeries(revenueData, period, startDate, endDate, 'revenue'),
      profitability: {
        grossMargin: 68.4, // percentage
        operatingMargin: 22.1, // percentage
        netMargin: 18.7, // percentage
      },
      forecasting: generateRevenueForecast(revenueData),
    }

    res.json({
      success: true,
      data: { analytics, timeRange: { start: startDate, end: endDate } },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/conversion - Conversion analytics
  async getConversionAnalytics(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role

    const analytics = {
      overallConversion: {
        visitorsToSignups: 12.4, // percentage
        signupsToFirstPurchase: 34.7, // percentage
        viewsToInquiries: 8.9, // percentage
        inquiriesToSales: 28.5, // percentage
        overallConversionRate: 3.1, // percentage
      },
      funnelStages: [
        { stage: 'Visit', users: 100000, conversionRate: 100 },
        { stage: 'Browse Items', users: 78000, conversionRate: 78 },
        { stage: 'View Item Details', users: 45000, conversionRate: 45 },
        { stage: 'Add to Cart', users: 12000, conversionRate: 12 },
        { stage: 'Checkout', users: 8500, conversionRate: 8.5 },
        { stage: 'Purchase Complete', users: 6200, conversionRate: 6.2 },
      ],
      dropoffAnalysis: {
        browseToView: 42.3, // percentage dropoff
        viewToCart: 73.3, // percentage dropoff
        cartToCheckout: 29.2, // percentage dropoff
        checkoutToComplete: 27.1, // percentage dropoff
      },
      conversionByCategory: [
        { category: 'Electronics', rate: 4.2 },
        { category: 'Fashion', rate: 3.8 },
        { category: 'Home & Garden', rate: 2.9 },
        { category: 'Sports', rate: 3.5 },
        { category: 'Books', rate: 5.1 },
      ],
      optimizationOpportunities: [
        {
          area: 'Cart Abandonment',
          impact: 'High',
          description: 'Reduce 29% cart abandonment rate',
          recommendation: 'Implement cart recovery emails and simplified checkout',
        },
        {
          area: 'Item Page Optimization',
          impact: 'Medium',
          description: 'Increase view-to-cart conversion from 27%',
          recommendation: 'Improve product images and descriptions',
        },
      ],
    }

    res.json({
      success: true,
      data: { analytics },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/geographic - Geographic analytics
  async getGeographicAnalytics(req: AuthRequest, res: Response) {
    const geographicData = mockAnalyticsData.geographic

    const analytics = {
      summary: {
        totalCountries: geographicData.countries.length,
        totalStates: geographicData.states.length,
        totalCities: geographicData.cities.length,
      },
      countryDistribution: geographicData.countries
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 20),
      stateDistribution: geographicData.states
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10),
      cityDistribution: geographicData.cities
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 15),
      regionalPerformance: {
        northAmerica: { sales: 28420, revenue: 1420000, growth: 12.4 },
        europe: { sales: 15680, revenue: 890000, growth: 18.7 },
        asia: { sales: 8930, revenue: 445000, growth: 34.2 },
        other: { sales: 2140, revenue: 125000, growth: 8.1 },
      },
      shippingAnalytics: {
        avgShippingTime: {
          domestic: 3.2, // days
          international: 12.8, // days
        },
        shippingCosts: {
          avgDomestic: 8.50,
          avgInternational: 24.75,
        },
      },
    }

    res.json({
      success: true,
      data: { analytics },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/trends - Trend analytics
  async getTrendAnalytics(req: AuthRequest, res: Response) {
    const {
      metric = 'sales',
      period = 'week',
      lookback = 12, // periods to look back
    } = req.query as any

    const analytics = {
      trendAnalysis: {
        direction: 'upward',
        strength: 'strong',
        confidence: 0.87,
        r2Score: 0.78, // correlation coefficient
      },
      seasonality: {
        pattern: 'seasonal',
        peakMonths: ['November', 'December', 'January'],
        lowMonths: ['February', 'March'],
        seasonalityIndex: 0.23,
      },
      cyclicalPatterns: {
        weeklyPattern: {
          monday: 0.85,
          tuesday: 0.92,
          wednesday: 1.05,
          thursday: 1.12,
          friday: 1.25,
          saturday: 1.45,
          sunday: 1.08,
        },
        hourlyPattern: generateHourlyPattern(),
      },
      anomalies: [
        {
          date: '2024-01-15',
          metric: 'sales',
          expected: 450,
          actual: 1200,
          deviation: 166.7,
          reason: 'Flash sale event',
        },
      ],
      forecasting: {
        nextPeriod: {
          predicted: 5680,
          confidenceInterval: [5200, 6160],
          confidence: 0.85,
        },
        trendComponents: {
          baseline: 4800,
          trend: 120,
          seasonal: 280,
          noise: 480,
        },
      },
    }

    res.json({
      success: true,
      data: { analytics, lookbackPeriods: lookback },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/cohort - Cohort analysis
  async getCohortAnalysis(req: AuthRequest, res: Response) {
    const cohortData = generateCohortData(mockAnalyticsData.users)

    const analytics = {
      cohortTable: cohortData,
      retentionMetrics: {
        day1Retention: 68.4,
        day7Retention: 42.1,
        day30Retention: 28.7,
        day90Retention: 18.9,
        day180Retention: 12.3,
      },
      lifetimeValue: {
        avgLTV: 285.60,
        ltv30: 127.80,
        ltv90: 198.40,
        ltv180: 245.20,
        ltv365: 312.90,
      },
      cohortInsights: [
        {
          cohort: '2024-01',
          size: 1250,
          avgLTV: 298.50,
          performance: 'above_average',
        },
        {
          cohort: '2023-12',
          size: 1890,
          avgLTV: 345.20,
          performance: 'excellent',
        },
      ],
    }

    res.json({
      success: true,
      data: { analytics },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/funnel - Funnel analysis
  async getFunnelAnalysis(req: AuthRequest, res: Response) {
    const {
      funnelType = 'purchase',
      period = '30d',
    } = req.query as any

    const funnels = {
      purchase: [
        { step: 'Homepage Visit', users: 100000, rate: 100, dropoff: 0 },
        { step: 'Category Browse', users: 72000, rate: 72, dropoff: 28 },
        { step: 'Item View', users: 45000, rate: 45, dropoff: 37.5 },
        { step: 'Add to Cart', users: 12000, rate: 12, dropoff: 73.3 },
        { step: 'Checkout Start', users: 8500, rate: 8.5, dropoff: 29.2 },
        { step: 'Payment', users: 6800, rate: 6.8, dropoff: 20 },
        { step: 'Order Complete', users: 6200, rate: 6.2, dropoff: 8.8 },
      ],
      seller: [
        { step: 'Visit Sell Page', users: 10000, rate: 100, dropoff: 0 },
        { step: 'Create Account', users: 3500, rate: 35, dropoff: 65 },
        { step: 'List First Item', users: 2100, rate: 21, dropoff: 40 },
        { step: 'Item Approved', users: 1850, rate: 18.5, dropoff: 11.9 },
        { step: 'First Sale', users: 640, rate: 6.4, dropoff: 65.4 },
      ],
    }

    const selectedFunnel = funnels[funnelType as keyof typeof funnels] || funnels.purchase

    const analytics = {
      funnel: selectedFunnel,
      overallConversionRate: selectedFunnel[selectedFunnel.length - 1].rate,
      biggestDropoff: {
        step: 'Item View to Cart',
        rate: 73.3,
        users: 33000,
      },
      improvements: [
        {
          step: 'Add to Cart',
          currentRate: 26.7,
          potentialRate: 35.0,
          impact: 3300, // additional users
        },
        {
          step: 'Checkout Complete',
          currentRate: 72.9,
          potentialRate: 85.0,
          impact: 1020, // additional users
        },
      ],
    }

    res.json({
      success: true,
      data: { analytics, funnelType, period },
      generatedAt: new Date(),
    })
  },

  // GET /api/analytics/realtime - Real-time analytics
  async getRealtimeAnalytics(req: AuthRequest, res: Response) {
    const realtime = mockAnalyticsData.realtime

    const analytics = {
      current: {
        activeUsers: realtime.activeUsers,
        currentSales: realtime.currentSales,
        revenueToday: realtime.revenueToday,
        newSignups: realtime.newSignups,
        itemsListed: realtime.itemsListed,
      },
      activity: {
        lastHour: {
          pageViews: 4580,
          uniqueVisitors: 1240,
          sales: 28,
          revenue: 3450.00,
        },
        last24Hours: {
          pageViews: 86420,
          uniqueVisitors: 12450,
          sales: 340,
          revenue: 45680.00,
        },
      },
      topPages: [
        { page: '/items/electronics', views: 1250, uniqueViews: 890 },
        { page: '/items/fashion', views: 980, uniqueViews: 720 },
        { page: '/', views: 850, uniqueViews: 680 },
        { page: '/search', views: 720, uniqueViews: 580 },
      ],
      liveEvents: generateLiveEvents(),
      alerts: [
        {
          type: 'spike',
          message: 'Unusual traffic spike detected',
          severity: 'medium',
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        },
      ],
    }

    res.json({
      success: true,
      data: { analytics },
      generatedAt: new Date(),
    })
  },

  // POST /api/analytics/custom - Custom analytics query
  async createCustomQuery(req: AuthRequest, res: Response) {
    const {
      query,
      dimensions,
      metrics,
      filters,
      timeRange,
    } = req.body

    // Mock custom query processing
    const results = {
      queryId: `custom-${Date.now()}`,
      sql: query,
      results: [
        { dimension: 'Category', metric: 'Sales', value: 1250 },
        { dimension: 'Electronics', metric: 'Revenue', value: 45680 },
      ],
      executionTime: '0.234s',
      rowCount: 2,
    }

    res.json({
      success: true,
      data: { results },
      message: 'Custom query executed successfully',
    })
  },

  // GET /api/analytics/export - Export analytics
  async exportAnalytics(req: AuthRequest, res: Response) {
    const {
      type = 'sales',
      format = 'csv',
      period = '30d',
    } = req.query as any

    // Mock export generation
    const exportData = {
      exportId: `export-${Date.now()}`,
      type,
      format,
      period,
      status: 'processing',
      estimatedCompletion: new Date(Date.now() + 120000), // 2 minutes
      downloadUrl: null, // Will be provided when ready
    }

    // Simulate processing
    setTimeout(() => {
      exportData.status = 'completed'
      exportData.downloadUrl = `/downloads/analytics-${exportData.exportId}.${format}`
    }, 3000)

    res.json({
      success: true,
      data: { export: exportData },
      message: 'Export started successfully',
    })
  },
}

// Helper functions for generating mock data
function generateMockSalesData() {
  const sales = []
  for (let i = 0; i < 1000; i++) {
    sales.push({
      id: `sale-${i}`,
      itemId: `item-${Math.floor(Math.random() * 100)}`,
      sellerId: `seller-${Math.floor(Math.random() * 50)}`,
      buyerId: `buyer-${Math.floor(Math.random() * 200)}`,
      amount: Math.floor(Math.random() * 500) + 10,
      quantity: Math.floor(Math.random() * 3) + 1,
      category: ['electronics', 'fashion', 'home', 'sports', 'books'][Math.floor(Math.random() * 5)],
      date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    })
  }
  return sales
}

function generateMockUserData() {
  const users = []
  for (let i = 0; i < 500; i++) {
    const registeredAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
    users.push({
      id: `user-${i}`,
      registeredAt,
      lastActive: new Date(registeredAt.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000),
      isRetained: Math.random() > 0.6,
      totalPurchases: Math.floor(Math.random() * 10),
      totalSpent: Math.floor(Math.random() * 1000),
    })
  }
  return users
}

function generateMockItemData() {
  const items = []
  for (let i = 0; i < 300; i++) {
    const views = Math.floor(Math.random() * 1000) + 10
    const sales = Math.floor(views * (Math.random() * 0.1 + 0.01))
    items.push({
      id: `item-${i}`,
      title: `Item ${i}`,
      sellerId: `seller-${Math.floor(Math.random() * 50)}`,
      category: ['electronics', 'fashion', 'home', 'sports', 'books'][Math.floor(Math.random() * 5)],
      price: Math.floor(Math.random() * 500) + 10,
      views,
      sales,
      revenue: sales * (Math.floor(Math.random() * 500) + 10),
      status: Math.random() > 0.1 ? 'active' : 'inactive',
    })
  }
  return items
}

function generateMockRevenueData() {
  const revenue = []
  for (let i = 0; i < 500; i++) {
    const amount = Math.floor(Math.random() * 1000) + 50
    const platformFee = amount * 0.05
    const paymentFee = amount * 0.03
    revenue.push({
      id: `rev-${i}`,
      amount,
      platformFee,
      paymentFee,
      netAmount: amount - platformFee - paymentFee,
      date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    })
  }
  return revenue
}

function generateMockGeographicData() {
  return {
    countries: [
      { name: 'United States', sales: 28420, revenue: 1420000, users: 8540 },
      { name: 'Canada', sales: 4680, revenue: 280000, users: 1240 },
      { name: 'United Kingdom', sales: 3920, revenue: 220000, users: 980 },
      { name: 'Germany', sales: 3150, revenue: 185000, users: 720 },
      { name: 'Australia', sales: 2840, revenue: 165000, users: 580 },
    ],
    states: [
      { name: 'California', sales: 8540, revenue: 425000 },
      { name: 'New York', sales: 6280, revenue: 315000 },
      { name: 'Texas', sales: 4920, revenue: 245000 },
      { name: 'Florida', sales: 3680, revenue: 185000 },
      { name: 'Illinois', sales: 2840, revenue: 142000 },
    ],
    cities: [
      { name: 'New York', sales: 4280, revenue: 214000 },
      { name: 'Los Angeles', sales: 3920, revenue: 196000 },
      { name: 'Chicago', sales: 2840, revenue: 142000 },
      { name: 'Houston', sales: 2150, revenue: 108000 },
      { name: 'Phoenix', sales: 1680, revenue: 84000 },
    ],
  }
}

function generateMockRealtimeData() {
  return {
    activeUsers: Math.floor(Math.random() * 500) + 100,
    currentSales: Math.floor(Math.random() * 50) + 10,
    revenueToday: Math.floor(Math.random() * 10000) + 5000,
    newSignups: Math.floor(Math.random() * 20) + 5,
    itemsListed: Math.floor(Math.random() * 30) + 10,
  }
}

function generateTimeSeries(data: any[], period: string, start: Date, end: Date, metric = 'count') {
  // Mock time series generation
  const series = []
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  
  for (let i = 0; i <= daysDiff; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    series.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 100) + 50,
    })
  }
  
  return series
}

function generateBreakdown(data: any[], groupBy: string) {
  const breakdown = new Map()
  
  for (const item of data) {
    const key = item[groupBy] || 'Unknown'
    if (!breakdown.has(key)) {
      breakdown.set(key, { name: key, count: 0, value: 0 })
    }
    const group = breakdown.get(key)
    group.count++
    group.value += item.amount || 1
  }
  
  return Array.from(breakdown.values()).sort((a, b) => b.value - a.value)
}

function getTopPerformers(data: any[], type: 'items' | 'sellers' | 'buyers') {
  // Mock top performers
  return [
    { id: 'top-1', name: 'Top Performer 1', value: 12500 },
    { id: 'top-2', name: 'Top Performer 2', value: 9800 },
    { id: 'top-3', name: 'Top Performer 3', value: 7600 },
  ]
}

function calculateConversionRate(data: any[]) {
  return Math.random() * 5 + 2 // 2-7%
}

function calculateRepeatCustomerRate(data: any[]) {
  return Math.random() * 30 + 20 // 20-50%
}

function calculateAvgTimeToSale(data: any[]) {
  return Math.random() * 10 + 2 // 2-12 days
}

function getUserSalesTotal(userId: string) {
  return Math.floor(Math.random() * 1000) + 100
}

function getUserRevenue(userId: string) {
  return Math.floor(Math.random() * 100000) + 10000
}

function getUserItemCount(userId: string) {
  return Math.floor(Math.random() * 50) + 10
}

function getUserConversionRate(userId: string) {
  return Math.random() * 5 + 2
}

function getUserAvgOrderValue(userId: string) {
  return Math.floor(Math.random() * 200) + 50
}

function generateRecentActivity(role: string, userId: string) {
  return [
    { type: 'sale', description: 'New sale completed', timestamp: new Date(Date.now() - 300000) },
    { type: 'listing', description: 'New item listed', timestamp: new Date(Date.now() - 600000) },
    { type: 'user', description: 'New user registered', timestamp: new Date(Date.now() - 900000) },
  ]
}

function generateAnalyticsAlerts(role: string, userId: string) {
  return [
    { type: 'warning', message: 'Sales down 15% this week', severity: 'medium' },
    { type: 'info', message: 'New high-performing category detected', severity: 'low' },
  ]
}

function generateCohortData(users: any[]) {
  // Mock cohort data
  const cohorts = []
  const months = ['2024-01', '2024-02', '2024-03', '2024-04']
  
  for (const month of months) {
    cohorts.push({
      cohort: month,
      size: Math.floor(Math.random() * 1000) + 500,
      month0: 100,
      month1: Math.floor(Math.random() * 30) + 50,
      month2: Math.floor(Math.random() * 20) + 30,
      month3: Math.floor(Math.random() * 15) + 20,
    })
  }
  
  return cohorts
}

function generateRevenueForecast(data: any[]) {
  return {
    nextMonth: {
      predicted: 125000,
      confidence: 0.82,
      range: [110000, 140000],
    },
    nextQuarter: {
      predicted: 385000,
      confidence: 0.75,
      range: [320000, 450000],
    },
  }
}

function generateHourlyPattern() {
  const pattern: Record<string, number> = {}
  for (let hour = 0; hour < 24; hour++) {
    pattern[hour.toString().padStart(2, '0')] = Math.random() * 2 + 0.5
  }
  return pattern
}

function generateLiveEvents() {
  return [
    { type: 'sale', message: 'MacBook Pro sold for $1,200', timestamp: new Date(Date.now() - 30000) },
    { type: 'listing', message: 'New vintage watch listed', timestamp: new Date(Date.now() - 60000) },
    { type: 'signup', message: 'New user from California', timestamp: new Date(Date.now() - 90000) },
  ]
}