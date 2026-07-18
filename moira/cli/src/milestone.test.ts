// Milestones (issue #35): name + node-id bundle second tier, append-only,
// reason-stamped, latest-ts-wins PER NAME. Mirrors dates.test.ts's structure
// (unit + store + CLI end-to-end) for the R-T6-isomorphic dates.json.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './commands.js';
import { CliError } from './errors.js';
import { MoiraRepo, resolveMilestones, type MilestoneEntry } from './store.js';

describe('resolveMilestones (latest-ts wins per name)', () => {
  it('empty history → no milestones', () => {
    expect(resolveMilestones([])).toEqual([]);
  });

  it('latest ts wins per name independently; ties go to the later entry', () => {
    const entries: MilestoneEntry[] = [
      { milestone: 'alpha', nodes: ['a', 'b'], reason: 'first', ts: 1 },
      { milestone: 'beta', nodes: ['c'], reason: 'first', ts: 1 },
      { milestone: 'alpha', nodes: ['a', 'b', 'd'], reason: 'scope grew', ts: 5 },
      { milestone: 'alpha', nodes: ['x'], reason: 'same-ts later entry', ts: 5 },
    ];
    expect(resolveMilestones(entries)).toEqual([
      { name: 'alpha', nodes: ['x'] },
      { name: 'beta', nodes: ['c'] },
    ]);
  });

  it('an empty-nodes redefinition dissolves the milestone (dropped, not surfaced as empty)', () => {
    const entries: MilestoneEntry[] = [
      { milestone: 'alpha', nodes: ['a'], reason: 'define', ts: 1 },
      { milestone: 'beta', nodes: ['b'], reason: 'define', ts: 1 },
      { milestone: 'alpha', nodes: [], reason: 'dissolved', ts: 2 },
    ];
    expect(resolveMilestones(entries)).toEqual([{ name: 'beta', nodes: ['b'] }]);
  });

  it('rows are sorted by milestone name', () => {
    const entries: MilestoneEntry[] = [
      { milestone: 'zeta', nodes: ['z'], reason: 'r', ts: 1 },
      { milestone: 'alpha', nodes: ['a'], reason: 'r', ts: 1 },
    ];
    expect(resolveMilestones(entries).map((m) => m.name)).toEqual(['alpha', 'zeta']);
  });
});

describe('MoiraRepo milestones.json (append-only second tier)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'moira-milestones-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('init creates milestones.json; appends preserve prior entries', () => {
    const repo = new MoiraRepo(tmp);
    repo.init({ projectRoot: 'p', me: 'me' });
    expect(repo.loadMilestoneEntries()).toEqual([]);
    repo.appendMilestoneEntries([{ milestone: 'm1', nodes: ['a'], reason: 'r1', ts: 1 }]);
    repo.appendMilestoneEntries([{ milestone: 'm1', nodes: ['a', 'b'], reason: 'r2', ts: 2 }]);
    const all = repo.loadMilestoneEntries();
    expect(all).toHaveLength(2); // history kept — append-only (R-U14-isomorphic)
    expect(all[0]!.nodes).toEqual(['a']);
    expect(resolveMilestones(all)).toEqual([{ name: 'm1', nodes: ['a', 'b'] }]);
  });
});

describe('moira milestone (CLI)', () => {
  const cwd0 = process.cwd();
  let tmp: string;
  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'moira-ms-'));
    process.chdir(tmp);
    await runCli(['init', '--me', 'me', '--root', 'p']);
    await runCli(['add', 'f1', '--parent', 'p', '--estimate', '2']);
    await runCli(['add', 'f2', '--parent', 'p', '--estimate', '3']);
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('with no args, an empty project prints the empty-state message', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'moira-ms-empty-'));
    process.chdir(fresh);
    await runCli(['init', '--me', 'me', '--root', 'p']);
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await runCli(['milestone']);
    expect(stdout.mock.calls.map((c) => String(c[0])).join('')).toContain('no milestones yet');
    process.chdir(tmp);
    rmSync(fresh, { recursive: true, force: true });
  });

  it('set defines a milestone, appends a reason-stamped history, and list shows it resolved', async () => {
    await runCli(['milestone', 'set', 'M1', '--nodes', 'f1,f2', '--reason', 'v1 スコープ']);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'milestones.json'), 'utf8'),
    ) as MilestoneEntry[];
    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({ milestone: 'M1', nodes: ['f1', 'f2'], reason: 'v1 スコープ' });
    expect(typeof raw[0]!.ts).toBe('number');

    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await runCli(['milestone']);
    const printed = stdout.mock.calls.map((c) => String(c[0])).join('');
    expect(printed).toContain('M1');
    expect(printed).toContain('f1');
    expect(printed).toContain('f2');
  });

  it('re-defining the same name appends a NEW entry and latest-wins resolves to it', async () => {
    await runCli(['milestone', 'set', 'M1', '--nodes', 'f1']);
    await runCli(['milestone', 'set', 'M1', '--nodes', 'f1,f2', '--reason', 'scope grew']);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'milestones.json'), 'utf8'),
    ) as MilestoneEntry[];
    expect(raw).toHaveLength(2); // both kept — append-only history
    const resolved = resolveMilestones(raw);
    expect(resolved).toEqual([{ name: 'M1', nodes: ['f1', 'f2'] }]);
  });

  it('warns (but still records) a node id absent from the event log', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    await runCli(['milestone', 'set', 'M1', '--nodes', 'f1,ghost']);
    const warned = stderr.mock.calls.map((c) => String(c[0])).join('');
    expect(warned).toContain('ghost');
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'milestones.json'), 'utf8'),
    ) as MilestoneEntry[];
    expect(raw[0]!.nodes).toEqual(['f1', 'ghost']); // recorded regardless — warn, human decides
  });

  it('remove dissolves the milestone (empty-nodes append) and it disappears from the list', async () => {
    await runCli(['milestone', 'set', 'M1', '--nodes', 'f1,f2']);
    await runCli(['milestone', 'remove', 'M1', '--reason', 'スコープ外に']);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'milestones.json'), 'utf8'),
    ) as MilestoneEntry[];
    expect(raw).toHaveLength(2);
    expect(raw[1]).toMatchObject({ milestone: 'M1', nodes: [], reason: 'スコープ外に' });
    expect(resolveMilestones(raw)).toEqual([]);

    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await runCli(['milestone']);
    expect(stdout.mock.calls.map((c) => String(c[0])).join('')).toContain('no milestones yet');
  });

  it('rejects set without --nodes or with an empty --nodes value', async () => {
    await expect(runCli(['milestone', 'set', 'M1'])).rejects.toThrow(CliError);
    await expect(runCli(['milestone', 'set', 'M1', '--nodes', ''])).rejects.toThrow(CliError);
    await expect(runCli(['milestone', 'set', 'M1', '--nodes', ' , ,'])).rejects.toThrow(CliError);
    const raw = JSON.parse(
      readFileSync(join(tmp, '.moira', 'milestones.json'), 'utf8'),
    ) as MilestoneEntry[];
    expect(raw).toEqual([]);
  });

  it('rejects remove without a name', async () => {
    await expect(runCli(['milestone', 'remove'])).rejects.toThrow(CliError);
  });

  it('rejects an unknown milestone subcommand', async () => {
    await expect(runCli(['milestone', 'bogus'])).rejects.toThrow(CliError);
  });
});
