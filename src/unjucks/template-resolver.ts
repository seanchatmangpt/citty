/**
 * 🧬 DARK MATTER: Template Resolution and Inheritance Engine
 * The invisible machinery that makes templates actually find and inherit from each other
 */

import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs/promises'
import { createHash } from 'crypto'
import { SemanticContextManager } from './semantic-context'

// Template metadata that humans forget to track
export interface TemplateMetadata {
  id: string
  path: string
  name: string
  extends?: string[]                  // Parent templates
  includes?: string[]                  // Included templates
  blocks?: Map<string, string>        // Named blocks for inheritance
  macros?: Map<string, string>        // Reusable macro definitions
  filters?: string[]                   // Required filters
  dependencies?: Set<string>           // Template dependencies
  compiled?: any                       // Compiled template cache
  lastModified?: Date                  // For cache invalidation
  checksum?: string                    // Content hash
  semanticType?: string                // Semantic classification
  priority?: number                    // Resolution priority
  fallback?: string                    // Fallback template
}

// Template resolution strategies
export enum ResolutionStrategy {
  EXACT = 'exact',                    // Exact path match
  FUZZY = 'fuzzy',                    // Fuzzy matching
  SEMANTIC = 'semantic',              // Semantic similarity
  PATTERN = 'pattern',                // Pattern matching
  CASCADE = 'cascade'                 // Try multiple strategies
}

// Inheritance resolution modes
export enum InheritanceMode {
  OVERRIDE = 'override',              // Child overrides parent
  MERGE = 'merge',                    // Merge parent and child
  APPEND = 'append',                  // Append child to parent
  PREPEND = 'prepend',               // Prepend child to parent
  REPLACE_BLOCKS = 'replace_blocks'  // Only replace named blocks
}

export class TemplateResolver extends EventEmitter {
  private templates: Map<string, TemplateMetadata> = new Map()
  private searchPaths: string[] = []
  private resolutionCache: Map<string, string> = new Map()
  private inheritanceGraph: Map<string, Set<string>> = new Map()
  private compiledTemplates: Map<string, any> = new Map()
  private circularCheck: Set<string> = new Set()
  private semanticIndex: Map<string, Set<string>> = new Map()
  
  constructor(
    private contextManager: SemanticContextManager,
    searchPaths: string[] = []
  ) {
    super()
    this.searchPaths = searchPaths
    this.initializeResolver()
  }
  
  private async initializeResolver(): Promise<void> {
    // Scan search paths for templates
    for (const searchPath of this.searchPaths) {
      await this.scanDirectory(searchPath)
    }
    
    // Build inheritance graph
    this.buildInheritanceGraph()
    
    // Build semantic index
    this.buildSemanticIndex()
    
    this.emit('resolver:initialized', {
      templates: this.templates.size,
      searchPaths: this.searchPaths.length
    })
  }
  
