# Getting Started with UnJucks

Get up and running with UnJucks in under 5 minutes. This guide covers everything from installation to your first semantic template generation.

## 🚀 Quick Start

### 1. Installation

```bash
# Using pnpm (recommended for UnJS ecosystem)
pnpm add @unjs/unjucks

# Using npm
npm install @unjs/unjucks

# Using yarn
yarn add @unjs/unjucks

# Using bun
bun add @unjs/unjucks
```

### 2. Your First Template (30 seconds)

Create a simple template with semantic context:

```typescript
// hello.ts
import { createUnJucks, generateFromOntology } from '@unjs/unjucks'

const ontology = `
@prefix : <http://example.org/> .
:app a :Application ;
  :name "MyApp" ;
  :version "1.0.0" ;
  :hasGreeting "Hello, World!" .
`

const template = `
# {{ app.name }} v{{ app.version }}

{{ app.hasGreeting }}

Generated at: {{ timestamp }}
`

const result = await generateFromOntology(ontology, template)
console.log(result.content)
```

Run it:
```bash
npx tsx hello.ts
```

**Output:**
```markdown
# MyApp v1.0.0

Hello, World!

Generated at: 2024-01-15T10:30:00.000Z
```

## 🏗️ Integration Examples

### Nuxt 3 Integration

#### 1. Install Nuxt Plugin

```bash
pnpm add @unjs/unjucks
```

#### 2. Create Plugin

```typescript
// plugins/unjucks.client.ts
import { createUnJucks } from '@unjs/unjucks'

export default defineNuxtPlugin(() => {
  const unjucks = createUnJucks({
    // Global configuration
    cache: true,
    debug: process.dev
  })

  return {
    provide: {
      unjucks
    }
  }
})
```

#### 3. Use in Components

```vue
<template>
  <div>
    <h1>{{ title }}</h1>
    <pre>{{ generatedCode }}</pre>
  </div>
</template>

<script setup>
const { $unjucks } = useNuxtApp()

const ontology = `
@prefix : <http://example.org/> .
:component a :VueComponent ;
  :name "UserCard" ;
  :hasProps (:name :email :avatar) .
`

const template = `
<template>
  <div class="user-card">
    <img :src="avatar" :alt="name" />
    <h3>{{ name }}</h3>
    <p>{{ email }}</p>
  </div>
</template>
`

const { data: result } = await $unjucks.generate(ontology, template)
const generatedCode = result.content
</script>
```

### Nitro API Integration

Create dynamic API endpoints with semantic routing:

```typescript
// server/api/generate.post.ts
import { generateFromOntology } from '@unjs/unjucks'

export default defineEventHandler(async (event) => {
  const { ontology, template, options } = await readBody(event)
  
  try {
    const result = await generateFromOntology(ontology, template, {
      cache: true,
      context: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      },
      ...options
    })
    
    return {
      success: true,
      ...result
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Generation failed',
      data: error.message
    })
  }
})
```

### H3 Middleware Integration

Add template processing middleware:

```typescript
// middleware/template-processor.ts
import { createUnJucksMiddleware } from '@unjs/unjucks/h3'

export default createUnJucksMiddleware({
  // Process .ontology files automatically
  extensions: ['.ontology', '.ont'],
  
  // Cache compiled templates
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000 // 5 minutes
  },
  
  // Custom context providers
  contextProviders: [
    // Add user context
    async (event) => ({
      user: await getCurrentUser(event),
      session: await getSession(event)
    }),
    
    // Add app context
    () => ({
      app: {
        name: 'MyApp',
        version: process.env.APP_VERSION
      }
    })
  ]
})
```

## 🧠 Semantic Features

### Natural Language Queries

Query your ontology with natural language:

```typescript
import { createUnJucks, askGraph } from '@unjs/unjucks'

// Load your ontology
const unjucks = createUnJucks()
await unjucks.loadGraph(`
@prefix : <http://example.org/> .
:user1 a :User ; :name "Alice" ; :role "admin" .
:user2 a :User ; :name "Bob" ; :role "user" .
:cmd1 a :Command ; :name "deploy" ; :requiresRole "admin" .
`)

// Ask questions in natural language
const admins = await askGraph("list all users with admin role")
const commands = await askGraph("which commands require admin role?")

console.log('Admins:', admins)
console.log('Admin commands:', commands)
```

### Smart Context Inference

UnJucks automatically infers relationships and context:

```typescript
const ontology = `
@prefix : <http://example.org/> .
:myProject a :Project ;
  :name "WebApp" ;
  :hasComponent :frontend, :backend, :database .

:frontend a :Component ;
  :type "React" ;
  :port 3000 .

:backend a :Component ;
  :type "Express" ;
  :port 8000 ;
  :connectsTo :database .

:database a :Component ;
  :type "PostgreSQL" ;
  :port 5432 .
`

const template = `
# {{ project.name }} Architecture

