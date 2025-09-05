import { z } from 'zod';
import {
  MultiDimensionalEntitySchema,
  TemporalDimensionSchema,
  EconomicDimensionSchema,
  DimensionalAttributeSchema
} from '../base/dimensional-schema.js';

/**
 * Multi-Party Transaction Models for Marketplace
 * Supports complex transaction scenarios with multiple participants, stages, and dimensions
 */

// Transaction status states
export const TransactionStatusSchema = z.enum([
  'initialized',
  'pending',
  'processing',
  'awaiting_payment',
  'payment_processing',
  'paid',
  'confirmed',
  'in_progress',
  'fulfillment',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'cancelled',
  'refunded',
  'partially_refunded',
  'failed',
  'expired',
  'on_hold'
]);

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

// Transaction types
export const TransactionTypeSchema = z.enum([
  'purchase',
  'auction',
  'subscription',
  'rental',
  'service',
  'escrow',
  'marketplace',
  'p2p',
  'b2b',
  'b2c',
  'c2c',
  'donation',
  'investment',
  'licensing'
]);

export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// Party roles in transactions
export const PartyRoleSchema = z.enum([
  'buyer',
  'seller',
  'marketplace',
  'payment_processor',
  'escrow_agent',
  'shipping_provider',
  'insurance_provider',
  'tax_authority',
  'regulator',
  'arbitrator',
  'guarantor',
  'affiliate',
  'referrer',
  'service_provider',
  'intermediary'
]);

export type PartyRole = z.infer<typeof PartyRoleSchema>;

// Payment method types
export const PaymentMethodSchema = z.enum([
  'credit_card',
  'debit_card',
  'bank_transfer',
  'paypal',
  'stripe',
  'crypto',
  'wallet',
  'gift_card',
  'store_credit',
  'financing',
  'installments',
  'escrow',
  'cash_on_delivery',
  'barter',
  'points',
  'subscription'
]);

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// Transaction party information
export const TransactionPartySchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'business', 'system', 'third_party']),
  role: PartyRoleSchema,
  primaryRole: z.boolean().default(false),
  
  // Identity and verification
  identity: z.object({
    userId: z.string().optional(),
    businessId: z.string().optional(),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    verified: z.boolean().default(false),
    verificationLevel: z.enum(['none', 'basic', 'enhanced', 'premium']).default('none')
  }),
  
  // Financial information
  financial: z.object({
    accountId: z.string().optional(),
    paymentMethods: z.array(z.object({
      id: z.string(),
      type: PaymentMethodSchema,
      details: z.record(z.any()),
      preferred: z.boolean().default(false),
      verified: z.boolean().default(false)
    })).default([]),
    creditLimit: z.number().min(0).optional(),
    currentBalance: z.number().optional()
  }).optional(),
  
  // Address and location
  address: z.object({
    billing: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number()
      }).optional()
    }).optional(),
    shipping: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number()
      }).optional(),
      instructions: z.string().optional()
    }).optional()
  }).optional(),
  
  // Responsibilities and obligations
  responsibilities: z.array(z.object({
    type: z.string(),
    description: z.string(),
    deadline: z.coerce.date().optional(),
    penalty: z.object({
      type: z.enum(['fee', 'percentage', 'cancellation']),
      amount: z.number().min(0)
    }).optional(),
    completed: z.boolean().default(false),
    completedAt: z.coerce.date().optional()
  })).default([]),
  
  // Fees and commissions
  fees: z.array(z.object({
    type: z.string(),
    description: z.string(),
    calculation: z.enum(['fixed', 'percentage', 'tiered', 'formula']),
    value: z.number(),
    currency: z.string().default('USD'),
    payableBy: z.string().optional(),
    payableTo: z.string().optional()
  })).default([]),
  
  // Metadata
  metadata: z.record(z.any()).optional(),
  joinedAt: z.coerce.date(),
  leftAt: z.coerce.date().optional()
});

export type TransactionParty = z.infer<typeof TransactionPartySchema>;

// Transaction item/service details
export const TransactionItemSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  type: z.enum(['product', 'service', 'digital', 'subscription', 'custom']),
  
  // Basic information
  name: z.string(),
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  
  // Quantity and pricing
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  currency: z.string().default('USD'),
  
  // Discounts and adjustments
  discounts: z.array(z.object({
    type: z.enum(['percentage', 'fixed', 'coupon', 'bulk', 'loyalty']),
    value: z.number(),
    code: z.string().optional(),
    description: z.string().optional()
  })).default([]),
  
  taxes: z.array(z.object({
    type: z.string(),
    rate: z.number().min(0),
    amount: z.number().min(0),
    jurisdiction: z.string().optional()
  })).default([]),
  
  fees: z.array(z.object({
    type: z.string(),
    amount: z.number().min(0),
    description: z.string().optional()
  })).default([]),
  
  // Fulfillment details
  fulfillment: z.object({
    method: z.enum(['digital', 'shipping', 'pickup', 'service_delivery']),
    provider: z.string().optional(),
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.coerce.date().optional(),
    actualDelivery: z.coerce.date().optional(),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).default('pending')
  }).optional(),
  
  // Warranty and returns
  warranty: z.object({
    duration: z.number().int().positive(),
    unit: z.enum(['days', 'months', 'years']),
    coverage: z.string().optional(),
    provider: z.string().optional()
  }).optional(),
  
  returnPolicy: z.object({
    returnable: z.boolean().default(false),
    window: z.number().int().positive().optional(), // days
    conditions: z.array(z.string()).optional(),
    restockingFee: z.number().min(0).optional()
  }).optional(),
  
  // Metadata
  metadata: z.record(z.any()).optional(),
  customFields: z.record(z.any()).optional()
});

