/**
 * Enterprise Logging System
 * Implements structured logging, log rotation, and monitoring integration
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface LogLevel {
  name: 'debug' | 'info' | 'warn' | 'error' | 'security' | 'audit';
  value: number;
  color?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel['name'];
  service: string;
  message: string;
  data?: Record<string, any>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  metadata?: {
    hostname: string;
    pid: number;
    version: string;
    environment: string;
  };
}

export interface LoggerConfig {
  service: string;
  level: LogLevel['name'];
  outputs: Array<{
    type: 'console' | 'file' | 'remote' | 'database';
    config: any;
  }>;
  format: 'json' | 'text';
  enableColors: boolean;
  enableMetadata: boolean;
  enableCorrelation: boolean;
  retention: {
    days: number;
    maxSizeBytes: number;
    maxFiles: number;
  };
  redact: string[];
  sampling?: {
    enabled: boolean;
    rate: number;
  };
}

export class Logger {
  private config: LoggerConfig;
  private logLevels: Map<string, LogLevel>;
  private correlationContext = new Map<string, string>();
  private metricsCache = new Map<string, { count: number; lastReset: Date }>();

  constructor(config: Partial<LoggerConfig> & { service: string }) {
    this.config = {
      level: 'info',
      outputs: [
        { type: 'console', config: {} },
        { type: 'file', config: { filename: 'app.log' } }
      ],
      format: 'json',
      enableColors: true,
      enableMetadata: true,
      enableCorrelation: true,
      retention: {
        days: 30,
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
        maxFiles: 10
      },
      redact: ['password', 'token', 'apiKey', 'secret', 'privateKey'],
      sampling: {
        enabled: false,
        rate: 0.1
      },
      ...config
    };

    this.initializeLogLevels();
    this.startLogRotation();
    this.startMetricsReset();
  }

  /**
   * Initialize log levels with priorities
   */
  private initializeLogLevels(): void {
    this.logLevels = new Map([
      ['debug', { name: 'debug', value: 0, color: '\x1b[36m' }], // Cyan
      ['info', { name: 'info', value: 1, color: '\x1b[32m' }],   // Green
      ['warn', { name: 'warn', value: 2, color: '\x1b[33m' }],   // Yellow
      ['error', { name: 'error', value: 3, color: '\x1b[31m' }], // Red
      ['security', { name: 'security', value: 4, color: '\x1b[35m' }], // Magenta
      ['audit', { name: 'audit', value: 5, color: '\x1b[34m' }]  // Blue
    ]);
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel['name'],
    message: string,
    data?: Record<string, any>,
    options: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      traceId?: string;
    } = {}
  ): Promise<void> {
    const logLevel = this.logLevels.get(level);
    const configLevel = this.logLevels.get(this.config.level);
    
    if (!logLevel || !configLevel || logLevel.value < configLevel.value) {
      return; // Skip logging if level is below threshold
    }

    // Apply sampling if enabled
    if (this.config.sampling?.enabled && Math.random() > this.config.sampling.rate) {
      return;
    }

    const entry = await this.createLogEntry(level, message, data, options);
    await this.writeLog(entry);
    this.updateMetrics(level);
  }

  /**
   * Create structured log entry
   */
  private async createLogEntry(
    level: LogLevel['name'],
    message: string,
    data?: Record<string, any>,
    options: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      traceId?: string;
    } = {}
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      message,
      correlationId: options.correlationId || this.generateCorrelationId(),
      userId: options.userId,
      sessionId: options.sessionId,
      requestId: options.requestId,
      traceId: options.traceId
    };

    // Add sanitized data
    if (data) {
      entry.data = this.redactSensitiveData(data);
    }

    // Add metadata if enabled
    if (this.config.enableMetadata) {
      entry.metadata = {
        hostname: process.env.HOSTNAME || 'unknown',
        pid: process.pid,
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };
    }

    return entry;
  }

  /**
   * Write log to configured outputs
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    const formatted = this.formatLog(entry);
    
    await Promise.all(
      this.config.outputs.map(async (output) => {
        try {
          switch (output.type) {
            case 'console':
              await this.writeToConsole(formatted, entry.level);
              break;
            case 'file':
              await this.writeToFile(formatted, output.config);
              break;
            case 'remote':
              await this.writeToRemote(entry, output.config);
              break;
            case 'database':
              await this.writeToDatabase(entry, output.config);
              break;
          }
        } catch (error) {
          console.error(`Failed to write to ${output.type}:`, error);
        }
      })
    );
  }

  /**
   * Format log entry based on configuration
   */
  private formatLog(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry) + '\n';
    } else {
      const timestamp = entry.timestamp;
      const level = entry.level.toUpperCase().padEnd(8);
      const service = entry.service.padEnd(12);
      const message = entry.message;
      const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
      
      return `${timestamp} [${level}] ${service} ${message}${data}\n`;
    }
  }

  /**
   * Console output with colors
   */
  private async writeToConsole(formatted: string, level: LogLevel['name']): Promise<void> {
    const logLevel = this.logLevels.get(level);
    const color = this.config.enableColors && logLevel?.color ? logLevel.color : '';
    const reset = this.config.enableColors ? '\x1b[0m' : '';
    
    const output = level === 'error' || level === 'security' ? process.stderr : process.stdout;
    output.write(`${color}${formatted}${reset}`);
  }

  /**
   * File output with rotation
   */
  private async writeToFile(formatted: string, config: any): Promise<void> {
    const filename = config.filename || 'app.log';
    const logDir = config.directory || './logs';
    const logPath = path.join(logDir, filename);

    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });

    // Check if rotation is needed
    try {
      const stats = await fs.stat(logPath);
      if (stats.size > this.config.retention.maxSizeBytes) {
        await this.rotateLogFile(logPath);
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
    }

    // Append to log file
    await fs.appendFile(logPath, formatted);
  }

  /**
   * Remote logging (webhook/API)
   */
  private async writeToRemote(entry: LogEntry, config: any): Promise<void> {
    const url = config.url;
    const headers = config.headers || { 'Content-Type': 'application/json' };
    const timeout = config.timeout || 5000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(entry),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Database logging (placeholder - implement based on your database)
   */
  private async writeToDatabase(entry: LogEntry, config: any): Promise<void> {
    // This would be implemented based on your specific database
    // For example, using a connection pool to insert into a logs table
    console.log('Database logging not implemented:', entry);
  }

  /**
   * Public logging methods
   */
  async debug(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('debug', message, data);
  }

  async info(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('info', message, data);
  }

  async warn(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('warn', message, data);
  }

  async error(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('error', message, data);
  }

  async security(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('security', message, data);
  }

  async audit(message: string, data?: Record<string, any>): Promise<void> {
    return this.log('audit', message, data);
  }

  /**
   * Contextual logging with correlation
   */
  withContext(context: {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
  }) {
    return {
      debug: (message: string, data?: Record<string, any>) => 
        this.log('debug', message, data, context),
      info: (message: string, data?: Record<string, any>) => 
        this.log('info', message, data, context),
      warn: (message: string, data?: Record<string, any>) => 
        this.log('warn', message, data, context),
      error: (message: string, data?: Record<string, any>) => 
        this.log('error', message, data, context),
      security: (message: string, data?: Record<string, any>) => 
        this.log('security', message, data, context),
      audit: (message: string, data?: Record<string, any>) => 
        this.log('audit', message, data, context)
    };
  }

  /**
   * Performance timing
   */
  time(label: string, data?: Record<string, any>): () => Promise<void> {
    const start = process.hrtime.bigint();
    const correlationId = this.generateCorrelationId();
    
    this.info(`Timer started: ${label}`, { ...data, correlationId });
    
    return async () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      
      await this.info(`Timer ended: ${label}`, {
        ...data,
        correlationId,
        duration: `${duration.toFixed(2)}ms`
      });
    };
  }

  /**
   * Batch logging for high-volume scenarios
   */
  async batch(entries: Array<{
    level: LogLevel['name'];
    message: string;
    data?: Record<string, any>;
  }>): Promise<void> {
    const logEntries = await Promise.all(
      entries.map(entry => this.createLogEntry(entry.level, entry.message, entry.data))
    );

    // Write all entries in parallel
    await Promise.all(
      logEntries.map(entry => this.writeLog(entry))
    );

    // Update metrics
    entries.forEach(entry => this.updateMetrics(entry.level));
  }

  /**
   * Log file rotation
   */
  private async rotateLogFile(logPath: string): Promise<void> {
    const dir = path.dirname(logPath);
    const basename = path.basename(logPath, path.extname(logPath));
    const extension = path.extname(logPath);
    
    // Find existing rotated files
    const files = await fs.readdir(dir);
    const rotatedFiles = files
      .filter(file => file.startsWith(`${basename}.`) && file.endsWith(extension))
      .map(file => {
        const match = file.match(/\.(\d+)\./);
        return { filename: file, index: match ? parseInt(match[1]) : 0 };
      })
      .sort((a, b) => b.index - a.index);

    // Remove old files exceeding retention policy
    const filesToRemove = rotatedFiles.slice(this.config.retention.maxFiles - 1);
    await Promise.all(
      filesToRemove.map(file => fs.unlink(path.join(dir, file.filename)))
    );

    // Rotate existing files
    for (const file of rotatedFiles.slice(0, this.config.retention.maxFiles - 1)) {
      const oldPath = path.join(dir, file.filename);
      const newIndex = file.index + 1;
      const newFilename = `${basename}.${newIndex}${extension}`;
      const newPath = path.join(dir, newFilename);
      await fs.rename(oldPath, newPath);
    }

    // Move current log file to .1
    const rotatedPath = path.join(dir, `${basename}.1${extension}`);
    await fs.rename(logPath, rotatedPath);
  }

  /**
   * Start automatic log rotation
   */
  private startLogRotation(): void {
    // Check for rotation every hour
    setInterval(async () => {
      await this.cleanupOldLogs();
    }, 60 * 60 * 1000);
  }

  /**
   * Cleanup old logs based on retention policy
   */
  private async cleanupOldLogs(): Promise<void> {
    const logDir = './logs';
    const cutoffDate = new Date(Date.now() - this.config.retention.days * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.readdir(logDir);
      
      for (const filename of files) {
        const filepath = path.join(logDir, filename);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          await this.info('Log file cleaned up', { filename, age: stats.mtime });
        }
      }
    } catch (error) {
      await this.warn('Log cleanup failed', { error: error.message });
    }
  }

  /**
   * Redact sensitive data
   */
  private redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    const result = { ...data };
    
    for (const [key, value] of Object.entries(result)) {
      const lowerKey = key.toLowerCase();
      const shouldRedact = this.config.redact.some(pattern => 
        lowerKey.includes(pattern.toLowerCase())
      );

      if (shouldRedact) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactSensitiveData(value);
      }
    }

    return result;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Update metrics
   */
  private updateMetrics(level: LogLevel['name']): void {
    const key = `log_${level}`;
    const existing = this.metricsCache.get(key);
    
    if (existing) {
      existing.count++;
    } else {
      this.metricsCache.set(key, { count: 1, lastReset: new Date() });
    }
  }

  /**
   * Start metrics reset cycle
   */
  private startMetricsReset(): void {
    // Reset metrics every hour
    setInterval(() => {
      this.metricsCache.clear();
    }, 60 * 60 * 1000);
  }

  /**
   * Get logging statistics
   */
  getStatistics(): {
    metrics: Record<string, number>;
    configuration: Partial<LoggerConfig>;
    performance: {
      averageLogTime: number;
      logsPerSecond: number;
    };
  } {
    const metrics: Record<string, number> = {};
    for (const [key, value] of this.metricsCache.entries()) {
      metrics[key] = value.count;
    }

    return {
      metrics,
      configuration: {
        service: this.config.service,
        level: this.config.level,
        format: this.config.format,
        outputs: this.config.outputs.map(o => ({ type: o.type }))
      },
      performance: {
        averageLogTime: 0, // Would implement timing tracking
        logsPerSecond: 0   // Would implement rate calculation
      }
    };
  }

  /**
   * Query logs (basic implementation)
   */
  async query(options: {
    level?: LogLevel['name'];
    service?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
    search?: string;
  } = {}): Promise<LogEntry[]> {
    // This would be implemented based on your storage mechanism
    // For file-based logs, you'd parse the files
    // For database logs, you'd query the database
    // This is a placeholder implementation
    
    return [];
  }

  /**
   * Create child logger with inherited context
   */
  child(context: { service?: string; correlationId?: string }): Logger {
    const childConfig = {
      ...this.config,
      service: context.service || `${this.config.service}:child`
    };

    const childLogger = new Logger(childConfig);
    
    if (context.correlationId) {
      childLogger.correlationContext.set('default', context.correlationId);
    }

    return childLogger;
  }
}