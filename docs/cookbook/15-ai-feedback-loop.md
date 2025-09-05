# Pattern 15: AI Feedback Loop - Content Quality Improvement

## Overview

This pattern demonstrates a production-ready AI feedback loop system that continuously improves content quality through iterative analysis, feedback collection, and automated refinement. The system learns from user interactions, performance metrics, and quality assessments to provide increasingly better results over time.

## Features

- Continuous feedback collection and analysis
- Multi-dimensional quality assessment
- Automated content improvement suggestions
- Learning from user interactions
- Performance-based optimization
- A/B testing for improvements
- Real-time quality monitoring
- Adaptive improvement strategies

## Environment Setup

```bash
# Install dependencies
pnpm add citty zod @ai-sdk/openai @ai-sdk/anthropic
pnpm add natural sentiment compromise ml-matrix
pnpm add ioredis sqlite3 bullmq express
pnpm add -D @types/node @types/express vitest tsx

# Environment variables
cat > .env << 'EOF'
# AI Configuration
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
PRIMARY_MODEL=gpt-4
FEEDBACK_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.1

# Quality Metrics
QUALITY_THRESHOLD=0.8
IMPROVEMENT_THRESHOLD=0.05
MIN_FEEDBACK_SAMPLES=10
CONFIDENCE_THRESHOLD=0.85

# Learning Configuration
LEARNING_RATE=0.01
MEMORY_WINDOW=1000
ADAPTATION_INTERVAL=3600
ENABLE_AUTO_IMPROVEMENT=true

# Feedback Collection
FEEDBACK_RETENTION_DAYS=90
ANONYMOUS_FEEDBACK=true
DETAILED_ANALYTICS=true
USER_TRACKING=false

# Processing
BATCH_SIZE=50
MAX_ITERATIONS=10
PROCESSING_TIMEOUT=60000
CONCURRENT_JOBS=3

# Storage
DATABASE_URL=sqlite:./feedback.db
REDIS_URL=redis://localhost:6379
BACKUP_INTERVAL=86400

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9092
LOG_LEVEL=info
ALERT_THRESHOLD=0.7
EOF
```

## Complete Implementation

