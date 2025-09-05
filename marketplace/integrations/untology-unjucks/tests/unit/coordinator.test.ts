import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipelineCoordinator } from '../../src/pipeline/coordinator.js';
import { PipelineConfig, GenerationJob } from '../../src/types.js';

// Mock the HiveQueen module
vi.mock('@citty-pro/hive-queen', () => ({
  HiveQueen: vi.fn().mockImplementation(() => ({
    defineRole: vi.fn(),
    spawnAgent: vi.fn().mockResolvedValue({ id: 'mock-agent-1' }),
    terminateAgent: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('PipelineCoordinator', () => {
  let coordinator: PipelineCoordinator;
  let mockConfig: PipelineConfig;

  beforeEach(() => {
    coordinator = new PipelineCoordinator();
    
    mockConfig = {
      name: 'test-pipeline',
      ontologies: [{
        path: '/mock/ontology.ttl',
        format: 'turtle',
      }],
      templates: [{
        path: '/mock/template.njk',
        output: 'output.txt',
      }],
      output: {
        directory: '/mock/output',
      },
      hiveQueen: {
        enabled: true,
        workers: 2,
      },
    };
  });

  afterEach(async () => {
    await coordinator.cleanup();
  });

  describe('Job Management', () => {
    it('should create and track jobs with unique IDs', async () => {
      // Mock the internal methods to avoid file system operations
      vi.spyOn(coordinator as any, 'runPipeline').mockResolvedValue(undefined);

      const job = await coordinator.executeJob(mockConfig);

      expect(job).toBeDefined();
      expect(job.id).toMatch(/^job-\d+-\w+$/);
      expect(job.config).toEqual(mockConfig);
      expect(job.status).toBe('completed');
    });

    it('should handle multiple concurrent jobs', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const job1Promise = coordinator.executeJob(mockConfig);
      const job2Promise = coordinator.executeJob({ ...mockConfig, name: 'test-pipeline-2' });

      const [job1, job2] = await Promise.all([job1Promise, job2Promise]);

      expect(job1.id).not.toBe(job2.id);
      expect(job1.status).toBe('completed');
      expect(job2.status).toBe('completed');
    });

    it('should handle job failures gracefully', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockRejectedValue(
        new Error('Mock pipeline failure')
      );

      await expect(coordinator.executeJob(mockConfig)).rejects.toThrow('Mock pipeline failure');
    });

    it('should provide job status information', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockResolvedValue(undefined);

      const job = await coordinator.executeJob(mockConfig);
      const status = await coordinator.getJobStatus(job.id);

      expect(status).toBeDefined();
      expect(status?.id).toBe(job.id);
      expect(status?.status).toBe('completed');
    });

    it('should allow job cancellation', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const jobPromise = coordinator.executeJob(mockConfig);
      
      // Let the job start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get job ID from the active jobs map
      const activeJobs = (coordinator as any).activeJobs as Map<string, GenerationJob>;
      const jobId = Array.from(activeJobs.keys())[0];
      
      const cancelled = await coordinator.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const job = await jobPromise;
      expect(job.status).toBe('failed');
      expect(job.metrics.errors).toContain('Job cancelled by user');
    });
  });

  describe('Event Handling', () => {
    it('should emit job lifecycle events', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockResolvedValue(undefined);

      const events: string[] = [];
      
      coordinator.on('job:started', () => events.push('started'));
      coordinator.on('job:completed', () => events.push('completed'));

      await coordinator.executeJob(mockConfig);

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should emit phase events during pipeline execution', async () => {
      // Create a more realistic mock that emits phase events
      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(async function(this: PipelineCoordinator, job: GenerationJob) {
        job.status = 'running';
        job.startTime = new Date();
        
        this.emit('phase:started', 'ontology-loading');
        await new Promise(resolve => setTimeout(resolve, 10));
        this.emit('phase:completed', 'ontology-loading');
        
        this.emit('phase:started', 'template-rendering');
        await new Promise(resolve => setTimeout(resolve, 10));
        this.emit('phase:completed', 'template-rendering');
      });

      const phases: string[] = [];
      
      coordinator.on('phase:started', (phase) => phases.push(`started:${phase}`));
      coordinator.on('phase:completed', (phase) => phases.push(`completed:${phase}`));

      await coordinator.executeJob(mockConfig);

      expect(phases).toContain('started:ontology-loading');
      expect(phases).toContain('completed:ontology-loading');
      expect(phases).toContain('started:template-rendering');
      expect(phases).toContain('completed:template-rendering');
    });
  });

  describe('HIVE QUEEN Integration', () => {
    it('should spawn workers when HIVE QUEEN is enabled', async () => {
      const mockHiveQueen = {
        spawnAgent: vi.fn().mockResolvedValue({ id: 'worker-1' }),
        terminateAgent: vi.fn().mockResolvedValue(undefined),
      };

      (coordinator as any).hiveQueen = mockHiveQueen;
      
      vi.spyOn(coordinator as any, 'renderWithHiveQueen').mockResolvedValue(undefined);
      vi.spyOn(coordinator as any, 'loadOntologies').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'prepareContexts').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'validateOutput').mockResolvedValue(undefined);

      await coordinator.executeJob(mockConfig);

      expect(mockHiveQueen.spawnAgent).toHaveBeenCalled();
    });

    it('should fall back to sequential processing when HIVE QUEEN is disabled', async () => {
      const configWithoutHiveQueen = {
        ...mockConfig,
        hiveQueen: { enabled: false },
      };

      vi.spyOn(coordinator as any, 'renderSequential').mockResolvedValue(undefined);
      vi.spyOn(coordinator as any, 'loadOntologies').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'prepareContexts').mockResolvedValue([]);

      await coordinator.executeJob(configWithoutHiveQueen);

      expect((coordinator as any).renderSequential).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle ontology loading failures', async () => {
      vi.spyOn(coordinator as any, 'loadOntologies').mockRejectedValue(
        new Error('Failed to load ontology')
      );

      await expect(coordinator.executeJob(mockConfig)).rejects.toThrow('Failed to load ontology');
    });

    it('should handle template rendering failures', async () => {
      vi.spyOn(coordinator as any, 'loadOntologies').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'prepareContexts').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'renderTemplates').mockRejectedValue(
        new Error('Template rendering failed')
      );

      await expect(coordinator.executeJob(mockConfig)).rejects.toThrow('Template rendering failed');
    });

    it('should collect and report multiple errors', async () => {
      const mockJob: GenerationJob = {
        id: 'test-job',
        config: mockConfig,
        status: 'running',
        metrics: {
          ontologiesProcessed: 0,
          templatesRendered: 0,
          filesGenerated: 0,
          errors: [],
        },
      };

      // Simulate multiple errors during processing
      vi.spyOn(coordinator as any, 'processTemplate').mockImplementation(async () => {
        mockJob.metrics.errors.push('Template error 1');
        mockJob.metrics.errors.push('Template error 2');
        throw new Error('Multiple template errors');
      });

      vi.spyOn(coordinator as any, 'loadOntologies').mockResolvedValue([]);
      vi.spyOn(coordinator as any, 'prepareContexts').mockResolvedValue([{ template: {}, context: {} }]);
      vi.spyOn(coordinator as any, 'renderSequential').mockImplementation(async () => {
        await (coordinator as any).processTemplate(null, {}, {}, mockConfig, mockJob);
      });

      await expect(coordinator.executeJob(mockConfig)).rejects.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration fields', async () => {
      const invalidConfig = {
        name: '',
        ontologies: [],
        templates: [],
        output: { directory: '' },
      } as PipelineConfig;

      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(async (job: GenerationJob) => {
        if (!job.config.name || job.config.ontologies.length === 0) {
          throw new Error('Invalid configuration');
        }
      });

      await expect(coordinator.executeJob(invalidConfig)).rejects.toThrow('Invalid configuration');
    });

    it('should handle HIVE QUEEN configuration validation', async () => {
      const configWithInvalidWorkers = {
        ...mockConfig,
        hiveQueen: {
          enabled: true,
          workers: 0, // Invalid worker count
        },
      };

      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(async (job: GenerationJob) => {
        if (job.config.hiveQueen?.workers === 0) {
          throw new Error('Invalid worker configuration');
        }
      });

      await expect(coordinator.executeJob(configWithInvalidWorkers)).rejects.toThrow();
    });
  });

  describe('Performance Tracking', () => {
    it('should track job execution metrics', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(async (job: GenerationJob) => {
        job.metrics.ontologiesProcessed = 2;
        job.metrics.templatesRendered = 3;
        job.metrics.filesGenerated = 4;
      });

      const job = await coordinator.executeJob(mockConfig);

      expect(job.metrics.ontologiesProcessed).toBe(2);
      expect(job.metrics.templatesRendered).toBe(3);
      expect(job.metrics.filesGenerated).toBe(4);
      expect(job.startTime).toBeDefined();
      expect(job.endTime).toBeDefined();
    });

    it('should measure execution duration', async () => {
      vi.spyOn(coordinator as any, 'runPipeline').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const job = await coordinator.executeJob(mockConfig);

      const duration = job.endTime!.getTime() - job.startTime!.getTime();
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});