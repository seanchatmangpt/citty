/**
 * Swarm Intelligence Test Coordinator
 * Distributed test execution with emergent behaviors
 */

import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import { Logger } from '../utils/logger.js';
import { SwarmNode, SwarmTask, SwarmMetrics, EmergentBehavior } from '../types/swarm-types.js';

export class SwarmCoordinator extends EventEmitter {
  private nodes: Map<string, SwarmNode> = new Map();
  private tasks: Map<string, SwarmTask> = new Map();
  private wsServer: WebSocketServer;
  private logger: Logger;
  private behaviorsDetected: EmergentBehavior[] = [];
  private metricsHistory: SwarmMetrics[] = [];

  constructor(port: number = 8080) {
    super();
    this.logger = new Logger('SwarmCoordinator');
    this.wsServer = new WebSocketServer({ port });
    this.setupWebSocketHandlers();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Swarm Coordinator');
    this.startMetricsCollection();
    this.startBehaviorAnalysis();
    this.logger.info('Swarm Coordinator initialized');
  }

  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws, request) => {
      const nodeId = this.generateNodeId();
      this.logger.info(`New swarm node connected: ${nodeId}`);

      const node: SwarmNode = {
        id: nodeId,
        ws,
        status: 'idle',
        capabilities: [],
        currentTasks: [],
        performance: {
          completedTasks: 0,
          averageExecutionTime: 0,
          successRate: 1.0,
          load: 0
        },
        lastSeen: new Date(),
        metadata: {}
      };

      this.nodes.set(nodeId, node);
      
      ws.on('message', (data) => {
        this.handleNodeMessage(nodeId, data);
      });

      ws.on('close', () => {
        this.logger.info(`Swarm node disconnected: ${nodeId}`);
        this.nodes.delete(nodeId);
        this.redistributeTasksFromNode(nodeId);
      });

      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for node ${nodeId}:`, error);
      });

      // Request node capabilities
      this.sendToNode(nodeId, {
        type: 'capabilities_request'
      });
    });
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleNodeMessage(nodeId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      const node = this.nodes.get(nodeId);
      
      if (!node) return;

      switch (message.type) {
        case 'capabilities_response':
          this.handleCapabilitiesResponse(nodeId, message.capabilities);
          break;
          
        case 'task_completed':
          this.handleTaskCompleted(nodeId, message);
          break;
          
        case 'task_failed':
          this.handleTaskFailed(nodeId, message);
          break;
          
        case 'performance_update':
          this.updateNodePerformance(nodeId, message.metrics);
          break;
          
        case 'collaboration_request':
          this.handleCollaborationRequest(nodeId, message);
          break;
          
        case 'knowledge_share':
          this.handleKnowledgeShare(nodeId, message);
          break;
          
        default:
          this.logger.warn(`Unknown message type from node ${nodeId}: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message from node ${nodeId}:`, error);
    }
  }

  private handleCapabilitiesResponse(nodeId: string, capabilities: string[]): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.capabilities = capabilities;
      node.status = 'idle';
      this.logger.info(`Node ${nodeId} capabilities: ${capabilities.join(', ')}`);
      
      // Assign pending tasks that match capabilities
      this.assignPendingTasks(nodeId);
    }
  }

  private handleTaskCompleted(nodeId: string, message: any): void {
    const node = this.nodes.get(nodeId);
    const task = this.tasks.get(message.taskId);
    
    if (node && task) {
      // Update node performance
      node.performance.completedTasks++;
      node.performance.averageExecutionTime = 
        (node.performance.averageExecutionTime * (node.performance.completedTasks - 1) + message.executionTime) 
        / node.performance.completedTasks;
      
      // Remove task from node
      node.currentTasks = node.currentTasks.filter(t => t !== message.taskId);
      node.load = node.currentTasks.length;
      
      // Update task status
      task.status = 'completed';
      task.result = message.result;
      task.completedAt = new Date();
      
      this.logger.info(`Task ${message.taskId} completed by node ${nodeId}`);
      
      // Notify listeners
      this.emit('task_completed', { nodeId, taskId: message.taskId, result: message.result });
      
      // Share knowledge with other nodes
      this.shareTaskKnowledge(message.taskId, message.result);
    }
  }

  private handleTaskFailed(nodeId: string, message: any): void {
    const node = this.nodes.get(nodeId);
    const task = this.tasks.get(message.taskId);
    
    if (node && task) {
      // Update node performance
      const totalTasks = node.performance.completedTasks + 1;
      node.performance.successRate = 
        (node.performance.successRate * node.performance.completedTasks) / totalTasks;
      
      // Remove task from node
      node.currentTasks = node.currentTasks.filter(t => t !== message.taskId);
      node.load = node.currentTasks.length;
      
      // Attempt to reassign task to another node
      task.attempts++;
      if (task.attempts < task.maxAttempts) {
        task.status = 'pending';
        this.reassignTask(message.taskId, nodeId);
      } else {
        task.status = 'failed';
        task.error = message.error;
        this.logger.error(`Task ${message.taskId} failed after ${task.attempts} attempts`);
        this.emit('task_failed', { taskId: message.taskId, error: message.error });
      }
    }
  }

  private updateNodePerformance(nodeId: string, metrics: any): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      Object.assign(node.performance, metrics);
      node.lastSeen = new Date();
    }
  }

  private handleCollaborationRequest(nodeId: string, message: any): void {
    // Find suitable collaboration partners
    const requestingNode = this.nodes.get(nodeId);
    const task = this.tasks.get(message.taskId);
    
    if (!requestingNode || !task) return;
    
    const collaborators = this.findCollaborators(nodeId, message.requirements);
    
    if (collaborators.length > 0) {
      // Create collaboration group
      const collaborationId = this.generateCollaborationId();
      
      // Notify all collaborators
      collaborators.forEach(collaboratorId => {
        this.sendToNode(collaboratorId, {
          type: 'collaboration_invite',
          collaborationId,
          taskId: message.taskId,
          initiator: nodeId,
          requirements: message.requirements
        });
      });
      
      this.logger.info(`Collaboration group ${collaborationId} formed for task ${message.taskId}`);
    }
  }

  private findCollaborators(requestingNodeId: string, requirements: any): string[] {
    const collaborators: string[] = [];
    
    for (const [nodeId, node] of this.nodes) {
      if (nodeId !== requestingNodeId && 
          node.status === 'idle' && 
          this.nodeMatchesRequirements(node, requirements)) {
        collaborators.push(nodeId);
      }
    }
    
    return collaborators.slice(0, requirements.maxCollaborators || 3);
  }

  private nodeMatchesRequirements(node: SwarmNode, requirements: any): boolean {
    if (requirements.capabilities) {
      return requirements.capabilities.every((cap: string) => 
        node.capabilities.includes(cap)
      );
    }
    
    if (requirements.minPerformance) {
      return node.performance.successRate >= requirements.minPerformance;
    }
    
    return true;
  }

  private generateCollaborationId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private handleKnowledgeShare(nodeId: string, message: any): void {
    // Distribute knowledge to relevant nodes
    const relevantNodes = this.findRelevantNodes(message.knowledge);
    
    relevantNodes.forEach(targetNodeId => {
      if (targetNodeId !== nodeId) {
        this.sendToNode(targetNodeId, {
          type: 'knowledge_received',
          source: nodeId,
          knowledge: message.knowledge
        });
      }
    });
    
    this.logger.info(`Knowledge shared from node ${nodeId} to ${relevantNodes.length} nodes`);
  }

  private findRelevantNodes(knowledge: any): string[] {
    const relevant: string[] = [];
    
    for (const [nodeId, node] of this.nodes) {
      // Determine relevance based on capabilities and current tasks
      if (this.isKnowledgeRelevant(node, knowledge)) {
        relevant.push(nodeId);
      }
    }
    
    return relevant;
  }

  private isKnowledgeRelevant(node: SwarmNode, knowledge: any): boolean {
    // Simple relevance check - would be more sophisticated in production
    if (knowledge.type === 'test_pattern' && node.capabilities.includes('pattern_analysis')) {
      return true;
    }
    
    if (knowledge.type === 'performance_optimization' && node.capabilities.includes('performance_testing')) {
      return true;
    }
    
    return false;
  }

  async distributeTask(task: SwarmTask): Promise<void> {
    this.tasks.set(task.id, task);
    this.logger.info(`Distributing task: ${task.id}`);
    
    // Find optimal node for task
    const optimalNode = this.findOptimalNode(task);
    
    if (optimalNode) {
      await this.assignTaskToNode(task.id, optimalNode.id);
    } else {
      // No suitable node available, queue task
      task.status = 'queued';
      this.logger.warn(`No suitable node found for task ${task.id}, queuing`);
    }
  }

  private findOptimalNode(task: SwarmTask): SwarmNode | null {
    let bestNode: SwarmNode | null = null;
    let bestScore = -1;
    
    for (const [nodeId, node] of this.nodes) {
      if (node.status !== 'idle' && node.status !== 'busy') continue;
      
      // Check if node has required capabilities
      const hasCapabilities = task.requiredCapabilities.every(cap => 
        node.capabilities.includes(cap)
      );
      
      if (!hasCapabilities) continue;
      
      // Calculate node score based on multiple factors
      const score = this.calculateNodeScore(node, task);
      
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
    
    return bestNode;
  }

  private calculateNodeScore(node: SwarmNode, task: SwarmTask): number {
    let score = 0;
    
    // Performance factors
    score += node.performance.successRate * 40; // Success rate (0-40 points)
    score += Math.max(0, 20 - node.performance.averageExecutionTime / 1000) * 2; // Speed (0-40 points)
    score += Math.max(0, 10 - node.load) * 2; // Load factor (0-20 points)
    
    // Task-specific bonuses
    if (task.priority === 'high') {
      score *= 1.2; // Boost score for high priority tasks
    }
    
    // Capability matching bonus
    const capabilityMatch = task.requiredCapabilities.filter(cap => 
      node.capabilities.includes(cap)
    ).length / task.requiredCapabilities.length;
    score += capabilityMatch * 10;
    
    return score;
  }

  private async assignTaskToNode(taskId: string, nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    const task = this.tasks.get(taskId);
    
    if (!node || !task) return;
    
    // Update node state
    node.currentTasks.push(taskId);
    node.load = node.currentTasks.length;
    node.status = node.load > 3 ? 'busy' : 'working';
    
    // Update task state
    task.status = 'executing';
    task.assignedNode = nodeId;
    task.startedAt = new Date();
    
    // Send task to node
    this.sendToNode(nodeId, {
      type: 'task_assignment',
      task: {
        id: task.id,
        type: task.type,
        data: task.data,
        requirements: task.requirements,
        deadline: task.deadline
      }
    });
    
    this.logger.info(`Task ${taskId} assigned to node ${nodeId}`);
  }

  private assignPendingTasks(nodeId: string): void {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending' || task.status === 'queued');
    
    for (const task of pendingTasks) {
      if (this.findOptimalNode(task)?.id === nodeId) {
        this.assignTaskToNode(task.id, nodeId);
        break; // Assign one task at a time
      }
    }
  }

  private reassignTask(taskId: string, excludeNodeId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    // Find alternative node
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => 
        node.id !== excludeNodeId &&
        (node.status === 'idle' || node.status === 'working') &&
        task.requiredCapabilities.every(cap => node.capabilities.includes(cap))
      );
    
    if (availableNodes.length > 0) {
      const optimalNode = availableNodes.reduce((best, current) => 
        this.calculateNodeScore(current, task) > this.calculateNodeScore(best, task) ? current : best
      );
      
      this.assignTaskToNode(taskId, optimalNode.id);
      this.logger.info(`Task ${taskId} reassigned from ${excludeNodeId} to ${optimalNode.id}`);
    }
  }

  private redistributeTasksFromNode(disconnectedNodeId: string): void {
    // Find tasks that were assigned to the disconnected node
    const orphanedTasks = Array.from(this.tasks.values())
      .filter(task => task.assignedNode === disconnectedNodeId && task.status === 'executing');
    
    orphanedTasks.forEach(task => {
      task.status = 'pending';
      task.assignedNode = undefined;
      task.attempts++;
      
      this.reassignTask(task.id, disconnectedNodeId);
    });
    
    if (orphanedTasks.length > 0) {
      this.logger.info(`Redistributed ${orphanedTasks.length} tasks from disconnected node ${disconnectedNodeId}`);
    }
  }

  private shareTaskKnowledge(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    // Extract learnings from task execution
    const knowledge = this.extractKnowledge(task, result);
    
    if (knowledge) {
      // Broadcast knowledge to relevant nodes
      const relevantNodes = this.findRelevantNodesForTask(task);
      
      relevantNodes.forEach(nodeId => {
        this.sendToNode(nodeId, {
          type: 'knowledge_update',
          taskType: task.type,
          knowledge
        });
      });
    }
  }

  private extractKnowledge(task: SwarmTask, result: any): any | null {
    // Extract learnings and patterns from successful task execution
    if (result.success && result.insights) {
      return {
        type: 'task_execution_pattern',
        taskType: task.type,
        executionTime: result.executionTime,
        insights: result.insights,
        bestPractices: result.bestPractices,
        timestamp: new Date()
      };
    }
    
    return null;
  }

  private findRelevantNodesForTask(task: SwarmTask): string[] {
    return Array.from(this.nodes.keys()).filter(nodeId => {
      const node = this.nodes.get(nodeId);
      return node && task.requiredCapabilities.some(cap => node.capabilities.includes(cap));
    });
  }

  private sendToNode(nodeId: string, message: any): void {
    const node = this.nodes.get(nodeId);
    if (node && node.ws.readyState === 1) { // WebSocket.OPEN
      node.ws.send(JSON.stringify(message));
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const metrics = this.collectSwarmMetrics();
      this.metricsHistory.push(metrics);
      
      // Keep only last 1000 metrics entries
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory.shift();
      }
      
      this.emit('metrics_updated', metrics);
    }, 5000); // Collect metrics every 5 seconds
  }

  private collectSwarmMetrics(): SwarmMetrics {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.status !== 'disconnected');
    const totalTasks = this.tasks.size;
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
    const failedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'failed').length;
    const executingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'executing').length;
    
    const totalLoad = activeNodes.reduce((sum, node) => sum + node.load, 0);
    const averageSuccessRate = activeNodes.length > 0 
      ? activeNodes.reduce((sum, node) => sum + node.performance.successRate, 0) / activeNodes.length 
      : 0;
    
    return {
      timestamp: new Date(),
      nodeCount: activeNodes.length,
      totalTasks,
      completedTasks,
      failedTasks,
      executingTasks,
      averageLoad: activeNodes.length > 0 ? totalLoad / activeNodes.length : 0,
      averageSuccessRate,
      throughput: this.calculateThroughput(),
      emergentBehaviors: this.behaviorsDetected.length
    };
  }

  private calculateThroughput(): number {
    // Calculate tasks completed per minute over last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCompletions = Array.from(this.tasks.values())
      .filter(task => 
        task.status === 'completed' && 
        task.completedAt && 
        task.completedAt > fiveMinutesAgo
      ).length;
    
    return recentCompletions / 5; // Tasks per minute
  }

  private startBehaviorAnalysis(): void {
    setInterval(() => {
      this.analyzeBehaviors();
    }, 30000); // Analyze every 30 seconds
  }

  private analyzeBehaviors(): void {
    // Detect emergent behaviors in the swarm
    this.detectCollaborativeLearning();
    this.detectSelfOrganization();
    this.detectOptimalLoadBalancing();
    this.detectKnowledgeEmergence();
  }

  private detectCollaborativeLearning(): void {
    // Detect if nodes are learning from each other
    const collaborativePatterns = this.identifyCollaborativePatterns();
    
    if (collaborativePatterns.length > 0) {
      const behavior: EmergentBehavior = {
        type: 'collaborative_learning',
        description: 'Nodes are sharing knowledge and improving collectively',
        strength: collaborativePatterns.length / this.nodes.size,
        participants: collaborativePatterns.flatMap(p => p.nodes),
        detectedAt: new Date(),
        evidence: collaborativePatterns
      };
      
      this.behaviorsDetected.push(behavior);
      this.logger.info(`Emergent behavior detected: ${behavior.type}`);
    }
  }

  private identifyCollaborativePatterns(): any[] {
    // Simplified pattern detection - would be more sophisticated in production
    const patterns: any[] = [];
    
    // Look for nodes that frequently collaborate
    const collaborations = new Map<string, Set<string>>();
    
    // This would track actual collaboration history in a real implementation
    for (const [nodeId, node] of this.nodes) {
      if (!collaborations.has(nodeId)) {
        collaborations.set(nodeId, new Set());
      }
    }
    
    return patterns;
  }

  private detectSelfOrganization(): void {
    // Detect if the swarm is self-organizing for optimal task distribution
    const organizationMetrics = this.calculateOrganizationMetrics();
    
    if (organizationMetrics.entropy < 0.3 && organizationMetrics.efficiency > 0.8) {
      const behavior: EmergentBehavior = {
        type: 'self_organization',
        description: 'Swarm is self-organizing for optimal task distribution',
        strength: organizationMetrics.efficiency,
        participants: Array.from(this.nodes.keys()),
        detectedAt: new Date(),
        evidence: { organizationMetrics }
      };
      
      this.behaviorsDetected.push(behavior);
    }
  }

  private calculateOrganizationMetrics(): any {
    // Calculate entropy and efficiency metrics
    const loads = Array.from(this.nodes.values()).map(n => n.load);
    const maxLoad = Math.max(...loads, 1);
    const normalizedLoads = loads.map(l => l / maxLoad);
    
    // Calculate entropy (measure of randomness/disorder)
    const entropy = -normalizedLoads.reduce((sum, p) => {
      if (p > 0) {
        return sum + p * Math.log2(p);
      }
      return sum;
    }, 0);
    
    // Calculate efficiency (how well distributed the load is)
    const mean = normalizedLoads.reduce((sum, l) => sum + l, 0) / normalizedLoads.length;
    const variance = normalizedLoads.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / normalizedLoads.length;
    const efficiency = 1 - Math.sqrt(variance); // Lower variance = higher efficiency
    
    return { entropy: entropy / Math.log2(normalizedLoads.length), efficiency };
  }

  private detectOptimalLoadBalancing(): void {
    // Detect if load is being balanced optimally
    const loadVariance = this.calculateLoadVariance();
    
    if (loadVariance < 0.1) { // Low variance indicates good load balancing
      const behavior: EmergentBehavior = {
        type: 'optimal_load_balancing',
        description: 'Swarm has achieved optimal load balancing',
        strength: 1 - loadVariance,
        participants: Array.from(this.nodes.keys()),
        detectedAt: new Date(),
        evidence: { loadVariance }
      };
      
      this.behaviorsDetected.push(behavior);
    }
  }

  private calculateLoadVariance(): number {
    const loads = Array.from(this.nodes.values()).map(n => n.load);
    const mean = loads.reduce((sum, l) => sum + l, 0) / loads.length;
    const variance = loads.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / loads.length;
    return variance / Math.max(mean, 1); // Normalized variance
  }

  private detectKnowledgeEmergence(): void {
    // Detect emergence of collective knowledge
    // This would track knowledge sharing patterns and collective intelligence indicators
    // Simplified for demo purposes
    
    if (this.nodes.size > 3) {
      const behavior: EmergentBehavior = {
        type: 'knowledge_emergence',
        description: 'Collective intelligence emerging from node interactions',
        strength: Math.min(1, this.nodes.size / 10),
        participants: Array.from(this.nodes.keys()),
        detectedAt: new Date(),
        evidence: { nodeCount: this.nodes.size }
      };
      
      this.behaviorsDetected.push(behavior);
    }
  }

  async getSwarmStatus(): Promise<any> {
    const metrics = this.collectSwarmMetrics();
    
    return {
      metrics,
      nodes: Array.from(this.nodes.values()).map(node => ({
        id: node.id,
        status: node.status,
        capabilities: node.capabilities,
        performance: node.performance,
        load: node.load,
        currentTasks: node.currentTasks.length
      })),
      tasks: {
        total: this.tasks.size,
        byStatus: this.getTasksByStatus()
      },
      emergentBehaviors: this.behaviorsDetected.slice(-10), // Last 10 behaviors
      healthScore: this.calculateHealthScore()
    };
  }

  private getTasksByStatus(): { [status: string]: number } {
    const statusCounts: { [status: string]: number } = {};
    
    for (const task of this.tasks.values()) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }
    
    return statusCounts;
  }

  private calculateHealthScore(): number {
    const metrics = this.collectSwarmMetrics();
    
    let score = 0;
    score += metrics.nodeCount > 0 ? 25 : 0; // Nodes available
    score += metrics.averageSuccessRate * 25; // Success rate
    score += Math.min(25, metrics.throughput * 5); // Throughput
    score += metrics.averageLoad < 5 ? 25 : Math.max(0, 25 - (metrics.averageLoad - 5) * 2); // Load balance
    
    return score;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Swarm Coordinator');
    
    // Notify all nodes of shutdown
    for (const [nodeId, node] of this.nodes) {
      this.sendToNode(nodeId, { type: 'shutdown' });
    }
    
    // Close WebSocket server
    this.wsServer.close();
    
    this.logger.info('Swarm Coordinator shutdown complete');
  }
}