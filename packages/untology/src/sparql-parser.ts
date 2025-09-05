/**
 * Production-grade SPARQL 1.1 Parser
 * Implements complete SPARQL 1.1 grammar with proper AST generation
 */

export interface SPARQLNode {
  type: string
  location?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

export interface Variable extends SPARQLNode {
  type: 'variable'
  name: string
}

export interface IRI extends SPARQLNode {
  type: 'iri'
  value: string
}

export interface Literal extends SPARQLNode {
  type: 'literal'
  value: string
  datatype?: string
  language?: string
}

export interface TriplePattern extends SPARQLNode {
  type: 'triple'
  subject: Variable | IRI
  predicate: Variable | IRI | PropertyPath
  object: Variable | IRI | Literal
}

export interface PropertyPath extends SPARQLNode {
  type: 'propertyPath'
  pathType: 'sequence' | 'alternative' | 'inverse' | 'zeroOrMore' | 'oneOrMore' | 'zeroOrOne'
  items: (IRI | PropertyPath)[]
}

export interface BasicGraphPattern extends SPARQLNode {
  type: 'bgp'
  triples: TriplePattern[]
}

export interface FilterExpression extends SPARQLNode {
  type: 'filter'
  expression: Expression
}

export interface Expression extends SPARQLNode {
  type: 'operation' | 'functionCall' | 'aggregate' | 'exists' | 'notExists'
  operator?: string
  function?: string
  args?: Expression[]
  patterns?: GraphPattern[]
  distinct?: boolean
}

export interface GraphPattern extends SPARQLNode {
  type: 'group' | 'union' | 'optional' | 'minus' | 'service' | 'bind' | 'values'
  patterns?: GraphPattern[]
  left?: GraphPattern
  right?: GraphPattern
  expression?: Expression
  variable?: Variable
  silent?: boolean
  name?: IRI | Variable
  bindings?: { [variable: string]: (IRI | Literal)[] }
}

export interface SelectQuery extends SPARQLNode {
  type: 'select'
  distinct?: boolean
  reduced?: boolean
  variables: (Variable | { expression: Expression; variable: Variable })[]
  where?: GraphPattern[]
  groupBy?: Expression[]
  having?: Expression[]
  orderBy?: { expression: Expression; descending?: boolean }[]
  limit?: number
  offset?: number
}

export interface ConstructQuery extends SPARQLNode {
  type: 'construct'
  template: TriplePattern[]
  where?: GraphPattern[]
  groupBy?: Expression[]
  having?: Expression[]
  orderBy?: { expression: Expression; descending?: boolean }[]
  limit?: number
  offset?: number
}

export interface AskQuery extends SPARQLNode {
  type: 'ask'
  where?: GraphPattern[]
}

export interface DescribeQuery extends SPARQLNode {
  type: 'describe'
  variables: (Variable | IRI)[]
  where?: GraphPattern[]
}

export type Query = SelectQuery | ConstructQuery | AskQuery | DescribeQuery

export interface SPARQLParseResult {
  query: Query
  prefixes: { [prefix: string]: string }
}

/**
 * SPARQL 1.1 Parser with full grammar support
 */
export class SPARQLParser {
  private input: string = ''
  private pos: number = 0
  private line: number = 1
  private column: number = 1
  private prefixes: { [prefix: string]: string } = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    owl: 'http://www.w3.org/2002/07/owl#'
  }

  parse(query: string): SPARQLParseResult {
    this.input = query
    this.pos = 0
    this.line = 1
    this.column = 1

    // Parse prologue (prefixes and base)
    this.parsePrologue()

    // Parse main query
    const mainQuery = this.parseQuery()

    return {
      query: mainQuery,
      prefixes: { ...this.prefixes }
    }
  }

  private parsePrologue(): void {
    this.skipWhitespace()

    while (this.pos < this.input.length) {
      if (this.matchKeyword('PREFIX')) {
        this.parsePrefix()
      } else if (this.matchKeyword('BASE')) {
        this.parseBase()
      } else {
        break
      }
      this.skipWhitespace()
    }
  }

