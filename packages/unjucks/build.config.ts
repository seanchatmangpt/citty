import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true
  },
  entries: [
    'src/index',
    'src/cli',
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
    }
  ],
  externals: [
    'nunjucks',
    'unctx',
    'untology',
    'citty',
    'consola',
    'picocolors',
    'fast-glob',
    'pathe',
    'defu',
    'ofetch',
    'node:fs',
    'node:fs/promises',
    'node:path'
  ]
})