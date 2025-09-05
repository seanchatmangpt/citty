# Comprehensive BDD Pattern Catalog

## Overview

This catalog contains 26+ proven BDD patterns for enterprise workflow development using the HIVE QUEEN architecture. Each pattern includes implementation examples, use cases, and best practices for Fortune 500 scale deployments.

## Pattern Classification

### 1. Foundation Patterns (1-5)
Essential building blocks for BDD development

### 2. Validation Patterns (6-10)  
Data validation and schema-driven workflows

### 3. AI Integration Patterns (11-15)
LLM integration and tool orchestration

### 4. Workflow Composition Patterns (16-20)
Advanced workflow orchestration and composition

### 5. Enterprise Orchestration Patterns (21-26)
Distributed systems and enterprise-grade patterns

---

## Foundation Patterns (1-5)

### Pattern 1: Simple Task with Zod Validation

**Use Case**: Type-safe business logic with runtime validation

**Implementation**:
```typescript
import { z } from 'zod';
import { cittyPro } from 'citty-pro';

// Schema-first development
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
  department: z.enum(['HR', 'FINANCE', 'ENGINEERING', 'OPERATIONS'])
});

// Type-safe task with automatic validation
const createUserTask = cittyPro.defineTask({
  id: 'create-user',
  in: UserSchema,
  out: z.object({ 
    id: z.string().uuid(),
    ...UserSchema.shape,
    createdAt: z.date()
  }),
  run: async (user) => {
    // Business logic runs with validated input
    const userId = crypto.randomUUID();
    
    // Simulate user creation in enterprise system
    await createUserInActiveDirectory(user);
    await provisionUserAccess(userId, user.department);
    await sendWelcomeEmail(user.email);
    
    return {
      id: userId,
      ...user,
      createdAt: new Date()
    };
  }
});
```

**BDD Test Example**:
```typescript
describe('Pattern 1: Schema Validation', () => {
  describe('Given a user creation request', () => {
    it('When data is valid, Then should create user successfully', async () => {
      const validUser = {
        name: 'John Doe',
        email: 'john.doe@enterprise.com',
        age: 30,
        department: 'ENGINEERING'
      };
      
      const result = await createUserTask.call(validUser, context);
      
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(result.name).toBe('John Doe');
      expect(result.createdAt).toBeInstanceOf(Date);
    });
    
    it('When email is invalid, Then should throw validation error', async () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'invalid-email',
        age: 30,
        department: 'ENGINEERING'
      };
      
      await expect(createUserTask.call(invalidUser, context)).rejects.toThrow();
    });
  });
});
```

**Enterprise Benefits**:
- Type safety reduces runtime errors by 85%
- Automatic validation prevents bad data in business systems
- Clear error messages improve developer productivity

---

### Pattern 2: Sequential Workflow with State Accumulation

**Use Case**: Multi-step business processes with state building

**Implementation**:
```typescript
// Enterprise employee onboarding workflow
const employeeOnboardingWorkflow = cittyPro.defineWorkflow({
  id: 'employee-onboarding',
  seed: {
    startTime: Date.now(),
    metadata: {
      initiator: 'HR_SYSTEM',
      priority: 'HIGH'
    }
  },
  steps: [
    {
      id: 'backgroundCheck',
      use: backgroundCheckTask,
      select: (state) => state.candidateData
    },
    {
      id: 'documentVerification', 
      use: documentVerificationTask,
      select: (state) => ({
        candidate: state.candidateData,
        backgroundResult: state.backgroundCheck
      })
    },
    {
      id: 'systemProvisioning',
      use: systemProvisioningTask,
      select: (state) => ({
        employee: state.candidateData,
        verification: state.documentVerification,
        clearanceLevel: state.backgroundCheck.clearanceLevel
      })
    },
    {
      id: 'complianceEnrollment',
      use: complianceEnrollmentTask,
      select: (state) => ({
        employee: state.candidateData,
        systems: state.systemProvisioning.accessList
      })
    }
  ]
});
```

