/**
 * Comprehensive Input Validation System
 * Implements schema validation, custom validators, and security checks
 */

import { z } from 'zod';
import { Logger } from '../monitoring/Logger';

export interface ValidationOptions {
  strict?: boolean;
  allowUnknown?: boolean;
  sanitize?: boolean;
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  customValidators?: Record<string, (value: any) => boolean>;
}

export interface ValidationResult<T = any> {
  valid: boolean;
  data?: T;
  sanitized?: T;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  path: string;
  code: string;
  message: string;
  received: any;
  expected?: any;
}

export interface SecurityValidationResult {
  safe: boolean;
  issues: Array<{
    type: 'xss' | 'sql_injection' | 'path_traversal' | 'script_injection' | 'html_injection';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value: string;
  }>;
}

export class InputValidator {
  private logger: Logger;
  private customSchemas = new Map<string, z.ZodSchema>();
  
  // Security patterns
  private xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /<svg[^>]*onload/gi
  ];

  private sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
    /\b(union|select|insert|update|delete|drop|exec|sp_|xp_)\b/gi,
    /\b(or|and)\s+\d+\s*=\s*\d+/gi,
    /\bwaitfor\s+delay\b/gi,
    /\bbenchmark\s*\(/gi
  ];

  private pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\\/g,
    /%2e%2e%2f/gi,
    /%252e%252e%252f/gi,
    /\/etc\/passwd/gi,
    /\/proc\//gi,
    /c:\\windows\\/gi
  ];

  constructor() {
    this.logger = new Logger({ service: 'InputValidator' });
    this.initializeCommonSchemas();
  }

  /**
   * Initialize commonly used validation schemas
   */
  private initializeCommonSchemas(): void {
    // Email validation
    this.customSchemas.set('email', z.string().email().max(254));

    // URL validation
    this.customSchemas.set('url', z.string().url().max(2048));

    // Phone number validation
    this.customSchemas.set('phone', z.string().regex(/^\+?[1-9]\d{1,14}$/));

    // UUID validation
    this.customSchemas.set('uuid', z.string().uuid());

    // Slug validation (URL-safe strings)
    this.customSchemas.set('slug', z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

    // Password validation
    this.customSchemas.set('password', z.string().min(8).max(128).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
    ));

    // Semantic version validation
    this.customSchemas.set('semver', z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/));

    // Color hex validation
    this.customSchemas.set('color', z.string().regex(/^#[0-9A-F]{6}$/i));

    // Date string validation
    this.customSchemas.set('dateString', z.string().datetime());

    // IP address validation
    this.customSchemas.set('ip', z.string().ip());

    // JSON string validation
    this.customSchemas.set('json', z.string().refine((str) => {
      try {
        JSON.parse(str);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid JSON string'));

    // Base64 validation
    this.customSchemas.set('base64', z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/));

    // Alphanumeric validation
    this.customSchemas.set('alphanumeric', z.string().regex(/^[a-zA-Z0-9]+$/));

    // File path validation (safe paths only)
    this.customSchemas.set('safePath', z.string().regex(/^[a-zA-Z0-9._/-]+$/).refine((path) => {
      return !path.includes('..') && !path.startsWith('/') && !path.includes('//');
    }, 'Path contains unsafe characters or patterns'));
  }

  /**
   * Validate input against a schema
   */
  async validate<T>(
    input: unknown,
    schema: z.ZodSchema<T> | string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    try {
      const actualSchema = typeof schema === 'string' 
        ? this.customSchemas.get(schema) 
        : schema;

      if (!actualSchema) {
        return {
          valid: false,
          errors: [{
            path: '',
            code: 'SCHEMA_NOT_FOUND',
            message: `Schema '${schema}' not found`,
            received: input
          }],
          warnings: []
        };
      }

      // Apply preprocessing
      const preprocessed = await this.preprocessInput(input, options);
      
      // Security validation
      const securityResult = await this.validateSecurity(preprocessed);
      if (!securityResult.safe && options.strict !== false) {
        return {
          valid: false,
          errors: securityResult.issues.map(issue => ({
            path: '',
            code: issue.type.toUpperCase(),
            message: issue.message,
            received: issue.value
          })),
          warnings: []
        };
      }

      // Schema validation
      const result = await actualSchema.safeParseAsync(preprocessed);
      
      if (result.success) {
        const sanitized = options.sanitize ? this.sanitizeData(result.data) : result.data;
        
        return {
          valid: true,
          data: result.data,
          sanitized,
          errors: [],
          warnings: securityResult.issues
            .filter(issue => issue.severity === 'low')
            .map(issue => issue.message)
        };
      } else {
        const errors = this.formatZodErrors(result.error);
        return {
          valid: false,
          errors,
          warnings: []
        };
      }
    } catch (error) {
      await this.logger.error('Validation error', { error, input: typeof input });
      return {
        valid: false,
        errors: [{
          path: '',
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error occurred',
          received: input
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate multiple inputs in batch
   */
  async validateBatch<T>(
    inputs: Array<{ input: unknown; schema: z.ZodSchema<T> | string; options?: ValidationOptions }>
  ): Promise<ValidationResult<T>[]> {
    const results = await Promise.all(
      inputs.map(({ input, schema, options }) => this.validate(input, schema, options))
    );
    
    return results;
  }

  /**
   * Security-focused validation
   */
  async validateSecurity(input: unknown): Promise<SecurityValidationResult> {
    const issues: SecurityValidationResult['issues'] = [];
    
    if (typeof input === 'string') {
      // XSS detection
      for (const pattern of this.xssPatterns) {
        if (pattern.test(input)) {
          issues.push({
            type: 'xss',
            severity: 'high',
            message: 'Potential XSS attack detected',
            value: input.substring(0, 100)
          });
          break;
        }
      }

      // SQL injection detection
      for (const pattern of this.sqlPatterns) {
        if (pattern.test(input)) {
          issues.push({
            type: 'sql_injection',
            severity: 'high',
            message: 'Potential SQL injection detected',
            value: input.substring(0, 100)
          });
          break;
        }
      }

      // Path traversal detection
      for (const pattern of this.pathTraversalPatterns) {
        if (pattern.test(input)) {
          issues.push({
            type: 'path_traversal',
            severity: 'medium',
            message: 'Potential path traversal detected',
            value: input.substring(0, 100)
          });
          break;
        }
      }

      // Script injection detection
      if (/<script|<\/script>/gi.test(input)) {
        issues.push({
          type: 'script_injection',
          severity: 'critical',
          message: 'Script injection detected',
          value: input.substring(0, 100)
        });
      }

      // HTML injection detection
      if (/<[^>]+>/g.test(input) && !/^<(b|i|em|strong|p|br|hr)\/?>/.test(input)) {
        issues.push({
          type: 'html_injection',
          severity: 'medium',
          message: 'Potential HTML injection detected',
          value: input.substring(0, 100)
        });
      }
    } else if (typeof input === 'object' && input !== null) {
      // Recursively check object properties
      const jsonString = JSON.stringify(input);
      const securityResult = await this.validateSecurity(jsonString);
      issues.push(...securityResult.issues);
    }

    const safe = issues.length === 0 || issues.every(issue => issue.severity === 'low');
    
    return { safe, issues };
  }

  /**
   * Custom validation rules
   */
  createCustomValidator<T>(
    name: string,
    baseSchema: z.ZodSchema<T>,
    validator: (value: T) => boolean | Promise<boolean>,
    errorMessage: string
  ): void {
    const customSchema = baseSchema.refine(validator, errorMessage);
    this.customSchemas.set(name, customSchema);
  }

  /**
   * Conditional validation
   */
  createConditionalSchema<T>(
    condition: (input: any) => boolean,
    trueSchema: z.ZodSchema<T>,
    falseSchema: z.ZodSchema<T>
  ): z.ZodSchema<T> {
    return z.any().superRefine(async (val, ctx) => {
      const schema = condition(val) ? trueSchema : falseSchema;
      const result = await schema.safeParseAsync(val);
      
      if (!result.success) {
        result.error.issues.forEach(issue => {
          ctx.addIssue(issue);
        });
      }
    }) as z.ZodSchema<T>;
  }

  /**
   * Array validation with custom logic
   */
  validateArray<T>(
    itemSchema: z.ZodSchema<T>,
    options: {
      minItems?: number;
      maxItems?: number;
      uniqueBy?: keyof T;
      sortBy?: keyof T;
    } = {}
  ): z.ZodSchema<T[]> {
    let schema = z.array(itemSchema);

    if (options.minItems !== undefined) {
      schema = schema.min(options.minItems);
    }

    if (options.maxItems !== undefined) {
      schema = schema.max(options.maxItems);
    }

    if (options.uniqueBy) {
      schema = schema.refine((arr) => {
        const values = arr.map(item => item[options.uniqueBy!]);
        return values.length === new Set(values).size;
      }, `Array items must be unique by ${String(options.uniqueBy)}`);
    }

    return schema;
  }

  /**
   * Object schema validation with dynamic keys
   */
  validateDynamicObject<T>(
    keySchema: z.ZodSchema<string>,
    valueSchema: z.ZodSchema<T>
  ): z.ZodSchema<Record<string, T>> {
    return z.record(keySchema, valueSchema);
  }

  /**
   * File upload validation
   */
  createFileValidator(options: {
    allowedTypes?: string[];
    maxSizeBytes?: number;
    maxFiles?: number;
  } = {}): z.ZodSchema<any> {
    return z.object({
      name: z.string().min(1).max(255),
      size: z.number().positive().max(options.maxSizeBytes || 10 * 1024 * 1024), // 10MB default
      type: options.allowedTypes 
        ? z.string().refine(type => options.allowedTypes!.includes(type))
        : z.string(),
      content: z.string().base64()
    });
  }

  /**
   * Rate limiting validation
   */
  async validateRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remainingRequests: number }> {
    // This would integrate with your rate limiter
    // For now, this is a placeholder
    return { allowed: true, remainingRequests: maxRequests };
  }

  /**
   * Data preprocessing
   */
  private async preprocessInput(input: unknown, options: ValidationOptions): Promise<unknown> {
    if (typeof input === 'string') {
      // Trim whitespace
      input = input.trim();
      
      // Apply max length
      if (options.maxStringLength && input.length > options.maxStringLength) {
        input = input.substring(0, options.maxStringLength);
      }
    }

    if (Array.isArray(input)) {
      // Apply max array length
      if (options.maxArrayLength && input.length > options.maxArrayLength) {
        input = input.slice(0, options.maxArrayLength);
      }
    }

    if (typeof input === 'object' && input !== null) {
      // Apply max depth (simplified implementation)
      if (options.maxDepth) {
        input = this.limitObjectDepth(input, options.maxDepth);
      }
    }

    return input;
  }

  /**
   * Data sanitization
   */
  private sanitizeData<T>(data: T): T {
    if (typeof data === 'string') {
      return data
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;') as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item)) as T;
    }

    if (typeof data === 'object' && data !== null) {
      const result = {} as any;
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.sanitizeData(value);
      }
      return result;
    }

    return data;
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(zodError: z.ZodError): ValidationError[] {
    return zodError.issues.map(issue => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
      received: issue.received || 'unknown'
    }));
  }

  /**
   * Limit object depth to prevent prototype pollution
   */
  private limitObjectDepth(obj: any, maxDepth: number, currentDepth = 0): any {
    if (currentDepth >= maxDepth || typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.limitObjectDepth(item, maxDepth, currentDepth + 1));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      result[key] = this.limitObjectDepth(value, maxDepth, currentDepth + 1);
    }

    return result;
  }

  /**
   * Get available schemas
   */
  getAvailableSchemas(): string[] {
    return Array.from(this.customSchemas.keys());
  }

  /**
   * Add custom schema
   */
  addSchema<T>(name: string, schema: z.ZodSchema<T>): void {
    this.customSchemas.set(name, schema);
  }

  /**
   * Remove schema
   */
  removeSchema(name: string): boolean {
    return this.customSchemas.delete(name);
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    customSchemas: number;
    availableSchemas: string[];
  } {
    return {
      customSchemas: this.customSchemas.size,
      availableSchemas: this.getAvailableSchemas()
    };
  }
}

// Common validation schemas export
export const CommonSchemas = {
  // User input
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500),
  
  // Marketplace specific
  itemName: z.string().min(1).max(100),
  itemDescription: z.string().min(1).max(1000),
  itemVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  itemCategory: z.enum(['template', 'plugin', 'workflow', 'theme', 'other']),
  
  // Search and pagination
  searchQuery: z.string().max(200),
  pageSize: z.number().int().min(1).max(100).default(20),
  pageOffset: z.number().int().min(0).default(0),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // File operations
  fileName: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+$/),
  filePath: z.string().max(1000).regex(/^[a-zA-Z0-9._/-]+$/),
  
  // API common
  apiKey: z.string().length(32).regex(/^[a-zA-Z0-9]+$/),
  token: z.string().min(1).max(2048),
  
  // Numbers and IDs
  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
  rating: z.number().min(1).max(5),
  
  // Dates
  isoDate: z.string().datetime(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).refine(data => new Date(data.start) <= new Date(data.end), {
    message: 'Start date must be before or equal to end date'
  })
};