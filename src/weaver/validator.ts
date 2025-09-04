/**
 * Semantic Convention Validator
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { existsSync } from 'node:fs';
import type { 
  SemanticConventionRegistry, 
  SemanticConventionGroup, 
  SemanticConventionAttribute,
  SemanticConventionMetric 
} from './forge-integration';

export interface ValidationOptions {
  strict?: boolean;
  checkReferences?: boolean;
  validateExamples?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    groups: number;
    attributes: number;
    metrics: number;
  };
}

export interface ValidationError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export class SemanticConventionValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  /**
   * Validate a semantic convention registry
   */
  async validate(registryPath: string, options: ValidationOptions = {}): Promise<ValidationResult> {
    this.errors = [];
    this.warnings = [];

    if (!existsSync(registryPath)) {
      this.addError('', `Registry path does not exist: ${registryPath}`);
      return this.buildResult();
    }

    const registry = await this.loadRegistry(registryPath);
    
    // Validate structure
    this.validateRegistryStructure(registry);
    
    // Validate groups
    for (const group of registry.groups) {
      this.validateGroup(group, options);
    }
    
    // Validate attributes
    for (const attribute of registry.attributes) {
      this.validateAttribute(attribute, options);
    }
    
    // Validate metrics
    if (registry.metrics) {
      for (const metric of registry.metrics) {
        this.validateMetric(metric, options);
      }
    }
    
    // Cross-validation
    if (options.checkReferences) {
      this.validateReferences(registry);
    }

    return this.buildResult(registry);
  }

  private async loadRegistry(registryPath: string): Promise<SemanticConventionRegistry> {
    const registry: SemanticConventionRegistry = {
      groups: [],
      attributes: [],
      metrics: [],
      resource_attributes: []
    };

    await this.loadYamlFilesRecursively(registryPath, registry);
    return registry;
  }

  private async loadYamlFilesRecursively(
    dir: string, 
    registry: SemanticConventionRegistry
  ): Promise<void> {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        await this.loadYamlFilesRecursively(fullPath, registry);
      } else if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
        await this.loadYamlFile(fullPath, registry);
      }
    }
  }

  private async loadYamlFile(
    filePath: string, 
    registry: SemanticConventionRegistry
  ): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = parseYaml(content);
      
      if (data.groups) {
        registry.groups.push(...data.groups.map((g: any) => ({ ...g, _file: filePath })));
      }
      
      if (data.attributes) {
        registry.attributes.push(...data.attributes.map((a: any) => ({ ...a, _file: filePath })));
      }
      
      if (data.metrics) {
        registry.metrics!.push(...data.metrics.map((m: any) => ({ ...m, _file: filePath })));
      }
      
      if (data.resource_attributes) {
        registry.resource_attributes!.push(...data.resource_attributes.map((a: any) => ({ ...a, _file: filePath })));
      }
    } catch (error) {
      this.addError(filePath, `Failed to parse YAML: ${error}`);
    }
  }

  private validateRegistryStructure(registry: SemanticConventionRegistry): void {
    if (!registry.groups || registry.groups.length === 0) {
      this.addWarning('', 'No semantic convention groups found');
    }
    
    if (!registry.attributes || registry.attributes.length === 0) {
      this.addWarning('', 'No attributes found');
    }
  }

  private validateGroup(group: any, options: ValidationOptions): void {
    const file = group._file || '';
    
    // Required fields
    if (!group.id) {
      this.addError(file, 'Group missing required field: id');
    }
    
    if (!group.type) {
      this.addError(file, 'Group missing required field: type');
    } else if (!['span', 'event', 'metric', 'resource', 'scope'].includes(group.type)) {
      this.addError(file, `Invalid group type: ${group.type}`);
    }
    
    if (!group.brief) {
      this.addError(file, 'Group missing required field: brief');
    }

    // Validate ID format
    if (group.id && !this.isValidId(group.id)) {
      this.addError(file, `Invalid group ID format: ${group.id}. Should use dot notation (e.g., 'http.server')`);
    }

    // Validate stability
    if (group.stability && !['stable', 'experimental', 'deprecated'].includes(group.stability)) {
      this.addError(file, `Invalid stability value: ${group.stability}`);
    }

    // Validate attributes
    if (group.attributes) {
      for (const attr of group.attributes) {
        this.validateAttribute({ ...attr, _file: file }, options);
      }
    }

    // Validate constraints
    if (group.constraints) {
      this.validateConstraints(group.constraints, file);
    }

    if (options.strict) {
      this.validateGroupStrict(group, file);
    }
  }

  private validateAttribute(attribute: any, options: ValidationOptions): void {
    const file = attribute._file || '';
    
    // Required fields
    if (!attribute.id) {
      this.addError(file, 'Attribute missing required field: id');
    }
    
    if (!attribute.type) {
      this.addError(file, 'Attribute missing required field: type');
    } else if (!['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]'].includes(attribute.type)) {
      this.addError(file, `Invalid attribute type: ${attribute.type}`);
    }
    
    if (!attribute.brief) {
      this.addError(file, 'Attribute missing required field: brief');
    }
    
    if (!attribute.requirement_level) {
      this.addError(file, 'Attribute missing required field: requirement_level');
    } else if (!['required', 'conditionally_required', 'recommended', 'opt_in'].includes(attribute.requirement_level)) {
      this.addError(file, `Invalid requirement_level: ${attribute.requirement_level}`);
    }

    // Validate ID format
    if (attribute.id && !this.isValidAttributeId(attribute.id)) {
      this.addError(file, `Invalid attribute ID format: ${attribute.id}. Should use dot or underscore notation`);
    }

    // Validate stability
    if (attribute.stability && !['stable', 'experimental', 'deprecated'].includes(attribute.stability)) {
      this.addError(file, `Invalid stability value: ${attribute.stability}`);
    }

    // Validate examples
    if (options.validateExamples && attribute.examples) {
      this.validateExamples(attribute, file);
    }

    // Validate deprecated attributes
    if (attribute.stability === 'deprecated' && !attribute.deprecated) {
      this.addWarning(file, `Deprecated attribute ${attribute.id} should have a 'deprecated' field explaining why`);
    }
  }

  private validateMetric(metric: any, options: ValidationOptions): void {
    const file = metric._file || '';
    
    // Required fields
    if (!metric.id) {
      this.addError(file, 'Metric missing required field: id');
    }
    
    if (!metric.type) {
      this.addError(file, 'Metric missing required field: type');
    } else if (!['counter', 'histogram', 'gauge', 'updowncounter'].includes(metric.type)) {
      this.addError(file, `Invalid metric type: ${metric.type}`);
    }
    
    if (!metric.brief) {
      this.addError(file, 'Metric missing required field: brief');
    }
    
    if (!metric.instrument) {
      this.addError(file, 'Metric missing required field: instrument');
    }
    
    if (!metric.unit) {
      this.addError(file, 'Metric missing required field: unit');
    }

    // Validate unit format
    if (metric.unit && !this.isValidUnit(metric.unit)) {
      this.addWarning(file, `Non-standard unit format: ${metric.unit}. Consider using standard units like 's', 'ms', 'By', etc.`);
    }
  }

  private validateConstraints(constraints: any[], file: string): void {
    for (const constraint of constraints) {
      if (!constraint.any_of && !constraint.include) {
        this.addError(file, 'Constraint must have either any_of or include');
      }
      
      if (constraint.any_of && !Array.isArray(constraint.any_of)) {
        this.addError(file, 'Constraint any_of must be an array');
      }
    }
  }

  private validateExamples(attribute: any, file: string): void {
    if (!attribute.examples) return;
    
    const examples = Array.isArray(attribute.examples) ? attribute.examples : [attribute.examples];
    
    for (const example of examples) {
      if (!this.isValidExampleForType(example, attribute.type)) {
        this.addWarning(file, `Example "${example}" does not match attribute type ${attribute.type} for ${attribute.id}`);
      }
    }
  }

  private validateReferences(registry: SemanticConventionRegistry): void {
    const allAttributeIds = new Set([
      ...registry.attributes.map(a => a.id),
      ...registry.resource_attributes?.map(a => a.id) || [],
      ...registry.groups.flatMap(g => g.attributes?.map(a => a.id) || [])
    ]);
    
    // Check if referenced attributes exist
    for (const group of registry.groups) {
      if (group.extends) {
        const extendsGroup = registry.groups.find(g => g.id === group.extends);
        if (!extendsGroup) {
          this.addError(group._file || '', `Group ${group.id} extends non-existent group: ${group.extends}`);
        }
      }
      
      // Check constraint references
      if (group.constraints) {
        for (const constraint of group.constraints) {
          if (constraint.any_of) {
            for (const attrId of constraint.any_of) {
              if (!allAttributeIds.has(attrId)) {
                this.addWarning(group._file || '', `Constraint references non-existent attribute: ${attrId}`);
              }
            }
          }
        }
      }
    }
  }

  private validateGroupStrict(group: any, file: string): void {
    // Strict validation rules
    if (!group.note && group.type === 'span') {
      this.addWarning(file, `Span group ${group.id} should have a 'note' field for additional context`);
    }
    
    if (group.attributes && group.attributes.length === 0) {
      this.addWarning(file, `Group ${group.id} has empty attributes array`);
    }
    
    // Check for consistent naming
    if (group.id && group.prefix && !group.id.startsWith(group.prefix)) {
      this.addWarning(file, `Group ID ${group.id} should start with prefix ${group.prefix}`);
    }
  }

  private isValidId(id: string): boolean {
    // Valid ID: lowercase letters, numbers, dots, underscores
    return /^[a-z][a-z0-9_.]*[a-z0-9]$/.test(id);
  }

  private isValidAttributeId(id: string): boolean {
    // Valid attribute ID: lowercase letters, numbers, dots, underscores
    return /^[a-z][a-z0-9_.]*[a-z0-9]$/.test(id);
  }

  private isValidUnit(unit: string): boolean {
    // Common OpenTelemetry units
    const standardUnits = [
      's', 'ms', 'us', 'ns', // time
      'By', 'KBy', 'MBy', 'GBy', // bytes
      'Hz', 'kHz', 'MHz', 'GHz', // frequency
      '%', '1', // dimensionless
      'Cel', 'K', // temperature
    ];
    
    return standardUnits.includes(unit) || unit === '{operations}' || unit.startsWith('{');
  }

  private isValidExampleForType(example: any, type: string): boolean {
    switch (type) {
      case 'string': {
        return typeof example === 'string';
      }
      case 'number': {
        return typeof example === 'number';
      }
      case 'boolean': {
        return typeof example === 'boolean';
      }
      case 'string[]': {
        return Array.isArray(example) && example.every(e => typeof e === 'string');
      }
      case 'number[]': {
        return Array.isArray(example) && example.every(e => typeof e === 'number');
      }
      case 'boolean[]': {
        return Array.isArray(example) && example.every(e => typeof e === 'boolean');
      }
      default: {
        return true;
      } // Unknown type, assume valid
    }
  }

  private addError(file: string, message: string): void {
    this.errors.push({
      file,
      message,
      severity: 'error'
    });
  }

  private addWarning(file: string, message: string): void {
    this.warnings.push({
      file,
      message,
      severity: 'warning'
    });
  }

  private buildResult(registry?: SemanticConventionRegistry): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map(e => `${e.file ? `${e.file}: ` : ''}${e.message}`),
      warnings: this.warnings.map(w => `${w.file ? `${w.file}: ` : ''}${w.message}`),
      stats: {
        groups: registry?.groups?.length || 0,
        attributes: (registry?.attributes?.length || 0) + (registry?.resource_attributes?.length || 0),
        metrics: registry?.metrics?.length || 0,
      }
    };
  }
}