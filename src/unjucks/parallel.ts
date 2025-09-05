/**
 * Parallel Processing Engine for Unjucks
 * 20/80 Performance Optimization - Production v1.0.0
 */

import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { EventEmitter } from 'node:events';
import PQueue from 'p-queue';

export interface WorkerTask {
  id: string;
  type: 'render' | 'parse' | 'validate';
  data: any;
}

export interface WorkerResult {
  id: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
}

export class ParallelProcessor extends EventEmitter {
  private workers: Worker[] = [];
  private queue: PQueue;
  private maxWorkers: number;
  private taskCounter: number = 0;

  constructor(maxWorkers?: number) {
    super();
    this.maxWorkers = maxWorkers || Math.max(1, cpus().length - 1);
    this.queue = new PQueue({ concurrency: this.maxWorkers });
  }

  async init(): Promise<void> {
    // Pre-spawn workers for better performance
    for (let i = 0; i < Math.min(2, this.maxWorkers); i++) {
      await this.spawnWorker();
    }
  }

  private async spawnWorker(): Promise<Worker> {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      const { renderTemplate } = require('./index');
      
      parentPort.on('message', async (task) => {
        const start = Date.now();
        try {
          let result;
          switch (task.type) {
            case 'render':
              result = await renderTemplate(task.data.template, task.data.context);
              break;
            case 'parse':
              result = parseOntology(task.data.content);
              break;
            case 'validate':
              result = validateTemplate(task.data.template);
              break;
          }
          
          parentPort.postMessage({
            id: task.id,
            success: true,
            result,
            duration: Date.now() - start
          });
        } catch (error) {
          parentPort.postMessage({
            id: task.id,
            success: false,
            error: { message: error.message, stack: error.stack },
            duration: Date.now() - start
          });
        }
      });
    `;

    const worker = new Worker(workerCode, { eval: true });
    this.workers.push(worker);
    
    return new Promise((resolve) => {
      worker.once('online', () => resolve(worker));
    });
  }

  async process<T>(task: Omit<WorkerTask, 'id'>): Promise<T> {
    const id = `task-${++this.taskCounter}`;
    const fullTask = { ...task, id };
    
    return this.queue.add(async () => {
      // Get or create worker
      const worker = this.workers.find(w => !w.threadId) || await this.spawnWorker();
      
      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Task ${id} timed out after 30s`));
        }, 30000);

        worker.once('message', (result: WorkerResult) => {
          clearTimeout(timeout);
          
          if (result.success) {
            this.emit('task:complete', result);
            resolve(result.result);
          } else {
            const error = new Error(result.error?.message);
            error.stack = result.error?.stack;
            this.emit('task:error', error);
            reject(error);
          }
        });

        worker.postMessage(fullTask);
        this.emit('task:start', fullTask);
      });
    });
  }

  async processBatch<T>(tasks: Array<Omit<WorkerTask, 'id'>>): Promise<T[]> {
    const promises = tasks.map(task => this.process<T>(task));
    return Promise.all(promises);
  }

  async shutdown(): Promise<void> {
    await this.queue.onIdle();
    
    for (const worker of this.workers) {
      await worker.terminate();
    }
    
    this.workers = [];
  }

  getStats() {
    return {
      workers: this.workers.length,
      maxWorkers: this.maxWorkers,
      queueSize: this.queue.size,
      pending: this.queue.pending,
      tasksProcessed: this.taskCounter
    };
  }
}

/**
 * Smart batch processor with adaptive concurrency
 */
export class AdaptiveBatchProcessor {
  private processor: ParallelProcessor;
  private performanceHistory: number[] = [];
  private currentConcurrency: number;

  constructor(initialConcurrency = 4) {
    this.currentConcurrency = initialConcurrency;
    this.processor = new ParallelProcessor(this.currentConcurrency);
  }

  async process<T>(items: any[], processFunction: (item: any) => Omit<WorkerTask, 'id'>): Promise<T[]> {
    const startTime = Date.now();
    const batchSize = Math.ceil(items.length / this.currentConcurrency);
    const batches: any[][] = [];
    
    // Split into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    // Process batches
    const results: T[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(item => this.processor.process<T>(processFunction(item)))
      );
      results.push(...batchResults);
    }
    
    // Adapt concurrency based on performance
    const duration = Date.now() - startTime;
    const throughput = items.length / (duration / 1000);
    this.performanceHistory.push(throughput);
    
    if (this.performanceHistory.length >= 3) {
      const recent = this.performanceHistory.slice(-3);
      const avgThroughput = recent.reduce((a, b) => a + b, 0) / recent.length;
      
      // Adjust concurrency
      if (avgThroughput < 10 && this.currentConcurrency > 2) {
        this.currentConcurrency--;
        this.processor = new ParallelProcessor(this.currentConcurrency);
      } else if (avgThroughput > 50 && this.currentConcurrency < cpus().length) {
        this.currentConcurrency++;
        this.processor = new ParallelProcessor(this.currentConcurrency);
      }
    }
    
    return results;
  }

  async shutdown(): Promise<void> {
    await this.processor.shutdown();
  }
}

// Singleton instances for reuse
let globalProcessor: ParallelProcessor | null = null;
let adaptiveProcessor: AdaptiveBatchProcessor | null = null;

export function getGlobalProcessor(): ParallelProcessor {
  if (!globalProcessor) {
    globalProcessor = new ParallelProcessor();
    globalProcessor.init();
  }
  return globalProcessor;
}

export function getAdaptiveProcessor(): AdaptiveBatchProcessor {
  if (!adaptiveProcessor) {
    adaptiveProcessor = new AdaptiveBatchProcessor();
  }
  return adaptiveProcessor;
}