## Components
{{#each components}}
- **{{ name }}** ({{ type }})
  - Port: {{ port }}
  {{#if connectsTo}}
  - Connects to: {{ connectsTo.join(', ') }}
  {{/if}}
{{/each}}

## Docker Compose
version: '3.8'
services:
{{#each components}}
  {{ name | lower }}:
    ports:
      - "{{ port }}:{{ port }}"
    {{#if connectsTo}}
    depends_on:
    {{#each connectsTo}}
      - {{ . | lower }}
    {{/each}}
    {{/if}}
{{/each}}
`

const result = await generateFromOntology(ontology, template)
// Automatically generates complete architecture docs + docker-compose!
```

## 🎯 Real-World Use Cases

### 1. CLI Tool Generation

Generate complete CLI tools from semantic descriptions:

```typescript
// cli-generator.ts
import { generateCLIFromOntology } from '@unjs/unjucks/cli'

const ontology = `
@prefix : <http://example.org/> .
:cli a :CLI ;
  :name "mytools" ;
  :description "My development tools" ;
  :hasCommand :build, :test, :deploy .

:build a :Command ;
  :name "build" ;
  :description "Build the project" ;
  :hasOption :watch, :minify .

:watch a :Option ;
  :name "watch" ;
  :type "boolean" ;
  :description "Watch for changes" .
`

const { files } = await generateCLIFromOntology(ontology)
// Generates: package.json, cli.ts, commands/, tests/, README.md
```

### 2. API Documentation

Auto-generate OpenAPI specs from semantic API descriptions:

```typescript
// api-docs-generator.ts
import { generateAPIDocsFromOntology } from '@unjs/unjucks/openapi'

const ontology = `
@prefix : <http://api.example.org/> .
:api a :RestAPI ;
  :name "User Management API" ;
  :version "1.0.0" ;
  :hasEndpoint :getUsers, :createUser .

:getUsers a :Endpoint ;
  :path "/users" ;
  :method "GET" ;
  :returns :UserList .

:createUser a :Endpoint ;
  :path "/users" ;
  :method "POST" ;
  :accepts :UserInput ;
  :returns :User .
`

const { openapi, postman, docs } = await generateAPIDocsFromOntology(ontology)
// Generates OpenAPI spec, Postman collection, and HTML docs
```

### 3. Component Library

Generate React/Vue component libraries:

```typescript
// component-generator.ts
import { generateComponentsFromOntology } from '@unjs/unjucks/components'

const ontology = `
@prefix : <http://components.example.org/> .
:button a :Component ;
  :framework "react" ;
  :hasVariant :primary, :secondary ;
  :hasSize :small, :medium, :large ;
  :hasProps (:onClick :disabled :loading) .
`

const { components, stories, tests } = await generateComponentsFromOntology(ontology)
// Generates React components + Storybook stories + Jest tests
```

## 🔧 Configuration

### Advanced Configuration

```typescript
// unjucks.config.ts
import { defineUnJucksConfig } from '@unjs/unjucks/config'

export default defineUnJucksConfig({
  // Template resolution
  templates: {
    directories: ['./templates', './node_modules/@unjs/unjucks/templates'],
    extensions: ['.njk', '.unjucks', '.template'],
    cache: {
      enabled: true,
      ttl: 10 * 60 * 1000 // 10 minutes
    }
  },

  // Ontology configuration
  ontology: {
    namespaces: {
      app: 'http://myapp.com/',
      schema: 'http://schema.org/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    },
    reasoning: {
      enabled: true,
      level: 'basic' // basic | advanced | full
    }
  },

  // Output configuration
  output: {
    directory: './generated',
    clean: true,
    format: {
      typescript: { prettier: true },
      markdown: { frontmatter: true }
    }
  },

  // Performance optimization
  performance: {
    parallel: true,
    maxWorkers: 4,
    memoryLimit: '512MB'
  },

  // Plugin system
  plugins: [
    '@unjs/unjucks-plugin-typescript',
    '@unjs/unjucks-plugin-vue',
    ['@unjs/unjucks-plugin-custom', { /* options */ }]
  ],

  // Development features
  dev: {
    watch: true,
    hotReload: true,
    debug: true
  }
})
```

### Environment Variables

```bash
# .env
UNJUCKS_CACHE_ENABLED=true
UNJUCKS_CACHE_TTL=600000
UNJUCKS_DEBUG=true
UNJUCKS_PARALLEL=true
UNJUCKS_MAX_WORKERS=4
UNJUCKS_MEMORY_LIMIT=536870912
```

## 📚 Next Steps

- **[Explore Integrations](./integrations/)** - Deep dive into Nuxt, Nitro, and H3 integration
- **[Learn Advanced Features](./advanced/)** - Semantic queries, plugins, and optimization
- **[See Real Examples](./examples/)** - Complete project templates and use cases
- **[Migration Guides](./migration/)** - Move from other template engines
- **[API Reference](./api/)** - Complete API documentation

## 🤝 Getting Help

- **Documentation**: [unjucks.unjs.io](https://unjucks.unjs.io)
- **GitHub Issues**: [Report bugs or request features](https://github.com/unjs/unjucks/issues)
- **Discord**: [Join the UnJS community](https://discord.gg/unjs)
- **Stack Overflow**: [Ask questions with `unjucks` tag](https://stackoverflow.com/questions/tagged/unjucks)

---

*Ready for more advanced features? Check out our [Integration Examples](./integrations/) or dive into [Semantic Queries](./advanced/semantic.md).*