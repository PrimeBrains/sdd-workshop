// Install manifest (.claude/.moira-adapter.json) — the installer's memory of
// what it wrote (version, per-file content hash, injected settings entries).
// Hashes are over LF-normalized text so Windows/POSIX checkouts agree.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInjection } from './settings-merge.js';

export const MANIFEST_REL = '.claude/.moira-adapter.json';

export interface AdapterManifest {
  adapterVersion: string;
  installedAt: string;
  /** repo-relative POSIX path → "sha256:<hex>" of the installed content */
  files: Record<string, string>;
  settingsInjected: HookInjection[];
  claudeMdBlock: boolean;
}

export function contentHash(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('hex')}`;
}

export function manifestPath(cwd: string): string {
  return join(cwd, ...MANIFEST_REL.split('/'));
}

export function loadManifest(cwd: string): AdapterManifest | null {
  const path = manifestPath(cwd);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as AdapterManifest;
}

export function saveManifest(cwd: string, manifest: AdapterManifest): void {
  writeFileSync(manifestPath(cwd), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
