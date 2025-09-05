// Global Test Setup for Marketplace Test Suite
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test configuration
export const TEST_CONFIG = {
  // Test data generation settings
  DEFAULT_PRODUCT_COUNT: 100,
  DEFAULT_USER_COUNT: 50,
  DEFAULT_TRANSACTION_COUNT: 200,
  
  // Performance thresholds
  MAX_SEARCH_TIME_MS: 100,
  MAX_TRANSACTION_TIME_MS: 500,
  MAX_WORKFLOW_TIME_MS: 2000,
  
  // Memory limits
  MAX_MEMORY_MB: 100,
  
  // Test environment
  IS_CI: process.env.CI === 'true',
  IS_PERFORMANCE_TEST: process.env.VITEST_PERFORMANCE === 'true',
  
  // Mock settings
  ENABLE_API_MOCKS: true,
  ENABLE_NETWORK_MOCKS: true,
  
  // Logging
  LOG_LEVEL: process.env.VITEST_LOG_LEVEL || 'error',
  VERBOSE_TESTS: process.env.VITEST_VERBOSE === 'true'
};

// Global test utilities
export class TestDataGenerator {
  private static productIdCounter = 0;
  private static userIdCounter = 0;
  private static transactionIdCounter = 0;

  static resetCounters(): void {
    this.productIdCounter = 0;
    this.userIdCounter = 0;
    this.transactionIdCounter = 0;
  }

  static generateProductId(): string {
    return `test_prod_${++this.productIdCounter}_${Date.now()}`;
  }

  static generateUserId(): string {
    return `test_user_${++this.userIdCounter}_${Date.now()}`;
  }

  static generateTransactionId(): string {
    return `test_txn_${++this.transactionIdCounter}_${Date.now()}`;
  }

  static randomCoordinates(dimensions: string[]): Record<string, number> {
    const coords: Record<string, number> = {};
    for (const dim of dimensions) {
      coords[dim] = Math.random() * 100;
    }
    return coords;
  }

  static randomEmail(): string {
    const domains = ['test.com', 'example.com', 'mock.org'];
    const username = Math.random().toString(36).substring(2, 8);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${username}@${domain}`;
  }

  static randomPrice(): number {
    return Math.random() * 1000 + 10;
  }

  static randomQuality(): number {
    return Math.random();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  static startMeasurement(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMeasurement(name, duration);
      return duration;
    };
  }

  static recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
  }

  static getMeasurements(name: string): number[] {
    return this.measurements.get(name) || [];
  }

  static getAverageTime(name: string): number {
    const times = this.getMeasurements(name);
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  static getMaxTime(name: string): number {
    const times = this.getMeasurements(name);
    return times.length > 0 ? Math.max(...times) : 0;
  }

  static getMinTime(name: string): number {
    const times = this.getMeasurements(name);
    return times.length > 0 ? Math.min(...times) : 0;
  }

  static clear(): void {
    this.measurements.clear();
  }

  static generateReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [name, times] of this.measurements.entries()) {
      if (times.length > 0) {
        report[name] = {
          count: times.length,
          average: this.getAverageTime(name),
          min: this.getMinTime(name),
          max: this.getMaxTime(name),
          total: times.reduce((sum, time) => sum + time, 0)
        };
      }
    }
    
    return report;
  }
}

// Memory monitoring
export class MemoryMonitor {
  private static initialMemory: number = 0;
  private static checkpoints: Array<{ name: string; memory: number; timestamp: number }> = [];

  static start(): void {
    this.initialMemory = process.memoryUsage().heapUsed;
    this.checkpoints = [];
  }

  static checkpoint(name: string): void {
    const memory = process.memoryUsage().heapUsed;
    this.checkpoints.push({
      name,
      memory,
      timestamp: Date.now()
    });
  }

  static getCurrentUsageMB(): number {
    return process.memoryUsage().heapUsed / 1024 / 1024;
  }

  static getUsageIncreaseMB(): number {
    if (this.initialMemory === 0) return 0;
    return (process.memoryUsage().heapUsed - this.initialMemory) / 1024 / 1024;
  }

  static forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  static generateReport(): Record<string, any> {
    const current = process.memoryUsage();
    
    return {
      initial: this.initialMemory / 1024 / 1024,
      current: current.heapUsed / 1024 / 1024,
      increase: this.getUsageIncreaseMB(),
      checkpoints: this.checkpoints.map(cp => ({
        ...cp,
        memoryMB: cp.memory / 1024 / 1024
      })),
      nodeMemory: {
        heapUsed: current.heapUsed / 1024 / 1024,
        heapTotal: current.heapTotal / 1024 / 1024,
        external: current.external / 1024 / 1024,
        rss: current.rss / 1024 / 1024
      }
    };
  }
}

// Test logging utility
export class TestLogger {
  static log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private static shouldLog(level: 'info' | 'warn' | 'error'): boolean {
    const currentLevel = TEST_CONFIG.LOG_LEVEL;
    
    if (currentLevel === 'error') return level === 'error';
    if (currentLevel === 'warn') return level !== 'info';
    return true; // 'info' level logs everything
  }
}

// Global setup and teardown
beforeAll(async () => {
  TestLogger.info('Starting marketplace test suite');
  TestLogger.info('Test configuration', TEST_CONFIG);
  
  PerformanceMonitor.clear();
  MemoryMonitor.start();
  TestDataGenerator.resetCounters();
  
  // Set up global test environment
  process.env.NODE_ENV = 'test';
  process.env.VITEST_RUNNING = 'true';
  
  // Increase timeout for CI environment
  if (TEST_CONFIG.IS_CI) {
    TestLogger.info('CI environment detected, increasing timeouts');
  }

  // Performance test mode setup
  if (TEST_CONFIG.IS_PERFORMANCE_TEST) {
    TestLogger.info('Performance test mode enabled');
    // Additional performance test setup can go here
  }

  TestLogger.info('Global setup completed');
});

afterAll(async () => {
  TestLogger.info('Marketplace test suite completed');
  
  // Generate performance report
  const perfReport = PerformanceMonitor.generateReport();
  if (Object.keys(perfReport).length > 0) {
    TestLogger.info('Performance report', perfReport);
  }
  
  // Generate memory report
  const memoryReport = MemoryMonitor.generateReport();
  TestLogger.info('Memory usage report', memoryReport);
  
  // Check for potential memory leaks
  const memoryIncrease = MemoryMonitor.getUsageIncreaseMB();
  if (memoryIncrease > TEST_CONFIG.MAX_MEMORY_MB) {
    TestLogger.warn(`Potential memory leak detected: ${memoryIncrease.toFixed(2)}MB increase`);
  }
  
  TestLogger.info('Global teardown completed');
});

beforeEach(() => {
  if (TEST_CONFIG.VERBOSE_TESTS) {
    TestLogger.info('Starting test');
  }
  
  // Reset counters for each test to ensure isolation
  TestDataGenerator.resetCounters();
});

afterEach(() => {
  // Force garbage collection if available
  if (global.gc && TEST_CONFIG.IS_PERFORMANCE_TEST) {
    global.gc();
  }
  
  if (TEST_CONFIG.VERBOSE_TESTS) {
    TestLogger.info('Test completed');
  }
});

// Export utilities for use in tests
export {
  TestLogger as Logger,
  PerformanceMonitor as PerfMonitor,
  MemoryMonitor as MemMonitor,
  TestDataGenerator as DataGen
};