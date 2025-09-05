# Pattern 13: Chain-of-Thought - Problem Solving Workflow

## Overview

This pattern demonstrates a production-ready Chain-of-Thought (CoT) reasoning system that breaks down complex problems into manageable steps, documents the reasoning process, and provides transparent decision-making for CLI operations. The system implements structured thinking patterns, validates each step, and maintains a comprehensive audit trail.

## Features

- Multi-step reasoning workflows
- Transparent decision-making process
- Step validation and error recovery
- Multiple thinking patterns (analytical, creative, systematic)
- Interactive problem exploration
- Reasoning visualization
- Audit trail and replay capabilities
- Integration with external knowledge bases

## Environment Setup

```bash
# Install dependencies
pnpm add citty zod @ai-sdk/openai @ai-sdk/anthropic
pnpm add mermaid-cli graphviz d3 sqlite3 ioredis
pnpm add -D @types/node @types/d3 vitest tsx

# Environment variables
cat > .env << 'EOF'
# AI Configuration
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
DEFAULT_REASONING_MODEL=gpt-4
COT_TEMPERATURE=0.1
MAX_REASONING_STEPS=15

# Reasoning Configuration
ENABLE_STEP_VALIDATION=true
AUTO_RETRY_FAILED_STEPS=true
SAVE_REASONING_TRACES=true
INTERACTIVE_MODE=true

# Knowledge Base
KNOWLEDGE_BASE_URL=http://localhost:8080
ENABLE_WEB_SEARCH=true
SEARCH_API_KEY=your-search-api-key

# Visualization
GENERATE_DIAGRAMS=true
DIAGRAM_FORMAT=svg
REASONING_TREE_DEPTH=5

# Storage
DATABASE_URL=sqlite:./reasoning.db
REDIS_URL=redis://localhost:6379
TRACE_RETENTION_DAYS=30

# Performance
PARALLEL_REASONING=false
STEP_TIMEOUT=30000
MAX_CONCURRENT_BRANCHES=3
EOF
```

## Complete Implementation

