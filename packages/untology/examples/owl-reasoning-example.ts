/**
 * Example: OWL Reasoning in Practice
 * Demonstrates real-world semantic inference capabilities
 */
import { 
  addTriple
} from '../src/core'
import { 
  setOntologyContext 
} from '../src/context'
import { 
  queryTriples 
} from '../src/query'
import { 
  inferOwl, 
  inferClassHierarchy,
  explainInference 
} from '../src/advanced'
import { Store } from 'n3'

async function organizationalOntologyExample() {
  console.log('🏢 Organizational Ontology with OWL Reasoning\n')
  
  // Set up the ontology
  const store = new Store()
  const prefixes = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    org: 'http://example.org/organization#',
    person: 'http://example.org/person#'
  }
  
  setOntologyContext({
    store,
    prefixes,
    defaultFormat: 'turtle'
  })
  
  // Define the organizational hierarchy
  console.log('📊 Building Organizational Structure...')
  
  // Classes
  await addTriple('org:Person', 'rdf:type', 'rdfs:Class')
  await addTriple('org:Employee', 'rdf:type', 'rdfs:Class')
  await addTriple('org:Manager', 'rdf:type', 'rdfs:Class')
  await addTriple('org:Director', 'rdf:type', 'rdfs:Class')
  await addTriple('org:CEO', 'rdf:type', 'rdfs:Class')
  
  // Class hierarchy
  await addTriple('org:Employee', 'rdfs:subClassOf', 'org:Person')
  await addTriple('org:Manager', 'rdfs:subClassOf', 'org:Employee')
  await addTriple('org:Director', 'rdfs:subClassOf', 'org:Manager')
  await addTriple('org:CEO', 'rdfs:subClassOf', 'org:Director')
  
  // Properties
  await addTriple('org:reportsTo', 'rdf:type', 'rdf:Property')
  await addTriple('org:manages', 'rdf:type', 'rdf:Property')
  await addTriple('org:worksFor', 'rdf:type', 'rdf:Property')
  
  // Property hierarchy and characteristics
  await addTriple('org:reportsTo', 'rdfs:subPropertyOf', 'org:worksFor')
  await addTriple('org:manages', 'owl:inverseOf', 'org:reportsTo')
  await addTriple('org:worksFor', 'rdf:type', 'owl:TransitiveProperty')
  
  // Property domains and ranges
  await addTriple('org:reportsTo', 'rdfs:domain', 'org:Employee')
  await addTriple('org:reportsTo', 'rdfs:range', 'org:Manager')
  await addTriple('org:manages', 'rdfs:domain', 'org:Manager')
  await addTriple('org:manages', 'rdfs:range', 'org:Employee')
  
  // Individuals
  console.log('👥 Adding People...')
  await addTriple('person:Alice', 'rdf:type', 'org:CEO')
  await addTriple('person:Bob', 'rdf:type', 'org:Director')
  await addTriple('person:Carol', 'rdf:type', 'org:Manager')
  await addTriple('person:Dave', 'rdf:type', 'org:Employee')
  await addTriple('person:Eve', 'rdf:type', 'org:Employee')
  
  // Relationships
  await addTriple('person:Bob', 'org:reportsTo', 'person:Alice')
  await addTriple('person:Carol', 'org:reportsTo', 'person:Bob')
  await addTriple('person:Dave', 'org:reportsTo', 'person:Carol')
  await addTriple('person:Eve', 'org:reportsTo', 'person:Carol')
  
  console.log(`📈 Initial facts: ${store.size} triples`)
  
  // Run OWL reasoning
  console.log('\n🧠 Running OWL Reasoning...')
  const inferences = await inferOwl()
  
  console.log(`✨ Inference complete! Added ${inferences.length} new triples`)
  console.log(`📈 Total knowledge: ${store.size} triples`)
  
  // Query the results
  console.log('\n🔍 Querying Inferred Knowledge...')
  
  // Who are all the people? (should include type inheritance)
  const allPeople = await queryTriples('?person', 'rdf:type', 'org:Person')
  console.log('\n👥 All People (inferred via class hierarchy):')
  allPeople.forEach(person => console.log(`   - ${person}`))
  
  // Who works for Alice? (should include transitive relationships)
  const worksForAlice = await queryTriples('?employee', 'org:worksFor', 'person:Alice')
  console.log('\n🏢 Everyone who works for Alice (direct + transitive):')
  worksForAlice.forEach(employee => console.log(`   - ${employee}`))
  
  // Who does Alice manage? (should include inverse relationships)
  const aliceManages = await queryTriples('person:Alice', 'org:manages', '?employee')
  console.log('\n👩‍💼 Who Alice manages (via inverse properties):')
  aliceManages.forEach(employee => console.log(`   - ${employee}`))
  
  // Explain some inferences
  console.log('\n💭 Inference Explanations:')
  
  try {
    const explanation1 = await explainInference('person:Dave', 'rdf:type', 'org:Person')
    console.log('\n🤔 Why is Dave a Person?')
    explanation1.forEach(exp => console.log(`   - ${exp}`))
  } catch (error) {
    console.log('   - Could not explain this inference')
  }
  
  try {
    const explanation2 = await explainInference('person:Alice', 'org:manages', 'person:Bob')
    console.log('\n🤔 Why does Alice manage Bob?')
    explanation2.forEach(exp => console.log(`   - ${exp}`))
  } catch (error) {
    console.log('   - Could not explain this inference')
  }
  
  console.log('\n🎉 Organizational Ontology Example Complete!')
}

