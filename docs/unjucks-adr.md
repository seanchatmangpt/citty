# Architecture Decision Records (ADR) - Unjucks

## ADR-001: Template Engine Selection

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a robust template engine for code generation that supports:
- Complex templating logic (conditionals, loops, filters)
- Extensible filter system
- Template inheritance and composition
- Good TypeScript integration
- Active maintenance and community support

### Decision

We will use **Nunjucks** as the primary template engine for unjucks.

### Rationale

**Nunjucks Advantages:**
- Rich templating features (inheritance, macros, filters, conditionals)
- Extensible filter and function system
- Good performance for code generation use cases
- Well-established and maintained by Mozilla
- Familiar Jinja2-like syntax
- Strong TypeScript bindings available

**Alternatives Considered:**
- **Handlebars**: Less powerful templating features, limited logic capabilities
- **Mustache**: Too simple for complex code generation needs
- **EJS**: Security concerns with embedded JavaScript execution
- **Liquid**: Less TypeScript support, smaller ecosystem

### Consequences

**Positive:**
- Rich templating capabilities for complex code generation
- Extensible filter system for domain-specific transformations
- Template inheritance reduces duplication
- Good performance characteristics

**Negative:**
- Additional dependency to manage
- Learning curve for Nunjucks-specific syntax
- Need to implement security measures for user-provided templates

---

## ADR-002: Context Management Strategy

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a robust context management system for handling template variables, ontology data, and runtime state across the generation pipeline. The system must support:
- Hierarchical variable scoping
- Async context propagation
- Memory efficient operations
- Thread-safe operations

### Decision

We will use **unctx** (UnJS Universal Context) for context management with a custom wrapper layer.

### Rationale

**unctx Advantages:**
- Built specifically for the UnJS ecosystem
- Async context propagation support
- Lightweight and performant
- Consistent with other UnJS tools
- AsyncLocalStorage integration

**Implementation Strategy:**
- Global scope: System-wide variables (OS, utilities)
- Template scope: Template-specific variables
- Runtime scope: Generation-time variables
- Ontology scope: Semantic data integration

### Consequences

**Positive:**
- Consistent context handling across async operations
- Memory efficient variable management
- Clear separation of concerns
- Integration with UnJS ecosystem patterns

**Negative:**
- Additional abstraction layer complexity
- Learning curve for unctx-specific patterns

---

## ADR-003: Ontology Integration Architecture

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need to integrate semantic ontologies (TTL/N3) with the template generation system. This requires:
- Parsing RDF/TTL/N3 formats
- SPARQL query execution
- Graph traversal capabilities
- JSON transformation for template consumption

### Decision

We will integrate **Untology** as the primary ontology processing layer with a custom adapter interface.

### Rationale

**Untology Integration Benefits:**
- Designed for semantic web integration
- SPARQL query support
- Multiple RDF format support
- Graph traversal capabilities
- JSON-LD output compatible with templates

**Architecture Approach:**
- Ontology files → Untology parser → Normalized JSON → Template context
- Query-based data extraction for specific template needs
- Caching layer for performance optimization

### Consequences

**Positive:**
- Rich semantic data integration
- Standard RDF format support
- Query-based data extraction flexibility
- Graph relationship modeling

**Negative:**
- Additional dependency on semantic web stack
- Potential performance impact for large ontologies
- Complexity in error handling for malformed ontologies

---

## ADR-004: CLI Framework Selection

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a CLI framework that provides:
- Type-safe command definitions
- Subcommand support
- Rich argument and option parsing
- Integration with the UnJS ecosystem
- Good developer experience

### Decision

We will use **Citty** as the CLI framework for unjucks.

### Rationale

**Citty Advantages:**
- Built for the UnJS ecosystem
- Type-safe command definitions
- Elegant subcommand structure
- Rich argument parsing capabilities
- Consistent with project ecosystem choices

**Integration Strategy:**
- Main command: `unjucks`
- Subcommands: `generate`, `list`, `validate`
- Rich option support: `--dry-run`, `--diff`, `--watch`
- Integration with citty-pro for advanced features

### Consequences

**Positive:**
- Type-safe CLI development
- Consistent with UnJS ecosystem
- Rich feature set for complex CLI needs
- Good integration potential with citty-pro

