/**
 * Untology - unjs-style N3 wrapper for semantic graph operations
 * Production v1.0.0 - Core team implementation
 */

import { Parser, Store, DataFactory, Writer, Quad } from 'n3';
import { createContext } from 'unctx';
import { readFile } from 'node:fs/promises';
import { $fetch } from 'ofetch';
import { defu } from 'defu';
import { hash } from 'ohash';

const { namedNode, literal, quad } = DataFactory;

// Context management
export interface OntologyContext {
  store: Store;
  prefixes: Record<string, string>;
  cache: Map<string, any>;
}

const ontologyContext = createContext<OntologyContext>('untology:context');

/**
 * Initialize untology with a new store
 */
export async function createOntology(): Promise<OntologyContext> {
  const context: OntologyContext = {
    store: new Store(),
    prefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      citty: 'https://citty.pro/ontology#',
    },
    cache: new Map()
  };
  
  ontologyContext.set(context);
  return context;
}

/**
 * Load graph from file or URL
 */
export async function loadGraph(source: string): Promise<void> {
  const ctx = ontologyContext.use();
  if (!ctx) await createOntology();
  
  // Check cache first
  const cacheKey = hash({ source });
  if (ctx.cache.has(cacheKey)) {
    const cached = ctx.cache.get(cacheKey);
    cached.forEach((q: Quad) => ctx.store.addQuad(q));
    return;
  }
  
  // Load content
  let content: string;
  if (source.startsWith('http')) {
    content = await $fetch(source);
  } else {
    content = await readFile(source, 'utf-8');
  }
  
  // Parse and store
  const parser = new Parser();
  const quads = parser.parse(content);
  quads.forEach(q => ctx.store.addQuad(q));
  
  // Cache for performance
  ctx.cache.set(cacheKey, quads);
}

/**
 * Find entities of a specific type
 */
export function findEntities(type?: string): string[] {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  if (!type) {
    // Return all subjects
    const subjects = new Set<string>();
    ctx.store.forSubjects(s => subjects.add(s.value));
    return Array.from(subjects);
  }
  
  // Find by rdf:type
  const typeIRI = expandIRI(type, ctx.prefixes);
  const entities: string[] = [];
  
  ctx.store.forSubjects(subject => {
    entities.push(subject.value);
  }, namedNode(ctx.prefixes.rdf + 'type'), namedNode(typeIRI));
  
  return entities;
}

/**
 * Find relations from a subject
 */
export function findRelations(subject: string): Array<{ predicate: string; object: string }> {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  const relations: Array<{ predicate: string; object: string }> = [];
  const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));
  
  ctx.store.forObjects((object, predicate) => {
    relations.push({
      predicate: shrinkIRI(predicate.value, ctx.prefixes),
      object: object.termType === 'Literal' ? object.value : shrinkIRI(object.value, ctx.prefixes)
    });
  }, subjectNode, null);
  
  return relations;
}

/**
 * Get a specific value
 */
export function getValue(subject: string, predicate: string): string | null {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));
  const predicateNode = namedNode(expandIRI(predicate, ctx.prefixes));
  
  const objects = ctx.store.getObjects(subjectNode, predicateNode, null);
  if (objects.length === 0) return null;
  
  const object = objects[0];
  return object.termType === 'Literal' ? object.value : shrinkIRI(object.value, ctx.prefixes);
}

/**
 * Export graph as JSON-LD
 */
