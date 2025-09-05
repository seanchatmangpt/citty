import consola from "consola";
import { colors } from "consola/utils";
import { formatLineColumns, resolveValue } from "./_utils";
import type { ArgsDef, CommandDef } from "./types";
import { resolveArgs } from "./args";

export async function showUsage<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  parent?: CommandDef<T>,
) {
  try {
    consola.log((await renderUsage(cmd, parent)) + "\n");
  } catch (error) {
    consola.error(error);
  }
}

// `no` prefix matcher (kebab-case or camelCase)
const negativePrefixRe = /^no[-A-Z]/;

export async function renderUsage<T extends ArgsDef = ArgsDef>(
  cmd: CommandDef<T>,
  parent?: CommandDef<T>,
) {
  const cmdMeta = await resolveValue(cmd.meta || {});
  const cmdArgs = resolveArgs(await resolveValue(cmd.args || {}));
  const parentMeta = await resolveValue(parent?.meta || {});

  const commandName =
    `${parentMeta.name ? `${parentMeta.name} ` : ""}` +
    (cmdMeta.name || process.argv[1]);

  const argLines: string[][] = [];
  const posLines: string[][] = [];
  const commandsLines: string[][] = [];
  const exampleLines: string[][] = [];
  const usageLine = [];

  for (const arg of cmdArgs) {
    if (arg.type === "positional") {
      const name = arg.name.toUpperCase();
      const isRequired = arg.required !== false && arg.default === undefined;
      // (isRequired ? " (required)" : " (optional)"
      const defaultHint = arg.default ? `="${arg.default}"` : "";
      posLines.push([
        "`" + name + defaultHint + "`",
        arg.description || "",
        arg.valueHint ? `<${arg.valueHint}>` : "",
      ]);
      usageLine.push(isRequired ? `<${name}>` : `[${name}]`);
    } else {
      const isRequired = arg.required === true && arg.default === undefined;
      const argStr =
        [...(arg.alias || []).map((a) => `-${a}`), `--${arg.name}`].join(", ") +
        (arg.type === "string" && (arg.valueHint || arg.default)
          ? `=${
              arg.valueHint ? `<${arg.valueHint}>` : `"${arg.default || ""}"`
            }`
          : "") +
        (arg.type === "enum" && arg.options
          ? `=<${arg.options.join("|")}>`
          : "");
      argLines.push([
        "`" + argStr + (isRequired ? " (required)" : "") + "`",
        arg.description || "",
      ]);

      /**
       * print negative boolean arg variant usage when
       * - enabled by default or has `negativeDescription`
       * - not prefixed with `no-` or `no[A-Z]`
       */
      if (
        arg.type === "boolean" &&
        (arg.default === true || arg.negativeDescription) &&
        !negativePrefixRe.test(arg.name)
      ) {
        const negativeArgStr = [
          ...(arg.alias || []).map((a) => `--no-${a}`),
          `--no-${arg.name}`,
        ].join(", ");
        argLines.push([
          "`" + negativeArgStr + (isRequired ? " (required)" : "") + "`",
          arg.negativeDescription || "",
        ]);
      }

      if (isRequired) {
        usageLine.push(argStr);
      }
    }
  }

  if (cmd.subCommands) {
    const commandNames: string[] = [];
    const subCommands = await resolveValue(cmd.subCommands);
    for (const [name, sub] of Object.entries(subCommands)) {
      const subCmd = await resolveValue(sub);
      const meta = await resolveValue(subCmd?.meta);
      if (meta?.hidden) {
        continue;
      }
      commandsLines.push([`\`${name}\``, meta?.description || ""]);
      commandNames.push(name);
    }
    usageLine.push(commandNames.join("|"));
  }

  const usageLines: (string | undefined)[] = [];

  const version = cmdMeta.version || parentMeta.version;

  // Enhanced description with better formatting
  const description = cmdMeta.description || '';
  const descriptionLines = description.split('\\n');
  
  usageLines.push(
    colors.bold(colors.blue(descriptionLines[0] || commandName)),
    "",
  );
  
  // Add additional description lines if they exist
  if (descriptionLines.length > 1) {
    descriptionLines.slice(1).forEach(line => {
      if (line.trim()) {
        usageLines.push(colors.dim(line), "");
      }
    });
  }
  
  if (version) {
    usageLines.push(colors.dim(`Version: ${version}`), "");
  }

  const hasOptions = argLines.length > 0 || posLines.length > 0;
  usageLines.push(
    `${colors.underline(colors.bold("USAGE"))} \`${commandName}${
      hasOptions ? " [OPTIONS]" : ""
    } ${usageLine.join(" ")}\``,
    "",
  );

  if (posLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("ARGUMENTS")), "");
    usageLines.push(formatLineColumns(posLines, "  "));
    usageLines.push("");
  }

  if (argLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("OPTIONS")), "");
    usageLines.push(formatLineColumns(argLines, "  "));
    usageLines.push("");
  }

  if (commandsLines.length > 0) {
    usageLines.push(colors.underline(colors.bold("COMMANDS")), "");
    usageLines.push(formatLineColumns(commandsLines, "  "));
    usageLines.push(
      "",
      `Use \`${commandName} <command> --help\` for more information about a command.`,
    );
  }
  
  // Add examples section if this is the main command
  if (cmdMeta.name === 'unjucks' || !parent) {
    usageLines.push(colors.underline(colors.bold("EXAMPLES")), "");
    
    const examples = [
      [`\`${commandName} init\``, "Initialize with sample templates"],
      [`\`${commandName} --list\``, "List all available generators"],
      [`\`${commandName} component create --interactive\``, "Create component interactively"],
      [`\`${commandName} --examples\``, "Show detailed usage examples"],
      [`\`${commandName} --tips\``, "Show helpful tips and tricks"]
    ];
    
    usageLines.push(formatLineColumns(examples, "  "));
    usageLines.push("");
    
    // Add ecosystem integration hints
    usageLines.push(colors.underline(colors.bold("ECOSYSTEM INTEGRATION")), "");
    usageLines.push(colors.dim("  Integrates with: Nuxt, Nitro, Vite, TypeScript, and more UnJS tools"));
    usageLines.push(colors.dim("  Run with --tips to see project-specific suggestions"));
    usageLines.push("");
    
    // Add quick help
    usageLines.push(colors.underline(colors.bold("GETTING HELP")), "");
    usageLines.push(colors.dim("  • Documentation: https://unjucks.unjs.io"));
    usageLines.push(colors.dim("  • Examples: " + commandName + " --examples"));
    usageLines.push(colors.dim("  • Community: https://discord.unjs.io"));
    usageLines.push("");
  }

  return usageLines.filter((l) => typeof l === "string").join("\n");
}
