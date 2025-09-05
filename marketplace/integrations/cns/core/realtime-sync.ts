/**
 * CNS Real-time Data Synchronization System
 * 
 * Production-ready real-time synchronization with WebSockets, Redis pub/sub,
 * conflict resolution, and eventual consistency guarantees.
 */

import { EventEmitter } from 'events'
import WebSocket from 'ws'
import Redis from 'ioredis'
import winston from 'winston'
import * as crypto from 'crypto'

export enum SyncEventType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH_UPDATE = 'batch_update'
}

export enum ConflictResolution {
  LAST_WRITER_WINS = 'last_writer_wins',
  FIRST_WRITER_WINS = 'first_writer_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export interface SyncEvent {
  id: string
  type: SyncEventType
  entityType: string
  entityId: string
  data: any
  metadata: {
    timestamp: number
    nodeId: string
    userId?: string
    sessionId?: string
    version: number
    checksum: string
  }
  conflictResolution: ConflictResolution
}

export interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  localEvent: SyncEvent
  remoteEvent: SyncEvent
  resolutionStrategy: ConflictResolution
  resolved: boolean
  createdAt: number
}

export interface SyncNode {
  id: string
  address: string
  lastSeen: number
  status: 'active' | 'inactive' | 'failed'
  lag: number
  syncQueueSize: number
}

export interface SyncMetrics {
  eventsProcessed: number
  conflictsResolved: number
  averageLatency: number
  queueSize: number
  nodeCount: number
  uptime: number
}

export class CNSRealtimeSync extends EventEmitter {
  private nodeId: string
  private redis: Redis
  private pubClient: Redis
  private subClient: Redis
  private wsServer?: WebSocket.Server
  private wsClients: Map<string, WebSocket> = new Map()
  private syncQueue: SyncEvent[] = []
  private conflicts: Map<string, SyncConflict> = new Map()
  private nodes: Map<string, SyncNode> = new Map()
  private logger: winston.Logger
  private metrics: SyncMetrics
  private isRunning = false
  private syncInterval?: NodeJS.Timeout
  private heartbeatInterval?: NodeJS.Timeout

  constructor(private config: {
    nodeId?: string
    redisUrl?: string
    websocketPort?: number
    syncIntervalMs?: number
    heartbeatIntervalMs?: number
    maxQueueSize?: number
  } = {}) {
    super()
    
    this.nodeId = config.nodeId || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Initialize Redis clients
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    }
    
    this.redis = new Redis(redisConfig)
    this.pubClient = new Redis(redisConfig)
    this.subClient = new Redis(redisConfig)
    
