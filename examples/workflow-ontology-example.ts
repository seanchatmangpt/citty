#!/usr/bin/env node
/**
 * Citty Pro - Workflow Ontology Example
 * 
 * This example demonstrates:
 * 1. Defining task ontologies with Zod schemas
 * 2. Creating workflow ontologies
 * 3. Generating workflows from ontologies
 * 4. Running complex pipelines
 */

import { defineCommand, runMain } from 'citty';
import { 
  cittyPro, 
  hooks, 
  registerCoreHooks,
  workflowGenerator,
  WorkflowTemplates,
  SchemaHelpers
} from '../src/pro';
import { z } from 'zod';
import type { RunCtx } from '../src/types/citty-pro';

// Initialize hooks
registerCoreHooks();

// ============= Define Schemas =============

const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  balance: z.number().min(0)
});

const OrderSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })),
  total: z.number().positive(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered'])
});

const InvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  tax: z.number().min(0),
  total: z.number().positive(),
  dueDate: z.date(),
  paid: z.boolean()
});

// ============= Register Tasks with Ontologies =============

// Task 1: Validate Customer
const validateCustomerTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'validate-customer',
    name: 'Customer Validation',
    description: 'Validates customer data and tier',
    capabilities: ['validation'],
    input: { schema: CustomerSchema },
    output: { 
      schema: z.object({
        customer: CustomerSchema,
        valid: z.boolean(),
        flags: z.array(z.string())
      })
    },
    sideEffects: false,
    idempotent: true
  },
  async (customer: z.infer<typeof CustomerSchema>) => {
    const flags: string[] = [];
    
    // Validate tier benefits
    if (customer.tier === 'platinum' && customer.balance < 10000) {
      flags.push('upgrade-warning');
    }
    
    return {
      customer,
      valid: true,
      flags
    };
  }
);

// Task 2: Process Order
const processOrderTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'process-order',
    name: 'Order Processing',
    description: 'Processes customer orders with tier-based discounts',
    capabilities: ['computation', 'data-transform'],
    input: { 
      schema: z.object({
        customer: CustomerSchema,
        order: OrderSchema
      })
    },
    output: { schema: OrderSchema },
    sideEffects: true,
    idempotent: false
  },
  async ({ customer, order }: any) => {
    // Apply tier-based discounts
    const discounts: Record<string, number> = {
      bronze: 0,
      silver: 0.05,
      gold: 0.10,
      platinum: 0.15
    };
    
    const discount = discounts[customer.tier] || 0;
    const discountedTotal = order.total * (1 - discount);
    
    return {
      ...order,
      total: discountedTotal,
      status: 'processing'
    };
  }
);

// Task 3: Generate Invoice
const generateInvoiceTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'generate-invoice',
    name: 'Invoice Generation',
    description: 'Generates invoice from processed order',
    capabilities: ['data-transform'],
    input: {
      schema: z.object({
        customer: CustomerSchema,
        order: OrderSchema
      })
    },
    output: { schema: InvoiceSchema },
    sideEffects: false,
    idempotent: true,
    timeout: 5000
  },
  async ({ customer, order }: any) => {
    const taxRate = 0.08; // 8% tax
    const subtotal = order.total;
    const tax = subtotal * taxRate;
    
    return {
      invoiceId: crypto.randomUUID(),
      orderId: order.orderId,
      customerId: customer.id,
      amount: subtotal,
      tax,
      total: subtotal + tax,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paid: false
    };
  }
);

// Task 4: Send Notification
const sendNotificationTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'send-notification',
    name: 'Notification Service',
    description: 'Sends notifications to customers',
    capabilities: ['notification'],
    input: {
      schema: z.object({
        type: z.enum(['email', 'sms', 'push']),
        recipient: z.string(),
        subject: z.string(),
        body: z.string()
      })
    },
    output: {
      schema: z.object({
        sent: z.boolean(),
        messageId: z.string().optional()
      })
    },
    sideEffects: true,
    idempotent: false
  },
  async (notification: any) => {
    console.log(`📧 Sending ${notification.type} to ${notification.recipient}`);
    console.log(`   Subject: ${notification.subject}`);
    console.log(`   Body: ${notification.body}`);
    
    return {
      sent: true,
      messageId: crypto.randomUUID()
    };
  }
);

