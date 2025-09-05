/**
 * CNS Gatekeeper Governance Engine
 * Decentralized governance and policy enforcement system
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';

export interface GovernancePolicy {
  id: string;
  name: string;
  version: string;
  type: PolicyType;
  scope: PolicyScope;
  rules: PolicyRule[];
  enforcement: EnforcementLevel;
  approvals: Approval[];
  status: PolicyStatus;
  effectiveDate: Date;
  expiryDate?: Date;
  metadata: PolicyMetadata;
}

export interface PolicyRule {
  id: string;
  condition: string;
  action: PolicyAction;
  parameters: Record<string, any>;
  priority: number;
  exceptions: string[];
}

export interface Approval {
  stakeholderId: string;
  stakeholderType: StakeholderType;
  approved: boolean;
  timestamp: Date;
  signature: string;
  comments?: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  type: ProposalType;
  proposer: Stakeholder;
  requestedChanges: PolicyChange[];
  votingPeriod: VotingPeriod;
  votes: Vote[];
  status: ProposalStatus;
  impact: ImpactAssessment;
  timestamp: Date;
}

export interface PolicyChange {
  changeType: 'create' | 'update' | 'delete';
  target: string;
  before?: any;
  after?: any;
  justification: string;
}

export interface Vote {
  stakeholderId: string;
  decision: VoteDecision;
  weight: number;
  timestamp: Date;
  rationale?: string;
  signature: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  type: StakeholderType;
  votingWeight: number;
  reputation: number;
  specializations: string[];
  contactInfo: ContactInfo;
  isActive: boolean;
}

export interface VotingPeriod {
  startDate: Date;
  endDate: Date;
  quorumRequired: number;
  majorityThreshold: number;
  extensions: number;
}

export interface ImpactAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems: string[];
  estimatedCost: number;
  beneficiaries: string[];
  potentialIssues: string[];
  mitigationStrategies: string[];
}

export type PolicyType = 
  | 'access-control' | 'data-governance' | 'security' | 'compliance' 
  | 'operational' | 'financial' | 'technical' | 'ethical';

export type PolicyScope = 
  | 'global' | 'organization' | 'project' | 'workflow' | 'task';

export type EnforcementLevel = 
  | 'advisory' | 'warning' | 'blocking' | 'automatic';

export type PolicyStatus = 
  | 'draft' | 'review' | 'approved' | 'active' | 'suspended' | 'revoked';

export type PolicyAction = 
  | 'allow' | 'deny' | 'require-approval' | 'log' | 'alert' | 'escalate';

export type StakeholderType = 
  | 'admin' | 'manager' | 'developer' | 'auditor' | 'user' | 'system';

export type ProposalType = 
  | 'policy-change' | 'system-upgrade' | 'resource-allocation' | 'strategic';

export type ProposalStatus = 
  | 'draft' | 'submitted' | 'under-review' | 'voting' | 'approved' | 'rejected' | 'withdrawn';

export type VoteDecision = 
  | 'approve' | 'reject' | 'abstain' | 'conditional';

export interface ContactInfo {
  email?: string;
  phone?: string;
  department?: string;
}

export interface PolicyMetadata {
  author: string;
  reviewers: string[];
  tags: string[];
  references: string[];
  lastModified: Date;
  reviewCycle: number; // days
}

export interface GovernanceMetrics {
  totalPolicies: number;
  activePolicies: number;
  pendingProposals: number;
  averageVotingTime: number;
  complianceRate: number;
  violationCount: number;
  stakeholderParticipation: number;
}

/**
 * Decentralized Governance Engine
 */
export class GatekeeperGovernanceEngine extends EventEmitter {
  private policies: Map<string, GovernancePolicy>;
  private proposals: Map<string, Proposal>;
  private stakeholders: Map<string, Stakeholder>;
  private violations: ViolationRecord[];
  private auditLog: AuditEntry[];
  private metrics: GovernanceMetrics;

  constructor(private config: GovernanceConfig = {}) {
    super();
    this.policies = new Map();
    this.proposals = new Map();
    this.stakeholders = new Map();
    this.violations = [];
    this.auditLog = [];
    this.metrics = this.initializeMetrics();
    this.initializeDefaultPolicies();
    this.startComplianceMonitoring();
  }

