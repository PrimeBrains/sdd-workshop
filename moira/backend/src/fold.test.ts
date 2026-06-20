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
});
