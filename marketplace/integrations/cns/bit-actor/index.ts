/**
 * CNS BitActor Distributed Processing System
 * Actor-based distributed computation framework with bit-level precision
 */

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { MessageChannel, MessagePort } from 'worker_threads';
import { createHash, randomBytes } from 'crypto';

export interface BitMessage {
  id: string;
  type: string;
  payload: Buffer | Uint8Array;
  priority: number;
  timestamp: bigint;
  source: string;
  target?: string;
  ttl: number;
  checksum: string;
}

export interface ActorState {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'shutdown';
  capabilities: string[];
  load: number; // 0-1 scale
  memory: ActorMemory;
  metrics: ActorMetrics;
  lastActivity: bigint;
}

export interface ActorMemory {
  allocated: number;
  used: number;
  peak: number;
  gcCount: number;
  fragments: number;
}

export interface ActorMetrics {
  messagesProcessed: number;
  messagesDropped: number;
  averageLatency: bigint;
  errorCount: number;
  throughput: number;
  uptime: bigint;
}

export interface ProcessingNode {
  id: string;
  host: string;
  port: number;
  capacity: number;
  currentLoad: number;
  actors: Map<string, ActorState>;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeat: bigint;
}

export interface DistributionStrategy {
  type: 'round-robin' | 'weighted' | 'affinity' | 'random' | 'consistent-hash';
  parameters: Record<string, any>;
}

/**
 * Distributed Actor System with bit-level processing
 */
export class BitActorSystem extends EventEmitter {
  private nodes: Map<string, ProcessingNode>;
  private actors: Map<string, BitActor>;
  private messageQueue: BitMessage[];
  private distributionStrategy: DistributionStrategy;
  private isRunning: boolean = false;
  private systemMetrics: SystemMetrics;
  private heartbeatInterval?: NodeJS.Timer;

  constructor(private config: BitActorConfig = {}) {
    super();
    this.nodes = new Map();
    this.actors = new Map();
    this.messageQueue = [];
    this.distributionStrategy = config.strategy || { type: 'weighted', parameters: {} };
    this.systemMetrics = this.initializeSystemMetrics();
  }

  private initializeSystemMetrics(): SystemMetrics {
    return {
      totalNodes: 0,
      activeActors: 0,
      messagesPerSecond: 0,
      averageLatency: BigInt(0),
      errorRate: 0,
      memoryUsage: 0,
      networkLatency: BigInt(0),
      startTime: process.hrtime.bigint()
    };
  }

  /**
   * Start the distributed actor system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('BitActor system is already running');
    }

    try {
      this.isRunning = true;
      this.systemMetrics.startTime = process.hrtime.bigint();

      // Initialize local node
      await this.initializeLocalNode();

      // Start message processing loop
      setImmediate(() => this.messageProcessingLoop());

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      // Start metrics collection
      setInterval(() => this.updateSystemMetrics(), 1000);

      this.emit('systemStarted', {
        nodeId: this.getLocalNodeId(),
        timestamp: process.hrtime.bigint()
      });

    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the distributed actor system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop heartbeat monitoring
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Shutdown all local actors
    for (const actor of this.actors.values()) {
      await actor.shutdown();
    }

    // Notify other nodes of shutdown
    await this.broadcastShutdown();

    this.emit('systemStopped', { timestamp: process.hrtime.bigint() });
  }

  /**
   * Create a new bit actor
   */
  async createActor(type: string, capabilities: string[] = []): Promise<BitActor> {
    const actorId = this.generateActorId();
    
    const actor = new BitActor({
      id: actorId,
      type,
      capabilities,
      system: this
    });

    await actor.initialize();
    
    this.actors.set(actorId, actor);
    this.systemMetrics.activeActors++;

    // Find optimal node for the actor
    const targetNode = await this.selectOptimalNode(actor);
    if (targetNode && targetNode.id !== this.getLocalNodeId()) {
      await this.migrateActor(actor, targetNode);
    }

    this.emit('actorCreated', { actorId, type, targetNode: targetNode?.id });

    return actor;
  }

