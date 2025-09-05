/**
 * Unit Tests for Ontology Integration
 * Tests RDF/Turtle parsing and semantic reasoning capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OntologyParser } from '../../src/weaver/ontology-parser';
import { SemanticReasoner } from '../../src/weaver/semantic-reasoner';
import { UnjucksOntologyIntegration } from '../../src/weaver/ontology-integration';
import type { OntologyModel, SemanticTriple, CommandOntology } from '../../src/weaver/types';

describe('OntologyParser', () => {
  let parser: OntologyParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new OntologyParser();
    tempDir = join(tmpdir(), `ontology-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Turtle/TTL Parsing', () => {
    it('should parse basic Turtle syntax', async () => {
      const turtleContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:BuildCommand a cmd:Command ;
    rdfs:label "Build Command" ;
    cmd:hasArgument cmd:target, cmd:verbose .

cmd:target a cmd:Argument ;
    rdfs:label "Build target" ;
    cmd:type "string" ;
    cmd:required true .

cmd:verbose a cmd:Argument ;
    rdfs:label "Verbose output" ;
    cmd:type "boolean" ;
    cmd:required false .
`;

      const filePath = join(tempDir, 'commands.ttl');
      await writeFile(filePath, turtleContent);
      
      const ontology = await parser.parseFile(filePath);
      
      expect(ontology.entities).toHaveLength(3); // BuildCommand, target, verbose
      expect(ontology.triples.length).toBeGreaterThan(0);
      
      const buildCommand = ontology.entities.find(e => e.id === 'cmd:BuildCommand');
      expect(buildCommand).toBeDefined();
      expect(buildCommand?.type).toBe('cmd:Command');
      expect(buildCommand?.properties['rdfs:label']).toBe('Build Command');
    });

    it('should handle complex property relationships', async () => {
      const turtleContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

cmd:GenerateCommand a cmd:Command ;
    cmd:hasSubCommand cmd:GenerateTS, cmd:GenerateGo ;
    cmd:requires cmd:TemplateEngine ;
    cmd:produces cmd:OutputFile .

cmd:GenerateTS a cmd:SubCommand ;
    cmd:inheritsFrom cmd:GenerateCommand ;
    cmd:outputType "typescript" .

cmd:GenerateGo a cmd:SubCommand ;
    cmd:inheritsFrom cmd:GenerateCommand ;
    cmd:outputType "go" .
`;

      const filePath = join(tempDir, 'generate.ttl');
      await writeFile(filePath, turtleContent);
      
      const ontology = await parser.parseFile(filePath);
      
      const generateCmd = ontology.entities.find(e => e.id === 'cmd:GenerateCommand');
      expect(generateCmd).toBeDefined();
      
      const relationships = ontology.relationships.filter(r => r.subject === 'cmd:GenerateCommand');
      expect(relationships.length).toBeGreaterThan(0);
      
      const hasSubCommands = relationships.filter(r => r.predicate === 'cmd:hasSubCommand');
      expect(hasSubCommands).toHaveLength(2);
      expect(hasSubCommands.map(r => r.object)).toContain('cmd:GenerateTS');
      expect(hasSubCommands.map(r => r.object)).toContain('cmd:GenerateGo');
    });

    it('should parse N-Triples format', async () => {
      const ntriplesContent = `<http://example.org/commands#TestCommand> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/commands#Command> .
<http://example.org/commands#TestCommand> <http://www.w3.org/2000/01/rdf-schema#label> "Test Command" .
<http://example.org/commands#TestCommand> <http://example.org/commands#hasDescription> "A test command for validation" .
`;

      const filePath = join(tempDir, 'test.nt');
      await writeFile(filePath, ntriplesContent);
      
      const ontology = await parser.parseFile(filePath);
      
      expect(ontology.entities).toHaveLength(1);
      const testCommand = ontology.entities[0];
      expect(testCommand.id).toBe('http://example.org/commands#TestCommand');
      expect(testCommand.type).toBe('http://example.org/commands#Command');
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidTurtle = `
@prefix cmd: <incomplete
cmd:InvalidCommand a cmd:Command
`; // Missing closing bracket and semicolon

      const filePath = join(tempDir, 'invalid.ttl');
      await writeFile(filePath, invalidTurtle);
      
      await expect(async () => {
        await parser.parseFile(filePath);
      }).rejects.toThrow();
    });
  });

  describe('RDF/XML Parsing', () => {
    it('should parse RDF/XML format', async () => {
      const rdfxmlContent = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:cmd="http://example.org/commands#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  
  <cmd:Command rdf:about="#DeployCommand">
    <rdfs:label>Deploy Command</rdfs:label>
    <cmd:hasArgument rdf:resource="#environment"/>
    <cmd:hasArgument rdf:resource="#dryRun"/>
  </cmd:Command>
  
  <cmd:Argument rdf:about="#environment">
    <rdfs:label>Environment</rdfs:label>
    <cmd:type>string</cmd:type>
    <cmd:required rdf:datatype="http://www.w3.org/2001/XMLSchema#boolean">true</cmd:required>
  </cmd:Argument>
  
</rdf:RDF>`;

      const filePath = join(tempDir, 'deploy.rdf');
      await writeFile(filePath, rdfxmlContent);
      
      const ontology = await parser.parseFile(filePath);
      
      expect(ontology.entities).toHaveLength(2);
      const deployCommand = ontology.entities.find(e => e.id.includes('DeployCommand'));
      expect(deployCommand).toBeDefined();
      expect(deployCommand?.properties['rdfs:label']).toBe('Deploy Command');
    });
  });

  describe('JSON-LD Parsing', () => {
    it('should parse JSON-LD format', async () => {
      const jsonldContent = {
        "@context": {
          "cmd": "http://example.org/commands#",
          "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
        },
        "@id": "cmd:TestCommand",
        "@type": "cmd:Command",
        "rdfs:label": "Test Command",
        "cmd:hasArgument": [
          {
            "@id": "cmd:input",
            "@type": "cmd:Argument",
            "rdfs:label": "Input file",
            "cmd:type": "string",
            "cmd:required": true
          },
          {
            "@id": "cmd:output",
            "@type": "cmd:Argument",
            "rdfs:label": "Output file",
            "cmd:type": "string",
            "cmd:required": false
          }
        ]
      };

      const filePath = join(tempDir, 'test.jsonld');
      await writeFile(filePath, JSON.stringify(jsonldContent, null, 2));
      
      const ontology = await parser.parseFile(filePath);
      
      expect(ontology.entities.length).toBeGreaterThan(0);
      const testCommand = ontology.entities.find(e => e.id === 'cmd:TestCommand');
      expect(testCommand).toBeDefined();
      expect(testCommand?.type).toBe('cmd:Command');
    });
  });
});

describe('SemanticReasoner', () => {
  let reasoner: SemanticReasoner;
  let sampleOntology: OntologyModel;

  beforeEach(() => {
    reasoner = new SemanticReasoner();
    sampleOntology = {
      entities: [
        {
          id: 'cmd:BaseCommand',
          type: 'cmd:Command',
          properties: {
            'rdfs:label': 'Base Command',
            'cmd:abstract': true
          }
        },
        {
          id: 'cmd:BuildCommand',
          type: 'cmd:Command',
          properties: {
            'rdfs:label': 'Build Command',
            'cmd:inheritsFrom': 'cmd:BaseCommand'
          }
        },
        {
          id: 'cmd:DeployCommand',
          type: 'cmd:Command',
          properties: {
            'rdfs:label': 'Deploy Command',
            'cmd:inheritsFrom': 'cmd:BaseCommand'
          }
        }
      ],
      relationships: [
        {
          subject: 'cmd:BuildCommand',
          predicate: 'cmd:inheritsFrom',
          object: 'cmd:BaseCommand'
        },
        {
          subject: 'cmd:DeployCommand',
          predicate: 'cmd:inheritsFrom',
          object: 'cmd:BaseCommand'
        }
      ],
      triples: [],
      namespaces: {
        'cmd': 'http://example.org/commands#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
      }
    };
  });

  describe('Inference Rules', () => {
    it('should infer subclass relationships', () => {
      const subClasses = reasoner.inferSubClasses(sampleOntology, 'cmd:BaseCommand');
      
      expect(subClasses).toHaveLength(2);
      expect(subClasses).toContain('cmd:BuildCommand');
      expect(subClasses).toContain('cmd:DeployCommand');
    });

    it('should infer transitive properties', () => {
      // Add a grandchild relationship
      sampleOntology.entities.push({
        id: 'cmd:FastBuildCommand',
        type: 'cmd:Command',
        properties: {
          'rdfs:label': 'Fast Build Command',
          'cmd:inheritsFrom': 'cmd:BuildCommand'
        }
      });
      
      sampleOntology.relationships.push({
        subject: 'cmd:FastBuildCommand',
        predicate: 'cmd:inheritsFrom',
        object: 'cmd:BuildCommand'
      });
      
      const ancestors = reasoner.inferAncestors(sampleOntology, 'cmd:FastBuildCommand');
      
      expect(ancestors).toContain('cmd:BuildCommand');
      expect(ancestors).toContain('cmd:BaseCommand');
    });

    it('should detect circular dependencies', () => {
      // Create circular dependency
      sampleOntology.relationships.push({
        subject: 'cmd:BaseCommand',
        predicate: 'cmd:inheritsFrom',
        object: 'cmd:BuildCommand'
      });
      
      expect(() => {
        reasoner.validateOntology(sampleOntology);
      }).toThrow('Circular dependency detected');
    });

    it('should infer missing properties', () => {
      const inferences = reasoner.inferMissingProperties(sampleOntology);
      
      expect(inferences.length).toBeGreaterThan(0);
      // Should infer that BuildCommand and DeployCommand are not abstract
      const buildCommandInference = inferences.find(i => 
        i.entity === 'cmd:BuildCommand' && i.property === 'cmd:abstract'
      );
      expect(buildCommandInference?.value).toBe(false);
    });
  });

  describe('SPARQL-like Queries', () => {
    it('should execute simple queries', () => {
      const query = {
        select: ['?command'],
        where: [
          { subject: '?command', predicate: 'rdf:type', object: 'cmd:Command' },
          { subject: '?command', predicate: 'cmd:inheritsFrom', object: 'cmd:BaseCommand' }
        ]
      };
      
      const results = reasoner.query(sampleOntology, query);
      
      expect(results).toHaveLength(2);
      expect(results[0].command).toMatch(/cmd:(Build|Deploy)Command/);
    });

    it('should handle complex query patterns', () => {
      const query = {
        select: ['?parent', '?child'],
        where: [
          { subject: '?child', predicate: 'cmd:inheritsFrom', object: '?parent' },
          { subject: '?parent', predicate: 'cmd:abstract', object: true }
        ]
      };
      
      const results = reasoner.query(sampleOntology, query);
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.parent).toBe('cmd:BaseCommand');
        expect(['cmd:BuildCommand', 'cmd:DeployCommand']).toContain(result.child);
      });
    });
  });

  describe('Consistency Checking', () => {
    it('should validate ontology consistency', () => {
      const validation = reasoner.validateOntology(sampleOntology);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect inconsistencies', () => {
      // Add conflicting information
      sampleOntology.entities[0].properties['cmd:abstract'] = true;
      sampleOntology.entities[0].properties['cmd:concrete'] = true; // Contradiction
      
      const validation = reasoner.validateOntology(sampleOntology);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('UnjucksOntologyIntegration', () => {
  let integration: UnjucksOntologyIntegration;
  let tempDir: string;

  beforeEach(async () => {
    integration = new UnjucksOntologyIntegration();
    tempDir = join(tmpdir(), `integration-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Ontology to Template Context', () => {
    it('should convert ontology to template context', async () => {
      const turtleContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:ProcessCommand a cmd:Command ;
    rdfs:label "Process Command" ;
    cmd:hasArgument cmd:input, cmd:output ;
    cmd:category "data" .

cmd:input a cmd:Argument ;
    rdfs:label "Input file" ;
    cmd:type "string" ;
    cmd:required true .

cmd:output a cmd:Argument ;
    rdfs:label "Output file" ;
    cmd:type "string" ;
    cmd:required false .
`;

      const ontologyFile = join(tempDir, 'process.ttl');
      await writeFile(ontologyFile, turtleContent);
      
      const context = await integration.ontologyToContext(ontologyFile);
      
      expect(context.commands).toBeDefined();
      expect(context.commands).toHaveLength(1);
      
      const processCmd = context.commands[0];
      expect(processCmd.name).toBe('ProcessCommand');
      expect(processCmd.label).toBe('Process Command');
      expect(processCmd.arguments).toHaveLength(2);
      expect(processCmd.category).toBe('data');
      
      const inputArg = processCmd.arguments.find((arg: any) => arg.name === 'input');
      expect(inputArg.required).toBe(true);
      expect(inputArg.type).toBe('string');
    });

    it('should handle command hierarchies', async () => {
      const hierarchyTurtle = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:BaseCommand a cmd:Command ;
    rdfs:label "Base Command" ;
    cmd:abstract true ;
    cmd:hasArgument cmd:verbose .

cmd:SpecificCommand a cmd:Command ;
    rdfs:label "Specific Command" ;
    cmd:inheritsFrom cmd:BaseCommand ;
    cmd:hasArgument cmd:target .

cmd:verbose a cmd:Argument ;
    rdfs:label "Verbose output" ;
    cmd:type "boolean" .

cmd:target a cmd:Argument ;
    rdfs:label "Target" ;
    cmd:type "string" .
`;

      const ontologyFile = join(tempDir, 'hierarchy.ttl');
      await writeFile(ontologyFile, hierarchyTurtle);
      
      const context = await integration.ontologyToContext(ontologyFile);
      
      expect(context.commands).toHaveLength(2);
      
      const specificCmd = context.commands.find((c: any) => c.name === 'SpecificCommand');
      expect(specificCmd).toBeDefined();
      expect(specificCmd.inheritsFrom).toBe('BaseCommand');
      expect(specificCmd.arguments).toHaveLength(2); // inherited + own
      
      const inheritedArg = specificCmd.arguments.find((arg: any) => arg.name === 'verbose');
      expect(inheritedArg).toBeDefined();
      expect(inheritedArg.inherited).toBe(true);
    });
  });

  describe('Template Generation with Ontology', () => {
    it('should generate CLI commands from ontology', async () => {
      const ontologyContent = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:ServeCommand a cmd:Command ;
    rdfs:label "Serve Command" ;
    cmd:description "Start a development server" ;
    cmd:hasArgument cmd:port, cmd:host .

cmd:port a cmd:Argument ;
    rdfs:label "Port number" ;
    cmd:type "number" ;
    cmd:default 3000 ;
    cmd:required false .

cmd:host a cmd:Argument ;
    rdfs:label "Host address" ;
    cmd:type "string" ;
    cmd:default "localhost" ;
    cmd:required false .
`;

      const templateContent = `
/**
 * {{ command.label }}
 * {{ command.description }}
 */

