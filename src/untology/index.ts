/**
 * Untology - Production N3 Semantic Graph Operations
 * Clean, well-structured exports following 80/20 principle
 * Version 2.0.0 - Core functionality exposed via clean API
 */

// Core N3 types for convenience
export type { Store, Quad, Term, NamedNode, Literal, BlankNode } from 'n3';

// Re-export implementation with clean structure
import { Parser, Store, DataFactory, Writer, Quad, Term, NamedNode, Literal, BlankNode } from 'n3';
import { createContext } from 'unctx';
import { readFile } from 'node:fs/promises';
import { $fetch } from 'ofetch';
import { defu } from 'defu';
import { hash } from 'ohash';

const { namedNode, literal, quad, blankNode } = DataFactory;

// Performance and memory management constants
const DEFAULT_CACHE_SIZE = 1000;
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_QUERY_COMPLEXITY = 100;
const MAX_GRAPH_SIZE = 10_000;

// Enhanced context interface with caching and monitoring
export interface OntologyContext {
  store: Store;
  prefixes: Record<string, string>;
  cache: Map<string, CacheEntry>;
  metrics: PerformanceMetrics;
  config: OntologyConfig;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface PerformanceMetrics {
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
  lastCleanup: number;
  graphSize: number;
}

interface OntologyConfig {
  maxCacheSize: number;
  defaultTTL: number;
  enableMetrics: boolean;
  maxGraphSize: number;
  enableFuzzyMatching: boolean;
  strictValidation: boolean;
}

// Validation schemas
const IRI_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`]+$/;
const PREFIX_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const CURIE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z0-9_-]+$/;

const ontologyContext = createContext<OntologyContext>('untology:context');

/**
 * Custom error classes for better error handling
 */
export class OntologyError extends Error {
  constructor(message: string, public code: string, public context?: any) {
    super(message);
    this.name = 'OntologyError';
  }
}

export class ValidationError extends OntologyError {
  constructor(message: string, context?: any) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class QueryError extends OntologyError {
  constructor(message: string, context?: any) {
    super(message, 'QUERY_ERROR', context);
    this.name = 'QueryError';
  }
}

/**
 * Initialize untology with enhanced configuration
 */
export async function createOntology(config: Partial<OntologyConfig> = {}): Promise<OntologyContext> {
  const fullConfig = defu(config, {
    maxCacheSize: DEFAULT_CACHE_SIZE,
    defaultTTL: DEFAULT_CACHE_TTL,
    enableMetrics: true,
    maxGraphSize: MAX_GRAPH_SIZE,
    enableFuzzyMatching: true,
    strictValidation: false
  });

  const context: OntologyContext = {
    store: new Store(),
    prefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      citty: 'https://citty.pro/ontology#',
    },
    cache: new Map(),
    metrics: {
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      lastCleanup: Date.now(),
      graphSize: 0
    },
    config: fullConfig
  };
  
  ontologyContext.set(context);
  
  // Schedule periodic cleanup
  if (typeof globalThis !== 'undefined' && globalThis.setInterval) {
    setInterval(() => cleanupCache(context), fullConfig.defaultTTL);
  }
  
  return context;
}

/**
 * Enhanced graph loading with robust error handling and validation
 */
export async function loadGraph(source: string, options: {
  format?: 'turtle' | 'n-triples' | 'n-quads' | 'application/ld+json';
  baseIRI?: string;
  prefixes?: Record<string, string>;
  validate?: boolean;
  merge?: boolean;
} = {}): Promise<void> {
  const startTime = performance.now();
  const ctx = ontologyContext.tryUse() || await createOntology();
  
  try {
    // Validate inputs
    if (!source?.trim()) {
      throw new ValidationError('Source cannot be empty');
    }

    if (options.baseIRI && !IRI_PATTERN.test(options.baseIRI)) {
      throw new ValidationError(`Invalid base IRI: ${options.baseIRI}`);
    }

    if (options.prefixes) {
      for (const [prefix, iri] of Object.entries(options.prefixes)) {
        if (!PREFIX_PATTERN.test(prefix)) {
          throw new ValidationError(`Invalid prefix name: ${prefix}`);
        }
        if (!IRI_PATTERN.test(iri)) {
          throw new ValidationError(`Invalid prefix IRI: ${iri}`);
        }
      }
    }

    // Check cache first
    const cacheKey = hash({ source, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      cached.forEach((q: Quad) => ctx.store.addQuad(q));
      updateMetrics(ctx, startTime, true);
      return;
    }

    // Load content with proper error handling
    let content: string;
    try {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        content = await $fetch<string>(source, {
          timeout: 30000,
          retry: 3,
          headers: {
            'Accept': 'text/turtle, application/n-triples, application/ld+json, */*'
          }
        });
      } else if (isFilePath(source)) {
        content = await readFile(source, 'utf-8');
      } else {
        // Treat as inline content
        content = source;
      }
    } catch (error) {
      throw new OntologyError(
        `Failed to load source: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR',
        { source, error }
      );
    }

    if (!content?.trim()) {
      throw new ValidationError('Loaded content is empty', { source });
    }

    // Parse with enhanced error handling
    const parser = new Parser({
      format: options.format || detectFormat(content, source),
      baseIRI: options.baseIRI
    });

    let quads: Quad[];
    try {
      quads = parser.parse(content);
    } catch (error) {
      throw new OntologyError(
        `Failed to parse RDF content: ${error instanceof Error ? error.message : 'Parse error'}`,
        'PARSE_ERROR',
        { source, format: options.format, error }
      );
    }

    if (quads.length === 0) {
      console.warn(`No triples found in source: ${source}`);
    }

    // Check graph size limits
    const newSize = ctx.store.size + quads.length;
    if (newSize > ctx.config.maxGraphSize) {
      throw new OntologyError(
        `Graph size limit exceeded: ${newSize} > ${ctx.config.maxGraphSize}`,
        'SIZE_LIMIT_EXCEEDED',
        { currentSize: ctx.store.size, newTriples: quads.length, limit: ctx.config.maxGraphSize }
      );
    }

    // Clear existing store if not merging
    if (!options.merge) {
      ctx.store = new Store();
    }

    // Add quads with validation
    if (options.validate || ctx.config.strictValidation) {
      quads = validateQuads(quads);
    }

    quads.forEach(q => ctx.store.addQuad(q));

    // Update prefixes
    if (options.prefixes) {
      Object.assign(ctx.prefixes, options.prefixes);
    }

    // Cache for performance
    putInCache(ctx, cacheKey, quads);
    
    updateMetrics(ctx, startTime, false);
    ctx.metrics.graphSize = ctx.store.size;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Unexpected error during graph loading: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN_ERROR',
      { source, error }
    );
  }
}

