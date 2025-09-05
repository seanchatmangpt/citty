# Plugin Development Guide

UnJucks features a powerful plugin system that allows you to extend functionality, add custom template formats, integrate with external services, and create domain-specific features.

## 🔌 Plugin Architecture

UnJucks plugins are modular extensions that can:

- **📝 Add Template Formats**: Support new template syntaxes and engines
- **🧠 Extend Semantic Features**: Add custom ontology processors and reasoners  
- **🔧 Custom Filters & Functions**: Create reusable template utilities
- **🌐 External Integrations**: Connect to APIs, databases, and services
- **⚡ Performance Enhancements**: Add caching, optimization, and acceleration
- **🎨 Output Processors**: Transform generated content

## 🚀 Quick Start

### 1. Basic Plugin Structure

```typescript
// plugins/my-plugin.ts
import { definePlugin } from '@unjs/unjucks'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  setup(unjucks, options) {
    // Plugin initialization
    console.log('My plugin loaded!')
    
    // Add custom filter
    unjucks.addFilter('myFilter', (value) => {
      return `Custom: ${value}`
    })
    
    // Register template format
    unjucks.addTemplateFormat('my-format', {
      compile: async (template) => {
        // Compile logic
        return (context) => processTemplate(template, context)
      }
    })
    
    // Add semantic feature
    unjucks.addSemanticProcessor('myProcessor', async (ontology) => {
      // Process ontology data
      return processOntology(ontology)
    })
  },
  
  // Plugin configuration schema
  options: {
    enabled: { type: 'boolean', default: true },
    apiKey: { type: 'string', required: false },
    timeout: { type: 'number', default: 5000 }
  }
})
```

### 2. Register Plugin

```typescript
// Register in UnJucks configuration
import { createUnJucks } from '@unjs/unjucks'
import myPlugin from './plugins/my-plugin'

const unjucks = createUnJucks({
  plugins: [
    myPlugin,
    // Or with options
    [myPlugin, { 
      enabled: true,
      apiKey: 'your-api-key'
    }]
  ]
})
```

## 🛠️ Plugin Types & Examples

### 1. Template Format Plugin

Add support for new template syntaxes:

```typescript
// plugins/pug-support.ts
import { definePlugin } from '@unjs/unjucks'
import pug from 'pug'

export default definePlugin({
  name: 'unjucks-pug',
  
  setup(unjucks) {
    unjucks.addTemplateFormat('pug', {
      extensions: ['.pug', '.jade'],
      
      compile: async (template: string, options = {}) => {
        const compiled = pug.compile(template, {
          filename: options.filename,
          pretty: options.pretty
        })
        
        return (context: any) => {
          try {
            return compiled(context)
          } catch (error) {
            throw new Error(`Pug template error: ${error.message}`)
          }
        }
      },
      
      // Syntax validation
      validate: (template: string) => {
        try {
          pug.compile(template)
          return { valid: true }
        } catch (error) {
          return { 
            valid: false, 
            error: error.message,
            line: error.line
          }
        }
      }
    })
  }
})

// Usage
const template = `
div.container
  h1= title
  each item in items
    .card
      h3= item.name
      p= item.description
`

const result = await unjucks.render(template, { 
  title: 'My Items',
  items: [...]
})
```

### 2. Semantic Enhancement Plugin

Add AI-powered semantic features:

