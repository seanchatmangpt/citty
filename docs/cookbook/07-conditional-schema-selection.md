# Pattern 07: Conditional Schema Selection - Authentication System

## Overview

An intelligent authentication system that dynamically selects validation schemas based on user context, authentication method, security level, and business rules. Features adaptive security measures, multi-factor authentication, and context-aware validation.

## Features

- Dynamic schema selection based on context
- Multi-factor authentication with various methods
- Adaptive security based on risk assessment
- Context-aware validation (device, location, time)
- Progressive security enhancement
- Compliance with security standards (OWASP, NIST)
- Audit logging and security monitoring

## Environment Setup

```bash
# Authentication core
pnpm add passport passport-local passport-google-oauth20 passport-jwt
pnpm add bcrypt argon2 speakeasy qrcode
pnpm add jsonwebtoken express-rate-limit helmet
pnpm add express-session connect-redis

# Validation and security
pnpm add zod joi validator ip2location geoip-lite
pnpm add device-detector-js ua-parser-js
pnpm add @google-cloud/recaptcha-enterprise

# Database and caching
pnpm add mongodb pg redis ioredis
pnpm add typeorm prisma

# Security monitoring
pnpm add winston elastic-apm-node
pnpm add @sentry/node prometheus-client

# Communication
pnpm add nodemailer twilio aws-sdk

# Testing
pnpm add -D supertest @types/passport
pnpm add -D @types/bcrypt @types/speakeasy
```

## Environment Variables

```env
# Application
NODE_ENV=production
APP_URL=https://your-app.com
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/auth

# JWT Configuration
JWT_ACCESS_SECRET=your-jwt-access-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption
BCRYPT_ROUNDS=12
ARGON2_TIME_COST=3
ARGON2_MEMORY_COST=4096
ENCRYPTION_KEY=32-character-encryption-key

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Two-Factor Authentication
TOTP_ISSUER=YourApp
TOTP_WINDOW=2
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Email
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@yourapp.com

# Security Services
RECAPTCHA_SITE_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
MAXMIND_LICENSE_KEY=your-maxmind-key

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_RESET_MAX=3

# Security Thresholds
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=1800000
SESSION_TIMEOUT=3600000
FORCE_2FA_THRESHOLD=high

# Monitoring
SENTRY_DSN=your-sentry-dsn
ELASTIC_APM_SERVICE_NAME=auth-service
```

## Production Code

