#!/usr/bin/env node
// moira CLI entry. Thin: parse argv → dispatch → map errors to a non-zero exit.

import { runCli } from './commands.js';

runCli(process.argv.slice(2)).catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`moira: ${msg}\n`);
  process.exit(1);
});
