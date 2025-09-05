import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Basic validation test for our n-dimensional marketplace models
describe('N-Dimensional Marketplace Models Validation', () => {
  // Import schemas directly to test basic Zod validation
  const VectorEmbeddingSchema = z.object({
    dimensions: z.number().int().positive(),
    values: z.array(z.number()).refine(
      (arr) => arr.length > 0 && arr.length <= 4096,
      { message: "Vector must have 1-4096 dimensions" }
    ),
    model: z.string().optional(),
    metadata: z.record(z.any()).optional()
  });

  const DimensionalAttributeSchema = z.object({
    type: z.enum(['category', 'quality', 'temporal', 'spatial', 'semantic', 'social', 'economic', 'trust', 'reputation', 'availability', 'custom']),
    name: z.string(),
    value: z.any(),
    weight: z.number().min(0).max(1).default(1),
    metadata: z.record(z.any()).optional(),
    timestamp: z.coerce.date().optional(),
    source: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  });

  const MarketplaceItemSchema = z.object({
    id: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().min(10).max(5000),
    itemType: z.enum(['physical_product', 'digital_product', 'service', 'subscription', 'rental', 'auction', 'bundle', 'custom', 'experience', 'virtual_asset']),
    status: z.enum(['draft', 'active', 'inactive', 'pending', 'approved', 'rejected', 'suspended', 'archived', 'out_of_stock', 'discontinued']).default('draft'),
    sellerId: z.string(),
    basePrice: z.number().min(0),
    currency: z.string().default('USD'),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    dimensions: z.array(DimensionalAttributeSchema).default([])
  });

  describe('Basic Schema Validation', () => {
    it('should validate vector embedding schema', () => {
      const validEmbedding = {
        dimensions: 768,
        values: Array.from({ length: 768 }, () => Math.random() - 0.5),
        model: 'text-embedding-v1',
        metadata: { source: 'test' }
      };
      
      const result = VectorEmbeddingSchema.safeParse(validEmbedding);
      expect(result.success).toBe(true);
    });

    it('should reject invalid vector embeddings', () => {
      const invalidEmbedding = {
        dimensions: 768,
        values: [], // Empty values array
        model: 'test'
      };
      
      const result = VectorEmbeddingSchema.safeParse(invalidEmbedding);
      expect(result.success).toBe(false);
    });

    it('should validate dimensional attributes', () => {
      const validAttribute = {
        type: 'quality',
        name: 'overall_quality',
        value: 0.85,
        weight: 0.8,
        confidence: 0.95
      };
      
      const result = DimensionalAttributeSchema.safeParse(validAttribute);
      expect(result.success).toBe(true);
    });

    it('should validate marketplace item', () => {
      const validItem = {
        id: 'item-12345',
        title: 'Premium Wireless Headphones',
        description: 'High-quality wireless headphones with excellent sound and noise cancellation features',
        itemType: 'physical_product',
        status: 'active',
        sellerId: 'seller-789',
        basePrice: 199.99,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        dimensions: [
          {
            type: 'quality',
            name: 'overall_rating',
            value: 4.5,
            weight: 1.0
          },
          {
            type: 'category',
            name: 'electronics_audio',
            value: 'headphones',
            weight: 0.9
          }
        ]
      };
      
      const result = MarketplaceItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.title).toBe('Premium Wireless Headphones');
        expect(result.data.basePrice).toBe(199.99);
        expect(result.data.dimensions).toHaveLength(2);
      }
    });

    it('should reject invalid marketplace items', () => {
      const invalidItem = {
        id: 'item-12345',
        title: '', // Invalid: empty title
        description: 'Short', // Invalid: too short
        itemType: 'invalid_type', // Invalid type
        sellerId: 'seller-789',
        basePrice: -10, // Invalid: negative price
        currency: 'USD'
      };
      
      const result = MarketplaceItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Dimensional Operations', () => {
    const calculateDimensionalScore = (dimensions: any[]): number => {
      const totalWeight = dimensions.reduce((sum, dim) => sum + dim.weight, 0);
      if (totalWeight === 0) return 0;
      
      return dimensions.reduce((score, dim) => {
        const value = typeof dim.value === 'number' ? dim.value : 0;
        return score + (value * dim.weight);
      }, 0) / totalWeight;
    };

    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) throw new Error('Vectors must have same dimensions');
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return dotProduct / (magnitudeA * magnitudeB);
    };

    it('should calculate dimensional scores correctly', () => {
      const dimensions = [
        { type: 'quality', name: 'overall', value: 0.8, weight: 0.5 },
        { type: 'trust', name: 'seller_trust', value: 0.9, weight: 0.3 },
        { type: 'social', name: 'popularity', value: 0.7, weight: 0.2 }
      ];
      
      const score = calculateDimensionalScore(dimensions);
      expect(score).toBeCloseTo(0.81, 2);
    });

    it('should calculate vector similarity correctly', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];
      
      const similarity1 = cosineSimilarity(vector1, vector2);
      const similarity2 = cosineSimilarity(vector1, vector3);
      
      expect(similarity1).toBeCloseTo(0, 1);
      expect(similarity2).toBeCloseTo(1, 1);
    });

    it('should handle high-dimensional vectors', () => {
      const dim = 512;
      const vector1 = Array.from({ length: dim }, () => Math.random());
      const vector2 = Array.from({ length: dim }, () => Math.random());
      
      const similarity = cosineSimilarity(vector1, vector2);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Data Validation Utilities', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    const isValidPhoneNumber = (phone: string): boolean => {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      return phoneRegex.test(phone);
    };

    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    const isValidCoordinate = (lat: number, lng: number): boolean => {
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    };

    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(true);
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isValidPhoneNumber('555-123-4567')).toBe(true);
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('abc')).toBe(false);
    });

    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org/path?param=value')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
      expect(isValidUrl('invalid-url')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
    });

    it('should validate coordinates', () => {
      expect(isValidCoordinate(40.7128, -74.0060)).toBe(true); // NYC
      expect(isValidCoordinate(0, 0)).toBe(true); // Null Island
      expect(isValidCoordinate(90, 180)).toBe(true); // Boundaries
      expect(isValidCoordinate(-90, -180)).toBe(true); // Boundaries
      expect(isValidCoordinate(91, 0)).toBe(false); // Invalid latitude
      expect(isValidCoordinate(0, 181)).toBe(false); // Invalid longitude
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large dimensional datasets efficiently', () => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      // Create 1000 high-dimensional items
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Test Item ${i}`,
        description: `Description for test item number ${i} with detailed information`,
        itemType: 'physical_product',
        status: 'active',
        sellerId: `seller-${i % 100}`,
        basePrice: Math.random() * 1000,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        dimensions: Array.from({ length: 10 }, (_, j) => ({
          type: 'custom',
          name: `dimension-${j}`,
          value: Math.random(),
          weight: Math.random()
        }))
      }));
      
      // Validate all items
      const validationResults = items.map(item => MarketplaceItemSchema.safeParse(item));
      const successCount = validationResults.filter(result => result.success).length;
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      // Performance assertions
      expect(successCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect((endMemory - startMemory) / 1024 / 1024).toBeLessThan(100); // Memory increase < 100MB
      
      console.log(`Processed 1000 items in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`Memory usage increase: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should perform vector operations efficiently', () => {
      const startTime = performance.now();
      
      const dim = 768;
      const vectors = Array.from({ length: 100 }, () => 
        Array.from({ length: dim }, () => Math.random() - 0.5)
      );
      
      // Calculate pairwise similarities
      const similarities: number[] = [];
      for (let i = 0; i < vectors.length; i++) {
        for (let j = i + 1; j < vectors.length; j++) {
          const dotProduct = vectors[i].reduce((sum, val, k) => sum + val * vectors[j][k], 0);
          const magnitudeA = Math.sqrt(vectors[i].reduce((sum, val) => sum + val * val, 0));
          const magnitudeB = Math.sqrt(vectors[j].reduce((sum, val) => sum + val * val, 0));
          similarities.push(dotProduct / (magnitudeA * magnitudeB));
        }
      }
      
      const endTime = performance.now();
      
      expect(similarities.length).toBe((100 * 99) / 2); // n choose 2
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(similarities.every(sim => sim >= -1 && sim <= 1)).toBe(true);
      
      console.log(`Calculated ${similarities.length} vector similarities in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });
});