/**
 * Production Examples for Citty-Pro Workflows
 * Demonstrates enterprise-grade ontology → template pipelines
 */

import { createPipeline, runOneShotGeneration, startWatchMode } from '../src/factory.js';
import { PipelineConfig } from '../src/types.js';

// Example 1: Multi-Team Software Architecture Documentation
export const softwareArchitectureWorkflow: PipelineConfig = {
  name: 'software-architecture-docs',
  
  ontologies: [
    {
      path: './ontologies/system-architecture.ttl',
      format: 'turtle',
      namespace: 'https://company.com/architecture#',
    },
    {
      path: './ontologies/service-catalog.ttl', 
      format: 'turtle',
      namespace: 'https://company.com/services#',
    },
    {
      path: './ontologies/data-models.ttl',
      format: 'turtle',
      namespace: 'https://company.com/data#',
    },
  ],
  
  templates: [
    {
      path: './templates/architecture/**/*.njk',
      output: 'docs/architecture/{{ template.name | replace(".njk", ".md") }}',
      context: {
        company: 'ACME Corporation',
        version: '2024.1',
        environment: 'production',
      },
    },
    {
      path: './templates/api-docs/**/*.njk',
      output: 'docs/api/{{ template.name | replace(".njk", ".md") }}',
    },
    {
      path: './templates/deployment/**/*.njk',
      output: 'deploy/{{ template.name | replace(".njk", ".yaml") }}',
    },
  ],
  
  output: {
    directory: './generated-docs',
    clean: true,
  },
  
  hiveQueen: {
    enabled: true,
    workers: 6,
    parallelism: 'both',
  },
  
  watch: {
    enabled: true,
    debounce: 1000,
    ignore: [
      'node_modules/**',
      '.git/**',
      'generated-docs/**',
    ],
  },
  
  validation: {
    strict: true,
  },
};

// Example 2: API Code Generation from Domain Ontology
export const apiCodegenWorkflow: PipelineConfig = {
  name: 'domain-api-codegen',
  
  ontologies: [
    {
      path: './domain/business-model.ttl',
      format: 'turtle',
    },
  ],
  
  templates: [
    // TypeScript interfaces
    {
      path: './templates/typescript/interfaces.ts.njk',
      output: 'src/types/{{ ontology.namespace | localName }}.ts',
      filters: ['owl:Class'],
    },
    
    // REST API controllers
    {
      path: './templates/api/controller.ts.njk', 
      output: 'src/controllers/{{ class | localName | kebabCase }}.controller.ts',
      context: {
        framework: 'fastify',
        validation: true,
      },
    },
    
    // Database schemas
    {
      path: './templates/database/schema.sql.njk',
      output: 'migrations/{{ timestamp }}_{{ class | localName | snakeCase }}.sql',
    },
    
    // OpenAPI documentation
    {
      path: './templates/openapi/spec.yaml.njk',
      output: 'docs/openapi.yaml',
    },
  ],
  
  output: {
    directory: './generated-api',
    clean: false, // Preserve existing files
  },
  
  hiveQueen: {
    enabled: true,
    workers: 4,
    parallelism: 'templates',
  },
};

// Example 3: Compliance and Governance Automation
export const complianceWorkflow: PipelineConfig = {
  name: 'gdpr-compliance-docs',
  
  ontologies: [
    {
      path: './compliance/gdpr-ontology.ttl',
      format: 'turtle',
    },
    {
      path: './compliance/data-processing.n3',
      format: 'n3',
    },
  ],
  
  templates: [
    {
      path: './templates/compliance/privacy-policy.md.njk',
      output: 'legal/privacy-policy.md',
    },
    {
      path: './templates/compliance/data-mapping.csv.njk',
      output: 'reports/data-processing-map.csv',
    },
    {
      path: './templates/compliance/consent-forms.html.njk',
      output: 'web/consent/{{ form.id }}.html',
    },
  ],
  
  output: {
    directory: './compliance-artifacts',
    clean: true,
  },
  
  validation: {
    strict: true,
    schema: './schemas/gdpr-validation.json',
  },
};

