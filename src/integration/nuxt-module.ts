/**
 * 🔌 Nuxt Module: Unjucks Template Integration
 * Seamless integration with Nuxt 3 ecosystem
 * Auto-discovery, server-side rendering, and build-time generation
 */

import { defineNuxtModule, createResolver, addTemplate, addImports, addPlugin } from '@nuxt/kit'
import { resolve, join } from 'pathe'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { defu } from 'defu'
import type { Nuxt } from '@nuxt/schema'
import { UNJUCKS } from '../unjucks'
import { loadGraph, toContext } from '../untology'
import { createTemplateContext } from '../context'

export interface UnjucksNuxtOptions {
  /**
   * Templates directory (relative to project root)
   * @default './templates'
   */
  templatesDir?: string
  
  /**
   * Ontology files directory
   * @default './ontology'
   */
  ontologyDir?: string
  
  /**
   * Auto-discovery of templates
   * @default true
   */
  autoDiscover?: boolean
  
  /**
   * Generate components at build time
   * @default true
   */
  buildTimeGeneration?: boolean
  
  /**
   * Server-side template compilation
   * @default true
   */
  serverCompilation?: boolean
  
  /**
   * Enable hot reload in development
   * @default true
   */
  hotReload?: boolean
  
  /**
   * Cache templates in production
   * @default true
   */
  cacheTemplates?: boolean
  
  /**
   * Template generators to register
   */
  generators?: string[]
  
  /**
   * Global template context
   */
  globalContext?: Record<string, any>
  
  /**
   * Custom template extensions
   */
  extensions?: string[]
  
  /**
   * Ontology format preference
   * @default 'turtle'
   */
  ontologyFormat?: 'turtle' | 'json-ld' | 'n3' | 'rdf-xml'
}

const UnjucksNuxtModule = defineNuxtModule<UnjucksNuxtOptions>({
  meta: {
    name: '@unjs/unjucks-nuxt',
    configKey: 'unjucks',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    templatesDir: './templates',
    ontologyDir: './ontology', 
    autoDiscover: true,
    buildTimeGeneration: true,
    serverCompilation: true,
    hotReload: true,
    cacheTemplates: true,
    generators: [],
    globalContext: {},
    extensions: ['.njk', '.nunjucks', '.j2'],
    ontologyFormat: 'turtle'
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const srcDir = nuxt.options.srcDir || nuxt.options.rootDir
    
    // Resolve directories
    const templatesDir = resolve(srcDir, options.templatesDir!)
    const ontologyDir = resolve(srcDir, options.ontologyDir!)
    
    // Add runtime config
    nuxt.options.runtimeConfig.unjucks = defu(nuxt.options.runtimeConfig.unjucks, {
      templatesDir: options.templatesDir,
      ontologyDir: options.ontologyDir,
      serverCompilation: options.serverCompilation,
      cacheTemplates: options.cacheTemplates,
      ontologyFormat: options.ontologyFormat
    })
    
    // Auto-discovery of templates and ontologies
    if (options.autoDiscover) {
      await autoDiscoverResources(nuxt, templatesDir, ontologyDir, options)
    }
    
    // Add plugin for client-side integration
    addPlugin(resolver.resolve('./runtime/unjucks.client.mjs'))
    
    // Add server-side plugin
    if (options.serverCompilation) {
      addPlugin(resolver.resolve('./runtime/unjucks.server.mjs'))
    }
    
    // Add composables
    addImports([
      {
        name: 'useUnjucks',
        from: resolver.resolve('./runtime/composables')
      },
      {
        name: 'useOntology', 
        from: resolver.resolve('./runtime/composables')
      },
      {
        name: 'useTemplateGenerator',
        from: resolver.resolve('./runtime/composables')
      }
    ])
    
    // Build-time template generation
    if (options.buildTimeGeneration) {
      await setupBuildTimeGeneration(nuxt, templatesDir, ontologyDir, options)
    }
    
    // Development hot reload
    if (nuxt.options.dev && options.hotReload) {
      setupHotReload(nuxt, templatesDir, ontologyDir)
    }
    
    // Add module transpile
    nuxt.options.build = nuxt.options.build || {}
    nuxt.options.build.transpile = nuxt.options.build.transpile || []
    nuxt.options.build.transpile.push('@unjs/unjucks')
  }
})

/**
 * Auto-discover templates and ontology files
 */
