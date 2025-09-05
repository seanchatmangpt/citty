import { z } from 'zod';
import {
  MultiDimensionalEntitySchema,
  TemporalDimensionSchema,
  DimensionalAttributeSchema
} from '../base/dimensional-schema.js';

/**
 * Marketplace Workflow Models
 * Comprehensive workflow management for marketplace operations with state machines and automation
 */

// Workflow types for different marketplace operations
export const WorkflowTypeSchema = z.enum([
  'order_fulfillment',
  'dispute_resolution',
  'vendor_onboarding',
  'product_approval',
  'payment_processing',
  'shipping_logistics',
  'customer_support',
  'review_moderation',
  'refund_processing',
  'subscription_management',
  'inventory_management',
  'quality_assurance',
  'compliance_check',
  'marketing_campaign',
  'data_migration',
  'system_maintenance',
  'user_verification',
  'fraud_detection',
  'content_moderation',
  'analytics_reporting'
]);

export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;

// Workflow execution status
export const WorkflowStatusSchema = z.enum([
  'draft',
  'active',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'suspended',
  'archived',
  'error',
  'timeout'
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

// Task/step status within workflows
export const TaskStatusSchema = z.enum([
  'pending',
  'ready',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'skipped',
  'timeout',
  'error',
  'retry'
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Task execution types
export const TaskTypeSchema = z.enum([
  'manual',
  'automated',
  'api_call',
  'webhook',
  'email',
  'sms',
  'database_query',
  'file_processing',
  'data_validation',
  'ml_inference',
  'approval',
  'notification',
  'calculation',
  'conditional',
  'loop',
  'parallel',
  'external_system',
  'user_input',
  'timer'
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

// Condition operators for workflow logic
export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_equal',
  'less_equal',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'regex',
  'in',
  'not_in',
  'exists',
  'not_exists',
  'is_empty',
  'is_not_empty'
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

// Workflow condition
export const WorkflowConditionSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: ConditionOperatorSchema,
  value: z.any(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
  
  // Logical operators
  logicalOperator: z.enum(['and', 'or', 'not']).optional(),
  
  // Nested conditions
  conditions: z.array(z.lazy(() => WorkflowConditionSchema)).optional(),
  
  // Dynamic evaluation
  dynamic: z.boolean().default(false),
  expression: z.string().optional(), // JavaScript-like expression
  
  // Metadata
  description: z.string().optional(),
  tags: z.array(z.string()).default([])
});

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;

// Task configuration
export const WorkflowTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: TaskTypeSchema,
  
  // Task configuration
  config: z.object({
    // API call configuration
    apiCall: z.object({
      url: z.string().url(),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
      headers: z.record(z.string()).optional(),
      body: z.record(z.any()).optional(),
      timeout: z.number().int().positive().default(30000), // ms
      retries: z.number().int().nonnegative().default(3)
    }).optional(),
    
    // Email configuration
    email: z.object({
      template: z.string(),
      to: z.array(z.string()),
      cc: z.array(z.string()).optional(),
      bcc: z.array(z.string()).optional(),
      subject: z.string(),
      variables: z.record(z.any()).optional()
    }).optional(),
    
    // Database query configuration
    database: z.object({
      operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      table: z.string(),
      query: z.string(),
      parameters: z.record(z.any()).optional(),
      transaction: z.boolean().default(false)
    }).optional(),
    
    // ML inference configuration
    mlInference: z.object({
      model: z.string(),
      inputMapping: z.record(z.string()),
      outputMapping: z.record(z.string()),
      threshold: z.number().min(0).max(1).optional()
    }).optional(),
    
    // Timer configuration
    timer: z.object({
      duration: z.number().int().positive(), // seconds
      type: z.enum(['delay', 'deadline', 'interval'])
    }).optional(),
    
    // Approval configuration
    approval: z.object({
      approvers: z.array(z.string()),
      requiredApprovals: z.number().int().positive().default(1),
      timeout: z.number().int().positive().optional(), // seconds
      escalation: z.array(z.string()).optional()
    }).optional(),
    
    // Custom configuration
    custom: z.record(z.any()).optional()
  }).optional(),
  
  // Input/Output mapping
  inputs: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
    required: z.boolean().default(false),
    defaultValue: z.any().optional(),
    source: z.string().optional(), // field path from workflow context
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      enum: z.array(z.string()).optional()
    }).optional()
  })).default([]),
  
  outputs: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
    description: z.string().optional(),
    destination: z.string().optional() // field path in workflow context
  })).default([]),
  
  // Execution settings
  execution: z.object({
    timeout: z.number().int().positive().default(300), // seconds
    retries: z.number().int().nonnegative().default(0),
    retryDelay: z.number().int().positive().default(60), // seconds
    continueOnError: z.boolean().default(false),
    parallel: z.boolean().default(false),
    priority: z.number().int().min(1).max(10).default(5)
  }).default({
    timeout: 300,
    retries: 0,
    retryDelay: 60,
    continueOnError: false,
    parallel: false,
    priority: 5
  }),
  
  // Conditions for task execution
  conditions: z.object({
    preconditions: z.array(WorkflowConditionSchema).default([]),
    postconditions: z.array(WorkflowConditionSchema).default([])
  }).default({
    preconditions: [],
    postconditions: []
  }),
  
  // Dependencies
  dependencies: z.array(z.string()).default([]), // task IDs
  
  // Assignment
  assignee: z.object({
    type: z.enum(['user', 'role', 'system', 'auto']),
    id: z.string().optional(),
    autoAssign: z.object({
      criteria: z.record(z.any()).optional(),
      loadBalancing: z.boolean().default(false),
      skillMatching: z.boolean().default(false)
    }).optional()
  }).optional(),
  
  // User interface for manual tasks
  ui: z.object({
    form: z.array(z.object({
      field: z.string(),
      label: z.string(),
      type: z.enum(['text', 'number', 'boolean', 'date', 'select', 'multiselect', 'file']),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
      validation: z.record(z.any()).optional()
    })).optional(),
    instructions: z.string().optional(),
    helpText: z.string().optional()
  }).optional(),
  
  // Status tracking
  status: TaskStatusSchema.default('pending'),
  result: z.record(z.any()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
    timestamp: z.coerce.date()
  }).optional(),
  
  // Execution history
  executions: z.array(z.object({
    id: z.string(),
    startedAt: z.coerce.date(),
    completedAt: z.coerce.date().optional(),
    status: TaskStatusSchema,
    result: z.record(z.any()).optional(),
    error: z.string().optional(),
    executedBy: z.string().optional()
  })).default([]),
  
  // Timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  scheduledAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

