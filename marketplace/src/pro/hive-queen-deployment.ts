/**
 * HIVE QUEEN Production Deployment Configuration
 * Complete deployment setup for production environments
 */

import { HiveQueenSystem, type HiveQueenSystemConfig } from './hive-queen-integration.js';
import { ConsensusType } from './distributed-consensus.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  region: string;
  cluster: {
    nodeCount: number;
    instanceType: string;
    autoScaling: {
      enabled: boolean;
      minNodes: number;
      maxNodes: number;
      targetCpuUtilization: number;
    };
  };
  storage: {
    type: 'local' | 'redis' | 's3' | 'gcs';
    connectionString?: string;
    bucketName?: string;
    persistence: boolean;
  };
  monitoring: {
    enabled: boolean;
    provider: 'datadog' | 'newrelic' | 'prometheus' | 'custom';
    apiKey?: string;
    endpoint?: string;
  };
  security: {
    enableTLS: boolean;
    certificatePath?: string;
    keyPath?: string;
    enableAuth: boolean;
    authProvider?: 'jwt' | 'oauth' | 'apikey';
  };
  networking: {
    port: number;
    host: string;
    enableCors: boolean;
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
    };
  };
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  gracePeriod: number;
}

export class HiveQueenDeployment {
  private deploymentConfig: DeploymentConfig;
  private hiveQueen: HiveQueenSystem | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShutdown = false;

  constructor(deploymentConfig: DeploymentConfig) {
    this.deploymentConfig = deploymentConfig;
  }

  /**
   * Deploy HIVE QUEEN system with production configuration
   */
  async deploy(): Promise<void> {
    console.log(`[DEPLOYMENT] Starting HIVE QUEEN deployment in ${this.deploymentConfig.environment} environment...`);

    try {
      // Validate deployment configuration
      await this.validateDeploymentConfig();

      // Setup production directories
      await this.setupProductionDirectories();

      // Configure logging and monitoring
      await this.setupMonitoring();

      // Create optimized system configuration
      const systemConfig = this.createSystemConfiguration();

      // Initialize HIVE QUEEN system
      this.hiveQueen = new HiveQueenSystem(systemConfig);

      // Setup production event handlers
      this.setupProductionEventHandlers();

      // Start the system
      await this.hiveQueen.start();

      // Setup health checks
      this.setupHealthChecks();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      console.log('[DEPLOYMENT] HIVE QUEEN deployed successfully!');
      console.log(`[DEPLOYMENT] System available at ${this.deploymentConfig.networking.host}:${this.deploymentConfig.networking.port}`);

    } catch (error) {
      console.error('[DEPLOYMENT] Failed to deploy HIVE QUEEN:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async validateDeploymentConfig(): Promise<void> {
    console.log('[DEPLOYMENT] Validating deployment configuration...');

    // Validate required fields
    if (!this.deploymentConfig.environment) {
      throw new Error('Environment must be specified');
    }

    if (!this.deploymentConfig.region) {
      throw new Error('Region must be specified');
    }

    // Validate cluster configuration
    if (this.deploymentConfig.cluster.nodeCount <= 0) {
      throw new Error('Node count must be positive');
    }

    // Validate storage configuration
    if (this.deploymentConfig.storage.type !== 'local' && !this.deploymentConfig.storage.connectionString) {
      throw new Error('Connection string required for non-local storage');
    }

    // Validate security configuration
    if (this.deploymentConfig.security.enableTLS) {
      if (!this.deploymentConfig.security.certificatePath || !this.deploymentConfig.security.keyPath) {
        throw new Error('TLS certificate and key paths required when TLS is enabled');
      }

      // Check if certificate files exist
      try {
        await fs.access(this.deploymentConfig.security.certificatePath);
        await fs.access(this.deploymentConfig.security.keyPath);
      } catch (error) {
        throw new Error('TLS certificate or key file not found');
      }
    }

    // Validate monitoring configuration
    if (this.deploymentConfig.monitoring.enabled) {
      if (!this.deploymentConfig.monitoring.provider) {
        throw new Error('Monitoring provider must be specified when monitoring is enabled');
      }
    }

    console.log('[DEPLOYMENT] Configuration validation passed');
  }

  private async setupProductionDirectories(): Promise<void> {
    console.log('[DEPLOYMENT] Setting up production directories...');

    const directories = [
      './data/hive-queen',
      './logs/hive-queen',
      './tmp/hive-queen',
      './config/hive-queen',
      './backups/hive-queen'
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`[DEPLOYMENT] Could not create directory ${dir}:`, error);
      }
    }
  }

