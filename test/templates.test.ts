import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WeaverForge, weaverForge, type TemplateContext } from "../src/utils/templates";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("WeaverForge Template System", () => {
  const testOutputDir = "./test-template-output";
  let forge: WeaverForge;

  beforeEach(() => {
    forge = new WeaverForge();
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

  it("should initialize with built-in templates", () => {
    const templateNames = forge.getTemplateNames();
    expect(templateNames).toContain("typescript-cli");
    expect(templateNames.length).toBeGreaterThan(0);
  });

  it("should register new templates", () => {
    const customTemplate = {
      name: "custom-test",
      description: "A custom test template",
      files: [
        {
          path: "test.txt",
          content: "Hello {{ name }}!",
        },
      ],
    };

    forge.registerTemplate(customTemplate);
    const templateNames = forge.getTemplateNames();
    expect(templateNames).toContain("custom-test");
  });

  it("should generate project from typescript-cli template", () => {
    const context: TemplateContext = {
      name: "test-cli",
      description: "A test CLI application",
      version: "1.0.0",
      author: "Test Author",
      license: "MIT",
      commands: [
        {
          name: "process",
          description: "Process files",
          args: [
            {
              name: "input",
              type: "string",
              description: "Input file",
              required: true,
            },
          ],
        },
      ],
      includeOpenTelemetry: true,
      includeTests: true,
      includeDocs: true,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    // Check that files were created
    expect(existsSync(join(testOutputDir, "package.json"))).toBe(true);
    expect(existsSync(join(testOutputDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/index.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/cli.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/commands/index.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/utils/telemetry.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "src/utils/logger.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "vitest.config.ts"))).toBe(true);
    expect(existsSync(join(testOutputDir, "README.md"))).toBe(true);
    expect(existsSync(join(testOutputDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(testOutputDir, ".eslintrc.json"))).toBe(true);
    expect(existsSync(join(testOutputDir, "bin/cli.js"))).toBe(true);
  });

  it("should properly render template variables in package.json", () => {
    const context: TemplateContext = {
      name: "my-awesome-cli",
      description: "An awesome CLI tool",
      version: "2.1.0",
      author: "Jane Doe",
      license: "Apache-2.0",
      repository: "https://github.com/janedoe/awesome-cli",
      commands: [],
      includeOpenTelemetry: false,
      includeTests: false,
      includeDocs: false,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    expect(packageJson.name).toBe("my-awesome-cli");
    expect(packageJson.description).toBe("An awesome CLI tool");
    expect(packageJson.version).toBe("2.1.0");
    expect(packageJson.author).toBe("Jane Doe");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.repository).toBe("https://github.com/janedoe/awesome-cli");
    expect(packageJson.bin["my-awesome-cli"]).toBe("./bin/cli.js");
  });

  it("should include OpenTelemetry dependencies when enabled", () => {
    const context: TemplateContext = {
      name: "otel-cli",
      description: "CLI with OpenTelemetry",
      version: "1.0.0",
      commands: [],
      includeOpenTelemetry: true,
      includeTests: false,
      includeDocs: false,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/api");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/auto-instrumentations-node");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/exporter-console");
    expect(packageJson.dependencies).toHaveProperty("@opentelemetry/sdk-node");
  });

  it("should include test dependencies when enabled", () => {
    const context: TemplateContext = {
      name: "test-cli",
      description: "CLI with tests",
      version: "1.0.0",
      commands: [],
      includeOpenTelemetry: false,
      includeTests: true,
      includeDocs: false,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    const packageJsonPath = join(testOutputDir, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    expect(packageJson.devDependencies).toHaveProperty("vitest");
    expect(packageJson.devDependencies).toHaveProperty("@vitest/coverage-v8");
    expect(packageJson.scripts).toHaveProperty("test");
    expect(packageJson.scripts).toHaveProperty("test:coverage");
  });

  it("should generate commands in the commands index file", () => {
    const context: TemplateContext = {
      name: "multi-cmd-cli",
      description: "CLI with multiple commands",
      version: "1.0.0",
      commands: [
        {
          name: "build",
          description: "Build the project",
          args: [
            {
              name: "target",
              type: "string",
              description: "Build target",
              required: false,
              default: "production",
            },
          ],
        },
        {
          name: "deploy",
          description: "Deploy the application",
          args: [
            {
              name: "environment",
              type: "enum",
              description: "Deployment environment",
              required: true,
              options: ["staging", "production"],
            },
          ],
        },
      ],
      includeOpenTelemetry: true,
      includeTests: false,
      includeDocs: false,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    const commandsIndexPath = join(testOutputDir, "src/commands/index.ts");
    const commandsContent = readFileSync(commandsIndexPath, "utf8");

    expect(commandsContent).toContain("buildCommand");
    expect(commandsContent).toContain("deployCommand");
    expect(commandsContent).toContain('name: "build"');
    expect(commandsContent).toContain('name: "deploy"');
    expect(commandsContent).toContain("Build the project");
    expect(commandsContent).toContain("Deploy the application");
  });

  it("should handle template not found error", () => {
    const context: TemplateContext = {
      name: "test",
      description: "test",
      version: "1.0.0",
      commands: [],
    };

    expect(() => {
      forge.generateProject("non-existent-template", testOutputDir, context);
    }).toThrow('Template "non-existent-template" not found');
  });

  it("should export default weaverForge instance", () => {
    expect(weaverForge).toBeInstanceOf(WeaverForge);
    expect(weaverForge.getTemplateNames()).toContain("typescript-cli");
  });

  it("should render README with command documentation", () => {
    const context: TemplateContext = {
      name: "doc-cli",
      description: "CLI with documentation",
      version: "1.0.0",
      license: "MIT",
      commands: [
        {
          name: "convert",
          description: "Convert files between formats",
          args: [
            {
              name: "input",
              type: "string",
              description: "Input file path",
              required: true,
            },
            {
              name: "format",
              type: "enum",
              description: "Output format",
              required: false,
              options: ["json", "yaml", "xml"],
            },
          ],
        },
      ],
      includeOpenTelemetry: false,
      includeTests: false,
      includeDocs: true,
    };

    forge.generateProject("typescript-cli", testOutputDir, context);

    const readmePath = join(testOutputDir, "README.md");
    const readmeContent = readFileSync(readmePath, "utf8");

    expect(readmeContent).toContain("# doc-cli");
    expect(readmeContent).toContain("CLI with documentation");
    expect(readmeContent).toContain("### convert");
    expect(readmeContent).toContain("Convert files between formats");
    expect(readmeContent).toContain("doc-cli convert [options]");
    expect(readmeContent).toContain("--input");
    expect(readmeContent).toContain("Input file path (required)");
    expect(readmeContent).toContain("--format");
    expect(readmeContent).toContain("Output format");
  });
});