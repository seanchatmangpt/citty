You said:
import consola from "consola";
import type { ArgsDef, CommandDef } from "./types";
import { resolveSubCommand, runCommand } from "./command";
import { CLIError } from "./_utils";
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
  try {
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      await showUsage(...(await resolveSubCommand(cmd, rawArgs)));
      process.exit(0);
    } else if (rawArgs.length === 1 && rawArgs[0] === "--version") {
      const meta =
        typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta;
      if (!meta?.version) {
        throw new CLIError("No version specified", "E_NO_VERSION");
      }
      consola.log(meta.version);
    } else {
      await runCommand(cmd, { rawArgs });
    }
  } catch (error: any) {
    const isCLIError = error instanceof CLIError;
    if (isCLIError) {
      await showUsage(...(await resolveSubCommand(cmd, rawArgs)));
      consola.error(error.message);
    } else {
      consola.error(error, "\n");
    }
    process.exit(1);
  }
}

export function createMain<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
): (opts?: RunMainOptions) => Promise<void> {
  return (opts: RunMainOptions = {}) => runMain(cmd, opts);
}


// packages/citty-pro/src/usage.ts
// Goal: produce help/usage that matches citty core semantics and look.
// Happy-path only. No heavy guards.

import { bold, dim, cyan, yellow } from "colorette"
import type { ArgsDef, ArgDef, CommandDef, Resolvable, CommandMeta } from "./types"

const r = async <T>(v: Resolvable<T>): Promise<T> => (typeof v === "function" ? await (v as any)() : await v)

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))
const leftColWidth = (rows: Array<[string, string]>, min = 18) =>
  Math.max(min, ...rows.map(([l]) => l.length))

const flagToken = (name: string) => (name.length === 1 ? -${name} : --${name})
const humanName = (k: string) => k.replace(/[_-]/g, "-")

const argUsageToken = (k: string, def: ArgDef) => {
  const key = humanName(k)
  if (def.type === "positional") return def.required ? <${key}> : [${key}]
  if (def.type === "boolean") return --${key}
  const val = def.type === "enum" ? <${(def.options || []).join("|")}> : <${def.type || "value"}>
  return --${key} ${val}
}

const argLine = (k: string, def: ArgDef) => {
  const key = humanName(k)
  const aliases: string[] = Array.isArray((def as any).alias)
    ? ((def as any).alias as string[])
    : (def as any).alias
      ? [String((def as any).alias)]
      : []
  const flags = [
    ...aliases.map(flagToken),
    def.type === "positional" ? key : --${key},
    def.type === "boolean" && (def as any).negativeDescription ? --no-${key} : null
  ].filter(Boolean) as string[]
  const left = flags.join(", ")
  const parts: string[] = []
  if ((def as any).description) parts.push(String((def as any).description))
  if (def.type === "enum" && (def as any).options?.length) {
    parts.push(dim(one of: ${(def as any).options.join(", ")}))
  }
  if ((def as any).required) parts.push(yellow("required"))
  if ((def as any).default !== undefined) parts.push(dim(default: ${(def as any).default}))
  if (def.type === "boolean" && (def as any).negativeDescription) {
    parts.push(dim(negate: --no-${key} (${(def as any).negativeDescription})))
  }
  return [left, parts.join(" | ")] as [string, string]
}

const buildUsageLine = async (meta: CommandMeta | undefined, namePath: string[], args?: ArgsDef, hasSub?: boolean) => {
  const bin = meta?.name || namePath.join(" ")
  const positional = Object.entries(args || {})
    .filter(([, d]) => d.type === "positional")
    .map(([k, d]) => argUsageToken(k, d))
    .join(" ")
  const opt = "[options]"
  const sub = hasSub ? "[command]" : ""
  return ${cyan("$")} ${bold(bin)} ${[sub, positional, opt].filter(Boolean).join(" ").trim()}
}

