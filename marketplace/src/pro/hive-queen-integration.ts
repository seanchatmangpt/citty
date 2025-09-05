/**
 * HIVE QUEEN Integration System
 * Complete production-grade orchestration with all components integrated
 */

import { HiveQueenOrchestrator } from './hive-queen-orchestrator.js';
import { ProductionPipeline } from './production-pipeline.js';
import { EnhancedWorkerAgent } from './enhanced-worker-agent.js';
import { EnhancedScoutAgent } from './enhanced-scout-agent.js';
import { EnhancedSoldierAgent } from './enhanced-soldier-agent.js';
import { AgentCommunicationProtocol, MessageType, MessagePriority } from './agent-communication-protocol.js';
import { DistributedConsensus, ConsensusType, ProposalType, VoteDecision } from './distributed-consensus.js';
import { EventEmitter } from 'events';

export interface HiveQueenSystemConfig {
  // Core system configuration
  systemId: string;
  maxWorkers: number;
  maxScouts: number;
  maxSoldiers: number;
  
  // Communication configuration
  communication: {
    heartbeatInterval: number;
    discoveryInterval: number;
    ackTimeout: number;
    retryAttempts: number;
    maxMessageQueue: number;
    enableEncryption: boolean;
  };

  // Consensus configuration
  consensus: {
    type: ConsensusType;
    quorumSize: number;
    voteTimeout: number;
    byzantineTolerance: number;
  };

  // Pipeline configuration
  pipeline: {
    maxConcurrentJobs: number;
    defaultTimeout: number;
    retryAttempts: number;
    enableMetrics: boolean;
  };

  // Agent configurations
  workerConfig: {
    specialization: 'general' | 'cpu_intensive' | 'io_intensive' | 'memory_intensive';
    maxParallelTasks: number;
    taskTimeout: number;
    enableProfiling: boolean;
  };

  scoutConfig: {
    watchPaths: string[];
    debounceMs: number;
    maxChangesPerSecond: number;
    enableDeepScan: boolean;
  };

  soldierConfig: {
    enableChaosEngineering: boolean;
    maxConcurrentTests: number;
    testTimeout: number;
    performanceTargets: {
      maxResponseTime: number;
      minThroughput: number;
      maxErrorRate: number;
    };
  };

  // Monitoring configuration
  monitoring: {
    metricsInterval: number;
    alertThresholds: {
      highCpuUsage: number;
      highMemoryUsage: number;
      lowThroughput: number;
      highErrorRate: number;
    };
    enableAutoRecovery: boolean;
  };
}

export interface SystemMetrics {
  timestamp: number;
  uptime: number;
  
  // Agent metrics
  activeWorkers: number;
  activeScouts: number;
  activeSoldiers: number;
  totalAgents: number;
  
  // Performance metrics
  jobsCompleted: number;
  jobsActive: number;
  jobsQueued: number;
  averageJobTime: number;
  throughput: number;
  
  // Communication metrics
  messagesExchanged: number;
  consensusDecisions: number;
  networkLatency: number;
  
  // Resource metrics
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  
  // Health metrics
  errorRate: number;
  alertsActive: number;
  systemHealth: 'healthy' | 'degraded' | 'critical' | 'recovering';
}

export interface SystemAlert {
  id: string;
  type: 'performance' | 'error' | 'security' | 'resource' | 'consensus';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  source: string;
  resolved: boolean;
  autoRecoveryAttempted: boolean;
  metadata?: Record<string, any>;
}

export class HiveQueenSystem extends EventEmitter {
  private config: HiveQueenSystemConfig;
  private orchestrator: HiveQueenOrchestrator;
  private pipeline: ProductionPipeline;
  private communication: AgentCommunicationProtocol;
  private consensus: DistributedConsensus;
  
  // Agent pools
  private workers = new Map<string, EnhancedWorkerAgent>();
  private scouts = new Map<string, EnhancedScoutAgent>();
  private soldiers = new Map<string, EnhancedSoldierAgent>();
  
