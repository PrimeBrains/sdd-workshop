import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { human, Log } from '../test-utils.js';
import { computeAc } from './ac.js';

describe('AC tree rollup (P3 MODEL:172)', () => {
  it('rolls cost up the tree: AC(parent) = own + Σ children', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a' }, { node: 'b' }])
        .cost('a', 3)
        .cost('b', 4)
        .cost('F', 1) // own cost on the parent too
        .all(),
    );
    const { total, byNode } = computeAc(state);
    expect(total).toBe(8);
    const f = byNode.find((r) => r.node === 'F');
    expect(f?.ac).toBe(8); // 1 + 3 + 4
  });

  it('dedups repeated cost ids', () => {
    const base = { kind: 'cost' as const, node: 'a', amount: 5, actor: human('h') };
    const state = fold([
      { ...base, id: 'c1', ts: 1 },
      { ...base, id: 'c1', ts: 2 },
    ]);
    expect(computeAc(state).total).toBe(5);
  });

  it('retains cost on cancelled nodes (cost is a fact, A6 MODEL:44)', () => {
    const state = fold(
      new Log().decompose('F', [{ node: 'a' }]).cost('a', 9).life('a', 'cancelled').all(),
    );
    expect(computeAc(state).total).toBe(9);
  });
});
