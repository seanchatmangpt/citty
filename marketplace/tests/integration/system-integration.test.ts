// Integration Tests for Complete System Integration
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarketplaceAPI } from '../../api/routes';
import { WorkflowOrchestrator } from '../../workflows/orchestration';
import { DimensionalSearchEngine } from '../../src/dimensional-search';
import { TransactionEngine } from '../../src/transaction-engine';
import type { 
  APIContext, 
  ProductDimension, 
  UserDimension, 
  SearchQuery,
  TransactionDimension 
} from '../../types/dimensional-models';

describe('System Integration Tests', () => {
  let api: MarketplaceAPI;
  let orchestrator: WorkflowOrchestrator;
  let context: APIContext;
  let testData: {
    users: string[];
    products: string[];
    transactions: string[];
  };

  beforeEach(async () => {
    api = new MarketplaceAPI();
    api.initializeSampleData();
    orchestrator = new WorkflowOrchestrator();
    
    context = {
      requestId: `integration_${Date.now()}`,
      timestamp: new Date()
    };

    testData = {
      users: [],
      products: [],
      transactions: []
    };
  });

  afterEach(async () => {
    // Cleanup test data if needed
    console.log(`Test completed. Created ${testData.users.length} users, ${testData.products.length} products, ${testData.transactions.length} transactions`);
  });

  describe('Full System Workflow Integration', () => {
    it('should integrate all components in a complete marketplace flow', async () => {
      // Phase 1: Initialize marketplace with multiple sellers and buyers
      console.log('Phase 1: Creating marketplace participants...');
      
      const sellers = await Promise.all([
        orchestrator.executeWorkflow('user-onboarding', {
          name: 'TechCorp Seller',
          email: 'sales@techcorp.com',
          preferences: { volume: 0.9, margin: 0.3 },
          initialCoordinates: { 
            reliability: 0.95, 
            speed: 0.9, 
            quality: 0.9,
            reputation: 0.85 
          }
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),
        
        orchestrator.executeWorkflow('user-onboarding', {
          name: 'BudgetGoods Inc',
          email: 'hello@budgetgoods.com',
          preferences: { volume: 0.8, margin: 0.15 },
          initialCoordinates: { 
            reliability: 0.75, 
            speed: 0.7, 
            quality: 0.6,
            reputation: 0.7 
          }
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
      ]);

      const buyers = await Promise.all([
        orchestrator.executeWorkflow('user-onboarding', {
          name: 'Premium Customer',
          email: 'premium@customer.com',
          preferences: { price: 0.2, quality: 0.95, speed: 0.8 },
          initialCoordinates: { 
            spending_power: 0.9, 
            quality_preference: 0.95,
            brand_loyalty: 0.8 
          }
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),
        
        orchestrator.executeWorkflow('user-onboarding', {
          name: 'Budget Shopper',
          email: 'budget@shopper.com',
          preferences: { price: 0.9, quality: 0.4, speed: 0.3 },
          initialCoordinates: { 
            spending_power: 0.3, 
            quality_preference: 0.4,
            price_sensitivity: 0.95 
          }
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
      ]);

      // Verify all participants created successfully
      expect(sellers.every(s => s.create.success)).toBe(true);
      expect(buyers.every(b => b.create.success)).toBe(true);
      
      testData.users.push(
        ...sellers.map(s => s.create.userId),
        ...buyers.map(b => b.create.userId)
      );

      console.log('✓ Created sellers and buyers successfully');

      // Phase 2: Create diverse product catalog
      console.log('Phase 2: Building product catalog...');
      
      const productCreations = await Promise.all([
        // Premium products from TechCorp
        orchestrator.executeWorkflow('product-creation', {
          name: 'UltraBook Pro 15',
          description: 'Premium ultrabook with cutting-edge performance',
          price: 2499.99,
          categories: ['electronics', 'computers', 'laptops', 'premium'],
          coordinates: {
            price: 2499.99,
            quality: 0.95,
            performance: 0.98,
            portability: 0.85,
            battery_life: 0.9,
            build_quality: 0.95,
            brand_prestige: 0.9
          },
          sellerId: sellers[0].create.userId
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),

        orchestrator.executeWorkflow('product-creation', {
          name: 'Gaming Beast X1',
          description: 'Ultimate gaming laptop with RTX 4090',
          price: 3299.99,
          categories: ['electronics', 'computers', 'laptops', 'gaming'],
          coordinates: {
            price: 3299.99,
            quality: 0.92,
            performance: 0.99,
            portability: 0.6,
            battery_life: 0.65,
            gaming_performance: 0.99,
            cooling: 0.9
          },
          sellerId: sellers[0].create.userId
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),

        // Budget products from BudgetGoods
        orchestrator.executeWorkflow('product-creation', {
          name: 'BasicBook 14',
          description: 'Affordable laptop for everyday tasks',
          price: 649.99,
          categories: ['electronics', 'computers', 'laptops', 'budget'],
          coordinates: {
            price: 649.99,
            quality: 0.65,
            performance: 0.55,
            portability: 0.8,
            battery_life: 0.7,
            build_quality: 0.6,
            value_for_money: 0.9
          },
          sellerId: sellers[1].create.userId
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),

        orchestrator.executeWorkflow('product-creation', {
          name: 'Student Special',
          description: 'Perfect laptop for students on a budget',
          price: 449.99,
          categories: ['electronics', 'computers', 'laptops', 'budget', 'student'],
          coordinates: {
            price: 449.99,
            quality: 0.55,
            performance: 0.45,
            portability: 0.85,
            battery_life: 0.75,
            build_quality: 0.5,
            value_for_money: 0.95
          },
          sellerId: sellers[1].create.userId
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
      ]);

      expect(productCreations.every(p => p.create.success && p.index.indexed)).toBe(true);
      testData.products.push(...productCreations.map(p => p.create.productId));

      console.log('✓ Product catalog created and indexed successfully');

      // Phase 3: Multi-dimensional search and discovery
      console.log('Phase 3: Testing search and discovery...');
      
      // Premium customer searches for high-end laptops
      const premiumSearch: SearchQuery = {
        dimensions: {
          quality: { min: 0.85, weight: 1.0, preferred: 0.95 },
          performance: { min: 0.8, weight: 0.9, preferred: 0.95 },
          build_quality: { min: 0.8, weight: 0.8 },
          price: { max: 4000, weight: 0.3 }
        },
        filters: { categories: ['laptops'], minPrice: 1000 },
        sort: { dimension: 'quality', direction: 'desc' },
        limit: 5,
        offset: 0
      };

      const premiumContext = { ...context, userId: buyers[0].create.userId };
      const premiumResults = await api.searchProducts(premiumSearch, premiumContext);

      expect(premiumResults.success).toBe(true);
      expect(premiumResults.data?.items.length).toBeGreaterThan(0);
      
      // Should prioritize premium products
      const topResult = premiumResults.data!.items[0];
      expect(topResult.product.coordinates.quality).toBeGreaterThan(0.8);

      // Budget customer searches for affordable options
      const budgetSearch: SearchQuery = {
        dimensions: {
          price: { max: 800, weight: 1.0, preferred: 500 },
          value_for_money: { min: 0.7, weight: 0.9 },
          portability: { min: 0.7, weight: 0.6 }
        },
        filters: { categories: ['laptops'], maxPrice: 800 },
        sort: { dimension: 'price', direction: 'asc' },
        limit: 5,
        offset: 0
      };

      const budgetContext = { ...context, userId: buyers[1].create.userId };
      const budgetResults = await api.searchProducts(budgetSearch, budgetContext);

      expect(budgetResults.success).toBe(true);
      expect(budgetResults.data?.items.length).toBeGreaterThan(0);

      console.log('✓ Search and personalization working correctly');

      // Phase 4: Transaction processing and validation
      console.log('Phase 4: Processing transactions...');
      
      const premiumPurchase = await api.createTransaction({
        buyerId: buyers[0].create.userId,
        sellerId: sellers[0].create.userId,
        productId: premiumResults.data!.items[0].product.id,
        quantity: 1
      }, premiumContext);

      const budgetPurchase = await api.createTransaction({
        buyerId: buyers[1].create.userId,
        sellerId: sellers[1].create.userId,
        productId: budgetResults.data!.items[0].product.id,
        quantity: 1
      }, budgetContext);

      expect(premiumPurchase.success).toBe(true);
      expect(budgetPurchase.success).toBe(true);

      testData.transactions.push(premiumPurchase.data!.id, budgetPurchase.data!.id);

      // Process transactions through workflow
      const transactionProcessing = await Promise.all([
        orchestrator.executeWorkflow('transaction-processing', {
          productId: premiumPurchase.data!.product.id,
          quantity: 1,
          amount: premiumPurchase.data!.pricing.final,
          transactionId: premiumPurchase.data!.id
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} }),

        orchestrator.executeWorkflow('transaction-processing', {
          productId: budgetPurchase.data!.product.id,
          quantity: 1,
          amount: budgetPurchase.data!.pricing.final,
          transactionId: budgetPurchase.data!.id
        }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
      ]);

      expect(transactionProcessing.every(t => t.reserve.updated)).toBe(true);

      console.log('✓ Transactions processed successfully');

      // Phase 5: System verification and integrity checks
      console.log('Phase 5: System verification...');
      
      // Verify transaction integrity
      const integrityChecks = await Promise.all([
        api.verifyTransaction(premiumPurchase.data!.id, context),
        api.verifyTransaction(budgetPurchase.data!.id, context)
      ]);

      expect(integrityChecks.every(check => check.success && check.data)).toBe(true);

      // Check user transaction histories
      const premiumHistory = await api.getUserTransactionHistory(
        buyers[0].create.userId, 10, premiumContext
      );
      const budgetHistory = await api.getUserTransactionHistory(
        buyers[1].create.userId, 10, budgetContext
      );

      expect(premiumHistory.success && budgetHistory.success).toBe(true);
      expect(premiumHistory.data?.length).toBe(1);
      expect(budgetHistory.data?.length).toBe(1);

      // Final system health check
      const healthCheck = await api.healthCheck(context);
      expect(healthCheck.success).toBe(true);
      expect(healthCheck.data?.status).toMatch(/^(healthy|partial)$/);

      // Get final marketplace statistics
      const finalStats = await api.getMarketplaceStats(context);
      expect(finalStats.success).toBe(true);
      expect(finalStats.data?.products).toBeGreaterThanOrEqual(4);
      expect(finalStats.data?.users).toBeGreaterThanOrEqual(4);

      console.log('✓ System integration test completed successfully');
    });
  });

  describe('Cross-Component Data Consistency', () => {
    it('should maintain data consistency across all system components', async () => {
      // Create test user
      const userResult = await orchestrator.executeWorkflow('user-onboarding', {
        name: 'Consistency Tester',
        email: 'consistency@test.com',
        preferences: { quality: 0.8, price: 0.6 }
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      expect(userResult.create.success).toBe(true);
      const userId = userResult.create.userId;

      // Create test product
      const productResult = await orchestrator.executeWorkflow('product-creation', {
        name: 'Consistency Test Product',
        description: 'Product for consistency testing',
        price: 299.99,
        categories: ['test'],
        coordinates: { price: 299.99, quality: 0.85 },
        sellerId: userId
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      expect(productResult.create.success).toBe(true);
      const productId = productResult.create.productId;

      // Verify data consistency across components
      // 1. API layer should return consistent data
      const userFromAPI = await api.getUser(userId, context);
      const productFromAPI = await api.getProduct(productId, context);

      expect(userFromAPI.success).toBe(true);
      expect(productFromAPI.success).toBe(true);
      expect(userFromAPI.data?.profile.name).toBe('Consistency Tester');
      expect(productFromAPI.data?.name).toBe('Consistency Test Product');

      // 2. Search engine should find the product
      const searchResult = await api.searchProducts({
        dimensions: { price: { min: 250, max: 350, weight: 1.0 } },
        limit: 10,
        offset: 0
      }, context);

      expect(searchResult.success).toBe(true);
      const foundProduct = searchResult.data?.items.find(
        item => item.product.id === productId
      );
      expect(foundProduct).toBeDefined();
      expect(foundProduct?.product.name).toBe('Consistency Test Product');

      // 3. Transaction engine should work with consistent data
      const transactionResult = await api.createTransaction({
        buyerId: userId,
        sellerId: userId, // Self-transaction should be rejected
        productId,
        quantity: 1
      }, context);

      expect(transactionResult.success).toBe(false);
      expect(transactionResult.error).toContain('same user');

      // Create separate buyer
      const buyerResult = await orchestrator.executeWorkflow('user-onboarding', {
        name: 'Buyer User',
        email: 'buyer@test.com'
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const validTransactionResult = await api.createTransaction({
        buyerId: buyerResult.create.userId,
        sellerId: userId,
        productId,
        quantity: 1
      }, context);

      expect(validTransactionResult.success).toBe(true);
      expect(validTransactionResult.data?.product.id).toBe(productId);

      // 4. Verify all systems report consistent state
      const stats = await api.getMarketplaceStats(context);
      expect(stats.success).toBe(true);

      // All components should report consistent counts
      expect(stats.data?.users).toBeGreaterThanOrEqual(2);
      expect(stats.data?.products).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should handle errors gracefully across system boundaries', async () => {
      // Test error propagation from workflow to API
      const invalidWorkflowResult = await orchestrator.executeWorkflow(
        'product-creation',
        {
          name: '', // Invalid empty name
          description: '',
          price: -100, // Invalid negative price
          categories: [],
          coordinates: {},
          sellerId: 'non_existent_seller'
        },
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      // Workflow should handle validation errors
      expect(invalidWorkflowResult.validate.valid).toBe(false);
      expect(invalidWorkflowResult.validate.errors).toBeDefined();
      expect(invalidWorkflowResult.validate.errors.length).toBeGreaterThan(0);

      // Test API error handling
      const invalidAPICall = await api.getProduct('non_existent_product', context);
      expect(invalidAPICall.success).toBe(false);
      expect(invalidAPICall.error).toBe('Product not found');

      // Test search error handling
      const invalidSearchResult = await api.searchProducts({
        dimensions: {},
        limit: -1, // Invalid limit
        offset: -1  // Invalid offset
      }, context);

      // Should handle gracefully
      expect(invalidSearchResult.success).toBe(true);
      expect(invalidSearchResult.data?.items).toBeDefined();

      // Test transaction error handling
      const invalidTransactionResult = await api.createTransaction({
        buyerId: 'non_existent_buyer',
        sellerId: 'non_existent_seller',
        productId: 'non_existent_product',
        quantity: 0
      }, context);

      expect(invalidTransactionResult.success).toBe(false);
      expect(invalidTransactionResult.error).toContain('Invalid transaction participants');

      // System should remain stable after errors
      const healthAfterErrors = await api.healthCheck(context);
      expect(healthAfterErrors.success).toBe(true);
    });
  });

  describe('Performance Under Integration Load', () => {
    it('should maintain performance when all systems work together', async () => {
      const startTime = performance.now();

      // Create concurrent load across all system components
      const integrationPromises: Promise<any>[] = [];

      // User creation load
      for (let i = 0; i < 20; i++) {
        integrationPromises.push(
          orchestrator.executeWorkflow('user-onboarding', {
            name: `Integration User ${i}`,
            email: `integration${i}@test.com`,
            preferences: { price: Math.random(), quality: Math.random() }
          }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
        );
      }

      // Product creation load
      for (let i = 0; i < 30; i++) {
        integrationPromises.push(
          orchestrator.executeWorkflow('product-creation', {
            name: `Integration Product ${i}`,
            description: `Product ${i} for integration testing`,
            price: Math.random() * 1000 + 100,
            categories: ['integration', `cat${i % 5}`],
            coordinates: {
              price: Math.random() * 1000 + 100,
              quality: Math.random(),
              performance: Math.random()
            },
            sellerId: `seller_${i % 10}`
          }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} })
        );
      }

      // Search load
      for (let i = 0; i < 50; i++) {
        integrationPromises.push(
          api.searchProducts({
            dimensions: {
              price: { min: Math.random() * 500, max: Math.random() * 500 + 500, weight: Math.random() },
              quality: { min: Math.random() * 0.5, weight: Math.random() }
            },
            limit: 10,
            offset: 0
          }, { ...context, requestId: `search_${i}` })
        );
      }

      const results = await Promise.all(integrationPromises);
      const totalTime = performance.now() - startTime;

      // Analyze results
      const userResults = results.slice(0, 20);
      const productResults = results.slice(20, 50);
      const searchResults = results.slice(50);

      const successfulUsers = userResults.filter(r => r.create?.success).length;
      const successfulProducts = productResults.filter(r => r.create?.success).length;
      const successfulSearches = searchResults.filter(r => r.success).length;

      console.log(`Integration performance test results:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  User creation: ${successfulUsers}/20 successful`);
      console.log(`  Product creation: ${successfulProducts}/30 successful`);
      console.log(`  Searches: ${successfulSearches}/50 successful`);

      // Performance expectations
      expect(totalTime).toBeLessThan(30000); // 30 seconds for all operations
      expect(successfulUsers / 20).toBeGreaterThan(0.8); // 80% success rate
      expect(successfulProducts / 30).toBeGreaterThan(0.8);
      expect(successfulSearches / 50).toBeGreaterThan(0.9); // Searches should be more reliable

      // System should remain healthy after load
      const finalHealth = await api.healthCheck(context);
      expect(finalHealth.success).toBe(true);
    });
  });

  describe('Real-time Data Synchronization', () => {
    it('should synchronize data changes across all system components in real-time', async () => {
      // Create initial user and product
      const sellerResult = await orchestrator.executeWorkflow('user-onboarding', {
        name: 'Sync Test Seller',
        email: 'seller@sync.test'
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const productResult = await orchestrator.executeWorkflow('product-creation', {
        name: 'Sync Test Product',
        description: 'Product for sync testing',
        price: 199.99,
        categories: ['sync-test'],
        coordinates: { price: 199.99, quality: 0.8 },
        sellerId: sellerResult.create.userId
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const productId = productResult.create.productId;

      // Verify product appears in search immediately
      let searchResult = await api.searchProducts({
        dimensions: { price: { min: 150, max: 250, weight: 1.0 } },
        filters: { categories: ['sync-test'] },
        limit: 10,
        offset: 0
      }, context);

      expect(searchResult.success).toBe(true);
      let foundProduct = searchResult.data?.items.find(item => item.product.id === productId);
      expect(foundProduct).toBeDefined();
      expect(foundProduct?.product.name).toBe('Sync Test Product');

      // Update product through API
      const updateResult = await api.updateProduct(productId, {
        name: 'Updated Sync Test Product',
        price: { base: 299.99, currency: 'USD' },
        coordinates: { price: 299.99, quality: 0.9 }
      }, context);

      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.name).toBe('Updated Sync Test Product');

      // Verify updated product appears in new search
      searchResult = await api.searchProducts({
        dimensions: { price: { min: 250, max: 350, weight: 1.0 } },
        filters: { categories: ['sync-test'] },
        limit: 10,
        offset: 0
      }, context);

      expect(searchResult.success).toBe(true);
      foundProduct = searchResult.data?.items.find(item => item.product.id === productId);
      expect(foundProduct).toBeDefined();
      expect(foundProduct?.product.name).toBe('Updated Sync Test Product');

      // Verify old search no longer returns the product
      const oldSearchResult = await api.searchProducts({
        dimensions: { price: { min: 150, max: 250, weight: 1.0 } },
        filters: { categories: ['sync-test'] },
        limit: 10,
        offset: 0
      }, context);

      expect(oldSearchResult.success).toBe(true);
      const oldFoundProduct = oldSearchResult.data?.items.find(item => item.product.id === productId);
      expect(oldFoundProduct).toBeUndefined(); // Should not find in old price range

      // Verify direct API call returns updated data
      const directGet = await api.getProduct(productId, context);
      expect(directGet.success).toBe(true);
      expect(directGet.data?.name).toBe('Updated Sync Test Product');
      expect(directGet.data?.price.base).toBe(299.99);
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should properly isolate data between different contexts and users', async () => {
      // Create users in different contexts
      const context1 = { ...context, requestId: 'tenant1_req' };
      const context2 = { ...context, requestId: 'tenant2_req' };

      const user1Result = await orchestrator.executeWorkflow('user-onboarding', {
        name: 'Tenant 1 User',
        email: 'user1@tenant1.com'
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const user2Result = await orchestrator.executeWorkflow('user-onboarding', {
        name: 'Tenant 2 User',
        email: 'user2@tenant2.com'
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const user1Id = user1Result.create.userId;
      const user2Id = user2Result.create.userId;

      // Create products for each user
      const product1Result = await orchestrator.executeWorkflow('product-creation', {
        name: 'Tenant 1 Product',
        description: 'Product from tenant 1',
        price: 100,
        categories: ['tenant1'],
        coordinates: { price: 100, tenant: 1 },
        sellerId: user1Id
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      const product2Result = await orchestrator.executeWorkflow('product-creation', {
        name: 'Tenant 2 Product',
        description: 'Product from tenant 2',
        price: 200,
        categories: ['tenant2'],
        coordinates: { price: 200, tenant: 2 },
        sellerId: user2Id
      }, { cwd: '/test', env: {}, now: () => new Date(), memo: {} });

      // Verify each user can only see appropriate data
      const user1Context = { ...context1, userId: user1Id };
      const user2Context = { ...context2, userId: user2Id };

      // User 1 should see all products but with different personalization
      const user1Search = await api.searchProducts({
        dimensions: { price: { min: 50, max: 250, weight: 1.0 } },
        limit: 10,
        offset: 0
      }, user1Context);

      // User 2 should see all products but with different personalization
      const user2Search = await api.searchProducts({
        dimensions: { price: { min: 50, max: 250, weight: 1.0 } },
        limit: 10,
        offset: 0
      }, user2Context);

      expect(user1Search.success).toBe(true);
      expect(user2Search.success).toBe(true);

      // Both should find products, but potentially with different rankings due to personalization
      const user1Products = user1Search.data?.items.map(item => item.product.id) || [];
      const user2Products = user2Search.data?.items.map(item => item.product.id) || [];

      expect(user1Products.length).toBeGreaterThan(0);
      expect(user2Products.length).toBeGreaterThan(0);

      // Verify transaction isolation
      const crossTenantTransaction = await api.createTransaction({
        buyerId: user1Id,
        sellerId: user2Id,
        productId: product2Result.create.productId,
        quantity: 1
      }, user1Context);

      expect(crossTenantTransaction.success).toBe(true); // Cross-tenant transactions should be allowed

      // But each user should only see their own transaction history
      const user1History = await api.getUserTransactionHistory(user1Id, 10, user1Context);
      const user2History = await api.getUserTransactionHistory(user2Id, 10, user2Context);

      expect(user1History.success).toBe(true);
      expect(user2History.success).toBe(true);

      // User 1 should see transactions where they are buyer
      if (user1History.data && user1History.data.length > 0) {
        expect(user1History.data.every(t => t.buyer.id === user1Id)).toBe(true);
      }

      // User 2 should see transactions where they are seller
      if (user2History.data && user2History.data.length > 0) {
        expect(user2History.data.every(t => t.seller.id === user2Id)).toBe(true);
      }
    });
  });
});