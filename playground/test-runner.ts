import { OllamaCliGenerator, CliGenerationEngine } from './cli-generator.ts';
import consola from 'consola';

async function testDockerScenario() {
  consola.info('🚀 Testing Docker CLI generation scenario...');
  
  try {
    const generator = new OllamaCliGenerator();
    
    const scenario = {
      name: 'Docker CLI Test',
      prompt: 'Create a comprehensive Docker management CLI with container lifecycle management, network configuration, and volume handling',
      expectedCommands: ['run', 'stop', 'build', 'push', 'pull', 'network', 'volume']
    };
    
    consola.info('📝 Prompt:', scenario.prompt);
    consola.info('⚙️ Using Ollama model: qwen3:8b');
    
    const result = await generator.generateFromNaturalLanguage(scenario.prompt, {
      complexity: 'medium',
      style: 'modern',
      features: ['help', 'version', 'verbose'],
      outputDir: `./generated/docker-cli-${Date.now()}`
    });
    
    consola.success('✅ CLI generation completed!');
    console.log('Generated CLI specification:', JSON.stringify(result.specification, null, 2));
    
    return result;
    
  } catch (error) {
    consola.error('❌ CLI generation failed:', error);
    throw error;
  }
}

// Run the test
testDockerScenario().catch(console.error);