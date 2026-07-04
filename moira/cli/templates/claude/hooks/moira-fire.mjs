// moira-fire.mjs — Claude Code hook: the deterministic FIRING DETECTOR of the
// methodology → Moira adapter. Distributed by `moira adapter install`
// (canonical source: sdd-workshop moira/cli/templates/).
//
// The playground proved that convention-only firing (a trigger table the LLM is
// supposed to obey) misses milestones. This hook makes the DETECTION
// deterministic while leaving the EMISSION to the moira-track skill (human
// gates for the 5 decisions stay intact — the hook never runs a write verb):
//
//   - PostToolUse (matcher: Edit|MultiEdit|Write|NotebookEdit):
//     a write matched a provider TRIGGER (declarative config, ADR-0003 Stage 2:
//     `.claude/moira-provider.json`; absent → the embedded cc-sdd default) →
//     read that file (HOT PATH: one fs read, NO process spawn) and advise
//     firing the matching `/moira-track <phase>`.
//   - SessionStart (matcher: startup|resume|clear):
//     if the resolved log home has .moira and the provider's artifacts are
//     detected, run `moira adapter drift --json` ONCE (3s timeout, fail-open)
//     and inject a summary when the log lags behind the artifacts. Advice:
//     run `/moira-track sync`.
//   - UserPromptSubmit (matcher-less):
//     the prompt carries an external ticket reference (GitHub/GitLab/Backlog/
//     Jira issue URL — or a bare #N / KEY-N alongside an intent keyword) →
//     advise firing `/moira-track ticket <ref>` (ticket-driven flow, ADR-0004).
//     Engine-generic: ticket-driven entry is orthogonal to the methodology
//     (MODEL A1), so the provider config is NOT consulted — zero file IO.
//
// Contract: stdin = one JSON hook event; stdout = JSON-only additionalContext
// (or nothing); always exit 0 — on ANY error we FAIL OPEN and stay silent.
// `decide()` is exported (with an injectable drift runner) for tests;
// EMBEDDED_DEFAULT is exported so the test suite can assert it stays in
// LOCKSTEP with templates/claude/moira-provider.json (no silent divergence).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const projectDir = () => process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** Resolve the .moira DATA DIR for `base` (multi-repo, ADR-0003) — duplicated
 *  in both hook files on purpose (each .mjs stays a self-contained zero-dep
 *  script). MOIRA_DIR env → base/.moira directory → a `.moira` POINTER FILE
 *  (`home: <path>`, one hop, relative to the pointer's directory) → null.
 *  Fail-soft: any error → null (the hook then simply stays silent). */
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

// ---------------------------------------------------------------------------
// Declarative provider config (ADR-0003 Stage 2)
// ---------------------------------------------------------------------------

/** The embedded cc-sdd default — MUST stay in LOCKSTEP with
 *  templates/claude/moira-provider.json (asserted by the adapter test suite).
 *  Used when the work repo has no `.claude/moira-provider.json` (pre-Stage-2
 *  installs) or the file is unreadable (fail-open to the known-good default). */
export const EMBEDDED_DEFAULT = {
  schemaVersion: 1,
  id: 'cc-sdd',
  displayName: 'cc-sdd (Kiro spec-driven development)',
  detect: ['.kiro/specs'],
  phases: ['discovery', 'estimate', 'requirements', 'design', 'tasks', 'estimate-impl', 'impl', 'sync'],
  nodeScheme: {
    phaseChildren: [
      { suffix: 'req', label: '要件定義' },
      { suffix: 'design', label: '設計' },
      { suffix: 'tasks', label: 'タスク分解' },
    ],
    implPrefix: 'impl-',
    reviewNode: 'review-impl',
  },
  edges: [
    { from: 'req', to: 'design', policy: 'accepted' },
    { from: 'design', to: 'tasks', policy: 'accepted' },
    { from: 'tasks', to: 'impl-*', policy: 'accepted' },
    { from: 'impl-*', to: 'review-impl', policy: 'implemented' },
  ],
  scope: { claim: [] },
  triggers: [
    {
      pathPattern: '(?:^|/)\\.kiro/specs/(?<feature>[^/]+)/spec\\.json$',
      read: 'json',
      advise: [
        {
          when: { anyTrue: ['approvals.tasks.approved', 'ready_for_implementation'] },
          phase: 'tasks',
          message:
            '{file} が更新された（phase={phase}）。tasks 承認済み（実装ノード誕生の節目）。未反映なら /moira-track tasks --feature {feature} を発火し、実装見積が合意でき次第 /moira-track estimate-impl --feature {feature}。この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。取りこぼしの確認は /moira-track sync。',
        },
        {
          when: { anyTrue: ['approvals.tasks.generated'], phaseEquals: 'tasks-generated' },
          phase: 'tasks',
          message:
            '{file} が更新された（phase={phase}）。tasks 生成済み。未反映なら /moira-track tasks --feature {feature}。この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。取りこぼしの確認は /moira-track sync。',
        },
        {
          when: { anyTrue: ['approvals.design.approved', 'approvals.design.generated'], phaseEquals: 'design-generated' },
          phase: 'design',
          message:
            '{file} が更新された（phase={phase}）。design の節目。未反映なら /moira-track design --feature {feature}。この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。取りこぼしの確認は /moira-track sync。',
        },
        {
          when: { anyTrue: ['approvals.requirements.approved', 'approvals.requirements.generated'], phaseEquals: 'requirements-generated' },
          phase: 'requirements',
          message:
            '{file} が更新された（phase={phase}）。requirements の節目。未反映なら /moira-track requirements --feature {feature}。この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。取りこぼしの確認は /moira-track sync。',
        },
        {
          when: 'always',
          phase: 'discovery',
          message:
            '{file} が更新された（phase={phase}）。spec 初期化を検知。discovery が未反映なら /moira-track discovery --feature {feature}（見積を決めたら estimate）。この編集が cc-sdd の節目なら発火を飛ばさない（規約: .kiro/steering/moira-track.md）。取りこぼしの確認は /moira-track sync。',
        },
      ],
    },
    {
      pathPattern: '(?:^|/)\\.kiro/specs/(?<feature>[^/]+)/tasks\\.md$',
      read: 'checkbox',
      advise: [
        {
          when: 'always',
          phase: 'impl',
          message:
            '{file} が更新された（チェック {checked}/{total}）。実装の進行・完了を Moira に反映するなら /moira-track impl --feature {feature}（done 後の AC 記録を忘れない）。節目の取りこぼしが疑わしければ /moira-track sync。',
        },
      ],
    },
  ],
  drift: { mode: 'builtin', builtin: 'cc-sdd' },
};

/** Read the work repo's provider config; absent/broken → embedded default. */
export function loadProviderConfig(dir) {
  try {
    const raw = JSON.parse(readFileSync(join(dir, '.claude', 'moira-provider.json'), 'utf8'));
    if (raw !== null && raw?.schemaVersion === 1 && Array.isArray(raw.triggers)) return raw;
  } catch {
    /* absent or unreadable → known-good default */
  }
  return EMBEDDED_DEFAULT;
}

const ctx = (hookEventName, additionalContext) => ({
  hookSpecificOutput: { hookEventName, additionalContext },
});

const dotted = (obj, path) =>
  path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);

