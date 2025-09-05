/**
 * Template Walker for Unjucks
 * Auto-discovers templates following Hygen-like structure
 */

import { glob } from 'fast-glob'
import { resolve, relative, dirname, basename, extname } from 'pathe'
import { existsSync, readFileSync } from 'node:fs'
import type { 
  Template, 
  TemplateMetadata, 
  WalkOptions, 
  GeneratorInfo,
  TemplateNotFoundError as TemplateNotFoundErrorType
} from './types'
import { TemplateNotFoundError } from './types'

// Default template extensions
const DEFAULT_EXTENSIONS = ['.njk', '.nunjucks', '.j2', '.jinja2', '.hbs', '.ejs']

/**
 * Walk templates directory and find all templates
 */
export async function walkTemplates(
  templateDir: string,
  options?: WalkOptions
): Promise<Template[]> {
  const opts = {
    extensions: DEFAULT_EXTENSIONS,
    ignore: ['node_modules', '.git', 'dist', 'build'],
    followSymlinks: false,
    ...options
  }

  const patterns = opts.extensions.map(ext => `**/*${ext}`)
  const ignorePaths = opts.ignore.map(dir => `**/${dir}/**`)

  const files = await glob(patterns, {
    cwd: resolve(templateDir),
    ignore: ignorePaths,
    followSymbolicLinks: opts.followSymlinks,
    absolute: true
  })

  const templates: Template[] = []

  for (const file of files) {
    const relativePath = relative(templateDir, file)
    const parts = relativePath.split('/')
    
    // Must have at least generator/action/file structure
    if (parts.length < 3) continue
    
    const generator = parts[0]
    const action = parts[1]
    
    // Parse metadata from file
    const metadata = await parseTemplateMetadata(file)
    
    templates.push({
      path: file,
      relativePath,
      generator,
      action,
      metadata
    })
  }

  return templates
}

/**
 * Resolve a specific template
 */
export async function resolveTemplate(
  generator: string,
  action: string,
  paths: string[] = ['templates']
): Promise<Template> {
  for (const basePath of paths) {
    const templatePath = resolve(basePath, generator, action)
    
    // Check for various template files
    for (const ext of DEFAULT_EXTENSIONS) {
      const candidates = [
        `${templatePath}/index${ext}`,
        `${templatePath}/template${ext}`,
        `${templatePath}${ext}`
      ]
      
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          const metadata = await parseTemplateMetadata(candidate)
          
          return {
            path: candidate,
            relativePath: relative(basePath, candidate),
            generator,
            action,
            metadata
          }
        }
      }
    }
  }

  throw new TemplateNotFoundError(generator, action, paths)
}

/**
 * List available generators
 */
export async function listGenerators(paths: string[] = ['templates']): Promise<string[]> {
  const generators = new Set<string>()
  
  for (const path of paths) {
    if (!existsSync(path)) continue
    
    const templates = await walkTemplates(path)
    for (const template of templates) {
      generators.add(template.generator)
    }
  }
  
  return Array.from(generators).sort()
}

/**
 * List available actions for a generator
 */
export async function listActions(
  generator: string,
  paths: string[] = ['templates']
): Promise<string[]> {
  const actions = new Set<string>()
  
  for (const path of paths) {
    if (!existsSync(path)) continue
    
    const templates = await walkTemplates(path)
    for (const template of templates) {
      if (template.generator === generator) {
        actions.add(template.action)
      }
    }
  }
  
  return Array.from(actions).sort()
}

/**
 * Get generator information
 */
export async function getGeneratorInfo(
  generator: string,
  paths: string[] = ['templates']
): Promise<GeneratorInfo | null> {
  const actions = await listActions(generator, paths)
  
  if (actions.length === 0) {
    return null
  }
  
  let generatorPath: string | undefined
  let templateCount = 0
  const metadata: Record<string, any> = {}
  
  // Find generator path and collect metadata
  for (const path of paths) {
    const genPath = resolve(path, generator)
    if (existsSync(genPath)) {
      generatorPath = genPath
      
      // Check for generator.json or meta.json
      const metaFiles = ['generator.json', 'meta.json', '.meta']
      for (const metaFile of metaFiles) {
        const metaPath = resolve(genPath, metaFile)
        if (existsSync(metaPath)) {
          try {
            const content = readFileSync(metaPath, 'utf-8')
            Object.assign(metadata, JSON.parse(content))
          } catch {
            // Ignore parse errors
          }
        }
      }
      
      // Count templates
      const templates = await walkTemplates(path)
      templateCount = templates.filter(t => t.generator === generator).length
      
      break
    }
  }
  
  return {
    name: generator,
    path: generatorPath || '',
    actions,
    templates: templateCount,
    metadata
  }
}

