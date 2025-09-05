/**
 * 🧠 DARK MATTER: Semantic Inference Engine
 * The reasoning layer that makes ontologies actually intelligent
 */

import { Store, Quad, DataFactory } from 'n3'
import { useOntology } from './context'
import { addTriple } from './core'

const { namedNode, literal, quad } = DataFactory

export interface InferenceRule {
  name: string
  description: string
  pattern: {
    if: Array<[string, string, string]>  // Triple patterns
    then: Array<[string, string, string]> // Inferred triples
  }
}

export interface InferenceResult {
  original: number
  inferred: number
  rules: string[]
  duration: number
}

/**
 * Semantic inference engine with OWL/RDFS reasoning
 */
export class InferenceEngine {
  private rules: Map<string, InferenceRule> = new Map()
  private inferred: Set<string> = new Set()
  
  constructor() {
    this.loadBuiltInRules()
  }

  /**
   * Load built-in OWL/RDFS inference rules
   */
  private loadBuiltInRules() {
    // RDFS Rules
    this.addRule({
      name: 'rdfs:subClassOf-transitivity',
      description: 'If A is subclass of B and B is subclass of C, then A is subclass of C',
      pattern: {
        if: [
          ['?a', 'rdfs:subClassOf', '?b'],
          ['?b', 'rdfs:subClassOf', '?c']
        ],
        then: [
          ['?a', 'rdfs:subClassOf', '?c']
        ]
      }
    })
    
    this.addRule({
      name: 'rdfs:subPropertyOf-transitivity',
      description: 'Transitive property inheritance',
      pattern: {
        if: [
          ['?a', 'rdfs:subPropertyOf', '?b'],
          ['?b', 'rdfs:subPropertyOf', '?c']
        ],
        then: [
          ['?a', 'rdfs:subPropertyOf', '?c']
        ]
      }
    })
    
    this.addRule({
      name: 'rdf:type-inheritance',
      description: 'If X is instance of A and A is subclass of B, then X is instance of B',
      pattern: {
        if: [
          ['?x', 'rdf:type', '?a'],
          ['?a', 'rdfs:subClassOf', '?b']
        ],
        then: [
          ['?x', 'rdf:type', '?b']
        ]
      }
    })
    
    this.addRule({
      name: 'rdfs:domain',
      description: 'Property domain inference',
      pattern: {
        if: [
          ['?x', '?p', '?y'],
          ['?p', 'rdfs:domain', '?c']
        ],
        then: [
          ['?x', 'rdf:type', '?c']
        ]
      }
    })
    
    this.addRule({
      name: 'rdfs:range',
      description: 'Property range inference',
      pattern: {
        if: [
          ['?x', '?p', '?y'],
          ['?p', 'rdfs:range', '?c']
        ],
        then: [
          ['?y', 'rdf:type', '?c']
        ]
      }
    })
    
    // OWL Rules
    this.addRule({
      name: 'owl:inverseOf',
      description: 'Inverse property inference',
      pattern: {
        if: [
          ['?x', '?p', '?y'],
          ['?p', 'owl:inverseOf', '?q']
        ],
        then: [
          ['?y', '?q', '?x']
        ]
      }
    })
    
    this.addRule({
      name: 'owl:symmetricProperty',
      description: 'Symmetric property inference',
      pattern: {
        if: [
          ['?x', '?p', '?y'],
          ['?p', 'rdf:type', 'owl:SymmetricProperty']
        ],
        then: [
          ['?y', '?p', '?x']
        ]
      }
    })
    
    this.addRule({
      name: 'owl:transitiveProperty',
      description: 'Transitive property inference',
      pattern: {
        if: [
          ['?x', '?p', '?y'],
          ['?y', '?p', '?z'],
          ['?p', 'rdf:type', 'owl:TransitiveProperty']
        ],
        then: [
          ['?x', '?p', '?z']
        ]
      }
    })
    
    this.addRule({
      name: 'owl:equivalentClass',
      description: 'Equivalent class inference',
      pattern: {
        if: [
          ['?x', 'rdf:type', '?a'],
          ['?a', 'owl:equivalentClass', '?b']
        ],
        then: [
          ['?x', 'rdf:type', '?b']
        ]
      }
    })
    
    this.addRule({
      name: 'owl:sameAs',
      description: 'Identity inference',
      pattern: {
        if: [
          ['?x', 'owl:sameAs', '?y'],
          ['?x', '?p', '?z']
        ],
        then: [
          ['?y', '?p', '?z']
        ]
      }
    })
    
    // Custom domain rules
    this.addRule({
      name: 'citty:command-hierarchy',
      description: 'Command hierarchy inference',
      pattern: {
        if: [
          ['?cmd', 'citty:hasSubCommand', '?sub'],
          ['?sub', 'rdf:type', 'citty:Command']
        ],
        then: [
          ['?sub', 'citty:parentCommand', '?cmd'],
          ['?cmd', 'rdf:type', 'citty:ParentCommand']
        ]
      }
    })
    
    this.addRule({
      name: 'citty:workflow-task',
      description: 'Workflow task relationship',
      pattern: {
        if: [
          ['?workflow', 'rdf:type', 'citty:Workflow'],
          ['?workflow', 'citty:hasTask', '?task']
        ],
        then: [
          ['?task', 'rdf:type', 'citty:Task'],
          ['?task', 'citty:belongsToWorkflow', '?workflow']
        ]
      }
    })
  }

