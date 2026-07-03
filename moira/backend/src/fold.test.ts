import { describe, expect, it } from 'vitest';
import { fold } from './fold.js';
import { agent, human, Log } from './test-utils.js';
import type { Event } from './types.js';

describe('fold engine', () => {
  it('is deterministic under (ts,id) regardless of input order', () => {
    const ordered: Event[] = new Log()
      .decompose('F', [{ node: 'a', estimate: 3 }])
      .agree('a', 3)
      .life('a', 'implemented')
      .all();
    const shuffled = [ordered[2]!, ordered[0]!, ordered[1]!];

    const s1 = fold(ordered);
    const s2 = fold(shuffled);
    expect(s2.nodes.get('a')?.lifecycle).toBe('implemented');
    expect(s2.nodes.get('a')?.estimateState).toBe('agreed');
    expect(s1.nodes.get('a')?.frozenBudget).toBe(s2.nodes.get('a')?.frozenBudget);
  });

  it('does not mutate the input array', () => {
    const log = new Log().decompose('F', [{ node: 'a', estimate: 1 }]).agree('a', 1).all();
    const snapshot = [...log];
    fold(log);
    expect(log).toEqual(snapshot);
  });

  it('dedups cost by event id (§2.8 MODEL:141)', () => {
    const base = { kind: 'cost' as const, node: 'a', amount: 5, actor: human('h1') };
    const state = fold([
      { ...base, id: 'c1', ts: 1 },
      { ...base, id: 'c1', ts: 2 }, // duplicate id — ignored
      { ...base, id: 'c2', ts: 3 },
    ]);
    expect(state.nodes.get('a')?.ownCost).toBe(10);
  });

  it('applies assignee latest-wins (§2.4 MODEL:102)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a' }])
        .assign('a', human('alice'))
        .assign('a', human('bob'))
        .all(),
    );
    expect(state.nodes.get('a')?.assignee).toEqual(human('bob'));
  });

  it('freezes only the FIRST scheduling slot (§3② MODEL:194)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a' }])
        .schedule('a', human('alice'), '2026-02-01')
        .schedule('a', human('alice'), '2026-03-01') // later slot does NOT overwrite
        .all(),
    );
    expect(state.nodes.get('a')?.frozenSlot).toBe('2026-02-01');
  });

  it('locks budget on retroactive agreement after completion (I4 MODEL:147)', () => {
    // Complete first, agree later — the ordered fold still freezes the budget.
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 7 }])
        .life('a', 'implemented')
        .agree('a', 7)
        .all(),
    );
    expect(state.nodes.get('a')?.estimateState).toBe('agreed');
    expect(state.nodes.get('a')?.frozenBudget).toBe(7);
  });

  it('rejects an agent-issued agreement (R-U4/I6 MODEL:221)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 2 }])
        .agree('a', 2, agent('ai')) // non-human → rejected
        .all(),
    );
    expect(state.nodes.get('a')?.estimateState).toBe('proposed');
    expect(state.nodes.get('a')?.frozenBudget).toBeNull();
    expect(state.structuralErrors.some((e) => e.includes('R-U4'))).toBe(true);
  });

  it('rejects a cyclic relate (I2/R-D3 MODEL:145)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a' }, { node: 'b' }])
        .dep('a', 'b')
        .dep('b', 'a') // would create a cycle → rejected
        .all(),
    );
    expect(state.dependencyEdges).toHaveLength(1);
    expect(state.structuralErrors.some((e) => e.includes('I2/R-D3'))).toBe(true);
  });

  // Containment is latest-wins (§2.8 v20): a re-decompose REPLACES the effective
  // parent; childrenOf is the exact inverse of the parent pointers (the tree, A3).
  describe('containment latest-wins (§2.8 v20, issue #5)', () => {
    it('a re-decompose under a new parent MOVES the child (no coexisting edge)', () => {
      const state = fold(
        new Log()
          .decompose('A', [{ node: 'c', estimate: 2 }])
          .decompose('B', [{ node: 'c' }])
          .all(),
      );
      expect(state.nodes.get('c')?.parent).toBe('B');
      expect(state.childrenOf.get('B')).toEqual(['c']);
      expect(state.childrenOf.has('A')).toBe(false); // emptied entry is dropped
      // the move touches containment only — the estimate is untouched
      expect(state.nodes.get('c')?.latestEstimate).toBe(2);
    });

    it('a same-parent re-decompose only updates the estimate (no duplicate entry)', () => {
      const state = fold(
        new Log()
          .decompose('F', [{ node: 'c', estimate: 1 }])
          .decompose('F', [{ node: 'c', estimate: 4 }])
          .all(),
      );
      expect(state.childrenOf.get('F')).toEqual(['c']);
      expect(state.nodes.get('c')?.latestEstimate).toBe(4);
    });

    it('heals the issue-#5 double-edge log: corrective re-add restores the clean tree', () => {
      // root→feat, feat→X, then the MISTAKE (root→X via a --parent-less add),
      // then the compensation: re-decompose X under feat.
      const clean = new Log()
        .decompose('root', [{ node: 'feat' }])
        .decompose('feat', [{ node: 'X', estimate: 0.5 }])
        .all();
      const repaired = fold([
        ...new Log()
          .decompose('root', [{ node: 'feat' }])
          .decompose('feat', [{ node: 'X', estimate: 0.5 }])
          .decompose('root', [{ node: 'X', estimate: 0.5 }]) // the mistake
          .decompose('feat', [{ node: 'X', estimate: 0.5 }]) // the compensation
          .all(),
      ]);
      const cleanState = fold(clean);
      expect(repaired.nodes.get('X')?.parent).toBe('feat');
      expect(repaired.childrenOf.get('root')).toEqual(cleanState.childrenOf.get('root'));
      expect(repaired.childrenOf.get('feat')).toEqual(cleanState.childrenOf.get('feat'));
    });

    it('even DURING the mistake the tree stays single-parent (multi-parent unrepresentable)', () => {
      const state = fold(
        new Log()
          .decompose('root', [{ node: 'feat' }])
          .decompose('feat', [{ node: 'X' }])
          .decompose('root', [{ node: 'X' }]) // mistake: X moves (not doubles)
          .all(),
      );
      const parentsOfX = [...state.childrenOf.entries()].filter(([, kids]) => kids.includes('X'));
      expect(parentsOfX.map(([p]) => p)).toEqual(['root']);
      expect(state.nodes.get('X')?.parent).toBe('root');
    });

    it('rejects a self-parenting decompose (tree-ness guard, A3/§2.8)', () => {
      const state = fold(new Log().decompose('F', [{ node: 'a' }]).decompose('a', [{ node: 'a' }]).all());
      expect(state.nodes.get('a')?.parent).toBe('F');
      expect(state.structuralErrors.some((e) => e.includes('A3/§2.8'))).toBe(true);
    });

    it('rejects a descendant-as-parent decompose (would cut a cycle island loose)', () => {
      const state = fold(
        new Log()
          .decompose('A', [{ node: 'B' }])
          .decompose('B', [{ node: 'C' }])
          .decompose('C', [{ node: 'A' }]) // A's own grandchild as parent → cycle
          .all(),
      );
      expect(state.nodes.get('A')?.parent).toBeNull(); // unchanged (A stays a root)
      expect(state.childrenOf.get('C') ?? []).not.toContain('A');
      expect(state.structuralErrors.some((e) => e.includes('containment cycle'))).toBe(true);
    });

    it('rejects a negative cost (A6/§2.8: no correction event exists)', () => {
      const state = fold([
        ...new Log().decompose('F', [{ node: 'a' }]).all(),
        { kind: 'cost', id: 'c1', ts: 10, actor: human('h1'), node: 'a', amount: 5 },
        { kind: 'cost', id: 'c2', ts: 11, actor: human('h1'), node: 'a', amount: -3 },
      ]);
      expect(state.nodes.get('a')?.ownCost).toBe(5); // the negative append is refused
      expect(state.structuralErrors.some((e) => e.includes('negative cost'))).toBe(true);
    });

    it('is deterministic under (ts,id) with re-parenting in the log', () => {
      const ordered = new Log()
        .decompose('A', [{ node: 'c' }])
        .decompose('B', [{ node: 'c' }])
        .decompose('A', [{ node: 'c' }])
        .all();
      const shuffled = [ordered[1]!, ordered[2]!, ordered[0]!];
      const s1 = fold(ordered);
      const s2 = fold(shuffled);
      expect(s1.nodes.get('c')?.parent).toBe('A');
      expect(s2.nodes.get('c')?.parent).toBe('A');
      expect(s2.childrenOf.has('B')).toBe(false);
    });
  });
});
