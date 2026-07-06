// Command handlers + dispatch. Each write command is a thin "load → emit → append
// → save" over the four canonical events; show/ui are read-only over derive().
// stdout = data; stderr = warnings/progress (so the CLI is automation-friendly).

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { CapacityStore, derive, fold } from 'moira-backend';
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
import { formatSnapshot } from './format.js';
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
  MoiraRepo,
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
  if (cap.length > 0) {
    const store = new CapacityStore();
    store.appendAll(cap);
    opts.capacityOf = store.lookup();
  }
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
  const opts: { reviewer?: Actor; frozenSlot?: string } = {};
  if (reviewer !== undefined) opts.reviewer = reviewer;
  if (slot !== undefined) opts.frozenSlot = slot;
  const ev = assignEvent(realStamper()(), meActor(cfg), node, assignee, opts);
  repo.appendEvents([ev]);
  repo.setActorLabel(assignee.id, assignee.id);
  if (reviewer !== undefined) repo.setActorLabel(reviewer.id, reviewer.id);
  out(
    `→ assigned ${node} to ${assignee.kind}:${assignee.id}` +
      `${reviewer === undefined ? '' : ` (reviewer ${reviewer.id})`}` +
      `${slot === undefined ? '' : ` slot ${slot}`} [human commit]`,
  );
}

function cmdLifecycle(rest: string[], to: LifecycleState, verb: string): void {
  const { values, positionals } = parse(rest, { actor: { type: 'string' }, reason: { type: 'string' } });
  const node = positionals[0];
  if (node === undefined) throw new CliError(`usage: moira ${verb} <id> [--actor <who>]`);
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const actor = str(values.actor) !== undefined ? parseActor(str(values.actor)!) : meActor(cfg);
  const reason = str(values.reason);
  const ev =
    reason === undefined
      ? lifecycleEvent(realStamper()(), actor, node, to)
      : lifecycleEvent(realStamper()(), actor, node, to, reason);
  repo.appendEvents([ev]);
  out(`• ${node} → ${to}`);
}

function cmdCost(rest: string[]): void {
  const { values, positionals } = parse(rest, { actor: { type: 'string' } });
  const node = positionals[0];
  const amountStr = positionals[1];
  if (node === undefined || amountStr === undefined) throw new CliError('usage: moira cost <id> <md>');
  const repo = requireRepo();
  const cfg = repo.loadConfig();
  const actor = str(values.actor) !== undefined ? parseActor(str(values.actor)!) : meActor(cfg);
  const ev = costEvent(realStamper()(), actor, node, Number(amountStr));
  repo.appendEvents([ev]);
  out(`$ cost ${node} += ${amountStr} MD`);
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
  const repo = requireRepo();
  const entry = capacityEntry(realStamper()(), who, date, Number(cStr), str(values.reason) ?? 'manual');
  repo.appendCapacity([entry]);
  out(`c(${who}, ${date}) = ${cStr} [human commit]`);
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
  const { positionals } = parse(rest, { 'dry-run': { type: 'boolean' } });
  const kind = positionals[0];
  if (kind === 'members') return cmdImportMembers(rest);
  if (kind !== 'wbs') {
    throw new CliError('usage: moira import wbs|members <file.xlsx> [--dry-run]');
  }
  return cmdImportWbs(rest);
}

async function cmdImportWbs(rest: string[]): Promise<void> {
  const { values, positionals } = parse(rest, { 'dry-run': { type: 'boolean' } });
  const file = positionals[1];
  if (file === undefined) throw new CliError('usage: moira import wbs <file.xlsx> [--dry-run]');
  if (!existsSync(file)) throw new CliError(`file not found: ${file}`);

  const repo = requireRepo();
  const cfg = repo.loadConfig();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('WBS');
  if (ws === undefined) throw new CliError('シート "WBS" が見つかりません（moira template wbs で雛形を生成できます）');

  // parse → validate: collect ALL errors, write nothing if any.
  const { rows, errors: parseErrors } = parseWbsSheet(ws);
  const projected = fold(repo.loadEvents());
  const validateErrors = validateWbs(rows, projected, cfg.projectRoot, today());
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
  const { events, nodeLabels, warnings } = planWbsEvents(rows, slots, cfg, meActor(cfg), stamp);
  for (const w of warnings) err(`  warning: ${w}`);

  if (values['dry-run'] === true) {
    out(`(dry-run) ${rows.length} 行 → ${events.length} イベント。何も書き込みません。`);
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

  out(`Imported ${rows.length} 行 → ${events.length} イベント（1 回の追記）。`);
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
function buildPortfolioFixture(portfolioPath: string, asOfFlag?: string): PortfolioUiFixture {
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
  moira start|done|accept|cancel <id> [--actor <who>]
  moira cost <id> <md> [--actor <who>]
  moira relate <from> <to> [--kind dependency|supersede] [--policy ...] [--remove]
  moira capacity <who> <YYYY-MM-DD> <c> [--reason ...]   (human commit)
  moira deadline [<YYYY-MM-DD>] [--target <YYYY-MM-DD>] [--reason ...]   (human commit: R-T6)
  moira member add <id> --label <name> [--capacity <0..1>] [--kind human|agent]   (roster upsert)
  moira member list                                     (show the roster)
  moira template wbs|members [--out <file.xlsx>]         (blank workbook for bulk import)
  moira import wbs <file.xlsx> [--dry-run]               (bulk-load a filled WBS in one append)
  moira import members <file.xlsx> [--dry-run]           (bulk-load roster + 個人休 + 祝日)
  moira show [--asOf <date>] [--startDate <date>] [--json]
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
    case 'member':
      return cmdMember(rest);
    case 'template':
      return cmdTemplate(rest);
    case 'import':
      return cmdImport(rest);
    case 'show':
      return cmdShow(rest);
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