// Example 4: Multi-Language Documentation Generation
export const i18nDocsWorkflow: PipelineConfig = {
  name: 'internationalized-docs',
  
  ontologies: [
    {
      path: './ontologies/product-catalog.ttl',
      format: 'turtle',
    },
  ],
  
  templates: [
    {
      path: './templates/docs/user-manual-en.md.njk',
      output: 'docs/en/user-manual.md',
      context: { language: 'en', region: 'US' },
    },
    {
      path: './templates/docs/user-manual-es.md.njk', 
      output: 'docs/es/user-manual.md',
      context: { language: 'es', region: 'ES' },
    },
    {
      path: './templates/docs/user-manual-de.md.njk',
      output: 'docs/de/user-manual.md', 
      context: { language: 'de', region: 'DE' },
    },
  ],
  
  output: {
    directory: './docs-i18n',
    clean: true,
  },
  
  hiveQueen: {
    enabled: true,
    workers: 3, // One per language
    parallelism: 'templates',
  },
};

// Example 5: CI/CD Pipeline with Stress Testing
export async function setupCICDPipeline(): Promise<void> {
  const pipeline = createPipeline({
    enableHiveQueen: true,
    maxWorkers: 8,
    monitoringEnabled: true,
  });

  // Load configuration
  const config = await pipeline.configManager.loadConfig('./unjucks.config.yaml');

  // Setup GitHub integration
  await pipeline.github.setupGitHubIntegration('./', config, {
    includeAction: true,
    includePreCommit: true,
    actionTrigger: 'push',
  });

  console.log('CI/CD pipeline configured with GitHub Actions');
}

