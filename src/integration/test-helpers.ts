/**
 * Integration Test Helpers
 * Provides utilities for testing component integrations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { IntegrationManager } from './integration-manager.js';
import type { CommandDef } from '../types.js';

export interface TestFixture {
  integrationManager: IntegrationManager;
  mockComponents: Map<string, any>;
  spies: MockInstance[];
  cleanup: () => Promise<void>;
}

export interface IntegrationTestOptions {
  isolateComponents?: boolean;
  mockExternal?: boolean;
  timeout?: number;
  setupMocks?: boolean;
}

/**
 * Create a test environment for integration testing
 */
export async function createIntegrationTestFixture(options: IntegrationTestOptions = {}): Promise<TestFixture> {
  const integrationManager = new IntegrationManager();
  const mockComponents = new Map<string, any>();
  const spies: MockInstance[] = [];

  // Initialize with test configuration
  if (options.setupMocks !== false) {
    setupDefaultMocks(integrationManager, mockComponents, spies);
  }

  await integrationManager.initialize();

  const cleanup = async () => {
    // Restore all spies
    spies.forEach(spy => spy.mockRestore());
    
    // Shutdown integration manager
    await integrationManager.shutdown();
    
    // Clear mocks
    mockComponents.clear();
    vi.clearAllMocks();
  };

  return {
    integrationManager,
    mockComponents,
    spies,
    cleanup
  };
}

/**
 * Setup default mocks for common integrations
 */
function setupDefaultMocks(
  manager: IntegrationManager,
  mockComponents: Map<string, any>,
  spies: MockInstance[]
): void {
  // Mock ontology functions
  const mockToOntology = vi.fn().mockResolvedValue('mock-ontology-data');
  const mockFromOntology = vi.fn().mockResolvedValue('mock-generated-code');
  const mockValidateOntology = vi.fn().mockReturnValue(true);

  // Mock render functions
  const mockRenderTemplate = vi.fn().mockResolvedValue(['rendered-content']);
  
  // Mock parallel processor
  const mockParallelProcess = vi.fn().mockResolvedValue('parallel-result');
  const mockParallelShutdown = vi.fn().mockResolvedValue(undefined);

  // Register mock components
  manager.registerComponent('ontology', {
    toOntology: mockToOntology,
    fromOntology: mockFromOntology,
    validateOntology: mockValidateOntology
  });

  manager.registerComponent('renderer', {
    renderTemplate: mockRenderTemplate
  });

  manager.registerComponent('parallel', {
    process: mockParallelProcess,
    shutdown: mockParallelShutdown
  });

  // Store mocks for test access
  mockComponents.set('toOntology', mockToOntology);
  mockComponents.set('fromOntology', mockFromOntology);
  mockComponents.set('validateOntology', mockValidateOntology);
  mockComponents.set('renderTemplate', mockRenderTemplate);
  mockComponents.set('parallelProcess', mockParallelProcess);
  mockComponents.set('parallelShutdown', mockParallelShutdown);

  // Add spies for cleanup
  spies.push(
    mockToOntology,
    mockFromOntology,
    mockValidateOntology,
    mockRenderTemplate,
    mockParallelProcess,
    mockParallelShutdown
  );
}

/**
 * Create sample CommandDef for testing
 */
export function createSampleCommandDef(overrides: Partial<CommandDef> = {}): CommandDef {
  return {
    meta: {
      name: 'test-command',
      description: 'Test command for integration testing',
      version: '1.0.0',
      ...overrides.meta
    },
    args: {
      input: {
        type: 'string',
        description: 'Input parameter',
        required: true
      },
      verbose: {
        type: 'boolean',
        description: 'Enable verbose output',
        default: false,
        alias: 'v'
      },
      format: {
        type: 'enum',
        description: 'Output format',
        options: ['json', 'yaml', 'xml'],
        default: 'json'
      },
      ...overrides.args
    },
    subCommands: {
      validate: {
        meta: {
          name: 'validate',
          description: 'Validate input'
        },
        args: {
          strict: {
            type: 'boolean',
            description: 'Enable strict validation',
            default: false
          }
        }
      },
      ...overrides.subCommands
    }
  };
}

