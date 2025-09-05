/**
 * Multi-Agent Communication Protocol System
 * Production-grade message passing and coordination protocols for HIVE QUEEN
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';

// Core Message Types
export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[]; // Single recipient or broadcast
  type: MessageType;
  payload: any;
  timestamp: number;
  priority: MessagePriority;
  requiresAck?: boolean;
  correlationId?: string;
  ttl?: number; // Time to live in ms
}

export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_COMPLETE = 'task_complete',
  STATUS_UPDATE = 'status_update',
  RESOURCE_REQUEST = 'resource_request',
  RESOURCE_GRANT = 'resource_grant',
  CONSENSUS_PROPOSAL = 'consensus_proposal',
  CONSENSUS_VOTE = 'consensus_vote',
  HEARTBEAT = 'heartbeat',
  ERROR_REPORT = 'error_report',
  SHUTDOWN_SIGNAL = 'shutdown_signal',
  DISCOVERY = 'discovery',
  HANDSHAKE = 'handshake',
  DATA_SYNC = 'data_sync',
  ALERT = 'alert',
  BROADCAST = 'broadcast'
}

export enum MessagePriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface CommunicationConfig {
  agentId: string;
  maxMessageQueue: number;
  ackTimeout: number;
  retryAttempts: number;
  heartbeatInterval: number;
  discoveryInterval: number;
  compressionThreshold: number;
  enableEncryption: boolean;
  messageValidator?: (message: AgentMessage) => boolean;
}

export interface AgentEndpoint {
  id: string;
  type: 'queen' | 'worker' | 'scout' | 'soldier';
  capabilities: string[];
  location: string; // Network address or process ID
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  lastSeen: number;
  load: number; // 0-1 representing current utilization
  metadata?: Record<string, any>;
}

export interface MessageRoute {
  from: string;
  to: string;
  path: string[];
  latency: number;
  reliability: number;
}

export interface QueuedMessage {
  message: AgentMessage;
  attempts: number;
  nextRetry: number;
  acknowledged: boolean;
}

export class AgentCommunicationProtocol extends EventEmitter {
  private config: CommunicationConfig;
  private messageQueue = new Map<string, QueuedMessage>();
  private agents = new Map<string, AgentEndpoint>();
  private routes = new Map<string, MessageRoute>();
  private subscriptions = new Map<string, Set<MessageType>>();
  private ackCallbacks = new Map<string, (success: boolean) => void>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private messageStats = {
    sent: 0,
    received: 0,
    dropped: 0,
    retried: 0,
    acknowledged: 0
  };

  constructor(config: CommunicationConfig) {
    super();
    this.config = config;
    this.setupProtocol();
  }

  private setupProtocol(): void {
    // Start heartbeat system
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Start agent discovery
    this.discoveryInterval = setInterval(() => {
      this.performDiscovery();
    }, this.config.discoveryInterval);

    // Setup message processing
    this.on('message', this.processMessage.bind(this));

    // Register self as agent
    this.registerAgent({
      id: this.config.agentId,
      type: 'queen', // Default, can be overridden
      capabilities: [],
      location: process.pid.toString(),
      status: 'online',
      lastSeen: Date.now(),
      load: 0
    });
  }

  /**
   * Register an agent in the communication network
   */
  registerAgent(endpoint: AgentEndpoint): void {
    this.agents.set(endpoint.id, endpoint);
    this.emit('agent_registered', endpoint);

    // Send handshake to new agent
    if (endpoint.id !== this.config.agentId) {
      this.sendMessage({
        id: this.generateMessageId(),
        from: this.config.agentId,
        to: endpoint.id,
        type: MessageType.HANDSHAKE,
        payload: {
          agentInfo: this.agents.get(this.config.agentId),
          knownAgents: Array.from(this.agents.keys())
        },
        timestamp: Date.now(),
        priority: MessagePriority.HIGH
      });
    }
  }

  /**
   * Send message to one or more agents
   */
  async sendMessage(message: AgentMessage): Promise<boolean> {
    try {
      // Validate message
      if (this.config.messageValidator && !this.config.messageValidator(message)) {
        throw new Error('Message validation failed');
      }

      // Check TTL
      if (message.ttl && (Date.now() - message.timestamp) > message.ttl) {
        this.messageStats.dropped++;
        return false;
      }

      // Handle broadcast messages
      if (Array.isArray(message.to)) {
        const results = await Promise.all(
          message.to.map(recipient => this.sendToAgent(recipient, message))
        );
        return results.every(result => result);
      } else {
        return await this.sendToAgent(message.to, message);
      }
    } catch (error) {
      console.error('[Communication] Send message error:', error);
      this.messageStats.dropped++;
      return false;
    }
  }

  private async sendToAgent(agentId: string, message: AgentMessage): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'offline') {
      // Queue message for later delivery
      this.queueMessage(message);
      return false;
    }

    try {
      // Find best route
      const route = this.findBestRoute(this.config.agentId, agentId);
      
      // Send message based on agent location/type
      await this.deliverMessage(agent, message, route);
      
      // Setup acknowledgment if required
      if (message.requiresAck) {
        this.setupAckCallback(message.id);
      }

      this.messageStats.sent++;
      this.emit('message_sent', message, agent);
      return true;
    } catch (error) {
      console.error(`[Communication] Failed to send to ${agentId}:`, error);
      this.queueMessage(message);
      return false;
    }
  }

  private async deliverMessage(
    agent: AgentEndpoint, 
    message: AgentMessage, 
    route?: MessageRoute
  ): Promise<void> {
    // Compress large messages
    let payload = message.payload;
    if (JSON.stringify(payload).length > this.config.compressionThreshold) {
      payload = this.compressData(payload);
    }

    // Encrypt if enabled
    if (this.config.enableEncryption) {
      payload = this.encryptData(payload);
    }

    // Create delivery packet
    const deliveryPacket = {
      ...message,
      payload,
      route: route?.path,
      deliveryTimestamp: Date.now()
    };

    // Simulate different delivery mechanisms based on agent type/location
    if (agent.location.startsWith('worker_thread_')) {
      // Send via worker thread
      const workerId = agent.location.replace('worker_thread_', '');
      // In real implementation, would use Worker.postMessage
      process.nextTick(() => {
        this.emit('worker_message', workerId, deliveryPacket);
      });
    } else if (agent.location.startsWith('http://')) {
      // Send via HTTP
      // In real implementation, would use fetch/axios
      process.nextTick(() => {
        this.emit('http_message', agent.location, deliveryPacket);
      });
    } else {
      // Send via IPC or process communication
      process.nextTick(() => {
        this.emit('ipc_message', agent.location, deliveryPacket);
      });
    }
  }

  private queueMessage(message: AgentMessage): void {
    if (this.messageQueue.size >= this.config.maxMessageQueue) {
      // Remove oldest low-priority message
      const oldestLowPriority = Array.from(this.messageQueue.entries())
        .filter(([_, queued]) => queued.message.priority >= MessagePriority.NORMAL)
        .sort((a, b) => a[1].message.timestamp - b[1].message.timestamp)[0];
      
      if (oldestLowPriority) {
        this.messageQueue.delete(oldestLowPriority[0]);
        this.messageStats.dropped++;
      }
    }

    this.messageQueue.set(message.id, {
      message,
      attempts: 0,
      nextRetry: Date.now() + 1000, // Retry in 1 second
      acknowledged: false
    });
  }

  private processMessage(message: AgentMessage): void {
    this.messageStats.received++;

    // Handle system messages
    switch (message.type) {
      case MessageType.HANDSHAKE:
        this.handleHandshake(message);
        break;
      case MessageType.HEARTBEAT:
        this.handleHeartbeat(message);
        break;
      case MessageType.DISCOVERY:
        this.handleDiscovery(message);
        break;
      case MessageType.CONSENSUS_PROPOSAL:
        this.handleConsensusProposal(message);
        break;
      case MessageType.CONSENSUS_VOTE:
        this.handleConsensusVote(message);
        break;
      default:
        // Forward to subscribers
        this.forwardToSubscribers(message);
    }

    // Send acknowledgment if required
    if (message.requiresAck) {
      this.sendAcknowledgment(message);
    }
  }

  private handleHandshake(message: AgentMessage): void {
    const { agentInfo, knownAgents } = message.payload;
    
    // Register the handshaking agent
    this.registerAgent(agentInfo);
    
    // Update known agents
    knownAgents.forEach((agentId: string) => {
      if (!this.agents.has(agentId) && agentId !== this.config.agentId) {
        // Request info about unknown agents
        this.requestAgentInfo(agentId);
      }
    });

    this.emit('handshake_complete', agentInfo);
  }

  private handleHeartbeat(message: AgentMessage): void {
    const agent = this.agents.get(message.from);
    if (agent) {
      agent.lastSeen = Date.now();
      agent.status = 'online';
      agent.load = message.payload.load || 0;
    }
  }

  private handleDiscovery(message: AgentMessage): void {
    // Respond with our agent info
    this.sendMessage({
      id: this.generateMessageId(),
      from: this.config.agentId,
      to: message.from,
      type: MessageType.HANDSHAKE,
      payload: {
        agentInfo: this.agents.get(this.config.agentId),
        knownAgents: Array.from(this.agents.keys())
      },
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL
    });
  }

  private handleConsensusProposal(message: AgentMessage): void {
    // Forward to consensus handler
    this.emit('consensus_proposal', message.payload, message.from);
  }

  private handleConsensusVote(message: AgentMessage): void {
    // Forward to consensus handler
    this.emit('consensus_vote', message.payload, message.from);
  }

  private forwardToSubscribers(message: AgentMessage): void {
    this.subscriptions.forEach((messageTypes, subscriberId) => {
      if (messageTypes.has(message.type)) {
        this.emit(`subscriber_${subscriberId}`, message);
      }
    });
  }

  private sendAcknowledgment(message: AgentMessage): void {
    this.sendMessage({
      id: this.generateMessageId(),
      from: this.config.agentId,
      to: message.from,
      type: MessageType.STATUS_UPDATE,
      payload: {
        acknowledged: true,
        originalMessageId: message.id
      },
      timestamp: Date.now(),
      priority: MessagePriority.HIGH
    });
  }

  private setupAckCallback(messageId: string): void {
    const timeout = setTimeout(() => {
      const callback = this.ackCallbacks.get(messageId);
      if (callback) {
        callback(false); // Timeout
        this.ackCallbacks.delete(messageId);
      }
    }, this.config.ackTimeout);

    this.ackCallbacks.set(messageId, (success: boolean) => {
      clearTimeout(timeout);
      if (success) {
        this.messageStats.acknowledged++;
      }
    });
  }

  private sendHeartbeat(): void {
    const self = this.agents.get(this.config.agentId);
    if (!self) return;

    // Broadcast heartbeat to all known agents
    const heartbeatMessage: AgentMessage = {
      id: this.generateMessageId(),
      from: this.config.agentId,
      to: Array.from(this.agents.keys()).filter(id => id !== this.config.agentId),
      type: MessageType.HEARTBEAT,
      payload: {
        load: self.load,
        status: self.status,
        capabilities: self.capabilities
      },
      timestamp: Date.now(),
      priority: MessagePriority.BACKGROUND
    };

    this.sendMessage(heartbeatMessage);
  }

  private performDiscovery(): void {
    // Check for offline agents
    const now = Date.now();
    this.agents.forEach((agent, agentId) => {
      if (agentId !== this.config.agentId && 
          now - agent.lastSeen > this.config.heartbeatInterval * 3) {
        agent.status = 'offline';
        this.emit('agent_offline', agent);
      }
    });

    // Broadcast discovery message
    this.sendMessage({
      id: this.generateMessageId(),
      from: this.config.agentId,
      to: [], // Broadcast
      type: MessageType.DISCOVERY,
      payload: {
        seeking: 'all',
        timestamp: now
      },
      timestamp: now,
      priority: MessagePriority.LOW
    });
  }

  private findBestRoute(from: string, to: string): MessageRoute | undefined {
    const routeKey = `${from}->${to}`;
    return this.routes.get(routeKey);
  }

  private requestAgentInfo(agentId: string): void {
    // Implementation would request agent info from known agents
  }

  private compressData(data: any): any {
    // Simple compression simulation - in production use actual compression
    return { _compressed: true, data: JSON.stringify(data) };
  }

  private encryptData(data: any): any {
    // Simple encryption simulation - in production use actual encryption
    return { _encrypted: true, data: Buffer.from(JSON.stringify(data)).toString('base64') };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(subscriberId: string, messageTypes: MessageType[]): void {
    if (!this.subscriptions.has(subscriberId)) {
      this.subscriptions.set(subscriberId, new Set());
    }
    messageTypes.forEach(type => {
      this.subscriptions.get(subscriberId)!.add(type);
    });
  }

  /**
   * Unsubscribe from message types
   */
  unsubscribe(subscriberId: string, messageTypes?: MessageType[]): void {
    if (!messageTypes) {
      this.subscriptions.delete(subscriberId);
    } else {
      const subscription = this.subscriptions.get(subscriberId);
      if (subscription) {
        messageTypes.forEach(type => subscription.delete(type));
      }
    }
  }

  /**
   * Broadcast message to all agents
   */
  broadcast(message: Omit<AgentMessage, 'to'>): Promise<boolean> {
    return this.sendMessage({
      ...message,
      to: Array.from(this.agents.keys()).filter(id => id !== this.config.agentId)
    } as AgentMessage);
  }

  /**
   * Get communication statistics
   */
  getStats(): typeof this.messageStats & { 
    agents: number; 
    queuedMessages: number; 
    uptime: number 
  } {
    return {
      ...this.messageStats,
      agents: this.agents.size,
      queuedMessages: this.messageQueue.size,
      uptime: Date.now() - (this.agents.get(this.config.agentId)?.lastSeen || 0)
    };
  }

  /**
   * Get list of known agents
   */
  getKnownAgents(): AgentEndpoint[] {
    return Array.from(this.agents.values());
  }

  /**
   * Shutdown protocol and cleanup
   */
  async shutdown(): Promise<void> {
    // Send shutdown signal to all agents
    await this.broadcast({
      id: this.generateMessageId(),
      from: this.config.agentId,
      type: MessageType.SHUTDOWN_SIGNAL,
      payload: { reason: 'graceful_shutdown' },
      timestamp: Date.now(),
      priority: MessagePriority.CRITICAL
    });

    // Cleanup intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.discoveryInterval) clearInterval(this.discoveryInterval);

    // Clear queues and maps
    this.messageQueue.clear();
    this.agents.clear();
    this.routes.clear();
    this.subscriptions.clear();
    this.ackCallbacks.clear();

    this.emit('shutdown_complete');
  }
}

// Export types and utilities
export {
  AgentCommunicationProtocol as default,
  type AgentMessage,
  type AgentEndpoint,
  type CommunicationConfig,
  MessageType,
  MessagePriority
};