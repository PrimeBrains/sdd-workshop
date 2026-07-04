// Deterministic renderers for custom providers (ADR-0003 Stage 2).

import { describe, expect, it } from 'vitest';
import type { ProviderConfig } from './provider-config.js';
import { renderProviderReference, renderSteering } from './render.js';

const cfg: ProviderConfig = {
  schemaVersion: 1,
  id: 'docs-flow',
  displayName: 'Docs-driven flow',
  detect: ['docs'],
  phases: ['discovery', 'design', 'impl', 'sync'],
  nodeScheme: {
    phaseChildren: [{ suffix: 'design', label: '設計' }],
    implPrefix: 'impl-',
    reviewNode: 'review-impl',
  },
  edges: [{ from: 'design', to: 'impl-*', policy: 'accepted' }],
  scope: { claim: ['alpha/*'] },
  triggers: [
    {
      pathPattern: '(?:^|/)docs/(?<feature>[^/]+)/design\\.md$',
      read: 'none',
      advise: [{ when: 'always', phase: 'design', message: 'x' }],
    },
  ],
  drift: {
    mode: 'presence',
    rules: [
      {
        scanDir: 'docs',
        pathPattern: '^docs/(?<feature>[^/]+)/design\\.md$',
        expectNodes: [{ node: '{feature}', parent: 'root' }],
      },
    ],
  },
};

describe('renderProviderReference', () => {
  const md = renderProviderReference(cfg);

  it('is deterministic and carries the declared scheme/edges/triggers/claim', () => {
    expect(renderProviderReference(cfg)).toBe(md);
    expect(md).toContain('Docs-driven flow（id: docs-flow）');
    expect(md).toContain('| `design` | 設計 |');
    expect(md).toContain('`<feature>/impl-1`');
    expect(md).toContain('| `design` | `impl-*` | `accepted` |');
    expect(md).toContain('`alpha/*`');
    expect(md).toContain('docs/(?<feature>[^/]+)/design\\.md$');
  });

  it('marks the per-phase choreography honestly as to-be-authored (never inherits cc-sdd prose)', () => {
    expect(md).toContain('⚠ 未著');
    expect(md).not.toContain('kiro-discovery'); // no cc-sdd vocabulary leaks in
    expect(md).not.toContain('.kiro/specs');
  });

  it('renders the presence drift contract; unsupported renders the loud-error note', () => {
    expect(md).toContain('presence（存在検知のみ）');
    const un = renderProviderReference({ ...cfg, drift: { mode: 'unsupported' } });
    expect(un).toContain('明示エラー');
  });
});

describe('renderSteering', () => {
  it('renders the fixed guard-rail table plus the config-derived trigger rows', () => {
    const md = renderSteering(cfg);
    expect(renderSteering(cfg)).toBe(md);
    expect(md).toContain('必ず `--parent <正しい親>`');
    expect(md).toContain('着手ゲート');
    expect(md).toContain('/moira-track design');
    expect(md).toContain('/moira-track sync');
    expect(md).not.toContain('kiro-discovery');
  });

  it('a trigger-less provider renders the honest fallback row', () => {
    const md = renderSteering({ ...cfg, triggers: [] });
    expect(md).toContain('triggers 未宣言');
  });

  it('both renders carry the engine-generic ticket-driven entry (ADR-0004)', () => {
    expect(renderSteering(cfg)).toContain('/moira-track ticket');
    expect(renderSteering(cfg)).toContain('UserPromptSubmit');
    expect(renderProviderReference(cfg)).toContain('/moira-track ticket');
  });
});
