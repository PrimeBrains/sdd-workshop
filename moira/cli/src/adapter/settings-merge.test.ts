import { describe, expect, it } from 'vitest';
import {
  mergeSettings,
  removeSettings,
  SettingsParseError,
  type HookInjection,
} from './settings-merge.js';

const GUARD = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/moira-guard.mjs"';
const FIRE = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/moira-fire.mjs"';

const INJECTIONS: HookInjection[] = [
  { event: 'PreToolUse', matcher: 'Bash', command: GUARD },
  { event: 'PostToolUse', matcher: 'Bash', command: GUARD },
  { event: 'PostToolUse', matcher: 'Edit|MultiEdit|Write|NotebookEdit', command: FIRE },
  { event: 'SessionStart', matcher: 'startup|resume|clear', command: FIRE },
];

describe('mergeSettings', () => {
  it('absent file → fresh settings with $schema and all entries', () => {
    const r = mergeSettings(null, INJECTIONS);
    expect(r.changed).toBe(true);
    expect(r.added).toHaveLength(4);
    const obj = JSON.parse(r.text);
    expect(obj.$schema).toContain('claude-code-settings');
    expect(obj.hooks.PreToolUse).toHaveLength(1);
    expect(obj.hooks.PostToolUse).toHaveLength(2); // Bash group + Edit… group
    expect(obj.hooks.SessionStart).toHaveLength(1);
  });

  it('existing user hooks and unknown top-level keys survive verbatim', () => {
    const existing = JSON.stringify({
      permissions: { allow: ['Bash(npm:*)'] },
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user-hook' }] }],
      },
    });
    const r = mergeSettings(existing, INJECTIONS);
    const obj = JSON.parse(r.text);
    expect(obj.permissions).toEqual({ allow: ['Bash(npm:*)'] });
    const pre = obj.hooks.PreToolUse;
    expect(pre).toHaveLength(1); // same matcher → appended into the user's group
    expect(pre[0].hooks.map((h: { command: string }) => h.command)).toEqual(['echo user-hook', GUARD]);
  });

  it('exact-duplicate commands are adopted (zero change, byte-identical text)', () => {
    const first = mergeSettings(null, INJECTIONS).text;
    const again = mergeSettings(first, INJECTIONS);
    expect(again.changed).toBe(false);
    expect(again.text).toBe(first);
    expect(again.adopted).toHaveLength(4);
    expect(again.added).toHaveLength(0);
  });

  it('recognizes a hand-copied entry even under a different matcher shape', () => {
    const handCopied = JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash|Task', hooks: [{ type: 'command', command: GUARD }] }] },
    });
    const r = mergeSettings(handCopied, [INJECTIONS[0]!]);
    expect(r.changed).toBe(false);
    expect(r.adopted).toHaveLength(1);
  });

  it('parse failure throws SettingsParseError (installer aborts before writing)', () => {
    expect(() => mergeSettings('{ // jsonc comment\n}', INJECTIONS)).toThrow(SettingsParseError);
    expect(() => mergeSettings('[]', INJECTIONS)).toThrow(SettingsParseError);
  });

  it('is idempotent: merge∘merge = merge', () => {
    const once = mergeSettings('{}', INJECTIONS).text;
    const twice = mergeSettings(once, INJECTIONS).text;
    expect(twice).toBe(once);
  });

  it('a matcher-less injection (UserPromptSubmit) creates a group WITHOUT a matcher key', () => {
    const ups: HookInjection = { event: 'UserPromptSubmit', command: FIRE };
    const r = mergeSettings(null, [ups]);
    const obj = JSON.parse(r.text);
    expect(obj.hooks.UserPromptSubmit).toEqual([{ hooks: [{ type: 'command', command: FIRE }] }]);
    expect(Object.keys(obj.hooks.UserPromptSubmit[0])).toEqual(['hooks']); // no "matcher" key at all
    // re-merge adopts (byte-identical), remove strips it back out
    const again = mergeSettings(r.text, [ups]);
    expect(again.changed).toBe(false);
    expect(again.adopted).toHaveLength(1);
    const removed = removeSettings(r.text, [ups]);
    expect(removed.removed).toHaveLength(1);
    expect(JSON.parse(removed.text).hooks).toBeUndefined();
  });
});

describe('removeSettings', () => {
  it('removes exactly our entries; user entries and groups survive', () => {
    const existing = JSON.stringify({
      permissions: { allow: [] },
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user-hook' }] },
        ],
      },
    });
    const merged = mergeSettings(existing, INJECTIONS).text;
    const r = removeSettings(merged, INJECTIONS);
    expect(r.removed).toHaveLength(4);
    const obj = JSON.parse(r.text);
    expect(obj.permissions).toEqual({ allow: [] });
    expect(obj.hooks.PreToolUse).toHaveLength(1);
    expect(obj.hooks.PreToolUse[0].hooks).toEqual([{ type: 'command', command: 'echo user-hook' }]);
    expect(obj.hooks.PostToolUse).toBeUndefined(); // ours only → dropped entirely
    expect(obj.hooks.SessionStart).toBeUndefined();
  });

  it('fresh-install then remove → hooks key disappears, text otherwise minimal', () => {
    const merged = mergeSettings(null, INJECTIONS).text;
    const r = removeSettings(merged, INJECTIONS);
    const obj = JSON.parse(r.text);
    expect(obj.hooks).toBeUndefined();
    expect(obj.$schema).toContain('claude-code-settings');
  });

  it('nothing of ours present → unchanged text', () => {
    const text = JSON.stringify({ hooks: {} });
    const r = removeSettings(text, INJECTIONS);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(text);
  });
});
