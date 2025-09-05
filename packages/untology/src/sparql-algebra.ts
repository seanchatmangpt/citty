/**
 * SPARQL Algebra Engine
 * Implements SPARQL 1.1 algebra operations with optimization
 */

import { Store, Quad, DataFactory } from 'n3'
import type { 
  Query, SelectQuery, ConstructQuery, AskQuery, DescribeQuery,
  GraphPattern, TriplePattern, Expression, Variable, IRI, Literal 
} from './sparql-parser'

const { namedNode, literal, variable, defaultGraph, quad } = DataFactory

export interface Solution {
  [variable: string]: any
}

export interface AlgebraOperator {
  type: string
  evaluate(store: Store, solutions?: Solution[]): Solution[]
  estimateCardinality(store: Store): number
  getCost(): number
}

export class BasicGraphPatternOperator implements AlgebraOperator {
  type = 'BGP'
  
  constructor(private triples: TriplePattern[]) {}

  evaluate(store: Store, solutions: Solution[] = [{}]): Solution[] {
    let currentSolutions = solutions

    for (const triple of this.triples) {
      currentSolutions = this.evaluateTriple(triple, store, currentSolutions)
    }

    return currentSolutions
  }

  private evaluateTriple(triple: TriplePattern, store: Store, solutions: Solution[]): Solution[] {
    const result: Solution[] = []

    for (const solution of solutions) {
      const s = this.bindTerm(triple.subject, solution)
      const p = this.bindTerm(triple.predicate, solution)
      const o = this.bindTerm(triple.object, solution)

      const quads = store.getQuads(s, p, o, null)

      for (const quad of quads) {
        const newSolution = { ...solution }
        
        if (triple.subject.type === 'variable') {
          newSolution[(triple.subject as Variable).name] = quad.subject.value
        }
        if (triple.predicate.type === 'variable') {
          newSolution[(triple.predicate as Variable).name] = quad.predicate.value
        }
        if (triple.object.type === 'variable') {
          newSolution[(triple.object as Variable).name] = this.extractValue(quad.object)
        }

        // Check if this solution is compatible with existing bindings
        if (this.isCompatible(newSolution, solution)) {
          result.push(newSolution)
        }
      }
    }

    return result
  }

  private bindTerm(term: Variable | IRI | Literal, solution: Solution): any {
    if (term.type === 'variable') {
      const value = solution[(term as Variable).name]
      return value !== undefined ? namedNode(value) : null
    } else if (term.type === 'iri') {
      return namedNode((term as IRI).value)
    } else if (term.type === 'literal') {
      const lit = term as Literal
      return literal(lit.value, lit.language || lit.datatype)
    }
    return null
  }

  private extractValue(term: any): any {
    if (term.termType === 'Literal') {
      const value = term.value
      
      if (term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#integer') {
        return parseInt(value)
      }
      if (term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#double' ||
          term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#decimal') {
        return parseFloat(value)
      }
      if (term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#boolean') {
        return value === 'true'
      }
      
      return value
    }
    
    return term.value
  }

  private isCompatible(newSolution: Solution, existingSolution: Solution): boolean {
    for (const [key, value] of Object.entries(existingSolution)) {
      if (newSolution[key] !== undefined && newSolution[key] !== value) {
        return false
      }
    }
    return true
  }

  estimateCardinality(store: Store): number {
    let cardinality = 1
    
    for (const triple of this.triples) {
      const s = triple.subject.type === 'variable' ? null : namedNode((triple.subject as IRI).value)
      const p = triple.predicate.type === 'variable' ? null : namedNode((triple.predicate as IRI).value)
      const o = triple.object.type === 'variable' ? null : this.bindTerm(triple.object, {})
      
      const quads = store.getQuads(s, p, o, null)
      cardinality *= Math.max(1, quads.length)
    }
    
    return cardinality
  }

  getCost(): number {
    return this.triples.length * 10 // Base cost per triple
  }
}

export class FilterOperator implements AlgebraOperator {
  type = 'Filter'

  constructor(
    private expression: Expression,
    private child: AlgebraOperator,
    private evaluator: ExpressionEvaluator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child.evaluate(store, solutions)
    
    return childResults.filter(solution => 
      this.evaluator.evaluate(this.expression, solution, store)
    )
  }