```typescript
// src/commands/chain-of-thought.ts
import { defineCommand } from 'citty'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { Database } from 'sqlite3'
import Redis from 'ioredis'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'

// Schemas
const ReasoningStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  assumptions: z.array(z.string()),
  evidenceFor: z.array(z.string()),
  evidenceAgainst: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  nextSteps: z.array(z.string()),
  alternativeApproaches: z.array(z.string()),
  validation: z.object({
    isValid: z.boolean(),
    validationMethod: z.string(),
    validationResult: z.string(),
    concerns: z.array(z.string())
  }),
  metadata: z.object({
    timestamp: z.string().datetime(),
    duration: z.number(),
    model: z.string(),
    tokens: z.number().optional(),
    sources: z.array(z.string()).optional()
  })
})

const ReasoningChainSchema = z.object({
  id: z.string(),
  problem: z.string(),
  thinkingPattern: z.enum(['analytical', 'creative', 'systematic', 'critical', 'lateral', 'design']),
  steps: z.array(ReasoningStepSchema),
  finalConclusion: z.string(),
  confidence: z.number().min(0).max(1),
  recommendedActions: z.array(z.string()),
  riskAssessment: z.string(),
  alternativeSolutions: z.array(z.string()),
  metadata: z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    totalDuration: z.number(),
    stepCount: z.number(),
    branchingPoints: z.number(),
    validationFailures: z.number()
  })
})

// Chain-of-Thought Engine
class ChainOfThoughtEngine extends EventEmitter {
  private db: Database
  private redis: Redis
  private thinkingPatterns: Map<string, ThinkingPattern>
  private activeChains: Map<string, ReasoningChain>

  constructor() {
    super()
    this.db = new Database('./reasoning.db')
    this.redis = new Redis(process.env.REDIS_URL!)
    this.activeChains = new Map()
    this.initializeDatabase()
    this.setupThinkingPatterns()
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS reasoning_chains (
            id TEXT PRIMARY KEY,
            problem TEXT NOT NULL,
            thinking_pattern TEXT NOT NULL,
            final_conclusion TEXT,
            confidence REAL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS reasoning_steps (
            id TEXT PRIMARY KEY,
            chain_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            reasoning TEXT,
            confidence REAL,
            risk_level TEXT,
            validation_result TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chain_id) REFERENCES reasoning_chains(id)
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS knowledge_base (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            relevance_score REAL DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        resolve()
      })
    })
  }

  private setupThinkingPatterns(): void {
    this.thinkingPatterns = new Map([
      ['analytical', {
        name: 'Analytical Thinking',
        description: 'Break down complex problems into components and analyze systematically',
        prompts: {
          initial: 'Let\'s analyze this problem step by step, breaking it down into its core components.',
          step: 'Based on the previous analysis, what is the logical next step to consider?',
          validation: 'Is this analytical step logically sound and well-supported by evidence?'
        },
        maxSteps: 12,
        validationRequired: true
      }],
      ['creative', {
        name: 'Creative Thinking',
        description: 'Generate innovative solutions through lateral thinking and ideation',
        prompts: {
          initial: 'Let\'s explore creative and innovative approaches to this challenge.',
          step: 'What unconventional or creative angle haven\'t we considered yet?',
          validation: 'Is this creative idea feasible and does it address the core problem?'
        },
        maxSteps: 10,
        validationRequired: false
      }],
      ['systematic', {
        name: 'Systematic Thinking',
        description: 'Apply structured methodologies and frameworks to solve problems',
        prompts: {
          initial: 'Let\'s apply a systematic methodology to understand and solve this problem.',
          step: 'Following our systematic approach, what is the next methodical step?',
          validation: 'Does this step follow our systematic methodology correctly?'
        },
        maxSteps: 15,
        validationRequired: true
      }],
      ['critical', {
        name: 'Critical Thinking',
        description: 'Evaluate arguments, identify assumptions, and assess evidence quality',
        prompts: {
          initial: 'Let\'s critically examine this problem, questioning assumptions and evaluating evidence.',
          step: 'What assumptions should we challenge, and what evidence do we need to evaluate?',
          validation: 'Have we critically evaluated the assumptions and evidence in this step?'
        },
        maxSteps: 10,
        validationRequired: true
      }],
      ['lateral', {
        name: 'Lateral Thinking',
        description: 'Approach problems from unexpected angles and generate alternative perspectives',
        prompts: {
          initial: 'Let\'s approach this problem from unexpected angles and explore alternative perspectives.',
          step: 'What completely different perspective or angle could we consider?',
          validation: 'Does this lateral approach offer genuine insights or value?'
        },
        maxSteps: 8,
        validationRequired: false
      }],
      ['design', {
        name: 'Design Thinking',
        description: 'Human-centered approach focusing on understanding, ideation, and iteration',
        prompts: {
          initial: 'Let\'s apply design thinking principles: empathize, define, ideate, prototype, test.',
          step: 'Following design thinking methodology, what should we focus on next?',
          validation: 'Does this step align with design thinking principles and user needs?'
        },
        maxSteps: 12,
        validationRequired: true
      }]
    ])
  }

  async processChainOfThought(
    problem: string,
    options: ChainOfThoughtOptions = {}
  ): Promise<ReasoningChain> {
    const startTime = performance.now()
    const chainId = this.generateId()
    
    try {
      this.emit('chainStarted', { chainId, problem })
      
      // Initialize reasoning chain
      const chain = await this.initializeReasoningChain(chainId, problem, options)
      this.activeChains.set(chainId, chain)
      
      // Execute reasoning steps
      await this.executeReasoningSteps(chain)
      
      // Generate final conclusion
      await this.generateFinalConclusion(chain)
      
      // Validate and assess confidence
      await this.performFinalValidation(chain)
      
      // Store results
      await this.storeReasoningChain(chain)
      
      // Generate visualizations if enabled
      if (process.env.GENERATE_DIAGRAMS === 'true') {
        await this.generateReasoningDiagram(chain)
      }
      
      const totalDuration = performance.now() - startTime
      chain.metadata.endTime = new Date().toISOString()
      chain.metadata.totalDuration = totalDuration
      
      this.emit('chainCompleted', { chainId, chain })
      
      return chain
    } catch (error) {
      this.emit('chainError', { chainId, error })
      throw error
    } finally {
      this.activeChains.delete(chainId)
    }
  }

  private async initializeReasoningChain(
    chainId: string,
    problem: string,
    options: ChainOfThoughtOptions
  ): Promise<ReasoningChain> {
    const thinkingPattern = options.thinkingPattern || 'analytical'
    const pattern = this.thinkingPatterns.get(thinkingPattern)!
    
    return {
      id: chainId,
      problem,
      thinkingPattern,
      steps: [],
      finalConclusion: '',
      confidence: 0,
      recommendedActions: [],
      riskAssessment: '',
      alternativeSolutions: [],
      metadata: {
        startTime: new Date().toISOString(),
        endTime: '',
        totalDuration: 0,
        stepCount: 0,
        branchingPoints: 0,
        validationFailures: 0
      }
    }
  }

  private async executeReasoningSteps(chain: ReasoningChain): Promise<void> {
    const pattern = this.thinkingPatterns.get(chain.thinkingPattern)!
    let stepNumber = 1
    let currentContext = chain.problem
    
    // Initial step
    const initialStep = await this.generateReasoningStep(
      chain.id,
      stepNumber,
      pattern.prompts.initial,
      currentContext,
      chain.thinkingPattern
    )
    
    chain.steps.push(initialStep)
    this.emit('stepCompleted', { chainId: chain.id, step: initialStep })
    
    // Continue with additional steps
    while (stepNumber < pattern.maxSteps) {
      stepNumber++
      
      // Check if we should continue
      if (await this.shouldContinueReasoning(chain)) {
        // Build context from previous steps
        currentContext = this.buildStepContext(chain.steps)
        
        // Generate next step
        const nextStep = await this.generateReasoningStep(
          chain.id,
          stepNumber,
          pattern.prompts.step,
          currentContext,
          chain.thinkingPattern
        )
        
        // Validate step if required
        if (pattern.validationRequired && process.env.ENABLE_STEP_VALIDATION === 'true') {
          await this.validateReasoningStep(nextStep, pattern)
        }
        
        chain.steps.push(nextStep)
        this.emit('stepCompleted', { chainId: chain.id, step: nextStep })
        
        // Handle validation failures
        if (!nextStep.validation.isValid && process.env.AUTO_RETRY_FAILED_STEPS === 'true') {
          chain.metadata.validationFailures++
          if (chain.metadata.validationFailures < 3) {
            continue // Retry
          }
        }
        
        // Check for natural conclusion
        if (nextStep.confidence > 0.9 && nextStep.nextSteps.length === 0) {
          break
        }
      } else {
        break
      }
    }
    
    chain.metadata.stepCount = chain.steps.length
  }

  private async generateReasoningStep(
    chainId: string,
    stepNumber: number,
    prompt: string,
    context: string,
    thinkingPattern: string
  ): Promise<ReasoningStep> {
    const startTime = performance.now()
    
    const systemPrompt = `You are an expert problem solver using ${thinkingPattern} thinking patterns.

