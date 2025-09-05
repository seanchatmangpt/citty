// Workflow Orchestration for Marketplace Operations
import { defineTask, defineWorkflow } from '../../src/pro';
import type { Task, Workflow, RunCtx } from '../../src/types/citty-pro';
import { z } from 'zod';
import type { ProductDimension, UserDimension, TransactionDimension } from '../types/dimensional-models';
import { MarketplaceAPI } from '../api/routes';

// Schema definitions for workflow data
const ProductCreationInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  categories: z.array(z.string()),
  coordinates: z.record(z.string(), z.number()),
  sellerId: z.string()
});

const UserOnboardingInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  preferences: z.record(z.string(), z.number()).optional(),
  initialCoordinates: z.record(z.string(), z.number()).optional()
});

const TransactionFlowInputSchema = z.object({
  buyerId: z.string(),
  sellerId: z.string(),
  productId: z.string(),
  quantity: z.number().positive()
});

// Task definitions
export const validateProductDataTask = defineTask({
  id: 'validate-product-data',
  in: ProductCreationInputSchema,
  out: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
    normalizedData: ProductCreationInputSchema.optional()
  }),
  async run(input, ctx: RunCtx) {
    const errors: string[] = [];

    // Validate coordinates
    if (!input.coordinates || Object.keys(input.coordinates).length === 0) {
      errors.push('Product must have dimensional coordinates');
    }

    // Validate categories
    if (input.categories.length === 0) {
      errors.push('Product must have at least one category');
    }

    // Normalize data
    const normalizedData = {
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      categories: input.categories.map(cat => cat.toLowerCase().trim())
    };

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      normalizedData: errors.length === 0 ? normalizedData : undefined
    };
  }
});

export const createProductTask = defineTask({
  id: 'create-product',
  in: ProductCreationInputSchema,
  out: z.object({
    success: z.boolean(),
    productId: z.string().optional(),
    error: z.string().optional()
  }),
  async run(input, ctx: RunCtx) {
    // This would integrate with actual marketplace API
    const api = new MarketplaceAPI();
    api.initializeSampleData();

    const productData = {
      name: input.name,
      description: input.description,
      coordinates: input.coordinates,
      price: { base: input.price, currency: 'USD' },
      categories: input.categories,
      attributes: {},
      availability: { total: 100 },
      quality: { score: 0.8 },
      seller: {
        id: input.sellerId,
        reputation: 4.0,
        coordinates: { reliability: 0.8, speed: 0.7 }
      }
    };

    const result = await api.createProduct(productData, {
      requestId: 'workflow_' + Date.now(),
      timestamp: new Date()
    });

    return {
      success: result.success,
      productId: result.data?.id,
      error: result.error
    };
  }
});

