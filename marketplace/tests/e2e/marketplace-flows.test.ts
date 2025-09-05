// End-to-End Tests for Marketplace User Flows
import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceAPI } from '../../api/routes';
import { WorkflowOrchestrator } from '../../workflows/orchestration';
import { DimensionalSearchEngine } from '../../src/dimensional-search';
import { TransactionEngine } from '../../src/transaction-engine';
import type { 
  APIContext, 
  ProductDimension, 
  UserDimension, 
  SearchQuery 
} from '../../types/dimensional-models';

describe('E2E Marketplace Flows', () => {
  let api: MarketplaceAPI;
  let orchestrator: WorkflowOrchestrator;
  let context: APIContext;

  beforeEach(() => {
    api = new MarketplaceAPI();
    api.initializeSampleData();
    orchestrator = new WorkflowOrchestrator();

    context = {
      requestId: 'e2e_test_' + Date.now(),
      timestamp: new Date()
    };
  });

  describe('Complete User Journey - Product Discovery to Purchase', () => {
    it('should complete full user journey from registration to purchase', async () => {
      // 1. User Registration
      const userRegistrationData = {
        name: 'Alice Customer',
        email: 'alice@example.com',
        preferences: { price: 0.4, quality: 0.8, speed: 0.6 },
        initialCoordinates: { price_sensitivity: 0.6, quality_preference: 0.9 }
      };

      const userResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        userRegistrationData,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      expect(userResult.validate.valid).toBe(true);
      expect(userResult.create.success).toBe(true);
      expect(userResult.create.userId).toBeDefined();

      const userId = userResult.create.userId;

      // 2. Browse Products - Search and Discovery
      const searchQuery: SearchQuery = {
        query: 'electronics',
        dimensions: {
          price: { min: 40, max: 200, weight: 0.7, preferred: 100 },
          quality: { min: 0.7, weight: 0.9 }
        },
        filters: { categories: ['electronics'] },
        limit: 10,
        offset: 0
      };

      const searchContext = { ...context, userId };
      const searchResult = await api.searchProducts(searchQuery, searchContext);

      expect(searchResult.success).toBe(true);
      expect(searchResult.data?.items.length).toBeGreaterThan(0);
      
      const selectedProduct = searchResult.data!.items[0].product;

      // 3. View Product Details
      const productDetailsResult = await api.getProduct(selectedProduct.id, searchContext);

      expect(productDetailsResult.success).toBe(true);
      expect(productDetailsResult.data?.id).toBe(selectedProduct.id);

      // 4. Add to Cart and Create Transaction
      const transactionData = {
        buyerId: userId,
        sellerId: selectedProduct.seller.id,
        productId: selectedProduct.id,
        quantity: 1
      };

      const transactionResult = await api.createTransaction(transactionData, searchContext);

      expect(transactionResult.success).toBe(true);
      expect(transactionResult.data?.buyer.id).toBe(userId);
      expect(transactionResult.data?.status).toBe('pending');

      const transactionId = transactionResult.data!.id;

      // 5. Process Payment and Complete Transaction
      const processResult = await api.processTransaction(transactionId, searchContext);

      // Payment processing might succeed or fail due to simulation
      if (processResult.success) {
        // 6. Verify Transaction Completion
        const completedTransaction = await api.getTransaction(transactionId, searchContext);
        expect(completedTransaction.success).toBe(true);
        expect(completedTransaction.data?.status).toBe('confirmed');
        expect(completedTransaction.data?.security.verified).toBe(true);

        // 7. Check User's Transaction History
        const historyResult = await api.getUserTransactionHistory(userId, 10, searchContext);
        expect(historyResult.success).toBe(true);
        expect(historyResult.data?.some(t => t.id === transactionId)).toBe(true);
      } else {
        // Handle payment failure gracefully
        const failedTransaction = await api.getTransaction(transactionId, searchContext);
        expect(failedTransaction.success).toBe(true);
        expect(failedTransaction.data?.status).toBe('cancelled');
      }

      // 8. Verify Transaction Integrity
      const verificationResult = await api.verifyTransaction(transactionId, searchContext);
      expect(verificationResult.success).toBe(true);
      expect(typeof verificationResult.data).toBe('boolean');
    });
  });

  describe('Seller Journey - Product Listing to Sale', () => {
    it('should complete seller journey from product creation to sale', async () => {
      // 1. Seller Registration
      const sellerData = {
        name: 'Bob Seller',
        email: 'bob@sellercompany.com',
        preferences: { profit_margin: 0.3, volume: 0.8 },
        initialCoordinates: { reliability: 0.9, speed: 0.8, quality: 0.85 }
      };

      const sellerResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        sellerData,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      expect(sellerResult.create.success).toBe(true);
      const sellerId = sellerResult.create.userId;

      // 2. Product Creation and Listing
      const productData = {
        name: 'Premium Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 299.99,
        categories: ['electronics', 'audio', 'headphones'],
        coordinates: { 
          price: 299.99, 
          quality: 0.95, 
          popularity: 0.7,
          audio_quality: 0.9,
          battery_life: 0.8
        },
        sellerId
      };

      const productResult = await orchestrator.executeWorkflow(
        'product-creation',
        productData,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      expect(productResult.create.success).toBe(true);
      expect(productResult.index.indexed).toBe(true);
      
      const productId = productResult.create.productId;

      // 3. Product Appears in Search Results
      const searchQuery: SearchQuery = {
        dimensions: {
          price: { min: 200, max: 400, weight: 0.6 },
          quality: { min: 0.8, weight: 0.9 }
        },
        filters: { categories: ['headphones'] },
        limit: 10,
        offset: 0
      };

      const searchResult = await api.searchProducts(searchQuery, context);
      expect(searchResult.success).toBe(true);
      
      const foundProduct = searchResult.data?.items.find(
        item => item.product.id === productId
      );
      expect(foundProduct).toBeDefined();

      // 4. Buyer Creates Transaction
      const buyerData = {
        name: 'Carol Buyer',
        email: 'carol@example.com',
        preferences: { price: 0.5, quality: 0.9, audio_quality: 0.95 },
        initialCoordinates: { spending_power: 0.8, tech_savvy: 0.9 }
      };

      const buyerResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        buyerData,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      const buyerId = buyerResult.create.userId;

      const transactionData = {
        buyerId,
        sellerId,
        productId,
        quantity: 1
      };

      const transactionResult = await api.createTransaction(transactionData, context);
      expect(transactionResult.success).toBe(true);

      // 5. Transaction Processing Workflow
      const processingInput = {
        productId,
        quantity: 1,
        amount: 299.99,
        transactionId: transactionResult.data!.id
      };

      const processingResult = await orchestrator.executeWorkflow(
        'transaction-processing',
        processingInput,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      expect(processingResult.reserve).toBeDefined();
      expect(processingResult.payment).toBeDefined();
      expect(processingResult.notify).toBeDefined();

      // 6. Verify Seller's Transaction History
      const sellerHistoryResult = await api.getUserTransactionHistory(sellerId, 10, context);
      expect(sellerHistoryResult.success).toBe(true);
      
      const sellerTransaction = sellerHistoryResult.data?.find(
        t => t.id === transactionResult.data!.id
      );
      expect(sellerTransaction).toBeDefined();
    });
  });

  describe('Multi-Dimensional Search Flow', () => {
    it('should demonstrate complex multi-dimensional search capabilities', async () => {
      // Create products with rich dimensional data
      const products = [
        {
          name: 'Budget Laptop',
          description: 'Affordable laptop for basic tasks',
          price: 599,
          categories: ['electronics', 'computers', 'laptops'],
          coordinates: {
            price: 599,
            quality: 0.6,
            performance: 0.5,
            portability: 0.8,
            battery_life: 0.6,
            screen_quality: 0.7
          }
        },
        {
          name: 'Gaming Laptop',
          description: 'High-performance gaming laptop',
          price: 1499,
          categories: ['electronics', 'computers', 'laptops', 'gaming'],
          coordinates: {
            price: 1499,
            quality: 0.9,
            performance: 0.95,
            portability: 0.6,
            battery_life: 0.7,
            screen_quality: 0.9,
            gaming_performance: 0.95
          }
        },
        {
          name: 'Ultrabook',
          description: 'Ultra-portable professional laptop',
          price: 1299,
          categories: ['electronics', 'computers', 'laptops', 'professional'],
          coordinates: {
            price: 1299,
            quality: 0.85,
            performance: 0.8,
            portability: 0.95,
            battery_life: 0.9,
            screen_quality: 0.85,
            build_quality: 0.9
          }
        }
      ];

      // Create all products
      const createdProducts = [];
      for (const product of products) {
        const result = await orchestrator.executeWorkflow(
          'product-creation',
          { ...product, sellerId: 'multi_seller' },
          { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
        );
        expect(result.create.success).toBe(true);
        createdProducts.push(result.create.productId);
      }

      // Test 1: Performance-focused search
      const performanceSearch: SearchQuery = {
        dimensions: {
          performance: { min: 0.8, weight: 1.0, preferred: 0.95 },
          price: { max: 2000, weight: 0.3 }
        },
        filters: { categories: ['laptops'] },
        sort: { dimension: 'performance', direction: 'desc' },
        limit: 5,
        offset: 0
      };

      const performanceResult = await api.searchProducts(performanceSearch, context);
      expect(performanceResult.success).toBe(true);
      expect(performanceResult.data?.items.length).toBeGreaterThan(0);

      // Gaming laptop should rank highest for performance
      const topPerformanceProduct = performanceResult.data?.items[0];
      expect(topPerformanceProduct?.product.name).toContain('Gaming');

      // Test 2: Portability-focused search
      const portabilitySearch: SearchQuery = {
        dimensions: {
          portability: { min: 0.8, weight: 1.0, preferred: 0.95 },
          battery_life: { min: 0.8, weight: 0.8 },
          price: { max: 1500, weight: 0.4 }
        },
        filters: { categories: ['laptops'] },
        sort: { dimension: 'portability', direction: 'desc' },
        limit: 5,
        offset: 0
      };

      const portabilityResult = await api.searchProducts(portabilitySearch, context);
      expect(portabilityResult.success).toBe(true);

      // Ultrabook should rank highest for portability
      const topPortabilityProduct = portabilityResult.data?.items[0];
      expect(topPortabilityProduct?.product.name).toContain('Ultrabook');

      // Test 3: Budget-constrained search
      const budgetSearch: SearchQuery = {
        dimensions: {
          price: { max: 800, weight: 1.0, preferred: 600 },
          quality: { min: 0.5, weight: 0.7 }
        },
        filters: { categories: ['laptops'], maxPrice: 800 },
        sort: { dimension: 'price', direction: 'asc' },
        limit: 5,
        offset: 0
      };

      const budgetResult = await api.searchProducts(budgetSearch, context);
      expect(budgetResult.success).toBe(true);

      // Budget laptop should be the primary result
      const budgetProduct = budgetResult.data?.items.find(
        item => item.product.name.includes('Budget')
      );
      expect(budgetProduct).toBeDefined();

      // Test 4: Complex multi-criteria search with user preferences
      const userData = {
        name: 'Dave TechUser',
        email: 'dave@tech.com',
        preferences: {
          performance: 0.9,
          portability: 0.7,
          price: 0.3,
          battery_life: 0.8
        },
        initialCoordinates: {
          tech_expertise: 0.9,
          mobility_needs: 0.8
        }
      };

      const userResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        userData,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      const userSearch: SearchQuery = {
        dimensions: {
          performance: { min: 0.7, weight: 0.9, preferred: 0.85 },
          portability: { min: 0.6, weight: 0.7, preferred: 0.8 },
          battery_life: { min: 0.6, weight: 0.8, preferred: 0.8 },
          price: { max: 1500, weight: 0.4 }
        },
        filters: { categories: ['laptops'] },
        limit: 3,
        offset: 0
      };

      const userContext = { ...context, userId: userResult.create.userId };
      const personalizedResult = await api.searchProducts(userSearch, userContext);

      expect(personalizedResult.success).toBe(true);
      expect(personalizedResult.data?.items.length).toBeGreaterThan(0);

      // Results should be personalized based on user preferences
      for (const item of personalizedResult.data!.items) {
        expect(item.score).toBeGreaterThan(0);
        expect(item.relevance).toBeDefined();
        expect(Object.keys(item.relevance).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fraud Detection and Security Flow', () => {
    it('should demonstrate fraud detection in transaction flow', async () => {
      // Create suspicious user profiles
      const suspiciousBuyer = {
        name: 'Fraud Attempt',
        email: 'suspicious@fake.com',
        preferences: {},
        initialCoordinates: {
          spending_power: -100,  // Suspicious negative coordinates
          trust_level: -50,
          location_stability: -200
        }
      };

      const suspiciousSeller = {
        name: 'Sketchy Seller',
        email: 'sketchy@fake.com',
        preferences: {},
        initialCoordinates: {
          reliability: -100,     // Suspicious negative coordinates
          authenticity: -75,
          history_length: -150
        }
      };

      const buyerResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        suspiciousBuyer,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      const sellerResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        suspiciousSeller,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      // Create a product with suspicious pricing
      const suspiciousProduct = {
        name: 'Fake Product',
        description: 'Suspiciously cheap product',
        price: 10,  // Very low price
        categories: ['suspicious'],
        coordinates: {
          price: 10,
          quality: 0.9,  // High quality claim with low price - suspicious
          authenticity: -50  // Negative authenticity score
        },
        sellerId: sellerResult.create.userId
      };

      const productResult = await orchestrator.executeWorkflow(
        'product-creation',
        suspiciousProduct,
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      // Attempt rapid multiple transactions (fraud pattern)
      const transactionPromises = [];
      for (let i = 0; i < 7; i++) {  // More than the 5 threshold
        transactionPromises.push(
          api.createTransaction({
            buyerId: buyerResult.create.userId,
            sellerId: sellerResult.create.userId,
            productId: productResult.create.productId,
            quantity: 1
          }, context)
        );
      }

      const transactionResults = await Promise.all(transactionPromises);

      // Should detect fraud patterns
      let fraudWarningsFound = false;
      let transactionsBlocked = 0;

      for (const result of transactionResults) {
        if (result.success) {
          if (result.metadata?.warnings && result.metadata.warnings.length > 0) {
            fraudWarningsFound = true;
            expect(result.metadata.warnings.some(
              w => w.includes('Rapid multiple transactions') ||
                   w.includes('dimensional distance') ||
                   w.includes('trust score')
            )).toBe(true);
          }
        } else {
          transactionsBlocked++;
        }
      }

      // Should detect suspicious activity
      expect(fraudWarningsFound || transactionsBlocked > 0).toBe(true);

      // Test transaction integrity verification
      const successfulTransactions = transactionResults.filter(r => r.success);
      if (successfulTransactions.length > 0) {
        for (const transaction of successfulTransactions) {
          const verificationResult = await api.verifyTransaction(
            transaction.data!.id,
            context
          );
          expect(verificationResult.success).toBe(true);
          expect(typeof verificationResult.data).toBe('boolean');
        }
      }
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle concurrent user operations efficiently', async () => {
      const startTime = performance.now();

      // Create multiple users concurrently
      const userPromises = Array.from({ length: 10 }, (_, i) =>
        orchestrator.executeWorkflow(
          'user-onboarding',
          {
            name: `Concurrent User ${i}`,
            email: `user${i}@concurrent.test`,
            preferences: { price: Math.random(), quality: Math.random() },
            initialCoordinates: { 
              engagement: Math.random(),
              experience: Math.random()
            }
          },
          { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
        )
      );

      const userResults = await Promise.all(userPromises);
      const userCreationTime = performance.now() - startTime;

      expect(userResults.every(r => r.create.success)).toBe(true);
      expect(userCreationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Create multiple products concurrently
      const productStartTime = performance.now();
      const productPromises = Array.from({ length: 20 }, (_, i) =>
        orchestrator.executeWorkflow(
          'product-creation',
          {
            name: `Concurrent Product ${i}`,
            description: `Product number ${i}`,
            price: 100 + i * 10,
            categories: ['concurrent', `category${i % 3}`],
            coordinates: {
              price: 100 + i * 10,
              quality: 0.5 + Math.random() * 0.5,
              popularity: Math.random(),
              category_factor: i % 3
            },
            sellerId: userResults[i % userResults.length].create.userId
          },
          { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
        )
      );

      const productResults = await Promise.all(productPromises);
      const productCreationTime = performance.now() - productStartTime;

      expect(productResults.every(r => r.create.success)).toBe(true);
      expect(productCreationTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Perform concurrent searches
      const searchStartTime = performance.now();
      const searchPromises = Array.from({ length: 50 }, (_, i) => {
        const query: SearchQuery = {
          dimensions: {
            price: { min: 50 + i, max: 300 + i, weight: Math.random() },
            quality: { min: 0.3, weight: Math.random() }
          },
          limit: 10,
          offset: 0
        };
        return api.searchProducts(query, {
          ...context,
          requestId: `concurrent_search_${i}`
        });
      });

      const searchResults = await Promise.all(searchPromises);
      const searchTime = performance.now() - searchStartTime;

      expect(searchResults.every(r => r.success)).toBe(true);
      expect(searchTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify search performance metrics
      const avgSearchTime = searchResults.reduce(
        (sum, r) => sum + (r.data?.metadata.executionTime || 0),
        0
      ) / searchResults.length;

      expect(avgSearchTime).toBeLessThan(100); // Average search should be under 100ms
    });

    it('should maintain data consistency under load', async () => {
      // Create base user and product
      const userResult = await orchestrator.executeWorkflow(
        'user-onboarding',
        {
          name: 'Consistency Test User',
          email: 'consistency@test.com',
          preferences: { price: 0.5, quality: 0.8 }
        },
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      const productResult = await orchestrator.executeWorkflow(
        'product-creation',
        {
          name: 'Consistency Test Product',
          description: 'Testing consistency',
          price: 199.99,
          categories: ['consistency'],
          coordinates: { price: 199.99, quality: 0.9 },
          sellerId: userResult.create.userId
        },
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      const userId = userResult.create.userId;
      const productId = productResult.create.productId;

      // Perform concurrent read operations
      const readPromises = Array.from({ length: 100 }, () => 
        Promise.all([
          api.getUser(userId, context),
          api.getProduct(productId, context),
          api.getMarketplaceStats(context)
        ])
      );

      const readResults = await Promise.all(readPromises);

      // All reads should succeed and return consistent data
      for (const [userRead, productRead, statsRead] of readResults) {
        expect(userRead.success).toBe(true);
        expect(userRead.data?.id).toBe(userId);
        expect(userRead.data?.profile.name).toBe('Consistency Test User');

        expect(productRead.success).toBe(true);
        expect(productRead.data?.id).toBe(productId);
        expect(productRead.data?.name).toBe('Consistency Test Product');

        expect(statsRead.success).toBe(true);
        expect(typeof statsRead.data?.products).toBe('number');
        expect(typeof statsRead.data?.users).toBe('number');
      }
    });
  });

  describe('System Health and Monitoring Flow', () => {
    it('should demonstrate comprehensive health monitoring', async () => {
      // Initialize system with data
      await orchestrator.executeWorkflow(
        'user-onboarding',
        {
          name: 'Health Monitor User',
          email: 'health@monitor.test',
          preferences: {}
        },
        { cwd: '/test', env: {}, now: () => new Date(), memo: {} }
      );

      // Check initial health
      const initialHealth = await api.healthCheck(context);
      expect(initialHealth.success).toBe(true);
      expect(initialHealth.data?.services).toBeDefined();

      // Get marketplace statistics
      const stats = await api.getMarketplaceStats(context);
      expect(stats.success).toBe(true);
      expect(stats.data?.products).toBeGreaterThan(0);
      expect(stats.data?.users).toBeGreaterThan(0);

      // Monitor system under various loads
      const healthChecks = [];
      
      // Create load while monitoring
      const loadPromises = Array.from({ length: 20 }, (_, i) => 
        api.createUser({
          coordinates: { test: i },
          profile: { 
            name: `Load User ${i}`, 
            email: `load${i}@test.com`, 
            preferences: {} 
          },
          behavior: { browsingPattern: {}, purchaseHistory: [], engagement: {} },
          reputation: { score: 3.0, reviews: 0, transactions: 0 }
        }, { ...context, requestId: `load_${i}` })
      );

      // Monitor health during load
      const monitoringPromises = Array.from({ length: 5 }, () =>
        new Promise(resolve => {
          setTimeout(async () => {
            const health = await api.healthCheck(context);
            resolve(health);
          }, Math.random() * 1000);
        })
      );

      const [loadResults, healthResults] = await Promise.all([
        Promise.all(loadPromises),
        Promise.all(monitoringPromises)
      ]);

      // Verify load handled successfully
      expect(loadResults.every(r => r.success)).toBe(true);

      // Verify health remained stable
      for (const health of healthResults as any[]) {
        expect(health.success).toBe(true);
        expect(health.data?.status).toMatch(/^(healthy|partial)$/);
      }

      // Final comprehensive health check
      const finalHealth = await api.healthCheck(context);
      expect(finalHealth.success).toBe(true);
      expect(finalHealth.data?.services.transactionEngine).toBe(true);

      // Verify final statistics reflect the load testing
      const finalStats = await api.getMarketplaceStats(context);
      expect(finalStats.success).toBe(true);
      expect(finalStats.data?.users).toBeGreaterThan(stats.data!.users);
    });
  });
});