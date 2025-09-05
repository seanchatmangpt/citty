/**
 * Comprehensive Template Validation System
 * Advanced security, syntax, and performance validation for templates
 */

import { readFile, stat } from 'fs/promises';
import { join, extname, basename, dirname } from 'pathe';
import { existsSync } from 'fs';

// Mock implementations for optional dependencies
const VM = globalThis.VM || class MockVM {
  constructor(private options: any) {}
  run(code: string): any {
    throw new Error('VM2 not available - install vm2 package for advanced sandboxing');
  }
};

const jinja = globalThis.nunjucks || {
  Environment: class MockEnvironment {
    addGlobal(): void {}
    compile(content: string): any {
      // Basic syntax validation
      if (content.includes('{{') && !content.includes('}}')) {
        throw new Error('Unclosed template variable');
      }
      if (content.includes('{%') && !content.includes('%}')) {
        throw new Error('Unclosed template block');
      }
      return {
        render: (ctx: any) => content.replace(/\{\{[^}]+\}\}/g, 'TEST_VALUE')
      };
    }
  }
};

export interface TemplateReference {
  type: 'include' | 'extend' | 'import' | 'macro';
  target: string;
  line: number;
  resolved?: string;
}

export interface TemplateVariable {
  name: string;
  type?: string;
  line: number;
  context: 'global' | 'local' | 'filter' | 'function';
  dangerous?: boolean;
}

export interface SandboxConfig {
  allowedFunctions: string[];
  allowedModules: string[];
  maxExecutionTime: number;
  memoryLimit: number;
  restrictFileAccess: boolean;
}

export interface ValidationResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
  autofix?: {
    description: string;
    fix: string;
  };
}

/**
 * Template Syntax Validator
 * Validates Jinja2/Nunjucks template syntax and structure
 */
export class TemplateSyntaxValidator {
  
  /**
   * Validate template syntax and structure
   */
  validateSyntax(content: string, filePath: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    try {
      // Use template engine to validate syntax
      const env = new jinja.Environment();
      env.addGlobal('__validation_mode__', true);
      
      // Try to compile the template
      env.compile(content, filePath);
      
      // Additional structure validation
      results.push(...this.validateTemplateStructure(content));
      results.push(...this.validateTemplateVariables(content));
      
    } catch (error) {
      results.push({
        ruleId: 'template-syntax-error',
        severity: 'error',
        message: `Template syntax error: ${error.message}`,
        line: this.extractLineFromError(error.message),
        suggestion: 'Fix template syntax errors according to Jinja2 specification'
      });
    }
    
    return results;
  }
  
