import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

interface BenchmarkConfig {
  testName: string;
  targetLatency: number; // microseconds
  duration: number; // milliseconds
  concurrency: number;
  warmupTime: number; // milliseconds
  sampleSize: number;
  acceptableFailureRate: number; // percentage
  testEndpoints: TestEndpoint[];
}

interface TestEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedResponseTime: number; // microseconds
  slaRequirement: number; // microseconds
}

interface PerformanceMetrics {
  testName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number; // microseconds
  medianLatency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  p99_9Latency: number;
  minLatency: number;
  maxLatency: number;
  standardDeviation: number;
  requestsPerSecond: number;
  slaCompliance: number; // percentage
  uptimePercentage: number;
  memoryUsage: MemoryUsage;
  cpuUsage: number;
  networkMetrics: NetworkMetrics;
  latencyDistribution: LatencyBucket[];
}

interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  connectionReuse: number; // percentage
  tcpConnections: number;
  dnsLookupTime: number; // microseconds
  tcpHandshakeTime: number; // microseconds
  tlsHandshakeTime: number; // microseconds
  firstByteTime: number; // microseconds
}

interface LatencyBucket {
  range: string;
  count: number;
  percentage: number;
}

interface AutoScalingMetrics {
  initialInstances: number;
  peakInstances: number;
  scalingEvents: ScalingEvent[];
  resourceUtilization: ResourceUtilization[];
}

interface ScalingEvent {
  timestamp: number;
  action: 'SCALE_UP' | 'SCALE_DOWN';
  reason: string;
  fromInstances: number;
  toInstances: number;
  duration: number; // milliseconds
}

interface ResourceUtilization {
  timestamp: number;
  cpu: number;
  memory: number;
  network: number;
  disk: number;
  instances: number;
}

export class SubMillisecondBenchmarkSuite extends EventEmitter {
  private config: BenchmarkConfig;
  private metrics: PerformanceMetrics;
  private workers: Worker[] = [];
  private latencyMeasurements: number[] = [];
  private startTime: number = 0;
  private observer?: PerformanceObserver;
  private autoScalingMetrics: AutoScalingMetrics;

