import { describe, expect, it } from 'vitest';
import { derive } from './engine';
import { makeCapacityLookup } from './capacity';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './demo-data';

describe('demo project folds cleanly and exercises every UI case', () => {
  const d = derive(demoEvents, { asOf: DEMO_AS_OF, capacityOf: makeCapacityLookup(demoCapacity) });
  const eff = new Set(d.effectiveLeaves);
  const stateOf = (n: string) => d.nodeStates.find((r) => r.node === n);

  it('has no structural errors', () => {
    expect(d.structuralErrors).toEqual([]);
  });

  it('effective set drops superseded/cancelled/non-leaf nodes', () => {
    expect(eff.has('sso')).toBe(false); // superseded by oauth
    expect(eff.has('legacy')).toBe(false); // cancelled
    expect(eff.has('login')).toBe(false); // non-leaf parent
    expect(eff.has('F1')).toBe(false); // feature rollup
    expect(eff.has('login-ui')).toBe(true);
    expect(eff.has('login-api')).toBe(true);
  });

  it('surfaces the honest gaps', () => {
    expect(d.unassignedBacklog).toContain('reset'); // agreed, no assignee
    expect(d.estimateCoverage).toBeLessThan(1); // ratelimit/push proposed
    expect(d.scheduleCoverage).toBeLessThan(1); // reset/hotfix unassigned
  });

  it('produces the third state: completed leaf with frozenSlot = null', () => {
    const hotfix = d.forecast.find((f) => f.node === 'hotfix');
    expect(hotfix).toBeDefined();
    expect(hotfix?.frozenSlot).toBeNull(); // never scheduled
    expect(stateOf('hotfix')?.lifecycle).toBe('implemented'); // but completed
  });

  it('reflects varied lifecycle states', () => {
    expect(stateOf('token')?.lifecycle).toBe('implementing');
    expect(stateOf('audit')?.lifecycle).toBe('ready');
    expect(stateOf('req-1')?.lifecycle).toBe('accepted');
    expect(stateOf('ratelimit')?.estimate).toBe('proposed');
  });

  it('cumulative EV_abs includes superseded sso but evAbs (current) does not', () => {
    expect(d.cumulativeEvAbs).toBeGreaterThan(d.evAbs);
  });
});
