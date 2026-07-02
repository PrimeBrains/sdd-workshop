// The adapter's version IS the moira-cli package version (single version to
// reason about: what npm link delivers is what `adapter install` stamps).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function adapterVersion(): string {
  const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}
