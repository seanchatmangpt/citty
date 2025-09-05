# Unjucks Technical Architecture

## System Overview

Unjucks is a template-driven code generation framework that bridges semantic ontologies (TTL/N3) with Nunjucks templates to generate structured outputs. It follows the UnJS ecosystem patterns and integrates with Citty-pro for CLI functionality.

## Core Architecture Components

### 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    UNJUCKS SYSTEM                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Interface (Citty)                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Commands      │  │   Options       │  │   Help      │ │
│  │  • generate     │  │  • --dry-run    │  │  • Usage    │ │
│  │  • list         │  │  • --diff       │  │  • Examples │ │
│  │  • validate     │  │  • --output     │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Core Processing Pipeline                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Template Walker → Context Manager → Renderer → Output │ │
│  │       ↓               ↓              ↓         ↓       │ │
│  │  • Discovery      • unctx mgmt   • Nunjucks  • Files  │ │
│  │  • Validation     • Data merge   • Filters   • Diff   │ │
│  │  • Caching        • Variables    • Macros    • Stats  │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Data Sources & Integration                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Templates  │  │  Ontology   │  │    AI/LLM           │ │
│  │  • Command  │  │  • TTL/N3   │  │  • Context          │ │
│  │  • Workflow │  │  • Queries  │  │  • Enhancement      │ │
│  │  • Task     │  │  • Graph    │  │  • Validation       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 2. Core Data Structures

### TypeScript Interfaces

```typescript
// Core template structure
export interface Template {
  id: string;
  name: string;
  path: string;
  type: TemplateType;
  metadata: TemplateMetadata;
  content: string;
  dependencies?: string[];
  outputs: OutputConfig[];
}

export interface TemplateMetadata {
  description: string;
  version: string;
  author?: string;
  tags: string[];
  ontologyRequirements?: OntologyRequirement[];
  variables: VariableDefinition[];
}

export interface OutputConfig {
  path: string;
  filename?: string;
  extension?: string;
  condition?: string; // Conditional rendering
}

// Context management
export interface RenderContext {
  template: Template;
  data: Record<string, any>;
  ontology?: OntologyData;
  variables: ContextVariables;
  filters: FilterMap;
  macros: MacroMap;
  meta: ContextMeta;
}

export interface ContextVariables {
  global: Record<string, any>;
  template: Record<string, any>;
  runtime: Record<string, any>;
}

// Ontology integration
export interface OntologyData {
  graph: RDFGraph;
  queries: SPARQLQuery[];
  entities: Entity[];
  relationships: Relationship[];
}

export interface Entity {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships: string[];
}

// Generation pipeline
export interface GenerationRequest {
  templateId: string;
  context?: Record<string, any>;
  ontologyPath?: string;
  outputDir?: string;
  options: GenerationOptions;
}

export interface GenerationOptions {
  dryRun: boolean;
  diff: boolean;
  overwrite: boolean;
  backup: boolean;
  validation: boolean;
}

export interface GenerationResult {
  success: boolean;
  outputs: OutputFile[];
  errors: GenerationError[];
  warnings: string[];
  stats: GenerationStats;
}

export interface OutputFile {
  path: string;
  content: string;
  size: number;
  checksum: string;
  templateId: string;
}
```

## 3. Component Architecture

### Template Walker Component

```typescript
// Template discovery and management
export class TemplateWalker {
  private cache: Map<string, Template> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();

  async loadTemplates(dir: string = './templates'): Promise<Template[]> {
    // Recursive directory scanning
    // Template validation and parsing
    // Metadata extraction
    // Dependency resolution
  }

  async getTemplate(id: string): Promise<Template | null> {
    // Cache-first lookup
    // Lazy loading if not cached
    // Validation and error handling
  }

  async validateTemplate(template: Template): Promise<ValidationResult> {
    // Schema validation
    // Dependency checking
    // Ontology requirement validation
  }
}
```

### Context Manager Component

```typescript
// Context lifecycle and management
export class ContextManager {
  private contexts: Map<string, unctx> = new Map();

  async createContext(request: GenerationRequest): Promise<RenderContext> {
    // Load ontology data if specified
    // Merge global and template variables
    // Initialize filters and macros
    // Setup runtime context
  }

  async resolveOntology(path: string): Promise<OntologyData> {
    // Parse TTL/N3 files
    // Execute SPARQL queries
    // Transform to JSON context
    // Cache results
  }

  async enhanceWithAI(context: RenderContext): Promise<RenderContext> {
    // Natural language processing
    // Context enrichment
    // Intelligent defaults
  }
}
```

### Renderer Component

