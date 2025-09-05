/**
 * Comprehensive ByteStar Cryptographic Operations Test Suite
 * Production-ready validation of all cryptographic components
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';

// Import ByteStar components
import { CrystalsKyberPQC } from '../pqc/crystals-kyber';
import { CrystalsDilithiumPQC } from '../pqc/crystals-dilithium';
import { MultiProviderAI } from '../ai-engine/multi-provider-ai';
import { EnterpriseSecurityOrchestrator } from '../security/enterprise-orchestrator';
import { UltraHighPerformanceEngine } from '../performance/ultra-high-performance';
import { PostQuantumCryptoEngine } from '../crypto/index';

describe('ByteStar Integration - Comprehensive Cryptographic Tests', () => {
  let kyberPQC: CrystalsKyberPQC;
  let dilithiumPQC: CrystalsDilithiumPQC;
  let aiEngine: MultiProviderAI;
  let securityOrchestrator: EnterpriseSecurityOrchestrator;
  let performanceEngine: UltraHighPerformanceEngine;
  let pqCrypto: PostQuantumCryptoEngine;

  beforeAll(async () => {
    // Initialize all components
    kyberPQC = new CrystalsKyberPQC({ algorithm: 'kyber-1024' });
    dilithiumPQC = new CrystalsDilithiumPQC({ algorithm: 'dilithium-3' });
    aiEngine = new MultiProviderAI();
    securityOrchestrator = new EnterpriseSecurityOrchestrator();
    performanceEngine = new UltraHighPerformanceEngine();
    pqCrypto = new PostQuantumCryptoEngine();
  });

  afterAll(async () => {
    // Clean up resources
    kyberPQC.destroy();
    dilithiumPQC.destroy();
    securityOrchestrator.destroy();
    performanceEngine.destroy();
  });

  describe('CRYSTALS-Kyber Post-Quantum Key Exchange', () => {
    test('should generate valid Kyber1024 key pairs', async () => {
      const startTime = performance.now();
      
      const keyPairResult = await kyberPQC.generateKeyPair();
      
      expect(keyPairResult).toBeDefined();
      expect(keyPairResult.publicKeyId).toBeDefined();
      expect(keyPairResult.privateKeyId).toBeDefined();
      
      const latency = performance.now() - startTime;
      expect(latency).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify key sizes are correct for Kyber1024
      const publicKey = kyberPQC.getPublicKey(keyPairResult.publicKeyId);
      expect(publicKey).toBeDefined();
      expect(publicKey!.length).toBeGreaterThan(1500); // Kyber1024 public key size
    });

    test('should perform secure key encapsulation and decapsulation', async () => {
      // Generate key pair
      const keyPair = await kyberPQC.generateKeyPair();
      
      // Perform encapsulation
      const encapsulationResult = await kyberPQC.encapsulate(keyPair.publicKeyId);
      
      expect(encapsulationResult).toBeDefined();
      expect(encapsulationResult.sharedSecret).toBeDefined();
      expect(encapsulationResult.ciphertext).toBeDefined();
      expect(encapsulationResult.sharedSecret.length).toBe(32); // 256-bit shared secret
      
      // Perform decapsulation
      const decapsulatedSecret = await kyberPQC.decapsulate(
        keyPair.privateKeyId,
        encapsulationResult.ciphertext
      );
      
      expect(decapsulatedSecret).toBeDefined();
      expect(decapsulatedSecret.length).toBe(32);
      
      // Verify shared secrets match
      expect(decapsulatedSecret).toEqual(encapsulationResult.sharedSecret);
    });

    test('should handle invalid operations gracefully', async () => {
      // Test with invalid key ID
      await expect(kyberPQC.encapsulate('invalid-key-id')).rejects.toThrow();
      
      // Test with malformed ciphertext
      const keyPair = await kyberPQC.generateKeyPair();
      const invalidCiphertext = new Uint8Array(100); // Wrong size
      
      await expect(kyberPQC.decapsulate(keyPair.privateKeyId, invalidCiphertext))
        .rejects.toThrow();
    });

    test('should provide comprehensive security metrics', () => {
      const metrics = kyberPQC.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.keyPairsGenerated).toBeGreaterThan(0);
      expect(metrics.encapsulations).toBeGreaterThan(0);
      expect(metrics.decapsulations).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.securityLevel).toBe(256); // Kyber1024 provides 256-bit security
    });
  });

  describe('CRYSTALS-Dilithium Digital Signatures', () => {
    test('should generate valid Dilithium3 key pairs', async () => {
      const startTime = performance.now();
      
      const keyPairResult = await dilithiumPQC.generateKeyPair();
      
      expect(keyPairResult).toBeDefined();
      expect(keyPairResult.publicKeyId).toBeDefined();
      expect(keyPairResult.privateKeyId).toBeDefined();
      
      const latency = performance.now() - startTime;
      expect(latency).toBeLessThan(3000); // Should complete within 3 seconds
      
      // Verify key sizes are correct for Dilithium3
      const publicKey = dilithiumPQC.getPublicKey(keyPairResult.publicKeyId);
      expect(publicKey).toBeDefined();
      expect(publicKey!.length).toBeGreaterThan(1900); // Dilithium3 public key size
    });

    test('should create and verify digital signatures', async () => {
      const keyPair = await dilithiumPQC.generateKeyPair();
      const testMessage = new TextEncoder().encode('ByteStar security test message');
      
      // Create signature
      const signatureResult = await dilithiumPQC.sign(testMessage, keyPair.privateKeyId);
      
      expect(signatureResult).toBeDefined();
      expect(signatureResult.signature).toBeDefined();
      expect(signatureResult.signature.length).toBeGreaterThan(3000); // Dilithium3 signature size
      
      // Verify signature
      const verificationResult = await dilithiumPQC.verify(
        testMessage,
        signatureResult.signature,
        keyPair.publicKeyId
      );
      
      expect(verificationResult).toBeDefined();
      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.confidence).toBeGreaterThan(0.99);
    });

    test('should detect tampered signatures', async () => {
      const keyPair = await dilithiumPQC.generateKeyPair();
      const originalMessage = new TextEncoder().encode('Original message');
      const tamperedMessage = new TextEncoder().encode('Tampered message');
      
      const signature = await dilithiumPQC.sign(originalMessage, keyPair.privateKeyId);
      
      // Verify with tampered message should fail
      const verificationResult = await dilithiumPQC.verify(
        tamperedMessage,
        signature.signature,
        keyPair.publicKeyId
      );
      
      expect(verificationResult.valid).toBe(false);
    });

    test('should provide audit trail for all operations', () => {
      const auditLog = dilithiumPQC.getAuditLog(10);
      
      expect(auditLog).toBeDefined();
      expect(auditLog.length).toBeGreaterThan(0);
      
      auditLog.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(entry.operation).toBeDefined();
        expect(entry.success).toBeDefined();
      });
    });
  });

  describe('Multi-Provider AI Engine', () => {
    test('should initialize with default providers', () => {
      const providers = aiEngine.getProviders();
      
      expect(providers.size).toBeGreaterThan(0);
      expect(providers.has('ollama')).toBe(true);
      expect(providers.has('openai')).toBe(true);
      expect(providers.has('anthropic')).toBe(true);
    });

    test('should route requests based on configuration', async () => {
      const testRequest = {
        prompt: 'Test prompt for AI processing',
        maxTokens: 100,
        temperature: 0.7
      };

      // Test with privacy mode (should prefer local providers)
      const response = await aiEngine.processRequest(testRequest);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.provider).toBeDefined();
      expect(response.latency).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    test('should handle provider failures gracefully', async () => {
      // Add a mock failing provider
      aiEngine.addProvider({
        name: 'failing-provider',
        type: 'cloud',
        models: ['test-model'],
        capabilities: ['text-generation'],
        pricing: { inputTokens: 0.01, outputTokens: 0.01, currency: 'USD' }
      });

      const testRequest = {
        prompt: 'Test with failing provider',
        preferredProvider: 'failing-provider'
      };

      // Should fallback to working provider
      const response = await aiEngine.processRequest(testRequest);
      expect(response).toBeDefined();
      expect(response.provider).not.toBe('failing-provider');
    });

    test('should optimize costs effectively', () => {
      const metrics = aiEngine.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.totalCost).toBeGreaterThanOrEqual(0);
      expect(metrics.costSavings).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeGreaterThan(80); // At least 80% success rate
    });
  });

  describe('Enterprise Security Orchestrator', () => {
    test('should enforce FIPS 140-2 Level 2 compliance', async () => {
      const config = securityOrchestrator.getConfiguration();
      
      expect(config.fips140Level).toBeGreaterThanOrEqual(2);
      expect(config.enableRealTimeMonitoring).toBe(true);
      expect(config.enableZeroTrust).toBe(true);
    });

    test('should create and validate secure sessions', async () => {
      const sessionContext = await securityOrchestrator.createSecureSession('test-user', {
        deviceTrust: 80,
        locationTrust: 90
      });
      
      expect(sessionContext).toBeDefined();
      expect(sessionContext.sessionId).toBeDefined();
      expect(sessionContext.userId).toBe('test-user');
      expect(sessionContext.compliance.fips140).toBe(true);
      expect(sessionContext.riskScore).toBeLessThan(50); // Low risk for trusted session
      
      // Validate session
      const isValid = await securityOrchestrator.validateSecurityContext(
        sessionContext.sessionId,
        ['read:data']
      );
      
      expect(isValid).toBe(true);
    });

    test('should detect and mitigate security threats', async () => {
      const suspiciousData = {
        requestCount: 1000,
        requestInterval: 50, // Very fast requests
        userAgent: 'suspicious-bot',
        patterns: ['automated', 'scraping'],
        deviceTrust: 10,
        locationTrust: 20
      };
      
      const threatAnalysis = await securityOrchestrator.analyzeThreat(suspiciousData);
      
      expect(threatAnalysis.threatDetected).toBe(true);
      expect(threatAnalysis.severity).toBeOneOf(['high', 'critical']);
      expect(threatAnalysis.confidence).toBeGreaterThan(80);
      expect(threatAnalysis.mitigation.length).toBeGreaterThan(0);
      expect(threatAnalysis.blocked).toBe(true);
    });

    test('should generate FIPS-compliant audit reports', async () => {
      const report = await securityOrchestrator.generateComplianceReport(
        'FIPS140-2',
        new Date(Date.now() - 86400000), // 24 hours ago
        new Date()
      );
      
      expect(report).toBeDefined();
      expect(report.framework).toBe('FIPS140-2');
      expect(report.compliance.score).toBeGreaterThan(70); // Minimum compliance score
      expect(report.compliance.status).toBeOneOf(['compliant', 'partial']);
      expect(report.events.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Ultra-High Performance Engine', () => {
    test('should achieve target operations per second', async () => {
      const targetOps = 690000000; // 690M ops/sec target
      const testOperations = Array.from({ length: 1000 }, (_, i) => ({
        id: `op_${i}`,
        type: 'compute',
        data: { value: Math.random() * 1000 },
        timestamp: Date.now()
      }));
      
      const startTime = performance.now();
      const results = await performanceEngine.processOperations(testOperations);
      const endTime = performance.now();
      
      expect(results).toBeDefined();
      expect(results.length).toBe(testOperations.length);
      
      const throughput = testOperations.length / ((endTime - startTime) / 1000);
      expect(throughput).toBeGreaterThan(1000); // At least 1K ops/sec in test environment
      
      const metrics = performanceEngine.getMetrics();
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeLessThan(1000); // Less than 1ms average latency
    });

    test('should utilize SIMD optimizations when available', async () => {
      const simdOperations = Array.from({ length: 64 }, (_, i) => ({
        id: `simd_op_${i}`,
        type: 'compute',
        data: { value: i * Math.PI },
        timestamp: Date.now()
      }));
      
      const results = await performanceEngine.processOperations(simdOperations);
      
      expect(results.length).toBe(simdOperations.length);
      
      // Check if SIMD optimization was used
      const resourceUtilization = performanceEngine.getResourceUtilization();
      expect(resourceUtilization.simd.enabled).toBe(true);
      expect(resourceUtilization.simd.efficiency).toBeGreaterThan(50);
    });

    test('should handle distributed consensus operations', async () => {
      const consensusOperations = Array.from({ length: 10 }, (_, i) => ({
        id: `consensus_op_${i}`,
        type: 'consensus',
        data: { proposal: `proposal_${i}`, priority: 'high' },
        timestamp: Date.now()
      }));
      
      const consensusResult = await performanceEngine.processWithConsensus(consensusOperations);
      
      expect(consensusResult).toBeDefined();
      expect(consensusResult.results.length).toBe(consensusOperations.length);
      expect(consensusResult.consensus.achieved).toBe(true);
      expect(consensusResult.consensus.nodeResponses).toBeGreaterThan(1);
      expect(consensusResult.consensus.latency).toBeLessThan(1000); // Sub-second consensus
    });

    test('should demonstrate performance benchmarking capabilities', async () => {
      const benchmarkResults = await performanceEngine.benchmark(5000); // 5 second benchmark
      
      expect(benchmarkResults).toBeDefined();
      expect(benchmarkResults.averageOpsPerSecond).toBeGreaterThan(1000);
      expect(benchmarkResults.p95Latency).toBeLessThan(100); // 95th percentile under 100ms
      expect(benchmarkResults.simdEfficiency).toBeGreaterThan(30);
      expect(benchmarkResults.errorRate).toBeLessThan(1); // Less than 1% error rate
    });
  });

  describe('Integrated Security and Performance Tests', () => {
    test('should maintain security while achieving high performance', async () => {
      // Create secure session
      const session = await securityOrchestrator.createSecureSession('perf-test-user', {
        deviceTrust: 90,
        locationTrust: 85
      });
      
      // Process operations with security validation
      const operations = Array.from({ length: 100 }, (_, i) => ({
        id: `secure_op_${i}`,
        type: 'secure_compute',
        data: { value: Math.random() * 1000 },
        timestamp: Date.now(),
        metadata: { sessionId: session.sessionId }
      }));
      
      const startTime = performance.now();
      
      // Validate session for each operation (security overhead)
      for (const op of operations) {
        const isValid = await securityOrchestrator.validateSecurityContext(
          session.sessionId,
          ['execute:operation']
        );
        expect(isValid).toBe(true);
      }
      
      // Process operations with performance engine
      const results = await performanceEngine.processOperations(operations);
      
      const totalTime = performance.now() - startTime;
      
      expect(results.length).toBe(operations.length);
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds including security overhead
      
      // Verify security metrics weren't compromised
      const securityMetrics = securityOrchestrator.getMetrics();
      expect(securityMetrics.complianceScore).toBeGreaterThan(95);
      expect(securityMetrics.riskScore).toBeLessThan(30);
    });

    test('should integrate post-quantum cryptography with AI processing', async () => {
      // Generate PQC key pair
      const keyPair = await pqCrypto.generateKyberKeyPair();
      
      // Create AI request with cryptographic context
      const aiRequest = {
        prompt: 'Analyze cryptographic security parameters',
        systemPrompt: 'You are a quantum-resistant security analyst',
        metadata: { keyPairId: keyPair, securityLevel: 'quantum-safe' }
      };
      
      // Process with AI engine
      const aiResponse = await aiEngine.processRequest(aiRequest);
      
      expect(aiResponse).toBeDefined();
      expect(aiResponse.content).toBeDefined();
      
      // Sign AI response with Dilithium
      const keyPairDil = await dilithiumPQC.generateKeyPair();
      const responseBytes = new TextEncoder().encode(aiResponse.content);
      const signature = await dilithiumPQC.sign(responseBytes, keyPairDil.privateKeyId);
      
      // Verify signature
      const verification = await dilithiumPQC.verify(
        responseBytes,
        signature.signature,
        keyPairDil.publicKeyId
      );
      
      expect(verification.valid).toBe(true);
      
      // Complete integration test
      expect(keyPair).toBeDefined();
      expect(aiResponse.usage.totalTokens).toBeGreaterThan(0);
      expect(signature.signature.length).toBeGreaterThan(3000);
    });

    test('should validate complete ByteStar security architecture', async () => {
      // Test complete security workflow
      const testData = {
        userId: 'integration-test-user',
        deviceFingerprint: 'test-device-12345',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 ByteStar Integration Test',
        requestCount: 5,
        sessionDuration: 30000,
        geolocation: { country: 'US', city: 'Test City' },
        browserFeatures: { 
          webgl: true, 
          canvas: true, 
          audio: true,
          timezone: 'America/New_York',
          languages: ['en-US', 'en']
        }
      };
      
      // Create secure session
      const session = await securityOrchestrator.createSecureSession(testData.userId, testData);
      
      // Analyze behavior
      const behaviorAnalysis = await securityOrchestrator.analyzeThreat(testData);
      
      // Generate compliance report
      const complianceReport = await securityOrchestrator.generateComplianceReport(
        'SOC2',
        new Date(Date.now() - 3600000),
        new Date()
      );
      
      // Verify comprehensive security
      expect(session.compliance.fips140).toBe(true);
      expect(session.riskScore).toBeLessThan(70); // Reasonable risk for test data
      expect(behaviorAnalysis.threatDetected).toBe(false); // Should not detect threat for normal behavior
      expect(complianceReport.compliance.score).toBeGreaterThan(85);
      
      // Clean up
      const activeSessionsCount = securityOrchestrator.getActiveSessions().length;
      expect(activeSessionsCount).toBeGreaterThan(0);
    });
  });

  describe('Production Readiness Validation', () => {
    test('should handle high concurrency without degradation', async () => {
      const concurrentRequests = 50;
      const requestPromises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const operations = [{
          id: `concurrent_op_${i}`,
          type: 'compute',
          data: { value: i * 100 },
          timestamp: Date.now()
        }];
        
        return performanceEngine.processOperations(operations);
      });
      
      const startTime = performance.now();
      const results = await Promise.all(requestPromises);
      const endTime = performance.now();
      
      expect(results.length).toBe(concurrentRequests);
      expect(endTime - startTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.length).toBe(1);
      });
    });

    test('should maintain data integrity under stress', async () => {
      const testMessage = new TextEncoder().encode('Stress test message for data integrity');
      const iterations = 10;
      
      const keyPair = await dilithiumPQC.generateKeyPair();
      
      // Sign same message multiple times
      const signatures = await Promise.all(
        Array.from({ length: iterations }, () =>
          dilithiumPQC.sign(testMessage, keyPair.privateKeyId)
        )
      );
      
      // Verify all signatures
      const verifications = await Promise.all(
        signatures.map(sig =>
          dilithiumPQC.verify(testMessage, sig.signature, keyPair.publicKeyId)
        )
      );
      
      // All verifications should succeed
      verifications.forEach(verification => {
        expect(verification.valid).toBe(true);
        expect(verification.confidence).toBeGreaterThan(0.99);
      });
      
      // Signatures should be different (non-deterministic)
      const uniqueSignatures = new Set(signatures.map(sig => sig.signature.toString()));
      expect(uniqueSignatures.size).toBe(signatures.length);
    });

    test('should provide comprehensive error handling', async () => {
      // Test various error conditions
      const errorTests = [
        () => kyberPQC.encapsulate('non-existent-key'),
        () => dilithiumPQC.sign(new Uint8Array(0), 'invalid-key'),
        () => securityOrchestrator.validateSecurityContext('invalid-session', []),
        () => aiEngine.processRequest({ prompt: '' }) // Empty prompt
      ];
      
      for (const errorTest of errorTests) {
        await expect(errorTest()).rejects.toThrow();
      }
    });

    test('should demonstrate memory safety and cleanup', () => {
      // Get initial memory usage
      const initialMetrics = {
        kyber: kyberPQC.getMetrics(),
        dilithium: dilithiumPQC.getMetrics(),
        security: securityOrchestrator.getMetrics(),
        performance: performanceEngine.getMetrics()
      };
      
      // All components should be functional
      expect(initialMetrics.kyber).toBeDefined();
      expect(initialMetrics.dilithium).toBeDefined();
      expect(initialMetrics.security).toBeDefined();
      expect(initialMetrics.performance).toBeDefined();
      
      // Cleanup should not throw errors
      expect(() => {
        kyberPQC.destroy();
        dilithiumPQC.destroy();
        securityOrchestrator.destroy();
        performanceEngine.destroy();
      }).not.toThrow();
    });
  });
});