  private initializeMetrics(): GovernanceMetrics {
    return {
      totalPolicies: 0,
      activePolicies: 0,
      pendingProposals: 0,
      averageVotingTime: 0,
      complianceRate: 1.0,
      violationCount: 0,
      stakeholderParticipation: 0
    };
  }

  private initializeDefaultPolicies(): void {
    // Create essential default policies
    const defaultPolicies = [
      this.createAccessControlPolicy(),
      this.createDataGovernancePolicy(),
      this.createSecurityPolicy(),
      this.createCompliancePolicy()
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.id, policy);
      this.metrics.totalPolicies++;
      this.metrics.activePolicies++;
    });
  }

  private createAccessControlPolicy(): GovernancePolicy {
    return {
      id: this.generateId(),
      name: 'Access Control Policy',
      version: '1.0.0',
      type: 'access-control',
      scope: 'global',
      rules: [
        {
          id: this.generateId(),
          condition: 'resource.type === "sensitive"',
          action: 'require-approval',
          parameters: { approvers: 2, roles: ['admin', 'manager'] },
          priority: 1,
          exceptions: []
        },
        {
          id: this.generateId(),
          condition: 'time.hour < 6 || time.hour > 22',
          action: 'log',
          parameters: { level: 'warning' },
          priority: 2,
          exceptions: ['emergency-access']
        }
      ],
      enforcement: 'blocking',
      approvals: [],
      status: 'active',
      effectiveDate: new Date(),
      metadata: {
        author: 'system',
        reviewers: [],
        tags: ['security', 'access'],
        references: [],
        lastModified: new Date(),
        reviewCycle: 90
      }
    };
  }

  private createDataGovernancePolicy(): GovernancePolicy {
    return {
      id: this.generateId(),
      name: 'Data Governance Policy',
      version: '1.0.0',
      type: 'data-governance',
      scope: 'global',
      rules: [
        {
          id: this.generateId(),
          condition: 'data.contains("PII")',
          action: 'require-approval',
          parameters: { encryption: true, retention: '7y' },
          priority: 1,
          exceptions: []
        },
        {
          id: this.generateId(),
          condition: 'data.size > 1GB',
          action: 'alert',
          parameters: { notify: ['data-steward'] },
          priority: 2,
          exceptions: []
        }
      ],
      enforcement: 'automatic',
      approvals: [],
      status: 'active',
      effectiveDate: new Date(),
      metadata: {
        author: 'system',
        reviewers: [],
        tags: ['data', 'privacy', 'compliance'],
        references: ['GDPR', 'CCPA'],
        lastModified: new Date(),
        reviewCycle: 180
      }
    };
  }

  private createSecurityPolicy(): GovernancePolicy {
    return {
      id: this.generateId(),
      name: 'Security Policy',
      version: '1.0.0',
      type: 'security',
      scope: 'global',
      rules: [
        {
          id: this.generateId(),
          condition: 'request.origin.matches("suspicious")',
          action: 'deny',
          parameters: { reason: 'security-threat' },
          priority: 1,
          exceptions: []
        },
        {
          id: this.generateId(),
          condition: 'auth.failed_attempts > 3',
          action: 'escalate',
          parameters: { cooldown: '30m', notify: ['security-team'] },
          priority: 2,
          exceptions: []
        }
      ],
      enforcement: 'blocking',
      approvals: [],
      status: 'active',
      effectiveDate: new Date(),
      metadata: {
        author: 'system',
        reviewers: [],
        tags: ['security', 'threat-detection'],
        references: [],
        lastModified: new Date(),
        reviewCycle: 30
      }
    };
  }

  private createCompliancePolicy(): GovernancePolicy {
    return {
      id: this.generateId(),
      name: 'Compliance Policy',
      version: '1.0.0',
      type: 'compliance',
      scope: 'global',
      rules: [
        {
          id: this.generateId(),
          condition: 'audit.required === true',
          action: 'log',
          parameters: { level: 'audit', retention: '7y' },
          priority: 1,
          exceptions: []
        }
      ],
      enforcement: 'automatic',
      approvals: [],
      status: 'active',
      effectiveDate: new Date(),
      metadata: {
        author: 'system',
        reviewers: [],
        tags: ['compliance', 'audit'],
        references: ['SOX', 'ISO27001'],
        lastModified: new Date(),
        reviewCycle: 365
      }
    };
  }

  /**
   * Register a stakeholder
   */
  registerStakeholder(stakeholder: Omit<Stakeholder, 'id'>): string {
    const stakeholderId = this.generateId();
    
    const newStakeholder: Stakeholder = {
      id: stakeholderId,
      ...stakeholder
    };

    this.stakeholders.set(stakeholderId, newStakeholder);
    
    this.logAuditEntry({
      action: 'stakeholder-registered',
      details: { stakeholderId, type: stakeholder.type },
      timestamp: new Date(),
      actor: 'system'
    });

    this.emit('stakeholderRegistered', { stakeholderId });
    
    return stakeholderId;
  }

  /**
   * Submit a governance proposal
   */
  async submitProposal(proposal: Omit<Proposal, 'id' | 'votes' | 'status' | 'timestamp'>): Promise<string> {
    const proposalId = this.generateId();
    
    const newProposal: Proposal = {
      id: proposalId,
      votes: [],
      status: 'submitted',
      timestamp: new Date(),
      ...proposal
    };

    // Validate proposal
    const validation = await this.validateProposal(newProposal);
    if (!validation.isValid) {
      throw new Error(`Invalid proposal: ${validation.errors.join(', ')}`);
    }

    this.proposals.set(proposalId, newProposal);
    this.metrics.pendingProposals++;

    // Start voting period
    await this.initiateVoting(proposalId);

    this.logAuditEntry({
      action: 'proposal-submitted',
      details: { proposalId, type: proposal.type },
      timestamp: new Date(),
      actor: proposal.proposer.id
    });

    this.emit('proposalSubmitted', { proposalId, proposal: newProposal });
    
    return proposalId;
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(proposalId: string, stakeholderId: string, vote: Omit<Vote, 'timestamp' | 'signature'>): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const stakeholder = this.stakeholders.get(stakeholderId);
    if (!stakeholder) {
      throw new Error(`Stakeholder ${stakeholderId} not found`);
    }

    if (proposal.status !== 'voting') {
      throw new Error(`Proposal ${proposalId} is not in voting status`);
    }

    // Check if voting period is still active
    if (new Date() > proposal.votingPeriod.endDate) {
      throw new Error(`Voting period for proposal ${proposalId} has ended`);
    }

    // Check if stakeholder has already voted
    const existingVote = proposal.votes.find(v => v.stakeholderId === stakeholderId);
    if (existingVote) {
      throw new Error(`Stakeholder ${stakeholderId} has already voted on proposal ${proposalId}`);
    }

    // Create vote with signature
    const voteWithTimestamp: Vote = {
      ...vote,
      timestamp: new Date(),
      signature: this.signVote(vote, stakeholderId)
    };

    proposal.votes.push(voteWithTimestamp);

    // Check if voting is complete
    const votingResult = await this.checkVotingCompletion(proposalId);
    if (votingResult.isComplete) {
      await this.finalizeVoting(proposalId, votingResult);
    }

    this.logAuditEntry({
      action: 'vote-cast',
      details: { proposalId, stakeholderId, decision: vote.decision },
      timestamp: new Date(),
      actor: stakeholderId
    });

    this.emit('voteCast', { proposalId, stakeholderId, vote: voteWithTimestamp });
  }

  /**
   * Evaluate policy compliance for a request
   */
  async evaluateCompliance(request: ComplianceRequest): Promise<ComplianceResult> {
    const startTime = Date.now();
    const applicablePolicies = this.findApplicablePolicies(request);
    
    const evaluationResults: PolicyEvaluationResult[] = [];
    let overallDecision: PolicyAction = 'allow';
    let blockedBy: string[] = [];

    for (const policy of applicablePolicies) {
      const result = await this.evaluatePolicy(policy, request);
      evaluationResults.push(result);

      // Aggregate decisions (blocking takes precedence)
      if (result.decision === 'deny' && overallDecision !== 'deny') {
        overallDecision = 'deny';
        blockedBy.push(policy.id);
      } else if (result.decision === 'require-approval' && overallDecision === 'allow') {
        overallDecision = 'require-approval';
      }
    }

    const processingTime = Date.now() - startTime;
    
    const complianceResult: ComplianceResult = {
      requestId: request.id,
      decision: overallDecision,
      blockedBy,
      evaluations: evaluationResults,
      processingTime,
      timestamp: new Date(),
      requiresApproval: overallDecision === 'require-approval',
      violations: evaluationResults.filter(e => e.violations.length > 0)
    };

    // Log violations
    if (complianceResult.violations.length > 0) {
      this.recordViolations(request, complianceResult.violations);
    }

    // Update metrics
    this.updateComplianceMetrics(complianceResult);

    this.emit('complianceEvaluated', complianceResult);
    
    return complianceResult;
  }

  /**
   * Enforce policy decision
   */
  async enforcePolicy(request: ComplianceRequest, result: ComplianceResult): Promise<EnforcementResult> {
    const enforcementActions: EnforcementAction[] = [];

    for (const evaluation of result.evaluations) {
      const policy = this.policies.get(evaluation.policyId);
      if (!policy) continue;

      switch (evaluation.decision) {
        case 'deny':
          enforcementActions.push({
            type: 'block',
            policyId: policy.id,
            reason: evaluation.reason || 'Policy violation',
            timestamp: new Date()
          });
          break;

        case 'require-approval':
          const approvalId = await this.initiateApprovalProcess(request, policy);
          enforcementActions.push({
            type: 'require-approval',
            policyId: policy.id,
            approvalId,
            timestamp: new Date()
          });
          break;

        case 'log':
          enforcementActions.push({
            type: 'log',
            policyId: policy.id,
            logLevel: evaluation.parameters?.level || 'info',
            timestamp: new Date()
          });
          break;

        case 'alert':
          await this.sendAlert(policy, request, evaluation);
          enforcementActions.push({
            type: 'alert',
            policyId: policy.id,
            timestamp: new Date()
          });
          break;

        case 'escalate':
          await this.escalateViolation(policy, request, evaluation);
          enforcementActions.push({
            type: 'escalate',
            policyId: policy.id,
            timestamp: new Date()
          });
          break;
      }
    }

    const enforcementResult: EnforcementResult = {
      requestId: request.id,
      actions: enforcementActions,
      allowed: result.decision === 'allow',
      timestamp: new Date()
    };

    this.logAuditEntry({
      action: 'policy-enforced',
      details: { requestId: request.id, decision: result.decision, actionsCount: enforcementActions.length },
      timestamp: new Date(),
      actor: 'system'
    });

    this.emit('policyEnforced', enforcementResult);

    return enforcementResult;
  }

  /**
   * Create a new policy
   */
  async createPolicy(policySpec: Omit<GovernancePolicy, 'id' | 'approvals' | 'status' | 'effectiveDate' | 'metadata'>): Promise<string> {
    const policyId = this.generateId();
    
    const policy: GovernancePolicy = {
      id: policyId,
      approvals: [],
      status: 'draft',
      effectiveDate: new Date(),
      metadata: {
        author: 'user',
        reviewers: [],
        tags: [],
        references: [],
        lastModified: new Date(),
        reviewCycle: 90
      },
      ...policySpec
    };

    this.policies.set(policyId, policy);
    this.metrics.totalPolicies++;

    this.logAuditEntry({
      action: 'policy-created',
      details: { policyId, name: policy.name, type: policy.type },
      timestamp: new Date(),
      actor: 'user'
    });

    this.emit('policyCreated', { policyId, policy });

    return policyId;
  }

  private async validateProposal(proposal: Proposal): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate proposer exists
    if (!this.stakeholders.has(proposal.proposer.id)) {
      errors.push(`Proposer ${proposal.proposer.id} not found`);
    }

    // Validate voting period
    if (proposal.votingPeriod.startDate >= proposal.votingPeriod.endDate) {
      errors.push('Voting end date must be after start date');
    }

    // Validate quorum requirements
    if (proposal.votingPeriod.quorumRequired <= 0 || proposal.votingPeriod.quorumRequired > 1) {
      errors.push('Quorum required must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async initiateVoting(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return;

    proposal.status = 'voting';

    // Notify eligible stakeholders
    const eligibleStakeholders = Array.from(this.stakeholders.values())
      .filter(s => s.isActive && s.type !== 'system');

    for (const stakeholder of eligibleStakeholders) {
      this.emit('votingStarted', { 
        proposalId, 
        stakeholderId: stakeholder.id,
        proposal 
      });
    }

    // Schedule voting deadline check
    const timeUntilDeadline = proposal.votingPeriod.endDate.getTime() - Date.now();
    setTimeout(() => {
      this.checkVotingDeadline(proposalId);
    }, timeUntilDeadline);
  }

  private async checkVotingCompletion(proposalId: string): Promise<VotingResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { isComplete: false, result: 'pending', details: {} };
    }

    const totalEligible = Array.from(this.stakeholders.values())
      .filter(s => s.isActive && s.type !== 'system').length;

    const totalVotes = proposal.votes.length;
    const quorumMet = totalVotes / totalEligible >= proposal.votingPeriod.quorumRequired;

    if (!quorumMet) {
      return { isComplete: false, result: 'pending', details: { quorumMet: false } };
    }

    // Calculate weighted votes
    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;

    for (const vote of proposal.votes) {
      const stakeholder = this.stakeholders.get(vote.stakeholderId);
      const weight = stakeholder ? stakeholder.votingWeight : 1;
      
      totalWeight += weight;
      
      switch (vote.decision) {
        case 'approve':
          approveWeight += weight;
          break;
        case 'reject':
          rejectWeight += weight;
          break;
        // abstain and conditional don't count toward approve/reject
      }
    }

    const approvalRatio = approveWeight / totalWeight;
    const approved = approvalRatio >= proposal.votingPeriod.majorityThreshold;

    return {
      isComplete: true,
      result: approved ? 'approved' : 'rejected',
      details: {
        quorumMet: true,
        approvalRatio,
        totalVotes,
        totalEligible,
        approveWeight,
        rejectWeight,
        totalWeight
      }
    };
  }

  private async finalizeVoting(proposalId: string, votingResult: VotingResult): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return;

    proposal.status = votingResult.result === 'approved' ? 'approved' : 'rejected';
    
    if (proposal.status === 'approved') {
      // Apply the requested changes
      await this.applyProposalChanges(proposal);
    }

    this.metrics.pendingProposals--;

    this.logAuditEntry({
      action: 'voting-finalized',
      details: { 
        proposalId, 
        result: votingResult.result,
        details: votingResult.details 
      },
      timestamp: new Date(),
      actor: 'system'
    });

    this.emit('votingFinalized', { proposalId, result: votingResult });
  }

  private async applyProposalChanges(proposal: Proposal): Promise<void> {
    for (const change of proposal.requestedChanges) {
      try {
        switch (change.changeType) {
          case 'create':
            if (change.target === 'policy') {
              await this.createPolicy(change.after);
            }
            break;

          case 'update':
            if (change.target === 'policy') {
              const policy = this.policies.get(change.after.id);
              if (policy) {
                Object.assign(policy, change.after);
                policy.metadata.lastModified = new Date();
              }
            }
            break;

          case 'delete':
            if (change.target === 'policy') {
              this.policies.delete(change.before.id);
              this.metrics.totalPolicies--;
              if (change.before.status === 'active') {
                this.metrics.activePolicies--;
              }
            }
            break;
        }

        this.logAuditEntry({
          action: 'change-applied',
          details: { changeType: change.changeType, target: change.target },
          timestamp: new Date(),
          actor: 'system'
        });

      } catch (error) {
        this.logAuditEntry({
          action: 'change-failed',
          details: { 
            changeType: change.changeType, 
            target: change.target, 
            error: error.message 
          },
          timestamp: new Date(),
          actor: 'system'
        });
      }
    }
  }

  private async checkVotingDeadline(proposalId: string): Promise<void> {
    const votingResult = await this.checkVotingCompletion(proposalId);
    if (!votingResult.isComplete) {
      // Voting deadline reached but not complete - consider extending or failing
      const proposal = this.proposals.get(proposalId);
      if (proposal && proposal.votingPeriod.extensions > 0) {
        // Extend voting period
        proposal.votingPeriod.extensions--;
        proposal.votingPeriod.endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        this.emit('votingExtended', { proposalId });
      } else {
        // Mark as failed due to insufficient participation
        if (proposal) {
          proposal.status = 'rejected';
          this.metrics.pendingProposals--;
          
          this.emit('votingFailed', { proposalId, reason: 'insufficient-participation' });
        }
      }
    }
  }

  private findApplicablePolicies(request: ComplianceRequest): GovernancePolicy[] {
    return Array.from(this.policies.values()).filter(policy => {
      // Check if policy is active
      if (policy.status !== 'active') return false;

      // Check if policy is in effect
      if (policy.effectiveDate > new Date()) return false;
      if (policy.expiryDate && policy.expiryDate < new Date()) return false;

      // Check scope match
      return this.doesScopeMatch(policy.scope, request.scope);
    });
  }

  private doesScopeMatch(policyScope: PolicyScope, requestScope: string): boolean {
    if (policyScope === 'global') return true;
    
    const scopeHierarchy = ['global', 'organization', 'project', 'workflow', 'task'];
    const policyLevel = scopeHierarchy.indexOf(policyScope);
    const requestLevel = scopeHierarchy.indexOf(requestScope);
    
    // Policy applies if it's at the same level or higher in hierarchy
    return policyLevel <= requestLevel;
  }

  private async evaluatePolicy(policy: GovernancePolicy, request: ComplianceRequest): Promise<PolicyEvaluationResult> {
    const violations: PolicyViolation[] = [];
    let decision: PolicyAction = 'allow';
    let reason = '';

    for (const rule of policy.rules.sort((a, b) => a.priority - b.priority)) {
      const ruleResult = await this.evaluateRule(rule, request);
      
      if (!ruleResult.passed) {
        violations.push({
          ruleId: rule.id,
          description: `Rule violation: ${rule.condition}`,
          severity: this.getSeverityFromAction(rule.action),
          timestamp: new Date()
        });

        // Take the most restrictive action
        if (this.isMoreRestrictive(rule.action, decision)) {
          decision = rule.action;
          reason = `Rule ${rule.id}: ${rule.condition}`;
        }
      }
    }

    return {
      policyId: policy.id,
      decision,
      reason,
      violations,
      parameters: {},
      timestamp: new Date()
    };
  }

  private async evaluateRule(rule: PolicyRule, request: ComplianceRequest): Promise<RuleEvaluationResult> {
    try {
      // Simple condition evaluation (in a real system, use a proper expression engine)
      const passed = await this.evaluateCondition(rule.condition, request);
      
      return {
        ruleId: rule.id,
        passed,
        details: { condition: rule.condition }
      };
    } catch (error) {
      // If evaluation fails, err on the side of caution
      return {
        ruleId: rule.id,
        passed: false,
        details: { error: error.message }
      };
    }
  }

  private async evaluateCondition(condition: string, request: ComplianceRequest): Promise<boolean> {
    // This is a simplified condition evaluator
    // In a production system, you'd use a proper expression engine
    
    const context = {
      resource: request.resource,
      user: request.user,
      time: {
        hour: new Date().getHours(),
        day: new Date().getDay()
      },
      data: request.data || {},
      auth: request.auth || {}
    };

    // Simple string matching for demo purposes
    if (condition.includes('resource.type === "sensitive"')) {
      return context.resource?.type === 'sensitive';
    }

    if (condition.includes('time.hour < 6 || time.hour > 22')) {
      return context.time.hour < 6 || context.time.hour > 22;
    }

    if (condition.includes('data.contains("PII")')) {
      return JSON.stringify(context.data).includes('PII');
    }

    if (condition.includes('data.size > 1GB')) {
      return (context.data?.size || 0) > 1024 * 1024 * 1024;
    }

    // Default to true for unknown conditions (fail open)
    return true;
  }

  private getSeverityFromAction(action: PolicyAction): 'low' | 'medium' | 'high' | 'critical' {
    switch (action) {
      case 'deny': return 'critical';
      case 'require-approval': return 'high';
      case 'escalate': return 'high';
      case 'alert': return 'medium';
      case 'log': return 'low';
      default: return 'low';
    }
  }

  private isMoreRestrictive(newAction: PolicyAction, currentAction: PolicyAction): boolean {
    const restrictiveness = {
      'allow': 0,
      'log': 1,
      'alert': 2,
      'require-approval': 3,
      'escalate': 4,
      'deny': 5
    };

    return restrictiveness[newAction] > restrictiveness[currentAction];
  }

  private recordViolations(request: ComplianceRequest, violations: PolicyEvaluationResult[]): void {
    for (const violation of violations) {
      for (const v of violation.violations) {
        this.violations.push({
          id: this.generateId(),
          requestId: request.id,
          policyId: violation.policyId,
          ruleId: v.ruleId,
          description: v.description,
          severity: v.severity,
          timestamp: v.timestamp,
          resolved: false
        });
      }
    }

    this.metrics.violationCount += violations.reduce((sum, v) => sum + v.violations.length, 0);
  }

  private updateComplianceMetrics(result: ComplianceResult): void {
    const totalRequests = this.auditLog.filter(e => e.action === 'compliance-evaluated').length + 1;
    const compliantRequests = result.decision === 'allow' ? 1 : 0;
    
    this.metrics.complianceRate = (this.metrics.complianceRate * (totalRequests - 1) + compliantRequests) / totalRequests;
  }

  private async initiateApprovalProcess(request: ComplianceRequest, policy: GovernancePolicy): Promise<string> {
    const approvalId = this.generateId();
    
    // Find required approvers based on policy parameters
    const rule = policy.rules.find(r => r.action === 'require-approval');
    const approverCount = rule?.parameters?.approvers || 1;
    const requiredRoles = rule?.parameters?.roles || ['manager'];

    const eligibleApprovers = Array.from(this.stakeholders.values())
      .filter(s => s.isActive && requiredRoles.some(role => s.specializations.includes(role)))
      .slice(0, approverCount);

    // Notify approvers
    for (const approver of eligibleApprovers) {
      this.emit('approvalRequired', {
        approvalId,
        requestId: request.id,
        policyId: policy.id,
        approverId: approver.id
      });
    }

    return approvalId;
  }

  private async sendAlert(policy: GovernancePolicy, request: ComplianceRequest, evaluation: PolicyEvaluationResult): Promise<void> {
    const rule = policy.rules.find(r => r.action === 'alert');
    const notifyList = rule?.parameters?.notify || ['admin'];

    const stakeholdersToNotify = Array.from(this.stakeholders.values())
      .filter(s => s.isActive && notifyList.some(role => s.specializations.includes(role)));

    for (const stakeholder of stakeholdersToNotify) {
      this.emit('alertSent', {
        stakeholderId: stakeholder.id,
        policyId: policy.id,
        requestId: request.id,
        reason: evaluation.reason
      });
    }
  }

  private async escalateViolation(policy: GovernancePolicy, request: ComplianceRequest, evaluation: PolicyEvaluationResult): Promise<void> {
    const rule = policy.rules.find(r => r.action === 'escalate');
    const notifyList = rule?.parameters?.notify || ['security-team'];

    const stakeholdersToNotify = Array.from(this.stakeholders.values())
      .filter(s => s.isActive && notifyList.some(role => s.specializations.includes(role)));

    for (const stakeholder of stakeholdersToNotify) {
      this.emit('violationEscalated', {
        stakeholderId: stakeholder.id,
        policyId: policy.id,
        requestId: request.id,
        severity: 'high',
        details: evaluation
      });
    }
  }

  private startComplianceMonitoring(): void {
    // Start periodic compliance monitoring
    setInterval(() => {
      this.performComplianceAudit();
    }, this.config.auditInterval || 24 * 60 * 60 * 1000); // Daily by default
  }

  private async performComplianceAudit(): Promise<void> {
    const auditResults = {
      timestamp: new Date(),
      totalPolicies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.status === 'active').length,
      totalViolations: this.violations.length,
      unresolvedViolations: this.violations.filter(v => !v.resolved).length,
      stakeholderCount: this.stakeholders.size,
      activeStakeholders: Array.from(this.stakeholders.values()).filter(s => s.isActive).length
    };

    this.emit('complianceAuditCompleted', auditResults);
  }

  private signVote(vote: Omit<Vote, 'timestamp' | 'signature'>, stakeholderId: string): string {
    const payload = `${stakeholderId}:${vote.decision}:${vote.rationale || ''}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  private logAuditEntry(entry: Omit<AuditEntry, 'id'>): void {
    const auditEntry: AuditEntry = {
      id: this.generateId(),
      ...entry
    };

    this.auditLog.push(auditEntry);
    
    // Limit audit log size
    if (this.auditLog.length > (this.config.maxAuditEntries || 10000)) {
      this.auditLog = this.auditLog.slice(-5000); // Keep last 5000 entries
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get governance metrics
   */
  getMetrics(): GovernanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all policies
   */
  getPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): GovernancePolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all proposals
   */
  getProposals(): Proposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Get all stakeholders
   */
  getStakeholders(): Stakeholder[] {
    return Array.from(this.stakeholders.values());
  }

  /**
   * Get violations
   */
  getViolations(filter?: { resolved?: boolean; severity?: string }): ViolationRecord[] {
    let filteredViolations = this.violations;

    if (filter?.resolved !== undefined) {
      filteredViolations = filteredViolations.filter(v => v.resolved === filter.resolved);
    }

    if (filter?.severity) {
      filteredViolations = filteredViolations.filter(v => v.severity === filter.severity);
    }

    return filteredViolations;
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): AuditEntry[] {
    const entries = this.auditLog.slice().reverse(); // Most recent first
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Resolve violation
   */
  resolveViolation(violationId: string, resolution: string): void {
    const violation = this.violations.find(v => v.id === violationId);
    if (violation) {
      violation.resolved = true;
      violation.resolution = resolution;
      violation.resolvedAt = new Date();

      this.logAuditEntry({
        action: 'violation-resolved',
        details: { violationId, resolution },
        timestamp: new Date(),
        actor: 'user'
      });
    }
  }
}

// Supporting interfaces
interface GovernanceConfig {
  auditInterval?: number;
  maxAuditEntries?: number;
  defaultVotingPeriod?: number;
  defaultQuorum?: number;
  defaultMajorityThreshold?: number;
}

interface ComplianceRequest {
  id: string;
  user: {
    id: string;
    roles: string[];
  };
  resource?: {
    type: string;
    id: string;
    sensitivity?: string;
  };
  action: string;
  scope: string;
  data?: any;
  auth?: any;
  timestamp: Date;
}

interface ComplianceResult {
  requestId: string;
  decision: PolicyAction;
  blockedBy: string[];
  evaluations: PolicyEvaluationResult[];
  processingTime: number;
  timestamp: Date;
  requiresApproval: boolean;
  violations: PolicyEvaluationResult[];
}

interface PolicyEvaluationResult {
  policyId: string;
  decision: PolicyAction;
  reason?: string;
  violations: PolicyViolation[];
  parameters: Record<string, any>;
  timestamp: Date;
}

interface PolicyViolation {
  ruleId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

interface RuleEvaluationResult {
  ruleId: string;
  passed: boolean;
  details: Record<string, any>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface VotingResult {
  isComplete: boolean;
  result: 'approved' | 'rejected' | 'pending';
  details: Record<string, any>;
}

interface EnforcementResult {
  requestId: string;
  actions: EnforcementAction[];
  allowed: boolean;
  timestamp: Date;
}

interface EnforcementAction {
  type: 'block' | 'require-approval' | 'log' | 'alert' | 'escalate';
  policyId: string;
  reason?: string;
  approvalId?: string;
  logLevel?: string;
  timestamp: Date;
}

interface ViolationRecord {
  id: string;
  requestId: string;
  policyId: string;
  ruleId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
  resolvedAt?: Date;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  actor: string;
}

// Factory function
export function createGovernanceEngine(config?: GovernanceConfig): GatekeeperGovernanceEngine {
  return new GatekeeperGovernanceEngine(config);
}

// Export default instance
export const governanceEngine = createGovernanceEngine({
  auditInterval: 24 * 60 * 60 * 1000, // 24 hours
  maxAuditEntries: 50000,
  defaultVotingPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  defaultQuorum: 0.5,
  defaultMajorityThreshold: 0.6
});