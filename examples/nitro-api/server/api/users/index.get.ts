import { z } from 'zod'
import { createSemanticContext } from '@unjs/unjucks/context'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  role: z.enum(['admin', 'user', 'moderator']).optional()
})

export default defineEventHandler(async (event) => {
  const { unjucks, ontology } = event.context
  
  try {
    // Parse and validate query parameters using ontology
    const query = await getValidatedQuery(event, querySchema.parse)
    
    // Create semantic context for the User entity
    const context = createSemanticContext({
      entity: 'User',
      operation: 'list',
      parameters: query,
      ontology: ontology.getEntity('User')
    })

    // Mock data - in real app, fetch from database
    const mockUsers = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
      role: ['admin', 'user', 'moderator'][i % 3],
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: Math.random() > 0.1
    }))

    // Filter by role if specified
    const filteredUsers = query.role 
      ? mockUsers.filter(user => user.role === query.role)
      : mockUsers

    // Paginate
    const startIndex = (query.page - 1) * query.limit
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + query.limit)

    // Validate response against ontology
    const response = await unjucks.render('api-response.njk', {
      ...context,
      success: true,
      data: paginatedUsers,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: crypto.randomUUID(),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / query.limit)
        }
      }
    })

    // Parse the rendered JSON response
    const parsedResponse = JSON.parse(response)
    
    return parsedResponse
    
  } catch (error) {
    // Error handling with semantic context
    const errorContext = createSemanticContext({
      entity: 'ApiResponse',
      operation: 'error',
      ontology: ontology.getEntity('ApiResponse')
    })

    const errorResponse = await unjucks.render('api-response.njk', {
      ...errorContext,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: crypto.randomUUID()
      }
    })

    setResponseStatus(event, 400)
    return JSON.parse(errorResponse)
  }
})