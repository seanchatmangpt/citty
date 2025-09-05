/**
 * Template Validation and Linting System
 * Comprehensive validation for templates, configurations, and generated code
 */

import { defineCommand } from 'citty';
import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, basename, dirname } from 'pathe';
import { existsSync } from 'fs';
import { consola } from 'consola';
import { colors } from 'consola/utils';

// Note: vm2 and nunjucks should be installed as dependencies
// For now, we'll provide fallback implementations
const VM = globalThis.VM || class MockVM {
  constructor(options: any) {}
  run(code: string): any {
    throw new Error('VM2 not available - install vm2 package for sandboxing');
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

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'structure' | 'content' | 'security' | 'performance' | 'style';
  severity: 'error' | 'warning' | 'info';
  validate: (context: ValidationContext) => Promise<ValidationResult[]> | ValidationResult[];
}

export interface ValidationContext {
  filePath: string;
  content: string;
  fileType: string;
  projectRoot: string;
  metadata?: Record<string, any>;
  templateReferences?: TemplateReference[];
  variables?: TemplateVariable[];
  sandboxConfig?: SandboxConfig;
}

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

export interface ValidationSummary {
  totalFiles: number;
  errors: number;
  warnings: number;
  infos: number;
  results: Array<{
    filePath: string;
    results: ValidationResult[];
  }>;
}

/**
 * Template Structure Validation Rules
 */
export const structureRules: ValidationRule[] = [
  {
    id: 'package-json-required',
    name: 'Package.json Required',
    description: 'Every template must have a package.json file',
    category: 'structure',
    severity: 'error',
    async validate(context) {
      if (context.fileType === 'directory') {
        try {
          await readFile(join(context.filePath, 'package.json'));
          return [];
        } catch {
          return [{
            ruleId: this.id,
            severity: 'error',
            message: 'package.json file is missing',
            suggestion: 'Create a package.json file with project metadata'
          }];
        }
      }
      return [];
    }
  },
  
  {
    id: 'src-directory-exists',
    name: 'Source Directory Exists',
    description: 'Template should have a src directory for source code',
    category: 'structure',
    severity: 'warning',
    async validate(context) {
      if (context.fileType === 'directory') {
        try {
          const srcStat = await stat(join(context.filePath, 'src'));
          if (!srcStat.isDirectory()) {
            return [{
              ruleId: this.id,
              severity: 'warning',
              message: 'src should be a directory',
              suggestion: 'Create a src directory for source files'
            }];
          }
          return [];
        } catch {
          return [{
            ruleId: this.id,
            severity: 'warning',
            message: 'src directory is missing',
            suggestion: 'Create a src directory to organize source code'
          }];
        }
      }
      return [];
    }
  },
  
  {
    id: 'readme-exists',
    name: 'README File Exists',
    description: 'Template should include a README file',
    category: 'structure',
    severity: 'warning',
    async validate(context) {
      if (context.fileType === 'directory') {
        const readmeFiles = ['README.md', 'README.txt', 'readme.md'];
        for (const readme of readmeFiles) {
          try {
            await stat(join(context.filePath, readme));
            return [];
          } catch {
            continue;
          }
        }
        return [{
          ruleId: this.id,
          severity: 'warning',
          message: 'README file is missing',
          suggestion: 'Add a README.md file with project documentation'
        }];
      }
      return [];
    }
  }
];

/**
 * Content Validation Rules
 */
export const contentRules: ValidationRule[] = [
  {
    id: 'package-json-valid',
    name: 'Valid Package.json',
    description: 'package.json must be valid JSON with required fields',
    category: 'content',
    severity: 'error',
    validate(context) {
      if (basename(context.filePath) === 'package.json') {
        try {
          const pkg = JSON.parse(context.content);
          const results: ValidationResult[] = [];
          
          if (!pkg.name) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'package.json missing "name" field',
              suggestion: 'Add a "name" field with the package name'
            });
          }
          
          if (!pkg.version) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'package.json missing "version" field',
              suggestion: 'Add a "version" field (e.g., "0.1.0")'
            });
          }
          
          if (!pkg.description) {
            results.push({
              ruleId: this.id,
              severity: 'warning',
              message: 'package.json missing "description" field',
              suggestion: 'Add a "description" field with project description'
            });
          }
          
          if (!pkg.bin && !pkg.main) {
            results.push({
              ruleId: this.id,
              severity: 'warning',
              message: 'package.json should have "bin" or "main" field for CLI projects',
              suggestion: 'Add a "bin" field pointing to your CLI executable'
            });
          }
          
          return results;
        } catch (error) {
          return [{
            ruleId: this.id,
            severity: 'error',
            message: `Invalid JSON: ${error.message}`,
            suggestion: 'Fix JSON syntax errors'
          }];
        }
      }
      return [];
    }
  },
  
  {
    id: 'typescript-config-valid',
    name: 'Valid TypeScript Config',
    description: 'tsconfig.json must be valid and have recommended settings',
    category: 'content',
    severity: 'error',
    validate(context) {
      if (basename(context.filePath) === 'tsconfig.json') {
        try {
          const tsconfig = JSON.parse(context.content);
          const results: ValidationResult[] = [];
          
          if (!tsconfig.compilerOptions) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'tsconfig.json missing "compilerOptions"',
              suggestion: 'Add compilerOptions with TypeScript settings'
            });
            return results;
          }
          
          const options = tsconfig.compilerOptions;
          
          if (!options.strict) {
            results.push({
              ruleId: this.id,
              severity: 'warning',
              message: 'TypeScript strict mode is not enabled',
              suggestion: 'Enable strict mode for better type safety'
            });
          }
          
          if (options.target && !['ES2020', 'ES2021', 'ES2022', 'ESNext'].includes(options.target)) {
            results.push({
              ruleId: this.id,
              severity: 'info',
              message: 'Consider using a more recent TypeScript target',
              suggestion: 'Use ES2022 or ESNext for better modern JavaScript support'
            });
          }
          
          return results;
        } catch (error) {
          return [{
            ruleId: this.id,
            severity: 'error',
            message: `Invalid tsconfig.json: ${error.message}`,
            suggestion: 'Fix JSON syntax in tsconfig.json'
          }];
        }
      }
      return [];
    }
  },
  
  {
    id: 'citty-imports-correct',
    name: 'Correct Citty Imports',
    description: 'Citty imports should use the correct module specifiers',
    category: 'content',
    severity: 'error',
    validate(context) {
      if (extname(context.filePath) === '.ts' || extname(context.filePath) === '.js') {
        const results: ValidationResult[] = [];
        const lines = context.content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('from citty') || line.includes('require("citty")')) {
            // Check for correct imports
            if (line.includes('defineCommand') && !line.includes('{ defineCommand }')) {
              results.push({
                ruleId: this.id,
                severity: 'warning',
                message: 'Consider using named import for defineCommand',
                line: index + 1,
                suggestion: 'Use: import { defineCommand } from "citty"'
              });
            }
          }
          
          // Check for deprecated imports
          if (line.includes('from "citty/cli"')) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'Deprecated import path "citty/cli"',
              line: index + 1,
              suggestion: 'Use: import { defineCommand } from "citty"',
              autofix: {
                description: 'Update import path',
                fix: line.replace('from "citty/cli"', 'from "citty"')
              }
            });
          }
        });
        
        return results;
      }
      return [];
    }
  }
];

