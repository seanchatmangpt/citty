/**
 * 🧠 DARK MATTER: Natural Language Engine Tests
 * Comprehensive tests for Qwen3:8b integration with mocked Ollama provider
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { Store } from 'n3'
import { 
  naturalLanguageEngine,
  askNaturalLanguage,
  chatWithData,
  explainSemanticData,
  suggestDataQueries,
  type OllamaProvider 
} from '../packages/untology/src/natural-language-engine'
import { setOntologyContext } from '../packages/untology/src/context'

// Mock Ollama Provider for testing
class MockOllamaProvider implements OllamaProvider {
  private responseOverrides: Map<string, string> = new Map()
  
  setResponseOverride(promptKeyword: string, response: string): void {
    this.responseOverrides.set(promptKeyword.toLowerCase(), response)
  }
  
  async generateText(options: {
    model: string
    prompt: string
    system?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ text: string }> {
    
    const prompt = options.prompt.toLowerCase()
    
    // Check for custom overrides first
    for (const [keyword, response] of this.responseOverrides) {
      if (prompt.includes(keyword)) {
        return { text: response }
      }
    }
    
    // Default Qwen3:8b-style responses for testing
    if (prompt.includes('sparql query:')) {
      if (prompt.includes('products')) {
        return { text: 'SELECT ?product ?name ?price WHERE { ?product a :Product ; :hasName ?name ; :hasPrice ?price } ORDER BY ?price' }
      }
      if (prompt.includes('count')) {
        return { text: 'SELECT (COUNT(?product) as ?count) WHERE { ?product a :Product }' }
      }
      if (prompt.includes('expensive') || prompt.includes('highest price')) {
        return { text: 'SELECT ?product ?name ?price WHERE { ?product a :Product ; :hasName ?name ; :hasPrice ?price } ORDER BY DESC(?price) LIMIT 5' }
      }
      return { text: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10' }
    }
    
    if (prompt.includes('natural language answer')) {
      if (prompt.includes('5 items') || prompt.includes('5 products')) {
        return { text: 'I found 5 products in the catalog: Gaming Laptop Pro ($999), Smartphone X ($699), Running Shoes Ultra ($89), Smart Coffee Maker ($79), and Wireless Gaming Mouse ($29). These span across Electronics, Sports, and Kitchen categories.' }
      }
      if (prompt.includes('count: 5')) {
        return { text: 'There are 5 products total in the catalog across Electronics, Kitchen, and Sports categories.' }
      }
      return { text: 'Based on the query results, I can provide information about the products in the catalog.' }
    }
    
    if (prompt.includes('analyze this rdf data')) {
      return {
        text: 'This RDF dataset represents a product catalog with 5 products across 3 categories (Electronics, Kitchen, Sports). Each product has properties for name, price, and category classification. The data follows semantic web standards with proper RDF typing and relationships.'
      }
    }
    
    if (prompt.includes('suggest') && prompt.includes('questions')) {
      return {
        text: '- What are the most expensive products?\n- Which products cost less than $100?\n- How many products are in each category?\n- What electronics are available?\n- Show me kitchen products'
      }
    }
    
    if (prompt.includes('user:') && prompt.includes('assistant:')) {
      if (prompt.includes('hello') || prompt.includes('help')) {
        return { text: 'Hello! I can help you explore the product catalog. I can answer questions about products, prices, categories, and provide recommendations based on the semantic data available.' }
      }
      return { text: 'I understand. How can I help you with the product data?' }
    }
    
    // Default response
    return { text: 'I can help you analyze the semantic data and answer questions about the products.' }
  }
}

describe('Natural Language Engine', () => {
  let mockProvider: MockOllamaProvider
  
  beforeEach(async () => {
    // Setup test data
    const store = new Store()
    
    // Add sample product data
    const products = [
      { id: 1, name: 'Gaming Laptop Pro', price: 999, category: 'Electronics' },
      { id: 2, name: 'Wireless Gaming Mouse', price: 29, category: 'Electronics' },
      { id: 3, name: 'Smart Coffee Maker', price: 79, category: 'Kitchen' },
      { id: 4, name: 'Running Shoes Ultra', price: 89, category: 'Sports' },
      { id: 5, name: 'Smartphone X', price: 699, category: 'Electronics' }
    ]

    for (const product of products) {
      store.addQuads([
        { 
          subject: { termType: 'NamedNode', value: `:Product${product.id}` },
          predicate: { termType: 'NamedNode', value: 'rdf:type' },
          object: { termType: 'NamedNode', value: ':Product' },
          graph: { termType: 'DefaultGraph', value: '' }
        },
        {
          subject: { termType: 'NamedNode', value: `:Product${product.id}` },
          predicate: { termType: 'NamedNode', value: ':hasName' },
          object: { termType: 'Literal', value: product.name },
          graph: { termType: 'DefaultGraph', value: '' }
        },
        {
          subject: { termType: 'NamedNode', value: `:Product${product.id}` },
          predicate: { termType: 'NamedNode', value: ':hasPrice' },
          object: { termType: 'Literal', value: product.price.toString() },
          graph: { termType: 'DefaultGraph', value: '' }
        },
        {
          subject: { termType: 'NamedNode', value: `:Product${product.id}` },
          predicate: { termType: 'NamedNode', value: ':inCategory' },
          object: { termType: 'NamedNode', value: `:${product.category}` },
          graph: { termType: 'DefaultGraph', value: '' }
        }
      ] as any)
    }

    setOntologyContext({
      store,
      prefixes: {
        '': 'http://example.com/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
      },
      options: {}
    })

    // Setup mock provider
    mockProvider = new MockOllamaProvider()
    naturalLanguageEngine.setOllamaProvider(mockProvider)
    naturalLanguageEngine.setDefaultModel('qwen3:8b')
  })

  afterEach(() => {
    // Reset any mocks
    vi.clearAllMocks()
  })

  describe('Basic Configuration', () => {
    test('should use qwen3:8b as default model', () => {
      expect(naturalLanguageEngine['defaultModel']).toBe('qwen3:8b')
    })

    test('should generate context window from RDF data', () => {
      const contextWindow = naturalLanguageEngine.getContextWindow()
      
      expect(contextWindow).toContain('@prefix')
      expect(contextWindow).toContain(':Product1')
      expect(contextWindow).toContain('Gaming Laptop Pro')
      expect(contextWindow).toContain(':hasPrice')
      expect(contextWindow).toContain('999')
    })

    test('should handle context window size limits', () => {
      naturalLanguageEngine.setMaxContextSize(1000)
      const contextWindow = naturalLanguageEngine.getContextWindow()
      
      // Should still contain data but potentially truncated
      expect(contextWindow.length).toBeGreaterThan(0)
      expect(contextWindow).toContain('@prefix')
    })
  })

  describe('Natural Language Queries', () => {
    test('should process basic product questions', async () => {
      const response = await askNaturalLanguage('What products are available?')
      
      expect(response).toBeDefined()
      expect(response.answer).toContain('products')
      expect(response.sparqlQuery).toContain('SELECT')
      expect(response.sparqlQuery).toContain('?product')
      expect(response.confidence).toBeGreaterThan(0.5)
      expect(response.reasoning).toHaveLength.greaterThan(0)
    })

    test('should handle count queries', async () => {
      const response = await askNaturalLanguage('How many products do you have?')
      
      expect(response.sparqlQuery).toContain('COUNT')
      expect(response.sparqlQuery).toContain('?product')
      expect(response.confidence).toBeGreaterThan(0.5)
    })

    test('should generate appropriate SPARQL for expensive products', async () => {
      const response = await askNaturalLanguage('What are the most expensive products?')
      
      expect(response.sparqlQuery).toContain('ORDER BY DESC(?price)')
      expect(response.sparqlQuery).toContain('LIMIT')
      expect(response.confidence).toBeGreaterThan(0.5)
    })

    test('should handle queries with custom model and temperature', async () => {
      const response = await askNaturalLanguage('Show me all products', {
        model: 'qwen3:8b',
        temperature: 0.2,
        includeContext: true
      })
      
      expect(response.turtleContext).toBeDefined()
      expect(response.turtleContext).toContain('@prefix')
    })

    test('should handle failed SPARQL generation gracefully', async () => {
      mockProvider.setResponseOverride('invalid query', 'NO_QUERY')
      
      const response = await askNaturalLanguage('Invalid query that cannot be parsed')
      
      expect(response.sparqlQuery).toBeUndefined()
      expect(response.confidence).toBeLessThan(0.5)
      expect(response.answer).toContain('analyze')
    })
  })

  describe('Conversational Interface', () => {
    test('should handle basic conversation', async () => {
      const response = await chatWithData('Hello, can you help me with the product data?')
      
      expect(response).toContain('help')
      expect(response).toContain('product')
    })

    test('should maintain conversation history', async () => {
      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]
      
      const response = await chatWithData('What products do you have?', history)
      
      expect(response).toBeDefined()
      expect(typeof response).toBe('string')
    })

    test('should handle conversation with custom options', async () => {
      const response = await naturalLanguageEngine.chat(
        'Recommend something for tech enthusiasts',
        [],
        { model: 'qwen3:8b', temperature: 0.8 }
      )
      
      expect(response).toBeDefined()
      expect(typeof response).toBe('string')
    })
  })

  describe('Data Exploration', () => {
    test('should explain data structure', async () => {
      const explanation = await explainSemanticData()
      
      expect(explanation).toContain('product')
      expect(explanation).toContain('catalog')
      expect(explanation.length).toBeGreaterThan(50)
    })

    test('should generate query suggestions', async () => {
      const suggestions = await suggestDataQueries(5)
      
      expect(suggestions).toHaveLength(5)
      suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string')
        expect(suggestion.length).toBeGreaterThan(10)
      })
    })

    test('should generate custom number of suggestions', async () => {
      const suggestions = await suggestDataQueries(3)
      
      expect(suggestions).toHaveLength(3)
    })
  })

  describe('Error Handling', () => {
    test('should throw error when no Ollama provider is set', async () => {
      const newEngine = new (naturalLanguageEngine.constructor as any)()
      
      await expect(newEngine.query({ query: 'test' }))
        .rejects.toThrow('Ollama provider not configured')
    })

    test('should handle Ollama provider errors gracefully', async () => {
      const errorProvider: OllamaProvider = {
        generateText: async () => {
          throw new Error('Network error')
        }
      }
      
      const newEngine = new (naturalLanguageEngine.constructor as any)()
      newEngine.setOllamaProvider(errorProvider)
      
      const response = await newEngine.query({ query: 'test query' })
      
      expect(response.success).toBeFalsy()
      expect(response.confidence).toBeLessThan(0.5)
      expect(response.reasoning).toContain('Failed to generate SPARQL')
    })

    test('should validate SPARQL queries', async () => {
      mockProvider.setResponseOverride('sparql query:', 'INVALID SPARQL SYNTAX')
      
      const response = await askNaturalLanguage('Test invalid SPARQL generation')
      
      expect(response.sparqlQuery).toBeUndefined()
      expect(response.confidence).toBeLessThan(0.5)
    })
  })

  describe('Context Window Management', () => {
    test('should update context window automatically', async () => {
      const initialContext = naturalLanguageEngine.getContextWindow()
      expect(initialContext).toContain('Gaming Laptop Pro')
      
      // Context should be automatically updated
      await askNaturalLanguage('Test query')
      
      const updatedContext = naturalLanguageEngine.getContextWindow()
      expect(updatedContext).toContain('Gaming Laptop Pro')
    })

    test('should respect max context size', () => {
      naturalLanguageEngine.setMaxContextSize(500)
      
      const context = naturalLanguageEngine.getContextWindow()
      expect(context.length).toBeGreaterThan(0)
      // Context should be limited but still functional
    })
  })

  describe('Integration with Dark Matter Features', () => {
    test('should work with error recovery system', async () => {
      const { safeExecute } = await import('../packages/untology/src/error-recovery')
      
      const result = await safeExecute('nl-test', async () => {
        return await askNaturalLanguage('What products are available?')
      })
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.answer).toContain('products')
    })

    test('should integrate with security validation', async () => {
      const { validateInput } = await import('../packages/unjucks/src/security-hardening')
      
      const userQuery = 'What are the most expensive products?'
      const validation = await validateInput(userQuery, 'nl-query')
      
      expect(validation.valid).toBe(true)
      
      const response = await askNaturalLanguage(userQuery)
      expect(response).toBeDefined()
    })
  })

  describe('Production Readiness', () => {
    test('should handle concurrent queries', async () => {
      const queries = [
        'What products are available?',
        'How many products do you have?',
        'What are the most expensive products?',
        'Show me electronics',
        'Count kitchen products'
      ]
      
      const promises = queries.map(query => askNaturalLanguage(query))
      const responses = await Promise.all(promises)
      
      responses.forEach(response => {
        expect(response).toBeDefined()
        expect(response.answer).toBeDefined()
        expect(response.confidence).toBeGreaterThan(0)
      })
    })

    test('should maintain performance with large context', async () => {
      // Add more data to test scalability
      naturalLanguageEngine.setMaxContextSize(64000)
      
      const startTime = Date.now()
      const response = await askNaturalLanguage('What products are available?')
      const endTime = Date.now()
      
      expect(response).toBeDefined()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete quickly with mocks
    })

    test('should provide comprehensive response structure', async () => {
      const response = await askNaturalLanguage('What are the most expensive products?', {
        includeContext: true
      })
      
      expect(response).toHaveProperty('answer')
      expect(response).toHaveProperty('sparqlQuery')
      expect(response).toHaveProperty('results')
      expect(response).toHaveProperty('confidence')
      expect(response).toHaveProperty('reasoning')
      expect(response).toHaveProperty('turtleContext')
      
      expect(Array.isArray(response.reasoning)).toBe(true)
      expect(typeof response.confidence).toBe('number')
      expect(response.confidence).toBeGreaterThanOrEqual(0)
      expect(response.confidence).toBeLessThanOrEqual(1)
    })
  })
})