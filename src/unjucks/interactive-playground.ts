/**
 * 🎮 INTERACTIVE DOCUMENTATION PLAYGROUND
 * Live code editor with real-time template compilation and preview
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { generateFromOntology, createUnjucks } from './index'
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
}

export class InteractivePlayground extends EventEmitter {
  private examples: Map<string, PlaygroundExample> = new Map()
  private sessions: Map<string, PlaygroundSession> = new Map()
  private config: PlaygroundConfig
  
  constructor(config: Partial<PlaygroundConfig> = {}) {
    super()
    
    this.config = {
      maxSessions: 100,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      enableSharing: true,
      enableAnalytics: true,
      securityMode: 'moderate',
      ...config
    }
    
    this.setupBuiltinExamples()
    this.startSessionCleanup()
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
    const session = this.sessions.get(sessionId)
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
      
      // Create temporary context for execution
      const unjucksContext = await createUnjucks({
        templatesDir: '/tmp/playground',
        cache: false
      })
      
      const compileStart = Date.now()
      
      // Generate output
      const result = await this.executeInSandbox(session.ontology, session.template)
      
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
    const session = this.sessions.get(sessionId)
    const example = this.examples.get(exampleId)
    
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    if (!example) throw new Error(`Example not found: ${exampleId}`)
    
    session.ontology = example.ontology
    session.template = example.template
    session.lastModified = Date.now()
    
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
    
    const session = this.sessions.get(sessionId)
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
  exportSession(sessionId: string, format: 'json' | 'markdown' | 'html' = 'json'): string {
    const session = this.sessions.get(sessionId)
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
        ontology: `
@prefix ex: <http://example.com/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, World!" .
        `,
        template: `---
to: hello.txt
---
{{ greeting }}`,
        expectedOutput: 'Hello, World!',
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
  
  private async executeInSandbox(ontology: string, template: string): Promise<{
    output: string
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    let output = ''
    
    try {
      // Create temporary files for execution
      const tempDir = '/tmp/playground-' + Date.now()
      await fs.mkdir(tempDir, { recursive: true })
      
      const ontologyPath = path.join(tempDir, 'ontology.ttl')
      const templatePath = path.join(tempDir, 'template.njk')
      
      await fs.writeFile(ontologyPath, ontology)
      await fs.writeFile(templatePath, `---\nto: output.txt\n---\n${template}`)
      
      // Execute with timeout and resource limits
      const result = await Promise.race([
        generateFromOntology(ontologyPath, 'template', { 
          templatesDir: tempDir,
          outputDir: tempDir
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout')), 10000)
        )
      ]) as any
      
      if (result.success && result.files.length > 0) {
        output = result.files[0].content
      } else if (result.errors) {
        errors.push(...result.errors.map((e: Error) => e.message))
      }
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true })
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Execution failed')
    }
    
    return { output, errors, warnings }
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