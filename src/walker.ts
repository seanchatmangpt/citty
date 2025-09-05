import { resolve, join, relative, dirname, basename, extname } from 'pathe';
import glob from 'fast-glob';
import { existsSync, statSync } from 'node:fs';
import type { TemplateInfo, WalkOptions } from './types.js';
import { TemplateNotFoundError, UnjucksError } from './types.js';

const DEFAULT_EXTENSIONS = ['.njk', '.nunjucks', '.j2', '.jinja2'];
const DEFAULT_IGNORE = ['node_modules/**', '.git/**', 'dist/**', 'build/**'];

/**
 * Walks a directory to find all template files
 */
export async function walkTemplates(
  dir: string,
  options: WalkOptions = {}
): Promise<TemplateInfo[]> {
  const {
    extensions = DEFAULT_EXTENSIONS,
    ignore = DEFAULT_IGNORE,
    maxDepth = 10
  } = options;

  const absoluteDir = resolve(dir);
  
  if (!existsSync(absoluteDir)) {
    throw new UnjucksError(
      `Template directory does not exist: ${absoluteDir}`,
      'DIRECTORY_NOT_FOUND',
      { dir: absoluteDir }
    );
  }

  if (!statSync(absoluteDir).isDirectory()) {
    throw new UnjucksError(
      `Path is not a directory: ${absoluteDir}`,
      'NOT_DIRECTORY',
      { dir: absoluteDir }
    );
  }

  // Create glob patterns for extensions
  const patterns = extensions.map(ext => `**/*${ext}`);
  
  try {
    const files = await glob(patterns, {
      cwd: absoluteDir,
      ignore,
      absolute: false,
      onlyFiles: true,
      deep: maxDepth
    });

    return files.map(file => parseTemplateInfo(file, absoluteDir));
  } catch (error) {
    throw new UnjucksError(
      `Failed to walk templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'WALK_FAILED',
      { dir: absoluteDir, error }
    );
  }
}

/**
 * Resolves a specific template by generator and action
 */
export async function resolveTemplate(
  generator: string,
  action: string,
  templateDirs: string[] = ['templates', 'generators']
): Promise<TemplateInfo> {
  const searchPaths = templateDirs.map(dir => resolve(dir));
  
  for (const dir of searchPaths) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const templates = await walkTemplates(dir);
      const matches = templates.filter(t => 
        t.generator === generator && t.action === action
      );

      if (matches.length > 0) {
        return matches[0]; // Return first match
      }

      // Try alternative patterns
      const alternativeMatches = templates.filter(t => {
        const pathParts = t.relativePath.split('/');
        return pathParts.includes(generator) && pathParts.includes(action);
      });

      if (alternativeMatches.length > 0) {
        return alternativeMatches[0];
      }
    } catch (error) {
      // Continue searching in other directories
      continue;
    }
  }

  throw new TemplateNotFoundError(generator, action);
}

/**
 * Finds templates by pattern
 */
export async function findTemplates(
  pattern: string,
  templateDirs: string[] = ['templates', 'generators']
): Promise<TemplateInfo[]> {
  const results: TemplateInfo[] = [];
  
  for (const dir of templateDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const templates = await walkTemplates(dir);
      const matches = templates.filter(t => {
        const fullPath = `${t.generator}/${t.action}`;
        return fullPath.includes(pattern) || 
               t.relativePath.includes(pattern) ||
               basename(t.path, extname(t.path)).includes(pattern);
      });
      
      results.push(...matches);
    } catch (error) {
      // Continue with other directories
      continue;
    }
  }

  return results;
}

/**
 * Lists all available generators
 */
export async function listGenerators(
  templateDirs: string[] = ['templates', 'generators']
): Promise<string[]> {
  const generators = new Set<string>();
  
  for (const dir of templateDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const templates = await walkTemplates(dir);
      templates.forEach(t => generators.add(t.generator));
    } catch (error) {
      // Continue with other directories
      continue;
    }
  }

  return Array.from(generators).sort();
}

/**
 * Lists all available actions for a generator
 */
export async function listActions(
  generator: string,
  templateDirs: string[] = ['templates', 'generators']
): Promise<string[]> {
  const actions = new Set<string>();
  
  for (const dir of templateDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const templates = await walkTemplates(dir);
      templates
        .filter(t => t.generator === generator)
        .forEach(t => actions.add(t.action));
    } catch (error) {
      // Continue with other directories
      continue;
    }
  }

  return Array.from(actions).sort();
}

/**
 * Parses template information from file path
 */
function parseTemplateInfo(filePath: string, baseDir: string): TemplateInfo {
  const absolutePath = resolve(baseDir, filePath);
  const pathParts = filePath.split('/');
  
  // Try to extract generator and action from path structure
  let generator = '';
  let action = '';
  
  if (pathParts.length >= 2) {
    generator = pathParts[0];
    action = pathParts[1];
    
    // If action has extension, remove it
    if (extname(action)) {
      action = basename(action, extname(action));
    }
  } else if (pathParts.length === 1) {
    // Single file - use filename as both generator and action
    const filename = basename(pathParts[0], extname(pathParts[0]));
    const parts = filename.split('.');
    
    if (parts.length >= 2) {
      generator = parts[0];
      action = parts[1];
    } else {
      generator = 'default';
      action = parts[0];
    }
  } else {
    generator = 'default';
    action = 'default';
  }

  return {
    path: absolutePath,
    generator,
    action,
    relativePath: filePath
  };
}

/**
 * Validates template file exists and is readable
 */
export function validateTemplate(templatePath: string): void {
  if (!existsSync(templatePath)) {
    throw new UnjucksError(
      `Template file does not exist: ${templatePath}`,
      'TEMPLATE_NOT_FOUND',
      { path: templatePath }
    );
  }

  try {
    const stats = statSync(templatePath);
    if (!stats.isFile()) {
      throw new UnjucksError(
        `Template path is not a file: ${templatePath}`,
        'NOT_FILE',
        { path: templatePath }
      );
    }
  } catch (error) {
    throw new UnjucksError(
      `Cannot access template file: ${templatePath}`,
      'ACCESS_ERROR',
      { path: templatePath, error }
    );
  }
}