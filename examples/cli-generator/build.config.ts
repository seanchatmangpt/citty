import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/cli',
    'src/plugin-system',
    'src/semantic-generator'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    esbuild: {
      minify: false
    }
  }
})