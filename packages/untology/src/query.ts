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
      regex: /^(list|get|find|show)?\s*all\s+(\w+)/i,
      handler: (match: RegExpMatchArray) => {
        const type = match[2]
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
      const entities = findEntitiesOfType(store, typeMatch[1], prefixes)
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
    subject: q.subject.value,
    predicate: q.predicate.value,
    object: q.object.value
  }))
}

// Helper functions for natural language queries
function findEntitiesOfType(
  store: Store,
  type: string,
  prefixes: Record<string, string>
): string[] {
  const typeIRI = expandPrefix(type, prefixes)
  const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  
  const quads = store.getQuads(null, rdfType, typeIRI, null)
  return quads.map(q => q.subject.value)
}

function getPropertyValue(
  store: Store,
  subject: string,
  property: string,
  prefixes: Record<string, string>
): string | null {
  const subjectIRI = expandPrefix(subject, prefixes)
  const propertyIRI = expandPrefix(property, prefixes)
  
  const quads = store.getQuads(subjectIRI, propertyIRI, null, null)
  return quads.length > 0 ? quads[0].object.value : null
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
  return quads.map(q => q.subject.value)
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
  return quads.map(q => q.object.value)
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
    const value = quad.object.value
    
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
    if (prefixes[prefix]) {
      return prefixes[prefix] + local
    }
  }
  return value
}