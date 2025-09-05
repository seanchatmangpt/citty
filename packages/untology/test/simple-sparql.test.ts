/**
 * Basic SPARQL engine validation tests
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { validateSparqlQuery } from '../src/sparql-engine'
import { loadGraph } from '../src/core'

beforeAll(async () => {
  // Initialize the ontology context with simple test data
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:alice ex:name "Alice" .
    ex:bob ex:name "Bob" .
  `
  
  await loadGraph(testData, { format: 'turtle' })
})

describe('SPARQL Engine - Basic Validation', () => {
  it('should validate correct SPARQL syntax', () => {
    const query = `
      SELECT ?s ?p ?o
      WHERE {
        ?s ?p ?o .
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should detect basic syntax errors', () => {
    const query = `
      SELEKT ?s ?p ?o
      WHERE {
        ?s ?p ?o .
      }
    ` // Typo in SELECT
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('should validate complex SELECT queries', () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name
      WHERE {
        ?person ex:name ?name .
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate ASK queries', () => {
    const query = `
      PREFIX ex: <http://example.org/>
      ASK {
        ?person ex:name "Alice" .
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate CONSTRUCT queries', () => {
    const query = `
      PREFIX ex: <http://example.org/>
      CONSTRUCT {
        ?person ex:hasName ?name .
      }
      WHERE {
        ?person ex:name ?name .
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should detect missing WHERE clause', () => {
    const query = `
      SELECT ?s ?p ?o
      {
        ?s ?p ?o .
      }
    ` // Missing WHERE keyword
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(false)
  })

  it('should validate FILTER expressions', () => {
    const query = `
      SELECT ?name ?age
      WHERE {
        ?person <http://example.org/name> ?name .
        ?person <http://example.org/age> ?age .
        FILTER (?age > 25)
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate ORDER BY clauses', () => {
    const query = `
      SELECT ?name ?age
      WHERE {
        ?person <http://example.org/name> ?name .
        ?person <http://example.org/age> ?age .
      }
      ORDER BY DESC(?age)
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate LIMIT and OFFSET', () => {
    const query = `
      SELECT ?name
      WHERE {
        ?person <http://example.org/name> ?name .
      }
      ORDER BY ?name
      LIMIT 10
      OFFSET 5
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate OPTIONAL clauses', () => {
    const query = `
      SELECT ?name ?age
      WHERE {
        ?person <http://example.org/name> ?name .
        OPTIONAL {
          ?person <http://example.org/age> ?age .
        }
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })
})

describe('SPARQL Engine - Advanced Features', () => {
  it('should validate UNION queries', () => {
    const query = `
      SELECT ?value
      WHERE {
        {
          ?person <http://example.org/name> ?value .
        } UNION {
          ?person <http://example.org/age> ?value .
        }
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate aggregate functions', () => {
    const query = `
      SELECT (COUNT(?person) as ?count)
      WHERE {
        ?person <http://example.org/name> ?name .
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate GROUP BY clauses', () => {
    const query = `
      SELECT ?dept (COUNT(?person) as ?count)
      WHERE {
        ?person <http://example.org/department> ?dept .
      }
      GROUP BY ?dept
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate BIND expressions', () => {
    const query = `
      SELECT ?name ?category
      WHERE {
        ?person <http://example.org/name> ?name .
        ?person <http://example.org/age> ?age .
        BIND(IF(?age < 30, "Young", "Adult") AS ?category)
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })

  it('should validate VALUES clauses', () => {
    const query = `
      SELECT ?name
      WHERE {
        ?person <http://example.org/name> ?name .
        VALUES ?name { "Alice" "Bob" }
      }
    `
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(true)
  })
})