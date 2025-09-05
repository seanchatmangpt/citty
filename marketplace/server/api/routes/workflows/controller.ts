import { Request, Response } from 'express'
import { ApiError, NotFoundError, ForbiddenError } from '../../utils/errors.js'

interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    permissions: string[]
  }
}

interface Workflow {
  id: string
  name: string
  description?: string
  ownerId: string
  triggers: WorkflowTrigger[]
  steps: WorkflowStep[]
  isActive: boolean
  version: number
  createdAt: Date
  updatedAt: Date
  lastExecuted?: Date
  executionCount: number
  successRate: number
}

interface WorkflowTrigger {
  id: string
  type: 'event' | 'schedule' | 'webhook' | 'manual'
  config: {
    event?: string
    cron?: string
    webhookUrl?: string
    conditions?: any[]
  }
}

interface WorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'loop' | 'parallel' | 'delay' | 'citty-pro'
  config: {
    action?: string
    condition?: string
    delay?: number
    parallel?: WorkflowStep[]
    cittyProCommand?: string
    cittyProArgs?: Record<string, any>
  }
  onSuccess?: string // Next step ID
  onFailure?: string // Next step ID
  timeout?: number
  retryCount?: number
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  startedAt: Date
  completedAt?: Date
  triggeredBy: string
  steps: WorkflowStepExecution[]
  variables: Record<string, any>
  logs: WorkflowLog[]
  error?: string
}

interface WorkflowStepExecution {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: Date
  completedAt?: Date
  output?: any
  error?: string
  retryCount: number
}

interface WorkflowLog {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  stepId?: string
  metadata?: any
}

// Mock database
const mockWorkflowData = {
  workflows: new Map<string, Workflow>(),
  executions: new Map<string, WorkflowExecution>(),
  templates: generateWorkflowTemplates(),
}

// Initialize mock data
const initMockWorkflowData = () => {
  const sampleWorkflow: Workflow = {
    id: 'workflow-1',
    name: 'Order Processing',
    description: 'Automated order processing workflow',
    ownerId: 'user-1',
    triggers: [
      {
        id: 'trigger-1',
        type: 'event',
        config: {
          event: 'order.created',
          conditions: [
            { field: 'amount', operator: 'gt', value: 100 }
          ]
        }
      }
    ],
    steps: [
      {
        id: 'step-1',
        name: 'Validate Order',
        type: 'action',
        config: {
          action: 'validate_order'
        },
        onSuccess: 'step-2',
        onFailure: 'step-error',
        timeout: 30000,
        retryCount: 2,
      },
      {
        id: 'step-2',
        name: 'Process Payment',
        type: 'citty-pro',
        config: {
          cittyProCommand: 'payment-processor',
          cittyProArgs: {
            orderId: '${order.id}',
            amount: '${order.amount}',
          }
        },
        onSuccess: 'step-3',
        onFailure: 'step-refund',
        timeout: 60000,
        retryCount: 1,
      },
      {
        id: 'step-3',
        name: 'Update Inventory',
        type: 'action',
        config: {
          action: 'update_inventory'
        },
        onSuccess: 'step-4',
        timeout: 15000,
      },
      {
        id: 'step-4',
        name: 'Send Confirmation',
        type: 'parallel',
        config: {
          parallel: [
            {
              id: 'step-4a',
              name: 'Email Customer',
              type: 'action',
              config: { action: 'send_email' }
            },
            {
              id: 'step-4b',
              name: 'SMS Notification',
              type: 'action',
              config: { action: 'send_sms' }
            }
          ]
        },
        timeout: 30000,
      }
    ],
    isActive: true,
    version: 1,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    lastExecuted: new Date('2024-01-25'),
    executionCount: 45,
    successRate: 92.3,
  }

  mockWorkflowData.workflows.set(sampleWorkflow.id, sampleWorkflow)

  // Sample execution
  const sampleExecution: WorkflowExecution = {
    id: 'exec-1',
    workflowId: 'workflow-1',
    status: 'completed',
    startedAt: new Date('2024-01-25T10:00:00Z'),
    completedAt: new Date('2024-01-25T10:05:30Z'),
    triggeredBy: 'order.created',
    steps: [
      {
        stepId: 'step-1',
        status: 'completed',
        startedAt: new Date('2024-01-25T10:00:00Z'),
        completedAt: new Date('2024-01-25T10:00:15Z'),
        output: { valid: true },
        retryCount: 0,
      },
      {
        stepId: 'step-2',
        status: 'completed',
        startedAt: new Date('2024-01-25T10:00:15Z'),
        completedAt: new Date('2024-01-25T10:02:30Z'),
        output: { paymentId: 'pay_123', status: 'captured' },
        retryCount: 0,
      }
    ],
    variables: {
      orderId: 'order-123',
      amount: 150.00,
      customerId: 'customer-456',
    },
    logs: [
      {
        id: 'log-1',
        timestamp: new Date('2024-01-25T10:00:00Z'),
        level: 'info',
        message: 'Workflow execution started',
        metadata: { triggeredBy: 'order.created' },
      },
      {
        id: 'log-2',
        timestamp: new Date('2024-01-25T10:00:15Z'),
        level: 'info',
        message: 'Order validation completed successfully',
        stepId: 'step-1',
      },
    ],
  }

  mockWorkflowData.executions.set(sampleExecution.id, sampleExecution)
}