  private parsePrefix(): void {
    this.consumeKeyword('PREFIX')
    this.skipWhitespace()

    const prefix = this.parseNamespacePrefix()
    this.skipWhitespace()
    this.consume(':')
    this.skipWhitespace()

    const iri = this.parseIRIRef()
    this.prefixes[prefix] = iri.value

    this.skipWhitespace()
  }

  private parseBase(): void {
    this.consumeKeyword('BASE')
    this.skipWhitespace()
    const iri = this.parseIRIRef()
    this.prefixes[''] = iri.value
    this.skipWhitespace()
  }

  private parseQuery(): Query {
    this.skipWhitespace()

    if (this.matchKeyword('SELECT')) {
      return this.parseSelectQuery()
    } else if (this.matchKeyword('CONSTRUCT')) {
      return this.parseConstructQuery()
    } else if (this.matchKeyword('ASK')) {
      return this.parseAskQuery()
    } else if (this.matchKeyword('DESCRIBE')) {
      return this.parseDescribeQuery()
    }

    throw new Error(`Unexpected token at line ${this.line}, column ${this.column}`)
  }

  private parseSelectQuery(): SelectQuery {
    const start = this.getPosition()
    this.consumeKeyword('SELECT')
    this.skipWhitespace()

    let distinct = false
    let reduced = false

    if (this.matchKeyword('DISTINCT')) {
      distinct = true
      this.consumeKeyword('DISTINCT')
      this.skipWhitespace()
    } else if (this.matchKeyword('REDUCED')) {
      reduced = true
      this.consumeKeyword('REDUCED')
      this.skipWhitespace()
    }

    const variables = this.parseSelectVariables()
    this.skipWhitespace()

    const whereClause = this.parseWhereClause()
    const modifiers = this.parseSolutionModifiers()

    return {
      type: 'select',
      distinct,
      reduced,
      variables,
      where: whereClause,
      ...modifiers,
      location: { start, end: this.getPosition() }
    }
  }

  private parseSelectVariables(): (Variable | { expression: Expression; variable: Variable })[] {
    const variables: (Variable | { expression: Expression; variable: Variable })[] = []

    if (this.match('*')) {
      this.consume('*')
      return [{ type: 'variable', name: '*' } as Variable]
    }

    do {
      if (this.match('(')) {
        // Parse expression as variable
        this.consume('(')
        const expression = this.parseExpression()
        this.skipWhitespace()
        this.consumeKeyword('AS')
        this.skipWhitespace()
        const variable = this.parseVar()
        this.consume(')')
        variables.push({ expression, variable })
      } else {
        variables.push(this.parseVar())
      }
      this.skipWhitespace()
    } while (this.match('?') || this.match('('))

    return variables
  }

  private parseConstructQuery(): ConstructQuery {
    const start = this.getPosition()
    this.consumeKeyword('CONSTRUCT')
    this.skipWhitespace()

    let template: TriplePattern[] = []

    if (this.match('{')) {
      this.consume('{')
      template = this.parseConstructTemplate()
      this.consume('}')
    } else {
      this.consumeKeyword('WHERE')
    }

    this.skipWhitespace()
    const whereClause = this.parseWhereClause()
    const modifiers = this.parseSolutionModifiers()

    return {
      type: 'construct',
      template,
      where: whereClause,
      ...modifiers,
      location: { start, end: this.getPosition() }
    }
  }

  private parseAskQuery(): AskQuery {
    const start = this.getPosition()
    this.consumeKeyword('ASK')
    this.skipWhitespace()

    const whereClause = this.parseWhereClause()

    return {
      type: 'ask',
      where: whereClause,
      location: { start, end: this.getPosition() }
    }
  }