export type WorkflowTask = z.infer<typeof WorkflowTaskSchema>;

// Workflow transition/connection between tasks
export const WorkflowTransitionSchema = z.object({
  id: z.string(),
  fromTask: z.string(),
  toTask: z.string(),
  
  // Transition conditions
  conditions: z.array(WorkflowConditionSchema).default([]),
  
  // Transition type
  type: z.enum(['success', 'failure', 'conditional', 'timeout', 'manual']).default('success'),
  
  // Data mapping between tasks
  dataMapping: z.array(z.object({
    source: z.string(), // field path from source task
    target: z.string(), // field path for target task
    transform: z.string().optional() // transformation expression
  })).default([]),
  
  // Transition settings
  priority: z.number().int().min(1).max(10).default(5),
  delay: z.number().int().nonnegative().default(0), // seconds
  
  // Labels and metadata
  label: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type WorkflowTransition = z.infer<typeof WorkflowTransitionSchema>;

// Workflow execution instance
export const WorkflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowVersion: z.number().int().positive(),
  
  // Execution context
  context: z.record(z.any()).default({}),
  inputs: z.record(z.any()).default({}),
  outputs: z.record(z.any()).default({}),
  
  // Status and lifecycle
  status: WorkflowStatusSchema.default('running'),
  
  // Execution metadata
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  duration: z.number().int().nonnegative().optional(), // seconds
  
  // Task execution state
  currentTasks: z.array(z.string()).default([]),
  completedTasks: z.array(z.string()).default([]),
  failedTasks: z.array(z.string()).default([]),
  
  // User and system information
  initiatedBy: z.string(),
  executedBy: z.array(z.string()).default([]),
  
  // Priority and scheduling
  priority: z.number().int().min(1).max(10).default(5),
  scheduledAt: z.coerce.date().optional(),
  
  // Error handling
  errors: z.array(z.object({
    taskId: z.string().optional(),
    code: z.string(),
    message: z.string(),
    timestamp: z.coerce.date(),
    resolved: z.boolean().default(false)
  })).default([]),
  
  // Metrics
  metrics: z.object({
    tasksTotal: z.number().int().nonnegative(),
    tasksCompleted: z.number().int().nonnegative(),
    tasksFailed: z.number().int().nonnegative(),
    averageTaskDuration: z.number().positive().optional(),
    totalCost: z.number().min(0).optional(),
    resourceUtilization: z.record(z.number()).optional()
  }).optional(),
  
  // Audit trail
  auditLog: z.array(z.object({
    timestamp: z.coerce.date(),
    action: z.string(),
    actor: z.string(),
    details: z.record(z.any()).optional()
  })).default([]),
  
  // Parent/child relationships
  parentExecution: z.string().optional(),
  childExecutions: z.array(z.string()).default([]),
  
  // External references
  externalReferences: z.record(z.string()).optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// Main workflow definition
export const MarketplaceWorkflowSchema = MultiDimensionalEntitySchema.extend({
  name: z.string(),
  description: z.string().optional(),
  type: WorkflowTypeSchema,
  
  // Version control
  version: z.number().int().positive().default(1),
  versionNotes: z.string().optional(),
  
  // Workflow definition
  definition: z.object({
    // Tasks and their configuration
    tasks: z.array(WorkflowTaskSchema),
    
    // Transitions between tasks
    transitions: z.array(WorkflowTransitionSchema),
    
    // Start and end points
    startTasks: z.array(z.string()),
    endTasks: z.array(z.string()),
    
    // Global variables and configuration
    variables: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
      defaultValue: z.any().optional(),
      description: z.string().optional(),
      required: z.boolean().default(false)
    })).default([]),
    
    // Global settings
    settings: z.object({
      timeout: z.number().int().positive().default(3600), // seconds
      maxConcurrentExecutions: z.number().int().positive().default(10),
      retentionPeriod: z.number().int().positive().default(90), // days
      notificationsEnabled: z.boolean().default(true),
      auditEnabled: z.boolean().default(true)
    }).default({
      timeout: 3600,
      maxConcurrentExecutions: 10,
      retentionPeriod: 90,
      notificationsEnabled: true,
      auditEnabled: true
    })
  }),
  
  // Workflow status and lifecycle
  status: WorkflowStatusSchema.default('draft'),
  
  // Access control
  permissions: z.object({
    owner: z.string(),
    editors: z.array(z.string()).default([]),
    viewers: z.array(z.string()).default([]),
    executors: z.array(z.string()).default([]),
    public: z.boolean().default(false)
  }),
  
  // Triggers for workflow execution
  triggers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['manual', 'scheduled', 'event', 'webhook', 'api', 'condition']),
    
    // Trigger configuration
    config: z.object({
      // Scheduled trigger
      schedule: z.object({
        cron: z.string(),
        timezone: z.string().default('UTC'),
        enabled: z.boolean().default(true)
      }).optional(),
      
      // Event trigger
      event: z.object({
        source: z.string(),
        eventType: z.string(),
        filters: z.record(z.any()).optional()
      }).optional(),
      
      // Webhook trigger
      webhook: z.object({
        endpoint: z.string(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        authentication: z.enum(['none', 'basic', 'bearer', 'api_key']).default('none'),
        secretKey: z.string().optional()
      }).optional(),
      
      // Condition trigger
      condition: z.object({
        conditions: z.array(WorkflowConditionSchema),
        checkInterval: z.number().int().positive().default(300) // seconds
      }).optional()
    }).optional(),
    
    enabled: z.boolean().default(true),
    metadata: z.record(z.any()).optional()
  })).default([]),
  
  // Execution statistics
  statistics: z.object({
    totalExecutions: z.number().int().nonnegative().default(0),
    successfulExecutions: z.number().int().nonnegative().default(0),
    failedExecutions: z.number().int().nonnegative().default(0),
    averageExecutionTime: z.number().positive().optional(),
    lastExecution: z.coerce.date().optional(),
    totalCost: z.number().min(0).default(0)
  }).default({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalCost: 0
  }),
  
  // Integration settings
  integrations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['api', 'database', 'message_queue', 'storage', 'notification', 'ml_service']),
    config: z.record(z.any()),
    enabled: z.boolean().default(true)
  })).default([]),
  
  // SLA and performance
  sla: z.object({
    maxExecutionTime: z.number().int().positive().optional(), // seconds
    successRate: z.number().min(0).max(1).optional(),
    availabilityTarget: z.number().min(0).max(1).optional(),
    alertThresholds: z.record(z.number()).optional()
  }).optional(),
  
  // Compliance and governance
  compliance: z.object({
    dataRetention: z.number().int().positive().default(365), // days
    encryption: z.boolean().default(true),
    auditRequired: z.boolean().default(false),
    regulations: z.array(z.string()).default([]),
    privacyLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal')
  }).default({
    dataRetention: 365,
    encryption: true,
    auditRequired: false,
    regulations: [],
    privacyLevel: 'internal'
  }),
  
  // Documentation and help
  documentation: z.object({
    overview: z.string().optional(),
    userGuide: z.string().optional(),
    troubleshooting: z.string().optional(),
    changelog: z.array(z.object({
      version: z.number().int().positive(),
      date: z.coerce.date(),
      changes: z.array(z.string()),
      author: z.string()
    })).default([])
  }).optional(),
  
  // Tags and categorization
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  // Lifecycle management
  publishedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  
  // External metadata
  externalId: z.string().optional(),
  source: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type MarketplaceWorkflow = z.infer<typeof MarketplaceWorkflowSchema>;

