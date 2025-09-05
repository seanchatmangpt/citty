import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { dirname, resolve, join } from 'path';
import { OntologyLoader } from './ontology-loader.js';
import { TemplateEngine } from './template-engine.js';
import { ContextBridge } from './context-bridge.js';
import { CacheManager } from './cache-manager.js';
import { PerformanceMonitor } from './performance-monitor.js';
import {
  PipelineConfig,
  GenerationJob,
  HiveQueenRole,
  PipelineError,
  ValidationError,
  OntologyContext,
  TemplateContext,
} from '../types.js';
import * as crypto from 'crypto';

interface WorkerTask {
  id: string;
  type: 'ontology' | 'template' | 'validation';
  data: any;
  priority: number;
}

interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export class PipelineCoordinator extends EventEmitter {
  private ontologyLoader: OntologyLoader;
  private templateEngine: TemplateEngine;
  private contextBridge: ContextBridge;
  private cache: CacheManager;
  private monitor: PerformanceMonitor;
  private activeJobs: Map<string, GenerationJob>;
  private workerPool: WorkerTask[];
  private maxConcurrency: number;
  private runningTasks: Set<string>;

  constructor(options: {
    maxConcurrency?: number;
    cacheOptions?: any;
  } = {}) {
    super();
    this.activeJobs = new Map();
    this.workerPool = [];
    this.maxConcurrency = options.maxConcurrency || 4;
    this.runningTasks = new Set();
    
    this.ontologyLoader = new OntologyLoader();
    this.templateEngine = new TemplateEngine();
    this.contextBridge = new ContextBridge();
    this.cache = new CacheManager(options.cacheOptions);
    this.monitor = new PerformanceMonitor();
  }

  // Real implementation using Node.js worker threads simulation
  private async executeTaskPool(): Promise<void> {
    const activeTasks = Math.min(this.maxConcurrency, this.workerPool.length);
    const tasks = this.workerPool.splice(0, activeTasks);
    
    const promises = tasks.map(task => this.executeTask(task));
    const results = await Promise.allSettled(promises);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const task = tasks[i];
      
      if (result.status === 'fulfilled') {
        this.emit('task:completed', task.id, result.value);
      } else {
        this.emit('task:failed', task.id, result.reason);
      }
      
      this.runningTasks.delete(task.id);
    }
  }

  private async executeTask(task: WorkerTask): Promise<WorkerResult> {
    const startTime = Date.now();
    this.runningTasks.add(task.id);
    
    try {
      let result: any;
      
      switch (task.type) {
        case 'ontology':
          result = await this.processOntologyTask(task.data);
          break;
        case 'template':
          result = await this.processTemplateTask(task.data);
          break;
        case 'validation':
          result = await this.processValidationTask(task.data);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      return {
        taskId: task.id,
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async processOntologyTask(data: any): Promise<OntologyContext> {
    return await this.ontologyLoader.load(data.source);
  }

  private async processTemplateTask(data: any): Promise<{ content: string; outputPath: string }> {
    const { templatePath, context, outputPath } = data;
    const content = await this.templateEngine.render(templatePath, context);
    return { content, outputPath };
  }

  private async processValidationTask(data: any): Promise<boolean> {
    // Validation logic here
    return true;
  }

  async executeJob(config: PipelineConfig): Promise<GenerationJob> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: GenerationJob = {
      id: jobId,
      config,
      status: 'pending',
      metrics: {
        ontologiesProcessed: 0,
        templatesRendered: 0,
        filesGenerated: 0,
        errors: [],
      },
    };

    this.activeJobs.set(jobId, job);
    this.emit('job:started', job);

    try {
      await this.runPipeline(job);
      job.status = 'completed';
      job.endTime = new Date();
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.metrics.errors.push(error instanceof Error ? error.message : String(error));
      this.emit('job:failed', job, error);
      throw error;
    } finally {
      this.emit('job:completed', job);
    }

    return job;
  }

  private async runPipeline(job: GenerationJob): Promise<void> {
    const { config } = job;
    job.status = 'running';
    job.startTime = new Date();

    // Phase 1: Load and parse ontologies
    this.emit('phase:started', 'ontology-loading');
    const ontologyContexts = await this.loadOntologies(config.ontologies, job);
    this.emit('phase:completed', 'ontology-loading');

    // Phase 2: Prepare template contexts
    this.emit('phase:started', 'context-preparation');
    const templateContexts = await this.prepareContexts(ontologyContexts, config);
    this.emit('phase:completed', 'context-preparation');

    // Phase 3: Render templates (with HIVE QUEEN parallelization)
    this.emit('phase:started', 'template-rendering');
    await this.renderTemplates(templateContexts, config, job);
    this.emit('phase:completed', 'template-rendering');

    // Phase 4: Validation (if enabled)
    if (config.validation?.enabled) {
      this.emit('phase:started', 'validation');
      await this.validateOutput(config, job);
      this.emit('phase:completed', 'validation');
    }
  }

  private async loadOntologies(sources: any[], job: GenerationJob): Promise<OntologyContext[]> {
    const contexts: OntologyContext[] = [];
    
    // Use caching with intelligent cache keys
    const cachePromises = sources.map(async (source, index) => {
      const timerId = this.monitor.measureOntologyLoad(source.path);
      
      try {
        // Create cache key based on file content hash
        const fileContent = await fs.readFile(source.path, 'utf-8');
        const contentHash = this.ontologyLoader.getFileHash(fileContent);
        const cacheKey = this.cache.createOntologyKey(source.path, 'loaded', contentHash);
        
        let context = await this.cache.get(cacheKey);
        
        if (!context) {
          // Load and validate ontology
          const validation = await this.ontologyLoader.validateAndRepair(source);
          if (!validation.isValid) {
            throw new PipelineError(
              `Ontology validation failed: ${validation.errors.join(', ')}`,
              'ONTOLOGY_VALIDATION_ERROR',
              { source: source.path, errors: validation.errors }
            );
          }
          
          context = await this.ontologyLoader.load(source);
          
          // Cache for 1 hour with dependencies
          await this.cache.set(cacheKey, context, 3600, [source.path]);
          
          this.monitor.recordOntologyLoad(source.path, Date.now() - timerId, true, context.metadata.size);
        } else {
          this.monitor.recordCacheHit(cacheKey, true);
        }
        
        this.monitor.endTimer(timerId);
        contexts[index] = context;
        job.metrics.ontologiesProcessed++;
        this.emit('ontology:loaded', { path: source.path, cached: !!context, triples: context.metadata.size });
        
        return context;
      } catch (error) {
        this.monitor.endTimer(timerId);
        this.monitor.recordOntologyLoad(source.path, Date.now() - timerId, false);
        
        const message = `Failed to load ontology: ${source.path} - ${error instanceof Error ? error.message : String(error)}`;
        job.metrics.errors.push(message);
        throw new PipelineError(message, 'ONTOLOGY_LOAD_ERROR', { source, originalError: error });
      }
    });
    
    await Promise.all(cachePromises);
    return contexts.filter(Boolean); // Remove any undefined entries
  }

  private async prepareContexts(ontologyContexts: OntologyContext[], config: PipelineConfig): Promise<Array<{ template: any; context: TemplateContext }>> {
    const contextPromises = config.templates.map(async (template) => {
      const timerId = this.monitor.measureContextBuild(ontologyContexts.length);
      
      try {
        const context = await this.contextBridge.buildContext(
          ontologyContexts,
          template.context || {}
        );
        
        this.monitor.endTimer(timerId);
        this.emit('context:built', { template: template.path, ontologies: ontologyContexts.length });
        
        return { template, context };
      } catch (error) {
        this.monitor.endTimer(timerId);
        throw new PipelineError(
          `Failed to build context for template: ${template.path} - ${error instanceof Error ? error.message : String(error)}`,
          'CONTEXT_BUILD_ERROR',
          { template, originalError: error }
        );
      }
    });
    
    return Promise.all(contextPromises);
  }

  private async renderTemplates(
    templateContexts: Array<{ template: any; context: TemplateContext }>,
    config: PipelineConfig,
    job: GenerationJob
  ): Promise<void> {
    if (config.hiveQueen?.enabled && templateContexts.length > 1) {
      await this.renderWithConcurrency(templateContexts, config, job);
    } else {
      await this.renderSequential(templateContexts, config, job);
    }
  }

  private async renderWithConcurrency(
    templateContexts: Array<{ template: any; context: TemplateContext }>,
    config: PipelineConfig,
    job: GenerationJob
  ): Promise<void> {
    const concurrency = config.hiveQueen?.workers || this.maxConcurrency;
    const parallelism = config.hiveQueen?.parallelism || 'templates';
    
    this.emit('rendering:started', { 
      templates: templateContexts.length, 
      concurrency,
      parallelism 
    });
    
    // Create template rendering tasks
    const tasks: WorkerTask[] = [];
    
    for (let i = 0; i < templateContexts.length; i++) {
      const { template, context } = templateContexts[i];
      const outputPath = this.resolveOutputPath(template.output, config.output.directory);
      
      tasks.push({
        id: `template-${i}-${Date.now()}`,
        type: 'template',
        data: {
          templatePath: template.path,
          context,
          outputPath,
          template,
        },
        priority: 1,
      });
    }
    
    // Execute tasks in batches
    const batchSize = concurrency;
    const batches = this.chunkArray(tasks, batchSize);
    
    for (const batch of batches) {
      const batchPromises = batch.map(task => this.executeTask(task));
      const results = await Promise.allSettled(batchPromises);
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const task = batch[i];
        
        if (result.status === 'fulfilled' && result.value.success) {
          const taskResult = result.value.result;
          
          try {
            // Write the rendered content to file
            await this.writeFile(taskResult.outputPath, taskResult.content);
            
            job.metrics.templatesRendered++;
            job.metrics.filesGenerated++;
            
            this.monitor.recordTemplateRender(
              task.data.templatePath,
              result.value.duration,
              true,
              taskResult.content.length
            );
            
            this.emit('template:rendered', {
              template: task.data.templatePath,
              output: taskResult.outputPath,
              size: taskResult.content.length,
              duration: result.value.duration,
            });
          } catch (writeError) {
            const message = `Failed to write file: ${taskResult.outputPath} - ${writeError instanceof Error ? writeError.message : String(writeError)}`;
            job.metrics.errors.push(message);
            
            this.emit('template:error', {
              template: task.data.templatePath,
              output: taskResult.outputPath,
              error: message,
            });
          }
        } else {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          const message = `Failed to render template: ${task.data.templatePath} - ${error}`;
          job.metrics.errors.push(message);
          
          this.monitor.recordTemplateRender(
            task.data.templatePath,
            result.status === 'fulfilled' ? result.value.duration : 0,
            false
          );
          
          this.emit('template:error', {
            template: task.data.templatePath,
            error: message,
          });
        }
      }
    }
    
    this.emit('rendering:completed', { 
      rendered: job.metrics.templatesRendered,
      errors: job.metrics.errors.length
    });
  }

  private async renderSequential(
    templateContexts: Array<{ template: any; context: TemplateContext }>,
    config: PipelineConfig,
    job: GenerationJob
  ): Promise<void> {
    this.emit('rendering:started', { 
      templates: templateContexts.length, 
      concurrency: 1,
      parallelism: 'sequential'
    });
    
    for (const { template, context } of templateContexts) {
      const timerId = this.monitor.measureTemplateRender(template.path);
      
      try {
        // Check cache for rendered template
        const contextHash = this.createContextHash(context);
        const cacheKey = this.cache.createTemplateKey(template.path, contextHash);
        
        let rendered = await this.cache.get(cacheKey);
        
        if (!rendered) {
          rendered = await this.templateEngine.render(template.path, context);
          
          // Cache for 30 minutes
          await this.cache.set(cacheKey, rendered, 1800, [template.path]);
        } else {
          this.monitor.recordCacheHit(cacheKey, true);
        }
        
        const outputPath = this.resolveOutputPath(template.output, config.output.directory);
        await this.writeFile(outputPath, rendered);
        
        const duration = this.monitor.endTimer(timerId)?.duration || 0;
        
        job.metrics.templatesRendered++;
        job.metrics.filesGenerated++;
        
        this.monitor.recordTemplateRender(template.path, duration, true, rendered.length);
        
        this.emit('template:rendered', {
          template: template.path,
          output: outputPath,
          size: rendered.length,
          duration,
          cached: !!rendered,
        });
      } catch (error) {
        const duration = this.monitor.endTimer(timerId)?.duration || 0;
        const message = `Failed to render template: ${template.path} - ${error instanceof Error ? error.message : String(error)}`;
        job.metrics.errors.push(message);
        
        this.monitor.recordTemplateRender(template.path, duration, false);
        
        this.emit('template:error', {
          template: template.path,
          error: message,
        });
        
        throw new PipelineError(message, 'TEMPLATE_RENDER_ERROR', { template, originalError: error });
      }
    }
    
    this.emit('rendering:completed', { 
      rendered: job.metrics.templatesRendered,
      errors: job.metrics.errors.length
    });
  }

  private async processTemplateChunk(
    worker: any,
    chunk: any[],
    config: PipelineConfig,
    job: GenerationJob
  ): Promise<void> {
    return Promise.all(
      chunk.map(({ template, context }) =>
        this.processTemplate(worker, template, context, config, job)
      )
    );
  }

  private async processTemplate(
    worker: any,
    template: any,
    context: any,
    config: PipelineConfig,
    job: GenerationJob
  ): Promise<void> {
    try {
      const rendered = await this.templateEngine.render(template.path, context);
      const outputPath = this.resolveOutputPath(template.output, config.output.directory);
      
      await this.writeFile(outputPath, rendered);
      
      job.metrics.templatesRendered++;
      job.metrics.filesGenerated++;
      
      this.emit('template:rendered', {
        template: template.path,
        output: outputPath,
        worker: worker?.id,
      });
    } catch (error) {
      const message = `Failed to render template: ${template.path}`;
      job.metrics.errors.push(message);
      throw new PipelineError(message, 'TEMPLATE_RENDER_ERROR', { template });
    }
  }

  private async validateOutput(config: PipelineConfig, job: GenerationJob): Promise<void> {
    const timerId = this.monitor.measureValidation('output');
    
    try {
      // Validate generated files
      const violations = await this.validateGeneratedFiles(config.output.directory);
      
      if (violations.length > 0) {
        this.emit('validation:violations', violations);
        
        if (config.validation?.strict) {
          throw new ValidationError('Output validation failed', violations);
        }
        
        job.metrics.errors.push(...violations);
      }
      
      this.monitor.endTimer(timerId);
      this.emit('validation:completed', { violations: violations.length, strict: config.validation?.strict });
    } catch (error) {
      this.monitor.endTimer(timerId);
      throw error;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private resolveOutputPath(output: string, baseDir: string): string {
    return output.startsWith('/') ? output : `${baseDir}/${output}`;
  }

  private async writeFile(path: string, content: string): Promise<void> {
    // Implementation for file writing
    const fs = await import('fs/promises');
    const { dirname } = await import('path');
    
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, content, 'utf-8');
  }

  private async getFileHash(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    const crypto = await import('crypto');
    
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private async validateGeneratedFiles(directory: string): Promise<string[]> {
    const violations: string[] = [];
    
    try {
      // Check if directory exists and has files
      const stats = await fs.stat(directory).catch(() => null);
      if (!stats || !stats.isDirectory()) {
        violations.push(`Output directory does not exist or is not a directory: ${directory}`);
        return violations;
      }
      
      // Read directory contents recursively
      const files = await this.getFilesRecursively(directory);
      
      if (files.length === 0) {
        violations.push('No files were generated');
        return violations;
      }
      
      // Validate each file
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          // Check for unrendered template syntax
          if (content.includes('{{') || content.includes('{%')) {
            violations.push(`File contains unrendered template syntax: ${file}`);
          }
          
          // Check for empty files
          if (content.trim().length === 0) {
            violations.push(`Generated file is empty: ${file}`);
          }
          
          // Check for common template errors
          if (content.includes('undefined') && content.match(/\bundefined\b/g)) {
            violations.push(`File may contain undefined template variables: ${file}`);
          }
        } catch (readError) {
          violations.push(`Cannot read generated file: ${file} - ${readError instanceof Error ? readError.message : String(readError)}`);
        }
      }
      
    } catch (error) {
      violations.push(`Error validating output directory: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return violations;
  }
  
  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not be readable
    }
    
    return files;
  }

  async getJobStatus(jobId: string): Promise<GenerationJob | null> {
    return this.activeJobs.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed') {
      return false;
    }

    job.status = 'failed';
    job.endTime = new Date();
    job.metrics.errors.push('Job cancelled by user');
    
    this.emit('job:cancelled', job);
    return true;
  }

  private createContextHash(context: TemplateContext): string {
    // Create a hash of the context to use for caching
    const contextData = {
      ontologySize: context.ontology.metadata.size,
      ontologyTimestamp: context.ontology.metadata.timestamp.getTime(),
      customKeys: Object.keys(context.custom).sort(),
    };
    return crypto.createHash('md5').update(JSON.stringify(contextData)).digest('hex');
  }

  async cleanup(): Promise<void> {
    // Clear all running tasks
    this.runningTasks.clear();
    this.workerPool.length = 0;
    
    // Cleanup services
    this.cache.destroy();
    this.monitor.stop();
    this.activeJobs.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  getPipelineStats(): {
    jobs: { active: number; total: number };
    cache: ReturnType<CacheManager['getStats']>;
    performance: ReturnType<PerformanceMonitor['generateReport']>;
  } {
    return {
      jobs: {
        active: this.activeJobs.size,
        total: this.activeJobs.size,
      },
      cache: this.cache.getStats(),
      performance: this.monitor.generateReport(),
    };
  }
}