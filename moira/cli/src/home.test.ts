// resolveMoiraHome — multi-repo log-home resolution (issue #14 Stage 1 / ADR-0003).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './commands.js';
import { CliError } from './errors.js';
import { resolveMoiraHome } from './home.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-home-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Create a real log home at <base>/<name>: .moira/config.json present. */
function makeHome(...parts: string[]): string {
  const root = join(tmp, ...parts);
  mkdirSync(join(root, '.moira'), { recursive: true });
  writeFileSync(join(root, '.moira', 'config.json'), JSON.stringify({ projectRoot: 'p', me: 'me' }));
  return root;
}

/** Create a pointer file <base>/.moira containing `home: <target>`. */
function makePointer(baseParts: string[], target: string): string {
  const base = join(tmp, ...baseParts);
  mkdirSync(base, { recursive: true });
  writeFileSync(join(base, '.moira'), `home: ${target}\n`);
  return base;
}

describe('resolveMoiraHome', () => {
  it('flag beats env (git --git-dir > GIT_DIR convention)', () => {
    const flagged = makeHome('flagged');
    const fromEnv = makeHome('from-env');
    const r = resolveMoiraHome({ flagDir: flagged, env: { MOIRA_DIR: fromEnv }, startDir: tmp });
    expect(r).toEqual({ root: resolve(flagged), source: 'flag' });
  });

  it('env alone wins over the local walk', () => {
    const fromEnv = makeHome('from-env');
    const local = makeHome('work');
    const r = resolveMoiraHome({ env: { MOIRA_DIR: fromEnv }, startDir: local });
    expect(r).toEqual({ root: resolve(fromEnv), source: 'env' });
  });

  it('cwd with its own .moira resolves to itself (pre-Stage-1 behavior preserved)', () => {
    const local = makeHome('work');
    const r = resolveMoiraHome({ env: {}, startDir: local });
    expect(r).toEqual({ root: resolve(local), source: 'cwd' });
  });

  it('walks up from a nested directory to the ancestor home', () => {
    const home = makeHome('repo');
    const nested = join(home, 'src', 'deep');
    mkdirSync(nested, { recursive: true });
    const r = resolveMoiraHome({ env: {}, startDir: nested });
    expect(r).toEqual({ root: resolve(home), source: 'walk-up' });
  });

  it('follows a relative pointer file (relative to the pointer directory)', () => {
    makeHome('shared-home');
    const work = makePointer(['work-repo'], '../shared-home');
    const r = resolveMoiraHome({ env: {}, startDir: work });
    expect(r).toEqual({ root: resolve(join(tmp, 'shared-home')), source: 'pointer' });
  });

  it('follows an absolute pointer file', () => {
    const home = makeHome('abs-home');
    const work = makePointer(['work-repo'], home);
    const r = resolveMoiraHome({ env: {}, startDir: work });
    expect(r).toEqual({ root: resolve(home), source: 'pointer' });
  });

  it('a pointer given via flag/env is followed one hop too', () => {
    const home = makeHome('shared-home2');
    const work = makePointer(['work-repo2'], home);
    expect(resolveMoiraHome({ flagDir: work, env: {}, startDir: tmp }).root).toBe(resolve(home));
    expect(resolveMoiraHome({ env: { MOIRA_DIR: work }, startDir: tmp }).root).toBe(resolve(home));
  });

  it('broken pointers are loud errors: missing home / malformed / double pointer', () => {
    const noWhere = makePointer(['broken1'], './does-not-exist');
    expect(() => resolveMoiraHome({ env: {}, startDir: noWhere })).toThrow(CliError);

    const malformed = join(tmp, 'broken2');
    mkdirSync(malformed, { recursive: true });
    writeFileSync(join(malformed, '.moira'), 'not a pointer\n');
    expect(() => resolveMoiraHome({ env: {}, startDir: malformed })).toThrow(/形式が不正/);

    const hop2 = makeHome('real-home');
    makePointer(['mid'], hop2); // mid → real-home (a valid pointer)
    const outer = makePointer(['outer'], join(tmp, 'mid')); // outer → mid (pointer) = 2 hops
    expect(() => resolveMoiraHome({ env: {}, startDir: outer })).toThrow(/1 ホップ/);
  });

  it('nothing found → startDir with source cwd (caller decides the error)', () => {
    const bare = join(tmp, 'bare');
    mkdirSync(bare, { recursive: true });
    // NOTE: this walk can only terminate "not found" because tmpdir ancestors
    // have no .moira — acceptable for a unit test environment.
    const r = resolveMoiraHome({ env: {}, startDir: bare });
    expect(r.source).toBe('cwd');
    expect(r.root).toBe(resolve(bare));
  });

  it('a .moira directory WITHOUT config.json is not a home (walk continues upward)', () => {
    const home = makeHome('outer-home');
    const inner = join(home, 'inner');
    mkdirSync(join(inner, '.moira'), { recursive: true }); // dir, but no config.json
    const r = resolveMoiraHome({ env: {}, startDir: inner });
    expect(r).toEqual({ root: resolve(home), source: 'walk-up' });
  });
});

