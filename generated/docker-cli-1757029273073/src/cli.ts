#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import './instrumentation.js';
import consola from 'consola';

const main = defineCommand({
  meta: {
    name: 'cli-generated-cli',
    description: 'CLI generated from semantic conventions',
    version: '1.0.0'
  },
  subCommands: {
    generated_cli_operation: () => import('./commands/generated_cli_operation.js').then(r => r.default)
  }
});

runMain(main);
