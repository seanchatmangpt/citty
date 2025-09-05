/**
 * ⚡ Vite Plugin: Build-Time Template Generation
 * Compile-time template processing with hot reload and optimization
 * Seamless integration with Vite's build pipeline
 */

import type { Plugin, ViteDevServer, ModuleNode } from 'vite'
import { resolve, join, relative } from 'pathe'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { defu } from 'defu'
import { UNJUCKS } from '../unjucks'
import { loadGraph, toContext } from '../untology'
import { createTemplateContext } from '../context'
import { MemoryCache } from '../cache'

export interface UnjucksViteOptions {
  /**
   * Templates directory
   * @default 'templates'
   */
  templatesDir?: string
  
  /**
   * Ontology directory
   * @default 'ontology'
   */
  ontologyDir?: string
  
  /**
   * Output directory for generated files
   * @default 'src/generated'
   */
  outputDir?: string
  
  /**
   * Generate files during build
   * @default true
   */
  generateOnBuild?: boolean
  
  /**
   * Watch templates and ontologies for changes
   * @default true
   */
  watch?: boolean
  
  /**
   * Include generated files in bundle
   * @default true
   */
  includeInBundle?: boolean
  
  /**
   * Virtual module prefix
   * @default 'virtual:unjucks'
   */
  virtualPrefix?: string
  
  /**
   * Template patterns to include
   * @default ['**\/*.{njk,nunjucks,j2}']
   */
  include?: string[]
  
  /**
   * Template patterns to exclude
   * @default ['node_modules/**', '.*\/**']
   */
  exclude?: string[]
  
  /**
   * Global context for templates
   */
  globalContext?: Record<string, any>
  
  /**
   * Generators to process
   */
  generators?: string[]
  
  /**
   * Enable source maps for templates
   * @default true
   */
  sourcemap?: boolean
  
  /**
   * Transform generated code
   */
  transform?: (code: string, id: string) => string | Promise<string>
  
  /**
   * Enable caching for performance
   * @default true
   */
  cache?: boolean
  
  /**
   * Development server integration
   */
  devServer?: {
    /**
     * Serve templates at this endpoint
     * @default '/unjucks'
     */
    endpoint?: string
    
    /**
     * Enable template preview UI
     * @default true
     */
    previewUI?: boolean
  }
}

interface GeneratedFile {
  id: string
  path: string
  content: string
  templateId: string
  hash: string
  dependencies: string[]
}

interface VirtualModule {
  id: string
  content: string
  map?: any
  dependencies: Set<string>
}

const DEFAULT_OPTIONS: Required<Omit<UnjucksViteOptions, 'transform'>> & { transform?: UnjucksViteOptions['transform'] } = {
  templatesDir: 'templates',
  ontologyDir: 'ontology',
  outputDir: 'src/generated',
  generateOnBuild: true,
  watch: true,
  includeInBundle: true,
  virtualPrefix: 'virtual:unjucks',
  include: ['**/*.{njk,nunjucks,j2}'],
  exclude: ['node_modules/**', '.*/**'],
  globalContext: {},
  generators: [],
  sourcemap: true,
  cache: true,
  devServer: {
    endpoint: '/unjucks',
    previewUI: true
  }
}

class UnjucksVitePlugin {
  private options: typeof DEFAULT_OPTIONS
  private cache: MemoryCache<GeneratedFile>
  private virtualModules = new Map<string, VirtualModule>()
  private server: ViteDevServer | null = null
  private watcher: any = null
  private templateContext: any = null
  private ontologyLoaded = false
  
  constructor(options: UnjucksViteOptions = {}) {
    this.options = defu(options, DEFAULT_OPTIONS)
    this.cache = new MemoryCache<GeneratedFile>({
      defaultTtl: 0 // No TTL for build-time cache
    })
  }
  
