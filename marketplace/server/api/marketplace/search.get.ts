import { z } from 'zod'
import { SearchFiltersSchema, SearchResultsSchema } from '~/types/marketplace'
import type { SearchResults, MarketplaceItemUnion } from '~/types/marketplace'

// Mock data for development - replace with actual database queries
const mockItems: MarketplaceItemUnion[] = [
  {
    id: '1',
    name: 'Vue CLI Template',
    description: 'A modern Vue.js CLI application template with TypeScript, Tailwind CSS, and Vite',
    version: '1.2.0',
    author: { name: 'John Doe', email: 'john@example.com' },
    keywords: ['vue', 'typescript', 'tailwind', 'vite'],
    license: 'MIT',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-10'),
    downloads: 15420,
    rating: 4.8,
    verified: true,
    type: 'template',
    category: 'web',
    files: [
      { path: 'package.json', content: '{}', type: 'file' },
      { path: 'src/', content: '', type: 'directory' }
    ]
  },
  {
    id: '2',
    name: 'Auth Plugin',
    description: 'Simple authentication plugin with JWT support for CLI applications',
    version: '2.1.5',
    author: { name: 'Jane Smith' },
    keywords: ['auth', 'jwt', 'security'],
    license: 'Apache-2.0',
    createdAt: new Date('2023-11-20'),
    updatedAt: new Date('2024-02-28'),
    downloads: 8930,
    rating: 4.5,
    verified: true,
    type: 'plugin',
    category: 'authentication',
    hooks: ['before:command', 'after:command']
  },
  {
    id: '3',
    name: 'CI/CD Workflow',
    description: 'Complete GitHub Actions workflow for Node.js applications with testing and deployment',
    version: '1.0.3',
    author: { name: 'DevOps Team', url: 'https://github.com/devops' },
    keywords: ['cicd', 'github', 'actions', 'deployment'],
    license: 'MIT',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-03-15'),
    downloads: 5670,
    rating: 4.9,
    verified: false,
    type: 'workflow',
    category: 'ci-cd',
    steps: [
      { name: 'Install dependencies', command: 'npm', args: ['install'] },
      { name: 'Run tests', command: 'npm', args: ['test'] },
      { name: 'Build', command: 'npm', args: ['run', 'build'] }
    ]
  },
  {
    id: '4',
    name: 'Dark Theme',
    description: 'Professional dark theme for CLI applications',
    version: '1.1.0',
    author: { name: 'UI Designer' },
    keywords: ['theme', 'dark', 'ui'],
    license: 'MIT',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-02-20'),
    downloads: 3240,
    rating: 4.3,
    verified: true,
    type: 'theme',
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      accent: '#10b981',
      background: '#1f2937',
      foreground: '#f9fafb'
    }
  }
]

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    
    // Validate query parameters
    const filters = SearchFiltersSchema.parse({
      query: query.query || '',
      type: query.type || 'all',
      category: query.category || undefined,
      author: query.author || undefined,
      verified: query.verified === 'true' ? true : undefined,
      minRating: query.minRating ? Number(query.minRating) : undefined,
      sortBy: query.sortBy || 'downloads',
      sortOrder: query.sortOrder || 'desc',
      limit: query.limit ? Number(query.limit) : 20,
      offset: query.offset ? Number(query.offset) : 0,
    })
    
    // Filter items based on search criteria
    let filteredItems = [...mockItems]
    
    // Text search
    if (filters.query) {
      const searchTerm = filters.query.toLowerCase()
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm)) ||
        item.author.name.toLowerCase().includes(searchTerm)
      )
    }
    
    // Type filter
    if (filters.type && filters.type !== 'all') {
      filteredItems = filteredItems.filter(item => item.type === filters.type)
    }
    
    // Category filter
    if (filters.category) {
      filteredItems = filteredItems.filter(item => {
        if ('category' in item) {
          return item.category === filters.category
        }
        return false
      })
    }
    
    // Author filter
    if (filters.author) {
      filteredItems = filteredItems.filter(item => 
        item.author.name.toLowerCase().includes(filters.author!.toLowerCase())
      )
    }
    
    // Verified filter
    if (filters.verified !== undefined) {
      filteredItems = filteredItems.filter(item => item.verified === filters.verified)
    }
    
    // Rating filter
    if (filters.minRating !== undefined) {
      filteredItems = filteredItems.filter(item => item.rating >= filters.minRating!)
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'downloads'
    const sortOrder = filters.sortOrder || 'desc'
    
    filteredItems.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'downloads':
          aValue = a.downloads
          bValue = b.downloads
          break
        case 'rating':
          aValue = a.rating
          bValue = b.rating
          break
        case 'created':
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
          break
        case 'updated':
          aValue = a.updatedAt.getTime()
          bValue = b.updatedAt.getTime()
          break
        default:
          aValue = a.downloads
          bValue = b.downloads
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
    
    // Pagination
    const total = filteredItems.length
    const paginatedItems = filteredItems.slice(filters.offset, filters.offset + filters.limit)
    const hasMore = filters.offset + filters.limit < total
    
    const results: SearchResults = {
      items: paginatedItems,
      total,
      hasMore,
      filters
    }
    
    return results
    
  } catch (error) {
    console.error('Search API error:', error)
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query parameters',
        data: error.errors
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})