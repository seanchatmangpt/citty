import { OllamaCliGenerator, CliGenerationEngine } from './cli-generator.ts';
import consola from 'consola';
import { performance } from 'perf_hooks';
import { writeFileSync } from 'node:fs';

/**
 * Comprehensive CLI Generation Testing Suite
 * Tests real Ollama integration with permutations and combinations
 */

async function runComprehensiveTests() {
  consola.info('🚀 Starting comprehensive CLI generation tests...');
  
  const startTime = performance.now();
  
  // Initialize engines
  const generator = new OllamaCliGenerator();
  const engine = new CliGenerationEngine();
  
  // Test scenarios
  const testScenarios = [
    {
      name: 'File Management CLI',
      prompt: 'Create a CLI for file management operations like copy, move, delete, and list files with advanced filtering',
      expectedCommands: ['copy', 'move', 'delete', 'list', 'search']
    },
    {
      name: 'Docker Management CLI',
      prompt: 'Build a Docker management CLI that can start, stop, and monitor containers with health checks',
      expectedCommands: ['start', 'stop', 'monitor', 'health', 'logs']
    },
    {
      name: 'API Testing CLI',
      prompt: 'Create a CLI tool for API testing with support for REST and GraphQL endpoints, load testing, and reporting',
      expectedCommands: ['test', 'load', 'report', 'monitor', 'validate']
    },
    {
      name: 'Database CLI',
      prompt: 'Generate a database management CLI with migration support, backup/restore, and query execution',
      expectedCommands: ['migrate', 'backup', 'restore', 'query', 'status']
    },
    {
      name: 'Cloud Deployment CLI',
      prompt: 'Build a multi-cloud deployment CLI supporting AWS, GCP, and Azure with infrastructure as code',
      expectedCommands: ['deploy', 'destroy', 'status', 'logs', 'rollback']
    }
  ];

  const results = [];
  
  for (const scenario of testScenarios) {
    consola.info(`\n🧪 Testing: ${scenario.name}`);
    
    try {
      // Test single generation
      const singleResult = await testSingleGeneration(generator, scenario);
      
      // Test permutations
      const permutationResults = await testPermutations(engine, scenario);
      
      // Test E2E workflows
      const e2eResults = await testE2eWorkflows(permutationResults);
      
      results.push({
        scenario: scenario.name,
        single: singleResult,
        permutations: permutationResults,
        e2e: e2eResults,
        status: 'completed'
      });
      
    } catch (error) {
      consola.error(`❌ Failed testing ${scenario.name}:`, error);
      results.push({
        scenario: scenario.name,
        error: error.message,
        status: 'failed'
      });
    }
  }
  
  const endTime = performance.now();
  const totalTime = Math.round((endTime - startTime) / 1000);
  
  // Generate comprehensive report
  generateTestReport(results, totalTime);
  
  return results;
}

/**
 * Test single CLI generation
 */
async function testSingleGeneration(generator: OllamaCliGenerator, scenario: any) {
  const startTime = performance.now();
  
  consola.info(`  🔄 Generating CLI for: ${scenario.name}`);
  
  const result = await generator.generateFromNaturalLanguage(scenario.prompt, {
    complexity: 'medium',
    style: 'modern',
    features: ['help', 'version', 'verbose'],
    outputDir: `./generated/single/${scenario.name.toLowerCase().replace(/\s+/g, '-')}`
  });
  
  const duration = Math.round((performance.now() - startTime) / 1000);
  
  // Validate generated CLI
  const validation = validateGeneratedCli(result, scenario.expectedCommands);
  
  consola.info(`  ✅ Generated in ${duration}s - ${validation.score}/100`);
  
  return {
    duration,
    validation,
    result,
    generatedCommands: result.specification?.commands?.map((c: any) => c.name) || [],
    generatedFiles: result.implementation?.files || []
  };
}

/**
 * Test CLI generation permutations
 */
async function testPermutations(engine: CliGenerationEngine, scenario: any) {
  consola.info(`  🔄 Testing permutations for: ${scenario.name}`);
  
  const variations = {
    complexities: ['simple', 'medium', 'complex'],
    styles: ['modern', 'classic', 'minimal'],
    featureSets: [
      ['help', 'version'],
      ['help', 'version', 'verbose', 'config'],
      ['help', 'version', 'verbose', 'config', 'json', 'yaml']
    ]
  };
  
  const startTime = performance.now();
  const results = await engine.generatePermutations(scenario.prompt, variations);
  const duration = Math.round((performance.now() - startTime) / 1000);
  
  consola.info(`  ✅ Generated ${results.length} permutations in ${duration}s`);
  
  return {
    duration,
    permutationCount: results.length,
    results,
    variations
  };
}

/**
 * Test E2E workflows on generated CLIs
 */
async function testE2eWorkflows(permutationResults: any) {
  consola.info('  🧪 Running E2E tests on generated CLIs...');
  
  const startTime = performance.now();
  const engine = new CliGenerationEngine();
  
  const testResults = await engine.testGeneratedClis(permutationResults.results || []);
  const duration = Math.round((performance.now() - startTime) / 1000);
  
  const totalTests = testResults.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = testResults.reduce((sum, r) => sum + r.passedTests, 0);
  const overallPassRate = (totalPassed / totalTests) * 100;
  
  consola.info(`  ✅ E2E tests completed in ${duration}s - ${overallPassRate.toFixed(1)}% pass rate`);
  
  return {
    duration,
    totalTests,
    totalPassed,
    overallPassRate,
    testResults
  };
}

