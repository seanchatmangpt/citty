/**
 * MULTI-DIMENSIONAL SCENARIO MATRIX ENGINE
 * Generates and manages complex scenario combinations across multiple dimensions
 */

import { EventEmitter } from 'events';
import { BDDScenario, ScenarioDimension, DimensionMatrix, MatrixCombination } from '../core/hive-queen';

export interface ScenarioMatrixConfig {
  maxCombinations: number;
  priorityWeighting: boolean;
  coverageTarget: number; // Percentage (0-100)
  optimizationStrategy: 'full_coverage' | 'risk_based' | 'priority_weighted' | 'time_constrained';
  parallelGeneration: boolean;
  crossDimensionalAnalysis: boolean;
}

export interface MatrixDimension {
  id: string;
  name: string;
  type: 'categorical' | 'numerical' | 'boolean' | 'temporal' | 'hierarchical';
  values: DimensionValue[];
  constraints: DimensionConstraint[];
  weight: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // Other dimension IDs this depends on
}

export interface DimensionValue {
  id: string;
  name: string;
  value: any;
  weight: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  frequency: number; // How often this value appears in real scenarios
  testComplexity: number; // How complex it is to test this value
  businessImpact: number; // Business impact if this fails
  constraints: ValueConstraint[];
}

export interface DimensionConstraint {
  type: 'exclusion' | 'inclusion' | 'conditional' | 'cardinality' | 'sequence';
  description: string;
  rule: string; // JavaScript expression
  applies_to: string[]; // Value IDs this constraint applies to
  severity: 'warning' | 'error';
}

export interface ValueConstraint {
  dimension_id: string;
  allowed_values: string[];
  disallowed_values: string[];
  conditional_rules: ConditionalRule[];
}

export interface ConditionalRule {
  condition: string; // JavaScript expression
  then_allow: string[];
  then_disallow: string[];
  else_allow?: string[];
  else_disallow?: string[];
}

export interface ScenarioMatrix {
  id: string;
  name: string;
  dimensions: MatrixDimension[];
  combinations: MatrixCombination[];
  coverage: CoverageAnalysis;
  riskAnalysis: RiskAnalysis;
  optimization: OptimizationResult;
  metadata: MatrixMetadata;
}

export interface CoverageAnalysis {
  totalPossibleCombinations: number;
  selectedCombinations: number;
  coveragePercentage: number;
  dimensionCoverage: DimensionCoverage[];
  interactionCoverage: InteractionCoverage[];
  gaps: CoverageGap[];
  redundancies: CoverageRedundancy[];
}

export interface DimensionCoverage {
  dimensionId: string;
  totalValues: number;
  coveredValues: number;
  coveragePercentage: number;
  uncoveredValues: string[];
  overtestedValues: string[];
}

export interface InteractionCoverage {
  dimensions: string[];
  interactions: number;
  covered: number;
  coveragePercentage: number;
  criticalUncovered: string[];
}

export interface CoverageGap {
  type: 'missing_combination' | 'insufficient_coverage' | 'critical_path_missing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  dimensions: string[];
  values: string[];
  businessImpact: number;
  recommendation: string;
}

export interface CoverageRedundancy {
  combinations: string[];
  similarityScore: number;
  wastedEffort: number;
  recommendation: string;
}

export interface RiskAnalysis {
  overallRiskScore: number;
  highRiskCombinations: RiskyCombination[];
  riskDistribution: RiskDistribution;
  mitigation: RiskMitigation[];
}

export interface RiskyCombination {
  combinationId: string;
  riskScore: number;
  riskFactors: RiskFactor[];
  businessImpact: number;
  likelihood: number;
  mitigation: string[];
}

export interface RiskFactor {
  type: 'technical' | 'business' | 'compliance' | 'security' | 'performance';
  description: string;
  severity: number;
  probability: number;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  extreme: number;
}

export interface RiskMitigation {
  riskType: string;
  strategy: string;
  implementation: string[];
  cost: 'low' | 'medium' | 'high';
  effectiveness: number;
}

export interface OptimizationResult {
  strategy: string;
  originalCombinations: number;
  optimizedCombinations: number;
  reductionPercentage: number;
  timesSaved: number;
  coverageMaintained: number;
  optimizations: OptimizationTechnique[];
}

export interface OptimizationTechnique {
  name: string;
  description: string;
  combinationsRemoved: number;
  coverageImpact: number;
  riskImpact: number;
  reasoning: string;
}

export interface MatrixMetadata {
  createdAt: number;
  updatedAt: number;
  version: string;
  author: string;
  purpose: string;
  tags: string[];
  estimatedExecutionTime: number;
  estimatedCost: number;
  lastOptimized: number;
}

export interface MatrixGenerationOptions {
  seed?: number; // For reproducible generation
  includeEdgeCases: boolean;
  includeNegativeTests: boolean;
  balanceRiskDistribution: boolean;
  optimizeForParallel: boolean;
  respectTimeConstraints: boolean;
  maxExecutionTime?: number;
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  useCase: string;
  dimensions: MatrixDimension[];
  constraints: DimensionConstraint[];
  examples: TemplateExample[];
}

export interface TemplateExample {
  name: string;
  description: string;
  combination: Record<string, string>;
  expectedOutcome: string;
  notes: string[];
}

export class ScenarioMatrixEngine extends EventEmitter {
  private config: ScenarioMatrixConfig;
  private matrices: Map<string, ScenarioMatrix> = new Map();
  private templates: Map<string, ScenarioTemplate> = new Map();
  private constraints: DimensionConstraint[] = [];

