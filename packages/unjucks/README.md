# Unjucks

> Universal template system with ontology-driven context management for the unjs ecosystem

[![npm version](https://badge.fury.io/js/@unjs%2Funjucks.svg)](https://www.npmjs.com/package/@unjs/unjucks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Hygen-like DX** - Auto-walk templates folder, frontmatter support, simple CLI
- 🧩 **Nunjucks Templates** - Full power of Nunjucks with custom filters
- 🧬 **Ontology-Driven** - Templates powered by semantic RDF/Turtle graphs via Untology
- 🎯 **Context Management** - Scoped context via unctx, no prop drilling
- 📦 **unjs Native** - Follows ecosystem conventions, minimal dependencies
- 🔧 **Production Ready** - Type-safe, tested, optimized for CLI tooling

## 📦 Installation

```bash
# npm
npm install @unjs/unjucks

# pnpm
pnpm add @unjs/unjucks

# yarn
yarn add @unjs/unjucks
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createTemplateContext, renderTemplate } from '@unjs/unjucks'

// Set up context
createTemplateContext({
  name: 'UserProfile',
  props: ['id', 'name', 'email']
})

// Render template
const result = await renderTemplate('templates/component/new/index.njk')
console.log(result.output)
```

### CLI Usage

```bash
# List available generators
unjucks --list

# Generate from template
unjucks component new --name UserCard

# Interactive mode
unjucks -i

# With custom context
unjucks command new --context data.json --output src/commands/

# With ontology
unjucks workflow new --ontology ontology.ttl
```

## 📂 Template Structure

Following Hygen conventions:

```
templates/
  component/
    new/
      index.njk       # Main template
      test.njk        # Test template
    update/
      index.njk
  command/
    new/
      command.njk
  workflow/
    new/
      workflow.njk
```

## 📝 Template Format

Templates use Nunjucks with optional frontmatter:

```nunjucks
---
to: src/components/{{ name | pascalCase }}.tsx
inject: false
---
import React from 'react'

export const {{ name | pascalCase }}: React.FC = () => {
  return <div>{{ name }}</div>
}
```

## 🎨 Built-in Filters

### String Transformations
- `camelCase` - Convert to camelCase
- `pascalCase` - Convert to PascalCase  
- `kebabCase` - Convert to kebab-case
- `snakeCase` - Convert to snake_case
- `upperCase` / `lowerCase` - Change case

### Arrays
- `first` / `last` - Get first/last element
- `unique` - Remove duplicates
- `pluck` - Extract property from objects
- `compact` - Remove falsy values

### Strings
- `pluralize` - Singular/plural forms
- `truncate` - Truncate with suffix
- `padLeft` / `padRight` - Pad strings

### Logic
- `default` - Fallback values
- `ternary` - Conditional values

## 🧬 Ontology Integration

Unjucks can use RDF/Turtle ontologies as data source:

```typescript
import { loadOntologyContext, expandContext } from '@unjs/unjucks'

// Load ontology
const ontology = await loadOntologyContext('schema.ttl')

// Expand to template context
const context = expandContext(ontology.entities)

// Context now contains structured data from ontology
// e.g., context.commands, context.components, etc.
```

Example ontology:

```turtle
@prefix citty: <https://citty.pro/ontology#> .

:deploy a citty:Command ;
  citty:name "deploy" ;
  citty:description "Deploy application" ;
  citty:hasInput :Environment, :Version .
```

## 🔌 API

### Context Management

```typescript
// Create context
createTemplateContext(data)

// Get current context
const ctx = useTemplateContext()

// Update context
updateTemplateContext({ newData: 'value' })

// Scoped context
withTemplateContext(localContext, () => {
  // Use local context here
})
```

### Template Discovery

```typescript
// List generators
const generators = await listGenerators(['templates'])

// List actions for generator
const actions = await listActions('component', ['templates'])

// Find templates
const templates = await findTemplates('*/new', ['templates'])
```

### Rendering

```typescript
// Render file
const result = await renderTemplate('template.njk', context)

// Render string
const output = renderString('Hello {{ name }}!', { name: 'World' })

// Custom renderer
const renderer = createRenderer({
  filters: { custom: (v) => v.toUpperCase() },
  autoescape: false
})
```

## 🎯 Production Example

Generate CLI commands from ontology:

```typescript
// Load command definitions from ontology
const ontology = await loadOntologyContext('commands.ttl')
const commands = ontology.entities.filter(e => e.type === 'Command')

// Generate files for each command
for (const cmd of commands) {
  createTemplateContext({
    ...cmd.properties,
    outputDir: 'src/commands'
  })
  
  const result = await renderTemplate('templates/command/new/index.njk')
  
  await writeFile(
    `src/commands/${cmd.properties.name}.ts`,
    result.output
  )
}
```

## 🚀 CLI Development

Initialize project:

```bash
unjucks init
```

This creates:
- `templates/` - Sample templates
- `ontology.json` - Sample ontology
- `context.json` - Sample context

## ⚙️ Configuration

Create `unjucks.config.ts`:

```typescript
export default {
  templateDirs: ['templates', 'shared-templates'],
  outputDir: 'src',
  filters: {
    timestamp: () => new Date().toISOString()
  },
  ontologyFile: 'schema.ttl'
}
```

## 📊 Why Unjucks?

- **Ontology-First** - Templates driven by semantic data, not random JSON
- **unjs Native** - Consistent with ecosystem patterns
- **Production Focus** - Built for real CLI/workflow generation
- **No Lock-in** - Standard Nunjucks templates work anywhere
- **Type Safe** - Full TypeScript support

## 🤝 Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md).

## 📄 License

MIT © [UnJS](https://github.com/unjs)