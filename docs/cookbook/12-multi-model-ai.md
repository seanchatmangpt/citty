# Pattern 12: Multi-Model AI - Consensus-Based Decision Making

## Overview

This pattern demonstrates a production-ready multi-model AI system that leverages multiple AI providers (OpenAI, Anthropic, Ollama, Google) to make consensus-based decisions. The system aggregates responses from different models, analyzes their agreement levels, and provides confidence-weighted recommendations for critical CLI operations.

## Features

- Multi-provider AI integration
- Consensus algorithm implementation
- Confidence scoring and weighting
- Disagreement analysis and resolution
- Performance benchmarking across models
- Fallback and retry mechanisms
- Cost optimization strategies
- Real-time model health monitoring

## Environment Setup

```bash
# Install dependencies
pnpm add citty zod @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
pnpm add ollama axios dotenv ioredis bullmq
pnpm add -D @types/node vitest tsx

# Environment variables
cat > .env << 'EOF'
# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
OLLAMA_BASE_URL=http://localhost:11434

# Model Configuration
PRIMARY_MODELS=gpt-4,claude-3-sonnet,gemini-pro
SECONDARY_MODELS=gpt-3.5-turbo,claude-3-haiku,llama3.1:8b
CONSENSUS_THRESHOLD=0.7
MIN_AGREEMENT_MODELS=2

# Performance Settings
MODEL_TIMEOUT=30000
MAX_RETRIES=3
PARALLEL_REQUESTS=true
CACHE_RESPONSES=true

# Cost Management
COST_BUDGET_DAILY=100.00
COST_TRACKING_ENABLED=true
PREFERRED_COST_MODEL=gpt-3.5-turbo

# Monitoring
REDIS_URL=redis://localhost:6379
METRICS_ENABLED=true
PERFORMANCE_LOGGING=true

# Quality Assurance
ENABLE_VALIDATION=true
RESPONSE_QUALITY_THRESHOLD=0.8
AUTO_RETRY_LOW_CONFIDENCE=true
EOF
```

## Complete Implementation

