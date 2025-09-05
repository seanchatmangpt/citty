/**
 * 🧠 DARK MATTER: CNS Memory Persistence Layer
 * The critical state management that makes AI systems actually remember
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { gzipSync, gunzipSync } from 'zlib'

export interface MemoryEntry {
  id: string
  key: string
  value: any
  metadata: {
    created: number
    accessed: number
    modified: number
    hits: number
    ttl?: number
    tags: string[]
    importance: number // 0-1 score for memory importance
  }
  embeddings?: number[] // Vector embeddings for semantic search
}

export interface MemoryQuery {
  key?: string | RegExp
  tags?: string[]
  minImportance?: number
  maxAge?: number
  semantic?: string // Natural language query
}

export interface MemoryLayer {
  name: string
  capacity: number
  ttl: number
  persistence: 'memory' | 'disk' | 'hybrid'
  compression: boolean
}

/**
 * 4-Layer CNS Memory System
 * L1: Working Memory (hot, immediate)
 * L2: Short-term Memory (warm, minutes)
 * L3: Long-term Memory (cold, hours/days)  
 * L4: Persistent Memory (frozen, permanent)
 */
export class CNSMemoryPersistence extends EventEmitter {
  private layers: Map<string, Map<string, MemoryEntry>> = new Map()
  private layerConfigs: MemoryLayer[] = [
    { name: 'L1_WORKING', capacity: 100, ttl: 60000, persistence: 'memory', compression: false },
    { name: 'L2_SHORT', capacity: 1000, ttl: 300000, persistence: 'memory', compression: false },
    { name: 'L3_LONG', capacity: 10000, ttl: 86400000, persistence: 'hybrid', compression: true },
    { name: 'L4_PERSISTENT', capacity: 100000, ttl: Infinity, persistence: 'disk', compression: true }
  ]
  
  private persistencePath: string
  private autoPersistTimer?: NodeJS.Timeout
  private accessPatterns = new Map<string, number[]>() // Track access patterns for predictive loading
  private semanticIndex = new Map<string, number[]>() // Semantic embeddings for similarity search
  
  constructor(persistencePath?: string) {
    super()
    
    this.persistencePath = persistencePath || join(homedir(), '.citty', 'memory')
    
    // Initialize layers
    for (const config of this.layerConfigs) {
      this.layers.set(config.name, new Map())
    }
    
    // Ensure persistence directory exists
    if (!existsSync(this.persistencePath)) {
      mkdirSync(this.persistencePath, { recursive: true })
    }
    
    // Load persisted memories
    this.loadFromDisk()
    
    // Start auto-persistence
    this.startAutoPersistence()
    
    // Setup lifecycle hooks
    this.setupLifecycleHooks()
  }

  /**
   * Store memory with automatic layer assignment
   */
  async remember(
    key: string,
    value: any,
    options: {
      ttl?: number
      tags?: string[]
      importance?: number
      embeddings?: number[]
    } = {}
  ): Promise<string> {
    const id = this.generateId(key)
    const now = Date.now()
    
    const entry: MemoryEntry = {
      id,
      key,
      value: this.compress(value),
      metadata: {
        created: now,
        accessed: now,
        modified: now,
        hits: 0,
        ttl: options.ttl,
        tags: options.tags || [],
        importance: options.importance || this.calculateImportance(value)
      },
      embeddings: options.embeddings
    }
    
    // Determine appropriate layer based on importance and TTL
    const layer = this.selectLayer(entry)
    this.layers.get(layer)!.set(id, entry)
    
    // Update semantic index if embeddings provided
    if (options.embeddings) {
      this.semanticIndex.set(id, options.embeddings)
    }
    
    // Track access pattern
    this.trackAccess(key)
    
    this.emit('memory:stored', { id, key, layer })
    
    // Trigger memory consolidation if needed
    await this.consolidateMemories()
    
    return id
  }

