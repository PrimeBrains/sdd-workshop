// moira-fire.mjs — Claude Code hook: the deterministic FIRING DETECTOR of the
// cc-sdd → Moira adapter. Distributed by `moira adapter install`
// (canonical source: sdd-workshop moira/cli/templates/).
//
// The playground proved that convention-only firing (a trigger table the LLM is
// supposed to obey) misses milestones. This hook makes the DETECTION
// deterministic while leaving the EMISSION to the moira-track skill (human
// gates for the 5 decisions stay intact — the hook never runs a write verb):
//
//   - PostToolUse (matcher: Edit|MultiEdit|Write|NotebookEdit):
//     a write landed in .kiro/specs/<feature>/(spec.json|tasks.md) → read that
//     file (HOT PATH: one fs read, NO process spawn) and advise firing the
//     matching `/moira-track <phase>`.
//   - SessionStart (matcher: startup|resume|clear):
//     if the repo has .moira + .kiro/specs, run `moira adapter drift --json`
//     ONCE (3s timeout, fail-open) and inject a summary when the log lags
//     behind .kiro — the catch-all for misses that happened outside this
//     session. Advice: run `/moira-track sync`.
//
// Contract: stdin = one JSON hook event; stdout = JSON-only additionalContext
// (or nothing); always exit 0 — on ANY error we FAIL OPEN and stay silent.
// `decide()` is exported (with an injectable drift runner) for tests.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const WRITE_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const projectDir = () => process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const ctx = (hookEventName, additionalContext) => ({
  hookSpecificOutput: { hookEventName, additionalContext },
});

/** spec.json の内容から「最も進んだ節目」に対応する発火助言を組み立てる。 */
function specAdvice(spec, feature) {
  const a = spec?.approvals ?? {};
  const phase = typeof spec?.phase === 'string' ? spec.phase : '';
  const flag = (k, f) => a?.[k]?.[f] === true;
  if (flag('tasks', 'approved') || spec?.ready_for_implementation === true) {
    return (
      `tasks 承認済み（実装ノード誕生の節目）。未反映なら /moira-track tasks --feature ${feature} を発火し、` +
      `実装見積が合意でき次第 /moira-track estimate-impl --feature ${feature}`
    );
  }
  if (flag('tasks', 'generated') || phase === 'tasks-generated') {
    return `tasks 生成済み。未反映なら /moira-track tasks --feature ${feature}`;
  }
  if (flag('design', 'approved') || flag('design', 'generated') || phase === 'design-generated') {
    return `design の節目。未反映なら /moira-track design --feature ${feature}`;
  }
  if (
    flag('requirements', 'approved') ||
    flag('requirements', 'generated') ||
    phase === 'requirements-generated'
  ) {
    return `requirements の節目。未反映なら /moira-track requirements --feature ${feature}`;
  }
  return `spec 初期化を検知。discovery が未反映なら /moira-track discovery --feature ${feature}（見積を決めたら estimate）`;
}

function decidePostToolUse(input) {
  if (!WRITE_TOOLS.has(input.tool_name)) return undefined;
  const fp = input.tool_input?.file_path;
  if (typeof fp !== 'string') return undefined;
  const norm = fp.replace(/\\/g, '/');
  const m = /(?:^|\/)\.kiro\/specs\/([^/]+)\/(spec\.json|tasks\.md)$/.exec(norm);
  if (m === null) return undefined;
  const feature = m[1];

  if (m[2] === 'spec.json') {
    let spec;
    try {
      spec = JSON.parse(readFileSync(fp, 'utf8'));
    } catch {
      return undefined; // mid-edit / broken JSON → silent
    }
    return ctx(
      'PostToolUse',
      `.kiro/specs/${feature}/spec.json が更新された（phase=${spec?.phase ?? '?'}）。` +
        `${specAdvice(spec, feature)}。` +
        'この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。' +
        '取りこぼしの確認は /moira-track sync。',
    );
  }

  // tasks.md
  let text;
  try {
    text = readFileSync(fp, 'utf8');
  } catch {
    return undefined;
  }
  let checked = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const cb = /^\s*- \[( |x|X)\]/.exec(line);
    if (cb === null) continue;
    total += 1;
    if (cb[1] !== ' ') checked += 1;
  }
  if (total === 0) return undefined;
  return ctx(
    'PostToolUse',
    `.kiro/specs/${feature}/tasks.md が更新された（チェック ${checked}/${total}）。` +
      `実装の進行・完了を Moira に反映するなら /moira-track impl --feature ${feature}` +
      '（done 後の AC 記録を忘れない）。節目の取りこぼしが疑わしければ /moira-track sync。',
  );
}

/** `moira adapter drift --json` を 1 回だけ実行（fail-open）。 */
function runDrift(dir) {
  try {
    // Single fixed literal (no interpolation) — shell:true resolves moira.cmd on
    // Windows, and a whole-string command avoids the DEP0190 args-escaping warning.
    const r = spawnSync('moira adapter drift --json', {
      cwd: dir,
      shell: true,
      timeout: 3000,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (r.status !== 0 || typeof r.stdout !== 'string' || r.stdout.trim() === '') return undefined;
    return JSON.parse(r.stdout);
  } catch {
    return undefined;
  }
}

function decideSessionStart(deps) {
  const dir = projectDir();
  // Fast preconditions — repos without the adapter's data simply stay silent.
  if (!existsSync(`${dir}/.moira/config.json`) || !existsSync(`${dir}/.kiro/specs`)) return undefined;
  const report = deps.runDrift(dir);
  if (report === undefined || report === null) return undefined;
  const s = report.summary ?? {};
  const hard = s.hard ?? 0;
  const needsHuman = s.needsHuman ?? 0;
  if (hard + needsHuman === 0) return undefined; // clean or advisory-only → no noise

  const top = [];
  outer: for (const f of report.features ?? []) {
    for (const n of f.nodes ?? []) {
      if (n.status === 'missing-node' || n.status === 'behind' || n.status === 'needs-human') {
        top.push(`${n.status}: ${n.node}`);
        if (top.length >= 5) break outer;
      }
    }
  }
  return ctx(
    'SessionStart',
    `Moira drift 検知: hard ${hard} / needs-human ${needsHuman} / advisory ${s.advisory ?? 0} — ` +
      '.kiro の状態に .moira ログが追いついていない。追いつき記録は /moira-track sync' +
      `（read-only 詳細は moira adapter drift）。上位: ${top.join(' / ')}`,
  );
}

/** Decision core (exported for tests; deps.runDrift is injectable). */
export function decide(input, deps = { runDrift }) {
  const event = input.hook_event_name;
  if (event === 'PostToolUse') return decidePostToolUse(input);
  if (event === 'SessionStart') return decideSessionStart(deps);
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
    // fail open: never let a detector bug block the tool flow
  }
}
