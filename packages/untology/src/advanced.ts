/**
 * Advanced 20% features - power users only
 */
import { Store, Parser, StreamParser, Util, DataFactory, NamedNode, Literal, BlankNode, Term, Quad as N3Quad } from 'n3'
import { useOntology, withOntology } from './context'
import type { Quad } from 'n3'

// SHACL namespace constants
const SHACL = {
  // Core SHACL vocabulary
  Violation: 'http://www.w3.org/ns/shacl#Violation',
  ValidationReport: 'http://www.w3.org/ns/shacl#ValidationReport',
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  
  // Target properties
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  targetObjectsOf: 'http://www.w3.org/ns/shacl#targetObjectsOf',
  targetSubjectsOf: 'http://www.w3.org/ns/shacl#targetSubjectsOf',
  
  // Property shape properties
  property: 'http://www.w3.org/ns/shacl#property',
  path: 'http://www.w3.org/ns/shacl#path',
  
  // Cardinality constraints
  minCount: 'http://www.w3.org/ns/shacl#minCount',
  maxCount: 'http://www.w3.org/ns/shacl#maxCount',
  
  // Value type constraints
  datatype: 'http://www.w3.org/ns/shacl#datatype',
  class: 'http://www.w3.org/ns/shacl#class',
  nodeKind: 'http://www.w3.org/ns/shacl#nodeKind',
  
  // String constraints
  minLength: 'http://www.w3.org/ns/shacl#minLength',
  maxLength: 'http://www.w3.org/ns/shacl#maxLength',
  pattern: 'http://www.w3.org/ns/shacl#pattern',
  flags: 'http://www.w3.org/ns/shacl#flags',
  languageIn: 'http://www.w3.org/ns/shacl#languageIn',
  uniqueLang: 'http://www.w3.org/ns/shacl#uniqueLang',
  
  // Numeric constraints
  minInclusive: 'http://www.w3.org/ns/shacl#minInclusive',
  maxInclusive: 'http://www.w3.org/ns/shacl#maxInclusive',
  minExclusive: 'http://www.w3.org/ns/shacl#minExclusive',
  maxExclusive: 'http://www.w3.org/ns/shacl#maxExclusive',
  
  // Value constraints
  in: 'http://www.w3.org/ns/shacl#in',
  hasValue: 'http://www.w3.org/ns/shacl#hasValue',
  
  // Logical constraints
  not: 'http://www.w3.org/ns/shacl#not',
  and: 'http://www.w3.org/ns/shacl#and',
  or: 'http://www.w3.org/ns/shacl#or',
  xone: 'http://www.w3.org/ns/shacl#xone',
  
  // Shape-based constraints
  node: 'http://www.w3.org/ns/shacl#node',
  qualifiedValueShape: 'http://www.w3.org/ns/shacl#qualifiedValueShape',
  qualifiedMinCount: 'http://www.w3.org/ns/shacl#qualifiedMinCount',
  qualifiedMaxCount: 'http://www.w3.org/ns/shacl#qualifiedMaxCount',
  qualifiedValueShapesDisjoint: 'http://www.w3.org/ns/shacl#qualifiedValueShapesDisjoint',
  
  // Property pair constraints
  equals: 'http://www.w3.org/ns/shacl#equals',
  disjoint: 'http://www.w3.org/ns/shacl#disjoint',
  lessThan: 'http://www.w3.org/ns/shacl#lessThan',
  lessThanOrEquals: 'http://www.w3.org/ns/shacl#lessThanOrEquals',
  
  // Other constraints
  closed: 'http://www.w3.org/ns/shacl#closed',
  ignoredProperties: 'http://www.w3.org/ns/shacl#ignoredProperties',
  
  // Violation properties
  focusNode: 'http://www.w3.org/ns/shacl#focusNode',
  resultPath: 'http://www.w3.org/ns/shacl#resultPath',
  value: 'http://www.w3.org/ns/shacl#value',
  sourceConstraintComponent: 'http://www.w3.org/ns/shacl#sourceConstraintComponent',
  sourceShape: 'http://www.w3.org/ns/shacl#sourceShape',
  resultMessage: 'http://www.w3.org/ns/shacl#resultMessage',
  resultSeverity: 'http://www.w3.org/ns/shacl#resultSeverity',
  
  // Severities
  Info: 'http://www.w3.org/ns/shacl#Info',
  Warning: 'http://www.w3.org/ns/shacl#Warning',
  
  // Node kinds
  IRI: 'http://www.w3.org/ns/shacl#IRI',
  BlankNode: 'http://www.w3.org/ns/shacl#BlankNode',
  Literal: 'http://www.w3.org/ns/shacl#Literal',
  BlankNodeOrIRI: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI',
  BlankNodeOrLiteral: 'http://www.w3.org/ns/shacl#BlankNodeOrLiteral',
  IRIOrLiteral: 'http://www.w3.org/ns/shacl#IRIOrLiteral'
}

