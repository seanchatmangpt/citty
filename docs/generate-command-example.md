# Citty Generate Command

The `generate` command uses Ollama AI to create CLI commands from natural language descriptions and converts them to citty's ontology format.

## Installation

First, make sure you have Ollama installed and running:

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (e.g., llama3.2)
ollama pull llama3.2
```

## Usage

### Basic Usage

```bash
import { generateCommand } from "citty";

// Use the generate command
await runCommand(generateCommand, {
  rawArgs: [
    "--prompt", "Create a file management CLI with list, copy, and delete commands",
    "--format", "ontology"
  ]
});
```

### Generate Ontology Only

```typescript
import { generateCommand } from "citty";

const result = await runCommand(generateCommand, {
  rawArgs: [
    "--prompt", "Create a database migration CLI with up, down, and status commands",
    "--model", "llama3.2",
    "--format", "ontology",
    "--verbose"
  ]
});
```

### Generate Complete Files

```typescript
import { generateCommand } from "citty";

const result = await runCommand(generateCommand, {
  rawArgs: [
    "--prompt", "Create a Docker management CLI with build, run, and stop commands",
    "--format", "files",
    "--output", "./generated-cli",
    "--temperature", "0.3"
  ]
});
```

## Options

- `--prompt` (required): Description of the CLI command to generate
- `--model` (default: "llama3.2"): Ollama model to use
- `--format` (default: "ontology"): Output format ("ontology" or "files")
- `--output`: Output directory (required when format is "files")
- `--temperature` (default: 0.3): AI generation temperature (0.0-1.0)
- `--verbose`: Enable detailed output

## Example Prompts

### Simple CLI
```
"Create a weather CLI that shows current weather for a given city"
```

### Complex CLI with Subcommands
```
"Create a project management CLI with commands to create projects, add tasks, mark tasks complete, and generate reports"
```

### Utility CLI
```
"Create a log analyzer CLI that can parse log files, filter by level, and show statistics"
```

## Output Formats

### Ontology Format
Outputs the command definition as a Turtle RDF ontology that can be:
- Converted back to citty commands using `fromOntology`
- Used for semantic analysis and documentation
- Stored in knowledge graphs

### Files Format
Generates complete TypeScript files ready to use:
- Main command file
- Subcommand files (if any)
- Ontology definition file

## Integration Example

```typescript
import { runMain } from "citty";
import { generateCommand } from "citty";

// Create a CLI that includes the generate command
runMain({
  meta: {
    name: "my-cli-tool",
    description: "A CLI tool with AI-powered command generation",
    version: "1.0.0",
  },
  subCommands: {
    generate: generateCommand,
    // ... other commands
  },
});
```

## Requirements

- Node.js 18+
- Ollama installed and running
- An Ollama model (e.g., llama3.2, codellama, etc.)

## Error Handling

The command handles various error scenarios:
- Ollama service unavailable
- Invalid AI responses
- Missing required arguments
- File system permissions
- Network connectivity issues

All errors include helpful messages to guide troubleshooting.