/**
 * Security Validation Rules
 */
export const securityRules: ValidationRule[] = [
  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Templates should not contain hardcoded secrets or API keys',
    category: 'security',
    severity: 'error',
    validate(context) {
      const secretPatterns = [
        /api[_-]?key\s*[=:]\s*['"][^'"\s]{10,}['"]/i,
        /secret[_-]?key\s*[=:]\s*['"][^'"\s]{10,}['"]/i,
        /password\s*[=:]\s*['"][^'"\s]{8,}['"]/i,
        /token\s*[=:]\s*['"][^'"\s]{20,}['"]/i,
        /access[_-]?token\s*[=:]\s*['"][^'"\s]{20,}['"]/i
      ];
      
      const results: ValidationResult[] = [];
      const lines = context.content.split('\n');
      
      lines.forEach((line, index) => {
        secretPatterns.forEach(pattern => {
          if (pattern.test(line)) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'Possible hardcoded secret detected',
              line: index + 1,
              suggestion: 'Use environment variables or configuration files for secrets'
            });
          }
        });
      });
      
      return results;
    }
  },
  
  {
    id: 'unsafe-eval-usage',
    name: 'No Unsafe eval() Usage',
    description: 'Avoid using eval() or similar unsafe functions',
    category: 'security',
    severity: 'error',
    validate(context) {
      if (extname(context.filePath) === '.ts' || extname(context.filePath) === '.js') {
        const results: ValidationResult[] = [];
        const lines = context.content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('eval(') && !line.includes('// allow-eval')) {
            results.push({
              ruleId: this.id,
              severity: 'error',
              message: 'Unsafe eval() usage detected',
              line: index + 1,
              suggestion: 'Avoid eval() or use a safer alternative'
            });
          }
          
          if (line.includes('Function(') && !line.includes('// allow-function-constructor')) {
            results.push({
              ruleId: this.id,
              severity: 'warning',
              message: 'Function constructor usage detected',
              line: index + 1,
              suggestion: 'Consider safer alternatives to Function constructor'
            });
          }
        });
        
        return results;
      }
      return [];
    }
  }
];