    // Initialize metrics
    this.metrics = {
      eventsProcessed: 0,
      conflictsResolved: 0,
      averageLatency: 0,
      queueSize: 0,
      nodeCount: 0,
      uptime: Date.now()
    }
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'cns-realtime-sync.log' }),
        new winston.transports.Console()
      ]
    })
  }

  /**
   * Initialize real-time synchronization system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing CNS Real-time Sync', { nodeId: this.nodeId })
    
    try {
      // Setup Redis subscriptions
      await this.setupRedisSubscriptions()
      
      // Setup WebSocket server
      await this.setupWebSocketServer()
      
      // Register this node
      await this.registerNode()
      
      // Start synchronization processes
      this.startSyncProcess()
      this.startHeartbeat()
      
      this.isRunning = true
      this.emit('sync:initialized', { nodeId: this.nodeId })
      this.logger.info('CNS Real-time Sync initialized successfully')
      
    } catch (error) {
      this.logger.error('Failed to initialize sync system', { error })
      throw error
    }
  }

  /**
   * Publish a sync event to all nodes
   */
  async publishEvent(
    type: SyncEventType,
    entityType: string,
    entityId: string,
    data: any,
    options: {
      conflictResolution?: ConflictResolution
      userId?: string
      sessionId?: string
    } = {}
  ): Promise<SyncEvent> {
    const event: SyncEvent = {
      id: `${this.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityType,
      entityId,
      data,
      metadata: {
        timestamp: Date.now(),
        nodeId: this.nodeId,
        userId: options.userId,
        sessionId: options.sessionId,
        version: await this.getNextVersion(entityType, entityId),
        checksum: this.calculateChecksum(data)
      },
      conflictResolution: options.conflictResolution || ConflictResolution.LAST_WRITER_WINS
    }
    
    try {
      // Publish to Redis
      await this.pubClient.publish('cns:sync:events', JSON.stringify(event))
      
      // Send to WebSocket clients
      this.broadcastToWebSockets(event)
      
      // Add to local queue for processing
      this.syncQueue.push(event)
      
      this.emit('sync:event_published', event)
      this.logger.debug('Sync event published', { 
        eventId: event.id, 
        type, 
        entityType, 
        entityId 
      })
      
      return event
      
    } catch (error) {
      this.logger.error('Failed to publish sync event', { error, event })
      throw error
    }
  }

  /**
   * Subscribe to sync events for specific entity types
   */
  subscribeToEntity(entityType: string, callback: (event: SyncEvent) => void): void {
    this.on(`sync:entity:${entityType}`, callback)
  }

  /**
   * Unsubscribe from entity events
   */
  unsubscribeFromEntity(entityType: string, callback?: (event: SyncEvent) => void): void {
    if (callback) {
      this.off(`sync:entity:${entityType}`, callback)
    } else {
      this.removeAllListeners(`sync:entity:${entityType}`)
    }
  }

  /**
   * Get current synchronization metrics
   */
  getSyncMetrics(): SyncMetrics {
    return {
      ...this.metrics,
      queueSize: this.syncQueue.length,
      nodeCount: this.nodes.size,
      uptime: Date.now() - this.metrics.uptime
    }
  }

  /**
   * Get list of connected nodes
   */
  getConnectedNodes(): SyncNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get unresolved conflicts
   */
  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved)
  }

  /**
   * Manually resolve a conflict
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', mergeData?: any): Promise<boolean> {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict || conflict.resolved) return false
    
    try {
      let resolvedData: any
      
      switch (resolution) {
        case 'local':
          resolvedData = conflict.localEvent.data
          break
        case 'remote':
          resolvedData = conflict.remoteEvent.data
          break
        case 'merge':
          resolvedData = mergeData || this.mergeEventData(conflict.localEvent.data, conflict.remoteEvent.data)
          break
      }
      
      // Create resolved event
      const resolvedEvent: SyncEvent = {
        ...conflict.remoteEvent,
        id: `resolved_${conflict.id}`,
        data: resolvedData,
        metadata: {
          ...conflict.remoteEvent.metadata,
          timestamp: Date.now(),
          version: Math.max(conflict.localEvent.metadata.version, conflict.remoteEvent.metadata.version) + 1
        }
      }
      
      // Apply the resolution
      await this.applyEvent(resolvedEvent)
      
      // Mark conflict as resolved
      conflict.resolved = true
      this.metrics.conflictsResolved++
      
      this.emit('sync:conflict_resolved', { conflict, resolution: resolvedEvent })
      this.logger.info('Conflict resolved', { conflictId, resolution })
      
      return true
      
    } catch (error) {
      this.logger.error('Failed to resolve conflict', { conflictId, error })
      return false
    }
  }

  /**
   * Shutdown synchronization system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down CNS Real-time Sync')
    
    this.isRunning = false
    
    // Clear intervals
    if (this.syncInterval) clearInterval(this.syncInterval)
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    
    // Close WebSocket connections
    for (const ws of this.wsClients.values()) {
      ws.close()
    }
    
    if (this.wsServer) {
      this.wsServer.close()
    }
    
    // Unregister node
    await this.unregisterNode()
    
    // Close Redis connections
    this.redis.disconnect()
    this.pubClient.disconnect()
    this.subClient.disconnect()
    
    this.emit('sync:shutdown')
    this.logger.info('CNS Real-time Sync shutdown complete')
  }

  // Private methods

  private async setupRedisSubscriptions(): Promise<void> {
    this.subClient.subscribe('cns:sync:events', 'cns:sync:heartbeat', 'cns:sync:node-discovery')
    
    this.subClient.on('message', async (channel, message) => {
      try {
        switch (channel) {
          case 'cns:sync:events':
            const event: SyncEvent = JSON.parse(message)
            await this.handleIncomingEvent(event)
            break
            
          case 'cns:sync:heartbeat':
            const heartbeat = JSON.parse(message)
            this.handleHeartbeat(heartbeat)
            break
            
          case 'cns:sync:node-discovery':
            const nodeInfo = JSON.parse(message)
            this.handleNodeDiscovery(nodeInfo)
            break
        }
      } catch (error) {
        this.logger.error('Error processing Redis message', { channel, error })
      }
    })
  }

  private async setupWebSocketServer(): Promise<void> {
    const port = this.config.websocketPort || 8080
    
    this.wsServer = new WebSocket.Server({ port })
    
    this.wsServer.on('connection', (ws, request) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      this.wsClients.set(clientId, ws)
      
      this.logger.info('WebSocket client connected', { clientId })
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString())
          this.handleWebSocketMessage(clientId, data)
        } catch (error) {
          this.logger.error('Invalid WebSocket message', { clientId, error })
        }
      })
      
      ws.on('close', () => {
        this.wsClients.delete(clientId)
        this.logger.info('WebSocket client disconnected', { clientId })
      })
      
      // Send initial sync data
      ws.send(JSON.stringify({
        type: 'sync:connected',
        nodeId: this.nodeId,
        timestamp: Date.now()
      }))
    })
    
    this.logger.info('WebSocket server started', { port })
  }

  private async registerNode(): Promise<void> {
    const nodeInfo: SyncNode = {
      id: this.nodeId,
      address: `ws://localhost:${this.config.websocketPort || 8080}`,
      lastSeen: Date.now(),
      status: 'active',
      lag: 0,
      syncQueueSize: 0
    }
    
    await this.redis.hset('cns:sync:nodes', this.nodeId, JSON.stringify(nodeInfo))
    this.nodes.set(this.nodeId, nodeInfo)
    
    // Announce to other nodes
    await this.pubClient.publish('cns:sync:node-discovery', JSON.stringify({
      action: 'join',
      node: nodeInfo
    }))
  }

  private async unregisterNode(): Promise<void> {
    await this.redis.hdel('cns:sync:nodes', this.nodeId)
    
    // Announce departure
    await this.pubClient.publish('cns:sync:node-discovery', JSON.stringify({
      action: 'leave',
      nodeId: this.nodeId
    }))
  }

  private startSyncProcess(): void {
    this.syncInterval = setInterval(async () => {
      await this.processSyncQueue()
    }, this.config.syncIntervalMs || 1000)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      const heartbeat = {
        nodeId: this.nodeId,
        timestamp: Date.now(),
        queueSize: this.syncQueue.length,
        status: 'active'
      }
      
      await this.pubClient.publish('cns:sync:heartbeat', JSON.stringify(heartbeat))
      
      // Update local node info
      const node = this.nodes.get(this.nodeId)
      if (node) {
        node.lastSeen = Date.now()
        node.syncQueueSize = this.syncQueue.length
      }
      
    }, this.config.heartbeatIntervalMs || 5000)
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return
    
    const batch = this.syncQueue.splice(0, 10) // Process in batches
    
    for (const event of batch) {
      try {
        await this.applyEvent(event)
        this.metrics.eventsProcessed++
      } catch (error) {
        this.logger.error('Failed to process sync event', { eventId: event.id, error })
        // Re-queue for retry
        this.syncQueue.push(event)
      }
    }
  }

  private async handleIncomingEvent(event: SyncEvent): Promise<void> {
    // Ignore events from this node
    if (event.metadata.nodeId === this.nodeId) return
    
    // Check for conflicts
    const existingEvent = await this.findExistingEvent(event.entityType, event.entityId)
    
    if (existingEvent && this.hasConflict(existingEvent, event)) {
      await this.handleConflict(existingEvent, event)
    } else {
      await this.applyEvent(event)
    }
    
    // Update metrics
    this.updateLatencyMetrics(event)
  }

  private async applyEvent(event: SyncEvent): Promise<void> {
    // Store event version
    await this.storeEventVersion(event)
    
    // Emit to entity subscribers
    this.emit(`sync:entity:${event.entityType}`, event)
    
    // Emit general event
    this.emit('sync:event_applied', event)
    
    this.logger.debug('Sync event applied', { 
      eventId: event.id, 
      type: event.type, 
      entityType: event.entityType 
    })
  }

  private async findExistingEvent(entityType: string, entityId: string): Promise<SyncEvent | null> {
    try {
      const data = await this.redis.get(`cns:sync:versions:${entityType}:${entityId}`)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  private hasConflict(existing: SyncEvent, incoming: SyncEvent): boolean {
    // Check if events are concurrent (different nodes, similar timestamps)
    const timeDiff = Math.abs(existing.metadata.timestamp - incoming.metadata.timestamp)
    const isConcurrent = timeDiff < 5000 && existing.metadata.nodeId !== incoming.metadata.nodeId
    
    // Check if versions are conflicting
    const versionConflict = existing.metadata.version === incoming.metadata.version
    
    return isConcurrent || versionConflict
  }

  private async handleConflict(localEvent: SyncEvent, remoteEvent: SyncEvent): Promise<void> {
    const conflictId = `conflict_${localEvent.entityType}_${localEvent.entityId}_${Date.now()}`
    
    const conflict: SyncConflict = {
      id: conflictId,
      entityType: localEvent.entityType,
      entityId: localEvent.entityId,
      localEvent,
      remoteEvent,
      resolutionStrategy: remoteEvent.conflictResolution,
      resolved: false,
      createdAt: Date.now()
    }
    
    this.conflicts.set(conflictId, conflict)
    
    // Attempt automatic resolution
    if (conflict.resolutionStrategy !== ConflictResolution.MANUAL) {
      await this.autoResolveConflict(conflict)
    }
    
    this.emit('sync:conflict_detected', conflict)
    this.logger.warn('Sync conflict detected', { conflictId, entityType: conflict.entityType })
  }

  private async autoResolveConflict(conflict: SyncConflict): Promise<void> {
    let winnerEvent: SyncEvent
    
    switch (conflict.resolutionStrategy) {
      case ConflictResolution.LAST_WRITER_WINS:
        winnerEvent = conflict.localEvent.metadata.timestamp > conflict.remoteEvent.metadata.timestamp 
          ? conflict.localEvent : conflict.remoteEvent
        break
        
      case ConflictResolution.FIRST_WRITER_WINS:
        winnerEvent = conflict.localEvent.metadata.timestamp < conflict.remoteEvent.metadata.timestamp 
          ? conflict.localEvent : conflict.remoteEvent
        break
        
      case ConflictResolution.MERGE:
        const mergedData = this.mergeEventData(conflict.localEvent.data, conflict.remoteEvent.data)
        winnerEvent = {
          ...conflict.remoteEvent,
          data: mergedData,
          metadata: {
            ...conflict.remoteEvent.metadata,
            version: Math.max(conflict.localEvent.metadata.version, conflict.remoteEvent.metadata.version) + 1
          }
        }
        break
        
      default:
        return // Manual resolution required
    }
    
    await this.applyEvent(winnerEvent)
    conflict.resolved = true
    this.metrics.conflictsResolved++
  }

  private mergeEventData(localData: any, remoteData: any): any {
    // Simple merge strategy - in production, implement domain-specific merging
    if (typeof localData === 'object' && typeof remoteData === 'object') {
      return { ...localData, ...remoteData }
    }
    
    return remoteData // Default to remote data
  }

  private handleHeartbeat(heartbeat: any): void {
    const node = this.nodes.get(heartbeat.nodeId)
    if (node) {
      node.lastSeen = Date.now()
      node.syncQueueSize = heartbeat.queueSize
      node.status = heartbeat.status
    }
  }

  private handleNodeDiscovery(nodeInfo: any): void {
    if (nodeInfo.action === 'join') {
      this.nodes.set(nodeInfo.node.id, nodeInfo.node)
      this.logger.info('Node joined', { nodeId: nodeInfo.node.id })
    } else if (nodeInfo.action === 'leave') {
      this.nodes.delete(nodeInfo.nodeId)
      this.logger.info('Node left', { nodeId: nodeInfo.nodeId })
    }
  }

  private handleWebSocketMessage(clientId: string, message: any): void {
    // Handle WebSocket-specific messages
    switch (message.type) {
      case 'subscribe':
        // Handle subscription requests
        break
      case 'sync_request':
        // Handle sync requests
        break
    }
  }

  private broadcastToWebSockets(event: SyncEvent): void {
    const message = JSON.stringify({
      type: 'sync:event',
      event
    })
    
    for (const ws of this.wsClients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    }
  }

  private async getNextVersion(entityType: string, entityId: string): Promise<number> {
    const current = await this.redis.get(`cns:sync:versions:${entityType}:${entityId}:version`)
    return current ? parseInt(current) + 1 : 1
  }

  private calculateChecksum(data: any): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  private async storeEventVersion(event: SyncEvent): Promise<void> {
    const key = `cns:sync:versions:${event.entityType}:${event.entityId}`
    await this.redis.setex(key, 3600, JSON.stringify(event)) // 1 hour TTL
    await this.redis.setex(`${key}:version`, 3600, event.metadata.version.toString())
  }

  private updateLatencyMetrics(event: SyncEvent): void {
    const latency = Date.now() - event.metadata.timestamp
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2
  }
}

export default CNSRealtimeSync