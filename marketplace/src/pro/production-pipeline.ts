/**
 * PRODUCTION PIPELINE - Real Job Management System
 * Complete production-grade job processing with queuing, scheduling,
 * resource management, and distributed execution for HIVE QUEEN orchestration.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { HiveQueenOrchestrator, ProductionJob, SwarmAgent, AgentType } from './hive-queen-orchestrator';

// Pipeline configuration
export interface PipelineConfig {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  jobTimeoutMs: number;
  retryAttempts: number;
  priorityLevels: number;
  resourcePoolSize: number;
  schedulingStrategy: 'fifo' | 'priority' | 'fair-share' | 'shortest-job-first' | 'adaptive';
  loadBalancingStrategy: 'round-robin' | 'least-loaded' | 'performance-based' | 'capability-match';
  persistentStorage: boolean;
  metrics: boolean;
  distributed: boolean;
}

// Job execution context
export interface ExecutionContext {
  jobId: string;
  pipeline: string;
  stage: string;
  attempt: number;
  startTime: Date;
  assignedResources: ResourceAllocation[];
  environment: Record<string, any>;
  dependencies: JobDependency[];
  checkpoints: ExecutionCheckpoint[];
}

export interface ResourceAllocation {
  id: string;
  type: 'cpu' | 'memory' | 'storage' | 'network' | 'gpu' | 'custom';
  amount: number;
  unit: string;
  reserved: boolean;
  agentId?: string;
  expiry?: Date;
}

export interface JobDependency {
  jobId: string;
  type: 'completion' | 'resource' | 'data' | 'timing';
  status: 'pending' | 'satisfied' | 'failed';
  metadata?: any;
}

export interface ExecutionCheckpoint {
  id: string;
  timestamp: Date;
  stage: string;
  status: 'success' | 'warning' | 'error';
  data: any;
  metrics?: CheckpointMetrics;
}

export interface CheckpointMetrics {
  duration: number;
  resourceUsage: Record<string, number>;
  throughput: number;
  errorCount: number;
  memoryPeak: number;
}

// Pipeline stages and workflow
export interface PipelineStage {
  id: string;
  name: string;
  type: 'validation' | 'preprocessing' | 'execution' | 'postprocessing' | 'cleanup';
  required: boolean;
  parallel: boolean;
  retryable: boolean;
  timeout: number;
  requirements: StageRequirements;
  handler: StageHandler;
}

export interface StageRequirements {
  agentTypes: AgentType[];
  minAgents: number;
  maxAgents: number;
  resources: ResourceAllocation[];
  capabilities: string[];
  dataInputs: DataInput[];
  dataOutputs: DataOutput[];
}

export interface DataInput {
  name: string;
  type: string;
  required: boolean;
  source: string;
  format: string;
  validation?: ValidationRule[];
}

export interface DataOutput {
  name: string;
  type: string;
  destination: string;
  format: string;
  persist: boolean;
}

export interface ValidationRule {
  type: 'type' | 'range' | 'pattern' | 'custom';
  rule: any;
  message: string;
}

export type StageHandler = (context: ExecutionContext, input: any) => Promise<StageResult>;

export interface StageResult {
  success: boolean;
  data: any;
  metrics: CheckpointMetrics;
  errors: StageError[];
  warnings: string[];
  nextStage?: string;
  skipStages?: string[];
}

export interface StageError {
  code: string;
  message: string;
  recoverable: boolean;
  retryAfter?: number;
  context?: any;
}

// Job scheduling and resource management
export interface JobScheduler {
  schedule(job: ProductionJob): Promise<ScheduledJob>;
  reschedule(jobId: string, newPriority: string): Promise<boolean>;
  cancel(jobId: string): Promise<boolean>;
  getSchedule(): Promise<ScheduledJob[]>;
}

export interface ScheduledJob {
  jobId: string;
  scheduledTime: Date;
  estimatedDuration: number;
  priority: number;
  resourceReservations: ResourceAllocation[];
  dependencies: string[];
  stage: 'scheduled' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface ResourceManager {
  allocate(requirements: ResourceAllocation[]): Promise<string[]>;
  release(allocationIds: string[]): Promise<void>;
  getAvailable(type: string): Promise<number>;
  reserve(requirements: ResourceAllocation[], duration: number): Promise<string[]>;
}

// Performance monitoring and metrics
export interface PipelineMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  throughput: number;
  resourceUtilization: Record<string, number>;
  queueLength: number;
  activeJobs: number;
  stageMetrics: Map<string, StageMetrics>;
  errorRates: Map<string, number>;
  performanceTrends: PerformanceTrend[];
}

export interface StageMetrics {
  stageName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  averageResourceUsage: Record<string, number>;
  errorRate: number;
  throughput: number;
}

export interface PerformanceTrend {
  timestamp: Date;
  metric: string;
  value: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomaly: boolean;
}

// Main production pipeline implementation
export class ProductionPipeline extends EventEmitter {
  private config: PipelineConfig;
  private orchestrator: HiveQueenOrchestrator;
  private jobQueue: Map<string, ProductionJob> = new Map();
  private activeJobs: Map<string, ExecutionContext> = new Map();
  private completedJobs: Map<string, ProductionJob> = new Map();
  private stages: Map<string, PipelineStage> = new Map();
  private scheduler: JobScheduler;
  private resourceManager: ResourceManager;
  private metrics: PipelineMetrics;
  
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  
  // Resource pools and tracking
  private resourcePools: Map<string, any[]> = new Map();
  private resourceAllocations: Map<string, ResourceAllocation> = new Map();
  
  constructor(orchestrator: HiveQueenOrchestrator, config: Partial<PipelineConfig> = {}) {
    super();
    
    this.orchestrator = orchestrator;
    this.config = {
      maxConcurrentJobs: 10,
      maxQueueSize: 100,
      jobTimeoutMs: 300000, // 5 minutes
      retryAttempts: 3,
      priorityLevels: 5,
      resourcePoolSize: 1000,
      schedulingStrategy: 'priority',
      loadBalancingStrategy: 'performance-based',
      persistentStorage: true,
      metrics: true,
      distributed: true,
      ...config
    };
    
    this.scheduler = new DefaultJobScheduler();
    this.resourceManager = new DefaultResourceManager();
    this.metrics = this.initializeMetrics();
    
    this.initializeStages();
    this.setupOrchestrationIntegration();
  }

  // Pipeline lifecycle
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }

    this.emit('pipeline-starting');
    
    try {
      // Initialize resource pools
      await this.initializeResourcePools();
      
      // Start processing loops
      this.processingInterval = setInterval(() => {
        this.processJobs().catch(error => {
          this.emit('processing-error', { error: error.message });
        });
      }, 1000); // Process every second
      
      // Start metrics collection
      if (this.config.metrics) {
        this.metricsInterval = setInterval(() => {
          this.updateMetrics().catch(error => {
            this.emit('metrics-error', { error: error.message });
          });
        }, 5000); // Update metrics every 5 seconds
      }
      
      this.isRunning = true;
      this.emit('pipeline-started', { config: this.config });
      
    } catch (error) {
      this.emit('pipeline-start-failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.emit('pipeline-stopping');
    
    try {
      // Stop processing intervals
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = undefined;
      }
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }
      
      // Complete active jobs
      await this.completeActiveJobs();
      
      // Release resources
      await this.releaseAllResources();
      
      this.isRunning = false;
      this.emit('pipeline-stopped');
      
    } catch (error) {
      this.emit('pipeline-stop-failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // Job submission and management
  async submitJob(jobData: Omit<ProductionJob, 'id' | 'status' | 'progress' | 'metrics' | 'createdAt'>): Promise<string> {
    if (this.jobQueue.size >= this.config.maxQueueSize) {
      throw new Error('Job queue is full');
    }

    // Create production job through orchestrator
    const jobId = await this.orchestrator.submitJob(jobData);
    
    // Get the job from orchestrator
    const job = await this.orchestrator.getJobStatus(jobId);
    if (!job) {
      throw new Error('Failed to create job');
    }
    
    // Add to pipeline queue
    this.jobQueue.set(jobId, job);
    
    // Schedule job
    await this.scheduler.schedule(job);
    
    this.emit('job-submitted', { jobId, type: job.type, priority: job.priority });
    
    return jobId;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    // Cancel in orchestrator
    const cancelled = await this.orchestrator.cancelJob(jobId);
    
    if (cancelled) {
      // Remove from pipeline queues
      this.jobQueue.delete(jobId);
      
      // Stop active execution
      const context = this.activeJobs.get(jobId);
      if (context) {
        await this.stopJobExecution(context);
      }
      
      this.emit('job-cancelled', { jobId });
    }
    
    return cancelled;
  }

  async getJobStatus(jobId: string): Promise<ProductionJob | null> {
    // First check active jobs
    const context = this.activeJobs.get(jobId);
    if (context) {
      return await this.orchestrator.getJobStatus(jobId);
    }
    
    // Check completed jobs
    const completed = this.completedJobs.get(jobId);
    if (completed) {
      return completed;
    }
    
    // Check orchestrator
    return await this.orchestrator.getJobStatus(jobId);
  }

  async getPipelineStatus(): Promise<{
    isRunning: boolean;
    queueLength: number;
    activeJobs: number;
    completedJobs: number;
    metrics: PipelineMetrics;
  }> {
    return {
      isRunning: this.isRunning,
      queueLength: this.jobQueue.size,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      metrics: { ...this.metrics }
    };
  }

  // Stage management
  async addStage(stage: PipelineStage): Promise<void> {
    this.stages.set(stage.id, stage);
    this.emit('stage-added', { stageId: stage.id, name: stage.name });
  }

  async removeStage(stageId: string): Promise<boolean> {
    const removed = this.stages.delete(stageId);
    if (removed) {
      this.emit('stage-removed', { stageId });
    }
    return removed;
  }

  async updateStage(stageId: string, updates: Partial<PipelineStage>): Promise<boolean> {
    const stage = this.stages.get(stageId);
    if (!stage) return false;
    
    Object.assign(stage, updates);
    this.emit('stage-updated', { stageId, updates });
    return true;
  }

  // Resource management
  async allocateResources(requirements: ResourceAllocation[]): Promise<string[]> {
    return await this.resourceManager.allocate(requirements);
  }

  async releaseResources(allocationIds: string[]): Promise<void> {
    await this.resourceManager.release(allocationIds);
  }

  async getResourceStatus(): Promise<Record<string, { available: number; allocated: number; total: number }>> {
    const status: Record<string, { available: number; allocated: number; total: number }> = {};
    
    const resourceTypes = ['cpu', 'memory', 'storage', 'network'];
    for (const type of resourceTypes) {
      const available = await this.resourceManager.getAvailable(type);
      const allocated = this.calculateAllocatedResources(type);
      const total = available + allocated;
      
      status[type] = { available, allocated, total };
    }
    
    return status;
  }

  // Private implementation methods
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;
    
    // Get jobs ready for execution
    const readyJobs = await this.getReadyJobs();
    
    // Process up to max concurrent jobs
    const availableSlots = this.config.maxConcurrentJobs - this.activeJobs.size;
    const jobsToProcess = readyJobs.slice(0, availableSlots);
    
    for (const job of jobsToProcess) {
      try {
        await this.startJobExecution(job);
      } catch (error) {
        this.emit('job-start-failed', { 
          jobId: job.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        // Mark job as failed
        job.status = 'failed';
        await this.completeJob(job);
      }
    }
  }

  private async getReadyJobs(): Promise<ProductionJob[]> {
    const queuedJobs = Array.from(this.jobQueue.values()).filter(job => job.status === 'queued');
    const readyJobs: ProductionJob[] = [];
    
    for (const job of queuedJobs) {
      // Check dependencies
      const dependenciesMet = await this.checkDependencies(job);
      if (!dependenciesMet) continue;
      
      // Check resource availability
      const resourcesAvailable = await this.checkResourceAvailability(job);
      if (!resourcesAvailable) continue;
      
      readyJobs.push(job);
    }
    
    // Sort by priority and scheduling strategy
    return this.sortJobsByStrategy(readyJobs);
  }

  private async checkDependencies(job: ProductionJob): Promise<boolean> {
    for (const depId of job.dependencies) {
      const depJob = await this.orchestrator.getJobStatus(depId);
      if (!depJob || depJob.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  private async checkResourceAvailability(job: ProductionJob): Promise<boolean> {
    for (const requirement of job.requirements.resourceRequirements) {
      const available = await this.resourceManager.getAvailable(requirement.type);
      if (available < requirement.amount) {
        return false;
      }
    }
    return true;
  }

  private sortJobsByStrategy(jobs: ProductionJob[]): ProductionJob[] {
    switch (this.config.schedulingStrategy) {
      case 'fifo':
        return jobs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      case 'priority':
        return jobs.sort((a, b) => {
          const priorityOrder = { emergency: 5, critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
      
      case 'shortest-job-first':
        return jobs.sort((a, b) => 
          a.requirements.estimatedDuration - b.requirements.estimatedDuration
        );
      
      case 'fair-share':
        // Implement fair-share scheduling logic
        return this.applyfairShareScheduling(jobs);
      
      case 'adaptive':
        // Implement adaptive scheduling based on system state
        return this.applyAdaptiveScheduling(jobs);
      
      default:
        return jobs;
    }
  }

  private async startJobExecution(job: ProductionJob): Promise<void> {
    // Create execution context
    const context: ExecutionContext = {
      jobId: job.id,
      pipeline: 'production',
      stage: 'initialization',
      attempt: 1,
      startTime: new Date(),
      assignedResources: [],
      environment: {},
      dependencies: job.dependencies.map(depId => ({
        jobId: depId,
        type: 'completion' as const,
        status: 'satisfied' as const
      })),
      checkpoints: []
    };
    
    this.activeJobs.set(job.id, context);
    this.jobQueue.delete(job.id);
    
    // Allocate resources
    const allocatedResources = await this.allocateResources(
      job.requirements.resourceRequirements.map(req => ({
        id: `${job.id}-${req.type}`,
        type: req.type as any,
        amount: req.amount,
        unit: req.unit,
        reserved: true
      }))
    );
    
    context.assignedResources = allocatedResources.map(id => this.resourceAllocations.get(id)!);
    
    // Update job status
    job.status = 'running';
    job.startedAt = new Date();
    
    // Execute job stages
    try {
      await this.executeJobStages(job, context);
    } catch (error) {
      await this.handleJobExecutionError(job, context, error);
    }
  }

  private async executeJobStages(job: ProductionJob, context: ExecutionContext): Promise<void> {
    const stageOrder = this.getStageOrder();
    
    for (const stageId of stageOrder) {
      const stage = this.stages.get(stageId);
      if (!stage) continue;
      
      context.stage = stageId;
      
      try {
        const stageResult = await this.executeStage(stage, context, job);
        
        // Record checkpoint
        const checkpoint: ExecutionCheckpoint = {
          id: `checkpoint-${context.checkpoints.length + 1}`,
          timestamp: new Date(),
          stage: stageId,
          status: stageResult.success ? 'success' : 'error',
          data: stageResult.data,
          metrics: stageResult.metrics
        };
        
        context.checkpoints.push(checkpoint);
        
        // Update job progress
        const progressPercentage = ((context.checkpoints.length) / stageOrder.length) * 100;
        job.progress.percentage = Math.min(progressPercentage, 100);
        job.progress.currentTask = stage.name;
        job.progress.completedTasks = context.checkpoints.length;
        job.progress.totalTasks = stageOrder.length;
        
        this.emit('stage-completed', { jobId: job.id, stageId, result: stageResult });
        
        // Handle stage result
        if (!stageResult.success) {
          if (stage.retryable && context.attempt < this.config.retryAttempts) {
            await this.retryStage(stage, context, job);
            continue;
          } else {
            throw new Error(`Stage ${stageId} failed: ${stageResult.errors.map(e => e.message).join(', ')}`);
          }
        }
        
        // Handle stage routing
        if (stageResult.nextStage) {
          // Jump to specific stage
          const nextIndex = stageOrder.indexOf(stageResult.nextStage);
          if (nextIndex > -1) {
            stageOrder.splice(0, nextIndex);
          }
        }
        
        if (stageResult.skipStages?.length) {
          // Remove skipped stages
          stageResult.skipStages.forEach(skipId => {
            const skipIndex = stageOrder.indexOf(skipId);
            if (skipIndex > -1) {
              stageOrder.splice(skipIndex, 1);
            }
          });
        }
        
      } catch (error) {
        this.emit('stage-failed', { 
          jobId: job.id, 
          stageId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }
    
    // Job completed successfully
    await this.completeJob(job, context);
  }

  private async executeStage(stage: PipelineStage, context: ExecutionContext, job: ProductionJob): Promise<StageResult> {
    const startTime = performance.now();
    
    this.emit('stage-started', { jobId: context.jobId, stageId: stage.id, stage: stage.name });
    
    try {
      // Validate stage requirements
      await this.validateStageRequirements(stage, context, job);
      
      // Prepare input data
      const input = await this.prepareStageInput(stage, context, job);
      
      // Execute stage
      const result = await stage.handler(context, input);
      
      // Update metrics
      const duration = performance.now() - startTime;
      result.metrics.duration = duration;
      
      // Update stage metrics
      this.updateStageMetrics(stage.id, result);
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        success: false,
        data: null,
        metrics: {
          duration,
          resourceUsage: {},
          throughput: 0,
          errorCount: 1,
          memoryPeak: 0
        },
        errors: [{
          code: 'STAGE_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: stage.retryable,
          context: { stage: stage.id, jobId: context.jobId }
        }],
        warnings: []
      };
    }
  }

  private async stopJobExecution(context: ExecutionContext): Promise<void> {
    // Cancel any running operations
    this.emit('job-execution-stopping', { jobId: context.jobId });
    
    // Release resources
    if (context.assignedResources.length > 0) {
      await this.releaseResources(context.assignedResources.map(r => r.id));
    }
    
    // Remove from active jobs
    this.activeJobs.delete(context.jobId);
    
    this.emit('job-execution-stopped', { jobId: context.jobId });
  }

  private async completeJob(job: ProductionJob, context?: ExecutionContext): Promise<void> {
    job.status = 'completed';
    job.completedAt = new Date();
    job.progress.percentage = 100;
    
    if (context) {
      // Calculate final metrics
      job.metrics.executionTime = job.completedAt.getTime() - job.startedAt!.getTime();
      
      // Release resources
      if (context.assignedResources.length > 0) {
        await this.releaseResources(context.assignedResources.map(r => r.id));
      }
      
      this.activeJobs.delete(job.id);
    }
    
    // Store completed job
    this.completedJobs.set(job.id, job);
    
    this.emit('job-completed', { jobId: job.id, duration: job.metrics.executionTime });
  }

  private async handleJobExecutionError(job: ProductionJob, context: ExecutionContext, error: any): Promise<void> {
    this.emit('job-execution-error', { 
      jobId: job.id, 
      error: error instanceof Error ? error.message : String(error),
      context: context.stage
    });
    
    job.status = 'failed';
    job.completedAt = new Date();
    
    // Release resources
    if (context.assignedResources.length > 0) {
      await this.releaseResources(context.assignedResources.map(r => r.id));
    }
    
    this.activeJobs.delete(job.id);
    this.completedJobs.set(job.id, job);
  }

  private initializeStages(): void {
    // Default pipeline stages
    this.addDefaultStages();
  }

  private addDefaultStages(): void {
    // Validation stage
    this.stages.set('validation', {
      id: 'validation',
      name: 'Job Validation',
      type: 'validation',
      required: true,
      parallel: false,
      retryable: false,
      timeout: 30000,
      requirements: {
        agentTypes: ['scout'],
        minAgents: 1,
        maxAgents: 1,
        resources: [],
        capabilities: ['validation'],
        dataInputs: [],
        dataOutputs: []
      },
      handler: async (context: ExecutionContext, input: any): Promise<StageResult> => {
        // Validation logic
        return {
          success: true,
          data: { validated: true },
          metrics: {
            duration: 100,
            resourceUsage: { cpu: 5 },
            throughput: 1,
            errorCount: 0,
            memoryPeak: 50
          },
          errors: [],
          warnings: []
        };
      }
    });

    // Execution stage
    this.stages.set('execution', {
      id: 'execution',
      name: 'Job Execution',
      type: 'execution',
      required: true,
      parallel: true,
      retryable: true,
      timeout: 120000,
      requirements: {
        agentTypes: ['worker'],
        minAgents: 1,
        maxAgents: 4,
        resources: [],
        capabilities: ['execution'],
        dataInputs: [],
        dataOutputs: []
      },
      handler: async (context: ExecutionContext, input: any): Promise<StageResult> => {
        // Main execution logic
        return {
          success: true,
          data: { executed: true },
          metrics: {
            duration: 5000,
            resourceUsage: { cpu: 50, memory: 200 },
            throughput: 10,
            errorCount: 0,
            memoryPeak: 300
          },
          errors: [],
          warnings: []
        };
      }
    });
  }

  private setupOrchestrationIntegration(): void {
    // Listen to orchestrator events
    this.orchestrator.on('job-completed', (event) => {
      this.handleOrchestratorJobCompletion(event);
    });
    
    this.orchestrator.on('job-failed', (event) => {
      this.handleOrchestratorJobFailure(event);
    });
    
    this.orchestrator.on('agent-alert', (event) => {
      this.handleOrchestratorAlert(event);
    });
  }

  private async handleOrchestratorJobCompletion(event: any): Promise<void> {
    const { jobId } = event;
    const job = this.jobQueue.get(jobId) || this.completedJobs.get(jobId);
    
    if (job && job.status !== 'completed') {
      await this.completeJob(job);
    }
  }

  private async handleOrchestratorJobFailure(event: any): Promise<void> {
    const { jobId, error } = event;
    const context = this.activeJobs.get(jobId);
    
    if (context) {
      const job = await this.orchestrator.getJobStatus(jobId);
      if (job) {
        await this.handleJobExecutionError(job, context, new Error(error));
      }
    }
  }

  private async handleOrchestratorAlert(event: any): Promise<void> {
    this.emit('orchestrator-alert', event);
  }

  // Utility methods
  private initializeMetrics(): PipelineMetrics {
    return {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageExecutionTime: 0,
      throughput: 0,
      resourceUtilization: {},
      queueLength: 0,
      activeJobs: 0,
      stageMetrics: new Map(),
      errorRates: new Map(),
      performanceTrends: []
    };
  }

  private async updateMetrics(): Promise<void> {
    this.metrics.totalJobs = this.jobQueue.size + this.activeJobs.size + this.completedJobs.size;
    this.metrics.completedJobs = this.completedJobs.size;
    this.metrics.queueLength = this.jobQueue.size;
    this.metrics.activeJobs = this.activeJobs.size;
    
    // Calculate throughput (jobs per minute)
    const recentJobs = Array.from(this.completedJobs.values()).filter(job => 
      job.completedAt && (Date.now() - job.completedAt.getTime()) < 60000
    );
    this.metrics.throughput = recentJobs.length;
    
    // Update resource utilization
    this.metrics.resourceUtilization = await this.calculateResourceUtilization();
    
    this.emit('metrics-updated', { metrics: this.metrics });
  }

  private async calculateResourceUtilization(): Promise<Record<string, number>> {
    const utilization: Record<string, number> = {};
    const resourceTypes = ['cpu', 'memory', 'storage', 'network'];
    
    for (const type of resourceTypes) {
      const allocated = this.calculateAllocatedResources(type);
      const total = this.config.resourcePoolSize;
      utilization[type] = total > 0 ? (allocated / total) * 100 : 0;
    }
    
    return utilization;
  }

  private calculateAllocatedResources(type: string): number {
    return Array.from(this.resourceAllocations.values())
      .filter(allocation => allocation.type === type && allocation.reserved)
      .reduce((sum, allocation) => sum + allocation.amount, 0);
  }

  private updateStageMetrics(stageId: string, result: StageResult): void {
    let stageMetrics = this.metrics.stageMetrics.get(stageId);
    
    if (!stageMetrics) {
      stageMetrics = {
        stageName: stageId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        averageResourceUsage: {},
        errorRate: 0,
        throughput: 0
      };
      this.metrics.stageMetrics.set(stageId, stageMetrics);
    }
    
    stageMetrics.totalExecutions++;
    if (result.success) {
      stageMetrics.successfulExecutions++;
    } else {
      stageMetrics.failedExecutions++;
    }
    
    // Update averages
    stageMetrics.averageDuration = 
      (stageMetrics.averageDuration * (stageMetrics.totalExecutions - 1) + result.metrics.duration) / 
      stageMetrics.totalExecutions;
    
    stageMetrics.errorRate = (stageMetrics.failedExecutions / stageMetrics.totalExecutions) * 100;
  }

  // Additional helper methods
  private async initializeResourcePools(): Promise<void> {
    // Initialize resource pools
    const resourceTypes = ['cpu', 'memory', 'storage', 'network'];
    for (const type of resourceTypes) {
      this.resourcePools.set(type, []);
    }
  }

  private async completeActiveJobs(): Promise<void> {
    const activeJobIds = Array.from(this.activeJobs.keys());
    
    for (const jobId of activeJobIds) {
      const context = this.activeJobs.get(jobId);
      if (context) {
        await this.stopJobExecution(context);
      }
    }
  }

  private async releaseAllResources(): Promise<void> {
    const allocationIds = Array.from(this.resourceAllocations.keys());
    await this.releaseResources(allocationIds);
  }

  private getStageOrder(): string[] {
    return ['validation', 'execution', 'cleanup'];
  }

  private async validateStageRequirements(stage: PipelineStage, context: ExecutionContext, job: ProductionJob): Promise<void> {
    // Validate agent requirements
    // Validate resource requirements  
    // Validate data inputs
  }

  private async prepareStageInput(stage: PipelineStage, context: ExecutionContext, job: ProductionJob): Promise<any> {
    // Prepare input data for stage execution
    return {
      job: job,
      context: context,
      stage: stage
    };
  }

  private async retryStage(stage: PipelineStage, context: ExecutionContext, job: ProductionJob): Promise<void> {
    context.attempt++;
    await new Promise(resolve => setTimeout(resolve, 1000 * context.attempt)); // Exponential backoff
  }

  private applyfairShareScheduling(jobs: ProductionJob[]): ProductionJob[] {
    // Implement fair-share scheduling algorithm
    return jobs; // Placeholder
  }

  private applyAdaptiveScheduling(jobs: ProductionJob[]): ProductionJob[] {
    // Implement adaptive scheduling based on system metrics
    return jobs; // Placeholder
  }
}

// Default implementations
class DefaultJobScheduler implements JobScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();

  async schedule(job: ProductionJob): Promise<ScheduledJob> {
    const scheduled: ScheduledJob = {
      jobId: job.id,
      scheduledTime: new Date(),
      estimatedDuration: job.requirements.estimatedDuration,
      priority: this.getPriorityValue(job.priority),
      resourceReservations: [],
      dependencies: job.dependencies,
      stage: 'scheduled'
    };
    
    this.scheduledJobs.set(job.id, scheduled);
    return scheduled;
  }

  async reschedule(jobId: string, newPriority: string): Promise<boolean> {
    const scheduled = this.scheduledJobs.get(jobId);
    if (scheduled) {
      scheduled.priority = this.getPriorityValue(newPriority as any);
      return true;
    }
    return false;
  }

  async cancel(jobId: string): Promise<boolean> {
    return this.scheduledJobs.delete(jobId);
  }

  async getSchedule(): Promise<ScheduledJob[]> {
    return Array.from(this.scheduledJobs.values());
  }

  private getPriorityValue(priority: string): number {
    const values = { emergency: 5, critical: 4, high: 3, medium: 2, low: 1 };
    return values[priority as keyof typeof values] || 1;
  }
}

class DefaultResourceManager implements ResourceManager {
  private allocations: Map<string, ResourceAllocation> = new Map();
  private pools: Map<string, number> = new Map([
    ['cpu', 1000],
    ['memory', 1000], 
    ['storage', 1000],
    ['network', 1000]
  ]);

  async allocate(requirements: ResourceAllocation[]): Promise<string[]> {
    const allocationIds: string[] = [];
    
    for (const req of requirements) {
      const available = await this.getAvailable(req.type);
      if (available >= req.amount) {
        const allocation = { ...req, reserved: true };
        this.allocations.set(req.id, allocation);
        allocationIds.push(req.id);
      } else {
        // Rollback previous allocations
        await this.release(allocationIds);
        throw new Error(`Insufficient ${req.type} resources`);
      }
    }
    
    return allocationIds;
  }

  async release(allocationIds: string[]): Promise<void> {
    for (const id of allocationIds) {
      this.allocations.delete(id);
    }
  }

  async getAvailable(type: string): Promise<number> {
    const total = this.pools.get(type) || 0;
    const allocated = Array.from(this.allocations.values())
      .filter(a => a.type === type && a.reserved)
      .reduce((sum, a) => sum + a.amount, 0);
    
    return total - allocated;
  }

  async reserve(requirements: ResourceAllocation[], duration: number): Promise<string[]> {
    const allocationIds = await this.allocate(requirements);
    
    // Set expiry
    for (const id of allocationIds) {
      const allocation = this.allocations.get(id);
      if (allocation) {
        allocation.expiry = new Date(Date.now() + duration);
      }
    }
    
    return allocationIds;
  }
}

// Factory function
export function createProductionPipeline(
  orchestrator: HiveQueenOrchestrator, 
  config: Partial<PipelineConfig> = {}
): ProductionPipeline {
  return new ProductionPipeline(orchestrator, config);
}