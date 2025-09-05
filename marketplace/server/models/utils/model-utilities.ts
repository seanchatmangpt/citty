import { z } from 'zod';
import {
  DimensionalUtils,
  VectorEmbedding,
  MultiDimensionalEntity,
  DimensionalQuery,
  DimensionalAttribute
} from '../base/dimensional-schema.js';

/**
 * Model Validation and Transformation Utilities
 * Comprehensive utilities for n-dimensional marketplace models
 */

// Validation result interface
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    code: z.string(),
    message: z.string(),
    value: z.any().optional()
  })).default([]),
  warnings: z.array(z.object({
    field: z.string(),
    code: z.string(),
    message: z.string(),
    value: z.any().optional()
  })).default([]),
  metadata: z.record(z.any()).optional()
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Transformation configuration
export const TransformationConfigSchema = z.object({
  target: z.enum(['create', 'update', 'response', 'storage', 'search']),
  options: z.object({
    includePrivateFields: z.boolean().default(false),
    computeDerivedFields: z.boolean().default(true),
    validateConstraints: z.boolean().default(true),
    normalizeValues: z.boolean().default(true),
    enrichData: z.boolean().default(false)
  }).default({
    includePrivateFields: false,
    computeDerivedFields: true,
    validateConstraints: true,
    normalizeValues: true,
    enrichData: false
  })
});

export type TransformationConfig = z.infer<typeof TransformationConfigSchema>;

// Model transformation utilities
export class ModelTransformationUtils {
  /**
   * Transform model for API response
   */
  static transformForResponse<T>(
    data: T,
    config: TransformationConfig = { target: 'response', options: {} }
  ): T {
    if (!data || typeof data !== 'object') return data;
    
    const transformed = JSON.parse(JSON.stringify(data)); // Deep clone
    
    if (!config.options.includePrivateFields) {
      this.removePrivateFields(transformed);
    }
    
    if (config.options.computeDerivedFields) {
      this.computeDerivedFields(transformed);
    }
    
    if (config.options.normalizeValues) {
      this.normalizeValues(transformed);
    }
    
    return transformed;
  }
  
  /**
   * Transform model for storage
   */
  static transformForStorage<T>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    
    const transformed = JSON.parse(JSON.stringify(data));
    
    // Add timestamps if missing
    const now = new Date().toISOString();
    if ('createdAt' in transformed && !transformed.createdAt) {
      transformed.createdAt = now;
    }
    if ('updatedAt' in transformed) {
      transformed.updatedAt = now;
    }
    
    // Generate IDs if missing
    if ('id' in transformed && !transformed.id) {
      transformed.id = this.generateId();
    }
    
    // Normalize nested structures
    this.normalizeNestedStructures(transformed);
    
    return transformed;
  }
  
  /**
   * Remove private/sensitive fields
   */
  private static removePrivateFields(obj: any): void {
    const privateFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    const privatePatterns = [/password/i, /secret/i, /token/i, /key$/i];
    
    if (Array.isArray(obj)) {
      obj.forEach(item => this.removePrivateFields(item));
      return;
    }
    
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (privateFields.includes(key) || privatePatterns.some(pattern => pattern.test(key))) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          this.removePrivateFields(obj[key]);
        }
      });
    }
  }
  
  /**
   * Compute derived fields
   */
  private static computeDerivedFields(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    // Compute age from birthDate
    if (obj.birthDate && !obj.age) {
      const birthDate = new Date(obj.birthDate);
      const now = new Date();
      obj.age = Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    
    // Compute full name from first and last name
    if (obj.firstName && obj.lastName && !obj.fullName) {
      obj.fullName = `${obj.firstName} ${obj.lastName}`.trim();
    }
    
    // Compute dimensional scores
    if (obj.dimensions && Array.isArray(obj.dimensions)) {
      obj.dimensionalScore = DimensionalUtils.calculateDimensionalScore(obj.dimensions);
    }
    
    // Recursively process nested objects
    Object.values(obj).forEach(value => {
      if (typeof value === 'object') {
        this.computeDerivedFields(value);
      }
    });
  }
  
  /**
   * Normalize values (trim strings, convert types, etc.)
   */
  private static normalizeValues(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      if (typeof value === 'string') {
        obj[key] = value.trim();
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => this.normalizeValues(item));
        } else {
          this.normalizeValues(value);
        }
      }
    });
  }
  
  /**
   * Normalize nested structures
   */
  private static normalizeNestedStructures(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    // Ensure arrays are properly initialized
    const arrayFields = ['dimensions', 'tags', 'categories', 'permissions', 'media'];
    arrayFields.forEach(field => {
      if (field in obj && !Array.isArray(obj[field])) {
        obj[field] = obj[field] ? [obj[field]] : [];
      }
    });
    
    // Recursively process nested objects
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        this.normalizeNestedStructures(value);
      }
    });
  }
  
  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Vector embedding utilities
