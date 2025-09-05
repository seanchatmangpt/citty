/**
 * Development Tools and Debugging Utilities
 * Comprehensive debugging and development assistance tools for Citty CLIs
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'pathe';
import { inspect } from 'util';
import { performance } from 'perf_hooks';

export interface DebugSession {
  id: string;
  startTime: number;
  events: DebugEvent[];
  metadata: Record<string, any>;
}

export interface DebugEvent {
  timestamp: number;
  type: 'command' | 'argument' | 'error' | 'performance' | 'custom';
  data: any;
  context?: string;
}

export class DebugLogger {
  private session: DebugSession;
  private isEnabled: boolean = false;
  
  constructor(sessionId?: string) {
    this.session = {
      id: sessionId || `debug-${Date.now()}`,
      startTime: Date.now(),
      events: [],
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };
  }
  
  enable() {
    this.isEnabled = true;
    console.log(`🔍 Debug session started: ${this.session.id}`);
  }
  
  disable() {
    this.isEnabled = false;
    console.log(`🔒 Debug session ended: ${this.session.id}`);
  }
  
  log(type: DebugEvent['type'], data: any, context?: string) {
    if (!this.isEnabled) return;
    
    const event: DebugEvent = {
      timestamp: Date.now() - this.session.startTime,
      type,
      data,
      context
    };
    
    this.session.events.push(event);
    
    // Real-time logging
    const typeEmoji = {
      command: '💻',
      argument: '📝',
      error: '❌',
      performance: '⏱️',
      custom: '🔧'
    };
    
    console.log(
      `${typeEmoji[type]} [${event.timestamp}ms] ${context || type}:`,
      inspect(data, { colors: true, depth: 3 })
    );
  }
  
  async export(filePath?: string) {
    const outputPath = filePath || `debug-${this.session.id}.json`;
    await writeFile(outputPath, JSON.stringify(this.session, null, 2));
    console.log(`💾 Debug session exported to: ${outputPath}`);
    return outputPath;
  }
  
  getStats() {
    const eventCounts = this.session.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      sessionId: this.session.id,
      duration: Date.now() - this.session.startTime,
      eventCounts,
      totalEvents: this.session.events.length
    };
  }
}

// Global debug logger instance
export const debugLogger = new DebugLogger();

/**
 * Performance Profiler
 */
export class PerformanceProfiler {
  private marks = new Map<string, number>();
  private measures: Array<{ name: string; duration: number; timestamp: number }> = [];
  
  mark(name: string) {
    this.marks.set(name, performance.now());
    debugLogger.log('performance', { action: 'mark', name }, 'profiler');
  }
  
  measure(name: string, startMark?: string, endMark?: string) {
    const startTime = startMark ? this.marks.get(startMark) : this.marks.get(`${name}-start`);
    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    
    if (startTime === undefined) {
      throw new Error(`Start mark not found: ${startMark || `${name}-start`}`);
    }
    
    const duration = endTime - startTime;
    const measure = {
      name,
      duration,
      timestamp: Date.now()
    };
    
    this.measures.push(measure);
    debugLogger.log('performance', measure, 'profiler');
    
    return duration;
  }
  
  getMeasures() {
    return [...this.measures];
  }
  
  getSummary() {
    if (this.measures.length === 0) return null;
    
    const totalDuration = this.measures.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = totalDuration / this.measures.length;
    const slowest = this.measures.reduce((max, m) => m.duration > max.duration ? m : max);
    
    return {
      totalMeasures: this.measures.length,
      totalDuration,
      avgDuration,
      slowest
    };
  }
  
  reset() {
    this.marks.clear();
    this.measures = [];
  }
}

export const profiler = new PerformanceProfiler();

/**
 * Command Inspector
 */
export class CommandInspector {
  static inspect(command: any) {
    const info = {
      meta: command.meta || {},
      args: command.args || {},
      subCommands: Object.keys(command.subCommands || {}),
      hasSetup: typeof command.setup === 'function',
      hasRun: typeof command.run === 'function'
    };
    
    console.log('🔍 Command Structure:');
    console.log(inspect(info, { colors: true, depth: 4 }));
    
    return info;
  }
  
