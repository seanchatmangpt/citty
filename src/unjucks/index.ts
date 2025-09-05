/**
 * Unjucks - Ontology-driven template engine
 * Production v1.0.0 - Core team implementation with ultrathink definition of done
 */

import nunjucks from 'nunjucks';
import { createContext } from 'unctx';
import { resolve, join, relative } from 'pathe';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { glob } from 'fast-glob';
import matter from 'gray-matter';
import { diff } from 'jest-diff';
import { defu } from 'defu';
import { hash } from 'ohash';
import chalk from 'chalk';
import ora from 'ora';
import { loadGraph, toContext, findEntities, getValue, askGraph, createOntology } from '../untology';
import { registerExtensions, clearExtensionCaches } from './extensions';
import { StreamingRenderer, streamTemplates, streamToFile } from './streaming';
import type { Store } from 'n3';

// Types
export interface Template {
  id: string;
  path: string;
  generator: string;
  action: string;
  content: string;
  frontMatter: any;
  hash: string;
}

export interface RenderResult {
  path: string;
  content: string;
  mode?: string;
}

export interface GenerationResult {
  success: boolean;
  files: RenderResult[];
  errors?: Error[];
  duration: number;
}

export interface UnjucksContext {
  templates: Map<string, Template>;
  nunjucks: nunjucks.Environment;
  ontologyStore?: Store;
  cache: Map<string, any>;
  options: UnjucksOptions;
}

export interface UnjucksOptions {
  templatesDir?: string;
  outputDir?: string;
  dryRun?: boolean;
  showDiff?: boolean;
  interactive?: boolean;
  cache?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
}

// Context management
const unjucksContext = createContext<UnjucksContext>('unjucks:context');

/**
 * Initialize unjucks
 */
export async function createUnjucks(options: UnjucksOptions = {}): Promise<UnjucksContext> {
  const opts = defu(options, {
    templatesDir: './templates',
    outputDir: './src',
    cache: true,
    parallel: true,
    maxConcurrency: 10
  });

  const env = nunjucks.configure(resolve(opts.templatesDir), {
    autoescape: false,
    noCache: !opts.cache,
    throwOnUndefined: false, // Allow conditional rendering
    trimBlocks: true,
    lstripBlocks: true,
    web: {
      useCache: opts.cache
    }
  });

  // Register template extensions for inheritance and includes
  registerExtensions(env, [resolve(opts.templatesDir)]);

  // Register built-in filters
  registerBuiltInFilters(env);
  
  // Add global functions
  env.addGlobal('range', (start: number, end?: number, step = 1) => {
    if (end === undefined) {
      end = start;
      start = 0;
    }
    const result = [];
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
    return result;
  });
  
  env.addGlobal('zip', (...arrays: any[][]) => {
    const minLength = Math.min(...arrays.map(arr => arr.length));
    const result = [];
    for (let i = 0; i < minLength; i++) {
      result.push(arrays.map(arr => arr[i]));
    }
    return result;
  });
  
  env.addGlobal('now', () => new Date());
  
  env.addGlobal('env', (key: string, defaultValue?: any) => {
    return process.env[key] ?? defaultValue;
  });

  const context: UnjucksContext = {
    templates: new Map(),
    nunjucks: env,
    cache: new Map(),
    options: opts
  };

  unjucksContext.set(context);
  
  // Auto-discover templates
  await loadTemplates(opts.templatesDir);
  
  return context;
}

/**
 * Load and index all templates with robust error handling
 */