initMockWorkflowData()

export const workflowController = {
  // POST /api/workflows - Create workflow
  async createWorkflow(req: AuthRequest, res: Response) {
    const { name, description, triggers, steps, isActive = true } = req.body
    const ownerId = req.user!.id

    // Validate workflow structure
    const validationResult = validateWorkflowStructure({ triggers, steps })
    if (!validationResult.valid) {
      throw new ApiError(400, `Invalid workflow structure: ${validationResult.error}`)
    }

    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      ownerId,
      triggers,
      steps,
      isActive,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      successRate: 0,
    }

    mockWorkflowData.workflows.set(newWorkflow.id, newWorkflow)

    // Register triggers (mock implementation)
    await registerWorkflowTriggers(newWorkflow)

    res.status(201).json({
      success: true,
      data: { workflow: newWorkflow },
      message: 'Workflow created successfully',
    })
  },

  // GET /api/workflows - List workflows
  async getWorkflows(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = req.query as any

    let workflows = Array.from(mockWorkflowData.workflows.values())

    // Filter by ownership (non-admin users can only see their own workflows)
    if (userRole !== 'admin') {
      workflows = workflows.filter(w => w.ownerId === userId)
    }

    // Filter by status
    if (status !== undefined) {
      const isActive = status === 'active'
      workflows = workflows.filter(w => w.isActive === isActive)
    }

    // Sort
    workflows.sort((a, b) => {
      const aValue = a[sortBy as keyof Workflow] as any
      const bValue = b[sortBy as keyof Workflow] as any
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedWorkflows = workflows.slice(startIndex, endIndex)

    res.json({
      success: true,
      data: {
        workflows: paginatedWorkflows,
        pagination: {
          page,
          limit,
          total: workflows.length,
          totalPages: Math.ceil(workflows.length / limit),
          hasNext: endIndex < workflows.length,
          hasPrev: page > 1,
        },
      },
    })
  },

  // GET /api/workflows/:id - Get workflow details
  async getWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    // Check authorization
    if (workflow.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only view your own workflows')
    }

    // Get recent executions
    const recentExecutions = Array.from(mockWorkflowData.executions.values())
      .filter(e => e.workflowId === id)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 5)

    res.json({
      success: true,
      data: {
        workflow,
        recentExecutions,
      },
    })
  },

  // PUT /api/workflows/:id - Update workflow
  async updateWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const updates = req.body
    const userId = req.user!.id
    const userRole = req.user!.role

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    // Check authorization
    if (workflow.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only update your own workflows')
    }

    // Validate updated structure if provided
    if (updates.triggers || updates.steps) {
      const validationResult = validateWorkflowStructure({
        triggers: updates.triggers || workflow.triggers,
        steps: updates.steps || workflow.steps,
      })
      if (!validationResult.valid) {
        throw new ApiError(400, `Invalid workflow structure: ${validationResult.error}`)
      }
    }

    const updatedWorkflow: Workflow = {
      ...workflow,
      ...updates,
      id, // Prevent ID changes
      ownerId: workflow.ownerId, // Prevent owner changes
      version: workflow.version + 1,
      updatedAt: new Date(),
    }

    mockWorkflowData.workflows.set(id, updatedWorkflow)

    // Re-register triggers if they changed
    if (updates.triggers) {
      await registerWorkflowTriggers(updatedWorkflow)
    }

    res.json({
      success: true,
      data: { workflow: updatedWorkflow },
      message: 'Workflow updated successfully',
    })
  },

  // DELETE /api/workflows/:id - Delete workflow
  async deleteWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    // Check authorization
    if (workflow.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only delete your own workflows')
    }

    // Cancel any running executions
    const runningExecutions = Array.from(mockWorkflowData.executions.values())
      .filter(e => e.workflowId === id && e.status === 'running')

    for (const execution of runningExecutions) {
      execution.status = 'cancelled'
      execution.completedAt = new Date()
    }

    // Unregister triggers
    await unregisterWorkflowTriggers(workflow)

    // Delete workflow
    mockWorkflowData.workflows.delete(id)

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
    })
  },

  // POST /api/workflows/:id/execute - Execute workflow
  async executeWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { variables = {}, waitForCompletion = false } = req.body
    const userId = req.user!.id

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    if (!workflow.isActive) {
      throw new ApiError(400, 'Cannot execute inactive workflow')
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId: id,
      status: 'running',
      startedAt: new Date(),
      triggeredBy: 'manual',
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        retryCount: 0,
      })),
      variables: { ...variables, userId },
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date(),
          level: 'info',
          message: 'Workflow execution started manually',
          metadata: { userId, variables },
        },
      ],
    }

    mockWorkflowData.executions.set(execution.id, execution)

    // Start async execution
    executeWorkflowAsync(execution, workflow).catch(console.error)

    // Update workflow stats
    workflow.lastExecuted = new Date()
    workflow.executionCount++

    if (waitForCompletion) {
      // Wait for execution to complete (with timeout)
      const result = await waitForExecution(execution.id, 60000) // 1 minute timeout
      res.json({
        success: true,
        data: { execution: result },
        message: 'Workflow executed successfully',
      })
    } else {
      res.status(202).json({
        success: true,
        data: { execution },
        message: 'Workflow execution started',
      })
    }
  },

  // GET /api/workflows/:id/executions - Get execution history
  async getExecutionHistory(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = 'startedAt',
      sortOrder = 'desc',
    } = req.query as any

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    // Check authorization
    if (workflow.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only view executions for your own workflows')
    }

    let executions = Array.from(mockWorkflowData.executions.values())
      .filter(e => e.workflowId === id)

    // Filter by status
    if (status) {
      executions = executions.filter(e => e.status === status)
    }

    // Sort
    executions.sort((a, b) => {
      const aValue = a[sortBy as keyof WorkflowExecution] as any
      const bValue = b[sortBy as keyof WorkflowExecution] as any
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedExecutions = executions.slice(startIndex, endIndex)

    res.json({
      success: true,
      data: {
        executions: paginatedExecutions,
        pagination: {
          page,
          limit,
          total: executions.length,
          totalPages: Math.ceil(executions.length / limit),
          hasNext: endIndex < executions.length,
          hasPrev: page > 1,
        },
      },
    })
  },

  // GET /api/workflows/executions/:executionId - Get execution details
  async getExecutionDetails(req: AuthRequest, res: Response) {
    const { executionId } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    const execution = mockWorkflowData.executions.get(executionId)

    if (!execution) {
      throw new NotFoundError('Execution', executionId)
    }

    const workflow = mockWorkflowData.workflows.get(execution.workflowId)

    // Check authorization
    if (workflow && workflow.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only view executions for your own workflows')
    }

    res.json({
      success: true,
      data: {
        execution,
        workflow,
      },
    })
  },

  // POST /api/workflows/:id/pause - Pause workflow
  async pauseWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { executionId } = req.body

    // Find running execution
    const execution = executionId 
      ? mockWorkflowData.executions.get(executionId)
      : Array.from(mockWorkflowData.executions.values())
          .find(e => e.workflowId === id && e.status === 'running')

    if (!execution) {
      throw new NotFoundError('Running execution for workflow', id)
    }

    if (execution.status !== 'running') {
      throw new ApiError(400, `Cannot pause ${execution.status} execution`)
    }

    execution.status = 'paused'

    res.json({
      success: true,
      data: { execution },
      message: 'Workflow execution paused',
    })
  },

  // POST /api/workflows/:id/resume - Resume workflow
  async resumeWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { executionId } = req.body

    const execution = executionId 
      ? mockWorkflowData.executions.get(executionId)
      : Array.from(mockWorkflowData.executions.values())
          .find(e => e.workflowId === id && e.status === 'paused')

    if (!execution) {
      throw new NotFoundError('Paused execution for workflow', id)
    }

    if (execution.status !== 'paused') {
      throw new ApiError(400, `Cannot resume ${execution.status} execution`)
    }

    execution.status = 'running'

    // Resume execution
    const workflow = mockWorkflowData.workflows.get(execution.workflowId)
    if (workflow) {
      executeWorkflowAsync(execution, workflow).catch(console.error)
    }

    res.json({
      success: true,
      data: { execution },
      message: 'Workflow execution resumed',
    })
  },

  // POST /api/workflows/:id/cancel - Cancel workflow
  async cancelWorkflow(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { executionId } = req.body

    const execution = executionId 
      ? mockWorkflowData.executions.get(executionId)
      : Array.from(mockWorkflowData.executions.values())
          .find(e => e.workflowId === id && ['running', 'paused'].includes(e.status))

    if (!execution) {
      throw new NotFoundError('Active execution for workflow', id)
    }

    if (!['running', 'paused'].includes(execution.status)) {
      throw new ApiError(400, `Cannot cancel ${execution.status} execution`)
    }

    execution.status = 'cancelled'
    execution.completedAt = new Date()

    res.json({
      success: true,
      data: { execution },
      message: 'Workflow execution cancelled',
    })
  },

  // GET /api/workflows/templates - Get templates
  async getWorkflowTemplates(req: Request, res: Response) {
    const { category, page = 1, limit = 20 } = req.query as any

    let templates = mockWorkflowData.templates

    // Filter by category
    if (category) {
      templates = templates.filter(t => t.category === category)
    }

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedTemplates = templates.slice(startIndex, endIndex)

    res.json({
      success: true,
      data: {
        templates: paginatedTemplates,
        pagination: {
          page,
          limit,
          total: templates.length,
          totalPages: Math.ceil(templates.length / limit),
          hasNext: endIndex < templates.length,
          hasPrev: page > 1,
        },
        categories: [...new Set(mockWorkflowData.templates.map(t => t.category))],
      },
    })
  },

  // POST /api/workflows/templates/:templateId/create - Create from template
  async createFromTemplate(req: AuthRequest, res: Response) {
    const { templateId } = req.params
    const { name, description, customizations = {} } = req.body
    const userId = req.user!.id

    const template = mockWorkflowData.templates.find(t => t.id === templateId)

    if (!template) {
      throw new NotFoundError('Workflow template', templateId)
    }

    // Apply customizations to template
    const workflow: Workflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || template.name,
      description: description || template.description,
      ownerId: userId,
      triggers: applyCustomizations(template.triggers, customizations.triggers),
      steps: applyCustomizations(template.steps, customizations.steps),
      isActive: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      successRate: 0,
    }

    mockWorkflowData.workflows.set(workflow.id, workflow)

    // Register triggers
    await registerWorkflowTriggers(workflow)

    res.status(201).json({
      success: true,
      data: { workflow },
      message: 'Workflow created from template successfully',
    })
  },

  // GET /api/workflows/:id/metrics - Get workflow metrics
  async getWorkflowMetrics(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { period = '30d' } = req.query as any

    const workflow = mockWorkflowData.workflows.get(id)

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    const executions = Array.from(mockWorkflowData.executions.values())
      .filter(e => e.workflowId === id)

    const metrics = {
      overview: {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'completed').length,
        failedExecutions: executions.filter(e => e.status === 'failed').length,
        cancelledExecutions: executions.filter(e => e.status === 'cancelled').length,
        avgExecutionTime: calculateAvgExecutionTime(executions),
        successRate: workflow.successRate,
      },
      performance: {
        executionsByDay: generateExecutionTimeSeries(executions, period),
        avgStepDuration: calculateAvgStepDurations(executions),
        errorRate: calculateErrorRate(executions),
        throughput: calculateThroughput(executions),
      },
      bottlenecks: identifyBottlenecks(executions),
      errors: getCommonErrors(executions),
      recommendations: generatePerformanceRecommendations(workflow, executions),
    }

    res.json({
      success: true,
      data: { metrics, period },
      generatedAt: new Date(),
    })
  },
}