describe('runCli global --dir / MOIRA_DIR / pointer integration', () => {
  const cwd0 = process.cwd();
  let savedMoiraDir: string | undefined;
  beforeEach(() => {
    savedMoiraDir = process.env.MOIRA_DIR;
    delete process.env.MOIRA_DIR;
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });
  afterEach(() => {
    process.chdir(cwd0);
    if (savedMoiraDir === undefined) delete process.env.MOIRA_DIR;
    else process.env.MOIRA_DIR = savedMoiraDir;
    vi.restoreAllMocks();
  });

  it('`moira --dir <home> init` + write commands target the home from anywhere', async () => {
    const home = join(tmp, 'home');
    mkdirSync(home, { recursive: true });
    const elsewhere = join(tmp, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    process.chdir(elsewhere);

    await runCli(['--dir', home, 'init', '--me', 'me', '--root', 'p']);
    expect(existsSync(join(home, '.moira', 'config.json'))).toBe(true);
    expect(existsSync(join(elsewhere, '.moira'))).toBe(false);

    await runCli([`--dir=${home}`, 'deadline', '2026-09-30']);
    const raw = JSON.parse(readFileSync(join(home, '.moira', 'dates.json'), 'utf8')) as unknown[];
    expect(raw).toHaveLength(1);
  });

  it('a work repo with a .moira pointer file writes into the shared home', async () => {
    const home = join(tmp, 'home2');
    mkdirSync(home, { recursive: true });
    process.chdir(home);
    await runCli(['init', '--me', 'me', '--root', 'p']);

    const work = join(tmp, 'work2');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.moira'), 'home: ../home2\n');
    process.chdir(work);
    await runCli(['deadline', '2026-09-30']);
    const raw = JSON.parse(readFileSync(join(home, '.moira', 'dates.json'), 'utf8')) as unknown[];
    expect(raw).toHaveLength(1); // landed in the HOME, not the work repo
  });

  it('MOIRA_DIR routes commands to the home; `moira init` on a pointer file is a loud error', async () => {
    const home = join(tmp, 'home3');
    mkdirSync(home, { recursive: true });
    process.env.MOIRA_DIR = home;
    const elsewhere = join(tmp, 'elsewhere3');
    mkdirSync(elsewhere, { recursive: true });
    process.chdir(elsewhere);
    await runCli(['init', '--me', 'me', '--root', 'p']); // targets MOIRA_DIR, not cwd
    expect(existsSync(join(home, '.moira', 'config.json'))).toBe(true);
    expect(existsSync(join(elsewhere, '.moira'))).toBe(false);
    delete process.env.MOIRA_DIR;

    const work = join(tmp, 'work3');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.moira'), `home: ${home}\n`);
    process.chdir(work);
    await expect(runCli(['init', '--me', 'me'])).rejects.toThrow(/ポインタ/);
  });

  it('--dir without a value is a usage error', async () => {
    await expect(runCli(['--dir'])).rejects.toThrow(/--dir requires a path/);
    await expect(runCli(['--dir='])).rejects.toThrow(/--dir requires a path/);
  });
});
