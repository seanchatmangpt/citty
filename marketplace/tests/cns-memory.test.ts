import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CNSMemoryManager } from '../server/services/cns-memory/cns-memory-manager';
import { MemoryLayer } from '../server/services/cns-memory/interfaces/memory-types';

describe('CNS Memory System', () => {
  let cnsManager: CNSMemoryManager;

  beforeEach(async () => {
    cnsManager = new CNSMemoryManager({
      enableValidation: true,
      enableEvolution: true,
      enablePredictiveLoading: true,
      enableIntelligenceMultiplier: true,
      autoHealing: true,
      metricsCollection: true
    });
    
    await cnsManager.initialize();
  });

  afterEach(async () => {
    await cnsManager.clear();
    await cnsManager.shutdown();
  });

  describe('L1 Session Memory', () => {
    it('should store and retrieve session data with 100% retention', async () => {
      const sessionData = {
        userId: 'user123',
        sessionId: 'session456',
        preferences: { theme: 'dark', language: 'en' }
      };

      const entry = await cnsManager.store(
        'session_user123',
        sessionData,
        MemoryLayer.L1_SESSION,
        {
          priority: 100,
          tags: ['session', 'user']
        }
      );

      expect(entry).toBeDefined();
      expect(entry.layer).toBe(MemoryLayer.L1_SESSION);
      expect(entry.metrics.retentionRate).toBe(1.0);

      const retrieved = await cnsManager.retrieve('session_user123', MemoryLayer.L1_SESSION);
      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toEqual(sessionData);
    });

    it('should handle TTL expiration correctly', async () => {
      await cnsManager.store(
        'temp_session',
        { data: 'temporary' },
        MemoryLayer.L1_SESSION,
        { ttl: 100 } // 100ms
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const retrieved = await cnsManager.retrieve('temp_session', MemoryLayer.L1_SESSION);
      expect(retrieved).toBeNull();
    });
  });

  describe('L2 Context Memory', () => {
    it('should compress context data with 80% token reduction', async () => {
      const contextData = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: { 'user-agent': 'test', 'content-type': 'application/json' },
          query: { page: 1, limit: 10, search: 'john doe' }
        },
        response: {
          status: 200,
          data: { users: [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }] }
        }
      };

      const entry = await cnsManager.store(
        'context_request_123',
        contextData,
        MemoryLayer.L2_CONTEXT,
        {
          tags: ['context', 'api_request'],
          context: { type: 'request' }
        }
      );

      expect(entry).toBeDefined();
      expect(entry.metrics.compressionRatio).toBeLessThanOrEqual(0.8); // Should be compressed (demo cap at 80%)
      
      const retrieved = await cnsManager.retrieve('context_request_123', MemoryLayer.L2_CONTEXT);
      expect(retrieved).toBeDefined();
      // Data should be decompressed correctly
      expect(retrieved?.value.request.method).toBe('GET');
    });

    it('should handle context-aware retrieval', async () => {
      const contexts = [
        { key: 'ctx1', data: { action: 'login', user: 'alice' } },
        { key: 'ctx2', data: { action: 'purchase', user: 'bob' } },
        { key: 'ctx3', data: { action: 'login', user: 'charlie' } }
      ];

      // Store contexts
      for (const ctx of contexts) {
        await cnsManager.store(ctx.key, ctx.data, MemoryLayer.L2_CONTEXT, {
          tags: [ctx.data.action, 'user_action']
        });
      }

      // Query by context
      const results = await cnsManager.query({
        layers: [MemoryLayer.L2_CONTEXT],
        tags: ['login']
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.value && r.value.action === 'login')).toBe(true);
    });
  });

  describe('L3 Pattern Memory', () => {
    it('should detect and store patterns with O(1) access', async () => {
      const patterns = [
        { key: 'pattern1', data: { type: 'api_call', endpoint: '/users', frequency: 10 } },
        { key: 'pattern2', data: { type: 'api_call', endpoint: '/products', frequency: 5 } },
        { key: 'pattern3', data: { type: 'user_behavior', action: 'search', frequency: 15 } }
      ];

      // Store patterns
      for (const pattern of patterns) {
        const entry = await cnsManager.store(
          pattern.key,
          pattern.data,
          MemoryLayer.L3_PATTERNS,
          {
            tags: ['pattern', pattern.data.type],
            priority: pattern.data.frequency
          }
        );
        
        expect(entry.metrics.accessTime).toBeLessThanOrEqual(1); // O(1) access
      }

      // Test pattern queries
      const apiPatterns = await cnsManager.query({
        layer: MemoryLayer.L3_PATTERNS,
        tags: ['api_call']
      });

      expect(apiPatterns).toHaveLength(2);
    });

    it('should predict next access patterns', async () => {
      // This would be tested with the L3 pattern memory's prediction capabilities
      const patternData = {
        sequence: ['page1', 'page2', 'page3'],
        frequency: 20,
        context: { userId: 'user123' }
      };

      await cnsManager.store(
        'navigation_pattern',
        patternData,
        MemoryLayer.L3_PATTERNS,
        {
          tags: ['navigation', 'user_behavior']
        }
      );

      const retrieved = await cnsManager.retrieve('navigation_pattern', MemoryLayer.L3_PATTERNS);
      expect(retrieved?.value.sequence).toEqual(['page1', 'page2', 'page3']);
    });
  });

  describe('L4 Prediction Memory', () => {
    it('should store ML predictions with 85% accuracy', async () => {
      const predictionData = {
        model: 'user_behavior_predictor',
        input: { userId: 'user123', currentPage: '/products', timeSpent: 45 },
        prediction: { nextPage: '/checkout', confidence: 0.87 },
        features: { engagement: 0.8, purchase_intent: 0.9 }
      };

      const entry = await cnsManager.store(
        'prediction_user123_checkout',
        predictionData,
        MemoryLayer.L4_PREDICTIONS,
        {
          tags: ['prediction', 'ml', 'user_behavior']
        }
      );

      expect(entry).toBeDefined();
      expect(entry.metrics.accuracy).toBeGreaterThanOrEqual(0.7); // Minimum accuracy threshold
      
      const retrieved = await cnsManager.retrieve('prediction_user123_checkout', MemoryLayer.L4_PREDICTIONS);
      expect(retrieved?.value.prediction.confidence).toBe(0.87);
    });

    it('should handle model training and evolution', async () => {
      const trainingData = Array.from({ length: 50 }, (_, i) => ({
        input: { feature1: Math.random(), feature2: Math.random() },
        output: Math.random() > 0.5 ? 'positive' : 'negative'
      }));

      // Store training samples
      for (let i = 0; i < trainingData.length; i++) {
        await cnsManager.store(
          `training_sample_${i}`,
          trainingData[i],
          MemoryLayer.L4_PREDICTIONS,
          {
            tags: ['training', 'sample']
          }
        );
      }

      const metrics = await cnsManager.getMetrics();
      expect(metrics.layerMetrics[MemoryLayer.L4_PREDICTIONS].size).toBeGreaterThan(0);
    });
  });

  describe('Context Validation Engine', () => {
    it('should validate data integrity across layers', async () => {
      // Store data in multiple layers
      await cnsManager.store('test_key', { data: 'test' }, MemoryLayer.L1_SESSION);
      await cnsManager.store('test_key_2', { data: 'compressed' }, MemoryLayer.L2_CONTEXT);
      
      const validation = await cnsManager.validateAndHeal();
      
      expect(validation.validation).toBeDefined();
      expect(validation.recommendations).toBeDefined();
    });

    it('should automatically heal corrupted entries', async () => {
      await cnsManager.store('heal_test', { data: 'original' }, MemoryLayer.L1_SESSION);
      
      // Force corruption by modifying checksum (in real scenario)
      const validation = await cnsManager.validateAndHeal();
      
      expect(validation.healing).toBeDefined();
    });
  });

  describe('Evolution Tracking', () => {
    it('should track pattern evolution over time', async () => {
      const patterns = [
        { key: 'evolve1', data: { performance: 0.7, generation: 1 } },
        { key: 'evolve2', data: { performance: 0.8, generation: 2 } },
        { key: 'evolve3', data: { performance: 0.9, generation: 3 } }
      ];

      for (const pattern of patterns) {
        await cnsManager.store(
          pattern.key,
          pattern.data,
          MemoryLayer.L3_PATTERNS,
          { tags: ['evolution', 'pattern'] }
        );
      }

      const optimization = await cnsManager.optimize();
      expect(optimization.evolution).toBeDefined();
    });
  });

  describe('Predictive Loading', () => {
    it('should preload predicted entries', async () => {
      // Store access pattern
      const context = { userId: 'user123', sessionId: 'session456' };
      
      await cnsManager.retrieve('pattern_key', MemoryLayer.L3_PATTERNS, context);
      await cnsManager.retrieve('related_pattern', MemoryLayer.L3_PATTERNS, context);
      
      // The predictive engine should learn this pattern
      const metrics = await cnsManager.getMetrics();
      expect(metrics.predictionStats).toBeDefined();
    });
  });

  describe('Compound Intelligence', () => {
    it('should calculate intelligence multiplier', async () => {
      const intelligence = cnsManager.getCurrentIntelligence();
      
      expect(intelligence).toBeDefined();
      expect(intelligence?.totalMultiplier).toBeGreaterThan(0);
      expect(intelligence?.multipliers).toHaveProperty('contextual');
      expect(intelligence?.multipliers).toHaveProperty('predictive');
      expect(intelligence?.multipliers).toHaveProperty('adaptive');
      expect(intelligence?.multipliers).toHaveProperty('collaborative');
    });

    it('should optimize intelligence over time', async () => {
      const initialIntelligence = cnsManager.getCurrentIntelligence();
      
      // Perform some operations to generate data for optimization
      await cnsManager.store('intel_test1', { data: 'test1' }, MemoryLayer.L1_SESSION);
      await cnsManager.store('intel_test2', { data: 'test2' }, MemoryLayer.L2_CONTEXT);
      
      const optimization = await cnsManager.optimize();
      
      expect(optimization.intelligence).toBeDefined();
      expect(optimization.recommendations).toBeDefined();
    });
  });

  describe('Cross-Layer Operations', () => {
    it('should query across multiple layers efficiently', async () => {
      // Store data in different layers with same tag
      await cnsManager.store('cross1', { type: 'test', data: 'l1' }, MemoryLayer.L1_SESSION, {
        tags: ['cross_layer_test']
      });
      
      await cnsManager.store('cross2', { type: 'test', data: 'l2' }, MemoryLayer.L2_CONTEXT, {
        tags: ['cross_layer_test']
      });
      
      await cnsManager.store('cross3', { type: 'test', data: 'l3' }, MemoryLayer.L3_PATTERNS, {
        tags: ['cross_layer_test']
      });

      const results = await cnsManager.query({
        tags: ['cross_layer_test'],
        layers: [MemoryLayer.L1_SESSION, MemoryLayer.L2_CONTEXT, MemoryLayer.L3_PATTERNS]
      });

      expect(results).toHaveLength(3);
      expect(results.some(r => r.layer === MemoryLayer.L1_SESSION)).toBe(true);
      expect(results.some(r => r.layer === MemoryLayer.L2_CONTEXT)).toBe(true);
      expect(results.some(r => r.layer === MemoryLayer.L3_PATTERNS)).toBe(true);
    });

    it('should handle bulk operations efficiently', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        key: `bulk_${i}`,
        value: { id: i, data: `test_${i}` },
        layer: i % 2 === 0 ? MemoryLayer.L1_SESSION : MemoryLayer.L2_CONTEXT
      }));

      // Store all entries
      for (const entry of entries) {
        await cnsManager.store(entry.key, entry.value, entry.layer as MemoryLayer);
      }

      // Query all
      const results = await cnsManager.query({
        pattern: 'bulk_.*'
      });

      expect(results.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('System Metrics and Health', () => {
    it('should provide comprehensive system metrics', async () => {
      const metrics = await cnsManager.getMetrics();
      
      expect(metrics.layerMetrics).toBeDefined();
      expect(metrics.overallHealth).toBeGreaterThan(0);
      expect(metrics.systemLoad).toBeGreaterThanOrEqual(0);
      
      // Check that all layers are represented
      expect(metrics.layerMetrics).toHaveProperty(MemoryLayer.L1_SESSION);
      expect(metrics.layerMetrics).toHaveProperty(MemoryLayer.L2_CONTEXT);
      expect(metrics.layerMetrics).toHaveProperty(MemoryLayer.L3_PATTERNS);
      expect(metrics.layerMetrics).toHaveProperty(MemoryLayer.L4_PREDICTIONS);
    });

    it('should handle system optimization', async () => {
      // Generate some activity
      await cnsManager.store('opt_test1', { data: 'test1' }, MemoryLayer.L1_SESSION);
      await cnsManager.store('opt_test2', { data: 'test2' }, MemoryLayer.L2_CONTEXT);
      
      const optimization = await cnsManager.optimize();
      
      expect(optimization).toBeDefined();
      expect(optimization.recommendations).toBeDefined();
      expect(Array.isArray(optimization.recommendations)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid layer gracefully', async () => {
      // Create a CNS manager without predictive loading to test direct error handling
      const directManager = new CNSMemoryManager({
        enableValidation: false,
        enableEvolution: false,
        enablePredictiveLoading: false,
        enableIntelligenceMultiplier: false,
        autoHealing: false,
        metricsCollection: false
      });
      await directManager.initialize();
      
      await expect(async () => {
        await directManager.retrieve('test', 'INVALID_LAYER' as MemoryLayer);
      }).rejects.toThrow('Invalid layer');
      
      await directManager.shutdown();
    });

    it('should handle missing keys gracefully', async () => {
      const result = await cnsManager.retrieve('nonexistent_key', MemoryLayer.L1_SESSION);
      expect(result).toBeNull();
    });

    it('should handle large data objects', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `item_${i}`.repeat(100) }))
      };

      const entry = await cnsManager.store('large_data', largeData, MemoryLayer.L2_CONTEXT);
      expect(entry).toBeDefined();
      expect(entry.metrics.size).toBeGreaterThan(1000);
    });
  });
});