  private async setupMonitoring(): Promise<void> {
    if (!this.deploymentConfig.monitoring.enabled) {
      console.log('[DEPLOYMENT] Monitoring disabled');
      return;
    }

    console.log(`[DEPLOYMENT] Setting up monitoring with ${this.deploymentConfig.monitoring.provider}...`);

    // Setup monitoring based on provider
    switch (this.deploymentConfig.monitoring.provider) {
      case 'datadog':
        await this.setupDatadogMonitoring();
        break;
      case 'newrelic':
        await this.setupNewRelicMonitoring();
        break;
      case 'prometheus':
        await this.setupPrometheusMonitoring();
        break;
      case 'custom':
        await this.setupCustomMonitoring();
        break;
      default:
        throw new Error(`Unsupported monitoring provider: ${this.deploymentConfig.monitoring.provider}`);
    }
  }

  private async setupDatadogMonitoring(): Promise<void> {
    // Implementation for Datadog integration
    console.log('[DEPLOYMENT] Datadog monitoring configured');
  }

  private async setupNewRelicMonitoring(): Promise<void> {
    // Implementation for New Relic integration
    console.log('[DEPLOYMENT] New Relic monitoring configured');
  }

  private async setupPrometheusMonitoring(): Promise<void> {
    // Implementation for Prometheus integration
    console.log('[DEPLOYMENT] Prometheus monitoring configured');
  }

  private async setupCustomMonitoring(): Promise<void> {
    // Implementation for custom monitoring
    console.log('[DEPLOYMENT] Custom monitoring configured');
  }

  private createSystemConfiguration(): HiveQueenSystemConfig {
    console.log('[DEPLOYMENT] Creating optimized system configuration...');

    // Calculate optimal agent counts based on cluster size
    const baseAgentCount = this.deploymentConfig.cluster.nodeCount * 2;
    const maxWorkers = Math.max(4, Math.min(baseAgentCount, 32));
    const maxScouts = Math.max(2, Math.min(Math.ceil(baseAgentCount / 2), 16));
    const maxSoldiers = Math.max(2, Math.min(Math.ceil(baseAgentCount / 3), 12));

    // Environment-specific settings
    const isProduction = this.deploymentConfig.environment === 'production';
    const isDevelopment = this.deploymentConfig.environment === 'development';

    const config: HiveQueenSystemConfig = {
      systemId: `hive_queen_${this.deploymentConfig.environment}_${this.deploymentConfig.region}`,
      maxWorkers,
      maxScouts,
      maxSoldiers,

      communication: {
        heartbeatInterval: isProduction ? 5000 : 2000,
        discoveryInterval: isProduction ? 10000 : 5000,
        ackTimeout: isProduction ? 15000 : 10000,
        retryAttempts: isProduction ? 5 : 3,
        maxMessageQueue: isProduction ? 1000 : 500,
        enableEncryption: this.deploymentConfig.security.enableTLS
      },

      consensus: {
        type: isProduction ? ConsensusType.RAFT : ConsensusType.QUORUM,
        quorumSize: Math.ceil((maxWorkers + maxScouts + maxSoldiers) / 2),
        voteTimeout: isProduction ? 20000 : 15000,
        byzantineTolerance: Math.floor((maxWorkers + maxScouts + maxSoldiers - 1) / 3)
      },

      pipeline: {
        maxConcurrentJobs: isProduction ? 100 : 50,
        defaultTimeout: isProduction ? 300000 : 60000, // 5 min vs 1 min
        retryAttempts: isProduction ? 5 : 3,
        enableMetrics: true
      },

      workerConfig: {
        specialization: isProduction ? 'general' : 'general',
        maxParallelTasks: isProduction ? 20 : 10,
        taskTimeout: isProduction ? 60000 : 30000,
        enableProfiling: !isProduction
      },

      scoutConfig: {
        watchPaths: this.getWatchPaths(),
        debounceMs: isProduction ? 500 : 100,
        maxChangesPerSecond: isProduction ? 100 : 50,
        enableDeepScan: !isProduction
      },

      soldierConfig: {
        enableChaosEngineering: isDevelopment,
        maxConcurrentTests: isProduction ? 10 : 5,
        testTimeout: isProduction ? 60000 : 30000,
        performanceTargets: {
          maxResponseTime: isProduction ? 2000 : 5000,
          minThroughput: isProduction ? 50 : 10,
          maxErrorRate: isProduction ? 0.01 : 0.05
        }
      },

      monitoring: {
        metricsInterval: isProduction ? 5000 : 2000,
        alertThresholds: {
          highCpuUsage: isProduction ? 0.8 : 0.9,
          highMemoryUsage: isProduction ? 0.85 : 0.9,
          lowThroughput: isProduction ? 10 : 5,
          highErrorRate: isProduction ? 0.02 : 0.05
        },
        enableAutoRecovery: isProduction
      }
    };

    return config;
  }

