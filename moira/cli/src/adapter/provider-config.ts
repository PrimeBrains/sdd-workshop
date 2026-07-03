// Declarative provider config — schema v1 (issue #14 Stage 2 / ADR-0003).
//
// A provider config makes the adapter methodology-agnostic WITHOUT code: it
// declares which artifact writes imply which `/moira-track <phase>` firing
// (triggers → moira-fire.mjs), which node-id scheme / standard edges the
// project uses (documentation + generation inputs), and how drift maps
// artifacts to expected nodes (three modes — see below). cc-sdd itself is
// expressed as the bundled default config (dogfooding), with its DRIFT
// normalization deliberately left as the code provider (`builtin`): the
// cc-sdd semantics (phase-implies-generation, count-free impl groups,
// checkbox corroboration) are too rich for a v1 DSL, and forcing them in
// would bend the DSL around one methodology.
//
// Validation is hand-written (no new deps) and collects ALL errors before
// reporting — same discipline as the WBS import path.

export interface AdviseWhen {
  /** Dotted paths into the parsed JSON; the rule matches if ANY is `=== true`. */
  anyTrue?: string[];
  /** Alternative match: the parsed JSON's `phase` string equals this. */
  phaseEquals?: string;
}

export interface AdviseRule {
  /** 'always' matches unconditionally (put catch-alls LAST — first match wins). */
  when: 'always' | AdviseWhen;
  /** The /moira-track phase this rule advises (must be listed in `phases`). */
  phase: string;
  /**
   * Full additionalContext text. Placeholders: {file} (matched repo-relative
   * path), {feature} (named capture), {phase} (parsed JSON's phase or '?'),
   * {checked}/{total} (checkbox counts).
   */
  message: string;
}

export interface ProviderTrigger {
  /** Regex over the /-normalized written path. MUST contain (?<feature>…). */
  pathPattern: string;
  /** What to read from the written file before evaluating advise rules. */
  read: 'json' | 'checkbox' | 'none';
  /** Evaluated top-down; the FIRST matching rule wins. */
  advise: AdviseRule[];
}

export interface PresenceRule {
  /** Directory to scan recursively (work-repo relative, POSIX), e.g. "docs". */
  scanDir: string;
  /** Regex over the work-repo-relative /-normalized path. MUST contain (?<feature>…). */
  pathPattern: string;
  /** Nodes that must EXIST in the log when the artifact matches ({feature} substitutes). */
  expectNodes: Array<{ node: string; parent: string; label?: string }>;
}

export type ProviderDrift =
  | { mode: 'builtin'; builtin: 'cc-sdd' }
  | { mode: 'presence'; rules: PresenceRule[] }
  | { mode: 'unsupported' };