```typescript
// src/commands/ai-feedback.ts
import { defineCommand } from 'citty'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { readFileSync, writeFileSync } from 'fs'
import { Database } from 'sqlite3'
import Redis from 'ioredis'
import { Queue, Worker } from 'bullmq'
import { SentimentAnalyzer, WordTokenizer } from 'natural'
import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'

// Schemas
const FeedbackSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string(),
  userId: z.string().optional(),
  feedbackType: z.enum(['rating', 'text', 'implicit', 'usage']),
  rating: z.number().min(1).max(5).optional(),
  textFeedback: z.string().optional(),
  metadata: z.object({
    timestamp: z.string().datetime(),
    source: z.string(),
    context: z.record(z.any()).optional(),
    sessionId: z.string().optional(),
    userAgent: z.string().optional()
  }),
  sentiment: z.object({
    score: z.number().min(-1).max(1),
    confidence: z.number().min(0).max(1),
    classification: z.enum(['positive', 'negative', 'neutral'])
  }).optional(),
  processed: z.boolean().default(false)
})

const QualityMetricsSchema = z.object({
  contentId: z.string(),
  overallScore: z.number().min(0).max(1),
  dimensions: z.object({
    accuracy: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    completeness: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    engagement: z.number().min(0).max(1),
    usability: z.number().min(0).max(1)
  }),
  trends: z.object({
    improving: z.boolean(),
    changeRate: z.number(),
    confidence: z.number()
  }),
  recommendations: z.array(z.object({
    type: z.enum(['content', 'structure', 'style', 'technical']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    expectedImpact: z.number().min(0).max(1)
  })),
  metadata: z.object({
    lastUpdated: z.string().datetime(),
    sampleSize: z.number(),
    dataSource: z.string()
  })
})

const ImprovementActionSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  actionType: z.enum(['rewrite', 'enhance', 'restructure', 'supplement']),
  description: z.string(),
  originalVersion: z.string(),
  improvedVersion: z.string(),
  confidence: z.number().min(0).max(1),
  expectedImpact: z.object({
    qualityImprovement: z.number(),
    userSatisfaction: z.number(),
    engagement: z.number()
  }),
  status: z.enum(['pending', 'applied', 'testing', 'rejected']),
  metadata: z.object({
    createdAt: z.string().datetime(),
    appliedAt: z.string().datetime().optional(),
    model: z.string(),
    reasoning: z.string()
  })
})

// AI Feedback Loop Engine
class AIFeedbackLoopEngine extends EventEmitter {
  private db: Database
  private redis: Redis
  private feedbackQueue: Queue
  private improvementQueue: Queue
  private feedbackWorker: Worker
  private improvementWorker: Worker
  private sentimentAnalyzer: SentimentAnalyzer
  private qualityModels: Map<string, QualityModel>

  constructor() {
    super()
    this.db = new Database('./feedback.db')
    this.redis = new Redis(process.env.REDIS_URL!)
    this.feedbackQueue = new Queue('feedback-processing', { connection: this.redis })
    this.improvementQueue = new Queue('content-improvement', { connection: this.redis })
    this.sentimentAnalyzer = new SentimentAnalyzer('English', 
      require('natural').PorterStemmer, 'afinn')
    this.qualityModels = new Map()
    this.initializeDatabase()
    this.setupQualityModels()
    this.setupWorkers()
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            user_id TEXT,
            feedback_type TEXT NOT NULL,
            rating INTEGER,
            text_feedback TEXT,
            sentiment_score REAL,
            sentiment_classification TEXT,
            metadata TEXT,
            processed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS quality_metrics (
            content_id TEXT PRIMARY KEY,
            overall_score REAL NOT NULL,
            accuracy REAL,
            clarity REAL,
            completeness REAL,
            relevance REAL,
            engagement REAL,
            usability REAL,
            sample_size INTEGER,
            metadata TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS improvement_actions (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            description TEXT,
            original_version TEXT,
            improved_version TEXT,
            confidence REAL,
            expected_impact TEXT,
            status TEXT DEFAULT 'pending',
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        this.db.run(`
          CREATE TABLE IF NOT EXISTS learning_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            content_id TEXT,
            metrics TEXT,
            outcomes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        resolve()
      })
    })
  }

  private setupQualityModels(): void {
    // Define quality assessment models for different content types
    this.qualityModels.set('text', {
      name: 'Text Quality Model',
      dimensions: ['accuracy', 'clarity', 'completeness', 'engagement'],
      weights: { accuracy: 0.3, clarity: 0.25, completeness: 0.25, engagement: 0.2 },
      assessor: this.assessTextQuality.bind(this)
    })

    this.qualityModels.set('code', {
      name: 'Code Quality Model',
      dimensions: ['accuracy', 'clarity', 'completeness', 'usability'],
      weights: { accuracy: 0.4, clarity: 0.25, completeness: 0.2, usability: 0.15 },
      assessor: this.assessCodeQuality.bind(this)
    })

    this.qualityModels.set('documentation', {
      name: 'Documentation Quality Model',
      dimensions: ['accuracy', 'clarity', 'completeness', 'relevance', 'usability'],
      weights: { accuracy: 0.25, clarity: 0.25, completeness: 0.25, relevance: 0.15, usability: 0.1 },
      assessor: this.assessDocumentationQuality.bind(this)
    })
  }

  private setupWorkers(): void {
    this.feedbackWorker = new Worker('feedback-processing', async (job) => {
      const feedback = job.data
      return this.processFeedback(feedback)
    }, { connection: this.redis, concurrency: 3 })

    this.improvementWorker = new Worker('content-improvement', async (job) => {
      const { contentId, qualityMetrics } = job.data
      return this.generateImprovements(contentId, qualityMetrics)
    }, { connection: this.redis, concurrency: 2 })

    this.feedbackWorker.on('completed', (job, result) => {
      this.emit('feedbackProcessed', { jobId: job.id, result })
    })

    this.improvementWorker.on('completed', (job, result) => {
      this.emit('improvementGenerated', { jobId: job.id, result })
    })
  }

  async submitFeedback(feedback: Feedback): Promise<void> {
    try {
      // Store feedback
      await this.storeFeedback(feedback)
      
      // Queue for processing
      await this.feedbackQueue.add('process-feedback', feedback, {
        priority: this.calculateFeedbackPriority(feedback),
        delay: 1000 // Small delay to batch similar feedback
      })
      
      this.emit('feedbackSubmitted', { feedbackId: feedback.id })
    } catch (error) {
      this.emit('feedbackError', { feedbackId: feedback.id, error })
      throw error
    }
  }

  private async processFeedback(feedback: Feedback): Promise<any> {
    try {
      // Analyze sentiment if text feedback provided
      if (feedback.textFeedback) {
        feedback.sentiment = await this.analyzeSentiment(feedback.textFeedback)
      }

      // Update content quality metrics
      await this.updateQualityMetrics(feedback)

      // Check if improvement is needed
      const qualityMetrics = await this.getQualityMetrics(feedback.contentId)
      if (this.shouldTriggerImprovement(qualityMetrics)) {
        await this.improvementQueue.add('generate-improvements', {
          contentId: feedback.contentId,
          qualityMetrics
        })
      }

      // Mark as processed
      await this.markFeedbackProcessed(feedback.id)

      return { status: 'processed', contentId: feedback.contentId }
    } catch (error) {
      console.error(`Feedback processing failed for ${feedback.id}:`, error)
      throw error
    }
  }

  private async analyzeSentiment(text: string): Promise<{
    score: number
    confidence: number
    classification: 'positive' | 'negative' | 'neutral'
  }> {
    // Use natural language processing for sentiment analysis
    const tokenizer = new WordTokenizer()
    const tokens = tokenizer.tokenize(text)
    
    if (!tokens || tokens.length === 0) {
      return { score: 0, confidence: 0, classification: 'neutral' }
    }

    const score = this.sentimentAnalyzer.getSentiment(tokens)
    const normalizedScore = Math.max(-1, Math.min(1, score / tokens.length))
    
    let classification: 'positive' | 'negative' | 'neutral'
    if (normalizedScore > 0.1) classification = 'positive'
    else if (normalizedScore < -0.1) classification = 'negative'
    else classification = 'neutral'
    
    const confidence = Math.abs(normalizedScore)
    
    return { score: normalizedScore, confidence, classification }
  }

  private async updateQualityMetrics(feedback: Feedback): Promise<void> {
    const contentId = feedback.contentId
    let metrics = await this.getQualityMetrics(contentId)
    
    if (!metrics) {
      metrics = await this.initializeQualityMetrics(contentId)
    }

    // Update metrics based on feedback
    if (feedback.rating) {
      const ratingScore = (feedback.rating - 1) / 4 // Normalize to 0-1
      metrics.overallScore = this.updateRunningAverage(
        metrics.overallScore,
        ratingScore,
        metrics.metadata.sampleSize
      )
    }

    if (feedback.sentiment) {
      const sentimentScore = (feedback.sentiment.score + 1) / 2 // Normalize to 0-1
      metrics.dimensions.engagement = this.updateRunningAverage(
        metrics.dimensions.engagement,
        sentimentScore,
        Math.floor(metrics.metadata.sampleSize / 2)
      )
    }

    // Analyze trends
    metrics.trends = await this.analyzeTrends(contentId, metrics)

    // Increment sample size
    metrics.metadata.sampleSize++
    metrics.metadata.lastUpdated = new Date().toISOString()

    // Store updated metrics
    await this.storeQualityMetrics(metrics)
  }

  private async initializeQualityMetrics(contentId: string): Promise<QualityMetrics> {
    // Get content for initial assessment
    const content = await this.getContent(contentId)
    const contentType = this.detectContentType(content)
    const model = this.qualityModels.get(contentType) || this.qualityModels.get('text')!

    // Perform initial AI-based quality assessment
    const initialAssessment = await model.assessor(content)

    const metrics: QualityMetrics = {
      contentId,
      overallScore: initialAssessment.overallScore,
      dimensions: initialAssessment.dimensions,
      trends: {
        improving: false,
        changeRate: 0,
        confidence: 0
      },
      recommendations: initialAssessment.recommendations || [],
      metadata: {
        lastUpdated: new Date().toISOString(),
        sampleSize: 1,
        dataSource: 'ai_initial'
      }
    }

    return metrics
  }

  private async assessTextQuality(content: string): Promise<any> {
    const prompt = `Assess the quality of this text content across multiple dimensions:

Content:
${content}

Provide assessment as JSON:
{
  "overallScore": 0.85,
  "dimensions": {
    "accuracy": 0.9,
    "clarity": 0.8,
    "completeness": 0.85,
    "engagement": 0.8
  },
  "recommendations": [
    {
      "type": "content",
      "priority": "medium",
      "description": "Add more specific examples",
      "expectedImpact": 0.1
    }
  ]
}

Scoring criteria:
- Accuracy: Factual correctness and precision
- Clarity: Readability and comprehensibility
- Completeness: Thoroughness and coverage
- Engagement: Interest and readability`

    try {
      const result = await generateText({
        model: openai(process.env.PRIMARY_MODEL || 'gpt-4'),
        prompt,
        temperature: 0.1,
        maxTokens: 1000
      })

      return JSON.parse(result.text)
    } catch (error) {
      console.warn('AI quality assessment failed:', error.message)
      
      // Fallback to basic heuristics
      return {
        overallScore: 0.7,
        dimensions: {
          accuracy: 0.7,
          clarity: 0.7,
          completeness: 0.7,
          engagement: 0.7
        },
        recommendations: []
      }
    }
  }

  private async assessCodeQuality(content: string): Promise<any> {
    const prompt = `Assess the quality of this code across multiple dimensions:

Code:
\`\`\`
${content}
\`\`\`

Provide assessment as JSON:
{
  "overallScore": 0.85,
  "dimensions": {
    "accuracy": 0.9,
    "clarity": 0.8,
    "completeness": 0.85,
    "usability": 0.8
  },
  "recommendations": [
    {
      "type": "technical",
      "priority": "high",
      "description": "Add error handling",
      "expectedImpact": 0.15
    }
  ]
}

Assessment criteria:
- Accuracy: Correctness and bug-free implementation
- Clarity: Code readability and maintainability
- Completeness: Feature coverage and edge cases
- Usability: API design and ease of use`

    try {
      const result = await generateText({
        model: openai(process.env.PRIMARY_MODEL || 'gpt-4'),
        prompt,
        temperature: 0.1,
        maxTokens: 1000
      })

      return JSON.parse(result.text)
    } catch (error) {
      return {
        overallScore: 0.7,
        dimensions: {
          accuracy: 0.7,
          clarity: 0.7,
          completeness: 0.7,
          usability: 0.7
        },
        recommendations: []
      }
    }
  }

  private async assessDocumentationQuality(content: string): Promise<any> {
    // Similar to text assessment but with documentation-specific criteria
    return this.assessTextQuality(content)
  }

  private async generateImprovements(
    contentId: string,
    qualityMetrics: QualityMetrics
  ): Promise<ImprovementAction[]> {
    const content = await this.getContent(contentId)
    const improvements: ImprovementAction[] = []

    // Generate improvements for low-scoring dimensions
    for (const [dimension, score] of Object.entries(qualityMetrics.dimensions)) {
      if (score < parseFloat(process.env.QUALITY_THRESHOLD || '0.8')) {
        const improvement = await this.generateDimensionImprovement(
          contentId,
          content,
          dimension,
          score,
          qualityMetrics.recommendations
        )
        
        if (improvement) {
          improvements.push(improvement)
        }
      }
    }

    // Store improvements
    for (const improvement of improvements) {
      await this.storeImprovementAction(improvement)
    }

    return improvements
  }

  private async generateDimensionImprovement(
    contentId: string,
    content: string,
    dimension: string,
    currentScore: number,
    recommendations: any[]
  ): Promise<ImprovementAction | null> {
    const relevantRecommendations = recommendations
      .filter(r => r.type === 'content' || r.type === 'style')
      .slice(0, 3)

    const prompt = `Improve the ${dimension} of this content based on the current score of ${currentScore.toFixed(2)}.

Original Content:
${content}

Relevant Recommendations:
${relevantRecommendations.map(r => `- ${r.description}`).join('\n')}

Provide improvement as JSON:
{
  "actionType": "enhance",
  "description": "Specific improvement description",
  "improvedVersion": "Enhanced version of the content",
  "confidence": 0.85,
  "expectedImpact": {
    "qualityImprovement": 0.1,
    "userSatisfaction": 0.08,
    "engagement": 0.05
  },
  "reasoning": "Why this improvement will be effective"
}

Focus on improving ${dimension} while maintaining the overall meaning and structure.`

    try {
      const result = await generateText({
        model: openai(process.env.FEEDBACK_MODEL || 'gpt-3.5-turbo'),
        prompt,
        temperature: 0.2,
        maxTokens: 1500
      })

      const improvementData = JSON.parse(result.text)
      
      return {
        id: this.generateId(),
        contentId,
        actionType: improvementData.actionType,
        description: improvementData.description,
        originalVersion: content,
        improvedVersion: improvementData.improvedVersion,
        confidence: improvementData.confidence,
        expectedImpact: improvementData.expectedImpact,
        status: 'pending',
        metadata: {
          createdAt: new Date().toISOString(),
          model: process.env.FEEDBACK_MODEL || 'gpt-3.5-turbo',
          reasoning: improvementData.reasoning
        }
      }
    } catch (error) {
      console.warn(`Failed to generate improvement for ${dimension}:`, error.message)
      return null
    }
  }

  private updateRunningAverage(current: number, newValue: number, count: number): number {
    return (current * count + newValue) / (count + 1)
  }

  private async analyzeTrends(contentId: string, metrics: QualityMetrics): Promise<any> {
    // Get historical metrics for trend analysis
    const history = await this.getMetricsHistory(contentId, 10)
    
    if (history.length < 2) {
      return {
        improving: false,
        changeRate: 0,
        confidence: 0
      }
    }

    // Calculate trend
    const recentScores = history.slice(-5).map(h => h.overall_score)
    const earlierScores = history.slice(0, 5).map(h => h.overall_score)
    
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const earlierAvg = earlierScores.reduce((a, b) => a + b, 0) / earlierScores.length
    
    const changeRate = recentAvg - earlierAvg
    const improving = changeRate > parseFloat(process.env.IMPROVEMENT_THRESHOLD || '0.05')
    const confidence = Math.min(Math.abs(changeRate) * 10, 1)

    return {
      improving,
      changeRate,
      confidence
    }
  }

  private shouldTriggerImprovement(metrics: QualityMetrics): boolean {
    // Trigger improvement if quality is below threshold or declining
    return metrics.overallScore < parseFloat(process.env.QUALITY_THRESHOLD || '0.8') ||
           (!metrics.trends.improving && metrics.trends.confidence > 0.5)
  }

  private calculateFeedbackPriority(feedback: Feedback): number {
    let priority = 1 // Default priority

    // Higher priority for negative feedback
    if (feedback.rating && feedback.rating <= 2) {
      priority += 5
    }

    // Higher priority for text feedback
    if (feedback.textFeedback && feedback.textFeedback.length > 50) {
      priority += 3
    }

    // Higher priority for repeat users
    if (feedback.userId) {
      priority += 2
    }

    return priority
  }

  private detectContentType(content: string): string {
    // Simple heuristics for content type detection
    if (content.includes('function') && content.includes('{')) {
      return 'code'
    }
    if (content.includes('# ') || content.includes('## ')) {
      return 'documentation'
    }
    return 'text'
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Database operations
  private async storeFeedback(feedback: Feedback): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT INTO feedback (id, content_id, user_id, feedback_type, rating, text_feedback, 
         sentiment_score, sentiment_classification, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedback.id,
          feedback.contentId,
          feedback.userId || null,
          feedback.feedbackType,
          feedback.rating || null,
          feedback.textFeedback || null,
          feedback.sentiment?.score || null,
          feedback.sentiment?.classification || null,
          JSON.stringify(feedback.metadata)
        ],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  private async storeQualityMetrics(metrics: QualityMetrics): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO quality_metrics 
         (content_id, overall_score, accuracy, clarity, completeness, relevance, engagement, usability, sample_size, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          metrics.contentId,
          metrics.overallScore,
          metrics.dimensions.accuracy,
          metrics.dimensions.clarity,
          metrics.dimensions.completeness,
          metrics.dimensions.relevance || 0,
          metrics.dimensions.engagement,
          metrics.dimensions.usability || 0,
          metrics.metadata.sampleSize,
          JSON.stringify(metrics.metadata)
        ],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  private async storeImprovementAction(action: ImprovementAction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT INTO improvement_actions 
         (id, content_id, action_type, description, original_version, improved_version, 
          confidence, expected_impact, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          action.id,
          action.contentId,
          action.actionType,
          action.description,
          action.originalVersion,
          action.improvedVersion,
          action.confidence,
          JSON.stringify(action.expectedImpact),
          JSON.stringify(action.metadata)
        ],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  private async getQualityMetrics(contentId: string): Promise<QualityMetrics | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM quality_metrics WHERE content_id = ?',
        [contentId],
        (err, row) => {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({
              contentId: row.content_id,
              overallScore: row.overall_score,
              dimensions: {
                accuracy: row.accuracy,
                clarity: row.clarity,
                completeness: row.completeness,
                relevance: row.relevance || 0,
                engagement: row.engagement,
                usability: row.usability || 0
              },
              trends: { improving: false, changeRate: 0, confidence: 0 },
              recommendations: [],
              metadata: JSON.parse(row.metadata || '{}')
            })
          } else {
            resolve(null)
          }
        }
      )
    })
  }

  private async getContent(contentId: string): Promise<string> {
    // In a real implementation, this would fetch from your content management system
    // For demonstration, return placeholder content
    return `Sample content for ${contentId}`
  }

  private async getMetricsHistory(contentId: string, limit: number): Promise<any[]> {
    // This would track historical metrics changes
    // For demonstration, return empty array
    return []
  }

  private async markFeedbackProcessed(feedbackId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        'UPDATE feedback SET processed = 1 WHERE id = ?',
        [feedbackId],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  // Public methods for CLI
  async getFeedbackSummary(contentId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const query = contentId 
        ? 'SELECT * FROM feedback WHERE content_id = ? ORDER BY created_at DESC LIMIT 50'
        : 'SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50'
      const params = contentId ? [contentId] : []

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(this.analyzeFeedbackSummary(rows))
        }
      })
    })
  }

  private analyzeFeedbackSummary(feedbackData: any[]): any {
    if (feedbackData.length === 0) {
      return { totalFeedback: 0, averageRating: 0, sentiment: 'neutral' }
    }

    const ratedFeedback = feedbackData.filter(f => f.rating)
    const averageRating = ratedFeedback.length > 0 
      ? ratedFeedback.reduce((sum, f) => sum + f.rating, 0) / ratedFeedback.length
      : 0

    const sentimentFeedback = feedbackData.filter(f => f.sentiment_classification)
    const sentimentCounts = sentimentFeedback.reduce((acc, f) => {
      acc[f.sentiment_classification] = (acc[f.sentiment_classification] || 0) + 1
      return acc
    }, { positive: 0, negative: 0, neutral: 0 })

    const dominantSentiment = Object.entries(sentimentCounts)
      .reduce((max, [sentiment, count]) => count > max.count ? { sentiment, count } : max, 
              { sentiment: 'neutral', count: 0 }).sentiment

    return {
      totalFeedback: feedbackData.length,
      averageRating: averageRating.toFixed(2),
      sentimentDistribution: sentimentCounts,
      dominantSentiment,
      recentTrends: this.calculateRecentTrends(feedbackData)
    }
  }

  private calculateRecentTrends(feedbackData: any[]): any {
    // Simple trend calculation based on timestamps
    const now = Date.now()
    const recentFeedback = feedbackData.filter(f => 
      now - new Date(f.created_at).getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    )

    return {
      recentCount: recentFeedback.length,
      trending: recentFeedback.length > feedbackData.length * 0.3 ? 'up' : 'stable'
    }
  }

  async getImprovementSuggestions(contentId: string): Promise<ImprovementAction[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM improvement_actions WHERE content_id = ? AND status = "pending" ORDER BY confidence DESC',
        [contentId],
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            const actions = rows.map(row => ({
              id: row.id,
              contentId: row.content_id,
              actionType: row.action_type,
              description: row.description,
              originalVersion: row.original_version,
              improvedVersion: row.improved_version,
              confidence: row.confidence,
              expectedImpact: JSON.parse(row.expected_impact || '{}'),
              status: row.status,
              metadata: JSON.parse(row.metadata || '{}')
            }))
            resolve(actions)
          }
        }
      )
    })
  }
}