/**
 * Enhanced entity finding with performance optimization
 */
export function findEntities(type?: string, options: {
  limit?: number;
  offset?: number;
  orderBy?: string;
} = {}): string[] {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    const cacheKey = hash({ operation: 'findEntities', type, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    let entities: string[];

    if (!type) {
      // Return all subjects with pagination
      const subjects = new Set<string>();
      ctx.store.forSubjects(s => subjects.add(s.value));
      entities = Array.from(subjects);
    } else {
      // Find by rdf:type with optimization
      const typeIRI = expandIRI(type, ctx.prefixes);
      const rdfType = ctx.prefixes.rdf + 'type';
      
      entities = [];
      ctx.store.forSubjects(subject => {
        entities.push(subject.value);
      }, namedNode(rdfType), namedNode(typeIRI));
    }

    // Apply ordering if requested
    if (options.orderBy) {
      entities.sort();
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || entities.length;
    const result = entities.slice(offset, offset + limit);

    putInCache(ctx, cacheKey, result);
    updateMetrics(ctx, startTime, false);
    
    return result;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error finding entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'FIND_ERROR',
      { type, options, error }
    );
  }
}

/**
 * Enhanced relation finding with relationship analysis
 */
export function findRelations(subject: string, options: {
  includeInverse?: boolean;
  filterPredicate?: string;
  limit?: number;
} = {}): Array<{ predicate: string; object: string; type: 'direct' | 'inverse' }> {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    validateIRI(subject, 'subject');

    const cacheKey = hash({ operation: 'findRelations', subject, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    const relations: Array<{ predicate: string; object: string; type: 'direct' | 'inverse' }> = [];
    const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));

    // Direct relations (subject -> predicate -> object)
    ctx.store.forObjects((object, predicate) => {
      if (!options.filterPredicate || predicate.value === expandIRI(options.filterPredicate, ctx.prefixes)) {
        relations.push({
          predicate: shrinkIRI(predicate.value, ctx.prefixes),
          object: object.termType === 'Literal' ? object.value : shrinkIRI(object.value, ctx.prefixes),
          type: 'direct'
        });
      }
    }, subjectNode, null);

    // Inverse relations if requested (object <- predicate <- subject)
    if (options.includeInverse) {
      ctx.store.forSubjects((subj, predicate) => {
        if (!options.filterPredicate || predicate.value === expandIRI(options.filterPredicate, ctx.prefixes)) {
          relations.push({
            predicate: shrinkIRI(predicate.value, ctx.prefixes),
            object: shrinkIRI(subj.value, ctx.prefixes),
            type: 'inverse'
          });
        }
      }, null, subjectNode);
    }

    // Apply limit if specified
    const result = options.limit ? relations.slice(0, options.limit) : relations;

    putInCache(ctx, cacheKey, result);
    updateMetrics(ctx, startTime, false);
    
    return result;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error finding relations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'RELATION_ERROR',
      { subject, options, error }
    );
  }
}

