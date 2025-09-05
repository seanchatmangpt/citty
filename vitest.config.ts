import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: true },
    coverage: {
      reporter: ["text", "clover", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.bench.ts",
        "src/**/*.d.ts",
        "src/**/types.ts",
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for unjucks components
        "src/weaver/unjucks-renderer.ts": {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/weaver/template-walker.ts": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "src/weaver/ontology-parser.ts": {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Performance testing configuration
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts"],
      reporters: ["verbose"],
      outputFile: "benchmark-results.json",
    },
    // Test environment setup
    environment: "node",
    globals: true,
    // Test file patterns
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "test/**/*.test.ts", // Existing test files
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "generated/**",
      "playground/**",
    ],
    // Test timeout
    testTimeout: 30000,
    hookTimeout: 10000,
    // Snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    // Reporter configuration
    reporters: ["verbose", "json"],
    outputFile: {
      json: "test-results.json",
    },
    // Parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
});
