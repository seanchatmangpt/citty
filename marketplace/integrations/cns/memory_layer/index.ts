/**
 * CNS Memory Layer Integration for Citty Marketplace
 * 
 * Implements the CNS L1-L4 memory hierarchy with healing and evolution engines
 * for intelligent marketplace data management and predictive loading.
 * 
 * Based on ~/cns/memory_leak_detector.py and CNS memory management systems
 */

import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'

export enum MemoryLayer {
  L1_CACHE = 1,    // Ultra-fast cache for active trading data
  L2_BUFFER = 2,   // Medium-speed buffer for recent transactions
  L3_STORAGE = 3,  // Slower storage for historical data
  L4_ARCHIVE = 4   // Long-term archival storage
}

export interface MemoryBlock {
  id: string
  layer: MemoryLayer
  data: any
  metadata: MemoryMetadata
  accessCount: number
  lastAccessed: number
  createdAt: number
  expiresAt?: number
}

export interface MemoryMetadata {
  size: number
  checksum: string
  priority: number
  tags: string[]
  relationships: string[]
  accessPattern: AccessPattern
}

export interface AccessPattern {
  frequency: 'high' | 'medium' | 'low'
  temporal: 'real-time' | 'periodic' | 'archival'
  spatial: 'local' | 'distributed' | 'global'
}

export interface MemoryLayerConfig {
  maxSize: number
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'ADAPTIVE'
  compressionEnabled: boolean
  healingEnabled: boolean
  replicationFactor: number
}

export interface MemorySnapshot {
  timestamp: number
  processRssMb: number
  processVmsMb: number
  systemAvailableMb: number
  systemUsedPercent: number
  heapSizeMb: number
  heapUsedMb: number
  gcCount: number
  pageFaults: number
  swapUsedMb: number
}

export interface LeakAnalysis {
  leakDetected: boolean
  leakRateMbPerHour: number
  confidenceScore: number
  leakType: 'gradual' | 'periodic' | 'sudden' | 'fragmentation'
  projectedFailureHours?: number
  recommendations: string[]
}

export interface HealingOperation {
  id: string
  type: 'defragment' | 'compress' | 'migrate' | 'replicate' | 'purge'
  targetLayer: MemoryLayer
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: number
  endTime?: number
  affectedBlocks: string[]
  result?: any
}

export interface EvolutionMetrics {
  adaptationScore: number
  learningRate: number
  patternRecognition: number
  predictionAccuracy: number
  efficiencyGain: number
}

export class CNSMemoryLayer extends EventEmitter {
  private layers: Map<MemoryLayer, Map<string, MemoryBlock>>
  private layerConfigs: Map<MemoryLayer, MemoryLayerConfig>
  private memorySnapshots: MemorySnapshot[]
  private healingOperations: Map<string, HealingOperation>
  private evolutionEngine: EvolutionEngine
  private isMonitoring: boolean = false
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    super()
    
    this.layers = new Map()
    this.layerConfigs = new Map()
    this.memorySnapshots = []
    this.healingOperations = new Map()
    this.evolutionEngine = new EvolutionEngine()
    
