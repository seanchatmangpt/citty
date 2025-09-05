import { expect, it, describe } from "vitest";
// Skip for now - need to check if functions exist in new structure
import { toOntology, toSimpleOntology, defineCommand } from "../src";

describe("ontology", () => {
  it("should generate ontology for a simple command", async () => {
    const command = defineCommand({
      meta: {
        name: "test",
        description: "Test command",
        version: "1.0.0",
      },
      args: {
        name: {
          type: "string",
          description: "Name argument",
          required: true,
        },
        verbose: {
          type: "boolean",
          description: "Verbose mode",
          default: false,
        },
      },
    });

    const ontology = await toOntology(command);

    expect(ontology).toContain("@prefix citty: <http://example.org/citty#>");
    expect(ontology).toContain("citty:Command a owl:Class");
    expect(ontology).toContain("citty:Argument a owl:Class");
    expect(ontology).toContain('citty:hasName "test"');
    expect(ontology).toContain('citty:hasDescription "Test command"');
    expect(ontology).toContain('citty:hasVersion "1.0.0"');
    expect(ontology).toContain("citty:hasType type:string");
    expect(ontology).toContain("citty:hasType type:boolean");
  });

  it("should generate ontology for command with subcommands", async () => {
    const command = defineCommand({
      meta: {
        name: "main",
        description: "Main command",
      },
      subCommands: {
        sub: defineCommand({
          meta: {
            name: "sub",
            description: "Sub command",
          },
          args: {
            flag: {
              type: "boolean",
              description: "A flag",
            },
          },
        }),
      },
    });

    const ontology = await toOntology(command);

    expect(ontology).toContain('citty:hasName "main"');
    expect(ontology).toContain('citty:hasName "sub"');
    expect(ontology).toContain("citty:hasSubCommand");
    expect(ontology).toContain("citty:hasArgument");
  });

  it("should generate simple ontology", async () => {
    const command = defineCommand({
      meta: {
        name: "simple",
        description: "Simple command",
      },
      args: {
        input: {
          type: "string",
          description: "Input file",
        },
      },
    });

    const ontology = await toSimpleOntology(command);

    expect(ontology).toContain("@prefix citty: <http://example.org/citty#>");
    expect(ontology).toContain("a citty:Command");
    expect(ontology).toContain("citty:hasArgument");
    expect(ontology).toContain("citty:Argument");
    expect(ontology).not.toContain("owl:Class");
  });

  it("should handle all argument types", async () => {
    const command = defineCommand({
      meta: {
        name: "all-types",
        description: "Command with all argument types",
      },
      args: {
        string: {
          type: "string",
          description: "String argument",
          default: "default",
          alias: "s",
        },
        number: {
          type: "number",
          description: "Number argument",
          required: true,
        },
        boolean: {
          type: "boolean",
          description: "Boolean argument",
          default: true,
        },
        enum: {
          type: "enum",
          description: "Enum argument",
          options: ["option1", "option2"],
        },
        positional: {
          type: "positional",
          description: "Positional argument",
          valueHint: "FILE",
        },
      },
    });

    const ontology = await toOntology(command);

    expect(ontology).toContain("citty:hasType type:string");
    expect(ontology).toContain("citty:hasType type:number");
    expect(ontology).toContain("citty:hasType type:boolean");
    expect(ontology).toContain("citty:hasType type:enum");
    expect(ontology).toContain("citty:hasType type:positional");
    expect(ontology).toContain('citty:hasAlias "s"');
    expect(ontology).toContain('citty:hasDefaultValue "default"');
    expect(ontology).toContain('citty:isRequired "true"^^xsd:boolean');
    expect(ontology).toContain('citty:hasValueHint "FILE"');
  });

  it("should escape special characters in strings", async () => {
    const command = defineCommand({
      meta: {
        name: "escape-test",
        description: 'Command with "quotes" and \n newlines',
      },
      args: {
        path: {
          type: "string",
          description: "Path with \\backslashes\\",
        },
      },
    });

    const ontology = await toOntology(command);

    expect(ontology).toContain(
      String.raw`citty:hasDescription "Command with \"quotes\" and \n newlines"`,
    );
    expect(ontology).toContain(
      String.raw`citty:hasDescription "Path with \\backslashes\\"`,
    );
  });
});
