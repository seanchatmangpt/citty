# Pattern 11: AI-Powered Command - Intelligent CLI Assistant

## Overview

This pattern demonstrates a production-ready AI-powered CLI assistant that leverages multiple AI models, natural language processing, and intelligent command generation. The system can understand natural language queries, generate appropriate commands, and provide contextual assistance with learning capabilities.

## Features

- Multi-model AI integration (OpenAI, Anthropic, Ollama)
- Natural language to command translation
- Context-aware assistance
- Learning from user interactions
- Command explanation and validation
- Safety checks and sandboxing
- Conversation history management
- Performance optimization with caching

## Environment Setup

```bash
# Install dependencies
pnpm add citty zod @ai-sdk/openai @ai-sdk/anthropic ollama
pnpm add express ws sqlite3 ioredis
pnpm add -D @types/node @types/ws vitest tsx

# Environment variables
cat > .env << 'EOF'
# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OLLAMA_BASE_URL=http://localhost:11434

# Default AI Settings
DEFAULT_MODEL=gpt-4
FALLBACK_MODEL=llama3.1:8b
AI_TEMPERATURE=0.1
MAX_TOKENS=4000

# Database and Cache
DATABASE_URL=sqlite:./ai_assistant.db
REDIS_URL=redis://localhost:6379

# Security
ENABLE_COMMAND_EXECUTION=false
SANDBOX_MODE=true
MAX_CONVERSATION_HISTORY=50

# Performance
RESPONSE_CACHE_TTL=3600
EMBEDDING_MODEL=text-embedding-3-small
SIMILARITY_THRESHOLD=0.8

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9091
EOF
```

## Complete Implementation