// Task 5: Update Database
const updateDatabaseTask = workflowGenerator.registerTask(
  {
    '@type': 'Task',
    '@id': 'update-database',
    name: 'Database Update',
    description: 'Updates database with order and invoice',
    capabilities: ['file-operation'],
    input: {
      schema: z.object({
        order: OrderSchema,
        invoice: InvoiceSchema
      })
    },
    output: {
      schema: z.object({
        saved: z.boolean(),
        timestamp: z.date()
      })
    },
    sideEffects: true,
    idempotent: false
  },
  async ({ order, invoice }: any) => {
    console.log('💾 Saving to database:');
    console.log('   Order:', order.orderId);
    console.log('   Invoice:', invoice.invoiceId);
    
    return {
      saved: true,
      timestamp: new Date()
    };
  }
);

// ============= Create Complex Workflow from Ontology =============

const orderProcessingWorkflow = workflowGenerator.generateWorkflow(
  {
    '@type': 'Workflow',
    '@id': 'order-processing-workflow',
    name: 'Complete Order Processing Pipeline',
    steps: [
      {
        id: 'validate',
        taskRef: 'validate-customer',
        condition: { type: 'always' }
      },
      {
        id: 'process',
        taskRef: 'process-order',
        condition: { type: 'conditional', expression: 'valid === true' },
        retry: { maxAttempts: 3, backoff: 'exponential' }
      },
      {
        id: 'invoice',
        taskRef: 'generate-invoice',
        condition: { type: 'always' }
      },
      {
        id: 'notify',
        taskRef: 'send-notification',
        condition: { type: 'parallel' }
      },
      {
        id: 'persist',
        taskRef: 'update-database',
        condition: { type: 'sequential' }
      }
    ],
    triggers: ['manual', 'api'],
    outputs: {
      success: z.object({
        order: OrderSchema,
        invoice: InvoiceSchema,
        notified: z.boolean()
      }),
      failure: z.object({
        error: z.string(),
        step: z.string()
      })
    }
  },
  { 
    customer: null,
    order: null,
    invoice: null,
    notifications: []
  }
);

// ============= Create Pipeline from Multiple Workflows =============

const fullPipeline = workflowGenerator.generatePipeline({
  '@type': 'Pipeline',
  '@id': 'e-commerce-pipeline',
  name: 'E-Commerce Order Pipeline',
  stages: [
    {
      name: 'validation',
      workflows: ['order-processing-workflow'],
      parallel: false,
      continueOnError: false
    },
    {
      name: 'fulfillment',
      workflows: ['inventory-check', 'shipping-label'],
      parallel: true,
      continueOnError: true
    },
    {
      name: 'completion',
      workflows: ['final-notification', 'analytics'],
      parallel: true,
      continueOnError: true
    }
  ],
  dataFlow: {
    inputs: {
      customer: CustomerSchema,
      order: OrderSchema
    },
    transformations: [
      {
        from: 'validation.output',
        to: 'fulfillment.input',
        mapping: '$.processedOrder'
      }
    ],
    outputs: {
      result: z.object({
        success: z.boolean(),
        orderId: z.string()
      })
    }
  }
});

// ============= Create Validation Workflow =============

const dataValidationWorkflow = workflowGenerator.createValidationWorkflow(
  'order-validation',
  OrderSchema.extend({
    customer: CustomerSchema,
    metadata: z.object({
      source: z.enum(['web', 'mobile', 'api']),
      timestamp: z.date()
    })
  }),
  [
    async (data) => {
      console.log('✅ Validation passed');
      return data;
    },
    async (data) => {
      console.log('🔄 Processing data');
      return { ...data, processed: true };
    }
  ]
);

// ============= Create Conditional Workflow =============

const tierBasedWorkflow = workflowGenerator.createConditionalWorkflow(
  'tier-router',
  [
    {
      name: 'platinum-flow',
      condition: (data: any) => data.customer?.tier === 'platinum',
      workflow: cittyPro.defineWorkflow({
        id: 'platinum-benefits',
        steps: [/* Platinum-specific steps */]
      })
    },
    {
      name: 'gold-flow',
      condition: (data: any) => data.customer?.tier === 'gold',
      workflow: cittyPro.defineWorkflow({
        id: 'gold-benefits',
        steps: [/* Gold-specific steps */]
      })
    }
  ],
  cittyPro.defineWorkflow({
    id: 'standard-flow',
    steps: [/* Standard flow steps */]
  })
);