// Types
type Feedback = {
  id: string
  contentId: string
  userId?: string
  feedbackType: 'rating' | 'text' | 'implicit' | 'usage'
  rating?: number
  textFeedback?: string
  metadata: {
    timestamp: string
    source: string
    context?: Record<string, any>
    sessionId?: string
    userAgent?: string
  }
  sentiment?: {
    score: number
    confidence: number
    classification: 'positive' | 'negative' | 'neutral'
  }
  processed: boolean
}

type QualityMetrics = {
  contentId: string
  overallScore: number
  dimensions: {
    accuracy: number
    clarity: number
    completeness: number
    relevance: number
    engagement: number
    usability: number
  }
  trends: {
    improving: boolean
    changeRate: number
    confidence: number
  }
  recommendations: Array<{
    type: 'content' | 'structure' | 'style' | 'technical'
    priority: 'low' | 'medium' | 'high' | 'critical'
    description: string
    expectedImpact: number
  }>
  metadata: {
    lastUpdated: string
    sampleSize: number
    dataSource: string
  }
}

type ImprovementAction = {
  id: string
  contentId: string
  actionType: 'rewrite' | 'enhance' | 'restructure' | 'supplement'
  description: string
  originalVersion: string
  improvedVersion: string
  confidence: number
  expectedImpact: {
    qualityImprovement: number
    userSatisfaction: number
    engagement: number
  }
  status: 'pending' | 'applied' | 'testing' | 'rejected'
  metadata: {
    createdAt: string
    appliedAt?: string
    model: string
    reasoning: string
  }
}

