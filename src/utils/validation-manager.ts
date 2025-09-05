/**
 * Validation Manager for Citty CLI
 * Handles input validation, user feedback, and interactive prompts
 */

import { consola } from 'consola';
import colors from 'picocolors';
import { readlineInterface } from './readline-helper.js';

export interface ValidationRule {
  name: string;
  validate: (value: any) => boolean | string;
  message?: string;
  required?: boolean;
  transform?: (value: any) => any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  value?: any;
}

export interface PromptOptions {
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'password';
  name: string;
  message: string;
  initial?: any;
  choices?: Array<{ title: string; value: any; selected?: boolean }>;
  validate?: (value: any) => boolean | string;
  transform?: (value: any) => any;
  required?: boolean;
  multiline?: boolean;
  mask?: string;
  hint?: string;
}

export interface ProgressOptions {
  total: number;
  message?: string;
  format?: string;
  complete?: string;
  incomplete?: string;
  width?: number;
  stream?: NodeJS.WritableStream;
}

export class ValidationManager {
  private rules: Map<string, ValidationRule[]> = new Map();

  /**
   * Register validation rules for a field
   */
  registerRules(fieldName: string, rules: ValidationRule[]): void {
    this.rules.set(fieldName, rules);
  }

  /**
   * Validate a single value
   */
  validateValue(fieldName: string, value: any): ValidationResult {
    const rules = this.rules.get(fieldName) || [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let transformedValue = value;

    for (const rule of rules) {
      // Check if field is required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${fieldName} is required`);
        continue;
      }

      // Skip validation if value is empty and not required
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Apply transformation if provided
      if (rule.transform) {
        transformedValue = rule.transform(transformedValue);
      }

      // Run validation
      const result = rule.validate(transformedValue);
      
      if (typeof result === 'string') {
        errors.push(result);
      } else if (result === false) {
        errors.push(rule.message || `Invalid value for ${fieldName}: ${value}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: errors.length === 0 ? transformedValue : value
    };
  }

  /**
   * Validate an object against registered rules
   */
  validateObject(data: Record<string, any>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    // Validate fields with rules
    for (const [fieldName] of this.rules) {
      results[fieldName] = this.validateValue(fieldName, data[fieldName]);
    }

    return results;
  }

  /**
   * Interactive prompt for user input
   */
  async prompt(options: PromptOptions): Promise<any> {
    const { name, message, type, initial, choices, validate, transform, required, hint } = options;

    try {
      switch (type) {
        case 'text':
          return await this.promptText(message, { initial, validate, transform, required, hint });
        
        case 'number':
          return await this.promptNumber(message, { initial, validate, transform, required, hint });
        
        case 'boolean':
          return await this.promptBoolean(message, { initial, hint });
        
        case 'select':
          return await this.promptSelect(message, choices || [], { initial, hint });
        
        case 'multiselect':
          return await this.promptMultiSelect(message, choices || [], { hint });
        
        case 'password':
          return await this.promptPassword(message, { validate, transform, required, hint });
        
        default:
          throw new Error(`Unsupported prompt type: ${type}`);
      }
    } catch (error) {
      consola.error(`Prompt failed for ${name}:`, error);
      throw error;
    }
  }

  /**
   * Prompt for multiple inputs
   */
  async promptSequence(prompts: PromptOptions[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const promptOptions of prompts) {
      try {
        results[promptOptions.name] = await this.prompt(promptOptions);
      } catch (error) {
        consola.error(`Failed to get input for ${promptOptions.name}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Text input prompt
   */
  private async promptText(
    message: string, 
    options: { 
      initial?: string; 
      validate?: (value: string) => boolean | string;
      transform?: (value: string) => any;
      required?: boolean;
      hint?: string;
    } = {}
  ): Promise<string> {
    const { initial, validate, transform, required, hint } = options;

    while (true) {
      // Display prompt message
      let promptMessage = colors.cyan(message);
      if (initial) {
        promptMessage += colors.dim(` (${initial})`);
      }
      if (hint) {
        promptMessage += colors.dim(`\n  ${hint}`);
      }
      promptMessage += ': ';

      const answer = await readlineInterface.question(promptMessage);
      const value = answer.trim() || initial || '';

      // Check if required
      if (required && !value) {
        consola.error('This field is required. Please provide a value.');
        continue;
      }

      // Skip validation if empty and not required
      if (!value && !required) {
        return transform ? transform(value) : value;
      }

      // Validate input
      if (validate) {
        const validationResult = validate(value);
        if (typeof validationResult === 'string') {
          consola.error(validationResult);
          continue;
        } else if (validationResult === false) {
          consola.error('Invalid input. Please try again.');
          continue;
        }
      }

      return transform ? transform(value) : value;
    }
  }

  /**
   * Number input prompt
   */
  private async promptNumber(
    message: string,
    options: {
      initial?: number;
      validate?: (value: number) => boolean | string;
      transform?: (value: number) => any;
      required?: boolean;
      hint?: string;
    } = {}
  ): Promise<number> {
    const { initial, validate, transform, required, hint } = options;

    const textValidate = (value: string): boolean | string => {
      if (!value && !required) return true;
      
      const num = parseFloat(value);
      if (isNaN(num)) {
        return 'Please enter a valid number';
      }
      
      if (validate) {
        return validate(num);
      }
      
      return true;
    };

    const textTransform = (value: string): number => {
      const num = parseFloat(value);
      return transform ? transform(num) : num;
    };

    const result = await this.promptText(message, {
      initial: initial?.toString(),
      validate: textValidate,
      transform: textTransform,
      required,
      hint
    });

    return typeof result === 'number' ? result : parseFloat(result);
  }

  /**
   * Boolean input prompt
   */
  private async promptBoolean(
    message: string,
    options: { initial?: boolean; hint?: string } = {}
  ): Promise<boolean> {
    const { initial = false, hint } = options;

    let promptMessage = colors.cyan(message);
    promptMessage += colors.dim(` (y/N)`);
    if (hint) {
      promptMessage += colors.dim(`\n  ${hint}`);
    }
    promptMessage += ': ';

    const answer = await readlineInterface.question(promptMessage);
    const value = answer.trim().toLowerCase();

    if (!value) {
      return initial;
    }

    return ['y', 'yes', '1', 'true'].includes(value);
  }

  /**
   * Select input prompt
   */
  private async promptSelect(
    message: string,
    choices: Array<{ title: string; value: any }>,
    options: { initial?: any; hint?: string } = {}
  ): Promise<any> {
    const { initial, hint } = options;

    if (choices.length === 0) {
      throw new Error('No choices provided for select prompt');
    }

    while (true) {
      console.log(colors.cyan(message));
      
      if (hint) {
        console.log(colors.dim(`  ${hint}`));
      }

      choices.forEach((choice, index) => {
        const isDefault = initial !== undefined && choice.value === initial;
        const prefix = isDefault ? colors.green('›') : ' ';
        console.log(`${prefix} ${colors.dim((index + 1).toString().padStart(2))}. ${choice.title}`);
      });

      const answer = await readlineInterface.question(
        colors.cyan(`Select (1-${choices.length}): `)
      );

      if (!answer.trim() && initial !== undefined) {
        return initial;
      }

      const selection = parseInt(answer.trim(), 10);
      if (isNaN(selection) || selection < 1 || selection > choices.length) {
        consola.error(`Please enter a number between 1 and ${choices.length}`);
        continue;
      }

      return choices[selection - 1].value;
    }
  }

  /**
   * Multi-select input prompt
   */
  private async promptMultiSelect(
    message: string,
    choices: Array<{ title: string; value: any; selected?: boolean }>,
    options: { hint?: string } = {}
  ): Promise<any[]> {
    const { hint } = options;

    if (choices.length === 0) {
      throw new Error('No choices provided for multi-select prompt');
    }

    const selected = new Set<number>();
    
    // Initialize with pre-selected items
    choices.forEach((choice, index) => {
      if (choice.selected) {
        selected.add(index);
      }
    });

    while (true) {
      console.clear();
      console.log(colors.cyan(message));
      
      if (hint) {
        console.log(colors.dim(`  ${hint}`));
      }
      
      console.log(colors.dim('  Use space to toggle, enter to confirm, q to quit'));

      choices.forEach((choice, index) => {
        const isSelected = selected.has(index);
        const checkbox = isSelected ? colors.green('☑') : '☐';
        console.log(`  ${checkbox} ${colors.dim((index + 1).toString().padStart(2))}. ${choice.title}`);
      });

      const answer = await readlineInterface.question(colors.cyan('\nSelect items (space to toggle, enter to confirm): '));

      if (answer.trim().toLowerCase() === 'q') {
        throw new Error('Multi-select cancelled');
      }

      if (answer.trim() === '') {
        // Confirm selection
        return choices.filter((_, index) => selected.has(index)).map(choice => choice.value);
      }

      // Toggle selection
      const num = parseInt(answer.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= choices.length) {
        const index = num - 1;
        if (selected.has(index)) {
          selected.delete(index);
        } else {
          selected.add(index);
        }
      } else {
        consola.error(`Please enter a number between 1 and ${choices.length}, or press enter to confirm`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }

  /**
   * Password input prompt
   */
  private async promptPassword(
    message: string,
    options: {
      validate?: (value: string) => boolean | string;
      transform?: (value: string) => any;
      required?: boolean;
      hint?: string;
    } = {}
  ): Promise<string> {
    const { validate, transform, required, hint } = options;

    // For now, treat as text input (in a real implementation, you'd hide the input)
    consola.warn('Password masking not fully implemented - input will be visible');
    
    return this.promptText(colors.cyan(message), {
      validate,
      transform,
      required,
      hint
    });
  }

  /**
   * Display progress bar
   */
  createProgressBar(options: ProgressOptions): {
    update: (current: number) => void;
    complete: () => void;
    fail: (message?: string) => void;
  } {
    const {
      total,
      message = 'Progress',
      format = ':message [:bar] :percent :current/:total',
      complete = '█',
      incomplete = '░',
      width = 40,
      stream = process.stdout
    } = options;

    let current = 0;

    const render = () => {
      const percent = Math.floor((current / total) * 100);
      const completedWidth = Math.floor((current / total) * width);
      const incompleteWidth = width - completedWidth;
      
      const bar = complete.repeat(completedWidth) + incomplete.repeat(incompleteWidth);
      
      const output = format
        .replace(':message', message)
        .replace(':bar', bar)
        .replace(':percent', `${percent}%`)
        .replace(':current', current.toString())
        .replace(':total', total.toString());

      stream.clearLine?.(0);
      stream.cursorTo?.(0);
      stream.write(output);
    };

    return {
      update: (value: number) => {
        current = Math.min(Math.max(value, 0), total);
        render();
      },
      complete: () => {
        current = total;
        render();
        stream.write('\n');
        consola.success(`${message} completed`);
      },
      fail: (errorMessage?: string) => {
        stream.write('\n');
        consola.error(`${message} failed${errorMessage ? ': ' + errorMessage : ''}`);
      }
    };
  }

  /**
   * Confirm action with user
   */
  async confirm(
    message: string, 
    defaultValue = false,
    options: { hint?: string } = {}
  ): Promise<boolean> {
    return this.promptBoolean(message, { 
      initial: defaultValue,
      hint: options.hint 
    });
  }

  /**
   * Display formatted error message
   */
  displayError(title: string, error: Error | string, context?: any): void {
    consola.error(colors.red(`\n❌ ${title}`));
    
    const errorMessage = error instanceof Error ? error.message : error;
    console.log(colors.red(`   ${errorMessage}`));
    
    if (context) {
      console.log(colors.dim('   Context:'), context);
    }
    
    if (error instanceof Error && error.stack) {
      consola.debug('Stack trace:', error.stack);
    }
  }

  /**
   * Display formatted success message
   */
  displaySuccess(message: string, details?: string[]): void {
    consola.success(colors.green(`✅ ${message}`));
    
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(colors.dim(`   ${detail}`));
      });
    }
  }

  /**
   * Display formatted warning message
   */
  displayWarning(message: string, details?: string[]): void {
    consola.warn(colors.yellow(`⚠️  ${message}`));
    
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(colors.dim(`   ${detail}`));
      });
    }
  }

  /**
   * Display formatted info message
   */
  displayInfo(message: string, details?: string[]): void {
    consola.info(colors.cyan(`ℹ️  ${message}`));
    
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(colors.dim(`   ${detail}`));
      });
    }
  }

  /**
   * Clear console
   */
  clear(): void {
    console.clear();
  }
}

