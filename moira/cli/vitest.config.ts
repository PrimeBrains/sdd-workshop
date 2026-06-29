import { defineConfig } from 'vitest/config';

// Plain NodeNext (no vite plugins / path aliases), mirroring moira/backend. Vite
// resolves the `.js`-extension relative imports to their `.ts` sources, and the
// bare `moira-backend` import resolves via its package `exports` to dist/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
