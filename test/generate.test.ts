import { expect, it, describe, vi, beforeEach } from "vitest";
import { generateCommand } from "../src/commands/generate";
import { runCommand } from "../src/command";
import * as ai from "ai";
import * as ollamaProvider from "ollama-ai-provider-v2";
import * as fs from "node:fs";

// Mock dependencies
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  ollama: vi.fn(),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => "mocked template content"),
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
  dirname: vi.fn(() => "/mocked/dir"),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(() => "/mocked/file.js"),
}));

describe("generate command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct command structure", () => {
    expect(generateCommand.meta?.name).toBe("generate");
    expect(generateCommand.meta?.description).toBe(
      "Generate CLI commands using Ollama AI provider",
    );
    expect(generateCommand.meta?.version).toBe("1.0.0");
    expect(typeof generateCommand.run).toBe("function");
  });

  it("should have correct arguments configuration", () => {
    expect(generateCommand.args?.prompt).toEqual({
      type: "string",
      description: "Description of the CLI command you want to generate",
      required: true,
      valueHint:
        '"Create a file management CLI with list, copy, and delete commands"',
    });

    expect(generateCommand.args?.model).toEqual({
      type: "string",
      description: "Ollama model to use for generation",
      default: "llama3.2",
      alias: ["m"],
      valueHint: "model-name",
    });

    expect(generateCommand.args?.format).toEqual({
      type: "enum",
      description: "Output format: ontology only or complete files",
      options: ["ontology", "files"],
      default: "ontology",
      alias: ["f"],
    });

    expect(generateCommand.args?.temperature).toEqual({
      type: "number",
      description: "AI generation temperature (0.0-1.0)",
      default: 0.3,
      alias: ["t"],
    });

    expect(generateCommand.args?.verbose).toEqual({
      type: "boolean",
      description: "Enable verbose output",
      default: false,
      alias: ["v"],
    });
  });

  it("should generate ontology format successfully", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    // Mock AI response with a valid command definition
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        meta: {
          name: "file-manager",
          description: "A CLI for file management operations",
          version: "1.0.0",
        },
        args: {
          path: {
            type: "string",
            description: "Target path for operations",
            required: true,
          },
          verbose: {
            type: "boolean",
            description: "Enable verbose output",
            default: false,
            alias: ["v"],
          },
        },
      }),
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("mocked-model" as any);

    // Spy on console.log to capture output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(generateCommand, {
      rawArgs: [
        "--prompt",
        "Create a file management CLI",
        "--format",
        "ontology",
      ],
    });

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: "mocked-model",
      system: expect.stringContaining("CLI command generator"),
      prompt: "Create a CLI command for: Create a file management CLI",
      temperature: 0.3,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "🔄 Generating command structure...",
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "🔄 Converting to ontology format...",
    );
    expect(consoleSpy).toHaveBeenCalledWith("✓ Generated ontology:");

    consoleSpy.mockRestore();
  });

  it("should handle files format with output directory", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);
    const mockWriteFileSync = vi.mocked(fs.writeFileSync);
    const mockMkdirSync = vi.mocked(fs.mkdirSync);

    // Mock AI response
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        meta: {
          name: "test-cli",
          description: "A test CLI command",
          version: "1.0.0",
        },
        args: {
          input: {
            type: "string",
            description: "Input file",
            required: true,
          },
        },
      }),
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("mocked-model" as any);

    // Spy on console.log to capture output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(generateCommand, {
      rawArgs: [
        "--prompt",
        "Create a test CLI",
        "--format",
        "files",
        "--output",
        "./test-output",
      ],
    });

    expect(mockMkdirSync).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("ontology.ttl"),
      expect.any(String),
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("test-cli.ts"),
      expect.any(String),
    );

    consoleSpy.mockRestore();
  });

  it("should handle custom model and temperature", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        meta: {
          name: "custom-cli",
          description: "A custom CLI",
          version: "1.0.0",
        },
      }),
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("custom-model" as any);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(generateCommand, {
      rawArgs: [
        "--prompt",
        "Create a custom CLI",
        "--model",
        "custom-model",
        "--temperature",
        "0.7",
      ],
    });

    expect(mockOllama).toHaveBeenCalledWith("custom-model");
    expect(mockGenerateText).toHaveBeenCalledWith({
      model: "custom-model",
      system: expect.any(String),
      prompt: "Create a CLI command for: Create a custom CLI",
      temperature: 0.7,
    });

    consoleSpy.mockRestore();
  });

  it("should handle verbose output", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    const mockCommandDef = {
      meta: {
        name: "verbose-cli",
        description: "A verbose CLI command",
        version: "1.0.0",
      },
    };

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(mockCommandDef),
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("mocked-model" as any);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(generateCommand, {
      rawArgs: ["--prompt", "Create a verbose CLI", "--verbose"],
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("🤖 Generating CLI command with Ollama model:"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("📝 Prompt:"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("✓ Generated command definition:"),
    );

    consoleSpy.mockRestore();
  });

  it("should handle AI generation errors", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    mockGenerateText.mockRejectedValue(new Error("AI service unavailable"));
    mockOllama.mockReturnValue("mocked-model" as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(async () => {
      await runCommand(generateCommand, {
        rawArgs: ["--prompt", "Create a CLI"],
      });
    }).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Generation failed:",
      expect.stringContaining("Failed to generate CLI command"),
    );

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should handle invalid AI responses", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    // Mock invalid response (no JSON)
    mockGenerateText.mockResolvedValue({
      text: "This is not a valid JSON response",
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("mocked-model" as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(async () => {
      await runCommand(generateCommand, {
        rawArgs: ["--prompt", "Create a CLI"],
      });
    }).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Generation failed:",
      expect.stringContaining("No valid JSON found"),
    );

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should require output directory for files format", async () => {
    const mockGenerateText = vi.mocked(ai.generateText);
    const mockOllama = vi.mocked(ollamaProvider.ollama);

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        meta: { name: "test", description: "test", version: "1.0.0" },
      }),
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200 },
    });

    mockOllama.mockReturnValue("mocked-model" as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(async () => {
      await runCommand(generateCommand, {
        rawArgs: ["--prompt", "Create a CLI", "--format", "files"],
      });
    }).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Generation failed:",
      "Output directory is required when format is 'files'",
    );

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});
