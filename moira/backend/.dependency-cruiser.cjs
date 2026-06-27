// Architecture-fitness (計器①) for the Moira backend.
//
// The backend is currently a MONOLITH: derive.ts integrates all 11 derivations
// in one function, and derivations/ is only PHYSICALLY split (no enforced CQRS
// boundary yet). So this stage ships TOPOLOGY checks, not the strong CQRS fitness
// ("core→downstream-value forbidden", "formulas only in evm", "surface reads via
// seam"). Those land AFTER the physical CQRS decomposition. See
// .kiro/steering/moira-verification.md (第4器 アーキ適合) and
// moira/DECISIONS-CATALOG.md 被覆マップ ①.
//
// CommonJS (.cjs) is required: the backend is `"type":"module"`, so a plain
// `module.exports` file must carry the .cjs extension.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'No circular dependencies in the backend module graph (the derivation ' +
        'graph is a DAG: types ← derivations ← derive). Cycles would make the ' +
        'single-pass derive() order undefined.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'fold-no-downstream',
      severity: 'error',
      comment:
        'fold.ts is the structural projection (the "土台"/core): it replays the ' +
        'event log into ProjectedState and must NOT depend on any downstream ' +
        'derivation (derivations/** or derive.ts). This is the monolith-era weak ' +
        'proxy for D-2 ("core does not evaluate ready-eligibility") and D-4 ' +
        '("core holds structure only; values/formulas live downstream"). TRUE ' +
        'today: fold.ts imports only ./event-store.js and ./types.js.',
      from: { path: '^src/fold\\.ts$' },
      to: { path: '^src/(derivations/|derive\\.ts$)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Tests legitimately import derivations directly (e.g. leveler.test.ts,
    // green-properties.pbt.test.ts import computeEffectiveSet/computeAc), so they
    // are excluded from the cruise. The fold-only rule is anchored to
    // `^src/fold\.ts$` and can never fire on a test file regardless.
    exclude: { path: '\\.test\\.tsx?$|/pbt/|/fixtures/|/test-utils\\.ts$' },
    // NodeNext source uses `./foo.js` specifiers that physically resolve to
    // foo.ts. Without tsConfig + .ts-first extensions, dependency-cruiser cannot
    // map the .js specifier to the .ts file and the rules would silently match
    // nothing (a false pass). typescript is a devDependency of this project.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
