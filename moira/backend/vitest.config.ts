import { defineConfig } from 'vitest/config';

// Backend has no vite plugins / path aliases (plain NodeNext), so a standalone
// vitest config is correct here. Coverage is wired via @vitest/coverage-v8 (the
// v8 provider — c8-equivalent). The DEFAULT `vitest run` keeps its current
// behavior (typecheck OFF) so the PBT pilot and the done-lock `it.fails`
// tripwire stay exactly as they are; the type-level samples (D-2/D-3) run only
// under the opt-in `test:types` script (vitest --typecheck.only).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: false,
      include: ['src/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test-d.ts',
        'src/pbt/**', // PBT harness + arbitraries are test scaffolding
        'src/fixtures/**',
        'src/test-utils.ts',
        'src/read/**', // CLI / http entrypoints, not unit-covered here
      ],
    },
  },
});