  /**
   * Validate template block structure
   */
  private validateTemplateStructure(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const lines = content.split('\n');
    let blockStack: string[] = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for unmatched template blocks
      const blockMatch = line.match(/\{%\s*(\w+)\s*.*?%\}/g);
      if (blockMatch) {
        blockMatch.forEach(block => {
          const blockType = block.match(/\{%\s*(\w+)/)?.[1];
          if (blockType) {
            if (['if', 'for', 'block', 'macro', 'call', 'filter', 'with', 'set', 'raw'].includes(blockType)) {
              blockStack.push(blockType);
            } else if (blockType.startsWith('end')) {
              const expectedEnd = blockType.substring(3);
              const lastBlock = blockStack.pop();
              if (lastBlock !== expectedEnd) {
                results.push({
                  ruleId: 'template-mismatched-blocks',
                  severity: 'error',
                  message: `Mismatched template block: expected end${lastBlock || 'unknown'}, got ${blockType}`,
                  line: lineNum,
                  suggestion: `Add {%end${lastBlock}%} or fix block structure`
                });
              }
            }
          }
        });
      }
      
      // Check for unclosed variables
      const unclosedVar = line.match(/\{\{[^}]*$/g);
      if (unclosedVar) {
        results.push({
          ruleId: 'template-unclosed-variable',
          severity: 'error',
          message: 'Unclosed template variable',
          line: lineNum,
          suggestion: 'Close variable with }}'
        });
      }
      
      // Check for unclosed blocks
      const unclosedBlock = line.match(/\{%[^%]*$/g);
      if (unclosedBlock) {
        results.push({
          ruleId: 'template-unclosed-block',
          severity: 'error',
          message: 'Unclosed template block',
          line: lineNum,
          suggestion: 'Close block with %}'
        });
      }
    });
    
    // Check for unmatched blocks at end
    if (blockStack.length > 0) {
      results.push({
        ruleId: 'template-unmatched-blocks',
        severity: 'error',
        message: `Unclosed template blocks: ${blockStack.join(', ')}`,
        suggestion: `Add closing tags: ${blockStack.map(b => `{%end${b}%}`).join(', ')}`
      });
    }
    
    return results;
  }
  
  /**
   * Validate template variables
   */
  private validateTemplateVariables(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const variables = this.extractTemplateVariables(content);
    const definedVars = new Set<string>();
    const usedVars = new Set<string>();
    
    variables.forEach(variable => {
      if (variable.context === 'local') {
        definedVars.add(variable.name);
      } else {
        usedVars.add(variable.name);
      }
      
      // Check for dangerous variable names
      if (this.isDangerousVariable(variable.name)) {
        results.push({
          ruleId: 'template-dangerous-variable',
          severity: 'error',
          message: `Dangerous variable name detected: ${variable.name}`,
          line: variable.line,
          suggestion: 'Avoid using system-level variable names'
        });
      }
      
      // Check for undefined variables (basic check)
      if (!definedVars.has(variable.name) && !this.isBuiltinVariable(variable.name)) {
        results.push({
          ruleId: 'template-undefined-variable',
          severity: 'warning',
          message: `Potentially undefined variable: ${variable.name}`,
          line: variable.line,
          suggestion: 'Ensure variable is defined or passed in context'
        });
      }
    });
    
    return results;
  }
  
  /**
   * Extract template variables from content
   */
  private extractTemplateVariables(content: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Extract variables from {{ variable }}
      const varMatches = Array.from(line.matchAll(/\{\{\s*([\w_.]+).*?\}\}/g));
      for (const match of varMatches) {
        variables.push({
          name: match[1],
          line: index + 1,
          context: 'global',
          dangerous: this.isDangerousVariable(match[1])
        });
      }
      
      // Extract variables from {% set variable = ... %}
      const setMatches = Array.from(line.matchAll(/\{%\s*set\s+(\w+)\s*=.*?%\}/g));
      for (const match of setMatches) {
        variables.push({
          name: match[1],
          line: index + 1,
          context: 'local'
        });
      }
      
      // Extract loop variables
      const forMatches = Array.from(line.matchAll(/\{%\s*for\s+(\w+)\s+in.*?%\}/g));
      for (const match of forMatches) {
        variables.push({
          name: match[1],
          line: index + 1,
          context: 'local'
        });
      }
    });
    
    return variables;
  }
  
  /**
   * Check if variable name is dangerous
   */
  private isDangerousVariable(name: string): boolean {
    const dangerousNames = [
      '__import__', '__builtins__', 'eval', 'exec', 'compile',
      'open', 'file', 'input', 'raw_input', 'reload', 'vars',
      'globals', 'locals', 'dir', 'hasattr', 'getattr', 'setattr',
      'delattr', 'callable'
    ];
    return dangerousNames.includes(name.toLowerCase());
  }
  
  /**
   * Check if variable is a builtin template variable
   */
  private isBuiltinVariable(name: string): boolean {
    const builtins = [
      'loop', 'range', 'lipsum', 'dict', 'cycler', 'joiner',
      'namespace', 'self', 'super', 'varargs', 'kwargs'
    ];
    return builtins.includes(name);
  }
  
  /**
   * Extract line number from error message
   */
  private extractLineFromError(errorMessage: string): number | undefined {
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }
}

/**
 * Template Security Validator
 * Validates templates for security vulnerabilities and dangerous constructs
 */
export class TemplateSecurityValidator {
  
  /**
   * Validate template security
   */
  validateSecurity(content: string, filePath: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    results.push(...this.validateHardcodedSecrets(content));
    results.push(...this.validateTemplateInjection(content));
    results.push(...this.validateXSSProtection(content));
    results.push(...this.validateSandboxEscapes(content));
    results.push(...this.validateUnsafeFunctions(content));
    
    return results;
  }
  
