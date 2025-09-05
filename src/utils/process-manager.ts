/**
 * Process Manager for Citty CLI
 * Handles robust process spawning, management, and cleanup
 */

import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { consola } from 'consola';
import { EventEmitter } from 'node:events';

export interface ProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdio?: 'pipe' | 'inherit' | 'ignore';
  shell?: boolean;
  detached?: boolean;
  uid?: number;
  gid?: number;
}

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  duration: number;
  command: string;
  args: string[];
}

export interface ProcessError extends Error {
  code: string;
  exitCode?: number;
  signal?: NodeJS.Signals;
  stdout?: string;
  stderr?: string;
  command?: string;
}

export class ProcessManager extends EventEmitter {
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private processCounter = 0;

  /**
   * Execute a command and return the result
   */
  async execute(
    command: string, 
    args: string[] = [], 
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const processId = this.generateProcessId();
    const startTime = Date.now();

    // Validate and prepare options
    const processOptions = this.prepareOptions(options);
    
    // Validate working directory
    if (processOptions.cwd && !existsSync(processOptions.cwd)) {
      throw this.createProcessError(
        `Working directory does not exist: ${processOptions.cwd}`,
        'ENOENT',
        command
      );
    }

    consola.debug(`[${processId}] Executing: ${command} ${args.join(' ')}`);
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      try {
        // Spawn the process
        const child = spawn(command, args, {
          cwd: processOptions.cwd ? resolve(processOptions.cwd) : process.cwd(),
          env: { ...process.env, ...processOptions.env },
          stdio: processOptions.stdio === 'pipe' ? ['inherit', 'pipe', 'pipe'] : processOptions.stdio,
          shell: processOptions.shell ?? (process.platform === 'win32'),
          detached: processOptions.detached ?? false,
          uid: processOptions.uid,
          gid: processOptions.gid,
        });

        // Store the process for potential cleanup
        this.runningProcesses.set(processId, child);

        // Set up timeout if specified
        if (processOptions.timeout && processOptions.timeout > 0) {
          timeoutHandle = setTimeout(() => {
            this.killProcess(processId, 'SIGTERM');
            const error = this.createProcessError(
              `Process timeout after ${processOptions.timeout}ms`,
              'TIMEOUT',
              command
            );
            reject(error);
          }, processOptions.timeout);
        }

        // Collect stdout/stderr if stdio is 'pipe'
        if (processOptions.stdio === 'pipe' || !processOptions.stdio) {
          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });
        }

        // Handle process events
        child.on('error', (error) => {
          this.cleanup(processId, timeoutHandle);
          const processError = this.createProcessError(
            `Failed to spawn process: ${error.message}`,
            'SPAWN_ERROR',
            command
          );
          processError.cause = error;
          reject(processError);
        });

        child.on('close', (exitCode, signal) => {
          this.cleanup(processId, timeoutHandle);
          
          const duration = Date.now() - startTime;
          
          const result: ProcessResult = {
            exitCode,
            signal,
            stdout,
            stderr,
            duration,
            command,
            args
          };

          this.emit('processComplete', { processId, result });
          
          if (exitCode === 0) {
            consola.debug(`[${processId}] Process completed successfully in ${duration}ms`);
            resolve(result);
          } else {
            const error = this.createProcessError(
              `Process failed with exit code ${exitCode}`,
              'NON_ZERO_EXIT',
              command
            );
            error.exitCode = exitCode || undefined;
            error.signal = signal || undefined;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          }
        });

        child.on('disconnect', () => {
          consola.debug(`[${processId}] Process disconnected`);
          this.emit('processDisconnected', { processId });
        });

