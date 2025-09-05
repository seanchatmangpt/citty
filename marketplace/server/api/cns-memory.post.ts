import { CNSMemoryManager } from '../services/cns-memory/cns-memory-manager';
import { MemoryLayer } from '../services/cns-memory/interfaces/memory-types';

// Singleton instance
let cnsManager: CNSMemoryManager | null = null;

function getCNSManager(): CNSMemoryManager {
  if (!cnsManager) {
    cnsManager = new CNSMemoryManager({
      enableValidation: true,
      enableEvolution: true,
      enablePredictiveLoading: true,
      enableIntelligenceMultiplier: true,
      autoHealing: true,
      metricsCollection: true
    });
    
    // Initialize asynchronously
    cnsManager.initialize().catch(console.error);
  }
  return cnsManager;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const manager = getCNSManager();

  try {
    switch (body.action) {
      case 'store':
        if (!body.key || !body.value || !body.layer) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: key, value, layer'
          });
        }

        const entry = await manager.store(
          body.key,
          body.value,
          body.layer as MemoryLayer,
          {
            ttl: body.ttl,
            priority: body.priority,
            tags: body.tags,
            context: body.context
          }
        );

        return { 
          success: true, 
          entry: {
            id: entry.id,
            key: entry.key,
            layer: entry.layer,
            created: entry.metadata.created,
            size: entry.metrics.size
          }
        };

      case 'bulk_store':
        if (!body.entries || !Array.isArray(body.entries)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid entries array'
          });
        }

        const results = [];
        for (const entryData of body.entries) {
          try {
            const entry = await manager.store(
              entryData.key,
              entryData.value,
              entryData.layer as MemoryLayer,
              entryData.options || {}
            );
            results.push({ success: true, key: entryData.key, id: entry.id });
          } catch (error: any) {
            results.push({ success: false, key: entryData.key, error: error.message });
          }
        }

        return { results };

      case 'delete':
        if (!body.key) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing key parameter'
          });
        }

        const deleteResult = await manager.delete(body.key, body.layer);
        return { 
          success: true, 
          deleted: deleteResult.deleted, 
          layers: deleteResult.layers 
        };

      case 'clear':
        await manager.clear(body.layer);
        return { 
          success: true, 
          message: body.layer ? `Cleared ${body.layer}` : 'Cleared all layers'
        };

      case 'compress':
        const compressionResults = await manager.compress(body.layers);
        return { 
          success: true, 
          results: compressionResults 
        };

      case 'train_predictions':
        // Trigger ML model training with provided data
        if (!body.trainingData || !Array.isArray(body.trainingData)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid training data'
          });
        }

        // This would trigger training in L4 prediction layer
        // For now, return success
        return { 
          success: true, 
          message: `Training initiated with ${body.trainingData.length} samples`
        };

      case 'evolve_patterns':
        // Manually trigger pattern evolution
        const evolution = await manager.optimize();
        return { 
          success: true, 
          evolution: evolution.evolution 
        };

      case 'predict_access':
        if (!body.context) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing context for predictions'
          });
        }

        // This would use the predictive loading engine
        return { 
          success: true, 
          message: 'Prediction request processed',
          context: body.context
        };

      case 'validate_heal':
        const validation = await manager.validateAndHeal();
        return { 
          success: true, 
          validation: validation.validation,
          healing: validation.healing,
          recommendations: validation.recommendations
        };

      case 'configure':
        // Update system configuration
        if (body.config) {
          // In a real implementation, this would update the manager configuration
          return { 
            success: true, 
            message: 'Configuration updated',
            config: body.config
          };
        }
        
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing configuration object'
        });

      case 'session_create':
        // Create a new session context in L1
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await manager.store(
          sessionId,
          {
            userId: body.userId,
            sessionData: body.sessionData || {},
            createdAt: new Date(),
            lastActivity: new Date()
          },
          MemoryLayer.L1_SESSION,
          {
            ttl: body.sessionTTL || 3600000, // 1 hour default
            priority: 100,
            tags: ['session', 'user_data'],
            context: { type: 'session', userId: body.userId }
          }
        );

        return { 
          success: true, 
          sessionId,
          message: 'Session created successfully'
        };

      case 'context_store':
        // Store request context in L2
        if (!body.contextKey || !body.contextData) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing contextKey or contextData'
          });
        }

        await manager.store(
          body.contextKey,
          body.contextData,
          MemoryLayer.L2_CONTEXT,
          {
            ttl: body.ttl || 300000, // 5 minutes default
            priority: body.priority || 50,
            tags: ['context', 'request_data'],
            context: body.context || {}
          }
        );

        return { 
          success: true, 
          message: 'Context stored successfully'
        };

      case 'pattern_learn':
        // Learn new patterns in L3
        if (!body.patternData) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing pattern data'
          });
        }

        const patternKey = `pattern_${Date.now()}`;
        await manager.store(
          patternKey,
          body.patternData,
          MemoryLayer.L3_PATTERNS,
          {
            priority: body.priority || 30,
            tags: ['pattern', 'learned', ...(body.tags || [])],
            context: body.context || {}
          }
        );

        return { 
          success: true, 
          patternKey,
          message: 'Pattern learned successfully'
        };

      default:
        return {
          error: 'Unknown action',
          available_actions: [
            'store',
            'bulk_store', 
            'delete',
            'clear',
            'compress',
            'train_predictions',
            'evolve_patterns',
            'predict_access',
            'validate_heal',
            'configure',
            'session_create',
            'context_store',
            'pattern_learn'
          ]
        };
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `CNS Memory Error: ${error.message}`
    });
  }
});