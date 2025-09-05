import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true
  },
  entries: [
    'src/index',
    'src/advanced'
  ],
  externals: [
    'n3',
    'unctx',
    'defu',
    'ofetch',
    'pathe',
    'node:fs/promises'
  ]
})