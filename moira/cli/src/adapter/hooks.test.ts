import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The template hooks are the runtime artifacts installed into target repos —
// test THEM (not a copy) via their exported decide(). Resolved relative to this
// file: src/adapter/ → ../../templates.
interface HookOutput {
  hookSpecificOutput?: {
    hookEventName?: string;
    permissionDecision?: string;
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
}
interface GuardModule {
  decide(input: unknown): HookOutput | undefined;
}
interface FireModule {
  decide(input: unknown, deps?: { runDrift(dir: string): unknown }): HookOutput | undefined;
  EMBEDDED_DEFAULT: unknown;
}

const guard = (await import(
  new URL('../../templates/claude/hooks/moira-guard.mjs', import.meta.url).href
)) as GuardModule;
const fire = (await import(
  new URL('../../templates/claude/hooks/moira-fire.mjs', import.meta.url).href
)) as FireModule;

const bash = (event: string, command: string) => ({
  hook_event_name: event,
  tool_name: 'Bash',
  tool_input: { command },
});

let tmp: string;
let savedProjectDir: string | undefined;
let savedMoiraDir: string | undefined;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-hooks-'));
  savedProjectDir = process.env.CLAUDE_PROJECT_DIR;
  savedMoiraDir = process.env.MOIRA_DIR;
  delete process.env.MOIRA_DIR;
});
afterEach(() => {
  if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
  if (savedMoiraDir === undefined) delete process.env.MOIRA_DIR;
  else process.env.MOIRA_DIR = savedMoiraDir;
  rmSync(tmp, { recursive: true, force: true });
});

/** A log home at <tmp>/<name> with config.json naming `root`. */
function seedHome(name: string, root: string): string {
  const home = join(tmp, name);
  mkdirSync(join(home, '.moira'), { recursive: true });
  writeFileSync(join(home, '.moira', 'config.json'), JSON.stringify({ projectRoot: root, me: 'me' }));
  return home;
}

describe('moira-guard decide()', () => {
  it('denies `moira add` without --parent (plain / compound / quoted / env-prefixed)', () => {
    for (const cmd of [
      'moira add x',
      'echo hi && moira add x --label "y"',
      'bash -c "moira add x"',
      'env X=1 moira add x',
      'npx moira add x',
    ]) {
      const d = guard.decide(bash('PreToolUse', cmd));
      expect(d?.hookSpecificOutput?.permissionDecision, cmd).toBe('deny');
      expect(d?.hookSpecificOutput?.permissionDecisionReason).toContain('--parent');
    }
  });

  it('lets a --parent add and a standard relate through, and stays silent off the moira surface', () => {
    expect(guard.decide(bash('PreToolUse', 'moira add x --parent f'))).toBeUndefined();
    // standard dependency edges (issue #7) are never denied — the only deny is a --parent-less add
    expect(
      guard.decide(bash('PreToolUse', 'moira relate f/req f/design --kind dependency --policy accepted')),
    ).toBeUndefined();
    expect(guard.decide(bash('PreToolUse', 'npm test'))).toBeUndefined();
    expect(guard.decide({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: {} })).toBeUndefined();
  });

  it('names the configured project root in the deny message (fallback otherwise)', () => {
    mkdirSync(join(tmp, '.moira'), { recursive: true });
    writeFileSync(join(tmp, '.moira', 'config.json'), JSON.stringify({ projectRoot: 'my-root', me: 'me' }));
    process.env.CLAUDE_PROJECT_DIR = tmp;
    const withCfg = guard.decide(bash('PreToolUse', 'moira add x'));
    expect(withCfg?.hookSpecificOutput?.permissionDecisionReason).toContain('my-root');

    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'nowhere');
    const withoutCfg = guard.decide(bash('PreToolUse', 'moira add x'));
    expect(withoutCfg?.hookSpecificOutput?.permissionDecisionReason).toContain('プロジェクト根');
  });

  it('resolves the home through a .moira pointer file and MOIRA_DIR (multi-repo, ADR-0003)', () => {
    const home = seedHome('home', 'ptr-root');
    const work = join(tmp, 'work');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.moira'), 'home: ../home\n'); // pointer FILE, relative
    process.env.CLAUDE_PROJECT_DIR = work;
    const viaPointer = guard.decide(bash('PreToolUse', 'moira add x'));
    expect(viaPointer?.hookSpecificOutput?.permissionDecisionReason).toContain('ptr-root');

    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'elsewhere');
    process.env.MOIRA_DIR = home;
    const viaEnv = guard.decide(bash('PreToolUse', 'moira add x'));
    expect(viaEnv?.hookSpecificOutput?.permissionDecisionReason).toContain('ptr-root');
  });

  it('advises the start gate / assign landmine (Pre) and AC + ui restart (Post)', () => {
    const start = guard.decide(bash('PreToolUse', 'moira start f/req'));
    expect(start?.hookSpecificOutput?.additionalContext).toContain('着手ゲート');
    const assign = guard.decide(bash('PreToolUse', 'moira assign f/req --to me'));
    expect(assign?.hookSpecificOutput?.additionalContext).toContain('ready');
    const done = guard.decide(bash('PostToolUse', 'moira done f/req'));
    expect(done?.hookSpecificOutput?.additionalContext).toContain('moira cost');
    expect(done?.hookSpecificOutput?.additionalContext).toContain('moira ui');
  });
});