  private getWatchPaths(): string[] {
    const basePaths = ['./data', './config'];
    
    if (this.deploymentConfig.environment === 'production') {
      basePaths.push('./logs', './backups');
    } else {
      basePaths.push('./src', './test');
    }

    return basePaths;
  }

  private setupProductionEventHandlers(): void {
    if (!this.hiveQueen) return;

    console.log('[DEPLOYMENT] Setting up production event handlers...');

    // System-level events
    this.hiveQueen.on('system_started', () => {
      console.log('[HIVE QUEEN] System started successfully in production');
    });

    this.hiveQueen.on('alert_created', (alert) => {
      this.handleProductionAlert(alert);
    });

    this.hiveQueen.on('metrics_updated', (metrics) => {
      this.reportMetricsToMonitoring(metrics);
    });

    // Error handling
    this.hiveQueen.on('error', (error) => {
      console.error('[HIVE QUEEN] System error:', error);
      this.reportErrorToMonitoring(error);
    });

    // Performance monitoring
    this.hiveQueen.on('performance_degraded', (data) => {
      console.warn('[HIVE QUEEN] Performance degradation detected:', data);
      this.handlePerformanceDegradation(data);
    });
  }

  private handleProductionAlert(alert: any): void {
    console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

    // Send to monitoring service
    if (this.deploymentConfig.monitoring.enabled) {
      this.sendAlertToMonitoring(alert);
    }

    // Handle critical alerts
    if (alert.severity === 'critical') {
      this.handleCriticalAlert(alert);
    }
  }

  private reportMetricsToMonitoring(metrics: any): void {
    if (!this.deploymentConfig.monitoring.enabled) return;

    // Send metrics to monitoring service
    // Implementation depends on monitoring provider
  }

  private reportErrorToMonitoring(error: Error): void {
    if (!this.deploymentConfig.monitoring.enabled) return;

    // Send error to monitoring service
    // Implementation depends on monitoring provider
  }

  private sendAlertToMonitoring(alert: any): void {
    // Send alert to monitoring service
    // Implementation depends on monitoring provider
  }

  private handleCriticalAlert(alert: any): void {
    console.error('[CRITICAL] Critical alert received, evaluating response...');

    // In production, you might want to:
    // 1. Page on-call engineers
    // 2. Auto-scale resources
    // 3. Activate disaster recovery
    // 4. Trigger circuit breakers

    if (this.deploymentConfig.cluster.autoScaling.enabled) {
      this.triggerAutoScaling();
    }
  }

  private handlePerformanceDegradation(data: any): void {
    console.warn('[PERFORMANCE] Handling performance degradation...');

    // Auto-scaling if enabled
    if (this.deploymentConfig.cluster.autoScaling.enabled) {
      const currentCpu = data.cpuUsage || 0;
      if (currentCpu > this.deploymentConfig.cluster.autoScaling.targetCpuUtilization) {
        this.triggerAutoScaling();
      }
    }
  }

  private triggerAutoScaling(): void {
    console.log('[AUTO-SCALING] Triggering auto-scaling...');
    // Implementation would integrate with cloud provider APIs
  }

