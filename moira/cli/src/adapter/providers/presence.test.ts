// Presence provider — existence-only expectations from declarative rules.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProviderConfig } from '../provider-config.js';
import { presenceProvider } from './presence.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-presence-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const cfg: ProviderConfig = {
  schemaVersion: 1,
  id: 'docs-flow',
  detect: ['docs'],
  phases: ['discovery', 'design'],
  triggers: [],
  drift: {
    mode: 'presence',
    rules: [
      {
        scanDir: 'docs',
        pathPattern: '^docs/(?<feature>[^/]+)/design\\.md$',
        expectNodes: [
          { node: '{feature}', parent: 'root', label: '{feature}' },
          { node: '{feature}/design', parent: '{feature}', label: '設計' },
        ],
      },
    ],
  },
};

describe('presenceProvider', () => {
  it('maps matching artifacts to existence-only expected nodes ({feature} substituted)', () => {
    mkdirSync(join(tmp, 'docs', 'alpha'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'alpha', 'design.md'), '# design');
    mkdirSync(join(tmp, 'docs', 'beta'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'beta', 'design.md'), '# design');
    writeFileSync(join(tmp, 'docs', 'beta', 'notes.md'), 'not a trigger');

    const p = presenceProvider(cfg);
    expect(p.detect(tmp)).toBe(true);
    const expected = p.loadExpected(tmp, 'root');
    expect(expected.map((f) => f.feature)).toEqual(['alpha', 'beta']); // sorted
    const alpha = expected[0]!;
    expect(alpha.sourcePhase).toBe('presence');
    expect(alpha.nodes.map((n) => n.node)).toEqual(['alpha', 'alpha/design']);
    // existence only — presence sees no progress
    expect(alpha.nodes.every((n) => n.minLifecycle === null && n.maxLifecycle === null)).toBe(true);
    expect(alpha.nodes[1]!.parent).toBe('alpha');
    expect(alpha.implGroup).toBeUndefined();
  });

  it('absent scanDir → no expectations; detect false without the artifact dir', () => {
    const p = presenceProvider(cfg);
    expect(p.detect(tmp)).toBe(false);
    expect(p.loadExpected(tmp, 'root')).toEqual([]);
  });

  it('deduplicates nodes when several artifacts imply the same feature', () => {
    const two: ProviderConfig = {
      ...cfg,
      drift: {
        mode: 'presence',
        rules: [
          {
            scanDir: 'docs',
            pathPattern: '^docs/(?<feature>[^/]+)/(design|api)\\.md$',
            expectNodes: [{ node: '{feature}', parent: 'root' }],
          },
        ],
      },
    };
    mkdirSync(join(tmp, 'docs', 'alpha'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'alpha', 'design.md'), 'x');
    writeFileSync(join(tmp, 'docs', 'alpha', 'api.md'), 'x');
    const expected = presenceProvider(two).loadExpected(tmp, 'root');
    expect(expected).toHaveLength(1);
    expect(expected[0]!.nodes).toHaveLength(1); // dedup across files
  });
});
