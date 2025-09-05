import { createUnJucks } from '@unjs/unjucks'
import { createOntology } from '@unjs/unjucks/ontology'
import type { NitroApp } from 'nitropack'

export default async function (nitroApp: NitroApp) {
  // Define API ontology
  const apiOntology = createOntology({
    entities: {
      User: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          email: { type: 'string', format: 'email', required: true },
          name: { type: 'string', required: true },
          role: { type: 'string', enum: ['admin', 'user', 'moderator'], default: 'user' },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true },
          isActive: { type: 'boolean', default: true },
          profile: { type: 'reference', entity: 'Profile' }
        },
        endpoints: {
          'GET /api/users': {
            description: 'List all users',
            parameters: {
              page: { type: 'number', default: 1 },
              limit: { type: 'number', default: 10, max: 100 },
              role: { type: 'string', enum: ['admin', 'user', 'moderator'] }
            },
            responses: {
              200: { type: 'array', items: 'User' },
              400: { type: 'object', properties: { error: 'string' } }
            }
          },
          'POST /api/users': {
            description: 'Create a new user',
            body: {
              email: { type: 'string', format: 'email', required: true },
              name: { type: 'string', required: true },
              role: { type: 'string', enum: ['admin', 'user', 'moderator'] }
            },
            responses: {
              201: { type: 'reference', entity: 'User' },
              400: { type: 'object', properties: { error: 'string', details: 'array' } }
            }
          }
        }
      },
      Profile: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          userId: { type: 'string', format: 'uuid', required: true },
          bio: { type: 'string', maxLength: 500 },
          avatar: { type: 'string', format: 'url' },
          website: { type: 'string', format: 'url' },
          social: {
            type: 'object',
            properties: {
              twitter: { type: 'string' },
              github: { type: 'string' },
              linkedin: { type: 'string' }
            }
          }
        }
      },
      ApiResponse: {
        properties: {
          success: { type: 'boolean', required: true },
          data: { type: 'any' },
          error: { type: 'string' },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'date', required: true },
              version: { type: 'string', required: true },
              requestId: { type: 'string', format: 'uuid' }
            }
          }
        }
      }
    }
  })

  // Initialize UnJucks with ontology
  const unjucks = await createUnJucks({
    templates: {
      path: './templates',
      patterns: ['**/*.njk', '**/*.json', '**/*.md']
    },
    ontology: apiOntology,
    context: {
      semantic: true,
      validation: true
    }
  })

  // Make available globally
  nitroApp.hooks.hook('request', async (event) => {
    event.context.unjucks = unjucks
    event.context.ontology = apiOntology
  })

  // Auto-generate API documentation
  nitroApp.hooks.hook('nitro:build:before', async () => {
    const docs = await unjucks.render('api-docs.njk', {
      ontology: apiOntology.export(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    })

    await nitroApp.storage.setItem('docs:api.html', docs)
    console.log('📚 API documentation generated')
  })

  console.log('✅ UnJucks with ontology initialized for Nitro API')
}