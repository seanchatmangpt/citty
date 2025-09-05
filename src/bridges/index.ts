/**
 * Bridge System for CNS + Bytestar Integration
 * 
 * Provides unified access to Python (CNS) and Erlang (Bytestar) backend systems
 * through a consistent TypeScript interface.
 */

// Core bridge implementations
export { PythonBridge, type PythonBridgeConfig, type ProcessingResult } from './python-bridge'
export { ErlangBridge, type ErlangBridgeConfig, type ErlangResult } from './erlang-bridge'
export { 
  UnifiedBridge, 
  FormatTransformer,
  type UnifiedBridgeConfig, 
  type UnifiedRequest, 
  type UnifiedResult,
  type SystemCoordination 
} from './unified-bridge'

// Re-export schemas for validation
export {
  PythonBridgeConfigSchema,
  OntologyProcessingRequestSchema
} from './python-bridge'

export {
  ErlangBridgeConfigSchema,
  ConsensusRequestSchema,
  PerformanceRequestSchema
} from './erlang-bridge'

export {
  UnifiedBridgeConfigSchema,
  UnifiedRequestSchema,
  CrossTransformRequestSchema,
  HybridValidationRequestSchema
} from './unified-bridge'

/**
 * Factory function to create a unified bridge with default configuration
 */
export function createUnifiedBridge(config?: {
  cnsPath?: string
  bytstarPath?: string
  enablePython?: boolean
  enableErlang?: boolean
}): UnifiedBridge {
  const bridgeConfig = {
    python: {
      enabled: config?.enablePython ?? true,
      config: config?.cnsPath ? { cnsPath: config.cnsPath } : undefined
    },
    erlang: {
      enabled: config?.enableErlang ?? true,
      config: config?.bytstarPath ? { bytstarPath: config.bytstarPath } : undefined
    },
    coordination: {
      enableCrossTalk: true,
      maxConcurrentOperations: 10,
      defaultTimeout: 60000,
      fallbackStrategy: 'fail' as const
    },
    transforms: {
      enableOntologyTransforms: true,
      enableConsensusValidation: true,
      enablePerformanceMonitoring: true
    }
  }

  return new UnifiedBridge(bridgeConfig)
}

/**
 * Bridge health check utilities
 */
export class BridgeHealthChecker {
  private bridge: UnifiedBridge

  constructor(bridge: UnifiedBridge) {
    this.bridge = bridge
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    python: any
    erlang: any
    coordination: any
    recommendations: string[]
  }> {
    const coordination = await this.bridge.getCoordination()
    const recommendations: string[] = []
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check Python bridge health
    const pythonHealthy = coordination.pythonHealth?.status === 'healthy'
    if (!pythonHealthy) {
      recommendations.push('Python bridge requires attention - check CNS system availability')
      overallHealth = 'degraded'
    }

    // Check Erlang bridge health
    const erlangHealthy = coordination.erlangHealth?.status === 'healthy'
    if (!erlangHealthy) {
      recommendations.push('Erlang bridge requires attention - check Bytestar system availability')
      overallHealth = 'degraded'
    }

    // Check active operations
    if (coordination.activeOperations > 8) {
      recommendations.push('High number of active operations - consider scaling')
      if (overallHealth === 'healthy') overallHealth = 'degraded'
    }

    // Check cross-talk status
    if (!coordination.crossTalkActive) {
      recommendations.push('Cross-system communication disabled - some operations may be limited')
    }

    // Overall health assessment
    if (!pythonHealthy && !erlangHealthy) {
      overallHealth = 'unhealthy'
      recommendations.push('Critical: Both bridge systems are unavailable')
    }

    return {
      overall: overallHealth,
      python: coordination.pythonHealth,
      erlang: coordination.erlangHealth,
      coordination,
      recommendations
    }
  }

  /**
   * Monitor bridge performance over time
   */
  async monitorPerformance(duration: number = 60000): Promise<{
    metrics: any
    alerts: string[]
    recommendations: string[]
  }> {
    const startTime = Date.now()
    const metrics: any = {
      samples: [],
      averageLatency: 0,
      peakLatency: 0,
      errorRate: 0,
      throughput: 0
    }
    const alerts: string[] = []
    const recommendations: string[] = []

    const sampleInterval = setInterval(async () => {
      try {
        const sample = this.bridge.getMetrics()
        metrics.samples.push({
          timestamp: Date.now(),
          ...sample
        })

        // Check for performance alerts
        if (sample.averageLatency > 5000) {
          alerts.push(`High average latency: ${sample.averageLatency}ms`)
        }

        if (sample.operationQueue.active >= sample.operationQueue.maxConcurrent) {
          alerts.push('Operation queue at maximum capacity')
        }

      } catch (error) {
        alerts.push(`Monitoring error: ${error}`)
      }
    }, 5000) // Sample every 5 seconds

    // Wait for monitoring duration
    await new Promise(resolve => setTimeout(resolve, duration))
    clearInterval(sampleInterval)

    // Calculate final metrics
    if (metrics.samples.length > 0) {
      const latencies = metrics.samples.map((s: any) => s.averageLatency)
      metrics.averageLatency = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
      metrics.peakLatency = Math.max(...latencies)
      
      const errorRates = metrics.samples.map((s: any) => s.systemUtilization?.unified || 0)
      metrics.errorRate = errorRates.reduce((a: number, b: number) => a + b, 0) / errorRates.length
    }

    // Generate recommendations
    if (metrics.averageLatency > 3000) {
      recommendations.push('Consider optimizing bridge performance or increasing timeout values')
    }

    if (alerts.length > 5) {
      recommendations.push('High alert frequency - review system capacity and configuration')
    }

    return {
      metrics,
      alerts,
      recommendations
    }
  }
}

