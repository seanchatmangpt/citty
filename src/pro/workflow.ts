// packages/citty-pro/src/workflow.ts
import type { Workflow, WorkflowSeed, StepSpec, RunCtx, WithKey, Task, StepFn } from '../types/citty-pro';

export function defineWorkflow<
  Ctx extends RunCtx = RunCtx,
  S0 extends Record<string, any> = Record<string, any>,
  S1K extends string = string,
  S1V = unknown
>(spec: {
  id: string;
  seed?: WorkflowSeed<S0, Ctx>;
  steps: ReadonlyArray<StepSpec<any, S1K, S1V, Ctx>>;
}): Workflow<WithKey<S0, S1K, S1V>, Ctx> {
  return {
    id: spec.id,
    async run(ctx: Ctx): Promise<WithKey<S0, S1K, S1V>> {
      // Initialize state from seed
      let state: any = typeof spec.seed === 'function' 
        ? spec.seed(ctx) 
        : (spec.seed || {});
      
      // Execute steps sequentially
      for (const step of spec.steps) {
        // Select input for step
        const input = step.select 
          ? step.select(state, ctx) 
          : state;
        
        // Determine if use is a Task or function
        const use = step.use;
        let output: any;
        
        if (typeof use === 'function') {
          // Direct function execution
          output = await (use as StepFn<any, any, Ctx>)(input, ctx);
        } else if (use && typeof (use as Task<any, any, Ctx>).call === 'function') {
          // Task execution
          const task = use as Task<any, any, Ctx>;
          output = await task.call(input, ctx);
        } else {
          throw new Error(`Invalid step.use in workflow ${spec.id}, step ${step.id}`);
        }
        
        // Store output in state
        const key = step.as || step.id;
        state[key] = output;
      }
      
      return state as WithKey<S0, S1K, S1V>;
    }
  };
}