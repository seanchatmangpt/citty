/**
 * 🔧 COMPREHENSIVE CLI TOOLS
 * Essential developer workflow commands for UNJUCKS ecosystem
 */

import { Command } from 'commander'
import { createUnjucks, generateFromOntology } from './index'
import { interactivePlayground } from './interactive-playground'
import { tutorialSystem } from './tutorial-system'
import { productionMonitor } from './production-monitoring'
import { documentationSystem } from './documentation-system'
import { performanceProfiler } from './performance-profiler'
import * as fs from 'fs/promises'
import * as path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { glob } from 'fast-glob'

export interface CLIConfig {
  templatesDir: string
  outputDir: string
  ontologyDir: string
  configFile: string
  verbose: boolean
  dryRun: boolean
  watch: boolean
}

export class UnjucksCLI {
  private program: Command
  private config: Partial<CLIConfig> = {}
  
  constructor() {
    this.program = new Command()
    this.setupCommands()
  }
  
  /**
   * Setup all CLI commands
   */
  private setupCommands(): void {
    this.program
      .name('unjucks')
      .description('UNJUCKS - Semantic Template Generation CLI')
      .version('1.0.0')
      .option('-v, --verbose', 'Enable verbose output')
      .option('-c, --config <file>', 'Configuration file path')
      .hook('preAction', async (thisCommand) => {
        await this.loadConfig(thisCommand.opts())
      })
    
    // Generation commands
    this.setupGenerationCommands()
    
    // Development commands
    this.setupDevelopmentCommands()
    
    // Tutorial commands
    this.setupTutorialCommands()
    
    // Project management commands
    this.setupProjectCommands()
    
    // Analytics and monitoring commands
    this.setupMonitoringCommands()
    
    // Community commands
    this.setupCommunityCommands()
  }
  
  /**
   * Setup generation commands
   */
  private setupGenerationCommands(): void {
    const generate = this.program
      .command('generate')
      .alias('gen')
      .description('Generate templates from ontologies')
    
    generate
      .command('from-ontology')
      .alias('ont')
      .description('Generate from ontology file')
      .argument('<ontology>', 'Path to ontology file')
      .option('-t, --template <template>', 'Specific template to use')
      .option('-o, --output <dir>', 'Output directory')
      .option('-w, --watch', 'Watch for changes and regenerate')
      .option('--dry-run', 'Show what would be generated without writing files')
      .action(async (ontology, options) => {
        await this.generateFromOntology(ontology, options)
      })
    
    generate
      .command('batch')
      .description('Generate from multiple ontology files')
      .option('-p, --pattern <pattern>', 'Glob pattern for ontology files', '**/*.{ttl,rdf,owl}')
      .option('-o, --output <dir>', 'Output directory')
      .option('-j, --parallel <count>', 'Number of parallel processes', '4')
      .action(async (options) => {
        await this.generateBatch(options)
      })
    
    generate
      .command('watch')
      .description('Watch ontology and template files for changes')
      .option('-p, --pattern <pattern>', 'Files to watch', '**/*.{ttl,rdf,owl,njk}')
      .option('-o, --output <dir>', 'Output directory')
      .action(async (options) => {
        await this.watchAndGenerate(options)
      })
  }
  
  /**
   * Setup development commands
   */
  private setupDevelopmentCommands(): void {
    const dev = this.program
      .command('dev')
      .description('Development tools')
    
    dev
      .command('playground')
      .alias('play')
      .description('Start interactive playground')
      .option('-p, --port <port>', 'Port number', '3000')
      .option('--open', 'Open browser automatically')
      .action(async (options) => {
        await this.startPlayground(options)
      })
    
    dev
      .command('validate')
      .description('Validate ontology and template files')
      .argument('[files...]', 'Files to validate')
      .option('-s, --strict', 'Strict validation mode')
      .action(async (files, options) => {
        await this.validateFiles(files, options)
      })
    
    dev
      .command('lint')
      .description('Lint template files')
      .option('-f, --fix', 'Auto-fix issues where possible')
      .action(async (options) => {
        await this.lintTemplates(options)
      })
    
    dev
      .command('debug')
      .description('Debug generation process')
      .argument('<ontology>', 'Ontology file to debug')
      .option('-t, --template <template>', 'Template to debug')
      .option('--trace', 'Enable detailed tracing')
      .action(async (ontology, options) => {
        await this.debugGeneration(ontology, options)
      })
  }
  
