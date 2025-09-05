/**
 * Integration test for SHACL validation
 */
const { Store, Parser, DataFactory } = require('n3')
const { validateShacl } = require('../../packages/untology/dist/advanced.js')
const { withOntology } = require('../../packages/untology/dist/context.js')

async function testShaclValidation() {
  console.log('🧪 Testing SHACL validation implementation...')
  
  try {
    // Create test data graph
    const dataGraph = new Store()
    const parser = new Parser({ format: 'turtle' })
    
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:person1 a ex:Person ;
                ex:name "John" ;
                ex:age 30 .
                
      ex:person2 a ex:Person ;
                ex:name "" ;
                ex:age "invalid" .
    `
    
    const dataQuads = parser.parse(testData)
    dataGraph.addQuads(dataQuads)
    
    // Create SHACL shapes graph
    const shapesGraph = new Store()
    const shapesData = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
          sh:path ex:name ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:datatype xsd:string ;
          sh:minLength 1
        ] ;
        sh:property [
          sh:path ex:age ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:datatype xsd:integer ;
          sh:minInclusive 0 ;
          sh:maxInclusive 150
        ] .
    `
    
    const shapeQuads = parser.parse(shapesData)
    shapesGraph.addQuads(shapeQuads)
    
    // Run validation within ontology context
    const result = await withOntology({ store: dataGraph }, async () => {
      return await validateShacl(shapesGraph)
    })
    
    console.log(`✅ Validation completed:`)
    console.log(`   - Conforms: ${result.conforms}`)
    console.log(`   - Violations: ${result.violations.length}`)
    
    if (result.violations.length > 0) {
      console.log('\n📋 Violations found:')
      result.violations.forEach((violation, index) => {
        console.log(`   ${index + 1}. ${violation.type}`)
        console.log(`      Focus node: ${violation.focusNode}`)
        console.log(`      Path: ${violation.resultPath || 'N/A'}`)
        console.log(`      Message: ${violation.message}`)
        console.log(`      Details:`, violation.details)
        console.log('')
      })
    }
    
    // Verify we found expected violations
    const expectedViolationTypes = [
      'MinLengthConstraintViolation', // empty name
      'DatatypeConstraintViolation'   // invalid age datatype
    ]
    
    const foundTypes = result.violations.map(v => v.type)
    const hasExpectedViolations = expectedViolationTypes.every(type => 
      foundTypes.includes(type)
    )
    
    if (hasExpectedViolations) {
      console.log('✅ All expected violations found!')
      console.log('🎉 SHACL validation implementation is working correctly!')
      return true
    } else {
      console.log('❌ Expected violations not found')
      console.log('Expected:', expectedViolationTypes)
      console.log('Found:', foundTypes)
      return false
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

// Run the test
if (require.main === module) {
  testShaclValidation().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { testShaclValidation }