export const notifyStakeholdersTask = defineTask({
  id: 'notify-stakeholders',
  in: z.object({
    event: z.string(),
    productId: z.string().optional(),
    userId: z.string().optional(),
    transactionId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  out: z.object({
    notificationsSent: z.number(),
    failures: z.array(z.string()).optional()
  }),
  async run(input, ctx: RunCtx) {
    // Simulate notification system
    const notifications = [
      'email',
      'push',
      'webhook'
    ];

    const failures: string[] = [];
    let sent = 0;

    for (const channel of notifications) {
      try {
        // Simulate notification sending
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate occasional failures
        if (Math.random() < 0.1) {
          throw new Error(`Failed to send ${channel} notification`);
        }
        
        sent++;
      } catch (error) {
        failures.push(`${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      notificationsSent: sent,
      failures: failures.length > 0 ? failures : undefined
    };
  }
});

export const updateSearchIndexTask = defineTask({
  id: 'update-search-index',
  in: z.object({
    productId: z.string(),
    operation: z.enum(['create', 'update', 'delete'])
  }),
  out: z.object({
    indexed: z.boolean(),
    indexSize: z.number(),
    error: z.string().optional()
  }),
  async run(input, ctx: RunCtx) {
    try {
      // Simulate search index update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        indexed: true,
        indexSize: 1000 + Math.floor(Math.random() * 100)
      };
    } catch (error) {
      return {
        indexed: false,
        indexSize: 0,
        error: error instanceof Error ? error.message : 'Index update failed'
      };
    }
  }
});

export const validateUserDataTask = defineTask({
  id: 'validate-user-data',
  in: UserOnboardingInputSchema,
  out: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
    normalizedData: UserOnboardingInputSchema.optional()
  }),
  async run(input, ctx: RunCtx) {
    const errors: string[] = [];

    // Email validation (additional)
    if (!input.email.includes('@')) {
      errors.push('Invalid email format');
    }

    // Name validation
    if (input.name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    const normalizedData = {
      ...input,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      preferences: input.preferences || {},
      initialCoordinates: input.initialCoordinates || { engagement: 0.5, experience: 0 }
    };

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      normalizedData: errors.length === 0 ? normalizedData : undefined
    };
  }
});

export const createUserProfileTask = defineTask({
  id: 'create-user-profile',
  in: UserOnboardingInputSchema,
  out: z.object({
    success: z.boolean(),
    userId: z.string().optional(),
    error: z.string().optional()
  }),
  async run(input, ctx: RunCtx) {
    const api = new MarketplaceAPI();
    
    const userData = {
      coordinates: input.initialCoordinates || { engagement: 0.5, experience: 0 },
      profile: {
        name: input.name,
        email: input.email,
        preferences: input.preferences || {}
      },
      behavior: {
        browsingPattern: {},
        purchaseHistory: [],
        engagement: {}
      },
      reputation: {
        score: 3.0, // Starting reputation
        reviews: 0,
        transactions: 0
      }
    };

    const result = await api.createUser(userData, {
      requestId: 'workflow_' + Date.now(),
      timestamp: new Date()
    });

    return {
      success: result.success,
      userId: result.data?.id,
      error: result.error
    };
  }
});

export const processPaymentTask = defineTask({
  id: 'process-payment',
  in: z.object({
    transactionId: z.string(),
    amount: z.number(),
    currency: z.string(),
    paymentMethod: z.string()
  }),
  out: z.object({
    processed: z.boolean(),
    paymentId: z.string().optional(),
    error: z.string().optional()
  }),
  async run(input, ctx: RunCtx) {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simulate occasional payment failures
    if (Math.random() < 0.05) {
      return {
        processed: false,
        error: 'Payment processing failed'
      };
    }

    return {
      processed: true,
      paymentId: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    };
  }
});

export const updateInventoryTask = defineTask({
  id: 'update-inventory',
  in: z.object({
    productId: z.string(),
    quantityChange: z.number(),
    operation: z.enum(['reserve', 'release', 'commit'])
  }),
  out: z.object({
    updated: z.boolean(),
    newQuantity: z.number(),
    error: z.string().optional()
  }),
  async run(input, ctx: RunCtx) {
    // Simulate inventory update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate current inventory (would come from database)
    const currentInventory = 100;
    const newQuantity = Math.max(0, currentInventory + input.quantityChange);
    
    if (input.operation === 'reserve' && newQuantity < 0) {
      return {
        updated: false,
        newQuantity: currentInventory,
        error: 'Insufficient inventory'
      };
    }

    return {
      updated: true,
      newQuantity
    };
  }
});

// Workflow definitions
export const productCreationWorkflow = defineWorkflow({
  id: 'product-creation-workflow',
  seed: { step: 'start' },
  steps: [
    {
      id: 'validate',
      use: validateProductDataTask,
      select: (state, ctx) => state.input
    },
    {
      id: 'create',
      use: createProductTask,
      select: (state) => state.validate?.normalizedData
    },
    {
      id: 'index',
      use: updateSearchIndexTask,
      select: (state) => ({
        productId: state.create?.productId,
        operation: 'create' as const
      })
    },
    {
      id: 'notify',
      use: notifyStakeholdersTask,
      select: (state) => ({
        event: 'product_created',
        productId: state.create?.productId
      })
    }
  ]
});

export const userOnboardingWorkflow = defineWorkflow({
  id: 'user-onboarding-workflow',
  seed: { step: 'start' },
  steps: [
    {
      id: 'validate',
      use: validateUserDataTask,
      select: (state, ctx) => state.input
    },
    {
      id: 'create',
      use: createUserProfileTask,
      select: (state) => state.validate?.normalizedData
    },
    {
      id: 'notify',
      use: notifyStakeholdersTask,
      select: (state) => ({
        event: 'user_created',
        userId: state.create?.userId
      })
    }
  ]
});

export const transactionProcessingWorkflow = defineWorkflow({
  id: 'transaction-processing-workflow',
  seed: { step: 'start' },
  steps: [
    {
      id: 'reserve',
      use: updateInventoryTask,
      select: (state) => ({
        productId: state.input?.productId,
        quantityChange: -(state.input?.quantity || 1),
        operation: 'reserve' as const
      })
    },
    {
      id: 'payment',
      use: processPaymentTask,
      select: (state) => ({
        transactionId: state.input?.transactionId,
        amount: state.input?.amount || 0,
        currency: 'USD',
        paymentMethod: 'card'
      })
    },
    {
      id: 'commit',
      use: updateInventoryTask,
      select: (state) => ({
        productId: state.input?.productId,
        quantityChange: 0, // Already reserved
        operation: 'commit' as const
      })
    },
    {
      id: 'notify',
      use: notifyStakeholdersTask,
      select: (state) => ({
        event: 'transaction_completed',
        transactionId: state.input?.transactionId
      })
    }
  ]
});

// Workflow orchestration helper
export class WorkflowOrchestrator {
  private workflows = new Map<string, Workflow<any>>();

  constructor() {
    this.registerDefaultWorkflows();
  }

  private registerDefaultWorkflows(): void {
    this.workflows.set('product-creation', productCreationWorkflow);
    this.workflows.set('user-onboarding', userOnboardingWorkflow);
    this.workflows.set('transaction-processing', transactionProcessingWorkflow);
  }

  async executeWorkflow(
    workflowId: string,
    input: any,
    ctx: RunCtx
  ): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const contextWithInput = {
      ...ctx,
      memo: { ...ctx.memo, input }
    };

    return await workflow.run(contextWithInput);
  }

  registerWorkflow(id: string, workflow: Workflow<any>): void {
    this.workflows.set(id, workflow);
  }

  getWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  async executeParallel(
    workflows: Array<{ id: string; input: any }>,
    ctx: RunCtx
  ): Promise<Array<{ id: string; result: any; error?: string }>> {
    const promises = workflows.map(async ({ id, input }) => {
      try {
        const result = await this.executeWorkflow(id, input, ctx);
        return { id, result };
      } catch (error) {
        return {
          id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return await Promise.all(promises);
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();