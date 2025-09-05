import { UnifiedResponse, SystemType } from '../types/orchestration';
import { Logger } from '../monitoring/logger';

interface TransformationRule {
  id: string;
  name: string;
  sourceSystem: SystemType;
  targetFormat?: 'json' | 'xml' | 'csv' | 'custom';
  conditions: Array<{
    field: string;
    operator: 'exists' | 'equals' | 'contains' | 'regex';
    value?: any;
  }>;
  transformations: Array<{
    type: 'map' | 'filter' | 'aggregate' | 'enrich' | 'validate' | 'custom';
    config: any;
  }>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

interface TransformationResult {
  transformed: boolean;
  originalData: any;
  transformedData: any;
  appliedRules: string[];
  errors: Array<{
    ruleId: string;
    error: string;
  }>;
  metadata: {
    processingTime: number;
    transformationCount: number;
  };
}

interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: any) => any;
  required?: boolean;
  defaultValue?: any;
}

export class ResponseTransformer {
  private logger: Logger;
  private rules: Map<string, TransformationRule> = new Map();
  private systemMappings: Map<SystemType, FieldMapping[]> = new Map();

  constructor() {
    this.logger = new Logger('info');
    this.initializeDefaultRules();
    this.initializeSystemMappings();
  }

  private initializeDefaultRules(): void {
    // CNS response transformation rules
    this.addRule({
      id: 'cns-uhft-normalization',
      name: 'CNS UHFT Response Normalization',
      sourceSystem: 'cns',
      conditions: [
        { field: 'operation', operator: 'contains', value: 'uhft' }
      ],
      transformations: [
        {
          type: 'map',
          config: {
            'uhftScore': 'quality.uhft_score',
            'semanticAnalysis.confidence': 'quality.semantic_confidence',
            'semanticAnalysis.concepts': 'extracted_concepts'
          }
        },
        {
          type: 'enrich',
          config: {
            'system_info': {
              'source': 'cns',
              'processing_type': 'uhft_validation'
            }
          }
        }
      ],
      priority: 10,
      enabled: true,
      createdAt: new Date()
    });

    // ByteStar response transformation rules
    this.addRule({
      id: 'bytestar-ai-enhancement',
      name: 'ByteStar AI Response Enhancement',
      sourceSystem: 'bytestar',
      conditions: [
        { field: 'operation', operator: 'contains', value: 'ai-enhance' }
      ],
      transformations: [
        {
          type: 'map',
          config: {
            'improvements': 'enhancements',
            'optimizations': 'performance_gains',
            'metadata.model': 'ai_model_used',
            'metadata.confidence': 'confidence_score'
          }
        },
        {
          type: 'aggregate',
          config: {
            'enhancement_summary': {
              'total_improvements': 'count(enhancements)',
              'avg_confidence': 'avg(confidence_score)',
              'model_version': 'ai_model_used'
            }
          }
        }
      ],
      priority: 10,
      enabled: true,
      createdAt: new Date()
    });

    // Marketplace response transformation rules
    this.addRule({
      id: 'marketplace-search-results',
      name: 'Marketplace Search Results Standardization',
      sourceSystem: 'marketplace',
      conditions: [
        { field: 'operation', operator: 'equals', value: 'marketplace.search' }
      ],
      transformations: [
        {
          type: 'map',
          config: {
            'results': 'items',
            'facets': 'filters',
            'total': 'total_count'
          }
        },
        {
          type: 'enrich',
          config: {
            'search_metadata': {
              'timestamp': '{{now}}',
              'result_type': 'marketplace_search'
            }
          }
        },
        {
          type: 'filter',
          config: {
            'remove_internal_fields': ['__internal', '_debug']
          }
        }
      ],
      priority: 5,
      enabled: true,
      createdAt: new Date()
    });

    // Cross-system workflow results
    this.addRule({
      id: 'cross-system-workflow',
      name: 'Cross-System Workflow Result Aggregation',
      sourceSystem: 'marketplace',
      conditions: [
        { field: 'metadata.workflowId', operator: 'exists' }
      ],
      transformations: [
        {
          type: 'aggregate',
          config: {
            'workflow_summary': {
              'workflow_id': 'metadata.workflowId',
              'total_steps': 'count(steps)',
              'successful_steps': 'count(steps.status=completed)',
              'processing_time': 'sum(steps.processing_time)'
            }
          }
        },
        {
          type: 'custom',
          config: {
            'function': 'calculateWorkflowEfficiency'
          }
        }
      ],
      priority: 15,
      enabled: true,
      createdAt: new Date()
    });
  }