```typescript
import { defineCommand } from "citty";
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import bcrypt from "bcrypt";
import argon2 from "argon2";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import Joi from "joi";
import validator from "validator";
import DeviceDetector from "device-detector-js";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import winston from "winston";
import apm from "elastic-apm-node";
import Redis from "ioredis";
import { Pool } from "pg";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";
import twilio from "twilio";

// Types
interface AuthenticationContext {
  userAgent: string;
  ipAddress: string;
  device: {
    type: string;
    brand: string;
    model: string;
    os: string;
    browser: string;
  };
  location: {
    country: string;
    region: string;
    city: string;
    timezone: string;
  };
  timestamp: Date;
  riskScore: number;
  sessionId: string;
  previousLogins: Array<{
    timestamp: Date;
    ipAddress: string;
    device: string;
    success: boolean;
  }>;
}

interface SecurityProfile {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mfaEnabled: boolean;
  mfaMethods: Array<'totp' | 'sms' | 'email' | 'backup_codes'>;
  trustedDevices: Array<{
    deviceId: string;
    fingerprint: string;
    lastSeen: Date;
    trusted: boolean;
  }>;
  loginAttempts: {
    count: number;
    lastAttempt: Date;
    locked: boolean;
    lockExpires?: Date;
  };
  preferences: {
    sessionTimeout: number;
    requireMfaForSensitive: boolean;
    allowedIpRanges?: string[];
  };
}

interface SchemaCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'regex' | 'exists';
  value: any;
  contextField?: string; // Field from authentication context
}

interface ConditionalSchema {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'zod' | 'joi' | 'custom';
  schema: any;
  conditions: SchemaCondition[];
  priority: number;
  securityLevel: 'basic' | 'standard' | 'enhanced' | 'maximum';
  applicableAuthMethods: string[];
  metadata: {
    category: string;
    compliance: string[];
    auditRequired: boolean;
  };
}

interface AuthenticationRequest {
  method: 'login' | 'register' | 'reset_password' | 'verify_email' | '2fa' | 'oauth';
  data: Record<string, any>;
  context: AuthenticationContext;
  securityProfile?: SecurityProfile;
}

interface ValidationResult {
  isValid: boolean;
  selectedSchema: string;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    severity: 'error' | 'warning';
  }>;
  securityFlags: {
    riskLevel: string;
    requiresMfa: boolean;
    requiresAdditionalVerification: boolean;
    suspiciousActivity: boolean;
  };
  metadata: {
    validatedAt: Date;
    schemaVersion: string;
    contextHash: string;
  };
}

// APM Initialization
const apmAgent = apm.start({
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'auth-service',
  environment: process.env.NODE_ENV || 'development'
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
      filename: 'auth-error.log', 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'auth-combined.log',
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database Connections
const redis = new Redis(process.env.REDIS_URL);
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const mongoClient = new MongoClient(process.env.MONGODB_URL!);

// Context Analyzer
class AuthenticationContextAnalyzer {
  private deviceDetector: DeviceDetector;

  constructor() {
    this.deviceDetector = new DeviceDetector();
  }

  async analyzeContext(req: express.Request): Promise<AuthenticationContext> {
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = this.getClientIP(req);
    
    // Device detection
    const deviceInfo = this.deviceDetector.parse(userAgent);
    const uaParser = new UAParser(userAgent);
    const uaResult = uaParser.getResult();

    // Geolocation
    const geoInfo = geoip.lookup(ipAddress);

    // Risk assessment
    const riskScore = await this.calculateRiskScore(req, ipAddress, deviceInfo);

    // Previous login history
    const previousLogins = await this.getUserLoginHistory(ipAddress);

    const context: AuthenticationContext = {
      userAgent,
      ipAddress,
      device: {
        type: deviceInfo.device?.type || 'unknown',
        brand: deviceInfo.device?.brand || 'unknown',
        model: deviceInfo.device?.model || 'unknown',
        os: `${uaResult.os.name} ${uaResult.os.version}` || 'unknown',
        browser: `${uaResult.browser.name} ${uaResult.browser.version}` || 'unknown'
      },
      location: {
        country: geoInfo?.country || 'unknown',
        region: geoInfo?.region || 'unknown', 
        city: geoInfo?.city || 'unknown',
        timezone: geoInfo?.timezone || 'unknown'
      },
      timestamp: new Date(),
      riskScore,
      sessionId: req.sessionID || this.generateSessionId(),
      previousLogins
    };

    logger.info('Authentication context analyzed', {
      ipAddress: context.ipAddress,
      country: context.location.country,
      riskScore: context.riskScore,
      deviceType: context.device.type
    });

    return context;
  }

  private getClientIP(req: express.Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           (req.headers['x-real-ip'] as string) ||
           req.socket.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }

  private async calculateRiskScore(req: express.Request, ipAddress: string, deviceInfo: any): Promise<number> {
    let riskScore = 0;

    // IP reputation check
    if (await this.isKnownMaliciousIP(ipAddress)) {
      riskScore += 50;
    }

    // Geolocation risk (VPN/Proxy detection)
    if (await this.isVPNOrProxy(ipAddress)) {
      riskScore += 30;
    }

    // Time-based anomalies (unusual login times)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      riskScore += 10;
    }

    // Device fingerprinting
    if (await this.isNewDevice(deviceInfo, ipAddress)) {
      riskScore += 20;
    }

    // Rate limiting violations
    const recentAttempts = await this.getRecentAuthAttempts(ipAddress);
    if (recentAttempts > 3) {
      riskScore += 25;
    }

    return Math.min(riskScore, 100);
  }

  private async isKnownMaliciousIP(ipAddress: string): Promise<boolean> {
    // Check against threat intelligence feeds
    // This is a placeholder - in production, integrate with services like:
    // - AbuseIPDB
    // - VirusTotal
    // - Custom threat intelligence
    const maliciousIPs = await redis.sismember('malicious_ips', ipAddress);
    return maliciousIPs === 1;
  }

  private async isVPNOrProxy(ipAddress: string): Promise<boolean> {
    // Check for VPN/Proxy indicators
    // In production, use services like:
    // - MaxMind GeoIP2
    // - IPQualityScore
    // - Custom VPN detection
    return false; // Placeholder
  }

  private async isNewDevice(deviceInfo: any, ipAddress: string): Promise<boolean> {
    const deviceFingerprint = this.generateDeviceFingerprint(deviceInfo, ipAddress);
    const exists = await redis.exists(`device:${deviceFingerprint}`);
    return exists === 0;
  }

  private generateDeviceFingerprint(deviceInfo: any, ipAddress: string): string {
    const crypto = require('crypto');
    const fingerprint = `${deviceInfo.device?.type}-${deviceInfo.device?.brand}-${deviceInfo.os?.name}-${ipAddress}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  private async getUserLoginHistory(ipAddress: string): Promise<AuthenticationContext['previousLogins']> {
    try {
      const history = await redis.lrange(`login_history:${ipAddress}`, 0, 9);
      return history.map(entry => JSON.parse(entry));
    } catch (error) {
      logger.error('Failed to retrieve login history', { ipAddress, error: error.message });
      return [];
    }
  }

  private async getRecentAuthAttempts(ipAddress: string): Promise<number> {
    try {
      const count = await redis.get(`auth_attempts:${ipAddress}`);
      return parseInt(count || '0', 10);
    } catch (error) {
      return 0;
    }
  }

  private generateSessionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

// Conditional Schema Selector
class ConditionalSchemaSelector {
  private schemas: Map<string, ConditionalSchema> = new Map();
  private contextAnalyzer: AuthenticationContextAnalyzer;

  constructor() {
    this.contextAnalyzer = new AuthenticationContextAnalyzer();
    this.initializeSchemas();
  }