// Helper functions
function validateWorkflowStructure(workflow: { triggers: WorkflowTrigger[], steps: WorkflowStep[] }) {
  if (!workflow.triggers || workflow.triggers.length === 0) {
    return { valid: false, error: 'At least one trigger is required' }
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    return { valid: false, error: 'At least one step is required' }
  }

  // Validate step references
  const stepIds = new Set(workflow.steps.map(s => s.id))
  for (const step of workflow.steps) {
    if (step.onSuccess && !stepIds.has(step.onSuccess)) {
      return { valid: false, error: `Step ${step.id} references non-existent step: ${step.onSuccess}` }
    }
    if (step.onFailure && !stepIds.has(step.onFailure)) {
      return { valid: false, error: `Step ${step.id} references non-existent step: ${step.onFailure}` }
    }
  }

  return { valid: true }
}

async function registerWorkflowTriggers(workflow: Workflow) {
  // Mock trigger registration
  console.log(`Registering triggers for workflow ${workflow.id}:`, workflow.triggers.map(t => t.type))
}

async function unregisterWorkflowTriggers(workflow: Workflow) {
  // Mock trigger unregistration
  console.log(`Unregistering triggers for workflow ${workflow.id}`)
}

async function executeWorkflowAsync(execution: WorkflowExecution, workflow: Workflow) {
  // Mock workflow execution using citty-pro
  try {
    for (const step of workflow.steps) {
      if (execution.status !== 'running') break

      const stepExecution = execution.steps.find(s => s.stepId === step.id)
      if (!stepExecution) continue

      stepExecution.status = 'running'
      stepExecution.startedAt = new Date()

      // Log step start
      execution.logs.push({
        id: `log-${Date.now()}`,
        timestamp: new Date(),
        level: 'info',
        message: `Starting step: ${step.name}`,
        stepId: step.id,
      })

      try {
        let result
        
        if (step.type === 'citty-pro') {
          // Execute citty-pro command
          result = await executeCittyProStep(step, execution.variables)
        } else {
          // Execute other step types
          result = await executeStandardStep(step, execution.variables)
        }

        stepExecution.status = 'completed'
        stepExecution.completedAt = new Date()
        stepExecution.output = result

        // Log step success
        execution.logs.push({
          id: `log-${Date.now()}`,
          timestamp: new Date(),
          level: 'info',
          message: `Step completed successfully: ${step.name}`,
          stepId: step.id,
          metadata: { output: result },
        })

      } catch (error: any) {
        stepExecution.status = 'failed'
        stepExecution.completedAt = new Date()
        stepExecution.error = error.message

        // Log step failure
        execution.logs.push({
          id: `log-${Date.now()}`,
          timestamp: new Date(),
          level: 'error',
          message: `Step failed: ${step.name} - ${error.message}`,
          stepId: step.id,
          metadata: { error: error.message },
        })

        // Handle failure flow
        if (step.onFailure) {
          // Continue to failure step
          continue
        } else {
          // Fail entire execution
          execution.status = 'failed'
          execution.error = `Step ${step.name} failed: ${error.message}`
          break
        }
      }

      // Add delay between steps
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (execution.status === 'running') {
      execution.status = 'completed'
      execution.completedAt = new Date()

      // Update workflow success rate
      const allExecutions = Array.from(mockWorkflowData.executions.values())
        .filter(e => e.workflowId === workflow.id)
      
      const successfulCount = allExecutions.filter(e => e.status === 'completed').length
      workflow.successRate = (successfulCount / allExecutions.length) * 100
    }

  } catch (error: any) {
    execution.status = 'failed'
    execution.error = error.message
    execution.completedAt = new Date()
  }
}

async function executeCittyProStep(step: WorkflowStep, variables: Record<string, any>) {
  // Mock citty-pro command execution
  const command = step.config.cittyProCommand
  const args = step.config.cittyProArgs || {}

  // Replace variables in args
  const resolvedArgs = resolveVariables(args, variables)

  console.log(`Executing citty-pro command: ${command}`, resolvedArgs)

  // Simulate different command types
  switch (command) {
    case 'payment-processor':
      return {
        paymentId: `pay_${Date.now()}`,
        status: 'captured',
        amount: resolvedArgs.amount,
      }
    
    case 'inventory-updater':
      return {
        itemId: resolvedArgs.itemId,
        previousStock: 10,
        newStock: 9,
        updated: true,
      }
    
    case 'notification-sender':
      return {
        notificationId: `notif_${Date.now()}`,
        sent: true,
        recipient: resolvedArgs.recipient,
      }
    
    default:
      // Generic command execution
      return {
        command,
        args: resolvedArgs,
        executed: true,
        timestamp: new Date(),
      }
  }
}

async function executeStandardStep(step: WorkflowStep, variables: Record<string, any>) {
  // Mock standard step execution
  switch (step.type) {
    case 'action':
      return { action: step.config.action, result: 'success' }
    
    case 'condition':
      return { condition: step.config.condition, result: true }
    
    case 'delay':
      await new Promise(resolve => setTimeout(resolve, step.config.delay || 1000))
      return { delayed: step.config.delay || 1000 }
    
    default:
      return { type: step.type, result: 'completed' }
  }
}

function resolveVariables(obj: any, variables: Record<string, any>): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, key) => {
      return variables[key] ?? match
    })
  } else if (Array.isArray(obj)) {
    return obj.map(item => resolveVariables(item, variables))
  } else if (obj && typeof obj === 'object') {
    const resolved: any = {}
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveVariables(value, variables)
    }
    return resolved
  }
  return obj
}

