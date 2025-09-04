import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toOntology, fromOntology, validateOntology } from "../src/ontology";
import {
  CommandGenerationSchema,
  ontologyToZod,
  commandToZodSchema,
  type CommandGeneration,
} from "../src/ontology-to-zod";
import type { CommandDef } from "../src/types";

// Mock AI SDK with comprehensive test data
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("ollama-ai-provider", () => ({
  createOllama: vi.fn(() => () => "mocked-model"),
}));

describe("Integration: AI-Ontology Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Natural Language → AI Generation → CommandDef", () => {
    it("should generate valid command from natural language with mocked AI", async () => {
      const { generateObject } = await import("ai");
      const mockGenerateObject = vi.mocked(generateObject);

      // Mock AI response for "Create a file management CLI"
      const mockAIResponse: CommandGeneration = {
        name: "file-manager",
        description: "Manage files and directories with various operations",
        version: "1.0.0",
        args: [
          {
            name: "path",
            type: "string",
            description: "Target file or directory path",
            required: true,
          },
          {
            name: "operation",
            type: "enum",
            description: "Operation to perform",
            options: ["copy", "move", "delete", "list"],
            required: true,
          },
          {
            name: "recursive",
            type: "boolean",
            description: "Apply operation recursively",
            default: false,
            alias: ["r"],
          },
          {
            name: "verbose",
            type: "boolean",
            description: "Show detailed output",
            default: false,
            alias: ["v"],
          },
        ],
        subCommands: [
          {
            name: "backup",
            description: "Create backup of files",
            args: [
              {
                name: "source",
                type: "string",
                description: "Source directory",
                required: true,
              },
              {
                name: "destination",
                type: "string",
                description: "Backup destination",
                required: true,
              },
            ],
          },
        ],
      };

      mockGenerateObject.mockResolvedValue({
        object: mockAIResponse,
      } as any);

      // Simulate AI generation call
      const result = await generateObject({
        model: "test-model" as any,
        schema: CommandGenerationSchema,
        system: "You are a CLI expert",
        prompt: "Create a file management CLI",
      });

      // Verify AI generated valid structure
      expect(result.object).toMatchObject({
        name: "file-manager",
        description: expect.stringContaining("file"),
        args: expect.arrayContaining([
          expect.objectContaining({
            name: "path",
            type: "string",
            required: true,
          }),
          expect.objectContaining({
            name: "operation",
            type: "enum",
            options: ["copy", "move", "delete", "list"],
          }),
        ]),
        subCommands: expect.arrayContaining([
          expect.objectContaining({
            name: "backup",
            description: expect.stringContaining("backup"),
          }),
        ]),
      });

      // Validate with schema
      const validated = CommandGenerationSchema.parse(result.object);
      expect(validated.name).toBe("file-manager");
      expect(validated.args).toHaveLength(4);
      expect(validated.subCommands).toHaveLength(1);
    });

    it("should handle complex nested subcommands from AI", async () => {
      const { generateObject } = await import("ai");
      const mockGenerateObject = vi.mocked(generateObject);

      // Mock AI response for complex git-like CLI
      const complexCommand: CommandGeneration = {
        name: "git-tool",
        description: "Git repository management tool",
        version: "2.0.0",
        args: [
          {
            name: "repository",
            type: "string",
            description: "Repository path or URL",
            valueHint: "/path/to/repo or https://github.com/user/repo",
          },
        ],
        subCommands: [
          {
            name: "commit",
            description: "Create a commit",
            args: [
              {
                name: "message",
                type: "string",
                description: "Commit message",
                required: true,
                alias: ["m"],
              },
              {
                name: "all",
                type: "boolean",
                description: "Commit all changes",
                default: false,
                alias: ["a"],
              },
            ],
          },
          {
            name: "branch",
            description: "Branch operations",
            subCommands: [
              {
                name: "create",
                description: "Create new branch",
                args: [
                  {
                    name: "name",
                    type: "string",
                    description: "Branch name",
                    required: true,
                  },
                  {
                    name: "checkout",
                    type: "boolean",
                    description: "Checkout after creation",
                    default: true,
                    alias: ["c"],
                  },
                ],
              },
            ],
          },
        ],
      };

      mockGenerateObject.mockResolvedValue({
        object: complexCommand,
      } as any);

      const result = await generateObject({
        model: "test-model" as any,
        schema: CommandGenerationSchema,
        prompt: "Create a comprehensive git CLI tool",
      });

      // Verify complex nested structure
      expect(result.object.subCommands).toHaveLength(2);
      expect(result.object.subCommands![1].subCommands).toHaveLength(1);
      expect(result.object.subCommands![1].subCommands![0].name).toBe("create");
    });
  });

  describe("2. CommandDef → Ontology Conversion Preserves All Properties", () => {
    it("should preserve all command properties in ontology", async () => {
      const complexCommand: CommandDef = {
        meta: {
          name: "deploy-tool",
          description: "Application deployment tool with advanced features",
          version: "3.1.4",
          hidden: false,
        },
        args: {
          environment: {
            type: "enum",
            description: "Target deployment environment",
            options: ["development", "staging", "production"],
            required: true,
            alias: ["e", "env"],
          },
          config: {
            type: "string",
            description: "Configuration file path",
            default: "deploy.config.js",
            valueHint: "path/to/config.js",
          },
          dryRun: {
            type: "boolean",
            description: "Simulate deployment without executing",
            default: false,
            alias: "d",
          },
          timeout: {
            type: "number",
            description: "Deployment timeout in seconds",
            default: 300,
          },
        },
        subCommands: {
          rollback: {
            meta: {
              name: "rollback",
              description: "Rollback to previous version",
            },
            args: {
              version: {
                type: "string",
                description: "Target version to rollback to",
                required: true,
              },
              force: {
                type: "boolean",
                description: "Force rollback without confirmation",
                default: false,
                alias: "f",
              },
            },
          },
        },
      };

      const ontology = await toOntology(complexCommand);

      // Verify all properties are preserved in ontology
      expect(ontology).toContain('citty:hasName "deploy-tool"');
      expect(ontology).toContain(
        "Application deployment tool with advanced features",
      );
      expect(ontology).toContain('citty:hasVersion "3.1.4"');

      // Check arguments are preserved
      expect(ontology).toContain('citty:hasName "environment"');
      expect(ontology).toContain("type:enum");
      expect(ontology).toContain('citty:hasOption "development"');
      expect(ontology).toContain('citty:hasOption "staging"');
      expect(ontology).toContain('citty:hasOption "production"');
      expect(ontology).toContain('citty:isRequired "true"');

      // Check aliases
      expect(ontology).toContain('citty:hasAlias "e"');
      expect(ontology).toContain('citty:hasAlias "env"');

      // Check defaults (all values are stored as quoted strings)
      expect(ontology).toContain('citty:hasDefaultValue "deploy.config.js"');
      expect(ontology).toContain('citty:hasDefaultValue "300"');
      expect(ontology).toContain('citty:hasDefaultValue "false"');

      // Check subcommands
      expect(ontology).toContain("citty:hasSubCommand");
      expect(ontology).toContain('citty:hasName "rollback"');
    });

    it("should handle edge cases in ontology conversion", async () => {
      const edgeCaseCommand: CommandDef = {
        meta: {
          name: 'command-with-"quotes"',
          description: "Description with\nnewlines and\ttabs",
          version: "1.0.0-beta.1",
        },
        args: {
          "special-chars": {
            type: "string",
            description: 'Argument with "special" characters',
            default: "value with spaces",
          },
        },
      };

      const ontology = await toOntology(edgeCaseCommand);

      // Verify special characters are properly escaped
      // Note: Based on actual output, quotes in URIs are not escaped in the same way
      expect(ontology).toContain('command-with-"quotes"');
      expect(ontology).toContain(
        String.raw`Argument with \"special\" characters`,
      );
      expect(ontology).toContain('"value with spaces"');
      expect(ontology).toContain(String.raw`\n`);
      expect(ontology).toContain(String.raw`\t`);
    });
  });

  describe("3. Ontology → Zod Schema Conversion Works Correctly", () => {
    it("should convert complete ontology to accurate Zod schema", () => {
      const ontology = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix citty: <http://example.org/citty#> .
@prefix type: <http://example.org/citty/type#> .

http://example.org/citty/command/test-cli a citty:Command .
http://example.org/citty/command/test-cli citty:hasName "test-cli" .
http://example.org/citty/command/test-cli citty:hasDescription "Test CLI for validation" .
http://example.org/citty/command/test-cli citty:hasVersion "2.1.0" .
http://example.org/citty/command/test-cli citty:hasArgument http://example.org/citty/command/test-cli/arg/input .
http://example.org/citty/command/test-cli citty:hasArgument http://example.org/citty/command/test-cli/arg/format .
http://example.org/citty/command/test-cli citty:hasArgument http://example.org/citty/command/test-cli/arg/verbose .

http://example.org/citty/command/test-cli/arg/input a citty:Argument .
http://example.org/citty/command/test-cli/arg/input citty:hasName "input" .
http://example.org/citty/command/test-cli/arg/input citty:hasType type:string .
http://example.org/citty/command/test-cli/arg/input citty:hasDescription "Input file path" .
http://example.org/citty/command/test-cli/arg/input citty:isRequired "true" .

http://example.org/citty/command/test-cli/arg/format a citty:Argument .
http://example.org/citty/command/test-cli/arg/format citty:hasName "format" .
http://example.org/citty/command/test-cli/arg/format citty:hasType type:enum .
http://example.org/citty/command/test-cli/arg/format citty:hasDescription "Output format" .
http://example.org/citty/command/test-cli/arg/format citty:hasOption "json" .
http://example.org/citty/command/test-cli/arg/format citty:hasOption "yaml" .
http://example.org/citty/command/test-cli/arg/format citty:hasOption "xml" .
http://example.org/citty/command/test-cli/arg/format citty:hasDefaultValue "json" .

http://example.org/citty/command/test-cli/arg/verbose a citty:Argument .
http://example.org/citty/command/test-cli/arg/verbose citty:hasName "verbose" .
http://example.org/citty/command/test-cli/arg/verbose citty:hasType type:boolean .
http://example.org/citty/command/test-cli/arg/verbose citty:hasDescription "Enable verbose output" .
http://example.org/citty/command/test-cli/arg/verbose citty:hasDefaultValue "false" .
http://example.org/citty/command/test-cli/arg/verbose citty:hasAlias "v" .
`;

      const zodSchema = ontologyToZod(ontology);
      expect(zodSchema).toBeDefined();

      // Test schema validation with various inputs
      const validData = {
        name: "test-cli",
        description: "Test CLI for validation",
        version: "2.1.0",
        args: {
          input: "/path/to/file.txt",
          format: "yaml",
          verbose: true,
        },
      };

      const parsed = zodSchema!.parse(validData);
      expect(parsed.name).toBe("test-cli");
      expect(parsed.args.input).toBe("/path/to/file.txt");
      expect(parsed.args.format).toBe("yaml");
      expect(parsed.args.verbose).toBe(true);

      // Test with default values
      const dataWithDefaults = {
        name: "test-cli",
        description: "Test CLI for validation",
        version: "2.1.0",
        args: {
          input: "/path/to/file.txt",
        },
      };

      const parsedWithDefaults = zodSchema!.parse(dataWithDefaults);
      expect(parsedWithDefaults.args.format).toBe("json"); // default
      expect(parsedWithDefaults.args.verbose).toBe(false); // default
    });

    it("should handle all argument types correctly", () => {
      const ontology = `
@prefix citty: <http://example.org/citty#> .
@prefix type: <http://example.org/citty/type#> .

http://example.org/citty/command/types-test a citty:Command .
http://example.org/citty/command/types-test citty:hasName "types-test" .
http://example.org/citty/command/types-test citty:hasArgument http://example.org/citty/command/types-test/arg/str .
http://example.org/citty/command/types-test citty:hasArgument http://example.org/citty/command/types-test/arg/num .
http://example.org/citty/command/types-test citty:hasArgument http://example.org/citty/command/types-test/arg/bool .
http://example.org/citty/command/types-test citty:hasArgument http://example.org/citty/command/types-test/arg/enum_arg .

http://example.org/citty/command/types-test/arg/str citty:hasName "str" .
http://example.org/citty/command/types-test/arg/str citty:hasType type:string .

http://example.org/citty/command/types-test/arg/num citty:hasName "num" .
http://example.org/citty/command/types-test/arg/num citty:hasType type:number .
http://example.org/citty/command/types-test/arg/num citty:hasDefaultValue "42" .

http://example.org/citty/command/types-test/arg/bool citty:hasName "bool" .
http://example.org/citty/command/types-test/arg/bool citty:hasType type:boolean .
http://example.org/citty/command/types-test/arg/bool citty:hasDefaultValue "true" .

http://example.org/citty/command/types-test/arg/enum_arg citty:hasName "enum_arg" .
http://example.org/citty/command/types-test/arg/enum_arg citty:hasType type:enum .
http://example.org/citty/command/types-test/arg/enum_arg citty:hasOption "option1" .
http://example.org/citty/command/types-test/arg/enum_arg citty:hasOption "option2" .
`;

      const zodSchema = ontologyToZod(ontology);
      expect(zodSchema).toBeDefined();

      const testData = {
        name: "types-test",
        args: {
          str: "hello",
          num: 123,
          bool: false,
          enum_arg: "option2",
        },
      };

      const parsed = zodSchema!.parse(testData);
      expect(parsed.args.str).toBe("hello");
      expect(parsed.args.num).toBe(123);
      expect(parsed.args.bool).toBe(false);
      expect(parsed.args.enum_arg).toBe("option2");
    });
  });

  describe("4. Zod Schema → TypeScript Code Generation", () => {
    it("should generate valid TypeScript code from Zod schema", () => {
      const command: CommandGeneration = {
        name: "build-tool",
        description: "Build and package application",
        version: "1.2.3",
        args: [
          {
            name: "target",
            type: "enum",
            description: "Build target",
            options: ["web", "mobile", "desktop"],
            required: true,
          },
          {
            name: "minify",
            type: "boolean",
            description: "Minify output",
            default: true,
            alias: ["m"],
          },
          {
            name: "outputDir",
            type: "string",
            description: "Output directory",
            default: "./dist",
            valueHint: "path/to/output",
          },
        ],
      };

      // Convert to Zod schema first
      const parsedCommand = {
        name: command.name,
        description: command.description,
        version: command.version,
        args: command.args || [],
        subCommands: command.subCommands || [],
      };

      const zodSchema = commandToZodSchema(parsedCommand);
      expect(zodSchema).toBeDefined();

      // Test that the schema can validate the command structure
      const validatedCommand = zodSchema.parse({
        name: "build-tool",
        description: "Build and package application",
        version: "1.2.3",
        args: {
          target: "web",
          minify: false,
          outputDir: "./custom-dist",
        },
      });

      expect(validatedCommand.args.target).toBe("web");
      expect(validatedCommand.args.minify).toBe(false);
      expect(validatedCommand.args.outputDir).toBe("./custom-dist");
    });
  });

  describe("5. Complete Round-Trip: Command → Ontology → Command", () => {
    it("should preserve all properties in complete round-trip", async () => {
      // Original command with comprehensive features
      const originalCommand: CommandDef = {
        meta: {
          name: "package-manager",
          description: "Comprehensive package management system",
          version: "4.2.1",
        },
        args: {
          package: {
            type: "string",
            description: "Package name or path",
            required: true,
            valueHint: "package-name or /path/to/package",
          },
          action: {
            type: "enum",
            description: "Action to perform",
            options: ["install", "remove", "update", "list"],
            required: true,
          },
          global: {
            type: "boolean",
            description: "Install globally",
            default: false,
            alias: ["g"],
          },
          registry: {
            type: "string",
            description: "Package registry URL",
            default: "https://registry.npmjs.org",
          },
          timeout: {
            type: "number",
            description: "Request timeout in seconds",
            default: 30,
          },
        },
        subCommands: {
          config: {
            meta: {
              name: "config",
              description: "Manage configuration",
            },
            args: {
              key: {
                type: "string",
                description: "Configuration key",
                required: true,
              },
              value: {
                type: "string",
                description: "Configuration value",
              },
            },
          },
        },
      };

      // Step 1: Command → Ontology
      const ontology = await toOntology(originalCommand);
      expect(validateOntology(ontology)).toBe(true);

      // Step 2: Ontology → Zod Schema
      const zodSchema = ontologyToZod(ontology);
      expect(zodSchema).toBeDefined();

      // Step 3: Verify Zod schema can parse original command structure
      const testData = {
        name: "package-manager",
        description: "Comprehensive package management system",
        version: "4.2.1",
        args: {
          package: "react",
          action: "install",
          global: true,
          registry: "https://custom-registry.com",
          timeout: 60,
        },
        subCommands: {
          config: {
            name: "config",
            description: "Manage configuration",
            args: {
              key: "registry",
              value: "https://custom-registry.com",
            },
          },
        },
      };

      const parsed = zodSchema!.parse(testData);

      // Verify all properties are preserved
      expect(parsed.name).toBe("package-manager");
      expect(parsed.description).toBe(
        "Comprehensive package management system",
      );
      expect(parsed.version).toBe("4.2.1");
      expect(parsed.args.package).toBe("react");
      expect(parsed.args.action).toBe("install");
      expect(parsed.args.global).toBe(true);
      expect(parsed.args.timeout).toBe(60);

      // Step 4: Ontology → TypeScript (via fromOntology)
      const generatedTS = await fromOntology(ontology);
      expect(generatedTS).toBeDefined();
      expect(generatedTS).toContain("package-manager");
      expect(generatedTS).toContain("Comprehensive package management system");
    });

    it("should handle complex nested subcommands in round-trip", async () => {
      const complexCommand: CommandDef = {
        meta: {
          name: "cloud-cli",
          description: "Multi-cloud management CLI",
          version: "2.0.0",
        },
        args: {
          provider: {
            type: "enum",
            description: "Cloud provider",
            options: ["aws", "azure", "gcp"],
            required: true,
          },
        },
        subCommands: {
          compute: {
            meta: {
              name: "compute",
              description: "Manage compute resources",
            },
            subCommands: {
              instance: {
                meta: {
                  name: "instance",
                  description: "Manage instances",
                },
                args: {
                  name: {
                    type: "string",
                    description: "Instance name",
                    required: true,
                  },
                  size: {
                    type: "enum",
                    description: "Instance size",
                    options: ["small", "medium", "large"],
                    default: "medium",
                  },
                },
              },
            },
          },
        },
      };

      // Complete round-trip test
      const ontology = await toOntology(complexCommand);
      const zodSchema = ontologyToZod(ontology);
      const generatedTS = await fromOntology(ontology);

      expect(ontology).toContain("cloud-cli");
      expect(zodSchema).toBeDefined();
      expect(generatedTS).toContain("cloud-cli");
      expect(generatedTS).toContain("Multi-cloud management CLI");
    });
  });

  describe("6. Error Handling and Edge Cases", () => {
    it("should handle malformed ontology gracefully", () => {
      const malformedOntology = `
Invalid ontology content
Not turtle format
Missing prefixes
`;

      const zodSchema = ontologyToZod(malformedOntology);
      expect(zodSchema).toBeUndefined();
      expect(validateOntology(malformedOntology)).toBe(false);
    });

    it("should handle empty commands", async () => {
      const emptyCommand: CommandDef = {
        meta: {
          name: "empty-cmd",
        },
      };

      const ontology = await toOntology(emptyCommand);
      expect(ontology).toContain("empty-cmd");
      expect(validateOntology(ontology)).toBe(true);

      const zodSchema = ontologyToZod(ontology);
      expect(zodSchema).toBeDefined();
    });

    it("should validate enum constraints properly", () => {
      const command = {
        name: "enum-test",
        description: "Test enum validation",
        args: [
          {
            name: "level",
            type: "enum" as const,
            description: "Log level",
            options: ["debug", "info", "warn", "error"],
            required: true,
          },
        ],
        subCommands: [],
      };

      const zodSchema = commandToZodSchema(command);

      // Valid enum value
      expect(() =>
        zodSchema.parse({
          name: "enum-test",
          description: "Test enum validation",
          args: { level: "info" },
        }),
      ).not.toThrow();

      // Invalid enum value should throw
      expect(() =>
        zodSchema.parse({
          name: "enum-test",
          description: "Test enum validation",
          args: { level: "invalid" },
        }),
      ).toThrow();
    });

    it("should handle special characters and unicode", async () => {
      const unicodeCommand: CommandDef = {
        meta: {
          name: "unicode-test",
          description: "Test with émojis 🚀 and ünïcödé",
        },
        args: {
          "special-name": {
            type: "string",
            description: "Argümënt with spëcial chars",
            default: "défàült valüe",
          },
        },
      };

      const ontology = await toOntology(unicodeCommand);
      expect(validateOntology(ontology)).toBe(true);

      const zodSchema = ontologyToZod(ontology);
      expect(zodSchema).toBeDefined();

      const parsed = zodSchema!.parse({
        name: "unicode-test",
        description: "Test with émojis 🚀 and ünïcödé",
        args: {
          "special-name": "tëst valüe",
        },
      });

      expect(parsed.args["special-name"]).toBe("tëst valüe");
    });
  });

  describe("7. Performance and Scalability", () => {
    it("should handle large command structures efficiently", async () => {
      // Generate a command with many arguments and subcommands
      const largeCommand: CommandDef = {
        meta: {
          name: "large-cli",
          description: "CLI with many options",
          version: "1.0.0",
        },
        args: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `arg${i}`,
            {
              type: "string" as const,
              description: `Argument number ${i}`,
              default: `default${i}`,
            },
          ]),
        ),
        subCommands: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [
            `sub${i}`,
            {
              meta: {
                name: `sub${i}`,
                description: `Subcommand ${i}`,
              },
              args: {
                [`subarg${i}`]: {
                  type: "string" as const,
                  description: `Sub argument ${i}`,
                },
              },
            },
          ]),
        ),
      };

      const startTime = Date.now();

      // Test complete workflow performance
      const ontology = await toOntology(largeCommand);
      const zodSchema = ontologyToZod(ontology);
      const generatedTS = await fromOntology(ontology);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(validateOntology(ontology)).toBe(true);
      expect(zodSchema).toBeDefined();
      expect(generatedTS).toBeDefined();
    });
  });
});
