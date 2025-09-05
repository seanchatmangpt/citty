// packages/citty-pro/src/main.ts - Corrected happy-path implementation
import consola from "consola";
import type { ArgsDef, CommandDef } from "../types";
import { resolveSubCommand, runCommand } from "../command";
import { showUsage as _showUsage } from "./usage";

export interface RunMainOptions {
  rawArgs?: string[];
  showUsage?: typeof _showUsage;
}

export async function runMain<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  opts: RunMainOptions = {},
) {
  const rawArgs = opts.rawArgs || process.argv.slice(2);
  const showUsage = opts.showUsage || _showUsage;

  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    await showUsage(...(await resolveSubCommand(cmd, rawArgs)));
    return;
  }

  if (rawArgs.length === 1 && rawArgs[0] === "--version") {
    const meta = typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta;
    consola.log(meta!.version as string);
    return;
  }

  await runCommand(cmd, { rawArgs });
}

export function createMain<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
): (opts?: RunMainOptions) => Promise<void> {
  return (opts: RunMainOptions = {}) => runMain(cmd, opts);
}