// Shared CLI error type — thrown by command handlers, mapped to a non-zero exit
// by index.ts. Lives outside commands.ts so subcommand modules (adapter/*) can
// throw it without importing the dispatcher (no import cycle).

export class CliError extends Error {}