function ruleMatches(rule, data) {
  if (rule.when === 'always') return true;
  const w = rule.when ?? {};
  if (Array.isArray(w.anyTrue) && w.anyTrue.some((p) => dotted(data.json, p) === true)) return true;
  if (typeof w.phaseEquals === 'string' && data.phase === w.phaseEquals) return true;
  return false;
}

function fillMessage(message, vars) {
  return message
    .replaceAll('{file}', vars.file)
    .replaceAll('{feature}', vars.feature)
    .replaceAll('{phase}', vars.phase ?? '?')
    .replaceAll('{checked}', String(vars.checked ?? 0))
    .replaceAll('{total}', String(vars.total ?? 0));
}

function decidePostToolUse(input) {
  if (!WRITE_TOOLS.has(input.tool_name)) return undefined;
  const fp = input.tool_input?.file_path;
  if (typeof fp !== 'string') return undefined;
  const norm = fp.replace(/\\/g, '/');
  const cfg = loadProviderConfig(projectDir());

  for (const trigger of cfg.triggers) {
    let m;
    try {
      m = new RegExp(trigger.pathPattern).exec(norm);
    } catch {
      continue; // invalid pattern in a user config → skip that trigger
    }
    const feature = m?.groups?.feature;
    if (feature === undefined) continue;
    const file = m[0].replace(/^\//, '');

    const data = { json: undefined, phase: undefined, checked: undefined, total: undefined };
    if (trigger.read === 'json') {
      try {
        data.json = JSON.parse(readFileSync(fp, 'utf8'));
      } catch {
        return undefined; // mid-edit / broken JSON → silent
      }
      data.phase = typeof data.json?.phase === 'string' ? data.json.phase : '?';
    } else if (trigger.read === 'checkbox') {
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
      if (total === 0) return undefined; // no checkboxes yet → silent
      data.checked = checked;
      data.total = total;
    }

    for (const rule of trigger.advise) {
      if (!ruleMatches(rule, data)) continue;
      return ctx(
        'PostToolUse',
        fillMessage(rule.message, {
          file,
          feature,
          phase: data.phase,
          checked: data.checked,
          total: data.total,
        }),
      );
    }
    return undefined; // trigger matched but no advise rule → silent
  }
  return undefined;
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
  // The log home may live OUTSIDE this repo (MOIRA_DIR / .moira pointer file),
  // and the methodology artifacts are whatever the provider declares.
  const dataDir = resolveMoiraDataDir(dir);
  if (dataDir === null || !existsSync(join(dataDir, 'config.json'))) return undefined;
  const cfg = loadProviderConfig(dir);
  const detected =
    Array.isArray(cfg.detect) && cfg.detect.some((p) => existsSync(join(dir, ...p.split('/'))));
  if (!detected) return undefined;
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
      '成果物の状態に .moira ログが追いついていない。追いつき記録は /moira-track sync' +
      `（read-only 詳細は moira adapter drift）。上位: ${top.join(' / ')}`,
  );
}

