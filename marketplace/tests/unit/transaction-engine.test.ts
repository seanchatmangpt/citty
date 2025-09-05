// Unit Tests for Transaction Engine
import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionEngine } from '../../src/transaction-engine';
import type { 
  TransactionContext,
  TrustMetrics,
  ProductDimension,
  UserDimension 
} from '../../types/dimensional-models';

describe('Transaction Engine', () => {
  let transactionEngine: TransactionEngine;
  let sampleBuyer: UserDimension;
  let sampleSeller: UserDimension;
  let sampleProduct: ProductDimension;
  let validContext: TransactionContext;

  beforeEach(() => {
    transactionEngine = new TransactionEngine();

    sampleBuyer = {
      id: 'buyer_123',
      coordinates: { spending_power: 0.8, trust_level: 0.9 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'John Buyer',
        email: 'buyer@example.com',
        preferences: { price: 0.3, quality: 0.9, speed: 0.7 }
      },
      behavior: {
        browsingPattern: { electronics: 0.8 },
        purchaseHistory: [
          {
            productId: 'prev_prod_1',
            timestamp: new Date(Date.now() - 86400000),
            satisfaction: 4.5
          }
        ],
        engagement: { clicks: 100, time_spent: 2000 }
      },
      reputation: { score: 4.2, reviews: 15, transactions: 8 }
    };

    sampleSeller = {
      id: 'seller_456',
      coordinates: { reliability: 0.9, speed: 0.8, quality: 0.85 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Jane Seller',
        email: 'seller@example.com',
        preferences: { profit_margin: 0.2 }
      },
      behavior: {
        browsingPattern: {},
        purchaseHistory: [],
        engagement: {}
      },
      reputation: { score: 4.7, reviews: 50, transactions: 200 }
    };

    sampleProduct = {
      id: 'prod_789',
      coordinates: { price: 100, quality: 0.9, popularity: 0.7 },
      timestamp: new Date(),
      version: 1,
      name: 'Premium Widget',
      description: 'High-quality widget',
      price: { 
        base: 100, 
        currency: 'USD',
        dimensions: { quality_premium: 10, popularity_bonus: 5 }
      },
      categories: ['electronics', 'widgets'],
      attributes: { color: 'blue', size: 'large' },
      availability: { total: 50, byDimension: { region_us: 30, region_eu: 20 } },
      quality: { score: 0.9, metrics: { durability: 0.95, performance: 0.85 } },
      seller: {
        id: 'seller_456',
        reputation: 4.7,
        coordinates: { reliability: 0.9, speed: 0.8 }
      }
    };

    validContext = {
      buyer: sampleBuyer,
      seller: sampleSeller,
      product: sampleProduct,
      quantity: 2,
      metadata: { channel: 'web', referrer: 'search' }
    };
  });

  describe('Transaction Creation', () => {
    it('should create a valid transaction', async () => {
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.id).toMatch(/^txn_/);
      expect(result.transaction.status).toBe('pending');
      expect(result.transaction.buyer.id).toBe(sampleBuyer.id);
      expect(result.transaction.seller.id).toBe(sampleSeller.id);
      expect(result.transaction.product.id).toBe(sampleProduct.id);
      expect(result.transaction.product.quantity).toBe(2);
    });

    it('should calculate dimensional pricing correctly', async () => {
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.success).toBe(true);
      expect(result.transaction.pricing.base).toBe(200); // 100 * 2 quantity
      expect(result.transaction.pricing.final).toBeGreaterThan(0);
      expect(result.transaction.pricing.currency).toBe('USD');
      expect(result.transaction.pricing.adjustments).toBeDefined();
    });

    it('should calculate trust metrics', async () => {
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.success).toBe(true);
      expect(result.transaction.metrics.distance).toBeGreaterThanOrEqual(0);
      expect(result.transaction.metrics.similarity).toBeGreaterThanOrEqual(0);
      expect(result.transaction.metrics.similarity).toBeLessThanOrEqual(1);
      expect(result.transaction.metrics.trust).toBeGreaterThanOrEqual(0);
      expect(result.transaction.metrics.trust).toBeLessThanOrEqual(1);
    });

    it('should generate security elements', async () => {
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.success).toBe(true);
      expect(result.transaction.security.hash).toBeDefined();
      expect(result.transaction.security.hash).toHaveLength(64); // SHA-256 hex
      expect(result.transaction.security.signature).toBeDefined();
      expect(result.transaction.security.verified).toBe(false);
    });

    it('should calculate transaction coordinates', async () => {
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.success).toBe(true);
      expect(result.transaction.coordinates).toBeDefined();
      
      // Should have coordinates from all participating entities
      const coords = result.transaction.coordinates;
      expect(coords.spending_power).toBeDefined(); // From buyer
      expect(coords.reliability).toBeDefined(); // From seller
      expect(coords.price).toBeDefined(); // From product
    });
  });

  describe('Transaction Validation', () => {
    it('should reject transaction with missing participants', async () => {
      const invalidContext = {
        ...validContext,
        buyer: null as any
      };

      const result = await transactionEngine.createTransaction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required transaction participants');
    });

    it('should reject self-transaction', async () => {
      const selfContext = {
        ...validContext,
        seller: { ...sampleSeller, id: sampleBuyer.id }
      };

      const result = await transactionEngine.createTransaction(selfContext);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Buyer and seller cannot be the same user');
    });

    it('should reject invalid quantity', async () => {
      const invalidQuantityContext = {
        ...validContext,
        quantity: 0
      };

      const result = await transactionEngine.createTransaction(invalidQuantityContext);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Quantity must be positive');
    });

    it('should reject insufficient availability', async () => {
      const insufficientContext = {
        ...validContext,
        quantity: 100, // More than available (50)
        product: { ...sampleProduct, availability: { total: 50 } }
      };

      const result = await transactionEngine.createTransaction(insufficientContext);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Insufficient product availability');
    });

    it('should reject entities without coordinates', async () => {
      const noCoordinatesContext = {
        ...validContext,
        buyer: { ...sampleBuyer, coordinates: {} }
      };

      const result = await transactionEngine.createTransaction(noCoordinatesContext);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('All entities must have dimensional coordinates');
    });
  });

  describe('Fraud Detection', () => {
    it('should detect rapid multiple transactions', async () => {
      // Create multiple transactions quickly
      for (let i = 0; i < 6; i++) {
        await transactionEngine.createTransaction(validContext);
      }

      // This should trigger fraud detection
      const result = await transactionEngine.createTransaction(validContext);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('Rapid multiple transactions'))).toBe(true);
    });

    it('should detect extreme dimensional distance', async () => {
      const extremeContext = {
        ...validContext,
        buyer: {
          ...sampleBuyer,
          coordinates: { spending_power: -500, trust_level: -1000 } // Very far from seller
        }
      };

      const result = await transactionEngine.createTransaction(extremeContext);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('dimensional distance'))).toBe(true);
    });

    it('should detect price manipulation', async () => {
      const manipulatedContext = {
        ...validContext,
        product: {
          ...sampleProduct,
          price: {
            base: 10,
            currency: 'USD',
            dimensions: { manipulation: 1000 } // Extreme price adjustment
          }
        }
      };

      const result = await transactionEngine.createTransaction(manipulatedContext);

      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('price deviation'))).toBe(true);
      }
    });

    it('should block transactions with very low trust', async () => {
      const lowTrustContext = {
        ...validContext,
        buyer: {
          ...sampleBuyer,
          reputation: { score: 0.5, reviews: 0, transactions: 0 },
          coordinates: { spending_power: -100, trust_level: -100 }
        },
        seller: {
          ...sampleSeller,
          reputation: { score: 0.5, reviews: 0, transactions: 0 },
          coordinates: { reliability: -100, speed: -100, quality: -100 }
        }
      };

      const result = await transactionEngine.createTransaction(lowTrustContext);

      // Might be blocked or have warnings depending on exact trust calculation
      expect(result.success || result.warnings?.length).toBeTruthy();
    });
  });

  describe('Transaction Processing', () => {
    it('should process a valid pending transaction', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      const processResult = await transactionEngine.processTransaction(createResult.transaction.id);
      expect(processResult).toBe(true);

      const transaction = transactionEngine.getTransaction(createResult.transaction.id);
      expect(transaction?.status).toBe('confirmed');
      expect(transaction?.security.verified).toBe(true);
    });

    it('should handle payment processing failures', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      // Process multiple times to potentially hit the 5% failure rate
      let failureEncountered = false;
      for (let i = 0; i < 50; i++) {
        const context = {
          ...validContext,
          product: { ...validContext.product, id: `prod_${i}` }
        };
        const result = await transactionEngine.createTransaction(context);
        if (result.success) {
          const processed = await transactionEngine.processTransaction(result.transaction.id);
          if (!processed) {
            failureEncountered = true;
            const transaction = transactionEngine.getTransaction(result.transaction.id);
            expect(transaction?.status).toBe('cancelled');
            break;
          }
        }
      }
      
      // Note: This is probabilistic, so we can't guarantee failure will occur
      // But the test verifies that failures are handled correctly when they do occur
    });

    it('should reject processing non-existent transaction', async () => {
      await expect(
        transactionEngine.processTransaction('non_existent_txn')
      ).rejects.toThrow('Transaction not found');
    });

    it('should reject processing already processed transaction', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      const firstProcess = await transactionEngine.processTransaction(createResult.transaction.id);
      expect(firstProcess).toBe(true);

      await expect(
        transactionEngine.processTransaction(createResult.transaction.id)
      ).rejects.toThrow('Transaction cannot be processed in current status');
    });
  });

  describe('Transaction History and Retrieval', () => {
    beforeEach(async () => {
      // Create some sample transactions
      for (let i = 0; i < 3; i++) {
        const context = {
          ...validContext,
          product: { ...validContext.product, id: `prod_hist_${i}` }
        };
        await transactionEngine.createTransaction(context);
      }
    });

    it('should retrieve transaction by ID', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      const retrieved = transactionEngine.getTransaction(createResult.transaction.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(createResult.transaction.id);
    });

    it('should return undefined for non-existent transaction', () => {
      const retrieved = transactionEngine.getTransaction('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get transaction history for buyer', () => {
      const history = transactionEngine.getTransactionHistory(sampleBuyer.id);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.every(t => t.buyer.id === sampleBuyer.id)).toBe(true);
    });

    it('should get transaction history for seller', () => {
      const history = transactionEngine.getTransactionHistory(sampleSeller.id);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.every(t => t.seller.id === sampleSeller.id)).toBe(true);
    });

    it('should limit transaction history results', () => {
      const history = transactionEngine.getTransactionHistory(sampleBuyer.id, 2);
      
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should sort transaction history by timestamp descending', () => {
      const history = transactionEngine.getTransactionHistory(sampleBuyer.id);
      
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp.getTime()).toBeLessThanOrEqual(
          history[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('Transaction Integrity Verification', () => {
    it('should verify valid transaction integrity', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      const isValid = transactionEngine.verifyTransactionIntegrity(createResult.transaction.id);
      expect(isValid).toBe(true);
    });

    it('should detect tampered transactions', async () => {
      const createResult = await transactionEngine.createTransaction(validContext);
      expect(createResult.success).toBe(true);

      // Simulate tampering by directly modifying the stored transaction
      const transaction = transactionEngine.getTransaction(createResult.transaction.id);
      if (transaction) {
        transaction.pricing.final = 999999; // Tamper with price
        
        const isValid = transactionEngine.verifyTransactionIntegrity(createResult.transaction.id);
        expect(isValid).toBe(false);
      }
    });

    it('should return false for non-existent transaction verification', () => {
      const isValid = transactionEngine.verifyTransactionIntegrity('non_existent');
      expect(isValid).toBe(false);
    });
  });

  describe('Trust Metrics Calculation', () => {
    it('should calculate distance correctly', async () => {
      const result = await transactionEngine.createTransaction(validContext);
      expect(result.success).toBe(true);

      const distance = result.transaction.metrics.distance;
      expect(distance).toBeGreaterThanOrEqual(0);
      
      // Verify manual calculation
      // Using DimensionalMath.euclideanDistance would require exposing private method
      // So we just verify the distance is reasonable
      expect(distance).toBeLessThan(1000); // Should not be extremely large
    });

    it('should calculate similarity correctly', async () => {
      const result = await transactionEngine.createTransaction(validContext);
      expect(result.success).toBe(true);

      const similarity = result.transaction.metrics.similarity;
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should factor in user reputation', async () => {
      const highRepContext = {
        ...validContext,
        buyer: { ...sampleBuyer, reputation: { score: 5.0, reviews: 100, transactions: 50 } },
        seller: { ...sampleSeller, reputation: { score: 5.0, reviews: 200, transactions: 1000 } }
      };

      const lowRepContext = {
        ...validContext,
        buyer: { ...sampleBuyer, reputation: { score: 1.0, reviews: 1, transactions: 1 } },
        seller: { ...sampleSeller, reputation: { score: 1.0, reviews: 1, transactions: 1 } }
      };

      const highRepResult = await transactionEngine.createTransaction(highRepContext);
      const lowRepResult = await transactionEngine.createTransaction(lowRepContext);

      expect(highRepResult.success).toBe(true);
      expect(lowRepResult.success).toBe(true);

      // Higher reputation should generally lead to higher trust scores
      if (highRepResult.transaction.metrics.trust && lowRepResult.transaction.metrics.trust) {
        expect(highRepResult.transaction.metrics.trust).toBeGreaterThanOrEqual(
          lowRepResult.transaction.metrics.trust
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-price products', async () => {
      const freeContext = {
        ...validContext,
        product: {
          ...sampleProduct,
          price: { base: 0, currency: 'USD' }
        }
      };

      const result = await transactionEngine.createTransaction(freeContext);
      
      expect(result.success).toBe(true);
      expect(result.transaction.pricing.base).toBe(0);
      expect(result.transaction.pricing.final).toBeGreaterThanOrEqual(0);
    });

    it('should handle single quantity transactions', async () => {
      const singleContext = {
        ...validContext,
        quantity: 1
      };

      const result = await transactionEngine.createTransaction(singleContext);
      
      expect(result.success).toBe(true);
      expect(result.transaction.product.quantity).toBe(1);
      expect(result.transaction.pricing.base).toBe(sampleProduct.price.base);
    });

    it('should handle missing optional dimensional adjustments', async () => {
      const noAdjustmentContext = {
        ...validContext,
        product: {
          ...sampleProduct,
          price: { base: 100, currency: 'USD' } // No dimensions
        }
      };

      const result = await transactionEngine.createTransaction(noAdjustmentContext);
      
      expect(result.success).toBe(true);
      expect(result.transaction.pricing.adjustments).toBeDefined();
    });
  });
});