/**
 * Parse template metadata from frontmatter
 */
export async function parseTemplateMetadata(filePath: string): Promise<TemplateMetadata | undefined> {
  try {
    const content = readFileSync(filePath, 'utf-8')
    
    // Check for YAML frontmatter
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4)
      if (endIndex > 0) {
        const frontmatter = content.substring(4, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
    
    // Check for JS frontmatter (Hygen style)
    if (content.startsWith('//---\n')) {
      const endIndex = content.indexOf('\n//---\n', 6)
      if (endIndex > 0) {
        const frontmatter = content.substring(6, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
    
    // Check for HTML comment frontmatter
    if (content.startsWith('<!--\n')) {
      const endIndex = content.indexOf('\n-->\n', 5)
      if (endIndex > 0) {
        const frontmatter = content.substring(5, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
  } catch {
    // Ignore read errors
  }
  
  return undefined
}

/**
 * Parse frontmatter string
 */
function parseFrontmatter(frontmatter: string): TemplateMetadata {
  const metadata: TemplateMetadata = {}
  
  // Simple key: value parser
  const lines = frontmatter.split('\n')
  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      
      // Handle special keys
      switch (key) {
        case 'to':
        case 'name':
        case 'description':
          metadata[key] = value
          break
        case 'inject':
        case 'skip':
          metadata[key] = value === 'true'
          break
        case 'unless':
          metadata.unless = value
          break
        default:
          if (!metadata.frontmatter) {
            metadata.frontmatter = {}
          }
          metadata.frontmatter[key] = parseValue(value)
      }
    }
  }
  
  return metadata
}

/**
 * Parse a frontmatter value
 */
function parseValue(value: string): any {
  // Try to parse as JSON
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value)
    } catch {
      // Not valid JSON
    }
  }
  
  // Parse booleans
  if (value === 'true') return true
  if (value === 'false') return false
  
  // Parse numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value)
  }
  
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  
  return value
}

/**
 * Find templates matching a pattern
 */
export async function findTemplates(
  pattern: string,
  paths: string[] = ['templates']
): Promise<Template[]> {
  const allTemplates: Template[] = []
  
  for (const path of paths) {
    if (!existsSync(path)) continue
    const templates = await walkTemplates(path)
    allTemplates.push(...templates)
  }
  
  // Simple pattern matching (could be enhanced with minimatch)
  const regex = new RegExp(
    pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
  )
  
  return allTemplates.filter(t => 
    regex.test(`${t.generator}/${t.action}`)
  )
}

/**
 * Check if a template exists
 */
export async function templateExists(
  generator: string,
  action: string,
  paths: string[] = ['templates']
): Promise<boolean> {
  try {
    await resolveTemplate(generator, action, paths)
    return true
  } catch {
    return false
  }
}

/**
 * Get template content
 */
export async function getTemplateContent(
  generator: string,
  action: string,
  paths: string[] = ['templates']
): Promise<string> {
  const template = await resolveTemplate(generator, action, paths)
  return readFileSync(template.path, 'utf-8')
}

/**
 * Extract template variables
 */
export function extractTemplateVariables(content: string): string[] {
  const variables = new Set<string>()
  
  // Match Nunjucks variables {{ var }}
  const varRegex = /\{\{([^}]+)\}\}/g
  let match
  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[1].trim().split(/[|. ]/)[0]
    if (varName) variables.add(varName)
  }
  
  // Match Nunjucks tags {% for item in items %}
  const tagRegex = /\{%\s*(?:for|if|set)\s+(\w+)/g
  while ((match = tagRegex.exec(content)) !== null) {
    variables.add(match[1])
  }
  
  return Array.from(variables).sort()
}