export async function showUsage<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  rawArgs: string[] = [],
  namePath: string[] = []
) {
  const meta = await r(cmd.meta as any)
  const args = (await r(cmd.args as any)) || {}
  const subs = (await r(cmd.subCommands as any)) || {}

  const title = meta?.description ? ${bold(meta?.description)} : ${bold(meta?.name || namePath.join(" "))}
  console.log(title, "\n")

  const usage = await buildUsageLine(meta, namePath, args, Object.keys(subs).length > 0)
  console.log(bold("Usage"))
  console.log("  " + usage + "\n")

  if (Object.keys(subs).length) {
    console.log(bold("Commands"))
    const rows = await Promise.all(
      Object.entries(subs)
        .filter(([, c]: any) => !r((c as any).meta)?.hidden)
        .map(async ([name, sc]: any) => {
          const m = await r(sc.meta)
          const left = name
          const right = m?.description || ""
          return [left, right] as [string, string]
        })
    )
    const width = leftColWidth(rows)
    rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2))
    console.log()
  }

  // Positional first, then flags
  const posEntries = Object.entries(args).filter(([, d]) => d.type === "positional")
  const flagEntries = Object.entries(args).filter(([, d]) => d.type !== "positional")

  if (posEntries.length) {
    console.log(bold("Positionals"))
    const rows = posEntries.map(([k, d]) => argLine(k, d))
    const width = leftColWidth(rows)
    rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2))
    console.log()
  }

  console.log(bold("Options"))
  const baseFlags: Array<[string, string]> = [
    ["-h, --help", "Show help"],
    ["--version", "Show version"]
  ]
  const argRows = flagEntries.map(([k, d]) => argLine(k, d))
  const rows = [...baseFlags, ...argRows]
  const width = leftColWidth(rows)
  rows.forEach(([l, r2]) => console.log("  " + pad(l, width) + "  " + r2))
  console.log()

  if (meta?.version) {
    console.log(bold("Version"))
    console.log("  " + meta.version + "\n")
  }
  if (meta?.name) {
    console.log(dim(Run '${meta.name} <command> -h' for command-specific help.))
  }
}

Citty pro is just a sketch
ChatGPT said:
Thought for 39s

Here’s a corrected, happy-path cut. Drop-in replacements.

// packages/citty-pro/src/main.ts

import consola from "consola";
import type { ArgsDef, CommandDef } from "./types";
import { resolveSubCommand, runCommand } from "./command";
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

// packages/citty-pro/src/usage.ts
// Goal: produce help/usage that matches citty core semantics and look.
// Happy-path only. No heavy guards.

import { bold, dim, cyan, yellow } from "colorette";
import type { ArgsDef, ArgDef, CommandDef, Resolvable, CommandMeta } from "./types";

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

You said:
// citty-pro.d.ts — ready types (defineTask, defineWorkflow, defineAIWrapperCommand, plugins, lifecycle)

import type { ZodTypeAny, z } from "zod"

// ---------- Core context ----------

export type Output = { text?: string; json?: unknown; files?: string[] }
export type Unhook = () => void

export type ProviderAIModel = {
  id: string
  vendor: "ollama" | "openai" | "anthropic" | "local"
  options?: Record<string, unknown>
}

export type RunCtx = {
  cwd: string
  env: Record<string, string | undefined>
  now: () => Date
  ai?: {
    model: ProviderAIModel
    generate: (opts: {
      prompt: string
      tools?: Record<string, AITool<any, any>>
      system?: string
    }) => Promise<{ text: string; toolCalls?: Array<{ name: string; args: unknown }> }>
  }
  otel?: {
    span: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>
    counter?: (name: string) => { add: (n: number) => void }
  }
  fs?: {
    read: (p: string) => Promise<string>
    write: (p: string, data: string | Uint8Array) => Promise<void>
    exists: (p: string) => Promise<boolean>
  }
  memo?: Record<string, unknown>
}

// ---------- Hooks ----------

