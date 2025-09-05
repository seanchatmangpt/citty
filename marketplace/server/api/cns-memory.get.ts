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
  const query = getQuery(event);
  const manager = getCNSManager();

  try {
    switch (query.action) {
      case 'metrics':
        return await manager.getMetrics();

      case 'intelligence':
        return manager.getCurrentIntelligence();

      case 'health':
        return await manager.validateAndHeal();

      case 'optimize':
        return await manager.optimize();

      case 'retrieve':
        if (!query.key || !query.layer) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing key or layer parameter'
          });
        }
        
        const entry = await manager.retrieve(
          query.key as string,
          query.layer as MemoryLayer,
          query.context ? JSON.parse(query.context as string) : {}
        );
        
        return { entry };

      case 'query':
        const queryParams = query.queryParams ? JSON.parse(query.queryParams as string) : {};
        const results = await manager.query(queryParams);
        
        return { results, count: results.length };

      case 'status':
        const metrics = await manager.getMetrics();
        const intelligence = manager.getCurrentIntelligence();
        
        return {
          status: 'operational',
          health: metrics.overallHealth,
          systemLoad: metrics.systemLoad,
          intelligence: intelligence?.totalMultiplier ?? 1.0,
          layers: {
            L1: metrics.layerMetrics[MemoryLayer.L1_SESSION]?.size ?? 0,
            L2: metrics.layerMetrics[MemoryLayer.L2_CONTEXT]?.size ?? 0,
            L3: metrics.layerMetrics[MemoryLayer.L3_PATTERNS]?.size ?? 0,
            L4: metrics.layerMetrics[MemoryLayer.L4_PREDICTIONS]?.size ?? 0
          },
          engines: {
            validation: !!metrics.validationHealth,
            evolution: !!metrics.evolutionStats,
            predictive: !!metrics.predictionStats,
            intelligence: !!metrics.intelligenceMetrics
          }
        };

      default:
        return {
          available_actions: [
            'metrics',
            'intelligence', 
            'health',
            'optimize',
            'retrieve',
            'query',
            'status'
          ],
          description: 'CNS Memory System API - Central Nervous System with L1-L4 memory layers'
        };
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `CNS Memory Error: ${error.message}`
    });
  }
});