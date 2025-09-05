/**
 * Analytics Dashboard - Production Polish Feature
 * Comprehensive user behavior tracking and business intelligence
 */

import { ref, reactive, computed, watch } from 'vue';

export interface UserBehaviorEvent {
  id: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  type: 'page_view' | 'click' | 'scroll' | 'search' | 'purchase' | 'interaction' | 'error';
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata: Record<string, any>;
  context: {
    page: string;
    referrer?: string;
    userAgent: string;
    viewport: { width: number; height: number };
    device: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
}

export interface ConversionFunnel {
  name: string;
  steps: {
    name: string;
    selector: string;
    required: boolean;
  }[];
  timeWindow: number; // minutes
}

export interface Metric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  format: 'number' | 'currency' | 'percentage' | 'duration';
  description?: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'funnel' | 'heatmap';
  data: Array<{
    label: string;
    value: number;
    metadata?: Record<string, any>;
  }>;
  timeRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  widgets: AnalyticsWidget[];
  filters: DashboardFilter[];
  refreshInterval?: number;
  access: {
    roles: string[];
    users: string[];
  };
}

export interface AnalyticsWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'heatmap';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number; w: number; h: number };
  config: {
    dataSource: string;
    metric?: string;
    dimension?: string;
    filters?: Record<string, any>;
    timeRange?: string;
    refreshRate?: number;
  };
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'date' | 'select' | 'multiselect' | 'text';
  options?: { value: any; label: string }[];
  default?: any;
}

export interface CohortAnalysis {
  cohortType: 'registration' | 'first_purchase' | 'first_visit';
  periods: Array<{
    period: string;
    cohorts: Array<{
      cohortDate: string;
      cohortSize: number;
      retentionRates: number[];
    }>;
  }>;
}

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  criteria: {
    demographics?: Record<string, any>;
    behavior?: Record<string, any>;
    transactions?: Record<string, any>;
    engagement?: Record<string, any>;
  };
  size: number;
  performance: {
    conversionRate: number;
    averageOrderValue: number;
    lifetimeValue: number;
    churnRate: number;
  };
}

export class AnalyticsEngine {
  private events: UserBehaviorEvent[] = [];
  private metrics: Map<string, Metric> = new Map();
  private dashboards: Map<string, AnalyticsDashboard> = new Map();
  private funnels: Map<string, ConversionFunnel> = new Map();
  private segments: Map<string, UserSegment> = new Map();
  private sessionStorage: Map<string, string> = new Map();
  private realTimeListeners: Set<(event: UserBehaviorEvent) => void> = new Set();

  constructor() {
    this.setupDefaultMetrics();
    this.setupDefaultFunnels();
    this.setupDefaultSegments();
    this.startRealTimeProcessing();
  }

  /**
   * Track user behavior event
   */
  track(event: Omit<UserBehaviorEvent, 'id' | 'timestamp' | 'context'>): void {
    const fullEvent: UserBehaviorEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
      context: this.getEventContext()
    };

    this.events.push(fullEvent);
    this.processEventRealTime(fullEvent);
    this.notifyRealTimeListeners(fullEvent);

