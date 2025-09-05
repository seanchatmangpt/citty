import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  Workflow,
  WorkflowStep,
  UnifiedRequest,
  UnifiedResponse,
  SystemType,
  WorkflowSchema,
  CrossSystemWorkflow
} from '../types/orchestration';
import { UnifiedAPIGateway } from '../gateway/api-gateway';
import { Logger } from '../monitoring/logger';
import { MetricsCollector } from '../monitoring/metrics-collector';

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  startTime: Date;
  endTime?: Date;
  context: Record<string, any>;
  results: Record<string, any>;
  errors: Array<{
    step: number;
    error: string;
    timestamp: Date;
  }>;
  metadata: {
    userId?: string;
    sessionId?: string;
    traceId: string;
  };
}

interface StepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  input: any;
  output?: any;
  error?: string;
  retryCount: number;
}

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private gateway: UnifiedAPIGateway;
  private logger: Logger;
  private metrics: MetricsCollector;
  private isRunning: boolean = false;

  constructor(gateway: UnifiedAPIGateway, metricsCollector?: MetricsCollector) {
    super();
    this.gateway = gateway;
    this.logger = new Logger('info');
    this.metrics = metricsCollector || new MetricsCollector({ enabled: true, metricsInterval: 60000, logLevel: 'info' });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.setupDefaultWorkflows();
    this.logger.info('Workflow engine started');
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Cancel running executions
    for (const execution of this.executions.values()) {
      if (execution.status === 'running') {
        await this.cancelExecution(execution.id);
      }
    }

    this.isRunning = false;
    this.logger.info('Workflow engine stopped');
    this.emit('stopped');
  }

  private setupDefaultWorkflows(): void {
    // CNS → ByteStar → Marketplace workflow
    this.registerWorkflow({
      id: 'validate-enhance-execute',
      name: 'Validate, Enhance, and Execute',
      description: 'Full pipeline: CNS validation → ByteStar AI enhancement → Marketplace execution',
      version: '1.0.0',
      steps: [
        {
          id: 'cns-validation',
          name: 'CNS UHFT Validation',
          type: 'cns-validate',
          system: 'cns',
          operation: 'cns.validate-uhft',
          input: {
            source: 'workflow',
            mapping: { 'data': '{{workflow.input.data}}' }
          },
          output: {
            mapping: { 'validation': '{{step.response.data}}' },
            persist: true
          },
          timeout: 30000
        },
        {
          id: 'conditional-proceed',
          name: 'Check Validation Result',
          type: 'conditional',
          operation: 'conditional.check',
          input: {
            source: 'previous',
            mapping: { 'validation': '{{previous.validation}}' }
          },
          output: {
            mapping: { 'proceed': '{{step.result}}' },
            persist: false
          },
          conditions: [
            {
              field: 'validation.valid',
              operator: 'eq',
              value: true
            }
          ],
          timeout: 1000
        },
        {
          id: 'bytestar-enhancement',
          name: 'ByteStar AI Enhancement',
          type: 'bytestar-enhance',
          system: 'bytestar',
          operation: 'bytestar.ai-enhance',
          input: {
            source: 'workflow',
            mapping: { 
              'data': '{{workflow.input.data}}',
              'validationResult': '{{steps.cns-validation.validation}}'
            }
          },
          output: {
            mapping: { 'enhanced': '{{step.response.data}}' },
            persist: true
          },
          timeout: 60000
        },
        {
          id: 'marketplace-execution',
          name: 'Marketplace Operation',
          type: 'marketplace-execute',
          system: 'marketplace',
          operation: 'marketplace.search',
          input: {
            source: 'previous',
            mapping: {
              'query': '{{steps.bytestar-enhancement.enhanced.optimizedQuery}}',
              'filters': '{{workflow.input.filters}}'
            }
          },
          output: {
            mapping: { 'results': '{{step.response.data}}' },
            persist: true
          },
          timeout: 30000
        }
      ],
      triggers: [
        {
          type: 'api',
          config: { path: '/workflows/validate-enhance-execute' }
        }
      ],
      variables: {},
      metadata: {
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['cns', 'bytestar', 'marketplace', 'full-pipeline'],
        category: 'cross-system'
      },
      status: 'active'
    });

    // Semantic → AI → Marketplace workflow
    this.registerWorkflow({
      id: 'semantic-ai-marketplace',
      name: 'Semantic Analysis to Marketplace',
      description: 'CNS semantic parsing → ByteStar AI processing → Marketplace operations',
      version: '1.0.0',
      steps: [
        {
          id: 'semantic-parsing',
          name: 'CNS Semantic Analysis',
          type: 'cns-validate',
          system: 'cns',
          operation: 'cns.semantic-parse',
          input: {
            source: 'workflow',
            mapping: { 'text': '{{workflow.input.query}}' }
          },
          output: {
            mapping: { 'semantics': '{{step.response.data}}' },
            persist: true
          },
          timeout: 15000
        },
        {
          id: 'ai-processing',
          name: 'ByteStar AI Processing',
          type: 'bytestar-enhance',
          system: 'bytestar',
          operation: 'bytestar.generate',
          input: {
            source: 'previous',
            mapping: {
              'semantics': '{{steps.semantic-parsing.semantics}}',
              'context': '{{workflow.input.context}}'
            }
          },
          output: {
            mapping: { 'generated': '{{step.response.data}}' },
            persist: true
          },
          timeout: 45000
        },
        {
          id: 'parallel-marketplace-ops',
          name: 'Parallel Marketplace Operations',
          type: 'parallel',
          operation: 'parallel.execute',
          input: {
            source: 'previous',
            mapping: {
              'searchQuery': '{{steps.ai-processing.generated.searchQuery}}',
              'recommendations': '{{steps.ai-processing.generated.recommendations}}'
            }
          },
          output: {
            mapping: { 
              'searchResults': '{{step.tasks.search.response}}',
              'relatedItems': '{{step.tasks.related.response}}'
            },
            persist: true
          },
          timeout: 30000
        }
      ],
      triggers: [
        {
          type: 'api',
          config: { path: '/workflows/semantic-ai-marketplace' }
        },
        {
          type: 'event',
          config: { eventType: 'semantic.query.received' }
        }
      ],
      variables: {
        defaultContext: 'marketplace-search'
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['semantic', 'ai', 'parallel', 'intelligent-search'],
        category: 'ai-enhanced'
      },
      status: 'active'
    });
  }

  registerWorkflow(workflow: Workflow): void {
    // Validate workflow schema
    const validated = WorkflowSchema.parse(workflow);
    this.workflows.set(validated.id, validated);
    this.logger.info(`Workflow registered: ${validated.id}`);
  }

  async executeWorkflow(
    workflowId: string, 
    input: any, 
    metadata?: { userId?: string; sessionId?: string }
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'active') {
      throw new Error(`Workflow is not active: ${workflowId}`);
    }

    const executionId = this.generateId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      currentStep: 0,
      startTime: new Date(),
      context: { ...workflow.variables, input },
      results: {},
      errors: [],
      metadata: {
        ...metadata,
        traceId: this.generateTraceId()
      }
    };

    this.executions.set(executionId, execution);
    this.logger.info(`Starting workflow execution: ${executionId}`);

    // Start execution asynchronously
    this.processWorkflow(execution).catch(error => {
      this.logger.error(`Workflow execution failed: ${executionId}`, error);
    });

    return executionId;
  }

  private async processWorkflow(execution: WorkflowExecution): Promise<void> {
    const workflow = this.workflows.get(execution.workflowId)!;
    execution.status = 'running';
    this.emit('execution-started', execution.id);

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        if (execution.status === 'cancelled') {
          return;
        }

        execution.currentStep = i;
        const step = workflow.steps[i];
        
        this.logger.debug(`Executing step ${i}: ${step.name}`, { 
          executionId: execution.id,
          stepId: step.id 
        });

        try {
          const stepResult = await this.executeStep(step, execution, workflow);
          execution.results[step.id] = stepResult;
          
          // Check if step failed and should stop execution
          if (stepResult.status === 'failed' && !this.shouldContinueOnError(step)) {
            throw new Error(`Step failed: ${step.name} - ${stepResult.error}`);
          }
          
        } catch (error) {
          const errorMessage = (error as Error).message;
          execution.errors.push({
            step: i,
            error: errorMessage,
            timestamp: new Date()
          });

          if (!this.shouldRetryStep(step, execution.results[step.id]?.retryCount || 0)) {
            throw error;
          }

          // Retry step
          this.logger.warn(`Retrying step ${step.name}`, { 
            executionId: execution.id,
            attempt: (execution.results[step.id]?.retryCount || 0) + 1
          });
          i--; // Retry current step
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      this.logger.info(`Workflow execution completed: ${execution.id}`);
      this.emit('execution-completed', execution.id);

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      this.logger.error(`Workflow execution failed: ${execution.id}`, error);
      this.emit('execution-failed', execution.id, error);
    }
  }

  private async executeStep(
    step: WorkflowStep, 
    execution: WorkflowExecution, 
    workflow: Workflow
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      stepId: step.id,
      status: 'running',
      startTime: new Date(),
      input: this.resolveStepInput(step, execution, workflow),
      retryCount: execution.results[step.id]?.retryCount || 0
    };

    try {
      // Handle different step types
      switch (step.type) {
        case 'conditional':
          stepExecution.output = await this.executeConditionalStep(step, stepExecution.input);
          break;
          
        case 'parallel':
          stepExecution.output = await this.executeParallelStep(step, stepExecution.input, execution);
          break;
          
        case 'cns-validate':
        case 'bytestar-enhance':
        case 'marketplace-execute':
          stepExecution.output = await this.executeSystemStep(step, stepExecution.input, execution);
          break;
          
        case 'custom':
          stepExecution.output = await this.executeCustomStep(step, stepExecution.input, execution);
          break;
          
        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      stepExecution.status = 'completed';
      stepExecution.endTime = new Date();
      
      // Update execution context with step outputs
      if (step.output.persist) {
        this.updateExecutionContext(execution, step.id, stepExecution.output);
      }

      return stepExecution;

    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.endTime = new Date();
      stepExecution.error = (error as Error).message;
      stepExecution.retryCount++;
      
      throw error;
    }
  }

  private async executeConditionalStep(step: WorkflowStep, input: any): Promise<any> {
    if (!step.conditions || step.conditions.length === 0) {
      return { result: true, reason: 'No conditions specified' };
    }

    for (const condition of step.conditions) {
      const value = this.getNestedValue(input, condition.field);
      const conditionMet = this.evaluateCondition(value, condition.operator, condition.value);
      
      if (!conditionMet) {
        return { 
          result: false, 
          reason: `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`,
          actualValue: value
        };
      }
    }

    return { result: true, reason: 'All conditions met' };
  }

  private async executeParallelStep(step: WorkflowStep, input: any, execution: WorkflowExecution): Promise<any> {
    // For parallel steps, we would execute multiple operations simultaneously
    // This is a simplified implementation
    const tasks = [
      this.createSystemRequest('marketplace', 'marketplace.search', input.searchQuery, execution),
      this.createSystemRequest('marketplace', 'marketplace.search', input.recommendations, execution)
    ];

    const results = await Promise.allSettled(tasks.map(req => this.gateway.processRequest(req)));
    
    return {
      tasks: {
        search: results[0].status === 'fulfilled' ? results[0].value : { error: (results[0] as any).reason },
        related: results[1].status === 'fulfilled' ? results[1].value : { error: (results[1] as any).reason }
      }
    };
  }

  private async executeSystemStep(step: WorkflowStep, input: any, execution: WorkflowExecution): Promise<any> {
    if (!step.system) {
      throw new Error(`System not specified for step: ${step.id}`);
    }

    const request = this.createSystemRequest(step.system, step.operation, input, execution);
    const response = await this.gateway.processRequest(request);

    if (response.status === 'error') {
      throw new Error(`System request failed: ${response.error?.message}`);
    }

    return { response, metadata: response.metadata };
  }

  private async executeCustomStep(step: WorkflowStep, input: any, execution: WorkflowExecution): Promise<any> {
    // Custom step execution logic would be implemented here
    // For now, return a placeholder
    return {
      custom: true,
      operation: step.operation,
      input,
      timestamp: new Date()
    };
  }

  private createSystemRequest(
    system: SystemType, 
    operation: string, 
    payload: any, 
    execution: WorkflowExecution
  ): UnifiedRequest {
    return {
      id: this.generateId(),
      source: 'workflow',
      target: system,
      operation,
      payload,
      metadata: {
        timestamp: new Date(),
        traceId: execution.metadata.traceId,
        spanId: this.generateId(),
        priority: 'normal',
        timeout: 30000,
        retries: 3,
        userId: execution.metadata.userId,
        sessionId: execution.metadata.sessionId,
        tags: {
          workflowId: execution.workflowId,
          executionId: execution.id
        }
      }
    };
  }

  private resolveStepInput(step: WorkflowStep, execution: WorkflowExecution, workflow: Workflow): any {
    const resolved: any = {};

    for (const [key, mapping] of Object.entries(step.input.mapping)) {
      resolved[key] = this.resolveMapping(mapping, execution, workflow);
    }

    return resolved;
  }

  private resolveMapping(mapping: string, execution: WorkflowExecution, workflow: Workflow): any {
    // Handle template strings like {{workflow.input.data}} or {{steps.stepId.result}}
    return mapping.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      
      if (parts[0] === 'workflow') {
        return this.getNestedValue(execution.context, parts.slice(1).join('.'));
      } else if (parts[0] === 'steps' && parts.length >= 2) {
        const stepId = parts[1];
        const stepResult = execution.results[stepId];
        if (!stepResult) return match; // Keep original if step not executed yet
        return this.getNestedValue(stepResult, parts.slice(2).join('.'));
      } else if (parts[0] === 'previous') {
        // Get result from previous step
        const stepIndex = workflow.steps.findIndex(s => s.id === execution.workflowId);
        if (stepIndex > 0) {
          const prevStep = workflow.steps[stepIndex - 1];
          return this.getNestedValue(execution.results[prevStep.id], parts.slice(1).join('.'));
        }
      }
      
      return match; // Keep original if can't resolve
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq': return value === expected;
      case 'ne': return value !== expected;
      case 'gt': return value > expected;
      case 'lt': return value < expected;
      case 'gte': return value >= expected;
      case 'lte': return value <= expected;
      case 'in': return Array.isArray(expected) && expected.includes(value);
      case 'exists': return value !== undefined && value !== null;
      case 'regex': return new RegExp(expected).test(String(value));
      default: return false;
    }
  }

  private shouldContinueOnError(step: WorkflowStep): boolean {
    // In a real implementation, this would check step configuration
    return false;
  }

  private shouldRetryStep(step: WorkflowStep, currentRetries: number): boolean {
    const maxRetries = step.retry?.maxAttempts || 0;
    return currentRetries < maxRetries;
  }

  private updateExecutionContext(execution: WorkflowExecution, stepId: string, output: any): void {
    execution.context[`steps.${stepId}`] = output;
  }

  // Public API methods
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    this.logger.info(`Workflow execution cancelled: ${executionId}`);
    this.emit('execution-cancelled', executionId);
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  listExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return workflowId ? executions.filter(e => e.workflowId === workflowId) : executions;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateTraceId(): string {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }
}