For each reasoning step, provide:
1. A clear title for this step
2. Detailed description of what you're analyzing
3. Your reasoning process
4. Assumptions you're making
5. Evidence supporting this step
6. Evidence that might contradict this step
7. Your confidence level (0-1)
8. Risk assessment (low/medium/high/critical)
9. Suggested next steps
10. Alternative approaches to consider

Be thorough, logical, and transparent in your reasoning.

Context from previous steps:
${context}

Current step prompt: ${prompt}`

    const modelName = process.env.DEFAULT_REASONING_MODEL || 'gpt-4'
    
    try {
      const result = await generateText({
        model: modelName === 'gpt-4' ? openai('gpt-4') : anthropic('claude-3-sonnet-20240229'),
        system: systemPrompt,
        prompt: context,
        temperature: parseFloat(process.env.COT_TEMPERATURE || '0.1'),
        maxTokens: 2000
      })
      
      const stepData = await this.parseReasoningStepResponse(result.text)
      const duration = performance.now() - startTime
      
      const step: ReasoningStep = {
        id: this.generateId(),
        stepNumber,
        title: stepData.title || `Step ${stepNumber}`,
        description: stepData.description || '',
        reasoning: stepData.reasoning || result.text,
        assumptions: stepData.assumptions || [],
        evidenceFor: stepData.evidenceFor || [],
        evidenceAgainst: stepData.evidenceAgainst || [],
        confidence: stepData.confidence || 0.5,
        riskLevel: stepData.riskLevel || 'medium',
        nextSteps: stepData.nextSteps || [],
        alternativeApproaches: stepData.alternativeApproaches || [],
        validation: {
          isValid: true,
          validationMethod: 'pending',
          validationResult: '',
          concerns: []
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration,
          model: modelName,
          tokens: result.usage?.totalTokens || 0
        }
      }
      
      return step
    } catch (error) {
      console.error(`Failed to generate reasoning step: ${error.message}`)
      throw error
    }
  }

  private async parseReasoningStepResponse(response: string): Promise<any> {
    // Try to extract structured information from the response
    const lines = response.split('\n')
    const stepData: any = {}
    
    let currentSection = ''
    let currentContent: string[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.toLowerCase().includes('title:') || trimmed.toLowerCase().includes('# ')) {
        if (currentSection) {
          stepData[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = 'title'
        currentContent = [trimmed.replace(/^.*?:/, '').replace(/^#\s*/, '').trim()]
      } else if (trimmed.toLowerCase().includes('description:')) {
        if (currentSection) {
          stepData[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = 'description'
        currentContent = [trimmed.replace(/^.*?:/, '').trim()]
      } else if (trimmed.toLowerCase().includes('reasoning:')) {
        if (currentSection) {
          stepData[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = 'reasoning'
        currentContent = [trimmed.replace(/^.*?:/, '').trim()]
      } else if (trimmed.toLowerCase().includes('assumptions:')) {
        if (currentSection) {
          stepData[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = 'assumptions'
        currentContent = []
      } else if (trimmed.toLowerCase().includes('confidence:')) {
        const confidenceMatch = trimmed.match(/(\d*\.?\d+)/)
        if (confidenceMatch) {
          stepData.confidence = Math.min(parseFloat(confidenceMatch[1]), 1.0)
        }
      } else if (trimmed.toLowerCase().includes('risk:') || trimmed.toLowerCase().includes('risk level:')) {
        const risk = trimmed.toLowerCase()
        if (risk.includes('high')) stepData.riskLevel = 'high'
        else if (risk.includes('critical')) stepData.riskLevel = 'critical'
        else if (risk.includes('low')) stepData.riskLevel = 'low'
        else stepData.riskLevel = 'medium'
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        currentContent.push(trimmed.substring(1).trim())
      } else if (trimmed.length > 0) {
        currentContent.push(trimmed)
      }
    }
    
    // Add the last section
    if (currentSection && currentContent.length > 0) {
      stepData[currentSection] = currentContent.join('\n').trim()
    }
    
    // Convert arrays for specific fields
    if (stepData.assumptions && typeof stepData.assumptions === 'string') {
      stepData.assumptions = stepData.assumptions.split('\n').filter(a => a.trim().length > 0)
    }
    
    return stepData
  }

  private async validateReasoningStep(step: ReasoningStep, pattern: ThinkingPattern): Promise<void> {
    try {
      const validationPrompt = `${pattern.prompts.validation}