async function waitForExecution(executionId: string, timeout: number): Promise<WorkflowExecution> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      const execution = mockWorkflowData.executions.get(executionId)
      
      if (!execution) {
        clearInterval(interval)
        reject(new Error('Execution not found'))
        return
      }

      if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
        clearInterval(interval)
        resolve(execution)
        return
      }

      if (Date.now() - start > timeout) {
        clearInterval(interval)
        reject(new Error('Execution timeout'))
        return
      }
    }, 1000)
  })
}

function generateWorkflowTemplates() {
  return [
    {
      id: 'template-order-processing',
      name: 'Order Processing',
      description: 'Complete order processing workflow with payment and inventory',
      category: 'e-commerce',
      tags: ['order', 'payment', 'inventory'],
      triggers: [
        {
          id: 'trigger-1',
          type: 'event' as const,
          config: { event: 'order.created' }
        }
      ],
      steps: [
        {
          id: 'validate',
          name: 'Validate Order',
          type: 'citty-pro' as const,
          config: {
            cittyProCommand: 'order-validator',
            cittyProArgs: { orderId: '${order.id}' }
          }
        }
      ],
    },
    {
      id: 'template-user-onboarding',
      name: 'User Onboarding',
      description: 'Welcome new users with email sequence and account setup',
      category: 'user-management',
      tags: ['onboarding', 'email', 'welcome'],
      triggers: [
        {
          id: 'trigger-1',
          type: 'event' as const,
          config: { event: 'user.registered' }
        }
      ],
      steps: [
        {
          id: 'welcome-email',
          name: 'Send Welcome Email',
          type: 'citty-pro' as const,
          config: {
            cittyProCommand: 'email-sender',
            cittyProArgs: { template: 'welcome', userId: '${user.id}' }
          }
        }
      ],
    }
  ]
}