  /**
   * Add custom inference rule
   */
  addRule(rule: InferenceRule) {
    this.rules.set(rule.name, rule)
  }

  /**
   * Run inference on the graph
   */
  async infer(maxIterations = 10): Promise<InferenceResult> {
    const startTime = Date.now()
    const { store } = useOntology()
    
    const originalSize = store.size
    const appliedRules = new Set<string>()
    let iteration = 0
    let newInferences = true
    
    // Iterate until no new inferences or max iterations reached
    while (newInferences && iteration < maxIterations) {
      newInferences = false
      iteration++
      
      for (const [name, rule] of this.rules) {
        const inferences = this.applyRule(rule, store)
        
        if (inferences.length > 0) {
          newInferences = true
          appliedRules.add(name)
          
          // Add inferred triples
          for (const inf of inferences) {
            const tripleKey = `${inf.subject}|${inf.predicate}|${inf.object}`
            
            if (!this.inferred.has(tripleKey)) {
              this.inferred.add(tripleKey)
              await addTriple(inf.subject, inf.predicate, inf.object)
            }
          }
        }
      }
    }
    
    return {
      original: originalSize,
      inferred: store.size - originalSize,
      rules: Array.from(appliedRules),
      duration: Date.now() - startTime
    }
  }

  /**
   * Apply a single rule to the store
   */
  private applyRule(rule: InferenceRule, store: Store): Array<{
    subject: string
    predicate: string
    object: string
  }> {
    const inferences = []
    const bindings = this.findBindings(rule.pattern.if, store)
    
    for (const binding of bindings) {
      // Generate inferred triples
      for (const [s, p, o] of rule.pattern.then) {
        const subject = this.substitute(s, binding)
        const predicate = this.substitute(p, binding)
        const object = this.substitute(o, binding)
        
        // Check if triple already exists
        if (!this.tripleExists(subject, predicate, object, store)) {
          inferences.push({ subject, predicate, object })
        }
      }
    }
    
    return inferences
  }

  /**
   * Find all bindings that match the pattern
   */
  private findBindings(
    patterns: Array<[string, string, string]>,
    store: Store
  ): Array<Map<string, string>> {
    if (patterns.length === 0) return [new Map()]
    
    const [first, ...rest] = patterns
    const bindings: Array<Map<string, string>> = []
    
    // Find matches for first pattern
    const matches = this.matchPattern(first, store)
    
    for (const match of matches) {
      const binding = this.createBinding(first, match)
      
      // Check if remaining patterns match with this binding
      const subBindings = this.findBindingsWithContext(rest, store, binding)
      
      for (const subBinding of subBindings) {
        // Merge bindings
        const merged = new Map(binding)
        for (const [k, v] of subBinding) {
          merged.set(k, v)
        }
        bindings.push(merged)
      }
    }
    
    return bindings
  }