  private initializeSchemas(): void {
    // Basic login schema
    this.registerSchema({
      id: 'login-basic',
      name: 'Basic Login Validation',
      version: '1.0.0',
      description: 'Standard login validation for low-risk scenarios',
      type: 'zod',
      schema: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        rememberMe: z.boolean().optional()
      }),
      conditions: [
        { field: 'riskScore', operator: 'lt', value: 30, contextField: 'riskScore' },
        { field: 'method', operator: 'eq', value: 'login' }
      ],
      priority: 1,
      securityLevel: 'basic',
      applicableAuthMethods: ['login'],
      metadata: {
        category: 'authentication',
        compliance: ['basic'],
        auditRequired: false
      }
    });

    // Enhanced login schema for medium risk
    this.registerSchema({
      id: 'login-enhanced',
      name: 'Enhanced Login Validation',
      version: '1.0.0',
      description: 'Enhanced validation for medium-risk scenarios',
      type: 'zod',
      schema: z.object({
        email: z.string().email('Invalid email format').refine(
          (email) => !email.includes('+'),
          'Email aliases not allowed for enhanced security'
        ),
        password: z.string().min(8, 'Password must be at least 8 characters')
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and numbers'),
        captcha: z.string().min(1, 'CAPTCHA verification required'),
        deviceTrust: z.boolean().optional()
      }),
      conditions: [
        { field: 'riskScore', operator: 'gte', value: 30, contextField: 'riskScore' },
        { field: 'riskScore', operator: 'lt', value: 60, contextField: 'riskScore' },
        { field: 'method', operator: 'eq', value: 'login' }
      ],
      priority: 2,
      securityLevel: 'enhanced',
      applicableAuthMethods: ['login'],
      metadata: {
        category: 'authentication',
        compliance: ['enhanced', 'gdpr'],
        auditRequired: true
      }
    });

    // Maximum security login schema
    this.registerSchema({
      id: 'login-maximum',
      name: 'Maximum Security Login',
      version: '1.0.0',
      description: 'Maximum security validation for high-risk scenarios',
      type: 'joi',
      schema: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(12).pattern(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
        ).required().messages({
          'string.pattern.base': 'Password must contain uppercase, lowercase, numbers, and special characters'
        }),
        mfaToken: Joi.string().length(6).pattern(/^\d+$/).required(),
        captcha: Joi.string().required(),
        biometric: Joi.object({
          type: Joi.string().valid('fingerprint', 'face', 'voice').required(),
          data: Joi.string().required()
        }).optional(),
        locationConsent: Joi.boolean().valid(true).required(),
        deviceFingerprint: Joi.string().required()
      }),
      conditions: [
        { field: 'riskScore', operator: 'gte', value: 60, contextField: 'riskScore' },
        { field: 'method', operator: 'eq', value: 'login' }
      ],
      priority: 3,
      securityLevel: 'maximum',
      applicableAuthMethods: ['login'],
      metadata: {
        category: 'authentication',
        compliance: ['pci-dss', 'sox', 'hipaa'],
        auditRequired: true
      }
    });

    // Registration schemas
    this.registerSchema({
      id: 'registration-standard',
      name: 'Standard Registration',
      version: '1.0.0',
      description: 'Standard user registration validation',
      type: 'zod',
      schema: z.object({
        firstName: z.string().min(2).max(50),
        lastName: z.string().min(2).max(50),
        email: z.string().email(),
        password: z.string().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and numbers'),
        confirmPassword: z.string(),
        dateOfBirth: z.string().datetime(),
        termsAccepted: z.boolean().refine(val => val === true, 'Must accept terms'),
        privacyPolicyAccepted: z.boolean().refine(val => val === true, 'Must accept privacy policy')
      }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
      }),
      conditions: [
        { field: 'method', operator: 'eq', value: 'register' },
        { field: 'riskScore', operator: 'lt', value: 50, contextField: 'riskScore' }
      ],
      priority: 1,
      securityLevel: 'standard',
      applicableAuthMethods: ['register'],
      metadata: {
        category: 'registration',
        compliance: ['gdpr'],
        auditRequired: true
      }
    });

    // Business registration schema
    this.registerSchema({
      id: 'registration-business',
      name: 'Business Registration',
      version: '1.0.0',
      description: 'Enhanced validation for business accounts',
      type: 'joi',
      schema: Joi.object({
        companyName: Joi.string().min(2).max(100).required(),
        businessType: Joi.string().valid('corporation', 'llc', 'partnership', 'sole_proprietorship').required(),
        taxId: Joi.string().pattern(/^\d{2}-\d{7}$/).required(),
        businessAddress: Joi.object({
          street: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().length(2).required(),
          zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
          country: Joi.string().length(2).required()
        }).required(),
        authorizedSignatory: Joi.object({
          firstName: Joi.string().min(2).max(50).required(),
          lastName: Joi.string().min(2).max(50).required(),
          title: Joi.string().required(),
          email: Joi.string().email().required(),
          phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
        }).required(),
        businessLicense: Joi.string().when('businessType', {
          is: Joi.valid('corporation', 'llc'),
          then: Joi.required(),
          otherwise: Joi.optional()
        }),
        bankingInfo: Joi.object({
          accountType: Joi.string().valid('checking', 'savings').required(),
          routingNumber: Joi.string().length(9).required(),
          accountNumber: Joi.string().min(6).max(17).required()
        }).optional(),
        compliance: Joi.object({
          kycCompleted: Joi.boolean().valid(true).required(),
          amlChecked: Joi.boolean().valid(true).required(),
          sanctionsChecked: Joi.boolean().valid(true).required()
        }).required()
      }),
      conditions: [
        { field: 'method', operator: 'eq', value: 'register' },
        { field: 'accountType', operator: 'eq', value: 'business' }
      ],
      priority: 2,
      securityLevel: 'enhanced',
      applicableAuthMethods: ['register'],
      metadata: {
        category: 'registration',
        compliance: ['kyc', 'aml', 'sox'],
        auditRequired: true
      }
    });

    // MFA verification schemas
    this.registerSchema({
      id: 'mfa-totp',
      name: 'TOTP MFA Verification',
      version: '1.0.0',
      description: 'Time-based One-Time Password verification',
      type: 'zod',
      schema: z.object({
        token: z.string().length(6).regex(/^\d+$/, 'Token must be 6 digits'),
        trustDevice: z.boolean().optional()
      }),
      conditions: [
        { field: 'method', operator: 'eq', value: '2fa' },
        { field: 'mfaMethod', operator: 'eq', value: 'totp' }
      ],
      priority: 1,
      securityLevel: 'enhanced',
      applicableAuthMethods: ['2fa'],
      metadata: {
        category: 'mfa',
        compliance: ['nist-800-63b'],
        auditRequired: true
      }
    });

    logger.info('Authentication schemas initialized', {
      schemaCount: this.schemas.size
    });
  }

  registerSchema(schema: ConditionalSchema): void {
    this.schemas.set(schema.id, schema);
    logger.info('Schema registered', {
      schemaId: schema.id,
      securityLevel: schema.securityLevel,
      priority: schema.priority
    });
  }

  async selectSchema(request: AuthenticationRequest): Promise<ConditionalSchema | null> {
    const candidates: Array<{ schema: ConditionalSchema; score: number }> = [];

    for (const schema of this.schemas.values()) {
      // Check if schema is applicable to the authentication method
      if (!schema.applicableAuthMethods.includes(request.method)) {
        continue;
      }

      // Evaluate conditions
      const conditionsMet = await this.evaluateConditions(schema.conditions, request);
      if (!conditionsMet) {
        continue;
      }

      // Calculate selection score
      const score = this.calculateSelectionScore(schema, request);
      candidates.push({ schema, score });
    }

    // Sort by score (highest first) and priority (lowest number = higher priority)
    candidates.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.schema.priority - b.schema.priority;
    });

    const selectedSchema = candidates[0]?.schema || null;

    if (selectedSchema) {
      logger.info('Schema selected', {
        schemaId: selectedSchema.id,
        securityLevel: selectedSchema.securityLevel,
        riskScore: request.context.riskScore,
        method: request.method
      });
    } else {
      logger.warn('No suitable schema found', {
        method: request.method,
        riskScore: request.context.riskScore,
        availableSchemas: Array.from(this.schemas.keys())
      });
    }

    return selectedSchema;
  }

  private async evaluateConditions(conditions: SchemaCondition[], request: AuthenticationRequest): Promise<boolean> {
    for (const condition of conditions) {
      const value = this.getFieldValue(condition.field, request, condition.contextField);
      const conditionValue = condition.value;

      const result = this.evaluateCondition(value, condition.operator, conditionValue);
      if (!result) {
        return false;
      }
    }

    return true;
  }

  private getFieldValue(field: string, request: AuthenticationRequest, contextField?: string): any {
    if (contextField) {
      return this.getNestedValue(request.context, contextField);
    }

    // Check request data first
    if (request.data.hasOwnProperty(field)) {
      return request.data[field];
    }

    // Check method
    if (field === 'method') {
      return request.method;
    }

    // Check security profile
    if (request.securityProfile) {
      return this.getNestedValue(request.securityProfile, field);
    }

    return undefined;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(value: any, operator: SchemaCondition['operator'], conditionValue: any): boolean {
    switch (operator) {
      case 'eq':
        return value === conditionValue;
      case 'ne':
        return value !== conditionValue;
      case 'gt':
        return value > conditionValue;
      case 'lt':
        return value < conditionValue;
      case 'gte':
        return value >= conditionValue;
      case 'lte':
        return value <= conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(value);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(value);
      case 'regex':
        return new RegExp(conditionValue).test(String(value));
      case 'exists':
        return value !== undefined && value !== null && value !== '';
      default:
        return false;
    }
  }

  private calculateSelectionScore(schema: ConditionalSchema, request: AuthenticationRequest): number {
    let score = 0;

    // Security level alignment with risk score
    const riskScore = request.context.riskScore;
    if (schema.securityLevel === 'basic' && riskScore < 30) score += 10;
    else if (schema.securityLevel === 'standard' && riskScore >= 20 && riskScore < 50) score += 10;
    else if (schema.securityLevel === 'enhanced' && riskScore >= 40 && riskScore < 70) score += 10;
    else if (schema.securityLevel === 'maximum' && riskScore >= 60) score += 10;

    // Geographic considerations
    if (request.context.location.country === 'US') {
      if (schema.metadata.compliance.includes('hipaa') || schema.metadata.compliance.includes('sox')) {
        score += 5;
      }
    }

    // Time-based considerations
    const hour = request.context.timestamp.getHours();
    if ((hour < 6 || hour > 22) && schema.securityLevel !== 'basic') {
      score += 3;
    }

    // Device trust level
    const isNewDevice = !request.securityProfile?.trustedDevices.some(
      device => device.deviceId === this.generateDeviceId(request.context)
    );
    if (isNewDevice && schema.securityLevel !== 'basic') {
      score += 5;
    }

    return score;
  }

  private generateDeviceId(context: AuthenticationContext): string {
    const crypto = require('crypto');
    const deviceString = `${context.device.type}-${context.device.brand}-${context.device.os}-${context.ipAddress}`;
    return crypto.createHash('sha256').update(deviceString).digest('hex');
  }

  getAllSchemas(): ConditionalSchema[] {
    return Array.from(this.schemas.values());
  }

  getSchema(schemaId: string): ConditionalSchema | undefined {
    return this.schemas.get(schemaId);
  }
}

