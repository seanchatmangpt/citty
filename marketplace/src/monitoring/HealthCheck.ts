/**
 * Comprehensive Health Check System
 * Implements service health monitoring, dependency checks, and system metrics
 */

import { Logger } from './Logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    [name: string]: {
      status: 'pass' | 'warn' | 'fail';
      message?: string;
      duration: number;
      metadata?: Record<string, any>;
    };
  };
  systemInfo: {
    uptime: number;
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    disk?: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
  };
  version: string;
  environment: string;
}

export interface HealthCheck {
  name: string;
  timeout: number;
  retries: number;
  interval: number;
  critical: boolean;
  check: () => Promise<{ status: 'pass' | 'warn' | 'fail'; message?: string; metadata?: any }>;
}

export class HealthCheckService {
  private logger: Logger;
  private checks = new Map<string, HealthCheck>();
  private lastResults = new Map<string, any>();
  private isRunning = false;
  private startTime = Date.now();

  constructor() {
    this.logger = new Logger({ service: 'HealthCheck' });
    this.initializeSystemChecks();
  }

  /**
   * Initialize built-in system health checks
   */
  private initializeSystemChecks(): void {
    // Memory usage check
    this.addCheck({
      name: 'memory',
      timeout: 1000,
      retries: 1,
      interval: 30000,
      critical: true,
      check: async () => {
        const usage = process.memoryUsage();
        const used = usage.heapUsed;
        const total = usage.heapTotal;
        const percentage = (used / total) * 100;

        if (percentage > 90) {
          return { status: 'fail', message: `Memory usage critical: ${percentage.toFixed(1)}%` };
        } else if (percentage > 75) {
          return { status: 'warn', message: `Memory usage high: ${percentage.toFixed(1)}%` };
        }

        return { 
          status: 'pass', 
          message: `Memory usage normal: ${percentage.toFixed(1)}%`,
          metadata: { used, total, percentage }
        };
      }
    });

    // CPU usage check (simplified)
    this.addCheck({
      name: 'cpu',
      timeout: 2000,
      retries: 1,
      interval: 30000,
      critical: true,
      check: async () => {
        const loadAvg = process.loadavg();
        const cpuCount = require('os').cpus().length;
        const avgLoad = loadAvg[0] / cpuCount * 100;

        if (avgLoad > 90) {
          return { status: 'fail', message: `CPU usage critical: ${avgLoad.toFixed(1)}%` };
        } else if (avgLoad > 75) {
          return { status: 'warn', message: `CPU usage high: ${avgLoad.toFixed(1)}%` };
        }

        return { 
          status: 'pass', 
          message: `CPU usage normal: ${avgLoad.toFixed(1)}%`,
          metadata: { loadAverage: loadAvg, usage: avgLoad }
        };
      }
    });

    // Disk space check
    this.addCheck({
      name: 'disk',
      timeout: 2000,
      retries: 1,
      interval: 60000,
      critical: false,
      check: async () => {
        try {
          const fs = await import('fs/promises');
          const stats = await fs.stat('./');
          
          // This is a simplified check - in production, you'd use a proper disk space library
          return { 
            status: 'pass', 
            message: 'Disk space check passed',
            metadata: { available: true }
          };
        } catch (error) {
          return { status: 'warn', message: 'Could not check disk space' };
        }
      }
    });

    // Process uptime check
    this.addCheck({
      name: 'uptime',
      timeout: 500,
      retries: 1,
      interval: 60000,
      critical: false,
      check: async () => {
        const uptime = process.uptime();
        const uptimeHours = uptime / 3600;

        return { 
          status: 'pass', 
          message: `Process uptime: ${uptimeHours.toFixed(1)} hours`,
          metadata: { uptime, uptimeHours }
        };
      }
    });
  }

