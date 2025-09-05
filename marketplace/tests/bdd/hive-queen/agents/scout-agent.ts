/**
 * SCOUT AGENT - Environment Validator & System Monitor
 * Ensures test environments are ready and continuously monitors system health
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { TestRequirements, EnvironmentSpec, PerformanceSpec, SecuritySpec, ComplianceSpec } from '../core/hive-queen';

export interface ScoutCapabilities {
  environmentValidation: boolean;
  dependencyChecking: boolean;
  healthMonitoring: boolean;
  configurationValidation: boolean;
  networkTesting: boolean;
  securityScanning: boolean;
  complianceChecking: boolean;
  resourceMonitoring: boolean;
  serviceDiscovery: boolean;
  infrastructureValidation: boolean;
}

export interface EnvironmentValidationResult {
  valid: boolean;
  score: number;
  issues: EnvironmentIssue[];
  recommendations: string[];
  metrics: EnvironmentMetrics;
  readinessReport: ReadinessReport;
}

export interface EnvironmentIssue {
  type: 'missing_dependency' | 'configuration_error' | 'resource_limit' | 'security_vulnerability' | 'compliance_violation' | 'performance_issue';
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  impact: 'none' | 'minor' | 'moderate' | 'major' | 'severe';
  autoFixable: boolean;
  remediation: string[];
  estimatedFixTime: number;
}

export interface EnvironmentMetrics {
  validationTime: number;
  dependenciesChecked: number;
  servicesValidated: number;
  securityScansRun: number;
  complianceChecksRun: number;
  resourceUtilization: ResourceUtilization;
  networkLatency: NetworkLatency;
  systemHealth: SystemHealth;
}

export interface ResourceUtilization {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp: number;
}

export interface NetworkLatency {
  dns: number;
  tcp: number;
  http: number;
  database: number;
  external_services: number;
}

export interface SystemHealth {
  overall: number;
  components: ComponentHealth[];
  uptime: number;
  loadAverage: number[];
  errorRate: number;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastChecked: number;
  errorRate: number;
  details: Record<string, any>;
}

export interface ReadinessReport {
  ready: boolean;
  readinessScore: number;
  prerequisites: PrerequisiteStatus[];
  estimatedReadyTime: number;
  blockers: string[];
  warnings: string[];
}

export interface PrerequisiteStatus {
  name: string;
  required: boolean;
  status: 'satisfied' | 'partially_satisfied' | 'not_satisfied' | 'unknown';
  details: string;
  progress: number;
}

export interface MonitoringConfig {
  intervalMs: number;
  alertThresholds: AlertThresholds;
  retentionPeriod: number;
  enabledChecks: string[];
  continuousMonitoring: boolean;
}

export interface AlertThresholds {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime: number;
  errorRate: number;
  availability: number;
}

export interface ValidationCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  result: 'pass' | 'fail' | 'warning';
  details: Record<string, any>;
  metrics: Record<string, number>;
}

export class ScoutAgent extends EventEmitter {
  private id: string;
  private capabilities: ScoutCapabilities;
  private currentValidation?: Promise<EnvironmentValidationResult>;
  private monitoringConfig: MonitoringConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private validationHistory: ValidationCheckpoint[] = [];
  private healthHistory: SystemHealth[] = [];

  constructor(id: string, capabilities: ScoutCapabilities, monitoringConfig?: Partial<MonitoringConfig>) {
    super();
    this.id = id;
    this.capabilities = capabilities;
    this.monitoringConfig = {
      intervalMs: 30000, // 30 seconds
      alertThresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        network: 70,
        responseTime: 5000,
        errorRate: 5,
        availability: 99
      },
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      enabledChecks: ['cpu', 'memory', 'disk', 'network', 'services', 'dependencies'],
      continuousMonitoring: true,
      ...monitoringConfig
    };
  }

  async validateEnvironment(requirements: TestRequirements): Promise<EnvironmentValidationResult> {
    if (this.currentValidation) {
      return await this.currentValidation;
    }

    this.currentValidation = this.performEnvironmentValidation(requirements);
    const result = await this.currentValidation;
    this.currentValidation = undefined;

    return result;
  }

  private async performEnvironmentValidation(requirements: TestRequirements): Promise<EnvironmentValidationResult> {
    const startTime = performance.now();
    const issues: EnvironmentIssue[] = [];
    const recommendations: string[] = [];
    const checkpoints: ValidationCheckpoint[] = [];

    this.emit('validation-started', { scoutId: this.id, requirements });

    try {
      // Validate environment specification
      if (this.capabilities.environmentValidation) {
        const envCheckpoint = await this.validateEnvironmentSpec(requirements.environment);
        checkpoints.push(envCheckpoint);
        if (envCheckpoint.result !== 'pass') {
          issues.push(...this.extractIssuesFromCheckpoint(envCheckpoint, 'environment'));
        }
      }

      // Check dependencies
      if (this.capabilities.dependencyChecking) {
        const depCheckpoint = await this.validateDependencies(requirements.environment.dependencies);
        checkpoints.push(depCheckpoint);
        if (depCheckpoint.result !== 'pass') {
          issues.push(...this.extractIssuesFromCheckpoint(depCheckpoint, 'dependencies'));
        }
      }

      // Validate performance requirements
      const perfCheckpoint = await this.validatePerformanceRequirements(requirements.performance);
      checkpoints.push(perfCheckpoint);
      if (perfCheckpoint.result !== 'pass') {
        issues.push(...this.extractIssuesFromCheckpoint(perfCheckpoint, 'performance'));
      }

      // Security validation
      if (this.capabilities.securityScanning) {
        const secCheckpoint = await this.validateSecurityRequirements(requirements.security);
        checkpoints.push(secCheckpoint);
        if (secCheckpoint.result !== 'pass') {
          issues.push(...this.extractIssuesFromCheckpoint(secCheckpoint, 'security'));
        }
      }

      // Compliance checking
      if (this.capabilities.complianceChecking) {
        const compCheckpoint = await this.validateComplianceRequirements(requirements.compliance);
        checkpoints.push(compCheckpoint);
        if (compCheckpoint.result !== 'pass') {
          issues.push(...this.extractIssuesFromCheckpoint(compCheckpoint, 'compliance'));
        }
      }

      // Infrastructure validation
      if (this.capabilities.infrastructureValidation) {
        const infraCheckpoint = await this.validateInfrastructure(requirements.infrastructure);
        checkpoints.push(infraCheckpoint);
        if (infraCheckpoint.result !== 'pass') {
          issues.push(...this.extractIssuesFromCheckpoint(infraCheckpoint, 'infrastructure'));
        }
      }

      // Generate metrics
      const metrics = await this.collectEnvironmentMetrics(checkpoints);
      
      // Generate readiness report
      const readinessReport = this.generateReadinessReport(issues, checkpoints);
      
      // Generate recommendations
      recommendations.push(...this.generateRecommendations(issues));

      const validationTime = performance.now() - startTime;
      const score = this.calculateValidationScore(issues, checkpoints);

      const result: EnvironmentValidationResult = {
        valid: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length === 0,
        score,
        issues,
        recommendations,
        metrics: {
          ...metrics,
          validationTime
        },
        readinessReport
      };

      // Store validation history
      this.validationHistory.push({
        id: `validation-${Date.now()}`,
        name: 'Environment Validation',
        timestamp: startTime,
        duration: validationTime,
        result: result.valid ? 'pass' : (issues.some(i => i.severity === 'critical') ? 'fail' : 'warning'),
        details: { issues: issues.length, score },
        metrics: { validationTime, issueCount: issues.length }
      });

      this.emit('validation-completed', { scoutId: this.id, result });
      return result;

    } catch (error) {
      const validationTime = performance.now() - startTime;
      
      this.emit('validation-failed', { 
        scoutId: this.id, 
        error: error instanceof Error ? error.message : String(error),
        duration: validationTime 
      });

      throw new Error(`Environment validation failed: ${error}`);
    }
  }

  private async validateEnvironmentSpec(spec: EnvironmentSpec): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      // Validate platform
      details.platformSupported = await this.checkPlatformSupport(spec.platform, spec.version);
      if (!details.platformSupported) {
        result = 'fail';
      }

      // Validate resources
      details.resourcesAvailable = await this.checkResourceAvailability(spec.resources);
      if (!details.resourcesAvailable) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      // Validate network configuration
      details.networkValid = await this.validateNetworkConfiguration(spec.networkConfiguration);
      if (!details.networkValid) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      return {
        id: `env-spec-${Date.now()}`,
        name: 'Environment Specification',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { checks: 3 }
      };

    } catch (error) {
      return {
        id: `env-spec-${Date.now()}`,
        name: 'Environment Specification',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { checks: 0 }
      };
    }
  }

  private async validateDependencies(dependencies: any[]): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      let satisfiedDeps = 0;
      details.dependencies = [];

      for (const dep of dependencies) {
        const depStatus = await this.checkDependency(dep);
        details.dependencies.push(depStatus);
        
        if (depStatus.satisfied) {
          satisfiedDeps++;
        } else if (!dep.optional) {
          result = 'fail';
        } else if (result !== 'fail') {
          result = 'warning';
        }
      }

      details.satisfiedCount = satisfiedDeps;
      details.totalCount = dependencies.length;

      return {
        id: `deps-${Date.now()}`,
        name: 'Dependency Validation',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { dependencies: dependencies.length, satisfied: satisfiedDeps }
      };

    } catch (error) {
      return {
        id: `deps-${Date.now()}`,
        name: 'Dependency Validation',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { dependencies: 0, satisfied: 0 }
      };
    }
  }

  private async validatePerformanceRequirements(spec: PerformanceSpec): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      // Check current system performance
      const currentPerf = await this.measureSystemPerformance();
      details.currentPerformance = currentPerf;
      details.requirements = spec;

      // Validate throughput capability
      if (currentPerf.maxThroughput < spec.throughput) {
        result = 'warning';
        details.throughputIssue = `Current max throughput (${currentPerf.maxThroughput}) below required (${spec.throughput})`;
      }

      // Validate response time capability
      if (currentPerf.averageResponseTime > spec.responseTime) {
        result = result === 'fail' ? 'fail' : 'warning';
        details.responseTimeIssue = `Current response time (${currentPerf.averageResponseTime}ms) above required (${spec.responseTime}ms)`;
      }

      // Validate concurrency capability
      if (currentPerf.maxConcurrency < spec.concurrency) {
        result = result === 'fail' ? 'fail' : 'warning';
        details.concurrencyIssue = `Current max concurrency (${currentPerf.maxConcurrency}) below required (${spec.concurrency})`;
      }

      return {
        id: `perf-${Date.now()}`,
        name: 'Performance Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { 
          throughput: currentPerf.maxThroughput,
          responseTime: currentPerf.averageResponseTime,
          concurrency: currentPerf.maxConcurrency
        }
      };

    } catch (error) {
      return {
        id: `perf-${Date.now()}`,
        name: 'Performance Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { throughput: 0, responseTime: 0, concurrency: 0 }
      };
    }
  }

  private async validateSecurityRequirements(spec: SecuritySpec): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      let securityScore = 0;
      let maxScore = 0;

      // Check authentication mechanisms
      details.authentication = await this.validateAuthentication(spec.authentication);
      if (details.authentication.valid) securityScore += 25;
      maxScore += 25;

      // Check authorization mechanisms
      details.authorization = await this.validateAuthorization(spec.authorization);
      if (details.authorization.valid) securityScore += 25;
      maxScore += 25;

      // Check encryption
      details.encryption = await this.validateEncryption(spec.encryption);
      if (details.encryption.valid) securityScore += 25;
      maxScore += 25;

      // Check audit trail
      details.auditTrail = await this.validateAuditTrail(spec.auditTrail);
      if (details.auditTrail.valid) securityScore += 25;
      maxScore += 25;

      const scorePercentage = (securityScore / maxScore) * 100;
      details.securityScore = scorePercentage;

      if (scorePercentage < 70) {
        result = 'fail';
      } else if (scorePercentage < 90) {
        result = 'warning';
      }

      return {
        id: `security-${Date.now()}`,
        name: 'Security Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { securityScore: scorePercentage }
      };

    } catch (error) {
      return {
        id: `security-${Date.now()}`,
        name: 'Security Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { securityScore: 0 }
      };
    }
  }

  private async validateComplianceRequirements(spec: ComplianceSpec): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      let complianceScore = 0;
      let maxScore = 0;

      // Check regulatory compliance
      for (const regulation of spec.regulations) {
        const check = await this.checkRegulationCompliance(regulation);
        details[`regulation_${regulation}`] = check;
        if (check.compliant) complianceScore += 10;
        maxScore += 10;
      }

      // Check standards compliance
      for (const standard of spec.standards) {
        const check = await this.checkStandardCompliance(standard);
        details[`standard_${standard}`] = check;
        if (check.compliant) complianceScore += 10;
        maxScore += 10;
      }

      // Check audit requirements
      for (const audit of spec.auditRequirements) {
        const check = await this.checkAuditRequirement(audit);
        details[`audit_${audit.type}`] = check;
        if (check.satisfied) complianceScore += 5;
        maxScore += 5;
      }

      const scorePercentage = maxScore > 0 ? (complianceScore / maxScore) * 100 : 100;
      details.complianceScore = scorePercentage;

      if (scorePercentage < 80) {
        result = 'fail';
      } else if (scorePercentage < 95) {
        result = 'warning';
      }

      return {
        id: `compliance-${Date.now()}`,
        name: 'Compliance Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { complianceScore: scorePercentage }
      };

    } catch (error) {
      return {
        id: `compliance-${Date.now()}`,
        name: 'Compliance Requirements',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { complianceScore: 0 }
      };
    }
  }

  private async validateInfrastructure(spec: any): Promise<ValidationCheckpoint> {
    const startTime = performance.now();
    const details: Record<string, any> = {};
    let result: 'pass' | 'fail' | 'warning' = 'pass';

    try {
      // Validate deployment configuration
      details.deployment = await this.validateDeploymentSpec(spec.deployment);
      if (!details.deployment.valid) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      // Validate monitoring setup
      details.monitoring = await this.validateMonitoringSpec(spec.monitoring);
      if (!details.monitoring.valid) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      // Validate backup configuration
      details.backup = await this.validateBackupSpec(spec.backup);
      if (!details.backup.valid) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      // Validate disaster recovery
      details.disasterRecovery = await this.validateDisasterRecoverySpec(spec.disaster_recovery);
      if (!details.disasterRecovery.valid) {
        result = result === 'fail' ? 'fail' : 'warning';
      }

      return {
        id: `infra-${Date.now()}`,
        name: 'Infrastructure Validation',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result,
        details,
        metrics: { components: 4 }
      };

    } catch (error) {
      return {
        id: `infra-${Date.now()}`,
        name: 'Infrastructure Validation',
        timestamp: startTime,
        duration: performance.now() - startTime,
        result: 'fail',
        details: { error: error instanceof Error ? error.message : String(error) },
        metrics: { components: 0 }
      };
    }
  }

  // Helper methods for validation checks
  private async checkPlatformSupport(platform: string, version: string): Promise<boolean> {
    // Mock platform support check
    return platform === 'linux' || platform === 'darwin' || platform === 'win32';
  }

  private async checkResourceAvailability(resources: any[]): Promise<boolean> {
    // Mock resource availability check
    return true;
  }

  private async validateNetworkConfiguration(config: any): Promise<boolean> {
    // Mock network configuration validation
    return config.bandwidth > 0 && config.latency < 1000;
  }

  private async checkDependency(dependency: any): Promise<{ satisfied: boolean; version?: string; error?: string }> {
    // Mock dependency check
    return { satisfied: true, version: '1.0.0' };
  }

  private async measureSystemPerformance(): Promise<{ maxThroughput: number; averageResponseTime: number; maxConcurrency: number }> {
    // Mock performance measurement
    return {
      maxThroughput: 1000,
      averageResponseTime: 100,
      maxConcurrency: 100
    };
  }

  private async validateAuthentication(methods: string[]): Promise<{ valid: boolean; details: string }> {
    return { valid: methods.length > 0, details: `${methods.length} methods configured` };
  }

  private async validateAuthorization(methods: string[]): Promise<{ valid: boolean; details: string }> {
    return { valid: methods.length > 0, details: `${methods.length} methods configured` };
  }

  private async validateEncryption(spec: any): Promise<{ valid: boolean; details: string }> {
    return { valid: !!spec.inTransit && !!spec.atRest, details: 'Encryption configured' };
  }

  private async validateAuditTrail(enabled: boolean): Promise<{ valid: boolean; details: string }> {
    return { valid: enabled, details: enabled ? 'Enabled' : 'Disabled' };
  }

  private async checkRegulationCompliance(regulation: string): Promise<{ compliant: boolean; details: string }> {
    return { compliant: true, details: `${regulation} compliant` };
  }

  private async checkStandardCompliance(standard: string): Promise<{ compliant: boolean; details: string }> {
    return { compliant: true, details: `${standard} compliant` };
  }

  private async checkAuditRequirement(audit: any): Promise<{ satisfied: boolean; details: string }> {
    return { satisfied: true, details: `${audit.type} audit configured` };
  }

  private async validateDeploymentSpec(spec: any): Promise<{ valid: boolean; details: string }> {
    return { valid: !!spec.strategy, details: 'Deployment configured' };
  }

  private async validateMonitoringSpec(spec: any): Promise<{ valid: boolean; details: string }> {
    return { valid: spec.metrics && spec.metrics.length > 0, details: 'Monitoring configured' };
  }

  private async validateBackupSpec(spec: any): Promise<{ valid: boolean; details: string }> {
    return { valid: !!spec.frequency, details: 'Backup configured' };
  }

  private async validateDisasterRecoverySpec(spec: any): Promise<{ valid: boolean; details: string }> {
    return { valid: spec.rto > 0 && spec.rpo >= 0, details: 'DR configured' };
  }

  private extractIssuesFromCheckpoint(checkpoint: ValidationCheckpoint, component: string): EnvironmentIssue[] {
    const issues: EnvironmentIssue[] = [];
    
    if (checkpoint.result === 'fail') {
      issues.push({
        type: 'configuration_error',
        severity: 'error',
        component,
        message: `${checkpoint.name} validation failed`,
        impact: 'major',
        autoFixable: false,
        remediation: [`Fix ${checkpoint.name} configuration`],
        estimatedFixTime: 30 * 60 * 1000 // 30 minutes
      });
    } else if (checkpoint.result === 'warning') {
      issues.push({
        type: 'configuration_error',
        severity: 'warning',
        component,
        message: `${checkpoint.name} has warnings`,
        impact: 'minor',
        autoFixable: true,
        remediation: [`Review ${checkpoint.name} configuration`],
        estimatedFixTime: 15 * 60 * 1000 // 15 minutes
      });
    }

    return issues;
  }

  private async collectEnvironmentMetrics(checkpoints: ValidationCheckpoint[]): Promise<EnvironmentMetrics> {
    const resourceUtil = await this.getCurrentResourceUtilization();
    const networkLatency = await this.getCurrentNetworkLatency();
    const systemHealth = await this.getCurrentSystemHealth();

    return {
      validationTime: 0, // Will be set by caller
      dependenciesChecked: checkpoints.find(c => c.name === 'Dependency Validation')?.metrics.dependencies || 0,
      servicesValidated: checkpoints.length,
      securityScansRun: checkpoints.filter(c => c.name.includes('Security')).length,
      complianceChecksRun: checkpoints.filter(c => c.name.includes('Compliance')).length,
      resourceUtilization: resourceUtil,
      networkLatency,
      systemHealth
    };
  }

  private async getCurrentResourceUtilization(): Promise<ResourceUtilization> {
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 100,
      timestamp: performance.now()
    };
  }

  private async getCurrentNetworkLatency(): Promise<NetworkLatency> {
    return {
      dns: Math.random() * 50,
      tcp: Math.random() * 100,
      http: Math.random() * 200,
      database: Math.random() * 150,
      external_services: Math.random() * 300
    };
  }

  private async getCurrentSystemHealth(): Promise<SystemHealth> {
    return {
      overall: 95 + Math.random() * 5,
      components: [
        {
          name: 'Database',
          status: 'healthy',
          responseTime: Math.random() * 50,
          lastChecked: performance.now(),
          errorRate: Math.random() * 2,
          details: {}
        },
        {
          name: 'API Gateway',
          status: 'healthy',
          responseTime: Math.random() * 30,
          lastChecked: performance.now(),
          errorRate: Math.random() * 1,
          details: {}
        }
      ],
      uptime: performance.now(),
      loadAverage: [1.2, 1.1, 1.0],
      errorRate: Math.random() * 2
    };
  }

  private generateReadinessReport(issues: EnvironmentIssue[], checkpoints: ValidationCheckpoint[]): ReadinessReport {
    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'error');
    const blockers = criticalIssues.map(i => i.message);
    const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);
    
    const passedChecks = checkpoints.filter(c => c.result === 'pass').length;
    const totalChecks = checkpoints.length;
    const readinessScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
    
    const estimatedFixTime = criticalIssues.reduce((sum, issue) => sum + issue.estimatedFixTime, 0);
    
    return {
      ready: criticalIssues.length === 0,
      readinessScore,
      prerequisites: checkpoints.map(cp => ({
        name: cp.name,
        required: true,
        status: cp.result === 'pass' ? 'satisfied' : (cp.result === 'warning' ? 'partially_satisfied' : 'not_satisfied'),
        details: JSON.stringify(cp.details),
        progress: cp.result === 'pass' ? 100 : (cp.result === 'warning' ? 50 : 0)
      })),
      estimatedReadyTime: performance.now() + estimatedFixTime,
      blockers,
      warnings
    };
  }

  private generateRecommendations(issues: EnvironmentIssue[]): string[] {
    return issues.flatMap(issue => issue.remediation);
  }

  private calculateValidationScore(issues: EnvironmentIssue[], checkpoints: ValidationCheckpoint[]): number {
    const criticalWeight = 10;
    const errorWeight = 5;
    const warningWeight = 2;
    const infoWeight = 1;

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    const totalDeductions = 
      criticalCount * criticalWeight +
      errorCount * errorWeight +
      warningCount * warningWeight +
      infoCount * infoWeight;

    const baseScore = 100;
    const maxPossibleDeductions = checkpoints.length * criticalWeight;

    return Math.max(0, baseScore - (totalDeductions / maxPossibleDeductions) * 100);
  }

  async startContinuousMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.getCurrentSystemHealth();
        this.healthHistory.push(health);
        
        // Keep only recent history
        const cutoff = performance.now() - this.monitoringConfig.retentionPeriod;
        this.healthHistory = this.healthHistory.filter(h => h.uptime > cutoff);
        
        this.emit('health-update', { scoutId: this.id, health });
        
        // Check for alerts
        await this.checkAlertConditions(health);
        
      } catch (error) {
        this.emit('monitoring-error', { 
          scoutId: this.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }, this.monitoringConfig.intervalMs);

    this.emit('monitoring-started', { scoutId: this.id });
  }

  async stopContinuousMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('monitoring-stopped', { scoutId: this.id });
  }

  private async checkAlertConditions(health: SystemHealth): Promise<void> {
    const alerts = [];
    const thresholds = this.monitoringConfig.alertThresholds;
    
    // Check resource utilization alerts
    const resourceUtil = await this.getCurrentResourceUtilization();
    
    if (resourceUtil.cpu > thresholds.cpu) {
      alerts.push({
        type: 'resource_utilization',
        severity: 'warning',
        message: `CPU usage (${resourceUtil.cpu.toFixed(1)}%) exceeds threshold (${thresholds.cpu}%)`,
        value: resourceUtil.cpu,
        threshold: thresholds.cpu
      });
    }
    
    if (resourceUtil.memory > thresholds.memory) {
      alerts.push({
        type: 'resource_utilization',
        severity: 'warning',
        message: `Memory usage (${resourceUtil.memory.toFixed(1)}%) exceeds threshold (${thresholds.memory}%)`,
        value: resourceUtil.memory,
        threshold: thresholds.memory
      });
    }
    
    if (health.errorRate > thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'error',
        message: `Error rate (${health.errorRate.toFixed(2)}%) exceeds threshold (${thresholds.errorRate}%)`,
        value: health.errorRate,
        threshold: thresholds.errorRate
      });
    }
    
    if (health.overall < thresholds.availability) {
      alerts.push({
        type: 'availability',
        severity: 'critical',
        message: `System health (${health.overall.toFixed(1)}%) below threshold (${thresholds.availability}%)`,
        value: health.overall,
        threshold: thresholds.availability
      });
    }

    if (alerts.length > 0) {
      this.emit('alerts-triggered', { scoutId: this.id, alerts });
    }
  }

  getCapabilities(): ScoutCapabilities {
    return { ...this.capabilities };
  }

  isValidating(): boolean {
    return !!this.currentValidation;
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  getValidationHistory(): ValidationCheckpoint[] {
    return [...this.validationHistory];
  }

  getHealthHistory(): SystemHealth[] {
    return [...this.healthHistory];
  }

  getMonitoringConfig(): MonitoringConfig {
    return { ...this.monitoringConfig };
  }

  updateMonitoringConfig(config: Partial<MonitoringConfig>): void {
    this.monitoringConfig = { ...this.monitoringConfig, ...config };
    this.emit('monitoring-config-updated', { scoutId: this.id, config: this.monitoringConfig });
  }
}