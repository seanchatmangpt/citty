/**
 * Nunjucks Template Extensions for Enhanced Template Inheritance
 * Production v1.0.0 - Advanced template features
 */

import nunjucks from 'nunjucks';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'pathe';

/**
 * Enhanced include extension with error handling and caching
 */
export class IncludeExtension implements nunjucks.Extension {
  tags = ['include'];
  private cache = new Map<string, string>();
  private includePaths: string[] = [];

  constructor(includePaths: string[] = []) {
    this.includePaths = includePaths;
  }

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    return new nodes.CallExtension(this, 'run', args);
  }

  async run(context: any, templateName: string, variables?: any) {
    const ctx = context.ctx || context;
    const env = context.env;
    
    if (!templateName) {
      throw new Error('Include: template name is required');
    }

    try {
      // Resolve template path
      const templatePath = await this.resolveTemplatePath(templateName, ctx);
      
      // Check cache first
      let content = this.cache.get(templatePath);
      if (!content) {
        content = await readFile(templatePath, 'utf-8');
        this.cache.set(templatePath, content);
      }

      // Create new context for included template
      const includeContext = variables ? { ...ctx, ...variables } : ctx;
      
      // Render included template
      return new nunjucks.runtime.SafeString(
        env.renderString(content, includeContext, { path: templatePath })
      );
    } catch (error) {
      if (context.env.opts.dev) {
        return new nunjucks.runtime.SafeString(
          `<!-- Include error: ${error instanceof Error ? error.message : 'Unknown error'} -->`
        );
      }
      throw error;
    }
  }

  private async resolveTemplatePath(templateName: string, context: any): Promise<string> {
    // Try relative to current template first
    if (context._template?.path) {
      const currentDir = dirname(context._template.path);
      const relativePath = resolve(currentDir, templateName);
      
      try {
        await readFile(relativePath, 'utf-8');
        return relativePath;
      } catch {
        // Continue to other resolution strategies
      }
    }

    // Try include paths
    for (const includePath of this.includePaths) {
      const fullPath = resolve(includePath, templateName);
      try {
        await readFile(fullPath, 'utf-8');
        return fullPath;
      } catch {
        continue;
      }
    }

    throw new Error(`Template not found: ${templateName}`);
  }

  clearCache() {
    this.cache.clear();
  }
}

/**
 * Enhanced extends extension with block inheritance
 */