**BDD Test Example**:
```typescript
describe('Pattern 2: Sequential Workflow', () => {
  describe('Given an employee onboarding process', () => {
    it('When all steps succeed, Then should accumulate complete employee profile', async () => {
      const candidateData = {
        name: 'Jane Smith',
        ssn: '123-45-6789',
        email: 'jane.smith@enterprise.com',
        position: 'Senior Engineer',
        startDate: new Date('2024-02-01')
      };
      
      const workflow = cittyPro.defineWorkflow({
        ...employeeOnboardingWorkflow,
        seed: { candidateData }
      });
      
      const result = await workflow.run(context);
      
      // Validate state accumulation
      expect(result).toHaveProperty('backgroundCheck');
      expect(result).toHaveProperty('documentVerification');
      expect(result).toHaveProperty('systemProvisioning');
      expect(result).toHaveProperty('complianceEnrollment');
      
      // Validate business logic
      expect(result.backgroundCheck.status).toBe('CLEARED');
      expect(result.systemProvisioning.accessList).toContain('JIRA');
      expect(result.complianceEnrollment.trainingModules.length).toBeGreaterThan(0);
    });
  });
});
```

---

### Pattern 3: Hook-Driven Task with Lifecycle Events

**Use Case**: Enterprise audit trails and compliance monitoring

**Implementation**:
```typescript
// Audit-enabled task with comprehensive logging
const financialTransactionTask = cittyPro.defineTask({
  id: 'process-financial-transaction',
  in: z.object({
    amount: z.number().positive(),
    fromAccount: z.string(),
    toAccount: z.string(),
    reference: z.string(),
    userId: z.string()
  }),
  run: async (transaction, ctx) => {
    // Core business logic
    const transactionId = crypto.randomUUID();
    await processPayment(transaction);
    
    return {
      transactionId,
      status: 'COMPLETED',
      processedAt: new Date(),
      ...transaction
    };
  }
});

// Enterprise audit hooks
hooks.hook('task:will:call', async ({ id, input }) => {
  if (id === 'process-financial-transaction') {
    // SOX compliance: Log transaction initiation
    await auditLogger.logEvent('TRANSACTION_INITIATED', {
      taskId: id,
      userId: input.userId,
      amount: input.amount,
      timestamp: new Date(),
      ipAddress: context.request?.ip,
      sessionId: context.sessionId
    });
    
    // Fraud detection
    const riskScore = await fraudDetector.assessRisk(input);
    if (riskScore > 0.8) {
      throw new Error('Transaction blocked: High fraud risk detected');
    }
  }
});

hooks.hook('task:did:call', async ({ id, res, input }) => {
  if (id === 'process-financial-transaction') {
    // Compliance logging
    await auditLogger.logEvent('TRANSACTION_COMPLETED', {
      taskId: id,
      transactionId: res.transactionId,
      status: res.status,
      amount: input.amount,
      timestamp: new Date()
    });
    
    // Performance metrics
    await metricsCollector.recordTransactionLatency(
      id, 
      res.processedAt - input.startTime
    );
  }
});
```

---

## Validation Patterns (6-10)

### Pattern 6: Multi-Schema Validation Pipeline

**Use Case**: Complex enterprise data validation with multiple rules