```typescript
// plugins/ai-enhancement.ts
import { definePlugin } from '@unjs/unjucks'
import OpenAI from 'openai'

export default definePlugin({
  name: 'ai-enhancement',
  
  setup(unjucks, options) {
    const openai = new OpenAI({
      apiKey: options.openaiKey
    })
    
    // AI-powered content generation
    unjucks.addSemanticFunction('aiGenerate', async (prompt: string, context: any) => {
      const response = await openai.completions.create({
        model: 'gpt-3.5-turbo',
        prompt: `Generate content based on: ${prompt}\nContext: ${JSON.stringify(context)}`,
        max_tokens: options.maxTokens || 150
      })
      
      return response.choices[0].text?.trim()
    })
    
    // Smart code generation
    unjucks.addSemanticFunction('generateCode', async (description: string, language: string) => {
      const response = await openai.completions.create({
        model: 'code-davinci-002',
        prompt: `Generate ${language} code for: ${description}`,
        max_tokens: 200,
        temperature: 0.2
      })
      
      return response.choices[0].text?.trim()
    })
    
    // Content summarization
    unjucks.addFilter('summarize', async (text: string, maxWords = 50) => {
      const response = await openai.completions.create({
        model: 'gpt-3.5-turbo',
        prompt: `Summarize the following text in maximum ${maxWords} words:\n\n${text}`,
        max_tokens: maxWords * 2
      })
      
      return response.choices[0].text?.trim()
    })
    
    // Language translation
    unjucks.addFilter('translate', async (text: string, targetLang: string) => {
      const response = await openai.completions.create({
        model: 'gpt-3.5-turbo',
        prompt: `Translate the following text to ${targetLang}:\n\n${text}`,
        max_tokens: text.length * 2
      })
      
      return response.choices[0].text?.trim()
    })
  },
  
  options: {
    openaiKey: { type: 'string', required: true },
    maxTokens: { type: 'number', default: 150 }
  }
})

// Usage in templates
const template = `
# {{ title }}

{{ description | summarize(30) }}

## Generated Code
\`\`\`{{ language }}
{{ aiGenerate("Create a REST API endpoint for user management", { framework: "Express.js" }) }}
\`\`\`

## Translations
**Spanish**: {{ description | translate("Spanish") }}
**French**: {{ description | translate("French") }}
`
```

### 3. Database Integration Plugin

Connect to databases for dynamic content:

```typescript
// plugins/database.ts
import { definePlugin } from '@unjs/unjucks'
import { createConnection } from 'mysql2/promise'

export default definePlugin({
  name: 'database',
  
  async setup(unjucks, options) {
    const connection = await createConnection({
      host: options.host,
      user: options.user,
      password: options.password,
      database: options.database
    })
    
    // SQL query function
    unjucks.addSemanticFunction('query', async (sql: string, params = []) => {
      try {
        const [results] = await connection.execute(sql, params)
        return results
      } catch (error) {
        console.error('Database query error:', error)
        return []
      }
    })
    
    // Cached queries for better performance
    unjucks.addSemanticFunction('cachedQuery', async (sql: string, params = [], ttl = 300) => {
      const cacheKey = `query:${createHash('md5').update(sql + JSON.stringify(params)).digest('hex')}`
      
      let result = unjucks.cache.get(cacheKey)
      if (!result) {
        const [results] = await connection.execute(sql, params)
        result = results
        unjucks.cache.set(cacheKey, result, ttl * 1000)
      }
      
      return result
    })
    
    // ORM-style helpers
    unjucks.addSemanticFunction('findUsers', async (conditions = {}) => {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ')
      
      const sql = `SELECT * FROM users${whereClause ? ' WHERE ' + whereClause : ''}`
      const [results] = await connection.execute(sql, Object.values(conditions))
      return results
    })
    
    // Cleanup on shutdown
    unjucks.onDestroy(() => {
      connection.end()
    })
  },
  
  options: {
    host: { type: 'string', default: 'localhost' },
    user: { type: 'string', required: true },
    password: { type: 'string', required: true },
    database: { type: 'string', required: true }
  }
})

// Usage in templates
const template = `
# User Directory

{% set users = query("SELECT * FROM users WHERE active = 1 ORDER BY name") %}

{% for user in users %}
## {{ user.name }}
- Email: {{ user.email }}
- Role: {{ user.role }}
- Joined: {{ user.created_at | date("Y-m-d") }}
{% endfor %}

## Statistics
- Total Active Users: {{ query("SELECT COUNT(*) as count FROM users WHERE active = 1")[0].count }}
- Admin Users: {{ findUsers({ role: "admin" }) | length }}
`
```

### 4. Asset Optimization Plugin

Optimize generated assets automatically:

```typescript
// plugins/asset-optimizer.ts
import { definePlugin } from '@unjs/unjucks'
import sharp from 'sharp'
import { minify } from 'terser'
import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'

