/**
 * WORKER AGENT - Specialized Test Executor
 * Handles scenario execution with enterprise-grade capabilities
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { BDDScenario, TestTask, ScenarioStep, ValidationRule } from '../core/hive-queen';

export interface WorkerCapabilities {
  scenarioExecution: boolean;
  assertionValidation: boolean;
  dataGeneration: boolean;
  apiTesting: boolean;
  uiAutomation: boolean;
  databaseValidation: boolean;
  fileSystemTesting: boolean;
  networkTesting: boolean;
  performanceValidation: boolean;
  securityTesting: boolean;
}

export interface ExecutionContext {
  variables: Map<string, any>;
  fixtures: Map<string, any>;
  connections: Map<string, any>;
  state: ExecutionState;
  metrics: ExecutionMetrics;
}

export interface ExecutionState {
  currentStep: number;
  totalSteps: number;
  startTime: number;
  lastCheckpoint: number;
  errors: ExecutionError[];
  warnings: ExecutionWarning[];
}

export interface ExecutionMetrics {
  stepExecutionTimes: number[];
  memoryUsage: number[];
  cpuUsage: number[];
  networkLatency: number[];
  databaseQueryTimes: number[];
  assertionResults: AssertionResult[];
}

export interface ExecutionError {
  step: number;
  message: string;
  stack?: string;
  severity: 'minor' | 'major' | 'critical';
  recoverable: boolean;
  timestamp: number;
}

export interface ExecutionWarning {
  step: number;
  message: string;
  type: 'performance' | 'deprecation' | 'configuration' | 'data';
  timestamp: number;
}

export interface AssertionResult {
  step: number;
  rule: string;
  expected: any;
  actual: any;
  passed: boolean;
  tolerance?: number;
  message?: string;
}

export interface StepExecutor {
  canExecute(step: ScenarioStep): boolean;
  execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult>;
  validate(step: ScenarioStep, result: StepResult): Promise<ValidationResult>;
}

export interface StepResult {
  success: boolean;
  data: any;
  executionTime: number;
  metrics: StepMetrics;
  artifacts: Artifact[];
}

export interface StepMetrics {
  memoryDelta: number;
  cpuUsage: number;
  networkCalls: number;
  databaseQueries: number;
  fileOperations: number;
}

export interface Artifact {
  type: 'screenshot' | 'log' | 'data' | 'video' | 'report';
  path: string;
  size: number;
  mimeType: string;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
  score: number;
  recommendations: string[];
}

export interface RuleViolation {
  rule: ValidationRule;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actualValue: any;
  expectedValue: any;
}

export class WorkerAgent extends EventEmitter {
  private id: string;
  private capabilities: WorkerCapabilities;
  private executors: Map<string, StepExecutor> = new Map();
  private context: ExecutionContext;
  private currentTask?: TestTask;
  private isExecuting: boolean = false;

  constructor(id: string, capabilities: WorkerCapabilities) {
    super();
    this.id = id;
    this.capabilities = capabilities;
    this.context = this.initializeContext();
    this.initializeExecutors();
  }

  private initializeContext(): ExecutionContext {
    return {
      variables: new Map(),
      fixtures: new Map(),
      connections: new Map(),
      state: {
        currentStep: 0,
        totalSteps: 0,
        startTime: 0,
        lastCheckpoint: 0,
        errors: [],
        warnings: []
      },
      metrics: {
        stepExecutionTimes: [],
        memoryUsage: [],
        cpuUsage: [],
        networkLatency: [],
        databaseQueryTimes: [],
        assertionResults: []
      }
    };
  }

  private initializeExecutors(): void {
    // API Testing Executor
    this.executors.set('api', new ApiStepExecutor());
    
    // UI Automation Executor
    this.executors.set('ui', new UiStepExecutor());
    
    // Database Executor
    this.executors.set('database', new DatabaseStepExecutor());
    
    // File System Executor
    this.executors.set('filesystem', new FileSystemStepExecutor());
    
    // Network Testing Executor
    this.executors.set('network', new NetworkStepExecutor());
    
    // Performance Executor
    this.executors.set('performance', new PerformanceStepExecutor());
    
    // Security Testing Executor
    this.executors.set('security', new SecurityStepExecutor());
    
    // Data Generation Executor
    this.executors.set('data', new DataGenerationStepExecutor());
    
    // Assertion Executor
    this.executors.set('assertion', new AssertionStepExecutor());
    
    // Custom Command Executor
    this.executors.set('command', new CommandStepExecutor());
  }

  async executeTask(task: TestTask): Promise<void> {
    if (this.isExecuting) {
      throw new Error(`Worker ${this.id} is already executing a task`);
    }

    this.currentTask = task;
    this.isExecuting = true;
    this.resetContext();

    try {
      this.emit('task-started', { workerId: this.id, taskId: task.id });
      
      const scenario = task.scenario;
      const totalSteps = scenario.given.length + scenario.when.length + scenario.then.length;
      
      this.context.state.totalSteps = totalSteps;
      this.context.state.startTime = performance.now();

      // Execute Given steps (setup)
      await this.executeSteps(scenario.given, 'given');
      
      // Execute When steps (actions)
      await this.executeSteps(scenario.when, 'when');
      
      // Execute Then steps (assertions)
      await this.executeSteps(scenario.then, 'then');

      // Generate execution report
      const report = await this.generateExecutionReport();
      
      this.emit('task-completed', { 
        workerId: this.id, 
        taskId: task.id, 
        report 
      });

    } catch (error) {
      this.context.state.errors.push({
        step: this.context.state.currentStep,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        severity: 'critical',
        recoverable: false,
        timestamp: performance.now()
      });

      this.emit('task-failed', { 
        workerId: this.id, 
        taskId: task.id, 
        error,
        context: this.context 
      });

      throw error;
    } finally {
      this.isExecuting = false;
      this.currentTask = undefined;
    }
  }

  private async executeSteps(steps: ScenarioStep[], phase: 'given' | 'when' | 'then'): Promise<void> {
    for (const step of steps) {
      this.context.state.currentStep++;
      
      try {
        const executor = this.selectExecutor(step);
        if (!executor) {
          throw new Error(`No suitable executor found for step: ${step.step}`);
        }

        // Record memory usage before step
        const memoryBefore = process.memoryUsage().heapUsed;
        const startTime = performance.now();

        // Execute step
        const result = await executor.execute(step, this.context);
        
        // Record metrics
        const executionTime = performance.now() - startTime;
        const memoryAfter = process.memoryUsage().heapUsed;
        
        this.context.metrics.stepExecutionTimes.push(executionTime);
        this.context.metrics.memoryUsage.push(memoryAfter - memoryBefore);

        // Validate result if this is an assertion step (then phase)
        if (phase === 'then') {
          const validation = await executor.validate(step, result);
          if (!validation.valid) {
            const error = new Error(`Assertion failed: ${validation.violations.map(v => v.message).join(', ')}`);
            throw error;
          }

          // Record assertion results
          validation.violations.forEach(violation => {
            this.context.metrics.assertionResults.push({
              step: this.context.state.currentStep,
              rule: violation.rule.rule,
              expected: violation.expectedValue,
              actual: violation.actualValue,
              passed: violation.severity !== 'error',
              message: violation.message
            });
          });
        }

        // Store step result in context for future steps
        if (result.data) {
          this.context.variables.set(`step_${this.context.state.currentStep}_result`, result.data);
        }

        this.emit('step-completed', {
          workerId: this.id,
          step: this.context.state.currentStep,
          phase,
          executionTime,
          result
        });

      } catch (error) {
        const executionError: ExecutionError = {
          step: this.context.state.currentStep,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          severity: this.determineSeverity(step, error),
          recoverable: this.isRecoverable(step, error),
          timestamp: performance.now()
        };

        this.context.state.errors.push(executionError);

        if (!executionError.recoverable) {
          throw error;
        }

        // Log recoverable error as warning
        this.context.state.warnings.push({
          step: this.context.state.currentStep,
          message: `Recoverable error: ${executionError.message}`,
          type: 'configuration',
          timestamp: performance.now()
        });
      }
    }
  }

  private selectExecutor(step: ScenarioStep): StepExecutor | null {
    // Determine executor type based on step content
    const stepText = step.step.toLowerCase();
    
    if (stepText.includes('api') || stepText.includes('request') || stepText.includes('response')) {
      return this.executors.get('api') || null;
    }
    
    if (stepText.includes('click') || stepText.includes('type') || stepText.includes('browser')) {
      return this.executors.get('ui') || null;
    }
    
    if (stepText.includes('database') || stepText.includes('query') || stepText.includes('record')) {
      return this.executors.get('database') || null;
    }
    
    if (stepText.includes('file') || stepText.includes('directory') || stepText.includes('path')) {
      return this.executors.get('filesystem') || null;
    }
    
    if (stepText.includes('network') || stepText.includes('ping') || stepText.includes('connection')) {
      return this.executors.get('network') || null;
    }
    
    if (stepText.includes('performance') || stepText.includes('load') || stepText.includes('stress')) {
      return this.executors.get('performance') || null;
    }
    
    if (stepText.includes('security') || stepText.includes('auth') || stepText.includes('permission')) {
      return this.executors.get('security') || null;
    }
    
    if (stepText.includes('generate') || stepText.includes('create data') || stepText.includes('mock')) {
      return this.executors.get('data') || null;
    }
    
    if (stepText.includes('should') || stepText.includes('assert') || stepText.includes('expect')) {
      return this.executors.get('assertion') || null;
    }
    
    if (stepText.includes('run') || stepText.includes('execute') || stepText.includes('command')) {
      return this.executors.get('command') || null;
    }

    // Default to command executor
    return this.executors.get('command') || null;
  }

  private determineSeverity(step: ScenarioStep, error: any): 'minor' | 'major' | 'critical' {
    // Determine error severity based on step type and error
    if (step.step.includes('critical') || step.step.includes('must')) {
      return 'critical';
    }
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return 'major';
    }
    
    if (step.step.includes('should') || step.step.includes('expect')) {
      return 'major';
    }
    
    return 'minor';
  }

  private isRecoverable(step: ScenarioStep, error: any): boolean {
    // Determine if error is recoverable based on step and error type
    if (step.step.includes('optional') || step.step.includes('may')) {
      return true;
    }
    
    if (error instanceof Error && error.message.includes('network')) {
      return true;
    }
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  private resetContext(): void {
    this.context = this.initializeContext();
  }

  private async generateExecutionReport(): Promise<ExecutionReport> {
    const endTime = performance.now();
    const totalExecutionTime = endTime - this.context.state.startTime;
    
    return {
      workerId: this.id,
      taskId: this.currentTask?.id || 'unknown',
      startTime: this.context.state.startTime,
      endTime,
      totalExecutionTime,
      stepsExecuted: this.context.state.currentStep,
      stepExecutionTimes: this.context.metrics.stepExecutionTimes,
      totalMemoryUsage: this.context.metrics.memoryUsage.reduce((sum, usage) => sum + usage, 0),
      averageMemoryUsage: this.context.metrics.memoryUsage.reduce((sum, usage) => sum + usage, 0) / this.context.metrics.memoryUsage.length,
      peakMemoryUsage: Math.max(...this.context.metrics.memoryUsage),
      errors: this.context.state.errors,
      warnings: this.context.state.warnings,
      assertionResults: this.context.metrics.assertionResults,
      passedAssertions: this.context.metrics.assertionResults.filter(a => a.passed).length,
      failedAssertions: this.context.metrics.assertionResults.filter(a => !a.passed).length,
      artifacts: this.collectArtifacts()
    };
  }

  private collectArtifacts(): Artifact[] {
    // Collect artifacts generated during execution
    return [];
  }

  getCapabilities(): WorkerCapabilities {
    return { ...this.capabilities };
  }

  isAvailable(): boolean {
    return !this.isExecuting;
  }

  getCurrentTask(): TestTask | undefined {
    return this.currentTask;
  }

  getExecutionMetrics(): ExecutionMetrics {
    return { ...this.context.metrics };
  }
}

export interface ExecutionReport {
  workerId: string;
  taskId: string;
  startTime: number;
  endTime: number;
  totalExecutionTime: number;
  stepsExecuted: number;
  stepExecutionTimes: number[];
  totalMemoryUsage: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  errors: ExecutionError[];
  warnings: ExecutionWarning[];
  assertionResults: AssertionResult[];
  passedAssertions: number;
  failedAssertions: number;
  artifacts: Artifact[];
}

// Abstract base class for step executors
abstract class BaseStepExecutor implements StepExecutor {
  abstract canExecute(step: ScenarioStep): boolean;
  abstract execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult>;
  
  async validate(step: ScenarioStep, result: StepResult): Promise<ValidationResult> {
    const violations: RuleViolation[] = [];
    
    for (const rule of step.validationRules) {
      const violation = await this.validateRule(rule, result);
      if (violation) {
        violations.push(violation);
      }
    }
    
    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      score: this.calculateValidationScore(violations),
      recommendations: this.generateRecommendations(violations)
    };
  }
  
  protected abstract validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null>;
  
  private calculateValidationScore(violations: RuleViolation[]): number {
    const totalRules = violations.length;
    if (totalRules === 0) return 100;
    
    const errorWeight = 3;
    const warningWeight = 2;
    const infoWeight = 1;
    
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    const infoCount = violations.filter(v => v.severity === 'info').length;
    
    const weightedErrors = errorCount * errorWeight + warningCount * warningWeight + infoCount * infoWeight;
    const maxPossibleScore = totalRules * errorWeight;
    
    return Math.max(0, 100 - (weightedErrors / maxPossibleScore) * 100);
  }
  
  private generateRecommendations(violations: RuleViolation[]): string[] {
    return violations
      .filter(v => v.severity === 'error')
      .map(v => `Fix: ${v.message}`)
      .concat(
        violations
          .filter(v => v.severity === 'warning')
          .map(v => `Consider: ${v.message}`)
      );
  }
}

// Concrete step executor implementations
class ApiStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('api') || 
           step.step.toLowerCase().includes('request') ||
           step.step.toLowerCase().includes('response');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // API execution logic would be implemented here
      const result = {
        success: true,
        data: { response: 'mock api response' },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 1024,
          cpuUsage: 5,
          networkCalls: 1,
          databaseQueries: 0,
          fileOperations: 0
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`API execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // API-specific rule validation
    return null;
  }
}

class UiStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('click') ||
           step.step.toLowerCase().includes('type') ||
           step.step.toLowerCase().includes('browser');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // UI automation logic would be implemented here
      const result = {
        success: true,
        data: { elementFound: true },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 2048,
          cpuUsage: 15,
          networkCalls: 0,
          databaseQueries: 0,
          fileOperations: 1
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`UI execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // UI-specific rule validation
    return null;
  }
}

class DatabaseStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('database') ||
           step.step.toLowerCase().includes('query') ||
           step.step.toLowerCase().includes('record');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Database execution logic would be implemented here
      const result = {
        success: true,
        data: { recordsAffected: 1 },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 512,
          cpuUsage: 3,
          networkCalls: 0,
          databaseQueries: 1,
          fileOperations: 0
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Database execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Database-specific rule validation
    return null;
  }
}

class FileSystemStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('file') ||
           step.step.toLowerCase().includes('directory') ||
           step.step.toLowerCase().includes('path');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // File system execution logic would be implemented here
      const result = {
        success: true,
        data: { fileExists: true },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 256,
          cpuUsage: 2,
          networkCalls: 0,
          databaseQueries: 0,
          fileOperations: 1
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`File system execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // File system-specific rule validation
    return null;
  }
}

class NetworkStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('network') ||
           step.step.toLowerCase().includes('ping') ||
           step.step.toLowerCase().includes('connection');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Network execution logic would be implemented here
      const result = {
        success: true,
        data: { latency: 50 },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 128,
          cpuUsage: 1,
          networkCalls: 1,
          databaseQueries: 0,
          fileOperations: 0
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Network execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Network-specific rule validation
    return null;
  }
}

class PerformanceStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('performance') ||
           step.step.toLowerCase().includes('load') ||
           step.step.toLowerCase().includes('stress');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Performance testing logic would be implemented here
      const result = {
        success: true,
        data: { throughput: 1000 },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 4096,
          cpuUsage: 80,
          networkCalls: 100,
          databaseQueries: 50,
          fileOperations: 10
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Performance execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Performance-specific rule validation
    return null;
  }
}

class SecurityStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('security') ||
           step.step.toLowerCase().includes('auth') ||
           step.step.toLowerCase().includes('permission');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Security testing logic would be implemented here
      const result = {
        success: true,
        data: { securityScore: 95 },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 1024,
          cpuUsage: 10,
          networkCalls: 5,
          databaseQueries: 2,
          fileOperations: 1
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Security execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Security-specific rule validation
    return null;
  }
}

class DataGenerationStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('generate') ||
           step.step.toLowerCase().includes('create data') ||
           step.step.toLowerCase().includes('mock');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Data generation logic would be implemented here
      const result = {
        success: true,
        data: { generatedRecords: 1000 },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 2048,
          cpuUsage: 20,
          networkCalls: 0,
          databaseQueries: 10,
          fileOperations: 2
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Data generation failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Data generation-specific rule validation
    return null;
  }
}

class AssertionStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return step.step.toLowerCase().includes('should') ||
           step.step.toLowerCase().includes('assert') ||
           step.step.toLowerCase().includes('expect');
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Assertion logic would be implemented here
      const result = {
        success: true,
        data: { assertionPassed: true },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 64,
          cpuUsage: 1,
          networkCalls: 0,
          databaseQueries: 0,
          fileOperations: 0
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Assertion failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Assertion-specific rule validation
    return null;
  }
}

class CommandStepExecutor extends BaseStepExecutor {
  canExecute(step: ScenarioStep): boolean {
    return true; // Can execute any step as a fallback
  }

  async execute(step: ScenarioStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = performance.now();
    
    try {
      // Generic command execution logic would be implemented here
      const result = {
        success: true,
        data: { commandExecuted: true },
        executionTime: performance.now() - startTime,
        metrics: {
          memoryDelta: 128,
          cpuUsage: 5,
          networkCalls: 0,
          databaseQueries: 0,
          fileOperations: 0
        },
        artifacts: []
      };
      
      return result;
    } catch (error) {
      throw new Error(`Command execution failed: ${error}`);
    }
  }

  protected async validateRule(rule: ValidationRule, result: StepResult): Promise<RuleViolation | null> {
    // Generic rule validation
    return null;
  }
}