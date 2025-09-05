/**
 * 🧠 DARK MATTER: Template Hot-Reload System
 * The missing developer experience that makes template development actually productive
 */

import { watch, FSWatcher } from 'chokidar'
import { EventEmitter } from 'events'
import { existsSync, statSync } from 'fs'
import { join, dirname, relative, extname } from 'path'
import { debounce } from 'lodash-es'
import { createHash } from 'crypto'
import { glob } from 'fast-glob'
import chalk from 'chalk'

export interface HotReloadOptions {
  templateDir: string
  ontologyPath?: string
  outputDir?: string
  watchPatterns?: string[]
  debounceMs?: number
  enableSourceMaps?: boolean
  cascadeUpdates?: boolean
}

export interface ChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  relativePath: string
  timestamp: number
  dependencies?: string[]
}

export interface DependencyGraph {
  nodes: Map<string, Set<string>> // file -> dependencies
  reverse: Map<string, Set<string>> // dependency -> dependents
}

/**
 * Intelligent hot-reload system with dependency tracking
 */
export class HotReloadSystem extends EventEmitter {
  private watcher?: FSWatcher
  private options: Required<HotReloadOptions>
  private dependencyGraph: DependencyGraph
  private fileHashes: Map<string, string> = new Map()
  private templateCache: Map<string, any> = new Map()
  private lastReload: Map<string, number> = new Map()
  
  constructor(options: HotReloadOptions) {
    super()
    
    this.options = {
      templateDir: options.templateDir,
      ontologyPath: options.ontologyPath || '',
      outputDir: options.outputDir || '',
      watchPatterns: options.watchPatterns || [
        '**/*.njk',
        '**/*.nunjucks', 
        '**/*.html',
        '**/*.md',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.ttl',
        '**/*.owl',
        '**/*.rdf'
      ],
      debounceMs: options.debounceMs || 100,
      enableSourceMaps: options.enableSourceMaps !== false,
      cascadeUpdates: options.cascadeUpdates !== false
    }
    
    this.dependencyGraph = {
      nodes: new Map(),
      reverse: new Map()
    }
    
    // Debounced change handler
    this.handleChange = debounce(this.handleChange.bind(this), this.options.debounceMs)
  }

