import { EventEmitter } from 'events';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  context?: {
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    service: string;
  };
  stack?: string;
}

interface LoggerConfig {
  level: LogLevel;
  outputs: Array<'console' | 'file' | 'memory'>;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  format?: 'json' | 'text';
}

export class Logger extends EventEmitter {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private currentFileSize: number = 0;
  private fileIndex: number = 0;
  
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  private static readonly LOG_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    fatal: '\x1b[35m'  // Magenta
  };

  constructor(level: LogLevel = 'info', config?: Partial<LoggerConfig>) {
    super();
    
    this.config = {
      level,
      outputs: ['console'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableColors: true,
      enableTimestamp: true,
      format: 'text',
      ...config
    };

    this.initializeFileLogging();
  }

  private initializeFileLogging(): void {
    if (this.config.outputs.includes('file') && this.config.filePath) {
      const dir = this.config.filePath.substring(0, this.config.filePath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LOG_LEVELS[level] >= Logger.LOG_LEVELS[this.config.level];
  }

  private createLogEntry(
    level: LogLevel, 
    message: string, 
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata,
      context: {
        service: 'unified-orchestrator',
        traceId: metadata?.traceId,
        spanId: metadata?.spanId,
        userId: metadata?.userId,
        sessionId: metadata?.sessionId
      }
    };

    if (error && error.stack) {
      entry.stack = error.stack;
    }

    return entry;
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    const timestamp = this.config.enableTimestamp ? 
      `[${entry.timestamp.toISOString()}] ` : '';
    
    const level = this.config.enableColors ? 
      `${Logger.LOG_COLORS[entry.level]}${entry.level.toUpperCase()}\x1b[0m` :
      entry.level.toUpperCase();

    const context = entry.context?.traceId ? 
      ` [${entry.context.traceId}]` : '';

    let formatted = `${timestamp}${level}:${context} ${entry.message}`;

    if (entry.metadata) {
      formatted += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.stack) {
      formatted += `\n${entry.stack}`;
    }

    return formatted;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.config.filePath) return;

    const logLine = this.formatLogEntry(entry) + '\n';
    const logSize = Buffer.byteLength(logLine, 'utf8');

    // Check if we need to rotate the file
    if (this.currentFileSize + logSize > this.config.maxFileSize!) {
      this.rotateLogFile();
    }

    try {
      appendFileSync(this.getActiveLogFile(), logLine);
      this.currentFileSize += logSize;
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private rotateLogFile(): void {
    if (!this.config.filePath) return;

    const activeFile = this.getActiveLogFile();
    const rotatedFile = this.getRotatedLogFile();

    try {
      // Move current log to rotated file
      if (existsSync(activeFile)) {
        writeFileSync(rotatedFile, '');
      }

      this.fileIndex = (this.fileIndex + 1) % this.config.maxFiles!;
      this.currentFileSize = 0;
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private getActiveLogFile(): string {
    return this.config.filePath!;
  }

  private getRotatedLogFile(): string {
    const path = this.config.filePath!;
    const ext = path.substring(path.lastIndexOf('.'));
    const base = path.substring(0, path.lastIndexOf('.'));
    return `${base}.${this.fileIndex}${ext}`;
  }

  private output(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry);

    if (this.config.outputs.includes('console')) {
      console.log(formatted);
    }

    if (this.config.outputs.includes('file')) {
      this.writeToFile(entry);
    }

    if (this.config.outputs.includes('memory')) {
      this.logBuffer.push(entry);
      
      // Keep buffer size manageable
      if (this.logBuffer.length > 1000) {
        this.logBuffer = this.logBuffer.slice(-500);
      }
    }

    this.emit('log', entry);
  }

  // Public logging methods
  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createLogEntry('debug', message, metadata);
    this.output(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createLogEntry('info', message, metadata);
    this.output(entry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createLogEntry('warn', message, metadata);
    this.output(entry);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createLogEntry('error', message, metadata, error);
    this.output(entry);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('fatal')) return;
    const entry = this.createLogEntry('fatal', message, metadata, error);
    this.output(entry);
  }

  // Structured logging with context
  withContext(context: Record<string, any>): Logger {
    const contextualLogger = new Logger(this.config.level, this.config);
    
    // Override the createLogEntry method to include context
    const originalCreateLogEntry = contextualLogger.createLogEntry.bind(contextualLogger);
    contextualLogger.createLogEntry = (level, message, metadata?, error?) => {
      const mergedMetadata = { ...context, ...metadata };
      return originalCreateLogEntry(level, message, mergedMetadata, error);
    };

    return contextualLogger;
  }

  // Query and analysis methods
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let logs = this.logBuffer.slice(-count);
    
    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }

    return logs.reverse(); // Most recent first
  }

  searchLogs(query: string, options?: {
    level?: LogLevel;
    since?: Date;
    until?: Date;
    limit?: number;
  }): LogEntry[] {
    let results = this.logBuffer;

    // Filter by level
    if (options?.level) {
      results = results.filter(entry => entry.level === options.level);
    }

    // Filter by time range
    if (options?.since) {
      results = results.filter(entry => entry.timestamp >= options.since!);
    }

    if (options?.until) {
      results = results.filter(entry => entry.timestamp <= options.until!);
    }

    // Search in message and metadata
    const lowerQuery = query.toLowerCase();
    results = results.filter(entry => {
      const message = entry.message.toLowerCase();
      const metadata = JSON.stringify(entry.metadata || {}).toLowerCase();
      return message.includes(lowerQuery) || metadata.includes(lowerQuery);
    });

    // Apply limit
    if (options?.limit) {
      results = results.slice(-options.limit);
    }

    return results.reverse();
  }

  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    recentErrors: LogEntry[];
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0
      } as Record<LogLevel, number>,
      recentErrors: [] as LogEntry[],
      oldestEntry: undefined as Date | undefined,
      newestEntry: undefined as Date | undefined
    };

    if (this.logBuffer.length === 0) {
      return stats;
    }

    stats.oldestEntry = this.logBuffer[0].timestamp;
    stats.newestEntry = this.logBuffer[this.logBuffer.length - 1].timestamp;

    for (const entry of this.logBuffer) {
      stats.byLevel[entry.level]++;
      
      if ((entry.level === 'error' || entry.level === 'fatal') && 
          stats.recentErrors.length < 10) {
        stats.recentErrors.push(entry);
      }
    }

    return stats;
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  addOutput(output: 'console' | 'file' | 'memory'): void {
    if (!this.config.outputs.includes(output)) {
      this.config.outputs.push(output);
    }
  }

  removeOutput(output: 'console' | 'file' | 'memory'): void {
    this.config.outputs = this.config.outputs.filter(o => o !== output);
  }

  // Cleanup
  clearBuffer(): void {
    this.logBuffer = [];
  }

  async flush(): Promise<void> {
    // In a real implementation, this would ensure all pending writes are completed
    return Promise.resolve();
  }
}