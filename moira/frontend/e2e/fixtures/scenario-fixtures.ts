// Named scenario fixtures = compositions of stages (see stages.ts). Each exported
// fixture is the event log that derives to a specific scenario断面 (Before / During /
// After / Given). The derive numbers are pinned by scenario-fixtures.test.ts (run
// under vitest with the real @backend derive) before any spec depends on them.
//
// The whole backbone is ONE progressive composition: each fixture is a prefix of
// the next, so the named fixtures ARE the snapshots the flow-level E2E walks
// (flows/new-feature-happy-path.md). Every stage is a faithful §5 transcription.
import { type MoiraFixture } from './types';
import { makeLog, type LogBuilder } from './builders';
import {
  discoverFeature,
  proposePhaseEstimates,
  agreePhaseEstimates,
  addReviewWorkNodes,
  agreeReviewWorkEstimates,
  draftRequirements,
  returnRequirements,
  resubmitRequirements,
  reReturnRequirements,
  acceptRequirements,
  completeDesign,
  completeTasks,
  agreeImplEstimates,
  completeImpl,
} from './stages';

type Stage = (log: LogBuilder) => void;

// Nodes are all unscheduled in these planning/spec-phase scenarios, so asOf does
// not move EV%/coverage (no frozenSlot → no PV). Pinned for determinism.
export const FIXTURE_AS_OF = '2026-06-30';

function fixture(...stages: Stage[]): MoiraFixture {
  const log = makeLog();
  for (const stage of stages) stage(log);
  return { events: log.build(), asOf: FIXTURE_AS_OF };
}

// ── The backbone spine as growing prefixes (each row adds one stage) ──────────
const sDiscovered: Stage[] = [discoverFeature];
const sProposed: Stage[] = [...sDiscovered, proposePhaseEstimates];
const sAgreed: Stage[] = [...sProposed, agreePhaseEstimates];
const sReviewAdded: Stage[] = [...sAgreed, addReviewWorkNodes];
const sReviewAgreed: Stage[] = [...sReviewAdded, agreeReviewWorkEstimates];
const sDrafted: Stage[] = [...sReviewAgreed, draftRequirements];
const sReturned: Stage[] = [...sDrafted, returnRequirements];
const sResubmitted1: Stage[] = [...sReturned, resubmitRequirements]; // flow seam #3
const sReReturned: Stage[] = [...sResubmitted1, reReturnRequirements];
const sResubmitted2: Stage[] = [...sReReturned, resubmitRequirements]; // flow seam #4
const sAccepted: Stage[] = [...sResubmitted2, acceptRequirements];
const sDesignDone: Stage[] = [...sAccepted, completeDesign];
const sTasksDone: Stage[] = [...sDesignDone, completeTasks];
const sImplEstimated: Stage[] = [...sTasksDone, agreeImplEstimates];
const sImplDone: Stage[] = [...sImplEstimated, completeImpl];

// ── #1 discovery-spec-initialized (After): F + 3 phases born unestimated. P2 0%. */
export const discovered = fixture(...sDiscovered);

// ── #2 estimate-spec-proposed (After) = #3 Before: 3 phase estimates proposed. P2 0%. */
export const estimateProposed = fixture(...sProposed);

// ── #3 estimate-spec-agreed (After): 3 phase estimates agreed → P2 100%, EV% 0%. */
export const estimateAgreed = fixture(...sAgreed);

// ── review-work-estimated (During): review nodes added, not yet agreed → P2 50% (3/6). */
export const reviewWorkDuring = fixture(...sReviewAdded);

// ── review-work-estimated (After): review estimates agreed → P2 100% (6/6). */
export const reviewWorkAfter = fixture(...sReviewAgreed);

// ── #4 requirements-spec-drafted (Before/Given) = review-work-estimated After. EV% 0%. */
export const requirementsBefore = reviewWorkAfter;

// ── #4 requirements-spec-drafted (After): req drafted → implemented → EV% 24% (3/12.5). */
export const requirementsDrafted = fixture(...sDrafted);

// ── #5 requirements-spec-returned (After): review +EV then req returned → EV% 8% (1/12.5). */
export const requirementsReturned = fixture(...sReturned);

// ── flow seam #3 (Claude re-submit): req implemented again → EV% 32% (4/12.5). #6 Before. */
export const requirementsResubmitted1 = fixture(...sResubmitted1);

// ── #6 requirements-spec-re-returned (After): folded re-review cost + return → EV% 8%, AC↑. */
export const requirementsReReturned = fixture(...sReReturned);

// ── flow seam #4 (Claude re-submit): req implemented again → EV% 32%. #7 Before. */
export const requirementsResubmitted2 = fixture(...sResubmitted2);

// ── #7 requirements-spec-accepted (After): req accepted, design implementing → EV% 32%. */
export const requirementsAccepted = fixture(...sAccepted);

// ── #8 design-spec-completed (After): design accepted, tasks implementing → EV% 80%. */
export const designCompleted = fixture(...sDesignDone);

// ── #9 tasks-spec-completed (After): spec all accepted, impl born unestimated → EV% 100%
//    (apparent), P2 75%. */
export const tasksCompleted = fixture(...sTasksDone);

// ── #10 estimate-impl-agreed (After): impl estimates agreed, denom 12.5→28.5 → EV% 43.9%,
//    P2 100%. */
export const implEstimateAgreed = fixture(...sImplEstimated);

// ── #11 impl-completed (After): impl + review accepted, F accepted → EV% 100% (real). */
export const implCompleted = fixture(...sImplDone);

// Ordered backbone snapshots — the through-line the flow-level E2E walks.
export const BACKBONE: ReadonlyArray<{ slug: string; fixture: MoiraFixture }> = [
  { slug: 'discovery-spec-initialized', fixture: discovered },
  { slug: 'estimate-spec-proposed', fixture: estimateProposed },
  { slug: 'estimate-spec-agreed', fixture: estimateAgreed },
  { slug: 'requirements-spec-drafted', fixture: requirementsDrafted },
  { slug: 'requirements-spec-returned', fixture: requirementsReturned },
  { slug: 'requirements-spec-re-returned', fixture: requirementsReReturned },
  { slug: 'requirements-spec-accepted', fixture: requirementsAccepted },
  { slug: 'design-spec-completed', fixture: designCompleted },
  { slug: 'tasks-spec-completed', fixture: tasksCompleted },
  { slug: 'estimate-impl-agreed', fixture: implEstimateAgreed },
  { slug: 'impl-completed', fixture: implCompleted },
];
