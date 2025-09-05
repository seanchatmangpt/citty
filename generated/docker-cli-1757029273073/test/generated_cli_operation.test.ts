import { describe, it, expect } from 'vitest';
import generated_cli_operationCommand from '../src/commands/generated_cli_operation.js';

describe('generated-cli.operation command', () => {
  it('should be defined', () => {
    expect(generated_cli_operationCommand).toBeDefined();
    expect(generated_cli_operationCommand.meta.name).toBe('generated-cli.operation');
  });

  it('should have correct metadata', () => {
    expect(generated_cli_operationCommand.meta.description).toBe('generated-cli CLI operations');
  });

  it('should have run argument', () => {
    expect(generated_cli_operationCommand.args.run).toBeDefined();
    expect(generated_cli_operationCommand.args.run.description).toBe('Execute main functionality');
  });
});
