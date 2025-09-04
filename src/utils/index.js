// Main export file for JavaScript ontology utilities
export { parseTurtleTriples, buildCommandStructure } from "./turtle-parser.js";
export {
  COMMAND_TEMPLATE,
  MAIN_COMMAND_TEMPLATE,
  ONTOLOGY_PREFIXES,
  ONTOLOGY_DEFINITIONS,
} from "./templates.js";
export {
  toOntology,
  fromOntology,
  generateFromOntology,
  validateOntology,
  escapeString,
  resolveValue,
} from "./ontology-utils.js";
