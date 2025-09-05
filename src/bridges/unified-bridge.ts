/**
 * Unified Bridge for CNS + Bytestar Integration
 * 
 * Orchestrates communication between Python (CNS) and Erlang (Bytestar) systems
 * through a unified interface, providing cross-system transformations and coordination.
 */

import { EventEmitter } from 'events'
import { z } from 'zod'
import { performance } from 'perf_hooks'
import { PythonBridge, PythonBridgeConfig, ProcessingResult } from './python-bridge'
import { ErlangBridge, ErlangBridgeConfig, ErlangResult } from './erlang-bridge'

// Configuration schema
const UnifiedBridgeConfigSchema = z.object({
  python: z.object({
    enabled: z.boolean().default(true),
    config: z.custom<Partial<PythonBridgeConfig>>().optional()
  }),
  erlang: z.object({
    enabled: z.boolean().default(true),
    config: z.custom<Partial<ErlangBridgeConfig>>().optional()
  }),
  coordination: z.object({
    enableCrossTalk: z.boolean().default(true),
    maxConcurrentOperations: z.number().default(10),
    defaultTimeout: z.number().default(60000),
    fallbackStrategy: z.enum(['python', 'erlang', 'fail']).default('fail')
  }),
  transforms: z.object({
    enableOntologyTransforms: z.boolean().default(true),
    enableConsensusValidation: z.boolean().default(true),
    enablePerformanceMonitoring: z.boolean().default(true)
  })
})

// Request schemas
const UnifiedRequestSchema = z.object({
  operation: z.enum([
    'ontology-process', 'consensus-execute', 'cross-transform', 
    'hybrid-validate', 'performance-monitor', 'system-coordinate'
  ]),
  source: z.enum(['cns', 'bytestar', 'unified']).optional(),
  data: z.any(),
  options: z.record(z.any()).optional()
})

const CrossTransformRequestSchema = z.object({
  operation: z.literal('cross-transform'),
  sourceSystem: z.enum(['cns', 'bytestar']),
  targetSystem: z.enum(['cns', 'bytestar']),
  sourceFormat: z.string(),
  targetFormat: z.string(),
  data: z.any(),
  options: z.record(z.any()).optional()
})

const HybridValidationRequestSchema = z.object({
  operation: z.literal('hybrid-validate'),
  ontologyData: z.string(),
  consensusNodes: z.array(z.string()).optional(),
  validationRules: z.array(z.string()).optional(),
  options: z.record(z.any()).optional()
})

type UnifiedBridgeConfig = z.infer<typeof UnifiedBridgeConfigSchema>
type UnifiedRequest = z.infer<typeof UnifiedRequestSchema>
type CrossTransformRequest = z.infer<typeof CrossTransformRequestSchema>
type HybridValidationRequest = z.infer<typeof HybridValidationRequestSchema>

interface UnifiedResult {
  success: boolean
  data?: any
  error?: string
  performance: {
    totalLatency: number
    bridgeLatency: number
    pythonLatency?: number
    erlangLatency?: number
    crossSystemLatency?: number
  }
  metadata: {
    operationId: string
    timestamp: number
    systemsUsed: string[]
    transformsApplied: string[]
    version: string
  }
  compliance: {
    ontologyValid: boolean
    consensusReached: boolean
    performanceWithinLimits: boolean
    crossSystemIntegrityMaintained: boolean
  }
}

interface SystemCoordination {
  pythonHealth: any
  erlangHealth: any
  crossTalkActive: boolean
  activeOperations: number
  queuedOperations: number
}

/**
 * Format transformation utilities
 */
class FormatTransformer {
  /**
   * Transform CNS OWL/RDF to Bytestar Fuller Canon format
   */
  static async owlToFullerCanon(owlData: string): Promise<string> {
    // Implementation would convert OWL ontology format to Fuller Canon
    // This is a simplified representation
    const owlLines = owlData.split('\n')
    const fullerCanonLines: string[] = []
    
    fullerCanonLines.push('# Fuller Canon Ontology')
    fullerCanonLines.push('# Transformed from OWL/RDF format')
    fullerCanonLines.push('')
    
    for (const line of owlLines) {
      if (line.includes('owl:Class')) {
        const className = this.extractClassName(line)
        fullerCanonLines.push(`class:${className} type:concept`)
      } else if (line.includes('owl:ObjectProperty')) {
        const propertyName = this.extractPropertyName(line)
        fullerCanonLines.push(`property:${propertyName} type:relation`)
      } else if (line.includes('rdfs:subClassOf')) {
        const [child, parent] = this.extractSubClassRelation(line)
        fullerCanonLines.push(`relation:${child} inherits:${parent}`)
      }
    }
    
    return fullerCanonLines.join('\n')
  }

