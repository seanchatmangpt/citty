// packages/citty-pro/src/usage.ts
// Goal: produce help/usage that matches citty core semantics and look.
// Happy-path only. No heavy guards.

import { bold, dim, cyan, yellow } from "colorette";
import type { ArgsDef, ArgDef, CommandDef, Resolvable, CommandMeta } from "../types";

const r = async <T>(v: Resolvable<T>): Promise<T> =>
  (typeof v === "function" ? await (v as any)() : await v);

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const leftColWidth = (rows: Array<[string, string]>, min = 18) =>
  Math.max(min, ...rows.map(([l]) => l.length));

const flagToken = (name: string) => (name.length === 1 ? `-${name}` : `--${name}`);
const humanName = (k: string) => k.replace(/[_-]/g, "-");

const argUsageToken = (k: string, def: ArgDef) => {
  const key = humanName(k);
  if (def.type === "positional") return def.required ? `<${key}>` : `[${key}]`;
  if (def.type === "boolean") return `--${key}`;
  const val =
    def.type === "enum" ? `<${(def.options || []).join("|")}>` : `<${def.type || "value"}>`;
  return `--${key} ${val}`;
};

const argLine = (k: string, def: ArgDef) => {
  const key = humanName(k);
  const aliases: string[] = Array.isArray((def as any).alias)
    ? ((def as any).alias as string[])
    : (def as any).alias
    ? [String((def as any).alias)]
    : [];
  const flags = [
    ...aliases.map(flagToken),
    def.type === "positional" ? key : `--${key}`,
    def.type === "boolean" && (def as any).negativeDescription ? `--no-${key}` : null,
  ].filter(Boolean) as string[];
  const left = flags.join(", ");
  const parts: string[] = [];
  if ((def as any).description) parts.push(String((def as any).description));
  if (def.type === "enum" && (def as any).options?.length) {
    parts.push(dim(`one of: ${(def as any).options.join(", ")}`));
  }
  if ((def as any).required) parts.push(yellow("required"));
  if ((def as any).default !== undefined) parts.push(dim(`default: ${(def as any).default}`));
  if (def.type === "boolean" && (def as any).negativeDescription) {
    parts.push(dim(`negate: --no-${key} (${(def as any).negativeDescription})`));
  }
  return [left, parts.join(" | ")] as [string, string];
};

const buildUsageLine = async (
  meta: CommandMeta | undefined,
  namePath: string[],
  args?: ArgsDef,
  hasSub?: boolean,
) => {
  const bin = meta?.name || namePath.join(" ");
  const positional = Object.entries(args || {})
    .filter(([, d]) => d.type === "positional")
    .map(([k, d]) => argUsageToken(k, d))
    .join(" ");
  const opt = "[options]";
  const sub = hasSub ? "[command]" : "";
  return `${cyan("$")} ${bold(bin)} ${[sub, positional, opt].filter(Boolean).join(" ").trim()}`;
};

export async function showUsage<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  rawArgs: string[] = [],
  namePath: string[] = [],
) {
  const meta = await r(cmd.meta as any);
  const args = (await r(cmd.args as any)) || {};
  const subs = (await r(cmd.subCommands as any)) || {};

  const title = meta?.description ? `${bold(meta.description)}` : `${bold(meta?.name || namePath.join(" "))}`;
  console.log(title, "\n");

  const usage = await buildUsageLine(meta, namePath, args, Object.keys(subs).length > 0);
  console.log(bold("Usage"));
  console.log("  " + usage + "\n");

  if (Object.keys(subs).length) {
    console.log(bold("Commands"));
    const subRows = await Promise.all(
      Object.entries(subs).map(async ([name, sc]: any) => {
        const m = await r(sc.meta);
        return { name, desc: m?.description || "", hidden: !!m?.hidden };
      }),
    );
    const visible = subRows.filter((s) => !s.hidden);
    const rows: Array<[string, string]> = visible.map((s) => [s.name, s.desc]);
    const width = leftColWidth(rows);
    rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2));
    console.log();
  }

  const posEntries = Object.entries(args).filter(([, d]) => d.type === "positional");
  const flagEntries = Object.entries(args).filter(([, d]) => d.type !== "positional");

  if (posEntries.length) {
    console.log(bold("Positionals"));
    const rows = posEntries.map(([k, d]) => argLine(k, d));
    const width = leftColWidth(rows);
    rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2));
    console.log();
  }

  console.log(bold("Options"));
  const baseFlags: Array<[string, string]> = [
    ["-h, --help", "Show help"],
    ["--version", "Show version"],
  ];
  const argRows = flagEntries.map(([k, d]) => argLine(k, d));
  const rows = [...baseFlags, ...argRows];
  const width = leftColWidth(rows);
  rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2));
  console.log();

  if (meta?.version) {
    console.log(bold("Version"));
    console.log("  " + meta.version + "\n");
  }
  if (meta?.name) {
    console.log(dim(`Run '${meta.name} <command> -h' for command-specific help.`));
  }
}