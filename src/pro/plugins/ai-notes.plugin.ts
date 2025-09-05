// packages/citty-pro/src/plugins/ai-notes.plugin.ts
import { hooks } from '../hooks';
import type { Plugin, RunCtx } from '../../types/citty-pro';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export interface AINotesPluginOptions {
  logPath?: string;
  includeTimestamp?: boolean;
  includeContext?: boolean;
  maxLength?: number;
}

export function createAINotesPlugin(options: AINotesPluginOptions = {}): Plugin {
  const {
    logPath = '.citty-pro/notes.log',
    includeTimestamp = true,
    includeContext = true,
    maxLength = 500
  } = options;
  
  const write = async (path: string, data: string): Promise<void> => {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(path), { recursive: true });
      // Append to log file
      await fs.appendFile(path, data);
    } catch (error) {
      console.error('[AI Notes] Failed to write log:', error);
    }
  };
  
  return async (h, ctx: RunCtx) => {
    // Track command execution
    h.hook('command:resolved', async ({ name }) => {
      if (includeTimestamp) {
        const note = `[${new Date().toISOString()}] Command: ${name || 'unknown'}\n`;
        await write(logPath, note);
      }
    });
    
    // Track task executions
    h.hook('task:did:call', async ({ id, res }) => {
      const resultStr = JSON.stringify(res, null, 2);
      const truncated = resultStr.length > maxLength 
        ? resultStr.slice(0, maxLength) + '...[truncated]'
        : resultStr;
      
      const note = `  Task '${id}' completed: ${truncated}\n`;
      await write(logPath, note);
    });
    
    // Track workflow completions
    h.hook('workflow:compile', async ({ id }) => {
      const note = `  Workflow '${id}' compiled\n`;
      await write(logPath, note);
    });
    
    // Track output
    h.hook('output:did:emit', async ({ out }) => {
      const summary = out.text 
        ? out.text.slice(0, 120)
        : out.json 
        ? JSON.stringify(out.json).slice(0, 120)
        : 'No output';
      
      const note = `  Output: ${summary}\n`;
      await write(logPath, note);
    });
    
    // Generate summary report
    h.hook('report:did', async ({ out }) => {
      const timestamp = includeTimestamp ? new Date().toISOString() : '';
      const contextInfo = includeContext ? ` [cwd: ${ctx.cwd}]` : '';
      
      const summary = out.text || JSON.stringify(out.json || out).slice(0, 120);
      const note = `Run summary: ${timestamp}${contextInfo} :: ${summary}\n---\n`;
      
      await write(logPath, note);
    });
    
    // Track errors
    h.hook('cli:done', async () => {
      const note = `Session completed\n\n`;
      await write(logPath, note);
    });
  };
}

// Additional helper for reading notes
export async function readAINotes(logPath = '.citty-pro/notes.log'): Promise<string> {
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    return content;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return 'No notes found.';
    }
    throw error;
  }
}

// Helper to analyze notes with AI
export async function analyzeNotes(
  notes: string,
  aiGenerate?: (prompt: string) => Promise<string>
): Promise<string> {
  if (!aiGenerate) {
    // Basic analysis without AI
    const lines = notes.split('\n');
    const commands = lines.filter(l => l.includes('Command:')).length;
    const tasks = lines.filter(l => l.includes('Task')).length;
    const workflows = lines.filter(l => l.includes('Workflow')).length;
    
    return `Analysis: ${commands} commands, ${tasks} tasks, ${workflows} workflows executed.`;
  }
  
  // AI-powered analysis
  const prompt = `Analyze these CLI execution logs and provide insights:\n\n${notes}\n\nProvide:
1. Summary of activities
2. Performance patterns
3. Potential issues
4. Optimization suggestions`;
  
  return aiGenerate(prompt);
}