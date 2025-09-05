/**
 * 🤖 Verify Qwen3:8b Integration
 * This script tests the real Ollama integration with qwen3:8b model
 */

import { NaturalLanguageEngine, naturalLanguageEngine, loadGraph, withOntology } from '../packages/untology/dist/index.mjs'
import { Store } from 'n3'

// Test configuration
const TEST_CONFIG = {
  ollamaURL: 'http://localhost:11434',
  testModel: 'qwen3:8b',
  fallbackModel: 'qwen3:8b'
}

/**
 * Test Ollama availability and model
 */
async function testOllamaConnection() {
  console.log('🔌 Testing Ollama Connection...')
  
  try {
    // Test with a simple request
    const response = await fetch(`${TEST_CONFIG.ollamaURL}/api/tags`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('✅ Ollama is running')
    
    // Check if qwen3:8b is available
    const models = data.models || []
    const qwenModels = models.filter(m => m.name.includes('qwen3'))
    
    if (qwenModels.length > 0) {
      console.log('✅ Qwen3 models available:', qwenModels.map(m => m.name).join(', '))
      return true
    } else {
      console.log('⚠️  Qwen3:8b not found. Available models:', models.map(m => m.name).join(', '))
      console.log('   Run: ollama pull qwen3:8b')
      return false
    }
    
  } catch (error) {
    console.log('❌ Ollama connection failed:', error.message)
    console.log('   Make sure Ollama is running: ollama serve')
    return false
  }
}

/**
 * Test real natural language engine integration
 */
async function testRealIntegration() {
  console.log('\n🧠 Testing Real Natural Language Engine...')
  
  try {
    // Create a new engine instance for testing
    const testEngine = new NaturalLanguageEngine(TEST_CONFIG.ollamaURL)
    testEngine.setDefaultModel(TEST_CONFIG.testModel)
    
    console.log('✅ Engine created with real Ollama provider')
    console.log(`✅ Default model set to: ${TEST_CONFIG.testModel}`)
    
    // Test with some sample data
    await populateTestData()
    
    // Test query generation
    console.log('\n🔍 Testing query processing...')
    
    const testQuery = "What products are available and what are their prices?"
    
    try {
      const response = await testEngine.query({
        query: testQuery,
        temperature: 0.1,
        model: TEST_CONFIG.testModel
      })
      
      console.log(`✅ Query processed successfully`)
      console.log(`   Question: "${testQuery}"`)
      console.log(`   Answer: ${response.answer.slice(0, 100)}...`)
      console.log(`   SPARQL Generated: ${response.sparqlQuery ? 'Yes' : 'No'}`)
      console.log(`   Results: ${response.results?.length || 0} items`)
      console.log(`   Confidence: ${(response.confidence * 100).toFixed(1)}%`)
      
      return true
      
    } catch (queryError) {
      console.log('❌ Query processing failed:', queryError.message)
      return false
    }
    
  } catch (error) {
    console.log('❌ Engine setup failed:', error.message)
    return false
  }
}

/**
 * Test conversational interface
 */
async function testConversationalInterface() {
  console.log('\n💬 Testing Conversational Interface...')
  
  try {
    const testEngine = new NaturalLanguageEngine(TEST_CONFIG.ollamaURL)
    testEngine.setDefaultModel(TEST_CONFIG.testModel)
    
    await populateTestData()
    
    const testMessages = [
      'Hello, can you help me understand the product data?',
      'What would you recommend for someone looking for electronics under $100?'
    ]
    
    for (const message of testMessages) {
      try {
        const response = await testEngine.chat(message, [], { 
          model: TEST_CONFIG.testModel,
          temperature: 0.7 
        })
        
        console.log(`\n   User: "${message}"`)
        console.log(`   ✅ Bot: ${response.slice(0, 100)}...`)
        
      } catch (chatError) {
        console.log(`   ❌ Chat failed: ${chatError.message}`)
        return false
      }
    }
    
    return true
    
  } catch (error) {
    console.log('❌ Conversational interface test failed:', error.message)
    return false
  }
}

/**
 * Test data explanation feature
 */
async function testDataExplanation() {
  console.log('\n📊 Testing Data Explanation...')
  
  try {
    const testEngine = new NaturalLanguageEngine(TEST_CONFIG.ollamaURL)
    testEngine.setDefaultModel(TEST_CONFIG.testModel)
    
    await populateTestData()
    
    const explanation = await testEngine.explainData()
    console.log('✅ Data explanation generated:')
    console.log(`   ${explanation.slice(0, 150)}...`)
    
    return true
    
  } catch (error) {
    console.log('❌ Data explanation failed:', error.message)
    return false
  }
}

/**
 * Test query suggestions
 */
async function testQuerySuggestions() {
  console.log('\n💡 Testing Query Suggestions...')
  
  try {
    const testEngine = new NaturalLanguageEngine(TEST_CONFIG.ollamaURL)
    testEngine.setDefaultModel(TEST_CONFIG.testModel)
    
    await populateTestData()
    
    const suggestions = await testEngine.suggestQueries(3)
    console.log('✅ Query suggestions generated:')
    suggestions.forEach((suggestion, i) => {
      console.log(`   ${i + 1}. ${suggestion}`)
    })
    
    return true
    
  } catch (error) {
    console.log('❌ Query suggestions failed:', error.message)
    return false
  }
}

/**
 * Populate test RDF data for testing
 */
async function populateTestData() {
  // Load real RDF data into the ontology context
  const mockData = `
@prefix : <http://example.com/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:Product1 rdf:type :Product ;
    :hasName "Gaming Laptop Pro" ;
    :hasPrice "999"^^xsd:decimal ;
    :inCategory :Electronics ;
    :hasDescription "High-performance gaming laptop with RTX graphics" .

:Product2 rdf:type :Product ;
    :hasName "Wireless Gaming Mouse" ;
    :hasPrice "29"^^xsd:decimal ;
    :inCategory :Electronics ;
    :hasDescription "Ergonomic wireless mouse with RGB lighting" .

:Product3 rdf:type :Product ;
    :hasName "Smart Coffee Maker" ;
    :hasPrice "79"^^xsd:decimal ;
    :inCategory :Kitchen ;
    :hasDescription "WiFi-enabled coffee maker with app control" .

:Product4 rdf:type :Product ;
    :hasName "Running Shoes" ;
    :hasPrice "120"^^xsd:decimal ;
    :inCategory :Sports ;
    :hasDescription "Professional running shoes with advanced cushioning" .
`
  
  // Load the test data into the ontology context
  await loadGraph(mockData, 'turtle')
  
  console.log('📝 Test data populated in context')
}

/**
 * Performance test
 */
async function testPerformance() {
  console.log('\n⚡ Testing Performance...')
  
  try {
    const testEngine = new NaturalLanguageEngine(TEST_CONFIG.ollamaURL)
    testEngine.setDefaultModel(TEST_CONFIG.testModel)
    
    await populateTestData()
    
    const startTime = Date.now()
    
    await testEngine.query({
      query: "How many products cost less than $100?",
      temperature: 0.1
    })
    
    const duration = Date.now() - startTime
    
    console.log(`✅ Query completed in ${duration}ms`)
    
    if (duration < 10000) {
      console.log('✅ Performance acceptable (< 10s)')
    } else {
      console.log('⚠️  Performance could be improved (> 10s)')
    }
    
    return true
    
  } catch (error) {
    console.log('❌ Performance test failed:', error.message)
    return false
  }
}

/**
 * Show setup instructions
 */
function showSetupInstructions() {
  console.log('\n🚀 SETUP INSTRUCTIONS')
  console.log('=====================')
  console.log()
  console.log('1. Install Ollama:')
  console.log('   • macOS/Linux: curl -fsSL https://ollama.ai/install.sh | sh')
  console.log('   • Windows: Download from https://ollama.ai')
  console.log()
  console.log('2. Start Ollama service:')
  console.log('   ollama serve')
  console.log()
  console.log('3. Pull Qwen3:8b model:')
  console.log('   ollama pull qwen3:8b')
  console.log()
  console.log('4. Build the untology package:')
  console.log('   cd packages/untology && pnpm build')
  console.log()
  console.log('5. Run this verification script:')
  console.log('   node examples/verify-qwen-integration.js')
}

/**
 * Main verification function
 */
async function verifyRealQwenIntegration() {
  console.log('🤖 REAL QWEN3:8B INTEGRATION VERIFICATION')
  console.log('==========================================')
  console.log()
  
  const results = {
    connection: false,
    integration: false,
    conversation: false,
    explanation: false,
    suggestions: false,
    performance: false
  }
  
  try {
    // Step 1: Test Ollama connection
    results.connection = await testOllamaConnection()
    
    if (!results.connection) {
      console.log('\n❌ Ollama not available - showing setup instructions')
      showSetupInstructions()
      return false
    }
    
    // Step 2: Test basic integration
    results.integration = await testRealIntegration()
    
    // Step 3: Test conversational interface
    results.conversation = await testConversationalInterface()
    
    // Step 4: Test data explanation
    results.explanation = await testDataExplanation()
    
    // Step 5: Test query suggestions
    results.suggestions = await testQuerySuggestions()
    
    // Step 6: Test performance
    results.performance = await testPerformance()
    
    // Final report
    console.log('\n📊 VERIFICATION RESULTS')
    console.log('========================')
    console.log(`✅ Ollama Connection: ${results.connection ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Basic Integration: ${results.integration ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Conversational Interface: ${results.conversation ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Data Explanation: ${results.explanation ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Query Suggestions: ${results.suggestions ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Performance: ${results.performance ? 'PASS' : 'FAIL'}`)
    
    const passCount = Object.values(results).filter(Boolean).length
    const totalCount = Object.keys(results).length
    
    console.log(`\n🎯 OVERALL: ${passCount}/${totalCount} tests passed`)
    
    if (passCount === totalCount) {
      console.log('\n🎉 ALL TESTS PASSED!')
      console.log('✅ Real Ollama integration is working correctly')
      console.log('✅ Qwen3:8b model is responding')
      console.log('✅ Natural language processing is functional')
      console.log('✅ Ready for production use')
    } else {
      console.log('\n⚠️  SOME TESTS FAILED')
      console.log('Check the error messages above for details')
    }
    
    return passCount === totalCount
    
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error.message)
    console.error('Stack trace:', error.stack)
    return false
  }
}

// Run verification
verifyRealQwenIntegration()
  .then(success => {
    console.log(success ? '\n✅ Verification completed successfully!' : '\n❌ Verification failed!')
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('\nUnexpected error:', error)
    process.exit(1)
  })