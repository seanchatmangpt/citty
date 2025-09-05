/**
 * 🧠 DARK MATTER: Streaming & Backpressure Management
 * The scalability infrastructure humans forget until it's too late
 */

import { Transform, Readable, Writable, pipeline } from 'stream'
import { EventEmitter } from 'events'
import { promisify } from 'util'

const pipelineAsync = promisify(pipeline)

export interface StreamingOptions {
  highWaterMark?: number
  objectMode?: boolean
  backpressureThreshold?: number
  maxConcurrency?: number
  bufferTimeout?: number
  enableMetrics?: boolean
}

export interface BackpressureState {
  level: 'normal' | 'warning' | 'critical' | 'overflow'
  bufferSize: number
  maxBuffer: number
  drainTime: number
  throttleRatio: number
}

export interface StreamMetrics {
  totalProcessed: number
  processingRate: number // items per second
  averageLatency: number
  errorRate: number
  backpressureEvents: number
  memoryUsage: number
  uptime: number
}

export interface ChunkProcessor<T, R> {
  process: (chunk: T) => Promise<R>
  concurrency?: number
  timeout?: number
}

/**
 * Advanced streaming system with intelligent backpressure management
 */
export class StreamingEngine extends EventEmitter {
  private activeStreams = new Map<string, NodeJS.ReadableStream>()
  private metrics = new Map<string, StreamMetrics>()
  private backpressureStates = new Map<string, BackpressureState>()
  private processingQueues = new Map<string, any[]>()
  private rateLimiters = new Map<string, RateLimiter>()
  
  constructor(private defaultOptions: StreamingOptions = {}) {
    super()
    this.setupDefaultOptions()
    this.startMetricsCollection()
  }

  /**
   * Create template streaming processor
   */
  createTemplateStream(
    templatePath: string,
    dataSource: AsyncIterable<any>,
    options: StreamingOptions = {}
  ): Promise<NodeJS.ReadableStream> {
    const opts = { ...this.defaultOptions, ...options }
    const streamId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const templateStream = new Transform({
      objectMode: opts.objectMode !== false,
      highWaterMark: opts.highWaterMark || 16,
      transform: async (chunk, encoding, callback) => {
        try {
          const startTime = Date.now()
          
          // Check backpressure
          const backpressure = this.checkBackpressure(streamId, opts)
          if (backpressure.level === 'critical') {
            // Implement backpressure strategy
            await this.handleBackpressure(streamId, backpressure)
          }

          // Process template with context
          const result = await this.processTemplateChunk(templatePath, chunk)
          
          // Update metrics
          this.updateMetrics(streamId, Date.now() - startTime, true)
          
          callback(null, result)
        } catch (error) {
          this.updateMetrics(streamId, 0, false, error)
          callback(error)
        }
      }
    })

    // Setup backpressure monitoring
    this.setupBackpressureMonitoring(templateStream, streamId, opts)
    
    this.activeStreams.set(streamId, templateStream)
    this.emit('stream:created', { streamId, type: 'template', templatePath })

    return Promise.resolve(templateStream)
  }

  /**
   * Create query result streaming processor
   */
  createQueryStream(
    query: string,
    options: StreamingOptions = {}
  ): NodeJS.ReadableStream {
    const opts = { ...this.defaultOptions, ...options }
    const streamId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const queryStream = new Readable({
      objectMode: opts.objectMode !== false,
      highWaterMark: opts.highWaterMark || 16,
      read() {
        // Implement query result streaming
        this.push(null) // End stream for now
      }
    })

    // Setup query result processing
    this.processQueryResults(query, queryStream, streamId, opts)
      .catch(error => queryStream.destroy(error))

    this.activeStreams.set(streamId, queryStream)
    this.emit('stream:created', { streamId, type: 'query', query })

    return queryStream
  }