import { defineCommand } from '../index';

export const {{ command.name | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ command.name | kebabCase }}',
    description: '{{ command.description }}'
  },
  args: {
    {% for arg in command.arguments %}
    {{ arg.name | camelCase }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.label }}',
      {% if arg.required %}required: true,{% endif %}
      {% if arg.default %}default: {{ arg.default }},{% endif %}
    },
    {% endfor %}
  },
  async run({ args }) {
    // Implementation for {{ command.label }}
    console.log('{{ command.label }} executed with:', args);
  }
});
`;

      const ontologyFile = join(tempDir, 'serve.ttl');
      const templateFile = join(tempDir, 'command.j2');
      const outputFile = join(tempDir, 'serve-command.ts');
      
      await writeFile(ontologyFile, ontologyContent);
      await writeFile(templateFile, templateContent);
      
      await integration.generateFromOntology(ontologyFile, templateFile, outputFile);
      
      const generatedContent = await readFile(outputFile, 'utf-8');
      
      expect(generatedContent).toContain('Serve Command');
      expect(generatedContent).toContain('Start a development server');
      expect(generatedContent).toContain('serveCommand');
      expect(generatedContent).toContain('port: {');
      expect(generatedContent).toContain('host: {');
      expect(generatedContent).toContain("default: 3000");
      expect(generatedContent).toContain("default: 'localhost'");
    });

    it('should handle multiple commands in single ontology', async () => {
      const multiCommandOntology = `
