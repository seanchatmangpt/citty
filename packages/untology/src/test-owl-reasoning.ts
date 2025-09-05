/**
 * Test script to verify OWL reasoning functionality
 */
import { 
  inferOwl, 
  inferClassHierarchy, 
  inferPropertyHierarchy,
  inferInverseProperties,
  inferEquivalences,
  inferTransitiveProperties,
  inferSymmetricProperties
} from './advanced'
import { explainInference } from './inference'
import { addTriple } from './core'
import { setOntologyContext } from './context'
import { Store } from 'n3'

async function testOwlReasoning() {
  console.log('🧠 Testing OWL Reasoning Implementation...\n')
  
  // Create test ontology
  const store = new Store()
  const prefixes = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    ex: 'http://example.org/'
  }
  
  setOntologyContext({
    store,
    prefixes,
    defaultFormat: 'turtle'
  })
  
  // Test 1: Class Hierarchy Reasoning
  console.log('📊 Test 1: Class Hierarchy Reasoning')
  await addTriple('ex:Animal', 'rdf:type', 'rdfs:Class')
  await addTriple('ex:Mammal', 'rdf:type', 'rdfs:Class')
  await addTriple('ex:Dog', 'rdf:type', 'rdfs:Class')
  await addTriple('ex:Mammal', 'rdfs:subClassOf', 'ex:Animal')
  await addTriple('ex:Dog', 'rdfs:subClassOf', 'ex:Mammal')
  await addTriple('ex:Buddy', 'rdf:type', 'ex:Dog')
  
  const classInferences = await inferClassHierarchy()
  console.log(`✅ Inferred ${classInferences.length} class hierarchy triples`)
  
  // Test 2: Property Reasoning
  console.log('\n🔗 Test 2: Property Reasoning')
  await addTriple('ex:hasParent', 'rdf:type', 'rdf:Property')
  await addTriple('ex:hasMother', 'rdf:type', 'rdf:Property')
  await addTriple('ex:hasMother', 'rdfs:subPropertyOf', 'ex:hasParent')
  await addTriple('ex:hasParent', 'rdfs:domain', 'ex:Animal')
  await addTriple('ex:hasParent', 'rdfs:range', 'ex:Animal')
  await addTriple('ex:Buddy', 'ex:hasMother', 'ex:Bella')
  
  const propertyInferences = await inferPropertyHierarchy()
  console.log(`✅ Inferred ${propertyInferences.length} property reasoning triples`)
  
  // Test 3: Inverse Properties
  console.log('\n🔄 Test 3: Inverse Properties')
  await addTriple('ex:hasChild', 'rdf:type', 'rdf:Property')
  await addTriple('ex:hasParent', 'owl:inverseOf', 'ex:hasChild')
  
  const inverseInferences = await inferInverseProperties()
  console.log(`✅ Inferred ${inverseInferences.length} inverse property triples`)
  
  // Test 4: Equivalence Reasoning
  console.log('\n🟰 Test 4: Equivalence Reasoning')
  await addTriple('ex:Canine', 'rdf:type', 'rdfs:Class')
  await addTriple('ex:Dog', 'owl:equivalentClass', 'ex:Canine')
  await addTriple('ex:Rex', 'rdf:type', 'ex:Canine')
  
  const equivalenceInferences = await inferEquivalences()
  console.log(`✅ Inferred ${equivalenceInferences.length} equivalence triples`)
  
  // Test 5: Transitive Properties
  console.log('\n➡️ Test 5: Transitive Properties')
  await addTriple('ex:ancestorOf', 'rdf:type', 'owl:TransitiveProperty')
  await addTriple('ex:GrandpaBob', 'ex:ancestorOf', 'ex:DadJoe')
  await addTriple('ex:DadJoe', 'ex:ancestorOf', 'ex:Buddy')
  
  const transitiveInferences = await inferTransitiveProperties()
  console.log(`✅ Inferred ${transitiveInferences.length} transitive property triples`)
  
  // Test 6: Symmetric Properties
  console.log('\n🔄 Test 6: Symmetric Properties')
  await addTriple('ex:siblingOf', 'rdf:type', 'owl:SymmetricProperty')
  await addTriple('ex:Buddy', 'ex:siblingOf', 'ex:Max')
  
  const symmetricInferences = await inferSymmetricProperties()
  console.log(`✅ Inferred ${symmetricInferences.length} symmetric property triples`)
  
  // Test 7: Full OWL Reasoning
  console.log('\n🚀 Test 7: Full OWL Reasoning')
  const allInferences = await inferOwl()
  console.log(`✅ Total inferences: ${allInferences.length} triples`)
  
  // Test 8: Full Inference Statistics
  console.log('\n⚙️ Test 8: Inference Engine Statistics')
  const { inferenceEngine } = await import('./inference')
  const stats = inferenceEngine.getStats()
  console.log(`✅ Engine statistics:`)
  console.log(`   Available rules: ${stats.rules}`)
  console.log(`   Inferences made: ${stats.inferred}`)
  console.log(`   Rule types: ${stats.ruleNames.slice(0, 5).join(', ')}...`)
  
  // Test 9: Explanation
  console.log('\n💭 Test 9: Inference Explanation')
  try {
    const explanations = await explainInference('ex:Buddy', 'rdf:type', 'ex:Animal')
    console.log(`✅ Explanations for "Buddy is an Animal":`)
    explanations.forEach(exp => console.log(`   - ${exp}`))
  } catch (error) {
    console.log('   - Could not explain this inference')
  }
  
  console.log('\n🎉 OWL Reasoning Tests Complete!')
  console.log(`📈 Final store size: ${store.size} triples`)
}

// Export for testing
export { testOwlReasoning }

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  testOwlReasoning().catch(console.error)
}