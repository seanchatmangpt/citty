/**
 * 🎮 INTERACTIVE DOCUMENTATION PLAYGROUND
 * Live code editor with real-time template compilation and preview
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { generateFromOntology, createUnjucks, UNJUCKS, type UnjucksContext } from './index'
import { productionMonitor } from './production-monitoring'

export interface PlaygroundExample {
  id: string
  title: string
  description: string
  category: 'basic' | 'intermediate' | 'advanced' | 'real-world'
  difficulty: 1 | 2 | 3 | 4 | 5
  ontology: string
  template: string
  expectedOutput?: string
  tags: string[]
  author?: string
  createdAt: number
  updatedAt: number
}

export interface PlaygroundSession {
  id: string
  ontology: string
  template: string
  output: string
  errors: string[]
  warnings: string[]
  performance: {
    compileTime: number
    renderTime: number
    memoryUsage: number
  }
  lastModified: number
}

export interface PlaygroundConfig {
  maxSessions: number
  sessionTimeout: number
  enableSharing: boolean
  enableAnalytics: boolean
  securityMode: 'strict' | 'moderate' | 'permissive'
  persistentStorage?: boolean
  storageDir?: string
}

export class InteractivePlayground extends EventEmitter {
  private examples: Map<string, PlaygroundExample> = new Map()
  private sessions: Map<string, PlaygroundSession> = new Map()
  private config: PlaygroundConfig
  private unjucksContext?: UnjucksContext
  
  constructor(config: Partial<PlaygroundConfig> = {}) {
    super()
    
    this.config = {
      maxSessions: 100,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      enableSharing: true,
      enableAnalytics: true,
      securityMode: 'moderate',
      persistentStorage: false,
      storageDir: '/tmp/playground-storage',
      ...config
    }
    
    this.setupBuiltinExamples()
    this.startSessionCleanup()
    // Initialize Unjucks asynchronously (don't wait)
    this.initializeUnjucks().catch(error => 
      console.warn('Failed to initialize Unjucks:', error)
    )
  }
  
  /**
   * Create a new playground session
   */
  async createSession(
    ontology: string = '',
    template: string = '',
    options: { userId?: string; title?: string } = {}
  ): Promise<string> {
    const sessionId = this.generateSessionId()
    
    const session: PlaygroundSession = {
      id: sessionId,
      ontology,
      template,
      output: '',
      errors: [],
      warnings: [],
      performance: {
        compileTime: 0,
        renderTime: 0,
        memoryUsage: 0
      },
      lastModified: Date.now()
    }
    
    // Cleanup old sessions if needed
    if (this.sessions.size >= this.config.maxSessions) {
      this.cleanupOldestSessions(10)
    }
    
    this.sessions.set(sessionId, session)
    
    // Save to persistent storage if enabled
    await this.saveSession(session)
    
    // Track analytics
    if (this.config.enableAnalytics) {
      productionMonitor.recordMetric('playground.session.created', 1, {
        userId: options.userId || 'anonymous'
      })
    }
    
    this.emit('session:created', { sessionId, options })
    return sessionId
  }
  
  /**
   * Execute template with ontology in playground
   */
  async executePlayground(
    sessionId: string,
    ontology?: string,
    template?: string
  ): Promise<{
    output: string
    errors: string[]
    warnings: string[]
    performance: PlaygroundSession['performance']
  }> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    
    // Update session data if provided
    if (ontology !== undefined) session.ontology = ontology
    if (template !== undefined) session.template = template
    session.lastModified = Date.now()
    
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    try {
      // Security validation
      this.validateInput(session.ontology, session.template)
      
      const compileStart = Date.now()
      
      // Execute with real Nunjucks
      const result = await this.executeTemplate(session.ontology, session.template)
      
      const compileEnd = Date.now()
      const renderEnd = Date.now()
      const endMemory = process.memoryUsage().heapUsed
      
      // Update session with results
      session.output = result.output
      session.errors = result.errors
      session.warnings = result.warnings
      session.performance = {
        compileTime: compileEnd - compileStart,
        renderTime: renderEnd - compileEnd,
        memoryUsage: endMemory - startMemory
      }
      
      // Save updated session
      await this.saveSession(session)
      
      // Track analytics
      if (this.config.enableAnalytics) {
        productionMonitor.recordMetric('playground.execution.success', 1, {
          hasErrors: session.errors.length > 0 ? 'true' : 'false',
          templateSize: session.template.length.toString(),
          ontologySize: session.ontology.length.toString()
        })
        
        productionMonitor.recordMetric('playground.execution.time', 
          session.performance.compileTime + session.performance.renderTime,
          {},
          'ms'
        )
      }
      
      this.emit('session:executed', { sessionId, session })
      
      return {
        output: session.output,
        errors: session.errors,
        warnings: session.warnings,
        performance: session.performance
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      session.errors = [errorMessage]
      session.output = ''
      
      // Track error analytics
      if (this.config.enableAnalytics) {
        productionMonitor.recordMetric('playground.execution.error', 1, {
          errorType: error.constructor.name
        })
      }
      
      // Save error state
      await this.saveSession(session)
      
      this.emit('session:error', { sessionId, error })
      
      return {
        output: '',
        errors: [errorMessage],
        warnings: [],
        performance: {
          compileTime: Date.now() - startTime,
          renderTime: 0,
          memoryUsage: process.memoryUsage().heapUsed - startMemory
        }
      }
    }
  }
  
  /**
   * Get example by ID
   */
  getExample(id: string): PlaygroundExample | undefined {
    return this.examples.get(id)
  }
  
  /**
   * List examples with filtering
   */
  listExamples(filters: {
    category?: PlaygroundExample['category']
    difficulty?: number
    tags?: string[]
    search?: string
  } = {}): PlaygroundExample[] {
    let examples = Array.from(this.examples.values())
    
    if (filters.category) {
      examples = examples.filter(ex => ex.category === filters.category)
    }
    
    if (filters.difficulty) {
      examples = examples.filter(ex => ex.difficulty <= filters.difficulty)
    }
    
    if (filters.tags && filters.tags.length > 0) {
      examples = examples.filter(ex => 
        filters.tags!.some(tag => ex.tags.includes(tag))
      )
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase()
      examples = examples.filter(ex =>
        ex.title.toLowerCase().includes(search) ||
        ex.description.toLowerCase().includes(search) ||
        ex.tags.some(tag => tag.toLowerCase().includes(search))
      )
    }
    
    return examples.sort((a, b) => {
      // Sort by difficulty, then by title
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty
      }
      return a.title.localeCompare(b.title)
    })
  }
  
  /**
   * Load example into session
   */
  async loadExample(sessionId: string, exampleId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    const example = this.examples.get(exampleId)
    
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    if (!example) throw new Error(`Example not found: ${exampleId}`)
    
    session.ontology = example.ontology
    session.template = example.template
    session.lastModified = Date.now()
    
    // Save updated session
    await this.saveSession(session)
    
    // Track analytics
    if (this.config.enableAnalytics) {
      productionMonitor.recordMetric('playground.example.loaded', 1, {
        exampleId,
        category: example.category
      })
    }
    
    this.emit('example:loaded', { sessionId, exampleId })
  }
  
  /**
   * Share a playground session
   */
  async shareSession(sessionId: string, options: {
    title?: string
    description?: string
    public?: boolean
    expiresIn?: number
  } = {}): Promise<string> {
    if (!this.config.enableSharing) {
      throw new Error('Sharing is disabled')
    }
    
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    
    const shareId = this.generateShareId()
    const sharedSession = {
      ...session,
      shareId,
      title: options.title,
      description: options.description,
      public: options.public || false,
      sharedAt: Date.now(),
      expiresAt: options.expiresIn ? Date.now() + options.expiresIn : undefined
    }
    
    // Store shared session (in production, this would go to a database)
    // For now, we'll emit an event that could be handled by external systems
    this.emit('session:shared', { shareId, session: sharedSession })
    
    // Track analytics
    if (this.config.enableAnalytics) {
      productionMonitor.recordMetric('playground.session.shared', 1, {
        public: options.public ? 'true' : 'false'
      })
    }
    
    return shareId
  }
  
  /**
   * Export playground session
   */
  async exportSession(sessionId: string, format: 'json' | 'markdown' | 'html' = 'json'): Promise<string> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2)
      
      case 'markdown':
        return this.exportToMarkdown(session)
      
      case 'html':
        return this.exportToHTML(session)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  /**
   * Get playground analytics
   */
  getAnalytics(): {
    totalSessions: number
    activeSessions: number
    totalExecutions: number
    avgExecutionTime: number
    popularExamples: Array<{ id: string; title: string; usage: number }>
    errorRate: number
  } {
    const now = Date.now()
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => now - session.lastModified < this.config.sessionTimeout).length
    
    // This would typically come from stored analytics data
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalExecutions: 0, // Would be tracked
      avgExecutionTime: 0, // Would be calculated from stored metrics
      popularExamples: [], // Would be calculated from usage data
      errorRate: 0 // Would be calculated from error metrics
    }
  }
  
  // Private helper methods
  
  private setupBuiltinExamples(): void {
    const examples: PlaygroundExample[] = [
      {
        id: 'hello-world',
        title: 'Hello World',
        description: 'Basic template with simple ontology',
        category: 'basic',
        difficulty: 1,
        ontology: PlaygroundHelpers.createSampleOntology(),
        template: `---
to: hello.txt
---
{{ greeting }}

# Welcome to {{ name }}!

This playground demonstrates:
{% for feature in features %}
- {{ feature | title }}
{% endfor %}

Generated at: {{ now }}`,
        expectedOutput: 'Hello, Playground!\n\n# Welcome to Playground User!\n...',
        tags: ['beginner', 'hello-world', 'basic'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'cli-command',
        title: 'CLI Command Generation',
        description: 'Generate a CLI command from ontological description',
        category: 'intermediate',
        difficulty: 3,
        ontology: `
@prefix cmd: <http://example.com/cli#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:createProject a cmd:Command ;
  rdfs:label "create" ;
  cmd:description "Create a new project" ;
  cmd:hasArgument [
    cmd:name "name" ;
    cmd:type "string" ;
    cmd:required true ;
    cmd:description "Project name"
  ] ;
  cmd:hasArgument [
    cmd:name "template" ;
    cmd:type "string" ;
    cmd:required false ;
    cmd:description "Project template"
  ] .
        `,
        template: `---
to: "commands/{{ label }}.ts"
---
export const {{ label }}Command = defineCommand({
  meta: {
    name: "{{ label }}",
    description: "{{ description }}"
  },
  args: {
    {% for arg in hasArgument %}
    {{ arg.name }}: {
      type: "{{ arg.type }}",
      description: "{{ arg.description }}",
      required: {{ arg.required }}
    }{% if not loop.last %},{% endif %}
    {% endfor %}
  },
  run: async ({ args }) => {
    console.log(\`Creating project: \${args.name}\`)
    // Implementation here
  }
})`,
        tags: ['cli', 'commands', 'intermediate', 'typescript'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'rest-api',
        title: 'REST API Generation',
        description: 'Generate REST API endpoints from ontology',
        category: 'advanced',
        difficulty: 4,
        ontology: `
@prefix api: <http://example.com/api#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

api:UserResource a api:Resource ;
  rdfs:label "User" ;
  api:path "/users" ;
  api:hasOperation [
    a api:GetOperation ;
    api:method "GET" ;
    api:description "Get all users"
  ] ;
  api:hasOperation [
    a api:PostOperation ;
    api:method "POST" ;
    api:description "Create a new user"
  ] ;
  api:hasProperty [
    api:name "id" ;
    api:type "string" ;
    api:required true
  ] ;
  api:hasProperty [
    api:name "name" ;
    api:type "string" ;
    api:required true
  ] ;
  api:hasProperty [
    api:name "email" ;
    api:type "string" ;
    api:required true
  ] .
        `,
        template: `---
to: "api/{{ label | lowerCase }}.ts"
---
import { Router } from 'express'
import { {{ label }} } from '../models/{{ label | lowerCase }}'

const router = Router()

// {{ label }} Resource - {{ path }}
{% for operation in hasOperation %}
router.{{ operation.method | lowerCase }}('{{ path }}{% if operation.method == 'GET' and operation.path %}{{ operation.path }}{% endif %}', async (req, res) => {
  try {
    // {{ operation.description }}
    {% if operation.method == 'GET' %}
    const {{ label | lowerCase }}s = await {{ label }}.findAll()
    res.json({{ label | lowerCase }}s)
    {% elif operation.method == 'POST' %}
    const new{{ label }} = await {{ label }}.create(req.body)
    res.status(201).json(new{{ label }})
    {% endif %}
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
{% endfor %}

export default router`,
        tags: ['api', 'rest', 'express', 'advanced', 'backend'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]
    
    examples.forEach(example => {
      this.examples.set(example.id, example)
    })
  }
  
  private validateInput(ontology: string, template: string): void {
    // Security validation based on security mode
    switch (this.config.securityMode) {
      case 'strict':
        this.validateStrict(ontology, template)
        break
      case 'moderate':
        this.validateModerate(ontology, template)
        break
      case 'permissive':
        // Minimal validation
        break
    }
  }
  
  private validateStrict(ontology: string, template: string): void {
    // Check for dangerous patterns
    const dangerous = [
      'require(',
      'import(',
      'eval(',
      'Function(',
      '__proto__',
      'constructor',
      'process.',
      'global.',
      'fs.',
      'child_process'
    ]
    
    const content = ontology + template
    for (const pattern of dangerous) {
      if (content.includes(pattern)) {
        throw new Error(`Potentially dangerous pattern detected: ${pattern}`)
      }
    }
    
    // Limit size
    if (ontology.length > 100000 || template.length > 50000) {
      throw new Error('Input too large')
    }
  }
  
  private validateModerate(ontology: string, template: string): void {
    // Basic size limits
    if (ontology.length > 500000 || template.length > 100000) {
      throw new Error('Input too large')
    }
    
    // Check for obvious dangerous patterns
    const veryDangerous = ['eval(', 'Function(', '__proto__']
    const content = ontology + template
    
    for (const pattern of veryDangerous) {
      if (content.includes(pattern)) {
        throw new Error(`Dangerous pattern detected: ${pattern}`)
      }
    }
  }
  
  /**
   * Execute template with real Nunjucks rendering
   */
  private async executeTemplate(ontology: string, template: string): Promise<{
    output: string
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    let output = ''
    
    try {
      // Initialize Unjucks context
      const unjucksContext = await createUnjucks({
        templatesDir: '/tmp/playground-' + Date.now(),
        cache: false,
        dryRun: false
      })
      
      // If ontology is provided, use full ontology-driven generation
      if (ontology && ontology.trim()) {
        output = await this.executeWithOntology(ontology, template)
      } else {
        // Direct template rendering with mock data
        output = await this.executeDirectTemplate(template)
      }
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Template execution failed')
    }
    
    return { output, errors, warnings }
  }
  
  /**
   * Execute template with ontology context using real UNJUCKS.render()
   */
  private async executeWithOntology(ontology: string, template: string): Promise<string> {
    try {
      // Create temporary files for ontology processing
      const tempDir = '/tmp/playground-' + Date.now()
      await fs.mkdir(tempDir, { recursive: true })
      
      const ontologyPath = path.join(tempDir, 'ontology.ttl')
      const templatePath = path.join(tempDir, 'template.njk')
      
      await fs.writeFile(ontologyPath, ontology)
      await fs.writeFile(templatePath, `---\nto: output.txt\n---\n${template}`)
      
      // Execute with timeout
      const result = await Promise.race([
        generateFromOntology(ontologyPath, 'template', { 
          templatesDir: tempDir,
          outputDir: tempDir,
          dryRun: true
        }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout (10s)')), 10000)
        )
      ])
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true })
      
      if (result.success && result.files.length > 0) {
        return result.files[0].content
      } else if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      } else {
        throw new Error('No output generated from ontology')
      }
    } catch (error) {
      throw new Error(`Ontology processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Execute template directly with sample context using real UNJUCKS.render()
   */
  private async executeDirectTemplate(template: string): Promise<string> {
    try {
      // Validate template syntax first
      const isValid = await this.validateTemplate(template)
      if (!isValid.valid) {
        throw new Error(`Template validation failed: ${isValid.errors.join(', ')}`)
      }
      
      // Create sample context based on template variables
      const sampleContext = this.createSampleContext(template)
      
      // Use real UNJUCKS.render() for template execution
      const rendered = UNJUCKS.render(template, sampleContext)
      
      return rendered
    } catch (error) {
      throw new Error(`Direct template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Validate template using real Nunjucks compilation
   */
  private async validateTemplate(template: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []
    
    try {
      // Use real UNJUCKS.compile() to validate template syntax
      UNJUCKS.compile(template, 'playground-template')
      
      // Additional validation checks
      if (!template || template.trim().length === 0) {
        errors.push('Template is empty')
      }
      
      // Check for basic template structure
      if (template.includes('{{') && !template.includes('}}')) {
        errors.push('Unclosed template expression')
      }
      
      if (template.includes('{%') && !template.includes('%}')) {
        errors.push('Unclosed template statement')
      }
      
      return { valid: errors.length === 0, errors }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Template compilation failed')
      return { valid: false, errors }
    }
  }
  
  /**
   * Create sample context for template rendering
   */
  private createSampleContext(template: string): any {
    const context: any = {
      // Basic variables
      name: 'Sample Name',
      title: 'Sample Title',
      description: 'This is a sample description',
      version: '1.0.0',
      author: 'Sample Author',
      date: new Date().toISOString(),
      
      // Common entities
      greeting: 'Hello, World!',
      label: 'sample-label',
      id: 'sample-id',
      type: 'sample-type',
      
      // Collections
      items: [
        { name: 'Item 1', value: 'value1' },
        { name: 'Item 2', value: 'value2' },
        { name: 'Item 3', value: 'value3' }
      ],
      
      // Common ontology patterns
      hasArgument: [
        { name: 'arg1', type: 'string', required: true, description: 'First argument' },
        { name: 'arg2', type: 'number', required: false, description: 'Second argument' }
      ],
      
      hasOperation: [
        { method: 'GET', description: 'Get operation' },
        { method: 'POST', description: 'Create operation' }
      ],
      
      hasProperty: [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true }
      ]
    }
    
    // Extract variable names from template and provide defaults
    const variableMatches = template.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*[|}]/g)
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.replace(/[{|}\s]/g, '').split('|')[0].split('.')[0]
        if (!context[varName]) {
          context[varName] = `Sample ${varName}`
        }
      })
    }
    
    return context
  }
  
  private cleanupOldestSessions(count: number): void {
    const sessions = Array.from(this.sessions.entries())
      .sort(([,a], [,b]) => a.lastModified - b.lastModified)
      .slice(0, count)
    
    sessions.forEach(([id]) => {
      this.sessions.delete(id)
      this.emit('session:expired', { sessionId: id })
    })
  }
  
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      const expired: string[] = []
      
      for (const [id, session] of this.sessions) {
        if (now - session.lastModified > this.config.sessionTimeout) {
          expired.push(id)
        }
      }
      
      expired.forEach(id => {
        this.sessions.delete(id)
        this.emit('session:expired', { sessionId: id })
      })
      
    }, 60000) // Check every minute
  }
  
  private exportToMarkdown(session: PlaygroundSession): string {
    return `# Playground Session

## Ontology
\`\`\`turtle
${session.ontology}
\`\`\`

## Template
\`\`\`nunjucks
${session.template}
\`\`\`

## Output
\`\`\`
${session.output}
\`\`\`

## Performance
- Compile Time: ${session.performance.compileTime}ms
- Render Time: ${session.performance.renderTime}ms
- Memory Usage: ${(session.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB

${session.errors.length > 0 ? `## Errors\n${session.errors.map(e => `- ${e}`).join('\n')}` : ''}
${session.warnings.length > 0 ? `## Warnings\n${session.warnings.map(w => `- ${w}`).join('\n')}` : ''}
`
  }
  
  private exportToHTML(session: PlaygroundSession): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Playground Session Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 2rem; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        .performance { background: #e3f2fd; padding: 1rem; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Playground Session Export</h1>
    
    <h2>Ontology</h2>
    <pre><code>${this.escapeHtml(session.ontology)}</code></pre>
    
    <h2>Template</h2>
    <pre><code>${this.escapeHtml(session.template)}</code></pre>
    
    <h2>Output</h2>
    <pre><code>${this.escapeHtml(session.output)}</code></pre>
    
    <div class="performance">
        <h3>Performance</h3>
        <ul>
            <li>Compile Time: ${session.performance.compileTime}ms</li>
            <li>Render Time: ${session.performance.renderTime}ms</li>
            <li>Memory Usage: ${(session.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB</li>
        </ul>
    </div>
    
    ${session.errors.length > 0 ? `
    <h3>Errors</h3>
    <ul class="error">
        ${session.errors.map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}
    </ul>
    ` : ''}
    
    ${session.warnings.length > 0 ? `
    <h3>Warnings</h3>
    <ul class="warning">
        ${session.warnings.map(w => `<li>${this.escapeHtml(w)}</li>`).join('')}
    </ul>
    ` : ''}
</body>
</html>`
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  
  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36) + Math.random().toString(36).slice(2)
  }
  
  private generateShareId(): string {
    return 'share_' + Date.now().toString(36) + Math.random().toString(36).slice(2)
  }
  
  /**
   * Initialize Unjucks context for playground
   */
  private async initializeUnjucks(): Promise<void> {
    try {
      this.unjucksContext = await createUnjucks({
        templatesDir: this.config.storageDir + '/templates',
        outputDir: this.config.storageDir + '/output',
        cache: true,
        parallel: false // Disable for playground to avoid complexity
      })
    } catch (error) {
      console.warn('Failed to initialize Unjucks context for playground:', error)
    }
  }
  
  /**
   * Save session to persistent storage if enabled
   */
  private async saveSession(session: PlaygroundSession): Promise<void> {
    if (!this.config.persistentStorage) return
    
    try {
      const storageDir = this.config.storageDir!
      const sessionDir = path.join(storageDir, 'sessions')
      await fs.mkdir(sessionDir, { recursive: true })
      
      const sessionFile = path.join(sessionDir, `${session.id}.json`)
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2))
    } catch (error) {
      console.warn(`Failed to save session ${session.id}:`, error)
    }
  }
  
  /**
   * Load session from persistent storage if available
   */
  private async loadSession(sessionId: string): Promise<PlaygroundSession | null> {
    if (!this.config.persistentStorage) return null
    
    try {
      const sessionFile = path.join(this.config.storageDir!, 'sessions', `${sessionId}.json`)
      const content = await fs.readFile(sessionFile, 'utf-8')
      return JSON.parse(content) as PlaygroundSession
    } catch {
      return null
    }
  }
  
  /**
   * Get session with fallback to persistent storage
   */
  async getSession(sessionId: string): Promise<PlaygroundSession | null> {
    let session = this.sessions.get(sessionId)
    
    if (!session && this.config.persistentStorage) {
      session = await this.loadSession(sessionId)
      if (session) {
        this.sessions.set(sessionId, session)
      }
    }
    
    return session || null
  }
}

