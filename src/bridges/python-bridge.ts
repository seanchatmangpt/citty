/**
 * Python Bridge for CNS Integration
 * 
 * Provides seamless integration between Citty CLI and CNS Python-based systems,
 * including ontology processing, semantic analysis, and AI-driven workflows.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { z } from 'zod'
import { performance } from 'perf_hooks'

// Configuration schemas
const PythonBridgeConfigSchema = z.object({
  pythonPath: z.string().default('python3'),
  cnsPath: z.string(),
  maxRetries: z.number().default(3),
  timeout: z.number().default(30000),
  poolSize: z.number().default(5),
  healthCheckInterval: z.number().default(60000)
})

const OntologyProcessingRequestSchema = z.object({
  operation: z.enum(['validate', 'transform', 'query', 'reasoner', 'aot-compile']),
  input: z.string(),
  format: z.enum(['owl', 'rdf', 'ttl', 'n3', 'json-ld']),
  outputFormat: z.enum(['owl', 'rdf', 'ttl', 'n3', 'json-ld', 'fuller-canon']).optional(),
  options: z.record(z.any()).optional()
})

type PythonBridgeConfig = z.infer<typeof PythonBridgeConfigSchema>
type OntologyProcessingRequest = z.infer<typeof OntologyProcessingRequestSchema>

interface ProcessingResult {
  success: boolean
  data?: any
  error?: string
  performance: {
    latency: number
    throughput?: number
    memoryUsage: number
  }
  metadata: {
    processId: string
    timestamp: number
    version: string
  }
}

/**
 * Connection Pool for managing Python process instances
 */
