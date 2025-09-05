# Unjucks - Product Requirements Document
**Version**: 1.0  
**Date**: September 5, 2025  
**Product**: Unjucks - Ontology-Driven Template Engine for Citty-Pro

---

## 1. Executive Summary

### 1.1 Product Vision
Unjucks is an ontology-first template engine that bridges semantic knowledge representation with production code generation. Built as part of the unjs ecosystem, it leverages Nunjucks templating with RDF/OWL ontologies as the primary data source, enabling intelligent template generation driven by semantic understanding rather than static JSON/YAML configurations.

### 1.2 Value Proposition
- **Semantic Intelligence**: Templates understand the meaning and relationships of data, not just structure
- **Zero Configuration**: Auto-discovery and ontology-driven context eliminate manual setup
- **Production Ready**: Generate CLI commands, workflows, schemas, and documentation from ontological knowledge
- **Developer Experience**: Natural language queries via askGraph API for intuitive template interaction

### 1.3 Strategic Alignment
Unjucks positions citty-pro as the first ontology-native CLI framework, differentiating it from traditional template tools (Hygen, Plop.js) that rely on dumb data structures. This creates a new category of "semantic code generation."

---

## 2. Problem Statement

### 2.1 Current State Analysis
**Existing Template Tools Limitations:**
- **Hygen**: Uses static JSON/YAML configurations lacking semantic relationships
- **Plop.js**: Prompt-driven but no understanding of data relationships
- **Yeoman**: Complex setup with no semantic context awareness
- **Custom Solutions**: Fragmented, project-specific implementations

**Pain Points:**
1. **Static Data Models**: Templates work with flat data structures without understanding relationships
2. **Manual Context Setup**: Developers must manually define and maintain template contexts
3. **No Semantic Validation**: Templates can generate invalid code because they lack domain understanding
4. **Brittle Maintenance**: Changes to data structure require updating multiple template files
5. **Limited Reusability**: Templates are tightly coupled to specific data formats

### 2.2 Impact Assessment
- **Developer Productivity**: 40-60% of development time spent on boilerplate generation
- **Code Quality**: Inconsistent patterns due to manual template maintenance
- **Knowledge Loss**: Domain expertise not captured in template systems
- **Scalability Issues**: Template complexity grows exponentially with project size

---

## 3. Solution Overview

### 3.1 Architecture Vision
```
┌─────────────────────────────────────────────────────────────┐
│                      Unjucks Engine                        │
├─────────────────────────────────────────────────────────────┤
│  Template Discovery  │   Ontology Context   │  Generation   │
│  • Auto-walk         │   • RDF/OWL parsing  │  • Nunjucks   │
│  • .njk files        │   • SPARQL queries   │  • Front-mat. │
│  • Front-matter      │   • askGraph API     │  • File out.  │
└─────────────────────────────────────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
    ┌──────────┐         ┌──────────────┐        ┌──────────────┐
    │Templates │         │   Untology   │        │  Generated   │
    │Directory │◄────────│   Context    │────────►│   Output     │
    │  (.njk)  │         │ (RDF/OWL)    │        │    Code      │
    └──────────┘         └──────────────┘        └──────────────┘
```

### 3.2 Core Innovation
**Ontology-First Design**: Unlike traditional template engines that inject data into templates, Unjucks uses ontological knowledge graphs as the primary data source, enabling:
- **Semantic Understanding**: Templates understand data relationships and constraints
- **Intelligent Generation**: Context-aware code generation based on domain knowledge
- **Natural Language Interface**: Query templates using natural language via askGraph
- **Self-Validating**: Ontology constraints ensure generated code correctness

### 3.3 Technology Stack
- **Template Engine**: Nunjucks (proven, powerful, extensible)
- **Context Management**: unctx (unjs-standard context management)
- **Ontology Processing**: Integrated with existing citty-pro RDF/OWL stack
- **Runtime**: ESM-first, Node.js/Deno/Bun compatible
- **Dependencies**: Minimal, leveraging existing citty-pro infrastructure

---

