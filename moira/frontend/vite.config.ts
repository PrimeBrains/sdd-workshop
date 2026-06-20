import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Absolute path to the S4 backend source. The frontend imports the REAL derive()
// from here so there is exactly ONE derivation implementation (single source of
// truth, R-S2). See moira/UI-DESIGN-BRIEF.md §7.
const BACKEND_SRC = fileURLToPath(new URL('../backend/src', import.meta.url));
const FS_SHIM = fileURLToPath(new URL('./src/shims/node-fs.ts', import.meta.url));

/**
 * Resolves the backend's NodeNext-style source for the browser:
 *  - `@backend/x.js`  →  ../backend/src/x.ts
 *  - relative `./x.js` imports *inside the backend* → ./x.ts
 *  - `node:fs` imported *inside the backend* → a browser shim (only loadJson/
 *    saveJson use it and those are never called in the app).
 * Nothing else is touched, so React/etc. resolve normally.
 */
function moiraBackendResolver(): Plugin {
  return {
    name: 'moira-backend-resolver',
    enforce: 'pre',
    resolveId(source, importer) {
      const fromBackend = !!importer && importer.startsWith(BACKEND_SRC);

      if (source === 'node:fs' || source === 'fs') {
        return fromBackend ? FS_SHIM : null;
      }

      let target: string | null = null;
      if (source.startsWith('@backend/')) {
        target = resolve(BACKEND_SRC, source.slice('@backend/'.length));
      } else if ((source.startsWith('./') || source.startsWith('../')) && fromBackend) {
        target = resolve(dirname(importer as string), source);
      }
      if (target === null) return null;

      const candidates: string[] = [];
      if (target.endsWith('.js')) candidates.push(`${target.slice(0, -3)}.ts`);
      candidates.push(target, `${target}.ts`, resolve(target, 'index.ts'));
      for (const c of candidates) {
        if (existsSync(c)) return c;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [moiraBackendResolver(), react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5180 },
});
