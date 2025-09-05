export default defineNitroConfig({
  srcDir: 'server',
  experimental: {
    wasm: true
  },
  plugins: [
    './plugins/unjucks-ontology.ts'
  ],
  runtimeConfig: {
    apiVersion: 'v1',
    ontologyEnabled: true,
    docsEnabled: true
  },
  storage: {
    ontology: {
      driver: 'fs',
      base: './storage/ontology'
    },
    docs: {
      driver: 'fs', 
      base: './storage/docs'
    }
  },
  devtools: {
    enabled: true
  }
})