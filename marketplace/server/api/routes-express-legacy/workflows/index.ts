import { Router } from 'express'
import { workflowController } from './controller.js'
import { validate, schemas, validateParams } from '../../middleware/validation.js'
import { requirePermission, requireRole } from '../../middleware/auth.js'
import { cacheHelpers } from '../../middleware/cache.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// POST /api/workflows - Create new workflow
router.post('/',
  requirePermission('create'),
  validate(schemas.createWorkflow),
  asyncHandler(workflowController.createWorkflow)
)

// GET /api/workflows - List workflows
router.get('/',
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(workflowController.getWorkflows)
)

// GET /api/workflows/:id - Get workflow details
router.get('/:id',
  validateParams.id,
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(workflowController.getWorkflow)
)

// PUT /api/workflows/:id - Update workflow
router.put('/:id',
  validateParams.id,
  requirePermission('update'),
  validate(schemas.createWorkflow),
  asyncHandler(workflowController.updateWorkflow)
)

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id',
  validateParams.id,
  requirePermission('delete'),
  asyncHandler(workflowController.deleteWorkflow)
)

// POST /api/workflows/:id/execute - Execute workflow
router.post('/:id/execute',
  validateParams.id,
  requirePermission('create'),
  asyncHandler(workflowController.executeWorkflow)
)

// GET /api/workflows/:id/executions - Get workflow execution history
router.get('/:id/executions',
  validateParams.id,
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(workflowController.getExecutionHistory)
)

// GET /api/workflows/executions/:executionId - Get execution details
router.get('/executions/:executionId',
  requirePermission('read'),
  cacheHelpers.userDataCache,
  asyncHandler(workflowController.getExecutionDetails)
)

// POST /api/workflows/:id/pause - Pause workflow execution
router.post('/:id/pause',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(workflowController.pauseWorkflow)
)

// POST /api/workflows/:id/resume - Resume paused workflow
router.post('/:id/resume',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(workflowController.resumeWorkflow)
)

// POST /api/workflows/:id/cancel - Cancel workflow execution
router.post('/:id/cancel',
  validateParams.id,
  requirePermission('update'),
  asyncHandler(workflowController.cancelWorkflow)
)

// GET /api/workflows/templates - Get workflow templates
router.get('/templates',
  requirePermission('read'),
  cacheHelpers.analyticsCache,
  asyncHandler(workflowController.getWorkflowTemplates)
)

// POST /api/workflows/templates/:templateId/create - Create workflow from template
router.post('/templates/:templateId/create',
  requirePermission('create'),
  asyncHandler(workflowController.createFromTemplate)
)

// GET /api/workflows/:id/metrics - Get workflow performance metrics
router.get('/:id/metrics',
  validateParams.id,
  requirePermission('read'),
  cacheHelpers.analyticsCache,
  asyncHandler(workflowController.getWorkflowMetrics)
)

export { router as workflowRoutes }