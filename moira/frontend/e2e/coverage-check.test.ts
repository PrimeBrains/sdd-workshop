// 計器③ coverage / tripwire GATE (the depcruise analog for E2E scenario regression).
// Runs under vitest (so it auto-discovers *.meta.ts via import.meta.glob and reads
// the scenario units/flows via fs). Falsifiable checks — any violation fails the suite:
//   1. agreed units & spec metas actually exist (empty-glob guard → no false pass)
//   2. every UNIT spec meta targets an EXISTING AGREED unit (rejects draft targets)
//   3. every FLOW spec meta targets an EXISTING flow whose composed units are all
//      agreed (the flow doc itself may be draft — it is the integration target being
//      ratified separately; treated as agreed-equivalent)
//   4. every §6 EARS clause is accounted for (count match → no silent omission)
//   5. xfail/deferred clauses carry a justification note (enumerable, justified gap)
import { describe, it, expect } from 'vitest';
// NB: import from 'fs'/'path' (NOT 'node:fs') — vite.config aliases 'node:fs' to a
// browser shim for the backend bundle, which would stub readdirSync to undefined here.
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { type SpecMeta } from './spec-meta';

// vitest cwd = moira/frontend; units/flows live under <repo>/.kiro/scenarios.
const UNITS_DIR = resolve(process.cwd(), '../../.kiro/scenarios/units');
const FLOWS_DIR = resolve(process.cwd(), '../../.kiro/scenarios/flows');

interface DocInfo {
  slug: string;
  status: string;
  earsCount: number;
  composes: string[];
}

function frontmatter(text: string): string {
  return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
}

function countEarsClauses(text: string): number {
  // §6 body: from "## 6." up to the next "## " heading (or EOF).
  const body = /\n##\s*6\.[^\n]*\n([\s\S]*?)(?:\n##\s|$)/.exec(text)?.[1] ?? '';
  return (body.match(/^- \*\*(WHEN|WHILE)\*\*/gm) ?? []).length;
}

function parseComposes(fm: string): string[] {
  // composes: a YAML list of "  - units/foo" lines under a `composes:` key.
  const block = /composes:\s*\n((?:\s*-\s*\S+\s*\n?)+)/.exec(fm)?.[1] ?? '';
  return [...block.matchAll(/-\s*(\S+)/g)].map((m) => m[1]!);
}

