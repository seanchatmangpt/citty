/**
 * CNS (Cognitive Namespace System) Integration Plugin for Nuxt
 * Preserves the existing CNS memory layers and cognitive processing
 */

import { CNSMemoryManager } from '~/server/services/cns-memory/cns-memory-manager'
import { ContextValidationEngine } from '~/server/services/cns-memory/engines/context-validation-engine'
import { CompoundIntelligence } from '~/server/services/cns-memory/engines/compound-intelligence'
import { PredictiveLoading } from '~/server/services/cns-memory/engines/predictive-loading'
import { EvolutionTracking } from '~/server/services/cns-memory/engines/evolution-tracking'

// Global CNS instance
let cnsManager: CNSMemoryManager | null = null

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🧠 Initializing CNS Memory System...')
  
  try {
    // Initialize CNS Memory Manager with full cognitive stack
    cnsManager = new CNSMemoryManager({
      enableL1Sessions: true,
      enableL2Context: true,
      enableL3Patterns: true,
      enableL4Predictions: true,
      enableValidation: true,
      enableCompoundIntelligence: true,
      enablePredictiveLoading: true,
      enableEvolutionTracking: true,
      memoryLimits: {
        l1: 1000,
        l2: 500,
        l3: 200,
        l4: 100
      },
      compressionThresholds: {
        l1: 0.8,
        l2: 0.7,
        l3: 0.6,
        l4: 0.5
      }
    })
    
    // Initialize all cognitive engines
    await cnsManager.initializeEngines()
    
    // Set up periodic maintenance
    setInterval(() => {
      cnsManager?.performMaintenance()
    }, 30000) // Every 30 seconds
    
    // Set up evolution tracking updates
    setInterval(() => {
      cnsManager?.trackEvolution()
    }, 60000) // Every minute
    
    console.log('✅ CNS Memory System initialized successfully')
    
  } catch (error) {
    console.error('❌ Failed to initialize CNS Memory System:', error)
    // Don't throw - allow server to continue without CNS if it fails
  }
})

/**
 * Export CNS manager for use in API routes
 */
export const getCNSManager = (): CNSMemoryManager | null => {
  return cnsManager
}

/**
 * Helper function to store memory in CNS
 */
export const storeCNSMemory = async (
  sessionId: string,
  contextId: string,
  data: any,
  layer: 'l1' | 'l2' | 'l3' | 'l4' = 'l2'
) => {
  if (!cnsManager) {
    console.warn('CNS Manager not initialized')
    return false
  }
  
  try {
    return await cnsManager.storeMemory(sessionId, contextId, data, layer)
  } catch (error) {
    console.error('Failed to store CNS memory:', error)
    return false
  }
}

/**
 * Helper function to retrieve memory from CNS
 */
export const retrieveCNSMemory = async (
  sessionId: string,
  contextId: string,
  layer?: 'l1' | 'l2' | 'l3' | 'l4'
) => {
  if (!cnsManager) {
    console.warn('CNS Manager not initialized')
    return null
  }
  
  try {
    return await cnsManager.retrieveMemory(sessionId, contextId, layer)
  } catch (error) {
    console.error('Failed to retrieve CNS memory:', error)
    return null
  }
}

/**
 * Helper function to perform cognitive analysis
 */
export const performCNSAnalysis = async (
  data: any,
  analysisType: 'validation' | 'intelligence' | 'prediction' | 'evolution' = 'intelligence'
) => {
  if (!cnsManager) {
    console.warn('CNS Manager not initialized')
    return null
  }
  
  try {
    switch (analysisType) {
      case 'validation':
        return await cnsManager.validateContext(data)
      case 'intelligence':
        return await cnsManager.processIntelligence(data)
      case 'prediction':
        return await cnsManager.generatePredictions(data)
      case 'evolution':
        return await cnsManager.trackEvolution(data)
      default:
        return await cnsManager.processIntelligence(data)
    }
  } catch (error) {
    console.error('Failed to perform CNS analysis:', error)
    return null
  }
}