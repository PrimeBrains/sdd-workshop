// Portfolio config — the declared list of homes `moira ui --portfolio` reads
// (issue #23). A portfolio is a PRESENTATION-LAYER juxtaposition: each entry
// resolves to exactly ONE home (resolveExplicit per entry — the D-50 boundary
// in home.ts holds), each home is folded/derived independently, and the logs
// are NEVER merged. Cross-project Σc consistency stays out of scope (MODEL §5).
//
// Validation is hand-written and collects ALL errors before reporting — same
// discipline as provider-config.ts / the WBS import path.

import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { CliError } from './errors.js';
import { resolveExplicit } from './home.js';

export interface PortfolioHomeEntry {
  /** A home root (the directory containing `.moira/`) or a `.moira` pointer
   *  file location — absolute, or relative to the portfolio file's directory. */
  path: string;
  /** Display-name override; falls back to the home's own project label. */
  label?: string;
}

export interface PortfolioConfig {
  schemaVersion: 1;
  /** Portfolio display name (optional). */
  label?: string;
  homes: PortfolioHomeEntry[];
}

export interface ResolvedPortfolioEntry {
  /** Stable identity for the entry: the normalized absolute home root. */
  key: string;
  /** The home ROOT (directory whose `.moira/` holds the log). */
  root: string;
  /** The declared label override, if any. */
  label?: string;
  /** Set when the entry's pointer file failed to resolve — the caller surfaces
   *  it as the loadError row's reason (never silently swallowed). */
  resolveError?: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v !== '';

/**
 * Validate an untrusted parsed JSON value against portfolio schema v1.
 * Collects EVERY problem (never stops at the first) — returns the typed config
 * only when errors is empty.
 */
export function validatePortfolioConfig(raw: unknown): {
  config: PortfolioConfig | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { config: null, errors: ['portfolio config はオブジェクトである必要がある'] };
  }
  const o = raw as Record<string, unknown>;

  if (o['schemaVersion'] !== 1) errors.push('schemaVersion は 1 のみ対応');
  if (o['label'] !== undefined && !isStr(o['label'])) errors.push('label は非空文字列');

  const homes = o['homes'];
  if (!Array.isArray(homes) || homes.length === 0) {
    errors.push('homes は非空の配列（{path, label?} を並べる）');
  } else {
    homes.forEach((h, i) => {
      if (typeof h !== 'object' || h === null || Array.isArray(h)) {
        errors.push(`homes[${i}] はオブジェクト（{path, label?}）`);
        return;
      }
      const e = h as Record<string, unknown>;
      if (!isStr(e['path'])) errors.push(`homes[${i}].path（非空文字列）が必要`);
      if (e['label'] !== undefined && !isStr(e['label'])) errors.push(`homes[${i}].label は非空文字列`);
    });
  }

  if (errors.length > 0) return { config: null, errors };
  return { config: raw as PortfolioConfig, errors: [] };
}

/** Read + parse + validate a portfolio file. Throws a CliError listing ALL problems. */
export function loadPortfolioConfig(filePath: string): PortfolioConfig {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new CliError(
      `portfolio ファイルを読めない: ${filePath} (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new CliError(
      `portfolio ファイルが JSON として不正: ${filePath} (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const { config, errors } = validatePortfolioConfig(raw);
  if (config === null) {
    throw new CliError(
      `portfolio 設定エラー ${errors.length} 件 (${filePath}):\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
  return config;
}

/**
 * Resolve each declared entry to ONE home root (pointer files: one hop, via
 * home.ts's resolveExplicit). No merging — entries map 1:1 to homes. Duplicate
 * homes (same normalized root) are a CONFIG error and throw; a missing/broken
 * home is NOT fatal here — the caller surfaces it as a per-entry loadError row
 * (a visible gap, never fabricated zeros). A broken pointer FILE throws inside
 * resolveExplicit; the caller catches per entry.
 */
export function resolvePortfolioEntries(
  config: PortfolioConfig,
  portfolioFilePath: string,
): ResolvedPortfolioEntry[] {
  const baseDir = dirname(resolve(portfolioFilePath));
  const entries: ResolvedPortfolioEntry[] = [];
  const seen = new Map<string, number>(); // normalized root → first index
  const duplicates: string[] = [];

  config.homes.forEach((h, i) => {
    // resolveExplicit follows a `.moira` pointer one hop; a broken pointer
    // throws CliError. Keep this function total: record the REAL error message
    // on the entry (resolveError) and fall back to the declared path, so the
    // caller's loadError row shows the actual reason.
    const declared = resolve(baseDir, h.path);
    let root = declared;
    let resolveError: string | undefined;
    try {
      root = resolveExplicit(declared);
    } catch (e) {
      resolveError = e instanceof Error ? e.message : String(e);
    }
    const key = root;
    const first = seen.get(key);
    if (first !== undefined) {
      duplicates.push(`homes[${first}] と homes[${i}] が同じ home を指す: ${key}`);
      return;
    }
    seen.set(key, i);
    entries.push({
      key,
      root,
      ...(h.label !== undefined ? { label: h.label } : {}),
      ...(resolveError !== undefined ? { resolveError } : {}),
    });
  });

  if (duplicates.length > 0) {
    throw new CliError(
      `portfolio 設定エラー（home の重複）:\n` + duplicates.map((d) => `  - ${d}`).join('\n'),
    );
  }
  return entries;
}

/** Fallback display name for an entry whose home has no project label. */
export function fallbackLabel(root: string): string {
  return basename(root);
}
