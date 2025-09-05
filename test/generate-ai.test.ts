import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Skip these tests - files no longer exist
// import {
//   CommandGenerationSchema,
//   ontologyToZod,
//   commandToZodSchema,
// } from "../src/ontology-to-zod";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

// Mock ollama provider
vi.mock("ollama-ai-provider-v2", () => ({
  ollama: vi.fn(() => "mocked-model"),
}));

describe.skip("ontology-to-zod - skipped (files no longer exist)", () => {
  describe("commandToZodSchema", () => {
    it("should convert a simple command to Zod schema", () => {
      const command = {
        name: "test",
        description: "Test command",
        version: "1.0.0",
        args: [
          {
            name: "input",
            type: "string",
            description: "Input file",
            required: true,
          },
          {
            name: "verbose",
            type: "boolean",
            description: "Verbose output",
            default: false,
            alias: ["v"],
          },
        ],
        subCommands: [],
      };

      const schema = commandToZodSchema(command);

      expect(schema).toBeDefined();
      expect(schema._def.shape.name).toBeDefined();
      expect(schema._def.shape.description).toBeDefined();
      expect(schema._def.shape.version).toBeDefined();
      expect(schema._def.shape.args).toBeDefined();

      // Test parsing with the schema
      const parsed = schema.parse({
        name: "test",
        description: "Test command",
        version: "1.0.0",
        args: {
          input: "file.txt",
          verbose: true,
        },
      });

      expect(parsed.name).toBe("test");
      expect(parsed.args.input).toBe("file.txt");
      expect(parsed.args.verbose).toBe(true);
    });

    it("should handle enum arguments", () => {
      const command = {
        name: "format",
        description: "Format command",
        args: [
          {
            name: "type",
            type: "enum",
            description: "Output type",
            options: ["json", "xml", "yaml"],
            default: "json",
          },
        ],
        subCommands: [],
      };

      const schema = commandToZodSchema(command);
      const argsShape = schema._def.shape.args;

      expect(argsShape).toBeDefined();

      // Test that enum values are validated
      const validData = {
        name: "format",
        description: "Format command",
        args: { type: "json" },
      };

      expect(() => schema.parse(validData)).not.toThrow();
    });
  });

  describe("ontologyToZod", () => {
    it("should convert ontology to Zod schema", () => {
      const ontology = `
@prefix citty: <http://example.org/citty#> .
@prefix type: <http://example.org/citty/type#> .

http://example.org/citty/command/test a citty:Command .
http://example.org/citty/command/test citty:hasName "test" .
http://example.org/citty/command/test citty:hasDescription "Test command" .
http://example.org/citty/command/test citty:hasVersion "1.0.0" .
http://example.org/citty/command/test citty:hasArgument http://example.org/citty/command/test/arg/name .
http://example.org/citty/command/test/arg/name a citty:Argument .
http://example.org/citty/command/test/arg/name citty:hasName "name" .
http://example.org/citty/command/test/arg/name citty:hasType type:string .
http://example.org/citty/command/test/arg/name citty:hasDescription "Name argument" .
http://example.org/citty/command/test/arg/name citty:isRequired "true" .
`;

      const schema = ontologyToZod(ontology);

      expect(schema).toBeDefined();
      expect(schema!._def.shape.name).toBeDefined();
      expect(schema!._def.shape.description).toBeDefined();

      // Test that the schema can parse valid data
      const parsed = schema!.parse({
        name: "test",
        description: "Test command",
        version: "1.0.0",
        args: {
          name: "John",
        },
      });

      expect(parsed.name).toBe("test");
    });

    it("should return undefined for invalid ontology", () => {
      const invalidOntology = "Invalid ontology content";
      const schema = ontologyToZod(invalidOntology);
      expect(schema).toBeUndefined();
    });
  });

  describe("CommandGenerationSchema", () => {
    it("should validate command generation structure", () => {
      const validCommand = {
        name: "deploy",
        description: "Deploy application",
        version: "2.0.0",
        args: [
          {
            name: "environment",
            type: "enum",
            description: "Target environment",
            required: true,
            options: ["dev", "staging", "prod"],
          },
          {
            name: "dry-run",
            type: "boolean",
            description: "Simulate deployment",
            default: false,
            alias: ["d"],
          },
        ],
      };

      const parsed = CommandGenerationSchema.parse(validCommand);

      expect(parsed.name).toBe("deploy");
      expect(parsed.description).toBe("Deploy application");
      expect(parsed.version).toBe("2.0.0");
      expect(parsed.args).toHaveLength(2);
      expect(parsed.args[0].name).toBe("environment");
      expect(parsed.args[0].type).toBe("enum");
      expect(parsed.args[0].options).toEqual(["dev", "staging", "prod"]);
    });

    it("should handle nested subcommands", () => {
      const commandWithSubs = {
        name: "git",
        description: "Git command",
        args: [],
        subCommands: [
          {
            name: "commit",
            description: "Commit changes",
            args: [
              {
                name: "message",
                type: "string",
                description: "Commit message",
                required: true,
                alias: ["m"],
              },
            ],
          },
          {
            name: "push",
            description: "Push changes",
            args: [
              {
                name: "force",
                type: "boolean",
                description: "Force push",
                default: false,
                alias: ["f"],
              },
            ],
          },
        ],
      };

      const parsed = CommandGenerationSchema.parse(commandWithSubs);

      expect(parsed.name).toBe("git");
      expect(parsed.subCommands).toHaveLength(2);
      expect(parsed.subCommands![0].name).toBe("commit");
      expect(parsed.subCommands![1].name).toBe("push");
      expect(parsed.subCommands![0].args![0].name).toBe("message");
    });
  });
});