const RDF = {
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'
}

// SHACL validation interfaces
interface ShaclViolation {
  type: string
  focusNode: string
  sourceShape: string
  sourceConstraintComponent: string
  resultPath?: string
  value?: any
  message: string
  severity: string
  details?: Record<string, any>
}

interface ValidationResult {
  conforms: boolean
  violations: ShaclViolation[]
  report: Store
}

interface PropertyConstraints {
  minCount?: number
  maxCount?: number
  datatype?: string
  class?: string
  nodeKind?: string
  minLength?: number
  maxLength?: number
  pattern?: { pattern: string; flags?: string }
  languageIn?: string[]
  uniqueLang?: boolean
  minInclusive?: number
  maxInclusive?: number
  minExclusive?: number
  maxExclusive?: number
  hasValue?: Term
  in?: Term[]
  equals?: string
  disjoint?: string
  lessThan?: string
  lessThanOrEquals?: string
  node?: string
  not?: string
  and?: string[]
  or?: string[]
  xone?: string[]
  qualifiedValueShape?: string
  qualifiedMinCount?: number
  qualifiedMaxCount?: number
  qualifiedValueShapesDisjoint?: boolean
  closed?: boolean
  ignoredProperties?: string[]
}

/**
 * Execute raw SPARQL queries using the built-in SPARQL engine
 */
export async function sparqlQuery(query: string): Promise<any[]> {
  const { sparqlQuery: executeQuery } = await import('./sparql-engine')
  return executeQuery(query)
}

/**
 * Merge multiple graphs
 */
export function mergeGraphs(stores: Store[]): Store {
  const merged = new Store()
  
  for (const store of stores) {
    const quads = store.getQuads(null, null, null, null)
    merged.addQuads(quads)
  }
  
  return merged
}

/**
 * Create a new graph context
 */
export function createGraph(): Store {
  return new Store()
}

/**
 * Parse Turtle string without setting context
 */
export function parseTurtle(input: string, baseIRI?: string): Quad[] {
  const parser = new Parser({ format: 'turtle', baseIRI })
  return parser.parse(input)
}

/**
 * Stream parse large files
 */
export function createStreamParser(
  format: 'turtle' | 'ntriples' = 'turtle'
): StreamParser {
  return new StreamParser({ format })
}

/**
 * Validate graph against SHACL shapes with comprehensive constraint support
 */
