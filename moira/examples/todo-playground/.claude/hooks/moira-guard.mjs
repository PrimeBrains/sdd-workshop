// moira-guard.mjs — Claude Code hook: the "fence" layer of the cc-sdd → Moira adapter.
// Distributed by `moira adapter install` (canonical source: sdd-workshop moira/cli/templates/).
//
// It catches the firing-misses that recurred across two real demo runs (see the
// playground demo-log.take1.md). ONE behavior is a hard enforcement, the rest are advisory:
//   - HARD DENY (PreToolUse): `moira add` without --parent — the issue #5 footgun.
//     Containment latest-wins (MODEL §2.8 v20) means the omission no longer mints
//     a duplicate edge, but an unintended parent still silently moves the node;
//     the deny stays as defense-in-depth so Claude self-corrects by adding
//     --parent. This is a HEURISTIC textual guard (it also
//     catches compound `a && moira add …`, quoted `bash -c "moira add …"`, and
//     prefixed `env X=1 moira add …` forms), NOT a sandbox — a determined bypass
//     is possible; the primary discipline is "always pass --parent".
//   - ADVISORY REMINDERS (additionalContext, NON-blocking — Claude may still act,
//     so correctness stays the SKILL's responsibility, not the hook's): the start
//     gate before `start`, the assign→ready landmine before `assign`, AC after
//     `done`, and "moira ui auto-refreshes" after any mutating command.
//
// Contract (Claude Code hooks):
//   - stdin  = one JSON object: { hook_event_name, tool_name, tool_input:{command}, ... }
//   - PreToolUse deny   → stdout {hookSpecificOutput:{hookEventName,permissionDecision:"deny",permissionDecisionReason}}
//   - PreToolUse remind → stdout {hookSpecificOutput:{hookEventName,additionalContext}}  (no decision → normal flow)
//   - PostToolUse remind→ stdout {hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext}}
//   - always exit 0; stdout must be JSON-only. On any error we FAIL OPEN (a broken
//     guard must never block real work).
//
// This file touches nothing in moira itself — it lives in the target repo's
// .claude/ and only reads the Bash command string (plus .moira/config.json for
// the project-root name in the deny message). `decide()` is exported so the
// adapter's test suite can drive it without a process.