export type TransactionItem = z.infer<typeof TransactionItemSchema>;

// Payment information
export const PaymentInfoSchema = z.object({
  id: z.string(),
  method: PaymentMethodSchema,
  provider: z.string(),
  
  // Amount breakdown
  subtotal: z.number().min(0),
  taxes: z.number().min(0),
  fees: z.number().min(0),
  shipping: z.number().min(0),
  discounts: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().default('USD'),
  
  // Payment processing
  status: z.enum([
    'pending',
    'processing',
    'authorized',
    'captured',
    'settled',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded',
    'disputed'
  ]).default('pending'),
  
  providerTransactionId: z.string().optional(),
  authorizationCode: z.string().optional(),
  
  // Installments and splits
  installments: z.object({
    enabled: z.boolean().default(false),
    count: z.number().int().positive().optional(),
    schedule: z.array(z.object({
      amount: z.number().positive(),
      dueDate: z.coerce.date(),
      status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).default('pending')
    })).optional()
  }).optional(),
  
  splits: z.array(z.object({
    recipientId: z.string(),
    amount: z.number().positive(),
    percentage: z.number().min(0).max(100).optional(),
    description: z.string().optional(),
    status: z.enum(['pending', 'processed', 'failed']).default('pending')
  })).optional(),
  
  // Security and fraud
  security: z.object({
    fraudScore: z.number().min(0).max(1).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    cvvResult: z.string().optional(),
    avsResult: z.string().optional(),
    threeDSecure: z.boolean().optional()
  }).optional(),
  
  // Timing
  authorizedAt: z.coerce.date().optional(),
  capturedAt: z.coerce.date().optional(),
  settledAt: z.coerce.date().optional(),
  failedAt: z.coerce.date().optional(),
  
  // Error handling
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.coerce.date()
  })).default([])
});

export type PaymentInfo = z.infer<typeof PaymentInfoSchema>;

// Transaction workflow stage
export const TransactionStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  order: z.number().int().nonnegative(),
  
  // Stage configuration
  required: z.boolean().default(true),
  parallel: z.boolean().default(false),
  timeout: z.number().int().positive().optional(), // minutes
  
  // Conditions
  startConditions: z.array(z.object({
    type: z.string(),
    condition: z.string(),
    parameters: z.record(z.any()).optional()
  })).optional(),
  
  completionConditions: z.array(z.object({
    type: z.string(),
    condition: z.string(),
    parameters: z.record(z.any()).optional()
  })).optional(),
  
  // Actions
  actions: z.array(z.object({
    type: z.string(),
    action: z.string(),
    parameters: z.record(z.any()).optional(),
    automated: z.boolean().default(false),
    responsibleParty: z.string().optional()
  })).optional(),
  
  // Status tracking
  status: z.enum([
    'not_started',
    'waiting',
    'in_progress',
    'completed',
    'failed',
    'skipped',
    'cancelled'
  ]).default('not_started'),
  
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  
  // Results and outputs
  results: z.record(z.any()).optional(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.coerce.date()
  })).default([])
});

export type TransactionStage = z.infer<typeof TransactionStageSchema>;