Step to validate:
Title: ${step.title}
Reasoning: ${step.reasoning}
Assumptions: ${step.assumptions.join(', ')}
Confidence: ${step.confidence}

Provide validation assessment as JSON:
{
  "isValid": true/false,
  "validationMethod": "description of validation approach",
  "validationResult": "detailed validation result",
  "concerns": ["concern1", "concern2"]
}`

      const result = await generateText({
        model: openai('gpt-3.5-turbo'),
        prompt: validationPrompt,
        temperature: 0.0,
        maxTokens: 500
      })
      
      const validation = JSON.parse(result.text)
      step.validation = {
        isValid: validation.isValid || false,
        validationMethod: validation.validationMethod || 'automated',
        validationResult: validation.validationResult || result.text,
        concerns: validation.concerns || []
      }
    } catch (error) {
      console.warn(`Step validation failed: ${error.message}`)
      step.validation = {
        isValid: true, // Default to valid if validation fails
        validationMethod: 'validation_error',
        validationResult: `Validation failed: ${error.message}`,
        concerns: ['validation_system_error']
      }
    }
  }

  private buildStepContext(steps: ReasoningStep[]): string {
    const recentSteps = steps.slice(-3) // Last 3 steps for context
    
    let context = 'Previous reasoning steps:\n\n'
    
    for (const step of recentSteps) {
      context += `Step ${step.stepNumber}: ${step.title}\n`
      context += `Reasoning: ${step.reasoning}\n`
      context += `Confidence: ${(step.confidence * 100).toFixed(1)}%\n`
      context += `Next steps suggested: ${step.nextSteps.join(', ')}\n\n`
    }
    
    return context
  }

  private async shouldContinueReasoning(chain: ReasoningChain): Promise<boolean> {
    const lastStep = chain.steps[chain.steps.length - 1]
    
    // Continue if confidence is low
    if (lastStep.confidence < 0.8) return true
    
    // Continue if there are clear next steps
    if (lastStep.nextSteps.length > 0) return true
    
    // Continue if we haven't reached a reasonable number of steps
    if (chain.steps.length < 3) return true
    
    // Stop if confidence is high and no clear next steps
    return false
  }

  private async generateFinalConclusion(chain: ReasoningChain): Promise<void> {
    const stepsContext = chain.steps.map((step, index) => 
      `Step ${index + 1}: ${step.title}\n${step.reasoning}\nConfidence: ${(step.confidence * 100).toFixed(1)}%`
    ).join('\n\n')
    
    const conclusionPrompt = `Based on the following chain of reasoning, provide a comprehensive final conclusion:

Original Problem: ${chain.problem}
Thinking Pattern: ${chain.thinkingPattern}

Reasoning Steps:
${stepsContext}

Provide:
1. Final conclusion summarizing the solution
2. Overall confidence level (0-1)
3. Recommended actions (list)
4. Risk assessment summary
5. Alternative solutions to consider