import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Resolve the .moira DATA DIR for `base` (multi-repo, ADR-0003) — duplicated
 *  in both hook files on purpose (each .mjs stays a self-contained zero-dep
 *  script). MOIRA_DIR env → base/.moira directory → a `.moira` POINTER FILE
 *  (`home: <path>`, one hop, relative to the pointer's directory) → null.
 *  Fail-soft: any error → null. */
function resolveMoiraDataDir(base) {
  try {
    const env = process.env.MOIRA_DIR;
    if (typeof env === 'string' && env !== '') return join(env, '.moira');
    const p = join(base, '.moira');
    const st = statSync(p, { throwIfNoEntry: false });
    if (st?.isDirectory()) return p;
    if (st?.isFile()) {
      const m = /^home:\s*(.+?)\s*$/m.exec(readFileSync(p, 'utf8'));
      if (m) {
        const t = join(resolve(base, m[1]), '.moira');
        const ts = statSync(t, { throwIfNoEntry: false });
        if (ts?.isDirectory()) return t;
      }
    }
  } catch {
    /* fail-soft */
  }
  return null;
}

// A moira invocation may sit at the start of a segment, or be prefixed by an env
// assignment (`env X=1 moira …`), a wrapper (`time moira …`), or be embedded in a
// quoted/subshell string (`bash -c "moira …"`, `$(moira …)`). Allow those boundaries.
const B = `(?:^|[\\s"'\`($])`;
/** Subcommands that append an event to .moira/events.json (make the dashboard stale). */
const MUTATING = new RegExp(
  `${B}(?:npx\\s+)?moira\\s+(?:init|add|agree|assign|start|done|accept|cancel|cost|relate|capacity)\\b`,
);
/** True if a segment invokes `moira <sub>` (anywhere, given the boundary above). */
const isMoira = (seg, sub) => new RegExp(`${B}(?:npx\\s+)?moira\\s+${sub}\\b`).test(seg);

/** Split a compound Bash command into roughly-independent segments. */
function segments(command) {
  return command
    .split(/\s*(?:&&|\|\||[;|\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Project-root node id from the resolved home's config.json (display only — fail-soft). */
function projectRoot() {
  try {
    const base = process.env.CLAUDE_PROJECT_DIR ?? '.';
    const dataDir = resolveMoiraDataDir(base) ?? join(base, '.moira');
    const cfg = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));
    if (typeof cfg.projectRoot === 'string' && cfg.projectRoot !== '') return cfg.projectRoot;
  } catch {
    /* .moira not initialized yet */
  }
  return 'プロジェクト根';
}

/** Pure-ish decision core (exported for tests): input JSON → hook output object
 * or undefined (= stay silent / normal flow). Never throws to the caller. */
export function decide(input) {
  const event = input.hook_event_name;
  if (input.tool_name !== 'Bash') return undefined;
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !command.includes('moira')) return undefined;

  const segs = segments(command);

  // ── PreToolUse ────────────────────────────────────────────────────────────
  if (event === 'PreToolUse') {
    // (1) HARD STOP: `moira add` without --parent. Since containment latest-wins
    //     (MODEL §2.8 v20, issue #5 resolved) the omission no longer mints a
    //     duplicate edge — CLI falls back to the node's existing parent (or the
    //     project root for NEW nodes, with a stderr note) — but an unintended
    //     parent still silently MOVES the node in the tree. Explicit --parent
    //     stays the discipline; this deny is defense-in-depth (SKILL Critical
    //     Constraints), not the only line.
    const badAdds = segs.filter((s) => isMoira(s, 'add') && !/--parent(\s|=)/.test(s));
    if (badAdds.length > 0) {
      const root = projectRoot();
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            `\`moira add\` は必ず --parent <正しい親> を付ける（明示が最も誤解が無い）。省略時は ` +
            `既存ノード→現在の親を再利用 / 新規ノード→プロジェクト根 (${root}) にフォールバックする。` +
            '所属は latest-wins 置換 (MODEL §2.8 v20) で二重辺は生じないが、意図しない親付けは木を黙って動かす' +
            '（復旧は正しい親への再 add 1 発）。' +
            '例: moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude。' +
            `該当: ${badAdds.join(' / ')}`,
        },
      };
    }

    // (2) Advisory reminders (no permission decision → normal flow proceeds).
    const notes = [];
    if (segs.some((s) => isMoira(s, 'start'))) {
      notes.push(
        '着手ゲート: moira start はノードが (1) 見積 agreed (2) 担当あり (3) 着手予定日(slot)あり を ' +
          'すべて満たすときのみ正当。moira show --json で nodeStates[].estimate==="agreed" / ' +
          'unassignedBacklog に当該ノードを含まない / forecast[].frozenSlot!==null を確認できる。' +
          '未充足なら先に見積合意 (moira agree) と割当 (moira assign … --slot <date>) を済ませる。',
      );
    }
    if (segs.some((s) => isMoira(s, 'assign'))) {
      notes.push(
        'moira assign は lifecycle を必ず ready へ戻す (emit.ts:75)。すでに accepted/implemented/implementing の ' +
          'ノードへ assign すると、出来高 EV_abs は現 lifecycle で判定される (ev.ts:16-29) ため後退し EV% が黙って ' +
          '落ちる。baseline (assign＋--slot) は必ず着手前に引き、完了済みノードには assign しない。',
      );
    }
    if (notes.length > 0) {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: notes.join('\n') } };
    }
    return undefined;
  }

  // ── PostToolUse ───────────────────────────────────────────────────────────
  if (event === 'PostToolUse') {
    const notes = [];
    if (segs.some((s) => isMoira(s, 'done'))) {
      notes.push(
        '完了時 AC 記録の義務: done したノードは実コストを moira cost <node> <実工数md> [--actor agent:claude] で ' +
          '記録すると CPI (=EV_abs/AC) が n/a から立つ。値は実測 — 手元に無ければ人間に確認し、捏造しない。' +
          'moira cost は id 重複排除つき累積加算 (fold の cost 分岐が seenCostIds で dedup) なので同じ工数を二重計上しない。',
      );
    }
    if (segs.some((s) => MUTATING.test(s))) {
      notes.push(
        'moira にイベントを追記した。稼働中の moira ui は追記を自動反映する (fs.watch→SSE)。' +
          '反映が見えない場合はブラウザをリロードすれば最新になる (/ は毎リクエスト最新を焼き込む)。再起動は不要。',
      );
    }
    if (notes.length > 0) {
      return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') } };
    }
    return undefined;
  }
  return undefined;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return; // unparseable stdin → fail open
  }
  const decision = decide(input);
  if (decision !== undefined) process.stdout.write(JSON.stringify(decision));
}

// Run only when invoked as a script (`node …/moira-guard.mjs`) — not on import.
const invokedDirectly = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  try {
    main();
  } catch {
    // fail open: never let a guard bug block the tool flow
  }
}
