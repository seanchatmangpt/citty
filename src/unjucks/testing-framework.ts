/**
 * 🧪 COMPREHENSIVE TESTING FRAMEWORK
 * Advanced testing infrastructure for semantic template systems
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { generateFromOntology } from './index'
import { productionMonitor } from './production-monitoring'
import { performanceProfiler } from './performance-profiler'
import { diff } from 'jest-diff'
import { glob } from 'fast-glob'
import { hash } from 'ohash'
import chalk from 'chalk'

export interface TestCase {
  id: string
  name: string
  description: string
  category: 'unit' | 'integration' | 'performance' | 'semantic' | 'visual' | 'regression'
  ontology: string | OntologyFixture
  template: string | TemplateFixture
  expected: ExpectedResult
  config?: TestConfig
  tags: string[]
  timeout?: number
  skip?: boolean
  only?: boolean
  metadata?: Record<string, any>
}

export interface OntologyFixture {
  content: string
  format: 'turtle' | 'rdf-xml' | 'n3' | 'json-ld'
  baseUri?: string
  imports?: string[]
}

export interface TemplateFixture {
  content: string
  frontMatter?: Record<string, any>
  includes?: string[]
}

export interface ExpectedResult {
  success?: boolean
  files?: Array<{
    path: string
    content?: string
    contentMatches?: RegExp
    contentContains?: string[]
    exists?: boolean
    mode?: string
  }>
  errors?: Array<{
    message?: string
    messageMatches?: RegExp
    type?: string
  }>
  performance?: {
    maxDuration?: number
    maxMemory?: number
    minThroughput?: number
  }
  semantic?: {
    preservesTriples?: boolean
    validRdf?: boolean
    noMissingReferences?: boolean
  }
}

export interface TestConfig {
  outputDir?: string
  cleanup?: boolean
  verbose?: boolean
  parallel?: boolean
  retries?: number
  coverage?: boolean
}

export interface TestResult {
  testId: string
  name: string
  success: boolean
  duration: number
  memoryUsage: number
  errors: TestError[]
  warnings: string[]
  actual?: any
  expected?: any
  diff?: string
  performance?: {
    duration: number
    memoryUsage: number
    throughput?: number
  }
  coverage?: CoverageInfo
  metadata?: Record<string, any>
}

export interface TestError {
  type: 'assertion' | 'execution' | 'timeout' | 'setup' | 'teardown'
  message: string
  stack?: string
  details?: any
}

export interface TestSuite {
  id: string
  name: string
  description: string
  tests: TestCase[]
  setup?: () => Promise<void>
  teardown?: () => Promise<void>
  config?: TestConfig
}

export interface CoverageInfo {
  templatesUsed: string[]
  ontologyTriples: number
  semanticCoverage: number
  contextCoverage: number
}

export interface MockOntology {
  id: string
  triples: Array<{ subject: string; predicate: string; object: string }>
  prefixes: Record<string, string>
  baseUri: string
}

export class UnjucksTestFramework extends EventEmitter {
  private testSuites: Map<string, TestSuite> = new Map()
  private mockOntologies: Map<string, MockOntology> = new Map()
  private testResults: Map<string, TestResult> = new Map()
  private coverageData: Map<string, CoverageInfo> = new Map()
  
  constructor() {
    super()
    this.setupBuiltinMocks()
  }
  
  /**
   * Define a test case
   */
  test(testCase: TestCase): void {
    // Add to default suite if no suite is active
    let suite = this.testSuites.get('default')
    if (!suite) {
      suite = {
        id: 'default',
        name: 'Default Test Suite',
        description: 'Default test suite',
        tests: []
      }
      this.testSuites.set('default', suite)
    }
    
    suite.tests.push(testCase)
    this.emit('test:registered', { testCase })
  }
  
  /**
   * Define a test suite
   */
  describe(suite: TestSuite): void {
    this.testSuites.set(suite.id, suite)
    this.emit('suite:registered', { suite })
  }
  
  /**
   * Run all tests or specific tests
   */
  async runTests(options: {
    pattern?: string
    suites?: string[]
    tags?: string[]
    category?: TestCase['category']
    parallel?: boolean
    verbose?: boolean
    coverage?: boolean
    bail?: boolean
  } = {}): Promise<{
    success: boolean
    totalTests: number
    passed: number
    failed: number
    skipped: number
    duration: number
    results: TestResult[]
    coverage?: Record<string, CoverageInfo>
  }> {
    const startTime = Date.now()
    this.emit('run:start', options)
    
    // Collect tests to run
    const testsToRun = this.collectTests(options)
    
    if (testsToRun.length === 0) {
      console.log(chalk.yellow('No tests found matching criteria'))
      return {
        success: true,
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        results: []
      }
    }
    
    console.log(chalk.blue(`Running ${testsToRun.length} tests...\n`))
    
    // Run tests
    const results: TestResult[] = []
    let passed = 0
    let failed = 0
    let skipped = 0
    
    if (options.parallel && testsToRun.length > 1) {
      // Parallel execution
      const batchSize = 4
      for (let i = 0; i < testsToRun.length; i += batchSize) {
        const batch = testsToRun.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(test => this.runSingleTest(test, options))
        )
        results.push(...batchResults)
      }
    } else {
      // Sequential execution
      for (const test of testsToRun) {
        const result = await this.runSingleTest(test, options)
        results.push(result)
        
        if (options.bail && !result.success) {
          break
        }
      }
    }
    
    // Calculate totals
    results.forEach(result => {
      if (result.success) passed++
      else failed++
    })
    
    const duration = Date.now() - startTime
    const success = failed === 0
    
    // Generate coverage report
    let coverage: Record<string, CoverageInfo> | undefined
    if (options.coverage) {
      coverage = await this.generateCoverageReport(results)
    }
    
    // Print summary
    this.printTestSummary({
      success,
      totalTests: results.length,
      passed,
      failed,
      skipped,
      duration,
      results,
      coverage
    })
    
    this.emit('run:complete', { success, results, duration })
    
    return {
      success,
      totalTests: results.length,
      passed,
      failed,
      skipped,
      duration,
      results,
      coverage
    }
  }
  
  /**
   * Create a mock ontology for testing
   */
  createMockOntology(mock: MockOntology): void {
    this.mockOntologies.set(mock.id, mock)
    this.emit('mock:created', { mockId: mock.id })
  }
  
  /**
   * Expect utility for assertions
   */
  expect(actual: any): ExpectMatchers {
    return new ExpectMatchers(actual)
  }
  
  /**
   * Generate test report
   */
  async generateReport(format: 'json' | 'html' | 'junit' | 'markdown' = 'html'): Promise<string> {
    const results = Array.from(this.testResults.values())
    
    switch (format) {
      case 'json':
        return JSON.stringify({
          summary: this.calculateSummary(results),
          results,
          coverage: Object.fromEntries(this.coverageData)
        }, null, 2)
      
      case 'html':
        return this.generateHtmlReport(results)
      
      case 'junit':
        return this.generateJunitReport(results)
      
      case 'markdown':
        return this.generateMarkdownReport(results)
      
      default:
        throw new Error(`Unsupported report format: ${format}`)
    }
  }
  
  /**
   * Watch mode for continuous testing
   */
  async watch(options: {
    pattern?: string
    onChange?: (results: TestResult[]) => void
  } = {}): Promise<void> {
    console.log(chalk.blue('Starting test watch mode...'))
    console.log(chalk.dim('Press Ctrl+C to stop'))
    
    const chokidar = await import('chokidar')
    const watcher = chokidar.watch(['**/*.{ttl,rdf,owl,njk,test.js,test.ts}'], {
      ignored: /node_modules/,
      persistent: true
    })
    
    watcher.on('change', async (filePath) => {
      console.log(chalk.yellow(`\nFile changed: ${filePath}`))
      console.log(chalk.dim('Running tests...\n'))
      
      try {
        const result = await this.runTests({ verbose: false })
        options.onChange?.(result.results)
      } catch (error) {
        console.error(chalk.red('Test run failed:'), error.message)
      }
    })
    
    // Initial run
    await this.runTests({ verbose: false })
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping test watcher...'))
      watcher.close()
      process.exit(0)
    })
  }
  
  // Private helper methods
  
  private collectTests(options: any): TestCase[] {
    const allTests: TestCase[] = []
    
    for (const suite of this.testSuites.values()) {
      if (options.suites && !options.suites.includes(suite.id)) {
        continue
      }
      
      for (const test of suite.tests) {
        // Skip if marked to skip
        if (test.skip) continue
        
        // Pattern matching
        if (options.pattern && !test.name.match(new RegExp(options.pattern))) {
          continue
        }
        
        // Category filtering
        if (options.category && test.category !== options.category) {
          continue
        }
        
        // Tag filtering
        if (options.tags && !options.tags.some(tag => test.tags.includes(tag))) {
          continue
        }
        
        allTests.push(test)
      }
    }
    
    return allTests
  }
  
  private async runSingleTest(testCase: TestCase, options: any): Promise<TestResult> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    const result: TestResult = {
      testId: testCase.id,
      name: testCase.name,
      success: false,
      duration: 0,
      memoryUsage: 0,
      errors: [],
      warnings: []
    }
    
    try {
      this.emit('test:start', { testCase })
      
      // Setup test environment
      const testEnv = await this.setupTestEnvironment(testCase)
      
      // Execute the test
      const executionResult = await this.executeTest(testCase, testEnv)
      
      // Validate results
      const validation = await this.validateTestResult(testCase, executionResult)
      
      result.success = validation.success
      result.errors = validation.errors
      result.warnings = validation.warnings
      result.actual = executionResult
      result.expected = testCase.expected
      
      if (!validation.success) {
        result.diff = this.generateDiff(testCase.expected, executionResult)
      }
      
      // Performance tracking
      if (testCase.category === 'performance' || testCase.expected.performance) {
        result.performance = {
          duration: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed - startMemory,
          throughput: executionResult.files?.length / ((Date.now() - startTime) / 1000)
        }
      }
      
      // Coverage tracking
      if (options.coverage) {
        result.coverage = await this.calculateTestCoverage(testCase, executionResult)
      }
      
      // Cleanup
      if (testCase.config?.cleanup !== false) {
        await this.cleanupTestEnvironment(testEnv)
      }
      
      this.emit('test:complete', { testCase, result })
      
    } catch (error) {
      result.errors.push({
        type: 'execution',
        message: error.message,
        stack: error.stack
      })
      
      this.emit('test:error', { testCase, error })
    }
    
    result.duration = Date.now() - startTime
    result.memoryUsage = process.memoryUsage().heapUsed - startMemory
    
    // Store result
    this.testResults.set(testCase.id, result)
    
    // Print result
    if (options.verbose) {
      this.printTestResult(result)
    } else {
      process.stdout.write(result.success ? chalk.green('.') : chalk.red('F'))
    }
    
    return result
  }
  
  private async setupTestEnvironment(testCase: TestCase): Promise<{
    ontologyPath?: string
    templatePath?: string
    outputDir: string
    cleanup: () => Promise<void>
  }> {
    const testId = hash(testCase.id + Date.now())
    const outputDir = path.join('/tmp', `unjucks-test-${testId}`)
    
    await fs.mkdir(outputDir, { recursive: true })
    
    let ontologyPath: string | undefined
    let templatePath: string | undefined
    
    // Setup ontology
    if (typeof testCase.ontology === 'string') {
      if (testCase.ontology.startsWith('mock:')) {
        const mockId = testCase.ontology.substring(5)
        const mock = this.mockOntologies.get(mockId)
        if (mock) {
          ontologyPath = path.join(outputDir, 'ontology.ttl')
          const content = this.serializeMockOntology(mock)
          await fs.writeFile(ontologyPath, content)
        }
      } else {
        ontologyPath = path.join(outputDir, 'ontology.ttl')
        await fs.writeFile(ontologyPath, testCase.ontology)
      }
    } else {
      ontologyPath = path.join(outputDir, `ontology.${testCase.ontology.format}`)
      await fs.writeFile(ontologyPath, testCase.ontology.content)
    }
    
    // Setup template
    if (typeof testCase.template === 'string') {
      templatePath = path.join(outputDir, 'template.njk')
      await fs.writeFile(templatePath, testCase.template)
    } else {
      templatePath = path.join(outputDir, 'template.njk')
      let content = testCase.template.content
      if (testCase.template.frontMatter) {
        const frontMatter = Object.entries(testCase.template.frontMatter)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n')
        content = `---\n${frontMatter}\n---\n${content}`
      }
      await fs.writeFile(templatePath, content)
    }
    
    const cleanup = async () => {
      try {
        await fs.rm(outputDir, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    return { ontologyPath, templatePath, outputDir, cleanup }
  }
  
  private async executeTest(testCase: TestCase, testEnv: any): Promise<any> {
    try {
      const result = await generateFromOntology(
        testEnv.ontologyPath,
        undefined, // Let it auto-discover templates
        {
          templatesDir: path.dirname(testEnv.templatePath),
          outputDir: testEnv.outputDir,
          dryRun: false,
          cache: false
        }
      )
      
      return result
    } catch (error) {
      return {
        success: false,
        files: [],
        errors: [error],
        duration: 0
      }
    }
  }
  
  private async validateTestResult(testCase: TestCase, actual: any): Promise<{
    success: boolean
    errors: TestError[]
    warnings: string[]
  }> {
    const errors: TestError[] = []
    const warnings: string[] = []
    const expected = testCase.expected
    
    // Validate success expectation
    if (expected.success !== undefined) {
      if (actual.success !== expected.success) {
        errors.push({
          type: 'assertion',
          message: `Expected success: ${expected.success}, got: ${actual.success}`
        })
      }
    }
    
    // Validate file expectations
    if (expected.files) {
      for (const expectedFile of expected.files) {
        const actualFile = actual.files?.find((f: any) => f.path === expectedFile.path)
        
        if (expectedFile.exists !== false && !actualFile) {
          errors.push({
            type: 'assertion',
            message: `Expected file not generated: ${expectedFile.path}`
          })
          continue
        }
        
        if (expectedFile.exists === false && actualFile) {
          errors.push({
            type: 'assertion',
            message: `Unexpected file generated: ${expectedFile.path}`
          })
          continue
        }
        
        if (actualFile) {
          // Validate content
          if (expectedFile.content && actualFile.content !== expectedFile.content) {
            errors.push({
              type: 'assertion',
              message: `File content mismatch: ${expectedFile.path}`,
              details: { expected: expectedFile.content, actual: actualFile.content }
            })
          }
          
          if (expectedFile.contentMatches && !expectedFile.contentMatches.test(actualFile.content)) {
            errors.push({
              type: 'assertion',
              message: `File content doesn't match pattern: ${expectedFile.path}`
            })
          }
          
          if (expectedFile.contentContains) {
            for (const substring of expectedFile.contentContains) {
              if (!actualFile.content.includes(substring)) {
                errors.push({
                  type: 'assertion',
                  message: `File content missing substring "${substring}": ${expectedFile.path}`
                })
              }
            }
          }
        }
      }
    }
    
    // Validate error expectations
    if (expected.errors) {
      for (const expectedError of expected.errors) {
        const matchingError = actual.errors?.find((e: any) => {
          if (expectedError.message && e.message !== expectedError.message) return false
          if (expectedError.messageMatches && !expectedError.messageMatches.test(e.message)) return false
          if (expectedError.type && e.constructor.name !== expectedError.type) return false
          return true
        })
        
        if (!matchingError) {
          errors.push({
            type: 'assertion',
            message: `Expected error not found: ${JSON.stringify(expectedError)}`
          })
        }
      }
    }
    
    // Validate performance expectations
    if (expected.performance) {
      if (expected.performance.maxDuration && actual.duration > expected.performance.maxDuration) {
        errors.push({
          type: 'assertion',
          message: `Performance: Duration ${actual.duration}ms exceeds max ${expected.performance.maxDuration}ms`
        })
      }
      
      if (expected.performance.maxMemory) {
        const memoryUsed = process.memoryUsage().heapUsed
        if (memoryUsed > expected.performance.maxMemory) {
          errors.push({
            type: 'assertion',
            message: `Performance: Memory ${memoryUsed} bytes exceeds max ${expected.performance.maxMemory} bytes`
          })
        }
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings
    }
  }
  
  private generateDiff(expected: any, actual: any): string {
    try {
      return diff(expected, actual, {
        aAnnotation: 'Expected',
        bAnnotation: 'Actual'
      }) || ''
    } catch {
      return 'Unable to generate diff'
    }
  }
  
  private async calculateTestCoverage(testCase: TestCase, result: any): Promise<CoverageInfo> {
    // This would implement actual coverage calculation
    return {
      templatesUsed: result.files?.map((f: any) => f.path) || [],
      ontologyTriples: 0, // Would be calculated
      semanticCoverage: 0, // Would be calculated
      contextCoverage: 0 // Would be calculated
    }
  }
  
  private async cleanupTestEnvironment(testEnv: any): Promise<void> {
    await testEnv.cleanup()
  }
  
  private printTestResult(result: TestResult): void {
    const status = result.success ? chalk.green('✓') : chalk.red('✗')
    const duration = `${result.duration}ms`
    
    console.log(`${status} ${result.name} ${chalk.dim(`(${duration})`)}`)
    
    if (!result.success) {
      result.errors.forEach(error => {
        console.log(`  ${chalk.red('Error:')} ${error.message}`)
        if (error.details) {
          console.log(`  ${chalk.dim(JSON.stringify(error.details, null, 2))}`)
        }
      })
      
      if (result.diff) {
        console.log(`  ${chalk.dim('Diff:')}\n${result.diff}`)
      }
    }
    
    result.warnings.forEach(warning => {
      console.log(`  ${chalk.yellow('Warning:')} ${warning}`)
    })
  }
  
  private printTestSummary(summary: any): void {
    console.log('\n' + '='.repeat(50))
    console.log(chalk.bold('Test Summary'))
    console.log('='.repeat(50))
    
    const { success, totalTests, passed, failed, skipped, duration } = summary
    
    console.log(`Total: ${totalTests}`)
    console.log(chalk.green(`Passed: ${passed}`))
    if (failed > 0) console.log(chalk.red(`Failed: ${failed}`))
    if (skipped > 0) console.log(chalk.yellow(`Skipped: ${skipped}`))
    console.log(`Duration: ${duration}ms`)
    
    const status = success ? chalk.green('PASS') : chalk.red('FAIL')
    console.log(`\nStatus: ${status}`)
  }
  
  private calculateSummary(results: TestResult[]): any {
    return {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      avgDuration: results.length > 0 ? results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0
    }
  }
  
  private generateHtmlReport(results: TestResult[]): string {
    const summary = this.calculateSummary(results)
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>UNJUCKS Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 2rem; }
        .summary { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
        .test { border: 1px solid #ddd; margin: 0.5rem 0; padding: 1rem; border-radius: 4px; }
        .success { border-left: 4px solid #4caf50; }
        .failure { border-left: 4px solid #f44336; }
        .error { color: #f44336; font-family: monospace; }
        .diff { background: #f8f8f8; padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>UNJUCKS Test Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Total: ${summary.total}</p>
        <p>Passed: ${summary.passed}</p>
        <p>Failed: ${summary.failed}</p>
        <p>Duration: ${summary.duration}ms</p>
    </div>
    
    <h2>Test Results</h2>
    ${results.map(result => `
    <div class="test ${result.success ? 'success' : 'failure'}">
        <h3>${result.name}</h3>
        <p>Duration: ${result.duration}ms</p>
        
        ${result.errors.length > 0 ? `
        <h4>Errors:</h4>
        ${result.errors.map(error => `<div class="error">${error.message}</div>`).join('')}
        ` : ''}
        
        ${result.diff ? `
        <h4>Diff:</h4>
        <pre class="diff">${result.diff}</pre>
        ` : ''}
    </div>
    `).join('')}
</body>
</html>`
  }
  
  private generateMarkdownReport(results: TestResult[]): string {
    const summary = this.calculateSummary(results)
    
    return `# UNJUCKS Test Report

## Summary
- **Total**: ${summary.total}
- **Passed**: ${summary.passed}
- **Failed**: ${summary.failed}
- **Duration**: ${summary.duration}ms

## Test Results

${results.map(result => `
### ${result.success ? '✅' : '❌'} ${result.name}

**Duration**: ${result.duration}ms

${result.errors.length > 0 ? `
**Errors**:
${result.errors.map(error => `- ${error.message}`).join('\n')}
` : ''}

${result.diff ? `
**Diff**:
\`\`\`
${result.diff}
\`\`\`
` : ''}
`).join('')}
`
  }
  
  private generateJunitReport(results: TestResult[]): string {
    const summary = this.calculateSummary(results)
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="UNJUCKS Tests" tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">
${results.map(result => `
  <testcase name="${result.name}" time="${result.duration / 1000}" classname="UNJUCKS">
    ${result.errors.length > 0 ? `
    <failure message="${result.errors[0].message}">
      ${result.errors.map(e => e.message).join('\n')}
    </failure>
    ` : ''}
  </testcase>
`).join('')}
</testsuite>`
  }
  
  private async generateCoverageReport(results: TestResult[]): Promise<Record<string, CoverageInfo>> {
    const coverage: Record<string, CoverageInfo> = {}
    
    results.forEach(result => {
      if (result.coverage) {
        coverage[result.testId] = result.coverage
      }
    })
    
    return coverage
  }
  
  private setupBuiltinMocks(): void {
    // Create common mock ontologies for testing
    this.createMockOntology({
      id: 'simple',
      baseUri: 'http://example.com/',
      prefixes: {
        ex: 'http://example.com/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
      },
      triples: [
        { subject: 'ex:greeting', predicate: 'rdfs:label', object: '"Hello, World!"' }
      ]
    })
    
    this.createMockOntology({
      id: 'command',
      baseUri: 'http://example.com/cli#',
      prefixes: {
        cmd: 'http://example.com/cli#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
      },
      triples: [
        { subject: 'cmd:createCommand', predicate: 'rdf:type', object: 'cmd:Command' },
        { subject: 'cmd:createCommand', predicate: 'rdfs:label', object: '"create"' },
        { subject: 'cmd:createCommand', predicate: 'cmd:description', object: '"Create a new project"' }
      ]
    })
  }
  
  private serializeMockOntology(mock: MockOntology): string {
    const prefixes = Object.entries(mock.prefixes)
      .map(([prefix, uri]) => `@prefix ${prefix}: <${uri}> .`)
      .join('\n')
    
    const triples = mock.triples
      .map(triple => `${triple.subject} ${triple.predicate} ${triple.object} .`)
      .join('\n')
    
    return prefixes + '\n\n' + triples
  }
}

/**
 * Expectation matchers for test assertions
 */
export class ExpectMatchers {
  constructor(private actual: any) {}
  
  toBe(expected: any): void {
    if (this.actual !== expected) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`)
    }
  }
  
  toEqual(expected: any): void {
    if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`)
    }
  }
  
  toContain(expected: any): void {
    if (Array.isArray(this.actual)) {
      if (!this.actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`)
      }
    } else if (typeof this.actual === 'string') {
      if (!this.actual.includes(expected)) {
        throw new Error(`Expected string to contain "${expected}"`)
      }
    } else {
      throw new Error('toContain can only be used with arrays or strings')
    }
  }
  
  toMatch(pattern: RegExp): void {
    if (typeof this.actual !== 'string') {
      throw new Error('toMatch can only be used with strings')
    }
    
    if (!pattern.test(this.actual)) {
      throw new Error(`Expected "${this.actual}" to match ${pattern}`)
    }
  }
  
  toHaveLength(expected: number): void {
    if (!this.actual || typeof this.actual.length !== 'number') {
      throw new Error('toHaveLength can only be used with arrays or strings')
    }
    
    if (this.actual.length !== expected) {
      throw new Error(`Expected length ${expected}, got ${this.actual.length}`)
    }
  }
  
  toThrow(expectedError?: string | RegExp): void {
    if (typeof this.actual !== 'function') {
      throw new Error('toThrow can only be used with functions')
    }
    
    try {
      this.actual()
      throw new Error('Expected function to throw, but it did not')
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string' && error.message !== expectedError) {
          throw new Error(`Expected error "${expectedError}", got "${error.message}"`)
        }
        if (expectedError instanceof RegExp && !expectedError.test(error.message)) {
          throw new Error(`Expected error to match ${expectedError}, got "${error.message}"`)
        }
      }
    }
  }
}

// Global test framework instance
export const testFramework = new UnjucksTestFramework()

// Convenience functions for testing
export const test = (testCase: TestCase) => testFramework.test(testCase)
export const describe = (suite: TestSuite) => testFramework.describe(suite)
export const expect = (actual: any) => testFramework.expect(actual)
export const mock = (mockOntology: MockOntology) => testFramework.createMockOntology(mockOntology)

// Test runner function
export async function runTests(options?: any) {
  return testFramework.runTests(options)
}

// Watch mode function
export async function watchTests(options?: any) {
  return testFramework.watch(options)
}