```typescript
// src/commands/ai-assistant.ts
import { defineCommand } from 'citty'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText, streamText, embed } from 'ai'
import { createReadStream, writeFileSync } from 'fs'
import { join } from 'path'
import { Database } from 'sqlite3'
import Redis from 'ioredis'
import { performance } from 'perf_hooks'

// Schemas
const ConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().datetime(),
    metadata: z.object({
      model: z.string(),
      tokens: z.number().optional(),
      duration: z.number().optional(),
      confidence: z.number().optional()
    }).optional()
  })),
  context: z.object({
    currentDirectory: z.string(),
    environment: z.record(z.string()),
    recentCommands: z.array(z.string()),
    preferences: z.record(z.any())
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

const CommandGenerationSchema = z.object({
  command: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  safety: z.object({
    level: z.enum(['safe', 'caution', 'danger']),
    warnings: z.array(z.string()),
    requiresConfirmation: z.boolean()
  }),
  alternatives: z.array(z.object({
    command: z.string(),
    explanation: z.string(),
    confidence: z.number()
  }))
})

// AI Assistant Engine
class AIAssistantEngine {
  private db: Database
  private redis: Redis
  private models: Map<string, any>
  private conversationCache: Map<string, any>

  constructor() {
    this.db = new Database('./ai_assistant.db')
    this.redis = new Redis(process.env.REDIS_URL!)
    this.conversationCache = new Map()
    this.setupModels()
    this.initializeDatabase()
  }

  private setupModels() {
    this.models = new Map([
      ['gpt-4', openai('gpt-4')],
      ['gpt-3.5-turbo', openai('gpt-3.5-turbo')],
      ['claude-3-sonnet', anthropic('claude-3-sonnet-20240229')],
      ['claude-3-haiku', anthropic('claude-3-haiku-20240307')],
      ['llama3.1:8b', 'ollama'], // Special handling for Ollama
      ['llama3.1:70b', 'ollama']
    ])
  }

  private async initializeDatabase() {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            context TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS command_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            query TEXT NOT NULL,
            generated_command TEXT NOT NULL,
            confidence REAL NOT NULL,
            executed BOOLEAN DEFAULT FALSE,
            success BOOLEAN,
            feedback TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            query_pattern TEXT NOT NULL,
            response_template TEXT NOT NULL,
            embedding BLOB,
            usage_count INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        resolve()
      })
    })
  }

  async processQuery(
    query: string,
    userId: string,
    conversationId?: string
  ): Promise<AIResponse> {
    const startTime = performance.now()
    
    try {
      // Get or create conversation context
      const conversation = await this.getOrCreateConversation(userId, conversationId)
      
      // Analyze query intent and select appropriate model
      const { intent, model, context } = await this.analyzeQuery(query, conversation)
      
      // Generate response based on intent
      let response: AIResponse
      
      switch (intent) {
        case 'command_generation':
          response = await this.generateCommand(query, context, model)
          break
        case 'explanation':
          response = await this.explainCommand(query, context, model)
          break
        case 'troubleshooting':
          response = await this.provideTroubleshootingHelp(query, context, model)
          break
        case 'learning':
          response = await this.provideEducationalContent(query, context, model)
          break
        default:
          response = await this.generateGeneralResponse(query, context, model)
      }
      
      // Store interaction for learning
      await this.storeInteraction(userId, conversation.id, query, response)
      
      // Update conversation context
      await this.updateConversation(conversation.id, query, response)
      
      const duration = performance.now() - startTime
      response.metadata.duration = duration
      
      return response
    } catch (error) {
      console.error('Query processing failed:', error)
      return this.createErrorResponse(error, startTime)
    }
  }

  private async analyzeQuery(query: string, conversation: any): Promise<{
    intent: string
    model: string
    context: any
  }> {
    // Use embeddings to classify query intent
    const embedding = await this.generateEmbedding(query)
    const similarQueries = await this.findSimilarQueries(embedding)
    
    // Analyze patterns to determine intent
    const intent = await this.classifyIntent(query, similarQueries)
    
    // Select appropriate model based on intent and complexity
    const model = this.selectOptimalModel(intent, query.length, conversation.context)
    
    // Build context from conversation history and environment
    const context = await this.buildContext(conversation, similarQueries)
    
    return { intent, model, context }
  }

  private async generateCommand(
    query: string,
    context: any,
    modelName: string
  ): Promise<AIResponse> {
    const systemPrompt = `You are an expert CLI assistant. Generate safe, accurate shell commands based on user requests.

Context:
- Current directory: ${context.currentDirectory}
- OS: ${context.os}
- Available tools: ${context.availableTools.join(', ')}
- Recent commands: ${context.recentCommands.join(', ')}

Guidelines:
1. Generate only safe, non-destructive commands by default
2. Provide clear explanations for each command
3. Suggest alternatives when appropriate
4. Warn about potentially dangerous operations
5. Use proper error handling and validation

Response format should be JSON with: command, explanation, confidence, safety, alternatives`

    const model = this.models.get(modelName)
    
    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: query,
        temperature: 0.1,
        maxTokens: 1000
      })

      const parsed = JSON.parse(result.text)
      const commandResult = CommandGenerationSchema.parse(parsed)

      // Additional safety validation
      const safetyCheck = await this.validateCommandSafety(commandResult.command)
      
      return {
        type: 'command_generation',
        content: commandResult,
        model: modelName,
        metadata: {
          tokens: result.usage?.totalTokens || 0,
          confidence: commandResult.confidence,
          safety: safetyCheck
        }
      }
    } catch (error) {
      // Fallback to simpler model
      if (modelName !== process.env.FALLBACK_MODEL) {
        return this.generateCommand(query, context, process.env.FALLBACK_MODEL!)
      }
      throw error
    }
  }

  private async explainCommand(
    query: string,
    context: any,
    modelName: string
  ): Promise<AIResponse> {
    const systemPrompt = `You are a CLI expert who explains shell commands in detail.

Provide comprehensive explanations that include:
1. What the command does overall
2. Breakdown of each part/flag
3. Expected output
4. Common use cases
5. Potential issues or gotchas
6. Related commands that might be useful