export default definePlugin({
  name: 'asset-optimizer',
  
  setup(unjucks, options) {
    // Image optimization filter
    unjucks.addFilter('optimizeImage', async (imagePath: string, opts = {}) => {
      const { width, height, format = 'webp', quality = 80 } = opts
      
      const optimized = sharp(imagePath)
        .resize(width, height)
        .format(format, { quality })
        .toBuffer()
      
      const outputPath = imagePath.replace(/\.[^.]+$/, `.${format}`)
      await sharp(await optimized).toFile(outputPath)
      
      return outputPath
    })
    
    // CSS optimization
    unjucks.addFilter('optimizeCSS', async (css: string) => {
      const result = await postcss([
        autoprefixer(),
        cssnano({ preset: 'default' })
      ]).process(css, { from: undefined })
      
      return result.css
    })
    
    // JavaScript minification
    unjucks.addFilter('minifyJS', async (js: string) => {
      const result = await minify(js, {
        compress: true,
        mangle: true,
        format: {
          comments: false
        }
      })
      
      return result.code || js
    })
    
    // Bundle size analyzer
    unjucks.addSemanticFunction('analyzeBundleSize', (assets: string[]) => {
      const sizes = assets.map(asset => {
        const stats = fs.statSync(asset)
        return {
          file: asset,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size)
        }
      })
      
      const total = sizes.reduce((sum, { size }) => sum + size, 0)
      
      return {
        files: sizes,
        totalSize: total,
        totalFormatted: formatBytes(total)
      }
    })
  }
})

// Usage
const template = `
<!DOCTYPE html>
<html>
<head>
  <style>
    {{ cssContent | optimizeCSS | safe }}
  </style>
</head>
<body>
  <img src="{{ heroImage | optimizeImage({ width: 1200, height: 600 }) }}" />
  
  <script>
    {{ jsContent | minifyJS | safe }}
  </script>
  
  <!-- Bundle analysis -->
  {% set bundleInfo = analyzeBundleSize(assets) %}
  <!-- Total bundle size: {{ bundleInfo.totalFormatted }} -->
</body>
</html>
`
```

### 5. API Integration Plugin

Connect to external APIs and services:

```typescript
// plugins/api-integration.ts
import { definePlugin } from '@unjs/unjucks'
import { $fetch } from 'ofetch'

export default definePlugin({
  name: 'api-integration',
  
  setup(unjucks, options) {
    // Generic API fetcher
    unjucks.addSemanticFunction('fetchAPI', async (url: string, opts = {}) => {
      try {
        return await $fetch(url, {
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            ...opts.headers
          },
          timeout: options.timeout,
          ...opts
        })
      } catch (error) {
        console.error(`API fetch error for ${url}:`, error)
        return opts.fallback || null
      }
    })
    
    // GitHub integration
    unjucks.addSemanticFunction('githubRepo', async (repo: string) => {
      return await $fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Authorization': `token ${options.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
    })
    
    // Weather API
    unjucks.addSemanticFunction('weather', async (city: string) => {
      return await $fetch(`https://api.openweathermap.org/data/2.5/weather`, {
        query: {
          q: city,
          appid: options.weatherApiKey,
          units: 'metric'
        }
      })
    })
    
    // CMS content
    unjucks.addSemanticFunction('cmsContent', async (slug: string) => {
      return await $fetch(`${options.cmsUrl}/api/content/${slug}`, {
        headers: {
          'Authorization': `Bearer ${options.cmsToken}`
        }
      })
    })
    
    // Cached API calls
    unjucks.addSemanticFunction('cachedAPI', async (url: string, ttl = 300) => {
      const cacheKey = `api:${url}`
      
      let result = unjucks.cache.get(cacheKey)
      if (!result) {
        result = await $fetch(url)
        unjucks.cache.set(cacheKey, result, ttl * 1000)
      }
      
      return result
    })
  },
  
  options: {
    apiKey: { type: 'string' },
    githubToken: { type: 'string' },
    weatherApiKey: { type: 'string' },
    cmsUrl: { type: 'string' },
    cmsToken: { type: 'string' },
    timeout: { type: 'number', default: 5000 }
  }
})

