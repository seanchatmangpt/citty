/**
 * Multi-Tenant SaaS BDD Tests
 * 
 * Comprehensive BDD scenarios for Fortune 500 multi-tenant SaaS platforms
 * Testing tenant isolation, resource allocation, billing, and enterprise SaaS management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { 
  cittyPro, 
  hooks, 
  registerCoreHooks,
  workflowGenerator,
  WorkflowTemplates
} from '../../src/pro';
import type { RunCtx, Task, Workflow } from '../../src/types/citty-pro';

describe('Fortune 500 Multi-Tenant SaaS - BDD Scenarios', () => {
  
  let saasContext: RunCtx;
  let tenantMetrics: any;
  let billingAuditTrail: any[];
  let resourceManager: any;
  let tenantRegistry: any;
  
  beforeEach(() => {
    // Multi-tenant SaaS context setup
    saasContext = {
      cwd: '/enterprise/saas-platform',
      env: {
        NODE_ENV: 'production',
        SAAS_MODE: 'MULTI_TENANT',
        TENANT_ISOLATION: 'STRICT',
        BILLING_ENABLED: 'true',
        RESOURCE_METERING: 'ENABLED',
        COMPLIANCE_LEVEL: 'ENTERPRISE'
      },
      now: () => new Date('2024-01-01T00:00:00Z'),
      memo: {
        platform: 'enterprise-saas',
        tenantIsolation: 'DATABASE_PER_TENANT',
        billingModel: 'USAGE_BASED',
        supportTier: 'ENTERPRISE'
      },
      otel: {
        span: async (name, fn) => {
          const start = performance.now();
          try {
            const result = await fn();
            const duration = performance.now() - start;
            tenantMetrics.recordUsage(name, duration, saasContext.memo?.currentTenantId || 'unknown');
            return result;
          } catch (error) {
            tenantMetrics.recordError(name, error, saasContext.memo?.currentTenantId || 'unknown');
            throw error;
          }
        }
      }
    };
    
    // Initialize tenant metrics
    tenantMetrics = {
      tenantUsage: new Map(),
      resourceConsumption: new Map(),
      billingData: new Map(),
      slaMetrics: new Map(),
      
      recordUsage: (operation: string, duration: number, tenantId: string) => {
        const key = `${tenantId}-${operation}`;
        if (!tenantMetrics.tenantUsage.has(key)) {
          tenantMetrics.tenantUsage.set(key, []);
        }
        tenantMetrics.tenantUsage.get(key).push({
          operation,
          duration,
          timestamp: Date.now(),
          tenantId
        });
        
        // Update resource consumption
        if (!tenantMetrics.resourceConsumption.has(tenantId)) {
          tenantMetrics.resourceConsumption.set(tenantId, {
            computeUnits: 0,
            storageUsed: 0,
            apiCalls: 0,
            dataTransfer: 0
          });
        }
        
        const resources = tenantMetrics.resourceConsumption.get(tenantId);
        resources.computeUnits += duration / 1000; // Convert to compute seconds
        resources.apiCalls += 1;
        resources.dataTransfer += Math.random() * 1024; // Random KB
      },
      
      recordError: (operation: string, error: any, tenantId: string) => {
        if (!tenantMetrics.slaMetrics.has(tenantId)) {
          tenantMetrics.slaMetrics.set(tenantId, { errors: 0, total: 0 });
        }
        tenantMetrics.slaMetrics.get(tenantId).errors += 1;
      },
      
      getTenantUsage: (tenantId: string) => {
        return tenantMetrics.resourceConsumption.get(tenantId) || {
          computeUnits: 0, storageUsed: 0, apiCalls: 0, dataTransfer: 0
        };
      },
      
      calculateBill: (tenantId: string, plan: any) => {
        const usage = tenantMetrics.getTenantUsage(tenantId);
        let cost = plan.baseCost;
        
        // Usage-based billing
        cost += Math.max(0, usage.apiCalls - plan.includedApiCalls) * plan.apiCostPerCall;
        cost += Math.max(0, usage.computeUnits - plan.includedCompute) * plan.computeCostPerUnit;
        cost += Math.max(0, usage.storageUsed - plan.includedStorage) * plan.storageCostPerGB;
        cost += usage.dataTransfer * plan.dataTransferCostPerGB;
        
        return {
          baseCost: plan.baseCost,
          usageCost: cost - plan.baseCost,
          totalCost: cost,
          usage,
          plan: plan.name
        };
      }
    };
    
    // Initialize billing audit trail
    billingAuditTrail = [];
    
    // Initialize resource manager
    resourceManager = {
      tenantLimits: new Map(),
      resourcePools: new Map(),
      
      setTenantLimits: (tenantId: string, limits: any) => {
        resourceManager.tenantLimits.set(tenantId, limits);
      },
      
      checkResourceQuota: (tenantId: string, resourceType: string, requested: number) => {
        const limits = resourceManager.tenantLimits.get(tenantId);
        if (!limits) return { allowed: false, reason: 'No limits configured' };
        
        const currentUsage = tenantMetrics.getTenantUsage(tenantId);
        const currentValue = currentUsage[resourceType] || 0;
        
        if (currentValue + requested <= limits[resourceType]) {
          return { allowed: true, remaining: limits[resourceType] - currentValue - requested };
        } else {
          return { 
            allowed: false, 
            reason: 'Quota exceeded',
            limit: limits[resourceType],
            current: currentValue,
            requested
          };
        }
      },
      
      allocateResource: (tenantId: string, resourceType: string, amount: number) => {
        const check = resourceManager.checkResourceQuota(tenantId, resourceType, amount);
        if (check.allowed) {
          // Update usage
          const usage = tenantMetrics.resourceConsumption.get(tenantId);
          if (usage) {
            usage[resourceType] = (usage[resourceType] || 0) + amount;
          }
          return { success: true, allocated: amount };
        } else {
          return { success: false, reason: check.reason };
        }
      }
    };
    
    // Initialize tenant registry
    tenantRegistry = {
      tenants: new Map(),
      
      registerTenant: (tenantId: string, config: any) => {
        tenantRegistry.tenants.set(tenantId, {
          ...config,
          id: tenantId,
          createdAt: Date.now(),
          status: 'ACTIVE',
          lastActivity: Date.now()
        });
      },
      
      getTenant: (tenantId: string) => {
        return tenantRegistry.tenants.get(tenantId);
      },
      
      updateTenantActivity: (tenantId: string) => {
        const tenant = tenantRegistry.tenants.get(tenantId);
        if (tenant) {
          tenant.lastActivity = Date.now();
        }
      }
    };
    
    // Register core hooks for multi-tenancy
    registerCoreHooks();
    
    // Setup tenant isolation hooks
    hooks.hook('task:will:call', async (payload) => {
      const tenantId = saasContext.memo?.currentTenantId;
      if (tenantId) {
        tenantRegistry.updateTenantActivity(tenantId);
        billingAuditTrail.push({
          event: 'TENANT_API_CALL',
          tenantId,
          taskId: payload.id,
          timestamp: Date.now(),
          isolationLevel: 'STRICT'
        });
      }
    });
    
    hooks.hook('task:did:call', async (payload) => {
      const tenantId = saasContext.memo?.currentTenantId;
      if (tenantId) {
        billingAuditTrail.push({
          event: 'TENANT_OPERATION_COMPLETED',
          tenantId,
          taskId: payload.id,
          result: payload.res,
          timestamp: Date.now()
        });
      }
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    billingAuditTrail = [];
    tenantMetrics.tenantUsage.clear();
    tenantMetrics.resourceConsumption.clear();
    tenantMetrics.billingData.clear();
    resourceManager.tenantLimits.clear();
    tenantRegistry.tenants.clear();
  });

  // ============= TENANT PROVISIONING & ISOLATION =============
  
  describe('Tenant Provisioning & Isolation', () => {
    describe('Given a Fortune 500 SaaS platform with strict tenant isolation', () => {
      
      const TenantProvisioningSchema = z.object({
        tenant: z.object({
          organizationId: z.string().uuid(),
          organizationName: z.string().min(2),
          tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS']),
          region: z.enum(['US_EAST', 'US_WEST', 'EU_WEST', 'EU_CENTRAL', 'ASIA_PACIFIC']),
          complianceRequirements: z.array(z.enum(['SOX', 'GDPR', 'HIPAA', 'PCI_DSS', 'ISO_27001']))
        }),
        isolationConfig: z.object({
          databaseIsolation: z.enum(['SHARED_DB', 'SCHEMA_PER_TENANT', 'DB_PER_TENANT']),
          networkIsolation: z.boolean(),
          dataEncryption: z.enum(['AES_128', 'AES_256', 'FIPS_140_2']),
          keyManagement: z.enum(['SHARED', 'TENANT_SPECIFIC', 'BRING_YOUR_OWN_KEY']),
          auditLogging: z.boolean()
        }),
        resourceQuotas: z.object({
          computeUnits: z.number().positive(),
          storageUsed: z.number().positive(), // GB
          apiCalls: z.number().positive(),
          dataTransfer: z.number().positive(), // GB
          maxUsers: z.number().positive(),
          maxIntegrations: z.number().positive()
        }),
        slaRequirements: z.object({
          uptime: z.number().min(0.95).max(1),
          responseTime: z.number().positive(), // milliseconds
          throughput: z.number().positive(), // requests per second
          supportLevel: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'])
        })
      });
      
      const tenantProvisioningTask = cittyPro.defineTask({
        id: 'tenant-provisioning-system',
        run: async (provisioningRequest, ctx) => {
          const { tenant, isolationConfig, resourceQuotas, slaRequirements } = provisioningRequest;
          
          // Step 1: Validate tenant requirements
          const validationResults = {
            complianceValidation: tenant.complianceRequirements.every(req => 
              ['SOX', 'GDPR', 'HIPAA', 'PCI_DSS', 'ISO_27001'].includes(req)
            ),
            tierValidation: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'].includes(tenant.tier),
            regionValidation: ['US_EAST', 'US_WEST', 'EU_WEST', 'EU_CENTRAL', 'ASIA_PACIFIC'].includes(tenant.region)
          };
          
          if (!Object.values(validationResults).every(v => v)) {
            throw new Error('Tenant validation failed - invalid configuration');
          }
          
          // Step 2: Database provisioning based on isolation level
          const databaseProvisioning = {
            isolationLevel: isolationConfig.databaseIsolation,
            databaseId: `${tenant.organizationId}-${isolationConfig.databaseIsolation}`,
            encryptionEnabled: true,
            encryptionLevel: isolationConfig.dataEncryption,
            keyManagement: isolationConfig.keyManagement,
            backupRetention: tenant.tier === 'ENTERPRISE_PLUS' ? 90 : tenant.tier === 'ENTERPRISE' ? 30 : 7
          };
          
          // Step 3: Network isolation setup
          const networkProvisioning = {
            vpcId: isolationConfig.networkIsolation ? `vpc-${tenant.organizationId}` : 'shared-vpc',
            subnetId: `subnet-${tenant.organizationId}-${tenant.region}`,
            securityGroups: [`sg-${tenant.organizationId}-app`, `sg-${tenant.organizationId}-db`],
            loadBalancerArn: `lb-${tenant.organizationId}`,
            certificateArn: `cert-${tenant.organizationId}`,
            domainName: `${tenant.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${tenant.region.toLowerCase()}.saasplatform.com`
          };
          
          // Step 4: Resource quota configuration
          resourceManager.setTenantLimits(tenant.organizationId, resourceQuotas);
          
          // Step 5: SLA configuration and monitoring setup
          const slaConfiguration = {
            uptimeTarget: slaRequirements.uptime,
            responseTimeTarget: slaRequirements.responseTime,
            throughputTarget: slaRequirements.throughput,
            supportTier: slaRequirements.supportLevel,
            monitoringEnabled: true,
            alerting: {
              uptimeThreshold: slaRequirements.uptime - 0.01, // Alert 1% before SLA breach
              responseTimeThreshold: slaRequirements.responseTime * 1.2, // Alert 20% above target
              escalationPlan: tenant.tier === 'ENTERPRISE_PLUS' ? 'IMMEDIATE' : 'STANDARD'
            }
          };
          
          // Step 6: Register tenant in registry
          tenantRegistry.registerTenant(tenant.organizationId, {
            ...tenant,
            isolationConfig,
            resourceQuotas,
            slaRequirements,
            database: databaseProvisioning,
            network: networkProvisioning,
            sla: slaConfiguration,
            provisioningTimestamp: Date.now()
          });
          
          // Step 7: Initialize tenant metrics
          tenantMetrics.resourceConsumption.set(tenant.organizationId, {
            computeUnits: 0,
            storageUsed: Math.random() * 1, // Small initial usage
            apiCalls: 0,
            dataTransfer: 0
          });
          
          const provisioningResult = {
            tenantId: tenant.organizationId,
            status: 'PROVISIONED',
            database: databaseProvisioning,
            network: networkProvisioning,
            sla: slaConfiguration,
            resourceLimits: resourceQuotas,
            provisioningTime: Date.now(),
            estimatedActivationTime: '15 minutes',
            initialCredentials: {
              adminUser: `admin-${tenant.organizationId.substring(0, 8)}`,
              temporaryPassword: `temp-${Math.random().toString(36).substring(2, 15)}`,
              apiKey: `ak-${tenant.organizationId}`,
              webhookSecret: `whsec_${Math.random().toString(36).substring(2, 32)}`
            }
          };
          
          return provisioningResult;
        }
      });

      describe('When provisioning a new enterprise tenant', () => {
        it('Then should create isolated environment with strict data separation', async () => {
          const enterpriseTenantRequest = {
            tenant: {
              organizationId: crypto.randomUUID(),
              organizationName: 'Acme Fortune 500 Corp',
              tier: 'ENTERPRISE_PLUS' as const,
              region: 'US_EAST' as const,
              complianceRequirements: ['SOX', 'GDPR', 'ISO_27001'] as const
            },
            isolationConfig: {
              databaseIsolation: 'DB_PER_TENANT' as const,
              networkIsolation: true,
              dataEncryption: 'AES_256' as const,
              keyManagement: 'TENANT_SPECIFIC' as const,
              auditLogging: true
            },
            resourceQuotas: {
              computeUnits: 10000,
              storageUsed: 1000, // 1TB
              apiCalls: 1000000, // 1M per month
              dataTransfer: 5000, // 5TB
              maxUsers: 5000,
              maxIntegrations: 100
            },
            slaRequirements: {
              uptime: 0.9999, // 99.99%
              responseTime: 100, // 100ms
              throughput: 1000, // 1000 RPS
              supportLevel: 'ENTERPRISE' as const
            }
          };
          
          // Set current tenant context
          saasContext.memo!.currentTenantId = enterpriseTenantRequest.tenant.organizationId;
          
          const result = await tenantProvisioningTask.call(enterpriseTenantRequest, saasContext);
          
          // Tenant provisioning validation
          expect(result.status).toBe('PROVISIONED');
          expect(result.tenantId).toBe(enterpriseTenantRequest.tenant.organizationId);
          expect(result.database.isolationLevel).toBe('DB_PER_TENANT');
          expect(result.database.encryptionLevel).toBe('AES_256');
          expect(result.network.vpcId).toContain('vpc-');
          expect(result.network.domainName).toContain('acmefortune500corp');
          
          // SLA configuration validation
          expect(result.sla.uptimeTarget).toBe(0.9999);
          expect(result.sla.responseTimeTarget).toBe(100);
          expect(result.sla.supportTier).toBe('ENTERPRISE');
          
          // Resource limits validation
          expect(result.resourceLimits.computeUnits).toBe(10000);
          expect(result.resourceLimits.storageUsed).toBe(1000);
          expect(result.resourceLimits.apiCalls).toBe(1000000);
          
          // Tenant registry validation
          const registeredTenant = tenantRegistry.getTenant(result.tenantId);
          expect(registeredTenant).toBeDefined();
          expect(registeredTenant.status).toBe('ACTIVE');
          expect(registeredTenant.tier).toBe('ENTERPRISE_PLUS');
          
          // Isolation audit trail
          const isolationEvents = billingAuditTrail.filter(e => 
            e.event === 'TENANT_OPERATION_COMPLETED' && e.isolationLevel === 'STRICT'
          );
          expect(isolationEvents.length).toBeGreaterThan(0);
        });
        
        it('Then should enforce resource quotas and prevent tenant resource leakage', async () => {
          const quotaTestTenant = {
            tenant: {
              organizationId: crypto.randomUUID(),
              organizationName: 'Small Business Corp',
              tier: 'STARTER' as const,
              region: 'US_WEST' as const,
              complianceRequirements: [] as const
            },
            isolationConfig: {
              databaseIsolation: 'SCHEMA_PER_TENANT' as const,
              networkIsolation: false,
              dataEncryption: 'AES_128' as const,
              keyManagement: 'SHARED' as const,
              auditLogging: true
            },
            resourceQuotas: {
              computeUnits: 100, // Very limited
              storageUsed: 10,   // 10GB only
              apiCalls: 10000,   // 10K per month
              dataTransfer: 50,  // 50GB
              maxUsers: 10,
              maxIntegrations: 5
            },
            slaRequirements: {
              uptime: 0.99,      // 99%
              responseTime: 500, // 500ms
              throughput: 100,   // 100 RPS
              supportLevel: 'BASIC' as const
            }
          };
          
          // Provision the tenant
          saasContext.memo!.currentTenantId = quotaTestTenant.tenant.organizationId;
          const result = await tenantProvisioningTask.call(quotaTestTenant, saasContext);
          
          // Test resource allocation within limits
          const validAllocation = resourceManager.allocateResource(result.tenantId, 'computeUnits', 50);
          expect(validAllocation.success).toBe(true);
          expect(validAllocation.allocated).toBe(50);
          
          // Test resource allocation exceeding limits
          const invalidAllocation = resourceManager.allocateResource(result.tenantId, 'computeUnits', 100);
          expect(invalidAllocation.success).toBe(false);
          expect(invalidAllocation.reason).toContain('Quota exceeded');
          
          // Test quota checking
          const quotaCheck = resourceManager.checkResourceQuota(result.tenantId, 'apiCalls', 15000);
          expect(quotaCheck.allowed).toBe(false);
          expect(quotaCheck.reason).toBe('Quota exceeded');
          
          // Verify tier-appropriate configuration
          expect(result.database.isolationLevel).toBe('SCHEMA_PER_TENANT');
          expect(result.sla.supportTier).toBe('BASIC');
          expect(result.database.backupRetention).toBe(7); // Basic tier gets 7 days
        });
      });
    });
  });

  // ============= USAGE-BASED BILLING SYSTEM =============
  
  describe('Usage-Based Billing System', () => {
    describe('Given a Fortune 500 SaaS platform with usage-based billing', () => {
      
      const BillingSchema = z.object({
        billingPeriod: z.object({
          startDate: z.coerce.date(),
          endDate: z.coerce.date(),
          billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL'])
        }),
        pricingPlan: z.object({
          name: z.string(),
          baseCost: z.number().min(0),
          includedApiCalls: z.number().min(0),
          includedCompute: z.number().min(0),
          includedStorage: z.number().min(0),
          apiCostPerCall: z.number().min(0),
          computeCostPerUnit: z.number().min(0),
          storageCostPerGB: z.number().min(0),
          dataTransferCostPerGB: z.number().min(0),
          supportIncluded: z.boolean(),
          slaLevel: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'])
        }),
        usageData: z.object({
          tenantId: z.string().uuid(),
          apiCalls: z.number().min(0),
          computeUnits: z.number().min(0),
          storageUsed: z.number().min(0),
          dataTransfer: z.number().min(0),
          activeUsers: z.number().min(0),
          integrations: z.number().min(0)
        })
      });
      
      const usageBillingTask = cittyPro.defineTask({
        id: 'usage-based-billing-system',
        run: async (billingRequest, ctx) => {
          const { billingPeriod, pricingPlan, usageData } = billingRequest;
          
          // Step 1: Validate billing period
          if (billingPeriod.endDate <= billingPeriod.startDate) {
            throw new Error('Invalid billing period - end date must be after start date');
          }
          
          // Step 2: Calculate base subscription cost
          let totalCost = pricingPlan.baseCost;
          const costBreakdown = {
            baseCost: pricingPlan.baseCost,
            apiCallsCost: 0,
            computeCost: 0,
            storageCost: 0,
            dataTransferCost: 0,
            supportCost: 0,
            overageFees: {}
          };
          
          // Step 3: Calculate usage overages
          // API Calls overage
          if (usageData.apiCalls > pricingPlan.includedApiCalls) {
            const overageApiCalls = usageData.apiCalls - pricingPlan.includedApiCalls;
            costBreakdown.apiCallsCost = overageApiCalls * pricingPlan.apiCostPerCall;
            totalCost += costBreakdown.apiCallsCost;
            costBreakdown.overageFees['apiCalls'] = {
              included: pricingPlan.includedApiCalls,
              used: usageData.apiCalls,
              overage: overageApiCalls,
              cost: costBreakdown.apiCallsCost
            };
          }
          
          // Compute Units overage  
          if (usageData.computeUnits > pricingPlan.includedCompute) {
            const overageCompute = usageData.computeUnits - pricingPlan.includedCompute;
            costBreakdown.computeCost = overageCompute * pricingPlan.computeCostPerUnit;
            totalCost += costBreakdown.computeCost;
            costBreakdown.overageFees['computeUnits'] = {
              included: pricingPlan.includedCompute,
              used: usageData.computeUnits,
              overage: overageCompute,
              cost: costBreakdown.computeCost
            };
          }
          
          // Storage overage
          if (usageData.storageUsed > pricingPlan.includedStorage) {
            const overageStorage = usageData.storageUsed - pricingPlan.includedStorage;
            costBreakdown.storageCost = overageStorage * pricingPlan.storageCostPerGB;
            totalCost += costBreakdown.storageCost;
            costBreakdown.overageFees['storage'] = {
              included: pricingPlan.includedStorage,
              used: usageData.storageUsed,
              overage: overageStorage,
              cost: costBreakdown.storageCost
            };
          }
          
          // Data Transfer (always charged)
          costBreakdown.dataTransferCost = usageData.dataTransfer * pricingPlan.dataTransferCostPerGB;
          totalCost += costBreakdown.dataTransferCost;
          
          // Step 4: Calculate taxes and fees (simplified)
          const taxRate = 0.08; // 8% tax
          const taxAmount = totalCost * taxRate;
          const finalTotal = totalCost + taxAmount;
          
          // Step 5: Generate billing record
          const billingRecord = {
            invoiceId: `INV-${Date.now()}-${usageData.tenantId.substring(0, 8)}`,
            tenantId: usageData.tenantId,
            billingPeriod,
            pricingPlan: pricingPlan.name,
            usageData,
            costBreakdown,
            subtotal: totalCost,
            taxAmount,
            totalAmount: finalTotal,
            currency: 'USD',
            status: 'GENERATED',
            generatedAt: Date.now(),
            dueDate: billingPeriod.endDate.getTime() + (30 * 24 * 60 * 60 * 1000), // 30 days
            paymentTerms: '30 days net'
          };
          
          // Step 6: Store billing record
          tenantMetrics.billingData.set(usageData.tenantId, billingRecord);
          
          // Step 7: Generate usage summary for tenant
          const usageSummary = {
            tenantId: usageData.tenantId,
            period: `${billingPeriod.startDate.toISOString().split('T')[0]} to ${billingPeriod.endDate.toISOString().split('T')[0]}`,
            planUtilization: {
              apiCalls: (usageData.apiCalls / pricingPlan.includedApiCalls) * 100,
              computeUnits: (usageData.computeUnits / pricingPlan.includedCompute) * 100,
              storage: (usageData.storageUsed / pricingPlan.includedStorage) * 100
            },
            costEfficiency: {
              averageCostPerApiCall: usageData.apiCalls > 0 ? finalTotal / usageData.apiCalls : 0,
              averageCostPerComputeUnit: usageData.computeUnits > 0 ? finalTotal / usageData.computeUnits : 0,
              costPerActiveUser: usageData.activeUsers > 0 ? finalTotal / usageData.activeUsers : 0
            }
          };
          
          return {
            billingRecord,
            usageSummary,
            recommendations: generateBillingRecommendations(billingRecord, usageSummary)
          };
        }
      });
      
      // Helper function for billing recommendations
      function generateBillingRecommendations(billingRecord: any, usageSummary: any): any[] {
        const recommendations = [];
        
        // Check for plan optimization opportunities
        if (usageSummary.planUtilization.apiCalls > 150) {
          recommendations.push({
            type: 'PLAN_UPGRADE',
            message: 'Consider upgrading to a higher tier plan to reduce API overage costs',
            estimatedSavings: billingRecord.costBreakdown.apiCallsCost * 0.3
          });
        }
        
        if (usageSummary.planUtilization.computeUnits < 50) {
          recommendations.push({
            type: 'PLAN_DOWNGRADE',
            message: 'You may benefit from a lower tier plan based on current usage',
            estimatedSavings: billingRecord.costBreakdown.baseCost * 0.2
          });
        }
        
        if (usageSummary.costEfficiency.costPerActiveUser > 50) {
          recommendations.push({
            type: 'USAGE_OPTIMIZATION',
            message: 'High cost per user - consider optimizing API usage patterns',
            optimization: 'API_CACHING'
          });
        }
        
        return recommendations;
      }

      describe('When generating monthly billing for enterprise tenants', () => {
        it('Then should calculate accurate usage-based charges with tier pricing', async () => {
          // Setup a test tenant with usage data
          const testTenantId = crypto.randomUUID();
          saasContext.memo!.currentTenantId = testTenantId;
          
          // Simulate usage over the month
          tenantMetrics.resourceConsumption.set(testTenantId, {
            computeUnits: 15000,  // Over the 10K limit
            storageUsed: 1200,    // Over the 1TB limit  
            apiCalls: 1500000,    // Over the 1M limit
            dataTransfer: 8000    // 8TB transfer
          });
          
          const billingRequest = {
            billingPeriod: {
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              billingCycle: 'MONTHLY' as const
            },
            pricingPlan: {
              name: 'Enterprise Plus',
              baseCost: 5000,     // $5000/month base
              includedApiCalls: 1000000,  // 1M included
              includedCompute: 10000,     // 10K compute units
              includedStorage: 1000,      // 1TB included
              apiCostPerCall: 0.001,      // $0.001 per API call
              computeCostPerUnit: 0.10,   // $0.10 per compute unit
              storageCostPerGB: 0.50,     // $0.50 per GB
              dataTransferCostPerGB: 0.12, // $0.12 per GB
              supportIncluded: true,
              slaLevel: 'ENTERPRISE' as const
            },
            usageData: {
              tenantId: testTenantId,
              apiCalls: 1500000,
              computeUnits: 15000,
              storageUsed: 1200,
              dataTransfer: 8000,
              activeUsers: 500,
              integrations: 25
            }
          };
          
          const result = await usageBillingTask.call(billingRequest, saasContext);
          
          // Billing calculation validation
          expect(result.billingRecord.invoiceId).toContain('INV-');
          expect(result.billingRecord.tenantId).toBe(testTenantId);
          expect(result.billingRecord.pricingPlan).toBe('Enterprise Plus');
          
          // Cost breakdown validation
          const breakdown = result.billingRecord.costBreakdown;
          expect(breakdown.baseCost).toBe(5000);
          expect(breakdown.apiCallsCost).toBe(500); // 500K overage * $0.001
          expect(breakdown.computeCost).toBe(500);  // 5K overage * $0.10
          expect(breakdown.storageCost).toBe(100);  // 200GB overage * $0.50
          expect(breakdown.dataTransferCost).toBe(960); // 8TB * $0.12
          
          // Total calculation validation
          const expectedSubtotal = 5000 + 500 + 500 + 100 + 960; // $7060
          expect(result.billingRecord.subtotal).toBe(expectedSubtotal);
          expect(result.billingRecord.taxAmount).toBe(expectedSubtotal * 0.08);
          expect(result.billingRecord.totalAmount).toBe(expectedSubtotal * 1.08);
          
          // Usage summary validation
          expect(result.usageSummary.planUtilization.apiCalls).toBe(150); // 150% utilization
          expect(result.usageSummary.planUtilization.computeUnits).toBe(150);
          expect(result.usageSummary.planUtilization.storage).toBe(120);
          
          // Cost efficiency metrics
          expect(result.usageSummary.costEfficiency.costPerActiveUser).toBeCloseTo(15.4, 1); // ~$15.40 per user
          
          // Billing audit trail
          const billingEvents = billingAuditTrail.filter(e => 
            e.event === 'TENANT_OPERATION_COMPLETED' && e.tenantId === testTenantId
          );
          expect(billingEvents.length).toBeGreaterThan(0);
        });
        
        it('Then should provide cost optimization recommendations', async () => {
          const optimizationTenantId = crypto.randomUUID();
          saasContext.memo!.currentTenantId = optimizationTenantId;
          
          const lowUsageBillingRequest = {
            billingPeriod: {
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              billingCycle: 'MONTHLY' as const
            },
            pricingPlan: {
              name: 'Enterprise',
              baseCost: 2000,
              includedApiCalls: 500000,
              includedCompute: 5000,
              includedStorage: 500,
              apiCostPerCall: 0.002,
              computeCostPerUnit: 0.15,
              storageCostPerGB: 0.60,
              dataTransferCostPerGB: 0.15,
              supportIncluded: true,
              slaLevel: 'PREMIUM' as const
            },
            usageData: {
              tenantId: optimizationTenantId,
              apiCalls: 200000,  // Under limit - only 40% utilization
              computeUnits: 2000, // Under limit - only 40% utilization  
              storageUsed: 150,   // Under limit - only 30% utilization
              dataTransfer: 500,
              activeUsers: 50,    // Low user count
              integrations: 5
            }
          };
          
          const result = await usageBillingTask.call(lowUsageBillingRequest, saasContext);
          
          // Low utilization should trigger downgrade recommendations
          expect(result.recommendations).toBeDefined();
          expect(result.recommendations.length).toBeGreaterThan(0);
          
          const downgradRecommendation = result.recommendations.find(r => r.type === 'PLAN_DOWNGRADE');
          expect(downgradRecommendation).toBeDefined();
          expect(downgradRecommendation.estimatedSavings).toBeGreaterThan(0);
          
          // Usage efficiency validation
          expect(result.usageSummary.planUtilization.apiCalls).toBe(40); // 40% utilization
          expect(result.usageSummary.planUtilization.computeUnits).toBe(40);
          expect(result.usageSummary.planUtilization.storage).toBe(30);
          
          // Should have minimal overage costs
          expect(result.billingRecord.costBreakdown.apiCallsCost).toBe(0);
          expect(result.billingRecord.costBreakdown.computeCost).toBe(0);
          expect(result.billingRecord.costBreakdown.storageCost).toBe(0);
        });
      });
    });
  });

  // ============= TENANT ANALYTICS & INSIGHTS =============
  
  describe('Tenant Analytics & Insights', () => {
    describe('Given a Fortune 500 SaaS platform requiring tenant analytics', () => {
      
      const TenantAnalyticsSchema = z.object({
        analyticsRequest: z.object({
          tenantId: z.string().uuid(),
          timeRange: z.object({
            startDate: z.coerce.date(),
            endDate: z.coerce.date(),
            granularity: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'])
          }),
          metrics: z.array(z.enum([
            'USER_ACTIVITY', 'API_USAGE', 'FEATURE_ADOPTION', 
            'PERFORMANCE', 'ERRORS', 'BILLING', 'SUPPORT_TICKETS'
          ])),
          benchmarking: z.boolean(),
          predictiveAnalytics: z.boolean()
        }),
        comparisonGroup: z.object({
          industry: z.string().optional(),
          tenantTier: z.string().optional(),
          region: z.string().optional(),
          companySize: z.string().optional()
        }).optional()
      });
      
      const tenantAnalyticsTask = cittyPro.defineTask({
        id: 'tenant-analytics-engine',
        run: async (analyticsRequest, ctx) => {
          const { analyticsRequest: request, comparisonGroup } = analyticsRequest;
          
          // Get tenant information
          const tenant = tenantRegistry.getTenant(request.tenantId);
          if (!tenant) {
            throw new Error(`Tenant ${request.tenantId} not found`);
          }
          
          const usage = tenantMetrics.getTenantUsage(request.tenantId);
          const billing = tenantMetrics.billingData.get(request.tenantId);
          
          // Generate time-series data based on granularity
          const timeSeries = generateTimeSeriesData(request.timeRange, request.granularity);
          
          const analytics = {
            tenantId: request.tenantId,
            organizationName: tenant.organizationName,
            tier: tenant.tier,
            timeRange: request.timeRange,
            generatedAt: Date.now(),
            metrics: {}
          };
          
          // Generate requested metrics
          if (request.metrics.includes('USER_ACTIVITY')) {
            analytics.metrics.userActivity = {
              totalUsers: 500 + Math.random() * 1000,
              activeUsers: 300 + Math.random() * 400,
              newUsers: 20 + Math.random() * 50,
              userRetention: 0.85 + Math.random() * 0.1,
              sessionDuration: 45 + Math.random() * 30, // minutes
              timeSeries: timeSeries.map(t => ({
                timestamp: t,
                activeUsers: 200 + Math.random() * 300,
                sessions: 100 + Math.random() * 200
              }))
            };
          }
          
          if (request.metrics.includes('API_USAGE')) {
            analytics.metrics.apiUsage = {
              totalCalls: usage.apiCalls,
              averageLatency: 85 + Math.random() * 30, // ms
              errorRate: Math.random() * 0.02, // 0-2%
              peakRps: 150 + Math.random() * 100,
              topEndpoints: [
                { endpoint: '/api/v1/users', calls: usage.apiCalls * 0.3, avgLatency: 50 },
                { endpoint: '/api/v1/data', calls: usage.apiCalls * 0.25, avgLatency: 120 },
                { endpoint: '/api/v1/reports', calls: usage.apiCalls * 0.2, avgLatency: 200 }
              ],
              timeSeries: timeSeries.map(t => ({
                timestamp: t,
                calls: Math.floor(usage.apiCalls / timeSeries.length * (0.8 + Math.random() * 0.4)),
                latency: 70 + Math.random() * 40,
                errors: Math.random() * 10
              }))
            };
          }
          
          if (request.metrics.includes('PERFORMANCE')) {
            analytics.metrics.performance = {
              uptimePercentage: 99.5 + Math.random() * 0.49,
              averageResponseTime: 90 + Math.random() * 60,
              throughput: usage.apiCalls / 30 / 24 / 60, // per minute average
              resourceUtilization: {
                cpu: 45 + Math.random() * 30,
                memory: 60 + Math.random() * 25,
                storage: (usage.storageUsed / tenant.resourceQuotas.storageUsed) * 100
              },
              slaCompliance: {
                uptime: 99.8 + Math.random() * 0.19,
                responseTime: 95 + Math.random() * 4,
                availability: 99.9 + Math.random() * 0.09
              }
            };
          }
          
          if (request.metrics.includes('BILLING')) {
            analytics.metrics.billing = {
              currentMonthCost: billing?.totalAmount || 5000 + Math.random() * 10000,
              projectedMonthlyCost: (billing?.totalAmount || 5000) * 1.1,
              costTrend: 'INCREASING', // Simplified
              topCostDrivers: [
                { category: 'API Calls', cost: 2000, percentage: 40 },
                { category: 'Compute', cost: 1500, percentage: 30 },
                { category: 'Storage', cost: 1000, percentage: 20 },
                { category: 'Data Transfer', cost: 500, percentage: 10 }
              ],
              utilizationEfficiency: {
                apiCalls: Math.min(100, (usage.apiCalls / tenant.resourceQuotas.apiCalls) * 100),
                storage: Math.min(100, (usage.storageUsed / tenant.resourceQuotas.storageUsed) * 100),
                compute: Math.min(100, (usage.computeUnits / tenant.resourceQuotas.computeUnits) * 100)
              }
            };
          }
          
          // Add benchmarking if requested
          if (request.benchmarking && comparisonGroup) {
            analytics.benchmarking = generateBenchmarkingData(analytics, tenant, comparisonGroup);
          }
          
          // Add predictive analytics if requested
          if (request.predictiveAnalytics) {
            analytics.predictions = generatePredictiveAnalytics(analytics, tenant, timeSeries);
          }
          
          // Generate insights and recommendations
          analytics.insights = generateTenantInsights(analytics, tenant, usage);
          
          return analytics;
        }
      });
      
      // Helper functions
      function generateTimeSeriesData(timeRange: any, granularity: string): number[] {
        const start = new Date(timeRange.startDate).getTime();
        const end = new Date(timeRange.endDate).getTime();
        const intervals = [];
        
        let intervalMs;
        switch (granularity) {
          case 'HOURLY': intervalMs = 60 * 60 * 1000; break;
          case 'DAILY': intervalMs = 24 * 60 * 60 * 1000; break;
          case 'WEEKLY': intervalMs = 7 * 24 * 60 * 60 * 1000; break;
          case 'MONTHLY': intervalMs = 30 * 24 * 60 * 60 * 1000; break;
          default: intervalMs = 24 * 60 * 60 * 1000;
        }
        
        for (let time = start; time <= end; time += intervalMs) {
          intervals.push(time);
        }
        
        return intervals;
      }
      
      function generateBenchmarkingData(analytics: any, tenant: any, comparisonGroup: any): any {
        return {
          industry: comparisonGroup.industry || 'Technology',
          comparisonMetrics: {
            userActivity: {
              yourTenant: analytics.metrics.userActivity?.activeUsers || 500,
              industryAverage: 750,
              percentile: 65
            },
            apiUsage: {
              yourTenant: analytics.metrics.apiUsage?.averageLatency || 100,
              industryAverage: 120,
              percentile: 75
            },
            performance: {
              yourTenant: analytics.metrics.performance?.uptimePercentage || 99.5,
              industryAverage: 99.2,
              percentile: 80
            }
          },
          recommendations: [
            {
              metric: 'User Engagement',
              status: 'BELOW_AVERAGE',
              suggestion: 'Consider implementing user onboarding improvements',
              impact: 'HIGH'
            }
          ]
        };
      }
      
      function generatePredictiveAnalytics(analytics: any, tenant: any, timeSeries: number[]): any {
        return {
          nextMonthPredictions: {
            userGrowth: {
              predicted: (analytics.metrics.userActivity?.totalUsers || 500) * 1.15,
              confidence: 0.85,
              trend: 'INCREASING'
            },
            apiUsage: {
              predicted: (analytics.metrics.apiUsage?.totalCalls || 100000) * 1.2,
              confidence: 0.78,
              trend: 'INCREASING'
            },
            costs: {
              predicted: (analytics.metrics.billing?.currentMonthCost || 5000) * 1.18,
              confidence: 0.92,
              trend: 'INCREASING'
            }
          },
          alerts: [
            {
              type: 'COST_SPIKE_RISK',
              probability: 0.3,
              description: 'API usage trending upward may cause unexpected costs',
              recommendedAction: 'Review API usage patterns and consider optimization'
            }
          ]
        };
      }
      
      function generateTenantInsights(analytics: any, tenant: any, usage: any): any[] {
        const insights = [];
        
        if (analytics.metrics.billing?.utilizationEfficiency?.apiCalls < 50) {
          insights.push({
            type: 'UNDERUTILIZATION',
            category: 'API_CALLS',
            description: 'API call utilization is below 50% - consider downgrading plan',
            impact: 'COST_SAVINGS',
            estimatedSavings: 1000
          });
        }
        
        if (analytics.metrics.performance?.slaCompliance?.uptime < 99.5) {
          insights.push({
            type: 'SLA_RISK',
            category: 'UPTIME',
            description: 'Uptime below SLA threshold - infrastructure review recommended',
            impact: 'RELIABILITY',
            urgency: 'HIGH'
          });
        }
        
        if (analytics.metrics.userActivity?.userRetention < 0.8) {
          insights.push({
            type: 'USER_RETENTION',
            category: 'ENGAGEMENT',
            description: 'User retention below optimal levels - consider engagement programs',
            impact: 'GROWTH',
            urgency: 'MEDIUM'
          });
        }
        
        return insights;
      }

      describe('When generating comprehensive tenant analytics', () => {
        it('Then should provide detailed usage insights with benchmarking', async () => {
          // Setup test tenant with analytics data
          const analyticsTenantId = crypto.randomUUID();
          tenantRegistry.registerTenant(analyticsTenantId, {
            organizationName: 'Analytics Test Corp',
            tier: 'ENTERPRISE',
            region: 'US_EAST',
            resourceQuotas: {
              apiCalls: 1000000,
              storageUsed: 500,
              computeUnits: 5000
            }
          });
          
          tenantMetrics.resourceConsumption.set(analyticsTenantId, {
            apiCalls: 750000,
            storageUsed: 300,
            computeUnits: 3500,
            dataTransfer: 1000
          });
          
          saasContext.memo!.currentTenantId = analyticsTenantId;
          
          const analyticsRequest = {
            analyticsRequest: {
              tenantId: analyticsTenantId,
              timeRange: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                granularity: 'DAILY' as const
              },
              metrics: ['USER_ACTIVITY', 'API_USAGE', 'PERFORMANCE', 'BILLING'] as const,
              benchmarking: true,
              predictiveAnalytics: true
            },
            comparisonGroup: {
              industry: 'Technology',
              tenantTier: 'ENTERPRISE',
              region: 'US_EAST',
              companySize: 'LARGE'
            }
          };
          
          const result = await tenantAnalyticsTask.call(analyticsRequest, saasContext);
          
          // Analytics validation
          expect(result.tenantId).toBe(analyticsTenantId);
          expect(result.organizationName).toBe('Analytics Test Corp');
          expect(result.tier).toBe('ENTERPRISE');
          
          // Metrics validation
          expect(result.metrics.userActivity).toBeDefined();
          expect(result.metrics.userActivity.totalUsers).toBeGreaterThan(500);
          expect(result.metrics.userActivity.timeSeries).toHaveLength(31); // Daily data for January
          
          expect(result.metrics.apiUsage).toBeDefined();
          expect(result.metrics.apiUsage.totalCalls).toBe(750000);
          expect(result.metrics.apiUsage.topEndpoints).toHaveLength(3);
          
          expect(result.metrics.performance).toBeDefined();
          expect(result.metrics.performance.uptimePercentage).toBeGreaterThan(99);
          expect(result.metrics.performance.slaCompliance).toBeDefined();
          
          expect(result.metrics.billing).toBeDefined();
          expect(result.metrics.billing.utilizationEfficiency.apiCalls).toBeCloseTo(75, 0); // 75% utilization
          
          // Benchmarking validation
          expect(result.benchmarking).toBeDefined();
          expect(result.benchmarking.industry).toBe('Technology');
          expect(result.benchmarking.comparisonMetrics).toBeDefined();
          
          // Predictive analytics validation
          expect(result.predictions).toBeDefined();
          expect(result.predictions.nextMonthPredictions).toBeDefined();
          expect(result.predictions.alerts).toBeDefined();
          
          // Insights validation
          expect(result.insights).toBeDefined();
          expect(Array.isArray(result.insights)).toBe(true);
          
          // Tenant activity tracking
          const analyticsEvents = billingAuditTrail.filter(e => 
            e.event === 'TENANT_OPERATION_COMPLETED' && e.tenantId === analyticsTenantId
          );
          expect(analyticsEvents.length).toBeGreaterThan(0);
        });
        
        it('Then should identify optimization opportunities and provide actionable recommendations', async () => {
          const optimizationTenantId = crypto.randomUUID();
          tenantRegistry.registerTenant(optimizationTenantId, {
            organizationName: 'Optimization Corp',
            tier: 'PROFESSIONAL',
            region: 'EU_WEST',
            resourceQuotas: {
              apiCalls: 500000,
              storageUsed: 250,
              computeUnits: 2500
            }
          });
          
          // Low utilization scenario
          tenantMetrics.resourceConsumption.set(optimizationTenantId, {
            apiCalls: 100000, // Only 20% utilization
            storageUsed: 50,   // Only 20% utilization
            computeUnits: 500, // Only 20% utilization
            dataTransfer: 200
          });
          
          saasContext.memo!.currentTenantId = optimizationTenantId;
          
          const optimizationRequest = {
            analyticsRequest: {
              tenantId: optimizationTenantId,
              timeRange: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                granularity: 'WEEKLY' as const
              },
              metrics: ['API_USAGE', 'BILLING'] as const,
              benchmarking: false,
              predictiveAnalytics: true
            }
          };
          
          const result = await tenantAnalyticsTask.call(optimizationRequest, saasContext);
          
          // Low utilization should trigger insights
          expect(result.insights).toBeDefined();
          expect(result.insights.length).toBeGreaterThan(0);
          
          const underutilizationInsight = result.insights.find(i => i.type === 'UNDERUTILIZATION');
          expect(underutilizationInsight).toBeDefined();
          expect(underutilizationInsight.impact).toBe('COST_SAVINGS');
          expect(underutilizationInsight.estimatedSavings).toBeGreaterThan(0);
          
          // Billing efficiency should show low utilization
          expect(result.metrics.billing.utilizationEfficiency.apiCalls).toBe(20);
          expect(result.metrics.billing.utilizationEfficiency.storage).toBe(20);
          expect(result.metrics.billing.utilizationEfficiency.compute).toBe(20);
          
          // Predictions should account for low usage
          expect(result.predictions.nextMonthPredictions).toBeDefined();
          expect(result.predictions.alerts).toBeDefined();
        });
      });
    });
  });
});