class PythonProcessPool extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map()
  private available: string[] = []
  private busy: Set<string> = new Set()
  private config: PythonBridgeConfig

  constructor(config: PythonBridgeConfig) {
    super()
    this.config = config
    this.initializePool()
  }

  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.poolSize; i++) {
      const processId = `python-worker-${i}`
      const process = await this.createPythonProcess(processId)
      this.processes.set(processId, process)
      this.available.push(processId)
    }

    // Setup health check
    setInterval(() => this.healthCheck(), this.config.healthCheckInterval)
  }

  private async createPythonProcess(processId: string): Promise<ChildProcess> {
    const process = spawn(this.config.pythonPath, [
      '-c',
      `
import sys
import json
import traceback
import os
sys.path.append('${this.config.cnsPath}')

# Import CNS modules
try:
    from cns.ontology import OntologyProcessor
    from cns.semantic import SemanticAnalyzer
    from cns.ai import AIWorkflowEngine
    from cns.performance import PerformanceMonitor
    
    processor = OntologyProcessor()
    analyzer = SemanticAnalyzer()
    ai_engine = AIWorkflowEngine()
    perf_monitor = PerformanceMonitor()
    
    print(json.dumps({"status": "ready", "process_id": "${processId}"}))
    sys.stdout.flush()
    
    # Main processing loop
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            
            start_time = perf_monitor.start_timer()
            
            if request['operation'] == 'validate':
                result = processor.validate_ontology(request['input'], request['format'])
            elif request['operation'] == 'transform':
                result = processor.transform(
                    request['input'], 
                    request['format'], 
                    request['outputFormat']
                )
            elif request['operation'] == 'query':
                result = analyzer.query_semantic(request['input'], request.get('options', {}))
            elif request['operation'] == 'reasoner':
                result = processor.apply_reasoning(request['input'], request.get('options', {}))
            elif request['operation'] == 'aot-compile':
                result = processor.aot_compile(request['input'], request.get('options', {}))
            else:
                raise ValueError(f"Unknown operation: {request['operation']}")
            
            latency = perf_monitor.end_timer(start_time)
            
            response = {
                "success": True,
                "data": result,
                "performance": {
                    "latency": latency,
                    "memoryUsage": perf_monitor.get_memory_usage()
                },
                "metadata": {
                    "processId": "${processId}",
                    "timestamp": perf_monitor.get_timestamp(),
                    "version": processor.get_version()
                }
            }
            
        except Exception as e:
            response = {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "performance": {
                    "latency": perf_monitor.end_timer(start_time) if 'start_time' in locals() else 0,
                    "memoryUsage": perf_monitor.get_memory_usage()
                },
                "metadata": {
                    "processId": "${processId}",
                    "timestamp": perf_monitor.get_timestamp(),
                    "version": "unknown"
                }
            }
        
        print(json.dumps(response))
        sys.stdout.flush()
        
except ImportError as e:
    print(json.dumps({"status": "error", "error": f"Failed to import CNS modules: {e}"}))
    sys.stdout.flush()
      `
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.cnsPath,
      env: {
        ...process.env,
        PYTHONPATH: this.config.cnsPath,
        CNS_PERFORMANCE_MODE: 'high',
        CNS_LOG_LEVEL: 'info'
      }
    })

    // Handle process lifecycle
    process.on('error', (error) => {
      this.emit('processError', { processId, error })
      this.restartProcess(processId)
    })

    process.on('exit', (code, signal) => {
      this.emit('processExit', { processId, code, signal })
      if (code !== 0) {
        this.restartProcess(processId)
      }
    })

    return process
  }

  async acquireProcess(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.available.length === 0) {
        // Wait for available process
        this.once('processAvailable', resolve)
        setTimeout(() => reject(new Error('Process acquisition timeout')), 5000)
        return
      }

      const processId = this.available.pop()!
      this.busy.add(processId)
      resolve(processId)
    })
  }

  releaseProcess(processId: string): void {
    if (this.busy.has(processId)) {
      this.busy.delete(processId)
      this.available.push(processId)
      this.emit('processAvailable', processId)
    }
  }

  getProcess(processId: string): ChildProcess | undefined {
    return this.processes.get(processId)
  }

  private async restartProcess(processId: string): Promise<void> {
    // Clean up old process
    const oldProcess = this.processes.get(processId)
    if (oldProcess) {
      oldProcess.kill()
      this.processes.delete(processId)
    }

    // Remove from available/busy lists
    const availableIndex = this.available.indexOf(processId)
    if (availableIndex !== -1) {
      this.available.splice(availableIndex, 1)
    }
    this.busy.delete(processId)

    // Create new process
    try {
      const newProcess = await this.createPythonProcess(processId)
      this.processes.set(processId, newProcess)
      this.available.push(processId)
      this.emit('processRestarted', processId)
    } catch (error) {
      this.emit('processRestartFailed', { processId, error })
    }
  }

  private async healthCheck(): Promise<void> {
    const healthPromises = Array.from(this.processes.entries()).map(
      async ([processId, process]) => {
        try {
          // Send health check request
          const healthRequest = {
            operation: 'health-check',
            input: '',
            format: 'ttl' as const
          }

          const result = await this.executeRequest(processId, healthRequest, 5000)
          
          if (!result.success) {
            this.emit('healthCheckFailed', { processId, error: result.error })
            await this.restartProcess(processId)
          }
        } catch (error) {
          this.emit('healthCheckFailed', { processId, error })
          await this.restartProcess(processId)
        }
      }
    )

    await Promise.allSettled(healthPromises)
  }

  async executeRequest(
    processId: string,
    request: OntologyProcessingRequest,
    timeout?: number
  ): Promise<ProcessingResult> {
    const process = this.getProcess(processId)
    if (!process) {
      throw new Error(`Process ${processId} not found`)
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.config.timeout
      let responseReceived = false

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true
          reject(new Error(`Request timeout after ${timeoutMs}ms`))
        }
      }, timeoutMs)

      // Set up response handler
      const onData = (data: Buffer) => {
        if (responseReceived) return

        try {
          const response = JSON.parse(data.toString())
          responseReceived = true
          clearTimeout(timeoutHandle)
          process.stdout?.off('data', onData)
          resolve(response)
        } catch (error) {
          responseReceived = true
          clearTimeout(timeoutHandle)
          process.stdout?.off('data', onData)
          reject(new Error(`Invalid JSON response: ${error}`))
        }
      }

      process.stdout?.on('data', onData)

      // Send request
      try {
        const requestJson = JSON.stringify(request) + '\n'
        process.stdin?.write(requestJson)
      } catch (error) {
        responseReceived = true
        clearTimeout(timeoutHandle)
        process.stdout?.off('data', onData)
        reject(error)
      }
    })
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.processes.values()).map(
      process => new Promise<void>((resolve) => {
        process.on('exit', () => resolve())
        process.kill('SIGTERM')
        setTimeout(() => process.kill('SIGKILL'), 5000)
      })
    )

    await Promise.all(shutdownPromises)
    this.processes.clear()
    this.available.length = 0
    this.busy.clear()
  }
}

/**
 * Main Python Bridge class for CNS integration
 */
export class PythonBridge extends EventEmitter {
  private pool: PythonProcessPool
  private config: PythonBridgeConfig
  private metrics: {
    requestsTotal: number
    requestsSuccessful: number
    requestsFailed: number
    averageLatency: number
    totalLatency: number
  } = {
    requestsTotal: 0,
    requestsSuccessful: 0,
    requestsFailed: 0,
    averageLatency: 0,
    totalLatency: 0
  }

