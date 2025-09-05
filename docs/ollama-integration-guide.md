# 🤖 Ollama Natural Language Integration Guide

## Overview

The Natural Language Engine provides a powerful interface for querying semantic RDF/Turtle data using natural language, powered by [Ollama AI Provider v2](https://github.com/nordwestt/ollama-ai-provider-v2). This integration allows users to ask questions in plain English and get intelligent responses based on their semantic data.

## 🚀 Key Features

- **Natural Language to SPARQL**: Automatically converts questions to executable SPARQL queries
- **Context-Aware Responses**: Provides Turtle/RDF data as context to the LLM
- **Conversational Interface**: Maintains chat history for follow-up questions
- **Data Exploration**: Explains data structure and suggests interesting queries
- **Multiple Models**: Support for different Ollama models (Llama 3.1, Codellama, etc.)
- **Error Recovery**: Graceful handling of query generation failures

## 📦 Installation

```bash
# Install the Ollama AI Provider v2
npm install ollama-ai-provider-v2

# Make sure Ollama is running locally
# Download from: https://ollama.ai
ollama serve

# Pull the default model (Qwen3)
ollama pull qwen3:8b
```

## 🔧 Basic Setup

### 1. Configure Ollama Provider

```typescript
import { createOllama } from 'ollama-ai-provider-v2'
import { naturalLanguageEngine, type OllamaProvider } from 'untology'

// Create Ollama provider instance
const ollamaProvider = createOllama({
  baseURL: 'http://localhost:11434', // Default Ollama server
  // Additional configuration options
})

// Wrap in our interface
const provider: OllamaProvider = {
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

// Set the provider
naturalLanguageEngine.setOllamaProvider(provider)
naturalLanguageEngine.setDefaultModel('qwen3:8b')
```

### 2. Load Your Semantic Data

```typescript
import { Store } from 'n3'
import { setOntologyContext } from 'untology'

// Create and populate your RDF store
const store = new Store()

// Add your RDF/Turtle data
store.addQuads([
  // Your semantic data quads here
])

// Set the ontology context
setOntologyContext({
  store,
  prefixes: {
    '': 'http://example.com/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    foaf: 'http://xmlns.com/foaf/0.1/'
  },
  options: {}
})
```

## 🎯 Usage Examples

### Simple Natural Language Queries

```typescript
import { askNaturalLanguage } from 'untology'

// Ask questions in natural language
const response = await askNaturalLanguage('What products are available?')

console.log('Answer:', response.answer)
console.log('Generated SPARQL:', response.sparqlQuery)
console.log('Results:', response.results)
console.log('Confidence:', response.confidence)
```

### Conversational Interface

```typescript
import { chatWithData } from 'untology'

const conversation = []

// Start a conversation
let response = await chatWithData(
  'Hello! Can you help me explore the product data?', 
  conversation
)
console.log('Assistant:', response)

// Add to conversation history
conversation.push({ role: 'user', content: 'Hello! Can you help me explore the product data?' })
conversation.push({ role: 'assistant', content: response })

// Continue conversation
response = await chatWithData(
  'What are the most expensive products?',
  conversation
)
console.log('Assistant:', response)
```

### Data Exploration

```typescript
import { explainSemanticData, suggestDataQueries } from 'untology'

// Get explanation of your data structure
const explanation = await explainSemanticData()
console.log('Data Structure:', explanation)

// Get suggested queries
const suggestions = await suggestDataQueries(5)
console.log('Suggested Questions:')
suggestions.forEach((suggestion, i) => {
  console.log(`${i + 1}. ${suggestion}`)
})
```

### Advanced Configuration

```typescript
import { naturalLanguageEngine } from 'untology'

// Configure the engine
naturalLanguageEngine.setMaxContextSize(32000) // Adjust token limit
naturalLanguageEngine.setDefaultModel('llama3.1:70b') // Use larger model

// Query with specific options
const response = await askNaturalLanguage('Complex question about the data', {
  model: 'codellama:13b', // Use code-specialized model
  temperature: 0.1, // Lower temperature for more focused answers
  includeContext: true // Include full turtle context in response
})
```

## 🏗️ How It Works

### 1. Context Window Management

The engine automatically converts your RDF store to Turtle format and provides it as context to the LLM:

```turtle
@prefix : <http://example.com/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Product1 rdf:type :Product ;
    :hasName "Gaming Laptop Pro" ;
    :hasPrice 999 ;
    :inCategory :Electronics .

:Product2 rdf:type :Product ;
    :hasName "Wireless Mouse" ;
    :hasPrice 29 ;
    :inCategory :Electronics .
```

### 2. SPARQL Generation

The LLM analyzes the question and data structure to generate appropriate SPARQL:

```sparql
SELECT ?product ?name ?price WHERE {
    ?product rdf:type :Product ;
             :hasName ?name ;
             :hasPrice ?price .
} ORDER BY DESC(?price)
```

### 3. Query Execution & Response

The generated SPARQL is executed against your RDF store, and results are converted back to natural language.

## 🎨 Real-World Example: E-commerce Product Catalog

```typescript
import { Store } from 'n3'
import { 
  setOntologyContext, 
  askNaturalLanguage, 
  naturalLanguageEngine 
} from 'untology'

// Setup product catalog data
const store = new Store()

// Add products with semantic structure
const products = [
  { id: 1, name: 'Gaming Laptop Pro', price: 999, category: 'Electronics' },
  { id: 2, name: 'Wireless Mouse', price: 29, category: 'Electronics' },
  { id: 3, name: 'Coffee Maker', price: 79, category: 'Kitchen' },
  { id: 4, name: 'Running Shoes', price: 89, category: 'Sports' }
]

// Convert to RDF triples
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

// Configure ontology
setOntologyContext({ store, prefixes: { /* your prefixes */ }, options: {} })

// Setup Ollama (assuming provider is configured)
naturalLanguageEngine.setOllamaProvider(ollamaProvider)

// Now ask natural language questions!
const examples = [
  'What products do you have?',
  'Show me electronics under $100',
  'What is the most expensive item?',
  'How many products are in each category?',
  'Which products would you recommend for a home office?'
]

for (const question of examples) {
  const response = await askNaturalLanguage(question)
  console.log(`Q: ${question}`)
  console.log(`A: ${response.answer}`)
  console.log(`Generated SPARQL: ${response.sparqlQuery}`)
  console.log('---')
}
```

## 🔧 Model Recommendations

### For Development & Testing
- **llama3.1:8b** - Good balance of speed and capability
- **llama3.2:3b** - Faster, lighter model for simple queries

### For Production
- **llama3.1:70b** - Higher accuracy for complex queries
- **codellama:13b** - Better for SPARQL generation
- **mixtral:8x7b** - Good performance with reasonable resource usage

### For Specialized Use Cases
- **nous-hermes2:34b** - Excellent instruction following
- **wizardcoder:15b** - Specialized for code/query generation
- **deepseek-coder:33b** - Advanced code understanding

## 📊 Performance Considerations

### Context Window Management
```typescript
// Adjust context size based on your data volume
naturalLanguageEngine.setMaxContextSize(16000) // Smaller for faster processing
naturalLanguageEngine.setMaxContextSize(64000) // Larger for complex data
```

### Temperature Settings
```typescript
// For precise SPARQL generation
const response = await askNaturalLanguage(question, { temperature: 0.1 })

// For creative explanations
const response = await askNaturalLanguage(question, { temperature: 0.7 })
```

### Model Selection
```typescript
// Use different models for different tasks
await askNaturalLanguage('Generate SPARQL for complex query', { 
  model: 'codellama:13b' 
})

await askNaturalLanguage('Explain this data in simple terms', { 
  model: 'llama3.1:8b' 
})
```

## 🛠️ Troubleshooting

### Common Issues

1. **Ollama Not Running**
   ```bash
   # Start Ollama service
   ollama serve
   
   # Check if model is available
   ollama list
   ```

2. **Model Not Found**
   ```bash
   # Pull the required model
   ollama pull llama3.1:8b
   ```

3. **Context Too Large**
   ```typescript
   // Reduce context size
   naturalLanguageEngine.setMaxContextSize(16000)
   ```

4. **Poor SPARQL Generation**
   ```typescript
   // Use lower temperature for more precise queries
   // Try code-specialized models like codellama
   const response = await askNaturalLanguage(question, {
     model: 'codellama:13b',
     temperature: 0.1
   })
   ```

### Debug Information

```typescript
// Get current context window
const context = naturalLanguageEngine.getContextWindow()
console.log('Current context:', context.slice(0, 500))

// Check if provider is configured
try {
  const response = await askNaturalLanguage('test query')
  console.log('Provider working:', !!response)
} catch (error) {
  console.log('Provider error:', error.message)
}
```

## 🔒 Security Considerations

The natural language engine integrates with the existing security hardening system:

```typescript
import { validateInput } from 'unjucks'

// User inputs are automatically validated
const userQuestion = "What products cost more than $50?"

// Security validation happens automatically
const securityResult = await validateInput(userQuestion, 'nl-query')
if (!securityResult.valid) {
  console.log('Security issues:', securityResult.errors)
}
```

## 🚀 Integration with Other Dark Matter Features

### With Error Recovery
```typescript
import { safeExecute } from 'untology'

const response = await safeExecute('nl-query', async () => {
  return await askNaturalLanguage('Complex question about data')
})

if (!response.success) {
  console.log('Fallback used:', response.recoveryUsed)
}
```

### With Performance Monitoring
```typescript
import { measurePerformance } from 'unjucks'

const { result, metrics } = await measurePerformance(
  'natural-language-query',
  () => askNaturalLanguage('What are the trends in the data?')
)

console.log('Query took:', metrics.duration, 'ms')
```

### With Debug Tooling
```typescript
import { recordDebugOperation } from 'untology'

const operationId = recordDebugOperation(
  'query',
  'natural-language',
  { question: userQuestion },
  response
)
```

## 📈 Best Practices

1. **Structure Your Data Well**
   - Use meaningful property names
   - Include rdfs:labels for human-readable names
   - Organize with clear ontological structure

2. **Optimize Context**
   - Keep context size reasonable for your model
   - Include relevant prefixes and namespaces
   - Consider data relevance for the query domain

3. **Model Selection**
   - Use code-specialized models for SPARQL generation
   - Use general models for explanatory responses
   - Consider resource constraints vs accuracy needs

4. **Error Handling**
   - Always check response.confidence scores
   - Implement fallbacks for low-confidence responses
   - Validate generated SPARQL before execution

5. **User Experience**
   - Provide suggested questions to guide users
   - Explain data structure to help users understand capabilities
   - Use conversational context for follow-up questions

## 🎯 Advanced Use Cases

### Multi-Domain Knowledge Graphs
```typescript
// Handle queries across different knowledge domains
const response = await askNaturalLanguage(
  'How do product sales relate to customer demographics?',
  { model: 'llama3.1:70b', temperature: 0.2 }
)
```

### Temporal Queries
```typescript
// Handle time-based questions
const response = await askNaturalLanguage(
  'What products were added in the last month?'
)
```

### Aggregation and Analytics
```typescript
// Complex analytical questions
const response = await askNaturalLanguage(
  'What is the average price by category and how has it changed over time?'
)
```

## 🔮 Future Enhancements

- **Multi-modal Support**: Integration with vision models for image analysis
- **Tool Calling**: Allow the LLM to call specific functions for complex operations
- **Streaming Responses**: Real-time response generation for better UX
- **Custom Prompting**: Domain-specific prompt templates
- **Query Optimization**: Learn from successful queries to improve generation

---

The Natural Language Engine transforms your semantic RDF data into an intuitive, conversational interface that makes complex data accessible to non-technical users while maintaining the power and precision of SPARQL for technical applications.

## 📚 API Reference

### Core Functions

```typescript
// Main query function
askNaturalLanguage(
  question: string, 
  options?: Partial<NaturalLanguageQuery>
): Promise<NaturalLanguageResponse>

// Conversational interface
chatWithData(
  message: string,
  history?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<string>

// Data exploration
explainSemanticData(): Promise<string>
suggestDataQueries(count?: number): Promise<string[]>

// Configuration
naturalLanguageEngine.setOllamaProvider(provider: OllamaProvider): void
naturalLanguageEngine.setDefaultModel(model: string): void
naturalLanguageEngine.setMaxContextSize(tokens: number): void
```

### Types

```typescript
interface OllamaProvider {
  generateText(options: {
    model: string
    prompt: string
    system?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ text: string }>
}

interface NaturalLanguageQuery {
  query: string
  context?: any
  includeContext?: boolean
  model?: string
  temperature?: number
}

interface NaturalLanguageResponse {
  answer: string
  sparqlQuery?: string
  results?: any[]
  confidence: number
  reasoning: string[]
  turtleContext?: string
}
```