/**
 * Enhanced value retrieval with type coercion
 */
export function getValue<T = string>(
  subject: string, 
  predicate: string, 
  options: {
    datatype?: 'string' | 'number' | 'boolean' | 'date';
    default?: T;
    lang?: string;
  } = {}
): T | null {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    validateIRI(subject, 'subject');
    validateIRI(predicate, 'predicate');

    const cacheKey = hash({ operation: 'getValue', subject, predicate, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached !== undefined) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));
    const predicateNode = namedNode(expandIRI(predicate, ctx.prefixes));

    const objects = ctx.store.getObjects(subjectNode, predicateNode, null);
    if (objects.length === 0) {
      const result = options.default !== undefined ? options.default : null;
      putInCache(ctx, cacheKey, result);
      updateMetrics(ctx, startTime, false);
      return result;
    }

    let object = objects[0];

    // Language filtering for literals
    if (options.lang && objects.length > 1) {
      const langMatch = objects.find(obj => 
        obj.termType === 'Literal' && (obj as Literal).language === options.lang
      );
      if (langMatch) object = langMatch;
    }

    let value: any = object.termType === 'Literal' ? object.value : shrinkIRI(object.value, ctx.prefixes);

    // Type coercion
    if (options.datatype && object.termType === 'Literal') {
      value = coerceValue(value, options.datatype);
    }

    putInCache(ctx, cacheKey, value);
    updateMetrics(ctx, startTime, false);
    
    return value;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error getting value: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'GET_VALUE_ERROR',
      { subject, predicate, options, error }
    );
  }
}

/**
 * Enhanced natural language querying with fuzzy matching and intent recognition
 */
export async function askGraph(query: string, options: {
  fuzzyThreshold?: number;
  includeConfidence?: boolean;
  maxResults?: number;
} = {}): Promise<any> {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    if (!query?.trim()) {
      throw new ValidationError('Query cannot be empty');
    }

    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = hash({ operation: 'askGraph', query: normalizedQuery, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    // Enhanced pattern matching with intent recognition
    const patterns = [
      {
        regex: /^(?:list|get|find|show|what are|give me)\s+(?:all\s+)?(?:the\s+)?(\w+)s?(?:\s+(?:of|with|that|where).*)?$/i,
        intent: 'list_entities',
        handler: (match: RegExpMatchArray) => {
          const type = match[1];
          return findEntitiesOfType(ctx, type, options.maxResults);
        }
      },
      {
        regex: /^(?:what\s+is|tell me|show me)\s+(\w+)'?s?\s+(\w+)$/i,
        intent: 'get_property',
        handler: (match: RegExpMatchArray) => {
          const [, subject, property] = match;
          return getValue(subject, property);
        }
      },
      {
        regex: /^(?:who|which|what)\s+(\w+)\s+(\w+)(?:\s+(.+))?$/i,
        intent: 'find_by_relation',
        handler: (match: RegExpMatchArray) => {
          const [, predicate, object, additional] = match;
          return findSubjectsByRelation(ctx, predicate, object);
        }
      },
      {
        regex: /^(?:how many|count|number of)\s+(\w+)s?(?:\s+(?:are there|exist))?$/i,
        intent: 'count_entities',
        handler: (match: RegExpMatchArray) => {
          const type = match[1];
          const entities = findEntitiesOfType(ctx, type);
          return { count: entities.length, type };
        }
      },
      {
        regex: /^(?:describe|tell me about|show me|what about)\s+(\w+)$/i,
        intent: 'describe_entity',
        handler: (match: RegExpMatchArray) => {
          const subject = match[1];
          return describeEntityEnhanced(ctx, subject);
        }
      },
      {
        regex: /^(?:does|is)\s+(\w+)\s+(?:a|an)\s+(\w+)$/i,
        intent: 'check_type',
        handler: (match: RegExpMatchArray) => {
          const [, entity, type] = match;
          return checkEntityType(ctx, entity, type);
        }
      },
      {
        regex: /^(?:what|which)\s+(\w+)\s+(?:does|do)\s+(\w+)\s+(\w+)$/i,
        intent: 'find_objects',
        handler: (match: RegExpMatchArray) => {
          const [, objectType, subject, predicate] = match;
          return findObjectsByRelation(ctx, subject, predicate);
        }
      }
    ];

    // Try exact pattern matching first
    for (const pattern of patterns) {
      const match = normalizedQuery.match(pattern.regex);
      if (match) {
        try {
          const result = await pattern.handler(match);
          const response = options.includeConfidence 
            ? { result, confidence: 1.0, intent: pattern.intent }
            : result;
          
          putInCache(ctx, cacheKey, response);
          updateMetrics(ctx, startTime, false);
          return response;
        } catch (handlerError) {
          console.warn(`Pattern handler failed for "${query}":`, handlerError);
          // Continue to fuzzy matching
        }
      }
    }

    // Fuzzy matching fallback if enabled
    if (ctx.config.enableFuzzyMatching) {
      const fuzzyResult = performFuzzyMatching(ctx, normalizedQuery, options.fuzzyThreshold || 0.6);
      if (fuzzyResult) {
        const response = options.includeConfidence 
          ? { result: fuzzyResult.result, confidence: fuzzyResult.confidence, intent: 'fuzzy_match' }
          : fuzzyResult.result;
        
        putInCache(ctx, cacheKey, response);
        updateMetrics(ctx, startTime, false);
        return response;
      }
    }

    throw new QueryError(
      `Unable to parse query: "${query}". Try using patterns like "list all Commands", "what is Alice's name", or "count Person"`,
      { query, availablePatterns: patterns.map(p => p.intent) }
    );

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error processing natural language query: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'QUERY_ERROR',
      { query, options, error }
    );
  }
}

