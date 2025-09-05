declare module 'n3' {
  export interface Quad {
    subject: NamedNode | BlankNode | Variable | DefaultGraph
    predicate: NamedNode | Variable
    object: NamedNode | Literal | BlankNode | Variable
    graph?: NamedNode | DefaultGraph | Variable
  }

  export type Term = NamedNode | Literal | BlankNode | Variable | DefaultGraph

  export interface NamedNode {
    termType: 'NamedNode'
    value: string
  }

  export interface BlankNode {
    termType: 'BlankNode'
    value: string
  }

  export interface Literal {
    termType: 'Literal'
    value: string
    language?: string
    datatype?: NamedNode
  }

  export interface Variable {
    termType: 'Variable'
    value: string
  }

  export interface DefaultGraph {
    termType: 'DefaultGraph'
    value: ''
  }

  export class Store {
    constructor()
    addQuad(quad: Quad): void
    addQuads(quads: Quad[]): void
    removeQuad(quad: Quad): void
    removeQuads(quads: Quad[]): void
    match(subject?: any, predicate?: any, object?: any, graph?: any): Quad[]
    countQuads(subject?: any, predicate?: any, object?: any, graph?: any): number
    getQuads(subject?: any, predicate?: any, object?: any, graph?: any): Quad[]
    forEach(callback: (quad: Quad) => void): void
    every(callback: (quad: Quad) => boolean): boolean
    some(callback: (quad: Quad) => boolean): boolean
    size: number
    [Symbol.iterator](): Iterator<Quad>
  }

  export class StreamParser {
    constructor(options?: any)
  }

  export class Util {
    static isNamedNode(term: Term): term is NamedNode
    static isBlankNode(term: Term): term is BlankNode
    static isLiteral(term: Term): term is Literal
    static isVariable(term: Term): term is Variable
    static isDefaultGraph(term: Term): term is DefaultGraph
    static isomorphic: any
    static blankNode: typeof DataFactory.blankNode
    static namedNode: typeof DataFactory.namedNode
    static literal: typeof DataFactory.literal
    static equals(a: Term, b: Term): boolean
  }

  export class Parser {
    constructor(options?: any)
    parse(input: string): Quad[]
  }

  export class Writer {
    constructor(options?: any)
    addQuad(quad: Quad): void
    addQuads(quads: Quad[]): void
    end(callback?: (error: Error, result: string) => void): void
  }

  export class DataFactory {
    static namedNode(value: string): NamedNode
    static blankNode(value?: string): BlankNode
    static literal(value: string, languageOrDatatype?: string | NamedNode): Literal
    static variable(value: string): Variable
    static defaultGraph(): DefaultGraph
    static quad(subject: any, predicate: any, object: any, graph?: any): Quad
  }

  export const namedNode: typeof DataFactory.namedNode
  export const blankNode: typeof DataFactory.blankNode
  export const literal: typeof DataFactory.literal
  export const variable: typeof DataFactory.variable
  export const defaultGraph: typeof DataFactory.defaultGraph
  export const quad: typeof DataFactory.quad
}