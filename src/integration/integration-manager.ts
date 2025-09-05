/**
 * Integration Manager for Component Interoperability
 * Fixes the critical integration issues between components
 */

import { EventEmitter } from 'node:events';
import type { CommandDef } from '../types.js';
import { OntologyManager } from '../ontology.js';
import { ParallelProcessor } from '../unjucks/parallel.js';

export interface IntegrationContext {
  componentId: string;
  data: any;
  timestamp: number;
  dependencies: string[];
}

export interface IntegrationResult {
  success: boolean;
  result?: any;
  error?: Error;
  componentChain: string[];
}

/**
 * Central integration manager to coordinate between components
 */
export class IntegrationManager extends EventEmitter {
  private ontologyManager: OntologyManager;
  private parallelProcessor: ParallelProcessor | null = null;
  private componentRegistry: Map<string, any> = new Map();
  private integrationChain: IntegrationContext[] = [];

  constructor() {
    super();
    this.ontologyManager = new OntologyManager();
  }

  /**
   * Register a component for integration
   */
  registerComponent(id: string, component: any): void {
    this.componentRegistry.set(id, component);
    this.emit('component:registered', { id, component });
  }

  /**
   * Initialize integration services
   */
  async initialize(): Promise<void> {
    try {
      // Initialize parallel processor if available
      if (!this.parallelProcessor) {
        this.parallelProcessor = new ParallelProcessor();
        await this.parallelProcessor.init();
      }

      this.emit('integration:ready');
    } catch (error) {
      this.emit('integration:error', error);
      throw error;
    }
  }

  /**
   * Process integration between Ontology and Unjucks
   */
  async processOntologyToUnjucks(commandDef: CommandDef, templatePath?: string): Promise<IntegrationResult> {
    const componentChain = ['ontology', 'unjucks'];
    
    try {
      // Step 1: Convert CommandDef to Ontology
      const ontologyContext = await this.convertCommandToOntology(commandDef);
      
      // Step 2: Transform context for template rendering
      const templateContext = this.transformContextForTemplates(ontologyContext);
      
      // Step 3: Render templates if path provided
      let renderResult;
      if (templatePath && this.parallelProcessor) {
        renderResult = await this.parallelProcessor.process({
          type: 'render',
          data: {
            template: templatePath,
            context: templateContext
          }
        });
      }

      return {
        success: true,
        result: {
          ontologyContext,
          templateContext,
          renderResult
        },
        componentChain
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        componentChain
      };
    }
  }