  estimateCardinality(store: Store): number {
    return Math.floor(this.child.estimateCardinality(store) * 0.5) // Assume 50% selectivity
  }

  getCost(): number {
    return this.child.getCost() + 5 // Add filter overhead
  }
}

export class JoinOperator implements AlgebraOperator {
  type = 'Join'

  constructor(
    private left: AlgebraOperator,
    private right: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const leftResults = this.left.evaluate(store, solutions)
    const rightResults = this.right.evaluate(store, solutions)
    
    const result: Solution[] = []
    
    for (const leftSol of leftResults) {
      for (const rightSol of rightResults) {
        const joined = this.joinSolutions(leftSol, rightSol)
        if (joined !== null) {
          result.push(joined)
        }
      }
    }
    
    return result
  }

  private joinSolutions(left: Solution, right: Solution): Solution | null {
    const result = { ...left }
    
    for (const [key, value] of Object.entries(right)) {
      if (result[key] !== undefined && result[key] !== value) {
        return null // Incompatible bindings
      }
      result[key] = value
    }
    
    return result
  }

  estimateCardinality(store: Store): number {
    const leftCard = this.left.estimateCardinality(store)
    const rightCard = this.right.estimateCardinality(store)
    return leftCard * rightCard * 0.1 // Assume 10% join selectivity
  }

  getCost(): number {
    const leftCost = this.left.getCost()
    const rightCost = this.right.getCost()
    return leftCost + rightCost + (leftCost * rightCost * 0.01) // Join cost
  }
}

export class UnionOperator implements AlgebraOperator {
  type = 'Union'

  constructor(
    private left: AlgebraOperator,
    private right: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const leftResults = this.left.evaluate(store, solutions)
    const rightResults = this.right.evaluate(store, solutions)
    
    // Remove duplicates
    const result: Solution[] = []
    const seen = new Set<string>()
    
    for (const solution of [...leftResults, ...rightResults]) {
      const key = JSON.stringify(solution)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(solution)
      }
    }
    
    return result
  }

  estimateCardinality(store: Store): number {
    const leftCard = this.left.estimateCardinality(store)
    const rightCard = this.right.estimateCardinality(store)
    return leftCard + rightCard
  }

  getCost(): number {
    return this.left.getCost() + this.right.getCost() + 10 // Union overhead
  }
}

export class OptionalOperator implements AlgebraOperator {
  type = 'Optional'

  constructor(
    private left: AlgebraOperator,
    private right: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const leftResults = this.left.evaluate(store, solutions)
    const result: Solution[] = []
    
    for (const leftSol of leftResults) {
      const rightResults = this.right.evaluate(store, [leftSol])
      
      if (rightResults.length > 0) {
        result.push(...rightResults)
      } else {
        result.push(leftSol) // Include left solution even if right doesn't match
      }
    }
    
    return result
  }

  estimateCardinality(store: Store): number {
    return Math.max(
      this.left.estimateCardinality(store),
      this.left.estimateCardinality(store) * this.right.estimateCardinality(store) * 0.3
    )
  }

  getCost(): number {
    return this.left.getCost() + this.right.getCost() + 15 // Optional overhead
  }
}

export class MinusOperator implements AlgebraOperator {
  type = 'Minus'

  constructor(
    private left: AlgebraOperator,
    private right: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const leftResults = this.left.evaluate(store, solutions)
    const rightResults = this.right.evaluate(store, solutions)
    
    const result: Solution[] = []
    
    for (const leftSol of leftResults) {
      let shouldInclude = true
      
      for (const rightSol of rightResults) {
        if (this.isCompatibleDomain(leftSol, rightSol)) {
          shouldInclude = false
          break
        }
      }
      
      if (shouldInclude) {
        result.push(leftSol)
      }
    }
    
    return result
  }

  private isCompatibleDomain(left: Solution, right: Solution): boolean {
    const commonVars = Object.keys(left).filter(key => right.hasOwnProperty(key))
    
    if (commonVars.length === 0) {
      return false
    }
    
    return commonVars.every(key => left[key] === right[key])
  }

  estimateCardinality(store: Store): number {
    return Math.floor(this.left.estimateCardinality(store) * 0.7) // Assume 30% removed
  }

  getCost(): number {
    return this.left.getCost() + this.right.getCost() + 20 // Minus overhead
  }
}

export class ProjectOperator implements AlgebraOperator {
  type = 'Project'

