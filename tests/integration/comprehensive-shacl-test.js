/**
 * Comprehensive SHACL validation test covering all constraint types
 */
const { Store, Parser, DataFactory } = require('n3')
const { validateShacl } = require('../../packages/untology/dist/advanced.js')
const { withOntology } = require('../../packages/untology/dist/context.js')

async function runComprehensiveShaclTest() {
  console.log('🧪 Running comprehensive SHACL validation tests...')
  
  const tests = [
    testCardinalityConstraints,
    testDatatypeConstraints,
    testStringConstraints,
    testNumericConstraints,
    testNodeKindConstraints,
    testValueConstraints,
    testClosedShapes
  ]
  
  let passed = 0
  let total = tests.length
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Running ${test.name}...`)
      const success = await test()
      if (success) {
        console.log(`✅ ${test.name} passed`)
        passed++
      } else {
        console.log(`❌ ${test.name} failed`)
      }
    } catch (error) {
      console.error(`❌ ${test.name} threw error:`, error.message)
    }
  }
  
  console.log(`\n📊 Test Summary: ${passed}/${total} tests passed`)
  return passed === total
}

async function testCardinalityConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:item1 a ex:Item ;
            ex:title "Item 1" .
            
    ex:item2 a ex:Item ;
            ex:title "Title 1" ;
            ex:title "Title 2" .
            
    ex:item3 a ex:Item .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    
    ex:ItemShape a sh:NodeShape ;
      sh:targetClass ex:Item ;
      sh:property [
        sh:path ex:title ;
        sh:minCount 1 ;
        sh:maxCount 1
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find violations for item2 (too many titles) and item3 (no title)
  const minCountViolations = result.violations.filter(v => v.type === 'MinCountConstraintViolation')
  const maxCountViolations = result.violations.filter(v => v.type === 'MaxCountConstraintViolation')
  
  return minCountViolations.length === 1 && maxCountViolations.length === 1
}

async function testDatatypeConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:person1 a ex:Person ;
              ex:age "30"^^xsd:integer .
              
    ex:person2 a ex:Person ;
              ex:age "thirty" .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:PersonShape a sh:NodeShape ;
      sh:targetClass ex:Person ;
      sh:property [
        sh:path ex:age ;
        sh:datatype xsd:integer
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find datatype violation for person2
  const datatypeViolations = result.violations.filter(v => v.type === 'DatatypeConstraintViolation')
  return datatypeViolations.length === 1
}

async function testStringConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:user1 a ex:User ;
            ex:username "john" ;
            ex:email "john@example.com" .
            
    ex:user2 a ex:User ;
            ex:username "a" ;
            ex:email "invalid-email" .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    
    ex:UserShape a sh:NodeShape ;
      sh:targetClass ex:User ;
      sh:property [
        sh:path ex:username ;
        sh:minLength 3 ;
        sh:maxLength 20
      ] ;
      sh:property [
        sh:path ex:email ;
        sh:pattern "^[\\\\w._%+-]+@[\\\\w.-]+\\\\.[A-Za-z]{2,}$"
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find minLength violation for user2 username and pattern violation for user2 email
  const minLengthViolations = result.violations.filter(v => v.type === 'MinLengthConstraintViolation')
  const patternViolations = result.violations.filter(v => v.type === 'PatternConstraintViolation')
  
  return minLengthViolations.length === 1 && patternViolations.length === 1
}

async function testNumericConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:product1 a ex:Product ;
               ex:price "19.99"^^xsd:decimal ;
               ex:rating "4.5"^^xsd:float .
               
    ex:product2 a ex:Product ;
               ex:price "5.00"^^xsd:decimal ;
               ex:rating "6.0"^^xsd:float .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:ProductShape a sh:NodeShape ;
      sh:targetClass ex:Product ;
      sh:property [
        sh:path ex:price ;
        sh:datatype xsd:decimal ;
        sh:minInclusive 10.0
      ] ;
      sh:property [
        sh:path ex:rating ;
        sh:datatype xsd:float ;
        sh:minInclusive 1.0 ;
        sh:maxInclusive 5.0
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find violations for product2 (price too low, rating too high)
  const minInclusiveViolations = result.violations.filter(v => v.type === 'MinInclusiveConstraintViolation')
  const maxInclusiveViolations = result.violations.filter(v => v.type === 'MaxInclusiveConstraintViolation')
  
  return minInclusiveViolations.length === 1 && maxInclusiveViolations.length === 1
}

async function testNodeKindConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:doc1 a ex:Document ;
           ex:title "Document Title" ;
           ex:author ex:person1 .
           
    ex:doc2 a ex:Document ;
           ex:title "Another Document" ;
           ex:author "John Doe" .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    
    ex:DocumentShape a sh:NodeShape ;
      sh:targetClass ex:Document ;
      sh:property [
        sh:path ex:title ;
        sh:nodeKind sh:Literal
      ] ;
      sh:property [
        sh:path ex:author ;
        sh:nodeKind sh:IRI
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find node kind violation for doc2 author (should be IRI, not literal)
  const nodeKindViolations = result.violations.filter(v => v.type === 'NodeKindConstraintViolation')
  return nodeKindViolations.length === 1
}

async function testValueConstraints() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:task1 a ex:Task ;
            ex:status "pending" ;
            ex:priority "high" .
            
    ex:task2 a ex:Task ;
            ex:status "invalid" ;
            ex:priority "urgent" .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    
    ex:TaskShape a sh:NodeShape ;
      sh:targetClass ex:Task ;
      sh:property [
        sh:path ex:status ;
        sh:in ( "pending" "in-progress" "completed" )
      ] ;
      sh:property [
        sh:path ex:priority ;
        sh:in ( "low" "medium" "high" )
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find 'in' constraint violations for task2 (invalid status and priority)
  const inViolations = result.violations.filter(v => v.type === 'InConstraintViolation')
  return inViolations.length === 2
}

async function testClosedShapes() {
  const dataGraph = new Store()
  const parser = new Parser({ format: 'turtle' })
  
  const testData = `
    @prefix ex: <http://example.org/> .
    
    ex:person1 a ex:Person ;
              ex:name "John" ;
              ex:age 30 .
              
    ex:person2 a ex:Person ;
              ex:name "Jane" ;
              ex:age 25 ;
              ex:unexpectedProperty "should not be here" .
  `
  
  dataGraph.addQuads(parser.parse(testData))
  
  const shapesGraph = new Store()
  const shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    
    ex:PersonShape a sh:NodeShape ;
      sh:targetClass ex:Person ;
      sh:closed true ;
      sh:property [
        sh:path ex:name
      ] ;
      sh:property [
        sh:path ex:age
      ] .
  `
  
  shapesGraph.addQuads(parser.parse(shapesData))
  
  const result = await withOntology({ store: dataGraph }, async () => {
    return await validateShacl(shapesGraph)
  })
  
  // Should find closed constraint violation for person2
  const closedViolations = result.violations.filter(v => v.type === 'ClosedConstraintViolation')
  return closedViolations.length === 1
}

// Run the comprehensive test
if (require.main === module) {
  runComprehensiveShaclTest().then(success => {
    console.log(success ? '\n🎉 All SHACL tests passed!' : '\n❌ Some SHACL tests failed!')
    process.exit(success ? 0 : 1)
  })
}

module.exports = { runComprehensiveShaclTest }