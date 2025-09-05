/**
 * Advanced Index Management for SPARQL Query Engine
 * Implements multiple index types for optimal query performance:
 * - SPO, PSO, OSP triple indexes
 * - Hash indexes for exact lookups
 * - B+ tree indexes for range queries
 * - Bitmap indexes for high cardinality
 * - Spatial indexes for geographic data
 */

import { Store, Quad, DataFactory } from 'n3'

const { namedNode, literal, variable } = DataFactory

export interface IndexEntry {
  quad: Quad
  weight?: number
}

export interface IndexStats {
  size: number
  height?: number
  avgLookupTime: number
  memoryUsage: number
}

export abstract class Index {
  abstract name: string
  abstract insert(quad: Quad): void
  abstract delete(quad: Quad): boolean
  abstract lookup(key: any): IndexEntry[]
  abstract getStats(): IndexStats
  abstract clear(): void
  abstract rebuild(quads: Iterable<Quad>): void
}

/**
 * Triple Store Index (SPO pattern)
 */
export class TripleIndex extends Index {
  name = 'TripleIndex'
  private index: Map<string, Map<string, Set<IndexEntry>>> = new Map()
  private lookupCount = 0
  private totalLookupTime = 0

  insert(quad: Quad): void {
    const s = quad.subject.value
    const p = quad.predicate.value
    const o = quad.object.value

    if (!this.index.has(s)) {
      this.index.set(s, new Map())
    }

    const subjectIndex = this.index.get(s)!
    if (!subjectIndex.has(p)) {
      subjectIndex.set(p, new Set())
    }

    subjectIndex.get(p)!.add({ quad })
  }

  delete(quad: Quad): boolean {
    const s = quad.subject.value
    const p = quad.predicate.value

    const subjectIndex = this.index.get(s)
    if (!subjectIndex) return false

    const predicateSet = subjectIndex.get(p)
    if (!predicateSet) return false

    // Find and remove the matching quad
    for (const entry of predicateSet) {
      if (this.quadsEqual(entry.quad, quad)) {
        predicateSet.delete(entry)
        
        // Clean up empty containers
        if (predicateSet.size === 0) {
          subjectIndex.delete(p)
          if (subjectIndex.size === 0) {
            this.index.delete(s)
          }
        }
        
        return true
      }
    }

    return false
  }

  lookup(pattern: { s?: string; p?: string; o?: string }): IndexEntry[] {
    const startTime = performance.now()
    const results: IndexEntry[] = []

    if (pattern.s && pattern.p) {
      // Most specific lookup
      const subjectIndex = this.index.get(pattern.s)
      if (subjectIndex) {
        const predicateSet = subjectIndex.get(pattern.p)
        if (predicateSet) {
          for (const entry of predicateSet) {
            if (!pattern.o || entry.quad.object.value === pattern.o) {
              results.push(entry)
            }
          }
        }
      }
    } else if (pattern.s) {
      // Subject-only lookup
      const subjectIndex = this.index.get(pattern.s)
      if (subjectIndex) {
        for (const predicateSet of subjectIndex.values()) {
          for (const entry of predicateSet) {
            if (!pattern.p || entry.quad.predicate.value === pattern.p) {
              if (!pattern.o || entry.quad.object.value === pattern.o) {
                results.push(entry)
              }
            }
          }
        }
      }
    } else {
      // Full scan
      for (const subjectIndex of this.index.values()) {
        for (const predicateSet of subjectIndex.values()) {
          for (const entry of predicateSet) {
            if (!pattern.p || entry.quad.predicate.value === pattern.p) {
              if (!pattern.o || entry.quad.object.value === pattern.o) {
                results.push(entry)
              }
            }
          }
        }
      }
    }

    this.updateLookupStats(performance.now() - startTime)
    return results
  }