  /**
   * Find bindings with existing context
   */
  private findBindingsWithContext(
    patterns: Array<[string, string, string]>,
    store: Store,
    context: Map<string, string>
  ): Array<Map<string, string>> {
    if (patterns.length === 0) return [new Map()]
    
    // Substitute variables with context
    const substituted = patterns.map(([s, p, o]) => [
      this.substitute(s, context),
      this.substitute(p, context),
      this.substitute(o, context)
    ] as [string, string, string])
    
    return this.findBindings(substituted, store)
  }

  /**
   * Match a single pattern against the store
   */
  private matchPattern(
    [s, p, o]: [string, string, string],
    store: Store
  ): Quad[] {
    const { prefixes } = useOntology()
    
    const subject = this.isVariable(s) ? null : this.expandTerm(s, prefixes)
    const predicate = this.isVariable(p) ? null : this.expandTerm(p, prefixes)
    const object = this.isVariable(o) ? null : this.expandTerm(o, prefixes)
    
    return store.getQuads(subject, predicate, object, null)
  }

  /**
   * Create binding from pattern and quad
   */
  private createBinding(
    [s, p, o]: [string, string, string],
    quad: Quad
  ): Map<string, string> {
    const binding = new Map<string, string>()
    
    if (this.isVariable(s)) {
      binding.set(s, quad.subject.value)
    }
    if (this.isVariable(p)) {
      binding.set(p, quad.predicate.value)
    }
    if (this.isVariable(o)) {
      binding.set(o, quad.object.value)
    }
    
    return binding
  }

  /**
   * Check if term is a variable
   */
  private isVariable(term: string): boolean {
    return term.startsWith('?')
  }

  /**
   * Substitute variables in term
   */
  private substitute(term: string, binding: Map<string, string>): string {
    if (this.isVariable(term)) {
      return binding.get(term) || term
    }
    return term
  }

  /**
   * Expand prefixed terms
   */
  private expandTerm(term: string, prefixes: Record<string, string>): string {
    if (term.includes(':')) {
      const [prefix, local] = term.split(':', 2)
      if (prefixes[prefix]) {
        return prefixes[prefix] + local
      }
    }
    return term
  }

  /**
   * Check if triple exists in store
   */
  private tripleExists(
    s: string,
    p: string,
    o: string,
    store: Store
  ): boolean {
    const { prefixes } = useOntology()
    
    const subject = this.expandTerm(s, prefixes)
    const predicate = this.expandTerm(p, prefixes)
    const object = this.expandTerm(o, prefixes)
    
    const quads = store.getQuads(subject, predicate, object, null)
    return quads.length > 0
  }

  /**
   * Explain inferred triples
   */
  explainInference(subject: string, predicate: string, object: string): string[] {
    const tripleKey = `${subject}|${predicate}|${object}`
    
    if (!this.inferred.has(tripleKey)) {
      return ['This triple was not inferred, it exists in the original graph']
    }
    
    // Find which rules could have produced this triple
    const explanations: string[] = []
    
    for (const [name, rule] of this.rules) {
      for (const [s, p, o] of rule.pattern.then) {
        // Check if this rule could produce the triple
        if (this.patternMatches([s, p, o], [subject, predicate, object])) {
          explanations.push(`${name}: ${rule.description}`)
        }
      }
    }
    
    return explanations.length > 0 ? explanations : ['Unknown inference source']
  }

  /**
   * Check if pattern could match triple
   */
  private patternMatches(
    pattern: [string, string, string],
    triple: [string, string, string]
  ): boolean {
    for (let i = 0; i < 3; i++) {
      if (!this.isVariable(pattern[i]) && pattern[i] !== triple[i]) {
        return false
      }
    }
    return true
  }

  /**
   * Clear inferred triples
   */
  clearInferences() {
    this.inferred.clear()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      rules: this.rules.size,
      inferred: this.inferred.size,
      ruleNames: Array.from(this.rules.keys())
    }
  }
}

// Singleton instance
export const inferenceEngine = new InferenceEngine()

// Export convenience functions
export async function infer(maxIterations?: number): Promise<InferenceResult> {
  return inferenceEngine.infer(maxIterations)
}

export function addInferenceRule(rule: InferenceRule) {
  inferenceEngine.addRule(rule)
}

export function explainInference(s: string, p: string, o: string): string[] {
  return inferenceEngine.explainInference(s, p, o)
}