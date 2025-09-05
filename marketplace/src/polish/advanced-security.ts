/**
 * Advanced Security System - Production Polish Feature
 * Comprehensive security with rate limiting, threat detection, and audit logging
 */

import { ref, reactive } from 'vue';
import * as crypto from 'crypto';

export interface SecurityPolicy {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    keyGenerator: (req: any) => string;
    message: string;
  };
  authentication: {
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      preventReuse: number;
    };
    sessionTimeout: number;
    mfaRequired: boolean;
  };
  authorization: {
    defaultRole: string;
    roleHierarchy: Record<string, string[]>;
    resourcePermissions: Record<string, string[]>;
  };
  dataProtection: {
    encryptionAlgorithm: string;
    keyRotationInterval: number;
    dataClassification: {
      public: string[];
      internal: string[];
      confidential: string[];
      restricted: string[];
    };
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    auditEvents: string[];
    alertThresholds: Record<string, number>;
    retentionPeriod: number;
  };
}

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'block' | 'quarantine' | 'alert';
  enabled: boolean;
  category: 'injection' | 'xss' | 'csrf' | 'dos' | 'brute_force' | 'anomaly';
}

export interface SecurityIncident {
  id: string;
  timestamp: Date;
  type: 'threat_detected' | 'policy_violation' | 'unauthorized_access' | 'data_breach' | 'system_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
  };
  details: {
    rule?: string;
    payload?: string;
    context?: Record<string, any>;
  };
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  actions: string[];
  assignee?: string;
  resolution?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  action: string;
  resource: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  status: 'success' | 'failure' | 'blocked';
  duration: number;
  request: {
    headers: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
  };
  response: {
    status: number;
    size: number;
  };
  metadata: Record<string, any>;
}

export interface RateLimitEntry {
  key: string;
  requests: number;
  resetTime: number;
  blocked: boolean;
}

export interface SecurityMetrics {
  threats: {
    total: number;
    blocked: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  authentication: {
    loginAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    lockedAccounts: number;
    mfaUsage: number;
  };
  rateLimit: {
    totalRequests: number;
    blockedRequests: number;
    topIPs: Array<{ ip: string; requests: number }>;
  };
  incidents: {
    open: number;
    resolved: number;
    averageResolutionTime: number;
  };
}

export class AdvancedSecurityManager {
  private policy: SecurityPolicy;
  private threatRules: Map<string, ThreatRule> = new Map();
  private incidents: Map<string, SecurityIncident> = new Map();
  private auditLogs: AuditLog[] = [];
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();
  private blockedIPs: Set<string> = new Set();
  private quarantinedSessions: Set<string> = new Set();
  private alertSubscribers: Set<(incident: SecurityIncident) => void> = new Set();

  constructor(policy: Partial<SecurityPolicy> = {}) {
    this.policy = this.mergeWithDefaults(policy);
    this.setupDefaultThreatRules();
    this.startBackgroundTasks();
    this.initializeEncryption();
  }