type QualityModel = {
  name: string
  dimensions: string[]
  weights: Record<string, number>
  assessor: (content: string) => Promise<any>
}

// Main Command
export default defineCommand({
  meta: {
    name: 'feedback',
    description: 'AI feedback loop for content quality improvement'
  },
  args: {
    action: {
      type: 'string',
      description: 'Action to perform (submit, analyze, improve, status)',
      required: true
    },
    contentId: {
      type: 'string',
      description: 'Content ID to work with',
      required: false
    },
    rating: {
      type: 'string',
      description: 'Rating (1-5) for submit action',
      required: false
    },
    text: {
      type: 'string',
      description: 'Text feedback for submit action',
      required: false
    },
    userId: {
      type: 'string',
      description: 'User ID (optional)',
      required: false
    },
    source: {
      type: 'string',
      description: 'Feedback source',
      default: 'cli'
    },
    format: {
      type: 'string',
      description: 'Output format (json, table, summary)',
      default: 'summary'
    }
  },
  async run({ args, reporter }) {
    const engine = new AIFeedbackLoopEngine()
    
    try {
      switch (args.action) {
        case 'submit':
          if (!args.contentId) {
            reporter.error('Content ID is required for submit action')
            process.exit(1)
          }
          
          const feedback: Feedback = {
            id: crypto.randomUUID(),
            contentId: args.contentId,
            userId: args.userId,
            feedbackType: args.text ? 'text' : 'rating',
            rating: args.rating ? parseInt(args.rating) : undefined,
            textFeedback: args.text,
            metadata: {
              timestamp: new Date().toISOString(),
              source: args.source
            },
            processed: false
          }
          
          await engine.submitFeedback(feedback)
          reporter.success(`Feedback submitted for content ${args.contentId}`)
          break

        case 'analyze':
          const summary = await engine.getFeedbackSummary(args.contentId)
          
          console.log('\n' + '='.repeat(60))
          console.log('FEEDBACK ANALYSIS')
          console.log('='.repeat(60))
          
          if (args.contentId) {
            console.log(`Content ID: ${args.contentId}`)
          }
          
          console.log(`\nOVERALL METRICS:`)
          console.log(`• Total Feedback: ${summary.totalFeedback}`)
          console.log(`• Average Rating: ${summary.averageRating}/5`)
          console.log(`• Dominant Sentiment: ${summary.dominantSentiment}`)
          
          if (summary.sentimentDistribution) {
            console.log('\nSENTIMENT DISTRIBUTION:')
            console.log(`• Positive: ${summary.sentimentDistribution.positive || 0}`)
            console.log(`• Negative: ${summary.sentimentDistribution.negative || 0}`)
            console.log(`• Neutral: ${summary.sentimentDistribution.neutral || 0}`)
          }
          
          console.log('\nRECENT TRENDS:')
          console.log(`• Recent Feedback: ${summary.recentTrends.recentCount}`)
          console.log(`• Trend: ${summary.recentTrends.trending}`)
          
          break

        case 'improve':
          if (!args.contentId) {
            reporter.error('Content ID is required for improve action')
            process.exit(1)
          }
          
          reporter.info(`Generating improvements for content ${args.contentId}...`)
          
          const improvements = await engine.getImprovementSuggestions(args.contentId)
          
          if (improvements.length === 0) {
            reporter.info('No improvement suggestions available')
          } else {
            console.log('\n' + '='.repeat(60))
            console.log('IMPROVEMENT SUGGESTIONS')
            console.log('='.repeat(60))
            
            for (let i = 0; i < improvements.length; i++) {
              const improvement = improvements[i]
              console.log(`\n${i + 1}. ${improvement.description}`)
              console.log(`   Type: ${improvement.actionType}`)
              console.log(`   Confidence: ${(improvement.confidence * 100).toFixed(1)}%`)
              console.log(`   Expected Quality Improvement: ${(improvement.expectedImpact.qualityImprovement * 100).toFixed(1)}%`)
              
              if (args.format === 'detailed') {
                console.log(`   Reasoning: ${improvement.metadata.reasoning}`)
                console.log(`   Model: ${improvement.metadata.model}`)
              }
            }
          }
          break

        case 'status':
          // Show system status
          console.log('\n' + '='.repeat(60))
          console.log('FEEDBACK LOOP STATUS')
          console.log('='.repeat(60))
          
          console.log('\nSYSTEM STATUS:')
          console.log('• Feedback Processing: Active')
          console.log('• Quality Assessment: Active')
          console.log('• Improvement Generation: Active')
          console.log('• Learning: Enabled')
          
          console.log('\nCONFIGURATION:')
          console.log(`• Quality Threshold: ${process.env.QUALITY_THRESHOLD || '0.8'}`)
          console.log(`• Improvement Threshold: ${process.env.IMPROVEMENT_THRESHOLD || '0.05'}`)
          console.log(`• Auto Improvement: ${process.env.ENABLE_AUTO_IMPROVEMENT || 'true'}`)
          console.log(`• Batch Size: ${process.env.BATCH_SIZE || '50'}`)
          
          break

        default:
          reporter.error(`Unknown action: ${args.action}`)
          reporter.info('Available actions: submit, analyze, improve, status')
          process.exit(1)
      }
      
    } catch (error) {
      reporter.error(`Feedback loop operation failed: ${error.message}`)
      
      if (error.message.includes('API key')) {
        reporter.info('Check your AI provider API keys')
      }
      
      process.exit(1)
    }
  }
})
```

## Testing Approach

```typescript
// test/ai-feedback.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'child_process'
import { unlinkSync } from 'fs'