export type HookPayload = {
  "cli:boot": { argv: string[] }
  "config:load": { config: Record<string, unknown> }
  "ctx:ready": { ctx: RunCtx }
  "args:parsed": { args: Record<string, unknown> }
  "command:resolved": { name?: string }
  "workflow:compile": { id: string }
  "task:will:call": { id: string; input: unknown }
  "task:did:call": { id: string; res: unknown }
  "output:will:emit": { out: Output }
  "output:did:emit": { out: Output }
  "persist:will": { out: Output }
  "persist:did": { ok: boolean }
  "report:will": { out: Output }
  "report:did": { ok: boolean }
  "cli:done": null
}

export type HookName = keyof HookPayload

export interface Hooks {
  hook<K extends HookName>(name: K, fn: (p: HookPayload[K]) => any | Promise<any>): Unhook
  callHook<K extends HookName>(name: K, payload: HookPayload[K]): Promise<void>
}

// ---------- Tasks ----------

export interface TaskSpec<TIn, TOut, Ctx = RunCtx> {
  id: string
  in?: ZodTypeAny // zod schema for validation (optional)
  out?: ZodTypeAny
  run: (input: TIn, ctx: Ctx) => Promise<TOut> | TOut
}

export interface Task<TIn, TOut, Ctx = RunCtx> {
  id: string
  call: (input: TIn, ctx: Ctx) => Promise<TOut>
}

export function defineTask<TIn = unknown, TOut = unknown, Ctx = RunCtx>(
  spec: TaskSpec<TIn, TOut, Ctx>
): Task<TIn, TOut, Ctx>

// ---------- Workflows ----------

export type StepFn<I, O, Ctx> = (input: I, ctx: Ctx) => Promise<O> | O

export type StepSpec<State, K extends string, O, Ctx> = {
  id: K
  use: Task<any, O, Ctx> | StepFn<any, O, Ctx>
  select?: (state: State, ctx: Ctx) => any
  as?: K
}

export type WorkflowSeed<State, Ctx> = State | ((ctx: Ctx) => State)

export interface Workflow<State, Ctx = RunCtx> {
  id: string
  run: (ctx: Ctx) => Promise<State>
}

// helper: accumulate state with step output under key
export type WithKey<S, K extends string, V> = S & Record<K, V>

export function defineWorkflow<
  Ctx = RunCtx,
  S0 extends Record<string, any> = Record<string, any>,
  S1K extends string = string,
  S1V = unknown
>(spec: {
  id: string
  seed?: WorkflowSeed<S0, Ctx>
  steps: ReadonlyArray<StepSpec<any, S1K, S1V, Ctx>>
}): Workflow<WithKey<S0, S1K, S1V>, Ctx>

// ---------- AI wrappers ----------

export type AITool<P extends ZodTypeAny = ZodTypeAny, R = any> = {
  description?: string
  schema: P
  execute: (input: z.infer<P>, ctx: RunCtx) => Promise<R> | R
}

export type AIWrapperOptions = {
  model: ProviderAIModel
  tools?: Record<string, AITool<any, any>>
  system?: string
}

// ---------- Commands (thin citty wrapper) ----------

export type ArgType = "boolean" | "string" | "number" | "enum" | "positional" | undefined

export type ArgDef =
  | ({ type: "boolean"; description?: string; alias?: string | string[]; default?: boolean; required?: boolean } & { negativeDescription?: string })
  | { type: "string"; description?: string; alias?: string | string[]; default?: string; required?: boolean }
  | { type: "number"; description?: string; alias?: string | string[]; default?: number; required?: boolean }
  | { type: "enum"; description?: string; alias?: string | string[]; options: (string | number)[]; default?: string; required?: boolean }
  | { type: "positional"; description?: string; valueHint?: string; required?: boolean }

export type ArgsDef = Record<string, ArgDef>
export type ParsedArgs<T extends ArgsDef> = Record<string, any> & { _: string[] }

export type CommandMeta = { name?: string; version?: string; description?: string; hidden?: boolean }

export interface Command<T extends ArgsDef = ArgsDef, Ctx = RunCtx> {
  meta?: CommandMeta
  args?: T
  run: (ctx: { rawArgs: string[]; args: ParsedArgs<T>; cmd: Command<T>; data?: any } & { ctx: Ctx }) => Promise<any> | any
}

