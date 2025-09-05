import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadGraph, askGraph, queryTriples, clearGraph } from '../src'
import { setupFreshContext, teardownContext } from './test-utils'

describe('Untology Query', () => {
  beforeEach(async () => {
    setupFreshContext()
    await loadGraph(`
      @prefix : <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix citty: <https://citty.pro/ontology#> .
      
      :alice a foaf:Person ;
             foaf:name "Alice" ;
             foaf:age "30" ;
             foaf:knows :bob, :charlie .
      
      :bob a foaf:Person ;
           foaf:name "Bob" ;
           foaf:age "25" .
      
      :charlie a foaf:Person ;
               foaf:name "Charlie" .
      
      :deploy a citty:Command ;
              citty:name "deploy" ;
              citty:description "Deploy the application" .
      
      :test a citty:Command ;
            citty:name "test" .
    `, {
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        citty: 'https://citty.pro/ontology#'
      }
    })
  })

  afterEach(() => {
    teardownContext()
  })

  describe('askGraph - Natural Language Queries', () => {
    it('should list all entities of a type', async () => {
      const people = await askGraph('list all Person')
      expect(people).toContain(':alice')
      expect(people).toContain(':bob')
      expect(people).toContain(':charlie')

      const commands = await askGraph('find all Command')
      expect(commands).toContain(':deploy')
      expect(commands).toContain(':test')
    })

    it('should get property values', async () => {
      const name = await askGraph("what is alice's name")
      expect(name).toBe('Alice')

      const age = await askGraph("what is bob's age")
      expect(age).toBe('25')
    })

    it('should count entities', async () => {
      const count = await askGraph('count Person')
      expect(count).toBe(3)

      const cmdCount = await askGraph('count Command')
      expect(cmdCount).toBe(2)
    })

    it('should describe entities', async () => {
      const description = await askGraph('describe alice')
      expect(description.id).toBe('alice')
      expect(description.properties).toHaveProperty('http://xmlns.com/foaf/0.1/name', 'Alice')
      expect(description.properties).toHaveProperty('http://xmlns.com/foaf/0.1/age', '30')
    })

    it('should handle "how many" queries', async () => {
      const count = await askGraph('how many people are there')
      expect(count).toBe(3)
    })

    it('should throw on unparseable queries', async () => {
      await expect(askGraph('random gibberish query')).rejects.toThrow()
    })
  })

  describe('queryTriples - SPO Queries', () => {
    it('should query all triples', () => {
      const all = queryTriples()
      expect(all.length).toBeGreaterThan(0)
    })

    it('should query by subject', () => {
      const aliceTriples = queryTriples(':alice')
      expect(aliceTriples).toHaveLength(5)
      expect(aliceTriples.every(t => t.subject === ':alice')).toBe(true)
    })

    it('should query by predicate', () => {
      const names = queryTriples(null, 'foaf:name')
      expect(names).toHaveLength(3)
      expect(names.every(t => t.predicate === 'http://xmlns.com/foaf/0.1/name')).toBe(true)
    })

    it('should query by object', () => {
      const knowsBob = queryTriples(null, null, ':bob')
      expect(knowsBob).toHaveLength(1)
      expect(knowsBob[0].subject).toBe(':alice')
      expect(knowsBob[0].predicate).toBe('http://xmlns.com/foaf/0.1/knows')
    })

    it('should query with multiple constraints', () => {
      const specific = queryTriples(':alice', 'foaf:name')
      expect(specific).toHaveLength(1)
      expect(specific[0].object).toBe('Alice')
    })
  })
})