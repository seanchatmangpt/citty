/**
 * Production Example: Generate CLI commands from ontology
 */
import { loadGraph, findEntities, getValue, getValues, toContextObjects } from '../src'

// Load a production CLI ontology
await loadGraph(`
  @prefix citty: <https://citty.pro/ontology#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  
  # Commands
  :deploy a citty:Command ;
    citty:name "deploy" ;
    citty:description "Deploy application to environment" ;
    citty:argument [
      citty:name "env" ;
      citty:type "enum" ;
      citty:required true ;
      citty:options ("dev" "staging" "prod")
    ] ;
    citty:argument [
      citty:name "version" ;
      citty:type "string" ;
      citty:required false
    ] .
  
  :migrate a citty:Command ;
    citty:name "migrate" ;
    citty:description "Run database migrations" ;
    citty:argument [
      citty:name "direction" ;
      citty:type "enum" ;
      citty:options ("up" "down")
    ] .
  
  # Workflow
  :cicd a citty:Workflow ;
    citty:name "ci-cd" ;
    citty:steps (
      [ citty:uses :test ]
      [ citty:uses :build ]
      [ citty:uses :deploy ]
    ) .
`)

// Find all commands
const commands = findEntities('citty:Command')
console.log('Found commands:', commands)

// Generate command files
for (const cmdId of commands) {
  const name = getValue(cmdId, 'citty:name')
  const description = getValue(cmdId, 'citty:description')
  const args = getValues(cmdId, 'citty:argument')
  
  console.log(`
// Generated command: ${name}
import { defineCommand } from 'citty'

export const ${name}Command = defineCommand({
  meta: {
    name: '${name}',
    description: '${description}'
  },
  args: {
    // TODO: Parse argument definitions
  },
  run: async ({ args }) => {
    console.log('Running ${name}', args)
  }
})
  `)
}

// Export for template engine
const contexts = toContextObjects('citty:Command')
console.log('\nContext objects for templates:')
console.log(JSON.stringify(contexts, null, 2))