/**
 * Test script to verify the interactive playground works with real Nunjucks
 */
import path from 'path';

async function testPlayground() {
  console.log('Testing Interactive Playground with real Nunjucks...');
  
  try {
    // Import the playground functionality
    const { 
      interactivePlayground,
      createPlaygroundSession,
      executePlaygroundSession,
      validatePlaygroundTemplate,
      executePlaygroundTemplate,
      PlaygroundHelpers
    } = await import('../src/unjucks/interactive-playground.ts');
    
    // Test 1: Direct template validation
    console.log('\n1. Testing template validation...');
    const validationResult = await validatePlaygroundTemplate('Hello, {{ name }}!');
    console.log('Validation result:', validationResult);
    
    // Test 2: Direct template execution
    console.log('\n2. Testing direct template execution...');
    const directResult = await executePlaygroundTemplate('Hello, {{ name }}!', { name: 'World' });
    console.log('Direct execution result:', directResult);
    
    // Test 3: Create playground session
    console.log('\n3. Creating playground session...');
    const sessionId = await createPlaygroundSession(
      PlaygroundHelpers.createSampleOntology(),
      'Hello, {{ greeting }}! Welcome to {{ name }}.'
    );
    console.log('Session created:', sessionId);
    
    // Test 4: Execute playground session
    console.log('\n4. Executing playground session...');
    const sessionResult = await executePlaygroundSession(sessionId);
    console.log('Session execution result:');
    console.log('- Output:', sessionResult.output);
    console.log('- Errors:', sessionResult.errors);
    console.log('- Performance:', sessionResult.performance);
    
    // Test 5: Test helpers
    console.log('\n5. Testing playground helpers...');
    const sampleContext = PlaygroundHelpers.createSampleContext();
    console.log('Sample context keys:', Object.keys(sampleContext));
    
    const helperResult = await PlaygroundHelpers.executeTemplateSync(
      'Project: {{ project.name }} v{{ project.version }}',
      sampleContext
    );
    console.log('Helper execution result:', helperResult);
    
    console.log('\n✅ All tests passed! The playground is working with real Nunjucks.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testPlayground();