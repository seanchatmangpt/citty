/**
 * Comprehensive Security Middleware
 * Implements request/response filtering, CORS, CSP, and security headers
 */

import type { Request, Response, NextFunction } from 'express';
import { SecurityManager } from '../security/SecurityManager';
import { RateLimiter } from '../security/RateLimiter';
import { InputValidator } from '../validation/InputValidator';
import { Logger } from '../monitoring/Logger';
import { z } from 'zod';

export interface SecurityMiddlewareConfig {
  cors: {
    origins: string[];
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  csp: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  requestValidation: {
    maxBodySize: string;
    maxParamLength: number;
    maxHeaderSize: number;
    allowedContentTypes: string[];
  };
  security: {
    trustProxy: number;
    helmet: boolean;
    noSniff: boolean;
    xssFilter: boolean;
    hsts: boolean;
    frameOptions: 'deny' | 'sameorigin' | 'allow-from';
  };
}

export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig;
  private securityManager: SecurityManager;
  private rateLimiter: RateLimiter;
  private validator: InputValidator;
  private logger: Logger;

  constructor(
    securityManager: SecurityManager,
    config: Partial<SecurityMiddlewareConfig> = {}
  ) {
    this.securityManager = securityManager;
    this.rateLimiter = new RateLimiter();
    this.validator = new InputValidator();
    this.logger = new Logger({ service: 'SecurityMiddleware' });

    this.config = {
      cors: {
        origins: ['http://localhost:3000', 'https://citty-marketplace.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'X-API-Key'
        ],
        exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
        credentials: true,
        maxAge: 86400,
        ...config.cors
      },
      csp: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://trusted-scripts.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://trusted-styles.com'],
        imgSrc: ["'self'", 'data:', 'https://trusted-images.com'],
        connectSrc: ["'self'", 'https://api.citty-marketplace.com'],
        fontSrc: ["'self'", 'https://fonts.googleapis.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        ...config.csp
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // requests per window
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        ...config.rateLimit
      },
      requestValidation: {
        maxBodySize: '10mb',
        maxParamLength: 1000,
        maxHeaderSize: 8192,
        allowedContentTypes: [
          'application/json',
          'application/x-www-form-urlencoded',
          'multipart/form-data',
          'text/plain'
        ],
        ...config.requestValidation
      },
      security: {
        trustProxy: 1,
        helmet: true,
        noSniff: true,
        xssFilter: true,
        hsts: true,
        frameOptions: 'deny',
        ...config.security
      }
    };
  }

  /**
   * Main security middleware stack
   */
  createSecurityStack() {
    return [
      this.setupTrustProxy(),
      this.corsHandler(),
      this.securityHeaders(),
      this.rateLimitHandler(),
      this.requestValidator(),
      this.authenticationHandler(),
      this.inputSanitizer(),
      this.threatDetectionHandler()
    ];
  }