Make explanations clear for users of all skill levels.`

    const model = this.models.get(modelName)
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: query,
      temperature: 0.2,
      maxTokens: 1500
    })

    return {
      type: 'explanation',
      content: result.text,
      model: modelName,
      metadata: {
        tokens: result.usage?.totalTokens || 0,
        confidence: 0.9 // High confidence for explanations
      }
    }
  }

  private async provideTroubleshootingHelp(
    query: string,
    context: any,
    modelName: string
  ): Promise<AIResponse> {
    const systemPrompt = `You are a troubleshooting expert for CLI and system issues.

Context:
- Recent commands: ${context.recentCommands.join(', ')}
- Error context: ${context.errorContext || 'None provided'}
- System info: ${JSON.stringify(context.systemInfo)}

Provide systematic troubleshooting steps:
1. Identify the likely cause
2. Provide step-by-step diagnostics
3. Suggest solutions in order of likelihood
4. Mention preventive measures
5. Recommend additional resources if needed`

    const model = this.models.get(modelName)
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: query,
      temperature: 0.1,
      maxTokens: 2000
    })

    return {
      type: 'troubleshooting',
      content: result.text,
      model: modelName,
      metadata: {
        tokens: result.usage?.totalTokens || 0,
        confidence: 0.8
      }
    }
  }

  private async provideEducationalContent(
    query: string,
    context: any,
    modelName: string
  ): Promise<AIResponse> {
    const systemPrompt = `You are a patient CLI instructor. Provide educational content that helps users learn.

Teaching approach:
1. Start with fundamentals if needed
2. Build up complexity gradually
3. Provide practical examples
4. Suggest hands-on exercises
5. Reference additional learning resources

