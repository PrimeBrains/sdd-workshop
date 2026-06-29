// Resolve the prebuilt frontend dashboard (moira/frontend/dist) relative to this
// CLI package, regardless of the cwd it is invoked from (works when npm-linked).
// This file compiles to moira/cli/dist/paths.js → ../../frontend/dist = moira/frontend/dist.

import { fileURLToPath } from 'node:url';

export function frontendDistDir(): string {
  return fileURLToPath(new URL('../../frontend/dist', import.meta.url));
}
