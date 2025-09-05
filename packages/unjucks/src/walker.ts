/**
 * Template Walker for Unjucks
 * Auto-discovers templates following Hygen-like structure
 */

import { glob } from 'fast-glob'
import { resolve, relative, dirname, basename, extname } from 'pathe'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { discoveryCache } from './cache'
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
 * Walk templates directory and find all templates with parallel processing and caching
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

  // Create cache key
  const cacheKey = `walk:${templateDir}:${JSON.stringify(opts)}`
  
  // Check cache first
  const cached = discoveryCache.get(cacheKey)
  if (cached) {
    // Verify cached results are still valid by checking directory mtime
    try {
      const dirStats = statSync(templateDir)
      const cachedEntry = discoveryCache['cache'].get(cacheKey)
      if (cachedEntry && cachedEntry.timestamp > dirStats.mtimeMs) {
        return cached
      }
    } catch {
      // Directory might not exist, proceed with fresh discovery
    }
  }

  const patterns = opts.extensions.map(ext => `**/*${ext}`)
  const ignorePaths = opts.ignore.map(dir => `**/${dir}/**`)

  // Use concurrent file system operations
  const files = await glob(patterns, {
    cwd: resolve(templateDir),
    ignore: ignorePaths,
    followSymbolicLinks: opts.followSymlinks,
    absolute: true,
    stats: false // Disable stat collection for better performance
  })

  // Process files in parallel batches
  const templates: Template[] = []
  const batchSize = 10
  const batches = []
  
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize))
  }

  // Process each batch in parallel
  const batchResults = await Promise.all(
    batches.map(batch => processTemplateBatch(batch, templateDir))
  )

  // Flatten results
  for (const batchResult of batchResults) {
    templates.push(...batchResult)
  }

  // Cache results
  discoveryCache.set(cacheKey, templates)

  return templates
}

/**
 * Process a batch of template files in parallel
 */
async function processTemplateBatch(
  files: string[],
  templateDir: string
): Promise<Template[]> {
  const templates = await Promise.all(
    files.map(async (file) => {
      try {
        const relativePath = relative(templateDir, file)
        const parts = relativePath.split('/')
        
        // Must have at least generator/action/file structure
        if (parts.length < 3) return null
        
        const generator = parts[0]
        const action = parts[1]
        
        // Parse metadata from file (can be parallelized)
        const metadata = await parseTemplateMetadata(file)
        
        return {
          path: file,
          relativePath,
          generator,
          action,
          metadata
        }
      } catch (error) {
        // Skip files that can't be processed
        return null
      }
    })
  )

  // Filter out null results
  return templates.filter((template): template is Template => template !== null)
}

/**
 * Resolve a specific template with caching
 */
export async function resolveTemplate(
  generator: string,
  action: string,
  paths: string[] = ['templates']
): Promise<Template> {
  // Create cache key
  const cacheKey = `resolve:${generator}:${action}:${paths.join(',')}`
  
  // Check cache first
  const cached = discoveryCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Use parallel processing to check all paths concurrently
  const searchResults = await Promise.allSettled(
    paths.map(basePath => searchTemplateInPath(basePath, generator, action))
  )

  // Find the first successful result
  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value) {
      // Cache the successful result
      discoveryCache.set(cacheKey, result.value)
      return result.value
    }
  }

  throw new TemplateNotFoundError(generator, action, paths)
}

/**
 * Search for template in a specific path
 */
async function searchTemplateInPath(
  basePath: string, 
  generator: string, 
  action: string
): Promise<Template | null> {
  const templatePath = resolve(basePath, generator, action)
  
  // Check for various template files in parallel
  const candidateChecks = DEFAULT_EXTENSIONS.flatMap(ext => [
    `${templatePath}/index${ext}`,
    `${templatePath}/template${ext}`,
    `${templatePath}${ext}`
  ]).map(async (candidate) => {
    if (existsSync(candidate)) {
      try {
        const metadata = await parseTemplateMetadata(candidate)
        return {
          path: candidate,
          relativePath: relative(basePath, candidate),
          generator,
          action,
          metadata
        }
      } catch {
        return null
      }
    }
    return null
  })

  const results = await Promise.all(candidateChecks)
  return results.find(result => result !== null) || null
}

/**
 * List available generators with parallel processing and caching
 */
export async function listGenerators(paths: string[] = ['templates']): Promise<string[]> {
  const cacheKey = `generators:${paths.join(',')}`
  
  // Check cache first
  const cached = discoveryCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const generators = new Set<string>()
  
  // Process paths in parallel
  const pathResults = await Promise.allSettled(
    paths.map(async (path) => {
      if (!existsSync(path)) return []
      const templates = await walkTemplates(path)
      return templates.map(t => t.generator)
    })
  )
  
  // Collect all generators from successful results
  for (const result of pathResults) {
    if (result.status === 'fulfilled') {
      for (const generator of result.value) {
        generators.add(generator)
      }
    }
  }
  
  const sortedGenerators = Array.from(generators).sort()
  
  // Cache results
  discoveryCache.set(cacheKey, sortedGenerators)
  
  return sortedGenerators
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
    // Validate file path first
    const validatedPath = validatePath(filePath)
    const content = readFileSync(validatedPath, 'utf-8')
    
    // Sanitize content for security
    const sanitizedContent = sanitizeTemplateContent(content, validatedPath)
    
    // Check for YAML frontmatter
    if (sanitizedContent.startsWith('---\n')) {
      const endIndex = sanitizedContent.indexOf('\n---\n', 4)
      if (endIndex > 0) {
        const frontmatter = sanitizedContent.substring(4, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
    
    // Check for JS frontmatter (Hygen style)
    if (sanitizedContent.startsWith('//---\n')) {
      const endIndex = sanitizedContent.indexOf('\n//---\n', 6)
      if (endIndex > 0) {
        const frontmatter = sanitizedContent.substring(6, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
    
    // Check for HTML comment frontmatter
    if (sanitizedContent.startsWith('<!--\n')) {
      const endIndex = sanitizedContent.indexOf('\n-->\n', 5)
      if (endIndex > 0) {
        const frontmatter = sanitizedContent.substring(5, endIndex)
        return parseFrontmatter(frontmatter)
      }
    }
  } catch {
    // Ignore read errors and security validation errors
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
  const content = readFileSync(template.path, 'utf-8')
  
  // Apply security sanitization to template content
  return sanitizeTemplateContent(content, template.path)
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