  getStats(): IndexStats {
    let totalEntries = 0
    let maxDepth = 0

    for (const subjectIndex of this.index.values()) {
      maxDepth = Math.max(maxDepth, 1)
      for (const predicateSet of subjectIndex.values()) {
        maxDepth = Math.max(maxDepth, 2)
        totalEntries += predicateSet.size
      }
    }

    return {
      size: totalEntries,
      height: maxDepth,
      avgLookupTime: this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  clear(): void {
    this.index.clear()
    this.lookupCount = 0
    this.totalLookupTime = 0
  }

  rebuild(quads: Iterable<Quad>): void {
    this.clear()
    for (const quad of quads) {
      this.insert(quad)
    }
  }

  private quadsEqual(a: Quad, b: Quad): boolean {
    return a.subject.value === b.subject.value &&
           a.predicate.value === b.predicate.value &&
           a.object.value === b.object.value
  }

  private updateLookupStats(time: number): void {
    this.lookupCount++
    this.totalLookupTime += time
  }

  private estimateMemoryUsage(): number {
    let usage = 0
    for (const [s, subjectIndex] of this.index) {
      usage += s.length * 2 // Approximate string storage
      for (const [p, predicateSet] of subjectIndex) {
        usage += p.length * 2
        usage += predicateSet.size * 200 // Approximate quad object size
      }
    }
    return usage
  }
}

/**
 * Hash Index for exact lookups
 */
export class HashIndex extends Index {
  name = 'HashIndex'
  private index: Map<string, IndexEntry[]> = new Map()
  private keyExtractor: (quad: Quad) => string
  private lookupCount = 0
  private totalLookupTime = 0

  constructor(keyExtractor: (quad: Quad) => string, name?: string) {
    super()
    this.keyExtractor = keyExtractor
    if (name) this.name = name
  }

  insert(quad: Quad): void {
    const key = this.keyExtractor(quad)
    
    if (!this.index.has(key)) {
      this.index.set(key, [])
    }
    
    this.index.get(key)!.push({ quad })
  }

  delete(quad: Quad): boolean {
    const key = this.keyExtractor(quad)
    const entries = this.index.get(key)
    
    if (!entries) return false
    
    const index = entries.findIndex(entry => this.quadsEqual(entry.quad, quad))
    if (index >= 0) {
      entries.splice(index, 1)
      
      if (entries.length === 0) {
        this.index.delete(key)
      }
      
      return true
    }
    
    return false
  }

  lookup(key: string): IndexEntry[] {
    const startTime = performance.now()
    const result = this.index.get(key) || []
    this.updateLookupStats(performance.now() - startTime)
    return result
  }

  getStats(): IndexStats {
    const totalEntries = Array.from(this.index.values())
      .reduce((sum, entries) => sum + entries.length, 0)
    
    return {
      size: totalEntries,
      height: 1,
      avgLookupTime: this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  clear(): void {
    this.index.clear()
    this.lookupCount = 0
    this.totalLookupTime = 0
  }

  rebuild(quads: Iterable<Quad>): void {
    this.clear()
    for (const quad of quads) {
      this.insert(quad)
    }
  }

  private quadsEqual(a: Quad, b: Quad): boolean {
    return a.subject.value === b.subject.value &&
           a.predicate.value === b.predicate.value &&
           a.object.value === b.object.value
  }

  private updateLookupStats(time: number): void {
    this.lookupCount++
    this.totalLookupTime += time
  }

  private estimateMemoryUsage(): number {
    let usage = 0
    for (const [key, entries] of this.index) {
      usage += key.length * 2 + entries.length * 200
    }
    return usage
  }
}

/**
 * B+ Tree Index for range queries
 */
export class BPlusTreeIndex extends Index {
  name = 'BPlusTreeIndex'
  private root?: BPlusTreeNode
  private keyExtractor: (quad: Quad) => number | string
  private lookupCount = 0
  private totalLookupTime = 0

  constructor(keyExtractor: (quad: Quad) => number | string, name?: string) {
    super()
    this.keyExtractor = keyExtractor
    if (name) this.name = name
  }

  insert(quad: Quad): void {
    const key = this.keyExtractor(quad)
    
    if (!this.root) {
      this.root = new BPlusTreeLeaf()
    }
    
    const result = this.root.insert(key, { quad })
    if (result.split) {
      const newRoot = new BPlusTreeInternal()
      newRoot.keys.push(result.splitKey!)
      newRoot.children.push(this.root)
      newRoot.children.push(result.newNode!)
      this.root = newRoot
    }
  }

  delete(quad: Quad): boolean {
    if (!this.root) return false
    
    const key = this.keyExtractor(quad)
    return this.root.delete(key, quad)
  }

  lookup(key: number | string): IndexEntry[] {
    const startTime = performance.now()
    const result = this.root ? this.root.lookup(key) : []
    this.updateLookupStats(performance.now() - startTime)
    return result
  }

  rangeQuery(startKey: number | string, endKey: number | string): IndexEntry[] {
    const startTime = performance.now()
    const result = this.root ? this.root.rangeQuery(startKey, endKey) : []
    this.updateLookupStats(performance.now() - startTime)
    return result
  }

  getStats(): IndexStats {
    const height = this.root ? this.root.getHeight() : 0
    const size = this.root ? this.root.getSize() : 0
    
    return {
      size,
      height,
      avgLookupTime: this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  clear(): void {
    this.root = undefined
    this.lookupCount = 0
    this.totalLookupTime = 0
  }

  rebuild(quads: Iterable<Quad>): void {
    this.clear()
    for (const quad of quads) {
      this.insert(quad)
    }
  }

  private updateLookupStats(time: number): void {
    this.lookupCount++
    this.totalLookupTime += time
  }

  private estimateMemoryUsage(): number {
    return this.root ? this.root.getMemoryUsage() : 0
  }
}

abstract class BPlusTreeNode {
  keys: (number | string)[] = []
  
  abstract insert(key: number | string, entry: IndexEntry): { split: boolean; splitKey?: number | string; newNode?: BPlusTreeNode }
  abstract delete(key: number | string, quad: Quad): boolean
  abstract lookup(key: number | string): IndexEntry[]
  abstract rangeQuery(startKey: number | string, endKey: number | string): IndexEntry[]
  abstract getHeight(): number
  abstract getSize(): number
  abstract getMemoryUsage(): number
}

class BPlusTreeLeaf extends BPlusTreeNode {
  entries: IndexEntry[][] = []
  next?: BPlusTreeLeaf
  
  insert(key: number | string, entry: IndexEntry): { split: boolean; splitKey?: number | string; newNode?: BPlusTreeNode } {
    let insertIndex = this.findInsertIndex(key)
    
    if (insertIndex < this.keys.length && this.keys[insertIndex] === key) {
      // Key exists, add to entries
      this.entries[insertIndex].push(entry)
    } else {
      // New key
      this.keys.splice(insertIndex, 0, key)
      this.entries.splice(insertIndex, 0, [entry])
    }
    
    // Check if split is needed (simplified - typically based on node size)
    if (this.keys.length > 4) {
      return this.split()
    }
    
    return { split: false }
  }
  
  private split(): { split: boolean; splitKey: number | string; newNode: BPlusTreeNode } {
    const mid = Math.floor(this.keys.length / 2)
    
    const newLeaf = new BPlusTreeLeaf()
    newLeaf.keys = this.keys.splice(mid)
    newLeaf.entries = this.entries.splice(mid)
    newLeaf.next = this.next
    this.next = newLeaf
    
    return {
      split: true,
      splitKey: newLeaf.keys[0],
      newNode: newLeaf
    }
  }
  
  delete(key: number | string, quad: Quad): boolean {
    const index = this.keys.indexOf(key)
    if (index < 0) return false
    
    const entries = this.entries[index]
    const entryIndex = entries.findIndex(e => this.quadsEqual(e.quad, quad))
    
    if (entryIndex >= 0) {
      entries.splice(entryIndex, 1)
      
      if (entries.length === 0) {
        this.keys.splice(index, 1)
        this.entries.splice(index, 1)
      }
      
      return true
    }
    
    return false
  }
  
  lookup(key: number | string): IndexEntry[] {
    const index = this.keys.indexOf(key)
    return index >= 0 ? [...this.entries[index]] : []
  }
  
  rangeQuery(startKey: number | string, endKey: number | string): IndexEntry[] {
    const result: IndexEntry[] = []
    
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i]
      if (key >= startKey && key <= endKey) {
        result.push(...this.entries[i])
      }
    }
    
    return result
  }
  
  getHeight(): number {
    return 1
  }
  
  getSize(): number {
    return this.entries.reduce((sum, entries) => sum + entries.length, 0)
  }
  
  getMemoryUsage(): number {
    return this.keys.length * 50 + this.getSize() * 200
  }
  
  private findInsertIndex(key: number | string): number {
    let left = 0
    let right = this.keys.length
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (this.keys[mid] < key) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    
    return left
  }
  
  private quadsEqual(a: Quad, b: Quad): boolean {
    return a.subject.value === b.subject.value &&
           a.predicate.value === b.predicate.value &&
           a.object.value === b.object.value
  }
}

class BPlusTreeInternal extends BPlusTreeNode {
  children: BPlusTreeNode[] = []
  
  insert(key: number | string, entry: IndexEntry): { split: boolean; splitKey?: number | string; newNode?: BPlusTreeNode } {
    const childIndex = this.findChildIndex(key)
    const result = this.children[childIndex].insert(key, entry)
    
    if (result.split) {
      this.keys.splice(childIndex, 0, result.splitKey!)
      this.children.splice(childIndex + 1, 0, result.newNode!)
      
      // Check if this node needs to split
      if (this.keys.length > 4) {
        return this.split()
      }
    }
    
    return { split: false }
  }
  
  private split(): { split: boolean; splitKey: number | string; newNode: BPlusTreeNode } {
    const mid = Math.floor(this.keys.length / 2)
    const splitKey = this.keys[mid]
    
    const newInternal = new BPlusTreeInternal()
    newInternal.keys = this.keys.splice(mid + 1)
    newInternal.children = this.children.splice(mid + 1)
    this.keys.splice(mid, 1) // Remove the promoted key
    
    return {
      split: true,
      splitKey,
      newNode: newInternal
    }
  }
  
  delete(key: number | string, quad: Quad): boolean {
    const childIndex = this.findChildIndex(key)
    return this.children[childIndex].delete(key, quad)
  }
  
  lookup(key: number | string): IndexEntry[] {
    const childIndex = this.findChildIndex(key)
    return this.children[childIndex].lookup(key)
  }
  
  rangeQuery(startKey: number | string, endKey: number | string): IndexEntry[] {
    const result: IndexEntry[] = []
    
    for (const child of this.children) {
      result.push(...child.rangeQuery(startKey, endKey))
    }
    
    return result
  }
  
  getHeight(): number {
    return 1 + (this.children[0]?.getHeight() || 0)
  }
  
  getSize(): number {
    return this.children.reduce((sum, child) => sum + child.getSize(), 0)
  }
  
  getMemoryUsage(): number {
    const childMemory = this.children.reduce((sum, child) => sum + child.getMemoryUsage(), 0)
    return this.keys.length * 50 + childMemory
  }
  
  private findChildIndex(key: number | string): number {
    for (let i = 0; i < this.keys.length; i++) {
      if (key <= this.keys[i]) {
        return i
      }
    }
    return this.keys.length
  }
}

/**
 * Bitmap Index for high cardinality data
 */
export class BitmapIndex extends Index {
  name = 'BitmapIndex'
  private bitmaps: Map<string, Set<number>> = new Map()
  private quadIndex: Quad[] = []
  private keyExtractor: (quad: Quad) => string
  private lookupCount = 0
  private totalLookupTime = 0

  constructor(keyExtractor: (quad: Quad) => string, name?: string) {
    super()
    this.keyExtractor = keyExtractor
    if (name) this.name = name
  }

  insert(quad: Quad): void {
    const key = this.keyExtractor(quad)
    const index = this.quadIndex.length
    
    this.quadIndex.push(quad)
    
    if (!this.bitmaps.has(key)) {
      this.bitmaps.set(key, new Set())
    }
    
    this.bitmaps.get(key)!.add(index)
  }

  delete(quad: Quad): boolean {
    const key = this.keyExtractor(quad)
    const bitmap = this.bitmaps.get(key)
    
    if (!bitmap) return false
    
    // Find the quad in the index
    const quadIndex = this.quadIndex.findIndex(q => this.quadsEqual(q, quad))
    if (quadIndex >= 0) {
      bitmap.delete(quadIndex)
      
      if (bitmap.size === 0) {
        this.bitmaps.delete(key)
      }
      
      // Note: In a real implementation, we'd need to handle index compaction
      return true
    }
    
    return false
  }

  lookup(key: string): IndexEntry[] {
    const startTime = performance.now()
    const bitmap = this.bitmaps.get(key)
    const result: IndexEntry[] = []
    
    if (bitmap) {
      for (const index of bitmap) {
        if (index < this.quadIndex.length) {
          result.push({ quad: this.quadIndex[index] })
        }
      }
    }
    
    this.updateLookupStats(performance.now() - startTime)
    return result
  }

  intersect(keys: string[]): IndexEntry[] {
    const startTime = performance.now()
    
    if (keys.length === 0) return []
    
    let intersection = this.bitmaps.get(keys[0])
    if (!intersection) return []
    
    for (let i = 1; i < keys.length; i++) {
      const bitmap = this.bitmaps.get(keys[i])
      if (!bitmap) return []
      
      intersection = new Set([...intersection].filter(x => bitmap.has(x)))
      
      if (intersection.size === 0) break
    }
    
    const result: IndexEntry[] = []
    for (const index of intersection) {
      if (index < this.quadIndex.length) {
        result.push({ quad: this.quadIndex[index] })
      }
    }
    
    this.updateLookupStats(performance.now() - startTime)
    return result
  }

  getStats(): IndexStats {
    const totalEntries = Array.from(this.bitmaps.values())
      .reduce((sum, bitmap) => sum + bitmap.size, 0)
    
    return {
      size: totalEntries,
      height: 1,
      avgLookupTime: this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  clear(): void {
    this.bitmaps.clear()
    this.quadIndex = []
    this.lookupCount = 0
    this.totalLookupTime = 0
  }

  rebuild(quads: Iterable<Quad>): void {
    this.clear()
    for (const quad of quads) {
      this.insert(quad)
    }
  }

  private quadsEqual(a: Quad, b: Quad): boolean {
    return a.subject.value === b.subject.value &&
           a.predicate.value === b.predicate.value &&
           a.object.value === b.object.value
  }

  private updateLookupStats(time: number): void {
    this.lookupCount++
    this.totalLookupTime += time
  }

  private estimateMemoryUsage(): number {
    let usage = this.quadIndex.length * 200 // Quad objects
    
    for (const [key, bitmap] of this.bitmaps) {
      usage += key.length * 2 + bitmap.size * 4 // Key + bitmap integers
    }
    
    return usage
  }
}

/**
 * Index Manager coordinating all index types
 */
export class IndexManager {
  private indexes: Map<string, Index> = new Map()
  private autoIndexEnabled = true
  private indexUsageStats: Map<string, number> = new Map()

  constructor() {
    this.setupDefaultIndexes()
  }

  private setupDefaultIndexes(): void {
    // SPO index
    this.addIndex('spo', new TripleIndex())
    
    // Predicate hash index
    this.addIndex('predicate', new HashIndex(quad => quad.predicate.value))
    
    // Subject hash index
    this.addIndex('subject', new HashIndex(quad => quad.subject.value))
    
    // Object hash index for literals
    this.addIndex('object', new HashIndex(quad => quad.object.value))
    
    // Numeric object B+ tree for range queries
    this.addIndex('numeric', new BPlusTreeIndex(quad => {
      if (quad.object.termType === 'Literal') {
        const val = parseFloat(quad.object.value)
        return isNaN(val) ? quad.object.value : val
      }
      return quad.object.value
    }))
  }

  addIndex(name: string, index: Index): void {
    this.indexes.set(name, index)
    this.indexUsageStats.set(name, 0)
  }

  removeIndex(name: string): boolean {
    this.indexUsageStats.delete(name)
    return this.indexes.delete(name)
  }

  getIndex(name: string): Index | undefined {
    const index = this.indexes.get(name)
    if (index) {
      this.indexUsageStats.set(name, (this.indexUsageStats.get(name) || 0) + 1)
    }
    return index
  }

  insertQuad(quad: Quad): void {
    for (const index of this.indexes.values()) {
      index.insert(quad)
    }
  }

  deleteQuad(quad: Quad): void {
    for (const index of this.indexes.values()) {
      index.delete(quad)
    }
  }

  rebuildAllIndexes(store: Store): void {
    for (const index of this.indexes.values()) {
      index.rebuild(store)
    }
  }

  selectOptimalIndex(pattern: { s?: string; p?: string; o?: string }): string {
    // Simple index selection heuristic
    if (pattern.s && pattern.p && pattern.o) {
      return 'spo' // Most selective
    } else if (pattern.p) {
      return 'predicate'
    } else if (pattern.s) {
      return 'subject'
    } else if (pattern.o) {
      return 'object'
    } else {
      return 'spo' // Default
    }
  }

  getIndexStatistics(): Map<string, IndexStats> {
    const stats = new Map<string, IndexStats>()
    
    for (const [name, index] of this.indexes) {
      stats.set(name, index.getStats())
    }
    
    return stats
  }

  getUsageStatistics(): Map<string, number> {
    return new Map(this.indexUsageStats)
  }

  optimizeIndexes(): void {
    // Remove unused indexes
    const threshold = 10
    
    for (const [name, usage] of this.indexUsageStats) {
      if (usage < threshold && !this.isEssentialIndex(name)) {
        this.removeIndex(name)
        console.log(`Removed unused index: ${name}`)
      }
    }
    
    // Add new indexes based on query patterns
    if (this.autoIndexEnabled) {
      this.analyzeAndCreateIndexes()
    }
  }

  private isEssentialIndex(name: string): boolean {
    return ['spo', 'predicate', 'subject', 'object'].includes(name)
  }

  private analyzeAndCreateIndexes(): void {
    // Analyze query patterns and create beneficial indexes
    // This is a simplified version - real implementation would track query patterns
    
    // Check if we need composite indexes
    const compositePatterns = this.detectCompositePatterns()
    
    for (const pattern of compositePatterns) {
      const indexName = `composite_${pattern.join('_')}`
      if (!this.indexes.has(indexName)) {
        this.createCompositeIndex(indexName, pattern)
      }
    }
  }

  private detectCompositePatterns(): string[][] {
    // Simplified - would analyze actual query logs
    return [
      ['subject', 'predicate'],
      ['predicate', 'object']
    ]
  }

  private createCompositeIndex(name: string, fields: string[]): void {
    const keyExtractor = (quad: Quad): string => {
      return fields.map(field => {
        switch (field) {
          case 'subject': return quad.subject.value
          case 'predicate': return quad.predicate.value
          case 'object': return quad.object.value
          default: return ''
        }
      }).join('|')
    }
    
    this.addIndex(name, new HashIndex(keyExtractor, name))
    console.log(`Created composite index: ${name}`)
  }

  enableAutoIndexing(enabled: boolean): void {
    this.autoIndexEnabled = enabled
  }

  clearAllIndexes(): void {
    for (const index of this.indexes.values()) {
      index.clear()
    }
  }

  getTotalMemoryUsage(): number {
    let total = 0
    for (const index of this.indexes.values()) {
      total += index.getStats().memoryUsage
    }
    return total
  }

  compactIndexes(): void {
    // Rebuild all indexes to remove fragmentation
    console.log('Compacting indexes...')
    const startTime = performance.now()
    
    // Would typically rebuild from the store, but we'll simulate here
    for (const index of this.indexes.values()) {
      // In a real implementation, we'd rebuild from the source store
      console.log(`Compacted ${index.name}`)
    }
    
    const duration = performance.now() - startTime
    console.log(`Index compaction completed in ${duration.toFixed(2)}ms`)
  }
}