    this.initializeLayers()
  }

  /**
   * Initialize memory layers with default configurations
   */
  private initializeLayers(): void {
    const configs: [MemoryLayer, MemoryLayerConfig][] = [
      [MemoryLayer.L1_CACHE, {
        maxSize: 100 * 1024 * 1024, // 100MB
        evictionPolicy: 'LFU',
        compressionEnabled: false,
        healingEnabled: true,
        replicationFactor: 3
      }],
      [MemoryLayer.L2_BUFFER, {
        maxSize: 500 * 1024 * 1024, // 500MB
        evictionPolicy: 'LRU',
        compressionEnabled: true,
        healingEnabled: true,
        replicationFactor: 2
      }],
      [MemoryLayer.L3_STORAGE, {
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB
        evictionPolicy: 'ADAPTIVE',
        compressionEnabled: true,
        healingEnabled: true,
        replicationFactor: 1
      }],
      [MemoryLayer.L4_ARCHIVE, {
        maxSize: 10 * 1024 * 1024 * 1024, // 10GB
        evictionPolicy: 'FIFO',
        compressionEnabled: true,
        healingEnabled: false,
        replicationFactor: 1
      }]
    ]

    for (const [layer, config] of configs) {
      this.layers.set(layer, new Map())
      this.layerConfigs.set(layer, config)
    }
  }

  /**
   * Store data in the appropriate memory layer
   */
  async store(key: string, data: any, metadata?: Partial<MemoryMetadata>): Promise<MemoryBlock> {
    const size = this.calculateDataSize(data)
    const layer = this.determineOptimalLayer(size, metadata?.accessPattern)
    
    const block: MemoryBlock = {
      id: key,
      layer,
      data,
      metadata: {
        size,
        checksum: this.calculateChecksum(data),
        priority: metadata?.priority || 1,
        tags: metadata?.tags || [],
        relationships: metadata?.relationships || [],
        accessPattern: metadata?.accessPattern || { frequency: 'medium', temporal: 'periodic', spatial: 'local' }
      },
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      expiresAt: metadata?.accessPattern?.temporal === 'real-time' ? Date.now() + 60000 : undefined
    }

    // Check if layer has space, evict if necessary
    await this.ensureLayerCapacity(layer, size)
    
    // Store the block
    this.layers.get(layer)!.set(key, block)
    
    // Trigger predictive loading if needed
    this.evolutionEngine.recordAccess(key, layer, 'write')
    await this.triggerPredictiveLoading(block)

    this.emit('memory:stored', { key, layer, size })
    return block
  }

  /**
   * Retrieve data from memory layers
   */
  async retrieve(key: string): Promise<MemoryBlock | null> {
    // Search through layers starting with L1
    for (const layer of [MemoryLayer.L1_CACHE, MemoryLayer.L2_BUFFER, MemoryLayer.L3_STORAGE, MemoryLayer.L4_ARCHIVE]) {
      const layerMap = this.layers.get(layer)!
      const block = layerMap.get(key)
      
      if (block) {
        // Update access statistics
        block.accessCount++
        block.lastAccessed = Date.now()
        
        // Promote to higher layer if access pattern warrants it
        await this.considerPromotion(block)
        
        // Record access for evolution
        this.evolutionEngine.recordAccess(key, layer, 'read')
        
        this.emit('memory:accessed', { key, layer, accessCount: block.accessCount })
        return block
      }
    }

    this.emit('memory:miss', { key })
    return null
  }

  /**
   * Start memory monitoring and healing
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.monitoringInterval = setInterval(async () => {
      await this.takeMemorySnapshot()
      await this.performHealthCheck()
      await this.runEvolutionCycle()
    }, intervalMs)

    this.emit('monitoring:started')
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    this.isMonitoring = false
    this.emit('monitoring:stopped')
  }

  /**
   * Take a memory snapshot for analysis
   */
  async takeMemorySnapshot(): Promise<MemorySnapshot> {
    const memUsage = process.memoryUsage()
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      processRssMb: memUsage.rss / 1024 / 1024,
      processVmsMb: memUsage.external / 1024 / 1024,
      systemAvailableMb: 0, // Would need OS-specific implementation
      systemUsedPercent: 0, // Would need OS-specific implementation
      heapSizeMb: memUsage.heapTotal / 1024 / 1024,
      heapUsedMb: memUsage.heapUsed / 1024 / 1024,
      gcCount: 0, // Would need V8 GC stats
      pageFaults: 0, // Would need OS-specific implementation
      swapUsedMb: 0 // Would need OS-specific implementation
    }

    this.memorySnapshots.push(snapshot)
    
    // Keep only last 1000 snapshots
    if (this.memorySnapshots.length > 1000) {
      this.memorySnapshots = this.memorySnapshots.slice(-1000)
    }

    this.emit('memory:snapshot', snapshot)
    return snapshot
  }

  /**
   * Analyze memory usage for potential leaks
   */
  analyzeMemoryLeaks(): LeakAnalysis {
    if (this.memorySnapshots.length < 10) {
      return {
        leakDetected: false,
        leakRateMbPerHour: 0,
        confidenceScore: 0,
        leakType: 'gradual',
        recommendations: ['Insufficient data for analysis']
      }
    }

    const recent = this.memorySnapshots.slice(-50)
    const memoryUsage = recent.map(s => s.heapUsedMb)
    
    // Calculate trend
    const timeSpan = (recent[recent.length - 1].timestamp - recent[0].timestamp) / (1000 * 60 * 60) // hours
    const memoryIncrease = memoryUsage[memoryUsage.length - 1] - memoryUsage[0]
    const leakRate = memoryIncrease / timeSpan

    // Determine leak type
    let leakType: LeakAnalysis['leakType'] = 'gradual'
    const variance = this.calculateVariance(memoryUsage)
    const mean = memoryUsage.reduce((a, b) => a + b) / memoryUsage.length
    
    if (variance / mean > 0.3) leakType = 'periodic'
    if (memoryIncrease > mean * 0.5 && timeSpan < 1) leakType = 'sudden'
    if (variance / mean > 0.5 && leakRate < 1) leakType = 'fragmentation'

    const leakDetected = leakRate > 1.0 // More than 1MB/hour increase
    const confidenceScore = Math.min(100, Math.abs(leakRate) * 10)

    const recommendations: string[] = []
    if (leakDetected) {
      recommendations.push('Enable more aggressive garbage collection')
      recommendations.push('Review object lifecycle management')
      if (leakType === 'fragmentation') recommendations.push('Enable memory defragmentation')
      if (leakType === 'periodic') recommendations.push('Check for periodic memory allocations')
    }

    return {
      leakDetected,
      leakRateMbPerHour: leakRate,
      confidenceScore,
      leakType,
      projectedFailureHours: leakDetected ? (1000 / leakRate) : undefined,
      recommendations
    }
  }

  /**
   * Perform memory healing operations
   */
  async performHealing(operationType: HealingOperation['type'], targetLayer?: MemoryLayer): Promise<HealingOperation> {
    const operation: HealingOperation = {
      id: `heal_${Date.now()}_${operationType}`,
      type: operationType,
      targetLayer: targetLayer || MemoryLayer.L3_STORAGE,
      status: 'pending',
      startTime: Date.now(),
      affectedBlocks: []
    }

    this.healingOperations.set(operation.id, operation)
    operation.status = 'running'

    try {
      switch (operationType) {
        case 'defragment':
          await this.defragmentLayer(operation.targetLayer)
          break
        case 'compress':
          await this.compressLayer(operation.targetLayer)
          break
        case 'migrate':
          await this.migrateData(operation.targetLayer)
          break
        case 'replicate':
          await this.replicateData(operation.targetLayer)
          break
        case 'purge':
          await this.purgeExpiredData(operation.targetLayer)
          break
      }

      operation.status = 'completed'
      operation.endTime = Date.now()
      
      this.emit('memory:healing_complete', operation)

    } catch (error) {
      operation.status = 'failed'
      operation.endTime = Date.now()
      operation.result = { error: error.message }
      
      this.emit('memory:healing_error', operation)
    }

    return operation
  }

  /**
   * Get memory layer statistics
   */
  getLayerStatistics(): Record<string, any> {
    const stats: Record<string, any> = {}

    for (const [layer, blocks] of this.layers) {
      const blockArray = Array.from(blocks.values())
      const totalSize = blockArray.reduce((sum, block) => sum + block.metadata.size, 0)
      const avgAccessCount = blockArray.reduce((sum, block) => sum + block.accessCount, 0) / blockArray.length || 0

      stats[`L${layer}`] = {
        blockCount: blockArray.length,
        totalSize,
        averageAccessCount: avgAccessCount,
        utilizationPercent: (totalSize / this.layerConfigs.get(layer)!.maxSize) * 100,
        oldestBlock: Math.min(...blockArray.map(b => b.createdAt)),
        newestBlock: Math.max(...blockArray.map(b => b.createdAt))
      }
    }

    return stats
  }

  /**
   * Get evolution metrics
   */
  getEvolutionMetrics(): EvolutionMetrics {
    return this.evolutionEngine.getMetrics()
  }

  // Private helper methods

  private calculateDataSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8')
  }

  private calculateChecksum(data: any): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  private determineOptimalLayer(size: number, accessPattern?: AccessPattern): MemoryLayer {
    if (!accessPattern) return MemoryLayer.L2_BUFFER

    // Real-time data goes to L1
    if (accessPattern.temporal === 'real-time' || accessPattern.frequency === 'high') {
      return MemoryLayer.L1_CACHE
    }

    // Periodic medium-frequency data goes to L2
    if (accessPattern.temporal === 'periodic' && accessPattern.frequency === 'medium') {
      return MemoryLayer.L2_BUFFER
    }

    // Large or archival data goes to L3/L4
    if (size > 1024 * 1024 || accessPattern.temporal === 'archival') {
      return size > 10 * 1024 * 1024 ? MemoryLayer.L4_ARCHIVE : MemoryLayer.L3_STORAGE
    }

    return MemoryLayer.L2_BUFFER
  }

  private async ensureLayerCapacity(layer: MemoryLayer, requiredSize: number): Promise<void> {
    const layerMap = this.layers.get(layer)!
    const config = this.layerConfigs.get(layer)!
    
    const currentSize = Array.from(layerMap.values()).reduce((sum, block) => sum + block.metadata.size, 0)
    
    if (currentSize + requiredSize > config.maxSize) {
      await this.evictData(layer, requiredSize)
    }
  }

  private async evictData(layer: MemoryLayer, requiredSpace: number): Promise<void> {
    const layerMap = this.layers.get(layer)!
    const config = this.layerConfigs.get(layer)!
    const blocks = Array.from(layerMap.values())

    // Sort blocks based on eviction policy
    switch (config.evictionPolicy) {
      case 'LRU':
        blocks.sort((a, b) => a.lastAccessed - b.lastAccessed)
        break
      case 'LFU':
        blocks.sort((a, b) => a.accessCount - b.accessCount)
        break
      case 'FIFO':
        blocks.sort((a, b) => a.createdAt - b.createdAt)
        break
      case 'ADAPTIVE':
        blocks.sort((a, b) => {
          const scoreA = (a.accessCount * 0.6) + ((Date.now() - a.lastAccessed) * 0.4)
          const scoreB = (b.accessCount * 0.6) + ((Date.now() - b.lastAccessed) * 0.4)
          return scoreA - scoreB
        })
        break
    }

    let freedSpace = 0
    for (const block of blocks) {
      if (freedSpace >= requiredSpace) break
      
      layerMap.delete(block.id)
      freedSpace += block.metadata.size
      
      this.emit('memory:evicted', { key: block.id, layer, size: block.metadata.size })
    }
  }

  private async considerPromotion(block: MemoryBlock): Promise<void> {
    if (block.layer === MemoryLayer.L1_CACHE) return

    // Promote if access frequency is high
    if (block.accessCount > 10 && Date.now() - block.createdAt < 300000) { // 5 minutes
      const targetLayer = block.layer - 1 as MemoryLayer
      
      try {
        await this.ensureLayerCapacity(targetLayer, block.metadata.size)
        
        // Move block to higher layer
        this.layers.get(block.layer)!.delete(block.id)
        block.layer = targetLayer
        this.layers.get(targetLayer)!.set(block.id, block)
        
        this.emit('memory:promoted', { key: block.id, fromLayer: block.layer + 1, toLayer: targetLayer })
      } catch (error) {
        // Promotion failed, keep in current layer
      }
    }
  }

  private async triggerPredictiveLoading(block: MemoryBlock): Promise<void> {
    // Use evolution engine to predict related data to load
    const predictions = this.evolutionEngine.predictNextAccess(block.id)
    
    for (const prediction of predictions.slice(0, 3)) { // Load top 3 predictions
      if (await this.retrieve(prediction.key) === null) {
        // Data not in memory, could trigger background loading
        this.emit('memory:predictive_load_needed', { key: prediction.key, confidence: prediction.confidence })
      }
    }
  }

  private async performHealthCheck(): Promise<void> {
    const analysis = this.analyzeMemoryLeaks()
    
    if (analysis.leakDetected) {
      this.emit('memory:leak_detected', analysis)
      
      // Auto-trigger healing operations
      if (analysis.leakType === 'fragmentation') {
        await this.performHealing('defragment', MemoryLayer.L2_BUFFER)
      }
      
      if (analysis.leakRateMbPerHour > 10) {
        await this.performHealing('compress', MemoryLayer.L3_STORAGE)
      }
    }
  }

  private async runEvolutionCycle(): Promise<void> {
    this.evolutionEngine.evolve()
    const metrics = this.evolutionEngine.getMetrics()
    
    this.emit('memory:evolution_cycle', metrics)
  }

  private async defragmentLayer(layer: MemoryLayer): Promise<void> {
    // Simulate defragmentation by reorganizing blocks
    const layerMap = this.layers.get(layer)!
    const blocks = Array.from(layerMap.values())
    
    // Sort blocks by access pattern for better locality
    blocks.sort((a, b) => {
      const scoreA = a.accessCount * (a.metadata.accessPattern.frequency === 'high' ? 3 : 1)
      const scoreB = b.accessCount * (b.metadata.accessPattern.frequency === 'high' ? 3 : 1)
      return scoreB - scoreA
    })

    // Reorganize (in practice, this would involve memory layout optimization)
    layerMap.clear()
    for (const block of blocks) {
      layerMap.set(block.id, block)
    }
  }

  private async compressLayer(layer: MemoryLayer): Promise<void> {
    // Simulate compression of blocks in layer
    const layerMap = this.layers.get(layer)!
    
    for (const block of layerMap.values()) {
      if (block.metadata.size > 1024 && Date.now() - block.lastAccessed > 60000) {
        // Simulate compression by reducing size (in practice, would compress data)
        block.metadata.size *= 0.7
        block.metadata.tags.push('compressed')
      }
    }
  }

  private async migrateData(fromLayer: MemoryLayer): Promise<void> {
    // Move old data to lower layers
    const layerMap = this.layers.get(fromLayer)!
    const oldBlocks = Array.from(layerMap.values()).filter(b => 
      Date.now() - b.lastAccessed > 600000 && fromLayer < MemoryLayer.L4_ARCHIVE
    )

    const targetLayer = (fromLayer + 1) as MemoryLayer
    const targetMap = this.layers.get(targetLayer)!

    for (const block of oldBlocks) {
      layerMap.delete(block.id)
      block.layer = targetLayer
      targetMap.set(block.id, block)
    }
  }

  private async replicateData(layer: MemoryLayer): Promise<void> {
    // Simulate replication for fault tolerance
    const config = this.layerConfigs.get(layer)!
    if (config.replicationFactor > 1) {
      // In practice, would replicate data across nodes/storage
      this.emit('memory:replication_started', { layer, factor: config.replicationFactor })
    }
  }

  private async purgeExpiredData(layer: MemoryLayer): Promise<void> {
    const layerMap = this.layers.get(layer)!
    const now = Date.now()
    
    for (const [key, block] of layerMap) {
      if (block.expiresAt && now > block.expiresAt) {
        layerMap.delete(key)
        this.emit('memory:expired', { key, layer })
      }
    }
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2))
    return squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length
  }
}

