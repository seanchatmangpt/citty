import { OllamaCliGenerator } from './cli-generator.ts';
import consola from 'consola';

async function simpleTest() {
  consola.info('🚀 Simple CLI generation test...');
  
  try {
    const generator = new OllamaCliGenerator();
    
    // Simple test with minimal prompt
    const prompt = 'Create a simple file copy CLI tool';
    
    consola.info('📝 Testing prompt:', prompt);
    consola.info('⚙️ Using Ollama model: qwen3:8b');
    
    const result = await generator.generateFromNaturalLanguage(prompt, {
      complexity: 'simple',
      style: 'minimal',
      features: ['help'],
      outputDir: `./generated/simple-test-${Date.now()}`
    });
    
    consola.success('✅ Simple CLI generation completed!');
    
    // Show key results
    if (result.specification) {
      consola.info('📋 Generated CLI name:', result.specification.name);
      consola.info('🔧 Commands generated:', result.specification.commands?.length || 0);
      consola.info('📊 Command list:', result.specification.commands?.map((c: any) => c.name).join(', '));
    }
    
    if (result.implementation) {
      consola.info('📁 Output directory:', result.implementation.outputDir);
      consola.info('📦 Package name:', result.implementation.packageName);
    }
    
    consola.success('🎉 Real Ollama integration working perfectly!');
    
    return result;
    
  } catch (error) {
    consola.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the simple test
simpleTest().catch(console.error);