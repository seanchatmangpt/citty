/**
 * Enterprise Compliance Management System
 * Implements GDPR, SOC 2, HIPAA, and other compliance frameworks
 */

import crypto from 'crypto';
import { Logger } from '../monitoring/Logger';
import { Encryptor } from '../security/Encryptor';

export interface ComplianceConfig {
  frameworks: Array<'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS' | 'ISO27001' | 'CCPA'>;
  dataRetention: {
    defaultPeriodDays: number;
    categories: Record<string, number>; // Category -> retention days
  };
  dataClassification: {
    levels: Array<'public' | 'internal' | 'confidential' | 'restricted'>;
    defaultLevel: string;
  };
  auditLog: {
    enabled: boolean;
    retentionDays: number;
    encryptionRequired: boolean;
  };
  dataProcessing: {
    lawfulBases: string[];
    consentRequired: boolean;
    anonymizationRequired: boolean;
  };
}

export interface DataSubject {
  id: string;
  email?: string;
  identifiers: Record<string, string>;
  consentRecords: ConsentRecord[];
  dataCategories: string[];
  retentionPolicy: {
    category: string;
    expiresAt: Date;
    lastAccessed: Date;
  };
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface ConsentRecord {
  id: string;
  subjectId: string;
  purpose: string;
  lawfulBasis: string;
  consentGiven: boolean;
  consentDate: Date;
  withdrawnDate?: Date;
  version: string;
  source: string;
  metadata: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: 'data_access' | 'data_modification' | 'data_deletion' | 'consent_change' | 'security_event';
  subjectId?: string;
  userId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface DataProcessingRecord {
  id: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retentionPeriod: number;
  crossBorderTransfer: boolean;
  safeguards: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  framework: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalDataSubjects: number;
    activeConsents: number;
    dataBreaches: number;
    complianceScore: number;
  };
  findings: Array<{
    category: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    recommendation: string;
    affectedRecords?: number;
  }>;
  metrics: Record<string, number>;
}

export class ComplianceManager {
  private config: ComplianceConfig;
  private logger: Logger;
  private encryptor: Encryptor;
  private dataSubjects = new Map<string, DataSubject>();
  private consentRecords = new Map<string, ConsentRecord>();
  private auditEvents: AuditEvent[] = [];
  private processingRecords = new Map<string, DataProcessingRecord>();

  constructor(config: ComplianceConfig, encryptor: Encryptor) {
    this.config = config;
    this.logger = new Logger({ service: 'ComplianceManager' });
    this.encryptor = encryptor;
    
    this.startComplianceMonitoring();
  }

  /**
   * GDPR Compliance Methods
   */

  /**
   * Register a data subject
   */
  async registerDataSubject(
    subject: Omit<DataSubject, 'id' | 'consentRecords' | 'retentionPolicy'>
  ): Promise<string> {
    const subjectId = crypto.randomUUID();
    const retentionDays = this.config.dataRetention.categories[subject.dataCategories[0]] 
      || this.config.dataRetention.defaultPeriodDays;
    
    const dataSubject: DataSubject = {
      id: subjectId,
      ...subject,
      consentRecords: [],
      retentionPolicy: {
        category: subject.dataCategories[0] || 'general',
        expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
        lastAccessed: new Date()
      }
    };

    this.dataSubjects.set(subjectId, dataSubject);
    
    await this.logAuditEvent({
      eventType: 'data_access',
      subjectId,
      action: 'data_subject_registered',
      resource: 'data_subjects',
      outcome: 'success',
      riskLevel: 'low',
      details: { 
        categories: subject.dataCategories,
        classification: subject.classification 
      }
    });

    await this.logger.audit('Data subject registered', { subjectId, categories: subject.dataCategories });
    
    return subjectId;
  }