```typescript
// Nunjucks rendering with custom filters
export class NunjucksRenderer {
  private nunjucks: Environment;
  private filters: Map<string, FilterFunction> = new Map();

  constructor() {
    this.setupEnvironment();
    this.registerCustomFilters();
  }

  async render(template: Template, context: RenderContext): Promise<string[]> {
    // Multi-file generation support
    // Error handling and recovery
    // Performance optimization
  }

  private registerCustomFilters(): void {
    // Ontology-specific filters
    // Code generation helpers
    // Format converters
  }
}
```

## 4. Data Flow Architecture

### Primary Flow: Ontology → Template → Output

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ontology  │───▶│   Untology      │───▶│  JSON Context   │
│   (TTL/N3)  │    │   Parser        │    │  (Normalized)   │
└─────────────┘    └─────────────────┘    └─────────────────┘
                                                    │
                                                    ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  File       │◀───│   Nunjucks      │◀───│  Template       │
│  Output     │    │   Renderer      │    │  Engine         │
└─────────────┘    └─────────────────┘    └─────────────────┘
```

### Secondary Flow: Template Discovery → Validation → Cache

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Template   │───▶│  Walker         │───▶│  Validation     │
│  Directory  │    │  Discovery      │    │  Engine         │
└─────────────┘    └─────────────────┘    └─────────────────┘
                                                    │
                                                    ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Runtime    │◀───│  Template       │◀───│  Metadata       │
│  Cache      │    │  Cache          │    │  Extraction     │
└─────────────┘    └─────────────────┘    └─────────────────┘
```

## 5. API Design (UnJS Style)

### Core API Surface

```typescript
// Main exports following UnJS conventions
export {
  // Core functions
  loadTemplates,
  renderTemplate,
  generateFromOntology,
  writeOutput,
  
  // Configuration
  defineConfig,
  createContext,
  
  // Utilities
  validateTemplate,
  diffOutput,
  
  // Types
  type Template,
  type RenderContext,
  type GenerationOptions,
  type OutputFile
} from './core';

// Primary API functions
export async function loadTemplates(
  dir?: string,
  options?: LoadOptions
): Promise<Template[]> {
  const walker = new TemplateWalker();
  return walker.loadTemplates(dir);
}

export async function renderTemplate(
  name: string,
  context?: Record<string, any>,
  options?: RenderOptions
): Promise<string | string[]> {
  const contextManager = new ContextManager();
  const renderer = new NunjucksRenderer();
  
  // Load template, create context, render
}

export async function generateFromOntology(
  ontologyPath: string,
  templateId?: string,
  options?: GenerationOptions
): Promise<GenerationResult> {
  // Full pipeline execution
  // Ontology parsing → Context creation → Rendering → Output
}

export async function writeOutput(
  files: OutputFile[],
  options?: WriteOptions
): Promise<WriteResult> {
  // File system operations
  // Backup management
  // Diff generation
}
```

### Configuration API

```typescript
// Configuration following UnJS patterns
export function defineConfig(config: UnjucksConfig): UnjucksConfig {
  return config;
}

export interface UnjucksConfig {
  templates: {
    dir: string;
    watch?: boolean;
    cache?: boolean;
  };
  ontology: {
    defaultFormat: 'ttl' | 'n3' | 'rdf';
    queryTimeout: number;
    cacheResults: boolean;
  };
  rendering: {
    outputDir: string;
    overwrite: boolean;
    backup: boolean;
  };
  ai: {
    enabled: boolean;
    provider?: 'openai' | 'anthropic';
    model?: string;
  };
}
```

## 6. CLI Interface Architecture

### Command Structure (Citty Integration)

```typescript
// CLI commands following Citty patterns
export const commands = {
  generate: defineCommand({
    meta: {
      name: 'generate',
      description: 'Generate files from templates and ontology'
    },
    args: {
      template: {
        type: 'string',
        description: 'Template ID or path'
      },
      ontology: {
        type: 'string',
        description: 'Ontology file path'
      },
      output: {
        type: 'string',
        description: 'Output directory',
        default: './generated'
      }
    },
    options: {
      'dry-run': {
        type: 'boolean',
        description: 'Show what would be generated without writing files'
      },
      diff: {
        type: 'boolean',
        description: 'Show diff for existing files'
      },
      watch: {
        type: 'boolean',
        description: 'Watch for changes and regenerate'
      }
    },
    async run({ args, options }) {
      // Command implementation
    }
  }),

  list: defineCommand({
    meta: {
      name: 'list',
      description: 'List available templates'
    },
    // Implementation
  }),

  validate: defineCommand({
    meta: {
      name: 'validate',
      description: 'Validate templates and ontology'
    },
    // Implementation
  })
};
```

## 7. Integration Points

### Citty-pro Integration

