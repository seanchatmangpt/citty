/**
 * Comprehensive Security Manager
 * Implements enterprise-grade security features including authentication, authorization,
 * input validation, encryption, and threat detection.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { RateLimiter } from './RateLimiter';
import { InputValidator } from '../validation/InputValidator';
import { Logger } from '../monitoring/Logger';
import { Encryptor } from './Encryptor';
import { ThreatDetector } from './ThreatDetector';

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  rateLimits: {
    auth: { windowMs: number; max: number };
    api: { windowMs: number; max: number };
    search: { windowMs: number; max: number };
  };
  encryptionKey: string;
  corsOrigins: string[];
  trustProxyCount: number;
}

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  permissions: string[];
  roles: string[];
  riskScore: number;
  authenticated: boolean;
}

export interface AuthenticationResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  token?: string;
  refreshToken?: string;
  error?: string;
  requiresMFA?: boolean;
  riskScore: number;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  requiredPermissions?: string[];
  actualPermissions?: string[];
}

export class SecurityManager {
  private config: SecurityConfig;
  private rateLimiter: RateLimiter;
  private validator: InputValidator;
  private logger: Logger;
  private encryptor: Encryptor;
  private threatDetector: ThreatDetector;
  private activeSessions = new Map<string, SecurityContext>();
  private loginAttempts = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();
  private blacklistedTokens = new Set<string>();
  private permissionCache = new Map<string, { permissions: string[]; expires: Date }>();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter();
    this.validator = new InputValidator();
    this.logger = new Logger({ service: 'SecurityManager' });
    this.encryptor = new Encryptor(config.encryptionKey);
    this.threatDetector = new ThreatDetector();
    
    // Setup session cleanup
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Every 5 minutes
    setInterval(() => this.cleanupPermissionCache(), 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Comprehensive input validation and sanitization
   */
  async validateAndSanitizeInput<T>(
    input: unknown,
    schema: z.ZodSchema<T>,
    options: {
      sanitizeHtml?: boolean;
      checkSqlInjection?: boolean;
      checkXss?: boolean;
      checkPathTraversal?: boolean;
    } = {}
  ): Promise<{ valid: boolean; data?: T; errors: string[]; sanitized?: T }> {
    const errors: string[] = [];
    
    try {
      // Schema validation
      const parsed = schema.parse(input);
      
      // Security checks
      if (options.checkXss) {
        const xssCheck = this.threatDetector.detectXSS(JSON.stringify(input));
        if (xssCheck.detected) {
          errors.push(`XSS attempt detected: ${xssCheck.patterns.join(', ')}`);
          await this.logger.security('XSS_ATTEMPT', { input, patterns: xssCheck.patterns });
        }
      }

      if (options.checkSqlInjection) {
        const sqlCheck = this.threatDetector.detectSQLInjection(JSON.stringify(input));
        if (sqlCheck.detected) {
          errors.push(`SQL injection attempt detected: ${sqlCheck.patterns.join(', ')}`);
          await this.logger.security('SQL_INJECTION_ATTEMPT', { input, patterns: sqlCheck.patterns });
        }
      }

      if (options.checkPathTraversal) {
        const pathCheck = this.threatDetector.detectPathTraversal(JSON.stringify(input));
        if (pathCheck.detected) {
          errors.push(`Path traversal attempt detected: ${pathCheck.patterns.join(', ')}`);
          await this.logger.security('PATH_TRAVERSAL_ATTEMPT', { input, patterns: pathCheck.patterns });
        }
      }

      // Sanitization
      const sanitized = options.sanitizeHtml ? this.sanitizeHtml(parsed) : parsed;

      return {
        valid: errors.length === 0,
        data: errors.length === 0 ? parsed : undefined,
        sanitized,
        errors
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push('Validation failed');
      }

      return { valid: false, errors };
    }
  }

  /**
   * JWT-based authentication with security checks
   */
  async authenticate(
    email: string,
    password: string,
    context: Partial<SecurityContext>
  ): Promise<AuthenticationResult> {
    const clientInfo = {
      ipAddress: context.ipAddress || 'unknown',
      userAgent: context.userAgent || 'unknown'
    };

    // Rate limiting check
    const rateLimitCheck = await this.rateLimiter.checkLimit(
      `auth:${clientInfo.ipAddress}`,
      this.config.rateLimits.auth.max,
      this.config.rateLimits.auth.windowMs
    );

    if (!rateLimitCheck.allowed) {
      await this.logger.security('AUTH_RATE_LIMIT', clientInfo);
      return {
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        riskScore: 0.9
      };
    }

    // Check lockout status
    const lockoutInfo = this.loginAttempts.get(email);
    if (lockoutInfo?.lockedUntil && lockoutInfo.lockedUntil > new Date()) {
      await this.logger.security('AUTH_LOCKOUT_ATTEMPT', { email, ...clientInfo });
      return {
        success: false,
        error: 'Account temporarily locked due to too many failed attempts.',
        riskScore: 0.8
      };
    }

    try {
      // Validate input
      const emailValidation = await this.validateAndSanitizeInput(
        email,
        z.string().email(),
        { checkXss: true, checkSqlInjection: true }
      );

      if (!emailValidation.valid) {
        return {
          success: false,
          error: 'Invalid email format',
          riskScore: 0.7
        };
      }

      // Simulate user lookup (in real implementation, this would query database)
      const user = await this.lookupUser(emailValidation.data!);
      if (!user) {
        await this.recordFailedAttempt(email);
        await this.logger.security('AUTH_USER_NOT_FOUND', { email, ...clientInfo });
        return {
          success: false,
          error: 'Invalid credentials',
          riskScore: 0.6
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        await this.recordFailedAttempt(email);
        await this.logger.security('AUTH_INVALID_PASSWORD', { email, ...clientInfo });
        return {
          success: false,
          error: 'Invalid credentials',
          riskScore: 0.6
        };
      }

      // Calculate risk score
      const riskScore = await this.calculateAuthRiskScore(user, clientInfo);
      
      // Generate tokens
      const sessionId = crypto.randomUUID();
      const token = this.generateJWT(user, sessionId);
      const refreshToken = this.generateRefreshToken(user.id, sessionId);

      // Create security context
      const securityContext: SecurityContext = {
        userId: user.id,
        sessionId,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        timestamp: new Date(),
        permissions: user.permissions,
        roles: user.roles,
        riskScore,
        authenticated: true
      };

      // Store session
      this.activeSessions.set(sessionId, securityContext);

      // Clear failed attempts
      this.loginAttempts.delete(email);

      await this.logger.security('AUTH_SUCCESS', { 
        userId: user.id, 
        email, 
        riskScore,
        ...clientInfo 
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions
        },
        token,
        refreshToken,
        riskScore,
        requiresMFA: riskScore > 0.5
      };

    } catch (error) {
      await this.logger.error('Authentication error', { error, email, ...clientInfo });
      return {
        success: false,
        error: 'Authentication failed',
        riskScore: 1.0
      };
    }
  }

  /**
   * Token validation and session verification
   */
  async validateToken(token: string): Promise<SecurityContext | null> {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        await this.logger.security('BLACKLISTED_TOKEN_USED', { token: token.substring(0, 20) + '...' });
        return null;
      }

      // Verify JWT
      const payload = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Get session context
      const context = this.activeSessions.get(payload.sessionId);
      if (!context) {
        await this.logger.security('SESSION_NOT_FOUND', { sessionId: payload.sessionId });
        return null;
      }

      // Check session expiry
      const now = new Date();
      const sessionAge = now.getTime() - context.timestamp.getTime();
      if (sessionAge > this.config.sessionTimeout) {
        this.activeSessions.delete(payload.sessionId);
        await this.logger.security('SESSION_EXPIRED', { sessionId: payload.sessionId });
        return null;
      }

      // Update last activity
      context.timestamp = now;
      this.activeSessions.set(payload.sessionId, context);

      return context;
    } catch (error) {
      await this.logger.security('TOKEN_VALIDATION_FAILED', { error: error.message });
      return null;
    }
  }

  /**
   * Role-based access control (RBAC)
   */
  async authorize(
    context: SecurityContext,
    requiredPermissions: string[],
    resource?: string
  ): Promise<AuthorizationResult> {
    if (!context.authenticated) {
      return {
        authorized: false,
        reason: 'User not authenticated',
        requiredPermissions
      };
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      context.permissions.includes(permission) ||
      context.permissions.includes('*') || // Admin permission
      this.checkImpliedPermissions(context.roles, permission)
    );

    if (!hasAllPermissions) {
      await this.logger.security('AUTHORIZATION_DENIED', {
        userId: context.userId,
        requiredPermissions,
        actualPermissions: context.permissions,
        resource
      });

      return {
        authorized: false,
        reason: 'Insufficient permissions',
        requiredPermissions,
        actualPermissions: context.permissions
      };
    }

    // Additional resource-specific checks
    if (resource && !this.checkResourceAccess(context, resource)) {
      return {
        authorized: false,
        reason: 'Access denied to specific resource',
        requiredPermissions
      };
    }

    return { authorized: true };
  }

  /**
   * Logout and session termination
   */
  async logout(sessionId: string, token?: string): Promise<boolean> {
    try {
      // Remove session
      const removed = this.activeSessions.delete(sessionId);
      
      // Blacklist token if provided
      if (token) {
        this.blacklistedTokens.add(token);
      }

      if (removed) {
        await this.logger.info('User logged out', { sessionId });
      }

      return removed;
    } catch (error) {
      await this.logger.error('Logout error', { error, sessionId });
      return false;
    }
  }

  /**
   * Generate secure JWT token
   */
  private generateJWT(user: any, sessionId: string): string {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      sessionId,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string, sessionId: string): string {
    const payload = {
      userId,
      sessionId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: '7d'
    });
  }

  /**
   * Calculate authentication risk score
   */
  private async calculateAuthRiskScore(
    user: any,
    clientInfo: { ipAddress: string; userAgent: string }
  ): Promise<number> {
    let riskScore = 0;

    // Geolocation risk (simplified)
    if (this.threatDetector.isHighRiskIP(clientInfo.ipAddress)) {
      riskScore += 0.3;
    }

    // Time-based risk (unusual login times)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 0.1;
    }

    // User agent risk
    if (this.threatDetector.isSuspiciousUserAgent(clientInfo.userAgent)) {
      riskScore += 0.2;
    }

    // Account history risk
    if (user.isNewAccount) {
      riskScore += 0.1;
    }

    // Previous failed attempts
    const attempts = this.loginAttempts.get(user.email);
    if (attempts && attempts.count > 0) {
      riskScore += Math.min(0.3, attempts.count * 0.1);
    }

    return Math.min(1.0, riskScore);
  }

  /**
   * Record failed login attempt
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    const now = new Date();
    const existing = this.loginAttempts.get(email) || { count: 0, lastAttempt: now };
    
    existing.count++;
    existing.lastAttempt = now;
    
    if (existing.count >= this.config.maxLoginAttempts) {
      existing.lockedUntil = new Date(now.getTime() + this.config.lockoutDuration);
    }
    
    this.loginAttempts.set(email, existing);
  }

  /**
   * Simulate user lookup (replace with actual database query)
   */
  private async lookupUser(email: string): Promise<any | null> {
    // This is a mock implementation - replace with actual database lookup
    const mockUsers = new Map([
      ['admin@example.com', {
        id: 'user_admin',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('admin123', this.config.bcryptRounds),
        roles: ['admin'],
        permissions: ['*'],
        isNewAccount: false
      }],
      ['user@example.com', {
        id: 'user_regular',
        email: 'user@example.com',
        passwordHash: await bcrypt.hash('user123', this.config.bcryptRounds),
        roles: ['user'],
        permissions: ['read:marketplace', 'create:review'],
        isNewAccount: false
      }]
    ]);

    return mockUsers.get(email) || null;
  }

  /**
   * Check implied permissions from roles
   */
  private checkImpliedPermissions(roles: string[], permission: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      moderator: ['read:*', 'write:reviews', 'delete:reviews'],
      user: ['read:marketplace', 'create:review', 'update:own_profile']
    };

    return roles.some(role => {
      const permissions = rolePermissions[role] || [];
      return permissions.includes('*') || 
             permissions.includes(permission) ||
             permissions.some(p => p.endsWith(':*') && permission.startsWith(p.split(':')[0] + ':'));
    });
  }

  /**
   * Check resource-specific access
   */
  private checkResourceAccess(context: SecurityContext, resource: string): boolean {
    // Implement resource-specific access control logic
    // This is a simplified example
    if (resource.startsWith('user:') && context.userId) {
      const resourceUserId = resource.split(':')[1];
      return resourceUserId === context.userId || context.permissions.includes('*');
    }
    return true;
  }

  /**
   * HTML sanitization
   */
  private sanitizeHtml<T>(input: T): T {
    if (typeof input === 'string') {
      return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;') as T;
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeHtml(item)) as T;
    }
    
    if (typeof input === 'object' && input !== null) {
      const result = {} as any;
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.sanitizeHtml(value);
      }
      return result;
    }
    
    return input;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, context] of this.activeSessions.entries()) {
      const age = now.getTime() - context.timestamp.getTime();
      if (age > this.config.sessionTimeout) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Cleanup permission cache
   */
  private cleanupPermissionCache(): void {
    const now = new Date();
    for (const [key, cache] of this.permissionCache.entries()) {
      if (cache.expires < now) {
        this.permissionCache.delete(key);
      }
    }
  }

  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics(): {
    activeSessions: number;
    failedAttempts: number;
    lockedAccounts: number;
    blacklistedTokens: number;
    cacheSize: number;
  } {
    const now = new Date();
    const lockedAccounts = Array.from(this.loginAttempts.values())
      .filter(attempt => attempt.lockedUntil && attempt.lockedUntil > now).length;

    return {
      activeSessions: this.activeSessions.size,
      failedAttempts: this.loginAttempts.size,
      lockedAccounts,
      blacklistedTokens: this.blacklistedTokens.size,
      cacheSize: this.permissionCache.size
    };
  }
}