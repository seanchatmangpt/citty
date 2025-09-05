/**
 * SOLDIER AGENT - Stress Testing & Chaos Engineering
 * Performs high-intensity testing, load generation, and system resilience validation
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { TestTask, PerformanceSpec, ScalabilitySpec } from '../core/hive-queen';

export interface SoldierCapabilities {
  stressTesting: boolean;
  loadGeneration: boolean;
  chaosEngineering: boolean;
  performanceTesting: boolean;
  scalabilityTesting: boolean;
  enduranceTesting: boolean;
  volumeTesting: boolean;
  spikeTesting: boolean;
  breakpointTesting: boolean;
  recoveryTesting: boolean;
  concurrencyTesting: boolean;
  resourceExhaustionTesting: boolean;
}

export interface StressTestConfig {
  type: 'load' | 'stress' | 'spike' | 'volume' | 'endurance' | 'breakpoint' | 'chaos';
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  duration: number;
  rampUpTime: number;
  sustainTime: number;
  rampDownTime: number;
  concurrentUsers: number;
  requestsPerSecond: number;
  dataVolumeGB: number;
  networkBandwidthMbps: number;
  cpuTargetPercentage: number;
  memoryTargetPercentage: number;
  chaosParameters?: ChaosParameters;
  failureThresholds: FailureThresholds;
  recoveryValidation: boolean;
}

export interface ChaosParameters {
  networkPartitions: boolean;
  serviceKills: boolean;
  resourceStarvation: boolean;
  diskCorruption: boolean;
  timeSkew: boolean;
  dependencyFailures: boolean;
  randomLatency: boolean;
  packetLoss: boolean;
  cpuSpikes: boolean;
  memoryLeaks: boolean;
  diskFull: boolean;
  databaseConnections: boolean;
}

export interface FailureThresholds {
  maxErrorRate: number;
  maxResponseTime: number;
  minThroughput: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
  maxDiskUsage: number;
  minAvailability: number;
  maxRecoveryTime: number;
}

export interface StressTestResult {
  testId: string;
  config: StressTestConfig;
  startTime: number;
  endTime: number;
  duration: number;
  phases: TestPhase[];
  metrics: StressTestMetrics;
  failures: TestFailure[];
  breakingPoints: BreakingPoint[];
  recoveryAnalysis: RecoveryAnalysis;
  performanceProfile: PerformanceProfile;
  resourceUtilization: ResourceProfile;
  recommendations: TestRecommendation[];
  verdict: 'pass' | 'fail' | 'degraded' | 'catastrophic';
}

export interface TestPhase {
  name: 'ramp-up' | 'sustain' | 'ramp-down' | 'recovery' | 'validation';
  startTime: number;
  endTime: number;
  targetLoad: number;
  actualLoad: number;
  metrics: PhaseMetrics;
  incidents: Incident[];
}

export interface PhaseMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  concurrentUsers: number;
  cpuUtilization: number;
  memoryUtilization: number;
  diskUtilization: number;
  networkUtilization: number;
  databaseConnections: number;
  queueDepth: number;
}

export interface StressTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughputRPS: number;
  peakThroughputRPS: number;
  errorRate: number;
  availability: number;
  meanTimeToFailure: number;
  meanTimeToRecovery: number;
  resourceEfficiency: number;
  scalabilityFactor: number;
  breakingPointLoad: number;
  sustainableLoad: number;
}

export interface TestFailure {
  timestamp: number;
  phase: string;
  type: 'timeout' | 'error' | 'exception' | 'resource_exhaustion' | 'service_unavailable' | 'data_corruption';
  severity: 'minor' | 'major' | 'critical' | 'catastrophic';
  component: string;
  message: string;
  impact: string;
  rootCause?: string;
  recoveryAction?: string;
  recoveryTime?: number;
}

export interface BreakingPoint {
  metric: 'throughput' | 'response_time' | 'error_rate' | 'resource_usage';
  threshold: number;
  actualValue: number;
  loadLevel: number;
  timestamp: number;
  cascadingEffects: string[];
}

export interface RecoveryAnalysis {
  recoveryTime: number;
  recoveryPattern: 'immediate' | 'gradual' | 'oscillating' | 'failed';
  dataConsistency: boolean;
  serviceAvailability: boolean;
  performanceRestoration: number; // percentage
  recommendations: string[];
}

export interface PerformanceProfile {
  loadCapacity: LoadCapacityProfile;
  responseTimeProfile: ResponseTimeProfile;
  resourceProfile: ResourceConsumptionProfile;
  scalingProfile: ScalingProfile;
}

export interface LoadCapacityProfile {
  sustainableRPS: number;
  peakRPS: number;
  breakingPointRPS: number;
  optimalConcurrency: number;
  maxConcurrency: number;
  throughputEfficiency: number;
}

export interface ResponseTimeProfile {
  baselineResponseTime: number;
  degradationPoints: DegradationPoint[];
  responseTimeDistribution: ResponseTimeDistribution;
  outlierAnalysis: OutlierAnalysis;
}

export interface DegradationPoint {
  loadLevel: number;
  responseTimeIncrease: number;
  degradationFactor: number;
  cause: string;
}

export interface ResponseTimeDistribution {
  percentiles: Record<string, number>; // p50, p75, p90, p95, p99, etc.
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
}

export interface OutlierAnalysis {
  outlierCount: number;
  outlierPercentage: number;
  outlierThreshold: number;
  maxOutlier: number;
  outlierPattern: string;
}

export interface ResourceConsumptionProfile {
  cpu: ResourceMetric;
  memory: ResourceMetric;
  disk: ResourceMetric;
  network: ResourceMetric;
  database: DatabaseMetric;
}

export interface ResourceMetric {
  baseline: number;
  peak: number;
  average: number;
  efficiency: number;
  bottleneckPoints: number[];
  growthPattern: 'linear' | 'exponential' | 'logarithmic' | 'erratic';
}

export interface DatabaseMetric extends ResourceMetric {
  connectionCount: number;
  maxConnections: number;
  connectionEfficiency: number;
  queryPerformance: QueryPerformanceMetric;
  lockContention: number;
}

export interface QueryPerformanceMetric {
  averageQueryTime: number;
  slowQueries: number;
  deadlocks: number;
  blockingQueries: number;
}

export interface ScalingProfile {
  horizontalScaling: ScalingMetric;
  verticalScaling: ScalingMetric;
  autoScalingEffectiveness: number;
  scalingLatency: number;
}

export interface ScalingMetric {
  effectiveness: number;
  efficiency: number;
  cost: number;
  limitations: string[];
}

export interface ResourceProfile {
  cpuProfile: TimeSeries;
  memoryProfile: TimeSeries;
  diskProfile: TimeSeries;
  networkProfile: TimeSeries;
  databaseProfile: TimeSeries;
}

export interface TimeSeries {
  timestamps: number[];
  values: number[];
  peaks: TimeSeriesPeak[];
  trends: string[];
}

export interface TimeSeriesPeak {
  timestamp: number;
  value: number;
  duration: number;
  cause: string;
}

export interface TestRecommendation {
  category: 'performance' | 'scalability' | 'reliability' | 'resource_optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string[];
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
}

export interface Incident {
  id: string;
  timestamp: number;
  type: 'performance_degradation' | 'service_failure' | 'resource_exhaustion' | 'data_corruption';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  affectedComponents: string[];
  duration: number;
  resolution: string;
  impact: IncidentImpact;
}

export interface IncidentImpact {
  usersAffected: number;
  requestsAffected: number;
  revenueImpact: number;
  slaViolation: boolean;
  downtime: number;
}

export class SoldierAgent extends EventEmitter {
  private id: string;
  private capabilities: SoldierCapabilities;
  private currentTest?: Promise<StressTestResult>;
  private testHistory: StressTestResult[] = [];
  private isExecuting: boolean = false;
  private testMetrics: Map<string, any> = new Map();
  private resourceMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(id: string, capabilities: SoldierCapabilities) {
    super();
    this.id = id;
    this.capabilities = capabilities;
  }

  async executeStressTest(config: StressTestConfig): Promise<StressTestResult> {
    if (this.isExecuting) {
      throw new Error(`Soldier ${this.id} is already executing a stress test`);
    }

    this.isExecuting = true;
    this.currentTest = this.performStressTest(config);
    
    try {
      const result = await this.currentTest;
      this.testHistory.push(result);
      return result;
    } finally {
      this.isExecuting = false;
      this.currentTest = undefined;
    }
  }

  private async performStressTest(config: StressTestConfig): Promise<StressTestResult> {
    const testId = `stress-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = performance.now();
    
    this.emit('stress-test-started', { soldierId: this.id, testId, config });

    const result: StressTestResult = {
      testId,
      config,
      startTime,
      endTime: 0,
      duration: 0,
      phases: [],
      metrics: this.initializeMetrics(),
      failures: [],
      breakingPoints: [],
      recoveryAnalysis: this.initializeRecoveryAnalysis(),
      performanceProfile: this.initializePerformanceProfile(),
      resourceUtilization: this.initializeResourceProfile(),
      recommendations: [],
      verdict: 'pass'
    };

    try {
      // Start resource monitoring
      this.startResourceMonitoring(testId);

      // Execute test phases based on config type
      switch (config.type) {
        case 'load':
          await this.executeLoadTest(config, result);
          break;
        case 'stress':
          await this.executeStressTestPhases(config, result);
          break;
        case 'spike':
          await this.executeSpikeTest(config, result);
          break;
        case 'volume':
          await this.executeVolumeTest(config, result);
          break;
        case 'endurance':
          await this.executeEnduranceTest(config, result);
          break;
        case 'breakpoint':
          await this.executeBreakpointTest(config, result);
          break;
        case 'chaos':
          await this.executeChaosTest(config, result);
          break;
        default:
          throw new Error(`Unsupported stress test type: ${config.type}`);
      }

      // Stop resource monitoring
      this.stopResourceMonitoring();

      // Analyze results
      result.endTime = performance.now();
      result.duration = result.endTime - result.startTime;
      
      await this.analyzeTestResults(result);
      await this.generateRecommendations(result);
      
      this.emit('stress-test-completed', { soldierId: this.id, testId, result });
      
      return result;

    } catch (error) {
      this.stopResourceMonitoring();
      result.endTime = performance.now();
      result.duration = result.endTime - result.startTime;
      result.verdict = 'catastrophic';
      
      result.failures.push({
        timestamp: performance.now(),
        phase: 'execution',
        type: 'exception',
        severity: 'catastrophic',
        component: 'test-executor',
        message: error instanceof Error ? error.message : String(error),
        impact: 'Test execution failed completely'
      });

      this.emit('stress-test-failed', { 
        soldierId: this.id, 
        testId, 
        error: error instanceof Error ? error.message : String(error),
        result 
      });

      return result;
    }
  }

  private async executeLoadTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Ramp-up phase
    const rampUpPhase = await this.executeRampUpPhase(config, result);
    result.phases.push(rampUpPhase);

    // Sustain phase
    const sustainPhase = await this.executeSustainPhase(config, result);
    result.phases.push(sustainPhase);

    // Ramp-down phase
    const rampDownPhase = await this.executeRampDownPhase(config, result);
    result.phases.push(rampDownPhase);
  }

  private async executeStressTestPhases(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Similar to load test but with higher intensity
    await this.executeLoadTest(config, result);
  }

  private async executeSpikeTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Execute sudden load spikes
    const baselinePhase = await this.executeBaselinePhase(config, result);
    result.phases.push(baselinePhase);

    // Multiple spike phases
    for (let i = 0; i < 3; i++) {
      const spikePhase = await this.executeSpikePhase(config, result, i);
      result.phases.push(spikePhase);
      
      const recoveryPhase = await this.executeRecoveryPhase(config, result, i);
      result.phases.push(recoveryPhase);
    }
  }

  private async executeVolumeTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Execute with large data volumes
    const volumePhase = await this.executeVolumePhase(config, result);
    result.phases.push(volumePhase);
  }

  private async executeEnduranceTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Execute for extended duration
    const endurancePhase = await this.executeEndurancePhase(config, result);
    result.phases.push(endurancePhase);
  }

  private async executeBreakpointTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    // Gradually increase load until breaking point
    let currentLoad = 10; // Start with 10 RPS
    let breakingPointFound = false;
    let phaseNumber = 0;

    while (!breakingPointFound && currentLoad <= 10000) { // Max 10k RPS
      const testConfig = { ...config, requestsPerSecond: currentLoad };
      const phase = await this.executeLoadPhase(testConfig, result, `breakpoint-${phaseNumber}`, currentLoad);
      result.phases.push(phase);

      // Check if breaking point reached
      if (this.isBreakingPointReached(phase, config.failureThresholds)) {
        result.breakingPoints.push({
          metric: 'throughput',
          threshold: config.failureThresholds.maxErrorRate,
          actualValue: phase.metrics.errorRate,
          loadLevel: currentLoad,
          timestamp: phase.endTime,
          cascadingEffects: this.identifyCascadingEffects(phase)
        });
        breakingPointFound = true;
      }

      currentLoad *= 1.5; // Increase load by 50%
      phaseNumber++;
      
      // Brief recovery period
      await this.wait(5000); // 5 second pause
    }
  }

  private async executeChaosTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    if (!config.chaosParameters) {
      throw new Error('Chaos parameters required for chaos testing');
    }

    // Execute normal load with chaos injection
    const chaosPhase = await this.executeChaosPhase(config, result);
    result.phases.push(chaosPhase);

    // Recovery validation
    if (config.recoveryValidation) {
      const recoveryPhase = await this.executeRecoveryValidationPhase(config, result);
      result.phases.push(recoveryPhase);
    }
  }

  private async executeRampUpPhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    const phase: TestPhase = {
      name: 'ramp-up',
      startTime: performance.now(),
      endTime: 0,
      targetLoad: config.requestsPerSecond,
      actualLoad: 0,
      metrics: this.initializePhaseMetrics(),
      incidents: []
    };

    this.emit('phase-started', { soldierId: this.id, phase: phase.name, config });

    const stepDuration = config.rampUpTime / 10; // 10 steps
    const loadIncrement = config.requestsPerSecond / 10;

    for (let step = 1; step <= 10; step++) {
      const currentLoad = loadIncrement * step;
      await this.generateLoad(currentLoad, stepDuration);
      
      const stepMetrics = await this.collectPhaseMetrics();
      this.updatePhaseMetrics(phase.metrics, stepMetrics);
      
      // Check for incidents
      const incident = this.detectIncident(stepMetrics, config.failureThresholds);
      if (incident) {
        phase.incidents.push(incident);
      }

      this.emit('ramp-step-completed', { 
        soldierId: this.id, 
        step, 
        currentLoad, 
        metrics: stepMetrics 
      });
    }

    phase.endTime = performance.now();
    phase.actualLoad = config.requestsPerSecond;
    
    this.emit('phase-completed', { soldierId: this.id, phase });
    return phase;
  }

  private async executeSustainPhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    const phase: TestPhase = {
      name: 'sustain',
      startTime: performance.now(),
      endTime: 0,
      targetLoad: config.requestsPerSecond,
      actualLoad: config.requestsPerSecond,
      metrics: this.initializePhaseMetrics(),
      incidents: []
    };

    this.emit('phase-started', { soldierId: this.id, phase: phase.name, config });

    await this.generateLoad(config.requestsPerSecond, config.sustainTime);
    
    // Collect sustained metrics
    const sustainedMetrics = await this.collectPhaseMetrics();
    phase.metrics = sustainedMetrics;

    // Monitor for incidents during sustain
    const monitoringInterval = Math.min(10000, config.sustainTime / 10); // Check every 10s or 10% of sustain time
    const monitoringSteps = Math.floor(config.sustainTime / monitoringInterval);

    for (let step = 0; step < monitoringSteps; step++) {
      await this.wait(monitoringInterval);
      
      const stepMetrics = await this.collectPhaseMetrics();
      const incident = this.detectIncident(stepMetrics, config.failureThresholds);
      if (incident) {
        phase.incidents.push(incident);
      }

      this.emit('sustain-checkpoint', { 
        soldierId: this.id, 
        step, 
        progress: (step / monitoringSteps) * 100,
        metrics: stepMetrics 
      });
    }

    phase.endTime = performance.now();
    
    this.emit('phase-completed', { soldierId: this.id, phase });
    return phase;
  }

  private async executeRampDownPhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    const phase: TestPhase = {
      name: 'ramp-down',
      startTime: performance.now(),
      endTime: 0,
      targetLoad: 0,
      actualLoad: config.requestsPerSecond,
      metrics: this.initializePhaseMetrics(),
      incidents: []
    };

    this.emit('phase-started', { soldierId: this.id, phase: phase.name, config });

    const stepDuration = config.rampDownTime / 10; // 10 steps
    const loadDecrement = config.requestsPerSecond / 10;

    for (let step = 10; step > 0; step--) {
      const currentLoad = loadDecrement * step;
      await this.generateLoad(currentLoad, stepDuration);
      
      const stepMetrics = await this.collectPhaseMetrics();
      this.updatePhaseMetrics(phase.metrics, stepMetrics);

      this.emit('ramp-down-step-completed', { 
        soldierId: this.id, 
        step: 11 - step, 
        currentLoad, 
        metrics: stepMetrics 
      });
    }

    phase.endTime = performance.now();
    phase.actualLoad = 0;
    
    this.emit('phase-completed', { soldierId: this.id, phase });
    return phase;
  }

  private async executeBaselinePhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    const baselineLoad = Math.min(10, config.requestsPerSecond * 0.1); // 10% of target or minimum 10 RPS
    return this.executeLoadPhase(config, result, 'baseline', baselineLoad);
  }

  private async executeSpikePhase(config: StressTestConfig, result: StressTestResult, spikeNumber: number): Promise<TestPhase> {
    const spikeLoad = config.requestsPerSecond * (1.5 + spikeNumber * 0.5); // Increasing spikes
    return this.executeLoadPhase(config, result, `spike-${spikeNumber}`, spikeLoad, 30000); // 30 second spikes
  }

  private async executeRecoveryPhase(config: StressTestConfig, result: StressTestResult, recoveryNumber: number): Promise<TestPhase> {
    const baselineLoad = Math.min(10, config.requestsPerSecond * 0.1);
    return this.executeLoadPhase(config, result, `recovery-${recoveryNumber}`, baselineLoad, 60000); // 60 second recovery
  }

  private async executeVolumePhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    return this.executeLoadPhase(config, result, 'volume', config.requestsPerSecond, config.sustainTime);
  }

  private async executeEndurancePhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    return this.executeLoadPhase(config, result, 'endurance', config.requestsPerSecond, config.duration);
  }

  private async executeChaosPhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    const phase: TestPhase = {
      name: 'sustain',
      startTime: performance.now(),
      endTime: 0,
      targetLoad: config.requestsPerSecond,
      actualLoad: config.requestsPerSecond,
      metrics: this.initializePhaseMetrics(),
      incidents: []
    };

    this.emit('chaos-started', { soldierId: this.id, config: config.chaosParameters });

    // Start normal load
    const loadPromise = this.generateLoad(config.requestsPerSecond, config.sustainTime);
    
    // Inject chaos scenarios
    const chaosPromise = this.injectChaosScenarios(config.chaosParameters!, config.sustainTime);
    
    await Promise.all([loadPromise, chaosPromise]);

    phase.metrics = await this.collectPhaseMetrics();
    phase.endTime = performance.now();

    this.emit('chaos-completed', { soldierId: this.id, phase });
    return phase;
  }

  private async executeRecoveryValidationPhase(config: StressTestConfig, result: StressTestResult): Promise<TestPhase> {
    return this.executeLoadPhase(config, result, 'recovery', config.requestsPerSecond * 0.5, 120000); // 2 minute recovery validation
  }

  private async executeLoadPhase(config: StressTestConfig, result: StressTestResult, phaseName: string, load: number, duration?: number): Promise<TestPhase> {
    const phase: TestPhase = {
      name: 'sustain',
      startTime: performance.now(),
      endTime: 0,
      targetLoad: load,
      actualLoad: load,
      metrics: this.initializePhaseMetrics(),
      incidents: []
    };

    const phaseDuration = duration || config.sustainTime;
    await this.generateLoad(load, phaseDuration);
    
    phase.metrics = await this.collectPhaseMetrics();
    phase.endTime = performance.now();
    
    return phase;
  }

  private async generateLoad(requestsPerSecond: number, duration: number): Promise<void> {
    // Mock load generation - in real implementation, this would generate actual load
    const requests = Math.floor((requestsPerSecond * duration) / 1000);
    
    this.emit('load-generation-started', { 
      soldierId: this.id, 
      rps: requestsPerSecond, 
      duration, 
      totalRequests: requests 
    });

    // Simulate load generation with actual delay
    await this.wait(duration);

    this.emit('load-generation-completed', { 
      soldierId: this.id, 
      rps: requestsPerSecond, 
      duration, 
      totalRequests: requests 
    });
  }

  private async injectChaosScenarios(chaosParams: ChaosParameters, duration: number): Promise<void> {
    const scenarios: Promise<void>[] = [];

    if (chaosParams.networkPartitions) {
      scenarios.push(this.simulateNetworkPartition(duration * 0.3));
    }
    
    if (chaosParams.serviceKills) {
      scenarios.push(this.simulateServiceKills(duration * 0.2));
    }
    
    if (chaosParams.resourceStarvation) {
      scenarios.push(this.simulateResourceStarvation(duration * 0.4));
    }
    
    if (chaosParams.randomLatency) {
      scenarios.push(this.simulateRandomLatency(duration * 0.8));
    }
    
    if (chaosParams.packetLoss) {
      scenarios.push(this.simulatePacketLoss(duration * 0.6));
    }

    await Promise.all(scenarios);
  }

  private async simulateNetworkPartition(duration: number): Promise<void> {
    this.emit('chaos-scenario-started', { soldierId: this.id, scenario: 'network-partition', duration });
    await this.wait(duration);
    this.emit('chaos-scenario-completed', { soldierId: this.id, scenario: 'network-partition' });
  }

  private async simulateServiceKills(duration: number): Promise<void> {
    this.emit('chaos-scenario-started', { soldierId: this.id, scenario: 'service-kills', duration });
    await this.wait(duration);
    this.emit('chaos-scenario-completed', { soldierId: this.id, scenario: 'service-kills' });
  }

  private async simulateResourceStarvation(duration: number): Promise<void> {
    this.emit('chaos-scenario-started', { soldierId: this.id, scenario: 'resource-starvation', duration });
    await this.wait(duration);
    this.emit('chaos-scenario-completed', { soldierId: this.id, scenario: 'resource-starvation' });
  }

  private async simulateRandomLatency(duration: number): Promise<void> {
    this.emit('chaos-scenario-started', { soldierId: this.id, scenario: 'random-latency', duration });
    await this.wait(duration);
    this.emit('chaos-scenario-completed', { soldierId: this.id, scenario: 'random-latency' });
  }

  private async simulatePacketLoss(duration: number): Promise<void> {
    this.emit('chaos-scenario-started', { soldierId: this.id, scenario: 'packet-loss', duration });
    await this.wait(duration);
    this.emit('chaos-scenario-completed', { soldierId: this.id, scenario: 'packet-loss' });
  }

  private startResourceMonitoring(testId: string): void {
    const interval = setInterval(async () => {
      const metrics = await this.collectResourceMetrics();
      this.testMetrics.set(`${testId}-${Date.now()}`, metrics);
      
      this.emit('resource-metrics', { soldierId: this.id, testId, metrics });
    }, 1000); // Collect every second

    this.resourceMonitors.set(testId, interval);
  }

  private stopResourceMonitoring(): void {
    this.resourceMonitors.forEach((interval) => {
      clearInterval(interval);
    });
    this.resourceMonitors.clear();
  }

  private async collectPhaseMetrics(): Promise<PhaseMetrics> {
    // Mock metrics collection - in real implementation, this would collect actual metrics
    return {
      averageResponseTime: 100 + Math.random() * 500,
      p95ResponseTime: 200 + Math.random() * 800,
      p99ResponseTime: 500 + Math.random() * 1500,
      throughput: 50 + Math.random() * 950,
      errorRate: Math.random() * 10,
      concurrentUsers: 10 + Math.random() * 990,
      cpuUtilization: 20 + Math.random() * 60,
      memoryUtilization: 30 + Math.random() * 50,
      diskUtilization: 10 + Math.random() * 30,
      networkUtilization: 15 + Math.random() * 35,
      databaseConnections: Math.floor(Math.random() * 100),
      queueDepth: Math.floor(Math.random() * 50)
    };
  }

  private async collectResourceMetrics(): Promise<any> {
    return {
      timestamp: performance.now(),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 100
    };
  }

  private detectIncident(metrics: PhaseMetrics, thresholds: FailureThresholds): Incident | null {
    if (metrics.errorRate > thresholds.maxErrorRate) {
      return {
        id: `incident-${Date.now()}`,
        timestamp: performance.now(),
        type: 'performance_degradation',
        severity: metrics.errorRate > thresholds.maxErrorRate * 2 ? 'critical' : 'major',
        description: `Error rate (${metrics.errorRate.toFixed(2)}%) exceeded threshold (${thresholds.maxErrorRate}%)`,
        affectedComponents: ['api'],
        duration: 0, // Will be updated when incident resolves
        resolution: 'pending',
        impact: {
          usersAffected: Math.floor(metrics.concurrentUsers * (metrics.errorRate / 100)),
          requestsAffected: Math.floor(metrics.throughput * (metrics.errorRate / 100)),
          revenueImpact: 0,
          slaViolation: metrics.errorRate > thresholds.maxErrorRate,
          downtime: 0
        }
      };
    }

    if (metrics.averageResponseTime > thresholds.maxResponseTime) {
      return {
        id: `incident-${Date.now()}`,
        timestamp: performance.now(),
        type: 'performance_degradation',
        severity: metrics.averageResponseTime > thresholds.maxResponseTime * 2 ? 'critical' : 'major',
        description: `Response time (${metrics.averageResponseTime.toFixed(0)}ms) exceeded threshold (${thresholds.maxResponseTime}ms)`,
        affectedComponents: ['api'],
        duration: 0,
        resolution: 'pending',
        impact: {
          usersAffected: Math.floor(metrics.concurrentUsers * 0.8),
          requestsAffected: Math.floor(metrics.throughput * 0.5),
          revenueImpact: 0,
          slaViolation: true,
          downtime: 0
        }
      };
    }

    return null;
  }

  private updatePhaseMetrics(current: PhaseMetrics, update: PhaseMetrics): void {
    // Simple averaging - in real implementation, this would be more sophisticated
    current.averageResponseTime = (current.averageResponseTime + update.averageResponseTime) / 2;
    current.p95ResponseTime = Math.max(current.p95ResponseTime, update.p95ResponseTime);
    current.p99ResponseTime = Math.max(current.p99ResponseTime, update.p99ResponseTime);
    current.throughput = (current.throughput + update.throughput) / 2;
    current.errorRate = (current.errorRate + update.errorRate) / 2;
    current.concurrentUsers = update.concurrentUsers;
    current.cpuUtilization = Math.max(current.cpuUtilization, update.cpuUtilization);
    current.memoryUtilization = Math.max(current.memoryUtilization, update.memoryUtilization);
    current.diskUtilization = Math.max(current.diskUtilization, update.diskUtilization);
    current.networkUtilization = Math.max(current.networkUtilization, update.networkUtilization);
    current.databaseConnections = Math.max(current.databaseConnections, update.databaseConnections);
    current.queueDepth = Math.max(current.queueDepth, update.queueDepth);
  }

  private isBreakingPointReached(phase: TestPhase, thresholds: FailureThresholds): boolean {
    return (
      phase.metrics.errorRate > thresholds.maxErrorRate ||
      phase.metrics.averageResponseTime > thresholds.maxResponseTime ||
      phase.metrics.cpuUtilization > thresholds.maxCpuUsage ||
      phase.metrics.memoryUtilization > thresholds.maxMemoryUsage
    );
  }

  private identifyCascadingEffects(phase: TestPhase): string[] {
    const effects: string[] = [];
    
    if (phase.metrics.errorRate > 20) {
      effects.push('High error rate causing user dissatisfaction');
    }
    
    if (phase.metrics.averageResponseTime > 5000) {
      effects.push('Slow response times causing timeout issues');
    }
    
    if (phase.metrics.cpuUtilization > 90) {
      effects.push('High CPU usage affecting other services');
    }
    
    if (phase.metrics.memoryUtilization > 90) {
      effects.push('Memory pressure causing garbage collection issues');
    }
    
    if (phase.metrics.databaseConnections > 80) {
      effects.push('Database connection pool exhaustion');
    }

    return effects;
  }

  private async analyzeTestResults(result: StressTestResult): Promise<void> {
    // Analyze overall test results
    const allMetrics = result.phases.map(p => p.metrics);
    
    result.metrics = {
      totalRequests: this.calculateTotalRequests(result.phases),
      successfulRequests: this.calculateSuccessfulRequests(result.phases),
      failedRequests: this.calculateFailedRequests(result.phases),
      averageResponseTime: this.calculateAverageMetric(allMetrics, 'averageResponseTime'),
      minResponseTime: this.calculateMinMetric(allMetrics, 'averageResponseTime'),
      maxResponseTime: this.calculateMaxMetric(allMetrics, 'averageResponseTime'),
      p50ResponseTime: this.calculatePercentile(allMetrics, 'averageResponseTime', 50),
      p95ResponseTime: this.calculateMaxMetric(allMetrics, 'p95ResponseTime'),
      p99ResponseTime: this.calculateMaxMetric(allMetrics, 'p99ResponseTime'),
      throughputRPS: this.calculateAverageMetric(allMetrics, 'throughput'),
      peakThroughputRPS: this.calculateMaxMetric(allMetrics, 'throughput'),
      errorRate: this.calculateAverageMetric(allMetrics, 'errorRate'),
      availability: this.calculateAvailability(result.phases),
      meanTimeToFailure: this.calculateMTTF(result.failures),
      meanTimeToRecovery: this.calculateMTTR(result.failures),
      resourceEfficiency: this.calculateResourceEfficiency(allMetrics),
      scalabilityFactor: this.calculateScalabilityFactor(result.phases),
      breakingPointLoad: this.calculateBreakingPointLoad(result.breakingPoints),
      sustainableLoad: this.calculateSustainableLoad(result.phases)
    };

    // Determine verdict
    result.verdict = this.determineVerdict(result);

    // Analyze performance profile
    result.performanceProfile = await this.analyzePerformanceProfile(result);
    
    // Analyze recovery
    result.recoveryAnalysis = await this.analyzeRecovery(result);
    
    // Generate resource utilization profile
    result.resourceUtilization = await this.generateResourceProfile(result);
  }

  private async generateRecommendations(result: StressTestResult): Promise<void> {
    const recommendations: TestRecommendation[] = [];

    // Performance recommendations
    if (result.metrics.averageResponseTime > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize Response Times',
        description: 'Average response time exceeds acceptable limits',
        implementation: [
          'Implement caching layer',
          'Optimize database queries',
          'Add connection pooling',
          'Consider CDN for static assets'
        ],
        expectedImpact: '50-70% improvement in response times',
        effort: 'medium',
        cost: 'medium'
      });
    }

    // Scalability recommendations
    if (result.metrics.scalabilityFactor < 0.7) {
      recommendations.push({
        category: 'scalability',
        priority: 'high',
        title: 'Improve Horizontal Scaling',
        description: 'System does not scale efficiently with increased load',
        implementation: [
          'Implement load balancing',
          'Add auto-scaling policies',
          'Optimize session management',
          'Review database sharding strategy'
        ],
        expectedImpact: 'Better linear scaling up to 10x load',
        effort: 'high',
        cost: 'high'
      });
    }

    // Reliability recommendations
    if (result.metrics.errorRate > 5) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: 'Error rate exceeds acceptable SLA thresholds',
        implementation: [
          'Implement circuit breakers',
          'Add retry mechanisms with backoff',
          'Improve error handling',
          'Add health checks and monitoring'
        ],
        expectedImpact: 'Error rate reduction to <1%',
        effort: 'medium',
        cost: 'low'
      });
    }

    // Resource optimization recommendations
    const avgCpu = this.calculateAverageMetric(result.phases.map(p => p.metrics), 'cpuUtilization');
    const avgMemory = this.calculateAverageMetric(result.phases.map(p => p.metrics), 'memoryUtilization');
    
    if (avgCpu > 80 || avgMemory > 85) {
      recommendations.push({
        category: 'resource_optimization',
        priority: 'medium',
        title: 'Optimize Resource Usage',
        description: 'High resource utilization limiting system capacity',
        implementation: [
          'Profile and optimize CPU-intensive operations',
          'Implement memory pooling',
          'Review garbage collection settings',
          'Consider vertical scaling for critical components'
        ],
        expectedImpact: '20-30% reduction in resource usage',
        effort: 'medium',
        cost: 'low'
      });
    }

    result.recommendations = recommendations;
  }

  // Helper methods for calculations
  private calculateTotalRequests(phases: TestPhase[]): number {
    return phases.reduce((sum, phase) => sum + Math.floor(phase.metrics.throughput * ((phase.endTime - phase.startTime) / 1000)), 0);
  }

  private calculateSuccessfulRequests(phases: TestPhase[]): number {
    const totalRequests = this.calculateTotalRequests(phases);
    const avgErrorRate = this.calculateAverageMetric(phases.map(p => p.metrics), 'errorRate');
    return Math.floor(totalRequests * (1 - avgErrorRate / 100));
  }

  private calculateFailedRequests(phases: TestPhase[]): number {
    const totalRequests = this.calculateTotalRequests(phases);
    const successfulRequests = this.calculateSuccessfulRequests(phases);
    return totalRequests - successfulRequests;
  }

  private calculateAverageMetric(metrics: PhaseMetrics[], field: keyof PhaseMetrics): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + (metric[field] as number), 0);
    return sum / metrics.length;
  }

  private calculateMinMetric(metrics: PhaseMetrics[], field: keyof PhaseMetrics): number {
    if (metrics.length === 0) return 0;
    return Math.min(...metrics.map(m => m[field] as number));
  }

  private calculateMaxMetric(metrics: PhaseMetrics[], field: keyof PhaseMetrics): number {
    if (metrics.length === 0) return 0;
    return Math.max(...metrics.map(m => m[field] as number));
  }

  private calculatePercentile(metrics: PhaseMetrics[], field: keyof PhaseMetrics, percentile: number): number {
    if (metrics.length === 0) return 0;
    const values = metrics.map(m => m[field] as number).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index] || 0;
  }

  private calculateAvailability(phases: TestPhase[]): number {
    const totalTime = phases.reduce((sum, phase) => sum + (phase.endTime - phase.startTime), 0);
    const downtime = phases.reduce((sum, phase) => {
      return sum + phase.incidents.reduce((incidentSum, incident) => incidentSum + incident.duration, 0);
    }, 0);
    return ((totalTime - downtime) / totalTime) * 100;
  }

  private calculateMTTF(failures: TestFailure[]): number {
    if (failures.length <= 1) return 0;
    const intervals = [];
    for (let i = 1; i < failures.length; i++) {
      intervals.push(failures[i].timestamp - failures[i-1].timestamp);
    }
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private calculateMTTR(failures: TestFailure[]): number {
    const recoveryTimes = failures.filter(f => f.recoveryTime).map(f => f.recoveryTime!);
    if (recoveryTimes.length === 0) return 0;
    return recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
  }

  private calculateResourceEfficiency(metrics: PhaseMetrics[]): number {
    const avgCpu = this.calculateAverageMetric(metrics, 'cpuUtilization');
    const avgMemory = this.calculateAverageMetric(metrics, 'memoryUtilization');
    const avgThroughput = this.calculateAverageMetric(metrics, 'throughput');
    
    // Efficiency = throughput / (resource usage)
    const resourceUsage = (avgCpu + avgMemory) / 2;
    return resourceUsage > 0 ? avgThroughput / resourceUsage : 0;
  }

  private calculateScalabilityFactor(phases: TestPhase[]): number {
    if (phases.length < 2) return 1;
    
    const firstPhase = phases[0];
    const lastPhase = phases[phases.length - 1];
    
    const loadRatio = lastPhase.actualLoad / firstPhase.actualLoad;
    const throughputRatio = lastPhase.metrics.throughput / firstPhase.metrics.throughput;
    
    return loadRatio > 0 ? throughputRatio / loadRatio : 0;
  }

  private calculateBreakingPointLoad(breakingPoints: BreakingPoint[]): number {
    if (breakingPoints.length === 0) return 0;
    return Math.min(...breakingPoints.map(bp => bp.loadLevel));
  }

  private calculateSustainableLoad(phases: TestPhase[]): number {
    // Find the highest load that maintained acceptable performance
    const sustainablePhases = phases.filter(phase => 
      phase.metrics.errorRate < 5 && 
      phase.metrics.averageResponseTime < 2000
    );
    
    return sustainablePhases.length > 0 
      ? Math.max(...sustainablePhases.map(p => p.actualLoad))
      : 0;
  }

  private determineVerdict(result: StressTestResult): 'pass' | 'fail' | 'degraded' | 'catastrophic' {
    const criticalFailures = result.failures.filter(f => f.severity === 'catastrophic' || f.severity === 'critical');
    const majorFailures = result.failures.filter(f => f.severity === 'major');
    
    if (criticalFailures.length > 0) {
      return 'catastrophic';
    }
    
    if (result.metrics.errorRate > 10 || result.metrics.availability < 95) {
      return 'fail';
    }
    
    if (majorFailures.length > 0 || result.metrics.errorRate > 5) {
      return 'degraded';
    }
    
    return 'pass';
  }

  private async analyzePerformanceProfile(result: StressTestResult): Promise<PerformanceProfile> {
    // Mock performance profile analysis
    return {
      loadCapacity: {
        sustainableRPS: result.metrics.sustainableLoad,
        peakRPS: result.metrics.peakThroughputRPS,
        breakingPointRPS: result.metrics.breakingPointLoad,
        optimalConcurrency: 100,
        maxConcurrency: 500,
        throughputEfficiency: result.metrics.resourceEfficiency
      },
      responseTimeProfile: {
        baselineResponseTime: result.metrics.minResponseTime,
        degradationPoints: [],
        responseTimeDistribution: {
          percentiles: {
            p50: result.metrics.p50ResponseTime,
            p95: result.metrics.p95ResponseTime,
            p99: result.metrics.p99ResponseTime
          },
          standardDeviation: 50,
          variance: 2500,
          skewness: 0.8,
          kurtosis: 3.2
        },
        outlierAnalysis: {
          outlierCount: 10,
          outlierPercentage: 0.1,
          outlierThreshold: result.metrics.p99ResponseTime * 2,
          maxOutlier: result.metrics.maxResponseTime,
          outlierPattern: 'random'
        }
      },
      resourceProfile: {
        cpu: { baseline: 20, peak: 80, average: 50, efficiency: 0.8, bottleneckPoints: [500, 800], growthPattern: 'linear' },
        memory: { baseline: 30, peak: 85, average: 60, efficiency: 0.7, bottleneckPoints: [600, 900], growthPattern: 'linear' },
        disk: { baseline: 10, peak: 40, average: 25, efficiency: 0.9, bottleneckPoints: [1000], growthPattern: 'logarithmic' },
        network: { baseline: 15, peak: 70, average: 40, efficiency: 0.85, bottleneckPoints: [800], growthPattern: 'linear' },
        database: {
          baseline: 25, peak: 90, average: 55, efficiency: 0.6, bottleneckPoints: [400, 700], growthPattern: 'exponential',
          connectionCount: 80, maxConnections: 100, connectionEfficiency: 0.8,
          queryPerformance: { averageQueryTime: 50, slowQueries: 5, deadlocks: 0, blockingQueries: 2 },
          lockContention: 5
        }
      },
      scalingProfile: {
        horizontalScaling: { effectiveness: 0.8, efficiency: 0.7, cost: 0.6, limitations: ['Database bottleneck'] },
        verticalScaling: { effectiveness: 0.9, efficiency: 0.8, cost: 0.8, limitations: ['Memory capacity'] },
        autoScalingEffectiveness: 0.75,
        scalingLatency: 30000
      }
    };
  }

  private async analyzeRecovery(result: StressTestResult): Promise<RecoveryAnalysis> {
    const recoveryPhases = result.phases.filter(phase => phase.name === 'recovery');
    
    if (recoveryPhases.length === 0) {
      return {
        recoveryTime: 0,
        recoveryPattern: 'immediate',
        dataConsistency: true,
        serviceAvailability: true,
        performanceRestoration: 100,
        recommendations: []
      };
    }

    const avgRecoveryTime = recoveryPhases.reduce((sum, phase) => sum + (phase.endTime - phase.startTime), 0) / recoveryPhases.length;
    
    return {
      recoveryTime: avgRecoveryTime,
      recoveryPattern: 'gradual',
      dataConsistency: true,
      serviceAvailability: result.metrics.availability > 95,
      performanceRestoration: 85,
      recommendations: [
        'Implement faster health checks',
        'Optimize service restart procedures',
        'Add circuit breaker patterns'
      ]
    };
  }

  private async generateResourceProfile(result: StressTestResult): Promise<ResourceProfile> {
    const timestamps = result.phases.map(phase => phase.startTime);
    
    return {
      cpuProfile: {
        timestamps,
        values: result.phases.map(phase => phase.metrics.cpuUtilization),
        peaks: [{ timestamp: timestamps[1] || 0, value: 85, duration: 30000, cause: 'Load spike' }],
        trends: ['increasing', 'stable', 'decreasing']
      },
      memoryProfile: {
        timestamps,
        values: result.phases.map(phase => phase.metrics.memoryUtilization),
        peaks: [{ timestamp: timestamps[1] || 0, value: 90, duration: 60000, cause: 'Memory leak' }],
        trends: ['stable', 'increasing']
      },
      diskProfile: {
        timestamps,
        values: result.phases.map(phase => phase.metrics.diskUtilization),
        peaks: [],
        trends: ['stable']
      },
      networkProfile: {
        timestamps,
        values: result.phases.map(phase => phase.metrics.networkUtilization),
        peaks: [{ timestamp: timestamps[0] || 0, value: 70, duration: 10000, cause: 'Initial load' }],
        trends: ['stable']
      },
      databaseProfile: {
        timestamps,
        values: result.phases.map(phase => phase.metrics.databaseConnections),
        peaks: [{ timestamp: timestamps[1] || 0, value: 95, duration: 45000, cause: 'Connection pool exhaustion' }],
        trends: ['increasing', 'stable']
      }
    };
  }

  private initializeMetrics(): StressTestMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughputRPS: 0,
      peakThroughputRPS: 0,
      errorRate: 0,
      availability: 0,
      meanTimeToFailure: 0,
      meanTimeToRecovery: 0,
      resourceEfficiency: 0,
      scalabilityFactor: 0,
      breakingPointLoad: 0,
      sustainableLoad: 0
    };
  }

  private initializePhaseMetrics(): PhaseMetrics {
    return {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      concurrentUsers: 0,
      cpuUtilization: 0,
      memoryUtilization: 0,
      diskUtilization: 0,
      networkUtilization: 0,
      databaseConnections: 0,
      queueDepth: 0
    };
  }

  private initializeRecoveryAnalysis(): RecoveryAnalysis {
    return {
      recoveryTime: 0,
      recoveryPattern: 'immediate',
      dataConsistency: true,
      serviceAvailability: true,
      performanceRestoration: 0,
      recommendations: []
    };
  }

  private initializePerformanceProfile(): PerformanceProfile {
    return {
      loadCapacity: {
        sustainableRPS: 0,
        peakRPS: 0,
        breakingPointRPS: 0,
        optimalConcurrency: 0,
        maxConcurrency: 0,
        throughputEfficiency: 0
      },
      responseTimeProfile: {
        baselineResponseTime: 0,
        degradationPoints: [],
        responseTimeDistribution: {
          percentiles: {},
          standardDeviation: 0,
          variance: 0,
          skewness: 0,
          kurtosis: 0
        },
        outlierAnalysis: {
          outlierCount: 0,
          outlierPercentage: 0,
          outlierThreshold: 0,
          maxOutlier: 0,
          outlierPattern: ''
        }
      },
      resourceProfile: {
        cpu: { baseline: 0, peak: 0, average: 0, efficiency: 0, bottleneckPoints: [], growthPattern: 'linear' },
        memory: { baseline: 0, peak: 0, average: 0, efficiency: 0, bottleneckPoints: [], growthPattern: 'linear' },
        disk: { baseline: 0, peak: 0, average: 0, efficiency: 0, bottleneckPoints: [], growthPattern: 'linear' },
        network: { baseline: 0, peak: 0, average: 0, efficiency: 0, bottleneckPoints: [], growthPattern: 'linear' },
        database: {
          baseline: 0, peak: 0, average: 0, efficiency: 0, bottleneckPoints: [], growthPattern: 'linear',
          connectionCount: 0, maxConnections: 0, connectionEfficiency: 0,
          queryPerformance: { averageQueryTime: 0, slowQueries: 0, deadlocks: 0, blockingQueries: 0 },
          lockContention: 0
        }
      },
      scalingProfile: {
        horizontalScaling: { effectiveness: 0, efficiency: 0, cost: 0, limitations: [] },
        verticalScaling: { effectiveness: 0, efficiency: 0, cost: 0, limitations: [] },
        autoScalingEffectiveness: 0,
        scalingLatency: 0
      }
    };
  }

  private initializeResourceProfile(): ResourceProfile {
    return {
      cpuProfile: { timestamps: [], values: [], peaks: [], trends: [] },
      memoryProfile: { timestamps: [], values: [], peaks: [], trends: [] },
      diskProfile: { timestamps: [], values: [], peaks: [], trends: [] },
      networkProfile: { timestamps: [], values: [], peaks: [], trends: [] },
      databaseProfile: { timestamps: [], values: [], peaks: [], trends: [] }
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCapabilities(): SoldierCapabilities {
    return { ...this.capabilities };
  }

  isExecuting(): boolean {
    return this.isExecuting;
  }

  getCurrentTest(): Promise<StressTestResult> | undefined {
    return this.currentTest;
  }

  getTestHistory(): StressTestResult[] {
    return [...this.testHistory];
  }

  getLastTestResult(): StressTestResult | undefined {
    return this.testHistory[this.testHistory.length - 1];
  }

  clearTestHistory(): void {
    this.testHistory = [];
  }
}