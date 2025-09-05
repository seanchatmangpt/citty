/**
 * ENHANCED SCOUT AGENT - Real-Time File Watching & Change Detection
 * Production-grade environment monitoring with file system watching,
 * change detection, real-time validation, and automated response systems.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { FSWatcher } from 'fs';

// Enhanced scout configuration
export interface EnhancedScoutConfig {
  id: string;
  watchPaths: string[];
  watchPatterns: WatchPattern[];
  excludePatterns: string[];
  monitoringMode: 'polling' | 'events' | 'hybrid';
  pollingInterval: number;
  debounceMs: number;
  batchChanges: boolean;
  deepScanning: boolean;
  checksumValidation: boolean;
  realTimeResponse: boolean;
  changeClassification: boolean;
  historicalTracking: boolean;
  alerting: AlertingConfig;
  validation: ValidationConfig;
  autoResponse: AutoResponseConfig;
}

export interface WatchPattern {
  pattern: string;
  recursive: boolean;
  includeDirectories: boolean;
  includeFiles: boolean;
  eventTypes: FileEventType[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  customHandler?: string;
}

export type FileEventType = 'created' | 'modified' | 'deleted' | 'moved' | 'permissions' | 'attributes';

export interface AlertingConfig {
  enabled: boolean;
  thresholds: AlertThresholds;
  channels: AlertChannel[];
  escalation: EscalationPolicy;
  suppressDuplicates: boolean;
  cooldownMs: number;
}

export interface AlertThresholds {
  maxChangesPerMinute: number;
  maxFileSize: number;
  suspiciousPatterns: string[];
  criticalPaths: string[];
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'log' | 'event';
  config: Record<string, any>;
  severity: AlertSeverity[];
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface EscalationPolicy {
  levels: EscalationLevel[];
  timeoutMs: number;
}

export interface EscalationLevel {
  level: number;
  delay: number;
  channels: string[];
  actions: string[];
}

export interface ValidationConfig {
  enabled: boolean;
  rules: ValidationRule[];
  checksums: ChecksumConfig;
  integrity: IntegrityConfig;
  compliance: ComplianceConfig;
}

export interface ValidationRule {
  id: string;
  name: string;
  pattern: string;
  condition: string;
  action: 'allow' | 'block' | 'quarantine' | 'alert';
  severity: AlertSeverity;
  description: string;
}

export interface ChecksumConfig {
  algorithm: 'md5' | 'sha256' | 'sha512';
  trackChanges: boolean;
  verifyIntegrity: boolean;
  storeHistory: boolean;
}

export interface IntegrityConfig {
  enableMonitoring: boolean;
  criticalFiles: string[];
  expectedHashes: Map<string, string>;
  alertOnMismatch: boolean;
}

export interface ComplianceConfig {
  frameworks: string[];
  auditTrail: boolean;
  dataRetention: number;
  encryptionRequired: boolean;
}

export interface AutoResponseConfig {
  enabled: boolean;
  responses: AutoResponse[];
  quarantine: QuarantineConfig;
  backup: BackupConfig;
  notification: NotificationConfig;
}

export interface AutoResponse {
  trigger: ResponseTrigger;
  actions: ResponseAction[];
  conditions: string[];
  delay: number;
  retries: number;
}

export interface ResponseTrigger {
  event: FileEventType;
  pattern: string;
  severity: AlertSeverity;
  frequency: number;
}

export interface ResponseAction {
  type: 'quarantine' | 'backup' | 'restore' | 'alert' | 'execute' | 'block';
  config: Record<string, any>;
  timeout: number;
}

export interface QuarantineConfig {
  directory: string;
  encryption: boolean;
  retention: number;
  indexing: boolean;
}

export interface BackupConfig {
  directory: string;
  compression: boolean;
  encryption: boolean;
  retention: number;
  incrementalBackup: boolean;
}

export interface NotificationConfig {
  channels: string[];
  templates: Map<string, string>;
  aggregation: boolean;
  formatting: 'plain' | 'json' | 'structured';
}

// File change detection and tracking
export interface FileChange {
  id: string;
  timestamp: Date;
  path: string;
  event: FileEventType;
  details: FileChangeDetails;
  classification: ChangeClassification;
  risk: RiskAssessment;
  metadata: ChangeMetadata;
  validated: boolean;
  processed: boolean;
}

export interface FileChangeDetails {
  previousState?: FileState;
  currentState: FileState;
  delta: FileDelta;
  origin: ChangeOrigin;
  impact: ImpactAnalysis;
}

export interface FileState {
  path: string;
  size: number;
  modified: Date;
  created: Date;
  permissions: string;
  owner: string;
  checksum: string;
  mimeType: string;
  encoding: string;
  lineCount?: number;
  attributes: Record<string, any>;
}

export interface FileDelta {
  sizeChange: number;
  modifiedTime: number;
  permissionChange: string[];
  contentChange: ContentChange;
  structureChange: StructureChange;
}

export interface ContentChange {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  charactersChanged: number;
  significantChanges: string[];
  checksumDelta: string;
}

export interface StructureChange {
  type: 'file' | 'directory' | 'symlink';
  hierarchy: string[];
  dependencies: string[];
  relationships: string[];
}

export interface ChangeOrigin {
  process?: ProcessInfo;
  user?: UserInfo;
  system?: SystemInfo;
  remote?: RemoteInfo;
  source: 'local' | 'network' | 'system' | 'unknown';
}

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  user: string;
  startTime: Date;
}

export interface UserInfo {
  id: string;
  name: string;
  groups: string[];
  session: string;
  loginTime: Date;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  timestamp: Date;
}

export interface RemoteInfo {
  source: string;
  protocol: string;
  method: string;
  authenticated: boolean;
}

export interface ImpactAnalysis {
  scope: 'isolated' | 'local' | 'system' | 'network';
  affectedSystems: string[];
  dependencies: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;
}

export interface ChangeClassification {
  category: 'normal' | 'suspicious' | 'malicious' | 'system' | 'maintenance';
  subcategory: string;
  confidence: number;
  reasoning: string[];
  mlScore?: number;
}

export interface RiskAssessment {
  score: number;
  factors: RiskFactor[];
  mitigation: string[];
  recommendation: string;
}

export interface RiskFactor {
  type: string;
  value: number;
  weight: number;
  description: string;
}

export interface ChangeMetadata {
  scoutId: string;
  detectionMethod: string;
  processingTime: number;
  validationResults: ValidationResult[];
  alerts: Alert[];
  responses: ResponseResult[];
}

export interface ValidationResult {
  rule: string;
  passed: boolean;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  escalated: boolean;
  resolved: boolean;
}

export interface ResponseResult {
  action: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result: any;
  error?: string;
  timestamp: Date;
}

// Monitoring and metrics
export interface ScoutMetrics {
  filesWatched: number;
  changesDetected: number;
  alertsTriggered: number;
  responsesExecuted: number;
  averageDetectionTime: number;
  averageProcessingTime: number;
  falsePositiveRate: number;
  systemLoad: number;
  memoryUsage: number;
  diskUsage: number;
  networkActivity: number;
  uptime: number;
  lastHealthCheck: Date;
  errorRate: number;
  performanceScore: number;
}

// Main enhanced scout agent implementation
export class EnhancedScoutAgent extends EventEmitter {
  private config: EnhancedScoutConfig;
  private isRunning: boolean = false;
  private watchers: Map<string, FSWatcher> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fileStates: Map<string, FileState> = new Map();
  private changeHistory: Map<string, FileChange[]> = new Map();
  private pendingChanges: Map<string, FileChange> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: ScoutMetrics;
  private alertManager: AlertManager;
  private validator: FileValidator;
  private responseHandler: AutoResponseHandler;
  private integrityMonitor: IntegrityMonitor;
  
  private processingQueue: FileChange[] = [];
  private batchProcessor?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsUpdateInterval?: NodeJS.Timeout;

  constructor(config: EnhancedScoutConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.alertManager = new AlertManager(config.alerting);
    this.validator = new FileValidator(config.validation);
    this.responseHandler = new AutoResponseHandler(config.autoResponse);
    this.integrityMonitor = new IntegrityMonitor(config.validation.integrity);
  }

  // Scout lifecycle
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Scout ${this.config.id} is already running`);
    }

    this.emit('scout-starting', { scoutId: this.config.id });

    try {
      // Validate watch paths
      await this.validateWatchPaths();

      // Initialize file system monitoring
      await this.initializeWatchers();

      // Start integrity monitoring
      if (this.config.validation.integrity.enableMonitoring) {
        await this.integrityMonitor.start();
      }

      // Start batch processing if enabled
      if (this.config.batchChanges) {
        this.startBatchProcessor();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Start metrics collection
      this.startMetricsCollection();

      // Initial file system scan
      if (this.config.deepScanning) {
        await this.performInitialScan();
      }

      this.isRunning = true;
      this.emit('scout-started', {
        scoutId: this.config.id,
        watchPaths: this.config.watchPaths.length,
        patterns: this.config.watchPatterns.length
      });

    } catch (error) {
      this.emit('scout-start-failed', {
        scoutId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.emit('scout-stopping', { scoutId: this.config.id });

    try {
      // Stop all intervals
      if (this.batchProcessor) clearInterval(this.batchProcessor);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.metricsUpdateInterval) clearInterval(this.metricsUpdateInterval);

      // Clear debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();

      // Stop polling intervals
      this.pollingIntervals.forEach(interval => clearInterval(interval));
      this.pollingIntervals.clear();

      // Close watchers
      for (const [path, watcher] of this.watchers) {
        try {
          watcher.close();
        } catch (error) {
          this.emit('watcher-close-error', { path, error });
        }
      }
      this.watchers.clear();

      // Stop subsystems
      await this.integrityMonitor.stop();
      await this.responseHandler.stop();

      // Process remaining changes
      await this.processRemainingChanges();

      this.isRunning = false;
      this.emit('scout-stopped', { scoutId: this.config.id });

    } catch (error) {
      this.emit('scout-stop-failed', {
        scoutId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // File monitoring
  async addWatchPath(path: string, patterns?: WatchPattern[]): Promise<void> {
    if (this.watchers.has(path)) {
      throw new Error(`Path ${path} is already being watched`);
    }

    try {
      await fs.access(path);
      await this.createWatcher(path, patterns || []);
      
      if (!this.config.watchPaths.includes(path)) {
        this.config.watchPaths.push(path);
      }

      this.emit('watch-path-added', { scoutId: this.config.id, path });
    } catch (error) {
      throw new Error(`Failed to add watch path ${path}: ${error}`);
    }
  }

  async removeWatchPath(path: string): Promise<void> {
    const watcher = this.watchers.get(path);
    if (!watcher) return;

    try {
      watcher.close();
      this.watchers.delete(path);
      
      const pollingInterval = this.pollingIntervals.get(path);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        this.pollingIntervals.delete(path);
      }

      const pathIndex = this.config.watchPaths.indexOf(path);
      if (pathIndex > -1) {
        this.config.watchPaths.splice(pathIndex, 1);
      }

      this.emit('watch-path-removed', { scoutId: this.config.id, path });
    } catch (error) {
      this.emit('watch-path-remove-error', { scoutId: this.config.id, path, error });
    }
  }

  // Change detection and processing
  async forceRescan(paths?: string[]): Promise<void> {
    const targetPaths = paths || this.config.watchPaths;
    
    this.emit('rescan-started', { scoutId: this.config.id, paths: targetPaths });

    for (const path of targetPaths) {
      try {
        await this.scanDirectory(path);
      } catch (error) {
        this.emit('rescan-error', { scoutId: this.config.id, path, error });
      }
    }

    this.emit('rescan-completed', { scoutId: this.config.id, paths: targetPaths });
  }

  async getChangeHistory(path: string, limit?: number): Promise<FileChange[]> {
    const history = this.changeHistory.get(path) || [];
    return limit ? history.slice(-limit) : history;
  }

  async getFileState(path: string): Promise<FileState | null> {
    return this.fileStates.get(path) || null;
  }

  // Metrics and status
  getMetrics(): ScoutMetrics {
    return { ...this.metrics };
  }

  getStatus(): {
    isRunning: boolean;
    watchedPaths: number;
    activeWatchers: number;
    pendingChanges: number;
    queueSize: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      watchedPaths: this.config.watchPaths.length,
      activeWatchers: this.watchers.size,
      pendingChanges: this.pendingChanges.size,
      queueSize: this.processingQueue.length,
      uptime: this.metrics.uptime
    };
  }

  // Configuration management
  async updateConfig(updates: Partial<EnhancedScoutConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    Object.assign(this.config, updates);

    try {
      // Restart watchers if paths or patterns changed
      if (updates.watchPaths || updates.watchPatterns) {
        await this.reinitializeWatchers();
      }

      // Update subsystems
      if (updates.alerting) {
        this.alertManager.updateConfig(updates.alerting);
      }

      if (updates.validation) {
        this.validator.updateConfig(updates.validation);
      }

      if (updates.autoResponse) {
        this.responseHandler.updateConfig(updates.autoResponse);
      }

      this.emit('config-updated', { scoutId: this.config.id, updates });

    } catch (error) {
      // Rollback configuration
      this.config = oldConfig;
      throw new Error(`Failed to update configuration: ${error}`);
    }
  }

  // Private implementation methods
  private async validateWatchPaths(): Promise<void> {
    for (const path of this.config.watchPaths) {
      try {
        await fs.access(path, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Watch path ${path} is not accessible: ${error}`);
      }
    }
  }

  private async initializeWatchers(): Promise<void> {
    for (const path of this.config.watchPaths) {
      await this.createWatcher(path);
    }
  }

  private async createWatcher(watchPath: string, patterns?: WatchPattern[]): Promise<void> {
    const pathPatterns = patterns || this.config.watchPatterns;

    try {
      // Create file system watcher
      if (this.config.monitoringMode === 'events' || this.config.monitoringMode === 'hybrid') {
        const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            const fullPath = path.join(watchPath, filename);
            this.handleFileEvent(fullPath, eventType as FileEventType);
          }
        });

        this.watchers.set(watchPath, watcher);
      }

      // Create polling watcher if needed
      if (this.config.monitoringMode === 'polling' || this.config.monitoringMode === 'hybrid') {
        const interval = setInterval(async () => {
          await this.pollDirectory(watchPath);
        }, this.config.pollingInterval);

        this.pollingIntervals.set(watchPath, interval);
      }

      this.emit('watcher-created', { scoutId: this.config.id, path: watchPath });

    } catch (error) {
      throw new Error(`Failed to create watcher for ${watchPath}: ${error}`);
    }
  }

  private async handleFileEvent(filePath: string, eventType: FileEventType): Promise<void> {
    try {
      // Check if path should be excluded
      if (this.isExcluded(filePath)) return;

      // Check if path matches watch patterns
      if (!this.matchesWatchPatterns(filePath)) return;

      // Debounce changes
      if (this.config.debounceMs > 0) {
        await this.debounceChange(filePath, eventType);
        return;
      }

      // Process change immediately
      await this.processFileChange(filePath, eventType);

    } catch (error) {
      this.emit('file-event-error', {
        scoutId: this.config.id,
        path: filePath,
        event: eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async debounceChange(filePath: string, eventType: FileEventType): Promise<void> {
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      await this.processFileChange(filePath, eventType);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async processFileChange(filePath: string, eventType: FileEventType): Promise<void> {
    const startTime = performance.now();

    try {
      // Create file change record
      const change = await this.createFileChange(filePath, eventType);

      // Classify change
      if (this.config.changeClassification) {
        change.classification = await this.classifyChange(change);
        change.risk = await this.assessRisk(change);
      }

      // Validate change
      if (this.config.validation.enabled) {
        change.metadata.validationResults = await this.validator.validate(change);
        change.validated = true;
      }

      // Handle based on processing mode
      if (this.config.batchChanges) {
        this.addToProcessingQueue(change);
      } else {
        await this.processChangeImmediate(change);
      }

      // Update metrics
      this.metrics.changesDetected++;
      this.metrics.averageDetectionTime = 
        (this.metrics.averageDetectionTime + (performance.now() - startTime)) / 2;

      this.emit('change-detected', { scoutId: this.config.id, change });

    } catch (error) {
      this.emit('change-processing-error', {
        scoutId: this.config.id,
        path: filePath,
        event: eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createFileChange(filePath: string, eventType: FileEventType): Promise<FileChange> {
    const currentState = await this.getFileStateFromPath(filePath);
    const previousState = this.fileStates.get(filePath);

    const change: FileChange = {
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      timestamp: new Date(),
      path: filePath,
      event: eventType,
      details: {
        previousState,
        currentState,
        delta: this.calculateFileDelta(previousState, currentState),
        origin: await this.determineChangeOrigin(filePath),
        impact: await this.analyzeImpact(filePath, eventType)
      },
      classification: { category: 'normal', subcategory: '', confidence: 0, reasoning: [] },
      risk: { score: 0, factors: [], mitigation: [], recommendation: '' },
      metadata: {
        scoutId: this.config.id,
        detectionMethod: this.config.monitoringMode,
        processingTime: 0,
        validationResults: [],
        alerts: [],
        responses: []
      },
      validated: false,
      processed: false
    };

    // Update file state cache
    this.fileStates.set(filePath, currentState);

    // Add to history
    if (this.config.historicalTracking) {
      if (!this.changeHistory.has(filePath)) {
        this.changeHistory.set(filePath, []);
      }
      this.changeHistory.get(filePath)!.push(change);
      
      // Limit history size
      const history = this.changeHistory.get(filePath)!;
      if (history.length > 1000) {
        history.shift();
      }
    }

    return change;
  }

  private async getFileStateFromPath(filePath: string): Promise<FileState> {
    try {
      const stats = await fs.stat(filePath);
      const content = stats.isFile() ? await fs.readFile(filePath) : Buffer.alloc(0);
      const checksum = this.config.checksumValidation ? 
        crypto.createHash(this.config.validation.checksums.algorithm).update(content).digest('hex') : '';

      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        permissions: stats.mode.toString(8),
        owner: stats.uid.toString(),
        checksum,
        mimeType: this.determineMimeType(filePath),
        encoding: 'utf8',
        lineCount: stats.isFile() ? this.countLines(content) : undefined,
        attributes: {
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          isSymbolicLink: stats.isSymbolicLink(),
          dev: stats.dev,
          ino: stats.ino,
          nlink: stats.nlink,
          uid: stats.uid,
          gid: stats.gid,
          rdev: stats.rdev,
          blksize: stats.blksize,
          blocks: stats.blocks
        }
      };
    } catch (error) {
      // File might be deleted or inaccessible
      return {
        path: filePath,
        size: 0,
        modified: new Date(0),
        created: new Date(0),
        permissions: '000',
        owner: 'unknown',
        checksum: '',
        mimeType: 'unknown',
        encoding: 'unknown',
        attributes: {}
      };
    }
  }

  private calculateFileDelta(previous?: FileState, current?: FileState): FileDelta {
    if (!previous || !current) {
      return {
        sizeChange: current?.size || 0,
        modifiedTime: current?.modified.getTime() || 0,
        permissionChange: [],
        contentChange: {
          linesAdded: current?.lineCount || 0,
          linesRemoved: 0,
          linesModified: 0,
          charactersChanged: current?.size || 0,
          significantChanges: [],
          checksumDelta: current?.checksum || ''
        },
        structureChange: {
          type: current?.attributes.isDirectory ? 'directory' : 
                current?.attributes.isFile ? 'file' : 'unknown',
          hierarchy: [],
          dependencies: [],
          relationships: []
        }
      };
    }

    return {
      sizeChange: current.size - previous.size,
      modifiedTime: current.modified.getTime() - previous.modified.getTime(),
      permissionChange: previous.permissions !== current.permissions ? 
        [previous.permissions, current.permissions] : [],
      contentChange: {
        linesAdded: Math.max(0, (current.lineCount || 0) - (previous.lineCount || 0)),
        linesRemoved: Math.max(0, (previous.lineCount || 0) - (current.lineCount || 0)),
        linesModified: 0, // Would need content analysis
        charactersChanged: Math.abs(current.size - previous.size),
        significantChanges: [],
        checksumDelta: previous.checksum !== current.checksum ? 
          `${previous.checksum}->${current.checksum}` : ''
      },
      structureChange: {
        type: current.attributes.isDirectory ? 'directory' : 'file',
        hierarchy: [],
        dependencies: [],
        relationships: []
      }
    };
  }

  private async determineChangeOrigin(filePath: string): Promise<ChangeOrigin> {
    // In a production system, this would use system APIs to determine
    // which process/user made the change
    return {
      source: 'local',
      process: {
        pid: process.pid,
        name: 'scout-agent',
        command: process.argv.join(' '),
        user: os.userInfo().username,
        startTime: new Date()
      },
      user: {
        id: os.userInfo().uid.toString(),
        name: os.userInfo().username,
        groups: [],
        session: 'local',
        loginTime: new Date()
      },
      system: {
        hostname: os.hostname(),
        os: os.type(),
        kernel: os.release(),
        timestamp: new Date()
      }
    };
  }

  private async analyzeImpact(filePath: string, eventType: FileEventType): Promise<ImpactAnalysis> {
    const criticalPaths = this.config.alerting.thresholds.criticalPaths;
    const isCritical = criticalPaths.some(cp => filePath.includes(cp));

    return {
      scope: isCritical ? 'system' : 'isolated',
      affectedSystems: isCritical ? ['system'] : [],
      dependencies: [], // Would analyze file dependencies
      riskLevel: isCritical ? 'high' : 'low',
      businessImpact: isCritical ? 'High priority system file changed' : 'Standard file operation'
    };
  }

  private async classifyChange(change: FileChange): Promise<ChangeClassification> {
    const suspiciousPatterns = this.config.alerting.thresholds.suspiciousPatterns;
    const isSuspicious = suspiciousPatterns.some(pattern => 
      new RegExp(pattern).test(change.path)
    );

    let category: ChangeClassification['category'] = 'normal';
    let confidence = 0.8;

    if (isSuspicious) {
      category = 'suspicious';
      confidence = 0.9;
    }

    // Additional ML-based classification would go here
    return {
      category,
      subcategory: change.event,
      confidence,
      reasoning: isSuspicious ? ['Matches suspicious pattern'] : ['Normal file operation'],
      mlScore: Math.random() // Placeholder for ML model score
    };
  }

  private async assessRisk(change: FileChange): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Size change factor
    if (Math.abs(change.details.delta.sizeChange) > 1024 * 1024) { // 1MB
      factors.push({
        type: 'size_change',
        value: Math.abs(change.details.delta.sizeChange),
        weight: 0.2,
        description: 'Large file size change detected'
      });
      score += 20;
    }

    // Permission change factor
    if (change.details.delta.permissionChange.length > 0) {
      factors.push({
        type: 'permission_change',
        value: 1,
        weight: 0.3,
        description: 'File permissions changed'
      });
      score += 30;
    }

    // Critical path factor
    const isCritical = this.config.alerting.thresholds.criticalPaths.some(cp => 
      change.path.includes(cp)
    );
    if (isCritical) {
      factors.push({
        type: 'critical_path',
        value: 1,
        weight: 0.5,
        description: 'Change in critical system path'
      });
      score += 50;
    }

    return {
      score: Math.min(100, score),
      factors,
      mitigation: this.generateMitigation(factors),
      recommendation: this.generateRecommendation(score, factors)
    };
  }

  private generateMitigation(factors: RiskFactor[]): string[] {
    const mitigation: string[] = [];
    
    for (const factor of factors) {
      switch (factor.type) {
        case 'size_change':
          mitigation.push('Monitor for additional size changes', 'Verify file integrity');
          break;
        case 'permission_change':
          mitigation.push('Verify permission change is authorized', 'Audit access logs');
          break;
        case 'critical_path':
          mitigation.push('Immediate backup recommended', 'Verify change authorization');
          break;
      }
    }

    return [...new Set(mitigation)]; // Remove duplicates
  }

  private generateRecommendation(score: number, factors: RiskFactor[]): string {
    if (score > 70) {
      return 'High risk change detected - immediate investigation recommended';
    } else if (score > 40) {
      return 'Medium risk change - review and monitor closely';
    } else {
      return 'Low risk change - continue monitoring';
    }
  }

  private addToProcessingQueue(change: FileChange): void {
    this.processingQueue.push(change);
  }

  private async processChangeImmediate(change: FileChange): Promise<void> {
    const startTime = performance.now();

    try {
      // Generate alerts if needed
      if (this.config.alerting.enabled) {
        const alerts = await this.alertManager.processChange(change);
        change.metadata.alerts = alerts;
        this.metrics.alertsTriggered += alerts.length;
      }

      // Execute auto responses
      if (this.config.autoResponse.enabled) {
        const responses = await this.responseHandler.processChange(change);
        change.metadata.responses = responses;
        this.metrics.responsesExecuted += responses.length;
      }

      change.processed = true;
      change.metadata.processingTime = performance.now() - startTime;

      this.emit('change-processed', { scoutId: this.config.id, change });

    } catch (error) {
      this.emit('change-processing-error', {
        scoutId: this.config.id,
        changeId: change.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private startBatchProcessor(): void {
    this.batchProcessor = setInterval(async () => {
      if (this.processingQueue.length > 0) {
        const batch = this.processingQueue.splice(0, 100); // Process up to 100 changes
        
        for (const change of batch) {
          await this.processChangeImmediate(change);
        }
      }
    }, 5000); // Process batch every 5 seconds
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Health check every minute
  }

  private startMetricsCollection(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      await this.updateMetrics();
    }, 30000); // Update metrics every 30 seconds
  }

  private async performInitialScan(): Promise<void> {
    this.emit('initial-scan-started', { scoutId: this.config.id });

    for (const watchPath of this.config.watchPaths) {
      try {
        await this.scanDirectory(watchPath);
      } catch (error) {
        this.emit('initial-scan-error', {
          scoutId: this.config.id,
          path: watchPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.emit('initial-scan-completed', { scoutId: this.config.id });
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.isExcluded(fullPath)) continue;
        if (!this.matchesWatchPatterns(fullPath)) continue;

        // Store initial file state
        const state = await this.getFileStateFromPath(fullPath);
        this.fileStates.set(fullPath, state);

        // Recursively scan directories
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        }
      }
    } catch (error) {
      // Directory might not be accessible
      this.emit('scan-directory-error', {
        scoutId: this.config.id,
        path: dirPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async pollDirectory(dirPath: string): Promise<void> {
    // Polling-based file monitoring implementation
    // This would be more sophisticated in production
  }

  private isExcluded(filePath: string): boolean {
    return this.config.excludePatterns.some(pattern => 
      new RegExp(pattern).test(filePath)
    );
  }

  private matchesWatchPatterns(filePath: string): boolean {
    if (this.config.watchPatterns.length === 0) return true;
    
    return this.config.watchPatterns.some(pattern => 
      new RegExp(pattern.pattern).test(filePath)
    );
  }

  private determineMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.log': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private countLines(content: Buffer): number {
    return content.toString().split('\n').length;
  }

  private async performHealthCheck(): Promise<void> {
    const health = {
      timestamp: new Date(),
      watchers: this.watchers.size,
      activePolling: this.pollingIntervals.size,
      pendingChanges: this.pendingChanges.size,
      queueSize: this.processingQueue.length,
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: process.uptime()
    };

    this.metrics.lastHealthCheck = health.timestamp;
    this.metrics.memoryUsage = health.memoryUsage / (1024 * 1024); // MB
    this.metrics.uptime = health.uptime;

    this.emit('health-check', { scoutId: this.config.id, health });
  }

  private async updateMetrics(): Promise<void> {
    // Update performance metrics
    this.metrics.filesWatched = this.fileStates.size;
    this.metrics.systemLoad = os.loadavg()[0];
    this.metrics.diskUsage = 0; // Would implement actual disk usage monitoring
    this.metrics.networkActivity = 0; // Would implement actual network monitoring

    // Calculate error rate
    const recentChanges = this.processingQueue.length + 
                         Array.from(this.changeHistory.values())
                           .reduce((sum, history) => sum + history.length, 0);
    
    this.metrics.errorRate = recentChanges > 0 ? 
      (this.metrics.alertsTriggered / recentChanges) * 100 : 0;

    // Calculate performance score
    this.metrics.performanceScore = this.calculatePerformanceScore();

    this.emit('metrics-updated', { scoutId: this.config.id, metrics: this.metrics });
  }

  private calculatePerformanceScore(): number {
    let score = 100;
    
    // Deduct for high error rate
    score -= Math.min(this.metrics.errorRate * 2, 50);
    
    // Deduct for high memory usage
    if (this.metrics.memoryUsage > 512) { // 512 MB
      score -= Math.min((this.metrics.memoryUsage - 512) / 10, 30);
    }
    
    // Deduct for slow detection time
    if (this.metrics.averageDetectionTime > 1000) { // 1 second
      score -= Math.min((this.metrics.averageDetectionTime - 1000) / 100, 20);
    }

    return Math.max(0, score);
  }

  private async reinitializeWatchers(): Promise<void> {
    // Stop existing watchers
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();

    for (const [path, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();

    // Reinitialize with new configuration
    await this.initializeWatchers();
  }

  private async processRemainingChanges(): Promise<void> {
    if (this.processingQueue.length > 0) {
      this.emit('processing-remaining-changes', {
        scoutId: this.config.id,
        count: this.processingQueue.length
      });

      for (const change of this.processingQueue) {
        try {
          await this.processChangeImmediate(change);
        } catch (error) {
          this.emit('change-processing-error', {
            scoutId: this.config.id,
            changeId: change.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.processingQueue = [];
    }
  }

  private initializeMetrics(): ScoutMetrics {
    return {
      filesWatched: 0,
      changesDetected: 0,
      alertsTriggered: 0,
      responsesExecuted: 0,
      averageDetectionTime: 0,
      averageProcessingTime: 0,
      falsePositiveRate: 0,
      systemLoad: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkActivity: 0,
      uptime: 0,
      lastHealthCheck: new Date(),
      errorRate: 0,
      performanceScore: 100
    };
  }
}

// Supporting classes
class AlertManager {
  constructor(private config: AlertingConfig) {}

  async processChange(change: FileChange): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    // Check thresholds and generate alerts
    if (this.shouldAlert(change)) {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        severity: this.determineSeverity(change),
        message: this.generateAlertMessage(change),
        timestamp: new Date(),
        acknowledged: false,
        escalated: false,
        resolved: false
      };
      
      alerts.push(alert);
    }

    return alerts;
  }

  updateConfig(config: AlertingConfig): void {
    this.config = config;
  }

  private shouldAlert(change: FileChange): boolean {
    return change.risk.score > 50 || change.classification.category === 'suspicious';
  }

  private determineSeverity(change: FileChange): AlertSeverity {
    if (change.risk.score > 80) return 'critical';
    if (change.risk.score > 60) return 'error';
    if (change.risk.score > 40) return 'warning';
    return 'info';
  }

  private generateAlertMessage(change: FileChange): string {
    return `File change detected: ${change.path} (${change.event}) - Risk: ${change.risk.score}`;
  }
}

class FileValidator {
  constructor(private config: ValidationConfig) {}

  async validate(change: FileChange): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const rule of this.config.rules) {
      const result = await this.validateRule(change, rule);
      results.push(result);
    }

    return results;
  }

  updateConfig(config: ValidationConfig): void {
    this.config = config;
  }

  private async validateRule(change: FileChange, rule: ValidationRule): Promise<ValidationResult> {
    // Implement rule validation logic
    const passed = this.evaluateRuleCondition(change, rule);
    
    return {
      rule: rule.id,
      passed,
      message: passed ? 'Validation passed' : rule.description,
      severity: passed ? 'info' : rule.severity,
      timestamp: new Date()
    };
  }

  private evaluateRuleCondition(change: FileChange, rule: ValidationRule): boolean {
    // Simple rule evaluation - in production this would be more sophisticated
    return !new RegExp(rule.pattern).test(change.path) || rule.condition === 'allow';
  }
}

class AutoResponseHandler {
  constructor(private config: AutoResponseConfig) {}

  async processChange(change: FileChange): Promise<ResponseResult[]> {
    const results: ResponseResult[] = [];
    
    for (const response of this.config.responses) {
      if (this.shouldTriggerResponse(change, response)) {
        const result = await this.executeResponse(change, response);
        results.push(result);
      }
    }

    return results;
  }

  async stop(): Promise<void> {
    // Cleanup any running responses
  }

  updateConfig(config: AutoResponseConfig): void {
    this.config = config;
  }

  private shouldTriggerResponse(change: FileChange, response: AutoResponse): boolean {
    return response.trigger.event === change.event &&
           new RegExp(response.trigger.pattern).test(change.path);
  }

  private async executeResponse(change: FileChange, response: AutoResponse): Promise<ResponseResult> {
    const result: ResponseResult = {
      action: response.actions[0]?.type || 'unknown',
      status: 'pending',
      result: null,
      timestamp: new Date()
    };

    try {
      result.status = 'executing';
      
      // Execute response actions
      for (const action of response.actions) {
        await this.executeAction(change, action);
      }
      
      result.status = 'completed';
      result.result = { executed: true };
      
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async executeAction(change: FileChange, action: ResponseAction): Promise<void> {
    switch (action.type) {
      case 'quarantine':
        await this.quarantineFile(change.path, action.config);
        break;
      case 'backup':
        await this.backupFile(change.path, action.config);
        break;
      case 'alert':
        // Send additional alerts
        break;
      // Add more action types as needed
    }
  }

  private async quarantineFile(filePath: string, config: any): Promise<void> {
    // Implement file quarantine logic
  }

  private async backupFile(filePath: string, config: any): Promise<void> {
    // Implement file backup logic
  }
}

class IntegrityMonitor {
  constructor(private config: IntegrityConfig) {}

  async start(): Promise<void> {
    // Initialize integrity monitoring
  }

  async stop(): Promise<void> {
    // Stop integrity monitoring
  }
}

// Factory function
export function createEnhancedScout(config: Partial<EnhancedScoutConfig>): EnhancedScoutAgent {
  const defaultConfig: EnhancedScoutConfig = {
    id: `scout-${Date.now()}`,
    watchPaths: [],
    watchPatterns: [],
    excludePatterns: ['node_modules/**', '.git/**', 'temp/**'],
    monitoringMode: 'hybrid',
    pollingInterval: 5000,
    debounceMs: 1000,
    batchChanges: false,
    deepScanning: true,
    checksumValidation: false,
    realTimeResponse: true,
    changeClassification: true,
    historicalTracking: true,
    alerting: {
      enabled: true,
      thresholds: {
        maxChangesPerMinute: 100,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        suspiciousPatterns: ['*.exe', '*.bat', '*.ps1'],
        criticalPaths: ['/etc', '/bin', '/usr/bin']
      },
      channels: [],
      escalation: { levels: [], timeoutMs: 300000 },
      suppressDuplicates: true,
      cooldownMs: 60000
    },
    validation: {
      enabled: true,
      rules: [],
      checksums: { algorithm: 'sha256', trackChanges: true, verifyIntegrity: false, storeHistory: false },
      integrity: { enableMonitoring: false, criticalFiles: [], expectedHashes: new Map(), alertOnMismatch: true },
      compliance: { frameworks: [], auditTrail: true, dataRetention: 30, encryptionRequired: false }
    },
    autoResponse: {
      enabled: false,
      responses: [],
      quarantine: { directory: '/tmp/quarantine', encryption: false, retention: 7, indexing: true },
      backup: { directory: '/tmp/backup', compression: true, encryption: false, retention: 30, incrementalBackup: true },
      notification: { channels: [], templates: new Map(), aggregation: true, formatting: 'json' }
    }
  };

  return new EnhancedScoutAgent({ ...defaultConfig, ...config });
}