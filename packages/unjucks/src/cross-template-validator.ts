/**
 * 🧠 DARK MATTER: Cross-Template Validation System
 * The critical validation layer humans always miss
 */

import { readFile, stat } from 'fs/promises'
import { join, dirname, resolve, relative } from 'path'
import { glob } from 'glob'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'

export interface ValidationError {
  type: 'CIRCULAR_DEPENDENCY' | 'UNDEFINED_VARIABLE' | 'MISSING_TEMPLATE' | 
        'SYNTAX_ERROR' | 'INVALID_INHERITANCE' | 'TEMPLATE_LOOP' | 'TYPE_MISMATCH'
  message: string
  file: string
  line?: number
  column?: number
  relatedFiles?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  stats: {
    templatesAnalyzed: number
    dependenciesFound: number
    variablesTracked: number
    circularDependencies: number
    orphanTemplates: number
  }
}

export interface TemplateReference {
  type: 'include' | 'extend' | 'import' | 'macro'
  path: string
  line: number
  column: number
  variables?: string[]
}

export interface TemplateMetadata {
  path: string
  content: string
  references: TemplateReference[]
  variables: {
    defined: Set<string>
    used: Set<string>
    inherited: Set<string>
  }
  blocks: Set<string>
  macros: Set<string>
  parent?: string
  children: Set<string>
}

/**
 * Advanced cross-template validation system
 */
export class CrossTemplateValidator {
  private templateCache = new Map<string, TemplateMetadata>()
  private dependencyGraph = new Map<string, Set<string>>()
  private reverseGraph = new Map<string, Set<string>>()
  private validationRules: ValidationRule[] = []

  constructor(private basePath: string) {
    this.setupDefaultRules()
  }

  /**
   * Validate all templates in the project
   */
  async validateAll(patterns: string[] = ['**/*.njk', '**/*.html', '**/*.j2']): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    let templatesAnalyzed = 0
    let dependenciesFound = 0
    let variablesTracked = 0