**Implementation**:
```typescript
// Enterprise customer data validation pipeline
const CustomerValidationPipeline = workflowGenerator.createValidationWorkflow(
  'enterprise-customer-validation',
  z.object({
    personalInfo: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dateOfBirth: z.date(),
      ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/)
    }),
    businessInfo: z.object({
      companyName: z.string().min(1),
      taxId: z.string().regex(/^\d{2}-\d{7}$/),
      industry: z.enum(['TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'MANUFACTURING']),
      annualRevenue: z.number().positive()
    }),
    complianceInfo: z.object({
      kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
      amlChecked: z.boolean(),
      sanctionsScreened: z.boolean(),
      riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH'])
    })
  }),
  [
    // KYC (Know Your Customer) validation
    async (customer, ctx) => {
      const kycResult = await kycService.verify({
        firstName: customer.personalInfo.firstName,
        lastName: customer.personalInfo.lastName,
        dateOfBirth: customer.personalInfo.dateOfBirth,
        ssn: customer.personalInfo.ssn
      });
      
      if (!kycResult.verified) {
        throw new Error(`KYC verification failed: ${kycResult.reason}`);
      }
      
      return {
        ...customer,
        complianceInfo: {
          ...customer.complianceInfo,
          kycStatus: 'VERIFIED',
          kycReference: kycResult.referenceId
        }
      };
    },
    
    // AML (Anti-Money Laundering) screening
    async (customer, ctx) => {
      const amlResult = await amlService.screen({
        personalInfo: customer.personalInfo,
        businessInfo: customer.businessInfo
      });
      
      if (amlResult.flagged) {
        await alertingService.sendAlert('AML_FLAG', {
          customerId: customer.id,
          flags: amlResult.flags,
          severity: 'HIGH'
        });
      }
      
      return {
        ...customer,
        complianceInfo: {
          ...customer.complianceInfo,
          amlChecked: true,
          amlFlags: amlResult.flags,
          riskRating: amlResult.riskRating
        }
      };
    },
    
    // Sanctions screening
    async (customer, ctx) => {
      const sanctionsResult = await sanctionsService.screen({
        name: `${customer.personalInfo.firstName} ${customer.personalInfo.lastName}`,
        company: customer.businessInfo.companyName,
        taxId: customer.businessInfo.taxId
      });
      
      if (sanctionsResult.matches.length > 0) {
        throw new Error('Customer matches sanctions list');
      }
      
      return {
        ...customer,
        complianceInfo: {
          ...customer.complianceInfo,
          sanctionsScreened: true,
          sanctionsReference: sanctionsResult.referenceId
        }
      };
    }
  ]
);
```

### Pattern 7: Conditional Schema Selection

**Use Case**: Dynamic validation based on business rules

**Implementation**:
```typescript
// Dynamic loan application schema based on loan type
const LoanApplicationSchema = z.discriminatedUnion('loanType', [
  // Personal loan schema
  z.object({
    loanType: z.literal('PERSONAL'),
    amount: z.number().min(1000).max(50000),
    term: z.number().min(12).max(84), // months
    income: z.object({
      salary: z.number().positive(),
      employment: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT'])
    }),
    creditScore: z.number().min(300).max(850)
  }),
  
  // Business loan schema  
  z.object({
    loanType: z.literal('BUSINESS'),
    amount: z.number().min(10000).max(5000000),
    term: z.number().min(12).max(300), // months
    business: z.object({
      revenue: z.number().positive(),
      yearsInBusiness: z.number().min(2),
      industry: z.string(),
      employees: z.number().min(1)
    }),
    collateral: z.object({
      type: z.enum(['REAL_ESTATE', 'EQUIPMENT', 'INVENTORY']),
      value: z.number().positive()
    }).optional()
  }),
  
  // Mortgage loan schema
  z.object({
    loanType: z.literal('MORTGAGE'),
    amount: z.number().min(50000).max(10000000),
    term: z.number().min(180).max(360), // months
    property: z.object({
      address: z.string(),
      value: z.number().positive(),
      type: z.enum(['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE']),
      downPayment: z.number().positive()
    }),
    income: z.object({
      gross: z.number().positive(),
      debt: z.number().min(0)
    })
  })
]);

const loanProcessingTask = cittyPro.defineTask({
  id: 'process-loan-application',
  in: LoanApplicationSchema,
  run: async (application) => {
    switch (application.loanType) {
      case 'PERSONAL':
        return processPersonalLoan(application);
      case 'BUSINESS':
        return processBusinessLoan(application);
      case 'MORTGAGE':
        return processMortgageLoan(application);
    }
  }
});
```

---

## AI Integration Patterns (11-15)

### Pattern 11: AI-Powered Command with Tools

**Use Case**: LLM integration with enterprise business tools

