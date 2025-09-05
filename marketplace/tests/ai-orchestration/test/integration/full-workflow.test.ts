/**
 * Full Workflow Integration Tests
 * Tests the complete AI orchestration pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestOrchestrator } from '../../src/orchestrator/main.js';
import { AITestGenerator } from '../../src/models/test-generator.js';
import { AdaptiveExecutor } from '../../src/engines/adaptive-executor.js';
import { CognitiveAnalyzer } from '../../src/analysis/cognitive-analyzer.js';
import { SwarmCoordinator } from '../../src/swarm/coordinator.js';
import { EnterpriseIntegration } from '../../src/enterprise/integration.js';
import { 
  mockTensorFlow, 
  mockDocker, 
  mockRedis, 
  mockAnthropic, 
  TestHelper,
  createMockUserStory,
  testLogger
} from '../setup.js';

// Mock all external dependencies
vi.mock('@tensorflow/tfjs-node', () => mockTensorFlow);
vi.mock('@anthropic-ai/sdk', () => ({ Anthropic: vi.fn(() => mockAnthropic) }));
vi.mock('dockerode', () => ({ default: vi.fn(() => mockDocker) }));
vi.mock('redis', () => ({ createClient: () => mockRedis }));
vi.mock('ws', () => ({
  WebSocketServer: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}));
vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    close: vi.fn()
  }))
}));

describe('Full Workflow Integration', () => {
  let orchestrator: TestOrchestrator;
  let components: any;

  beforeEach(async () => {
    testLogger.info('Setting up integration test components');

    // Create component instances with mocked dependencies
    components = {
      testGenerator: new AITestGenerator(),
      executor: new AdaptiveExecutor(),
      analyzer: new CognitiveAnalyzer(),
      swarmCoordinator: new SwarmCoordinator(8081), // Use different port for tests
      enterpriseIntegration: new EnterpriseIntegration()
    };

    orchestrator = new TestOrchestrator(components);

    // Initialize orchestrator
    await orchestrator.initialize();
  });

  afterEach(async () => {
    testLogger.info('Cleaning up integration test components');
    
    if (orchestrator) {
      await orchestrator.stop();
    }
  });

  describe('Complete Orchestration Workflow', () => {
    it('should execute full AI orchestration workflow', async () => {
      const userStory = 'As a user, I want to log in with my email and password to access my account dashboard';
      
      testLogger.info(`Starting full workflow test with story: ${userStory}`);
      
      // Execute complete workflow
      const sessionId = await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false, // Disable swarm for simpler testing
        parallel: true,
        maxConcurrency: 3,
        generateComplianceReport: false
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session_/);

      // Wait for workflow completion
      await TestHelper.waitFor(() => {
        const session = orchestrator.getExecutionSession(sessionId);
        return session?.then(s => s?.status === 'completed' || s?.status === 'failed') || false;
      }, 15000);

      const session = await orchestrator.getExecutionSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session!.status).toBe('completed');
      expect(session!.endTime).toBeDefined();

      // Verify all phases completed
      expect(session!.phases.generation.status).toBe('completed');
      expect(session!.phases.execution.status).toBe('completed');
      expect(session!.phases.analysis.status).toBe('completed');
      expect(session!.phases.reporting.status).toBe('completed');

      // Verify results
      expect(session!.results.testSuite).toBeDefined();
      expect(session!.results.testResults).toBeDefined();
      expect(session!.results.analysis).toBeDefined();
      expect(session!.results.executionReport).toBeDefined();

      testLogger.info('Full workflow test completed successfully');
    }, 20000);

    it('should handle workflow failures gracefully', async () => {
      // Mock a failure in the generation phase
      const originalGenerate = components.testGenerator.generateFromUserStory;
      components.testGenerator.generateFromUserStory = vi.fn().mockRejectedValue(
        new Error('Test generation failed')
      );

      const userStory = 'This should fail during generation';
      
      await expect(
        orchestrator.orchestrateFullWorkflow(userStory)
      ).rejects.toThrow('Test generation failed');

      // Restore original method
      components.testGenerator.generateFromUserStory = originalGenerate;
    });

    it('should track metrics during workflow execution', async () => {
      const userStory = 'As a user, I want to test metrics tracking';
      
      const initialMetrics = await orchestrator.getSystemMetrics();
      const initialExecutions = initialMetrics.orchestrator.totalExecutions;

      await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false,
        parallel: false
      });

      const finalMetrics = await orchestrator.getSystemMetrics();
      
      expect(finalMetrics.orchestrator.totalExecutions).toBe(initialExecutions + 1);
      expect(finalMetrics.orchestrator.successfulExecutions).toBeGreaterThan(0);
    });
  });

  describe('Component Integration', () => {
    it('should properly initialize all components', async () => {
      // Verify all components are initialized
      expect(components.testGenerator).toBeDefined();
      expect(components.executor).toBeDefined();
      expect(components.analyzer).toBeDefined();
      expect(components.swarmCoordinator).toBeDefined();
      expect(components.enterpriseIntegration).toBeDefined();

      // Check system health
      const metrics = await orchestrator.getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.orchestrator).toBeDefined();
    });

    it('should handle component communication', async () => {
      const userStory = 'Test component communication';
      
      // Mock component methods to verify they're called
      const generateSpy = vi.spyOn(components.testGenerator, 'generateFromUserStory');
      const executeSpy = vi.spyOn(components.executor, 'executeTestSuite');
      const analyzeSpy = vi.spyOn(components.analyzer, 'analyzeTestResults');

      await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false,
        parallel: false
      });

      // Verify components were called in correct sequence
      expect(generateSpy).toHaveBeenCalledWith(userStory);
      expect(executeSpy).toHaveBeenCalled();
      expect(analyzeSpy).toHaveBeenCalled();
    });

    it('should propagate events between components', async () => {
      let eventReceived = false;
      
      orchestrator.on('orchestration_completed', () => {
        eventReceived = true;
      });

      await orchestrator.orchestrateFullWorkflow('Test event propagation', {
        useSwarm: false
      });

      expect(eventReceived).toBe(true);
    });
  });

  describe('Swarm Integration', () => {
    it('should execute tests via swarm when enabled', async () => {
      const userStory = 'Test swarm execution';
      
      // Mock swarm task distribution
      const distributeSpy = vi.spyOn(components.swarmCoordinator, 'distributeTask')
        .mockResolvedValue(undefined);

      await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: true,
        parallel: true
      });

      // Swarm should be used for task distribution
      expect(distributeSpy).toHaveBeenCalled();
    });

    it('should handle swarm node failures', async () => {
      const userStory = 'Test swarm failure handling';
      
      // Mock swarm failure
      vi.spyOn(components.swarmCoordinator, 'distributeTask')
        .mockRejectedValue(new Error('No nodes available'));

      await expect(
        orchestrator.orchestrateFullWorkflow(userStory, { useSwarm: true })
      ).rejects.toThrow();
    });
  });

  describe('Enterprise Integration', () => {
    it('should generate notifications for test results', async () => {
      const userStory = 'Test notification generation';
      
      const notificationSpy = vi.spyOn(components.enterpriseIntegration, 'sendTestNotifications')
        .mockResolvedValue(undefined);

      await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false
      });

      expect(notificationSpy).toHaveBeenCalled();
    });

    it('should generate compliance reports when requested', async () => {
      const userStory = 'Test compliance reporting';
      
      const complianceSpy = vi.spyOn(components.enterpriseIntegration, 'generateComplianceReport')
        .mockResolvedValue({
          id: 'compliance_1',
          generatedAt: new Date(),
          period: { start: new Date(), end: new Date() },
          overallScore: 95,
          sections: [],
          recommendations: [],
          auditTrail: [],
          certifications: []
        });

      await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false,
        generateComplianceReport: true
      });

      expect(complianceSpy).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent orchestration requests', async () => {
      const requests = Array(3).fill(null).map((_, index) =>
        orchestrator.orchestrateFullWorkflow(`Test concurrent request ${index}`, {
          useSwarm: false,
          parallel: false
        })
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(3);
      results.forEach(sessionId => {
        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe('string');
      });
    }, 30000);

    it('should complete workflow within reasonable time', async () => {
      const start = Date.now();
      
      await orchestrator.orchestrateFullWorkflow('Performance test story', {
        useSwarm: false,
        parallel: true,
        maxConcurrency: 5
      });
      
      const duration = Date.now() - start;
      
      // Should complete within 15 seconds for test environment
      expect(duration).toBeLessThan(15000);
    });

    it('should maintain system health during load', async () => {
      const initialMetrics = await orchestrator.getSystemMetrics();
      const initialHealth = initialMetrics.orchestrator.systemHealth;

      // Execute multiple workflows
      const workflows = Array(5).fill(null).map((_, i) =>
        orchestrator.orchestrateFullWorkflow(`Load test ${i}`, {
          useSwarm: false,
          parallel: true
        })
      );

      await Promise.all(workflows);

      const finalMetrics = await orchestrator.getSystemMetrics();
      
      // System health should remain stable
      expect(finalMetrics.orchestrator.systemHealth).toBeGreaterThanOrEqual(
        initialHealth * 0.8 // Allow for some degradation under load
      );
    }, 45000);
  });

  describe('Error Recovery', () => {
    it('should recover from temporary component failures', async () => {
      const userStory = 'Test error recovery';
      
      // Temporarily fail the analyzer
      const originalAnalyze = components.analyzer.analyzeTestResults;
      let failCount = 0;
      
      components.analyzer.analyzeTestResults = vi.fn().mockImplementation(async () => {
        failCount++;
        if (failCount === 1) {
          throw new Error('Temporary analyzer failure');
        }
        return originalAnalyze.call(components.analyzer, []);
      });

      // First attempt should fail
      await expect(
        orchestrator.orchestrateFullWorkflow(userStory, { useSwarm: false })
      ).rejects.toThrow('Temporary analyzer failure');

      // Second attempt should succeed
      const sessionId = await orchestrator.orchestrateFullWorkflow(userStory, { 
        useSwarm: false 
      });
      
      expect(sessionId).toBeDefined();
      
      const session = await orchestrator.getExecutionSession(sessionId);
      expect(session?.status).toBe('completed');

      // Restore original method
      components.analyzer.analyzeTestResults = originalAnalyze;
    });

    it('should handle resource cleanup on failure', async () => {
      const userStory = 'Test resource cleanup';
      
      // Force a failure after generation but before execution
      const originalExecute = components.executor.executeTestSuite;
      components.executor.executeTestSuite = vi.fn().mockRejectedValue(
        new Error('Execution failed')
      );

      await expect(
        orchestrator.orchestrateFullWorkflow(userStory, { useSwarm: false })
      ).rejects.toThrow('Execution failed');

      // Verify resources are cleaned up - session should be marked as failed
      // This test would be more comprehensive in a real environment
      const metrics = await orchestrator.getSystemMetrics();
      expect(metrics.orchestrator.failedExecutions).toBeGreaterThanOrEqual(1);

      // Restore original method
      components.executor.executeTestSuite = originalExecute;
    });
  });

  describe('Data Flow Integrity', () => {
    it('should maintain data integrity throughout the pipeline', async () => {
      const userStory = 'As a user, I want to verify data flow integrity';
      
      // Add data validation at each stage
      const sessionId = await orchestrator.orchestrateFullWorkflow(userStory, {
        useSwarm: false
      });

      const session = await orchestrator.getExecutionSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session!.userStory).toBe(userStory);

      // Verify test suite was generated
      expect(session!.results.testSuite).toBeDefined();
      expect(session!.results.testSuite!.tests.length).toBeGreaterThan(0);

      // Verify test results were created
      expect(session!.results.testResults).toBeDefined();
      expect(session!.results.testResults!.length).toBeGreaterThan(0);

      // Verify analysis was performed
      expect(session!.results.analysis).toBeDefined();

      // Verify execution report was generated
      expect(session!.results.executionReport).toBeDefined();
      expect(session!.results.executionReport!.userStory).toBe(userStory);
    });
  });
});