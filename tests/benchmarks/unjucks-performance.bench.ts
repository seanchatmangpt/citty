/**
 * Performance Benchmarks for Unjucks Template Engine
 * Tests rendering speed, memory usage, and concurrency performance
 */

import { describe, bench, beforeEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { UnjucksRenderer } from '../../src/weaver/unjucks-renderer';
import { OntologyParser } from '../../src/weaver/ontology-parser';
import { UnjucksEngine } from '../../src/weaver/unjucks-engine';
import type { RenderContext, OntologyModel } from '../../src/weaver/types';

// Test data generators
function generateLargeOntology(commandCount: number): string {
  const parts = [
    '@prefix cmd: <http://example.org/commands#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .'
  ];
  
  for (let i = 0; i < commandCount; i++) {
    parts.push(`
cmd:Command${i} a cmd:Command ;
    rdfs:label "Command ${i}" ;
    cmd:description "Auto-generated command ${i}" ;
    cmd:category "${i % 2 === 0 ? 'development' : 'deployment'}" ;
    cmd:hasArgument cmd:arg${i}a, cmd:arg${i}b, cmd:arg${i}c .`);
    
    parts.push(`
cmd:arg${i}a a cmd:Argument ;
    rdfs:label "Argument ${i}A" ;
    cmd:type "string" ;
    cmd:required true ;
    cmd:description "String argument for command ${i}" .`);
    
    parts.push(`
cmd:arg${i}b a cmd:Argument ;
    rdfs:label "Argument ${i}B" ;
    cmd:type "number" ;
    cmd:required false ;
    cmd:default ${i * 10} ;
    cmd:description "Numeric argument for command ${i}" .`);
    
    parts.push(`
cmd:arg${i}c a cmd:Argument ;
    rdfs:label "Argument ${i}C" ;
    cmd:type "boolean" ;
    cmd:required false ;
    cmd:default ${i % 2 === 0 ? 'true' : 'false'} ;
    cmd:description "Boolean argument for command ${i}" .`);
  }
  
  return parts.join('\n');
}

function generateComplexTemplate(): string {
  return `
/**
 * Complex Template with Multiple Features
 * Generated for: {{ project.name }}
 */

{# Import statements #}
{% for category in commands | map('category') | unique %}
import { {{ category | camelCase }}Commands } from './categories/{{ category | kebabCase }}';
{% endfor %}

{# Type definitions #}
export interface ProjectCommands {
  {% for command in commands %}
  {{ command.name | camelCase }}: {
    args: {
      {% for arg in command.arguments %}
      {{ arg.name | camelCase }}{% if not arg.required %}?{% endif %}: {{ arg.type | toTypeScriptType }};
      {% endfor %}
    };
    result: {
      success: boolean;
      data?: any;
      error?: string;
    };
  };
  {% endfor %}
}

{# Command implementations #}
{% for command in commands %}
export const {{ command.name | camelCase }}Command = {
  meta: {
    name: '{{ command.name | kebabCase }}',
    description: '{{ command.description }}',
    category: '{{ command.category }}',
    version: '1.0.0'
  },
  args: {
    {% for arg in command.arguments %}
    {{ arg.name | camelCase }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.description }}',
      {% if arg.required %}required: true,{% endif %}
      {% if arg.default is defined %}default: {{ arg.default | tojson }},{% endif %}
      {% if arg.enum %}enum: {{ arg.enum | tojson }},{% endif %}
    },
    {% endfor %}
  },
  async execute(args: any) {
    // Command implementation for {{ command.name }}
    console.log('Executing {{ command.name }} with args:', args);
    
    {% if command.category == 'development' %}
    // Development command logic
    const result = await developmentLogic(args);
    {% elif command.category == 'deployment' %}
    // Deployment command logic
    const result = await deploymentLogic(args);
    {% else %}
    // Generic command logic
    const result = await genericLogic(args);
    {% endif %}
    
    return {
      success: true,
      data: result,
      message: '{{ command.name }} completed successfully'
    };
  }
};

{% endfor %}

{# Utility functions #}
function developmentLogic(args: any) {
  // Simulate development work
  return new Promise(resolve => {
    setTimeout(() => resolve({ status: 'development complete' }), 100);
  });
}

function deploymentLogic(args: any) {
  // Simulate deployment work
  return new Promise(resolve => {
    setTimeout(() => resolve({ status: 'deployment complete' }), 200);
  });
}

function genericLogic(args: any) {
  // Simulate generic work
  return new Promise(resolve => {
    setTimeout(() => resolve({ status: 'operation complete' }), 50);
  });
}

{# Export everything #}
export const allCommands = {
  {% for command in commands %}
  {{ command.name | camelCase }}: {{ command.name | camelCase }}Command,
  {% endfor %}
};

export default allCommands;
`;
}

function generateLargeContext(commandCount: number): RenderContext {
  const commands = [];
  
  for (let i = 0; i < commandCount; i++) {
    commands.push({
      id: `cmd:Command${i}`,
      name: `Command${i}`,
      label: `Command ${i}`,
      description: `Auto-generated command ${i} for performance testing`,
      category: i % 2 === 0 ? 'development' : 'deployment',
      arguments: [
        {
          name: `arg${i}a`,
          label: `Argument ${i}A`,
          description: `String argument for command ${i}`,
          type: 'string',
          required: true
        },
        {
          name: `arg${i}b`,
          label: `Argument ${i}B`,
          description: `Numeric argument for command ${i}`,
          type: 'number',
          required: false,
          default: i * 10
        },
        {
          name: `arg${i}c`,
          label: `Argument ${i}C`,
          description: `Boolean argument for command ${i}`,
          type: 'boolean',
          required: false,
          default: i % 2 === 0
        }
      ]
    });
  }
  
  return {
    project: {
      name: `benchmark-cli-${commandCount}`,
      version: '1.0.0',
      description: `CLI with ${commandCount} commands for benchmarking`
    },
    commands,
    categories: ['development', 'deployment']
  };
}

describe('Unjucks Performance Benchmarks', () => {
  let renderer: UnjucksRenderer;
  let parser: OntologyParser;
  let engine: UnjucksEngine;
  let tempDir: string;

  beforeEach(async () => {
    renderer = new UnjucksRenderer();
    parser = new OntologyParser();
    engine = new UnjucksEngine();
    tempDir = join(tmpdir(), `unjucks-bench-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  describe('Template Rendering Speed', () => {
    bench('render small template (1 command)', async () => {
      const template = 'export const {{ command.name | camelCase }}Command = "{{ command.description }}";';
      const context: RenderContext = {
        command: {
          name: 'TestCommand',
          description: 'Test command for benchmarking'
        }
      };
      
      await renderer.render(template, context);
    });

    bench('render medium template (10 commands)', async () => {
      const template = generateComplexTemplate();
      const context = generateLargeContext(10);
      
      await renderer.render(template, context);
    });

    bench('render large template (100 commands)', async () => {
      const template = generateComplexTemplate();
      const context = generateLargeContext(100);
      
      await renderer.render(template, context);
    });

    bench('render extra large template (1000 commands)', async () => {
      const template = generateComplexTemplate();
      const context = generateLargeContext(1000);
      
      await renderer.render(template, context);
    });
  });

  describe('Filter Performance', () => {
    const testString = 'ThisIsAVeryLongStringForFilterBenchmarking_WithUnderscoresAndCamelCase';
    const testArray = Array.from({ length: 1000 }, (_, i) => `item_${i}_for_testing`);
    
    bench('camelCase filter on long string', () => {
      const template = '{{ testString | camelCase }}';
      renderer.render(template, { testString });
    });

    bench('kebabCase filter on long string', () => {
      const template = '{{ testString | kebabCase }}';
      renderer.render(template, { testString });
    });

    bench('constantCase filter on long string', () => {
      const template = '{{ testString | constantCase }}';
      renderer.render(template, { testString });
    });

    bench('multiple chained filters', () => {
      const template = '{{ testString | snakeCase | upper | reverse }}';
      renderer.render(template, { testString });
    });

    bench('array processing with map filter', () => {
      const template = '{{ testArray | map("camelCase") | join(", ") }}';
      renderer.render(template, { testArray });
    });
  });

  describe('Loop Performance', () => {
    bench('simple loop (100 items)', async () => {
      const template = '{% for item in items %}{{ item }}\n{% endfor %}';
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      
      await renderer.render(template, { items });
    });

    bench('nested loops (10x10)', async () => {
      const template = `
{% for category in categories %}
  {{ category.name }}:
  {% for item in category.items %}
    - {{ item.name }}
  {% endfor %}
{% endfor %}
`;
      
      const categories = Array.from({ length: 10 }, (_, i) => ({
        name: `Category ${i}`,
        items: Array.from({ length: 10 }, (_, j) => ({ name: `Item ${j}` }))
      }));
      
      await renderer.render(template, { categories });
    });

    bench('complex loop with conditionals (1000 items)', async () => {
      const template = `
{% for command in commands %}
  {% if command.category == 'development' %}
    export const {{ command.name | camelCase }} = {
      name: '{{ command.name }}',
      {% if command.arguments %}
      args: [
        {% for arg in command.arguments %}
        { name: '{{ arg.name }}', type: '{{ arg.type }}' },
        {% endfor %}
      ],
      {% endif %}
    };
  {% endif %}
{% endfor %}
`;
      
      const context = generateLargeContext(1000);
      await renderer.render(template, context);
    });
  });

  describe('Ontology Parsing Performance', () => {
    bench('parse small ontology (10 commands)', async () => {
      const ontology = generateLargeOntology(10);
      const filePath = join(tempDir, 'small.ttl');
      await writeFile(filePath, ontology);
      
      await parser.parseFile(filePath);
    });

    bench('parse medium ontology (100 commands)', async () => {
      const ontology = generateLargeOntology(100);
      const filePath = join(tempDir, 'medium.ttl');
      await writeFile(filePath, ontology);
      
      await parser.parseFile(filePath);
    });

    bench('parse large ontology (1000 commands)', async () => {
      const ontology = generateLargeOntology(1000);
      const filePath = join(tempDir, 'large.ttl');
      await writeFile(filePath, ontology);
      
      await parser.parseFile(filePath);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    bench('memory usage - template caching', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Render the same template multiple times to test caching
      const template = generateComplexTemplate();
      const context = generateLargeContext(50);
      
      for (let i = 0; i < 100; i++) {
        await renderer.render(template, context);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = finalMemory - initialMemory;
      
      // Memory usage should be reasonable (less than 50MB increase)
      if (memoryDiff > 50 * 1024 * 1024) {
        console.warn(`High memory usage detected: ${Math.round(memoryDiff / 1024 / 1024)}MB`);
      }
    });

    bench('memory usage - garbage collection', async () => {
      const template = '{{ items | map("name") | join(", ") }}';
      
      // Generate and render many contexts to test GC
      for (let i = 0; i < 1000; i++) {
        const context = {
          items: Array.from({ length: 100 }, (_, j) => ({ name: `item-${i}-${j}` }))
        };
        await renderer.render(template, context);
        
        // Trigger GC every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
    });
  });

  describe('Concurrency Benchmarks', () => {
    bench('concurrent template rendering (10 parallel)', async () => {
      const template = generateComplexTemplate();
      const context = generateLargeContext(100);
      
      const promises = Array.from({ length: 10 }, () =>
        renderer.render(template, context)
      );
      
      await Promise.all(promises);
    });

    bench('concurrent template rendering (50 parallel)', async () => {
      const template = generateComplexTemplate();
      const context = generateLargeContext(50);
      
      const promises = Array.from({ length: 50 }, () =>
        renderer.render(template, context)
      );
      
      await Promise.all(promises);
    });

    bench('concurrent ontology parsing (5 parallel)', async () => {
      const ontologyFiles = [];
      
      // Create multiple ontology files
      for (let i = 0; i < 5; i++) {
        const ontology = generateLargeOntology(100);
        const filePath = join(tempDir, `concurrent-${i}.ttl`);
        await writeFile(filePath, ontology);
        ontologyFiles.push(filePath);
      }
      
      // Parse them concurrently
      const promises = ontologyFiles.map(file => parser.parseFile(file));
      await Promise.all(promises);
    });
  });

  describe('Real-world Scenario Benchmarks', () => {
    bench('complete CLI generation (50 commands)', async () => {
      const ontology = generateLargeOntology(50);
      const template = generateComplexTemplate();
      
      const ontologyFile = join(tempDir, 'scenario.ttl');
      const templateFile = join(tempDir, 'scenario-template.njk');
      const outputFile = join(tempDir, 'scenario-output.ts');
      
      await writeFile(ontologyFile, ontology);
      await writeFile(templateFile, template);
      
      // Parse ontology
      const ontologyModel = await parser.parseFile(ontologyFile);
      
      // Convert to context
      const context = {
        project: { name: 'scenario-cli', version: '1.0.0', description: 'Scenario CLI' },
        commands: ontologyModel.entities.filter(e => e.type === 'cmd:Command'),
        categories: ['development', 'deployment']
      };
      
      // Render template
      const templateContent = await readFile(templateFile, 'utf-8');
      const rendered = await renderer.render(templateContent, context);
      
      // Write output
      await writeFile(outputFile, rendered);
    });

    bench('batch processing (10 files)', async () => {
      const template = generateComplexTemplate();
      const contexts = Array.from({ length: 10 }, (_, i) => 
        generateLargeContext(20)
      );
      
      // Process all files
      const results = await Promise.all(
        contexts.map(async (context, i) => {
          const outputFile = join(tempDir, `batch-${i}.ts`);
          const rendered = await renderer.render(template, context);
          await writeFile(outputFile, rendered);
          return outputFile;
        })
      );
      
      // Verify all files were created
      if (results.length !== 10) {
        throw new Error('Not all batch files were processed');
      }
    });

    bench('template inheritance chain (5 levels)', async () => {
      const baseTemplate = `
Base template content
{% block content %}Default content{% endblock %}
{% block footer %}Default footer{% endblock %}
`;
      
      const level1Template = `
{% extends "base.njk" %}
{% block content %}
Level 1 content
{{ super() }}
{% endblock %}
`;
      
      const level2Template = `
{% extends "level1.njk" %}
{% block content %}
Level 2 content
{{ super() }}
{% endblock %}
`;
      
      const level3Template = `
{% extends "level2.njk" %}
{% block content %}
Level 3 content
{{ super() }}
{% endblock %}
`;
      
      const level4Template = `
{% extends "level3.njk" %}
{% block content %}
Level 4 content
{{ super() }}
{% endblock %}
`;
      
      const level5Template = `
{% extends "level4.njk" %}
{% block content %}
Level 5 content
{{ super() }}
{% endblock %}
`;
      
      // Write template files
      await writeFile(join(tempDir, 'base.njk'), baseTemplate);
      await writeFile(join(tempDir, 'level1.njk'), level1Template);
      await writeFile(join(tempDir, 'level2.njk'), level2Template);
      await writeFile(join(tempDir, 'level3.njk'), level3Template);
      await writeFile(join(tempDir, 'level4.njk'), level4Template);
      await writeFile(join(tempDir, 'level5.njk'), level5Template);
      
      const rendererWithPaths = new UnjucksRenderer({ templatePaths: [tempDir] });
      await rendererWithPaths.renderFile('level5.njk', {});
    });
  });

  describe('Edge Case Performance', () => {
    bench('deeply nested object access (10 levels)', async () => {
      const template = '{{ deep.level1.level2.level3.level4.level5.level6.level7.level8.level9.value }}';
      const context = {
        deep: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    level6: {
                      level7: {
                        level8: {
                          level9: {
                            value: 'deeply nested value'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      await renderer.render(template, context);
    });

    bench('large string concatenation', async () => {
      const template = `
{% set result = "" %}
{% for i in range(1000) %}
  {% set result = result + "Item " + i + ", " %}
{% endfor %}
{{ result | length }}
`;
      
      await renderer.render(template, {});
    });

    bench('complex conditional chains', async () => {
      const template = `
{% for item in items %}
  {% if item.type == 'A' %}
    {% if item.subtype == 'A1' %}
      {% if item.priority == 'high' %}
        High priority A1: {{ item.name }}
      {% elif item.priority == 'medium' %}
        Medium priority A1: {{ item.name }}
      {% else %}
        Low priority A1: {{ item.name }}
      {% endif %}
    {% elif item.subtype == 'A2' %}
      {% if item.priority == 'high' %}
        High priority A2: {{ item.name }}
      {% else %}
        Other priority A2: {{ item.name }}
      {% endif %}
    {% endif %}
  {% elif item.type == 'B' %}
    Type B item: {{ item.name }}
  {% else %}
    Unknown type: {{ item.name }}
  {% endif %}
{% endfor %}
`;
      
      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `item-${i}`,
        type: ['A', 'B', 'C'][i % 3],
        subtype: ['A1', 'A2'][i % 2],
        priority: ['high', 'medium', 'low'][i % 3]
      }));
      
      await renderer.render(template, { items });
    });
  });

  // Cleanup after benchmarks
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
});

// Helper function to measure memory usage
function measureMemory<T>(fn: () => T): { result: T; memoryUsed: number } {
  const initialMemory = process.memoryUsage().heapUsed;
  const result = fn();
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryUsed = finalMemory - initialMemory;
  
  return { result, memoryUsed };
}

// Helper function to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  return { result, duration };
}
