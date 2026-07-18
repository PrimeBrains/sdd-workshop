// Command handlers + dispatch. Each write command is a thin "load → emit → append
// → save" over the four canonical events; show/ui are read-only over derive().
// stdout = data; stderr = warnings/progress (so the CLI is automation-friendly).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { CapacityStore, derive, fold, orgCalendarFallback } from 'moira-backend';
import type { Actor, DeriveOptions, Event, LifecycleState } from 'moira-backend';
import { parseActor } from './actors.js';
import { writeWbsTemplate } from './xlsx/wbs-template.js';
import { parseWbsSheet, planWbsEvents, validateWbs } from './xlsx/wbs-import.js';
import { packSchedule } from './xlsx/wbs-pack.js';
import { writeMembersTemplate } from './xlsx/members-template.js';
import {
  parseCalendarSheet,
  parseHolidaySheet,
  parseMembersSheet,
  planMembersImport,
  validateMembersImport,
} from './xlsx/members-import.js';
import { runAdapter } from './adapter/index.js';
import { confirmDestructive } from './confirm.js';
import { CliError } from './errors.js';
import {
  agreeEvent,
  assignEvent,
  capacityEntry,
  costEvent,
  decomposeEvent,
  lifecycleEvent,
  relateEvent,
} from './emit.js';
import { lastNBusinessDays, previousBusinessDay } from './business-days.js';
import { formatSnapshot } from './format.js';
import { buildReport, formatReportText, reportFilename } from './report.js';
import { getGlobalDir, resolveMoiraHome, setGlobalDir } from './home.js';
import { frontendDistDir } from './paths.js';
import {
  fallbackLabel,
  loadPortfolioConfig,
  resolvePortfolioEntries,
} from './portfolio.js';
import { realStamper } from './stamp.js';
import {
  isIsoDate,
  type Member,
  type MilestoneEntry,
  MoiraRepo,
  resolveMilestones,
  resolveReferenceDates,
  type MoiraConfig,
  type ReferenceDateEntry,
} from './store.js';
import { resolveAddParent } from './tree.js';
import {
  serveUi,
  type PortfolioUiFixture,
  type PortfolioUiProject,
  type UiFixture,
} from './ui-server.js';

const out = (s: string): void => void process.stdout.write(`${s}\n`);
const err = (s: string): void => void process.stderr.write(`${s}\n`);

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type Opts = Record<string, { type: 'string' | 'boolean'; short?: string; multiple?: boolean }>;
interface Parsed {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}
function parse(args: string[], options: Opts): Parsed {
  const r = parseArgs({ args, options, allowPositionals: true });
  return {
    values: r.values as Record<string, string | boolean | undefined>,
    positionals: r.positionals,
  };
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function statIsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function requireRepo(): MoiraRepo {
  // Log-home resolution (multi-repo, ADR-0003): --dir > MOIRA_DIR > pointer /
  // upward walk > cwd. With none of those set and .moira/ in cwd this is
  // byte-identical to the pre-Stage-1 behavior.
  const flagDir = getGlobalDir();
  const home = resolveMoiraHome({
    ...(flagDir !== undefined ? { flagDir } : {}),
    env: process.env,
    startDir: process.cwd(),
  });
  const repo = new MoiraRepo(home.root);
  if (!repo.exists()) {
    throw new CliError(
      'no .moira/ found — run `moira init` first ' +
        '(探索済み: cwd と上位ディレクトリ・--dir/MOIRA_DIR・.moira ポインタファイル)',
    );
  }
  return repo;
}

function meActor(cfg: MoiraConfig): Actor {
  return parseActor(cfg.me); // a plain dev id → human (estimate-agreement requires human)
}

function buildDeriveOptions(repo: MoiraRepo, asOf?: string, startDate?: string): DeriveOptions {
  const cfg = repo.loadConfig();
  const opts: DeriveOptions = { asOf: asOf ?? cfg.asOf ?? today() };
  const sd = startDate ?? cfg.startDate;
  if (sd !== undefined) opts.startDate = sd;
  const cap = repo.loadCapacity();
  const store = new CapacityStore();
  store.appendAll(cap);
  // Org calendar (issue #32): default-on — `orgCalendar.enabled` UNSET or `true`
  // makes weekends + JP holidays fall back to 0 capacity instead of the blanket
  // 1.0 default, so unspecified days never silently schedule work on
  // non-working days. `store.lookup()` is always wired now (previously this
  // branch was skipped entirely when capacity.json had zero entries, which
  // meant "no capacity data at all" silently disabled the org calendar too).
  const fallback = cfg.orgCalendar?.enabled !== false ? orgCalendarFallback({ warn: err }) : undefined;
  opts.capacityOf = store.lookup(fallback);
  return opts;
}

// --- write commands -------------------------------------------------------

function cmdInit(rest: string[]): void {
  const { values } = parse(rest, {
    me: { type: 'string' },
    label: { type: 'string' },
    root: { type: 'string' },
    asOf: { type: 'string' },
  });
  // init deliberately does NOT walk up (git-init nesting semantics): the target
  // is the explicit --dir, else MOIRA_DIR, else cwd.
  const target = resolve(getGlobalDir() ?? process.env.MOIRA_DIR ?? process.cwd());
  if (existsSync(join(target, '.moira')) && !statIsDir(join(target, '.moira'))) {
    throw new CliError(
      `${join(target, '.moira')} は .moira ポインタファイル — ここは作業リポジトリ。` +
        'ログ home 側（ポインタの指し先）で init する',
    );
  }
  const repo = new MoiraRepo(target);
  if (repo.exists()) {
    err('.moira/ already exists here — nothing to do.');
    return;
  }
  const projectRoot = str(values.root) ?? 'root';
  const me = str(values.me) ?? 'me';
  const config: MoiraConfig = { projectRoot, me };
  const asOf = str(values.asOf);
  if (asOf !== undefined) config.asOf = asOf;
  repo.init(config);
  const label = str(values.label);
  if (label !== undefined) repo.setNodeLabel(projectRoot, label);
  repo.setActorLabel(me, me);
  out(`Initialized .moira/ (projectRoot=${projectRoot}, me=${me}).`);
  out('Next: moira add <id> --estimate <md> --label "..."  then  moira agree <id>');
}

function cmdAdd(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    estimate: { type: 'string' },
    parent: { type: 'string' },
    label: { type: 'string' },
    actor: { type: 'string' },
    reason: { type: 'string' },
  });
  const node = positionals[0];
  if (node === undefined) throw new CliError('usage: moira add <id> [--estimate <md>] [--parent <id>] [--label "..."]');
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  // Parent: explicit flag > the node's existing tree parent > project root
  // (with a visible note either way — issue #5's silent root fallback minted
  // a second decompose edge and a doubled tree).
  const { parent, note } = resolveAddParent(
    fold(repo.loadEvents()),
    node,
    str(values.parent),
    cfg.projectRoot,
  );
  if (note !== undefined) err(note);
  const actor = str(values.actor) !== undefined ? parseActor(str(values.actor)!) : meActor(cfg);
  const estStr = str(values.estimate);
  const child = estStr === undefined ? { node } : { node, estimate: Number(estStr) };
  const ev = decomposeEvent(
    realStamper()(),
    actor,
    parent,
    [child],
    str(values.reason) ?? `moira add ${node}`,
  );
  repo.appendEvents([ev]);
  const label = str(values.label);
  if (label !== undefined) repo.setNodeLabel(node, label);
  out(`+ decompose ${parent} → ${node}${estStr === undefined ? ' (unestimated)' : ` (estimate ${estStr})`}`);
}

