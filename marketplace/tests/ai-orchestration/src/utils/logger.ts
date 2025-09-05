/**
 * Enhanced Logger Utility
 * Structured logging with multiple output targets
 */

import { writeFile, appendFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import { join } from 'path';

export class Logger {
  private context: string;
  private logLevel: LogLevel;
  private logFile?: string;
  private enableConsole: boolean;
  private enableFile: boolean;
  private enableStructured: boolean;

  constructor(
    context: string,
    options: LoggerOptions = {}
  ) {
    this.context = context;
    this.logLevel = options.level || LogLevel.INFO;
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.enableStructured = options.structured !== false;
    
    if (this.enableFile) {
      this.setupFileLogging(options.logDirectory);
    }
  }

  private async setupFileLogging(logDirectory = './logs'): Promise<void> {
    try {
      await mkdir(logDirectory, { recursive: true });
      const timestamp = new Date().toISOString().split('T')[0];
      this.logFile = join(logDirectory, `${this.context.toLowerCase()}-${timestamp}.log`);
    } catch (error) {
      console.error('Failed to setup file logging:', error);
      this.enableFile = false;
    }
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: any): void {
    const meta = error instanceof Error 
      ? { error: { name: error.name, message: error.message, stack: error.stack } }
      : { error };
    this.log(LogLevel.ERROR, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (level < this.logLevel) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      context: this.context,
      message,
      meta: meta || {},
      pid: process.pid
    };

    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.enableFile && this.logFile) {
      this.logToFile(logEntry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const colorMap: { [key: string]: string } = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
    };

    const resetColor = '\x1b[0m';
    const color = colorMap[entry.level] || '';
    
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const contextPadded = `[${entry.context}]`.padEnd(20);
    
    let logMessage = `${color}${timestamp} ${entry.level.padEnd(5)} ${contextPadded}${resetColor} ${entry.message}`;
    
    if (Object.keys(entry.meta).length > 0) {
      if (this.enableStructured) {
        logMessage += `\\n${JSON.stringify(entry.meta, null, 2)}`;
      } else {
        logMessage += ` ${JSON.stringify(entry.meta)}`;
      }
    }

    switch (entry.level) {
      case 'ERROR':
        console.error(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'DEBUG':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  private async logToFile(entry: LogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\\n';
      await appendFile(this.logFile!, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Performance logging
  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.debug(`Starting operation: ${operation}`);
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`Operation completed: ${operation}`, { duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`Operation failed: ${operation}`, { duration: `${duration.toFixed(2)}ms`, error });
      throw error;
    }
  }

  // Metric logging
  metric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    this.info(`Metric: ${name}`, {
      metric: {
        name,
        value,
        unit: unit || 'count',
        tags: tags || {}
      }
    });
  }

  // Audit logging
  audit(action: string, resource: string, user?: string, details?: any): void {
    this.info(`Audit: ${action}`, {
      audit: {
        action,
        resource,
        user: user || 'system',
        details: details || {},
        timestamp: new Date().toISOString()
      }
    });
  }

  // Create child logger with additional context
  child(childContext: string, additionalMeta?: Record<string, any>): Logger {
    const childLogger = new Logger(`${this.context}:${childContext}`, {
      level: this.logLevel,
      console: this.enableConsole,
      file: this.enableFile,
      structured: this.enableStructured
    });

    if (additionalMeta) {
      // Override log method to include additional metadata
      const originalLog = childLogger.log.bind(childLogger);
      (childLogger as any).log = (level: LogLevel, message: string, meta?: any) => {
        const combinedMeta = { ...additionalMeta, ...(meta || {}) };
        originalLog(level, message, combinedMeta);
      };
    }

    return childLogger;
  }

  // Health check logging
  healthCheck(component: string, status: 'healthy' | 'unhealthy' | 'degraded', details?: any): void {
    const level = status === 'healthy' ? LogLevel.INFO : 
                 status === 'degraded' ? LogLevel.WARN : LogLevel.ERROR;
    
    this.log(level, `Health check: ${component} is ${status}`, {
      healthCheck: {
        component,
        status,
        details: details || {},
        timestamp: new Date().toISOString()
      }
    });
  }

  // Request/Response logging for API calls
  apiCall(method: string, url: string, statusCode?: number, duration?: number, error?: any): void {
    const level = error ? LogLevel.ERROR : 
                 statusCode && statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    const message = `API ${method} ${url}`;
    const meta = {
      api: {
        method,
        url,
        statusCode,
        duration: duration ? `${duration.toFixed(2)}ms` : undefined,
        error: error ? (error instanceof Error ? error.message : error) : undefined
      }
    };

    this.log(level, message, meta);
  }

  // Database operation logging
  dbOperation(operation: string, table?: string, duration?: number, error?: any): void {
    const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
    const message = `DB ${operation}${table ? ` on ${table}` : ''}`;
    const meta = {
      database: {
        operation,
        table,
        duration: duration ? `${duration.toFixed(2)}ms` : undefined,
        error: error ? (error instanceof Error ? error.message : error) : undefined
      }
    };

    this.log(level, message, meta);
  }

  // Test execution logging
  testExecution(testId: string, status: 'started' | 'passed' | 'failed' | 'skipped', duration?: number, error?: any): void {
    const level = status === 'failed' ? LogLevel.ERROR :
                 status === 'skipped' ? LogLevel.WARN : LogLevel.INFO;
    
    const message = `Test ${status}: ${testId}`;
    const meta = {
      test: {
        testId,
        status,
        duration: duration ? `${duration}ms` : undefined,
        error: error ? (error instanceof Error ? error.message : error) : undefined
      }
    };

    this.log(level, message, meta);
  }
}

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LoggerOptions {
  level?: LogLevel;
  console?: boolean;
  file?: boolean;
  structured?: boolean;
  logDirectory?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  meta: any;
  pid: number;
}

// Utility function to create logger instances
export function createLogger(context: string, options?: LoggerOptions): Logger {
  return new Logger(context, options);
}

// Default logger instance
export const defaultLogger = new Logger('System');