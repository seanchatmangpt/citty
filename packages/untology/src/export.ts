import { Writer } from 'n3'
import { useOntology } from './context'

/**
 * Export the current graph to Turtle format
 */
export async function exportTurtle(): Promise<string> {
  const { store, prefixes } = useOntology()
  
  return new Promise((resolve, reject) => {
    const writer = new Writer({
      prefixes: {
        ...prefixes,
        // Ensure common prefixes are included
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      },
      format: 'turtle'
    })
    
    const quads = store.getQuads(null, null, null, null)
    writer.addQuads(quads)
    
    writer.end((error, result) => {
      if (error) reject(error)
      else resolve(result || '')
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
  const { store, prefixes } = useOntology()
  
  return new Promise((resolve, reject) => {
    const writer = new Writer({
      format: 'N-Triples'
    })
    
    const quads = store.getQuads(null, null, null, null)
    writer.addQuads(quads)
    
    writer.end((error, result) => {
      if (error) reject(error)
      else {
        // Transform output to use simplified subjects while keeping other IRIs full
        let output = result || ''
        
        // Replace only subjects (at start of lines) with simplified format
        if (prefixes['']) {
          const defaultNS = prefixes[''].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          output = output.replace(
            new RegExp(`^<${defaultNS}([^>]+)>`, 'gm'), 
            '<:$1>'
          )
        }
        
        resolve(output)
      }
    })
  })
}

/**
 * Export graph as context objects for templating (Unjucks)
 */
export function toContextObjects(type?: string): Record<string, any>[] {
  const { store, prefixes } = useOntology()
  const rdfType = expandPrefix('rdf:type', prefixes)
  
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
      let value: any
      
      if (quad.object.termType === 'Literal') {
        // Handle literal values
        value = quad.object.value
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        }
        // Try to parse numbers
        if (/^\d+$/.test(value)) {
          value = parseInt(value, 10)
        } else if (/^\d*\.\d+$/.test(value)) {
          value = parseFloat(value)
        }
      } else {
        // Handle IRI values
        value = simplifyIRI(quad.object.value, prefixes)
      }
      
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
      // For context objects, return just the local part for default namespace
      return prefix === '' ? localPart : `${prefix}:${localPart}`
    }
  }
  
  // Return last part after # or /
  const match = iri.match(/[#/]([^#/]+)$/)
  return match ? match[1] : iri
}