function cmdAgree(rest: string[]): void {
  const { values, positionals } = parse(rest, { budget: { type: 'string' } });
  const node = positionals[0];
  if (node === undefined) throw new CliError('usage: moira agree <id> [--budget <md>]');
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const budgetStr = str(values.budget);
  if (budgetStr === undefined && !hasEstimate(repo.loadEvents(), node)) {
    err(`warning: ${node} has no proposed estimate and no --budget; agreeing with a null budget.`);
  }
  const ev =
    budgetStr === undefined
      ? agreeEvent(realStamper()(), meActor(cfg), node)
      : agreeEvent(realStamper()(), meActor(cfg), node, Number(budgetStr));
  repo.appendEvents([ev]);
  out(`✓ agreed estimate ${node}${budgetStr === undefined ? '' : ` (budget ${budgetStr})`} [human commit]`);
}

function cmdAssign(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    to: { type: 'string' },
    reviewer: { type: 'string' },
    slot: { type: 'string' },
  });
  const node = positionals[0];
  const to = str(values.to);
  if (node === undefined || to === undefined) {
    throw new CliError('usage: moira assign <id> --to <who> [--reviewer <who>] [--slot <date>]');
  }
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const assignee = parseActor(to);
  const reviewer = str(values.reviewer) !== undefined ? parseActor(str(values.reviewer)!) : undefined;
  const slot = str(values.slot);
  if (slot !== undefined && !isIsoDate(slot)) {
    throw new CliError(`invalid --slot: ${slot} (expected YYYY-MM-DD)`);
  }
  // §2.5 terminality (issue #37 item 3 consistency): assignEvent's lifecycle
  // `to` defaults to 'ready' — an assign on a cancelled node would otherwise
  // silently pull it back OUT of its terminal state, the exact same hole
  // cmdLifecycle closes below for start/done/accept/cancel.
  const before = fold(repo.loadEvents()).nodes.get(node);
  if (before?.lifecycle === 'cancelled') {
    throw new CliError(
      `${node} は cancelled（終端）— assign は拒否されます（§2.5）。誤 cancel の場合は新規ノードとして再作成する（正典の回復路）`,
    );
  }
  const opts: { reviewer?: Actor; frozenSlot?: string } = {};
  if (reviewer !== undefined) opts.reviewer = reviewer;
  // First-scheduling-only freeze (§3② MODEL:194-195, fold.ts:156-158): a slot
  // on an ALREADY-frozen node is silently ignored by fold — issue #37 item 1
  // (analysis §3.1#1) is precisely that the CLI used to print a bare success
  // line regardless, so a second `--slot` looked like a correction that
  // actually did nothing. Warn honestly instead; the event is still appended
  // (append-only — the attempt stays in the log) and the assignee change
  // (latest-wins, legitimate) still goes through.
  let slotNote = '';
  if (slot !== undefined) {
    opts.frozenSlot = slot;
    if (before?.frozenSlot != null) {
      err(`warning: ${node} は初回凍結済みのため slot は無効（凍結値: ${before.frozenSlot}）`);
      slotNote = ` slot ${slot}（無効・凍結値 ${before.frozenSlot} のまま）`;
    } else {
      slotNote = ` slot ${slot}`;
    }
  }
  const ev = assignEvent(realStamper()(), meActor(cfg), node, assignee, opts);
  repo.appendEvents([ev]);
  repo.setActorLabel(assignee.id, assignee.id);
  if (reviewer !== undefined) repo.setActorLabel(reviewer.id, reviewer.id);
  out(
    `→ assigned ${node} to ${assignee.kind}:${assignee.id}` +
      `${reviewer === undefined ? '' : ` (reviewer ${reviewer.id})`}` +
      `${slotNote} [human commit]`,
  );
}

const LIFECYCLE_STATES = new Set<LifecycleState>([
  'pending', 'ready', 'implementing', 'implemented', 'accepted', 'cancelled',
]);

async function cmdLifecycle(rest: string[], to: LifecycleState, verb: string): Promise<void> {
  const { values, positionals } = parse(rest, {
    actor: { type: 'string' },
    reason: { type: 'string' },
    yes: { type: 'boolean', short: 'y' },
  });
  const node = positionals[0];
  if (node === undefined) throw new CliError(`usage: moira ${verb} <id> [--actor <who>] [--yes|-y]`);
  // Defense-in-depth (issue #37 item 3b): the CLI hardcodes `to` per verb, so a
  // machine/to mismatch (e.g. an estimate value leaking into a lifecycle
  // transition) cannot actually occur through this write path today — this
  // guard documents that invariant and catches it if a future refactor ever
  // makes `to` dynamic.
  if (!LIFECYCLE_STATES.has(to)) throw new CliError(`internal: invalid lifecycle target '${to}'`);
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  // §2.5 terminality (issue #37 item 3a): cancelled is terminal — fold accepts
  // ANY transition unconditionally (fold.ts:142-158 is intentionally lax, for
  // past-log compatibility), so this write-layer check is the only place that
  // enforces "no re-transition FROM cancelled". Forward-skips (ready→implemented,
  // §7#13(b)) and honest backward moves (implemented→implementing, P5) are NOT
  // touched — only cancelled's terminal edge is closed.
  const current = fold(repo.loadEvents()).nodes.get(node)?.lifecycle;
  if (current === 'cancelled') {
    throw new CliError(
      `${node} は cancelled（終端）— これ以上の遷移は拒否されます（§2.5）。誤 cancel の場合は新規ノードとして再作成する（正典の回復路）`,
    );
  }
  // Destructive-command confirmation (issue #37 item 7): cancel/done only —
  // start/accept never prompt. Non-TTY (pipes/agents/CI/this repo's own tests)
  // always passes through unconfirmed (confirm.ts's hard constraint).
  if (verb === 'cancel' || verb === 'done') {
    const proceed = await confirmDestructive(`${node} を ${verb} にする — よろしいですか？`, {
      yes: values.yes === true,
    });
    if (!proceed) {
      err(`中止しました（${node} は変更されていません）`);
      return;
    }
  }
  const actor = str(values.actor) !== undefined ? parseActor(str(values.actor)!) : meActor(cfg);
  const reason = str(values.reason);
  const ev =
    reason === undefined
      ? lifecycleEvent(realStamper()(), actor, node, to)
      : lifecycleEvent(realStamper()(), actor, node, to, reason);
  repo.appendEvents([ev]);
  out(`• ${node} → ${to}`);
}