// ---------------------------------------------------------------------------
// Ticket-driven flow detection (UserPromptSubmit — engine-generic, ADR-0004)
// ---------------------------------------------------------------------------

// Tier 1 — full ticket URLs fire unconditionally. The ticket system is
// identified by its PATH SHAPE, host-agnostic where self-hosting is common
// (GitLab `/-/issues/`, Jira `/browse/KEY-N`, Backlog `/view/KEY-N`).
const TICKET_URL_PATTERNS = [
  /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/g,
  /https?:\/\/[^\s"'<>]+\/-\/issues\/\d+/g,
  /https?:\/\/[^\s"'<>]+\/browse\/[A-Z][A-Z0-9_]+-\d+/g,
  /https?:\/\/[^\s"'<>]+\/view\/[A-Z][A-Z0-9_]+-\d+/g,
];
// Tier 2 — bare refs (#123 / PROJ-123) fire ONLY alongside an intent keyword:
// a bare #N alone collides with PR refs / markdown headings, a bare KEY-N with
// UTF-8 / SHA-256 style tokens (the worst offenders are blocklisted too).
// Residual false positives are accepted — the advice is non-blocking (ADR-0004).
const TICKET_KEYWORD = /issue|イシュー|チケット|ticket|バグ|不具合|障害|incident/i;
const BARE_REF_PATTERNS = [/(?:^|[\s(（「『])(#\d+)(?=$|[^\w#])/g, /(?:^|[^\w/.-])([A-Z][A-Z0-9_]+-\d+)(?=$|[^\w-])/g];
const NOT_A_TICKET_KEY = /^(?:UTF|SHA|ISO|RFC|CVE)-/;

function decideUserPromptSubmit(input) {
  const prompt = input.prompt;
  if (typeof prompt !== 'string' || prompt === '') return undefined;
  if (/^\s*\/moira-track\b/.test(prompt)) return undefined; // already firing — stay out of the way
  const refs = [];
  for (const re of TICKET_URL_PATTERNS) {
    for (const m of prompt.matchAll(re)) refs.push(m[0]);
  }
  if (refs.length === 0 && TICKET_KEYWORD.test(prompt)) {
    for (const re of BARE_REF_PATTERNS) {
      for (const m of prompt.matchAll(re)) {
        if (!NOT_A_TICKET_KEY.test(m[1])) refs.push(m[1]);
      }
    }
  }
  if (refs.length === 0) return undefined;
  const shown = [...new Set(refs)].slice(0, 3).join(' / ');
  return ctx(
    'UserPromptSubmit',
    `チケット参照を検知: ${shown} — この作業を Moira で追跡するなら /moira-track ticket <ref> を発火する` +
      '（振り付けは moira-track スキルの「チケット駆動の入口」節: 既存パイプラインがあればその最初のフェーズに合流・' +
      '無ければ plan→実行 または 直接実行の最小儀式）。emit はスキルの責務・5 判断の人間ゲートは不変。' +
      '既にノード化済みのチケット（moira log で確認）なら再発火は不要。',
  );
}

/** Decision core (exported for tests; deps.runDrift is injectable). */
export function decide(input, deps = { runDrift }) {
  const event = input.hook_event_name;
  if (event === 'PostToolUse') return decidePostToolUse(input);
  if (event === 'UserPromptSubmit') return decideUserPromptSubmit(input);
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