export type AIWrapperCommandSpec<T extends ArgsDef, Ctx> = {
  meta?: CommandMeta
  args?: T
  ai: AIWrapperOptions
  plan?: (args: ParsedArgs<T>, ctx: Ctx) => string // optional planner prompt
  onToolCall?: (name: string, input: unknown, ctx: Ctx) => void | Promise<void>
  run: (args: ParsedArgs<T>, ctx: Ctx) => Promise<Output> | Output
}

export function defineAIWrapperCommand<T extends ArgsDef = ArgsDef, Ctx = RunCtx>(
  spec: AIWrapperCommandSpec<T, Ctx>
): Command<T, Ctx>

// ---------- Plugins ----------

export type Plugin = (h: Hooks, ctx: RunCtx) => void | Promise<void>

export interface LifecycleAPI {
  hooks: Hooks
  withCtx: <T>(ctx: RunCtx, fn: () => Promise<T> | T) => Promise<T>
}

export type PersistAdapter = {
  write: (p: string, data: string | Uint8Array) => Promise<void>
  read?: (p: string) => Promise<string>
}

export type ReportAdapter = {
  brief: (out: Output, ctx: RunCtx) => Promise<void> | void
}

// ---------- Orchestration helpers ----------

export type RunLifecycleOptions<TArgs extends ArgsDef, Ctx> = {
  cmd: Command<TArgs, Ctx>
  args: ParsedArgs<TArgs>
  ctx: Ctx
  runStep: (ctx: Ctx) => Promise<Output> | Output
}

export function runLifecycle<TArgs extends ArgsDef = ArgsDef, Ctx = RunCtx>(
  opts: RunLifecycleOptions<TArgs, Ctx>
): Promise<void>

// ---------- Exports surface ----------

export declare const cittyPro: {
  defineTask: typeof defineTask
  defineWorkflow: typeof defineWorkflow
  defineAIWrapperCommand: typeof defineAIWrapperCommand
  runLifecycle: typeof runLifecycle
}


Lifecycle below. JS-only. Happy path. Hookable-powered. Drop-in for citty-pro.

Lifecycle phases and hooks
	1.	cli:boot
	2.	config:load
	3.	ctx:ready
	4.	args:parsed
	5.	command:resolved
	6.	workflow:compile
	7.	task:will:call
	8.	task:did:call
	9.	output:will:emit
	10.	output:did:emit
	11.	persist:will
	12.	persist:did
	13.	report:will
	14.	report:did
	15.	cli:done

Minimal wiring

// hooks.js
import { createHooks } from 'hookable'
export const hooks = createHooks()

export function registerCoreHooks() {
  hooks.beforeEach((e) => { /* no-op */ })
  hooks.afterEach((e) => { /* no-op */ })
}

// lifecycle.js
import { hooks } from './hooks.js'

export async function runLifecycle({ cmd, args, runStep }) {
  await hooks.callHook('cli:boot', { argv: process.argv })
  const config = { cwd: process.cwd() }
  await hooks.callHook('config:load', { config })

  const ctx = { config, cmd, args }
  await hooks.callHook('ctx:ready', ctx)

  await hooks.callHook('args:parsed', { args })
  await hooks.callHook('command:resolved', { name: cmd.meta?.name })

  await hooks.callHook('workflow:compile', { cmd, args })

  const out = await runStep(ctx) // your command run
  await hooks.callHook('output:will:emit', { out })
  console.log(out?.text || out?.summary || '')
  await hooks.callHook('output:did:emit', { out })

  await hooks.callHook('persist:will', { out })
  await hooks.callHook('persist:did', { ok: true })

  await hooks.callHook('report:will', { out })
  await hooks.callHook('report:did', { ok: true })

  await hooks.callHook('cli:done', null)
}

// plugin-example-otel.js
import { hooks } from './hooks.js'

export function useOtelPlugin({ tracer, meter }) {
  hooks.hook('cli:boot', () => { meter.counter = meter.createCounter('cli_runs') })
  hooks.hook('ctx:ready', () => { meter.counter.add(1) })
  hooks.hook('task:will:call', ({ id }) => { tracer.startActiveSpan(task:${id}) })
  hooks.hook('task:did:call', () => { tracer.getActiveSpan()?.end?.() })
}