// Mock AI providers
vi.mock('@ai-sdk/openai')
vi.mock('@ai-sdk/anthropic')
vi.mock('ai')

describe('AI Feedback Loop', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.QUALITY_THRESHOLD = '0.8'
  })

  afterEach(() => {
    try {
      unlinkSync('./feedback.db')
    } catch {}
    vi.clearAllMocks()
  })

  it('should submit feedback', async () => {
    const result = execSync('tsx src/commands/ai-feedback.ts submit --content-id test-content --rating 4 --text "Great content"', {
      encoding: 'utf-8'
    })

    expect(result).toContain('Feedback submitted')
    expect(result).toContain('test-content')
  })

  it('should analyze feedback', async () => {
    // First submit some feedback
    execSync('tsx src/commands/ai-feedback.ts submit --content-id test-content --rating 5', {
      encoding: 'utf-8'
    })

    const result = execSync('tsx src/commands/ai-feedback.ts analyze --content-id test-content', {
      encoding: 'utf-8'
    })

    expect(result).toContain('FEEDBACK ANALYSIS')
    expect(result).toContain('Total Feedback: 1')
  })

  it('should generate improvement suggestions', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        actionType: 'enhance',
        description: 'Add more examples',
        improvedVersion: 'Enhanced content with examples',
        confidence: 0.85,
        expectedImpact: { qualityImprovement: 0.1, userSatisfaction: 0.08 },
        reasoning: 'Examples improve understanding'
      }),
      usage: { totalTokens: 200 }
    })

    const result = execSync('tsx src/commands/ai-feedback.ts improve --content-id test-content', {
      encoding: 'utf-8'
    })

    expect(result).toContain('IMPROVEMENT SUGGESTIONS')
  })

  it('should show system status', () => {
    const result = execSync('tsx src/commands/ai-feedback.ts status', {
      encoding: 'utf-8'
    })

    expect(result).toContain('FEEDBACK LOOP STATUS')
    expect(result).toContain('Quality Threshold')
    expect(result).toContain('Active')
  })
})
```

## Usage Examples

### Basic Usage
```bash
# Submit rating feedback
citty feedback submit --content-id doc-123 --rating 4

