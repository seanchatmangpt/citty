/**
 * Comprehensive test suite for production SPARQL 1.1 engine
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { Store, DataFactory } from 'n3'
import { SPARQLEngine, sparqlQuery, validateSparqlQuery, explainSparqlQuery } from '../src/sparql-engine'
import { loadGraph } from '../src/core'

const { namedNode, literal, quad } = DataFactory

// Test data setup
const testStore = new Store()

beforeAll(async () => {
  // Initialize the ontology context with empty store
  await loadGraph('', { format: 'turtle' })
})

beforeEach(() => {
  testStore.removeQuads(testStore.getQuads(null, null, null, null))
  
  // Add test triples
  testStore.addQuad(quad(
    namedNode('http://example.org/person/alice'),
    namedNode('http://example.org/name'),
    literal('Alice')
  ))
  
  testStore.addQuad(quad(
    namedNode('http://example.org/person/alice'),
    namedNode('http://example.org/age'),
    literal('30', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
  ))
  
  testStore.addQuad(quad(
    namedNode('http://example.org/person/bob'),
    namedNode('http://example.org/name'),
    literal('Bob')
  ))
  
  testStore.addQuad(quad(
    namedNode('http://example.org/person/bob'),
    namedNode('http://example.org/age'),
    literal('25', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
  ))
  
  testStore.addQuad(quad(
    namedNode('http://example.org/person/charlie'),
    namedNode('http://example.org/name'),
    literal('Charlie')
  ))
  
  testStore.addQuad(quad(
    namedNode('http://example.org/person/charlie'),
    namedNode('http://example.org/age'),
    literal('35', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
  ))
})

describe('SPARQL Engine - Core Functionality', () => {
  it('should execute basic SELECT query', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(3)
    
    const names = results.map(r => r.name).sort()
    expect(names).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('should execute SELECT query with FILTER', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
        FILTER (?age > 27)
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(2)
    
    const names = results.map(r => r.name).sort()
    expect(names).toEqual(['Alice', 'Charlie'])
  })

  it('should execute SELECT query with ORDER BY', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
      }
      ORDER BY ?age
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(3)
    
    const ages = results.map(r => r.age)
    expect(ages).toEqual([25, 30, 35])
  })

  it('should execute SELECT query with LIMIT', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
      }
      ORDER BY ?age
      LIMIT 2
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(2)
    
    const names = results.map(r => r.name)
    expect(names).toEqual(['Bob', 'Alice'])
  })

  it('should execute SELECT query with DISTINCT', async () => {
    // Add duplicate data
    testStore.addQuad(quad(
      namedNode('http://example.org/person/alice2'),
      namedNode('http://example.org/name'),
      literal('Alice')
    ))
    
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT DISTINCT ?name
      WHERE {
        ?person ex:name ?name .
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(3) // Alice, Bob, Charlie (distinct)
  })
})

describe('SPARQL Engine - Advanced Features', () => {
  it('should handle UNION queries', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?value
      WHERE {
        {
          ?person ex:name ?value .
        } UNION {
          ?person ex:age ?value .
        }
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results.length).toBeGreaterThan(3) // Names + ages
  })

  it('should handle OPTIONAL queries', async () => {
    // Add person without age
    testStore.addQuad(quad(
      namedNode('http://example.org/person/dave'),
      namedNode('http://example.org/name'),
      literal('Dave')
    ))
    
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        OPTIONAL { ?person ex:age ?age . }
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(4) // Alice, Bob, Charlie, Dave
    
    // Dave should have name but no age
    const dave = results.find(r => r.name === 'Dave')
    expect(dave).toBeDefined()
    expect(dave!.age).toBeUndefined()
  })

  it('should handle aggregate functions', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT (COUNT(?person) as ?count) (AVG(?age) as ?avgAge)
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(1)
    expect(results[0].count).toBe(3)
    expect(results[0].avgAge).toBe(30) // (25 + 30 + 35) / 3
  })

  it('should handle GROUP BY', async () => {
    // Add more test data for grouping
    testStore.addQuad(quad(
      namedNode('http://example.org/person/alice'),
      namedNode('http://example.org/department'),
      literal('Engineering')
    ))
    
    testStore.addQuad(quad(
      namedNode('http://example.org/person/bob'),
      namedNode('http://example.org/department'),
      literal('Engineering')
    ))
    
    testStore.addQuad(quad(
      namedNode('http://example.org/person/charlie'),
      namedNode('http://example.org/department'),
      literal('Sales')
    ))
    
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?dept (COUNT(?person) as ?count)
      WHERE {
        ?person ex:department ?dept .
      }
      GROUP BY ?dept
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(2)
    
    const engineering = results.find(r => r.dept === 'Engineering')
    const sales = results.find(r => r.dept === 'Sales')
    
    expect(engineering?.count).toBe(2)
    expect(sales?.count).toBe(1)
  })
})

describe('SPARQL Engine - Query Validation', () => {
  it('should validate correct SPARQL queries', () => {
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

  it('should detect syntax errors', () => {
    const query = `
      SELECT ?s ?p ?o
      WHERE {
        ?s ?p ?o
      }
    ` // Missing dot
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('should detect invalid keywords', () => {
    const query = `
      SELEKT ?s ?p ?o
      WHERE {
        ?s ?p ?o .
      }
    ` // Typo in SELECT
    
    const validation = validateSparqlQuery(query)
    expect(validation.valid).toBe(false)
  })
})

describe('SPARQL Engine - Performance Features', () => {
  it('should cache query results', async () => {
    const engine = new SPARQLEngine()
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name
      WHERE {
        ?person ex:name ?name .
      }
    `
    
    // First execution
    const result1 = await engine.execute(query)
    expect(result1.metadata.cached).toBe(false)
    
    // Second execution should be cached
    const result2 = await engine.execute(query)
    expect(result2.metadata.cached).toBe(true)
    expect(result2.metadata.executionTime).toBeLessThan(result1.metadata.executionTime)
  })

  it('should provide execution plans', () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
        FILTER (?age > 25)
      }
    `
    
    const explanation = explainSparqlQuery(query)
    expect(typeof explanation).toBe('string')
    expect(explanation.length).toBeGreaterThan(0)
  })

  it('should track query statistics', async () => {
    const engine = new SPARQLEngine()
    const query = `SELECT * WHERE { ?s ?p ?o }`
    
    await engine.execute(query)
    await engine.execute(query)
    
    const stats = engine.getEngineStatistics()
    expect(stats.queryStats.totalQueries).toBeGreaterThan(0)
  })

  it('should optimize query performance', async () => {
    const engine = new SPARQLEngine()
    
    // Complex query that should benefit from optimization
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:age ?age .
        ?person ex:name ?name .
        FILTER (?age > 20)
      }
      ORDER BY ?age
    `
    
    const plan = engine.getExecutionPlan(query)
    expect(plan.estimatedCost).toBeGreaterThan(0)
    expect(plan.optimizations.length).toBeGreaterThan(0)
  })
})

describe('SPARQL Engine - SPARQL 1.1 Compliance', () => {
  it('should handle property paths', async () => {
    // Add hierarchical data
    testStore.addQuad(quad(
      namedNode('http://example.org/person/alice'),
      namedNode('http://example.org/knows'),
      namedNode('http://example.org/person/bob')
    ))
    
    testStore.addQuad(quad(
      namedNode('http://example.org/person/bob'),
      namedNode('http://example.org/knows'),
      namedNode('http://example.org/person/charlie')
    ))
    
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?person ?connected
      WHERE {
        ?person ex:knows+ ?connected .
      }
    `
    
    // This should find transitive connections
    const results = await sparqlQuery(query)
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('should handle BIND expressions', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?ageCategory
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
        BIND(IF(?age < 30, "Young", "Mature") AS ?ageCategory)
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(3)
    
    const bob = results.find(r => r.name === 'Bob')
    expect(bob?.ageCategory).toBe('Young')
    
    const alice = results.find(r => r.name === 'Alice')
    expect(alice?.ageCategory).toBe('Mature')
  })

  it('should handle VALUES clauses', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name ?age
      WHERE {
        ?person ex:name ?name .
        ?person ex:age ?age .
        VALUES ?name { "Alice" "Bob" }
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(2)
    
    const names = results.map(r => r.name).sort()
    expect(names).toEqual(['Alice', 'Bob'])
  })

  it('should handle MINUS operations', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name
      WHERE {
        ?person ex:name ?name .
        MINUS {
          ?person ex:age ?age .
          FILTER (?age < 30)
        }
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(2) // Alice and Charlie (age >= 30)
    
    const names = results.map(r => r.name).sort()
    expect(names).toEqual(['Alice', 'Charlie'])
  })
})

describe('SPARQL Engine - Error Handling', () => {
  it('should handle malformed queries gracefully', async () => {
    const query = 'INVALID SPARQL QUERY'
    
    await expect(sparqlQuery(query)).rejects.toThrow()
  })

  it('should handle queries with undefined prefixes', async () => {
    const query = `
      SELECT ?s ?p ?o
      WHERE {
        ?s unknown:predicate ?o .
      }
    `
    
    // Should not throw, but may return empty results
    const results = await sparqlQuery(query)
    expect(Array.isArray(results)).toBe(true)
  })

  it('should handle empty result sets', async () => {
    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?name
      WHERE {
        ?person ex:nonExistentProperty ?name .
      }
    `
    
    const results = await sparqlQuery(query)
    expect(results).toHaveLength(0)
  })
})

describe('SPARQL Engine - Memory Management', () => {
  it('should manage memory efficiently', async () => {
    const engine = new SPARQLEngine()
    
    // Execute many queries to test memory management
    const queries = []
    for (let i = 0; i < 100; i++) {
      queries.push(`SELECT * WHERE { ?s ?p "${i}" }`)
    }
    
    const results = await Promise.all(
      queries.map(q => engine.execute(q))
    )
    
    expect(results).toHaveLength(100)
    
    // Check memory usage
    const memoryInfo = engine.getMemoryUsage()
    expect(typeof memoryInfo.indexMemory).toBe('number')
  })

  it('should clear caches when requested', async () => {
    const engine = new SPARQLEngine()
    const query = `SELECT * WHERE { ?s ?p ?o }`
    
    await engine.execute(query)
    let stats = engine.getEngineStatistics()
    expect(stats.queryStats.totalQueries).toBeGreaterThan(0)
    
    engine.clearCache()
    stats = engine.getEngineStatistics()
    expect(stats.queryStats.totalQueries).toBe(0)
  })

  it('should optimize indexes based on usage', async () => {
    const engine = new SPARQLEngine()
    
    // Execute queries that should trigger index optimization
    const queries = [
      `SELECT ?s WHERE { ?s <http://example.org/name> ?o }`,
      `SELECT ?s WHERE { ?s <http://example.org/age> ?o }`,
      `SELECT ?s WHERE { ?s <http://example.org/department> ?o }`
    ]
    
    for (const query of queries) {
      await engine.execute(query)
    }
    
    // Trigger index optimization
    engine.optimizeIndexes()
    
    const indexUsage = engine.getIndexUsage()
    expect(indexUsage.size).toBeGreaterThan(0)
  })
})