  /**
   * Process CLI command dispatch to core functions
   */
  async processCLIDispatch(command: string, args: any): Promise<IntegrationResult> {
    const componentChain = ['cli', 'core'];
    
    try {
      // Validate command and arguments
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command provided to CLI dispatch');
      }

      // Get registered component for command
      const component = this.componentRegistry.get(command);
      if (!component) {
        throw new Error(`No component registered for command: ${command}`);
      }

      // Execute command with proper error handling
      let result;
      if (typeof component.run === 'function') {
        result = await component.run({ args });
      } else if (typeof component === 'function') {
        result = await component(args);
      } else {
        throw new Error(`Component ${command} does not have executable interface`);
      }

      return {
        success: true,
        result,
        componentChain
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        componentChain
      };
    }
  }

  /**
   * Handle parallel processing task distribution
   */
  async processParallelTasks<T>(tasks: Array<{type: string, data: any}>): Promise<IntegrationResult> {
    const componentChain = ['parallel-processor', 'workers'];
    
    try {
      if (!this.parallelProcessor) {
        throw new Error('Parallel processor not initialized');
      }

      const results = await Promise.allSettled(
        tasks.map(task => this.parallelProcessor!.process<T>(task))
      );

      const successful: T[] = [];
      const errors: Error[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          errors.push(new Error(`Task ${index} failed: ${result.reason.message}`));
        }
      });

      return {
        success: errors.length === 0,
        result: {
          successful,
          errors,
          totalTasks: tasks.length,
          successRate: successful.length / tasks.length
        },
        componentChain
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        componentChain
      };
    }
  }

  /**
   * Create safe test environment
   */
  async createTestEnvironment(options: {
    isolateComponents?: boolean;
    mockExternal?: boolean;
    timeoutMs?: number;
  } = {}): Promise<{
    cleanup: () => Promise<void>;
    getComponent: (id: string) => any;
    executeIntegration: (type: string, data: any) => Promise<any>;
  }> {
    const testComponents = new Map(this.componentRegistry);
    const testProcessor = options.isolateComponents ? new ParallelProcessor() : this.parallelProcessor;
    
    if (options.isolateComponents && testProcessor) {
      await testProcessor.init();
    }

    const cleanup = async () => {
      if (options.isolateComponents && testProcessor) {
        await testProcessor.shutdown();
      }
      testComponents.clear();
    };

    const getComponent = (id: string) => testComponents.get(id);

    const executeIntegration = async (type: string, data: any) => {
      const timeout = options.timeoutMs || 30000;
      
      return Promise.race([
        this.executeIntegrationInternal(type, data, testProcessor),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Integration timeout: ${type}`)), timeout)
        )
      ]);
    };

    return { cleanup, getComponent, executeIntegration };
  }

  /**
   * Internal integration execution
   */
  private async executeIntegrationInternal(type: string, data: any, processor?: ParallelProcessor | null): Promise<any> {
    switch (type) {
      case 'ontology-unjucks':
        return this.processOntologyToUnjucks(data.commandDef, data.templatePath);
      
      case 'cli-dispatch':
        return this.processCLIDispatch(data.command, data.args);
      
      case 'parallel-tasks':
        if (processor) {
          return processor.processBatch(data.tasks);
        }
        throw new Error('Parallel processor not available');
      
      default:
        throw new Error(`Unknown integration type: ${type}`);
    }
  }

  /**
   * Convert CommandDef to Ontology context
   */
  private async convertCommandToOntology(commandDef: CommandDef): Promise<any> {
    // Convert command definition to ontology format
    const ontologyData = {
      command: {
        name: commandDef.meta?.name,
        description: commandDef.meta?.description,
        version: commandDef.meta?.version,
        arguments: Object.entries(commandDef.args || {}).map(([name, def]) => ({
          name,
          type: def.type,
          description: def.description,
          required: def.required,
          default: def.default,
          alias: def.alias
        })),
        subCommands: Object.entries(commandDef.subCommands || {}).map(([name, subCmd]) => ({
          name,
          description: subCmd.meta?.description
        }))
      }
    };

    return ontologyData;
  }

  /**
   * Transform ontology context for templates
   */
  private transformContextForTemplates(ontologyContext: any): any {
    return {
      ...ontologyContext,
      helpers: {
        pascalCase: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
        camelCase: (str: string) => str.charAt(0).toLowerCase() + str.slice(1),
        kebabCase: (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase(),
        snakeCase: (str: string) => str.replace(/([A-Z])/g, '_$1').toLowerCase()
      },
      timestamp: new Date().toISOString(),
      generated: true
    };
  }

  /**
   * Cleanup all resources
   */
  async shutdown(): Promise<void> {
    if (this.parallelProcessor) {
      await this.parallelProcessor.shutdown();
    }
    
    this.componentRegistry.clear();
    this.integrationChain = [];
    this.emit('integration:shutdown');
  }

  /**
   * Get integration statistics
   */
  getStats() {
    return {
      registeredComponents: this.componentRegistry.size,
      integrationChainLength: this.integrationChain.length,
      parallelProcessorActive: !!this.parallelProcessor,
      listeners: this.eventNames().length
    };
  }
}

// Singleton instance
let globalIntegrationManager: IntegrationManager | null = null;

export function getIntegrationManager(): IntegrationManager {
  if (!globalIntegrationManager) {
    globalIntegrationManager = new IntegrationManager();
  }
  return globalIntegrationManager;
}

export async function initializeIntegrations(): Promise<IntegrationManager> {
  const manager = getIntegrationManager();
  await manager.initialize();
  return manager;
}