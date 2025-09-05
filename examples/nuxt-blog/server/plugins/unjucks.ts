import { createUnJucks } from '@unjs/unjucks'
import { createSemanticContext } from '@unjs/unjucks/context'
import type { NitroApp } from 'nitropack'

export default async function (nitroApp: NitroApp) {
  // Initialize UnJucks with semantic context
  const unjucks = await createUnJucks({
    templates: {
      path: './templates',
      patterns: ['**/*.njk', '**/*.html']
    },
    context: {
      semantic: true,
      ontology: {
        blog: {
          name: 'BlogPost',
          properties: {
            title: { type: 'string', required: true },
            content: { type: 'string', required: true },
            author: { type: 'object', required: true },
            publishedAt: { type: 'date', required: true },
            tags: { type: 'array', items: 'string' },
            category: { type: 'string' },
            featured: { type: 'boolean', default: false },
            readTime: { type: 'number' }
          }
        },
        author: {
          name: 'Author',
          properties: {
            name: { type: 'string', required: true },
            email: { type: 'string', format: 'email' },
            bio: { type: 'string' },
            avatar: { type: 'string', format: 'url' },
            social: { type: 'object' }
          }
        }
      }
    }
  })

  // Add to Nitro context
  nitroApp.hooks.hook('render:context', async (context) => {
    context.unjucks = unjucks
  })

  // Register API routes
  nitroApp.hooks.hook('render:route', async (url, result) => {
    if (url.startsWith('/api/blog/')) {
      // Handle blog-specific template rendering
      const semanticContext = createSemanticContext({
        type: 'blog',
        metadata: {
          url,
          timestamp: new Date().toISOString()
        }
      })
      
      result.html = await unjucks.render(result.html, semanticContext)
    }
  })

  console.log('✅ UnJucks initialized for Nuxt blog')
}