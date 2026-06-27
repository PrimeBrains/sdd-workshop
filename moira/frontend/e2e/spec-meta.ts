// The header contract every generated E2E spec declares, and the coverage gate
// (coverage-check.test.ts) parses. It makes the spec↔scenario↔EARS mapping
// machine-checkable: every §6 EARS clause of the agreed unit must be accounted for
// here (green regression-lock / xfail tripwire / deferred-with-reason) — no silent
// omission. Lives in its own module (no @playwright/test import) so the vitest gate
// can import it without registering Playwright tests.

export type ClauseMode =
  | 'green' // asserted as a hard regression lock against the current slice (計器③ preservation)
  | 'xfail' // target asserted but the slice doesn't implement it yet → test.fail() tripwire
  | 'deferred'; // intentionally not asserted in this spec (out of surface / not observable)

export interface ClauseMeta {
  /** 1-based index matching the EARS bullet order in the unit's §6. */
  ears: number;
  mode: ClauseMode;
  /** Required for xfail/deferred: why it is not a green lock (with scenario ref). */
  note?: string;
}

export interface SpecMeta {
  /** The agreed unit this spec regresses, e.g. 'units/estimate-spec-agreed'. */
  scenarioUnit: string;
  /** Surfaces the spec drives. */
  surfaces: string[];
  /** One entry per EARS clause in the unit's §6, in order (length must equal §6 count). */
  clauses: ClauseMeta[];
}
