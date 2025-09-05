/**
 * Comprehensive Security Test Suite
 * Tests all security components including authentication, authorization, encryption, and threat detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityManager } from '../../src/security/SecurityManager';
import { RateLimiter } from '../../src/security/RateLimiter';
import { ThreatDetector } from '../../src/security/ThreatDetector';
import { Encryptor } from '../../src/security/Encryptor';
import { InputValidator } from '../../src/validation/InputValidator';
import { SecurityMiddleware } from '../../src/middleware/SecurityMiddleware';
import { ComplianceManager } from '../../src/compliance/ComplianceManager';

// Mock configurations
const mockSecurityConfig = {
  jwtSecret: 'test-jwt-secret-key-that-is-long-enough-for-security-testing',
  jwtExpiresIn: '1h',
  bcryptRounds: 4, // Lower for testing
  sessionTimeout: 60 * 60 * 1000, // 1 hour
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  rateLimits: {
    auth: { windowMs: 15 * 60 * 1000, max: 10 },
    api: { windowMs: 15 * 60 * 1000, max: 100 },
    search: { windowMs: 15 * 60 * 1000, max: 50 }
  },
  encryptionKey: 'a'.repeat(64), // 32 bytes in hex
  corsOrigins: ['http://localhost:3000'],
  trustProxyCount: 1
};

const mockComplianceConfig = {
  frameworks: ['GDPR', 'SOC2'] as const,
  dataRetention: {
    defaultPeriodDays: 365,
    categories: {
      user_data: 730,
      transaction_data: 2555, // 7 years
      audit_logs: 1095 // 3 years
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

describe('Security Manager', () => {
  let securityManager: SecurityManager;
  let encryptor: Encryptor;

  beforeEach(() => {
    encryptor = new Encryptor(mockSecurityConfig.encryptionKey);
    securityManager = new SecurityManager(mockSecurityConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should validate and sanitize input correctly', async () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const schema = { type: 'string' };
      
      const result = await securityManager.validateAndSanitizeInput(
        maliciousInput,
        schema as any,
        { sanitizeHtml: true, checkXss: true }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('XSS'));
      expect(result.sanitized).not.toContain('<script>');
    });

    it('should detect SQL injection attempts', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const schema = { type: 'string' };
      
      const result = await securityManager.validateAndSanitizeInput(
        sqlInjection,
        schema as any,
        { checkSqlInjection: true }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('SQL injection'));
    });

    it('should detect path traversal attempts', async () => {
      const pathTraversal = '../../../etc/passwd';
      const schema = { type: 'string' };
      
      const result = await securityManager.validateAndSanitizeInput(
        pathTraversal,
        schema as any,
        { checkPathTraversal: true }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Path traversal'));
    });
  });

  describe('Authentication', () => {
    it('should authenticate valid credentials', async () => {
      const result = await securityManager.authenticate(
        'admin@example.com',
        'admin123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        }
      );

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user!.email).toBe('admin@example.com');
    });

    it('should reject invalid credentials', async () => {
      const result = await securityManager.authenticate(
        'admin@example.com',
        'wrongpassword',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.token).toBeUndefined();
    });

    it('should implement account lockout after failed attempts', async () => {
      const context = {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await securityManager.authenticate(
          'admin@example.com',
          'wrongpassword',
          context
        );
      }

      // Next attempt should be locked out
      const result = await securityManager.authenticate(
        'admin@example.com',
        'admin123', // Even correct password
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    it('should validate JWT tokens correctly', async () => {
      // First authenticate to get a token
      const authResult = await securityManager.authenticate(
        'admin@example.com',
        'admin123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        }
      );

      expect(authResult.success).toBe(true);
      const token = authResult.token!;

      // Validate the token
      const context = await securityManager.validateToken(token);
      expect(context).toBeDefined();
      expect(context!.userId).toBe('user_admin');
      expect(context!.authenticated).toBe(true);
    });

    it('should reject expired or invalid tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      const context = await securityManager.validateToken(invalidToken);
      expect(context).toBeNull();
    });
  });

  describe('Authorization', () => {
    let validContext: any;

    beforeEach(async () => {
      const authResult = await securityManager.authenticate(
        'admin@example.com',
        'admin123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        }
      );
      
      validContext = await securityManager.validateToken(authResult.token!);
    });

    it('should authorize users with correct permissions', async () => {
      const result = await securityManager.authorize(
        validContext,
        ['read:marketplace']
      );

      expect(result.authorized).toBe(true);
    });

    it('should deny access to users without required permissions', async () => {
      const result = await securityManager.authorize(
        validContext,
        ['delete:everything']
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Insufficient permissions');
    });

    it('should handle resource-specific authorization', async () => {
      const result = await securityManager.authorize(
        validContext,
        ['read:user'],
        'user:user_admin' // Same user
      );

      expect(result.authorized).toBe(true);
    });
  });
});

describe('Rate Limiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  describe('Sliding Window Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const identifier = 'test:192.168.1.1';
      const max = 5;
      const windowMs = 60000;

      for (let i = 0; i < max; i++) {
        const result = await rateLimiter.checkLimit(identifier, max, windowMs, 'sliding-window');
        expect(result.allowed).toBe(true);
        expect(result.remainingPoints).toBe(max - (i + 1));
      }
    });

    it('should block requests exceeding limit', async () => {
      const identifier = 'test:192.168.1.2';
      const max = 3;
      const windowMs = 60000;

      // Exhaust the limit
      for (let i = 0; i < max; i++) {
        await rateLimiter.checkLimit(identifier, max, windowMs, 'sliding-window');
      }

      // Next request should be blocked
      const result = await rateLimiter.checkLimit(identifier, max, windowMs, 'sliding-window');
      expect(result.allowed).toBe(false);
      expect(result.remainingPoints).toBe(0);
    });
  });

  describe('DDoS Protection', () => {
    it('should detect rapid requests as suspicious', async () => {
      const identifier = 'ddos:192.168.1.3';
      
      // Simulate rapid requests
      for (let i = 0; i < 200; i++) {
        await rateLimiter.checkLimit(identifier, 100, 1000);
      }

      const ddosResult = await rateLimiter.checkDDoSProtection(identifier, 200, 100);
      expect(ddosResult.blocked).toBe(true);
      expect(ddosResult.mitigationLevel).toBe('soft');
    });

    it('should handle IP whitelisting correctly', async () => {
      const whitelistedIP = '192.168.1.100';
      rateLimiter.addToWhitelist(whitelistedIP);

      const identifier = `test:${whitelistedIP}`;
      
      // Should allow unlimited requests for whitelisted IP
      for (let i = 0; i < 1000; i++) {
        const result = await rateLimiter.checkLimit(identifier, 10, 60000);
        expect(result.allowed).toBe(true);
      }
    });

    it('should handle IP blacklisting correctly', async () => {
      const blacklistedIP = '192.168.1.200';
      rateLimiter.addToBlacklist(blacklistedIP, 'Malicious activity detected');

      const identifier = `test:${blacklistedIP}`;
      const result = await rateLimiter.checkLimit(identifier, 100, 60000);
      
      expect(result.allowed).toBe(false);
    });
  });
});

describe('Threat Detector', () => {
  let threatDetector: ThreatDetector;

  beforeEach(() => {
    threatDetector = new ThreatDetector();
  });

  describe('XSS Detection', () => {
    it('should detect basic XSS attacks', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '<svg onload="alert(1)">',
        'expression(alert("xss"))'
      ];

      xssPayloads.forEach(payload => {
        const result = threatDetector.detectXSS(payload);
        expect(result.detected).toBe(true);
        expect(result.threatType).toBe('xss');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should not flag safe content as XSS', () => {
      const safeContent = [
        'Hello world',
        'This is a normal string',
        'Contact us at info@example.com',
        'Price: $19.99'
      ];

      safeContent.forEach(content => {
        const result = threatDetector.detectXSS(content);
        expect(result.detected).toBe(false);
      });
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL injection attempts', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; UPDATE users SET password='hacked'",
        "UNION SELECT * FROM passwords",
        "'; EXEC xp_cmdshell('dir'); --"
      ];

      sqlPayloads.forEach(payload => {
        const result = threatDetector.detectSQLInjection(payload);
        expect(result.detected).toBe(true);
        expect(result.threatType).toBe('sql_injection');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Path Traversal Detection', () => {
    it('should detect path traversal attempts', () => {
      const pathPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc//passwd',
        '/var/log/../../../etc/passwd'
      ];

      pathPayloads.forEach(payload => {
        const result = threatDetector.detectPathTraversal(payload);
        expect(result.detected).toBe(true);
        expect(result.threatType).toBe('path_traversal');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Behavioral Analysis', () => {
    it('should track user behavior patterns', async () => {
      const context = {
        userId: 'test_user',
        ipAddress: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        endpoint: '/api/test'
      };

      // Simulate multiple requests
      for (let i = 0; i < 10; i++) {
        await threatDetector.analyzeBehavior({
          ...context,
          endpoint: `/api/endpoint${i % 3}` // Vary endpoints
        });
      }

      const stats = threatDetector.getThreatStatistics();
      expect(stats.behaviorProfiles).toBeGreaterThan(0);
    });

    it('should detect suspicious rapid-fire behavior', async () => {
      const context = {
        userId: 'rapid_user',
        ipAddress: '192.168.1.11',
        userAgent: 'Suspicious Bot',
        endpoint: '/api/test'
      };

      // Simulate rapid requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(threatDetector.analyzeBehavior(context));
      }
      await Promise.all(promises);

      // The last analysis should detect suspicious behavior
      const result = await threatDetector.analyzeBehavior(context);
      expect(result.detected).toBe(true);
      expect(result.threatType).toBe('behavioral_anomaly');
    });
  });

  describe('User Agent Analysis', () => {
    it('should detect malicious user agents', () => {
      const maliciousUserAgents = [
        'sqlmap/1.0',
        'Nikto/2.1.6',
        'Burp Suite Professional',
        'OWASP ZAP',
        'curl/7.68.0',
        'python-requests/2.25.1'
      ];

      maliciousUserAgents.forEach(ua => {
        const result = threatDetector.analyzeUserAgent(ua);
        expect(result.detected).toBe(true);
        expect(result.threatType).toBe('malicious_user_agent');
      });
    });

    it('should not flag legitimate user agents', () => {
      const legitUserAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      ];

      legitUserAgents.forEach(ua => {
        const result = threatDetector.analyzeUserAgent(ua);
        expect(result.detected).toBe(false);
      });
    });
  });
});

describe('Encryptor', () => {
  let encryptor: Encryptor;

  beforeEach(() => {
    encryptor = new Encryptor(mockSecurityConfig.encryptionKey);
  });

  describe('AES Encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const originalData = 'Sensitive information that needs protection';
      
      const encrypted = await encryptor.encrypt(originalData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = await encryptor.decrypt(encrypted);
      expect(decrypted.verified).toBe(true);
      expect(decrypted.decrypted).toBe(originalData);
    });

    it('should fail to decrypt tampered data', async () => {
      const originalData = 'Sensitive data';
      const encrypted = await encryptor.encrypt(originalData);
      
      // Tamper with the encrypted data
      encrypted.encrypted = encrypted.encrypted.slice(0, -4) + 'XXXX';
      
      const decrypted = await encryptor.decrypt(encrypted);
      expect(decrypted.verified).toBe(false);
    });

    it('should support different encryption algorithms', async () => {
      const data = 'Test data for different algorithms';

      const aesGcm = await encryptor.encrypt(data, { algorithm: 'aes-256-gcm' });
      const aesCbc = await encryptor.encrypt(data, { algorithm: 'aes-256-cbc' });
      const chacha = await encryptor.encrypt(data, { algorithm: 'chacha20-poly1305' });

      expect(aesGcm.algorithm).toBe('aes-256-gcm');
      expect(aesCbc.algorithm).toBe('aes-256-cbc');
      expect(chacha.algorithm).toBe('chacha20-poly1305');

      // All should decrypt correctly
      const decryptedGcm = await encryptor.decrypt(aesGcm);
      const decryptedCbc = await encryptor.decrypt(aesCbc);
      const decryptedChacha = await encryptor.decrypt(chacha);

      expect(decryptedGcm.decrypted).toBe(data);
      expect(decryptedCbc.decrypted).toBe(data);
      expect(decryptedChacha.decrypted).toBe(data);
    });
  });

  describe('RSA Encryption', () => {
    it('should generate RSA key pairs', async () => {
      const keyPair = await encryptor.generateRSAKeyPair(2048);
      
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.algorithm).toBe('rsa-2048');
      expect(keyPair.keyId).toBeDefined();
    });

    it('should encrypt and decrypt with RSA', async () => {
      const keyPair = await encryptor.generateRSAKeyPair();
      const originalData = 'RSA test data';

      const encrypted = await encryptor.encryptRSA(originalData, keyPair.publicKey);
      const decrypted = await encryptor.decryptRSA(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(originalData);
    });
  });

  describe('Digital Signatures', () => {
    it('should create and verify digital signatures', async () => {
      const keyPair = await encryptor.generateRSAKeyPair();
      const data = 'Document to be signed';

      const signature = await encryptor.sign(data, keyPair.privateKey);
      const verified = await encryptor.verify(data, signature, keyPair.publicKey);

      expect(verified).toBe(true);
    });

    it('should fail verification for tampered data', async () => {
      const keyPair = await encryptor.generateRSAKeyPair();
      const data = 'Original document';
      const tamperedData = 'Tampered document';

      const signature = await encryptor.sign(data, keyPair.privateKey);
      const verified = await encryptor.verify(tamperedData, signature, keyPair.publicKey);

      expect(verified).toBe(false);
    });
  });

  describe('Hashing Functions', () => {
    it('should generate consistent hashes', async () => {
      const data = 'Data to hash';
      
      const hash1 = await encryptor.hash(data);
      const hash2 = await encryptor.hash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex strings
    });

    it('should generate different hashes for different data', async () => {
      const data1 = 'First data';
      const data2 = 'Second data';
      
      const hash1 = await encryptor.hash(data1);
      const hash2 = await encryptor.hash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should create HMAC correctly', async () => {
      const data = 'Message to authenticate';
      const key = 'secret-key';
      
      const hmac1 = await encryptor.hmac(data, key);
      const hmac2 = await encryptor.hmac(data, key);
      
      expect(hmac1).toBe(hmac2);
      expect(hmac1).toHaveLength(64); // SHA-256 HMAC
    });
  });
});

describe('Input Validator', () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('Common Validations', () => {
    it('should validate email addresses', async () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com'
      ];

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..double.dot@example.com'
      ];

      for (const email of validEmails) {
        const result = await validator.validate(email, 'email');
        expect(result.valid).toBe(true);
      }

      for (const email of invalidEmails) {
        const result = await validator.validate(email, 'email');
        expect(result.valid).toBe(false);
      }
    });

    it('should validate URLs', async () => {
      const validUrls = [
        'https://example.com',
        'http://subdomain.example.com/path',
        'https://example.com:8080/path?query=value'
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Only HTTP/HTTPS allowed
        'javascript:alert("xss")'
      ];

      for (const url of validUrls) {
        const result = await validator.validate(url, 'url');
        expect(result.valid).toBe(true);
      }

      for (const url of invalidUrls) {
        const result = await validator.validate(url, 'url');
        expect(result.valid).toBe(false);
      }
    });

    it('should validate strong passwords', async () => {
      const strongPasswords = [
        'StrongP@ssw0rd123',
        'C0mpl3x!P@ssw0rd',
        'MySecure123!Password'
      ];

      const weakPasswords = [
        'password', // Too simple
        '12345678', // Only numbers
        'PASSWORD', // Only uppercase
        'Pass123'   // Too short
      ];

      for (const password of strongPasswords) {
        const result = await validator.validate(password, 'password');
        expect(result.valid).toBe(true);
      }

      for (const password of weakPasswords) {
        const result = await validator.validate(password, 'password');
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Security Validation', () => {
    it('should detect and block XSS in input', async () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">'
      ];

      for (const input of xssInputs) {
        const result = await validator.validateSecurity(input);
        expect(result.safe).toBe(false);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].type).toBe('xss');
      }
    });

    it('should detect SQL injection patterns', async () => {
      const sqlInjections = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT password FROM users"
      ];

      for (const input of sqlInjections) {
        const result = await validator.validateSecurity(input);
        expect(result.safe).toBe(false);
        expect(result.issues.some(issue => issue.type === 'sql_injection')).toBe(true);
      }
    });

    it('should allow safe content', async () => {
      const safeInputs = [
        'Normal text content',
        'Email: user@example.com',
        'Price: $19.99 (includes tax)'
      ];

      for (const input of safeInputs) {
        const result = await validator.validateSecurity(input);
        expect(result.safe).toBe(true);
        expect(result.issues).toHaveLength(0);
      }
    });
  });

  describe('Custom Validators', () => {
    it('should support custom validation rules', async () => {
      // Create a custom validator for product codes
      validator.createCustomValidator(
        'productCode',
        validator['customSchemas'].get('alphanumeric')!,
        (value: string) => value.startsWith('PROD-') && value.length === 9,
        'Product code must start with PROD- and be 9 characters long'
      );

      const validCodes = ['PROD-1234', 'PROD-ABCD'];
      const invalidCodes = ['INVALID', 'PROD-12345', 'prod-1234'];

      for (const code of validCodes) {
        const result = await validator.validate(code, 'productCode');
        expect(result.valid).toBe(true);
      }

      for (const code of invalidCodes) {
        const result = await validator.validate(code, 'productCode');
        expect(result.valid).toBe(false);
      }
    });
  });
});

describe('Compliance Manager', () => {
  let complianceManager: ComplianceManager;
  let encryptor: Encryptor;

  beforeEach(() => {
    encryptor = new Encryptor(mockSecurityConfig.encryptionKey);
    complianceManager = new ComplianceManager(mockComplianceConfig, encryptor);
  });

  describe('GDPR Compliance', () => {
    it('should register data subjects correctly', async () => {
      const subjectId = await complianceManager.registerDataSubject({
        email: 'test@example.com',
        identifiers: { userId: 'user123' },
        dataCategories: ['user_data'],
        classification: 'internal'
      });

      expect(subjectId).toBeDefined();
      expect(typeof subjectId).toBe('string');
    });

    it('should record and manage consent', async () => {
      const subjectId = await complianceManager.registerDataSubject({
        email: 'consent-test@example.com',
        identifiers: { userId: 'consent123' },
        dataCategories: ['user_data'],
        classification: 'internal'
      });

      const consentId = await complianceManager.recordConsent(
        subjectId,
        'marketing',
        'consent',
        true,
        { ipAddress: '192.168.1.1' }
      );

      expect(consentId).toBeDefined();

      // Test consent withdrawal
      const withdrawn = await complianceManager.withdrawConsent(consentId, 'User request');
      expect(withdrawn).toBe(true);
    });

    it('should handle subject access requests', async () => {
      const subjectId = await complianceManager.registerDataSubject({
        email: 'access-test@example.com',
        identifiers: { userId: 'access123' },
        dataCategories: ['user_data'],
        classification: 'internal'
      });

      const accessData = await complianceManager.handleAccessRequest(subjectId);
      expect(accessData).toBeDefined();
      expect(accessData!.personalData).toBeDefined();
      expect(accessData!.consentHistory).toBeDefined();
    });

    it('should handle data portability requests', async () => {
      const subjectId = await complianceManager.registerDataSubject({
        email: 'portability-test@example.com',
        identifiers: { userId: 'port123' },
        dataCategories: ['user_data'],
        classification: 'internal'
      });

      const exportData = await complianceManager.handlePortabilityRequest(subjectId, 'json');
      expect(exportData).toBeDefined();
      expect(typeof exportData).toBe('string');
      
      // Should be valid JSON
      const parsed = JSON.parse(exportData!);
      expect(parsed.personalData).toBeDefined();
    });

    it('should handle erasure requests (Right to be Forgotten)', async () => {
      const subjectId = await complianceManager.registerDataSubject({
        email: 'erasure-test@example.com',
        identifiers: { userId: 'erasure123' },
        dataCategories: ['user_data'],
        classification: 'internal'
      });

      const erasureResult = await complianceManager.handleErasureRequest(
        subjectId,
        'User requested deletion'
      );

      expect(erasureResult.success).toBe(true);
      expect(erasureResult.deletedRecords).toBeGreaterThan(0);
    });
  });

  describe('Data Retention', () => {
    it('should enforce data retention policies', async () => {
      // This would typically involve setting up expired data and testing cleanup
      const retentionResult = await complianceManager.enforceDataRetention();
      
      expect(retentionResult).toBeDefined();
      expect(retentionResult.expiredRecords).toBeGreaterThanOrEqual(0);
      expect(retentionResult.deletedRecords).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(retentionResult.errors)).toBe(true);
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate GDPR compliance reports', async () => {
      const period = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      };

      const report = await complianceManager.generateComplianceReport('GDPR', period);

      expect(report.framework).toBe('GDPR');
      expect(report.summary).toBeDefined();
      expect(report.findings).toBeDefined();
      expect(Array.isArray(report.findings)).toBe(true);
      expect(report.summary.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.complianceScore).toBeLessThanOrEqual(100);
    });

    it('should generate SOC 2 compliance reports', async () => {
      const period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date()
      };

      const report = await complianceManager.generateComplianceReport('SOC2', period);

      expect(report.framework).toBe('SOC2');
      expect(report.summary).toBeDefined();
    });
  });
});

describe('Security Middleware Integration', () => {
  let securityManager: SecurityManager;
  let securityMiddleware: SecurityMiddleware;

  beforeEach(() => {
    securityManager = new SecurityManager(mockSecurityConfig);
    securityMiddleware = new SecurityMiddleware(securityManager);
  });

  describe('Middleware Stack', () => {
    it('should create complete security middleware stack', () => {
      const middlewareStack = securityMiddleware.createSecurityStack();
      
      expect(Array.isArray(middlewareStack)).toBe(true);
      expect(middlewareStack.length).toBeGreaterThan(5);
    });

    it('should create authorization middleware with proper permissions', () => {
      const authMiddleware = securityMiddleware.createAuthorizationMiddleware(
        ['read:marketplace'],
        'marketplace'
      );
      
      expect(typeof authMiddleware).toBe('function');
    });

    it('should create error handling middleware', () => {
      const errorMiddleware = securityMiddleware.errorHandler();
      expect(typeof errorMiddleware).toBe('function');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide security statistics', () => {
      const stats = securityManager.getSecurityMetrics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.failedAttempts).toBe('number');
    });

    it('should provide threat detection statistics', () => {
      const threatDetector = new ThreatDetector();
      const stats = threatDetector.getThreatStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.knownMaliciousIPs).toBe('number');
      expect(typeof stats.behaviorProfiles).toBe('number');
    });

    it('should provide compliance statistics', () => {
      const encryptor = new Encryptor(mockSecurityConfig.encryptionKey);
      const compliance = new ComplianceManager(mockComplianceConfig, encryptor);
      const stats = compliance.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.dataSubjects).toBe('number');
      expect(typeof stats.complianceScore).toBe('number');
    });
  });
});

describe('Performance and Load Testing', () => {
  it('should handle high-volume authentication requests', async () => {
    const securityManager = new SecurityManager(mockSecurityConfig);
    const startTime = Date.now();
    const promises = [];

    // Simulate 100 concurrent authentication attempts
    for (let i = 0; i < 100; i++) {
      promises.push(
        securityManager.authenticate(
          'admin@example.com',
          'admin123',
          {
            ipAddress: `192.168.1.${i % 255}`,
            userAgent: 'Load Test Browser'
          }
        )
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // All should succeed (assuming no rate limiting)
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThan(90); // Allow for some rate limiting

    // Should complete within reasonable time (adjust based on your requirements)
    expect(duration).toBeLessThan(5000); // 5 seconds
  });

  it('should handle high-volume encryption operations', async () => {
    const encryptor = new Encryptor(mockSecurityConfig.encryptionKey);
    const testData = 'Performance test data that needs to be encrypted';
    const startTime = Date.now();
    const promises = [];

    // Simulate 1000 concurrent encryption operations
    for (let i = 0; i < 1000; i++) {
      promises.push(encryptor.encrypt(`${testData} - ${i}`));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // All should succeed
    expect(results.length).toBe(1000);
    results.forEach(result => {
      expect(result.encrypted).toBeDefined();
      expect(result.algorithm).toBeDefined();
    });

    // Should complete within reasonable time
    expect(duration).toBeLessThan(10000); // 10 seconds

    console.log(`Encrypted 1000 items in ${duration}ms (${(1000 / duration * 1000).toFixed(0)} ops/sec)`);
  });
});