describe("generate-ai command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should mock AI generation successfully", async () => {
    const { generateObject } = await import("ai");
    const mockGenerateObject = vi.mocked(generateObject);

    const mockResult = {
      object: {
        name: "test-cli",
        description: "A test CLI",
        version: "1.0.0",
        args: [
          {
            name: "file",
            type: "string",
            description: "Input file",
            required: true,
          },
        ],
      },
    };

    mockGenerateObject.mockResolvedValue(mockResult as any);

    // Call the mocked function
    const result = await generateObject({
      model: "test-model" as any,
      schema: CommandGenerationSchema,
      prompt: "Create a test CLI",
    });

    expect(result.object.name).toBe("test-cli");
    expect(result.object.description).toBe("A test CLI");
    expect(mockGenerateObject).toHaveBeenCalledOnce();
  });

  it("should validate generated command structure", () => {
    const generatedCommand = {
      name: "docker-cli",
      description: "Docker management CLI",
      version: "1.0.0",
      args: [
        {
          name: "container",
          type: "string",
          description: "Container name or ID",
          required: true,
        },
        {
          name: "action",
          type: "enum",
          description: "Action to perform",
          options: ["start", "stop", "restart", "remove"],
          required: true,
        },
        {
          name: "force",
          type: "boolean",
          description: "Force the action",
          default: false,
          alias: ["f"],
        },
      ],
    };

    // Validate with schema
    const parsed = CommandGenerationSchema.parse(generatedCommand);

    expect(parsed).toBeDefined();
    expect(parsed.name).toBe("docker-cli");
    expect(parsed.args).toHaveLength(3);

    // Check enum arg
    const actionArg = parsed.args.find((a) => a.name === "action");
    expect(actionArg?.type).toBe("enum");
    expect(actionArg?.options).toEqual(["start", "stop", "restart", "remove"]);

    // Check boolean arg with alias
    const forceArg = parsed.args.find((a) => a.name === "force");
    expect(forceArg?.type).toBe("boolean");
    expect(forceArg?.default).toBe(false);
    expect(forceArg?.alias).toEqual(["f"]);
  });
});