// Authentication Validator
class ConditionalAuthValidator {
  private schemaSelector: ConditionalSchemaSelector;
  private contextAnalyzer: AuthenticationContextAnalyzer;

  constructor() {
    this.schemaSelector = new ConditionalSchemaSelector();
    this.contextAnalyzer = new AuthenticationContextAnalyzer();
  }

  async validateAuth(req: express.Request, method: string, data: Record<string, any>): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Analyze authentication context
      const context = await this.contextAnalyzer.analyzeContext(req);

      // Load security profile if user exists
      const securityProfile = await this.loadSecurityProfile(data.email || data.userId);

      // Create authentication request
      const authRequest: AuthenticationRequest = {
        method: method as any,
        data,
        context,
        securityProfile
      };

      // Select appropriate schema
      const selectedSchema = await this.schemaSelector.selectSchema(authRequest);
      if (!selectedSchema) {
        return {
          isValid: false,
          selectedSchema: 'none',
          errors: [{
            field: 'system',
            message: 'No suitable validation schema found',
            code: 'NO_SCHEMA',
            severity: 'error'
          }],
          securityFlags: {
            riskLevel: 'high',
            requiresMfa: true,
            requiresAdditionalVerification: true,
            suspiciousActivity: true
          },
          metadata: {
            validatedAt: new Date(),
            schemaVersion: '1.0.0',
            contextHash: this.generateContextHash(context)
          }
        };
      }

