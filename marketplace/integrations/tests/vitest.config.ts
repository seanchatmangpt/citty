import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./utils/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'coverage/**'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/Users/sac/dev/citty/marketplace/integrations',
      '@cns': '/Users/sac/dev/citty/marketplace/integrations/cns',
      '@bytestar': '/Users/sac/dev/citty/marketplace/integrations/bytestar',
      '@marketplace': '/Users/sac/dev/citty/marketplace'
    }
  }
})