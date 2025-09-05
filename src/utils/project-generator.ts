import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CommandGeneration } from "../ontology-to-zod.js";
import { weaverForge, type TemplateContext } from "./templates.js";

export interface ProjectGenerationOptions {
  name: string;
  description: string;
  outputDir: string;
  author?: string;
  license?: string;
  repository?: string;
  includeOpenTelemetry?: boolean;
  includeTests?: boolean;
  includeDocs?: boolean;
  packageManager?: "npm" | "pnpm" | "yarn";
  template?: string;
  commands?: CommandGeneration[];
}

/**
 * Professional project generator that creates complete CLI packages
 */
export class ProjectGenerator {
  private options: ProjectGenerationOptions;

  constructor(options: ProjectGenerationOptions) {
    this.options = {
      includeOpenTelemetry: true,
      includeTests: true,
      includeDocs: true,
      packageManager: "npm",
      template: "typescript-cli",
      ...options,
    };
  }

  /**
   * Generate complete CLI project
   */
  async generateProject(): Promise<void> {
    console.log(`🚀 Generating CLI project: ${this.options.name}`);

    // 1. Create project structure
    await this.createProjectStructure();

    // 2. Generate package files
    await this.generatePackageFiles();

    // 3. Generate command files
    if (this.options.commands && this.options.commands.length > 0) {
      await this.generateCommandFiles();
    }

    // 4. Generate tests
    if (this.options.includeTests) {
      await this.generateTestFiles();
    }

    // 5. Initialize package manager
    await this.initializePackageManager();

    // 6. Run initial build and tests
    await this.runInitialValidation();

    console.log(`✅ Project generated successfully in ${this.options.outputDir}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${this.options.outputDir}`);
    console.log(`  ${this.options.packageManager} run dev`);
  }

