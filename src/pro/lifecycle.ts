// packages/citty-pro/src/lifecycle.ts
import { hooks } from './hooks';
import type { RunLifecycleOptions, RunCtx, Output, ArgsDef } from '../types/citty-pro';

export async function runLifecycle<TArgs extends ArgsDef = ArgsDef, Ctx extends RunCtx = RunCtx>({
  cmd,
  args,
  ctx,
  runStep
}: RunLifecycleOptions<TArgs, Ctx>): Promise<void> {
  try {
    // Phase 1: Boot
    await hooks.callHook('cli:boot', { argv: process.argv.slice(2) });
    
    // Phase 2: Configuration
    const config = { 
      cwd: process.cwd(),
      env: process.env,
      ...((ctx as any)?.config || {})
    };
    await hooks.callHook('config:load', { config });
    
    // Phase 3: Context setup
    const baseCtx: RunCtx = {
      cwd: config.cwd as string,
      env: config.env as Record<string, string | undefined>,
      now: () => new Date(),
      ...(ctx as any)
    };
    await hooks.callHook('ctx:ready', { ctx: baseCtx });
    
    // Phase 4: Arguments
    await hooks.callHook('args:parsed', { args: args as any });
    
    // Phase 5: Command resolution
    await hooks.callHook('command:resolved', { 
      name: cmd?.meta?.name || 'unknown' 
    });
    
    // Phase 6: Workflow compilation
    await hooks.callHook('workflow:compile', { 
      id: cmd?.meta?.name || 'workflow' 
    });
    
    // Phase 7: Execution
    const out = await runStep(baseCtx as Ctx);
    
    // Phase 8: Output emission
    await hooks.callHook('output:will:emit', { out });
    
    if (out?.text) {
      console.log(out.text);
    } else if ((out as any)?.json) {
      console.log(JSON.stringify((out as any).json, null, 2));
    }
    
    await hooks.callHook('output:did:emit', { out });
    
    // Phase 9: Persistence
    await hooks.callHook('persist:will', { out });
    await hooks.callHook('persist:did', { ok: true });
    
    // Phase 10: Reporting
    await hooks.callHook('report:will', { out });
    await hooks.callHook('report:did', { ok: true });
    
    // Phase 11: Completion
    await hooks.callHook('cli:done', null);
    
  } catch (error) {
    // Error handling with hooks
    const errorOutput: Output = {
      text: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
    
    await hooks.callHook('output:will:emit', { out: errorOutput });
    console.error(errorOutput.text);
    await hooks.callHook('output:did:emit', { out: errorOutput });
    
    throw error;
  }
}