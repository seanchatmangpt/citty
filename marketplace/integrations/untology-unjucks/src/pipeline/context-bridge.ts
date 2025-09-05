import { Store, Parser, Quad, DataFactory } from 'n3';
import {
  OntologyContext,
  TemplateContext,
  Triple,
  QueryResult,
} from '../types.js';

const { namedNode, literal, blankNode, defaultGraph } = DataFactory;

export class ContextBridge {
  private store: Store;
  private parser: Parser;

  constructor() {
    this.store = new Store();
    this.parser = new Parser();
  }

  async buildContext(
    ontologyContexts: OntologyContext[],
    customContext: Record<string, unknown> = {}
  ): TemplateContext {
    // Merge all ontology contexts into a single store
    this.store = new Store();
    const allTriples: Triple[] = [];
    const combinedPrefixes = new Map<string, string>();

    for (const context of ontologyContexts) {
      // Add triples to store
      for (const triple of context.triples) {
        const quad = this.tripleToQuad(triple);
        this.store.addQuad(quad);
        allTriples.push(triple);
      }

      // Merge prefixes
      for (const [prefix, uri] of context.prefixes) {
        combinedPrefixes.set(prefix, uri);
      }
    }

    const templateContext: TemplateContext = {
      ontology: {
        triples: allTriples,
        prefixes: combinedPrefixes,
        metadata: {
          source: 'merged',
          timestamp: new Date(),
          size: allTriples.length,
        },
      },
      query: this.createQueryFunction(),
      filter: this.createFilterFunction(allTriples),
      namespace: this.createNamespaceFunction(combinedPrefixes),
      custom: customContext,
    };

    // Add bridge reference for template filters
    (templateContext as any).__bridge = this;

    return templateContext;
  }

  private tripleToQuad(triple: Triple): Quad {
    const subject = triple.subject.startsWith('_:') 
      ? blankNode(triple.subject.slice(2))
      : namedNode(triple.subject);
      
    const predicate = namedNode(triple.predicate);
    
    let object;
    if (triple.object.startsWith('_:')) {
      object = blankNode(triple.object.slice(2));
    } else if (triple.object.startsWith('http://') || triple.object.startsWith('https://')) {
      object = namedNode(triple.object);
    } else {
      // Parse literals with datatype/language tags
      const literalMatch = triple.object.match(/^"(.*)"(?:\^\^<(.+)>|@(.+))?$/);
      if (literalMatch) {
        const [, literalValue, datatype, language] = literalMatch;
        if (datatype) {
          object = literal(literalValue, namedNode(datatype));
        } else if (language) {
          object = literal(literalValue, language);
        } else {
          object = literal(literalValue);
        }
      } else {
        object = literal(triple.object);
      }
    }
    
    const graph = triple.graph ? namedNode(triple.graph) : defaultGraph();
    
    return { subject, predicate, object, graph };
  }