async function autoDiscoverResources(
  nuxt: Nuxt,
  templatesDir: string,
  ontologyDir: string,
  options: UnjucksNuxtOptions
) {
  const { glob } = await import('fast-glob')
  
  // Discover templates
  if (existsSync(templatesDir)) {
    const templatePatterns = options.extensions!.map(ext => `**/*${ext}`)
    const templateFiles = await glob(templatePatterns, {
      cwd: templatesDir,
      onlyFiles: true
    })
    
    console.log(`[unjucks] Discovered ${templateFiles.length} templates`)
    
    // Register as virtual modules
    for (const file of templateFiles) {
      const templatePath = join(templatesDir, file)
      const virtualPath = `virtual:unjucks-template-${file.replace(/[^a-zA-Z0-9]/g, '_')}`
      
      addTemplate({
        filename: `unjucks-templates/${file}.mjs`,
        src: templatePath,
        write: true
      })
    }
  }
  
  // Discover ontology files
  if (existsSync(ontologyDir)) {
    const ontologyFiles = await glob(['**/*.ttl', '**/*.jsonld', '**/*.n3', '**/*.rdf'], {
      cwd: ontologyDir,
      onlyFiles: true  
    })
    
    console.log(`[unjucks] Discovered ${ontologyFiles.length} ontology files`)
    
    // Create ontology registry
    const ontologyRegistry = ontologyFiles.map(file => ({
      name: file.replace(/\.[^.]+$/, ''),
      path: join(ontologyDir, file),
      format: getOntologyFormat(file)
    }))
    
    addTemplate({
      filename: 'unjucks-ontology-registry.mjs',
      getContents: () => `export default ${JSON.stringify(ontologyRegistry, null, 2)}`,
      write: true
    })
  }
}

/**
 * Setup build-time template generation
 */
async function setupBuildTimeGeneration(
  nuxt: Nuxt,
  templatesDir: string,
  ontologyDir: string,
  options: UnjucksNuxtOptions
) {
  nuxt.hook('build:before', async () => {
    console.log('[unjucks] Running build-time template generation...')
    
    try {
      // Initialize unjucks context
      const context = await createTemplateContext({
        templatesDir,
        outputDir: join(nuxt.options.buildDir, 'unjucks-generated'),
        cache: options.cacheTemplates
      })
      
      // Load ontologies
      if (existsSync(ontologyDir)) {
        const { glob } = await import('fast-glob')
        const ontologyFiles = await glob(['**/*.ttl', '**/*.jsonld', '**/*.n3'], {
          cwd: ontologyDir,
          onlyFiles: true
        })
        
        for (const file of ontologyFiles) {
          const ontologyPath = join(ontologyDir, file)
          await loadGraph(ontologyPath)
        }
      }
      
      // Generate templates with ontology context
      const ontologyContext = toContext()
      const result = await UNJUCKS.generateFromOntology(
        ontologyDir,
        options.generators?.[0],
        {
          ...options.globalContext,
          ...ontologyContext
        }
      )
      
      if (result.success) {
        console.log(`[unjucks] Generated ${result.files.length} files at build time`)
      } else {
        console.warn(`[unjucks] Build-time generation completed with errors:`, result.errors)
      }
    } catch (error) {
      console.error('[unjucks] Build-time generation failed:', error)
    }
  })
}

/**
 * Setup hot reload for development
 */
function setupHotReload(nuxt: Nuxt, templatesDir: string, ontologyDir: string) {
  const chokidar = require('chokidar')
  
  const watcher = chokidar.watch([
    join(templatesDir, '**/*'),
    join(ontologyDir, '**/*')
  ], {
    ignored: /node_modules/,
    ignoreInitial: true
  })
  
  watcher.on('change', (filePath: string) => {
    console.log(`[unjucks] File changed: ${filePath}`)
    
    // Trigger Nuxt reload
    nuxt.callHook('builder:watch', {
      event: 'change',
      path: filePath
    })
  })
  
  watcher.on('add', (filePath: string) => {
    console.log(`[unjucks] File added: ${filePath}`)
    nuxt.callHook('builder:watch', {
      event: 'add', 
      path: filePath
    })
  })
  
  // Cleanup on Nuxt close
  nuxt.hook('close', () => {
    watcher.close()
  })
}

/**
 * Get ontology format from file extension
 */
function getOntologyFormat(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ttl': return 'turtle'
    case 'jsonld': return 'json-ld'
    case 'n3': return 'n3'
    case 'rdf': case 'xml': return 'rdf-xml'
    default: return 'turtle'
  }
}

export default UnjucksNuxtModule
export { UnjucksNuxtModule }