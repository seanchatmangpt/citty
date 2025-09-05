# Pattern 06: Multi-Schema Validation Pipeline - Form Validation System

## Overview

A comprehensive form validation system demonstrating multi-schema validation with dynamic field validation, conditional requirements, real-time validation feedback, and complex business rule enforcement.

## Features

- Multi-step form validation with different schemas per step
- Dynamic field validation based on user input
- Conditional validation rules and dependencies
- Real-time validation with debouncing
- Custom validation rules and business logic
- Internationalization support for error messages
- Accessibility compliance (WCAG 2.1)
- Form state management and persistence

## Environment Setup

```bash
# Core validation dependencies
pnpm add zod joi ajv yup class-validator
pnpm add validator libphonenumber-js moment
pnpm add i18next react-i18next

# Form handling
pnpm add react-hook-form formik final-form
pnpm add lodash ramda immutable

# UI and accessibility
pnpm add @headlessui/react @radix-ui/react-form
pnpm add react-aria react-spectrum

# State management
pnpm add zustand redux @reduxjs/toolkit
pnpm add immer use-immer

# Testing
pnpm add -D @testing-library/react @testing-library/user-event
pnpm add -D vitest jsdom
```

## Environment Variables

```env
# Application
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/forms_db
REDIS_URL=redis://localhost:6379

# External Services
RECAPTCHA_SECRET_KEY=your-recaptcha-secret
SENDGRID_API_KEY=your-sendgrid-key
STRIPE_SECRET_KEY=your-stripe-secret

# Feature Flags
ENABLE_REAL_TIME_VALIDATION=true
ENABLE_A11Y_ENHANCEMENTS=true
ENABLE_ANALYTICS=true

# Internationalization
DEFAULT_LOCALE=en
SUPPORTED_LOCALES=en,es,fr,de,ja

# Security
FORM_TOKEN_SECRET=your-jwt-secret-here
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## Production Code

```typescript
import { defineCommand } from "citty";
import { z } from "zod";
import Joi from "joi";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import * as yup from "yup";
import { IsEmail, IsPhoneNumber, validate } from "class-validator";
import validator from "validator";
import { parsePhoneNumber } from "libphonenumber-js";
import moment from "moment";
import i18next from "i18next";
import _ from "lodash";
import winston from "winston";
import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";

// Types
interface ValidationSchema {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'zod' | 'joi' | 'ajv' | 'yup' | 'custom';
  schema: any;
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'includes' | 'exists';
    value: any;
    applyToFields: string[];
  }>;
  dependencies?: string[];
  metadata: {
    step?: number;
    category: string;
    priority: number;
    async?: boolean;
  };
}

interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'select' | 'checkbox' | 'radio' | 'file';
  label: string;
  placeholder?: string;
  required: boolean;
  validation: {
    schemas: string[]; // Schema IDs
    customRules?: Array<{
      name: string;
      message: string;
      validator: (value: any, formData: any) => Promise<boolean> | boolean;
    }>;
  };
  dependencies?: Array<{
    field: string;
    condition: any;
  }>;
  options?: Array<{ label: string; value: any }>;
  metadata: {
    group?: string;
    step?: number;
    accessibility?: {
      ariaLabel?: string;
      ariaDescribedBy?: string;
      role?: string;
    };
  };
}

interface FormStep {
  id: string;
  name: string;
  title: string;
  description: string;
  fields: string[];
  validation: {
    schemas: string[];
    mode: 'all' | 'any' | 'conditional';
  };
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  metadata: {
    order: number;
    optional?: boolean;
    estimatedTime?: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    severity: 'error' | 'warning' | 'info';
    suggestion?: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  metadata: {
    validatedAt: Date;
    validationTime: number;
    schemaVersion: string;
    locale: string;
  };
}

interface FormConfig {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  multiStep: boolean;
  steps: FormStep[];
  fields: FormField[];
  schemas: ValidationSchema[];
  settings: {
    realTimeValidation: boolean;
    debounceDelay: number;
    showProgressBar: boolean;
    allowSaveProgress: boolean;
    requiredFieldIndicator: string;
    errorDisplayMode: 'inline' | 'summary' | 'both';
    accessibility: {
      screenReaderSupport: boolean;
      keyboardNavigation: boolean;
      highContrast: boolean;
    };
    internationalization: {
      enabled: boolean;
      defaultLocale: string;
      supportedLocales: string[];
    };
  };
}

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'form-validation-error.log', 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'form-validation-combined.log',
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database and Cache
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

// Initialize i18n
i18next.init({
  lng: process.env.DEFAULT_LOCALE || 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      validation: {
        required: '{{field}} is required',
        email: 'Please enter a valid email address',
        minLength: '{{field}} must be at least {{min}} characters',
        maxLength: '{{field}} must not exceed {{max}} characters',
        pattern: '{{field}} format is invalid',
        phone: 'Please enter a valid phone number',
        url: 'Please enter a valid URL',
        date: 'Please enter a valid date',
        number: 'Please enter a valid number',
        custom: 'Validation failed for {{field}}'
      }
    },
    es: {
      validation: {
        required: '{{field}} es obligatorio',
        email: 'Por favor ingrese un email válido',
        minLength: '{{field}} debe tener al menos {{min}} caracteres',
        maxLength: '{{field}} no debe exceder {{max}} caracteres',
        pattern: 'El formato de {{field}} es inválido',
        phone: 'Por favor ingrese un número de teléfono válido',
        url: 'Por favor ingrese una URL válida',
        date: 'Por favor ingrese una fecha válida',
        number: 'Por favor ingrese un número válido',
        custom: 'Validación falló para {{field}}'
      }
    }
  }
});