describe('moira-fire decide() — PostToolUse spec/tasks detection', () => {
  const writeSpec = (feature: string, over: Record<string, unknown> = {}): string => {
    const dir = join(tmp, '.kiro', 'specs', feature);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'spec.json');
    writeFileSync(p, JSON.stringify({ feature_name: feature, phase: 'initialized', approvals: {}, ...over }));
    return p;
  };
  const edit = (file_path: string, tool = 'Write') => ({
    hook_event_name: 'PostToolUse',
    tool_name: tool,
    tool_input: { file_path },
  });

  it('spec.json write → advises the phase implied by its content', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{}, 'discovery'],
      [{ phase: 'requirements-generated' }, '/moira-track requirements --feature demo'],
      [{ approvals: { design: { generated: true } } }, '/moira-track design --feature demo'],
      [{ phase: 'tasks-generated' }, '/moira-track tasks --feature demo'],
      [{ approvals: { tasks: { approved: true } } }, 'estimate-impl'],
      [{ ready_for_implementation: true }, 'estimate-impl'],
    ];
    for (const [over, expected] of cases) {
      const p = writeSpec('demo', over);
      const d = fire.decide(edit(p));
      expect(d?.hookSpecificOutput?.additionalContext, JSON.stringify(over)).toContain(expected);
      expect(d?.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
    }
  });

  it.runIf(process.platform === 'win32')('matches Windows backslash paths too', () => {
    const p = writeSpec('demo');
    const d = fire.decide(edit(p.replace(/\//g, '\\')));
    expect(d?.hookSpecificOutput?.additionalContext).toContain('demo');
  });

  it('tasks.md write → checkbox progress + /moira-track impl advice', () => {
    const dir = join(tmp, '.kiro', 'specs', 'demo');
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'tasks.md');
    writeFileSync(p, '- [x] 1. a\n- [ ] 2. b\n- [x] 3. c\n');
    const d = fire.decide(edit(p, 'Edit'));
    expect(d?.hookSpecificOutput?.additionalContext).toContain('2/3');
    expect(d?.hookSpecificOutput?.additionalContext).toContain('/moira-track impl --feature demo');
  });

  it('stays silent on non-kiro paths, non-write tools, broken JSON, checkbox-less tasks.md', () => {
    expect(fire.decide(edit(join(tmp, 'src', 'index.ts')))).toBeUndefined();
    const p = writeSpec('demo');
    expect(fire.decide(edit(p, 'Bash'))).toBeUndefined();
    writeFileSync(p, '{ broken');
    expect(fire.decide(edit(p))).toBeUndefined();
    const t = join(tmp, '.kiro', 'specs', 'demo', 'tasks.md');
    writeFileSync(t, 'no checkboxes here\n');
    expect(fire.decide(edit(t))).toBeUndefined();
  });
});