// Above this: a single cost entry judged unusually large (input-mistake smell,
// e.g. a MD/hour unit slip) — warned, never rejected (§4 (a) is append-only,
// never blocks a true value; the human decides).
const COST_ANOMALY_THRESHOLD_MD = 5;

function cmdCost(rest: string[]): void {
  const { values, positionals } = parse(rest, { actor: { type: 'string' } });
  const node = positionals[0];
  const amountStr = positionals[1];
  if (node === undefined || amountStr === undefined) throw new CliError('usage: moira cost <id> <md>');
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const amount = Number(amountStr);
  // issue #37 item 2(a): `Number("5o")` is NaN, which slips past a plain `<0`
  // guard (NaN<0 is false) and would NaN-poison every downstream AC/CPI
  // aggregate (analysis §3.1#2). Rejected here — before any append — the same
  // way isIsoDate rejects a malformed date elsewhere in this file.
  if (!Number.isFinite(amount)) {
    throw new CliError(`invalid amount: "${amountStr}" は有効な数値ではありません（例: 0.5）`);
  }
  // issue #37 item 2(b): a typo'd node id would otherwise silently mint a
  // ghost node (fold.ts's `ensure()` auto-creates any id it sees) and book
  // cost onto it with no visible signal. Require the id to already be known to
  // the log (via `moira add`/decompose) before crediting cost to it.
  const state = fold(repo.loadEvents());
  if (!state.nodes.has(node)) {
    throw new CliError(
      `unknown node: "${node}" はイベントログに現れません（幽霊ノードへの計上を防止 — 先に moira add で作成するか、ID の打ち間違いを確認）`,
    );
  }
  // issue #37 item 2(c): anomaly warning, not a rejection (negative amounts
  // stay fold's job — A6/§2.8, unchanged by this task).
  if (amount > COST_ANOMALY_THRESHOLD_MD) {
    err(`warning: ${node} への 1 回の計上 ${amount} MD は大きめです（入力ミスの可能性を確認 — 単位の取り違え等）`);
  }
  const actor = str(values.actor) !== undefined ? parseActor(str(values.actor)!) : meActor(cfg);
  const ev = costEvent(realStamper()(), actor, node, amount);
  repo.appendEvents([ev]);
  out(`$ cost ${node} += ${amount} MD`);
}

function cmdRelate(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    kind: { type: 'string' },
    policy: { type: 'string' },
    remove: { type: 'boolean' },
  });
  const from = positionals[0];
  const to = positionals[1];
  if (from === undefined || to === undefined) {
    throw new CliError('usage: moira relate <from> <to> [--kind dependency|supersede] [--policy accepted|implemented] [--remove]');
  }
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const edgeKind = (str(values.kind) ?? 'dependency') as 'dependency' | 'supersede';
  const op = values.remove === true ? 'remove' : 'add';
  const policy = str(values.policy) as 'accepted' | 'implemented' | undefined;
  // issue #37 item 6(a): fold NEVER dedups relate/add (fold.ts just pushes —
  // analysis §3.1 "落とし穴: 辺は重複を許し"), so a repeated `moira relate`
  // used to silently mint a second edge for the same pair with no signal.
  // Reject a would-be exact duplicate up front — `--remove` first is the way
  // to change an edge's policy, matching item 6(b)'s policy-scoped remove.
  if (op === 'add') {
    const state = fold(repo.loadEvents());
    const existing =
      edgeKind === 'supersede'
        ? state.supersedeEdges.some((e) => e.from === from && e.to === to)
        : state.dependencyEdges.some((e) => e.from === from && e.to === to);
    if (existing) {
      throw new CliError(
        `${edgeKind} 辺 '${from}'→'${to}' は既に存在します（重複 add は拒否 — policy を変えたい場合は先に \`moira relate ${from} ${to} --kind ${edgeKind} --remove\`）`,
      );
    }
  }
  const ev = relateEvent(realStamper()(), meActor(cfg), op, from, to, edgeKind, policy);
  repo.appendEvents([ev]);
  out(`⇄ ${op} ${edgeKind} ${from} → ${to}`);
}

function cmdCapacity(rest: string[]): void {
  const { values, positionals } = parse(rest, { reason: { type: 'string' } });
  const who = positionals[0];
  const date = positionals[1];
  const cStr = positionals[2];
  if (who === undefined || date === undefined || cStr === undefined) {
    throw new CliError('usage: moira capacity <who> <YYYY-MM-DD> <c 0..1> [--reason ...]');
  }
  // issue #37 item 5: symmetric with `member add --capacity`'s existing
  // isFinite/[0,1] check (commands.ts cmdMemberAdd) — this second capacity
  // input path had neither a date-shape nor a range check (analysis §3.1 table
  // "日付形式・[0,1] 範囲とも未検証").
  if (!isIsoDate(date)) throw new CliError(`invalid date: ${date} (expected YYYY-MM-DD)`);
  const c = Number(cStr);
  if (!Number.isFinite(c) || c < 0 || c > 1) throw new CliError(`c must be a number in [0,1]: ${cStr}`);
  const repo = requireRepo();
  const entry = capacityEntry(realStamper()(), who, date, c, str(values.reason) ?? 'manual');
  repo.appendCapacity([entry]);
  out(`c(${who}, ${date}) = ${c} [human commit]`);
}

function cmdDeadline(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    target: { type: 'string' },
    reason: { type: 'string' },
  });
  const repo = requireRepo();
  const date = positionals[0];
  const target = str(values.target);

  if (date === undefined && target === undefined) {
    // read-only: show the current latest-wins resolution
    const cur = resolveReferenceDates(repo.loadDateEntries());
    out(`deadline: ${cur.deadline ?? '(unset)'}   target: ${cur.targetDate ?? '(unset)'}`);
    return;
  }

  if (date !== undefined && !isIsoDate(date)) {
    throw new CliError(`invalid date: ${date} (expected YYYY-MM-DD)`);
  }
  if (target !== undefined && !isIsoDate(target)) {
    throw new CliError(`invalid --target: ${target} (expected YYYY-MM-DD)`);
  }

  // R-T6 (MODEL:233-240): both dates are second-tier config inputs — appended
  // to a reason-stamped history (never the event log), latest-ts wins.
  const stamp = realStamper();
  const reason = str(values.reason) ?? 'moira deadline';
  const entries: ReferenceDateEntry[] = [];
  if (date !== undefined) entries.push({ kind: 'deadline', date, reason, ts: stamp().ts });
  if (target !== undefined) entries.push({ kind: 'target', date: target, reason, ts: stamp().ts });
  repo.appendDateEntries(entries);

  const cur = resolveReferenceDates(repo.loadDateEntries());
  // R-T6 boundary (MODEL:238): target > deadline is a CONFIG-ERROR WARNING —
  // the system warns, the human decides. The append is recorded either way.
  if (cur.deadline !== undefined && cur.targetDate !== undefined && cur.targetDate > cur.deadline) {
    err(`warning: target (${cur.targetDate}) is after deadline (${cur.deadline}) — 構成エラー（R-T6）。バッファ/判定は N/A になります。`);
  }
  out(`deadline: ${cur.deadline ?? '(unset)'}   target: ${cur.targetDate ?? '(unset)'} [human commit]`);
}