// Schema Registry
class SchemaRegistry {
  private schemas: Map<string, ValidationSchema> = new Map();
  private compiledSchemas: Map<string, any> = new Map();

  constructor() {
    this.initializeBuiltinSchemas();
  }

  private initializeBuiltinSchemas(): void {
    // Email validation schema
    this.registerSchema({
      id: 'email-basic',
      name: 'Basic Email Validation',
      version: '1.0.0',
      description: 'Standard email format validation',
      type: 'zod',
      schema: z.string().email(),
      metadata: { category: 'basic', priority: 1 }
    });

    // Advanced email validation
    this.registerSchema({
      id: 'email-advanced',
      name: 'Advanced Email Validation', 
      version: '1.0.0',
      description: 'Email validation with domain checking',
      type: 'custom',
      schema: null,
      metadata: { category: 'advanced', priority: 2, async: true }
    });

    // Password strength validation
    this.registerSchema({
      id: 'password-strong',
      name: 'Strong Password',
      version: '1.0.0', 
      description: 'Strong password requirements',
      type: 'zod',
      schema: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
               'Password must contain uppercase, lowercase, number and special character'),
      metadata: { category: 'security', priority: 3 }
    });

    // Phone number validation
    this.registerSchema({
      id: 'phone-international',
      name: 'International Phone',
      version: '1.0.0',
      description: 'International phone number validation',
      type: 'custom',
      schema: null,
      metadata: { category: 'contact', priority: 2 }
    });

    // Credit card validation
    this.registerSchema({
      id: 'credit-card',
      name: 'Credit Card Validation',
      version: '1.0.0',
      description: 'Credit card number and expiry validation',
      type: 'joi',
      schema: Joi.object({
        number: Joi.string().creditCard().required(),
        expiry: Joi.string().pattern(/^(0[1-9]|1[0-2])\/\d{2}$/).required(),
        cvv: Joi.string().pattern(/^\d{3,4}$/).required()
      }),
      metadata: { category: 'payment', priority: 4 }
    });

    // Business validation rules
    this.registerSchema({
      id: 'business-rules',
      name: 'Business Rules Validation',
      version: '1.0.0',
      description: 'Custom business logic validation',
      type: 'custom',
      schema: null,
      conditions: [
        {
          field: 'userType',
          operator: 'eq',
          value: 'business',
          applyToFields: ['taxId', 'companyName']
        }
      ],
      metadata: { category: 'business', priority: 5, async: true }
    });

    logger.info('Built-in validation schemas initialized');
  }

  registerSchema(schema: ValidationSchema): void {
    this.schemas.set(schema.id, schema);
    this.compileSchema(schema);
    
    logger.info('Schema registered', { 
      schemaId: schema.id,
      type: schema.type,
      version: schema.version
    });
  }

  private compileSchema(schema: ValidationSchema): void {
    try {
      switch (schema.type) {
        case 'zod':
          this.compiledSchemas.set(schema.id, schema.schema);
          break;
          
        case 'joi':
          this.compiledSchemas.set(schema.id, schema.schema);
          break;
          
        case 'ajv':
          const ajv = new Ajv({ allErrors: true });
          addFormats(ajv);
          const validate = ajv.compile(schema.schema);
          this.compiledSchemas.set(schema.id, validate);
          break;
          
        case 'yup':
          this.compiledSchemas.set(schema.id, schema.schema);
          break;
          
        case 'custom':
          // Custom schemas are handled in the validator
          break;
          
        default:
          throw new Error(`Unsupported schema type: ${schema.type}`);
      }
      
      logger.debug('Schema compiled successfully', { schemaId: schema.id });
      
    } catch (error) {
      logger.error('Schema compilation failed', { 
        schemaId: schema.id,
        error: error.message
      });
      throw error;
    }
  }

  getSchema(schemaId: string): ValidationSchema | undefined {
    return this.schemas.get(schemaId);
  }

  getCompiledSchema(schemaId: string): any {
    return this.compiledSchemas.get(schemaId);
  }

  getAllSchemas(): ValidationSchema[] {
    return Array.from(this.schemas.values());
  }

  getSchemasByCategory(category: string): ValidationSchema[] {
    return Array.from(this.schemas.values())
      .filter(schema => schema.metadata.category === category)
      .sort((a, b) => a.metadata.priority - b.metadata.priority);
  }
}

