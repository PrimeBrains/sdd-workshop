// R-T6 reference dates (issue #13): isIsoDate / latest-wins resolution /
// append-only history on disk / the `moira deadline` command end-to-end.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './commands.js';
import { CliError } from './errors.js';
import {
  isIsoDate,
  MoiraRepo,
  resolveReferenceDates,
  type ReferenceDateEntry,
} from './store.js';

describe('isIsoDate', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-09-30')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap day
  });
  it('rejects bad shapes and impossible calendar dates', () => {
    expect(isIsoDate('2026-9-30')).toBe(false);
    expect(isIsoDate('30-09-2026')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false); // shape ok, not a real day
    expect(isIsoDate('not-a-date')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('resolveReferenceDates (latest-ts wins per kind)', () => {
  it('empty history → both unset (omitted keys, not undefined)', () => {
    const r = resolveReferenceDates([]);
    expect(r).toEqual({});
    expect('deadline' in r).toBe(false);
  });
  it('latest ts wins per kind independently; ties go to the later entry', () => {
    const entries: ReferenceDateEntry[] = [
      { kind: 'deadline', date: '2026-08-31', reason: 'first', ts: 1 },
      { kind: 'target', date: '2026-08-01', reason: 'first', ts: 1 },
      { kind: 'deadline', date: '2026-09-30', reason: 'slip approved', ts: 5 },
      { kind: 'deadline', date: '2026-10-31', reason: 'same-ts later entry', ts: 5 },
    ];
    expect(resolveReferenceDates(entries)).toEqual({
      deadline: '2026-10-31',
      targetDate: '2026-08-01',
    });
  });
});

describe('MoiraRepo dates.json (append-only second tier)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'moira-dates-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('init creates dates.json; appends preserve prior entries', () => {
    const repo = new MoiraRepo(tmp);
    repo.init({ projectRoot: 'p', me: 'me' });
    expect(repo.loadDateEntries()).toEqual([]);
    repo.appendDateEntries([{ kind: 'deadline', date: '2026-09-30', reason: 'r1', ts: 1 }]);
    repo.appendDateEntries([{ kind: 'deadline', date: '2026-10-31', reason: 'r2', ts: 2 }]);
    const all = repo.loadDateEntries();
    expect(all).toHaveLength(2); // history kept — append-only (R-U14-isomorphic)
    expect(all[0]!.date).toBe('2026-09-30');
    expect(resolveReferenceDates(all).deadline).toBe('2026-10-31');
  });
});

describe('moira deadline (CLI)', () => {
  const cwd0 = process.cwd();
  let tmp: string;
  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'moira-dl-'));
    process.chdir(tmp);
    await runCli(['init', '--me', 'me', '--root', 'p']);
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('sets deadline and target, appends a reason-stamped history', async () => {
    await runCli(['deadline', '2026-09-30', '--target', '2026-09-15', '--reason', 'PJ計画']);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'dates.json'), 'utf8'),
    ) as ReferenceDateEntry[];
    expect(raw).toHaveLength(2);
    expect(raw.map((e) => e.kind).sort()).toEqual(['deadline', 'target']);
    expect(raw.every((e) => e.reason === 'PJ計画' && typeof e.ts === 'number')).toBe(true);
    expect(resolveReferenceDates(raw)).toEqual({
      deadline: '2026-09-30',
      targetDate: '2026-09-15',
    });
  });

  it('rejects malformed dates without writing', async () => {
    await expect(runCli(['deadline', '2026-13-01'])).rejects.toThrow(CliError);
    await expect(runCli(['deadline', '2026-09-30', '--target', 'soon'])).rejects.toThrow(CliError);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'dates.json'), 'utf8'),
    ) as ReferenceDateEntry[];
    expect(raw).toEqual([]);
  });

  it('target > deadline is recorded but warned (R-T6 config error — warn, not reject)', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    await runCli(['deadline', '2026-09-30', '--target', '2026-10-15']);
    const warned = stderr.mock.calls.map((c) => String(c[0])).join('');
    expect(warned).toContain('構成エラー');
    // the history is still appended — the system warns, the human decides
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'dates.json'), 'utf8'),
    ) as ReferenceDateEntry[];
    expect(raw).toHaveLength(2);
  });

  it('with no args prints the current resolution (read-only)', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await runCli(['deadline']);
    expect(stdout.mock.calls.map((c) => String(c[0])).join('')).toContain('(unset)');
  });
});
