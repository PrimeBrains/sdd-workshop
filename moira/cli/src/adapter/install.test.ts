import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliError } from '../errors.js';
import { cmdInstall, cmdStatus, cmdUninstall, HOOK_INJECTIONS, MANAGED_FILES } from './install.js';
import { contentHash, loadManifest } from './manifest.js';
import { templatesDir } from './paths.js';

let tmp: string;
let stdout: string[];

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-install-'));
  mkdirSync(join(tmp, '.kiro', 'specs'), { recursive: true }); // look like a cc-sdd repo
  stdout = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
    stdout.push(String(s));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

const install = (...extra: string[]): void => cmdInstall(['--dir', tmp, ...extra]);
const read = (rel: string): string => readFileSync(join(tmp, ...rel.split('/')), 'utf8');
const template = (src: string): string => readFileSync(join(templatesDir(), ...src.split('/')), 'utf8');

describe('cmdInstall', () => {
  it('fresh install writes all managed files, merges settings, stamps the manifest', () => {
    install();
    for (const f of MANAGED_FILES) expect(read(f.dest)).toBe(template(f.src));
    const settings = JSON.parse(read('.claude/settings.json'));
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse).toHaveLength(2);
    expect(settings.hooks.SessionStart).toHaveLength(1);
    const manifest = loadManifest(tmp)!;
    expect(Object.keys(manifest.files)).toHaveLength(MANAGED_FILES.length);
    expect(manifest.settingsInjected).toEqual(HOOK_INJECTIONS);
    expect(manifest.claudeMdBlock).toBe(false);
    for (const [rel, hash] of Object.entries(manifest.files)) expect(contentHash(read(rel))).toBe(hash);
  });

  it('is idempotent: a second install changes nothing', () => {
    install();
    const before = new Map(MANAGED_FILES.map((f) => [f.dest, read(f.dest)]));
    const settingsBefore = read('.claude/settings.json');
    install();
    for (const f of MANAGED_FILES) expect(read(f.dest)).toBe(before.get(f.dest));
    expect(read('.claude/settings.json')).toBe(settingsBefore);
  });

  it('keeps a user-modified managed file (skip) unless --force, which backs it up first', () => {
    install();
    const dest = '.claude/skills/moira-track/SKILL.md';
    writeFileSync(join(tmp, ...dest.split('/')), 'USER EDIT\n', 'utf8');
    install();
    expect(read(dest)).toBe('USER EDIT\n'); // skipped
    install('--force');
    expect(read(dest)).toBe(template('claude/skills/moira-track/SKILL.md'));
    expect(read(`${dest}.moira-adapter.bak`)).toBe('USER EDIT\n');
  });

  it('adopts a hand-copied layout: files backed up + replaced, settings deduped', () => {
    // simulate the playground: old hook file + settings with our exact commands, no manifest
    mkdirSync(join(tmp, '.claude', 'hooks'), { recursive: true });
    writeFileSync(join(tmp, '.claude', 'hooks', 'moira-guard.mjs'), '// old hand-copied guard\n');
    const guardCmd = HOOK_INJECTIONS[0]!.command;
    writeFileSync(
      join(tmp, '.claude', 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: guardCmd }] }],
            PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: guardCmd }] }],
          },
        },
        null,
        2,
      ),
    );
    install();
    expect(read('.claude/hooks/moira-guard.mjs')).toBe(template('claude/hooks/moira-guard.mjs'));
    expect(read('.claude/hooks/moira-guard.mjs.moira-adapter.bak')).toBe('// old hand-copied guard\n');
    const settingsText = read('.claude/settings.json');
    // guard command appears exactly twice (PreToolUse + PostToolUse) — no duplicates added
    expect(settingsText.split('moira-guard.mjs').length - 1).toBe(2);
    expect(settingsText.split('moira-fire.mjs').length - 1).toBe(2);
  });

  it('aborts whole install when settings.json is unparseable — nothing written', () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude', 'settings.json'), '{ broken');
    expect(() => install()).toThrow(CliError);
    expect(existsSync(join(tmp, '.claude', 'skills'))).toBe(false);
    expect(loadManifest(tmp)).toBeNull();
  });

  it('installs the bundled cc-sdd provider config by default (Stage 2)', () => {
    install();
    expect(JSON.parse(read('.claude/moira-provider.json')).id).toBe('cc-sdd');
    stdout.length = 0;
    cmdStatus(['--dir', tmp, '--json']);
    expect(JSON.parse(stdout.join('')).provider).toBe('cc-sdd');
  });

  it('--provider installs a validated custom config; schema-invalid aborts before any write', () => {
    const cfg = {
      schemaVersion: 1,
      id: 'docs-flow',
      detect: ['docs'],
      phases: ['design'],
      triggers: [
        {
          pathPattern: '(?:^|/)docs/(?<feature>[^/]+)/design\\.md$',
          read: 'none',
          advise: [{ when: 'always', phase: 'design', message: '{feature}' }],
        },
      ],
      drift: { mode: 'unsupported' },
    };
    const cfgPath = join(tmp, 'my-provider.json');
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    install('--provider', cfgPath);
    expect(JSON.parse(read('.claude/moira-provider.json')).id).toBe('docs-flow');
    stdout.length = 0;
    cmdStatus(['--dir', tmp, '--json']);
    expect(JSON.parse(stdout.join('')).provider).toBe('docs-flow');

    // custom provider swaps the provider-reference + steering for renders
    const ref = read('.claude/skills/moira-track/provider-reference.md');
    expect(ref).toContain('docs-flow');
    expect(ref).not.toContain('.kiro/specs'); // no cc-sdd prose leaks in
    expect(read('.kiro/steering/moira-track.md')).toContain('/moira-track design');
    // engine-generic docs stay the bundled canon
    expect(read('.claude/skills/moira-track/SKILL.md')).toBe(template('claude/skills/moira-track/SKILL.md'));

    // invalid config → whole install aborts before writing anything
    const fresh = join(tmp, 'fresh');
    mkdirSync(fresh, { recursive: true });
    const bad = join(tmp, 'bad.json');
    writeFileSync(bad, JSON.stringify({ schemaVersion: 2 }));
    expect(() => cmdInstall(['--dir', fresh, '--provider', bad])).toThrow(/スキーマ不正/);
    expect(existsSync(join(fresh, '.claude'))).toBe(false);
  });

  it('--home writes a .moira pointer file (idempotent; never clobbers an existing .moira)', () => {
    install('--home', '../shared-home');
    expect(read('.moira')).toBe('home: ../shared-home\n');
    install('--home', '../shared-home'); // same → no-op
    expect(read('.moira')).toBe('home: ../shared-home\n');
    install('--home', '../other'); // different → keep, warn
    expect(read('.moira')).toBe('home: ../shared-home\n');

    // an existing .moira DIRECTORY is never replaced by a pointer
    const dirRepo = join(tmp, 'dir-repo');
    mkdirSync(join(dirRepo, '.moira'), { recursive: true });
    mkdirSync(join(dirRepo, '.kiro', 'specs'), { recursive: true });
    cmdInstall(['--dir', dirRepo, '--home', '../x']);
    expect(statSync(join(dirRepo, '.moira')).isDirectory()).toBe(true);
  });

  it('--claude-md appends a marker block idempotently and uninstall removes it', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '# My project\n');
    install('--claude-md');
    install('--claude-md'); // idempotent
    const text = read('CLAUDE.md');
    expect(text.split('moira-adapter:begin').length - 1).toBe(1);
    expect(loadManifest(tmp)!.claudeMdBlock).toBe(true);
    cmdUninstall(['--dir', tmp]);
    expect(read('CLAUDE.md')).not.toContain('moira-adapter:begin');
    expect(read('CLAUDE.md')).toContain('# My project');
  });
});