## 4. Core Features

### 4.1 Auto-Discovery Template System
**Template Directory Walking**
```typescript
// Auto-discovers templates following Hygen conventions
templates/
├── cli/
│   ├── command/
│   │   ├── index.njk
│   │   └── index.njk.meta
│   └── workflow/
│       ├── definition.njk
│       └── definition.njk.meta
└── docs/
    ├── readme/
    │   └── README.njk
    └── api/
        └── openapi.njk
```

**Key Capabilities:**
- Recursive template discovery in `templates/` directory
- Support for nested template hierarchies
- Metadata extraction from `.njk.meta` files
- Template categorization and routing

### 4.2 Ontology-Driven Context
**RDF/OWL Integration**
```typescript
// Ontology provides rich context automatically
const context = await unjucks.getContext('cli:command', {
  ontologyQuery: 'SELECT ?command WHERE { ?command a citty:Command }'
});

// Template receives semantic data
{{ command.hasName }} // Extracted from ontology
{{ command.hasDescription }} // Semantic relationship
{{ command.hasArgument | map('getName') | join(', ') }} // Traverses relationships
```

**Context Features:**
- Automatic SPARQL query generation from template requirements
- Semantic relationship traversal
- Type-safe context based on ontology schema
- Dynamic context enrichment

### 4.3 Enhanced Nunjucks Templating
**Ontology-Aware Filters**
```nunjucks
{# Semantic-aware template with ontology context #}
---
name: {{ command | askGraph('What is the command name?') }}
type: cli-command
ontology-query: |
  SELECT ?command ?arg WHERE {
    ?command a citty:Command ;
             citty:hasName "{{ commandName }}" ;
             citty:hasArgument ?arg .
  }
---

import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: "{{ command.hasName }}",
    description: "{{ command.hasDescription }}",
    version: "{{ command.hasVersion | default('1.0.0') }}"
  },
  args: {
    {% for arg in command.hasArgument | sortBy('citty:isRequired', true) %}
    {{ arg.hasName | camelCase }}: {
      type: '{{ arg.hasType | mapType }}',
      description: '{{ arg.hasDescription }}',
      {% if arg.hasDefaultValue %}
      default: {{ arg.hasDefaultValue | toJSON }},
      {% endif %}
      {% if arg.isRequired %}
      required: true,
      {% endif %}
    },
    {% endfor %}
  },
  run({ args }) {
    // Generated from ontology relationships
    {{ command | generateImplementation }}
  }
});
```

### 4.4 Natural Language Query Interface
**askGraph API Integration**
```typescript
// Templates can ask questions in natural language
{{ command | askGraph('What validation rules apply to this command?') }}
{{ workflow | askGraph('What are the prerequisite steps?') }}
{{ schema | askGraph('Which fields are required for compliance?') }}
```

### 4.5 Front-Matter Routing
**Template Metadata and Routing**
```nunjucks
---
name: cli-command
description: Generate CLI command from ontology
output: src/commands/{{ command.hasName | kebabCase }}.ts
condition: "{{ command.hasType == 'citty:Command' }}"
dependencies: 
  - citty
  - ../types
ontology:
  query: |
    SELECT ?command WHERE {
      ?command a citty:Command ;
               citty:hasName ?name .
      FILTER(?name = "{{ targetCommand }}")
    }
  context: command
---
```

---

## 5. Use Cases (Production)

### 5.1 CLI Command Generation
**Scenario**: Generate type-safe CLI commands from domain ontology
```typescript
// Input: Ontology defines command structure
// Output: Complete citty command with validation
await unjucks.generate('cli/command', {
  ontologyContext: 'devops:deployment-command',
  targetCommand: 'kubectl-deploy'
});
```

**Benefits**:
- Consistent command patterns across projects
- Automatic argument validation from ontology
- Built-in help text and documentation