```typescript
// Integration with citty-pro command system
export interface CittyProIntegration {
  registerTemplates(): Promise<void>;
  generateCommand(spec: CommandSpec): Promise<GenerationResult>;
  validateWorkflow(workflow: WorkflowSpec): Promise<ValidationResult>;
  enhanceWithAI(context: any): Promise<any>;
}
```

### Untology Graph Queries

```typescript
// SPARQL query interface for ontology data
export interface OntologyQueryEngine {
  executeQuery(query: string): Promise<QueryResult>;
  findEntities(type: string): Promise<Entity[]>;
  getRelationships(entityId: string): Promise<Relationship[]>;
  traverseGraph(startNode: string, depth: number): Promise<GraphPath[]>;
}
```

### AI/LLM Integration

```typescript
// Natural language enhancement interface
export interface AIProvider {
  enhanceContext(context: RenderContext, prompt: string): Promise<RenderContext>;
  generateTemplate(description: string): Promise<Template>;
  validateOutput(output: string, requirements: string[]): Promise<ValidationResult>;
}
```

## 8. File Organization

```
unjucks/
├── src/
│   ├── cli.ts              # Citty CLI implementation
│   ├── core/
│   │   ├── index.ts        # Main exports
│   │   ├── walker.ts       # Template discovery
│   │   ├── context.ts      # Context management (unctx)
│   │   ├── renderer.ts     # Nunjucks wrapper
│   │   └── output.ts       # File generation
│   ├── integrations/
│   │   ├── ontology.ts     # Untology integration
│   │   ├── ai.ts           # LLM providers
│   │   └── citty-pro.ts    # Citty-pro bridge
│   ├── filters/
│   │   ├── index.ts        # Filter registry
│   │   ├── ontology.ts     # Ontology-specific filters
│   │   └── code.ts         # Code generation filters
│   ├── types/
│   │   ├── index.ts        # Core type exports
│   │   ├── template.ts     # Template interfaces
│   │   ├── context.ts      # Context interfaces
│   │   └── ontology.ts     # Ontology interfaces
│   └── utils/
│       ├── validation.ts   # Schema validation
│       ├── cache.ts        # Caching utilities
│       └── diff.ts         # Diff generation
├── templates/              # Default template library
│   ├── command/
│   │   ├── basic.njk       # Basic command template
│   │   ├── advanced.njk    # Complex command template
│   │   └── meta.json       # Template metadata
│   ├── workflow/
│   │   ├── ci-cd.njk       # CI/CD workflow
│   │   ├── deployment.njk  # Deployment workflow
│   │   └── meta.json
│   └── task/
│       ├── automation.njk  # Task automation
│       ├── validation.njk  # Validation tasks
│       └── meta.json
├── schemas/                # JSON Schema definitions
│   ├── template.json       # Template schema
│   ├── context.json        # Context schema
│   └── config.json         # Configuration schema
└── examples/               # Usage examples
    ├── basic/              # Basic usage
    ├── ontology/           # Ontology-driven generation
    └── citty-pro/          # Citty-pro integration
```

## 9. Error Handling & Validation

### Validation Strategy

```typescript
export class ValidationEngine {
  async validateTemplate(template: Template): Promise<ValidationResult> {
    // JSON Schema validation
    // Dependency resolution
    // Syntax checking
    // Ontology requirements
  }

  async validateContext(context: RenderContext): Promise<ValidationResult> {
    // Variable completeness
    // Type checking
    // Required field validation
  }

  async validateOutput(output: OutputFile[]): Promise<ValidationResult> {
    // File path validation
    // Content validation
    // Conflict detection
  }
}
```

### Error Recovery

```typescript
export class ErrorHandler {
  async handleTemplateError(error: TemplateError): Promise<RecoveryResult> {
    // Template fixing suggestions
    // Alternative template recommendations
    // Partial generation capability
  }

  async handleRenderingError(error: RenderingError): Promise<RecoveryResult> {
    // Context completion
    // Filter fallbacks
    // Graceful degradation
  }
}
```

## 10. Performance & Caching

### Caching Strategy

```typescript
export interface CacheManager {
  // Template caching
  cacheTemplate(template: Template): Promise<void>;
  getCachedTemplate(id: string): Promise<Template | null>;
  
  // Ontology caching
  cacheOntologyData(path: string, data: OntologyData): Promise<void>;
  getCachedOntology(path: string): Promise<OntologyData | null>;
  
  // Rendered output caching
  cacheRenderedOutput(key: string, output: string): Promise<void>;
  getCachedOutput(key: string): Promise<string | null>;
}
```

This architecture provides a robust, extensible foundation for the unjucks system with clear separation of concerns, strong typing, and integration points for the broader ecosystem.