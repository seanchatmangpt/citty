/**
 * Tests for Process Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processManager } from '../../src/utils/process-manager.js';

describe('ProcessManager', () => {
  beforeEach(() => {
    // Reset any running processes
    processManager.killAllProcesses();
  });

  afterEach(async () => {
    // Cleanup after each test
    processManager.killAllProcesses();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('execute', () => {
    it('should execute a simple command successfully', async () => {
      const result = await processManager.execute('echo', ['hello world']);
      
      expect(result.exitCode).toBe(0);
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello world']);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle command failure', async () => {
      await expect(
        processManager.execute('false')
      ).rejects.toThrow(/Process failed with exit code/);
    });

    it('should handle non-existent command', async () => {
      await expect(
        processManager.execute('nonexistentcommand12345')
      ).rejects.toThrow(/Failed to spawn process/);
    });

    it('should timeout long-running commands', async () => {
      await expect(
        processManager.execute('sleep', ['10'], { timeout: 100 })
      ).rejects.toThrow(/Process timeout/);
    }, 10000);

    it('should validate working directory', async () => {
      await expect(
        processManager.execute('echo', ['test'], { 
          cwd: '/nonexistent/directory' 
        })
      ).rejects.toThrow(/Working directory does not exist/);
    });
  });

  describe('executeCommand', () => {
    it('should execute command string', async () => {
      const result = await processManager.executeCommand('echo hello');
      expect(result.exitCode).toBe(0);
    });

    it('should handle empty command', async () => {
      await expect(
        processManager.executeCommand('')
      ).rejects.toThrow(/Empty command provided/);
    });
  });

  describe('executeParallel', () => {
    it('should execute multiple commands in parallel', async () => {
      const commands = [
        { command: 'echo', args: ['test1'] },
        { command: 'echo', args: ['test2'] },
        { command: 'echo', args: ['test3'] }
      ];

      const results = await processManager.executeParallel(commands);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    });

    it('should handle parallel failures with failFast=false', async () => {
      const commands = [
        { command: 'echo', args: ['success'] },
        { command: 'false' },
        { command: 'echo', args: ['success2'] }
      ];

      const results = await processManager.executeParallel(commands, {
        failFast: false
      });
      
      // Should get results for successful commands only
      expect(results.length).toBeGreaterThan(0);
    });

    it('should fail fast when failFast=true', async () => {
      const commands = [
        { command: 'false' },
        { command: 'echo', args: ['should not run'] }
      ];

      await expect(
        processManager.executeParallel(commands, { failFast: true })
      ).rejects.toThrow();
    });
  });

  describe('executeSequential', () => {
    it('should execute commands in sequence', async () => {
      const commands = [
        { command: 'echo', args: ['first'] },
        { command: 'echo', args: ['second'] },
        { command: 'echo', args: ['third'] }
      ];

      const results = await processManager.executeSequential(commands);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    });

    it('should stop on error when stopOnError=true', async () => {
      const commands = [
        { command: 'echo', args: ['first'] },
        { command: 'false' },
        { command: 'echo', args: ['should not run'] }
      ];

      await expect(
        processManager.executeSequential(commands, { stopOnError: true })
      ).rejects.toThrow();
    });

    it('should continue on error when stopOnError=false', async () => {
      const commands = [
        { command: 'echo', args: ['first'] },
        { command: 'false' },
        { command: 'echo', args: ['third'] }
      ];

      const results = await processManager.executeSequential(commands, {
        stopOnError: false
      });
      
      // Should get 2 successful results
      expect(results).toHaveLength(2);
    });
  });

  describe('process management', () => {
    it('should track running processes', async () => {
      // Start a long-running process
      const promise = processManager.execute('sleep', ['1']);
      
      // Check that it's tracked
      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses.length).toBeGreaterThan(0);
      
      // Wait for completion
      await promise;
      
      // Should be removed from tracking
      const finalProcesses = processManager.getRunningProcesses();
      expect(finalProcesses.length).toBe(0);
    });

    it('should kill running processes', async () => {
      // Start a long-running process
      const promise = processManager.execute('sleep', ['5']);
      
      // Get the process ID
      const processes = processManager.getRunningProcesses();
      expect(processes.length).toBe(1);
      
      const processId = processes[0].id;
      
      // Kill it
      const killed = processManager.killProcess(processId);
      expect(killed).toBe(true);
      
      // Should reject the promise
      await expect(promise).rejects.toThrow();
    }, 10000);

    it('should handle graceful shutdown', async () => {
      // Start multiple processes
      const promises = [
        processManager.execute('sleep', ['2']),
        processManager.execute('sleep', ['2'])
      ];
      
      // Should have running processes
      expect(processManager.getRunningProcesses().length).toBe(2);
      
      // Shutdown with short timeout
      const shutdownPromise = processManager.shutdown(1000);
      
      // Wait for shutdown
      await shutdownPromise;
      
      // Processes should be terminated
      expect(processManager.getRunningProcesses().length).toBe(0);
      
      // Original promises should be rejected
      await expect(Promise.all(promises)).rejects.toThrow();
    }, 15000);
  });

  describe('options handling', () => {
    it('should handle custom environment variables', async () => {
      const result = await processManager.execute('node', ['-e', 'console.log(process.env.TEST_VAR)'], {
        env: { TEST_VAR: 'test_value' },
        stdio: 'pipe'
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test_value');
    });

    it('should handle different stdio options', async () => {
      // Test with pipe stdio
      const result = await processManager.execute('echo', ['test'], {
        stdio: 'pipe'
      });
      
      expect(result.stdout).toContain('test');
    });

    it('should handle shell option', async () => {
      // Test shell command
      const result = await processManager.execute('echo $HOME', [], {
        shell: true,
        stdio: 'pipe'
      });
      
      expect(result.exitCode).toBe(0);
    });
  });
});