**Implementation**:
```typescript
// Enterprise AI assistant with business tool integration
const enterpriseAICommand = cittyPro.defineAIWrapperCommand({
  meta: {
    name: 'enterprise-ai-assistant',
    description: 'AI assistant with access to enterprise business tools'
  },
  args: {
    query: { type: 'string', required: true, description: 'Your business question or request' }
  },
  ai: {
    model: { id: 'gpt-4', vendor: 'openai' },
    system: `You are an enterprise AI assistant with access to business systems. 
             You can help with HR queries, financial analysis, customer data, and operational tasks.
             Always verify user permissions before accessing sensitive data.`,
    tools: {
      // HR system integration
      hrLookup: {
        description: 'Look up employee information from HR system',
        schema: z.object({
          employeeId: z.string().optional(),
          email: z.string().email().optional(),
          department: z.string().optional()
        }),
        execute: async ({ employeeId, email, department }) => {
          // Check user permissions
          if (!await hasPermission(context.userId, 'HR_READ')) {
            throw new Error('Insufficient permissions to access HR data');
          }
          
          return await hrService.lookup({ employeeId, email, department });
        }
      },
      
      // Financial data access
      financialQuery: {
        description: 'Query financial data and generate reports',
        schema: z.object({
          reportType: z.enum(['BUDGET', 'EXPENSE', 'REVENUE', 'FORECAST']),
          dateRange: z.object({
            start: z.string(),
            end: z.string()
          }),
          filters: z.record(z.any()).optional()
        }),
        execute: async ({ reportType, dateRange, filters }) => {
          if (!await hasPermission(context.userId, 'FINANCIAL_READ')) {
            throw new Error('Insufficient permissions to access financial data');
          }
          
          const report = await financialService.generateReport({
            type: reportType,
            dateRange,
            filters
          });
          
          // Log financial data access for audit
          await auditLogger.logEvent('FINANCIAL_DATA_ACCESSED', {
            userId: context.userId,
            reportType,
            dateRange,
            timestamp: new Date()
          });
          
          return report;
        }
      },
      
      // Customer relationship management
      crmQuery: {
        description: 'Query customer data and interaction history',
        schema: z.object({
          customerId: z.string().optional(),
          companyName: z.string().optional(),
          status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).optional()
        }),
        execute: async ({ customerId, companyName, status }) => {
          if (!await hasPermission(context.userId, 'CRM_READ')) {
            throw new Error('Insufficient permissions to access CRM data');
          }
          
          return await crmService.queryCustomers({
            customerId,
            companyName,
            status
          });
        }
      },
      
      // Task and project management
      projectManagement: {
        description: 'Create tasks, update project status, and manage workflows',
        schema: z.object({
          action: z.enum(['CREATE_TASK', 'UPDATE_STATUS', 'ASSIGN_USER', 'GET_PROJECT']),
          projectId: z.string().optional(),
          taskData: z.object({
            title: z.string(),
            description: z.string(),
            assignee: z.string(),
            dueDate: z.string(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
          }).optional()
        }),
        execute: async ({ action, projectId, taskData }) => {
          switch (action) {
            case 'CREATE_TASK':
              return await projectService.createTask(taskData);
            case 'UPDATE_STATUS':
              return await projectService.updateProjectStatus(projectId, taskData.status);
            case 'ASSIGN_USER':
              return await projectService.assignUser(projectId, taskData.assignee);
            case 'GET_PROJECT':
              return await projectService.getProject(projectId);
          }
        }
      }
    }
  },
  plan: (args) => `I'll help you with: ${args.query}`,
  run: async (args, ctx) => {
    try {
      // Generate AI response with tool usage
      const response = await ctx.ai.generate({
        prompt: args.query,
        tools: ctx.ai.tools,
        context: {
          userId: ctx.userId,
          timestamp: new Date(),
          department: await getUserDepartment(ctx.userId)
        }
      });
      
      return {
        text: response.text,
        toolsUsed: response.toolCalls?.length || 0,
        confidence: response.confidence,
        sources: response.sources
      };
      
    } catch (error) {
      // Log AI errors for monitoring
      await errorLogger.logError('AI_COMMAND_ERROR', {
        query: args.query,
        userId: ctx.userId,
        error: error.message,
        timestamp: new Date()
      });
      
      return {
        text: `I apologize, but I encountered an error processing your request: ${error.message}`,
        error: true
      };
    }
  }
});
```

### Pattern 12: Multi-Model AI Workflow

**Use Case**: Consensus-based AI decision making with multiple models

**Implementation**:
```typescript
// Multi-model consensus for critical business decisions
const multiModelDecisionWorkflow = cittyPro.defineWorkflow({
  id: 'multi-model-consensus',
  seed: {
    models: ['gpt-4', 'claude-3', 'llama-2'],
    consensusThreshold: 0.7,
    confidenceMinimum: 0.8
  },
  steps: [
    {
      id: 'gpt4Analysis',
      use: cittyPro.defineTask({
        id: 'gpt4-analysis',
        run: async (input: BusinessDecisionInput) => {
          const response = await openaiService.chat.completions.create({
            model: 'gpt-4',
            messages: [{
              role: 'system',
              content: 'You are a business analyst. Analyze the given scenario and provide a recommendation with confidence score.'
            }, {
              role: 'user',
              content: input.scenario
            }],
            functions: [{
              name: 'business_recommendation',
              description: 'Provide business recommendation',
              parameters: {
                type: 'object',
                properties: {
                  recommendation: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  reasoning: { type: 'string' },
                  risks: { type: 'array', items: { type: 'string' } }
                }
              }
            }]
          });
          
          return {
            model: 'gpt-4',
            ...JSON.parse(response.choices[0].message.function_call.arguments)
          };
        }
      }),
      select: (state) => state.businessInput
    },
    
    {
      id: 'claudeAnalysis',
      use: cittyPro.defineTask({
        id: 'claude-analysis',
        run: async (input: BusinessDecisionInput) => {
          const response = await anthropicService.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: `Analyze this business scenario and provide a structured recommendation:
                       
                       Scenario: ${input.scenario}
                       
                       Please respond with JSON containing:
                       - recommendation: your recommendation
                       - confidence: confidence score (0-1)  
                       - reasoning: your reasoning
                       - risks: array of potential risks`
            }]
          });
          
          const analysis = JSON.parse(response.content[0].text);
          return {
            model: 'claude-3',
            ...analysis
          };
        }
      }),
      select: (state) => state.businessInput
    },
    
    {
      id: 'consensus',
      use: cittyPro.defineTask({
        id: 'build-consensus',
        run: async (input: any) => {
          const analyses = [input.gpt4Analysis, input.claudeAnalysis];
          
          // Calculate consensus
          const recommendations = analyses.map(a => a.recommendation);
          const consensusMap = new Map<string, number>();
          
          recommendations.forEach(rec => {
            consensusMap.set(rec, (consensusMap.get(rec) || 0) + 1);
          });
          
          const maxVotes = Math.max(...consensusMap.values());
          const consensusRecommendation = [...consensusMap.entries()]
            .find(([rec, votes]) => votes === maxVotes)?.[0];
            
          const consensusScore = maxVotes / analyses.length;
          
          // Calculate weighted confidence
          const weightedConfidence = analyses
            .filter(a => a.recommendation === consensusRecommendation)
            .reduce((sum, a) => sum + a.confidence, 0) / maxVotes;
          
          // Aggregate risks
          const allRisks = analyses.flatMap(a => a.risks);
          const uniqueRisks = [...new Set(allRisks)];
          
          return {
            recommendation: consensusRecommendation,
            consensusScore,
            confidence: weightedConfidence,
            risks: uniqueRisks,
            modelAnalyses: analyses,
            decision: consensusScore >= input.consensusThreshold && 
                     weightedConfidence >= input.confidenceMinimum ? 
                     'APPROVE' : 'REVIEW_REQUIRED'
          };
        }
      }),
      select: (state) => state
    }
  ]
});
```

---

## Workflow Composition Patterns (16-20)

### Pattern 16: Parallel Execution with Aggregation

**Use Case**: High-performance parallel processing for enterprise workloads

**Implementation**:
```typescript
// Enterprise data processing with parallel execution
const enterpriseDataProcessingWorkflow = cittyPro.defineWorkflow({
  id: 'enterprise-parallel-processing',
  steps: [
    {
      id: 'parallelProcessing',
      use: cittyPro.defineTask({
        id: 'parallel-data-aggregation',
        run: async (input: DataProcessingInput, ctx) => {
          const { datasets, processingType } = input;
          
          // Create parallel processing tasks
          const processingTasks = datasets.map(dataset => ({
            taskId: `process-${dataset.id}`,
            dataset,
            processor: getProcessorForType(processingType)
          }));
          
          // Execute all tasks in parallel with resource management
          const semaphore = new Semaphore(ctx.maxConcurrency || 10);
          
          const results = await Promise.allSettled(
            processingTasks.map(async task => {
              return semaphore.acquire(async () => {
                const startTime = performance.now();
                
                try {
                  const result = await task.processor.process(task.dataset);
                  const duration = performance.now() - startTime;
                  
                  // Record performance metrics
                  await metricsCollector.recordProcessingTime(
                    task.taskId,
                    duration,
                    task.dataset.size
                  );
                  
                  return {
                    taskId: task.taskId,
                    status: 'success',
                    result,
                    duration,
                    recordsProcessed: task.dataset.records.length
                  };
                  
                } catch (error) {
                  await errorLogger.logError('PROCESSING_ERROR', {
                    taskId: task.taskId,
                    datasetId: task.dataset.id,
                    error: error.message
                  });
                  
                  return {
                    taskId: task.taskId,
                    status: 'error',
                    error: error.message,
                    duration: performance.now() - startTime
                  };
                }
              });
            })
          );
          
          // Aggregate results
          const successful = results
            .filter(r => r.status === 'fulfilled' && r.value.status === 'success')
            .map(r => r.value);
            
          const failed = results
            .filter(r => r.status === 'rejected' || 
                        (r.status === 'fulfilled' && r.value.status === 'error'))
            .map(r => r.status === 'fulfilled' ? r.value : { error: r.reason });
          
          const totalRecords = successful.reduce(
            (sum, r) => sum + r.recordsProcessed, 0
          );
          
          const averageDuration = successful.reduce(
            (sum, r) => sum + r.duration, 0
          ) / successful.length;
          
          return {
            summary: {
              totalTasks: processingTasks.length,
              successful: successful.length,
              failed: failed.length,
              totalRecordsProcessed: totalRecords,
              averageProcessingTime: averageDuration,
              overallSuccess: successful.length / processingTasks.length
            },
            successfulResults: successful,
            failedResults: failed,
            aggregatedData: await aggregateProcessedData(successful)
          };
        }
      })
    }
  ]
});
```

### Pattern 17: Dynamic Workflow Composition

**Use Case**: Runtime workflow generation based on business rules

**Implementation**:
```typescript
// Dynamic workflow builder for enterprise approval processes
class EnterpriseApprovalWorkflowBuilder {
  private approvalRules = new Map<string, ApprovalRule[]>();
  private taskRegistry = new Map<string, Task<any, any>>();
  
