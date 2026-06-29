// Architecture-fitness (計器①/第4器) for the Moira FRONTEND — the single-seam
// discipline made machine-checkable (UI-ARCHITECTURE §4.1, R-S2). The whole UI is
// a projection of ONE derive() call held in the store; surfaces read it through
// hooks/context and never re-derive. These rules pin that topology so a new surface
// (e.g. activity) cannot quietly bypass the seam.
//
// CommonJS (.cjs) required: the package is `"type":"module"`.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies in the frontend module graph.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'single-backend-bridge',
      severity: 'error',
      comment:
        'The backend engine (@backend/*: derive/fold/types/fixtures) may be imported ' +
        'ONLY through the single bridge module src/moira/engine.ts (+ its ambient ' +
        'decl). This is the single-source-of-truth seam (R-S2): every metric comes ' +
        'from one derive() pipeline, re-exported once. TRUE today: only engine.ts ' +
        'imports @backend.',
      from: { path: '^src/', pathNot: '^src/moira/(engine\\.ts|backend-runtime\\.d\\.ts)$' },
      // Two forms: the unresolved alias specifier (@backend/derive.js …) and the
      // one that DOES resolve through the ambient decl (../backend/src/types.ts).
      to: { path: '^@backend(/|$)|backend/src/' },
    },
    {
      name: 'surfaces-read-via-hooks-not-store',
      severity: 'error',
      comment:
        'Surfaces must read the single DerivedState/ProjectedState via the hooks ' +
        '(useMoira/useDerived), NOT by importing the MoiraProvider store directly. ' +
        'One derive() lives in the store; surfaces are pure projections of it.',
      from: { path: '^src/surfaces/' },
      to: { path: '^src/moira/store\\.tsx$' },
    },
    {
      name: 'surfaces-no-cross-surface',
      severity: 'error',
      comment:
        'A surface must not import another surface’s internals — each surface is an ' +
        'independent projection of the same DerivedState. Exception: the shared ' +
        'DISPLAY-ONLY helper schedule/gantt-geometry.ts (no metric; pure geometry).',
      from: { path: '^src/surfaces/([^/]+)/' },
      to: {
        path: '^src/surfaces/',
        pathNot: ['^src/surfaces/$1/', '^src/surfaces/schedule/gantt-geometry\\.ts$'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // @backend is a Vite-plugin alias (not a tsconfig path), so it stays unresolved
    // here — recorded as a dependency with its raw specifier, which is exactly what
    // single-backend-bridge matches on (^@backend). Do NOT add an alias: resolving
    // it would move the match target and risk a silent false-pass.
    exclude: { path: '\\.test\\.(ts|tsx)$|^src/main\\.tsx$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
