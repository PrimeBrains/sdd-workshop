// computePersonOverlap — the pure cross-project person composer (issue #23).
// Inputs are hand-built ProjectedState/forecast slices (this tests the COMPOSER,
// not the engine; engine parity is portfolio.golden.test.ts's job).

import { describe, expect, it } from 'vitest';
import type { Actor, IsoDate, ProjectedNode, ProjectedState } from '../../moira/engine';
import {
  computePersonOverlap,
  windowDates,
  type PersonOverlapProjectInput,
} from './person-overlap';

const human = (id: string): Actor => ({ kind: 'human', id });

function mkNode(partial: Partial<ProjectedNode> & { id: string }): ProjectedNode {
  return {
    lifecycle: 'ready',
    reachedImplemented: false,
    estimateState: 'proposed',
    latestEstimate: null,
    frozenBudget: null,
    frozenSlot: null,
    assignee: null,
    reviewer: null,
    ownCost: 0,
    parent: null,
    agreedActorValues: new Map(),
    ...partial,
  };
}

function mkProjected(nodes: ProjectedNode[]): ProjectedState {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    childrenOf: new Map(),
    dependencyEdges: [],
    supersedeEdges: [],
    seenCostIds: new Set(),
    structuralErrors: [],
    appliedAt: 0,
  };
}

function mkProject(
  key: string,
  label: string,
  nodes: ProjectedNode[],
  opts: Partial<Omit<PersonOverlapProjectInput, 'key' | 'label' | 'projected'>> = {},
): PersonOverlapProjectInput {
  return {
    key,
    label,
    nodeLabels: opts.nodeLabels ?? {},
    actorLabels: opts.actorLabels ?? {},
    members: opts.members ?? [],
    capacityEntries: opts.capacityEntries ?? [],
    projected: mkProjected(nodes),
    derived: opts.derived ?? { forecast: [], humanReviewQueue: [] },
  };
}

const AS_OF: IsoDate = '2026-07-01';

describe('windowDates', () => {
  it('spans [asOf, asOf+N) inclusive-exclusive', () => {
    expect(windowDates(AS_OF, 3)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});

describe('computePersonOverlap', () => {
  it('marks same-day scheduling across two projects as an overlap date', () => {
    const a = mkProject('A', '案件A', [mkNode({ id: 'a1', assignee: human('alice') })], {
      derived: {
        forecast: [{ node: 'a1', predictedCompletion: '2026-07-03', predictedStart: '2026-07-03', frozenSlot: '2026-07-03' }],
        humanReviewQueue: [],
      },
    });
    const b = mkProject('B', '案件B', [mkNode({ id: 'b1', assignee: human('alice') })], {
      derived: {
        forecast: [{ node: 'b1', predictedCompletion: '2026-07-03', predictedStart: '2026-07-03', frozenSlot: null }],
        humanReviewQueue: [],
      },
    });
    const rows = computePersonOverlap([a, b], AS_OF, 14);
    const alice = rows.find((r) => r.actorId === 'alice');
    expect(alice?.slices).toHaveLength(2);
    expect(alice?.overlapDates).toEqual(['2026-07-03']);
  });

  it('does NOT merge different ids (no global identity) and keeps per-project display names', () => {
    const a = mkProject('A', '案件A', [mkNode({ id: 'a1', assignee: human('alice') })], {
      actorLabels: { alice: '有栖' },
    });
    const b = mkProject('B', '案件B', [mkNode({ id: 'b1', assignee: human('alice-b') })], {
      actorLabels: { 'alice-b': '有栖' },
    });
    const rows = computePersonOverlap([a, b], AS_OF, 14);
    expect(rows.map((r) => r.actorId).sort()).toEqual(['alice', 'alice-b']);
    expect(rows.find((r) => r.actorId === 'alice')?.slices).toHaveLength(1);
  });

  it('collects the SAME id\'s differing display names across projects', () => {
    const a = mkProject('A', '案件A', [mkNode({ id: 'a1', assignee: human('alice') })], {
      actorLabels: { alice: '有栖' },
    });
    const b = mkProject('B', '案件B', [mkNode({ id: 'b1', assignee: human('alice') })], {
      actorLabels: { alice: 'Alice' },
    });
    const rows = computePersonOverlap([a, b], AS_OF, 14);
    expect(rows.find((r) => r.actorId === 'alice')?.displayNames).toEqual(['Alice', '有栖']);
  });

  it('review waits list only humanReviewQueue nodes whose reviewer matches', () => {
    const nodes = [
      mkNode({ id: 'n1', reviewer: human('rev'), assignee: human('dev') }),
      mkNode({ id: 'n2', reviewer: human('other'), assignee: human('dev') }),
    ];
    const a = mkProject('A', '案件A', nodes, {
      nodeLabels: { n1: '設計レビュー' },
      derived: { forecast: [], humanReviewQueue: ['n1', 'n2'] },
    });
    const rows = computePersonOverlap([a], AS_OF, 14);
    const rev = rows.find((r) => r.actorId === 'rev');
    expect(rev?.slices[0]?.reviewWait).toEqual(['設計レビュー']);
  });

  it('implementing lists only lifecycle=implementing nodes of that assignee', () => {
    const nodes = [
      mkNode({ id: 'n1', assignee: human('dev'), lifecycle: 'implementing' }),
      mkNode({ id: 'n2', assignee: human('dev'), lifecycle: 'ready' }),
    ];
    const a = mkProject('A', '案件A', nodes, { nodeLabels: { n1: '実装中' } });
    const rows = computePersonOverlap([a], AS_OF, 14);
    expect(rows.find((r) => r.actorId === 'dev')?.slices[0]?.implementing).toEqual(['実装中']);
  });

  it('sums ONLY explicit capacity declarations, clipped to the window', () => {
    const a = mkProject('A', '案件A', [], {
      capacityEntries: [
        { humanId: 'alice', date: '2026-07-01', capacity: 0.5, reason: 'contract', ts: 1 },
        { humanId: 'alice', date: '2026-07-02', capacity: 1.0, reason: 'contract', ts: 2 },
        { humanId: 'alice', date: '2026-09-01', capacity: 1.0, reason: 'contract', ts: 3 }, // outside window
      ],
    });
    const rows = computePersonOverlap([a], AS_OF, 14);
    const slice = rows.find((r) => r.actorId === 'alice')?.slices[0];
    expect(slice?.declaredCapacitySum).toBeCloseTo(1.5, 10);
    expect(slice?.declaredDays).toBe(2);
  });

  it('scheduled dates outside the window are clipped', () => {
    const a = mkProject('A', '案件A', [mkNode({ id: 'a1', assignee: human('alice') })], {
      derived: {
        forecast: [{ node: 'a1', predictedCompletion: '2026-12-31', predictedStart: '2026-12-31', frozenSlot: '2026-07-02' }],
        humanReviewQueue: [],
      },
    });
    const rows = computePersonOverlap([a], AS_OF, 14);
    expect(rows.find((r) => r.actorId === 'alice')?.slices[0]?.scheduledDates).toEqual([
      '2026-07-02',
    ]);
  });

  it('multi-project people sort first', () => {
    const a = mkProject('A', '案件A', [
      mkNode({ id: 'a1', assignee: human('multi') }),
      mkNode({ id: 'a2', assignee: human('solo') }),
    ]);
    const b = mkProject('B', '案件B', [mkNode({ id: 'b1', assignee: human('multi') })]);
    const rows = computePersonOverlap([a, b], AS_OF, 14);
    expect(rows[0]?.actorId).toBe('multi');
  });
});
