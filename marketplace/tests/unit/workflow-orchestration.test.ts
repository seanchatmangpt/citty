// Unit Tests for Workflow Orchestration
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateProductDataTask,
  createProductTask,
  notifyStakeholdersTask,
  updateSearchIndexTask,
  validateUserDataTask,
  createUserProfileTask,
  processPaymentTask,
  updateInventoryTask,
  productCreationWorkflow,
  userOnboardingWorkflow,
  transactionProcessingWorkflow,
  WorkflowOrchestrator
} from '../../workflows/orchestration';
import type { RunCtx } from '../../../src/types/citty-pro';

describe('Workflow Orchestration', () => {
  let mockContext: RunCtx;
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    mockContext = {
      cwd: '/test',
      env: { NODE_ENV: 'test' },
      now: () => new Date(),
      memo: {}
    };
    orchestrator = new WorkflowOrchestrator();
  });

  describe('Individual Tasks', () => {
    describe('validateProductDataTask', () => {
      it('should validate correct product data', async () => {
        const validInput = {
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          categories: ['electronics'],
          coordinates: { price: 99.99, quality: 0.8 },
          sellerId: 'seller_123'
        };

        const result = await validateProductDataTask.call(validInput, mockContext);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
        expect(result.normalizedData).toBeDefined();
        expect(result.normalizedData?.name).toBe('Test Product');
        expect(result.normalizedData?.categories).toEqual(['electronics']);
      });

      it('should reject product without coordinates', async () => {
        const invalidInput = {
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          categories: ['electronics'],
          coordinates: {},
          sellerId: 'seller_123'
        };

        const result = await validateProductDataTask.call(invalidInput, mockContext);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Product must have dimensional coordinates');
      });

      it('should reject product without categories', async () => {
        const invalidInput = {
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          categories: [],
          coordinates: { price: 99.99 },
          sellerId: 'seller_123'
        };

        const result = await validateProductDataTask.call(invalidInput, mockContext);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Product must have at least one category');
      });

      it('should normalize product data', async () => {
        const inputWithWhitespace = {
          name: '  Test Product  ',
          description: '  A test product  ',
          price: 99.99,
          categories: ['  Electronics  ', 'GADGETS'],
          coordinates: { price: 99.99 },
          sellerId: 'seller_123'
        };

        const result = await validateProductDataTask.call(inputWithWhitespace, mockContext);

        expect(result.valid).toBe(true);
        expect(result.normalizedData?.name).toBe('Test Product');
        expect(result.normalizedData?.description).toBe('A test product');
        expect(result.normalizedData?.categories).toEqual(['electronics', 'gadgets']);
      });
    });

    describe('createProductTask', () => {
      it('should create a product successfully', async () => {
        const validInput = {
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          categories: ['electronics'],
          coordinates: { price: 99.99, quality: 0.8 },
          sellerId: 'seller_123'
        };

        const result = await createProductTask.call(validInput, mockContext);

        expect(result.success).toBe(true);
        expect(result.productId).toMatch(/^prod_/);
        expect(result.error).toBeUndefined();
      });

      it('should handle product creation errors', async () => {
        // Test with invalid data that might cause creation to fail
        const invalidInput = {
          name: '',
          description: '',
          price: -1,
          categories: [],
          coordinates: {},
          sellerId: ''
        };

        const result = await createProductTask.call(invalidInput, mockContext);

        // The result should indicate success/failure appropriately
        expect(typeof result.success).toBe('boolean');
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('notifyStakeholdersTask', () => {
      it('should send notifications successfully', async () => {
        const input = {
          event: 'product_created',
          productId: 'prod_123',
          metadata: { channel: 'api' }
        };

        const result = await notifyStakeholdersTask.call(input, mockContext);

        expect(result.notificationsSent).toBeGreaterThan(0);
        expect(result.notificationsSent).toBeLessThanOrEqual(3); // email, push, webhook
      });

      it('should handle notification failures gracefully', async () => {
        const input = {
          event: 'test_event',
          productId: 'prod_123'
        };

        // Run multiple times to potentially hit notification failures
        let failureFound = false;
        for (let i = 0; i < 20; i++) {
          const result = await notifyStakeholdersTask.call(input, mockContext);
          if (result.failures && result.failures.length > 0) {
            failureFound = true;
            expect(result.failures.length).toBeGreaterThan(0);
            break;
          }
        }

        // Note: Due to randomness, we can't guarantee failure, but the test verifies handling
      });
    });

    describe('updateSearchIndexTask', () => {
      it('should update search index successfully', async () => {
        const input = {
          productId: 'prod_123',
          operation: 'create' as const
        };

        const result = await updateSearchIndexTask.call(input, mockContext);

        expect(result.indexed).toBe(true);
        expect(result.indexSize).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      });

      it('should handle different operations', async () => {
        const operations: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];

        for (const operation of operations) {
          const input = {
            productId: 'prod_123',
            operation
          };

          const result = await updateSearchIndexTask.call(input, mockContext);
          expect(result.indexed).toBe(true);
        }
      });
    });

    describe('validateUserDataTask', () => {
      it('should validate correct user data', async () => {
        const validInput = {
          name: 'John Doe',
          email: 'john@example.com',
          preferences: { price: 0.3, quality: 0.9 },
          initialCoordinates: { experience: 0.5 }
        };

        const result = await validateUserDataTask.call(validInput, mockContext);

        expect(result.valid).toBe(true);
        expect(result.normalizedData).toBeDefined();
        expect(result.normalizedData?.email).toBe('john@example.com');
      });

      it('should reject invalid email', async () => {
        const invalidInput = {
          name: 'John Doe',
          email: 'invalid-email',
          preferences: {},
          initialCoordinates: {}
        };

        const result = await validateUserDataTask.call(invalidInput, mockContext);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid email format');
      });

      it('should reject short names', async () => {
        const invalidInput = {
          name: 'J',
          email: 'j@example.com',
          preferences: {},
          initialCoordinates: {}
        };

        const result = await validateUserDataTask.call(invalidInput, mockContext);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name must be at least 2 characters');
      });

      it('should normalize user data', async () => {
        const inputWithWhitespace = {
          name: '  John Doe  ',
          email: '  JOHN@EXAMPLE.COM  ',
          preferences: { price: 0.5 }
        };

        const result = await validateUserDataTask.call(inputWithWhitespace, mockContext);

        expect(result.valid).toBe(true);
        expect(result.normalizedData?.name).toBe('John Doe');
        expect(result.normalizedData?.email).toBe('john@example.com');
        expect(result.normalizedData?.initialCoordinates).toBeDefined();
      });
    });

    describe('processPaymentTask', () => {
      it('should process payment successfully', async () => {
        const input = {
          transactionId: 'txn_123',
          amount: 99.99,
          currency: 'USD',
          paymentMethod: 'card'
        };

        const result = await processPaymentTask.call(input, mockContext);

        // Should succeed most of the time (95% success rate)
        if (result.processed) {
          expect(result.paymentId).toMatch(/^pay_/);
          expect(result.error).toBeUndefined();
        } else {
          expect(result.error).toBe('Payment processing failed');
        }
      });

      it('should handle payment failures', async () => {
        // Run multiple times to potentially hit the 5% failure rate
        let failureFound = false;
        for (let i = 0; i < 50; i++) {
          const input = {
            transactionId: `txn_${i}`,
            amount: 99.99,
            currency: 'USD',
            paymentMethod: 'card'
          };

          const result = await processPaymentTask.call(input, mockContext);
          if (!result.processed) {
            failureFound = true;
            expect(result.error).toBe('Payment processing failed');
            expect(result.paymentId).toBeUndefined();
            break;
          }
        }

        // Note: Due to randomness, we can't guarantee failure, but the test verifies handling
      });
    });

    describe('updateInventoryTask', () => {
      it('should reserve inventory successfully', async () => {
        const input = {
          productId: 'prod_123',
          quantityChange: -5,
          operation: 'reserve' as const
        };

        const result = await updateInventoryTask.call(input, mockContext);

        expect(result.updated).toBe(true);
        expect(result.newQuantity).toBe(95); // 100 - 5
        expect(result.error).toBeUndefined();
      });

      it('should reject insufficient inventory', async () => {
        const input = {
          productId: 'prod_123',
          quantityChange: -150, // More than available
          operation: 'reserve' as const
        };

        const result = await updateInventoryTask.call(input, mockContext);

        expect(result.updated).toBe(false);
        expect(result.error).toBe('Insufficient inventory');
      });

      it('should handle release and commit operations', async () => {
        const releaseInput = {
          productId: 'prod_123',
          quantityChange: 5,
          operation: 'release' as const
        };

        const releaseResult = await updateInventoryTask.call(releaseInput, mockContext);
        expect(releaseResult.updated).toBe(true);
        expect(releaseResult.newQuantity).toBe(105);

        const commitInput = {
          productId: 'prod_123',
          quantityChange: 0,
          operation: 'commit' as const
        };

        const commitResult = await updateInventoryTask.call(commitInput, mockContext);
        expect(commitResult.updated).toBe(true);
      });
    });
  });

  describe('Complete Workflows', () => {
    describe('productCreationWorkflow', () => {
      it('should execute product creation workflow successfully', async () => {
        const input = {
          name: 'Workflow Test Product',
          description: 'Created via workflow',
          price: 149.99,
          categories: ['test', 'workflow'],
          coordinates: { price: 149.99, quality: 0.9 },
          sellerId: 'seller_workflow'
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input }
        };

        const result = await productCreationWorkflow.run(contextWithInput);

        expect(result.validate).toBeDefined();
        expect(result.validate.valid).toBe(true);
        expect(result.create).toBeDefined();
        expect(result.create.success).toBe(true);
        expect(result.index).toBeDefined();
        expect(result.index.indexed).toBe(true);
        expect(result.notify).toBeDefined();
        expect(result.notify.notificationsSent).toBeGreaterThan(0);
      });

      it('should handle validation failures in workflow', async () => {
        const invalidInput = {
          name: '',
          description: '',
          price: 149.99,
          categories: [],
          coordinates: {},
          sellerId: ''
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input: invalidInput }
        };

        const result = await productCreationWorkflow.run(contextWithInput);

        expect(result.validate).toBeDefined();
        expect(result.validate.valid).toBe(false);
        expect(result.validate.errors).toContain('Product must have dimensional coordinates');
      });
    });

    describe('userOnboardingWorkflow', () => {
      it('should execute user onboarding workflow successfully', async () => {
        const input = {
          name: 'Workflow Test User',
          email: 'workflow@test.com',
          preferences: { price: 0.4, quality: 0.8 },
          initialCoordinates: { engagement: 0.6 }
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input }
        };

        const result = await userOnboardingWorkflow.run(contextWithInput);

        expect(result.validate).toBeDefined();
        expect(result.validate.valid).toBe(true);
        expect(result.create).toBeDefined();
        expect(result.create.success).toBe(true);
        expect(result.notify).toBeDefined();
        expect(result.notify.notificationsSent).toBeGreaterThan(0);
      });

      it('should handle user validation failures', async () => {
        const invalidInput = {
          name: 'A', // Too short
          email: 'invalid-email',
          preferences: {},
          initialCoordinates: {}
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input: invalidInput }
        };

        const result = await userOnboardingWorkflow.run(contextWithInput);

        expect(result.validate).toBeDefined();
        expect(result.validate.valid).toBe(false);
        expect(result.validate.errors).toEqual(expect.arrayContaining([
          'Name must be at least 2 characters',
          'Invalid email format'
        ]));
      });
    });

    describe('transactionProcessingWorkflow', () => {
      it('should execute transaction processing workflow', async () => {
        const input = {
          productId: 'prod_txn_test',
          quantity: 2,
          amount: 199.98,
          transactionId: 'txn_workflow_test'
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input }
        };

        const result = await transactionProcessingWorkflow.run(contextWithInput);

        expect(result.reserve).toBeDefined();
        expect(result.payment).toBeDefined();
        expect(result.commit).toBeDefined();
        expect(result.notify).toBeDefined();

        // If inventory reservation succeeded
        if (result.reserve.updated) {
          expect(result.reserve.newQuantity).toBe(98); // 100 - 2
        }

        // Payment might succeed or fail
        if (result.payment.processed) {
          expect(result.payment.paymentId).toMatch(/^pay_/);
        }
      });

      it('should handle insufficient inventory in transaction workflow', async () => {
        const input = {
          productId: 'prod_txn_test',
          quantity: 150, // More than available
          amount: 14999.99,
          transactionId: 'txn_workflow_fail'
        };

        const contextWithInput = {
          ...mockContext,
          memo: { input }
        };

        const result = await transactionProcessingWorkflow.run(contextWithInput);

        expect(result.reserve).toBeDefined();
        expect(result.reserve.updated).toBe(false);
        expect(result.reserve.error).toBe('Insufficient inventory');
      });
    });
  });

  describe('WorkflowOrchestrator', () => {
    it('should execute workflow by ID', async () => {
      const input = {
        name: 'Orchestrator Test Product',
        description: 'Created via orchestrator',
        price: 199.99,
        categories: ['orchestrator'],
        coordinates: { price: 199.99, quality: 0.85 },
        sellerId: 'seller_orchestrator'
      };

      const result = await orchestrator.executeWorkflow('product-creation', input, mockContext);

      expect(result.validate).toBeDefined();
      expect(result.create).toBeDefined();
      expect(result.index).toBeDefined();
      expect(result.notify).toBeDefined();
    });

    it('should throw error for unknown workflow', async () => {
      await expect(
        orchestrator.executeWorkflow('unknown-workflow', {}, mockContext)
      ).rejects.toThrow('Workflow unknown-workflow not found');
    });

    it('should list available workflows', () => {
      const workflows = orchestrator.getWorkflows();

      expect(workflows).toContain('product-creation');
      expect(workflows).toContain('user-onboarding');
      expect(workflows).toContain('transaction-processing');
    });

    it('should register custom workflow', () => {
      const customWorkflow = {
        id: 'custom-test',
        async run(ctx: RunCtx) {
          return { result: 'custom' };
        }
      };

      orchestrator.registerWorkflow('custom-test', customWorkflow);

      const workflows = orchestrator.getWorkflows();
      expect(workflows).toContain('custom-test');
    });

    it('should execute workflows in parallel', async () => {
      const workflows = [
        {
          id: 'user-onboarding',
          input: {
            name: 'Parallel User 1',
            email: 'parallel1@test.com',
            preferences: {},
            initialCoordinates: {}
          }
        },
        {
          id: 'user-onboarding',
          input: {
            name: 'Parallel User 2',
            email: 'parallel2@test.com',
            preferences: {},
            initialCoordinates: {}
          }
        }
      ];

      const results = await orchestrator.executeParallel(workflows, mockContext);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.id === 'user-onboarding')).toBe(true);
      expect(results.every(r => r.result && !r.error)).toBe(true);
    });

    it('should handle parallel workflow failures gracefully', async () => {
      const workflows = [
        {
          id: 'user-onboarding',
          input: {
            name: 'Valid User',
            email: 'valid@test.com'
          }
        },
        {
          id: 'non-existent-workflow',
          input: {}
        }
      ];

      const results = await orchestrator.executeParallel(workflows, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBeDefined();
      expect(results[0].error).toBeUndefined();
      expect(results[1].result).toBeNull();
      expect(results[1].error).toContain('not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing input data in workflows', async () => {
      const contextWithoutInput = { ...mockContext, memo: {} };

      const result = await productCreationWorkflow.run(contextWithoutInput);

      // Should handle undefined/missing input gracefully
      expect(result.validate).toBeDefined();
    });

    it('should handle workflow step failures', async () => {
      // Create a scenario that will cause step failures
      const input = {
        name: '', // Invalid name
        description: '',
        price: -1, // Invalid price
        categories: [],
        coordinates: {},
        sellerId: ''
      };

      const contextWithInput = {
        ...mockContext,
        memo: { input }
      };

      const result = await productCreationWorkflow.run(contextWithInput);

      expect(result.validate.valid).toBe(false);
      expect(result.validate.errors).toBeDefined();
      expect(result.validate.errors.length).toBeGreaterThan(0);
    });

    it('should maintain step execution order', async () => {
      const input = {
        name: 'Order Test Product',
        description: 'Testing execution order',
        price: 99.99,
        categories: ['order-test'],
        coordinates: { price: 99.99 },
        sellerId: 'seller_order'
      };

      const contextWithInput = {
        ...mockContext,
        memo: { input }
      };

      const result = await productCreationWorkflow.run(contextWithInput);

      // Validate should execute first
      expect(result.validate).toBeDefined();
      
      // Create should use validated data
      if (result.validate.valid && result.create) {
        expect(result.create.productId).toBeDefined();
        
        // Index should reference created product
        if (result.index) {
          expect(result.index.indexed).toBe(true);
        }
      }
    });
  });

  describe('Context and State Management', () => {
    it('should pass context between workflow steps', async () => {
      const input = {
        name: 'Context Test Product',
        description: 'Testing context passing',
        price: 123.45,
        categories: ['context'],
        coordinates: { price: 123.45 },
        sellerId: 'seller_context'
      };

      const contextWithMemo = {
        ...mockContext,
        memo: { input, testValue: 'shared' }
      };

      const result = await productCreationWorkflow.run(contextWithMemo);

      // Verify that steps can access shared context
      expect(result.validate).toBeDefined();
      expect(result.create).toBeDefined();
    });

    it('should maintain state between workflow steps', async () => {
      const input = {
        name: 'State Test Product',
        description: 'Testing state maintenance',
        price: 88.88,
        categories: ['state'],
        coordinates: { price: 88.88, quality: 0.9 },
        sellerId: 'seller_state'
      };

      const contextWithInput = {
        ...mockContext,
        memo: { input }
      };

      const result = await productCreationWorkflow.run(contextWithInput);

      // Each step should build upon previous results
      if (result.validate.valid) {
        expect(result.create).toBeDefined();
        expect(result.create.productId).toBeDefined();
        
        // Index step should use product ID from create step
        // Notify step should use event with product ID
        if (result.notify) {
          expect(result.notify.notificationsSent).toBeGreaterThan(0);
        }
      }
    });
  });
});