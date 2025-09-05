/**
 * Main Security-Enhanced Marketplace System
 * Enterprise-grade security implementation with comprehensive protection
 */

import { SecurityManager } from './security/SecurityManager';
import { RateLimiter } from './security/RateLimiter';
import { ThreatDetector } from './security/ThreatDetector';
import { Encryptor } from './security/Encryptor';
import { InputValidator } from './validation/InputValidator';
import { SecurityMiddleware } from './middleware/SecurityMiddleware';
import { Logger } from './monitoring/Logger';
import { HealthCheckService } from './monitoring/HealthCheck';
import { ComplianceManager } from './compliance/ComplianceManager';
import { TransactionEngine } from './transaction-engine';
import { DimensionalSearchEngine } from './dimensional-search';

// Security Configuration
export const defaultSecurityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-here',
  jwtExpiresIn: '24h',
  bcryptRounds: 12,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  rateLimits: {
    auth: { windowMs: 15 * 60 * 1000, max: 10 },
    api: { windowMs: 15 * 60 * 1000, max: 1000 },
    search: { windowMs: 15 * 60 * 1000, max: 100 }
  },
  encryptionKey: process.env.ENCRYPTION_KEY || 'a'.repeat(64),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  trustProxyCount: parseInt(process.env.TRUST_PROXY_COUNT || '1')
};

// Compliance Configuration
export const defaultComplianceConfig = {
  frameworks: ['GDPR', 'SOC2'] as const,
  dataRetention: {
    defaultPeriodDays: 365,
    categories: {
      user_data: 730,          // 2 years
      transaction_data: 2555,  // 7 years
      audit_logs: 1095,       // 3 years
      security_logs: 365      // 1 year
    }
  },
  dataClassification: {
    levels: ['public', 'internal', 'confidential', 'restricted'] as const,
    defaultLevel: 'internal'
  },
  auditLog: {
    enabled: true,
    retentionDays: 90,
    encryptionRequired: true
  },
  dataProcessing: {
    lawfulBases: ['consent', 'contract', 'legal_obligation'],
    consentRequired: true,
    anonymizationRequired: false
  }
};

/**
 * Main Security-Enhanced Marketplace System
 */
export class SecureMarketplaceSystem {
  private logger: Logger;
  private encryptor: Encryptor;
  private securityManager: SecurityManager;
  private securityMiddleware: SecurityMiddleware;
  private healthCheck: HealthCheckService;
  private complianceManager: ComplianceManager;
  private transactionEngine: TransactionEngine;
  private searchEngine?: DimensionalSearchEngine;

  constructor(
    securityConfig = defaultSecurityConfig,
    complianceConfig = defaultComplianceConfig
  ) {
    // Initialize core security components
    this.logger = new Logger({ 
      service: 'SecureMarketplace',
      level: 'info',
      outputs: [
        { type: 'console', config: {} },
        { type: 'file', config: { filename: 'marketplace.log', directory: './logs' } }
      ]
    });

    this.encryptor = new Encryptor(securityConfig.encryptionKey);
    this.securityManager = new SecurityManager(securityConfig);
    this.securityMiddleware = new SecurityMiddleware(this.securityManager);
    
    // Initialize monitoring and compliance
    this.healthCheck = new HealthCheckService();
    this.complianceManager = new ComplianceManager(complianceConfig, this.encryptor);
    
    // Initialize business logic components
    this.transactionEngine = new TransactionEngine();

    this.logger.info('Secure Marketplace System initialized', {
      frameworks: complianceConfig.frameworks,
      securityFeatures: [
        'JWT Authentication',
        'RBAC Authorization',
        'Rate Limiting',
        'Threat Detection',
        'Data Encryption',
        'Input Validation',
        'Audit Logging',
        'Compliance Management'
      ]
    });
  }

  /**
   * Initialize search engine with products
   */
  initializeSearch(products: any[]): void {
    this.searchEngine = new DimensionalSearchEngine(products);
    this.logger.info('Search engine initialized', { productCount: products.length });
  }

  /**
   * Get security middleware stack for Express integration
   */
  getSecurityMiddleware() {
    return this.securityMiddleware.createSecurityStack();
  }

  /**
   * Create authorization middleware for specific permissions
   */
  createAuthorizationMiddleware(permissions: string[], resource?: string) {
    return this.securityMiddleware.createAuthorizationMiddleware(permissions, resource);
  }

  /**
   * Get health check endpoint middleware
   */
  getHealthCheckEndpoint() {
    return this.healthCheck.createMiddleware();
  }

