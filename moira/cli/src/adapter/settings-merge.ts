// Non-destructive .claude/settings.json hooks merge — a PURE text→text function
// so the corruption-risk surface is exhaustively unit-testable.
//
// Safety contract:
//   - parse failure throws (the installer aborts BEFORE writing anything);
//   - every existing key / hook entry survives verbatim;
//   - our entries are deduped by EXACT command-string equality within the same
//     event (matcher-agnostic scan → a hand-copied playground entry under any
//     matcher shape is recognized and adopted, not duplicated);
//   - zero additions ⇒ the original text is returned byte-identical (no reformat).

export interface HookInjection {
  event: string; // 'PreToolUse' | 'PostToolUse' | 'SessionStart' | ...
  matcher: string;
  command: string;
}

export interface MergeResult {
  text: string;
  changed: boolean;
  added: HookInjection[];
  adopted: HookInjection[];
}

export class SettingsParseError extends Error {}

interface HookEntry {
  type?: string;
  command?: string;
  [k: string]: unknown;
}
interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
  [k: string]: unknown;
}
interface SettingsShape {
  $schema?: string;
  hooks?: Record<string, HookGroup[]>;
  [k: string]: unknown;
}

const SCHEMA_URL = 'https://json.schemastore.org/claude-code-settings.json';

function parseSettings(text: string): SettingsShape {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new SettingsParseError(
      `settings.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SettingsParseError('settings.json must be a JSON object');
  }
  return parsed as SettingsShape;
}

function hasCommand(groups: readonly HookGroup[], command: string): boolean {
  return groups.some((g) => Array.isArray(g.hooks) && g.hooks.some((h) => h.command === command));
}

export function mergeSettings(
  existingText: string | null,
  injections: readonly HookInjection[],
): MergeResult {
  const obj: SettingsShape = existingText === null ? { $schema: SCHEMA_URL } : parseSettings(existingText);
  const hooks: Record<string, HookGroup[]> = obj.hooks ?? {};
  const added: HookInjection[] = [];
  const adopted: HookInjection[] = [];

  for (const inj of injections) {
    const groups: HookGroup[] = hooks[inj.event] ?? [];
    if (hasCommand(groups, inj.command)) {
      adopted.push(inj);
      continue;
    }
    const entry: HookEntry = { type: 'command', command: inj.command };
    const sameMatcher = groups.find((g) => g.matcher === inj.matcher);
    if (sameMatcher !== undefined) {
      (sameMatcher.hooks ??= []).push(entry);
    } else {
      groups.push({ matcher: inj.matcher, hooks: [entry] });
    }
    hooks[inj.event] = groups;
    added.push(inj);
  }

  if (added.length === 0 && existingText !== null) {
    return { text: existingText, changed: false, added, adopted };
  }
  obj.hooks = hooks;
  return { text: `${JSON.stringify(obj, null, 2)}\n`, changed: true, added, adopted };
}

export interface RemoveResult {
  text: string;
  changed: boolean;
  removed: HookInjection[];
}

/** Surgically remove exactly our injected entries (by event + command string);
 * user entries and unknown keys survive verbatim. Empty groups/events are dropped. */
export function removeSettings(
  existingText: string,
  injections: readonly HookInjection[],
): RemoveResult {
  const obj = parseSettings(existingText);
  const hooks = obj.hooks;
  if (hooks === undefined) return { text: existingText, changed: false, removed: [] };
  const removed: HookInjection[] = [];

  for (const inj of injections) {
    const groups = hooks[inj.event];
    if (groups === undefined) continue;
    for (const g of groups) {
      if (!Array.isArray(g.hooks)) continue;
      const before = g.hooks.length;
      g.hooks = g.hooks.filter((h) => h.command !== inj.command);
      if (g.hooks.length < before) removed.push(inj);
    }
    const nonEmpty = groups.filter((g) => !Array.isArray(g.hooks) || g.hooks.length > 0);
    if (nonEmpty.length > 0) hooks[inj.event] = nonEmpty;
    else delete hooks[inj.event];
  }

  if (removed.length === 0) return { text: existingText, changed: false, removed };
  if (Object.keys(hooks).length === 0) delete obj.hooks;
  return { text: `${JSON.stringify(obj, null, 2)}\n`, changed: true, removed };
}