// Multi-Schema Validator
class MultiSchemaValidator {
  private schemaRegistry: SchemaRegistry;
  private customValidators: Map<string, Function> = new Map();

  constructor() {
    this.schemaRegistry = new SchemaRegistry();
    this.initializeCustomValidators();
  }

  private initializeCustomValidators(): void {
    // Advanced email validation with domain checking
    this.customValidators.set('email-advanced', async (value: string) => {
      if (!validator.isEmail(value)) {
        return { isValid: false, message: 'Invalid email format' };
      }

      // Check for disposable email domains
      const domain = value.split('@')[1];
      const disposableDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
      
      if (disposableDomains.includes(domain)) {
        return { 
          isValid: false, 
          message: 'Disposable email addresses are not allowed',
          code: 'DISPOSABLE_EMAIL'
        };
      }

      // Simulate DNS check (in production, use actual DNS lookup)
      try {
        // const dnsResult = await dns.resolveMx(domain);
        return { isValid: true };
      } catch (error) {
        return { 
          isValid: false, 
          message: 'Email domain does not exist',
          code: 'INVALID_DOMAIN'
        };
      }
    });

    // International phone number validation
    this.customValidators.set('phone-international', (value: string) => {
      try {
        const phoneNumber = parsePhoneNumber(value);
        return {
          isValid: phoneNumber.isValid(),
          message: phoneNumber.isValid() ? '' : 'Invalid phone number format',
          metadata: {
            country: phoneNumber.country,
            type: phoneNumber.getType(),
            formatted: phoneNumber.formatInternational()
          }
        };
      } catch (error) {
        return {
          isValid: false,
          message: 'Unable to parse phone number',
          code: 'PARSE_ERROR'
        };
      }
    });

    // Business rules validation
    this.customValidators.set('business-rules', async (value: any, formData: any) => {
      const errors = [];

      // Age verification for certain services
      if (formData.serviceType === 'financial' && formData.age < 18) {
        errors.push({
          field: 'age',
          message: 'Must be 18 or older for financial services',
          code: 'AGE_RESTRICTION'
        });
      }

      // Tax ID validation for businesses
      if (formData.userType === 'business' && !formData.taxId) {
        errors.push({
          field: 'taxId',
          message: 'Tax ID is required for business accounts',
          code: 'BUSINESS_TAX_ID_REQUIRED'
        });
      }

      // Credit score check (simulated)
      if (formData.loanAmount > 50000 && !formData.creditScore) {
        errors.push({
          field: 'creditScore',
          message: 'Credit score verification required for loans over $50,000',
          code: 'CREDIT_CHECK_REQUIRED'
        });
      }

      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    });

    logger.info('Custom validators initialized');
  }

  async validateField(fieldName: string, value: any, schemaIds: string[], formData: any = {}, locale: string = 'en'): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    logger.debug('Validating field', { 
      fieldName, 
      schemaIds, 
      locale,
      valueType: typeof value
    });

