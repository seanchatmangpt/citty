import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProjectGenerator, createProjectGenerator, type ProjectGenerationOptions } from "../src/utils/project-generator";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandGeneration } from "../src/ontology-to-zod";

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockImplementation((event, callback) => {
      if (event === "close") {
        setTimeout(() => callback(0), 10);
      }
    }),
  })),
}));

describe("ProjectGenerator", () => {
  const testOutputDir = "./test-project-output";

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it("should create project generator with default options", () => {
    const options: ProjectGenerationOptions = {
      name: "test-cli",
      description: "A test CLI",
      outputDir: testOutputDir,
    };

    const generator = createProjectGenerator(options);
    expect(generator).toBeInstanceOf(ProjectGenerator);
  });

  it("should generate project with all default features", async () => {
    const testCommand: CommandGeneration = {
      name: "process",
      description: "Process files",
      version: "1.0.0",
      args: [
        {
          name: "input",
          type: "string",
          description: "Input file path",
          required: true,
        },
        {
          name: "output",
          type: "string",
          description: "Output directory",
          default: "./output",
        },
      ],
    };

    const options: ProjectGenerationOptions = {
      name: "test-cli",
      description: "A comprehensive test CLI",
      outputDir: testOutputDir,
      author: "Test Author",
      license: "MIT",
      repository: "https://github.com/test/test-cli",
      commands: [testCommand],
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    // Verify basic project structure
    expect(existsSync(join(testOutputDir, "package.json"))).toBe(true);
    expect(existsSync(join(testOutputDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/index.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/cli.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/commands/index.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/utils/logger.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "bin/cli.js"))).toBe(true);

    // Verify OpenTelemetry files (enabled by default)
    expect(existsSync(join(testOutputDir, "src/utils/telemetry.ts"))).toBe(true);

    // Verify test files (enabled by default)
    expect(existsSync(join(testOutputDir, "test/cli.test.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "test/process.test.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "vitest.config.ts"))).toBe(true);

    // Verify documentation (enabled by default)
    expect(existsSync(join(testOutputDir, "README.md"))).toBe(true);
    expect(existsSync(join(testOutputDir, "CHANGELOG.md"))).toBe(true);
  });

  it("should generate command-specific files", async () => {
    const testCommands: CommandGeneration[] = [
      {
        name: "build",
        description: "Build the project",
        version: "1.0.0",
        args: [
          {
            name: "target",
            type: "enum",
            description: "Build target",
            options: ["dev", "prod"],
            default: "dev",
          },
        ],
      },
      {
        name: "deploy",
        description: "Deploy the application",
        version: "1.0.0",
        args: [
          {
            name: "environment",
            type: "string",
            description: "Target environment",
            required: true,
          },
        ],
      },
    ];

    const options: ProjectGenerationOptions = {
      name: "multi-command-cli",
      description: "CLI with multiple commands",
      outputDir: testOutputDir,
      commands: testCommands,
      includeTests: true,
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    // Check command files were created
    expect(existsSync(join(testOutputDir, "src/commands/build.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/commands/deploy.ts"))).toBe(true);

    // Check test files were created
    expect(existsSync(join(testOutputDir, "test/build.test.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "test/deploy.test.ts"))).toBe(true);

    // Verify command file content
    const buildCommandContent = readFileSync(join(testOutputDir, "src/commands/build.ts"), "utf8");
    expect(buildCommandContent).toContain("buildCommand");
    expect(buildCommandContent).toContain("Build the project");
    expect(buildCommandContent).toContain("target");
    expect(buildCommandContent).toContain("enum");

    const deployCommandContent = readFileSync(join(testOutputDir, "src/commands/deploy.ts"), "utf8");
    expect(deployCommandContent).toContain("deployCommand");
    expect(deployCommandContent).toContain("Deploy the application");
    expect(deployCommandContent).toContain("environment");
    expect(deployCommandContent).toContain("required: true");
  });

  it("should generate package.json with correct metadata", async () => {
    const options: ProjectGenerationOptions = {
      name: "awesome-cli",
      description: "An awesome CLI tool",
      outputDir: testOutputDir,
      author: "John Doe",
      license: "Apache-2.0",
      repository: "https://github.com/johndoe/awesome-cli",
      packageManager: "pnpm",
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    expect(packageJson.name).toBe("awesome-cli");
    expect(packageJson.description).toBe("An awesome CLI tool");
    expect(packageJson.author).toBe("John Doe");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.repository).toBe("https://github.com/johndoe/awesome-cli");
    expect(packageJson.bin["awesome-cli"]).toBe("./bin/cli.js");
    expect(packageJson.type).toBe("module");
  });

  it("should include OpenTelemetry dependencies when enabled", async () => {
    const options: ProjectGenerationOptions = {
      name: "otel-cli",
      description: "CLI with telemetry",
      outputDir: testOutputDir,
      includeOpenTelemetry: true,
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/api");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/auto-instrumentations-node");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/exporter-console");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/sdk-node");

    // Verify telemetry file exists
    expect(existsSync(join(testOutputDir, "src/utils/telemetry.ts"))).toBe(true);
  });

  it("should exclude OpenTelemetry when disabled", async () => {
    const options: ProjectGenerationOptions = {
      name: "no-otel-cli",
      description: "CLI without telemetry",
      outputDir: testOutputDir,
      includeOpenTelemetry: false,
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.dependencies).not.toHaveProperty("@opentelemetry/api");
    expect(packageJson.dependencies).not.toHaveProperty("@opentelemetry/auto-instrumentations-node");

    // Telemetry file should still exist but not be imported in CLI
    const cliContent = readFileSync(join(testOutputDir, "src/cli.ts"), "utf8");
    expect(cliContent).not.toContain('import { initTelemetry }');
  });

  it("should include test dependencies and files when enabled", async () => {
    const options: ProjectGenerationOptions = {
      name: "tested-cli",
      description: "CLI with tests",
      outputDir: testOutputDir,
      includeTests: true,
      commands: [
        {
          name: "test-command",
          description: "A test command",
          version: "1.0.0",
          args: [],
        },
      ],
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.devDependencies).toHaveProperty("vitest");
    expect(packageJson.devDependencies).toHaveProperty("@vitest/coverage-v8");
    expect(packageJson.scripts).toHaveProperty("test");
    expect(packageJson.scripts).toHaveProperty("test:coverage");

    // Verify test files
    expect(existsSync(join(testOutputDir, "vitest.config.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "test/cli.test.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "test/test-command.test.ts"))).toBe(true);
  });

  it("should exclude tests when disabled", async () => {
    const options: ProjectGenerationOptions = {
      name: "no-tests-cli",
      description: "CLI without tests",
      outputDir: testOutputDir,
      includeTests: false,
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.devDependencies).not.toHaveProperty("vitest");
    expect(packageJson.scripts).not.toHaveProperty("test");

    expect(existsSync(join(testOutputDir, "vitest.config.ts"))).toBe(false);
    expect(existsSync(join(testOutputDir, "test"))).toBe(false);
  });

  it("should generate different package manager scripts", async () => {
    const npmOptions: ProjectGenerationOptions = {
      name: "npm-cli",
      description: "CLI with npm",
      outputDir: testOutputDir,
      packageManager: "npm",
    };

    const generator = new ProjectGenerator(npmOptions);
    await generator.generateProject();

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.scripts.prepublishOnly).toBe("npm run build");
  });

  it("should handle project generation errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    // Mock spawn to simulate failure
    const spawn = await import("node:child_process");
    vi.mocked(spawn.spawn).mockImplementationOnce(() => ({
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === "close") {
          setTimeout(() => callback(1), 10); // Exit with error code
        }
        if (event === "error") {
          setTimeout(() => callback(new Error("Command failed")), 10);
        }
      }),
    } as any));

    const options: ProjectGenerationOptions = {
      name: "error-cli",
      description: "CLI that fails",
      outputDir: testOutputDir,
    };

    const generator = new ProjectGenerator(options);
    await generator.generateProject();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to install dependencies")
    );
    
    consoleSpy.mockRestore();
  });

  it("should create factory function", () => {
    const options: ProjectGenerationOptions = {
      name: "factory-cli",
      description: "CLI from factory",
      outputDir: testOutputDir,
    };

    const generator = createProjectGenerator(options);
    expect(generator).toBeInstanceOf(ProjectGenerator);
  });
});