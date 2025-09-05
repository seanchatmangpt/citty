/**
 * Quick demo of SHACL validation functionality
 */
const { Store, Parser, DataFactory } = require('n3')

// Mock the ontology context for testing
function mockUseOntology(store) {
  return () => ({ store, prefixes: {}, defaultFormat: 'turtle' })
}

function mockWithOntology(context, fn) {
  const originalUseOntology = global.useOntology
  global.useOntology = mockUseOntology(context.store)
  try {
    return fn()
  } finally {
    global.useOntology = originalUseOntology
  }
}

async function demonstrateShaclValidation() {
  console.log('🚀 SHACL Validation Demonstration')
  console.log('==================================\n')
  
  try {
    // Create test data
    const dataStore = new Store()
    const parser = new Parser({ format: 'turtle' })
    
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:john a ex:Person ;
             ex:name "John Doe" ;
             ex:age "30"^^xsd:integer ;
             ex:email "john@example.com" .
             
      ex:jane a ex:Person ;
             ex:name "" ;
             ex:age "not-a-number" ;
             ex:email "invalid-email" .
             
      ex:bob a ex:Person ;
             ex:name "Bob Smith" .
             
      ex:invalid a ex:Person .
    `
    
    const dataQuads = parser.parse(testData)
    dataStore.addQuads(dataQuads)
    console.log(`📊 Loaded ${dataQuads.length} data triples`)
    
    // Create SHACL shapes
    const shapesStore = new Store()
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
          sh:minLength 1 ;
          sh:maxLength 100
        ] ;
        sh:property [
          sh:path ex:age ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:datatype xsd:integer ;
          sh:minInclusive 0 ;
          sh:maxInclusive 150
        ] ;
        sh:property [
          sh:path ex:email ;
          sh:maxCount 1 ;
          sh:pattern "^[\\\\w._%+-]+@[\\\\w.-]+\\\\.[A-Za-z]{2,}$"
        ] .
    `
    
    const shapeQuads = parser.parse(shapesData)
    shapesStore.addQuads(shapeQuads)
    console.log(`🔍 Loaded ${shapeQuads.length} shape constraint triples`)
    
    // Mock implementation of key SHACL validation functions for demo
    const SHACL = {
      NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
      targetClass: 'http://www.w3.org/ns/shacl#targetClass',
      property: 'http://www.w3.org/ns/shacl#property',
      path: 'http://www.w3.org/ns/shacl#path',
      minCount: 'http://www.w3.org/ns/shacl#minCount',
      maxCount: 'http://www.w3.org/ns/shacl#maxCount',
      datatype: 'http://www.w3.org/ns/shacl#datatype',
      minLength: 'http://www.w3.org/ns/shacl#minLength',
      pattern: 'http://www.w3.org/ns/shacl#pattern'
    }
    
    const RDF = {
      type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    }
    
    // Simple validation logic demonstration
    console.log('\n🔎 Running SHACL Validation...')
    const violations = []
    
    // Find all node shapes
    const nodeShapes = shapesStore.getQuads(
      null,
      DataFactory.namedNode(RDF.type),
      DataFactory.namedNode(SHACL.NodeShape),
      null
    )
    
    console.log(`Found ${nodeShapes.length} node shapes`)
    
    for (const shapeQuad of nodeShapes) {
      const shapeIRI = shapeQuad.subject.value
      console.log(`\n📋 Validating shape: ${shapeIRI}`)
      
      // Get target class
      const targetClassQuads = shapesStore.getQuads(
        DataFactory.namedNode(shapeIRI),
        DataFactory.namedNode(SHACL.targetClass),
        null,
        null
      )
      
      for (const targetQuad of targetClassQuads) {
        const targetClass = targetQuad.object.value
        console.log(`   Target class: ${targetClass}`)
        
        // Find instances
        const instances = dataStore.getQuads(
          null,
          DataFactory.namedNode(RDF.type),
          DataFactory.namedNode(targetClass),
          null
        )
        
        console.log(`   Found ${instances.length} instances to validate`)
        
        for (const instance of instances) {
          const instanceIRI = instance.subject.value
          console.log(`   \n   Validating instance: ${instanceIRI}`)
          
          // Get property constraints
          const properties = shapesStore.getQuads(
            DataFactory.namedNode(shapeIRI),
            DataFactory.namedNode(SHACL.property),
            null,
            null
          )
          
          for (const prop of properties) {
            const propShapeIRI = prop.object.value
            
            // Get path
            const pathQuads = shapesStore.getQuads(
              DataFactory.namedNode(propShapeIRI),
              DataFactory.namedNode(SHACL.path),
              null,
              null
            )
            
            if (pathQuads.length > 0) {
              const path = pathQuads[0].object.value
              const values = dataStore.getQuads(
                DataFactory.namedNode(instanceIRI),
                DataFactory.namedNode(path),
                null,
                null
              )
              
              console.log(`      Property ${path}: ${values.length} values`)
              
              // Check minCount
              const minCountQuads = shapesStore.getQuads(
                DataFactory.namedNode(propShapeIRI),
                DataFactory.namedNode(SHACL.minCount),
                null,
                null
              )
              
              if (minCountQuads.length > 0) {
                const minCount = parseInt(minCountQuads[0].object.value)
                if (values.length < minCount) {
                  const violation = {
                    type: 'MinCountConstraintViolation',
                    focusNode: instanceIRI,
                    path,
                    expected: minCount,
                    actual: values.length,
                    message: `Property ${path} has ${values.length} values, but minimum count is ${minCount}`
                  }
                  violations.push(violation)
                  console.log(`         ❌ MinCount violation: ${violation.message}`)
                }
              }
              
              // Check datatype for literal values
              const datatypeQuads = shapesStore.getQuads(
                DataFactory.namedNode(propShapeIRI),
                DataFactory.namedNode(SHACL.datatype),
                null,
                null
              )
              
              if (datatypeQuads.length > 0 && values.length > 0) {
                const expectedType = datatypeQuads[0].object.value
                for (const value of values) {
                  if (value.object.termType === 'Literal') {
                    const actualType = value.object.datatype?.value || 'http://www.w3.org/2001/XMLSchema#string'
                    if (actualType !== expectedType) {
                      const violation = {
                        type: 'DatatypeConstraintViolation',
                        focusNode: instanceIRI,
                        path,
                        expected: expectedType,
                        actual: actualType,
                        value: value.object.value,
                        message: `Value "${value.object.value}" has datatype ${actualType}, but expected ${expectedType}`
                      }
                      violations.push(violation)
                      console.log(`         ❌ Datatype violation: ${violation.message}`)
                    }
                  }
                }
              }
              
              // Check minLength for string values  
              const minLengthQuads = shapesStore.getQuads(
                DataFactory.namedNode(propShapeIRI),
                DataFactory.namedNode(SHACL.minLength),
                null,
                null
              )
              
              if (minLengthQuads.length > 0 && values.length > 0) {
                const minLength = parseInt(minLengthQuads[0].object.value)
                for (const value of values) {
                  if (value.object.termType === 'Literal' && value.object.value.length < minLength) {
                    const violation = {
                      type: 'MinLengthConstraintViolation',
                      focusNode: instanceIRI,
                      path,
                      expected: minLength,
                      actual: value.object.value.length,
                      value: value.object.value,
                      message: `String "${value.object.value}" has length ${value.object.value.length}, but minimum length is ${minLength}`
                    }
                    violations.push(violation)
                    console.log(`         ❌ MinLength violation: ${violation.message}`)
                  }
                }
              }
              
              // Check pattern for string values
              const patternQuads = shapesStore.getQuads(
                DataFactory.namedNode(propShapeIRI),
                DataFactory.namedNode(SHACL.pattern),
                null,
                null
              )
              
              if (patternQuads.length > 0 && values.length > 0) {
                const pattern = patternQuads[0].object.value
                const regex = new RegExp(pattern)
                for (const value of values) {
                  if (value.object.termType === 'Literal' && !regex.test(value.object.value)) {
                    const violation = {
                      type: 'PatternConstraintViolation',
                      focusNode: instanceIRI,
                      path,
                      pattern,
                      value: value.object.value,
                      message: `String "${value.object.value}" does not match pattern ${pattern}`
                    }
                    violations.push(violation)
                    console.log(`         ❌ Pattern violation: ${violation.message}`)
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log('\n📈 Validation Results')
    console.log('====================')
    console.log(`Conforms: ${violations.length === 0}`)
    console.log(`Total violations: ${violations.length}`)
    
    if (violations.length > 0) {
      console.log('\n🚨 Violations Summary:')
      const violationTypes = {}
      violations.forEach(v => {
        violationTypes[v.type] = (violationTypes[v.type] || 0) + 1
      })
      
      Object.entries(violationTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`)
      })
      
      console.log('\n📝 Detailed Violations:')
      violations.forEach((violation, index) => {
        console.log(`\n   ${index + 1}. ${violation.type}`)
        console.log(`      Focus Node: ${violation.focusNode}`)
        console.log(`      Property: ${violation.path || 'N/A'}`)
        console.log(`      Message: ${violation.message}`)
        if (violation.value !== undefined) {
          console.log(`      Value: "${violation.value}"`)
        }
      })
    }
    
    console.log('\n🎉 SHACL validation demonstration completed successfully!')
    console.log('\n✨ Key Features Demonstrated:')
    console.log('   • Cardinality constraints (minCount)')
    console.log('   • Datatype validation')
    console.log('   • String length constraints (minLength)')
    console.log('   • Pattern matching (regex)')
    console.log('   • Detailed violation reporting')
    console.log('   • Multiple constraint types per property')
    
    return violations.length === 0
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    console.error(error.stack)
    return false
  }
}

// Run the demonstration
demonstrateShaclValidation().then(success => {
  console.log(success ? '\n🎯 Validation passed!' : '\n⚠️  Validation found violations (as expected)')
  process.exit(0)
}).catch(error => {
  console.error('💥 Demo crashed:', error)
  process.exit(1)
})