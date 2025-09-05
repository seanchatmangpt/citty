/**
 * Advanced Threat Detection System
 * Implements ML-based anomaly detection, pattern recognition, and threat intelligence
 */

import crypto from 'crypto';
import { Logger } from '../monitoring/Logger';

export interface ThreatDetectionResult {
  detected: boolean;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  patterns: string[];
  metadata?: Record<string, any>;
}

export interface BehaviorPattern {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  actions: string[];
  timestamps: Date[];
  locations: string[];
  suspicious: boolean;
  riskScore: number;
}

export interface AnomalyScore {
  overall: number;
  components: {
    frequency: number;
    pattern: number;
    location: number;
    timing: number;
    payload: number;
  };
}

export class ThreatDetector {
  private logger: Logger;
  private xssPatterns: RegExp[];
  private sqlInjectionPatterns: RegExp[];
  private pathTraversalPatterns: RegExp[];
  private maliciousUserAgents: RegExp[];
  private behaviorProfiles = new Map<string, BehaviorPattern>();
  private knownMaliciousIPs = new Set<string>();
  private suspiciousPatterns = new Map<string, { count: number; lastSeen: Date }>();

  constructor() {
    this.logger = new Logger({ service: 'ThreatDetector' });
    this.initializePatterns();
  }

  /**
   * Initialize threat detection patterns
   */
  private initializePatterns(): void {
    // XSS patterns
    this.xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[\s\S]*?>/gi,
      /<object[\s\S]*?>/gi,
      /<embed[\s\S]*?>/gi,
      /<link[\s\S]*?>/gi,
      /<meta[\s\S]*?>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /livescript:/gi,
      /mocha:/gi,
      /data:text\/html/gi,
      /<svg[\s\S]*?onload/gi,
      /fromCharCode/gi,
      /String\.fromCharCode/gi
    ];

