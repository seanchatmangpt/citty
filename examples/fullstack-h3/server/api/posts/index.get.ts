import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  author: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional()
})

export default defineEventHandler(async (event) => {
  try {
    // Validate query parameters
    const query = await getValidatedQuery(event, querySchema.parse)
    
    // Mock data - replace with actual database queries
    const mockPosts = Array.from({ length: 50 }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `Blog Post ${i + 1}`,
      slug: `blog-post-${i + 1}`,
      content: `This is the content for blog post ${i + 1}. Lorem ipsum dolor sit amet...`,
      excerpt: `This is a brief excerpt for blog post ${i + 1}`,
      status: ['draft', 'published', 'archived'][Math.floor(Math.random() * 3)] as const,
      featuredImage: `https://picsum.photos/800/400?random=${i}`,
      tags: ['javascript', 'typescript', 'vue', 'nuxt', 'h3'].slice(0, Math.floor(Math.random() * 3) + 1),
      category: ['web-development', 'tutorials', 'news'][Math.floor(Math.random() * 3)],
      readTime: Math.floor(Math.random() * 10) + 1,
      viewCount: Math.floor(Math.random() * 1000),
      publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: crypto.randomUUID(),
        username: `user${Math.floor(Math.random() * 10) + 1}`,
        firstName: 'John',
        lastName: 'Doe',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`
      }
    }))

    // Apply filters
    let filteredPosts = mockPosts

    if (query.status) {
      filteredPosts = filteredPosts.filter(post => post.status === query.status)
    }

    if (query.tag) {
      filteredPosts = filteredPosts.filter(post => 
        post.tags.includes(query.tag!)
      )
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase()
      filteredPosts = filteredPosts.filter(post =>
        post.title.toLowerCase().includes(searchLower) ||
        post.content.toLowerCase().includes(searchLower)
      )
    }

    // Paginate
    const total = filteredPosts.length
    const totalPages = Math.ceil(total / query.limit)
    const startIndex = (query.page - 1) * query.limit
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + query.limit)

    // Create semantic response using UnJucks
    const response = await event.context.createSemanticResponse('Post', paginatedPosts, {
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages
      },
      filters: {
        status: query.status,
        tag: query.tag,
        search: query.search
      }
    })

    return JSON.parse(response)

  } catch (error) {
    const errorResponse = await event.context.createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch posts',
      400
    )
    
    setResponseStatus(event, 400)
    return JSON.parse(errorResponse)
  }
})