  /**
   * Recall memory with automatic promotion
   */
  async recall(keyOrId: string): Promise<any | undefined> {
    const now = Date.now()
    
    // Search all layers from hottest to coldest
    for (const [layerName, layer] of this.layers) {
      for (const [id, entry] of layer) {
        if (entry.id === keyOrId || entry.key === keyOrId) {
          // Check TTL
          if (entry.metadata.ttl && 
              now - entry.metadata.created > entry.metadata.ttl) {
            layer.delete(id)
            continue
          }
          
          // Update access metadata
          entry.metadata.accessed = now
          entry.metadata.hits++
          
          // Promote to hotter layer if frequently accessed
          if (entry.metadata.hits > 5 && layerName !== 'L1_WORKING') {
            await this.promoteMemory(entry, layerName)
          }
          
          // Track access pattern
          this.trackAccess(entry.key)
          
          this.emit('memory:recalled', { id: entry.id, key: entry.key, layer: layerName })
          
          return this.decompress(entry.value)
        }
      }
    }
    
    return undefined
  }

  /**
   * Query memories with complex filters
   */
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    const now = Date.now()
    
    for (const [layerName, layer] of this.layers) {
      for (const [id, entry] of layer) {
        // Check key match
        if (query.key) {
          if (query.key instanceof RegExp) {
            if (!query.key.test(entry.key)) continue
          } else {
            if (!entry.key.includes(query.key)) continue
          }
        }
        
        // Check tags
        if (query.tags && query.tags.length > 0) {
          const hasAllTags = query.tags.every(tag => 
            entry.metadata.tags.includes(tag)
          )
          if (!hasAllTags) continue
        }
        
        // Check importance
        if (query.minImportance !== undefined) {
          if (entry.metadata.importance < query.minImportance) continue
        }
        
        // Check age
        if (query.maxAge !== undefined) {
          if (now - entry.metadata.created > query.maxAge) continue
        }
        
        results.push(entry)
      }
    }
    
    // Semantic search if requested
    if (query.semantic && this.semanticIndex.size > 0) {
      return this.semanticSearch(query.semantic, results)
    }
    
