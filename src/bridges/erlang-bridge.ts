/**
 * Erlang Bridge for Bytestar Integration
 * 
 * Provides seamless integration between Citty CLI and Bytestar Erlang/OTP systems,
 * including consensus mechanisms, distributed computing, and performance optimization.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { z } from 'zod'
import { performance } from 'perf_hooks'
import * as path from 'path'
import * as fs from 'fs/promises'

// Configuration schemas
const ErlangBridgeConfigSchema = z.object({
  erlangPath: z.string().default('erl'),
  bytstarPath: z.string(),
  nodeName: z.string().default('citty_bridge'),
  cookie: z.string().optional(),
  maxRetries: z.number().default(3),
  timeout: z.number().default(30000),
  poolSize: z.number().default(3),
  performanceTarget: z.number().default(8), // 8 ticks/hops constraint
  healthCheckInterval: z.number().default(60000)
})

const ConsensusRequestSchema = z.object({
  operation: z.enum(['byzantine', 'raft', 'pbft', 'consensus', 'validate', 'coordinate']),
  data: z.any(),
  nodes: z.array(z.string()).optional(),
  options: z.record(z.any()).optional()
})

const PerformanceRequestSchema = z.object({
  operation: z.enum(['monitor', 'optimize', 'benchmark', 'stress-test', 'fabric-check']),
  component: z.string().optional(),
  duration: z.number().optional(),
  constraints: z.object({
    maxTicks: z.number().default(8),
    maxHops: z.number().default(8),
    maxLatency: z.number().default(100) // ms
  }).optional()
})

type ErlangBridgeConfig = z.infer<typeof ErlangBridgeConfigSchema>
type ConsensusRequest = z.infer<typeof ConsensusRequestSchema>
type PerformanceRequest = z.infer<typeof PerformanceRequestSchema>

interface ErlangResult {
  success: boolean
  data?: any
  error?: string
  performance: {
    latency: number
    ticks: number
    hops: number
    memoryUsage: number
    throughput?: number
  }
  metadata: {
    nodeId: string
    timestamp: number
    version: string
    otpVersion: string
  }
}

/**
 * Erlang Node Pool for managing OTP connections
 */
class ErlangNodePool extends EventEmitter {
  private nodes: Map<string, ChildProcess> = new Map()
  private available: string[] = []
  private busy: Set<string> = new Set()
  private config: ErlangBridgeConfig

  constructor(config: ErlangBridgeConfig) {
    super()
    this.config = config
    this.initializePool()
  }

  private async initializePool(): Promise<void> {
    // Ensure bytestar modules are compiled
    await this.compileBytestarModules()

    for (let i = 0; i < this.config.poolSize; i++) {
      const nodeId = `${this.config.nodeName}_${i}@localhost`
      const node = await this.createErlangNode(nodeId)
      this.nodes.set(nodeId, node)
      this.available.push(nodeId)
    }

    // Setup health check
    setInterval(() => this.healthCheck(), this.config.healthCheckInterval)
  }