async function scientificClassificationExample() {
  console.log('\n🔬 Scientific Classification with OWL Reasoning\n')
  
  // Set up biological taxonomy ontology
  const store = new Store()
  const prefixes = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    bio: 'http://example.org/biology#',
    species: 'http://example.org/species#'
  }
  
  setOntologyContext({
    store,
    prefixes,
    defaultFormat: 'turtle'
  })
  
  console.log('🧬 Building Biological Taxonomy...')
  
  // Taxonomic hierarchy
  await addTriple('bio:LivingThing', 'rdf:type', 'rdfs:Class')
  await addTriple('bio:Animal', 'rdf:type', 'rdfs:Class')
  await addTriple('bio:Vertebrate', 'rdf:type', 'rdfs:Class')
  await addTriple('bio:Mammal', 'rdf:type', 'rdfs:Class')
  await addTriple('bio:Carnivore', 'rdf:type', 'rdfs:Class')
  await addTriple('bio:Feline', 'rdf:type', 'rdfs:Class')
  
  // Class hierarchy
  await addTriple('bio:Animal', 'rdfs:subClassOf', 'bio:LivingThing')
  await addTriple('bio:Vertebrate', 'rdfs:subClassOf', 'bio:Animal')
  await addTriple('bio:Mammal', 'rdfs:subClassOf', 'bio:Vertebrate')
  await addTriple('bio:Carnivore', 'rdfs:subClassOf', 'bio:Mammal')
  await addTriple('bio:Feline', 'rdfs:subClassOf', 'bio:Carnivore')
  
  // Specific species
  await addTriple('species:Lion', 'rdf:type', 'bio:Feline')
  await addTriple('species:Tiger', 'rdf:type', 'bio:Feline')
  await addTriple('species:HouseCat', 'rdf:type', 'bio:Feline')
  
  // Biological properties
  await addTriple('bio:livesIn', 'rdf:type', 'rdf:Property')
  await addTriple('bio:eats', 'rdf:type', 'rdf:Property')
  await addTriple('bio:preyOf', 'rdf:type', 'rdf:Property')
  
  // Property characteristics
  await addTriple('bio:eats', 'owl:inverseOf', 'bio:preyOf')
  
  // Facts about species
  await addTriple('species:Lion', 'bio:livesIn', 'bio:Savanna')
  await addTriple('species:Tiger', 'bio:livesIn', 'bio:Forest')
  await addTriple('species:Lion', 'bio:eats', 'species:Gazelle')
  
  console.log(`📊 Initial biological facts: ${store.size} triples`)
  
  // Run reasoning
  console.log('\n🧠 Running Biological Classification Reasoning...')
  const biologicalInferences = await inferClassHierarchy()
  
  console.log(`🔬 Biological inferences: ${biologicalInferences.length} new triples`)
  console.log(`📈 Total biological knowledge: ${store.size} triples`)
  
  // Query results
  console.log('\n🔍 Biological Classification Results:')
  
  const allAnimals = await queryTriples('?species', 'rdf:type', 'bio:Animal')
  console.log('\n🐾 All Animals (via classification):')
  allAnimals.forEach(animal => console.log(`   - ${animal}`))
  
  const allLivingThings = await queryTriples('?organism', 'rdf:type', 'bio:LivingThing')
  console.log('\n🌱 All Living Things (via taxonomy):')
  allLivingThings.forEach(organism => console.log(`   - ${organism}`))
  
  console.log('\n🎯 Scientific Classification Example Complete!')
}

// Main execution
async function main() {
  await organizationalOntologyExample()
  await scientificClassificationExample()
}

// Export for use in other files
export { 
  organizationalOntologyExample, 
  scientificClassificationExample 
}

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}