describe('moira-fire — declarative provider config (ADR-0003 Stage 2)', () => {
  it('EMBEDDED_DEFAULT stays in LOCKSTEP with templates/claude/moira-provider.json', () => {
    const template = JSON.parse(
      readFileSync(new URL('../../templates/claude/moira-provider.json', import.meta.url), 'utf8'),
    ) as unknown;
    expect(fire.EMBEDDED_DEFAULT).toEqual(template);
  });

  it('a custom .claude/moira-provider.json drives non-cc-sdd triggers', () => {
    const cfg = {
      schemaVersion: 1,
      id: 'docs-flow',
      detect: ['docs'],
      phases: ['design'],
      triggers: [
        {
          pathPattern: '(?:^|/)docs/(?<feature>[^/]+)/design\\.md$',
          read: 'none',
          advise: [
            { when: 'always', phase: 'design', message: '{file} を検知。/moira-track design --feature {feature}' },
          ],
        },
      ],
      drift: { mode: 'unsupported' },
    };
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude', 'moira-provider.json'), JSON.stringify(cfg));
    mkdirSync(join(tmp, 'docs', 'alpha'), { recursive: true });
    const artifact = join(tmp, 'docs', 'alpha', 'design.md');
    writeFileSync(artifact, '# design');
    process.env.CLAUDE_PROJECT_DIR = tmp;

    const d = fire.decide({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: artifact },
    });
    expect(d?.hookSpecificOutput?.additionalContext).toContain('/moira-track design --feature alpha');
    expect(d?.hookSpecificOutput?.additionalContext).toContain('docs/alpha/design.md を検知');

    // with the custom config, cc-sdd paths no longer trigger (vocabulary swapped)
    const specDir = join(tmp, '.kiro', 'specs', 'demo');
    mkdirSync(specDir, { recursive: true });
    const spec = join(specDir, 'spec.json');
    writeFileSync(spec, JSON.stringify({ phase: 'initialized', approvals: {} }));
    expect(
      fire.decide({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: spec } }),
    ).toBeUndefined();
  });

  it('a broken config file fails open to the embedded cc-sdd default', () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude', 'moira-provider.json'), '{ broken');
    const specDir = join(tmp, '.kiro', 'specs', 'demo');
    mkdirSync(specDir, { recursive: true });
    const spec = join(specDir, 'spec.json');
    writeFileSync(spec, JSON.stringify({ phase: 'initialized', approvals: {} }));
    process.env.CLAUDE_PROJECT_DIR = tmp;
    const d = fire.decide({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: spec },
    });
    expect(d?.hookSpecificOutput?.additionalContext).toContain('discovery');
  });
});