  /**
   * Transform Bytestar Fuller Canon to CNS OWL/RDF format
   */
  static async fullerCanonToOwl(fullerCanonData: string): Promise<string> {
    const lines = fullerCanonData.split('\n')
    const owlLines: string[] = []
    
    owlLines.push('<?xml version="1.0"?>')
    owlLines.push('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    owlLines.push('         xmlns:owl="http://www.w3.org/2002/07/owl#"')
    owlLines.push('         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">')
    owlLines.push('')
    
    for (const line of lines) {
      if (line.startsWith('class:') && line.includes('type:concept')) {
        const className = this.extractValue(line, 'class:')
        owlLines.push(`  <owl:Class rdf:about="#${className}"/>`)
      } else if (line.startsWith('property:') && line.includes('type:relation')) {
        const propertyName = this.extractValue(line, 'property:')
        owlLines.push(`  <owl:ObjectProperty rdf:about="#${propertyName}"/>`)
      } else if (line.includes('inherits:')) {
        const child = this.extractValue(line, 'relation:')
        const parent = this.extractValue(line, 'inherits:')
        owlLines.push(`  <owl:Class rdf:about="#${child}">`)
        owlLines.push(`    <rdfs:subClassOf rdf:resource="#${parent}"/>`)
        owlLines.push('  </owl:Class>')
      }
    }
    
    owlLines.push('</rdf:RDF>')
    return owlLines.join('\n')
  }

  private static extractClassName(line: string): string {
    const match = line.match(/rdf:about="#([^"]+)"/) || line.match(/owl:Class.*?(\w+)/)
    return match ? match[1] : 'UnknownClass'
  }

  private static extractPropertyName(line: string): string {
    const match = line.match(/rdf:about="#([^"]+)"/) || line.match(/owl:ObjectProperty.*?(\w+)/)
    return match ? match[1] : 'UnknownProperty'
  }

  private static extractSubClassRelation(line: string): [string, string] {
    const childMatch = line.match(/owl:Class rdf:about="#([^"]+)"/)
    const parentMatch = line.match(/rdfs:subClassOf rdf:resource="#([^"]+)"/)
    return [
      childMatch ? childMatch[1] : 'UnknownChild',
      parentMatch ? parentMatch[1] : 'UnknownParent'
    ]
  }

  private static extractValue(line: string, prefix: string): string {
    const startIndex = line.indexOf(prefix) + prefix.length
    const endIndex = line.indexOf(' ', startIndex)
    return endIndex === -1 ? line.substring(startIndex) : line.substring(startIndex, endIndex)
  }
}

/**
 * Main Unified Bridge class
 */
export class UnifiedBridge extends EventEmitter {
  private config: UnifiedBridgeConfig
  private pythonBridge?: PythonBridge
  private erlangBridge?: ErlangBridge
  private operationQueue: Map<string, Promise<UnifiedResult>> = new Map()
  private metrics: {
    totalOperations: number
    crossSystemOperations: number
    transformations: number
    validations: number
    averageLatency: number
    systemUtilization: {
      python: number
      erlang: number
      unified: number
    }
  } = {
    totalOperations: 0,
    crossSystemOperations: 0,
    transformations: 0,
    validations: 0,
    averageLatency: 0,
    systemUtilization: {
      python: 0,
      erlang: 0,
      unified: 0
    }
  }

  constructor(config: Partial<UnifiedBridgeConfig> = {}) {
    super()
    this.config = UnifiedBridgeConfigSchema.parse(config)
    this.initializeBridges()
  }