    try {
      // Find all template files
      const files = await this.findTemplateFiles(patterns)
      
      // Parse and analyze each template
      for (const file of files) {
        try {
          const metadata = await this.analyzeTemplate(file)
          this.templateCache.set(file, metadata)
          templatesAnalyzed++
          dependenciesFound += metadata.references.length
          variablesTracked += metadata.variables.defined.size + metadata.variables.used.size
        } catch (error) {
          errors.push({
            type: 'SYNTAX_ERROR',
            message: `Failed to parse template: ${error.message}`,
            file
          })
        }
      }

      // Build dependency graphs
      this.buildDependencyGraphs()

      // Run validation rules
      for (const rule of this.validationRules) {
        const ruleResults = await rule.validate(this.templateCache, this.dependencyGraph)
        errors.push(...ruleResults.errors)
        warnings.push(...ruleResults.warnings)
      }

      // Detect circular dependencies
      const circularDeps = this.detectCircularDependencies()
      for (const cycle of circularDeps) {
        errors.push({
          type: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          file: cycle[0],
          relatedFiles: cycle.slice(1)
        })
      }

      // Find orphan templates (unreachable)
      const orphans = this.findOrphanTemplates()
      for (const orphan of orphans) {
        warnings.push({
          type: 'TEMPLATE_LOOP',
          message: `Template appears to be orphaned (not referenced by others): ${orphan}`,
          file: orphan
        })
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          templatesAnalyzed,
          dependenciesFound,
          variablesTracked,
          circularDependencies: circularDeps.length,
          orphanTemplates: orphans.length
        }
      }

    } catch (error) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: `Validation failed: ${error.message}`,
        file: this.basePath
      })

      return {
        valid: false,
        errors,
        warnings,
        stats: {
          templatesAnalyzed: 0,
          dependenciesFound: 0,
          variablesTracked: 0,
          circularDependencies: 0,
          orphanTemplates: 0
        }
      }
    }
  }

  /**
   * Validate a single template and its dependencies
   */
  async validateTemplate(templatePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    try {
      const metadata = await this.analyzeTemplate(templatePath)
      this.templateCache.set(templatePath, metadata)

      // Validate dependencies
      for (const ref of metadata.references) {
        const depPath = this.resolveTemplatePath(templatePath, ref.path)
        if (!await this.templateExists(depPath)) {
          errors.push({
            type: 'MISSING_TEMPLATE',
            message: `Template not found: ${ref.path}`,
            file: templatePath,
            line: ref.line,
            column: ref.column
          })
        }
      }

      // Check for undefined variables
      const undefinedVars = Array.from(metadata.variables.used)
        .filter(v => !metadata.variables.defined.has(v) && !metadata.variables.inherited.has(v))
      
      for (const varName of undefinedVars) {
        warnings.push({
          type: 'UNDEFINED_VARIABLE',
          message: `Variable '${varName}' is used but not defined`,
          file: templatePath
        })
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          templatesAnalyzed: 1,
          dependenciesFound: metadata.references.length,
          variablesTracked: metadata.variables.defined.size + metadata.variables.used.size,
          circularDependencies: 0,
          orphanTemplates: 0
        }
      }

    } catch (error) {
      return {
        valid: false,
        errors: [{
          type: 'SYNTAX_ERROR',
          message: `Failed to validate template: ${error.message}`,
          file: templatePath
        }],
        warnings: [],
        stats: {
          templatesAnalyzed: 0,
          dependenciesFound: 0,
          variablesTracked: 0,
          circularDependencies: 0,
          orphanTemplates: 0
        }
      }
    }
  }

  /**
   * Analyze a single template file
   */
  private async analyzeTemplate(templatePath: string): Promise<TemplateMetadata> {
    const content = await readFile(templatePath, 'utf-8')
    const references: TemplateReference[] = []
    const variables = {
      defined: new Set<string>(),
      used: new Set<string>(),
      inherited: new Set<string>()
    }
    const blocks = new Set<string>()
    const macros = new Set<string>()
    let parent: string | undefined
    const children = new Set<string>()

    // Parse Nunjucks template syntax
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Find includes
      const includeMatch = line.match(/{%\s*include\s+['"]([^'"]+)['"]/g)
      if (includeMatch) {
        for (const match of includeMatch) {
          const pathMatch = match.match(/['"]([^'"]+)['"]/)
          if (pathMatch) {
            references.push({
              type: 'include',
              path: pathMatch[1],
              line: lineNum,
              column: line.indexOf(match)
            })
          }
        }
      }

      // Find extends
      const extendsMatch = line.match(/{%\s*extends\s+['"]([^'"]+)['"]/g)
      if (extendsMatch) {
        for (const match of extendsMatch) {
          const pathMatch = match.match(/['"]([^'"]+)['"]/)
          if (pathMatch) {
            parent = pathMatch[1]
            references.push({
              type: 'extend',
              path: pathMatch[1],
              line: lineNum,
              column: line.indexOf(match)
            })
          }
        }
      }

      // Find imports
      const importMatch = line.match(/{%\s*import\s+['"]([^'"]+)['"]/g)
      if (importMatch) {
        for (const match of importMatch) {
          const pathMatch = match.match(/['"]([^'"]+)['"]/)
          if (pathMatch) {
            references.push({
              type: 'import',
              path: pathMatch[1],
              line: lineNum,
              column: line.indexOf(match)
            })
          }
        }
      }

      // Find variables
      const varMatches = line.match(/\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\}\}/g)
      if (varMatches) {
        for (const match of varMatches) {
          const varMatch = match.match(/\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\}\}/)
          if (varMatch) {
            const varName = varMatch[1].split('.')[0] // Get root variable
            variables.used.add(varName)
          }
        }
      }

      // Find set statements
      const setMatch = line.match(/{%\s*set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
      if (setMatch) {
        for (const match of setMatch) {
          const varMatch = match.match(/set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)
          if (varMatch) {
            variables.defined.add(varMatch[1])
          }
        }
      }

      // Find blocks
      const blockMatch = line.match(/{%\s*block\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
      if (blockMatch) {
        for (const match of blockMatch) {
          const nameMatch = match.match(/block\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)
          if (nameMatch) {
            blocks.add(nameMatch[1])
          }
        }
      }

      // Find macros
      const macroMatch = line.match(/{%\s*macro\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
      if (macroMatch) {
        for (const match of macroMatch) {
          const nameMatch = match.match(/macro\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)
          if (nameMatch) {
            macros.add(nameMatch[1])
            variables.defined.add(nameMatch[1]) // Macros are also variables
          }
        }
      }
    }

    return {
      path: templatePath,
      content,
      references,
      variables,
      blocks,
      macros,
      parent,
      children
    }
  }

  /**
   * Find all template files matching patterns
   */
  private async findTemplateFiles(patterns: string[]): Promise<string[]> {
    const allFiles: string[] = []
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: this.basePath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      })
      allFiles.push(...files)
    }
    
    return [...new Set(allFiles)] // Remove duplicates
  }

  /**
   * Build dependency graphs for analysis
   */
  private buildDependencyGraphs() {
    this.dependencyGraph.clear()
    this.reverseGraph.clear()

    for (const [templatePath, metadata] of this.templateCache) {
      const deps = new Set<string>()
      
      for (const ref of metadata.references) {
        const depPath = this.resolveTemplatePath(templatePath, ref.path)
        deps.add(depPath)
        
        // Build reverse graph
        if (!this.reverseGraph.has(depPath)) {
          this.reverseGraph.set(depPath, new Set())
        }
        this.reverseGraph.get(depPath)!.add(templatePath)
      }
      
      this.dependencyGraph.set(templatePath, deps)
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const inStack = new Set<string>()

    const dfs = (node: string, path: string[]): void => {
      if (inStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node])
        }
        return
      }

      if (visited.has(node)) {
        return
      }

      visited.add(node)
      inStack.add(node)
      path.push(node)

      const dependencies = this.dependencyGraph.get(node) || new Set()
      for (const dep of dependencies) {
        dfs(dep, path)
      }

      inStack.delete(node)
      path.pop()
    }

    for (const template of this.templateCache.keys()) {
      if (!visited.has(template)) {
        dfs(template, [])
      }
    }

    return cycles
  }

  /**
   * Find orphan templates (not referenced by others)
   */
  private findOrphanTemplates(): string[] {
    const orphans: string[] = []
    
    for (const templatePath of this.templateCache.keys()) {
      const referencedBy = this.reverseGraph.get(templatePath)
      if (!referencedBy || referencedBy.size === 0) {
        // Check if it's an entry point (commonly named index, main, etc.)
        const fileName = templatePath.split('/').pop() || ''
        const isEntryPoint = /^(index|main|app|layout|base)\.(njk|html|j2)$/.test(fileName)
        
        if (!isEntryPoint) {
          orphans.push(templatePath)
        }
      }
    }
    
    return orphans
  }

  /**
   * Resolve template path relative to current template
   */
  private resolveTemplatePath(currentTemplate: string, refPath: string): string {
    if (refPath.startsWith('./') || refPath.startsWith('../')) {
      return resolve(dirname(currentTemplate), refPath)
    }
    return resolve(this.basePath, refPath)
  }

  /**
   * Check if template exists
   */
  private async templateExists(templatePath: string): Promise<boolean> {
    try {
      const stats = await stat(templatePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  /**
   * Setup default validation rules
   */
  private setupDefaultRules() {
    this.validationRules = [
      new VariableConsistencyRule(),
      new BlockInheritanceRule(),
      new MacroUsageRule(),
      new PerformanceRule()
    ]
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule) {
    this.validationRules.push(rule)
  }

  /**
   * Get template dependency graph
   */
  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencyGraph)
  }

  /**
   * Clear cache and reset state
   */
  reset() {
    this.templateCache.clear()
    this.dependencyGraph.clear()
    this.reverseGraph.clear()
  }
}