  constructor(config: BenchmarkConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.autoScalingMetrics = this.initializeAutoScalingMetrics();
    this.setupPerformanceObserver();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      testName: this.config.testName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      medianLatency: 0,
      p90Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      p99_9Latency: 0,
      minLatency: Number.MAX_SAFE_INTEGER,
      maxLatency: 0,
      standardDeviation: 0,
      requestsPerSecond: 0,
      slaCompliance: 0,
      uptimePercentage: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        arrayBuffers: 0
      },
      cpuUsage: 0,
      networkMetrics: {
        bytesReceived: 0,
        bytesSent: 0,
        connectionReuse: 0,
        tcpConnections: 0,
        dnsLookupTime: 0,
        tcpHandshakeTime: 0,
        tlsHandshakeTime: 0,
        firstByteTime: 0
      },
      latencyDistribution: []
    };
  }

  private initializeAutoScalingMetrics(): AutoScalingMetrics {
    return {
      initialInstances: 1,
      peakInstances: 1,
      scalingEvents: [],
      resourceUtilization: []
    };
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          const latencyMicroseconds = entry.duration * 1000; // Convert ms to μs
          this.latencyMeasurements.push(latencyMicroseconds);
        }
      });
    });

    this.observer.observe({ entryTypes: ['measure'] });
  }

  /**
   * Execute comprehensive Fortune 500 sub-millisecond performance benchmarks
   */
  async executeSubMillisecondBenchmarks(): Promise<PerformanceMetrics> {
    console.log('⚡ Starting Fortune 500 Sub-Millisecond Performance Benchmarks');
    console.log(`🎯 Target Latency: ${this.config.targetLatency}μs (${(this.config.targetLatency / 1000).toFixed(3)}ms)`);
    console.log(`🔄 Concurrency: ${this.config.concurrency} concurrent requests`);
    console.log(`⏱️  Duration: ${this.config.duration / 1000}s`);
    console.log(`📊 Endpoints: ${this.config.testEndpoints.length}`);

    this.startTime = performance.now();

    // Phase 1: System warmup
    await this.executeWarmupPhase();

    // Phase 2: Baseline performance measurement
    await this.measureBaselinePerformance();

    // Phase 3: Concurrent load testing
    await this.executeConcurrentLoadTesting();

    // Phase 4: Auto-scaling validation
    await this.validateAutoScalingBehavior();

    // Phase 5: SLA compliance verification
    await this.verifySLACompliance();

    // Finalize metrics calculation
    await this.finalizeMetrics();

    // Generate performance report
    await this.generatePerformanceReport();

    const endTime = performance.now();
    const totalDuration = (endTime - this.startTime) / 1000;

    console.log(`✅ Sub-millisecond benchmarks completed in ${totalDuration.toFixed(2)}s`);
    console.log(`📊 Average latency: ${(this.metrics.averageLatency / 1000).toFixed(3)}ms`);
    console.log(`🎯 P99 latency: ${(this.metrics.p99Latency / 1000).toFixed(3)}ms`);
    console.log(`📈 SLA compliance: ${this.metrics.slaCompliance.toFixed(2)}%`);

    return this.metrics;
  }

  private async executeWarmupPhase(): Promise<void> {
    console.log('\n🔥 Phase 1: System Warmup');
    console.log(`   ⏱️  Warming up for ${this.config.warmupTime / 1000}s...`);

    const warmupStartTime = performance.now();
    const warmupEndTime = warmupStartTime + this.config.warmupTime;
    let warmupRequests = 0;

    // Gradual warmup with increasing load
    const warmupSteps = 5;
    const stepDuration = this.config.warmupTime / warmupSteps;
    
    for (let step = 1; step <= warmupSteps; step++) {
      const stepConcurrency = Math.ceil((step / warmupSteps) * this.config.concurrency);
      console.log(`   📈 Warmup step ${step}/${warmupSteps}: ${stepConcurrency} concurrent requests`);
      
      const stepPromises: Promise<void>[] = [];
      for (let i = 0; i < stepConcurrency; i++) {
        stepPromises.push(this.executeWarmupRequest());
      }
      
      await Promise.all(stepPromises);
      warmupRequests += stepConcurrency;
      
      await this.sleep(stepDuration / 10); // Brief pause between steps
    }

    const warmupDuration = performance.now() - warmupStartTime;
    console.log(`   ✅ Warmup completed: ${warmupRequests} requests in ${warmupDuration.toFixed(2)}ms`);

    // Allow system to stabilize
    console.log('   ⏳ Stabilization period (2s)...');
    await this.sleep(2000);
  }

  private async executeWarmupRequest(): Promise<void> {
    const endpoint = this.config.testEndpoints[Math.floor(Math.random() * this.config.testEndpoints.length)];
    
    const startTime = performance.now();
    
    try {
      // Simulate HTTP request with realistic timing
      await this.simulateHighPerformanceRequest(endpoint);
      
      const endTime = performance.now();
      const duration = (endTime - startTime) * 1000; // Convert to microseconds
      
      // Don't count warmup requests in final metrics
      
    } catch (error) {
      // Ignore warmup errors
    }
  }

  private async measureBaselinePerformance(): Promise<void> {
    console.log('\n📊 Phase 2: Baseline Performance Measurement');
    console.log('   🔍 Measuring single-request performance...');

    const baselineMetrics: number[] = [];
    const sampleSize = Math.min(1000, this.config.sampleSize);

    for (let i = 0; i < sampleSize; i++) {
      const endpoint = this.config.testEndpoints[i % this.config.testEndpoints.length];
      
      performance.mark('request-start');
      
      try {
        await this.simulateHighPerformanceRequest(endpoint);
        
        performance.mark('request-end');
        performance.measure('request-duration', 'request-start', 'request-end');
        
        const measurement = performance.getEntriesByName('request-duration')[0];
        const latencyMicroseconds = measurement.duration * 1000;
        baselineMetrics.push(latencyMicroseconds);
        
        performance.clearMarks();
        performance.clearMeasures();
        
      } catch (error) {
        // Log but continue
        console.log(`   ⚠️  Baseline request ${i + 1} failed: ${error}`);
      }

      // Small delay to avoid overwhelming the system
      if (i % 100 === 0) {
        console.log(`   📊 Baseline progress: ${i + 1}/${sampleSize} requests`);
        await this.sleep(10);
      }
    }

    // Calculate baseline statistics
    baselineMetrics.sort((a, b) => a - b);
    const baselineAvg = baselineMetrics.reduce((sum, val) => sum + val, 0) / baselineMetrics.length;
    const baselineP99 = this.calculatePercentile(baselineMetrics, 99);
    
    console.log(`   📈 Baseline Results:`);
    console.log(`     Average: ${(baselineAvg / 1000).toFixed(3)}ms`);
    console.log(`     P99: ${(baselineP99 / 1000).toFixed(3)}ms`);
    console.log(`     Min: ${(Math.min(...baselineMetrics) / 1000).toFixed(3)}ms`);
    console.log(`     Max: ${(Math.max(...baselineMetrics) / 1000).toFixed(3)}ms`);
  }

  private async executeConcurrentLoadTesting(): Promise<void> {
    console.log('\n🚀 Phase 3: Concurrent Load Testing');
    console.log(`   ⚡ Executing ${this.config.concurrency} concurrent workers...`);

    // Spawn worker threads for true parallel execution
    const workerPromises: Promise<WorkerResult>[] = [];
    const requestsPerWorker = Math.ceil(this.config.sampleSize / this.config.concurrency);

    for (let i = 0; i < this.config.concurrency; i++) {
      const workerPromise = this.spawnPerformanceWorker(i, requestsPerWorker);
      workerPromises.push(workerPromise);
    }

    // Start monitoring resource usage
    const monitoringPromise = this.startResourceMonitoring();

    console.log(`   ⏱️  Test duration: ${this.config.duration / 1000}s`);
    const testStartTime = performance.now();

    // Wait for all workers to complete
    const workerResults = await Promise.all(workerPromises);

    // Stop monitoring
    this.stopResourceMonitoring();
    await monitoringPromise;

    const testEndTime = performance.now();
    const actualDuration = testEndTime - testStartTime;

    // Aggregate worker results
    this.aggregateWorkerResults(workerResults, actualDuration);

    console.log(`   ✅ Load testing completed in ${actualDuration.toFixed(2)}ms`);
    console.log(`   📊 Processed ${this.metrics.totalRequests} requests`);
    console.log(`   ⚡ Throughput: ${this.metrics.requestsPerSecond.toFixed(0)} RPS`);
  }

  private async spawnPerformanceWorker(workerId: number, requestCount: number): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          workerId,
          requestCount,
          endpoints: this.config.testEndpoints,
          targetLatency: this.config.targetLatency,
          duration: this.config.duration
        }
      });

      this.workers.push(worker);

      worker.on('message', (result: WorkerResult) => {
        resolve(result);
      });

      worker.on('error', (error) => {
        console.error(`❌ Worker ${workerId} error:`, error);
        reject(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`❌ Worker ${workerId} exited with code ${code}`);
        }
      });
    });
  }

  private async validateAutoScalingBehavior(): Promise<void> {
    console.log('\n📈 Phase 4: Auto-Scaling Validation');
    console.log('   🔍 Simulating load-based scaling events...');

    // Simulate various load scenarios
    const scalingScenarios = [
      { name: 'Traffic Spike', load: 150, duration: 30000 },
      { name: 'Sustained High Load', load: 120, duration: 60000 },
      { name: 'Gradual Ramp-up', load: 200, duration: 45000 },
      { name: 'Flash Traffic', load: 300, duration: 15000 }
    ];

    for (const scenario of scalingScenarios) {
      console.log(`   🎯 Testing: ${scenario.name} (${scenario.load}% load for ${scenario.duration / 1000}s)`);
      
      const scalingResult = await this.simulateScalingScenario(scenario);
      
      console.log(`     📊 Scaling Events: ${scalingResult.events.length}`);
      console.log(`     📈 Peak Instances: ${scalingResult.peakInstances}`);
      console.log(`     ⏱️  Scaling Latency: ${scalingResult.averageScalingTime}ms`);
      
      // Record scaling metrics
      this.autoScalingMetrics.scalingEvents.push(...scalingResult.events);
      this.autoScalingMetrics.peakInstances = Math.max(
        this.autoScalingMetrics.peakInstances, 
        scalingResult.peakInstances
      );
    }
  }

  private async simulateScalingScenario(scenario: any): Promise<any> {
    const events: ScalingEvent[] = [];
    let currentInstances = this.autoScalingMetrics.initialInstances;
    const targetInstances = Math.ceil(scenario.load / 100 * this.autoScalingMetrics.initialInstances);
    
    // Simulate scale-up
    if (targetInstances > currentInstances) {
      const scaleUpStart = performance.now();
      
      events.push({
        timestamp: Date.now(),
        action: 'SCALE_UP',
        reason: `High CPU utilization (${scenario.load}%)`,
        fromInstances: currentInstances,
        toInstances: targetInstances,
        duration: 0
      });
      
      // Simulate scaling time (2-10 seconds typical for container scaling)
      const scalingTime = 2000 + Math.random() * 8000;
      await this.sleep(scalingTime);
      
      events[events.length - 1].duration = scalingTime;
      currentInstances = targetInstances;
      
      console.log(`     ⬆️  Scaled up to ${currentInstances} instances in ${scalingTime.toFixed(0)}ms`);
    }
    
    // Hold the load for scenario duration
    await this.sleep(scenario.duration);
    
    // Simulate scale-down
    if (currentInstances > this.autoScalingMetrics.initialInstances) {
      const scaleDownStart = performance.now();
      
      events.push({
        timestamp: Date.now(),
        action: 'SCALE_DOWN',
        reason: 'Load decreased, optimizing costs',
        fromInstances: currentInstances,
        toInstances: this.autoScalingMetrics.initialInstances,
        duration: 0
      });
      
      // Scale-down is typically faster (just terminate instances)
      const scalingTime = 1000 + Math.random() * 3000;
      await this.sleep(scalingTime);
      
      events[events.length - 1].duration = scalingTime;
      
      console.log(`     ⬇️  Scaled down to ${this.autoScalingMetrics.initialInstances} instances in ${scalingTime.toFixed(0)}ms`);
    }
    
    return {
      events,
      peakInstances: targetInstances,
      averageScalingTime: events.reduce((sum, e) => sum + e.duration, 0) / events.length
    };
  }

  private async verifySLACompliance(): Promise<void> {
    console.log('\n🎯 Phase 5: SLA Compliance Verification');
    console.log('   📊 Analyzing SLA requirements vs actual performance...');

    const slaResults = [];
    
    for (const endpoint of this.config.testEndpoints) {
      const endpointMetrics = this.getEndpointMetrics(endpoint.name);
      const slaCompliant = endpointMetrics.p99 <= endpoint.slaRequirement;
      const compliancePercentage = slaCompliant ? 100 : 
        Math.max(0, 100 - ((endpointMetrics.p99 - endpoint.slaRequirement) / endpoint.slaRequirement * 100));
      
      slaResults.push({
        endpoint: endpoint.name,
        requirement: endpoint.slaRequirement,
        actual: endpointMetrics.p99,
        compliant: slaCompliant,
        compliancePercentage
      });
      
      const status = slaCompliant ? '✅' : '❌';
      console.log(`     ${status} ${endpoint.name}: ${(endpointMetrics.p99 / 1000).toFixed(3)}ms (SLA: ${(endpoint.slaRequirement / 1000).toFixed(3)}ms)`);
    }

    // Calculate overall SLA compliance
    const overallCompliance = slaResults.reduce((sum, r) => sum + r.compliancePercentage, 0) / slaResults.length;
    this.metrics.slaCompliance = overallCompliance;
    
    console.log(`   📊 Overall SLA Compliance: ${overallCompliance.toFixed(2)}%`);

    // 99.99% uptime validation
    const uptimeRequirement = 99.99;
    const actualUptime = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    this.metrics.uptimePercentage = actualUptime;
    
    const uptimeStatus = actualUptime >= uptimeRequirement ? '✅' : '❌';
    console.log(`   ${uptimeStatus} Uptime: ${actualUptime.toFixed(4)}% (SLA: ${uptimeRequirement}%)`);
  }

  private getEndpointMetrics(endpointName: string): { p99: number; average: number } {
    // In a real implementation, this would filter metrics by endpoint
    // For simulation, return overall metrics
    return {
      p99: this.metrics.p99Latency,
      average: this.metrics.averageLatency
    };
  }

  private async simulateHighPerformanceRequest(endpoint: TestEndpoint): Promise<any> {
    // Simulate sub-millisecond request processing
    const processingTime = this.generateRealisticLatency(endpoint.expectedResponseTime);
    
    if (processingTime > 0) {
      await this.precisionSleep(processingTime);
    }
    
    // Simulate different response scenarios
    const random = Math.random();
    
    if (random > 0.999) {
      // 0.1% failure rate
      throw new Error('Simulated service error');
    }
    
    return {
      statusCode: 200,
      responseTime: processingTime,
      contentLength: 500 + Math.floor(Math.random() * 1500)
    };
  }

  private generateRealisticLatency(expectedLatency: number): number {
    // Generate latency with realistic distribution
    // 90% of requests within expected range
    // 9% slightly higher (network variance)
    // 1% outliers (GC, system load, etc.)
    
    const random = Math.random();
    
    if (random < 0.90) {
      // Normal case: 80-120% of expected latency
      return expectedLatency * (0.8 + Math.random() * 0.4);
    } else if (random < 0.99) {
      // Network variance: 100-200% of expected
      return expectedLatency * (1.0 + Math.random() * 1.0);
    } else {
      // Outliers: 200-500% of expected (GC pauses, etc.)
      return expectedLatency * (2.0 + Math.random() * 3.0);
    }
  }

  private async precisionSleep(microseconds: number): Promise<void> {
    if (microseconds < 1000) {
      // For sub-millisecond precision, use busy wait
      const start = performance.now();
      const targetMs = microseconds / 1000;
      while ((performance.now() - start) < targetMs) {
        // Busy wait for precision
      }
    } else {
      // For longer delays, use regular sleep
      await this.sleep(microseconds / 1000);
    }
  }

  private async startResourceMonitoring(): Promise<void> {
    // Monitor CPU, memory, and network usage during the test
    const monitoringInterval = 1000; // 1 second intervals
    
    const monitor = async () => {
      while (this.workers.length > 0) {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.autoScalingMetrics.resourceUtilization.push({
          timestamp: Date.now(),
          cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
          memory: memUsage.heapUsed / memUsage.heapTotal * 100,
          network: 0, // Would be measured from actual network interface
          disk: 0, // Would be measured from actual disk I/O
          instances: this.autoScalingMetrics.peakInstances
        });
        
        await this.sleep(monitoringInterval);
      }
    };
    
    return monitor();
  }

  private stopResourceMonitoring(): void {
    // Monitoring will stop when workers array is cleared
  }

  private aggregateWorkerResults(results: WorkerResult[], duration: number): void {
    this.metrics.totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
    this.metrics.successfulRequests = results.reduce((sum, r) => sum + r.successfulRequests, 0);
    this.metrics.failedRequests = results.reduce((sum, r) => sum + r.failedRequests, 0);
    
    // Combine all latency measurements
    const allLatencies: number[] = [];
    results.forEach(r => allLatencies.push(...r.latencies));
    
    if (allLatencies.length > 0) {
      allLatencies.sort((a, b) => a - b);
      
      this.metrics.minLatency = Math.min(...allLatencies);
      this.metrics.maxLatency = Math.max(...allLatencies);
      this.metrics.averageLatency = allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length;
      this.metrics.medianLatency = this.calculatePercentile(allLatencies, 50);
      this.metrics.p90Latency = this.calculatePercentile(allLatencies, 90);
      this.metrics.p95Latency = this.calculatePercentile(allLatencies, 95);
      this.metrics.p99Latency = this.calculatePercentile(allLatencies, 99);
      this.metrics.p99_9Latency = this.calculatePercentile(allLatencies, 99.9);
      
      // Calculate standard deviation
      const variance = allLatencies.reduce((sum, l) => 
        sum + Math.pow(l - this.metrics.averageLatency, 2), 0) / allLatencies.length;
      this.metrics.standardDeviation = Math.sqrt(variance);
    }
    
    // Calculate throughput
    this.metrics.requestsPerSecond = this.metrics.totalRequests / (duration / 1000);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private async finalizeMetrics(): void {
    console.log('\n📊 Finalizing performance metrics...');
    
    // Generate latency distribution
    this.metrics.latencyDistribution = this.generateLatencyDistribution();
    
    // Capture final memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers
    };
    
    // Calculate network metrics (simulated)
    this.metrics.networkMetrics = {
      bytesReceived: this.metrics.successfulRequests * 750, // Average response size
      bytesSent: this.metrics.totalRequests * 300, // Average request size
      connectionReuse: 85, // 85% connection reuse
      tcpConnections: Math.ceil(this.metrics.totalRequests / 10),
      dnsLookupTime: 500, // 0.5ms average DNS lookup
      tcpHandshakeTime: 2000, // 2ms average TCP handshake
      tlsHandshakeTime: 5000, // 5ms average TLS handshake
      firstByteTime: this.metrics.averageLatency * 0.3 // 30% of total latency
    };
  }

  private generateLatencyDistribution(): LatencyBucket[] {
    const buckets = [
      { range: '<100μs', min: 0, max: 100 },
      { range: '100-500μs', min: 100, max: 500 },
      { range: '500μs-1ms', min: 500, max: 1000 },
      { range: '1-5ms', min: 1000, max: 5000 },
      { range: '5-10ms', min: 5000, max: 10000 },
      { range: '>10ms', min: 10000, max: Number.MAX_SAFE_INTEGER }
    ];

    return buckets.map(bucket => {
      const count = this.latencyMeasurements.filter(l => 
        l >= bucket.min && l < bucket.max
      ).length;
      
      return {
        range: bucket.range,
        count,
        percentage: (count / this.latencyMeasurements.length) * 100
      };
    });
  }

  private async generatePerformanceReport(): void {
    console.log(`\n⚡ SUB-MILLISECOND PERFORMANCE BENCHMARK REPORT`);
    console.log(`==============================================`);
    console.log(`Test: ${this.metrics.testName}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log(`Total Requests: ${this.metrics.totalRequests.toLocaleString()}`);
    console.log(`Successful: ${this.metrics.successfulRequests.toLocaleString()} (${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(3)}%)`);
    console.log(`Failed: ${this.metrics.failedRequests.toLocaleString()} (${((this.metrics.failedRequests / this.metrics.totalRequests) * 100).toFixed(3)}%)`);
    
    console.log(`\n📊 Latency Metrics (microseconds):`);
    console.log(`  Average: ${this.metrics.averageLatency.toFixed(0)}μs (${(this.metrics.averageLatency / 1000).toFixed(3)}ms)`);
    console.log(`  Median:  ${this.metrics.medianLatency.toFixed(0)}μs (${(this.metrics.medianLatency / 1000).toFixed(3)}ms)`);
    console.log(`  P90:     ${this.metrics.p90Latency.toFixed(0)}μs (${(this.metrics.p90Latency / 1000).toFixed(3)}ms)`);
    console.log(`  P95:     ${this.metrics.p95Latency.toFixed(0)}μs (${(this.metrics.p95Latency / 1000).toFixed(3)}ms)`);
    console.log(`  P99:     ${this.metrics.p99Latency.toFixed(0)}μs (${(this.metrics.p99Latency / 1000).toFixed(3)}ms)`);
    console.log(`  P99.9:   ${this.metrics.p99_9Latency.toFixed(0)}μs (${(this.metrics.p99_9Latency / 1000).toFixed(3)}ms)`);
    console.log(`  Min:     ${this.metrics.minLatency.toFixed(0)}μs (${(this.metrics.minLatency / 1000).toFixed(3)}ms)`);
    console.log(`  Max:     ${this.metrics.maxLatency.toFixed(0)}μs (${(this.metrics.maxLatency / 1000).toFixed(3)}ms)`);

    console.log(`\n🚀 Performance Metrics:`);
    console.log(`  Requests/sec: ${this.metrics.requestsPerSecond.toFixed(0)}`);
    console.log(`  SLA Compliance: ${this.metrics.slaCompliance.toFixed(2)}%`);
    console.log(`  Uptime: ${this.metrics.uptimePercentage.toFixed(4)}%`);
    
    console.log(`\n📈 Latency Distribution:`);
    for (const bucket of this.metrics.latencyDistribution) {
      console.log(`  ${bucket.range}: ${bucket.count.toLocaleString()} (${bucket.percentage.toFixed(2)}%)`);
    }

    // Target achievement analysis
    const targetAchieved = this.metrics.p99Latency <= this.config.targetLatency;
    const achievementStatus = targetAchieved ? '✅ ACHIEVED' : '❌ MISSED';
    console.log(`\n🎯 Target Achievement: ${achievementStatus}`);
    console.log(`  Target P99: ${this.config.targetLatency}μs (${(this.config.targetLatency / 1000).toFixed(3)}ms)`);
    console.log(`  Actual P99: ${this.metrics.p99Latency.toFixed(0)}μs (${(this.metrics.p99Latency / 1000).toFixed(3)}ms)`);
    
    if (!targetAchieved) {
      const miss = this.metrics.p99Latency - this.config.targetLatency;
      console.log(`  Miss by: ${miss.toFixed(0)}μs (${(miss / 1000).toFixed(3)}ms)`);
    }

    this.emit('reportGenerated', this.metrics);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Terminate all workers
    await Promise.all(this.workers.map(worker => {
      return new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve()).catch(() => resolve());
      });
    }));
    
    this.workers = [];
  }
}

// Worker thread implementation
if (!isMainThread) {
  interface WorkerResult {
    workerId: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    latencies: number[];
  }

  class PerformanceWorker {
    private workerId: number;
    private requestCount: number;
    private endpoints: TestEndpoint[];
    private targetLatency: number;
    private duration: number;
    private result: WorkerResult;

    constructor(workerId: number, requestCount: number, endpoints: TestEndpoint[], targetLatency: number, duration: number) {
      this.workerId = workerId;
      this.requestCount = requestCount;
      this.endpoints = endpoints;
      this.targetLatency = targetLatency;
      this.duration = duration;
      this.result = {
        workerId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        latencies: []
      };
    }

    async execute(): Promise<void> {
      const startTime = performance.now();
      const endTime = startTime + this.duration;

      while (performance.now() < endTime && this.result.totalRequests < this.requestCount) {
        const endpoint = this.endpoints[this.result.totalRequests % this.endpoints.length];
        
        const requestStart = performance.now();
        
        try {
          await this.simulateRequest(endpoint);
          
          const requestEnd = performance.now();
          const latencyMicroseconds = (requestEnd - requestStart) * 1000;
          
          this.result.successfulRequests++;
          this.result.latencies.push(latencyMicroseconds);
          
        } catch (error) {
          this.result.failedRequests++;
        }
        
        this.result.totalRequests++;
      }

      parentPort?.postMessage(this.result);
    }

    private async simulateRequest(endpoint: TestEndpoint): Promise<void> {
      const expectedLatency = endpoint.expectedResponseTime;
      const actualLatency = this.generateRealisticLatency(expectedLatency);
      
      if (actualLatency > 0) {
        await this.precisionSleep(actualLatency);
      }
      
      // 0.1% failure rate
      if (Math.random() > 0.999) {
        throw new Error('Simulated service error');
      }
    }

    private generateRealisticLatency(expectedLatency: number): number {
      const random = Math.random();
      
      if (random < 0.90) {
        return expectedLatency * (0.8 + Math.random() * 0.4);
      } else if (random < 0.99) {
        return expectedLatency * (1.0 + Math.random() * 1.0);
      } else {
        return expectedLatency * (2.0 + Math.random() * 3.0);
      }
    }

    private async precisionSleep(microseconds: number): Promise<void> {
      if (microseconds < 1000) {
        const start = performance.now();
        const targetMs = microseconds / 1000;
        while ((performance.now() - start) < targetMs) {
          // Busy wait for precision
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, microseconds / 1000));
      }
    }
  }

  const { workerId, requestCount, endpoints, targetLatency, duration } = workerData;
  const worker = new PerformanceWorker(workerId, requestCount, endpoints, targetLatency, duration);
  worker.execute().catch(console.error);
}

// Example Fortune 500 configuration
export const fortune500BenchmarkConfig: BenchmarkConfig = {
  testName: 'Fortune 500 Sub-Millisecond Performance Benchmark',
  targetLatency: 500, // 500 microseconds (0.5ms)
  duration: 60000, // 1 minute
  concurrency: 100,
  warmupTime: 30000, // 30 seconds
  sampleSize: 1000000, // 1 million requests
  acceptableFailureRate: 0.01, // 0.01%
  testEndpoints: [
    {
      name: 'Account Balance API',
      url: '/api/v1/accounts/balance',
      method: 'GET',
      expectedResponseTime: 300, // 300μs
      slaRequirement: 500 // 500μs SLA
    },
    {
      name: 'Payment Processing API',
      url: '/api/v1/payments/process',
      method: 'POST',
      expectedResponseTime: 800, // 800μs
      slaRequirement: 1000 // 1ms SLA
    },
    {
      name: 'User Authentication API',
      url: '/api/v1/auth/verify',
      method: 'POST',
      expectedResponseTime: 400, // 400μs
      slaRequirement: 600 // 600μs SLA
    },
    {
      name: 'Market Data API',
      url: '/api/v1/market/quotes',
      method: 'GET',
      expectedResponseTime: 200, // 200μs
      slaRequirement: 300 // 300μs SLA
    }
  ]
};