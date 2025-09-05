import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadGraph,
  exportTurtle,
  exportJsonLd,
  exportNTriples,
  toContextObjects,
  clearGraph
} from '../src'

describe('Untology Export', () => {
  beforeEach(async () => {
    clearGraph()
    await loadGraph(`
      @prefix : <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix citty: <https://citty.pro/ontology#> .
      
      :deploy a citty:Command ;
              citty:name "deploy" ;
              citty:description "Deploy the application" ;
              citty:args "env", "version" .
      
      :test a citty:Command ;
            citty:name "test" ;
            citty:description "Run tests" .
    `)
  })

  afterEach(() => {
    clearGraph()
  })

  describe('exportTurtle', () => {
    it('should export to Turtle format', async () => {
      const turtle = await exportTurtle()
      expect(turtle).toContain('citty:Command')
      expect(turtle).toContain('citty:name')
      expect(turtle).toContain('"deploy"')
    })
  })

  describe('exportJsonLd', () => {
    it('should export to JSON-LD format', async () => {
      const jsonld = await exportJsonLd()
      expect(jsonld).toBeTruthy()
      // JSON-LD output would be a valid JSON string
    })
  })

  describe('exportNTriples', () => {
    it('should export to N-Triples format', async () => {
      const ntriples = await exportNTriples()
      expect(ntriples).toContain('<:deploy>')
      expect(ntriples).toContain('<https://citty.pro/ontology#Command>')
    })
  })

  describe('toContextObjects', () => {
    it('should export all entities as context objects', () => {
      const contexts = toContextObjects()
      expect(contexts).toHaveLength(2)
      
      const deploy = contexts.find(c => c.id === 'deploy')
      expect(deploy).toBeDefined()
      expect(deploy['citty:name']).toBe('deploy')
      expect(deploy['citty:description']).toBe('Deploy the application')
    })

    it('should export entities of specific type', () => {
      const commands = toContextObjects('citty:Command')
      expect(commands).toHaveLength(2)
      expect(commands.every(c => c['rdf:type'] === 'citty:Command')).toBe(true)
    })

    it('should handle multiple values as arrays', () => {
      const contexts = toContextObjects()
      const deploy = contexts.find(c => c.id === 'deploy')
      expect(deploy['citty:args']).toEqual(['env', 'version'])
    })

    it('should simplify IRIs to prefixed names', () => {
      const contexts = toContextObjects()
      const deploy = contexts.find(c => c.id === 'deploy')
      expect(deploy['rdf:type']).toBe('citty:Command')
      expect(deploy['citty:name']).toBe('deploy')
    })
  })
})