  /**
   * Start watching for changes
   */
  async start(): Promise<void> {
    if (this.watcher) {
      await this.stop()
    }
    
    const watchPaths = [
      this.options.templateDir,
      ...(this.options.ontologyPath ? [this.options.ontologyPath] : [])
    ].filter(path => path && existsSync(path))
    
    if (watchPaths.length === 0) {
      throw new Error('No valid paths to watch')
    }
    
    this.watcher = watch(watchPaths, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**'
      ],
      ignoreInitial: false,
      persistent: true,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 25
      }
    })
    
    // Set up event handlers
    this.watcher
      .on('add', path => this.handleFileEvent('add', path))
      .on('change', path => this.handleFileEvent('change', path))
      .on('unlink', path => this.handleFileEvent('unlink', path))
      .on('error', error => this.emit('error', error))
      .on('ready', () => {
        this.emit('ready')
        console.log(chalk.cyan('🔥 Hot-reload watching:'), watchPaths.join(', '))
      })
    
    // Initial dependency scan
    await this.scanDependencies()
    
    this.emit('started')
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = undefined
    }
    
    this.templateCache.clear()
    this.fileHashes.clear()
    this.lastReload.clear()
    this.dependencyGraph.nodes.clear()
    this.dependencyGraph.reverse.clear()
    
    this.emit('stopped')
  }

  /**
   * Handle file system events
   */
  private async handleFileEvent(type: 'add' | 'change' | 'unlink', path: string) {
    // Filter by patterns
    const relativePath = relative(process.cwd(), path)
    const shouldWatch = this.options.watchPatterns.some(pattern => 
      relativePath.includes(pattern.replace('**/', '').replace('*', ''))
    )
    
    if (!shouldWatch) return
    
    const event: ChangeEvent = {
      type,
      path,
      relativePath,
      timestamp: Date.now()
    }
    
    // Check if file actually changed
    if (type === 'change') {
      const newHash = await this.getFileHash(path)
      const oldHash = this.fileHashes.get(path)
      
      if (newHash === oldHash) {
        return // No actual change
      }
      
      this.fileHashes.set(path, newHash)
    }
    
    // Update dependency graph
    if (type === 'add' || type === 'change') {
      await this.updateDependencies(path)
    } else if (type === 'unlink') {
      this.removeDependencies(path)
    }
    
    // Add dependency information
    event.dependencies = Array.from(this.dependencyGraph.reverse.get(path) || [])
    
    this.handleChange(event)
  }

  /**
   * Handle change with debouncing
   */
  private async handleChange(event: ChangeEvent) {
    try {
      // Prevent rapid successive reloads of the same file
      const lastTime = this.lastReload.get(event.path) || 0
      if (event.timestamp - lastTime < this.options.debounceMs * 2) {
        return
      }
      this.lastReload.set(event.path, event.timestamp)
      
      console.log(chalk.yellow(`🔄 ${event.type.toUpperCase()}`), chalk.gray(event.relativePath))
      
      // Clear template cache for affected files
      this.invalidateCache(event.path)
      
      // Find affected files if cascading is enabled
      const affectedFiles = this.options.cascadeUpdates 
        ? this.findAffectedFiles(event.path)
        : [event.path]
      
      // Emit change events
      this.emit('change', event)
      
      for (const affected of affectedFiles) {
        if (affected !== event.path) {
          this.emit('change', {
            ...event,
            path: affected,
            relativePath: relative(process.cwd(), affected)
          })
        }
      }
      
      // Special handling for ontology changes
      if (this.isOntologyFile(event.path)) {
        this.emit('ontology:change', event)
        
        // Invalidate all templates that use ontology data
        this.invalidateOntologyDependents()
      }
      
      this.emit('reload', { event, affectedFiles })
      
    } catch (error) {
      this.emit('error', error)
    }
  }

  /**
   * Scan all files for dependencies
   */
  private async scanDependencies(): Promise<void> {
    const files = await glob(this.options.watchPatterns, {
      cwd: this.options.templateDir,
      absolute: true
    })
    
    for (const file of files) {
      await this.updateDependencies(file)
    }
  }

  /**
   * Update dependencies for a file
   */
  private async updateDependencies(filePath: string): Promise<void> {
    try {
      const dependencies = await this.extractDependencies(filePath)
      
      // Clear old dependencies
      const oldDeps = this.dependencyGraph.nodes.get(filePath) || new Set()
      for (const dep of oldDeps) {
        const dependents = this.dependencyGraph.reverse.get(dep)
        if (dependents) {
          dependents.delete(filePath)
        }
      }
      
      // Add new dependencies
      this.dependencyGraph.nodes.set(filePath, dependencies)
      
      for (const dep of dependencies) {
        if (!this.dependencyGraph.reverse.has(dep)) {
          this.dependencyGraph.reverse.set(dep, new Set())
        }
        this.dependencyGraph.reverse.get(dep)!.add(filePath)
      }
      
    } catch (error) {
      // Silently fail dependency extraction - not critical
      console.warn(chalk.yellow(`⚠️ Failed to extract dependencies from ${filePath}`))
    }
  }

  /**
   * Extract dependencies from a template file
   */
  private async extractDependencies(filePath: string): Promise<Set<string>> {
    const dependencies = new Set<string>()
    
    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf-8')
      const ext = extname(filePath).toLowerCase()
      
      if (ext === '.njk' || ext === '.nunjucks') {
        // Extract Nunjucks includes/extends
        const includeMatches = content.match(/\{\%\s*include\s+["']([^"']+)["']\s*\%\}/g)
        const extendsMatches = content.match(/\{\%\s*extends\s+["']([^"']+)["']\s*\%\}/g)
        const importMatches = content.match(/\{\%\s*import\s+["']([^"']+)["']\s*/g)
        
        const allMatches = [
          ...(includeMatches || []),
          ...(extendsMatches || []),
          ...(importMatches || [])
        ]
        
        for (const match of allMatches) {
          const pathMatch = match.match(/["']([^"']+)["']/)
          if (pathMatch) {
            const depPath = this.resolveDependencyPath(pathMatch[1], filePath)
            if (depPath && existsSync(depPath)) {
              dependencies.add(depPath)
            }
          }
        }
        
        // Extract ontology queries
        const queryMatches = content.match(/\{\{\s*ontology\s*\.\s*\w+/g)
        if (queryMatches && this.options.ontologyPath) {
          dependencies.add(this.options.ontologyPath)
        }
      }
      
      // Extract JSON schema references
      if (ext === '.json') {
        const schemaMatches = content.match(/"(\$ref|extends)"\s*:\s*"([^"]+)"/g)
        for (const match of schemaMatches || []) {
          const refMatch = match.match(/"([^"]+)"$/)
          if (refMatch) {
            const depPath = this.resolveDependencyPath(refMatch[1], filePath)
            if (depPath && existsSync(depPath)) {
              dependencies.add(depPath)
            }
          }
        }
      }
      
    } catch (error) {
      // File might not exist or be readable
    }
    
    return dependencies
  }

  /**
   * Resolve dependency path relative to the including file
   */
  private resolveDependencyPath(depPath: string, fromFile: string): string | null {
    if (depPath.startsWith('/')) {
      return join(this.options.templateDir, depPath.substring(1))
    }
    
    if (depPath.startsWith('./') || depPath.startsWith('../')) {
      return join(dirname(fromFile), depPath)
    }
    
    // Relative to template dir
    return join(this.options.templateDir, depPath)
  }

  /**
   * Remove dependencies for a deleted file
   */
  private removeDependencies(filePath: string): void {
    const deps = this.dependencyGraph.nodes.get(filePath)
    
    if (deps) {
      for (const dep of deps) {
        const dependents = this.dependencyGraph.reverse.get(dep)
        if (dependents) {
          dependents.delete(filePath)
          if (dependents.size === 0) {
            this.dependencyGraph.reverse.delete(dep)
          }
        }
      }
    }
    
    this.dependencyGraph.nodes.delete(filePath)
    this.dependencyGraph.reverse.delete(filePath)
  }

  /**
   * Find all files affected by a change
   */
  private findAffectedFiles(filePath: string): string[] {
    const affected = new Set<string>([filePath])
    const toProcess = [filePath]
    
    while (toProcess.length > 0) {
      const current = toProcess.shift()!
      const dependents = this.dependencyGraph.reverse.get(current) || new Set()
      
      for (const dependent of dependents) {
        if (!affected.has(dependent)) {
          affected.add(dependent)
          toProcess.push(dependent)
        }
      }
    }
    
    return Array.from(affected)
  }

  /**
   * Invalidate template cache
   */
  private invalidateCache(filePath: string): void {
    this.templateCache.delete(filePath)
    
    // Also clear nunjucks cache if available
    this.emit('cache:invalidate', filePath)
  }

  /**
   * Invalidate all templates that depend on ontology
   */
  private invalidateOntologyDependents(): void {
    for (const [file, deps] of this.dependencyGraph.nodes) {
      if (deps.has(this.options.ontologyPath)) {
        this.invalidateCache(file)
      }
    }
  }

  /**
   * Check if file is an ontology file
   */
  private isOntologyFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase()
    return ['.ttl', '.owl', '.rdf', '.n3'].includes(ext) ||
           filePath === this.options.ontologyPath
  }

  /**
   * Get file hash for change detection
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf-8')
      return createHash('sha256').update(content).digest('hex').substring(0, 8)
    } catch {
      return ''
    }
  }

  /**
   * Get dependency graph for debugging
   */
  getDependencyGraph(): DependencyGraph {
    return {
      nodes: new Map(this.dependencyGraph.nodes),
      reverse: new Map(this.dependencyGraph.reverse)
    }
  }

  /**
   * Get watch statistics
   */
  getStats() {
    return {
      watching: !!this.watcher,
      files: this.fileHashes.size,
      dependencies: this.dependencyGraph.nodes.size,
      cacheSize: this.templateCache.size,
      patterns: this.options.watchPatterns
    }
  }
}

/**
 * Create hot-reload instance with smart defaults
 */
export function createHotReload(options: HotReloadOptions): HotReloadSystem {
  return new HotReloadSystem(options)
}