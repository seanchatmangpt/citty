import { OrchestrationConfig } from '../orchestration/test-orchestrator';

export interface EnvironmentConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  rateLimit: number;
  resources: ResourceProfile;
  compliance: ComplianceLevel;
}

export interface ResourceProfile {
  cpu: {
    cores: number;
    maxUsage: number; // percentage
  };
  memory: {
    total: number; // MB
    maxUsage: number; // percentage
  };
  network: {
    bandwidth: number; // Mbps
    latency: number; // ms
  };
  storage: {
    capacity: number; // MB
    iops: number;
  };
}

export enum ComplianceLevel {
  BASIC = 'BASIC',
  ENHANCED = 'ENHANCED',
  STRICT = 'STRICT',
  FORTUNE_500 = 'FORTUNE_500'
}

export interface TestProfile {
  name: string;
  description: string;
  duration: number; // milliseconds
  intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  categories: string[];
  environments: string[];
  requirements: {
    minCpu: number;
    minMemory: number;
    minNetwork: number;
    minStorage: number;
  };
}

/**
 * Fortune 500 Environment Configurations
 */
export const environmentConfigs: Record<string, EnvironmentConfig> = {
  development: {
    name: 'Development',
    baseUrl: 'http://localhost:3001',
    apiKey: 'dev_api_key_12345',
    timeout: 30000,
    retries: 3,
    rateLimit: 1000, // requests per minute
    resources: {
      cpu: { cores: 8, maxUsage: 70 },
      memory: { total: 16384, maxUsage: 80 },
      network: { bandwidth: 1000, latency: 1 },
      storage: { capacity: 10240, iops: 1000 }
    },
    compliance: ComplianceLevel.BASIC
  },

  staging: {
    name: 'Staging',
    baseUrl: 'https://staging-api.company.com',
    apiKey: 'staging_api_key_67890',
    timeout: 60000,
    retries: 5,
    rateLimit: 10000, // requests per minute
    resources: {
      cpu: { cores: 16, maxUsage: 80 },
      memory: { total: 32768, maxUsage: 85 },
      network: { bandwidth: 5000, latency: 10 },
      storage: { capacity: 51200, iops: 5000 }
    },
    compliance: ComplianceLevel.ENHANCED
  },

  production: {
    name: 'Production',
    baseUrl: 'https://api.company.com',
    apiKey: 'prod_api_key_secure',
    timeout: 120000,
    retries: 10,
    rateLimit: 100000, // requests per minute
    resources: {
      cpu: { cores: 32, maxUsage: 90 },
      memory: { total: 131072, maxUsage: 90 }, // 128GB
      network: { bandwidth: 10000, latency: 5 },
      storage: { capacity: 1048576, iops: 50000 } // 1TB
    },
    compliance: ComplianceLevel.FORTUNE_500
  },

  // Specialized test environment for extreme load testing
  'load-test': {
    name: 'Load Test Environment',
    baseUrl: 'https://load-test.company.com',
    apiKey: 'load_test_api_key',
    timeout: 300000, // 5 minutes
    retries: 1, // No retries during load testing
    rateLimit: 1000000, // 1M requests per minute
    resources: {
      cpu: { cores: 64, maxUsage: 95 },
      memory: { total: 262144, maxUsage: 95 }, // 256GB
      network: { bandwidth: 25000, latency: 1 }, // 25Gbps
      storage: { capacity: 2097152, iops: 100000 } // 2TB
    },
    compliance: ComplianceLevel.STRICT
  }
};

/**
 * Test Profiles for Different Fortune 500 Scenarios
 */
