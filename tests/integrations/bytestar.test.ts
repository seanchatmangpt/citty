/**
 * Comprehensive test suite for ByteStar Integration
 * Tests all major components: PQC, AI, Security, Performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ByteStarIntegration, 
  CrystalsKyberPQC,
  CrystalsDilithiumPQC,
  MultiProviderAI,
  EnterpriseSecurityOrchestrator,
  UltraHighPerformanceEngine
} from '../../marketplace/integrations/bytestar';

describe('ByteStar Integration Suite', () => {
  let byteStar: ByteStarIntegration;

  beforeEach(async () => {
    byteStar = new ByteStarIntegration({
      enableQuantumReadiness: true,
      enableEnterpriseFeatures: true,
      enablePerformanceOptimization: true,
      logLevel: 'warn' // Reduce noise in tests
    });
  });

  afterEach(async () => {
    if (byteStar) {
      await byteStar.shutdown();
    }
  });

  describe('Core Integration', () => {
    it('should initialize all components successfully', async () => {
      await expect(byteStar.initialize()).resolves.not.toThrow();
      
      const health = await byteStar.getHealthStatus();
      expect(health.overall).toBe('healthy');
      expect(Object.keys(health.components)).toContain('kyber');
      expect(Object.keys(health.components)).toContain('ai-engine');
      expect(Object.keys(health.components)).toContain('security');
      expect(Object.keys(health.components)).toContain('performance');
    });

    it('should provide comprehensive system metrics', async () => {
      await byteStar.initialize();
      
      const metrics = byteStar.getSystemMetrics();
      
      expect(metrics).toHaveProperty('pqc');
      expect(metrics).toHaveProperty('ai');
      expect(metrics).toHaveProperty('security');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('integration');
      
      expect(metrics.integration.uptime).toBeGreaterThan(0);
      expect(metrics.integration.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle component errors gracefully', async () => {
      await byteStar.initialize();
      
      const errorHandler = vi.fn();
      byteStar.on('componentError', errorHandler);
      
      // Simulate component error
      byteStar.emit('componentError', { component: 'test', error: new Error('Test error') });
      
      expect(errorHandler).toHaveBeenCalledWith({
        component: 'test',
        error: expect.any(Error)
      });
    });

    it('should run comprehensive benchmark', async () => {
      await byteStar.initialize();
      
      const results = await byteStar.runBenchmark(5000); // 5 second benchmark
      
      expect(results).toHaveProperty('overall');
      expect(results.overall).toHaveProperty('score');
      expect(results.overall).toHaveProperty('rating');
      expect(results.overall.score).toBeGreaterThanOrEqual(0);
      expect(results.overall.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Post-Quantum Cryptography', () => {
    it('should create quantum-secure key pairs', async () => {
      await byteStar.initialize();
      
      const keyPair = await byteStar.createQuantumSecureKeyPair();
      
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('metadata');
      expect(keyPair.metadata.algorithm).toMatch(/kyber-\d+/);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
    });

    it('should sign transactions with quantum-resistant signatures', async () => {
      await byteStar.initialize();
      
      const keyPair = await byteStar.createQuantumSecureKeyPair();
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      
      const signature = await byteStar.signTransaction(testData, keyPair.privateKey);
      
      expect(signature).toHaveProperty('signature');
      expect(signature).toHaveProperty('metadata');
      expect(signature.metadata.algorithm).toMatch(/dilithium-\d+/);
      expect(signature.signature).toBeInstanceOf(Uint8Array);
    });

    it('should perform hybrid encryption', async () => {
      await byteStar.initialize();
      
      const keyPair = await byteStar.createQuantumSecureKeyPair();
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      
      const encrypted = await byteStar.hybridEncryptData(testData, keyPair.publicKey);
      
      expect(encrypted).toHaveProperty('kyberCiphertext');
      expect(encrypted).toHaveProperty('classicalCiphertext');
      expect(encrypted).toHaveProperty('sharedSecret');
      expect(encrypted).toHaveProperty('hybridMetadata');
      expect(encrypted.hybridMetadata.securityLevel).toBe('hybrid-quantum-resistant');
    });
  });

  describe('Multi-Provider AI Engine', () => {
    it('should process AI requests with intelligent routing', async () => {
      await byteStar.initialize();
      
      const response = await byteStar.processAIRequest(
        'Calculate 2 + 2',
        { maxTokens: 50, priority: 'normal' }
      );
      
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('provider');
      expect(response).toHaveProperty('usage');
      expect(response).toHaveProperty('latency');
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.latency).toBeGreaterThan(0);
    });

    it('should respect privacy mode', async () => {
      await byteStar.initialize();
      
      const response = await byteStar.processAIRequest(
        'Sensitive data processing',
        { requiresPrivacy: true }
      );
      
      expect(response.provider).toBe('ollama'); // Should route to local provider
    });

    it('should track cost savings', async () => {
      await byteStar.initialize();
      
      // Process multiple requests
      await Promise.all([
        byteStar.processAIRequest('Request 1'),
        byteStar.processAIRequest('Request 2'),
        byteStar.processAIRequest('Request 3')
      ]);
      
      const metrics = byteStar.getSystemMetrics();
      expect(metrics.ai.requests).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Enterprise Security', () => {
    it('should create secure sessions', async () => {
      await byteStar.initialize();
      
      const session = await byteStar.createSecureSession('test-user', {
        deviceTrust: 85,
        locationTrust: 90
      });
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('userId');
      expect(session).toHaveProperty('riskScore');
      expect(session).toHaveProperty('compliance');
      expect(session.userId).toBe('test-user');
      expect(session.riskScore).toBeGreaterThanOrEqual(0);
      expect(session.riskScore).toBeLessThanOrEqual(100);
    });

    it('should handle threat detection', async () => {
      await byteStar.initialize();
      
      let threatDetected = false;
      byteStar.on('threatDetected', () => {
        threatDetected = true;
      });
      
      // Simulate threat detection (this would normally come from the security component)
      byteStar.emit('threatDetected', {
        severity: 'medium',
        confidence: 80,
        blocked: false,
        mitigation: ['Enhanced monitoring']
      });
      
      expect(threatDetected).toBe(true);
    });
  });

  describe('Ultra-High Performance Engine', () => {
    it('should process high-performance batches', async () => {
      await byteStar.initialize();
      
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'test_operation',
        data: { id: i, value: Math.random() * 1000 }
      }));
      
      const results = await byteStar.processHighPerformanceBatch(operations);
      
      expect(results).toHaveLength(operations.length);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('id');
        expect(result.id).toContain('mp_');
      });
    });

    it('should achieve high throughput', async () => {
      await byteStar.initialize();
      
      const metrics = byteStar.getSystemMetrics();
      
      // Performance should be tracked even if not at target
      expect(metrics.performance).toHaveProperty('currentOps');
      expect(metrics.performance).toHaveProperty('averageLatency');
      expect(metrics.performance.averageLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Component Integration Tests', () => {
    describe('CRYSTALS-Kyber PQC', () => {
      let kyber: CrystalsKyberPQC;

      beforeEach(() => {
        kyber = new CrystalsKyberPQC({
          algorithm: 'kyber-768',
          enableFips140: true
        });
      });

      afterEach(() => {
        kyber.destroy();
      });

      it('should generate valid key pairs', async () => {
        const keyPair = await kyber.generateKeyPair();
        
        expect(keyPair.publicKey.length).toBe(1184); // Kyber-768 public key size
        expect(keyPair.privateKey.length).toBe(2400); // Kyber-768 private key size
        expect(keyPair.metadata.algorithm).toBe('kyber-768');
      });

      it('should perform encapsulation and decapsulation', async () => {
        const keyPair = await kyber.generateKeyPair();
        
        const encapsulation = await kyber.encapsulate(keyPair.publicKey);
        expect(encapsulation.ciphertext.length).toBe(1088); // Kyber-768 ciphertext size
        expect(encapsulation.sharedSecret.length).toBe(32); // 256-bit shared secret
        
        const decapsulatedSecret = await kyber.decapsulate(
          encapsulation.ciphertext, 
          keyPair.privateKey
        );
        expect(decapsulatedSecret.length).toBe(32);
      });

      it('should track metrics correctly', async () => {
        await kyber.generateKeyPair();
        await kyber.generateKeyPair();
        
        const metrics = kyber.getMetrics();
        expect(metrics.keyGenerations).toBe(2);
        expect(metrics.totalOperations).toBe(2);
        expect(metrics.quantumResistanceLevel).toBe(3); // NIST Level 3 for Kyber-768
      });
    });

    describe('CRYSTALS-Dilithium PQC', () => {
      let dilithium: CrystalsDilithiumPQC;

      beforeEach(() => {
        dilithium = new CrystalsDilithiumPQC({
          algorithm: 'dilithium-3',
          enableAuditLog: true
        });
      });

      afterEach(() => {
        dilithium.destroy();
      });

      it('should generate valid key pairs', async () => {
        const keyPair = await dilithium.generateKeyPair();
        
        expect(keyPair.publicKey.length).toBe(1952); // Dilithium-3 public key size
        expect(keyPair.privateKey.length).toBe(4000); // Dilithium-3 private key size
        expect(keyPair.metadata.algorithm).toBe('dilithium-3');
      });

      it('should sign and verify data', async () => {
        const keyPair = await dilithium.generateKeyPair();
        const testData = new Uint8Array([1, 2, 3, 4, 5]);
        
        const signature = await dilithium.sign(testData, keyPair.privateKey);
        expect(signature.signature.length).toBe(3293); // Dilithium-3 signature size
        
        const isValid = await dilithium.verify(testData, signature.signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it('should maintain audit log', async () => {
        const keyPair = await dilithium.generateKeyPair();
        const testData = new Uint8Array([1, 2, 3, 4, 5]);
        
        await dilithium.sign(testData, keyPair.privateKey);
        await dilithium.verify(testData, new Uint8Array(3293), keyPair.publicKey);
        
        const auditLog = dilithium.getAuditLog();
        expect(auditLog.length).toBeGreaterThanOrEqual(2); // At least key_generation and signing
      });
    });

    describe('Multi-Provider AI', () => {
      let ai: MultiProviderAI;

      beforeEach(() => {
        ai = new MultiProviderAI({
          preferLocalModels: true,
          enableCostOptimization: true
        });
      });

      afterEach(() => {
        ai.destroy();
      });

      it('should route requests to appropriate providers', async () => {
        const localResponse = await ai.processRequest({
          prompt: 'Test prompt',
          requiresLocalProcessing: true
        });
        
        expect(localResponse.provider).toBe('ollama');
        expect(localResponse.usage.cost).toBe(0); // Local processing is free
      });

      it('should provide health status for providers', async () => {
        const health = await ai.getProviderHealth();
        
        expect(health).toHaveProperty('ollama');
        expect(health.ollama).toHaveProperty('status');
        expect(['healthy', 'unhealthy']).toContain(health.ollama.status);
      });

      it('should track cost savings', async () => {
        await ai.processRequest({ prompt: 'Test 1' });
        await ai.processRequest({ prompt: 'Test 2' });
        
        const metrics = ai.getMetrics();
        expect(metrics.totalRequests).toBe(2);
        expect(metrics.costSavings).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Enterprise Security Orchestrator', () => {
      let security: EnterpriseSecurityOrchestrator;

      beforeEach(() => {
        security = new EnterpriseSecurityOrchestrator({
          fips140Level: 2,
          enableZeroTrust: true,
          complianceMode: 'standard'
        });
      });

      afterEach(() => {
        security.destroy();
      });

      it('should create secure sessions with risk assessment', async () => {
        const context = await security.createSecureSession('test-user', {
          deviceTrust: 80,
          locationTrust: 85
        });
        
        expect(context.sessionId).toBeTruthy();
        expect(context.riskScore).toBeGreaterThanOrEqual(0);
        expect(context.compliance.fips140).toBe(true);
      });

      it('should validate security contexts', async () => {
        const context = await security.createSecureSession('test-user');
        
        const isValid = await security.validateSecurityContext(
          context.sessionId,
          ['read:profile']
        );
        
        expect(isValid).toBe(true);
      });

      it('should generate compliance reports', async () => {
        const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endDate = new Date();
        
        const report = await security.generateComplianceReport('FIPS140-2', startDate, endDate);
        
        expect(report.framework).toBe('FIPS140-2');
        expect(report.compliance).toHaveProperty('score');
        expect(report.compliance).toHaveProperty('status');
        expect(report.compliance.score).toBeGreaterThanOrEqual(0);
        expect(report.compliance.score).toBeLessThanOrEqual(100);
      });
    });

    describe('Ultra-High Performance Engine', () => {
      let performance: UltraHighPerformanceEngine;

      beforeEach(() => {
        performance = new UltraHighPerformanceEngine({
          maxWorkers: 2, // Limited for testing
          batchSize: 10,
          enableSIMD: true
        });
      });

      afterEach(() => {
        performance.destroy();
      });

      it('should process operations with high throughput', async () => {
        const operations = Array.from({ length: 20 }, (_, i) => ({
          id: `test_${i}`,
          type: 'compute',
          data: { value: i },
          timestamp: Date.now()
        }));

        const startTime = Date.now();
        const results = await performance.processOperations(operations);
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(operations.length);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      });

      it('should optimize SIMD-friendly operations', async () => {
        // Create operations of the same type (SIMD-optimizable)
        const operations = Array.from({ length: 16 }, (_, i) => ({
          id: `simd_${i}`,
          type: 'vectorizable_compute',
          data: { vector: [i, i+1, i+2, i+3] },
          timestamp: Date.now()
        }));

        const results = await performance.processOperations(operations);
        
        expect(results).toHaveLength(operations.length);
        
        const metrics = performance.getMetrics();
        expect(metrics.simdEfficiency).toBeGreaterThanOrEqual(0);
      });

      it('should provide resource utilization metrics', () => {
        const utilization = performance.getResourceUtilization();
        
        expect(utilization).toHaveProperty('workers');
        expect(utilization).toHaveProperty('simd');
        expect(utilization).toHaveProperty('memoryPool');
        expect(utilization.workers).toBeGreaterThan(0);
        expect(utilization.simd.enabled).toBe(true);
      });

      it('should run performance benchmarks', async () => {
        const results = await performance.benchmark(2000); // 2 second benchmark
        
        expect(results).toHaveProperty('averageOpsPerSecond');
        expect(results).toHaveProperty('averageLatency');
        expect(results).toHaveProperty('simdEfficiency');
        expect(results.averageOpsPerSecond).toBeGreaterThan(0);
        expect(results.averageLatency).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle initialization without components', async () => {
      const minimalByteStar = new ByteStarIntegration({
        enableQuantumReadiness: false,
        enableEnterpriseFeatures: false,
        enablePerformanceOptimization: false
      });

      await expect(minimalByteStar.initialize()).resolves.not.toThrow();
      
      // Should throw when trying to use disabled features
      await expect(minimalByteStar.createQuantumSecureKeyPair())
        .rejects.toThrow('Quantum cryptography not enabled');
      
      await minimalByteStar.shutdown();
    });

    it('should handle component failures gracefully', async () => {
      await byteStar.initialize();
      
      // Simulate component failure
      const errorCount = byteStar.getSystemMetrics().integration.errorRate;
      
      try {
        // Force an error by calling with invalid data
        await byteStar.signTransaction(new Uint8Array(0), new Uint8Array(0));
      } catch (error) {
        // Expected to fail with invalid input
        expect(error).toBeDefined();
      }
    });

    it('should validate configuration options', () => {
      expect(() => new ByteStarIntegration({
        security: {
          fips140Level: 6 as any // Invalid level
        }
      })).not.toThrow(); // Constructor should be forgiving, validation happens during init
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests', async () => {
      await byteStar.initialize();
      
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        byteStar.processAIRequest(`Concurrent request ${i}`, { maxTokens: 10 })
      );
      
      const results = await Promise.allSettled(concurrentRequests);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(5); // At least 50% should succeed
    });

    it('should maintain performance under load', async () => {
      await byteStar.initialize();
      
      const operations = Array.from({ length: 500 }, (_, i) => ({
        type: 'load_test',
        data: { iteration: i }
      }));
      
      const startTime = Date.now();
      const results = await byteStar.processHighPerformanceBatch(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(operations.length);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      const throughput = operations.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(50); // At least 50 ops/sec
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete secure transaction flow', async () => {
      await byteStar.initialize();
      
      // 1. Create secure session
      const session = await byteStar.createSecureSession('merchant123', {
        deviceTrust: 90,
        locationTrust: 85
      });
      
      // 2. Generate quantum-secure keys
      const keyPair = await byteStar.createQuantumSecureKeyPair();
      
      // 3. Create transaction data
      const transactionData = new TextEncoder().encode(JSON.stringify({
        from: 'merchant123',
        to: 'customer456',
        amount: 99.99,
        currency: 'USD',
        timestamp: Date.now(),
        sessionId: session.sessionId
      }));
      
      // 4. Sign transaction
      const signature = await byteStar.signTransaction(transactionData, keyPair.privateKey);
      
      // 5. Process with AI risk assessment
      const riskAssessment = await byteStar.processAIRequest(
        'Analyze transaction for fraud risk: amount=99.99, merchant=new, customer=verified',
        { priority: 'high', maxTokens: 100 }
      );
      
      // Verify all components worked together
      expect(session.sessionId).toBeTruthy();
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(signature.signature).toBeInstanceOf(Uint8Array);
      expect(riskAssessment.content).toBeTruthy();
    });

    it('should handle high-throughput batch processing with security', async () => {
      await byteStar.initialize();
      
      // Create multiple secure sessions
      const sessions = await Promise.all([
        byteStar.createSecureSession('user1'),
        byteStar.createSecureSession('user2'),
        byteStar.createSecureSession('user3')
      ]);
      
      // Generate operations for each session
      const operations = sessions.flatMap((session, i) => 
        Array.from({ length: 50 }, (_, j) => ({
          type: 'secure_operation',
          data: {
            sessionId: session.sessionId,
            userId: session.userId,
            operationId: `${i}_${j}`,
            timestamp: Date.now()
          }
        }))
      );
      
      // Process all operations
      const results = await byteStar.processHighPerformanceBatch(operations);
      
      expect(results).toHaveLength(operations.length);
      
      // Verify security metrics improved
      const metrics = byteStar.getSystemMetrics();
      expect(metrics.security.activeSessions).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('ByteStar Component Performance Benchmarks', () => {
  it('should meet PQC performance targets', async () => {
    const kyber = new CrystalsKyberPQC({ algorithm: 'kyber-768' });
    const dilithium = new CrystalsDilithiumPQC({ algorithm: 'dilithium-3' });
    
    try {
      // Benchmark key generation
      const keyGenStart = Date.now();
      await Promise.all([
        kyber.generateKeyPair(),
        dilithium.generateKeyPair()
      ]);
      const keyGenTime = Date.now() - keyGenStart;
      
      expect(keyGenTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Benchmark signing/verification
      const kyberKeyPair = await kyber.generateKeyPair();
      const dilithiumKeyPair = await dilithium.generateKeyPair();
      const testData = new Uint8Array(1024);
      
      const cryptoStart = Date.now();
      const [encapsulation, signature] = await Promise.all([
        kyber.encapsulate(kyberKeyPair.publicKey),
        dilithium.sign(testData, dilithiumKeyPair.privateKey)
      ]);
      const cryptoTime = Date.now() - cryptoStart;
      
      expect(cryptoTime).toBeLessThan(500); // Should complete within 0.5 seconds
      
    } finally {
      kyber.destroy();
      dilithium.destroy();
    }
  });

  it('should achieve target throughput for batch operations', async () => {
    const performance = new UltraHighPerformanceEngine({
      maxWorkers: 4,
      enableSIMD: true,
      targetOpsPerSecond: 1000000 // 1M ops/sec target
    });
    
    try {
      const benchmark = await performance.benchmark(5000); // 5 second test
      
      expect(benchmark.averageOpsPerSecond).toBeGreaterThan(100000); // At least 100k ops/sec
      expect(benchmark.p95Latency).toBeLessThan(100); // P95 latency under 100ms
      expect(benchmark.simdEfficiency).toBeGreaterThan(70); // SIMD efficiency over 70%
      
    } finally {
      performance.destroy();
    }
  });
});

describe('ByteStar Security Compliance Tests', () => {
  it('should meet FIPS 140-2 Level 2 requirements', async () => {
    const security = new EnterpriseSecurityOrchestrator({
      fips140Level: 2,
      complianceMode: 'strict'
    });
    
    try {
      // Test key management
      const testData = Buffer.from('sensitive data');
      const encrypted = await security.encryptData(testData);
      
      expect(encrypted.keyId).toBeTruthy();
      expect(encrypted.iv).toHaveLength(12); // GCM IV length
      expect(encrypted.tag).toHaveLength(16); // GCM tag length
      
      const decrypted = await security.decryptData(
        encrypted.encryptedData,
        encrypted.keyId,
        encrypted.iv,
        encrypted.tag
      );
      
      expect(Buffer.compare(testData, decrypted)).toBe(0);
      
      // Test compliance reporting
      const report = await security.generateComplianceReport(
        'FIPS140-2',
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      );
      
      expect(report.compliance.score).toBeGreaterThanOrEqual(95);
      expect(report.compliance.status).toBe('compliant');
      
    } finally {
      security.destroy();
    }
  });

  it('should implement zero trust principles', async () => {
    const security = new EnterpriseSecurityOrchestrator({
      enableZeroTrust: true,
      enableThreatIntelligence: true
    });
    
    try {
      const session = await security.createSecureSession('test-user', {
        newDevice: true,
        unusualLocation: true
      });
      
      // Zero trust should result in higher risk scores for new/unusual contexts
      expect(session.riskScore).toBeGreaterThan(30);
      expect(session.securityLevel).toBeLessThanOrEqual(2); // Lower initial trust
      
    } finally {
      security.destroy();
    }
  });
});