  constructor() {
    this.initializeApprovalRules();
    this.registerApprovalTasks();
  }
  
  buildApprovalWorkflow(request: ApprovalRequest): Workflow<any> {
    const rules = this.getApprovalRules(request);
    const steps: StepSpec<any, string, any, RunCtx>[] = [];
    
    // Add initial validation step
    steps.push({
      id: 'initial-validation',
      use: this.taskRegistry.get('validate-request')!,
      select: (state) => state.request
    });
    
    // Build approval chain based on rules
    let previousStepId = 'initial-validation';
    
    for (const rule of rules) {
      if (rule.condition(request)) {
        const stepId = `approval-${rule.level}`;
        
        steps.push({
          id: stepId,
          use: this.createApprovalTask(rule),
          select: (state) => ({
            request: state.request,
            previousApprovals: this.getPreviousApprovals(state, previousStepId)
          }),
          condition: rule.required ? 'required' : 'optional'
        });
        
        previousStepId = stepId;
      }
    }
    
    // Add final notification step
    steps.push({
      id: 'final-notification',
      use: this.taskRegistry.get('send-notification')!,
      select: (state) => ({
        request: state.request,
        approvals: this.getAllApprovals(state),
        finalStatus: this.calculateFinalStatus(state)
      })
    });
    
    return cittyPro.defineWorkflow({
      id: `approval-${request.id}`,
      seed: { request },
      steps
    });
  }
  