// Usage
const template = `
# Project Status Dashboard

## Repository Information
{% set repo = githubRepo("unjs/unjucks") %}
- **Stars**: {{ repo.stargazers_count }}
- **Forks**: {{ repo.forks_count }}
- **Issues**: {{ repo.open_issues_count }}
- **Last Updated**: {{ repo.updated_at | date }}

## Weather
{% set weather = weather("San Francisco") %}
Current temperature in SF: {{ weather.main.temp }}°C

## Latest Blog Posts
{% set posts = fetchAPI("https://api.example.com/posts", { query: { limit: 5 } }) %}
{% for post in posts %}
- [{{ post.title }}]({{ post.url }}) - {{ post.published_at | date }}
{% endfor %}
`
```

## 🧩 Advanced Plugin Patterns

### 1. Plugin Composition

Create plugins that extend other plugins:

```typescript
// plugins/enhanced-markdown.ts
import { definePlugin } from '@unjs/unjucks'
import markdownPlugin from '@unjs/unjucks-markdown'

export default definePlugin({
  name: 'enhanced-markdown',
  depends: ['markdown'], // Requires markdown plugin
  
  setup(unjucks, options) {
    // Extend existing markdown functionality
    unjucks.extendPlugin('markdown', {
      // Add syntax highlighting
      highlight: (code: string, lang: string) => {
        return highlightCode(code, lang)
      },
      
      // Custom markdown extensions
      extensions: [
        'tables',
        'strikethrough',
        'tasklist',
        'footnotes'
      ],
      
      // Math formula support
      math: {
        enabled: true,
        katexOptions: {
          throwOnError: false,
          displayMode: true
        }
      }
    })
    
    // Add markdown-specific filters
    unjucks.addFilter('mdToHtml', async (markdown: string) => {
      return await unjucks.getPlugin('markdown').render(markdown)
    })
  }
})
```

### 2. Plugin Testing Framework

```typescript
// plugins/test-framework.ts
import { definePlugin } from '@unjs/unjucks'
import { describe, it, expect } from 'vitest'

export default definePlugin({
  name: 'test-framework',
  
  setup(unjucks) {
    // Template testing utilities
    unjucks.addTestUtils({
      async renderAndExpect(template: string, context: any, expected: string) {
        const result = await unjucks.render(template, context)
        expect(result.trim()).toBe(expected.trim())
      },
      
      async expectSemanticQuery(query: string, expectedCount: number) {
        const results = await unjucks.askGraph(query)
        expect(results).toHaveLength(expectedCount)
      },
      
      async expectFilterOutput(input: any, filterName: string, expected: any) {
        const filter = unjucks.getFilter(filterName)
        const result = await filter(input)
        expect(result).toBe(expected)
      }
    })
    
    // Snapshot testing for templates
    unjucks.addSemanticFunction('snapshot', (name: string, content: string) => {
      const snapshotPath = `__snapshots__/${name}.snap`
      
      if (fs.existsSync(snapshotPath)) {
        const existing = fs.readFileSync(snapshotPath, 'utf-8')
        expect(content).toBe(existing)
      } else {
        fs.writeFileSync(snapshotPath, content)
      }
      
      return content
    })
  }
})