  /**
   * Setup tutorial commands
   */
  private setupTutorialCommands(): void {
    const tutorial = this.program
      .command('tutorial')
      .alias('learn')
      .description('Interactive tutorials and learning')
    
    tutorial
      .command('list')
      .description('List available tutorials')
      .option('-c, --category <category>', 'Filter by category')
      .option('-d, --difficulty <level>', 'Max difficulty level')
      .action(async (options) => {
        await this.listTutorials(options)
      })
    
    tutorial
      .command('start')
      .description('Start a tutorial')
      .argument('<tutorial-id>', 'Tutorial ID to start')
      .option('-u, --user <user-id>', 'User ID', 'default')
      .action(async (tutorialId, options) => {
        await this.startTutorial(tutorialId, options)
      })
    
    tutorial
      .command('progress')
      .description('Show learning progress')
      .option('-u, --user <user-id>', 'User ID', 'default')
      .action(async (options) => {
        await this.showProgress(options)
      })
  }
  
  /**
   * Setup project management commands
   */
  private setupProjectCommands(): void {
    const project = this.program
      .command('project')
      .alias('proj')
      .description('Project management')
    
    project
      .command('init')
      .description('Initialize new UNJUCKS project')
      .option('-n, --name <name>', 'Project name')
      .option('-t, --template <template>', 'Project template', 'basic')
      .action(async (options) => {
        await this.initProject(options)
      })
    
    project
      .command('install')
      .description('Install project dependencies and templates')
      .action(async () => {
        await this.installDependencies()
      })
    
    project
      .command('build')
      .description('Build project templates')
      .option('-p, --production', 'Production build')
      .option('-w, --watch', 'Watch mode')
      .action(async (options) => {
        await this.buildProject(options)
      })
    
    project
      .command('clean')
      .description('Clean generated files and caches')
      .option('--all', 'Clean everything including node_modules')
      .action(async (options) => {
        await this.cleanProject(options)
      })
  }
  
  /**
   * Setup monitoring commands
   */
  private setupMonitoringCommands(): void {
    const monitor = this.program
      .command('monitor')
      .description('Monitoring and analytics')
    
    monitor
      .command('status')
      .description('Show system status')
      .action(async () => {
        await this.showStatus()
      })
    
    monitor
      .command('metrics')
      .description('Show performance metrics')
      .option('-d, --duration <duration>', 'Time period', '24h')
      .option('-f, --format <format>', 'Output format', 'table')
      .action(async (options) => {
        await this.showMetrics(options)
      })
    
    monitor
      .command('benchmark')
      .description('Run performance benchmarks')
      .option('-i, --iterations <count>', 'Number of iterations', '100')
      .option('-o, --output <file>', 'Save results to file')
      .action(async (options) => {
        await this.runBenchmarks(options)
      })
  }
  
  /**
   * Setup community commands
   */
  private setupCommunityCommands(): void {
    const community = this.program
      .command('community')
      .alias('comm')
      .description('Community templates and sharing')
    
    community
      .command('search')
      .description('Search community templates')
      .argument('<query>', 'Search query')
      .option('-c, --category <category>', 'Filter by category')
      .action(async (query, options) => {
        await this.searchCommunityTemplates(query, options)
      })
    
    community
      .command('install')
      .description('Install community template')
      .argument('<template-id>', 'Template ID to install')
      .action(async (templateId) => {
        await this.installCommunityTemplate(templateId)
      })
    
    community
      .command('publish')
      .description('Publish template to community')
      .option('-n, --name <name>', 'Template name')
      .option('-d, --description <desc>', 'Template description')
      .action(async (options) => {
        await this.publishTemplate(options)
      })
  }
  