  /**
   * Send message to actor
   */
  async sendMessage(targetActorId: string, message: Omit<BitMessage, 'id' | 'timestamp' | 'checksum'>): Promise<void> {
    const bitMessage: BitMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: process.hrtime.bigint(),
      checksum: this.calculateChecksum(message.payload)
    };

    // Find target actor location
    const targetLocation = await this.findActorLocation(targetActorId);
    
    if (!targetLocation) {
      throw new Error(`Actor ${targetActorId} not found`);
    }

    if (targetLocation.nodeId === this.getLocalNodeId()) {
      // Local delivery
      await this.deliverLocalMessage(bitMessage);
    } else {
      // Remote delivery
      await this.deliverRemoteMessage(bitMessage, targetLocation.nodeId);
    }

    this.emit('messageSent', { messageId: bitMessage.id, target: targetActorId });
  }

  /**
   * Broadcast message to all actors of a specific type
   */
  async broadcast(actorType: string, message: Omit<BitMessage, 'id' | 'timestamp' | 'checksum' | 'target'>): Promise<void> {
    const targetActors = this.findActorsByType(actorType);
    
    const broadcastPromises = targetActors.map(actor => 
      this.sendMessage(actor.id, { ...message, target: actor.id })
    );

    await Promise.all(broadcastPromises);
    
    this.emit('messageBroadcast', { actorType, count: targetActors.length });
  }

  /**
   * Process computational task across distributed actors
   */
  async processTask(task: DistributedTask): Promise<TaskResult> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Decompose task into subtasks
      const subtasks = await this.decomposeTask(task);
      
      // Distribute subtasks to optimal actors
      const subtaskPromises = subtasks.map(async subtask => {
        const optimalActor = await this.selectOptimalActor(subtask);
        return this.executeSubtask(optimalActor, subtask);
      });

      // Wait for all subtasks to complete
      const subtaskResults = await Promise.all(subtaskPromises);
      
      // Combine results
      const result = await this.combineResults(subtaskResults, task);
      
      const processingTime = process.hrtime.bigint() - startTime;

      this.emit('taskCompleted', {
        taskId: task.id,
        processingTime,
        subtaskCount: subtasks.length
      });

      return result;

    } catch (error) {
      const processingTime = process.hrtime.bigint() - startTime;
      
      this.emit('taskFailed', {
        taskId: task.id,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  private async initializeLocalNode(): Promise<void> {
    const nodeId = this.getLocalNodeId();
    
    const localNode: ProcessingNode = {
      id: nodeId,
      host: this.config.host || 'localhost',
      port: this.config.port || 8080,
      capacity: this.config.capacity || 100,
      currentLoad: 0,
      actors: new Map(),
      status: 'online',
      lastHeartbeat: process.hrtime.bigint()
    };

    this.nodes.set(nodeId, localNode);
    this.systemMetrics.totalNodes = 1;
  }

  private getLocalNodeId(): string {
    return this.config.nodeId || `node-${process.pid}`;
  }

  private generateActorId(): string {
    return `actor-${randomBytes(8).toString('hex')}`;
  }

  private generateMessageId(): string {
    return `msg-${randomBytes(8).toString('hex')}`;
  }

  private calculateChecksum(payload: Buffer | Uint8Array): string {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    return createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  }

  private async selectOptimalNode(actor: BitActor): Promise<ProcessingNode | null> {
    const availableNodes = Array.from(this.nodes.values()).filter(node => 
      node.status === 'online' && node.currentLoad < node.capacity
    );

    if (availableNodes.length === 0) return null;

    switch (this.distributionStrategy.type) {
      case 'weighted':
        return this.selectWeightedNode(availableNodes);
      case 'affinity':
        return this.selectAffinityNode(availableNodes, actor);
      case 'round-robin':
        return this.selectRoundRobinNode(availableNodes);
      case 'consistent-hash':
        return this.selectConsistentHashNode(availableNodes, actor.id);
      default:
        return availableNodes[Math.floor(Math.random() * availableNodes.length)];
    }
  }

  private selectWeightedNode(nodes: ProcessingNode[]): ProcessingNode {
    // Select node with lowest load
    return nodes.reduce((best, current) => 
      current.currentLoad < best.currentLoad ? current : best
    );
  }

  private selectAffinityNode(nodes: ProcessingNode[], actor: BitActor): ProcessingNode {
    // Select node with similar actors
    const affinityScores = nodes.map(node => ({
      node,
      score: this.calculateAffinityScore(node, actor)
    }));

    return affinityScores.reduce((best, current) => 
      current.score > best.score ? current : best
    ).node;
  }

  private selectRoundRobinNode(nodes: ProcessingNode[]): ProcessingNode {
    // Simple round-robin selection
    const index = this.systemMetrics.activeActors % nodes.length;
    return nodes[index];
  }

  private selectConsistentHashNode(nodes: ProcessingNode[], actorId: string): ProcessingNode {
    // Consistent hashing based on actor ID
    const hash = createHash('sha256').update(actorId).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const index = hashValue % nodes.length;
    return nodes[index];
  }

  private calculateAffinityScore(node: ProcessingNode, actor: BitActor): number {
    let score = 0;
    
    for (const existingActor of node.actors.values()) {
      // Calculate similarity based on capabilities
      const commonCapabilities = actor.capabilities.filter(cap => 
        existingActor.capabilities.includes(cap)
      );
      score += commonCapabilities.length;
      
      // Bonus for same type
      if (existingActor.type === actor.type) {
        score += 5;
      }
    }

    // Penalty for high load
    score -= node.currentLoad * 2;

    return score;
  }

  private async migrateActor(actor: BitActor, targetNode: ProcessingNode): Promise<void> {
    // Serialize actor state
    const serializedState = await actor.serialize();
    
    // Send migration request to target node
    await this.sendNodeMessage(targetNode.id, {
      type: 'migrate-actor',
      payload: serializedState,
      actorId: actor.id
    });

    // Remove from local registry
    this.actors.delete(actor.id);
    
    this.emit('actorMigrated', {
      actorId: actor.id,
      sourceNode: this.getLocalNodeId(),
      targetNode: targetNode.id
    });
  }

  private async sendNodeMessage(nodeId: string, message: any): Promise<void> {
    // Implementation for inter-node communication
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // This would typically use network protocols (HTTP, TCP, etc.)
    // For now, we'll emit an event
    this.emit('nodeMessage', { targetNode: nodeId, message });
  }

  private async messageProcessingLoop(): Promise<void> {
    while (this.isRunning) {
      if (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      } else {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  private async processMessage(message: BitMessage): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Validate message integrity
      if (!this.validateMessage(message)) {
        throw new Error('Message validation failed');
      }

      // Find target actor
      const targetActor = this.actors.get(message.target || '');
      if (!targetActor) {
        throw new Error(`Target actor ${message.target} not found`);
      }

      // Deliver message to actor
      await targetActor.receiveMessage(message);

      const processingTime = process.hrtime.bigint() - startTime;
      this.updateMessageMetrics(processingTime, true);

    } catch (error) {
      const processingTime = process.hrtime.bigint() - startTime;
      this.updateMessageMetrics(processingTime, false);
      
      this.emit('messageProcessingError', {
        messageId: message.id,
        error: error.message
      });
    }
  }

  private validateMessage(message: BitMessage): boolean {
    // Validate checksum
    const expectedChecksum = this.calculateChecksum(message.payload);
    if (message.checksum !== expectedChecksum) {
      return false;
    }

    // Check TTL
    const currentTime = process.hrtime.bigint();
    const messageAge = currentTime - message.timestamp;
    const ttlNs = BigInt(message.ttl * 1_000_000); // Convert ms to ns
    
    return messageAge < ttlNs;
  }

  private updateMessageMetrics(processingTime: bigint, success: boolean): void {
    // Update system metrics
    if (success) {
      this.systemMetrics.messagesPerSecond++;
    }
    
    // Update average latency
    if (this.systemMetrics.averageLatency === BigInt(0)) {
      this.systemMetrics.averageLatency = processingTime;
    } else {
      this.systemMetrics.averageLatency = 
        (this.systemMetrics.averageLatency + processingTime) / BigInt(2);
    }
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkNodeHealth();
    }, 5000); // 5 second intervals
  }

  private sendHeartbeat(): void {
    const localNode = this.nodes.get(this.getLocalNodeId());
    if (localNode) {
      localNode.lastHeartbeat = process.hrtime.bigint();
      localNode.currentLoad = this.calculateCurrentLoad();
      
      this.emit('heartbeat', {
        nodeId: localNode.id,
        load: localNode.currentLoad,
        actorCount: this.actors.size
      });
    }
  }

  private checkNodeHealth(): void {
    const currentTime = process.hrtime.bigint();
    const timeoutNs = BigInt(30_000_000_000); // 30 seconds

    for (const [nodeId, node] of this.nodes) {
      if (nodeId === this.getLocalNodeId()) continue;

      const timeSinceHeartbeat = currentTime - node.lastHeartbeat;
      if (timeSinceHeartbeat > timeoutNs) {
        node.status = 'offline';
        this.emit('nodeOffline', { nodeId, timeSinceHeartbeat });
      }
    }
  }

  private calculateCurrentLoad(): number {
    let totalLoad = 0;
    for (const actor of this.actors.values()) {
      totalLoad += actor.load;
    }
    return Math.min(totalLoad / 100, 1.0); // Normalize to 0-1
  }

  private updateSystemMetrics(): void {
    this.systemMetrics.totalNodes = this.nodes.size;
    this.systemMetrics.activeActors = this.actors.size;
    this.systemMetrics.memoryUsage = process.memoryUsage().heapUsed;
    
    // Calculate error rate
    let totalErrors = 0;
    let totalMessages = 0;
    
    for (const actor of this.actors.values()) {
      totalErrors += actor.metrics.errorCount;
      totalMessages += actor.metrics.messagesProcessed;
    }
    
    this.systemMetrics.errorRate = totalMessages > 0 ? totalErrors / totalMessages : 0;
  }

  private async deliverLocalMessage(message: BitMessage): Promise<void> {
    this.messageQueue.push(message);
  }

  private async deliverRemoteMessage(message: BitMessage, nodeId: string): Promise<void> {
    await this.sendNodeMessage(nodeId, {
      type: 'deliver-message',
      message
    });
  }

  private async findActorLocation(actorId: string): Promise<{nodeId: string; actorId: string} | null> {
    // Check local actors first
    if (this.actors.has(actorId)) {
      return { nodeId: this.getLocalNodeId(), actorId };
    }

    // Query other nodes (simplified)
    for (const node of this.nodes.values()) {
      if (node.actors.has(actorId)) {
        return { nodeId: node.id, actorId };
      }
    }

    return null;
  }

  private findActorsByType(type: string): BitActor[] {
    return Array.from(this.actors.values()).filter(actor => actor.type === type);
  }

  private async decomposeTask(task: DistributedTask): Promise<Subtask[]> {
    // Implementation depends on task type
    return task.subtasks || [];
  }

  private async selectOptimalActor(subtask: Subtask): Promise<BitActor> {
    const compatibleActors = Array.from(this.actors.values()).filter(actor =>
      subtask.requiredCapabilities.every(cap => actor.capabilities.includes(cap))
    );

    if (compatibleActors.length === 0) {
      throw new Error(`No compatible actors found for subtask ${subtask.id}`);
    }

    // Select actor with lowest load
    return compatibleActors.reduce((best, current) => 
      current.load < best.load ? current : best
    );
  }

  private async executeSubtask(actor: BitActor, subtask: Subtask): Promise<SubtaskResult> {
    return actor.executeSubtask(subtask);
  }

  private async combineResults(results: SubtaskResult[], task: DistributedTask): Promise<TaskResult> {
    // Implementation depends on task type
    return {
      id: task.id,
      status: 'completed',
      data: results,
      timestamp: process.hrtime.bigint()
    };
  }

  private async broadcastShutdown(): Promise<void> {
    const shutdownMessage = {
      type: 'node-shutdown',
      nodeId: this.getLocalNodeId(),
      timestamp: process.hrtime.bigint()
    };

    for (const nodeId of this.nodes.keys()) {
      if (nodeId !== this.getLocalNodeId()) {
        try {
          await this.sendNodeMessage(nodeId, shutdownMessage);
        } catch (error) {
          // Ignore errors during shutdown
        }
      }
    }
  }

  /**
   * Get system metrics
   */
  getMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get node information
   */
  getNodes(): ProcessingNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get actor information
   */
  getActors(): ActorState[] {
    return Array.from(this.actors.values()).map(actor => actor.getState());
  }
}

/**
 * Individual Bit Actor
 */
export class BitActor extends EventEmitter {
  public id: string;
  public type: string;
  public capabilities: string[];
  public load: number = 0;
  public metrics: ActorMetrics;
  private system: BitActorSystem;
  private isShutdown: boolean = false;
  private memory: ActorMemory;

  constructor(config: BitActorOptions) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.capabilities = config.capabilities;
    this.system = config.system;
    this.metrics = this.initializeMetrics();
    this.memory = this.initializeMemory();
  }

  private initializeMetrics(): ActorMetrics {
    return {
      messagesProcessed: 0,
      messagesDropped: 0,
      averageLatency: BigInt(0),
      errorCount: 0,
      throughput: 0,
      uptime: process.hrtime.bigint()
    };
  }

  private initializeMemory(): ActorMemory {
    return {
      allocated: 0,
      used: 0,
      peak: 0,
      gcCount: 0,
      fragments: 0
    };
  }

  async initialize(): Promise<void> {
    this.metrics.uptime = process.hrtime.bigint();
    this.emit('initialized', { actorId: this.id });
  }

  async receiveMessage(message: BitMessage): Promise<void> {
    if (this.isShutdown) {
      this.metrics.messagesDropped++;
      return;
    }

    const startTime = process.hrtime.bigint();

    try {
      await this.processMessage(message);
      
      const processingTime = process.hrtime.bigint() - startTime;
      this.updateMetrics(processingTime, true);

    } catch (error) {
      const processingTime = process.hrtime.bigint() - startTime;
      this.updateMetrics(processingTime, false);
      this.emit('error', { actorId: this.id, error });
    }
  }

  private async processMessage(message: BitMessage): Promise<void> {
    // Process message based on type
    switch (message.type) {
      case 'compute':
        await this.handleComputeMessage(message);
        break;
      case 'data':
        await this.handleDataMessage(message);
        break;
      case 'control':
        await this.handleControlMessage(message);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    this.emit('messageProcessed', { actorId: this.id, messageId: message.id });
  }

  private async handleComputeMessage(message: BitMessage): Promise<void> {
    // Perform bit-level computation
    const data = message.payload;
    const result = this.performBitComputation(data);
    
    // Send result back
    if (message.source) {
      await this.system.sendMessage(message.source, {
        type: 'compute-result',
        payload: result,
        priority: message.priority,
        target: message.source,
        ttl: message.ttl
      });
    }
  }

  private async handleDataMessage(message: BitMessage): Promise<void> {
    // Store or process data
    this.updateMemoryUsage(message.payload.length);
  }

  private async handleControlMessage(message: BitMessage): Promise<void> {
    // Handle control commands
    const command = message.payload.toString();
    
    switch (command) {
      case 'pause':
        this.load = 0;
        break;
      case 'resume':
        this.load = 0.5;
        break;
      case 'status':
        // Send status back
        break;
    }
  }

  private performBitComputation(data: Buffer | Uint8Array): Buffer {
    // Example bit-level computation (XOR with pattern)
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = Buffer.alloc(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      result[i] = buffer[i] ^ 0xAA; // XOR with 10101010 pattern
    }
    
    return result;
  }

  private updateMetrics(processingTime: bigint, success: boolean): void {
    this.metrics.messagesProcessed++;
    
    if (!success) {
      this.metrics.errorCount++;
    }

    // Update average latency
    if (this.metrics.averageLatency === BigInt(0)) {
      this.metrics.averageLatency = processingTime;
    } else {
      const total = this.metrics.averageLatency * BigInt(this.metrics.messagesProcessed - 1) + processingTime;
      this.metrics.averageLatency = total / BigInt(this.metrics.messagesProcessed);
    }

    // Calculate throughput
    const uptime = process.hrtime.bigint() - this.metrics.uptime;
    const uptimeSeconds = Number(uptime) / 1_000_000_000;
    this.metrics.throughput = this.metrics.messagesProcessed / uptimeSeconds;
  }

  private updateMemoryUsage(bytes: number): void {
    this.memory.used += bytes;
    
    if (this.memory.used > this.memory.peak) {
      this.memory.peak = this.memory.used;
    }

    // Update load based on memory usage
    this.load = Math.min(this.memory.used / this.memory.allocated, 1.0);
  }

  async executeSubtask(subtask: Subtask): Promise<SubtaskResult> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Execute subtask computation
      const result = await this.computeSubtask(subtask);
      
      const processingTime = process.hrtime.bigint() - startTime;
      
      return {
        id: subtask.id,
        status: 'completed',
        data: result,
        processingTime,
        actorId: this.id
      };

    } catch (error) {
      const processingTime = process.hrtime.bigint() - startTime;
      
      return {
        id: subtask.id,
        status: 'failed',
        error: error.message,
        processingTime,
        actorId: this.id
      };
    }
  }

  private async computeSubtask(subtask: Subtask): Promise<any> {
    // Implementation depends on subtask type
    switch (subtask.type) {
      case 'bit-manipulation':
        return this.performBitManipulation(subtask.data);
      case 'hash-computation':
        return this.performHashComputation(subtask.data);
      case 'encryption':
        return this.performEncryption(subtask.data);
      default:
        throw new Error(`Unknown subtask type: ${subtask.type}`);
    }
  }

  private performBitManipulation(data: any): Buffer {
    // Bit manipulation operations
    return Buffer.from('bit-manipulation-result');
  }

  private performHashComputation(data: any): string {
    // Hash computation
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private performEncryption(data: any): Buffer {
    // Encryption operations
    return Buffer.from('encrypted-result');
  }

  async serialize(): Promise<Buffer> {
    const state = {
      id: this.id,
      type: this.type,
      capabilities: this.capabilities,
      metrics: this.metrics,
      memory: this.memory
    };

    return Buffer.from(JSON.stringify(state));
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;
    this.emit('shutdown', { actorId: this.id });
  }

  getState(): ActorState {
    return {
      id: this.id,
      type: this.type,
      status: this.isShutdown ? 'shutdown' : this.load > 0.8 ? 'busy' : 'idle',
      capabilities: this.capabilities,
      load: this.load,
      memory: { ...this.memory },
      metrics: { ...this.metrics },
      lastActivity: process.hrtime.bigint()
    };
  }
}