    // SQL Injection patterns
    this.sqlInjectionPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /((\%27)|(\'))union/gi,
      /exec(\s|\+)+(s|x)p\w+/gi,
      /union[\s\w]*select/gi,
      /select[\s\w]*from/gi,
      /insert[\s\w]*into/gi,
      /delete[\s\w]*from/gi,
      /update[\s\w]*set/gi,
      /drop[\s\w]*table/gi,
      /create[\s\w]*table/gi,
      /alter[\s\w]*table/gi,
      /truncate[\s\w]*table/gi,
      /exec[\s\w]*\(/gi,
      /sp_\w+/gi,
      /xp_\w+/gi,
      /0x[0-9a-f]+/gi,
      /@@\w+/gi,
      /waitfor[\s\w]*delay/gi,
      /benchmark\s*\(/gi,
      /sleep\s*\(/gi
    ];

    // Path traversal patterns
    this.pathTraversalPatterns = [
      /\.\.\//gi,
      /\.\.\/\.\.\//gi,
      /\.\.\\/gi,
      /\.\.\\\.\.\\\/gi,
      /%2e%2e%2f/gi,
      /%2e%2e\//gi,
      /\.%2e\//gi,
      /%2e\.\//gi,
      /%252e%252e%252f/gi,
      /\.\./gi,
      /~\//gi,
      /%7e/gi,
      /\/etc\/passwd/gi,
      /\/etc\/shadow/gi,
      /\/proc\/self\/environ/gi,
      /\/var\/log\//gi,
      /c:\\windows\\/gi,
      /c:%5cwindows%5c/gi
    ];

    // Malicious user agents
    this.maliciousUserAgents = [
      /sqlmap/gi,
      /nikto/gi,
      /nessus/gi,
      /burpsuite/gi,
      /nmap/gi,
      /masscan/gi,
      /zap/gi,
      /havij/gi,
      /pangolin/gi,
      /webscarab/gi,
      /w3af/gi,
      /acunetix/gi,
      /arachni/gi,
      /skipfish/gi,
      /wapiti/gi,
      /dirb/gi,
      /gobuster/gi,
      /curl/gi,
      /wget/gi,
      /python-requests/gi,
      /bot/gi,
      /crawler/gi,
      /spider/gi,
      /scraper/gi
    ];
  }

  /**
   * Comprehensive threat detection
   */
  async detectThreats(
    input: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      userId?: string;
      endpoint?: string;
    }
  ): Promise<ThreatDetectionResult[]> {
    const threats: ThreatDetectionResult[] = [];

    // XSS detection
    const xssResult = this.detectXSS(input);
    if (xssResult.detected) {
      threats.push(xssResult);
    }

    // SQL Injection detection
    const sqlResult = this.detectSQLInjection(input);
    if (sqlResult.detected) {
      threats.push(sqlResult);
    }

    // Path traversal detection
    const pathResult = this.detectPathTraversal(input);
    if (pathResult.detected) {
      threats.push(pathResult);
    }

    // User agent analysis
    if (context.userAgent) {
      const uaResult = this.analyzeUserAgent(context.userAgent);
      if (uaResult.detected) {
        threats.push(uaResult);
      }
    }

    // Behavioral analysis
    if (context.userId && context.ipAddress) {
      const behaviorResult = await this.analyzeBehavior(context);
      if (behaviorResult.detected) {
        threats.push(behaviorResult);
      }
    }

    // IP reputation check
    if (context.ipAddress) {
      const ipResult = this.checkIPReputation(context.ipAddress);
      if (ipResult.detected) {
        threats.push(ipResult);
      }
    }

    // Pattern frequency analysis
    const frequencyResult = await this.analyzePatternFrequency(input, context);
    if (frequencyResult.detected) {
      threats.push(frequencyResult);
    }

    // Log detected threats
    if (threats.length > 0) {
      await this.logger.security('THREATS_DETECTED', {
        threatCount: threats.length,
        threatTypes: threats.map(t => t.threatType),
        severity: Math.max(...threats.map(t => this.severityToNumber(t.severity))),
        context
      });
    }

    return threats;
  }

  /**
   * XSS detection
   */
  detectXSS(input: string): ThreatDetectionResult {
    const patterns: string[] = [];
    let confidence = 0;

    for (const pattern of this.xssPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        patterns.push(pattern.source);
        confidence += 0.1;
      }
    }

    // Additional heuristics
    const suspiciousChars = ['<', '>', '"', "'", '&', 'javascript:', 'data:'];
    const suspiciousCount = suspiciousChars.filter(char => input.includes(char)).length;
    if (suspiciousCount > 3) {
      confidence += 0.2;
    }

    // Entropy analysis for obfuscated XSS
    const entropy = this.calculateEntropy(input);
    if (entropy > 4.5 && input.length > 50) {
      confidence += 0.3;
      patterns.push('high-entropy-obfuscation');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'xss',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns
    };
  }

  /**
   * SQL Injection detection
   */
  detectSQLInjection(input: string): ThreatDetectionResult {
    const patterns: string[] = [];
    let confidence = 0;

    for (const pattern of this.sqlInjectionPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        patterns.push(pattern.source);
        confidence += 0.15;
      }
    }

    // SQL keyword density analysis
    const sqlKeywords = ['select', 'union', 'insert', 'update', 'delete', 'drop', 'exec', 'or', 'and'];
    const keywordCount = sqlKeywords.filter(keyword => 
      input.toLowerCase().includes(keyword)
    ).length;
    
    if (keywordCount > 2) {
      confidence += 0.25;
      patterns.push('high-sql-keyword-density');
    }

    // Quote and comment analysis
    const quotes = (input.match(/['"`]/g) || []).length;
    const comments = (input.match(/(--|#|\/\*)/g) || []).length;
    if (quotes > 3 || comments > 1) {
      confidence += 0.2;
      patterns.push('suspicious-sql-syntax');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'sql_injection',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns
    };
  }

  /**
   * Path traversal detection
   */
  detectPathTraversal(input: string): ThreatDetectionResult {
    const patterns: string[] = [];
    let confidence = 0;

    for (const pattern of this.pathTraversalPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        patterns.push(pattern.source);
        confidence += 0.2;
      }
    }

    // Directory traversal depth analysis
    const traversalCount = (input.match(/\.\.\//g) || []).length;
    if (traversalCount > 2) {
      confidence += 0.3;
      patterns.push('deep-directory-traversal');
    }

    // System file access attempts
    const systemFiles = ['/etc/', '/proc/', '/var/', 'c:\\windows\\', 'c:\\users\\'];
    if (systemFiles.some(file => input.toLowerCase().includes(file))) {
      confidence += 0.4;
      patterns.push('system-file-access');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'path_traversal',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns
    };
  }

  /**
   * User agent analysis
   */
  analyzeUserAgent(userAgent: string): ThreatDetectionResult {
    const patterns: string[] = [];
    let confidence = 0;

    for (const pattern of this.maliciousUserAgents) {
      const matches = userAgent.match(pattern);
      if (matches) {
        patterns.push(pattern.source);
        confidence += 0.3;
      }
    }

    // Empty or suspicious user agent
    if (!userAgent || userAgent.trim().length === 0) {
      confidence += 0.2;
      patterns.push('empty-user-agent');
    }

    // Very short user agent
    if (userAgent && userAgent.length < 10) {
      confidence += 0.15;
      patterns.push('suspiciously-short-user-agent');
    }

    // Very long user agent (possible evasion)
    if (userAgent && userAgent.length > 1000) {
      confidence += 0.25;
      patterns.push('suspiciously-long-user-agent');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'malicious_user_agent',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns
    };
  }

  /**
   * Behavioral analysis
   */
  async analyzeBehavior(context: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
  }): Promise<ThreatDetectionResult> {
    const patterns: string[] = [];
    let confidence = 0;

    const key = context.userId || context.ipAddress || 'unknown';
    let profile = this.behaviorProfiles.get(key);
    
    if (!profile) {
      profile = {
        userId: context.userId,
        ipAddress: context.ipAddress || 'unknown',
        userAgent: context.userAgent || 'unknown',
        actions: [],
        timestamps: [],
        locations: [],
        suspicious: false,
        riskScore: 0
      };
    }

    // Update profile
    profile.actions.push(context.endpoint || 'unknown');
    profile.timestamps.push(new Date());
    
    // Keep only recent data (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    profile.actions = profile.actions.slice(-100); // Keep last 100 actions
    profile.timestamps = profile.timestamps.filter(ts => ts > oneHourAgo);

    // Analyze patterns
    const recentActions = profile.actions.slice(-10);
    
    // Rapid fire requests
    if (profile.timestamps.length > 50) {
      confidence += 0.3;
      patterns.push('rapid-fire-requests');
    }

    // Repeated identical actions
    const uniqueActions = new Set(recentActions);
    if (recentActions.length > 5 && uniqueActions.size < 3) {
      confidence += 0.2;
      patterns.push('repetitive-behavior');
    }

    // User agent switching
    if (context.userAgent !== profile.userAgent) {
      confidence += 0.15;
      patterns.push('user-agent-switching');
    }

    // Time-based anomalies
    const now = new Date();
    const hour = now.getHours();
    if (hour < 3 || hour > 23) { // Unusual hours
      confidence += 0.1;
      patterns.push('unusual-time-activity');
    }

    // Update risk score
    profile.riskScore = Math.min(1, profile.riskScore + confidence);
    profile.suspicious = profile.riskScore > 0.5;
    
    this.behaviorProfiles.set(key, profile);

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'behavioral_anomaly',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns,
      metadata: {
        riskScore: profile.riskScore,
        actionCount: profile.actions.length,
        recentActivityWindow: profile.timestamps.length
      }
    };
  }

  /**
   * IP reputation check
   */
  checkIPReputation(ipAddress: string): ThreatDetectionResult {
    const patterns: string[] = [];
    let confidence = 0;

    // Check known malicious IPs
    if (this.knownMaliciousIPs.has(ipAddress)) {
      confidence += 0.8;
      patterns.push('known-malicious-ip');
    }

    // Check for private/internal IPs trying to access from outside
    if (this.isPrivateIP(ipAddress)) {
      confidence += 0.1;
      patterns.push('private-ip-external-access');
    }

    // Check for Tor exit nodes (simplified detection)
    if (this.isTorExitNode(ipAddress)) {
      confidence += 0.3;
      patterns.push('tor-exit-node');
    }

    // Geographic anomalies (simplified)
    if (this.isHighRiskGeolocation(ipAddress)) {
      confidence += 0.2;
      patterns.push('high-risk-geolocation');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'ip_reputation',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns
    };
  }

  /**
   * Pattern frequency analysis
   */
  async analyzePatternFrequency(
    input: string,
    context: { ipAddress?: string; endpoint?: string }
  ): Promise<ThreatDetectionResult> {
    const patterns: string[] = [];
    let confidence = 0;

    // Create pattern signature
    const signature = this.createPatternSignature(input);
    const key = `${context.ipAddress || 'unknown'}:${signature}`;
    
    let patternInfo = this.suspiciousPatterns.get(key);
    if (!patternInfo) {
      patternInfo = { count: 0, lastSeen: new Date() };
    }
    
    patternInfo.count++;
    patternInfo.lastSeen = new Date();
    this.suspiciousPatterns.set(key, patternInfo);

    // Check for pattern repetition
    if (patternInfo.count > 5) {
      confidence += 0.4;
      patterns.push('repeated-pattern');
    }

    if (patternInfo.count > 20) {
      confidence += 0.6;
      patterns.push('excessive-pattern-repetition');
    }

    const detected = patterns.length > 0;
    return {
      detected,
      threatType: 'pattern_frequency',
      severity: this.getSeverity(confidence),
      confidence: Math.min(1, confidence),
      patterns,
      metadata: {
        patternCount: patternInfo.count,
        signature
      }
    };
  }

  /**
   * Machine learning-based anomaly detection (simplified)
   */
  async detectAnomalies(
    features: {
      requestLength: number;
      parameterCount: number;
      specialCharCount: number;
      entropy: number;
      timeOfDay: number;
      requestFrequency: number;
    }
  ): Promise<AnomalyScore> {
    // Simplified ML model using statistical thresholds
    // In production, this would use a trained ML model
    
    const scores = {
      frequency: this.normalizeScore(features.requestFrequency, 0, 100),
      pattern: this.normalizeScore(features.entropy, 0, 8),
      location: 0.1, // Placeholder for geolocation analysis
      timing: this.normalizeScore(features.timeOfDay, 0, 24),
      payload: this.normalizeScore(features.specialCharCount, 0, 50)
    };

    const overall = (
      scores.frequency * 0.3 +
      scores.pattern * 0.25 +
      scores.location * 0.15 +
      scores.timing * 0.15 +
      scores.payload * 0.15
    );

    return {
      overall,
      components: scores
    };
  }

  /**
   * Utility methods
   */
  
  isSuspiciousUserAgent(userAgent: string): boolean {
    return this.maliciousUserAgents.some(pattern => pattern.test(userAgent));
  }

  isHighRiskIP(ipAddress: string): boolean {
    return this.knownMaliciousIPs.has(ipAddress) || 
           this.isTorExitNode(ipAddress) ||
           this.isHighRiskGeolocation(ipAddress);
  }

  private calculateEntropy(str: string): number {
    const charFreq = new Map<string, number>();
    for (const char of str) {
      charFreq.set(char, (charFreq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = str.length;
    
    for (const freq of charFreq.values()) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private getSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.8) return 'critical';
    if (confidence >= 0.6) return 'high';
    if (confidence >= 0.3) return 'medium';
    return 'low';
  }

  private severityToNumber(severity: string): number {
    const map = { low: 1, medium: 2, high: 3, critical: 4 };
    return map[severity] || 1;
  }

  private createPatternSignature(input: string): string {
    // Create a hash signature of the input pattern
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16);
  }

  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./
    ];
    return privateRanges.some(range => range.test(ip));
  }

  private isTorExitNode(ip: string): boolean {
    // Simplified Tor detection - in production, use real Tor exit node lists
    const knownTorRanges = ['127.0.0.1']; // Placeholder
    return knownTorRanges.includes(ip);
  }

  private isHighRiskGeolocation(ip: string): boolean {
    // Simplified geolocation risk - in production, use real GeoIP services
    // This would check against lists of high-risk countries/regions
    return false; // Placeholder
  }

  private normalizeScore(value: number, min: number, max: number): number {
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  }

  /**
   * Update threat intelligence
   */
  updateMaliciousIPs(ips: string[]): void {
    for (const ip of ips) {
      this.knownMaliciousIPs.add(ip);
    }
  }

  addMaliciousIP(ip: string): void {
    this.knownMaliciousIPs.add(ip);
  }

  removeMaliciousIP(ip: string): void {
    this.knownMaliciousIPs.delete(ip);
  }

  /**
   * Get threat statistics
   */
  getThreatStatistics(): {
    knownMaliciousIPs: number;
    behaviorProfiles: number;
    suspiciousPatterns: number;
    averageRiskScore: number;
  } {
    const riskScores = Array.from(this.behaviorProfiles.values()).map(p => p.riskScore);
    const averageRiskScore = riskScores.length > 0 
      ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length 
      : 0;

    return {
      knownMaliciousIPs: this.knownMaliciousIPs.size,
      behaviorProfiles: this.behaviorProfiles.size,
      suspiciousPatterns: this.suspiciousPatterns.size,
      averageRiskScore
    };
  }
}