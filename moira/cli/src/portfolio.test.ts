// Portfolio config loader — schema v1 validation + per-entry single-home
// resolution (issue #23). No merging: entries map 1:1 to homes (D-50 holds).

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliError } from './errors.js';
import {
  loadPortfolioConfig,
  resolvePortfolioEntries,
  validatePortfolioConfig,
} from './portfolio.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-portfolio-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Create a real log home at <tmp>/<name>: .moira/config.json present. */
function makeHome(name: string): string {
  const root = join(tmp, name);
  mkdirSync(join(root, '.moira'), { recursive: true });
  writeFileSync(join(root, '.moira', 'config.json'), JSON.stringify({ projectRoot: 'p', me: 'me' }));
  return root;
}

function writePortfolio(name: string, body: unknown): string {
  const p = join(tmp, name);
  writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
  return p;
}

/** Mirrors portfolio.ts's canonicalKey (realpath; falls back for nonexistent paths). */
function canon(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

describe('validatePortfolioConfig', () => {
  it('accepts a minimal valid config', () => {
    const { config, errors } = validatePortfolioConfig({
      schemaVersion: 1,
      homes: [{ path: '../a' }],
    });
    expect(errors).toEqual([]);
    expect(config?.homes).toHaveLength(1);
  });

  it('collects ALL errors instead of stopping at the first', () => {
    const { config, errors } = validatePortfolioConfig({
      schemaVersion: 2,
      label: 7,
      homes: [{ path: '' }, 'not-an-object', { path: 'ok', label: 3 }],
    });
    expect(config).toBeNull();
    expect(errors).toEqual([
      'schemaVersion は 1 のみ対応',
      'label は非空文字列',
      'homes[0].path（非空文字列）が必要',
      'homes[1] はオブジェクト（{path, label?}）',
      'homes[2].label は非空文字列',
    ]);
  });

  it('rejects a missing/empty homes array', () => {
    expect(validatePortfolioConfig({ schemaVersion: 1 }).errors).toContain(
      'homes は非空の配列（{path, label?} を並べる）',
    );
    expect(validatePortfolioConfig({ schemaVersion: 1, homes: [] }).errors).toContain(
      'homes は非空の配列（{path, label?} を並べる）',
    );
  });

  it('rejects a non-object root', () => {
    expect(validatePortfolioConfig([1, 2]).errors).toEqual([
      'portfolio config はオブジェクトである必要がある',
    ]);
  });
});

describe('loadPortfolioConfig', () => {
  it('loads a valid file', () => {
    const p = writePortfolio('portfolio.json', {
      schemaVersion: 1,
      label: '部門ポートフォリオ',
      homes: [{ path: 'a' }, { path: 'b', label: '案件B' }],
    });
    const cfg = loadPortfolioConfig(p);
    expect(cfg.label).toBe('部門ポートフォリオ');
    expect(cfg.homes).toHaveLength(2);
  });

  it('throws a CliError listing every validation problem', () => {
    const p = writePortfolio('bad.json', { schemaVersion: 9, homes: [] });
    expect(() => loadPortfolioConfig(p)).toThrowError(CliError);
    expect(() => loadPortfolioConfig(p)).toThrowError(/schemaVersion は 1 のみ対応/);
    expect(() => loadPortfolioConfig(p)).toThrowError(/homes は非空の配列/);
  });

  it('throws on unreadable / non-JSON files', () => {
    expect(() => loadPortfolioConfig(join(tmp, 'absent.json'))).toThrowError(/読めない/);
    const p = writePortfolio('not-json.json', '{nope');
    expect(() => loadPortfolioConfig(p)).toThrowError(/JSON として不正/);
  });
});

describe('resolvePortfolioEntries', () => {
  it('resolves relative paths against the portfolio file directory, 1 entry = 1 home', () => {
    const a = makeHome('proj-a');
    const b = makeHome('proj-b');
    const p = writePortfolio('portfolio.json', {
      schemaVersion: 1,
      homes: [{ path: 'proj-a' }, { path: 'proj-b', label: '案件B' }],
    });
    const entries = resolvePortfolioEntries(loadPortfolioConfig(p), p);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ key: canon(resolve(a)), root: resolve(a) });
    expect(entries[1]).toEqual({ key: canon(resolve(b)), root: resolve(b), label: '案件B' });
  });

  it('follows a .moira pointer file one hop (per entry — still one home each)', () => {
    const home = makeHome('shared-home');
    const work = join(tmp, 'work-repo');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.moira'), `home: ${home}\n`);
    const p = writePortfolio('portfolio.json', { schemaVersion: 1, homes: [{ path: 'work-repo' }] });
    const entries = resolvePortfolioEntries(loadPortfolioConfig(p), p);
    expect(entries[0]!.root).toBe(resolve(home));
    expect(entries[0]!.resolveError).toBeUndefined();
  });

  it('records a broken pointer as resolveError (visible gap, not silently swallowed)', () => {
    const work = join(tmp, 'broken-repo');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.moira'), 'not a pointer format\n');
    const p = writePortfolio('portfolio.json', { schemaVersion: 1, homes: [{ path: 'broken-repo' }] });
    const entries = resolvePortfolioEntries(loadPortfolioConfig(p), p);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.resolveError).toMatch(/ポインタファイルの形式が不正/);
  });

  it('a missing home is NOT fatal at resolution time (caller surfaces loadError)', () => {
    const p = writePortfolio('portfolio.json', { schemaVersion: 1, homes: [{ path: 'no-such' }] });
    const entries = resolvePortfolioEntries(loadPortfolioConfig(p), p);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.root).toBe(resolve(join(tmp, 'no-such')));
  });

  it('rejects duplicate homes (same normalized root) as a config error', () => {
    makeHome('proj-a');
    const p = writePortfolio('portfolio.json', {
      schemaVersion: 1,
      homes: [{ path: 'proj-a' }, { path: './proj-a/' }],
    });
    expect(() => resolvePortfolioEntries(loadPortfolioConfig(p), p)).toThrowError(
      /home の重複/,
    );
  });

  it.runIf(process.platform === 'win32')(
    'rejects case-variant duplicates on a case-insensitive filesystem (realpath canonicalization)',
    () => {
      makeHome('proj-a');
      const p = writePortfolio('portfolio.json', {
        schemaVersion: 1,
        homes: [{ path: 'proj-a' }, { path: 'PROJ-A' }],
      });
      expect(() => resolvePortfolioEntries(loadPortfolioConfig(p), p)).toThrowError(
        /home の重複/,
      );
    },
  );
});
