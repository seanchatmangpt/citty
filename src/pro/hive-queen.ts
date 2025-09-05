// HIVE QUEEN Orchestration System - Multi-agent coordination with consensus
import { EventEmitter } from 'events';
import type { 
  HiveQueenConfig, 
  HiveQueenOrchestrator, 
  HiveAgent, 
  AgentRole,
  Task,
  Workflow,
  RunCtx 
} from '../types/citty-pro';
import { hooks } from './hooks';

export class HiveQueenSystem extends EventEmitter implements HiveQueenOrchestrator {
  public config: HiveQueenConfig;
  public agents: Map<string, HiveAgent> = new Map();
  private taskQueue: Map<string, any> = new Map();
  private consensusVotes: Map<string, Map<string, any>> = new Map();
  private agentCounter = 0;
  
  constructor(config: HiveQueenConfig) {
    super();
    this.config = config;
    this.initialize();
  }
  
  private initialize(): void {
    // Create queen agent
    this.spawn('queen', ['orchestration', 'decision', 'consensus']);
    
    // Create initial worker pool based on topology
    const initialWorkers = Math.min(this.config.maxAgents - 1, 3);
    for (let i = 0; i < initialWorkers; i++) {
      this.spawn('worker', ['execution', 'processing']);
    }
    
    // Set up consensus mechanism if configured
    if (this.config.consensus) {
      this.spawn('coordinator', ['consensus', 'validation']);
    }
  }
  
  async spawn(role: AgentRole, capabilities: string[] = []): Promise<HiveAgent> {
    const agentId = `agent-${role}-${++this.agentCounter}`;
    
    const agent: HiveAgent = {
      id: agentId,
      role,
      capabilities: [...capabilities, ...this.getDefaultCapabilities(role)],
      status: 'idle',
      memory: {}
    };
    
    this.agents.set(agentId, agent);
    
    await hooks.callHook('workflow:compile', { id: `spawn-${agentId}` });
    
    this.emit('agent:spawned', agent);
    
    // Apply topology-specific connections
    this.connectAgent(agent);
    
    return agent;
  }
  
  private getDefaultCapabilities(role: AgentRole): string[] {
    const capabilities: Record<AgentRole, string[]> = {
      queen: ['orchestrate', 'coordinate', 'decide', 'optimize'],
      worker: ['execute', 'process', 'report'],
      scout: ['discover', 'analyze', 'explore'],
      coordinator: ['synchronize', 'validate', 'consensus'],
      specialist: ['specialized', 'expert', 'advanced']
    };
    return capabilities[role] || [];
  }
  
  private connectAgent(agent: HiveAgent): void {
    // Connect based on topology
    switch (this.config.topology) {
      case 'hierarchical':
        // Queen connects to all, workers connect to queen
        if (agent.role === 'queen') {
          // Queen sees all
          agent.memory!.connections = Array.from(this.agents.keys());
        } else {
          // Others connect to queen
          const queen = Array.from(this.agents.values()).find(a => a.role === 'queen');
          if (queen) {
            agent.memory!.connections = [queen.id];
          }
        }
        break;
        
      case 'mesh':
        // All agents connect to all others
        agent.memory!.connections = Array.from(this.agents.keys()).filter(id => id !== agent.id);
        break;
        
      case 'ring':
        // Connect to next agent in ring
        const agentIds = Array.from(this.agents.keys());
        const currentIndex = agentIds.indexOf(agent.id);
        const nextIndex = (currentIndex + 1) % agentIds.length;
        agent.memory!.connections = [agentIds[nextIndex]];
        break;
        
      case 'star':
        // All connect to central coordinator
        const coordinator = Array.from(this.agents.values()).find(a => a.role === 'coordinator' || a.role === 'queen');
        if (coordinator && coordinator.id !== agent.id) {
          agent.memory!.connections = [coordinator.id];
        }
        break;
    }
  }
  
