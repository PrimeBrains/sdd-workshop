// Automated fidelity gate (UI-DESIGN-BRIEF §8). Scans production source for the
// forbidden patterns that would re-introduce evm-studio-style violations, and
// asserts derive() is called in exactly one place (the store) — the single
// source of truth (R-S2). Test files are excluded (they quote the patterns).

import { describe, expect, it } from 'vitest';

const raw = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = Object.entries(raw).filter(
  ([p]) => !p.includes('.test.') && !p.endsWith('.d.ts'),
);

const FORBIDDEN: Array<{ name: string; re: RegExp }> = [
  { name: 'progress%-midpoint (P1)', re: /progress\s*\/\s*100/ },
  { name: 'bac*progress EV approximation (P1)', re: /\bbac\b\s*\*/i },
  { name: 'MD→yen coefficient 600000 (A6)', re: /600_?000/ },
  // Targets actual self-state setters/handlers, not prose explaining their absence.
  { name: 'warning self-state setter/handler (§2.1)', re: /\b(setDismissed|setSnoozed|setSeen|setAcknowledged|onDismiss|onSnooze|dismissItem|markAsRead|markSeen)\b/ },
  { name: 'frozenSlot null-potting (§0 #1)', re: /frozenSlot\s*(\?\?|\|\|)\s*(asOf|0)\b/ },
  { name: 'skill/difficulty in assignment (A4)', re: /\b(skillLevel|difficulty|habituation)\b/ },
];

describe('UI fidelity gate', () => {
  for (const { name, re } of FORBIDDEN) {
    it(`forbids: ${name}`, () => {
      const hits = sources.filter(([, src]) => re.test(src)).map(([p]) => p);
      expect(hits, `pattern ${re} found in ${hits.join(', ')}`).toEqual([]);
    });
  }

  it('derive is imported only by the engine bridge and the per-mode derivation stores (single source of truth)', () => {
    // A surface cannot call derive() without importing the binding; forbidding the
    // import in surfaces is equivalent to forbidding a second derivation.
    // portfolio-derive.ts is the portfolio mode's ONE derivation call-site (one
    // derive per project, same engine — INV-2 golden pins parity); surfaces still
    // never import derive.
    const importers = sources
      .filter(([, src]) => /import\s*\{[^}]*\bderive\b[^}]*\}\s*from/.test(src))
      .map(([p]) => p)
      .sort();
    expect(importers).toEqual([
      './moira/engine.ts',
      './moira/portfolio-derive.ts',
      './moira/store.tsx',
    ]);
  });

  it('type="range" appears only in capacity editing (c ∈ [0,1.0] is the sole exception)', () => {
    const hits = sources
      .filter(([, src]) => /type=["']range["']/.test(src))
      .map(([p]) => p)
      .filter((p) => !p.includes('/capacity/'));
    expect(hits).toEqual([]);
  });
});