export class VectorEmbeddingUtils {
  /**
   * Generate text embedding (mock implementation - replace with actual ML service)
   */
  static async generateTextEmbedding(text: string): Promise<VectorEmbedding> {
    // This is a mock implementation. In production, use a real embedding service
    const dimensions = 768;
    const values = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    
    return {
      dimensions,
      values: DimensionalUtils.normalizeVector(values),
      model: 'mock-text-embedding-v1',
      metadata: {
        textLength: text.length,
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * Find similar vectors using cosine similarity
   */
  static findSimilarVectors(
    queryVector: number[],
    candidateVectors: Array<{ id: string; vector: number[]; metadata?: any }>,
    threshold: number = 0.7,
    limit: number = 10
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    return candidateVectors
      .map(candidate => ({
        id: candidate.id,
        similarity: DimensionalUtils.cosineSimilarity(queryVector, candidate.vector),
        metadata: candidate.metadata
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Combine multiple embeddings (average)
   */
  static combineEmbeddings(embeddings: VectorEmbedding[]): VectorEmbedding {
    if (embeddings.length === 0) {
      throw new Error('Cannot combine empty embeddings array');
    }
    
    const dimensions = embeddings[0].dimensions;
    if (!embeddings.every(emb => emb.dimensions === dimensions)) {
      throw new Error('All embeddings must have the same dimensions');
    }
    
    const combinedValues = new Array(dimensions).fill(0);
    
    embeddings.forEach(embedding => {
      embedding.values.forEach((value, index) => {
        combinedValues[index] += value / embeddings.length;
      });
    });
    
    return {
      dimensions,
      values: DimensionalUtils.normalizeVector(combinedValues),
      model: 'combined',
      metadata: {
        sourceCount: embeddings.length,
        sourceModels: [...new Set(embeddings.map(e => e.model).filter(Boolean))]
      }
    };
  }
}

// Dimensional query utilities
export class DimensionalQueryUtils {
  /**
   * Build complex dimensional query
   */
  static buildQuery(filters: Record<string, any>): DimensionalQuery {
    const query: DimensionalQuery = {
      limit: 50,
      offset: 0
    };
    
    // Spatial filtering
    if (filters.location && filters.radius) {
      query.spatialQuery = {
        center: filters.location,
        radius: filters.radius,
        unit: filters.unit || 'km'
      };
    }
    
    // Temporal filtering
    if (filters.dateFrom || filters.dateTo) {
      query.temporalQuery = {
        from: filters.dateFrom,
        to: filters.dateTo,
        granularity: filters.granularity || 'day'
      };
    }
    
    // Vector similarity search
    if (filters.embedding) {
      query.vectorQuery = {
        embedding: filters.embedding,
        similarity: filters.similarity || 'cosine',
        threshold: filters.threshold || 0.7,
        k: filters.k || 10
      };
    }
    
    // Dimensional filters
    if (filters.dimensions) {
      query.dimensions = Object.entries(filters.dimensions).map(([type, filterConfig]) => ({
        type: type as any,
        filters: filterConfig as Record<string, any>
      }));
    }
    
    // Pagination
    if (filters.limit) query.limit = filters.limit;
    if (filters.offset) query.offset = filters.offset;
    
    return query;
  }
  
  /**
   * Validate dimensional query
   */
  static validateQuery(query: DimensionalQuery): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    
    // Validate spatial query
    if (query.spatialQuery) {
      if (!query.spatialQuery.center.x || !query.spatialQuery.center.y) {
        errors.push({
          field: 'spatialQuery.center',
          code: 'INVALID_COORDINATES',
          message: 'Spatial query requires valid coordinates'
        });
      }
      
      if (query.spatialQuery.radius <= 0) {
        errors.push({
          field: 'spatialQuery.radius',
          code: 'INVALID_RADIUS',
          message: 'Radius must be positive'
        });
      }
      
      if (query.spatialQuery.radius > 10000) {
        warnings.push({
          field: 'spatialQuery.radius',
          code: 'LARGE_RADIUS',
          message: 'Large radius may impact performance'
        });
      }
    }
    
    // Validate vector query
    if (query.vectorQuery) {
      if (!query.vectorQuery.embedding || query.vectorQuery.embedding.length === 0) {
        errors.push({
          field: 'vectorQuery.embedding',
          code: 'EMPTY_EMBEDDING',
          message: 'Vector query requires embedding values'
        });
      }
      
      if (query.vectorQuery.k && query.vectorQuery.k > 1000) {
        warnings.push({
          field: 'vectorQuery.k',
          code: 'LARGE_K',
          message: 'Large k value may impact performance'
        });
      }
    }
    
    // Validate pagination
    if (query.limit > 1000) {
      warnings.push({
        field: 'limit',
        code: 'LARGE_LIMIT',
        message: 'Large limit may impact performance'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Data validation utilities
export class DataValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }
  
  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Validate coordinate values
   */
  static isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
  
  /**
   * Validate credit card number using Luhn algorithm
   */
  static isValidCreditCard(cardNumber: string): boolean {
    const num = cardNumber.replace(/\D/g, '');
    if (num.length < 13 || num.length > 19) return false;
    
    let sum = 0;
    let shouldDouble = false;
    
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num.charAt(i), 10);
      
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    
    return sum % 10 === 0;
  }
  
  /**
   * Validate business logic constraints
   */
  static validateBusinessConstraints(data: any, constraints: Record<string, any>): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    
    Object.entries(constraints).forEach(([field, constraint]) => {
      const value = this.getNestedValue(data, field);
      
      if (constraint.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          code: 'REQUIRED_FIELD',
          message: `${field} is required`,
          value
        });
      }
      
      if (constraint.type && value !== undefined && typeof value !== constraint.type) {
        errors.push({
          field,
          code: 'INVALID_TYPE',
          message: `${field} must be of type ${constraint.type}`,
          value
        });
      }
      
      if (constraint.min && typeof value === 'number' && value < constraint.min) {
        errors.push({
          field,
          code: 'MIN_VALUE',
          message: `${field} must be at least ${constraint.min}`,
          value
        });
      }
      
      if (constraint.max && typeof value === 'number' && value > constraint.max) {
        errors.push({
          field,
          code: 'MAX_VALUE',
          message: `${field} must be at most ${constraint.max}`,
          value
        });
      }
      
      if (constraint.pattern && typeof value === 'string' && !new RegExp(constraint.pattern).test(value)) {
        errors.push({
          field,
          code: 'PATTERN_MISMATCH',
          message: `${field} does not match required pattern`,
          value
        });
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
  
  /**
   * Get nested object value by path
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Caching utilities for performance optimization
export class CacheUtils {
  private static cache = new Map<string, { value: any; expiry: number }>();
  
  /**
   * Set cache value with TTL
   */
  static set(key: string, value: any, ttlMs: number = 300000): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }
  
  /**
   * Get cache value if not expired
   */
  static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  /**
   * Clear expired cache entries
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cache
   */
  static clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  static getStats(): { size: number; expired: number } {
    const now = Date.now();
    let expired = 0;
    
    for (const item of this.cache.values()) {
      if (now > item.expiry) expired++;
    }
    
    return {
      size: this.cache.size,
      expired
    };
  }
}

export default {
  ModelTransformationUtils,
  VectorEmbeddingUtils,
  DimensionalQueryUtils,
  DataValidationUtils,
  CacheUtils,
  ValidationResultSchema,
  TransformationConfigSchema
};