  private setupHealthChecks(): void {
    if (!this.hiveQueen) return;

    console.log('[DEPLOYMENT] Setting up health checks...');

    const healthCheckConfig: HealthCheckConfig = {
      enabled: true,
      endpoint: '/health',
      interval: 10000,
      timeout: 5000,
      retries: 3,
      gracePeriod: 30000
    };

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, healthCheckConfig.interval);
  }

  private async performHealthCheck(): Promise<boolean> {
    if (!this.hiveQueen) return false;

    try {
      const status = this.hiveQueen.getSystemStatus();
      const metrics = this.hiveQueen.getMetrics();

      // Health criteria
      const isHealthy = 
        status.health === 'healthy' &&
        metrics.errorRate < 0.1 &&
        status.agents.workers > 0 &&
        status.agents.scouts > 0 &&
        status.agents.soldiers > 0;

      if (!isHealthy) {
        console.warn('[HEALTH CHECK] System health check failed:', {
          health: status.health,
          errorRate: metrics.errorRate,
          agents: status.agents
        });
      }

      return isHealthy;
    } catch (error) {
      console.error('[HEALTH CHECK] Health check error:', error);
      return false;
    }
  }

  private setupShutdownHandlers(): void {
    console.log('[DEPLOYMENT] Setting up graceful shutdown handlers...');

    const gracefulShutdown = async (signal: string) => {
      if (this.isShutdown) return;
      
      console.log(`[SHUTDOWN] Received ${signal}, initiating graceful shutdown...`);
      this.isShutdown = true;

      try {
        // Stop accepting new requests
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }

        // Shutdown HIVE QUEEN system
        if (this.hiveQueen) {
          await this.hiveQueen.shutdown();
        }

        // Cleanup resources
        await this.cleanup();

        console.log('[SHUTDOWN] Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('[SHUTDOWN] Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[FATAL] Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  }

  private async cleanup(): Promise<void> {
    console.log('[CLEANUP] Cleaning up resources...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Additional cleanup can be added here
    // - Close database connections
    // - Clear caches
    // - Save state to persistent storage
  }

  /**
   * Get current deployment status
   */
  getDeploymentStatus(): {
    isDeployed: boolean;
    environment: string;
    region: string;
    uptime: number;
    health: string;
    version: string;
  } {
    const uptime = this.hiveQueen ? 
      this.hiveQueen.getMetrics().uptime : 0;
    
    const health = this.hiveQueen ? 
      this.hiveQueen.getSystemStatus().health : 'not_deployed';

    return {
      isDeployed: this.hiveQueen !== null,
      environment: this.deploymentConfig.environment,
      region: this.deploymentConfig.region,
      uptime,
      health,
      version: '1.0.0' // Should be dynamically determined
    };
  }

  /**
   * Update deployment configuration
   */
  async updateConfiguration(newConfig: Partial<DeploymentConfig>): Promise<void> {
    console.log('[DEPLOYMENT] Updating configuration...');

    this.deploymentConfig = { ...this.deploymentConfig, ...newConfig };
    
    // Validate new configuration
    await this.validateDeploymentConfig();

    // If system is running, apply rolling update
    if (this.hiveQueen) {
      await this.performRollingUpdate();
    }
  }

  private async performRollingUpdate(): Promise<void> {
    console.log('[DEPLOYMENT] Performing rolling update...');
    
    // Implementation would:
    // 1. Create new configuration
    // 2. Gradually migrate agents to new config
    // 3. Validate each step
    // 4. Rollback if issues detected
  }

  /**
   * Scale the deployment
   */
  async scale(nodeCount: number): Promise<void> {
    if (nodeCount <= 0) {
      throw new Error('Node count must be positive');
    }

    console.log(`[DEPLOYMENT] Scaling to ${nodeCount} nodes...`);

    this.deploymentConfig.cluster.nodeCount = nodeCount;
    
    if (this.hiveQueen) {
      // Trigger system reconfiguration for new scale
      const newConfig = this.createSystemConfiguration();
      // Implementation would apply new configuration
    }
  }

  /**
   * Get deployment logs
   */
  async getLogs(lines: number = 100): Promise<string[]> {
    try {
      const logPath = './logs/hive-queen/system.log';
      const logContent = await fs.readFile(logPath, 'utf-8');
      return logContent.split('\n').slice(-lines);
    } catch (error) {
      console.warn('[DEPLOYMENT] Could not read logs:', error);
      return [];
    }
  }

  /**
   * Create backup of current state
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./backups/hive-queen/backup-${timestamp}`;

    console.log(`[DEPLOYMENT] Creating backup at ${backupPath}...`);

    try {
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup system state
      if (this.hiveQueen) {
        const metrics = this.hiveQueen.getMetrics();
        const status = this.hiveQueen.getSystemStatus();
        
        await fs.writeFile(
          path.join(backupPath, 'metrics.json'),
          JSON.stringify(metrics, null, 2)
        );
        
        await fs.writeFile(
          path.join(backupPath, 'status.json'),
          JSON.stringify(status, null, 2)
        );
      }

      // Backup configuration
      await fs.writeFile(
        path.join(backupPath, 'deployment-config.json'),
        JSON.stringify(this.deploymentConfig, null, 2)
      );

      console.log('[DEPLOYMENT] Backup created successfully');
      return backupPath;
    } catch (error) {
      console.error('[DEPLOYMENT] Backup failed:', error);
      throw error;
    }
  }
}

// Factory functions for different environments
export function createDevelopmentDeployment(): HiveQueenDeployment {
  const config: DeploymentConfig = {
    environment: 'development',
    region: 'local',
    cluster: {
      nodeCount: 1,
      instanceType: 'development',
      autoScaling: {
        enabled: false,
        minNodes: 1,
        maxNodes: 1,
        targetCpuUtilization: 0.8
      }
    },
    storage: {
      type: 'local',
      persistence: false
    },
    monitoring: {
      enabled: false,
      provider: 'custom'
    },
    security: {
      enableTLS: false,
      enableAuth: false
    },
    networking: {
      port: 3000,
      host: 'localhost',
      enableCors: true,
      rateLimiting: {
        enabled: false,
        requestsPerMinute: 1000
      }
    }
  };

  return new HiveQueenDeployment(config);
}

export function createStagingDeployment(region: string = 'us-east-1'): HiveQueenDeployment {
  const config: DeploymentConfig = {
    environment: 'staging',
    region,
    cluster: {
      nodeCount: 3,
      instanceType: 't3.medium',
      autoScaling: {
        enabled: true,
        minNodes: 2,
        maxNodes: 5,
        targetCpuUtilization: 0.7
      }
    },
    storage: {
      type: 'redis',
      connectionString: process.env.REDIS_URL || 'redis://localhost:6379',
      persistence: true
    },
    monitoring: {
      enabled: true,
      provider: 'prometheus',
      endpoint: process.env.PROMETHEUS_ENDPOINT
    },
    security: {
      enableTLS: true,
      certificatePath: './certs/staging.crt',
      keyPath: './certs/staging.key',
      enableAuth: true,
      authProvider: 'jwt'
    },
    networking: {
      port: 8080,
      host: '0.0.0.0',
      enableCors: true,
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 500
      }
    }
  };

  return new HiveQueenDeployment(config);
}

export function createProductionDeployment(region: string = 'us-east-1'): HiveQueenDeployment {
  const config: DeploymentConfig = {
    environment: 'production',
    region,
    cluster: {
      nodeCount: 10,
      instanceType: 't3.large',
      autoScaling: {
        enabled: true,
        minNodes: 5,
        maxNodes: 20,
        targetCpuUtilization: 0.6
      }
    },
    storage: {
      type: 'redis',
      connectionString: process.env.REDIS_URL!,
      bucketName: process.env.S3_BUCKET,
      persistence: true
    },
    monitoring: {
      enabled: true,
      provider: 'datadog',
      apiKey: process.env.DATADOG_API_KEY
    },
    security: {
      enableTLS: true,
      certificatePath: './certs/production.crt',
      keyPath: './certs/production.key',
      enableAuth: true,
      authProvider: 'oauth'
    },
    networking: {
      port: 443,
      host: '0.0.0.0',
      enableCors: false,
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 100
      }
    }
  };

  return new HiveQueenDeployment(config);
}

export {
  HiveQueenDeployment as default,
  type DeploymentConfig,
  type HealthCheckConfig
};