// Workflow template for reusable workflows
export const WorkflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  type: WorkflowTypeSchema,
  
  // Template definition (similar to workflow but with placeholders)
  template: z.object({
    tasks: z.array(WorkflowTaskSchema),
    transitions: z.array(WorkflowTransitionSchema),
    variables: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      defaultValue: z.any().optional(),
      description: z.string().optional(),
      placeholder: z.string().optional()
    }))
  }),
  
  // Template metadata
  version: z.number().int().positive().default(1),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).optional(),
  downloads: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;

// Workflow query schema
export const WorkflowQuerySchema = z.object({
  ids: z.array(z.string()).optional(),
  types: z.array(WorkflowTypeSchema).optional(),
  statuses: z.array(WorkflowStatusSchema).optional(),
  
  // Owner and permissions
  owner: z.string().optional(),
  hasPermission: z.enum(['view', 'edit', 'execute']).optional(),
  
  // Text search
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  
  // Date filters
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updatedAfter: z.coerce.date().optional(),
  updatedBefore: z.coerce.date().optional(),
  
  // Execution filters
  hasExecutions: z.boolean().optional(),
  executionStatus: z.array(WorkflowStatusSchema).optional(),
  minExecutions: z.number().int().nonnegative().optional(),
  
  // Performance filters
  minSuccessRate: z.number().min(0).max(1).optional(),
  maxAverageTime: z.number().positive().optional(),
  
  // Sorting
  sort: z.object({
    field: z.enum(['name', 'createdAt', 'updatedAt', 'executions', 'successRate']).default('updatedAt'),
    direction: z.enum(['asc', 'desc']).default('desc')
  }).optional(),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  }).optional()
});

export type WorkflowQuery = z.infer<typeof WorkflowQuerySchema>;

// Workflow creation and update DTOs
export const CreateWorkflowSchema = MarketplaceWorkflowSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  statistics: true
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;

export default {
  MarketplaceWorkflowSchema,
  WorkflowExecutionSchema,
  WorkflowTaskSchema,
  WorkflowTransitionSchema,
  WorkflowConditionSchema,
  WorkflowTemplateSchema,
  WorkflowQuerySchema,
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  WorkflowTypeSchema,
  WorkflowStatusSchema,
  TaskStatusSchema,
  TaskTypeSchema,
  ConditionOperatorSchema
};