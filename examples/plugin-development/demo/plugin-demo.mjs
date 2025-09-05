#!/usr/bin/env node

import { createUnJucks } from '@unjs/unjucks'
import { createPluginManager, loadBuiltinPlugins, createPlugin } from '../dist/plugin-system.mjs'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

async function runDemo() {
  console.log('🚀 UnJucks Plugin Development Demo\n')

  // Create plugin manager
  const manager = createPluginManager()

  // Load built-in plugins
  await loadBuiltinPlugins(manager)

  // Create a custom analytics plugin
  const analyticsPlugin = createPlugin()
    .name('analytics')
    .version('1.0.0')
    .description('Template analytics and tracking plugin')
    .beforeRender((template, data, context) => {
      // Track template usage
      const templateName = context.templatePath || 'inline'
      data._analytics = {
        templateName,
        renderTime: Date.now(),
        dataKeys: Object.keys(data),
        locale: data.locale || 'en'
      }
      console.log(`📊 Rendering template: ${templateName}`)
    })
    .afterRender((result, template, data, context) => {
      // Track render completion
      const renderTime = Date.now() - data._analytics.renderTime
      console.log(`✅ Template rendered in ${renderTime}ms (${result.length} chars)`)
      return result
    })
    .filter('trackEvent', (eventName, eventData = {}) => {
      console.log(`📈 Event tracked: ${eventName}`, eventData)
      return '' // Filter returns empty string (tracking is side effect)
    })
    .function('analytics', (context, action, data) => {
      console.log(`📊 Analytics: ${action}`, data)
      return `<!-- Analytics: ${action} -->`
    })
    .build()

  // Register custom plugin
  await manager.register(analyticsPlugin)

  // Create UnJucks instance
  const unjucks = await createUnJucks({
    templates: {
      path: './demo/templates'
    }
  })

  // Create plugin context
  const pluginContext = manager.createContext(unjucks)

  // Setup all plugins
  await manager.hooks.callHook('plugin:setup', pluginContext)

  console.log('\n📦 Loaded plugins:', manager.listPlugins().join(', '))

  // Demo 1: Markdown processing
  console.log('\n--- Demo 1: Markdown Processing ---')
  
  const markdownContent = `---
title: "Plugin Demo"
author: "UnJucks Team"
date: 2024-01-01
---

# Welcome to UnJucks Plugins!

This is a **markdown** template with \`syntax highlighting\`:

\`\`\`javascript
const plugin = createPlugin()
  .name('my-plugin')
  .version('1.0.0')
  .build()
\`\`\`

## Features

- ✅ Markdown processing
- ✅ Syntax highlighting  
- ✅ Frontmatter support
- ✅ Custom filters and functions

{{ 'trackEvent' | trackEvent('markdown_demo', {template: 'demo.md'}) }}
`

  const markdownResult = await unjucks.render(markdownContent, {
    _meta: { type: 'markdown' }
  })
  
  console.log('Markdown result preview:')
  console.log(markdownResult.substring(0, 200) + '...')

  // Demo 2: I18n localization
  console.log('\n--- Demo 2: I18n Localization ---')

  // Setup translations
  const translations = {
    en: {
      welcome: 'Welcome {{name}}!',
      goodbye: 'Goodbye {{name}}!',
      items: {
        one: 'You have {{count}} item',
        other: 'You have {{count}} items'
      }
    },
    es: {
      welcome: '¡Bienvenido {{name}}!',
      goodbye: '¡Adiós {{name}}!',
      items: {
        one: 'Tienes {{count}} artículo',
        other: 'Tienes {{count}} artículos'
      }
    }
  }

  // Load translations into i18n plugin
  const i18nPlugin = manager.getPlugin('i18n')
  if (i18nPlugin) {
    i18nPlugin.config.translations = translations
    i18nPlugin.config.locales = ['en', 'es']
  }

  const i18nTemplate = `
<h1>{{ 'welcome' | t(locale, {name: name}) }}</h1>
<p>{{ count | plural('items', locale) }}</p>
<p>Price: {{ price | currency('USD', locale) }}</p>
<p>Date: {{ date | localDate(locale) }}</p>
<footer>{{ 'goodbye' | t(locale, {name: name}) }}</footer>
{{ analytics('page_view', {page: 'demo', locale: locale}) }}
`

  for (const locale of ['en', 'es']) {
    console.log(`\n${locale.toUpperCase()} version:`)
    const i18nResult = await unjucks.render(i18nTemplate, {
      locale,
      name: 'Developer',
      count: 5,
      price: 29.99,
      date: new Date()
    })
    console.log(i18nResult.trim())
  }

  // Demo 3: Cache performance
  console.log('\n--- Demo 3: Cache Performance ---')
  
  const cacheTemplate = `
<!-- This template will be cached -->
<div class="expensive-computation">
  {% for i in range(1000) %}
  <span>Item {{ i }}</span>
  {% endfor %}
</div>
{{ 'trackEvent' | trackEvent('expensive_render') }}
`

  // First render (slow)
  console.time('First render (no cache)')
  await unjucks.render(cacheTemplate, { range: (n) => Array.from({length: n}, (_, i) => i + 1) })
  console.timeEnd('First render (no cache)')

  // Second render (should be faster with cache)
  console.time('Second render (cached)')  
  await unjucks.render(cacheTemplate, { range: (n) => Array.from({length: n}, (_, i) => i + 1) })
  console.timeEnd('Second render (cached)')

  // Demo 4: Plugin composition
  console.log('\n--- Demo 4: Plugin Composition ---')

  const compositeTemplate = `---
title: "Multi-Plugin Demo"
lang: "es"
---

# {{ frontmatter.title }}

{{ 'welcome' | t(frontmatter.lang, {name: 'Plugin System'}) }}

This content combines:
- **Markdown**: {{ 'processing' | markdown }}
- **I18n**: {{ 'items' | plural(3, frontmatter.lang) }}
- **Analytics**: {{ analytics('composite_demo', {plugins: ['markdown', 'i18n', 'analytics']}) }}

Current locale: \`{{ frontmatter.lang }}\`
Render time: {{ _analytics.renderTime }}ms

{{ 'trackEvent' | trackEvent('composite_demo_complete') }}
`

  const compositeResult = await unjucks.render(compositeTemplate, {
    _meta: { type: 'markdown' },
    frontmatter: { title: 'Multi-Plugin Demo', lang: 'es' }
  })

  console.log('Composite result preview:')
  console.log(compositeResult.substring(0, 300) + '...')

  // Save demo output
  await mkdir('./demo/output', { recursive: true })
  await writeFile('./demo/output/markdown-demo.html', markdownResult)
  await writeFile('./demo/output/composite-demo.html', compositeResult)

  console.log('\n💾 Demo output saved to ./demo/output/')
  console.log('\n🎉 Plugin development demo complete!')
  console.log('\nNext steps:')
  console.log('- Create your own plugins using createPlugin()')  
  console.log('- Extend existing plugins with custom filters')
  console.log('- Build plugin ecosystems with dependencies')
  console.log('- Contribute to the UnJucks plugin registry')
}

// Run demo
runDemo().catch(console.error)