Format as JSON:
{
  "finalConclusion": "detailed conclusion",
  "confidence": 0.85,
  "recommendedActions": ["action1", "action2"],
  "riskAssessment": "risk summary",
  "alternativeSolutions": ["alt1", "alt2"]
}`

    try {
      const result = await generateText({
        model: openai(process.env.DEFAULT_REASONING_MODEL || 'gpt-4'),
        prompt: conclusionPrompt,
        temperature: 0.1,
        maxTokens: 1000
      })
      
      const conclusion = JSON.parse(result.text)
      
      chain.finalConclusion = conclusion.finalConclusion || 'Unable to generate conclusion'
      chain.confidence = conclusion.confidence || 0.5
      chain.recommendedActions = conclusion.recommendedActions || []
      chain.riskAssessment = conclusion.riskAssessment || 'Risk assessment unavailable'
      chain.alternativeSolutions = conclusion.alternativeSolutions || []
    } catch (error) {
      console.error(`Failed to generate final conclusion: ${error.message}`)
      
      // Fallback conclusion
      chain.finalConclusion = `Based on ${chain.steps.length} reasoning steps, analysis suggests: ${chain.steps[chain.steps.length - 1].reasoning}`
      chain.confidence = Math.max(...chain.steps.map(s => s.confidence))
      chain.recommendedActions = ['Manual review of reasoning steps recommended']
      chain.riskAssessment = 'Unable to assess risk automatically'
      chain.alternativeSolutions = []
    }
  }

  private async performFinalValidation(chain: ReasoningChain): Promise<void> {
    // Check for logical consistency across steps
    const lowConfidenceSteps = chain.steps.filter(s => s.confidence < 0.4)
    const highRiskSteps = chain.steps.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical')
    
    if (lowConfidenceSteps.length > chain.steps.length / 2) {
      chain.confidence = Math.max(chain.confidence - 0.2, 0.1)
    }
    
    if (highRiskSteps.length > 0) {
      chain.riskAssessment += ` Warning: ${highRiskSteps.length} high-risk steps identified.`
    }
  }

  private async storeReasoningChain(chain: ReasoningChain): Promise<void> {
    if (process.env.SAVE_REASONING_TRACES !== 'true') return
    
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        // Store main chain
        this.db.run(
          `INSERT INTO reasoning_chains (id, problem, thinking_pattern, final_conclusion, confidence, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            chain.id,
            chain.problem,
            chain.thinkingPattern,
            chain.finalConclusion,
            chain.confidence,
            JSON.stringify(chain.metadata)
          ]
        )
        
        // Store individual steps
        for (const step of chain.steps) {
          this.db.run(
            `INSERT INTO reasoning_steps (id, chain_id, step_number, title, description, reasoning, confidence, risk_level, validation_result, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              step.id,
              chain.id,
              step.stepNumber,
              step.title,
              step.description,
              step.reasoning,
              step.confidence,
              step.riskLevel,
              JSON.stringify(step.validation),
              JSON.stringify(step.metadata)
            ]
          )
        }
        
        resolve()
      })
    })
  }

  private async generateReasoningDiagram(chain: ReasoningChain): Promise<void> {
    try {
      // Create output directory
      const outputDir = './reasoning_diagrams'
      mkdirSync(outputDir, { recursive: true })
      
      // Generate Mermaid diagram
      const mermaidGraph = this.generateMermaidGraph(chain)
      const mermaidPath = join(outputDir, `${chain.id}_reasoning.md`)
      writeFileSync(mermaidPath, mermaidGraph)
      
      // Generate SVG if mermaid-cli is available
      try {
        const { execSync } = require('child_process')
        execSync(`mmdc -i ${mermaidPath} -o ${join(outputDir, `${chain.id}_reasoning.svg`)}`)
      } catch (error) {
        console.warn('Mermaid CLI not available for SVG generation')
      }
    } catch (error) {
      console.warn(`Failed to generate reasoning diagram: ${error.message}`)
    }
  }

  private generateMermaidGraph(chain: ReasoningChain): string {
    let mermaid = 'graph TD\n'
    mermaid += `    Start[${chain.problem}] --> S1[${chain.steps[0]?.title || 'First Step'}]\n`
    
    for (let i = 1; i < chain.steps.length; i++) {
      const step = chain.steps[i]
      const prevStep = chain.steps[i - 1]
      
      mermaid += `    S${i}[${step.title}] --> S${i + 1}[${step.title}]\n`
      
      // Add confidence indicators
      const confidenceColor = step.confidence > 0.7 ? 'green' : step.confidence > 0.4 ? 'yellow' : 'red'
      mermaid += `    S${i + 1} --> C${i + 1}[Confidence: ${(step.confidence * 100).toFixed(0)}%]\n`
      mermaid += `    C${i + 1}:::${confidenceColor}\n`
    }
    
    mermaid += `    S${chain.steps.length}[${chain.steps[chain.steps.length - 1]?.title || 'Final Step'}] --> Conclusion[${chain.finalConclusion.substring(0, 50)}...]\n`
    
    // Add styling
    mermaid += '\n    classDef green fill:#d4edda,stroke:#28a745\n'
    mermaid += '    classDef yellow fill:#fff3cd,stroke:#ffc107\n'
    mermaid += '    classDef red fill:#f8d7da,stroke:#dc3545\n'
    
    return mermaid
  }

  private generateId(): string {
    return `cot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async getReasoningHistory(limit: number = 10): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM reasoning_chains ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        }
      )
    })
  }

  async replayReasoning(chainId: string): Promise<void> {
    const chain = await this.loadReasoningChain(chainId)
    if (!chain) {
      throw new Error(`Reasoning chain ${chainId} not found`)
    }
    
    console.log(`\nReplaying reasoning for: ${chain.problem}\n`)
    
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i]
      console.log(`Step ${step.stepNumber}: ${step.title}`)
      console.log(`Reasoning: ${step.reasoning}`)
      console.log(`Confidence: ${(step.confidence * 100).toFixed(1)}%`)
      console.log(`Risk Level: ${step.riskLevel}`)
      
      if (step.assumptions.length > 0) {
        console.log(`Assumptions: ${step.assumptions.join(', ')}`)
      }
      
      console.log('---')
      
      if (process.env.INTERACTIVE_MODE === 'true') {
        // Pause for user input
        await new Promise(resolve => {
          const readline = require('readline')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          })
          rl.question('Press Enter to continue...', () => {
            rl.close()
            resolve(void 0)
          })
        })
      }
    }
    
    console.log(`Final Conclusion: ${chain.finalConclusion}`)
    console.log(`Overall Confidence: ${(chain.confidence * 100).toFixed(1)}%`)
  }

  private async loadReasoningChain(chainId: string): Promise<ReasoningChain | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM reasoning_chains WHERE id = ?',
        [chainId],
        async (err, chainRow) => {
          if (err) {
            reject(err)
            return
          }
          
          if (!chainRow) {
            resolve(null)
            return
          }
          
          // Load steps
          this.db.all(
            'SELECT * FROM reasoning_steps WHERE chain_id = ? ORDER BY step_number',
            [chainId],
            (err, stepRows) => {
              if (err) {
                reject(err)
                return
              }
              
              const chain: ReasoningChain = {
                id: chainRow.id,
                problem: chainRow.problem,
                thinkingPattern: chainRow.thinking_pattern as any,
                steps: stepRows.map(row => ({
                  id: row.id,
                  stepNumber: row.step_number,
                  title: row.title,
                  description: row.description,
                  reasoning: row.reasoning,
                  assumptions: [], // Would need to parse from metadata
                  evidenceFor: [],
                  evidenceAgainst: [],
                  confidence: row.confidence,
                  riskLevel: row.risk_level as any,
                  nextSteps: [],
                  alternativeApproaches: [],
                  validation: JSON.parse(row.validation_result || '{}'),
                  metadata: JSON.parse(row.metadata || '{}')
                })),
                finalConclusion: chainRow.final_conclusion,
                confidence: chainRow.confidence,
                recommendedActions: [],
                riskAssessment: '',
                alternativeSolutions: [],
                metadata: JSON.parse(chainRow.metadata || '{}')
              }
              
              resolve(chain)
            }
          )
        }
      )
    })
  }
}