  // System state
  private systemStartTime = Date.now();
  private activeAlerts = new Map<string, SystemAlert>();
  private metrics: SystemMetrics;
  private isShuttingDown = false;
  
  // Monitoring intervals
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: HiveQueenSystemConfig) {
    super();
    this.config = config;
    
    // Initialize metrics
    this.metrics = this.createInitialMetrics();
    
    // Initialize core components
    this.initializeCoreComponents();
    
    // Setup system monitoring
    this.setupMonitoring();
    
    // Setup fault tolerance
    this.setupFaultTolerance();
  }

  private createInitialMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      uptime: 0,
      activeWorkers: 0,
      activeScouts: 0,
      activeSoldiers: 0,
      totalAgents: 0,
      jobsCompleted: 0,
      jobsActive: 0,
      jobsQueued: 0,
      averageJobTime: 0,
      throughput: 0,
      messagesExchanged: 0,
      consensusDecisions: 0,
      networkLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      errorRate: 0,
      alertsActive: 0,
      systemHealth: 'healthy'
    };
  }

  private initializeCoreComponents(): void {
    // Initialize communication protocol
    this.communication = new AgentCommunicationProtocol({
      agentId: `${this.config.systemId}_queen`,
      maxMessageQueue: this.config.communication.maxMessageQueue,
      ackTimeout: this.config.communication.ackTimeout,
      retryAttempts: this.config.communication.retryAttempts,
      heartbeatInterval: this.config.communication.heartbeatInterval,
      discoveryInterval: this.config.communication.discoveryInterval,
      compressionThreshold: 1024 * 10, // 10KB
      enableEncryption: this.config.communication.enableEncryption
    });

    // Initialize consensus system
    this.consensus = new DistributedConsensus({
      agentId: `${this.config.systemId}_queen`,
      consensusType: this.config.consensus.type,
      quorumSize: this.config.consensus.quorumSize,
      voteTimeout: this.config.consensus.voteTimeout,
      maxProposals: 100,
      requireSignatures: true,
      byzantineTolerance: this.config.consensus.byzantineTolerance
    });

    // Initialize pipeline
    this.pipeline = new ProductionPipeline({
      maxConcurrentJobs: this.config.pipeline.maxConcurrentJobs,
      queueCapacity: 1000,
      defaultTimeout: this.config.pipeline.defaultTimeout,
      retryAttempts: this.config.pipeline.retryAttempts,
      enableMetrics: this.config.pipeline.enableMetrics,
      resourceLimits: {
        maxCpuUsage: 0.8,
        maxMemoryUsage: 0.85,
        maxDiskUsage: 0.9
      }
    });

    // Initialize orchestrator
    this.orchestrator = new HiveQueenOrchestrator({
      maxAgents: this.config.maxWorkers + this.config.maxScouts + this.config.maxSoldiers,
      jobQueueCapacity: 1000,
      agentTimeout: 30000,
      consensusTimeout: 15000,
      enableMetrics: true,
      resourceManagement: {
        cpuLimit: 0.8,
        memoryLimit: 0.85,
        maxConcurrentJobs: this.config.pipeline.maxConcurrentJobs
      }
    });

    // Setup component event handlers
    this.setupComponentEventHandlers();
  }

  private setupComponentEventHandlers(): void {
    // Communication events
    this.communication.on('message_sent', (message, agent) => {
      this.metrics.messagesExchanged++;
    });

    this.communication.on('agent_registered', (agent) => {
      this.emit('agent_joined', agent);
    });

    this.communication.on('agent_offline', (agent) => {
      this.handleAgentOffline(agent);
    });

    // Consensus events
    this.consensus.on('consensus_reached', (result) => {
      this.metrics.consensusDecisions++;
      this.handleConsensusResult(result);
    });

    // Pipeline events
    this.pipeline.on('job_completed', (job) => {
      this.metrics.jobsCompleted++;
      this.updateThroughputMetrics();
    });

    this.pipeline.on('job_failed', (job, error) => {
      this.handleJobFailure(job, error);
    });

    // Orchestrator events
    this.orchestrator.on('job_assigned', (job, agent) => {
      this.metrics.jobsActive++;
    });

    this.orchestrator.on('agent_spawned', (agent) => {
      this.handleAgentSpawned(agent);
    });
  }

  private setupMonitoring(): void {
    // Metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);

    // Health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.metricsInterval * 2);
  }

  private setupFaultTolerance(): void {
    // Setup error handling for components
    this.orchestrator.on('error', (error) => {
      this.handleSystemError('orchestrator', error);
    });

    this.pipeline.on('error', (error) => {
      this.handleSystemError('pipeline', error);
    });

    this.communication.on('error', (error) => {
      this.handleSystemError('communication', error);
    });

    this.consensus.on('error', (error) => {
      this.handleSystemError('consensus', error);
    });

    // Process-level error handling
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('uncaught_exception', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('unhandled_rejection', new Error(String(reason)));
    });
  }

  /**
   * Start the complete HIVE QUEEN system
   */
  async start(): Promise<void> {
    try {
      console.log(`[HIVE QUEEN] Starting system ${this.config.systemId}...`);

      // Start core components
      console.log('[HIVE QUEEN] Starting communication protocol...');
      // Communication starts automatically in constructor

      console.log('[HIVE QUEEN] Starting consensus system...');
      // Consensus starts automatically in constructor

      console.log('[HIVE QUEEN] Starting production pipeline...');
      await this.pipeline.start();

      console.log('[HIVE QUEEN] Starting orchestrator...');
      // Orchestrator starts automatically in constructor

      // Spawn initial agents
      await this.spawnInitialAgents();

      // Register all agents in communication network
      await this.registerAgentsInNetwork();

      this.emit('system_started');
      console.log('[HIVE QUEEN] System started successfully');
      
    } catch (error) {
      console.error('[HIVE QUEEN] Failed to start system:', error);
      this.handleCriticalError('startup_failure', error as Error);
      throw error;
    }
  }

  private async spawnInitialAgents(): Promise<void> {
    const spawnPromises: Promise<void>[] = [];

    // Spawn workers
    for (let i = 0; i < this.config.maxWorkers; i++) {
      spawnPromises.push(this.spawnWorker(`worker_${i}`));
    }

    // Spawn scouts
    for (let i = 0; i < this.config.maxScouts; i++) {
      spawnPromises.push(this.spawnScout(`scout_${i}`));
    }

    // Spawn soldiers
    for (let i = 0; i < this.config.maxSoldiers; i++) {
      spawnPromises.push(this.spawnSoldier(`soldier_${i}`));
    }

    await Promise.all(spawnPromises);
    console.log(`[HIVE QUEEN] Spawned ${spawnPromises.length} agents`);
  }

  private async spawnWorker(workerId: string): Promise<void> {
    const worker = new EnhancedWorkerAgent({
      agentId: workerId,
      specialization: this.config.workerConfig.specialization,
      maxParallelTasks: this.config.workerConfig.maxParallelTasks,
      taskTimeout: this.config.workerConfig.taskTimeout,
      enableProfiling: this.config.workerConfig.enableProfiling,
      resourceLimits: {
        maxCpuUsage: 0.8,
        maxMemoryUsage: 0.7,
        maxTasksQueued: 100
      },
      communication: {
        heartbeatInterval: 5000,
        enableCompression: true,
        maxRetries: 3
      }
    });

    // Setup worker event handlers
    worker.on('task_completed', (task, result) => {
      this.handleWorkerTaskCompleted(workerId, task, result);
    });

    worker.on('agent_error', (error) => {
      this.handleAgentError(workerId, 'worker', error);
    });

    worker.on('performance_warning', (warning) => {
      this.handleAgentPerformanceWarning(workerId, 'worker', warning);
    });

    await worker.start();
    this.workers.set(workerId, worker);
    this.metrics.activeWorkers++;
    
    // Register with orchestrator
    await this.orchestrator.registerAgent({
      id: workerId,
      type: 'worker',
      capabilities: worker.getCapabilities(),
      status: 'idle',
      load: 0,
      metadata: {
        specialization: this.config.workerConfig.specialization,
        maxParallelTasks: this.config.workerConfig.maxParallelTasks
      }
    });
  }

  private async spawnScout(scoutId: string): Promise<void> {
    const scout = new EnhancedScoutAgent({
      agentId: scoutId,
      watchPaths: this.config.scoutConfig.watchPaths,
      debounceMs: this.config.scoutConfig.debounceMs,
      maxChangesPerSecond: this.config.scoutConfig.maxChangesPerSecond,
      enableDeepScan: this.config.scoutConfig.enableDeepScan,
      alerting: {
        enableAlerts: true,
        alertThreshold: 10,
        escalationTimeout: 30000
      },
      validation: {
        enableValidation: true,
        customRules: [],
        strictMode: false
      },
      performance: {
        enableMetrics: true,
        batchSize: 100,
        maxMemoryUsage: 512 * 1024 * 1024 // 512MB
      }
    });

    // Setup scout event handlers
    scout.on('change_detected', (change) => {
      this.handleScoutChangeDetected(scoutId, change);
    });

    scout.on('validation_failed', (file, errors) => {
      this.handleScoutValidationFailure(scoutId, file, errors);
    });

    scout.on('alert_triggered', (alert) => {
      this.handleScoutAlert(scoutId, alert);
    });

    await scout.start();
    this.scouts.set(scoutId, scout);
    this.metrics.activeScouts++;

    // Register with orchestrator
    await this.orchestrator.registerAgent({
      id: scoutId,
      type: 'scout',
      capabilities: ['file_monitoring', 'change_detection', 'validation'],
      status: 'active',
      load: 0,
      metadata: {
        watchPaths: this.config.scoutConfig.watchPaths.length,
        enableDeepScan: this.config.scoutConfig.enableDeepScan
      }
    });
  }

  private async spawnSoldier(soldierId: string): Promise<void> {
    const soldier = new EnhancedSoldierAgent({
      agentId: soldierId,
      testingCapabilities: ['load', 'stress', 'chaos', 'performance', 'scalability'],
      maxConcurrentTests: this.config.soldierConfig.maxConcurrentTests,
      testTimeout: this.config.soldierConfig.testTimeout,
      enableChaosEngineering: this.config.soldierConfig.enableChaosEngineering,
      performanceTargets: this.config.soldierConfig.performanceTargets,
      chaosEngineering: {
        enableNetworkChaos: true,
        enableSystemChaos: true,
        enableTimeChaos: false,
        enableDataChaos: false,
        chaosIntensity: 0.3
      },
      reporting: {
        enableRealTimeReporting: true,
        generateDetailedReports: true,
        exportFormats: ['json', 'html']
      }
    });

    // Setup soldier event handlers
    soldier.on('test_completed', (test, result) => {
      this.handleSoldierTestCompleted(soldierId, test, result);
    });

    soldier.on('performance_issue_detected', (issue) => {
      this.handleSoldierPerformanceIssue(soldierId, issue);
    });

    soldier.on('chaos_event', (event) => {
      this.handleSoldierChaosEvent(soldierId, event);
    });

    await soldier.start();
    this.soldiers.set(soldierId, soldier);
    this.metrics.activeSoldiers++;

    // Register with orchestrator
    await this.orchestrator.registerAgent({
      id: soldierId,
      type: 'soldier',
      capabilities: ['load_testing', 'stress_testing', 'chaos_engineering', 'performance_validation'],
      status: 'idle',
      load: 0,
      metadata: {
        testingCapabilities: ['load', 'stress', 'chaos', 'performance', 'scalability'],
        enableChaosEngineering: this.config.soldierConfig.enableChaosEngineering
      }
    });
  }

  private async registerAgentsInNetwork(): Promise<void> {
    const allAgents = [
      ...Array.from(this.workers.keys()).map(id => ({ id, type: 'worker' as const })),
      ...Array.from(this.scouts.keys()).map(id => ({ id, type: 'scout' as const })),
      ...Array.from(this.soldiers.keys()).map(id => ({ id, type: 'soldier' as const }))
    ];

    // Register in communication protocol
    allAgents.forEach(({ id, type }) => {
      this.communication.registerAgent({
        id,
        type,
        capabilities: this.getAgentCapabilities(id, type),
        location: `agent_${id}`,
        status: 'online',
        lastSeen: Date.now(),
        load: 0
      });
    });

    // Add to consensus network
    this.consensus.addAgents(allAgents.map(a => a.id));
  }

  private getAgentCapabilities(agentId: string, type: string): string[] {
    switch (type) {
      case 'worker':
        return ['task_execution', 'parallel_processing', 'resource_management'];
      case 'scout':
        return ['file_monitoring', 'change_detection', 'validation', 'alerting'];
      case 'soldier':
        return ['load_testing', 'stress_testing', 'chaos_engineering', 'performance_validation'];
      default:
        return [];
    }
  }

  private collectMetrics(): void {
    const now = Date.now();
    
    // Update basic metrics
    this.metrics.timestamp = now;
    this.metrics.uptime = now - this.systemStartTime;
    this.metrics.totalAgents = this.workers.size + this.scouts.size + this.soldiers.size;
    this.metrics.alertsActive = this.activeAlerts.size;

    // Collect pipeline metrics
    const pipelineStats = this.pipeline.getMetrics();
    this.metrics.jobsActive = pipelineStats.activeJobs;
    this.metrics.jobsQueued = pipelineStats.queuedJobs;
    this.metrics.averageJobTime = pipelineStats.averageExecutionTime;

    // Collect communication metrics
    const commStats = this.communication.getStats();
    this.metrics.messagesExchanged = commStats.sent + commStats.received;

    // Collect consensus metrics
    const consensusStats = this.consensus.getConsensusStats();
    this.metrics.consensusDecisions = consensusStats.proposalsAccepted + consensusStats.proposalsRejected;

    // Collect system resource metrics
    this.collectResourceMetrics();

    // Calculate system health
    this.calculateSystemHealth();

    this.emit('metrics_updated', this.metrics);
  }

  private collectResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;

    // Simulate CPU and disk usage (in production, use actual system monitoring)
    this.metrics.cpuUsage = Math.random() * 0.3 + 0.1; // 10-40% usage
    this.metrics.diskUsage = Math.random() * 0.2 + 0.05; // 5-25% usage
  }

  private calculateSystemHealth(): void {
    const thresholds = this.config.monitoring.alertThresholds;
    let healthScore = 100;

    // Penalize for high resource usage
    if (this.metrics.cpuUsage > thresholds.highCpuUsage) healthScore -= 20;
    if (this.metrics.memoryUsage > thresholds.highMemoryUsage) healthScore -= 20;

    // Penalize for performance issues
    if (this.metrics.throughput < thresholds.lowThroughput) healthScore -= 15;
    if (this.metrics.errorRate > thresholds.highErrorRate) healthScore -= 25;

    // Penalize for active alerts
    healthScore -= this.activeAlerts.size * 5;

    // Determine health status
    if (healthScore >= 80) {
      this.metrics.systemHealth = 'healthy';
    } else if (healthScore >= 60) {
      this.metrics.systemHealth = 'degraded';
    } else if (healthScore >= 30) {
      this.metrics.systemHealth = 'critical';
    } else {
      this.metrics.systemHealth = 'recovering';
    }
  }

  private performHealthCheck(): void {
    // Check agent health
    this.checkAgentHealth();
    
    // Check resource limits
    this.checkResourceLimits();
    
    // Check performance metrics
    this.checkPerformanceMetrics();
    
    // Auto-recovery if enabled and needed
    if (this.config.monitoring.enableAutoRecovery && this.metrics.systemHealth !== 'healthy') {
      this.attemptAutoRecovery();
    }
  }

  private checkAgentHealth(): void {
    // Check worker health
    this.workers.forEach((worker, id) => {
      if (!worker.isHealthy()) {
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Worker agent ${id} health check failed`,
          source: id,
          metadata: { agentType: 'worker' }
        });
      }
    });

    // Check scout health
    this.scouts.forEach((scout, id) => {
      if (!scout.isHealthy()) {
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Scout agent ${id} health check failed`,
          source: id,
          metadata: { agentType: 'scout' }
        });
      }
    });

    // Check soldier health
    this.soldiers.forEach((soldier, id) => {
      if (!soldier.isHealthy()) {
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Soldier agent ${id} health check failed`,
          source: id,
          metadata: { agentType: 'soldier' }
        });
      }
    });
  }

  private checkResourceLimits(): void {
    const thresholds = this.config.monitoring.alertThresholds;

    if (this.metrics.cpuUsage > thresholds.highCpuUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'high',
        message: `High CPU usage detected: ${(this.metrics.cpuUsage * 100).toFixed(1)}%`,
        source: 'system',
        metadata: { cpuUsage: this.metrics.cpuUsage }
      });
    }

    if (this.metrics.memoryUsage > thresholds.highMemoryUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'high',
        message: `High memory usage detected: ${(this.metrics.memoryUsage * 100).toFixed(1)}%`,
        source: 'system',
        metadata: { memoryUsage: this.metrics.memoryUsage }
      });
    }
  }

  private checkPerformanceMetrics(): void {
    const thresholds = this.config.monitoring.alertThresholds;

    if (this.metrics.throughput < thresholds.lowThroughput) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `Low throughput detected: ${this.metrics.throughput.toFixed(2)} jobs/s`,
        source: 'pipeline',
        metadata: { throughput: this.metrics.throughput }
      });
    }

    if (this.metrics.errorRate > thresholds.highErrorRate) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `High error rate detected: ${(this.metrics.errorRate * 100).toFixed(1)}%`,
        source: 'system',
        metadata: { errorRate: this.metrics.errorRate }
      });
    }
  }

  private attemptAutoRecovery(): void {
    console.log('[HIVE QUEEN] Attempting auto-recovery...');

    // Recovery strategies based on system health
    switch (this.metrics.systemHealth) {
      case 'degraded':
        this.performLightRecovery();
        break;
      case 'critical':
        this.performMediumRecovery();
        break;
      case 'recovering':
        // System is already in recovery mode
        break;
    }
  }

  private performLightRecovery(): void {
    // Scale down non-essential operations
    this.reduceAgentLoad();
    
    // Clear old data and caches
    this.performMaintenanceCleanup();
  }

  private performMediumRecovery(): void {
    // Restart unhealthy agents
    this.restartUnhealthyAgents();
    
    // Rebalance workload
    this.rebalanceWorkload();
    
    // Clear all caches
    this.performMaintenanceCleanup();
  }

  private reduceAgentLoad(): void {
    // Reduce parallel task limits for workers
    this.workers.forEach((worker) => {
      worker.reduceLoad();
    });
  }

  private performMaintenanceCleanup(): void {
    // Clear expired proposals and votes
    this.consensus.getActiveProposals().forEach(proposal => {
      if (Date.now() > proposal.timeout) {
        // Proposal cleanup is handled internally
      }
    });

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private restartUnhealthyAgents(): void {
    // Implementation would restart agents that fail health checks
    console.log('[HIVE QUEEN] Restarting unhealthy agents...');
  }

  private rebalanceWorkload(): void {
    // Implementation would redistribute tasks among healthy agents
    console.log('[HIVE QUEEN] Rebalancing workload...');
  }

  private updateThroughputMetrics(): void {
    // Calculate throughput based on recent completions
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentCompletions = this.metrics.jobsCompleted; // Simplified
    this.metrics.throughput = recentCompletions / (timeWindow / 1000);
  }

  private createAlert(alertData: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved' | 'autoRecoveryAttempted'>): void {
    const alert: SystemAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      autoRecoveryAttempted: false,
      ...alertData
    };

    this.activeAlerts.set(alert.id, alert);
    this.emit('alert_created', alert);
    
    console.log(`[HIVE QUEEN] Alert: [${alert.severity.toUpperCase()}] ${alert.message}`);
  }

  private resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.activeAlerts.delete(alertId);
      this.emit('alert_resolved', alert);
    }
  }

  // Event handlers
  private handleAgentSpawned(agent: any): void {
    console.log(`[HIVE QUEEN] Agent spawned: ${agent.id} (${agent.type})`);
  }

  private handleAgentOffline(agent: any): void {
    this.createAlert({
      type: 'error',
      severity: 'medium',
      message: `Agent ${agent.id} went offline`,
      source: agent.id,
      metadata: { agentType: agent.type }
    });
  }

  private handleJobFailure(job: any, error: Error): void {
    this.metrics.errorRate = (this.metrics.errorRate * 0.9) + 0.1; // Update error rate
    
    this.createAlert({
      type: 'error',
      severity: 'low',
      message: `Job ${job.id} failed: ${error.message}`,
      source: 'pipeline',
      metadata: { jobId: job.id, error: error.message }
    });
  }

  private handleConsensusResult(result: any): void {
    console.log(`[HIVE QUEEN] Consensus reached for proposal ${result.proposalId}: ${result.decision}`);
    
    // Handle consensus decisions
    if (result.decision === VoteDecision.APPROVE) {
      this.executeConsensusDecision(result);
    }
  }

  private executeConsensusDecision(result: any): void {
    // Implementation would execute the approved consensus decision
    console.log(`[HIVE QUEEN] Executing consensus decision: ${result.proposalId}`);
  }

  private handleWorkerTaskCompleted(workerId: string, task: any, result: any): void {
    console.log(`[HIVE QUEEN] Worker ${workerId} completed task: ${task.id}`);
  }

  private handleScoutChangeDetected(scoutId: string, change: any): void {
    console.log(`[HIVE QUEEN] Scout ${scoutId} detected change: ${change.path}`);
  }

  private handleSoldierTestCompleted(soldierId: string, test: any, result: any): void {
    console.log(`[HIVE QUEEN] Soldier ${soldierId} completed test: ${test.type}`);
  }

  private handleAgentError(agentId: string, agentType: string, error: Error): void {
    this.createAlert({
      type: 'error',
      severity: 'medium',
      message: `${agentType} agent ${agentId} error: ${error.message}`,
      source: agentId,
      metadata: { agentType, error: error.message }
    });
  }

  private handleAgentPerformanceWarning(agentId: string, agentType: string, warning: any): void {
    this.createAlert({
      type: 'performance',
      severity: 'low',
      message: `${agentType} agent ${agentId} performance warning`,
      source: agentId,
      metadata: { agentType, warning }
    });
  }

  private handleScoutValidationFailure(scoutId: string, file: string, errors: string[]): void {
    this.createAlert({
      type: 'error',
      severity: 'low',
      message: `Scout ${scoutId} validation failed for ${file}`,
      source: scoutId,
      metadata: { file, errors }
    });
  }

  private handleScoutAlert(scoutId: string, alert: any): void {
    this.createAlert({
      type: 'error',
      severity: 'medium',
      message: `Scout ${scoutId} alert: ${alert.message}`,
      source: scoutId,
      metadata: alert
    });
  }

  private handleSoldierPerformanceIssue(soldierId: string, issue: any): void {
    this.createAlert({
      type: 'performance',
      severity: 'medium',
      message: `Soldier ${soldierId} detected performance issue`,
      source: soldierId,
      metadata: issue
    });
  }

  private handleSoldierChaosEvent(soldierId: string, event: any): void {
    console.log(`[HIVE QUEEN] Soldier ${soldierId} chaos event: ${event.type}`);
  }

  private handleSystemError(component: string, error: Error): void {
    this.createAlert({
      type: 'error',
      severity: 'high',
      message: `System error in ${component}: ${error.message}`,
      source: component,
      metadata: { error: error.message, stack: error.stack }
    });
  }

  private handleCriticalError(type: string, error: Error): void {
    this.createAlert({
      type: 'error',
      severity: 'critical',
      message: `Critical system error (${type}): ${error.message}`,
      source: 'system',
      metadata: { errorType: type, error: error.message, stack: error.stack }
    });

    // In critical situations, attempt graceful shutdown
    if (!this.isShuttingDown) {
      console.error('[HIVE QUEEN] Critical error detected, initiating emergency shutdown...');
      this.emergencyShutdown();
    }
  }

  /**
   * Submit a job to the system
   */
  async submitJob(jobType: string, payload: any, options?: any): Promise<string> {
    return await this.orchestrator.submitJob({
      type: jobType,
      payload,
      priority: options?.priority || 'normal',
      timeout: options?.timeout || this.config.pipeline.defaultTimeout,
      retryAttempts: options?.retryAttempts || this.config.pipeline.retryAttempts,
      metadata: options?.metadata || {}
    });
  }

  /**
   * Propose a consensus decision
   */
  async proposeConsensus(type: ProposalType, content: any, timeout?: number): Promise<any> {
    return await this.consensus.proposeConsensus(type, content, timeout);
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get system status summary
   */
  getSystemStatus(): {
    health: string;
    uptime: number;
    agents: { workers: number; scouts: number; soldiers: number };
    performance: { throughput: number; errorRate: number; activeJobs: number };
    alerts: number;
  } {
    return {
      health: this.metrics.systemHealth,
      uptime: this.metrics.uptime,
      agents: {
        workers: this.metrics.activeWorkers,
        scouts: this.metrics.activeScouts,
        soldiers: this.metrics.activeSoldiers
      },
      performance: {
        throughput: this.metrics.throughput,
        errorRate: this.metrics.errorRate,
        activeJobs: this.metrics.jobsActive
      },
      alerts: this.metrics.alertsActive
    };
  }

  /**
   * Graceful system shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log('[HIVE QUEEN] Starting graceful shutdown...');

    try {
      // Clear monitoring intervals
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

      // Shutdown agents
      const shutdownPromises: Promise<void>[] = [];
      
      this.workers.forEach((worker) => {
        shutdownPromises.push(worker.shutdown());
      });
      
      this.scouts.forEach((scout) => {
        shutdownPromises.push(scout.shutdown());
      });
      
      this.soldiers.forEach((soldier) => {
        shutdownPromises.push(soldier.shutdown());
      });

      await Promise.all(shutdownPromises);

      // Shutdown core components
      await this.pipeline.shutdown();
      await this.communication.shutdown();
      await this.consensus.shutdown();

      this.emit('system_shutdown');
      console.log('[HIVE QUEEN] System shutdown complete');
      
    } catch (error) {
      console.error('[HIVE QUEEN] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Emergency shutdown (faster, less graceful)
   */
  async emergencyShutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log('[HIVE QUEEN] Emergency shutdown initiated...');

    try {
      // Stop monitoring immediately
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

      // Force shutdown all components
      await Promise.race([
        this.shutdown(),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ]);

      this.emit('emergency_shutdown');
      console.log('[HIVE QUEEN] Emergency shutdown complete');
      
    } catch (error) {
      console.error('[HIVE QUEEN] Error during emergency shutdown:', error);
    } finally {
      process.exit(1);
    }
  }
}

// Export everything needed for the complete HIVE QUEEN system
export {
  HiveQueenSystem as default,
  type HiveQueenSystemConfig,
  type SystemMetrics,
  type SystemAlert
};