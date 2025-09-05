// Unit Tests for Dimensional Models
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DimensionalEntitySchema,
  ProductDimensionSchema,
  UserDimensionSchema,
  TransactionDimensionSchema,
  SearchQuerySchema,
  SearchResultSchema,
  MarketplaceStateSchema,
  DimensionalMath
} from '../../types/dimensional-models';
import type { 
  ProductDimension, 
  UserDimension, 
  TransactionDimension 
} from '../../types/dimensional-models';

describe('Dimensional Models', () => {
  describe('DimensionalEntitySchema', () => {
    it('should validate a basic dimensional entity', () => {
      const entity = {
        id: 'test_123',
        coordinates: { x: 1.5, y: 2.7, z: -0.3 },
        metadata: { category: 'test' },
        timestamp: new Date(),
        version: 1
      };

      expect(() => DimensionalEntitySchema.parse(entity)).not.toThrow();
    });

    it('should require id and coordinates', () => {
      const invalidEntity = {
        coordinates: {},
        timestamp: new Date(),
        version: 1
      };

      expect(() => DimensionalEntitySchema.parse(invalidEntity)).toThrow();
    });

    it('should set default timestamp and version', () => {
      const entity = {
        id: 'test_123',
        coordinates: { x: 1, y: 2 }
      };

      const parsed = DimensionalEntitySchema.parse(entity);
      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.version).toBe(1);
    });
  });

  describe('ProductDimensionSchema', () => {
    const validProduct = {
      id: 'prod_123',
      coordinates: { price: 100, quality: 0.9, popularity: 0.7 },
      timestamp: new Date(),
      version: 1,
      name: 'Test Product',
      description: 'A test product',
      price: { base: 100, currency: 'USD' },
      categories: ['electronics', 'gadgets'],
      attributes: { color: 'red', size: 'large' },
      availability: { total: 50, byDimension: { region_us: 30, region_eu: 20 } },
      quality: { score: 0.9, metrics: { durability: 0.8, performance: 0.95 } },
      seller: {
        id: 'seller_456',
        reputation: 4.5,
        coordinates: { reliability: 0.9, speed: 0.8 }
      }
    };

    it('should validate a complete product', () => {
      expect(() => ProductDimensionSchema.parse(validProduct)).not.toThrow();
    });

    it('should require essential product fields', () => {
      const incomplete = { ...validProduct };
      delete (incomplete as any).name;
      
      expect(() => ProductDimensionSchema.parse(incomplete)).toThrow();
    });

    it('should validate quality score range', () => {
      const invalidQuality = {
        ...validProduct,
        quality: { score: 1.5 } // Invalid: > 1
      };

      expect(() => ProductDimensionSchema.parse(invalidQuality)).toThrow();
    });

    it('should validate seller reputation range', () => {
      const invalidSeller = {
        ...validProduct,
        seller: {
          ...validProduct.seller,
          reputation: 6 // Invalid: > 5
        }
      };

      expect(() => ProductDimensionSchema.parse(invalidSeller)).toThrow();
    });
  });

  describe('UserDimensionSchema', () => {
    const validUser = {
      id: 'user_789',
      coordinates: { price_sensitivity: 0.7, quality_preference: 0.9 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: { price: 0.3, quality: 0.9, speed: 0.6 },
        history: ['prod_1', 'prod_2']
      },
      behavior: {
        browsingPattern: { electronics: 0.8, books: 0.3 },
        purchaseHistory: [
          {
            productId: 'prod_1',
            timestamp: new Date(),
            satisfaction: 4.5
          }
        ],
        engagement: { clicks: 150, time_spent: 3600 }
      },
      reputation: {
        score: 4.2,
        reviews: 25,
        transactions: 12
      }
    };

    it('should validate a complete user', () => {
      expect(() => UserDimensionSchema.parse(validUser)).not.toThrow();
    });

    it('should validate email format', () => {
      const invalidEmail = {
        ...validUser,
        profile: {
          ...validUser.profile,
          email: 'invalid-email'
        }
      };

      expect(() => UserDimensionSchema.parse(invalidEmail)).toThrow();
    });

    it('should validate satisfaction scores', () => {
      const invalidSatisfaction = {
        ...validUser,
        behavior: {
          ...validUser.behavior,
          purchaseHistory: [
            {
              productId: 'prod_1',
              timestamp: new Date(),
              satisfaction: 6 // Invalid: > 5
            }
          ]
        }
      };

      expect(() => UserDimensionSchema.parse(invalidSatisfaction)).toThrow();
    });

    it('should set default values for reputation', () => {
      const userWithoutReputation = {
        ...validUser,
        reputation: { score: 3.5 }
      };

      const parsed = UserDimensionSchema.parse(userWithoutReputation);
      expect(parsed.reputation.reviews).toBe(0);
      expect(parsed.reputation.transactions).toBe(0);
    });
  });

  describe('TransactionDimensionSchema', () => {
    const validTransaction = {
      id: 'txn_123',
      coordinates: { value: 100, complexity: 0.5 },
      timestamp: new Date(),
      version: 1,
      buyer: {
        id: 'buyer_1',
        coordinates: { spending_power: 0.8 }
      },
      seller: {
        id: 'seller_1',
        coordinates: { reliability: 0.9 }
      },
      product: {
        id: 'prod_1',
        coordinates: { price: 100, quality: 0.9 },
        quantity: 2
      },
      pricing: {
        base: 200,
        adjustments: { distance_discount: -10, bulk_discount: -5 },
        final: 185,
        currency: 'USD'
      },
      status: 'confirmed' as const,
      metrics: {
        distance: 15.5,
        similarity: 0.8,
        trust: 0.9
      },
      security: {
        hash: 'abc123hash',
        signature: 'signature123',
        verified: true
      }
    };

    it('should validate a complete transaction', () => {
      expect(() => TransactionDimensionSchema.parse(validTransaction)).not.toThrow();
    });

    it('should validate quantity is positive', () => {
      const invalidQuantity = {
        ...validTransaction,
        product: {
          ...validTransaction.product,
          quantity: 0
        }
      };

      expect(() => TransactionDimensionSchema.parse(invalidQuantity)).toThrow();
    });

    it('should validate status enum', () => {
      const invalidStatus = {
        ...validTransaction,
        status: 'invalid_status'
      };

      expect(() => TransactionDimensionSchema.parse(invalidStatus)).toThrow();
    });

    it('should validate trust metrics range', () => {
      const invalidTrust = {
        ...validTransaction,
        metrics: {
          ...validTransaction.metrics,
          trust: 1.5 // Invalid: > 1
        }
      };

      expect(() => TransactionDimensionSchema.parse(invalidTrust)).toThrow();
    });

    it('should set default security verified to false', () => {
      const unverifiedTransaction = {
        ...validTransaction,
        security: {
          hash: 'abc123',
          signature: 'sig123'
        }
      };

      const parsed = TransactionDimensionSchema.parse(unverifiedTransaction);
      expect(parsed.security.verified).toBe(false);
    });
  });

  describe('SearchQuerySchema', () => {
    it('should validate a complete search query', () => {
      const query = {
        query: 'test product',
        dimensions: {
          price: { min: 10, max: 100, weight: 0.8, preferred: 50 },
          quality: { min: 0.5, weight: 0.9 }
        },
        filters: { category: 'electronics', minRating: 4 },
        sort: { dimension: 'price', direction: 'asc' as const },
        limit: 10,
        offset: 0
      };

      expect(() => SearchQuerySchema.parse(query)).not.toThrow();
    });

    it('should set default values', () => {
      const minimal = {
        dimensions: {
          price: { min: 0, max: 100 }
        }
      };

      const parsed = SearchQuerySchema.parse(minimal);
      expect(parsed.limit).toBe(20);
      expect(parsed.offset).toBe(0);
      expect(parsed.dimensions.price.weight).toBe(1);
    });

    it('should validate weight range', () => {
      const invalidWeight = {
        dimensions: {
          price: { weight: 1.5 } // Invalid: > 1
        }
      };

      expect(() => SearchQuerySchema.parse(invalidWeight)).toThrow();
    });
  });

  describe('MarketplaceStateSchema', () => {
    it('should validate marketplace state', () => {
      const state = {
        timestamp: new Date(),
        dimensions: {
          price: { min: 0, max: 1000, resolution: 0.01, active: true },
          quality: { min: 0, max: 1, resolution: 0.01, active: true }
        },
        statistics: {
          products: 1500,
          users: 5000,
          transactions: 12000,
          avgDistance: 25.5,
          density: { high: 0.3, medium: 0.5, low: 0.2 }
        },
        health: {
          score: 0.95,
          issues: [],
          performance: { response_time: 150, throughput: 1000 }
        }
      };

      expect(() => MarketplaceStateSchema.parse(state)).not.toThrow();
    });

    it('should set default timestamp', () => {
      const minimal = {
        dimensions: {},
        statistics: { products: 0, users: 0, transactions: 0 },
        health: { score: 1.0 }
      };

      const parsed = MarketplaceStateSchema.parse(minimal);
      expect(parsed.timestamp).toBeInstanceOf(Date);
    });

    it('should validate health score range', () => {
      const invalidHealth = {
        dimensions: {},
        statistics: { products: 0, users: 0, transactions: 0 },
        health: { score: 1.5 } // Invalid: > 1
      };

      expect(() => MarketplaceStateSchema.parse(invalidHealth)).toThrow();
    });
  });
});