  constructor(config: Partial<PythonBridgeConfig> = {}) {
    super()
    this.config = PythonBridgeConfigSchema.parse(config)
    this.pool = new PythonProcessPool(this.config)

    // Forward pool events
    this.pool.on('processError', (data) => this.emit('processError', data))
    this.pool.on('processExit', (data) => this.emit('processExit', data))
    this.pool.on('processRestarted', (data) => this.emit('processRestarted', data))
    this.pool.on('healthCheckFailed', (data) => this.emit('healthCheckFailed', data))
  }

  /**
   * Process ontology with CNS Python backend
   */
  async processOntology(request: OntologyProcessingRequest): Promise<ProcessingResult> {
    const startTime = performance.now()
    let processId: string | null = null

    try {
      // Validate request
      const validatedRequest = OntologyProcessingRequestSchema.parse(request)

      // Acquire process from pool
      processId = await this.pool.acquireProcess()

      // Execute request with retries
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          const result = await this.pool.executeRequest(processId, validatedRequest)
          
          // Update metrics
          const latency = performance.now() - startTime
          this.updateMetrics(true, latency)

          // Enhance result with bridge metadata
          result.performance.latency = Math.min(result.performance.latency, latency)
          result.metadata.bridgeVersion = '1.0.0'
          result.metadata.attempt = attempt

          return result
        } catch (error) {
          lastError = error as Error
          if (attempt < this.config.maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }
      }

      throw lastError || new Error('All retry attempts failed')

    } catch (error) {
      const latency = performance.now() - startTime
      this.updateMetrics(false, latency)

      const result: ProcessingResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          latency,
          memoryUsage: process.memoryUsage().heapUsed
        },
        metadata: {
          processId: processId || 'unknown',
          timestamp: Date.now(),
          version: '1.0.0',
          bridgeVersion: '1.0.0'
        }
      }

      return result
    } finally {
      if (processId) {
        this.pool.releaseProcess(processId)
      }
    }
  }

  /**
   * Validate ontology using CNS validator
   */
  async validateOntology(input: string, format: string): Promise<ProcessingResult> {
    return this.processOntology({
      operation: 'validate',
      input,
      format: format as any
    })
  }

  /**
   * Transform ontology between formats
   */
  async transformOntology(
    input: string,
    sourceFormat: string,
    targetFormat: string,
    options?: Record<string, any>
  ): Promise<ProcessingResult> {
    return this.processOntology({
      operation: 'transform',
      input,
      format: sourceFormat as any,
      outputFormat: targetFormat as any,
      options
    })
  }

  /**
   * Apply semantic reasoning
   */
  async applyReasoning(input: string, options?: Record<string, any>): Promise<ProcessingResult> {
    return this.processOntology({
      operation: 'reasoner',
      input,
      format: 'owl',
      options
    })
  }

  /**
   * AOT compile ontology for performance
   */
  async compileAOT(input: string, options?: Record<string, any>): Promise<ProcessingResult> {
    return this.processOntology({
      operation: 'aot-compile',
      input,
      format: 'owl',
      options
    })
  }

  /**
   * Query semantic knowledge base
   */
  async querySemantic(input: string, options?: Record<string, any>): Promise<ProcessingResult> {
    return this.processOntology({
      operation: 'query',
      input,
      format: 'ttl',
      options
    })
  }

  private updateMetrics(success: boolean, latency: number): void {
    this.metrics.requestsTotal++
    this.metrics.totalLatency += latency
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.requestsTotal

    if (success) {
      this.metrics.requestsSuccessful++
    } else {
      this.metrics.requestsFailed++
    }

    // Emit metrics event
    this.emit('metrics', { ...this.metrics })
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.requestsTotal > 0 
        ? this.metrics.requestsSuccessful / this.metrics.requestsTotal 
        : 0,
      errorRate: this.metrics.requestsTotal > 0 
        ? this.metrics.requestsFailed / this.metrics.requestsTotal 
        : 0
    }
  }

  /**
   * Get bridge health status
   */
  async getHealth() {
    return {
      status: 'healthy',
      poolSize: this.config.poolSize,
      availableProcesses: this.pool['available'].length,
      busyProcesses: this.pool['busy'].size,
      metrics: this.getMetrics(),
      config: {
        pythonPath: this.config.pythonPath,
        cnsPath: this.config.cnsPath,
        maxRetries: this.config.maxRetries,
        timeout: this.config.timeout
      }
    }
  }

  /**
   * Shutdown bridge and cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.pool.shutdown()
    this.removeAllListeners()
  }
}

// Export types
export type {
  PythonBridgeConfig,
  OntologyProcessingRequest,
  ProcessingResult
}

export {
  PythonBridgeConfigSchema,
  OntologyProcessingRequestSchema
}