  /**
   * Trust proxy configuration
   */
  private setupTrustProxy() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.config.security.trustProxy) {
        req.app.set('trust proxy', this.config.security.trustProxy);
      }
      next();
    };
  }

  /**
   * CORS handler with advanced configuration
   */
  private corsHandler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const { cors } = this.config;

      // Check if origin is allowed
      const isAllowedOrigin = !origin || 
        cors.origins.includes(origin) || 
        cors.origins.includes('*') ||
        (cors.origins.some(allowed => allowed.includes('*')) && 
         this.matchWildcardOrigin(origin, cors.origins));

      if (!isAllowedOrigin) {
        await this.logger.security('CORS_ORIGIN_BLOCKED', {
          origin,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
      }

      // Set CORS headers
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Credentials', cors.credentials.toString());
      res.header('Access-Control-Allow-Methods', cors.methods.join(', '));
      res.header('Access-Control-Allow-Headers', cors.allowedHeaders.join(', '));
      res.header('Access-Control-Expose-Headers', cors.exposedHeaders.join(', '));
      res.header('Access-Control-Max-Age', cors.maxAge.toString());

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      next();
    };
  }

  /**
   * Security headers middleware
   */
  private securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      const { security, csp } = this.config;

      // Content Security Policy
      const cspString = Object.entries(csp)
        .map(([directive, sources]) => {
          const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${kebabDirective} ${sources.join(' ')}`;
        })
        .join('; ');
      res.header('Content-Security-Policy', cspString);

      // Strict Transport Security
      if (security.hsts) {
        res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      // X-Content-Type-Options
      if (security.noSniff) {
        res.header('X-Content-Type-Options', 'nosniff');
      }

      // X-XSS-Protection
      if (security.xssFilter) {
        res.header('X-XSS-Protection', '1; mode=block');
      }

      // X-Frame-Options
      res.header('X-Frame-Options', security.frameOptions.toUpperCase());

      // Additional security headers
      res.header('X-DNS-Prefetch-Control', 'off');
      res.header('X-Download-Options', 'noopen');
      res.header('X-Permitted-Cross-Domain-Policies', 'none');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  private rateLimitHandler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const identifier = `${req.ip}:${req.path}`;
        const result = await this.rateLimiter.checkLimit(
          identifier,
          this.config.rateLimit.max,
          this.config.rateLimit.windowMs
        );

        // Set rate limit headers
        res.header('X-Rate-Limit-Limit', this.config.rateLimit.max.toString());
        res.header('X-Rate-Limit-Remaining', result.remainingPoints.toString());
        res.header('X-Rate-Limit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());

        if (!result.allowed) {
          await this.logger.security('RATE_LIMIT_EXCEEDED', {
            ip: req.ip,
            path: req.path,
            totalHits: result.totalHits
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(result.msBeforeNext / 1000)
          });
        }

        // Check for DDoS patterns
        const ddosCheck = await this.rateLimiter.checkDDoSProtection(identifier, result.totalHits / 60);
        if (ddosCheck.blocked) {
          await this.logger.security('DDOS_ATTACK_BLOCKED', {
            ip: req.ip,
            reason: ddosCheck.reason,
            mitigationLevel: ddosCheck.mitigationLevel
          });

          return res.status(429).json({
            error: 'Request blocked due to suspicious activity',
            reason: ddosCheck.reason
          });
        }

        next();
      } catch (error) {
        await this.logger.error('Rate limiting error', { error, ip: req.ip });
        next(); // Fail open for rate limiting
      }
    };
  }

  /**
   * Request validation middleware
   */
  private requestValidator() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { requestValidation } = this.config;

        // Validate content type
        const contentType = req.headers['content-type']?.split(';')[0];
        if (req.body && contentType && !requestValidation.allowedContentTypes.includes(contentType)) {
          return res.status(400).json({ error: 'Unsupported content type' });
        }

        // Validate request size
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxBytes = this.parseSize(requestValidation.maxBodySize);
        if (contentLength > maxBytes) {
          return res.status(413).json({ error: 'Request entity too large' });
        }

        // Validate headers size
        const headersSize = JSON.stringify(req.headers).length;
        if (headersSize > requestValidation.maxHeaderSize) {
          return res.status(431).json({ error: 'Request headers too large' });
        }

        // Validate URL parameters
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string' && value.length > requestValidation.maxParamLength) {
            return res.status(400).json({ error: `Parameter '${key}' too long` });
          }
        }

        // Validate query parameters
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string' && value.length > requestValidation.maxParamLength) {
            return res.status(400).json({ error: `Query parameter '${key}' too long` });
          }
        }

        next();
      } catch (error) {
        await this.logger.error('Request validation error', { error, path: req.path });
        return res.status(400).json({ error: 'Invalid request format' });
      }
    };
  }

  /**
   * Authentication middleware
   */
  private authenticationHandler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          // For public endpoints, continue without authentication
          if (this.isPublicEndpoint(req.path)) {
            return next();
          }
          return res.status(401).json({ error: 'Authentication required' });
        }

        const context = await this.securityManager.validateToken(token);
        if (!context) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Add security context to request
        (req as any).securityContext = context;
        next();
      } catch (error) {
        await this.logger.error('Authentication error', { error, path: req.path });
        return res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }

  /**
   * Input sanitization middleware
   */
  private inputSanitizer() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.body) {
          const sanitized = await this.sanitizeInput(req.body);
          req.body = sanitized.data;
        }

        if (req.query) {
          const sanitized = await this.sanitizeInput(req.query);
          req.query = sanitized.data;
        }

        if (req.params) {
          const sanitized = await this.sanitizeInput(req.params);
          req.params = sanitized.data;
        }

        next();
      } catch (error) {
        await this.logger.error('Input sanitization error', { error, path: req.path });
        return res.status(400).json({ error: 'Invalid input data' });
      }
    };
  }

  /**
   * Threat detection middleware
   */
  private threatDetectionHandler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const inputData = JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params
        });

        const threats = await this.securityManager['threatDetector'].detectThreats(inputData, {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          userId: (req as any).securityContext?.userId,
          endpoint: req.path
        });

        // Block critical threats
        const criticalThreats = threats.filter(t => t.severity === 'critical');
        if (criticalThreats.length > 0) {
          await this.logger.security('CRITICAL_THREAT_BLOCKED', {
            ip: req.ip,
            path: req.path,
            threats: criticalThreats.map(t => t.threatType)
          });

          return res.status(403).json({
            error: 'Request blocked due to security threat',
            threatTypes: criticalThreats.map(t => t.threatType)
          });
        }

        // Log high-severity threats
        const highThreats = threats.filter(t => t.severity === 'high');
        if (highThreats.length > 0) {
          await this.logger.security('HIGH_SEVERITY_THREAT_DETECTED', {
            ip: req.ip,
            path: req.path,
            threats: highThreats.map(t => t.threatType)
          });
        }

        next();
      } catch (error) {
        await this.logger.error('Threat detection error', { error, path: req.path });
        next(); // Continue processing if threat detection fails
      }
    };
  }

  /**
   * Authorization middleware factory
   */
  createAuthorizationMiddleware(requiredPermissions: string[], resource?: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = (req as any).securityContext;
        if (!context) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const resourcePath = resource || req.path;
        const authResult = await this.securityManager.authorize(
          context,
          requiredPermissions,
          resourcePath
        );

        if (!authResult.authorized) {
          await this.logger.security('AUTHORIZATION_FAILED', {
            userId: context.userId,
            path: req.path,
            requiredPermissions,
            reason: authResult.reason
          });

          return res.status(403).json({
            error: 'Insufficient permissions',
            required: authResult.requiredPermissions,
            message: authResult.reason
          });
        }

        next();
      } catch (error) {
        await this.logger.error('Authorization error', { error, path: req.path });
        return res.status(403).json({ error: 'Authorization failed' });
      }
    };
  }

  /**
   * Error handling middleware
   */
  errorHandler() {
    return async (error: any, req: Request, res: Response, next: NextFunction) => {
      await this.logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      const message = isDevelopment ? error.message : 'Internal server error';

      res.status(error.status || 500).json({
        error: message,
        ...(isDevelopment && { stack: error.stack })
      });
    };
  }

  /**
   * Utility methods
   */
  private extractToken(req: Request): string | null {
    // Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // API key in X-API-Key header
    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      return apiKey;
    }

    // Token in query parameter
    const queryToken = req.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private isPublicEndpoint(path: string): boolean {
    const publicPaths = [
      '/health',
      '/metrics',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/marketplace/search',
      '/api/v1/marketplace/items',
      '/docs',
      '/swagger'
    ];

    return publicPaths.some(publicPath => 
      path === publicPath || 
      path.startsWith(publicPath + '/')
    );
  }

  private matchWildcardOrigin(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.some(allowed => {
      if (!allowed.includes('*')) return false;
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    });
  }

  private parseSize(size: string): number {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const match = size.toLowerCase().match(/^(\d+)([a-z]*)$/);
    if (!match) return 0;
    
    const [, num, unit] = match;
    return parseInt(num) * (units[unit as keyof typeof units] || 1);
  }

  private async sanitizeInput(input: any): Promise<{ data: any; warnings: string[] }> {
    const schema = z.any();
    const result = await this.validator.validate(input, schema, {
      sanitize: true,
      checkXss: true,
      checkSqlInjection: true,
      checkPathTraversal: true
    });

    return {
      data: result.sanitized || input,
      warnings: result.warnings
    };
  }

  /**
   * Get middleware statistics
   */
  getStatistics(): {
    requestsProcessed: number;
    threatsBlocked: number;
    rateLimit: any;
  } {
    return {
      requestsProcessed: 0, // Would track this in production
      threatsBlocked: 0,    // Would track this in production
      rateLimit: this.rateLimiter.getStatistics()
    };
  }
}