// --- milestone commands (issue #35) -----------------------------------------
//
// A milestone is a NAME + a constituent node-id bundle only — no date, no
// buffer (MODEL §7#12 explicitly deferred that; a milestone's "planned/
// forecast end" is DERIVED, read via `moira report`, never a stored input
// here). Same append-only/reason-stamped/timestamped/latest-ts-wins discipline
// as `moira deadline`, but keyed per milestone name (store.ts resolveMilestones).

function cmdMilestone(rest: string[]): void {
  const sub = rest[0];
  if (sub === 'set') return cmdMilestoneSet(rest.slice(1));
  if (sub === 'remove') return cmdMilestoneRemove(rest.slice(1));
  if (sub === undefined) return cmdMilestoneList(rest);
  throw new CliError(
    'usage: moira milestone [set <name> --nodes <id1,id2,...> [--reason ...] | remove <name> [--reason ...]]',
  );
}

function cmdMilestoneList(rest: string[]): void {
  parse(rest, {});
  const repo = requireRepo();
  const defs = resolveMilestones(repo.loadMilestoneEntries());
  if (defs.length === 0) {
    out('(no milestones yet — moira milestone set <name> --nodes <id1,id2,...>)');
    return;
  }
  for (const m of defs) {
    out(`  ${m.name}  (${m.nodes.length} nodes): [${m.nodes.join(', ')}]`);
  }
}

function cmdMilestoneSet(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    nodes: { type: 'string' },
    reason: { type: 'string' },
  });
  const name = positionals[0];
  const nodesStr = str(values.nodes);
  if (name === undefined || nodesStr === undefined) {
    throw new CliError('usage: moira milestone set <name> --nodes <id1,id2,...> [--reason ...]');
  }
  const nodes = nodesStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (nodes.length === 0) {
    throw new CliError(
      'moira milestone set requires at least one node id in --nodes（解散は `moira milestone remove` を使う）',
    );
  }

  const repo = requireRepo();
  // Node-existence check is advisory only (a warning, not a reject): the
  // milestone bundle can legitimately reference a node the log doesn't know
  // about yet (typo OR not-yet-decomposed) — same "warn, human decides"
  // discipline as R-T6's target>deadline check in cmdDeadline.
  const state = fold(repo.loadEvents());
  const unknown = nodes.filter((id) => !state.nodes.has(id));
  if (unknown.length > 0) {
    err(`warning: イベントログに現れないノード id: [${unknown.join(', ')}]`);
  }

  const reason = str(values.reason) ?? 'moira milestone set';
  const entry: MilestoneEntry = { milestone: name, nodes, reason, ts: realStamper()().ts };
  repo.appendMilestoneEntries([entry]);
  out(`+ milestone ${name}  (${nodes.length} nodes): [${nodes.join(', ')}] [human commit]`);
}

function cmdMilestoneRemove(rest: string[]): void {
  const { values, positionals } = parse(rest, { reason: { type: 'string' } });
  const name = positionals[0];
  if (name === undefined) {
    throw new CliError('usage: moira milestone remove <name> [--reason ...]');
  }
  const repo = requireRepo();
  const reason = str(values.reason) ?? 'moira milestone remove';
  const entry: MilestoneEntry = { milestone: name, nodes: [], reason, ts: realStamper()().ts };
  repo.appendMilestoneEntries([entry]);
  out(`- milestone ${name} 解散 [human commit]`);
}

// --- config commands --------------------------------------------------------

function cmdConfig(rest: string[]): void {
  const sub = rest[0];
  if (sub === 'org-calendar') return cmdConfigOrgCalendar(rest.slice(1));
  throw new CliError('usage: moira config org-calendar [on|off]');
}

/** Toggle the org calendar (weekends + JP holidays) capacity fallback (issue
 *  #32). Read-only with no arg (shows the current, default-on resolution);
 *  `on`/`off` persists the choice into config.json's `orgCalendar.enabled`
 *  (a plain config field, not an append-only history — unlike deadline/target). */
function cmdConfigOrgCalendar(rest: string[]): void {
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const arg = rest[0];
  if (arg === undefined) {
    const enabled = cfg.orgCalendar?.enabled !== false;
    out(`org-calendar: ${enabled ? 'on' : 'off'}${cfg.orgCalendar === undefined ? ' (既定)' : ''}`);
    return;
  }
  if (arg !== 'on' && arg !== 'off') {
    throw new CliError('usage: moira config org-calendar [on|off]');
  }
  repo.writeConfig({ ...cfg, orgCalendar: { enabled: arg === 'on' } });
  out(`org-calendar: ${arg}`);
}

// --- roster (members) commands --------------------------------------------

function cmdMember(rest: string[]): void {
  const sub = rest[0];
  const args = rest.slice(1);
  if (sub === 'add') return cmdMemberAdd(args);
  if (sub === 'list') return cmdMemberList(args);
  throw new CliError('usage: moira member add <id> --label <name> [--capacity <0..1>] [--kind human|agent]\n       moira member list');
}

function cmdMemberAdd(rest: string[]): void {
  const { values, positionals } = parse(rest, {
    label: { type: 'string' },
    capacity: { type: 'string' },
    kind: { type: 'string' },
  });
  const id = positionals[0];
  if (id === undefined) {
    throw new CliError('usage: moira member add <id> --label <name> [--capacity <0..1>] [--kind human|agent]');
  }
  const label = str(values.label);
  if (label === undefined) throw new CliError('member add requires --label <name>');
  const kindArg = str(values.kind);
  if (kindArg !== undefined && kindArg !== 'human' && kindArg !== 'agent') {
    throw new CliError('--kind must be human or agent');
  }
  // id/kind: accept the actor-spec form ('agent:claude'), store the BARE Actor.id
  // (parseActor) so the roster entry matches assignee/label/capacity ids. --kind
  // overrides the prefix-inferred kind.
  const actor = parseActor(id);
  const kind: Member['kind'] = kindArg ?? actor.kind;
  const capStr = str(values.capacity);
  let defaultCapacity: number | undefined;
  if (capStr !== undefined) {
    const c = Number(capStr);
    if (!Number.isFinite(c) || c < 0 || c > 1) throw new CliError('--capacity must be a number in [0,1]');
    defaultCapacity = c;
  }

  const repo = requireRepo();
  const members = repo.loadMembers();
  const member: Member = { id: actor.id, kind, label };
  if (defaultCapacity !== undefined) member.defaultCapacity = defaultCapacity;
  const idx = members.findIndex((m) => m.id === actor.id);
  if (idx >= 0) members[idx] = member;
  else members.push(member);
  repo.saveMembers(members);
  repo.setActorLabel(actor.id, label); // roster id → display name
  out(`${idx >= 0 ? '~' : '+'} member ${kind}:${actor.id} "${label}"${defaultCapacity === undefined ? '' : ` (既定稼働率 ${defaultCapacity})`}`);
}

