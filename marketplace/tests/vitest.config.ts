// Vitest Configuration for Marketplace Test Suite
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts',
        'api/**/*.ts',
        'workflows/**/*.ts',
        'components/**/*.ts',
        'types/**/*.ts'
      ],
      exclude: [
        'tests/**',
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      // Fail tests if coverage is below thresholds
      all: true,
      skipFull: false
    },
    
    // Test timeout (milliseconds)
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      'html'
    ],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    },
    
    // Concurrent testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
        maxThreads: 4,
        minThreads: 2
      }
    },
    
    // Test sequence
    sequence: {
      concurrent: true,
      shuffle: false
    },
    
    // Setup files
    setupFiles: [
      './tests/setup/global-setup.ts'
    ],
    
    // Mocking
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Watch mode
    watch: false,
    
    // Performance testing configuration
    benchmark: {
      include: [
        'tests/performance/**/*.test.ts'
      ],
      exclude: [
        'tests/unit/**',
        'tests/integration/**',
        'tests/e2e/**'
      ],
      outputFile: './benchmark-results.json',
      reporter: 'verbose'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@types': resolve(__dirname, './types'),
      '@src': resolve(__dirname, './src'),
      '@api': resolve(__dirname, './api'),
      '@workflows': resolve(__dirname, './workflows'),
      '@components': resolve(__dirname, './components'),
      '@tests': resolve(__dirname, './tests')
    }
  },
  
  // Define constants
  define: {
    __TEST_ENV__: true,
    __VERSION__: JSON.stringify('test'),
    __PERFORMANCE_MODE__: false
  },
  
  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'es2022',
    format: 'esm'
  }
});