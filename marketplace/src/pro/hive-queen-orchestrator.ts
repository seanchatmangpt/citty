/**
 * HIVE QUEEN ORCHESTRATOR - Production-Grade Swarm Intelligence System
 * Complete hierarchical coordination with real job management, distributed consensus,
 * and multi-agent communication protocols for marketplace orchestration.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core orchestration interfaces
export interface HiveQueenConfig {
  maxWorkers: number;
  maxScouts: number;
  maxSoldiers: number;
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  consensusMechanism: 'raft' | 'byzantine' | 'gossip' | 'quorum';
  communicationProtocol: 'message-passing' | 'shared-memory' | 'event-driven';
  faultTolerance: boolean;
  selfHealing: boolean;
  realTimeMonitoring: boolean;
  jobQueueing: boolean;
  distributedExecution: boolean;
  resourcePooling: boolean;
}

export interface ProductionJob {
  id: string;
  type: 'marketplace-analysis' | 'stress-test' | 'environment-validation' | 'workflow-orchestration' | 'data-processing';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  payload: any;
  requirements: JobRequirements;
  dependencies: string[];
  deadline?: Date;
  retryPolicy: RetryPolicy;
  status: 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedAgents: string[];
  progress: JobProgress;
  metrics: JobMetrics;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobRequirements {
  agentTypes: AgentType[];
  minAgentCount: number;
  maxAgentCount: number;
  resourceRequirements: ResourceRequirement[];
  capabilities: string[];
  exclusiveExecution: boolean;
  parallelizable: boolean;
  estimatedDuration: number;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryConditions: string[];
}

export interface JobProgress {
  stage: string;
  percentage: number;
  currentTask: string;
  completedTasks: number;
  totalTasks: number;
  estimatedTimeRemaining: number;
  checkpoints: ProgressCheckpoint[];
}

export interface ProgressCheckpoint {
  timestamp: number;
  stage: string;
  percentage: number;
  message: string;
  data?: any;
}

export interface JobMetrics {
  executionTime: number;
  resourceUsage: ResourceUsage;
  agentUtilization: AgentUtilization[];
  throughput: number;
  errorRate: number;
  qualityScore: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  peak: ResourceUsage;
  average: ResourceUsage;
}

export interface AgentUtilization {
  agentId: string;
  agentType: AgentType;
  utilizationPercentage: number;
  tasksCompleted: number;
  errorCount: number;
  averageTaskTime: number;
}

// Agent system interfaces
export type AgentType = 'queen' | 'worker' | 'scout' | 'soldier';

export interface SwarmAgent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  currentLoad: number;
  maxLoad: number;
  performance: AgentPerformance;
  currentJobs: string[];
  lastHeartbeat: Date;
  metadata: AgentMetadata;
}

export type AgentStatus = 'idle' | 'busy' | 'overloaded' | 'failed' | 'healing' | 'offline';

export interface AgentPerformance {
  successRate: number;
  averageExecutionTime: number;
  throughput: number;
  resourceEfficiency: number;
  jobsCompleted: number;
  jobsFailed: number;
  uptime: number;
  lastReset: Date;
}

export interface AgentMetadata {
  version: string;
  specializations: string[];
  location: string;
  resources: ResourceCapacity;
  configuration: Record<string, any>;
}

export interface ResourceCapacity {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface ResourceRequirement {
  type: 'cpu' | 'memory' | 'disk' | 'network';
  amount: number;
  unit: string;
  critical: boolean;
}

// Communication and coordination interfaces
export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  payload: any;
  timestamp: Date;
  priority: MessagePriority;
  acknowledgmentRequired: boolean;
  ttl?: number;
}

export type MessageType = 
  'job-assignment' | 'job-update' | 'job-completion' | 'job-failure' |
  'heartbeat' | 'resource-update' | 'consensus-proposal' | 'consensus-vote' |
  'coordination-sync' | 'alert' | 'command' | 'query' | 'response';

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';

export interface ConsensusProposal {
  id: string;
  proposer: string;
  type: 'resource-allocation' | 'job-assignment' | 'topology-change' | 'policy-update';
  proposal: any;
  votingDeadline: Date;
  requiredVotes: number;
  currentVotes: ConsensusVote[];
  status: 'proposed' | 'voting' | 'accepted' | 'rejected' | 'expired';
}

export interface ConsensusVote {
  agentId: string;
  vote: 'accept' | 'reject' | 'abstain';
  reasoning?: string;
  timestamp: Date;
}

// Monitoring and metrics interfaces
export interface SwarmMetrics {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  overloadedAgents: number;
  failedAgents: number;
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageJobTime: number;
  systemThroughput: number;
  resourceUtilization: ResourceUtilization;
  swarmEfficiency: number;
  communicationLatency: number;
  consensusTime: number;
  faultTolerance: number;
  uptime: number;
}

export interface ResourceUtilization {
  cpu: UtilizationMetric;
  memory: UtilizationMetric;
  disk: UtilizationMetric;
  network: UtilizationMetric;
}

export interface UtilizationMetric {
  current: number;
  average: number;
  peak: number;
  efficiency: number;
  bottlenecks: string[];
}

// File watching and change detection
export interface FileWatchConfig {
  paths: string[];
  patterns: string[];
  ignorePatterns: string[];
  recursive: boolean;
  debounceMs: number;
  batchChanges: boolean;
}

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  timestamp: Date;
  size?: number;
  metadata?: any;
}

export interface ChangeEvent {
  id: string;
  changes: FileChange[];
  timestamp: Date;
  triggerJob?: boolean;
  jobTemplate?: Partial<ProductionJob>;
}

// Main orchestrator implementation
export class HiveQueenOrchestrator extends EventEmitter {
  private config: HiveQueenConfig;
  private agents: Map<string, SwarmAgent> = new Map();
  private jobs: Map<string, ProductionJob> = new Map();
  private jobQueue: ProductionJob[] = [];
  private messageQueue: AgentMessage[] = [];
  private consensusProposals: Map<string, ConsensusProposal> = new Map();
  
  private metrics: SwarmMetrics;
  private isRunning: boolean = false;
  private coordinationInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  
  // Communication system
  private messageHandlers: Map<MessageType, (message: AgentMessage) => Promise<void>> = new Map();
  private pendingAcks: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  
  // File watching system
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private fileWatchConfig?: FileWatchConfig;
  
  // Resource pools
  private resourcePools: Map<string, any> = new Map();
  
  constructor(config: HiveQueenConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.initializeMessageHandlers();
  }

  // Core orchestration methods
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('HIVE QUEEN is already running');
    }

    this.emit('orchestrator-starting', { config: this.config });
    
    try {
      // Initialize swarm topology
      await this.initializeSwarm();
      
      // Start coordination systems
      await this.startCommunicationSystem();
      await this.startConsensusSystem();
      await this.startJobProcessing();
      await this.startMonitoring();
      
      // Initialize file watching if configured
      if (this.fileWatchConfig) {
        await this.startFileWatching();
      }
      
      this.isRunning = true;
      this.emit('orchestrator-started', { 
        totalAgents: this.agents.size,
        topology: this.config.topology,
        consensus: this.config.consensusMechanism
      });
      
    } catch (error) {
      this.emit('orchestrator-start-failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.emit('orchestrator-stopping');
    
    try {
      // Stop all intervals
      if (this.coordinationInterval) clearInterval(this.coordinationInterval);
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      
      // Stop file watching
      await this.stopFileWatching();
      
      // Complete running jobs
      await this.completeRunningJobs();
      
      // Shutdown agents
      await this.shutdownAgents();
      
      this.isRunning = false;
      this.emit('orchestrator-stopped');
      
    } catch (error) {
      this.emit('orchestrator-stop-failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // Job management
  async submitJob(jobData: Omit<ProductionJob, 'id' | 'status' | 'progress' | 'metrics' | 'createdAt'>): Promise<string> {
    const job: ProductionJob = {
      ...jobData,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      status: 'queued',
      progress: {
        stage: 'queued',
        percentage: 0,
        currentTask: 'Waiting for assignment',
        completedTasks: 0,
        totalTasks: 1,
        estimatedTimeRemaining: jobData.requirements.estimatedDuration,
        checkpoints: []
      },
      metrics: {
        executionTime: 0,
        resourceUsage: this.createEmptyResourceUsage(),
        agentUtilization: [],
        throughput: 0,
        errorRate: 0,
        qualityScore: 0
      },
      createdAt: new Date()
    };

    this.jobs.set(job.id, job);
    
    // Insert job into queue based on priority
    this.insertJobIntoQueue(job);
    
    this.emit('job-submitted', { jobId: job.id, type: job.type, priority: job.priority });
    
    return job.id;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'running') {
      // Send cancellation messages to assigned agents
      for (const agentId of job.assignedAgents) {
        await this.sendMessage({
          id: `cancel-${Date.now()}`,
          from: 'queen-001',
          to: agentId,
          type: 'command',
          payload: { command: 'cancel-job', jobId },
          timestamp: new Date(),
          priority: 'urgent',
          acknowledgmentRequired: true
        });
      }
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    
    // Remove from queue if still queued
    this.jobQueue = this.jobQueue.filter(j => j.id !== jobId);
    
    this.emit('job-cancelled', { jobId });
    return true;
  }

  async getJobStatus(jobId: string): Promise<ProductionJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getQueueStatus(): Promise<{ queued: number; running: number; completed: number; failed: number }> {
    const queued = Array.from(this.jobs.values()).filter(j => j.status === 'queued').length;
    const running = Array.from(this.jobs.values()).filter(j => j.status === 'running').length;
    const completed = Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
    const failed = Array.from(this.jobs.values()).filter(j => j.status === 'failed').length;
    
    return { queued, running, completed, failed };
  }

  // Agent management
  async spawnAgent(type: AgentType, config?: Partial<AgentMetadata>): Promise<string> {
    const agentId = `${type}-${String(this.getAgentCount(type)).padStart(3, '0')}`;
    
    const agent: SwarmAgent = {
      id: agentId,
      type,
      status: 'idle',
      capabilities: this.getDefaultCapabilities(type),
      currentLoad: 0,
      maxLoad: this.getMaxLoad(type),
      performance: this.initializeAgentPerformance(),
      currentJobs: [],
      lastHeartbeat: new Date(),
      metadata: {
        version: '1.0.0',
        specializations: [],
        location: os.hostname(),
        resources: this.getDefaultResourceCapacity(type),
        configuration: {},
        ...config
      }
    };

    this.agents.set(agentId, agent);
    
    // Start agent worker if needed
    if (this.config.distributedExecution) {
      await this.startAgentWorker(agent);
    }
    
    this.emit('agent-spawned', { agentId, type, capabilities: agent.capabilities });
    
    return agentId;
  }

  async removeAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Reassign current jobs
    for (const jobId of agent.currentJobs) {
      await this.reassignJob(jobId);
    }

    // Stop agent worker
    if (this.config.distributedExecution) {
      await this.stopAgentWorker(agent);
    }

    this.agents.delete(agentId);
    this.emit('agent-removed', { agentId });
    
    return true;
  }

  // Communication system
  async sendMessage(message: AgentMessage): Promise<boolean> {
    try {
      // Validate message
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message format');
      }

      // Add to message queue
      this.messageQueue.push(message);
      
      // Process message immediately if not acknowledgment required
      if (!message.acknowledgmentRequired) {
        await this.processMessage(message);
        return true;
      }

      // Wait for acknowledgment
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingAcks.delete(message.id);
          reject(new Error('Message acknowledgment timeout'));
        }, 30000); // 30 second timeout

        this.pendingAcks.set(message.id, { resolve, reject, timeout });
        this.processMessage(message).catch(reject);
      });

    } catch (error) {
      this.emit('message-send-failed', { 
        messageId: message.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  async broadcastMessage(message: Omit<AgentMessage, 'to'>): Promise<number> {
    const allAgents = Array.from(this.agents.keys()).filter(id => id !== message.from);
    let successCount = 0;

    for (const agentId of allAgents) {
      const success = await this.sendMessage({
        ...message,
        to: agentId,
        id: `${message.id}-${agentId}`
      });
      if (success) successCount++;
    }

    return successCount;
  }

  // Consensus system
  async proposeConsensus(proposal: Omit<ConsensusProposal, 'id' | 'currentVotes' | 'status'>): Promise<string> {
    const consensusId = `consensus-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const consensusProposal: ConsensusProposal = {
      ...proposal,
      id: consensusId,
      currentVotes: [],
      status: 'proposed'
    };

    this.consensusProposals.set(consensusId, consensusProposal);

    // Broadcast proposal to eligible agents
    const eligibleAgents = this.getEligibleVoters(proposal.type);
    for (const agentId of eligibleAgents) {
      await this.sendMessage({
        id: `consensus-${consensusId}-${agentId}`,
        from: 'queen-001',
        to: agentId,
        type: 'consensus-proposal',
        payload: consensusProposal,
        timestamp: new Date(),
        priority: 'high',
        acknowledgmentRequired: true
      });
    }

    consensusProposal.status = 'voting';
    
    // Set voting deadline timeout
    setTimeout(() => {
      this.finalizeConsensus(consensusId);
    }, consensusProposal.votingDeadline.getTime() - Date.now());

    this.emit('consensus-proposed', { consensusId, type: proposal.type });
    
    return consensusId;
  }

  async voteOnConsensus(consensusId: string, vote: ConsensusVote): Promise<boolean> {
    const proposal = this.consensusProposals.get(consensusId);
    if (!proposal || proposal.status !== 'voting') {
      return false;
    }

    // Check if agent already voted
    const existingVote = proposal.currentVotes.find(v => v.agentId === vote.agentId);
    if (existingVote) {
      existingVote.vote = vote.vote;
      existingVote.reasoning = vote.reasoning;
      existingVote.timestamp = new Date();
    } else {
      proposal.currentVotes.push(vote);
    }

    this.emit('consensus-vote-received', { consensusId, agentId: vote.agentId, vote: vote.vote });

    // Check if we have enough votes
    if (proposal.currentVotes.length >= proposal.requiredVotes) {
      await this.finalizeConsensus(consensusId);
    }

    return true;
  }

  // File watching system
  async configureFileWatching(config: FileWatchConfig): Promise<void> {
    this.fileWatchConfig = config;
    
    if (this.isRunning) {
      await this.startFileWatching();
    }
  }

  async startFileWatching(): Promise<void> {
    if (!this.fileWatchConfig) return;

    for (const watchPath of this.fileWatchConfig.paths) {
      try {
        const watcher = await fs.watch(watchPath, { recursive: this.fileWatchConfig.recursive });
        
        this.fileWatchers.set(watchPath, watcher as any);
        
        // Handle file changes
        (watcher as any).on('change', (eventType: string, filename: string) => {
          this.handleFileChange(watchPath, eventType, filename);
        });

        this.emit('file-watching-started', { path: watchPath });
        
      } catch (error) {
        this.emit('file-watching-error', { 
          path: watchPath, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  async stopFileWatching(): Promise<void> {
    for (const [path, watcher] of this.fileWatchers) {
      try {
        if (watcher && typeof watcher.close === 'function') {
          await watcher.close();
        }
        this.emit('file-watching-stopped', { path });
      } catch (error) {
        this.emit('file-watching-stop-error', { 
          path, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    this.fileWatchers.clear();
  }

  // Metrics and monitoring
  async getSwarmMetrics(): Promise<SwarmMetrics> {
    await this.updateMetrics();
    return { ...this.metrics };
  }

  async getAgentMetrics(agentId?: string): Promise<SwarmAgent | SwarmAgent[]> {
    if (agentId) {
      const agent = this.agents.get(agentId);
      return agent ? { ...agent } : null as any;
    }
    
    return Array.from(this.agents.values()).map(agent => ({ ...agent }));
  }

  // Resource management
  async allocateResources(jobId: string, requirements: ResourceRequirement[]): Promise<boolean> {
    const availableResources = await this.getAvailableResources();
    
    // Check if resources are available
    for (const requirement of requirements) {
      const available = availableResources[requirement.type];
      if (available < requirement.amount) {
        if (requirement.critical) {
          return false;
        }
      }
    }

    // Allocate resources
    const resourceKey = `job-${jobId}`;
    this.resourcePools.set(resourceKey, requirements);
    
    this.emit('resources-allocated', { jobId, requirements });
    return true;
  }

  async releaseResources(jobId: string): Promise<void> {
    const resourceKey = `job-${jobId}`;
    const resources = this.resourcePools.get(resourceKey);
    
    if (resources) {
      this.resourcePools.delete(resourceKey);
      this.emit('resources-released', { jobId, resources });
    }
  }

  // Fault tolerance and self-healing
  async detectAndHealFaults(): Promise<void> {
    const failedAgents = Array.from(this.agents.values()).filter(agent => 
      agent.status === 'failed' || 
      (Date.now() - agent.lastHeartbeat.getTime()) > 60000 // 1 minute timeout
    );

    for (const agent of failedAgents) {
      await this.healAgent(agent);
    }

    // Check for stuck jobs
    const stuckJobs = Array.from(this.jobs.values()).filter(job => 
      job.status === 'running' && 
      job.startedAt &&
      (Date.now() - job.startedAt.getTime()) > (job.requirements.estimatedDuration * 2)
    );

    for (const job of stuckJobs) {
      await this.handleStuckJob(job);
    }
  }

  // Private implementation methods
  private async initializeSwarm(): Promise<void> {
    // Create Queen agent (self)
    const queen: SwarmAgent = {
      id: 'queen-001',
      type: 'queen',
      status: 'idle',
      capabilities: [
        'orchestration', 'job-scheduling', 'resource-management',
        'consensus-coordination', 'fault-detection', 'self-healing',
        'performance-monitoring', 'load-balancing', 'topology-management'
      ],
      currentLoad: 0,
      maxLoad: 1000,
      performance: this.initializeAgentPerformance(),
      currentJobs: [],
      lastHeartbeat: new Date(),
      metadata: {
        version: '1.0.0',
        specializations: ['orchestration', 'coordination'],
        location: os.hostname(),
        resources: { cpu: 100, memory: 100, disk: 100, network: 100 },
        configuration: {}
      }
    };

    this.agents.set(queen.id, queen);

    // Spawn initial agents based on configuration
    for (let i = 0; i < this.config.maxWorkers; i++) {
      await this.spawnAgent('worker');
    }

    for (let i = 0; i < this.config.maxScouts; i++) {
      await this.spawnAgent('scout');
    }

    for (let i = 0; i < this.config.maxSoldiers; i++) {
      await this.spawnAgent('soldier');
    }

    this.emit('swarm-initialized', {
      totalAgents: this.agents.size,
      workers: this.config.maxWorkers,
      scouts: this.config.maxScouts,
      soldiers: this.config.maxSoldiers,
      topology: this.config.topology
    });
  }

  private async startCommunicationSystem(): Promise<void> {
    // Start message processing loop
    this.coordinationInterval = setInterval(async () => {
      await this.processMessageQueue();
      await this.processHeartbeats();
      await this.processConsensus();
      await this.detectAndHealFaults();
    }, 1000); // Process every second
  }

  private async startConsensusSystem(): Promise<void> {
    // Initialize consensus mechanism based on configuration
    switch (this.config.consensusMechanism) {
      case 'raft':
        await this.initializeRaftConsensus();
        break;
      case 'byzantine':
        await this.initializeByzantineConsensus();
        break;
      case 'gossip':
        await this.initializeGossipConsensus();
        break;
      case 'quorum':
        await this.initializeQuorumConsensus();
        break;
    }
  }

  private async startJobProcessing(): Promise<void> {
    // Start job processing loop
    setInterval(async () => {
      await this.processJobQueue();
    }, 2000); // Process every 2 seconds
  }

  private async startMonitoring(): Promise<void> {
    // Start metrics collection
    this.metricsInterval = setInterval(async () => {
      await this.updateMetrics();
      this.emit('metrics-updated', this.metrics);
    }, 5000); // Update every 5 seconds

    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeats();
    }, 30000); // Heartbeat every 30 seconds
  }

  private insertJobIntoQueue(job: ProductionJob): void {
    const priorityOrder = { emergency: 5, critical: 4, high: 3, medium: 2, low: 1 };
    const jobPriority = priorityOrder[job.priority];
    
    let insertIndex = this.jobQueue.length;
    for (let i = 0; i < this.jobQueue.length; i++) {
      const queuedJobPriority = priorityOrder[this.jobQueue[i].priority];
      if (jobPriority > queuedJobPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.jobQueue.splice(insertIndex, 0, job);
  }

  private async processJobQueue(): Promise<void> {
    if (this.jobQueue.length === 0) return;

    // Get available agents
    const availableAgents = this.getAvailableAgents();
    if (availableAgents.length === 0) return;

    // Process jobs that can be assigned
    const processableJobs = this.jobQueue.filter(job => {
      // Check dependencies
      const dependenciesMet = job.dependencies.every(depId => {
        const depJob = this.jobs.get(depId);
        return depJob && depJob.status === 'completed';
      });

      if (!dependenciesMet) return false;

      // Check if we have suitable agents
      const suitableAgents = this.findSuitableAgents(job);
      return suitableAgents.length >= job.requirements.minAgentCount;
    });

    for (const job of processableJobs.slice(0, availableAgents.length)) {
      await this.assignJobToAgents(job);
      this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
    }
  }

  private async assignJobToAgents(job: ProductionJob): Promise<void> {
    const suitableAgents = this.findSuitableAgents(job);
    const selectedAgents = this.selectOptimalAgents(suitableAgents, job);

    if (selectedAgents.length < job.requirements.minAgentCount) {
      this.emit('job-assignment-failed', { 
        jobId: job.id, 
        reason: 'Insufficient suitable agents' 
      });
      return;
    }

    // Allocate resources
    const resourcesAllocated = await this.allocateResources(job.id, job.requirements.resourceRequirements);
    if (!resourcesAllocated) {
      this.emit('job-assignment-failed', { 
        jobId: job.id, 
        reason: 'Insufficient resources' 
      });
      return;
    }

    // Update job status
    job.status = 'assigned';
    job.assignedAgents = selectedAgents.map(a => a.id);
    job.startedAt = new Date();

    // Update agent states
    for (const agent of selectedAgents) {
      agent.status = 'busy';
      agent.currentJobs.push(job.id);
      agent.currentLoad += this.estimateJobLoad(job);
    }

    // Send job assignments
    for (const agent of selectedAgents) {
      await this.sendMessage({
        id: `job-assignment-${job.id}-${agent.id}`,
        from: 'queen-001',
        to: agent.id,
        type: 'job-assignment',
        payload: {
          job: this.sanitizeJobForAgent(job, agent.type),
          role: this.determineAgentRole(agent, job)
        },
        timestamp: new Date(),
        priority: job.priority === 'emergency' ? 'emergency' : 'high',
        acknowledgmentRequired: true
      });
    }

    job.status = 'running';
    this.emit('job-assigned', { 
      jobId: job.id, 
      assignedAgents: job.assignedAgents,
      estimatedDuration: job.requirements.estimatedDuration
    });
  }

  private findSuitableAgents(job: ProductionJob): SwarmAgent[] {
    return Array.from(this.agents.values()).filter(agent => {
      // Skip queen for regular jobs
      if (agent.type === 'queen') return false;
      
      // Check if agent type is required
      if (!job.requirements.agentTypes.includes(agent.type)) return false;
      
      // Check if agent has required capabilities
      const hasRequiredCapabilities = job.requirements.capabilities.every(cap => 
        agent.capabilities.includes(cap)
      );
      if (!hasRequiredCapabilities) return false;
      
      // Check if agent is available
      if (agent.status !== 'idle' && agent.currentLoad >= agent.maxLoad) return false;
      
      // Check if agent can handle additional load
      const estimatedLoad = this.estimateJobLoad(job);
      if (agent.currentLoad + estimatedLoad > agent.maxLoad) return false;
      
      return true;
    });
  }

  private selectOptimalAgents(candidates: SwarmAgent[], job: ProductionJob): SwarmAgent[] {
    // Sort by performance and availability
    const scored = candidates.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, job)
    })).sort((a, b) => b.score - a.score);

    const selectedCount = Math.min(
      job.requirements.maxAgentCount,
      Math.max(job.requirements.minAgentCount, scored.length)
    );

    return scored.slice(0, selectedCount).map(s => s.agent);
  }

  private calculateAgentScore(agent: SwarmAgent, job: ProductionJob): number {
    let score = 0;
    
    // Performance metrics (40%)
    score += agent.performance.successRate * 0.4;
    
    // Availability (30%)
    const availabilityScore = (agent.maxLoad - agent.currentLoad) / agent.maxLoad;
    score += availabilityScore * 30;
    
    // Resource efficiency (20%)
    score += agent.performance.resourceEfficiency * 0.2;
    
    // Capability match (10%)
    const capabilityMatch = job.requirements.capabilities.filter(cap => 
      agent.capabilities.includes(cap)
    ).length / job.requirements.capabilities.length;
    score += capabilityMatch * 10;
    
    return score;
  }

  private async processMessageQueue(): Promise<void> {
    const messagesToProcess = this.messageQueue.splice(0, 100); // Process up to 100 messages
    
    for (const message of messagesToProcess) {
      try {
        await this.processMessage(message);
      } catch (error) {
        this.emit('message-processing-error', {
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async processMessage(message: AgentMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      this.emit('unhandled-message', { message });
    }

    // Send acknowledgment if required
    if (message.acknowledgmentRequired) {
      await this.sendAcknowledment(message);
    }
  }

  private async sendAcknowledment(originalMessage: AgentMessage): Promise<void> {
    const ackMessage: AgentMessage = {
      id: `ack-${originalMessage.id}`,
      from: originalMessage.to as string,
      to: originalMessage.from,
      type: 'response',
      payload: { acknowledging: originalMessage.id, status: 'received' },
      timestamp: new Date(),
      priority: 'normal',
      acknowledgmentRequired: false
    };

    await this.sendMessage(ackMessage);
  }

  private initializeMessageHandlers(): void {
    this.messageHandlers.set('job-update', async (message) => {
      await this.handleJobUpdate(message);
    });
    
    this.messageHandlers.set('job-completion', async (message) => {
      await this.handleJobCompletion(message);
    });
    
    this.messageHandlers.set('job-failure', async (message) => {
      await this.handleJobFailure(message);
    });
    
    this.messageHandlers.set('heartbeat', async (message) => {
      await this.handleHeartbeat(message);
    });
    
    this.messageHandlers.set('resource-update', async (message) => {
      await this.handleResourceUpdate(message);
    });
    
    this.messageHandlers.set('consensus-vote', async (message) => {
      await this.handleConsensusVote(message);
    });
    
    this.messageHandlers.set('alert', async (message) => {
      await this.handleAlert(message);
    });

    this.messageHandlers.set('response', async (message) => {
      await this.handleResponse(message);
    });
  }

  private async handleJobUpdate(message: AgentMessage): Promise<void> {
    const { jobId, progress, metrics } = message.payload;
    const job = this.jobs.get(jobId);
    
    if (job) {
      job.progress = { ...job.progress, ...progress };
      if (metrics) {
        job.metrics = { ...job.metrics, ...metrics };
      }
      
      this.emit('job-progress-updated', { jobId, progress: job.progress });
    }
  }

  private async handleJobCompletion(message: AgentMessage): Promise<void> {
    const { jobId, result, metrics } = message.payload;
    const job = this.jobs.get(jobId);
    
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress.percentage = 100;
      job.metrics = { ...job.metrics, ...metrics };
      
      // Update agent states
      for (const agentId of job.assignedAgents) {
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.currentJobs = agent.currentJobs.filter(jid => jid !== jobId);
          agent.currentLoad -= this.estimateJobLoad(job);
          agent.performance.jobsCompleted++;
          
          if (agent.currentJobs.length === 0) {
            agent.status = 'idle';
          }
        }
      }
      
      // Release resources
      await this.releaseResources(jobId);
      
      this.emit('job-completed', { jobId, result, metrics: job.metrics });
    }
  }

  private async handleJobFailure(message: AgentMessage): Promise<void> {
    const { jobId, error, retryable } = message.payload;
    const job = this.jobs.get(jobId);
    
    if (job) {
      // Check if job should be retried
      if (retryable && job.retryPolicy.maxRetries > 0) {
        await this.retryJob(job);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        
        // Update agent states
        for (const agentId of job.assignedAgents) {
          const agent = this.agents.get(agentId);
          if (agent) {
            agent.currentJobs = agent.currentJobs.filter(jid => jid !== jobId);
            agent.currentLoad -= this.estimateJobLoad(job);
            agent.performance.jobsFailed++;
            
            if (agent.currentJobs.length === 0) {
              agent.status = 'idle';
            }
          }
        }
        
        // Release resources
        await this.releaseResources(jobId);
        
        this.emit('job-failed', { jobId, error });
      }
    }
  }

  private async handleHeartbeat(message: AgentMessage): Promise<void> {
    const agent = this.agents.get(message.from);
    if (agent) {
      agent.lastHeartbeat = new Date();
      
      // Update agent metrics from heartbeat
      if (message.payload.metrics) {
        agent.performance = { ...agent.performance, ...message.payload.metrics };
      }
      
      // Update agent status
      if (message.payload.status) {
        agent.status = message.payload.status;
      }
    }
  }

  private async handleResourceUpdate(message: AgentMessage): Promise<void> {
    const agent = this.agents.get(message.from);
    if (agent && message.payload.resources) {
      agent.metadata.resources = { ...agent.metadata.resources, ...message.payload.resources };
    }
  }

  private async handleConsensusVote(message: AgentMessage): Promise<void> {
    const { consensusId, vote } = message.payload;
    await this.voteOnConsensus(consensusId, {
      agentId: message.from,
      vote: vote.decision,
      reasoning: vote.reasoning,
      timestamp: new Date()
    });
  }

  private async handleAlert(message: AgentMessage): Promise<void> {
    this.emit('agent-alert', {
      agentId: message.from,
      alert: message.payload,
      timestamp: message.timestamp
    });
    
    // Handle critical alerts
    if (message.payload.severity === 'critical') {
      await this.handleCriticalAlert(message);
    }
  }

  private async handleResponse(message: AgentMessage): Promise<void> {
    // Handle acknowledgments
    if (message.payload.acknowledging) {
      const pendingAck = this.pendingAcks.get(message.payload.acknowledging);
      if (pendingAck) {
        clearTimeout(pendingAck.timeout);
        pendingAck.resolve(true);
        this.pendingAcks.delete(message.payload.acknowledging);
      }
    }
  }

  // File watching handlers
  private async handleFileChange(basePath: string, eventType: string, filename: string): Promise<void> {
    if (!this.fileWatchConfig) return;

    const fullPath = path.join(basePath, filename || '');
    
    // Check if file matches patterns
    const matchesPattern = this.fileWatchConfig.patterns.some(pattern => 
      this.matchesGlob(fullPath, pattern)
    );
    
    const matchesIgnore = this.fileWatchConfig.ignorePatterns.some(pattern => 
      this.matchesGlob(fullPath, pattern)
    );
    
    if (!matchesPattern || matchesIgnore) return;

    const change: FileChange = {
      path: fullPath,
      type: eventType as any,
      timestamp: new Date()
    };

    try {
      const stats = await fs.stat(fullPath);
      change.size = stats.size;
      change.metadata = {
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      // File might have been deleted
      if (eventType !== 'deleted') {
        change.type = 'deleted';
      }
    }

    const changeEvent: ChangeEvent = {
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      changes: [change],
      timestamp: new Date(),
      triggerJob: this.shouldTriggerJob(change),
      jobTemplate: this.getJobTemplate(change)
    };

    this.emit('file-change-detected', changeEvent);

    // Auto-trigger job if configured
    if (changeEvent.triggerJob && changeEvent.jobTemplate) {
      await this.submitJob({
        type: changeEvent.jobTemplate.type || 'workflow-orchestration',
        priority: changeEvent.jobTemplate.priority || 'medium',
        payload: { trigger: 'file-change', changeEvent },
        requirements: changeEvent.jobTemplate.requirements || this.getDefaultJobRequirements(),
        dependencies: changeEvent.jobTemplate.dependencies || [],
        retryPolicy: changeEvent.jobTemplate.retryPolicy || this.getDefaultRetryPolicy(),
        assignedAgents: []
      });
    }
  }

  // Utility methods
  private initializeMetrics(): SwarmMetrics {
    return {
      totalAgents: 0,
      activeAgents: 0,
      idleAgents: 0,
      overloadedAgents: 0,
      failedAgents: 0,
      totalJobs: 0,
      queuedJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageJobTime: 0,
      systemThroughput: 0,
      resourceUtilization: {
        cpu: { current: 0, average: 0, peak: 0, efficiency: 0, bottlenecks: [] },
        memory: { current: 0, average: 0, peak: 0, efficiency: 0, bottlenecks: [] },
        disk: { current: 0, average: 0, peak: 0, efficiency: 0, bottlenecks: [] },
        network: { current: 0, average: 0, peak: 0, efficiency: 0, bottlenecks: [] }
      },
      swarmEfficiency: 0,
      communicationLatency: 0,
      consensusTime: 0,
      faultTolerance: 0,
      uptime: 0
    };
  }

  private async updateMetrics(): Promise<void> {
    const agents = Array.from(this.agents.values());
    const jobs = Array.from(this.jobs.values());

    this.metrics.totalAgents = agents.length;
    this.metrics.activeAgents = agents.filter(a => a.status === 'busy').length;
    this.metrics.idleAgents = agents.filter(a => a.status === 'idle').length;
    this.metrics.overloadedAgents = agents.filter(a => a.currentLoad >= a.maxLoad).length;
    this.metrics.failedAgents = agents.filter(a => a.status === 'failed').length;

    this.metrics.totalJobs = jobs.length;
    this.metrics.queuedJobs = jobs.filter(j => j.status === 'queued').length;
    this.metrics.runningJobs = jobs.filter(j => j.status === 'running').length;
    this.metrics.completedJobs = jobs.filter(j => j.status === 'completed').length;
    this.metrics.failedJobs = jobs.filter(j => j.status === 'failed').length;

    // Calculate average job time
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.completedAt && j.startedAt);
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, job) => 
        sum + (job.completedAt!.getTime() - job.startedAt!.getTime()), 0
      );
      this.metrics.averageJobTime = totalTime / completedJobs.length;
    }

    // Calculate system throughput (jobs per minute)
    const recentJobs = jobs.filter(j => 
      j.completedAt && (Date.now() - j.completedAt.getTime()) < 60000
    );
    this.metrics.systemThroughput = recentJobs.length;

    // Calculate swarm efficiency
    const totalCapacity = agents.reduce((sum, agent) => sum + agent.maxLoad, 0);
    const currentLoad = agents.reduce((sum, agent) => sum + agent.currentLoad, 0);
    this.metrics.swarmEfficiency = totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0;

    // Update resource utilization
    await this.updateResourceMetrics();
  }

  private async updateResourceMetrics(): Promise<void> {
    // This would collect actual system metrics in production
    // For now, we'll calculate based on agent load
    const agents = Array.from(this.agents.values());
    
    const avgLoad = agents.length > 0 ? 
      agents.reduce((sum, agent) => sum + (agent.currentLoad / agent.maxLoad), 0) / agents.length * 100 : 0;

    this.metrics.resourceUtilization.cpu.current = avgLoad;
    this.metrics.resourceUtilization.memory.current = avgLoad * 0.8; // Assume memory usage correlates
    this.metrics.resourceUtilization.disk.current = avgLoad * 0.3;
    this.metrics.resourceUtilization.network.current = avgLoad * 0.6;
  }

  private getAvailableAgents(): SwarmAgent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.type !== 'queen' && 
      (agent.status === 'idle' || agent.currentLoad < agent.maxLoad * 0.8)
    );
  }

  private getAgentCount(type: AgentType): number {
    return Array.from(this.agents.values()).filter(agent => agent.type === type).length;
  }

  private getDefaultCapabilities(type: AgentType): string[] {
    switch (type) {
      case 'queen':
        return ['orchestration', 'coordination', 'monitoring'];
      case 'worker':
        return ['data-processing', 'computation', 'file-operations'];
      case 'scout':
        return ['monitoring', 'validation', 'discovery'];
      case 'soldier':
        return ['stress-testing', 'load-generation', 'performance-testing'];
      default:
        return [];
    }
  }

  private getMaxLoad(type: AgentType): number {
    switch (type) {
      case 'queen': return 1000;
      case 'worker': return 100;
      case 'scout': return 50;
      case 'soldier': return 200;
      default: return 100;
    }
  }

  private getDefaultResourceCapacity(type: AgentType): ResourceCapacity {
    const base = { cpu: 100, memory: 100, disk: 100, network: 100 };
    
    switch (type) {
      case 'queen':
        return { cpu: 200, memory: 200, disk: 200, network: 200 };
      case 'soldier':
        return { cpu: 150, memory: 150, disk: 100, network: 150 };
      default:
        return base;
    }
  }

  private initializeAgentPerformance(): AgentPerformance {
    return {
      successRate: 100,
      averageExecutionTime: 0,
      throughput: 0,
      resourceEfficiency: 1.0,
      jobsCompleted: 0,
      jobsFailed: 0,
      uptime: 0,
      lastReset: new Date()
    };
  }

  private createEmptyResourceUsage(): ResourceUsage {
    const empty = { cpu: 0, memory: 0, disk: 0, network: 0 };
    return {
      ...empty,
      peak: { ...empty },
      average: { ...empty }
    };
  }

  private estimateJobLoad(job: ProductionJob): number {
    // Simple load estimation based on job type and requirements
    const baseLoad = {
      'marketplace-analysis': 20,
      'stress-test': 50,
      'environment-validation': 10,
      'workflow-orchestration': 30,
      'data-processing': 40
    }[job.type] || 25;

    const priorityMultiplier = {
      emergency: 2.0,
      critical: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.8
    }[job.priority];

    return baseLoad * priorityMultiplier;
  }

  private validateMessage(message: AgentMessage): boolean {
    return !!(
      message.id &&
      message.from &&
      message.to &&
      message.type &&
      message.timestamp &&
      message.priority
    );
  }

  private matchesGlob(path: string, pattern: string): boolean {
    // Simple glob matching - in production, use a proper glob library
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  private shouldTriggerJob(change: FileChange): boolean {
    // Define rules for when file changes should trigger jobs
    const triggerExtensions = ['.ts', '.js', '.json', '.yaml', '.yml'];
    return triggerExtensions.some(ext => change.path.endsWith(ext));
  }

  private getJobTemplate(change: FileChange): Partial<ProductionJob> | undefined {
    if (change.path.includes('test')) {
      return {
        type: 'stress-test',
        priority: 'medium',
        requirements: this.getDefaultJobRequirements('soldier')
      };
    }
    
    return {
      type: 'workflow-orchestration',
      priority: 'low',
      requirements: this.getDefaultJobRequirements('worker')
    };
  }

  private getDefaultJobRequirements(primaryType: AgentType = 'worker'): JobRequirements {
    return {
      agentTypes: [primaryType],
      minAgentCount: 1,
      maxAgentCount: 3,
      resourceRequirements: [
        { type: 'cpu', amount: 50, unit: 'percentage', critical: false },
        { type: 'memory', amount: 512, unit: 'MB', critical: false }
      ],
      capabilities: this.getDefaultCapabilities(primaryType),
      exclusiveExecution: false,
      parallelizable: true,
      estimatedDuration: 60000 // 1 minute
    };
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxRetries: 3,
      retryDelay: 5000,
      backoffStrategy: 'exponential',
      retryConditions: ['timeout', 'temporary-failure', 'resource-unavailable']
    };
  }

  // Additional helper methods would be implemented here...
  private async startAgentWorker(agent: SwarmAgent): Promise<void> {
    // Implementation for starting worker threads
  }

  private async stopAgentWorker(agent: SwarmAgent): Promise<void> {
    // Implementation for stopping worker threads
  }

  private async reassignJob(jobId: string): Promise<void> {
    // Implementation for job reassignment
  }

  private async completeRunningJobs(): Promise<void> {
    // Implementation for graceful job completion during shutdown
  }

  private async shutdownAgents(): Promise<void> {
    // Implementation for agent shutdown
  }

  private async sendHeartbeats(): Promise<void> {
    // Implementation for heartbeat broadcasting
  }

  private async processHeartbeats(): Promise<void> {
    // Implementation for heartbeat processing
  }

  private async processConsensus(): Promise<void> {
    // Implementation for consensus processing
  }

  private async initializeRaftConsensus(): Promise<void> {
    // Raft consensus implementation
  }

  private async initializeByzantineConsensus(): Promise<void> {
    // Byzantine consensus implementation
  }

  private async initializeGossipConsensus(): Promise<void> {
    // Gossip consensus implementation
  }

  private async initializeQuorumConsensus(): Promise<void> {
    // Quorum consensus implementation
  }

  private getEligibleVoters(proposalType: string): string[] {
    // Return list of agents eligible to vote on consensus proposals
    return Array.from(this.agents.keys()).filter(id => id !== 'queen-001');
  }

  private async finalizeConsensus(consensusId: string): Promise<void> {
    // Implementation for consensus finalization
  }

  private async getAvailableResources(): Promise<Record<string, number>> {
    // Implementation for resource availability calculation
    return {
      cpu: 100,
      memory: 100,
      disk: 100,
      network: 100
    };
  }

  private async healAgent(agent: SwarmAgent): Promise<void> {
    // Implementation for agent healing
    agent.status = 'healing';
    
    // Attempt to restart agent
    setTimeout(() => {
      if (agent.status === 'healing') {
        agent.status = 'idle';
        agent.lastHeartbeat = new Date();
      }
    }, 10000);
  }

  private async handleStuckJob(job: ProductionJob): Promise<void> {
    // Implementation for handling stuck jobs
    await this.cancelJob(job.id);
    
    // Retry if policy allows
    if (job.retryPolicy.maxRetries > 0) {
      job.retryPolicy.maxRetries--;
      job.status = 'queued';
      this.insertJobIntoQueue(job);
    }
  }

  private async retryJob(job: ProductionJob): Promise<void> {
    // Implementation for job retry logic
    job.retryPolicy.maxRetries--;
    job.status = 'queued';
    
    // Apply backoff delay
    const delay = this.calculateRetryDelay(job.retryPolicy);
    
    setTimeout(() => {
      this.insertJobIntoQueue(job);
    }, delay);
  }

  private calculateRetryDelay(policy: RetryPolicy): number {
    switch (policy.backoffStrategy) {
      case 'exponential':
        return policy.retryDelay * Math.pow(2, 3 - policy.maxRetries);
      case 'linear':
        return policy.retryDelay * (4 - policy.maxRetries);
      default:
        return policy.retryDelay;
    }
  }

  private sanitizeJobForAgent(job: ProductionJob, agentType: AgentType): Partial<ProductionJob> {
    // Remove sensitive information and provide only relevant data for agent
    return {
      id: job.id,
      type: job.type,
      priority: job.priority,
      payload: job.payload,
      requirements: job.requirements
    };
  }

  private determineAgentRole(agent: SwarmAgent, job: ProductionJob): string {
    // Determine the specific role for this agent in the job
    if (job.requirements.agentTypes.length === 1) {
      return 'primary';
    }
    
    return agent.type === job.requirements.agentTypes[0] ? 'primary' : 'support';
  }

  private async handleCriticalAlert(message: AgentMessage): Promise<void> {
    // Implementation for handling critical alerts
    this.emit('critical-alert', {
      agentId: message.from,
      alert: message.payload,
      timestamp: message.timestamp
    });
    
    // Trigger emergency protocols if needed
    if (message.payload.triggerEmergency) {
      await this.triggerEmergencyProtocols(message.payload);
    }
  }

  private async triggerEmergencyProtocols(alertPayload: any): Promise<void> {
    // Implementation for emergency protocol activation
    this.emit('emergency-protocols-triggered', { alert: alertPayload });
  }
}

// Export factory function for easy instantiation
export function createHiveQueenOrchestrator(config: Partial<HiveQueenConfig> = {}): HiveQueenOrchestrator {
  const defaultConfig: HiveQueenConfig = {
    maxWorkers: 8,
    maxScouts: 4,
    maxSoldiers: 2,
    topology: 'hierarchical',
    consensusMechanism: 'raft',
    communicationProtocol: 'message-passing',
    faultTolerance: true,
    selfHealing: true,
    realTimeMonitoring: true,
    jobQueueing: true,
    distributedExecution: true,
    resourcePooling: true
  };

  return new HiveQueenOrchestrator({ ...defaultConfig, ...config });
}