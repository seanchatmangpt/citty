import { createContext, useContext } from 'unctx';
import type { TemplateContext } from './types.js';
import { ContextError } from './types.js';

/**
 * Global template context instance
 */
const templateContext = createContext<TemplateContext>();

/**
 * Creates a new template context with the provided data
 */
export function createTemplateContext(data: TemplateContext = {}): TemplateContext {
  templateContext.set(data);
  return data;
}

/**
 * Gets the current template context
 */
export function useTemplateContext(): TemplateContext {
  const context = templateContext.tryUse();
  if (!context) {
    throw new ContextError('No template context available. Use createTemplateContext() first.');
  }
  return context;
}

/**
 * Updates the current template context with new data
 */
export function updateTemplateContext(data: Partial<TemplateContext>): void {
  const current = useTemplateContext();
  Object.assign(current, data);
}

/**
 * Safely gets a value from the template context
 */
export function getContextValue<T = any>(key: string, defaultValue?: T): T {
  const context = useTemplateContext();
  return context[key] ?? defaultValue;
}

/**
 * Sets a value in the template context
 */
export function setContextValue(key: string, value: any): void {
  const context = useTemplateContext();
  context[key] = value;
}

/**
 * Checks if a key exists in the template context
 */
export function hasContextValue(key: string): boolean {
  const context = useTemplateContext();
  return key in context;
}

/**
 * Validates that required context keys are present
 */
export function validateContextKeys(requiredKeys: string[]): void {
  const context = useTemplateContext();
  const missingKeys = requiredKeys.filter(key => !(key in context));
  
  if (missingKeys.length > 0) {
    throw new ContextError(
      `Missing required context keys: ${missingKeys.join(', ')}`,
      missingKeys
    );
  }
}

/**
 * Creates a scoped context that inherits from the current context
 */
export async function withScopedContext<T>(
  data: Partial<TemplateContext>,
  fn: () => Promise<T>
): Promise<T> {
  const parentContext = templateContext.tryUse() || {};
  const scopedContext = { ...parentContext, ...data };
  
  return templateContext.callAsync(scopedContext, fn);
}

/**
 * Clears the current template context
 */
export function clearTemplateContext(): void {
  const context = useTemplateContext();
  Object.keys(context).forEach(key => {
    delete context[key];
  });
}

/**
 * Gets all context keys
 */
export function getContextKeys(): string[] {
  const context = useTemplateContext();
  return Object.keys(context);
}

/**
 * Serializes the current context to JSON
 */
export function serializeContext(): string {
  const context = useTemplateContext();
  return JSON.stringify(context, null, 2);
}

/**
 * Deserializes JSON to context data
 */
export function deserializeContext(json: string): TemplateContext {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new ContextError(
      `Failed to deserialize context: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}