  async assign(agentId: string, task: Task<any, any>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    if (agent.status === 'busy') {
      throw new Error(`Agent ${agentId} is busy`);
    }
    
    agent.status = 'busy';
    agent.task = task.id;
    
    this.emit('task:assigned', { agentId, taskId: task.id });
    
    try {
      // Execute task with agent context
      const ctx: RunCtx = {
        cwd: process.cwd(),
        env: process.env as Record<string, string | undefined>,
        now: () => new Date(),
        memo: agent.memory
      };
      
      const result = await task.call({}, ctx);
      
      // Store result in agent memory
      agent.memory![`task_${task.id}_result`] = result;
      
      // If consensus is required, collect votes
      if (this.config.consensus && this.requiresConsensus(task.id)) {
        await this.collectConsensusVote(agentId, task.id, result);
      }
      
      this.emit('task:completed', { agentId, taskId: task.id, result });
      
    } catch (error) {
      agent.status = 'error';
      this.emit('task:failed', { agentId, taskId: task.id, error });
      throw error;
    } finally {
      agent.status = 'idle';
      agent.task = undefined;
    }
  }
  
  private requiresConsensus(taskId: string): boolean {
    // Determine if task requires consensus based on configuration
    return this.config.consensus !== undefined && taskId.includes('critical');
  }
  
  private async collectConsensusVote(agentId: string, taskId: string, result: any): Promise<void> {
    if (!this.consensusVotes.has(taskId)) {
      this.consensusVotes.set(taskId, new Map());
    }
    
    const votes = this.consensusVotes.get(taskId)!;
    votes.set(agentId, result);
    
    // Check if we have enough votes
    const threshold = this.config.consensus?.threshold || 0.51;
    const requiredVotes = Math.ceil(this.agents.size * threshold);
    
    if (votes.size >= requiredVotes) {
      // Determine consensus result
      const consensusResult = this.determineConsensus(votes);
      this.emit('consensus:reached', { taskId, result: consensusResult });
    }
  }
  
  private determineConsensus(votes: Map<string, any>): any {
    // Simple majority consensus
    const results = Array.from(votes.values());
    const resultCounts = new Map<string, number>();
    
    for (const result of results) {
      const key = JSON.stringify(result);
      resultCounts.set(key, (resultCounts.get(key) || 0) + 1);
    }
    
    // Find the most common result
    let maxCount = 0;
    let consensusResult = null;
    
    for (const [resultKey, count] of resultCounts) {
      if (count > maxCount) {
        maxCount = count;
        consensusResult = JSON.parse(resultKey);
      }
    }
    
    return consensusResult;
  }
  
  async coordinate(workflow: Workflow<any>): Promise<any> {
    // Orchestrate workflow across agents
    const queen = Array.from(this.agents.values()).find(a => a.role === 'queen');
    if (!queen) {
      throw new Error('No queen agent available for coordination');
    }
    
    this.emit('workflow:start', { workflowId: workflow.id });
    
    // Create execution context
    const ctx: RunCtx = {
      cwd: process.cwd(),
      env: process.env as Record<string, string | undefined>,
      now: () => new Date(),
      memo: {}
    };
    
    // Distribute workflow execution based on optimization strategy
    if (this.config.optimization?.strategy === 'weighted') {
      return this.coordinateWeighted(workflow, ctx);
    } else if (this.config.optimization?.strategy === 'adaptive') {
      return this.coordinateAdaptive(workflow, ctx);
    } else {
      // Default balanced coordination
      return this.coordinateBalanced(workflow, ctx);
    }
  }
  
  private async coordinateBalanced(workflow: Workflow<any>, ctx: RunCtx): Promise<any> {
    // Simple round-robin distribution
    const availableAgents = Array.from(this.agents.values()).filter(a => a.status === 'idle' && a.role !== 'queen');
    
    if (availableAgents.length === 0) {
      // Queen does it herself
      return workflow.run(ctx);
    }
    
    // Execute workflow with load balancing
    const result = await workflow.run({
      ...ctx,
      memo: {
        ...ctx.memo,
        hive: {
          agents: availableAgents.map(a => a.id),
          topology: this.config.topology
        }
      }
    });
    
    this.emit('workflow:complete', { workflowId: workflow.id, result });
    
    return result;
  }
  