// Type definitions
export interface BitActorConfig {
  nodeId?: string;
  host?: string;
  port?: number;
  capacity?: number;
  strategy?: DistributionStrategy;
}

export interface BitActorOptions {
  id: string;
  type: string;
  capabilities: string[];
  system: BitActorSystem;
}

export interface SystemMetrics {
  totalNodes: number;
  activeActors: number;
  messagesPerSecond: number;
  averageLatency: bigint;
  errorRate: number;
  memoryUsage: number;
  networkLatency: bigint;
  startTime: bigint;
}

export interface DistributedTask {
  id: string;
  type: string;
  data: any;
  subtasks?: Subtask[];
  requiredCapabilities: string[];
  priority: number;
}

export interface Subtask {
  id: string;
  type: string;
  data: any;
  requiredCapabilities: string[];
}

export interface SubtaskResult {
  id: string;
  status: 'completed' | 'failed';
  data?: any;
  error?: string;
  processingTime: bigint;
  actorId: string;
}

export interface TaskResult {
  id: string;
  status: 'completed' | 'failed';
  data: any;
  timestamp: bigint;
}

// Factory functions
export function createBitActorSystem(config?: BitActorConfig): BitActorSystem {
  return new BitActorSystem(config);
}

// Export default instance
export const bitActorSystem = createBitActorSystem({
  capacity: 1000,
  strategy: { type: 'weighted', parameters: {} }
});