    return results
  }

  /**
   * Forget memories
   */
  async forget(keyOrId: string): Promise<boolean> {
    for (const [layerName, layer] of this.layers) {
      for (const [id, entry] of layer) {
        if (entry.id === keyOrId || entry.key === keyOrId) {
          layer.delete(id)
          this.semanticIndex.delete(id)
          this.emit('memory:forgotten', { id, key: entry.key, layer: layerName })
          return true
        }
      }
    }
    return false
  }

  /**
   * Consolidate memories - move cold memories to colder layers
   */
  private async consolidateMemories() {
    const now = Date.now()
    
    for (let i = 0; i < this.layerConfigs.length - 1; i++) {
      const currentConfig = this.layerConfigs[i]
      const currentLayer = this.layers.get(currentConfig.name)!
      const nextConfig = this.layerConfigs[i + 1]
      const nextLayer = this.layers.get(nextConfig.name)!
      
      // Check if current layer is over capacity
      if (currentLayer.size > currentConfig.capacity) {
        // Find coldest memories to demote
        const entries = Array.from(currentLayer.values())
          .sort((a, b) => {
            const scoreA = this.calculateColdScore(a, now)
            const scoreB = this.calculateColdScore(b, now)
            return scoreB - scoreA
          })
        
        // Demote coldest 20%
        const demoteCount = Math.floor(currentLayer.size * 0.2)
        for (let j = 0; j < demoteCount; j++) {
          const entry = entries[j]
          currentLayer.delete(entry.id)
          
          // Compress if moving to compressed layer
          if (nextConfig.compression && !currentConfig.compression) {
            entry.value = this.compress(entry.value, true)
          }
          
          nextLayer.set(entry.id, entry)
          this.emit('memory:demoted', { 
            id: entry.id, 
            from: currentConfig.name, 
            to: nextConfig.name 
          })
        }
      }
    }
  }

  /**
   * Promote frequently accessed memory to hotter layer
   */
  private async promoteMemory(entry: MemoryEntry, currentLayer: string) {
    const currentIndex = this.layerConfigs.findIndex(c => c.name === currentLayer)
    if (currentIndex > 0) {
      const targetConfig = this.layerConfigs[currentIndex - 1]
      const targetLayer = this.layers.get(targetConfig.name)!
      
      // Remove from current layer
      this.layers.get(currentLayer)!.delete(entry.id)
      
      // Decompress if moving to uncompressed layer
      const currentConfig = this.layerConfigs[currentIndex]
      if (currentConfig.compression && !targetConfig.compression) {
        entry.value = this.decompress(entry.value)
      }
      
      // Add to target layer
      targetLayer.set(entry.id, entry)
      
      this.emit('memory:promoted', {
        id: entry.id,
        from: currentLayer,
        to: targetConfig.name
      })
    }
  }

  /**
   * Calculate importance score for automatic prioritization
   */
  private calculateImportance(value: any): number {
    let score = 0.5 // Base score
    
    // Increase importance for complex objects
    if (typeof value === 'object' && value !== null) {
      score += 0.1
      if (Array.isArray(value)) {
        score += value.length * 0.01
      } else {
        score += Object.keys(value).length * 0.01
      }
    }
    
    // Increase importance for larger values
    const size = JSON.stringify(value).length
    score += Math.min(size / 10000, 0.2)
    
    return Math.min(score, 1)
  }

  /**
   * Calculate cold score for memory demotion
   */
  private calculateColdScore(entry: MemoryEntry, now: number): number {
    const age = now - entry.metadata.accessed
    const frequency = entry.metadata.hits
    const importance = entry.metadata.importance
    
    // Higher score = colder (more likely to demote)
    return (age / 3600000) - (frequency * 10) - (importance * 100)
  }

  /**
   * Select appropriate layer for new memory
   */
  private selectLayer(entry: MemoryEntry): string {
    if (entry.metadata.importance > 0.8) {
      return 'L1_WORKING'
    } else if (entry.metadata.importance > 0.6) {
      return 'L2_SHORT'
    } else if (entry.metadata.ttl && entry.metadata.ttl < 86400000) {
      return 'L3_LONG'
    } else {
      return 'L4_PERSISTENT'
    }
  }

  /**
   * Track access patterns for predictive loading
   */
  private trackAccess(key: string) {
    const pattern = this.accessPatterns.get(key) || []
    pattern.push(Date.now())
    
    // Keep only last 100 accesses
    if (pattern.length > 100) {
      pattern.shift()
    }
    
    this.accessPatterns.set(key, pattern)
    
    // Predict future access
    this.predictFutureAccess(key, pattern)
  }

  /**
   * Predict future access patterns
   */
  private predictFutureAccess(key: string, pattern: number[]) {
    if (pattern.length < 3) return
    
    // Calculate average interval
    const intervals = []
    for (let i = 1; i < pattern.length; i++) {
      intervals.push(pattern[i] - pattern[i - 1])
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    
    // If regular access pattern detected, preload
    const variance = intervals.reduce((sum, interval) => 
      sum + Math.pow(interval - avgInterval, 2), 0
    ) / intervals.length
    
    if (variance < avgInterval * 0.2) { // Low variance = regular pattern
      this.emit('memory:pattern_detected', { key, avgInterval, variance })
      
      // Schedule preload
      setTimeout(() => {
        this.recall(key) // Preload into hot cache
      }, avgInterval * 0.9) // Load slightly before expected access
    }
  }

  /**
   * Semantic search using embeddings
   */
  private semanticSearch(query: string, candidates: MemoryEntry[]): MemoryEntry[] {
    // In production, would use actual embeddings
    // For now, simple text similarity
    return candidates.sort((a, b) => {
      const simA = this.textSimilarity(query, a.key)
      const simB = this.textSimilarity(query, b.key)
      return simB - simA
    }).slice(0, 10)
  }

  /**
   * Simple text similarity
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    const common = words1.filter(w => words2.includes(w))
    return common.length / Math.max(words1.length, words2.length)
  }

  /**
   * Compress value for storage
   */
  private compress(value: any, force = false): any {
    const json = JSON.stringify(value)
    if (force || json.length > 1024) {
      return {
        _compressed: true,
        data: gzipSync(Buffer.from(json)).toString('base64')
      }
    }
    return value
  }

  /**
   * Decompress value from storage
   */
  private decompress(value: any): any {
    if (value && value._compressed) {
      const json = gunzipSync(Buffer.from(value.data, 'base64')).toString()
      return JSON.parse(json)
    }
    return value
  }

  /**
   * Generate unique ID
   */
  private generateId(key: string): string {
    return createHash('sha256')
      .update(key)
      .update(Date.now().toString())
      .update(Math.random().toString())
      .digest('hex')
      .substring(0, 16)
  }

  /**
   * Load memories from disk
   */
  private loadFromDisk() {
    for (const config of this.layerConfigs) {
      if (config.persistence === 'disk' || config.persistence === 'hybrid') {
        const filePath = join(this.persistencePath, `${config.name}.json`)
        if (existsSync(filePath)) {
          try {
            const data = readFileSync(filePath, 'utf-8')
            const entries = JSON.parse(data)
            const layer = this.layers.get(config.name)!
            
            for (const entry of entries) {
              layer.set(entry.id, entry)
              if (entry.embeddings) {
                this.semanticIndex.set(entry.id, entry.embeddings)
              }
            }
            
            this.emit('memory:loaded', { layer: config.name, count: entries.length })
          } catch (error) {
            this.emit('memory:load_error', { layer: config.name, error })
          }
        }
      }
    }
  }

  /**
   * Save memories to disk
   */
  private saveToDisk() {
    for (const config of this.layerConfigs) {
      if (config.persistence === 'disk' || config.persistence === 'hybrid') {
        const layer = this.layers.get(config.name)!
        const entries = Array.from(layer.values())
        
        if (entries.length > 0) {
          const filePath = join(this.persistencePath, `${config.name}.json`)
          try {
            writeFileSync(filePath, JSON.stringify(entries, null, 2))
            this.emit('memory:saved', { layer: config.name, count: entries.length })
          } catch (error) {
            this.emit('memory:save_error', { layer: config.name, error })
          }
        }
      }
    }
  }

  /**
   * Start auto-persistence timer
   */
  private startAutoPersistence() {
    this.autoPersistTimer = setInterval(() => {
      this.saveToDisk()
      this.consolidateMemories()
    }, 60000) // Every minute
    
    this.autoPersistTimer.unref()
  }

  /**
   * Setup process lifecycle hooks
   */
  private setupLifecycleHooks() {
    const cleanup = () => {
      this.saveToDisk()
      if (this.autoPersistTimer) {
        clearInterval(this.autoPersistTimer)
      }
      this.emit('memory:shutdown')
    }
    
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('beforeExit', cleanup)
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const stats: any = {
      layers: {},
      total: 0,
      patterns: this.accessPatterns.size,
      semantic: this.semanticIndex.size
    }
    
    for (const [name, layer] of this.layers) {
      stats.layers[name] = {
        count: layer.size,
        config: this.layerConfigs.find(c => c.name === name)
      }
      stats.total += layer.size
    }
    
    return stats
  }

  /**
   * Clear all memories
   */
  clearAll() {
    for (const layer of this.layers.values()) {
      layer.clear()
    }
    this.accessPatterns.clear()
    this.semanticIndex.clear()
    
    // Delete persisted files
    for (const config of this.layerConfigs) {
      const filePath = join(this.persistencePath, `${config.name}.json`)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }
    
    this.emit('memory:cleared')
  }
}

// Global singleton instance
export const memory = new CNSMemoryPersistence()

// Convenience functions
export const remember = memory.remember.bind(memory)
export const recall = memory.recall.bind(memory)
export const forget = memory.forget.bind(memory)
export const query = memory.query.bind(memory)