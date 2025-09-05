# Nuxt 3 Integration

UnJucks provides seamless integration with Nuxt 3 for both build-time and runtime template generation. This guide covers everything from basic setup to advanced use cases.

## 🚀 Installation

```bash
# Install UnJucks and optional Nuxt module
pnpm add @unjs/unjucks
pnpm add -D @unjs/unjucks-nuxt  # Optional: Nuxt module for enhanced integration
```

## 📦 Basic Setup

### 1. Plugin Configuration

Create a Nuxt plugin for runtime template generation:

```typescript
// plugins/unjucks.client.ts
import { createUnJucks } from '@unjs/unjucks'
import type { UnJucksInstance } from '@unjs/unjucks'

declare module '#app' {
  interface NuxtApp {
    $unjucks: UnJucksInstance
  }
}

export default defineNuxtPlugin(() => {
  const unjucks = createUnJucks({
    // Configuration
    cache: {
      enabled: !process.dev,
      ttl: 5 * 60 * 1000 // 5 minutes
    },
    
    // Global context available in all templates
    context: {
      app: {
        name: 'My Nuxt App',
        version: '1.0.0',
        environment: process.env.NODE_ENV
      },
      build: {
        timestamp: new Date().toISOString()
      }
    },

    // Template directories
    templateDirs: [
      '~/templates',
      '~/node_modules/@unjs/unjucks/templates'
    ]
  })

  return {
    provide: {
      unjucks
    }
  }
})
```

### 2. Nuxt Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Enable UnJucks module (optional)
  modules: [
    '@unjs/unjucks-nuxt'
  ],

  // UnJucks configuration
  unjucks: {
    // Build-time generation
    buildTime: {
      enabled: true,
      patterns: ['content/**/*.ontology'],
      outputDir: 'generated'
    },

    // Runtime configuration
    runtime: {
      cache: true,
      debug: process.dev
    },

    // Template configuration
    templates: {
      directories: ['templates', 'content/templates'],
      extensions: ['.njk', '.unjucks']
    }
  },

  // CSS for generated content (optional)
  css: [
    '~/assets/css/unjucks-components.css'
  ]
})
```

## 💡 Usage Examples

### 1. Component Generation in Pages

```vue
<!-- pages/generator.vue -->
<template>
  <div class="generator-page">
    <h1>Component Generator</h1>
    
    <form @submit.prevent="generateComponent">
      <textarea 
        v-model="ontology" 
        placeholder="Enter your ontology..."
        rows="10"
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate Component' }}
      </button>
    </form>

    <div v-if="result" class="result">
      <h2>Generated Component</h2>
      <pre><code>{{ result.content }}</code></pre>
      
      <button @click="downloadComponent">Download .vue file</button>
    </div>
  </div>
</template>

<script setup>
const { $unjucks } = useNuxtApp()

const ontology = ref(`
@prefix : <http://example.org/> .
:button a :VueComponent ;
  :name "MyButton" ;
  :hasProps (:label :variant :size :disabled) ;
  :hasEvent :click ;
  :hasSlot :default .

:variant a :Enum ;
  :values ("primary" "secondary" "danger") .

:size a :Enum ;
  :values ("small" "medium" "large") .
`)

const loading = ref(false)
const result = ref(null)

const generateComponent = async () => {
  loading.value = true
  
  try {
    result.value = await $unjucks.generate(ontology.value, 'vue-component')
  } catch (error) {
    console.error('Generation failed:', error)
  } finally {
    loading.value = false
  }
}

