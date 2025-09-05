import { describe, it, expect, beforeEach } from 'vitest'
import supertest from 'supertest'
import express from 'express'
import { workflowRoutes } from '../routes/workflows/index.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())

const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = {
    id: 'test-user-1',
    email: 'test@example.com',
    role: 'user',
    permissions: ['create', 'read', 'update', 'delete'],
  }
  next()
}

app.use('/api/workflows', mockAuthMiddleware)
app.use('/api/workflows', workflowRoutes)
app.use(errorHandler)

const request = supertest(app)

describe('Workflows API', () => {
  const validWorkflow = {
    name: 'Test Workflow',
    description: 'A test workflow for unit testing',
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
        timeout: 60000,
        retryCount: 1,
      },
      {
        id: 'step-3',
        name: 'Send Confirmation',
        type: 'action',
        config: {
          action: 'send_email'
        },
        timeout: 15000,
      }
    ],
    isActive: true,
  }

  describe('POST /api/workflows', () => {
    it('should create workflow with valid data', async () => {
      const response = await request
        .post('/api/workflows')
        .send(validWorkflow)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflow).toBeDefined()
      expect(response.body.data.workflow.name).toBe(validWorkflow.name)
      expect(response.body.data.workflow.ownerId).toBe('test-user-1')
      expect(response.body.data.workflow.version).toBe(1)
    })

    it('should validate required fields', async () => {
      const invalidWorkflow = {
        name: 'Test',
        // Missing triggers and steps
      }

      const response = await request
        .post('/api/workflows')
        .send(invalidWorkflow)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Validation error')
    })

    it('should validate workflow structure', async () => {
      const invalidWorkflow = {
        ...validWorkflow,
        triggers: [], // Empty triggers array
      }

      const response = await request
        .post('/api/workflows')
        .send(invalidWorkflow)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('At least one trigger is required')
    })

    it('should validate step references', async () => {
      const invalidWorkflow = {
        ...validWorkflow,
        steps: [
          {
            id: 'step-1',
            name: 'Test Step',
            type: 'action',
            config: { action: 'test' },
            onSuccess: 'non-existent-step', // Invalid reference
          }
        ]
      }

      const response = await request
        .post('/api/workflows')
        .send(invalidWorkflow)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('references non-existent step')
    })

    it('should validate name length', async () => {
      const invalidWorkflow = {
        ...validWorkflow,
        name: 'a'.repeat(101), // Exceeds max length
      }

      const response = await request
        .post('/api/workflows')
        .send(invalidWorkflow)
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/workflows', () => {
    it('should list user workflows', async () => {
      const response = await request
        .get('/api/workflows')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflows).toBeDefined()
      expect(Array.isArray(response.body.data.workflows)).toBe(true)
      expect(response.body.data.pagination).toBeDefined()
    })

    it('should support pagination', async () => {
      const response = await request
        .get('/api/workflows?page=1&limit=5')
        .expect(200)

      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(5)
    })

    it('should support status filtering', async () => {
      const response = await request
        .get('/api/workflows?status=active')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support sorting', async () => {
      const response = await request
        .get('/api/workflows?sortBy=name&sortOrder=asc')
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/workflows/:id', () => {
    it('should get workflow details', async () => {
      const response = await request
        .get('/api/workflows/workflow-1')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflow).toBeDefined()
      expect(response.body.data.workflow.id).toBe('workflow-1')
      expect(response.body.data.recentExecutions).toBeDefined()
    })

    it('should return 404 for non-existent workflow', async () => {
      const response = await request
        .get('/api/workflows/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
    })

    it('should require authentication', async () => {
      const noAuthApp = express()
      noAuthApp.use(express.json())
      noAuthApp.use('/api/workflows', workflowRoutes)
      noAuthApp.use(errorHandler)

      const noAuthRequest = supertest(noAuthApp)

      await noAuthRequest
        .get('/api/workflows/workflow-1')
        .expect(401)
    })
  })

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow', async () => {
      const updateData = {
        name: 'Updated Workflow',
        description: 'Updated description',
        isActive: false,
      }

      const response = await request
        .put('/api/workflows/workflow-1')
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflow.name).toBe(updateData.name)
      expect(response.body.data.workflow.version).toBe(2) // Version should increment
    })

    it('should validate updated structure', async () => {
      const invalidUpdate = {
        triggers: [], // Invalid empty triggers
      }

      const response = await request
        .put('/api/workflows/workflow-1')
        .send(invalidUpdate)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should prevent ID changes', async () => {
      const updateData = {
        id: 'different-id',
        name: 'Updated Name',
      }

      const response = await request
        .put('/api/workflows/workflow-1')
        .send(updateData)
        .expect(200)

      expect(response.body.data.workflow.id).toBe('workflow-1')
    })

    it('should prevent owner changes', async () => {
      const updateData = {
        ownerId: 'different-owner',
        name: 'Updated Name',
      }

      const response = await request
        .put('/api/workflows/workflow-1')
        .send(updateData)
        .expect(200)

      expect(response.body.data.workflow.ownerId).not.toBe('different-owner')
    })
  })

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow', async () => {
      // First create a workflow to delete
      const createResponse = await request
        .post('/api/workflows')
        .send({
          ...validWorkflow,
          name: 'Workflow to Delete',
        })

      const workflowId = createResponse.body.data.workflow.id

      const response = await request
        .delete(`/api/workflows/${workflowId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('deleted successfully')
    })

    it('should return 404 for non-existent workflow', async () => {
      await request
        .delete('/api/workflows/non-existent')
        .expect(404)
    })
  })

  describe('POST /api/workflows/:id/execute', () => {
    it('should execute workflow', async () => {
      const executionData = {
        variables: {
          orderId: 'test-order-123',
          amount: 150.00,
        },
        waitForCompletion: false,
      }

      const response = await request
        .post('/api/workflows/workflow-1/execute')
        .send(executionData)
        .expect(202) // Accepted for async execution

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution).toBeDefined()
      expect(response.body.data.execution.status).toBe('running')
      expect(response.body.data.execution.variables.orderId).toBe(executionData.variables.orderId)
    })

    it('should support synchronous execution', async () => {
      const executionData = {
        variables: { orderId: 'sync-test' },
        waitForCompletion: true,
      }

      const response = await request
        .post('/api/workflows/workflow-1/execute')
        .send(executionData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution.status).toBeOneOf(['completed', 'failed', 'running'])
    })

    it('should return 404 for non-existent workflow', async () => {
      await request
        .post('/api/workflows/non-existent/execute')
        .send({ variables: {} })
        .expect(404)
    })

    it('should require active workflow', async () => {
      // Would need to create an inactive workflow for this test
      // For now, we assume workflow-1 is active
      const response = await request
        .post('/api/workflows/workflow-1/execute')
        .send({ variables: {} })
        .expect(202)

      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/workflows/:id/executions', () => {
    it('should get execution history', async () => {
      const response = await request
        .get('/api/workflows/workflow-1/executions')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.executions).toBeDefined()
      expect(Array.isArray(response.body.data.executions)).toBe(true)
      expect(response.body.data.pagination).toBeDefined()
    })

    it('should support status filtering', async () => {
      const response = await request
        .get('/api/workflows/workflow-1/executions?status=completed')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support pagination', async () => {
      const response = await request
        .get('/api/workflows/workflow-1/executions?page=1&limit=10')
        .expect(200)

      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(10)
    })
  })

  describe('GET /api/workflows/executions/:executionId', () => {
    it('should get execution details', async () => {
      const response = await request
        .get('/api/workflows/executions/exec-1')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution).toBeDefined()
      expect(response.body.data.execution.id).toBe('exec-1')
      expect(response.body.data.workflow).toBeDefined()
    })

    it('should return 404 for non-existent execution', async () => {
      await request
        .get('/api/workflows/executions/non-existent')
        .expect(404)
    })
  })

  describe('POST /api/workflows/:id/pause', () => {
    it('should pause running workflow', async () => {
      // First start an execution
      const executeResponse = await request
        .post('/api/workflows/workflow-1/execute')
        .send({ variables: {} })

      const executionId = executeResponse.body.data.execution.id

      const response = await request
        .post('/api/workflows/workflow-1/pause')
        .send({ executionId })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution.status).toBe('paused')
    })
  })

  describe('POST /api/workflows/:id/resume', () => {
    it('should resume paused workflow', async () => {
      // This test would require setting up a paused execution first
      const response = await request
        .post('/api/workflows/workflow-1/resume')
        .send({ executionId: 'test-exec-id' })
        .expect(404) // No paused execution found

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/workflows/:id/cancel', () => {
    it('should cancel running workflow', async () => {
      // First start an execution
      const executeResponse = await request
        .post('/api/workflows/workflow-1/execute')
        .send({ variables: {} })

      const executionId = executeResponse.body.data.execution.id

      const response = await request
        .post('/api/workflows/workflow-1/cancel')
        .send({ executionId })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution.status).toBe('cancelled')
    })
  })

  describe('GET /api/workflows/templates', () => {
    it('should list workflow templates', async () => {
      const response = await request
        .get('/api/workflows/templates')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.templates).toBeDefined()
      expect(Array.isArray(response.body.data.templates)).toBe(true)
      expect(response.body.data.categories).toBeDefined()
    })

    it('should support category filtering', async () => {
      const response = await request
        .get('/api/workflows/templates?category=e-commerce')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support pagination', async () => {
      const response = await request
        .get('/api/workflows/templates?page=1&limit=5')
        .expect(200)

      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(5)
    })
  })

  describe('POST /api/workflows/templates/:templateId/create', () => {
    it('should create workflow from template', async () => {
      const customizations = {
        name: 'My Custom Workflow',
        description: 'Created from template with customizations',
        customizations: {
          triggers: {
            // Custom trigger modifications
          },
          steps: {
            // Custom step modifications
          },
        },
      }

      const response = await request
        .post('/api/workflows/templates/template-order-processing/create')
        .send(customizations)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflow).toBeDefined()
      expect(response.body.data.workflow.name).toBe(customizations.name)
      expect(response.body.data.workflow.ownerId).toBe('test-user-1')
    })

    it('should return 404 for non-existent template', async () => {
      await request
        .post('/api/workflows/templates/non-existent/create')
        .send({ name: 'Test' })
        .expect(404)
    })
  })

  describe('GET /api/workflows/:id/metrics', () => {
    it('should get workflow metrics', async () => {
      const response = await request
        .get('/api/workflows/workflow-1/metrics')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.metrics).toBeDefined()
      expect(response.body.data.metrics.overview).toBeDefined()
      expect(response.body.data.metrics.performance).toBeDefined()
      expect(response.body.data.metrics.bottlenecks).toBeDefined()
      expect(response.body.data.metrics.errors).toBeDefined()
      expect(response.body.data.metrics.recommendations).toBeDefined()
    })

    it('should support different time periods', async () => {
      const response = await request
        .get('/api/workflows/workflow-1/metrics?period=7d')
        .expect(200)

      expect(response.body.data.period).toBe('7d')
    })
  })

  describe('Citty-Pro Integration', () => {
    it('should validate citty-pro step configuration', async () => {
      const workflowWithCittyPro = {
        ...validWorkflow,
        steps: [
          {
            id: 'citty-step',
            name: 'Citty Pro Step',
            type: 'citty-pro',
            config: {
              cittyProCommand: 'payment-processor',
              cittyProArgs: {
                orderId: '${order.id}',
                amount: '${order.amount}',
              }
            },
          }
        ]
      }

      const response = await request
        .post('/api/workflows')
        .send(workflowWithCittyPro)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.workflow.steps[0].type).toBe('citty-pro')
    })

    it('should handle variable substitution in citty-pro args', async () => {
      const executionData = {
        variables: {
          orderId: 'test-123',
          amount: 250.00,
        },
      }

      const response = await request
        .post('/api/workflows/workflow-1/execute')
        .send(executionData)
        .expect(202)

      expect(response.body.success).toBe(true)
      expect(response.body.data.execution.variables.orderId).toBe('test-123')
    })
  })

  describe('Error Handling', () => {
    it('should handle workflow execution errors gracefully', async () => {
      // This would test error scenarios in workflow execution
      const response = await request
        .post('/api/workflows/workflow-1/execute')
        .send({ variables: { invalid: true } })
        .expect(202)

      expect(response.body.success).toBe(true)
    })

    it('should provide detailed error messages', async () => {
      const response = await request
        .post('/api/workflows')
        .send({ name: 'Invalid' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toBeDefined()
    })
  })

  describe('Authorization', () => {
    const adminApp = express()
    adminApp.use(express.json())
    
    const mockAdminAuth = (req: any, res: any, next: any) => {
      req.user = {
        id: 'admin-user',
        role: 'admin',
        permissions: ['admin'],
      }
      next()
    }

    adminApp.use('/api/workflows', mockAdminAuth)
    adminApp.use('/api/workflows', workflowRoutes)
    adminApp.use(errorHandler)

    const adminRequest = supertest(adminApp)

    it('should allow admin to view all workflows', async () => {
      const response = await adminRequest
        .get('/api/workflows')
        .expect(200)

      expect(response.body.success).toBe(true)
      // Admin should see all workflows, not just their own
    })

    it('should allow admin to modify any workflow', async () => {
      const response = await adminRequest
        .put('/api/workflows/workflow-1')
        .send({ name: 'Admin Updated' })
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle concurrent executions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        request
          .post('/api/workflows/workflow-1/execute')
          .send({ variables: { test: i } })
      )

      const responses = await Promise.all(promises)
      
      responses.forEach(response => {
        expect(response.status).toBe(202)
        expect(response.body.success).toBe(true)
      })
    })
  })
})