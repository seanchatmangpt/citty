import { promises as fs } from 'fs';
import { Parser, Store, Quad, Writer, DataFactory } from 'n3';
import { OntologySource, OntologyContext, Triple, OntologyParseError } from '../types.js';
import * as crypto from 'crypto';
import { basename } from 'path';

export class OntologyLoader {
  private parser: Parser;
  private store: Store;

  constructor() {
    this.parser = new Parser();
    this.store = new Store();
  }

  async load(source: OntologySource): Promise<OntologyContext> {
    try {
      const content = await fs.readFile(source.path, 'utf-8');
      const stats = await fs.stat(source.path);
      
      // Configure parser based on format
      const parserOptions = this.getParserOptions(source.format);
      this.parser = new Parser(parserOptions);
      
      // Parse the ontology
      const quads = this.parser.parse(content);
      this.store = new Store(quads);
      
      // Extract triples
      const triples = this.extractTriples(quads);
      
      // Extract prefixes
      const prefixes = this.extractPrefixes(content, source.format);
      
      return {
        triples,
        prefixes,
        metadata: {
          source: source.path,
          timestamp: stats.mtime,
          size: triples.length,
        },
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw new OntologyParseError(
          `Failed to parse ontology: ${error.message}`,
          source.path
        );
      }
      throw error;
    }
  }

  private getParserOptions(format: string): any {
    switch (format) {
      case 'turtle':
        return { format: 'text/turtle' };
      case 'n3':
        return { format: 'text/n3' };
      case 'rdf-xml':
        return { format: 'application/rdf+xml' };
      case 'json-ld':
        return { format: 'application/ld+json' };
      default:
        return { format: 'text/turtle' };
    }
  }

  private extractTriples(quads: Quad[]): Triple[] {
    return quads.map(quad => ({
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value,
      graph: quad.graph?.value,
    }));
  }

  private extractPrefixes(content: string, format: string): Map<string, string> {
    const prefixes = new Map<string, string>();
    
    if (format === 'turtle' || format === 'n3') {
      // Extract @prefix declarations
      const prefixRegex = /@prefix\s+(\w+):\s+<([^>]+)>\s*\./g;
      let match;
      
      while ((match = prefixRegex.exec(content)) !== null) {
        prefixes.set(match[1], match[2]);
      }
      
      // Extract PREFIX declarations (SPARQL style)
      const sparqlPrefixRegex = /PREFIX\s+(\w+):\s+<([^>]+)>/gi;
      while ((match = sparqlPrefixRegex.exec(content)) !== null) {
        prefixes.set(match[1], match[2]);
      }
    }
    
    // Add common prefixes if not present
    this.addCommonPrefixes(prefixes);
    
    return prefixes;
  }

  private addCommonPrefixes(prefixes: Map<string, string>): void {
    const commonPrefixes = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      dc: 'http://purl.org/dc/elements/1.1/',
      dcterms: 'http://purl.org/dc/terms/',
      foaf: 'http://xmlns.com/foaf/0.1/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
    };
    