/**
 * Validate generated CLI against expected features
 */
function validateGeneratedCli(result: any, expectedCommands: string[]): any {
  let score = 0;
  const maxScore = 100;
  
  // Check if specification was generated
  if (result.specification) {
    score += 20;
    
    // Check if expected commands are present
    const generatedCommands = result.specification.commands?.map((c: any) => c.name) || [];
    const commandMatches = expectedCommands.filter(cmd => 
      generatedCommands.some(gen => gen.toLowerCase().includes(cmd.toLowerCase()))
    );
    
    score += (commandMatches.length / expectedCommands.length) * 30;
  }
  
  // Check if semantic conventions were generated
  if (result.semanticConventions) {
    score += 15;
  }
  
  // Check if implementation was generated
  if (result.implementation) {
    score += 15;
  }
  
  // Check if tests were generated
  if (result.tests) {
    score += 10;
  }
  
  // Check if documentation was generated
  if (result.documentation) {
    score += 10;
  }
  
  return {
    score: Math.min(score, maxScore),
    hasSpecification: !!result.specification,
    hasSemanticConventions: !!result.semanticConventions,
    hasImplementation: !!result.implementation,
    hasTests: !!result.tests,
    hasDocumentation: !!result.documentation,
    commandCoverage: result.specification?.commands?.length || 0
  };
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results: any[], totalTime: number) {
  consola.info('\n📊 Comprehensive Test Report\n');
  
  const successful = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  consola.box(`
🎯 CLI Generation Test Results

📊 Overall Results:
  ✅ Successful: ${successful}/${results.length} scenarios
  ❌ Failed: ${failed}/${results.length} scenarios
  ⏱️  Total Time: ${totalTime}s

📈 Performance Metrics:
  🔄 Average Generation Time: ${Math.round(results.reduce((sum, r) => sum + (r.single?.duration || 0), 0) / successful)}s
  🧪 Total E2E Tests: ${results.reduce((sum, r) => sum + (r.e2e?.totalTests || 0), 0)}
  📈 Overall Pass Rate: ${(results.reduce((sum, r) => sum + (r.e2e?.overallPassRate || 0), 0) / successful).toFixed(1)}%

🔧 Generation Analysis:
  📦 Total Permutations: ${results.reduce((sum, r) => sum + (r.permutations?.permutationCount || 0), 0)}
  📋 Average CLI Score: ${Math.round(results.reduce((sum, r) => sum + (r.single?.validation?.score || 0), 0) / successful)}/100
  `);

  // Detailed scenario results
  consola.info('📋 Detailed Results by Scenario:\n');
  
  results.forEach(result => {
    const status = result.status === 'completed' ? '✅' : '❌';
    const score = result.single?.validation?.score || 0;
    const permutations = result.permutations?.permutationCount || 0;
    const passRate = result.e2e?.overallPassRate?.toFixed(1) || '0';
    
    consola.info(`${status} ${result.scenario}`);
    consola.info(`    📊 Score: ${score}/100`);
    consola.info(`    🔄 Permutations: ${permutations}`);
    consola.info(`    🧪 E2E Pass Rate: ${passRate}%`);
    
    if (result.error) {
      consola.info(`    ❌ Error: ${result.error}`);
    }
    
    consola.info('');
  });

  // Generate JSON report
  const jsonReport = {
    generatedAt: new Date().toISOString(),
    totalTime,
    scenarios: results,
    summary: {
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      averageGenerationTime: Math.round(results.reduce((sum, r) => sum + (r.single?.duration || 0), 0) / successful),
      totalPermutations: results.reduce((sum, r) => sum + (r.permutations?.permutationCount || 0), 0),
      overallScore: Math.round(results.reduce((sum, r) => sum + (r.single?.validation?.score || 0), 0) / successful)
    }
  };
  
  // Save report
  writeFileSync('./playground/test-report.json', JSON.stringify(jsonReport, null, 2));
  
  consola.success('📄 Detailed report saved to ./playground/test-report.json');
}

/**
 * Run specific test scenario
 */
async function runSpecificTest(scenarioName: string) {
  const scenarios = {
    'docker': {
      name: 'Docker CLI Test',
      prompt: 'Create a comprehensive Docker management CLI with container lifecycle management, network configuration, and volume handling',
      expectedCommands: ['run', 'stop', 'build', 'push', 'pull', 'network', 'volume']
    },
    'api': {
      name: 'API Testing CLI',
      prompt: 'Build an API testing CLI that supports REST and GraphQL with authentication, load testing, and detailed reporting',
      expectedCommands: ['test', 'load', 'auth', 'report', 'mock', 'validate']
    },
    'files': {
      name: 'File Management CLI',
      prompt: 'Generate a file management CLI with batch operations, filtering, compression, and backup features',
      expectedCommands: ['copy', 'move', 'delete', 'find', 'compress', 'backup']
    }
  };
  
  const scenario = scenarios[scenarioName as keyof typeof scenarios];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }
  
  const generator = new OllamaCliGenerator();
  return await testSingleGeneration(generator, scenario);
}

// Export functions for CLI usage
export {
  runComprehensiveTests,
  runSpecificTest,
  testSingleGeneration,
  testPermutations,
  testE2eWorkflows
};

// Run if called directly
if (import.meta.main) {
  runComprehensiveTests().catch(console.error);
}