import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { SemanticContext } from './types';
import { UNJUCKS } from './index';

export interface MigrationSource {
  name: string;
  displayName: string;
  patterns: {
    fileExtensions: string[];
    syntaxPatterns: RegExp[];
    configFiles: string[];
    dependencies: string[];
  };
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  documentation: string;
}

export interface MigrationRule {
  id: string;
  source: string;
  target: 'unjucks';
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  description: string;
  example: {
    before: string;
    after: string;
  };
  category: 'syntax' | 'variables' | 'loops' | 'conditionals' | 'filters' | 'includes' | 'macros';
  confidence: number; // 0-1 how confident we are in the transformation
  manualReviewRequired: boolean;
}

export interface MigrationPlan {
  sourceSystem: string;
  targetSystem: 'unjucks';
  files: Array<{
    path: string;
    size: number;
    complexity: number;
    estimatedTime: string;
    rules: string[];
    warnings: string[];
  }>;
  totalFiles: number;
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  postMigrationTasks: string[];
}

export interface MigrationResult {
  success: boolean;
  sourceFile: string;
  targetFile: string;
  appliedRules: string[];
  warnings: string[];
  errors: string[];
  manualReviewItems: Array<{
    line: number;
    issue: string;
    suggestion: string;
  }>;
  confidence: number;
  preservedFeatures: string[];
  lostFeatures: string[];
}

export class UnjucksMigrationSystem {
  private sources = new Map<string, MigrationSource>();
  private rules = new Map<string, MigrationRule[]>();
  private migrationHistory: Array<{
    timestamp: Date;
    source: string;
    target: string;
    filesProcessed: number;
    successRate: number;
  }> = [];

  constructor() {
    this.initializeSources();
    this.initializeRules();
  }

