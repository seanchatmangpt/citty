import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadGraph,
  findEntities,
  findRelations,
  getValue,
  getValues,
  addTriple,
  removeTriples,
  hasTriple,
  graphSize,
  clearGraph
} from '../src'
import { setupFreshContext, teardownContext, withCleanContext } from './test-utils'

describe('Untology Core', () => {
  const sampleTurtle = `
    @prefix : <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix citty: <https://citty.pro/ontology#> .
    
    :alice a foaf:Person ;
           foaf:name "Alice" ;
           foaf:knows :bob .
    
    :bob a foaf:Person ;
         foaf:name "Bob" ;
         foaf:knows :alice .
    
    :deploy a citty:Command ;
            citty:name "deploy" ;
            citty:description "Deploy the application" .
  `

  beforeEach(async () => {
    setupFreshContext()
    await loadGraph(sampleTurtle, {
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        citty: 'https://citty.pro/ontology#'
      }
    })
  })

  afterEach(() => {
    teardownContext()
  })

  describe('loadGraph', () => {
    it('should load a Turtle string', async () => {
      expect(graphSize()).toBeGreaterThan(0)
    })
  })

  describe('findEntities', () => {
    it('should find all entities', () => {
      const entities = findEntities()
      expect(entities).toContain(':alice')
      expect(entities).toContain(':bob')
      expect(entities).toContain(':deploy')
    })

    it('should find entities by type', () => {
      const people = findEntities('foaf:Person')
      expect(people).toHaveLength(2)
      expect(people).toContain(':alice')
      expect(people).toContain(':bob')

      const commands = findEntities('citty:Command')
      expect(commands).toHaveLength(1)
      expect(commands).toContain(':deploy')
    })
  })

  describe('findRelations', () => {
    it('should find all relations from a subject', () => {
      const relations = findRelations(':alice')
      expect(relations).toHaveLength(3)
      
      const predicates = relations.map(r => r.predicate)
      expect(predicates).toContain('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
      expect(predicates).toContain('http://xmlns.com/foaf/0.1/name')
      expect(predicates).toContain('http://xmlns.com/foaf/0.1/knows')
    })
  })

  describe('getValue', () => {
    it('should get a single value', () => {
      const name = getValue(':alice', 'foaf:name')
      expect(name).toBe('Alice')
    })

    it('should return null for non-existent property', () => {
      const email = getValue(':alice', 'foaf:email')
      expect(email).toBeNull()
    })
  })

  describe('getValues', () => {
    it('should get all values for a property', () => {
      const knows = getValues(':alice', 'foaf:knows')
      expect(knows).toHaveLength(1)
      expect(knows).toContain(':bob')
    })
  })

  describe('addTriple', () => {
    it('should add a new triple', () => {
      const sizeBefore = graphSize()
      addTriple(':charlie', 'foaf:name', '"Charlie"')
      expect(graphSize()).toBe(sizeBefore + 1)
      expect(getValue(':charlie', 'foaf:name')).toBe('Charlie')
    })
  })

  describe('removeTriples', () => {
    it('should remove matching triples', () => {
      const removed = removeTriples(':alice', 'foaf:knows')
      expect(removed).toBe(1)
      expect(hasTriple(':alice', 'foaf:knows', ':bob')).toBe(false)
    })

    it('should remove all triples for a subject', () => {
      const removed = removeTriples(':alice')
      expect(removed).toBe(3)
      expect(findRelations(':alice')).toHaveLength(0)
    })
  })

  describe('hasTriple', () => {
    it('should check if triple exists', () => {
      expect(hasTriple(':alice', 'foaf:name', '"Alice"')).toBe(true)
      expect(hasTriple(':alice', 'foaf:email')).toBe(false)
    })
  })

  describe('clearGraph', () => {
    it('should remove all triples', () => {
      clearGraph()
      expect(graphSize()).toBe(0)
    })
  })
})