  constructor(
    private variables: string[],
    private child: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child.evaluate(store, solutions)
    
    return childResults.map(solution => {
      const projected: Solution = {}
      
      for (const varName of this.variables) {
        if (solution[varName] !== undefined) {
          projected[varName] = solution[varName]
        }
      }
      
      return projected
    })
  }

  estimateCardinality(store: Store): number {
    return this.child.estimateCardinality(store)
  }

  getCost(): number {
    return this.child.getCost() + 2 // Minimal projection overhead
  }
}

export class OrderByOperator implements AlgebraOperator {
  type = 'OrderBy'

  constructor(
    private orderConditions: { expression: Expression; descending: boolean }[],
    private child: AlgebraOperator,
    private evaluator: ExpressionEvaluator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child.evaluate(store, solutions)
    
    return childResults.sort((a, b) => {
      for (const condition of this.orderConditions) {
        const aValue = this.evaluator.evaluate(condition.expression, a, store)
        const bValue = this.evaluator.evaluate(condition.expression, b, store)
        
        let comparison = 0
        if (aValue < bValue) comparison = -1
        else if (aValue > bValue) comparison = 1
        
        if (condition.descending) comparison *= -1
        
        if (comparison !== 0) return comparison
      }
      return 0
    })
  }

  estimateCardinality(store: Store): number {
    return this.child.estimateCardinality(store)
  }

  getCost(): number {
    const childCost = this.child.getCost()
    const cardinality = this.child.estimateCardinality({} as Store) // Approximation
    return childCost + cardinality * Math.log(cardinality) * 2 // O(n log n) sort cost
  }
}

export class LimitOffsetOperator implements AlgebraOperator {
  type = 'LimitOffset'

  constructor(
    private limit?: number,
    private offset?: number,
    private child?: AlgebraOperator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child?.evaluate(store, solutions) || solutions || []
    
    const start = this.offset || 0
    const end = this.limit !== undefined ? start + this.limit : undefined
    
    return childResults.slice(start, end)
  }

  estimateCardinality(store: Store): number {
    const childCard = this.child?.estimateCardinality(store) || 0
    const start = this.offset || 0
    const limit = this.limit !== undefined ? this.limit : childCard - start
    
    return Math.max(0, Math.min(limit, childCard - start))
  }

  getCost(): number {
    return (this.child?.getCost() || 0) + 1 // Minimal slicing overhead
  }
}

export class DistinctOperator implements AlgebraOperator {
  type = 'Distinct'

  constructor(private child: AlgebraOperator) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child.evaluate(store, solutions)
    
    const seen = new Set<string>()
    const result: Solution[] = []
    
    for (const solution of childResults) {
      const key = JSON.stringify(solution)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(solution)
      }
    }
    
    return result
  }

  estimateCardinality(store: Store): number {
    return Math.floor(this.child.estimateCardinality(store) * 0.8) // Assume 20% duplicates
  }

  getCost(): number {
    const childCost = this.child.getCost()
    const cardinality = this.child.estimateCardinality({} as Store)
    return childCost + cardinality * 2 // Hashing overhead
  }
}

export class AggregateOperator implements AlgebraOperator {
  type = 'Aggregate'

  constructor(
    private aggregations: { function: string; variable: string; expression: Expression; distinct?: boolean }[],
    private groupBy: Expression[],
    private child: AlgebraOperator,
    private evaluator: ExpressionEvaluator
  ) {}

  evaluate(store: Store, solutions?: Solution[]): Solution[] {
    const childResults = this.child.evaluate(store, solutions)
    
    if (this.groupBy.length === 0) {
      // No grouping - single group with all results
      return [this.computeAggregates(childResults, store)]
    }
    
    // Group by specified expressions
    const groups = new Map<string, Solution[]>()
    
    for (const solution of childResults) {
      const groupKey = this.groupBy
        .map(expr => this.evaluator.evaluate(expr, solution, store))
        .join('|')
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(solution)
    }
    
    // Compute aggregates for each group
    const result: Solution[] = []
    
    for (const [groupKey, groupSolutions] of groups) {
      const aggregated = this.computeAggregates(groupSolutions, store)
      
      // Add group by values
      const groupValues = groupKey.split('|')
      this.groupBy.forEach((expr, i) => {
        // Simplified - in real implementation, we'd need to track variable names
        aggregated[`group_${i}`] = groupValues[i]
      })
      
      result.push(aggregated)
    }
    
    return result
  }