    for (const [prefix, uri] of Object.entries(commonPrefixes)) {
      if (!prefixes.has(prefix)) {
        prefixes.set(prefix, uri);
      }
    }
  }

  async loadMultiple(sources: OntologySource[]): Promise<OntologyContext[]> {
    const results = await Promise.allSettled(sources.map(source => this.load(source)));
    const contexts: OntologyContext[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        contexts.push(result.value);
      } else {
        errors.push(`Failed to load ${sources[i].path}: ${result.reason.message}`);
      }
    }
    
    if (errors.length > 0 && contexts.length === 0) {
      throw new OntologyParseError('All ontology sources failed to load', 'multiple', 0);
    }
    
    return contexts;
  }

  async validateSyntax(source: OntologySource): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.load(source);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  getStatistics(context: OntologyContext): {
    classes: number;
    properties: number;
    individuals: number;
    triples: number;
  } {
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const owlClass = 'http://www.w3.org/2002/07/owl#Class';
    const rdfsClass = 'http://www.w3.org/2000/01/rdf-schema#Class';
    const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';
    const owlDatatypeProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    const rdfsProperty = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';

    const classes = new Set<string>();
    const properties = new Set<string>();
    const individuals = new Set<string>();

    for (const triple of context.triples) {
      if (triple.predicate === rdfType) {
        if (triple.object === owlClass || triple.object === rdfsClass) {
          classes.add(triple.subject);
        } else if (
          triple.object === owlObjectProperty ||
          triple.object === owlDatatypeProperty ||
          triple.object === rdfsProperty
        ) {
          properties.add(triple.subject);
        } else {
          individuals.add(triple.subject);
        }
      }
    }

    return {
      classes: classes.size,
      properties: properties.size,
      individuals: individuals.size,
      triples: context.triples.length,
    };
  }

  extractNamespaces(context: OntologyContext): string[] {
    const namespaces = new Set<string>();
    
    for (const triple of context.triples) {
      [triple.subject, triple.predicate, triple.object].forEach(uri => {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          const lastSlash = uri.lastIndexOf('/');
          const lastHash = uri.lastIndexOf('#');
          const separator = Math.max(lastSlash, lastHash);
          
          if (separator > 0) {
            namespaces.add(uri.substring(0, separator + 1));
          }
        }
      });
    }
    
    return Array.from(namespaces);
  }

  async saveAsFormat(
    context: OntologyContext,
    outputPath: string,
    format: 'turtle' | 'n3' | 'rdf-xml' | 'json-ld'
  ): Promise<void> {
    const writer = new Writer({ format: this.getWriterFormat(format) });
    const { namedNode, literal, blankNode } = DataFactory;
    
    // Add prefixes
    for (const [prefix, uri] of context.prefixes) {
      writer.addPrefix(prefix, uri);
    }
    
    // Add triples
    for (const triple of context.triples) {
      const subject = triple.subject.startsWith('_:') 
        ? blankNode(triple.subject.slice(2))
        : namedNode(triple.subject);
      const predicate = namedNode(triple.predicate);
      const object = this.createTermFromValue(triple.object);
      const graph = triple.graph ? namedNode(triple.graph) : undefined;
      
      writer.addQuad({ subject, predicate, object, graph });
    }
    
    const serialized = await new Promise<string>((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    await fs.writeFile(outputPath, serialized, 'utf-8');
  }

  async loadFromURL(url: string, format: OntologySource['format']): Promise<OntologyContext> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new OntologyParseError(`Failed to fetch ontology from URL: ${response.status}`, url);
    }
    
    const content = await response.text();
    const parserOptions = this.getParserOptions(format);
    this.parser = new Parser(parserOptions);
    
    try {
      const quads = this.parser.parse(content);
      this.store = new Store(quads);
      
      const triples = this.extractTriples(quads);
      const prefixes = this.extractPrefixes(content, format);
      
      return {
        triples,
        prefixes,
        metadata: {
          source: url,
          timestamp: new Date(),
          size: triples.length,
        },
      };
    } catch (error) {
      throw new OntologyParseError(
        `Failed to parse ontology from URL: ${error instanceof Error ? error.message : String(error)}`,
        url
      );
    }
  }

  async detectFormat(content: string): Promise<OntologySource['format']> {
    // Try to detect format from content
    const trimmedContent = content.trim();
    
    if (trimmedContent.startsWith('@prefix') || trimmedContent.includes('@base')) {
      return 'turtle';
    }
    if (trimmedContent.startsWith('@forAll') || trimmedContent.includes('@forSome')) {
      return 'n3';
    }
    if (trimmedContent.startsWith('<?xml') && trimmedContent.includes('rdf:RDF')) {
      return 'rdf-xml';
    }
    if (trimmedContent.startsWith('{') && trimmedContent.includes('@context')) {
      return 'json-ld';
    }
    
    // Default to turtle
    return 'turtle';
  }

  async validateAndRepair(source: OntologySource): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    repairedContent?: string;
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      repairedContent: undefined as string | undefined,
    };
    
    try {
      const content = await fs.readFile(source.path, 'utf-8');
      let repairedContent = content;
      
      // Basic validation and repair
      const lines = content.split('\n');
      const repairedLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let repairedLine = line;
        
        // Fix common issues
        if (source.format === 'turtle' || source.format === 'n3') {
          // Fix missing periods at end of statements
          if (line.trim() && !line.trim().endsWith('.') && !line.trim().endsWith(';') && !line.trim().endsWith(',') && !line.trim().startsWith('@') && !line.trim().startsWith('#')) {
            if (i === lines.length - 1 || (!lines[i + 1].trim().startsWith(' ') && !lines[i + 1].trim().startsWith('\t'))) {
              repairedLine = line + ' .';
              result.warnings.push(`Added missing period at line ${i + 1}`);
            }
          }
          
          // Fix unescaped quotes in literals
          const literalMatches = line.match(/"([^"\\]|\\.)*"/g);
          if (literalMatches) {
            for (const match of literalMatches) {
              if (match.includes('\n') || match.includes('\r')) {
                const fixed = match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                repairedLine = repairedLine.replace(match, fixed);
                result.warnings.push(`Fixed newlines in literal at line ${i + 1}`);
              }
            }
          }
        }
        
        repairedLines.push(repairedLine);
      }
      
      repairedContent = repairedLines.join('\n');
      
      // Try parsing the repaired content
      const parserOptions = this.getParserOptions(source.format);
      const parser = new Parser(parserOptions);
      
      try {
        parser.parse(repairedContent);
        result.repairedContent = repairedContent;
      } catch (parseError) {
        result.isValid = false;
        result.errors.push(`Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`File access error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return result;
  }

  getFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async merge(contexts: OntologyContext[]): Promise<OntologyContext> {
    const mergedTriples: Triple[] = [];
    const mergedPrefixes = new Map<string, string>();
    let totalSize = 0;
    
    for (const context of contexts) {
      mergedTriples.push(...context.triples);
      totalSize += context.metadata.size;
      
      for (const [prefix, uri] of context.prefixes) {
        mergedPrefixes.set(prefix, uri);
      }
    }
    
    // Remove duplicates
    const uniqueTriples = mergedTriples.filter((triple, index, array) => {
      return array.findIndex(t => 
        t.subject === triple.subject && 
        t.predicate === triple.predicate && 
        t.object === triple.object &&
        t.graph === triple.graph
      ) === index;
    });
    
    return {
      triples: uniqueTriples,
      prefixes: mergedPrefixes,
      metadata: {
        source: `merged-${contexts.length}-ontologies`,
        timestamp: new Date(),
        size: uniqueTriples.length,
      },
    };
  }

  private getWriterFormat(format: string): string {
    switch (format) {
      case 'turtle':
        return 'text/turtle';
      case 'n3':
        return 'text/n3';
      case 'rdf-xml':
        return 'application/rdf+xml';
      case 'json-ld':
        return 'application/ld+json';
      default:
        return 'text/turtle';
    }
  }

  private createTermFromValue(value: string) {
    const { namedNode, literal, blankNode } = DataFactory;
    
    if (value.startsWith('_:')) {
      return blankNode(value.slice(2));
    } else if (value.startsWith('http://') || value.startsWith('https://')) {
      return namedNode(value);
    } else {
      // Parse literals with datatype/language tags
      const literalMatch = value.match(/^"(.*)"(?:\^\^<(.+)>|@(.+))?$/);
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
      
      // Assume simple literal
      return literal(value);
    }
  }
}