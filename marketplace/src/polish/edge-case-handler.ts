/**
 * Edge Case Handler - Production Polish Feature
 * Comprehensive handling of network failures, empty states, and error scenarios
 */

import { ref, reactive, computed } from 'vue';

export interface EdgeCaseConfig {
  retryAttempts: number;
  retryDelay: number;
  fallbackDelay: number;
  circuitBreakerThreshold: number;
  timeoutMs: number;
}

export interface ErrorState {
  type: 'network' | 'validation' | 'auth' | 'rate_limit' | 'server' | 'unknown';
  code?: string;
  message: string;
  retryable: boolean;
  timestamp: number;
  context?: Record<string, any>;
}

export interface EmptyState {
  type: 'no_results' | 'no_data' | 'loading' | 'error' | 'permission_denied';
  title: string;
  description: string;
  action?: {
    text: string;
    handler: () => void;
  };
  illustration?: string;
}

export interface RetryStrategy {
  exponential: boolean;
  maxDelay: number;
  jitter: boolean;
}

export class EdgeCaseHandler {
  private config: EdgeCaseConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryStrategies: Map<string, RetryStrategy> = new Map();
  private errorHistory: ErrorState[] = [];
  private readonly MAX_ERROR_HISTORY = 100;

  constructor(config: Partial<EdgeCaseConfig> = {}) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      fallbackDelay: 5000,
      circuitBreakerThreshold: 5,
      timeoutMs: 30000,
      ...config
    };
  }

  /**
   * Handle network failures with intelligent retry logic
   */
  async handleNetworkFailure<T>(
    operation: () => Promise<T>,
    operationId: string,
    customRetries?: number
  ): Promise<T> {
    const maxAttempts = customRetries ?? this.config.retryAttempts;
    const circuitBreaker = this.getOrCreateCircuitBreaker(operationId);

    if (circuitBreaker.isOpen()) {
      throw new Error(`Circuit breaker is open for ${operationId}`);
    }

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.withTimeout(operation(), this.config.timeoutMs);
        circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;
        circuitBreaker.recordFailure();

        const errorState: ErrorState = {
          type: this.determineErrorType(error as Error),
          message: (error as Error).message,
          retryable: this.isRetryable(error as Error),
          timestamp: Date.now(),
          context: { attempt, operationId }
        };

        this.recordError(errorState);

        if (!errorState.retryable || attempt === maxAttempts) {
          break;
        }

        await this.calculateRetryDelay(attempt, operationId);
      }
    }

    throw this.enrichError(lastError!, operationId);
  }

  /**
   * Handle empty states with contextual messaging
   */
  generateEmptyState(
    context: string,
    data: any[],
    isLoading: boolean,
    hasError: boolean,
    userPermissions?: string[]
  ): EmptyState {
    if (isLoading) {
      return {
        type: 'loading',
        title: 'Loading...',
        description: 'Please wait while we fetch your data.',
        illustration: 'loading-spinner'
      };
    }

    if (hasError) {
      return {
        type: 'error',
        title: 'Oops! Something went wrong',
        description: 'We encountered an error while loading your data. Please try again.',
        action: {
          text: 'Try Again',
          handler: () => window.location.reload()
        },
        illustration: 'error-state'
      };
    }

    if (userPermissions && !this.hasRequiredPermission(context, userPermissions)) {
      return {
        type: 'permission_denied',
        title: 'Access Restricted',
        description: 'You don\'t have permission to view this content.',
        illustration: 'locked-content'
      };
    }

    if (data.length === 0) {
      const emptyStates: Record<string, EmptyState> = {
        products: {
          type: 'no_results',
          title: 'No products found',
          description: 'Try adjusting your search criteria or browse our categories.',
          action: {
            text: 'Browse Categories',
            handler: () => this.navigateToCategories()
          },
          illustration: 'empty-search'
        },
        orders: {
          type: 'no_data',
          title: 'No orders yet',
          description: 'When you make your first purchase, it will appear here.',
          action: {
            text: 'Start Shopping',
            handler: () => this.navigateToMarketplace()
          },
          illustration: 'empty-orders'
        },
        wishlist: {
          type: 'no_data',
          title: 'Your wishlist is empty',
          description: 'Save items you love for later by clicking the heart icon.',
          action: {
            text: 'Discover Products',
            handler: () => this.navigateToMarketplace()
          },
          illustration: 'empty-wishlist'
        },
        transactions: {
          type: 'no_data',
          title: 'No transactions found',
          description: 'Your transaction history will appear here once you start buying or selling.',
          illustration: 'empty-transactions'
        }
      };

      return emptyStates[context] || {
        type: 'no_data',
        title: 'No data available',
        description: 'There\'s no content to display at the moment.',
        illustration: 'empty-state'
      };
    }

    // Shouldn't reach here, but return a fallback
    return {
      type: 'no_data',
      title: 'All set!',
      description: 'Everything is working as expected.',
      illustration: 'success-state'
    };
  }

  /**
   * Handle rate limiting with intelligent backoff
   */
  async handleRateLimit(
    operation: () => Promise<any>,
    rateLimitInfo?: {
      resetTime?: number;
      retryAfter?: number;
      remainingRequests?: number;
    }
  ): Promise<any> {
    if (rateLimitInfo?.retryAfter) {
      await this.delay(rateLimitInfo.retryAfter * 1000);
    } else if (rateLimitInfo?.resetTime) {
      const waitTime = Math.max(0, rateLimitInfo.resetTime - Date.now());
      await this.delay(Math.min(waitTime, 60000)); // Max 1 minute wait
    } else {
      // Default exponential backoff
      await this.delay(this.config.retryDelay * 2);
    }

    return await operation();
  }

  /**
   * Graceful degradation for feature unavailability
   */
  async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T> | T,
    featureName: string
  ): Promise<T> {
    try {
      return await this.withTimeout(primaryOperation(), this.config.timeoutMs);
    } catch (error) {
      console.warn(`${featureName} unavailable, using fallback:`, error);
      
      const fallbackResult = await fallbackOperation();
      
      // Record degradation event for monitoring
      this.recordError({
        type: 'server',
        message: `${featureName} degraded: ${(error as Error).message}`,
        retryable: true,
        timestamp: Date.now(),
        context: { featureName, degraded: true }
      });

      return fallbackResult;
    }
  }

  /**
   * Progressive enhancement for advanced features
   */
  async withProgressiveEnhancement<T>(
    baseOperation: () => Promise<T>,
    enhancementOperation: (baseResult: T) => Promise<T>,
    enhancementName: string
  ): Promise<T> {
    const baseResult = await baseOperation();

    try {
      return await this.withTimeout(
        enhancementOperation(baseResult),
        this.config.timeoutMs / 2 // Shorter timeout for enhancements
      );
    } catch (error) {
      console.warn(`${enhancementName} enhancement failed, using base result:`, error);
      return baseResult;
    }
  }

  /**
   * Handle connection state changes
   */
  handleConnectionState(): {
    isOnline: boolean;
    connectionType: string;
    quality: 'good' | 'poor' | 'offline';
  } {
    const isOnline = navigator.onLine;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    let connectionType = 'unknown';
    let quality: 'good' | 'poor' | 'offline' = 'offline';

    if (isOnline) {
      if (connection) {
        connectionType = connection.effectiveType || connection.type || 'unknown';
        quality = this.assessConnectionQuality(connection);
      } else {
        quality = 'good'; // Assume good if no connection info available
      }
    }

    return { isOnline, connectionType, quality };
  }

  /**
   * Get error recovery suggestions
   */
  getRecoverySuggestions(error: ErrorState): string[] {
    const suggestions: Record<string, string[]> = {
      network: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
        'Switch to a different network if available'
      ],
      validation: [
        'Check your input and try again',
        'Make sure all required fields are filled',
        'Verify the format of your data'
      ],
      auth: [
        'Please log in again',
        'Clear your browser cache and cookies',
        'Contact support if the problem persists'
      ],
      rate_limit: [
        'Wait a few minutes before trying again',
        'Reduce the frequency of your requests',
        'Consider upgrading your plan for higher limits'
      ],
      server: [
        'Our servers are experiencing issues',
        'Please try again in a few minutes',
        'Check our status page for updates'
      ]
    };

    return suggestions[error.type] || [
      'Please try again',
      'Contact support if the problem persists'
    ];
  }

  /**
   * Export error analytics for monitoring
   */
  getErrorAnalytics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: ErrorState[];
    circuitBreakerStatus: Record<string, { isOpen: boolean; failures: number }>;
  } {
    const errorsByType: Record<string, number> = {};
    
    this.errorHistory.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    const circuitBreakerStatus: Record<string, { isOpen: boolean; failures: number }> = {};
    this.circuitBreakers.forEach((breaker, key) => {
      circuitBreakerStatus[key] = {
        isOpen: breaker.isOpen(),
        failures: breaker.getFailureCount()
      };
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors: this.errorHistory.slice(-10),
      circuitBreakerStatus
    };
  }

  // Private helper methods
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    );

    return Promise.race([promise, timeout]);
  }

  private determineErrorType(error: Error): ErrorState['type'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('auth') || message.includes('unauthorized')) return 'auth';
    if (message.includes('rate') || message.includes('limit')) return 'rate_limit';
    if (message.includes('server') || message.includes('internal')) return 'server';
    
    return 'unknown';
  }

  private isRetryable(error: Error): boolean {
    const nonRetryablePatterns = [
      'validation',
      'unauthorized',
      'forbidden',
      'not found',
      'bad request'
    ];

    const message = error.message.toLowerCase();
    return !nonRetryablePatterns.some(pattern => message.includes(pattern));
  }

  private async calculateRetryDelay(attempt: number, operationId: string): Promise<void> {
    const strategy = this.retryStrategies.get(operationId) || {
      exponential: true,
      maxDelay: 30000,
      jitter: true
    };

    let delay = this.config.retryDelay;

    if (strategy.exponential) {
      delay = Math.min(delay * Math.pow(2, attempt - 1), strategy.maxDelay);
    }

    if (strategy.jitter) {
      delay += Math.random() * 1000; // Add up to 1 second of jitter
    }

    await this.delay(delay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getOrCreateCircuitBreaker(operationId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(operationId);
    if (!breaker) {
      breaker = new CircuitBreaker(this.config.circuitBreakerThreshold);
      this.circuitBreakers.set(operationId, breaker);
    }
    return breaker;
  }

  private recordError(error: ErrorState): void {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }
  }

  private enrichError(error: Error, operationId: string): Error {
    const enriched = new Error(`[${operationId}] ${error.message}`);
    enriched.stack = error.stack;
    return enriched;
  }

  private assessConnectionQuality(connection: any): 'good' | 'poor' | 'offline' {
    if (!connection) return 'good';

    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;

    if (effectiveType === '4g' || (downlink && downlink > 10)) return 'good';
    if (effectiveType === '3g' || (downlink && downlink > 1.5)) return 'good';
    return 'poor';
  }

  private hasRequiredPermission(context: string, userPermissions: string[]): boolean {
    const requiredPermissions: Record<string, string[]> = {
      admin: ['admin'],
      seller: ['sell', 'admin'],
      buyer: ['buy', 'sell', 'admin'],
      analytics: ['analytics', 'admin']
    };

    const required = requiredPermissions[context] || [];
    return required.some(permission => userPermissions.includes(permission));
  }

  private navigateToCategories(): void {
    window.location.href = '/categories';
  }

  private navigateToMarketplace(): void {
    window.location.href = '/marketplace';
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly resetTimeoutMs = 60000; // 1 minute

  constructor(private threshold: number) {}

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Vue 3 Composable
 */
export function useEdgeCaseHandler(config?: Partial<EdgeCaseConfig>) {
  const handler = reactive(new EdgeCaseHandler(config));
  const connectionState = ref(handler.handleConnectionState());

  // Update connection state on changes
  const updateConnectionState = () => {
    connectionState.value = handler.handleConnectionState();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateConnectionState);
    window.addEventListener('offline', updateConnectionState);
  }

  const handleError = async <T>(
    operation: () => Promise<T>,
    operationId: string,
    retries?: number
  ) => {
    return handler.handleNetworkFailure(operation, operationId, retries);
  };

  const getEmptyState = (
    context: string,
    data: any[],
    isLoading: boolean,
    hasError: boolean,
    permissions?: string[]
  ) => {
    return handler.generateEmptyState(context, data, isLoading, hasError, permissions);
  };

  const withFallback = async <T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T> | T,
    featureName: string
  ) => {
    return handler.withGracefulDegradation(primary, fallback, featureName);
  };

  const analytics = computed(() => handler.getErrorAnalytics());

  return {
    handleError,
    getEmptyState,
    withFallback,
    connectionState: readonly(connectionState),
    analytics
  };
}