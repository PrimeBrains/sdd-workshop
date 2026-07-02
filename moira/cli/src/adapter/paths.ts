// Resolve the bundled adapter templates (moira/cli/templates) relative to this
// package, regardless of the cwd it is invoked from (works when npm-linked).
// Compiled: moira/cli/dist/adapter/paths.js → ../../templates = moira/cli/templates.
// Under vitest: moira/cli/src/adapter/paths.ts → same resolution (src and dist sit
// at the same depth) — the same trick as src/paths.ts (frontendDistDir).

import { fileURLToPath } from 'node:url';

export function templatesDir(): string {
  return fileURLToPath(new URL('../../templates', import.meta.url));
}
