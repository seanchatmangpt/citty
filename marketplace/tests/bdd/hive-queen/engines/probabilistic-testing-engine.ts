/**
 * PROBABILISTIC OUTCOME TESTING ENGINE
 * Monte Carlo simulations, statistical validation, and uncertainty quantification
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { ProbabilisticOutcome, OutcomeProbability, MonteCarloConfig } from '../core/hive-queen';

export interface ProbabilisticTestConfig {
  defaultIterations: number;
  confidenceLevel: number; // 0-1 (e.g., 0.95 for 95%)
  convergenceThreshold: number;
  maxIterations: number;
  parallelExecutionEnabled: boolean;
  adaptiveSampling: boolean;
  bayesianUpdating: boolean;
  uncertaintyQuantification: boolean;
}

export interface ProbabilityDistribution {
  type: 'normal' | 'uniform' | 'exponential' | 'poisson' | 'binomial' | 'beta' | 'gamma' | 'weibull' | 'custom';
  parameters: DistributionParameters;
  support: { min: number; max: number };
  moments: DistributionMoments;
  quantiles: Record<string, number>;
}

export interface DistributionParameters {
  mean?: number;
  variance?: number;
  standardDeviation?: number;
  shape?: number;
  scale?: number;
  rate?: number;
  alpha?: number;
  beta?: number;
  lambda?: number;
  n?: number;
  p?: number;
  customFunction?: (x: number) => number;
}

export interface DistributionMoments {
  mean: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  entropy: number;
}

export interface MonteCarloSimulation {
  id: string;
  name: string;
  description: string;
  scenario: string;
  config: MonteCarloConfig;
  inputDistributions: Map<string, ProbabilityDistribution>;
  outputMetrics: string[];
  constraints: SimulationConstraint[];
  samplingStrategy: SamplingStrategy;
  varianceReduction: VarianceReductionTechnique[];
}

export interface SimulationConstraint {
  type: 'linear' | 'nonlinear' | 'logical' | 'temporal';
  expression: string;
  description: string;
  penalty: number;
  hardConstraint: boolean;
}

export interface SamplingStrategy {
  method: 'random' | 'stratified' | 'latin_hypercube' | 'sobol' | 'halton' | 'quasi_random';
  stratification?: StratificationConfig;
  dimensions?: number;
  discrepancy?: number;
}

export interface StratificationConfig {
  variables: string[];
  strata: StrataDefinition[];
  proportionalAllocation: boolean;
}

export interface StrataDefinition {
  name: string;
  bounds: { min: number; max: number };
  weight: number;
  sampleSize: number;
}

export interface VarianceReductionTechnique {
  name: 'antithetic_variates' | 'control_variates' | 'importance_sampling' | 'stratified_sampling' | 'quasi_monte_carlo';
  parameters: Record<string, number>;
  expectedReduction: number;
  applicability: string[];
}

export interface SimulationResult {
  simulationId: string;
  simulation: MonteCarloSimulation;
  iterations: number;
  samples: SimulationSample[];
  statistics: SimulationStatistics;
  convergenceAnalysis: ConvergenceAnalysis;
  sensitivityAnalysis: SensitivityAnalysis;
  riskMetrics: RiskMetrics;
  uncertaintyBounds: UncertaintyBounds;
  recommendations: ProbabilisticRecommendation[];
  execution: ExecutionMetrics;
}

export interface SimulationSample {
  id: number;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  weight: number;
  valid: boolean;
  constraintViolations: string[];
  executionTime: number;
}

export interface SimulationStatistics {
  outputStatistics: Map<string, OutputStatistics>;
  correlationMatrix: number[][];
  covarianceMatrix: number[][];
  principalComponents: PrincipalComponent[];
  distributionFitting: DistributionFit[];
  percentileAnalysis: PercentileAnalysis;
}

export interface OutputStatistics {
  variable: string;
  samples: number;
  mean: number;
  median: number;
  mode: number;
  variance: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  minimum: number;
  maximum: number;
  range: number;
  percentiles: Record<string, number>;
  confidenceIntervals: ConfidenceInterval[];
  outliers: OutlierAnalysis;
}

export interface ConfidenceInterval {
  level: number; // e.g., 0.95
  lowerBound: number;
  upperBound: number;
  width: number;
  method: 'normal' | 'bootstrap' | 'percentile' | 'bayesian';
}

export interface OutlierAnalysis {
  count: number;
  percentage: number;
  indices: number[];
  values: number[];
  detectionMethod: 'iqr' | 'z_score' | 'modified_z_score' | 'isolation_forest';
  threshold: number;
}

export interface PrincipalComponent {
  index: number;
  eigenvalue: number;
  varianceExplained: number;
  cumulativeVariance: number;
  loadings: Record<string, number>;
}

export interface DistributionFit {
  variable: string;
  distributionType: string;
  parameters: Record<string, number>;
  goodnessOfFit: GoodnessOfFitTest[];
  aic: number;
  bic: number;
  logLikelihood: number;
}

export interface GoodnessOfFitTest {
  test: 'kolmogorov_smirnov' | 'anderson_darling' | 'shapiro_wilk' | 'chi_square';
  statistic: number;
  pValue: number;
  criticalValue: number;
  rejected: boolean;
}

export interface PercentileAnalysis {
  variable: string;
  percentiles: Record<string, number>;
  valueAtRisk: Record<string, number>; // VaR at different confidence levels
  expectedShortfall: Record<string, number>; // CVaR/ES
  extremeValues: ExtremeValueAnalysis;
}

export interface ExtremeValueAnalysis {
  block_maxima: number[];
  peaks_over_threshold: number[];
  threshold: number;
  exceedance_probability: number;
  return_levels: Record<string, number>; // e.g., 100-year return level
  gev_parameters?: { location: number; scale: number; shape: number };
  gpd_parameters?: { scale: number; shape: number };
}

export interface ConvergenceAnalysis {
  converged: boolean;
  convergenceIteration: number;
  convergenceCriteria: ConvergenceCriterion[];
  convergenceHistory: ConvergencePoint[];
  stabilityMetrics: StabilityMetric[];
  recommendedIterations: number;
  estimatedError: number;
}

export interface ConvergenceCriterion {
  metric: 'mean' | 'variance' | 'percentile' | 'custom';
  target: number;
  tolerance: number;
  satisfied: boolean;
  iterationSatisfied: number;
}

export interface ConvergencePoint {
  iteration: number;
  mean: number;
  variance: number;
  standardError: number;
  confidenceInterval: { lower: number; upper: number };
  rmsError: number;
}

export interface StabilityMetric {
  name: string;
  value: number;
  threshold: number;
  stable: boolean;
  description: string;
}

export interface SensitivityAnalysis {
  methods: string[];
  sobolIndices: SobolIndices[];
  correlationBased: CorrelationSensitivity[];
  regressionBased: RegressionSensitivity[];
  varianceDecomposition: VarianceDecomposition;
  interactions: InteractionEffect[];
  ranking: VariableRanking[];
}

export interface SobolIndices {
  variable: string;
  firstOrder: number;
  totalOrder: number;
  secondOrderInteractions?: Record<string, number>;
  confidenceInterval: { lower: number; upper: number };
}

export interface CorrelationSensitivity {
  variable: string;
  pearsonCorrelation: number;
  spearmanCorrelation: number;
  kendallTau: number;
  partialCorrelation: number;
  significance: number;
}

export interface RegressionSensitivity {
  variable: string;
  coefficient: number;
  standardizedCoefficient: number;
  pValue: number;
  confidenceInterval: { lower: number; upper: number };
  elasticity: number;
}

export interface VarianceDecomposition {
  totalVariance: number;
  explainedVariance: number;
  residualVariance: number;
  r_squared: number;
  adjusted_r_squared: number;
  contributions: Record<string, number>;
}

export interface InteractionEffect {
  variables: string[];
  effect: number;
  significance: number;
  type: 'linear' | 'nonlinear' | 'threshold';
}

export interface VariableRanking {
  rank: number;
  variable: string;
  importance: number;
  method: string;
  normalized: boolean;
}

export interface RiskMetrics {
  valueAtRisk: Record<string, number>;
  conditionalValueAtRisk: Record<string, number>;
  expectedShortfall: Record<string, number>;
  maximumDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  tailRisk: TailRiskMetrics;
  scenarioAnalysis: ScenarioRiskAnalysis[];
  stressTesting: StressTestResult[];
}

export interface TailRiskMetrics {
  tailIndex: number;
  hillEstimator: number;
  extremeValueIndex: number;
  tailProbability: number;
  expectedExcess: number;
}

export interface ScenarioRiskAnalysis {
  scenario: string;
  probability: number;
  impact: number;
  expectedLoss: number;
  worstCase: number;
  bestCase: number;
  riskContribution: number;
}

export interface StressTestResult {
  stressScenario: string;
  stressMagnitude: number;
  impactedVariables: string[];
  resultingChange: Record<string, number>;
  riskIncrease: number;
  recoveryTime: number;
}

export interface UncertaintyBounds {
  aleatory: AleatoricUncertainty; // Inherent randomness
  epistemic: EpistemicUncertainty; // Knowledge uncertainty
  combined: CombinedUncertainty;
  propagation: UncertaintyPropagation;
}

export interface AleatoricUncertainty {
  sources: UncertaintySource[];
  totalVariance: number;
  contributionAnalysis: Record<string, number>;
}

export interface EpistemicUncertainty {
  sources: UncertaintySource[];
  reducible: boolean;
  informationValue: number;
  expertJudgment: ExpertJudgment[];
}

export interface UncertaintySource {
  name: string;
  type: 'measurement' | 'model' | 'parameter' | 'scenario' | 'expert';
  magnitude: number;
  distribution: ProbabilityDistribution;
  confidence: number;
  reducibility: 'irreducible' | 'reducible' | 'partially_reducible';
}

export interface ExpertJudgment {
  expert: string;
  confidence: number;
  rationale: string;
  distribution: ProbabilityDistribution;
  weight: number;
}

export interface CombinedUncertainty {
  method: 'convolution' | 'monte_carlo' | 'polynomial_chaos' | 'interval_arithmetic';
  bounds: { lower: number; upper: number };
  intervals: UncertaintyInterval[];
  robustness: RobustnessAnalysis;
}

export interface UncertaintyInterval {
  confidence: number;
  lower: number;
  upper: number;
  width: number;
}

export interface RobustnessAnalysis {
  robustnessMetric: number;
  sensitiveRegions: SensitiveRegion[];
  breakingPoints: BreakingPoint[];
  stabilityMargin: number;
}

export interface SensitiveRegion {
  variables: string[];
  bounds: Record<string, { min: number; max: number }>;
  sensitivity: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface BreakingPoint {
  variable: string;
  value: number;
  consequence: string;
  probability: number;
  impact: number;
}

export interface UncertaintyPropagation {
  method: 'monte_carlo' | 'polynomial_chaos' | 'stochastic_collocation' | 'moment_matching';
  accuracy: number;
  efficiency: number;
  computational_cost: number;
  error_estimate: number;
}

export interface ProbabilisticRecommendation {
  category: 'sampling' | 'modeling' | 'risk_management' | 'uncertainty_reduction';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  implementation: string[];
  expectedBenefit: string;
  cost: 'low' | 'medium' | 'high';
  timeline: string;
  riskReduction: number;
  uncertaintyReduction: number;
}

export interface ExecutionMetrics {
  totalTime: number;
  samplingTime: number;
  computationTime: number;
  analysisTime: number;
  memoryUsage: number;
  cpuUtilization: number;
  parallelEfficiency: number;
  throughput: number; // samples per second
  convergenceSpeed: number;
  scalabilityFactor: number;
}

export interface BayesianUpdate {
  priorDistribution: ProbabilityDistribution;
  likelihood: ProbabilityDistribution;
  posteriorDistribution: ProbabilityDistribution;
  evidence: number;
  informationGain: number;
  klDivergence: number;
  updateMethod: 'analytical' | 'mcmc' | 'variational' | 'abc';
}

export class ProbabilisticTestingEngine extends EventEmitter {
  private config: ProbabilisticTestConfig;
  private simulations: Map<string, MonteCarloSimulation> = new Map();
  private results: Map<string, SimulationResult> = new Map();
  private distributionLibrary: Map<string, ProbabilityDistribution> = new Map();
  private randomSeeds: Map<string, number> = new Map();

  constructor(config: ProbabilisticTestConfig) {
    super();
    this.config = config;
    this.initializeDistributionLibrary();
  }

  private initializeDistributionLibrary(): void {
    // Standard Normal Distribution
    this.distributionLibrary.set('standard_normal', {
      type: 'normal',
      parameters: { mean: 0, variance: 1, standardDeviation: 1 },
      support: { min: -Infinity, max: Infinity },
      moments: { mean: 0, variance: 1, skewness: 0, kurtosis: 0, entropy: Math.log(2 * Math.PI * Math.E) / 2 },
      quantiles: {
        'p01': -2.326,
        'p05': -1.645,
        'p10': -1.282,
        'p25': -0.674,
        'p50': 0,
        'p75': 0.674,
        'p90': 1.282,
        'p95': 1.645,
        'p99': 2.326
      }
    });

    // Uniform Distribution [0,1]
    this.distributionLibrary.set('uniform_01', {
      type: 'uniform',
      parameters: { mean: 0.5, variance: 1/12, standardDeviation: Math.sqrt(1/12) },
      support: { min: 0, max: 1 },
      moments: { mean: 0.5, variance: 1/12, skewness: 0, kurtosis: -1.2, entropy: 0 },
      quantiles: {
        'p01': 0.01,
        'p05': 0.05,
        'p10': 0.10,
        'p25': 0.25,
        'p50': 0.50,
        'p75': 0.75,
        'p90': 0.90,
        'p95': 0.95,
        'p99': 0.99
      }
    });

    // Standard Exponential Distribution
    this.distributionLibrary.set('standard_exponential', {
      type: 'exponential',
      parameters: { rate: 1, mean: 1, variance: 1, standardDeviation: 1 },
      support: { min: 0, max: Infinity },
      moments: { mean: 1, variance: 1, skewness: 2, kurtosis: 6, entropy: 1 },
      quantiles: {
        'p01': 0.01005,
        'p05': 0.05129,
        'p10': 0.10536,
        'p25': 0.28768,
        'p50': 0.69315,
        'p75': 1.38629,
        'p90': 2.30259,
        'p95': 2.99573,
        'p99': 4.60517
      }
    });

    // Beta Distribution (symmetric)
    this.distributionLibrary.set('beta_symmetric', {
      type: 'beta',
      parameters: { alpha: 2, beta: 2, mean: 0.5, variance: 1/20, standardDeviation: Math.sqrt(1/20) },
      support: { min: 0, max: 1 },
      moments: { mean: 0.5, variance: 1/20, skewness: 0, kurtosis: -0.6, entropy: -0.8239 },
      quantiles: {
        'p01': 0.05132,
        'p05': 0.15849,
        'p10': 0.22361,
        'p25': 0.35355,
        'p50': 0.5,
        'p75': 0.64645,
        'p90': 0.77639,
        'p95': 0.84151,
        'p99': 0.94868
      }
    });
  }

  async runProbabilisticTest(simulation: MonteCarloSimulation): Promise<SimulationResult> {
    const simulationId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    simulation.id = simulationId;

    this.emit('simulation-started', { simulationId, simulation: simulation.name });

    const startTime = performance.now();

    try {
      // Initialize random seed for reproducibility
      if (simulation.config.randomSeed) {
        this.randomSeeds.set(simulationId, simulation.config.randomSeed);
      }

      // Generate samples
      const samples = await this.generateSamples(simulation);
      
      this.emit('sampling-completed', { simulationId, sampleCount: samples.length });

      // Run simulation for each sample
      const executedSamples = await this.executeSamples(simulation, samples);
      
      this.emit('execution-completed', { simulationId, executedSamples: executedSamples.length });

      // Calculate statistics
      const statistics = await this.calculateStatistics(executedSamples, simulation);

      // Convergence analysis
      const convergenceAnalysis = await this.analyzeConvergence(executedSamples, simulation);

      // Sensitivity analysis
      const sensitivityAnalysis = await this.performSensitivityAnalysis(executedSamples, simulation);

      // Risk metrics
      const riskMetrics = await this.calculateRiskMetrics(executedSamples, statistics);

      // Uncertainty quantification
      const uncertaintyBounds = await this.quantifyUncertainty(simulation, statistics, executedSamples);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        statistics, convergenceAnalysis, sensitivityAnalysis, riskMetrics
      );

      // Execution metrics
      const execution: ExecutionMetrics = {
        totalTime: performance.now() - startTime,
        samplingTime: 0, // Would be tracked separately in real implementation
        computationTime: 0,
        analysisTime: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUtilization: 0, // Would be measured
        parallelEfficiency: simulation.config.parallelization ? 0.8 : 1.0,
        throughput: executedSamples.length / ((performance.now() - startTime) / 1000),
        convergenceSpeed: convergenceAnalysis.convergenceIteration || simulation.config.iterations,
        scalabilityFactor: 1.0
      };

      const result: SimulationResult = {
        simulationId,
        simulation,
        iterations: executedSamples.length,
        samples: executedSamples,
        statistics,
        convergenceAnalysis,
        sensitivityAnalysis,
        riskMetrics,
        uncertaintyBounds,
        recommendations,
        execution
      };

      this.results.set(simulationId, result);
      
      this.emit('simulation-completed', { simulationId, result });

      return result;

    } catch (error) {
      this.emit('simulation-failed', {
        simulationId,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      });
      throw error;
    }
  }

  private async generateSamples(simulation: MonteCarloSimulation): Promise<SimulationSample[]> {
    const samples: SimulationSample[] = [];
    const iterations = simulation.config.iterations;
    
    // Initialize sampling strategy
    const sampler = this.createSampler(simulation.samplingStrategy, simulation.inputDistributions);
    
    for (let i = 0; i < iterations; i++) {
      const inputs = await this.generateSampleInputs(simulation.inputDistributions, sampler, i);
      
      const sample: SimulationSample = {
        id: i,
        inputs,
        outputs: {},
        weight: 1.0,
        valid: true,
        constraintViolations: [],
        executionTime: 0
      };

      // Check constraints
      const constraintViolations = this.checkConstraints(sample, simulation.constraints);
      sample.constraintViolations = constraintViolations;
      sample.valid = constraintViolations.length === 0;

      // Apply importance sampling weights if applicable
      if (this.usesImportanceSampling(simulation.varianceReduction)) {
        sample.weight = this.calculateImportanceWeight(sample, simulation);
      }

      samples.push(sample);

      // Emit progress for long-running simulations
      if (i % Math.max(1, Math.floor(iterations / 100)) === 0) {
        this.emit('sampling-progress', {
          simulationId: simulation.id,
          progress: (i / iterations) * 100,
          validSamples: samples.filter(s => s.valid).length
        });
      }
    }

    return samples;
  }

  private createSampler(strategy: SamplingStrategy, distributions: Map<string, ProbabilityDistribution>): any {
    // Factory method for different sampling strategies
    switch (strategy.method) {
      case 'random':
        return new RandomSampler();
      case 'latin_hypercube':
        return new LatinHypercubeSampler(distributions.size);
      case 'sobol':
        return new SobolSequenceSampler(distributions.size);
      case 'halton':
        return new HaltonSequenceSampler(distributions.size);
      case 'stratified':
        return new StratifiedSampler(strategy.stratification!);
      default:
        return new RandomSampler();
    }
  }

  private async generateSampleInputs(
    distributions: Map<string, ProbabilityDistribution>,
    sampler: any,
    iteration: number
  ): Promise<Record<string, number>> {
    const inputs: Record<string, number> = {};
    
    // Get uniform random samples from the sampler
    const uniformSamples = await sampler.getSample(iteration);
    
    let index = 0;
    for (const [variable, distribution] of distributions) {
      const uniformValue = uniformSamples[index] || Math.random();
      inputs[variable] = this.inverseTransform(uniformValue, distribution);
      index++;
    }

    return inputs;
  }

  private inverseTransform(u: number, distribution: ProbabilityDistribution): number {
    switch (distribution.type) {
      case 'normal':
        return this.inverseCDF_Normal(u, distribution.parameters.mean!, distribution.parameters.standardDeviation!);
      case 'uniform':
        return distribution.support.min + u * (distribution.support.max - distribution.support.min);
      case 'exponential':
        return -Math.log(1 - u) / distribution.parameters.rate!;
      case 'beta':
        return this.inverseCDF_Beta(u, distribution.parameters.alpha!, distribution.parameters.beta!);
      case 'gamma':
        return this.inverseCDF_Gamma(u, distribution.parameters.shape!, distribution.parameters.scale!);
      case 'weibull':
        return distribution.parameters.scale! * Math.pow(-Math.log(1 - u), 1 / distribution.parameters.shape!);
      case 'custom':
        return distribution.parameters.customFunction!(u);
      default:
        return u;
    }
  }

  private inverseCDF_Normal(u: number, mean: number, stdDev: number): number {
    // Box-Muller transform approximation
    return mean + stdDev * this.normalInverse(u);
  }

  private normalInverse(u: number): number {
    // Rational approximation for normal inverse CDF
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;

    if (u < 0.5) {
      const t = Math.sqrt(-2 * Math.log(u));
      return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
    } else {
      const t = Math.sqrt(-2 * Math.log(1 - u));
      return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
    }
  }

  private inverseCDF_Beta(u: number, alpha: number, beta: number): number {
    // Incomplete beta function inverse (simplified approximation)
    let x = 0.5;
    let dx = 0.25;
    
    for (let i = 0; i < 20; i++) {
      const fx = this.betaCDF(x, alpha, beta);
      if (Math.abs(fx - u) < 1e-10) break;
      
      if (fx < u) {
        x += dx;
      } else {
        x -= dx;
      }
      dx /= 2;
    }
    
    return Math.max(0, Math.min(1, x));
  }

  private betaCDF(x: number, alpha: number, beta: number): number {
    // Simplified beta CDF using incomplete beta function
    return this.incompleteBeta(x, alpha, beta) / this.betaFunction(alpha, beta);
  }

  private incompleteBeta(x: number, a: number, b: number): number {
    // Simplified incomplete beta function
    if (x <= 0) return 0;
    if (x >= 1) return this.betaFunction(a, b);
    
    // Use series expansion for simplification
    let result = 0;
    const maxTerms = 100;
    
    for (let k = 0; k < maxTerms; k++) {
      const term = (this.binomialCoefficient(a + b - 1, k) * Math.pow(x, a + k) * Math.pow(1 - x, b - 1 - k)) / (a + k);
      result += term;
      if (Math.abs(term) < 1e-15) break;
    }
    
    return result;
  }

  private betaFunction(a: number, b: number): number {
    return this.gammaFunction(a) * this.gammaFunction(b) / this.gammaFunction(a + b);
  }

  private gammaFunction(z: number): number {
    // Stirling's approximation
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * this.gammaFunction(1 - z));
    }
    
    z -= 1;
    const x = 0.99999999999980993 + 676.5203681218851 / (z + 1) - 1259.1392167224028 / (z + 2) + 
             771.32342877765313 / (z + 3) - 176.61502916214059 / (z + 4) + 12.507343278686905 / (z + 5) - 
             0.13857109526572012 / (z + 6) + 9.9843695780195716e-6 / (z + 7) + 1.5056327351493116e-7 / (z + 8);
             
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  private binomialCoefficient(n: number, k: number): number {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = result * (n - i + 1) / i;
    }
    return result;
  }

  private inverseCDF_Gamma(u: number, shape: number, scale: number): number {
    // Wilson-Hilferty approximation for gamma inverse CDF
    const h = 2 / (9 * shape);
    const normal = this.normalInverse(u);
    const x = shape * Math.pow(1 - h + normal * Math.sqrt(h), 3);
    return Math.max(0, x * scale);
  }

  private checkConstraints(sample: SimulationSample, constraints: SimulationConstraint[]): string[] {
    const violations: string[] = [];

    for (const constraint of constraints) {
      if (!this.evaluateConstraint(constraint, sample.inputs)) {
        violations.push(constraint.description);
      }
    }

    return violations;
  }

  private evaluateConstraint(constraint: SimulationConstraint, inputs: Record<string, number>): boolean {
    try {
      // Simple constraint evaluation - in production, use a proper expression parser
      const expression = constraint.expression;
      const context = { ...inputs };
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return Boolean(func(...Object.values(context)));
    } catch {
      return false;
    }
  }

  private usesImportanceSampling(techniques: VarianceReductionTechnique[]): boolean {
    return techniques.some(t => t.name === 'importance_sampling');
  }

  private calculateImportanceWeight(sample: SimulationSample, simulation: MonteCarloSimulation): number {
    // Simplified importance weight calculation
    // In practice, this would involve the ratio of target to proposal densities
    return 1.0; // Placeholder
  }

  private async executeSamples(
    simulation: MonteCarloSimulation,
    samples: SimulationSample[]
  ): Promise<SimulationSample[]> {
    const executedSamples: SimulationSample[] = [];

    for (const sample of samples) {
      if (!sample.valid) {
        executedSamples.push(sample);
        continue;
      }

      const startTime = performance.now();

      // Execute the model/scenario for this sample
      const outputs = await this.executeModel(sample.inputs, simulation);
      
      sample.outputs = outputs;
      sample.executionTime = performance.now() - startTime;

      executedSamples.push(sample);
    }

    return executedSamples;
  }

  private async executeModel(inputs: Record<string, number>, simulation: MonteCarloSimulation): Promise<Record<string, number>> {
    // This is where the actual model/scenario would be executed
    // For now, we'll create some mock outputs based on the scenario
    
    const outputs: Record<string, number> = {};
    
    // Mock business scenario calculations
    if (simulation.scenario.includes('revenue')) {
      outputs.revenue = this.calculateRevenue(inputs);
      outputs.profit = outputs.revenue * 0.15 + this.randomNoise(0.05);
      outputs.costs = outputs.revenue * 0.85 + this.randomNoise(0.1);
    }
    
    if (simulation.scenario.includes('risk')) {
      outputs.risk_score = this.calculateRiskScore(inputs);
      outputs.var_95 = outputs.risk_score * 1.645;
      outputs.expected_loss = outputs.risk_score * 0.5;
    }
    
    if (simulation.scenario.includes('performance')) {
      outputs.response_time = this.calculateResponseTime(inputs);
      outputs.throughput = 1000 / Math.max(0.1, outputs.response_time);
      outputs.error_rate = Math.max(0, Math.min(1, this.calculateErrorRate(inputs)));
    }

    return outputs;
  }

  private calculateRevenue(inputs: Record<string, number>): number {
    // Mock revenue calculation
    const baseRevenue = 1000000;
    const marketFactor = inputs.market_size || 1;
    const priceFactor = inputs.price || 1;
    const demandFactor = inputs.demand || 1;
    
    return baseRevenue * marketFactor * priceFactor * demandFactor + this.randomNoise(0.1);
  }

  private calculateRiskScore(inputs: Record<string, number>): number {
    // Mock risk score calculation
    const volatility = inputs.volatility || 0.2;
    const exposure = inputs.exposure || 1;
    const correlation = inputs.correlation || 0.5;
    
    return volatility * exposure * (1 + correlation) + this.randomNoise(0.05);
  }

  private calculateResponseTime(inputs: Record<string, number>): number {
    // Mock response time calculation
    const load = inputs.load || 1;
    const capacity = inputs.capacity || 1;
    const utilization = load / capacity;
    
    return 100 * Math.exp(utilization) + this.randomNoise(0.1);
  }

  private calculateErrorRate(inputs: Record<string, number>): number {
    // Mock error rate calculation
    const complexity = inputs.complexity || 1;
    const quality = inputs.quality || 0.9;
    const load = inputs.load || 1;
    
    return (complexity * load) / (10 * quality) + this.randomNoise(0.01);
  }

  private randomNoise(scale: number): number {
    return (Math.random() - 0.5) * 2 * scale;
  }

  private async calculateStatistics(
    samples: SimulationSample[],
    simulation: MonteCarloSimulation
  ): Promise<SimulationStatistics> {
    const validSamples = samples.filter(s => s.valid);
    const outputStatistics = new Map<string, OutputStatistics>();
    
    // Calculate statistics for each output variable
    for (const metric of simulation.outputMetrics) {
      const values = validSamples.map(s => s.outputs[metric]).filter(v => v !== undefined);
      
      if (values.length === 0) continue;

      const stats = this.calculateOutputStatistics(metric, values);
      outputStatistics.set(metric, stats);
    }

    // Calculate correlation matrix
    const correlationMatrix = this.calculateCorrelationMatrix(validSamples, simulation.outputMetrics);
    
    // Calculate covariance matrix
    const covarianceMatrix = this.calculateCovarianceMatrix(validSamples, simulation.outputMetrics);

    // Principal component analysis
    const principalComponents = await this.performPCA(correlationMatrix, simulation.outputMetrics);

    // Distribution fitting
    const distributionFitting = await this.fitDistributions(outputStatistics);

    // Percentile analysis
    const percentileAnalysis = this.calculatePercentileAnalysis(outputStatistics);

    return {
      outputStatistics,
      correlationMatrix,
      covarianceMatrix,
      principalComponents,
      distributionFitting,
      percentileAnalysis
    };
  }

  private calculateOutputStatistics(variable: string, values: number[]): OutputStatistics {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const median = this.calculatePercentile(sorted, 0.5);
    const mode = this.calculateMode(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
    const standardDeviation = Math.sqrt(variance);
    
    const skewness = this.calculateSkewness(values, mean, standardDeviation);
    const kurtosis = this.calculateKurtosis(values, mean, standardDeviation);
    
    const minimum = sorted[0];
    const maximum = sorted[n - 1];
    const range = maximum - minimum;

    const percentiles = {
      'p01': this.calculatePercentile(sorted, 0.01),
      'p05': this.calculatePercentile(sorted, 0.05),
      'p10': this.calculatePercentile(sorted, 0.10),
      'p25': this.calculatePercentile(sorted, 0.25),
      'p50': median,
      'p75': this.calculatePercentile(sorted, 0.75),
      'p90': this.calculatePercentile(sorted, 0.90),
      'p95': this.calculatePercentile(sorted, 0.95),
      'p99': this.calculatePercentile(sorted, 0.99)
    };

    const confidenceIntervals = this.calculateConfidenceIntervals(values, mean, standardDeviation);
    const outliers = this.detectOutliers(values);

    return {
      variable,
      samples: n,
      mean,
      median,
      mode,
      variance,
      standardDeviation,
      skewness,
      kurtosis,
      minimum,
      maximum,
      range,
      percentiles,
      confidenceIntervals,
      outliers
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateMode(values: number[]): number {
    const frequency = new Map<number, number>();
    
    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }
    
    let maxFreq = 0;
    let mode = values[0];
    
    for (const [value, freq] of frequency) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = value;
      }
    }
    
    return mode;
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 4), 0);
    return (n * (n + 1) * sum) / ((n - 1) * (n - 2) * (n - 3)) - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  }

  private calculateConfidenceIntervals(values: number[], mean: number, stdDev: number): ConfidenceInterval[] {
    const n = values.length;
    const intervals: ConfidenceInterval[] = [];
    
    const confidenceLevels = [0.90, 0.95, 0.99];
    const tValues = [1.645, 1.96, 2.576]; // Approximate for large samples
    
    for (let i = 0; i < confidenceLevels.length; i++) {
      const level = confidenceLevels[i];
      const t = tValues[i];
      const margin = t * (stdDev / Math.sqrt(n));
      
      intervals.push({
        level,
        lowerBound: mean - margin,
        upperBound: mean + margin,
        width: 2 * margin,
        method: 'normal'
      });
    }
    
    return intervals;
  }

  private detectOutliers(values: number[]): OutlierAnalysis {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 0.25);
    const q3 = this.calculatePercentile(sorted, 0.75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = values.map((v, i) => ({ value: v, index: i }))
                          .filter(item => item.value < lowerBound || item.value > upperBound);
    
    return {
      count: outliers.length,
      percentage: (outliers.length / values.length) * 100,
      indices: outliers.map(o => o.index),
      values: outliers.map(o => o.value),
      detectionMethod: 'iqr',
      threshold: 1.5
    };
  }

  private calculateCorrelationMatrix(samples: SimulationSample[], metrics: string[]): number[][] {
    const n = metrics.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const values1 = samples.map(s => s.outputs[metrics[i]]).filter(v => v !== undefined);
          const values2 = samples.map(s => s.outputs[metrics[j]]).filter(v => v !== undefined);
          matrix[i][j] = this.calculatePearsonCorrelation(values1, values2);
        }
      }
    }
    
    return matrix;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = x.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }
    
    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCovarianceMatrix(samples: SimulationSample[], metrics: string[]): number[][] {
    const n = metrics.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Calculate means
    const means = metrics.map(metric => {
      const values = samples.map(s => s.outputs[metric]).filter(v => v !== undefined);
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    });
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const values1 = samples.map(s => s.outputs[metrics[i]]).filter(v => v !== undefined);
        const values2 = samples.map(s => s.outputs[metrics[j]]).filter(v => v !== undefined);
        
        const covariance = this.calculateCovariance(values1, values2, means[i], means[j]);
        matrix[i][j] = covariance;
      }
    }
    
    return matrix;
  }

  private calculateCovariance(x: number[], y: number[], meanX: number, meanY: number): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }
    
    return sum / (n - 1);
  }

  private async performPCA(correlationMatrix: number[][], metrics: string[]): Promise<PrincipalComponent[]> {
    // Simplified PCA - in production, use a proper linear algebra library
    const components: PrincipalComponent[] = [];
    const n = metrics.length;
    
    for (let i = 0; i < n; i++) {
      const eigenvalue = Math.random(); // Mock eigenvalue
      const varianceExplained = eigenvalue / n;
      const loadings: Record<string, number> = {};
      
      metrics.forEach(metric => {
        loadings[metric] = Math.random() * 2 - 1; // Mock loading
      });
      
      components.push({
        index: i,
        eigenvalue,
        varianceExplained,
        cumulativeVariance: i === 0 ? varianceExplained : components[i-1].cumulativeVariance + varianceExplained,
        loadings
      });
    }
    
    return components;
  }

  private async fitDistributions(outputStats: Map<string, OutputStatistics>): Promise<DistributionFit[]> {
    const fits: DistributionFit[] = [];
    
    for (const [variable, stats] of outputStats) {
      // Test different distributions
      const distributions = ['normal', 'exponential', 'gamma', 'beta'];
      
      for (const distType of distributions) {
        const fit: DistributionFit = {
          variable,
          distributionType: distType,
          parameters: this.estimateParameters(distType, stats),
          goodnessOfFit: [],
          aic: Math.random() * 100, // Mock AIC
          bic: Math.random() * 100, // Mock BIC
          logLikelihood: -Math.random() * 50
        };
        
        fits.push(fit);
      }
    }
    
    return fits;
  }

  private estimateParameters(distributionType: string, stats: OutputStatistics): Record<string, number> {
    switch (distributionType) {
      case 'normal':
        return { mean: stats.mean, variance: stats.variance };
      case 'exponential':
        return { rate: 1 / stats.mean };
      case 'gamma':
        return { shape: Math.pow(stats.mean, 2) / stats.variance, scale: stats.variance / stats.mean };
      case 'beta':
        const mean = stats.mean;
        const variance = stats.variance;
        const alpha = mean * (mean * (1 - mean) / variance - 1);
        const beta = (1 - mean) * (mean * (1 - mean) / variance - 1);
        return { alpha, beta };
      default:
        return {};
    }
  }

  private calculatePercentileAnalysis(outputStats: Map<string, OutputStatistics>): PercentileAnalysis {
    // Return analysis for the first output variable as example
    const firstStats = outputStats.values().next().value;
    if (!firstStats) {
      return {
        variable: 'none',
        percentiles: {},
        valueAtRisk: {},
        expectedShortfall: {},
        extremeValues: {
          block_maxima: [],
          peaks_over_threshold: [],
          threshold: 0,
          exceedance_probability: 0,
          return_levels: {}
        }
      };
    }

    const valueAtRisk: Record<string, number> = {};
    const expectedShortfall: Record<string, number> = {};

    // Calculate VaR and ES at different confidence levels
    const confidenceLevels = [0.90, 0.95, 0.99];
    for (const level of confidenceLevels) {
      const percentileKey = `p${Math.round(level * 100)}`;
      const varValue = firstStats.percentiles[percentileKey] || 0;
      valueAtRisk[`var_${Math.round(level * 100)}`] = varValue;
      
      // ES is the average of values beyond VaR
      expectedShortfall[`es_${Math.round(level * 100)}`] = varValue * 1.2; // Simplified
    }

    return {
      variable: firstStats.variable,
      percentiles: firstStats.percentiles,
      valueAtRisk,
      expectedShortfall,
      extremeValues: {
        block_maxima: [firstStats.maximum],
        peaks_over_threshold: [firstStats.percentiles.p95, firstStats.percentiles.p99, firstStats.maximum].filter(v => v > firstStats.percentiles.p90),
        threshold: firstStats.percentiles.p90,
        exceedance_probability: 0.1,
        return_levels: {
          '10_year': firstStats.percentiles.p99,
          '100_year': firstStats.maximum
        }
      }
    };
  }

  private async analyzeConvergence(
    samples: SimulationSample[],
    simulation: MonteCarloSimulation
  ): Promise<ConvergenceAnalysis> {
    const convergenceHistory: ConvergencePoint[] = [];
    const criteria: ConvergenceCriterion[] = [];
    const stabilityMetrics: StabilityMetric[] = [];
    
    let converged = false;
    let convergenceIteration = simulation.config.iterations;
    
    // Analyze convergence for each output metric
    for (const metric of simulation.outputMetrics) {
      const values = samples.map(s => s.outputs[metric]).filter(v => v !== undefined);
      
      // Calculate running statistics
      for (let i = 10; i < values.length; i += Math.max(1, Math.floor(values.length / 100))) {
        const subset = values.slice(0, i);
        const mean = subset.reduce((sum, v) => sum + v, 0) / subset.length;
        const variance = subset.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (subset.length - 1);
        const standardError = Math.sqrt(variance / subset.length);
        
        convergenceHistory.push({
          iteration: i,
          mean,
          variance,
          standardError,
          confidenceInterval: {
            lower: mean - 1.96 * standardError,
            upper: mean + 1.96 * standardError
          },
          rmsError: standardError
        });
      }
      
      // Check convergence criteria
      const criterion: ConvergenceCriterion = {
        metric: 'mean',
        target: 0, // Target relative change
        tolerance: this.config.convergenceThreshold,
        satisfied: false,
        iterationSatisfied: 0
      };
      
      // Simple convergence check: relative change in mean < threshold
      if (convergenceHistory.length >= 2) {
        const recent = convergenceHistory[convergenceHistory.length - 1];
        const previous = convergenceHistory[convergenceHistory.length - 2];
        const relativeChange = Math.abs((recent.mean - previous.mean) / previous.mean);
        
        if (relativeChange < this.config.convergenceThreshold) {
          criterion.satisfied = true;
          criterion.iterationSatisfied = recent.iteration;
          if (!converged) {
            converged = true;
            convergenceIteration = recent.iteration;
          }
        }
      }
      
      criteria.push(criterion);
    }
    
    // Calculate stability metrics
    if (convergenceHistory.length > 0) {
      const recentMeans = convergenceHistory.slice(-10).map(h => h.mean);
      const meanStability = this.calculateStability(recentMeans);
      
      stabilityMetrics.push({
        name: 'Mean Stability',
        value: meanStability,
        threshold: 0.01,
        stable: meanStability < 0.01,
        description: 'Stability of the mean estimate over recent iterations'
      });
    }

    return {
      converged,
      convergenceIteration,
      convergenceCriteria: criteria,
      convergenceHistory,
      stabilityMetrics,
      recommendedIterations: Math.max(convergenceIteration, this.config.defaultIterations),
      estimatedError: convergenceHistory.length > 0 ? convergenceHistory[convergenceHistory.length - 1].standardError : 0
    };
  }

  private calculateStability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    
    return Math.sqrt(variance) / Math.abs(mean); // Coefficient of variation
  }

  private async performSensitivityAnalysis(
    samples: SimulationSample[],
    simulation: MonteCarloSimulation
  ): Promise<SensitivityAnalysis> {
    const inputVariables = Array.from(simulation.inputDistributions.keys());
    const outputMetrics = simulation.outputMetrics;
    
    const sobolIndices: SobolIndices[] = [];
    const correlationBased: CorrelationSensitivity[] = [];
    const regressionBased: RegressionSensitivity[] = [];
    const interactions: InteractionEffect[] = [];
    const ranking: VariableRanking[] = [];

    // Calculate Sobol indices (simplified)
    for (const inputVar of inputVariables) {
      for (const outputVar of outputMetrics) {
        const sobol = await this.calculateSobolIndices(samples, inputVar, outputVar);
        sobolIndices.push(sobol);
      }
    }

    // Calculate correlation-based sensitivity
    for (const inputVar of inputVariables) {
      for (const outputVar of outputMetrics) {
        const correlation = this.calculateCorrelationSensitivity(samples, inputVar, outputVar);
        correlationBased.push(correlation);
      }
    }

    // Calculate regression-based sensitivity
    for (const outputVar of outputMetrics) {
      const regression = await this.calculateRegressionSensitivity(samples, inputVariables, outputVar);
      regressionBased.push(...regression);
    }

    // Identify interactions
    for (let i = 0; i < inputVariables.length; i++) {
      for (let j = i + 1; j < inputVariables.length; j++) {
        const interaction = this.calculateInteraction(samples, inputVariables[i], inputVariables[j], outputMetrics[0]);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    // Create variable ranking
    const importanceMap = new Map<string, number>();
    for (const sobol of sobolIndices) {
      importanceMap.set(sobol.variable, (importanceMap.get(sobol.variable) || 0) + sobol.totalOrder);
    }

    let rank = 1;
    for (const [variable, importance] of Array.from(importanceMap.entries()).sort((a, b) => b[1] - a[1])) {
      ranking.push({
        rank: rank++,
        variable,
        importance,
        method: 'sobol_total',
        normalized: true
      });
    }

    return {
      methods: ['sobol', 'correlation', 'regression'],
      sobolIndices,
      correlationBased,
      regressionBased,
      varianceDecomposition: this.calculateVarianceDecomposition(sobolIndices),
      interactions,
      ranking
    };
  }

  private async calculateSobolIndices(
    samples: SimulationSample[],
    inputVariable: string,
    outputVariable: string
  ): Promise<SobolIndices> {
    // Simplified Sobol index calculation
    const inputValues = samples.map(s => s.inputs[inputVariable]);
    const outputValues = samples.map(s => s.outputs[outputVariable]);

    // Mock calculation - in practice, would need proper Sobol sequence sampling
    const firstOrder = Math.random() * 0.5; // Mock first-order index
    const totalOrder = firstOrder + Math.random() * 0.3; // Mock total-order index

    return {
      variable: inputVariable,
      firstOrder,
      totalOrder,
      confidenceInterval: {
        lower: totalOrder - 0.1,
        upper: totalOrder + 0.1
      }
    };
  }

  private calculateCorrelationSensitivity(
    samples: SimulationSample[],
    inputVariable: string,
    outputVariable: string
  ): CorrelationSensitivity {
    const inputValues = samples.map(s => s.inputs[inputVariable]);
    const outputValues = samples.map(s => s.outputs[outputVariable]);

    const pearsonCorrelation = this.calculatePearsonCorrelation(inputValues, outputValues);
    const spearmanCorrelation = this.calculateSpearmanCorrelation(inputValues, outputValues);
    const kendallTau = this.calculateKendallTau(inputValues, outputValues);

    return {
      variable: inputVariable,
      pearsonCorrelation,
      spearmanCorrelation,
      kendallTau,
      partialCorrelation: pearsonCorrelation * 0.8, // Simplified
      significance: Math.abs(pearsonCorrelation) > 0.1 ? 0.05 : 0.5
    };
  }

  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    // Convert to ranks and calculate Pearson correlation of ranks
    const xRanks = this.convertToRanks(x);
    const yRanks = this.convertToRanks(y);
    return this.calculatePearsonCorrelation(xRanks, yRanks);
  }

  private calculateKendallTau(x: number[], y: number[]): number {
    // Simplified Kendall's tau calculation
    let concordant = 0;
    let discordant = 0;
    const n = Math.min(x.length, y.length);

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const xSign = Math.sign(x[j] - x[i]);
        const ySign = Math.sign(y[j] - y[i]);
        
        if (xSign * ySign > 0) {
          concordant++;
        } else if (xSign * ySign < 0) {
          discordant++;
        }
      }
    }

    const totalPairs = (n * (n - 1)) / 2;
    return (concordant - discordant) / totalPairs;
  }

  private convertToRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].index] = i + 1;
    }
    
    return ranks;
  }

  private async calculateRegressionSensitivity(
    samples: SimulationSample[],
    inputVariables: string[],
    outputVariable: string
  ): Promise<RegressionSensitivity[]> {
    const result: RegressionSensitivity[] = [];
    
    // Simple multiple linear regression
    const n = samples.length;
    const X: number[][] = [];
    const y: number[] = [];

    // Prepare data matrices
    for (const sample of samples) {
      const row = inputVariables.map(variable => sample.inputs[variable]);
      X.push([1, ...row]); // Add intercept term
      y.push(sample.outputs[outputVariable] || 0);
    }

    // Mock regression coefficients (in practice, would solve normal equations or use SVD)
    for (let i = 0; i < inputVariables.length; i++) {
      const coefficient = (Math.random() - 0.5) * 2; // Mock coefficient
      const standardError = Math.abs(coefficient) * 0.1; // Mock standard error
      const tStatistic = coefficient / standardError;
      const pValue = 2 * (1 - this.normalCDF(Math.abs(tStatistic)));

      result.push({
        variable: inputVariables[i],
        coefficient,
        standardizedCoefficient: coefficient * 0.8, // Mock standardized coefficient
        pValue,
        confidenceInterval: {
          lower: coefficient - 1.96 * standardError,
          upper: coefficient + 1.96 * standardError
        },
        elasticity: coefficient * 0.5 // Mock elasticity
      });
    }

    return result;
  }

  private calculateInteraction(
    samples: SimulationSample[],
    variable1: string,
    variable2: string,
    outputVariable: string
  ): InteractionEffect | null {
    // Simplified interaction effect calculation
    const effect = Math.random() * 0.1; // Mock interaction effect
    
    if (Math.abs(effect) < 0.05) {
      return null; // No significant interaction
    }

    return {
      variables: [variable1, variable2],
      effect,
      significance: Math.abs(effect) > 0.08 ? 0.05 : 0.1,
      type: 'linear'
    };
  }

  private calculateVarianceDecomposition(sobolIndices: SobolIndices[]): VarianceDecomposition {
    const totalFirstOrder = sobolIndices.reduce((sum, s) => sum + s.firstOrder, 0);
    const totalVariance = 1.0; // Normalized

    return {
      totalVariance,
      explainedVariance: totalFirstOrder,
      residualVariance: totalVariance - totalFirstOrder,
      r_squared: totalFirstOrder,
      adjusted_r_squared: totalFirstOrder * 0.95, // Approximation
      contributions: Object.fromEntries(
        sobolIndices.map(s => [s.variable, s.firstOrder])
      )
    };
  }

  private async calculateRiskMetrics(
    samples: SimulationSample[],
    statistics: SimulationStatistics
  ): Promise<RiskMetrics> {
    // Get the first output variable for risk calculation
    const firstOutput = statistics.outputStatistics.entries().next().value;
    if (!firstOutput) {
      return this.createEmptyRiskMetrics();
    }

    const [variable, stats] = firstOutput;
    const values = samples.map(s => s.outputs[variable]).filter(v => v !== undefined).sort((a, b) => a - b);

    const valueAtRisk = this.calculateVaR(values);
    const conditionalValueAtRisk = this.calculateCVaR(values, valueAtRisk);
    const expectedShortfall = conditionalValueAtRisk;

    return {
      valueAtRisk,
      conditionalValueAtRisk,
      expectedShortfall,
      maximumDrawdown: this.calculateMaxDrawdown(values),
      sharpeRatio: this.calculateSharpeRatio(values),
      sortinoRatio: this.calculateSortinoRatio(values),
      calmarRatio: this.calculateCalmarRatio(values),
      tailRisk: this.calculateTailRisk(values),
      scenarioAnalysis: await this.performScenarioAnalysis(samples),
      stressTesting: await this.performStressTesting(samples)
    };
  }

  private calculateVaR(values: number[]): Record<string, number> {
    return {
      'var_90': this.calculatePercentile(values, 0.1),
      'var_95': this.calculatePercentile(values, 0.05),
      'var_99': this.calculatePercentile(values, 0.01)
    };
  }

  private calculateCVaR(values: number[], var: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [level, varValue] of Object.entries(var)) {
      const tailValues = values.filter(v => v <= varValue);
      const cvar = tailValues.length > 0 ? tailValues.reduce((sum, v) => sum + v, 0) / tailValues.length : varValue;
      result[level.replace('var', 'cvar')] = cvar;
    }
    
    return result;
  }

  private calculateMaxDrawdown(values: number[]): number {
    let maxDrawdown = 0;
    let peak = values[0];
    
    for (const value of values) {
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown;
  }

  private calculateSharpeRatio(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    const riskFreeRate = 0.02; // Assume 2% risk-free rate
    return (mean - riskFreeRate) / std;
  }

  private calculateSortinoRatio(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const target = 0;
    const downsideDeviation = Math.sqrt(
      values.filter(v => v < target).reduce((sum, v) => sum + Math.pow(v - target, 2), 0) / values.length
    );
    return downsideDeviation > 0 ? (mean - target) / downsideDeviation : 0;
  }

  private calculateCalmarRatio(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const maxDrawdown = this.calculateMaxDrawdown(values);
    return maxDrawdown > 0 ? mean / maxDrawdown : 0;
  }

  private calculateTailRisk(values: number[]): TailRiskMetrics {
    const sorted = [...values].sort((a, b) => a - b);
    const tail = sorted.slice(0, Math.floor(values.length * 0.1)); // Bottom 10%
    
    return {
      tailIndex: 1.5, // Mock tail index
      hillEstimator: 1.2, // Mock Hill estimator
      extremeValueIndex: 0.3, // Mock extreme value index
      tailProbability: 0.1,
      expectedExcess: tail.length > 0 ? tail.reduce((sum, v) => sum + v, 0) / tail.length : 0
    };
  }

  private async performScenarioAnalysis(samples: SimulationSample[]): Promise<ScenarioRiskAnalysis[]> {
    const scenarios = ['base_case', 'stress_case', 'best_case'];
    const analysis: ScenarioRiskAnalysis[] = [];

    for (const scenario of scenarios) {
      analysis.push({
        scenario,
        probability: scenario === 'base_case' ? 0.7 : (scenario === 'stress_case' ? 0.2 : 0.1),
        impact: Math.random() * 1000000,
        expectedLoss: Math.random() * 500000,
        worstCase: Math.random() * 2000000,
        bestCase: Math.random() * 100000,
        riskContribution: Math.random() * 0.3
      });
    }

    return analysis;
  }

  private async performStressTesting(samples: SimulationSample[]): Promise<StressTestResult[]> {
    const stressScenarios = ['market_crash', 'interest_rate_shock', 'credit_crisis'];
    const results: StressTestResult[] = [];

    for (const scenario of stressScenarios) {
      results.push({
        stressScenario: scenario,
        stressMagnitude: Math.random() * 5 + 1, // 1-6 sigma event
        impactedVariables: ['revenue', 'cost', 'risk_score'],
        resultingChange: {
          revenue: -Math.random() * 0.5, // Up to 50% decrease
          cost: Math.random() * 0.3,     // Up to 30% increase
          risk_score: Math.random() * 2   // Up to 200% increase
        },
        riskIncrease: Math.random() * 3,
        recoveryTime: Math.random() * 365 // Days
      });
    }

    return results;
  }

  private createEmptyRiskMetrics(): RiskMetrics {
    return {
      valueAtRisk: {},
      conditionalValueAtRisk: {},
      expectedShortfall: {},
      maximumDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      tailRisk: {
        tailIndex: 0,
        hillEstimator: 0,
        extremeValueIndex: 0,
        tailProbability: 0,
        expectedExcess: 0
      },
      scenarioAnalysis: [],
      stressTesting: []
    };
  }

  private async quantifyUncertainty(
    simulation: MonteCarloSimulation,
    statistics: SimulationStatistics,
    samples: SimulationSample[]
  ): Promise<UncertaintyBounds> {
    const aleatory: AleatoricUncertainty = {
      sources: [
        {
          name: 'Natural Variability',
          type: 'measurement',
          magnitude: 0.1,
          distribution: this.distributionLibrary.get('standard_normal')!,
          confidence: 0.95,
          reducibility: 'irreducible'
        }
      ],
      totalVariance: 0.15,
      contributionAnalysis: { natural: 0.8, measurement: 0.2 }
    };

    const epistemic: EpistemicUncertainty = {
      sources: [
        {
          name: 'Model Uncertainty',
          type: 'model',
          magnitude: 0.2,
          distribution: this.distributionLibrary.get('uniform_01')!,
          confidence: 0.7,
          reducibility: 'reducible'
        }
      ],
      reducible: true,
      informationValue: 0.3,
      expertJudgment: []
    };

    const combined: CombinedUncertainty = {
      method: 'monte_carlo',
      bounds: { lower: -2, upper: 2 },
      intervals: [
        { confidence: 0.90, lower: -1.645, upper: 1.645, width: 3.29 },
        { confidence: 0.95, lower: -1.96, upper: 1.96, width: 3.92 },
        { confidence: 0.99, lower: -2.576, upper: 2.576, width: 5.15 }
      ],
      robustness: {
        robustnessMetric: 0.8,
        sensitiveRegions: [],
        breakingPoints: [],
        stabilityMargin: 0.2
      }
    };

    const propagation: UncertaintyPropagation = {
      method: 'monte_carlo',
      accuracy: 0.95,
      efficiency: 0.8,
      computational_cost: samples.length * 0.001, // Mock cost
      error_estimate: 0.05
    };

    return {
      aleatory,
      epistemic,
      combined,
      propagation
    };
  }

  private async generateRecommendations(
    statistics: SimulationStatistics,
    convergence: ConvergenceAnalysis,
    sensitivity: SensitivityAnalysis,
    risk: RiskMetrics
  ): Promise<ProbabilisticRecommendation[]> {
    const recommendations: ProbabilisticRecommendation[] = [];

    // Convergence recommendations
    if (!convergence.converged) {
      recommendations.push({
        category: 'sampling',
        priority: 'high',
        title: 'Increase Sample Size',
        description: 'Simulation has not converged - increase the number of Monte Carlo iterations',
        rationale: `Current simulation shows insufficient convergence with ${convergence.convergenceIteration} iterations`,
        implementation: [
          `Increase iterations to ${convergence.recommendedIterations}`,
          'Monitor convergence criteria during execution',
          'Consider adaptive sampling strategies'
        ],
        expectedBenefit: 'Improved accuracy and reliability of results',
        cost: 'medium',
        timeline: 'immediate',
        riskReduction: 0.3,
        uncertaintyReduction: 0.4
      });
    }

    // Sensitivity recommendations
    const highSensitivityVars = sensitivity.ranking.filter(r => r.importance > 0.1).slice(0, 3);
    if (highSensitivityVars.length > 0) {
      recommendations.push({
        category: 'modeling',
        priority: 'high',
        title: 'Focus on High-Impact Variables',
        description: `Variables ${highSensitivityVars.map(v => v.variable).join(', ')} show high sensitivity`,
        rationale: 'High-sensitivity variables drive most of the output uncertainty',
        implementation: [
          'Refine distributions for high-impact variables',
          'Collect additional data for these variables',
          'Consider stratified sampling for key variables'
        ],
        expectedBenefit: 'Reduced output uncertainty and improved model accuracy',
        cost: 'medium',
        timeline: 'short-term',
        riskReduction: 0.4,
        uncertaintyReduction: 0.5
      });
    }

    // Risk recommendations
    const highVaR = Object.values(risk.valueAtRisk).some(v => Math.abs(v) > 1000000);
    if (highVaR) {
      recommendations.push({
        category: 'risk_management',
        priority: 'critical',
        title: 'Implement Risk Mitigation Strategies',
        description: 'High Value-at-Risk detected requiring immediate attention',
        rationale: 'Potential losses exceed acceptable thresholds',
        implementation: [
          'Develop risk mitigation plans',
          'Implement hedging strategies',
          'Establish contingency reserves',
          'Monitor risk metrics continuously'
        ],
        expectedBenefit: 'Reduced financial exposure and improved risk profile',
        cost: 'high',
        timeline: 'immediate',
        riskReduction: 0.6,
        uncertaintyReduction: 0.2
      });
    }

    // Variance reduction recommendations
    recommendations.push({
      category: 'sampling',
      priority: 'medium',
      title: 'Implement Variance Reduction Techniques',
      description: 'Apply advanced sampling methods to improve efficiency',
      rationale: 'Standard Monte Carlo may be inefficient for this problem',
      implementation: [
        'Implement Latin Hypercube Sampling',
        'Consider antithetic variates',
        'Apply control variates where applicable',
        'Use importance sampling for rare events'
      ],
      expectedBenefit: 'Faster convergence and reduced computational cost',
      cost: 'low',
      timeline: 'medium-term',
      riskReduction: 0.1,
      uncertaintyReduction: 0.3
    });

    return recommendations;
  }

  // Sampler classes (simplified implementations)
  createDistribution(type: string, parameters: DistributionParameters): ProbabilityDistribution {
    const distribution = this.distributionLibrary.get(`${type}_template`) || this.distributionLibrary.get('standard_normal')!;
    return {
      ...distribution,
      type: type as any,
      parameters: { ...distribution.parameters, ...parameters }
    };
  }

  getSimulation(simulationId: string): MonteCarloSimulation | undefined {
    return this.simulations.get(simulationId);
  }

  getResult(simulationId: string): SimulationResult | undefined {
    return this.results.get(simulationId);
  }

  listSimulations(): MonteCarloSimulation[] {
    return Array.from(this.simulations.values());
  }

  listResults(): SimulationResult[] {
    return Array.from(this.results.values());
  }

  clearResults(): void {
    this.results.clear();
  }
}

// Simplified sampler implementations
class RandomSampler {
  getSample(iteration: number): Promise<number[]> {
    return Promise.resolve([Math.random()]);
  }
}

class LatinHypercubeSampler {
  private dimensions: number;
  private samples: number[][] = [];
  
  constructor(dimensions: number) {
    this.dimensions = dimensions;
    this.generateSamples();
  }

  private generateSamples(): void {
    const n = 1000; // Default sample size
    this.samples = [];
    
    for (let i = 0; i < n; i++) {
      const sample: number[] = [];
      for (let d = 0; d < this.dimensions; d++) {
        sample.push((i + Math.random()) / n);
      }
      this.samples.push(sample);
    }
  }

  getSample(iteration: number): Promise<number[]> {
    const index = iteration % this.samples.length;
    return Promise.resolve(this.samples[index]);
  }
}

class SobolSequenceSampler {
  private dimensions: number;
  
  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  getSample(iteration: number): Promise<number[]> {
    // Simplified Sobol sequence - in practice, use proper implementation
    const sample: number[] = [];
    for (let d = 0; d < this.dimensions; d++) {
      sample.push(Math.random()); // Placeholder
    }
    return Promise.resolve(sample);
  }
}

class HaltonSequenceSampler {
  private dimensions: number;
  private bases = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
  
  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  getSample(iteration: number): Promise<number[]> {
    const sample: number[] = [];
    for (let d = 0; d < this.dimensions; d++) {
      sample.push(this.haltonNumber(iteration + 1, this.bases[d % this.bases.length]));
    }
    return Promise.resolve(sample);
  }

  private haltonNumber(index: number, base: number): number {
    let result = 0;
    let fraction = 1 / base;
    let i = index;
    
    while (i > 0) {
      result += (i % base) * fraction;
      i = Math.floor(i / base);
      fraction /= base;
    }
    
    return result;
  }
}

class StratifiedSampler {
  private config: StratificationConfig;
  
  constructor(config: StratificationConfig) {
    this.config = config;
  }

  getSample(iteration: number): Promise<number[]> {
    // Simplified stratified sampling
    const sample: number[] = [];
    for (let i = 0; i < this.config.variables.length; i++) {
      sample.push(Math.random());
    }
    return Promise.resolve(sample);
  }
}