  private computeAggregates(solutions: Solution[], store: Store): Solution {
    const result: Solution = {}
    
    for (const agg of this.aggregations) {
      const values: any[] = []
      
      for (const solution of solutions) {
        const value = this.evaluator.evaluate(agg.expression, solution, store)
        if (value !== null && value !== undefined) {
          values.push(value)
        }
      }
      
      if (agg.distinct) {
        const uniqueValues = Array.from(new Set(values.map(v => JSON.stringify(v))))
          .map(s => JSON.parse(s))
        result[agg.variable] = this.applyAggregateFunction(agg.function, uniqueValues)
      } else {
        result[agg.variable] = this.applyAggregateFunction(agg.function, values)
      }
    }
    
    return result
  }

  private applyAggregateFunction(func: string, values: any[]): any {
    switch (func.toUpperCase()) {
      case 'COUNT':
        return values.length
      case 'SUM':
        return values.reduce((sum, val) => sum + (Number(val) || 0), 0)
      case 'AVG':
        const numValues = values.filter(v => !isNaN(Number(v)))
        return numValues.length > 0 
          ? numValues.reduce((sum, val) => sum + Number(val), 0) / numValues.length 
          : 0
      case 'MIN':
        return values.length > 0 ? Math.min(...values.map(v => Number(v) || Infinity)) : null
      case 'MAX':
        return values.length > 0 ? Math.max(...values.map(v => Number(v) || -Infinity)) : null
      case 'SAMPLE':
        return values.length > 0 ? values[0] : null
      case 'GROUP_CONCAT':
        return values.join(', ')
      default:
        throw new Error(`Unknown aggregate function: ${func}`)
    }
  }

  estimateCardinality(store: Store): number {
    const childCard = this.child.estimateCardinality(store)
    
    if (this.groupBy.length === 0) {
      return 1 // Single result for ungrouped aggregation
    }
    
    // Estimate number of groups (simplified)
    return Math.min(childCard, Math.floor(childCard / 10))
  }

  getCost(): number {
    const childCost = this.child.getCost()
    const cardinality = this.child.estimateCardinality({} as Store)
    return childCost + cardinality * (this.aggregations.length + this.groupBy.length)
  }
}

/**
 * Expression evaluator for SPARQL expressions
 */
export class ExpressionEvaluator {
  evaluate(expression: Expression, solution: Solution, store: Store): any {
    switch (expression.type) {
      case 'operation':
        return this.evaluateOperation(expression, solution, store)
      case 'functionCall':
        return this.evaluateFunction(expression, solution, store)
      case 'aggregate':
        // Aggregates are handled by AggregateOperator
        throw new Error('Aggregates should be handled by AggregateOperator')
      case 'exists':
        return this.evaluateExists(expression, solution, store)
      case 'notExists':
        return !this.evaluateExists(expression, solution, store)
      default:
        throw new Error(`Unknown expression type: ${expression.type}`)
    }
  }

  private evaluateOperation(expression: Expression, solution: Solution, store: Store): any {
    const { operator, args = [] } = expression

    switch (operator) {
      case 'term':
        return this.evaluateTerm(args[0], solution)
      case '||':
        return args.some(arg => this.evaluate(arg, solution, store))
      case '&&':
        return args.every(arg => this.evaluate(arg, solution, store))
      case '=':
        return this.evaluate(args[0], solution, store) === this.evaluate(args[1], solution, store)
      case '!=':
        return this.evaluate(args[0], solution, store) !== this.evaluate(args[1], solution, store)
      case '<':
        return this.evaluate(args[0], solution, store) < this.evaluate(args[1], solution, store)
      case '>':
        return this.evaluate(args[0], solution, store) > this.evaluate(args[1], solution, store)
      case '<=':
        return this.evaluate(args[0], solution, store) <= this.evaluate(args[1], solution, store)
      case '>=':
        return this.evaluate(args[0], solution, store) >= this.evaluate(args[1], solution, store)
      case '+':
        return args.reduce((sum, arg) => sum + this.evaluate(arg, solution, store), 0)
      case '-':
        if (args.length === 1) {
          return -this.evaluate(args[0], solution, store)
        }
        return this.evaluate(args[0], solution, store) - this.evaluate(args[1], solution, store)
      case '*':
        return args.reduce((product, arg) => product * this.evaluate(arg, solution, store), 1)
      case '/':
        return this.evaluate(args[0], solution, store) / this.evaluate(args[1], solution, store)
      case '!':
        return !this.evaluate(args[0], solution, store)
      case 'IN':
        const value = this.evaluate(args[0], solution, store)
        return args.slice(1).some(arg => this.evaluate(arg, solution, store) === value)
      case 'NOT IN':
        const notValue = this.evaluate(args[0], solution, store)
        return !args.slice(1).some(arg => this.evaluate(arg, solution, store) === notValue)
      default:
        throw new Error(`Unknown operator: ${operator}`)
    }
  }

