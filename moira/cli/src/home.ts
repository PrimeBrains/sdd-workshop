// Log-home resolution (multi-repo support — issue #14 Stage 1 / ADR-0003).
//
// One project = ONE log home (`.moira/` at the home root), but WORK happens in
// several repos (design in repo A, implementation in repo B). Every command
// resolves the home the same way, in priority order:
//
//   1. `--dir <path>` GLOBAL flag (before the command word)   — explicit wins
//   2. `MOIRA_DIR` environment variable                        — session-wide
//   3. from `startDir` upward:
//        - a `.moira` REGULAR FILE is a POINTER (git's `gitdir:` analogue):
//          its first `home: <path>` line names the home ROOT (the directory
//          CONTAINING `.moira/`), absolute or relative to the pointer's own
//          directory. ONE hop only — a pointer at the target is an error.
//        - a `.moira/` DIRECTORY with `config.json` is the home itself.
//   4. `startDir` as-is (callers decide whether a missing home is an error —
//      `moira init` creates it, `requireRepo` rejects it).
//
// Flag > env because an explicit command-line choice must always beat ambient
// shell state (the git `--git-dir` > `GIT_DIR` convention). D-50 boundary: the
// resolver returns exactly ONE home — there is deliberately no multi-home merge.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CliError } from './errors.js';

export interface HomeResolution {
  /** The home ROOT — the directory whose `.moira/` holds the log (not `.moira` itself). */
  root: string;
  source: 'flag' | 'env' | 'pointer' | 'walk-up' | 'cwd';
}

export interface HomeOptions {
  flagDir?: string;
  env?: NodeJS.ProcessEnv;
  startDir?: string;
}

/** The global `--dir` value, set once per invocation by runCli (reset each run). */
let globalDir: string | undefined;
export function setGlobalDir(d: string | undefined): void {
  globalDir = d;
}
export function getGlobalDir(): string | undefined {
  return globalDir;
}

type Stat = { kind: 'dir' | 'file' | 'absent' };
function statKind(p: string): Stat['kind'] {
  try {
    const st = statSync(p);
    return st.isDirectory() ? 'dir' : 'file';
  } catch {
    return 'absent';
  }
}

/** Parse a `.moira` pointer file → the home root it names. Throws on a broken pointer. */
function followPointer(pointerPath: string): string {
  let text: string;
  try {
    text = readFileSync(pointerPath, 'utf8');
  } catch (e) {
    throw new CliError(
      `.moira ポインタファイルを読めない: ${pointerPath} (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const m = /^home:\s*(.+?)\s*$/m.exec(text);
  if (m === null) {
    throw new CliError(
      `.moira ポインタファイルの形式が不正: ${pointerPath}\n  1 行目に "home: <log-home のルートパス>" が必要（相対はポインタ置き場基準）`,
    );
  }
  const target = resolve(dirname(pointerPath), m[1]!);
  const targetMoira = join(target, '.moira');
  const kind = statKind(targetMoira);
  if (kind === 'file') {
    throw new CliError(
      `.moira ポインタの指し先がまたポインタ: ${pointerPath} → ${target}\n  ポインタは 1 ホップのみ（ループ防止）。指し先はログ home のルートにする`,
    );
  }
  if (statKind(join(targetMoira, 'config.json')) !== 'file') {
    throw new CliError(
      `.moira ポインタの指し先にログ home が無い: ${pointerPath} → ${target}\n  ${targetMoira}/config.json が存在しない — 指し先で \`moira init\` するかパスを直す`,
    );
  }
  return target;
}

/** Resolve `p` treating a `.moira` pointer file at `p` as one hop.
 *  Exported for the portfolio loader, which calls it once PER declared entry —
 *  each call still yields exactly one home (the D-50 boundary above holds). */
export function resolveExplicit(p: string): string {
  const root = resolve(p);
  if (statKind(join(root, '.moira')) === 'file') return followPointer(join(root, '.moira'));
  return root;
}

export function resolveMoiraHome(opts: HomeOptions = {}): HomeResolution {
  if (opts.flagDir !== undefined && opts.flagDir !== '') {
    return { root: resolveExplicit(opts.flagDir), source: 'flag' };
  }
  const env = (opts.env ?? process.env).MOIRA_DIR;
  if (typeof env === 'string' && env !== '') {
    return { root: resolveExplicit(env), source: 'env' };
  }

  const start = resolve(opts.startDir ?? process.cwd());
  let d = start;
  for (;;) {
    const moira = join(d, '.moira');
    const kind = statKind(moira);
    if (kind === 'file') {
      return { root: followPointer(moira), source: 'pointer' };
    }
    if (kind === 'dir' && statKind(join(moira, 'config.json')) === 'file') {
      return { root: d, source: d === start ? 'cwd' : 'walk-up' };
    }
    const parent = dirname(d);
    if (parent === d) break; // filesystem root
    d = parent;
  }
  // Nothing found — fall back to startDir (pre-Stage-1 behavior: the caller errors).
  return { root: start, source: 'cwd' };
}
