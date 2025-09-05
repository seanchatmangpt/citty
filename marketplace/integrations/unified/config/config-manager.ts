import { EventEmitter } from 'events';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, watchFile, unwatchFile } from 'fs';
import { join } from 'path';
import { Logger } from '../monitoring/logger';

// Configuration schemas
const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(false),
  pool: z.object({
    min: z.number().default(2),
    max: z.number().default(10),
    acquireTimeoutMillis: z.number().default(30000),
    idleTimeoutMillis: z.number().default(30000)
  }).optional()
});

const RedisConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  password: z.string().optional(),
  database: z.number().default(0),
  keyPrefix: z.string().default('unified:'),
  retryDelayOnFailover: z.number().default(100),
  maxRetriesPerRequest: z.number().default(3)
});

const SystemEndpointSchema = z.object({
  url: z.string().url(),
  timeout: z.number().default(30000),
  retries: z.number().default(3),
  weight: z.number().default(1),
  healthCheck: z.object({
    endpoint: z.string().default('/health'),
    interval: z.number().default(30000),
    timeout: z.number().default(5000)
  }).optional(),
  rateLimit: z.object({
    requests: z.number(),
    window: z.number()
  }).optional()
});

const SystemConfigSchema = z.object({
  endpoints: z.record(z.string(), SystemEndpointSchema),
  auth: z.object({
    type: z.enum(['none', 'api-key', 'bearer', 'oauth2', 'custom']),
    config: z.unknown()
  }),
  features: z.record(z.string(), z.boolean()),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60000),
    healthcheckInterval: z.number().default(30000)
  })
});

const UnifiedConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  version: z.string(),
  
  // System configurations
  systems: z.object({
    cns: SystemConfigSchema,
    bytestar: SystemConfigSchema,
    marketplace: SystemConfigSchema
  }),
  
  // Gateway configuration
  gateway: z.object({
    port: z.number().default(3000),
    cors: z.object({
      origins: z.array(z.string()),
      methods: z.array(z.string()),
      headers: z.array(z.string())
    }),
    rateLimit: z.object({
      global: z.object({ requests: z.number(), window: z.number() }),
      perUser: z.object({ requests: z.number(), window: z.number() }),
      perResource: z.record(z.string(), z.object({ 
        requests: z.number(), 
        window: z.number() 
      }))
    }),
    loadBalancing: z.object({
      strategy: z.enum(['round-robin', 'weighted-round-robin', 'least-connections', 'least-response-time', 'health-based']),
      healthCheck: z.object({
        enabled: z.boolean().default(true),
        interval: z.number().default(30000),
        timeout: z.number().default(5000),
        unhealthyThreshold: z.number().default(3),
        healthyThreshold: z.number().default(2)
      })
    }),
    circuitBreaker: z.object({
      failureThreshold: z.number().default(5),
      successThreshold: z.number().default(3),
      timeout: z.number().default(60000),
      monitoringPeriod: z.number().default(60000),
      volumeThreshold: z.number().default(10),
      errorRate: z.number().min(0).max(1).default(0.5)
    })
  }),
  
  // Authentication configuration
  authentication: z.object({
    required: z.boolean().default(true),
    excludedPaths: z.array(z.string()),
    tokenExpiration: z.number().default(3600000), // 1 hour
    secretKey: z.string(),
    supportedMethods: z.array(z.enum(['api-key', 'bearer', 'oauth2', 'custom'])),
    oauth2: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      tokenEndpoint: z.string().url(),
      userInfoEndpoint: z.string().url()
    }).optional()
  }),
  
  // Database configuration
  database: DatabaseConfigSchema.optional(),
  
  // Redis configuration
  redis: RedisConfigSchema.optional(),
  
  // Monitoring configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    metricsInterval: z.number().default(60000),
    retentionPeriod: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
    alertThresholds: z.object({
      errorRate: z.number().min(0).max(1).default(0.1),
      responseTime: z.number().default(2000),
      throughput: z.number().default(1000)
    }),
    exporters: z.array(z.enum(['console', 'file', 'prometheus', 'datadog'])).default(['console'])
  }),
  
  // Event bus configuration
  eventBus: z.object({
    maxListeners: z.number().default(100),
    enablePersistence: z.boolean().default(false),
    persistencePath: z.string().optional(),
    deadLetterQueue: z.boolean().default(true),
    retryPolicy: z.object({
      maxRetries: z.number().default(3),
      initialDelay: z.number().default(1000),
      maxDelay: z.number().default(10000),
      backoffMultiplier: z.number().default(2)
    }),
    circuitBreaker: z.object({
      failureThreshold: z.number().default(5),
      resetTimeout: z.number().default(60000)
    })
  }),
  
  // Workflow engine configuration
  workflows: z.object({
    maxConcurrentExecutions: z.number().default(100),
    defaultTimeout: z.number().default(300000), // 5 minutes
    enablePersistence: z.boolean().default(true),
    cleanupInterval: z.number().default(3600000), // 1 hour
    retryPolicy: z.object({
      maxRetries: z.number().default(3),
      initialDelay: z.number().default(1000),
      backoffMultiplier: z.number().default(2
    })
  }),
  
  // Feature flags
  features: z.record(z.string(), z.boolean()).default({}),
  
  // Custom extensions
  extensions: z.record(z.string(), z.unknown()).default({})
});