    // Limit memory usage by keeping only recent events
    if (this.events.length > 10000) {
      this.events.splice(0, 1000);
    }
  }

  /**
   * Track page view with automatic context
   */
  trackPageView(page: string, metadata: Record<string, any> = {}): void {
    this.track({
      sessionId: this.getSessionId(),
      type: 'page_view',
      category: 'navigation',
      action: 'page_view',
      label: page,
      metadata: {
        ...metadata,
        previousPage: this.getPreviousPage()
      }
    });

    this.setPreviousPage(page);
  }

  /**
   * Track user interaction
   */
  trackInteraction(element: string, action: string, metadata: Record<string, any> = {}): void {
    this.track({
      sessionId: this.getSessionId(),
      type: 'interaction',
      category: 'ui',
      action,
      label: element,
      metadata
    });
  }

  /**
   * Track search behavior
   */
  trackSearch(query: string, resultsCount: number, filters: Record<string, any> = {}): void {
    this.track({
      sessionId: this.getSessionId(),
      type: 'search',
      category: 'search',
      action: 'search_performed',
      label: query,
      value: resultsCount,
      metadata: { filters }
    });
  }

  /**
   * Track conversion events
   */
  trackConversion(type: string, value: number, metadata: Record<string, any> = {}): void {
    this.track({
      sessionId: this.getSessionId(),
      type: 'purchase',
      category: 'conversion',
      action: type,
      value,
      metadata
    });
  }

  /**
   * Track errors and exceptions
   */
  trackError(error: Error, context: Record<string, any> = {}): void {
    this.track({
      sessionId: this.getSessionId(),
      type: 'error',
      category: 'error',
      action: 'javascript_error',
      label: error.message,
      metadata: {
        stack: error.stack,
        ...context
      }
    });
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): {
    activeUsers: number;
    pageViews: number;
    conversions: number;
    errorRate: number;
    averageSessionDuration: number;
    topPages: { page: string; views: number }[];
    recentEvents: UserBehaviorEvent[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(e => e.timestamp >= oneHourAgo);
    const activeSessions = new Set(recentEvents.map(e => e.sessionId));
    
    const pageViews = recentEvents.filter(e => e.type === 'page_view').length;
    const conversions = recentEvents.filter(e => e.type === 'purchase').length;
    const errors = recentEvents.filter(e => e.type === 'error').length;
    
    // Calculate error rate
    const totalEvents = recentEvents.length;
    const errorRate = totalEvents > 0 ? (errors / totalEvents) * 100 : 0;

    // Calculate average session duration
    const sessionDurations = this.calculateSessionDurations(recentEvents);
    const averageSessionDuration = sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length || 0;

    // Get top pages
    const pageCounts = new Map<string, number>();
    recentEvents.filter(e => e.type === 'page_view').forEach(e => {
      const page = e.context.page;
      pageCounts.set(page, (pageCounts.get(page) || 0) + 1);
    });

    const topPages = Array.from(pageCounts.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return {
      activeUsers: activeSessions.size,
      pageViews,
      conversions,
      errorRate,
      averageSessionDuration,
      topPages,
      recentEvents: recentEvents.slice(-50)
    };
  }

  /**
   * Generate conversion funnel analysis
   */
  analyzeFunnel(funnelId: string, timeRange: { start: Date; end: Date }): {
    funnel: ConversionFunnel;
    analysis: {
      totalUsers: number;
      steps: Array<{
        name: string;
        users: number;
        conversionRate: number;
        dropoffRate: number;
      }>;
      overallConversion: number;
    };
  } {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) {
      throw new Error(`Funnel ${funnelId} not found`);
    }

    const events = this.events.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    // Group events by user session
    const userJourneys = new Map<string, UserBehaviorEvent[]>();
    events.forEach(event => {
      const key = event.userId || event.sessionId;
      if (!userJourneys.has(key)) {
        userJourneys.set(key, []);
      }
      userJourneys.get(key)!.push(event);
    });

    // Analyze funnel progression
    const stepAnalysis = funnel.steps.map((step, index) => {
      let usersAtStep = 0;
      
      userJourneys.forEach(journey => {
        const hasCompletedStep = this.hasCompletedFunnelStep(journey, step, funnel.timeWindow);
        if (hasCompletedStep) {
          // Check if user completed all previous steps
          const completedAllPrevious = funnel.steps.slice(0, index).every(prevStep => 
            this.hasCompletedFunnelStep(journey, prevStep, funnel.timeWindow)
          );
          
          if (completedAllPrevious) {
            usersAtStep++;
          }
        }
      });

      const conversionRate = index === 0 ? 100 : (usersAtStep / (stepAnalysis[0]?.users || 1)) * 100;
      const dropoffRate = index === 0 ? 0 : ((stepAnalysis[index - 1]?.users || 0) - usersAtStep) / (stepAnalysis[index - 1]?.users || 1) * 100;

      return {
        name: step.name,
        users: usersAtStep,
        conversionRate,
        dropoffRate
      };
    });

    const totalUsers = userJourneys.size;
    const finalStepUsers = stepAnalysis[stepAnalysis.length - 1]?.users || 0;
    const overallConversion = totalUsers > 0 ? (finalStepUsers / totalUsers) * 100 : 0;

    return {
      funnel,
      analysis: {
        totalUsers,
        steps: stepAnalysis,
        overallConversion
      }
    };
  }

  /**
   * Perform cohort analysis
   */
  analyzeCohorts(
    cohortType: CohortAnalysis['cohortType'],
    periods: number = 12
  ): CohortAnalysis {
    const cohorts = new Map<string, { date: string; users: Set<string> }>();
    
    // Group users by cohort date
    this.events.forEach(event => {
      if (this.isCohortEvent(event, cohortType)) {
        const cohortDate = this.getCohortDate(event.timestamp);
        const userId = event.userId || event.sessionId;
        
        if (!cohorts.has(cohortDate)) {
          cohorts.set(cohortDate, { date: cohortDate, users: new Set() });
        }
        
        cohorts.get(cohortDate)!.users.add(userId);
      }
    });

    // Calculate retention rates for each cohort
    const cohortAnalysis: CohortAnalysis = {
      cohortType,
      periods: []
    };

    Array.from(cohorts.entries()).forEach(([cohortDate, cohort]) => {
      const retentionRates: number[] = [];
      
      for (let period = 0; period < periods; period++) {
        const periodStart = new Date(cohort.date);
        periodStart.setMonth(periodStart.getMonth() + period);
        
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        
        const activeUsersInPeriod = new Set<string>();
        
        this.events.filter(e => 
          e.timestamp >= periodStart && 
          e.timestamp < periodEnd &&
          cohort.users.has(e.userId || e.sessionId)
        ).forEach(event => {
          activeUsersInPeriod.add(event.userId || event.sessionId);
        });
        
        const retentionRate = (activeUsersInPeriod.size / cohort.users.size) * 100;
        retentionRates.push(retentionRate);
      }
      
      cohortAnalysis.periods.push({
        period: cohortDate,
        cohorts: [{
          cohortDate,
          cohortSize: cohort.users.size,
          retentionRates
        }]
      });
    });

    return cohortAnalysis;
  }

  /**
   * Get user segmentation analysis
   */
  getSegmentAnalysis(): UserSegment[] {
    return Array.from(this.segments.values()).map(segment => {
      const segmentUsers = this.getUsersInSegment(segment);
      const performance = this.calculateSegmentPerformance(segmentUsers);
      
      return {
        ...segment,
        size: segmentUsers.length,
        performance
      };
    });
  }

  /**
   * Create custom analytics dashboard
   */
  createDashboard(dashboard: Omit<AnalyticsDashboard, 'id'>): AnalyticsDashboard {
    const fullDashboard: AnalyticsDashboard = {
      ...dashboard,
      id: this.generateId()
    };
    
    this.dashboards.set(fullDashboard.id, fullDashboard);
    return fullDashboard;
  }

  /**
   * Get dashboard data
   */
  getDashboardData(dashboardId: string, filters: Record<string, any> = {}): {
    dashboard: AnalyticsDashboard;
    data: Record<string, ChartData | Metric>;
  } {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const data: Record<string, ChartData | Metric> = {};
    
    dashboard.widgets.forEach(widget => {
      data[widget.id] = this.getWidgetData(widget, filters);
    });

    return { dashboard, data };
  }

  /**
   * Add real-time event listener
   */
  addRealTimeListener(callback: (event: UserBehaviorEvent) => void): void {
    this.realTimeListeners.add(callback);
  }

  /**
   * Remove real-time event listener
   */
  removeRealTimeListener(callback: (event: UserBehaviorEvent) => void): void {
    this.realTimeListeners.delete(callback);
  }

  /**
   * Export analytics data
   */
  exportData(
    format: 'json' | 'csv',
    filters: {
      dateRange?: { start: Date; end: Date };
      eventTypes?: string[];
      userId?: string;
    } = {}
  ): string {
    let filteredEvents = this.events;

    if (filters.dateRange) {
      filteredEvents = filteredEvents.filter(e => 
        e.timestamp >= filters.dateRange!.start && 
        e.timestamp <= filters.dateRange!.end
      );
    }

    if (filters.eventTypes) {
      filteredEvents = filteredEvents.filter(e => 
        filters.eventTypes!.includes(e.type)
      );
    }

    if (filters.userId) {
      filteredEvents = filteredEvents.filter(e => 
        e.userId === filters.userId
      );
    }

    if (format === 'json') {
      return JSON.stringify(filteredEvents, null, 2);
    } else {
      return this.convertToCSV(filteredEvents);
    }
  }

  // Private helper methods
  private setupDefaultMetrics(): void {
    this.metrics.set('users', {
      name: 'Active Users',
      value: 0,
      change: 0,
      trend: 'stable',
      format: 'number',
      description: 'Number of active users in the selected time period'
    });

    this.metrics.set('pageviews', {
      name: 'Page Views',
      value: 0,
      change: 0,
      trend: 'stable',
      format: 'number',
      description: 'Total number of page views'
    });

    this.metrics.set('conversion_rate', {
      name: 'Conversion Rate',
      value: 0,
      change: 0,
      trend: 'stable',
      format: 'percentage',
      description: 'Percentage of visitors who complete a purchase'
    });
  }

  private setupDefaultFunnels(): void {
    this.funnels.set('purchase', {
      name: 'Purchase Funnel',
      steps: [
        { name: 'Product View', selector: '[data-track=\"product_view\"]', required: true },
        { name: 'Add to Cart', selector: '[data-track=\"add_to_cart\"]', required: true },
        { name: 'Checkout', selector: '[data-track=\"checkout\"]', required: true },
        { name: 'Purchase', selector: '[data-track=\"purchase\"]', required: true }
      ],
      timeWindow: 60 // 60 minutes
    });
  }

  private setupDefaultSegments(): void {
    this.segments.set('high_value', {
      id: 'high_value',
      name: 'High Value Customers',
      description: 'Users with high lifetime value and frequent purchases',
      criteria: {
        transactions: { totalValue: { $gte: 1000 } },
        behavior: { purchaseFrequency: { $gte: 5 } }
      },
      size: 0,
      performance: {
        conversionRate: 0,
        averageOrderValue: 0,
        lifetimeValue: 0,
        churnRate: 0
      }
    });
  }

  private startRealTimeProcessing(): void {
    // Process events in batches every few seconds
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 5000);
  }

  private processEventRealTime(event: UserBehaviorEvent): void {
    // Update real-time metrics based on the event
    this.updateMetricFromEvent(event);
  }

  private updateMetricFromEvent(event: UserBehaviorEvent): void {
    // Update relevant metrics based on event type
    switch (event.type) {
      case 'page_view':
        this.incrementMetric('pageviews');
        break;
      case 'purchase':
        this.incrementMetric('conversions');
        break;
      // Add more cases as needed
    }
  }

  private incrementMetric(metricKey: string): void {
    const metric = this.metrics.get(metricKey);
    if (metric) {
      metric.value++;
    }
  }

  private updateRealTimeMetrics(): void {
    const realTime = this.getRealTimeMetrics();
    
    this.metrics.set('active_users', {
      name: 'Active Users',
      value: realTime.activeUsers,
      change: 0,
      trend: 'stable',
      format: 'number'
    });
  }

  private notifyRealTimeListeners(event: UserBehaviorEvent): void {
    this.realTimeListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in real-time listener:', error);
      }
    });
  }

  private getEventContext(): UserBehaviorEvent['context'] {
    return {
      page: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      device: this.getDeviceType(),
      browser: this.getBrowserName(),
      os: this.getOperatingSystem()
    };
  }

  private getSessionId(): string {
    let sessionId = this.sessionStorage.get('sessionId');
    if (!sessionId) {
      sessionId = this.generateId();
      this.sessionStorage.set('sessionId', sessionId);
    }
    return sessionId;
  }

  private getPreviousPage(): string | undefined {
    return this.sessionStorage.get('previousPage');
  }

  private setPreviousPage(page: string): void {
    this.sessionStorage.set('previousPage', page);
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOperatingSystem(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private calculateSessionDurations(events: UserBehaviorEvent[]): number[] {
    const sessions = new Map<string, Date[]>();
    
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
      }
      sessions.get(event.sessionId)!.push(event.timestamp);
    });

    return Array.from(sessions.values()).map(timestamps => {
      timestamps.sort((a, b) => a.getTime() - b.getTime());
      const start = timestamps[0];
      const end = timestamps[timestamps.length - 1];
      return (end.getTime() - start.getTime()) / 1000 / 60; // minutes
    });
  }

  private hasCompletedFunnelStep(
    journey: UserBehaviorEvent[],
    step: ConversionFunnel['steps'][0],
    timeWindow: number
  ): boolean {
    return journey.some(event => 
      event.metadata.selector === step.selector &&
      event.timestamp.getTime() <= Date.now() + (timeWindow * 60 * 1000)
    );
  }

  private isCohortEvent(event: UserBehaviorEvent, cohortType: CohortAnalysis['cohortType']): boolean {
    switch (cohortType) {
      case 'registration':
        return event.action === 'register';
      case 'first_purchase':
        return event.type === 'purchase';
      case 'first_visit':
        return event.type === 'page_view';
      default:
        return false;
    }
  }

  private getCohortDate(timestamp: Date): string {
    return `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`;
  }

  private getUsersInSegment(segment: UserSegment): string[] {
    // This would implement the actual segmentation logic
    // For now, return empty array
    return [];
  }

  private calculateSegmentPerformance(users: string[]): UserSegment['performance'] {
    // This would calculate actual performance metrics
    return {
      conversionRate: 0,
      averageOrderValue: 0,
      lifetimeValue: 0,
      churnRate: 0
    };
  }

  private getWidgetData(widget: AnalyticsWidget, filters: Record<string, any>): ChartData | Metric {
    // This would generate actual widget data based on configuration
    return {
      type: 'line',
      data: []
    };
  }

  private convertToCSV(events: UserBehaviorEvent[]): string {
    const headers = ['id', 'timestamp', 'type', 'category', 'action', 'label', 'value', 'userId', 'sessionId'];
    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.type,
      event.category,
      event.action,
      event.label || '',
      event.value || '',
      event.userId || '',
      event.sessionId
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Vue 3 Composable for Analytics
 */
export function useAnalytics() {
  const engine = reactive(new AnalyticsEngine());
  const realTimeMetrics = ref(engine.getRealTimeMetrics());
  const isTracking = ref(true);

  // Update real-time metrics periodically
  const updateInterval = setInterval(() => {
    if (isTracking.value) {
      realTimeMetrics.value = engine.getRealTimeMetrics();
    }
  }, 5000);

  const track = (event: Omit<UserBehaviorEvent, 'id' | 'timestamp' | 'context'>) => {
    if (isTracking.value) {
      engine.track(event);
    }
  };

  const trackPage = (page: string, metadata?: Record<string, any>) => {
    engine.trackPageView(page, metadata);
  };

  const trackInteraction = (element: string, action: string, metadata?: Record<string, any>) => {
    engine.trackInteraction(element, action, metadata);
  };

  const trackSearch = (query: string, resultsCount: number, filters?: Record<string, any>) => {
    engine.trackSearch(query, resultsCount, filters);
  };

  const trackConversion = (type: string, value: number, metadata?: Record<string, any>) => {
    engine.trackConversion(type, value, metadata);
  };

  const trackError = (error: Error, context?: Record<string, any>) => {
    engine.trackError(error, context);
  };

  const analyzeFunnel = (funnelId: string, timeRange: { start: Date; end: Date }) => {
    return engine.analyzeFunnel(funnelId, timeRange);
  };

  const analyzeCohorts = (cohortType: CohortAnalysis['cohortType'], periods?: number) => {
    return engine.analyzeCohorts(cohortType, periods);
  };

  const getSegments = () => {
    return engine.getSegmentAnalysis();
  };

  const createDashboard = (dashboard: Omit<AnalyticsDashboard, 'id'>) => {
    return engine.createDashboard(dashboard);
  };

  const getDashboard = (dashboardId: string, filters?: Record<string, any>) => {
    return engine.getDashboardData(dashboardId, filters);
  };

  const exportData = (format: 'json' | 'csv', filters?: any) => {
    return engine.exportData(format, filters);
  };

  const toggleTracking = () => {
    isTracking.value = !isTracking.value;
  };

  // Cleanup
  const cleanup = () => {
    clearInterval(updateInterval);
  };

  return {
    track,
    trackPage,
    trackInteraction,
    trackSearch,
    trackConversion,
    trackError,
    analyzeFunnel,
    analyzeCohorts,
    getSegments,
    createDashboard,
    getDashboard,
    exportData,
    toggleTracking,
    cleanup,
    realTimeMetrics: readonly(realTimeMetrics),
    isTracking: readonly(isTracking)
  };
}