# Untology → Unjucks Pipeline

A production-ready integration that creates a unified pipeline from ontology data (RDF/OWL/Turtle) to generated artifacts through powerful templating, with enterprise-grade HIVE QUEEN orchestration.

## Features

🚀 **Unified Pipeline Architecture**
- Ontology loading (Turtle, N3, RDF-XML, JSON-LD)
- Graph querying with SPARQL-like syntax
- Advanced template rendering with Nunjucks
- Intelligent file system output management

⚡ **HIVE QUEEN Orchestration**
- **Queen**: Orchestrates the entire pipeline
- **Workers**: Parallel template rendering
- **Scouts**: Real-time change detection
- **Soldiers**: Stress testing and validation

🏢 **Enterprise Integration**
- CI/CD pipeline support (GitHub Actions, Jenkins)
- Multi-team collaboration workflows
- Governance and compliance automation
- Performance monitoring and optimization

## Quick Start

### Installation

```bash
npm install -g @citty-pro/untology-unjucks
```

### Basic Usage

```bash
# Initialize configuration
unjucks init --interactive

# Generate artifacts once
unjucks sync --config ./unjucks.config.yaml

# Watch for changes and auto-regenerate
unjucks watch --config ./unjucks.config.yaml

# Validate configuration and ontologies
unjucks validate --config ./unjucks.config.yaml --strict
```

## Configuration

Create `unjucks.config.yaml`:

```yaml
name: my-ontology-project

ontologies:
  - path: ./ontologies/domain-model.ttl
    format: turtle
    namespace: https://example.com/domain#

templates:
  - path: ./templates/**/*.njk
    output: "{{ template.name | replace('.njk', '.md') }}"

output:
  directory: ./generated
  clean: true

hiveQueen:
  enabled: true
  workers: 4
  parallelism: templates

watch:
  enabled: true
  debounce: 500
  ignore:
    - node_modules/**
    - .git/**

validation:
  strict: false
```

## Template Examples

### Class Documentation Template

```html
<!-- templates/class-docs.md.njk -->
# {{ class | label }}

{{ class | comment }}

## Properties

{% for property in class | properties %}
- **{{ property.property | localName }}**: {{ property.range | join(', ') | localName }}
{% endfor %}

## Hierarchy

{% for superClass in class | superClasses %}
- Extends: {{ superClass | label }}
{% endfor %}

## Instances

{% for instance in class | instances %}
- {{ instance | localName }}
{% endfor %}
```

### API Code Generation

```typescript
// templates/typescript/interfaces.ts.njk
{% for class in filter('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class') %}
export interface {{ class.subject | localName | pascalCase }} {
  {% for property in class.subject | properties %}
  {{ property.property | localName | camelCase }}: {{ property.range | join(' | ') | localName }};
  {% endfor %}
}

{% endfor %}
```

## Production Workflows

### 1. Software Architecture Documentation

```javascript
import { softwareArchitectureWorkflow } from '@citty-pro/untology-unjucks/examples';
import { runOneShotGeneration } from '@citty-pro/untology-unjucks';

await runOneShotGeneration('./config.yaml', softwareArchitectureWorkflow);
```

### 2. API Code Generation

```javascript
import { apiCodegenWorkflow } from '@citty-pro/untology-unjucks/examples';

const pipeline = createPipeline({
  enableHiveQueen: true,
  maxWorkers: 8,
});

const job = await pipeline.coordinator.executeJob(apiCodegenWorkflow);
console.log(`Generated ${job.metrics.filesGenerated} files`);
```

### 3. Real-time Development

```javascript
import { startWatchMode } from '@citty-pro/untology-unjucks';

const { stop } = await startWatchMode('./config.yaml', {
  hiveQueen: { workers: 2 },
  watch: { debounce: 300 },
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await stop();
  process.exit(0);
});
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Generate Documentation
on: 
  push:
    paths: ['**/*.ttl', 'templates/**/*']

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install -g @citty-pro/untology-unjucks
      - run: unjucks sync --config ./config.yaml --workers 4
      - run: git add generated/ && git commit -m "Update generated docs" && git push
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Generate') {
            steps {
                sh 'unjucks sync --config ./config.yaml --workers ${env.WORKERS ?: 4}'
                archiveArtifacts artifacts: 'generated/**/*'
            }
        }
    }
}
```

## Custom Filters

The template engine provides extensive filters for ontology processing:

```html
<!-- URI manipulation -->
{{ "http://example.org/Person" | localName }}          → Person
{{ "http://example.org/Person" | namespace }}          → http://example.org/
{{ uri | prefix }}                                     → ex:Person

<!-- String formatting -->
{{ "my-class-name" | camelCase }}                      → myClassName
{{ "my-class-name" | pascalCase }}                     → MyClassName
{{ "MyClassName" | snakeCase }}                        → my_class_name
{{ "MyClassName" | kebabCase }}                        → my-class-name

<!-- Ontology queries -->
{{ classUri | superClasses }}                          → [parent classes]
{{ classUri | properties }}                            → [property definitions]
{{ classUri | instances }}                             → [individual instances]
{{ uri | label }}                                      → "Human readable label"
{{ uri | comment }}                                    → "Description text"
```