  constructor(config: ScenarioMatrixConfig) {
    super();
    this.config = config;
    this.loadBuiltInTemplates();
  }

  private loadBuiltInTemplates(): void {
    // E-commerce template
    this.templates.set('ecommerce', {
      id: 'ecommerce',
      name: 'E-commerce Platform Testing',
      description: 'Comprehensive testing matrix for e-commerce platforms',
      industry: 'retail',
      useCase: 'online_shopping',
      dimensions: [
        {
          id: 'user_type',
          name: 'User Type',
          type: 'categorical',
          values: [
            { id: 'guest', name: 'Guest User', value: 'guest', weight: 3, riskLevel: 'medium', frequency: 0.4, testComplexity: 2, businessImpact: 7, constraints: [] },
            { id: 'registered', name: 'Registered User', value: 'registered', weight: 5, riskLevel: 'low', frequency: 0.5, testComplexity: 3, businessImpact: 8, constraints: [] },
            { id: 'premium', name: 'Premium Member', value: 'premium', weight: 8, riskLevel: 'high', frequency: 0.1, testComplexity: 5, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 10,
          criticality: 'high',
          dependencies: []
        },
        {
          id: 'payment_method',
          name: 'Payment Method',
          type: 'categorical',
          values: [
            { id: 'credit_card', name: 'Credit Card', value: 'credit_card', weight: 8, riskLevel: 'high', frequency: 0.6, testComplexity: 7, businessImpact: 9, constraints: [] },
            { id: 'paypal', name: 'PayPal', value: 'paypal', weight: 6, riskLevel: 'medium', frequency: 0.25, testComplexity: 5, businessImpact: 8, constraints: [] },
            { id: 'digital_wallet', name: 'Digital Wallet', value: 'digital_wallet', weight: 5, riskLevel: 'medium', frequency: 0.1, testComplexity: 6, businessImpact: 7, constraints: [] },
            { id: 'buy_now_pay_later', name: 'Buy Now Pay Later', value: 'bnpl', weight: 7, riskLevel: 'high', frequency: 0.05, testComplexity: 8, businessImpact: 8, constraints: [] }
          ],
          constraints: [],
          weight: 9,
          criticality: 'critical',
          dependencies: ['user_type']
        },
        {
          id: 'order_value',
          name: 'Order Value',
          type: 'numerical',
          values: [
            { id: 'small', name: 'Small Order (<$50)', value: 25, weight: 4, riskLevel: 'low', frequency: 0.5, testComplexity: 2, businessImpact: 3, constraints: [] },
            { id: 'medium', name: 'Medium Order ($50-$200)', value: 100, weight: 6, riskLevel: 'medium', frequency: 0.35, testComplexity: 4, businessImpact: 6, constraints: [] },
            { id: 'large', name: 'Large Order ($200-$1000)', value: 500, weight: 8, riskLevel: 'high', frequency: 0.12, testComplexity: 6, businessImpact: 8, constraints: [] },
            { id: 'enterprise', name: 'Enterprise Order (>$1000)', value: 2000, weight: 10, riskLevel: 'extreme', frequency: 0.03, testComplexity: 9, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 7,
          criticality: 'medium',
          dependencies: []
        }
      ],
      constraints: [
        {
          type: 'conditional',
          description: 'Guest users cannot use Buy Now Pay Later',
          rule: 'user_type === "guest" && payment_method === "bnpl"',
          applies_to: ['guest', 'bnpl'],
          severity: 'error'
        }
      ],
      examples: [
        {
          name: 'High-Value Premium Purchase',
          description: 'Premium member making a large purchase with credit card',
          combination: { user_type: 'premium', payment_method: 'credit_card', order_value: 'large' },
          expectedOutcome: 'Successful purchase with premium benefits applied',
          notes: ['Test loyalty points calculation', 'Verify premium shipping options']
        }
      ]
    });

    // Financial services template
    this.templates.set('financial', {
      id: 'financial',
      name: 'Financial Services Testing',
      description: 'Testing matrix for banking and financial applications',
      industry: 'finance',
      useCase: 'banking_transactions',
      dimensions: [
        {
          id: 'transaction_type',
          name: 'Transaction Type',
          type: 'categorical',
          values: [
            { id: 'transfer', name: 'Money Transfer', value: 'transfer', weight: 8, riskLevel: 'high', frequency: 0.4, testComplexity: 7, businessImpact: 9, constraints: [] },
            { id: 'payment', name: 'Bill Payment', value: 'payment', weight: 6, riskLevel: 'medium', frequency: 0.35, testComplexity: 5, businessImpact: 7, constraints: [] },
            { id: 'withdrawal', name: 'ATM Withdrawal', value: 'withdrawal', weight: 7, riskLevel: 'high', frequency: 0.2, testComplexity: 6, businessImpact: 8, constraints: [] },
            { id: 'investment', name: 'Investment Trade', value: 'investment', weight: 10, riskLevel: 'extreme', frequency: 0.05, testComplexity: 9, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 10,
          criticality: 'critical',
          dependencies: []
        },
        {
          id: 'amount_range',
          name: 'Transaction Amount',
          type: 'numerical',
          values: [
            { id: 'micro', name: 'Micro (<$100)', value: 50, weight: 3, riskLevel: 'low', frequency: 0.6, testComplexity: 2, businessImpact: 2, constraints: [] },
            { id: 'standard', name: 'Standard ($100-$10K)', value: 1000, weight: 6, riskLevel: 'medium', frequency: 0.35, testComplexity: 5, businessImpact: 6, constraints: [] },
            { id: 'high_value', name: 'High Value (>$10K)', value: 50000, weight: 10, riskLevel: 'extreme', frequency: 0.05, testComplexity: 9, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 9,
          criticality: 'critical',
          dependencies: []
        },
        {
          id: 'compliance_region',
          name: 'Regulatory Region',
          type: 'categorical',
          values: [
            { id: 'us', name: 'United States', value: 'US', weight: 7, riskLevel: 'high', frequency: 0.4, testComplexity: 6, businessImpact: 8, constraints: [] },
            { id: 'eu', name: 'European Union', value: 'EU', weight: 8, riskLevel: 'high', frequency: 0.3, testComplexity: 7, businessImpact: 9, constraints: [] },
            { id: 'apac', name: 'Asia Pacific', value: 'APAC', weight: 6, riskLevel: 'medium', frequency: 0.25, testComplexity: 5, businessImpact: 7, constraints: [] },
            { id: 'emerging', name: 'Emerging Markets', value: 'EM', weight: 9, riskLevel: 'extreme', frequency: 0.05, testComplexity: 8, businessImpact: 6, constraints: [] }
          ],
          constraints: [],
          weight: 8,
          criticality: 'high',
          dependencies: []
        }
      ],
      constraints: [
        {
          type: 'conditional',
          description: 'High-value transactions in emerging markets require additional verification',
          rule: 'amount_range === "high_value" && compliance_region === "emerging"',
          applies_to: ['high_value', 'emerging'],
          severity: 'warning'
        }
      ],
      examples: []
    });

    // Healthcare template
    this.templates.set('healthcare', {
      id: 'healthcare',
      name: 'Healthcare System Testing',
      description: 'Testing matrix for healthcare management systems',
      industry: 'healthcare',
      useCase: 'patient_management',
      dimensions: [
        {
          id: 'patient_type',
          name: 'Patient Category',
          type: 'categorical',
          values: [
            { id: 'outpatient', name: 'Outpatient', value: 'outpatient', weight: 5, riskLevel: 'low', frequency: 0.7, testComplexity: 3, businessImpact: 6, constraints: [] },
            { id: 'inpatient', name: 'Inpatient', value: 'inpatient', weight: 8, riskLevel: 'high', frequency: 0.25, testComplexity: 7, businessImpact: 9, constraints: [] },
            { id: 'emergency', name: 'Emergency', value: 'emergency', weight: 10, riskLevel: 'extreme', frequency: 0.05, testComplexity: 9, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 9,
          criticality: 'critical',
          dependencies: []
        },
        {
          id: 'data_sensitivity',
          name: 'Data Sensitivity Level',
          type: 'hierarchical',
          values: [
            { id: 'public', name: 'Public Information', value: 1, weight: 2, riskLevel: 'low', frequency: 0.3, testComplexity: 1, businessImpact: 3, constraints: [] },
            { id: 'internal', name: 'Internal Use', value: 2, weight: 4, riskLevel: 'low', frequency: 0.4, testComplexity: 3, businessImpact: 5, constraints: [] },
            { id: 'confidential', name: 'Confidential', value: 3, weight: 7, riskLevel: 'medium', frequency: 0.25, testComplexity: 6, businessImpact: 8, constraints: [] },
            { id: 'restricted', name: 'Restricted/PHI', value: 4, weight: 10, riskLevel: 'extreme', frequency: 0.05, testComplexity: 9, businessImpact: 10, constraints: [] }
          ],
          constraints: [],
          weight: 10,
          criticality: 'critical',
          dependencies: []
        }
      ],
      constraints: [],
      examples: []
    });
  }

  async generateMatrix(
    name: string, 
    dimensions: MatrixDimension[], 
    options?: MatrixGenerationOptions
  ): Promise<ScenarioMatrix> {
    const matrixId = `matrix-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    this.emit('matrix-generation-started', { matrixId, name, dimensions: dimensions.length });

    try {
      // Calculate total possible combinations
      const totalCombinations = this.calculateTotalCombinations(dimensions);
      
      this.emit('combinations-calculated', { matrixId, totalCombinations });

      // Generate all possible combinations
      const allCombinations = await this.generateAllCombinations(dimensions, options);
      
      this.emit('combinations-generated', { matrixId, combinations: allCombinations.length });

      // Apply constraints and filters
      const validCombinations = await this.applyConstraints(allCombinations, dimensions);
      
      this.emit('constraints-applied', { matrixId, validCombinations: validCombinations.length });

      // Optimize based on strategy
      const optimizedCombinations = await this.optimizeCombinations(validCombinations, dimensions);
      
      this.emit('optimization-completed', { matrixId, optimizedCombinations: optimizedCombinations.length });

      // Generate coverage analysis
      const coverage = await this.analyzeCoverage(dimensions, optimizedCombinations, totalCombinations);
      
      // Generate risk analysis
      const riskAnalysis = await this.analyzeRisk(optimizedCombinations, dimensions);
      
      // Generate optimization report
      const optimization = this.generateOptimizationReport(allCombinations.length, optimizedCombinations.length);

      const matrix: ScenarioMatrix = {
        id: matrixId,
        name,
        dimensions,
        combinations: optimizedCombinations,
        coverage,
        riskAnalysis,
        optimization,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          author: 'ScenarioMatrixEngine',
          purpose: 'Automated scenario matrix generation',
          tags: ['generated', 'optimized'],
          estimatedExecutionTime: this.estimateExecutionTime(optimizedCombinations),
          estimatedCost: this.estimateCost(optimizedCombinations),
          lastOptimized: Date.now()
        }
      };

      this.matrices.set(matrixId, matrix);
      
      this.emit('matrix-generation-completed', { matrixId, matrix });
      
      return matrix;

    } catch (error) {
      this.emit('matrix-generation-failed', { 
        matrixId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async generateFromTemplate(templateId: string, customizations?: Partial<ScenarioTemplate>): Promise<ScenarioMatrix> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const finalTemplate = customizations ? { ...template, ...customizations } : template;
    
    return this.generateMatrix(
      finalTemplate.name,
      finalTemplate.dimensions,
      {
        includeEdgeCases: true,
        includeNegativeTests: true,
        balanceRiskDistribution: true,
        optimizeForParallel: this.config.parallelGeneration
      }
    );
  }

  private calculateTotalCombinations(dimensions: MatrixDimension[]): number {
    return dimensions.reduce((total, dimension) => total * dimension.values.length, 1);
  }

  private async generateAllCombinations(
    dimensions: MatrixDimension[], 
    options?: MatrixGenerationOptions
  ): Promise<MatrixCombination[]> {
    const combinations: MatrixCombination[] = [];
    
    // Generate cartesian product of all dimension values
    const generateCombination = (
      dimIndex: number, 
      currentCombination: Record<string, string>,
      currentWeight: number
    ) => {
      if (dimIndex >= dimensions.length) {
        combinations.push({
          values: { ...currentCombination },
          weight: currentWeight,
          executionOrder: combinations.length
        });
        return;
      }

      const dimension = dimensions[dimIndex];
      for (const value of dimension.values) {
        const newCombination = {
          ...currentCombination,
          [dimension.id]: value.id
        };
        
        const newWeight = currentWeight * value.weight * dimension.weight;
        
        generateCombination(dimIndex + 1, newCombination, newWeight);
      }
    };

    generateCombination(0, {}, 1);

    // Sort by weight if priority weighting is enabled
    if (this.config.priorityWeighting) {
      combinations.sort((a, b) => b.weight - a.weight);
      
      // Update execution order after sorting
      combinations.forEach((combo, index) => {
        combo.executionOrder = index;
      });
    }

    return combinations;
  }

  private async applyConstraints(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    const validCombinations: MatrixCombination[] = [];

    for (const combination of combinations) {
      if (await this.isValidCombination(combination, dimensions)) {
        validCombinations.push(combination);
      }
    }

    return validCombinations;
  }

  private async isValidCombination(
    combination: MatrixCombination, 
    dimensions: MatrixDimension[]
  ): Promise<boolean> {
    // Check global constraints
    for (const constraint of this.constraints) {
      if (!(await this.evaluateConstraint(constraint, combination, dimensions))) {
        return false;
      }
    }

    // Check dimension-specific constraints
    for (const dimension of dimensions) {
      for (const constraint of dimension.constraints) {
        if (!(await this.evaluateConstraint(constraint, combination, dimensions))) {
          return false;
        }
      }
    }

    // Check value-specific constraints
    for (const dimension of dimensions) {
      const selectedValueId = combination.values[dimension.id];
      const selectedValue = dimension.values.find(v => v.id === selectedValueId);
      
      if (selectedValue) {
        for (const valueConstraint of selectedValue.constraints) {
          if (!(await this.evaluateValueConstraint(valueConstraint, combination, dimensions))) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private async evaluateConstraint(
    constraint: DimensionConstraint, 
    combination: MatrixCombination,
    dimensions: MatrixDimension[]
  ): Promise<boolean> {
    try {
      // Create evaluation context
      const context = this.createEvaluationContext(combination, dimensions);
      
      // Evaluate the constraint rule
      const result = this.evaluateJavaScriptExpression(constraint.rule, context);
      
      // For exclusion constraints, return false if rule evaluates to true
      if (constraint.type === 'exclusion') {
        return !result;
      }
      
      // For inclusion constraints, return the result directly
      if (constraint.type === 'inclusion') {
        return result;
      }
      
      // For conditional constraints, evaluate based on condition
      if (constraint.type === 'conditional') {
        return result;
      }
      
      return true;
    } catch (error) {
      // If constraint evaluation fails, consider it invalid for safety
      return false;
    }
  }

  private async evaluateValueConstraint(
    constraint: ValueConstraint,
    combination: MatrixCombination,
    dimensions: MatrixDimension[]
  ): Promise<boolean> {
    const targetValue = combination.values[constraint.dimension_id];
    
    // Check allowed values
    if (constraint.allowed_values.length > 0 && !constraint.allowed_values.includes(targetValue)) {
      return false;
    }
    
    // Check disallowed values
    if (constraint.disallowed_values.includes(targetValue)) {
      return false;
    }
    
    // Evaluate conditional rules
    for (const rule of constraint.conditional_rules) {
      const context = this.createEvaluationContext(combination, dimensions);
      const conditionResult = this.evaluateJavaScriptExpression(rule.condition, context);
      
      if (conditionResult) {
        if (rule.then_allow.length > 0 && !rule.then_allow.includes(targetValue)) {
          return false;
        }
        if (rule.then_disallow.includes(targetValue)) {
          return false;
        }
      } else {
        if (rule.else_allow && rule.else_allow.length > 0 && !rule.else_allow.includes(targetValue)) {
          return false;
        }
        if (rule.else_disallow && rule.else_disallow.includes(targetValue)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private createEvaluationContext(combination: MatrixCombination, dimensions: MatrixDimension[]): Record<string, any> {
    const context: Record<string, any> = {};
    
    // Add dimension values to context
    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);
      
      context[dimId] = valueId;
      if (value) {
        context[`${dimId}_value`] = value.value;
        context[`${dimId}_weight`] = value.weight;
        context[`${dimId}_risk`] = value.riskLevel;
      }
    }
    
    return context;
  }

  private evaluateJavaScriptExpression(expression: string, context: Record<string, any>): boolean {
    try {
      // Simple expression evaluator - in production, use a safer sandbox
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      
      const func = new Function(...contextKeys, `return ${expression}`);
      return Boolean(func(...contextValues));
    } catch (error) {
      return false;
    }
  }

  private async optimizeCombinations(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    let optimized = [...combinations];

    switch (this.config.optimizationStrategy) {
      case 'full_coverage':
        optimized = await this.optimizeForFullCoverage(optimized, dimensions);
        break;
      case 'risk_based':
        optimized = await this.optimizeForRiskBased(optimized, dimensions);
        break;
      case 'priority_weighted':
        optimized = await this.optimizeForPriorityWeighted(optimized, dimensions);
        break;
      case 'time_constrained':
        optimized = await this.optimizeForTimeConstrained(optimized, dimensions);
        break;
    }

    // Apply max combinations limit
    if (optimized.length > this.config.maxCombinations) {
      optimized = optimized.slice(0, this.config.maxCombinations);
    }

    return optimized;
  }

  private async optimizeForFullCoverage(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    // Select combinations to ensure all dimension values are covered at least once
    const covered: Set<string> = new Set();
    const selected: MatrixCombination[] = [];

    // First pass: ensure every value is covered
    for (const combination of combinations) {
      let coversNewValue = false;
      
      for (const [dimId, valueId] of Object.entries(combination.values)) {
        const key = `${dimId}:${valueId}`;
        if (!covered.has(key)) {
          covered.add(key);
          coversNewValue = true;
        }
      }
      
      if (coversNewValue) {
        selected.push(combination);
      }
    }

    // Second pass: add high-priority combinations up to the limit
    const remaining = combinations.filter(c => !selected.includes(c));
    const additionalSlots = Math.max(0, this.config.maxCombinations - selected.length);
    
    selected.push(...remaining.slice(0, additionalSlots));

    return selected;
  }

  private async optimizeForRiskBased(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    // Calculate risk score for each combination
    const riskedCombinations = combinations.map(combo => ({
      ...combo,
      riskScore: this.calculateCombinationRisk(combo, dimensions)
    }));

    // Sort by risk score (highest first)
    riskedCombinations.sort((a, b) => b.riskScore - a.riskScore);

    // Select top combinations based on risk
    return riskedCombinations.slice(0, this.config.maxCombinations);
  }

  private async optimizeForPriorityWeighted(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    // Combinations are already sorted by weight, just take the top ones
    return combinations.slice(0, this.config.maxCombinations);
  }

  private async optimizeForTimeConstrained(
    combinations: MatrixCombination[], 
    dimensions: MatrixDimension[]
  ): Promise<MatrixCombination[]> {
    // Estimate execution time for each combination and select within constraints
    const timedCombinations = combinations.map(combo => ({
      ...combo,
      estimatedTime: this.estimateCombinationExecutionTime(combo, dimensions)
    }));

    // Sort by efficiency (weight per unit time)
    timedCombinations.sort((a, b) => {
      const efficiencyA = a.weight / Math.max(1, a.estimatedTime);
      const efficiencyB = b.weight / Math.max(1, b.estimatedTime);
      return efficiencyB - efficiencyA;
    });

    // Select combinations that fit within time constraints
    const selected: MatrixCombination[] = [];
    let totalTime = 0;
    const maxTime = 24 * 60 * 60 * 1000; // 24 hours default

    for (const combo of timedCombinations) {
      if (totalTime + combo.estimatedTime <= maxTime && selected.length < this.config.maxCombinations) {
        selected.push(combo);
        totalTime += combo.estimatedTime;
      }
    }

    return selected;
  }

  private calculateCombinationRisk(combination: MatrixCombination, dimensions: MatrixDimension[]): number {
    let totalRisk = 0;
    let totalWeight = 0;

    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);
      
      if (dimension && value) {
        const riskValue = this.getRiskValue(value.riskLevel);
        const weight = dimension.weight * value.weight;
        
        totalRisk += riskValue * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalRisk / totalWeight : 0;
  }

  private getRiskValue(riskLevel: string): number {
    switch (riskLevel) {
      case 'low': return 1;
      case 'medium': return 3;
      case 'high': return 7;
      case 'extreme': return 10;
      default: return 1;
    }
  }

  private estimateCombinationExecutionTime(combination: MatrixCombination, dimensions: MatrixDimension[]): number {
    let totalComplexity = 0;
    
    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);
      
      if (value) {
        totalComplexity += value.testComplexity;
      }
    }

    // Base time per complexity unit (in milliseconds)
    const baseTimePerComplexity = 30000; // 30 seconds
    return totalComplexity * baseTimePerComplexity;
  }

  private async analyzeCoverage(
    dimensions: MatrixDimension[], 
    combinations: MatrixCombination[],
    totalPossible: number
  ): Promise<CoverageAnalysis> {
    const dimensionCoverage: DimensionCoverage[] = [];
    const interactionCoverage: InteractionCoverage[] = [];
    const gaps: CoverageGap[] = [];
    const redundancies: CoverageRedundancy[] = [];

    // Analyze coverage for each dimension
    for (const dimension of dimensions) {
      const coveredValues = new Set<string>();
      const valueCounts = new Map<string, number>();

      // Count how often each value appears
      for (const combination of combinations) {
        const valueId = combination.values[dimension.id];
        if (valueId) {
          coveredValues.add(valueId);
          valueCounts.set(valueId, (valueCounts.get(valueId) || 0) + 1);
        }
      }

      const totalValues = dimension.values.length;
      const uncoveredValues = dimension.values
        .filter(v => !coveredValues.has(v.id))
        .map(v => v.id);
        
      const overtestedValues = Array.from(valueCounts.entries())
        .filter(([_, count]) => count > Math.ceil(combinations.length / totalValues) * 1.5)
        .map(([valueId, _]) => valueId);

      dimensionCoverage.push({
        dimensionId: dimension.id,
        totalValues,
        coveredValues: coveredValues.size,
        coveragePercentage: (coveredValues.size / totalValues) * 100,
        uncoveredValues,
        overtestedValues
      });

      // Identify gaps
      if (uncoveredValues.length > 0) {
        const criticalUncovered = uncoveredValues.filter(valueId => {
          const value = dimension.values.find(v => v.id === valueId);
          return value?.riskLevel === 'high' || value?.riskLevel === 'extreme';
        });

        if (criticalUncovered.length > 0) {
          gaps.push({
            type: 'critical_path_missing',
            severity: 'critical',
            description: `Critical values not covered in ${dimension.name}`,
            dimensions: [dimension.id],
            values: criticalUncovered,
            businessImpact: 9,
            recommendation: `Add test cases covering ${criticalUncovered.join(', ')}`
          });
        }
      }
    }

    // Analyze pairwise interactions
    for (let i = 0; i < dimensions.length; i++) {
      for (let j = i + 1; j < dimensions.length; j++) {
        const dim1 = dimensions[i];
        const dim2 = dimensions[j];
        
        const possiblePairs = dim1.values.length * dim2.values.length;
        const coveredPairs = new Set<string>();

        for (const combination of combinations) {
          const value1 = combination.values[dim1.id];
          const value2 = combination.values[dim2.id];
          if (value1 && value2) {
            coveredPairs.add(`${value1}:${value2}`);
          }
        }

        interactionCoverage.push({
          dimensions: [dim1.id, dim2.id],
          interactions: possiblePairs,
          covered: coveredPairs.size,
          coveragePercentage: (coveredPairs.size / possiblePairs) * 100,
          criticalUncovered: []
        });
      }
    }

    // Find redundancies
    const similarityThreshold = 0.8;
    for (let i = 0; i < combinations.length; i++) {
      for (let j = i + 1; j < combinations.length; j++) {
        const similarity = this.calculateCombinationSimilarity(combinations[i], combinations[j]);
        if (similarity > similarityThreshold) {
          redundancies.push({
            combinations: [combinations[i].values.toString(), combinations[j].values.toString()],
            similarityScore: similarity,
            wastedEffort: Math.min(combinations[i].weight, combinations[j].weight),
            recommendation: `Consider removing or modifying less critical combination`
          });
        }
      }
    }

    return {
      totalPossibleCombinations: totalPossible,
      selectedCombinations: combinations.length,
      coveragePercentage: (combinations.length / totalPossible) * 100,
      dimensionCoverage,
      interactionCoverage,
      gaps,
      redundancies
    };
  }

  private calculateCombinationSimilarity(combo1: MatrixCombination, combo2: MatrixCombination): number {
    const keys1 = Object.keys(combo1.values);
    const keys2 = Object.keys(combo2.values);
    
    const allKeys = new Set([...keys1, ...keys2]);
    let matchingValues = 0;

    for (const key of allKeys) {
      if (combo1.values[key] === combo2.values[key]) {
        matchingValues++;
      }
    }

    return matchingValues / allKeys.size;
  }

  private async analyzeRisk(combinations: MatrixCombination[], dimensions: MatrixDimension[]): Promise<RiskAnalysis> {
    const riskyCombinations: RiskyCombination[] = [];
    const riskDistribution: RiskDistribution = { low: 0, medium: 0, high: 0, extreme: 0 };
    const mitigation: RiskMitigation[] = [];

    let totalRiskScore = 0;

    for (const combination of combinations) {
      const riskScore = this.calculateCombinationRisk(combination, dimensions);
      totalRiskScore += riskScore;

      // Categorize risk level
      let riskCategory: keyof RiskDistribution;
      if (riskScore < 2) riskCategory = 'low';
      else if (riskScore < 5) riskCategory = 'medium';
      else if (riskScore < 8) riskCategory = 'high';
      else riskCategory = 'extreme';

      riskDistribution[riskCategory]++;

      // Track high-risk combinations
      if (riskScore >= 7) {
        const riskFactors = this.identifyRiskFactors(combination, dimensions);
        
        riskyCombinations.push({
          combinationId: `${combination.executionOrder}`,
          riskScore,
          riskFactors,
          businessImpact: this.calculateBusinessImpact(combination, dimensions),
          likelihood: this.calculateRiskLikelihood(combination, dimensions),
          mitigation: this.generateRiskMitigation(riskFactors)
        });
      }
    }

    const overallRiskScore = combinations.length > 0 ? totalRiskScore / combinations.length : 0;

    // Generate mitigation strategies
    const commonRiskTypes = this.identifyCommonRiskTypes(riskyCombinations);
    for (const riskType of commonRiskTypes) {
      mitigation.push({
        riskType,
        strategy: this.getMitigationStrategy(riskType),
        implementation: this.getMitigationImplementation(riskType),
        cost: this.getMitigationCost(riskType),
        effectiveness: this.getMitigationEffectiveness(riskType)
      });
    }

    return {
      overallRiskScore,
      highRiskCombinations: riskyCombinations,
      riskDistribution,
      mitigation
    };
  }

  private identifyRiskFactors(combination: MatrixCombination, dimensions: MatrixDimension[]): RiskFactor[] {
    const factors: RiskFactor[] = [];

    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);

      if (value && (value.riskLevel === 'high' || value.riskLevel === 'extreme')) {
        factors.push({
          type: 'technical',
          description: `High-risk value '${value.name}' in dimension '${dimension?.name}'`,
          severity: this.getRiskValue(value.riskLevel),
          probability: value.frequency
        });
      }
    }

    return factors;
  }

  private calculateBusinessImpact(combination: MatrixCombination, dimensions: MatrixDimension[]): number {
    let totalImpact = 0;
    let totalWeight = 0;

    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);

      if (value) {
        totalImpact += value.businessImpact * value.weight;
        totalWeight += value.weight;
      }
    }

    return totalWeight > 0 ? totalImpact / totalWeight : 0;
  }

  private calculateRiskLikelihood(combination: MatrixCombination, dimensions: MatrixDimension[]): number {
    let totalLikelihood = 1;

    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);

      if (value) {
        totalLikelihood *= value.frequency;
      }
    }

    return totalLikelihood;
  }

  private generateRiskMitigation(riskFactors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'technical':
          mitigations.push('Implement comprehensive error handling and monitoring');
          mitigations.push('Add automated rollback mechanisms');
          break;
        case 'business':
          mitigations.push('Define clear escalation procedures');
          mitigations.push('Implement business continuity plans');
          break;
        case 'security':
          mitigations.push('Add additional security validation layers');
          mitigations.push('Implement security monitoring and alerting');
          break;
      }
    }

    return [...new Set(mitigations)]; // Remove duplicates
  }

  private identifyCommonRiskTypes(riskyCombinations: RiskyCombination[]): string[] {
    const riskTypeCounts = new Map<string, number>();

    for (const combo of riskyCombinations) {
      for (const factor of combo.riskFactors) {
        riskTypeCounts.set(factor.type, (riskTypeCounts.get(factor.type) || 0) + 1);
      }
    }

    return Array.from(riskTypeCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([type, _]) => type);
  }

  private getMitigationStrategy(riskType: string): string {
    const strategies: Record<string, string> = {
      'technical': 'Implement robust error handling and monitoring',
      'business': 'Establish clear business continuity procedures',
      'compliance': 'Ensure comprehensive regulatory compliance testing',
      'security': 'Deploy defense-in-depth security measures',
      'performance': 'Implement performance monitoring and auto-scaling'
    };

    return strategies[riskType] || 'Implement comprehensive risk management practices';
  }

  private getMitigationImplementation(riskType: string): string[] {
    const implementations: Record<string, string[]> = {
      'technical': [
        'Add comprehensive logging and monitoring',
        'Implement circuit breakers and bulkheads',
        'Create automated testing for edge cases',
        'Establish clear error recovery procedures'
      ],
      'business': [
        'Define business continuity plans',
        'Establish communication procedures',
        'Create escalation matrices',
        'Implement business impact assessments'
      ],
      'security': [
        'Implement multi-layer security validation',
        'Add security monitoring and alerting',
        'Conduct regular security assessments',
        'Establish incident response procedures'
      ]
    };

    return implementations[riskType] || ['Implement comprehensive risk management'];
  }

  private getMitigationCost(riskType: string): 'low' | 'medium' | 'high' {
    const costs: Record<string, 'low' | 'medium' | 'high'> = {
      'technical': 'medium',
      'business': 'low',
      'compliance': 'high',
      'security': 'high',
      'performance': 'medium'
    };

    return costs[riskType] || 'medium';
  }

  private getMitigationEffectiveness(riskType: string): number {
    const effectiveness: Record<string, number> = {
      'technical': 0.8,
      'business': 0.7,
      'compliance': 0.9,
      'security': 0.85,
      'performance': 0.75
    };

    return effectiveness[riskType] || 0.7;
  }

  private generateOptimizationReport(original: number, optimized: number): OptimizationResult {
    const reductionPercentage = original > 0 ? ((original - optimized) / original) * 100 : 0;
    const timeSaved = (original - optimized) * 30000; // Assume 30 seconds per test
    
    return {
      strategy: this.config.optimizationStrategy,
      originalCombinations: original,
      optimizedCombinations: optimized,
      reductionPercentage,
      timesSaved: timeSaved,
      coverageMaintained: Math.min(100, (optimized / Math.min(original, this.config.maxCombinations)) * 100),
      optimizations: [
        {
          name: 'Priority-based filtering',
          description: 'Selected highest priority combinations based on weight',
          combinationsRemoved: Math.max(0, original - optimized),
          coverageImpact: -5,
          riskImpact: -2,
          reasoning: 'Maintained coverage while focusing on high-impact scenarios'
        }
      ]
    };
  }

  private estimateExecutionTime(combinations: MatrixCombination[]): number {
    return combinations.length * 30000; // 30 seconds per combination
  }

  private estimateCost(combinations: MatrixCombination[]): number {
    return combinations.length * 10; // $10 per combination
  }

  getMatrix(matrixId: string): ScenarioMatrix | undefined {
    return this.matrices.get(matrixId);
  }

  listMatrices(): ScenarioMatrix[] {
    return Array.from(this.matrices.values());
  }

  getTemplate(templateId: string): ScenarioTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(): ScenarioTemplate[] {
    return Array.from(this.templates.values());
  }

  addCustomTemplate(template: ScenarioTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template-added', { templateId: template.id, template });
  }

  async convertToScenarios(matrix: ScenarioMatrix): Promise<BDDScenario[]> {
    const scenarios: BDDScenario[] = [];

    for (const combination of matrix.combinations) {
      const scenario = await this.generateScenarioFromCombination(combination, matrix);
      scenarios.push(scenario);
    }

    return scenarios;
  }

  private async generateScenarioFromCombination(
    combination: MatrixCombination, 
    matrix: ScenarioMatrix
  ): Promise<BDDScenario> {
    const scenarioId = `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    // Generate scenario steps based on combination values
    const given = this.generateGivenSteps(combination, matrix);
    const when = this.generateWhenSteps(combination, matrix);
    const then = this.generateThenSteps(combination, matrix);

    return {
      id: scenarioId,
      title: this.generateScenarioTitle(combination, matrix),
      description: this.generateScenarioDescription(combination, matrix),
      feature: matrix.name,
      given,
      when,
      then,
      tags: this.generateScenarioTags(combination, matrix),
      complexity: this.determineScenarioComplexity(combination, matrix),
      dimensions: matrix.dimensions.map(d => ({
        name: d.name,
        type: d.type as any,
        parameters: { selectedValue: combination.values[d.id] },
        matrix: { axes: [], combinations: [], coverage: 0 }
      }))
    };
  }

  private generateGivenSteps(combination: MatrixCombination, matrix: ScenarioMatrix): any[] {
    return matrix.dimensions.map(dimension => {
      const valueId = combination.values[dimension.id];
      const value = dimension.values.find(v => v.id === valueId);
      
      return {
        step: `Given the ${dimension.name.toLowerCase()} is "${value?.name || valueId}"`,
        parameters: { [dimension.id]: value?.value },
        parallelizable: true,
        dependencies: [],
        validationRules: []
      };
    });
  }

  private generateWhenSteps(combination: MatrixCombination, matrix: ScenarioMatrix): any[] {
    return [{
      step: 'When the system processes the request',
      parameters: combination.values,
      parallelizable: false,
      dependencies: [],
      validationRules: []
    }];
  }

  private generateThenSteps(combination: MatrixCombination, matrix: ScenarioMatrix): any[] {
    return [{
      step: 'Then the system should respond successfully',
      parameters: {},
      parallelizable: false,
      dependencies: [],
      validationRules: [
        {
          type: 'assertion' as any,
          rule: 'response.status === "success"',
          parameters: {},
          errorMessage: 'System did not respond successfully',
          severity: 'error' as any
        }
      ]
    }];
  }

  private generateScenarioTitle(combination: MatrixCombination, matrix: ScenarioMatrix): string {
    const valueDescriptions = matrix.dimensions.map(dimension => {
      const valueId = combination.values[dimension.id];
      const value = dimension.values.find(v => v.id === valueId);
      return value?.name || valueId;
    });

    return `Test ${matrix.name} with ${valueDescriptions.join(' and ')}`;
  }

  private generateScenarioDescription(combination: MatrixCombination, matrix: ScenarioMatrix): string {
    return `Automatically generated scenario testing the combination: ${JSON.stringify(combination.values)}`;
  }

  private generateScenarioTags(combination: MatrixCombination, matrix: ScenarioMatrix): string[] {
    const tags = ['automated', 'matrix-generated'];
    
    // Add risk-based tags
    const riskScore = this.calculateCombinationRisk(combination, matrix.dimensions);
    if (riskScore >= 7) tags.push('high-risk');
    else if (riskScore >= 4) tags.push('medium-risk');
    else tags.push('low-risk');

    // Add dimension-based tags
    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = matrix.dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);
      
      if (value?.riskLevel === 'extreme') tags.push('extreme-case');
      if (value?.frequency && value.frequency < 0.1) tags.push('edge-case');
    }

    return tags;
  }

  private determineScenarioComplexity(combination: MatrixCombination, matrix: ScenarioMatrix): 'simple' | 'moderate' | 'complex' | 'enterprise' {
    let totalComplexity = 0;
    let totalWeight = 0;

    for (const [dimId, valueId] of Object.entries(combination.values)) {
      const dimension = matrix.dimensions.find(d => d.id === dimId);
      const value = dimension?.values.find(v => v.id === valueId);

      if (value) {
        totalComplexity += value.testComplexity * dimension.weight;
        totalWeight += dimension.weight;
      }
    }

    const averageComplexity = totalWeight > 0 ? totalComplexity / totalWeight : 0;

    if (averageComplexity >= 8) return 'enterprise';
    if (averageComplexity >= 6) return 'complex';
    if (averageComplexity >= 4) return 'moderate';
    return 'simple';
  }
}