// plugin-example-ai-notes.js
import { hooks } from './hooks.js'
export function useAINotes({ write }) {
  hooks.hook('report:did', async ({ out }) => {
    const note = Run summary: ${new Date().toISOString()} :: ${JSON.stringify(out).slice(0,120)}
    await write('.citty-pro/notes.log', note + '\n')
  })
}

Binding tasks/workflows to hooks

// task.js
import { hooks } from './hooks.js'

export function defineTask({ id, run }) {
  return {
    id,
    async call(input, ctx) {
      await hooks.callHook('task:will:call', { id, input })
      const res = await run(input, ctx)
      await hooks.callHook('task:did:call', { id, res })
      return res
    }
  }
}

// workflow.js
export function defineWorkflow({ id, steps, seed }) {
  return {
    id,
    async run(ctx) {
      const state = typeof seed === 'function' ? seed(ctx) : (seed || {})
      for (const step of steps) {
        const input = step.select ? step.select(state, ctx) : state
        const out = await step.use.call(input, ctx)
        state[step.as || step.id] = out
      }
      return state
    }
  }
}

Citty command wrapper calling lifecycle

// cli.js
import { defineCommand, runMain } from 'citty'
import { runLifecycle } from './lifecycle.js'
import { registerCoreHooks } from './hooks.js'
import { defineTask } from './task.js'
import { defineWorkflow } from './workflow.js'

registerCoreHooks()

const briefTask = defineTask({
  id: 'brief',
  run: ({ text }) => ({ text: OK: ${text} })
})

const wf = defineWorkflow({
  id: 'single',
  steps: [{ id: 'brief', use: briefTask, select: (s) => s }]
})

const cmd = defineCommand({
  meta: { name: 'demo', description: 'Demo lifecycle' },
  args: { text: { type: 'string', required: true } },
  async run({ args }) {
    await runLifecycle({
      cmd,
      args,
      runStep: async () => wf.run({ text: args.text })
    })
  }
})

runMain(cmd)

Typical plugin touchpoints
	•	Pre-run analytics: cli:boot, ctx:ready
	•	Planning: workflow:compile
	•	Per-task timing and tracing: task:*
	•	Emission/persist: output:*, persist:*
	•	Post-run summaries: report:*, cli:done

This gives you a stable, observable CLI lifecycle. You can add or remove plugins without touching commands, tasks, or workflows.
ChatGPT said:
Thought for 1m 5s

Drop-in JS. Happy path. ESM.

// packages/citty-pro/src/hooks.js
import { createHooks } from 'hookable'

export const hooks = createHooks()

export function registerCoreHooks() {
  hooks.beforeEach(() => {})
  hooks.afterEach(() => {})
}

// packages/citty-pro/src/lifecycle.js
import { hooks } from './hooks.js'

export async function runLifecycle({ cmd, args, ctx, runStep }) {
  await hooks.callHook('cli:boot', { argv: process.argv.slice(2) })

  const config = { cwd: process.cwd() }
  await hooks.callHook('config:load', { config })

  const baseCtx = ctx || { config }
  await hooks.callHook('ctx:ready', baseCtx)

  await hooks.callHook('args:parsed', { args })
  await hooks.callHook('command:resolved', { name: cmd?.meta?.name })

  await hooks.callHook('workflow:compile', { id: cmd?.meta?.name || 'workflow' })

  const out = await runStep(baseCtx)

  await hooks.callHook('output:will:emit', { out })
  if (out?.text) console.log(out.text)
  await hooks.callHook('output:did:emit', { out })

  await hooks.callHook('persist:will', { out })
  await hooks.callHook('persist:did', { ok: true })

  await hooks.callHook('report:will', { out })
  await hooks.callHook('report:did', { ok: true })

  await hooks.callHook('cli:done', null)
}

// packages/citty-pro/src/task.js
import { hooks } from './hooks.js'