  /**
   * Create project directory structure
   */
  private async createProjectStructure(): Promise<void> {
    const outputDir = resolve(this.options.outputDir);
    
    // Create main directories
    const directories = [
      outputDir,
      join(outputDir, "src"),
      join(outputDir, "src/commands"),
      join(outputDir, "src/utils"),
      join(outputDir, "bin"),
    ];

    if (this.options.includeTests) {
      directories.push(join(outputDir, "test"));
    }

    if (this.options.includeDocs) {
      directories.push(join(outputDir, "docs"));
    }

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Generate package files using Weaver Forge templates
   */
  private async generatePackageFiles(): Promise<void> {
    try {
      const context: TemplateContext = {
        name: this.options.name,
        description: this.options.description,
        version: "1.0.0",
        author: this.options.author,
        license: this.options.license || "MIT",
        repository: this.options.repository,
        commands: this.options.commands?.map(cmd => ({
          name: cmd.name,
          description: cmd.description,
          args: cmd.args || [],
        })) || [],
        dependencies: this.generateDependencies(),
        devDependencies: this.generateDevDependencies(),
        scripts: this.generateScripts(),
        includeOpenTelemetry: this.options.includeOpenTelemetry,
        includeTests: this.options.includeTests,
        includeDocs: this.options.includeDocs,
      };

      // Validate template exists
      if (!this.options.template) {
        throw new Error('Template not specified');
      }

      // Use Weaver Forge to generate project
      weaverForge.generateProject(
        this.options.template,
        this.options.outputDir,
        context
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate package files: ${errorMessage}`);
    }
  }

  /**
   * Get package manager command with proper formatting
   */
  private getPackageManagerCommand(script: string): string {
    switch (this.options.packageManager) {
      case "yarn":
        return `yarn ${script}`;
      case "pnpm":
        return `pnpm run ${script}`;
      case "npm":
      default:
        return `npm run ${script}`;
    }
  }

  /**
   * Generate individual command files
   */
  private async generateCommandFiles(): Promise<void> {
    if (!this.options.commands || this.options.commands.length === 0) {
      return;
    }

    const commandsDir = join(this.options.outputDir, "src/commands");

    for (const command of this.options.commands) {
      const commandFile = join(commandsDir, `${command.name}.ts`);
      const commandContent = this.generateCommandFile(command);
      writeFileSync(commandFile, commandContent, "utf8");
    }
  }

  /**
   * Generate test files
   */
  private async generateTestFiles(): Promise<void> {
    if (!this.options.includeTests || !this.options.commands) {
      return;
    }

    const testDir = join(this.options.outputDir, "test");

    // Generate main test file
    const mainTestContent = this.generateMainTestFile();
    writeFileSync(join(testDir, "cli.test.ts"), mainTestContent, "utf8");

    // Generate command-specific tests
    for (const command of this.options.commands) {
      const testContent = this.generateCommandTestFile(command);
      writeFileSync(join(testDir, `${command.name}.test.ts`), testContent, "utf8");
    }
  }

  /**
   * Initialize package manager and install dependencies
   */
  private async initializePackageManager(): Promise<void> {
    const cwd = resolve(this.options.outputDir);
    
    try {
      console.log(`📦 Installing dependencies with ${this.options.packageManager}...`);
      
      // Validate package manager and construct command
      let installCmd: string;
      switch (this.options.packageManager) {
        case "yarn":
          installCmd = "yarn install";
          break;
        case "pnpm":
          installCmd = "pnpm install";
          break;
        case "npm":
        default:
          installCmd = "npm install";
          break;
      }
      
      // Ensure package.json exists before installing
      const packageJsonPath = join(cwd, 'package.json');
      if (!existsSync(packageJsonPath)) {
        throw new Error('package.json not found, cannot install dependencies');
      }
      
      await this.execCommand(installCmd, { cwd });
      console.log("✅ Dependencies installed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn("⚠️  Failed to install dependencies automatically:", errorMessage);
      console.log(`Please run manually:`);
      console.log(`  cd ${cwd}`);
      console.log(`  ${this.options.packageManager} install`);
    }
  }

  /**
   * Run initial build and test validation
   */
  private async runInitialValidation(): Promise<void> {
    const cwd = resolve(this.options.outputDir);
    
    try {
      // Construct package manager commands
      const buildCmd = this.getPackageManagerCommand('build');
      const testCmd = this.getPackageManagerCommand('test');
      
      console.log("🔧 Running initial build...");
      await this.execCommand(buildCmd, { cwd });
      console.log("✅ Build successful");

      if (this.options.includeTests) {
        console.log("🧪 Running tests...");
        await this.execCommand(testCmd, { cwd });
        console.log("✅ Tests passed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn("⚠️  Initial validation failed:", errorMessage);
      console.log("Manual steps to complete setup:");
      console.log(`  cd ${cwd}`);
      console.log(`  ${this.options.packageManager} run build`);
      if (this.options.includeTests) {
        console.log(`  ${this.options.packageManager} run test`);
      }
    }
  }

  /**
   * Generate dependencies based on options
   */
  private generateDependencies(): Record<string, string> {
    const deps: Record<string, string> = {
      "citty": "^0.1.6",
      "consola": "^3.4.0",
    };

    if (this.options.includeOpenTelemetry) {
      Object.assign(deps, {
        "@opentelemetry/api": "^1.8.0",
        "@opentelemetry/auto-instrumentations-node": "^0.41.0",
        "@opentelemetry/exporter-console": "^1.22.0",
        "@opentelemetry/sdk-node": "^0.49.1",
      });
    }

    return deps;
  }

  /**
   * Generate dev dependencies based on options
   */
  private generateDevDependencies(): Record<string, string> {
    const devDeps: Record<string, string> = {
      "@types/node": "^22.0.0",
      "typescript": "^5.4.0",
      "tsx": "^4.7.0",
      "eslint": "^8.57.0",
      "@typescript-eslint/eslint-plugin": "^7.0.0",
      "@typescript-eslint/parser": "^7.0.0",
      "prettier": "^3.2.0",
    };

    if (this.options.includeTests) {
      Object.assign(devDeps, {
        "vitest": "^1.4.0",
        "@vitest/coverage-v8": "^1.4.0",
      });
    }

    return devDeps;
  }

  /**
   * Generate package.json scripts
   */
  private generateScripts(): Record<string, string> {
    const scripts: Record<string, string> = {
      "build": "tsc",
      "dev": `tsx src/cli.ts`,
      "lint": "eslint src --ext .ts",
      "lint:fix": "eslint src --ext .ts --fix",
      "format": "prettier --write src/**/*.ts",
      "prepublishOnly": `${this.options.packageManager} run build`,
    };

    if (this.options.includeTests) {
      Object.assign(scripts, {
        "test": "vitest",
        "test:coverage": "vitest --coverage",
      });
    }

    return scripts;
  }

  /**
   * Generate individual command file
   */
  private generateCommandFile(command: CommandGeneration): string {
    return `import { defineCommand } from "citty";
${this.options.includeOpenTelemetry ? 'import { trace } from "@opentelemetry/api";' : ''}
import { logger } from "../utils/logger.js";

export const ${command.name}Command = defineCommand({
  meta: {
    name: "${command.name}",
    description: "${command.description}",
    version: "1.0.0",
  },
${command.args && command.args.length > 0 ? `  args: {
${command.args.map(arg => `    ${arg.name}: {
      type: "${arg.type}",
      description: "${arg.description}",${arg.required ? '\n      required: true,' : ''}${arg.default !== undefined ? `\n      default: ${JSON.stringify(arg.default)},` : ''}${arg.alias && arg.alias.length > 0 ? `\n      alias: "${arg.alias[0]}",` : ''}
    }`).join(',\n')}
  },` : ''}
  async run({ args }) {
${this.options.includeOpenTelemetry ? `    const tracer = trace.getTracer("${this.options.name}");
    return tracer.startActiveSpan("${command.name}", async (span) => {
      try {` : ''}
        logger.info("Executing ${command.name} command", { args });
        
        // TODO: Implement ${command.name} logic
        // Generated from: ${command.description}
        
        logger.success("${command.name} completed successfully!");
        
${this.options.includeOpenTelemetry ? `        span.setStatus({ code: 1 }); // OK
      } catch (error) {
        span.setStatus({ code: 2, message: error.message }); // ERROR
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });` : ''}
  },
});

export default ${command.name}Command;
`;
  }

  /**
   * Generate main test file
   */
  private generateMainTestFile(): string {
    return `import { describe, it, expect } from "vitest";
import { runMain } from "citty";
import { commands } from "../src/commands/index.js";

describe("CLI", () => {
  it("should have commands defined", () => {
    expect(commands).toBeDefined();
    expect(typeof commands).toBe("object");
  });

  it("should export all expected commands", () => {
${this.options.commands?.map(cmd => `    expect(commands.${cmd.name}).toBeDefined();`).join('\n') || '    // No commands to test'}
  });
});
`;
  }

  /**
   * Generate command-specific test file
   */
  private generateCommandTestFile(command: CommandGeneration): string {
    return `import { describe, it, expect, vi } from "vitest";
import { ${command.name}Command } from "../src/commands/${command.name}.js";

describe("${command.name} command", () => {
  it("should be defined", () => {
    expect(${command.name}Command).toBeDefined();
    expect(${command.name}Command.meta.name).toBe("${command.name}");
  });

  it("should have correct metadata", () => {
    expect(${command.name}Command.meta.description).toBe("${command.description}");
  });

${command.args && command.args.length > 0 ? `  it("should have expected arguments", () => {
    expect(${command.name}Command.args).toBeDefined();
${command.args.map(arg => `    expect(${command.name}Command.args.${arg.name}).toBeDefined();
    expect(${command.name}Command.args.${arg.name}.type).toBe("${arg.type}");`).join('\n')}
  });` : ''}

  it("should execute without errors", async () => {
    const mockArgs = {
${command.args?.filter(arg => arg.required).map(arg => `      ${arg.name}: ${arg.type === 'string' ? '"test-value"' : arg.type === 'number' ? '42' : 'true'}`).join(',\n') || ''}
    };

    // Mock console methods to avoid output during tests
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    try {
      await ${command.name}Command.run({ args: mockArgs });
      expect(true).toBe(true); // Command executed without throwing
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
`;
  }

  /**
   * Execute command helper with robust error handling
   */
  private execCommand(command: string, options: { cwd: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const [cmd, ...args] = command.split(" ");
        
        if (!cmd) {
          reject(new Error("Empty command provided"));
          return;
        }

        // Validate that the directory exists
        if (!existsSync(options.cwd)) {
          reject(new Error(`Working directory does not exist: ${options.cwd}`));
          return;
        }

        const child = spawn(cmd, args, {
          cwd: options.cwd,
          stdio: "inherit",
          shell: process.platform === "win32",
          env: { ...process.env, PATH: process.env.PATH },
        });

        // Set timeout for long-running commands
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timeout: ${command}`));
        }, 300000); // 5 minutes

        child.on("close", (code, signal) => {
          clearTimeout(timeout);
          if (signal) {
            reject(new Error(`Command killed with signal ${signal}: ${command}`));
          } else if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with exit code ${code}: ${command}`));
          }
        });

        child.on("error", (error) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn command: ${error.message}`));
        });

      } catch (error) {
        reject(new Error(`Command execution setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }
}

/**
 * Create a new project generator
 */
export function createProjectGenerator(options: ProjectGenerationOptions): ProjectGenerator {
  return new ProjectGenerator(options);
}