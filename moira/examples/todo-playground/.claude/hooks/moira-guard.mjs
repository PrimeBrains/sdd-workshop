// moira-guard.mjs — Claude Code hook: the "fence" layer of the cc-sdd → Moira adapter.
//
// It catches the firing-misses that recurred across two real demo runs (see
// demo-log.take1.md). ONE behavior is a hard enforcement, the rest are advisory:
//   - HARD DENY (PreToolUse): `moira add` without --parent — the issue #5 footgun
//     whose duplicate decompose edge has no compensation event. Blocked so Claude
//     self-corrects by adding --parent. This is a HEURISTIC textual guard (it also
//     catches compound `a && moira add …`, quoted `bash -c "moira add …"`, and
//     prefixed `env X=1 moira add …` forms), NOT a sandbox — a determined bypass
//     is possible; the primary discipline is "always pass --parent".
//   - ADVISORY REMINDERS (additionalContext, NON-blocking — Claude may still act,
//     so correctness stays the SKILL's responsibility, not the hook's): the start
//     gate before `start`, the assign→ready landmine before `assign`, AC after
//     `done`, and "restart moira ui" after any mutating command.
//
// Contract (Claude Code hooks):
//   - stdin  = one JSON object: { hook_event_name, tool_name, tool_input:{command}, ... }
//   - PreToolUse deny   → stdout {hookSpecificOutput:{hookEventName,permissionDecision:"deny",permissionDecisionReason}}
//   - PreToolUse remind → stdout {hookSpecificOutput:{hookEventName,additionalContext}}  (no decision → normal flow)
//   - PostToolUse remind→ stdout {hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext}}
//   - always exit 0; stdout must be JSON-only. On any error we FAIL OPEN (a broken
//     guard must never block real work).
//
// This file touches nothing in moira itself — it lives in the playground's
// .claude/ and only reads the Bash command string.

import { readFileSync } from 'node:fs';

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

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return; // unparseable stdin → fail open
  }

  const event = input.hook_event_name;
  if (input.tool_name !== 'Bash') return;
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !command.includes('moira')) return;

  const segs = segments(command);

  // ── PreToolUse ────────────────────────────────────────────────────────────
  if (event === 'PreToolUse') {
    // (1) HARD STOP: `moira add` without --parent falls back to the project root
    //     and creates a duplicate decompose edge that has NO compensation event
    //     (issue #5) — recoverable only by a full seed replay. Block and let
    //     Claude self-correct by adding --parent.
    const badAdds = segs.filter((s) => isMoira(s, 'add') && !/--parent(\s|=)/.test(s));
    if (badAdds.length > 0) {
      emit({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            '`moira add` は必ず --parent <正しい親> を付ける。省くと親がプロジェクト根 (todo-app) に ' +
            'フォールバックし、todo-app → <node> という二重 decompose 辺が生まれてノードが有効木に二重表示される。' +
            'この誤投入を打ち消す補償イベントは無く (issue #5)、小規模ログは seed 全再生でしか直せない。' +
            '例: moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude。' +
            `該当: ${badAdds.join(' / ')}`,
        },
      });
      return;
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
      emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: notes.join('\n') } });
    }
    return;
  }

  // ── PostToolUse ───────────────────────────────────────────────────────────
  if (event === 'PostToolUse') {
    const notes = [];
    if (segs.some((s) => isMoira(s, 'done'))) {
      notes.push(
        '完了時 AC 記録の義務: done したノードは実コストを moira cost <node> <実工数md> [--actor agent:claude] で ' +
          '記録すると CPI (=EV_abs/AC) が n/a から立つ。値は実測 — 手元に無ければ人間に確認し、捏造しない。' +
          'moira cost は id 重複排除つき累積加算 (fold.ts:182-184) なので同じ工数を二重計上しない。',
      );
    }
    if (segs.some((s) => MUTATING.test(s))) {
      notes.push(
        'moira にイベントを追記した。moira ui は起動時スナップショット (loadEvents を焼き込む・commands.ts:299) の ' +
          'ため、ブラウザ再読込では反映されない。旧サーバを停止 (port 5180 の PID を kill) してから ' +
          'moira ui --port 5180 --no-open で再起動すると最新化される。',
      );
    }
    if (notes.length > 0) {
      emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') } });
    }
    return;
  }
}

try {
  main();
} catch {
  // fail open: never let a guard bug block the tool flow
}