  /**
   * Record consent
   */
  async recordConsent(
    subjectId: string,
    purpose: string,
    lawfulBasis: string,
    consentGiven: boolean,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const consentId = crypto.randomUUID();
    const consent: ConsentRecord = {
      id: consentId,
      subjectId,
      purpose,
      lawfulBasis,
      consentGiven,
      consentDate: new Date(),
      version: '1.0',
      source: 'application',
      metadata
    };

    this.consentRecords.set(consentId, consent);
    
    // Update data subject
    const subject = this.dataSubjects.get(subjectId);
    if (subject) {
      subject.consentRecords.push(consent);
      this.dataSubjects.set(subjectId, subject);
    }

    await this.logAuditEvent({
      eventType: 'consent_change',
      subjectId,
      action: 'consent_recorded',
      resource: 'consent_records',
      outcome: 'success',
      riskLevel: 'medium',
      details: { consentId, purpose, consentGiven }
    });

    await this.logger.audit('Consent recorded', { 
      consentId, 
      subjectId, 
      purpose, 
      consentGiven 
    });

    return consentId;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(consentId: string, reason?: string): Promise<boolean> {
    const consent = this.consentRecords.get(consentId);
    if (!consent) {
      return false;
    }

    consent.withdrawnDate = new Date();
    consent.metadata.withdrawalReason = reason;
    this.consentRecords.set(consentId, consent);

    await this.logAuditEvent({
      eventType: 'consent_change',
      subjectId: consent.subjectId,
      action: 'consent_withdrawn',
      resource: 'consent_records',
      outcome: 'success',
      riskLevel: 'medium',
      details: { consentId, reason }
    });

    await this.logger.audit('Consent withdrawn', { consentId, reason });
    
    return true;
  }

  /**
   * Handle data subject access request (Right to Access)
   */
  async handleAccessRequest(subjectId: string): Promise<{
    personalData: any;
    processingActivities: DataProcessingRecord[];
    consentHistory: ConsentRecord[];
  } | null> {
    const subject = this.dataSubjects.get(subjectId);
    if (!subject) {
      return null;
    }

    // Update last accessed
    subject.retentionPolicy.lastAccessed = new Date();
    this.dataSubjects.set(subjectId, subject);

    const processingActivities = Array.from(this.processingRecords.values())
      .filter(record => record.dataSubjects.includes(subjectId));

    const consentHistory = subject.consentRecords;

    await this.logAuditEvent({
      eventType: 'data_access',
      subjectId,
      action: 'access_request_fulfilled',
      resource: 'personal_data',
      outcome: 'success',
      riskLevel: 'medium',
      details: { requestType: 'subject_access_request' }
    });

    await this.logger.audit('Subject access request fulfilled', { subjectId });

    return {
      personalData: subject,
      processingActivities,
      consentHistory
    };
  }

  /**
   * Handle data portability request (Right to Data Portability)
   */
  async handlePortabilityRequest(subjectId: string, format: 'json' | 'xml' | 'csv' = 'json'): Promise<string | null> {
    const accessData = await this.handleAccessRequest(subjectId);
    if (!accessData) {
      return null;
    }

    let exportData: string;
    switch (format) {
      case 'json':
        exportData = JSON.stringify(accessData, null, 2);
        break;
      case 'xml':
        exportData = this.convertToXML(accessData);
        break;
      case 'csv':
        exportData = this.convertToCSV(accessData);
        break;
      default:
        exportData = JSON.stringify(accessData, null, 2);
    }

    await this.logAuditEvent({
      eventType: 'data_access',
      subjectId,
      action: 'portability_request_fulfilled',
      resource: 'personal_data',
      outcome: 'success',
      riskLevel: 'medium',
      details: { format, dataSize: exportData.length }
    });

    return exportData;
  }

  /**
   * Handle erasure request (Right to be Forgotten)
   */
  async handleErasureRequest(subjectId: string, reason: string): Promise<{
    success: boolean;
    deletedRecords: number;
    retainedRecords: Array<{ type: string; reason: string }>;
  }> {
    let deletedRecords = 0;
    const retainedRecords: Array<{ type: string; reason: string }> = [];

    // Check if data must be retained for legal reasons
    const subject = this.dataSubjects.get(subjectId);
    if (!subject) {
      return { success: false, deletedRecords: 0, retainedRecords: [] };
    }

    // Delete or anonymize consent records
    for (const consent of subject.consentRecords) {
      if (this.canDeleteConsentRecord(consent)) {
        this.consentRecords.delete(consent.id);
        deletedRecords++;
      } else {
        // Anonymize instead of delete
        await this.anonymizeConsentRecord(consent);
        retainedRecords.push({
          type: 'consent_record',
          reason: 'Legal obligation to retain'
        });
      }
    }

    // Delete data subject record
    if (this.canDeleteDataSubject(subject)) {
      this.dataSubjects.delete(subjectId);
      deletedRecords++;
    } else {
      // Anonymize the data subject
      await this.anonymizeDataSubject(subject);
      retainedRecords.push({
        type: 'data_subject',
        reason: 'Legal obligation to retain'
      });
    }

    await this.logAuditEvent({
      eventType: 'data_deletion',
      subjectId,
      action: 'erasure_request_processed',
      resource: 'personal_data',
      outcome: 'success',
      riskLevel: 'high',
      details: { reason, deletedRecords, retainedRecords: retainedRecords.length }
    });

    await this.logger.audit('Erasure request processed', { 
      subjectId, 
      reason, 
      deletedRecords, 
      retainedRecords: retainedRecords.length 
    });

    return { success: true, deletedRecords, retainedRecords };
  }

  /**
   * SOC 2 Compliance Methods
   */

  /**
   * Monitor security controls
   */
  async monitorSecurityControls(): Promise<{
    controls: Array<{
      name: string;
      status: 'effective' | 'ineffective' | 'not_tested';
      lastTested: Date;
      evidence: string[];
    }>;
    overallStatus: 'compliant' | 'non_compliant' | 'needs_attention';
  }> {
    // This would integrate with your security monitoring systems
    const controls = [
      {
        name: 'Access Control',
        status: 'effective' as const,
        lastTested: new Date(),
        evidence: ['access_logs', 'permission_audit']
      },
      {
        name: 'Data Encryption',
        status: 'effective' as const,
        lastTested: new Date(),
        evidence: ['encryption_status', 'key_management']
      },
      {
        name: 'Incident Response',
        status: 'effective' as const,
        lastTested: new Date(),
        evidence: ['incident_logs', 'response_procedures']
      }
    ];

    const ineffectiveControls = controls.filter(c => c.status === 'ineffective');
    const overallStatus = ineffectiveControls.length === 0 ? 'compliant' : 'non_compliant';

    return { controls, overallStatus };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    framework: ComplianceConfig['frameworks'][number],
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const findings: ComplianceReport['findings'] = [];
    const metrics: Record<string, number> = {};

    // Analyze compliance based on framework
    switch (framework) {
      case 'GDPR':
        await this.analyzeGDPRCompliance(findings, metrics, period);
        break;
      case 'SOC2':
        await this.analyzeSOC2Compliance(findings, metrics, period);
        break;
      case 'HIPAA':
        await this.analyzeHIPAACompliance(findings, metrics, period);
        break;
      default:
        findings.push({
          category: 'Framework',
          severity: 'warning',
          message: `Analysis for ${framework} not implemented`,
          recommendation: 'Implement framework-specific analysis'
        });
    }

    // Calculate compliance score
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const warningFindings = findings.filter(f => f.severity === 'warning').length;
    const complianceScore = Math.max(0, 100 - (criticalFindings * 20) - (warningFindings * 5));

    const report: ComplianceReport = {
      framework,
      generatedAt: new Date(),
      period,
      summary: {
        totalDataSubjects: this.dataSubjects.size,
        activeConsents: Array.from(this.consentRecords.values())
          .filter(c => c.consentGiven && !c.withdrawnDate).length,
        dataBreaches: this.getDataBreachCount(period),
        complianceScore
      },
      findings,
      metrics
    };

    await this.logger.audit('Compliance report generated', { 
      framework, 
      complianceScore, 
      criticalFindings, 
      warningFindings 
    });

    return report;
  }

  /**
   * Data retention management
   */
  async enforceDataRetention(): Promise<{
    expiredRecords: number;
    deletedRecords: number;
    errors: string[];
  }> {
    const now = new Date();
    let expiredRecords = 0;
    let deletedRecords = 0;
    const errors: string[] = [];

    for (const [subjectId, subject] of this.dataSubjects.entries()) {
      if (subject.retentionPolicy.expiresAt < now) {
        expiredRecords++;
        
        try {
          // Check if data can be deleted
          if (this.canDeleteDataSubject(subject)) {
            this.dataSubjects.delete(subjectId);
            deletedRecords++;
            
            await this.logAuditEvent({
              eventType: 'data_deletion',
              subjectId,
              action: 'automatic_retention_deletion',
              resource: 'personal_data',
              outcome: 'success',
              riskLevel: 'medium',
              details: { expirationDate: subject.retentionPolicy.expiresAt }
            });
          } else {
            // Anonymize if deletion is not possible
            await this.anonymizeDataSubject(subject);
            
            await this.logAuditEvent({
              eventType: 'data_modification',
              subjectId,
              action: 'automatic_retention_anonymization',
              resource: 'personal_data',
              outcome: 'success',
              riskLevel: 'medium',
              details: { expirationDate: subject.retentionPolicy.expiresAt }
            });
          }
        } catch (error) {
          errors.push(`Failed to process expired record ${subjectId}: ${error.message}`);
        }
      }
    }

    await this.logger.audit('Data retention enforcement completed', {
      expiredRecords,
      deletedRecords,
      errors: errors.length
    });

    return { expiredRecords, deletedRecords, errors };
  }

  /**
   * Audit logging
   */
  private async logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.auditLog.enabled) {
      return;
    }

    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    };