/**
 * Enhanced SPARQL query execution with validation and optimization
 */
export async function querySparql(query: string, options: {
  timeout?: number;
  limit?: number;
  offset?: number;
  validate?: boolean;
} = {}): Promise<any[]> {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    if (!query?.trim()) {
      throw new ValidationError('SPARQL query cannot be empty');
    }

    // Basic validation
    if (options.validate !== false) {
      validateSparqlQuery(query);
    }

    const cacheKey = hash({ operation: 'querySparql', query, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    // Enhanced SPARQL parser with better error handling
    const selectMatch = query.match(/SELECT\s+((?:\?[\w_]+\s*)*|\*)\s+WHERE\s*\{\s*(.*?)\s*\}(?:\s+ORDER\s+BY\s+[^}]*)?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?/is);
    
    if (!selectMatch) {
      throw new QueryError('Invalid SPARQL SELECT query format', { query });
    }

    const [, vars, patterns, limitClause, offsetClause] = selectMatch;
    const variables = vars === '*' ? [] : vars.trim().split(/\s+/).filter(v => v.startsWith('?'));
    const limit = options.limit || (limitClause ? parseInt(limitClause, 10) : 1000);
    const offset = options.offset || (offsetClause ? parseInt(offsetClause, 10) : 0);

    if (limit > MAX_QUERY_COMPLEXITY) {
      throw new QueryError(`Query limit too high: ${limit} > ${MAX_QUERY_COMPLEXITY}`, { limit });
    }

    // Parse triple patterns with better error handling
    const triplePatterns = parseTriplePatterns(patterns.trim());
    const results: Record<string, any>[] = [];
    const bindings = new Map<string, Set<string>>();

    // Execute patterns with optimization
    for (const pattern of triplePatterns) {
      if (results.length >= limit + offset) break;
      
      const [s, p, o] = pattern;
      const subjectTerm = s.startsWith('?') ? null : expandIRI(s.replace(/[<>]/g, ''), ctx.prefixes);
      const predicateTerm = p.startsWith('?') ? null : expandIRI(p.replace(/[<>]/g, ''), ctx.prefixes);
      const objectTerm = o.startsWith('?') ? null : (
        o.startsWith('"') ? o.replace(/^"|"$/g, '') : expandIRI(o.replace(/[<>]/g, ''), ctx.prefixes)
      );

      const quads = ctx.store.getQuads(
        subjectTerm ? namedNode(subjectTerm) : null,
        predicateTerm ? namedNode(predicateTerm) : null,
        objectTerm && !o.startsWith('"') ? namedNode(objectTerm) : (objectTerm ? literal(objectTerm) : null),
        null
      );

      for (const quad of quads) {
        const binding: Record<string, string> = {};
        
        if (s.startsWith('?')) {
          binding[s] = quad.subject.value;
        }
        if (p.startsWith('?')) {
          binding[p] = quad.predicate.value;
        }
        if (o.startsWith('?')) {
          binding[o] = quad.object.value;
        }

        if (Object.keys(binding).length > 0) {
          results.push(binding);
        }
      }
    }

    // Remove duplicates and apply pagination
    const uniqueResults = Array.from(
      new Map(results.map(r => [JSON.stringify(r), r])).values()
    ).slice(offset, offset + limit);

    putInCache(ctx, cacheKey, uniqueResults);
    updateMetrics(ctx, startTime, false);
    
    return uniqueResults;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error executing SPARQL query: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SPARQL_ERROR',
      { query, options, error }
    );
  }
}

