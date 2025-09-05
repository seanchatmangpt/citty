/**
 * Progress indicators and success messaging for CLI operations
 */
import { consola } from 'consola';
import colors from 'picocolors';

export interface ProgressStep {
  id: string;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  details?: string;
}

export class ProgressIndicator {
  private steps: ProgressStep[] = [];
  private currentStep?: string;
  private startTime: number;

  constructor(private verbose: boolean = false) {
    this.startTime = Date.now();
  }

  /**
   * Add a new step to track
   */
  addStep(id: string, message: string): void {
    this.steps.push({
      id,
      message,
      status: 'pending'
    });
  }

  /**
   * Start executing a step
   */
  startStep(id: string): void {
    const step = this.steps.find(s => s.id === id);
    if (!step) return;

    step.status = 'running';
    step.startTime = Date.now();
    this.currentStep = id;

    if (this.verbose) {
      consola.start(colors.blue(`⏳ ${step.message}...`));
    }
  }

  /**
   * Complete a step successfully
   */
  completeStep(id: string, details?: string): void {
    const step = this.steps.find(s => s.id === id);
    if (!step) return;

    step.status = 'completed';
    step.endTime = Date.now();
    step.details = details;
    
    const duration = step.startTime ? step.endTime - step.startTime : 0;
    const durationText = duration > 0 ? colors.dim(` (${duration}ms)`) : '';
    
    consola.success(colors.green(`✅ ${step.message}${durationText}`));
    
    if (details && this.verbose) {
      consola.info(colors.dim(`   ${details}`));
    }
  }

  /**
   * Mark a step as failed
   */
  failStep(id: string, error: string): void {
    const step = this.steps.find(s => s.id === id);
    if (!step) return;

    step.status = 'failed';
    step.endTime = Date.now();
    step.details = error;

    consola.error(colors.red(`❌ ${step.message} failed`));
    consola.error(colors.dim(`   ${error}`));
  }

  /**
   * Show overall progress
   */
  showProgress(): void {
    if (!this.verbose) return;

    const completed = this.steps.filter(s => s.status === 'completed').length;
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const total = this.steps.length;

    if (total === 0) return;

    const percentage = Math.round((completed / total) * 100);
    const progressBar = this.createProgressBar(completed, total);

    console.log('');
    console.log(colors.bold(`📊 Progress: ${completed}/${total} (${percentage}%)`));
    console.log(colors.dim(`   ${progressBar}`));
    
    if (failed > 0) {
      console.log(colors.red(`   ${failed} step(s) failed`));
    }
    
    console.log('');
  }

  /**
   * Show final summary
   */
  showSummary(): void {
    const totalTime = Date.now() - this.startTime;
    const completed = this.steps.filter(s => s.status === 'completed').length;
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const total = this.steps.length;

    console.log('');
    console.log(colors.bold('📋 Summary:'));
    
    if (completed > 0) {
      console.log(colors.green(`   ✅ ${completed} step(s) completed successfully`));
    }
    
    if (failed > 0) {
      console.log(colors.red(`   ❌ ${failed} step(s) failed`));
      
      // Show failed steps
      const failedSteps = this.steps.filter(s => s.status === 'failed');
      failedSteps.forEach(step => {
        console.log(colors.red(`      • ${step.message}: ${step.details}`));
      });
    }
    
    console.log(colors.dim(`   ⏱️  Total time: ${totalTime}ms`));
    
    if (this.verbose && this.steps.length > 0) {
      console.log('');
      console.log(colors.bold('🔍 Detailed breakdown:'));
      this.steps.forEach(step => {
        const status = this.getStatusIcon(step.status);
        const duration = step.startTime && step.endTime 
          ? ` (${step.endTime - step.startTime}ms)`
          : '';
        console.log(`   ${status} ${step.message}${duration}`);
      });
    }
    
    console.log('');
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(completed: number, total: number, width: number = 20): string {
    const percentage = completed / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    
    return colors.green('█'.repeat(filled)) + colors.dim('░'.repeat(empty));
  }

  /**
   * Get status icon for step
   */
  private getStatusIcon(status: ProgressStep['status']): string {
    switch (status) {
      case 'completed': return colors.green('✅');
      case 'failed': return colors.red('❌');
      case 'running': return colors.yellow('⏳');
      case 'pending': return colors.dim('⏸️');
      default: return colors.dim('?');
    }
  }

  /**
   * Show operation success with context
   */
  static showSuccess(operation: string, details?: {
    files?: string[];
    duration?: number;
    size?: string;
    location?: string;
  }): void {
    console.log('');
    consola.success(colors.green(colors.bold(`🎉 ${operation} completed successfully!`)));
    
    if (details) {
      if (details.files && details.files.length > 0) {
        console.log('');
        console.log(colors.bold('📁 Generated files:'));
        details.files.forEach(file => {
          console.log(colors.dim(`   • ${file}`));
        });
      }
      
      if (details.location) {
        console.log('');\n        console.log(colors.bold('📍 Location: ') + colors.cyan(details.location));
      }
      
      if (details.duration) {
        console.log(colors.dim(`⏱️  Completed in ${details.duration}ms`));
      }
      
      if (details.size) {
        console.log(colors.dim(`📊 Total size: ${details.size}`));
      }
    }
    
    console.log('');
  }

  /**
   * Show helpful next steps after operation
   */
  static showNextSteps(steps: string[]): void {
    if (steps.length === 0) return;
    
    console.log(colors.bold('🚀 Next steps:'));
    steps.forEach((step, index) => {
      console.log(colors.dim(`   ${index + 1}. ${step}`));
    });
    console.log('');
  }

  /**
   * Show tips related to the completed operation
   */
  static showTips(tips: string[]): void {
    if (tips.length === 0) return;
    
    console.log(colors.bold('💡 Tips:'));
    tips.forEach(tip => {
      console.log(colors.dim(`   • ${tip}`));
    });
    console.log('');
  }

  /**
   * Spinner for long-running operations
   */
  static async withSpinner<T>(
    operation: () => Promise<T>,
    message: string
  ): Promise<T> {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    // Simple spinner implementation
    const interval = setInterval(() => {
      process.stdout.write(`\\r${colors.blue(frames[frameIndex])} ${message}...`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 80);
    
    try {
      const result = await operation();
      clearInterval(interval);
      process.stdout.write(`\\r${colors.green('✅')} ${message}\\n`);
      return result;
    } catch (error) {
      clearInterval(interval);
      process.stdout.write(`\\r${colors.red('❌')} ${message} failed\\n`);
      throw error;
    }
  }
}
export { ProgressIndicator };