export const testProfiles: Record<string, TestProfile> = {
  'quick-validation': {
    name: 'Quick Validation Suite',
    description: 'Fast smoke tests for CI/CD pipeline validation',
    duration: 300000, // 5 minutes
    intensity: 'LOW',
    categories: ['load-testing', 'security', 'performance'],
    environments: ['development', 'staging'],
    requirements: {
      minCpu: 4,
      minMemory: 4096,
      minNetwork: 100,
      minStorage: 1024
    }
  },

  'comprehensive-staging': {
    name: 'Comprehensive Staging Tests',
    description: 'Full test suite for staging environment validation',
    duration: 1800000, // 30 minutes
    intensity: 'MEDIUM',
    categories: ['load-testing', 'compliance', 'security', 'performance', 'disaster-recovery'],
    environments: ['staging'],
    requirements: {
      minCpu: 16,
      minMemory: 16384,
      minNetwork: 1000,
      minStorage: 10240
    }
  },

  'production-readiness': {
    name: 'Production Readiness Assessment',
    description: 'Complete Fortune 500 grade testing before production deployment',
    duration: 7200000, // 2 hours
    intensity: 'HIGH',
    categories: ['load-testing', 'compliance', 'security', 'performance', 'disaster-recovery'],
    environments: ['production'],
    requirements: {
      minCpu: 32,
      minMemory: 65536,
      minNetwork: 5000,
      minStorage: 51200
    }
  },

  'extreme-load': {
    name: 'Extreme Load Testing',
    description: 'Maximum capacity testing for Black Friday / Cyber Monday scenarios',
    duration: 3600000, // 1 hour
    intensity: 'EXTREME',
    categories: ['load-testing', 'performance'],
    environments: ['load-test'],
    requirements: {
      minCpu: 64,
      minMemory: 131072,
      minNetwork: 10000,
      minStorage: 102400
    }
  },

  'regulatory-audit': {
    name: 'Regulatory Audit Preparation',
    description: 'Comprehensive compliance and security audit preparation',
    duration: 10800000, // 3 hours
    intensity: 'HIGH',
    categories: ['compliance', 'security', 'disaster-recovery'],
    environments: ['production'],
    requirements: {
      minCpu: 16,
      minMemory: 32768,
      minNetwork: 1000,
      minStorage: 20480
    }
  },

  'business-continuity': {
    name: 'Business Continuity Validation',
    description: 'Disaster recovery and business continuity testing',
    duration: 5400000, // 1.5 hours
    intensity: 'MEDIUM',
    categories: ['disaster-recovery', 'load-testing'],
    environments: ['production', 'staging'],
    requirements: {
      minCpu: 24,
      minMemory: 49152,
      minNetwork: 2000,
      minStorage: 25600
    }
  }
};

/**
 * Orchestration Configurations for Different Scenarios
 */
export const orchestrationConfigs: Record<string, OrchestrationConfig> = {
  development: {
    maxConcurrentSuites: 2,
    resourceLimits: {
      cpu: 70,
      memory: 8192,
      network: 500,
      storage: 5120,
      parallelExecutionSupport: true
    },
    failFast: true,
    retryFailedTests: true,
    generateReports: true,
    notificationEndpoints: ['console://dev-team'],
    environment: 'DEVELOPMENT'
  },

  staging: {
    maxConcurrentSuites: 3,
    resourceLimits: {
      cpu: 80,
      memory: 16384,
      network: 2000,
      storage: 20480,
      parallelExecutionSupport: true
    },
    failFast: false,
    retryFailedTests: true,
    generateReports: true,
    notificationEndpoints: [
      'slack://qa-team',
      'email://qa-team@company.com'
    ],
    environment: 'STAGING'
  },

  production: {
    maxConcurrentSuites: 4,
    resourceLimits: {
      cpu: 90,
      memory: 65536,
      network: 5000,
      storage: 102400,
      parallelExecutionSupport: true
    },
    failFast: false,
    retryFailedTests: true,
    generateReports: true,
    notificationEndpoints: [
      'slack://devops-alerts',
      'slack://engineering-leadership',
      'email://cto@company.com',
      'email://engineering-leadership@company.com',
      'webhook://monitoring.company.com/alerts',
      'pagerduty://critical-alerts'
    ],
    environment: 'PRODUCTION'
  },

  'load-test': {
    maxConcurrentSuites: 6,
    resourceLimits: {
      cpu: 95,
      memory: 131072,
      network: 15000,
      storage: 204800,
      parallelExecutionSupport: true
    },
    failFast: false,
    retryFailedTests: false, // No retries during extreme load testing
    generateReports: true,
    notificationEndpoints: [
      'slack://performance-team',
      'email://performance-team@company.com',
      'webhook://grafana.company.com/alerts'
    ],
    environment: 'PRODUCTION'
  }
};

/**
 * Load Testing Configurations
 */
export const loadTestConfigs = {
  light: {
    concurrentUsers: 1000,
    transactionsPerSecond: 500,
    duration: 300000, // 5 minutes
    rampUpTime: 60000,
    rampDownTime: 30000
  },

  moderate: {
    concurrentUsers: 10000,
    transactionsPerSecond: 5000,
    duration: 1800000, // 30 minutes
    rampUpTime: 300000, // 5 minutes
    rampDownTime: 120000 // 2 minutes
  },

  heavy: {
    concurrentUsers: 100000,
    transactionsPerSecond: 50000,
    duration: 3600000, // 1 hour
    rampUpTime: 600000, // 10 minutes
    rampDownTime: 300000 // 5 minutes
  },

  extreme: {
    concurrentUsers: 1000000, // 1M users
    transactionsPerSecond: 100000, // 100K TPS
    duration: 3600000, // 1 hour
    rampUpTime: 1800000, // 30 minutes
    rampDownTime: 600000 // 10 minutes
  }
};