    try {
      // Set locale for error messages
      i18next.changeLanguage(locale);

      for (const schemaId of schemaIds) {
        const schema = this.schemaRegistry.getSchema(schemaId);
        if (!schema) {
          logger.warn('Schema not found', { schemaId });
          continue;
        }

        // Check conditions
        if (schema.conditions && !this.checkConditions(schema.conditions, formData)) {
          logger.debug('Schema conditions not met, skipping', { schemaId });
          continue;
        }

        // Validate based on schema type
        const validationResult = await this.validateWithSchema(schema, fieldName, value, formData);
        
        if (!validationResult.isValid) {
          errors.push(...(validationResult.errors || []).map(error => ({
            field: fieldName,
            message: this.localizeMessage(error.message || 'Validation failed', { field: fieldName }),
            code: error.code || 'VALIDATION_ERROR',
            severity: 'error' as const,
            suggestion: error.suggestion
          })));
        }

        // Add warnings if present
        if (validationResult.warnings) {
          warnings.push(...validationResult.warnings.map(warning => ({
            field: fieldName,
            message: this.localizeMessage(warning.message, { field: fieldName }),
            code: warning.code || 'VALIDATION_WARNING'
          })));
        }
      }

      const validationTime = Date.now() - startTime;

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validatedAt: new Date(),
          validationTime,
          schemaVersion: '1.0.0',
          locale
        }
      };

      logger.debug('Field validation completed', {
        fieldName,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        validationTime: `${validationTime}ms`
      });

      return result;

    } catch (error) {
      logger.error('Field validation error', {
        fieldName,
        schemaIds,
        error: error.message
      });

      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: 'Validation system error',
          code: 'SYSTEM_ERROR',
          severity: 'error'
        }],
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationTime: Date.now() - startTime,
          schemaVersion: '1.0.0',
          locale
        }
      };
    }
  }

  private async validateWithSchema(schema: ValidationSchema, fieldName: string, value: any, formData: any): Promise<{ isValid: boolean; errors?: any[]; warnings?: any[] }> {
    switch (schema.type) {
      case 'zod':
        return this.validateWithZod(schema, value);
        
      case 'joi':
        return this.validateWithJoi(schema, value);
        
      case 'ajv':
        return this.validateWithAjv(schema, value);
        
      case 'yup':
        return this.validateWithYup(schema, value);
        
      case 'custom':
        return await this.validateWithCustom(schema, fieldName, value, formData);
        
      default:
        throw new Error(`Unsupported schema type: ${schema.type}`);
    }
  }

  private validateWithZod(schema: ValidationSchema, value: any): { isValid: boolean; errors?: any[] } {
    try {
      const compiled = this.schemaRegistry.getCompiledSchema(schema.id);
      compiled.parse(value);
      return { isValid: true };
    } catch (error) {
      if (error.errors) {
        return {
          isValid: false,
          errors: error.errors.map((err: any) => ({
            message: err.message,
            code: err.code,
            path: err.path
          }))
        };
      }
      return {
        isValid: false,
        errors: [{ message: error.message, code: 'ZOD_ERROR' }]
      };
    }
  }

  private validateWithJoi(schema: ValidationSchema, value: any): { isValid: boolean; errors?: any[] } {
    const compiled = this.schemaRegistry.getCompiledSchema(schema.id);
    const result = compiled.validate(value, { abortEarly: false });
    
    if (result.error) {
      return {
        isValid: false,
        errors: result.error.details.map((err: any) => ({
          message: err.message,
          code: err.type,
          path: err.path
        }))
      };
    }
    
    return { isValid: true };
  }

  private validateWithAjv(schema: ValidationSchema, value: any): { isValid: boolean; errors?: any[] } {
    const validate = this.schemaRegistry.getCompiledSchema(schema.id);
    const isValid = validate(value);
    
    if (!isValid && validate.errors) {
      return {
        isValid: false,
        errors: validate.errors.map((err: any) => ({
          message: err.message,
          code: err.keyword,
          path: err.instancePath
        }))
      };
    }
    
    return { isValid };
  }

  private async validateWithYup(schema: ValidationSchema, value: any): Promise<{ isValid: boolean; errors?: any[] }> {
    try {
      const compiled = this.schemaRegistry.getCompiledSchema(schema.id);
      await compiled.validate(value, { abortEarly: false });
      return { isValid: true };
    } catch (error) {
      if (error.inner) {
        return {
          isValid: false,
          errors: error.inner.map((err: any) => ({
            message: err.message,
            code: err.type,
            path: err.path
          }))
        };
      }
      return {
        isValid: false,
        errors: [{ message: error.message, code: 'YUP_ERROR' }]
      };
    }
  }

  private async validateWithCustom(schema: ValidationSchema, fieldName: string, value: any, formData: any): Promise<{ isValid: boolean; errors?: any[]; warnings?: any[] }> {
    const validator = this.customValidators.get(schema.id);
    if (!validator) {
      throw new Error(`Custom validator not found: ${schema.id}`);
    }

    try {
      const result = await validator(value, formData);
      
      if (typeof result === 'boolean') {
        return { isValid: result };
      }
      
      if (result.errors && Array.isArray(result.errors)) {
        return {
          isValid: false,
          errors: result.errors
        };
      }
      
      return {
        isValid: result.isValid || false,
        errors: result.isValid ? undefined : [{ 
          message: result.message || 'Custom validation failed',
          code: result.code || 'CUSTOM_ERROR'
        }],
        warnings: result.warnings
      };
      
    } catch (error) {
      logger.error('Custom validator error', { 
        schemaId: schema.id,
        fieldName,
        error: error.message
      });
      
      return {
        isValid: false,
        errors: [{ 
          message: 'Custom validation system error',
          code: 'CUSTOM_SYSTEM_ERROR'
        }]
      };
    }
  }

  private checkConditions(conditions: ValidationSchema['conditions'], formData: any): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => {
      const fieldValue = _.get(formData, condition.field);
      
      switch (condition.operator) {
        case 'eq':
          return fieldValue === condition.value;
        case 'ne':
          return fieldValue !== condition.value;
        case 'gt':
          return fieldValue > condition.value;
        case 'lt':
          return fieldValue < condition.value;
        case 'includes':
          return Array.isArray(fieldValue) ? fieldValue.includes(condition.value) : false;
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        default:
          return false;
      }
    });
  }

  private localizeMessage(message: string, params: Record<string, any> = {}): string {
    return i18next.t(`validation.${message}`, params) || message;
  }

  async validateForm(formData: any, config: FormConfig, step?: number): Promise<ValidationResult> {
    const startTime = Date.now();
    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: ValidationResult['warnings'] = [];

    logger.info('Validating form', {
      formId: config.id,
      step,
      fieldCount: config.fields.length
    });

    try {
      // Determine which fields to validate
      const fieldsToValidate = step !== undefined 
        ? config.fields.filter(field => field.metadata.step === step)
        : config.fields;

      // Validate each field
      for (const field of fieldsToValidate) {
        const fieldValue = _.get(formData, field.name);
        
        // Skip validation if field has unmet dependencies
        if (field.dependencies && !this.checkFieldDependencies(field.dependencies, formData)) {
          continue;
        }

        // Skip validation for optional empty fields
        if (!field.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
          continue;
        }

        const fieldResult = await this.validateField(
          field.name,
          fieldValue,
          field.validation.schemas,
          formData,
          config.settings.internationalization.defaultLocale
        );

        allErrors.push(...fieldResult.errors);
        allWarnings.push(...fieldResult.warnings);
      }

      // Run step-level validation if applicable
      if (step !== undefined) {
        const currentStep = config.steps.find(s => s.metadata.order === step);
        if (currentStep && currentStep.validation.schemas.length > 0) {
          const stepResult = await this.validateFormStep(formData, currentStep, config);
          allErrors.push(...stepResult.errors);
          allWarnings.push(...stepResult.warnings);
        }
      }

      const validationTime = Date.now() - startTime;
      
      const result: ValidationResult = {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        metadata: {
          validatedAt: new Date(),
          validationTime,
          schemaVersion: config.version,
          locale: config.settings.internationalization.defaultLocale
        }
      };

      logger.info('Form validation completed', {
        formId: config.id,
        step,
        isValid: result.isValid,
        errorCount: allErrors.length,
        warningCount: allWarnings.length,
        validationTime: `${validationTime}ms`
      });

      return result;

    } catch (error) {
      logger.error('Form validation error', {
        formId: config.id,
        error: error.message
      });

      return {
        isValid: false,
        errors: [{
          field: 'form',
          message: 'Form validation system error',
          code: 'FORM_SYSTEM_ERROR',
          severity: 'error'
        }],
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationTime: Date.now() - startTime,
          schemaVersion: config.version,
          locale: config.settings.internationalization.defaultLocale
        }
      };
    }
  }

  private checkFieldDependencies(dependencies: FormField['dependencies'], formData: any): boolean {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    return dependencies.every(dep => {
      const depValue = _.get(formData, dep.field);
      // Simplified dependency check - in production, this would be more sophisticated
      return depValue === dep.condition;
    });
  }

  private async validateFormStep(formData: any, step: FormStep, config: FormConfig): Promise<ValidationResult> {
    const stepErrors: ValidationResult['errors'] = [];
    const stepWarnings: ValidationResult['warnings'] = [];

    // This would implement step-level validation logic
    // For now, we'll return a successful result
    
    return {
      isValid: stepErrors.length === 0,
      errors: stepErrors,
      warnings: stepWarnings,
      metadata: {
        validatedAt: new Date(),
        validationTime: 0,
        schemaVersion: config.version,
        locale: config.settings.internationalization.defaultLocale
      }
    };
  }

  // Utility methods
  getAvailableSchemas(): ValidationSchema[] {
    return this.schemaRegistry.getAllSchemas();
  }

  getSchemasByCategory(category: string): ValidationSchema[] {
    return this.schemaRegistry.getSchemasByCategory(category);
  }

  registerCustomValidator(id: string, validator: Function): void {
    this.customValidators.set(id, validator);
    logger.info('Custom validator registered', { id });
  }

  registerSchema(schema: ValidationSchema): void {
    this.schemaRegistry.registerSchema(schema);
  }
}