describe('moira-fire decide() — UserPromptSubmit ticket detection (ADR-0004)', () => {
  const prompt = (p: unknown) => ({ hook_event_name: 'UserPromptSubmit', prompt: p });
  const ctxOf = (p: unknown) => fire.decide(prompt(p))?.hookSpecificOutput;

  it('fires on full issue URLs of all four ticket systems (no keyword needed)', () => {
    const cases: Array<[string, string]> = [
      [
        'https://github.com/PrimeBrains/sdd-workshop/issues/20 に対応して',
        'https://github.com/PrimeBrains/sdd-workshop/issues/20',
      ],
      ['https://gitlab.example.co.jp/team/app/-/issues/7 やって', 'https://gitlab.example.co.jp/team/app/-/issues/7'],
      ['https://acme.atlassian.net/browse/PROJ-123 を見て', 'https://acme.atlassian.net/browse/PROJ-123'],
      ['https://acme.backlog.com/view/APP-42 の対応お願い', 'https://acme.backlog.com/view/APP-42'],
    ];
    for (const [p, ref] of cases) {
      const out = ctxOf(p);
      expect(out?.hookEventName, p).toBe('UserPromptSubmit');
      expect(out?.additionalContext, p).toContain('/moira-track ticket');
      expect(out?.additionalContext, p).toContain(ref);
    }
  });

  it('fires on bare refs (#N / KEY-N) only alongside an intent keyword', () => {
    expect(ctxOf('issue #20 に対応して')?.additionalContext).toContain('#20');
    expect(ctxOf('バグ PROJ-123 を直して')?.additionalContext).toContain('PROJ-123');
    // no keyword → silent (bare #N collides with PR refs / hex colors etc.)
    expect(fire.decide(prompt('#20 を見て'))).toBeUndefined();
    expect(fire.decide(prompt('PROJ-123 やって'))).toBeUndefined();
  });

  it('does not fire on lookalike tokens, PR URLs, or markdown headings', () => {
    expect(fire.decide(prompt('チケットの文字コードは UTF-8 で保存して'))).toBeUndefined();
    expect(fire.decide(prompt('issue の日付は ISO-8601、ハッシュは SHA-256 で'))).toBeUndefined();
    expect(fire.decide(prompt('https://github.com/o/r/pull/20 をレビューして'))).toBeUndefined();
    // markdown heading hashes are not #N refs, even with a keyword present
    expect(fire.decide(prompt('チケット一覧を整理して\n## 20 件の概要\n本文'))).toBeUndefined();
  });

  it('fails open on missing/non-string prompt and stays silent while /moira-track is firing', () => {
    expect(fire.decide({ hook_event_name: 'UserPromptSubmit' })).toBeUndefined();
    expect(fire.decide(prompt(42))).toBeUndefined();
    expect(fire.decide(prompt(''))).toBeUndefined();
    expect(fire.decide(prompt('/moira-track ticket https://github.com/o/r/issues/1'))).toBeUndefined();
  });

  it('dedupes repeated refs and shows at most 3', () => {
    const many =
      'https://github.com/o/r/issues/1 https://github.com/o/r/issues/1 ' +
      'https://github.com/o/r/issues/2 https://github.com/o/r/issues/3 https://github.com/o/r/issues/4';
    const ctx = ctxOf(many)?.additionalContext ?? '';
    expect(ctx.split('github.com').length - 1).toBe(3); // deduped, then capped at 3
    expect(ctx).toContain('issues/1');
    expect(ctx).not.toContain('issues/4');
  });
});

describe('moira-fire decide() — SessionStart drift summary', () => {
  const seedRepo = (): void => {
    mkdirSync(join(tmp, '.moira'), { recursive: true });
    writeFileSync(join(tmp, '.moira', 'config.json'), JSON.stringify({ projectRoot: 'r', me: 'me' }));
    mkdirSync(join(tmp, '.kiro', 'specs'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = tmp;
  };
  const session = { hook_event_name: 'SessionStart', source: 'startup' };

  it('injects a summary when hard/needs-human drift exists', () => {
    seedRepo();
    const d = fire.decide(session, {
      runDrift: () => ({
        summary: { hard: 2, needsHuman: 1, advisory: 0, ok: 5 },
        features: [
          { nodes: [{ status: 'missing-node', node: 'f/req' }, { status: 'ok', node: 'f' }] },
        ],
      }),
    });
    const ctx = d?.hookSpecificOutput?.additionalContext;
    expect(ctx).toContain('hard 2');
    expect(ctx).toContain('/moira-track sync');
    expect(ctx).toContain('missing-node: f/req');
  });

  it('stays silent when clean, when drift fails, and when the repo lacks .moira/.kiro', () => {
    seedRepo();
    expect(
      fire.decide(session, { runDrift: () => ({ summary: { hard: 0, needsHuman: 0 }, features: [] }) }),
    ).toBeUndefined();
    expect(fire.decide(session, { runDrift: () => undefined })).toBeUndefined();
    process.env.CLAUDE_PROJECT_DIR = join(tmp, 'empty');
    expect(fire.decide(session, { runDrift: () => ({ summary: { hard: 9 } }) })).toBeUndefined();
  });

  it('preconditions hold when the log home is reached via a .moira pointer file (multi-repo)', () => {
    seedHome('home', 'r');
    const work = join(tmp, 'work');
    mkdirSync(join(work, '.kiro', 'specs'), { recursive: true }); // .kiro lives in the WORK repo
    writeFileSync(join(work, '.moira'), 'home: ../home\n'); // the log lives in the shared home
    process.env.CLAUDE_PROJECT_DIR = work;
    const d = fire.decide(session, {
      runDrift: () => ({ summary: { hard: 1, needsHuman: 0, advisory: 0 }, features: [] }),
    });
    expect(d?.hookSpecificOutput?.additionalContext).toContain('hard 1');
  });
});
