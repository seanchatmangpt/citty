/**
 * Template Testing Utilities
 * Comprehensive testing framework for validating templates and CLI functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'pathe';
import { defineCommand } from 'citty';

export interface TestContext {
  tempDir: string;
  cleanup: () => Promise<void>;
}

export interface CLITestResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface TemplateTestOptions {
  timeout?: number;
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Create a temporary test environment
 */
export async function createTestContext(): Promise<TestContext> {
  const tempDir = await mkdtemp(join(tmpdir(), 'citty-test-'));
  
  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Execute a CLI command and capture output
 */
export async function runCLI(
  command: string,
  args: string[] = [],
  options: TemplateTestOptions = {}
): Promise<CLITestResult> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (exitCode) => {
      const duration = Date.now() - startTime;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0,
        duration
      });
    });
    
    child.on('error', reject);
    
    // Timeout handling
    if (options.timeout) {
      setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }
  });
}

/**
 * Test template generation and validation
 */
export class TemplateTestSuite {
  private context: TestContext | null = null;
  
  async setup() {
    this.context = await createTestContext();
  }
  
  async teardown() {
    if (this.context) {
      await this.context.cleanup();
      this.context = null;
    }
  }
  
  /**
   * Test that a template generates correctly
   */
  async testTemplateGeneration(
    templateId: string,
    variables: Record<string, any>,
    expectedFiles: string[]
  ) {
    if (!this.context) throw new Error('Test context not initialized');
    
    // Generate template
    const result = await runCLI('citty', [
      'init',
      templateId,
      '--output',
      this.context.tempDir,
      '--variables',
      JSON.stringify(variables)
    ]);
    
    expect(result.exitCode).toBe(0);
    
    // Verify expected files exist
    for (const file of expectedFiles) {
      const filePath = join(this.context.tempDir, file);
      try {
        await readFile(filePath);
      } catch {
        throw new Error(`Expected file not found: ${file}`);
      }
    }
    
    return this.context.tempDir;
  }
  
  /**
   * Test that generated CLI works correctly
   */
  async testGeneratedCLI(
    projectDir: string,
    testCases: Array<{
      args: string[];
      expectedOutput?: string;
      expectedExitCode?: number;
    }>
  ) {
    // Build the project first
    await runCLI('npm', ['run', 'build'], { cwd: projectDir });
    
    for (const testCase of testCases) {
      const result = await runCLI('node', ['dist/main.mjs', ...testCase.args], {
        cwd: projectDir
      });
      
      if (testCase.expectedExitCode !== undefined) {
        expect(result.exitCode).toBe(testCase.expectedExitCode);
      }
      
      if (testCase.expectedOutput) {
        expect(result.stdout).toContain(testCase.expectedOutput);
      }
    }
  }
  
  /**
   * Test template variable substitution
   */
  async testVariableSubstitution(
    templateContent: string,
    variables: Record<string, any>,
    expectedContent: string
  ) {
    if (!this.context) throw new Error('Test context not initialized');
    
    // Write template file
    const templatePath = join(this.context.tempDir, 'template.txt');
    await writeFile(templatePath, templateContent);
    
    // Process template (simplified - in real implementation use actual template engine)
    let processed = templateContent;
    for (const [key, value] of Object.entries(variables)) {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    
    expect(processed).toBe(expectedContent);
  }
}

/**
 * CLI Command Tester
 */
export class CommandTester {
  private command: any;
  
  constructor(command: any) {
    this.command = command;
  }
  
  /**
   * Test command with specific arguments
   */
  async testRun(args: Record<string, any>, expectedOutput?: RegExp | string) {
    let output = '';
    const originalLog = console.log;
    
    // Capture console output
    console.log = (...messages) => {
      output += messages.join(' ') + '\n';
    };
    
    try {
      await this.command.run({ args });
      
      if (expectedOutput) {
        if (expectedOutput instanceof RegExp) {
          expect(output).toMatch(expectedOutput);
        } else {
          expect(output).toContain(expectedOutput);
        }
      }
      
      return output.trim();
    } finally {
      console.log = originalLog;
    }
  }
  
  /**
   * Test command argument parsing
   */
  testArguments(validArgs: Array<Record<string, any>>, invalidArgs: Array<Record<string, any>>) {
    // Test valid arguments
    for (const args of validArgs) {
      expect(() => {
        // Validate arguments against command definition
        this.validateArgs(args);
      }).not.toThrow();
    }
    
    // Test invalid arguments
    for (const args of invalidArgs) {
      expect(() => {
        this.validateArgs(args);
      }).toThrow();
    }
  }
  
