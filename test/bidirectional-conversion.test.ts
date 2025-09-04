import { expect, it, describe } from "vitest";
import { toOntology, fromOntology, defineCommand } from "../src";

describe("bidirectional conversion", () => {
  it("should maintain command structure in roundtrip conversion", async () => {
    const originalCommand = defineCommand({
      meta: {
        name: "test-command",
        description: "Test command for bidirectional conversion",
        version: "1.2.3",
        hidden: false,
      },
      args: {
        name: {
          type: "string",
          description: "Name argument",
          required: true,
          alias: ["n"],
        },
        verbose: {
          type: "boolean",
          description: "Verbose mode",
          default: false,
        },
        count: {
          type: "number",
          description: "Count number",
          default: 42,
          required: false,
        },
        format: {
          type: "enum",
          description: "Output format",
          options: ["json", "yaml", "xml"],
          default: "json",
        },
        file: {
          type: "positional",
          description: "Input file",
          valueHint: "FILE",
        },
      },
      subCommands: {
        init: defineCommand({
          meta: {
            name: "init",
            description: "Initialize project",
          },
          args: {
            force: {
              type: "boolean",
              description: "Force initialization",
              default: false,
            },
          },
        }),
      },
    });

    // Convert to ontology
    const ontology = await toOntology(originalCommand);
    console.log("Generated ontology:", ontology);

    // Verify ontology contains expected content
    expect(ontology).toContain('citty:hasName "test-command"');
    expect(ontology).toContain(
      'citty:hasDescription "Test command for bidirectional conversion"',
    );
    expect(ontology).toContain('citty:hasVersion "1.2.3"');
    expect(ontology).toContain('citty:hasDefaultValue "false"'); // boolean default
    expect(ontology).toContain('citty:hasDefaultValue "42"'); // number default
    expect(ontology).toContain('citty:hasDefaultValue "json"'); // string default

    // Convert back from ontology
    const reconstructedCode = await fromOntology(ontology, {
      template: "command",
      inlineSubcommands: true,
    });
    console.log("Reconstructed code:", reconstructedCode);

    // The reconstructed code should contain the original command structure
    expect(reconstructedCode).toContain("test-command");
    expect(reconstructedCode).toContain(
      "Test command for bidirectional conversion",
    );
    expect(reconstructedCode).toContain("1.2.3");
    expect(reconstructedCode).toContain("init");
    expect(reconstructedCode).toContain("Initialize project");
  });

  it("should handle numeric and boolean defaults correctly in ontology", async () => {
    const command = defineCommand({
      meta: {
        name: "defaults-test",
        description: "Test default values",
      },
      args: {
        enabled: {
          type: "boolean",
          description: "Enable feature",
          default: true,
        },
        disabled: {
          type: "boolean",
          description: "Disable feature",
          default: false,
        },
        port: {
          type: "number",
          description: "Port number",
          default: 8080,
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds",
          default: 30.5,
        },
        name: {
          type: "string",
          description: "Application name",
          default: "my-app",
        },
      },
    });

    const ontology = await toOntology(command);
    console.log("Ontology with defaults:", ontology);

    // Check that boolean values are properly quoted in the ontology
    expect(ontology).toContain('citty:hasDefaultValue "true"');
    expect(ontology).toContain('citty:hasDefaultValue "false"');
    expect(ontology).toContain('citty:hasDefaultValue "8080"');
    expect(ontology).toContain('citty:hasDefaultValue "30.5"');
    expect(ontology).toContain('citty:hasDefaultValue "my-app"');

    // Convert back and verify structure is maintained
    const code = await fromOntology(ontology);
    expect(code).toBeTruthy();
  });

  it("should handle subcommands correctly in roundtrip", async () => {
    const command = defineCommand({
      meta: {
        name: "main-cmd",
        description: "Main command",
      },
      subCommands: {
        sub1: defineCommand({
          meta: {
            name: "sub1",
            description: "First subcommand",
          },
          args: {
            flag: {
              type: "boolean",
              description: "A flag",
              default: true,
            },
          },
        }),
        sub2: defineCommand({
          meta: {
            name: "sub2",
            description: "Second subcommand",
          },
          args: {
            value: {
              type: "number",
              description: "A value",
              default: 123,
            },
          },
        }),
      },
    });

    const ontology = await toOntology(command);
    console.log("Subcommands ontology:", ontology);

    // Verify subcommand structure in ontology
    expect(ontology).toContain('citty:hasName "main-cmd"');
    expect(ontology).toContain('citty:hasName "sub1"');
    expect(ontology).toContain('citty:hasName "sub2"');
    expect(ontology).toContain("citty:hasSubCommand");

    const code = await fromOntology(ontology, { inlineSubcommands: true });
    console.log("Reconstructed subcommands code:", code);

    expect(code).toContain("main-cmd");
    expect(code).toContain("sub1");
    expect(code).toContain("sub2");
  });

  it("should handle error cases gracefully", async () => {
    const invalidOntology = `
      @prefix citty: <http://example.org/citty#> .
      # Invalid/incomplete ontology
    `;

    await expect(fromOntology(invalidOntology)).rejects.toThrow(
      "Failed to convert ontology to command",
    );

    // Test null/undefined input
    await expect(fromOntology("")).rejects.toThrow(
      "Valid Turtle ontology string is required",
    );

    // Test invalid command definition
    await expect(toOntology(undefined as any)).rejects.toThrow(
      "Failed to convert command to ontology",
    );
  });
});