function readDocs(dir: string): DocInfo[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      // Normalize CRLF: a core.autocrlf=true checkout (Windows) materializes the
      // units with \r\n, which would break the LF-anchored frontmatter regexes.
      const text = readFileSync(resolve(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const fm = frontmatter(text);
      return {
        slug: f.replace(/\.md$/, ''),
        status: /^status:\s*(\S+)/m.exec(fm)?.[1] ?? 'unknown',
        earsCount: countEarsClauses(text),
        composes: parseComposes(fm),
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

const units = readDocs(UNITS_DIR);
const flows = readDocs(FLOWS_DIR);
const unitBySlug = new Map(units.map((u) => [u.slug, u]));
const flowBySlug = new Map(flows.map((f) => [f.slug, f]));
const agreedUnits = units.filter((u) => u.status === 'agreed');

const isFlow = (m: SpecMeta) => m.scenarioUnit.startsWith('flows/');
const slugOf = (scenarioUnit: string) => scenarioUnit.replace(/^(units|flows)\//, '');
const unitMetas = metas.filter((m) => !isFlow(m.meta));
const flowMetas = metas.filter((m) => isFlow(m.meta));

function assertClauseAccounting(file: string, meta: SpecMeta, earsCount: number, slug: string): void {
  expect(
    meta.clauses.length,
    `${file}: declares ${meta.clauses.length} clauses but ${slug} §6 has ${earsCount}`,
  ).toBe(earsCount);
  const declared = new Set(meta.clauses.map((c) => c.ears));
  for (let i = 1; i <= earsCount; i += 1) {
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

describe('E2E scenario-regression coverage gate (計器③)', () => {
  it('finds agreed units and spec metas (empty-glob guard)', () => {
    expect(agreedUnits.length, `no agreed units under ${UNITS_DIR}`).toBeGreaterThan(0);
    expect(metas.length, 'no *.meta.ts under e2e/specs').toBeGreaterThan(0);
    expect(flows.length, `no flows under ${FLOWS_DIR}`).toBeGreaterThan(0);
  });

  it('every UNIT spec meta targets an existing AGREED unit', () => {
    for (const { file, meta } of unitMetas) {
      const unit = unitBySlug.get(slugOf(meta.scenarioUnit));
      expect(unit, `${file}: scenarioUnit ${meta.scenarioUnit} not found under units/`).toBeDefined();
      expect(
        unit!.status,
        `${file}: ${meta.scenarioUnit} is '${unit!.status}' — unit E2E specs may only target agreed units`,
      ).toBe('agreed');
    }
  });

  it('every FLOW spec meta targets an existing flow whose composed members are all agreed', () => {
    for (const { file, meta } of flowMetas) {
      const flow = flowBySlug.get(slugOf(meta.scenarioUnit));
      expect(flow, `${file}: scenarioUnit ${meta.scenarioUnit} not found under flows/`).toBeDefined();
      // The flow doc may be draft (ratified separately); its MEMBERS must be agreed —
      // a flow E2E that walks un-agreed members would lock unsettled behavior.
      for (const member of flow!.composes) {
        const u = unitBySlug.get(slugOf(member));
        expect(u, `${file}: composed member ${member} not found under units/`).toBeDefined();
        expect(u!.status, `${file}: composed member ${member} is '${u!.status}' (must be agreed)`).toBe(
          'agreed',
        );
      }
    }
  });

  it('every spec meta accounts for ALL §6 EARS clauses (no silent omission)', () => {
    for (const { file, meta } of unitMetas) {
      const unit = unitBySlug.get(slugOf(meta.scenarioUnit))!;
      assertClauseAccounting(file, meta, unit.earsCount, unit.slug);
    }
    for (const { file, meta } of flowMetas) {
      const flow = flowBySlug.get(slugOf(meta.scenarioUnit))!;
      assertClauseAccounting(file, meta, flow.earsCount, flow.slug);
    }
  });

  // Breadth coverage is a VISIBLE GAP report, not a hard fail — scenario units are
  // authored live, and per the project's own discipline a missing spec is shown
  // (like P2 < 100% is shown), not treated as a build break. The HARD gate is the
  // faithfulness/completeness of the specs that DO exist (checks above). Uncovered
  // agreed units are listed so the gap is enumerable and shrinks via /kiro-scenario-e2e.
  it('coverage map (uncovered agreed units = visible gap, not a failure)', () => {
    const covered = new Set(unitMetas.map((m) => slugOf(m.meta.scenarioUnit)));
    const lines = ['', 'E2E coverage map (計器③):'];
    for (const { meta } of metas) {
      const by = (mode: string) => meta.clauses.filter((c) => c.mode === mode).length;
      lines.push(
        `  ✓ ${meta.scenarioUnit}: ${by('green')} green · ${by('xfail')} xfail · ${by('deferred')} deferred (of ${meta.clauses.length})`,
      );
    }
    const uncovered = agreedUnits.filter((u) => !covered.has(u.slug)).map((u) => u.slug);
    lines.push(`  covered ${covered.size}/${agreedUnits.length} agreed units; ${flowMetas.length} flow(s).`);
    if (uncovered.length > 0) {
      lines.push(`  visible gap — agreed units needing an E2E spec (run /kiro-scenario-e2e):`);
      for (const slug of uncovered) lines.push(`    · ${slug}`);
    }
    console.log(lines.join('\n'));
    expect(true).toBe(true);
  });
});