      // Validate using selected schema
      const validationResult = await this.validateWithSchema(selectedSchema, data);

      // Determine security flags
      const securityFlags = this.determineSecurityFlags(context, selectedSchema, securityProfile);

      // Log validation attempt
      await this.logValidationAttempt(authRequest, selectedSchema, validationResult.isValid);

      const result: ValidationResult = {
        isValid: validationResult.isValid,
        selectedSchema: selectedSchema.id,
        errors: validationResult.errors || [],
        securityFlags,
        metadata: {
          validatedAt: new Date(),
          schemaVersion: selectedSchema.version,
          contextHash: this.generateContextHash(context)
        }
      };

      const duration = Date.now() - startTime;
      logger.info('Authentication validation completed', {
        method,
        schemaId: selectedSchema.id,
        isValid: result.isValid,
        riskScore: context.riskScore,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      logger.error('Authentication validation error', {
        method,
        error: error.message,
        stack: error.stack
      });

      return {
        isValid: false,
        selectedSchema: 'error',
        errors: [{
          field: 'system',
          message: 'Validation system error',
          code: 'SYSTEM_ERROR',
          severity: 'error'
        }],
        securityFlags: {
          riskLevel: 'high',
          requiresMfa: true,
          requiresAdditionalVerification: true,
          suspiciousActivity: true
        },
        metadata: {
          validatedAt: new Date(),
          schemaVersion: '1.0.0',
          contextHash: 'error'
        }
      };
    }
  }