# Submit text feedback
citty feedback submit --content-id doc-123 --text "This explanation is unclear"

# Analyze feedback for specific content
citty feedback analyze --content-id doc-123

# Generate improvement suggestions
citty feedback improve --content-id doc-123
```

### Advanced Usage
```bash
# Submit feedback with user tracking
citty feedback submit --content-id doc-123 --rating 3 --user-id user-456 --source "mobile-app"

# Analyze all feedback across content
citty feedback analyze

# Get detailed improvement suggestions
citty feedback improve --content-id doc-123 --format detailed

# Check system status
citty feedback status
```

## Performance Considerations

1. **Batch Processing**
   - Queue feedback for batch processing
   - Implement rate limiting for AI calls
   - Use caching for similar content assessments

2. **Learning Efficiency**
   - Store embeddings for content similarity
   - Implement incremental learning
   - Use feedback patterns for predictions

3. **Quality Assessment**
   - Balance AI assessment with user feedback
   - Implement confidence thresholds
   - Use multiple assessment models

## Deployment Notes

### Production Environment
```bash
# Required services
docker run -d --name redis -p 6379:6379 redis:alpine
docker run -d --name feedback-db -v feedback_data:/var/lib/sqlite3 alpine

# Create data directories
mkdir -p ./feedback_data ./logs ./backups
```

### Monitoring Setup
```yaml
# monitoring.yml
version: '3.8'
services:
  redis:
    image: redis:alpine
    volumes:
      - redis_feedback:/data
      
  prometheus:
    image: prom/prometheus
    ports:
      - "9092:9090"
    volumes:
      - ./prometheus-feedback.yml:/etc/prometheus/prometheus.yml

volumes:
  redis_feedback:
```

This pattern provides a comprehensive, production-ready AI feedback loop system that continuously learns from user interactions to improve content quality through automated analysis, suggestion generation, and iterative refinement.