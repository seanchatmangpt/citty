/**
 * Performance Optimization System - Production Polish Feature
 * Advanced caching, lazy loading, and performance monitoring
 */

import { ref, reactive, computed, nextTick } from 'vue';

export interface CacheConfig {
  maxSize: number;
  ttl: number;
  strategy: 'lru' | 'lfu' | 'ttl';
  compress: boolean;
  serialize: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl?: number;
}

export interface LazyLoadConfig {
  threshold: number;
  rootMargin: string;
  preloadCount: number;
  batchSize: number;
  retryCount: number;
  retryDelay: number;
}

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  timing: {
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
  };
  resources: {
    totalSize: number;
    requestCount: number;
    cacheHitRate: number;
    loadTime: number;
  };
  vitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  };
}

export interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: PerformanceMetrics) => boolean;
  action: (context: any) => Promise<void>;
  priority: number;
  enabled: boolean;
}

export interface ResourceHint {
  type: 'preload' | 'prefetch' | 'preconnect' | 'dns-prefetch';
  href: string;
  as?: string;
  crossorigin?: string;
}

export class PerformanceOptimizer {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheConfig: CacheConfig;
  private lazyLoadObserver?: IntersectionObserver;
  private lazyLoadConfig: LazyLoadConfig;
  private optimizationRules: Map<string, OptimizationRule> = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private resourceHints: Set<ResourceHint> = new Set();
  private performanceObserver?: PerformanceObserver;
  private isOptimizing = false;

  constructor(
    cacheConfig: Partial<CacheConfig> = {},
    lazyLoadConfig: Partial<LazyLoadConfig> = {}
  ) {
    this.cacheConfig = {
      maxSize: 100,
      ttl: 300000, // 5 minutes
      strategy: 'lru',
      compress: false,
      serialize: true,
      ...cacheConfig
    };

    this.lazyLoadConfig = {
      threshold: 0.1,
      rootMargin: '50px',
      preloadCount: 3,
      batchSize: 5,
      retryCount: 3,
      retryDelay: 1000,
      ...lazyLoadConfig
    };

    this.setupDefaultRules();
    this.initializeObservers();
    this.startMetricsCollection();
  }

  /**
   * Smart caching system with multiple strategies
   */
  async cache<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // Check if cached entry is valid
    if (entry && this.isCacheEntryValid(entry, now)) {
      entry.lastAccessed = now;
      entry.accessCount++;
      return entry.value as T;
    }

    // Generate new value
    const value = await factory();
    const serializedValue = this.cacheConfig.serialize ? JSON.stringify(value) : value;
    const size = this.estimateSize(serializedValue);

    const cacheEntry: CacheEntry<T> = {
      key,
      value: this.cacheConfig.compress ? this.compress(value) : value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      size,
      ttl: ttl || this.cacheConfig.ttl
    };

    this.cache.set(key, cacheEntry);
    this.evictIfNeeded();