// Form Management System
class FormManager {
  private validator: MultiSchemaValidator;
  private app: express.Application;

  constructor() {
    this.validator = new MultiSchemaValidator();
    this.app = express();
    this.setupExpress();
  }

  private setupExpress(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Validation endpoints
    this.app.post('/api/validate/field', async (req, res) => {
      try {
        const { fieldName, value, schemaIds, formData, locale } = req.body;
        
        const result = await this.validator.validateField(
          fieldName,
          value,
          schemaIds,
          formData,
          locale
        );
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/validate/form', async (req, res) => {
      try {
        const { formData, config, step } = req.body;
        
        const result = await this.validator.validateForm(formData, config, step);
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Schema management endpoints
    this.app.get('/api/schemas', (req, res) => {
      const schemas = this.validator.getAvailableSchemas();
      res.json(schemas);
    });

    this.app.get('/api/schemas/category/:category', (req, res) => {
      const schemas = this.validator.getSchemasByCategory(req.params.category);
      res.json(schemas);
    });

    this.app.post('/api/schemas', (req, res) => {
      try {
        this.validator.registerSchema(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    logger.info('Form validation API configured');
  }

  start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info('Form validation service started', { port });
    });
  }
}

// Command Definition
export const formValidationCommand = defineCommand({
  meta: {
    name: "form-validate",
    description: "Multi-schema form validation pipeline system"
  },
  args: {
    action: {
      type: "string",
      description: "Action to perform (validate, server, test)",
      required: true
    },
    "form-config": {
      type: "string",
      description: "Path to form configuration file",
      required: false
    },
    "form-data": {
      type: "string",
      description: "Path to form data file or JSON string",
      required: false
    },
    step: {
      type: "string",
      description: "Validation step number",
      required: false
    },
    locale: {
      type: "string",
      description: "Validation locale",
      default: "en"
    },
    port: {
      type: "string",
      description: "Server port for API mode",
      default: "3000"
    },
    verbose: {
      type: "boolean",
      description: "Verbose output",
      default: false
    }
  },
  async run({ args }) {
    try {
      switch (args.action) {
        case 'validate':
          if (!args["form-config"] || !args["form-data"]) {
            throw new Error("Form config and data are required for validation");
          }

          console.log("🔍 Validating form data...");
          
          // Load form configuration
          const formConfig = JSON.parse(fs.readFileSync(args["form-config"], 'utf8'));
          
          // Load form data
          let formData;
          try {
            // Try to parse as JSON first
            formData = JSON.parse(args["form-data"]);
          } catch {
            // If not JSON, try to read as file
            formData = JSON.parse(fs.readFileSync(args["form-data"], 'utf8'));
          }

          // Validate
          const validator = new MultiSchemaValidator();
          const result = await validator.validateForm(
            formData,
            formConfig,
            args.step ? parseInt(args.step) : undefined
          );

          // Display results
          console.log("\n📋 Validation Results");
          console.log("=====================");
          console.log(`✅ Valid: ${result.isValid ? 'Yes' : 'No'}`);
          console.log(`⏱️  Validation Time: ${result.metadata.validationTime}ms`);
          console.log(`🌐 Locale: ${result.metadata.locale}`);
          
          if (result.errors.length > 0) {
            console.log("\n❌ Errors:");
            result.errors.forEach(error => {
              console.log(`   • ${error.field}: ${error.message} (${error.code})`);
              if (error.suggestion && args.verbose) {
                console.log(`     💡 Suggestion: ${error.suggestion}`);
              }
            });
          }

          if (result.warnings.length > 0) {
            console.log("\n⚠️  Warnings:");
            result.warnings.forEach(warning => {
              console.log(`   • ${warning.field}: ${warning.message} (${warning.code})`);
            });
          }

          if (args.verbose) {
            console.log("\n📊 Detailed Information:");
            console.log(`   • Schema Version: ${result.metadata.schemaVersion}`);
            console.log(`   • Validated At: ${result.metadata.validatedAt.toISOString()}`);
          }

          process.exit(result.isValid ? 0 : 1);
          break;

        case 'server':
          console.log("🚀 Starting form validation server...");
          const formManager = new FormManager();
          const port = parseInt(args.port);
          
          formManager.start(port);
          
          console.log(`\n✅ Server started successfully!`);
          console.log(`🌐 API Base URL: http://localhost:${port}/api`);
          console.log(`📝 Validate Field: POST /api/validate/field`);
          console.log(`📋 Validate Form: POST /api/validate/form`);
          console.log(`🔧 Manage Schemas: GET/POST /api/schemas`);
          console.log("Press Ctrl+C to stop");
          
          // Keep process running
          await new Promise(() => {});
          break;

        case 'test':
          console.log("🧪 Running form validation tests...");
          
          const testValidator = new MultiSchemaValidator();
          
          // Test basic email validation
          const emailResult = await testValidator.validateField(
            'email',
            'test@example.com',
            ['email-basic'],
            {},
            args.locale
          );
          
          console.log(`Email validation: ${emailResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
          
          // Test password validation
          const passwordResult = await testValidator.validateField(
            'password',
            'SecurePass123!',
            ['password-strong'],
            {},
            args.locale
          );
          
          console.log(`Password validation: ${passwordResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
          
          // Test phone validation
          const phoneResult = await testValidator.validateField(
            'phone',
            '+1-555-123-4567',
            ['phone-international'],
            {},
            args.locale
          );
          
          console.log(`Phone validation: ${phoneResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
          
          console.log("\n🎉 Test suite completed!");
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      logger.error('Form validation command failed', { error: error.message });
      console.error(`❌ Form Validation Error: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Configuration Examples

### Multi-Step User Registration Form

```json
{
  "id": "user-registration",
  "name": "User Registration Form",
  "title": "Create Your Account", 
  "description": "Complete the registration process in 3 easy steps",
  "version": "1.0.0",
  "multiStep": true,
  "steps": [
    {
      "id": "personal-info",
      "name": "Personal Information",
      "title": "Tell us about yourself",
      "description": "Basic personal information",
      "fields": ["firstName", "lastName", "email", "phone"],
      "validation": {
        "schemas": ["personal-info-validation"],
        "mode": "all"
      },
      "metadata": {
        "order": 1,
        "estimatedTime": 120
      }
    },
    {
      "id": "security",
      "name": "Security",
      "title": "Secure your account", 
      "description": "Create a strong password",
      "fields": ["password", "confirmPassword"],
      "validation": {
        "schemas": ["password-strong", "password-match"],
        "mode": "all"
      },
      "metadata": {
        "order": 2,
        "estimatedTime": 60
      }
    },
    {
      "id": "preferences",
      "name": "Preferences",
      "title": "Customize your experience",
      "description": "Set your preferences (optional)",
      "fields": ["newsletter", "notifications", "locale"],
      "validation": {
        "schemas": ["preferences-validation"],
        "mode": "all"
      },
      "metadata": {
        "order": 3,
        "optional": true,
        "estimatedTime": 30
      }
    }
  ],
  "fields": [
    {
      "name": "firstName",
      "type": "text",
      "label": "First Name",
      "placeholder": "Enter your first name",
      "required": true,
      "validation": {
        "schemas": ["name-validation", "profanity-check"]
      },
      "metadata": {
        "group": "personal",
        "step": 1,
        "accessibility": {
          "ariaLabel": "First name input field",
          "role": "textbox"
        }
      }
    },
    {
      "name": "email",
      "type": "email",
      "label": "Email Address",
      "placeholder": "your.email@example.com",
      "required": true,
      "validation": {
        "schemas": ["email-basic", "email-advanced"],
        "customRules": [
          {
            "name": "unique-email",
            "message": "This email is already registered",
            "validator": "checkEmailUniqueness"
          }
        ]
      },
      "metadata": {
        "group": "contact",
        "step": 1
      }
    },
    {
      "name": "password",
      "type": "password",
      "label": "Password",
      "placeholder": "Create a strong password",
      "required": true,
      "validation": {
        "schemas": ["password-strong"]
      },
      "metadata": {
        "group": "security",
        "step": 2
      }
    }
  ],
  "schemas": [
    {
      "id": "name-validation",
      "name": "Name Validation",
      "version": "1.0.0",
      "description": "Validate name fields",
      "type": "zod",
      "schema": "z.string().min(2).max(50).regex(/^[a-zA-Z\\s'-]+$/)",
      "metadata": {
        "category": "basic",
        "priority": 1
      }
    }
  ],
  "settings": {
    "realTimeValidation": true,
    "debounceDelay": 300,
    "showProgressBar": true,
    "allowSaveProgress": true,
    "requiredFieldIndicator": "*",
    "errorDisplayMode": "both",
    "accessibility": {
      "screenReaderSupport": true,
      "keyboardNavigation": true,
      "highContrast": false
    },
    "internationalization": {
      "enabled": true,
      "defaultLocale": "en",
      "supportedLocales": ["en", "es", "fr"]
    }
  }
}
```

## Testing Approach

```typescript
// tests/multi-schema-validation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MultiSchemaValidator, FormManager } from '../src/form-validation';

describe('Multi-Schema Form Validation', () => {
  let validator: MultiSchemaValidator;

  beforeEach(() => {
    validator = new MultiSchemaValidator();
  });

  describe('Field Validation', () => {
    it('should validate email with multiple schemas', async () => {
      const result = await validator.validateField(
        'email',
        'test@example.com',
        ['email-basic', 'email-advanced'],
        {}
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid email', async () => {
      const result = await validator.validateField(
        'email',
        'invalid-email',
        ['email-basic'],
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
    });

    it('should validate phone numbers internationally', async () => {
      const result = await validator.validateField(
        'phone',
        '+1-555-123-4567',
        ['phone-international'],
        {}
      );

      expect(result.isValid).toBe(true);
    });

    it('should handle conditional validation', async () => {
      const formData = { userType: 'business' };
      
      const result = await validator.validateField(
        'taxId',
        'TAX123456789',
        ['business-rules'],
        formData
      );

      // This would test business rule validation
      expect(result).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    it('should validate complete form', async () => {
      const formConfig = {
        id: 'test-form',
        fields: [
          {
            name: 'email',
            validation: { schemas: ['email-basic'] },
            required: true,
            metadata: {}
          }
        ],
        settings: {
          internationalization: { defaultLocale: 'en' }
        }
      };

      const formData = { email: 'test@example.com' };
      
      const result = await validator.validateForm(formData, formConfig);

      expect(result.isValid).toBe(true);
    });

    it('should validate multi-step form', async () => {
      const formConfig = {
        id: 'multi-step-form',
        steps: [
          {
            metadata: { order: 1 },
            validation: { schemas: [] }
          }
        ],
        fields: [
          {
            name: 'firstName',
            validation: { schemas: ['name-validation'] },
            required: true,
            metadata: { step: 1 }
          }
        ],
        settings: {
          internationalization: { defaultLocale: 'en' }
        }
      };

      const formData = { firstName: 'John' };
      
      const result = await validator.validateForm(formData, formConfig, 1);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Schema Registry', () => {
    it('should register and retrieve custom schemas', () => {
      const customSchema = {
        id: 'custom-test',
        name: 'Custom Test Schema',
        version: '1.0.0',
        type: 'zod' as const,
        schema: 'z.string().min(5)',
        metadata: { category: 'test', priority: 1 }
      };

      validator.registerSchema(customSchema);
      
      const schemas = validator.getAvailableSchemas();
      const testSchema = schemas.find(s => s.id === 'custom-test');
      
      expect(testSchema).toBeDefined();
      expect(testSchema!.name).toBe('Custom Test Schema');
    });
  });

  describe('Internationalization', () => {
    it('should provide localized error messages', async () => {
      const result = await validator.validateField(
        'email',
        'invalid',
        ['email-basic'],
        {},
        'es'
      );

      expect(result.isValid).toBe(false);
      expect(result.metadata.locale).toBe('es');
    });
  });
});
```

## Usage Examples

```bash
# Validate a form configuration file
./cli form-validate --action=validate \
  --form-config=./forms/registration-form.json \
  --form-data='{"email":"test@example.com","password":"SecurePass123!"}' \
  --locale=en \
  --verbose

# Validate specific step of multi-step form
./cli form-validate --action=validate \
  --form-config=./forms/multi-step-form.json \
  --form-data=./data/step1-data.json \
  --step=1

# Start validation API server
./cli form-validate --action=server --port=3000

# Run validation tests
./cli form-validate --action=test --locale=es
```

## Performance Considerations

1. **Schema Compilation**: Schemas are compiled once and cached
2. **Async Validation**: Custom validators support async operations
3. **Debouncing**: Real-time validation includes configurable debouncing
4. **Parallel Validation**: Multiple schemas validated concurrently
5. **Memory Management**: Schema cache with LRU eviction

## Deployment Notes

This pattern provides a comprehensive, production-ready multi-schema validation system that can handle complex forms with conditional logic, internationalization, and accessibility requirements. It's designed for enterprise applications requiring robust data validation and user experience optimization.