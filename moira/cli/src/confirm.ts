// Destructive-command confirmation gate (issue #37 item 7 / analysis §4.2#7).
//
// Design (the ONLY hard constraint the task states): non-TTY callers (pipes,
// agents, CI, this repo's own vitest suite) must ALWAYS pass through WITHOUT
// prompting — never hang waiting on stdin that will never arrive. TTY is the
// gate, not "is this a destructive verb" — the verb-selection (cancel/done
// only) lives in the caller (commands.ts), not here.

import { createInterface } from 'node:readline/promises';

export interface ConfirmOptions {
  /** `--yes`/`-y`: skip the prompt unconditionally (still returns true). */
  yes?: boolean;
  /** Injectable for tests — defaults to the real stdin/stdout TTY check. */
  isTTY?: boolean;
}

/**
 * Ask a y/N question on stderr (this CLI's convention: stdout = data, stderr =
 * warnings/progress/prompts). Resolves true iff the operation should proceed:
 *   - `opts.yes` → true, no prompt (explicit bypass)
 *   - not a TTY  → true, no prompt (automation/CI/agents — the required default)
 *   - TTY        → prompts; true only on an explicit y/yes answer
 */
export async function confirmDestructive(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  if (opts.yes === true) return true;
  const isTTY = opts.isTTY ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
  if (!isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