/**
 * Playground helpers for common operations
 */
export class PlaygroundHelpers {
  static async validateTemplateSync(template: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []
    
    try {
      // Use real UNJUCKS.compile() to validate
      UNJUCKS.compile(template, 'validation-template')
      
      if (!template || template.trim().length === 0) {
        errors.push('Template is empty')
      }
      
      return { valid: errors.length === 0, errors }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Template compilation failed')
      return { valid: false, errors }
    }
  }
  
  static async executeTemplateSync(template: string, context: any = {}): Promise<string> {
    try {
      return UNJUCKS.render(template, context)
    } catch (error) {
      throw new Error(`Template execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  static createSampleOntology(): string {
    return `@prefix ex: <http://example.com/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .

ex:greeting rdfs:label "Hello, Playground!" ;
  schema:description "A simple greeting example" .
  
ex:user a ex:Person ;
  schema:name "Playground User" ;
  schema:email "user@playground.example" .
  
ex:project a ex:Project ;
  schema:name "Sample Project" ;
  schema:description "A sample project for demonstration" ;
  schema:version "1.0.0" .`
  }
  
  static createSampleContext(): any {
    return {
      greeting: 'Hello, Playground!',
      name: 'Playground User',
      email: 'user@playground.example',
      project: {
        name: 'Sample Project',
        description: 'A sample project for demonstration',
        version: '1.0.0'
      },
      items: [
        { name: 'Item 1', type: 'string' },
        { name: 'Item 2', type: 'number' },
        { name: 'Item 3', type: 'boolean' }
      ],
      now: new Date().toISOString(),
      features: ['templating', 'ontology', 'playground']
    }
  }
}

// Global playground instance
export const interactivePlayground = new InteractivePlayground()

// Convenience functions
export async function createPlaygroundSession(ontology?: string, template?: string): Promise<string> {
  return interactivePlayground.createSession(ontology, template)
}

export async function executePlaygroundSession(
  sessionId: string, 
  ontology?: string, 
  template?: string
) {
  return interactivePlayground.executePlayground(sessionId, ontology, template)
}

export function getPlaygroundExamples(filters?: any) {
  return interactivePlayground.listExamples(filters)
}

export async function sharePlaygroundSession(sessionId: string, options?: any) {
  return interactivePlayground.shareSession(sessionId, options)
}

export async function getPlaygroundSession(sessionId: string) {
  return interactivePlayground.getSession(sessionId)
}

export async function loadPlaygroundExample(sessionId: string, exampleId: string) {
  return interactivePlayground.loadExample(sessionId, exampleId)
}

export async function exportPlaygroundSession(sessionId: string, format?: 'json' | 'markdown' | 'html') {
  return interactivePlayground.exportSession(sessionId, format)
}

// Direct template validation and execution functions
export async function validatePlaygroundTemplate(template: string) {
  return PlaygroundHelpers.validateTemplateSync(template)
}

export async function executePlaygroundTemplate(template: string, context?: any) {
  return PlaygroundHelpers.executeTemplateSync(template, context)
}