export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>;

interface ConfigSource {
  type: 'file' | 'environment' | 'remote' | 'memory';
  priority: number;
  source: string | object;
}

interface ConfigChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export class ConfigManager extends EventEmitter {
  private logger: Logger;
  private config: UnifiedConfig;
  private sources: ConfigSource[] = [];
  private watchers: Map<string, boolean> = new Map();
  private validationEnabled: boolean = true;
  private configPath?: string;

  constructor() {
    super();
    this.logger = new Logger('info');
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): UnifiedConfig {
    return {
      environment: 'development',
      version: '1.0.0',
      
      systems: {
        cns: {
          endpoints: {
            primary: {
              url: 'http://localhost:3100',
              timeout: 30000,
              retries: 3,
              weight: 1
            }
          },
          auth: {
            type: 'api-key',
            config: {}
          },
          features: {
            uhftValidation: true,
            semanticParsing: true
          },
          monitoring: {
            enabled: true,
            metricsInterval: 60000,
            healthcheckInterval: 30000
          }
        },
        
        bytestar: {
          endpoints: {
            primary: {
              url: 'http://localhost:3200',
              timeout: 60000,
              retries: 3,
              weight: 1
            }
          },
          auth: {
            type: 'api-key',
            config: {}
          },
          features: {
            aiEnhancement: true,
            contentGeneration: true
          },
          monitoring: {
            enabled: true,
            metricsInterval: 60000,
            healthcheckInterval: 30000
          }
        },
        
        marketplace: {
          endpoints: {
            primary: {
              url: 'http://localhost:3001',
              timeout: 30000,
              retries: 3,
              weight: 1
            }
          },
          auth: {
            type: 'api-key',
            config: {}
          },
          features: {
            dimensionalSearch: true,
            quantumMarketplace: true
          },
          monitoring: {
            enabled: true,
            metricsInterval: 60000,
            healthcheckInterval: 30000
          }
        }
      },
      
      gateway: {
        port: 3000,
        cors: {
          origins: ['http://localhost:3000', 'http://localhost:3001'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          headers: ['Content-Type', 'Authorization', 'X-API-Key']
        },
        rateLimit: {
          global: { requests: 1000, window: 3600 },
          perUser: { requests: 100, window: 3600 },
          perResource: {}
        },
        loadBalancing: {
          strategy: 'round-robin',
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
            unhealthyThreshold: 3,
            healthyThreshold: 2
          }
        },
        circuitBreaker: {
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 60000,
          monitoringPeriod: 60000,
          volumeThreshold: 10,
          errorRate: 0.5
        }
      },
      
      authentication: {
        required: true,
        excludedPaths: ['/health', '/metrics', '/docs'],
        tokenExpiration: 3600000,
        secretKey: 'default-secret-key-change-in-production',
        supportedMethods: ['api-key', 'bearer']
      },
      
      monitoring: {
        enabled: true,
        logLevel: 'info',
        metricsInterval: 60000,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000,
        alertThresholds: {
          errorRate: 0.1,
          responseTime: 2000,
          throughput: 1000
        },
        exporters: ['console']
      },
      
      eventBus: {
        maxListeners: 100,
        enablePersistence: false,
        deadLetterQueue: true,
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2
        },
        circuitBreaker: {
          failureThreshold: 5,
          resetTimeout: 60000
        }
      },
      
      workflows: {
        maxConcurrentExecutions: 100,
        defaultTimeout: 300000,
        enablePersistence: true,
        cleanupInterval: 3600000,
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2
        }
      },
      
