// Unit Tests for Dimensional Search Engine
import { describe, it, expect, beforeEach } from 'vitest';
import { DimensionalSearchEngine, KDTree, KDTreeNode } from '../../src/dimensional-search';
import type { ProductDimension, SearchQuery, UserDimension } from '../../types/dimensional-models';

describe('Dimensional Search Engine', () => {
  let searchEngine: DimensionalSearchEngine;
  let sampleProducts: ProductDimension[];
  let sampleUser: UserDimension;

  beforeEach(() => {
    sampleProducts = [
      {
        id: 'prod_1',
        coordinates: { price: 50, quality: 0.8, popularity: 0.6 },
        timestamp: new Date(),
        version: 1,
        name: 'Budget Phone',
        description: 'Affordable smartphone',
        price: { base: 50, currency: 'USD' },
        categories: ['electronics', 'phone'],
        attributes: { brand: 'TestBrand' },
        availability: { total: 100 },
        quality: { score: 0.8 },
        seller: {
          id: 'seller_1',
          reputation: 4.2,
          coordinates: { reliability: 0.8, speed: 0.7 }
        }
      },
      {
        id: 'prod_2',
        coordinates: { price: 150, quality: 0.9, popularity: 0.8 },
        timestamp: new Date(),
        version: 1,
        name: 'Premium Phone',
        description: 'High-end smartphone',
        price: { base: 150, currency: 'USD' },
        categories: ['electronics', 'phone'],
        attributes: { brand: 'PremiumBrand' },
        availability: { total: 50 },
        quality: { score: 0.9 },
        seller: {
          id: 'seller_2',
          reputation: 4.8,
          coordinates: { reliability: 0.9, speed: 0.9 }
        }
      },
      {
        id: 'prod_3',
        coordinates: { price: 25, quality: 0.6, popularity: 0.3 },
        timestamp: new Date(),
        version: 1,
        name: 'Basic Phone',
        description: 'Simple phone',
        price: { base: 25, currency: 'USD' },
        categories: ['electronics', 'phone'],
        attributes: { brand: 'BasicBrand' },
        availability: { total: 200 },
        quality: { score: 0.6 },
        seller: {
          id: 'seller_3',
          reputation: 3.5,
          coordinates: { reliability: 0.6, speed: 0.5 }
        }
      },
      {
        id: 'prod_4',
        coordinates: { price: 30, quality: 0.7, popularity: 0.4, category_books: 1 },
        timestamp: new Date(),
        version: 1,
        name: 'Programming Book',
        description: 'Learn to code',
        price: { base: 30, currency: 'USD' },
        categories: ['books', 'technology'],
        attributes: { pages: 400 },
        availability: { total: 75 },
        quality: { score: 0.7 },
        seller: {
          id: 'seller_4',
          reputation: 4.0,
          coordinates: { reliability: 0.8, speed: 0.6 }
        }
      }
    ];

    sampleUser = {
      id: 'user_1',
      coordinates: { price_sensitivity: 0.7, quality_preference: 0.8 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: { price: 0.3, quality: 0.9, popularity: 0.6 }
      },
      behavior: {
        browsingPattern: { electronics: 0.8, books: 0.2 },
        purchaseHistory: [],
        engagement: {}
      },
      reputation: { score: 4.0, reviews: 5, transactions: 10 }
    };

    searchEngine = new DimensionalSearchEngine(sampleProducts);
  });

  describe('KDTree', () => {
    it('should build a KD-Tree from products', () => {
      const dimensions = ['price', 'quality', 'popularity'];
      const kdTree = new KDTree(sampleProducts, dimensions);
      expect(kdTree).toBeDefined();
    });

    it('should find nearest neighbors', () => {
      const dimensions = ['price', 'quality', 'popularity'];
      const kdTree = new KDTree(sampleProducts, dimensions);
      
      const queryPoint = { price: 60, quality: 0.8, popularity: 0.7 };
      const neighbors = kdTree.nearestNeighbors(queryPoint, 2);
      
      expect(neighbors).toHaveLength(2);
      expect(neighbors[0]).toBeDefined();
    });

    it('should handle empty product list', () => {
      const dimensions = ['price', 'quality'];
      const kdTree = new KDTree([], dimensions);
      
      const neighbors = kdTree.nearestNeighbors({ price: 50, quality: 0.8 }, 5);
      expect(neighbors).toHaveLength(0);
    });

    it('should return all products when k exceeds product count', () => {
      const dimensions = ['price', 'quality'];
      const kdTree = new KDTree(sampleProducts.slice(0, 2), dimensions);
      
      const neighbors = kdTree.nearestNeighbors({ price: 50, quality: 0.8 }, 10);
      expect(neighbors).toHaveLength(2);
    });
  });

  describe('Search Functionality', () => {
    it('should search products by dimension ranges', async () => {
      const query: SearchQuery = {
        dimensions: {
          price: { min: 40, max: 100, weight: 0.8 },
          quality: { min: 0.7, weight: 0.9 }
        },
        limit: 10,
        offset: 0
      };

      const result = await searchEngine.search(query);
      
      expect(result.items).toBeDefined();
      expect(result.metadata.total).toBeGreaterThan(0);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.algorithm).toBe('kd-tree-multidimensional');
    });

    it('should apply preference-based scoring', async () => {
      const query: SearchQuery = {
        dimensions: {
          price: { preferred: 50, weight: 1.0 },
          quality: { preferred: 0.8, weight: 1.0 }
        },
        limit: 5,
        offset: 0
      };

      const result = await searchEngine.search(query, sampleUser);
      
      expect(result.items).toBeDefined();
      expect(result.items.every(item => item.score >= 0 && item.score <= 1)).toBe(true);
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i].score).toBeLessThanOrEqual(result.items[i - 1].score);
      }
    });

    it('should apply filters correctly', async () => {
      const query: SearchQuery = {
        dimensions: {
          price: { min: 0, max: 200, weight: 1.0 }
        },
        filters: {
          categories: ['electronics'],
          minPrice: 30,
          maxPrice: 160
        },
        limit: 10,
        offset: 0
      };

      const result = await searchEngine.search(query);
      
      // Should exclude products outside price range or without electronics category
      expect(result.items.every(item => 
        item.product.categories.includes('electronics') &&
        item.product.price.base >= 30 &&
        item.product.price.base <= 160
      )).toBe(true);
    });

    it('should support custom sorting', async () => {
      const query: SearchQuery = {
        dimensions: {
          price: { min: 0, max: 200, weight: 1.0 }
        },
        sort: {
          dimension: 'price',
          direction: 'asc'
        },
        limit: 10,
        offset: 0
      };

      const result = await searchEngine.search(query);
      
      // Should be sorted by price ascending
      for (let i = 1; i < result.items.length; i++) {
        const prevPrice = result.items[i - 1].product.coordinates.price || 0;
        const currentPrice = result.items[i].product.coordinates.price || 0;
        expect(currentPrice).toBeGreaterThanOrEqual(prevPrice);
      }
    });

    it('should handle pagination', async () => {
      const query1: SearchQuery = {
        dimensions: {
          price: { min: 0, max: 200, weight: 1.0 }
        },
        limit: 2,
        offset: 0
      };

      const query2: SearchQuery = {
        ...query1,
        offset: 2
      };

      const result1 = await searchEngine.search(query1);
      const result2 = await searchEngine.search(query2);
      
      expect(result1.items).toHaveLength(2);
      expect(result2.items).toHaveLength(Math.min(2, sampleProducts.length - 2));
      
      // Items should be different
      const ids1 = result1.items.map(item => item.product.id);
      const ids2 = result2.items.map(item => item.product.id);
      expect(ids1).not.toEqual(ids2);
    });

    it('should calculate relevance scores per dimension', async () => {
      const query: SearchQuery = {
        dimensions: {
          price: { preferred: 50, weight: 0.8 },
          quality: { preferred: 0.8, weight: 0.9 }
        },
        limit: 5,
        offset: 0
      };

      const result = await searchEngine.search(query);
      
      expect(result.items.length).toBeGreaterThan(0);
      
      for (const item of result.items) {
        expect(item.relevance).toBeDefined();
        expect(item.relevance.price).toBeGreaterThanOrEqual(0);
        expect(item.relevance.price).toBeLessThanOrEqual(1);
        expect(item.relevance.quality).toBeGreaterThanOrEqual(0);
        expect(item.relevance.quality).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Search Suggestions', () => {
    it('should provide search suggestions', () => {
      const suggestions = searchEngine.getSuggestions('phone');
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should return relevant suggestions for partial matches', () => {
      const suggestions = searchEngine.getSuggestions('prem');
      
      expect(suggestions.some(s => s.toLowerCase().includes('premium'))).toBe(true);
    });

    it('should handle empty queries', () => {
      const suggestions = searchEngine.getSuggestions('');
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should include category suggestions', () => {
      const suggestions = searchEngine.getSuggestions('electron');
      
      expect(suggestions.some(s => s.toLowerCase().includes('electronics'))).toBe(true);
    });
  });

  describe('Index Management', () => {
    it('should update search index with new products', () => {
      const newProduct: ProductDimension = {
        id: 'prod_new',
        coordinates: { price: 75, quality: 0.85 },
        timestamp: new Date(),
        version: 1,
        name: 'New Product',
        description: 'A new test product',
        price: { base: 75, currency: 'USD' },
        categories: ['new'],
        attributes: {},
        availability: { total: 25 },
        quality: { score: 0.85 },
        seller: {
          id: 'seller_new',
          reputation: 4.5,
          coordinates: { reliability: 0.85 }
        }
      };

      searchEngine.updateIndex([...sampleProducts, newProduct]);
      
      // Should be able to search for the new product
      const suggestions = searchEngine.getSuggestions('new');
      expect(suggestions.some(s => s.toLowerCase().includes('new'))).toBe(true);
    });

    it('should handle empty product list update', () => {
      expect(() => searchEngine.updateIndex([])).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid search queries gracefully', async () => {
      const invalidQuery: SearchQuery = {
        dimensions: {},
        limit: -1, // Invalid
        offset: -1  // Invalid
      };

      const result = await searchEngine.search(invalidQuery);
      
      // Should still return a valid result structure
      expect(result.items).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle search with no matching results', async () => {
      const impossibleQuery: SearchQuery = {
        dimensions: {
          price: { min: 1000, max: 2000, weight: 1.0 } // No products in this range
        },
        limit: 10,
        offset: 0
      };

      const result = await searchEngine.search(impossibleQuery);
      
      expect(result.items).toHaveLength(0);
      expect(result.metadata.total).toBe(0);
    });

    it('should handle malformed dimensional coordinates', () => {
      const invalidProduct = {
        ...sampleProducts[0],
        coordinates: null // Invalid coordinates
      };

      expect(() => {
        new DimensionalSearchEngine([invalidProduct as any]);
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = performance.now();
      
      const query: SearchQuery = {
        dimensions: {
          price: { min: 0, max: 200, weight: 1.0 }
        },
        limit: 100,
        offset: 0
      };

      const result = await searchEngine.search(query);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should scale with product count', () => {
      // Create larger dataset
      const largeDataset: ProductDimension[] = [];
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          ...sampleProducts[0],
          id: `prod_${i}`,
          coordinates: { 
            price: Math.random() * 200, 
            quality: Math.random(),
            popularity: Math.random()
          },
          name: `Product ${i}`
        });
      }

      expect(() => {
        new DimensionalSearchEngine(largeDataset);
      }).not.toThrow();
    });
  });
});