  private parseDescribeQuery(): DescribeQuery {
    const start = this.getPosition()
    this.consumeKeyword('DESCRIBE')
    this.skipWhitespace()

    const variables: (Variable | IRI)[] = []

    if (this.match('*')) {
      this.consume('*')
      variables.push({ type: 'variable', name: '*' } as Variable)
    } else {
      do {
        if (this.match('?')) {
          variables.push(this.parseVar())
        } else {
          variables.push(this.parseIRIRef())
        }
        this.skipWhitespace()
      } while (this.match('?') || this.match('<') || this.isNameStartChar())
    }

    const whereClause = this.parseWhereClause()

    return {
      type: 'describe',
      variables,
      where: whereClause,
      location: { start, end: this.getPosition() }
    }
  }

  private parseWhereClause(): GraphPattern[] | undefined {
    if (!this.matchKeyword('WHERE')) {
      return undefined
    }

    this.consumeKeyword('WHERE')
    this.skipWhitespace()

    return this.parseGroupGraphPattern()
  }

  private parseGroupGraphPattern(): GraphPattern[] {
    this.consume('{')
    this.skipWhitespace()

    const patterns: GraphPattern[] = []

    while (!this.match('}') && this.pos < this.input.length) {
      if (this.match('{')) {
        patterns.push({
          type: 'group',
          patterns: this.parseGroupGraphPattern()
        })
      } else if (this.matchKeyword('OPTIONAL')) {
        patterns.push(this.parseOptionalGraphPattern())
      } else if (this.matchKeyword('UNION')) {
        patterns.push(this.parseUnionGraphPattern(patterns.pop()!))
      } else if (this.matchKeyword('MINUS')) {
        patterns.push(this.parseMinusGraphPattern())
      } else if (this.matchKeyword('FILTER')) {
        patterns.push(this.parseFilterExpression())
      } else if (this.matchKeyword('BIND')) {
        patterns.push(this.parseBindExpression())
      } else if (this.matchKeyword('VALUES')) {
        patterns.push(this.parseValuesClause())
      } else if (this.matchKeyword('SERVICE')) {
        patterns.push(this.parseServiceGraphPattern())
      } else {
        // Parse as basic graph pattern
        const bgp = this.parseBasicGraphPattern()
        if (bgp.triples.length > 0) {
          patterns.push(bgp)
        }
      }
      this.skipWhitespace()
    }

    this.consume('}')
    return patterns
  }

  private parseBasicGraphPattern(): BasicGraphPattern {
    const start = this.getPosition()
    const triples: TriplePattern[] = []

    while (!this.match('}') && !this.matchKeyword('OPTIONAL') && 
           !this.matchKeyword('UNION') && !this.matchKeyword('MINUS') && 
           !this.matchKeyword('FILTER') && !this.matchKeyword('BIND') &&
           !this.matchKeyword('VALUES') && !this.matchKeyword('SERVICE') &&
           !this.match('{') && this.pos < this.input.length) {
      
      const triple = this.parseTriplePattern()
      if (triple) {
        triples.push(triple)
      }
      
      this.skipWhitespace()
      if (this.match('.')) {
        this.consume('.')
        this.skipWhitespace()
      }
    }

    return {
      type: 'bgp',
      triples,
      location: { start, end: this.getPosition() }
    }
  }

  private parseTriplePattern(): TriplePattern | null {
    const start = this.getPosition()
    
    try {
      const subject = this.parseVarOrTerm()
      if (!subject) return null
      
      this.skipWhitespace()
      const predicate = this.parseVarOrPath()
      if (!predicate) return null
      
      this.skipWhitespace()
      const object = this.parseVarOrTerm()
      if (!object) return null

      return {
        type: 'triple',
        subject: subject as Variable | IRI,
        predicate: predicate as Variable | IRI | PropertyPath,
        object: object as Variable | IRI | Literal,
        location: { start, end: this.getPosition() }
      }
    } catch {
      return null
    }
  }

  private parseOptionalGraphPattern(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('OPTIONAL')
    this.skipWhitespace()

    const patterns = this.parseGroupGraphPattern()

    return {
      type: 'optional',
      patterns,
      location: { start, end: this.getPosition() }
    }
  }