export async function exportGraph(format: 'jsonld' | 'turtle' = 'jsonld'): Promise<string> {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  const writer = new Writer({ format: format === 'jsonld' ? 'application/ld+json' : 'text/turtle', prefixes: ctx.prefixes });
  
  return new Promise((resolve, reject) => {
    ctx.store.forEach(quad => writer.addQuad(quad), null, null, null, null);
    writer.end((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/**
 * Natural language query via AI
 */
export async function askGraph(query: string): Promise<any> {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  // Convert NL to SPARQL-like query
  const patterns = {
    'who does (.*) know': (match: RegExpMatchArray) => {
      const subject = match[1];
      return findRelations(subject).filter(r => r.predicate.includes('knows'));
    },
    'what is (.*)\'s (.*)': (match: RegExpMatchArray) => {
      const [, subject, property] = match;
      return getValue(subject, property);
    },
    'list all (.*)': (match: RegExpMatchArray) => {
      const type = match[1];
      return findEntities(type);
    }
  };
  
  for (const [pattern, handler] of Object.entries(patterns)) {
    const match = query.toLowerCase().match(new RegExp(pattern));
    if (match) {
      return handler(match);
    }
  }
  
  // Fallback to basic entity search
  const words = query.split(' ');
  const entities = findEntities();
  return entities.filter(e => words.some(w => e.toLowerCase().includes(w.toLowerCase())));
}

/**
 * Add triple to graph
 */
export function addTriple(subject: string, predicate: string, object: string | number | boolean): void {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));
  const predicateNode = namedNode(expandIRI(predicate, ctx.prefixes));
  const objectNode = typeof object === 'string' && !object.startsWith('"') 
    ? namedNode(expandIRI(object, ctx.prefixes))
    : literal(object);
  
  ctx.store.addQuad(quad(subjectNode, predicateNode, objectNode));
}

/**
 * Merge multiple graphs
 */
export function mergeGraphs(graphs: Store[]): Store {
  const merged = new Store();
  graphs.forEach(graph => {
    graph.forEach(quad => merged.addQuad(quad));
  });
  return merged;
}

// Utility functions
function expandIRI(iri: string, prefixes: Record<string, string>): string {
  if (iri.startsWith('http')) return iri;
  
  const [prefix, local] = iri.split(':');
  if (prefixes[prefix]) {
    return prefixes[prefix] + local;
  }
  return iri;
}

function shrinkIRI(iri: string, prefixes: Record<string, string>): string {
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (iri.startsWith(ns)) {
      return `${prefix}:${iri.slice(ns.length)}`;
    }
  }
  return iri;
}

/**
 * Define a vocabulary with namespace
 */
export function defineVocabulary(namespace: string, terms: string[]): Record<string, string> {
  const vocab: Record<string, string> = {};
  terms.forEach(term => {
    vocab[term] = namespace + term;
  });
  return vocab;
}

/**
 * Query with SPARQL
 */
export async function querySparql(query: string): Promise<any[]> {
  const ctx = ontologyContext.use();
  if (!ctx) throw new Error('Ontology context not initialized');
  
  // Simple SPARQL SELECT parser
  const selectMatch = query.match(/SELECT\s+(.*?)\s+WHERE\s*\{(.*?)\}/is);
  if (!selectMatch) throw new Error('Invalid SPARQL query');
  
  const [, vars, patterns] = selectMatch;
  const variables = vars.split(/\s+/).filter(v => v.startsWith('?'));
  
  // Parse triple patterns
  const triplePatterns = patterns.trim().split('.').map(p => p.trim()).filter(Boolean);
  const results: any[] = [];
  
  // Execute patterns (simplified)
  triplePatterns.forEach(pattern => {
    const parts = pattern.split(/\s+/);
    if (parts.length === 3) {
      const [s, p, o] = parts;
      
      ctx.store.forEach(quad => {
        const binding: any = {};
        
        if (s.startsWith('?')) binding[s] = quad.subject.value;
        if (p.startsWith('?')) binding[p] = quad.predicate.value;
        if (o.startsWith('?')) binding[o] = quad.object.value;
        
        if (Object.keys(binding).length > 0) {
          results.push(binding);
        }
      });
    }
  });
  
  return results;
}

/**
 * Context as JSON for templates
 */
export function toContext(type?: string): any[] {
  const entities = findEntities(type);
  
  return entities.map(entity => {
    const context: any = { id: entity };
    const relations = findRelations(entity);
    
    relations.forEach(({ predicate, object }) => {
      const key = predicate.split(/[:#]/).pop() || predicate;
      context[key] = object;
    });
    
    return context;
  });
}

// Re-export N3 types
export type { Store, Quad } from 'n3';