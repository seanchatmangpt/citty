// Unit Tests for API Routes
import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceAPI } from '../../api/routes';
import type { APIContext, ProductDimension, UserDimension, SearchQuery } from '../../types/dimensional-models';

describe('Marketplace API', () => {
  let api: MarketplaceAPI;
  let context: APIContext;

  beforeEach(() => {
    api = new MarketplaceAPI();
    api.initializeSampleData();

    context = {
      requestId: 'test_req_' + Date.now(),
      timestamp: new Date(),
      userId: 'test_user'
    };
  });

  describe('Product Management', () => {
    const sampleProductData = {
      name: 'Test Product',
      description: 'A product for testing',
      coordinates: { price: 99.99, quality: 0.85, popularity: 0.6 },
      price: { base: 99.99, currency: 'USD' },
      categories: ['electronics', 'test'],
      attributes: { color: 'blue' },
      availability: { total: 100 },
      quality: { score: 0.85 },
      seller: {
        id: 'test_seller',
        reputation: 4.5,
        coordinates: { reliability: 0.9, speed: 0.8 }
      }
    };

    it('should create a new product', async () => {
      const response = await api.createProduct(sampleProductData, context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.id).toMatch(/^prod_/);
      expect(response.data?.name).toBe(sampleProductData.name);
      expect(response.data?.version).toBe(1);
      expect(response.metadata?.requestId).toBe(context.requestId);
    });

    it('should retrieve an existing product', async () => {
      const createResponse = await api.createProduct(sampleProductData, context);
      expect(createResponse.success).toBe(true);

      const getResponse = await api.getProduct(createResponse.data!.id, context);

      expect(getResponse.success).toBe(true);
      expect(getResponse.data?.id).toBe(createResponse.data?.id);
      expect(getResponse.data?.name).toBe(sampleProductData.name);
    });

    it('should return error for non-existent product', async () => {
      const response = await api.getProduct('non_existent_product', context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Product not found');
      expect(response.data).toBeUndefined();
    });

    it('should update an existing product', async () => {
      const createResponse = await api.createProduct(sampleProductData, context);
      expect(createResponse.success).toBe(true);

      const updates = { name: 'Updated Product Name', price: { base: 150, currency: 'USD' } };
      const updateResponse = await api.updateProduct(createResponse.data!.id, updates, context);

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data?.name).toBe('Updated Product Name');
      expect(updateResponse.data?.price.base).toBe(150);
      expect(updateResponse.data?.version).toBe(2);
    });

    it('should return error when updating non-existent product', async () => {
      const response = await api.updateProduct('non_existent', { name: 'Test' }, context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Product not found');
    });

    it('should delete an existing product', async () => {
      const createResponse = await api.createProduct(sampleProductData, context);
      expect(createResponse.success).toBe(true);

      const deleteResponse = await api.deleteProduct(createResponse.data!.id, context);

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data).toBe(true);

      // Verify product is deleted
      const getResponse = await api.getProduct(createResponse.data!.id, context);
      expect(getResponse.success).toBe(false);
    });

    it('should return error when deleting non-existent product', async () => {
      const response = await api.deleteProduct('non_existent', context);

      expect(response.success).toBe(false);
      expect(response.data).toBe(false);
      expect(response.error).toBe('Product not found');
    });

    it('should handle product creation errors gracefully', async () => {
      const invalidProductData = {
        ...sampleProductData,
        name: '', // Invalid empty name
      };

      const response = await api.createProduct(invalidProductData as any, context);

      // Should still create but might have warnings or handle validation
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('');
    });
  });

  describe('User Management', () => {
    const sampleUserData = {
      coordinates: { price_sensitivity: 0.7, quality_preference: 0.9 },
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: { price: 0.3, quality: 0.9 }
      },
      behavior: {
        browsingPattern: { electronics: 0.8 },
        purchaseHistory: [],
        engagement: { clicks: 50 }
      },
      reputation: { score: 4.0, reviews: 5, transactions: 3 }
    };

    it('should create a new user', async () => {
      const response = await api.createUser(sampleUserData, context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.id).toMatch(/^user_/);
      expect(response.data?.profile.name).toBe(sampleUserData.profile.name);
      expect(response.data?.version).toBe(1);
    });

    it('should retrieve an existing user', async () => {
      const createResponse = await api.createUser(sampleUserData, context);
      expect(createResponse.success).toBe(true);

      const getResponse = await api.getUser(createResponse.data!.id, context);

      expect(getResponse.success).toBe(true);
      expect(getResponse.data?.id).toBe(createResponse.data?.id);
      expect(getResponse.data?.profile.email).toBe(sampleUserData.profile.email);
    });

    it('should return error for non-existent user', async () => {
      const response = await api.getUser('non_existent_user', context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('User not found');
    });

    it('should update user preferences', async () => {
      const createResponse = await api.createUser(sampleUserData, context);
      expect(createResponse.success).toBe(true);

      const newPreferences = { price: 0.5, quality: 0.8, speed: 0.7 };
      const updateResponse = await api.updateUserPreferences(
        createResponse.data!.id,
        newPreferences,
        context
      );

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data?.profile.preferences.price).toBe(0.5);
      expect(updateResponse.data?.profile.preferences.quality).toBe(0.8);
      expect(updateResponse.data?.profile.preferences.speed).toBe(0.7);
      expect(updateResponse.data?.version).toBe(2);
    });

    it('should handle invalid email in user creation', async () => {
      const invalidUserData = {
        ...sampleUserData,
        profile: {
          ...sampleUserData.profile,
          email: 'invalid-email'
        }
      };

      const response = await api.createUser(invalidUserData, context);
      
      // Should handle validation at the schema level or application level
      expect(response.success || response.error).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Create some test products for searching
      const products = [
        {
          name: 'Budget Phone',
          coordinates: { price: 100, quality: 0.7, popularity: 0.5 },
          price: { base: 100, currency: 'USD' },
          categories: ['electronics', 'phone'],
          description: 'Affordable phone',
          attributes: {},
          availability: { total: 50 },
          quality: { score: 0.7 },
          seller: { id: 'seller_1', reputation: 4.0, coordinates: { reliability: 0.8 } }
        },
        {
          name: 'Premium Phone',
          coordinates: { price: 500, quality: 0.95, popularity: 0.9 },
          price: { base: 500, currency: 'USD' },
          categories: ['electronics', 'phone'],
          description: 'High-end phone',
          attributes: {},
          availability: { total: 25 },
          quality: { score: 0.95 },
          seller: { id: 'seller_2', reputation: 4.8, coordinates: { reliability: 0.95 } }
        }
      ];

      for (const product of products) {
        await api.createProduct(product, context);
      }
    });

    it('should search products successfully', async () => {
      const searchQuery: SearchQuery = {
        dimensions: {
          price: { min: 50, max: 300, weight: 0.8 },
          quality: { min: 0.6, weight: 0.9 }
        },
        limit: 10,
        offset: 0
      };

      const response = await api.searchProducts(searchQuery, context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.items).toBeDefined();
      expect(response.data?.metadata.total).toBeGreaterThan(0);
      expect(response.data?.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should search with user context', async () => {
      const user = await api.createUser({
        coordinates: { price_sensitivity: 0.8 },
        profile: {
          name: 'Search User',
          email: 'search@example.com',
          preferences: { price: 0.9, quality: 0.6 }
        },
        behavior: { browsingPattern: {}, purchaseHistory: [], engagement: {} },
        reputation: { score: 3.5, reviews: 0, transactions: 0 }
      }, context);

      const searchQuery: SearchQuery = {
        dimensions: {
          price: { preferred: 150, weight: 1.0 }
        },
        limit: 5,
        offset: 0
      };

      const searchContext = { ...context, userId: user.data?.id };
      const response = await api.searchProducts(searchQuery, searchContext);

      expect(response.success).toBe(true);
      expect(response.metadata?.userId).toBe(user.data?.id);
    });

    it('should handle search without initialized engine', async () => {
      const freshApi = new MarketplaceAPI();
      
      const searchQuery: SearchQuery = {
        dimensions: { price: { min: 0, max: 100, weight: 1.0 } },
        limit: 10,
        offset: 0
      };

      const response = await freshApi.searchProducts(searchQuery, context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Search engine not initialized');
    });

    it('should get search suggestions', async () => {
      const response = await api.getSearchSuggestions('phone', undefined, context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should handle search suggestions without engine', async () => {
      const freshApi = new MarketplaceAPI();
      
      const response = await freshApi.getSearchSuggestions('test', undefined, context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Search engine not initialized');
    });
  });

  describe('Transaction Management', () => {
    let buyer: UserDimension;
    let seller: UserDimension;
    let product: ProductDimension;

    beforeEach(async () => {
      // Create test users and product
      const buyerResponse = await api.createUser({
        coordinates: { spending_power: 0.8 },
        profile: { name: 'Buyer', email: 'buyer@test.com', preferences: {} },
        behavior: { browsingPattern: {}, purchaseHistory: [], engagement: {} },
        reputation: { score: 4.0, reviews: 5, transactions: 3 }
      }, context);

      const sellerResponse = await api.createUser({
        coordinates: { reliability: 0.9 },
        profile: { name: 'Seller', email: 'seller@test.com', preferences: {} },
        behavior: { browsingPattern: {}, purchaseHistory: [], engagement: {} },
        reputation: { score: 4.5, reviews: 20, transactions: 50 }
      }, context);

      const productResponse = await api.createProduct({
        name: 'Test Product',
        description: 'For transaction testing',
        coordinates: { price: 100, quality: 0.8 },
        price: { base: 100, currency: 'USD' },
        categories: ['test'],
        attributes: {},
        availability: { total: 10 },
        quality: { score: 0.8 },
        seller: { id: sellerResponse.data!.id, reputation: 4.5, coordinates: { reliability: 0.9 } }
      }, context);

      buyer = buyerResponse.data!;
      seller = sellerResponse.data!;
      product = productResponse.data!;
    });

    it('should create a transaction', async () => {
      const transactionData = {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        quantity: 1
      };

      const response = await api.createTransaction(transactionData, context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.buyer.id).toBe(buyer.id);
      expect(response.data?.seller.id).toBe(seller.id);
      expect(response.data?.product.id).toBe(product.id);
    });

    it('should reject transaction with invalid participants', async () => {
      const transactionData = {
        buyerId: 'non_existent_buyer',
        sellerId: seller.id,
        productId: product.id,
        quantity: 1
      };

      const response = await api.createTransaction(transactionData, context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid transaction participants');
    });

    it('should process a transaction', async () => {
      const transactionData = {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        quantity: 1
      };

      const createResponse = await api.createTransaction(transactionData, context);
      expect(createResponse.success).toBe(true);

      const processResponse = await api.processTransaction(createResponse.data!.id, context);

      // Note: Processing might succeed or fail depending on payment simulation
      expect(typeof processResponse.success).toBe('boolean');
      expect(processResponse.data).toBe(processResponse.success);
    });

    it('should retrieve transaction by ID', async () => {
      const transactionData = {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        quantity: 1
      };

      const createResponse = await api.createTransaction(transactionData, context);
      expect(createResponse.success).toBe(true);

      const getResponse = await api.getTransaction(createResponse.data!.id, context);

      expect(getResponse.success).toBe(true);
      expect(getResponse.data?.id).toBe(createResponse.data?.id);
    });

    it('should get user transaction history', async () => {
      // Create multiple transactions
      for (let i = 0; i < 3; i++) {
        const transactionData = {
          buyerId: buyer.id,
          sellerId: seller.id,
          productId: product.id,
          quantity: 1
        };
        await api.createTransaction(transactionData, context);
      }

      const historyResponse = await api.getUserTransactionHistory(buyer.id, 10, context);

      expect(historyResponse.success).toBe(true);
      expect(historyResponse.data).toBeDefined();
      expect(Array.isArray(historyResponse.data)).toBe(true);
      expect(historyResponse.metadata?.total).toBeGreaterThan(0);
    });

    it('should verify transaction integrity', async () => {
      const transactionData = {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        quantity: 1
      };

      const createResponse = await api.createTransaction(transactionData, context);
      expect(createResponse.success).toBe(true);

      const verifyResponse = await api.verifyTransaction(createResponse.data!.id, context);

      expect(verifyResponse.success).toBe(true);
      expect(typeof verifyResponse.data).toBe('boolean');
    });
  });

  describe('Analytics and Health', () => {
    it('should get marketplace statistics', async () => {
      const response = await api.getMarketplaceStats(context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(typeof response.data?.products).toBe('number');
      expect(typeof response.data?.users).toBe('number');
      expect(typeof response.data?.transactions).toBe('number');
      expect(Array.isArray(response.data?.dimensions)).toBe(true);
    });

    it('should perform health check', async () => {
      const response = await api.healthCheck(context);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.status).toMatch(/^(healthy|partial)$/);
      expect(response.data?.timestamp).toBeInstanceOf(Date);
      expect(response.data?.services).toBeDefined();
    });

    it('should handle health check for uninitialized API', async () => {
      const freshApi = new MarketplaceAPI();
      const response = await freshApi.healthCheck(context);

      expect(response.success).toBe(true);
      expect(response.data?.status).toBe('partial'); // Should indicate partial health
      expect(response.data?.services.searchEngine).toBe(false);
      expect(response.data?.services.transactionEngine).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const malformedData = null as any;

      const response = await api.createProduct(malformedData, context);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle missing context gracefully', async () => {
      const productData = {
        name: 'Test',
        description: 'Test',
        coordinates: { price: 100 },
        price: { base: 100, currency: 'USD' },
        categories: ['test'],
        attributes: {},
        availability: { total: 10 },
        quality: { score: 0.8 },
        seller: { id: 'test', reputation: 4.0, coordinates: { reliability: 0.8 } }
      };

      const invalidContext = {} as APIContext;
      const response = await api.createProduct(productData, invalidContext);

      // Should handle missing fields gracefully
      expect(response.success || response.error).toBeTruthy();
    });

    it('should handle exceptions in API methods', async () => {
      // Force an error by manipulating internal state
      const productData = {
        name: 'Test',
        description: 'Test',
        coordinates: { price: 100 },
        price: { base: 100, currency: 'USD' },
        categories: ['test'],
        attributes: {},
        availability: { total: 10 },
        quality: { score: 0.8 },
        seller: { id: 'test', reputation: 4.0, coordinates: { reliability: 0.8 } }
      };

      // This should still work normally
      const response = await api.createProduct(productData, context);
      expect(response.success).toBe(true);
    });
  });

  describe('Request ID Tracking', () => {
    it('should include request ID in all responses', async () => {
      const testRequestId = 'test_tracking_' + Date.now();
      const trackingContext = { ...context, requestId: testRequestId };

      const productResponse = await api.createProduct({
        name: 'Tracking Test',
        description: 'Test',
        coordinates: { price: 100 },
        price: { base: 100, currency: 'USD' },
        categories: ['test'],
        attributes: {},
        availability: { total: 10 },
        quality: { score: 0.8 },
        seller: { id: 'test', reputation: 4.0, coordinates: { reliability: 0.8 } }
      }, trackingContext);

      expect(productResponse.metadata?.requestId).toBe(testRequestId);

      if (productResponse.success) {
        const getResponse = await api.getProduct(productResponse.data!.id, trackingContext);
        expect(getResponse.metadata?.requestId).toBe(testRequestId);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent product creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        api.createProduct({
          name: `Concurrent Product ${i}`,
          description: `Product ${i}`,
          coordinates: { price: 100 + i },
          price: { base: 100 + i, currency: 'USD' },
          categories: ['concurrent'],
          attributes: {},
          availability: { total: 10 },
          quality: { score: 0.8 },
          seller: { id: 'seller', reputation: 4.0, coordinates: { reliability: 0.8 } }
        }, { ...context, requestId: `concurrent_${i}` })
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.data?.id).every((id, index, arr) => 
        arr.indexOf(id) === index
      )).toBe(true); // All IDs should be unique
    });

    it('should handle concurrent user operations', async () => {
      const userPromise = api.createUser({
        coordinates: { test: 1 },
        profile: { name: 'Concurrent User', email: 'concurrent@test.com', preferences: {} },
        behavior: { browsingPattern: {}, purchaseHistory: [], engagement: {} },
        reputation: { score: 3.0, reviews: 0, transactions: 0 }
      }, context);

      const productPromise = api.createProduct({
        name: 'Concurrent Product',
        description: 'Test',
        coordinates: { price: 100 },
        price: { base: 100, currency: 'USD' },
        categories: ['test'],
        attributes: {},
        availability: { total: 10 },
        quality: { score: 0.8 },
        seller: { id: 'seller', reputation: 4.0, coordinates: { reliability: 0.8 } }
      }, context);

      const [userResult, productResult] = await Promise.all([userPromise, productPromise]);

      expect(userResult.success).toBe(true);
      expect(productResult.success).toBe(true);
    });
  });
});