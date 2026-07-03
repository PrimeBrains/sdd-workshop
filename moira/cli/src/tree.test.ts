// resolveAddParent — the issue-#5 fallback rules (pure, no fs).

import { fold } from 'moira-backend';
import type { Event } from 'moira-backend';
import { describe, expect, it } from 'vitest';
import { resolveAddParent } from './tree.js';

const human = { kind: 'human', id: 'h1' } as const;

/** app → feat → feat/req (the playground shape that tripped issue #5). */
const LOG: Event[] = [
  { kind: 'decompose', id: 'e1', ts: 1, actor: human, parent: 'app', reason: 'init', children: [{ node: 'feat' }] },
  { kind: 'decompose', id: 'e2', ts: 2, actor: human, parent: 'feat', reason: 'phases', children: [{ node: 'feat/req', estimate: 1 }] },
];

describe('resolveAddParent', () => {
  it('an explicit --parent always wins, silently', () => {
    const r = resolveAddParent(fold(LOG), 'feat/req', 'feat', 'app');
    expect(r).toEqual({ parent: 'feat' });
  });

  it('reuses the existing tree parent when --parent is omitted (issue #5 repro)', () => {
    // `moira add feat/req --estimate 0.5` without --parent used to re-root the
    // node under `app`, minting a second decompose edge. Now it must reuse `feat`.
    const r = resolveAddParent(fold(LOG), 'feat/req', undefined, 'app');
    expect(r.parent).toBe('feat');
    expect(r.note).toContain("reusing existing parent 'feat'");
  });

  it('falls back to project root for a NEW node — with a visible warning', () => {
    const r = resolveAddParent(fold(LOG), 'brand-new', undefined, 'app');
    expect(r.parent).toBe('app');
    expect(r.note).toContain("under project root 'app'");
  });

  it('a known node that was never attached (no tree parent) also warns to root', () => {
    // `app` itself exists in the folded state but has parent=null.
    const r = resolveAddParent(fold(LOG), 'app', undefined, 'app');
    expect(r.parent).toBe('app');
    expect(r.note).toContain('warning');
  });
});