  private evaluateFunction(expression: Expression, solution: Solution, store: Store): any {
    const { function: funcName, args = [] } = expression
    const evaluatedArgs = args.map(arg => this.evaluate(arg, solution, store))

    switch (funcName?.toUpperCase()) {
      case 'BOUND':
        const varName = (args[0] as any).name // Assuming it's a variable
        return solution[varName] !== undefined
      case 'IF':
        return evaluatedArgs[0] ? evaluatedArgs[1] : evaluatedArgs[2]
      case 'COALESCE':
        return evaluatedArgs.find(val => val !== null && val !== undefined) || null
      case 'REGEX':
        const str = String(evaluatedArgs[0] || '')
        const pattern = String(evaluatedArgs[1] || '')
        const flags = evaluatedArgs[2] ? String(evaluatedArgs[2]) : undefined
        return new RegExp(pattern, flags).test(str)
      case 'CONTAINS':
        return String(evaluatedArgs[0] || '').includes(String(evaluatedArgs[1] || ''))
      case 'STRLEN':
        return String(evaluatedArgs[0] || '').length
      case 'SUBSTR':
        const substr = String(evaluatedArgs[0] || '')
        const start = Number(evaluatedArgs[1]) - 1 // SPARQL is 1-indexed
        const length = evaluatedArgs[2] ? Number(evaluatedArgs[2]) : undefined
        return length !== undefined ? substr.substr(start, length) : substr.substr(start)
      case 'UCASE':
        return String(evaluatedArgs[0] || '').toUpperCase()
      case 'LCASE':
        return String(evaluatedArgs[0] || '').toLowerCase()
      case 'LANG':
        // Simplified - would need access to original literal with language tag
        return ''
      case 'DATATYPE':
        // Simplified - would need access to original literal with datatype
        return 'http://www.w3.org/2001/XMLSchema#string'
      case 'STR':
        return String(evaluatedArgs[0] || '')
      case 'ABS':
        return Math.abs(Number(evaluatedArgs[0]))
      case 'CEIL':
        return Math.ceil(Number(evaluatedArgs[0]))
      case 'FLOOR':
        return Math.floor(Number(evaluatedArgs[0]))
      case 'ROUND':
        return Math.round(Number(evaluatedArgs[0]))
      case 'RAND':
        return Math.random()
      case 'NOW':
        return new Date().toISOString()
      default:
        throw new Error(`Unknown function: ${funcName}`)
    }
  }

  private evaluateExists(expression: Expression, solution: Solution, store: Store): boolean {
    // Simplified EXISTS evaluation
    // In a full implementation, we'd need to evaluate the graph patterns
    return expression.patterns !== undefined && expression.patterns.length > 0
  }

  private evaluateTerm(term: any, solution: Solution): any {
    if (term.type === 'variable') {
      return solution[term.name]
    } else if (term.type === 'iri') {
      return term.value
    } else if (term.type === 'literal') {
      return term.value
    }
    return term
  }
}

/**
 * SPARQL Algebra Compiler
 * Converts parsed queries into algebra operators
 */
export class AlgebraCompiler {
  private evaluator = new ExpressionEvaluator()

  compile(query: Query): AlgebraOperator {
    switch (query.type) {
      case 'select':
        return this.compileSelect(query as SelectQuery)
      case 'construct':
        return this.compileConstruct(query as ConstructQuery)
      case 'ask':
        return this.compileAsk(query as AskQuery)
      case 'describe':
        return this.compileDescribe(query as DescribeQuery)
      default:
        throw new Error(`Unsupported query type: ${(query as any).type}`)
    }
  }