      features: {},
      extensions: {}
    };
  }

  // Configuration loading methods
  async loadFromFile(filePath: string): Promise<void> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const configData = JSON.parse(fileContent);
      
      this.addSource({
        type: 'file',
        priority: 10,
        source: filePath
      });
      
      await this.mergeConfig(configData);
      this.configPath = filePath;
      
      // Watch for file changes
      this.watchFile(filePath);
      
      this.logger.info(`Configuration loaded from file: ${filePath}`);
      this.emit('config-loaded', { source: 'file', path: filePath });
      
    } catch (error) {
      this.logger.error(`Failed to load configuration from file ${filePath}:`, error as Error);
      throw error;
    }
  }

  async loadFromEnvironment(): Promise<void> {
    try {
      const envConfig: any = {};
      
      // Load environment variables with UNIFIED_ prefix
      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('UNIFIED_')) {
          const configPath = key.replace('UNIFIED_', '').toLowerCase().split('_');
          this.setNestedValue(envConfig, configPath, this.parseEnvValue(value as string));
        }
      }
      
      if (Object.keys(envConfig).length > 0) {
        this.addSource({
          type: 'environment',
          priority: 20,
          source: 'process.env'
        });
        
        await this.mergeConfig(envConfig);
        this.logger.info('Configuration loaded from environment variables');
        this.emit('config-loaded', { source: 'environment' });
      }
      
    } catch (error) {
      this.logger.error('Failed to load configuration from environment:', error as Error);
      throw error;
    }
  }

  async loadFromObject(config: Partial<UnifiedConfig>, priority: number = 5): Promise<void> {
    try {
      this.addSource({
        type: 'memory',
        priority,
        source: config
      });
      
      await this.mergeConfig(config);
      this.logger.info('Configuration loaded from object');
      this.emit('config-loaded', { source: 'object' });
      
    } catch (error) {
      this.logger.error('Failed to load configuration from object:', error as Error);
      throw error;
    }
  }

  private async mergeConfig(newConfig: Partial<UnifiedConfig>): Promise<void> {
    const mergedConfig = this.deepMerge(this.config, newConfig);
    
    if (this.validationEnabled) {
      // Validate merged configuration
      const validatedConfig = UnifiedConfigSchema.parse(mergedConfig);
      this.config = validatedConfig;
    } else {
      this.config = mergedConfig as UnifiedConfig;
    }
    
    this.emit('config-changed', { config: this.config });
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Configuration access methods
  get(): UnifiedConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  getPath<T = any>(path: string): T {
    return this.getNestedValue(this.config, path.split('.'));
  }

  set(path: string, value: any): void {
    const oldValue = this.getPath(path);
    this.setNestedValue(this.config, path.split('.'), value);
    
    if (this.validationEnabled) {
      try {
        UnifiedConfigSchema.parse(this.config);
      } catch (error) {
        // Revert change if validation fails
        this.setNestedValue(this.config, path.split('.'), oldValue);
        throw new Error(`Configuration validation failed: ${(error as Error).message}`);
      }
    }
    
    const changeEvent: ConfigChangeEvent = {
      path,
      oldValue,
      newValue: value,
      timestamp: new Date()
    };
    
    this.logger.debug(`Configuration changed: ${path}`, { oldValue, newValue: value });
    this.emit('config-path-changed', changeEvent);
  }

  // System-specific configuration
  getSystemConfig(system: 'cns' | 'bytestar' | 'marketplace'): typeof this.config.systems.cns {
    return this.config.systems[system];
  }

  updateSystemConfig(system: 'cns' | 'bytestar' | 'marketplace', config: Partial<typeof this.config.systems.cns>): void {
    const currentConfig = this.config.systems[system];
    this.config.systems[system] = this.deepMerge(currentConfig, config);
    
    this.emit('system-config-changed', { system, config: this.config.systems[system] });
  }

  // Feature flag management
  isFeatureEnabled(feature: string, system?: 'cns' | 'bytestar' | 'marketplace'): boolean {
    if (system) {
      return this.config.systems[system].features[feature] || false;
    }
    return this.config.features[feature] || false;
  }

  enableFeature(feature: string, system?: 'cns' | 'bytestar' | 'marketplace'): void {
    if (system) {
      this.config.systems[system].features[feature] = true;
    } else {
      this.config.features[feature] = true;
    }
    
    this.emit('feature-toggled', { feature, enabled: true, system });
  }

  disableFeature(feature: string, system?: 'cns' | 'bytestar' | 'marketplace'): void {
    if (system) {
      this.config.systems[system].features[feature] = false;
    } else {
      this.config.features[feature] = false;
    }
    
    this.emit('feature-toggled', { feature, enabled: false, system });
  }

  // File watching
  private watchFile(filePath: string): void {
    if (this.watchers.has(filePath)) {
      return;
    }

    this.watchers.set(filePath, true);
    watchFile(filePath, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        this.logger.info(`Configuration file changed: ${filePath}`);
        this.reloadFromFile(filePath);
      }
    });
  }

  private async reloadFromFile(filePath: string): Promise<void> {
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const newConfig = JSON.parse(fileContent);
      
      await this.mergeConfig(newConfig);
      this.logger.info(`Configuration reloaded from file: ${filePath}`);
      this.emit('config-reloaded', { source: 'file', path: filePath });
      
    } catch (error) {
      this.logger.error(`Failed to reload configuration from file ${filePath}:`, error as Error);
      this.emit('config-reload-error', { source: 'file', path: filePath, error });
    }
  }

  // Configuration persistence
  async saveToFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath;
    if (!targetPath) {
      throw new Error('No file path specified for saving configuration');
    }

    try {
      const configData = JSON.stringify(this.config, null, 2);
      writeFileSync(targetPath, configData, 'utf8');
      
      this.logger.info(`Configuration saved to file: ${targetPath}`);
      this.emit('config-saved', { path: targetPath });
      
    } catch (error) {
      this.logger.error(`Failed to save configuration to file ${targetPath}:`, error as Error);
      throw error;
    }
  }

  // Validation control
  enableValidation(): void {
    this.validationEnabled = true;
  }

  disableValidation(): void {
    this.validationEnabled = false;
  }

  validateConfig(): { valid: boolean; errors?: string[] } {
    try {
      UnifiedConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error) {
      const zodError = error as z.ZodError;
      return {
        valid: false,
        errors: zodError.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  }

  // Utility methods
  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    const lastKey = path.pop()!;
    const target = path.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    // Parse boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Parse number
    if (!isNaN(Number(value))) return Number(value);
    
    // Return as string
    return value;
  }

  private addSource(source: ConfigSource): void {
    // Remove existing source of same type and source
    this.sources = this.sources.filter(s => 
      !(s.type === source.type && s.source === source.source)
    );
    
    this.sources.push(source);
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  // Management and debugging
  getSources(): ConfigSource[] {
    return [...this.sources];
  }

  getConfigSummary(): {
    environment: string;
    version: string;
    systems: string[];
    features: string[];
    sources: Array<{ type: string; priority: number }>;
    lastModified?: Date;
  } {
    return {
      environment: this.config.environment,
      version: this.config.version,
      systems: Object.keys(this.config.systems),
      features: Object.keys(this.config.features),
      sources: this.sources.map(s => ({ type: s.type, priority: s.priority })),
      lastModified: this.configPath ? new Date() : undefined
    };
  }

  reset(): void {
    this.config = this.getDefaultConfig();
    this.sources = [];
    
    // Unwatch files
    for (const [filePath] of this.watchers.entries()) {
      unwatchFile(filePath);
    }
    this.watchers.clear();
    
    this.logger.info('Configuration reset to defaults');
    this.emit('config-reset');
  }

  // Cleanup
  destroy(): void {
    // Unwatch all files
    for (const [filePath] of this.watchers.entries()) {
      unwatchFile(filePath);
    }
    this.watchers.clear();
    
    this.removeAllListeners();
    this.emit('destroyed');
  }
}

// Singleton instance
export const configManager = new ConfigManager();