  private initializeSources(): void {
    // Handlebars migration
    this.sources.set('handlebars', {
      name: 'handlebars',
      displayName: 'Handlebars.js',
      patterns: {
        fileExtensions: ['.hbs', '.handlebars'],
        syntaxPatterns: [/\{\{.*?\}\}/g, /@\w+/g],
        configFiles: ['package.json'],
        dependencies: ['handlebars', 'express-handlebars', 'hbs']
      },
      description: 'Migrate from Handlebars.js template engine',
      complexity: 'simple',
      documentation: 'Handlebars syntax is very similar to UNJUCKS/Nunjucks'
    });

    // Mustache migration
    this.sources.set('mustache', {
      name: 'mustache',
      displayName: 'Mustache',
      patterns: {
        fileExtensions: ['.mustache', '.mu'],
        syntaxPatterns: [/\{\{.*?\}\}/g, /\{\{#.*?\}\}/g],
        configFiles: [],
        dependencies: ['mustache', 'mustache-express']
      },
      description: 'Migrate from Mustache logic-less templates',
      complexity: 'moderate',
      documentation: 'Mustache is more limited but straightforward to convert'
    });

    // EJS migration
    this.sources.set('ejs', {
      name: 'ejs',
      displayName: 'Embedded JavaScript (EJS)',
      patterns: {
        fileExtensions: ['.ejs'],
        syntaxPatterns: [/<%.*?%>/g, /<%=.*?%>/g, /<%-.*?%>/g],
        configFiles: [],
        dependencies: ['ejs']
      },
      description: 'Migrate from EJS embedded JavaScript templates',
      complexity: 'complex',
      documentation: 'EJS allows arbitrary JavaScript - requires careful conversion'
    });

    // Pug migration
    this.sources.set('pug', {
      name: 'pug',
      displayName: 'Pug (formerly Jade)',
      patterns: {
        fileExtensions: ['.pug', '.jade'],
        syntaxPatterns: [/^[\s]*\w+(\([^)]*\))?[\s]*$/gm, /^[\s]*-.*$/gm],
        configFiles: [],
        dependencies: ['pug']
      },
      description: 'Migrate from Pug indentation-based templates',
      complexity: 'complex',
      documentation: 'Pug syntax is significantly different - structural conversion needed'
    });

    // Twig migration
    this.sources.set('twig', {
      name: 'twig',
      displayName: 'Twig (PHP)',
      patterns: {
        fileExtensions: ['.twig'],
        syntaxPatterns: [/\{\{.*?\}\}/g, /\{%.*?%\}/g, /\{#.*?#\}/g],
        configFiles: [],
        dependencies: []
      },
      description: 'Migrate from Twig PHP template engine',
      complexity: 'simple',
      documentation: 'Twig syntax is very similar to Nunjucks/UNJUCKS'
    });

    // Liquid migration
    this.sources.set('liquid', {
      name: 'liquid',
      displayName: 'Liquid (Shopify/Jekyll)',
      patterns: {
        fileExtensions: ['.liquid'],
        syntaxPatterns: [/\{\{.*?\}\}/g, /\{%.*?%\}/g],
        configFiles: ['_config.yml'],
        dependencies: ['liquidjs', 'shopify-liquid']
      },
      description: 'Migrate from Liquid template engine',
      complexity: 'moderate',
      documentation: 'Liquid has similar syntax but different filter names'
    });
  }

  private initializeRules(): void {
    // Handlebars rules
    this.rules.set('handlebars', [
      {
        id: 'hbs-basic-vars',
        source: 'handlebars',
        target: 'unjucks',
        pattern: /\{\{([^{}#\/\s][^{}]*?)\}\}/g,
        replacement: '{{ $1 }}',
        description: 'Convert basic variable expressions',
        example: {
          before: '{{name}}',
          after: '{{ name }}'
        },
        category: 'variables',
        confidence: 0.95,
        manualReviewRequired: false
      },
      {
        id: 'hbs-each-loop',
        source: 'handlebars',
        target: 'unjucks',
        pattern: /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
        replacement: '{% for item in $1 %}$2{% endfor %}',
        description: 'Convert each loops to for loops',
        example: {
          before: '{{#each items}}<li>{{this}}</li>{{/each}}',
          after: '{% for item in items %}<li>{{ item }}</li>{% endfor %}'
        },
        category: 'loops',
        confidence: 0.8,
        manualReviewRequired: true
      },
      {
        id: 'hbs-if-condition',
        source: 'handlebars',
        target: 'unjucks',
        pattern: /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        replacement: '{% if $1 %}$2{% endif %}',
        description: 'Convert if conditions',
        example: {
          before: '{{#if user.isActive}}<span>Active</span>{{/if}}',
          after: '{% if user.isActive %}<span>Active</span>{% endif %}'
        },
        category: 'conditionals',
        confidence: 0.9,
        manualReviewRequired: false
      },
      {
        id: 'hbs-unless',
        source: 'handlebars',
        target: 'unjucks',
        pattern: /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        replacement: '{% if not $1 %}$2{% endif %}',
        description: 'Convert unless to if not',
        example: {
          before: '{{#unless user.isActive}}<span>Inactive</span>{{/unless}}',
          after: '{% if not user.isActive %}<span>Inactive</span>{% endif %}'
        },
        category: 'conditionals',
        confidence: 0.9,
        manualReviewRequired: false
      }
    ]);

    // EJS rules
    this.rules.set('ejs', [
      {
        id: 'ejs-output',
        source: 'ejs',
        target: 'unjucks',
        pattern: /<%=\s*([^%]+?)\s*%>/g,
        replacement: '{{ $1 }}',
        description: 'Convert EJS output tags',
        example: {
          before: '<%= user.name %>',
          after: '{{ user.name }}'
        },
        category: 'variables',
        confidence: 0.95,
        manualReviewRequired: false
      },
      {
        id: 'ejs-raw-output',
        source: 'ejs',
        target: 'unjucks',
        pattern: /<%-\s*([^%]+?)\s*%>/g,
        replacement: '{{ $1 | safe }}',
        description: 'Convert EJS raw output with safe filter',
        example: {
          before: '<%- htmlContent %>',
          after: '{{ htmlContent | safe }}'
        },
        category: 'variables',
        confidence: 0.8,
        manualReviewRequired: true
      },
      {
        id: 'ejs-for-loop',
        source: 'ejs',
        target: 'unjucks',
        pattern: /<%\s*for\s*\(\s*(?:var\s+)?(\w+)\s+(?:in|of)\s+([^)]+)\s*\)\s*\{\s*%>([\s\S]*?)<%\s*\}\s*%>/g,
        replacement: '{% for $1 in $2 %}$3{% endfor %}',
        description: 'Convert JavaScript for loops',
        example: {
          before: '<% for (var item of items) { %><li><%= item %></li><% } %>',
          after: '{% for item in items %}<li>{{ item }}</li>{% endfor %}'
        },
        category: 'loops',
        confidence: 0.7,
        manualReviewRequired: true
      }
    ]);

    // Liquid rules
    this.rules.set('liquid', [
      {
        id: 'liquid-basic-vars',
        source: 'liquid',
        target: 'unjucks',
        pattern: /\{\{\s*([^|}]+?)\s*\}\}/g,
        replacement: '{{ $1 }}',
        description: 'Convert Liquid variables (basic)',
        example: {
          before: '{{ product.title }}',
          after: '{{ product.title }}'
        },
        category: 'variables',
        confidence: 0.95,
        manualReviewRequired: false
      },
      {
        id: 'liquid-for-loop',
        source: 'liquid',
        target: 'unjucks',
        pattern: /\{%\s*for\s+(\w+)\s+in\s+([^%]+?)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
        replacement: '{% for $1 in $2 %}$3{% endfor %}',
        description: 'Convert Liquid for loops',
        example: {
          before: '{% for product in products %}{{ product.title }}{% endfor %}',
          after: '{% for product in products %}{{ product.title }}{% endfor %}'
        },
        category: 'loops',
        confidence: 0.9,
        manualReviewRequired: false
      },
      {
        id: 'liquid-size-filter',
        source: 'liquid',
        target: 'unjucks',
        pattern: /\|\s*size/g,
        replacement: '| length',
        description: 'Convert size filter to length',
        example: {
          before: '{{ products | size }}',
          after: '{{ products | length }}'
        },
        category: 'filters',
        confidence: 0.95,
        manualReviewRequired: false
      }
    ]);

    // Add more rule sets for other template engines...
  }

  async detectSourceSystem(projectPath: string): Promise<string[]> {
    const detectedSystems: string[] = [];
    
    try {
      // Check package.json for dependencies
      try {
        const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
        const allDeps = {
          ...packageJson.dependencies || {},
          ...packageJson.devDependencies || {}
        };

        for (const [systemName, source] of this.sources.entries()) {
          const hasDependendy = source.patterns.dependencies.some(dep => allDeps[dep]);
          if (hasDependendy) {
            detectedSystems.push(systemName);
          }
        }
      } catch (e) {
        // No package.json or invalid JSON
      }

      // Check for template files
      const findCommand = 'find . -type f \\( ' + 
        Array.from(this.sources.values())
          .flatMap(s => s.patterns.fileExtensions)
          .map(ext => `-name "*${ext}"`)
          .join(' -o ') + 
        ' \\) | head -20';

      try {
        const output = execSync(findCommand, { cwd: projectPath, encoding: 'utf-8' });
        const files = output.trim().split('\n').filter(Boolean);

        for (const file of files) {
          for (const [systemName, source] of this.sources.entries()) {
            const hasExtension = source.patterns.fileExtensions.some(ext => file.endsWith(ext));
            if (hasExtension && !detectedSystems.includes(systemName)) {
              detectedSystems.push(systemName);
            }
          }
        }
      } catch (e) {
        // find command failed
      }

      // Check file contents for syntax patterns
      if (detectedSystems.length === 0) {
        try {
          const commonFiles = execSync('find . -name "*.html" -o -name "*.htm" -o -name "*.xml" | head -10', { 
            cwd: projectPath, 
            encoding: 'utf-8' 
          }).trim().split('\n').filter(Boolean);

          for (const file of commonFiles) {
            try {
              const content = await readFile(join(projectPath, file), 'utf-8');
              
              for (const [systemName, source] of this.sources.entries()) {
                const hasPattern = source.patterns.syntaxPatterns.some(pattern => pattern.test(content));
                if (hasPattern && !detectedSystems.includes(systemName)) {
                  detectedSystems.push(systemName);
                }
              }
            } catch (e) {
              // File read error
            }
          }
        } catch (e) {
          // Find command failed
        }
      }

    } catch (error) {
      console.warn('Error detecting source system:', error);
    }

    return detectedSystems;
  }

  async createMigrationPlan(projectPath: string, sourceSystem: string): Promise<MigrationPlan> {
    const source = this.sources.get(sourceSystem);
    if (!source) {
      throw new Error(`Unknown source system: ${sourceSystem}`);
    }

    const files: MigrationPlan['files'] = [];
    let totalFiles = 0;
    let totalComplexity = 0;

    // Find all template files
    const extensions = source.patterns.fileExtensions.join('|').replace(/\./g, '\\.');
    const findCommand = `find . -type f -regex ".*\\.(${extensions.replace(/\|/g, '|')})"`;

    try {
      const output = execSync(findCommand, { cwd: projectPath, encoding: 'utf-8' });
      const foundFiles = output.trim().split('\n').filter(Boolean);
      totalFiles = foundFiles.length;

      for (const file of foundFiles.slice(0, 100)) { // Limit analysis
        try {
          const fullPath = join(projectPath, file);
          const stats = await import('fs').then(fs => fs.promises.stat(fullPath));
          const content = await readFile(fullPath, 'utf-8');
          
          const complexity = this.calculateFileComplexity(content, sourceSystem);
          const applicableRules = this.getApplicableRules(content, sourceSystem);
          const warnings = this.identifyWarnings(content, sourceSystem);
          
          totalComplexity += complexity;
          
          files.push({
            path: file,
            size: stats.size,
            complexity,
            estimatedTime: this.estimateConversionTime(complexity, stats.size),
            rules: applicableRules,
            warnings
          });
        } catch (error) {
          console.warn(`Error analyzing file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Error finding template files:', error);
    }

    const avgComplexity = totalFiles > 0 ? totalComplexity / files.length : 0;
    const riskLevel: MigrationPlan['riskLevel'] = 
      avgComplexity > 7 ? 'high' : 
      avgComplexity > 4 ? 'medium' : 'low';

    const estimatedHours = Math.ceil((totalFiles * avgComplexity * 0.5) + (totalFiles * 0.1));
    const estimatedDuration = estimatedHours > 24 ? 
      `${Math.ceil(estimatedHours / 8)} days` : 
      `${estimatedHours} hours`;

    return {
      sourceSystem,
      targetSystem: 'unjucks',
      files,
      totalFiles,
      estimatedDuration,
      riskLevel,
      prerequisites: this.getPrerequisites(sourceSystem),
      postMigrationTasks: this.getPostMigrationTasks(sourceSystem)
    };
  }

  private calculateFileComplexity(content: string, sourceSystem: string): number {
    let complexity = 1; // Base complexity
    
    // Count control structures
    const loops = (content.match(/\{[%{]#?(for|each|while)/g) || []).length;
    const conditionals = (content.match(/\{[%{]#?(if|unless|switch)/g) || []).length;
    const includes = (content.match(/\{[%{]#?(include|import|extend)/g) || []).length;
    const filters = (content.match(/\|\s*\w+/g) || []).length;
    
    complexity += loops * 2;
    complexity += conditionals * 1.5;
    complexity += includes * 1;
    complexity += Math.min(filters * 0.5, 3); // Cap filter complexity
    
    // EJS specific complexity
    if (sourceSystem === 'ejs') {
      const jsBlocks = (content.match(/<%.+?%>/gs) || []).length;
      complexity += jsBlocks * 2; // JavaScript blocks add significant complexity
    }
    
    // Pug specific complexity
    if (sourceSystem === 'pug') {
      const indentLevels = content.split('\n')
        .map(line => line.match(/^\s*/)?.[0]?.length || 0)
        .reduce((max, current) => Math.max(max, current), 0);
      complexity += indentLevels / 2; // Deep nesting adds complexity
    }
    
    return Math.min(complexity, 10); // Cap at 10
  }

  private getApplicableRules(content: string, sourceSystem: string): string[] {
    const rules = this.rules.get(sourceSystem) || [];
    return rules
      .filter(rule => rule.pattern.test(content))
      .map(rule => rule.id);
  }

  private identifyWarnings(content: string, sourceSystem: string): string[] {
    const warnings: string[] = [];
    
    // Common warnings
    if (content.includes('javascript:')) {
      warnings.push('Contains JavaScript URLs - security review needed');
    }
    
    if (content.match(/\{\{[^}]*[<>'"&][^}]*\}\}/)) {
      warnings.push('Variables may need HTML escaping');
    }
    
    // EJS specific warnings
    if (sourceSystem === 'ejs') {
      if (content.includes('eval(') || content.includes('Function(')) {
        warnings.push('Contains dynamic code execution - manual conversion required');
      }
      
      if (content.match(/<%[^=\-][\s\S]*?require\s*\(/)) {
        warnings.push('Contains require() calls - may need refactoring');
      }
    }
    
    // Handlebars specific warnings
    if (sourceSystem === 'handlebars') {
      if (content.includes('{{>')) {
        warnings.push('Contains partials - verify partial resolution');
      }
      
      if (content.match(/\{\{#with\s/)) {
        warnings.push('Contains with blocks - context switching may need adjustment');
      }
    }
    
    return warnings;
  }

  private estimateConversionTime(complexity: number, fileSize: number): string {
    const baseTime = Math.max(5, fileSize / 1000); // Minimum 5 minutes
    const complexityMultiplier = 1 + (complexity / 10);
    const totalMinutes = Math.ceil(baseTime * complexityMultiplier);
    
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  private getPrerequisites(sourceSystem: string): string[] {
    const base = [
      'Install UNJUCKS: npm install unjucks',
      'Backup original templates',
      'Set up version control',
      'Test environment ready'
    ];

    switch (sourceSystem) {
      case 'ejs':
        return [...base, 'Review JavaScript logic in templates', 'Plan helper function migration'];
      case 'pug':
        return [...base, 'Understand Pug to HTML conversion', 'Plan mixin migrations'];
      case 'handlebars':
        return [...base, 'Map Handlebars helpers to UNJUCKS filters', 'Review partial dependencies'];
      default:
        return base;
    }
  }

  private getPostMigrationTasks(sourceSystem: string): string[] {
    const base = [
      'Run template validation tests',
      'Update build configuration',
      'Update documentation',
      'Performance testing',
      'Clean up old template files'
    ];

    switch (sourceSystem) {
      case 'ejs':
        return [...base, 'Migrate helper functions', 'Security review of converted templates'];
      case 'handlebars':
        return [...base, 'Test partial includes', 'Verify helper function conversions'];
      case 'pug':
        return [...base, 'Verify HTML output matches', 'Test responsive behaviors'];
      default:
        return base;
    }
  }

  async migrateFile(filePath: string, sourceSystem: string, outputPath?: string): Promise<MigrationResult> {
    const source = this.sources.get(sourceSystem);
    if (!source) {
      throw new Error(`Unknown source system: ${sourceSystem}`);
    }

    const rules = this.rules.get(sourceSystem) || [];
    if (rules.length === 0) {
      throw new Error(`No migration rules defined for ${sourceSystem}`);
    }

    const result: MigrationResult = {
      success: false,
      sourceFile: filePath,
      targetFile: outputPath || filePath.replace(/\.[^.]+$/, '.unjucks'),
      appliedRules: [],
      warnings: [],
      errors: [],
      manualReviewItems: [],
      confidence: 0,
      preservedFeatures: [],
      lostFeatures: []
    };

    try {
      let content = await readFile(filePath, 'utf-8');
      const originalContent = content;
      let totalConfidence = 0;
      let appliedRulesCount = 0;

      // Apply migration rules
      for (const rule of rules) {
        if (rule.pattern.test(content)) {
          const beforeMatches = content.match(rule.pattern)?.length || 0;
          
          if (typeof rule.replacement === 'string') {
            content = content.replace(rule.pattern, rule.replacement);
          } else {
            content = content.replace(rule.pattern, rule.replacement as any);
          }
          
          const afterMatches = content.match(rule.pattern)?.length || 0;
          
          if (beforeMatches !== afterMatches) {
            result.appliedRules.push(rule.id);
            totalConfidence += rule.confidence;
            appliedRulesCount++;
            
            if (rule.manualReviewRequired) {
              result.manualReviewItems.push({
                line: 0, // Would need line number tracking
                issue: rule.description,
                suggestion: `Applied rule ${rule.id} - please verify output`
              });
            }
          }
        }
      }

      // Calculate overall confidence
      result.confidence = appliedRulesCount > 0 ? totalConfidence / appliedRulesCount : 1;

      // Identify preserved and lost features
      result.preservedFeatures = this.identifyPreservedFeatures(originalContent, content, sourceSystem);
      result.lostFeatures = this.identifyLostFeatures(originalContent, content, sourceSystem);

      // Add warnings for common issues
      result.warnings = this.identifyWarnings(content, 'unjucks');

      // Create output directory if needed
      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, content, 'utf-8');
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private identifyPreservedFeatures(original: string, converted: string, sourceSystem: string): string[] {
    const features: string[] = [];
    
    // Check if basic templating is preserved
    const originalVars = original.match(/\{\{[^}]+\}\}/g)?.length || 0;
    const convertedVars = converted.match(/\{\{[^}]+\}\}/g)?.length || 0;
    
    if (originalVars > 0 && convertedVars > 0) {
      features.push('Variable interpolation');
    }
    
    // Check loops
    if (original.match(/\{[%{]#?(for|each)/i) && converted.match(/\{%\s*for/i)) {
      features.push('Loops');
    }
    
    // Check conditionals
    if (original.match(/\{[%{]#?if/i) && converted.match(/\{%\s*if/i)) {
      features.push('Conditional logic');
    }
    
    return features;
  }

  private identifyLostFeatures(original: string, converted: string, sourceSystem: string): string[] {
    const lostFeatures: string[] = [];
    
    // Check for features that might be lost in conversion
    if (sourceSystem === 'ejs') {
      if (original.includes('<%') && !converted.includes('<%')) {
        const jsBlocks = original.match(/<%[^=\-][\s\S]*?%>/g) || [];
        if (jsBlocks.length > 0) {
          lostFeatures.push(`${jsBlocks.length} JavaScript logic blocks`);
        }
      }
    }
    
    if (sourceSystem === 'handlebars') {
      const helpers = original.match(/\{\{#?\w+\s/g) || [];
      const preservedHelpers = converted.match(/\{\{#?\w+\s/g) || [];
      
      if (helpers.length > preservedHelpers.length) {
        lostFeatures.push(`${helpers.length - preservedHelpers.length} helper functions`);
      }
    }
    
    return lostFeatures;
  }

  async batchMigrate(projectPath: string, sourceSystem: string, options: {
    outputDir?: string;
    dryRun?: boolean;
    parallel?: boolean;
  } = {}): Promise<{
    results: MigrationResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      needsReview: number;
      averageConfidence: number;
    };
  }> {
    const plan = await this.createMigrationPlan(projectPath, sourceSystem);
    const results: MigrationResult[] = [];
    
    const processingPromises = plan.files.map(async (file) => {
      const inputPath = join(projectPath, file.path);
      const outputPath = options.outputDir 
        ? join(options.outputDir, file.path.replace(/\.[^.]+$/, '.unjucks'))
        : undefined;
      
      if (options.dryRun) {
        // Simulate migration for dry run
        return {
          success: true,
          sourceFile: inputPath,
          targetFile: outputPath || inputPath,
          appliedRules: file.rules,
          warnings: file.warnings,
          errors: [],
          manualReviewItems: [],
          confidence: 0.8,
          preservedFeatures: ['Variables', 'Loops'],
          lostFeatures: []
        };
      }
      
      return this.migrateFile(inputPath, sourceSystem, outputPath);
    });

    if (options.parallel) {
      results.push(...await Promise.all(processingPromises));
    } else {
      for (const promise of processingPromises) {
        results.push(await promise);
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const needsReview = results.filter(r => r.manualReviewItems.length > 0).length;
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Record migration history
    this.migrationHistory.push({
      timestamp: new Date(),
      source: sourceSystem,
      target: 'unjucks',
      filesProcessed: results.length,
      successRate: successful / results.length
    });

    return {
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        needsReview,
        averageConfidence: Math.round(averageConfidence * 100) / 100
      }
    };
  }

  async generateMigrationReport(results: MigrationResult[]): Promise<string> {
    const report = [
      '# UNJUCKS Migration Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `- Total files: ${results.length}`,
      `- Successful: ${results.filter(r => r.success).length}`,
      `- Failed: ${results.filter(r => !r.success).length}`,
      `- Need review: ${results.filter(r => r.manualReviewItems.length > 0).length}`,
      `- Average confidence: ${(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1)}%`,
      '',
      '## Detailed Results',
      ''
    ];

    for (const result of results) {
      report.push(`### ${result.sourceFile}`);
      report.push(`**Status:** ${result.success ? '✅ Success' : '❌ Failed'}`);
      report.push(`**Confidence:** ${(result.confidence * 100).toFixed(1)}%`);
      report.push(`**Target:** ${result.targetFile}`);
      
      if (result.appliedRules.length > 0) {
        report.push(`**Applied Rules:** ${result.appliedRules.join(', ')}`);
      }
      
      if (result.preservedFeatures.length > 0) {
        report.push(`**Preserved Features:** ${result.preservedFeatures.join(', ')}`);
      }
      
      if (result.lostFeatures.length > 0) {
        report.push(`**⚠️ Lost Features:** ${result.lostFeatures.join(', ')}`);
      }
      
      if (result.warnings.length > 0) {
        report.push('**Warnings:**');
        result.warnings.forEach(warning => report.push(`- ${warning}`));
      }
      
      if (result.errors.length > 0) {
        report.push('**❌ Errors:**');
        result.errors.forEach(error => report.push(`- ${error}`));
      }
      
      if (result.manualReviewItems.length > 0) {
        report.push('**🔍 Manual Review Required:**');
        result.manualReviewItems.forEach(item => 
          report.push(`- Line ${item.line}: ${item.issue} (${item.suggestion})`)
        );
      }
      
      report.push('');
    }

    // Add recommendations
    report.push('## Recommendations');
    
    const highConfidenceFiles = results.filter(r => r.confidence > 0.9).length;
    const lowConfidenceFiles = results.filter(r => r.confidence < 0.6).length;
    
    if (highConfidenceFiles > results.length * 0.8) {
      report.push('✅ Most files were migrated with high confidence. Review and test the converted templates.');
    } else if (lowConfidenceFiles > results.length * 0.3) {
      report.push('⚠️ Many files have low confidence scores. Manual review is strongly recommended.');
    }
    
    const commonErrors = results.flatMap(r => r.errors);
    if (commonErrors.length > 0) {
      report.push('🔧 Common issues found:');
      [...new Set(commonErrors)].forEach(error => report.push(`- ${error}`));
    }

    return report.join('\n');
  }

  getSupportedSystems(): MigrationSource[] {
    return Array.from(this.sources.values());
  }

  getMigrationHistory(): typeof this.migrationHistory {
    return [...this.migrationHistory];
  }
}

// Export singleton instance
export const migrationSystem = new UnjucksMigrationSystem();

// CLI helpers
export const MigrationHelpers = {
  async detectAndMigrate(projectPath: string, options: {
    outputDir?: string;
    dryRun?: boolean;
    interactive?: boolean;
  } = {}): Promise<void> {
    console.log('🔍 Detecting template systems...');
    
    const detectedSystems = await migrationSystem.detectSourceSystem(projectPath);
    
    if (detectedSystems.length === 0) {
      console.log('ℹ️  No supported template systems detected');
      return;
    }
    
    console.log(`✅ Detected systems: ${detectedSystems.join(', ')}`);
    
    for (const system of detectedSystems) {
      console.log(`\n📋 Creating migration plan for ${system}...`);
      const plan = await migrationSystem.createMigrationPlan(projectPath, system);
      
      console.log(`📊 Migration Plan Summary:`);
      console.log(`  - Files to migrate: ${plan.totalFiles}`);
      console.log(`  - Estimated duration: ${plan.estimatedDuration}`);
      console.log(`  - Risk level: ${plan.riskLevel}`);
      
      if (options.interactive) {
        // Would implement interactive confirmation here
        console.log('🤖 Auto-proceeding (interactive mode would ask for confirmation)');
      }
      
      console.log(`🚀 Starting ${system} to UNJUCKS migration...`);
      const migration = await migrationSystem.batchMigrate(projectPath, system, {
        outputDir: options.outputDir,
        dryRun: options.dryRun,
        parallel: true
      });
      
      console.log(`✅ Migration completed:`);
      console.log(`  - Total: ${migration.summary.total}`);
      console.log(`  - Successful: ${migration.summary.successful}`);
      console.log(`  - Failed: ${migration.summary.failed}`);
      console.log(`  - Need review: ${migration.summary.needsReview}`);
      console.log(`  - Average confidence: ${(migration.summary.averageConfidence * 100).toFixed(1)}%`);
      
      // Generate report
      const report = await migrationSystem.generateMigrationReport(migration.results);
      const reportPath = join(options.outputDir || projectPath, `migration-report-${system}.md`);
      await writeFile(reportPath, report);
      console.log(`📄 Report saved to: ${reportPath}`);
    }
  }
};