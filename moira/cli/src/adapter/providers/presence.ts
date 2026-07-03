// Presence provider — the generic declarative minimum for drift (issue #14
// Stage 2 / ADR-0003): "this artifact exists ⇒ these nodes must exist in the
// log". No lifecycle normalization (that needs methodology semantics = a code
// provider); existence-only expectations still catch the most common miss —
// a milestone artifact landed but the discovery/phase firing never happened.
//
// Honesty: what presence CANNOT see (progress, approvals, estimates) it does
// not claim. minLifecycle stays null (existence only), no impl groups.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderConfig, PresenceRule } from '../provider-config.js';
import type { ExpectedFeature, ExpectedNode } from '../drift/types.js';
import type { MethodologyProvider } from './provider.js';
import { existsSync } from 'node:fs';

const MAX_SCAN_ENTRIES = 20_000; // runaway guard for accidental scanDir: "."

function* walkFiles(root: string, rel = '', budget = { n: 0 }): Generator<string> {
  let entries;
  try {
    entries = readdirSync(join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (budget.n >= MAX_SCAN_ENTRIES) return;
    budget.n += 1;
    const childRel = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      yield* walkFiles(root, childRel, budget);
    } else if (e.isFile()) {
      yield childRel;
    }
  }
}

const substitute = (template: string, feature: string): string =>
  template.replaceAll('{feature}', feature);

function applyRule(
  workDir: string,
  rule: PresenceRule,
  byFeature: Map<string, ExpectedFeature>,
): void {
  const re = new RegExp(rule.pathPattern);
  const scanRoot = join(workDir, ...rule.scanDir.split('/'));
  try {
    if (!statSync(scanRoot).isDirectory()) return;
  } catch {
    return; // scanDir absent → no expectations from this rule
  }
  for (const rel of walkFiles(scanRoot)) {
    const repoRel = `${rule.scanDir}/${rel}`;
    const m = re.exec(repoRel);
    const feature = m?.groups?.['feature'];
    if (feature === undefined) continue;
    const existing = byFeature.get(feature);
    const target: ExpectedFeature =
      existing ??
      ({
        feature,
        sourcePath: repoRel,
        sourcePhase: 'presence',
        nodes: [],
      } satisfies ExpectedFeature);
    for (const en of rule.expectNodes) {
      const node = substitute(en.node, feature);
      if (target.nodes.some((n) => n.node === node)) continue; // dedup across rules/files
      const expected: ExpectedNode = {
        node,
        parent: substitute(en.parent, feature),
        minLifecycle: null, // existence only — presence sees no progress
        maxLifecycle: null,
        severity: 'hard',
        evidence: `${repoRel} が存在（presence ルール ${rule.pathPattern}）`,
        ...(en.label !== undefined ? { label: substitute(en.label, feature) } : {}),
      };
      target.nodes.push(expected);
    }
    byFeature.set(feature, target);
  }
}

export function presenceProvider(cfg: ProviderConfig): MethodologyProvider {
  if (cfg.drift.mode !== 'presence') throw new Error('presenceProvider requires drift.mode=presence');
  const rules = cfg.drift.rules;
  return {
    id: cfg.id,
    detect(cwd: string): boolean {
      return cfg.detect.some((p) => existsSync(join(cwd, ...p.split('/'))));
    },
    loadExpected(cwd: string, _projectRoot: string): ExpectedFeature[] {
      const byFeature = new Map<string, ExpectedFeature>();
      for (const rule of rules) applyRule(cwd, rule, byFeature);
      return [...byFeature.values()].sort((a, b) => a.feature.localeCompare(b.feature));
    },
  };
}