function applyCustomizations(original: any, customizations: any): any {
  if (!customizations) return original
  return { ...original, ...customizations }
}

function calculateAvgExecutionTime(executions: WorkflowExecution[]): number {
  const completed = executions.filter(e => e.completedAt)
  if (completed.length === 0) return 0
  
  const totalTime = completed.reduce((sum, e) => 
    sum + (e.completedAt!.getTime() - e.startedAt.getTime()), 0)
  
  return totalTime / completed.length / 1000 // seconds
}

function generateExecutionTimeSeries(executions: WorkflowExecution[], period: string) {
  // Mock time series data
  const series = []
  const days = period === '7d' ? 7 : 30
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    series.push({
      date: date.toISOString().split('T')[0],
      executions: Math.floor(Math.random() * 10) + 1,
      successful: Math.floor(Math.random() * 8) + 1,
      failed: Math.floor(Math.random() * 2),
    })
  }
  
  return series
}

function calculateAvgStepDurations(executions: WorkflowExecution[]) {
  // Mock step duration analysis
  return [
    { stepName: 'Validate Order', avgDuration: 2.3 },
    { stepName: 'Process Payment', avgDuration: 15.7 },
    { stepName: 'Update Inventory', avgDuration: 1.8 },
    { stepName: 'Send Confirmation', avgDuration: 3.2 },
  ]
}

