import { expect, it, describe } from "vitest";
import {
  defineCommand,
  runCommand,
  parseArgs,
  renderUsage,
  showUsage,
  runMain,
  createMain,
  generateCommand,
} from "../src";

describe("citty exports", () => {
  it("should export all main functions", () => {
    expect(defineCommand).toBeDefined();
    expect(runCommand).toBeDefined();
    expect(parseArgs).toBeDefined();
    expect(renderUsage).toBeDefined();
    expect(showUsage).toBeDefined();
    expect(runMain).toBeDefined();
    expect(createMain).toBeDefined();
    expect(generateCommand).toBeDefined();
  });

  it("should be able to use parseArgs function", () => {
    const result = parseArgs(["--name", "test"], {
      name: { type: "string" },
    });
    expect(result).toEqual({ name: "test", _: [] });
  });

  it("should be able to use defineCommand function", () => {
    const command = defineCommand({
      name: "test",
      run: () => Promise.resolve(),
    });
    expect(command.name).toBe("test");
    expect(typeof command.run).toBe("function");
  });

  it("should be able to use runCommand function", async () => {
    const command = defineCommand({
      name: "test",
      run: () => Promise.resolve("success"),
    });

    const result = await runCommand(command, { rawArgs: [] });
    expect(result.result).toBe("success");
  });
});