describe('DimensionalMath', () => {
  const point1 = { x: 1, y: 2, z: 3 };
  const point2 = { x: 4, y: 6, z: 8 };
  const point3 = { a: 1, b: 0 }; // Different dimensions

  describe('euclideanDistance', () => {
    it('should calculate correct Euclidean distance', () => {
      const distance = DimensionalMath.euclideanDistance(point1, point2);
      expect(distance).toBeCloseTo(7.071, 3); // sqrt(3² + 4² + 5²)
    });

    it('should handle different dimensional spaces', () => {
      const distance = DimensionalMath.euclideanDistance(point1, point3);
      expect(distance).toBeGreaterThan(0);
    });

    it('should return 0 for identical points', () => {
      const distance = DimensionalMath.euclideanDistance(point1, point1);
      expect(distance).toBe(0);
    });
  });

  describe('manhattanDistance', () => {
    it('should calculate correct Manhattan distance', () => {
      const distance = DimensionalMath.manhattanDistance(point1, point2);
      expect(distance).toBe(12); // |3| + |4| + |5|
    });

    it('should handle different dimensional spaces', () => {
      const distance = DimensionalMath.manhattanDistance(point1, point3);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity', () => {
      const similarity = DimensionalMath.cosineSimilarity(point1, point2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 1 for identical normalized vectors', () => {
      const identical = { x: 1, y: 1 };
      const similarity = DimensionalMath.cosineSimilarity(identical, identical);
      expect(similarity).toBe(1);
    });

    it('should return 0 for zero vectors', () => {
      const zero = { x: 0, y: 0 };
      const nonZero = { x: 1, y: 1 };
      const similarity = DimensionalMath.cosineSimilarity(zero, nonZero);
      expect(similarity).toBe(0);
    });
  });

  describe('weightedDistance', () => {
    it('should calculate weighted Euclidean distance', () => {
      const weights = { x: 2, y: 1, z: 0.5 };
      const distance = DimensionalMath.weightedDistance(point1, point2, weights);
      expect(distance).toBeGreaterThan(0);
    });

    it('should use default weight of 1 for missing weights', () => {
      const weights = { x: 2 }; // y and z will use weight 1
      const distance = DimensionalMath.weightedDistance(point1, point2, weights);
      expect(distance).toBeGreaterThan(0);
    });
  });
});

describe('Schema Integration', () => {
  let sampleProduct: ProductDimension;
  let sampleUser: UserDimension;

  beforeEach(() => {
    sampleProduct = {
      id: 'prod_test',
      coordinates: { price: 100, quality: 0.9 },
      timestamp: new Date(),
      version: 1,
      name: 'Test Product',
      description: 'Test Description',
      price: { base: 100, currency: 'USD' },
      categories: ['test'],
      attributes: {},
      availability: { total: 10 },
      quality: { score: 0.9 },
      seller: {
        id: 'seller_test',
        reputation: 4.0,
        coordinates: { reliability: 0.8 }
      }
    };

    sampleUser = {
      id: 'user_test',
      coordinates: { price_sensitivity: 0.7 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: {}
      },
      behavior: {
        browsingPattern: {},
        purchaseHistory: [],
        engagement: {}
      },
      reputation: { score: 3.0, reviews: 0, transactions: 0 }
    };
  });

  it('should validate product with user preferences', () => {
    // Test that product and user schemas work together
    expect(sampleProduct.coordinates).toBeDefined();
    expect(sampleUser.profile.preferences).toBeDefined();
    
    // Test dimensional compatibility
    const distance = DimensionalMath.euclideanDistance(
      sampleProduct.coordinates,
      sampleUser.coordinates
    );
    expect(distance).toBeGreaterThanOrEqual(0);
  });

  it('should create transaction with dimensional context', () => {
    const transactionData = {
      id: 'txn_test',
      coordinates: { value: 100 },
      timestamp: new Date(),
      version: 1,
      buyer: { id: sampleUser.id, coordinates: sampleUser.coordinates },
      seller: { id: sampleProduct.seller.id, coordinates: sampleProduct.seller.coordinates },
      product: { 
        id: sampleProduct.id, 
        coordinates: sampleProduct.coordinates, 
        quantity: 1 
      },
      pricing: { base: 100, final: 100, currency: 'USD' },
      status: 'pending' as const,
      metrics: { trust: 0.8 },
      security: { hash: 'test', signature: 'test', verified: false }
    };

    expect(() => TransactionDimensionSchema.parse(transactionData)).not.toThrow();
  });
});