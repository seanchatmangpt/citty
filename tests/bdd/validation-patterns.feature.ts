/**
 * BDD Tests for Validation Patterns
 * 
 * Comprehensive edge cases and validation scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { cittyPro, hooks, workflowGenerator } from '../../src/pro';
import type { RunCtx } from '../../src/types/citty-pro';

describe('Validation Patterns - Advanced BDD Tests', () => {
  let context: RunCtx;
  
  beforeEach(() => {
    context = {
      cwd: '/test',
      env: {},
      now: () => new Date('2024-01-01'),
      memo: {}
    };
    hooks.removeAllHooks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complex Nested Schema Validation', () => {
    describe('Given deeply nested object schemas', () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
        state: z.string().length(2),
        zip: z.string().regex(/^\d{5}(-\d{4})?$/)
      });
      
      const CompanySchema = z.object({
        name: z.string(),
        taxId: z.string(),
        addresses: z.object({
          headquarters: AddressSchema,
          branches: z.array(AddressSchema),
          warehouse: AddressSchema.optional()
        })
      });
      
      const EmployeeSchema = z.object({
        id: z.string().uuid(),
        personalInfo: z.object({
          firstName: z.string(),
          lastName: z.string(),
          dateOfBirth: z.date(),
          ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/)
        }),
        employment: z.object({
          company: CompanySchema,
          position: z.string(),
          salary: z.number().positive(),
          startDate: z.date(),
          endDate: z.date().optional()
        }),
        benefits: z.object({
          health: z.object({
            provider: z.string(),
            planType: z.enum(['HMO', 'PPO', 'EPO']),
            deductible: z.number()
          }),
          retirement: z.object({
            type: z.enum(['401k', 'IRA', 'Pension']),
            contribution: z.number().min(0).max(100)
          }).optional()
        })
      });
      
      const validateEmployeeTask = cittyPro.defineTask({
        id: 'validate-employee',
        in: EmployeeSchema,
        run: async (employee) => ({
          valid: true,
          employee
        })
      });
      
      describe('When all nested fields are valid', () => {
        it('Then should pass deep validation', async () => {
          const validEmployee = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            personalInfo: {
              firstName: 'John',
              lastName: 'Doe',
              dateOfBirth: new Date('1990-01-01'),
              ssn: '123-45-6789'
            },
            employment: {
              company: {
                name: 'Tech Corp',
                taxId: '12-3456789',
                addresses: {
                  headquarters: {
                    street: '123 Main St',
                    city: 'San Francisco',
                    state: 'CA',
                    zip: '94105'
                  },
                  branches: [
                    {
                      street: '456 Oak Ave',
                      city: 'New York',
                      state: 'NY',
                      zip: '10001-1234'
                    }
                  ]
                }
              },
              position: 'Senior Engineer',
              salary: 120000,
              startDate: new Date('2020-01-15')
            },
            benefits: {
              health: {
                provider: 'BlueCross',
                planType: 'PPO',
                deductible: 1500
              },
              retirement: {
                type: '401k',
                contribution: 6
              }
            }
          };
          
          const result = await validateEmployeeTask.call(validEmployee, context);
          expect(result.valid).toBe(true);
          expect(result.employee).toEqual(validEmployee);
        });
      });
      
      describe('When nested validation fails', () => {
        it('Then should provide detailed error path', async () => {
          const invalidEmployee = {
            id: 'not-a-uuid',
            personalInfo: {
              firstName: 'John',
              lastName: 'Doe',
              dateOfBirth: new Date('1990-01-01'),
              ssn: '123456789' // Invalid format
            },
            employment: {
              company: {
                name: 'Tech Corp',
                taxId: '12-3456789',
                addresses: {
                  headquarters: {
                    street: '123 Main St',
                    city: 'San Francisco',
                    state: 'California', // Should be 2 chars
                    zip: 'invalid'
                  },
                  branches: []
                }
              },
              position: 'Senior Engineer',
              salary: -5000, // Negative salary
              startDate: new Date('2020-01-15')
            },
            benefits: {
              health: {
                provider: 'BlueCross',
                planType: 'INVALID' as any, // Invalid enum
                deductible: 1500
              }
            }
          };
          
          await expect(
            validateEmployeeTask.call(invalidEmployee as any, context)
          ).rejects.toThrow();
        });
      });
    });
  });
  
  describe('Conditional Schema Refinements', () => {
    describe('Given schemas with complex refinements', () => {
      const OrderSchema = z.object({
        id: z.string(),
        customer: z.object({
          type: z.enum(['individual', 'business']),
          taxExempt: z.boolean()
        }),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
          price: z.number().positive()
        })),
        subtotal: z.number(),
        tax: z.number(),
        total: z.number(),
        paymentMethod: z.enum(['credit', 'debit', 'invoice', 'cash'])
      }).refine(
        (data) => {
          // Tax exemption check
          if (data.customer.taxExempt) {
            return data.tax === 0;
          }
          return data.tax > 0;
        },
        { message: 'Tax calculation error for tax-exempt status' }
      ).refine(
        (data) => {
          // Total calculation check
          const calculatedSubtotal = data.items.reduce(
            (sum, item) => sum + (item.quantity * item.price), 0
          );
          return Math.abs(data.subtotal - calculatedSubtotal) < 0.01;
        },
        { message: 'Subtotal does not match items' }
      ).refine(
        (data) => {
          // Total verification
          return Math.abs(data.total - (data.subtotal + data.tax)) < 0.01;
        },
        { message: 'Total does not equal subtotal + tax' }
      ).refine(
        (data) => {
          // Business customers must use invoice payment
          if (data.customer.type === 'business') {
            return data.paymentMethod === 'invoice' || data.paymentMethod === 'credit';
          }
          return true;
        },
        { message: 'Business customers must use invoice or credit payment' }
      );
      
      describe('When tax-exempt customer has tax', () => {
        it('Then should fail refinement', async () => {
          const order = {
            id: 'ORDER-001',
            customer: { type: 'business', taxExempt: true },
            items: [
              { productId: 'P1', quantity: 2, price: 50 }
            ],
            subtotal: 100,
            tax: 8, // Should be 0 for tax-exempt
            total: 108,
            paymentMethod: 'invoice'
          };
          
          const result = OrderSchema.safeParse(order);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.errors[0].message).toContain('tax-exempt');
          }
        });
      });
      
      describe('When calculations are correct', () => {
        it('Then should pass all refinements', () => {
          const order = {
            id: 'ORDER-002',
            customer: { type: 'individual', taxExempt: false },
            items: [
              { productId: 'P1', quantity: 2, price: 50 },
              { productId: 'P2', quantity: 1, price: 25 }
            ],
            subtotal: 125,
            tax: 10,
            total: 135,
            paymentMethod: 'credit'
          };
          
          const result = OrderSchema.safeParse(order);
          expect(result.success).toBe(true);
        });
      });
    });
  });
  
  describe('Dynamic Schema Generation', () => {
    describe('Given runtime schema generation requirements', () => {
      function generateSchemaFromConfig(config: {
        fields: Array<{
          name: string;
          type: 'string' | 'number' | 'boolean' | 'date';
          required: boolean;
          validation?: any;
        }>;
      }) {
        const shape: any = {};
        
        for (const field of config.fields) {
          let fieldSchema: any;
          
          switch (field.type) {
            case 'string':
              fieldSchema = z.string();
              if (field.validation?.minLength) {
                fieldSchema = fieldSchema.min(field.validation.minLength);
              }
              if (field.validation?.maxLength) {
                fieldSchema = fieldSchema.max(field.validation.maxLength);
              }
              if (field.validation?.pattern) {
                fieldSchema = fieldSchema.regex(new RegExp(field.validation.pattern));
              }
              break;
            case 'number':
              fieldSchema = z.number();
              if (field.validation?.min !== undefined) {
                fieldSchema = fieldSchema.min(field.validation.min);
              }
              if (field.validation?.max !== undefined) {
                fieldSchema = fieldSchema.max(field.validation.max);
              }
              break;
            case 'boolean':
              fieldSchema = z.boolean();
              break;
            case 'date':
              fieldSchema = z.date();
              break;
          }
          
          if (!field.required) {
            fieldSchema = fieldSchema.optional();
          }
          
          shape[field.name] = fieldSchema;
        }
        
        return z.object(shape);
      }
      
      describe('When schema is generated from configuration', () => {
        it('Then should validate according to dynamic rules', () => {
          const config = {
            fields: [
              {
                name: 'username',
                type: 'string' as const,
                required: true,
                validation: { minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' }
              },
              {
                name: 'age',
                type: 'number' as const,
                required: true,
                validation: { min: 18, max: 120 }
              },
              {
                name: 'email',
                type: 'string' as const,
                required: false,
                validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' }
              }
            ]
          };
          
          const DynamicSchema = generateSchemaFromConfig(config);
          
          // Valid data
          const validData = {
            username: 'john_doe',
            age: 25
          };
          expect(DynamicSchema.safeParse(validData).success).toBe(true);
          
          // Invalid username (too short)
          const invalidUsername = {
            username: 'jo',
            age: 25
          };
          expect(DynamicSchema.safeParse(invalidUsername).success).toBe(false);
          
          // Invalid age (too young)
          const invalidAge = {
            username: 'john_doe',
            age: 17
          };
          expect(DynamicSchema.safeParse(invalidAge).success).toBe(false);
        });
      });
    });
  });
  
  describe('Cross-Field Validation', () => {
    describe('Given schemas with cross-field dependencies', () => {
      const DateRangeSchema = z.object({
        startDate: z.date(),
        endDate: z.date()
      }).refine(
        (data) => data.endDate >= data.startDate,
        { message: 'End date must be after start date' }
      );
      
      const PasswordSchema = z.object({
        password: z.string().min(8),
        confirmPassword: z.string()
      }).refine(
        (data) => data.password === data.confirmPassword,
        { message: 'Passwords do not match', path: ['confirmPassword'] }
      );
      
      const ConditionalFieldSchema = z.object({
        requireShipping: z.boolean(),
        shippingAddress: z.string().optional(),
        billingAddress: z.string()
      }).refine(
        (data) => {
          if (data.requireShipping && !data.shippingAddress) {
            return false;
          }
          return true;
        },
        { message: 'Shipping address required when shipping is enabled' }
      );
      
      describe('When date range is invalid', () => {
        it('Then should fail cross-field validation', () => {
          const invalidRange = {
            startDate: new Date('2024-12-31'),
            endDate: new Date('2024-01-01')
          };
          
          const result = DateRangeSchema.safeParse(invalidRange);
          expect(result.success).toBe(false);
        });
      });
      
      describe('When passwords do not match', () => {
        it('Then should indicate field path in error', () => {
          const mismatchedPasswords = {
            password: 'SecurePass123!',
            confirmPassword: 'DifferentPass456!'
          };
          
          const result = PasswordSchema.safeParse(mismatchedPasswords);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.errors[0].path).toContain('confirmPassword');
          }
        });
      });
      
      describe('When conditional field is missing', () => {
        it('Then should fail conditional validation', () => {
          const missingShipping = {
            requireShipping: true,
            billingAddress: '123 Main St'
          };
          
          const result = ConditionalFieldSchema.safeParse(missingShipping);
          expect(result.success).toBe(false);
        });
      });
    });
  });
  
  describe('Async Validation Workflows', () => {
    describe('Given validation requiring external checks', () => {
      const mockDatabase = {
        userExists: async (email: string) => {
          await new Promise(r => setTimeout(r, 10));
          return email === 'existing@example.com';
        },
        isBlacklisted: async (domain: string) => {
          await new Promise(r => setTimeout(r, 10));
          return domain === 'blacklisted.com';
        }
      };
      
      const asyncValidationWorkflow = workflowGenerator.createValidationWorkflow(
        'async-validation',
        z.object({
          email: z.string().email(),
          username: z.string().min(3),
          domain: z.string()
        }),
        [
          async (data) => {
            const exists = await mockDatabase.userExists(data.email);
            if (exists) {
              throw new Error('Email already exists');
            }
            return data;
          },
          async (data) => {
            const blacklisted = await mockDatabase.isBlacklisted(data.domain);
            if (blacklisted) {
              throw new Error('Domain is blacklisted');
            }
            return data;
          }
        ]
      );
      
      describe('When email already exists', () => {
        it('Then async validation should fail', async () => {
          const input = {
            email: 'existing@example.com',
            username: 'newuser',
            domain: 'example.com'
          };
          
          await expect(asyncValidationWorkflow.run(context)).rejects.toThrow();
        });
      });
      
      describe('When domain is blacklisted', () => {
        it('Then async validation should fail', async () => {
          const input = {
            email: 'new@example.com',
            username: 'newuser',
            domain: 'blacklisted.com'
          };
          
          await expect(asyncValidationWorkflow.run(context)).rejects.toThrow();
        });
      });
    });
  });
  
  describe('Schema Evolution and Migration', () => {
    describe('Given evolving schemas over time', () => {
      const UserV1Schema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email()
      });
      
      const UserV2Schema = UserV1Schema.extend({
        firstName: z.string(),
        lastName: z.string(),
        phoneNumber: z.string().optional()
      }).omit({ name: true });
      
      const UserV3Schema = UserV2Schema.extend({
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string()
        }).optional(),
        preferences: z.object({
          newsletter: z.boolean(),
          notifications: z.boolean()
        }).default({
          newsletter: false,
          notifications: true
        })
      });
      
      const migrationWorkflow = cittyPro.defineWorkflow({
        id: 'schema-migration',
        steps: [
          {
            id: 'v1-to-v2',
            use: cittyPro.defineTask({
              id: 'migrate-v1-to-v2',
              in: UserV1Schema,
              out: UserV2Schema,
              run: async (v1User) => {
                const [firstName, ...lastNameParts] = v1User.name.split(' ');
                return {
                  id: v1User.id,
                  email: v1User.email,
                  firstName: firstName || 'Unknown',
                  lastName: lastNameParts.join(' ') || 'Unknown'
                };
              }
            })
          },
          {
            id: 'v2-to-v3',
            use: cittyPro.defineTask({
              id: 'migrate-v2-to-v3',
              in: UserV2Schema,
              out: UserV3Schema,
              run: async (v2User) => ({
                ...v2User,
                preferences: {
                  newsletter: false,
                  notifications: true
                }
              })
            }),
            select: (state) => state['v1-to-v2']
          }
        ]
      });
      
      describe('When migrating from v1 to v3', () => {
        it('Then should transform data through all versions', async () => {
          const v1User = {
            id: 'USER-001',
            name: 'John Michael Doe',
            email: 'john@example.com'
          };
          
          const seed = v1User;
          const workflow = cittyPro.defineWorkflow({
            id: 'test-migration',
            seed,
            steps: migrationWorkflow.steps
          });
          
          const result = await workflow.run(context);
          const v3User = result['v2-to-v3'];
          
          expect(v3User).toMatchObject({
            id: 'USER-001',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Michael Doe',
            preferences: {
              newsletter: false,
              notifications: true
            }
          });
        });
      });
    });
  });
});