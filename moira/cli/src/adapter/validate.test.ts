// `moira adapter validate-provider` — schema check CLI (Stage 3).

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliError } from '../errors.js';
import { cmdValidateProvider } from './validate.js';

let tmp: string;
let stdout: string[];
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-vp-'));
  stdout = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
    stdout.push(String(s));
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

describe('cmdValidateProvider', () => {
  it('valid config → OK line with id/phases/triggers/drift', () => {
    const p = join(tmp, 'ok.json');
    writeFileSync(
      p,
      JSON.stringify({
        schemaVersion: 1,
        id: 'docs-flow',
        detect: ['docs'],
        phases: ['design'],
        triggers: [],
        drift: { mode: 'unsupported' },
      }),
    );
    cmdValidateProvider([p]);
    expect(stdout.join('')).toContain('OK: provider "docs-flow"');
    expect(stdout.join('')).toContain('drift unsupported');
  });

  it('invalid config → CliError listing every problem; missing file / bad JSON are loud', () => {
    const p = join(tmp, 'bad.json');
    writeFileSync(p, JSON.stringify({ schemaVersion: 2, id: '', detect: [], phases: [], triggers: [], drift: { mode: 'x' } }));
    expect(() => cmdValidateProvider([p])).toThrow(/スキーマ不正（\d+ 件）/);
    expect(() => cmdValidateProvider([join(tmp, 'nope.json')])).toThrow(CliError);
    const broken = join(tmp, 'broken.json');
    writeFileSync(broken, '{ broken');
    expect(() => cmdValidateProvider([broken])).toThrow(/JSON として読めない/);
    expect(() => cmdValidateProvider([])).toThrow(/usage/);
  });
});