// Main multi-party transaction schema
export const MultiPartyTransactionSchema = MultiDimensionalEntitySchema.extend({
  // Transaction identification
  transactionNumber: z.string(),
  externalId: z.string().optional(),
  type: TransactionTypeSchema,
  status: TransactionStatusSchema.default('initialized'),
  
  // Parties involved
  parties: z.array(TransactionPartySchema).min(2),
  
  // Items/services
  items: z.array(TransactionItemSchema).min(1),
  
  // Financial information
  payment: PaymentInfoSchema,
  
  // Workflow and stages
  workflow: z.object({
    stages: z.array(TransactionStageSchema),
    currentStage: z.string().optional(),
    completedStages: z.array(z.string()).default([]),
    failedStages: z.array(z.string()).default([])
  }),
  
  // Terms and conditions
  terms: z.object({
    agreement: z.string().optional(),
    conditions: z.array(z.object({
      type: z.string(),
      description: z.string(),
      accepted: z.boolean().default(false),
      acceptedBy: z.string().optional(),
      acceptedAt: z.coerce.date().optional()
    })).default([]),
    
    cancellation: z.object({
      allowed: z.boolean().default(true),
      window: z.number().int().positive().optional(), // hours
      penalty: z.object({
        type: z.enum(['fee', 'percentage', 'forfeit']),
        amount: z.number().min(0)
      }).optional(),
      conditions: z.array(z.string()).optional()
    }).optional(),
    
    dispute: z.object({
      resolution: z.enum(['arbitration', 'mediation', 'escalation']).default('arbitration'),
      timeLimit: z.number().int().positive().default(30), // days
      arbitrator: z.string().optional(),
      fees: z.object({
        amount: z.number().min(0),
        paidBy: z.enum(['buyer', 'seller', 'split', 'loser']).default('split')
      }).optional()
    }).optional()
  }).optional(),
  
  // Security and compliance
  security: z.object({
    encrypted: z.boolean().default(true),
    signature: z.string().optional(),
    hash: z.string().optional(),
    compliance: z.array(z.object({
      regulation: z.string(),
      status: z.enum(['compliant', 'non_compliant', 'pending', 'not_applicable']),
      details: z.string().optional()
    })).default([])
  }).optional(),
  
  // Communication and notifications
  communications: z.array(z.object({
    id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    type: z.enum(['email', 'sms', 'push', 'in_app', 'webhook']),
    subject: z.string().optional(),
    message: z.string(),
    sent: z.boolean().default(false),
    sentAt: z.coerce.date().optional(),
    delivered: z.boolean().default(false),
    deliveredAt: z.coerce.date().optional(),
    read: z.boolean().default(false),
    readAt: z.coerce.date().optional()
  })).default([]),
  
  // Audit trail
  auditTrail: z.array(z.object({
    id: z.string(),
    action: z.string(),
    actor: z.string(),
    actorType: z.enum(['user', 'system', 'api']),
    details: z.record(z.any()).optional(),
    timestamp: z.coerce.date(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional()
  })).default([]),
  
  // Metadata and analytics
  analytics: z.object({
    duration: z.number().positive().optional(), // seconds
    touchpoints: z.number().int().nonnegative().default(0),
    abandonment: z.object({
      stage: z.string().optional(),
      reason: z.string().optional(),
      timestamp: z.coerce.date().optional()
    }).optional(),
    satisfaction: z.object({
      score: z.number().min(1).max(5).optional(),
      feedback: z.string().optional(),
      respondent: z.string().optional()
    }).optional()
  }).optional(),
  
  // Related transactions
  relationships: z.object({
    parentTransaction: z.string().optional(),
    childTransactions: z.array(z.string()).default([]),
    relatedTransactions: z.array(z.string()).default([]),
    refunds: z.array(z.string()).default([]),
    disputes: z.array(z.string()).default([])
  }).default({
    childTransactions: [],
    relatedTransactions: [],
    refunds: [],
    disputes: []
  }),
  
  // Scheduling and deadlines
  schedule: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    milestones: z.array(z.object({
      name: z.string(),
      dueDate: z.coerce.date(),
      completed: z.boolean().default(false),
      completedAt: z.coerce.date().optional()
    })).default([]),
    reminders: z.array(z.object({
      type: z.string(),
      message: z.string(),
      sendAt: z.coerce.date(),
      sent: z.boolean().default(false)
    })).default([])
  }).optional(),
  
  // Performance metrics
  metrics: z.object({
    processingTime: z.number().positive().optional(),
    errorCount: z.number().int().nonnegative().default(0),
    retryCount: z.number().int().nonnegative().default(0),
    costAnalysis: z.object({
      processingCost: z.number().min(0).optional(),
      transactionFees: z.number().min(0).optional(),
      operationalCost: z.number().min(0).optional()
    }).optional()
  }).default({
    errorCount: 0,
    retryCount: 0
  })
});

export type MultiPartyTransaction = z.infer<typeof MultiPartyTransactionSchema>;

// Transaction query and filtering
export const TransactionQuerySchema = z.object({
  filters: z.object({
    transactionIds: z.array(z.string()).optional(),
    types: z.array(TransactionTypeSchema).optional(),
    statuses: z.array(TransactionStatusSchema).optional(),
    partyIds: z.array(z.string()).optional(),
    partyRoles: z.array(PartyRoleSchema).optional(),
    itemIds: z.array(z.string()).optional(),
    
    dateRange: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      field: z.enum(['createdAt', 'updatedAt', 'completedAt']).default('createdAt')
    }).optional(),
    
    amountRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().default('USD')
    }).optional(),
    
    paymentMethods: z.array(PaymentMethodSchema).optional(),
    currencies: z.array(z.string()).optional()
  }).optional(),
  
  aggregations: z.array(z.object({
    field: z.string(),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']),
    groupBy: z.array(z.string()).optional()
  })).optional(),
  
  sort: z.object({
    field: z.string().default('createdAt'),
    direction: z.enum(['asc', 'desc']).default('desc')
  }).optional(),
  
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(1000).default(50)
  }).optional()
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

// Transaction creation and update DTOs
export const CreateTransactionSchema = MultiPartyTransactionSchema.omit({
  id: true,
  transactionNumber: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  auditTrail: true,
  metrics: true
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;

export default {
  MultiPartyTransactionSchema,
  TransactionQuerySchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionPartySchema,
  TransactionItemSchema,
  PaymentInfoSchema,
  TransactionStageSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  PartyRoleSchema,
  PaymentMethodSchema
};