describe('cmdStatus', () => {
  it('reports not-installed, then intact/modified/missing per file', () => {
    cmdStatus(['--dir', tmp, '--json']);
    expect(JSON.parse(stdout.join(''))).toMatchObject({ installed: false });

    stdout.length = 0;
    install();
    writeFileSync(join(tmp, '.claude', 'hooks', 'moira-fire.mjs'), '// modified\n');
    rmSync(join(tmp, '.kiro', 'steering', 'moira-track.md'));
    stdout.length = 0;
    cmdStatus(['--dir', tmp, '--json']);
    const st = JSON.parse(stdout.join(''));
    expect(st).toMatchObject({ installed: true, upToDate: true });
    expect(st.files['.claude/skills/moira-track/SKILL.md']).toBe('intact');
    expect(st.files['.claude/hooks/moira-fire.mjs']).toBe('modified');
    expect(st.files['.kiro/steering/moira-track.md']).toBe('missing');
    expect(Object.values(st.settings)).toEqual([true, true, true, true]);
    expect(st.environment).toEqual({ kiroDetected: true, moiraInitialized: false });
  });
});

describe('cmdUninstall', () => {
  it('removes intact files + our settings entries; keeps user edits and user hooks', () => {
    // user already had a hook before install
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(
      join(tmp, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] },
      }),
    );
    install();
    const modified = '.claude/skills/moira-track/reference.md';
    writeFileSync(join(tmp, ...modified.split('/')), 'KEEP ME\n');

    cmdUninstall(['--dir', tmp]);

    expect(existsSync(join(tmp, '.claude', 'skills', 'moira-track', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(tmp, '.claude', 'hooks', 'moira-guard.mjs'))).toBe(false);
    expect(read(modified)).toBe('KEEP ME\n'); // user-modified → kept
    const settings = JSON.parse(read('.claude/settings.json'));
    expect(settings.hooks.PreToolUse[0].hooks).toEqual([{ type: 'command', command: 'echo mine' }]);
    expect(settings.hooks.PostToolUse).toBeUndefined();
    expect(loadManifest(tmp)).toBeNull();
  });

  it('refuses when no manifest exists', () => {
    expect(() => cmdUninstall(['--dir', tmp])).toThrow(CliError);
  });
});