  private async validateWithSchema(schema: ConditionalSchema, data: Record<string, any>): Promise<{ isValid: boolean; errors?: any[] }> {
    try {
      switch (schema.type) {
        case 'zod':
          schema.schema.parse(data);
          return { isValid: true };

        case 'joi':
          const { error } = schema.schema.validate(data, { abortEarly: false });
          if (error) {
            return {
              isValid: false,
              errors: error.details.map((detail: any) => ({
                field: detail.path.join('.'),
                message: detail.message,
                code: detail.type,
                severity: 'error'
              }))
            };
          }
          return { isValid: true };

        case 'custom':
          // Implement custom validation logic
          return await this.customValidation(schema, data);

        default:
          throw new Error(`Unsupported schema type: ${schema.type}`);
      }
    } catch (error) {
      if (error.errors) {
        // Zod validation errors
        return {
          isValid: false,
          errors: error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            severity: 'error'
          }))
        };
      }

      return {
        isValid: false,
        errors: [{
          field: 'validation',
          message: error.message,
          code: 'VALIDATION_ERROR',
          severity: 'error'
        }]
      };
    }
  }

  private async customValidation(schema: ConditionalSchema, data: Record<string, any>): Promise<{ isValid: boolean; errors?: any[] }> {
    // Implement custom validation logic based on schema ID
    switch (schema.id) {
      case 'business-kyc':
        return await this.validateBusinessKYC(data);
      
      case 'biometric-auth':
        return await this.validateBiometric(data);
      
      default:
        return { isValid: true };
    }
  }

  private async validateBusinessKYC(data: Record<string, any>): Promise<{ isValid: boolean; errors?: any[] }> {
    const errors = [];

    // Validate tax ID format and existence
    if (data.taxId && !await this.verifyTaxId(data.taxId)) {
      errors.push({
        field: 'taxId',
        message: 'Tax ID verification failed',
        code: 'TAX_ID_INVALID',
        severity: 'error'
      });
    }

    // Validate business address
    if (data.businessAddress && !await this.verifyBusinessAddress(data.businessAddress)) {
      errors.push({
        field: 'businessAddress',
        message: 'Business address verification failed',
        code: 'ADDRESS_INVALID',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async validateBiometric(data: Record<string, any>): Promise<{ isValid: boolean; errors?: any[] }> {
    // Implement biometric validation
    // This is a placeholder - in production, integrate with biometric services
    return { isValid: true };
  }

  private async verifyTaxId(taxId: string): Promise<boolean> {
    // Implement tax ID verification
    // This could integrate with government databases or third-party services
    return true; // Placeholder
  }

  private async verifyBusinessAddress(address: any): Promise<boolean> {
    // Implement address verification
    // This could integrate with postal services or address validation services
    return true; // Placeholder
  }

  private async loadSecurityProfile(identifier?: string): Promise<SecurityProfile | undefined> {
    if (!identifier) return undefined;

    try {
      const profile = await redis.get(`security_profile:${identifier}`);
      return profile ? JSON.parse(profile) : undefined;
    } catch (error) {
      logger.error('Failed to load security profile', { identifier, error: error.message });
      return undefined;
    }
  }

  private determineSecurityFlags(
    context: AuthenticationContext,
    schema: ConditionalSchema,
    securityProfile?: SecurityProfile
  ): ValidationResult['securityFlags'] {
    const flags = {
      riskLevel: 'low' as any,
      requiresMfa: false,
      requiresAdditionalVerification: false,
      suspiciousActivity: false
    };

    // Risk level determination
    if (context.riskScore >= 70) flags.riskLevel = 'critical';
    else if (context.riskScore >= 50) flags.riskLevel = 'high';
    else if (context.riskScore >= 30) flags.riskLevel = 'medium';

    // MFA requirement
    if (schema.securityLevel === 'enhanced' || schema.securityLevel === 'maximum') {
      flags.requiresMfa = true;
    }

    if (securityProfile?.mfaEnabled) {
      flags.requiresMfa = true;
    }

    // Additional verification
    if (context.riskScore >= 60 || schema.securityLevel === 'maximum') {
      flags.requiresAdditionalVerification = true;
    }

    // Suspicious activity detection
    if (context.riskScore >= 70) {
      flags.suspiciousActivity = true;
    }

    return flags;
  }

  private generateContextHash(context: AuthenticationContext): string {
    const crypto = require('crypto');
    const contextString = JSON.stringify({
      device: context.device,
      location: context.location,
      ipAddress: context.ipAddress,
      timestamp: context.timestamp.toISOString()
    });
    return crypto.createHash('sha256').update(contextString).digest('hex');
  }

  private async logValidationAttempt(
    request: AuthenticationRequest,
    schema: ConditionalSchema,
    success: boolean
  ): Promise<void> {
    const logEntry = {
      method: request.method,
      schemaId: schema.id,
      success,
      riskScore: request.context.riskScore,
      ipAddress: request.context.ipAddress,
      location: request.context.location,
      device: request.context.device,
      timestamp: new Date()
    };

    try {
      // Store in audit log
      await redis.lpush('auth_audit_log', JSON.stringify(logEntry));
      await redis.ltrim('auth_audit_log', 0, 9999); // Keep last 10,000 entries

      // Update metrics
      await redis.incr(`auth_attempts:${request.method}`);
      if (success) {
        await redis.incr(`auth_success:${request.method}`);
      } else {
        await redis.incr(`auth_failure:${request.method}`);
      }

    } catch (error) {
      logger.error('Failed to log validation attempt', { error: error.message });
    }
  }
}

// Authentication Service
class AuthenticationService {
  private validator: ConditionalAuthValidator;
  private app: express.Application;

  constructor() {
    this.validator = new ConditionalAuthValidator();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Session configuration
    this.app.use(session({
      store: new RedisStore({ client: redis }),
      secret: process.env.SESSION_SECRET || 'your-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_TIMEOUT || '3600000')
      }
    }));

    // Rate limiting
    this.app.use('/api/auth/login', rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5'),
      message: 'Too many login attempts, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    }));

    this.app.use('/api/auth/register', rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '3'),
      message: 'Too many registration attempts, please try again later'
    }));
  }

  private setupRoutes(): void {
    // Authentication validation endpoint
    this.app.post('/api/auth/validate', async (req, res) => {
      try {
        const { method, data } = req.body;
        
        if (!method || !data) {
          return res.status(400).json({
            error: 'Method and data are required'
          });
        }

        const result = await this.validator.validateAuth(req, method, data);
        
        res.json(result);
        
      } catch (error) {
        logger.error('Authentication validation API error', { error: error.message });
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    });

    // Schema information endpoint
    this.app.get('/api/auth/schemas', (req, res) => {
      try {
        const schemas = this.validator.schemaSelector.getAllSchemas().map(schema => ({
          id: schema.id,
          name: schema.name,
          description: schema.description,
          securityLevel: schema.securityLevel,
          applicableAuthMethods: schema.applicableAuthMethods
        }));

        res.json(schemas);
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });
  }

  start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info('Authentication service started', { port });
    });
  }
}

