import type { MarketplaceItemUnion, ItemType } from '~/types/marketplace'

// Mock featured items - in production, these would be curated or algorithm-selected
const featuredItems: MarketplaceItemUnion[] = [
  {
    id: 'featured-1',
    name: 'React TypeScript Starter',
    description: 'Production-ready React application template with TypeScript, testing, and CI/CD setup',
    version: '2.0.0',
    author: { name: 'React Team', url: 'https://github.com/reactteam' },
    repository: 'https://github.com/reactteam/react-typescript-starter',
    keywords: ['react', 'typescript', 'starter', 'template', 'production'],
    license: 'MIT',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-03-20'),
    downloads: 25340,
    rating: 4.9,
    verified: true,
    type: 'template',
    category: 'web',
    files: [],
    dependencies: {
      'react': '^18.0.0',
      'react-dom': '^18.0.0'
    },
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/react': '^18.0.0'
    }
  },
  {
    id: 'featured-2',
    name: 'Logger Plugin Pro',
    description: 'Advanced logging plugin with multiple output formats and log rotation',
    version: '1.5.2',
    author: { name: 'Logger Inc', email: 'support@logger.dev' },
    repository: 'https://github.com/logger-inc/citty-logger-pro',
    keywords: ['logging', 'debug', 'monitoring', 'analytics'],
    license: 'MIT',
    createdAt: new Date('2023-12-10'),
    updatedAt: new Date('2024-03-18'),
    downloads: 18750,
    rating: 4.7,
    verified: true,
    type: 'plugin',
    category: 'logging',
    hooks: ['before:command', 'after:command', 'on:error'],
    commands: ['log:config', 'log:export', 'log:clear']
  },
  {
    id: 'featured-3',
    name: 'Full-Stack Deployment Pipeline',
    description: 'Complete deployment workflow for full-stack applications with Docker and Kubernetes',
    version: '1.3.0',
    author: { name: 'DevOps Masters', url: 'https://devops-masters.com' },
    keywords: ['deployment', 'docker', 'kubernetes', 'fullstack', 'pipeline'],
    license: 'Apache-2.0',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-03-25'),
    downloads: 12890,
    rating: 4.8,
    verified: true,
    type: 'workflow',
    category: 'deployment',
    steps: [
      { name: 'Build Docker image', command: 'docker', args: ['build', '-t', 'app', '.'] },
      { name: 'Run tests', command: 'docker', args: ['run', 'app', 'npm', 'test'] },
      { name: 'Deploy to K8s', command: 'kubectl', args: ['apply', '-f', 'k8s/'] }
    ],
    environment: {
      'DOCKER_REGISTRY': 'registry.hub.docker.com',
      'K8S_NAMESPACE': 'production'
    }
  },
  {
    id: 'featured-4',
    name: 'Neon Theme Collection',
    description: 'Vibrant neon-inspired theme collection with customizable color schemes',
    version: '1.0.8',
    author: { name: 'UI Artists', url: 'https://ui-artists.co' },
    keywords: ['theme', 'neon', 'colorful', 'ui', 'design'],
    license: 'Creative Commons',
    createdAt: new Date('2024-02-14'),
    updatedAt: new Date('2024-03-14'),
    downloads: 8420,
    rating: 4.6,
    verified: true,
    type: 'theme',
    colors: {
      primary: '#ff0080',
      secondary: '#00ff80',
      accent: '#8000ff',
      background: '#0a0a0a',
      foreground: '#ffffff'
    },
    typography: {
      fontFamily: 'JetBrains Mono',
      fontSize: '14px',
      fontWeight: '500'
    }
  },
  {
    id: 'featured-5',
    name: 'API Documentation Generator',
    description: 'Automatically generate beautiful API documentation from your CLI commands and schemas',
    version: '3.2.1',
    author: { name: 'DocGen Team' },
    repository: 'https://github.com/docgen/citty-api-docs',
    keywords: ['documentation', 'api', 'generator', 'cli', 'swagger'],
    license: 'MIT',
    createdAt: new Date('2023-10-15'),
    updatedAt: new Date('2024-03-22'),
    downloads: 31200,
    rating: 4.9,
    verified: true,
    type: 'template',
    category: 'cli',
    files: [],
    cittyConfig: {
      commands: ['docs:generate', 'docs:serve', 'docs:deploy'],
      middleware: ['docs-middleware'],
      plugins: ['swagger-plugin']
    }
  },
  {
    id: 'featured-6',
    name: 'Testing Automation Suite',
    description: 'Comprehensive testing workflow with unit, integration, and e2e testing capabilities',
    version: '2.4.0',
    author: { name: 'Test Automation Co', email: 'info@testautomation.co' },
    keywords: ['testing', 'automation', 'e2e', 'integration', 'unit'],
    license: 'MIT',
    createdAt: new Date('2023-11-30'),
    updatedAt: new Date('2024-03-19'),
    downloads: 16540,
    rating: 4.8,
    verified: true,
    type: 'workflow',
    category: 'testing',
    steps: [
      { name: 'Install dependencies', command: 'npm', args: ['ci'] },
      { name: 'Run unit tests', command: 'npm', args: ['run', 'test:unit'] },
      { name: 'Run integration tests', command: 'npm', args: ['run', 'test:integration'] },
      { name: 'Run e2e tests', command: 'npm', args: ['run', 'test:e2e'] },
      { name: 'Generate coverage report', command: 'npm', args: ['run', 'coverage'] }
    ],
    triggers: ['on:push', 'on:pull_request']
  }
]

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const type = query.type as ItemType | undefined
    
    let results = [...featuredItems]
    
    // Filter by type if specified
    if (type && type !== 'all') {
      results = results.filter(item => item.type === type)
    }
    
    // Limit to 6 featured items by default
    const limit = query.limit ? Math.min(Number(query.limit), 20) : 6
    results = results.slice(0, limit)
    
    // Sort by rating and downloads for featured items
    results.sort((a, b) => {
      // Primary sort by rating (highest first)
      if (b.rating !== a.rating) {
        return b.rating - a.rating
      }
      // Secondary sort by downloads (highest first)
      return b.downloads - a.downloads
    })
    
    return results
    
  } catch (error) {
    console.error('Featured API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch featured items'
    })
  }
})