export async function loadTemplates(dir?: string): Promise<Template[]> {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  const templatesDir = resolve(dir || ctx.options.templatesDir!);
  const patterns = ['**/*.{njk,nunjucks,j2,jinja2}', '**/*.{html,htm}', '**/*.{md,markdown}'];
  
  const spinner = ora('Discovering templates...').start();
  
  try {
    // Verify templates directory exists
    try {
      await access(templatesDir);
    } catch {
      throw new Error(`Templates directory not found: ${templatesDir}`);
    }
    
    // Discover template files with multiple patterns
    const filesByPattern = await Promise.all(
      patterns.map(pattern => 
        glob(pattern, { 
          cwd: templatesDir,
          onlyFiles: true,
          ignore: ['**/node_modules/**', '**/.*']
        })
      )
    );
    
    const allFiles = [...new Set(filesByPattern.flat())];
    const templates: Template[] = [];
    const errors: Error[] = [];
    
    // Process templates in parallel with error handling
    const processTemplate = async (file: string): Promise<Template | null> => {
      try {
        const fullPath = join(templatesDir, file);
        const content = await readFile(fullPath, 'utf-8');
        
        // Validate file is not empty
        if (content.trim().length === 0) {
          console.warn(`Warning: Empty template file: ${file}`);
          return null;
        }
        
        // Parse front matter with enhanced error handling
        let parsed;
        try {
          parsed = matter(content);
        } catch (error) {
          throw new Error(`Failed to parse front matter in ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Extract generator/action from path with fallbacks
        const parts = file.replace(/\.(njk|nunjucks|j2|jinja2|html|htm|md|markdown)$/i, '').split('/');
        const generator = parts[0] || 'default';
        const action = parts.length > 1 ? parts.slice(1).join('/') : 'index';
        const id = `${generator}:${action}`;
        
        // Validate template structure
        const frontMatter = parsed.data || {};
        if (!frontMatter.to && !frontMatter.output && !frontMatter.path) {
          console.warn(`Warning: Template ${file} has no output path defined`);
        }
        
        const template: Template = {
          id,
          path: fullPath,
          generator,
          action,
          content: parsed.content,
          frontMatter,
          hash: hash({ content: parsed.content, data: parsed.data, path: fullPath })
        };
        
        // Validate template can be parsed by Nunjucks
        try {
          ctx.nunjucks.renderString(parsed.content, {}, { path: fullPath });
        } catch (error) {
          console.warn(`Warning: Template ${file} has syntax issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        return template;
      } catch (error) {
        errors.push(new Error(`Failed to process template ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`));
        return null;
      }
    };
    
    // Process all templates
    const templateResults = await Promise.all(allFiles.map(processTemplate));
    
    // Filter out null results and add to context
    templateResults.forEach(template => {
      if (template) {
        ctx.templates.set(template.id, template);
        templates.push(template);
      }
    });
    
    // Report results
    if (errors.length > 0) {
      console.warn(`\nProcessed ${templates.length} templates with ${errors.length} errors:`);
      errors.forEach(error => console.warn(`  - ${error.message}`));
    }
    
    spinner.succeed(`Discovered ${templates.length} templates`);
    return templates;
  } catch (error) {
    spinner.fail('Failed to discover templates');
    throw error;
  }
}

/**
 * Resolve a specific template
 */
export function resolveTemplate(generator: string, action = 'default'): Template | undefined {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  const id = `${generator}:${action}`;
  return ctx.templates.get(id);
}

/**
 * List available generators
 */
export function listGenerators(): string[] {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  const generators = new Set<string>();
  ctx.templates.forEach(t => generators.add(t.generator));
  return Array.from(generators).sort();
}

/**
 * Generate from ontology with comprehensive error handling and optimization
 */
export async function generateFromOntology(
  ontologySource: string,
  generator?: string,
  options: Partial<UnjucksOptions> = {}
): Promise<GenerationResult> {
  const startTime = Date.now();
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  const opts = defu(options, ctx.options);
  const files: RenderResult[] = [];
  const errors: Error[] = [];
  
  const spinner = ora('Loading ontology...').start();
  
  try {
    // Validate ontology source exists
    if (!ontologySource) {
      throw new Error('Ontology source is required');
    }
    
    try {
      if (!ontologySource.startsWith('http')) {
        await access(resolve(ontologySource));
      }
    } catch {
      throw new Error(`Ontology source not found: ${ontologySource}`);
    }
    
    // Initialize ontology with error recovery
    let ontologyCtx;
    try {
      ontologyCtx = await createOntology();
    } catch (error) {
      throw new Error(`Failed to initialize ontology context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    try {
      await loadGraph(ontologySource);
    } catch (error) {
      throw new Error(`Failed to load ontology graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    spinner.text = 'Analyzing ontology structure...';
    
    // Get all available entity types dynamically
    const allSubjects = findEntities();
    const entityTypeMap = new Map<string, string[]>();
    
    // Group entities by type
    allSubjects.forEach(subject => {
      const type = getValue(subject, 'rdf:type');
      if (type) {
        const typeKey = type.split(/[:#]/).pop()?.toLowerCase() || 'unknown';
        if (!entityTypeMap.has(typeKey)) {
          entityTypeMap.set(typeKey, []);
        }
        entityTypeMap.get(typeKey)!.push(subject);
      }
    });
    
    // Convert to context objects with enhanced data
    const allEntities: any[] = [];
    
    for (const [entityType, subjects] of entityTypeMap) {
      const entities = subjects.map(subject => {
        const context = { id: subject, type: entityType };
        const relations = findRelations(subject);
        
        // Build comprehensive context object
        relations.forEach(({ predicate, object }) => {
          const key = predicate.split(/[:#]/).pop() || predicate;
          
          // Handle multiple values for same predicate
          if (context[key]) {
            if (!Array.isArray(context[key])) {
              context[key] = [context[key]];
            }
            context[key].push(object);
          } else {
            context[key] = object;
          }
        });
        
        // Add derived properties
        context.name = context.name || context.label || context.title || subject.split(/[/#]/).pop();
        context.namespace = subject.includes('#') ? subject.split('#')[0] + '#' : subject.split('/').slice(0, -1).join('/') + '/';
        
        return context;
      });
      
      allEntities.push(...entities);
    }
    
    spinner.text = `Processing ${allEntities.length} entities...`;
    
    // Filter templates based on generator parameter
    const availableTemplates = Array.from(ctx.templates.values());
    const matchingTemplates = generator 
      ? availableTemplates.filter(t => t.generator === generator)
      : availableTemplates;
    
    if (matchingTemplates.length === 0) {
      throw new Error(`No templates found${generator ? ` for generator: ${generator}` : ''}`);
    }
    
    // Generate files with parallel processing if enabled
    if (opts.parallel && allEntities.length > 3) {
      const { getAdaptiveProcessor } = await import('./parallel');
      const processor = getAdaptiveProcessor();
      
      try {
        const results = await processor.process<RenderResult[]>(
          allEntities,
          (entity) => ({
            type: 'render',
            data: { entity, templates: matchingTemplates }
          })
        );
        
        results.forEach(result => files.push(...result));
      } finally {
        await processor.shutdown();
      }
    } else {
      // Sequential processing
      for (const entity of allEntities) {
        const entityType = entity.type;
        
        // Find templates that match this entity type
        const templates = matchingTemplates.filter(t => 
          t.generator === entityType || 
          t.generator === 'all' || 
          t.generator === 'default' ||
          (t.frontMatter.entityTypes && t.frontMatter.entityTypes.includes(entityType))
        );
        
        if (templates.length === 0 && matchingTemplates.length > 0) {
          // Fallback to first available template
          templates.push(matchingTemplates[0]);
        }
        
        for (const template of templates) {
          try {
            const rendered = await renderTemplate(template, entity);
            files.push(...rendered);
          } catch (error) {
            const errorMsg = `Failed to render template ${template.id} for entity ${entity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(new Error(errorMsg));
            console.warn(errorMsg);
          }
        }
      }
    }
    
    // Write files if not dry run
    if (!opts.dryRun && files.length > 0) {
      spinner.text = 'Writing files...';
      try {
        await writeOutput(files, opts);
      } catch (error) {
        errors.push(new Error(`Failed to write output files: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
    
    const duration = Date.now() - startTime;
    const success = errors.length === 0 && files.length > 0;
    
    if (success) {
      spinner.succeed(`Generated ${files.length} files in ${duration}ms`);
    } else if (files.length === 0) {
      spinner.fail('No files generated');
    } else {
      spinner.warn(`Generated ${files.length} files with ${errors.length} errors in ${duration}ms`);
    }
    
    return {
      success,
      files,
      errors: errors.length > 0 ? errors : undefined,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    spinner.fail('Generation failed');
    return {
      success: false,
      files: [],
      errors: [error as Error],
      duration
    };
  }
}

/**
 * Render a template with context and comprehensive error handling
 */
export async function renderTemplate(
  template: Template | string,
  context: any = {}
): Promise<RenderResult[]> {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  // Resolve template with validation
  const tpl = typeof template === 'string' 
    ? ctx.templates.get(template)
    : template;
    
  if (!tpl) {
    const templateId = typeof template === 'string' ? template : 'unknown';
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Validate template content
  if (!tpl.content || tpl.content.trim().length === 0) {
    throw new Error(`Template ${tpl.id} is empty`);
  }
  
  // Check cache
  const cacheKey = hash({ template: tpl.hash, context });
  if (ctx.options.cache && ctx.cache.has(cacheKey)) {
    return ctx.cache.get(cacheKey);
  }
  
  const results: RenderResult[] = [];
  
  // Parse front matter for output routing with validation
  const frontMatter = tpl.frontMatter || {};
  const to = frontMatter.to || frontMatter.output || frontMatter.path;
  
  // Sanitize and enhance context
  const sanitizedContext = sanitizeContext({
    ...context,
    _template: {
      id: tpl.id,
      generator: tpl.generator,
      action: tpl.action,
      path: tpl.path
    },
    _options: ctx.options,
    _frontMatter: frontMatter
  });
  
  let rendered: string;
  try {
    // Render content with error handling
    rendered = ctx.nunjucks.renderString(tpl.content, sanitizedContext, {
      path: tpl.path
    });
  } catch (error) {
    throw new Error(`Template rendering failed for ${tpl.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Validate rendered content
  if (typeof rendered !== 'string') {
    throw new Error(`Template ${tpl.id} produced invalid output`);
  }
  
  // Handle multiple outputs with proper path resolution
  try {
    if (Array.isArray(to)) {
      for (const pathTemplate of to) {
        const resolvedPath = await resolveOutputPath(pathTemplate, sanitizedContext, ctx);
        results.push({
          path: resolvedPath,
          content: rendered,
          mode: frontMatter.mode
        });
      }
    } else if (to) {
      const resolvedPath = await resolveOutputPath(to, sanitizedContext, ctx);
      results.push({
        path: resolvedPath,
        content: rendered,
        mode: frontMatter.mode
      });
    } else {
      // Generate default output path with fallbacks
      const name = sanitizedContext.name || 
                   sanitizedContext.id?.split(/[/#]/).pop() || 
                   tpl.generator || 
                   'output';
      const extension = frontMatter.extension || 
                       getFileExtension(tpl.path) || 
                       'txt';
      const defaultPath = `${sanitizeFileName(name)}.${extension}`;
      
      results.push({
        path: defaultPath,
        content: rendered,
        mode: frontMatter.mode
      });
    }
  } catch (error) {
    throw new Error(`Failed to resolve output paths for template ${tpl.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Validate all results
  for (const result of results) {
    if (!result.path || result.path.trim().length === 0) {
      throw new Error(`Template ${tpl.id} produced empty output path`);
    }
    
    // Security: Prevent path traversal
    if (result.path.includes('..') || result.path.startsWith('/')) {
      throw new Error(`Template ${tpl.id} produced unsafe output path: ${result.path}`);
    }
  }
  
  // Cache results
  if (ctx.options.cache) {
    ctx.cache.set(cacheKey, results);
  }
  
  return results;
}

/**
 * Resolve output path template with context
 */
async function resolveOutputPath(pathTemplate: string, context: any, ctx: UnjucksContext): Promise<string> {
  try {
    const resolved = ctx.nunjucks.renderString(pathTemplate, context);
    return sanitizePath(resolved);
  } catch (error) {
    throw new Error(`Failed to resolve path template "${pathTemplate}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize context object for secure rendering
 */
function sanitizeContext(context: any): any {
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  const sanitized = { ...context };
  
  // Remove potentially dangerous properties
  delete sanitized.__proto__;
  delete sanitized.constructor;
  delete sanitized.process;
  delete sanitized.global;
  delete sanitized.require;
  
  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  });
  
  return sanitized;
}

/**
 * Sanitize file path
 */
function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+/g, '/') // Normalize multiple slashes
    .trim();
}

/**
 * Sanitize filename
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename chars
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Normalize multiple dashes
    .toLowerCase();
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const match = path.match(/\.([^.]+)$/);
  return match ? match[1] : 'txt';
}

/**
 * Write output files with atomic operations and comprehensive error handling
 */
export async function writeOutput(
  files: RenderResult[],
  options: Partial<UnjucksOptions> = {}
): Promise<void> {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  const opts = defu(options, ctx.options);
  const errors: Error[] = [];
  
  if (!files || files.length === 0) {
    throw new Error('No files to write');
  }
  
  // Validate output directory
  const outputDir = resolve(opts.outputDir!);
  
  try {
    await mkdir(outputDir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create output directory ${outputDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Process files with conflict detection and atomic writes
  for (const file of files) {
    try {
      const outputPath = resolve(outputDir, file.path);
      const dir = join(outputPath, '..');
      
      // Security: Ensure output path is within output directory
      const relativePath = relative(outputDir, outputPath);
      if (relativePath.startsWith('..') || join(outputDir, relativePath) !== outputPath) {
        throw new Error(`Output path ${file.path} is outside output directory`);
      }
      
      // Create directory structure
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        throw new Error(`Failed to create directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Handle existing files and conflict resolution
      let shouldWrite = true;
      let existingContent: string | null = null;
      
      try {
        existingContent = await readFile(outputPath, 'utf-8');
        
        // Check for conflicts
        if (existingContent === file.content) {
          console.log(chalk.dim(`Skipped ${file.path} (unchanged)`));
          shouldWrite = false;
        } else if (opts.showDiff) {
          const difference = diff(existingContent, file.content, {
            aAnnotation: 'existing',
            bAnnotation: 'generated'
          });
          
          if (difference) {
            console.log(chalk.yellow(`\nChanges for ${file.path}:`));
            console.log(difference);
          }
        }
        
        // Create backup if file exists and content differs
        if (shouldWrite && !opts.dryRun && existingContent !== file.content) {
          const backupPath = `${outputPath}.backup.${Date.now()}`;
          try {
            await writeFile(backupPath, existingContent);
            console.log(chalk.dim(`Backup created: ${backupPath}`));
          } catch {
            console.warn(`Warning: Could not create backup for ${file.path}`);
          }
        }
      } catch {
        // File doesn't exist, this is fine
        if (opts.showDiff) {
          console.log(chalk.green(`\nNew file: ${file.path}`));
        }
      }
      
      // Write file atomically
      if (shouldWrite && !opts.dryRun) {
        const tempPath = `${outputPath}.tmp.${Date.now()}`;
        
        try {
          // Write to temporary file first
          await writeFile(tempPath, file.content, { 
            mode: file.mode ? parseInt(file.mode, 8) : 0o644,
            encoding: 'utf-8'
          });
          
          // Atomic rename
          const fs = await import('node:fs/promises');
          await fs.rename(tempPath, outputPath);
          
          console.log(chalk.green(`✓ ${file.path}`));
        } catch (error) {
          // Clean up temp file if it exists
          try {
            await import('node:fs/promises').then(fs => fs.unlink(tempPath));
          } catch {}
          
          throw new Error(`Failed to write ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (opts.dryRun) {
        console.log(chalk.blue(`[DRY RUN] Would write: ${file.path}`));
      }
    } catch (error) {
      errors.push(new Error(`Failed to process file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
  
  // Report any errors
  if (errors.length > 0) {
    console.error(chalk.red(`\nFailed to write ${errors.length} files:`));
    errors.forEach(error => console.error(chalk.red(`  - ${error.message}`)));
    throw new Error(`Failed to write ${errors.length} out of ${files.length} files`);
  }
}

/**
 * Register built-in Nunjucks filters
 */
function registerBuiltInFilters(env: nunjucks.Environment): void {
  // String case transformations
  env.addFilter('camelCase', (str: string) => 
    str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
    
  env.addFilter('kebabCase', (str: string) =>
    str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase());
    
  env.addFilter('pascalCase', (str: string) =>
    str.replace(/(^|-)([a-z])/g, (g) => g[g.length - 1].toUpperCase()));
    
  env.addFilter('snakeCase', (str: string) =>
    str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
    
  env.addFilter('upperCase', (str: string) => str.toUpperCase());
  env.addFilter('lowerCase', (str: string) => str.toLowerCase());
  
  // String utilities
  env.addFilter('pluralize', (str: string) => {
    if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
    if (str.endsWith('s')) return str + 'es';
    return str + 's';
  });
  
  env.addFilter('singularize', (str: string) => {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('es')) return str.slice(0, -2);
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
  });
  
  env.addFilter('truncate', (str: string, length = 50) =>
    str.length > length ? str.slice(0, length) + '...' : str);
  
  // Array utilities
  env.addFilter('first', (arr: any[]) => arr[0]);
  env.addFilter('last', (arr: any[]) => arr[arr.length - 1]);
  env.addFilter('unique', (arr: any[]) => [...new Set(arr)]);
  env.addFilter('flatten', (arr: any[]) => arr.flat());
  
  // Object utilities
  env.addFilter('keys', (obj: any) => Object.keys(obj));
  env.addFilter('values', (obj: any) => Object.values(obj));
  env.addFilter('entries', (obj: any) => Object.entries(obj));
  
  // Code generation utilities
  env.addFilter('indent', (str: string, spaces = 2) =>
    str.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'));
    
  env.addFilter('stringify', (obj: any) => JSON.stringify(obj, null, 2));
  env.addFilter('backticks', (str: string) => '`' + str + '`');
  
  // Date/time utilities
  env.addFilter('timestamp', () => new Date().toISOString());
  env.addFilter('date', (format?: string) => {
    const now = new Date();
    if (format === 'iso') return now.toISOString();
    if (format === 'date') return now.toDateString();
    return now.toString();
  });
  
  // UUID generation
  env.addFilter('uuid', () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  });
}

/**
 * Natural language template operations
 */
export async function askTemplate(query: string): Promise<any> {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  // Use ontology's askGraph if available
  try {
    return await askGraph(query);
  } catch {
    // Fallback to template search
    const templates = Array.from(ctx.templates.values());
    const words = query.toLowerCase().split(' ');
    
    return templates.filter(t => 
      words.some(w => 
        t.generator.includes(w) || 
        t.action.includes(w) || 
        t.frontMatter?.description?.toLowerCase().includes(w)
      )
    );
  }
}

/**
 * Create streaming renderer for large templates
 */
export function createStreamingRenderer(options: UnjucksOptions = {}): StreamingRenderer {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  return new StreamingRenderer(ctx.nunjucks, {
    chunkSize: options.maxConcurrency ? options.maxConcurrency * 1024 : 16384,
    highWaterMark: 65536
  });
}

/**
 * Stream multiple templates with context
 */
export async function streamMultipleTemplates(
  templates: Template[],
  context: any = {},
  options: UnjucksOptions = {}
): Promise<RenderResult[]> {
  const ctx = unjucksContext.use();
  if (!ctx) throw new Error('Unjucks not initialized');
  
  return streamTemplates(templates, context, ctx.nunjucks, {
    chunkSize: options.maxConcurrency ? options.maxConcurrency * 1024 : 16384
  });
}

/**
 * Clear all caches and reset context
 */
export function clearCaches(): void {
  try {
    const ctx = unjucksContext.use();
    if (ctx) {
      ctx.cache.clear();
      clearExtensionCaches(ctx.nunjucks);
    }
  } catch (error) {
    // Context not available, ignore in test environments
    console.warn('Context not available for cache clearing');
  }
}

/**
 * Get template engine statistics
 */
export function getStatistics() {
  try {
    const ctx = unjucksContext.use();
    if (!ctx) return null;
    
    return {
      templates: ctx.templates.size,
      cacheSize: ctx.cache.size,
      options: ctx.options,
      generators: listGenerators()
    };
  } catch (error) {
    // Context not available
    return null;
  }
}

// Re-export types and streaming utilities
export type { Template, RenderResult, GenerationResult, UnjucksOptions };
export { StreamingRenderer, streamTemplates, streamToFile } from './streaming';
export { registerExtensions, clearExtensionCaches } from './extensions';