  /**
   * Create batch processing stream with concurrency control
   */
  createBatchStream<T, R>(
    processor: ChunkProcessor<T, R>,
    options: StreamingOptions = {}
  ): Transform {
    const opts = { ...this.defaultOptions, ...options }
    const streamId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const concurrency = processor.concurrency || opts.maxConcurrency || 10
    
    let activeJobs = 0
    const jobQueue: Array<{ chunk: T, callback: Function }> = []

    const batchStream = new Transform({
      objectMode: opts.objectMode !== false,
      highWaterMark: opts.highWaterMark || 16,
      transform(chunk: T, encoding, callback) {
        if (activeJobs < concurrency) {
          this.processChunk(chunk, callback)
        } else {
          jobQueue.push({ chunk, callback })
        }
      }
    })

    // Add process method to stream
    ;(batchStream as any).processChunk = async (chunk: T, callback: Function) => {
      activeJobs++
      const startTime = Date.now()
      
      try {
        // Check backpressure before processing
        const backpressure = this.checkBackpressure(streamId, opts)
        if (backpressure.level !== 'normal') {
          await this.applyBackpressureControl(backpressure)
        }

        const result = await processor.process(chunk)
        
        this.updateMetrics(streamId, Date.now() - startTime, true)
        callback(null, result)
      } catch (error) {
        this.updateMetrics(streamId, Date.now() - startTime, false, error)
        callback(error)
      } finally {
        activeJobs--
        
        // Process next job from queue
        if (jobQueue.length > 0 && activeJobs < concurrency) {
          const nextJob = jobQueue.shift()!
          ;(batchStream as any).processChunk(nextJob.chunk, nextJob.callback)
        }
      }
    }

    this.activeStreams.set(streamId, batchStream)
    this.emit('stream:created', { streamId, type: 'batch', concurrency })

    return batchStream
  }

  /**
   * Create adaptive rate-limited stream
   */
  createRateLimitedStream(
    baseStream: NodeJS.ReadableStream,
    rateLimit: number, // items per second
    options: StreamingOptions = {}
  ): Transform {
    const opts = { ...this.defaultOptions, ...options }
    const streamId = `ratelimited_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const rateLimiter = new RateLimiter(rateLimit)

    const rateLimitedStream = new Transform({
      objectMode: opts.objectMode !== false,
      highWaterMark: opts.highWaterMark || 16,
      transform: async (chunk, encoding, callback) => {
        try {
          await rateLimiter.acquire()
          callback(null, chunk)
        } catch (error) {
          callback(error)
        }
      }
    })

    this.rateLimiters.set(streamId, rateLimiter)
    this.activeStreams.set(streamId, rateLimitedStream)
    this.emit('stream:created', { streamId, type: 'rate-limited', rateLimit })

    return rateLimitedStream
  }

  /**
   * Create memory-efficient large data stream
   */
  createLargeDataStream(
    dataSource: string | AsyncIterable<any>,
    chunkSize: number = 1000,
    options: StreamingOptions = {}
  ): Readable {
    const opts = { ...this.defaultOptions, ...options }
    const streamId = `largedata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const largeDataStream = new Readable({
      objectMode: opts.objectMode !== false,
      highWaterMark: opts.highWaterMark || 16,
      read() {
        // Implement chunked reading logic
      }
    })

    // Setup chunked data processing
    this.processLargeDataInChunks(dataSource, chunkSize, largeDataStream, streamId, opts)
      .catch(error => largeDataStream.destroy(error))

    this.activeStreams.set(streamId, largeDataStream)
    this.emit('stream:created', { streamId, type: 'large-data', chunkSize })

    return largeDataStream
  }

  /**
   * Create pipeline with automatic error recovery
   */
  async createResilientPipeline(
    streams: NodeJS.ReadWriteStream[],
    options: StreamingOptions & {
      retryAttempts?: number
      retryDelay?: number
      errorHandler?: (error: Error, streamIndex: number) => void
    } = {}
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options }
    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    let attempts = 0
    const maxAttempts = opts.retryAttempts || 3
    const retryDelay = opts.retryDelay || 1000