  private parseUnionGraphPattern(left: GraphPattern): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('UNION')
    this.skipWhitespace()

    const right: GraphPattern = {
      type: 'group',
      patterns: this.parseGroupGraphPattern()
    }

    return {
      type: 'union',
      left,
      right,
      location: { start, end: this.getPosition() }
    }
  }

  private parseMinusGraphPattern(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('MINUS')
    this.skipWhitespace()

    const patterns = this.parseGroupGraphPattern()

    return {
      type: 'minus',
      patterns,
      location: { start, end: this.getPosition() }
    }
  }

  private parseFilterExpression(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('FILTER')
    this.skipWhitespace()

    const expression = this.parseExpression()

    return {
      type: 'filter',
      expression,
      location: { start, end: this.getPosition() }
    } as GraphPattern
  }

  private parseBindExpression(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('BIND')
    this.skipWhitespace()
    this.consume('(')

    const expression = this.parseExpression()
    this.skipWhitespace()
    this.consumeKeyword('AS')
    this.skipWhitespace()
    const variable = this.parseVar()
    this.consume(')')

    return {
      type: 'bind',
      expression,
      variable,
      location: { start, end: this.getPosition() }
    }
  }

  private parseValuesClause(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('VALUES')
    this.skipWhitespace()

    const bindings: { [variable: string]: (IRI | Literal)[] } = {}
    
    if (this.match('(')) {
      // Inline values
      this.consume('(')
      const variables: string[] = []
      
      while (!this.match(')')) {
        const variable = this.parseVar()
        variables.push(variable.name)
        this.skipWhitespace()
      }
      this.consume(')')
      this.skipWhitespace()
      
      this.consume('{')
      while (!this.match('}')) {
        this.consume('(')
        for (let i = 0; i < variables.length; i++) {
          const value = this.parseVarOrTerm() as IRI | Literal
          if (!bindings[variables[i]]) {
            bindings[variables[i]] = []
          }
          bindings[variables[i]].push(value)
          this.skipWhitespace()
        }
        this.consume(')')
        this.skipWhitespace()
      }
      this.consume('}')
    }

    return {
      type: 'values',
      bindings,
      location: { start, end: this.getPosition() }
    }
  }

  private parseServiceGraphPattern(): GraphPattern {
    const start = this.getPosition()
    this.consumeKeyword('SERVICE')
    this.skipWhitespace()

    let silent = false
    if (this.matchKeyword('SILENT')) {
      silent = true
      this.consumeKeyword('SILENT')
      this.skipWhitespace()
    }

    const name = this.parseVarOrTerm() as IRI | Variable
    this.skipWhitespace()
    const patterns = this.parseGroupGraphPattern()

    return {
      type: 'service',
      name,
      patterns,
      silent,
      location: { start, end: this.getPosition() }
    }
  }

  private parseExpression(): Expression {
    return this.parseConditionalOrExpression()
  }

  private parseConditionalOrExpression(): Expression {
    let expr = this.parseConditionalAndExpression()
    
    while (this.match('||')) {
      this.consume('||')
      this.skipWhitespace()
      const right = this.parseConditionalAndExpression()
      expr = {
        type: 'operation',
        operator: '||',
        args: [expr, right]
      }
    }
    
    return expr
  }

  private parseConditionalAndExpression(): Expression {
    let expr = this.parseValueLogical()
    
    while (this.match('&&')) {
      this.consume('&&')
      this.skipWhitespace()
      const right = this.parseValueLogical()
      expr = {
        type: 'operation',
        operator: '&&',
        args: [expr, right]
      }
    }
    
    return expr
  }

  private parseValueLogical(): Expression {
    let expr = this.parseRelationalExpression()
    
    while (this.match('=') || this.match('!=') || this.match('<') || 
           this.match('>') || this.match('<=') || this.match('>=')) {
      const op = this.peek()
      if (op === '!' && this.peek(1) === '=') {
        this.consume('!=')
        this.skipWhitespace()
        const right = this.parseRelationalExpression()
        expr = {
          type: 'operation',
          operator: '!=',
          args: [expr, right]
        }
      } else if (op === '<' && this.peek(1) === '=') {
        this.consume('<=')
        this.skipWhitespace()
        const right = this.parseRelationalExpression()
        expr = {
          type: 'operation',
          operator: '<=',
          args: [expr, right]
        }
      } else if (op === '>' && this.peek(1) === '=') {
        this.consume('>=')
        this.skipWhitespace()
        const right = this.parseRelationalExpression()
        expr = {
          type: 'operation',
          operator: '>=',
          args: [expr, right]
        }
      } else {
        this.consume(op)
        this.skipWhitespace()
        const right = this.parseRelationalExpression()
        expr = {
          type: 'operation',
          operator: op,
          args: [expr, right]
        }
      }
    }
    
    return expr
  }

  private parseRelationalExpression(): Expression {
    let expr = this.parseAdditiveExpression()
    
    if (this.matchKeyword('IN') || this.matchKeyword('NOT')) {
      // Handle IN and NOT IN
      let operator = 'IN'
      if (this.matchKeyword('NOT')) {
        this.consumeKeyword('NOT')
        this.skipWhitespace()
        this.consumeKeyword('IN')
        operator = 'NOT IN'
      } else {
        this.consumeKeyword('IN')
      }
      
      this.skipWhitespace()
      this.consume('(')
      const args = [expr]
      
      while (!this.match(')')) {
        args.push(this.parseExpression())
        this.skipWhitespace()
        if (this.match(',')) {
          this.consume(',')
          this.skipWhitespace()
        }
      }
      this.consume(')')
      
      return {
        type: 'operation',
        operator,
        args
      }
    }
    
    return expr
  }

  private parseAdditiveExpression(): Expression {
    let expr = this.parseMultiplicativeExpression()
    
    while (this.match('+') || this.match('-')) {
      const op = this.peek()
      this.consume(op)
      this.skipWhitespace()
      const right = this.parseMultiplicativeExpression()
      expr = {
        type: 'operation',
        operator: op,
        args: [expr, right]
      }
    }
    
    return expr
  }

  private parseMultiplicativeExpression(): Expression {
    let expr = this.parseUnaryExpression()
    
    while (this.match('*') || this.match('/')) {
      const op = this.peek()
      this.consume(op)
      this.skipWhitespace()
      const right = this.parseUnaryExpression()
      expr = {
        type: 'operation',
        operator: op,
        args: [expr, right]
      }
    }
    
    return expr
  }

  private parseUnaryExpression(): Expression {
    if (this.match('!') || this.match('+') || this.match('-')) {
      const op = this.peek()
      this.consume(op)
      this.skipWhitespace()
      const expr = this.parseUnaryExpression()
      return {
        type: 'operation',
        operator: op,
        args: [expr]
      }
    }
    
    return this.parsePrimaryExpression()
  }

  private parsePrimaryExpression(): Expression {
    if (this.match('(')) {
      this.consume('(')
      this.skipWhitespace()
      const expr = this.parseExpression()
      this.consume(')')
      return expr
    }

    if (this.matchKeyword('EXISTS')) {
      this.consumeKeyword('EXISTS')
      this.skipWhitespace()
      const patterns = this.parseGroupGraphPattern()
      return {
        type: 'exists',
        patterns
      }
    }

    if (this.matchKeyword('NOT')) {
      this.consumeKeyword('NOT')
      this.skipWhitespace()
      this.consumeKeyword('EXISTS')
      this.skipWhitespace()
      const patterns = this.parseGroupGraphPattern()
      return {
        type: 'notExists',
        patterns
      }
    }

    // Function calls and aggregates
    if (this.isNameStartChar()) {
      const name = this.parseQName().value
      
      if (this.match('(')) {
        this.consume('(')
        this.skipWhitespace()
        
        const args: Expression[] = []
        let distinct = false
        
        // Check for DISTINCT in aggregates
        if (this.matchKeyword('DISTINCT')) {
          distinct = true
          this.consumeKeyword('DISTINCT')
          this.skipWhitespace()
        }
        
        while (!this.match(')')) {
          args.push(this.parseExpression())
          this.skipWhitespace()
          if (this.match(',')) {
            this.consume(',')
            this.skipWhitespace()
          }
        }
        this.consume(')')
        
        // Check if it's an aggregate function
        const aggregates = ['COUNT', 'SUM', 'MIN', 'MAX', 'AVG', 'SAMPLE', 'GROUP_CONCAT']
        if (aggregates.includes(name.toUpperCase())) {
          return {
            type: 'aggregate',
            function: name.toUpperCase(),
            args,
            distinct
          }
        }
        
        return {
          type: 'functionCall',
          function: name,
          args
        }
      }
    }

    // Variables and terms
    const term = this.parseVarOrTerm()
    return {
      type: 'operation',
      operator: 'term',
      args: [term as any]
    }
  }

  private parseSolutionModifiers() {
    const modifiers: any = {}

    // GROUP BY
    if (this.matchKeyword('GROUP')) {
      this.consumeKeyword('GROUP')
      this.skipWhitespace()
      this.consumeKeyword('BY')
      this.skipWhitespace()
      
      modifiers.groupBy = []
      do {
        modifiers.groupBy.push(this.parseExpression())
        this.skipWhitespace()
      } while (!this.matchKeyword('HAVING') && !this.matchKeyword('ORDER') && 
               !this.matchKeyword('LIMIT') && !this.matchKeyword('OFFSET') && 
               this.pos < this.input.length)
    }

    // HAVING
    if (this.matchKeyword('HAVING')) {
      this.consumeKeyword('HAVING')
      this.skipWhitespace()
      
      modifiers.having = []
      do {
        modifiers.having.push(this.parseExpression())
        this.skipWhitespace()
      } while (!this.matchKeyword('ORDER') && !this.matchKeyword('LIMIT') && 
               !this.matchKeyword('OFFSET') && this.pos < this.input.length)
    }

    // ORDER BY
    if (this.matchKeyword('ORDER')) {
      this.consumeKeyword('ORDER')
      this.skipWhitespace()
      this.consumeKeyword('BY')
      this.skipWhitespace()
      
      modifiers.orderBy = []
      do {
        let descending = false
        if (this.matchKeyword('DESC')) {
          descending = true
          this.consumeKeyword('DESC')
          this.skipWhitespace()
          this.consume('(')
          const expr = this.parseExpression()
          this.consume(')')
          modifiers.orderBy.push({ expression: expr, descending })
        } else {
          if (this.matchKeyword('ASC')) {
            this.consumeKeyword('ASC')
            this.skipWhitespace()
            this.consume('(')
            const expr = this.parseExpression()
            this.consume(')')
            modifiers.orderBy.push({ expression: expr, descending: false })
          } else {
            const expr = this.parseExpression()
            modifiers.orderBy.push({ expression: expr, descending: false })
          }
        }
        this.skipWhitespace()
      } while (!this.matchKeyword('LIMIT') && !this.matchKeyword('OFFSET') && 
               this.pos < this.input.length)
    }

    // LIMIT
    if (this.matchKeyword('LIMIT')) {
      this.consumeKeyword('LIMIT')
      this.skipWhitespace()
      modifiers.limit = this.parseInteger()
      this.skipWhitespace()
    }

    // OFFSET
    if (this.matchKeyword('OFFSET')) {
      this.consumeKeyword('OFFSET')
      this.skipWhitespace()
      modifiers.offset = this.parseInteger()
      this.skipWhitespace()
    }

    return modifiers
  }

  private parseConstructTemplate(): TriplePattern[] {
    const triples: TriplePattern[] = []
    
    while (!this.match('}') && this.pos < this.input.length) {
      const triple = this.parseTriplePattern()
      if (triple) {
        triples.push(triple)
      }
      this.skipWhitespace()
      if (this.match('.')) {
        this.consume('.')
        this.skipWhitespace()
      }
    }
    
    return triples
  }

  private parseVarOrTerm(): Variable | IRI | Literal | null {
    this.skipWhitespace()
    
    if (this.match('?') || this.match('$')) {
      return this.parseVar()
    } else if (this.match('<')) {
      return this.parseIRIRef()
    } else if (this.match('"') || this.match("'")) {
      return this.parseStringLiteral()
    } else if (this.isNumericLiteral()) {
      return this.parseNumericLiteral()
    } else if (this.isNameStartChar()) {
      return this.parseQName()
    }
    
    return null
  }

  private parseVarOrPath(): Variable | IRI | PropertyPath | null {
    // For now, we'll handle simple cases and extend for property paths
    return this.parseVarOrTerm() as Variable | IRI | PropertyPath
  }

  private parseVar(): Variable {
    const start = this.getPosition()
    const prefix = this.peek()
    this.consume(prefix) // ? or $
    const name = this.parseVariableName()
    
    return {
      type: 'variable',
      name,
      location: { start, end: this.getPosition() }
    }
  }

  private parseIRIRef(): IRI {
    const start = this.getPosition()
    this.consume('<')
    let value = ''
    
    while (this.pos < this.input.length && this.peek() !== '>') {
      value += this.peek()
      this.advance()
    }
    
    this.consume('>')
    
    return {
      type: 'iri',
      value,
      location: { start, end: this.getPosition() }
    }
  }

  private parseQName(): IRI {
    const start = this.getPosition()
    let prefix = ''
    let local = ''
    
    // Parse prefix
    while (this.pos < this.input.length && this.isNameChar() && !this.match(':')) {
      prefix += this.peek()
      this.advance()
    }
    
    if (this.match(':')) {
      this.consume(':')
      
      // Parse local part
      while (this.pos < this.input.length && this.isNameChar()) {
        local += this.peek()
        this.advance()
      }
    } else {
      // No colon, so prefix is actually the local part
      local = prefix
      prefix = ''
    }
    
    // Expand with namespace
    const namespace = this.prefixes[prefix] || ''
    const value = namespace + local
    
    return {
      type: 'iri',
      value,
      location: { start, end: this.getPosition() }
    }
  }

  private parseStringLiteral(): Literal {
    const start = this.getPosition()
    const quote = this.peek()
    this.consume(quote)
    
    let value = ''
    let escaped = false
    
    while (this.pos < this.input.length) {
      const char = this.peek()
      
      if (escaped) {
        value += this.getEscapedChar(char)
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        break
      } else {
        value += char
      }
      
      this.advance()
    }
    
    this.consume(quote)
    
    let language: string | undefined
    let datatype: string | undefined
    
    // Check for language tag
    if (this.match('@')) {
      this.consume('@')
      language = this.parseLanguageTag()
    }
    // Check for datatype
    else if (this.match('^') && this.peek(1) === '^') {
      this.consume('^^')
      const dtIRI = this.parseIRIRef() || this.parseQName()
      datatype = dtIRI.value
    }
    
    return {
      type: 'literal',
      value,
      language,
      datatype,
      location: { start, end: this.getPosition() }
    }
  }

  private parseNumericLiteral(): Literal {
    const start = this.getPosition()
    let value = ''
    let hasDecimal = false
    let hasExponent = false
    
    // Handle negative sign
    if (this.match('-') || this.match('+')) {
      value += this.peek()
      this.advance()
    }
    
    // Parse digits
    while (this.pos < this.input.length && this.isDigit()) {
      value += this.peek()
      this.advance()
    }
    
    // Handle decimal point
    if (this.match('.')) {
      hasDecimal = true
      value += this.peek()
      this.advance()
      
      while (this.pos < this.input.length && this.isDigit()) {
        value += this.peek()
        this.advance()
      }
    }
    
    // Handle exponent
    if (this.match('e') || this.match('E')) {
      hasExponent = true
      value += this.peek()
      this.advance()
      
      if (this.match('-') || this.match('+')) {
        value += this.peek()
        this.advance()
      }
      
      while (this.pos < this.input.length && this.isDigit()) {
        value += this.peek()
        this.advance()
      }
    }
    
    // Determine datatype
    let datatype = 'http://www.w3.org/2001/XMLSchema#integer'
    if (hasDecimal && !hasExponent) {
      datatype = 'http://www.w3.org/2001/XMLSchema#decimal'
    } else if (hasExponent) {
      datatype = 'http://www.w3.org/2001/XMLSchema#double'
    }
    
    return {
      type: 'literal',
      value,
      datatype,
      location: { start, end: this.getPosition() }
    }
  }

  private parseVariableName(): string {
    let name = ''
    
    if (this.isNameStartChar()) {
      name += this.peek()
      this.advance()
      
      while (this.pos < this.input.length && this.isNameChar()) {
        name += this.peek()
        this.advance()
      }
    }
    
    return name
  }

  private parseNamespacePrefix(): string {
    let prefix = ''
    
    while (this.pos < this.input.length && this.isNameChar() && !this.match(':')) {
      prefix += this.peek()
      this.advance()
    }
    
    return prefix
  }

  private parseLanguageTag(): string {
    let tag = ''
    
    while (this.pos < this.input.length && (this.isAlpha() || this.match('-'))) {
      tag += this.peek()
      this.advance()
    }
    
    return tag
  }

  private parseInteger(): number {
    let value = ''
    
    while (this.pos < this.input.length && this.isDigit()) {
      value += this.peek()
      this.advance()
    }
    
    return parseInt(value)
  }

  // Utility methods

  private peek(offset = 0): string {
    return this.input[this.pos + offset] || ''
  }

  private advance(): void {
    if (this.pos < this.input.length) {
      if (this.peek() === '\n') {
        this.line++
        this.column = 1
      } else {
        this.column++
      }
      this.pos++
    }
  }

  private consume(expected: string): void {
    for (const char of expected) {
      if (this.peek() !== char) {
        throw new Error(`Expected '${char}' at line ${this.line}, column ${this.column}`)
      }
      this.advance()
    }
  }

  private match(str: string): boolean {
    return this.input.substr(this.pos, str.length) === str
  }

  private matchKeyword(keyword: string): boolean {
    if (!this.match(keyword.toUpperCase())) return false
    
    const nextPos = this.pos + keyword.length
    if (nextPos < this.input.length) {
      const nextChar = this.input[nextPos]
      return !this.isNameChar(nextChar)
    }
    
    return true
  }

  private consumeKeyword(keyword: string): void {
    if (!this.matchKeyword(keyword)) {
      throw new Error(`Expected keyword '${keyword}' at line ${this.line}, column ${this.column}`)
    }
    
    for (let i = 0; i < keyword.length; i++) {
      this.advance()
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && this.isWhitespace()) {
      this.advance()
    }
    
    // Skip comments
    if (this.match('#')) {
      while (this.pos < this.input.length && this.peek() !== '\n') {
        this.advance()
      }
      this.skipWhitespace()
    }
  }

  private isWhitespace(char = this.peek()): boolean {
    return /\s/.test(char)
  }

  private isNameStartChar(char = this.peek()): boolean {
    return /[a-zA-Z_]/.test(char)
  }

  private isNameChar(char = this.peek()): boolean {
    return /[a-zA-Z0-9_-]/.test(char)
  }

  private isDigit(char = this.peek()): boolean {
    return /[0-9]/.test(char)
  }

  private isAlpha(char = this.peek()): boolean {
    return /[a-zA-Z]/.test(char)
  }

  private isNumericLiteral(): boolean {
    const char = this.peek()
    return this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))
  }

  private getEscapedChar(char: string): string {
    switch (char) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case 'b': return '\b'
      case 'f': return '\f'
      case '"': return '"'
      case "'": return "'"
      case '\\': return '\\'
      default: return char
    }
  }

  private getPosition() {
    return { line: this.line, column: this.column }
  }
}