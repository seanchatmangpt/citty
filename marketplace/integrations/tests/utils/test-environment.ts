import { spawn, ChildProcess } from 'child_process'
import axios from 'axios'
import WebSocket from 'ws'

export interface TestServices {
  cns: {
    baseUrl: string
    wsUrl: string
    healthUrl: string
  }
  bytestar: {
    baseUrl: string
    apiUrl: string
    metricsUrl: string
  }
  marketplace: {
    baseUrl: string
    apiUrl: string
    websocketUrl: string
  }
}

export class TestEnvironment {
  private services: TestServices
  private processes: ChildProcess[] = []
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    this.services = {
      cns: {
        baseUrl: process.env.CNS_TEST_URL || 'http://localhost:8001',
        wsUrl: process.env.CNS_WS_TEST_URL || 'ws://localhost:8001/ws',
        healthUrl: process.env.CNS_HEALTH_URL || 'http://localhost:8001/health'
      },
      bytestar: {
        baseUrl: process.env.BYTESTAR_TEST_URL || 'http://localhost:8002',
        apiUrl: process.env.BYTESTAR_API_URL || 'http://localhost:8002/api',
        metricsUrl: process.env.BYTESTAR_METRICS_URL || 'http://localhost:8002/metrics'
      },
      marketplace: {
        baseUrl: process.env.MARKETPLACE_TEST_URL || 'http://localhost:3001',
        apiUrl: process.env.MARKETPLACE_API_URL || 'http://localhost:3001/api',
        websocketUrl: process.env.MARKETPLACE_WS_URL || 'ws://localhost:3001/ws'
      }
    }
  }

  async initialize(): Promise<void> {
    console.log('Initializing test services...')
    
    // Start services if not already running
    await this.startServices()
    
    // Wait for all services to be healthy
    await this.waitForServices()
    
    // Start health monitoring
    this.startHealthMonitoring()
  }

  async startServices(): Promise<void> {
    const servicePromises = [
      this.startCNSService(),
      this.startByteStarService(),
      this.startMarketplaceService()
    ]
    
    await Promise.all(servicePromises)
  }

  private async startCNSService(): Promise<void> {
    if (await this.isServiceHealthy(this.services.cns.healthUrl)) {
      console.log('CNS service already running')
      return
    }
    
    console.log('Starting CNS service...')
    const process = spawn('node', ['dist/cns-server.js'], {
      env: { ...process.env, NODE_ENV: 'test', PORT: '8001' },
      stdio: 'pipe'
    })
    
    this.processes.push(process)
    
    // Wait for service to start
    await this.waitForPort(8001, 30000)
  }

  private async startByteStarService(): Promise<void> {
    if (await this.isServiceHealthy(`${this.services.bytestar.baseUrl}/health`)) {
      console.log('ByteStar service already running')
      return
    }
    
    console.log('Starting ByteStar service...')
    const process = spawn('node', ['dist/bytestar-server.js'], {
      env: { ...process.env, NODE_ENV: 'test', PORT: '8002' },
      stdio: 'pipe'
    })
    
    this.processes.push(process)
    
    // Wait for service to start
    await this.waitForPort(8002, 30000)
  }

  private async startMarketplaceService(): Promise<void> {
    if (await this.isServiceHealthy(`${this.services.marketplace.baseUrl}/health`)) {
      console.log('Marketplace service already running')
      return
    }
    
    console.log('Starting Marketplace service...')
    const process = spawn('pnpm', ['run', 'dev', '--port=3001'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe',
      cwd: '/Users/sac/dev/citty/marketplace'
    })
    
    this.processes.push(process)
    
    // Wait for service to start
    await this.waitForPort(3001, 30000)
  }

  private async waitForServices(): Promise<void> {
    const healthChecks = [
      this.services.cns.healthUrl,
      `${this.services.bytestar.baseUrl}/health`,
      `${this.services.marketplace.baseUrl}/health`
    ]
    
    console.log('Waiting for services to be healthy...')
    
    const maxRetries = 30
    for (let i = 0; i < maxRetries; i++) {
      const allHealthy = await Promise.all(
        healthChecks.map(url => this.isServiceHealthy(url))
      )
      
      if (allHealthy.every(healthy => healthy)) {
        console.log('All services are healthy')
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Services failed to become healthy within timeout')
  }

  private async isServiceHealthy(url: string): Promise<boolean> {
    try {
      const response = await axios.get(url, { timeout: 5000 })
      return response.status === 200
    } catch {
      return false
    }
  }

  private async waitForPort(port: number, timeout: number = 30000): Promise<void> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      try {
        await axios.get(`http://localhost:${port}/health`, { timeout: 1000 })
        return
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    throw new Error(`Port ${port} did not become available within ${timeout}ms`)
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthChecks = [
        this.services.cns.healthUrl,
        `${this.services.bytestar.baseUrl}/health`,
        `${this.services.marketplace.baseUrl}/health`
      ]
      
      const health = await Promise.all(
        healthChecks.map(async (url, index) => {
          const healthy = await this.isServiceHealthy(url)
          return { service: ['CNS', 'ByteStar', 'Marketplace'][index], healthy }
        })
      )
      
      const unhealthy = health.filter(h => !h.healthy)
      if (unhealthy.length > 0) {
        console.warn('Unhealthy services detected:', unhealthy)
      }
    }, 10000)
  }

  async cleanupArtifacts(): Promise<void> {
    // Clean up any temporary files, logs, or other artifacts
    // This is called after each test
  }

  async destroy(): Promise<void> {
    console.log('Destroying test environment...')
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    // Stop all spawned processes
    for (const process of this.processes) {
      if (!process.killed) {
        process.kill('SIGTERM')
        
        // Wait for graceful shutdown
        await new Promise(resolve => {
          process.on('exit', resolve)
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL')
            }
            resolve(null)
          }, 5000)
        })
      }
    }
    
    this.processes = []
  }

  getServices(): TestServices {
    return this.services
  }

  async createWebSocketConnection(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      
      ws.on('open', () => resolve(ws))
      ws.on('error', reject)
      
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'))
      }, 5000)
    })
  }
}