  private async compileBytestarModules(): Promise<void> {
    try {
      // Compile Bytestar Erlang modules
      const compileProcess = spawn('make', ['compile'], {
        cwd: this.config.bytstarPath,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return new Promise((resolve, reject) => {
        compileProcess.on('exit', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Bytestar compilation failed with code ${code}`))
          }
        })

        compileProcess.on('error', reject)
      })
    } catch (error) {
      this.emit('compilationError', error)
      throw error
    }
  }

  private async createErlangNode(nodeId: string): Promise<ChildProcess> {
    const erlangScript = `
% Citty-Bytestar Bridge Node
-module(citty_bridge_node).
-export([start/0, process_request/1]).

start() ->
    % Load Bytestar modules
    code:add_path("${this.config.bytstarPath}/ebin"),
    
    % Initialize Bytestar systems
    application:ensure_all_started(bytecore),
    application:ensure_all_started(byteflow),
    application:ensure_all_started(bytegen),
    
    % Start consensus coordinators
    {ok, _} = bytecore:start_consensus_coordinator(),
    {ok, _} = byteflow:start_performance_monitor(),
    
    io:format("~p~n", [{ready, node(), now()}]),
    
    % Main processing loop
    loop().

loop() ->
    receive
        {process, Request} ->
            Result = process_request(Request),
            io:format("~p~n", [Result]),
            loop();
        {health_check} ->
            Health = #{
                status => healthy,
                node => node(),
                memory => erlang:memory(),
                processes => erlang:system_info(process_count),
                timestamp => erlang:system_time(millisecond)
            },
            io:format("~p~n", [Health]),
            loop();
        stop ->
            ok;
        _ ->
            loop()
    end.

process_request(#{operation := byzantine, data := Data, options := Options}) ->
    try
        StartTime = erlang:monotonic_time(microsecond),
        {ok, Result} = bytecore:byzantine_consensus(Data, Options),
        EndTime = erlang:monotonic_time(microsecond),
        Latency = EndTime - StartTime,
        
        #{
            success => true,
            data => Result,
            performance => #{
                latency => Latency,
                ticks => maps:get(ticks, Result, 0),
                hops => maps:get(hops, Result, 0),
                memory_usage => erlang:memory(total)
            },
            metadata => #{
                node_id => node(),
                timestamp => erlang:system_time(millisecond),
                version => bytecore:version(),
                otp_version => erlang:system_info(otp_release)
            }
        }
    catch
        Error:Reason ->
            #{
                success => false,
                error => iolist_to_binary(io_lib:format("~p:~p", [Error, Reason])),
                performance => #{
                    latency => 0,
                    ticks => 0,
                    hops => 0,
                    memory_usage => erlang:memory(total)
                },
                metadata => #{
                    node_id => node(),
                    timestamp => erlang:system_time(millisecond),
                    version => "unknown",
                    otp_version => erlang:system_info(otp_release)
                }
            }
    end;

process_request(#{operation := raft, data := Data, options := Options}) ->
    try
        StartTime = erlang:monotonic_time(microsecond),
        {ok, Result} = bytecore:raft_consensus(Data, Options),
        EndTime = erlang:monotonic_time(microsecond),
        Latency = EndTime - StartTime,
        
        #{
            success => true,
            data => Result,
            performance => #{
                latency => Latency,
                ticks => maps:get(ticks, Result, 0),
                hops => maps:get(hops, Result, 0),
                memory_usage => erlang:memory(total)
            },
            metadata => #{
                node_id => node(),
                timestamp => erlang:system_time(millisecond),
                version => bytecore:version(),
                otp_version => erlang:system_info(otp_release)
            }
        }
    catch
        Error:Reason ->
            #{
                success => false,
                error => iolist_to_binary(io_lib:format("~p:~p", [Error, Reason])),
                performance => #{
                    latency => 0,
                    ticks => 0,
                    hops => 0,
                    memory_usage => erlang:memory(total)
                },
                metadata => #{
                    node_id => node(),
                    timestamp => erlang:system_time(millisecond),
                    version => "unknown",
                    otp_version => erlang:system_info(otp_release)
                }
            }
    end;

process_request(#{operation := monitor, component := Component, duration := Duration}) ->
    try
        StartTime = erlang:monotonic_time(microsecond),
        {ok, Metrics} = byteflow:monitor_performance(Component, Duration),
        EndTime = erlang:monotonic_time(microsecond),
        Latency = EndTime - StartTime,
        
        % Validate against Doctrine of 8 constraints
        TicksOk = maps:get(ticks, Metrics, 0) =< 8,
        HopsOk = maps:get(hops, Metrics, 0) =< 8,
        LatencyOk = Latency =< 100000, % 100ms in microseconds
        
        #{
            success => TicksOk andalso HopsOk andalso LatencyOk,
            data => Metrics#{
                constraints_met => #{
                    ticks => TicksOk,
                    hops => HopsOk,
                    latency => LatencyOk
                }
            },
            performance => #{
                latency => Latency,
                ticks => maps:get(ticks, Metrics, 0),
                hops => maps:get(hops, Metrics, 0),
                memory_usage => erlang:memory(total)
            },
            metadata => #{
                node_id => node(),
                timestamp => erlang:system_time(millisecond),
                version => byteflow:version(),
                otp_version => erlang:system_info(otp_release)
            }
        }
    catch
        Error:Reason ->
            #{
                success => false,
                error => iolist_to_binary(io_lib:format("~p:~p", [Error, Reason])),
                performance => #{
                    latency => 0,
                    ticks => 999, % Indicate failure
                    hops => 999,
                    memory_usage => erlang:memory(total)
                },
                metadata => #{
                    node_id => node(),
                    timestamp => erlang:system_time(millisecond),
                    version => "unknown",
                    otp_version => erlang:system_info(otp_release)
                }
            }
    end;

