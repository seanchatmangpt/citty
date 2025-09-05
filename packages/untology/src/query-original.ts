import { useOntology } from './context'
import type { Store } from 'n3'

/**
 * Natural language query interface for the 80% use case
 */
export async function askGraph(query: string): Promise<any> {
  const { store, prefixes } = useOntology()
  
  // Pattern matching for common natural language queries
  const patterns = [
    {
      regex: /^(list|get|find|show)\s+all\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const type = match[2]
        return findEntitiesOfType(store, type, prefixes)
      }
    },
    {
      regex: /^all\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const type = match[1]
        return findEntitiesOfType(store, type, prefixes)
      }
    },
    {
      regex: /^what\s+is\s+(\w+)'?s?\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const [, subject, property] = match
        return getPropertyValue(store, subject, property, prefixes)
      }
    },
    {
      regex: /^who\s+(\w+)\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const [, predicate, object] = match
        return findSubjectsByRelation(store, predicate, object, prefixes)
      }
    },
    {
      regex: /^what\s+does\s+(\w+)\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const [, subject, predicate] = match
        return getObjectsByRelation(store, subject, predicate, prefixes)
      }
    },
    {
      regex: /^count\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const type = match[1]
        const entities = findEntitiesOfType(store, type, prefixes)
        return entities.length
      }
    },
    {
      regex: /^describe\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const subject = match[1]
        return describeEntity(store, subject, prefixes)
      }
    }
  ]

  // Try to match patterns
  for (const pattern of patterns) {
    const match = query.match(pattern.regex)
    if (match) {
      return pattern.handler(match)
    }
  }

  // Fallback to a more generic approach
  if (query.toLowerCase().includes('how many')) {
    const typeMatch = query.match(/how many (\w+)/i)
    if (typeMatch) {
      let type = typeMatch[1]
      // Handle common plural forms
      if (type.toLowerCase() === 'people') {
        type = 'Person'
      }
      const entities = findEntitiesOfType(store, type, prefixes)
      return entities.length
    }
  }

  throw new Error(`Unable to parse query: "${query}". Try using a pattern like "list all Commands" or "what is Alice's name"`)
}

/**
 * Simple SPO (Subject-Predicate-Object) query
 */
export function queryTriples(
  subject?: string | null,
  predicate?: string | null,
  object?: string | null
): Array<{
  subject: string
  predicate: string
  object: string
}> {
  const { store, prefixes } = useOntology()
  
  const s = subject ? expandPrefix(subject, prefixes) : null
  const p = predicate ? expandPrefix(predicate, prefixes) : null
  const o = object ? expandPrefix(object, prefixes) : null
  
  const quads = store.getQuads(s, p, o, null)
  return quads.map(q => ({
    subject: simplifyIRI(q.subject.value, prefixes),
    predicate: q.predicate.value, // Keep full IRI for predicates as expected by tests
    object: q.object.termType === 'Literal' 
      ? (q.object.value.startsWith('"') && q.object.value.endsWith('"') ? q.object.value.slice(1, -1) : q.object.value)
      : simplifyIRI(q.object.value, prefixes)
  }))
}

// Helper functions for natural language queries
function findEntitiesOfType(
  store: Store,
  type: string,
  prefixes: Record<string, string>
): string[] {
  const rdfType = expandPrefix('rdf:type', prefixes)
  
  // First try the type as given
  let typeIRI = expandPrefix(type, prefixes)
  let quads = store.getQuads(null, rdfType, typeIRI, null)
  
  // If no results and type doesn't contain ':', try common prefixes
  if (quads.length === 0 && !type.includes(':')) {
    const commonPrefixes = ['foaf', 'citty', 'rdfs', 'owl']
    for (const prefix of commonPrefixes) {
      if (prefixes[prefix]) {
        typeIRI = expandPrefix(`${prefix}:${type}`, prefixes)
        quads = store.getQuads(null, rdfType, typeIRI, null)
        if (quads.length > 0) {
          break
        }
      }
    }
  }
  
  return quads.map(q => simplifyIRI(q.subject.value, prefixes))
}

function getPropertyValue(
  store: Store,
  subject: string,
  property: string,
  prefixes: Record<string, string>
): string | null {
  let subjectIRI = expandPrefix(subject, prefixes)
  let propertyIRI = expandPrefix(property, prefixes)
  
  // Try to find subject with smart prefix matching
  if (!subject.includes(':')) {
    // Try :<subject> format first
    subjectIRI = expandPrefix(`:${subject}`, prefixes)
  }
  
  let quads = store.getQuads(subjectIRI, propertyIRI, null, null)
  
  // If no results for property, try common prefixes
  if (quads.length === 0 && !property.includes(':')) {
    const commonPrefixes = ['foaf', 'citty', 'rdfs', 'owl']
    for (const prefix of commonPrefixes) {
      if (prefixes[prefix]) {
        propertyIRI = expandPrefix(`${prefix}:${property}`, prefixes)
        quads = store.getQuads(subjectIRI, propertyIRI, null, null)
        if (quads.length > 0) {
          break
        }
      }
    }
  }
  
  if (quads.length === 0) return null
  
  const value = quads[0].object.value
  // Remove quotes from literals
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
}

function findSubjectsByRelation(
  store: Store,
  predicate: string,
  object: string,
  prefixes: Record<string, string>
): string[] {
  const predicateIRI = expandPrefix(predicate, prefixes)
  const objectIRI = expandPrefix(object, prefixes)
  
  const quads = store.getQuads(null, predicateIRI, objectIRI, null)
  return quads.map(q => simplifyIRI(q.subject.value, prefixes))
}

function getObjectsByRelation(
  store: Store,
  subject: string,
  predicate: string,
  prefixes: Record<string, string>
): string[] {
  const subjectIRI = expandPrefix(subject, prefixes)
  const predicateIRI = expandPrefix(predicate, prefixes)
  
  const quads = store.getQuads(subjectIRI, predicateIRI, null, null)
  return quads.map(q => {
    const value = q.object.value
    if (q.object.termType === 'Literal') {
      return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    }
    return simplifyIRI(value, prefixes)
  })
}

function describeEntity(
  store: Store,
  subject: string,
  prefixes: Record<string, string>
): Record<string, any> {
  const subjectIRI = expandPrefix(subject, prefixes)
  const quads = store.getQuads(subjectIRI, null, null, null)
  
  const description: Record<string, any> = {
    id: subject,
    properties: {}
  }
  
  for (const quad of quads) {
    const predicate = quad.predicate.value
    let value = quad.object.value
    
    // Clean up literal values
    if (quad.object.termType === 'Literal') {
      value = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    }
    
    if (predicate in description.properties) {
      if (!Array.isArray(description.properties[predicate])) {
        description.properties[predicate] = [description.properties[predicate]]
      }
      description.properties[predicate].push(value)
    } else {
      description.properties[predicate] = value
    }
  }
  
  return description
}

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