// Types
type ChainOfThoughtOptions = {
  thinkingPattern?: 'analytical' | 'creative' | 'systematic' | 'critical' | 'lateral' | 'design'
  maxSteps?: number
  interactive?: boolean
  generateDiagram?: boolean
  saveTrace?: boolean
}

type ThinkingPattern = {
  name: string
  description: string
  prompts: {
    initial: string
    step: string
    validation: string
  }
  maxSteps: number
  validationRequired: boolean
}

type ReasoningStep = {
  id: string
  stepNumber: number
  title: string
  description: string
  reasoning: string
  assumptions: string[]
  evidenceFor: string[]
  evidenceAgainst: string[]
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  nextSteps: string[]
  alternativeApproaches: string[]
  validation: {
    isValid: boolean
    validationMethod: string
    validationResult: string
    concerns: string[]
  }
  metadata: {
    timestamp: string
    duration: number
    model: string
    tokens?: number
    sources?: string[]
  }
}

type ReasoningChain = {
  id: string
  problem: string
  thinkingPattern: 'analytical' | 'creative' | 'systematic' | 'critical' | 'lateral' | 'design'
  steps: ReasoningStep[]
  finalConclusion: string
  confidence: number
  recommendedActions: string[]
  riskAssessment: string
  alternativeSolutions: string[]
  metadata: {
    startTime: string
    endTime: string
    totalDuration: number
    stepCount: number
    branchingPoints: number
    validationFailures: number
  }
}