// Example 6: Real-time Development Workflow
export async function developmentWorkflow(): Promise<void> {
  console.log('Starting development workflow...');
  
  const { pipeline, config, stop } = await startWatchMode('./unjucks.config.yaml', {
    hiveQueen: {
      enabled: true,
      workers: 2, // Lighter load for development
    },
    watch: {
      enabled: true,
      debounce: 500, // Quick feedback
    },
  });

  // Set up event handlers
  pipeline.coordinator.on('job:started', (job) => {
    console.log(`🚀 Starting job: ${job.id}`);
  });

  pipeline.coordinator.on('phase:started', (phase) => {
    console.log(`📋 Phase: ${phase}`);
  });

  pipeline.coordinator.on('template:rendered', (event) => {
    console.log(`✅ Rendered: ${event.template} → ${event.output}`);
  });

  pipeline.coordinator.on('job:completed', (job) => {
    console.log(`🎉 Completed: ${job.metrics.filesGenerated} files generated`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await stop();
    process.exit(0);
  });

  console.log('👀 Watching for changes... Press Ctrl+C to stop');
}

// Example 7: High-Volume Enterprise Batch Processing
export const enterpriseBatchWorkflow: PipelineConfig = {
  name: 'enterprise-knowledge-base',
  
  ontologies: [
    { path: './kb/products/*.ttl', format: 'turtle' },
    { path: './kb/customers/*.n3', format: 'n3' },
    { path: './kb/processes/*.rdf', format: 'rdf-xml' },
    { path: './kb/regulations/*.ttl', format: 'turtle' },
  ],
  
  templates: [
    {
      path: './templates/knowledge-base/**/*.njk',
      output: 'kb-generated/{{ template.dir }}/{{ template.name | replace(".njk", ".md") }}',
    },
  ],
  
  output: {
    directory: './enterprise-kb',
    clean: false,
  },
  
  hiveQueen: {
    enabled: true,
    workers: 12, // High parallelism for enterprise
    parallelism: 'both',
  },
  
  validation: {
    strict: false, // Flexible for large datasets
  },
};

// Example 8: Performance Monitoring and Optimization
export async function performanceOptimizationExample(): Promise<void> {
  const pipeline = createPipeline({ monitoringEnabled: true });
  const config = enterpriseBatchWorkflow;

  // Set up performance monitoring
  pipeline.coordinator.on('job:started', (job) => {
    console.log(`Starting performance monitoring for job: ${job.id}`);
  });

  pipeline.coordinator.on('job:completed', (job) => {
    const duration = job.endTime!.getTime() - job.startTime!.getTime();
    const throughput = job.metrics.filesGenerated / (duration / 1000);
    
    console.log(`Performance Report:
      - Duration: ${duration}ms
      - Files: ${job.metrics.filesGenerated}
      - Throughput: ${throughput.toFixed(2)} files/sec
      - Ontologies: ${job.metrics.ontologiesProcessed}
      - Templates: ${job.metrics.templatesRendered}`);
  });

  // Execute with monitoring
  const job = await pipeline.coordinator.executeJob(config);
  
  if (job.metrics.errors.length > 0) {
    console.error('Errors encountered:', job.metrics.errors);
  }
}

// Example 9: Multi-Environment Deployment
export const environmentConfigs = {
  development: {
    hiveQueen: { workers: 2 },
    watch: { enabled: true, debounce: 300 },
    validation: { strict: false },
  },
  
  staging: {
    hiveQueen: { workers: 4 },
    watch: { enabled: false },
    validation: { strict: true },
  },
  
  production: {
    hiveQueen: { workers: 8 },
    watch: { enabled: false },
    validation: { strict: true },
  },
};

export async function deployToEnvironment(env: keyof typeof environmentConfigs): Promise<void> {
  const baseConfig = softwareArchitectureWorkflow;
  const envOverrides = environmentConfigs[env];
  
  const pipeline = createPipeline();
  const config = await pipeline.configManager.mergeConfigs(baseConfig, envOverrides);
  
  console.log(`Deploying to ${env} environment...`);
  
  await runOneShotGeneration('./unjucks.config.yaml', config);
  
  console.log(`✅ Deployment to ${env} completed successfully`);
}

// Example 10: Error Recovery and Resilience Testing
export async function resilienceTestingExample(): Promise<void> {
  const pipeline = createPipeline();
  
  // Simulate various failure scenarios
  const testCases = [
    {
      name: 'Large Ontology Processing',
      config: {
        ...enterpriseBatchWorkflow,
        hiveQueen: { enabled: true, workers: 16 },
      },
    },
    {
      name: 'Complex Template Rendering',
      config: {
        ...apiCodegenWorkflow,
        templates: apiCodegenWorkflow.templates.map(t => ({
          ...t,
          context: { ...t.context, complexity: 'maximum' },
        })),
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    try {
      const startTime = Date.now();
      const job = await pipeline.coordinator.executeJob(testCase.config);
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${testCase.name}: ${duration}ms, ${job.metrics.filesGenerated} files`);
      
    } catch (error) {
      console.error(`❌ ${testCase.name}: ${error}`);
    }
  }
}

// Example CLI usage patterns
export const cliExamples = {
  // Basic generation
  basic: 'unjucks sync --config ./examples/basic.config.yaml',
  
  // Development with watching
  development: 'unjucks watch --config ./examples/dev.config.yaml --debounce 300',
  
  // Production with validation
  production: 'unjucks sync --config ./examples/prod.config.yaml --workers 8 && unjucks validate --strict',
  
  // Selective generation
  selective: 'unjucks generate --config ./config.yaml --template "api/**" --include "controller" --exclude "test"',
  
  // CI/CD pipeline
  cicd: 'unjucks validate --config ./config.yaml --strict && unjucks sync --workers ${CI_WORKERS:-4}',
};

// Export convenience function for running examples
export async function runExample(exampleName: keyof typeof cliExamples): Promise<void> {
  const command = cliExamples[exampleName];
  console.log(`Running example: ${exampleName}`);
  console.log(`Command: ${command}`);
  
  // In a real implementation, you would execute the command
  // For demo purposes, we'll just show what would run
  console.log('This would execute the CLI command in a production environment');
}