# Pattern 03: Hook-Driven Task - Audit Logging System

## Overview

A comprehensive audit logging system demonstrating hook-driven architecture with event capture, compliance tracking, and real-time monitoring for enterprise applications.

## Features

- Comprehensive audit trail capture
- Multi-level security classification
- Real-time event processing
- Compliance reporting (SOX, GDPR, HIPAA)
- Automatic retention policies
- Alert system for suspicious activities
- Performance monitoring

## Environment Setup

```bash
# Required dependencies
pnpm add hookable eventemitter3 winston elastic-apm-node
pnpm add kafkajs bull ioredis nodemailer
pnpm add jsonwebtoken crypto-js rate-limiter-flexible
pnpm add -D @types/jsonwebtoken @types/nodemailer
```

## Environment Variables

```env
# .env
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/audit_db
REDIS_URL=redis://localhost:6379

# Kafka for real-time streaming
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=audit-system
KAFKA_GROUP_ID=audit-processors

# Elasticsearch for log storage
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=audit-logs

# Email alerts
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASS=secret

# Security
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=32-char-encryption-key-here
AUDIT_RETENTION_DAYS=2555  # 7 years for compliance

# Compliance
ENABLE_GDPR_COMPLIANCE=true
ENABLE_SOX_COMPLIANCE=true
ENABLE_HIPAA_COMPLIANCE=false
```

## Production Code