// Usage in tests
describe('Template Tests', () => {
  const unjucks = createUnJucks({
    plugins: ['test-framework']
  })
  
  it('renders user card correctly', async () => {
    await unjucks.renderAndExpect(
      '{{ user.name }} - {{ user.email }}',
      { user: { name: 'John', email: 'john@example.com' }},
      'John - john@example.com'
    )
  })
})
```

### 3. Plugin Hooks & Lifecycle

```typescript
// Advanced plugin with lifecycle hooks
export default definePlugin({
  name: 'lifecycle-plugin',
  
  setup(unjucks, options) {
    // Before template compilation
    unjucks.hook('template:before-compile', (template, metadata) => {
      console.log(`Compiling template: ${metadata.name}`)
      
      // Modify template before compilation
      return template.replace(/\{\{debug\}\}/, `<!-- Debug: ${Date.now()} -->`)
    })
    
    // After template compilation
    unjucks.hook('template:after-compile', (compiledTemplate, metadata) => {
      console.log(`Template compiled: ${metadata.name}`)
      
      // Add performance monitoring
      const originalRender = compiledTemplate.render
      compiledTemplate.render = function(context) {
        const start = performance.now()
        const result = originalRender.call(this, context)
        const duration = performance.now() - start
        
        console.log(`Template ${metadata.name} rendered in ${duration.toFixed(2)}ms`)
        return result
      }
      
      return compiledTemplate
    })
    
    // Before semantic query
    unjucks.hook('semantic:before-query', (query, context) => {
      console.log(`Semantic query: ${query}`)
    })
    
    // After semantic query
    unjucks.hook('semantic:after-query', (query, results, duration) => {
      console.log(`Query "${query}" returned ${results.length} results in ${duration}ms`)
    })
    
    // Error handling
    unjucks.hook('error', (error, context) => {
      console.error('UnJucks error:', error)
      
      // Send to error tracking service
      if (options.sentryDsn) {
        Sentry.captureException(error, { extra: context })
      }
    })
  }
})
```

## 📦 Publishing Plugins

### 1. Plugin Package Structure

```
my-unjucks-plugin/
├── package.json
├── README.md
├── src/
│   ├── index.ts          # Main plugin export
│   ├── filters.ts        # Custom filters
│   ├── functions.ts      # Semantic functions
│   └── types.ts          # TypeScript definitions
├── test/
│   └── plugin.test.ts    # Plugin tests
├── examples/
│   └── usage.md          # Usage examples
└── dist/                 # Built files
```

### 2. Package.json Configuration

```json
{
  "name": "@unjs/unjucks-plugin-myfeature",
  "version": "1.0.0",
  "description": "Custom feature plugin for UnJucks",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "keywords": [
    "unjucks",
    "plugin",
    "template",
    "unjs"
  ],
  "peerDependencies": {
    "@unjs/unjucks": "^1.0.0"
  },
  "files": [
    "dist"
  ]
}
```

### 3. Plugin Testing

```typescript
// test/plugin.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createUnJucks } from '@unjs/unjucks'
import myPlugin from '../src'

describe('My Plugin', () => {
  let unjucks: any
  
  beforeEach(() => {
    unjucks = createUnJucks({
      plugins: [[myPlugin, { /* test options */ }]]
    })
  })
  
  it('adds custom filter', () => {
    expect(unjucks.hasFilter('myFilter')).toBe(true)
  })
  
  it('processes templates correctly', async () => {
    const template = '{{ value | myFilter }}'
    const result = await unjucks.render(template, { value: 'test' })
    
    expect(result).toBe('Custom: test')
  })
  
  it('handles semantic queries', async () => {
    const ontology = `@prefix : <http://test.org/> .`
    const results = await unjucks.askGraph('test query')
    
    expect(Array.isArray(results)).toBe(true)
  })
})
```

## 🎯 Plugin Best Practices

### ✅ Do's

- **Clear naming**: Use descriptive plugin names
- **Type safety**: Provide TypeScript definitions
- **Error handling**: Graceful error handling and fallbacks
- **Performance**: Cache expensive operations
- **Documentation**: Comprehensive usage examples
- **Testing**: Unit and integration tests
- **Versioning**: Follow semantic versioning

### ❌ Don'ts

- **Global state**: Avoid global variables
- **Memory leaks**: Clean up resources in destroy hooks
- **Blocking operations**: Use async for I/O operations
- **Hard dependencies**: Make external dependencies optional
- **Side effects**: Minimize side effects during setup

## 🔗 Official Plugins

UnJucks provides several official plugins:

- **@unjs/unjucks-markdown** - Markdown processing and rendering
- **@unjs/unjucks-typescript** - TypeScript code generation
- **@unjs/unjucks-vue** - Vue.js component generation
- **@unjs/unjucks-openapi** - OpenAPI specification generation
- **@unjs/unjucks-docker** - Docker configuration generation

## 📚 Resources

- **[Plugin API Reference](../api/plugins.md)** - Complete plugin API documentation
- **[Example Plugins](https://github.com/unjs/unjucks-plugins)** - Collection of example plugins
- **[Plugin Registry](https://unjucks.unjs.io/plugins)** - Discover community plugins
- **[Development Guide](../development/plugins.md)** - Advanced plugin development

---

*Ready to create your first plugin? Check out our [plugin template](https://github.com/unjs/unjucks-plugin-template) to get started quickly.*