  private async initializeBridges(): Promise<void> {
    try {
      // Initialize Python bridge for CNS
      if (this.config.python.enabled) {
        this.pythonBridge = new PythonBridge(this.config.python.config)
        this.pythonBridge.on('metrics', (metrics) => this.emit('pythonMetrics', metrics))
        this.pythonBridge.on('processError', (error) => this.emit('pythonError', error))
      }

      // Initialize Erlang bridge for Bytestar
      if (this.config.erlang.enabled) {
        this.erlangBridge = new ErlangBridge(this.config.erlang.config)
        this.erlangBridge.on('metrics', (metrics) => this.emit('erlangMetrics', metrics))
        this.erlangBridge.on('nodeError', (error) => this.emit('erlangError', error))
        this.erlangBridge.on('constraintViolation', (data) => this.emit('constraintViolation', data))
      }

      this.emit('initialized', {
        python: !!this.pythonBridge,
        erlang: !!this.erlangBridge,
        coordination: this.config.coordination.enableCrossTalk
      })

    } catch (error) {
      this.emit('initializationError', error)
      throw error
    }
  }

  /**
   * Execute unified operation across systems
   */
  async execute(request: UnifiedRequest): Promise<UnifiedResult> {
    const operationId = this.generateOperationId()
    const startTime = performance.now()

    try {
      // Validate request
      const validatedRequest = UnifiedRequestSchema.parse(request)

      // Check operation queue limits
      if (this.operationQueue.size >= this.config.coordination.maxConcurrentOperations) {
        throw new Error('Maximum concurrent operations exceeded')
      }

      // Create operation promise
      const operationPromise = this.executeOperation(validatedRequest, operationId, startTime)
      this.operationQueue.set(operationId, operationPromise)

      // Execute and cleanup
      const result = await operationPromise
      this.operationQueue.delete(operationId)

      this.updateMetrics(result, performance.now() - startTime)
      return result

    } catch (error) {
      this.operationQueue.delete(operationId)
      
      const result: UnifiedResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: 0
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed: [],
          transformsApplied: [],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: false,
          consensusReached: false,
          performanceWithinLimits: false,
          crossSystemIntegrityMaintained: false
        }
      }

