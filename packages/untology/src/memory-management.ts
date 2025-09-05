/**
 * 🧠 DARK MATTER: Memory Management & Leak Prevention
 * The production memory optimization humans always forget
 */

import { EventEmitter } from 'events'
import { Store, Quad } from 'n3'

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
  timestamp: number
}

export interface MemoryThresholds {
  warning: number    // 80% of limit
  critical: number   // 90% of limit
  emergency: number  // 95% of limit
}

export interface MemoryPressureInfo {
  level: 'normal' | 'warning' | 'critical' | 'emergency'
  stats: MemoryStats
  thresholds: MemoryThresholds
  actions: string[]
}

export interface CleanupTask {
  id: string
  name: string
  priority: number // Higher = more important
  execute: () => Promise<number> // Returns bytes freed
  canRun: () => boolean
}

/**
 * Advanced memory management system with proactive cleanup
 */
export class MemoryManager extends EventEmitter {
  private cleanupTasks: CleanupTask[] = []
  private memoryHistory: MemoryStats[] = []
  private activeCleanups = new Set<string>()
  private gcTimer: NodeJS.Timer | null = null
  private monitoringTimer: NodeJS.Timer | null = null
  
  private readonly HISTORY_SIZE = 100
  private readonly MONITORING_INTERVAL = 10000 // 10s
  private readonly GC_INTERVAL = 30000 // 30s
  
  constructor(
    private memoryLimit: number = 512 * 1024 * 1024, // 512MB default
    private enableAutoGC: boolean = true
  ) {
    super()
    this.setupDefaultCleanupTasks()
    this.startMonitoring()
    if (this.enableAutoGC) this.startAutoGC()
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const stats = process.memoryUsage()
    return {
      heapUsed: stats.heapUsed,
      heapTotal: stats.heapTotal,
      external: stats.external,
      rss: stats.rss,
      arrayBuffers: stats.arrayBuffers,
      timestamp: Date.now()
    }
  }

  /**
   * Get memory pressure level and recommended actions
   */
  getMemoryPressure(): MemoryPressureInfo {
    const stats = this.getMemoryStats()
    const thresholds: MemoryThresholds = {
      warning: this.memoryLimit * 0.8,
      critical: this.memoryLimit * 0.9,
      emergency: this.memoryLimit * 0.95
    }

    let level: MemoryPressureInfo['level'] = 'normal'
    const actions: string[] = []

    if (stats.heapUsed >= thresholds.emergency) {
      level = 'emergency'
      actions.push('immediate-cleanup', 'force-gc', 'clear-all-caches', 'disable-features')
    } else if (stats.heapUsed >= thresholds.critical) {
      level = 'critical'
      actions.push('aggressive-cleanup', 'force-gc', 'clear-caches')
    } else if (stats.heapUsed >= thresholds.warning) {
      level = 'warning'
      actions.push('gentle-cleanup', 'scheduled-gc')
    }

    return { level, stats, thresholds, actions }
  }