export async function validateShacl(shapesGraph: Store): Promise<ValidationResult> {
  const { store } = useOntology()
  const violations: ShaclViolation[] = []
  const reportStore = new Store()
  
  try {
    // Find all node shapes
    const nodeShapes = shapesGraph.getQuads(
      null, 
      DataFactory.namedNode(RDF.type), 
      DataFactory.namedNode(SHACL.NodeShape), 
      null
    )
    
    // Find all property shapes  
    const propertyShapes = shapesGraph.getQuads(
      null,
      DataFactory.namedNode(RDF.type),
      DataFactory.namedNode(SHACL.PropertyShape),
      null
    )
    
    // Validate node shapes
    for (const shapeQuad of nodeShapes) {
      const shapeIRI = shapeQuad.subject.value
      const targetNodes = getTargetNodes(shapeIRI, shapesGraph, store)
      
      for (const targetNode of targetNodes) {
        const shapeViolations = await validateNodeShape(
          targetNode,
          shapeIRI,
          shapesGraph,
          store
        )
        violations.push(...shapeViolations)
      }
    }
    
    // Validate standalone property shapes
    for (const shapeQuad of propertyShapes) {
      const shapeIRI = shapeQuad.subject.value
      const targetNodes = getTargetNodes(shapeIRI, shapesGraph, store)
      
      for (const targetNode of targetNodes) {
        const shapeViolations = await validatePropertyShape(
          targetNode,
          shapeIRI,
          shapesGraph,
          store
        )
        violations.push(...shapeViolations)
      }
    }
    
    // Create validation report
    const reportIRI = DataFactory.blankNode('report')
    reportStore.addQuad(DataFactory.quad(
      reportIRI,
      DataFactory.namedNode(RDF.type),
      DataFactory.namedNode(SHACL.ValidationReport),
      DataFactory.defaultGraph()
    ))
    
    // Add violations to report
    for (let i = 0; i < violations.length; i++) {
      const violationNode = DataFactory.blankNode(`violation_${i}`)
      addViolationToReport(violationNode, violations[i], reportStore)
    }
    
    return {
      conforms: violations.length === 0,
      violations,
      report: reportStore
    }
  } catch (error) {
    throw new Error(`SHACL validation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get target nodes for a shape based on target definitions
 */
function getTargetNodes(shapeIRI: string, shapesGraph: Store, dataGraph: Store): string[] {
  const targetNodes = new Set<string>()
  
  // sh:targetClass - all instances of specified classes
  const targetClassQuads = shapesGraph.getQuads(
    DataFactory.namedNode(shapeIRI),
    DataFactory.namedNode(SHACL.targetClass),
    null,
    null
  )
  
  for (const quad of targetClassQuads) {
    const targetClass = quad.object.value
    const instances = dataGraph.getQuads(
      null,
      DataFactory.namedNode(RDF.type),
      DataFactory.namedNode(targetClass),
      null
    )
    
    for (const instance of instances) {
      targetNodes.add(instance.subject.value)
    }
  }
  
  // sh:targetNode - specific nodes
  const targetNodeQuads = shapesGraph.getQuads(
    DataFactory.namedNode(shapeIRI),
    DataFactory.namedNode(SHACL.targetNode),
    null,
    null
  )
  
  for (const quad of targetNodeQuads) {
    targetNodes.add(quad.object.value)
  }
  
  // sh:targetSubjectsOf - subjects of specified properties
  const targetSubjectsOfQuads = shapesGraph.getQuads(
    DataFactory.namedNode(shapeIRI),
    DataFactory.namedNode(SHACL.targetSubjectsOf),
    null,
    null
  )
  
  for (const quad of targetSubjectsOfQuads) {
    const property = quad.object.value
    const subjects = dataGraph.getQuads(
      null,
      DataFactory.namedNode(property),
      null,
      null
    )
    
    for (const subject of subjects) {
      targetNodes.add(subject.subject.value)
    }
  }
  
  // sh:targetObjectsOf - objects of specified properties
  const targetObjectsOfQuads = shapesGraph.getQuads(
    DataFactory.namedNode(shapeIRI),
    DataFactory.namedNode(SHACL.targetObjectsOf),
    null,
    null
  )
  
  for (const quad of targetObjectsOfQuads) {
    const property = quad.object.value
    const objects = dataGraph.getQuads(
      null,
      DataFactory.namedNode(property),
      null,
      null
    )
    
    for (const object of objects) {
      if (object.object.termType === 'NamedNode' || object.object.termType === 'BlankNode') {
        targetNodes.add(object.object.value)
      }
    }
  }
  
  return Array.from(targetNodes)
}

/**
 * Validate a node shape against a target node
 */
async function validateNodeShape(
  focusNode: string,
  shapeIRI: string,
  shapesGraph: Store,
  dataGraph: Store
): Promise<ShaclViolation[]> {
  const violations: ShaclViolation[] = []
  
  // Get all property shapes for this node shape
  const propertyQuads = shapesGraph.getQuads(
    DataFactory.namedNode(shapeIRI),
    DataFactory.namedNode(SHACL.property),
    null,
    null
  )
  
  for (const propQuad of propertyQuads) {
    const propertyShapeIRI = propQuad.object.value
    const propViolations = await validatePropertyShape(
      focusNode,
      propertyShapeIRI,
      shapesGraph,
      dataGraph
    )
    violations.push(...propViolations)
  }
  
  // Validate node-level constraints
  const nodeViolations = await validateNodeConstraints(
    focusNode,
    shapeIRI,
    shapesGraph,
    dataGraph
  )
  violations.push(...nodeViolations)
  
  return violations
}

/**
 * Validate property shape constraints with comprehensive SHACL support
 */
async function validatePropertyShape(
  focusNode: string,
  propShapeIRI: string,
  shapesGraph: Store,
  dataGraph: Store
): Promise<ShaclViolation[]> {
  const violations: ShaclViolation[] = []
  
  // Get the property path
  const pathQuads = shapesGraph.getQuads(
    DataFactory.namedNode(propShapeIRI),
    DataFactory.namedNode(SHACL.path),
    null,
    null
  )
  
  if (pathQuads.length === 0) {
    return violations // No path defined
  }
  
  const path = pathQuads[0].object.value
  const pathValues = getPropertyValues(focusNode, path, dataGraph)
  
  // Parse all constraints for this property shape
  const constraints = parsePropertyConstraints(propShapeIRI, shapesGraph)
  
  // Validate cardinality constraints
  if (constraints.minCount !== undefined) {
    if (pathValues.length < constraints.minCount) {
      violations.push({
        type: 'MinCountConstraintViolation',
        focusNode,
        sourceShape: propShapeIRI,
        sourceConstraintComponent: SHACL.minCount,
        resultPath: path,
        message: `Property ${path} has ${pathValues.length} values, but minimum count is ${constraints.minCount}`,
        severity: SHACL.Violation,
        details: { minCount: constraints.minCount, actualCount: pathValues.length }
      })
    }
  }
  
  if (constraints.maxCount !== undefined) {
    if (pathValues.length > constraints.maxCount) {
      violations.push({
        type: 'MaxCountConstraintViolation',
        focusNode,
        sourceShape: propShapeIRI,
        sourceConstraintComponent: SHACL.maxCount,
        resultPath: path,
        message: `Property ${path} has ${pathValues.length} values, but maximum count is ${constraints.maxCount}`,
        severity: SHACL.Violation,
        details: { maxCount: constraints.maxCount, actualCount: pathValues.length }
      })
    }
  }
  
  // Validate each value against constraints
  for (const valueQuad of pathValues) {
    const value = valueQuad.object
    const valueViolations = validateValueConstraints(
      focusNode,
      propShapeIRI,
      path,
      value,
      constraints,
      shapesGraph,
      dataGraph
    )
    violations.push(...valueViolations)
  }
  
  return violations
}

/**
 * Get property values for a given path (supports simple paths only for now)
 */
function getPropertyValues(subject: string, path: string, dataGraph: Store): Quad[] {
  return dataGraph.getQuads(
    DataFactory.namedNode(subject),
    DataFactory.namedNode(path),
    null,
    null
  )
}

/**
 * Parse all property constraints from a property shape
 */
function parsePropertyConstraints(propShapeIRI: string, shapesGraph: Store): PropertyConstraints {
  const constraints: PropertyConstraints = {}
  const shapeNode = DataFactory.namedNode(propShapeIRI)
  
  // Cardinality constraints
  const minCountQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.minCount), null, null)
  if (minCountQuads.length > 0 && minCountQuads[0].object.termType === 'Literal') {
    constraints.minCount = parseInt(minCountQuads[0].object.value)
  }
  
  const maxCountQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.maxCount), null, null)
  if (maxCountQuads.length > 0 && maxCountQuads[0].object.termType === 'Literal') {
    constraints.maxCount = parseInt(maxCountQuads[0].object.value)
  }
  
  // Type constraints
  const datatypeQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.datatype), null, null)
  if (datatypeQuads.length > 0) {
    constraints.datatype = datatypeQuads[0].object.value
  }
  
  const classQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.class), null, null)
  if (classQuads.length > 0) {
    constraints.class = classQuads[0].object.value
  }
  
  const nodeKindQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.nodeKind), null, null)
  if (nodeKindQuads.length > 0) {
    constraints.nodeKind = nodeKindQuads[0].object.value
  }
  
  // String constraints
  const minLengthQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.minLength), null, null)
  if (minLengthQuads.length > 0 && minLengthQuads[0].object.termType === 'Literal') {
    constraints.minLength = parseInt(minLengthQuads[0].object.value)
  }
  
  const maxLengthQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.maxLength), null, null)
  if (maxLengthQuads.length > 0 && maxLengthQuads[0].object.termType === 'Literal') {
    constraints.maxLength = parseInt(maxLengthQuads[0].object.value)
  }
  
  const patternQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.pattern), null, null)
  if (patternQuads.length > 0 && patternQuads[0].object.termType === 'Literal') {
    const flagsQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.flags), null, null)
    constraints.pattern = {
      pattern: patternQuads[0].object.value,
      flags: flagsQuads.length > 0 && flagsQuads[0].object.termType === 'Literal' 
        ? flagsQuads[0].object.value 
        : undefined
    }
  }
  
  // Numeric constraints
  const minInclusiveQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.minInclusive), null, null)
  if (minInclusiveQuads.length > 0 && minInclusiveQuads[0].object.termType === 'Literal') {
    constraints.minInclusive = parseFloat(minInclusiveQuads[0].object.value)
  }
  
  const maxInclusiveQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.maxInclusive), null, null)
  if (maxInclusiveQuads.length > 0 && maxInclusiveQuads[0].object.termType === 'Literal') {
    constraints.maxInclusive = parseFloat(maxInclusiveQuads[0].object.value)
  }
  
  const minExclusiveQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.minExclusive), null, null)
  if (minExclusiveQuads.length > 0 && minExclusiveQuads[0].object.termType === 'Literal') {
    constraints.minExclusive = parseFloat(minExclusiveQuads[0].object.value)
  }
  
  const maxExclusiveQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.maxExclusive), null, null)
  if (maxExclusiveQuads.length > 0 && maxExclusiveQuads[0].object.termType === 'Literal') {
    constraints.maxExclusive = parseFloat(maxExclusiveQuads[0].object.value)
  }
  
  // Value constraints
  const hasValueQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.hasValue), null, null)
  if (hasValueQuads.length > 0) {
    constraints.hasValue = hasValueQuads[0].object
  }
  
  const inQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.in), null, null)
  if (inQuads.length > 0) {
    constraints.in = parseRDFList(inQuads[0].object.value, shapesGraph)
  }
  
  // Property pair constraints
  const equalsQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.equals), null, null)
  if (equalsQuads.length > 0) {
    constraints.equals = equalsQuads[0].object.value
  }
  
  const disjointQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.disjoint), null, null)
  if (disjointQuads.length > 0) {
    constraints.disjoint = disjointQuads[0].object.value
  }
  
  const lessThanQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.lessThan), null, null)
  if (lessThanQuads.length > 0) {
    constraints.lessThan = lessThanQuads[0].object.value
  }
  
  const lessThanOrEqualsQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.lessThanOrEquals), null, null)
  if (lessThanOrEqualsQuads.length > 0) {
    constraints.lessThanOrEquals = lessThanOrEqualsQuads[0].object.value
  }
  
  // Shape-based constraints
  const nodeQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.node), null, null)
  if (nodeQuads.length > 0) {
    constraints.node = nodeQuads[0].object.value
  }
  
  // Logical constraints
  const notQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.not), null, null)
  if (notQuads.length > 0) {
    constraints.not = notQuads[0].object.value
  }
  
  const andQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.and), null, null)
  if (andQuads.length > 0) {
    constraints.and = parseRDFList(andQuads[0].object.value, shapesGraph).map(term => term.value)
  }
  
  const orQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.or), null, null)
  if (orQuads.length > 0) {
    constraints.or = parseRDFList(orQuads[0].object.value, shapesGraph).map(term => term.value)
  }
  
  const xoneQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.xone), null, null)
  if (xoneQuads.length > 0) {
    constraints.xone = parseRDFList(xoneQuads[0].object.value, shapesGraph).map(term => term.value)
  }
  
  return constraints
}

/**
 * Validate a value against property constraints
 */
function validateValueConstraints(
  focusNode: string,
  sourceShape: string,
  path: string,
  value: Term,
  constraints: PropertyConstraints,
  shapesGraph: Store,
  dataGraph: Store
): ShaclViolation[] {
  const violations: ShaclViolation[] = []
  
  // Datatype constraint
  if (constraints.datatype && value.termType === 'Literal') {
    const literal = value as Literal
    if (literal.datatype.value !== constraints.datatype) {
      violations.push({
        type: 'DatatypeConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.datatype,
        resultPath: path,
        value: value.value,
        message: `Value "${value.value}" does not have datatype ${constraints.datatype}`,
        severity: SHACL.Violation,
        details: {
          expectedDatatype: constraints.datatype,
          actualDatatype: literal.datatype.value
        }
      })
    }
  }
  
  // Class constraint
  if (constraints.class && (value.termType === 'NamedNode' || value.termType === 'BlankNode')) {
    const hasType = dataGraph.getQuads(
      value as NamedNode | BlankNode,
      DataFactory.namedNode(RDF.type),
      DataFactory.namedNode(constraints.class),
      null
    )
    
    if (hasType.length === 0) {
      violations.push({
        type: 'ClassConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.class,
        resultPath: path,
        value: value.value,
        message: `Value is not an instance of class ${constraints.class}`,
        severity: SHACL.Violation,
        details: { expectedClass: constraints.class }
      })
    }
  }
  
  // Node kind constraint
  if (constraints.nodeKind) {
    const nodeKindValid = validateNodeKind(value, constraints.nodeKind)
    if (!nodeKindValid) {
      violations.push({
        type: 'NodeKindConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.nodeKind,
        resultPath: path,
        value: value.value,
        message: `Value does not have the required node kind ${constraints.nodeKind}`,
        severity: SHACL.Violation,
        details: {
          expectedNodeKind: constraints.nodeKind,
          actualNodeKind: value.termType
        }
      })
    }
  }
  
  // String length constraints
  if (value.termType === 'Literal') {
    const stringValue = value.value
    
    if (constraints.minLength !== undefined && stringValue.length < constraints.minLength) {
      violations.push({
        type: 'MinLengthConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.minLength,
        resultPath: path,
        value: stringValue,
        message: `String "${stringValue}" has length ${stringValue.length}, but minimum length is ${constraints.minLength}`,
        severity: SHACL.Violation,
        details: {
          minLength: constraints.minLength,
          actualLength: stringValue.length
        }
      })
    }
    
    if (constraints.maxLength !== undefined && stringValue.length > constraints.maxLength) {
      violations.push({
        type: 'MaxLengthConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.maxLength,
        resultPath: path,
        value: stringValue,
        message: `String "${stringValue}" has length ${stringValue.length}, but maximum length is ${constraints.maxLength}`,
        severity: SHACL.Violation,
        details: {
          maxLength: constraints.maxLength,
          actualLength: stringValue.length
        }
      })
    }
    
    // Pattern constraint
    if (constraints.pattern) {
      const regex = new RegExp(constraints.pattern.pattern, constraints.pattern.flags)
      if (!regex.test(stringValue)) {
        violations.push({
          type: 'PatternConstraintViolation',
          focusNode,
          sourceShape,
          sourceConstraintComponent: SHACL.pattern,
          resultPath: path,
          value: stringValue,
          message: `String "${stringValue}" does not match pattern ${constraints.pattern.pattern}`,
          severity: SHACL.Violation,
          details: {
            pattern: constraints.pattern.pattern,
            flags: constraints.pattern.flags
          }
        })
      }
    }
  }
  
  // Numeric constraints
  if (value.termType === 'Literal' && isNumericValue(value)) {
    const numValue = parseFloat(value.value)
    
    if (constraints.minInclusive !== undefined && numValue < constraints.minInclusive) {
      violations.push({
        type: 'MinInclusiveConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.minInclusive,
        resultPath: path,
        value: numValue,
        message: `Value ${numValue} is less than minimum inclusive value ${constraints.minInclusive}`,
        severity: SHACL.Violation,
        details: {
          minInclusive: constraints.minInclusive,
          actualValue: numValue
        }
      })
    }
    
    if (constraints.maxInclusive !== undefined && numValue > constraints.maxInclusive) {
      violations.push({
        type: 'MaxInclusiveConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.maxInclusive,
        resultPath: path,
        value: numValue,
        message: `Value ${numValue} is greater than maximum inclusive value ${constraints.maxInclusive}`,
        severity: SHACL.Violation,
        details: {
          maxInclusive: constraints.maxInclusive,
          actualValue: numValue
        }
      })
    }
    
    if (constraints.minExclusive !== undefined && numValue <= constraints.minExclusive) {
      violations.push({
        type: 'MinExclusiveConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.minExclusive,
        resultPath: path,
        value: numValue,
        message: `Value ${numValue} is not greater than minimum exclusive value ${constraints.minExclusive}`,
        severity: SHACL.Violation,
        details: {
          minExclusive: constraints.minExclusive,
          actualValue: numValue
        }
      })
    }
    
    if (constraints.maxExclusive !== undefined && numValue >= constraints.maxExclusive) {
      violations.push({
        type: 'MaxExclusiveConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.maxExclusive,
        resultPath: path,
        value: numValue,
        message: `Value ${numValue} is not less than maximum exclusive value ${constraints.maxExclusive}`,
        severity: SHACL.Violation,
        details: {
          maxExclusive: constraints.maxExclusive,
          actualValue: numValue
        }
      })
    }
  }
  
  // HasValue constraint
  if (constraints.hasValue) {
    if (!Util.equals(value, constraints.hasValue)) {
      violations.push({
        type: 'HasValueConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.hasValue,
        resultPath: path,
        value: value.value,
        message: `Value does not equal the required value`,
        severity: SHACL.Violation,
        details: {
          requiredValue: constraints.hasValue.value
        }
      })
    }
  }
  
  // In constraint
  if (constraints.in) {
    const valueInList = constraints.in.some(listValue => Util.equals(value, listValue))
    if (!valueInList) {
      violations.push({
        type: 'InConstraintViolation',
        focusNode,
        sourceShape,
        sourceConstraintComponent: SHACL.in,
        resultPath: path,
        value: value.value,
        message: `Value is not in the allowed list of values`,
        severity: SHACL.Violation,
        details: {
          allowedValues: constraints.in.map(v => v.value)
        }
      })
    }
  }
  
  return violations
}

/**
 * Validate node-level constraints
 */
async function validateNodeConstraints(
  focusNode: string,
  shapeIRI: string,
  shapesGraph: Store,
  dataGraph: Store
): Promise<ShaclViolation[]> {
  const violations: ShaclViolation[] = []
  
  // Parse node-level constraints
  const shapeNode = DataFactory.namedNode(shapeIRI)
  
  // Closed constraint
  const closedQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.closed), null, null)
  if (closedQuads.length > 0 && closedQuads[0].object.value === 'true') {
    const ignoredProperties: string[] = []
    
    // Get ignored properties
    const ignoredPropsQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.ignoredProperties), null, null)
    if (ignoredPropsQuads.length > 0) {
      const ignoredList = parseRDFList(ignoredPropsQuads[0].object.value, shapesGraph)
      ignoredProperties.push(...ignoredList.map(term => term.value))
    }
    
    // Get allowed properties (from property shapes)
    const allowedProperties: string[] = [...ignoredProperties]
    const propertyQuads = shapesGraph.getQuads(shapeNode, DataFactory.namedNode(SHACL.property), null, null)
    
    for (const propQuad of propertyQuads) {
      const propShapeIRI = propQuad.object.value
      const pathQuads = shapesGraph.getQuads(
        DataFactory.namedNode(propShapeIRI),
        DataFactory.namedNode(SHACL.path),
        null,
        null
      )
      
      if (pathQuads.length > 0) {
        allowedProperties.push(pathQuads[0].object.value)
      }
    }
    
    // Check for unexpected properties
    const nodeQuads = dataGraph.getQuads(DataFactory.namedNode(focusNode), null, null, null)
    for (const quad of nodeQuads) {
      const predicate = quad.predicate.value
      if (!allowedProperties.includes(predicate) && predicate !== RDF.type) {
        violations.push({
          type: 'ClosedConstraintViolation',
          focusNode,
          sourceShape: shapeIRI,
          sourceConstraintComponent: SHACL.closed,
          resultPath: predicate,
          message: `Property ${predicate} is not allowed (shape is closed)`,
          severity: SHACL.Violation,
          details: {
            unexpectedProperty: predicate,
            allowedProperties
          }
        })
      }
    }
  }
  
  return violations
}

/**
 * Validate node kind constraint
 */
function validateNodeKind(value: Term, expectedNodeKind: string): boolean {
  switch (expectedNodeKind) {
    case SHACL.IRI:
      return value.termType === 'NamedNode'
    case SHACL.BlankNode:
      return value.termType === 'BlankNode'
    case SHACL.Literal:
      return value.termType === 'Literal'
    case SHACL.BlankNodeOrIRI:
      return value.termType === 'BlankNode' || value.termType === 'NamedNode'
    case SHACL.BlankNodeOrLiteral:
      return value.termType === 'BlankNode' || value.termType === 'Literal'
    case SHACL.IRIOrLiteral:
      return value.termType === 'NamedNode' || value.termType === 'Literal'
    default:
      return false
  }
}

/**
 * Check if a literal value is numeric
 */
function isNumericValue(literal: Literal): boolean {
  const datatype = literal.datatype.value
  return [
    'http://www.w3.org/2001/XMLSchema#int',
    'http://www.w3.org/2001/XMLSchema#integer', 
    'http://www.w3.org/2001/XMLSchema#decimal',
    'http://www.w3.org/2001/XMLSchema#float',
    'http://www.w3.org/2001/XMLSchema#double',
    'http://www.w3.org/2001/XMLSchema#byte',
    'http://www.w3.org/2001/XMLSchema#short',
    'http://www.w3.org/2001/XMLSchema#long',
    'http://www.w3.org/2001/XMLSchema#unsignedByte',
    'http://www.w3.org/2001/XMLSchema#unsignedShort',
    'http://www.w3.org/2001/XMLSchema#unsignedInt',
    'http://www.w3.org/2001/XMLSchema#unsignedLong',
    'http://www.w3.org/2001/XMLSchema#positiveInteger',
    'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
    'http://www.w3.org/2001/XMLSchema#negativeInteger',
    'http://www.w3.org/2001/XMLSchema#nonPositiveInteger'
  ].includes(datatype)
}

/**
 * Parse an RDF list into an array of terms
 */
function parseRDFList(listNodeValue: string, store: Store): Term[] {
  const items: Term[] = []
  let current = listNodeValue
  
  while (current !== RDF.nil) {
    const firstQuads = store.getQuads(
      DataFactory.namedNode(current),
      DataFactory.namedNode(RDF.first),
      null,
      null
    )
    
    const restQuads = store.getQuads(
      DataFactory.namedNode(current),
      DataFactory.namedNode(RDF.rest),
      null,
      null
    )
    
    if (firstQuads.length === 0 || restQuads.length === 0) {
      break // Malformed list
    }
    
    items.push(firstQuads[0].object)
    current = restQuads[0].object.value
  }
  
  return items
}

/**
 * Add a violation to the validation report
 */
function addViolationToReport(violationNode: BlankNode, violation: ShaclViolation, reportStore: Store): void {
  // Add violation type
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(RDF.type),
    DataFactory.namedNode(SHACL.Violation)
  ))
  
  // Add focus node
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(SHACL.focusNode),
    DataFactory.namedNode(violation.focusNode)
  ))
  
  // Add source shape
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(SHACL.sourceShape),
    DataFactory.namedNode(violation.sourceShape)
  ))
  
  // Add source constraint component
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(SHACL.sourceConstraintComponent),
    DataFactory.namedNode(violation.sourceConstraintComponent)
  ))
  
  // Add result path if available
  if (violation.resultPath) {
    reportStore.addQuad(DataFactory.quad(
      violationNode,
      DataFactory.namedNode(SHACL.resultPath),
      DataFactory.namedNode(violation.resultPath)
    ))
  }
  
  // Add value if available
  if (violation.value !== undefined) {
    let valueNode: Term
    if (typeof violation.value === 'string') {
      valueNode = DataFactory.literal(violation.value)
    } else if (typeof violation.value === 'number') {
      valueNode = DataFactory.literal(violation.value.toString(), DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal'))
    } else if (typeof violation.value === 'boolean') {
      valueNode = DataFactory.literal(violation.value.toString(), DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'))
    } else {
      valueNode = DataFactory.literal(String(violation.value))
    }
    
    reportStore.addQuad(DataFactory.quad(
      violationNode,
      DataFactory.namedNode(SHACL.value),
      valueNode
    ))
  }
  
  // Add result message
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(SHACL.resultMessage),
    DataFactory.literal(violation.message)
  ))
  
  // Add result severity
  reportStore.addQuad(DataFactory.quad(
    violationNode,
    DataFactory.namedNode(SHACL.resultSeverity),
    DataFactory.namedNode(violation.severity)
  ))
}

/**
 * Perform OWL reasoning and return inferred quads
 */
export async function inferOwl(rules?: string[]): Promise<Quad[]> {
  const { inferenceEngine } = await import('./inference')
  const { store } = useOntology()
  
  // Store original size to track what we infer
  const originalSize = store.size
  
  // Clear previous inference tracking
  inferenceEngine.clearInferences()
  
  // Run inference engine
  const result = await inferenceEngine.infer(10) // Max 10 iterations
  
  // Get all quads from store and return the newly inferred ones
  const allQuads = store.getQuads(null, null, null, null)
  
  // Return the quads that were added during inference
  const inferredQuads = allQuads.slice(originalSize)
  
  return inferredQuads
}

/**
 * Perform class hierarchy reasoning only
 */
export async function inferClassHierarchy(): Promise<Quad[]> {
  return inferOwl(['rdfs', 'subclass'])
}

/**
 * Perform property reasoning only
 */
export async function inferPropertyHierarchy(): Promise<Quad[]> {
  return inferOwl(['property', 'subproperty'])
}

/**
 * Perform inverse property reasoning only
 */
export async function inferInverseProperties(): Promise<Quad[]> {
  return inferOwl(['inverse'])
}

/**
 * Perform equivalence reasoning only
 */
export async function inferEquivalences(): Promise<Quad[]> {
  return inferOwl(['equivalence'])
}

/**
 * Perform transitivity reasoning only
 */
export async function inferTransitiveProperties(): Promise<Quad[]> {
  return inferOwl(['transitivity'])
}

/**
 * Perform symmetry reasoning only
 */
export async function inferSymmetricProperties(): Promise<Quad[]> {
  return inferOwl(['symmetry'])
}

/**
 * Graph isomorphism check
 */
export function isIsomorphic(store1: Store, store2: Store): boolean {
  return Util.isomorphic(
    store1.getQuads(null, null, null, null),
    store2.getQuads(null, null, null, null)
  )
}

/**
 * Create a blank node
 */
export function blankNode(value?: string) {
  return Util.blankNode(value)
}

/**
 * Create a named node
 */
export function namedNode(value: string) {
  return Util.namedNode(value)
}

/**
 * Create a literal
 */
export function literal(value: string, languageOrDatatype?: string) {
  return Util.literal(value, languageOrDatatype)
}

/**
 * Check if two terms are equal
 */
export function equals(term1: any, term2: any): boolean {
  return Util.equals(term1, term2)
}

/**
 * Get all namespaces from the graph
 */
export function getNamespaces(): Record<string, string> {
  const { prefixes } = useOntology()
  return { ...prefixes }
}

/**
 * Add a namespace prefix
 */
export function addNamespace(prefix: string, iri: string): void {
  const ctx = useOntology()
  ctx.prefixes[prefix] = iri
}

/**
 * Create a sub-graph view
 */
export function subGraph(subject: string): Store {
  const { store } = useOntology()
  const subStore = new Store()
  
  const quads = store.getQuads(subject, null, null, null)
  subStore.addQuads(quads)
  
  // Add connected nodes
  for (const quad of quads) {
    if (quad.object.termType === 'NamedNode') {
      const connected = store.getQuads(quad.object.value, null, null, null)
      subStore.addQuads(connected)
    }
  }
  
  return subStore
}

/**
 * Graph statistics
 */
export function getStatistics(): {
  triples: number
  subjects: number
  predicates: number
  objects: number
  literals: number
  iris: number
} {
  const { store } = useOntology()
  const subjects = new Set<string>()
  const predicates = new Set<string>()
  const objects = new Set<string>()
  let literals = 0
  let iris = 0
  
  for (const quad of store) {
    subjects.add(quad.subject.value)
    predicates.add(quad.predicate.value)
    objects.add(quad.object.value)
    
    if (quad.object.termType === 'Literal') literals++
    if (quad.object.termType === 'NamedNode') iris++
  }
  
  return {
    triples: store.size,
    subjects: subjects.size,
    predicates: predicates.size,
    objects: objects.size,
    literals,
    iris
  }
}