  private async coordinateWeighted(workflow: Workflow<any>, ctx: RunCtx): Promise<any> {
    // Use weighted optimization for agent selection
    const weights = this.config.optimization?.weights || {};
    const agents = Array.from(this.agents.values());
    
    // Score agents based on weights
    const scoredAgents = agents.map(agent => {
      let score = 0;
      for (const capability of agent.capabilities) {
        score += weights[capability] || 1;
      }
      return { agent, score };
    }).sort((a, b) => b.score - a.score);
    
    // Use top agents for workflow
    const topAgents = scoredAgents.slice(0, 3).map(s => s.agent);
    
    return workflow.run({
      ...ctx,
      memo: {
        ...ctx.memo,
        hive: {
          agents: topAgents.map(a => a.id),
          strategy: 'weighted'
        }
      }
    });
  }
  
  private async coordinateAdaptive(workflow: Workflow<any>, ctx: RunCtx): Promise<any> {
    // Adaptive coordination based on agent performance
    const agents = Array.from(this.agents.values());
    
    // Analyze agent performance from memory
    const performanceScores = agents.map(agent => {
      const taskCount = Object.keys(agent.memory || {}).filter(k => k.startsWith('task_')).length;
      const errorCount = agent.status === 'error' ? 1 : 0;
      const score = taskCount - (errorCount * 5); // Penalize errors heavily
      return { agent, score };
    }).sort((a, b) => b.score - a.score);
    
    // Adapt agent selection based on performance
    const topPerformers = performanceScores.slice(0, Math.ceil(agents.length * 0.3)).map(s => s.agent);
    
    return workflow.run({
      ...ctx,
      memo: {
        ...ctx.memo,
        hive: {
          agents: topPerformers.map(a => a.id),
          strategy: 'adaptive'
        }
      }
    });
  }
  
  optimize(metrics: Record<string, number>): void {
    // Optimize hive based on metrics
    const { throughput = 0, latency = 0, errors = 0 } = metrics;
    
    // Auto-scale agents based on metrics
    if (throughput > 100 && this.agents.size < this.config.maxAgents) {
      // High throughput, spawn more workers
      this.spawn('worker', ['high-performance']);
    }
    
    if (errors > 10) {
      // High errors, spawn specialist for debugging
      this.spawn('specialist', ['error-handling', 'debugging']);
    }
    
    if (latency > 1000) {
      // High latency, optimize topology
      this.optimizeTopology();
    }
    
    this.emit('hive:optimized', { metrics, agentCount: this.agents.size });
  }
  
  private optimizeTopology(): void {
    // Switch to more efficient topology based on current state
    const currentSize = this.agents.size;
    
    if (currentSize > 10 && this.config.topology === 'mesh') {
      // Too many agents for mesh, switch to hierarchical
      this.config.topology = 'hierarchical';
      this.reconnectAllAgents();
    } else if (currentSize < 5 && this.config.topology === 'hierarchical') {
      // Few agents, mesh is more efficient
      this.config.topology = 'mesh';
      this.reconnectAllAgents();
    }
  }
  
  private reconnectAllAgents(): void {
    for (const agent of this.agents.values()) {
      this.connectAgent(agent);
    }
  }
  
  async shutdown(): Promise<void> {
    this.emit('hive:shutdown:start');
    
    // Gracefully stop all agents
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'busy' && agent.task) {
        // Wait for task completion
        await new Promise(resolve => {
          this.once(`task:completed`, (data) => {
            if (data.agentId === agentId) resolve(undefined);
          });
          
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        });
      }
      
      this.agents.delete(agentId);
      this.emit('agent:terminated', { agentId });
    }
    
    this.taskQueue.clear();
    this.consensusVotes.clear();
    this.removeAllListeners();
    
    this.emit('hive:shutdown:complete');
  }
  
  // Helper methods for monitoring
  getMetrics(): Record<string, any> {
    const agents = Array.from(this.agents.values());
    return {
      totalAgents: agents.length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      topology: this.config.topology,
      consensusEnabled: !!this.config.consensus,
      optimizationStrategy: this.config.optimization?.strategy || 'balanced'
    };
  }
}

export function createHiveQueen(config: HiveQueenConfig): HiveQueenOrchestrator {
  return new HiveQueenSystem(config);
}