process_request(#{operation := Operation}) ->
    #{
        success => false,
        error => iolist_to_binary(io_lib:format("Unknown operation: ~p", [Operation])),
        performance => #{
            latency => 0,
            ticks => 0,
            hops => 0,
            memory_usage => erlang:memory(total)
        },
        metadata => #{
            node_id => node(),
            timestamp => erlang:system_time(millisecond),
            version => "bridge-1.0.0",
            otp_version => erlang:system_info(otp_release)
        }
    }.
`

    // Write Erlang script to temporary file
    const scriptPath = path.join('/tmp', `citty_bridge_${nodeId.replace(/[^a-zA-Z0-9]/g, '_')}.erl`)
    await fs.writeFile(scriptPath, erlangScript)

    const args = [
      '-noshell',
      '-name', nodeId,
      '-pa', path.join(this.config.bytstarPath, 'ebin'),
      '-eval', `c:c("${scriptPath}"), citty_bridge_node:start().`
    ]

    if (this.config.cookie) {
      args.push('-setcookie', this.config.cookie)
    }

    const node = spawn(this.config.erlangPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.bytstarPath,
      env: {
        ...process.env,
        ERL_LIBS: this.config.bytstarPath
      }
    })

    // Handle node lifecycle
    node.on('error', (error) => {
      this.emit('nodeError', { nodeId, error })
      this.restartNode(nodeId)
    })

    node.on('exit', (code, signal) => {
      this.emit('nodeExit', { nodeId, code, signal })
      if (code !== 0) {
        this.restartNode(nodeId)
      }
    })

    // Wait for ready signal
    return new Promise((resolve, reject) => {
      let readyReceived = false
      const timeout = setTimeout(() => {
        if (!readyReceived) {
          reject(new Error(`Node ${nodeId} failed to start within timeout`))
        }
      }, 10000)

      const onData = (data: Buffer) => {
        const output = data.toString()
        if (output.includes('ready')) {
          readyReceived = true
          clearTimeout(timeout)
          node.stdout?.off('data', onData)
          resolve(node)
        }
      }

      node.stdout?.on('data', onData)
    })
  }

  async acquireNode(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.available.length === 0) {
        this.once('nodeAvailable', resolve)
        setTimeout(() => reject(new Error('Node acquisition timeout')), 5000)
        return
      }

      const nodeId = this.available.pop()!
      this.busy.add(nodeId)
      resolve(nodeId)
    })
  }

  releaseNode(nodeId: string): void {
    if (this.busy.has(nodeId)) {
      this.busy.delete(nodeId)
      this.available.push(nodeId)
      this.emit('nodeAvailable', nodeId)
    }
  }

  getNode(nodeId: string): ChildProcess | undefined {
    return this.nodes.get(nodeId)
  }

  private async restartNode(nodeId: string): Promise<void> {
    // Clean up old node
    const oldNode = this.nodes.get(nodeId)
    if (oldNode) {
      oldNode.kill()
      this.nodes.delete(nodeId)
    }

    // Remove from available/busy lists
    const availableIndex = this.available.indexOf(nodeId)
    if (availableIndex !== -1) {
      this.available.splice(availableIndex, 1)
    }
    this.busy.delete(nodeId)

    // Create new node
    try {
      const newNode = await this.createErlangNode(nodeId)
      this.nodes.set(nodeId, newNode)
      this.available.push(nodeId)
      this.emit('nodeRestarted', nodeId)
    } catch (error) {
      this.emit('nodeRestartFailed', { nodeId, error })
    }
  }

  private async healthCheck(): Promise<void> {
    const healthPromises = Array.from(this.nodes.entries()).map(
      async ([nodeId, node]) => {
        try {
          const result = await this.sendMessage(nodeId, { health_check: true }, 5000)
          
          if (!result || typeof result !== 'object' || result.status !== 'healthy') {
            this.emit('healthCheckFailed', { nodeId, result })
            await this.restartNode(nodeId)
          }
        } catch (error) {
          this.emit('healthCheckFailed', { nodeId, error })
          await this.restartNode(nodeId)
        }
      }
    )

    await Promise.allSettled(healthPromises)
  }

  async sendMessage(nodeId: string, message: any, timeout?: number): Promise<any> {
    const node = this.getNode(nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} not found`)
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.config.timeout
      let responseReceived = false

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true
          reject(new Error(`Message timeout after ${timeoutMs}ms`))
        }
      }, timeoutMs)

      // Set up response handler
      const onData = (data: Buffer) => {
        if (responseReceived) return

        try {
          const output = data.toString().trim()
          // Parse Erlang term format (simplified)
          const response = this.parseErlangTerm(output)
          responseReceived = true
          clearTimeout(timeoutHandle)
          node.stdout?.off('data', onData)
          resolve(response)
        } catch (error) {
          // Continue listening for more data
        }
      }

      node.stdout?.on('data', onData)

      // Send message
      try {
        const messageStr = this.formatErlangTerm(message) + '\n'
        node.stdin?.write(messageStr)
      } catch (error) {
        responseReceived = true
        clearTimeout(timeoutHandle)
        node.stdout?.off('data', onData)
        reject(error)
      }
    })
  }

  private parseErlangTerm(termStr: string): any {
    // Simplified Erlang term parser
    // In production, use a proper Erlang term parser
    try {
      // Handle common patterns
      if (termStr.includes('#{')) {
        // Map format
        return this.parseErlangMap(termStr)
      } else if (termStr.startsWith('{') && termStr.endsWith('}')) {
        // Tuple format
        return this.parseErlangTuple(termStr)
      }
      
      return JSON.parse(termStr)
    } catch {
      return { raw: termStr }
    }
  }

  private parseErlangMap(mapStr: string): any {
    // Simplified map parser
    const result: any = {}
    
    // Extract key-value pairs (very basic implementation)
    const content = mapStr.slice(2, -1) // Remove #{ and }
    const pairs = content.split(',')
    
    for (const pair of pairs) {
      const [key, value] = pair.split(' => ')
      if (key && value) {
        result[key.trim()] = this.parseErlangValue(value.trim())
      }
    }
    
    return result
  }

  private parseErlangTuple(tupleStr: string): any {
    const content = tupleStr.slice(1, -1) // Remove { and }
    return content.split(',').map(item => this.parseErlangValue(item.trim()))
  }

  private parseErlangValue(valueStr: string): any {
    if (valueStr === 'true') return true
    if (valueStr === 'false') return false
    if (/^\d+$/.test(valueStr)) return parseInt(valueStr)
    if (/^\d+\.\d+$/.test(valueStr)) return parseFloat(valueStr)
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      return valueStr.slice(1, -1)
    }
    return valueStr
  }

  private formatErlangTerm(obj: any): string {
    // Convert JavaScript object to Erlang term format
    if (typeof obj === 'object' && obj !== null) {
      return `{process, ${JSON.stringify(obj)}}`
    }
    return JSON.stringify(obj)
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.nodes.values()).map(
      node => new Promise<void>((resolve) => {
        node.stdin?.write('stop.\n')
        node.on('exit', () => resolve())
        setTimeout(() => {
          node.kill('SIGTERM')
          setTimeout(() => node.kill('SIGKILL'), 2000)
        }, 3000)
      })
    )

    await Promise.all(shutdownPromises)
    this.nodes.clear()
    this.available.length = 0
    this.busy.clear()
  }
}

