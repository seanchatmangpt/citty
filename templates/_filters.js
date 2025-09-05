// Nunjucks filter functions for citty-pro templates

/**
 * Convert string to kebab-case
 */
function kebabCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to camelCase
 */
function camelCase(str) {
  if (!str) return '';
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
function pascalCase(str) {
  if (!str) return '';
  const camel = camelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert string to Title Case
 */
function titleCase(str) {
  if (!str) return '';
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert value to JSON string
 */
function stringify(value) {
  return JSON.stringify(value);
}

/**
 * Convert value to YAML-safe format
 */
function yamlValue(value) {
  if (typeof value === 'string') {
    // Escape strings that need quotes
    if (value.includes('\n') || value.includes(':') || value.includes('#')) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return '\n' + value.map(item => `  - ${yamlValue(item)}`).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    return '\n' + Object.entries(value)
      .map(([key, val]) => `  ${key}: ${yamlValue(val)}`)
      .join('\n');
  }
  return String(value);
}

/**
 * Convert object to YAML format
 */
function yaml(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }
  
  return Object.entries(obj)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join('\n');
}

/**
 * Join array with specified separator
 */
function join(arr, separator = ', ') {
  if (!Array.isArray(arr)) return '';
  return arr.join(separator);
}

/**
 * Pluck property from array of objects
 */
function pluck(arr, property) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => item[property]).filter(Boolean);
}

/**
 * Map array through a property or function
 */
function map(arr, property) {
  if (!Array.isArray(arr)) return [];
  if (typeof property === 'string') {
    return arr.map(item => item[property]);
  }
  return arr;
}

/**
 * Add backticks around text
 */
function backticks(str) {
  if (!str) return '';
  if (Array.isArray(str)) {
    return str.map(item => `\`${item}\``);
  }
  return `\`${str}\``;
}

/**
 * Indent text by specified number of spaces
 */
function indent(str, spaces = 2) {
  if (!str) return '';
  const indentStr = ' '.repeat(spaces);
  return str.split('\n').map(line => indentStr + line).join('\n');
}

/**
 * Convert arguments object to citty args format
 */
function toArgs(schema) {
  // This would need to parse the Zod schema and convert to citty format
  // For now, return a placeholder
  return '{ /* Generated from schema */ }';
}

/**
 * Mark content as safe (no escaping)
 */
function safe(str) {
  if (typeof str === 'object' && str !== null && str.__safe) {
    return str;
  }
  return { __safe: true, toString: () => String(str) };
}

// Export all filters
module.exports = {
  kebabCase,
  camelCase,
  pascalCase,
  titleCase,
  capitalize,
  stringify,
  yamlValue,
  yaml,
  join,
  pluck,
  map,
  backticks,
  indent,
  toArgs,
  safe
};