  /**
   * Validate and sanitize input data
   */
  validateInput(input: any, rules: {
    type: 'string' | 'number' | 'email' | 'url' | 'json';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    sanitize?: boolean;
    allowHTML?: boolean;
  }[]): {
    isValid: boolean;
    sanitizedData: any;
    errors: string[];
    threats: ThreatRule[];
  } {
    const errors: string[] = [];
    const detectedThreats: ThreatRule[] = [];
    let sanitizedData = input;

    // Check for threats first
    const threatResults = this.detectThreats(JSON.stringify(input));
    if (threatResults.threats.length > 0) {
      detectedThreats.push(...threatResults.threats);
      
      // Block high/critical threats immediately
      if (threatResults.threats.some(t => ['high', 'critical'].includes(t.riskLevel))) {
        return {
          isValid: false,
          sanitizedData: null,
          errors: ['Input contains security threats'],
          threats: detectedThreats
        };
      }
    }

    // Validate against rules
    rules.forEach(rule => {
      if (rule.required && (input === null || input === undefined || input === '')) {
        errors.push('Field is required');
        return;
      }

      if (input !== null && input !== undefined) {
        switch (rule.type) {
          case 'string':
            if (typeof input !== 'string') {
              errors.push('Must be a string');
            } else {
              if (rule.minLength && input.length < rule.minLength) {
                errors.push(`Minimum length is ${rule.minLength}`);
              }
              if (rule.maxLength && input.length > rule.maxLength) {
                errors.push(`Maximum length is ${rule.maxLength}`);
              }
              if (rule.pattern && !rule.pattern.test(input)) {
                errors.push('Invalid format');
              }
              if (rule.sanitize) {
                sanitizedData = this.sanitizeString(input, rule.allowHTML);
              }
            }
            break;
            
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(input))) {
              errors.push('Invalid email format');
            }
            break;
            
          case 'url':
            try {
              new URL(String(input));
            } catch {
              errors.push('Invalid URL format');
            }
            break;
            
          case 'json':
            try {
              JSON.parse(String(input));
            } catch {
              errors.push('Invalid JSON format');
            }
            break;
        }
      }
    });

