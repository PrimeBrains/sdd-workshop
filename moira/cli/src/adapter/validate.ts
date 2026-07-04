// `moira adapter validate-provider <path>` — machine-check a declarative
// provider config against schema v1 (ADR-0003 Stage 3: the generator skill's
// verification step; also useful when hand-authoring a config).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CliError } from '../errors.js';
import { validateProviderConfig } from './provider-config.js';

const out = (s: string): void => void process.stdout.write(`${s}\n`);

export function cmdValidateProvider(rest: string[]): void {
  const path = rest[0];
  if (path === undefined || path.startsWith('--')) {
    throw new CliError('usage: moira adapter validate-provider <config.json>');
  }
  const abs = resolve(path);
  if (!existsSync(abs)) throw new CliError(`provider config not found: ${abs}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new CliError(`JSON として読めない: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { config, errors } = validateProviderConfig(raw);
  if (config === null) {
    throw new CliError(`スキーマ不正（${errors.length} 件）:\n  - ${errors.join('\n  - ')}`);
  }
  out(
    `OK: provider "${config.id}"（schema v1・phases ${config.phases.length}・triggers ${config.triggers.length}・drift ${config.drift.mode}）`,
  );
}