@prefix cmd: <http://example.org/commands#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cmd:BuildCommand a cmd:Command ;
    rdfs:label "Build Command" ;
    cmd:category "development" .

cmd:TestCommand a cmd:Command ;
    rdfs:label "Test Command" ;
    cmd:category "development" .

cmd:DeployCommand a cmd:Command ;
    rdfs:label "Deploy Command" ;
    cmd:category "deployment" .
`;

      const indexTemplate = `
// Generated Command Index
{% for command in commands %}
export { {{ command.name | camelCase }}Command } from './{{ command.name | kebabCase }}';
{% endfor %}

// Commands by category
{% for category, commands in commands | groupBy('category') %}
export const {{ category | camelCase }}Commands = {
  {% for command in commands %}
  {{ command.name | camelCase }}: {{ command.name | camelCase }}Command,
  {% endfor %}
};
{% endfor %}
`;

      const ontologyFile = join(tempDir, 'multi-commands.ttl');
      const templateFile = join(tempDir, 'index.j2');
      const outputFile = join(tempDir, 'index.ts');
      
      await writeFile(ontologyFile, multiCommandOntology);
      await writeFile(templateFile, indexTemplate);
      
      await integration.generateFromOntology(ontologyFile, templateFile, outputFile);
      
      const generatedContent = await readFile(outputFile, 'utf-8');
      
      expect(generatedContent).toContain('buildCommand');
      expect(generatedContent).toContain('testCommand');
      expect(generatedContent).toContain('deployCommand');
      expect(generatedContent).toContain('developmentCommands');
      expect(generatedContent).toContain('deploymentCommands');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ontology files', async () => {
      const invalidOntology = 'This is not valid RDF/Turtle content';
      const ontologyFile = join(tempDir, 'invalid.ttl');
      await writeFile(ontologyFile, invalidOntology);
      
      await expect(async () => {
        await integration.ontologyToContext(ontologyFile);
      }).rejects.toThrow();
    });

    it('should handle missing template files', async () => {
      const validOntology = `
@prefix cmd: <http://example.org/commands#> .
cmd:TestCommand a cmd:Command .
`;
      
      const ontologyFile = join(tempDir, 'valid.ttl');
      await writeFile(ontologyFile, validOntology);
      
      await expect(async () => {
        await integration.generateFromOntology(
          ontologyFile,
          join(tempDir, 'missing.j2'),
          join(tempDir, 'output.ts')
        );
      }).rejects.toThrow();
    });
  });
});