export function defineTask({ id, run }) {
  return {
    id,
    async call(input, ctx) {
      await hooks.callHook('task:will:call', { id, input })
      const res = await run(input, ctx)
      await hooks.callHook('task:did:call', { id, res })
      return res
    }
  }
}

// packages/citty-pro/src/workflow.js
export function defineWorkflow({ id, steps, seed }) {
  return {
    id,
    async run(ctx) {
      const state = typeof seed === 'function' ? seed(ctx) : (seed || {})
      for (const step of steps) {
        const input = step.select ? step.select(state, ctx) : state
        const use = step.use
        const out = typeof use.call === 'function' && use.id
          ? await use.call(input, ctx)
          : await use(input, ctx)
        state[step.as || step.id] = out
      }
      return state
    }
  }
}

// packages/citty-pro/src/ai-wrapper-command.js
export function defineAIWrapperCommand(spec) {
  return {
    meta: spec.meta,
    args: spec.args,
    async run({ args, ctx, cmd }) {
      const planPrompt = spec.plan ? spec.plan(args, ctx) : null
      const wrappedCtx = {
        ...ctx,
        ai: {
          model: spec.ai.model,
          tools: spec.ai.tools || {},
          system: spec.ai.system,
          generate: async (opts) => {
            const baseGen = ctx?.ai?.generate
            const merged = {
              prompt: opts.prompt,
              tools: { ...(spec.ai.tools || {}), ...(opts.tools || {}) },
              system: opts.system ?? spec.ai.system
            }
            const res = baseGen ? await baseGen(merged) : { text: '' }
            if (res.toolCalls?.length && spec.onToolCall) {
              for (const tc of res.toolCalls) {
                await spec.onToolCall(tc.name, tc.args, wrappedCtx)
              }
            }
            return res
          }
        }
      }
      if (planPrompt) {
        await wrappedCtx.ai.generate({ prompt: planPrompt })
      }
      return await spec.run(args, wrappedCtx)
    }
  }
}

// packages/citty-pro/src/index.js
export { hooks, registerCoreHooks } from './hooks.js'
export { runLifecycle } from './lifecycle.js'
export { defineTask } from './task.js'
export { defineWorkflow } from './workflow.js'
export { defineAIWrapperCommand } from './ai-wrapper-command.js'

export const cittyPro = {
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle
}

// packages/citty-pro/examples/plugin-example-otel.js
import { hooks } from '../src/hooks.js'

export function useOtelPlugin({ tracer, meter }) {
  hooks.hook('cli:boot', () => { meter.counter = meter.createCounter('cli_runs') })
  hooks.hook('ctx:ready', () => { meter.counter.add(1) })
  hooks.hook('task:will:call', ({ id }) => { tracer.startActiveSpan(`task:${id}`) })
  hooks.hook('task:did:call', () => { tracer.getActiveSpan()?.end?.() })
}

// packages/citty-pro/examples/plugin-example-ai-notes.js
import { hooks } from '../src/hooks.js'

export function useAINotes({ write }) {
  hooks.hook('report:did', async ({ out }) => {
    const note = `Run summary: ${new Date().toISOString()} :: ${JSON.stringify(out).slice(0,120)}`
    await write('.citty-pro/notes.log', note + '\n')
  })
}

// packages/citty-pro/examples/cli.js
import { defineCommand } from 'citty'
import { runLifecycle } from '../src/lifecycle.js'
import { registerCoreHooks } from '../src/hooks.js'
import { defineTask } from '../src/task.js'
import { defineWorkflow } from '../src/workflow.js'

registerCoreHooks()

const briefTask = defineTask({
  id: 'brief',
  run: ({ text }) => ({ text: `OK: ${text}` })
})

const wf = defineWorkflow({
  id: 'single',
  steps: [{ id: 'brief', use: briefTask, select: (s) => s }]
})

const cmd = defineCommand({
  meta: { name: 'demo', description: 'Demo lifecycle' },
  args: { text: { type: 'string', required: true } },
  async run({ args }) {
    await runLifecycle({
      cmd,
      args,
      runStep: async () => wf.run({ text: args.text })
    })
  }
})

export default cmd