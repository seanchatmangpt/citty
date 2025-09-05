// packages/citty-pro/src/task.ts
import { hooks } from './hooks';
import type { TaskSpec, Task, RunCtx } from '../types/citty-pro';
import { z } from 'zod';

export function defineTask<TIn = unknown, TOut = unknown, Ctx extends RunCtx = RunCtx>(
  spec: TaskSpec<TIn, TOut, Ctx>
): Task<TIn, TOut, Ctx> {
  return {
    id: spec.id,
    async call(input: TIn, ctx: Ctx): Promise<TOut> {
      // Pre-call validation if schema provided
      let validatedInput = input;
      if (spec.in) {
        try {
          validatedInput = spec.in.parse(input) as TIn;
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Task ${spec.id} input validation failed: ${error.message}`);
          }
          throw error;
        }
      }
      
      // Call pre-hook
      await hooks.callHook('task:will:call', { 
        id: spec.id, 
        input: validatedInput 
      });
      
      // Execute task with timing
      const startTime = performance.now();
      let result: TOut;
      
      try {
        result = await spec.run(validatedInput, ctx);
        
        // Post-call validation if schema provided
        if (spec.out) {
          try {
            result = spec.out.parse(result) as TOut;
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(`Task ${spec.id} output validation failed: ${error.message}`);
            }
            throw error;
          }
        }
      } catch (error) {
        // Log error to hooks before rethrowing
        await hooks.callHook('task:did:call', { 
          id: spec.id, 
          res: { error: error instanceof Error ? error.message : String(error) }
        });
        throw error;
      }
      
      const duration = performance.now() - startTime;
      
      // Call post-hook with timing
      await hooks.callHook('task:did:call', { 
        id: spec.id, 
        res: { ...result as any, __duration: duration }
      });
      
      return result;
    }
  };
}