## Global Functions

```html
<!-- SPARQL queries -->
{% set results = query('SELECT ?class WHERE { ?class a owl:Class }') %}

<!-- Triple filtering -->
{% set classes = filter('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class') %}

<!-- Namespace resolution -->
{{ ns('rdfs') }}label                                  → http://www.w3.org/2000/01/rdf-schema#label

<!-- Utilities -->
{{ now() }}                                           → 2024-01-01T12:00:00.000Z
{{ uuid() }}                                          → 550e8400-e29b-41d4-a716-446655440000
```

## Performance Optimization

### Caching Strategy

```javascript
// Automatic caching of ontology parsing
const pipeline = createPipeline({
  cacheDirectory: './.unjucks-cache',
  maxWorkers: 8,
});

// Cache hit/miss statistics
pipeline.coordinator.on('job:completed', (job) => {
  const stats = pipeline.cache.getStats();
  console.log(`Cache entries: ${stats.memoryEntries}, Size: ${stats.memorySize}`);
});
```

### Parallel Processing

```yaml
hiveQueen:
  enabled: true
  workers: 8                    # CPU cores * 2
  parallelism: both            # 'templates', 'ontologies', or 'both'
```

### Performance Monitoring

```javascript
import { PerformanceMonitor } from '@citty-pro/untology-unjucks';

const monitor = new PerformanceMonitor();

monitor.on('alert:performance', (alert) => {
  console.warn(`Slow operation: ${alert.metric.name} took ${alert.metric.duration}ms`);
});

monitor.on('alert:resource', (alert) => {
  console.warn(`Resource alert: ${alert.type} - ${alert.value}`);
});
```

## Enterprise Features

### Multi-Environment Deployment

```javascript
import { deployToEnvironment } from '@citty-pro/untology-unjucks/examples';

// Deploy with environment-specific settings
await deployToEnvironment('production'); // High parallelism, strict validation
await deployToEnvironment('staging');    // Medium parallelism, validation enabled  
await deployToEnvironment('development'); // Low parallelism, fast iteration
```

### Compliance Automation

```yaml
name: gdpr-compliance
ontologies:
  - path: ./compliance/gdpr-ontology.ttl
  - path: ./compliance/data-processing.n3

templates:
  - path: ./templates/compliance/privacy-policy.md.njk
    output: legal/privacy-policy.md
  - path: ./templates/compliance/data-mapping.csv.njk
    output: reports/data-processing-map.csv

validation:
  strict: true
  schema: ./schemas/gdpr-validation.json
```

### Multi-Team Collaboration

```yaml
# Team-specific configurations with namespace isolation
name: multi-team-architecture

ontologies:
  - path: ./teams/backend/services.ttl
    namespace: https://company.com/backend#
  - path: ./teams/frontend/components.ttl  
    namespace: https://company.com/frontend#
  - path: ./teams/data/models.ttl
    namespace: https://company.com/data#

templates:
  - path: ./templates/backend/**/*.njk
    output: docs/backend/{{ template.name | replace('.njk', '.md') }}
    filters: ['https://company.com/backend#']
    
  - path: ./templates/frontend/**/*.njk  
    output: docs/frontend/{{ template.name | replace('.njk', '.md') }}
    filters: ['https://company.com/frontend#']
```

## API Reference

### PipelineCoordinator

```typescript
class PipelineCoordinator {
  async executeJob(config: PipelineConfig): Promise<GenerationJob>
  async getJobStatus(jobId: string): Promise<GenerationJob | null>
  async cancelJob(jobId: string): Promise<boolean>
  async cleanup(): Promise<void>
}
```

### ConfigManager

```typescript
class ConfigManager {
  async loadConfig(path: string): Promise<PipelineConfig>
  async saveConfig(path: string, config: PipelineConfig): Promise<void>
  async generateDefaultConfig(): Promise<PipelineConfig>
  async mergeConfigs(base: PipelineConfig, overrides: Partial<PipelineConfig>): Promise<PipelineConfig>
}
```

### Factory Functions

```typescript
export function createPipeline(options?: PipelineOptions): PipelineFactory
export async function runOneShotGeneration(configPath: string, overrides?: Partial<PipelineConfig>): Promise<void>
export async function startWatchMode(configPath: string, overrides?: Partial<PipelineConfig>): Promise<{ stop: () => Promise<void> }>
```

## Troubleshooting

### Common Issues

**"Ontology parsing failed"**
- Verify file format matches configuration
- Check for syntax errors in Turtle/N3 files
- Ensure file permissions are readable

**"Template rendering errors"**
- Validate template syntax with `unjucks validate`
- Check for undefined variables in context
- Verify filter usage and availability

**"High memory usage"**  
- Reduce worker count in HIVE QUEEN configuration
- Enable ontology caching
- Process large ontologies in batches

### Debug Mode

```bash
DEBUG=unjucks:* unjucks sync --config ./config.yaml
```

### Performance Analysis

```bash
unjucks sync --config ./config.yaml 2>&1 | grep "Performance:"
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](./LICENSE) for details.

---

**Enterprise Support**: For enterprise deployments, custom integrations, and professional support, contact [support@citty-pro.com](mailto:support@citty-pro.com).