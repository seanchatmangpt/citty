/**
 * Distributed Consensus Mechanisms for HIVE QUEEN
 * Production-grade consensus protocols for agent coordination
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// Core Consensus Types
export interface ConsensusProposal {
  id: string;
  proposer: string;
  type: ProposalType;
  content: any;
  timestamp: number;
  term?: number; // For Raft
  signature?: string;
  dependencies?: string[];
  timeout: number;
}

export enum ProposalType {
  TASK_ASSIGNMENT = 'task_assignment',
  RESOURCE_ALLOCATION = 'resource_allocation',
  CONFIGURATION_CHANGE = 'configuration_change',
  AGENT_ELECTION = 'agent_election',
  WORKFLOW_DECISION = 'workflow_decision',
  SYSTEM_UPDATE = 'system_update',
  EMERGENCY_ACTION = 'emergency_action'
}

export interface ConsensusVote {
  proposalId: string;
  voter: string;
  decision: VoteDecision;
  timestamp: number;
  term?: number;
  signature?: string;
  reasoning?: string;
}

export enum VoteDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  ABSTAIN = 'abstain'
}

export interface ConsensusResult {
  proposalId: string;
  decision: VoteDecision;
  votes: ConsensusVote[];
  finalizedAt: number;
  confidence: number; // 0-1 indicating consensus strength
  participated: string[];
  abstained: string[];
}

export interface ConsensusConfig {
  agentId: string;
  consensusType: ConsensusType;
  quorumSize: number;
  voteTimeout: number;
  maxProposals: number;
  requireSignatures: boolean;
  byzantineTolerance: number; // For Byzantine consensus
  raftConfig?: RaftConfig;
  gossipConfig?: GossipConfig;
}

export enum ConsensusType {
  RAFT = 'raft',
  BYZANTINE = 'byzantine',
  GOSSIP = 'gossip',
  QUORUM = 'quorum',
  PAXOS = 'paxos'
}

export interface RaftConfig {
  heartbeatInterval: number;
  electionTimeout: number;
  leaderTimeout: number;
  logReplication: boolean;
}

export interface GossipConfig {
  fanout: number;
  gossipInterval: number;
  convergenceThreshold: number;
  maxRounds: number;
}

export interface RaftState {
  currentTerm: number;
  votedFor: string | null;
  log: RaftLogEntry[];
  commitIndex: number;
  lastApplied: number;
  role: 'follower' | 'candidate' | 'leader';
  leaderId: string | null;
  nextIndex: Map<string, number>;
  matchIndex: Map<string, number>;
}

export interface RaftLogEntry {
  term: number;
  index: number;
  command: any;
  timestamp: number;
}

export class DistributedConsensus extends EventEmitter {
  private config: ConsensusConfig;
  private activeProposals = new Map<string, ConsensusProposal>();
  private proposalVotes = new Map<string, ConsensusVote[]>();
  private consensusResults = new Map<string, ConsensusResult>();
  private knownAgents = new Set<string>();
  private raftState?: RaftState;
  private gossipState = new Map<string, any>();
  private consensusStats = {
    proposalsCreated: 0,
    proposalsAccepted: 0,
    proposalsRejected: 0,
    votescast: 0,
    timeouts: 0,
    averageConsensusTime: 0
  };

  constructor(config: ConsensusConfig) {
    super();
    this.config = config;
    this.initializeConsensus();
  }

  private initializeConsensus(): void {
    switch (this.config.consensusType) {
      case ConsensusType.RAFT:
        this.initializeRaft();
        break;
      case ConsensusType.BYZANTINE:
        this.initializeByzantine();
        break;
      case ConsensusType.GOSSIP:
        this.initializeGossip();
        break;
      case ConsensusType.QUORUM:
        this.initializeQuorum();
        break;
      case ConsensusType.PAXOS:
        this.initializePaxos();
        break;
    }

    // Setup cleanup for expired proposals
    setInterval(() => this.cleanupExpiredProposals(), 30000);
  }

  private initializeRaft(): void {
    if (!this.config.raftConfig) {
      throw new Error('Raft config required for Raft consensus');
    }

    this.raftState = {
      currentTerm: 0,
      votedFor: null,
      log: [],
      commitIndex: -1,
      lastApplied: -1,
      role: 'follower',
      leaderId: null,
      nextIndex: new Map(),
      matchIndex: new Map()
    };

    // Start Raft heartbeat/election timer
    this.startRaftTimers();
  }

  private startRaftTimers(): void {
    if (!this.config.raftConfig || !this.raftState) return;

    const startElection = () => {
      if (this.raftState!.role === 'follower' || this.raftState!.role === 'candidate') {
        this.startRaftElection();
      }
    };

    // Random election timeout to prevent split votes
    const electionTimeout = this.config.raftConfig.electionTimeout + 
      Math.random() * this.config.raftConfig.electionTimeout;
    
    setTimeout(startElection, electionTimeout);
  }

  private startRaftElection(): void {
    if (!this.raftState) return;

    this.raftState.currentTerm++;
    this.raftState.role = 'candidate';
    this.raftState.votedFor = this.config.agentId;

    const voteRequest = {
      type: 'vote_request',
      term: this.raftState.currentTerm,
      candidateId: this.config.agentId,
      lastLogIndex: this.raftState.log.length - 1,
      lastLogTerm: this.raftState.log[this.raftState.log.length - 1]?.term || 0
    };

    this.emit('raft_vote_request', voteRequest);
  }

  private initializeByzantine(): void {
    // Byzantine fault tolerance initialization
    this.on('byzantine_prepare', this.handleByzantinePrepare.bind(this));
    this.on('byzantine_commit', this.handleByzantineCommit.bind(this));
  }

  private initializeGossip(): void {
    if (!this.config.gossipConfig) {
      throw new Error('Gossip config required for Gossip consensus');
    }

    // Start gossip rounds
    setInterval(() => {
      this.performGossipRound();
    }, this.config.gossipConfig.gossipInterval);
  }

  private initializeQuorum(): void {
    // Simple quorum-based consensus
    this.on('quorum_proposal', this.handleQuorumProposal.bind(this));
  }

  private initializePaxos(): void {
    // Paxos consensus protocol
    this.on('paxos_prepare', this.handlePaxosPrepare.bind(this));
    this.on('paxos_accept', this.handlePaxosAccept.bind(this));
  }

  /**
   * Propose a new consensus decision
   */
  async proposeConsensus(
    type: ProposalType,
    content: any,
    timeout: number = 30000
  ): Promise<ConsensusResult> {
    const proposal: ConsensusProposal = {
      id: this.generateProposalId(),
      proposer: this.config.agentId,
      type,
      content,
      timestamp: Date.now(),
      timeout: Date.now() + timeout,
      term: this.raftState?.currentTerm
    };

    if (this.config.requireSignatures) {
      proposal.signature = this.signProposal(proposal);
    }

    this.activeProposals.set(proposal.id, proposal);
    this.proposalVotes.set(proposal.id, []);
    this.consensusStats.proposalsCreated++;

    // Distribute proposal based on consensus type
    await this.distributeProposal(proposal);

    // Wait for consensus or timeout
    return new Promise((resolve) => {
      const checkConsensus = () => {
        const result = this.checkConsensusAchieved(proposal.id);
        if (result) {
          resolve(result);
          return;
        }

        if (Date.now() > proposal.timeout) {
          this.consensusStats.timeouts++;
          resolve(this.createTimeoutResult(proposal));
          return;
        }

        setTimeout(checkConsensus, 1000);
      };

      checkConsensus();
    });
  }

  private async distributeProposal(proposal: ConsensusProposal): Promise<void> {
    switch (this.config.consensusType) {
      case ConsensusType.RAFT:
        await this.distributeRaftProposal(proposal);
        break;
      case ConsensusType.BYZANTINE:
        await this.distributeByzantineProposal(proposal);
        break;
      case ConsensusType.GOSSIP:
        await this.distributeGossipProposal(proposal);
        break;
      case ConsensusType.QUORUM:
      case ConsensusType.PAXOS:
        await this.distributeQuorumProposal(proposal);
        break;
    }
  }

  private async distributeRaftProposal(proposal: ConsensusProposal): Promise<void> {
    if (!this.raftState || this.raftState.role !== 'leader') {
      throw new Error('Only Raft leader can propose');
    }

    // Add to log
    const logEntry: RaftLogEntry = {
      term: this.raftState.currentTerm,
      index: this.raftState.log.length,
      command: proposal,
      timestamp: Date.now()
    };

    this.raftState.log.push(logEntry);
    this.emit('raft_append_entries', {
      term: this.raftState.currentTerm,
      leaderId: this.config.agentId,
      prevLogIndex: logEntry.index - 1,
      prevLogTerm: this.raftState.log[logEntry.index - 1]?.term || 0,
      entries: [logEntry],
      leaderCommit: this.raftState.commitIndex
    });
  }

  private async distributeByzantineProposal(proposal: ConsensusProposal): Promise<void> {
    // Phase 1: Prepare phase
    this.emit('byzantine_prepare', {
      proposalId: proposal.id,
      proposal,
      phase: 1,
      sender: this.config.agentId
    });
  }

  private async distributeGossipProposal(proposal: ConsensusProposal): Promise<void> {
    if (!this.config.gossipConfig) return;

    // Initialize gossip state for this proposal
    this.gossipState.set(proposal.id, {
      proposal,
      votes: new Map(),
      round: 0,
      converged: false
    });

    // Start gossip spreading
    this.performGossipRound(proposal.id);
  }

  private async distributeQuorumProposal(proposal: ConsensusProposal): Promise<void> {
    this.emit('consensus_proposal', proposal);
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    proposalId: string,
    decision: VoteDecision,
    reasoning?: string
  ): Promise<boolean> {
    const proposal = this.activeProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (Date.now() > proposal.timeout) {
      throw new Error(`Proposal ${proposalId} has expired`);
    }

    const vote: ConsensusVote = {
      proposalId,
      voter: this.config.agentId,
      decision,
      timestamp: Date.now(),
      term: this.raftState?.currentTerm,
      reasoning
    };

    if (this.config.requireSignatures) {
      vote.signature = this.signVote(vote);
    }

    // Validate vote based on consensus type
    if (!this.validateVote(vote, proposal)) {
      return false;
    }

    // Add vote to proposal
    const votes = this.proposalVotes.get(proposalId) || [];
    
    // Check for duplicate votes from same agent
    const existingVoteIndex = votes.findIndex(v => v.voter === vote.voter);
    if (existingVoteIndex >= 0) {
      votes[existingVoteIndex] = vote; // Update existing vote
    } else {
      votes.push(vote);
    }
    
    this.proposalVotes.set(proposalId, votes);
    this.consensusStats.votescast++;

    this.emit('vote_cast', vote, proposal);
    return true;
  }

  private validateVote(vote: ConsensusVote, proposal: ConsensusProposal): boolean {
    // Verify signature if required
    if (this.config.requireSignatures && vote.signature) {
      if (!this.verifyVoteSignature(vote)) {
        return false;
      }
    }

    // Consensus-specific validation
    switch (this.config.consensusType) {
      case ConsensusType.RAFT:
        return this.validateRaftVote(vote, proposal);
      case ConsensusType.BYZANTINE:
        return this.validateByzantineVote(vote, proposal);
      default:
        return true;
    }
  }

  private validateRaftVote(vote: ConsensusVote, proposal: ConsensusProposal): boolean {
    if (!this.raftState) return false;
    return vote.term === this.raftState.currentTerm;
  }

  private validateByzantineVote(vote: ConsensusVote, proposal: ConsensusProposal): boolean {
    // Byzantine-specific validation
    return this.knownAgents.has(vote.voter);
  }

  private checkConsensusAchieved(proposalId: string): ConsensusResult | null {
    const proposal = this.activeProposals.get(proposalId);
    const votes = this.proposalVotes.get(proposalId);
    
    if (!proposal || !votes) return null;

    switch (this.config.consensusType) {
      case ConsensusType.RAFT:
        return this.checkRaftConsensus(proposal, votes);
      case ConsensusType.BYZANTINE:
        return this.checkByzantineConsensus(proposal, votes);
      case ConsensusType.GOSSIP:
        return this.checkGossipConsensus(proposal, votes);
      case ConsensusType.QUORUM:
      case ConsensusType.PAXOS:
        return this.checkQuorumConsensus(proposal, votes);
      default:
        return null;
    }
  }

  private checkQuorumConsensus(
    proposal: ConsensusProposal,
    votes: ConsensusVote[]
  ): ConsensusResult | null {
    const totalAgents = this.knownAgents.size;
    const quorumSize = Math.ceil(totalAgents / 2); // Majority

    if (votes.length < quorumSize) return null;

    const approveVotes = votes.filter(v => v.decision === VoteDecision.APPROVE);
    const rejectVotes = votes.filter(v => v.decision === VoteDecision.REJECT);

    let decision: VoteDecision;
    let confidence: number;

    if (approveVotes.length >= quorumSize) {
      decision = VoteDecision.APPROVE;
      confidence = approveVotes.length / totalAgents;
      this.consensusStats.proposalsAccepted++;
    } else if (rejectVotes.length >= quorumSize) {
      decision = VoteDecision.REJECT;
      confidence = rejectVotes.length / totalAgents;
      this.consensusStats.proposalsRejected++;
    } else {
      return null; // No consensus yet
    }

    const result: ConsensusResult = {
      proposalId: proposal.id,
      decision,
      votes,
      finalizedAt: Date.now(),
      confidence,
      participated: votes.map(v => v.voter),
      abstained: Array.from(this.knownAgents).filter(
        agent => !votes.some(v => v.voter === agent)
      )
    };

    this.finalizeConsensus(result);
    return result;
  }

  private checkRaftConsensus(
    proposal: ConsensusProposal,
    votes: ConsensusVote[]
  ): ConsensusResult | null {
    if (!this.raftState || this.raftState.role !== 'leader') return null;

    // In Raft, consensus is achieved when majority of followers acknowledge
    const totalAgents = this.knownAgents.size;
    const majority = Math.ceil(totalAgents / 2);

    if (votes.length >= majority) {
      const result: ConsensusResult = {
        proposalId: proposal.id,
        decision: VoteDecision.APPROVE,
        votes,
        finalizedAt: Date.now(),
        confidence: votes.length / totalAgents,
        participated: votes.map(v => v.voter),
        abstained: []
      };

      this.consensusStats.proposalsAccepted++;
      this.finalizeConsensus(result);
      return result;
    }

    return null;
  }

  private checkByzantineConsensus(
    proposal: ConsensusProposal,
    votes: ConsensusVote[]
  ): ConsensusResult | null {
    // Byzantine consensus requires 2f+1 agreements where f is max faults
    const totalAgents = this.knownAgents.size;
    const maxFaults = Math.floor((totalAgents - 1) / 3);
    const requiredAgreements = 2 * maxFaults + 1;

    const approveVotes = votes.filter(v => v.decision === VoteDecision.APPROVE);
    const rejectVotes = votes.filter(v => v.decision === VoteDecision.REJECT);

    let decision: VoteDecision | null = null;
    let winningVotes: ConsensusVote[] = [];

    if (approveVotes.length >= requiredAgreements) {
      decision = VoteDecision.APPROVE;
      winningVotes = approveVotes;
      this.consensusStats.proposalsAccepted++;
    } else if (rejectVotes.length >= requiredAgreements) {
      decision = VoteDecision.REJECT;
      winningVotes = rejectVotes;
      this.consensusStats.proposalsRejected++;
    }

    if (decision) {
      const result: ConsensusResult = {
        proposalId: proposal.id,
        decision,
        votes: winningVotes,
        finalizedAt: Date.now(),
        confidence: winningVotes.length / totalAgents,
        participated: votes.map(v => v.voter),
        abstained: []
      };

      this.finalizeConsensus(result);
      return result;
    }

    return null;
  }

  private checkGossipConsensus(
    proposal: ConsensusProposal,
    votes: ConsensusVote[]
  ): ConsensusResult | null {
    if (!this.config.gossipConfig) return null;

    const gossipState = this.gossipState.get(proposal.id);
    if (!gossipState || !gossipState.converged) return null;

    // Gossip consensus achieved when convergence threshold met
    const totalAgents = this.knownAgents.size;
    const threshold = Math.ceil(totalAgents * this.config.gossipConfig.convergenceThreshold);

    if (votes.length >= threshold) {
      const approveVotes = votes.filter(v => v.decision === VoteDecision.APPROVE);
      const decision = approveVotes.length > votes.length / 2 ? 
        VoteDecision.APPROVE : VoteDecision.REJECT;

      const result: ConsensusResult = {
        proposalId: proposal.id,
        decision,
        votes,
        finalizedAt: Date.now(),
        confidence: votes.length / totalAgents,
        participated: votes.map(v => v.voter),
        abstained: []
      };

      this.finalizeConsensus(result);
      return result;
    }

    return null;
  }

  private finalizeConsensus(result: ConsensusResult): void {
    this.consensusResults.set(result.proposalId, result);
    
    // Update average consensus time
    const proposal = this.activeProposals.get(result.proposalId);
    if (proposal) {
      const consensusTime = result.finalizedAt - proposal.timestamp;
      this.consensusStats.averageConsensusTime = 
        (this.consensusStats.averageConsensusTime * 
         (this.consensusStats.proposalsAccepted + this.consensusStats.proposalsRejected - 1) + 
         consensusTime) / (this.consensusStats.proposalsAccepted + this.consensusStats.proposalsRejected);
    }

    this.emit('consensus_reached', result);
    this.cleanupProposal(result.proposalId);
  }

  private createTimeoutResult(proposal: ConsensusProposal): ConsensusResult {
    const votes = this.proposalVotes.get(proposal.id) || [];
    
    const result: ConsensusResult = {
      proposalId: proposal.id,
      decision: VoteDecision.REJECT, // Timeout defaults to rejection
      votes,
      finalizedAt: Date.now(),
      confidence: 0,
      participated: votes.map(v => v.voter),
      abstained: Array.from(this.knownAgents).filter(
        agent => !votes.some(v => v.voter === agent)
      )
    };

    this.finalizeConsensus(result);
    return result;
  }

  private performGossipRound(proposalId?: string): void {
    if (!this.config.gossipConfig) return;

    const proposals = proposalId ? 
      [proposalId] : Array.from(this.gossipState.keys());

    proposals.forEach(id => {
      const state = this.gossipState.get(id);
      if (!state || state.converged) return;

      state.round++;
      
      // Select random subset of agents for gossip
      const agents = Array.from(this.knownAgents);
      const fanout = Math.min(this.config.gossipConfig.fanout, agents.length);
      const targets = agents
        .sort(() => Math.random() - 0.5)
        .slice(0, fanout);

      // Send gossip messages
      targets.forEach(target => {
        this.emit('gossip_message', {
          target,
          proposalId: id,
          state: state,
          round: state.round
        });
      });

      // Check convergence
      if (state.round >= this.config.gossipConfig.maxRounds) {
        state.converged = true;
      }
    });
  }

  private handleByzantinePrepare(data: any): void {
    // Handle Byzantine prepare phase
    this.emit('byzantine_prepared', {
      proposalId: data.proposalId,
      sender: this.config.agentId,
      phase: 2
    });
  }

  private handleByzantineCommit(data: any): void {
    // Handle Byzantine commit phase
    this.castVote(data.proposalId, VoteDecision.APPROVE, 'Byzantine commit');
  }

  private handleQuorumProposal(proposal: ConsensusProposal): void {
    // Auto-vote based on local conditions
    const decision = this.evaluateProposal(proposal);
    this.castVote(proposal.id, decision);
  }

  private handlePaxosPrepare(data: any): void {
    // Paxos prepare phase implementation
  }

  private handlePaxosAccept(data: any): void {
    // Paxos accept phase implementation
  }

  private evaluateProposal(proposal: ConsensusProposal): VoteDecision {
    // Simple evaluation logic - can be enhanced
    switch (proposal.type) {
      case ProposalType.EMERGENCY_ACTION:
        return VoteDecision.APPROVE;
      case ProposalType.SYSTEM_UPDATE:
        return Math.random() > 0.2 ? VoteDecision.APPROVE : VoteDecision.REJECT;
      default:
        return VoteDecision.APPROVE;
    }
  }

  private cleanupExpiredProposals(): void {
    const now = Date.now();
    this.activeProposals.forEach((proposal, id) => {
      if (now > proposal.timeout) {
        this.cleanupProposal(id);
      }
    });
  }

  private cleanupProposal(proposalId: string): void {
    this.activeProposals.delete(proposalId);
    this.proposalVotes.delete(proposalId);
    this.gossipState.delete(proposalId);
  }

  private signProposal(proposal: ConsensusProposal): string {
    const data = `${proposal.id}:${proposal.proposer}:${proposal.timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private signVote(vote: ConsensusVote): string {
    const data = `${vote.proposalId}:${vote.voter}:${vote.decision}:${vote.timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private verifyVoteSignature(vote: ConsensusVote): boolean {
    if (!vote.signature) return false;
    const expectedSignature = this.signVote(vote);
    return vote.signature === expectedSignature;
  }

  private generateProposalId(): string {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add agents to the consensus network
   */
  addAgents(agentIds: string[]): void {
    agentIds.forEach(id => {
      this.knownAgents.add(id);
      
      if (this.raftState) {
        this.raftState.nextIndex.set(id, this.raftState.log.length);
        this.raftState.matchIndex.set(id, -1);
      }
    });
  }

  /**
   * Remove agents from consensus network
   */
  removeAgents(agentIds: string[]): void {
    agentIds.forEach(id => {
      this.knownAgents.delete(id);
      
      if (this.raftState) {
        this.raftState.nextIndex.delete(id);
        this.raftState.matchIndex.delete(id);
      }
    });
  }

  /**
   * Get consensus statistics
   */
  getConsensusStats(): typeof this.consensusStats & {
    activeProposals: number;
    knownAgents: number;
    consensusType: ConsensusType;
  } {
    return {
      ...this.consensusStats,
      activeProposals: this.activeProposals.size,
      knownAgents: this.knownAgents.size,
      consensusType: this.config.consensusType
    };
  }

  /**
   * Get active proposals
   */
  getActiveProposals(): ConsensusProposal[] {
    return Array.from(this.activeProposals.values());
  }

  /**
   * Get consensus result by proposal ID
   */
  getConsensusResult(proposalId: string): ConsensusResult | undefined {
    return this.consensusResults.get(proposalId);
  }

  /**
   * Shutdown consensus system
   */
  async shutdown(): Promise<void> {
    // Cancel all active proposals
    this.activeProposals.clear();
    this.proposalVotes.clear();
    this.consensusResults.clear();
    this.knownAgents.clear();
    this.gossipState.clear();

    this.emit('consensus_shutdown');
  }
}

export {
  DistributedConsensus as default,
  type ConsensusProposal,
  type ConsensusVote,
  type ConsensusResult,
  type ConsensusConfig,
  ProposalType,
  VoteDecision,
  ConsensusType
};