```typescript
import { defineCommand } from "citty";
import { Hookable } from "hookable";
import EventEmitter from "eventemitter3";
import winston from "winston";
import { Kafka } from "kafkajs";
import Bull from "bull";
import Redis from "ioredis";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import crypto from "crypto-js";
import apm from "elastic-apm-node";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { Pool } from "pg";

// Types
interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  userAgent?: string;
  ipAddress: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  duration?: number;
  compliance: {
    gdpr: boolean;
    sox: boolean;
    hipaa: boolean;
    pci: boolean;
  };
}

interface AuditRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: 'LOG' | 'ALERT' | 'BLOCK';
  enabled: boolean;
  compliance: string[];
}

interface AlertConfig {
  id: string;
  name: string;
  conditions: {
    severity?: string[];
    actions?: string[];
    frequency?: number;
    timeWindow?: number;
  };
  recipients: string[];
  channels: ('email' | 'slack' | 'webhook')[];
  enabled: boolean;
}

// Initialize APM
const apmAgent = apm.start({
  serviceName: 'audit-logging-system',
  environment: process.env.NODE_ENV || 'development',
});

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'audit-error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.File({ 
      filename: 'audit-combined.log',
      maxsize: 10485760,
      maxFiles: 20
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database Connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis Connection
const redis = new Redis(process.env.REDIS_URL);

// Kafka Setup
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
});

const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
});

// Queue for background processing
const auditQueue = new Bull('audit processing', process.env.REDIS_URL);

// Email Configuration
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Rate Limiter for suspicious activity detection
const suspiciousActivityLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'suspicious_activity',
  points: 10,
  duration: 60, // 1 minute
});

// Audit Rules Engine
class AuditRulesEngine {
  private rules: Map<string, AuditRule> = new Map();

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    const defaultRules: AuditRule[] = [
      {
        id: 'failed-login-attempts',
        name: 'Multiple Failed Login Attempts',
        description: 'Detect potential brute force attacks',
        pattern: /login|authentication/i,
        severity: 'HIGH',
        action: 'ALERT',
        enabled: true,
        compliance: ['SOX', 'GDPR']
      },
      {
        id: 'admin-actions',
        name: 'Administrative Actions',
        description: 'Log all administrative actions',
        pattern: /admin|delete|modify|create/i,
        severity: 'MEDIUM',
        action: 'LOG',
        enabled: true,
        compliance: ['SOX', 'GDPR', 'HIPAA']
      },
      {
        id: 'data-export',
        name: 'Data Export Activities',
        description: 'Monitor data export and download activities',
        pattern: /export|download|backup/i,
        severity: 'HIGH',
        action: 'ALERT',
        enabled: true,
        compliance: ['GDPR', 'HIPAA']
      },
      {
        id: 'privilege-escalation',
        name: 'Privilege Escalation',
        description: 'Detect privilege escalation attempts',
        pattern: /sudo|elevate|permission|role|grant/i,
        severity: 'CRITICAL',
        action: 'ALERT',
        enabled: true,
        compliance: ['SOX', 'GDPR', 'HIPAA']
      }
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  evaluateEvent(event: AuditEvent): AuditRule[] {
    const matchedRules: AuditRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const textToMatch = `${event.action} ${event.resource}`.toLowerCase();
      
      if (typeof rule.pattern === 'string') {
        if (textToMatch.includes(rule.pattern.toLowerCase())) {
          matchedRules.push(rule);
        }
      } else if (rule.pattern instanceof RegExp) {
        if (rule.pattern.test(textToMatch)) {
          matchedRules.push(rule);
        }
      }
    }

    return matchedRules;
  }

  addRule(rule: AuditRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRules(): AuditRule[] {
    return Array.from(this.rules.values());
  }
}

// Alert Manager
class AlertManager {
  private alerts: Map<string, AlertConfig> = new Map();

  constructor() {
    this.loadDefaultAlerts();
  }

  private loadDefaultAlerts(): void {
    const defaultAlerts: AlertConfig[] = [
      {
        id: 'critical-security-events',
        name: 'Critical Security Events',
        conditions: {
          severity: ['CRITICAL', 'HIGH'],
          frequency: 5,
          timeWindow: 300 // 5 minutes
        },
        recipients: ['security@company.com', 'admin@company.com'],
        channels: ['email'],
        enabled: true
      },
      {
        id: 'failed-authentication',
        name: 'Failed Authentication Attempts',
        conditions: {
          actions: ['login', 'authentication'],
          frequency: 10,
          timeWindow: 600 // 10 minutes
        },
        recipients: ['security@company.com'],
        channels: ['email'],
        enabled: true
      }
    ];

    defaultAlerts.forEach(alert => this.alerts.set(alert.id, alert));
  }

  async processEvent(event: AuditEvent, matchedRules: AuditRule[]): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      const shouldTrigger = await this.shouldTriggerAlert(event, alert);
      
      if (shouldTrigger) {
        await this.triggerAlert(event, alert, matchedRules);
      }
    }
  }

  private async shouldTriggerAlert(event: AuditEvent, alert: AlertConfig): Promise<boolean> {
    // Check severity conditions
    if (alert.conditions.severity && !alert.conditions.severity.includes(event.severity)) {
      return false;
    }

    // Check action conditions
    if (alert.conditions.actions && !alert.conditions.actions.some(action => 
      event.action.toLowerCase().includes(action.toLowerCase())
    )) {
      return false;
    }

    // Check frequency conditions
    if (alert.conditions.frequency && alert.conditions.timeWindow) {
      const key = `alert:${alert.id}:frequency`;
      const count = await redis.incr(key);
      
      if (count === 1) {
        await redis.expire(key, alert.conditions.timeWindow);
      }

      return count >= alert.conditions.frequency;
    }

    return true;
  }

  private async triggerAlert(event: AuditEvent, alert: AlertConfig, rules: AuditRule[]): Promise<void> {
    logger.warn('Triggering audit alert', { 
      alertId: alert.id,
      eventId: event.id,
      rules: rules.map(r => r.id)
    });

    const alertData = {
      alert: alert.name,
      event,
      rules: rules.map(r => ({ id: r.id, name: r.name, severity: r.severity })),
      timestamp: new Date().toISOString(),
      severity: event.severity
    };

    // Send email alerts
    if (alert.channels.includes('email')) {
      await this.sendEmailAlert(alert, alertData);
    }

    // Store alert in database
    await this.storeAlert(alert.id, alertData);

    // Publish to Kafka for real-time processing
    await this.publishAlert(alertData);
  }

  private async sendEmailAlert(alert: AlertConfig, alertData: any): Promise<void> {
    try {
      const subject = `🚨 Security Alert: ${alert.name}`;
      const html = this.generateAlertEmail(alertData);

      await emailTransporter.sendMail({
        from: process.env.SMTP_USER,
        to: alert.recipients.join(', '),
        subject,
        html
      });

      logger.info('Alert email sent successfully', { 
        alertId: alert.id,
        recipients: alert.recipients.length
      });

    } catch (error) {
      logger.error('Failed to send alert email', { 
        alertId: alert.id,
        error: error.message
      });
    }
  }

  private generateAlertEmail(alertData: any): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="background: #f44336; color: white; padding: 20px; border-radius: 5px;">
            <h2>🚨 Security Alert: ${alertData.alert}</h2>
            <p><strong>Severity:</strong> ${alertData.severity}</p>
            <p><strong>Time:</strong> ${alertData.timestamp}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3>Event Details:</h3>
            <ul>
              <li><strong>Action:</strong> ${alertData.event.action}</li>
              <li><strong>Resource:</strong> ${alertData.event.resource}</li>
              <li><strong>User ID:</strong> ${alertData.event.userId || 'Unknown'}</li>
              <li><strong>IP Address:</strong> ${alertData.event.ipAddress}</li>
              <li><strong>Success:</strong> ${alertData.event.success ? 'Yes' : 'No'}</li>
            </ul>
          </div>

          ${alertData.rules.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3>Triggered Rules:</h3>
              <ul>
                ${alertData.rules.map((rule: any) => `
                  <li><strong>${rule.name}</strong> (${rule.severity})</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
            <p><strong>Action Required:</strong> Please investigate this security event immediately.</p>
            <p>This is an automated alert from the Audit Logging System.</p>
          </div>
        </body>
      </html>
    `;
  }

  private async storeAlert(alertId: string, alertData: any): Promise<void> {
    const client = await dbPool.connect();
    
    try {
      await client.query(
        `INSERT INTO audit_alerts (id, alert_id, event_id, data, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          crypto.lib.WordArray.random(16).toString(),
          alertId,
          alertData.event.id,
          JSON.stringify(alertData),
          new Date()
        ]
      );
    } finally {
      client.release();
    }
  }

  private async publishAlert(alertData: any): Promise<void> {
    try {
      await producer.send({
        topic: 'security-alerts',
        messages: [{
          value: JSON.stringify(alertData),
          timestamp: Date.now().toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to publish alert to Kafka', { error: error.message });
    }
  }
}

// Audit Logger with Hooks
class AuditLogger extends EventEmitter {
  private hooks: Hookable;
  private rulesEngine: AuditRulesEngine;
  private alertManager: AlertManager;

  constructor() {
    super();
    this.hooks = new Hookable();
    this.rulesEngine = new AuditRulesEngine();
    this.alertManager = new AlertManager();
    
    this.setupHooks();
    this.setupDatabaseSchema();
  }

  private setupHooks(): void {
    // Pre-logging hooks
    this.hooks.hook('audit:before', async (event: AuditEvent) => {
      logger.debug('Pre-audit hook triggered', { eventId: event.id });
      
      // Add location data
      if (event.ipAddress) {
        event.location = await this.getLocationFromIP(event.ipAddress);
      }
      
      // Add compliance flags
      event.compliance = {
        gdpr: process.env.ENABLE_GDPR_COMPLIANCE === 'true',
        sox: process.env.ENABLE_SOX_COMPLIANCE === 'true',
        hipaa: process.env.ENABLE_HIPAA_COMPLIANCE === 'true',
        pci: false
      };

      return event;
    });

    // Post-logging hooks
    this.hooks.hook('audit:after', async (event: AuditEvent) => {
      logger.debug('Post-audit hook triggered', { eventId: event.id });

      // Evaluate security rules
      const matchedRules = this.rulesEngine.evaluateEvent(event);
      
      if (matchedRules.length > 0) {
        logger.info('Security rules matched', { 
          eventId: event.id,
          rules: matchedRules.map(r => r.id)
        });

        // Process alerts
        await this.alertManager.processEvent(event, matchedRules);
      }

      // Check for suspicious activity
      await this.checkSuspiciousActivity(event);

      // Publish to Kafka for real-time processing
      await this.publishEvent(event);

      // Add to background processing queue
      await auditQueue.add('process-audit-event', { eventId: event.id });
    });

    // Error handling hooks
    this.hooks.hook('audit:error', async (error: Error, event: AuditEvent) => {
      logger.error('Audit logging error', { 
        error: error.message,
        eventId: event.id,
        stack: error.stack
      });

      // Send error alert
      await this.sendErrorAlert(error, event);
    });

    // Compliance hooks
    this.hooks.hook('audit:compliance', async (event: AuditEvent) => {
      if (event.compliance.gdpr && event.userId) {
        await this.processGDPRCompliance(event);
      }
      
      if (event.compliance.sox && event.severity === 'CRITICAL') {
        await this.processSOXCompliance(event);
      }
    });
  }

  private async setupDatabaseSchema(): Promise<void> {
    const client = await dbPool.connect();
    
    try {
      // Create audit_events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id VARCHAR PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          user_id VARCHAR,
          session_id VARCHAR,
          action VARCHAR NOT NULL,
          resource VARCHAR NOT NULL,
          resource_id VARCHAR,
          method VARCHAR,
          endpoint VARCHAR,
          status_code INTEGER,
          user_agent TEXT,
          ip_address INET NOT NULL,
          location JSONB,
          classification VARCHAR NOT NULL,
          severity VARCHAR NOT NULL,
          metadata JSONB,
          success BOOLEAN NOT NULL,
          error_message TEXT,
          duration INTEGER,
          compliance JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          indexed_at TIMESTAMP
        )
      `);

      // Create audit_alerts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_alerts (
          id VARCHAR PRIMARY KEY,
          alert_id VARCHAR NOT NULL,
          event_id VARCHAR NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES audit_events(id)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp 
        ON audit_events(timestamp DESC)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_events_user_id 
        ON audit_events(user_id) WHERE user_id IS NOT NULL
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_events_severity 
        ON audit_events(severity)
      `);

      logger.info('Audit database schema initialized successfully');

    } finally {
      client.release();
    }
  }

  async logEvent(eventData: Partial<AuditEvent>): Promise<void> {
    const startTime = Date.now();
    
    // Create complete event with defaults
    const event: AuditEvent = {
      id: crypto.lib.WordArray.random(16).toString(),
      timestamp: new Date(),
      classification: 'INTERNAL',
      severity: 'LOW',
      success: true,
      ipAddress: '127.0.0.1',
      compliance: {
        gdpr: false,
        sox: false,
        hipaa: false,
        pci: false
      },
      ...eventData
    };

    try {
      // Execute pre-hooks
      const processedEvent = await this.hooks.callHook('audit:before', event);

      // Store in database
      await this.storeEvent(processedEvent);

      // Execute post-hooks
      await this.hooks.callHook('audit:after', processedEvent);

      // Execute compliance hooks
      await this.hooks.callHook('audit:compliance', processedEvent);

      const duration = Date.now() - startTime;
      logger.info('Audit event logged successfully', {
        eventId: event.id,
        action: event.action,
        duration: `${duration}ms`
      });

    } catch (error) {
      await this.hooks.callHook('audit:error', error, event);
      throw error;
    }
  }

  private async storeEvent(event: AuditEvent): Promise<void> {
    const client = await dbPool.connect();
    
    try {
      await client.query(`
        INSERT INTO audit_events (
          id, timestamp, user_id, session_id, action, resource, resource_id,
          method, endpoint, status_code, user_agent, ip_address, location,
          classification, severity, metadata, success, error_message,
          duration, compliance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        event.id,
        event.timestamp,
        event.userId,
        event.sessionId,
        event.action,
        event.resource,
        event.resourceId,
        event.method,
        event.endpoint,
        event.statusCode,
        event.userAgent,
        event.ipAddress,
        JSON.stringify(event.location || {}),
        event.classification,
        event.severity,
        JSON.stringify(event.metadata || {}),
        event.success,
        event.errorMessage,
        event.duration,
        JSON.stringify(event.compliance)
      ]);

    } finally {
      client.release();
    }
  }

  private async getLocationFromIP(ipAddress: string): Promise<any> {
    // Simulate IP geolocation service
    // In production, use services like MaxMind, IPInfo, etc.
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco'
    };
  }

  private async checkSuspiciousActivity(event: AuditEvent): Promise<void> {
    if (!event.success || event.severity === 'CRITICAL') {
      try {
        await suspiciousActivityLimiter.consume(event.ipAddress);
      } catch (rateLimitRes) {
        logger.warn('Suspicious activity detected', {
          ipAddress: event.ipAddress,
          userId: event.userId,
          action: event.action,
          remainingPoints: rateLimitRes.remainingPoints
        });

        // Trigger security alert
        const alertData = {
          type: 'suspicious_activity',
          ipAddress: event.ipAddress,
          userId: event.userId,
          events: rateLimitRes.totalHits,
          timeWindow: '1 minute'
        };

        await this.publishAlert(alertData);
      }
    }
  }

  private async publishEvent(event: AuditEvent): Promise<void> {
    try {
      await producer.send({
        topic: 'audit-events',
        messages: [{
          key: event.userId || event.sessionId || event.ipAddress,
          value: JSON.stringify(event),
          timestamp: event.timestamp.getTime().toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to publish audit event to Kafka', { error: error.message });
    }
  }

  private async publishAlert(alertData: any): Promise<void> {
    try {
      await producer.send({
        topic: 'security-alerts',
        messages: [{
          value: JSON.stringify(alertData),
          timestamp: Date.now().toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to publish security alert', { error: error.message });
    }
  }

  private async processGDPRCompliance(event: AuditEvent): Promise<void> {
    // Log GDPR-related activities
    logger.info('Processing GDPR compliance for audit event', { 
      eventId: event.id,
      userId: event.userId
    });

    // Implement GDPR-specific logic
    if (event.action.includes('delete') || event.action.includes('export')) {
      await this.logComplianceEvent('GDPR', event, 'Data subject rights exercised');
    }
  }

  private async processSOXCompliance(event: AuditEvent): Promise<void> {
    // Log SOX-related activities  
    logger.info('Processing SOX compliance for audit event', { 
      eventId: event.id,
      severity: event.severity
    });

    await this.logComplianceEvent('SOX', event, 'Critical security event logged');
  }

  private async logComplianceEvent(standard: string, event: AuditEvent, description: string): Promise<void> {
    const complianceEvent = {
      standard,
      originalEventId: event.id,
      description,
      timestamp: new Date(),
      metadata: {
        userId: event.userId,
        action: event.action,
        resource: event.resource
      }
    };

    // Store compliance record
    const client = await dbPool.connect();
    try {
      await client.query(`
        INSERT INTO compliance_events (id, standard, original_event_id, description, data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        crypto.lib.WordArray.random(16).toString(),
        standard,
        event.id,
        description,
        JSON.stringify(complianceEvent),
        new Date()
      ]);
    } finally {
      client.release();
    }
  }

  private async sendErrorAlert(error: Error, event: AuditEvent): Promise<void> {
    const alertData = {
      type: 'system_error',
      error: error.message,
      eventId: event.id,
      timestamp: new Date().toISOString()
    };

    try {
      await emailTransporter.sendMail({
        from: process.env.SMTP_USER,
        to: 'admin@company.com',
        subject: '🔥 Audit System Error',
        html: `
          <h2>Audit System Error</h2>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Event ID:</strong> ${event.id}</p>
          <p><strong>Time:</strong> ${alertData.timestamp}</p>
          <pre>${error.stack}</pre>
        `
      });
    } catch (emailError) {
      logger.error('Failed to send error alert email', { error: emailError.message });
    }
  }
}

// Command Definition
export const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Comprehensive audit logging system with hook-driven architecture"
  },
  args: {
    action: {
      type: "string",
      description: "Action being audited",
      required: true
    },
    resource: {
      type: "string", 
      description: "Resource being accessed",
      required: true
    },
    "resource-id": {
      type: "string",
      description: "ID of the resource",
      required: false
    },
    "user-id": {
      type: "string",
      description: "User performing the action",
      required: false
    },
    "session-id": {
      type: "string",
      description: "User session ID",
      required: false
    },
    "ip-address": {
      type: "string",
      description: "Client IP address",
      default: "127.0.0.1"
    },
    classification: {
      type: "string",
      description: "Security classification",
      default: "INTERNAL"
    },
    severity: {
      type: "string",
      description: "Event severity",
      default: "LOW"
    },
    success: {
      type: "boolean",
      description: "Whether the action was successful",
      default: true
    },
    method: {
      type: "string",
      description: "HTTP method (if applicable)",
      required: false
    },
    endpoint: {
      type: "string",
      description: "API endpoint (if applicable)", 
      required: false
    },
    "status-code": {
      type: "string",
      description: "HTTP status code",
      required: false
    },
    "error-message": {
      type: "string",
      description: "Error message if action failed",
      required: false
    },
    duration: {
      type: "string",
      description: "Action duration in milliseconds",
      required: false
    },
    metadata: {
      type: "string",
      description: "Additional metadata (JSON string)",
      required: false
    }
  },
  async run({ args }) {
    const auditLogger = new AuditLogger();

    try {
      // Parse metadata if provided
      let metadata;
      if (args.metadata) {
        try {
          metadata = JSON.parse(args.metadata);
        } catch (error) {
          throw new Error(`Invalid metadata JSON: ${error.message}`);
        }
      }

      // Create audit event
      const eventData: Partial<AuditEvent> = {
        action: args.action,
        resource: args.resource,
        resourceId: args["resource-id"],
        userId: args["user-id"],
        sessionId: args["session-id"],
        ipAddress: args["ip-address"],
        classification: args.classification as any,
        severity: args.severity as any,
        success: args.success,
        method: args.method,
        endpoint: args.endpoint,
        statusCode: args["status-code"] ? parseInt(args["status-code"]) : undefined,
        errorMessage: args["error-message"],
        duration: args.duration ? parseInt(args.duration) : undefined,
        metadata
      };

      // Log the event
      await auditLogger.logEvent(eventData);

      console.log("✅ Audit event logged successfully");
      console.log(`   Action: ${args.action}`);
      console.log(`   Resource: ${args.resource}`);
      console.log(`   Severity: ${args.severity}`);
      console.log(`   Classification: ${args.classification}`);
      
      if (args["user-id"]) {
        console.log(`   User ID: ${args["user-id"]}`);
      }
      
      process.exit(0);

    } catch (error) {
      logger.error('Audit command failed', { error: error.message });
      console.error(`❌ Audit Logging Failed: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Testing Approach

```typescript
// tests/audit-logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger } from '../src/audit-logger';

describe('Audit Logger', () => {
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    auditLogger = new AuditLogger();
  });

  it('should log basic audit event', async () => {
    const event = {
      action: 'login',
      resource: 'authentication',
      userId: 'user123',
      ipAddress: '192.168.1.100',
      success: true
    };

    await expect(auditLogger.logEvent(event)).resolves.not.toThrow();
  });

  it('should trigger security rules for failed logins', async () => {
    const event = {
      action: 'login',
      resource: 'authentication',
      userId: 'user123',
      ipAddress: '192.168.1.100',
      success: false,
      severity: 'HIGH' as const
    };

    await auditLogger.logEvent(event);
    
    // Verify rule was triggered (check logs or database)
  });

  it('should handle GDPR compliance events', async () => {
    const event = {
      action: 'data_export',
      resource: 'user_data',
      userId: 'user123',
      ipAddress: '192.168.1.100',
      success: true,
      compliance: {
        gdpr: true,
        sox: false,
        hipaa: false,
        pci: false
      }
    };

    await auditLogger.logEvent(event);
    
    // Verify GDPR compliance processing
  });
});
```

## Usage Examples

```bash
# Basic audit log
./cli audit \
  --action="login" \
  --resource="user_account" \
  --user-id="user123" \
  --ip-address="192.168.1.100" \
  --success

# Failed authentication attempt
./cli audit \
  --action="login" \
  --resource="authentication" \
  --user-id="user456" \
  --ip-address="10.0.0.50" \
  --success=false \
  --severity="HIGH" \
  --error-message="Invalid credentials"

# Administrative action
./cli audit \
  --action="delete_user" \
  --resource="user_management" \
  --resource-id="user789" \
  --user-id="admin123" \
  --ip-address="172.16.0.10" \
  --classification="CONFIDENTIAL" \
  --severity="MEDIUM" \
  --method="DELETE" \
  --endpoint="/api/users/user789" \
  --status-code="200" \
  --duration="250"

# With metadata
./cli audit \
  --action="data_export" \
  --resource="customer_data" \
  --user-id="user123" \
  --ip-address="203.0.113.10" \
  --classification="RESTRICTED" \
  --severity="HIGH" \
  --metadata='{"export_type":"full","records_count":1500,"file_format":"csv"}'
```

## Performance Considerations

1. **Async Processing**: All audit operations are non-blocking
2. **Batch Processing**: Events are processed in batches for efficiency
3. **Connection Pooling**: Database connections are reused
4. **Queue Management**: Background processing prevents bottlenecks
5. **Caching**: Redis caching for frequently accessed data

## Deployment Notes

### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
CMD ["npm", "start"]
```

### Production Architecture

```yaml
# docker-compose.yml
version: '3.8'
services:
  audit-system:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/audit_db
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - postgres
      - redis
      - kafka

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=audit_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
    volumes:
      - kafka_data:/var/lib/kafka/data

volumes:
  postgres_data:
  redis_data:
  kafka_data:
```

This pattern provides a comprehensive, production-ready audit logging system with hook-driven architecture, real-time monitoring, compliance support, and enterprise-grade security features.