/**
 * Style and Quality Rules
 */
export const styleRules: ValidationRule[] = [
  {
    id: 'consistent-quotes',
    name: 'Consistent Quote Style',
    description: 'Use consistent quote style throughout the project',
    category: 'style',
    severity: 'info',
    validate(context) {
      if (extname(context.filePath) === '.ts' || extname(context.filePath) === '.js') {
        const singleQuotes = (context.content.match(/'/g) || []).length;
        const doubleQuotes = (context.content.match(/"/g) || []).length;
        
        if (singleQuotes > 0 && doubleQuotes > 0 && Math.abs(singleQuotes - doubleQuotes) > 5) {
          return [{
            ruleId: this.id,
            severity: 'info',
            message: 'Mixed quote styles detected',
            suggestion: 'Consider using a consistent quote style (single or double quotes)'
          }];
        }
      }
      return [];
    }
  },
  
  {
    id: 'proper-error-handling',
    name: 'Proper Error Handling',
    description: 'Async functions should have proper error handling',
    category: 'style',
    severity: 'warning',
    validate(context) {
      if (extname(context.filePath) === '.ts' || extname(context.filePath) === '.js') {
        const results: ValidationResult[] = [];
        const lines = context.content.split('\n');
        let inAsyncFunction = false;
        let hasTryCatch = false;
        
        lines.forEach((line, index) => {
          if (line.includes('async ') && line.includes('function')) {
            inAsyncFunction = true;
            hasTryCatch = false;
          }
          
          if (line.includes('try {')) {
            hasTryCatch = true;
          }
          
          if (line.includes('}') && inAsyncFunction && !hasTryCatch) {
            // Simple heuristic - could be improved
            if (context.content.includes('await ') && !context.content.includes('try {')) {
              results.push({
                ruleId: this.id,
                severity: 'warning',
                message: 'Async function may need error handling',
                line: index + 1,
                suggestion: 'Consider adding try-catch blocks for await calls'
              });
            }
            inAsyncFunction = false;
          }
        });
        
        return results;
      }
      return [];
    }
  }
];

/**
 * Template Validator
 */
export class TemplateValidator {
  private rules: ValidationRule[];
  private comprehensiveValidator: any; // Import from comprehensive-template-validator
  
  constructor(rules?: ValidationRule[]) {
    this.rules = rules || [
      ...structureRules,
      ...contentRules,
      ...securityRules,
      ...styleRules
    ];
    
    // Initialize comprehensive validator (lazy loaded to avoid circular imports)
    this.initComprehensiveValidator();
  }
  
  private async initComprehensiveValidator() {
    try {
      const { ComprehensiveTemplateValidator } = await import('./comprehensive-template-validator');
      this.comprehensiveValidator = new ComprehensiveTemplateValidator();
    } catch (error) {
      console.warn('Comprehensive template validator not available:', error.message);
    }
  }
  
  async validateFile(filePath: string, projectRoot?: string): Promise<ValidationResult[]> {
    try {
      const fileStats = await stat(filePath);
      const content = fileStats.isFile() ? await readFile(filePath, 'utf-8') : '';
      const root = projectRoot || process.cwd();
      
      const context: ValidationContext = {
        filePath,
        content,
        fileType: fileStats.isDirectory() ? 'directory' : 'file',
        projectRoot: root,
        templateReferences: this.isTemplateFile(filePath) ? this.extractTemplateReferences(content) : [],
        variables: this.isTemplateFile(filePath) ? this.extractTemplateVariables(content) : [],
        sandboxConfig: {
          allowedFunctions: ['range', 'len', 'str', 'int', 'float', 'bool'],
          allowedModules: [],
          maxExecutionTime: 5000,
          memoryLimit: 64 * 1024 * 1024,
          restrictFileAccess: true
        }
      };
      
      const results: ValidationResult[] = [];
      
      // For template files, use comprehensive validation
      if (this.isTemplateFile(filePath) && this.comprehensiveValidator) {
        try {
          const comprehensiveResults = await this.comprehensiveValidator.validateTemplate(content, filePath, root);
          results.push(...comprehensiveResults);
        } catch (error) {
          console.warn('Comprehensive validation failed, falling back to basic validation:', error.message);
          // Fall back to basic validation
          results.push(...await this.runBasicValidation(context));
        }
      } else {
        // For non-template files, use standard rules
        results.push(...await this.runBasicValidation(context));
      }
      
      return results;
    } catch (error) {
      return [{
        ruleId: 'file-access-error',
        severity: 'error',
        message: `Cannot access file: ${error.message}`,
        suggestion: 'Check file permissions and path'
      }];
    }
  }
  
  /**
   * Run basic validation using rules
   */
  private async runBasicValidation(context: ValidationContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules) {
      try {
        const ruleResults = await rule.validate(context);
        results.push(...ruleResults);
      } catch (error) {
        console.warn(`Rule ${rule.id} failed:`, error.message);
        results.push({
          ruleId: 'rule-execution-error',
          severity: 'warning',
          message: `Validation rule ${rule.id} failed: ${error.message}`,
          suggestion: 'Check rule implementation or file content'
        });
      }
    }
    
    return results;
  }
  
  /**
   * Check if file is a template file
   */
  private isTemplateFile(filePath: string): boolean {
    const templateExtensions = ['.j2', '.jinja', '.jinja2', '.njk', '.html', '.htm'];
    return templateExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * Extract template references from content
   */
  private extractTemplateReferences(content: string): any[] {
    const references: any[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const patterns = [
        { pattern: /\{%\s*include\s+['"]([^'"]+)['"]/, type: 'include' },
        { pattern: /\{%\s*extends\s+['"]([^'"]+)['"]/, type: 'extend' },
        { pattern: /\{%\s*import\s+['"]([^'"]+)['"]/, type: 'import' },
        { pattern: /\{%\s*from\s+['"]([^'"]+)['"]\s+import/, type: 'import' }
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
   * Extract template variables from content
   */
  private extractTemplateVariables(content: string): any[] {
    const variables: any[] = [];
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
      'globals', 'locals', 'dir', 'hasattr', 'getattr', 'setattr'
    ];
    return dangerousNames.includes(name.toLowerCase());
  }
  
  async validateDirectory(dirPath: string): Promise<ValidationSummary> {
    const summary: ValidationSummary = {
      totalFiles: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      results: []
    };
    
    await this.validateDirectoryRecursive(dirPath, dirPath, summary);
    
    return summary;
  }
  
  private async validateDirectoryRecursive(
    dirPath: string,
    projectRoot: string,
    summary: ValidationSummary
  ) {
    try {
      const entries = await readdir(dirPath);
      
      // Validate directory itself
      const dirResults = await this.validateFile(dirPath, projectRoot);
      if (dirResults.length > 0) {
        summary.results.push({ filePath: dirPath, results: dirResults });
        this.updateSummaryStats(summary, dirResults);
      }
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        
        // Skip node_modules and other common directories
        if (this.shouldSkipPath(entry)) {
          continue;
        }
        
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await this.validateDirectoryRecursive(fullPath, projectRoot, summary);
        } else {
          summary.totalFiles++;
          const results = await this.validateFile(fullPath, projectRoot);
          
          if (results.length > 0) {
            summary.results.push({ filePath: fullPath, results });
            this.updateSummaryStats(summary, results);
          }
        }
      }
    } catch (error) {
      console.warn(`Error validating directory ${dirPath}:`, error.message);
    }
  }
  
  private shouldSkipPath(path: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      '.next',
      '.nuxt'
    ];
    
    return skipPatterns.some(pattern => path.includes(pattern));
  }
  
  private updateSummaryStats(summary: ValidationSummary, results: ValidationResult[]) {
    for (const result of results) {
      switch (result.severity) {
        case 'error':
          summary.errors++;
          break;
        case 'warning':
          summary.warnings++;
          break;
        case 'info':
          summary.infos++;
          break;
      }
    }
  }
  
  addRule(rule: ValidationRule) {
    this.rules.push(rule);
  }
  
  removeRule(ruleId: string) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }
  
  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}

/**
 * Validation CLI Commands
 */
export const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate templates and project structure with comprehensive security analysis'
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to validate',
      default: '.'
    },
    rules: {
      type: 'string',
      description: 'Rule categories to include (comma-separated)',
      multiple: true
    },
    format: {
      type: 'string',
      description: 'Output format',
      default: 'pretty'
    },
    'fix': {
      type: 'boolean',
      description: 'Apply automatic fixes where possible'
    },
    'comprehensive': {
      type: 'boolean',
      description: 'Enable comprehensive template validation with security scanning',
      default: false
    },
    'security-only': {
      type: 'boolean',
      description: 'Run only security validation rules',
      default: false
    },
    'sandbox': {
      type: 'boolean',
      description: 'Enable template sandbox testing',
      default: false
    }
  },
  async run({ args }) {
    let validator: TemplateValidator;
    
    if (args.comprehensive || args['security-only'] || args.sandbox) {
      consola.info('Using comprehensive template validation with enhanced security scanning');
      validator = new TemplateValidator();
    } else {
      validator = new TemplateValidator();
    }
    
    consola.start(`Validating ${args.path}${args.comprehensive ? ' (comprehensive mode)' : ''}...`);
    
    try {
      const stats = await stat(args.path);
      
      let summary: ValidationSummary;
      
      if (stats.isDirectory()) {
        summary = await validator.validateDirectory(args.path);
        
        // Enhanced reporting for comprehensive mode
        if (args.comprehensive) {
          await this.generateComprehensiveReport(summary, args);
        }
      } else {
        const results = await validator.validateFile(args.path);
        summary = {
          totalFiles: 1,
          errors: results.filter(r => r.severity === 'error').length,
          warnings: results.filter(r => r.severity === 'warning').length,
          infos: results.filter(r => r.severity === 'info').length,
          results: [{ filePath: args.path, results }]
        };
      }
      
      // Filter results if security-only mode
      if (args['security-only']) {
        summary = filterSecurityResults(summary);
      }
      
      if (args.format === 'json') {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printValidationSummary(summary, args);
      }
      
      // Enhanced exit codes
      const criticalErrors = summary.results.some(r => 
        r.results.some(result => 
          result.severity === 'error' && (
            result.ruleId.includes('security') || 
            result.ruleId.includes('injection') ||
            result.ruleId.includes('xss')
          )
        )
      );
      
      if (criticalErrors) {
        consola.error('Critical security issues found!');
        process.exit(2);
      } else if (summary.errors > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      consola.error('Validation failed:', error.message);
      process.exit(1);
    }
  }
});

async function generateComprehensiveReport(summary: ValidationSummary, args: any) {
    const securityIssues = [];
    const performanceIssues = [];
    const syntaxIssues = [];
    
    summary.results.forEach(fileResult => {
      fileResult.results.forEach(result => {
        if (result.ruleId.includes('security') || result.ruleId.includes('injection') || result.ruleId.includes('xss')) {
          securityIssues.push({file: fileResult.filePath, ...result});
        } else if (result.ruleId.includes('performance') || result.ruleId.includes('complex')) {
          performanceIssues.push({file: fileResult.filePath, ...result});
        } else if (result.ruleId.includes('syntax') || result.ruleId.includes('template')) {
          syntaxIssues.push({file: fileResult.filePath, ...result});
        }
      });
    });
    
    console.log('\n' + colors.bold('🔍 Comprehensive Validation Report'));
    console.log('='.repeat(60));
    
    if (securityIssues.length > 0) {
      console.log('\n' + colors.red.bold('🚨 Security Issues:'));
      securityIssues.forEach(issue => {
        console.log(`  ${colors.red('●')} ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      });
    }
    
    if (performanceIssues.length > 0) {
      console.log('\n' + colors.yellow.bold('⚡ Performance Issues:'));
      performanceIssues.forEach(issue => {
        console.log(`  ${colors.yellow('●')} ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      });
    }
    
    if (syntaxIssues.length > 0) {
      console.log('\n' + colors.blue.bold('📝 Syntax Issues:'));
      syntaxIssues.forEach(issue => {
        console.log(`  ${colors.blue('●')} ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      });
    }
    
    // Security recommendations
    if (securityIssues.length > 0) {
      console.log('\n' + colors.bold('🛡️  Security Recommendations:'));
      console.log('  • Always escape user input with |e filter');
      console.log('  • Avoid |safe filter unless content is trusted');
      console.log('  • Use environment variables for secrets');
      console.log('  • Enable template sandboxing in production');
      console.log('  • Validate all template includes and extends');
    }
  }

function filterSecurityResults(summary: ValidationSummary): ValidationSummary {
    const filteredResults = summary.results.map(fileResult => ({
      ...fileResult,
      results: fileResult.results.filter(result => 
        result.ruleId.includes('security') ||
        result.ruleId.includes('injection') ||
        result.ruleId.includes('xss') ||
        result.ruleId.includes('hardcoded') ||
        result.ruleId.includes('sandbox')
      )
    })).filter(fileResult => fileResult.results.length > 0);
    
    const totalSecurityIssues = filteredResults.reduce((sum, fr) => sum + fr.results.length, 0);
    
    return {
      ...summary,
      results: filteredResults,
      errors: filteredResults.reduce((sum, fr) => sum + fr.results.filter(r => r.severity === 'error').length, 0),
      warnings: filteredResults.reduce((sum, fr) => sum + fr.results.filter(r => r.severity === 'warning').length, 0),
      infos: filteredResults.reduce((sum, fr) => sum + fr.results.filter(r => r.severity === 'info').length, 0)
    };
  }

/**
 * Print validation summary in pretty format
 */
function printValidationSummary(summary: ValidationSummary, args?: any) {
  console.log('\n' + colors.bold('Validation Results'));
  console.log('='.repeat(50));
  
  // Summary stats
  console.log(`Files checked: ${summary.totalFiles}`);
  console.log(`Errors: ${colors.red(String(summary.errors))}`);
  console.log(`Warnings: ${colors.yellow(String(summary.warnings))}`);
  console.log(`Info: ${colors.blue(String(summary.infos))}`);
  
  if (summary.results.length === 0) {
    console.log('\n' + colors.green('✓ No issues found!'));
    return;
  }
  
  // Detailed results
  for (const fileResult of summary.results) {
    if (fileResult.results.length === 0) continue;
    
    console.log('\n' + colors.underline(fileResult.filePath));
    
    for (const result of fileResult.results) {
      const icon = {
        error: colors.red('✗'),
        warning: colors.yellow('⚠'),
        info: colors.blue('ℹ')
      }[result.severity];
      
      const location = result.line ? `:${result.line}${result.column ? `:${result.column}` : ''}` : '';
      console.log(`  ${icon} ${result.message} ${colors.dim(`(${result.ruleId})${location}`)}`);
      
      if (result.suggestion) {
        console.log(`    ${colors.dim('→ ' + result.suggestion)}`);
      }
      
      if (result.autofix) {
        console.log(`    ${colors.green('🔧 ' + result.autofix.description)}`);
      }
    }
  }
}
