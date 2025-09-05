import { createUnJucks } from '@unjs/unjucks'
import { createOntology } from '@unjs/unjucks/ontology'
import { createSemanticContext } from '@unjs/unjucks/context'
import type { NitroApp } from 'nitropack'

export default async function (nitroApp: NitroApp) {
  // Define full-stack application ontology
  const appOntology = createOntology({
    entities: {
      // User management
      User: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          email: { type: 'string', format: 'email', required: true },
          username: { type: 'string', required: true, minLength: 3, maxLength: 30 },
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          role: { type: 'string', enum: ['admin', 'moderator', 'user'], default: 'user' },
          avatar: { type: 'string', format: 'url' },
          isActive: { type: 'boolean', default: true },
          lastLoginAt: { type: 'date' },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true }
        },
        relationships: {
          posts: { type: 'hasMany', entity: 'Post' },
          comments: { type: 'hasMany', entity: 'Comment' },
          profile: { type: 'hasOne', entity: 'UserProfile' }
        }
      },

      // Content management
      Post: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          title: { type: 'string', required: true, maxLength: 200 },
          slug: { type: 'string', required: true, pattern: '^[a-z0-9-]+$' },
          content: { type: 'string', required: true },
          excerpt: { type: 'string', maxLength: 500 },
          status: { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
          featuredImage: { type: 'string', format: 'url' },
          tags: { type: 'array', items: 'string' },
          category: { type: 'string' },
          readTime: { type: 'number', min: 1 },
          viewCount: { type: 'number', default: 0 },
          publishedAt: { type: 'date' },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true }
        },
        relationships: {
          author: { type: 'belongsTo', entity: 'User' },
          comments: { type: 'hasMany', entity: 'Comment' }
        }
      },

      // Comments system
      Comment: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          content: { type: 'string', required: true, maxLength: 1000 },
          isApproved: { type: 'boolean', default: false },
          parentId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true }
        },
        relationships: {
          author: { type: 'belongsTo', entity: 'User' },
          post: { type: 'belongsTo', entity: 'Post' },
          parent: { type: 'belongsTo', entity: 'Comment' },
          replies: { type: 'hasMany', entity: 'Comment' }
        }
      },

      // Page templates
      Page: {
        properties: {
          id: { type: 'string', format: 'uuid', required: true },
          title: { type: 'string', required: true },
          slug: { type: 'string', required: true },
          template: { type: 'string', required: true },
          content: { type: 'object', required: true },
          meta: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              keywords: { type: 'array', items: 'string' },
              canonical: { type: 'string', format: 'url' }
            }
          },
          isPublished: { type: 'boolean', default: false },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true }
        }
      },

      // API Response wrapper
      ApiResponse: {
        properties: {
          success: { type: 'boolean', required: true },
          data: { type: 'any' },
          message: { type: 'string' },
          errors: { type: 'array', items: 'string' },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'date', required: true },
              requestId: { type: 'string', format: 'uuid' },
              version: { type: 'string', required: true },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number', min: 1 },
                  limit: { type: 'number', min: 1, max: 100 },
                  total: { type: 'number', min: 0 },
                  totalPages: { type: 'number', min: 0 }
                }
              }
            }
          }
        }
      }
    }
  })

  // Initialize UnJucks with the ontology
  const unjucks = await createUnJucks({
    templates: {
      path: './server/templates',
      patterns: ['**/*.njk', '**/*.html', '**/*.json']
    },
    ontology: appOntology,
    context: {
      semantic: true,
      validation: true,
      caching: true
    }
  })

  // Global context provider
  nitroApp.hooks.hook('request', async (event) => {
    event.context.unjucks = unjucks
    event.context.ontology = appOntology
    
    // Add helper functions
    event.context.createSemanticResponse = async (entity: string, data: any, options: any = {}) => {
      const context = createSemanticContext({
        entity,
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: 'v1',
          ...options
        },
        ontology: appOntology.getEntity(entity)
      })

      return await unjucks.render('api-response.njk', {
        ...context,
        success: true
      })
    }

    event.context.createErrorResponse = async (error: string, status: number = 400) => {
      const context = createSemanticContext({
        entity: 'ApiResponse',
        data: { error, status },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: 'v1'
        }
      })

      return await unjucks.render('api-response.njk', {
        ...context,
        success: false
      })
    }
  })

  // Template rendering middleware
  nitroApp.hooks.hook('render:context', async (context) => {
    context.unjucks = unjucks
    context.ontology = appOntology
  })

  // Auto-generate OpenAPI documentation
  nitroApp.hooks.hook('nitro:build:before', async () => {
    const apiDocs = await unjucks.render('openapi-spec.njk', {
      ontology: appOntology.export(),
      info: {
        title: 'Full-Stack H3 + UnJucks API',
        version: '1.0.0',
        description: 'RESTful API with semantic templates'
      }
    })

    await nitroApp.storage.setItem('docs:openapi.json', apiDocs)
    console.log('📖 OpenAPI documentation generated')
  })

  // Health check endpoint
  nitroApp.hooks.hook('nitro:init', () => {
    console.log('✅ Full-stack UnJucks integration initialized')
    console.log(`   - Entities: ${Object.keys(appOntology.export().entities).length}`)
    console.log(`   - Templates: Loaded from ./server/templates`)
  })
}