const downloadComponent = () => {
  if (!result.value) return
  
  const blob = new Blob([result.value.content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.value.metadata.componentName || 'component'}.vue`
  a.click()
  URL.revokeObjectURL(url)
}

// Page metadata
definePageMeta({
  title: 'Component Generator',
  description: 'Generate Vue components from semantic descriptions'
})
</script>
```

### 2. Server-Side API Routes

```typescript
// server/api/generate/component.post.ts
import { generateFromOntology } from '@unjs/unjucks'

export default defineEventHandler(async (event) => {
  const { ontology, template, options = {} } = await readBody(event)
  
  // Validate input
  if (!ontology) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ontology is required'
    })
  }

  try {
    const result = await generateFromOntology(ontology, template || 'vue-component', {
      context: {
        // Server context
        serverUrl: getServerURL(event),
        userAgent: getHeader(event, 'user-agent'),
        timestamp: new Date().toISOString()
      },
      ...options
    })

    // Log generation for analytics
    console.log(`Generated ${template || 'vue-component'} for ${getClientIP(event)}`)

    return {
      success: true,
      ...result,
      metadata: {
        ...result.metadata,
        generatedAt: new Date().toISOString(),
        server: true
      }
    }
  } catch (error) {
    console.error('Generation error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Generation failed',
      data: {
        error: error.message,
        type: error.constructor.name
      }
    })
  }
})
```

### 3. Content-Driven Generation

```vue
<!-- pages/docs/[...slug].vue -->
<template>
  <div class="documentation">
    <ContentDoc :path="$route.path">
      <!-- Custom component for ontology-driven content -->
      <template #ontology="{ ontology, template }">
        <div class="ontology-section">
          <h3>Generated Content</h3>
          <div v-html="generatedContent" />
        </div>
      </template>
    </ContentDoc>
  </div>
</template>

<script setup>
const { $unjucks } = useNuxtApp()
const route = useRoute()

// Get content with ontology sections
const { data: page } = await useAsyncData(`content-${route.path}`, () => 
  queryContent(route.path).findOne()
)

// Generate content from ontology sections
const generatedContent = await useAsyncData(`generated-${route.path}`, async () => {
  if (!page.value?.ontology) return null
  
  const result = await $unjucks.generate(
    page.value.ontology,
    page.value.template || 'documentation'
  )
  
  return result.content
}, {
  depends: [page]
})

// SEO
useHead({
  title: page.value?.title,
  meta: [
    { name: 'description', content: page.value?.description }
  ]
})
</script>
```

## 🏗️ Build-Time Integration

### 1. Generate Static Assets

```typescript
// scripts/generate-components.ts (runs at build time)
import { generateFromOntology } from '@unjs/unjucks'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

async function generateComponentsAtBuild() {
  const contentDir = 'content/components'
  const outputDir = 'generated/components'
  
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true })
  
  // Read all ontology files
  const files = await readdir(contentDir)
  const ontologyFiles = files.filter(f => f.endsWith('.ontology'))
  
  for (const file of ontologyFiles) {
    const ontologyPath = join(contentDir, file)
    const ontology = await readFile(ontologyPath, 'utf-8')
    
    // Generate Vue component
    const result = await generateFromOntology(ontology, 'vue-component', {
      context: {
        build: true,
        timestamp: new Date().toISOString()
      }
    })
    
    // Write generated file
    const outputPath = join(outputDir, file.replace('.ontology', '.vue'))
    await writeFile(outputPath, result.content)
    
    console.log(`✅ Generated ${outputPath}`)
  }
}

// Run during build
if (process.env.NODE_ENV === 'production') {
  generateComponentsAtBuild().catch(console.error)
}
```

### 2. Nuxt Build Hook

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  hooks: {
    // Generate components before building
    'build:before': async (nuxt) => {
      console.log('🔄 Generating components from ontologies...')
      
      const { generateFromOntology } = await import('@unjs/unjucks')
      const glob = await import('fast-glob')
      
      // Find all ontology files
      const ontologyFiles = await glob.glob('content/**/*.ontology', {
        cwd: nuxt.options.rootDir
      })
      
      for (const file of ontologyFiles) {
        const ontology = await readFile(join(nuxt.options.rootDir, file), 'utf-8')
        const result = await generateFromOntology(ontology, 'vue-component')
        
        // Save to components directory
        const componentPath = file
          .replace('content/', 'components/generated/')
          .replace('.ontology', '.vue')
          
        await ensureFile(join(nuxt.options.rootDir, componentPath))
        await writeFile(join(nuxt.options.rootDir, componentPath), result.content)
      }
      
      console.log(`✅ Generated ${ontologyFiles.length} components`)
    }
  }
})
```

## 🎨 Advanced Patterns

### 1. Dynamic Theme Generation

```vue
<!-- components/ThemeGenerator.vue -->
<template>
  <div class="theme-generator">
    <div class="controls">
      <input v-model="primaryColor" type="color" />
      <input v-model="secondaryColor" type="color" />
      <select v-model="themeName">
        <option value="modern">Modern</option>
        <option value="classic">Classic</option>
        <option value="minimal">Minimal</option>
      </select>
      <button @click="generateTheme">Generate Theme</button>
    </div>
    
    <div class="preview" :style="themeStyles">
      <div class="preview-content">
        <h2>Preview</h2>
        <button class="btn-primary">Primary Button</button>
        <button class="btn-secondary">Secondary Button</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const { $unjucks } = useNuxtApp()

const primaryColor = ref('#3498db')
const secondaryColor = ref('#2ecc71')
const themeName = ref('modern')
const themeStyles = ref({})

