import { Writer } from 'n3'
import { useOntology } from './context'

/**
 * Export the current graph to Turtle format
 */
export async function exportTurtle(): Promise<string> {
  const { store, prefixes } = useOntology()
  
  return new Promise((resolve, reject) => {
    const writer = new Writer({
      prefixes,
      format: 'turtle'
    })
    
    const quads = store.getQuads(null, null, null, null)
    writer.addQuads(quads)
    
    writer.end((error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

/**
 * Export the current graph to JSON-LD format
 */
export async function exportJsonLd(): Promise<string> {
  const { store } = useOntology()
  
  return new Promise((resolve, reject) => {
    const writer = new Writer({
      format: 'application/ld+json'
    })
    
    const quads = store.getQuads(null, null, null, null)
    writer.addQuads(quads)
    
    writer.end((error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

/**
 * Export the current graph to N-Triples format
 */
export async function exportNTriples(): Promise<string> {
  const { store } = useOntology()
  
  return new Promise((resolve, reject) => {
    const writer = new Writer({
      format: 'N-Triples'
    })
    
    const quads = store.getQuads(null, null, null, null)
    writer.addQuads(quads)
    
    writer.end((error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

/**
 * Export graph as context objects for templating (Unjucks)
 */
export function toContextObjects(type?: string): Record<string, any>[] {
  const { store, prefixes } = useOntology()
  const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  
  // Get entities
  let entities: string[]
  if (type) {
    const typeIRI = expandPrefix(type, prefixes)
    const quads = store.getQuads(null, rdfType, typeIRI, null)
    entities = quads.map(q => q.subject.value)
  } else {
    const subjects = new Set<string>()
    for (const quad of store) {
      subjects.add(quad.subject.value)
    }
    entities = Array.from(subjects)
  }
  
  // Build context objects
  return entities.map(entity => {
    const props: Record<string, any> = {
      id: simplifyIRI(entity, prefixes)
    }
    
    const quads = store.getQuads(entity, null, null, null)
    for (const quad of quads) {
      const predicate = simplifyIRI(quad.predicate.value, prefixes)
      const value = quad.object.value.startsWith('http') 
        ? simplifyIRI(quad.object.value, prefixes)
        : quad.object.value.replace(/^"|"$/g, '')
      
      if (predicate in props) {
        if (!Array.isArray(props[predicate])) {
          props[predicate] = [props[predicate]]
        }
        props[predicate].push(value)
      } else {
        props[predicate] = value
      }
    }
    
    return props
  })
}

// Helper functions
function expandPrefix(value: string, prefixes: Record<string, string>): string {
  if (value.includes(':')) {
    const [prefix, local] = value.split(':', 2)
    if (prefixes[prefix]) {
      return prefixes[prefix] + local
    }
  }
  return value
}

function simplifyIRI(iri: string, prefixes: Record<string, string>): string {
  // Try to find a prefix match
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (iri.startsWith(ns)) {
      return `${prefix}:${iri.slice(ns.length)}`
    }
  }
  
  // Return last part after # or /
  const match = iri.match(/[#/]([^#/]+)$/)
  return match ? match[1] : iri
}