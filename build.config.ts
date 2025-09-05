import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/cli'
  ],
  declaration: true,
  clean: true,
  outDir: 'dist',
  rollup: {
    emitCJS: false,
    inlineDependencies: false
  },
  externals: [
    'nunjucks',
    'unctx', 
    'pathe',
    'citty',
    'consola',
    'picocolors',
    'fast-glob',
    'node:fs',
    'node:path'
  ]
});