### 5.2 Workflow Definition Creation
**Scenario**: Generate CI/CD workflows from process ontology
```yaml
# Template: .github/workflows/{{ workflow.name }}.yml
name: {{ workflow | askGraph('What should this workflow be called?') }}
on: {{ workflow.triggers | map('toGitHubEvent') | list }}

jobs:
  {% for step in workflow.hasStep | orderBy('stepOrder') %}
  {{ step.name | kebabCase }}:
    runs-on: {{ step.environment }}
    steps: {{ step.actions | toYAML }}
  {% endfor %}
```

### 5.3 Validation Schema Generation
**Scenario**: Generate Zod/Joi schemas from ontology constraints
```typescript
// Auto-generated from ontology type definitions
export const {{ entity.name | pascalCase }}Schema = z.object({
  {% for property in entity.hasProperty %}
  {{ property.name | camelCase }}: {{ property | generateZodValidator }},
  {% endfor %}
});
```

### 5.4 API Documentation Generation
**Scenario**: Generate OpenAPI specs from service ontology
```yaml
# Auto-generated API documentation
paths:
  {% for endpoint in service.hasEndpoint %}
  {{ endpoint.path }}:
    {{ endpoint.method | lowercase }}:
      summary: {{ endpoint | askGraph('Describe this endpoint purpose') }}
      parameters: {{ endpoint.parameters | toOpenAPIParams }}
  {% endfor %}
```

### 5.5 Test Suite Generation
**Scenario**: Generate comprehensive test suites from behavior ontology
```typescript
// Test cases derived from ontology behavior specifications
describe('{{ component.name }}', () => {
  {% for behavior in component.specifies %}
  {{ behavior | generateTestCase }}
  {% endfor %}
});
```

---

## 6. Technical Requirements

### 6.1 Architecture Requirements

#### 6.1.1 unjs Naming Conventions
- **Package Name**: `unjucks` (follows unjs two-word minimum convention)
- **Core Modules**: 
  - `untemplates` - Template discovery and management
  - `unquery` - Ontology querying interface
  - `ungenerate` - Code generation engine

#### 6.1.2 Context Management
```typescript
// unctx integration for context management
import { createContext } from 'unctx';

const templateContext = createContext<OntologyContext>({
  name: 'unjucks:template-context'
});

// Async context resolution
export async function withOntologyContext<T>(
  ontology: RDFGraph,
  fn: () => Promise<T>
): Promise<T> {
  return await templateContext.callAsync({ ontology }, fn);
}
```

#### 6.1.3 ESM-First Design
```typescript
// Pure ESM with backward compatibility
export interface UnjucksOptions {
  templatesDir?: string;
  ontologySource?: string | RDFGraph;
  cacheStrategy?: 'memory' | 'disk' | 'none';
  extensions?: TemplateExtension[];
}

export default function createUnjucks(options: UnjucksOptions = {}): UnjucksEngine;
```

### 6.2 Performance Requirements

#### 6.2.1 Template Generation Speed
- **Target**: < 100ms for single template generation
- **Benchmark**: 1000 templates/second throughput
- **Optimization**: Template compilation caching, ontology query optimization

#### 6.2.2 Memory Efficiency
- **Context Caching**: Smart ontology context caching with TTL
- **Template Compilation**: Lazy loading and just-in-time compilation
- **Memory Footprint**: < 50MB for typical template sets

#### 6.2.3 Startup Time
- **Cold Start**: < 500ms from require/import to ready
- **Template Discovery**: Concurrent template file scanning
- **Ontology Loading**: Streaming RDF parsing for large ontologies

### 6.3 Runtime Compatibility
```typescript
// Universal runtime support
export const runtimeSupport = {
  node: {
    versions: ['18+', '20+', '22+'],
    modules: ['fs/promises', 'path', 'url']
  },
  deno: {
    versions: ['1.35+'],
    permissions: ['--allow-read', '--allow-write']
  },
  bun: {
    versions: ['1.0+'],
    apis: ['Bun.file', 'Bun.write']
  }
};
```

### 6.4 Dependencies
**Core Dependencies** (Minimal Set):
```json
{
  "dependencies": {
    "nunjucks": "^3.2.4",
    "unctx": "^2.3.1",
    "n3": "^1.26.0",
    "fast-glob": "^3.3.2"
  }
}
```