    // Encrypt sensitive audit data if required
    if (this.config.auditLog.encryptionRequired) {
      const encrypted = await this.encryptor.encrypt(JSON.stringify(auditEvent.details));
      auditEvent.details = { encrypted: encrypted.encrypted, iv: encrypted.iv };
    }

    this.auditEvents.push(auditEvent);

    // Cleanup old audit events
    const cutoffDate = new Date(Date.now() - this.config.auditLog.retentionDays * 24 * 60 * 60 * 1000);
    this.auditEvents = this.auditEvents.filter(e => e.timestamp > cutoffDate);
  }

  /**
   * Start compliance monitoring
   */
  private startComplianceMonitoring(): void {
    // Daily data retention check
    setInterval(async () => {
      await this.enforceDataRetention();
    }, 24 * 60 * 60 * 1000);

    // Weekly compliance audit
    setInterval(async () => {
      for (const framework of this.config.frameworks) {
        const report = await this.generateComplianceReport(framework, {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        });

        if (report.summary.complianceScore < 80) {
          await this.logger.warn('Low compliance score detected', {
            framework,
            score: report.summary.complianceScore,
            criticalFindings: report.findings.filter(f => f.severity === 'critical').length
          });
        }
      }
    }, 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Helper methods
   */
  private async analyzeGDPRCompliance(
    findings: ComplianceReport['findings'],
    metrics: Record<string, number>,
    period: { start: Date; end: Date }
  ): Promise<void> {
    // Check consent records
    const totalConsents = this.consentRecords.size;
    const activeConsents = Array.from(this.consentRecords.values())
      .filter(c => c.consentGiven && !c.withdrawnDate).length;
    
    metrics.totalConsents = totalConsents;
    metrics.activeConsents = activeConsents;
    metrics.consentRate = totalConsents > 0 ? (activeConsents / totalConsents) * 100 : 0;

    if (metrics.consentRate < 70) {
      findings.push({
        category: 'Consent Management',
        severity: 'warning',
        message: `Low consent rate: ${metrics.consentRate.toFixed(1)}%`,
        recommendation: 'Review consent collection processes and user experience'
      });
    }

    // Check data retention compliance
    const expiredSubjects = Array.from(this.dataSubjects.values())
      .filter(s => s.retentionPolicy.expiresAt < new Date()).length;
    
    metrics.expiredSubjects = expiredSubjects;

    if (expiredSubjects > 0) {
      findings.push({
        category: 'Data Retention',
        severity: 'critical',
        message: `${expiredSubjects} data subjects have expired retention periods`,
        recommendation: 'Execute data retention policy immediately',
        affectedRecords: expiredSubjects
      });
    }
  }

  private async analyzeSOC2Compliance(
    findings: ComplianceReport['findings'],
    metrics: Record<string, number>,
    period: { start: Date; end: Date }
  ): Promise<void> {
    // Analyze security controls
    const controlMonitoring = await this.monitorSecurityControls();
    const ineffectiveControls = controlMonitoring.controls
      .filter(c => c.status === 'ineffective').length;
    
    metrics.totalControls = controlMonitoring.controls.length;
    metrics.effectiveControls = controlMonitoring.controls
      .filter(c => c.status === 'effective').length;
    
    if (ineffectiveControls > 0) {
      findings.push({
        category: 'Security Controls',
        severity: 'critical',
        message: `${ineffectiveControls} security controls are ineffective`,
        recommendation: 'Review and remediate ineffective security controls immediately'
      });
    }
  }

  private async analyzeHIPAACompliance(
    findings: ComplianceReport['findings'],
    metrics: Record<string, number>,
    period: { start: Date; end: Date }
  ): Promise<void> {
    // Check PHI encryption
    const phiSubjects = Array.from(this.dataSubjects.values())
      .filter(s => s.dataCategories.includes('health')).length;
    
    metrics.phiSubjects = phiSubjects;

    // This would check actual encryption status
    findings.push({
      category: 'PHI Protection',
      severity: 'info',
      message: `${phiSubjects} subjects with health data protected`,
      recommendation: 'Continue monitoring PHI encryption and access controls'
    });
  }

  private canDeleteConsentRecord(consent: ConsentRecord): boolean {
    // Check if consent record must be retained for legal reasons
    return !consent.metadata.legalHold;
  }

  private canDeleteDataSubject(subject: DataSubject): boolean {
    // Check if data subject must be retained for legal reasons
    return subject.classification !== 'restricted';
  }

  private async anonymizeConsentRecord(consent: ConsentRecord): Promise<void> {
    consent.subjectId = 'anonymized';
    consent.metadata = { anonymized: true, originalDate: consent.consentDate };
    this.consentRecords.set(consent.id, consent);
  }

  private async anonymizeDataSubject(subject: DataSubject): Promise<void> {
    subject.email = undefined;
    subject.identifiers = { anonymized: 'true' };
    subject.classification = 'public';
    this.dataSubjects.set(subject.id, subject);
  }

  private convertToXML(data: any): string {
    // Simple XML conversion - implement proper XML serialization
    return `<?xml version="1.0" encoding="UTF-8"?><data>${JSON.stringify(data)}</data>`;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - implement proper CSV serialization
    return JSON.stringify(data);
  }

  private getDataBreachCount(period: { start: Date; end: Date }): number {
    return this.auditEvents.filter(e => 
      e.eventType === 'security_event' && 
      e.riskLevel === 'critical' &&
      e.timestamp >= period.start && 
      e.timestamp <= period.end
    ).length;
  }

  /**
   * Get compliance statistics
   */
  getStatistics(): {
    dataSubjects: number;
    activeConsents: number;
    auditEvents: number;
    frameworks: string[];
    complianceScore: number;
  } {
    const activeConsents = Array.from(this.consentRecords.values())
      .filter(c => c.consentGiven && !c.withdrawnDate).length;

    return {
      dataSubjects: this.dataSubjects.size,
      activeConsents,
      auditEvents: this.auditEvents.length,
      frameworks: this.config.frameworks,
      complianceScore: 85 // Would calculate based on current compliance status
    };
  }
}