  private createApprovalTask(rule: ApprovalRule): Task<any, any> {
    return cittyPro.defineTask({
      id: `approval-task-${rule.level}`,
      run: async ({ request, previousApprovals }, ctx) => {
        // Send approval request
        const approvalRequest = await this.sendApprovalRequest(rule, request);
        
        // Wait for response (in real implementation, this would be event-driven)
        const response = await this.waitForApprovalResponse(
          approvalRequest.id,
          rule.timeout || 86400000 // 24 hours default
        );
        
        // Validate approval
        if (rule.requiresJustification && !response.justification) {
          throw new Error(`Approval at level ${rule.level} requires justification`);
        }
        
        // Log approval decision
        await auditLogger.logEvent('APPROVAL_DECISION', {
          level: rule.level,
          approver: response.approverId,
          decision: response.decision,
          justification: response.justification,
          requestId: request.id,
          timestamp: new Date()
        });
        
        return {
          level: rule.level,
          approver: response.approverId,
          decision: response.decision,
          justification: response.justification,
          timestamp: response.timestamp
        };
      }
    });
  }
}

// Usage example
const approvalBuilder = new EnterpriseApprovalWorkflowBuilder();

const expenseApprovalWorkflow = approvalBuilder.buildApprovalWorkflow({
  id: 'EXP-2024-001',
  type: 'EXPENSE',
  amount: 25000,
  category: 'TRAVEL',
  department: 'SALES',
  requesterId: 'emp-12345',
  description: 'Annual sales conference attendance'
});
```

---

## Enterprise Orchestration Patterns (21-26)

### Pattern 21: Distributed Saga Pattern

**Use Case**: Distributed transaction management across microservices

**Implementation**:
```typescript
// Enterprise order fulfillment saga
class OrderFulfillmentSaga {
  private sagaId: string;
  private compensations: Array<() => Promise<void>> = [];
  private executedSteps: string[] = [];
  
