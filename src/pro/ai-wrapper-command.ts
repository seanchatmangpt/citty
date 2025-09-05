// packages/citty-pro/src/ai-wrapper-command.ts
import type { 
  AIWrapperCommandSpec, 
  Command, 
  ArgsDef, 
  RunCtx,
  Output,
  AITool
} from '../types/citty-pro';

export function defineAIWrapperCommand<T extends ArgsDef = ArgsDef, Ctx extends RunCtx = RunCtx>(
  spec: AIWrapperCommandSpec<T, Ctx>
): Command<T, Ctx> {
  return {
    meta: spec.meta,
    args: spec.args,
    async run({ args, ctx, cmd }) {
      // Generate plan if planner provided
      const planPrompt = spec.plan ? spec.plan(args, ctx) : null;
      
      // Create wrapped context with AI capabilities
      const wrappedCtx: Ctx = {
        ...ctx,
        ai: {
          model: spec.ai.model,
          async generate(opts) {
            // Use existing AI generator if available
            const baseGen = ctx?.ai?.generate;
            
            // Merge tools from spec and call-time
            const mergedTools = {
              ...(spec.ai.tools || {}),
              ...(opts.tools || {})
            };
            
            // Merge system prompts
            const systemPrompt = opts.system ?? spec.ai.system;
            
            // Call base generator or provide default
            let result: { text: string; toolCalls?: Array<{ name: string; args: unknown }> };
            
            if (baseGen) {
              result = await baseGen({
                prompt: opts.prompt,
                tools: mergedTools,
                system: systemPrompt
              });
            } else {
              // Default implementation for development
              console.log('[AI] Model:', spec.ai.model.id);
              console.log('[AI] Prompt:', opts.prompt);
              console.log('[AI] Tools:', Object.keys(mergedTools).join(', '));
              
              result = {
                text: `[Simulated AI response for: ${opts.prompt}]`,
                toolCalls: []
              };
            }
            
            // Handle tool calls if callback provided
            if (result.toolCalls && result.toolCalls.length > 0 && spec.onToolCall) {
              for (const toolCall of result.toolCalls) {
                await spec.onToolCall(toolCall.name, toolCall.args, wrappedCtx);
              }
            }
            
            return result;
          }
        }
      } as Ctx;
      
      // Execute plan generation if provided
      if (planPrompt && wrappedCtx.ai) {
        await wrappedCtx.ai.generate({ 
          prompt: planPrompt,
          tools: spec.ai.tools,
          system: spec.ai.system
        });
      }
      
      // Execute main command logic
      const output = await spec.run(args, wrappedCtx);
      
      return output;
    }
  };
}