function cmdMemberList(rest: string[]): void {
  parse(rest, {});
  const repo = requireRepo();
  const members = repo.loadMembers();
  if (members.length === 0) {
    out('(no members yet — moira member add / moira import members)');
    return;
  }
  for (const m of members) {
    out(`  ${m.kind}:${m.id}  ${m.label}${m.defaultCapacity === undefined ? '' : `  (既定稼働率 ${m.defaultCapacity})`}`);
  }
}

// --- xlsx template / import commands --------------------------------------

async function cmdTemplate(rest: string[]): Promise<void> {
  const { values, positionals } = parse(rest, { out: { type: 'string' } });
  const kind = positionals[0];
  if (kind !== 'wbs' && kind !== 'members') {
    throw new CliError('usage: moira template wbs|members [--out <file.xlsx>]');
  }
  const outPath = str(values.out) ?? (kind === 'wbs' ? 'moira-wbs-template.xlsx' : 'moira-members-template.xlsx');
  if (existsSync(outPath)) {
    throw new CliError(`${outPath} は既に存在します（上書きしません）。別の --out を指定してください。`);
  }
  if (kind === 'wbs') {
    await writeWbsTemplate(outPath);
    out(`Wrote WBS template → ${outPath}`);
    out('記入後: moira import wbs ' + outPath + '  （まず --dry-run で確認を推奨）');
  } else {
    await writeMembersTemplate(outPath);
    out(`Wrote members template → ${outPath}`);
    out('記入後: moira import members ' + outPath + '  （まず --dry-run で確認を推奨）');
  }
}

async function cmdImport(rest: string[]): Promise<void> {
  // This pre-parse only peeks the subcommand (`wbs`|`members`) — it must still
  // declare every option the two subcommands accept (parseArgs rejects unknown
  // flags even when we only read `positionals` back out).
  const { positionals } = parse(rest, { 'dry-run': { type: 'boolean' }, update: { type: 'boolean' } });
  const kind = positionals[0];
  if (kind === 'members') return cmdImportMembers(rest);
  if (kind !== 'wbs') {
    throw new CliError('usage: moira import wbs|members <file.xlsx> [--dry-run]');
  }
  return cmdImportWbs(rest);
}

async function cmdImportWbs(rest: string[]): Promise<void> {
  const { values, positionals } = parse(rest, {
    'dry-run': { type: 'boolean' },
    update: { type: 'boolean' },
  });
  const file = positionals[1];
  if (file === undefined) throw new CliError('usage: moira import wbs <file.xlsx> [--dry-run] [--update]');
  if (!existsSync(file)) throw new CliError(`file not found: ${file}`);

  const repo = requireRepo();
  const cfg = repo.loadConfig();
  // issue #37 item 4 (analysis §4.2#6): --update opens the diff-reimport path —
  // existing ids are no longer a hard error; planWbsEvents applies only what
  // changed (見積 latest-wins re-decompose, new predecessors, changed
  // assignee/slot) and never re-punches actuals/transitions/cost a node
  // already carries. Without the flag, behavior is UNCHANGED: an existing id
  // is still a hard validation error (re-import unsupported, the pre-#37 default).
  const update = values.update === true;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('WBS');
  if (ws === undefined) throw new CliError('シート "WBS" が見つかりません（moira template wbs で雛形を生成できます）');

  // parse → validate: collect ALL errors, write nothing if any.
  const { rows, errors: parseErrors } = parseWbsSheet(ws);
  const priorEvents = repo.loadEvents();
  const projected = fold(priorEvents);
  const validateErrors = validateWbs(rows, projected, cfg.projectRoot, today(), {
    allowExisting: update,
    priorEvents,
  });
  const errors = [...parseErrors, ...validateErrors];
  if (errors.length > 0) {
    for (const e of errors) err(`  error: ${e}`);
    throw new CliError(`検証エラー ${errors.length} 件 — 何も書き込みませんでした。`);
  }
  if (rows.length === 0) {
    err('warning: WBS シートにデータ行がありません（何もしません）。');
    return;
  }

  // pack (fill blank dates) → plan events.
  const capStore = new CapacityStore();
  capStore.appendAll(repo.loadCapacity());
  const startDate = cfg.startDate ?? today();
  const slots = packSchedule(rows, capStore.lookup(), startDate);
  const stamp = realStamper(); // ONE shared stamper for the whole import
  // `projected` is passed unconditionally: when `update` is false, validateWbs
  // has already rejected any row whose id exists in the log, so no row can hit
  // planWbsEvents's diff branch anyway — passing it is a no-op in that case.
  const { events, nodeLabels, warnings } = planWbsEvents(rows, slots, cfg, meActor(cfg), stamp, projected);
  for (const w of warnings) err(`  warning: ${w}`);

  if (values['dry-run'] === true) {
    out(`(dry-run) ${rows.length} 行 → ${events.length} イベント。何も書き込みません。`);
    if (update) {
      out('  --update: 下記の行別種別一覧はシート上の記入内容の概観です — 実際に発行されるのは上のイベント数（差分のみ）。');
    }
    for (const r of rows) {
      const slot = slots.get(r.id);
      const kinds = [
        'decompose',
        ...r.predecessors.map((p) => `relate←${p}`),
        ...(r.estimate !== null ? ['agree'] : []),
        ...(r.assignee !== null ? ['assign'] : []),
        ...(r.actualStart !== null ? [`start@${r.actualStart}`] : []),
        ...(r.actualEnd !== null ? [`done@${r.actualEnd}`] : []),
        ...(r.accepted ? ['accept'] : []),
        ...(r.actualCost !== null && r.actualCost !== 0 ? [`cost:${r.actualCost}`] : []),
      ];
      out(`  ${r.id}  [${kinds.join(', ')}]  slot=${slot ?? '-'}`);
    }
    return;
  }

  // Commit: ONE appendEvents, then bulk label writes.
  repo.appendEvents(events);
  repo.setNodeLabels(nodeLabels);

  const labels = repo.loadLabels();
  const actorLabels: Record<string, string> = {};
  for (const r of rows) {
    if (r.assignee === null) continue;
    const id = parseActor(r.assignee).id;
    if (labels.actorLabels[id] === undefined && actorLabels[id] === undefined) {
      err(`  warning: actor "${id}" は未登録 — 表示名を id と同じで登録します（表示名の登録は別途）`);
      actorLabels[id] = id;
    }
  }
  if (Object.keys(actorLabels).length > 0) repo.setActorLabels(actorLabels);

  out(
    `Imported ${rows.length} 行 → ${events.length} イベント（1 回の追記）。` +
      (update ? '（--update: 既存 ID は差分のみ適用）' : ''),
  );
  out('確認: moira show   /   moira log');
}