**Negative:**
- Dependency on specific CLI framework
- Potential migration effort if framework changes

---

## ADR-005: File Organization Strategy

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a clear file organization strategy that:
- Separates concerns effectively
- Supports scalable development
- Follows UnJS conventions
- Enables easy testing and maintenance

### Decision

We will organize the codebase with the following structure:

```
src/
├── core/           # Core business logic
├── integrations/   # External system integrations
├── filters/        # Nunjucks filter definitions
├── types/          # TypeScript type definitions
└── utils/          # Utility functions

templates/          # Default template library
schemas/           # JSON Schema definitions
examples/          # Usage examples
```

### Rationale

**Organization Benefits:**
- Clear separation of concerns
- Easy to locate functionality
- Supports independent testing
- Follows UnJS patterns
- Scales well with growth

**Core Principles:**
- `core/` contains pure business logic
- `integrations/` handles external dependencies
- `types/` provides strong typing throughout
- `templates/` offers ready-to-use examples

### Consequences

**Positive:**
- Clear development guidelines
- Easy to navigate codebase
- Testable architecture
- Maintainable structure

**Negative:**
- Initial setup complexity
- Potential over-organization for small features

---

## ADR-006: Error Handling Strategy

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a comprehensive error handling strategy that:
- Provides clear error messages to users
- Supports debugging and troubleshooting
- Handles partial failures gracefully
- Maintains system stability

### Decision

We will implement a layered error handling approach with typed errors and recovery mechanisms.

### Rationale

**Error Handling Layers:**

1. **Validation Layer**: Input validation with clear error messages
2. **Processing Layer**: Graceful degradation with partial results
3. **Recovery Layer**: Alternative paths and suggestions
4. **Reporting Layer**: User-friendly error presentation

**Error Types:**
- `TemplateError`: Template parsing and validation issues
- `RenderingError`: Template rendering failures
- `OntologyError`: Ontology processing problems
- `FileSystemError`: File I/O related issues
- `ValidationError`: Data validation failures

### Consequences

**Positive:**
- Clear error categorization
- User-friendly error messages
- Partial failure recovery
- Better debugging capabilities

**Negative:**
- Additional complexity in error handling code
- Need for comprehensive error testing

---

## ADR-007: Performance and Caching Strategy

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need to optimize performance for:
- Large template collections
- Complex ontology files
- Repeated generation operations
- Memory-efficient processing

### Decision

We will implement a multi-layer caching strategy with intelligent invalidation.

### Rationale

**Caching Layers:**

1. **Template Cache**: Parsed template objects with file watching
2. **Ontology Cache**: Processed ontology data with TTL
3. **Render Cache**: Rendered output with content hashing
4. **Metadata Cache**: Template metadata with dependency tracking

**Cache Invalidation:**
- File system watchers for templates
- Content hashing for cache keys
- TTL for ontology data
- Dependency-based invalidation

### Consequences

**Positive:**
- Improved performance for repeated operations
- Reduced file system I/O
- Better user experience
- Scalable for large projects

**Negative:**
- Memory usage for caches
- Complexity in cache management
- Potential cache inconsistency issues

---

## ADR-008: Testing Strategy

**Status:** Accepted  
**Date:** 2024-12-19  
**Deciders:** System Architecture Team

### Context

We need a comprehensive testing strategy that covers:
- Unit testing for individual components
- Integration testing for workflows
- Template validation testing
- Performance testing

### Decision

We will use **Vitest** as the primary testing framework with multiple testing layers.

### Rationale

**Testing Layers:**
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: End-to-end workflow testing
3. **Template Tests**: Template validation and rendering
4. **Performance Tests**: Load and performance benchmarks

**Vitest Benefits:**
- Fast execution with native ESM support
- TypeScript integration
- Rich assertion library
- Good UnJS ecosystem compatibility

### Consequences

**Positive:**
- Comprehensive test coverage
- Fast feedback cycles
- Type-safe testing
- Good developer experience

**Negative:**
- Test maintenance overhead
- Initial setup complexity
- Performance test infrastructure needs

---

These ADRs provide the architectural foundation for the unjucks system, documenting key decisions and their rationale for future reference and team alignment.