    return {
      isValid: errors.length === 0,
      sanitizedData,
      errors,
      threats: detectedThreats
    };
  }

  /**
   * Check rate limits for requests
   */
  checkRateLimit(identifier: string, customLimit?: Partial<SecurityPolicy['rateLimit']>): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const config = { ...this.policy.rateLimit, ...customLimit };
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    
    let entry = this.rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Create or reset entry
      entry = {
        key,
        requests: 0,
        resetTime: now + config.windowMs,
        blocked: false
      };
    }

    entry.requests++;
    const remaining = Math.max(0, config.maxRequests - entry.requests);
    
    if (entry.requests > config.maxRequests) {
      entry.blocked = true;
      this.logIncident({
        type: 'threat_detected',
        severity: 'medium',
        source: { ip: identifier, userAgent: '' },
        details: {
          rule: 'rate_limit_exceeded',
          context: {
            requests: entry.requests,
            limit: config.maxRequests,
            window: config.windowMs
          }
        }
      });
      
      this.rateLimitStore.set(key, entry);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      };
    }

    this.rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining,
      resetTime: entry.resetTime
    };
  }

  /**
   * Detect security threats in content
   */
  detectThreats(content: string, context: Record<string, any> = {}): {
    threats: ThreatRule[];
    risk: 'low' | 'medium' | 'high' | 'critical';
    blocked: boolean;
  } {
    const detectedThreats: ThreatRule[] = [];
    let highestRisk: ThreatRule['riskLevel'] = 'low';
    
    this.threatRules.forEach(rule => {
      if (!rule.enabled) return;
      
      let matches = false;
      
      if (rule.pattern instanceof RegExp) {
        matches = rule.pattern.test(content);
      } else {
        matches = content.toLowerCase().includes(rule.pattern.toLowerCase());
      }
      
      if (matches) {
        detectedThreats.push(rule);
        
        if (this.getRiskLevel(rule.riskLevel) > this.getRiskLevel(highestRisk)) {
          highestRisk = rule.riskLevel;
        }
        
        // Log the threat
        this.logIncident({
          type: 'threat_detected',
          severity: rule.riskLevel,
          source: {
            ip: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            userId: context.userId,
            sessionId: context.sessionId
          },
          details: {
            rule: rule.id,
            payload: content.length > 1000 ? content.substring(0, 1000) + '...' : content,
            context
          }
        });
      }
    });
    
    const shouldBlock = detectedThreats.some(threat => 
      threat.action === 'block' || 
      (threat.action === 'quarantine' && ['high', 'critical'].includes(threat.riskLevel))
    );
    
    return {
      threats: detectedThreats,
      risk: highestRisk,
      blocked: shouldBlock
    };
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string, classification: keyof SecurityPolicy['dataProtection']['dataClassification'] = 'internal'): {
    encrypted: string;
    keyId: string;
    algorithm: string;
  } {
    const keyId = `${classification}_${Date.now()}`;
    let key = this.encryptionKeys.get(keyId);
    
    if (!key) {
      key = crypto.randomBytes(32);
      this.encryptionKeys.set(keyId, key);
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.policy.dataProtection.encryptionAlgorithm, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    const combined = iv.toString('hex') + ':' + encrypted;
    
    return {
      encrypted: combined,
      keyId,
      algorithm: this.policy.dataProtection.encryptionAlgorithm
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string, keyId: string): string {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error('Encryption key not found');
    }
    
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(this.policy.dataProtection.encryptionAlgorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Log security audit event
   */
  logAudit(event: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const auditEntry: AuditLog = {
      ...event,
      id: this.generateId(),
      timestamp: new Date()
    };
    
    this.auditLogs.push(auditEntry);
    
    // Keep only recent logs to prevent memory issues
    if (this.auditLogs.length > 10000) {
      this.auditLogs.splice(0, 1000);
    }
    
    // Check for suspicious patterns
    this.analyzeAuditPattern(auditEntry);
  }

  /**
   * Get security metrics and statistics
   */
  getSecurityMetrics(timeRange: { start: Date; end: Date }): SecurityMetrics {
    const incidents = Array.from(this.incidents.values())
      .filter(i => i.timestamp >= timeRange.start && i.timestamp <= timeRange.end);
    
    const auditLogs = this.auditLogs
      .filter(l => l.timestamp >= timeRange.start && l.timestamp <= timeRange.end);
    
    const threats = incidents.filter(i => i.type === 'threat_detected');
    const blocked = threats.filter(t => t.actions.includes('block'));
    
    const categoryCount: Record<string, number> = {};
    const severityCount: Record<string, number> = {};
    
    threats.forEach(threat => {
      const rule = this.threatRules.get(threat.details.rule || '');
      if (rule) {
        categoryCount[rule.category] = (categoryCount[rule.category] || 0) + 1;
      }
      severityCount[threat.severity] = (severityCount[threat.severity] || 0) + 1;
    });
    
    // Rate limit metrics
    const totalRequests = auditLogs.length;
    const blockedRequests = auditLogs.filter(l => l.status === 'blocked').length;
    
    const ipCount: Record<string, number> = {};
    auditLogs.forEach(log => {
      ipCount[log.ip] = (ipCount[log.ip] || 0) + 1;
    });
    
    const topIPs = Object.entries(ipCount)
      .map(([ip, requests]) => ({ ip, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
    
    // Authentication metrics
    const loginAttempts = auditLogs.filter(l => l.action === 'login').length;
    const successfulLogins = auditLogs.filter(l => l.action === 'login' && l.status === 'success').length;
    const failedLogins = loginAttempts - successfulLogins;
    
    // Incident metrics
    const openIncidents = incidents.filter(i => i.status === 'open').length;
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
    
    const resolutionTimes = resolvedIncidents.map(i => {
      // Calculate resolution time (placeholder)
      return 60; // minutes
    });
    
    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;
    
    return {
      threats: {
        total: threats.length,
        blocked: blocked.length,
        byCategory: categoryCount,
        bySeverity: severityCount
      },
      authentication: {
        loginAttempts,
        successfulLogins,
        failedLogins,
        lockedAccounts: 0, // Would track actual locked accounts
        mfaUsage: 0 // Would track MFA usage
      },
      rateLimit: {
        totalRequests,
        blockedRequests,
        topIPs
      },
      incidents: {
        open: openIncidents,
        resolved: resolvedIncidents.length,
        averageResolutionTime
      }
    };
  }

  /**
   * Add custom threat rule
   */
  addThreatRule(rule: ThreatRule): void {
    this.threatRules.set(rule.id, rule);
  }

  /**
   * Subscribe to security alerts
   */
  subscribeToAlerts(callback: (incident: SecurityIncident) => void): void {
    this.alertSubscribers.add(callback);
  }

  /**
   * Block IP address
   */
  blockIP(ip: string, reason: string): void {
    this.blockedIPs.add(ip);
    this.logIncident({
      type: 'policy_violation',
      severity: 'medium',
      source: { ip, userAgent: 'system' },
      details: {
        rule: 'ip_blocked',
        context: { reason }
      }
    });
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange: { start: Date; end: Date }): {
    summary: SecurityMetrics;
    topThreats: Array<{ rule: ThreatRule; count: number }>;
    recommendations: string[];
    complianceStatus: Record<string, boolean>;
  } {
    const metrics = this.getSecurityMetrics(timeRange);
    
    // Calculate top threats
    const threatCounts = new Map<string, number>();
    Array.from(this.incidents.values())
      .filter(i => i.timestamp >= timeRange.start && i.timestamp <= timeRange.end)
      .forEach(incident => {
        if (incident.details.rule) {
          threatCounts.set(incident.details.rule, (threatCounts.get(incident.details.rule) || 0) + 1);
        }
      });
    
    const topThreats = Array.from(threatCounts.entries())
      .map(([ruleId, count]) => ({
        rule: this.threatRules.get(ruleId)!,
        count
      }))
      .filter(item => item.rule)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (metrics.authentication.failedLogins > metrics.authentication.successfulLogins) {
      recommendations.push('High number of failed login attempts detected. Consider implementing additional security measures.');
    }
    
    if (metrics.threats.total > 100) {
      recommendations.push('High threat activity detected. Review and update threat detection rules.');
    }
    
    if (metrics.rateLimit.blockedRequests > metrics.rateLimit.totalRequests * 0.1) {
      recommendations.push('High rate limit violations. Consider adjusting rate limits or implementing additional protection.');
    }
    
    // Compliance status (placeholder)
    const complianceStatus = {
      'Data Encryption': this.encryptionKeys.size > 0,
      'Audit Logging': this.auditLogs.length > 0,
      'Threat Detection': this.threatRules.size > 0,
      'Rate Limiting': this.rateLimitStore.size > 0
    };
    
    return {
      summary: metrics,
      topThreats,
      recommendations,
      complianceStatus
    };
  }

  // Private helper methods
  private mergeWithDefaults(policy: Partial<SecurityPolicy>): SecurityPolicy {
    const defaults: SecurityPolicy = {
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req: any) => req.ip || 'anonymous',
        message: 'Too many requests, please try again later.'
      },
      authentication: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          preventReuse: 5
        },
        sessionTimeout: 24 * 60 * 60 * 1000,
        mfaRequired: false
      },
      authorization: {
        defaultRole: 'user',
        roleHierarchy: {
          'admin': ['user', 'moderator'],
          'moderator': ['user'],
          'user': []
        },
        resourcePermissions: {
          'admin': ['read', 'write', 'delete'],
          'moderator': ['read', 'write'],
          'user': ['read']
        }
      },
      dataProtection: {
        encryptionAlgorithm: 'aes-256-cbc',
        keyRotationInterval: 7 * 24 * 60 * 60 * 1000,
        dataClassification: {
          public: ['name', 'email'],
          internal: ['preferences', 'activity'],
          confidential: ['financial', 'personal'],
          restricted: ['credentials', 'tokens']
        }
      },
      monitoring: {
        logLevel: 'info',
        auditEvents: ['login', 'logout', 'create', 'update', 'delete'],
        alertThresholds: {
          'failed_logins': 10,
          'threats_per_hour': 50,
          'error_rate': 0.05
        },
        retentionPeriod: 90 * 24 * 60 * 60 * 1000
      }
    };

    return {
      ...defaults,
      ...policy,
      rateLimit: { ...defaults.rateLimit, ...policy.rateLimit },
      authentication: { ...defaults.authentication, ...policy.authentication },
      authorization: { ...defaults.authorization, ...policy.authorization },
      dataProtection: { ...defaults.dataProtection, ...policy.dataProtection },
      monitoring: { ...defaults.monitoring, ...policy.monitoring }
    };
  }

  private setupDefaultThreatRules(): void {
    const rules: ThreatRule[] = [
      {
        id: 'sql_injection',
        name: 'SQL Injection',
        description: 'Detects potential SQL injection attempts',
        pattern: /(union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|exec\s*\(|script\s*\()/i,
        riskLevel: 'high',
        action: 'block',
        enabled: true,
        category: 'injection'
      },
      {
        id: 'xss_attempt',
        name: 'Cross-Site Scripting',
        description: 'Detects XSS attempts',
        pattern: /(<script|javascript:|on\w+\s*=|<iframe|<object)/i,
        riskLevel: 'high',
        action: 'block',
        enabled: true,
        category: 'xss'
      },
      {
        id: 'directory_traversal',
        name: 'Directory Traversal',
        description: 'Detects directory traversal attempts',
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
        riskLevel: 'medium',
        action: 'block',
        enabled: true,
        category: 'injection'
      },
      {
        id: 'suspicious_user_agent',
        name: 'Suspicious User Agent',
        description: 'Detects suspicious or malicious user agents',
        pattern: /(sqlmap|nmap|nikto|burp|acunetix|nessus)/i,
        riskLevel: 'medium',
        action: 'log',
        enabled: true,
        category: 'anomaly'
      }
    ];

    rules.forEach(rule => this.threatRules.set(rule.id, rule));
  }

  private startBackgroundTasks(): void {
    // Clean up expired rate limit entries
    setInterval(() => {
      const now = Date.now();
      this.rateLimitStore.forEach((entry, key) => {
        if (now > entry.resetTime) {
          this.rateLimitStore.delete(key);
        }
      });
    }, 60000); // Every minute

    // Rotate encryption keys
    setInterval(() => {
      this.rotateEncryptionKeys();
    }, this.policy.dataProtection.keyRotationInterval);

    // Clean up old audit logs
    setInterval(() => {
      const cutoff = new Date(Date.now() - this.policy.monitoring.retentionPeriod);
      this.auditLogs = this.auditLogs.filter(log => log.timestamp >= cutoff);
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private initializeEncryption(): void {
    // Generate initial encryption keys for each classification level
    Object.keys(this.policy.dataProtection.dataClassification).forEach(level => {
      const keyId = `${level}_${Date.now()}`;
      const key = crypto.randomBytes(32);
      this.encryptionKeys.set(keyId, key);
    });
  }

  private logIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'status' | 'actions'>): void {
    const fullIncident: SecurityIncident = {
      ...incident,
      id: this.generateId(),
      timestamp: new Date(),
      status: 'open',
      actions: []
    };

    this.incidents.set(fullIncident.id, fullIncident);

    // Notify subscribers
    this.alertSubscribers.forEach(callback => {
      try {
        callback(fullIncident);
      } catch (error) {
        console.error('Error in security alert callback:', error);
      }
    });
  }

  private sanitizeString(input: string, allowHTML = false): string {
    if (!allowHTML) {
      return input
        .replace(/[<>]/g, '')
        .replace(/[&]/g, '&amp;')
        .replace(/['"]/g, (match) => match === '"' ? '&quot;' : '&#x27;');
    }
    
    // Basic HTML sanitization (in production, use a proper library like DOMPurify)
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  private getRiskLevel(risk: ThreatRule['riskLevel']): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[risk] || 1;
  }

  private analyzeAuditPattern(entry: AuditLog): void {
    // Check for suspicious patterns
    const recentLogs = this.auditLogs
      .filter(log => 
        log.ip === entry.ip && 
        log.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );

    // Check for brute force attempts
    const failedLogins = recentLogs
      .filter(log => log.action === 'login' && log.status === 'failure');

    if (failedLogins.length >= this.policy.authentication.maxLoginAttempts) {
      this.logIncident({
        type: 'threat_detected',
        severity: 'high',
        source: {
          ip: entry.ip,
          userAgent: entry.userAgent,
          userId: entry.userId,
          sessionId: entry.sessionId
        },
        details: {
          rule: 'brute_force_detected',
          context: {
            attempts: failedLogins.length,
            timeWindow: '1 hour'
          }
        }
      });
    }
  }

  private rotateEncryptionKeys(): void {
    // Generate new keys for each classification level
    Object.keys(this.policy.dataProtection.dataClassification).forEach(level => {
      const keyId = `${level}_${Date.now()}`;
      const key = crypto.randomBytes(32);
      this.encryptionKeys.set(keyId, key);
    });

    // Clean up old keys (keep last 3 generations)
    const keysByLevel = new Map<string, string[]>();
    this.encryptionKeys.forEach((_, keyId) => {
      const level = keyId.split('_')[0];
      if (!keysByLevel.has(level)) {
        keysByLevel.set(level, []);
      }
      keysByLevel.get(level)!.push(keyId);
    });

    keysByLevel.forEach((keys, level) => {
      keys.sort().reverse(); // Most recent first
      if (keys.length > 3) {
        keys.slice(3).forEach(keyId => {
          this.encryptionKeys.delete(keyId);
        });
      }
    });
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

/**
 * Vue 3 Composable
 */
export function useAdvancedSecurity(policy?: Partial<SecurityPolicy>) {
  const manager = reactive(new AdvancedSecurityManager(policy));
  const isSecurityEnabled = ref(true);
  const recentIncidents = ref<SecurityIncident[]>([]);

  const validateInput = (input: any, rules: Parameters<AdvancedSecurityManager['validateInput']>[1]) => {
    return manager.validateInput(input, rules);
  };

  const checkRateLimit = (identifier: string, customLimit?: any) => {
    return manager.checkRateLimit(identifier, customLimit);
  };

  const detectThreats = (content: string, context?: Record<string, any>) => {
    return manager.detectThreats(content, context);
  };

  const encryptData = (data: string, classification?: keyof SecurityPolicy['dataProtection']['dataClassification']) => {
    return manager.encrypt(data, classification);
  };

  const decryptData = (encryptedData: string, keyId: string) => {
    return manager.decrypt(encryptedData, keyId);
  };

  const logAudit = (event: Parameters<AdvancedSecurityManager['logAudit']>[0]) => {
    manager.logAudit(event);
  };

  const getMetrics = (timeRange: { start: Date; end: Date }) => {
    return manager.getSecurityMetrics(timeRange);
  };

  const generateReport = (timeRange: { start: Date; end: Date }) => {
    return manager.generateSecurityReport(timeRange);
  };

  const blockIP = (ip: string, reason: string) => {
    manager.blockIP(ip, reason);
  };

  const subscribeToAlerts = (callback: (incident: SecurityIncident) => void) => {
    manager.subscribeToAlerts(callback);
  };

  // Update recent incidents
  manager.subscribeToAlerts((incident) => {
    recentIncidents.value.unshift(incident);
    if (recentIncidents.value.length > 100) {
      recentIncidents.value = recentIncidents.value.slice(0, 100);
    }
  });

  return {
    validateInput,
    checkRateLimit,
    detectThreats,
    encryptData,
    decryptData,
    logAudit,
    getMetrics,
    generateReport,
    blockIP,
    subscribeToAlerts,
    isSecurityEnabled: readonly(isSecurityEnabled),
    recentIncidents: readonly(recentIncidents)
  };
}