**Zero Optional Dependencies**: All features work without additional packages

---

## 7. Success Metrics

### 7.1 Performance Metrics
| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Template Generation Speed | < 100ms | Average time per template |
| Throughput | 1000 templates/sec | Concurrent generation benchmark |
| Memory Usage | < 50MB baseline | RSS memory monitoring |
| Cold Start Time | < 500ms | Time to first template generation |

### 7.2 Developer Experience Metrics
| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Setup Time | < 5 minutes | Time from install to first template |
| Learning Curve | < 1 hour | Time to create custom template |
| Error Resolution | < 2 minutes | Average debugging time |
| Documentation Coverage | 100% API | Automated docs generation |

### 7.3 Business Impact Metrics
| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Boilerplate Reduction | 80% less code | Lines of code comparison |
| Development Velocity | 50% faster | Feature delivery time |
| Code Consistency | 95% pattern adherence | Static analysis metrics |
| Knowledge Retention | 90% domain capture | Ontology coverage analysis |

### 7.4 Quality Metrics
| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Test Coverage | > 90% | Automated coverage reporting |
| Type Safety | 100% TypeScript | No `any` types in public API |
| Bundle Size | < 500KB | Bundlephobia analysis |
| Tree Shaking | 100% unused code | Bundle analysis |

---

## 8. Implementation Roadmap

### 8.1 Phase 1: Foundation (Weeks 1-2)
**Core Engine Development**
- [ ] Template discovery system (auto-walk templates/ directory)
- [ ] Basic Nunjucks integration with unctx
- [ ] Ontology context provider interface
- [ ] Front-matter parsing and routing
- [ ] Basic CLI interface

**Acceptance Criteria:**
- Templates can be discovered automatically
- Simple templates render with static context
- Front-matter metadata is parsed correctly
- Basic ontology queries work

### 8.2 Phase 2: Ontology Integration (Weeks 3-4)
**Semantic Features**
- [ ] RDF/OWL ontology parsing integration
- [ ] SPARQL query generation from templates
- [ ] Ontology-aware Nunjucks filters
- [ ] askGraph API integration
- [ ] Context validation against ontology schema

**Acceptance Criteria:**
- Templates can access ontology data
- Natural language queries work via askGraph
- Semantic validation prevents invalid generation
- Context is automatically enriched from ontology

### 8.3 Phase 3: Production Features (Weeks 5-6)
**Enterprise-Ready Capabilities**
- [ ] Template caching and compilation optimization
- [ ] Concurrent template processing
- [ ] Error handling and debugging tools
- [ ] Template testing framework
- [ ] Plugin system for extensibility

**Acceptance Criteria:**
- Performance targets met (< 100ms generation)
- Robust error handling with helpful messages
- Templates can be unit tested
- Plugin architecture allows custom extensions

### 8.4 Phase 4: Ecosystem Integration (Weeks 7-8)
**citty-pro Integration**
- [ ] Deep integration with citty-pro CLI generation
- [ ] Workflow template library
- [ ] Documentation template sets
- [ ] Testing template patterns
- [ ] CI/CD integration templates

**Acceptance Criteria:**
- Complete CLI command generation from ontology
- Workflow definitions generated automatically
- Documentation stays in sync with ontology
- Test coverage generated from behavior specs

---

## 9. Risk Assessment & Mitigation

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Nunjucks Performance | Medium | High | Implement template compilation caching |
| Ontology Query Complexity | High | Medium | Query optimization and result caching |
| Memory Usage with Large Ontologies | Medium | High | Streaming parsing and lazy loading |
| Cross-Runtime Compatibility | Low | High | Comprehensive testing across runtimes |

### 9.2 Adoption Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Learning Curve for Ontologies | High | Medium | Excellent documentation and examples |
| Migration from Existing Tools | Medium | High | Migration guides and compatibility layer |
| Template Complexity | Medium | Medium | Template library and best practices |
| Community Adoption | Medium | High | Open source early, gather feedback |

