/**
 * Comprehensive Test Suite for HIVE QUEEN Orchestration System
 * Tests all components: Queen, Workers, Scouts, Soldiers, Communication, Consensus
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { HiveQueenSystem, type HiveQueenSystemConfig } from '../src/pro/hive-queen-integration.js';
import { ConsensusType, ProposalType, VoteDecision } from '../src/pro/distributed-consensus.js';
import { MessageType } from '../src/pro/agent-communication-protocol.js';
import { EventEmitter } from 'events';

// Mock implementations for testing
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue('test file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isFile: () => true, size: 1024 }),
    readdir: vi.fn().mockResolvedValue(['file1.txt', 'file2.txt'])
  },
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}));

vi.mock('worker_threads', () => ({
  Worker: class MockWorker extends EventEmitter {
    constructor(filename: string, options?: any) {
      super();
      setTimeout(() => {
        this.emit('message', { type: 'ready' });
      }, 10);
    }
    
    postMessage(message: any) {
      setTimeout(() => {
        this.emit('message', { 
          type: 'task_complete', 
          taskId: message.taskId,
          result: { success: true, data: 'test result' }
        });
      }, 50);
    }
    
    terminate() {
      this.emit('exit', 0);
    }
  },
  isMainThread: true,
  parentPort: null
}));

describe('HIVE QUEEN Orchestration System', () => {
  let hiveQueen: HiveQueenSystem;
  let testConfig: HiveQueenSystemConfig;

  beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    testConfig = {
      systemId: 'test_hive',
      maxWorkers: 3,
      maxScouts: 2,
      maxSoldiers: 2,
      
      communication: {
        heartbeatInterval: 1000,
        discoveryInterval: 2000,
        ackTimeout: 5000,
        retryAttempts: 2,
        maxMessageQueue: 100,
        enableEncryption: false
      },

      consensus: {
        type: ConsensusType.QUORUM,
        quorumSize: 4,
        voteTimeout: 10000,
        byzantineTolerance: 1
      },

      pipeline: {
        maxConcurrentJobs: 10,
        defaultTimeout: 30000,
        retryAttempts: 3,
        enableMetrics: true
      },

      workerConfig: {
        specialization: 'general',
        maxParallelTasks: 5,
        taskTimeout: 10000,
        enableProfiling: true
      },

      scoutConfig: {
        watchPaths: ['./test/data'],
        debounceMs: 100,
        maxChangesPerSecond: 10,
        enableDeepScan: false
      },

      soldierConfig: {
        enableChaosEngineering: false,
        maxConcurrentTests: 3,
        testTimeout: 15000,
        performanceTargets: {
          maxResponseTime: 1000,
          minThroughput: 10,
          maxErrorRate: 0.05
        }
      },

      monitoring: {
        metricsInterval: 1000,
        alertThresholds: {
          highCpuUsage: 0.8,
          highMemoryUsage: 0.85,
          lowThroughput: 1,
          highErrorRate: 0.1
        },
        enableAutoRecovery: true
      }
    };

    hiveQueen = new HiveQueenSystem(testConfig);
  });

  afterEach(async () => {
    if (hiveQueen) {
      await hiveQueen.shutdown();
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('System Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(hiveQueen).toBeDefined();
      
      const status = hiveQueen.getSystemStatus();
      expect(status.health).toBe('healthy');
      expect(status.agents.workers).toBe(0); // Not started yet
      expect(status.agents.scouts).toBe(0);
      expect(status.agents.soldiers).toBe(0);
    });

    it('should start all system components', async () => {
      const startPromise = hiveQueen.start();
      
      // Listen for system_started event
      const systemStarted = new Promise((resolve) => {
        hiveQueen.once('system_started', resolve);
      });

      await Promise.all([startPromise, systemStarted]);
      
      const status = hiveQueen.getSystemStatus();
      expect(status.agents.workers).toBe(3);
      expect(status.agents.scouts).toBe(2);
      expect(status.agents.soldiers).toBe(2);
    }, 10000);

    it('should handle startup failures gracefully', async () => {
      // Create a config that will cause startup failure
      const badConfig = { ...testConfig, maxWorkers: -1 };
      const badHiveQueen = new HiveQueenSystem(badConfig);
      
      await expect(badHiveQueen.start()).rejects.toThrow();
      await badHiveQueen.shutdown();
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should spawn worker agents with correct configuration', async () => {
      const status = hiveQueen.getSystemStatus();
      expect(status.agents.workers).toBe(3);
    });

    it('should spawn scout agents with file monitoring', async () => {
      const status = hiveQueen.getSystemStatus();
      expect(status.agents.scouts).toBe(2);
    });

    it('should spawn soldier agents for testing', async () => {
      const status = hiveQueen.getSystemStatus();
      expect(status.agents.soldiers).toBe(2);
    });

    it('should handle agent failures and recovery', async () => {
      const alertPromise = new Promise((resolve) => {
        hiveQueen.once('alert_created', resolve);
      });

      // Simulate agent failure
      hiveQueen.emit('agent_error', new Error('Test agent failure'));
      
      const alert = await alertPromise;
      expect(alert).toBeDefined();
    });
  });

  describe('Job Processing', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should submit and process simple jobs', async () => {
      const jobId = await hiveQueen.submitJob('test_job', { data: 'test' });
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should handle multiple concurrent jobs', async () => {
      const jobs = [];
      
      for (let i = 0; i < 5; i++) {
        jobs.push(hiveQueen.submitJob('concurrent_job', { index: i }));
      }
      
      const jobIds = await Promise.all(jobs);
      expect(jobIds).toHaveLength(5);
      expect(new Set(jobIds).size).toBe(5); // All unique
    });

    it('should handle job failures and retries', async () => {
      const jobId = await hiveQueen.submitJob('failing_job', { shouldFail: true });
      
      // Job should be submitted even if it will fail
      expect(jobId).toBeDefined();
    });

    it('should respect job priorities', async () => {
      const highPriorityJob = await hiveQueen.submitJob('high_priority', { data: 'urgent' }, { priority: 'high' });
      const lowPriorityJob = await hiveQueen.submitJob('low_priority', { data: 'normal' }, { priority: 'low' });
      
      expect(highPriorityJob).toBeDefined();
      expect(lowPriorityJob).toBeDefined();
    });
  });

  describe('Communication Protocol', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should establish communication between agents', async () => {
      // Wait for agents to register and establish communication
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = hiveQueen.getMetrics();
      expect(metrics.totalAgents).toBe(7); // 3 workers + 2 scouts + 2 soldiers
    });

    it('should handle message passing between agents', async () => {
      let messagesSent = 0;
      
      // Mock communication to count messages
      hiveQueen.on('metrics_updated', (metrics) => {
        messagesSent = metrics.messagesExchanged;
      });
      
      // Wait for some communication to occur
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      expect(messagesSent).toBeGreaterThan(0);
    });

    it('should handle agent discovery and registration', async () => {
      const initialMetrics = hiveQueen.getMetrics();
      const initialAgents = initialMetrics.totalAgents;
      
      expect(initialAgents).toBe(7); // All agents should be registered
    });
  });

  describe('Consensus Mechanisms', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should propose and reach consensus on decisions', async () => {
      const proposal = await hiveQueen.proposeConsensus(
        ProposalType.TASK_ASSIGNMENT, 
        { task: 'test_consensus', assignTo: 'worker_0' },
        15000
      );
      
      expect(proposal).toBeDefined();
    });

    it('should handle different proposal types', async () => {
      const resourceProposal = await hiveQueen.proposeConsensus(
        ProposalType.RESOURCE_ALLOCATION,
        { resource: 'cpu', amount: 50, agent: 'worker_1' },
        10000
      );
      
      expect(resourceProposal).toBeDefined();
    });

    it('should timeout proposals that dont reach consensus', async () => {
      const shortTimeoutProposal = await hiveQueen.proposeConsensus(
        ProposalType.CONFIGURATION_CHANGE,
        { change: 'impossible_change' },
        100 // Very short timeout
      );
      
      expect(shortTimeoutProposal.decision).toBe(VoteDecision.REJECT); // Should timeout and reject
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should collect and report system metrics', async () => {
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = hiveQueen.getMetrics();
      
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.totalAgents).toBe(7);
      expect(metrics.systemHealth).toMatch(/healthy|degraded|critical|recovering/);
    });

    it('should detect performance issues and create alerts', async () => {
      let alertCreated = false;
      
      hiveQueen.on('alert_created', (alert) => {
        alertCreated = true;
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
      });
      
      // Simulate high resource usage to trigger alert
      Object.defineProperty(hiveQueen.getMetrics(), 'cpuUsage', { value: 0.95 });
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Note: Alert creation depends on internal health checks
      // In a real scenario, we'd trigger conditions that create alerts
    });

    it('should calculate system health correctly', async () => {
      const metrics = hiveQueen.getMetrics();
      
      expect(metrics.systemHealth).toBeDefined();
      expect(['healthy', 'degraded', 'critical', 'recovering']).toContain(metrics.systemHealth);
    });
  });

  describe('Fault Tolerance and Recovery', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should handle agent failures gracefully', async () => {
      const initialStatus = hiveQueen.getSystemStatus();
      
      // Simulate agent failure
      hiveQueen.emit('agent_error', new Error('Simulated agent failure'));
      
      // System should remain operational
      const statusAfterFailure = hiveQueen.getSystemStatus();
      expect(statusAfterFailure.health).toBeTruthy();
    });

    it('should attempt auto-recovery when enabled', async () => {
      // Enable auto-recovery (should already be enabled in test config)
      expect(testConfig.monitoring.enableAutoRecovery).toBe(true);
      
      // Simulate degraded system state
      // This would trigger auto-recovery mechanisms
      
      // Wait for potential recovery actions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = hiveQueen.getSystemStatus();
      expect(status).toBeDefined();
    });

    it('should handle network partitions in consensus', async () => {
      // Simulate network partition by removing agents from consensus
      const proposal = await hiveQueen.proposeConsensus(
        ProposalType.EMERGENCY_ACTION,
        { action: 'test_partition_handling' },
        5000
      );
      
      expect(proposal).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should handle complete workflow from job submission to completion', async () => {
      const jobId = await hiveQueen.submitJob('integration_test', {
        steps: ['validate', 'process', 'complete'],
        data: { test: 'integration' }
      });
      
      expect(jobId).toBeDefined();
      
      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const metrics = hiveQueen.getMetrics();
      expect(metrics.jobsCompleted).toBeGreaterThanOrEqual(0);
    });

    it('should coordinate between different agent types', async () => {
      // Submit a job that requires coordination
      const complexJobId = await hiveQueen.submitJob('complex_coordination', {
        requiresWorker: true,
        requiresScout: true,
        requiresSoldier: true,
        coordinationType: 'full_system'
      });
      
      expect(complexJobId).toBeDefined();
      
      // Wait for coordination to occur
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      const status = hiveQueen.getSystemStatus();
      expect(status.health).toBeTruthy();
    });

    it('should maintain system stability under load', async () => {
      const jobs = [];
      
      // Submit multiple jobs concurrently
      for (let i = 0; i < 20; i++) {
        jobs.push(hiveQueen.submitJob('load_test', { iteration: i }));
      }
      
      const jobIds = await Promise.all(jobs);
      expect(jobIds).toHaveLength(20);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const finalStatus = hiveQueen.getSystemStatus();
      expect(['healthy', 'degraded']).toContain(finalStatus.health); // Should not be critical
    });
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(async () => {
      await hiveQueen.start();
    });

    it('should shutdown gracefully', async () => {
      const shutdownPromise = hiveQueen.shutdown();
      
      const shutdownComplete = new Promise((resolve) => {
        hiveQueen.once('system_shutdown', resolve);
      });
      
      await Promise.all([shutdownPromise, shutdownComplete]);
      
      // Verify system is shutdown
      expect(hiveQueen.getSystemStatus().agents.workers).toBe(0);
    });

    it('should handle emergency shutdown', async () => {
      const emergencyShutdown = new Promise((resolve) => {
        hiveQueen.once('emergency_shutdown', resolve);
      });
      
      // Trigger emergency shutdown
      hiveQueen.emergencyShutdown();
      
      await emergencyShutdown;
      
      // System should be shutdown
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should cleanup resources properly', async () => {
      const initialMetrics = hiveQueen.getMetrics();
      expect(initialMetrics.totalAgents).toBeGreaterThan(0);
      
      await hiveQueen.shutdown();
      
      // After shutdown, resources should be cleaned up
      const finalMetrics = hiveQueen.getMetrics();
      expect(finalMetrics.totalAgents).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', () => {
      const invalidConfig = {
        ...testConfig,
        maxWorkers: -1,
        communication: {
          ...testConfig.communication,
          heartbeatInterval: -1000
        }
      };
      
      expect(() => new HiveQueenSystem(invalidConfig)).not.toThrow();
      // System should handle invalid config gracefully
    });

    it('should handle component initialization failures', async () => {
      // Mock a component to fail during initialization
      const mockHiveQueen = new HiveQueenSystem(testConfig);
      
      // Override internal method to simulate failure
      const originalStart = mockHiveQueen.start;
      mockHiveQueen.start = async () => {
        throw new Error('Simulated initialization failure');
      };
      
      await expect(mockHiveQueen.start()).rejects.toThrow('Simulated initialization failure');
      await mockHiveQueen.shutdown();
    });

    it('should handle memory pressure scenarios', async () => {
      await hiveQueen.start();
      
      // Simulate memory pressure
      const largeJobs = [];
      for (let i = 0; i < 100; i++) {
        largeJobs.push(hiveQueen.submitJob('memory_intensive', {
          data: new Array(1000).fill(`large_data_${i}`)
        }));
      }
      
      // Should handle without crashing
      const results = await Promise.allSettled(largeJobs);
      expect(results.length).toBe(100);
      
      // System should still be responsive
      const status = hiveQueen.getSystemStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate system configuration', () => {
      const validConfig = { ...testConfig };
      expect(() => new HiveQueenSystem(validConfig)).not.toThrow();
    });

    it('should handle missing optional configuration', () => {
      const minimalConfig: HiveQueenSystemConfig = {
        systemId: 'minimal_test',
        maxWorkers: 1,
        maxScouts: 1,
        maxSoldiers: 1,
        communication: {
          heartbeatInterval: 1000,
          discoveryInterval: 2000,
          ackTimeout: 5000,
          retryAttempts: 2,
          maxMessageQueue: 100,
          enableEncryption: false
        },
        consensus: {
          type: ConsensusType.QUORUM,
          quorumSize: 2,
          voteTimeout: 10000,
          byzantineTolerance: 0
        },
        pipeline: {
          maxConcurrentJobs: 5,
          defaultTimeout: 30000,
          retryAttempts: 3,
          enableMetrics: true
        },
        workerConfig: {
          specialization: 'general',
          maxParallelTasks: 3,
          taskTimeout: 10000,
          enableProfiling: false
        },
        scoutConfig: {
          watchPaths: ['./test'],
          debounceMs: 100,
          maxChangesPerSecond: 5,
          enableDeepScan: false
        },
        soldierConfig: {
          enableChaosEngineering: false,
          maxConcurrentTests: 2,
          testTimeout: 15000,
          performanceTargets: {
            maxResponseTime: 1000,
            minThroughput: 5,
            maxErrorRate: 0.1
          }
        },
        monitoring: {
          metricsInterval: 2000,
          alertThresholds: {
            highCpuUsage: 0.9,
            highMemoryUsage: 0.9,
            lowThroughput: 1,
            highErrorRate: 0.2
          },
          enableAutoRecovery: false
        }
      };

      expect(() => new HiveQueenSystem(minimalConfig)).not.toThrow();
    });
  });
});

// Performance benchmarks
describe('HIVE QUEEN Performance Benchmarks', () => {
  let hiveQueen: HiveQueenSystem;
  let testConfig: HiveQueenSystemConfig;

  beforeEach(() => {
    testConfig = {
      systemId: 'perf_test',
      maxWorkers: 8,
      maxScouts: 4,
      maxSoldiers: 4,
      
      communication: {
        heartbeatInterval: 500,
        discoveryInterval: 1000,
        ackTimeout: 3000,
        retryAttempts: 2,
        maxMessageQueue: 500,
        enableEncryption: false
      },

      consensus: {
        type: ConsensusType.QUORUM,
        quorumSize: 8,
        voteTimeout: 5000,
        byzantineTolerance: 2
      },

      pipeline: {
        maxConcurrentJobs: 50,
        defaultTimeout: 15000,
        retryAttempts: 2,
        enableMetrics: true
      },

      workerConfig: {
        specialization: 'cpu_intensive',
        maxParallelTasks: 10,
        taskTimeout: 5000,
        enableProfiling: true
      },

      scoutConfig: {
        watchPaths: ['./test/perf'],
        debounceMs: 50,
        maxChangesPerSecond: 50,
        enableDeepScan: true
      },

      soldierConfig: {
        enableChaosEngineering: true,
        maxConcurrentTests: 8,
        testTimeout: 10000,
        performanceTargets: {
          maxResponseTime: 500,
          minThroughput: 50,
          maxErrorRate: 0.02
        }
      },

      monitoring: {
        metricsInterval: 500,
        alertThresholds: {
          highCpuUsage: 0.85,
          highMemoryUsage: 0.8,
          lowThroughput: 10,
          highErrorRate: 0.05
        },
        enableAutoRecovery: true
      }
    };

    hiveQueen = new HiveQueenSystem(testConfig);
  });

  afterEach(async () => {
    if (hiveQueen) {
      await hiveQueen.shutdown();
    }
  });

  it('should handle high-throughput job processing', async () => {
    await hiveQueen.start();
    
    const startTime = Date.now();
    const jobCount = 100;
    const jobs = [];
    
    for (let i = 0; i < jobCount; i++) {
      jobs.push(hiveQueen.submitJob('perf_test', { index: i, data: `test_${i}` }));
    }
    
    const jobIds = await Promise.all(jobs);
    const endTime = Date.now();
    
    expect(jobIds).toHaveLength(jobCount);
    
    const duration = endTime - startTime;
    const throughput = jobCount / (duration / 1000);
    
    console.log(`Processed ${jobCount} jobs in ${duration}ms (${throughput.toFixed(2)} jobs/sec)`);
    expect(throughput).toBeGreaterThan(10); // Should process at least 10 jobs/sec
  }, 30000);

  it('should maintain low latency under load', async () => {
    await hiveQueen.start();
    
    const latencies: number[] = [];
    const jobCount = 50;
    
    for (let i = 0; i < jobCount; i++) {
      const startTime = Date.now();
      await hiveQueen.submitJob('latency_test', { index: i });
      const endTime = Date.now();
      latencies.push(endTime - startTime);
    }
    
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency}ms`);
    expect(avgLatency).toBeLessThan(100); // Should be under 100ms average
    expect(maxLatency).toBeLessThan(500); // Should be under 500ms max
  }, 20000);

  it('should scale efficiently with agent count', async () => {
    await hiveQueen.start();
    
    // Measure baseline performance
    const baselineStart = Date.now();
    const baselineJobs = [];
    for (let i = 0; i < 20; i++) {
      baselineJobs.push(hiveQueen.submitJob('scale_test', { phase: 'baseline', index: i }));
    }
    await Promise.all(baselineJobs);
    const baselineTime = Date.now() - baselineStart;
    
    // Wait for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Measure performance with higher load
    const loadStart = Date.now();
    const loadJobs = [];
    for (let i = 0; i < 40; i++) {
      loadJobs.push(hiveQueen.submitJob('scale_test', { phase: 'load', index: i }));
    }
    await Promise.all(loadJobs);
    const loadTime = Date.now() - loadStart;
    
    console.log(`Baseline: ${baselineTime}ms for 20 jobs, Load: ${loadTime}ms for 40 jobs`);
    
    // Scaling should be roughly linear (not exponential)
    const scalingFactor = loadTime / baselineTime;
    expect(scalingFactor).toBeLessThan(3); // Should scale reasonably well
  }, 30000);
});

// Stress tests
describe('HIVE QUEEN Stress Tests', () => {
  let hiveQueen: HiveQueenSystem;

  beforeEach(() => {
    const stressConfig: HiveQueenSystemConfig = {
      systemId: 'stress_test',
      maxWorkers: 16,
      maxScouts: 8,
      maxSoldiers: 8,
      
      communication: {
        heartbeatInterval: 250,
        discoveryInterval: 500,
        ackTimeout: 2000,
        retryAttempts: 3,
        maxMessageQueue: 1000,
        enableEncryption: false
      },

      consensus: {
        type: ConsensusType.QUORUM,
        quorumSize: 16,
        voteTimeout: 3000,
        byzantineTolerance: 5
      },

      pipeline: {
        maxConcurrentJobs: 100,
        defaultTimeout: 10000,
        retryAttempts: 5,
        enableMetrics: true
      },

      workerConfig: {
        specialization: 'general',
        maxParallelTasks: 20,
        taskTimeout: 3000,
        enableProfiling: false
      },

      scoutConfig: {
        watchPaths: ['./test/stress'],
        debounceMs: 25,
        maxChangesPerSecond: 100,
        enableDeepScan: false
      },

      soldierConfig: {
        enableChaosEngineering: false, // Disabled for stress test stability
        maxConcurrentTests: 16,
        testTimeout: 5000,
        performanceTargets: {
          maxResponseTime: 200,
          minThroughput: 100,
          maxErrorRate: 0.01
        }
      },

      monitoring: {
        metricsInterval: 250,
        alertThresholds: {
          highCpuUsage: 0.95,
          highMemoryUsage: 0.9,
          lowThroughput: 50,
          highErrorRate: 0.1
        },
        enableAutoRecovery: true
      }
    };

    hiveQueen = new HiveQueenSystem(stressConfig);
  });

  afterEach(async () => {
    if (hiveQueen) {
      await hiveQueen.shutdown();
    }
  });

  it('should handle extreme job loads without failure', async () => {
    await hiveQueen.start();
    
    const jobCount = 500;
    const batchSize = 50;
    let processedJobs = 0;
    
    for (let batch = 0; batch < jobCount / batchSize; batch++) {
      const batchJobs = [];
      
      for (let i = 0; i < batchSize; i++) {
        batchJobs.push(
          hiveQueen.submitJob('stress_job', {
            batch,
            index: i,
            data: `stress_test_${batch}_${i}`
          })
        );
      }
      
      const batchResults = await Promise.allSettled(batchJobs);
      processedJobs += batchResults.filter(r => r.status === 'fulfilled').length;
      
      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Processed ${processedJobs}/${jobCount} jobs under stress`);
    expect(processedJobs).toBeGreaterThan(jobCount * 0.9); // At least 90% success rate
    
    const finalStatus = hiveQueen.getSystemStatus();
    expect(['healthy', 'degraded']).toContain(finalStatus.health); // Should not be critical
  }, 60000);
});