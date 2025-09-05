/**
 * Production Polish Features - Main Export
 * Comprehensive 20/80 finishing touches for enterprise-ready applications
 */

// Core Polish Systems
export { AdvancedAnimationSystem, useAdvancedAnimations } from './advanced-animations';
export type { AnimationConfig, LoadingAnimation, MicroInteraction } from './advanced-animations';

export { EdgeCaseHandler, useEdgeCaseHandler } from './edge-case-handler';
export type { EdgeCaseConfig, ErrorState, EmptyState, RetryStrategy } from './edge-case-handler';

export { AccessibilityEnhancer, useAccessibility, vAccessible } from './accessibility-enhancer';
export type { AccessibilityConfig, AriaAttributes, KeyboardNavigation, FocusTrap } from './accessibility-enhancer';

export { AdvancedSearchEngine, useAdvancedSearch } from './advanced-search-engine';
export type { 
  SearchQuery, 
  SearchSuggestion, 
  SavedSearch, 
  SearchFilter, 
  SearchResult,
  SearchAnalytics 
} from './advanced-search-engine';

export { UserPreferencesManager, useUserPreferences } from './user-preferences';
export type { 
  Theme, 
  NotificationPreferences, 
  AccessibilityPreferences, 
  DisplayPreferences,
  SearchPreferences,
  PrivacyPreferences,
  UserPreferences,
  PreferenceGroup 
} from './user-preferences';

export { AnalyticsEngine, useAnalytics } from './analytics-dashboard';
export type { 
  UserBehaviorEvent, 
  ConversionFunnel, 
  Metric, 
  ChartData,
  AnalyticsDashboard,
  AnalyticsWidget,
  CohortAnalysis,
  UserSegment 
} from './analytics-dashboard';

export { AdvancedSecurityManager, useAdvancedSecurity } from './advanced-security';
export type { 
  SecurityPolicy, 
  ThreatRule, 
  SecurityIncident, 
  AuditLog,
  RateLimitEntry,
  SecurityMetrics 
} from './advanced-security';

export { InternationalizationEngine, useInternationalization } from './internationalization';
export type { 
  Translation, 
  Locale, 
  TranslationNamespace, 
  InterpolationContext,
  LocalizationOptions,
  CurrencyFormatOptions,
  DateTimeFormatOptions,
  NumberFormatOptions 
} from './internationalization';

export { ErrorMonitoringSystem, useErrorMonitoring } from './error-monitoring';
export type { 
  ErrorReport, 
  ErrorBreadcrumb, 
  RecoveryStrategy, 
  HealthCheck,
  HealthStatus,
  SystemMetrics,
  AlertRule 
} from './error-monitoring';

export { PerformanceOptimizer, usePerformanceOptimization } from './performance-optimization';
export type { 
  CacheConfig, 
  CacheEntry, 
  LazyLoadConfig, 
  PerformanceMetrics,
  OptimizationRule,
  ResourceHint 
} from './performance-optimization';

// Comprehensive Polish Suite Class
export class ProductionPolishSuite {
  private animations: AdvancedAnimationSystem;
  private edgeCases: EdgeCaseHandler;
  private accessibility: AccessibilityEnhancer;
  private search: AdvancedSearchEngine;
  private preferences: UserPreferencesManager;
  private analytics: AnalyticsEngine;
  private security: AdvancedSecurityManager;
  private i18n: InternationalizationEngine;
  private monitoring: ErrorMonitoringSystem;
  private performance: PerformanceOptimizer;

  constructor(config: {
    animations?: any;
    edgeCases?: any;
    accessibility?: any;
    security?: any;
    performance?: {
      cache?: any;
      lazyLoad?: any;
    };
  } = {}) {
    this.animations = new AdvancedAnimationSystem();
    this.edgeCases = new EdgeCaseHandler(config.edgeCases);
    this.accessibility = new AccessibilityEnhancer(config.accessibility);
    this.search = new AdvancedSearchEngine();
    this.preferences = new UserPreferencesManager();
    this.analytics = new AnalyticsEngine();
    this.security = new AdvancedSecurityManager(config.security);
    this.i18n = new InternationalizationEngine();
    this.monitoring = new ErrorMonitoringSystem();
    this.performance = new PerformanceOptimizer(
      config.performance?.cache,
      config.performance?.lazyLoad
    );
  }