export interface ProviderConfig {
  schemaVersion: 1;
  id: string;
  displayName?: string;
  /** Any of these work-repo-relative paths existing ⇒ the methodology is present. */
  detect: string[];
  /** The /moira-track phase vocabulary (documentation + trigger validation). */
  phases: string[];
  nodeScheme?: {
    phaseChildren: Array<{ suffix: string; label: string }>;
    implPrefix?: string;
    reviewNode?: string;
  };
  /** Standard precedence edges (issue #7): suffix-level, `impl-*` matches the group. */
  edges?: Array<{ from: string; to: string; policy: 'accepted' | 'implemented' }>;
  /** Multi-repo: feature ids / `<prefix>/*` patterns THIS repo claims (Stage 3). */
  scope?: { claim: string[] };
  triggers: ProviderTrigger[];
  drift: ProviderDrift;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

function regexError(pattern: string): string | null {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Validate an untrusted parsed JSON value against schema v1.
 * Collects EVERY problem (never stops at the first) — returns the typed config
 * only when errors is empty.
 */
export function validateProviderConfig(raw: unknown): {
  config: ProviderConfig | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { config: null, errors: ['provider config はオブジェクトである必要がある'] };
  }
  const o = raw as Record<string, unknown>;

  if (o['schemaVersion'] !== 1) errors.push('schemaVersion は 1 のみ対応');
  if (!isStr(o['id'])) errors.push('id（非空文字列）が必要');
  if (o['displayName'] !== undefined && !isStr(o['displayName'])) errors.push('displayName は文字列');

  if (!isArr(o['detect']) || o['detect'].length === 0 || !o['detect'].every(isStr)) {
    errors.push('detect は非空の文字列配列（存在チェックするパス）');
  }
  if (!isArr(o['phases']) || o['phases'].length === 0 || !o['phases'].every(isStr)) {
    errors.push('phases は非空の文字列配列');
  }
  const phases = isArr(o['phases']) ? o['phases'].filter(isStr) : [];

  // nodeScheme (optional)
  if (o['nodeScheme'] !== undefined) {
    const ns = o['nodeScheme'] as Record<string, unknown>;
    if (typeof ns !== 'object' || ns === null) errors.push('nodeScheme はオブジェクト');
    else {
      const pc = ns['phaseChildren'];
      if (!isArr(pc) || !pc.every((c) => isStr((c as Record<string, unknown>)?.['suffix']) && isStr((c as Record<string, unknown>)?.['label']))) {
        errors.push('nodeScheme.phaseChildren は {suffix, label} の配列');
      }
      if (ns['implPrefix'] !== undefined && !isStr(ns['implPrefix'])) errors.push('nodeScheme.implPrefix は文字列');
      if (ns['reviewNode'] !== undefined && !isStr(ns['reviewNode'])) errors.push('nodeScheme.reviewNode は文字列');
    }
  }

  // edges (optional)
  if (o['edges'] !== undefined) {
    if (!isArr(o['edges'])) errors.push('edges は配列');
    else {
      o['edges'].forEach((e, i) => {
        const edge = e as Record<string, unknown>;
        if (!isStr(edge?.['from']) || !isStr(edge?.['to'])) errors.push(`edges[${i}]: from/to（非空文字列）が必要`);
        if (edge?.['policy'] !== 'accepted' && edge?.['policy'] !== 'implemented') {
          errors.push(`edges[${i}]: policy は accepted | implemented`);
        }
      });
    }
  }

  // scope (optional)
  if (o['scope'] !== undefined) {
    const sc = o['scope'] as Record<string, unknown>;
    if (!isArr(sc?.['claim']) || !(sc['claim'] as unknown[]).every(isStr)) {
      errors.push('scope.claim は文字列配列（空可）');
    }
  }

  // triggers
  if (!isArr(o['triggers'])) errors.push('triggers は配列（空可 — 発火検知なしの provider も表現可）');
  else {
    o['triggers'].forEach((t, i) => {
      const tr = t as Record<string, unknown>;
      const at = `triggers[${i}]`;
      if (!isStr(tr?.['pathPattern'])) errors.push(`${at}: pathPattern（正規表現文字列）が必要`);
      else {
        const re = regexError(tr['pathPattern']);
        if (re !== null) errors.push(`${at}: pathPattern が正規表現として不正 — ${re}`);
        else if (!tr['pathPattern'].includes('(?<feature>')) {
          errors.push(`${at}: pathPattern に名前付き捕獲 (?<feature>…) が必要`);
        }
      }
      if (tr?.['read'] !== 'json' && tr?.['read'] !== 'checkbox' && tr?.['read'] !== 'none') {
        errors.push(`${at}: read は json | checkbox | none`);
      }
      if (!isArr(tr?.['advise']) || (tr['advise'] as unknown[]).length === 0) {
        errors.push(`${at}: advise は非空の配列`);
      } else {
        (tr['advise'] as unknown[]).forEach((a, j) => {
          const rule = a as Record<string, unknown>;
          const rat = `${at}.advise[${j}]`;
          const when = rule?.['when'];
          if (when !== 'always') {
            const w = when as Record<string, unknown>;
            const okAny = w?.['anyTrue'] === undefined || (isArr(w['anyTrue']) && (w['anyTrue'] as unknown[]).every(isStr));
            const okPhase = w?.['phaseEquals'] === undefined || isStr(w['phaseEquals']);
            const hasCond = w?.['anyTrue'] !== undefined || w?.['phaseEquals'] !== undefined;
            if (typeof when !== 'object' || when === null || !okAny || !okPhase || !hasCond) {
              errors.push(`${rat}: when は 'always' か { anyTrue?: string[], phaseEquals?: string }（少なくとも一方）`);
            }
          }
          if (!isStr(rule?.['phase'])) errors.push(`${rat}: phase（非空文字列）が必要`);
          else if (phases.length > 0 && !phases.includes(rule['phase'])) {
            errors.push(`${rat}: phase "${rule['phase']}" が phases に無い`);
          }
          if (!isStr(rule?.['message'])) errors.push(`${rat}: message（非空文字列）が必要`);
        });
      }
    });
  }

  // drift
  const drift = o['drift'] as Record<string, unknown> | undefined;
  if (typeof drift !== 'object' || drift === null) errors.push('drift（{mode: builtin|presence|unsupported}）が必要');
  else if (drift['mode'] === 'builtin') {
    if (drift['builtin'] !== 'cc-sdd') errors.push('drift.builtin は "cc-sdd" のみ登録済み');
  } else if (drift['mode'] === 'presence') {
    if (!isArr(drift['rules']) || (drift['rules'] as unknown[]).length === 0) {
      errors.push('drift.rules（presence モード）は非空の配列');
    } else {
      (drift['rules'] as unknown[]).forEach((r, i) => {
        const rule = r as Record<string, unknown>;
        const at = `drift.rules[${i}]`;
        if (!isStr(rule?.['scanDir'])) errors.push(`${at}: scanDir（非空文字列）が必要`);
        if (!isStr(rule?.['pathPattern'])) errors.push(`${at}: pathPattern が必要`);
        else {
          const re = regexError(rule['pathPattern']);
          if (re !== null) errors.push(`${at}: pathPattern が正規表現として不正 — ${re}`);
          else if (!rule['pathPattern'].includes('(?<feature>')) {
            errors.push(`${at}: pathPattern に名前付き捕獲 (?<feature>…) が必要`);
          }
        }
        if (!isArr(rule?.['expectNodes']) || (rule['expectNodes'] as unknown[]).length === 0) {
          errors.push(`${at}: expectNodes は非空の配列`);
        } else {
          (rule['expectNodes'] as unknown[]).forEach((n, j) => {
            const en = n as Record<string, unknown>;
            if (!isStr(en?.['node']) || !isStr(en?.['parent'])) {
              errors.push(`${at}.expectNodes[${j}]: node/parent（非空文字列）が必要`);
            }
          });
        }
      });
    }
  } else if (drift['mode'] !== 'unsupported') {
    errors.push('drift.mode は builtin | presence | unsupported');
  }

  if (errors.length > 0) return { config: null, errors };
  return { config: raw as unknown as ProviderConfig, errors: [] };
}

/** Repo-relative location of the provider config in a work repo. */
export const PROVIDER_CONFIG_REL = '.claude/moira-provider.json';
