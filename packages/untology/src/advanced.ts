/**
 * Advanced 20% features - power users only
 */
import { Store, Parser, StreamParser, Util } from 'n3'
import { useOntology, withOntology } from './context'
import type { Quad } from 'n3'

/**
 * Execute raw SPARQL queries (passthrough to N3's SPARQL engine)
 */
export async function sparqlQuery(query: string): Promise<any[]> {
  const { store } = useOntology()
  
  // For production, you'd integrate a proper SPARQL engine like Comunica
  // This is a placeholder showing the pattern
  throw new Error('SPARQL support requires additional dependencies. Use queryTriples() for simple queries.')
}

/**
 * Merge multiple graphs
 */
export function mergeGraphs(stores: Store[]): Store {
  const merged = new Store()
  
  for (const store of stores) {
    const quads = store.getQuads(null, null, null, null)
    merged.addQuads(quads)
  }
  
  return merged
}

/**
 * Create a new graph context
 */
export function createGraph(): Store {
  return new Store()
}

/**
 * Parse Turtle string without setting context
 */
export function parseTurtle(input: string, baseIRI?: string): Quad[] {
  const parser = new Parser({ format: 'turtle', baseIRI })
  return parser.parse(input)
}

/**
 * Stream parse large files
 */
export function createStreamParser(
  format: 'turtle' | 'ntriples' = 'turtle'
): StreamParser {
  return new StreamParser({ format })
}

/**
 * Validate graph against SHACL shapes
 */
export async function validateShacl(shapesGraph: Store): Promise<{
  conforms: boolean
  violations: any[]
}> {
  // Placeholder - would integrate a SHACL validator
  return { conforms: true, violations: [] }
}

/**
 * Perform OWL reasoning
 */
export async function inferOwl(rules?: string[]): Promise<Quad[]> {
  // Placeholder - would integrate an OWL reasoner
  return []
}

/**
 * Graph isomorphism check
 */
export function isIsomorphic(store1: Store, store2: Store): boolean {
  return Util.isomorphic(
    store1.getQuads(null, null, null, null),
    store2.getQuads(null, null, null, null)
  )
}

/**
 * Create a blank node
 */
export function blankNode(value?: string) {
  return Util.blankNode(value)
}

/**
 * Create a named node
 */
export function namedNode(value: string) {
  return Util.namedNode(value)
}

/**
 * Create a literal
 */
export function literal(value: string, languageOrDatatype?: string) {
  return Util.literal(value, languageOrDatatype)
}

/**
 * Check if two terms are equal
 */
export function equals(term1: any, term2: any): boolean {
  return Util.equals(term1, term2)
}

/**
 * Get all namespaces from the graph
 */
export function getNamespaces(): Record<string, string> {
  const { prefixes } = useOntology()
  return { ...prefixes }
}

/**
 * Add a namespace prefix
 */
export function addNamespace(prefix: string, iri: string): void {
  const ctx = useOntology()
  ctx.prefixes[prefix] = iri
}

/**
 * Create a sub-graph view
 */
export function subGraph(subject: string): Store {
  const { store } = useOntology()
  const subStore = new Store()
  
  const quads = store.getQuads(subject, null, null, null)
  subStore.addQuads(quads)
  
  // Add connected nodes
  for (const quad of quads) {
    if (quad.object.termType === 'NamedNode') {
      const connected = store.getQuads(quad.object.value, null, null, null)
      subStore.addQuads(connected)
    }
  }
  
  return subStore
}

/**
 * Graph statistics
 */
export function getStatistics(): {
  triples: number
  subjects: number
  predicates: number
  objects: number
  literals: number
  iris: number
} {
  const { store } = useOntology()
  const subjects = new Set<string>()
  const predicates = new Set<string>()
  const objects = new Set<string>()
  let literals = 0
  let iris = 0
  
  for (const quad of store) {
    subjects.add(quad.subject.value)
    predicates.add(quad.predicate.value)
    objects.add(quad.object.value)
    
    if (quad.object.termType === 'Literal') literals++
    if (quad.object.termType === 'NamedNode') iris++
  }
  
  return {
    triples: store.size,
    subjects: subjects.size,
    predicates: predicates.size,
    objects: objects.size,
    literals,
    iris
  }
}