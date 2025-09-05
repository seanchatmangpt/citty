import { useOntology } from './context'
import { findEntities, getValue } from './core'
import { askNaturalLanguage } from './natural-language-engine'

/**
 * @deprecated Use askNaturalLanguage() instead for better natural language processing
 * Legacy simple natural language query interface - kept for backward compatibility
 */
export async function askGraph(query: string): Promise<any> {
  console.warn('askGraph is deprecated. Use askNaturalLanguage() from natural-language-engine for better results.')
  
  try {
    // Try using the new natural language engine first
    const response = await askNaturalLanguage(query)
    return response.results || response.answer
  } catch (error) {
    // Fallback to legacy pattern matching if NL engine fails
    console.warn('Natural language engine failed, falling back to legacy pattern matching:', error.message)
    return legacyAskGraph(query)
  }
}

/**
 * Legacy pattern-based query matching (internal fallback)
 */
function legacyAskGraph(query: string): any {
  const { store, prefixes } = useOntology()
  
  // Pattern matching for common natural language queries
  if (query.match(/^(list|get|find|show)?\s*all\s+(\w+)/i)) {
    const match = query.match(/^(list|get|find|show)?\s*all\s+(\w+)/i)
    const type = match![2]
    
    // Try to find the type with common prefixes
    let typeIRI = type
    if (!type.includes(':')) {
      // Try common prefixes for types, checking if entities actually exist for each
      const commonTypePrefixes = ['foaf', 'citty', 'rdf', 'rdfs', 'owl']
      for (const prefix of commonTypePrefixes) {
        const candidate = `${prefix}:${type}`
        const expanded = expandPrefix(candidate, prefixes)
        if (expanded !== candidate) { // Valid prefix expansion
          // Check if any entities actually exist with this type
          const testTypeIRI = expandPrefix(candidate, prefixes)
          const rdfType = expandPrefix('rdf:type', prefixes)
          const quads = store.getQuads(null, rdfType, testTypeIRI, null)
          if (quads.length > 0) {
            typeIRI = candidate
            break
          }
        }
      }
    }
    
    const result = findEntities(typeIRI)
    return result
  }
  
  if (query.match(/^what\s+is\s+(\w+)'?s?\s+(\w+)/i)) {
    const match = query.match(/^what\s+is\s+(\w+)'?s?\s+(\w+)/i)!
    const [, subject, property] = match
    
    // Try to find the property with common prefixes
    let propertyIRI = property
    let subjectIRI = subject
    
    if (!property.includes(':')) {
      const commonPropertyPrefixes = ['foaf', 'citty', 'rdf', 'rdfs', 'dcterms']
      for (const prefix of commonPropertyPrefixes) {
        const candidate = `${prefix}:${property}`
        const expanded = expandPrefix(candidate, prefixes)
        if (expanded !== candidate) {
          propertyIRI = candidate
          break
        }
      }
    }
    
    if (!subject.includes(':') && !subject.startsWith('http')) {
      subjectIRI = `:${subject}` // Assume base namespace
    }
    
    const result = getValue(subjectIRI, propertyIRI)
    return result
  }
  
  if (query.match(/^count\s+(\w+)/i)) {
    const match = query.match(/^count\s+(\w+)/i)!
    const type = match[1]
    
    // Try to find the type with common prefixes
    let typeIRI = type
    if (!type.includes(':')) {
      const commonTypePrefixes = ['foaf', 'citty', 'rdf', 'rdfs', 'owl']
      for (const prefix of commonTypePrefixes) {
        const candidate = `${prefix}:${type}`
        const expanded = expandPrefix(candidate, prefixes)
        if (expanded !== candidate) {
          // Check if any entities actually exist with this type
          const testTypeIRI = expandPrefix(candidate, prefixes)
          const rdfType = expandPrefix('rdf:type', prefixes)
          const quads = store.getQuads(null, rdfType, testTypeIRI, null)
          if (quads.length > 0) {
            typeIRI = candidate
            break
          }
        }
      }
    }
    
    const entities = findEntities(typeIRI)
    return entities.length
  }
  
  if (query.match(/^describe\s+(\w+)/i)) {
    const match = query.match(/^describe\s+(\w+)/i)!
    const subject = match[1]
    
    let subjectIRI = subject
    if (!subject.includes(':') && !subject.startsWith('http')) {
      subjectIRI = `:${subject}` // Assume base namespace
    }
    
    const expandedSubjectIRI = expandPrefix(subjectIRI, prefixes)
    const quads = store.getQuads(expandedSubjectIRI, null, null, null)
    
    const description = {
      id: subject,
      properties: {} as Record<string, any>
    }
    
    for (const quad of quads) {
      const predicate = quad.predicate.value
      let value = quad.object.value
      
      // Clean up literal values
      if (quad.object.termType === 'Literal') {
        value = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
      }
      
      description.properties[predicate] = value
    }
    
    return description
  }
  
  if (query.toLowerCase().includes('how many')) {
    const typeMatch = query.match(/how many (\w+)/i)
    if (typeMatch) {
      let type = typeMatch[1]
      
      // Handle common plural forms
      if (type.toLowerCase() === 'people') {
        type = 'Person'
      }
      
      // Try to find the type with common prefixes
      let typeIRI = type
      if (!type.includes(':')) {
        const commonTypePrefixes = ['foaf', 'citty', 'rdf', 'rdfs', 'owl']
        for (const prefix of commonTypePrefixes) {
          const candidate = `${prefix}:${type}`
          const expanded = expandPrefix(candidate, prefixes)
          if (expanded !== candidate) {
            // Check if any entities actually exist with this type
            const testTypeIRI = expandPrefix(candidate, prefixes)
            const rdfType = expandPrefix('rdf:type', prefixes)
            const quads = store.getQuads(null, rdfType, testTypeIRI, null)
            if (quads.length > 0) {
              typeIRI = candidate
              break
            }
          }
        }
      }
      
      const entities = findEntities(typeIRI)
      return entities.length
    }
  }
  
  throw new Error(`Unable to parse query: "${query}". Try using askNaturalLanguage() for better natural language processing, or use patterns like "list all Person" or "what is alice's name"`)
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
  
  const result = quads.map(q => ({
    subject: simplifyIRI(q.subject.value, prefixes),
    predicate: q.predicate.value, // Keep full IRI for predicates as expected by tests
    object: q.object.termType === 'Literal' 
      ? (q.object.value.startsWith('"') && q.object.value.endsWith('"') ? q.object.value.slice(1, -1) : q.object.value)
      : simplifyIRI(q.object.value, prefixes)
  }))
  
  return result
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
  // Try to find a prefix match
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