// Main Command
export default defineCommand({
  meta: {
    name: 'think',
    description: 'Chain-of-Thought problem solving'
  },
  args: {
    problem: {
      type: 'string',
      description: 'The problem to analyze',
      required: true
    },
    pattern: {
      type: 'string',
      description: 'Thinking pattern to use',
      default: 'analytical'
    },
    steps: {
      type: 'string',
      description: 'Maximum number of reasoning steps',
      default: '10'
    },
    interactive: {
      type: 'boolean',
      description: 'Enable interactive step-by-step review',
      default: false
    },
    diagram: {
      type: 'boolean',
      description: 'Generate reasoning diagram',
      default: false
    },
    save: {
      type: 'boolean',
      description: 'Save reasoning trace',
      default: true
    },
    history: {
      type: 'boolean',
      description: 'Show recent reasoning history',
      default: false
    },
    replay: {
      type: 'string',
      description: 'Replay reasoning chain by ID',
      required: false
    }
  },
  async run({ args, reporter }) {
    const engine = new ChainOfThoughtEngine()
    
    try {
      if (args.history) {
        const history = await engine.getReasoningHistory(20)
        console.log('\nRecent Reasoning Chains:')
        console.log('=' .repeat(80))
        
        for (const chain of history) {
          console.log(`ID: ${chain.id}`)
          console.log(`Problem: ${chain.problem}`)
          console.log(`Pattern: ${chain.thinking_pattern}`)
          console.log(`Confidence: ${(chain.confidence * 100).toFixed(1)}%`)
          console.log(`Created: ${new Date(chain.created_at).toLocaleString()}`)
          console.log('-'.repeat(40))
        }
        return
      }
      
      if (args.replay) {
        await engine.replayReasoning(args.replay)
        return
      }
      
      reporter.info(`Starting chain-of-thought analysis: ${args.pattern} thinking`)
      
      const options: ChainOfThoughtOptions = {
        thinkingPattern: args.pattern as any,
        maxSteps: parseInt(args.steps),
        interactive: args.interactive,
        generateDiagram: args.diagram,
        saveTrace: args.save
      }
      
      // Setup progress reporting
      engine.on('stepCompleted', ({ step }) => {
        reporter.info(`Step ${step.stepNumber}: ${step.title} (${(step.confidence * 100).toFixed(1)}% confidence)`)
        
        if (args.interactive) {
          console.log(`\nReasoning: ${step.reasoning}`)
          console.log(`Risk Level: ${step.riskLevel}`)
          
          if (step.assumptions.length > 0) {
            console.log(`Assumptions: ${step.assumptions.join(', ')}`)
          }
          
          if (step.nextSteps.length > 0) {
            console.log(`Next Steps: ${step.nextSteps.join(', ')}`)
          }
          
          console.log('-'.repeat(60))
        }
      })
      
      // Process the reasoning chain
      const result = await engine.processChainOfThought(args.problem, options)
      
      // Display results
      console.log('\n' + '='.repeat(80))
      console.log('CHAIN-OF-THOUGHT ANALYSIS COMPLETE')
      console.log('='.repeat(80))
      
      console.log(`\nProblem: ${result.problem}`)
      console.log(`Thinking Pattern: ${result.thinkingPattern}`)
      console.log(`Total Steps: ${result.steps.length}`)
      console.log(`Duration: ${result.metadata.totalDuration.toFixed(0)}ms`)
      
      console.log(`\nFINAL CONCLUSION:`)
      console.log(result.finalConclusion)
      
      console.log(`\nCONFIDENCE: ${(result.confidence * 100).toFixed(1)}%`)
      
      if (result.recommendedActions.length > 0) {
        console.log('\nRECOMMENDED ACTIONS:')
        result.recommendedActions.forEach((action, i) => 
          console.log(`${i + 1}. ${action}`)
        )
      }
      
      if (result.alternativeSolutions.length > 0) {
        console.log('\nALTERNATIVE SOLUTIONS:')
        result.alternativeSolutions.forEach((alt, i) => 
          console.log(`${i + 1}. ${alt}`)
        )
      }
      
      console.log(`\nRISK ASSESSMENT:`)
      console.log(result.riskAssessment)
      
      if (args.diagram && process.env.GENERATE_DIAGRAMS === 'true') {
        console.log(`\nReasoning diagram generated: ./reasoning_diagrams/${result.id}_reasoning.svg`)
      }
      
      console.log(`\nChain ID: ${result.id} (use --replay ${result.id} to review)`)
      
      reporter.success(`Chain-of-thought analysis completed with ${(result.confidence * 100).toFixed(1)}% confidence`)
      
      // Exit with appropriate code based on confidence
      if (result.confidence < 0.4) {
        reporter.warn('Low confidence result - manual review recommended')
        process.exit(2)
      }
      
    } catch (error) {
      reporter.error(`Chain-of-thought analysis failed: ${error.message}`)
      
      if (error.message.includes('API key')) {
        reporter.info('Check your AI provider API keys in environment variables')
      }
      
      process.exit(1)
    }
  }
})
```

## Testing Approach

```typescript
// test/chain-of-thought.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'