/**
 * Performance Benchmark Configurations
 */
export const performanceConfigs = {
  standard: {
    targetLatency: 1000, // 1ms
    duration: 300000, // 5 minutes
    concurrency: 50,
    warmupTime: 30000,
    sampleSize: 100000
  },

  enhanced: {
    targetLatency: 500, // 0.5ms
    duration: 1800000, // 30 minutes
    concurrency: 100,
    warmupTime: 60000,
    sampleSize: 1000000
  },

  'sub-millisecond': {
    targetLatency: 500, // 500μs
    duration: 3600000, // 1 hour
    concurrency: 200,
    warmupTime: 120000, // 2 minutes
    sampleSize: 10000000 // 10M requests
  }
};

/**
 * Security Testing Configurations
 */
export const securityConfigs = {
  basic: {
    testDepth: 'SURFACE' as const,
    categories: ['AUTHENTICATION', 'INPUT_VALIDATION', 'API_SECURITY'],
    maxConcurrentTests: 3,
    timeoutMs: 30000
  },

  comprehensive: {
    testDepth: 'COMPREHENSIVE' as const,
    categories: [
      'AUTHENTICATION',
      'AUTHORIZATION', 
      'INPUT_VALIDATION',
      'CRYPTOGRAPHY',
      'SESSION_MANAGEMENT',
      'ERROR_HANDLING',
      'BUSINESS_LOGIC',
      'INFRASTRUCTURE',
      'API_SECURITY',
      'DATA_PROTECTION'
    ],
    maxConcurrentTests: 8,
    timeoutMs: 120000
  }
};

/**
 * Compliance Testing Configurations
 */
export const complianceConfigs = {
  basic: {
    categories: ['SOX', 'PCI_DSS'],
    environment: 'STAGING' as const,
    auditTrailRequired: true,
    realTimeMonitoring: false,
    encryptionRequired: true
  },

  'fortune-500': {
    categories: ['SOX', 'PCI_DSS', 'GDPR', 'AML_KYC', 'BASEL_III', 'DODD_FRANK'],
    environment: 'PRODUCTION' as const,
    auditTrailRequired: true,
    realTimeMonitoring: true,
    encryptionRequired: true
  }
};

/**
 * Configuration Factory Functions
 */
export class ConfigurationFactory {
  /**
   * Get environment configuration by name
   */
  static getEnvironmentConfig(environment: string): EnvironmentConfig {
    const config = environmentConfigs[environment];
    if (!config) {
      throw new Error(`Unknown environment: ${environment}`);
    }
    return config;
  }

  /**
   * Get test profile by name
   */
  static getTestProfile(profile: string): TestProfile {
    const testProfile = testProfiles[profile];
    if (!testProfile) {
      throw new Error(`Unknown test profile: ${profile}`);
    }
    return testProfile;
  }

  /**
   * Get orchestration configuration by environment
   */
  static getOrchestrationConfig(environment: string): OrchestrationConfig {
    const config = orchestrationConfigs[environment];
    if (!config) {
      throw new Error(`No orchestration config for environment: ${environment}`);
    }
    return config;
  }

  /**
   * Generate dynamic configuration based on requirements
   */
  static generateDynamicConfig(requirements: {
    environment: string;
    profile: string;
    intensity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    customSettings?: any;
  }): {
    environment: EnvironmentConfig;
    profile: TestProfile;
    orchestration: OrchestrationConfig;
  } {
    const environment = this.getEnvironmentConfig(requirements.environment);
    const profile = this.getTestProfile(requirements.profile);
    const orchestration = this.getOrchestrationConfig(requirements.environment);

    // Apply intensity modifications
    if (requirements.intensity) {
      const intensityMultiplier = {
        'LOW': 0.5,
        'MEDIUM': 1.0,
        'HIGH': 1.5,
        'EXTREME': 2.0
      }[requirements.intensity];

      // Scale resource requirements
      orchestration.resourceLimits.cpu *= intensityMultiplier;
      orchestration.resourceLimits.memory *= intensityMultiplier;
      orchestration.resourceLimits.network *= intensityMultiplier;
      orchestration.resourceLimits.storage *= intensityMultiplier;

      // Adjust max concurrent suites
      orchestration.maxConcurrentSuites = Math.ceil(
        orchestration.maxConcurrentSuites * intensityMultiplier
      );
    }

    // Apply custom settings
    if (requirements.customSettings) {
      Object.assign(orchestration, requirements.customSettings);
    }

    return {
      environment,
      profile,
      orchestration
    };
  }