/**
 * Base validation rule interface
 */
export interface ValidationRule {
  validate(
    templates: Map<string, TemplateMetadata>,
    dependencies: Map<string, Set<string>>
  ): Promise<{ errors: ValidationError[], warnings: ValidationError[] }>
}

/**
 * Variable consistency validation rule
 */
class VariableConsistencyRule implements ValidationRule {
  async validate(
    templates: Map<string, TemplateMetadata>
  ): Promise<{ errors: ValidationError[], warnings: ValidationError[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    for (const [templatePath, metadata] of templates) {
      // Check for unused defined variables
      for (const definedVar of metadata.variables.defined) {
        if (!metadata.variables.used.has(definedVar)) {
          warnings.push({
            type: 'UNDEFINED_VARIABLE',
            message: `Variable '${definedVar}' is defined but never used`,
            file: templatePath
          })
        }
      }
    }

    return { errors, warnings }
  }
}

/**
 * Block inheritance validation rule
 */
class BlockInheritanceRule implements ValidationRule {
  async validate(
    templates: Map<string, TemplateMetadata>
  ): Promise<{ errors: ValidationError[], warnings: ValidationError[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    for (const [templatePath, metadata] of templates) {
      if (metadata.parent) {
        const parentTemplate = templates.get(metadata.parent)
        if (parentTemplate) {
          // Check if child blocks exist in parent
          for (const block of metadata.blocks) {
            if (!parentTemplate.blocks.has(block)) {
              warnings.push({
                type: 'INVALID_INHERITANCE',
                message: `Block '${block}' defined in child but not found in parent template`,
                file: templatePath,
                relatedFiles: [metadata.parent]
              })
            }
          }
        }
      }
    }

    return { errors, warnings }
  }
}

/**
 * Macro usage validation rule
 */
class MacroUsageRule implements ValidationRule {
  async validate(
    templates: Map<string, TemplateMetadata>
  ): Promise<{ errors: ValidationError[], warnings: ValidationError[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    const allMacros = new Set<string>()
    const macroSources = new Map<string, string>()

    // Collect all macros
    for (const [templatePath, metadata] of templates) {
      for (const macro of metadata.macros) {
        if (allMacros.has(macro)) {
          warnings.push({
            type: 'TYPE_MISMATCH',
            message: `Macro '${macro}' is defined in multiple templates`,
            file: templatePath,
            relatedFiles: [macroSources.get(macro)!]
          })
        }
        allMacros.add(macro)
        macroSources.set(macro, templatePath)
      }
    }

    return { errors, warnings }
  }
}

/**
 * Performance validation rule
 */
class PerformanceRule implements ValidationRule {
  async validate(
    templates: Map<string, TemplateMetadata>
  ): Promise<{ errors: ValidationError[], warnings: ValidationError[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    for (const [templatePath, metadata] of templates) {
      // Check for excessive includes
      const includeCount = metadata.references.filter(ref => ref.type === 'include').length
      if (includeCount > 10) {
        warnings.push({
          type: 'TEMPLATE_LOOP',
          message: `Template has ${includeCount} includes, consider refactoring for performance`,
          file: templatePath
        })
      }

      // Check for large templates
      if (metadata.content.length > 50000) { // 50KB
        warnings.push({
          type: 'TEMPLATE_LOOP',
          message: `Template is large (${Math.round(metadata.content.length / 1024)}KB), consider splitting`,
          file: templatePath
        })
      }
    }

    return { errors, warnings }
  }
}

// Factory function
export function createCrossTemplateValidator(basePath: string): CrossTemplateValidator {
  return new CrossTemplateValidator(basePath)
}

// Convenience function
export async function validateTemplates(
  basePath: string,
  patterns?: string[]
): Promise<ValidationResult> {
  const validator = createCrossTemplateValidator(basePath)
  return validator.validateAll(patterns)
}

// Export types
export type { ValidationRule }