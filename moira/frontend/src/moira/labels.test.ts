// labels.ts fixtureMode (issue #11): in fixtureMode the DEMO label fallback is
// BYPASSED, so a real project shows only user-supplied names (never 田中/佐藤…).
// Demo mode is unchanged. Module state leaks across tests → reset in afterEach.

import { afterEach, describe, expect, it } from 'vitest';
import { actorLabel, labelOf, resetLabelsForTests, setLabelsFixtureMode, setUserLabels } from './labels';
import type { Actor } from './engine';

const alice: Actor = { kind: 'human', id: 'alice' };

afterEach(() => resetLabelsForTests());

describe('labels — demo mode (no fixture)', () => {
  it('falls back to DEMO labels', () => {
    expect(actorLabel(alice)).toBe('田中');
    expect(labelOf('F1')).toBe('認証基盤');
  });
});

describe('labels — fixtureMode (real project)', () => {
  it('bypasses DEMO labels; unknown ids resolve to the raw id', () => {
    setLabelsFixtureMode(true);
    setUserLabels({}, {});
    expect(actorLabel(alice)).toBe('alice'); // NOT 田中
    expect(labelOf('F1')).toBe('F1'); // NOT 認証基盤
  });

  it('uses the user-supplied label when present', () => {
    setLabelsFixtureMode(true);
    setUserLabels({ F1: '自社機能' }, { nakao: '中尾' });
    expect(actorLabel({ kind: 'human', id: 'nakao' })).toBe('中尾');
    expect(labelOf('F1')).toBe('自社機能');
    expect(actorLabel(alice)).toBe('alice'); // still no demo leak
  });
});