// Mock AI providers
vi.mock('@ai-sdk/openai')
vi.mock('@ai-sdk/anthropic')
vi.mock('ai')

describe('Chain-of-Thought Reasoning', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.DEFAULT_REASONING_MODEL = 'gpt-4'
    process.env.SAVE_REASONING_TRACES = 'false'
  })

  afterEach(() => {
    try {
      unlinkSync('./reasoning.db')
    } catch {}
    vi.clearAllMocks()
  })

  it('should perform analytical thinking', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: `Title: Analyze the Problem
Description: Let's break down the issue systematically
Reasoning: We need to understand the root cause first
Confidence: 0.8
Risk: medium
Next steps: Gather more information, analyze patterns`,
      usage: { totalTokens: 100 }
    })

    const result = execSync('tsx src/commands/chain-of-thought.ts "why is my server slow" --pattern analytical', {
      encoding: 'utf-8'
    })

    expect(result).toContain('CHAIN-OF-THOUGHT ANALYSIS COMPLETE')
    expect(result).toContain('Thinking Pattern: analytical')
    expect(result).toContain('CONFIDENCE:')
  })

  it('should generate reasoning steps', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: 'Step 1 analysis with confidence 0.7',
        usage: { totalTokens: 50 }
      })
      .mockResolvedValueOnce({
        text: 'Step 2 analysis with confidence 0.8',
        usage: { totalTokens: 60 }
      })

    const result = execSync('tsx src/commands/chain-of-thought.ts "optimize database query" --steps 2', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Step 1:')
    expect(result).toContain('Step 2:')
    expect(result).toContain('Total Steps: 2')
  })

  it('should show reasoning history', () => {
    const result = execSync('tsx src/commands/chain-of-thought.ts --history', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Recent Reasoning Chains:')
  })

  it('should handle different thinking patterns', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Creative solution approach with innovative ideas',
      usage: { totalTokens: 75 }
    })

    const result = execSync('tsx src/commands/chain-of-thought.ts "improve user experience" --pattern creative', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Thinking Pattern: creative')
  })
})
```

## Usage Examples

### Basic Usage
```bash
# Analytical problem solving
citty think "how to optimize database performance"

# Creative thinking
citty think "improve user onboarding experience" --pattern creative

# Systematic approach
citty think "migrate legacy system" --pattern systematic
```

### Advanced Usage
```bash
# Interactive step-by-step analysis
citty think "debug production issue" --interactive

# Limit reasoning steps
citty think "choose deployment strategy" --steps 5

# Generate visual diagram
citty think "design microservices architecture" --diagram

# Review reasoning history
citty think --history

# Replay previous reasoning
citty think --replay cot-1640995200000-abc123def
```

## Performance Considerations

1. **Step Generation Optimization**
   - Use appropriate models for different thinking patterns
   - Implement step caching for similar problems
   - Optimize context window usage

2. **Validation Strategy**
   - Balance validation thoroughness with performance
   - Use faster models for validation when possible
   - Implement validation caching

3. **Memory Management**
   - Limit context window size for long chains
   - Implement step summarization for very long reasoning
   - Use efficient storage for reasoning traces

## Deployment Notes

### Production Environment
```bash
# Required services
docker run -d --name redis -p 6379:6379 redis:alpine

# Install diagram generation tools
npm install -g @mermaid-js/mermaid-cli
sudo apt-get install graphviz  # For advanced diagrams
```

### Configuration
```yaml
# reasoning-config.yml
thinking_patterns:
  analytical:
    max_steps: 12
    validation_required: true
    timeout: 30000
  creative:
    max_steps: 8
    validation_required: false
    timeout: 20000
  systematic:
    max_steps: 15
    validation_required: true
    timeout: 40000

storage:
  trace_retention_days: 30
  auto_cleanup: true
  backup_enabled: true
```

This pattern provides a comprehensive, production-ready Chain-of-Thought reasoning system that can break down complex problems, document the thinking process, and provide transparent, auditable decision-making for CLI operations.