  /**
   * Initialize all polish systems
   */
  async initialize(options: {
    userId?: string;
    locale?: string;
    enableMonitoring?: boolean;
    enableAnalytics?: boolean;
  } = {}): Promise<void> {
    const { userId, locale = 'en', enableMonitoring = true, enableAnalytics = true } = options;

    try {
      // Initialize internationalization
      await this.i18n.initialize(locale, ['common', 'navigation', 'forms', 'errors']);

      // Initialize user preferences if userId provided
      if (userId) {
        const preferences = this.preferences.getUserPreferences(userId);
        this.preferences.applyPreferences(preferences);
      }

      // Start monitoring systems
      if (enableMonitoring) {
        this.monitoring.startMonitoring();
        this.performance.startPerformanceMonitoring();
      }

      // Start analytics
      if (enableAnalytics) {
        this.analytics.trackPageView(window.location.pathname);
      }

      console.info('Production Polish Suite initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Polish Suite:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    animations: any;
    accessibility: any;
    performance: any;
    security: any;
    monitoring: any;
    i18n: any;
  } {
    return {
      animations: this.animations.getPerformanceMetrics(),
      accessibility: this.accessibility.getStatus(),
      performance: this.performance.getPerformanceMetrics(),
      security: this.security.getSecurityMetrics(
        { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() }
      ),
      monitoring: this.monitoring.getSystemHealth(),
      i18n: {
        currentLocale: this.i18n.getCurrentLocale(),
        missingKeys: this.i18n.getMissingKeys()
      }
    };
  }

  /**
   * Generate comprehensive polish report
   */
  generatePolishReport(): {
    summary: {
      systemHealth: string;
      performanceScore: number;
      securityStatus: string;
      accessibilityCompliance: boolean;
      i18nCoverage: number;
    };
    details: any;
    recommendations: string[];
  } {
    const status = this.getSystemStatus();
    const recommendations: string[] = [];

    // Calculate overall health
    const systemHealth = status.monitoring.overall;
    const performanceScore = (status.performance.vitals.lcp < 2500 ? 50 : 0) +
                           (status.performance.vitals.cls < 0.1 ? 50 : 0);
    const securityStatus = status.security.threats.total < 10 ? 'good' : 'needs_attention';
    const accessibilityCompliance = status.accessibility.config.screenReaderOptimized;
    const i18nCoverage = status.i18n.missingKeys.length === 0 ? 100 : 90;

    // Generate recommendations
    if (performanceScore < 80) {
      recommendations.push('Optimize Core Web Vitals for better performance');
    }
    if (securityStatus === 'needs_attention') {
      recommendations.push('Review and address security threats');
    }
    if (!accessibilityCompliance) {
      recommendations.push('Enable accessibility features for better compliance');
    }
    if (i18nCoverage < 95) {
      recommendations.push('Complete translation coverage for better internationalization');
    }

    return {
      summary: {
        systemHealth,
        performanceScore,
        securityStatus,
        accessibilityCompliance,
        i18nCoverage
      },
      details: status,
      recommendations
    };
  }

  /**
   * Cleanup and shutdown all systems
   */
  async shutdown(): Promise<void> {
    try {
      this.animations.stopAllAnimations();
      this.accessibility.destroy();
      this.monitoring.stopMonitoring();
      this.performance.reset();

      console.info('Production Polish Suite shutdown complete');
    } catch (error) {
      console.error('Error during Polish Suite shutdown:', error);
    }
  }

  // Getter methods for individual systems
  get animationSystem() { return this.animations; }
  get edgeCaseHandler() { return this.edgeCases; }
  get accessibilityEnhancer() { return this.accessibility; }
  get searchEngine() { return this.search; }
  get preferencesManager() { return this.preferences; }
  get analyticsEngine() { return this.analytics; }
  get securityManager() { return this.security; }
  get i18nEngine() { return this.i18n; }
  get monitoringSystem() { return this.monitoring; }
  get performanceOptimizer() { return this.performance; }
}

/**
 * Vue 3 Composable for the complete polish suite
 */
export function useProductionPolish(config?: any) {
  const suite = new ProductionPolishSuite(config);
  const isInitialized = ref(false);
  const systemStatus = ref<any>(null);

  const initialize = async (options?: any) => {
    await suite.initialize(options);
    isInitialized.value = true;
    systemStatus.value = suite.getSystemStatus();
  };

  const generateReport = () => {
    return suite.generatePolishReport();
  };

  const shutdown = async () => {
    await suite.shutdown();
    isInitialized.value = false;
    systemStatus.value = null;
  };

  // Update status periodically
  const updateStatus = () => {
    if (isInitialized.value) {
      systemStatus.value = suite.getSystemStatus();
    }
  };

  const statusInterval = setInterval(updateStatus, 30000); // Every 30 seconds

  // Cleanup on unmount
  const cleanup = () => {
    clearInterval(statusInterval);
    if (isInitialized.value) {
      suite.shutdown();
    }
  };

  return {
    suite,
    initialize,
    generateReport,
    shutdown,
    cleanup,
    isInitialized: readonly(isInitialized),
    systemStatus: readonly(systemStatus)
  };
}

// Export default instance for quick setup
export const polishSuite = new ProductionPolishSuite();

// Convenience functions
export const initializePolish = (options?: any) => polishSuite.initialize(options);
export const getPolishStatus = () => polishSuite.getSystemStatus();
export const generatePolishReport = () => polishSuite.generatePolishReport();