    while (attempts < maxAttempts) {
      try {
        await pipelineAsync(...streams)
        this.emit('pipeline:completed', { pipelineId, attempts })
        return
      } catch (error) {
        attempts++
        
        if (opts.errorHandler) {
          opts.errorHandler(error as Error, -1)
        }

        this.emit('pipeline:error', { 
          pipelineId, 
          error: error.message, 
          attempt: attempts 
        })

        if (attempts < maxAttempts) {
          await this.delay(retryDelay * attempts) // Exponential backoff
        } else {
          throw error
        }
      }
    }
  }

  /**
   * Check backpressure state
   */
  checkBackpressure(streamId: string, options: StreamingOptions): BackpressureState {
    const stream = this.activeStreams.get(streamId)
    if (!stream || !stream.readable) {
      return {
        level: 'normal',
        bufferSize: 0,
        maxBuffer: options.highWaterMark || 16,
        drainTime: 0,
        throttleRatio: 1.0
      }
    }

    const bufferSize = (stream as any)._readableState?.length || 0
    const maxBuffer = options.highWaterMark || 16
    const threshold = options.backpressureThreshold || 0.8

    let level: BackpressureState['level'] = 'normal'
    let throttleRatio = 1.0

    if (bufferSize >= maxBuffer) {
      level = 'overflow'
      throttleRatio = 0.1
    } else if (bufferSize >= maxBuffer * 0.9) {
      level = 'critical'
      throttleRatio = 0.3
    } else if (bufferSize >= maxBuffer * threshold) {
      level = 'warning'
      throttleRatio = 0.7
    }

    const state: BackpressureState = {
      level,
      bufferSize,
      maxBuffer,
      drainTime: 0,
      throttleRatio
    }

    this.backpressureStates.set(streamId, state)
    return state
  }

  /**
   * Handle backpressure situation
   */
  private async handleBackpressure(streamId: string, state: BackpressureState): Promise<void> {
    this.emit('backpressure:detected', { streamId, state })

    switch (state.level) {
      case 'warning':
        // Light throttling
        await this.delay(10)
        break
      
      case 'critical':
        // Heavy throttling + try to drain
        await this.delay(50)
        await this.attemptStreamDrain(streamId)
        break
      
      case 'overflow':
        // Emergency measures
        await this.delay(200)
        await this.forceStreamDrain(streamId)
        break
    }
  }

  /**
   * Apply backpressure control
   */
  private async applyBackpressureControl(state: BackpressureState): Promise<void> {
    if (state.throttleRatio < 1.0) {
      const delay = Math.max(1, Math.floor((1 - state.throttleRatio) * 100))
      await this.delay(delay)
    }
  }

  /**
   * Attempt to drain stream buffer
   */
  private async attemptStreamDrain(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId)
    if (!stream) return

    return new Promise<void>((resolve) => {
      if (stream.readable && (stream as any)._readableState?.needReadable) {
        stream.once('readable', () => {
          // Try to read data to drain buffer
          let chunk
          while (null !== (chunk = stream.read())) {
            // Process or discard chunks to reduce backpressure
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Force stream drain (emergency)
   */
  private async forceStreamDrain(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId)
    if (!stream) return

    // Emergency drain - more aggressive
    if ((stream as any)._readableState) {
      (stream as any)._readableState.buffer.clear?.()
    }

    this.emit('backpressure:force-drained', { streamId })
  }

  /**
   * Setup backpressure monitoring
   */
  private setupBackpressureMonitoring(
    stream: NodeJS.ReadWriteStream,
    streamId: string,
    options: StreamingOptions
  ): void {
    // Monitor drain events
    stream.on('drain', () => {
      const state = this.checkBackpressure(streamId, options)
      this.emit('backpressure:drained', { streamId, state })
    })

    // Monitor error events
    stream.on('error', (error) => {
      this.emit('stream:error', { streamId, error: error.message })
    })

    // Monitor finish events
    stream.on('finish', () => {
      this.cleanupStream(streamId)
    })
  }

  /**
   * Process template chunk
   */
  private async processTemplateChunk(templatePath: string, context: any): Promise<string> {
    // Would integrate with actual template engine
    // For now, return processed template mock
    return `Processed: ${templatePath} with ${JSON.stringify(context).slice(0, 100)}`
  }

  /**
   * Process query results in streaming fashion
   */
  private async processQueryResults(
    query: string,
    stream: Readable,
    streamId: string,
    options: StreamingOptions
  ): Promise<void> {
    // Mock query result streaming
    const results = [
      { subject: 'ex:item1', predicate: 'ex:property', object: 'value1' },
      { subject: 'ex:item2', predicate: 'ex:property', object: 'value2' },
      { subject: 'ex:item3', predicate: 'ex:property', object: 'value3' }
    ]

    for (const result of results) {
      const backpressure = this.checkBackpressure(streamId, options)
      if (backpressure.level !== 'normal') {
        await this.applyBackpressureControl(backpressure)
      }

      if (!stream.push(result)) {
        // Wait for drain event
        await new Promise(resolve => stream.once('drain', resolve))
      }

      await this.delay(10) // Simulate processing time
    }

    stream.push(null) // End stream
  }

  /**
   * Process large data in memory-efficient chunks
   */
  private async processLargeDataInChunks(
    dataSource: string | AsyncIterable<any>,
    chunkSize: number,
    stream: Readable,
    streamId: string,
    options: StreamingOptions
  ): Promise<void> {
    if (typeof dataSource === 'string') {
      // Process file in chunks
      const chunks = Math.ceil(dataSource.length / chunkSize)
      
      for (let i = 0; i < chunks; i++) {
        const chunk = dataSource.slice(i * chunkSize, (i + 1) * chunkSize)
        
        const backpressure = this.checkBackpressure(streamId, options)
        if (backpressure.level !== 'normal') {
          await this.applyBackpressureControl(backpressure)
        }

        if (!stream.push(chunk)) {
          await new Promise(resolve => stream.once('drain', resolve))
        }
      }
    } else {
      // Process async iterable
      for await (const item of dataSource) {
        const backpressure = this.checkBackpressure(streamId, options)
        if (backpressure.level !== 'normal') {
          await this.applyBackpressureControl(backpressure)
        }

        if (!stream.push(item)) {
          await new Promise(resolve => stream.once('drain', resolve))
        }
      }
    }

    stream.push(null) // End stream
  }

  /**
   * Update stream metrics
   */
  private updateMetrics(
    streamId: string,
    latency: number,
    success: boolean,
    error?: Error
  ): void {
    let metrics = this.metrics.get(streamId)
    if (!metrics) {
      metrics = {
        totalProcessed: 0,
        processingRate: 0,
        averageLatency: 0,
        errorRate: 0,
        backpressureEvents: 0,
        memoryUsage: 0,
        uptime: Date.now()
      }
      this.metrics.set(streamId, metrics)
    }

    metrics.totalProcessed++
    metrics.averageLatency = (metrics.averageLatency + latency) / 2

    if (!success) {
      metrics.errorRate = (metrics.errorRate + 1) / Math.max(1, metrics.totalProcessed)
    }

    // Calculate processing rate
    const uptimeSeconds = (Date.now() - metrics.uptime) / 1000
    metrics.processingRate = metrics.totalProcessed / Math.max(1, uptimeSeconds)
  }

  /**
   * Setup default options
   */
  private setupDefaultOptions(): void {
    this.defaultOptions = {
      highWaterMark: 16,
      objectMode: true,
      backpressureThreshold: 0.8,
      maxConcurrency: 10,
      bufferTimeout: 5000,
      enableMetrics: true,
      ...this.defaultOptions
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      for (const [streamId, metrics] of this.metrics) {
        this.emit('metrics:updated', { streamId, metrics })
      }
    }, 10000) // Every 10 seconds
  }

  /**
   * Cleanup stream resources
   */
  private cleanupStream(streamId: string): void {
    this.activeStreams.delete(streamId)
    this.backpressureStates.delete(streamId)
    this.rateLimiters.delete(streamId)
    this.emit('stream:cleaned', { streamId })
  }

  /**
   * Get stream metrics
   */
  getStreamMetrics(streamId?: string): StreamMetrics | Record<string, StreamMetrics> {
    if (streamId) {
      return this.metrics.get(streamId) || {} as StreamMetrics
    }
    return Object.fromEntries(this.metrics)
  }

  /**
   * Get backpressure status
   */
  getBackpressureStatus(): Record<string, BackpressureState> {
    return Object.fromEntries(this.backpressureStates)
  }

  /**
   * Get active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys())
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Destroy all streams and cleanup
   */
  destroy(): void {
    for (const stream of this.activeStreams.values()) {
      if (stream.destroy) {
        stream.destroy()
      }
    }
    
    this.activeStreams.clear()
    this.metrics.clear()
    this.backpressureStates.clear()
    this.processingQueues.clear()
    this.rateLimiters.clear()
    this.removeAllListeners()
  }
}

/**
 * Rate limiter implementation
 */
class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number // tokens per second

  constructor(rateLimit: number) {
    this.maxTokens = rateLimit
    this.refillRate = rateLimit
    this.tokens = rateLimit
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()
    
    if (this.tokens >= 1) {
      this.tokens--
      return Promise.resolve()
    }

    // Wait for next token
    const waitTime = (1000 / this.refillRate) * (1 - this.tokens)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    
    return this.acquire() // Retry after wait
  }

  private refill(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const tokensToAdd = Math.floor(timePassed * this.refillRate)
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
      this.lastRefill = now
    }
  }
}

// Singleton instance
export const streamingEngine = new StreamingEngine()

// Convenience functions
export async function createTemplateStream(
  templatePath: string,
  dataSource: AsyncIterable<any>,
  options?: StreamingOptions
): Promise<NodeJS.ReadableStream> {
  return streamingEngine.createTemplateStream(templatePath, dataSource, options)
}

export function createQueryStream(query: string, options?: StreamingOptions): NodeJS.ReadableStream {
  return streamingEngine.createQueryStream(query, options)
}

export function createBatchStream<T, R>(
  processor: ChunkProcessor<T, R>,
  options?: StreamingOptions
): Transform {
  return streamingEngine.createBatchStream(processor, options)
}

export function createRateLimitedStream(
  stream: NodeJS.ReadableStream,
  rateLimit: number,
  options?: StreamingOptions
): Transform {
  return streamingEngine.createRateLimitedStream(stream, rateLimit, options)
}

export async function createResilientPipeline(
  streams: NodeJS.ReadWriteStream[],
  options?: Parameters<StreamingEngine['createResilientPipeline']>[1]
): Promise<void> {
  return streamingEngine.createResilientPipeline(streams, options)
}