import { describe, expect, it } from 'vitest';
import { fold } from 'moira-backend';
import type { Actor, Event } from 'moira-backend';
import { agreeEvent, assignEvent, decomposeEvent, lifecycleEvent } from '../../emit.js';
import { seqStamper } from '../../stamp.js';
import { computeDrift, filterReport } from './core.js';
import type { ExpectedFeature, ExpectedNode, NodeDrift } from './types.js';

const me: Actor = { kind: 'human', id: 'me' };
const ai: Actor = { kind: 'agent', id: 'claude' };
const ROOT = 'root-x';
const OPTS = { projectRoot: ROOT, provider: 'cc-sdd' } as const;

const expNode = (node: string, parent: string, over: Partial<ExpectedNode> = {}): ExpectedNode => ({
  node,
  parent,
  minLifecycle: null,
  maxLifecycle: null,
  severity: 'hard',
  evidence: 'spec.json が存在',
  ...over,
});

/** A feature whose spec.json merely exists (discovery expected). */
const discoveryExpected = (f = 'task-add'): ExpectedFeature => ({
  feature: f,
  sourcePath: `.kiro/specs/${f}`,
  sourcePhase: 'initialized',
  nodes: [
    expNode(f, ROOT),
    expNode(`${f}/req`, f, { maxLifecycle: 'implementing' }),
    expNode(`${f}/design`, f, { maxLifecycle: 'implementing' }),
    expNode(`${f}/tasks`, f, { maxLifecycle: 'implementing' }),
  ],
});