  /**
   * Validate configuration compatibility
   */
  static validateConfiguration(
    environment: EnvironmentConfig,
    profile: TestProfile,
    orchestration: OrchestrationConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check resource requirements
    if (profile.requirements.minCpu > environment.resources.cpu.cores) {
      errors.push(`Profile requires ${profile.requirements.minCpu} CPU cores, environment has ${environment.resources.cpu.cores}`);
    }

    if (profile.requirements.minMemory > environment.resources.memory.total) {
      errors.push(`Profile requires ${profile.requirements.minMemory}MB memory, environment has ${environment.resources.memory.total}MB`);
    }

    if (profile.requirements.minNetwork > environment.resources.network.bandwidth) {
      errors.push(`Profile requires ${profile.requirements.minNetwork}Mbps network, environment has ${environment.resources.network.bandwidth}Mbps`);
    }

    if (profile.requirements.minStorage > environment.resources.storage.capacity) {
      errors.push(`Profile requires ${profile.requirements.minStorage}MB storage, environment has ${environment.resources.storage.capacity}MB`);
    }

    // Check orchestration limits
    if (orchestration.resourceLimits.cpu > environment.resources.cpu.maxUsage) {
      errors.push(`Orchestration CPU limit (${orchestration.resourceLimits.cpu}%) exceeds environment max (${environment.resources.cpu.maxUsage}%)`);
    }

    if (orchestration.resourceLimits.memory > environment.resources.memory.total) {
      errors.push(`Orchestration memory limit (${orchestration.resourceLimits.memory}MB) exceeds environment total (${environment.resources.memory.total}MB)`);
    }

    // Check environment compatibility
    if (!profile.environments.includes(environment.name.toLowerCase())) {
      errors.push(`Profile '${profile.name}' is not compatible with environment '${environment.name}'`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get recommended configuration for specific use case
   */
  static getRecommendedConfiguration(useCase: string): {
    environment: string;
    profile: string;
    settings: any;
  } {
    const recommendations = {
      'ci-cd-pipeline': {
        environment: 'development',
        profile: 'quick-validation',
        settings: { failFast: true, maxConcurrentSuites: 2 }
      },

      'pre-production-validation': {
        environment: 'staging',
        profile: 'comprehensive-staging',
        settings: { failFast: false, retryFailedTests: true }
      },

      'production-deployment': {
        environment: 'production',
        profile: 'production-readiness',
        settings: { 
          failFast: false, 
          generateReports: true,
          notificationEndpoints: ['email://cto@company.com']
        }
      },

      'black-friday-prep': {
        environment: 'load-test',
        profile: 'extreme-load',
        settings: { 
          maxConcurrentSuites: 6,
          retryFailedTests: false
        }
      },

      'security-audit': {
        environment: 'production',
        profile: 'regulatory-audit',
        settings: { 
          generateReports: true,
          auditTrailRequired: true
        }
      },

      'disaster-recovery-test': {
        environment: 'production',
        profile: 'business-continuity',
        settings: { 
          failFast: false,
          generateReports: true,
          realTimeMonitoring: true
        }
      }
    };

    const recommendation = recommendations[useCase];
    if (!recommendation) {
      throw new Error(`No recommendation available for use case: ${useCase}`);
    }

    return recommendation;
  }
}

/**
 * Configuration Templates for Common Scenarios
 */
export const configurationTemplates = {
  'startup-company': {
    resources: 'limited',
    compliance: ComplianceLevel.BASIC,
    testIntensity: 'MEDIUM',
    environments: ['development', 'staging']
  },

  'mid-size-enterprise': {
    resources: 'moderate',
    compliance: ComplianceLevel.ENHANCED,
    testIntensity: 'HIGH',
    environments: ['development', 'staging', 'production']
  },

  'fortune-500-financial': {
    resources: 'extensive',
    compliance: ComplianceLevel.FORTUNE_500,
    testIntensity: 'EXTREME',
    environments: ['development', 'staging', 'production', 'load-test']
  },

  'regulated-healthcare': {
    resources: 'extensive',
    compliance: ComplianceLevel.STRICT,
    testIntensity: 'HIGH',
    environments: ['development', 'staging', 'production']
  }
};

export default {
  environmentConfigs,
  testProfiles,
  orchestrationConfigs,
  loadTestConfigs,
  performanceConfigs,
  securityConfigs,
  complianceConfigs,
  ConfigurationFactory,
  configurationTemplates
};