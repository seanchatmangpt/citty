/**
 * AI-Powered Test Orchestration System
 * Entry point for the comprehensive testing platform
 */

import { TestOrchestrator } from './orchestrator/main.js';
import { AITestGenerator } from './models/test-generator.js';
import { AdaptiveExecutor } from './engines/adaptive-executor.js';
import { CognitiveAnalyzer } from './analysis/cognitive-analyzer.js';
import { SwarmCoordinator } from './swarm/coordinator.js';
import { EnterpriseIntegration } from './enterprise/integration.js';
import { Logger } from './utils/logger.js';

export class AITestOrchestrationSystem {
  private orchestrator: TestOrchestrator;
  private testGenerator: AITestGenerator;
  private executor: AdaptiveExecutor;
  private analyzer: CognitiveAnalyzer;
  private swarmCoordinator: SwarmCoordinator;
  private enterpriseIntegration: EnterpriseIntegration;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AITestOrchestration');
    this.initializeComponents();
  }

  private async initializeComponents(): Promise<void> {
    this.logger.info('Initializing AI Test Orchestration System');
    
    // Initialize core components
    this.testGenerator = new AITestGenerator();
    this.executor = new AdaptiveExecutor();
    this.analyzer = new CognitiveAnalyzer();
    this.swarmCoordinator = new SwarmCoordinator();
    this.enterpriseIntegration = new EnterpriseIntegration();
    
    // Initialize main orchestrator with all components
    this.orchestrator = new TestOrchestrator({
      testGenerator: this.testGenerator,
      executor: this.executor,
      analyzer: this.analyzer,
      swarmCoordinator: this.swarmCoordinator,
      enterpriseIntegration: this.enterpriseIntegration
    });

    await this.orchestrator.initialize();
    this.logger.info('AI Test Orchestration System initialized successfully');
  }

  async start(): Promise<void> {
    await this.orchestrator.start();
    this.logger.info('AI Test Orchestration System is running');
  }

  async stop(): Promise<void> {
    await this.orchestrator.stop();
    this.logger.info('AI Test Orchestration System stopped');
  }

  // Public API methods
  async generateTests(userStory: string): Promise<any> {
    return await this.testGenerator.generateFromUserStory(userStory);
  }

  async executeTests(testSuite: any): Promise<any> {
    return await this.executor.executeTestSuite(testSuite);
  }

  async analyzeResults(results: any): Promise<any> {
    return await this.analyzer.analyzeTestResults(results);
  }

  async getMetrics(): Promise<any> {
    return await this.orchestrator.getSystemMetrics();
  }
}

export default AITestOrchestrationSystem;

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new AITestOrchestrationSystem();
  
  process.on('SIGINT', async () => {
    console.log('Shutting down AI Test Orchestration System...');
    await system.stop();
    process.exit(0);
  });
  
  await system.start();
}