/** Events for a discovery-complete log (feature + 3 phase children born). */
function discoveryEvents(f = 'task-add'): Event[] {
  const s = seqStamper();
  return [
    decomposeEvent(s(), ai, ROOT, [{ node: f }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/req` }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/design` }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/tasks` }], 'add'),
  ];
}

const findNode = (nodes: readonly NodeDrift[], id: string): NodeDrift => {
  const n = nodes.find((n) => n.node === id);
  if (n === undefined) throw new Error(`node drift ${id} missing`);
  return n;
};

describe('computeDrift — core classification', () => {
  it('empty log vs existing spec → 4 hard missing-node (discovery never fired)', () => {
    const r = computeDrift([discoveryExpected()], fold([]), OPTS);
    const statuses = r.features[0]!.nodes.map((n) => n.status);
    expect(statuses).toEqual(['missing-node', 'missing-node', 'missing-node', 'missing-node']);
    expect(r.summary).toMatchObject({ hard: 4, ok: 0 });
    // the very first suggested command is the feature add, --parent included
    const first = r.features[0]!.nodes[0]!.suggested[0]!;
    expect(first.argv).toContain('--parent');
    expect(first.argv).toContain(ROOT);
  });

  it('discovery done → all ok, summary clean', () => {
    const r = computeDrift([discoveryExpected()], fold(discoveryEvents()), OPTS);
    expect(r.summary).toEqual({ hard: 0, advisory: 0, needsHuman: 0, ok: 4 });
  });

  it('approved in .kiro but accept missing in log → hard behind with a mechanical [accept] chain', () => {
    const f = 'task-add';
    const s = seqStamper(100);
    const events = [
      ...discoveryEvents(f),
      decomposeEvent(s(), ai, f, [{ node: `${f}/req`, estimate: 0.5 }], 'estimate'),
      agreeEvent(s(), me, `${f}/req`),
      assignEvent(s(), me, `${f}/req`, me, { frozenSlot: '2026-07-01' }),
      lifecycleEvent(s(), ai, `${f}/req`, 'implementing'),
      lifecycleEvent(s(), ai, `${f}/req`, 'implemented'),
    ];
    const expected = discoveryExpected(f);
    expected.nodes[1] = expNode(`${f}/req`, f, {
      minLifecycle: 'accepted',
      maxLifecycle: 'accepted',
      evidence: 'approvals.requirements.approved=true',
    });
    const r = computeDrift([expected], fold(events), OPTS);
    const req = findNode(r.features[0]!.nodes, `${f}/req`);
    expect(req.status).toBe('behind');
    expect(req.severity).toBe('hard');
    expect(req.suggested.map((c) => c.argv[1])).toEqual(['accept']);
    // landmine §E-2: never suggest assign at implementing+
    expect(req.suggested.some((c) => c.argv[1] === 'assign')).toBe(false);
  });

  it('progress expected but estimate/assignment never happened → needs-human, no fabricated values', () => {
    const f = 'task-add';
    const expected = discoveryExpected(f);
    expected.nodes[1] = expNode(`${f}/req`, f, { minLifecycle: 'implemented' });
    const r = computeDrift([expected], fold(discoveryEvents(f)), OPTS);
    const req = findNode(r.features[0]!.nodes, `${f}/req`);
    expect(req.status).toBe('needs-human');
    expect(r.summary.needsHuman).toBe(1);
    const verbs = req.suggested.map((c) => c.argv[1]);
    expect(verbs).toEqual(['add', 'agree', 'assign', 'start', 'done', 'cost']);
    expect(req.suggested.find((c) => c.argv[1] === 'agree')?.humanGate).toBe('agree');
    expect(req.suggested.find((c) => c.argv[1] === 'assign')?.humanGate).toBe('assign');
    expect(req.suggested.find((c) => c.argv[1] === 'cost')?.humanGate).toBe('measure');
    // placeholders, not invented numbers
    const flat = req.suggested.flatMap((c) => c.argv).join(' ');
    expect(flat).toContain('<md?>');
    expect(flat).toContain('<実測md?>');
    expect(flat).toContain('<YYYY-MM-DD?>');
  });

  it('tasks approved but impl nodes / review-impl absent → 2 hard missing findings', () => {
    const f = 'task-add';
    const expected: ExpectedFeature = {
      ...discoveryExpected(f),
      implGroup: {
        prefix: `${f}/impl-`,
        reviewNode: `${f}/review-impl`,
        parent: f,
        requireExists: true,
        tasksChecked: 0,
        tasksTotal: 3,
        evidence: 'approvals.tasks.approved=true',
      },
    };
    const r = computeDrift([expected], fold(discoveryEvents(f)), OPTS);
    const group = findNode(r.features[0]!.nodes, `${f}/impl-*`);
    const review = findNode(r.features[0]!.nodes, `${f}/review-impl`);
    expect(group.status).toBe('missing-node');
    expect(review.status).toBe('missing-node');
    expect(r.summary.hard).toBe(2);
  });

  it('all tasks checked but an impl node not implemented → advisory behind', () => {
    const f = 'task-add';
    const s = seqStamper(100);
    const events = [...discoveryEvents(f), decomposeEvent(s(), ai, f, [{ node: `${f}/impl-1` }], 'add')];
    const expected: ExpectedFeature = {
      ...discoveryExpected(f),
      implGroup: {
        prefix: `${f}/impl-`,
        reviewNode: `${f}/review-impl`,
        parent: f,
        requireExists: false,
        tasksChecked: 2,
        tasksTotal: 2,
        evidence: 'tasks.md',
      },
    };
    const r = computeDrift([expected], fold(events), OPTS);
    const impl = findNode(r.features[0]!.nodes, `${f}/impl-1`);
    expect(impl.status).toBe('needs-human'); // unagreed impl → human gates first
    expect(impl.severity).toBe('advisory');
    expect(r.summary.hard).toBe(0);
  });

  it('log ahead of .kiro (accepted without approval evidence) → advisory ahead', () => {
    const f = 'task-add';
    const s = seqStamper(100);
    const events = [
      ...discoveryEvents(f),
      lifecycleEvent(s(), me, `${f}/req`, 'implemented'),
      lifecycleEvent(s(), me, `${f}/req`, 'accepted'),
    ];
    const expected = discoveryExpected(f); // req ceiling = implementing (nothing generated)
    const r = computeDrift([expected], fold(events), OPTS);
    const req = findNode(r.features[0]!.nodes, `${f}/req`);
    expect(req.status).toBe('ahead');
    expect(req.severity).toBe('advisory');
    expect(req.suggested).toEqual([]);
  });

  it('cancelled node is a scope decision — advisory, never a catch-up chain', () => {
    const f = 'task-add';
    const s = seqStamper(100);
    const events = [...discoveryEvents(f), lifecycleEvent(s(), me, `${f}/req`, 'cancelled')];
    const expected = discoveryExpected(f);
    expected.nodes[1] = expNode(`${f}/req`, f, { minLifecycle: 'implemented' });
    const r = computeDrift([expected], fold(events), OPTS);
    const req = findNode(r.features[0]!.nodes, `${f}/req`);
    expect(req.status).toBe('cancelled');
    expect(req.suggested).toEqual([]);
  });

  it('nodes outside every feature space → unknown-node advisory; ignore lists silence them', () => {
    const s = seqStamper(100);
    const events = [...discoveryEvents(), decomposeEvent(s(), ai, ROOT, [{ node: 'ops-hotfix' }], 'add')];
    const noisy = computeDrift([discoveryExpected()], fold(events), OPTS);
    expect(noisy.unknownNodes.map((n) => n.node)).toEqual(['ops-hotfix']);
    expect(noisy.summary.advisory).toBe(1);

    const quiet = computeDrift([discoveryExpected()], fold(events), { ...OPTS, ignoreNodes: ['ops-hotfix'] });
    expect(quiet.unknownNodes).toEqual([]);
    expect(quiet.skipped.nodes).toEqual(['ops-hotfix']);
  });

  it('ignoreFeatures skips a whole feature without leaking its nodes as unknown', () => {
    const r = computeDrift([discoveryExpected()], fold(discoveryEvents()), {
      ...OPTS,
      ignoreFeatures: ['task-add'],
    });
    expect(r.features).toEqual([]);
    expect(r.skipped.features).toEqual(['task-add']);
    expect(r.unknownNodes).toEqual([]); // feature space stays "known" even when skipped
  });

  it('parse error surfaces per feature and produces no findings', () => {
    const broken: ExpectedFeature = {
      feature: 'broken',
      sourcePath: '.kiro/specs/broken',
      sourcePhase: 'unknown',
      parseError: 'spec.json を解析できない: …',
      nodes: [],
    };
    const r = computeDrift([broken], fold([]), OPTS);
    expect(r.features[0]!.parseError).toContain('解析できない');
    expect(r.summary).toEqual({ hard: 0, advisory: 0, needsHuman: 0, ok: 0 });
  });

  it('next steps: all children accepted → suggest the final human feature accept', () => {
    const f = 'task-add';
    const s = seqStamper(100);
    const events: Event[] = [decomposeEvent(s(), ai, ROOT, [{ node: f }], 'add')];
    for (const child of [`${f}/req`, `${f}/design`, `${f}/tasks`]) {
      events.push(decomposeEvent(s(), ai, f, [{ node: child }], 'add'));
      events.push(lifecycleEvent(s(), me, child, 'accepted'));
    }
    const r = computeDrift([discoveryExpected(f)], fold(events), OPTS);
    expect(r.features[0]!.nextSteps.join(' ')).toContain(`moira accept ${f}`);
  });
});

describe('filterReport', () => {
  it('narrows to one feature and recounts the summary', () => {
    const other = discoveryExpected('other-feat');
    const r = computeDrift([discoveryExpected(), other], fold(discoveryEvents()), OPTS);
    expect(r.summary.hard).toBe(4); // other-feat entirely missing
    const only = filterReport(r, 'task-add');
    expect(only.features.map((f) => f.feature)).toEqual(['task-add']);
    expect(only.summary).toEqual({ hard: 0, advisory: 0, needsHuman: 0, ok: 4 });
  });
});