        this.emit('processStarted', { processId, command, args, pid: child.pid });

      } catch (error) {
        this.cleanup(processId, timeoutHandle);
        const processError = this.createProcessError(
          `Failed to execute process: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'EXECUTION_ERROR',
          command
        );
        reject(processError);
      }
    });
  }

  /**
   * Execute a simple command string (splits by spaces)
   */
  async executeCommand(commandString: string, options: ProcessOptions = {}): Promise<ProcessResult> {
    const [command, ...args] = commandString.split(' ').filter(Boolean);
    
    if (!command) {
      throw this.createProcessError('Empty command provided', 'INVALID_COMMAND');
    }

    return this.execute(command, args, options);
  }

  /**
   * Kill a running process
   */
  killProcess(processId: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const process = this.runningProcesses.get(processId);
    
    if (!process) {
      consola.warn(`Process ${processId} not found or already terminated`);
      return false;
    }

    try {
      const killed = process.kill(signal);
      if (killed) {
        consola.debug(`[${processId}] Process killed with signal ${signal}`);
        this.emit('processKilled', { processId, signal });
      }
      return killed;
    } catch (error) {
      consola.error(`Failed to kill process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Kill all running processes
   */
  killAllProcesses(signal: NodeJS.Signals = 'SIGTERM'): void {
    consola.info(`Killing ${this.runningProcesses.size} running processes...`);
    
    for (const [processId] of this.runningProcesses) {
      this.killProcess(processId, signal);
    }
  }

  /**
   * Get list of running processes
   */
  getRunningProcesses(): Array<{ id: string; pid?: number }> {
    return Array.from(this.runningProcesses.entries()).map(([id, process]) => ({
      id,
      pid: process.pid
    }));
  }

  /**
   * Check if process is running
   */
  isProcessRunning(processId: string): boolean {
    const process = this.runningProcesses.get(processId);
    return process ? !process.killed : false;
  }

  /**
   * Wait for a process to complete with timeout
   */
  async waitForProcess(processId: string, timeout?: number): Promise<ProcessResult | null> {
    const process = this.runningProcesses.get(processId);
    
    if (!process) {
      return null;
    }

    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      if (timeout) {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Wait timeout after ${timeout}ms`));
        }, timeout);
      }

      // Listen for process completion
      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      };

      this.once('processComplete', (event) => {
        if (event.processId === processId) {
          cleanup();
          resolve(event.result);
        }
      });

      this.once('processKilled', (event) => {
        if (event.processId === processId) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  /**
   * Execute multiple commands in parallel
   */
  async executeParallel(
    commands: Array<{ command: string; args?: string[]; options?: ProcessOptions }>,
    options: { 
      maxConcurrency?: number;
      failFast?: boolean;
      timeout?: number;
    } = {}
  ): Promise<ProcessResult[]> {
    const { maxConcurrency = 5, failFast = false, timeout } = options;
    const results: ProcessResult[] = [];
    const errors: ProcessError[] = [];

    // Process commands in batches
    for (let i = 0; i < commands.length; i += maxConcurrency) {
      const batch = commands.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (cmd) => {
        try {
          const cmdOptions = timeout ? { ...cmd.options, timeout } : cmd.options;
          return await this.execute(cmd.command, cmd.args || [], cmdOptions || {});
        } catch (error) {
          if (failFast) {
            throw error;
          }
          errors.push(error as ProcessError);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is ProcessResult => result !== null));
    }

    if (errors.length > 0 && failFast) {
      throw errors[0];
    }

    return results;
  }

  /**
   * Execute commands in sequence
   */
  async executeSequential(
    commands: Array<{ command: string; args?: string[]; options?: ProcessOptions }>,
    options: { 
      stopOnError?: boolean;
      timeout?: number;
    } = {}
  ): Promise<ProcessResult[]> {
    const { stopOnError = true, timeout } = options;
    const results: ProcessResult[] = [];

    for (const cmd of commands) {
      try {
        const cmdOptions = timeout ? { ...cmd.options, timeout } : cmd.options;
        const result = await this.execute(cmd.command, cmd.args || [], cmdOptions || {});
        results.push(result);
      } catch (error) {
        if (stopOnError) {
          throw error;
        }
        consola.warn(`Command failed: ${cmd.command}`, error);
      }
    }

    return results;
  }

  /**
   * Cleanup process resources
   */
  private cleanup(processId: string, timeoutHandle: NodeJS.Timeout | null): void {
    this.runningProcesses.delete(processId);
    
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Prepare and validate process options
   */
  private prepareOptions(options: ProcessOptions): ProcessOptions {
    const defaultOptions: ProcessOptions = {
      stdio: 'inherit',
      timeout: 120000, // 2 minutes default
      shell: process.platform === 'win32',
      env: {}
    };

    return { ...defaultOptions, ...options };
  }

  /**
   * Create a standardized process error
   */
  private createProcessError(message: string, code: string, command?: string): ProcessError {
    const error = new Error(message) as ProcessError;
    error.code = code;
    error.command = command;
    error.name = 'ProcessError';
    return error;
  }

  /**
   * Generate unique process ID
   */
  private generateProcessId(): string {
    return `proc_${++this.processCounter}_${Date.now()}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout: number = 30000): Promise<void> {
    consola.info('Shutting down process manager...');
    
    if (this.runningProcesses.size === 0) {
      return;
    }

    // First try graceful termination
    this.killAllProcesses('SIGTERM');

    // Wait for processes to terminate
    const shutdownTimeout = setTimeout(() => {
      consola.warn('Forcefully killing remaining processes...');
      this.killAllProcesses('SIGKILL');
    }, timeout);

    // Wait for all processes to exit
    while (this.runningProcesses.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    clearTimeout(shutdownTimeout);
    consola.success('Process manager shutdown complete');
  }
}

// Export singleton instance
export const processManager = new ProcessManager();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  consola.info('Received SIGINT, shutting down processes...');
  await processManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  consola.info('Received SIGTERM, shutting down processes...');
  await processManager.shutdown();
  process.exit(0);
});

export default processManager;