async function cmdImportMembers(rest: string[]): Promise<void> {
  const { values, positionals } = parse(rest, { 'dry-run': { type: 'boolean' } });
  const file = positionals[1];
  if (file === undefined) throw new CliError('usage: moira import members <file.xlsx> [--dry-run]');
  if (!existsSync(file)) throw new CliError(`file not found: ${file}`);

  const repo = requireRepo();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const wsM = wb.getWorksheet('要員');
  if (wsM === undefined) {
    throw new CliError('シート "要員" が見つかりません（moira template members で雛形を生成できます）');
  }
  const wsC = wb.getWorksheet('個人カレンダー');
  const wsH = wb.getWorksheet('祝日');

  // parse → validate: collect ALL errors, write nothing if any.
  const { rows: memberRows, errors: mErr } = parseMembersSheet(wsM);
  const { rows: calRows, errors: cErr } = wsC ? parseCalendarSheet(wsC) : { rows: [], errors: [] };
  const { rows: holRows, errors: hErr } = wsH ? parseHolidaySheet(wsH) : { rows: [], errors: [] };
  const existing = repo.loadMembers();
  const validateErrors = validateMembersImport(memberRows, calRows, holRows, existing);
  const errors = [...mErr, ...cErr, ...hErr, ...validateErrors];
  if (errors.length > 0) {
    for (const e of errors) err(`  error: ${e}`);
    throw new CliError(`検証エラー ${errors.length} 件 — 何も書き込みませんでした。`);
  }
  if (memberRows.length === 0 && calRows.length === 0 && holRows.length === 0) {
    err('warning: シートにデータ行がありません（何もしません）。');
    return;
  }

  const stamp = realStamper(); // ONE shared stamper for the whole import
  const plan = planMembersImport(memberRows, calRows, holRows, existing, stamp);
  for (const w of plan.warnings) err(`  warning: ${w}`);

  if (values['dry-run'] === true) {
    out(
      `(dry-run) 要員 ${memberRows.length} 名（名簿計 ${plan.members.length}）` +
        ` / 個人カレンダー ${calRows.length} 行 / 祝日 ${holRows.length} 行` +
        ` → capacity ${plan.capacityEntries.length} 件。何も書き込みません。`,
    );
    return;
  }

  // Commit: roster upsert, then bulk actorLabels, then ONE appendCapacity.
  repo.saveMembers(plan.members);
  if (Object.keys(plan.actorLabels).length > 0) repo.setActorLabels(plan.actorLabels);
  if (plan.capacityEntries.length > 0) repo.appendCapacity(plan.capacityEntries);

  out(
    `Imported roster: 要員 ${memberRows.length} 名 / capacity ${plan.capacityEntries.length} 件` +
      `（祝日は現名簿の human ${plan.members.filter((m) => m.kind === 'human').length} 名に展開）。`,
  );
  out('確認: moira member list   /   moira ui');
}

// --- read commands --------------------------------------------------------

function cmdShow(rest: string[]): void {
  const { values } = parse(rest, {
    asOf: { type: 'string' },
    startDate: { type: 'string' },
    json: { type: 'boolean' },
  });
  const repo = requireRepo();
  const events = repo.loadEvents();
  const d = derive(events, buildDeriveOptions(repo, str(values.asOf), str(values.startDate)));
  if (values.json === true) {
    out(JSON.stringify(d, null, 2));
    return;
  }
  const labels = repo.loadLabels();
  const cfg = repo.loadConfig();
  const projectLabel = labels.nodeLabels[cfg.projectRoot];
  out(formatSnapshot(d, (id) => labels.nodeLabels[id] ?? id, projectLabel));
}

/**
 * `moira report` — the morning digest (issue #25 / roadmap skill #14
 * moira-evm-digest). "Previous" defaults to the closest business day before
 * asOf (weekends + Japanese holidays skipped; business-days.ts). All the diff
 * work is as-of prefix re-derivation of the SAME log (TE03) — never a stored
 * snapshot.
 */