  private validateArgs(args: Record<string, any>) {
    const commandArgs = this.command.args || {};
    
    for (const [key, config] of Object.entries(commandArgs)) {
      const value = args[key];
      
      // Check required arguments
      if (config.required && (value === undefined || value === null)) {
        throw new Error(`Required argument '${key}' is missing`);
      }
      
      // Check argument types
      if (value !== undefined) {
        if (config.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Argument '${key}' must be boolean`);
        }
        if (config.type === 'string' && typeof value !== 'string') {
          throw new Error(`Argument '${key}' must be string`);
        }
      }
    }
  }
}

/**
 * Integration Test Runner
 */
export class IntegrationTestRunner {
  private testSuite: TemplateTestSuite;
  
  constructor() {
    this.testSuite = new TemplateTestSuite();
  }
  
  /**
   * Run full integration test for a template
   */
  async runFullTemplateTest(
    templateId: string,
    testConfig: {
      variables: Record<string, any>;
      expectedFiles: string[];
      cliTests: Array<{
        args: string[];
        expectedOutput?: string;
        expectedExitCode?: number;
      }>;
    }
  ) {
    await this.testSuite.setup();
    
    try {
      // Test template generation
      const projectDir = await this.testSuite.testTemplateGeneration(
        templateId,
        testConfig.variables,
        testConfig.expectedFiles
      );
      
      // Test generated CLI
      await this.testSuite.testGeneratedCLI(projectDir, testConfig.cliTests);
      
      console.log(`✅ Integration test passed for template: ${templateId}`);
    } finally {
      await this.testSuite.teardown();
    }
  }
}

/**
 * Performance Test Utilities
 */
export class PerformanceTestSuite {
  /**
   * Benchmark CLI command execution
   */
  async benchmarkCommand(
    command: string,
    args: string[],
    iterations: number = 10
  ) {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await runCLI(command, args);
      times.push(result.duration);
    }
    
    return {
      mean: times.reduce((a, b) => a + b) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort()[Math.floor(times.length / 2)],
      iterations,
      times
    };
  }
  
  /**
   * Memory usage testing
   */
  async measureMemoryUsage(fn: () => Promise<void>): Promise<{
    heapUsed: number;
    heapTotal: number;
    external: number;
  }> {
    const before = process.memoryUsage();
    await fn();
    const after = process.memoryUsage();
    
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external
    };
  }
}

/**
 * Test Utilities for Template Validation
 */
export const templateTestUtils = {
  /**
   * Validate package.json structure
   */
  async validatePackageJson(packageJsonPath: string, expectedFields: string[]) {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    for (const field of expectedFields) {
      expect(packageJson).toHaveProperty(field);
    }
    
    // Validate common required fields
    expect(packageJson.name).toBeTruthy();
    expect(packageJson.version).toBeTruthy();
    expect(packageJson.scripts).toBeTruthy();
  },
  
  /**
   * Validate TypeScript configuration
   */
  async validateTSConfig(tsconfigPath: string) {
    const content = await readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);
    
    expect(tsconfig.compilerOptions).toBeTruthy();
    expect(tsconfig.include).toBeTruthy();
  },
  
  /**
   * Validate generated code quality
   */
  async validateCodeQuality(filePath: string) {
    const content = await readFile(filePath, 'utf-8');
    
    // Check for common issues
    expect(content).not.toContain('console.log('); // Should use proper logging
    expect(content).not.toContain('any'); // Should avoid any types
    expect(content).toMatch(/import.*from/); // Should have proper imports
  }
};

/**
 * Example test suite using the utilities
 */
export function createTemplateTestSuite(templateId: string) {
  describe(`Template: ${templateId}`, () => {
    let testSuite: TemplateTestSuite;
    
    beforeEach(async () => {
      testSuite = new TemplateTestSuite();
      await testSuite.setup();
    });
    
    afterEach(async () => {
      await testSuite.teardown();
    });
    
    it('should generate all expected files', async () => {
      const variables = { projectName: 'test-project', description: 'Test CLI' };
      const expectedFiles = ['package.json', 'src/main.ts', 'README.md'];
      
      await testSuite.testTemplateGeneration(templateId, variables, expectedFiles);
    });
    
    it('should build successfully', async () => {
      const variables = { projectName: 'test-project', description: 'Test CLI' };
      const projectDir = await testSuite.testTemplateGeneration(
        templateId,
        variables,
        ['package.json']
      );
      
      const result = await runCLI('npm', ['run', 'build'], { cwd: projectDir });
      expect(result.exitCode).toBe(0);
    });
  });
}
