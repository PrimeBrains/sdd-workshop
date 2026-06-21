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

const toId = (p: string) => p.replace(/\\/g, '/');
// Vite dev decorates importers with a `/@fs/` prefix and a `?v=hash` query and
// uses posix slashes; strip those so dirname() works on both dev and build.
const cleanImporter = (imp: string) => imp.replace(/\?.*$/, '').replace(/^\/?@fs\//, '');

function firstExisting(...candidates: string[]): string | null {
  for (const c of candidates) if (existsSync(c)) return toId(c);
  return null;
}

/**
 * Resolves the backend's NodeNext-style source for the browser:
 *  - `@backend/x.js` (or extensionless)  →  ../backend/src/x.ts
 *  - any relative `./x.js` import whose sibling `.ts` exists → `.ts`
 *    (only the backend uses `.js`-extension relative imports, so this is scoped
 *    in practice — and it does NOT depend on matching the importer path, which
 *    Vite normalizes differently in dev vs build).
 * `node:fs` is shimmed via resolve.alias (the app never calls fs).
 */
function moiraBackendResolver(): Plugin {
  return {
    name: 'moira-backend-resolver',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('@backend/')) {
        const base = resolve(BACKEND_SRC, source.slice('@backend/'.length));
        const noExt = base.endsWith('.js') ? base.slice(0, -3) : base;
        return firstExisting(`${noExt}.ts`, base, `${base}.ts`, resolve(base, 'index.ts'));
      }
      if (
        importer !== undefined &&
        source.endsWith('.js') &&
        (source.startsWith('./') || source.startsWith('../'))
      ) {
        const base = resolve(dirname(cleanImporter(importer)), source);
        return firstExisting(`${base.slice(0, -3)}.ts`);
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [moiraBackendResolver(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The app never calls fs; this satisfies the backend's capacity-store /
      // event-store top-level `node:fs` import in the browser.
      'node:fs': FS_SHIM,
    },
  },
  server: {
    port: 5180,
    // The backend source lives OUTSIDE this project root (../backend). Allow the
    // parent `moira/` dir so Vite serves backend modules via /@fs/ in dev instead
    // of 403 (don't rely on git-root auto-detection).
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