  private compileSelect(query: SelectQuery): AlgebraOperator {
    let operator: AlgebraOperator = this.compileGraphPatterns(query.where || [])

    // Apply aggregation and grouping
    if (query.groupBy || this.hasAggregations(query.variables)) {
      const aggregations = this.extractAggregations(query.variables)
      operator = new AggregateOperator(aggregations, query.groupBy || [], operator, this.evaluator)
    }

    // Apply HAVING
    if (query.having) {
      for (const condition of query.having) {
        operator = new FilterOperator(condition, operator, this.evaluator)
      }
    }

    // Apply ORDER BY
    if (query.orderBy) {
      operator = new OrderByOperator(query.orderBy, operator, this.evaluator)
    }

    // Apply projection
    const projectedVars = this.getProjectedVariables(query.variables)
    if (projectedVars.length > 0) {
      operator = new ProjectOperator(projectedVars, operator)
    }

    // Apply DISTINCT
    if (query.distinct) {
      operator = new DistinctOperator(operator)
    }

    // Apply LIMIT/OFFSET
    if (query.limit !== undefined || query.offset !== undefined) {
      operator = new LimitOffsetOperator(query.limit, query.offset, operator)
    }

    return operator
  }

  private compileConstruct(query: ConstructQuery): AlgebraOperator {
    // For CONSTRUCT queries, we'd need additional operators to handle template construction
    // For now, return the compiled WHERE clause
    return this.compileGraphPatterns(query.where || [])
  }

  private compileAsk(query: AskQuery): AlgebraOperator {
    return this.compileGraphPatterns(query.where || [])
  }

  private compileDescribe(query: DescribeQuery): AlgebraOperator {
    // DESCRIBE queries would need special handling
    return this.compileGraphPatterns(query.where || [])
  }

  private compileGraphPatterns(patterns: GraphPattern[]): AlgebraOperator {
    if (patterns.length === 0) {
      return new BasicGraphPatternOperator([]) // Empty BGP
    }

    let operator: AlgebraOperator | null = null

    for (const pattern of patterns) {
      const compiled = this.compileGraphPattern(pattern)
      
      if (operator === null) {
        operator = compiled
      } else {
        operator = new JoinOperator(operator, compiled)
      }
    }

    return operator!
  }

  private compileGraphPattern(pattern: GraphPattern): AlgebraOperator {
    switch (pattern.type) {
      case 'group':
        return this.compileGraphPatterns(pattern.patterns || [])
      
      case 'union':
        const left = pattern.left ? this.compileGraphPattern(pattern.left) : new BasicGraphPatternOperator([])
        const right = pattern.right ? this.compileGraphPattern(pattern.right) : new BasicGraphPatternOperator([])
        return new UnionOperator(left, right)
      
      case 'optional':
        const optionalPatterns = this.compileGraphPatterns(pattern.patterns || [])
        return new OptionalOperator(new BasicGraphPatternOperator([]), optionalPatterns)
      
      case 'minus':
        const minusPatterns = this.compileGraphPatterns(pattern.patterns || [])
        return new MinusOperator(new BasicGraphPatternOperator([]), minusPatterns)
      
      case 'filter':
        const childOperator = new BasicGraphPatternOperator([]) // Simplified
        return new FilterOperator(pattern.expression!, childOperator, this.evaluator)
      
      default:
        // Assume it's a BGP if we don't recognize the type
        return new BasicGraphPatternOperator([])
    }
  }

  private hasAggregations(variables: any[]): boolean {
    return variables.some(v => 
      typeof v === 'object' && v.expression && v.expression.type === 'aggregate'
    )
  }

  private extractAggregations(variables: any[]): { function: string; variable: string; expression: Expression; distinct?: boolean }[] {
    return variables
      .filter(v => typeof v === 'object' && v.expression && v.expression.type === 'aggregate')
      .map(v => ({
        function: v.expression.function,
        variable: v.variable.name,
        expression: v.expression,
        distinct: v.expression.distinct
      }))
  }

  private getProjectedVariables(variables: any[]): string[] {
    return variables
      .map(v => {
        if (typeof v === 'string') return v.startsWith('?') ? v.substring(1) : v
        if (v.name) return v.name
        if (v.variable) return v.variable.name
        return null
      })
      .filter(Boolean)
  }
}