// Drift × declarative provider config (ADR-0003 Stage 2): presence-mode e2e,
// unsupported-mode loud error, schema-invalid config error. The cc-sdd default
// path (no config file) is covered by drift-golden.test.ts — unchanged.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliError } from '../../errors.js';
import { computeDriftReport } from './drift.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-driftp-'));
  // a log home with an empty event log
  mkdirSync(join(tmp, '.moira'), { recursive: true });
  writeFileSync(join(tmp, '.moira', 'config.json'), JSON.stringify({ projectRoot: 'root', me: 'me' }));
  writeFileSync(join(tmp, '.moira', 'events.json'), '[]\n');
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writeConfig(cfg: unknown): void {
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'moira-provider.json'), JSON.stringify(cfg));
}

const presenceCfg = {
  schemaVersion: 1,
  id: 'docs-flow',
  detect: ['docs'],
  phases: ['design'],
  triggers: [],
  drift: {
    mode: 'presence',
    rules: [
      {
        scanDir: 'docs',
        pathPattern: '^docs/(?<feature>[^/]+)/design\\.md$',
        expectNodes: [
          { node: '{feature}', parent: 'root' },
          { node: '{feature}/design', parent: '{feature}', label: '設計' },
        ],
      },
    ],
  },
};

describe('computeDriftReport × declarative providers', () => {
  it('presence: artifact exists + empty log → missing-node (hard) per expected node', () => {
    writeConfig(presenceCfg);
    mkdirSync(join(tmp, 'docs', 'alpha'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'alpha', 'design.md'), '# design');

    const report = computeDriftReport(tmp, tmp);
    expect(report.provider).toBe('docs-flow');
    expect(report.features).toHaveLength(1);
    const nodes = report.features[0]!.nodes;
    const missing = nodes.filter((n) => n.status === 'missing-node');
    expect(missing.map((n) => n.node).sort()).toEqual(['alpha', 'alpha/design']);
    expect(missing.every((n) => n.severity === 'hard')).toBe(true);
    expect(report.summary.hard).toBeGreaterThanOrEqual(2);
  });

  it('unsupported: drift is a LOUD error (捏造しない), not a silent empty report', () => {
    writeConfig({ ...presenceCfg, id: 'opaque', drift: { mode: 'unsupported' } });
    mkdirSync(join(tmp, 'docs'), { recursive: true }); // detect passes
    expect(() => computeDriftReport(tmp, tmp)).toThrow(CliError);
    expect(() => computeDriftReport(tmp, tmp)).toThrow(/drift 非対応/);
  });

  it('a schema-invalid config is a loud error listing every problem', () => {
    writeConfig({ schemaVersion: 1, id: '', detect: [], phases: [], triggers: [], drift: { mode: 'x' } });
    expect(() => computeDriftReport(tmp, tmp)).toThrow(/スキーマ不正/);
  });
});