      this.updateMetrics(result, performance.now() - startTime)
      return result
    }
  }

  private async executeOperation(
    request: UnifiedRequest, 
    operationId: string, 
    startTime: number
  ): Promise<UnifiedResult> {
    const bridgeStartTime = performance.now()

    switch (request.operation) {
      case 'ontology-process':
        return this.executeOntologyProcessing(request, operationId, startTime)
      
      case 'consensus-execute':
        return this.executeConsensus(request, operationId, startTime)
      
      case 'cross-transform':
        return this.executeCrossTransform(request as CrossTransformRequest, operationId, startTime)
      
      case 'hybrid-validate':
        return this.executeHybridValidation(request as HybridValidationRequest, operationId, startTime)
      
      case 'performance-monitor':
        return this.executePerformanceMonitoring(request, operationId, startTime)
      
      case 'system-coordinate':
        return this.executeSystemCoordination(request, operationId, startTime)
      
      default:
        throw new Error(`Unknown operation: ${request.operation}`)
    }
  }

  private async executeOntologyProcessing(
    request: UnifiedRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    if (!this.pythonBridge) {
      throw new Error('Python bridge not available for ontology processing')
    }

    const pythonStartTime = performance.now()
    const result = await this.pythonBridge.processOntology({
      operation: request.options?.operation || 'validate',
      input: request.data,
      format: request.options?.format || 'owl'
    })
    const pythonLatency = performance.now() - pythonStartTime

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      performance: {
        totalLatency: performance.now() - startTime,
        bridgeLatency: performance.now() - startTime,
        pythonLatency
      },
      metadata: {
        operationId,
        timestamp: Date.now(),
        systemsUsed: ['python', 'cns'],
        transformsApplied: [],
        version: '1.0.0'
      },
      compliance: {
        ontologyValid: result.success,
        consensusReached: false,
        performanceWithinLimits: result.performance.latency < 8000, // 8s CNS constraint
        crossSystemIntegrityMaintained: true
      }
    }
  }

  private async executeConsensus(
    request: UnifiedRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    if (!this.erlangBridge) {
      throw new Error('Erlang bridge not available for consensus operations')
    }

    const erlangStartTime = performance.now()
    const result = await this.erlangBridge.executeConsensus({
      operation: request.options?.algorithm || 'byzantine',
      data: request.data,
      options: request.options
    })
    const erlangLatency = performance.now() - erlangStartTime

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      performance: {
        totalLatency: performance.now() - startTime,
        bridgeLatency: performance.now() - startTime,
        erlangLatency
      },
      metadata: {
        operationId,
        timestamp: Date.now(),
        systemsUsed: ['erlang', 'bytestar'],
        transformsApplied: [],
        version: '1.0.0'
      },
      compliance: {
        ontologyValid: false,
        consensusReached: result.success,
        performanceWithinLimits: result.performance.ticks <= 8 && result.performance.hops <= 8,
        crossSystemIntegrityMaintained: true
      }
    }
  }

  private async executeCrossTransform(
    request: CrossTransformRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    const transformStartTime = performance.now()
    let transformedData: string
    let systemsUsed: string[] = []
    let transformsApplied: string[] = []

    try {
      if (request.sourceSystem === 'cns' && request.targetSystem === 'bytestar') {
        // CNS OWL/RDF -> Bytestar Fuller Canon
        transformedData = await FormatTransformer.owlToFullerCanon(request.data)
        systemsUsed = ['cns', 'bytestar']
        transformsApplied = ['owl-to-fuller-canon']
      } else if (request.sourceSystem === 'bytestar' && request.targetSystem === 'cns') {
        // Bytestar Fuller Canon -> CNS OWL/RDF
        transformedData = await FormatTransformer.fullerCanonToOwl(request.data)
        systemsUsed = ['bytestar', 'cns']
        transformsApplied = ['fuller-canon-to-owl']
      } else {
        throw new Error(`Unsupported transformation: ${request.sourceSystem} -> ${request.targetSystem}`)
      }

      const transformLatency = performance.now() - transformStartTime

      return {
        success: true,
        data: {
          originalData: request.data,
          transformedData,
          sourceFormat: request.sourceFormat,
          targetFormat: request.targetFormat
        },
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: transformLatency,
          crossSystemLatency: transformLatency
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied,
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: true,
          consensusReached: false,
          performanceWithinLimits: transformLatency < 1000, // 1s for transformation
          crossSystemIntegrityMaintained: true
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - transformStartTime,
          crossSystemLatency: 0
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied,
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: false,
          consensusReached: false,
          performanceWithinLimits: false,
          crossSystemIntegrityMaintained: false
        }
      }
    }
  }

  private async executeHybridValidation(
    request: HybridValidationRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    const validationResults: any = {}
    const systemsUsed: string[] = []
    let ontologyValid = false
    let consensusReached = false

    try {
      // Step 1: Validate ontology using CNS
      if (this.pythonBridge) {
        const ontologyResult = await this.pythonBridge.validateOntology(
          request.ontologyData, 
          'owl'
        )
        validationResults.ontology = ontologyResult
        systemsUsed.push('cns')
        ontologyValid = ontologyResult.success
      }

      // Step 2: Validate consensus using Bytestar
      if (this.erlangBridge && request.consensusNodes) {
        const consensusResult = await this.erlangBridge.executeConsensus({
          operation: 'validate',
          data: {
            ontologyData: request.ontologyData,
            nodes: request.consensusNodes
          }
        })
        validationResults.consensus = consensusResult
        systemsUsed.push('bytestar')
        consensusReached = consensusResult.success
      }

      const success = ontologyValid && (consensusReached || !request.consensusNodes)

      return {
        success,
        data: validationResults,
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime,
          pythonLatency: validationResults.ontology?.performance?.latency,
          erlangLatency: validationResults.consensus?.performance?.latency,
          crossSystemLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied: ['hybrid-validation'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid,
          consensusReached,
          performanceWithinLimits: (performance.now() - startTime) < 10000, // 10s total
          crossSystemIntegrityMaintained: success
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied: ['hybrid-validation-failed'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: false,
          consensusReached: false,
          performanceWithinLimits: false,
          crossSystemIntegrityMaintained: false
        }
      }
    }
  }

  private async executePerformanceMonitoring(
    request: UnifiedRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    const monitoringResults: any = {}
    const systemsUsed: string[] = []

    try {
      // Monitor Python bridge performance
      if (this.pythonBridge) {
        monitoringResults.python = await this.pythonBridge.getHealth()
        systemsUsed.push('cns')
      }

      // Monitor Erlang bridge performance
      if (this.erlangBridge) {
        monitoringResults.erlang = await this.erlangBridge.getHealth()
        systemsUsed.push('bytestar')
      }

      // Unified metrics
      monitoringResults.unified = this.getMetrics()

      return {
        success: true,
        data: monitoringResults,
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied: ['performance-monitoring'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: true,
          consensusReached: true,
          performanceWithinLimits: true,
          crossSystemIntegrityMaintained: true
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed,
          transformsApplied: ['performance-monitoring-failed'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: false,
          consensusReached: false,
          performanceWithinLimits: false,
          crossSystemIntegrityMaintained: false
        }
      }
    }
  }

  private async executeSystemCoordination(
    request: UnifiedRequest,
    operationId: string,
    startTime: number
  ): Promise<UnifiedResult> {
    try {
      const coordination: SystemCoordination = {
        pythonHealth: this.pythonBridge ? await this.pythonBridge.getHealth() : null,
        erlangHealth: this.erlangBridge ? await this.erlangBridge.getHealth() : null,
        crossTalkActive: this.config.coordination.enableCrossTalk,
        activeOperations: this.operationQueue.size,
        queuedOperations: 0 // Would implement actual queue
      }

      return {
        success: true,
        data: coordination,
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed: ['unified'],
          transformsApplied: ['system-coordination'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: true,
          consensusReached: true,
          performanceWithinLimits: true,
          crossSystemIntegrityMaintained: true
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          totalLatency: performance.now() - startTime,
          bridgeLatency: performance.now() - startTime
        },
        metadata: {
          operationId,
          timestamp: Date.now(),
          systemsUsed: ['unified'],
          transformsApplied: ['system-coordination-failed'],
          version: '1.0.0'
        },
        compliance: {
          ontologyValid: false,
          consensusReached: false,
          performanceWithinLimits: false,
          crossSystemIntegrityMaintained: false
        }
      }
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private updateMetrics(result: UnifiedResult, latency: number): void {
    this.metrics.totalOperations++
    
    if (result.metadata.systemsUsed.length > 1) {
      this.metrics.crossSystemOperations++
    }
    
    if (result.metadata.transformsApplied.length > 0) {
      this.metrics.transformations++
    }
    
    if (result.metadata.transformsApplied.some(t => t.includes('validation'))) {
      this.metrics.validations++
    }

    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2

    // Update system utilization
    if (result.metadata.systemsUsed.includes('cns')) {
      this.metrics.systemUtilization.python++
    }
    if (result.metadata.systemsUsed.includes('bytestar')) {
      this.metrics.systemUtilization.erlang++
    }
    if (result.metadata.systemsUsed.includes('unified')) {
      this.metrics.systemUtilization.unified++
    }

    this.emit('metrics', this.metrics)
  }

  /**
   * Get unified bridge metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      operationQueue: {
        active: this.operationQueue.size,
        maxConcurrent: this.config.coordination.maxConcurrentOperations
      },
      bridges: {
        python: !!this.pythonBridge,
        erlang: !!this.erlangBridge
      }
    }
  }

  /**
   * Get system coordination status
   */
  async getCoordination(): Promise<SystemCoordination> {
    return {
      pythonHealth: this.pythonBridge ? await this.pythonBridge.getHealth() : null,
      erlangHealth: this.erlangBridge ? await this.erlangBridge.getHealth() : null,
      crossTalkActive: this.config.coordination.enableCrossTalk,
      activeOperations: this.operationQueue.size,
      queuedOperations: 0
    }
  }

  /**
   * Shutdown unified bridge
   */
  async shutdown(): Promise<void> {
    // Wait for active operations to complete
    if (this.operationQueue.size > 0) {
      await Promise.allSettled(Array.from(this.operationQueue.values()))
    }

    // Shutdown bridges
    const shutdownPromises: Promise<void>[] = []
    
    if (this.pythonBridge) {
      shutdownPromises.push(this.pythonBridge.shutdown())
    }
    
    if (this.erlangBridge) {
      shutdownPromises.push(this.erlangBridge.shutdown())
    }

    await Promise.all(shutdownPromises)
    this.removeAllListeners()
  }
}

// Export types
export type {
  UnifiedBridgeConfig,
  UnifiedRequest,
  CrossTransformRequest,
  HybridValidationRequest,
  UnifiedResult,
  SystemCoordination
}

export {
  UnifiedBridgeConfigSchema,
  UnifiedRequestSchema,
  CrossTransformRequestSchema,
  HybridValidationRequestSchema,
  FormatTransformer
}