/**
 * Test suite helper for integration testing
 */
export function describeIntegration(
  name: string,
  testFn: (fixture: TestFixture) => void | Promise<void>,
  options: IntegrationTestOptions = {}
): void {
  describe(name, () => {
    let fixture: TestFixture;

    beforeEach(async () => {
      fixture = await createIntegrationTestFixture(options);
    });

    afterEach(async () => {
      if (fixture) {
        await fixture.cleanup();
      }
    });

    testFn(fixture);
  });
}

/**
 * Integration test assertion helpers
 */
export const integrationExpect = {
  /**
   * Assert successful integration result
   */
  toSucceed: (result: any) => {
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  },

  /**
   * Assert failed integration result
   */
  toFail: (result: any, expectedError?: string) => {
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (expectedError) {
      expect(result.error.message).toContain(expectedError);
    }
  },

  /**
   * Assert component chain is correct
   */
  toHaveComponentChain: (result: any, expectedChain: string[]) => {
    expect(result.componentChain).toEqual(expectedChain);
  },

  /**
   * Assert mock was called with specific arguments
   */
  mockToHaveBeenCalledWith: (mockFn: MockInstance, ...args: any[]) => {
    expect(mockFn).toHaveBeenCalledWith(...args);
  },

  /**
   * Assert integration completes within timeout
   */
  toCompleteWithin: async (promise: Promise<any>, timeoutMs: number) => {
    const start = Date.now();
    await promise;
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(timeoutMs);
  }
};

/**
 * Test data generators
 */
export const testData = {
  /**
   * Generate valid ontology turtle data
   */
  validOntology: () => `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix citty: <http://example.org/citty#> .
@prefix type: <http://example.org/citty/type#> .

http://example.org/citty/command/test-command a citty:Command .
http://example.org/citty/command/test-command citty:hasName "test-command" .
http://example.org/citty/command/test-command citty:hasDescription "Test command" .
http://example.org/citty/command/test-command citty:hasVersion "1.0.0" .
`,

  /**
   * Generate malformed ontology data
   */
  malformedOntology: () => `
This is not valid turtle format
Missing prefixes and structure
Invalid triples
`,

  /**
   * Generate template data
   */
  templateData: (name: string = 'test') => ({
    name,
    description: `${name} template`,
    content: `{{ name }} template content with {{ context }}`
  }),

  /**
   * Generate CLI arguments
   */
  cliArgs: (overrides: Record<string, any> = {}) => ({
    input: 'test-input.txt',
    verbose: true,
    format: 'json',
    ...overrides
  })
};

/**
 * Performance test helper
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  iterations: number = 10
): Promise<{
  result: T;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
}> {
  const durations: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    result = await operation();
    const duration = Date.now() - start;
    durations.push(duration);
  }

  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = totalDuration / iterations;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  return {
    result: result!,
    avgDuration,
    minDuration,
    maxDuration,
    totalDuration
  };
}

/**
 * Stress test helper
 */
export async function stressTest<T>(
  operation: () => Promise<T>,
  concurrency: number,
  iterations: number
): Promise<{
  successful: T[];
  failed: Error[];
  successRate: number;
  avgDuration: number;
}> {
  const tasks: Promise<{ success: boolean; result?: T; error?: Error; duration: number }>[] = [];

  for (let i = 0; i < iterations; i++) {
    tasks.push(
      (async () => {
        const start = Date.now();
        try {
          const result = await operation();
          return { success: true, result, duration: Date.now() - start };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - start
          };
        }
      })()
    );

    // Throttle to maintain concurrency
    if ((i + 1) % concurrency === 0) {
      await Promise.allSettled(tasks.slice(-concurrency));
    }
  }

  const results = await Promise.allSettled(tasks);
  const successful: T[] = [];
  const failed: Error[] = [];
  let totalDuration = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successful.push(result.value.result!);
      } else {
        failed.push(result.value.error!);
      }
      totalDuration += result.value.duration;
    }
  });

  return {
    successful,
    failed,
    successRate: successful.length / iterations,
    avgDuration: totalDuration / iterations
  };
}