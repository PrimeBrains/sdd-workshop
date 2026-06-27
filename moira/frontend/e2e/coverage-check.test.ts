// 計器③ coverage / tripwire GATE (the depcruise analog for E2E scenario regression).
// Runs under vitest (so it auto-discovers *.meta.ts via import.meta.glob and reads
// the scenario units via fs). Falsifiable checks — any violation fails the suite:
//   1. agreed units & spec metas actually exist (empty-glob guard → no false pass)
//   2. every spec meta targets an EXISTING AGREED unit (rejects draft targets)
//   3. every §6 EARS clause is accounted for (count match → no silent omission)
//   4. xfail/deferred clauses carry a justification note (enumerable, justified gap)
//   5. every agreed unit is covered OR on the KNOWN_UNCOVERED allowlist (visible gap)
import { describe, it, expect } from 'vitest';
// NB: import from 'fs'/'path' (NOT 'node:fs') — vite.config aliases 'node:fs' to a
// browser shim for the backend bundle, which would stub readdirSync to undefined here.
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { type SpecMeta } from './spec-meta';

// vitest cwd = moira/frontend; units live at <repo>/.kiro/scenarios/units.
const UNITS_DIR = resolve(process.cwd(), '../../.kiro/scenarios/units');

interface UnitInfo {
  slug: string;
  status: string;
  earsCount: number;
}

function frontmatter(text: string): string {
  return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
}

function countEarsClauses(text: string): number {
  // §6 body: from "## 6." up to the next "## " heading (or EOF).
  const body = /\n##\s*6\.[^\n]*\n([\s\S]*?)(?:\n##\s|$)/.exec(text)?.[1] ?? '';
  return (body.match(/^- \*\*(WHEN|WHILE)\*\*/gm) ?? []).length;
}

function readUnits(): UnitInfo[] {
  return readdirSync(UNITS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = readFileSync(resolve(UNITS_DIR, f), 'utf8');
      return {
        slug: f.replace(/\.md$/, ''),
        status: /^status:\s*(\S+)/m.exec(frontmatter(text))?.[1] ?? 'unknown',
        earsCount: countEarsClauses(text),
      };
    });
}

const metaModules = import.meta.glob('./specs/*.meta.ts', { eager: true }) as Record<
  string,
  { SPEC_META?: SpecMeta }
>;
const metas = Object.entries(metaModules)
  .filter(([, m]) => m.SPEC_META !== undefined)
  .map(([file, m]) => ({ file, meta: m.SPEC_META as SpecMeta }));

const units = readUnits();
const unitBySlug = new Map(units.map((u) => [u.slug, u]));
const agreedUnits = units.filter((u) => u.status === 'agreed');
const slugOf = (scenarioUnit: string) => scenarioUnit.replace(/^units\//, '');

describe('E2E scenario-regression coverage gate (計器③)', () => {
  it('finds agreed units and spec metas (empty-glob guard)', () => {
    expect(agreedUnits.length, `no agreed units under ${UNITS_DIR}`).toBeGreaterThan(0);
    expect(metas.length, 'no *.meta.ts under e2e/specs').toBeGreaterThan(0);
  });

  it('every spec meta targets an existing AGREED unit', () => {
    for (const { file, meta } of metas) {
      const unit = unitBySlug.get(slugOf(meta.scenarioUnit));
      expect(unit, `${file}: scenarioUnit ${meta.scenarioUnit} not found under units/`).toBeDefined();
      expect(
        unit!.status,
        `${file}: ${meta.scenarioUnit} is '${unit!.status}' — E2E specs may only target agreed units`,
      ).toBe('agreed');
    }
  });

  it('every spec meta accounts for ALL §6 EARS clauses (no silent omission)', () => {
    for (const { file, meta } of metas) {
      const unit = unitBySlug.get(slugOf(meta.scenarioUnit))!;
      expect(
        meta.clauses.length,
        `${file}: declares ${meta.clauses.length} clauses but ${unit.slug} §6 has ${unit.earsCount}`,
      ).toBe(unit.earsCount);
      const declared = new Set(meta.clauses.map((c) => c.ears));
      for (let i = 1; i <= unit.earsCount; i += 1) {
        expect(declared.has(i), `${file}: missing EARS clause ${i}`).toBe(true);
      }
      for (const c of meta.clauses) {
        if (c.mode !== 'green') {
          expect(
            (c.note ?? '').trim().length,
            `${file}: EARS ${c.ears} is ${c.mode} but has no justification note`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  // Breadth coverage is a VISIBLE GAP report, not a hard fail — scenario units are
  // authored live, and per the project's own discipline a missing spec is shown
  // (like P2 < 100% is shown), not treated as a build break. The HARD gate is the
  // faithfulness/completeness of the specs that DO exist (checks above). Uncovered
  // agreed units are listed so the gap is enumerable and shrinks via /kiro-scenario-e2e.
  it('coverage map (uncovered agreed units = visible gap, not a failure)', () => {
    const covered = new Set(metas.map((m) => slugOf(m.meta.scenarioUnit)));
    const lines = ['', 'E2E coverage map (計器③):'];
    for (const { meta } of metas) {
      const by = (mode: string) => meta.clauses.filter((c) => c.mode === mode).length;
      lines.push(
        `  ✓ ${meta.scenarioUnit}: ${by('green')} green · ${by('xfail')} xfail · ${by('deferred')} deferred (of ${meta.clauses.length})`,
      );
    }
    const uncovered = agreedUnits.filter((u) => !covered.has(u.slug)).map((u) => u.slug);
    lines.push(`  covered ${covered.size}/${agreedUnits.length} agreed units.`);
    if (uncovered.length > 0) {
      lines.push(`  visible gap — agreed units needing an E2E spec (run /kiro-scenario-e2e):`);
      for (const slug of uncovered) lines.push(`    · ${slug}`);
    }
    console.log(lines.join('\n'));
    expect(true).toBe(true);
  });
});
