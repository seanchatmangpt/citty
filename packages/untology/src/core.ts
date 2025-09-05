import { Store, Parser, DataFactory, Quad } from 'n3'
import { ontologyContext, useOntology, type OntologyContext, setOntologyContext, clearOntologyContext } from './context'
import { defu } from 'defu'
import { ofetch } from 'ofetch'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'

const { namedNode, literal, quad } = DataFactory

/**
 * Load a graph from Turtle/N3/N-Triples string or file
 */
export async function loadGraph(
  source: string,
  options: {
    format?: 'turtle' | 'ntriples' | 'nquads' | 'trig'
    baseIRI?: string
    prefixes?: Record<string, string>
  } = {}
): Promise<void> {
  const opts = defu(options, {
    format: 'turtle' as const,
    prefixes: {
      '': 'http://example.org/',  // Default namespace for ':' prefix
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#'
    }
  })

  let input = source
  
  // Load from file if path-like
  if (source.startsWith('/') || source.startsWith('./') || source.endsWith('.ttl') || source.endsWith('.nt')) {
    input = await readFile(resolve(source), 'utf-8')
  }
  // Load from URL if http(s)
  else if (source.startsWith('http')) {
    input = await ofetch(source)
  }

  const store = new Store()
  const parser = new Parser({
    format: opts.format,
    baseIRI: opts.baseIRI
  })

  const quads = parser.parse(input)
  store.addQuads(quads)
  
  // Extract prefixes from parsed turtle if they exist
  const extractedPrefixes: Record<string, string> = { ...opts.prefixes }
  if (opts.format === 'turtle') {
    const prefixLines = input.match(/@prefix\s+(\w*):?\s*<([^>]+)>/g)
    if (prefixLines) {
      for (const line of prefixLines) {
        const match = line.match(/@prefix\s+(\w*):?\s*<([^>]+)>/)
        if (match) {
          const [, prefix, uri] = match
          extractedPrefixes[prefix] = uri.endsWith('/') || uri.endsWith('#') ? uri : uri + '/'
        }
      }
    }
  }

  const context: OntologyContext = {
    store,
    prefixes: extractedPrefixes,
    defaultFormat: opts.format
  }

  setOntologyContext(context)
}

/**
 * Find all entities of a given RDF type
 */
export function findEntities(type?: string): string[] {
  const { store, prefixes } = useOntology()
  
  if (!type) {
    // Return all subjects
    const subjects = new Set<string>()
    for (const quad of store) {
      subjects.add(quad.subject.value)
    }
    return Array.from(subjects).map(s => simplifyIRI(s, prefixes))
  }

  // Expand prefix if needed
  const typeIRI = expandPrefix(type, prefixes)
  const rdfType = expandPrefix('rdf:type', prefixes)
  
  const quads = store.getQuads(null, rdfType, typeIRI, null)
  return quads.map(q => simplifyIRI(q.subject.value, prefixes))
}

/**
 * Get all relationships from a subject
 */
export function findRelations(subject: string): Array<{
  predicate: string
  object: string
}> {
  const { store, prefixes } = useOntology()
  const subjectIRI = expandPrefix(subject, prefixes)
  
  const quads = store.getQuads(subjectIRI, null, null, null)
  return quads.map(q => ({
    predicate: q.predicate.value, // Keep full IRI for predicates as expected by tests
    object: q.object.termType === 'Literal' 
      ? (q.object.value.startsWith('"') && q.object.value.endsWith('"') ? q.object.value.slice(1, -1) : q.object.value)
      : simplifyIRI(q.object.value, prefixes)
  }))
}

/**
 * Get a single property value
 */
export function getValue(subject: string, predicate: string): string | null {
  const { store, prefixes } = useOntology()
  const subjectIRI = expandPrefix(subject, prefixes)
  const predicateIRI = expandPrefix(predicate, prefixes)
  
  const quads = store.getQuads(subjectIRI, predicateIRI, null, null)
  if (quads.length === 0) return null
  
  const value = quads[0].object.value
  // Remove quotes from literals
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
}

/**
 * Get all property values
 */
export function getValues(subject: string, predicate: string): string[] {
  const { store, prefixes } = useOntology()
  const subjectIRI = expandPrefix(subject, prefixes)
  const predicateIRI = expandPrefix(predicate, prefixes)
  
  const quads = store.getQuads(subjectIRI, predicateIRI, null, null)
  return quads.map(q => {
    if (q.object.termType === 'Literal') {
      const value = q.object.value
      return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    }
    return simplifyIRI(q.object.value, prefixes)
  })
}

/**
 * Add a triple to the graph
 */
export function addTriple(subject: string, predicate: string, object: string): void {
  const { store, prefixes } = useOntology()
  const subjectNode = namedNode(expandPrefix(subject, prefixes))
  const predicateNode = namedNode(expandPrefix(predicate, prefixes))
  
  // Determine if object is a literal or IRI
  const objectNode = object.startsWith('"') || /^\d+$/.test(object)
    ? literal(object.replace(/^"|"$/g, ''))
    : namedNode(expandPrefix(object, prefixes))
  
  store.addQuad(quad(subjectNode, predicateNode, objectNode))
}

/**
 * Remove triples from the graph
 */
export function removeTriples(
  subject?: string,
  predicate?: string,
  object?: string
): number {
  const { store, prefixes } = useOntology()
  
  const s = subject ? expandPrefix(subject, prefixes) : null
  const p = predicate ? expandPrefix(predicate, prefixes) : null
  const o = object ? expandPrefix(object, prefixes) : null
  
  const toRemove = store.getQuads(s, p, o, null)
  toRemove.forEach(q => store.removeQuad(q))
  
  return toRemove.length
}

/**
 * Check if a triple exists
 */
export function hasTriple(
  subject: string,
  predicate: string,
  object?: string
): boolean {
  const { store, prefixes } = useOntology()
  
  const s = expandPrefix(subject, prefixes)
  const p = expandPrefix(predicate, prefixes)
  const o = object ? expandPrefix(object, prefixes) : null
  
  const quads = store.getQuads(s, p, o, null)
  return quads.length > 0
}

/**
 * Get the size of the graph
 */
export function graphSize(): number {
  const { store } = useOntology()
  return store.size
}

/**
 * Clear all triples from the graph
 */
export function clearGraph(): void {
  try {
    const context = useOntology()
    context.store.removeQuads(context.store.getQuads(null, null, null, null))
  } catch {
    // If no context exists, just clear it
    clearOntologyContext()
  }
}

/**
 * Helper to expand prefixed names
 */
function expandPrefix(value: string, prefixes: Record<string, string>): string {
  if (value.includes(':')) {
    const [prefix, local] = value.split(':', 2)
    if (prefixes[prefix] !== undefined) {
      return prefixes[prefix] + local
    }
  }
  return value
}

function simplifyIRI(iri: string, prefixes: Record<string, string>): string {
  // Try to find a prefix match - check empty prefix first for default namespace
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (iri.startsWith(ns)) {
      const localPart = iri.slice(ns.length)
      return prefix === '' ? `:${localPart}` : `${prefix}:${localPart}`
    }
  }
  
  // Return last part after # or /
  const match = iri.match(/[#/]([^#/]+)$/)
  return match ? match[1] : iri
}