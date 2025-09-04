/**
 * Tests for Weaver Forge Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { 
  WeaverForge, 
  TemplateProcessor, 
  JQProcessor, 
  SemanticConventionFilters, 
  WeaverTemplateManager, 
  SemanticConventionValidator 
} from '../src/weaver';
import type { 
  SemanticConventionRegistry, 
  SemanticConventionGroup, 
  SemanticConventionAttribute,
  WeaverForgeConfig 
} from '../src/weaver';

describe('SemanticConventionFilters', () => {
  describe('string case conversions', () => {
    it('should convert to snake_case', () => {
      expect(SemanticConventionFilters.snakeCase('HttpMethod')).toBe('http_method');
      expect(SemanticConventionFilters.snakeCase('HTTPServer')).toBe('h_t_t_p_server');
      expect(SemanticConventionFilters.snakeCase('simpleWord')).toBe('simple_word');
    });

    it('should convert to camelCase', () => {
      expect(SemanticConventionFilters.camelCase('http_method')).toBe('httpMethod');
      expect(SemanticConventionFilters.camelCase('HTTP-Server')).toBe('httpServer');
      expect(SemanticConventionFilters.camelCase('simple word')).toBe('simpleWord');
    });

    it('should convert to PascalCase', () => {
      expect(SemanticConventionFilters.pascalCase('http_method')).toBe('HttpMethod');
      expect(SemanticConventionFilters.pascalCase('http-server')).toBe('HttpServer');
      expect(SemanticConventionFilters.pascalCase('simple word')).toBe('SimpleWord');
    });

    it('should convert to kebab-case', () => {
      expect(SemanticConventionFilters.kebabCase('HttpMethod')).toBe('http-method');
      expect(SemanticConventionFilters.kebabCase('HTTPServer')).toBe('h-t-t-p-server');
    });

    it('should convert to SCREAMING_SNAKE_CASE', () => {
      expect(SemanticConventionFilters.constantCase('HttpMethod')).toBe('HTTP_METHOD');
      expect(SemanticConventionFilters.constantCase('httpServer')).toBe('HTTP_SERVER');
    });
  });

  describe('type conversions', () => {
    it('should convert to TypeScript types', () => {
      const stringAttr = { id: 'test', type: 'string' as const, brief: 'test', requirement_level: 'required' as const };
      const numberAttr = { id: 'test', type: 'number' as const, brief: 'test', requirement_level: 'required' as const };
      const booleanAttr = { id: 'test', type: 'boolean' as const, brief: 'test', requirement_level: 'required' as const };
      
      expect(SemanticConventionFilters.toTypeScriptType(stringAttr)).toBe('string');
      expect(SemanticConventionFilters.toTypeScriptType(numberAttr)).toBe('number');
      expect(SemanticConventionFilters.toTypeScriptType(booleanAttr)).toBe('boolean');
    });

    it('should convert to Go types', () => {
      const stringAttr = { id: 'test', type: 'string' as const, brief: 'test', requirement_level: 'required' as const };
      const numberAttr = { id: 'test', type: 'number' as const, brief: 'test', requirement_level: 'required' as const };
      
      expect(SemanticConventionFilters.toGoType(stringAttr)).toBe('string');
      expect(SemanticConventionFilters.toGoType(numberAttr)).toBe('float64');
    });

    it('should convert to Rust types', () => {
      const stringAttr = { id: 'test', type: 'string' as const, brief: 'test', requirement_level: 'required' as const };
      const numberAttr = { id: 'test', type: 'number' as const, brief: 'test', requirement_level: 'required' as const };
      
      expect(SemanticConventionFilters.toRustType(stringAttr)).toBe('String');
      expect(SemanticConventionFilters.toRustType(numberAttr)).toBe('f64');
    });
  });

  describe('utility functions', () => {
    it('should generate documentation comments', () => {
      const docs = SemanticConventionFilters.toDocComment('Test attribute', 'Additional note', ['example1', 'example2']);
      expect(docs).toEqual([
        'Test attribute',
        '',
        'Additional note',
        '',
        'Examples:',
        '  - example1',
        '  - example2'
      ]);
    });

    it('should sort attributes by requirement level', () => {
      const attributes = [
        { id: 'opt', requirement_level: 'opt_in' as const, brief: 'test', type: 'string' as const },
        { id: 'req', requirement_level: 'required' as const, brief: 'test', type: 'string' as const },
        { id: 'rec', requirement_level: 'recommended' as const, brief: 'test', type: 'string' as const },
      ];
      
      const sorted = SemanticConventionFilters.sortAttributes(attributes);
      expect(sorted[0].id).toBe('req'); // required first
      expect(sorted[1].id).toBe('rec'); // recommended second
      expect(sorted[2].id).toBe('opt'); // opt_in last
    });

    it('should group attributes by namespace', () => {
      const attributes = [
        { id: 'http.method', namespace: 'http', brief: 'test', type: 'string' as const, requirement_level: 'required' as const },
        { id: 'http.url', namespace: 'http', brief: 'test', type: 'string' as const, requirement_level: 'required' as const },
        { id: 'db.name', namespace: 'db', brief: 'test', type: 'string' as const, requirement_level: 'required' as const },
      ];
      
      const grouped = SemanticConventionFilters.groupByNamespace(attributes);
      expect(Object.keys(grouped)).toEqual(['http', 'db']);
      expect(grouped.http).toHaveLength(2);
      expect(grouped.db).toHaveLength(1);
    });
  });
});

describe('JQProcessor', () => {
  let processor: JQProcessor;

  beforeEach(() => {
    processor = new JQProcessor();
  });

  it('should apply semconv_grouped_attributes filter', async () => {
    const data = [
      { id: 'http.method', prefix: 'http' },
      { id: 'http.url', prefix: 'http' },
      { id: 'db.name', prefix: 'db' },
    ];
    
    const result = await processor.applyFilter(data, 'semconv_grouped_attributes');
    expect(result).toHaveLength(2); // 2 groups: http, db
    expect(result[0].key).toBe('http');
    expect(result[0].value).toHaveLength(2);
  });

  it('should apply stable_attributes filter', async () => {
    const data = [
      { id: 'stable1', stability: 'stable' },
      { id: 'experimental1', stability: 'experimental' },
      { id: 'stable2' }, // no stability = stable
    ];
    
    const result = await processor.applyFilter(data, 'stable_attributes');
    expect(result).toHaveLength(2); // only stable attributes
    expect(result.map((r: any) => r.id)).toEqual(['stable1', 'stable2']);
  });

  it('should apply required_attributes filter', async () => {
    const data = [
      { id: 'req1', requirement_level: 'required' },
      { id: 'opt1', requirement_level: 'recommended' },
      { id: 'req2', requirement_level: 'required' },
    ];
    
    const result = await processor.applyFilter(data, 'required_attributes');
    expect(result).toHaveLength(2);
    expect(result.map((r: any) => r.id)).toEqual(['req1', 'req2']);
  });
});

describe('TemplateProcessor', () => {
  let processor: TemplateProcessor;
  let tempDir: string;

  beforeEach(async () => {
    const config: WeaverForgeConfig = {
      templates: [],
      whitespace_control: {
        trim_blocks: true,
        lstrip_blocks: true
      }
    };
    processor = new TemplateProcessor(config);
    tempDir = join(tmpdir(), `weaver-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rmdir(tempDir, { recursive: true });
    }
  });

  it('should render simple variable templates', async () => {
    const templateContent = 'Hello {{ name }}!';
    const templatePath = join(tempDir, 'test.j2');
    const outputPath = join(tempDir, 'output.txt');
    
    await writeFile(templatePath, templateContent);
    await processor.processTemplate(templatePath, { name: 'World' }, outputPath);
    
    const output = await readFile(outputPath, 'utf-8');
    expect(output).toBe('Hello World!');
  });

  it('should render loops', async () => {
    const templateContent = '{% for item in items %}{{ item.name }}\n{% endfor %}';
    const templatePath = join(tempDir, 'loop.j2');
    const outputPath = join(tempDir, 'loop_output.txt');
    
    await writeFile(templatePath, templateContent);
    await processor.processTemplate(templatePath, { 
      items: [{ name: 'item1' }, { name: 'item2' }] 
    }, outputPath);
    
    const output = await readFile(outputPath, 'utf-8');
    expect(output).toBe('item1\nitem2\n');
  });

  it('should apply custom filters', async () => {
    const templateContent = '{{ name | camelCase }}';
    const templatePath = join(tempDir, 'filter.j2');
    const outputPath = join(tempDir, 'filter_output.txt');
    
    await writeFile(templatePath, templateContent);
    await processor.processTemplate(templatePath, { name: 'http_method' }, outputPath);
    
    const output = await readFile(outputPath, 'utf-8');
    expect(output).toBe('httpMethod');
  });
});

describe('SemanticConventionValidator', () => {
  let validator: SemanticConventionValidator;
  let tempDir: string;

  beforeEach(async () => {
    validator = new SemanticConventionValidator();
    tempDir = join(tmpdir(), `weaver-validator-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rmdir(tempDir, { recursive: true });
    }
  });

  it('should validate valid semantic convention registry', async () => {
    const validRegistry = {
      groups: [{
        id: 'http.server',
        type: 'span',
        brief: 'HTTP server spans',
        attributes: [{
          id: 'http.method',
          type: 'string',
          brief: 'HTTP request method',
          requirement_level: 'required',
          examples: ['GET', 'POST']
        }]
      }],
      attributes: []
    };

    const yamlContent = `
groups:
  - id: http.server
    type: span
    brief: HTTP server spans
    attributes:
      - id: http.method
        type: string
        brief: HTTP request method
        requirement_level: required
        examples: [GET, POST]
attributes: []
`;

    await writeFile(join(tempDir, 'conventions.yaml'), yamlContent);
    
    const result = await validator.validate(tempDir);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.groups).toBe(1);
  });

  it('should detect validation errors', async () => {
    const invalidYaml = `
groups:
  - id: invalid.group
    # missing type and brief
    attributes:
      - id: invalid.attr
        # missing type, brief, requirement_level
attributes: []
`;

    await writeFile(join(tempDir, 'invalid.yaml'), invalidYaml);
    
    const result = await validator.validate(tempDir);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate with strict options', async () => {
    const yamlContent = `
groups:
  - id: test.group
    type: span
    brief: Test group
    attributes: []
attributes: []
`;

    await writeFile(join(tempDir, 'test.yaml'), yamlContent);
    
    const result = await validator.validate(tempDir, { strict: true });
    expect(result.warnings.length).toBeGreaterThan(0); // Should warn about empty attributes
  });
});

describe('WeaverTemplateManager', () => {
  let manager: WeaverTemplateManager;
  let tempDir: string;

  beforeEach(async () => {
    manager = new WeaverTemplateManager();
    tempDir = join(tmpdir(), `weaver-template-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rmdir(tempDir, { recursive: true });
    }
  });

  it('should create initial CLI configuration', async () => {
    await manager.createInitialConfig(tempDir, 'cli');
    
    expect(existsSync(join(tempDir, 'weaver.yaml'))).toBe(true);
    expect(existsSync(join(tempDir, 'templates'))).toBe(true);
    
    const config = await readFile(join(tempDir, 'weaver.yaml'), 'utf-8');
    expect(config).toContain('cli_command.j2');
  });

  it('should list available templates', async () => {
    const templatesDir = join(tempDir, 'templates');
    await mkdir(templatesDir, { recursive: true });
    
    const templateContent = `{# description: Test template #}
{# type: custom #}
Test template content`;
    
    await writeFile(join(templatesDir, 'test.j2'), templateContent);
    
    const templates = await manager.listTemplates(tempDir);
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('test');
    expect(templates[0].description).toBe('Test template');
    expect(templates[0].type).toBe('custom');
  });

  it('should create new templates', async () => {
    await manager.createTemplate(tempDir, 'my-template', 'cli');
    
    const templatePath = join(tempDir, 'templates', 'my-template.j2');
    expect(existsSync(templatePath)).toBe(true);
    
    const content = await readFile(templatePath, 'utf-8');
    expect(content).toContain('my-template CLI command template');
  });
});

describe('WeaverForge integration', () => {
  let tempDir: string;
  let registryDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `weaver-integration-test-${Date.now()}`);
    registryDir = join(tempDir, 'registry');
    await mkdir(registryDir, { recursive: true });
    await mkdir(join(registryDir, 'templates'), { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rmdir(tempDir, { recursive: true });
    }
  });

  it('should load semantic conventions from YAML files', async () => {
    const conventionYaml = `
groups:
  - id: http.server
    type: span
    brief: HTTP server spans
    attributes:
      - id: http.method
        type: string
        brief: HTTP request method
        requirement_level: required
        examples: [GET, POST]
      - id: http.url
        type: string
        brief: HTTP request URL
        requirement_level: required

attributes:
  - id: user.id
    type: string
    brief: User identifier
    requirement_level: recommended

metrics:
  - id: http.server.duration
    type: histogram
    brief: Duration of HTTP server requests
    instrument: histogram
    unit: ms
`;

    await writeFile(join(registryDir, 'http.yaml'), conventionYaml);

    const forge = new WeaverForge('', registryDir);
    await forge.initialize();
    
    const registry = await forge.loadSemanticConventions();
    
    expect(registry.groups).toHaveLength(1);
    expect(registry.groups[0].id).toBe('http.server');
    expect(registry.groups[0].attributes).toHaveLength(2);
    expect(registry.attributes).toHaveLength(1);
    expect(registry.metrics).toHaveLength(1);
  });

  it('should generate CLI commands', async () => {
    const conventionYaml = `
groups:
  - id: http.server
    type: span
    brief: HTTP server spans
    attributes:
      - id: http.method
        type: string
        brief: HTTP request method
        requirement_level: required
        examples: [GET, POST]
`;

    await writeFile(join(registryDir, 'http.yaml'), conventionYaml);

    const forge = new WeaverForge('', registryDir);
    await forge.initialize();
    
    const outputDir = join(tempDir, 'generated');
    await forge.generateCLICommands(outputDir);
    
    expect(existsSync(join(outputDir, 'http-server.ts'))).toBe(true);
    
    const generatedCommand = await readFile(join(outputDir, 'http-server.ts'), 'utf-8');
    expect(generatedCommand).toContain('httpServerCommand');
    expect(generatedCommand).toContain('defineCommand');
    expect(generatedCommand).toContain('httpMethod');
  });

  it('should generate OpenTelemetry instrumentation', async () => {
    const conventionYaml = `
groups:
  - id: http.server
    type: span
    brief: HTTP server spans
    attributes:
      - id: http.method
        type: string
        brief: HTTP request method
        requirement_level: required

attributes:
  - id: http.method
    type: string
    brief: HTTP request method
    requirement_level: required
`;

    await writeFile(join(registryDir, 'http.yaml'), conventionYaml);

    const forge = new WeaverForge('', registryDir);
    await forge.initialize();
    
    const outputDir = join(tempDir, 'generated');
    await forge.generateOpenTelemetryInstrumentation(outputDir);
    
    expect(existsSync(join(outputDir, 'otel-instrumentation.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'otel-attributes.ts'))).toBe(true);
    
    const instrumentation = await readFile(join(outputDir, 'otel-instrumentation.ts'), 'utf-8');
    expect(instrumentation).toContain('SemanticConventionInstrumentation');
    expect(instrumentation).toContain('httpServer');
    
    const attributes = await readFile(join(outputDir, 'otel-attributes.ts'), 'utf-8');
    expect(attributes).toContain('SEMANTIC_ATTRIBUTES');
    expect(attributes).toContain('HTTP_METHOD');
  });
});