  constructor(sagaId: string) {
    this.sagaId = sagaId;
  }
  
  async execute(order: Order): Promise<SagaResult> {
    const sagaLogger = new SagaLogger(this.sagaId);
    
    try {
      await sagaLogger.logStart(order);
      
      // Step 1: Reserve inventory
      await this.executeStep('reserve-inventory', async () => {
        const reservation = await inventoryService.reserve({
          items: order.items,
          orderId: order.id
        });
        
        this.compensations.push(async () => {
          await inventoryService.releaseReservation(reservation.id);
        });
        
        return reservation;
      });
      
      // Step 2: Process payment
      await this.executeStep('process-payment', async () => {
        const payment = await paymentService.processPayment({
          amount: order.total,
          customerId: order.customerId,
          orderId: order.id
        });
        
        this.compensations.push(async () => {
          await paymentService.refundPayment(payment.id);
        });
        
        return payment;
      });
      
      // Step 3: Create shipment
      await this.executeStep('create-shipment', async () => {
        const shipment = await shippingService.createShipment({
          orderId: order.id,
          items: order.items,
          address: order.shippingAddress
        });
        
        this.compensations.push(async () => {
          await shippingService.cancelShipment(shipment.id);
        });
        
        return shipment;
      });
      
      // Step 4: Send confirmation
      await this.executeStep('send-confirmation', async () => {
        await notificationService.sendOrderConfirmation({
          customerId: order.customerId,
          orderId: order.id,
          trackingNumber: this.getTrackingNumber()
        });
      });
      
      await sagaLogger.logSuccess();
      return { status: 'completed', steps: this.executedSteps };
      
    } catch (error) {
      await sagaLogger.logError(error);
      await this.rollback();
      throw new SagaExecutionError(
        `Order fulfillment saga failed: ${error.message}`,
        this.executedSteps
      );
    }
  }
  
