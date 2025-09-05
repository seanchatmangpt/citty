#!/usr/bin/env node

import { glob } from 'fast-glob'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname, basename, extname } from 'pathe'
import { consola } from 'consola'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import { diff } from 'jest-diff'

class NunjucksToUnJucksMigrator {
  constructor(options = {}) {
    this.options = {
      sourceDir: './templates',
      outputDir: './migrated',
      backupDir: './backup',
      patterns: ['**/*.njk', '**/*.nunjucks', '**/*.html'],
      dryRun: false,
      verbose: false,
      ...options
    }
    
    this.transformations = new Map([
      // Template syntax updates
      [/\{\%\s*set\s+(\w+)\s*\=\s*(.+?)\s*\%\}/g, '{% assign $1 = $2 %}'],
      [/\{\%\s*for\s+(.+?)\s+in\s+range\((.+?)\)\s*\%\}/g, '{% for $1 in range($2) %}'],
      
      // Filter modernization
      [/\|\s*list\s*\|/g, '| array |'],
      [/\|\s*string\s*\|/g, '| toString |'],
      [/\|\s*int\s*\|/g, '| parseInt |'],
      
      // Context variable patterns
      [/loop\.index0/g, 'loop.index0'],
      [/loop\.index/g, 'loop.index'], 
      [/loop\.first/g, 'loop.first'],
      [/loop\.last/g, 'loop.last'],
      
      // Macro syntax updates
      [/\{\%\s*macro\s+(\w+)\(([^)]*)\)\s*\%\}/g, '{% macro $1($2) %}'],
      [/\{\%\s*call\s+(\w+)\(([^)]*)\)\s*\%\}/g, '{% call $1($2) %}'],
      
      // Include patterns
      [/\{\%\s*include\s+['"']([^'"]+)['"']\s*\%\}/g, '{% include "$1" %}'],
      [/\{\%\s*extends\s+['"']([^'"]+)['"']\s*\%\}/g, '{% extends "$1" %}'],
      
      // Block syntax
      [/\{\%\s*block\s+(\w+)\s*\%\}/g, '{% block $1 %}'],
      [/\{\%\s*endblock\s+(\w+)?\s*\%\}/g, '{% endblock %}'],
      
      // Conditional syntax
      [/\{\%\s*if\s+(.+?)\s*\%\}/g, '{% if $1 %}'],
      [/\{\%\s*elif\s+(.+?)\s*\%\}/g, '{% elsif $1 %}'],
      [/\{\%\s*else\s*\%\}/g, '{% else %}'],
      [/\{\%\s*endif\s*\%\}/g, '{% endif %}'],
      
      // Variable output
      [/\{\{\s*(.+?)\s*\}\}/g, '{{ $1 }}'],
      
      // Comment syntax (already compatible, but normalize)
      [/\{\#\s*(.+?)\s*\#\}/g, '{# $1 #}']
    ])
    
    this.semanticEnhancements = new Map([
      // Add semantic context hints
      ['{% for post in posts %}', '{% for post in posts %}\n  {# @semantic: BlogPost #}'],
      ['{% for user in users %}', '{% for user in users %}\n  {# @semantic: User #}'],
      ['{% for item in items %}', '{% for item in items %}\n  {# @semantic: Item #}'],
      
      // Add ontology hints for common patterns
      ['<article', '<article itemscope itemtype="http://schema.org/Article"'],
      ['<time datetime', '<time itemprop="datePublished" datetime'],
      ['<h1>', '<h1 itemprop="headline">'],
      ['<meta name="description"', '<meta itemprop="description" name="description"']
    ])
  }

  async migrate() {
    const spinner = ora('Starting migration process').start()
    
    try {
      // Find template files
      spinner.text = 'Scanning for template files'
      const files = await this.findTemplateFiles()
      
      if (files.length === 0) {
        spinner.warn('No template files found')
        return
      }

      spinner.succeed(`Found ${files.length} template files`)
      
      // Confirm migration
      if (!this.options.dryRun) {
        const response = await prompts({
          type: 'confirm',
          name: 'proceed',
          message: `Migrate ${files.length} files from Nunjucks to UnJucks?`,
          initial: true
        })
        
        if (!response.proceed) {
          consola.info('Migration cancelled')
          return
        }
      }

      // Create output directories
      await mkdir(this.options.outputDir, { recursive: true })
      await mkdir(this.options.backupDir, { recursive: true })

      const results = {
        migrated: 0,
        errors: 0,
        warnings: 0,
        files: []
      }

      // Process each file
      for (const filePath of files) {
        try {
          const result = await this.migrateFile(filePath)
          results.files.push(result)
          results.migrated++
          results.warnings += result.warnings.length
          
          consola.success(`✓ ${result.relativePath}`)
          
          if (result.warnings.length > 0 && this.options.verbose) {
            result.warnings.forEach(warning => 
              consola.warn(`  ⚠ ${warning}`)
            )
          }
          
        } catch (error) {
          results.errors++
          consola.error(`✗ ${filePath}: ${error.message}`)
        }
      }

      // Generate migration report
      await this.generateReport(results)

      // Summary
      consola.box([
        chalk.green(`Migration Complete!`),
        ``,
        `${chalk.green('✓')} Migrated: ${results.migrated}`,
        `${chalk.yellow('⚠')} Warnings: ${results.warnings}`,
        `${chalk.red('✗')} Errors: ${results.errors}`,
        ``,
        `Output: ${chalk.cyan(this.options.outputDir)}`,
        `Report: ${chalk.cyan('./migration-report.json')}`
      ])

    } catch (error) {
      spinner.fail('Migration failed')
      consola.error(error)
      throw error
    }
  }

  async findTemplateFiles() {
    return await glob(this.options.patterns, {
      cwd: this.options.sourceDir,
      absolute: true
    })
  }

  async migrateFile(filePath) {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = filePath.replace(this.options.sourceDir + '/', '')
    
    // Apply transformations
    let migratedContent = content
    const warnings = []
    const transformations = []

    // Basic syntax transformations
    for (const [pattern, replacement] of this.transformations.entries()) {
      const before = migratedContent
      migratedContent = migratedContent.replace(pattern, replacement)
      
      if (before !== migratedContent) {
        transformations.push({
          type: 'syntax',
          pattern: pattern.toString(),
          replacement: replacement.toString()
        })
      }
    }

    // Semantic enhancements
    for (const [pattern, replacement] of this.semanticEnhancements.entries()) {
      if (migratedContent.includes(pattern)) {
        migratedContent = migratedContent.replace(pattern, replacement)
        transformations.push({
          type: 'semantic',
          pattern,
          replacement
        })
      }
    }

    // Check for potential issues
    const issues = this.analyzeTemplate(migratedContent)
    warnings.push(...issues)

    // Add UnJucks-specific enhancements
    migratedContent = this.addUnJucksEnhancements(migratedContent, relativePath)

    // Create backup
    if (!this.options.dryRun) {
      const backupPath = join(this.options.backupDir, relativePath)
      await mkdir(dirname(backupPath), { recursive: true })
      await writeFile(backupPath, content)
    }

    // Write migrated file
    const outputPath = join(this.options.outputDir, relativePath)
    
    if (!this.options.dryRun) {
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, migratedContent)
    }

    return {
      relativePath,
      originalPath: filePath,
      outputPath,
      originalSize: content.length,
      migratedSize: migratedContent.length,
      transformations,
      warnings,
      diff: this.options.verbose ? diff(content, migratedContent) : null
    }
  }

  analyzeTemplate(content) {
    const warnings = []
    
    // Check for deprecated patterns
    const deprecatedPatterns = [
      { pattern: /\|\s*safe\s*\|/, message: 'Use |raw filter instead of |safe' },
      { pattern: /caller\(\)/, message: 'Caller function usage - verify compatibility' },
      { pattern: /loop\.revindex/, message: 'loop.revindex may not be available, consider alternatives' },
      { pattern: /\{\%\s*raw\s*\%\}/, message: 'Raw blocks may need adjustment' }
    ]

    for (const { pattern, message } of deprecatedPatterns) {
      if (pattern.test(content)) {
        warnings.push(message)
      }
    }

    // Check for complex expressions that might need manual review
    const complexPatterns = [
      /\{\{\s*.+?\|.+?\|.+?\}\}/, // Multiple chained filters
      /\{\%\s*set\s+.+?\=\s*.+?\%\}.*?\{\%\s*if\s+/, // Set variable then immediate conditional
      /\{\%\s*include\s+.+?\%\}.*?\{\%\s*set\s+/ // Include followed by variable setting
    ]

    for (const pattern of complexPatterns) {
      if (pattern.test(content)) {
        warnings.push('Complex template logic detected - manual review recommended')
        break
      }
    }

    return warnings
  }

  addUnJucksEnhancements(content, filePath) {
    // Add file header with UnJucks metadata
    const header = `{# 
  UnJucks Template
  Migrated from: ${filePath}
  Migration date: ${new Date().toISOString()}
  
  @ontology: Auto-detected semantic context
  @version: 1.0.0
#}\n\n`

    // Add semantic context based on file name and content patterns
    let semanticContext = ''
    
    if (filePath.includes('blog') || filePath.includes('post')) {
      semanticContext = '{# @semantic: BlogPost #}\n'
    } else if (filePath.includes('user') || filePath.includes('profile')) {
      semanticContext = '{# @semantic: User #}\n'
    } else if (filePath.includes('product') || filePath.includes('item')) {
      semanticContext = '{# @semantic: Product #}\n'
    }

    // Add modern template features
    const modernFeatures = []
    
    // Add CSRF protection hint if forms detected
    if (content.includes('<form')) {
      modernFeatures.push('{# TODO: Add CSRF protection with {{ csrfToken() }} #}')
    }
    
    // Add accessibility hints
    if (content.includes('<img') && !content.includes('alt=')) {
      modernFeatures.push('{# TODO: Add alt attributes to images for accessibility #}')
    }
    
    // Add caching hints for expensive operations
    if (content.includes('{% for') && content.includes('{% include')) {
      modernFeatures.push('{# TODO: Consider template caching for performance #}')
    }

    const enhancedContent = header + semanticContext + 
      (modernFeatures.length > 0 ? modernFeatures.join('\n') + '\n\n' : '') + 
      content

    return enhancedContent
  }

  async generateReport(results) {
    const report = {
      migration: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        tool: 'nunjucks-to-unjucks-migrator'
      },
      summary: {
        totalFiles: results.files.length,
        migratedFiles: results.migrated,
        errors: results.errors,
        warnings: results.warnings
      },
      files: results.files,
      recommendations: this.generateRecommendations(results),
      nextSteps: [
        'Review migrated templates for semantic accuracy',
        'Update template loading configuration', 
        'Test migrated templates with sample data',
        'Update documentation and team processes',
        'Consider implementing ontology definitions',
        'Set up continuous integration for template validation'
      ]
    }

    if (!this.options.dryRun) {
      await writeFile('./migration-report.json', JSON.stringify(report, null, 2))
    }

    return report
  }

  generateRecommendations(results) {
    const recommendations = []

    // Performance recommendations
    if (results.files.some(f => f.transformations.length > 5)) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Consider template caching for heavily transformed templates',
        files: results.files.filter(f => f.transformations.length > 5).map(f => f.relativePath)
      })
    }

    // Semantic recommendations
    const semanticFiles = results.files.filter(f => 
      f.transformations.some(t => t.type === 'semantic')
    )
    
    if (semanticFiles.length > 0) {
      recommendations.push({
        type: 'semantic',
        priority: 'medium',
        message: 'Define ontology schema for semantic templates',
        files: semanticFiles.map(f => f.relativePath)
      })
    }

    // Testing recommendations
    recommendations.push({
      type: 'testing',
      priority: 'high',
      message: 'Create test suite for migrated templates',
      action: 'Run validation script with sample data'
    })

    return recommendations
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--source':
      case '-s':
        options.sourceDir = args[++i]
        break
      case '--output': 
      case '-o':
        options.outputDir = args[++i]
        break
      case '--dry-run':
      case '-d':
        options.dryRun = true
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--help':
      case '-h':
        console.log(`
Usage: node migrate.mjs [options]

Options:
  -s, --source <dir>     Source directory (default: ./templates)
  -o, --output <dir>     Output directory (default: ./migrated) 
  -d, --dry-run         Preview changes without writing files
  -v, --verbose         Show detailed output
  -h, --help            Show help

Examples:
  node migrate.mjs --source ./old-templates --output ./new-templates
  node migrate.mjs --dry-run --verbose
`)
        process.exit(0)
    }
  }

  const migrator = new NunjucksToUnJucksMigrator(options)
  await migrator.migrate()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { NunjucksToUnJucksMigrator }