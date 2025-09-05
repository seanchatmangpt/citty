import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { PipelineCoordinator } from '../../src/pipeline/coordinator.js';
import { ConfigManager } from '../../src/config/config-manager.js';
import { createPipeline } from '../../src/factory.js';
import { PipelineConfig } from '../../src/types.js';

describe('Untology → Unjucks Pipeline Integration', () => {
  let tempDir: string;
  let coordinator: PipelineCoordinator;
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(process.cwd(), 'test-temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize services
    const pipeline = createPipeline();
    coordinator = pipeline.coordinator;
    configManager = pipeline.configManager;
  });

  afterEach(async () => {
    // Clean up
    await coordinator.cleanup();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Pipeline Execution', () => {
    it('should execute a simple ontology → template pipeline', async () => {
      // Create test ontology
      const ontologyContent = `
@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Person a owl:Class ;
    rdfs:label "Person" ;
    rdfs:comment "A human being" .

ex:name a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range <http://www.w3.org/2001/XMLSchema#string> .

ex:john a ex:Person ;
    ex:name "John Doe" .
`;

      await fs.writeFile(join(tempDir, 'test.ttl'), ontologyContent);

      // Create test template
      const templateContent = `# Generated Documentation

{% for triple in ontology.triples %}
{% if triple.predicate == "http://www.w3.org/2000/01/rdf-schema#label" %}
- {{ triple.subject | localName }}: {{ triple.object }}
{% endif %}
{% endfor %}

Total triples: {{ ontology.triples | length }}
`;

      await fs.mkdir(join(tempDir, 'templates'), { recursive: true });
      await fs.writeFile(join(tempDir, 'templates', 'docs.md.njk'), templateContent);

      // Create configuration
      const config: PipelineConfig = {
        name: 'test-pipeline',
        ontologies: [{
          path: join(tempDir, 'test.ttl'),
          format: 'turtle',
        }],
        templates: [{
          path: join(tempDir, 'templates', 'docs.md.njk'),
          output: 'documentation.md',
        }],
        output: {
          directory: join(tempDir, 'output'),
          clean: true,
        },
        hiveQueen: {
          enabled: false, // Disable for simple test
        },
      };

      // Execute pipeline
      const job = await coordinator.executeJob(config);

      // Verify job completed successfully
      expect(job.status).toBe('completed');
      expect(job.metrics.ontologiesProcessed).toBe(1);
      expect(job.metrics.templatesRendered).toBe(1);
      expect(job.metrics.filesGenerated).toBe(1);
      expect(job.metrics.errors).toHaveLength(0);

      // Verify output file exists and has expected content
      const outputPath = join(tempDir, 'output', 'documentation.md');
      const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);

      const outputContent = await fs.readFile(outputPath, 'utf-8');
      expect(outputContent).toContain('Person: Person');
      expect(outputContent).toContain('Total triples:');
    });

    it('should handle multiple ontologies and templates', async () => {
      // Create multiple ontology files
      const ontology1 = `
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Animal a owl:Class .
ex:Dog a owl:Class ;
    <http://www.w3.org/2000/01/rdf-schema#subClassOf> ex:Animal .
`;

      const ontology2 = `
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Plant a owl:Class .
ex:Tree a owl:Class ;
    <http://www.w3.org/2000/01/rdf-schema#subClassOf> ex:Plant .
`;

      await fs.writeFile(join(tempDir, 'animals.ttl'), ontology1);
      await fs.writeFile(join(tempDir, 'plants.ttl'), ontology2);

      // Create multiple templates
      const classTemplate = `# Classes
{% for triple in ontology.triples %}
{% if triple.predicate == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" and triple.object == "http://www.w3.org/2002/07/owl#Class" %}
- {{ triple.subject | localName }}
{% endif %}
{% endfor %}`;

      const hierarchyTemplate = `# Class Hierarchy
{% for triple in ontology.triples %}
{% if triple.predicate == "http://www.w3.org/2000/01/rdf-schema#subClassOf" %}
{{ triple.subject | localName }} → {{ triple.object | localName }}
{% endif %}
{% endfor %}`;

      await fs.mkdir(join(tempDir, 'templates'), { recursive: true });
      await fs.writeFile(join(tempDir, 'templates', 'classes.md.njk'), classTemplate);
      await fs.writeFile(join(tempDir, 'templates', 'hierarchy.md.njk'), hierarchyTemplate);

      const config: PipelineConfig = {
        name: 'multi-test-pipeline',
        ontologies: [
          { path: join(tempDir, 'animals.ttl'), format: 'turtle' },
          { path: join(tempDir, 'plants.ttl'), format: 'turtle' },
        ],
        templates: [
          {
            path: join(tempDir, 'templates', 'classes.md.njk'),
            output: 'classes.md',
          },
          {
            path: join(tempDir, 'templates', 'hierarchy.md.njk'),
            output: 'hierarchy.md',
          },
        ],
        output: {
          directory: join(tempDir, 'output'),
          clean: true,
        },
        hiveQueen: { enabled: false },
      };

      const job = await coordinator.executeJob(config);

      expect(job.status).toBe('completed');
      expect(job.metrics.ontologiesProcessed).toBe(2);
      expect(job.metrics.templatesRendered).toBe(2);
      expect(job.metrics.filesGenerated).toBe(2);

      // Verify both output files
      const classesContent = await fs.readFile(join(tempDir, 'output', 'classes.md'), 'utf-8');
      const hierarchyContent = await fs.readFile(join(tempDir, 'output', 'hierarchy.md'), 'utf-8');

      expect(classesContent).toContain('Animal');
      expect(classesContent).toContain('Dog');
      expect(classesContent).toContain('Plant');
      expect(classesContent).toContain('Tree');

      expect(hierarchyContent).toContain('Dog → Animal');
      expect(hierarchyContent).toContain('Tree → Plant');
    });
  });

  describe('HIVE QUEEN Orchestration', () => {
    it('should execute pipeline with parallel workers', async () => {
      // Create test data
      const ontologyContent = `
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Class1 a owl:Class .
ex:Class2 a owl:Class .
ex:Class3 a owl:Class .
`;

      await fs.writeFile(join(tempDir, 'test.ttl'), ontologyContent);

      // Create multiple templates to test parallelism
      const templates = ['template1.njk', 'template2.njk', 'template3.njk'];
      await fs.mkdir(join(tempDir, 'templates'), { recursive: true });

      for (let i = 0; i < templates.length; i++) {
        const templateContent = `Template ${i + 1}:
{% for triple in ontology.triples %}
{{ triple.subject | localName }}
{% endfor %}`;
        await fs.writeFile(join(tempDir, 'templates', templates[i]), templateContent);
      }

      const config: PipelineConfig = {
        name: 'parallel-test-pipeline',
        ontologies: [{
          path: join(tempDir, 'test.ttl'),
          format: 'turtle',
        }],
        templates: templates.map((template, i) => ({
          path: join(tempDir, 'templates', template),
          output: `output${i + 1}.txt`,
        })),
        output: {
          directory: join(tempDir, 'output'),
          clean: true,
        },
        hiveQueen: {
          enabled: true,
          workers: 3,
          parallelism: 'templates',
        },
      };

      const job = await coordinator.executeJob(config);

      expect(job.status).toBe('completed');
      expect(job.metrics.templatesRendered).toBe(3);
      expect(job.metrics.filesGenerated).toBe(3);

      // Verify all outputs
      for (let i = 1; i <= 3; i++) {
        const outputContent = await fs.readFile(join(tempDir, 'output', `output${i}.txt`), 'utf-8');
        expect(outputContent).toContain(`Template ${i}:`);
        expect(outputContent).toContain('Class1');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ontology files gracefully', async () => {
      // Create invalid ontology
      await fs.writeFile(join(tempDir, 'invalid.ttl'), 'This is not valid Turtle syntax');

      const config: PipelineConfig = {
        name: 'error-test-pipeline',
        ontologies: [{
          path: join(tempDir, 'invalid.ttl'),
          format: 'turtle',
        }],
        templates: [{
          path: join(tempDir, 'template.njk'),
          output: 'output.txt',
        }],
        output: {
          directory: join(tempDir, 'output'),
        },
        hiveQueen: { enabled: false },
      };

      await expect(coordinator.executeJob(config)).rejects.toThrow();
    });

    it('should handle missing template files gracefully', async () => {
      const ontologyContent = `
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
ex:Test a owl:Class .
`;

      await fs.writeFile(join(tempDir, 'test.ttl'), ontologyContent);

      const config: PipelineConfig = {
        name: 'missing-template-pipeline',
        ontologies: [{
          path: join(tempDir, 'test.ttl'),
          format: 'turtle',
        }],
        templates: [{
          path: join(tempDir, 'nonexistent.njk'), // This file doesn't exist
          output: 'output.txt',
        }],
        output: {
          directory: join(tempDir, 'output'),
        },
        hiveQueen: { enabled: false },
      };

      await expect(coordinator.executeJob(config)).rejects.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should load and validate YAML configuration', async () => {
      const configContent = `
name: yaml-test-pipeline
ontologies:
  - path: ./test.ttl
    format: turtle
templates:
  - path: ./templates/*.njk
    output: "{{ template.name }}.txt"
output:
  directory: ./generated
hiveQueen:
  enabled: true
  workers: 4
`;

      const configPath = join(tempDir, 'unjucks.config.yaml');
      await fs.writeFile(configPath, configContent);

      const config = await configManager.loadConfig(configPath);

      expect(config.name).toBe('yaml-test-pipeline');
      expect(config.ontologies).toHaveLength(1);
      expect(config.templates).toHaveLength(1);
      expect(config.hiveQueen?.enabled).toBe(true);
      expect(config.hiveQueen?.workers).toBe(4);
    });

    it('should handle configuration validation errors', async () => {
      const invalidConfigContent = `
name: 123  # Should be string
ontologies: "invalid"  # Should be array
`;

      const configPath = join(tempDir, 'invalid.config.yaml');
      await fs.writeFile(configPath, invalidConfigContent);

      await expect(configManager.loadConfig(configPath)).rejects.toThrow();
    });
  });

  describe('Template Features', () => {
    it('should support custom filters and functions', async () => {
      const ontologyContent = `
@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:MySpecialClass a owl:Class ;
    rdfs:label "My Special Class" .
`;

      await fs.writeFile(join(tempDir, 'test.ttl'), ontologyContent);

      const templateContent = `
URI: {{ 'http://example.org/MySpecialClass' | localName }}
Namespace: {{ 'http://example.org/MySpecialClass' | namespace }}
CamelCase: {{ 'my-special-class' | camelCase }}
PascalCase: {{ 'my-special-class' | pascalCase }}
SnakeCase: {{ 'MySpecialClass' | snakeCase }}
KebabCase: {{ 'MySpecialClass' | kebabCase }}
`;

      await fs.mkdir(join(tempDir, 'templates'), { recursive: true });
      await fs.writeFile(join(tempDir, 'templates', 'filters.njk'), templateContent);

      const config: PipelineConfig = {
        name: 'filters-test-pipeline',
        ontologies: [{
          path: join(tempDir, 'test.ttl'),
          format: 'turtle',
        }],
        templates: [{
          path: join(tempDir, 'templates', 'filters.njk'),
          output: 'filtered.txt',
        }],
        output: {
          directory: join(tempDir, 'output'),
        },
        hiveQueen: { enabled: false },
      };

      const job = await coordinator.executeJob(config);
      expect(job.status).toBe('completed');

      const output = await fs.readFile(join(tempDir, 'output', 'filtered.txt'), 'utf-8');
      expect(output).toContain('URI: MySpecialClass');
      expect(output).toContain('Namespace: http://example.org/');
      expect(output).toContain('CamelCase: mySpecialClass');
      expect(output).toContain('PascalCase: MySpecialClass');
      expect(output).toContain('SnakeCase: my_special_class');
      expect(output).toContain('KebabCase: my-special-class');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache ontology parsing results', async () => {
      const ontologyContent = `
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
ex:CachedClass a owl:Class .
`;

      await fs.writeFile(join(tempDir, 'cached.ttl'), ontologyContent);

      const templateContent = 'Classes: {{ ontology.triples | length }}';
      await fs.mkdir(join(tempDir, 'templates'), { recursive: true });
      await fs.writeFile(join(tempDir, 'templates', 'simple.njk'), templateContent);

      const config: PipelineConfig = {
        name: 'caching-test-pipeline',
        ontologies: [{
          path: join(tempDir, 'cached.ttl'),
          format: 'turtle',
        }],
        templates: [{
          path: join(tempDir, 'templates', 'simple.njk'),
          output: 'cached.txt',
        }],
        output: {
          directory: join(tempDir, 'output'),
        },
        hiveQueen: { enabled: false },
      };

      // First execution
      const job1 = await coordinator.executeJob(config);
      expect(job1.status).toBe('completed');

      // Second execution should be faster due to caching
      const startTime = Date.now();
      const job2 = await coordinator.executeJob(config);
      const duration = Date.now() - startTime;

      expect(job2.status).toBe('completed');
      expect(duration).toBeLessThan(5000); // Should be reasonably fast
    });
  });
});