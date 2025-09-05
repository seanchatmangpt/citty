/**
 * 🧠 DARK MATTER: Natural Language Engine with Ollama Integration
 * Natural language interface to semantic data using Ollama AI Provider v2
 */

import { Store, Parser, Writer } from 'n3'
import { useOntology } from './context'
import { sparqlEngine } from './sparql-engine'
import { safeExecute } from './error-recovery'
import { createOllama } from 'ollama-ai-provider'

// Ollama AI Provider integration
interface OllamaProvider {
  generateText(options: {
    model: string
    prompt: string
    system?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ text: string }>
}

// Create real Ollama provider wrapper
function createOllamaProvider(baseURL: string = 'http://localhost:11434'): OllamaProvider {
  const ollama = createOllama({ baseURL })
  
  return {
    async generateText(options) {
      try {
        const result = await ollama.generateText({
          model: options.model,
          messages: [
            ...(options.system ? [{ role: 'system', content: options.system }] : []),
            { role: 'user', content: options.prompt }
          ],
          temperature: options.temperature,
          maxTokens: options.maxTokens
        })
        return { text: result.text }
      } catch (error) {
        // Fallback to direct API call if the provider interface is different
        console.warn('Ollama provider interface mismatch, using direct API:', error.message)
        
        const response = await fetch(`${baseURL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options.model,
            prompt: options.system ? `${options.system}\n\n${options.prompt}` : options.prompt,
            stream: false,
            options: {
              temperature: options.temperature || 0.7,
              num_predict: options.maxTokens || 500
            }
          })
        })
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        return { text: data.response || '' }
      }
    }
  }
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

/**
 * Natural Language Engine for semantic data queries
 * Integrates with Ollama AI Provider v2 for LLM-powered queries
 */
export class NaturalLanguageEngine {
  private ollama: OllamaProvider
  private contextWindow: string = ''
  private maxContextSize: number = 32000 // tokens
  private defaultModel: string = 'qwen3:8b'

  constructor(ollamaBaseURL?: string) {
    // Create real Ollama provider by default, no more dependency injection needed
    this.ollama = createOllamaProvider(ollamaBaseURL)
    this.updateContextWindow()
  }

  /**
   * Set Ollama base URL (creates new provider instance)
   */
  setOllamaBaseURL(baseURL: string): void {
    this.ollama = createOllamaProvider(baseURL)
  }

  /**
   * Process natural language query against semantic data
   */
  async query(nlQuery: NaturalLanguageQuery): Promise<NaturalLanguageResponse> {

    console.log(`🤖 Processing natural language query: "${nlQuery.query}"`)

    // Update context window with current RDF data
    await this.updateContextWindow()

    // Generate SPARQL query from natural language
    const sparqlGeneration = await this.generateSPARQL(nlQuery)
    
    // Execute the generated SPARQL query
    let results: any[] = []
    if (sparqlGeneration.sparqlQuery) {
      const queryResult = await safeExecute('nl-sparql-execution', async () => {
        return await sparqlEngine.execute(sparqlGeneration.sparqlQuery!, this.getStore())
      })
      
      if (queryResult.success) {
        results = queryResult.data || []
      }
    }

    // Generate natural language answer
    const answer = await this.generateAnswer(nlQuery, sparqlGeneration, results)

    return {
      answer: answer.text,
      sparqlQuery: sparqlGeneration.sparqlQuery,
      results,
      confidence: sparqlGeneration.confidence,
      reasoning: sparqlGeneration.reasoning,
      turtleContext: nlQuery.includeContext ? this.contextWindow : undefined
    }
  }

  /**
   * Generate SPARQL query from natural language
   */
  private async generateSPARQL(nlQuery: NaturalLanguageQuery): Promise<{
    sparqlQuery?: string
    confidence: number
    reasoning: string[]
  }> {
    const systemPrompt = `You are an expert SPARQL query generator. Given a natural language question and RDF/Turtle data in the context, generate an appropriate SPARQL query.

CONTEXT DATA (Turtle format):
${this.contextWindow}

RULES:
1. Generate valid SPARQL 1.1 syntax
2. Use prefixes that exist in the context
3. Focus on the most relevant data patterns
4. Include appropriate FILTER, ORDER BY, LIMIT as needed
5. For aggregation questions, use GROUP BY, COUNT, AVG, etc.
6. Return ONLY the SPARQL query, no explanations
7. If the question cannot be answered with available data, return "NO_QUERY"

Examples:
Question: "What are all the products?"
SPARQL: SELECT ?product ?name WHERE { ?product a :Product ; :hasName ?name }

Question: "How many users are there?"  
SPARQL: SELECT (COUNT(?user) as ?count) WHERE { ?user a :User }

Question: "What products cost more than $50?"
SPARQL: SELECT ?product ?name ?price WHERE { ?product a :Product ; :hasName ?name ; :hasPrice ?price . FILTER(?price > 50) }

Now generate a SPARQL query for this question:`

    const prompt = `${nlQuery.query}

SPARQL Query:`

    try {
      const response = await this.ollama.generateText({
        model: nlQuery.model || this.defaultModel,
        system: systemPrompt,
        prompt: prompt,
        temperature: nlQuery.temperature || 0.1,
        maxTokens: 500
      })

      const sparqlQuery = response.text.trim()
      
      // Validate the generated query
      const isValid = this.validateSPARQL(sparqlQuery)
      const confidence = isValid ? 0.8 : 0.3

      return {
        sparqlQuery: sparqlQuery !== 'NO_QUERY' ? sparqlQuery : undefined,
        confidence,
        reasoning: [
          `Generated SPARQL from natural language`,
          `Query validation: ${isValid ? 'passed' : 'failed'}`,
          `Confidence score: ${confidence}`
        ]
      }
    } catch (error) {
      return {
        confidence: 0.1,
        reasoning: [`Failed to generate SPARQL: ${error.message}`]
      }
    }
  }

  /**
   * Generate natural language answer from query results
   */
  private async generateAnswer(
    nlQuery: NaturalLanguageQuery,
    sparqlGeneration: any,
    results: any[]
  ): Promise<{ text: string }> {
    const systemPrompt = `You are a helpful assistant that explains semantic data query results in natural language.

Given:
1. Original user question
2. Generated SPARQL query (if any)
3. Query results (if any)
4. RDF context data

Provide a clear, helpful answer in natural language. Be concise but informative.

CONTEXT DATA:
${this.contextWindow.slice(0, 8000)} ${this.contextWindow.length > 8000 ? '...(truncated)' : ''}

RULES:
1. Answer directly and conversationally
2. If no results, explain why (data not available, query issues, etc.)  
3. Summarize results in an easy-to-understand format
4. Include specific data values when relevant
5. If query failed, provide helpful explanation
6. Be honest about limitations`

    const resultsText = results.length > 0 
      ? `Query Results (${results.length} items):\n${JSON.stringify(results.slice(0, 10), null, 2)}`
      : 'No results returned'

    const prompt = `Original Question: "${nlQuery.query}"

Generated SPARQL Query: ${sparqlGeneration.sparqlQuery || 'None generated'}

${resultsText}

Please provide a natural language answer:`

    try {
      return await this.ollama.generateText({
        model: nlQuery.model || this.defaultModel,
        system: systemPrompt,
        prompt: prompt,
        temperature: 0.3,
        maxTokens: 500
      })
    } catch (error) {
      return {
        text: `I apologize, but I encountered an error while generating the answer: ${error.message}. However, I was able to execute the query and found ${results.length} results.`
      }
    }
  }

  /**
   * Ask follow-up questions or have conversations about the data
   */
  async chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
    options: { model?: string, temperature?: number } = {}
  ): Promise<string> {

    await this.updateContextWindow()

    const systemPrompt = `You are a knowledgeable assistant with access to semantic/RDF data. You can answer questions about the data, explain relationships, and help users understand the information.

CURRENT DATA CONTEXT (Turtle format):
${this.contextWindow.slice(0, 16000)} ${this.contextWindow.length > 16000 ? '...(truncated for space)' : ''}

You can:
1. Answer questions about the data
2. Explain relationships and patterns
3. Suggest interesting queries
4. Help interpret results
5. Provide context about the data structure

Be conversational, helpful, and accurate. If you need to run a query to answer something, explain what query would be needed.`

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-6) // Keep last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const prompt = conversationContext 
      ? `${conversationContext}\nuser: ${message}\nassistant:`
      : `user: ${message}\nassistant:`

    try {
      const response = await this.ollama.generateText({
        model: options.model || this.defaultModel,
        system: systemPrompt,
        prompt: prompt,
        temperature: options.temperature || 0.7,
        maxTokens: 800
      })

      return response.text
    } catch (error) {
      return `I apologize, but I encountered an error: ${error.message}. Please try again.`
    }
  }

  /**
   * Explain the data structure and available information
   */
  async explainData(): Promise<string> {

    await this.updateContextWindow()

    const systemPrompt = `Analyze the provided RDF/Turtle data and create a clear, helpful explanation of:
1. What types of entities/resources are available
2. What properties/relationships exist
3. Some example queries users could ask
4. Interesting patterns or insights in the data

Be educational and make it easy for someone new to understand what's available.`

    const prompt = `Please analyze and explain this RDF data:

${this.contextWindow}

Provide a helpful explanation:`

    try {
      const response = await this.ollama.generateText({
        model: this.defaultModel,
        system: systemPrompt,
        prompt: prompt,
        temperature: 0.4,
        maxTokens: 1000
      })

      return response.text
    } catch (error) {
      return `I'm unable to explain the data structure due to an error: ${error.message}`
    }
  }

  /**
   * Suggest interesting queries based on the data
   */
  async suggestQueries(count: number = 5): Promise<string[]> {

    await this.updateContextWindow()

    const systemPrompt = `Based on the RDF data provided, suggest interesting natural language questions that users could ask. Focus on:
1. Finding specific information
2. Counting and aggregating data  
3. Finding relationships
4. Discovering patterns
5. Comparative questions

Return exactly ${count} questions, one per line, starting with "- ".`

    const prompt = `RDF Data:
${this.contextWindow.slice(0, 12000)}

Suggest ${count} interesting questions users could ask about this data:`

    try {
      const response = await this.ollama.generateText({
        model: this.defaultModel,
        system: systemPrompt,
        prompt: prompt,
        temperature: 0.6,
        maxTokens: 400
      })

      return response.text
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .slice(0, count)
    } catch (error) {
      return [`Error generating suggestions: ${error.message}`]
    }
  }

  /**
   * Update context window with current RDF data in Turtle format
   */
  private async updateContextWindow(): Promise<void> {
    try {
      const store = this.getStore()
      const writer = new Writer({ prefixes: this.getPrefixes() })
      
      // Get all quads and convert to turtle
      const quads = store.getQuads(null, null, null, null)
      
      // Limit context size to avoid token limits
      const maxQuads = Math.floor(this.maxContextSize / 50) // Rough estimate: 50 tokens per quad
      const limitedQuads = quads.slice(0, maxQuads)
      
      writer.addQuads(limitedQuads)
      
      this.contextWindow = await new Promise<string>((resolve, reject) => {
        writer.end((error, result) => {
          if (error) reject(error)
          else resolve(result)
        })
      })

      console.log(`📝 Context window updated: ${limitedQuads.length} quads, ~${this.contextWindow.length} characters`)
      
    } catch (error) {
      console.warn('Failed to update context window:', error.message)
      this.contextWindow = '# No RDF data available'
    }
  }

  /**
   * Basic SPARQL validation
   */
  private validateSPARQL(query: string): boolean {
    if (!query || query === 'NO_QUERY') return false
    
    // Basic validation checks
    const hasSelect = /SELECT\s+/i.test(query)
    const hasWhere = /WHERE\s*\{/i.test(query)
    const hasClosingBrace = query.includes('}')
    
    return hasSelect && hasWhere && hasClosingBrace
  }

  /**
   * Get current ontology store
   */
  private getStore(): Store {
    return useOntology().store
  }

  /**
   * Get current prefixes
   */
  private getPrefixes(): Record<string, string> {
    return useOntology().prefixes
  }

  /**
   * Get context window content (for debugging)
   */
  getContextWindow(): string {
    return this.contextWindow
  }

  /**
   * Set maximum context size in tokens
   */
  setMaxContextSize(tokens: number): void {
    this.maxContextSize = tokens
  }

  /**
   * Set default model for queries
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model
  }
}

// Singleton instance with default Ollama connection
export const naturalLanguageEngine = new NaturalLanguageEngine()

// Convenience functions
export async function askNaturalLanguage(
  question: string, 
  options: Partial<NaturalLanguageQuery> = {}
): Promise<NaturalLanguageResponse> {
  return naturalLanguageEngine.query({ query: question, ...options })
}

export async function chatWithData(
  message: string,
  history: Array<{ role: 'user' | 'assistant', content: string }> = []
): Promise<string> {
  return naturalLanguageEngine.chat(message, history)
}

export async function explainSemanticData(): Promise<string> {
  return naturalLanguageEngine.explainData()
}

export async function suggestDataQueries(count?: number): Promise<string[]> {
  return naturalLanguageEngine.suggestQueries(count)
}

// Export types
export type { 
  OllamaProvider, 
  NaturalLanguageQuery, 
  NaturalLanguageResponse 
}