  static validateCommand(command: any) {
    const issues: string[] = [];
    
    if (!command.meta) {
      issues.push('Missing meta object');
    } else {
      if (!command.meta.name) issues.push('Missing meta.name');
      if (!command.meta.description) issues.push('Missing meta.description');
    }
    
    if (!command.run && !command.subCommands) {
      issues.push('Command must have either run function or subCommands');
    }
    
    if (command.args) {
      for (const [argName, argConfig] of Object.entries(command.args)) {
        if (typeof argConfig !== 'object') {
          issues.push(`Invalid argument config for '${argName}'`);
        }
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

/**
 * Argument Validator and Debugger
 */
export class ArgumentDebugger {
  static debug(args: Record<string, any>, commandArgs: Record<string, any>) {
    console.log('📝 Argument Analysis:');
    console.log('Received args:', inspect(args, { colors: true }));
    console.log('Expected args:', inspect(commandArgs, { colors: true }));
    
    // Check for missing required args
    const missing = [];
    const extra = [];
    const typeErrors = [];
    
    for (const [name, config] of Object.entries(commandArgs)) {
      if (config.required && !(name in args)) {
        missing.push(name);
      }
      
      if (name in args) {
        const value = args[name];
        const expectedType = config.type;
        
        if (expectedType === 'boolean' && typeof value !== 'boolean') {
          typeErrors.push(`${name}: expected boolean, got ${typeof value}`);
        }
        if (expectedType === 'string' && typeof value !== 'string') {
          typeErrors.push(`${name}: expected string, got ${typeof value}`);
        }
      }
    }
    
    for (const name in args) {
      if (!(name in commandArgs)) {
        extra.push(name);
      }
    }
    
    if (missing.length) console.log('❌ Missing required:', missing);
    if (extra.length) console.log('⚠️  Extra arguments:', extra);
    if (typeErrors.length) console.log('❌ Type errors:', typeErrors);
    
    if (!missing.length && !typeErrors.length) {
      console.log('✅ All arguments valid');
    }
    
    return { missing, extra, typeErrors };
  }
}

/**
 * Debug Commands
 */
export const debugCommand = defineCommand({
  meta: {
    name: 'debug',
    description: 'Development and debugging tools'
  },
  subCommands: {
    start: defineCommand({
      meta: {
        name: 'start',
        description: 'Start debug session'
      },
      args: {
        session: {
          type: 'string',
          description: 'Session ID'
        }
      },
      run({ args }) {
        if (args.session) {
          debugLogger.session.id = args.session;
        }
        debugLogger.enable();
      }
    }),
    
    stop: defineCommand({
      meta: {
        name: 'stop',
        description: 'Stop debug session'
      },
      args: {
        export: {
          type: 'string',
          description: 'Export session to file'
        }
      },
      async run({ args }) {
        if (args.export) {
          await debugLogger.export(args.export);
        }
        debugLogger.disable();
      }
    }),
    
    stats: defineCommand({
      meta: {
        name: 'stats',
        description: 'Show debug session statistics'
      },
      run() {
        const stats = debugLogger.getStats();
        console.log('📊 Debug Session Stats:');
        console.log(inspect(stats, { colors: true }));
        
        const perfSummary = profiler.getSummary();
        if (perfSummary) {
          console.log('\n⏱️ Performance Summary:');
          console.log(inspect(perfSummary, { colors: true }));
        }
      }
    }),
    
    inspect: defineCommand({
      meta: {
        name: 'inspect',
        description: 'Inspect command structure'
      },
      args: {
        command: {
          type: 'string',
          description: 'Command file to inspect',
          required: true
        }
      },
      async run({ args }) {
        try {
          const commandModule = await import(args.command);
          const command = commandModule.default || commandModule;
          
          CommandInspector.inspect(command);
          
          const validation = CommandInspector.validateCommand(command);
          if (validation.isValid) {
            console.log('\n✅ Command validation passed');
          } else {
            console.log('\n❌ Command validation failed:');
            validation.issues.forEach(issue => console.log(`  - ${issue}`));
          }
        } catch (error) {
          console.error('❌ Failed to load command:', error.message);
        }
      }
    }),
    
    profile: defineCommand({
      meta: {
        name: 'profile',
        description: 'Performance profiling tools'
      },
      subCommands: {
        start: defineCommand({
          meta: {
            name: 'start',
            description: 'Start performance profiling'
          },
          args: {
            name: {
              type: 'string',
              description: 'Profile name',
              required: true
            }
          },
          run({ args }) {
            profiler.mark(`${args.name}-start`);
            console.log(`⏱️ Started profiling: ${args.name}`);
          }
        }),
        
        end: defineCommand({
          meta: {
            name: 'end',
            description: 'End performance profiling'
          },
          args: {
            name: {
              type: 'string',
              description: 'Profile name',
              required: true
            }
          },
          run({ args }) {
            try {
              const duration = profiler.measure(args.name);
              console.log(`⏱️ Profile '${args.name}' completed: ${duration.toFixed(2)}ms`);
            } catch (error) {
              console.error(`❌ Failed to end profile: ${error.message}`);
            }
          }
        }),
        
        summary: defineCommand({
          meta: {
            name: 'summary',
            description: 'Show profiling summary'
          },
          run() {
            const summary = profiler.getSummary();
            if (summary) {
              console.log('📊 Profiling Summary:');
              console.log(inspect(summary, { colors: true }));
              
              const measures = profiler.getMeasures();
              console.log('\nAll measures:');
              measures.forEach(m => {
                console.log(`  ${m.name}: ${m.duration.toFixed(2)}ms`);
              });
            } else {
              console.log('📊 No profiling data available');
            }
          }
        })
      }
    }),
    
    memory: defineCommand({
      meta: {
        name: 'memory',
        description: 'Memory usage analysis'
      },
      run() {
        const usage = process.memoryUsage();
        const formatBytes = (bytes: number) => {
          const mb = bytes / 1024 / 1024;
          return `${mb.toFixed(2)} MB`;
        };
        
        console.log('🧠 Memory Usage:');
        console.log(`  Heap Used: ${formatBytes(usage.heapUsed)}`);
        console.log(`  Heap Total: ${formatBytes(usage.heapTotal)}`);
        console.log(`  External: ${formatBytes(usage.external)}`);
        console.log(`  RSS: ${formatBytes(usage.rss)}`);
        
        // Garbage collection stats if available
        if (global.gc) {
          console.log('\n🗞️ Running garbage collection...');
          global.gc();
          const afterGC = process.memoryUsage();
          console.log(`  Heap Used after GC: ${formatBytes(afterGC.heapUsed)}`);
          console.log(`  Freed: ${formatBytes(usage.heapUsed - afterGC.heapUsed)}`);
        }
      }
    }),
    
    trace: defineCommand({
      meta: {
        name: 'trace',
        description: 'Execution tracing'
      },
      args: {
        command: {
          type: 'string',
          description: 'Command to trace',
          required: true
        }
      },
      async run({ args }) {
        console.log(`🔍 Tracing execution of: ${args.command}`);
        
        // Enable debug logging
        debugLogger.enable();
        
        // Start profiling
        profiler.mark('trace-start');
        
        try {
          // Execute command (simplified - would integrate with actual CLI execution)
          const startTime = performance.now();
          
          // Command execution would go here
          console.log(`Executing: ${args.command}`);
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          console.log(`\n✅ Trace completed in ${duration.toFixed(2)}ms`);
          
          // Show debug stats
          const stats = debugLogger.getStats();
          console.log('Debug events:', stats.totalEvents);
          
        } catch (error) {
          console.error(`❌ Trace failed: ${error.message}`);
        } finally {
          debugLogger.disable();
        }
      }
    })
  }
});

/**
 * Debug Middleware
 */
export function withDebug<T extends (...args: any[]) => any>(fn: T, name?: string): T {
  return ((...args: any[]) => {
    const functionName = name || fn.name || 'anonymous';
    
    debugLogger.log('command', {
      function: functionName,
      args: args.map(arg => typeof arg === 'object' ? inspect(arg) : arg)
    });
    
    profiler.mark(`${functionName}-start`);
    
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then(res => {
            profiler.measure(functionName);
            debugLogger.log('command', { function: functionName, result: 'success' });
            return res;
          })
          .catch(error => {
            profiler.measure(functionName);
            debugLogger.log('error', { function: functionName, error: error.message });
            throw error;
          });
      } else {
        profiler.measure(functionName);
        debugLogger.log('command', { function: functionName, result: 'success' });
        return result;
      }
    } catch (error) {
      profiler.measure(functionName);
      debugLogger.log('error', { function: functionName, error: error.message });
      throw error;
    }
  }) as T;
}

/**
 * Environment Debugger
 */
export const envDebugger = {
  checkEnvironment() {
    console.log('🌍 Environment Check:');
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log(`CWD: ${process.cwd()}`);
    console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Check important environment variables
    const importantVars = ['NODE_ENV', 'PATH', 'HOME', 'USER'];
    console.log('\nEnvironment Variables:');
    importantVars.forEach(varName => {
      const value = process.env[varName];
      console.log(`  ${varName}: ${value || '(not set)'}`);
    });
  },
  
  checkDependencies() {
    console.log('\n📦 Checking Dependencies:');
    
    const requiredDeps = ['citty'];
    
    for (const dep of requiredDeps) {
      try {
        const pkg = require(`${dep}/package.json`);
        console.log(`✅ ${dep}@${pkg.version}`);
      } catch {
        console.log(`❌ ${dep} (not found)`);
      }
    }
  }
};
