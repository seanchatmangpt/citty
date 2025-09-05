/**
 * Readline Helper for Citty CLI
 * Provides cross-platform readline functionality with proper cleanup
 */

import { createInterface, Interface } from 'node:readline';
import { EventEmitter } from 'node:events';

class ReadlineHelper extends EventEmitter {
  private rl: Interface | null = null;
  private isActive = false;

  /**
   * Get or create readline interface
   */
  private getInterface(): Interface {
    if (!this.rl || this.rl.closed) {
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });

      // Handle readline events
      this.rl.on('close', () => {
        this.isActive = false;
        this.emit('close');
      });

      this.rl.on('SIGINT', () => {
        this.emit('interrupt');
        this.cleanup();
        process.exit(130); // Standard SIGINT exit code
      });

      this.isActive = true;
    }

    return this.rl;
  }

  /**
   * Ask a question and wait for answer
   */
  async question(query: string): Promise<string> {
    const rl = this.getInterface();
    
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Read a line of input
   */
  async readLine(): Promise<string> {
    const rl = this.getInterface();

    return new Promise((resolve) => {
      rl.once('line', (line) => {
        resolve(line);
      });
    });
  }

  /**
   * Cleanup readline interface
   */
  cleanup(): void {
    if (this.rl && !this.rl.closed) {
      this.rl.close();
      this.rl = null;
      this.isActive = false;
      this.emit('cleanup');
    }
  }

  /**
   * Check if readline is active
   */
  isReadlineActive(): boolean {
    return this.isActive;
  }

  /**
   * Pause readline
   */
  pause(): void {
    if (this.rl) {
      this.rl.pause();
    }
  }

  /**
   * Resume readline
   */
  resume(): void {
    if (this.rl) {
      this.rl.resume();
    }
  }

  /**
   * Clear the current line
   */
  clearLine(): void {
    if (process.stdout.clearLine) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  /**
   * Move cursor to position
   */
  moveCursor(dx: number, dy: number): void {
    if (process.stdout.moveCursor) {
      process.stdout.moveCursor(dx, dy);
    }
  }

  /**
   * Write text without newline
   */
  write(text: string): void {
    process.stdout.write(text);
  }
}

// Export singleton instance
export const readlineInterface = new ReadlineHelper();

// Setup cleanup on process exit
process.on('exit', () => {
  readlineInterface.cleanup();
});

process.on('SIGINT', () => {
  readlineInterface.cleanup();
});

process.on('SIGTERM', () => {
  readlineInterface.cleanup();
});

export default readlineInterface;