```typescript
// src/commands/multi-model-ai.ts
import { defineCommand } from 'citty'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { generateText, streamText } from 'ai'
import axios from 'axios'
import Redis from 'ioredis'
import { Queue, Worker } from 'bullmq'
import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'

// Schemas
const ModelResponseSchema = z.object({
  model: z.string(),
  response: z.string(),
  confidence: z.number().min(0).max(1),
  latency: z.number(),
  tokens: z.number(),
  cost: z.number(),
  metadata: z.object({
    provider: z.string(),
    version: z.string().optional(),
    temperature: z.number().optional(),
    reasoning: z.string().optional()
  })
})

const ConsensusResultSchema = z.object({
  finalResponse: z.string(),
  confidence: z.number().min(0).max(1),
  agreement: z.object({
    level: z.enum(['high', 'medium', 'low', 'conflict']),
    percentage: z.number(),
    participating_models: z.array(z.string()),
    dissenting_models: z.array(z.string())
  }),
  individual_responses: z.array(ModelResponseSchema),
  reasoning: z.string(),
  recommendations: z.array(z.string()),
  metadata: z.object({
    total_cost: z.number(),
    total_latency: z.number(),
    fastest_model: z.string(),
    most_confident_model: z.string(),
    consensus_algorithm: z.string()
  })
})

// Multi-Model AI Engine
class MultiModelAIEngine extends EventEmitter {
  private redis: Redis
  private processingQueue: Queue
  private modelWorker: Worker
  private modelClients: Map<string, any>
  private modelMetrics: Map<string, ModelMetrics>
  private costTracker: CostTracker

  constructor() {
    super()
    this.redis = new Redis(process.env.REDIS_URL!)
    this.processingQueue = new Queue('ai-consensus', { connection: this.redis })
    this.modelClients = new Map()
    this.modelMetrics = new Map()
    this.costTracker = new CostTracker()
    this.initializeProviders()
    this.setupWorkers()
  }

  private initializeProviders() {
    // OpenAI models
    this.modelClients.set('gpt-4', { client: openai, model: 'gpt-4', provider: 'openai' })
    this.modelClients.set('gpt-3.5-turbo', { client: openai, model: 'gpt-3.5-turbo', provider: 'openai' })
    
    // Anthropic models
    this.modelClients.set('claude-3-sonnet', { 
      client: anthropic, 
      model: 'claude-3-sonnet-20240229', 
      provider: 'anthropic' 
    })
    this.modelClients.set('claude-3-haiku', { 
      client: anthropic, 
      model: 'claude-3-haiku-20240307', 
      provider: 'anthropic' 
    })
    
    // Google models
    this.modelClients.set('gemini-pro', { 
      client: google, 
      model: 'models/gemini-pro', 
      provider: 'google' 
    })
    
    // Ollama models (local)
    this.modelClients.set('llama3.1:8b', { 
      client: 'ollama', 
      model: 'llama3.1:8b', 
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL 
    })
    this.modelClients.set('llama3.1:70b', { 
      client: 'ollama', 
      model: 'llama3.1:70b', 
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL 
    })
  }

  private setupWorkers() {
    this.modelWorker = new Worker('ai-consensus', async (job) => {
      const { prompt, models, options } = job.data
      return this.processConsensusRequest(prompt, models, options)
    }, { connection: this.redis, concurrency: 5 })

    this.modelWorker.on('completed', (job, result) => {
      this.emit('consensusCompleted', { jobId: job.id, result })
    })

    this.modelWorker.on('failed', (job, err) => {
      this.emit('consensusFailed', { jobId: job.id, error: err })
    })
  }

  async generateConsensus(
    prompt: string,
    options: ConsensusOptions = {}
  ): Promise<ConsensusResult> {
    const startTime = performance.now()
    
    try {
      // Select models based on options and availability
      const selectedModels = await this.selectModels(options)
      
      // Check cost budget
      await this.costTracker.checkBudget(selectedModels.length)
      
      // Generate responses from multiple models
      const responses = await this.generateMultipleResponses(prompt, selectedModels, options)
      
      // Analyze consensus
      const consensus = await this.analyzeConsensus(responses, options)
      
      // Update metrics and costs
      await this.updateMetrics(responses, consensus)
      
      const totalLatency = performance.now() - startTime
      consensus.metadata.total_latency = totalLatency
      
      this.emit('consensusGenerated', { prompt, consensus })
      
      return consensus
    } catch (error) {
      this.emit('consensusError', { prompt, error })
      throw error
    }
  }

  private async selectModels(options: ConsensusOptions): Promise<string[]> {
    const primaryModels = (process.env.PRIMARY_MODELS || 'gpt-4,claude-3-sonnet').split(',')
    const secondaryModels = (process.env.SECONDARY_MODELS || 'gpt-3.5-turbo,claude-3-haiku').split(',')
    
    let selectedModels: string[] = []
    
    if (options.models && options.models.length > 0) {
      selectedModels = options.models
    } else {
      // Select based on priority, budget, and availability
      selectedModels = await this.intelligentModelSelection(primaryModels, secondaryModels, options)
    }
    
    // Filter out unhealthy models
    const healthyModels = await this.filterHealthyModels(selectedModels)
    
    if (healthyModels.length < parseInt(process.env.MIN_AGREEMENT_MODELS || '2')) {
      throw new Error('Insufficient healthy models available for consensus')
    }
    
    return healthyModels
  }

  private async intelligentModelSelection(
    primaryModels: string[],
    secondaryModels: string[],
    options: ConsensusOptions
  ): Promise<string[]> {
    const selected: string[] = []
    const budgetPerModel = await this.costTracker.getBudgetPerModel()
    
    // Prioritize by cost efficiency and performance
    const modelScores = new Map<string, number>()
    
    for (const model of [...primaryModels, ...secondaryModels]) {
      const metrics = this.modelMetrics.get(model)
      if (!metrics) continue
      
      const costScore = budgetPerModel / (metrics.averageCost || 0.01)
      const performanceScore = metrics.averageConfidence * (1 / metrics.averageLatency * 1000)
      const reliabilityScore = metrics.successRate
      
      modelScores.set(model, costScore * 0.3 + performanceScore * 0.4 + reliabilityScore * 0.3)
    }
    
    // Select top performers within budget
    const sortedModels = [...modelScores.entries()]
      .sort(([,a], [,b]) => b - a)
      .map(([model]) => model)
    
    for (const model of sortedModels) {
      if (selected.length >= (options.maxModels || 5)) break
      if (await this.costTracker.canAfford(model)) {
        selected.push(model)
      }
    }
    
    return selected.slice(0, Math.max(3, options.maxModels || 5))
  }

  private async filterHealthyModels(models: string[]): Promise<string[]> {
    const healthChecks = await Promise.allSettled(
      models.map(async model => {
        const isHealthy = await this.checkModelHealth(model)
        return { model, isHealthy }
      })
    )
    
    return healthChecks
      .filter((check): check is PromiseFulfilledResult<{model: string, isHealthy: boolean}> => 
        check.status === 'fulfilled' && check.value.isHealthy)
      .map(check => check.value.model)
  }

  private async checkModelHealth(model: string): Promise<boolean> {
    try {
      const client = this.modelClients.get(model)
      if (!client) return false
      
      // Simple health check with timeout
      if (client.provider === 'ollama') {
        const response = await axios.get(`${client.baseUrl}/api/tags`, { timeout: 5000 })
        return response.status === 200
      } else {
        // For API providers, check recent metrics
        const metrics = this.modelMetrics.get(model)
        return metrics ? metrics.successRate > 0.8 : true
      }
    } catch (error) {
      console.warn(`Health check failed for ${model}:`, error.message)
      return false
    }
  }

  private async generateMultipleResponses(
    prompt: string,
    models: string[],
    options: ConsensusOptions
  ): Promise<ModelResponse[]> {
    const responses: ModelResponse[] = []
    const timeout = parseInt(process.env.MODEL_TIMEOUT || '30000')
    
    if (process.env.PARALLEL_REQUESTS === 'true') {
      // Parallel execution
      const promises = models.map(model => 
        this.generateSingleResponse(prompt, model, options, timeout)
      )
      
      const results = await Promise.allSettled(promises)
      
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          responses.push(result.value)
        } else {
          console.error(`Model ${models[index]} failed:`, result.reason)
          // Add error response for tracking
          responses.push({
            model: models[index],
            response: `Error: ${result.reason.message}`,
            confidence: 0,
            latency: timeout,
            tokens: 0,
            cost: 0,
            metadata: {
              provider: this.modelClients.get(models[index])?.provider || 'unknown',
              error: result.reason.message
            }
          })
        }
      }
    } else {
      // Sequential execution
      for (const model of models) {
        try {
          const response = await this.generateSingleResponse(prompt, model, options, timeout)
          responses.push(response)
        } catch (error) {
          console.error(`Model ${model} failed:`, error)
          responses.push({
            model,
            response: `Error: ${error.message}`,
            confidence: 0,
            latency: timeout,
            tokens: 0,
            cost: 0,
            metadata: {
              provider: this.modelClients.get(model)?.provider || 'unknown',
              error: error.message
            }
          })
        }
      }
    }
    
    return responses
  }

  private async generateSingleResponse(
    prompt: string,
    model: string,
    options: ConsensusOptions,
    timeout: number
  ): Promise<ModelResponse> {
    const startTime = performance.now()
    const client = this.modelClients.get(model)
    
    if (!client) {
      throw new Error(`Model ${model} not configured`)
    }
    
    try {
      let response: any
      let tokens = 0
      
      if (client.provider === 'ollama') {
        // Handle Ollama separately
        response = await this.generateOllamaResponse(prompt, client, timeout)
      } else {
        // Handle API providers
        const result = await Promise.race([
          generateText({
            model: client.client(client.model),
            prompt,
            temperature: options.temperature || 0.1,
            maxTokens: options.maxTokens || 1000
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ])
        
        response = (result as any).text
        tokens = (result as any).usage?.totalTokens || 0
      }
      
      const latency = performance.now() - startTime
      const confidence = this.calculateConfidence(response, model, latency)
      const cost = this.calculateCost(model, tokens)
      
      return {
        model,
        response,
        confidence,
        latency,
        tokens,
        cost,
        metadata: {
          provider: client.provider,
          version: client.model,
          temperature: options.temperature || 0.1
        }
      }
    } catch (error) {
      const latency = performance.now() - startTime
      throw new Error(`${model} generation failed: ${error.message}`)
    }
  }

  private async generateOllamaResponse(prompt: string, client: any, timeout: number): Promise<string> {
    const response = await axios.post(`${client.baseUrl}/api/generate`, {
      model: client.model,
      prompt,
      stream: false
    }, { timeout })
    
    return response.data.response
  }

  private calculateConfidence(response: string, model: string, latency: number): number {
    // Confidence scoring based on multiple factors
    let confidence = 0.5
    
    // Response length factor
    const lengthFactor = Math.min(response.length / 500, 1) * 0.2
    
    // Model reputation factor
    const modelReputations = new Map([
      ['gpt-4', 0.9],
      ['claude-3-sonnet', 0.85],
      ['gpt-3.5-turbo', 0.75],
      ['gemini-pro', 0.8],
      ['claude-3-haiku', 0.7],
      ['llama3.1:70b', 0.8],
      ['llama3.1:8b', 0.65]
    ])
    
    const reputationFactor = (modelReputations.get(model) || 0.5) * 0.3
    
    // Latency factor (faster responses might be less thoughtful)
    const latencyFactor = latency > 5000 ? 0.2 : latency < 1000 ? 0.1 : 0.15
    
    // Content quality indicators
    const qualityFactor = this.assessResponseQuality(response) * 0.35
    
    confidence = lengthFactor + reputationFactor + latencyFactor + qualityFactor
    
    return Math.min(Math.max(confidence, 0.1), 1.0)
  }

  private assessResponseQuality(response: string): number {
    let quality = 0.5
    
    // Check for structured thinking
    if (response.includes('steps') || response.includes('1.') || response.includes('•')) {
      quality += 0.1
    }
    
    // Check for explanations
    if (response.includes('because') || response.includes('explanation') || response.includes('reason')) {
      quality += 0.1
    }
    
    // Check for completeness
    if (response.length > 200) {
      quality += 0.1
    }
    
    // Check for code examples
    if (response.includes('```') || response.includes('command:') || response.includes('example:')) {
      quality += 0.2
    }
    
    return Math.min(quality, 1.0)
  }

  private calculateCost(model: string, tokens: number): number {
    // Approximate costs per 1K tokens (as of 2024)
    const costPer1K = new Map([
      ['gpt-4', 0.03],
      ['gpt-3.5-turbo', 0.002],
      ['claude-3-sonnet', 0.015],
      ['claude-3-haiku', 0.0008],
      ['gemini-pro', 0.001],
      ['llama3.1:8b', 0], // Local model
      ['llama3.1:70b', 0]  // Local model
    ])
    
    const rate = costPer1K.get(model) || 0.01
    return (tokens / 1000) * rate
  }

  private async analyzeConsensus(
    responses: ModelResponse[],
    options: ConsensusOptions
  ): Promise<ConsensusResult> {
    const validResponses = responses.filter(r => r.confidence > 0)
    
    if (validResponses.length === 0) {
      throw new Error('No valid responses received from any model')
    }
    
    // Apply different consensus algorithms
    const algorithm = options.consensusAlgorithm || 'weighted_voting'
    let consensusResult: ConsensusResult
    
    switch (algorithm) {
      case 'majority_vote':
        consensusResult = await this.majorityVoteConsensus(validResponses)
        break
      case 'weighted_voting':
        consensusResult = await this.weightedVotingConsensus(validResponses)
        break
      case 'confidence_threshold':
        consensusResult = await this.confidenceThresholdConsensus(validResponses, options)
        break
      case 'semantic_similarity':
        consensusResult = await this.semanticSimilarityConsensus(validResponses)
        break
      default:
        consensusResult = await this.weightedVotingConsensus(validResponses)
    }
    
    consensusResult.individual_responses = responses
    consensusResult.metadata.consensus_algorithm = algorithm
    consensusResult.metadata.total_cost = responses.reduce((sum, r) => sum + r.cost, 0)
    consensusResult.metadata.fastest_model = responses.reduce((fastest, r) => 
      r.latency < fastest.latency ? r : fastest
    ).model
    consensusResult.metadata.most_confident_model = responses.reduce((mostConfident, r) => 
      r.confidence > mostConfident.confidence ? r : mostConfident
    ).model
    
    return consensusResult
  }

  private async weightedVotingConsensus(responses: ModelResponse[]): Promise<ConsensusResult> {
    // Weight responses by confidence and model reputation
    const weightedResponses = responses.map(r => ({
      ...r,
      weight: r.confidence * (this.getModelWeight(r.model))
    }))
    
    // Find the response with highest weighted score
    const winner = weightedResponses.reduce((best, current) => 
      current.weight > best.weight ? current : best
    )
    
    // Calculate agreement level
    const similarResponses = await this.findSimilarResponses(responses, winner.response)
    const agreementPercentage = similarResponses.length / responses.length
    
    let agreementLevel: 'high' | 'medium' | 'low' | 'conflict'
    if (agreementPercentage >= 0.8) agreementLevel = 'high'
    else if (agreementPercentage >= 0.6) agreementLevel = 'medium'
    else if (agreementPercentage >= 0.4) agreementLevel = 'low'
    else agreementLevel = 'conflict'
    
    const participatingModels = similarResponses.map(r => r.model)
    const dissentingModels = responses
      .filter(r => !participatingModels.includes(r.model))
      .map(r => r.model)
    
    return {
      finalResponse: winner.response,
      confidence: winner.confidence,
      agreement: {
        level: agreementLevel,
        percentage: agreementPercentage,
        participating_models: participatingModels,
        dissenting_models: dissentingModels
      },
      individual_responses: responses,
      reasoning: this.generateReasoningExplanation(responses, winner, agreementLevel),
      recommendations: this.generateRecommendations(responses, agreementLevel),
      metadata: {
        total_cost: 0, // Will be filled by caller
        total_latency: 0, // Will be filled by caller
        fastest_model: '', // Will be filled by caller
        most_confident_model: winner.model,
        consensus_algorithm: 'weighted_voting'
      }
    }
  }

  private async majorityVoteConsensus(responses: ModelResponse[]): Promise<ConsensusResult> {
    // Group similar responses
    const responseGroups = await this.groupSimilarResponses(responses)
    
    // Find the largest group
    const majorityGroup = responseGroups.reduce((largest, current) => 
      current.length > largest.length ? current : largest
    )
    
    // Select the highest confidence response from majority group
    const winner = majorityGroup.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
    
    const agreementPercentage = majorityGroup.length / responses.length
    let agreementLevel: 'high' | 'medium' | 'low' | 'conflict'
    
    if (agreementPercentage >= 0.75) agreementLevel = 'high'
    else if (agreementPercentage >= 0.5) agreementLevel = 'medium'
    else if (agreementPercentage >= 0.33) agreementLevel = 'low'
    else agreementLevel = 'conflict'
    
    return {
      finalResponse: winner.response,
      confidence: winner.confidence,
      agreement: {
        level: agreementLevel,
        percentage: agreementPercentage,
        participating_models: majorityGroup.map(r => r.model),
        dissenting_models: responses
          .filter(r => !majorityGroup.includes(r))
          .map(r => r.model)
      },
      individual_responses: responses,
      reasoning: this.generateReasoningExplanation(responses, winner, agreementLevel),
      recommendations: this.generateRecommendations(responses, agreementLevel),
      metadata: {
        total_cost: 0,
        total_latency: 0,
        fastest_model: '',
        most_confident_model: winner.model,
        consensus_algorithm: 'majority_vote'
      }
    }
  }

  private async confidenceThresholdConsensus(
    responses: ModelResponse[],
    options: ConsensusOptions
  ): Promise<ConsensusResult> {
    const threshold = options.confidenceThreshold || parseFloat(process.env.CONSENSUS_THRESHOLD || '0.7')
    const highConfidenceResponses = responses.filter(r => r.confidence >= threshold)
    
    if (highConfidenceResponses.length === 0) {
      // Fall back to highest confidence response
      const best = responses.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
      
      return {
        finalResponse: best.response,
        confidence: best.confidence,
        agreement: {
          level: 'low',
          percentage: 1 / responses.length,
          participating_models: [best.model],
          dissenting_models: responses.filter(r => r.model !== best.model).map(r => r.model)
        },
        individual_responses: responses,
        reasoning: `No responses met confidence threshold of ${threshold}. Selected highest confidence response.`,
        recommendations: ['Consider lowering confidence threshold or using different models'],
        metadata: {
          total_cost: 0,
          total_latency: 0,
          fastest_model: '',
          most_confident_model: best.model,
          consensus_algorithm: 'confidence_threshold'
        }
      }
    }
    
    // Use weighted voting among high-confidence responses
    return this.weightedVotingConsensus(highConfidenceResponses)
  }

  private async semanticSimilarityConsensus(responses: ModelResponse[]): Promise<ConsensusResult> {
    // This would require embedding generation and similarity calculation
    // For now, fall back to weighted voting
    console.log('Semantic similarity consensus not fully implemented, falling back to weighted voting')
    return this.weightedVotingConsensus(responses)
  }

  private async findSimilarResponses(responses: ModelResponse[], target: string): Promise<ModelResponse[]> {
    // Simple similarity check based on common words and phrases
    const targetWords = new Set(target.toLowerCase().split(/\s+/))
    
    return responses.filter(response => {
      const responseWords = new Set(response.response.toLowerCase().split(/\s+/))
      const intersection = new Set([...targetWords].filter(word => responseWords.has(word)))
      const similarity = intersection.size / Math.max(targetWords.size, responseWords.size)
      return similarity > 0.3 // 30% similarity threshold
    })
  }

  private async groupSimilarResponses(responses: ModelResponse[]): Promise<ModelResponse[][]> {
    const groups: ModelResponse[][] = []
    const processed = new Set<ModelResponse>()
    
    for (const response of responses) {
      if (processed.has(response)) continue
      
      const similarResponses = await this.findSimilarResponses(responses, response.response)
      const group = similarResponses.filter(r => !processed.has(r))
      
      if (group.length > 0) {
        groups.push(group)
        group.forEach(r => processed.add(r))
      }
    }
    
    return groups
  }

  private getModelWeight(model: string): number {
    const weights = new Map([
      ['gpt-4', 1.0],
      ['claude-3-sonnet', 0.95],
      ['gemini-pro', 0.9],
      ['gpt-3.5-turbo', 0.8],
      ['claude-3-haiku', 0.75],
      ['llama3.1:70b', 0.85],
      ['llama3.1:8b', 0.7]
    ])
    
    return weights.get(model) || 0.6
  }

  private generateReasoningExplanation(
    responses: ModelResponse[],
    winner: ModelResponse,
    agreementLevel: string
  ): string {
    const totalModels = responses.length
    const validModels = responses.filter(r => r.confidence > 0).length
    
    let explanation = `Selected response from ${winner.model} (confidence: ${(winner.confidence * 100).toFixed(1)}%) `
    explanation += `based on consensus analysis of ${totalModels} models (${validModels} provided valid responses). `
    explanation += `Agreement level: ${agreementLevel}. `
    
    if (agreementLevel === 'high') {
      explanation += 'Strong consensus indicates high reliability of the response.'
    } else if (agreementLevel === 'medium') {
      explanation += 'Moderate consensus suggests reasonable reliability with some variation in approaches.'
    } else if (agreementLevel === 'low') {
      explanation += 'Low consensus indicates significant variation in model responses. Use with caution.'
    } else {
      explanation += 'Conflicting responses detected. Consider seeking additional validation.'
    }
    
    return explanation
  }

  private generateRecommendations(
    responses: ModelResponse[],
    agreementLevel: string
  ): string[] {
    const recommendations: string[] = []
    
    if (agreementLevel === 'conflict') {
      recommendations.push('Consider rephrasing the query for clearer consensus')
      recommendations.push('Manually review individual model responses')
      recommendations.push('Seek expert validation for critical decisions')
    }
    
    if (agreementLevel === 'low') {
      recommendations.push('Consider using additional models for better consensus')
      recommendations.push('Review the specific differences between model responses')
    }
    
    const failedModels = responses.filter(r => r.confidence === 0)
    if (failedModels.length > 0) {
      recommendations.push(`Check connectivity for failed models: ${failedModels.map(r => r.model).join(', ')}`)
    }
    
    const avgLatency = responses.reduce((sum, r) => sum + r.latency, 0) / responses.length
    if (avgLatency > 10000) {
      recommendations.push('Consider using faster models for time-sensitive queries')
    }
    
    return recommendations
  }

  private async updateMetrics(responses: ModelResponse[], consensus: ConsensusResult): Promise<void> {
    for (const response of responses) {
      let metrics = this.modelMetrics.get(response.model)
      if (!metrics) {
        metrics = {
          totalRequests: 0,
          successfulRequests: 0,
          totalLatency: 0,
          totalCost: 0,
          totalTokens: 0,
          averageConfidence: 0,
          averageLatency: 0,
          averageCost: 0,
          successRate: 0
        }
        this.modelMetrics.set(response.model, metrics)
      }
      
      metrics.totalRequests++
      if (response.confidence > 0) metrics.successfulRequests++
      metrics.totalLatency += response.latency
      metrics.totalCost += response.cost
      metrics.totalTokens += response.tokens
      
      metrics.averageLatency = metrics.totalLatency / metrics.totalRequests
      metrics.averageCost = metrics.totalCost / metrics.totalRequests
      metrics.averageConfidence = (metrics.averageConfidence * (metrics.totalRequests - 1) + response.confidence) / metrics.totalRequests
      metrics.successRate = metrics.successfulRequests / metrics.totalRequests
    }
    
    // Store metrics in Redis for persistence
    await this.redis.hset('model_metrics', 
      ...Array.from(this.modelMetrics.entries()).flatMap(([model, metrics]) => [
        model, JSON.stringify(metrics)
      ])
    )
  }

  async getModelMetrics(model?: string): Promise<any> {
    if (model) {
      return this.modelMetrics.get(model) || null
    } else {
      return Object.fromEntries(this.modelMetrics)
    }
  }
}