  private initializeSystemMappings(): void {
    // CNS system field mappings
    this.systemMappings.set('cns', [
      { source: 'valid', target: 'is_valid', required: true },
      { source: 'uhftScore', target: 'uhft_score', transform: (val) => Math.round(val * 100) / 100 },
      { source: 'semanticAnalysis', target: 'semantic_data' },
      { source: 'confidence', target: 'confidence_level', transform: (val) => val * 100 }
    ]);

    // ByteStar system field mappings
    this.systemMappings.set('bytestar', [
      { source: 'enhanced', target: 'is_enhanced', required: true },
      { source: 'improvements', target: 'enhancement_list' },
      { source: 'optimizations', target: 'performance_optimizations' },
      { source: 'generated', target: 'ai_generated_content' },
      { source: 'metadata.tokens', target: 'token_count', transform: (val) => parseInt(val) }
    ]);

    // Marketplace system field mappings
    this.systemMappings.set('marketplace', [
      { source: 'results', target: 'search_results' },
      { source: 'total', target: 'total_results', required: true },
      { source: 'facets', target: 'available_filters' },
      { source: 'transactionId', target: 'transaction_id' },
      { source: 'status', target: 'operation_status', required: true }
    ]);
  }

  async transform(response: UnifiedResponse): Promise<UnifiedResponse> {
    const startTime = Date.now();
    
    try {
      const result = await this.applyTransformations(response);
      
      // Create enhanced response
      const transformedResponse: UnifiedResponse = {
        ...response,
        data: result.transformedData,
        metadata: {
          ...response.metadata,
          transformation: {
            applied: result.transformed,
            rules: result.appliedRules,
            processing_time: result.metadata.processingTime,
            transformation_count: result.metadata.transformationCount,
            errors: result.errors
          }
        }
      };

      this.logger.debug(`Response transformed for ${response.source}`, {
        responseId: response.id,
        rulesApplied: result.appliedRules.length,
        processingTime: result.metadata.processingTime
      });

      return transformedResponse;

    } catch (error) {
      this.logger.error('Response transformation failed:', error as Error, {
        responseId: response.id,
        source: response.source
      });

      // Return original response on transformation failure
      return {
        ...response,
        metadata: {
          ...response.metadata,
          transformation: {
            applied: false,
            error: (error as Error).message,
            processing_time: Date.now() - startTime
          }
        }
      };
    }
  }

  private async applyTransformations(response: UnifiedResponse): Promise<TransformationResult> {
    const startTime = Date.now();
    const result: TransformationResult = {
      transformed: false,
      originalData: response.data,
      transformedData: response.data,
      appliedRules: [],
      errors: [],
      metadata: {
        processingTime: 0,
        transformationCount: 0
      }
    };

    // Get applicable rules
    const applicableRules = this.getApplicableRules(response);
    
    if (applicableRules.length === 0) {
      result.metadata.processingTime = Date.now() - startTime;
      return result;
    }

    // Apply transformations in priority order
    let currentData = JSON.parse(JSON.stringify(response.data));
    
    for (const rule of applicableRules) {
      try {
        const transformedData = await this.applyRule(rule, currentData, response);
        currentData = transformedData;
        result.appliedRules.push(rule.id);
        result.metadata.transformationCount++;
        result.transformed = true;
      } catch (error) {
        result.errors.push({
          ruleId: rule.id,
          error: (error as Error).message
        });
        this.logger.warn(`Transformation rule ${rule.id} failed:`, error as Error);
      }
    }

    // Apply system-specific field mappings
    try {
      const mappedData = this.applyFieldMappings(currentData, response.source);
      currentData = mappedData;
      result.metadata.transformationCount++;
    } catch (error) {
      result.errors.push({
        ruleId: 'field-mapping',
        error: (error as Error).message
      });
    }

    result.transformedData = currentData;
    result.metadata.processingTime = Date.now() - startTime;
    
    return result;
  }

  private getApplicableRules(response: UnifiedResponse): TransformationRule[] {
    const applicable: TransformationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.sourceSystem !== response.source) continue;
      
