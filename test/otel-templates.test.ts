import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATES_DIR = join(__dirname, '../playground/otel-templates');

describe('OpenTelemetry Templates', () => {
  it('should have all required template files', () => {
    const requiredFiles = [
      'templates/tracing.njk',
      'templates/metrics.njk', 
      'templates/spans.njk',
      'templates/attributes.njk',
      'templates/exporters.njk',
      'patterns/middleware.njk',
      'patterns/decorators.njk',
      'patterns/context-propagation.njk',
      'configs/otel-config.njk',
      'examples/basic-cli-example.njk',
      'examples/advanced-patterns.njk',
      'examples/citty-integration.njk',
      'README.md'
    ];

    for (const file of requiredFiles) {
      const filePath = join(TEMPLATES_DIR, file);
      expect(existsSync(filePath), `Template file ${file} should exist`).toBe(true);
    }
  });

  it('should contain proper template variable placeholders', () => {
    const tracingTemplate = readFileSync(join(TEMPLATES_DIR, 'templates/tracing.njk'), 'utf8');
    
    // Check for template variables
    expect(tracingTemplate).toContain('{{ serviceName }}');
    expect(tracingTemplate).toContain('{{ version }}');
    expect(tracingTemplate).toContain('{{ pascalCase(serviceName) }}');
    
    // Check for OpenTelemetry imports
    expect(tracingTemplate).toContain('@opentelemetry/sdk-node');
    expect(tracingTemplate).toContain('@opentelemetry/resources');
    expect(tracingTemplate).toContain('@opentelemetry/api');
  });

  it('should have proper middleware patterns', () => {
    const middlewareTemplate = readFileSync(join(TEMPLATES_DIR, 'patterns/middleware.njk'), 'utf8');
    
    // Check for middleware functions
    expect(middlewareTemplate).toContain('createObservabilityMiddleware');
    expect(middlewareTemplate).toContain('createValidationMiddleware');
    expect(middlewareTemplate).toContain('createFileOperationMiddleware');
    expect(middlewareTemplate).toContain('injectCittyMiddleware');
    
    // Check for proper exports
    expect(middlewareTemplate).toContain('export function');
  });

  it('should have decorator-based instrumentation', () => {
    const decoratorsTemplate = readFileSync(join(TEMPLATES_DIR, 'patterns/decorators.njk'), 'utf8');
    
    // Check for decorators
    expect(decoratorsTemplate).toContain('export function Command');
    expect(decoratorsTemplate).toContain('export function ValidateArgs');
    expect(decoratorsTemplate).toContain('export function FileOperation');
    expect(decoratorsTemplate).toContain('export function NetworkOperation');
    expect(decoratorsTemplate).toContain('export function PerformanceMonitor');
  });

  it('should have context propagation utilities', () => {
    const contextTemplate = readFileSync(join(TEMPLATES_DIR, 'patterns/context-propagation.njk'), 'utf8');
    
    // Check for context propagation classes
    expect(contextTemplate).toContain('ContextPropagator');
    expect(contextTemplate).toContain('ContextAwareHttpClient');
    expect(contextTemplate).toContain('DistributedTracing');
    
    // Check for W3C trace context support
    expect(contextTemplate).toContain('W3CTraceContextPropagator');
    expect(contextTemplate).toContain('W3CBaggagePropagator');
  });

  it('should have comprehensive configuration', () => {
    const configTemplate = readFileSync(join(TEMPLATES_DIR, 'configs/otel-config.njk'), 'utf8');
    
    // Check for configuration interfaces
    expect(configTemplate).toContain('interface OtelConfig');
    expect(configTemplate).toContain('createOtelConfig');
    expect(configTemplate).toContain('validateOtelConfig');
    
    // Check for exporter configurations
    expect(configTemplate).toContain('otlp');
    expect(configTemplate).toContain('jaeger');
    expect(configTemplate).toContain('zipkin');
    expect(configTemplate).toContain('prometheus');
  });

  it('should have complete CLI integration example', () => {
    const integrationExample = readFileSync(join(TEMPLATES_DIR, 'examples/citty-integration.njk'), 'utf8');
    
    // Check for Citty integration
    expect(integrationExample).toContain('defineCommand');
    expect(integrationExample).toContain('runMain');
    
    // Check for observability initialization
    expect(integrationExample).toContain('initializeObservability');
    expect(integrationExample).toContain('tracer.initialize');
    
    // Check for graceful shutdown
    expect(integrationExample).toContain('gracefulShutdown');
    expect(integrationExample).toContain('SIGINT');
    expect(integrationExample).toContain('SIGTERM');
  });

  it('should have comprehensive README documentation', () => {
    const readme = readFileSync(join(TEMPLATES_DIR, 'README.md'), 'utf8');
    
    // Check for main sections
    expect(readme).toContain('# OpenTelemetry Templates');
    expect(readme).toContain('## 🏗️ Template Structure');
    expect(readme).toContain('## 🚀 Features');
    expect(readme).toContain('## 📊 Supported Exporters');
    expect(readme).toContain('## 🌍 Environment Variables');
    
    // Check for usage examples
    expect(readme).toContain('Usage Examples');
    expect(readme).toContain('Basic CLI with Observability');
    expect(readme).toContain('Decorator-Based Instrumentation');
    expect(readme).toContain('Context Propagation');
  });

  it('should have proper TypeScript syntax in templates', () => {
    const templates = [
      'templates/tracing.njk',
      'templates/metrics.njk',
      'patterns/middleware.njk',
      'patterns/decorators.njk'
    ];

    for (const templatePath of templates) {
      const content = readFileSync(join(TEMPLATES_DIR, templatePath), 'utf8');
      
      // Check for TypeScript patterns (not strict syntax validation)
      expect(content).toMatch(/export.*class|export.*function|export.*interface/);
      expect(content).toMatch(/import.*from/);
    }
  });
});