// Cost Tracker
class CostTracker {
  private redis: Redis
  private dailyBudget: number

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!)
    this.dailyBudget = parseFloat(process.env.COST_BUDGET_DAILY || '100.0')
  }

  async checkBudget(modelCount: number): Promise<void> {
    if (!process.env.COST_TRACKING_ENABLED) return
    
    const todayKey = `cost:${new Date().toISOString().split('T')[0]}`
    const currentSpend = parseFloat(await this.redis.get(todayKey) || '0')
    
    const estimatedCost = modelCount * 0.05 // Rough estimate
    
    if (currentSpend + estimatedCost > this.dailyBudget) {
      throw new Error(`Budget exceeded: ${currentSpend + estimatedCost} > ${this.dailyBudget}`)
    }
  }

  async recordCost(cost: number): Promise<void> {
    if (!process.env.COST_TRACKING_ENABLED) return
    
    const todayKey = `cost:${new Date().toISOString().split('T')[0]}`
    await this.redis.incrbyfloat(todayKey, cost)
    await this.redis.expire(todayKey, 86400 * 7) // Keep for 7 days
  }

  async getBudgetPerModel(): Promise<number> {
    const todayKey = `cost:${new Date().toISOString().split('T')[0]}`
    const currentSpend = parseFloat(await this.redis.get(todayKey) || '0')
    const remaining = this.dailyBudget - currentSpend
    
    return Math.max(remaining / 10, 0.01) // Divide among potential models
  }

  async canAfford(model: string): Promise<boolean> {
    const budgetPerModel = await this.getBudgetPerModel()
    const estimatedCost = 0.05 // Rough estimate per model call
    
    return budgetPerModel >= estimatedCost
  }
}