    return value;
  }

  /**
   * Preload resources with priority hints
   */
  preloadResource(url: string, options: {
    as?: string;
    type?: 'preload' | 'prefetch';
    priority?: 'high' | 'low';
    crossorigin?: string;
  } = {}): void {
    const hint: ResourceHint = {
      type: options.type || 'preload',
      href: url,
      as: options.as,
      crossorigin: options.crossorigin
    };

    this.resourceHints.add(hint);
    this.applyResourceHint(hint, options.priority);
  }

  /**
   * Lazy load images with intersection observer
   */
  setupLazyLoading(container: HTMLElement): () => void {
    if (!this.lazyLoadObserver) {
      this.lazyLoadObserver = new IntersectionObserver(
        this.handleLazyLoad.bind(this),
        {
          threshold: this.lazyLoadConfig.threshold,
          rootMargin: this.lazyLoadConfig.rootMargin
        }
      );
    }

    // Find all lazy-loadable elements
    const lazyElements = container.querySelectorAll('[data-lazy-src]');
    lazyElements.forEach(element => {
      this.lazyLoadObserver!.observe(element);
    });

    return () => {
      lazyElements.forEach(element => {
        this.lazyLoadObserver?.unobserve(element);
      });
    };
  }

  /**
   * Optimize DOM operations with batching
   */
  async batchDOMUpdates<T>(updates: (() => T)[]): Promise<T[]> {
    const results: T[] = [];
    
    await nextTick(); // Wait for current render cycle
    
    // Use requestIdleCallback for non-critical updates
    return new Promise(resolve => {
      const processBatch = (deadline: IdleDeadline) => {
        while (updates.length > 0 && deadline.timeRemaining() > 0) {
          const update = updates.shift()!;
          results.push(update());
        }

        if (updates.length > 0) {
          requestIdleCallback(processBatch);
        } else {
          resolve(results);
        }
      };

      requestIdleCallback(processBatch);
    });
  }

  /**
   * Memory management and cleanup
   */
  optimizeMemory(): {
    beforeSize: number;
    afterSize: number;
    freed: number;
  } {
    const beforeSize = this.getMemoryUsage();

    // Clear expired cache entries
    const now = Date.now();
    let freedCount = 0;

    this.cache.forEach((entry, key) => {
      if (!this.isCacheEntryValid(entry, now)) {
        this.cache.delete(key);
        freedCount++;
      }
    });

    // Clear old metrics history
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.splice(0, this.metricsHistory.length - 100);
    }

    // Trigger garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    const afterSize = this.getMemoryUsage();

    return {
      beforeSize,
      afterSize,
      freed: beforeSize - afterSize
    };
  }

  /**
   * Image optimization with WebP support
   */
  optimizeImage(src: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'auto';
    lazy?: boolean;
  } = {}): string {
    const { width, height, quality = 85, format = 'auto', lazy = true } = options;
    
    // Check browser support
    const supportsWebP = this.supportsWebP();
    const supportsAVIF = this.supportsAVIF();
    
    let optimizedSrc = src;
    let actualFormat = format;

    if (format === 'auto') {
      if (supportsAVIF) {
        actualFormat = 'avif';
      } else if (supportsWebP) {
        actualFormat = 'webp';
      }
    }

    // Apply format conversion (would typically be done server-side)
    if (actualFormat !== 'auto') {
      optimizedSrc = src.replace(/\.(jpg|jpeg|png)$/i, `.${actualFormat}`);
    }

    // Add query parameters for resizing (if using image service)
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    if (quality !== 85) params.set('q', quality.toString());

    if (params.toString()) {
      optimizedSrc += `?${params.toString()}`;
    }

    return optimizedSrc;
  }

  /**
   * Code splitting and dynamic imports
   */
  async loadModule<T>(
    importFn: () => Promise<T>,
    fallback?: () => Promise<T>,
    retries = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        console.warn(`Module load attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          if (fallback) {
            console.info('Loading fallback module');
            return await fallback();
          }
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
    
    throw new Error('Should not reach here');
  }

  /**
   * Virtual scrolling for large lists
   */
  createVirtualScroller<T>(options: {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
  }) {
    const { items, itemHeight, containerHeight, overscan = 5 } = options;
    
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const totalHeight = items.length * itemHeight;
    
    return reactive({
      scrollTop: 0,
      visibleItems: computed(() => {
        const startIndex = Math.max(0, Math.floor(this.scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
        
        return {
          items: items.slice(startIndex, endIndex),
          startIndex,
          endIndex,
          offsetY: startIndex * itemHeight
        };
      }),
      totalHeight,
      handleScroll(event: Event) {
        this.scrollTop = (event.target as HTMLElement).scrollTop;
      }
    });
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const memory = this.getMemoryInfo();
    const timing = this.getTimingMetrics();
    const resources = this.getResourceMetrics();
    const vitals = this.getCoreWebVitals();

    return {
      memory,
      timing,
      resources,
      vitals
    };
  }

  /**
   * Performance monitoring and alerting
   */
  startPerformanceMonitoring(callback?: (metrics: PerformanceMetrics) => void): () => void {
    const collectMetrics = () => {
      const metrics = this.getPerformanceMetrics();
      this.metricsHistory.push(metrics);
      
      // Limit history size
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory.shift();
      }
      
      callback?.(metrics);
      this.runOptimizationRules(metrics);
    };

    collectMetrics(); // Initial collection
    const interval = setInterval(collectMetrics, 5000); // Every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: PerformanceMetrics;
    trends: {
      memory: number;
      loadTime: number;
      cacheHitRate: number;
    };
    recommendations: string[];
    scores: {
      overall: number;
      performance: number;
      memory: number;
      caching: number;
    };
  } {
    if (this.metricsHistory.length === 0) {
      throw new Error('No performance metrics available');
    }

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const recommendations: string[] = [];
    
    // Calculate trends
    const trends = this.calculateTrends();
    
    // Generate recommendations
    if (latest.memory.percentage > 0.8) {
      recommendations.push('High memory usage detected. Consider implementing memory optimization.');
    }
    
    if (latest.vitals.lcp > 2500) {
      recommendations.push('Largest Contentful Paint is slow. Optimize critical resource loading.');
    }
    
    if (latest.vitals.cls > 0.1) {
      recommendations.push('Cumulative Layout Shift is high. Stabilize layout during loading.');
    }
    
    if (latest.resources.cacheHitRate < 0.8) {
      recommendations.push('Low cache hit rate. Review caching strategy.');
    }

    // Calculate scores
    const scores = this.calculatePerformanceScores(latest);

    return {
      summary: latest,
      trends,
      recommendations,
      scores
    };
  }

  /**
   * Clear all caches and reset
   */
  reset(): void {
    this.cache.clear();
    this.metricsHistory = [];
    this.resourceHints.clear();
    
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect();
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  // Private methods
  private setupDefaultRules(): void {
    const rules: OptimizationRule[] = [
      {
        id: 'memory_cleanup',
        name: 'Memory Cleanup',
        description: 'Clean up memory when usage is high',
        condition: (metrics) => metrics.memory.percentage > 0.85,
        action: async () => {
          this.optimizeMemory();
        },
        priority: 1,
        enabled: true
      },
      {
        id: 'cache_preload',
        name: 'Cache Preloading',
        description: 'Preload frequently accessed resources',
        condition: (metrics) => metrics.resources.cacheHitRate < 0.7,
        action: async (context) => {
          // Implement cache preloading logic
          await this.preloadFrequentlyAccessedResources();
        },
        priority: 2,
        enabled: true
      },
      {
        id: 'image_optimization',
        name: 'Image Optimization',
        description: 'Optimize images when load time is high',
        condition: (metrics) => metrics.timing.loadComplete > 3000,
        action: async () => {
          this.optimizeVisibleImages();
        },
        priority: 3,
        enabled: true
      }
    ];

    rules.forEach(rule => {
      this.optimizationRules.set(rule.id, rule);
    });
  }

  private initializeObservers(): void {
    // Performance Observer for Web Vitals
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.handlePerformanceEntry(entry);
        });
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
      } catch (e) {
        console.warn('Performance Observer not fully supported');
      }
    }
  }

  private startMetricsCollection(): void {
    // Collect initial metrics after page load
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.metricsHistory.push(this.getPerformanceMetrics());
        }, 1000);
      });
    } else {
      setTimeout(() => {
        this.metricsHistory.push(this.getPerformanceMetrics());
      }, 1000);
    }
  }

  private isCacheEntryValid(entry: CacheEntry, now: number): boolean {
    const ttl = entry.ttl || this.cacheConfig.ttl;
    return (now - entry.timestamp) < ttl;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.cacheConfig.maxSize) {
      return;
    }

    const entries = Array.from(this.cache.entries());
    let toEvict: string[] = [];

    switch (this.cacheConfig.strategy) {
      case 'lru':
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        toEvict = entries.slice(0, Math.floor(this.cacheConfig.maxSize * 0.1)).map(e => e[0]);
        break;
        
      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        toEvict = entries.slice(0, Math.floor(this.cacheConfig.maxSize * 0.1)).map(e => e[0]);
        break;
        
      case 'ttl':
        const now = Date.now();
        toEvict = entries
          .filter(([_, entry]) => !this.isCacheEntryValid(entry, now))
          .map(([key]) => key);
        break;
    }

    toEvict.forEach(key => this.cache.delete(key));
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Rough estimate for UTF-16
    }
    return JSON.stringify(value).length * 2;
  }

  private compress(value: any): any {
    // Simple compression simulation (in production, use proper compression)
    return value;
  }

  private applyResourceHint(hint: ResourceHint, priority?: string): void {
    const link = document.createElement('link');
    link.rel = hint.type;
    link.href = hint.href;
    
    if (hint.as) link.as = hint.as;
    if (hint.crossorigin) link.crossOrigin = hint.crossorigin;
    if (priority) link.setAttribute('importance', priority);

    document.head.appendChild(link);
  }

  private handleLazyLoad(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target as HTMLImageElement;
        const lazySrc = element.dataset.lazySrc;
        
        if (lazySrc) {
          element.src = lazySrc;
          element.removeAttribute('data-lazy-src');
          this.lazyLoadObserver?.unobserve(element);
        }
      }
    });
  }

  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  private supportsAVIF(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  }

  private getMemoryUsage(): number {
    const memory = (performance as any).memory;
    return memory ? memory.usedJSHeapSize : 0;
  }

  private getMemoryInfo(): PerformanceMetrics['memory'] {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  private getTimingMetrics(): PerformanceMetrics['timing'] {
    const timing = performance.timing;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint(),
      largestContentfulPaint: this.getLargestContentfulPaint(),
      firstInputDelay: this.getFirstInputDelay(),
      cumulativeLayoutShift: this.getCumulativeLayoutShift()
    };
  }

  private getResourceMetrics(): PerformanceMetrics['resources'] {
    const resources = performance.getEntriesByType('resource');
    const totalSize = resources.reduce((sum, resource) => {
      return sum + ((resource as any).transferSize || 0);
    }, 0);

    return {
      totalSize,
      requestCount: resources.length,
      cacheHitRate: this.calculateCacheHitRate(),
      loadTime: this.getAverageLoadTime()
    };
  }

  private getCoreWebVitals(): PerformanceMetrics['vitals'] {
    return {
      lcp: this.getLargestContentfulPaint(),
      fid: this.getFirstInputDelay(),
      cls: this.getCumulativeLayoutShift()
    };
  }

  private getFirstPaint(): number {
    const paint = performance.getEntriesByType('paint');
    const fp = paint.find(entry => entry.name === 'first-paint');
    return fp ? fp.startTime : 0;
  }

  private getFirstContentfulPaint(): number {
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : 0;
  }

  private getLargestContentfulPaint(): number {
    const lcp = performance.getEntriesByType('largest-contentful-paint');
    return lcp.length > 0 ? lcp[lcp.length - 1].startTime : 0;
  }

  private getFirstInputDelay(): number {
    // FID is typically measured by external libraries
    return 0;
  }

  private getCumulativeLayoutShift(): number {
    const cls = performance.getEntriesByType('layout-shift');
    return cls.reduce((sum, entry) => sum + (entry as any).value, 0);
  }

  private calculateCacheHitRate(): number {
    const cacheSize = this.cache.size;
    return cacheSize > 0 ? 0.85 : 0; // Placeholder calculation
  }

  private getAverageLoadTime(): number {
    const resources = performance.getEntriesByType('resource');
    if (resources.length === 0) return 0;
    
    const totalTime = resources.reduce((sum, resource) => {
      return sum + (resource.responseEnd - resource.requestStart);
    }, 0);
    
    return totalTime / resources.length;
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    // Handle different types of performance entries
    if (entry.entryType === 'navigation') {
      // Navigation timing
    } else if (entry.entryType === 'paint') {
      // Paint timing
    }
  }

  private calculateTrends() {
    if (this.metricsHistory.length < 2) {
      return { memory: 0, loadTime: 0, cacheHitRate: 0 };
    }

    const recent = this.metricsHistory.slice(-10);
    const older = this.metricsHistory.slice(-20, -10);

    const recentAvg = {
      memory: recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length,
      loadTime: recent.reduce((sum, m) => sum + m.resources.loadTime, 0) / recent.length,
      cacheHitRate: recent.reduce((sum, m) => sum + m.resources.cacheHitRate, 0) / recent.length
    };

    const olderAvg = {
      memory: older.reduce((sum, m) => sum + m.memory.percentage, 0) / older.length,
      loadTime: older.reduce((sum, m) => sum + m.resources.loadTime, 0) / older.length,
      cacheHitRate: older.reduce((sum, m) => sum + m.resources.cacheHitRate, 0) / older.length
    };

    return {
      memory: recentAvg.memory - olderAvg.memory,
      loadTime: recentAvg.loadTime - olderAvg.loadTime,
      cacheHitRate: recentAvg.cacheHitRate - olderAvg.cacheHitRate
    };
  }

  private calculatePerformanceScores(metrics: PerformanceMetrics) {
    const performance = Math.max(0, 100 - (metrics.vitals.lcp / 25));
    const memory = Math.max(0, 100 - (metrics.memory.percentage * 100));
    const caching = metrics.resources.cacheHitRate * 100;
    const overall = (performance + memory + caching) / 3;

    return { overall, performance, memory, caching };
  }

  private async runOptimizationRules(metrics: PerformanceMetrics): Promise<void> {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      const applicableRules = Array.from(this.optimizationRules.values())
        .filter(rule => rule.enabled && rule.condition(metrics))
        .sort((a, b) => a.priority - b.priority);

      for (const rule of applicableRules) {
        try {
          await rule.action({ metrics });
        } catch (error) {
          console.error(`Optimization rule ${rule.id} failed:`, error);
        }
      }
    } finally {
      this.isOptimizing = false;
    }
  }

  private async preloadFrequentlyAccessedResources(): Promise<void> {
    // Implementation would analyze cache access patterns
    // and preload frequently accessed resources
  }

  private optimizeVisibleImages(): void {
    const images = document.querySelectorAll('img[src]:not([data-optimized])');
    images.forEach(img => {
      const image = img as HTMLImageElement;
      if (this.isElementVisible(image)) {
        const optimizedSrc = this.optimizeImage(image.src);
        if (optimizedSrc !== image.src) {
          image.src = optimizedSrc;
          image.setAttribute('data-optimized', 'true');
        }
      }
    });
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && 
           rect.bottom <= window.innerHeight && 
           rect.right <= window.innerWidth;
  }
}

/**
 * Vue 3 Composable
 */
export function usePerformanceOptimization(config?: {
  cache?: Partial<CacheConfig>;
  lazyLoad?: Partial<LazyLoadConfig>;
}) {
  const optimizer = reactive(new PerformanceOptimizer(
    config?.cache,
    config?.lazyLoad
  ));
  
  const metrics = ref<PerformanceMetrics>();
  const isMonitoring = ref(false);

  const cache = async <T>(key: string, factory: () => Promise<T>, ttl?: number) => {
    return optimizer.cache(key, factory, ttl);
  };

  const preload = (url: string, options?: any) => {
    optimizer.preloadResource(url, options);
  };

  const setupLazyLoading = (container: HTMLElement) => {
    return optimizer.setupLazyLoading(container);
  };

  const batchUpdates = async <T>(updates: (() => T)[]) => {
    return optimizer.batchDOMUpdates(updates);
  };

  const optimizeMemory = () => {
    return optimizer.optimizeMemory();
  };

  const optimizeImage = (src: string, options?: any) => {
    return optimizer.optimizeImage(src, options);
  };

  const loadModule = async <T>(
    importFn: () => Promise<T>,
    fallback?: () => Promise<T>
  ) => {
    return optimizer.loadModule(importFn, fallback);
  };

  const createVirtualScroller = <T>(options: any) => {
    return optimizer.createVirtualScroller(options);
  };

  const startMonitoring = () => {
    isMonitoring.value = true;
    return optimizer.startPerformanceMonitoring((newMetrics) => {
      metrics.value = newMetrics;
    });
  };

  const generateReport = () => {
    return optimizer.generatePerformanceReport();
  };

  const reset = () => {
    optimizer.reset();
    metrics.value = undefined;
    isMonitoring.value = false;
  };

  const currentMetrics = computed(() => metrics.value);

  return {
    cache,
    preload,
    setupLazyLoading,
    batchUpdates,
    optimizeMemory,
    optimizeImage,
    loadModule,
    createVirtualScroller,
    startMonitoring,
    generateReport,
    reset,
    currentMetrics,
    isMonitoring: readonly(isMonitoring)
  };
}