/**
 * Main Erlang Bridge class for Bytestar integration
 */
export class ErlangBridge extends EventEmitter {
  private pool: ErlangNodePool
  private config: ErlangBridgeConfig
  private metrics: {
    requestsTotal: number
    requestsSuccessful: number
    requestsFailed: number
    averageLatency: number
    totalLatency: number
    averageTicks: number
    averageHops: number
    constraintViolations: number
  } = {
    requestsTotal: 0,
    requestsSuccessful: 0,
    requestsFailed: 0,
    averageLatency: 0,
    totalLatency: 0,
    averageTicks: 0,
    averageHops: 0,
    constraintViolations: 0
  }

  constructor(config: Partial<ErlangBridgeConfig> = {}) {
    super()
    this.config = ErlangBridgeConfigSchema.parse(config)
    this.pool = new ErlangNodePool(this.config)

    // Forward pool events
    this.pool.on('nodeError', (data) => this.emit('nodeError', data))
    this.pool.on('nodeExit', (data) => this.emit('nodeExit', data))
    this.pool.on('nodeRestarted', (data) => this.emit('nodeRestarted', data))
    this.pool.on('healthCheckFailed', (data) => this.emit('healthCheckFailed', data))
  }

  /**
   * Execute consensus operation
   */
  async executeConsensus(request: ConsensusRequest): Promise<ErlangResult> {
    const startTime = performance.now()
    let nodeId: string | null = null

    try {
      const validatedRequest = ConsensusRequestSchema.parse(request)
      nodeId = await this.pool.acquireNode()

      const message = {
        process: validatedRequest
      }

      const result = await this.pool.sendMessage(nodeId, message)
      const latency = performance.now() - startTime

      // Validate performance constraints
      const constraintsViolated = this.validateConstraints(result.performance)
      if (constraintsViolated > 0) {
        this.metrics.constraintViolations += constraintsViolated
        this.emit('constraintViolation', { result, violations: constraintsViolated })
      }

      this.updateMetrics(result.success, latency, result.performance)
      return result

    } catch (error) {
      const latency = performance.now() - startTime
      this.updateMetrics(false, latency)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          latency,
          ticks: 999,
          hops: 999,
          memoryUsage: process.memoryUsage().heapUsed
        },
        metadata: {
          nodeId: nodeId || 'unknown',
          timestamp: Date.now(),
          version: '1.0.0',
          otpVersion: 'unknown'
        }
      }
    } finally {
      if (nodeId) {
        this.pool.releaseNode(nodeId)
      }
    }
  }

  /**
   * Monitor performance with Doctrine of 8 constraints
   */
  async monitorPerformance(request: PerformanceRequest): Promise<ErlangResult> {
    const performanceRequest: ConsensusRequest = {
      operation: 'consensus',
      data: request
    }

    return this.executeConsensus(performanceRequest)
  }

  /**
   * Byzantine fault tolerant consensus
   */
  async byzantineConsensus(data: any, options?: Record<string, any>): Promise<ErlangResult> {
    return this.executeConsensus({
      operation: 'byzantine',
      data,
      options
    })
  }

  /**
   * Raft consensus algorithm
   */
  async raftConsensus(data: any, options?: Record<string, any>): Promise<ErlangResult> {
    return this.executeConsensus({
      operation: 'raft',
      data,
      options
    })
  }

  /**
   * Validate Doctrine of 8 constraints
   */
  private validateConstraints(performance: any): number {
    let violations = 0

    if (performance.ticks > this.config.performanceTarget) violations++
    if (performance.hops > this.config.performanceTarget) violations++
    if (performance.latency > 100) violations++ // 100ms threshold

    return violations
  }

  private updateMetrics(success: boolean, latency: number, performance?: any): void {
    this.metrics.requestsTotal++
    this.metrics.totalLatency += latency
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.requestsTotal

    if (performance) {
      this.metrics.averageTicks = (this.metrics.averageTicks + performance.ticks) / 2
      this.metrics.averageHops = (this.metrics.averageHops + performance.hops) / 2
    }

    if (success) {
      this.metrics.requestsSuccessful++
    } else {
      this.metrics.requestsFailed++
    }

    this.emit('metrics', { ...this.metrics })
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.requestsTotal > 0 
        ? this.metrics.requestsSuccessful / this.metrics.requestsTotal 
        : 0,
      errorRate: this.metrics.requestsTotal > 0 
        ? this.metrics.requestsFailed / this.metrics.requestsTotal 
        : 0,
      constraintComplianceRate: this.metrics.requestsTotal > 0
        ? 1 - (this.metrics.constraintViolations / this.metrics.requestsTotal)
        : 0
    }
  }

  async getHealth() {
    return {
      status: 'healthy',
      poolSize: this.config.poolSize,
      availableNodes: this.pool['available'].length,
      busyNodes: this.pool['busy'].size,
      metrics: this.getMetrics(),
      config: {
        erlangPath: this.config.erlangPath,
        bytstarPath: this.config.bytstarPath,
        nodeName: this.config.nodeName,
        performanceTarget: this.config.performanceTarget
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.shutdown()
    this.removeAllListeners()
  }
}

// Export types
export type {
  ErlangBridgeConfig,
  ConsensusRequest,
  PerformanceRequest,
  ErlangResult
}

export {
  ErlangBridgeConfigSchema,
  ConsensusRequestSchema,
  PerformanceRequestSchema
}