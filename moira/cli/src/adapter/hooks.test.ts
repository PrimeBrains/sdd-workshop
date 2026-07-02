import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-hooks-'));
  savedProjectDir = process.env.CLAUDE_PROJECT_DIR;
});
afterEach(() => {
  if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
  rmSync(tmp, { recursive: true, force: true });
});

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

  it('lets a --parent add through, and stays silent off the moira surface', () => {
    expect(guard.decide(bash('PreToolUse', 'moira add x --parent f'))).toBeUndefined();
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
});
