/**
 * Main Test Orchestrator
 * Coordinates all AI components for comprehensive test management
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';
import { AITestGenerator } from '../models/test-generator.js';
import { AdaptiveExecutor } from '../engines/adaptive-executor.js';
import { CognitiveAnalyzer } from '../analysis/cognitive-analyzer.js';
import { SwarmCoordinator } from '../swarm/coordinator.js';
import { EnterpriseIntegration } from '../enterprise/integration.js';
import { TestSuite, TestScenario, TestResult } from '../types/test-types.js';

export interface OrchestratorConfig {
  testGenerator: AITestGenerator;
  executor: AdaptiveExecutor;
  analyzer: CognitiveAnalyzer;
  swarmCoordinator: SwarmCoordinator;
  enterpriseIntegration: EnterpriseIntegration;
}

export class TestOrchestrator extends EventEmitter {
  private testGenerator: AITestGenerator;
  private executor: AdaptiveExecutor;
  private analyzer: CognitiveAnalyzer;
  private swarmCoordinator: SwarmCoordinator;
  private enterpriseIntegration: EnterpriseIntegration;
  private logger: Logger;
  private activeExecutions: Map<string, ExecutionSession> = new Map();
  private metrics: OrchestratorMetrics;

  constructor(config: OrchestratorConfig) {
    super();
    this.testGenerator = config.testGenerator;
    this.executor = config.executor;
    this.analyzer = config.analyzer;
    this.swarmCoordinator = config.swarmCoordinator;
    this.enterpriseIntegration = config.enterpriseIntegration;
    this.logger = new Logger('TestOrchestrator');
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      testsGenerated: 0,
      testsExecuted: 0,
      averageExecutionTime: 0,
      systemHealth: 100,
      lastHealthCheck: new Date()
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Test Orchestrator');
    
    // Initialize all components in parallel
    await Promise.all([
      this.testGenerator.initialize(),
      this.executor.initialize(),
      this.analyzer.initialize(),
      this.swarmCoordinator.initialize(),
      this.enterpriseIntegration.initialize()
    ]);

    // Set up component event handlers
    this.setupEventHandlers();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.logger.info('Test Orchestrator initialized successfully');
  }

  private setupEventHandlers(): void {
    // Swarm events
    this.swarmCoordinator.on('task_completed', this.handleSwarmTaskCompleted.bind(this));
    this.swarmCoordinator.on('task_failed', this.handleSwarmTaskFailed.bind(this));
    this.swarmCoordinator.on('metrics_updated', this.handleSwarmMetricsUpdate.bind(this));

    // Enterprise events
    this.enterpriseIntegration.on('test_orchestration_request', this.handleOrchestrationRequest.bind(this));

    // Internal event forwarding
    this.on('test_execution_completed', this.handleTestExecutionCompleted.bind(this));
    this.on('test_execution_failed', this.handleTestExecutionFailed.bind(this));
  }

  private handleSwarmTaskCompleted(event: any): void {
    this.logger.info(`Swarm task completed: ${event.taskId}`);
    this.emit('swarm_task_completed', event);
  }

  private handleSwarmTaskFailed(event: any): void {
    this.logger.error(`Swarm task failed: ${event.taskId}`);
    this.emit('swarm_task_failed', event);
  }

  private handleSwarmMetricsUpdate(metrics: any): void {
    this.updateSystemHealth(metrics);
  }

  private async handleOrchestrationRequest(request: any): Promise<void> {
    this.logger.info(`Orchestration request received for pipeline: ${request.pipelineId}`);
    
    try {
      // Create execution session
      const sessionId = await this.createExecutionSession(request);
      
      // Execute the orchestration workflow
      await this.executeOrchestrationWorkflow(sessionId, request);
      
    } catch (error) {
      this.logger.error('Orchestration request failed:', error);
    }
  }

  async orchestrateFullWorkflow(userStory: string, options: OrchestrationOptions = {}): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.info(`Starting full workflow orchestration: ${sessionId}`);

    const session: ExecutionSession = {
      id: sessionId,
      status: 'running',
      startTime: new Date(),
      userStory,
      options,
      phases: {
        generation: { status: 'pending', startTime: new Date() },
        execution: { status: 'pending' },
        analysis: { status: 'pending' },
        reporting: { status: 'pending' }
      },
      results: {}
    };

    this.activeExecutions.set(sessionId, session);

    try {
      // Phase 1: AI Test Generation
      await this.executeGenerationPhase(session);
      
      // Phase 2: Distributed Test Execution via Swarm
      await this.executeDistributedTestPhase(session);
      
      // Phase 3: Cognitive Analysis
      await this.executeAnalysisPhase(session);
      
      // Phase 4: Enterprise Reporting
      await this.executeReportingPhase(session);
      
      session.status = 'completed';
      session.endTime = new Date();
      
      this.metrics.totalExecutions++;
      this.metrics.successfulExecutions++;
      
      this.logger.info(`Workflow orchestration completed: ${sessionId}`);
      this.emit('orchestration_completed', { sessionId, session });
      
      return sessionId;
      
    } catch (error) {
      session.status = 'failed';
      session.error = (error as Error).message;
      session.endTime = new Date();
      
      this.metrics.totalExecutions++;
      this.metrics.failedExecutions++;
      
      this.logger.error(`Workflow orchestration failed: ${sessionId}`, error);
      this.emit('orchestration_failed', { sessionId, error });
      
      throw error;
    }
  }

  private async executeGenerationPhase(session: ExecutionSession): Promise<void> {
    this.logger.info(`Starting generation phase for session: ${session.id}`);
    session.phases.generation.status = 'running';
    session.phases.generation.startTime = new Date();

    try {
      // Generate test scenarios using AI
      const testScenarios = await this.testGenerator.generateFromUserStory(session.userStory);
      
      // Create test suite
      const testSuite: TestSuite = {
        id: `suite_${session.id}`,
        name: `AI Generated Test Suite for ${session.id}`,
        description: `Comprehensive test suite generated from user story`,
        tests: testScenarios,
        configuration: {
          parallel: session.options.parallel ?? true,
          maxConcurrency: session.options.maxConcurrency ?? 5,
          timeout: session.options.timeout ?? 300000,
          retryPolicy: {
            enabled: true,
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2,
            retryableErrors: ['timeout', 'network', 'infrastructure']
          }
        },
        tags: ['ai-generated', 'orchestrated'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      session.results.testSuite = testSuite;
      session.phases.generation.status = 'completed';
      session.phases.generation.endTime = new Date();
      
      this.metrics.testsGenerated += testScenarios.length;
      
      this.logger.info(`Generation phase completed: ${testScenarios.length} tests generated`);
      
    } catch (error) {
      session.phases.generation.status = 'failed';
      session.phases.generation.error = (error as Error).message;
      session.phases.generation.endTime = new Date();
      throw error;
    }
  }

  private async executeDistributedTestPhase(session: ExecutionSession): Promise<void> {
    this.logger.info(`Starting distributed execution phase for session: ${session.id}`);
    session.phases.execution.status = 'running';
    session.phases.execution.startTime = new Date();

    try {
      const testSuite = session.results.testSuite;
      if (!testSuite) {
        throw new Error('No test suite available for execution');
      }

      // Option 1: Use swarm for distributed execution
      if (session.options.useSwarm) {
        const testResults = await this.executeTestsViaSwarm(testSuite, session);
        session.results.testResults = testResults;
      } 
      // Option 2: Use adaptive executor
      else {
        const testResults = await this.executor.executeTestSuite(testSuite);
        session.results.testResults = testResults;
      }

      session.phases.execution.status = 'completed';
      session.phases.execution.endTime = new Date();
      
      this.metrics.testsExecuted += session.results.testResults.length;
      
      this.logger.info(`Execution phase completed: ${session.results.testResults.length} tests executed`);
      
    } catch (error) {
      session.phases.execution.status = 'failed';
      session.phases.execution.error = (error as Error).message;
      session.phases.execution.endTime = new Date();
      throw error;
    }
  }

  private async executeTestsViaSwarm(testSuite: TestSuite, session: ExecutionSession): Promise<TestResult[]> {
    this.logger.info(`Executing tests via swarm for session: ${session.id}`);
    
    // Convert test scenarios to swarm tasks
    const swarmTasks = testSuite.tests.map(test => ({
      id: `task_${test.id}`,
      type: 'test_execution',
      data: {
        testScenario: test,
        configuration: testSuite.configuration
      },
      requiredCapabilities: this.determineRequiredCapabilities(test),
      priority: test.priority as any,
      status: 'pending' as any,
      assignedNode: undefined,
      attempts: 0,
      maxAttempts: testSuite.configuration.retryPolicy.maxAttempts,
      createdAt: new Date(),
      requirements: {
        minPerformance: 0.8,
        maxLatency: 5000
      }
    }));

    // Distribute tasks to swarm
    const distributionPromises = swarmTasks.map(task => 
      this.swarmCoordinator.distributeTask(task)
    );
    
    await Promise.all(distributionPromises);

    // Wait for all tasks to complete
    const testResults = await this.waitForSwarmTasksCompletion(swarmTasks.map(t => t.id));
    
    return testResults;
  }

  private determineRequiredCapabilities(test: TestScenario): string[] {
    const capabilities: string[] = [];
    
    if (test.type.includes('performance')) {
      capabilities.push('performance_testing');
    }
    if (test.type.includes('security')) {
      capabilities.push('security_testing');
    }
    if (test.steps.some(step => step.includes('browser') || step.includes('click'))) {
      capabilities.push('ui_testing');
    }
    if (test.steps.some(step => step.includes('api') || step.includes('http'))) {
      capabilities.push('api_testing');
    }
    
    capabilities.push('test_execution'); // Always required
    
    return capabilities;
  }

  private async waitForSwarmTasksCompletion(taskIds: string[]): Promise<TestResult[]> {
    return new Promise((resolve, reject) => {
      const completedTasks: TestResult[] = [];
      const timeout = setTimeout(() => {
        reject(new Error('Swarm task execution timeout'));
      }, 600000); // 10 minutes timeout

      const checkCompletion = () => {
        if (completedTasks.length === taskIds.length) {
          clearTimeout(timeout);
          resolve(completedTasks);
        }
      };

      this.swarmCoordinator.on('task_completed', (event) => {
        if (taskIds.includes(event.taskId)) {
          // Convert swarm task result to test result
          const testResult: TestResult = {
            testId: event.result.testId || event.taskId,
            status: event.result.success ? 'passed' : 'failed',
            startTime: event.result.startTime || new Date(),
            endTime: event.result.endTime || new Date(),
            duration: event.result.duration || 0,
            error: event.result.error,
            logs: event.result.logs || [],
            performance: event.result.performance
          };
          
          completedTasks.push(testResult);
          checkCompletion();
        }
      });

      this.swarmCoordinator.on('task_failed', (event) => {
        if (taskIds.includes(event.taskId)) {
          const testResult: TestResult = {
            testId: event.taskId,
            status: 'failed',
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            error: event.error || 'Swarm task failed',
            logs: []
          };
          
          completedTasks.push(testResult);
          checkCompletion();
        }
      });
    });
  }

  private async executeAnalysisPhase(session: ExecutionSession): Promise<void> {
    this.logger.info(`Starting analysis phase for session: ${session.id}`);
    session.phases.analysis.status = 'running';
    session.phases.analysis.startTime = new Date();

    try {
      const testResults = session.results.testResults;
      if (!testResults) {
        throw new Error('No test results available for analysis');
      }

      // Perform cognitive analysis
      const analysisResult = await this.analyzer.analyzeTestResults(testResults);
      session.results.analysis = analysisResult;

      session.phases.analysis.status = 'completed';
      session.phases.analysis.endTime = new Date();
      
      this.logger.info(`Analysis phase completed: ${analysisResult.predictions.length} insights generated`);
      
    } catch (error) {
      session.phases.analysis.status = 'failed';
      session.phases.analysis.error = (error as Error).message;
      session.phases.analysis.endTime = new Date();
      throw error;
    }
  }

  private async executeReportingPhase(session: ExecutionSession): Promise<void> {
    this.logger.info(`Starting reporting phase for session: ${session.id}`);
    session.phases.reporting.status = 'running';
    session.phases.reporting.startTime = new Date();

    try {
      // Send notifications about test results
      if (session.results.testResults) {
        await this.enterpriseIntegration.sendTestNotifications(session.results.testResults);
      }

      // Generate compliance report if requested
      if (session.options.generateComplianceReport) {
        const complianceReport = await this.enterpriseIntegration.generateComplianceReport();
        session.results.complianceReport = complianceReport;
      }

      // Create comprehensive execution report
      const executionReport = this.generateExecutionReport(session);
      session.results.executionReport = executionReport;

      session.phases.reporting.status = 'completed';
      session.phases.reporting.endTime = new Date();
      
      this.logger.info(`Reporting phase completed`);
      
    } catch (error) {
      session.phases.reporting.status = 'failed';
      session.phases.reporting.error = (error as Error).message;
      session.phases.reporting.endTime = new Date();
      throw error;
    }
  }

  private generateExecutionReport(session: ExecutionSession): ExecutionReport {
    const testResults = session.results.testResults || [];
    const analysis = session.results.analysis;
    
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.status === 'passed').length;
    const failedTests = testResults.filter(r => r.status === 'failed').length;
    
    return {
      sessionId: session.id,
      userStory: session.userStory,
      executionTime: session.endTime && session.startTime 
        ? session.endTime.getTime() - session.startTime.getTime() 
        : 0,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageDuration: totalTests > 0 
          ? testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests 
          : 0
      },
      phases: session.phases,
      insights: analysis?.predictions || [],
      recommendations: analysis?.recommendations || [],
      qualityScore: analysis?.qualityMetrics?.qualityScore || 0,
      generatedAt: new Date()
    };
  }

  async createExecutionSession(request: any): Promise<string> {
    const sessionId = `session_${request.pipelineId}_${Date.now()}`;
    
    const session: ExecutionSession = {
      id: sessionId,
      status: 'pending',
      startTime: new Date(),
      userStory: request.userStory || 'Pipeline triggered execution',
      options: {
        useSwarm: true,
        parallel: true,
        maxConcurrency: 10,
        generateComplianceReport: false
      },
      phases: {
        generation: { status: 'pending' },
        execution: { status: 'pending' },
        analysis: { status: 'pending' },
        reporting: { status: 'pending' }
      },
      results: {},
      pipelineContext: request
    };

    this.activeExecutions.set(sessionId, session);
    return sessionId;
  }

  async executeOrchestrationWorkflow(sessionId: string, request: any): Promise<void> {
    const session = this.activeExecutions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Use the full workflow orchestration
    await this.orchestrateFullWorkflow(session.userStory, session.options);
  }

  private handleTestExecutionCompleted(event: any): void {
    this.updateMetrics(event);
  }

  private handleTestExecutionFailed(event: any): void {
    this.updateMetrics(event);
  }

  private updateMetrics(event: any): void {
    // Update orchestrator metrics based on execution events
    if (event.duration) {
      const currentAvg = this.metrics.averageExecutionTime;
      const executions = this.metrics.totalExecutions;
      this.metrics.averageExecutionTime = 
        (currentAvg * executions + event.duration) / (executions + 1);
    }
  }

  private updateSystemHealth(swarmMetrics: any): void {
    // Calculate system health based on various metrics
    let healthScore = 100;
    
    // Deduct for high failure rate
    if (swarmMetrics.averageSuccessRate < 0.9) {
      healthScore -= (0.9 - swarmMetrics.averageSuccessRate) * 100;
    }
    
    // Deduct for high load
    if (swarmMetrics.averageLoad > 8) {
      healthScore -= (swarmMetrics.averageLoad - 8) * 5;
    }
    
    // Deduct for disconnected nodes
    if (swarmMetrics.nodeCount === 0) {
      healthScore -= 50;
    }
    
    this.metrics.systemHealth = Math.max(0, healthScore);
    this.metrics.lastHealthCheck = new Date();
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check component health
      const componentHealth = await Promise.allSettled([
        this.checkComponentHealth('testGenerator'),
        this.checkComponentHealth('executor'),
        this.checkComponentHealth('analyzer'),
        this.checkComponentHealth('swarmCoordinator'),
        this.checkComponentHealth('enterpriseIntegration')
      ]);

      const healthyComponents = componentHealth.filter(c => c.status === 'fulfilled').length;
      const healthPercentage = (healthyComponents / componentHealth.length) * 100;

      this.metrics.systemHealth = Math.min(this.metrics.systemHealth, healthPercentage);
      this.metrics.lastHealthCheck = new Date();

      if (this.metrics.systemHealth < 50) {
        this.logger.warn(`System health critical: ${this.metrics.systemHealth}%`);
        this.emit('health_alert', { level: 'critical', health: this.metrics.systemHealth });
      } else if (this.metrics.systemHealth < 80) {
        this.logger.warn(`System health degraded: ${this.metrics.systemHealth}%`);
        this.emit('health_alert', { level: 'warning', health: this.metrics.systemHealth });
      }

    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  private async checkComponentHealth(componentName: string): Promise<boolean> {
    // Implement component-specific health checks
    switch (componentName) {
      case 'testGenerator':
        return this.testGenerator !== null;
      case 'executor':
        return this.executor !== null;
      case 'analyzer':
        return this.analyzer !== null;
      case 'swarmCoordinator':
        return this.swarmCoordinator !== null;
      case 'enterpriseIntegration':
        return this.enterpriseIntegration !== null;
      default:
        return false;
    }
  }

  async getExecutionSession(sessionId: string): Promise<ExecutionSession | null> {
    return this.activeExecutions.get(sessionId) || null;
  }

  async getSystemMetrics(): Promise<any> {
    const swarmStatus = await this.swarmCoordinator.getSwarmStatus();
    const executorStats = await this.executor.getResourceUsage();

    return {
      orchestrator: this.metrics,
      swarm: swarmStatus.metrics,
      executor: executorStats,
      activeExecutions: this.activeExecutions.size,
      timestamp: new Date()
    };
  }

  async start(): Promise<void> {
    this.logger.info('Starting Test Orchestrator');
    // All initialization is done in initialize()
    this.emit('orchestrator_started');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Test Orchestrator');
    
    // Stop all active executions
    for (const [sessionId, session] of this.activeExecutions) {
      if (session.status === 'running') {
        session.status = 'cancelled';
        session.endTime = new Date();
      }
    }
    
    // Shutdown components
    await Promise.all([
      this.executor.shutdown(),
      this.swarmCoordinator.shutdown(),
      this.enterpriseIntegration.shutdown()
    ]);
    
    this.emit('orchestrator_stopped');
    this.logger.info('Test Orchestrator stopped');
  }
}

interface ExecutionSession {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  userStory: string;
  options: OrchestrationOptions;
  phases: {
    generation: PhaseStatus;
    execution: PhaseStatus;
    analysis: PhaseStatus;
    reporting: PhaseStatus;
  };
  results: {
    testSuite?: TestSuite;
    testResults?: TestResult[];
    analysis?: any;
    complianceReport?: any;
    executionReport?: ExecutionReport;
  };
  error?: string;
  pipelineContext?: any;
}

interface PhaseStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

interface OrchestrationOptions {
  useSwarm?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  generateComplianceReport?: boolean;
  notificationChannels?: string[];
  retryPolicy?: any;
}

interface OrchestratorMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  testsGenerated: number;
  testsExecuted: number;
  averageExecutionTime: number;
  systemHealth: number;
  lastHealthCheck: Date;
}

interface ExecutionReport {
  sessionId: string;
  userStory: string;
  executionTime: number;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    averageDuration: number;
  };
  phases: any;
  insights: any[];
  recommendations: string[];
  qualityScore: number;
  generatedAt: Date;
}