  createPlugin(): Plugin {
    return {
      name: 'unjucks-vite-plugin',
      enforce: 'pre',
      
      configResolved: (config) => {
        // Adjust paths relative to config root
        this.options.templatesDir = resolve(config.root, this.options.templatesDir)
        this.options.ontologyDir = resolve(config.root, this.options.ontologyDir)
        this.options.outputDir = resolve(config.root, this.options.outputDir)
      },
      
      buildStart: async () => {
        await this.initialize()
        
        if (this.options.generateOnBuild) {
          await this.generateAllTemplates()
        }
      },
      
      configureServer: (server) => {
        this.server = server
        this.setupDevServer(server)
        
        if (this.options.watch) {
          this.setupFileWatcher()
        }
      },
      
      resolveId: (id) => {
        if (id.startsWith(this.options.virtualPrefix)) {
          return id
        }
        
        // Resolve template imports
        if (id.includes('.template.')) {
          return this.resolveTemplateId(id)
        }
      },
      
      load: async (id) => {
        if (id.startsWith(this.options.virtualPrefix)) {
          return this.loadVirtualModule(id)
        }
        
        if (id.includes('.template.')) {
          return this.loadTemplateModule(id)
        }
      },
      
      transform: async (code, id) => {
        // Transform template imports in regular modules
        if (code.includes('import') && code.includes('.template')) {
          return this.transformTemplateImports(code, id)
        }
        
        // Apply custom transform if provided
        if (this.options.transform) {
          return this.options.transform(code, id)
        }
      },
      
      generateBundle: async () => {
        if (this.options.includeInBundle) {
          await this.generateBundleAssets()
        }
      },
      
      buildEnd: () => {
        this.cleanup()
      }
    }
  }
  
  private async initialize() {
    try {
      // Initialize template context
      this.templateContext = await createTemplateContext({
        templatesDir: this.options.templatesDir,
        outputDir: this.options.outputDir,
        cache: this.options.cache
      })
      
      // Load ontologies
      await this.loadOntologies()
      
      console.log('[unjucks-vite] Plugin initialized')
    } catch (error) {
      console.error('[unjucks-vite] Initialization failed:', error)
      throw error
    }
  }
  
  private async loadOntologies() {
    if (!existsSync(this.options.ontologyDir)) {
      console.warn('[unjucks-vite] Ontology directory not found:', this.options.ontologyDir)
      return
    }
    
    try {
      const { glob } = await import('fast-glob')
      const ontologyFiles = await glob(['**/*.ttl', '**/*.jsonld', '**/*.n3'], {
        cwd: this.options.ontologyDir,
        onlyFiles: true
      })
      
      for (const file of ontologyFiles) {
        const ontologyPath = join(this.options.ontologyDir, file)
        await loadGraph(ontologyPath)
      }
      
      this.ontologyLoaded = ontologyFiles.length > 0
      
      if (this.ontologyLoaded) {
        console.log(`[unjucks-vite] Loaded ${ontologyFiles.length} ontology files`)
      }
    } catch (error) {
      console.error('[unjucks-vite] Failed to load ontologies:', error)
    }
  }
  
  private async generateAllTemplates(): Promise<GeneratedFile[]> {
    const { glob } = await import('fast-glob')
    const templateFiles = await glob(this.options.include, {
      cwd: this.options.templatesDir,
      ignore: this.options.exclude,
      onlyFiles: true
    })
    
    const generatedFiles: GeneratedFile[] = []
    
    for (const file of templateFiles) {
      try {
        const generated = await this.generateTemplate(file)
        if (generated) {
          generatedFiles.push(generated)
        }
      } catch (error) {
        console.error(`[unjucks-vite] Failed to generate template ${file}:`, error)
      }
    }
    
    console.log(`[unjucks-vite] Generated ${generatedFiles.length} files`)
    return generatedFiles
  }
  
  private async generateTemplate(templateFile: string): Promise<GeneratedFile | null> {
    const templatePath = join(this.options.templatesDir, templateFile)
    
    // Check cache
    const fileStats = await import('node:fs/promises').then(fs => fs.stat(templatePath))
    const cacheKey = `${templateFile}-${fileStats.mtime.getTime()}`
    
    if (this.options.cache) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }
    