/**
 * Enhanced export functionality with format detection and validation
 */
export async function exportGraph(format: 'jsonld' | 'turtle' | 'n-triples' = 'turtle', options: {
  prettyPrint?: boolean;
  includeComments?: boolean;
  baseIRI?: string;
} = {}): Promise<string> {
  const startTime = performance.now();
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    const cacheKey = hash({ operation: 'exportGraph', format, options });
    const cached = getFromCache(ctx, cacheKey);
    if (cached) {
      updateMetrics(ctx, startTime, true);
      return cached;
    }

    const formatMap = {
      'jsonld': 'application/ld+json',
      'turtle': 'text/turtle',
      'n-triples': 'application/n-triples'
    };

    const writer = new Writer({
      format: formatMap[format],
      prefixes: format === 'turtle' ? ctx.prefixes : undefined,
      baseIRI: options.baseIRI
    });

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new OntologyError('Export timeout', 'EXPORT_TIMEOUT'));
      }, 30000);

      ctx.store.forEach(quad => {
        try {
          writer.addQuad(quad);
        } catch (error) {
          clearTimeout(timeout);
          reject(new OntologyError(
            `Failed to add quad during export: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'EXPORT_ERROR',
            { quad: quad.toString(), error }
          ));
        }
      });

      writer.end((error, output) => {
        clearTimeout(timeout);
        if (error) {
          reject(new OntologyError(
            `Export failed: ${error.message}`,
            'EXPORT_ERROR',
            { format, error }
          ));
        } else {
          resolve(output);
        }
      });
    });

    putInCache(ctx, cacheKey, result);
    updateMetrics(ctx, startTime, false);
    
    return result;

  } catch (error) {
    updateMetrics(ctx, startTime, false);
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error exporting graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXPORT_ERROR',
      { format, options, error }
    );
  }
}

/**
 * Enhanced triple addition with validation and constraint checking
 */
export function addTriple(subject: string, predicate: string, object: string | number | boolean, options: {
  validate?: boolean;
  allowDuplicates?: boolean;
  datatype?: string;
  language?: string;
} = {}): void {
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    // Input validation
    if (options.validate !== false) {
      validateIRI(subject, 'subject');
      validateIRI(predicate, 'predicate');
    }

    // Check graph size limit
    if (ctx.store.size >= ctx.config.maxGraphSize) {
      throw new OntologyError(
        `Graph size limit exceeded: ${ctx.store.size} >= ${ctx.config.maxGraphSize}`,
        'SIZE_LIMIT_EXCEEDED'
      );
    }

    const subjectNode = namedNode(expandIRI(subject, ctx.prefixes));
    const predicateNode = namedNode(expandIRI(predicate, ctx.prefixes));
    
    // Create object node with enhanced type handling
    let objectNode: Term;
    if (typeof object === 'string' && (object.startsWith('"') || !object.includes(':'))) {
      // Literal value
      const cleanValue = object.replace(/^"|"$/g, '');
      if (options.datatype) {
        objectNode = literal(cleanValue, namedNode(options.datatype));
      } else if (options.language) {
        objectNode = literal(cleanValue, options.language);
      } else {
        objectNode = literal(cleanValue);
      }
    } else if (typeof object === 'number') {
      objectNode = literal(object.toString(), namedNode(ctx.prefixes.xsd + 'decimal'));
    } else if (typeof object === 'boolean') {
      objectNode = literal(object.toString(), namedNode(ctx.prefixes.xsd + 'boolean'));
    } else {
      // IRI reference
      objectNode = namedNode(expandIRI(object.toString(), ctx.prefixes));
    }

    const newQuad = quad(subjectNode, predicateNode, objectNode);

    // Check for duplicates if not allowed
    if (!options.allowDuplicates) {
      const existing = ctx.store.getQuads(subjectNode, predicateNode, objectNode, null);
      if (existing.length > 0) {
        return; // Triple already exists
      }
    }

    ctx.store.addQuad(newQuad);
    ctx.metrics.graphSize = ctx.store.size;

    // Clear related cache entries
    clearRelatedCache(ctx, subject);

  } catch (error) {
    throw error instanceof OntologyError ? error : new OntologyError(
      `Error adding triple: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ADD_TRIPLE_ERROR',
      { subject, predicate, object, options, error }
    );
  }
}

/**
 * Context objects for templating with enhanced formatting
 */
export function toContext(type?: string, options: {
  simplifyKeys?: boolean;
  includeMetadata?: boolean;
  groupByType?: boolean;
} = {}): any[] {
  const ctx = ontologyContext.use();
  if (!ctx) throw new OntologyError('Ontology context not initialized', 'CONTEXT_ERROR');

  try {
    const entities = findEntities(type);
    
    const contexts = entities.map(entity => {
      const context: any = { '@id': entity };
      const relations = findRelations(entity);
      
      relations.forEach(({ predicate, object }) => {
        const key = options.simplifyKeys 
          ? predicate.split(/[:#]/).pop() || predicate
          : predicate;
        
        if (context[key]) {
          if (!Array.isArray(context[key])) {
            context[key] = [context[key]];
          }
          context[key].push(object);
        } else {
          context[key] = object;
        }
      });

      if (options.includeMetadata) {
        context['@metadata'] = {
          tripleCount: relations.length,
          lastModified: new Date().toISOString(),
          source: 'untology'
        };
      }
      
      return context;
    });

    if (options.groupByType) {
      const grouped: Record<string, any[]> = {};
      contexts.forEach(ctx => {
        const type = ctx['rdf:type'] || ctx.type || 'Unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(ctx);
      });
      return grouped;
    }

    return contexts;

  } catch (error) {
    throw new OntologyError(
      `Error creating context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CONTEXT_ERROR',
      { type, options, error }
    );
  }
}

/**
 * Define a vocabulary with namespace - enhanced with validation
 */
export function defineVocabulary(namespace: string, terms: string[]): Record<string, string> {
  if (!IRI_PATTERN.test(namespace)) {
    throw new ValidationError(`Invalid namespace IRI: ${namespace}`);
  }
  
  const vocab: Record<string, string> = {};
  terms.forEach(term => {
    if (!term || typeof term !== 'string') {
      throw new ValidationError(`Invalid term: ${term}`);
    }
    vocab[term] = namespace + term;
  });
  return vocab;
}

/**
 * Merge multiple graphs - enhanced with validation
 */
export function mergeGraphs(graphs: Store[]): Store {
  if (!Array.isArray(graphs) || graphs.length === 0) {
    throw new ValidationError('Graphs must be a non-empty array of Store objects');
  }
  
  const merged = new Store();
  graphs.forEach((graph, index) => {
    if (!graph || typeof graph.forEach !== 'function') {
      throw new ValidationError(`Invalid graph at index ${index}`);
    }
    graph.forEach(quad => merged.addQuad(quad));
  });
  return merged;
}

/**
 * Performance monitoring and diagnostics
 */
export function getMetrics(): PerformanceMetrics & { cacheSize: number; cacheEfficiency: number } {
  const ctx = ontologyContext.tryUse();
  if (!ctx) {
    return {
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      lastCleanup: 0,
      graphSize: 0,
      cacheSize: 0,
      cacheEfficiency: 0
    };
  }

  const totalQueries = ctx.metrics.cacheHits + ctx.metrics.cacheMisses;
  const cacheEfficiency = totalQueries > 0 ? ctx.metrics.cacheHits / totalQueries : 0;

  return {
    ...ctx.metrics,
    cacheSize: ctx.cache.size,
    cacheEfficiency: Math.round(cacheEfficiency * 100) / 100
  };
}

/**
 * Memory management and cleanup
 */
export function clearGraph(): void {
  const ctx = ontologyContext.tryUse();
  if (ctx) {
    ctx.store = new Store();
    ctx.cache.clear();
    ctx.metrics = {
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      lastCleanup: Date.now(),
      graphSize: 0
    };
  }
}

// Helper functions with enhanced error handling and validation

function validateIRI(value: string, context: string): void {
  if (!value) {
    throw new ValidationError(`${context} cannot be empty`);
  }
  
  if (value.includes(':')) {
    const [prefix] = value.split(':', 1);
    // Allow prefixed names with valid prefixes
    if (!PREFIX_PATTERN.test(prefix)) {
      throw new ValidationError(`Invalid prefix in ${context}: ${prefix}`);
    }
  }
}

function validateQuads(quads: Quad[]): Quad[] {
  return quads.filter(quad => {
    try {
      // Basic validation - ensure terms are valid
      if (!quad.subject || !quad.predicate || !quad.object) {
        console.warn('Invalid quad: missing terms', quad);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Invalid quad:', quad, error);
      return false;
    }
  });
}

function detectFormat(content: string, source: string): 'turtle' | 'n-triples' | 'application/ld+json' {
  if (source.endsWith('.json') || source.endsWith('.jsonld') || content.trim().startsWith('{')) {
    return 'application/ld+json';
  }
  if (source.endsWith('.nt') || content.includes(' .\\n')) {
    return 'n-triples';
  }
  return 'turtle'; // Default
}

function isFilePath(source: string): boolean {
  return source.includes('/') || source.includes('\\') || 
         source.endsWith('.ttl') || source.endsWith('.nt') || 
         source.endsWith('.jsonld') || source.endsWith('.json');
}

function expandIRI(iri: string, prefixes: Record<string, string>): string {
  if (iri.startsWith('http://') || iri.startsWith('https://') || iri.startsWith('urn:')) {
    return iri;
  }
  
  if (iri.includes(':')) {
    const [prefix, local] = iri.split(':', 2);
    if (prefixes[prefix]) {
      return prefixes[prefix] + local;
    }
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

function coerceValue(value: string, datatype: 'string' | 'number' | 'boolean' | 'date'): any {
  switch (datatype) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) throw new ValidationError(`Cannot convert '${value}' to number`);
      return num;
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new ValidationError(`Cannot convert '${value}' to boolean`);
    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new ValidationError(`Cannot convert '${value}' to date`);
      return date;
    default:
      return value;
  }
}

// Cache management functions
function getFromCache(ctx: OntologyContext, key: string): any {
  const entry = ctx.cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.timestamp + entry.ttl) {
    ctx.cache.delete(key);
    return null;
  }
  
  entry.hits++;
  return entry.data;
}

function putInCache(ctx: OntologyContext, key: string, data: any): void {
  // Clean cache if it's too large
  if (ctx.cache.size >= ctx.config.maxCacheSize) {
    const oldestKey = Array.from(ctx.cache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0]?.[0];
    if (oldestKey) {
      ctx.cache.delete(oldestKey);
    }
  }
  
  ctx.cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ctx.config.defaultTTL,
    hits: 0
  });
}

function cleanupCache(ctx: OntologyContext): void {
  const now = Date.now();
  for (const [key, entry] of ctx.cache.entries()) {
    if (now > entry.timestamp + entry.ttl) {
      ctx.cache.delete(key);
    }
  }
  ctx.metrics.lastCleanup = now;
}

function clearRelatedCache(ctx: OntologyContext, subject: string): void {
  const keysToDelete: string[] = [];
  for (const key of ctx.cache.keys()) {
    if (key.includes(subject)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => ctx.cache.delete(key));
}

function updateMetrics(ctx: OntologyContext, startTime: number, cacheHit: boolean): void {
  const duration = performance.now() - startTime;
  ctx.metrics.queryCount++;
  
  if (cacheHit) {
    ctx.metrics.cacheHits++;
  } else {
    ctx.metrics.cacheMisses++;
  }
  
  // Update rolling average
  const totalQueries = ctx.metrics.cacheHits + ctx.metrics.cacheMisses;
  ctx.metrics.averageQueryTime = (ctx.metrics.averageQueryTime * (totalQueries - 1) + duration) / totalQueries;
}

// Enhanced query helper functions
function findEntitiesOfType(ctx: OntologyContext, type: string, limit?: number): string[] {
  const typeIRI = expandIRI(type, ctx.prefixes);
  const rdfType = ctx.prefixes.rdf + 'type';
  
  const entities: string[] = [];
  ctx.store.forSubjects(subject => {
    entities.push(shrinkIRI(subject.value, ctx.prefixes));
    if (limit && entities.length >= limit) return false; // Break early
  }, namedNode(rdfType), namedNode(typeIRI));
  
  return entities;
}

function findSubjectsByRelation(ctx: OntologyContext, predicate: string, object: string): string[] {
  const predicateIRI = expandIRI(predicate, ctx.prefixes);
  const objectIRI = expandIRI(object, ctx.prefixes);
  
  const subjects: string[] = [];
  ctx.store.forSubjects(subject => {
    subjects.push(shrinkIRI(subject.value, ctx.prefixes));
  }, namedNode(predicateIRI), namedNode(objectIRI));
  
  return subjects;
}

function findObjectsByRelation(ctx: OntologyContext, subject: string, predicate: string): string[] {
  const subjectIRI = expandIRI(subject, ctx.prefixes);
  const predicateIRI = expandIRI(predicate, ctx.prefixes);
  
  const objects: string[] = [];
  ctx.store.forObjects(object => {
    const value = object.termType === 'Literal' ? object.value : shrinkIRI(object.value, ctx.prefixes);
    objects.push(value);
  }, namedNode(subjectIRI), namedNode(predicateIRI));
  
  return objects;
}

function describeEntityEnhanced(ctx: OntologyContext, subject: string): Record<string, any> {
  const subjectIRI = expandIRI(subject, ctx.prefixes);
  const quads = ctx.store.getQuads(namedNode(subjectIRI), null, null, null);
  
  const description: Record<string, any> = {
    '@id': subject,
    '@type': [],
    properties: {}
  };
  
  for (const quad of quads) {
    const predicate = shrinkIRI(quad.predicate.value, ctx.prefixes);
    const value = quad.object.termType === 'Literal' ? 
      quad.object.value : 
      shrinkIRI(quad.object.value, ctx.prefixes);
    
    if (predicate === 'rdf:type') {
      description['@type'].push(value);
    } else {
      if (predicate in description.properties) {
        if (!Array.isArray(description.properties[predicate])) {
          description.properties[predicate] = [description.properties[predicate]];
        }
        description.properties[predicate].push(value);
      } else {
        description.properties[predicate] = value;
      }
    }
  }
  
  return description;
}

function checkEntityType(ctx: OntologyContext, entity: string, type: string): boolean {
  const entityIRI = expandIRI(entity, ctx.prefixes);
  const typeIRI = expandIRI(type, ctx.prefixes);
  const rdfType = ctx.prefixes.rdf + 'type';
  
  const quads = ctx.store.getQuads(
    namedNode(entityIRI),
    namedNode(rdfType),
    namedNode(typeIRI),
    null
  );
  
  return quads.length > 0;
}

function performFuzzyMatching(ctx: OntologyContext, query: string, threshold: number): { result: any; confidence: number } | null {
  // Simple fuzzy matching implementation
  const entities = findEntities();
  const matches = entities
    .map(entity => ({
      entity,
      confidence: calculateSimilarity(query, entity.toLowerCase())
    }))
    .filter(match => match.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
  
  if (matches.length > 0) {
    return {
      result: matches.slice(0, 5).map(m => m.entity),
      confidence: matches[0].confidence
    };
  }
  
  return null;
}

function calculateSimilarity(a: string, b: string): number {
  // Simple Jaccard similarity
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

function validateSparqlQuery(query: string): void {
  // Basic SPARQL validation
  const keywords = ['SELECT', 'WHERE', 'FROM', 'ORDER', 'LIMIT', 'OFFSET'];
  const queryUpper = query.toUpperCase();
  
  if (!queryUpper.includes('SELECT')) {
    throw new QueryError('SPARQL query must contain SELECT clause');
  }
  
  if (!queryUpper.includes('WHERE')) {
    throw new QueryError('SPARQL query must contain WHERE clause');
  }
  
  // Check for balanced braces
  const openBraces = (query.match(/\{/g) || []).length;
  const closeBraces = (query.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    throw new QueryError('Unbalanced braces in SPARQL query');
  }
}

function parseTriplePatterns(patterns: string): string[][] {
  // Enhanced triple pattern parsing
  const triples: string[][] = [];
  const statements = patterns.split('.').map(s => s.trim()).filter(Boolean);
  
  for (const statement of statements) {
    const parts = statement.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      // Handle multiple objects (a pred obj1, obj2, obj3)
      const subject = parts[0];
      const predicate = parts[1];
      
      if (parts.includes(',')) {
        // Multiple objects
        const objStart = 2;
        const objects = parts.slice(objStart).join(' ').split(',').map(o => o.trim());
        objects.forEach(obj => {
          triples.push([subject, predicate, obj]);
        });
      } else {
        triples.push([subject, predicate, parts.slice(2).join(' ')]);
      }
    }
  }
  
  return triples;
}

// =============================================================================
// CLEAN PUBLIC API EXPORTS - 80/20 PRINCIPLE
// Essential functions and types that users will need most often
// =============================================================================

// Core types and interfaces (for TypeScript support)
export type {
  OntologyContext,
  OntologyConfig,
  PerformanceMetrics,
  Store,
  Quad,
  Term,
  NamedNode,
  Literal,
  BlankNode
};

// Error classes for proper error handling
export {
  OntologyError,
  ValidationError,
  QueryError
};

// ESSENTIAL OPERATIONS (80% of use cases)
// These are the functions most users will interact with

// 1. Core initialization and configuration
export {
  createOntology,
};

// 2. Graph loading and management
export {
  loadGraph,
  clearGraph
};

// 3. Querying and data retrieval
export {
  findEntities,
  findRelations,
  getValue
};

// 4. Natural language interface (most user-friendly)
export {
  askGraph
};

// 5. Data manipulation
export {
  addTriple,
  exportGraph
};

// 6. Context and templating (for integration with unjucks)
export {
  toContext
};

// 7. Utilities and vocabulary management
export {
  defineVocabulary,
  mergeGraphs,
  getMetrics
};

// ADVANCED FEATURES (20% of use cases)
// For power users who need advanced functionality
export {
  querySparql
};

// =============================================================================
// INTERNAL IMPLEMENTATION 
// The complete implementation is maintained below for backward compatibility
// =============================================================================