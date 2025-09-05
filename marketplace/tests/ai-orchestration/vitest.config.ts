import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    include: [
      'test/**/*.test.ts',
      'src/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    pool: 'threads',
    maxConcurrency: 5,
    minThreads: 1,
    maxThreads: 4
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  },
  esbuild: {
    target: 'node18'
  }
});