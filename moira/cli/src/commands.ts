// Command handlers + dispatch. Each write command is a thin "load → emit → append
// → save" over the four canonical events; show/ui are read-only over derive().
// stdout = data; stderr = warnings/progress (so the CLI is automation-friendly).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CapacityStore, derive } from 'moira-backend';
import type { Actor, DeriveOptions, Event, LifecycleState } from 'moira-backend';
import { parseActor } from './actors.js';
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
import { frontendDistDir } from './paths.js';
import { realStamper } from './stamp.js';
import { MoiraRepo, type MoiraConfig } from './store.js';
import { serveUi, type UiFixture } from './ui-server.js';

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

function requireRepo(): MoiraRepo {
  const repo = new MoiraRepo(process.cwd());
  if (!repo.exists()) throw new CliError('no .moira/ here — run `moira init` first');
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
  const repo = new MoiraRepo(process.cwd());
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
  const parent = str(values.parent) ?? cfg.projectRoot;
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

async function cmdUi(rest: string[]): Promise<void> {
  const { values } = parse(rest, {
    asOf: { type: 'string' },
    port: { type: 'string' },
    'no-open': { type: 'boolean' },
  });
  const repo = requireRepo();
  const dist = frontendDistDir();
  if (!existsSync(join(dist, 'index.html'))) {
    throw new CliError(
      `frontend dashboard is not built.\n  Build it once:  (cd ${dist.replace(/dist$/, '')} && npm install && npm run build)`,
    );
  }
  const cfg = repo.loadConfig();
  const labels = repo.loadLabels();
  const asOf = str(values.asOf) ?? cfg.asOf ?? today();
  const port = Number(str(values.port) ?? '5180');
  const events = repo.loadEvents();
  const fixture: UiFixture = {
    events,
    capacity: repo.loadCapacity(),
    asOf,
    nodeLabels: labels.nodeLabels,
    actorLabels: labels.actorLabels,
  };
  const running = await serveUi(dist, fixture, port);
  out(`Moira dashboard → ${running.url}   (asOf=${asOf}, ${events.length} events)`);
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

  moira init [--me <id>] [--label "<project>"] [--root <id>] [--asOf <date>]
  moira add <id> [--estimate <md>] [--parent <id>] [--label "..."] [--actor <who>]
  moira agree <id> [--budget <md>]                 (human commit: estimate agreement)
  moira assign <id> --to <who> [--reviewer <who>] [--slot <date>]   (human commit)
  moira start|done|accept|cancel <id> [--actor <who>]
  moira cost <id> <md> [--actor <who>]
  moira relate <from> <to> [--kind dependency|supersede] [--policy ...] [--remove]
  moira capacity <who> <YYYY-MM-DD> <c> [--reason ...]   (human commit)
  moira show [--asOf <date>] [--startDate <date>] [--json]
  moira log
  moira ui [--asOf <date>] [--port <n>] [--no-open]
  moira adapter install|status|drift|uninstall   (cc-sdd adapter; "moira adapter help")

who: a plain id (= human), or "agent:claude" / "human:alice".`;

export async function runCli(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;
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