// ============= CLI Command Definition =============

const cmd = defineCommand({
  meta: {
    name: 'order-processor',
    version: '1.0.0',
    description: 'E-commerce order processing with workflow ontologies'
  },
  args: {
    customerEmail: { type: 'string', required: true },
    orderTotal: { type: 'number', required: true },
    tier: { 
      type: 'enum', 
      options: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    simulate: { type: 'boolean', default: false }
  },
  run: async ({ args }) => {
    console.log('🚀 Starting Order Processing Pipeline\n');
    
    // Prepare test data
    const customer: z.infer<typeof CustomerSchema> = {
      id: crypto.randomUUID(),
      name: 'John Doe',
      email: args.customerEmail,
      tier: args.tier as any,
      balance: 5000
    };
    
    const order: z.infer<typeof OrderSchema> = {
      orderId: crypto.randomUUID(),
      customerId: customer.id,
      items: [
        {
          productId: 'PROD-001',
          quantity: 2,
          price: args.orderTotal / 2
        }
      ],
      total: args.orderTotal,
      status: 'pending'
    };
    
    // Create context
    const ctx: RunCtx = {
      cwd: process.cwd(),
      env: process.env,
      now: () => new Date(),
      memo: {}
    };
    
    // Execute lifecycle
    await cittyPro.runLifecycle({
      cmd,
      args,
      ctx,
      runStep: async (ctx) => {
        try {
          // Step 1: Validate Customer
          console.log('Step 1: Validating Customer...');
          const validation = await validateCustomerTask.call(customer, ctx);
          console.log('   ✅ Customer valid:', validation.valid);
          if (validation.flags.length > 0) {
            console.log('   ⚠️  Flags:', validation.flags.join(', '));
          }
          
          // Step 2: Process Order
          console.log('\nStep 2: Processing Order...');
          const processedOrder = await processOrderTask.call(
            { customer, order }, 
            ctx
          );
          console.log('   💰 Original total:', order.total);
          console.log('   💳 Discounted total:', processedOrder.total);
          
          // Step 3: Generate Invoice
          console.log('\nStep 3: Generating Invoice...');
          const invoice = await generateInvoiceTask.call(
            { customer, order: processedOrder },
            ctx
          );
          console.log('   📄 Invoice ID:', invoice.invoiceId);
          console.log('   💵 Total with tax:', invoice.total);
          
          // Step 4: Send Notifications
          console.log('\nStep 4: Sending Notifications...');
          await sendNotificationTask.call({
            type: 'email',
            recipient: customer.email,
            subject: 'Order Confirmation',
            body: `Your order ${processedOrder.orderId} has been processed. Total: $${invoice.total.toFixed(2)}`
          }, ctx);
          
          // Step 5: Update Database
          if (!args.simulate) {
            console.log('\nStep 5: Updating Database...');
            await updateDatabaseTask.call(
              { order: processedOrder, invoice },
              ctx
            );
          } else {
            console.log('\nStep 5: Skipping database update (simulation mode)');
          }
          
          console.log('\n✨ Order processing complete!\n');
          
          return {
            text: `Successfully processed order ${order.orderId} for ${customer.email}`,
            json: {
              customer,
              order: processedOrder,
              invoice,
              success: true
            }
          };
        } catch (error) {
          console.error('❌ Error processing order:', error);
          return {
            text: `Failed to process order: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
    });
  }
});

// Register lifecycle hooks for monitoring
hooks.hook('task:will:call', ({ id }) => {
  if (process.env.DEBUG) {
    console.log(`   [Hook] Starting task: ${id}`);
  }
});

hooks.hook('task:did:call', ({ id, res }) => {
  if (process.env.DEBUG) {
    console.log(`   [Hook] Completed task: ${id}`);
  }
});

// Run the CLI application
if (require.main === module) {
  runMain(cmd);
}

// Export for testing
export { cmd, orderProcessingWorkflow, CustomerSchema, OrderSchema, InvoiceSchema };