/**
 * Bridge configuration presets
 */
export const BridgePresets = {
  /**
   * Development configuration with relaxed timeouts
   */
  development: {
    python: {
      enabled: true,
      config: {
        maxRetries: 1,
        timeout: 60000,
        poolSize: 2
      }
    },
    erlang: {
      enabled: true,
      config: {
        maxRetries: 1,
        timeout: 60000,
        poolSize: 2,
        performanceTarget: 16 // Relaxed for development
      }
    },
    coordination: {
      enableCrossTalk: true,
      maxConcurrentOperations: 5,
      defaultTimeout: 90000,
      fallbackStrategy: 'python' as const
    }
  },

  /**
   * Production configuration with strict performance requirements
   */
  production: {
    python: {
      enabled: true,
      config: {
        maxRetries: 3,
        timeout: 30000,
        poolSize: 5,
        healthCheckInterval: 30000
      }
    },
    erlang: {
      enabled: true,
      config: {
        maxRetries: 3,
        timeout: 30000,
        poolSize: 3,
        performanceTarget: 8, // Strict Doctrine of 8
        healthCheckInterval: 30000
      }
    },
    coordination: {
      enableCrossTalk: true,
      maxConcurrentOperations: 20,
      defaultTimeout: 45000,
      fallbackStrategy: 'fail' as const
    },
    transforms: {
      enableOntologyTransforms: true,
      enableConsensusValidation: true,
      enablePerformanceMonitoring: true
    }
  },

  /**
   * High-performance configuration for enterprise workloads
   */
  enterprise: {
    python: {
      enabled: true,
      config: {
        maxRetries: 5,
        timeout: 15000,
        poolSize: 10,
        healthCheckInterval: 15000
      }
    },
    erlang: {
      enabled: true,
      config: {
        maxRetries: 5,
        timeout: 15000,
        poolSize: 8,
        performanceTarget: 4, // Ultra-strict performance
        healthCheckInterval: 15000
      }
    },
    coordination: {
      enableCrossTalk: true,
      maxConcurrentOperations: 50,
      defaultTimeout: 20000,
      fallbackStrategy: 'fail' as const
    },
    transforms: {
      enableOntologyTransforms: true,
      enableConsensusValidation: true,
      enablePerformanceMonitoring: true
    }
  }
}

/**
 * Utility functions for bridge management
 */
export class BridgeUtils {
  /**
   * Validate bridge configuration
   */
  static validateConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate Python configuration
    if (config.python?.enabled && !config.python?.config?.cnsPath) {
      errors.push('Python bridge enabled but CNS path not specified')
    }

    // Validate Erlang configuration
    if (config.erlang?.enabled && !config.erlang?.config?.bytstarPath) {
      errors.push('Erlang bridge enabled but Bytestar path not specified')
    }

    // Validate coordination settings
    if (config.coordination?.maxConcurrentOperations < 1) {
      errors.push('Maximum concurrent operations must be at least 1')
    }

    if (config.coordination?.defaultTimeout < 1000) {
      errors.push('Default timeout must be at least 1000ms')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Create bridge configuration from environment variables
   */
  static fromEnvironment(): any {
    return {
      python: {
        enabled: process.env.BRIDGE_PYTHON_ENABLED !== 'false',
        config: {
          cnsPath: process.env.CNS_PATH || '~/cns',
          pythonPath: process.env.PYTHON_PATH || 'python3',
          maxRetries: parseInt(process.env.PYTHON_MAX_RETRIES || '3'),
          timeout: parseInt(process.env.PYTHON_TIMEOUT || '30000'),
          poolSize: parseInt(process.env.PYTHON_POOL_SIZE || '5')
        }
      },
      erlang: {
        enabled: process.env.BRIDGE_ERLANG_ENABLED !== 'false',
        config: {
          bytstarPath: process.env.BYTESTAR_PATH || '~/bytestar',
          erlangPath: process.env.ERLANG_PATH || 'erl',
          maxRetries: parseInt(process.env.ERLANG_MAX_RETRIES || '3'),
          timeout: parseInt(process.env.ERLANG_TIMEOUT || '30000'),
          poolSize: parseInt(process.env.ERLANG_POOL_SIZE || '3'),
          performanceTarget: parseInt(process.env.PERFORMANCE_TARGET || '8')
        }
      },
      coordination: {
        enableCrossTalk: process.env.ENABLE_CROSS_TALK !== 'false',
        maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPS || '10'),
        defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '60000'),
        fallbackStrategy: (process.env.FALLBACK_STRATEGY || 'fail') as 'python' | 'erlang' | 'fail'
      }
    }
  }
}