// Common validation rules
export const CommonValidationRules = {
  required: (): ValidationRule => ({
    name: 'required',
    validate: (value: any) => value !== undefined && value !== null && value !== '',
    message: 'This field is required',
    required: true
  }),

  minLength: (min: number): ValidationRule => ({
    name: 'minLength',
    validate: (value: string) => !value || value.length >= min,
    message: `Must be at least ${min} characters long`
  }),

  maxLength: (max: number): ValidationRule => ({
    name: 'maxLength',
    validate: (value: string) => !value || value.length <= max,
    message: `Must be no more than ${max} characters long`
  }),

  email: (): ValidationRule => ({
    name: 'email',
    validate: (value: string) => {
      if (!value) return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message: 'Must be a valid email address'
  }),

  url: (): ValidationRule => ({
    name: 'url',
    validate: (value: string) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Must be a valid URL'
  }),

  numeric: (): ValidationRule => ({
    name: 'numeric',
    validate: (value: any) => !isNaN(Number(value)),
    message: 'Must be a number',
    transform: (value: any) => Number(value)
  }),

  integer: (): ValidationRule => ({
    name: 'integer',
    validate: (value: any) => Number.isInteger(Number(value)),
    message: 'Must be an integer',
    transform: (value: any) => parseInt(value, 10)
  }),

  positive: (): ValidationRule => ({
    name: 'positive',
    validate: (value: number) => value > 0,
    message: 'Must be a positive number'
  }),

  range: (min: number, max: number): ValidationRule => ({
    name: 'range',
    validate: (value: number) => value >= min && value <= max,
    message: `Must be between ${min} and ${max}`
  }),

  oneOf: (options: any[]): ValidationRule => ({
    name: 'oneOf',
    validate: (value: any) => options.includes(value),
    message: `Must be one of: ${options.join(', ')}`
  })
};

// Export singleton instance
export const validationManager = new ValidationManager();
export default validationManager;