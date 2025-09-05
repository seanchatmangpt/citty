# untology

> Minimalist N3/RDF wrapper for unjs ecosystem with context-driven graph management

[![npm version](https://badge.fury.io/js/untology.svg)](https://badge.fury.io/js/untology)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✨ **80/20 Design** - Simple API for 80% use cases, power features available when needed  
🎯 **Context-Driven** - No manual store passing via `unctx`  
🗣️ **Natural Language Queries** - Ask questions in plain English  
📦 **unjs Native** - Follows unjs naming conventions and patterns  
🚀 **Production Ready** - Built for CLI and workflow generation

## Installation

```bash
# npm
npm install untology

# pnpm  
pnpm add untology

# yarn
yarn add untology
```

## Quick Start

```typescript
import { loadGraph, findEntities, askGraph, toContextObjects } from 'untology'

// Load an ontology
await loadGraph(`
  @prefix citty: <https://citty.pro/ontology#> .
  
  :deploy a citty:Command ;
    citty:name "deploy" ;
    citty:description "Deploy the application" .
`)

// Natural language queries
const commands = await askGraph("list all Commands")
// → [':deploy']

const desc = await askGraph("what is deploy's description")  
// → "Deploy the application"

// Export for templating
const contexts = toContextObjects('citty:Command')
// → [{ id: 'deploy', 'citty:name': 'deploy', 'citty:description': 'Deploy the application' }]
```

## Core API (80% Use Cases)

### Loading Graphs

```typescript
// From string
await loadGraph(turtleString)

// From file
await loadGraph('./ontology.ttl')

// From URL
await loadGraph('https://schema.org/version/latest/schemaorg-current-http.ttl')
```

### Finding Entities

```typescript
// All entities
const all = findEntities()

// By type
const commands = findEntities('citty:Command')
```

### Getting Values

```typescript
// Single value
const name = getValue(':deploy', 'citty:name')

// Multiple values
const args = getValues(':deploy', 'citty:args')
```

### Natural Language Queries

```typescript
await askGraph("list all Commands")
await askGraph("what is deploy's name")
await askGraph("count Commands")
await askGraph("describe deploy")
```

### Exporting

```typescript
// For templates
const contexts = toContextObjects()

// To formats
const turtle = await exportTurtle()
const jsonld = await exportJsonLd()
```

## Advanced Features (20% Power Users)

```typescript
import { sparqlQuery, validateShacl, mergeGraphs } from 'untology/advanced'

// SPARQL queries
const results = await sparqlQuery('SELECT ?s WHERE { ?s a :Command }')

// SHACL validation
const report = await validateShacl(shapesGraph)

// Graph operations
const merged = mergeGraphs([graph1, graph2])
```

## Production Example: CLI Generation

```typescript
import { loadGraph, toContextObjects } from 'untology'
import { render } from 'unjucks'

// Load command definitions
await loadGraph('./commands.ttl')

// Get command contexts
const commands = toContextObjects('citty:Command')

// Generate CLI files
for (const cmd of commands) {
  const code = await render('command.njk', cmd)
  await writeFile(`src/commands/${cmd.name}.ts`, code)
}
```

## Why untology?

- **unjs Native**: Follows ecosystem conventions
- **Context-Driven**: No manual store management
- **Production Focus**: Built for real CLI/workflow generation
- **Natural Queries**: Plain English instead of SPARQL
- **80/20 Rule**: Simple by default, powerful when needed

## License

MIT