function cmdReport(rest: string[]): void {
  const { values } = parse(rest, {
    asOf: { type: 'string' },
    prev: { type: 'string' },
    days: { type: 'string' },
    startDate: { type: 'string' },
    json: { type: 'boolean' },
    out: { type: 'string' },
    'save-dir': { type: 'string' },
  });
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const asOf = str(values.asOf) ?? cfg.asOf ?? today();
  if (!isIsoDate(asOf)) throw new CliError(`--asOf は YYYY-MM-DD 形式で指定する: ${asOf}`);
  const prevFlag = str(values.prev);
  if (prevFlag !== undefined && !isIsoDate(prevFlag)) {
    throw new CliError(`--prev は YYYY-MM-DD 形式で指定する: ${prevFlag}`);
  }
  const prev = prevFlag ?? previousBusinessDay(asOf, { warn: err });
  if (prev >= asOf) throw new CliError(`--prev (${prev}) は asOf (${asOf}) より前の日付にする`);
  const daysRaw = str(values.days) ?? '5';
  const days = Number(daysRaw);
  if (!Number.isInteger(days) || days < 0) {
    throw new CliError(`--days は 0 以上の整数で指定する: ${daysRaw}`);
  }

  const events = repo.loadEvents();
  const deriveOpts = buildDeriveOptions(repo, asOf, str(values.startDate));
  const report = buildReport(events, {
    asOf,
    prev,
    seriesDays: days === 0 ? [] : lastNBusinessDays(asOf, days, { warn: err }),
    projectRoot: cfg.projectRoot,
    ...(deriveOpts.capacityOf !== undefined ? { capacityOf: deriveOpts.capacityOf } : {}),
    ...(deriveOpts.startDate !== undefined ? { startDate: deriveOpts.startDate } : {}),
    dates: resolveReferenceDates(repo.loadDateEntries()),
    milestones: resolveMilestones(repo.loadMilestoneEntries()),
  });

  const asJson = values.json === true;
  let rendered: string;
  if (asJson) {
    rendered = JSON.stringify(report, null, 2);
  } else {
    const labels = repo.loadLabels();
    const projectLabel = labels.nodeLabels[cfg.projectRoot];
    rendered = formatReportText(report, (id) => labels.nodeLabels[id] ?? id, projectLabel);
  }
  out(rendered);

  // Optional save (issue #25 follow-up): --out <file> writes to an exact path;
  // --save-dir <dir> writes a deterministically-named file into that directory
  // (dir created if missing). Both still print to stdout; the saved path is
  // echoed to stderr so automation/skills can pick it up.
  const outPath = str(values.out);
  const saveDir = str(values['save-dir']);
  if (outPath !== undefined || saveDir !== undefined) {
    const target =
      outPath !== undefined
        ? resolve(outPath)
        : resolve(saveDir!, reportFilename(cfg.projectRoot, asOf, asJson));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${rendered}\n`, 'utf8');
    err(`saved: ${target}`);
  }
}

function cmdLog(rest: string[]): void {
  parse(rest, {});
  const repo = requireRepo();
  const labels = repo.loadLabels();
  const events = repo.loadEvents();
  if (events.length === 0) {
    out('(no events yet)');
    return;
  }
  for (const e of events) {
    const subject = eventSubject(e);
    const name = subject === undefined ? '' : ` ${labels.nodeLabels[subject] ?? subject}`;
    out(`${String(e.ts).padStart(14)}  ${e.actor.kind}:${e.actor.id}  ${e.kind}${name}${eventDetail(e)}`);
  }
}

/**
 * Build the `--portfolio` payload: read EVERY declared home independently
 * (issue #23). Config/duplicate errors are fatal (they are portfolio-file bugs);
 * a home that cannot be read becomes a loadError row — a visible gap in the UI,
 * never fabricated zeros. Only when NO home loads does the build fail.
 * Uniform asOf: --asOf flag > max(config.asOf across loadable homes) > today —
 * all projects derive at the SAME asOf for comparability.
 */
export function buildPortfolioFixture(portfolioPath: string, asOfFlag?: string): PortfolioUiFixture {
  const cfg = loadPortfolioConfig(portfolioPath);
  const entries = resolvePortfolioEntries(cfg, portfolioPath);
  const projects: PortfolioUiProject[] = [];
  const asOfCandidates: string[] = [];
  for (const e of entries) {
    const empty = {
      key: e.key,
      events: [] as const,
      capacity: [] as const,
      nodeLabels: {},
      actorLabels: {},
      members: [] as const,
    };
    if (e.resolveError !== undefined) {
      projects.push({ ...empty, label: e.label ?? fallbackLabel(e.root), loadError: e.resolveError });
      continue;
    }
    try {
      const repo = new MoiraRepo(e.root);
      if (!repo.exists()) throw new Error(`.moira/ (config.json) が見つからない: ${e.root}`);
      const homeCfg = repo.loadConfig();
      const labels = repo.loadLabels();
      const dates = resolveReferenceDates(repo.loadDateEntries());
      if (homeCfg.asOf !== undefined) asOfCandidates.push(homeCfg.asOf);
      projects.push({
        key: e.key,
        label: e.label ?? labels.nodeLabels[homeCfg.projectRoot] ?? fallbackLabel(e.root),
        events: repo.loadEvents(),
        capacity: repo.loadCapacity(),
        nodeLabels: labels.nodeLabels,
        actorLabels: labels.actorLabels,
        members: repo.loadMembers(),
        ...(dates.deadline !== undefined ? { deadline: dates.deadline } : {}),
        ...(dates.targetDate !== undefined ? { targetDate: dates.targetDate } : {}),
        // Issue #32 portfolio wiring: EACH home's own config.json decides its own
        // org-calendar fallback — independent of the other homes in the
        // portfolio, same `!== false` default-on discipline as single-project
        // `moira ui` (commands.ts:863).
        orgCalendarEnabled: homeCfg.orgCalendar?.enabled !== false,
      });
    } catch (e2) {
      projects.push({
        ...empty,
        label: e.label ?? fallbackLabel(e.root),
        loadError: e2 instanceof Error ? e2.message : String(e2),
      });
    }
  }
  const okCount = projects.filter((p) => p.loadError === undefined).length;
  if (okCount === 0) {
    throw new CliError(
      'portfolio のどの home も読めませんでした:\n' +
        projects.map((p) => `  - ${p.label}: ${p.loadError}`).join('\n'),
    );
  }
  const asOf =
    asOfFlag ??
    (asOfCandidates.length > 0 ? asOfCandidates.reduce((a, b) => (a > b ? a : b)) : today());
  return {
    portfolio: projects,
    asOf,
    ...(cfg.label !== undefined ? { label: cfg.label } : {}),
    live: true,
  };
}

async function cmdUi(rest: string[]): Promise<void> {
  const { values } = parse(rest, {
    asOf: { type: 'string' },
    port: { type: 'string' },
    'no-open': { type: 'boolean' },
    portfolio: { type: 'string' },
  });
  const dist = frontendDistDir();
  if (!existsSync(join(dist, 'index.html'))) {
    throw new CliError(
      `frontend dashboard is not built.\n  Build it once:  (cd ${dist.replace(/dist$/, '')} && npm install && npm run build)`,
    );
  }
  const port = Number(str(values.port) ?? '5180');
  // asOf: an explicit --asOf is the user's contract and stays fixed; config.json
  // asOf and today() are re-resolved per request so an edited config or a date
  // rollover shows up without a restart.
  const asOfFlag = str(values.asOf);

  const portfolioPath = str(values.portfolio);
  if (portfolioPath !== undefined) {
    // Portfolio mode: NO single-home resolution at all — the declared entries
    // are the homes. Fail fast on portfolio-file errors; per-home failures are
    // loadError rows. Fresh rebuild per request (same as single mode).
    const first = buildPortfolioFixture(portfolioPath, asOfFlag);
    const okDirs = first.portfolio
      .filter((p) => p.loadError === undefined)
      .map((p) => join(p.key, '.moira'));
    const running = await serveUi({
      distDir: dist,
      port,
      fixture: () => buildPortfolioFixture(portfolioPath, asOfFlag),
      watchDirs: okDirs,
    });
    const errCount = first.portfolio.length - okDirs.length;
    out(
      `Moira portfolio → ${running.url}   (asOf=${first.asOf}, ${first.portfolio.length} projects` +
        `${errCount > 0 ? `, うち ${errCount} 件は読込エラー — 画面にエラー行として表示` : ''})`,
    );
    out('各 home への追記はライブ反映（fs.watch → SSE）。portfolio.json の編集はブラウザ再読込で反映（home の追加・削除の watch は再起動が必要）。');
    out('Press Ctrl+C to stop.');
    if (values['no-open'] !== true) openBrowser(running.url);
    return;
  }

  const repo = requireRepo();
  const provider = (): UiFixture => {
    const cfg = repo.loadConfig();
    const labels = repo.loadLabels();
    const dates = resolveReferenceDates(repo.loadDateEntries());
    return {
      events: repo.loadEvents(),
      capacity: repo.loadCapacity(),
      asOf: asOfFlag ?? cfg.asOf ?? today(),
      nodeLabels: labels.nodeLabels,
      actorLabels: labels.actorLabels,
      members: repo.loadMembers(),
      me: cfg.me,
      ...(dates.deadline !== undefined ? { deadline: dates.deadline } : {}),
      ...(dates.targetDate !== undefined ? { targetDate: dates.targetDate } : {}),
      orgCalendarEnabled: cfg.orgCalendar?.enabled !== false,
      live: true,
    };
  };
  const first = provider();
  const running = await serveUi({ distDir: dist, port, fixture: provider, watchDir: repo.dir });
  out(`Moira dashboard → ${running.url}   (asOf=${first.asOf}, ${first.events.length} events)`);
  out('Appends to .moira/ are pushed live (fs.watch → SSE); reload also always shows the latest.');
  out('Press Ctrl+C to stop.');
  if (values['no-open'] !== true) openBrowser(running.url);
}

// --- helpers --------------------------------------------------------------

function hasEstimate(events: readonly Event[], node: string): boolean {
  for (const e of events) {
    if (e.kind === 'decompose') {
      for (const c of e.children) if (c.node === node && c.estimate !== undefined) return true;
    }
  }
  return false;
}

function eventSubject(e: Event): string | undefined {
  switch (e.kind) {
    case 'decompose':
      return e.parent;
    case 'transition':
    case 'cost':
      return e.node;
    case 'relate':
      return e.to;
  }
}

function eventDetail(e: Event): string {
  switch (e.kind) {
    case 'transition':
      return e.machine === 'estimate-agreement' ? ` → ${e.to}(est)` : ` → ${e.to}`;
    case 'decompose':
      return ` + [${e.children.map((c) => c.node).join(', ')}]`;
    case 'cost':
      return ` += ${e.amount}MD`;
    case 'relate':
      return ` ${e.op} ${e.edgeKind} (from ${e.from})`;
  }
}

function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
    const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    /* best-effort; the URL is already printed */
  }
}

const USAGE = `moira — record append-only project events and read derived EVM.

usage: moira [--dir <log-home>] <command> ...
  log home の解決順: --dir > MOIRA_DIR 環境変数 > .moira ポインタファイル/上位探索 > カレント。
  （複数の作業リポジトリで 1 つのログを共有する multi-repo 用。単一リポは従来どおりカレント。）

  moira init [--me <id>] [--label "<project>"] [--root <id>] [--asOf <date>]
  moira add <id> [--estimate <md>] [--parent <id>] [--label "..."] [--actor <who>]
  moira agree <id> [--budget <md>]                 (human commit: estimate agreement)
  moira assign <id> --to <who> [--reviewer <who>] [--slot <date>]   (human commit)
    --slot は初回スケジューリングのみ凍結（§3②）。2 回目以降は警告のみで無効（assignee 変更は通る）。
  moira start|done|accept|cancel <id> [--actor <who>] [--yes|-y]
    cancel/done は TTY 対話時のみ確認あり（非TTY・パイプ・エージェント・--yes/-y は無確認で通す）。
    cancelled は終端 — cancelled ノードへの以後の遷移・assign は拒否（誤 cancel の回復路は新規ノード再作成）。
  moira cost <id> <md> [--actor <who>]
    入力は有限数のみ・既存ログに現れないノード id は拒否（幽霊ノード防止）・1 回 5MD 超は警告のみ。
  moira relate <from> <to> [--kind dependency|supersede] [--policy ...] [--remove]
    add: 同一 (from,to,kind) の既存辺があれば拒否。remove --policy: 指定 policy の辺のみ削除（無指定は全件、従来どおり）。
  moira capacity <who> <YYYY-MM-DD> <c> [--reason ...]   (human commit)
  moira deadline [<YYYY-MM-DD>] [--target <YYYY-MM-DD>] [--reason ...]   (human commit: R-T6)
  moira milestone                                        (list resolved milestones)
  moira milestone set <name> --nodes <id1,id2,...> [--reason ...]   (human commit: define/redefine)
  moira milestone remove <name> [--reason ...]           (human commit: 解散 — nodes を空で追記)
    マイルストーン = 名前 + 構成ノード id 束のみ（期日・バッファは持たない — MODEL §7#12）。
    EVM・着地予測・ボトルネックは moira report の「マイルストーン別」節で読む。
  moira config org-calendar [on|off]
    土日・日本の祝日を c(i,d) の既定フォールバックにするか（issue #32、既定 on）。引数なしで現在値を表示。
  moira member add <id> --label <name> [--capacity <0..1>] [--kind human|agent]   (roster upsert)
  moira member list                                     (show the roster)
  moira template wbs|members [--out <file.xlsx>]         (blank workbook for bulk import)
  moira import wbs <file.xlsx> [--dry-run] [--update]    (bulk-load a filled WBS in one append)
    --update: 既存 ID を許容し差分のみ適用（見積変更は再 decompose・実績/遷移/cost の重複発行はしない）。
      無指定時は従来どおり既存 ID はエラー（再インポート非対応）。
  moira import members <file.xlsx> [--dry-run]           (bulk-load roster + 個人休 + 祝日)
  moira show [--asOf <date>] [--startDate <date>] [--json]
  moira report [--asOf <date>] [--prev <date>] [--days <n>] [--json] [--out <file>] [--save-dir <dir>]
    朝会ダイジェスト（issue #25）: 前回比 Δ・期間の出来事・キュー・feature 別・着地 vs 期日・
    直近 n 営業日の推移（既定 5、0 で省略）。--prev 既定は直前営業日（土日+日本の祝日スキップ）。
    --out <file> で任意パスに保存、--save-dir <dir> で <dir>/moira-report-<root>-<asOf>.md を生成
    （どちらも stdout にも出力し、保存先を stderr に表示）。
  moira log
  moira ui [--asOf <date>] [--port <n>] [--no-open] [--portfolio <portfolio.json>]
    --portfolio: 複数 home を読み取り専用で並置するポートフォリオ表示（issue #23）。
      portfolio.json 例: {"schemaVersion":1,"label":"部門","homes":[{"path":"../proj-a"},{"path":"../proj-b"}]}
      各 home は 1 つずつ独立に解決・導出され、ログのマージ・横断集計はしない（D-50 不変）。
  moira adapter install|status|drift|uninstall   (cc-sdd adapter; "moira adapter help")

who: a plain id (= human), or "agent:claude" / "human:alice".`;

export async function runCli(argv: string[]): Promise<void> {
  // Strip the GLOBAL `--dir <log-home>` (before the command word only — the
  // adapter subcommands keep their own `--dir <work-repo>`; `git -C` style).
  const args = [...argv];
  let flagDir: string | undefined;
  while (args.length > 0 && (args[0] === '--dir' || args[0]!.startsWith('--dir='))) {
    const tok = args.shift()!;
    if (tok === '--dir') {
      const v = args.shift();
      if (v === undefined) throw new CliError('--dir requires a path');
      flagDir = v;
    } else {
      flagDir = tok.slice('--dir='.length);
      if (flagDir === '') throw new CliError('--dir requires a path');
    }
  }
  setGlobalDir(flagDir); // reset each run (undefined when absent)
  const [cmd, ...rest] = args;
  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(USAGE);
      return;
    case 'init':
      return cmdInit(rest);
    case 'add':
      return cmdAdd(rest);
    case 'agree':
      return cmdAgree(rest);
    case 'assign':
      return cmdAssign(rest);
    case 'start':
      return cmdLifecycle(rest, 'implementing', 'start');
    case 'done':
      return cmdLifecycle(rest, 'implemented', 'done');
    case 'accept':
      return cmdLifecycle(rest, 'accepted', 'accept');
    case 'cancel':
      return cmdLifecycle(rest, 'cancelled', 'cancel');
    case 'cost':
      return cmdCost(rest);
    case 'relate':
      return cmdRelate(rest);
    case 'capacity':
      return cmdCapacity(rest);
    case 'deadline':
      return cmdDeadline(rest);
    case 'milestone':
      return cmdMilestone(rest);
    case 'config':
      return cmdConfig(rest);
    case 'member':
      return cmdMember(rest);
    case 'template':
      return cmdTemplate(rest);
    case 'import':
      return cmdImport(rest);
    case 'show':
      return cmdShow(rest);
    case 'report':
      return cmdReport(rest);
    case 'log':
      return cmdLog(rest);
    case 'ui':
      return cmdUi(rest);
    case 'adapter':
      return runAdapter(rest);
    default:
      throw new CliError(`unknown command: ${cmd}\n\n${USAGE}`);
  }
}