    try {
      // Extract template metadata
      const templateContent = await readFile(templatePath, 'utf-8')
      const templateId = this.extractTemplateId(templateFile)
      
      // Merge contexts
      const context = {
        ...this.options.globalContext,
        ...(this.ontologyLoaded ? toContext() : {}),
        $vite: {
          file: templateFile,
          templateId,
          timestamp: new Date().toISOString()
        }
      }
      
      // Generate using UNJUCKS
      const result = await UNJUCKS.generateFromOntology(
        this.options.ontologyDir,
        templateId,
        {
          context,
          cache: this.options.cache
        }
      )
      
      if (!result.success || !result.files.length) {
        console.warn(`[unjucks-vite] Template generation failed for ${templateFile}:`, result.errors)
        return null
      }
      
      const outputPath = join(this.options.outputDir, result.files[0].path)
      
      // Create generated file record
      const generated: GeneratedFile = {
        id: templateId,
        path: outputPath,
        content: result.files[0].content,
        templateId,
        hash: this.generateHash(result.files[0].content),
        dependencies: [templatePath]
      }
      
      // Write to filesystem if not in virtual mode
      if (!this.options.virtualPrefix || this.options.includeInBundle) {
        await mkdir(join(outputPath, '..'), { recursive: true })
        await writeFile(outputPath, generated.content, 'utf-8')
      }
      
      // Cache result
      if (this.options.cache) {
        this.cache.set(cacheKey, generated)
      }
      
      return generated
    } catch (error) {
      console.error(`[unjucks-vite] Template generation error for ${templateFile}:`, error)
      return null
    }
  }
  
  private setupDevServer(server: ViteDevServer) {
    const { endpoint, previewUI } = this.options.devServer!
    
    // Template rendering endpoint
    server.middlewares.use(endpoint!, async (req, res, next) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const templateId = url.searchParams.get('template')
        const contextParam = url.searchParams.get('context')
        
        if (!templateId) {
          res.statusCode = 400
          res.end('Template ID required')
          return
        }
        
        // Parse context
        let context = {}
        if (contextParam) {
          try {
            context = JSON.parse(decodeURIComponent(contextParam))
          } catch {
            context = { raw: contextParam }
          }
        }
        
        // Generate template
        const mergedContext = {
          ...this.options.globalContext,
          ...context,
          ...(this.ontologyLoaded ? toContext() : {})
        }
        
        const result = await UNJUCKS.generateFromOntology(
          this.options.ontologyDir,
          templateId,
          { context: mergedContext }
        )
        
        if (result.success && result.files.length > 0) {
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.setHeader('x-template-id', templateId)
          res.end(result.files[0].content)
        } else {
          res.statusCode = 500
          res.end(`Template generation failed: ${result.errors?.[0]?.message || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('[unjucks-vite] Dev server error:', error)
        res.statusCode = 500
        res.end('Internal server error')
      }
    })
    
    // Preview UI
    if (previewUI) {
      server.middlewares.use(`${endpoint}/ui`, (req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(this.generatePreviewUI())
      })
    }
  }
  
  private setupFileWatcher() {
    const chokidar = require('chokidar')
    
    this.watcher = chokidar.watch([
      join(this.options.templatesDir, '**/*'),
      join(this.options.ontologyDir, '**/*')
    ], {
      ignored: /node_modules/,
      ignoreInitial: true
    })
    
    this.watcher.on('change', async (filePath: string) => {
      console.log(`[unjucks-vite] File changed: ${filePath}`)
      
      // Clear cache
      this.cache.clear()
      this.virtualModules.clear()
      
      // Reload ontologies if needed
      if (filePath.includes(this.options.ontologyDir)) {
        await this.loadOntologies()
      }
      
      // Trigger HMR
      if (this.server) {
        const module = this.server.moduleGraph.getModuleById(filePath)
        if (module) {
          this.server.reloadModule(module)
        }
        
        // Send HMR update
        this.server.ws.send({
          type: 'full-reload'
        })
      }
    })
  }
  
  private resolveTemplateId(id: string): string {
    // Convert template import to virtual module ID
    return `${this.options.virtualPrefix}:template:${id}`
  }
  
  private async loadVirtualModule(id: string): Promise<string | null> {
    if (this.virtualModules.has(id)) {
      return this.virtualModules.get(id)!.content
    }
    
    // Parse virtual module ID
    const parts = id.replace(this.options.virtualPrefix + ':', '').split(':')
    const type = parts[0]
    const templateId = parts[1]
    
    if (type === 'template') {
      const generated = await this.generateTemplate(templateId)
      if (generated) {
        const moduleContent = this.wrapAsModule(generated.content, generated.id)
        this.virtualModules.set(id, {
          id,
          content: moduleContent,
          dependencies: new Set(generated.dependencies)
        })
        return moduleContent
      }
    }
    
    return null
  }
  
  private async loadTemplateModule(id: string): Promise<string | null> {
    const templateId = this.extractTemplateId(id)
    const generated = await this.generateTemplate(templateId)
    
    if (generated) {
      return this.wrapAsModule(generated.content, generated.id)
    }
    
    return null
  }
  
  private transformTemplateImports(code: string, id: string): string {
    // Transform template imports to virtual modules
    return code.replace(
      /import\s+(.+?)\s+from\s+['"](.+?\.template\..+?)['"];?/g,
      (match, imports, templatePath) => {
        const virtualId = `${this.options.virtualPrefix}:template:${templatePath}`
        return `import ${imports} from '${virtualId}';`
      }
    )
  }
  
  private wrapAsModule(content: string, templateId: string): string {
    // Wrap generated content as ES module
    return `
// Generated by unjucks-vite-plugin for template: ${templateId}
const content = ${JSON.stringify(content)};
const templateId = ${JSON.stringify(templateId)};
const generatedAt = ${JSON.stringify(new Date().toISOString())};

export default content;
export { content, templateId, generatedAt };
`
  }
  
  private extractTemplateId(filePath: string): string {
    return filePath
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Normalize dashes
      .toLowerCase()
  }
  
  private async generateBundleAssets() {
    // Generate all templates for bundle
    const generated = await this.generateAllTemplates()
    
    // Write manifest file
    const manifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      templates: generated.map(g => ({
        id: g.id,
        path: relative(this.options.outputDir, g.path),
        hash: g.hash
      }))
    }
    
    const manifestPath = join(this.options.outputDir, 'unjucks-manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    
    console.log(`[unjucks-vite] Generated manifest with ${generated.length} templates`)
  }
  
  private generatePreviewUI(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Unjucks Template Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    .form { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .form input, .form textarea { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
    .form button { background: #007acc; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    .preview { border: 1px solid #ddd; border-radius: 8px; }
    .preview-header { background: #f5f5f5; padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; }
    .preview-content { padding: 20px; }
    iframe { width: 100%; height: 500px; border: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Unjucks Template Preview</h1>
      <p>Test your templates with custom context data</p>
    </div>
    
    <div class="form">
      <label>Template ID:</label>
      <input type="text" id="templateId" placeholder="Enter template ID" />
      
      <label>Context (JSON):</label>
      <textarea id="context" rows="4" placeholder='{ "key": "value" }'></textarea>
      
      <button onclick="previewTemplate()">Preview Template</button>
    </div>
    
    <div class="preview">
      <div class="preview-header">Preview Result</div>
      <div class="preview-content">
        <iframe id="previewFrame" src="about:blank"></iframe>
      </div>
    </div>
  </div>
  
  <script>
    function previewTemplate() {
      const templateId = document.getElementById('templateId').value;
      const contextText = document.getElementById('context').value || '{}';
      
      if (!templateId) {
        alert('Please enter a template ID');
        return;
      }
      
      const params = new URLSearchParams({
        template: templateId,
        context: encodeURIComponent(contextText)
      });
      
      const iframe = document.getElementById('previewFrame');
      iframe.src = '${this.options.devServer!.endpoint}?' + params.toString();
    }
  </script>
</body>
</html>`
  }
  
  private generateHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  private cleanup() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    
    this.cache.clear()
    this.virtualModules.clear()
  }
}

/**
 * Create Vite plugin for Unjucks integration
 */
export function unjucksVite(options: UnjucksViteOptions = {}): Plugin {
  const plugin = new UnjucksVitePlugin(options)
  return plugin.createPlugin()
}

// Default export for convenience
export default unjucksVite

export { UnjucksVitePlugin }
export type { UnjucksViteOptions, GeneratedFile }