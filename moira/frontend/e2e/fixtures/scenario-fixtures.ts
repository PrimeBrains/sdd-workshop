// Named scenario fixtures = compositions of stages (see stages.ts). Each exported
// fixture is the event log that derives to a specific scenario断面 (Before / During /
// After / Given). The derive numbers are pinned by fixtures.test.ts (run under
// vitest with the real @backend derive) before any spec depends on them.
import { type MoiraFixture } from './types';
import { makeLog, type LogBuilder } from './builders';
import {
  proposePhaseEstimates,
  agreePhaseEstimates,
  addReviewWorkNodes,
  agreeReviewWorkEstimates,
  draftRequirements,
} from './stages';

// Nodes are all pending/unscheduled in these planning-phase scenarios, so asOf does
// not move EV%/coverage (no frozenSlot → no PV). Pinned for determinism.
export const FIXTURE_AS_OF = '2026-06-30';

function fixture(...stages: Array<(log: LogBuilder) => void>): MoiraFixture {
  const log = makeLog();
  for (const stage of stages) stage(log);
  return { events: log.build(), asOf: FIXTURE_AS_OF };
}

/** estimate-spec-proposed (the all-proposed "before" of estimate-spec-agreed). P2 0%. */
export const estimateProposed = fixture(proposePhaseEstimates);

/** estimate-spec-agreed (After): 3 phase estimates agreed → P2 100%, EV% 0%. */
export const estimateAgreed = fixture(proposePhaseEstimates, agreePhaseEstimates);

/** review-work-estimated (During): review nodes added, not yet agreed → P2 50% (3/6). */
export const reviewWorkDuring = fixture(
  proposePhaseEstimates,
  agreePhaseEstimates,
  addReviewWorkNodes,
);

/** review-work-estimated (After): review estimates agreed → P2 100% (6/6). */
export const reviewWorkAfter = fixture(
  proposePhaseEstimates,
  agreePhaseEstimates,
  addReviewWorkNodes,
  agreeReviewWorkEstimates,
);

/** requirements-spec-drafted (Before/Given) = review-work-estimated After (all agreed, none done). EV% 0%. */
export const requirementsBefore = reviewWorkAfter;

/** requirements-spec-drafted (After): req drafted → implemented → EV% 24% (3/12.5), EV_abs 3. */
export const requirementsDrafted = fixture(
  proposePhaseEstimates,
  agreePhaseEstimates,
  addReviewWorkNodes,
  agreeReviewWorkEstimates,
  draftRequirements,
);
