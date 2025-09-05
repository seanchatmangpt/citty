import { EventEmitter } from 'events'
import { z } from 'zod'
import type { UnifiedBridge, UnifiedResult } from '../bridges'

const SyncEventSchema = z.object({
  timestamp: z.number(),
  source: z.enum(['cns', 'bytestar']),
  target: z.enum(['cns', 'bytestar']),
  operation: z.string(),
  data: z.any(),
  metadata: z.record(z.any()).optional()
})

const SyncConfigSchema = z.object({
  enabled: z.boolean().default(true),
  bidirectional: z.boolean().default(true),
  conflictResolution: z.enum(['cns', 'bytestar', 'merge', 'fail']).default('merge'),
  syncInterval: z.number().min(1000).default(30000),
  batchSize: z.number().min(1).max(100).default(10),
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).default(1000)
})

export type SyncEvent = z.infer<typeof SyncEventSchema>
export type SyncConfig = z.infer<typeof SyncConfigSchema>

export interface SyncMetrics {
  eventsProcessed: number
  syncCycles: number
  conflicts: number
  failures: number
  averageLatency: number
  lastSync: Date | null
}

export class DataSynchronizer extends EventEmitter {
  private bridge: UnifiedBridge
  private config: SyncConfig
  private syncTimer?: NodeJS.Timeout
  private eventQueue: SyncEvent[] = []
  private processing = false
  private metrics: SyncMetrics = {
    eventsProcessed: 0,
    syncCycles: 0,
    conflicts: 0,
    failures: 0,
    averageLatency: 0,
    lastSync: null
  }

  constructor(bridge: UnifiedBridge, config: Partial<SyncConfig> = {}) {
    super()
    this.bridge = bridge
    this.config = SyncConfigSchema.parse(config)
    
    if (this.config.enabled) {
      this.startSync()
    }
  }

  async startSync(): Promise<void> {
    if (this.syncTimer) {
      return
    }

    this.syncTimer = setInterval(async () => {
      await this.processSyncCycle()
    }, this.config.syncInterval)

    this.emit('sync:started', { config: this.config })
  }

  async stopSync(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }

    await this.waitForProcessing()
    this.emit('sync:stopped', { metrics: this.metrics })
  }

  async queueEvent(event: Omit<SyncEvent, 'timestamp'>): Promise<void> {
    const syncEvent: SyncEvent = {
      ...event,
      timestamp: Date.now()
    }

    SyncEventSchema.parse(syncEvent)
    this.eventQueue.push(syncEvent)
    this.emit('event:queued', syncEvent)

    if (this.eventQueue.length >= this.config.batchSize) {
      await this.processBatch()
    }
  }

  private async processSyncCycle(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return
    }

    const startTime = Date.now()
    await this.processBatch()
    
    this.metrics.syncCycles++
    this.metrics.lastSync = new Date()
    
    const cycleTime = Date.now() - startTime
    this.metrics.averageLatency = (this.metrics.averageLatency + cycleTime) / 2
    
    this.emit('sync:cycle', { 
      cycleTime, 
      eventsProcessed: this.eventQueue.length,
      metrics: this.metrics 
    })
  }

  private async processBatch(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true
    const batch = this.eventQueue.splice(0, this.config.batchSize)
    
    try {
      await Promise.all(batch.map(event => this.processEvent(event)))
      this.metrics.eventsProcessed += batch.length
    } catch (error) {
      this.emit('sync:error', { error, batch })
      this.metrics.failures++
    } finally {
      this.processing = false
    }
  }

  private async processEvent(event: SyncEvent): Promise<void> {
    try {
      const result = await this.executeSync(event)
      this.emit('event:processed', { event, result })
    } catch (error) {
      await this.handleSyncError(event, error)
    }
  }

  private async executeSync(event: SyncEvent): Promise<UnifiedResult> {
    const request = {
      operation: 'cross-transform',
      source: event.source,
      target: event.target,
      data: event.data,
      options: {
        operation: event.operation,
        metadata: event.metadata
      }
    }

    return await this.bridge.execute(request)
  }

  private async handleSyncError(event: SyncEvent, error: any): Promise<void> {
    this.emit('event:error', { event, error })
    
    if (this.config.conflictResolution === 'fail') {
      throw error
    }

    switch (this.config.conflictResolution) {
      case 'cns':
        await this.resolveToCNS(event)
        break
      case 'bytestar':
        await this.resolveToBytestar(event)
        break
      case 'merge':
        await this.attemptMerge(event)
        break
    }
    
    this.metrics.conflicts++
  }

  private async resolveToCNS(event: SyncEvent): Promise<void> {
    if (event.source === 'cns') {
      return
    }

    const cnsRequest = {
      operation: 'ontology-transform',
      source: 'bytestar',
      target: 'cns',
      data: event.data
    }

    await this.bridge.execute(cnsRequest)
  }

  private async resolveToBytestar(event: SyncEvent): Promise<void> {
    if (event.source === 'bytestar') {
      return
    }

    const bytestarRequest = {
      operation: 'consensus-validate',
      source: 'cns',
      target: 'bytestar',
      data: event.data
    }

    await this.bridge.execute(bytestarRequest)
  }

  private async attemptMerge(event: SyncEvent): Promise<void> {
    const mergeRequest = {
      operation: 'hybrid-validation',
      source: event.source,
      target: event.target,
      data: event.data,
      options: {
        mergeStrategy: 'semantic',
        preserveBoth: true
      }
    }

    await this.bridge.execute(mergeRequest)
  }

  private async waitForProcessing(): Promise<void> {
    while (this.processing) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  getMetrics(): SyncMetrics {
    return { ...this.metrics }
  }

  getQueueStatus(): { 
    length: number
    processing: boolean
    nextSync: Date | null 
  } {
    return {
      length: this.eventQueue.length,
      processing: this.processing,
      nextSync: this.syncTimer ? 
        new Date(Date.now() + this.config.syncInterval) : null
    }
  }
}

export class SyncObserver {
  private synchronizer: DataSynchronizer
  private observations: Array<{
    timestamp: Date
    event: string
    data: any
  }> = []

  constructor(synchronizer: DataSynchronizer) {
    this.synchronizer = synchronizer
    this.setupListeners()
  }

  private setupListeners(): void {
    const events = [
      'sync:started',
      'sync:stopped', 
      'sync:cycle',
      'event:queued',
      'event:processed',
      'event:error',
      'sync:error'
    ]

    events.forEach(event => {
      this.synchronizer.on(event, (data) => {
        this.observations.push({
          timestamp: new Date(),
          event,
          data
        })
      })
    })
  }

  getObservations(since?: Date): typeof this.observations {
    if (!since) {
      return [...this.observations]
    }

    return this.observations.filter(obs => obs.timestamp >= since)
  }

  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    
    this.observations.forEach(obs => {
      counts[obs.event] = (counts[obs.event] || 0) + 1
    })

    return counts
  }

  clearObservations(): void {
    this.observations.length = 0
  }
}

export function createDataSynchronizer(
  bridge: UnifiedBridge,
  config?: Partial<SyncConfig>
): DataSynchronizer {
  return new DataSynchronizer(bridge, config)
}

export function createSyncObserver(synchronizer: DataSynchronizer): SyncObserver {
  return new SyncObserver(synchronizer)
}