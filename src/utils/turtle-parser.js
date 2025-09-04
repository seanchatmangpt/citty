// Simplified Turtle parser for citty commands
export function parseTurtleTriples(turtle) {
  const triples = [];
  const lines = turtle.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("@prefix") || trimmed.startsWith("#")) {
      continue;
    }

    // Parse simple triples: subject predicate object .
    const match = trimmed.match(/^([^\s]+)\s+([^\s]+)\s+(.+?)\s*\.$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({
        subject: subject.replace(/^<|>$/g, ""),
        predicate: predicate.replace(/^<|>$/g, ""),
        object: object.replace(/^<|>$/g, "").replace(/^"|"$/g, ""),
      });
    }
  }

  return triples;
}

export function buildCommandStructure(triples) {
  const commands = new Map();
  const argsMap = new Map();

  // Process triples to build command structure
  for (const triple of triples) {
    if (triple.predicate.includes("hasName") && triple.object) {
      const commandUri = triple.subject;
      if (!commands.has(commandUri)) {
        commands.set(commandUri, {
          name: triple.object,
          args: [],
          subCommands: [],
        });
      }
    }

    if (triple.predicate.includes("hasDescription") && triple.object) {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.description = triple.object;
      }
    }

    if (triple.predicate.includes("hasVersion") && triple.object) {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.version = triple.object;
      }
    }

    if (triple.predicate.includes("isHidden") && triple.object === "true") {
      const commandUri = triple.subject;
      const command = commands.get(commandUri);
      if (command) {
        command.hidden = true;
      }
    }

    // Handle arguments
    if (triple.predicate.includes("hasArgument")) {
      const commandUri = triple.subject;
      const argUri = triple.object;
      const command = commands.get(commandUri);
      if (command) {
        const arg = argsMap.get(argUri) || {
          name: "",
          type: "string",
        };
        command.args.push(arg);
        argsMap.set(argUri, arg);
      }
    }

    // Handle argument properties
    if (triple.predicate.includes("hasName") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject);
      arg.name = triple.object;
    }

    if (triple.predicate.includes("hasType") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject);
      const typeMatch = triple.object.match(/type:(\w+)/);
      if (typeMatch) {
        arg.type = typeMatch[1];
      }
    }

    if (
      triple.predicate.includes("hasDescription") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject);
      arg.description = triple.object;
    }

    if (
      triple.predicate.includes("hasDefaultValue") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject);
      arg.default = triple.object;
    }

    if (
      triple.predicate.includes("isRequired") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject);
      arg.required = triple.object === "true";
    }

    if (triple.predicate.includes("hasAlias") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject);
      if (!arg.alias) arg.alias = [];
      arg.alias.push(triple.object);
    }

    if (
      triple.predicate.includes("hasValueHint") &&
      argsMap.has(triple.subject)
    ) {
      const arg = argsMap.get(triple.subject);
      arg.valueHint = triple.object;
    }

    if (triple.predicate.includes("hasOption") && argsMap.has(triple.subject)) {
      const arg = argsMap.get(triple.subject);
      if (!arg.options) arg.options = [];
      arg.options.push(triple.object);
    }

    // Handle subcommands
    if (triple.predicate.includes("hasSubCommand")) {
      const commandUri = triple.subject;
      const subCommandUri = triple.object;
      const command = commands.get(commandUri);
      const subCommand = commands.get(subCommandUri);
      if (command && subCommand) {
        command.subCommands.push(subCommand);
      }
    }
  }

  return [...commands.values()];
}
