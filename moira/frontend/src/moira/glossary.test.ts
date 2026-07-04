// glossary 網羅性検査 — 全 LifecycleState / EstimateState が表示辞書に存在すること。
// 型が増えたのに辞書が追随しない（表示が undefined になる）退行を落とす。

import { describe, expect, it } from 'vitest';
import { ESTIMATE_JA, LIFECYCLE_JA } from './glossary';
import type { EstimateState, LifecycleState } from './engine';

const ALL_LIFECYCLE: LifecycleState[] = [
  'pending',
  'ready',
  'implementing',
  'implemented',
  'accepted',
  'cancelled',
];
const ALL_ESTIMATE: EstimateState[] = ['proposed', 'agreed'];

describe('glossary covers every state', () => {
  it('has a label for every LifecycleState', () => {
    for (const s of ALL_LIFECYCLE) {
      expect(LIFECYCLE_JA[s]).toBeTruthy();
    }
    expect(Object.keys(LIFECYCLE_JA).sort()).toEqual([...ALL_LIFECYCLE].sort());
  });

  it('has a label for every EstimateState', () => {
    for (const s of ALL_ESTIMATE) {
      expect(ESTIMATE_JA[s]).toBeTruthy();
    }
    expect(Object.keys(ESTIMATE_JA).sort()).toEqual([...ALL_ESTIMATE].sort());
  });
});
