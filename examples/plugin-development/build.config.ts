import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/plugin-system',
    'src/plugins/markdown',
    'src/plugins/i18n', 
    'src/plugins/cache'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false
  }
})