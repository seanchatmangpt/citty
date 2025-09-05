import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry points matching package.json exports
    {
      input: 'src/index',
      name: 'index'
    },
    {
      input: 'src/context',
      name: 'context'
    },
    {
      input: 'src/walker',
      name: 'walker'
    },
    {
      input: 'src/renderer',
      name: 'renderer'
    },
    {
      input: 'src/ontology',
      name: 'ontology'
    },
    {
      input: 'src/cli',
      name: 'cli'
    }
    // Integration entry points temporarily disabled due to syntax issues
    // Can be re-enabled once the embedded newline characters are fixed
    // {
    //   input: 'src/integration/nuxt-module',
    //   name: 'integration/nuxt-module'
    // },
    // {
    //   input: 'src/integration/nitro-plugin',
    //   name: 'integration/nitro-plugin'
    // },
    // {
    //   input: 'src/integration/vite-plugin',
    //   name: 'integration/vite-plugin'
    // },
    // {
    //   input: 'src/integration/h3-middleware',
    //   name: 'integration/h3-middleware'
    // }
  ],
  declaration: true,
  clean: true,
  outDir: 'dist',
  rollup: {
    emitCJS: true,
    inlineDependencies: false,
    cjsBridge: true
  },
  externals: [
    // Core dependencies that should remain external
    'nunjucks',
    'unctx',
    'pathe',
    'citty',
    'consola',
    'picocolors',
    'fast-glob',
    'gray-matter',
    'yaml',
    'n3',
    'ofetch',
    'ohash',
    'ora',
    'p-queue',
    'scule',
    'defu',
    'chalk',
    'cli-table3',
    'colorette',
    'jest-diff',
    'prompts',
    // Node.js built-ins
    'node:fs',
    'node:path',
    'node:url',
    'node:process',
    'node:readline',
    'node:readline/promises',
    'node:buffer',
    'node:stream',
    'node:util',
    'node:events',
    'node:os',
    'node:crypto',
    // OpenTelemetry
    '@opentelemetry/api'
  ],
  replace: {
    // Ensure proper Node.js environment detection
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  failOnWarn: false
});