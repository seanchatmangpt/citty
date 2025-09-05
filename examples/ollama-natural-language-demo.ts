/**
 * 🧠 DARK MATTER: Ollama Natural Language Demo
 * Demonstrating natural language queries with Ollama AI Provider v2
 */

import { Store } from 'n3'
import { 
  naturalLanguageEngine, 
  askNaturalLanguage, 
  chatWithData, 
  explainSemanticData,
  suggestDataQueries,
  type OllamaProvider 
} from '../packages/untology/src/natural-language-engine'
import { useOntology, setOntologyContext } from '../packages/untology/src/context'

/**
 * Mock Ollama Provider implementation
 * In real usage, this would be the actual ollama-ai-provider-v2
 */
class MockOllamaProvider implements OllamaProvider {
  async generateText(options: {
    model: string
    prompt: string
    system?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ text: string }> {
    console.log(`🤖 Ollama ${options.model} called with prompt:`)
    console.log('System:', options.system?.slice(0, 200) + '...')
    console.log('Prompt:', options.prompt.slice(0, 200) + '...')
    
    // Mock responses based on prompt content
    const prompt = options.prompt.toLowerCase()
    
    if (prompt.includes('sparql') && prompt.includes('products')) {
      return {
        text: 'SELECT ?product ?name ?price WHERE { ?product a :Product ; :hasName ?name ; :hasPrice ?price } ORDER BY ?price'
      }
    }
    
    if (prompt.includes('sparql') && prompt.includes('how many')) {
      return {
        text: 'SELECT (COUNT(?product) as ?count) WHERE { ?product a :Product }'
      }
    }
    
    if (prompt.includes('sparql') && prompt.includes('expensive')) {
      return {
        text: 'SELECT ?product ?name ?price WHERE { ?product a :Product ; :hasName ?name ; :hasPrice ?price } ORDER BY DESC(?price) LIMIT 10'
      }
    }
    
    if (prompt.includes('natural language answer')) {
      if (prompt.includes('products')) {
        return {
          text: 'I found several products in the catalog. The system contains laptops, mice, coffee makers, running shoes, and smartphones with prices ranging from $29 to $999. Would you like me to show you specific products or filter by price range?'
        }
      }
      
      if (prompt.includes('count')) {
        return {
          text: 'Based on the data, there are 5 products available in the catalog. These include electronics like laptops and smartphones, as well as other items like coffee makers and running shoes.'
        }
      }
    }
    
    if (prompt.includes('analyze and explain')) {
      return {
        text: `This RDF dataset contains information about a product catalog with the following structure:

**Entity Types:**
- Products: Main items in the catalog
- Categories: Electronics, Kitchen, Sports
- Users: Customer entities

**Key Relationships:**
- Products have names, prices, and belong to categories
- Users can purchase products
- Products are classified by type and price range

**Available Data:**
- 5 products ranging from $29-$999
- 3 main categories (Electronics, Kitchen, Sports)
- Price information and product classifications

**Example Questions You Could Ask:**
- "What are the most expensive products?"
- "How many electronics are available?"
- "Which products cost less than $100?"
- "Show me all kitchen items"`
      }
    }
    
    if (prompt.includes('suggest') && prompt.includes('questions')) {
      return {
        text: `- What are all the available products?
- Which products are the most expensive?
- How many products are in each category?
- What electronics are available under $100?
- Which products have the best value for money?`
      }
    }
    
    // General chat responses
    if (prompt.includes('user:') && prompt.includes('assistant:')) {
      if (prompt.includes('hello') || prompt.includes('hi')) {
        return {
          text: 'Hello! I can help you explore the product data. I can answer questions about products, prices, categories, and relationships in the semantic database. What would you like to know?'
        }
      }
      
      if (prompt.includes('recommend')) {
        return {
          text: 'Based on the product data, I can see you have electronics, kitchen items, and sports equipment. For electronics, the laptop and smartphone are popular choices. The coffee maker is great for kitchen use, and the running shoes are perfect for fitness. What type of product interests you most?'
        }
      }
    }
    
    return {
      text: 'I understand you want to know about the data. Let me analyze the available information and provide you with relevant details.'
    }
  }
}

/**
 * Setup sample e-commerce data for demonstration
 */
function setupSampleData(): void {
  const store = new Store()
  
  // Add sample products
  const products = [
    { id: 1, name: 'Gaming Laptop Pro', price: 999, category: 'Electronics' },
    { id: 2, name: 'Wireless Gaming Mouse', price: 29, category: 'Electronics' },
    { id: 3, name: 'Smart Coffee Maker', price: 79, category: 'Kitchen' },
    { id: 4, name: 'Running Shoes Ultra', price: 89, category: 'Sports' },
    { id: 5, name: 'Smartphone X', price: 699, category: 'Electronics' }
  ]

  // Add ontology and data triples
  const triples = [
    // Ontology
    [':Product', 'rdf:type', 'rdfs:Class'],
    [':Electronics', 'rdf:type', 'rdfs:Class'],
    [':Kitchen', 'rdf:type', 'rdfs:Class'],
    [':Sports', 'rdf:type', 'rdfs:Class'],
    [':hasName', 'rdf:type', 'rdf:Property'],
    [':hasPrice', 'rdf:type', 'rdf:Property'],
    [':inCategory', 'rdf:type', 'rdf:Property'],
  ]

  // Add product data
  for (const product of products) {
    triples.push(
      [`:Product${product.id}`, 'rdf:type', ':Product'],
      [`:Product${product.id}`, ':hasName', `"${product.name}"`],
      [`:Product${product.id}`, ':hasPrice', `${product.price}`],
      [`:Product${product.id}`, ':inCategory', `:${product.category}`]
    )
  }

  // Convert to N3 quads and add to store
  for (const [subject, predicate, object] of triples) {
    store.addQuad({
      subject: { termType: 'NamedNode', value: subject.startsWith(':') ? subject : subject },
      predicate: { termType: 'NamedNode', value: predicate },
      object: object.startsWith('"') 
        ? { termType: 'Literal', value: object.slice(1, -1) }
        : !isNaN(Number(object))
        ? { termType: 'Literal', value: object, datatype: { termType: 'NamedNode', value: 'http://www.w3.org/2001/XMLSchema#integer' } }
        : { termType: 'NamedNode', value: object },
      graph: { termType: 'DefaultGraph', value: '' }
    } as any)
  }

  // Set up ontology context
  setOntologyContext({
    store,
    prefixes: {
      '': 'http://example.com/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
    },
    options: {}
  })

  console.log('✅ Sample e-commerce data loaded')
}

/**
 * Demonstration of natural language queries
 */
async function runNaturalLanguageDemo(): Promise<void> {
  console.log('🤖 OLLAMA NATURAL LANGUAGE DEMO')
  console.log('================================')

  // Setup data and Ollama provider
  setupSampleData()
  const ollamaProvider = new MockOllamaProvider()
  naturalLanguageEngine.setOllamaProvider(ollamaProvider)
  naturalLanguageEngine.setDefaultModel('qwen3:8b')

  console.log('\n📝 Current data context window:')
  console.log(naturalLanguageEngine.getContextWindow().slice(0, 500) + '...')

  // Example 1: Basic product questions
  console.log('\n🔍 EXAMPLE 1: Basic Product Queries')
  
  const queries = [
    'What products are available?',
    'How many products do you have?',
    'What are the most expensive products?',
    'Show me electronics under $100'
  ]

  for (const query of queries) {
    console.log(`\n❓ Question: "${query}"`)
    try {
      const response = await askNaturalLanguage(query, { includeContext: false })
      console.log(`🤖 Answer: ${response.answer}`)
      console.log(`🔧 Generated SPARQL: ${response.sparqlQuery || 'None'}`)
      console.log(`📊 Results: ${response.results?.length || 0} items`)
      console.log(`📈 Confidence: ${(response.confidence * 100).toFixed(1)}%`)
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
    }
  }

  // Example 2: Conversational chat
  console.log('\n💬 EXAMPLE 2: Conversational Chat')
  
  const conversation: Array<{ role: 'user' | 'assistant', content: string }> = []
  
  const chatMessages = [
    'Hello! Can you help me understand the product data?',
    'What would you recommend for someone interested in electronics?',
    'How do the prices compare across categories?'
  ]

  for (const message of chatMessages) {
    console.log(`\n👤 User: ${message}`)
    try {
      const response = await chatWithData(message, conversation)
      console.log(`🤖 Assistant: ${response}`)
      
      // Add to conversation history
      conversation.push({ role: 'user', content: message })
      conversation.push({ role: 'assistant', content: response })
    } catch (error) {
      console.error(`❌ Chat error: ${error.message}`)
    }
  }

  // Example 3: Data exploration
  console.log('\n📊 EXAMPLE 3: Data Structure Explanation')
  try {
    const explanation = await explainSemanticData()
    console.log('🔍 Data Structure Analysis:')
    console.log(explanation)
  } catch (error) {
    console.error(`❌ Explanation error: ${error.message}`)
  }

  // Example 4: Query suggestions
  console.log('\n💡 EXAMPLE 4: Suggested Queries')
  try {
    const suggestions = await suggestDataQueries(5)
    console.log('🎯 Suggested Questions:')
    suggestions.forEach((suggestion, i) => {
      console.log(`${i + 1}. ${suggestion}`)
    })
  } catch (error) {
    console.error(`❌ Suggestions error: ${error.message}`)
  }

  // Example 5: Advanced natural language queries
  console.log('\n🚀 EXAMPLE 5: Advanced Queries')
  
  const advancedQueries = [
    'Find products that cost between $50 and $200',
    'Which category has the most products?',
    'What is the average price of electronics?',
    'Show me the cheapest item in each category'
  ]

  for (const query of advancedQueries) {
    console.log(`\n❓ Advanced Question: "${query}"`)
    try {
      const response = await askNaturalLanguage(query, { 
        temperature: 0.2, // Lower temperature for more precise queries
        model: 'qwen3:8b'
      })
      
      console.log(`🤖 Answer: ${response.answer}`)
      if (response.sparqlQuery) {
        console.log(`🔧 SPARQL: ${response.sparqlQuery}`)
      }
      if (response.results && response.results.length > 0) {
        console.log(`📊 Sample Results:`, response.results.slice(0, 3))
      }
      
      console.log(`🎯 Reasoning:`)
      response.reasoning.forEach(reason => console.log(`  - ${reason}`))
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
    }
  }

  console.log('\n🎉 NATURAL LANGUAGE DEMO COMPLETED')
  console.log('\nKey Features Demonstrated:')
  console.log('✅ Natural language to SPARQL conversion')
  console.log('✅ Turtle/RDF data in context window') 
  console.log('✅ Conversational chat with data context')
  console.log('✅ Data structure explanation')
  console.log('✅ Intelligent query suggestions')
  console.log('✅ Advanced semantic query processing')
  console.log('✅ Integration with Ollama AI Provider v2')
}

/**
 * Example of real Ollama integration setup
 */
export function setupRealOllamaProvider(): OllamaProvider {
  // This would be the actual integration with ollama-ai-provider-v2
  // npm install ollama-ai-provider-v2
  
  /*
  import { createOllama } from 'ollama-ai-provider-v2'
  
  const ollamaProvider = createOllama({
    baseURL: 'http://localhost:11434', // Default Ollama server
    // Additional configuration options
  })
  
  // Wrap in our interface
  return {
    async generateText(options) {
      const result = await ollamaProvider.generateText({
        model: options.model,
        prompt: options.prompt,
        system: options.system,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      })
      
      return { text: result.text }
    }
  }
  */
  
  throw new Error('Real Ollama provider setup requires ollama-ai-provider-v2 package')
}

// Export the demo for external usage
export { runNaturalLanguageDemo }

// Run demo if called directly
if (require.main === module) {
  runNaturalLanguageDemo()
    .then(() => {
      console.log('\n✅ Demo completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error)
      process.exit(1)
    })
}