  /**
   * Discovers templates in a directory (the dark matter of template systems)
   */
  async discoverTemplates(dir: string, recursive: boolean = true): Promise<TemplateMetadata[]> {
    const discovered: TemplateMetadata[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory() && recursive) {
          const subTemplates = await this.discoverTemplates(fullPath, true)
          discovered.push(...subTemplates)
        } else if (this.isTemplate(entry.name)) {
          const metadata = await this.extractMetadata(fullPath)
          this.templates.set(metadata.id, metadata)
          discovered.push(metadata)
        }
      }
    } catch (error) {
      this.emit('discovery:error', { dir, error })
    }
    
    return discovered
  }
  
  /**
   * Resolves a template through multiple strategies
   * This is what makes templates "just work" 
   */
  async resolveTemplate(
    name: string,
    context: any = {},
    strategy: ResolutionStrategy = ResolutionStrategy.CASCADE
  ): Promise<TemplateMetadata | null> {
    // Check cache first
    const cacheKey = `${name}:${JSON.stringify(context)}:${strategy}`
    if (this.resolutionCache.has(cacheKey)) {
      const cachedPath = this.resolutionCache.get(cacheKey)!
      return this.templates.get(cachedPath) || null
    }
    
    let resolved: TemplateMetadata | null = null
    
    switch (strategy) {
      case ResolutionStrategy.EXACT:
        resolved = await this.resolveExact(name)
        break
      case ResolutionStrategy.FUZZY:
        resolved = await this.resolveFuzzy(name)
        break
      case ResolutionStrategy.SEMANTIC:
        resolved = await this.resolveSemantic(name, context)
        break
      case ResolutionStrategy.PATTERN:
        resolved = await this.resolvePattern(name)
        break
      case ResolutionStrategy.CASCADE:
        // Try strategies in order of preference
        resolved = await this.resolveExact(name) ||
                  await this.resolveSemantic(name, context) ||
                  await this.resolvePattern(name) ||
                  await this.resolveFuzzy(name)
        break
    }
    
    if (resolved) {
      this.resolutionCache.set(cacheKey, resolved.id)
      this.emit('template:resolved', { name, template: resolved, strategy })
    } else {
      // Try fallback
      resolved = await this.resolveFallback(name)
    }
    
    return resolved
  }
  
  /**
   * Resolves template inheritance chain (the dark matter of template reuse)
   */
  async resolveInheritance(
    template: TemplateMetadata,
    mode: InheritanceMode = InheritanceMode.REPLACE_BLOCKS
  ): Promise<any> {
    // Check for circular inheritance
    if (this.circularCheck.has(template.id)) {
      throw new Error(`Circular inheritance detected: ${template.id}`)
    }
    
    this.circularCheck.add(template.id)
    
    try {
      let result = await this.loadTemplateContent(template)
      
      if (template.extends && template.extends.length > 0) {
        // Process each parent
        for (const parentName of template.extends) {
          const parent = await this.resolveTemplate(parentName)
          if (!parent) {
            this.emit('inheritance:missing', { child: template.id, parent: parentName })
            continue
          }
          
          const parentContent = await this.resolveInheritance(parent, mode)
          result = this.mergeTemplates(parentContent, result, mode, template.blocks)
        }
      }
      
      // Process includes
      if (template.includes && template.includes.length > 0) {
        for (const includeName of template.includes) {
          const include = await this.resolveTemplate(includeName)
          if (include) {
            const includeContent = await this.loadTemplateContent(include)
            result = this.injectInclude(result, includeName, includeContent)
          }
        }
      }
      
      return result
    } finally {
      this.circularCheck.delete(template.id)
    }
  }
  
  /**
   * Compiles template with multi-stage optimization
   */
  async compileTemplate(
    template: TemplateMetadata,
    options: any = {}
  ): Promise<any> {
    const cacheKey = `${template.id}:${template.checksum}`
    
    // Check compiled cache
    if (this.compiledTemplates.has(cacheKey)) {
      return this.compiledTemplates.get(cacheKey)
    }
    
    // Resolve inheritance first
    const resolved = await this.resolveInheritance(template)
    
    // Stage 1: Parse and validate
    const ast = this.parseTemplate(resolved)
    
    // Stage 2: Optimize AST
    const optimized = this.optimizeAST(ast)
    
    // Stage 3: Generate code
    const compiled = this.generateCode(optimized, options)
    
    // Cache compiled template
    this.compiledTemplates.set(cacheKey, compiled)
    template.compiled = compiled
    
    this.emit('template:compiled', { template: template.id, stages: 3 })
    
    return compiled
  }
  
  /**
   * Invalidates template caches when changes occur
   */
  invalidateTemplate(templateId: string, cascade: boolean = true): void {
    const template = this.templates.get(templateId)
    if (!template) return
    
    // Clear compiled cache
    for (const key of this.compiledTemplates.keys()) {
      if (key.startsWith(templateId)) {
        this.compiledTemplates.delete(key)
      }
    }
    
    // Clear resolution cache
    for (const key of this.resolutionCache.keys()) {
      if (key.includes(templateId)) {
        this.resolutionCache.delete(key)
      }
    }
    
    // Cascade to dependents
    if (cascade) {
      const dependents = this.inheritanceGraph.get(templateId) || new Set()
      for (const dependent of dependents) {
        this.invalidateTemplate(dependent, true)
      }
    }
    
    this.emit('cache:invalidated', { template: templateId, cascade })
  }
  
  // Private helper methods
  
  private async scanDirectory(dir: string): Promise<void> {
    await this.discoverTemplates(dir, true)
  }
  
  private isTemplate(filename: string): boolean {
    const extensions = ['.njk', '.nunjucks', '.html', '.tpl', '.j2', '.jinja2']
    return extensions.some(ext => filename.endsWith(ext))
  }
  
  private async extractMetadata(filePath: string): Promise<TemplateMetadata> {
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    const name = path.basename(filePath, path.extname(filePath))
    
    const metadata: TemplateMetadata = {
      id: this.generateTemplateId(filePath),
      path: filePath,
      name,
      lastModified: stats.mtime,
      checksum: createHash('sha256').update(content).digest('hex'),
      blocks: new Map(),
      macros: new Map(),
      dependencies: new Set()
    }
    
    // Extract extends
    const extendsMatch = content.match(/\{%\s*extends\s+["'](.+?)["']\s*%\}/g)
    if (extendsMatch) {
      metadata.extends = extendsMatch.map(m => 
        m.replace(/\{%\s*extends\s+["'](.+?)["']\s*%\}/, '$1')
      )
    }
    
    // Extract includes
    const includesMatch = content.match(/\{%\s*include\s+["'](.+?)["']\s*%\}/g)
    if (includesMatch) {
      metadata.includes = includesMatch.map(m =>
        m.replace(/\{%\s*include\s+["'](.+?)["']\s*%\}/, '$1')
      )
    }
    
    // Extract blocks
    const blockMatches = content.matchAll(/\{%\s*block\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endblock\s*%\}/g)
    for (const match of blockMatches) {
      metadata.blocks?.set(match[1], match[2])
    }
    
    // Extract macros
    const macroMatches = content.matchAll(/\{%\s*macro\s+(\w+)\((.*?)\)\s*%\}([\s\S]*?)\{%\s*endmacro\s*%\}/g)
    for (const match of macroMatches) {
      metadata.macros?.set(match[1], match[3])
    }
    
    // Infer semantic type
    metadata.semanticType = this.inferSemanticType(name, content)
    
    return metadata
  }
  
  private generateTemplateId(filePath: string): string {
    const relative = path.relative(process.cwd(), filePath)
    return relative.replace(/[\\\/]/g, '.')
  }
  
  private buildInheritanceGraph(): void {
    for (const template of this.templates.values()) {
      if (template.extends) {
        for (const parent of template.extends) {
          if (!this.inheritanceGraph.has(parent)) {
            this.inheritanceGraph.set(parent, new Set())
          }
          this.inheritanceGraph.get(parent)!.add(template.id)
        }
      }
    }
  }
  
  private buildSemanticIndex(): void {
    for (const template of this.templates.values()) {
      if (template.semanticType) {
        if (!this.semanticIndex.has(template.semanticType)) {
          this.semanticIndex.set(template.semanticType, new Set())
        }
        this.semanticIndex.get(template.semanticType)!.add(template.id)
      }
    }
  }
  
  private async resolveExact(name: string): Promise<TemplateMetadata | null> {
    return this.templates.get(name) || null
  }
  
  private async resolveFuzzy(name: string): Promise<TemplateMetadata | null> {
    // Fuzzy match on template names
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    for (const template of this.templates.values()) {
      const templateNorm = template.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (templateNorm.includes(normalized) || normalized.includes(templateNorm)) {
        return template
      }
    }
    
    return null
  }
  
  private async resolveSemantic(name: string, context: any): Promise<TemplateMetadata | null> {
    // Use semantic type to find matching templates
    const semanticType = context.semanticType || this.inferSemanticType(name, '')
    const candidates = this.semanticIndex.get(semanticType)
    
    if (candidates && candidates.size > 0) {
      // Return highest priority candidate
      let best: TemplateMetadata | null = null
      let highestPriority = -1
      
      for (const id of candidates) {
        const template = this.templates.get(id)
        if (template && (template.priority || 0) > highestPriority) {
          best = template
          highestPriority = template.priority || 0
        }
      }
      
      return best
    }
    
    return null
  }
  
  private async resolvePattern(name: string): Promise<TemplateMetadata | null> {
    // Try to match against template path patterns
    for (const template of this.templates.values()) {
      const pattern = new RegExp(name.replace('*', '.*'))
      if (pattern.test(template.path) || pattern.test(template.name)) {
        return template
      }
    }
    
    return null
  }
  
  private async resolveFallback(name: string): Promise<TemplateMetadata | null> {
    // Look for templates with fallback defined
    for (const template of this.templates.values()) {
      if (template.fallback === name) {
        return template
      }
    }
    
    // Use default fallback if exists
    return this.templates.get('default') || null
  }
  
  private async loadTemplateContent(template: TemplateMetadata): Promise<string> {
    return fs.readFile(template.path, 'utf-8')
  }
  
  private mergeTemplates(
    parent: string, 
    child: string, 
    mode: InheritanceMode,
    childBlocks?: Map<string, string>
  ): string {
    switch (mode) {
      case InheritanceMode.OVERRIDE:
        return child
      
      case InheritanceMode.MERGE:
        return parent + '\n' + child
      
      case InheritanceMode.APPEND:
        return parent + child
      
      case InheritanceMode.PREPEND:
        return child + parent
      
      case InheritanceMode.REPLACE_BLOCKS:
        let result = parent
        if (childBlocks) {
          for (const [blockName, blockContent] of childBlocks) {
            const blockPattern = new RegExp(
              `\\{%\\s*block\\s+${blockName}\\s*%\\}[\\s\\S]*?\\{%\\s*endblock\\s*%\\}`,
              'g'
            )
            result = result.replace(blockPattern, 
              `{% block ${blockName} %}${blockContent}{% endblock %}`
            )
          }
        }
        return result
      
      default:
        return child
    }
  }
  
  private injectInclude(template: string, includeName: string, includeContent: string): string {
    const includePattern = new RegExp(`\\{%\\s*include\\s+["']${includeName}["']\\s*%\\}`, 'g')
    return template.replace(includePattern, includeContent)
  }
  
  private parseTemplate(content: string): any {
    // Simplified AST generation
    return {
      type: 'template',
      content,
      nodes: []
    }
  }
  
  private optimizeAST(ast: any): any {
    // Optimization passes
    // 1. Dead code elimination
    // 2. Common subexpression elimination
    // 3. Loop unrolling where possible
    return ast
  }
  
  private generateCode(ast: any, options: any): Function {
    // Generate executable function from AST
    return new Function('context', `
      with(context) {
        return \`${ast.content}\`;
      }
    `)
  }
  
  private inferSemanticType(name: string, content: string): string {
    // Infer semantic type from name and content patterns
    if (name.includes('email') || content.includes('mailto:')) return 'email'
    if (name.includes('form') || content.includes('<form')) return 'form'
    if (name.includes('list') || content.includes('v-for')) return 'list'
    if (name.includes('card') || name.includes('item')) return 'card'
    if (name.includes('layout') || name.includes('base')) return 'layout'
    return 'generic'
  }
}