// Schema v1 validator — collects ALL errors; the bundled cc-sdd template must validate.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateProviderConfig } from './provider-config.js';

const bundled = (): unknown =>
  JSON.parse(
    readFileSync(new URL('../../templates/claude/moira-provider.json', import.meta.url), 'utf8'),
  );

const minimal = (): Record<string, unknown> => ({
  schemaVersion: 1,
  id: 'docs-flow',
  detect: ['docs'],
  phases: ['discovery', 'design'],
  triggers: [
    {
      pathPattern: '(?:^|/)docs/(?<feature>[^/]+)/design\\.md$',
      read: 'none',
      advise: [{ when: 'always', phase: 'design', message: '設計 {feature} を検知' }],
    },
  ],
  drift: { mode: 'unsupported' },
});

describe('validateProviderConfig', () => {
  it('the bundled cc-sdd template validates clean', () => {
    const { config, errors } = validateProviderConfig(bundled());
    expect(errors).toEqual([]);
    expect(config?.id).toBe('cc-sdd');
    expect(config?.drift).toEqual({ mode: 'builtin', builtin: 'cc-sdd' });
  });

  it('a minimal non-cc-sdd config validates clean', () => {
    const { config, errors } = validateProviderConfig(minimal());
    expect(errors).toEqual([]);
    expect(config?.id).toBe('docs-flow');
  });

  it('collects EVERY error (never stops at the first)', () => {
    const bad = minimal();
    bad['schemaVersion'] = 2;
    bad['id'] = '';
    bad['detect'] = [];
    (bad['triggers'] as Array<Record<string, unknown>>)[0]!['pathPattern'] = '(?<feature>[unclosed';
    bad['drift'] = { mode: 'mystery' };
    const { config, errors } = validateProviderConfig(bad);
    expect(config).toBeNull();
    expect(errors.length).toBeGreaterThanOrEqual(5);
    expect(errors.join('\n')).toContain('schemaVersion');
    expect(errors.join('\n')).toContain('正規表現として不正');
    expect(errors.join('\n')).toContain('drift.mode');
  });

  it('rejects a trigger pattern without the (?<feature>…) capture', () => {
    const bad = minimal();
    (bad['triggers'] as Array<Record<string, unknown>>)[0]!['pathPattern'] = 'docs/.*\\.md$';
    const { errors } = validateProviderConfig(bad);
    expect(errors.join('\n')).toContain('(?<feature>');
  });

  it('rejects an advise phase not listed in phases, and a bad when shape', () => {
    const bad = minimal();
    const advise = ((bad['triggers'] as Array<Record<string, unknown>>)[0]!['advise'] as Array<
      Record<string, unknown>
    >);
    advise[0]!['phase'] = 'nonexistent';
    advise.push({ when: {}, phase: 'design', message: 'x' }); // empty when object
    const { errors } = validateProviderConfig(bad);
    expect(errors.join('\n')).toContain('phases に無い');
    expect(errors.join('\n')).toContain("'always'");
  });

  it('validates presence rules (regex, feature capture, expectNodes) and edges policy', () => {
    const bad = minimal();
    bad['drift'] = {
      mode: 'presence',
      rules: [{ scanDir: 'docs', pathPattern: 'docs/.*', expectNodes: [] }],
    };
    bad['edges'] = [{ from: 'a', to: 'b', policy: 'whenever' }];
    const { errors } = validateProviderConfig(bad);
    expect(errors.join('\n')).toContain('(?<feature>');
    expect(errors.join('\n')).toContain('expectNodes');
    expect(errors.join('\n')).toContain('policy');
  });
});