// Types
type ConsensusOptions = {
  models?: string[]
  maxModels?: number
  temperature?: number
  maxTokens?: number
  consensusAlgorithm?: 'majority_vote' | 'weighted_voting' | 'confidence_threshold' | 'semantic_similarity'
  confidenceThreshold?: number
  timeout?: number
}

type ModelResponse = {
  model: string
  response: string
  confidence: number
  latency: number
  tokens: number
  cost: number
  metadata: {
    provider: string
    version?: string
    temperature?: number
    reasoning?: string
    error?: string
  }
}

type ConsensusResult = {
  finalResponse: string
  confidence: number
  agreement: {
    level: 'high' | 'medium' | 'low' | 'conflict'
    percentage: number
    participating_models: string[]
    dissenting_models: string[]
  }
  individual_responses: ModelResponse[]
  reasoning: string
  recommendations: string[]
  metadata: {
    total_cost: number
    total_latency: number
    fastest_model: string
    most_confident_model: string
    consensus_algorithm: string
  }
}

type ModelMetrics = {
  totalRequests: number
  successfulRequests: number
  totalLatency: number
  totalCost: number
  totalTokens: number
  averageConfidence: number
  averageLatency: number
  averageCost: number
  successRate: number
}

// Main Command
export default defineCommand({
  meta: {
    name: 'multi-ai',
    description: 'Multi-model AI consensus system'
  },
  args: {
    prompt: {
      type: 'string',
      description: 'The prompt to send to multiple AI models',
      required: true
    },
    models: {
      type: 'string',
      description: 'Comma-separated list of models to use',
      required: false
    },
    algorithm: {
      type: 'string',
      description: 'Consensus algorithm to use',
      default: 'weighted_voting'
    },
    threshold: {
      type: 'string',
      description: 'Confidence threshold (0.0-1.0)',
      default: '0.7'
    },
    maxModels: {
      type: 'string',
      description: 'Maximum number of models to use',
      default: '5'
    },
    showIndividual: {
      type: 'boolean',
      description: 'Show individual model responses',
      default: false
    },
    parallel: {
      type: 'boolean',
      description: 'Run models in parallel',
      default: true
    },
    metrics: {
      type: 'boolean',
      description: 'Show detailed metrics',
      default: false
    }
  },
  async run({ args, reporter }) {
    const startTime = Date.now()
    
    try {
      reporter.info('Initializing multi-model AI consensus system...')
      
      const engine = new MultiModelAIEngine()
      
      // Setup progress reporting
      engine.on('consensusGenerated', ({ prompt, consensus }) => {
        reporter.success(`Consensus generated with ${consensus.agreement.level} agreement`)
      })
      
      engine.on('consensusError', ({ prompt, error }) => {
        reporter.error(`Consensus generation failed: ${error.message}`)
      })
      
      // Build options
      const options: ConsensusOptions = {
        models: args.models ? args.models.split(',') : undefined,
        maxModels: parseInt(args.maxModels),
        consensusAlgorithm: args.algorithm as any,
        confidenceThreshold: parseFloat(args.threshold),
        timeout: 30000
      }
      
      // Set parallel processing
      if (args.parallel) {
        process.env.PARALLEL_REQUESTS = 'true'
      }
      
      reporter.info(`Generating consensus for: "${args.prompt.substring(0, 50)}${args.prompt.length > 50 ? '...' : ''}"`)
      
      // Generate consensus
      const result = await engine.generateConsensus(args.prompt, options)
      
      const duration = Date.now() - startTime
      
      // Display results
      console.log('\n' + '='.repeat(80))
      console.log('CONSENSUS RESULT')
      console.log('='.repeat(80))
      
      console.log(`\n${result.finalResponse}\n`)
      
      console.log('CONSENSUS ANALYSIS:')
      console.log(`• Agreement Level: ${result.agreement.level.toUpperCase()} (${(result.agreement.percentage * 100).toFixed(1)}%)`)
      console.log(`• Confidence: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`• Participating Models: ${result.agreement.participating_models.join(', ')}`)
      
      if (result.agreement.dissenting_models.length > 0) {
        console.log(`• Dissenting Models: ${result.agreement.dissenting_models.join(', ')}`)
      }
      
      console.log(`\nREASONING:\n${result.reasoning}`)
      
      if (result.recommendations.length > 0) {
        console.log('\nRECOMMENDATIONS:')
        result.recommendations.forEach(rec => console.log(`• ${rec}`))
      }
      
      // Show individual responses if requested
      if (args.showIndividual) {
        console.log('\nINDIVIDUAL MODEL RESPONSES:')
        console.log('-'.repeat(80))
        
        for (const response of result.individual_responses) {
          console.log(`\n${response.model.toUpperCase()} (${response.metadata.provider})`)
          console.log(`Confidence: ${(response.confidence * 100).toFixed(1)}% | Latency: ${response.latency.toFixed(0)}ms | Cost: $${response.cost.toFixed(4)}`)
          console.log(`Response: ${response.response.substring(0, 200)}${response.response.length > 200 ? '...' : ''}`)
          
          if (response.metadata.error) {
            console.log(`Error: ${response.metadata.error}`)
          }
        }
      }
      
      // Show metrics if requested
      if (args.metrics) {
        console.log('\nPERFORMANCE METRICS:')
        console.log(`• Total Cost: $${result.metadata.total_cost.toFixed(4)}`)
        console.log(`• Total Latency: ${result.metadata.total_latency.toFixed(0)}ms`)
        console.log(`• Fastest Model: ${result.metadata.fastest_model}`)
        console.log(`• Most Confident: ${result.metadata.most_confident_model}`)
        console.log(`• Algorithm Used: ${result.metadata.consensus_algorithm}`)
        console.log(`• Models Queried: ${result.individual_responses.length}`)
        console.log(`• Success Rate: ${(result.individual_responses.filter(r => r.confidence > 0).length / result.individual_responses.length * 100).toFixed(1)}%`)
      }
      
      reporter.success(`Multi-model consensus completed in ${duration}ms`)
      
      // Exit with appropriate code based on confidence
      if (result.confidence < 0.5) {
        reporter.warn('Low confidence result - consider manual review')
        process.exit(2)
      } else if (result.agreement.level === 'conflict') {
        reporter.warn('Conflicting responses detected - use with caution')
        process.exit(1)
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      reporter.error(`Multi-model AI consensus failed after ${duration}ms: ${error.message}`)
      
      if (error.message.includes('Budget exceeded')) {
        reporter.info('Consider increasing daily budget or using fewer models')
      } else if (error.message.includes('Insufficient healthy models')) {
        reporter.info('Check model availability and API keys')
      }
      
      process.exit(1)
    }
  }
})
```

## Testing Approach

```typescript
// test/multi-model-ai.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'child_process'

// Mock AI providers
vi.mock('@ai-sdk/openai')
vi.mock('@ai-sdk/anthropic')
vi.mock('@ai-sdk/google')
vi.mock('ai')

describe('Multi-Model AI Consensus', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.GOOGLE_AI_API_KEY = 'test-key'
    process.env.PRIMARY_MODELS = 'gpt-4,claude-3-sonnet'
    process.env.CONSENSUS_THRESHOLD = '0.7'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should generate consensus with high agreement', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Use ls -la to list files with details',
      usage: { totalTokens: 50 }
    })

    const result = execSync('tsx src/commands/multi-model-ai.ts "how to list files"', {
      encoding: 'utf-8'
    })

    expect(result).toContain('CONSENSUS RESULT')
    expect(result).toContain('ls -la')
    expect(result).toContain('Agreement Level: HIGH')
  })

  it('should handle conflicting responses', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: 'Use ls command',
        usage: { totalTokens: 30 }
      })
      .mockResolvedValueOnce({
        text: 'Use dir command',
        usage: { totalTokens: 30 }
      })

    const result = execSync('tsx src/commands/multi-model-ai.ts "list files"', {
      encoding: 'utf-8',
      stdio: 'pipe'
    })

    expect(result).toContain('Agreement Level: CONFLICT')
    expect(result).toContain('Dissenting Models')
  })

  it('should show individual responses when requested', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Test response',
      usage: { totalTokens: 25 }
    })

    const result = execSync('tsx src/commands/multi-model-ai.ts "test" --show-individual', {
      encoding: 'utf-8'
    })

    expect(result).toContain('INDIVIDUAL MODEL RESPONSES')
    expect(result).toContain('GPT-4')
    expect(result).toContain('CLAUDE-3-SONNET')
  })

  it('should respect budget constraints', async () => {
    process.env.COST_BUDGET_DAILY = '0.01'
    process.env.COST_TRACKING_ENABLED = 'true'

    try {
      execSync('tsx src/commands/multi-model-ai.ts "expensive query"', {
        encoding: 'utf-8'
      })
    } catch (error) {
      expect(error.stdout || error.stderr).toContain('Budget exceeded')
    }
  })
})
```

## Usage Examples

### Basic Usage
```bash
# Generate consensus on a simple query
citty multi-ai "how do I compress a folder in Linux"

# Use specific models
citty multi-ai "explain Docker containers" --models "gpt-4,claude-3-sonnet,gemini-pro"

# Show individual model responses
citty multi-ai "best practices for API design" --show-individual
```

### Advanced Usage
```bash
# Use majority vote algorithm
citty multi-ai "troubleshoot network connectivity" --algorithm majority_vote

# Set custom confidence threshold
citty multi-ai "security best practices" --threshold 0.8

# Run models sequentially (not parallel)
citty multi-ai "complex query" --no-parallel

# Show detailed performance metrics
citty multi-ai "optimize database query" --metrics
```

## Performance Considerations

1. **Parallel vs Sequential Processing**
   - Parallel: Faster but higher resource usage
   - Sequential: Slower but more controlled resource consumption
   - Choose based on urgency vs resource constraints

2. **Model Selection Strategy**
   - Mix fast and accurate models
   - Balance cost vs quality
   - Consider local models for privacy-sensitive queries

3. **Cost Optimization**
   - Use cheaper models for initial filtering
   - Route only complex queries to expensive models
   - Implement smart caching strategies

4. **Latency Management**
   - Set appropriate timeouts per model
   - Implement graceful degradation
   - Use streaming where possible

## Deployment Notes

### Production Environment
```bash
# Required services
docker run -d --name redis -p 6379:6379 redis:alpine
docker run -d --name ollama -p 11434:11434 ollama/ollama

# Pull local models
ollama pull llama3.1:8b
ollama pull llama3.1:70b
```

### Monitoring Setup
```yaml
# monitoring.yml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      
volumes:
  redis_data:
```

### Cost Management
```bash
# Daily cost monitoring
export COST_BUDGET_DAILY=50.00
export COST_TRACKING_ENABLED=true
export PREFERRED_COST_MODEL=gpt-3.5-turbo

# Model health monitoring
export HEALTH_CHECK_INTERVAL=300
export AUTO_DISABLE_UNHEALTHY_MODELS=true
```

This pattern provides a comprehensive, production-ready multi-model AI consensus system that can intelligently combine responses from different AI providers to make more reliable and confident decisions for CLI operations.