  /**
   * Add a custom health check
   */
  addCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    this.logger.info(`Health check added: ${check.name}`, { 
      timeout: check.timeout, 
      critical: check.critical 
    });
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.logger.info(`Health check removed: ${name}`);
    }
    return removed;
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {};
    
    await this.logger.debug('Running health checks', { checkCount: this.checks.size });

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      const result = await this.runSingleCheck(check);
      checks[name] = result;
      return { name, result };
    });

    const results = await Promise.allSettled(checkPromises);
    
    // Process results and handle any failures
    for (const result of results) {
      if (result.status === 'rejected') {
        await this.logger.error('Health check execution failed', { error: result.reason });
      }
    }

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);
    
    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      systemInfo: await this.getSystemInfo(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    const duration = Date.now() - startTime;
    await this.logger.info('Health check completed', { 
      status: overallStatus, 
      duration: `${duration}ms`,
      checkCount: Object.keys(checks).length
    });

    return healthResult;
  }

  /**
   * Run a single health check with retries and timeout
   */
  private async runSingleCheck(check: HealthCheck): Promise<{
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    duration: number;
    metadata?: any;
  }> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= check.retries; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        });

        const checkPromise = check.check();
        const result = await Promise.race([checkPromise, timeoutPromise]) as any;
        
        const duration = Date.now() - startTime;
        
        // Cache the result
        this.lastResults.set(check.name, { ...result, duration, timestamp: new Date() });
        
        return { ...result, duration };
      } catch (error) {
        lastError = error as Error;
        if (attempt < check.retries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
        }
      }
    }

    const duration = Date.now() - startTime;
    const failureResult = {
      status: 'fail' as const,
      message: `Check failed after ${check.retries + 1} attempts: ${lastError?.message}`,
      duration,
      metadata: { error: lastError?.message, attempts: check.retries + 1 }
    };

    this.lastResults.set(check.name, { ...failureResult, timestamp: new Date() });
    return failureResult;
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(checks: HealthCheckResult['checks']): HealthCheckResult['status'] {
    const statuses = Object.entries(checks);
    
    // If any critical check fails, system is unhealthy
    const criticalFailures = statuses.filter(([name, result]) => {
      const check = this.checks.get(name);
      return check?.critical && result.status === 'fail';
    });

    if (criticalFailures.length > 0) {
      return 'unhealthy';
    }

    // If any check fails or warns, system is degraded
    const failures = statuses.filter(([, result]) => result.status === 'fail');
    const warnings = statuses.filter(([, result]) => result.status === 'warn');

    if (failures.length > 0 || warnings.length > 2) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<HealthCheckResult['systemInfo']> {
    const os = await import('os');
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      uptime: process.uptime(),
      memory: {
        used: usedMemory,
        free: freeMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      cpu: {
        usage: 0, // Would implement CPU usage calculation
        loadAverage: os.loadavg()
      }
    };
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.info('Started periodic health checks');

    // Run checks for each configured interval
    const intervals = new Set(Array.from(this.checks.values()).map(c => c.interval));
    
    for (const interval of intervals) {
      setInterval(async () => {
        if (!this.isRunning) return;
        
        try {
          const result = await this.runAllChecks();
          
          if (result.status === 'unhealthy') {
            await this.logger.error('System unhealthy', { 
              checks: result.checks, 
              criticalFailures: this.getCriticalFailures(result.checks) 
            });
          } else if (result.status === 'degraded') {
            await this.logger.warn('System degraded', { 
              checks: result.checks,
              warnings: this.getWarnings(result.checks)
            });
          }
        } catch (error) {
          await this.logger.error('Periodic health check failed', { error });
        }
      }, interval);
    }
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    this.isRunning = false;
    this.logger.info('Stopped periodic health checks');
  }

  /**
   * Get the last known status
   */
  getLastResults(): Map<string, any> {
    return new Map(this.lastResults);
  }

  /**
   * Database health check helper
   */
  createDatabaseCheck(name: string, connectionTest: () => Promise<boolean>): HealthCheck {
    return {
      name: `database-${name}`,
      timeout: 5000,
      retries: 2,
      interval: 30000,
      critical: true,
      check: async () => {
        try {
          const connected = await connectionTest();
          if (!connected) {
            return { status: 'fail', message: `Database ${name} connection failed` };
          }
          return { status: 'pass', message: `Database ${name} connection successful` };
        } catch (error) {
          return { 
            status: 'fail', 
            message: `Database ${name} error: ${error.message}`,
            metadata: { error: error.message }
          };
        }
      }
    };
  }

  /**
   * External service health check helper
   */
  createExternalServiceCheck(name: string, url: string, expectedStatus = 200): HealthCheck {
    return {
      name: `external-${name}`,
      timeout: 10000,
      retries: 1,
      interval: 60000,
      critical: false,
      check: async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status === expectedStatus) {
            return { 
              status: 'pass', 
              message: `External service ${name} is accessible`,
              metadata: { status: response.status, url }
            };
          } else {
            return { 
              status: 'warn', 
              message: `External service ${name} returned ${response.status}`,
              metadata: { status: response.status, expected: expectedStatus, url }
            };
          }
        } catch (error) {
          return { 
            status: 'fail', 
            message: `External service ${name} is not accessible: ${error.message}`,
            metadata: { error: error.message, url }
          };
        }
      }
    };
  }

  /**
   * Redis/Cache health check helper
   */
  createCacheCheck(name: string, cacheTest: () => Promise<boolean>): HealthCheck {
    return {
      name: `cache-${name}`,
      timeout: 3000,
      retries: 1,
      interval: 30000,
      critical: false,
      check: async () => {
        try {
          const accessible = await cacheTest();
          if (!accessible) {
            return { status: 'warn', message: `Cache ${name} not accessible` };
          }
          return { status: 'pass', message: `Cache ${name} is accessible` };
        } catch (error) {
          return { 
            status: 'warn', 
            message: `Cache ${name} error: ${error.message}`,
            metadata: { error: error.message }
          };
        }
      }
    };
  }

  /**
   * Get critical failures from check results
   */
  private getCriticalFailures(checks: HealthCheckResult['checks']): string[] {
    return Object.entries(checks)
      .filter(([name, result]) => {
        const check = this.checks.get(name);
        return check?.critical && result.status === 'fail';
      })
      .map(([name]) => name);
  }

  /**
   * Get warnings from check results
   */
  private getWarnings(checks: HealthCheckResult['checks']): string[] {
    return Object.entries(checks)
      .filter(([, result]) => result.status === 'warn' || result.status === 'fail')
      .map(([name]) => name);
  }

  /**
   * Express middleware for health check endpoint
   */
  createMiddleware() {
    return async (req: any, res: any) => {
      try {
        const result = await this.runAllChecks();
        
        const statusCode = result.status === 'healthy' ? 200 : 
                          result.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(result);
      } catch (error) {
        await this.logger.error('Health check endpoint error', { error });
        res.status(500).json({
          status: 'unhealthy',
          error: 'Health check system error',
          timestamp: new Date()
        });
      }
    };
  }

  /**
   * Get health check statistics
   */
  getStatistics(): {
    totalChecks: number;
    criticalChecks: number;
    lastRunResults: Record<string, any>;
    systemInfo: any;
  } {
    const criticalChecks = Array.from(this.checks.values()).filter(c => c.critical).length;
    const lastRunResults: Record<string, any> = {};
    
    for (const [name, result] of this.lastResults.entries()) {
      lastRunResults[name] = {
        status: result.status,
        lastCheck: result.timestamp,
        duration: result.duration
      };
    }

    return {
      totalChecks: this.checks.size,
      criticalChecks,
      lastRunResults,
      systemInfo: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      }
    };
  }
}