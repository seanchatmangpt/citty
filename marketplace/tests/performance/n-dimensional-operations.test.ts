// Performance Tests for N-Dimensional Operations
import { describe, it, expect, beforeEach } from 'vitest';
import { DimensionalSearchEngine } from '../../src/dimensional-search';
import { TransactionEngine } from '../../src/transaction-engine';
import { DimensionalMath } from '../../types/dimensional-models';
import type { ProductDimension, UserDimension, SearchQuery } from '../../types/dimensional-models';

describe('N-Dimensional Operations Performance', () => {
  let searchEngine: DimensionalSearchEngine;
  let transactionEngine: TransactionEngine;
  let largeDataset: ProductDimension[];
  let testUsers: UserDimension[];

  const PERFORMANCE_THRESHOLDS = {
    SEARCH_TIME_MS: 100,
    KD_TREE_BUILD_TIME_MS: 500,
    DISTANCE_CALCULATION_TIME_MS: 1,
    BATCH_PROCESSING_TIME_MS: 1000,
    MEMORY_USAGE_MB: 100,
    CONCURRENT_OPERATIONS: 1000
  };

  beforeEach(async () => {
    // Generate large dataset for performance testing
    largeDataset = generateLargeProductDataset(1000);
    testUsers = generateUserDataset(100);
    transactionEngine = new TransactionEngine();
  });

  function generateLargeProductDataset(size: number): ProductDimension[] {
    const products: ProductDimension[] = [];
    const dimensions = ['price', 'quality', 'popularity', 'availability', 'rating', 'performance', 'durability', 'style', 'brand_value', 'eco_friendly'];
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports', 'beauty', 'automotive', 'health', 'toys', 'food'];

    for (let i = 0; i < size; i++) {
      const coordinates: Record<string, number> = {};
      
      // Generate random coordinates in n-dimensional space
      for (const dim of dimensions) {
        coordinates[dim] = Math.random() * 100 + (dim === 'quality' ? 0 : Math.random() * 900);
      }

      products.push({
        id: `perf_prod_${i}`,
        coordinates,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 365), // Random date within last year
        version: 1,
        name: `Performance Product ${i}`,
        description: `Product ${i} for performance testing with ${dimensions.length} dimensions`,
        price: { base: coordinates.price, currency: 'USD' },
        categories: [categories[i % categories.length], categories[(i + 1) % categories.length]],
        attributes: { 
          brand: `Brand${i % 50}`, 
          color: `Color${i % 20}`,
          size: `Size${i % 10}`
        },
        availability: { total: Math.floor(Math.random() * 1000) + 10 },
        quality: { score: coordinates.quality / 100, metrics: {} },
        seller: {
          id: `perf_seller_${i % 100}`, // 100 different sellers
          reputation: Math.random() * 5,
          coordinates: {
            reliability: Math.random(),
            speed: Math.random(),
            customer_service: Math.random()
          }
        }
      });
    }

    return products;
  }

  function generateUserDataset(size: number): UserDimension[] {
    const users: UserDimension[] = [];
    const dimensions = ['price_sensitivity', 'quality_preference', 'brand_loyalty', 'tech_savvy', 'eco_conscious', 'impulse_buyer', 'research_depth'];

    for (let i = 0; i < size; i++) {
      const coordinates: Record<string, number> = {};
      const preferences: Record<string, number> = {};
      
      for (const dim of dimensions) {
        const value = Math.random();
        coordinates[dim] = value;
        preferences[dim] = value;
      }

      users.push({
        id: `perf_user_${i}`,
        coordinates,
        timestamp: new Date(),
        version: 1,
        profile: {
          name: `Performance User ${i}`,
          email: `perf${i}@test.com`,
          preferences
        },
        behavior: {
          browsingPattern: Object.fromEntries(
            ['electronics', 'books', 'clothing', 'home'].map(cat => [cat, Math.random()])
          ),
          purchaseHistory: [],
          engagement: {
            sessions: Math.floor(Math.random() * 100),
            clicks: Math.floor(Math.random() * 1000),
            time_spent: Math.floor(Math.random() * 10000)
          }
        },
        reputation: {
          score: Math.random() * 5,
          reviews: Math.floor(Math.random() * 50),
          transactions: Math.floor(Math.random() * 100)
        }
      });
    }

    return users;
  }

  describe('Search Engine Performance', () => {
    it('should build KD-Tree efficiently for large datasets', () => {
      const startTime = performance.now();
      
      searchEngine = new DimensionalSearchEngine(largeDataset);
      
      const buildTime = performance.now() - startTime;
      
      expect(buildTime).toBeLessThan(PERFORMANCE_THRESHOLDS.KD_TREE_BUILD_TIME_MS);
      console.log(`KD-Tree build time for ${largeDataset.length} products: ${buildTime.toFixed(2)}ms`);
    });

    it('should perform searches within time limits', async () => {
      searchEngine = new DimensionalSearchEngine(largeDataset);
      
      const searchQueries: SearchQuery[] = [
        {
          dimensions: {
            price: { min: 100, max: 500, weight: 0.8 },
            quality: { min: 70, weight: 0.9 }
          },
          limit: 20,
          offset: 0
        },
        {
          dimensions: {
            popularity: { preferred: 80, weight: 0.7 },
            performance: { min: 60, weight: 0.8 },
            durability: { min: 70, weight: 0.6 }
          },
          limit: 50,
          offset: 0
        },
        {
          dimensions: {
            eco_friendly: { min: 80, weight: 1.0 },
            brand_value: { preferred: 90, weight: 0.5 },
            style: { min: 60, weight: 0.3 }
          },
          filters: { categories: ['electronics', 'home'] },
          limit: 10,
          offset: 0
        }
      ];

      const searchTimes: number[] = [];
      
      for (const query of searchQueries) {
        const startTime = performance.now();
        const result = await searchEngine.search(query);
        const searchTime = performance.now() - startTime;
        
        searchTimes.push(searchTime);
        expect(result.items).toBeDefined();
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      }

      const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);
      expect(avgSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
    });

    it('should handle concurrent searches efficiently', async () => {
      searchEngine = new DimensionalSearchEngine(largeDataset);
      
      const concurrentSearches = Array.from({ length: 100 }, (_, i) => {
        const query: SearchQuery = {
          dimensions: {
            price: { min: i * 5, max: (i + 20) * 5, weight: Math.random() },
            quality: { min: Math.random() * 50 + 30, weight: Math.random() }
          },
          limit: 10,
          offset: 0
        };
        return searchEngine.search(query);
      });

      const startTime = performance.now();
      const results = await Promise.all(concurrentSearches);
      const totalTime = performance.now() - startTime;

      expect(results.every(r => r.items !== undefined)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 100 concurrent searches
      
      console.log(`100 concurrent searches completed in ${totalTime.toFixed(2)}ms`);
    });

    it('should maintain performance with increasing dimensions', async () => {
      const dimensionCounts = [5, 10, 15, 20];
      const performanceMeasurements: Array<{ dimensions: number; buildTime: number; searchTime: number }> = [];

      for (const dimCount of dimensionCounts) {
        // Create dataset with specific number of dimensions
        const dimensionalProducts = largeDataset.map(product => ({
          ...product,
          coordinates: Object.fromEntries(
            Object.entries(product.coordinates).slice(0, dimCount)
          )
        }));

        const buildStart = performance.now();
        const engine = new DimensionalSearchEngine(dimensionalProducts);
        const buildTime = performance.now() - buildStart;

        const query: SearchQuery = {
          dimensions: Object.fromEntries(
            Object.keys(dimensionalProducts[0].coordinates).map(dim => [
              dim, { min: Math.random() * 50, max: Math.random() * 50 + 50, weight: Math.random() }
            ])
          ),
          limit: 20,
          offset: 0
        };

        const searchStart = performance.now();
        await engine.search(query);
        const searchTime = performance.now() - searchStart;

        performanceMeasurements.push({ dimensions: dimCount, buildTime, searchTime });
        
        console.log(`${dimCount} dimensions: Build ${buildTime.toFixed(2)}ms, Search ${searchTime.toFixed(2)}ms`);
      }

      // Performance should not degrade exponentially with dimension count
      for (let i = 1; i < performanceMeasurements.length; i++) {
        const prev = performanceMeasurements[i - 1];
        const curr = performanceMeasurements[i];
        
        // Build time should not increase more than 3x
        expect(curr.buildTime / prev.buildTime).toBeLessThan(3);
        
        // Search time should not increase more than 2x
        expect(curr.searchTime / prev.searchTime).toBeLessThan(2);
      }
    });
  });

  describe('Distance Calculation Performance', () => {
    it('should calculate distances efficiently', () => {
      const point1 = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`dim_${i}`, Math.random() * 100])
      );
      const point2 = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`dim_${i}`, Math.random() * 100])
      );
      const weights = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`dim_${i}`, Math.random()])
      );

      const iterations = 10000;

      // Test Euclidean distance
      const euclideanStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        DimensionalMath.euclideanDistance(point1, point2);
      }
      const euclideanTime = performance.now() - euclideanStart;

      // Test Manhattan distance
      const manhattanStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        DimensionalMath.manhattanDistance(point1, point2);
      }
      const manhattanTime = performance.now() - manhattanStart;

      // Test Cosine similarity
      const cosineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        DimensionalMath.cosineSimilarity(point1, point2);
      }
      const cosineTime = performance.now() - cosineStart;

      // Test Weighted distance
      const weightedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        DimensionalMath.weightedDistance(point1, point2, weights);
      }
      const weightedTime = performance.now() - weightedStart;

      const avgEuclidean = euclideanTime / iterations;
      const avgManhattan = manhattanTime / iterations;
      const avgCosine = cosineTime / iterations;
      const avgWeighted = weightedTime / iterations;

      console.log(`Distance calculation performance (${iterations} iterations):`);
      console.log(`  Euclidean: ${avgEuclidean.toFixed(4)}ms avg`);
      console.log(`  Manhattan: ${avgManhattan.toFixed(4)}ms avg`);
      console.log(`  Cosine: ${avgCosine.toFixed(4)}ms avg`);
      console.log(`  Weighted: ${avgWeighted.toFixed(4)}ms avg`);

      expect(avgEuclidean).toBeLessThan(PERFORMANCE_THRESHOLDS.DISTANCE_CALCULATION_TIME_MS);
      expect(avgManhattan).toBeLessThan(PERFORMANCE_THRESHOLDS.DISTANCE_CALCULATION_TIME_MS);
      expect(avgCosine).toBeLessThan(PERFORMANCE_THRESHOLDS.DISTANCE_CALCULATION_TIME_MS);
      expect(avgWeighted).toBeLessThan(PERFORMANCE_THRESHOLDS.DISTANCE_CALCULATION_TIME_MS);
    });

    it('should handle sparse dimensional spaces efficiently', () => {
      const sparsePoint1 = { dim_1: 10, dim_100: 50, dim_500: 75 };
      const sparsePoint2 = { dim_2: 20, dim_100: 60, dim_300: 80 };
      
      const iterations = 50000;
      
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        DimensionalMath.euclideanDistance(sparsePoint1, sparsePoint2);
      }
      const time = performance.now() - start;
      
      const avgTime = time / iterations;
      console.log(`Sparse distance calculation: ${avgTime.toFixed(6)}ms avg`);
      
      expect(avgTime).toBeLessThan(0.1); // Even faster for sparse dimensions
    });
  });

  describe('Transaction Engine Performance', () => {
    it('should create transactions efficiently', async () => {
      const buyer = testUsers[0];
      const seller = testUsers[1];
      const products = largeDataset.slice(0, 100);

      const transactionPromises = products.map(product => 
        transactionEngine.createTransaction({
          buyer,
          seller,
          product,
          quantity: Math.floor(Math.random() * 5) + 1
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(transactionPromises);
      const totalTime = performance.now() - startTime;

      expect(results.every(r => r.success || r.errors)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 100 transactions
      
      const avgTime = totalTime / products.length;
      console.log(`Average transaction creation time: ${avgTime.toFixed(2)}ms`);
    });

    it('should handle concurrent transaction processing', async () => {
      const buyer = testUsers[0];
      const seller = testUsers[1];
      const product = largeDataset[0];

      // Create multiple transactions
      const createPromises = Array.from({ length: 50 }, () =>
        transactionEngine.createTransaction({
          buyer,
          seller,
          product,
          quantity: 1
        })
      );

      const createResults = await Promise.all(createPromises);
      const successfulTransactions = createResults.filter(r => r.success);

      // Process all transactions concurrently
      const processPromises = successfulTransactions.map(result =>
        transactionEngine.processTransaction(result.transaction.id)
      );

      const startTime = performance.now();
      const processResults = await Promise.all(processPromises);
      const totalTime = performance.now() - startTime;

      console.log(`Processed ${processResults.length} transactions in ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(10000); // 10 seconds for concurrent processing
    });

    it('should validate transaction integrity efficiently', async () => {
      const buyer = testUsers[0];
      const seller = testUsers[1];
      const products = largeDataset.slice(0, 200);

      // Create transactions for validation testing
      const transactions = [];
      for (const product of products) {
        const result = await transactionEngine.createTransaction({
          buyer,
          seller,
          product,
          quantity: 1
        });
        if (result.success) {
          transactions.push(result.transaction.id);
        }
      }

      // Verify all transactions
      const startTime = performance.now();
      const verificationResults = transactions.map(id =>
        transactionEngine.verifyTransactionIntegrity(id)
      );
      const totalTime = performance.now() - startTime;

      expect(verificationResults.every(valid => typeof valid === 'boolean')).toBe(true);
      
      const avgTime = totalTime / transactions.length;
      console.log(`Average integrity verification time: ${avgTime.toFixed(4)}ms`);
      expect(avgTime).toBeLessThan(1); // Should be very fast
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage for large datasets', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and store large amount of dimensional data
      const extraLargeDataset = generateLargeProductDataset(10000);
      const searchEngine = new DimensionalSearchEngine(extraLargeDataset);
      
      const afterCreationMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (afterCreationMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)}MB for 10,000 products`);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Perform operations and check memory doesn't grow excessively
      const searchPromises = Array.from({ length: 100 }, () => {
        const query: SearchQuery = {
          dimensions: {
            price: { min: Math.random() * 100, max: Math.random() * 500 + 500, weight: Math.random() },
            quality: { min: Math.random() * 50, weight: Math.random() }
          },
          limit: 20,
          offset: 0
        };
        return searchEngine.search(query);
      });

      return Promise.all(searchPromises).then(() => {
        const finalMemory = process.memoryUsage().heapUsed;
        const totalIncrease = (finalMemory - initialMemory) / 1024 / 1024;
        
        console.log(`Total memory usage after operations: ${totalIncrease.toFixed(2)}MB`);
        expect(totalIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB * 1.5);
      });
    });

    it('should handle memory-efficient batch operations', async () => {
      const batchSize = 1000;
      const numBatches = 10;
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let batch = 0; batch < numBatches; batch++) {
        const batchDataset = generateLargeProductDataset(batchSize);
        const batchEngine = new DimensionalSearchEngine(batchDataset);
        
        // Perform searches on batch
        const batchQueries = Array.from({ length: 10 }, () => ({
          dimensions: {
            price: { min: Math.random() * 100, max: Math.random() * 500 + 500, weight: 0.8 },
            quality: { min: Math.random() * 50 + 30, weight: 0.9 }
          },
          limit: 10,
          offset: 0
        }));

        await Promise.all(batchQueries.map(query => batchEngine.search(query)));
        
        // Clear batch references
        batchDataset.length = 0;
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      console.log(`Memory increase after batch processing: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(50); // Should not accumulate excessive memory
    });
  });

  describe('Scalability Testing', () => {
    it('should demonstrate linear scalability with dataset size', async () => {
      const sizes = [100, 500, 1000, 2000];
      const scalabilityResults: Array<{
        size: number;
        buildTime: number;
        searchTime: number;
        memoryMB: number;
      }> = [];

      for (const size of sizes) {
        const dataset = generateLargeProductDataset(size);
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Measure build time
        const buildStart = performance.now();
        const engine = new DimensionalSearchEngine(dataset);
        const buildTime = performance.now() - buildStart;
        
        const afterBuildMemory = process.memoryUsage().heapUsed;
        const memoryMB = (afterBuildMemory - initialMemory) / 1024 / 1024;
        
        // Measure search time
        const searchQuery: SearchQuery = {
          dimensions: {
            price: { min: 100, max: 500, weight: 0.8 },
            quality: { min: 60, weight: 0.9 }
          },
          limit: 20,
          offset: 0
        };
        
        const searchStart = performance.now();
        await engine.search(searchQuery);
        const searchTime = performance.now() - searchStart;
        
        scalabilityResults.push({ size, buildTime, searchTime, memoryMB });
        
        console.log(`Size ${size}: Build ${buildTime.toFixed(2)}ms, Search ${searchTime.toFixed(2)}ms, Memory ${memoryMB.toFixed(2)}MB`);
      }

      // Analyze scalability - should be roughly linear or sub-linear
      for (let i = 1; i < scalabilityResults.length; i++) {
        const prev = scalabilityResults[i - 1];
        const curr = scalabilityResults[i];
        const sizeRatio = curr.size / prev.size;
        
        // Build time should scale sub-linearly (better than O(n))
        const buildRatio = curr.buildTime / prev.buildTime;
        expect(buildRatio).toBeLessThan(sizeRatio * 2); // Allow some overhead
        
        // Search time should remain relatively constant (O(log n) ideally)
        const searchRatio = curr.searchTime / prev.searchTime;
        expect(searchRatio).toBeLessThan(sizeRatio); // Should be sub-linear
        
        // Memory should scale linearly
        const memoryRatio = curr.memoryMB / prev.memoryMB;
        expect(memoryRatio).toBeLessThan(sizeRatio * 1.5); // Allow some overhead
      }
    });

    it('should handle high-dimensional spaces efficiently', async () => {
      const baseDimensions = 5;
      const maxDimensions = 100;
      const dimensionSteps = [5, 20, 50, 100];
      
      for (const numDimensions of dimensionSteps) {
        const dimensionNames = Array.from({ length: numDimensions }, (_, i) => `dim_${i}`);
        
        // Create products with specific number of dimensions
        const products = Array.from({ length: 500 }, (_, i) => ({
          id: `hd_prod_${i}`,
          coordinates: Object.fromEntries(
            dimensionNames.map(name => [name, Math.random() * 100])
          ),
          timestamp: new Date(),
          version: 1,
          name: `HD Product ${i}`,
          description: `High-dimensional product with ${numDimensions} dimensions`,
          price: { base: Math.random() * 1000, currency: 'USD' },
          categories: ['high-dimensional'],
          attributes: {},
          availability: { total: 100 },
          quality: { score: Math.random() },
          seller: {
            id: `hd_seller_${i % 10}`,
            reputation: Math.random() * 5,
            coordinates: Object.fromEntries(
              dimensionNames.slice(0, 3).map(name => [name, Math.random()])
            )
          }
        }));

        const buildStart = performance.now();
        const engine = new DimensionalSearchEngine(products as ProductDimension[]);
        const buildTime = performance.now() - buildStart;

        // Create query using all dimensions
        const query: SearchQuery = {
          dimensions: Object.fromEntries(
            dimensionNames.map(name => [name, { 
              min: Math.random() * 40, 
              max: Math.random() * 40 + 60, 
              weight: Math.random() 
            }])
          ),
          limit: 20,
          offset: 0
        };

        const searchStart = performance.now();
        const result = await engine.search(query);
        const searchTime = performance.now() - searchStart;

        console.log(`${numDimensions}D: Build ${buildTime.toFixed(2)}ms, Search ${searchTime.toFixed(2)}ms`);
        
        expect(result.items).toBeDefined();
        expect(buildTime).toBeLessThan(2000); // Should handle even 100D efficiently
        expect(searchTime).toBeLessThan(200);  // Search should remain fast
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme concurrent load', async () => {
      searchEngine = new DimensionalSearchEngine(largeDataset);
      
      const extremeLoad = 1000;
      const concurrentOperations = Array.from({ length: extremeLoad }, (_, i) => {
        const operation = i % 4;
        
        switch (operation) {
          case 0: // Search
            return searchEngine.search({
              dimensions: {
                price: { min: Math.random() * 500, max: Math.random() * 500 + 500, weight: Math.random() },
                quality: { min: Math.random() * 50 + 25, weight: Math.random() }
              },
              limit: 10,
              offset: 0
            });
            
          case 1: // Suggestions
            return Promise.resolve(searchEngine.getSuggestions(`search${i % 100}`));
            
          case 2: // Distance calculation
            return Promise.resolve(DimensionalMath.euclideanDistance(
              largeDataset[i % largeDataset.length].coordinates,
              largeDataset[(i + 1) % largeDataset.length].coordinates
            ));
            
          case 3: // Transaction creation
            return transactionEngine.createTransaction({
              buyer: testUsers[i % testUsers.length],
              seller: testUsers[(i + 1) % testUsers.length],
              product: largeDataset[i % largeDataset.length],
              quantity: Math.floor(Math.random() * 3) + 1
            });
            
          default:
            return Promise.resolve(null);
        }
      });

      const startTime = performance.now();
      const results = await Promise.all(concurrentOperations);
      const totalTime = performance.now() - startTime;

      const successCount = results.filter(r => 
        r && (r.items || r.success || typeof r === 'string' || typeof r === 'number')
      ).length;

      console.log(`Extreme load test: ${successCount}/${extremeLoad} operations successful in ${totalTime.toFixed(2)}ms`);
      
      expect(successCount / extremeLoad).toBeGreaterThan(0.8); // 80% success rate minimum
      expect(totalTime).toBeLessThan(30000); // 30 seconds maximum
    });

    it('should maintain performance under memory pressure', async () => {
      const memoryIntensiveOperations = [];
      
      // Create memory pressure
      for (let i = 0; i < 100; i++) {
        const dataset = generateLargeProductDataset(100);
        const engine = new DimensionalSearchEngine(dataset);
        
        memoryIntensiveOperations.push(
          engine.search({
            dimensions: {
              price: { min: i * 10, max: i * 10 + 200, weight: 0.8 },
              quality: { min: 50, weight: 0.9 }
            },
            limit: 20,
            offset: 0
          })
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(memoryIntensiveOperations);
      const totalTime = performance.now() - startTime;

      expect(results.every(r => r.items !== undefined)).toBe(true);
      console.log(`Memory pressure test completed in ${totalTime.toFixed(2)}ms`);
      
      // Should complete within reasonable time despite memory pressure
      expect(totalTime).toBeLessThan(15000); // 15 seconds
    });
  });
});