const generateTheme = async () => {
  const ontology = `
@prefix : <http://theme.example.org/> .
:theme a :CSSTheme ;
  :name "${themeName.value}" ;
  :primaryColor "${primaryColor.value}" ;
  :secondaryColor "${secondaryColor.value}" ;
  :hasComponent :button, :card, :input .

:button a :Component ;
  :hasVariant :primary, :secondary .
  `
  
  const result = await $unjucks.generate(ontology, 'css-theme')
  
  // Apply generated CSS
  const style = document.createElement('style')
  style.textContent = result.content
  document.head.appendChild(style)
  
  // Update preview styles
  themeStyles.value = {
    '--primary-color': primaryColor.value,
    '--secondary-color': secondaryColor.value
  }
}
</script>
```

### 2. Form Builder with Validation

```vue
<!-- components/FormBuilder.vue -->
<template>
  <div class="form-builder">
    <div class="form-definition">
      <textarea 
        v-model="formOntology" 
        @input="debounceGenerate"
        placeholder="Define your form..."
      />
    </div>
    
    <div class="generated-form">
      <component 
        :is="GeneratedForm" 
        @submit="handleSubmit"
        @validate="handleValidation"
      />
    </div>
  </div>
</template>

<script setup>
const { $unjucks } = useNuxtApp()

const formOntology = ref(`
@prefix : <http://form.example.org/> .
:contactForm a :Form ;
  :name "Contact Form" ;
  :hasField :name, :email, :message .

:name a :TextField ;
  :label "Full Name" ;
  :required true ;
  :validation :minLength3 .

:email a :EmailField ;
  :label "Email Address" ;
  :required true .

:message a :TextareaField ;
  :label "Message" ;
  :required true ;
  :rows 5 .
`)

const GeneratedForm = ref(null)

const debounceGenerate = useDebounceFn(generateForm, 500)

async function generateForm() {
  try {
    const result = await $unjucks.generate(formOntology.value, 'vue-form')
    
    // Dynamically compile the generated Vue component
    const component = await compileVueComponent(result.content)
    GeneratedForm.value = component
    
  } catch (error) {
    console.error('Form generation failed:', error)
  }
}

const handleSubmit = (formData) => {
  console.log('Form submitted:', formData)
  // Handle form submission
}

const handleValidation = (errors) => {
  console.log('Validation errors:', errors)
}

// Generate initial form
onMounted(() => {
  generateForm()
})
</script>
```

### 3. API Client Generation

```typescript
// composables/useApiClient.ts
export const useApiClient = async (apiOntology: string) => {
  const { $unjucks } = useNuxtApp()
  
  // Generate TypeScript API client
  const result = await $unjucks.generate(apiOntology, 'typescript-api-client', {
    context: {
      baseURL: useRuntimeConfig().public.apiBase,
      version: 'v1'
    }
  })
  
  // Dynamically import generated client
  const clientModule = await import(`data:text/javascript;base64,${btoa(result.content)}`)
  
  return {
    client: clientModule.default,
    types: result.metadata.types,
    endpoints: result.metadata.endpoints
  }
}
```

## 📊 Performance Optimization

### 1. Template Caching

```typescript
// plugins/unjucks-optimized.client.ts
export default defineNuxtPlugin(() => {
  const unjucks = createUnJucks({
    // Aggressive caching in production
    cache: {
      enabled: !process.dev,
      ttl: process.dev ? 1000 : 30 * 60 * 1000, // 30 minutes in production
      maxSize: 100 // Maximum 100 cached templates
    },
    
    // Preload common templates
    preload: [
      'vue-component',
      'typescript-interface',
      'css-module'
    ]
  })
  
  return { provide: { unjucks } }
})
```

### 2. Bundle Size Optimization

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  build: {
    transpile: ['@unjs/unjucks']
  },
  
  vite: {
    define: {
      // Tree-shake unused templates in production
      __UNJUCKS_TEMPLATES__: process.env.NODE_ENV === 'production' 
        ? '["vue-component", "typescript-interface"]'
        : 'null'
    }
  }
})
```

## 🧪 Testing Integration

```typescript
// test/unjucks-integration.test.ts
import { createUnJucks } from '@unjs/unjucks'
import { describe, it, expect } from 'vitest'

describe('UnJucks Nuxt Integration', () => {
  const unjucks = createUnJucks()
  
  it('generates Vue components correctly', async () => {
    const ontology = `
    @prefix : <http://test.org/> .
    :testComponent a :VueComponent ;
      :name "TestButton" ;
      :hasProps (:label) .
    `
    
    const result = await unjucks.generate(ontology, 'vue-component')
    
    expect(result.content).toContain('<template>')
    expect(result.content).toContain('TestButton')
    expect(result.content).toContain('defineProps')
  })
})
```

## 🔗 Related Resources

- **[Nitro Integration](./nitro.md)** - Server-side integration
- **[H3 Integration](./h3.md)** - HTTP utilities
- **[Plugin Development](../advanced/plugins.md)** - Create custom plugins
- **[Performance Guide](../performance/benchmarks.md)** - Optimization strategies

---

*Need help? Join the [UnJS Discord](https://discord.gg/unjs) or check our [GitHub Issues](https://github.com/unjs/unjucks/issues).*