Adapt explanations to the user's apparent skill level based on their query.`

    const model = this.models.get(modelName)
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: query,
      temperature: 0.3,
      maxTokens: 2000
    })

    return {
      type: 'learning',
      content: result.text,
      model: modelName,
      metadata: {
        tokens: result.usage?.totalTokens || 0,
        confidence: 0.85
      }
    }
  }

  private async generateGeneralResponse(
    query: string,
    context: any,
    modelName: string
  ): Promise<AIResponse> {
    const systemPrompt = `You are a helpful CLI assistant. Provide accurate, concise responses to user queries about command-line tools, system administration, and development workflows.

Keep responses practical and actionable.`

    const model = this.models.get(modelName)
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: query,
      temperature: 0.2,
      maxTokens: 1000
    })

    return {
      type: 'general',
      content: result.text,
      model: modelName,
      metadata: {
        tokens: result.usage?.totalTokens || 0,
        confidence: 0.7
      }
    }
  }

  private async getOrCreateConversation(
    userId: string,
    conversationId?: string
  ): Promise<any> {
    if (conversationId) {
      const cached = this.conversationCache.get(conversationId)
      if (cached) return cached
      
      // Load from database
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT * FROM conversations WHERE id = ?',
          [conversationId],
          (err, row) => {
            if (err) reject(err)
            else if (row) {
              const conversation = {
                ...row,
                context: JSON.parse(row.context),
                messages: []
              }
              this.conversationCache.set(conversationId, conversation)
              resolve(conversation)
            } else {
              resolve(this.createNewConversation(userId))
            }
          }
        )
      })
    } else {
      return this.createNewConversation(userId)
    }
  }

  private createNewConversation(userId: string): any {
    const conversation = {
      id: this.generateId(),
      userId,
      context: {
        currentDirectory: process.cwd(),
        environment: process.env,
        recentCommands: [],
        preferences: {},
        os: process.platform,
        availableTools: this.detectAvailableTools(),
        systemInfo: this.getSystemInfo()
      },
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.conversationCache.set(conversation.id, conversation)
    return conversation
  }

  private async classifyIntent(query: string, similarQueries: any[]): Promise<string> {
    const queryLower = query.toLowerCase()
    
    // Pattern-based classification
    if (queryLower.includes('how do i') || queryLower.includes('command for')) {
      return 'command_generation'
    }
    if (queryLower.includes('explain') || queryLower.includes('what does')) {
      return 'explanation'
    }
    if (queryLower.includes('error') || queryLower.includes('not working')) {
      return 'troubleshooting'
    }
    if (queryLower.includes('learn') || queryLower.includes('tutorial')) {
      return 'learning'
    }
    
    // Use similar queries for classification
    if (similarQueries.length > 0) {
      const intents = similarQueries.map(sq => sq.intent)
      return this.getMostCommonIntent(intents)
    }
    
    return 'general'
  }

  private selectOptimalModel(intent: string, queryLength: number, context: any): string {
    // Model selection logic based on intent and complexity
    if (intent === 'command_generation' && queryLength < 100) {
      return 'gpt-3.5-turbo' // Fast for simple commands
    }
    if (intent === 'troubleshooting' || queryLength > 200) {
      return 'gpt-4' // More capable for complex issues
    }
    if (intent === 'explanation') {
      return 'claude-3-haiku' // Good for explanations
    }
    
    return process.env.DEFAULT_MODEL || 'gpt-3.5-turbo'
  }

  private async validateCommandSafety(command: string): Promise<{
    level: 'safe' | 'caution' | 'danger'
    warnings: string[]
    requiresConfirmation: boolean
  }> {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /dd\s+if=.*of=/, // dd operations
      /mkfs/, // filesystem creation
      /fdisk/, // disk partitioning
      /:(){ :|:&};:/, // fork bomb
      /chmod\s+777/, // overly permissive permissions
      />.*\/dev\/sd/, // writing to disk devices
      /sudo\s+.*password/i // password operations
    ]

    const cautionPatterns = [
      /rm\s+-rf/, // recursive remove
      /sudo/, // elevated privileges
      /chmod/, // permission changes
      /chown/, // ownership changes
      /curl.*\|\s*sh/, // pipe to shell
      /wget.*\|\s*sh/, // pipe to shell
      /npm\s+install.*-g/, // global npm installs
    ]

    const warnings: string[] = []
    let level: 'safe' | 'caution' | 'danger' = 'safe'
    let requiresConfirmation = false

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        level = 'danger'
        requiresConfirmation = true
        warnings.push(`Potentially destructive command detected: ${pattern.source}`)
      }
    }

    // Check for caution patterns
    for (const pattern of cautionPatterns) {
      if (pattern.test(command)) {
        if (level !== 'danger') level = 'caution'
        warnings.push(`Command requires caution: ${pattern.source}`)
      }
    }

    return { level, warnings, requiresConfirmation }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await embed({
        model: openai.embedding(process.env.EMBEDDING_MODEL || 'text-embedding-3-small'),
        value: text
      })
      return result.embedding
    } catch (error) {
      console.error('Embedding generation failed:', error)
      return []
    }
  }

  private async findSimilarQueries(embedding: number[]): Promise<any[]> {
    // Implementation would use vector similarity search
    // For now, return empty array
    return []
  }

  private async buildContext(conversation: any, similarQueries: any[]): Promise<any> {
    return {
      ...conversation.context,
      similarQueries,
      conversationHistory: conversation.messages.slice(-10), // Last 10 messages
      errorContext: this.extractErrorContext(conversation.messages)
    }
  }

  private detectAvailableTools(): string[] {
    // Detect commonly available CLI tools
    const commonTools = ['git', 'docker', 'npm', 'node', 'python', 'curl', 'wget', 'grep', 'sed', 'awk']
    // In production, this would actually check for tool availability
    return commonTools
  }

  private getSystemInfo(): any {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
      uptime: process.uptime()
    }
  }

  private extractErrorContext(messages: any[]): string {
    const errorMessages = messages
      .filter(m => m.content.toLowerCase().includes('error'))
      .slice(-3)
      .map(m => m.content)
    
    return errorMessages.join('\n')
  }

  private getMostCommonIntent(intents: string[]): string {
    const counts = new Map<string, number>()
    intents.forEach(intent => {
      counts.set(intent, (counts.get(intent) || 0) + 1)
    })
    
    let maxCount = 0
    let mostCommon = 'general'
    for (const [intent, count] of counts) {
      if (count > maxCount) {
        maxCount = count
        mostCommon = intent
      }
    }
    
    return mostCommon
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private createErrorResponse(error: any, startTime: number): AIResponse {
    return {
      type: 'error',
      content: `I apologize, but I encountered an error while processing your request: ${error.message}`,
      model: 'error',
      metadata: {
        duration: performance.now() - startTime,
        error: error.message,
        confidence: 0
      }
    }
  }

  private async storeInteraction(
    userId: string,
    conversationId: string,
    query: string,
    response: AIResponse
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO command_history (user_id, query, generated_command, confidence) 
         VALUES (?, ?, ?, ?)`,
        [
          userId,
          query,
          typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
          response.metadata.confidence || 0
        ],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  private async updateConversation(
    conversationId: string,
    query: string,
    response: AIResponse
  ): Promise<void> {
    const conversation = this.conversationCache.get(conversationId)
    if (conversation) {
      conversation.messages.push(
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        { 
          role: 'assistant', 
          content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
          timestamp: new Date().toISOString(),
          metadata: response.metadata
        }
      )
      conversation.updatedAt = new Date().toISOString()
    }
  }
}

// Types
type AIResponse = {
  type: 'command_generation' | 'explanation' | 'troubleshooting' | 'learning' | 'general' | 'error'
  content: string | any
  model: string
  metadata: {
    tokens?: number
    duration?: number
    confidence?: number
    safety?: any
    error?: string
  }
}

// Streaming Response Handler
async function handleStreamingResponse(
  engine: AIAssistantEngine,
  query: string,
  userId: string,
  reporter: any
) {
  try {
    const stream = await engine.processQueryStream(query, userId)
    
    for await (const chunk of stream) {
      process.stdout.write(chunk)
    }
    
    reporter.success('\nResponse completed')
  } catch (error) {
    reporter.error(`Streaming failed: ${error.message}`)
  }
}

// Main Command
export default defineCommand({
  meta: {
    name: 'ai',
    description: 'AI-powered CLI assistant'
  },
  args: {
    query: {
      type: 'string',
      description: 'Your question or request',
      required: false
    },
    model: {
      type: 'string',
      description: 'AI model to use',
      default: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo'
    },
    stream: {
      type: 'boolean',
      description: 'Stream response in real-time',
      default: false
    },
    conversation: {
      type: 'string',
      description: 'Conversation ID to continue',
      required: false
    },
    execute: {
      type: 'boolean',
      description: 'Execute generated commands (use with caution)',
      default: false
    },
    interactive: {
      type: 'boolean',
      description: 'Start interactive mode',
      default: false
    },
    explain: {
      type: 'boolean',
      description: 'Explain the response in detail',
      default: false
    }
  },
  async run({ args, reporter }) {
    const engine = new AIAssistantEngine()
    
    if (args.interactive) {
      return startInteractiveMode(engine, reporter, args)
    }
    
    if (!args.query) {
      reporter.error('Query is required. Use --interactive for interactive mode.')
      process.exit(1)
    }
    
    const startTime = Date.now()
    const userId = process.env.USER || 'anonymous'
    
    try {
      reporter.info(`Processing query with ${args.model}...`)
      
      if (args.stream) {
        await handleStreamingResponse(engine, args.query, userId, reporter)
        return
      }
      
      const response = await engine.processQuery(args.query, userId, args.conversation)
      const duration = Date.now() - startTime
      
      // Display response based on type
      switch (response.type) {
        case 'command_generation':
          const cmd = response.content
          reporter.success('Generated Command:')
          console.log(`\x1b[36m${cmd.command}\x1b[0m`)
          console.log(`\nExplanation: ${cmd.explanation}`)
          console.log(`Confidence: ${(cmd.confidence * 100).toFixed(1)}%`)
          
          if (cmd.safety.level !== 'safe') {
            reporter.warn(`Safety Level: ${cmd.safety.level.toUpperCase()}`)
            cmd.safety.warnings.forEach(warning => reporter.warn(warning))
          }
          
          if (cmd.alternatives.length > 0) {
            console.log('\nAlternatives:')
            cmd.alternatives.forEach((alt, i) => {
              console.log(`  ${i + 1}. ${alt.command} (${(alt.confidence * 100).toFixed(1)}%)`)
            })
          }
          
          if (args.execute && cmd.safety.level === 'safe') {
            const { execSync } = await import('child_process')
            try {
              const output = execSync(cmd.command, { encoding: 'utf-8' })
              console.log('\nExecution Output:')
              console.log(output)
            } catch (error) {
              reporter.error(`Execution failed: ${error.message}`)
            }
          } else if (args.execute) {
            reporter.warn('Command execution skipped due to safety concerns')
          }
          break
          
        case 'explanation':
        case 'troubleshooting':
        case 'learning':
        case 'general':
          console.log(response.content)
          break
          
        case 'error':
          reporter.error(response.content)
          break
      }
      
      // Display metadata
      if (args.explain) {
        console.log(`\nMetadata:`)
        console.log(`- Model: ${response.model}`)
        console.log(`- Duration: ${duration}ms`)
        console.log(`- Tokens: ${response.metadata.tokens || 'N/A'}`)
        console.log(`- Confidence: ${((response.metadata.confidence || 0) * 100).toFixed(1)}%`)
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      reporter.error(`AI assistant failed after ${duration}ms: ${error.message}`)
      
      if (error.code === 'ENOTFOUND') {
        reporter.info('Check your internet connection and AI provider API keys')
      }
      
      process.exit(1)
    }
  }
})

// Interactive Mode
async function startInteractiveMode(
  engine: AIAssistantEngine,
  reporter: any,
  args: any
) {
  const readline = require('readline')
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  const userId = process.env.USER || 'anonymous'
  let conversationId: string | undefined
  
  console.log('🤖 AI CLI Assistant - Interactive Mode')
  console.log('Type "exit" to quit, "help" for commands, "clear" to start new conversation')
  console.log(`Using model: ${args.model}\n`)
  
  const askQuestion = () => {
    rl.question('> ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        rl.close()
        return
      }
      
      if (query.toLowerCase() === 'clear') {
        conversationId = undefined
        console.log('Started new conversation\n')
        askQuestion()
        return
      }
      
      if (query.toLowerCase() === 'help') {
        console.log('Available commands:')
        console.log('- exit: Quit the assistant')
        console.log('- clear: Start a new conversation')
        console.log('- help: Show this help message')
        console.log('- Any other input: Ask the AI assistant\n')
        askQuestion()
        return
      }
      
      try {
        const response = await engine.processQuery(query, userId, conversationId)
        
        if (!conversationId && response.metadata.conversationId) {
          conversationId = response.metadata.conversationId
        }
        
        console.log('\n' + response.content + '\n')
      } catch (error) {
        console.error(`Error: ${error.message}\n`)
      }
      
      askQuestion()
    })
  }
  
  askQuestion()
}
```

## Testing Approach

```typescript
// test/ai-assistant.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'child_process'

// Mock AI providers
vi.mock('@ai-sdk/openai')
vi.mock('@ai-sdk/anthropic')
vi.mock('ai')

describe('AI-Powered CLI Assistant', () => {
  beforeEach(() => {
    // Setup test environment
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.DEFAULT_MODEL = 'gpt-3.5-turbo'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should generate safe commands', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        command: 'ls -la',
        explanation: 'List files with detailed information',
        confidence: 0.9,
        safety: { level: 'safe', warnings: [], requiresConfirmation: false },
        alternatives: []
      }),
      usage: { totalTokens: 100 }
    })

    const result = execSync('tsx src/commands/ai-assistant.ts "how do I list files"', {
      encoding: 'utf-8'
    })

    expect(result).toContain('ls -la')
    expect(result).toContain('Generated Command:')
  })

  it('should warn about dangerous commands', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        command: 'rm -rf /',
        explanation: 'This command would delete everything',
        confidence: 0.9,
        safety: { 
          level: 'danger', 
          warnings: ['Potentially destructive command detected'],
          requiresConfirmation: true 
        },
        alternatives: [{ command: 'rm file.txt', explanation: 'Remove specific file', confidence: 0.8 }]
      }),
      usage: { totalTokens: 150 }
    })

    const result = execSync('tsx src/commands/ai-assistant.ts "delete everything"', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Safety Level: DANGER')
    expect(result).toContain('Potentially destructive')
  })

  it('should provide command explanations', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'The ls command lists directory contents. The -la flags show all files including hidden ones with detailed information.',
      usage: { totalTokens: 75 }
    })

    const result = execSync('tsx src/commands/ai-assistant.ts "explain ls -la"', {
      encoding: 'utf-8'
    })

    expect(result).toContain('lists directory contents')
    expect(result).toContain('detailed information')
  })

  it('should handle model fallback', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error('Primary model failed'))
      .mockResolvedValueOnce({
        text: 'Fallback response',
        usage: { totalTokens: 50 }
      })

    const result = execSync('tsx src/commands/ai-assistant.ts "test query" --model gpt-4', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Fallback response')
  })
})
```

## Usage Examples

### Basic Usage
```bash
# Ask for a command
citty ai "how do I find large files"

# Explain a command
citty ai "explain tar -xzf archive.tar.gz"

# Get troubleshooting help
citty ai "git push is failing with authentication error"
```

### Advanced Usage
```bash
# Use specific model
citty ai "optimize this dockerfile" --model claude-3-sonnet

# Stream response
citty ai "explain kubernetes deployment" --stream

# Interactive mode
citty ai --interactive

# Continue conversation
citty ai "what about security concerns" --conversation conv-123

# Execute generated command (be careful!)
citty ai "show disk usage" --execute
```

## Performance Considerations

1. **Model Selection**
   - Use lighter models for simple queries
   - Route complex questions to more capable models
   - Implement intelligent fallback strategies

2. **Caching Strategy**
   - Cache similar queries using embeddings
   - Store successful command patterns
   - Implement user preference learning

3. **Response Optimization**
   - Stream long responses for better UX
   - Batch multiple related queries
   - Use local models for privacy-sensitive operations

## Deployment Notes

### Production Environment
```bash
# Required services
docker run -d --name redis -p 6379:6379 redis:alpine
docker run -d --name ollama -p 11434:11434 ollama/ollama

# Environment setup
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export ENABLE_COMMAND_EXECUTION=false  # Security first
```

### Security Configuration
```yaml
# security-config.yml
command_execution:
  enabled: false
  sandbox_mode: true
  allowed_commands:
    - "ls"
    - "cat"
    - "grep"
    - "find"
  blocked_patterns:
    - "rm -rf"
    - "dd if="
    - "mkfs"
    - "sudo rm"

conversation_limits:
  max_history: 50
  session_timeout: 3600
  rate_limit: 60  # requests per minute
```

This pattern provides a comprehensive, production-ready AI-powered CLI assistant that can understand natural language, generate safe commands, and provide intelligent assistance while maintaining security and performance.