function calculateErrorRate(executions: WorkflowExecution[]): number {
  const failed = executions.filter(e => e.status === 'failed').length
  return executions.length > 0 ? (failed / executions.length) * 100 : 0
}

function calculateThroughput(executions: WorkflowExecution[]): number {
  // Executions per hour
  return executions.length > 0 ? executions.length / 24 : 0
}

function identifyBottlenecks(executions: WorkflowExecution[]) {
  return [
    {
      step: 'Process Payment',
      avgDuration: 15.7,
      impact: 'high',
      recommendation: 'Optimize payment gateway integration',
    }
  ]
}

function getCommonErrors(executions: WorkflowExecution[]) {
  return [
    {
      error: 'Payment gateway timeout',
      count: 12,
      percentage: 8.5,
    },
    {
      error: 'Inventory service unavailable',
      count: 5,
      percentage: 3.5,
    }
  ]
}

function generatePerformanceRecommendations(workflow: Workflow, executions: WorkflowExecution[]) {
  return [
    {
      type: 'performance',
      title: 'Add timeout to payment step',
      description: 'Payment step is taking longer than expected',
      impact: 'medium',
    },
    {
      type: 'reliability',
      title: 'Add retry logic to inventory update',
      description: 'Inventory service has occasional failures',
      impact: 'high',
    }
  ]
}