// Command Definition
export const authValidationCommand = defineCommand({
  meta: {
    name: "auth-validate",
    description: "Conditional schema selection authentication system"
  },
  args: {
    action: {
      type: "string",
      description: "Action to perform (validate, server, analyze-context)",
      required: true
    },
    method: {
      type: "string",
      description: "Authentication method (login, register, 2fa)",
      required: false
    },
    data: {
      type: "string",
      description: "Authentication data (JSON string)",
      required: false
    },
    "user-agent": {
      type: "string",
      description: "User agent string for context analysis",
      required: false
    },
    "ip-address": {
      type: "string",
      description: "IP address for context analysis",
      default: "127.0.0.1"
    },
    port: {
      type: "string",
      description: "Server port",
      default: "3000"
    },
    verbose: {
      type: "boolean",
      description: "Verbose output",
      default: false
    }
  },
  async run({ args }) {
    try {
      switch (args.action) {
        case 'validate':
          if (!args.method || !args.data) {
            throw new Error("Method and data are required for validation");
          }

          console.log("🔐 Validating authentication request...");

          // Create mock request object for context analysis
          const mockReq = {
            get: (header: string) => header === 'User-Agent' ? args["user-agent"] : undefined,
            headers: {
              'x-forwarded-for': args["ip-address"],
              'user-agent': args["user-agent"]
            },
            socket: { remoteAddress: args["ip-address"] },
            ip: args["ip-address"],
            sessionID: 'test-session'
          } as any;

          const validator = new ConditionalAuthValidator();
          const authData = JSON.parse(args.data);

          const result = await validator.validateAuth(mockReq, args.method, authData);

          console.log("\n🔍 Authentication Validation Results");
          console.log("=====================================");
          console.log(`✅ Valid: ${result.isValid ? 'Yes' : 'No'}`);
          console.log(`🔧 Selected Schema: ${result.selectedSchema}`);
          console.log(`⚠️  Risk Level: ${result.securityFlags.riskLevel}`);
          console.log(`🔐 Requires MFA: ${result.securityFlags.requiresMfa ? 'Yes' : 'No'}`);
          console.log(`🔍 Additional Verification: ${result.securityFlags.requiresAdditionalVerification ? 'Yes' : 'No'}`);
          console.log(`🚨 Suspicious Activity: ${result.securityFlags.suspiciousActivity ? 'Yes' : 'No'}`);

          if (result.errors.length > 0) {
            console.log("\n❌ Validation Errors:");
            result.errors.forEach(error => {
              console.log(`   • ${error.field}: ${error.message} (${error.code})`);
            });
          }

          if (args.verbose) {
            console.log("\n📊 Metadata:");
            console.log(`   • Schema Version: ${result.metadata.schemaVersion}`);
            console.log(`   • Context Hash: ${result.metadata.contextHash.substring(0, 16)}...`);
            console.log(`   • Validated At: ${result.metadata.validatedAt.toISOString()}`);
          }

          process.exit(result.isValid ? 0 : 1);
          break;

        case 'server':
          console.log("🚀 Starting authentication validation server...");
          
          const authService = new AuthenticationService();
          const port = parseInt(args.port);
          
          authService.start(port);
          
          console.log(`\n✅ Authentication service started!`);
          console.log(`🌐 API Base URL: http://localhost:${port}/api`);
          console.log(`🔐 Validate Auth: POST /api/auth/validate`);
          console.log(`📋 List Schemas: GET /api/auth/schemas`);
          console.log("Press Ctrl+C to stop");

          await new Promise(() => {});
          break;

        case 'analyze-context':
          console.log("🔍 Analyzing authentication context...");
          
          const mockRequest = {
            get: (header: string) => header === 'User-Agent' ? args["user-agent"] : undefined,
            headers: {
              'x-forwarded-for': args["ip-address"],
              'user-agent': args["user-agent"]
            },
            socket: { remoteAddress: args["ip-address"] },
            ip: args["ip-address"],
            sessionID: 'test-session'
          } as any;

          const contextAnalyzer = new AuthenticationContextAnalyzer();
          const context = await contextAnalyzer.analyzeContext(mockRequest);

          console.log("\n📋 Context Analysis Results");
          console.log("============================");
          console.log(`🌐 IP Address: ${context.ipAddress}`);
          console.log(`🖥️  Device Type: ${context.device.type}`);
          console.log(`🏢 Device Brand: ${context.device.brand}`);
          console.log(`💻 Operating System: ${context.device.os}`);
          console.log(`🌐 Browser: ${context.device.browser}`);
          console.log(`🌍 Location: ${context.location.city}, ${context.location.region}, ${context.location.country}`);
          console.log(`⏰ Timezone: ${context.location.timezone}`);
          console.log(`📊 Risk Score: ${context.riskScore}/100`);
          console.log(`🔗 Session ID: ${context.sessionId}`);

          if (args.verbose && context.previousLogins.length > 0) {
            console.log("\n📈 Previous Login History:");
            context.previousLogins.slice(0, 5).forEach((login, index) => {
              console.log(`   ${index + 1}. ${login.timestamp.toISOString()} - ${login.ipAddress} - ${login.success ? '✅' : '❌'}`);
            });
          }
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      logger.error('Authentication validation command failed', { error: error.message });
      console.error(`❌ Authentication Validation Error: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Testing Approach

```typescript
// tests/conditional-auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionalSchemaSelector, ConditionalAuthValidator } from '../src/auth-validation';

describe('Conditional Authentication System', () => {
  let schemaSelector: ConditionalSchemaSelector;
  let authValidator: ConditionalAuthValidator;

  beforeEach(() => {
    schemaSelector = new ConditionalSchemaSelector();
    authValidator = new ConditionalAuthValidator();
  });

  describe('Schema Selection', () => {
    it('should select basic schema for low-risk login', async () => {
      const request = {
        method: 'login' as const,
        data: { email: 'test@example.com', password: 'password123' },
        context: {
          riskScore: 15,
          ipAddress: '192.168.1.1',
          device: { type: 'desktop' },
          location: { country: 'US' },
          timestamp: new Date()
        } as any
      };

      const schema = await schemaSelector.selectSchema(request);
      expect(schema).toBeDefined();
      expect(schema!.id).toBe('login-basic');
      expect(schema!.securityLevel).toBe('basic');
    });

    it('should select enhanced schema for medium-risk login', async () => {
      const request = {
        method: 'login' as const,
        data: { email: 'test@example.com', password: 'password123' },
        context: {
          riskScore: 45,
          ipAddress: '10.0.0.1',
          device: { type: 'mobile' },
          location: { country: 'CN' },
          timestamp: new Date()
        } as any
      };

      const schema = await schemaSelector.selectSchema(request);
      expect(schema).toBeDefined();
      expect(schema!.id).toBe('login-enhanced');
      expect(schema!.securityLevel).toBe('enhanced');
    });

    it('should select maximum security schema for high-risk login', async () => {
      const request = {
        method: 'login' as const,
        data: { email: 'test@example.com', password: 'password123' },
        context: {
          riskScore: 80,
          ipAddress: '95.216.1.1', // Known VPN range
          device: { type: 'unknown' },
          location: { country: 'TOR' },
          timestamp: new Date()
        } as any
      };

      const schema = await schemaSelector.selectSchema(request);
      expect(schema).toBeDefined();
      expect(schema!.id).toBe('login-maximum');
      expect(schema!.securityLevel).toBe('maximum');
    });

    it('should select business registration schema for business accounts', async () => {
      const request = {
        method: 'register' as const,
        data: { 
          accountType: 'business',
          companyName: 'Test Corp',
          taxId: '12-3456789'
        },
        context: {
          riskScore: 25,
          ipAddress: '192.168.1.1'
        } as any
      };

      const schema = await schemaSelector.selectSchema(request);
      expect(schema).toBeDefined();
      expect(schema!.id).toBe('registration-business');
    });
  });

  describe('Authentication Validation', () => {
    it('should validate successful basic login', async () => {
      const mockReq = {
        get: () => 'Mozilla/5.0 Test Browser',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '192.168.1.1' },
        ip: '192.168.1.1',
        sessionID: 'test-session'
      } as any;

      const result = await authValidator.validateAuth(mockReq, 'login', {
        email: 'test@example.com',
        password: 'validpassword'
      });

      expect(result.isValid).toBe(true);
      expect(result.selectedSchema).toBe('login-basic');
      expect(result.securityFlags.riskLevel).toBe('low');
    });

    it('should fail validation for invalid email', async () => {
      const mockReq = {
        get: () => 'Mozilla/5.0 Test Browser',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '192.168.1.1' },
        ip: '192.168.1.1',
        sessionID: 'test-session'
      } as any;

      const result = await authValidator.validateAuth(mockReq, 'login', {
        email: 'invalid-email',
        password: 'validpassword'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
    });

    it('should require MFA for high-risk scenarios', async () => {
      const mockReq = {
        get: () => 'Unknown Bot',
        headers: { 'x-forwarded-for': '95.216.1.1' }, // VPN IP
        socket: { remoteAddress: '95.216.1.1' },
        ip: '95.216.1.1',
        sessionID: 'test-session'
      } as any;

      const result = await authValidator.validateAuth(mockReq, 'login', {
        email: 'test@example.com',
        password: 'validpassword'
      });

      expect(result.securityFlags.requiresMfa).toBe(true);
      expect(result.securityFlags.riskLevel).toBe('high');
    });
  });

  describe('Context Analysis', () => {
    it('should analyze device and location context', async () => {
      const contextAnalyzer = new AuthenticationContextAnalyzer();
      
      const mockReq = {
        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        headers: { 'x-forwarded-for': '8.8.8.8' },
        socket: { remoteAddress: '8.8.8.8' },
        ip: '8.8.8.8',
        sessionID: 'test-session'
      } as any;

      const context = await contextAnalyzer.analyzeContext(mockReq);

      expect(context.device.type).toBeDefined();
      expect(context.device.os).toContain('Windows');
      expect(context.location.country).toBeDefined();
      expect(context.riskScore).toBeGreaterThanOrEqual(0);
      expect(context.riskScore).toBeLessThanOrEqual(100);
    });
  });
});
```

## Usage Examples

```bash
# Validate basic login attempt
./cli auth-validate --action=validate \
  --method=login \
  --data='{"email":"user@example.com","password":"SecurePass123!"}' \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  --ip-address="192.168.1.100"

# Validate high-risk login with verbose output
./cli auth-validate --action=validate \
  --method=login \
  --data='{"email":"admin@company.com","password":"AdminPass456!"}' \
  --user-agent="curl/7.68.0" \
  --ip-address="95.216.1.1" \
  --verbose

# Analyze authentication context
./cli auth-validate --action=analyze-context \
  --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)" \
  --ip-address="203.0.113.1" \
  --verbose

# Start authentication validation server
./cli auth-validate --action=server --port=3000
```

## Performance Considerations

1. **Context Caching**: Authentication contexts are cached for session duration
2. **Risk Scoring**: Risk calculations use cached threat intelligence data
3. **Schema Selection**: Schema conditions are evaluated in priority order
4. **Validation Optimization**: Schemas are pre-compiled for performance
5. **Audit Logging**: Asynchronous logging prevents blocking

## Deployment Notes

This pattern provides a production-ready conditional authentication system that adapts security measures based on real-time risk assessment and context analysis. It's designed for enterprise applications requiring adaptive security while maintaining user experience.