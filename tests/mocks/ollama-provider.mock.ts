/**
 * Mock utilities for Ollama provider testing
 * Provides comprehensive mocking for AI provider interactions
 */

import { vi, type MockedFunction } from 'vitest'

export interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaModelInfo {
  name: string
  modified_at: string
  size: number
  digest: string
  details: {
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

export class MockOllamaProvider {
  private responses: Map<string, OllamaResponse[]> = new Map()
  private models: OllamaModelInfo[] = []
  private callCount = 0
  private errorMode = false
  private delayMs = 0

  constructor() {
    this.setupDefaultModels()
    this.setupDefaultResponses()
  }

  /**
   * Setup default available models
   */
  private setupDefaultModels(): void {
    this.models = [
      {
        name: 'llama2:7b',
        modified_at: '2024-01-01T00:00:00Z',
        size: 3826793787,
        digest: 'sha256:1a2b3c4d',
        details: {
          format: 'gguf',
          family: 'llama',
          families: ['llama'],
          parameter_size: '7B',
          quantization_level: 'Q4_0'
        }
      },
      {
        name: 'codellama:7b',
        modified_at: '2024-01-01T00:00:00Z',
        size: 3826793787,
        digest: 'sha256:5e6f7g8h',
        details: {
          format: 'gguf',
          family: 'llama',
          families: ['llama'],
          parameter_size: '7B',
          quantization_level: 'Q4_0'
        }
      }
    ]
  }

  /**
   * Setup default responses for common prompts
   */
  private setupDefaultResponses(): void {
    // Code generation responses
    this.responses.set('generate code', [{
      model: 'codellama:7b',
      created_at: new Date().toISOString(),
      response: `function example() {
  return "Generated code";
}`,
      done: true,
      total_duration: 1000000000,
      prompt_eval_count: 10,
      eval_count: 20
    }])

    // Ontology validation responses
    this.responses.set('validate ontology', [{
      model: 'llama2:7b',
      created_at: new Date().toISOString(),
      response: JSON.stringify({
        valid: true,
        violations: [],
        suggestions: ['Consider adding more specific domain classes']
      }),
      done: true,
      total_duration: 2000000000,
      prompt_eval_count: 15,
      eval_count: 30
    }])

    // SPARQL query responses
    this.responses.set('sparql query', [{
      model: 'llama2:7b',
      created_at: new Date().toISOString(),
      response: `SELECT ?subject ?predicate ?object
WHERE {
  ?subject ?predicate ?object .
  FILTER(regex(str(?subject), "example"))
}`,
      done: true,
      total_duration: 1500000000,
      prompt_eval_count: 12,
      eval_count: 25
    }])
  }

  /**
   * Mock the generate endpoint
   */
  async generate(prompt: string, model = 'llama2:7b'): Promise<OllamaResponse> {
    this.callCount++
    
    if (this.errorMode) {
      throw new Error('Mock Ollama service unavailable')
    }

    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs))
    }

    // Find matching response based on prompt content
    const matchingKey = Array.from(this.responses.keys())
      .find(key => prompt.toLowerCase().includes(key.toLowerCase()))

    const responses = matchingKey ? this.responses.get(matchingKey) : undefined
    const response = responses?.[0] || this.getDefaultResponse(prompt, model)

    return { ...response, model }
  }

  /**
   * Mock the list models endpoint
   */
  async listModels(): Promise<{ models: OllamaModelInfo[] }> {
    if (this.errorMode) {
      throw new Error('Mock Ollama service unavailable')
    }

    return { models: [...this.models] }
  }

  /**
   * Mock the show model endpoint
   */
  async showModel(name: string): Promise<OllamaModelInfo> {
    if (this.errorMode) {
      throw new Error('Mock Ollama service unavailable')
    }

    const model = this.models.find(m => m.name === name)
    if (!model) {
      throw new Error(`Model ${name} not found`)
    }

    return { ...model }
  }

  /**
   * Add custom response for specific prompt
   */
  addResponse(promptKey: string, response: OllamaResponse): void {
    const existing = this.responses.get(promptKey) || []
    this.responses.set(promptKey, [...existing, response])
  }

  /**
   * Add custom model
   */
  addModel(model: OllamaModelInfo): void {
    this.models.push(model)
  }

  /**
   * Enable error mode for testing error handling
   */
  enableErrorMode(enabled = true): void {
    this.errorMode = enabled
  }

  /**
   * Set response delay for testing async behavior
   */
  setDelay(ms: number): void {
    this.delayMs = ms
  }

  /**
   * Get call count for verification
   */
  getCallCount(): number {
    return this.callCount
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.callCount = 0
    this.errorMode = false
    this.delayMs = 0
    this.responses.clear()
    this.models = []
    this.setupDefaultModels()
    this.setupDefaultResponses()
  }

  /**
   * Get default response for unknown prompts
   */
  private getDefaultResponse(prompt: string, model: string): OllamaResponse {
    return {
      model,
      created_at: new Date().toISOString(),
      response: `Mock response for: ${prompt.substring(0, 50)}...`,
      done: true,
      total_duration: 1000000000,
      prompt_eval_count: 8,
      eval_count: 15
    }
  }
}

/**
 * Factory function to create Ollama provider mocks
 */
export function createOllamaMock(): MockedFunction<any> {
  const mockProvider = new MockOllamaProvider()
  
  return vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockImplementation((prompt: string, model?: string) => 
      mockProvider.generate(prompt, model)
    ),
    listModels: vi.fn().mockImplementation(() => 
      mockProvider.listModels()
    ),
    showModel: vi.fn().mockImplementation((name: string) => 
      mockProvider.showModel(name)
    ),
    _mockProvider: mockProvider // Expose for test control
  }))
}

/**
 * Create streaming mock for Ollama responses
 */
export function createOllamaStreamMock() {
  return vi.fn().mockImplementation(async function* (prompt: string, model = 'llama2:7b') {
    const mockProvider = new MockOllamaProvider()
    const fullResponse = await mockProvider.generate(prompt, model)
    
    // Split response into chunks for streaming simulation
    const words = fullResponse.response.split(' ')
    let currentResponse = ''
    
    for (let i = 0; i < words.length; i++) {
      currentResponse += (i > 0 ? ' ' : '') + words[i]
      
      yield {
        model,
        created_at: new Date().toISOString(),
        response: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1,
        context: i === words.length - 1 ? fullResponse.context : undefined
      }
      
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  })
}

/**
 * Utility to verify Ollama interactions in tests
 */
export class OllamaTestVerifier {
  constructor(private mockProvider: MockOllamaProvider) {}

  expectCalled(times?: number): void {
    if (times !== undefined) {
      expect(this.mockProvider.getCallCount()).toBe(times)
    } else {
      expect(this.mockProvider.getCallCount()).toBeGreaterThan(0)
    }
  }

  expectCalledWith(prompt: string): void {
    // This would need to be implemented based on how calls are tracked
    // For now, just verify it was called
    this.expectCalled()
  }

  expectModel(modelName: string): void {
    const models = this.mockProvider.listModels()
    expect(models).resolves.toMatchObject({
      models: expect.arrayContaining([
        expect.objectContaining({ name: modelName })
      ])
    })
  }
}

export { MockOllamaProvider as OllamaMock }