  /**
   * Run the CLI
   */
  async run(argv?: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv)
    } catch (error) {
      console.error(chalk.red('Error:'), error.message)
      process.exit(1)
    }
  }
  
  // Command implementations
  
  private async loadConfig(options: any): Promise<void> {
    const configFile = options.config || 'unjucks.config.js'
    
    try {
      if (await this.fileExists(configFile)) {
        const config = await import(path.resolve(configFile))
        this.config = { ...this.config, ...config.default || config }
      }
    } catch (error) {
      if (options.verbose) {
        console.warn(chalk.yellow('Warning: Could not load config file'))
      }
    }
    
    // Override with CLI options
    this.config = { ...this.config, ...options }
  }
  
  private async generateFromOntology(ontology: string, options: any): Promise<void> {
    const spinner = ora('Generating templates...').start()
    
    try {
      const result = await generateFromOntology(ontology, options.template, {
        outputDir: options.output || this.config.outputDir || './generated',
        dryRun: options.dryRun || this.config.dryRun,
        showDiff: this.config.verbose
      })
      
      if (result.success) {
        spinner.succeed(`Generated ${result.files.length} files in ${result.duration}ms`)
        
        if (this.config.verbose) {
          result.files.forEach(file => {
            console.log(chalk.green('✓'), file.path)
          })
        }
      } else {
        spinner.fail('Generation failed')
        result.errors?.forEach(error => {
          console.error(chalk.red('Error:'), error.message)
        })
      }
      
      if (options.watch) {
        await this.watchAndGenerate({ 
          pattern: ontology,
          output: options.output,
          template: options.template
        })
      }
      
    } catch (error) {
      spinner.fail('Generation failed')
      throw error
    }
  }
  
  private async generateBatch(options: any): Promise<void> {
    const pattern = options.pattern
    const files = await glob(pattern, { onlyFiles: true })
    
    if (files.length === 0) {
      console.log(chalk.yellow('No ontology files found matching pattern:'), pattern)
      return
    }
    
    console.log(chalk.blue(`Found ${files.length} ontology files`))
    
    const concurrency = parseInt(options.parallel) || 4
    const results = []
    
    // Process in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency)
      const batchPromises = batch.map(async file => {
        const spinner = ora(`Processing ${file}...`).start()
        try {
          const result = await generateFromOntology(file, undefined, {
            outputDir: options.output || './generated'
          })
          spinner.succeed(`${file} - ${result.files.length} files`)
          return result
        } catch (error) {
          spinner.fail(`${file} - Failed`)
          return { success: false, error, files: [] }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    // Summary
    const successful = results.filter(r => r.success).length
    const totalFiles = results.reduce((sum, r) => sum + r.files.length, 0)
    
    console.log(chalk.green(`\nCompleted: ${successful}/${files.length} ontologies`))
    console.log(chalk.green(`Generated: ${totalFiles} total files`))
  }
  
  private async watchAndGenerate(options: any): Promise<void> {
    console.log(chalk.blue('Watching for changes...'))
    console.log(chalk.dim('Press Ctrl+C to stop'))
    
    const chokidar = await import('chokidar')
    const watcher = chokidar.watch(options.pattern, {
      ignored: /node_modules/,
      persistent: true
    })
    
    watcher.on('change', async (filePath) => {
      console.log(chalk.yellow(`\nFile changed: ${filePath}`))
      
      try {
        if (filePath.endsWith('.ttl') || filePath.endsWith('.rdf') || filePath.endsWith('.owl')) {
          await this.generateFromOntology(filePath, {
            output: options.output,
            template: options.template
          })
        }
      } catch (error) {
        console.error(chalk.red('Generation failed:'), error.message)
      }
    })
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping watcher...'))
      watcher.close()
      process.exit(0)
    })
  }
  
  private async startPlayground(options: any): Promise<void> {
    const port = parseInt(options.port) || 3000
    
    console.log(chalk.blue('Starting UNJUCKS Playground...'))
    console.log(chalk.green(`Server will be available at: http://localhost:${port}`))
    
    // This would start an Express server with the playground UI
    // For now, we'll simulate it
    const sessionId = await interactivePlayground.createSession()
    
    console.log(chalk.green(`Playground session created: ${sessionId}`))
    console.log(chalk.dim('Use the web interface to interact with the playground'))
    
    if (options.open) {
      const open = await import('open')
      await open.default(`http://localhost:${port}`)
    }
  }
  
  private async validateFiles(files: string[], options: any): Promise<void> {
    if (files.length === 0) {
      files = await glob('**/*.{ttl,rdf,owl,njk}', { ignore: ['node_modules/**'] })
    }
    
    console.log(chalk.blue(`Validating ${files.length} files...`))
    
    let errorCount = 0
    let warningCount = 0
    
    for (const file of files) {
      const spinner = ora(`Validating ${file}...`).start()
      
      try {
        const content = await fs.readFile(file, 'utf-8')
        const result = await this.validateFileContent(file, content, options.strict)
        
        if (result.errors.length > 0) {
          spinner.fail(`${file} - ${result.errors.length} errors`)
          result.errors.forEach(error => {
            console.error(chalk.red('  Error:'), error)
            errorCount++
          })
        } else if (result.warnings.length > 0) {
          spinner.warn(`${file} - ${result.warnings.length} warnings`)
          result.warnings.forEach(warning => {
            console.warn(chalk.yellow('  Warning:'), warning)
            warningCount++
          })
        } else {
          spinner.succeed(file)
        }
        
      } catch (error) {
        spinner.fail(`${file} - Validation failed`)
        console.error(chalk.red('  Error:'), error.message)
        errorCount++
      }
    }
    
    // Summary
    console.log(chalk.blue(`\nValidation complete:`))
    console.log(`Files: ${files.length}`)
    if (errorCount > 0) {
      console.log(chalk.red(`Errors: ${errorCount}`))
    }
    if (warningCount > 0) {
      console.log(chalk.yellow(`Warnings: ${warningCount}`))
    }
    if (errorCount === 0 && warningCount === 0) {
      console.log(chalk.green('All files valid!'))
    }
  }
  
  private async listTutorials(options: any): Promise<void> {
    const tutorials = tutorialSystem.listTutorials({
      category: options.category,
      difficulty: options.difficulty ? parseInt(options.difficulty) : undefined
    })
    
    if (tutorials.length === 0) {
      console.log(chalk.yellow('No tutorials found matching criteria'))
      return
    }
    
    console.log(chalk.blue(`Found ${tutorials.length} tutorials:\n`))
    
    tutorials.forEach(tutorial => {
      const difficulty = '★'.repeat(tutorial.difficulty) + '☆'.repeat(5 - tutorial.difficulty)
      const duration = `${tutorial.estimatedDuration}min`
      
      console.log(chalk.green(`${tutorial.id}`))
      console.log(`  ${chalk.bold(tutorial.title)}`)
      console.log(`  ${tutorial.description}`)
      console.log(`  ${chalk.dim(`Category: ${tutorial.category} | Difficulty: ${difficulty} | Duration: ${duration}`)}`)
      
      if (tutorial.prerequisites.length > 0) {
        console.log(`  ${chalk.yellow(`Prerequisites: ${tutorial.prerequisites.join(', ')}`)}`)
      }
      
      console.log()
    })
  }
  
  private async showStatus(): Promise<void> {
    const spinner = ora('Collecting system status...').start()
    
    try {
      const report = productionMonitor.getMonitoringReport()
      const insights = performanceProfiler.getInsights()
      
      spinner.succeed('System status collected')
      
      console.log(chalk.bold('\n🚀 UNJUCKS System Status\n'))
      
      // Health status
      const health = report.summary.overallHealth
      const healthColor = health === 'healthy' ? 'green' : health === 'degraded' ? 'yellow' : 'red'
      console.log(chalk.bold('Health:'), chalk[healthColor](health.toUpperCase()))
      console.log(chalk.dim(`Health Percentage: ${report.summary.healthPercentage}%`))
      
      // Alerts
      if (report.summary.activeAlerts > 0) {
        console.log(chalk.bold('\n⚠️  Active Alerts:'), report.summary.activeAlerts)
        report.alerts.slice(0, 3).forEach(alert => {
          const color = alert.severity === 'critical' ? 'red' : 'yellow'
          console.log(chalk[color](`  ${alert.severity.toUpperCase()}: ${alert.message}`))
        })
      }
      
      // Performance insights
      if (insights.length > 0) {
        console.log(chalk.bold('\n📊 Performance Insights:'))
        insights.slice(0, 5).forEach(insight => {
          console.log(`  ${insight}`)
        })
      }
      
      // SLA metrics
      console.log(chalk.bold('\n📈 SLA Metrics:'))
      console.log(`  Availability: ${report.sla.availability.toFixed(2)}%`)
      console.log(`  Error Rate: ${report.sla.errorRate.toFixed(2)}%`)
      console.log(`  Response Time (P95): ${report.sla.responseTime.p95.toFixed(2)}ms`)
      
    } catch (error) {
      spinner.fail('Failed to collect status')
      throw error
    }
  }
  
  private async initProject(options: any): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || path.basename(process.cwd())
      },
      {
        type: 'list',
        name: 'template',
        message: 'Project template:',
        choices: [
          { name: 'Basic - Simple ontology-driven templates', value: 'basic' },
          { name: 'CLI - Command-line tool generator', value: 'cli' },
          { name: 'API - REST API generator', value: 'api' },
          { name: 'Full-stack - Complete application', value: 'fullstack' }
        ],
        default: options.template || 'basic'
      },
      {
        type: 'confirm',
        name: 'git',
        message: 'Initialize git repository?',
        default: true
      },
      {
        type: 'confirm',
        name: 'install',
        message: 'Install dependencies?',
        default: true
      }
    ])
    
    const projectDir = answers.name
    const spinner = ora(`Creating project: ${projectDir}`).start()
    
    try {
      // Create project structure
      await fs.mkdir(projectDir, { recursive: true })
      await fs.mkdir(path.join(projectDir, 'ontologies'), { recursive: true })
      await fs.mkdir(path.join(projectDir, 'templates'), { recursive: true })
      await fs.mkdir(path.join(projectDir, 'generated'), { recursive: true })
      
      // Create configuration file
      const config = {
        name: answers.name,
        version: '1.0.0',
        template: answers.template,
        directories: {
          ontologies: './ontologies',
          templates: './templates',
          generated: './generated'
        }
      }
      
      await fs.writeFile(
        path.join(projectDir, 'unjucks.config.js'),
        `module.exports = ${JSON.stringify(config, null, 2)}`
      )
      
      // Create sample files based on template
      await this.createTemplateFiles(projectDir, answers.template)
      
      // Initialize git
      if (answers.git) {
        await this.runCommand('git init', { cwd: projectDir })
        await fs.writeFile(path.join(projectDir, '.gitignore'), 'node_modules/\ngenerated/\n.DS_Store\n')
      }
      
      spinner.succeed(`Project created: ${projectDir}`)
      
      console.log(chalk.green(`\n✅ Project ${answers.name} created successfully!`))
      console.log(chalk.blue('\nNext steps:'))
      console.log(`  cd ${projectDir}`)
      if (answers.install) {
        console.log('  npm install')
      }
      console.log('  unjucks generate from-ontology ontologies/example.ttl')
      
    } catch (error) {
      spinner.fail('Project creation failed')
      throw error
    }
  }
  
  // Helper methods
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
  
  private async validateFileContent(
    filePath: string, 
    content: string, 
    strict: boolean
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Basic validation logic
    if (content.trim().length === 0) {
      errors.push('File is empty')
      return { errors, warnings }
    }
    
    if (filePath.endsWith('.ttl') || filePath.endsWith('.rdf')) {
      // RDF validation
      if (!content.includes('@prefix')) {
        warnings.push('No namespace prefixes defined')
      }
      
      if (!content.includes('.')) {
        errors.push('No RDF statements found (missing periods)')
      }
    }
    
    if (filePath.endsWith('.njk') || filePath.endsWith('.nunjucks')) {
      // Template validation
      const unclosedTags = content.match(/\{\%\s*\w+/g)?.filter(tag => 
        !content.includes(tag.replace('{%', '{%') + '%}')
      )
      
      if (unclosedTags && unclosedTags.length > 0) {
        errors.push(`Unclosed template tags: ${unclosedTags.join(', ')}`)
      }
    }
    
    return { errors, warnings }
  }
  
  private async runCommand(command: string, options: { cwd?: string } = {}): Promise<void> {
    const { spawn } = await import('child_process')
    
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')
      const child = spawn(cmd, args, {
        cwd: options.cwd,
        stdio: 'inherit'
      })
      
      child.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command failed with exit code ${code}`))
        }
      })
      
      child.on('error', reject)
    })
  }
  
  private async createTemplateFiles(projectDir: string, template: string): Promise<void> {
    // Create sample ontology
    const sampleOntology = `@prefix ex: <http://example.com/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, UNJUCKS!" ;
  ex:message "Welcome to semantic template generation!" .`
    
    await fs.writeFile(path.join(projectDir, 'ontologies', 'example.ttl'), sampleOntology)
    
    // Create sample template based on project type
    let sampleTemplate = ''
    
    switch (template) {
      case 'cli':
        sampleTemplate = `---
to: "commands/{{ greeting | kebabCase }}.ts"
---
export const {{ greeting | camelCase }}Command = defineCommand({
  meta: {
    name: "{{ greeting | kebabCase }}",
    description: "{{ message }}"
  },
  run: async () => {
    console.log("{{ greeting }}")
  }
})`
        break
      
      case 'api':
        sampleTemplate = `---
to: "api/{{ greeting | lowerCase }}.ts"
---
import { Router } from 'express'

const router = Router()

router.get('/{{ greeting | kebabCase }}', (req, res) => {
  res.json({
    message: "{{ message }}",
    greeting: "{{ greeting }}"
  })
})

export default router`
        break
      
      default:
        sampleTemplate = `---
to: "{{ greeting | kebabCase }}.txt"
---
{{ greeting }}
{{ message }}`
    }
    
    await fs.writeFile(path.join(projectDir, 'templates', 'example.njk'), sampleTemplate)
    
    // Create README
    const readme = `# ${path.basename(projectDir)}

Generated with UNJUCKS semantic template system.

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Generate templates:
   \`\`\`bash
   unjucks generate from-ontology ontologies/example.ttl
   \`\`\`

3. Check the generated files in the \`generated/\` directory.

## Project Structure

- \`ontologies/\` - RDF/OWL ontology files
- \`templates/\` - Nunjucks template files  
- \`generated/\` - Generated output files
- \`unjucks.config.js\` - Project configuration

## Learn More

- Run \`unjucks tutorial list\` to see available tutorials
- Visit the UNJUCKS documentation for more examples
`
    
    await fs.writeFile(path.join(projectDir, 'README.md'), readme)
  }
}

// Create and export CLI instance
export const unjucksCLI = new UnjucksCLI()

// Main CLI entry point
export async function runCLI(argv?: string[]): Promise<void> {
  await unjucksCLI.run(argv)
}

// Export for programmatic use
export { UnjucksCLI }