  /**
   * Authenticate user
   */
  async authenticateUser(email: string, password: string, context: {
    ipAddress: string;
    userAgent: string;
  }) {
    return await this.securityManager.authenticate(email, password, context);
  }

  /**
   * Validate user token
   */
  async validateToken(token: string) {
    return await this.securityManager.validateToken(token);
  }

  /**
   * Process secure transaction
   */
  async processTransaction(transactionContext: any) {
    // Add audit logging for all transaction attempts
    await this.logger.audit('Transaction initiated', {
      buyerId: transactionContext.buyer.id,
      sellerId: transactionContext.seller.id,
      productId: transactionContext.product.id,
      amount: transactionContext.quantity
    });

    try {
      const result = await this.transactionEngine.createTransaction(transactionContext);
      
      if (result.success) {
        await this.logger.audit('Transaction completed successfully', {
          transactionId: result.transaction.id,
          finalPrice: result.transaction.pricing.final
        });
        
        // Process the transaction
        const processed = await this.transactionEngine.processTransaction(result.transaction.id);
        
        if (processed) {
          await this.logger.audit('Transaction processed', {
            transactionId: result.transaction.id,
            status: 'confirmed'
          });
        }
      } else {
        await this.logger.warn('Transaction failed', {
          errors: result.errors,
          context: transactionContext
        });
      }

      return result;
    } catch (error) {
      await this.logger.error('Transaction processing error', { 
        error: error.message,
        context: transactionContext 
      });
      throw error;
    }
  }

  /**
   * Search products with security validation
   */
  async searchProducts(query: any, user?: any) {
    if (!this.searchEngine) {
      throw new Error('Search engine not initialized');
    }

    // Validate search query for security threats
    const validator = new InputValidator();
    const validation = await validator.validateSecurity(JSON.stringify(query));
    
    if (!validation.safe) {
      await this.logger.security('Malicious search query detected', {
        query,
        threats: validation.issues.map(i => i.type),
        user: user?.id
      });
      throw new Error('Invalid search query');
    }

    // Log search activity
    await this.logger.audit('Product search performed', {
      userId: user?.id,
      queryType: Object.keys(query.dimensions || {}).join(','),
      filters: Object.keys(query.filters || {}).join(',')
    });

    return await this.searchEngine.search(query, user);
  }

  /**
   * Register new data subject for GDPR compliance
   */
  async registerDataSubject(subjectData: {
    email?: string;
    identifiers: Record<string, string>;
    dataCategories: string[];
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
  }) {
    return await this.complianceManager.registerDataSubject(subjectData);
  }

  /**
   * Handle GDPR subject access request
   */
  async handleSubjectAccessRequest(subjectId: string) {
    return await this.complianceManager.handleAccessRequest(subjectId);
  }

  /**
   * Handle GDPR data erasure request
   */
  async handleDataErasureRequest(subjectId: string, reason: string) {
    return await this.complianceManager.handleErasureRequest(subjectId, reason);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    framework: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS' | 'ISO27001' | 'CCPA',
    period: { start: Date; end: Date }
  ) {
    return await this.complianceManager.generateComplianceReport(framework, period);
  }

  /**
   * Get system security metrics
   */
  getSecurityMetrics() {
    return {
      security: this.securityManager.getSecurityMetrics(),
      encryption: this.encryptor.getStatistics(),
      compliance: this.complianceManager.getStatistics(),
      health: this.healthCheck.getStatistics()
    };
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string, options?: any) {
    return await this.encryptor.encrypt(data, options);
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: any, options?: any) {
    return await this.encryptor.decrypt(encryptedData, options);
  }

  /**
   * Start monitoring services
   */
  startMonitoring() {
    this.healthCheck.startPeriodicChecks();
    this.logger.info('Monitoring services started');
  }

  /**
   * Stop monitoring services
   */
  stopMonitoring() {
    this.healthCheck.stopPeriodicChecks();
    this.logger.info('Monitoring services stopped');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    await this.logger.info('Initiating graceful shutdown');
    
    this.stopMonitoring();
    
    // Add any cleanup logic here
    
    await this.logger.info('Graceful shutdown completed');
  }
}

// Export all components for individual use
export {
  SecurityManager,
  RateLimiter,
  ThreatDetector,
  Encryptor,
  InputValidator,
  SecurityMiddleware,
  Logger,
  HealthCheckService,
  ComplianceManager,
  TransactionEngine,
  DimensionalSearchEngine
};

// Default export
export default SecureMarketplaceSystem;