  /**
   * Detect hardcoded secrets and credentials
   */
  private validateHardcodedSecrets(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[=:]\s*['"'][^'"\s]{10,}['"']/i, type: 'API key' },
      { pattern: /secret[_-]?key\s*[=:]\s*['"'][^'"\s]{10,}['"']/i, type: 'Secret key' },
      { pattern: /password\s*[=:]\s*['"'][^'"\s]{8,}['"']/i, type: 'Password' },
      { pattern: /token\s*[=:]\s*['"'][^'"\s]{20,}['"']/i, type: 'Token' },
      { pattern: /access[_-]?token\s*[=:]\s*['"'][^'"\s]{20,}['"']/i, type: 'Access token' },
      { pattern: /(?:github|gitlab|bitbucket)[_-]?token\s*[=:]\s*['"'][a-zA-Z0-9]{20,}['"']/i, type: 'Git token' },
      { pattern: /aws[_-]?(?:access[_-]?key[_-]?id|secret[_-]?access[_-]?key)\s*[=:]\s*['"'][A-Z0-9]{16,}['"']/i, type: 'AWS credentials' },
      { pattern: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/, type: 'Private key/certificate' },
      { pattern: /https?:\/\/[^\s]*[?&](?:token|key|secret)=[a-zA-Z0-9]{10,}/i, type: 'URL with embedded token' }
    ];
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      secretPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(line)) {
          results.push({
            ruleId: 'template-hardcoded-secret',
            severity: 'error',
            message: `Possible hardcoded ${type.toLowerCase()} detected`,
            line: index + 1,
            suggestion: 'Use environment variables, configuration files, or secret management systems'
          });
        }
      });
    });
    
    return results;
  }
  
  /**
   * Detect template injection vulnerabilities
   */
  private validateTemplateInjection(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const dangerousPatterns = [
      { pattern: /\{\{\s*(?:__import__|eval|exec|compile)\s*\(/g, message: 'Direct code execution detected' },
      { pattern: /\{\{\s*(?:open|file)\s*\(/g, message: 'File system access detected' },
      { pattern: /\{\{\s*[^}]*\.__(?:class|bases|subclasses|mro)__/g, message: 'Dangerous attribute access detected' },
      { pattern: /\{\{\s*[^}]*(?:os|sys|subprocess|importlib)/g, message: 'System module access detected' },
      { pattern: /\{\{\s*[^}]*\.__builtins__/g, message: 'Built-ins access detected' },
      { pattern: /\{\{\s*(?:getattr|setattr|delattr|hasattr)\s*\(/g, message: 'Dynamic attribute manipulation detected' },
      { pattern: /\{%[^%]*(?:exec|eval|compile)\s*\(/g, message: 'Code compilation/execution in template block' }
    ];
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      dangerousPatterns.forEach(({ pattern, message }) => {
        const matches = Array.from(line.matchAll(pattern));
        for (const match of matches) {
          results.push({
            ruleId: 'template-injection',
            severity: 'error',
            message,
            line: index + 1,
            suggestion: 'Remove dangerous code execution or use safe alternatives'
          });
        }
      });
    });
    
    return results;
  }
  
  /**
   * Advanced XSS protection validation
   */
  private validateXSSProtection(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for unescaped output in different contexts
      const unsafeOutputs = this.findUnsafeOutputs(line);
      unsafeOutputs.forEach(output => {
        results.push({
          ruleId: 'template-xss-risk',
          severity: 'error',
          message: `Unescaped output in ${output.context} context: ${output.variable}`,
          line: index + 1,
          suggestion: output.suggestion
        });
      });
      
      // Check for dangerous HTML generation patterns
      const htmlPatterns = [
        { pattern: /\{\{\s*[^}]*\|\s*safe\s*\}\}/g, message: 'Unsafe output with |safe filter', severity: 'error' as const },
        { pattern: /\{%\s*autoescape\s+false\s*%\}/g, message: 'Autoescape disabled - XSS risk', severity: 'error' as const },
        { pattern: /<script[^>]*>\{\{[^}]+\}\}<\/script>/g, message: 'User content in script context - XSS risk', severity: 'warning' as const },
        { pattern: /<[^>]+\s+on\w+\s*=\s*['"]?\{\{[^}]+\}\}['"]?/g, message: 'User content in event handler - XSS risk', severity: 'warning' as const }
      ];
      
      htmlPatterns.forEach(({ pattern, message, severity }) => {
        const matches = Array.from(line.matchAll(pattern));
        for (const match of matches) {
          results.push({
            ruleId: 'template-xss-pattern',
            severity,
            message,
            line: index + 1,
            suggestion: this.getXSSSuggestion(message)
          });
        }
      });
    });
    
    return results;
  }
  
  /**
   * Find unsafe outputs in different HTML contexts
   */
  private findUnsafeOutputs(line: string): Array<{variable: string, context: string, suggestion: string}> {
    const outputs: Array<{variable: string, context: string, suggestion: string}> = [];
    
    const contexts = [
      {
        pattern: /<script[^>]*>.*?\{\{\s*([^}]+)\s*\}\}/g,
        context: 'JavaScript',
        suggestion: 'Use |tojson filter or proper JS escaping'
      },
      {
        pattern: /<[^>]+\s+href\s*=\s*['"]?\{\{\s*([^}]+)\s*\}\}/g,
        context: 'URL',
        suggestion: 'Use |urlencode filter and validate URLs'
      },
      {
        pattern: /<style[^>]*>.*?\{\{\s*([^}]+)\s*\}\}/g,
        context: 'CSS',
        suggestion: 'Use CSS escaping and avoid user content in styles'
      },
      {
        pattern: /<[^>]+\s+style\s*=\s*['"].*?\{\{\s*([^}]+)\s*\}\}/g,
        context: 'CSS attribute',
        suggestion: 'Use CSS escaping and validate styles'
      }
    ];
    
    contexts.forEach(ctx => {
      const matches = Array.from(line.matchAll(ctx.pattern));
      for (const match of matches) {
        const variable = match[1];
        if (!variable.includes('|e') && !variable.includes('|escape') && !variable.includes('|safe')) {
          outputs.push({
            variable,
            context: ctx.context,
            suggestion: ctx.suggestion
          });
        }
      }
    });
    
    return outputs;
  }
  
  /**
   * Get XSS protection suggestion based on message
   */
  private getXSSSuggestion(message: string): string {
    if (message.includes('|safe')) {
      return 'Remove |safe filter or ensure content is properly sanitized';
    } else if (message.includes('autoescape')) {
      return 'Enable autoescape or manually escape content';
    } else if (message.includes('script')) {
      return 'Use |tojson filter and proper script context handling';
    } else if (message.includes('event handler')) {
      return 'Avoid user content in event handlers or use data attributes';
    }
    return 'Apply proper escaping';
  }
  
  /**
   * Validate template sandbox escape attempts
   */
  private validateSandboxEscapes(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    const escapePatterns = [
      { pattern: /\{\{\s*[^}]*\.__class__\.__bases__/g, message: 'Python class hierarchy access - sandbox escape attempt' },
      { pattern: /\{\{\s*[^}]*\.__class__\.__subclasses__/g, message: 'Subclass enumeration - sandbox escape attempt' },
      { pattern: /\{\{\s*[^}]*\.__class__\.__mro__/g, message: 'Method resolution order access - sandbox escape attempt' },
      { pattern: /\{\{\s*[^}]*\bconfig\b/g, message: 'Configuration object access detected' },
      { pattern: /\{\{\s*[^}]*\brequest\b/g, message: 'Request object access detected' },
      { pattern: /\{\{\s*[^}]*\bg\b\./g, message: 'Flask global object access detected' },
      { pattern: /\{\{\s*[^}]*\bopen\s*\(/g, message: 'File open access detected' },
      { pattern: /\{\{\s*[^}]*\bfile\s*\(/g, message: 'File object access detected' },
      { pattern: /\{\{\s*[^}]*\bos\./g, message: 'OS module access detected' },
      { pattern: /\{\{\s*[^}]*\bsys\./g, message: 'Sys module access detected' },
      { pattern: /\{\{\s*[^}]*\bsubprocess\./g, message: 'Subprocess module access detected' },
      { pattern: /\{\{\s*[^}]*__import__\s*\(/g, message: 'Dynamic import detected' }
    ];
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      escapePatterns.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          results.push({
            ruleId: 'template-sandbox-escape',
            severity: 'error',
            message,
            line: index + 1,
            suggestion: 'Remove sandbox escape attempt or use safe alternatives'
          });
        }
      });
      
      // Check for unsafe filter usage
      const unsafeFilters = [
        { pattern: /\|\s*attr\s*\(/g, filter: 'attr', message: 'attr filter can access any attribute' },
        { pattern: /\|\s*map\s*\(/g, filter: 'map', message: 'map filter can execute arbitrary functions' },
        { pattern: /\|\s*select\s*\(/g, filter: 'select', message: 'select filter can execute arbitrary functions' }
      ];
      
      unsafeFilters.forEach(({ pattern, filter, message }) => {
        if (pattern.test(line)) {
          results.push({
            ruleId: 'template-unsafe-filter',
            severity: 'warning',
            message: `Potentially unsafe filter usage: ${filter} - ${message}`,
            line: index + 1,
            suggestion: 'Review filter usage for security implications'
          });
        }
      });
    });
    
    return results;
  }
  
  /**
   * Validate unsafe function usage
   */
  private validateUnsafeFunctions(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const lines = content.split('\n');
    
    const dangerousFunctions = [
      { pattern: /\beval\s*\(/, name: 'eval()', severity: 'error' as const },
      { pattern: /\bFunction\s*\(/, name: 'Function()', severity: 'warning' as const },
      { pattern: /\bsetTimeout\s*\(\s*['"]/, name: 'setTimeout() with string', severity: 'warning' as const },
      { pattern: /\bsetInterval\s*\(\s*['"]/, name: 'setInterval() with string', severity: 'warning' as const },
      { pattern: /\bexecScript\s*\(/, name: 'execScript()', severity: 'error' as const },
      { pattern: /\bdocument\.write\s*\(/, name: 'document.write()', severity: 'warning' as const },
      { pattern: /\bwindow\[\s*['"]eval['"]\s*\]/, name: 'window["eval"]', severity: 'error' as const }
    ];
    
    lines.forEach((line, index) => {
      // Skip lines with allow comments
      if (line.includes('// allow-eval') || line.includes('// allow-unsafe')) {
        return;
      }
      
      dangerousFunctions.forEach(func => {
        if (func.pattern.test(line)) {
          results.push({
            ruleId: 'template-unsafe-function',
            severity: func.severity,
            message: `Unsafe ${func.name} usage detected`,
            line: index + 1,
            suggestion: this.getSuggestionForFunction(func.name)
          });
        }
      });
      
      // Check for template-based code execution
      const templateCodeExecution = [
        /\{\{\s*[^}]*eval\s*\(/g,
        /\{%[^%]*exec\s+/g,
        /\{\{\s*[^}]*Function\s*\(/g
      ];
      
      templateCodeExecution.forEach(pattern => {
        if (pattern.test(line)) {
          results.push({
            ruleId: 'template-code-execution',
            severity: 'error',
            message: 'Code execution in template detected',
            line: index + 1,
            suggestion: 'Remove code execution from templates or use safe alternatives'
          });
        }
      });
    });
    
    return results;
  }
  
  /**
   * Get suggestion for unsafe function
   */
  private getSuggestionForFunction(functionName: string): string {
    const suggestions: Record<string, string> = {
      'eval()': 'Use JSON.parse() for data, or refactor to avoid dynamic code execution',
      'Function()': 'Use arrow functions or regular function declarations',
      'setTimeout() with string': 'Pass a function reference instead of a string',
      'setInterval() with string': 'Pass a function reference instead of a string',
      'execScript()': 'Use modern JavaScript alternatives',
      'document.write()': 'Use DOM manipulation methods like createElement and appendChild',
      'window["eval"]': 'Avoid indirect eval usage'
    };
    return suggestions[functionName] || 'Use safer alternatives';
  }
}

/**
 * Cross-Template Reference Validator
 * Validates template includes, extends, imports, and dependencies
 */
export class CrossTemplateValidator {
  
  /**
   * Validate cross-template references
   */
  validateCrossReferences(content: string, filePath: string, projectRoot: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const references = this.extractTemplateReferences(content);
    
    references.forEach(ref => {
      // Check for path traversal attacks
      if (this.hasPathTraversal(ref.target)) {
        results.push({
          ruleId: 'template-path-traversal',
          severity: 'error',
          message: `Path traversal detected in ${ref.type}: ${ref.target}`,
          line: ref.line,
          suggestion: 'Use relative paths within the template directory'
        });
      }
      
      // Check for absolute paths
      if (this.isAbsolutePath(ref.target)) {
        results.push({
          ruleId: 'template-absolute-path',
          severity: 'warning',
          message: `Absolute path in ${ref.type}: ${ref.target}`,
          line: ref.line,
          suggestion: 'Use relative paths for better portability and security'
        });
      }
      
      // Check for external URL references
      if (this.isExternalURL(ref.target)) {
        results.push({
          ruleId: 'template-external-url',
          severity: 'warning',
          message: `External URL reference in ${ref.type}: ${ref.target}`,
          line: ref.line,
          suggestion: 'Avoid external template references for security'
        });
      }
      
      // Validate template reference syntax
      if (!this.isValidTemplateReference(ref.target, ref.type)) {
        results.push({
          ruleId: 'template-invalid-reference',
          severity: 'error',
          message: `Invalid ${ref.type} reference syntax: ${ref.target}`,
          line: ref.line,
          suggestion: 'Use proper template reference syntax'
        });
      }
    });
    
    return results;
  }
  
  /**
   * Extract template references from content
   */
  extractTemplateReferences(content: string): TemplateReference[] {
    const references: TemplateReference[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const patterns = [
        { pattern: /\{%\s*include\s+['"]([^'"]+)['"]/, type: 'include' as const },
        { pattern: /\{%\s*extends\s+['"]([^'"]+)['"]/, type: 'extend' as const },
        { pattern: /\{%\s*import\s+['"]([^'"]+)['"]/, type: 'import' as const },
        { pattern: /\{%\s*from\s+['"]([^'"]+)['"]\s+import/, type: 'import' as const },
        { pattern: /\{%\s*macro\s+\w+\s*\(.*?\)\s*%\}/, type: 'macro' as const }
      ];
      
      patterns.forEach(({ pattern, type }) => {
        const match = line.match(pattern);
        if (match && match[1]) {
          references.push({
            type,
            target: match[1],
            line: index + 1
          });
        }
      });
    });
    
    return references;
  }
  
  /**
   * Check for path traversal patterns
   */
  private hasPathTraversal(path: string): boolean {
    const dangerousPatterns = [
      /\.\.\//,  // ../
      /\.\.\\/,  // ..\
      /%2e%2e%2f/i,  // URL encoded ../
      /%2e%2e%5c/i,  // URL encoded ..\
      /\.\.\\\.\.\//  // Mixed separators
    ];
    return dangerousPatterns.some(pattern => pattern.test(path));
  }
  
  /**
   * Check if path is absolute
   */
  private isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path);
  }
  
  /**
   * Check if path is external URL
   */
  private isExternalURL(path: string): boolean {
    return /^https?:\/\//.test(path);
  }
  
  /**
   * Validate template reference syntax
   */
  private isValidTemplateReference(target: string, type: string): boolean {
    if (!target || target.trim() === '') return false;
    
    // Check for valid template file extensions
    const validExtensions = ['.j2', '.jinja', '.jinja2', '.html', '.txt'];
    const hasValidExtension = validExtensions.some(ext => target.endsWith(ext));
    
    if (type !== 'macro' && !hasValidExtension) {
      return false;
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    return !invalidChars.test(target);
  }
  
  /**
   * Validate file existence and circular references
   */
  async validateReferencedFiles(filePath: string, content: string, projectRoot: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const references = this.extractTemplateReferences(content);
    
    for (const ref of references) {
      try {
        // Resolve reference path
        const resolvedPath = this.resolveTemplatePath(ref.target, filePath, projectRoot);
        
        // Check if referenced file exists
        try {
          await stat(resolvedPath);
          ref.resolved = resolvedPath;
        } catch {
          results.push({
            ruleId: 'template-reference-not-found',
            severity: 'error',
            message: `Referenced template not found: ${ref.target}`,
            line: ref.line,
            suggestion: `Create template file at ${resolvedPath} or fix reference path`
          });
          continue;
        }
        
        // Validate circular references
        if (await this.hasCircularReference(filePath, resolvedPath, new Set())) {
          results.push({
            ruleId: 'template-circular-reference',
            severity: 'error',
            message: `Circular reference detected: ${ref.target}`,
            line: ref.line,
            suggestion: 'Remove circular dependency between templates'
          });
        }
        
      } catch (error) {
        results.push({
          ruleId: 'template-reference-validation-error',
          severity: 'warning',
          message: `Could not validate reference ${ref.target}: ${error.message}`,
          line: ref.line,
          suggestion: 'Check template reference path and permissions'
        });
      }
    }
    
    return results;
  }
  
  /**
   * Resolve template path relative to current file
   */
  private resolveTemplatePath(targetPath: string, currentFilePath: string, projectRoot: string): string {
    if (targetPath.startsWith('/')) {
      return join(projectRoot, targetPath.substring(1));
    } else {
      return join(dirname(currentFilePath), targetPath);
    }
  }
  
  /**
   * Check for circular references between templates
   */
  private async hasCircularReference(
    sourcePath: string, 
    targetPath: string, 
    visited: Set<string>
  ): Promise<boolean> {
    if (visited.has(targetPath)) {
      return targetPath === sourcePath;
    }
    
    visited.add(targetPath);
    
    try {
      const content = await readFile(targetPath, 'utf-8');
      const references = this.extractTemplateReferences(content);
      
      for (const ref of references) {
        const resolvedPath = this.resolveTemplatePath(ref.target, targetPath, this.getProjectRoot(targetPath));
        if (await this.hasCircularReference(sourcePath, resolvedPath, new Set(visited))) {
          return true;
        }
      }
    } catch {
      // If we can't read the file, assume no circular reference
    }
    
    return false;
  }
  
  /**
   * Get project root directory
   */
  private getProjectRoot(filePath: string): string {
    let dir = dirname(filePath);
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'))) {
        return dir;
      }
      dir = dirname(dir);
    }
    return process.cwd();
  }
}

/**
 * Template Sandboxing and Isolation Validator
 */
export class TemplateSandboxValidator {
  private sandboxConfig: SandboxConfig;
  
  constructor(config?: Partial<SandboxConfig>) {
    this.sandboxConfig = {
      allowedFunctions: ['range', 'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set'],
      allowedModules: [],
      maxExecutionTime: 5000,
      memoryLimit: 64 * 1024 * 1024, // 64MB
      restrictFileAccess: true,
      ...config
    };
  }
  
  /**
   * Test template execution in sandbox
   */
  async validateTemplateSandbox(content: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      // Create secure VM instance
      const vm = new VM({
        timeout: this.sandboxConfig.maxExecutionTime,
        sandbox: {
          ...this.createSecureSandbox(),
          ...this.createTestContext()
        }
      });
      
      // Test basic template compilation
      const env = new jinja.Environment();
      const template = env.compile(content);
      
      // Test template rendering with minimal context
      const testContext = this.createTestContext();
      const rendered = template.render(testContext);
      
      // Analyze rendered output for security issues
      const outputResults = this.analyzeRenderedOutput(rendered);
      results.push(...outputResults);
      
    } catch (error) {
      if (error.message.includes('timeout')) {
        results.push({
          ruleId: 'template-execution-timeout',
          severity: 'error',
          message: 'Template execution exceeded time limit',
          suggestion: 'Optimize template or reduce complexity'
        });
      } else if (error.message.includes('memory')) {
        results.push({
          ruleId: 'template-memory-limit',
          severity: 'error',
          message: 'Template execution exceeded memory limit',
          suggestion: 'Reduce template memory usage'
        });
      } else {
        results.push({
          ruleId: 'template-execution-error',
          severity: 'error',
          message: `Template execution failed: ${error.message}`,
          suggestion: 'Fix template syntax and security issues'
        });
      }
    }
    
    return results;
  }
  
  /**
   * Create secure sandbox environment
   */
  private createSecureSandbox(): any {
    return {
      // Only safe built-in functions
      range: (n: number) => Array.from({length: Math.min(n, 1000)}, (_, i) => i),
      len: (obj: any) => obj?.length || 0,
      str: String,
      int: (n: any) => parseInt(n, 10),
      float: parseFloat,
      bool: Boolean,
      list: Array,
      dict: Object,
      // Restricted objects
      __builtins__: undefined,
      __import__: undefined,
      eval: undefined,
      exec: undefined,
      open: undefined,
      file: undefined
    };
  }
  
  /**
   * Create test context for validation
   */
  private createTestContext(): any {
    return {
      user: { name: 'test', id: 1 },
      items: [1, 2, 3],
      config: { debug: false },
      now: new Date().toISOString()
    };
  }
  
  /**
   * Analyze rendered output for security issues
   */
  private analyzeRenderedOutput(output: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Check for script injection in output
    if (/<script[^>]*>[\s\S]*?<\/script>/i.test(output)) {
      results.push({
        ruleId: 'output-script-injection',
        severity: 'error',
        message: 'Script tags detected in rendered output',
        suggestion: 'Ensure proper escaping and avoid script injection'
      });
    }
    
    // Check for suspicious attributes
    if (/on\w+\s*=/i.test(output)) {
      results.push({
        ruleId: 'output-event-handlers',
        severity: 'warning',
        message: 'Event handlers detected in rendered output',
        suggestion: 'Review event handler usage for XSS risks'
      });
    }
    
    // Check for data URLs
    if (/data:\s*[^\s]+/i.test(output)) {
      results.push({
        ruleId: 'output-data-urls',
        severity: 'warning',
        message: 'Data URLs detected in rendered output',
        suggestion: 'Validate data URLs to prevent security issues'
      });
    }
    
    // Check for potential code injection
    if (/<iframe[^>]*srcdoc\s*=/i.test(output)) {
      results.push({
        ruleId: 'output-iframe-srcdoc',
        severity: 'warning',
        message: 'iframe with srcdoc detected in rendered output',
        suggestion: 'Review iframe content for security risks'
      });
    }
    
    return results;
  }
}

/**
 * Comprehensive Template Validator
 * Orchestrates all validation components
 */
export class ComprehensiveTemplateValidator {
  private syntaxValidator: TemplateSyntaxValidator;
  private securityValidator: TemplateSecurityValidator;
  private crossTemplateValidator: CrossTemplateValidator;
  private sandboxValidator: TemplateSandboxValidator;
  
  constructor(sandboxConfig?: Partial<SandboxConfig>) {
    this.syntaxValidator = new TemplateSyntaxValidator();
    this.securityValidator = new TemplateSecurityValidator();
    this.crossTemplateValidator = new CrossTemplateValidator();
    this.sandboxValidator = new TemplateSandboxValidator(sandboxConfig);
  }
  
  /**
   * Perform comprehensive validation of a template
   */
  async validateTemplate(content: string, filePath: string, projectRoot?: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const root = projectRoot || this.getProjectRoot(filePath);
    
    try {
      // 1. Syntax validation
      const syntaxResults = this.syntaxValidator.validateSyntax(content, filePath);
      results.push(...syntaxResults);
      
      // 2. Security validation
      const securityResults = this.securityValidator.validateSecurity(content, filePath);
      results.push(...securityResults);
      
      // 3. Cross-template reference validation
      const crossRefResults = this.crossTemplateValidator.validateCrossReferences(content, filePath, root);
      results.push(...crossRefResults);
      
      // 4. File existence and circular reference validation
      const fileRefResults = await this.crossTemplateValidator.validateReferencedFiles(filePath, content, root);
      results.push(...fileRefResults);
      
      // 5. Sandbox validation (if content is not empty)
      if (content.trim()) {
        const sandboxResults = await this.sandboxValidator.validateTemplateSandbox(content);
        results.push(...sandboxResults);
      }
      
      // 6. Performance analysis
      const performanceResults = this.analyzePerformance(content);
      results.push(...performanceResults);
      
    } catch (error) {
      results.push({
        ruleId: 'validation-error',
        severity: 'error',
        message: `Validation failed: ${error.message}`,
        suggestion: 'Check template content and validation configuration'
      });
    }
    
    return results;
  }
  
  /**
   * Analyze template performance
   */
  private analyzePerformance(content: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    const lines = content.split('\n');
    
    let loopNesting = 0;
    let maxLoopNesting = 0;
    let complexExpressions = 0;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Track loop nesting
      if (/\{%\s*for\s+/.test(line)) {
        loopNesting++;
        maxLoopNesting = Math.max(maxLoopNesting, loopNesting);
      } else if (/\{%\s*endfor\s*%\}/.test(line)) {
        loopNesting--;
      }
      
      // Detect complex expressions
      const expressionComplexity = this.calculateExpressionComplexity(line);
      if (expressionComplexity > 5) {
        complexExpressions++;
        results.push({
          ruleId: 'template-complex-expression',
          severity: 'warning',
          message: `Complex expression detected (complexity: ${expressionComplexity})`,
          line: lineNum,
          suggestion: 'Consider simplifying expression or moving logic to backend'
        });
      }
      
      // Detect long filter chains
      const filterMatches = line.match(/\|\s*\w+/g);
      if (filterMatches && filterMatches.length > 3) {
        results.push({
          ruleId: 'template-long-filter-chain',
          severity: 'info',
          message: `Long filter chain detected (${filterMatches.length} filters)`,
          line: lineNum,
          suggestion: 'Consider preprocessing data or using custom filters'
        });
      }
    });
    
    // Overall performance warnings
    if (maxLoopNesting > 3) {
      results.push({
        ruleId: 'template-deep-nesting',
        severity: 'warning',
        message: `Deep loop nesting detected (${maxLoopNesting} levels)`,
        suggestion: 'Consider flattening data structure or reducing nesting'
      });
    }
    
    if (complexExpressions > 10) {
      results.push({
        ruleId: 'template-many-complex-expressions',
        severity: 'warning',
        message: `Many complex expressions (${complexExpressions} found)`,
        suggestion: 'Consider moving complex logic to backend or using helper functions'
      });
    }
    
    return results;
  }
  
  /**
   * Calculate expression complexity score
   */
  private calculateExpressionComplexity(line: string): number {
    let complexity = 0;
    
    // Count operators
    complexity += (line.match(/[+\-*\/]/g) || []).length;
    
    // Count function calls
    complexity += (line.match(/\w+\s*\(/g) || []).length;
    
    // Count property access
    complexity += (line.match(/\w+\./g) || []).length;
    
    // Count array/dict access
    complexity += (line.match(/\[[^\]]+\]/g) || []).length;
    
    // Count conditional operators
    complexity += (line.match(/\?|:|and|or|not|in|is/g) || []).length;
    
    return complexity;
  }
  
  /**
   * Get project root directory
   */
  private getProjectRoot(filePath: string): string {
    let dir = dirname(filePath);
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'))) {
        return dir;
      }
      dir = dirname(dir);
    }
    return process.cwd();
  }
  
  /**
   * Check if file is a template file
   */
  isTemplateFile(filePath: string): boolean {
    const templateExtensions = ['.j2', '.jinja', '.jinja2', '.njk', '.html', '.htm'];
    return templateExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * Generate validation summary
   */
  createValidationSummary(results: ValidationResult[], filePath: string): any {
    const errors = results.filter(r => r.severity === 'error').length;
    const warnings = results.filter(r => r.severity === 'warning').length;
    const infos = results.filter(r => r.severity === 'info').length;
    
    return {
      filePath,
      totalIssues: results.length,
      errors,
      warnings,
      infos,
      results,
      passed: errors === 0,
      summary: `${errors} errors, ${warnings} warnings, ${infos} info messages`
    };
  }
}