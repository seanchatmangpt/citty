/**
 * Test Setup and Configuration
 * Global test setup for the AI orchestration system
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Logger } from '../src/utils/logger.js';

// Global test logger
export const testLogger = new Logger('Test', {
  level: 0, // DEBUG level for tests
  console: true,
  file: false // Disable file logging for tests
});

// Mock external dependencies
export const mockTensorFlow = {
  sequential: () => ({
    add: () => {},
    compile: () => {},
    fit: async () => ({ history: { acc: [0.95], val_acc: [0.93] } }),
    predict: () => ({ data: async () => [0.1, 0.2, 0.3, 0.4, 0.5] }),
    save: async () => {},
    dispose: () => {}
  }),
  loadLayersModel: async () => mockTensorFlow.sequential(),
  layers: {
    embedding: () => ({}),
    lstm: () => ({}),
    dense: () => ({}),
    dropout: () => ({}),
    batchNormalization: () => ({})
  },
  train: {
    adam: () => ({}),
    adamax: () => ({}),
    rmsprop: () => ({})
  },
  tensor2d: (data: any) => ({
    dispose: () => {},
    shape: [data.length, data[0]?.length || 0]
  }),
  tensor1d: (data: any) => ({
    dispose: () => {}
  }),
  oneHot: () => ({
    dispose: () => {}
  }),
  randomNormal: () => ({
    dispose: () => {},
    add: () => ({
      dispose: () => {}
    })
  })
};

export const mockDocker = {
  createContainer: async () => ({
    start: async () => {},
    stop: async () => {},
    remove: async () => {},
    restart: async () => {},
    inspect: async () => ({
      State: { Running: true }
    })
  }),
  pull: async () => {}
};

export const mockRedis = {
  connect: async () => {},
  disconnect: async () => {},
  on: () => {},
  get: async () => null,
  set: async () => {},
  del: async () => {}
};

export const mockAnthropic = {
  messages: {
    create: async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify([
          {
            id: 'test_1',
            title: 'Login Test',
            description: 'Test user login functionality',
            type: 'functional',
            priority: 'high',
            steps: ['Navigate to login page', 'Enter credentials', 'Click login'],
            expectedResult: 'User is logged in successfully',
            tags: ['authentication', 'login']
          }
        ])
      }]
    })
  }
};

// Global test configuration
export const testConfig = {
  timeout: 10000, // 10 seconds default timeout
  retries: 2,
  environment: 'test'
};

// Test data factories
export const createMockUserStory = (overrides: any = {}) => ({
  id: 'story_1',
  title: 'User Login Feature',
  description: 'As a user, I want to be able to log in to access my account',
  acceptanceCriteria: [
    'User can enter email and password',
    'System validates credentials',
    'User is redirected to dashboard on success'
  ],
  priority: 'high' as const,
  estimatedComplexity: 5,
  tags: ['authentication'],
  ...overrides
});

export const createMockTestScenario = (overrides: any = {}) => ({
  id: 'test_1',
  title: 'Successful Login Test',
  description: 'Test successful user login with valid credentials',
  type: 'functional' as const,
  priority: 'high' as const,
  steps: [
    'Navigate to login page',
    'Enter valid email and password',
    'Click login button',
    'Verify redirect to dashboard'
  ],
  expectedResult: 'User is successfully logged in and redirected to dashboard',
  tags: ['authentication', 'positive'],
  confidence: 0.95,
  ...overrides
});

export const createMockTestResult = (overrides: any = {}) => ({
  testId: 'test_1',
  status: 'passed' as const,
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T10:00:05Z'),
  duration: 5000,
  logs: ['Test started', 'Navigation successful', 'Login successful', 'Test completed'],
  performance: {
    responseTime: 1200,
    throughput: 100,
    memoryUsage: 50,
    cpuUsage: 25
  },
  ...overrides
});

export const createMockTestSuite = (overrides: any = {}) => ({
  id: 'suite_1',
  name: 'Authentication Test Suite',
  description: 'Comprehensive authentication testing',
  tests: [createMockTestScenario()],
  configuration: {
    parallel: true,
    maxConcurrency: 5,
    timeout: 30000,
    retryPolicy: {
      enabled: true,
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['timeout', 'network']
    }
  },
  tags: ['authentication'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T09:00:00Z'),
  ...overrides
});

// Test utilities
export class TestHelper {
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateRandomId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static createMockWebSocket() {
    const listeners: { [event: string]: Function[] } = {};
    
    return {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => {
        // Echo back for testing
        setTimeout(() => {
          const parsed = JSON.parse(data);
          if (parsed.type === 'capabilities_request') {
            this.emit('message', JSON.stringify({
              type: 'capabilities_response',
              capabilities: ['test_execution', 'api_testing', 'ui_testing']
            }));
          }
        }, 10);
      },
      on: (event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      },
      emit: (event: string, data?: any) => {
        if (listeners[event]) {
          listeners[event].forEach(callback => callback(data));
        }
      },
      close: () => {},
      removeAllListeners: () => {
        Object.keys(listeners).forEach(event => {
          listeners[event] = [];
        });
      }
    };
  }

  static expectToBeCalledWith(mockFn: any, expectedArgs: any[]) {
    const calls = mockFn.mock?.calls || [];
    const matchingCall = calls.find((call: any[]) => 
      expectedArgs.every((arg, index) => 
        JSON.stringify(arg) === JSON.stringify(call[index])
      )
    );
    
    if (!matchingCall) {
      throw new Error(`Expected function to be called with ${JSON.stringify(expectedArgs)}, but it wasn't`);
    }
  }

  static async waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    
    while (!condition() && Date.now() - start < timeout) {
      await this.delay(50);
    }
    
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }
}

// Global setup
beforeAll(async () => {
  testLogger.info('Setting up test environment');
  
  // Mock external dependencies
  global.tf = mockTensorFlow as any;
  global.mockDocker = mockDocker;
  global.mockRedis = mockRedis;
  global.mockAnthropic = mockAnthropic;
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'debug';
});

afterAll(async () => {
  testLogger.info('Tearing down test environment');
  // Cleanup any global resources
});

beforeEach(() => {
  // Reset mocks before each test
  if (global.mockDocker) {
    // Reset Docker mock state
  }
  if (global.mockRedis) {
    // Reset Redis mock state
  }
});

afterEach(() => {
  // Cleanup after each test
  testLogger.debug('Test completed, cleaning up');
});