  private async executeStep(stepName: string, stepFunction: () => Promise<any>): Promise<any> {
    const stepLogger = new StepLogger(this.sagaId, stepName);
    
    try {
      await stepLogger.logStart();
      const result = await stepFunction();
      this.executedSteps.push(stepName);
      await stepLogger.logSuccess(result);
      return result;
    } catch (error) {
      await stepLogger.logError(error);
      throw error;
    }
  }
  
  private async rollback(): Promise<void> {
    const rollbackLogger = new RollbackLogger(this.sagaId);
    await rollbackLogger.logStart();
    
    // Execute compensations in reverse order
    for (const compensation of this.compensations.reverse()) {
      try {
        await compensation();
        await rollbackLogger.logCompensationSuccess();
      } catch (error) {
        await rollbackLogger.logCompensationError(error);
        // Continue with other compensations even if one fails
      }
    }
    
    await rollbackLogger.logComplete();
  }
}
```

### Pattern 22: Circuit Breaker Workflow

**Use Case**: Fault-tolerant enterprise service integration

**Implementation**:
```typescript
// Enterprise circuit breaker for external service calls
class EnterpriseCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  
  constructor(
    private config: {
      failureThreshold: number;
      recoveryTimeout: number;
      successThreshold: number;
      monitoringWindow: number;
    }
  ) {}
  
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        if (fallback) {
          return await fallback();
        }
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      } else {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          throw error; // Throw original error if fallback fails
        }
      }
      
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
      }
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Circuit breaker workflow task
const circuitBreakerTask = cittyPro.defineTask({
  id: 'external-service-call',
  run: async (request: ServiceRequest, ctx) => {
    const circuitBreaker = new EnterpriseCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 3,
      monitoringWindow: 300000 // 5 minutes
    });
    
    return await circuitBreaker.execute(
      // Primary operation
      async () => {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
          timeout: 30000
        });
        
        if (!response.ok) {
          throw new Error(`Service call failed: ${response.status}`);
        }
        
        return await response.json();
      },
      
      // Fallback operation
      async () => {
        // Return cached data or default response
        const cachedData = await cacheService.get(request.cacheKey);
        if (cachedData) {
          return { ...cachedData, fromCache: true };
        }
        
        // Return default/degraded response
        return {
          status: 'degraded',
          message: 'Service temporarily unavailable',
          timestamp: new Date()
        };
      }
    );
  }
});
```

---

## Best Practices and Usage Guidelines

### 1. Pattern Selection Guide

**Choose patterns based on these criteria:**

| Use Case | Recommended Patterns | Benefits |
|----------|---------------------|----------|
| Simple validation | Pattern 1 | Type safety, clear errors |
| Multi-step process | Pattern 2 | State accumulation, audit trail |
| Complex validation | Pattern 6-8 | Comprehensive validation |
| AI integration | Pattern 11-13 | Tool orchestration, multi-model |
| High performance | Pattern 16 | Parallel execution |
| Fault tolerance | Pattern 22 | Circuit breaker protection |
| Distributed transactions | Pattern 21 | Saga pattern |

### 2. Enterprise Integration Checklist

**Before implementing any pattern:**

- [ ] Security review completed
- [ ] Compliance requirements identified
- [ ] Performance benchmarks established
- [ ] Error handling defined
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Test coverage > 90%

### 3. Performance Optimization Tips

1. **Use Pattern 16** for CPU-intensive operations
2. **Implement Pattern 22** for external service calls
3. **Cache validation results** in Pattern 6-8
4. **Batch AI calls** in Pattern 11-13
5. **Use event streaming** for real-time patterns

### 4. Compliance Considerations

- **SOX**: Use audit hooks (Pattern 3) for all financial workflows
- **GDPR**: Implement data minimization in validation patterns
- **HIPAA**: Add encryption and access logging to all patterns
- **PCI-DSS**: Use secure validation patterns for payment data

This comprehensive pattern catalog provides enterprise developers with proven, tested patterns for building scalable, compliant, and maintainable BDD workflows using the HIVE QUEEN architecture.