export class ExtendsExtension implements nunjucks.Extension {
  tags = ['extends'];
  private cache = new Map<string, { content: string; blocks: Map<string, string> }>();

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    return new nodes.CallExtension(this, 'run', args);
  }

  async run(context: any, templateName: string) {
    const ctx = context.ctx || context;
    const env = context.env;
    
    if (!templateName) {
      throw new Error('Extends: template name is required');
    }

    try {
      // Load parent template
      const parentPath = await this.resolveTemplatePath(templateName, ctx);
      let parentData = this.cache.get(parentPath);
      
      if (!parentData) {
        const content = await readFile(parentPath, 'utf-8');
        const blocks = this.extractBlocks(content);
        parentData = { content, blocks };
        this.cache.set(parentPath, parentData);
      }

      // Extract blocks from current template
      const currentBlocks = this.extractBlocks(ctx._template?.content || '');
      
      // Merge blocks (child overrides parent)
      const mergedBlocks = new Map([...parentData.blocks, ...currentBlocks]);
      
      // Replace blocks in parent template
      let result = parentData.content;
      for (const [blockName, blockContent] of mergedBlocks) {
        const blockRegex = new RegExp(
          `{%\\s*block\\s+${blockName}\\s*%}[\\s\\S]*?{%\\s*endblock\\s*%}`,
          'g'
        );
        result = result.replace(blockRegex, blockContent);
      }

      // Render the merged template
      return new nunjucks.runtime.SafeString(
        env.renderString(result, ctx, { path: parentPath })
      );
    } catch (error) {
      throw new Error(`Extends error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractBlocks(content: string): Map<string, string> {
    const blocks = new Map<string, string>();
    const blockRegex = /{%\s*block\s+(\w+)\s*%}([\s\S]*?){%\s*endblock\s*%}/g;
    
    let match;
    while ((match = blockRegex.exec(content)) !== null) {
      const [fullMatch, blockName, blockContent] = match;
      blocks.set(blockName, fullMatch);
    }
    
    return blocks;
  }

  private async resolveTemplatePath(templateName: string, context: any): Promise<string> {
    // Same resolution logic as IncludeExtension
    if (context._template?.path) {
      const currentDir = dirname(context._template.path);
      const relativePath = resolve(currentDir, templateName);
      
      try {
        await readFile(relativePath, 'utf-8');
        return relativePath;
      } catch {
        // Continue to other resolution strategies
      }
    }

    throw new Error(`Template not found: ${templateName}`);
  }

  clearCache() {
    this.cache.clear();
  }
}

/**
 * Macro extension with enhanced features
 */
export class MacroExtension implements nunjucks.Extension {
  tags = ['macro'];
  private macros = new Map<string, any>();

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    
    // Parse macro name
    const name = parser.parseSignature(null, true);
    
    // Parse parameters
    const params = [];
    if (parser.peekToken().type === lexer.TOKEN_SYMBOL) {
      params.push(parser.parseSignature(null, true));
    }
    
    parser.advanceAfterBlockEnd(tok.value);
    
    // Parse macro body
    const body = parser.parseUntilBlocks('endmacro');
    parser.advanceAfterBlockEnd();
    
    return new nodes.CallExtension(this, 'defineMacro', [name, params, body]);
  }

  defineMacro(context: any, name: string, params: any[], body: any) {
    this.macros.set(name, { params, body });
    return '';
  }

  callMacro(context: any, name: string, ...args: any[]) {
    const macro = this.macros.get(name);
    if (!macro) {
      throw new Error(`Macro not found: ${name}`);
    }

    // Create macro context
    const macroContext = { ...context };
    macro.params.forEach((param: string, index: number) => {
      macroContext[param] = args[index];
    });

    // Execute macro body
    return context.env.renderString(macro.body, macroContext);
  }

  getMacro(name: string) {
    return this.macros.get(name);
  }

  clearMacros() {
    this.macros.clear();
  }
}

/**
 * Set extension for variable assignment
 */
export class SetExtension implements nunjucks.Extension {
  tags = ['set'];

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    
    // Parse assignment target
    const target = parser.parseAssignTarget();
    
    // Expect '='
    parser.expect(lexer.TOKEN_ASSIGN);
    
    // Parse value expression
    const value = parser.parseExpression();
    
    parser.advanceAfterBlockEnd(tok.value);
    
    return new nodes.Assign(target, value);
  }
}

/**
 * Import extension for template imports
 */
export class ImportExtension implements nunjucks.Extension {
  tags = ['import', 'from'];
  private imports = new Map<string, any>();

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    
    if (tok.value === 'import') {
      // Parse: {% import "template.html" as macros %}
      const templateName = parser.parseExpression();
      parser.expect('as');
      const alias = parser.parseAssignTarget();
      parser.advanceAfterBlockEnd(tok.value);
      
      return new nodes.CallExtension(this, 'import', [templateName, alias]);
    } else {
      // Parse: {% from "template.html" import macro1, macro2 %}
      const templateName = parser.parseExpression();
      parser.expect('import');
      const imports = [];
      
      do {
        imports.push(parser.parseAssignTarget());
      } while (parser.skipSymbol(','));
      
      parser.advanceAfterBlockEnd(tok.value);
      
      return new nodes.CallExtension(this, 'fromImport', [templateName, imports]);
    }
  }

  async import(context: any, templateName: string, alias: string) {
    // Load and parse template for macros
    const templatePath = await this.resolveTemplatePath(templateName, context);
    const content = await readFile(templatePath, 'utf-8');
    
    // Extract macros (simplified)
    const macros = this.extractMacros(content);
    
    // Add to context
    context[alias] = macros;
    return '';
  }

  async fromImport(context: any, templateName: string, imports: string[]) {
    // Load template and import specific macros
    const templatePath = await this.resolveTemplatePath(templateName, context);
    const content = await readFile(templatePath, 'utf-8');
    
    const macros = this.extractMacros(content);
    
    imports.forEach(importName => {
      if (macros[importName]) {
        context[importName] = macros[importName];
      }
    });
    
    return '';
  }

  private async resolveTemplatePath(templateName: string, context: any): Promise<string> {
    // Reuse resolution logic from IncludeExtension
    if (context._template?.path) {
      const currentDir = dirname(context._template.path);
      const relativePath = resolve(currentDir, templateName);
      
      try {
        await readFile(relativePath, 'utf-8');
        return relativePath;
      } catch {
        throw new Error(`Template not found: ${templateName}`);
      }
    }
    
    throw new Error(`Template not found: ${templateName}`);
  }

  private extractMacros(content: string): Record<string, any> {
    // Simplified macro extraction
    const macros: Record<string, any> = {};
    const macroRegex = /{%\s*macro\s+(\w+)\s*\((.*?)\)\s*%}([\s\S]*?){%\s*endmacro\s*%}/g;
    
    let match;
    while ((match = macroRegex.exec(content)) !== null) {
      const [, name, params, body] = match;
      macros[name] = {
        name,
        params: params.split(',').map(p => p.trim()).filter(Boolean),
        body: body.trim()
      };
    }
    
    return macros;
  }
}

/**
 * Register all extensions with Nunjucks environment
 */
export function registerExtensions(env: nunjucks.Environment, includePaths: string[] = []): void {
  env.addExtension('IncludeExtension', new IncludeExtension(includePaths));
  env.addExtension('ExtendsExtension', new ExtendsExtension());
  env.addExtension('MacroExtension', new MacroExtension());
  env.addExtension('SetExtension', new SetExtension());
  env.addExtension('ImportExtension', new ImportExtension());
}

/**
 * Clear all extension caches
 */
export function clearExtensionCaches(env: nunjucks.Environment): void {
  const extensions = [
    'IncludeExtension',
    'ExtendsExtension',
    'MacroExtension',
    'ImportExtension'
  ];
  
  extensions.forEach(extName => {
    const ext = env.getExtension(extName) as any;
    if (ext && typeof ext.clearCache === 'function') {
      ext.clearCache();
    }
    if (ext && typeof ext.clearMacros === 'function') {
      ext.clearMacros();
    }
  });
}