  private createQueryFunction() {
    return async (sparql: string): Promise<QueryResult[]> => {
      try {
        // Enhanced SPARQL-like query implementation
        const results: QueryResult[] = [];
        
        // Parse SELECT queries
        const selectMatch = sparql.match(/SELECT\s+(DISTINCT\s+)?(.+?)\s+WHERE\s*\{(.+?)\}(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?/is);
        if (!selectMatch) {
          throw new Error('Only SELECT queries are supported');
        }
        
        const [, distinct, selectClause, whereClause, orderBy, limit, offset] = selectMatch;
        const variables = selectClause.split(/\s+/).filter(v => v.startsWith('?'));
        
        // Parse WHERE clause
        const patterns = this.parseTriplePatterns(whereClause);
        let bindings = this.matchPatterns(patterns, variables);
        
        // Apply DISTINCT
        if (distinct) {
          const seen = new Set();
          bindings = bindings.filter(binding => {
            const key = JSON.stringify(binding);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        
        // Apply ORDER BY
        if (orderBy) {
          const orderVar = orderBy.trim().replace('?', '');
          bindings.sort((a, b) => {
            const aVal = a[orderVar] || '';
            const bVal = b[orderVar] || '';
            return String(aVal).localeCompare(String(bVal));
          });
        }
        
        // Apply OFFSET and LIMIT
        const offsetNum = offset ? parseInt(offset, 10) : 0;
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        
        if (offsetNum > 0) {
          bindings = bindings.slice(offsetNum);
        }
        if (limitNum !== undefined) {
          bindings = bindings.slice(0, limitNum);
        }
        
        return bindings.map(binding => {
          const result: QueryResult = {};
          for (const [variable, value] of Object.entries(binding)) {
            result[variable] = {
              type: this.getValueType(value as string),
              value: value as string,
              datatype: this.extractDatatype(value as string),
              lang: this.extractLanguage(value as string),
            };
          }
          return result;
        });
      } catch (error) {
        throw new Error(`SPARQL query failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
  }

  private extractDatatype(value: string): string | undefined {
    const match = value.match(/\^\^<(.+)>$/);
    return match ? match[1] : undefined;
  }

  private extractLanguage(value: string): string | undefined {
    const match = value.match(/@([a-zA-Z-]+)$/);
    return match ? match[1] : undefined;
  }

  private createFilterFunction(triples: Triple[]) {
    return (predicate: string, object?: string): Triple[] => {
      return triples.filter(triple => {
        const predicateMatch = triple.predicate === predicate || 
                              triple.predicate.endsWith('#' + predicate) ||
                              triple.predicate.endsWith('/' + predicate);
        
        if (!predicateMatch) return false;
        if (object === undefined) return true;
        
        return triple.object === object ||
               triple.object.endsWith('#' + object) ||
               triple.object.endsWith('/' + object);
      });
    };
  }

  private createNamespaceFunction(prefixes: Map<string, string>) {
    return (prefix: string): string => {
      const namespace = prefixes.get(prefix);
      if (!namespace) {
        throw new Error(`Unknown namespace prefix: ${prefix}`);
      }
      return namespace;
    };
  }

  private parseTriplePatterns(whereClause: string): Array<{
    subject: string;
    predicate: string;
    object: string;
  }> {
    const patterns: Array<{ subject: string; predicate: string; object: string }> = [];
    
    // Handle complex patterns with optional elements
    let cleanClause = whereClause.replace(/OPTIONAL\s*\{([^}]+)\}/gi, '$1');
    
    // Split on periods, but be careful with URIs and literals
    const statements = this.splitTripleStatements(cleanClause);
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Handle property paths and simple triples
      const parts = this.parseTripleStatement(trimmed);
      if (parts) {
        patterns.push(parts);
      }
    }
    
    return patterns;
  }

  private splitTripleStatements(clause: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inLiteral = false;
    let inURI = false;
    let depth = 0;
    
    for (let i = 0; i < clause.length; i++) {
      const char = clause[i];
      const prev = clause[i - 1];
      
      if (char === '"' && prev !== '\\') {
        inLiteral = !inLiteral;
      } else if (char === '<' && !inLiteral) {
        inURI = true;
      } else if (char === '>' && !inLiteral) {
        inURI = false;
      } else if (char === '{' && !inLiteral && !inURI) {
        depth++;
      } else if (char === '}' && !inLiteral && !inURI) {
        depth--;
      } else if (char === '.' && !inLiteral && !inURI && depth === 0) {
        if (current.trim()) {
          statements.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    return statements;
  }

  private parseTripleStatement(statement: string): { subject: string; predicate: string; object: string } | null {
    // Match triple patterns with various formats
    const patterns = [
      // Standard triple: ?s ?p ?o
      /^(\S+)\s+(\S+)\s+(.+?)$/,
      // With semicolon shorthand: ?s ?p1 ?o1 ; ?p2 ?o2
      /^(\S+)\s+(\S+)\s+([^;]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = statement.match(pattern);
      if (match) {
        return {
          subject: match[1].trim(),
          predicate: match[2].trim(),
          object: match[3].trim(),
        };
      }
    }
    
    return null;
  }

  private matchPatterns(
    patterns: Array<{ subject: string; predicate: string; object: string }>,
    variables: string[]
  ): Array<Record<string, string>> {
    const results: Array<Record<string, string>> = [];
    
    // For each pattern, find matching triples
    for (const pattern of patterns) {
      const matches = this.store.getQuads(
        this.termFromPattern(pattern.subject),
        this.termFromPattern(pattern.predicate),
        this.termFromPattern(pattern.object),
        null
      );
      
      // Extract variable bindings
      for (const quad of matches) {
        const binding: Record<string, string> = {};
        
        if (pattern.subject.startsWith('?')) {
          binding[pattern.subject] = quad.subject.value;
        }
        if (pattern.predicate.startsWith('?')) {
          binding[pattern.predicate] = quad.predicate.value;
        }
        if (pattern.object.startsWith('?')) {
          binding[pattern.object] = quad.object.value;
        }
        
        // Only include bindings for requested variables
        const filteredBinding: Record<string, string> = {};
        for (const variable of variables) {
          if (binding[variable]) {
            filteredBinding[variable.slice(1)] = binding[variable];
          }
        }
        
        if (Object.keys(filteredBinding).length > 0) {
          results.push(filteredBinding);
        }
      }
    }
    
    return results;
  }

  private termFromPattern(pattern: string) {
    if (pattern.startsWith('?')) {
      return null; // Variable - match any
    }
    
    if (pattern.startsWith('<') && pattern.endsWith('>')) {
      return namedNode(pattern.slice(1, -1));
    }
    
    if (pattern.startsWith('"')) {
      // Literal with possible datatype or language tag
      const literalMatch = pattern.match(/^"(.*)"(?:\^\^<(.+)>|@(.+))?$/);
      if (literalMatch) {
        const [, literalValue, datatype, language] = literalMatch;
        if (datatype) {
          return literal(literalValue, namedNode(datatype));
        } else if (language) {
          return literal(literalValue, language);
        } else {
          return literal(literalValue);
        }
      }
    }
    
    if (pattern.startsWith('_:')) {
      return blankNode(pattern.slice(2));
    }
    
    // Handle prefixed names
    if (pattern.includes(':')) {
      const [prefix, localName] = pattern.split(':', 2);
      const namespace = this.getNamespaceForPrefix(prefix);
      if (namespace) {
        return namedNode(namespace + localName);
      }
    }
    
    // Assume it's a URI
    return namedNode(pattern);
  }

  private getNamespaceForPrefix(prefix: string): string | null {
    // This should be populated during context building
    return null; // Simplified for now
  }

  private getValueType(value: string): 'uri' | 'literal' | 'bnode' {
    if (value.startsWith('_:')) return 'bnode';
    if (value.startsWith('http://') || value.startsWith('https://')) return 'uri';
    if (value.startsWith('<') && value.endsWith('>')) return 'uri';
    return 'literal';
  }

  // Helper methods for template contexts
  
  getClassHierarchy(classUri: string, context: TemplateContext): string[] {
    const hierarchy: string[] = [classUri];
    const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    
    const subClassTriples = context.filter(rdfsSubClassOf);
    const visited = new Set<string>();
    
    const findSuperClasses = (currentClass: string) => {
      if (visited.has(currentClass)) return;
      visited.add(currentClass);
      
      const superClasses = subClassTriples
        .filter(triple => triple.subject === currentClass)
        .map(triple => triple.object);
        
      for (const superClass of superClasses) {
        if (!hierarchy.includes(superClass)) {
          hierarchy.push(superClass);
          findSuperClasses(superClass);
        }
      }
    };
    
    findSuperClasses(classUri);
    return hierarchy;
  }

  getProperties(classUri: string, context: TemplateContext): Array<{
    property: string;
    range: string[];
    domain: string[];
  }> {
    const properties: Array<{
      property: string;
      range: string[];
      domain: string[];
    }> = [];
    
    const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const rdfsRange = 'http://www.w3.org/2000/01/rdf-schema#range';
    
    // Find properties where this class is in the domain
    const domainTriples = context.filter(rdfsDomain, classUri);
    
    for (const triple of domainTriples) {
      const propertyUri = triple.subject;
      
      // Get ranges for this property
      const ranges = context.filter(rdfsRange)
        .filter(t => t.subject === propertyUri)
        .map(t => t.object);
        
      // Get all domains for this property
      const domains = context.filter(rdfsDomain)
        .filter(t => t.subject === propertyUri)
        .map(t => t.object);
      
      properties.push({
        property: propertyUri,
        range: ranges,
        domain: domains,
      });
    }
    
    return properties;
  }

  getInstances(classUri: string, context: TemplateContext): string[] {
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    return context.filter(rdfType, classUri).map(triple => triple.subject);
  }

  getLabel(uri: string, context: TemplateContext): string {
    const rdfsLabel = 'http://www.w3.org/2000/01/rdf-schema#label';
    const labelTriples = context.filter(rdfsLabel)
      .filter(triple => triple.subject === uri);
      
    if (labelTriples.length > 0) {
      return labelTriples[0].object;
    }
    
    // Fallback to local name
    const localName = uri.split(/[#\/]/).pop();
    return localName || uri;
  }

  getComment(uri: string, context: TemplateContext): string | null {
    const rdfsComment = 'http://www.w3.org/2000/01/rdf-schema#comment';
    const commentTriples = context.filter(rdfsComment)
      .filter(triple => triple.subject === uri);
      
    return commentTriples.length > 0 ? commentTriples[0].object : null;
  }

  // Additional helper methods for enhanced template filters
  getSubClasses(classUri: string, context: TemplateContext): string[] {
    const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    return context.filter(rdfsSubClassOf)
      .filter(triple => triple.object === classUri)
      .map(triple => triple.subject);
  }

  getObjectProperties(classUri: string, context: TemplateContext): Array<{
    property: string;
    range: string[];
    domain: string[];
  }> {
    const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const rdfsRange = 'http://www.w3.org/2000/01/rdf-schema#range';
    const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    // Find object properties
    const objectProperties = context.filter(rdfType, owlObjectProperty)
      .map(triple => triple.subject);
    
    return objectProperties
      .filter(property => {
        const domains = context.filter(rdfsDomain)
          .filter(t => t.subject === property)
          .map(t => t.object);
        return domains.includes(classUri);
      })
      .map(property => {
        const ranges = context.filter(rdfsRange)
          .filter(t => t.subject === property)
          .map(t => t.object);
        const domains = context.filter(rdfsDomain)
          .filter(t => t.subject === property)
          .map(t => t.object);
        
        return { property, range: ranges, domain: domains };
      });
  }

  getDataProperties(classUri: string, context: TemplateContext): Array<{
    property: string;
    range: string[];
    domain: string[];
  }> {
    const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const rdfsRange = 'http://www.w3.org/2000/01/rdf-schema#range';
    const owlDatatypeProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    // Find datatype properties
    const dataProperties = context.filter(rdfType, owlDatatypeProperty)
      .map(triple => triple.subject);
    
    return dataProperties
      .filter(property => {
        const domains = context.filter(rdfsDomain)
          .filter(t => t.subject === property)
          .map(t => t.object);
        return domains.includes(classUri);
      })
      .map(property => {
        const ranges = context.filter(rdfsRange)
          .filter(t => t.subject === property)
          .map(t => t.object);
        const domains = context.filter(rdfsDomain)
          .filter(t => t.subject === property)
          .map(t => t.object);
        
        return { property, range: ranges, domain: domains };
      });
  }

  getRestrictions(classUri: string, context: TemplateContext): Array<{
    type: string;
    property: string;
    value?: string;
    cardinality?: number;
  }> {
    const restrictions: Array<{
      type: string;
      property: string;
      value?: string;
      cardinality?: number;
    }> = [];
    
    const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    const owlRestriction = 'http://www.w3.org/2002/07/owl#Restriction';
    const owlOnProperty = 'http://www.w3.org/2002/07/owl#onProperty';
    const owlSomeValuesFrom = 'http://www.w3.org/2002/07/owl#someValuesFrom';
    const owlAllValuesFrom = 'http://www.w3.org/2002/07/owl#allValuesFrom';
    const owlHasValue = 'http://www.w3.org/2002/07/owl#hasValue';
    const owlCardinality = 'http://www.w3.org/2002/07/owl#cardinality';
    const owlMinCardinality = 'http://www.w3.org/2002/07/owl#minCardinality';
    const owlMaxCardinality = 'http://www.w3.org/2002/07/owl#maxCardinality';
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    // Find restrictions on this class
    const subClassTriples = context.filter(rdfsSubClassOf)
      .filter(triple => triple.subject === classUri);
    
    for (const triple of subClassTriples) {
      const restriction = triple.object;
      
      // Check if it's a restriction
      const isRestriction = context.filter(rdfType)
        .some(t => t.subject === restriction && t.object === owlRestriction);
      
      if (isRestriction) {
        // Get the property
        const propertyTriples = context.filter(owlOnProperty)
          .filter(t => t.subject === restriction);
        
        if (propertyTriples.length === 0) continue;
        const property = propertyTriples[0].object;
        
        // Check for different types of restrictions
        const someValuesFrom = context.filter(owlSomeValuesFrom)
          .filter(t => t.subject === restriction);
        if (someValuesFrom.length > 0) {
          restrictions.push({
            type: 'someValuesFrom',
            property,
            value: someValuesFrom[0].object,
          });
        }
        
        const allValuesFrom = context.filter(owlAllValuesFrom)
          .filter(t => t.subject === restriction);
        if (allValuesFrom.length > 0) {
          restrictions.push({
            type: 'allValuesFrom',
            property,
            value: allValuesFrom[0].object,
          });
        }
        
        const hasValue = context.filter(owlHasValue)
          .filter(t => t.subject === restriction);
        if (hasValue.length > 0) {
          restrictions.push({
            type: 'hasValue',
            property,
            value: hasValue[0].object,
          });
        }
        
        // Cardinality restrictions
        const cardinality = context.filter(owlCardinality)
          .filter(t => t.subject === restriction);
        if (cardinality.length > 0) {
          restrictions.push({
            type: 'cardinality',
            property,
            cardinality: parseInt(cardinality[0].object, 10),
          });
        }
        
        const minCardinality = context.filter(owlMinCardinality)
          .filter(t => t.subject === restriction);
        if (minCardinality.length > 0) {
          restrictions.push({
            type: 'minCardinality',
            property,
            cardinality: parseInt(minCardinality[0].object, 10),
          });
        }
        
        const maxCardinality = context.filter(owlMaxCardinality)
          .filter(t => t.subject === restriction);
        if (maxCardinality.length > 0) {
          restrictions.push({
            type: 'maxCardinality',
            property,
            cardinality: parseInt(maxCardinality[0].object, 10),
          });
        }
      }
    }
    
    return restrictions;
  }

  getAnnotations(uri: string, context: TemplateContext): Array<{
    property: string;
    value: string;
    language?: string;
    datatype?: string;
  }> {
    const owlAnnotationProperty = 'http://www.w3.org/2002/07/owl#AnnotationProperty';
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    // Get all annotation properties
    const annotationProperties = context.filter(rdfType, owlAnnotationProperty)
      .map(triple => triple.subject);
    
    const annotations: Array<{
      property: string;
      value: string;
      language?: string;
      datatype?: string;
    }> = [];
    
    for (const property of annotationProperties) {
      const values = context.filter(property)
        .filter(triple => triple.subject === uri);
      
      for (const valueTriple of values) {
        annotations.push({
          property,
          value: valueTriple.object,
          language: this.extractLanguage(valueTriple.object),
          datatype: this.extractDatatype(valueTriple.object),
        });
      }
    }
    
    return annotations;
  }
}