      if (this.matchesConditions(rule.conditions, response)) {
        applicable.push(rule);
      }
    }

    // Sort by priority (highest first)
    return applicable.sort((a, b) => b.priority - a.priority);
  }

  private matchesConditions(conditions: TransformationRule['conditions'], response: UnifiedResponse): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(response, condition.field);
      
      switch (condition.operator) {
        case 'exists':
          if (fieldValue === undefined || fieldValue === null) return false;
          break;
        case 'equals':
          if (fieldValue !== condition.value) return false;
          break;
        case 'contains':
          if (typeof fieldValue !== 'string' || !fieldValue.includes(condition.value)) return false;
          break;
        case 'regex':
          if (typeof fieldValue !== 'string' || !new RegExp(condition.value).test(fieldValue)) return false;
          break;
        default:
          return false;
      }
    }
    
    return true;
  }

  private async applyRule(rule: TransformationRule, data: any, response: UnifiedResponse): Promise<any> {
    let result = data;

    for (const transformation of rule.transformations) {
      switch (transformation.type) {
        case 'map':
          result = this.applyMapping(result, transformation.config);
          break;
        case 'filter':
          result = this.applyFiltering(result, transformation.config);
          break;
        case 'aggregate':
          result = this.applyAggregation(result, transformation.config);
          break;
        case 'enrich':
          result = this.applyEnrichment(result, transformation.config, response);
          break;
        case 'validate':
          result = this.applyValidation(result, transformation.config);
          break;
        case 'custom':
          result = await this.applyCustomTransformation(result, transformation.config, response);
          break;
        default:
          throw new Error(`Unknown transformation type: ${transformation.type}`);
      }
    }

    return result;
  }

  private applyMapping(data: any, config: Record<string, string>): any {
    const result = { ...data };

    for (const [sourcePath, targetPath] of Object.entries(config)) {
      const sourceValue = this.getNestedValue(data, sourcePath);
      if (sourceValue !== undefined) {
        this.setNestedValue(result, targetPath, sourceValue);
        
        // Remove original field if it's different from target
        if (sourcePath !== targetPath) {
          this.deleteNestedValue(result, sourcePath);
        }
      }
    }

    return result;
  }

  private applyFiltering(data: any, config: any): any {
    const result = { ...data };

    // Remove specified fields
    if (config.remove_fields && Array.isArray(config.remove_fields)) {
      for (const field of config.remove_fields) {
        this.deleteNestedValue(result, field);
      }
    }

    // Remove internal fields
    if (config.remove_internal_fields && Array.isArray(config.remove_internal_fields)) {
      for (const pattern of config.remove_internal_fields) {
        this.removeFieldsByPattern(result, pattern);
      }
    }

    // Keep only specified fields
    if (config.keep_only && Array.isArray(config.keep_only)) {
      const filteredResult: any = {};
      for (const field of config.keep_only) {
        const value = this.getNestedValue(data, field);
        if (value !== undefined) {
          this.setNestedValue(filteredResult, field, value);
        }
      }
      return filteredResult;
    }

    return result;
  }

  private applyAggregation(data: any, config: any): any {
    const result = { ...data };

    for (const [aggregateName, aggregateConfig] of Object.entries(config)) {
      const aggregated: any = {};

      for (const [field, expression] of Object.entries(aggregateConfig as any)) {
        aggregated[field] = this.evaluateAggregateExpression(data, expression as string);
      }

      result[aggregateName] = aggregated;
    }

    return result;
  }

  private applyEnrichment(data: any, config: any, response: UnifiedResponse): any {
    const result = { ...data };

    for (const [field, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // Template substitution
        result[field] = this.substituteTemplate(value as string, response);
      } else {
        result[field] = value;
      }
    }

    return result;
  }

  private applyValidation(data: any, config: any): any {
    // Validation doesn't modify data, but could throw errors
    for (const [field, rules] of Object.entries(config)) {
      const value = this.getNestedValue(data, field);
      
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          this.validateField(field, value, rule);
        }
      }
    }

    return data;
  }

  private async applyCustomTransformation(data: any, config: any, response: UnifiedResponse): Promise<any> {
    const functionName = config.function;
    
    switch (functionName) {
      case 'calculateWorkflowEfficiency':
        return this.calculateWorkflowEfficiency(data);
      case 'normalizeTimestamps':
        return this.normalizeTimestamps(data);
      case 'enhanceWithSystemMetadata':
        return this.enhanceWithSystemMetadata(data, response);
      default:
        this.logger.warn(`Unknown custom transformation function: ${functionName}`);
        return data;
    }
  }

  private applyFieldMappings(data: any, system: SystemType): any {
    const mappings = this.systemMappings.get(system);
    if (!mappings) return data;

    const result = { ...data };

    for (const mapping of mappings) {
      const sourceValue = this.getNestedValue(data, mapping.source);
      
      if (sourceValue !== undefined) {
        const transformedValue = mapping.transform ? mapping.transform(sourceValue) : sourceValue;
        this.setNestedValue(result, mapping.target, transformedValue);
        
        // Remove source if different from target
        if (mapping.source !== mapping.target) {
          this.deleteNestedValue(result, mapping.source);
        }
      } else if (mapping.required) {
        // Use default value if available
        if (mapping.defaultValue !== undefined) {
          this.setNestedValue(result, mapping.target, mapping.defaultValue);
        }
      }
    }

    return result;
  }

  // Custom transformation functions
  private calculateWorkflowEfficiency(data: any): any {
    const result = { ...data };
    
    if (data.workflow_summary) {
      const { total_steps, successful_steps, processing_time } = data.workflow_summary;
      result.workflow_summary.efficiency = {
        success_rate: successful_steps / total_steps,
        avg_step_time: processing_time / total_steps,
        overall_score: (successful_steps / total_steps) * (1 / Math.log(processing_time + 1))
      };
    }

    return result;
  }

  private normalizeTimestamps(data: any): any {
    const result = { ...data };
    
    const timestampFields = this.findTimestampFields(result);
    for (const field of timestampFields) {
      const value = this.getNestedValue(result, field);
      if (value) {
        this.setNestedValue(result, field, new Date(value).toISOString());
      }
    }

    return result;
  }

  private enhanceWithSystemMetadata(data: any, response: UnifiedResponse): any {
    return {
      ...data,
      system_metadata: {
        source_system: response.source,
        processing_timestamp: new Date().toISOString(),
        response_id: response.id,
        processing_time_ms: response.metadata.processingTime
      }
    };
  }

  // Utility methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target) {
      delete target[lastKey];
    }
  }

  private removeFieldsByPattern(obj: any, pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    const removeRecursive = (current: any) => {
      if (typeof current !== 'object' || current === null) return;
      
      for (const key of Object.keys(current)) {
        if (regex.test(key)) {
          delete current[key];
        } else if (typeof current[key] === 'object') {
          removeRecursive(current[key]);
        }
      }
    };

    removeRecursive(obj);
  }

  private evaluateAggregateExpression(data: any, expression: string): any {
    // Simple aggregate expression evaluation
    if (expression.startsWith('count(')) {
      const field = expression.slice(6, -1);
      const value = this.getNestedValue(data, field);
      return Array.isArray(value) ? value.length : (value ? 1 : 0);
    }
    
    if (expression.startsWith('avg(')) {
      const field = expression.slice(4, -1);
      const value = this.getNestedValue(data, field);
      if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
        return value.reduce((sum, v) => sum + v, 0) / value.length;
      }
      return 0;
    }
    
    if (expression.startsWith('sum(')) {
      const field = expression.slice(4, -1);
      const value = this.getNestedValue(data, field);
      if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
        return value.reduce((sum, v) => sum + v, 0);
      }
      return 0;
    }

    // Direct field reference
    return this.getNestedValue(data, expression);
  }

  private substituteTemplate(template: string, response: UnifiedResponse): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      switch (expression.trim()) {
        case 'now':
          return new Date().toISOString();
        case 'timestamp':
          return Date.now().toString();
        case 'response.id':
          return response.id;
        case 'response.source':
          return response.source;
        default:
          return match;
      }
    });
  }

  private validateField(fieldName: string, value: any, rule: any): void {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null) {
          throw new Error(`Field ${fieldName} is required`);
        }
        break;
      case 'type':
        if (typeof value !== rule.expected) {
          throw new Error(`Field ${fieldName} must be of type ${rule.expected}`);
        }
        break;
      case 'range':
        if (typeof value === 'number' && (value < rule.min || value > rule.max)) {
          throw new Error(`Field ${fieldName} must be between ${rule.min} and ${rule.max}`);
        }
        break;
    }
  }

  private findTimestampFields(obj: any): string[] {
    const timestampFields: string[] = [];
    const timestampPatterns = /timestamp|createdAt|updatedAt|time|date/i;
    
    const searchRecursive = (current: any, path: string = '') => {
      if (typeof current !== 'object' || current === null) return;
      
      for (const [key, value] of Object.entries(current)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (timestampPatterns.test(key) && (typeof value === 'string' || typeof value === 'number')) {
          timestampFields.push(currentPath);
        } else if (typeof value === 'object') {
          searchRecursive(value, currentPath);
        }
      }
    };

    searchRecursive(obj);
    return timestampFields;
  }

  // Public management methods
  addRule(rule: TransformationRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info(`Transformation rule added: ${rule.name}`);
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.logger.info(`Transformation rule removed: ${ruleId}`);
    }
    return removed;
  }

  getRules(): TransformationRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): TransformationRule | undefined {
    return this.rules.get(ruleId);
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }
}