### 9.3 Business Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Competitor Response | Low | Medium | Focus on unique ontology advantage |
| Feature Scope Creep | High | High | Strict MVP definition and phased approach |
| Resource Allocation | Medium | High | Clear roadmap with measurable milestones |
| Market Readiness | Medium | Medium | Beta program with early adopters |

---

## 10. Acceptance Criteria

### 10.1 Functional Requirements
✅ **Template Discovery**
- [ ] Auto-discovers .njk files in templates/ directory
- [ ] Supports nested template hierarchies
- [ ] Parses front-matter metadata correctly
- [ ] Handles template routing based on metadata

✅ **Ontology Integration**
- [ ] Loads RDF/OWL ontologies as context source
- [ ] Executes SPARQL queries from template requirements
- [ ] Provides semantic relationship traversal
- [ ] Validates generated output against ontology constraints

✅ **Template Generation**
- [ ] Renders Nunjucks templates with ontology context
- [ ] Supports all standard Nunjucks features
- [ ] Provides ontology-aware custom filters
- [ ] Generates multiple files from single template when needed

✅ **Natural Language Interface**
- [ ] askGraph API integration working
- [ ] Natural language queries return relevant ontology data
- [ ] Query results properly formatted for template consumption
- [ ] Caching prevents repeated expensive queries

### 10.2 Performance Requirements
✅ **Speed Targets**
- [ ] Single template generation < 100ms
- [ ] Cold start time < 500ms
- [ ] 1000+ templates/second throughput under load
- [ ] Memory usage stays under 50MB baseline

✅ **Scalability**
- [ ] Handles ontologies with 10,000+ entities
- [ ] Concurrent template processing without blocking
- [ ] Template compilation caching reduces repeat generation time
- [ ] Graceful degradation under resource constraints

### 10.3 Quality Requirements
✅ **Code Quality**
- [ ] 90%+ test coverage across all modules
- [ ] 100% TypeScript with no `any` types in public API
- [ ] Passes all ESLint and Prettier checks
- [ ] Zero critical security vulnerabilities

✅ **Developer Experience**
- [ ] Complete API documentation with examples
- [ ] Getting started guide < 5 minutes to first template
- [ ] Error messages are helpful and actionable
- [ ] Template debugging tools available

### 10.4 Integration Requirements
✅ **Runtime Support**
- [ ] Works in Node.js 18+, 20+, 22+
- [ ] Deno 1.35+ compatibility verified
- [ ] Bun 1.0+ support confirmed
- [ ] ESM and CommonJS module formats

✅ **Ecosystem Integration**
- [ ] Seamless integration with citty-pro
- [ ] unctx context management working
- [ ] Plugs into existing citty ontology system
- [ ] Compatible with citty CLI generation workflows

---

## 11. Conclusion

Unjucks represents a paradigm shift from static template engines to semantic code generation. By leveraging ontological knowledge as the primary data source, it enables intelligent, context-aware template generation that understands the meaning and relationships of the code being generated.

The product positions citty-pro as the first ontology-native CLI framework, creating a new category of semantic development tools. With its focus on developer experience, production-ready performance, and deep integration with the unjs ecosystem, Unjucks has the potential to fundamentally change how developers approach code generation and boilerplate reduction.

**Key Differentiators:**
1. **Ontology-First**: Templates driven by semantic knowledge, not static data
2. **Zero Configuration**: Auto-discovery and context inference eliminate setup
3. **Natural Language Interface**: askGraph enables intuitive template interaction
4. **Production Ready**: Built for enterprise-scale code generation workflows
5. **unjs Integration**: Seamless integration with modern JavaScript tooling

**Success Indicators:**
- 80% reduction in boilerplate code generation time
- 50% faster feature development velocity  
- 95% code pattern consistency across generated code
- 90% domain knowledge capture in template system

The roadmap provides a clear path to market with measurable milestones and risk mitigation strategies. With proper execution, Unjucks can become the standard for intelligent template generation in the JavaScript ecosystem.