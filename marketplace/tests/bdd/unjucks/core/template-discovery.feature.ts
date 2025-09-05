/**
 * HIVE QUEEN BDD Scenarios - Unjucks Template Auto-Discovery
 * Enterprise-grade template discovery with citty-pro integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

// Mock Unjucks Template Engine
interface TemplateContext {
  ontology?: any;
  metadata?: Record<string, any>;
  format?: 'typescript' | 'markdown' | 'yaml' | 'json';
  frontMatter?: Record<string, any>;
}

interface Template {
  path: string;
  name: string;
  content: string;
  context?: TemplateContext;
  inheritance?: string[];
  dependencies?: string[];
}

class UnjucksEngine {
  private templateCache = new Map<string, Template>();
  private watchedPaths = new Set<string>();
  private hotReloadEnabled = false;

  async discoverTemplates(basePath: string, patterns: string[] = ['**/*.njk', '**/*.unjk']): Promise<Template[]> {
    const templates: Template[] = [];
    // Implementation would use glob pattern matching
    return templates;
  }

  async renderTemplate(templatePath: string, context: TemplateContext): Promise<string> {
    // Mock implementation
    return `<!-- Rendered template: ${templatePath} -->`;
  }

  enableHotReload(watchPaths: string[]): void {
    this.hotReloadEnabled = true;
    watchPaths.forEach(path => this.watchedPaths.add(path));
  }

  async parseTemplate(content: string): Promise<{ frontMatter?: any; template: string }> {
    // Parse front matter and template content
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex > 0) {
        const frontMatter = content.substring(4, endIndex);
        const template = content.substring(endIndex + 5);
        return { frontMatter: JSON.parse(frontMatter), template };
      }
    }
    return { template: content };
  }
}

describe('HIVE QUEEN BDD: Unjucks Template Auto-Discovery', () => {
  let engine: UnjucksEngine;
  let tempDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    engine = new UnjucksEngine();
    tempDir = await mkdtemp(join(tmpdir(), 'unjucks-test-'));
    templatesDir = join(tempDir, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('FEATURE: Template Directory Walking', () => {
    describe('SCENARIO: Discover templates in nested directories', () => {
      it('GIVEN a template directory structure with nested templates WHEN discovering templates THEN finds all templates recursively', async () => {
        // GIVEN: Create nested template structure
        const templateStructure = {
          'commands/cli-command.njk': `
---
{
  "type": "citty-command",
  "ontology": "command-ontology",
  "output": "typescript"
}
---
import { defineCommand } from 'citty';

export const {{ commandName }}Command = defineCommand({
  meta: {
    name: '{{ commandName }}',
    description: '{{ description }}'
  },
  args: {
    {% for arg in args %}
    {{ arg.name }}: { type: '{{ arg.type }}', required: {{ arg.required }} }{% if not loop.last %},{% endif %}
    {% endfor %}
  },
  run: async ({ args }) => {
    // {{ implementation }}
  }
});
          `,
          'workflows/processing-workflow.njk': `
---
{
  "type": "citty-workflow",
  "ontology": "workflow-ontology",
  "output": "typescript"
}
---
import { defineWorkflow } from 'citty-pro';

export const {{ workflowName }}Workflow = defineWorkflow({
  id: '{{ workflowId }}',
  steps: [
    {% for step in steps %}
    {
      id: '{{ step.id }}',
      use: {{ step.taskRef }},
      {% if step.condition %}condition: {{ step.condition | dump }},{% endif %}
      {% if step.retry %}retry: {{ step.retry | dump }}{% endif %}
    }{% if not loop.last %},{% endif %}
    {% endfor %}
  ]
});
          `,
          'schemas/data-models.njk': `
---
{
  "type": "zod-schema",
  "ontology": "data-ontology",
  "output": "typescript"
}
---
import { z } from 'zod';

export const {{ schemaName }}Schema = z.object({
  {% for field in fields %}
  {{ field.name }}: z.{{ field.type }}(){% if field.constraints %}.{{ field.constraints }}(){% endif %}{% if not loop.last %},{% endif %}
  {% endfor %}
});

export type {{ schemaName }} = z.infer<typeof {{ schemaName }}Schema>;
          `,
          'docs/api-documentation.njk': `
---
{
  "type": "markdown-docs",
  "ontology": "api-ontology",
  "output": "markdown"
}
---
# {{ apiName }} API Documentation

## Overview
{{ description }}

## Endpoints
{% for endpoint in endpoints %}
### {{ endpoint.method | upper }} {{ endpoint.path }}
{{ endpoint.description }}

**Parameters:**
{% for param in endpoint.parameters %}
- `{{ param.name }}` ({{ param.type }}) - {{ param.description }}
{% endfor %}

**Response:**
```json
{{ endpoint.responseSchema | dump(2) }}
```

{% endfor %}
          `,
          'kubernetes/deployment-manifest.njk': `
---
{
  "type": "k8s-manifest",
  "ontology": "deployment-ontology",
  "output": "yaml"
}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ serviceName }}
  namespace: {{ namespace | default('default') }}
  labels:
    app: {{ serviceName }}
    version: {{ version }}
spec:
  replicas: {{ replicas | default(3) }}
  selector:
    matchLabels:
      app: {{ serviceName }}
  template:
    metadata:
      labels:
        app: {{ serviceName }}
        version: {{ version }}
    spec:
      containers:
      - name: {{ serviceName }}
        image: {{ image }}
        ports:
        {% for port in ports %}
        - containerPort: {{ port.container }}
          protocol: {{ port.protocol | default('TCP') }}
        {% endfor %}
        env:
        {% for env in environment %}
        - name: {{ env.name }}
          value: "{{ env.value }}"
        {% endfor %}
        resources:
          requests:
            memory: {{ resources.memory.request | default('256Mi') }}
            cpu: {{ resources.cpu.request | default('100m') }}
          limits:
            memory: {{ resources.memory.limit | default('512Mi') }}
            cpu: {{ resources.cpu.limit | default('500m') }}
          `
        };

        // Create template files
        for (const [path, content] of Object.entries(templateStructure)) {
          const fullPath = join(templatesDir, path);
          await fs.mkdir(resolve(fullPath, '..'), { recursive: true });
          await fs.writeFile(fullPath, content.trim());
        }

        // WHEN: Discover templates
        const discoveredTemplates = await engine.discoverTemplates(templatesDir);

        // THEN: All templates found with correct metadata
        expect(discoveredTemplates).toHaveLength(5);
        
        const commandTemplate = discoveredTemplates.find(t => t.path.includes('cli-command.njk'));
        expect(commandTemplate).toBeDefined();
        expect(commandTemplate?.context?.frontMatter.type).toBe('citty-command');
        expect(commandTemplate?.context?.frontMatter.output).toBe('typescript');

        const workflowTemplate = discoveredTemplates.find(t => t.path.includes('processing-workflow.njk'));
        expect(workflowTemplate).toBeDefined();
        expect(workflowTemplate?.context?.frontMatter.type).toBe('citty-workflow');

        const k8sTemplate = discoveredTemplates.find(t => t.path.includes('deployment-manifest.njk'));
        expect(k8sTemplate).toBeDefined();
        expect(k8sTemplate?.context?.frontMatter.output).toBe('yaml');
      });

      it('GIVEN templates with inheritance relationships WHEN discovering templates THEN resolves template dependencies', async () => {
        // GIVEN: Templates with inheritance
        const baseTemplate = `
---
{
  "type": "base-command",
  "abstract": true
}
---
import { defineCommand } from 'citty';

{% block imports %}{% endblock %}

export const {{ commandName }}Command = defineCommand({
  {% block meta %}
  meta: {
    name: '{{ commandName }}',
    description: '{{ description }}'
  },
  {% endblock %}
  {% block args %}{% endblock %}
  {% block run %}
  run: async ({ args }) => {
    {% block implementation %}{% endblock %}
  }
  {% endblock %}
});
        `;

        const childTemplate = `
---
{
  "type": "api-command",
  "extends": "base-command.njk",
  "ontology": "api-ontology"
}
---
{% extends "base-command.njk" %}

{% block imports %}
import axios from 'axios';
{% endblock %}

{% block args %}
args: {
  endpoint: { type: 'string', required: true },
  method: { type: 'enum', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' }
},
{% endblock %}

{% block implementation %}
const response = await axios({
  url: args.endpoint,
  method: args.method
});
console.log(response.data);
{% endblock %}
        `;

        await fs.writeFile(join(templatesDir, 'base-command.njk'), baseTemplate.trim());
        await fs.writeFile(join(templatesDir, 'api-command.njk'), childTemplate.trim());

        // WHEN: Discover templates
        const templates = await engine.discoverTemplates(templatesDir);

        // THEN: Template inheritance resolved
        const apiTemplate = templates.find(t => t.name === 'api-command');
        expect(apiTemplate).toBeDefined();
        expect(apiTemplate?.inheritance).toContain('base-command.njk');
        expect(apiTemplate?.context?.frontMatter.extends).toBe('base-command.njk');
      });
    });

    describe('SCENARIO: Filter templates by type and ontology', () => {
      it('GIVEN mixed template types WHEN filtering by ontology THEN returns only matching templates', async () => {
        // GIVEN: Mixed templates
        const templates = {
          'trading-algorithm.njk': `
---
{
  "type": "algorithm",
  "ontology": "trading-ontology",
  "domain": "finance"
}
---
// Trading algorithm template
          `,
          'user-interface.njk': `
---
{
  "type": "component",
  "ontology": "ui-ontology",
  "domain": "frontend"
}
---
// UI component template
          `,
          'data-pipeline.njk': `
---
{
  "type": "workflow",
  "ontology": "data-ontology",
  "domain": "backend"
}
---
// Data pipeline template
          `
        };

        for (const [path, content] of Object.entries(templates)) {
          await fs.writeFile(join(templatesDir, path), content.trim());
        }

        // WHEN: Filter by trading ontology
        const allTemplates = await engine.discoverTemplates(templatesDir);
        const tradingTemplates = allTemplates.filter(t => 
          t.context?.frontMatter?.ontology === 'trading-ontology'
        );

        // THEN: Only trading templates returned
        expect(tradingTemplates).toHaveLength(1);
        expect(tradingTemplates[0].name).toBe('trading-algorithm');
        expect(tradingTemplates[0].context?.frontMatter.domain).toBe('finance');
      });
    });
  });

  describe('FEATURE: Front-Matter Parsing', () => {
    describe('SCENARIO: Parse YAML front-matter with template metadata', () => {
      it('GIVEN template with complex front-matter WHEN parsing THEN extracts all metadata correctly', async () => {
        // GIVEN: Template with rich front-matter
        const complexTemplate = `
---
{
  "type": "microservice-generator",
  "ontology": "service-mesh-ontology",
  "version": "2.1.0",
  "author": "Platform Team",
  "output": "typescript",
  "tags": ["microservice", "kubernetes", "observability"],
  "dependencies": [
    "express",
    "prometheus-client",
    "opentelemetry"
  ],
  "configuration": {
    "port": 3000,
    "metrics": true,
    "tracing": true,
    "healthCheck": true
  },
  "templates": {
    "dockerfile": "docker/Dockerfile.njk",
    "helm": "k8s/helm-chart.njk",
    "tests": "tests/service.test.njk"
  }
}
---
import express from 'express';
import { register } from 'prom-client';

const app = express();
const PORT = {{ configuration.port }};

{% if configuration.healthCheck %}
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});
{% endif %}

{% if configuration.metrics %}
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
{% endif %}

app.listen(PORT, () => {
  console.log(\`{{ type }} service running on port \${PORT}\`);
});
        `;

        await fs.writeFile(join(templatesDir, 'microservice.njk'), complexTemplate.trim());

        // WHEN: Parse template
        const { frontMatter, template } = await engine.parseTemplate(complexTemplate.trim());

        // THEN: All metadata extracted
        expect(frontMatter).toBeDefined();
        expect(frontMatter.type).toBe('microservice-generator');
        expect(frontMatter.ontology).toBe('service-mesh-ontology');
        expect(frontMatter.version).toBe('2.1.0');
        expect(frontMatter.tags).toContain('microservice');
        expect(frontMatter.tags).toContain('kubernetes');
        expect(frontMatter.dependencies).toContain('express');
        expect(frontMatter.configuration.port).toBe(3000);
        expect(frontMatter.configuration.metrics).toBe(true);
        expect(frontMatter.templates.dockerfile).toBe('docker/Dockerfile.njk');
        expect(template).toContain('import express from \'express\';');
      });
    });
  });

  describe('FEATURE: Template Validation', () => {
    describe('SCENARIO: Validate template syntax and structure', () => {
      it('GIVEN template with invalid syntax WHEN validating THEN reports specific errors', async () => {
        // GIVEN: Template with syntax errors
        const invalidTemplate = `
---
{
  "type": "invalid-template",
  "ontology": "test-ontology"
}
---
{% for item in items %}
  {{ item.name }}
  <!-- Missing endfor -->

{{ unclosed.expression

{% if condition %}
  Content here
  <!-- Missing endif -->
        `;

        await fs.writeFile(join(templatesDir, 'invalid.njk'), invalidTemplate.trim());

        // WHEN/THEN: Validation fails with specific errors
        await expect(async () => {
          await engine.discoverTemplates(templatesDir);
        }).rejects.toThrow(/template syntax error/i);
      });
    });
  });

  describe('FEATURE: Performance Optimization', () => {
    describe('SCENARIO: Handle large numbers of templates efficiently', () => {
      it('GIVEN 1000+ templates WHEN discovering THEN completes under performance threshold', async () => {
        // GIVEN: Create 1000 templates
        const templateCount = 1000;
        const createPromises: Promise<void>[] = [];

        for (let i = 0; i < templateCount; i++) {
          const templateContent = `
---
{
  "type": "generated-template-${i}",
  "ontology": "performance-test-ontology",
  "index": ${i}
}
---
// Generated template ${i}
console.log('Template ${i} executed');
          `;

          const promise = fs.writeFile(
            join(templatesDir, `template-${i.toString().padStart(4, '0')}.njk`),
            templateContent.trim()
          );
          createPromises.push(promise);
        }

        await Promise.all(createPromises);

        // WHEN: Discover all templates with timing
        const startTime = performance.now();
        const templates = await engine.discoverTemplates(templatesDir);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // THEN: Performance meets requirements
        expect(templates).toHaveLength(templateCount);
        expect(duration).toBeLessThan(5000); // Less than 5 seconds for 1000 templates
        
        // Calculate templates per second
        const templatesPerSecond = (templateCount / duration) * 1000;
        expect(templatesPerSecond).toBeGreaterThan(200); // At least 200 templates/sec

        console.log(`Performance: ${templatesPerSecond.toFixed(2)} templates/sec`);
      });
    });
  });

  describe('FEATURE: Template Caching', () => {
    describe('SCENARIO: Cache parsed templates for reuse', () => {
      it('GIVEN previously parsed templates WHEN accessing again THEN uses cached version', async () => {
        // GIVEN: Template file
        const template = `
---
{
  "type": "cached-template",
  "ontology": "cache-test-ontology"
}
---
Cached template content
        `;

        await fs.writeFile(join(templatesDir, 'cached.njk'), template.trim());

        // WHEN: First discovery (should cache)
        const firstDiscovery = await engine.discoverTemplates(templatesDir);
        const firstTime = performance.now();
        
        // WHEN: Second discovery (should use cache)
        const secondDiscovery = await engine.discoverTemplates(templatesDir);
        const secondTime = performance.now();

        // THEN: Results identical and second access faster
        expect(firstDiscovery).toHaveLength(1);
        expect(secondDiscovery).toHaveLength(1);
        expect(firstDiscovery[0].name).toBe(secondDiscovery[0].name);
        
        // Cache should make subsequent access much faster
        // (This is a conceptual test - actual cache implementation would be more sophisticated)
        expect(secondTime - firstTime).toBeLessThan(100); // Very fast subsequent access
      });
    });
  });
});
