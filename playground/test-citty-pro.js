#!/usr/bin/env node

import { generateProCommand } from '../dist/index.mjs';

// Test the generate-pro command directly
async function testGeneratePro() {
  console.log('Testing citty-pro generate command...\n');
  
  try {
    await generateProCommand.run({
      args: {
        prompt: "Create a CLI tool for managing TODO tasks with add, list, and remove commands",
        model: "qwen2.5-coder:3b",
        output: "./test-todo-cli",
        name: "todo-cli",
        author: "Test Author",
        license: "MIT",
        packageManager: "npm",
        template: "typescript-cli",
        temperature: 0.7,
        includeOpenTelemetry: true,
        includeTests: true,
        includeDocs: true,
        overwrite: true,
        verbose: true,
        dryRun: true
      }
    });
    
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGeneratePro();