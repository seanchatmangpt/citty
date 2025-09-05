#!/usr/bin/env node
/**
 * AI Test Orchestration CLI
 * Command-line interface for the test orchestration system
 */

import { program } from 'commander';
import { readFile } from 'fs/promises';
import { join } from 'path';
import AITestOrchestrationSystem from './index.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('CLI');
let orchestrationSystem: AITestOrchestrationSystem | null = null;

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', { promise, reason });
  process.exit(1);
});

// Version information
async function getVersion(): Promise<string> {
  try {
    const packageJson = JSON.parse(
      await readFile(join(__dirname, '../package.json'), 'utf-8')
    );
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

// Initialize orchestration system
async function initializeSystem(): Promise<AITestOrchestrationSystem> {
  if (!orchestrationSystem) {
    orchestrationSystem = new AITestOrchestrationSystem();
    await orchestrationSystem.start();
  }
  return orchestrationSystem;
}

// Cleanup handler
async function cleanup(): Promise<void> {
  if (orchestrationSystem) {
    logger.info('Shutting down orchestration system...');
    await orchestrationSystem.stop();
    orchestrationSystem = null;
  }
}

// Setup signal handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

program
  .name('ai-test-orchestration')
  .description('AI-Powered Test Orchestration System')
  .version(await getVersion());

// Generate command
program
  .command('generate')
  .description('Generate test scenarios from user story')
  .requiredOption('-s, --story <story>', 'User story text')
  .option('-o, --output <file>', 'Output file for generated tests')
  .option('-f, --format <format>', 'Output format (json|gherkin|junit)', 'json')
  .action(async (options) => {
    try {
      logger.info('Generating test scenarios...');
      const system = await initializeSystem();
      
      const testScenarios = await system.generateTests(options.story);
      
      if (options.output) {
        const fs = await import('fs/promises');
        let content = '';
        
        switch (options.format) {
          case 'gherkin':
            content = formatAsGherkin(testScenarios);
            break;
          case 'junit':
            content = formatAsJUnit(testScenarios);
            break;
          default:
            content = JSON.stringify(testScenarios, null, 2);
        }
        
        await fs.writeFile(options.output, content);
        logger.info(`Generated ${testScenarios.length} test scenarios saved to ${options.output}`);
      } else {
        console.log(JSON.stringify(testScenarios, null, 2));
      }
      
    } catch (error) {
      logger.error('Failed to generate test scenarios:', error);
      process.exit(1);
    }
  });

// Execute command
program
  .command('execute')
  .description('Execute test suite')
  .requiredOption('-f, --file <file>', 'Test suite file')
  .option('-p, --parallel', 'Enable parallel execution')
  .option('-c, --concurrency <number>', 'Max concurrent tests', '5')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '300000')
  .option('--swarm', 'Use swarm execution')
  .option('-r, --report <file>', 'Generate execution report')
  .action(async (options) => {
    try {
      logger.info('Executing test suite...');
      const system = await initializeSystem();
      
      // Read test suite file
      const fs = await import('fs/promises');
      const testSuiteData = await fs.readFile(options.file, 'utf-8');
      const testSuite = JSON.parse(testSuiteData);
      
      // Configure execution options
      testSuite.configuration = {
        parallel: options.parallel || false,
        maxConcurrency: parseInt(options.concurrency),
        timeout: parseInt(options.timeout),
        retryPolicy: {
          enabled: true,
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          retryableErrors: ['timeout', 'network']
        }
      };
      
      const results = await system.executeTests(testSuite);
      
      if (options.report) {
        const report = generateExecutionReport(results);
        await fs.writeFile(options.report, JSON.stringify(report, null, 2));
        logger.info(`Execution report saved to ${options.report}`);
      }
      
      // Print summary
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const passRate = ((passed / results.length) * 100).toFixed(2);
      
      console.log(`\\nExecution Summary:`);
      console.log(`Total Tests: ${results.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log(`Pass Rate: ${passRate}%`);
      
      if (failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      logger.error('Failed to execute test suite:', error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze test results')
  .requiredOption('-f, --file <file>', 'Test results file')
  .option('-o, --output <file>', 'Analysis output file')
  .option('--predictions', 'Include predictive insights')
  .option('--patterns', 'Analyze failure patterns')
  .action(async (options) => {
    try {
      logger.info('Analyzing test results...');
      const system = await initializeSystem();
      
      // Read test results file
      const fs = await import('fs/promises');
      const resultsData = await fs.readFile(options.file, 'utf-8');
      const testResults = JSON.parse(resultsData);
      
      const analysis = await system.analyzeResults(testResults);
      
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(analysis, null, 2));
        logger.info(`Analysis saved to ${options.output}`);
      } else {
        console.log(JSON.stringify(analysis, null, 2));
      }
      
    } catch (error) {
      logger.error('Failed to analyze test results:', error);
      process.exit(1);
    }
  });

// Orchestrate command
program
  .command('orchestrate')
  .description('Run complete AI orchestration workflow')
  .requiredOption('-s, --story <story>', 'User story text')
  .option('--swarm', 'Use swarm intelligence')
  .option('-p, --parallel', 'Enable parallel execution')
  .option('-c, --concurrency <number>', 'Max concurrent tests', '5')
  .option('-r, --report <file>', 'Generate comprehensive report')
  .option('--compliance', 'Generate compliance report')
  .option('--notify', 'Send notifications')
  .action(async (options) => {
    try {
      logger.info('Starting AI orchestration workflow...');
      const system = await initializeSystem();
      
      // This would use the orchestrator's full workflow
      console.log('AI Orchestration workflow is not yet implemented in CLI');
      console.log('Use the system programmatically for full orchestration features');
      
    } catch (error) {
      logger.error('Failed to run orchestration workflow:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Get system status and metrics')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const system = await initializeSystem();
      const metrics = await system.getMetrics();
      
      if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log('\\nAI Test Orchestration System Status:');
        console.log('=====================================');
        console.log(`System Health: ${metrics.systemHealth || 'Unknown'}%`);
        console.log(`Active Nodes: ${metrics.swarm?.nodeCount || 0}`);
        console.log(`Running Tests: ${metrics.executor?.queueStats || 0}`);
        console.log(`Total Executions: ${metrics.orchestrator?.totalExecutions || 0}`);
        console.log(`Success Rate: ${((metrics.orchestrator?.successfulExecutions || 0) / Math.max(metrics.orchestrator?.totalExecutions || 1, 1) * 100).toFixed(2)}%`);
      }
      
    } catch (error) {
      logger.error('Failed to get system status:', error);
      process.exit(1);
    }
  });

// Server command
program
  .command('server')
  .description('Start orchestration server')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('--dashboard-port <port>', 'Dashboard port', '3001')
  .action(async (options) => {
    try {
      logger.info('Starting orchestration server...');
      const system = await initializeSystem();
      
      logger.info(`Server started on port ${options.port}`);
      logger.info(`Dashboard available on port ${options.dashboardPort}`);
      
      // Keep the process running
      await new Promise(() => {}); // This will run indefinitely
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  });

// Helper functions
function formatAsGherkin(testScenarios: any[]): string {
  return testScenarios.map(scenario => {
    if (scenario.given && scenario.when && scenario.then) {
      return `Feature: ${scenario.title}

Scenario: ${scenario.description}
  Given ${scenario.given}
  When ${scenario.when}
  Then ${scenario.then}
`;
    } else {
      return `Feature: ${scenario.title}

Scenario: ${scenario.description}
${scenario.steps.map((step: string, index: number) => `  ${index === 0 ? 'Given' : index === scenario.steps.length - 1 ? 'Then' : 'And'} ${step}`).join('\\n')}
`;
    }
  }).join('\\n');
}

function formatAsJUnit(testScenarios: any[]): string {
  const testCases = testScenarios.map(scenario => `
    <testcase name="${scenario.title}" classname="GeneratedTests">
      <system-out>${scenario.description}</system-out>
    </testcase>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="AI Generated Test Suite" tests="${testScenarios.length}" failures="0" errors="0" time="0">
  ${testCases}
</testsuite>`;
}

function generateExecutionReport(results: any[]): any {
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  return {
    summary: {
      totalTests: results.length,
      passed,
      failed,
      passRate: (passed / results.length) * 100,
      totalDuration,
      averageDuration: totalDuration / results.length
    },
    results,
    generatedAt: new Date().toISOString()
  };
}

// Parse command line arguments
program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}