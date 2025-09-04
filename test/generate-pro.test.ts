import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateProCommand } from "../src/commands/generate-pro";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Mock external dependencies
vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      name: "test-cli",
      description: "A test CLI generated for testing",
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
    },
  }),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  ollama: vi.fn(),
}));

describe("generate-pro command", () => {
  const testOutputDir = "./test-output";

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

  it("should be defined with correct metadata", () => {
    expect(generateProCommand).toBeDefined();
    expect(generateProCommand.meta.name).toBe("generate-pro");
    expect(generateProCommand.meta.description).toContain("professional CLI package");
  });

  it("should have all required arguments", () => {
    expect(generateProCommand.args).toBeDefined();
    expect(generateProCommand.args.prompt).toBeDefined();
    expect(generateProCommand.args.prompt.type).toBe("string");
    expect(generateProCommand.args.prompt.required).toBe(true);
    
    expect(generateProCommand.args.model).toBeDefined();
    expect(generateProCommand.args.model.default).toBe("qwen2.5-coder:3b");
    
    expect(generateProCommand.args.output).toBeDefined();
    expect(generateProCommand.args.output.default).toBe("./my-cli");
  });

  it("should have optional configuration arguments", () => {
    expect(generateProCommand.args.author).toBeDefined();
    expect(generateProCommand.args.license).toBeDefined();
    expect(generateProCommand.args.license.default).toBe("MIT");
    
    expect(generateProCommand.args.packageManager).toBeDefined();
    expect(generateProCommand.args.packageManager.type).toBe("enum");
    expect(generateProCommand.args.packageManager.options).toEqual(["npm", "pnpm", "yarn"]);
    
    expect(generateProCommand.args.includeOpenTelemetry).toBeDefined();
    expect(generateProCommand.args.includeOpenTelemetry.default).toBe(true);
  });

  it("should handle dry run mode", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const args = {
      prompt: "Create a file processor CLI",
      output: testOutputDir,
      dryRun: true,
      verbose: false,
      model: "test-model",
      name: "test-cli",
      author: "Test Author",
      license: "MIT",
      packageManager: "npm",
      template: "typescript-cli",
      temperature: 0.7,
      includeOpenTelemetry: true,
      includeTests: true,
      includeDocs: true,
      overwrite: false,
    };

    await generateProCommand.run({ args });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Dry Run - Would generate:")
    );
    expect(existsSync(testOutputDir)).toBe(false);
    
    consoleSpy.mockRestore();
  });

  it("should reject existing output directory without overwrite", async () => {
    // Create test directory
    mkdirSync(testOutputDir, { recursive: true });
    
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const args = {
      prompt: "Create a test CLI",
      output: testOutputDir,
      overwrite: false,
      dryRun: false,
      verbose: false,
      model: "test-model",
      name: "test-cli",
      author: "Test Author",
      license: "MIT",
      packageManager: "npm",
      template: "typescript-cli",
      temperature: 0.7,
      includeOpenTelemetry: true,
      includeTests: true,
      includeDocs: true,
    };

    try {
      await generateProCommand.run({ args });
    } catch (error) {
      expect(error.message).toBe("process.exit called");
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Output directory already exists")
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should display verbose output when enabled", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const args = {
      prompt: "Create a file processor CLI",
      output: testOutputDir,
      dryRun: true,
      verbose: true,
      model: "test-model",
      name: "test-cli",
      author: "Test Author",
      license: "MIT",
      packageManager: "npm",
      template: "typescript-cli",
      temperature: 0.7,
      includeOpenTelemetry: true,
      includeTests: true,
      includeDocs: true,
      overwrite: false,
    };

    await generateProCommand.run({ args });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("AI Model: test-model")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Package Manager: npm")
    );
    
    consoleSpy.mockRestore();
  });

  it("should handle all package manager options", () => {
    const packageManagerArg = generateProCommand.args.packageManager;
    expect(packageManagerArg.options).toContain("npm");
    expect(packageManagerArg.options).toContain("pnpm");
    expect(packageManagerArg.options).toContain("yarn");
    expect(packageManagerArg.default).toBe("npm");
  });

  it("should have proper default values", () => {
    expect(generateProCommand.args.model.default).toBe("qwen2.5-coder:3b");
    expect(generateProCommand.args.output.default).toBe("./my-cli");
    expect(generateProCommand.args.license.default).toBe("MIT");
    expect(generateProCommand.args.packageManager.default).toBe("npm");
    expect(generateProCommand.args.template.default).toBe("typescript-cli");
    expect(generateProCommand.args.temperature.default).toBe(0.7);
    expect(generateProCommand.args.includeOpenTelemetry.default).toBe(true);
    expect(generateProCommand.args.includeTests.default).toBe(true);
    expect(generateProCommand.args.includeDocs.default).toBe(true);
    expect(generateProCommand.args.overwrite.default).toBe(false);
    expect(generateProCommand.args.verbose.default).toBe(false);
    expect(generateProCommand.args.dryRun.default).toBe(false);
  });

  it("should have proper aliases for boolean flags", () => {
    expect(generateProCommand.args.includeOpenTelemetry.alias).toBe("otel");
    expect(generateProCommand.args.includeTests.alias).toBe("tests");
    expect(generateProCommand.args.includeDocs.alias).toBe("docs");
    expect(generateProCommand.args.overwrite.alias).toBe("f");
    expect(generateProCommand.args.verbose.alias).toBe("v");
    expect(generateProCommand.args.dryRun.alias).toBe("dry");
  });
});