  /**
   * Register cleanup task
   */
  registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.push(task)
    this.cleanupTasks.sort((a, b) => b.priority - a.priority)
    this.emit('cleanup:registered', { taskId: task.id, name: task.name })
  }

  /**
   * Execute memory cleanup based on pressure level
   */
  async performCleanup(force: boolean = false): Promise<number> {
    const pressure = this.getMemoryPressure()
    
    if (!force && pressure.level === 'normal') {
      return 0
    }

    let totalFreed = 0
    const executed: string[] = []

    // Execute cleanup tasks by priority
    for (const task of this.cleanupTasks) {
      if (this.activeCleanups.has(task.id)) continue
      if (!task.canRun()) continue

      // Determine if we should run this task based on pressure
      const shouldRun = this.shouldRunCleanupTask(task, pressure.level, force)
      if (!shouldRun) continue

      try {
        this.activeCleanups.add(task.id)
        const freed = await this.executeCleanupTask(task)
        totalFreed += freed
        executed.push(task.id)

        this.emit('cleanup:executed', {
          taskId: task.id,
          name: task.name,
          bytesFreed: freed,
          pressureLevel: pressure.level
        })

        // Check if we've relieved enough pressure
        const newPressure = this.getMemoryPressure()
        if (newPressure.level === 'normal' && !force) {
          break
        }

      } catch (error) {
        this.emit('cleanup:error', {
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        this.activeCleanups.delete(task.id)
      }
    }

    // Force GC if significant memory was freed or under pressure
    if (totalFreed > 10 * 1024 * 1024 || pressure.level !== 'normal') { // 10MB
      this.forceGC()
    }

    this.emit('cleanup:completed', {
      totalFreed,
      executed,
      pressureLevel: pressure.level
    })

    return totalFreed
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): boolean {
    if (global.gc) {
      const beforeStats = this.getMemoryStats()
      global.gc()
      const afterStats = this.getMemoryStats()
      const freed = beforeStats.heapUsed - afterStats.heapUsed
      
      this.emit('gc:forced', {
        before: beforeStats,
        after: afterStats,
        freed
      })
      
      return true
    }
    return false
  }

  /**
   * Optimize store memory usage
   */
  optimizeStore(store: Store): number {
    const beforeSize = this.estimateStoreSize(store)
    
    // Remove duplicate quads (shouldn't happen but safety check)
    const uniqueQuads = new Map<string, Quad>()
    const allQuads = store.getQuads(null, null, null, null)
    
    for (const quad of allQuads) {
      const key = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}|${quad.graph?.value || ''}`
      if (!uniqueQuads.has(key)) {
        uniqueQuads.set(key, quad)
      }
    }
    
    if (uniqueQuads.size < allQuads.length) {
      // Rebuild store without duplicates
      store.removeQuads(allQuads)
      store.addQuads(Array.from(uniqueQuads.values()))
      
      const afterSize = this.estimateStoreSize(store)
      const freed = beforeSize - afterSize
      
      this.emit('store:optimized', {
        beforeQuads: allQuads.length,
        afterQuads: uniqueQuads.size,
        duplicatesRemoved: allQuads.length - uniqueQuads.size,
        bytesFreed: freed
      })
      
      return freed
    }
    
    return 0
  }

  /**
   * Create memory-efficient quad stream
   */
  createQuadStream(store: Store, chunkSize: number = 1000): AsyncIterableIterator<Quad[]> {
    return this.streamQuads(store, chunkSize)
  }

  /**
   * Stream quads in memory-efficient chunks
   */
  private async* streamQuads(store: Store, chunkSize: number): AsyncIterableIterator<Quad[]> {
    const allQuads = store.getQuads(null, null, null, null)
    
    for (let i = 0; i < allQuads.length; i += chunkSize) {
      const chunk = allQuads.slice(i, i + chunkSize)
      yield chunk
      
      // Allow other operations and GC between chunks
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  /**
   * Monitor memory trends and predict issues
   */
  analyzeMemoryTrends(): {
    trend: 'increasing' | 'stable' | 'decreasing'
    rate: number // MB per minute
    timeToLimit?: number // minutes
    recommendation: string[]
  } {
    if (this.memoryHistory.length < 5) {
      return {
        trend: 'stable',
        rate: 0,
        recommendation: ['Continue monitoring']
      }
    }

    const recent = this.memoryHistory.slice(-10) // Last 10 measurements
    const earliest = recent[0]
    const latest = recent[recent.length - 1]
    
    const timeDiff = (latest.timestamp - earliest.timestamp) / 1000 / 60 // minutes
    const memoryDiff = (latest.heapUsed - earliest.heapUsed) / 1024 / 1024 // MB
    const rate = memoryDiff / timeDiff

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (rate > 1) trend = 'increasing'
    else if (rate < -1) trend = 'decreasing'

    const recommendations: string[] = []
    let timeToLimit: number | undefined

    if (trend === 'increasing' && rate > 0) {
      const remainingMemory = (this.memoryLimit - latest.heapUsed) / 1024 / 1024 // MB
      timeToLimit = remainingMemory / rate
      
      if (timeToLimit < 60) { // Less than 1 hour
        recommendations.push('Immediate action required', 'Run aggressive cleanup')
      } else if (timeToLimit < 300) { // Less than 5 hours  
        recommendations.push('Schedule cleanup', 'Monitor closely')
      } else {
        recommendations.push('Continue monitoring', 'Plan optimization')
      }
    }

    return { trend, rate, timeToLimit, recommendation: recommendations }
  }

  /**
   * Setup default cleanup tasks
   */
  private setupDefaultCleanupTasks(): void {
    // Cache cleanup task
    this.registerCleanupTask({
      id: 'clear-caches',
      name: 'Clear template and query caches',
      priority: 5,
      canRun: () => true,
      execute: async () => {
        try {
          // Clear various internal caches (simplified for now)
          let freed = 0
          
          // Clear any cached data in the global scope
          if (global.gc) {
            const beforeStats = process.memoryUsage()
            global.gc()
            const afterStats = process.memoryUsage()
            freed = beforeStats.heapUsed - afterStats.heapUsed
          }
          
          return Math.max(0, freed)
        } catch {
          return 0
        }
      }
    })

    // Store optimization task
    this.registerCleanupTask({
      id: 'optimize-stores',
      name: 'Optimize RDF stores',
      priority: 7,
      canRun: () => true,
      execute: async () => {
        try {
          const { useOntology } = await import('./context')
          const context = useOntology()
          return this.optimizeStore(context.store)
        } catch {
          return 0
        }
      }
    })

    // History cleanup task
    this.registerCleanupTask({
      id: 'trim-history',
      name: 'Trim memory history',
      priority: 3,
      canRun: () => this.memoryHistory.length > this.HISTORY_SIZE,
      execute: async () => {
        const before = this.memoryHistory.length
        this.memoryHistory = this.memoryHistory.slice(-this.HISTORY_SIZE)
        const freed = (before - this.memoryHistory.length) * 200 // Rough estimate
        return freed
      }
    })
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      const stats = this.getMemoryStats()
      this.memoryHistory.push(stats)
      
      // Keep history size under control
      if (this.memoryHistory.length > this.HISTORY_SIZE * 1.2) {
        this.memoryHistory = this.memoryHistory.slice(-this.HISTORY_SIZE)
      }
      
      const pressure = this.getMemoryPressure()
      
      this.emit('memory:stats', { stats, pressure })
      
      // Auto-cleanup on warning or higher
      if (pressure.level !== 'normal') {
        this.performCleanup().catch(error => {
          this.emit('cleanup:error', { error: error.message })
        })
      }
      
    }, this.MONITORING_INTERVAL)
  }

  /**
   * Start automatic garbage collection
   */
  private startAutoGC(): void {
    if (!global.gc) return
    
    this.gcTimer = setInterval(() => {
      const pressure = this.getMemoryPressure()
      
      if (pressure.level === 'warning' || pressure.level === 'critical') {
        this.forceGC()
      }
    }, this.GC_INTERVAL)
  }

  /**
   * Determine if cleanup task should run based on pressure
   */
  private shouldRunCleanupTask(
    task: CleanupTask,
    pressureLevel: string,
    force: boolean
  ): boolean {
    if (force) return true
    
    const taskPriorityMap = {
      'emergency': 1,  // Run all tasks
      'critical': 3,   // Run high priority tasks
      'warning': 5,    // Run medium+ priority tasks
      'normal': 8      // Run only high priority tasks
    }
    
    const threshold = taskPriorityMap[pressureLevel as keyof typeof taskPriorityMap] || 8
    return task.priority >= threshold
  }

  /**
   * Execute cleanup task with timeout
   */
  private async executeCleanupTask(task: CleanupTask): Promise<number> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Cleanup task ${task.id} timed out`))
      }, 30000) // 30 second timeout

      task.execute()
        .then(freed => {
          clearTimeout(timeout)
          resolve(freed)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  /**
   * Estimate store memory usage
   */
  private estimateStoreSize(store: Store): number {
    const quadCount = store.size
    // Rough estimate: 200 bytes per quad (includes internal structures)
    return quadCount * 200
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = null
    }
    
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }
    
    this.memoryHistory.length = 0
    this.cleanupTasks.length = 0
    this.activeCleanups.clear()
    this.removeAllListeners()
  }
}

// Singleton instance
export const memoryManager = new MemoryManager()

// Convenience functions
export function getMemoryPressure(): MemoryPressureInfo {
  return memoryManager.getMemoryPressure()
}

export async function cleanupMemory(force: boolean = false): Promise<number> {
  return memoryManager.performCleanup(force)
}

export function forceGC(): boolean {
  return memoryManager.forceGC()
}

export function analyzeMemoryTrends() {
  return memoryManager.analyzeMemoryTrends()
}

// Auto-setup cleanup on process exit
process.on('beforeExit', () => {
  memoryManager.destroy()
})

process.on('SIGTERM', () => {
  memoryManager.destroy()
})

process.on('SIGINT', () => {
  memoryManager.destroy()
})