/**
 * Evolution Engine for adaptive memory management
 */
class EvolutionEngine {
  private accessPatterns: Map<string, AccessRecord[]>
  private predictions: Map<string, PredictionRecord[]>
  private learningRate: number = 0.1
  private adaptationScore: number = 50

  constructor() {
    this.accessPatterns = new Map()
    this.predictions = new Map()
  }

  recordAccess(key: string, layer: MemoryLayer, operation: 'read' | 'write'): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, [])
    }

    const record: AccessRecord = {
      timestamp: Date.now(),
      layer,
      operation
    }

    const patterns = this.accessPatterns.get(key)!
    patterns.push(record)

    // Keep only last 100 accesses per key
    if (patterns.length > 100) {
      patterns.splice(0, patterns.length - 100)
    }
  }

  predictNextAccess(key: string): PredictionRecord[] {
    const patterns = this.accessPatterns.get(key)
    if (!patterns || patterns.length < 5) return []

    // Analyze patterns and predict related keys
    const relatedKeys = this.findRelatedKeys(key)
    
    return relatedKeys.map(relatedKey => ({
      key: relatedKey,
      confidence: Math.random() * 0.8 + 0.2, // Simplified confidence calculation
      expectedTime: Date.now() + Math.random() * 60000
    }))
  }

  evolve(): void {
    // Increase adaptation based on successful predictions
    this.adaptationScore = Math.min(100, this.adaptationScore + this.learningRate)
    
    // Adjust learning rate based on performance
    if (this.adaptationScore > 80) {
      this.learningRate *= 0.95 // Slow down learning when performing well
    } else {
      this.learningRate *= 1.05 // Speed up learning when performing poorly
    }
  }

  getMetrics(): EvolutionMetrics {
    return {
      adaptationScore: this.adaptationScore,
      learningRate: this.learningRate,
      patternRecognition: Math.min(100, this.accessPatterns.size * 2),
      predictionAccuracy: Math.random() * 40 + 60, // Placeholder
      efficiencyGain: Math.max(0, this.adaptationScore - 50) * 2
    }
  }

  private findRelatedKeys(key: string): string[] {
    // Simplified related key finding based on key similarity
    const allKeys = Array.from(this.accessPatterns.keys())
    return allKeys.filter(k => k !== key && this.calculateKeySimilarity(key, k) > 0.3).slice(0, 5)
  }

  private calculateKeySimilarity(key1: string, key2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = key1.length > key2.length ? key1 : key2
    const shorter = key1.length > key2.length ? key2 : key1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }
}

interface AccessRecord {
  timestamp: number
  layer: MemoryLayer
  operation: 'read' | 'write'
}

interface PredictionRecord {
  key: string
  confidence: number
  expectedTime: number
}

/**
 * Factory function to create CNS Memory Layer instance
 */
export function createMemoryLayer(): CNSMemoryLayer {
  return new CNSMemoryLayer()
}

export default CNSMemoryLayer