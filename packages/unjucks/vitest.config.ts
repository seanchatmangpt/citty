import { defineConfig } from 'vitest/config'
import { resolve } from 'pathe'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'json'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/test/**',
        '**/*.test.ts',
        '**/build.config.ts',
        '**/vitest.config.ts'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '~/': resolve('./src/')
    }
  }
})