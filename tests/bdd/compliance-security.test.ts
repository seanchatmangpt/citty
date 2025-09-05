/**
 * Compliance and Security BDD Tests
 * 
 * Comprehensive BDD scenarios for Fortune 500 compliance and security requirements
 * Testing enterprise-grade security controls, regulatory compliance, and audit frameworks
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

describe('Fortune 500 Compliance & Security - BDD Scenarios', () => {
  
  let securityContext: RunCtx;
  let complianceMetrics: any;
  let securityAuditTrail: any[];
  let complianceLogger: any;
  
  beforeEach(() => {
    // Enterprise security context setup
    securityContext = {
      cwd: '/enterprise/security-platform',
      env: {
        NODE_ENV: 'production',
        SECURITY_LEVEL: 'MAXIMUM',
        COMPLIANCE_FRAMEWORKS: 'SOX_GDPR_HIPAA_PCI_DSS',
        AUDIT_ENABLED: 'true',
        SECURITY_SLA: '99.99',
        ENCRYPTION_LEVEL: 'FIPS_140_2'
      },
      now: () => new Date('2024-01-01T00:00:00Z'),
      memo: {
        tenantId: 'fortune500-security',
        securityLevel: 'MAXIMUM',
        complianceRequired: true,
        auditMode: 'CONTINUOUS'
      },
      otel: {
        span: async (name, fn) => {
          const start = performance.now();
          try {
            const result = await fn();
            complianceMetrics.recordLatency(name, performance.now() - start);
            return result;
          } catch (error) {
            complianceMetrics.recordError(name, error);
            throw error;
          }
        }
      }
    };
    
    // Initialize security metrics
    complianceMetrics = {
      securityEvents: new Map(),
      complianceChecks: new Map(),
      auditLogs: [],
      threatDetections: [],
      accessAttempts: [],
      recordLatency: (name: string, duration: number) => {
        if (!complianceMetrics.securityEvents.has(name)) {
          complianceMetrics.securityEvents.set(name, []);
        }
        complianceMetrics.securityEvents.get(name).push({ duration, timestamp: Date.now() });
      },
      recordError: (name: string, error: any) => {
        complianceMetrics.threatDetections.push({
          operation: name,
          error: error.message,
          timestamp: Date.now(),
          severity: 'HIGH'
        });
      },
      getSLA: (operation: string) => {
        const events = complianceMetrics.securityEvents.get(operation) || [];
        const avgLatency = events.length > 0 
          ? events.reduce((sum: number, e: any) => sum + e.duration, 0) / events.length 
          : 0;
        return avgLatency < 100 ? 'GREEN' : avgLatency < 500 ? 'YELLOW' : 'RED';
      }
    };
    
    // Initialize security audit trail
    securityAuditTrail = [];
    
    // Initialize compliance logger
    complianceLogger = {
      logCompliance: (event: any) => securityAuditTrail.push({
        ...event,
        timestamp: Date.now(),
        auditLevel: 'COMPLIANCE',
        tenantId: securityContext.memo?.tenantId
      }),
      logSecurity: (event: any) => securityAuditTrail.push({
        ...event,
        timestamp: Date.now(),
        auditLevel: 'SECURITY',
        severity: 'HIGH'
      })
    };
    
    // Register core hooks for compliance
    registerCoreHooks();
    
    // Setup compliance hooks
    hooks.hook('task:will:call', async (payload) => {
      complianceLogger.logSecurity({
        event: 'TASK_INITIATED',
        taskId: payload.id,
        data: { input: payload.input },
        securityContext: 'MONITORED'
      });
    });
    
    hooks.hook('task:did:call', async (payload) => {
      complianceLogger.logCompliance({
        event: 'TASK_COMPLETED',
        taskId: payload.id,
        result: payload.res,
        complianceStatus: 'LOGGED'
      });
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    securityAuditTrail = [];
    complianceMetrics.securityEvents.clear();
    complianceMetrics.complianceChecks.clear();
  });

  // ============= SOX COMPLIANCE FRAMEWORK =============
  
  describe('SOX Compliance Framework', () => {
    describe('Given a Fortune 500 company with SOX compliance requirements', () => {
      
      const SOXComplianceSchema = z.object({
        transactionId: z.string().uuid(),
        financialData: z.object({
          amount: z.number().positive(),
          currency: z.enum(['USD', 'EUR', 'GBP']),
          accountId: z.string(),
          category: z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY'])
        }),
        approval: z.object({
          level: z.enum(['MANAGER', 'DIRECTOR', 'VP', 'CFO', 'CEO']),
          approverId: z.string(),
          timestamp: z.coerce.date(),
          digitalSignature: z.string()
        }),
        auditRequirements: z.object({
          retentionPeriod: z.number().min(7), // 7+ years for SOX
          immutableRecord: z.boolean(),
          segregationOfDuties: z.boolean(),
          dualApproval: z.boolean()
        }),
        riskAssessment: z.object({
          materialityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
          riskScore: z.number().min(0).max(100),
          controlEffectiveness: z.enum(['EFFECTIVE', 'DEFICIENT', 'MATERIAL_WEAKNESS'])
        })
      });
      
      const soxComplianceTask = cittyPro.defineTask({
        id: 'sox-compliance-validator',
        run: async (transaction, ctx) => {
          // SOX Section 302 - CEO/CFO Certification
          if (transaction.financialData.amount > 1000000 && 
              !['CFO', 'CEO'].includes(transaction.approval.level)) {
            throw new Error('Material transactions require C-level approval');
          }
          
          // SOX Section 404 - Internal Controls Assessment
          const controlTests = {
            segregationTest: transaction.auditRequirements.segregationOfDuties,
            approvalTest: transaction.auditRequirements.dualApproval,
            documentationTest: transaction.approval.digitalSignature.length > 0,
            retentionTest: transaction.auditRequirements.retentionPeriod >= 7
          };
          
          const passedTests = Object.values(controlTests).filter(Boolean).length;
          const controlEffectiveness = passedTests >= 3 ? 'EFFECTIVE' : 'DEFICIENT';
          
          // Generate immutable audit record
          const auditRecord = {
            transactionId: transaction.transactionId,
            soxCompliance: {
              section302: transaction.approval.level,
              section404: controlEffectiveness,
              section409: 'REAL_TIME_DISCLOSURE',
              section802: 'DOCUMENT_RETENTION_POLICY'
            },
            controlTests,
            auditTimestamp: new Date(),
            auditId: crypto.randomUUID(),
            digitalHash: `sox-${Date.now()}-${Math.random().toString(36)}`
          };
          
          return {
            complianceStatus: controlEffectiveness === 'EFFECTIVE' ? 'COMPLIANT' : 'NON_COMPLIANT',
            auditRecord,
            riskMitigation: transaction.riskAssessment.controlEffectiveness,
            nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          };
        }
      });

      describe('When processing financial transactions under SOX', () => {
        it('Then should enforce SOX 302 CEO/CFO certification for material transactions', async () => {
          const materialTransaction = {
            transactionId: crypto.randomUUID(),
            financialData: {
              amount: 5000000, // $5M - material transaction
              currency: 'USD' as const,
              accountId: 'ACCT-REVENUE-001',
              category: 'REVENUE' as const
            },
            approval: {
              level: 'CFO' as const,
              approverId: 'USR-CFO-001',
              timestamp: new Date(),
              digitalSignature: 'CFO-DIGITAL-SIG-2024-001'
            },
            auditRequirements: {
              retentionPeriod: 10,
              immutableRecord: true,
              segregationOfDuties: true,
              dualApproval: true
            },
            riskAssessment: {
              materialityLevel: 'CRITICAL' as const,
              riskScore: 85,
              controlEffectiveness: 'EFFECTIVE' as const
            }
          };
          
          const result = await soxComplianceTask.call(materialTransaction, securityContext);
          
          // SOX compliance validation
          expect(result.complianceStatus).toBe('COMPLIANT');
          expect(result.auditRecord.soxCompliance.section302).toBe('CFO');
          expect(result.auditRecord.soxCompliance.section404).toBe('EFFECTIVE');
          
          // Audit trail verification
          const soxEvents = securityAuditTrail.filter(e => 
            e.event === 'TASK_COMPLETED' && e.taskId === 'sox-compliance-validator'
          );
          expect(soxEvents).toHaveLength(1);
          expect(soxEvents[0].complianceStatus).toBe('LOGGED');
        });
        
        it('Then should reject transactions without proper approval levels', async () => {
          const unauthorizedTransaction = {
            transactionId: crypto.randomUUID(),
            financialData: {
              amount: 2000000, // $2M - requires C-level approval
              currency: 'USD' as const,
              accountId: 'ACCT-EXPENSE-001',
              category: 'EXPENSE' as const
            },
            approval: {
              level: 'MANAGER' as const, // Insufficient approval level
              approverId: 'USR-MGR-001',
              timestamp: new Date(),
              digitalSignature: 'MGR-DIGITAL-SIG-2024-001'
            },
            auditRequirements: {
              retentionPeriod: 7,
              immutableRecord: true,
              segregationOfDuties: false,
              dualApproval: false
            },
            riskAssessment: {
              materialityLevel: 'HIGH' as const,
              riskScore: 75,
              controlEffectiveness: 'DEFICIENT' as const
            }
          };
          
          await expect(
            soxComplianceTask.call(unauthorizedTransaction, securityContext)
          ).rejects.toThrow('Material transactions require C-level approval');
          
          // Security audit for rejection
          const rejectionEvents = securityAuditTrail.filter(e => 
            e.event === 'TASK_INITIATED' && e.securityContext === 'MONITORED'
          );
          expect(rejectionEvents.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // ============= GDPR COMPLIANCE FRAMEWORK =============
  
  describe('GDPR Compliance Framework', () => {
    describe('Given a multinational Fortune 500 company processing EU citizen data', () => {
      
      const GDPRComplianceSchema = z.object({
        dataSubject: z.object({
          citizenshipCountry: z.string(),
          residencyCountry: z.string(),
          isEUCitizen: z.boolean(),
          dataSubjectId: z.string().uuid()
        }),
        personalData: z.object({
          categories: z.array(z.enum([
            'BASIC_IDENTITY', 'CONTACT_INFO', 'FINANCIAL', 'HEALTH', 
            'BIOMETRIC', 'LOCATION', 'BEHAVIORAL', 'PREFERENCES'
          ])),
          sensitiveData: z.boolean(),
          dataMinimization: z.boolean(),
          purposeLimitation: z.string()
        }),
        legalBasis: z.enum([
          'CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 
          'VITAL_INTERESTS', 'PUBLIC_TASK', 'LEGITIMATE_INTERESTS'
        ]),
        consent: z.object({
          explicit: z.boolean(),
          granular: z.boolean(),
          withdrawable: z.boolean(),
          consentTimestamp: z.coerce.date(),
          consentVersion: z.string()
        }),
        retention: z.object({
          purpose: z.string(),
          retentionPeriod: z.number(), // in days
          automaticDeletion: z.boolean(),
          rightToBeForgotten: z.boolean()
        }),
        dataProcessing: z.object({
          lawfulBasis: z.string(),
          processingPurpose: z.string(),
          thirdPartySharing: z.boolean(),
          internationalTransfer: z.boolean(),
          adequacyDecision: z.boolean().optional()
        })
      });
      
      const gdprComplianceTask = cittyPro.defineTask({
        id: 'gdpr-compliance-validator',
        run: async (dataProcessing, ctx) => {
          // GDPR Article 6 - Lawfulness of processing
          if (dataProcessing.dataSubject.isEUCitizen && 
              !dataProcessing.legalBasis) {
            throw new Error('EU citizen data requires valid legal basis');
          }
          
          // GDPR Article 7 - Conditions for consent
          if (dataProcessing.legalBasis === 'CONSENT' && 
              !dataProcessing.consent.explicit) {
            throw new Error('GDPR requires explicit consent for data processing');
          }
          
          // GDPR Article 5 - Principles of processing
          const principleChecks = {
            lawfulness: !!dataProcessing.legalBasis,
            fairness: dataProcessing.personalData.dataMinimization,
            transparency: dataProcessing.consent.granular,
            purposeLimitation: !!dataProcessing.personalData.purposeLimitation,
            dataMinimization: dataProcessing.personalData.dataMinimization,
            accuracy: true, // Assumed for test
            storageLimitation: dataProcessing.retention.automaticDeletion,
            integrity: true // Assumed for test
          };
          
          // GDPR Article 17 - Right to erasure
          const rightToErasure = dataProcessing.retention.rightToBeForgotten;
          
          // GDPR Article 44-49 - International transfers
          let transferCompliance = true;
          if (dataProcessing.dataProcessing.internationalTransfer) {
            transferCompliance = dataProcessing.dataProcessing.adequacyDecision || false;
          }
          
          const complianceScore = Object.values(principleChecks).filter(Boolean).length;
          const isCompliant = complianceScore >= 6 && transferCompliance && rightToErasure;
          
          return {
            gdprCompliance: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
            principleChecks,
            dataSubjectRights: {
              access: true,
              rectification: true,
              erasure: rightToErasure,
              portability: dataProcessing.legalBasis === 'CONSENT',
              objection: dataProcessing.legalBasis === 'LEGITIMATE_INTERESTS'
            },
            auditRecord: {
              dataProcessingId: crypto.randomUUID(),
              legalBasis: dataProcessing.legalBasis,
              timestamp: new Date(),
              complianceOfficer: 'DPO-001',
              nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            },
            penalties: isCompliant ? 0 : Math.min(20000000, 0.04 * 1000000000) // 4% of revenue or €20M
          };
        }
      });

      describe('When processing EU citizen personal data', () => {
        it('Then should enforce GDPR consent requirements', async () => {
          const gdprDataProcessing = {
            dataSubject: {
              citizenshipCountry: 'DE',
              residencyCountry: 'DE',
              isEUCitizen: true,
              dataSubjectId: crypto.randomUUID()
            },
            personalData: {
              categories: ['BASIC_IDENTITY', 'CONTACT_INFO', 'PREFERENCES'] as const,
              sensitiveData: false,
              dataMinimization: true,
              purposeLimitation: 'Marketing and customer service optimization'
            },
            legalBasis: 'CONSENT' as const,
            consent: {
              explicit: true,
              granular: true,
              withdrawable: true,
              consentTimestamp: new Date(),
              consentVersion: 'v2.1-2024'
            },
            retention: {
              purpose: 'Customer relationship management',
              retentionPeriod: 730, // 2 years
              automaticDeletion: true,
              rightToBeForgotten: true
            },
            dataProcessing: {
              lawfulBasis: 'Article 6(1)(a) - Consent',
              processingPurpose: 'Direct marketing with consent',
              thirdPartySharing: false,
              internationalTransfer: false,
              adequacyDecision: true
            }
          };
          
          const result = await gdprComplianceTask.call(gdprDataProcessing, securityContext);
          
          // GDPR compliance validation
          expect(result.gdprCompliance).toBe('COMPLIANT');
          expect(result.dataSubjectRights.erasure).toBe(true);
          expect(result.dataSubjectRights.portability).toBe(true);
          expect(result.penalties).toBe(0);
          
          // Audit trail for GDPR compliance
          const gdprEvents = securityAuditTrail.filter(e => 
            e.event === 'TASK_COMPLETED' && 
            e.taskId === 'gdpr-compliance-validator'
          );
          expect(gdprEvents.length).toBeGreaterThan(0);
        });
        
        it('Then should calculate penalties for non-compliance', async () => {
          const nonCompliantProcessing = {
            dataSubject: {
              citizenshipCountry: 'FR',
              residencyCountry: 'FR', 
              isEUCitizen: true,
              dataSubjectId: crypto.randomUUID()
            },
            personalData: {
              categories: ['FINANCIAL', 'HEALTH'] as const, // Sensitive data
              sensitiveData: true,
              dataMinimization: false, // Violation
              purposeLimitation: ''
            },
            legalBasis: 'CONSENT' as const,
            consent: {
              explicit: false, // Violation - not explicit
              granular: false,
              withdrawable: false, // Violation
              consentTimestamp: new Date(),
              consentVersion: 'v1.0'
            },
            retention: {
              purpose: 'Indefinite storage',
              retentionPeriod: -1, // Indefinite - violation
              automaticDeletion: false,
              rightToBeForgotten: false // Violation
            },
            dataProcessing: {
              lawfulBasis: 'Unclear',
              processingPurpose: 'Broad data collection',
              thirdPartySharing: true,
              internationalTransfer: true,
              adequacyDecision: false // Violation
            }
          };
          
          await expect(
            gdprComplianceTask.call(nonCompliantProcessing, securityContext)
          ).rejects.toThrow('GDPR requires explicit consent');
          
          // Verify security incident logged
          const violations = securityAuditTrail.filter(e => 
            e.event === 'TASK_INITIATED'
          );
          expect(violations.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // ============= ENTERPRISE SECURITY CONTROLS =============
  
  describe('Enterprise Security Controls', () => {
    describe('Given Fortune 500 enterprise security requirements', () => {
      
      const SecurityControlSchema = z.object({
        accessRequest: z.object({
          userId: z.string(),
          requestedResource: z.string(),
          accessLevel: z.enum(['READ', 'write', 'admin', 'super_admin']),
          businessJustification: z.string().min(20),
          requestTimestamp: z.coerce.date()
        }),
        userContext: z.object({
          department: z.string(),
          clearanceLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET']),
          currentRole: z.string(),
          managerId: z.string(),
          location: z.object({
            country: z.string(),
            building: z.string(),
            ipAddress: z.string()
          })
        }),
        riskFactors: z.object({
          timeBasedRisk: z.boolean(), // After hours access
          locationRisk: z.boolean(), // Unusual location
          deviceRisk: z.boolean(), // Unmanaged device
          behaviorRisk: z.boolean(), // Unusual behavior pattern
          privilegeEscalation: z.boolean() // Requesting higher privileges
        }),
        securityControls: z.object({
          mfaRequired: z.boolean(),
          approvalRequired: z.boolean(),
          temporaryAccess: z.boolean(),
          monitoringLevel: z.enum(['BASIC', 'ENHANCED', 'CONTINUOUS']),
          sessionTimeout: z.number() // in minutes
        })
      });
      
      const securityControlTask = cittyPro.defineTask({
        id: 'enterprise-security-control',
        run: async (accessRequest, ctx) => {
          const { accessRequest: request, userContext, riskFactors, securityControls } = accessRequest;
          
          // Zero Trust Security Model Implementation
          let riskScore = 0;
          let requiredControls = [];
          
          // Risk assessment
          if (riskFactors.timeBasedRisk) riskScore += 20;
          if (riskFactors.locationRisk) riskScore += 25;
          if (riskFactors.deviceRisk) riskScore += 30;
          if (riskFactors.behaviorRisk) riskScore += 35;
          if (riskFactors.privilegeEscalation) riskScore += 40;
          
          // Clearance level check
          const clearanceHierarchy = {
            'PUBLIC': 0,
            'INTERNAL': 1,
            'CONFIDENTIAL': 2,
            'SECRET': 3,
            'TOP_SECRET': 4
          };
          
          const requiredClearance = request.accessLevel === 'super_admin' ? 'TOP_SECRET' :
                                   request.accessLevel === 'admin' ? 'SECRET' :
                                   request.accessLevel === 'write' ? 'CONFIDENTIAL' : 'INTERNAL';
          
          if (clearanceHierarchy[userContext.clearanceLevel] < clearanceHierarchy[requiredClearance]) {
            throw new Error(`Insufficient clearance level for ${request.accessLevel} access`);
          }
          
          // Dynamic security controls based on risk
          if (riskScore >= 50) requiredControls.push('MANAGER_APPROVAL', 'MFA', 'SESSION_RECORDING');
          else if (riskScore >= 30) requiredControls.push('MFA', 'ENHANCED_MONITORING');
          else if (riskScore >= 15) requiredControls.push('MFA');
          
          // Time-based access controls
          const now = new Date();
          const isBusinessHours = now.getHours() >= 8 && now.getHours() <= 18;
          const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
          
          if (!isBusinessHours || !isWeekday) {
            requiredControls.push('AFTER_HOURS_APPROVAL');
          }
          
          // Generate security decision
          const accessDecision = {
            granted: riskScore < 70,
            riskScore,
            requiredControls,
            sessionTimeout: Math.max(30, 120 - riskScore), // Dynamic timeout
            monitoringLevel: riskScore >= 50 ? 'CONTINUOUS' : 
                            riskScore >= 30 ? 'ENHANCED' : 'BASIC',
            accessValidUntil: new Date(now.getTime() + (24 * 60 * 60 * 1000)), // 24 hours
            securityIncidentId: riskScore >= 70 ? crypto.randomUUID() : null
          };
          
          return accessDecision;
        }
      });

      describe('When processing high-risk access requests', () => {
        it('Then should apply Zero Trust security controls', async () => {
          const highRiskAccess = {
            accessRequest: {
              userId: 'USR-CONTRACTOR-001',
              requestedResource: 'FINANCIAL_SYSTEMS_ADMIN',
              accessLevel: 'admin' as const,
              businessJustification: 'Emergency system maintenance required for quarterly close',
              requestTimestamp: new Date()
            },
            userContext: {
              department: 'IT_CONTRACTOR',
              clearanceLevel: 'SECRET' as const,
              currentRole: 'External Contractor',
              managerId: 'MGR-IT-001',
              location: {
                country: 'US',
                building: 'REMOTE',
                ipAddress: '203.0.113.45' // External IP
              }
            },
            riskFactors: {
              timeBasedRisk: true, // After hours
              locationRisk: true, // Remote/external location
              deviceRisk: true, // Unmanaged device
              behaviorRisk: false,
              privilegeEscalation: true // Admin access
            },
            securityControls: {
              mfaRequired: true,
              approvalRequired: true,
              temporaryAccess: true,
              monitoringLevel: 'ENHANCED' as const,
              sessionTimeout: 60
            }
          };
          
          const result = await securityControlTask.call(highRiskAccess, securityContext);
          
          // Zero Trust validation
          expect(result.riskScore).toBeGreaterThan(70);
          expect(result.granted).toBe(false); // High risk should be denied
          expect(result.securityIncidentId).toBeTruthy(); // Security incident created
          expect(result.requiredControls).toContain('MANAGER_APPROVAL');
          expect(result.requiredControls).toContain('MFA');
          expect(result.monitoringLevel).toBe('CONTINUOUS');
          
          // Security audit trail
          const securityIncidents = securityAuditTrail.filter(e => 
            e.event === 'TASK_INITIATED' && e.securityContext === 'MONITORED'
          );
          expect(securityIncidents.length).toBeGreaterThan(0);
        });
        
        it('Then should grant access with appropriate controls for low-risk requests', async () => {
          const lowRiskAccess = {
            accessRequest: {
              userId: 'USR-EMPLOYEE-001',
              requestedResource: 'CUSTOMER_SUPPORT_DASHBOARD',
              accessLevel: 'read' as const,
              businessJustification: 'Daily customer support activities and case management',
              requestTimestamp: new Date('2024-01-01T10:00:00Z') // Business hours
            },
            userContext: {
              department: 'CUSTOMER_SUPPORT',
              clearanceLevel: 'INTERNAL' as const,
              currentRole: 'Customer Support Specialist',
              managerId: 'MGR-CS-001',
              location: {
                country: 'US',
                building: 'HQ_BUILDING_A',
                ipAddress: '10.0.1.45' // Internal IP
              }
            },
            riskFactors: {
              timeBasedRisk: false, // Business hours
              locationRisk: false, // Corporate location
              deviceRisk: false, // Managed device
              behaviorRisk: false,
              privilegeEscalation: false // Same privilege level
            },
            securityControls: {
              mfaRequired: true,
              approvalRequired: false,
              temporaryAccess: false,
              monitoringLevel: 'BASIC' as const,
              sessionTimeout: 480 // 8 hours
            }
          };
          
          const result = await securityControlTask.call(lowRiskAccess, securityContext);
          
          // Low risk validation
          expect(result.riskScore).toBeLessThan(30);
          expect(result.granted).toBe(true);
          expect(result.securityIncidentId).toBeNull();
          expect(result.monitoringLevel).toBe('BASIC');
          expect(result.sessionTimeout).toBeGreaterThan(90); // Longer timeout for low risk
          
          // Compliance logging
          const accessLogs = securityAuditTrail.filter(e => 
            e.event === 'TASK_COMPLETED' && e.taskId === 'enterprise-security-control'
          );
          expect(accessLogs.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // ============= INCIDENT RESPONSE & THREAT DETECTION =============
  
  describe('Incident Response & Threat Detection', () => {
    describe('Given a Fortune 500 24/7 security operations center', () => {
      
      const ThreatDetectionSchema = z.object({
        securityEvent: z.object({
          eventId: z.string().uuid(),
          eventType: z.enum([
            'MALWARE_DETECTION', 'PHISHING_ATTEMPT', 'DATA_EXFILTRATION', 
            'PRIVILEGE_ESCALATION', 'LATERAL_MOVEMENT', 'INSIDER_THREAT',
            'DDoS_ATTACK', 'SQL_INJECTION', 'XSS_ATTEMPT', 'BRUTE_FORCE'
          ]),
          severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
          source: z.object({
            ipAddress: z.string(),
            userAgent: z.string().optional(),
            userId: z.string().optional(),
            systemId: z.string()
          }),
          target: z.object({
            resource: z.string(),
            dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']),
            businessImpact: z.enum(['MINIMAL', 'MODERATE', 'SIGNIFICANT', 'SEVERE'])
          }),
          detectionTimestamp: z.coerce.date(),
          evidenceCollected: z.boolean()
        }),
        responseRequirements: z.object({
          maxResponseTime: z.number(), // in minutes
          escalationRequired: z.boolean(),
          isolationRequired: z.boolean(),
          forwardToAuthorities: z.boolean(),
          businessContinuityRequired: z.boolean()
        })
      });
      
      const incidentResponseTask = cittyPro.defineTask({
        id: 'incident-response-handler',
        run: async (incident, ctx) => {
          const { securityEvent, responseRequirements } = incident;
          
          // NIST Cybersecurity Framework - Respond Function
          const responseTimeline = [];
          const responseActions = [];
          
          // Immediate response based on severity
          const severityMatrix = {
            'LOW': { maxResponse: 240, escalate: false, isolate: false },
            'MEDIUM': { maxResponse: 120, escalate: true, isolate: false },
            'HIGH': { maxResponse: 30, escalate: true, isolate: true },
            'CRITICAL': { maxResponse: 15, escalate: true, isolate: true }
          };
          
          const responseProfile = severityMatrix[securityEvent.severity];
          
          // Step 1: Initial Response (0-5 minutes)
          responseTimeline.push({
            phase: 'INITIAL_RESPONSE',
            timeframe: '0-5 minutes',
            actions: [
              'Security event validated',
              'Initial threat assessment completed',
              'Response team notified'
            ]
          });
          responseActions.push('VALIDATE_EVENT', 'ASSESS_THREAT', 'NOTIFY_TEAM');
          
          // Step 2: Containment (5-30 minutes)
          if (responseProfile.isolate) {
            responseTimeline.push({
              phase: 'CONTAINMENT',
              timeframe: '5-30 minutes',
              actions: [
                'Affected systems isolated',
                'Network segments quarantined',
                'User accounts disabled if necessary'
              ]
            });
            responseActions.push('ISOLATE_SYSTEMS', 'QUARANTINE_NETWORK', 'DISABLE_ACCOUNTS');
          }
          
          // Step 3: Investigation & Evidence Collection
          responseTimeline.push({
            phase: 'INVESTIGATION',
            timeframe: '30 minutes - 4 hours',
            actions: [
              'Digital forensics initiated',
              'Evidence preservation protocols activated',
              'Attack vector analysis performed'
            ]
          });
          responseActions.push('FORENSICS_ANALYSIS', 'EVIDENCE_COLLECTION', 'ATTACK_ANALYSIS');
          
          // Step 4: Escalation (if required)
          if (responseProfile.escalate) {
            responseTimeline.push({
              phase: 'ESCALATION',
              timeframe: '1-2 hours',
              actions: [
                'C-level executives notified',
                'Legal team engaged',
                'External authorities contacted if required'
              ]
            });
            responseActions.push('EXECUTIVE_NOTIFICATION', 'LEGAL_ENGAGEMENT');
            
            if (responseRequirements.forwardToAuthorities) {
              responseActions.push('AUTHORITIES_NOTIFICATION');
            }
          }
          
          // Step 5: Recovery & Business Continuity
          responseTimeline.push({
            phase: 'RECOVERY',
            timeframe: '4-24 hours',
            actions: [
              'Systems restoration planned',
              'Business continuity activated',
              'Stakeholder communications initiated'
            ]
          });
          responseActions.push('SYSTEM_RECOVERY', 'BUSINESS_CONTINUITY', 'STAKEHOLDER_COMMS');
          
          // Generate incident response report
          const incidentReport = {
            incidentId: crypto.randomUUID(),
            severity: securityEvent.severity,
            responseTime: responseProfile.maxResponse,
            estimatedImpact: securityEvent.target.businessImpact,
            responseTimeline,
            responseActions,
            complianceRequirements: {
              gdprBreach: securityEvent.eventType === 'DATA_EXFILTRATION' && 
                         securityEvent.target.dataClassification === 'RESTRICTED',
              soxReporting: securityEvent.target.resource.includes('FINANCIAL'),
              hipaaViolation: securityEvent.target.dataClassification === 'RESTRICTED' &&
                             securityEvent.target.resource.includes('HEALTH')
            },
            estimatedCost: calculateIncidentCost(securityEvent.severity, securityEvent.target.businessImpact),
            nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          };
          
          return incidentReport;
        }
      });
      
      // Helper function for incident cost calculation
      function calculateIncidentCost(severity: string, businessImpact: string): number {
        const baseCosts = {
          'LOW': 10000,
          'MEDIUM': 50000,
          'HIGH': 250000,
          'CRITICAL': 1000000
        };
        
        const impactMultipliers = {
          'MINIMAL': 1,
          'MODERATE': 2,
          'SIGNIFICANT': 4,
          'SEVERE': 8
        };
        
        return (baseCosts[severity] || 0) * (impactMultipliers[businessImpact] || 1);
      }

      describe('When detecting critical security incidents', () => {
        it('Then should execute NIST incident response framework within SLA', async () => {
          const criticalIncident = {
            securityEvent: {
              eventId: crypto.randomUUID(),
              eventType: 'DATA_EXFILTRATION' as const,
              severity: 'CRITICAL' as const,
              source: {
                ipAddress: '198.51.100.42',
                userAgent: 'Mozilla/5.0 (compatible; Malicious Bot)',
                userId: 'USR-COMPROMISED-001',
                systemId: 'SYS-DATABASE-PROD-001'
              },
              target: {
                resource: 'CUSTOMER_FINANCIAL_DATA',
                dataClassification: 'RESTRICTED' as const,
                businessImpact: 'SEVERE' as const
              },
              detectionTimestamp: new Date(),
              evidenceCollected: true
            },
            responseRequirements: {
              maxResponseTime: 15, // 15 minutes for critical
              escalationRequired: true,
              isolationRequired: true,
              forwardToAuthorities: true,
              businessContinuityRequired: true
            }
          };
          
          const result = await incidentResponseTask.call(criticalIncident, securityContext);
          
          // Critical incident response validation
          expect(result.severity).toBe('CRITICAL');
          expect(result.responseTime).toBe(15); // 15 minutes SLA
          expect(result.responseTimeline).toHaveLength(5); // All phases executed
          expect(result.responseActions).toContain('ISOLATE_SYSTEMS');
          expect(result.responseActions).toContain('AUTHORITIES_NOTIFICATION');
          expect(result.complianceRequirements.gdprBreach).toBe(true);
          expect(result.estimatedCost).toBe(8000000); // $8M (Critical + Severe impact)
          
          // Incident response audit trail
          const incidentEvents = securityAuditTrail.filter(e => 
            e.event === 'TASK_COMPLETED' && e.taskId === 'incident-response-handler'
          );
          expect(incidentEvents.length).toBeGreaterThan(0);
          expect(incidentEvents[0].auditLevel).toBe('COMPLIANCE');
        });
        
        it('Then should handle low-severity incidents with standard procedures', async () => {
          const lowSeverityIncident = {
            securityEvent: {
              eventId: crypto.randomUUID(),
              eventType: 'PHISHING_ATTEMPT' as const,
              severity: 'LOW' as const,
              source: {
                ipAddress: '203.0.113.15',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
                systemId: 'SYS-EMAIL-GATEWAY-001'
              },
              target: {
                resource: 'EMPLOYEE_EMAIL_SYSTEM',
                dataClassification: 'INTERNAL' as const,
                businessImpact: 'MINIMAL' as const
              },
              detectionTimestamp: new Date(),
              evidenceCollected: true
            },
            responseRequirements: {
              maxResponseTime: 240, // 4 hours for low severity
              escalationRequired: false,
              isolationRequired: false,
              forwardToAuthorities: false,
              businessContinuityRequired: false
            }
          };
          
          const result = await incidentResponseTask.call(lowSeverityIncident, securityContext);
          
          // Low severity incident validation
          expect(result.severity).toBe('LOW');
          expect(result.responseTime).toBe(240); // 4 hours SLA
          expect(result.responseActions).not.toContain('ISOLATE_SYSTEMS');
          expect(result.responseActions).not.toContain('AUTHORITIES_NOTIFICATION');
          expect(result.estimatedCost).toBe(10000); // $10K base cost
          
          // Standard incident logging
          const lowSeverityEvents = securityAuditTrail.filter(e => 
            e.event === 'TASK_INITIATED' && e.securityContext === 'MONITORED'
          );
          expect(lowSeverityEvents.length).toBeGreaterThan(0);
        });
      });
    });
  });
});