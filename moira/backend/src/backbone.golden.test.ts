// Backbone golden — the engine-level (backend, no frontend resolver) proof that
// derive() walks the full through-line of flows/new-feature-happy-path.md, asserted
// at EVERY checkpoint INCLUDING the intra-stage mids the flow's arc names:
//
//   EV%: 0 → 24 → (32→8) → (32→8) → 32 → (72→80) → (96→100 apparent)
//        → 43.9 (honest) → (71.9 → 93.0 → 100 real)
//   P2 : 0 → 0 → 100 → … → 100 → 75 → 100
//
// Reviewer/assignee attendant transitions are EV no-ops and are omitted here (the
// backend Log.life is a pure lifecycle transition); only the EV-relevant events are
// transcribed, since this asserts the numbers, not the display attributes.
import { describe, expect, it } from 'vitest';
import { derive } from './derive.js';
import { Log, agent, human } from './test-utils.js';

const CLAUDE = agent('claude');
const TARO = human('dev:taro');
const ASOF = '2026-06-30';

describe('backbone arc (new-feature-happy-path) — full through-line incl. mids', () => {
  it('EV%/P2/exec move exactly as the flow declares at every seam', () => {
    const log = new Log();
    const check = (
      label: string,
      exp: { ev: number; pct: number; p2?: number; exec?: number },
    ): void => {
      const d = derive(log.all(), { asOf: ASOF, capacityOf: () => 1 });
      expect(d.evAbs, `${label}: evAbs`).toBeCloseTo(exp.ev, 6);
      expect(d.evPercent, `${label}: evPercent`).toBeCloseTo(exp.pct, 6);
      if (exp.p2 !== undefined) expect(d.estimateCoverage, `${label}: P2`).toBeCloseTo(exp.p2, 6);
      if (exp.exec !== undefined)
        expect(d.executionCoverage, `${label}: R-S8`).toBeCloseTo(exp.exec, 6);
      expect(d.structuralErrors, `${label}: structuralErrors`).toEqual([]);
    };

    // #1 discovery — born unestimated
    log.decompose('root', [{ node: 'F' }], CLAUDE);
    log.decompose('F', [{ node: 'F/req' }, { node: 'F/design' }, { node: 'F/tasks' }], CLAUDE);
    check('#1 discovery', { ev: 0, pct: 0, p2: 0, exec: 0 });

    // #2 estimate proposed
    log.decompose(
      'F',
      [
        { node: 'F/req', estimate: 3 },
        { node: 'F/design', estimate: 5 },
        { node: 'F/tasks', estimate: 2 },
      ],
      CLAUDE,
    );
    check('#2 proposed', { ev: 0, pct: 0, p2: 0 });

    // #3 estimate agreed — P2 100%
    log.agree('F/req', 3, TARO).agree('F/design', 5, TARO).agree('F/tasks', 2, TARO);
    check('#3 agreed', { ev: 0, pct: 0, p2: 1 });

    // review-work-estimated (support) — added (P2 50%) then agreed (P2 100%)
    log.decompose(
      'F',
      [
        { node: 'F/review-req', estimate: 1 },
        { node: 'F/review-design', estimate: 1 },
        { node: 'F/review-tasks', estimate: 0.5 },
      ],
      CLAUDE,
    );
    log.dep('F/req', 'F/review-req', 'implemented');
    log.dep('F/design', 'F/review-design', 'implemented');
    log.dep('F/tasks', 'F/review-tasks', 'implemented');
    check('review-work added', { ev: 0, pct: 0, p2: 0.5 });
    log.agree('F/review-req', 1, TARO).agree('F/review-design', 1, TARO).agree('F/review-tasks', 0.5, TARO);
    check('review-work agreed', { ev: 0, pct: 0, p2: 1 });

    // #4 requirements drafted — EV% 0→24
    log.life('F/req', 'implementing', CLAUDE);
    check('#4 drafting (exec 1/6)', { ev: 0, pct: 0, exec: 1 / 6 });
    log.life('F/req', 'implemented', CLAUDE);
    check('#4 drafted', { ev: 3, pct: 0.24, p2: 1, exec: 0 });

    // #5 returned — review +EV (mid 32) then revert (8)
    log.life('F/review-req', 'implementing', TARO).life('F/review-req', 'implemented', TARO);
    check('#5 mid: review done', { ev: 4, pct: 0.32 });
    log.life('F/req', 'implementing', TARO);
    check('#5 returned', { ev: 1, pct: 0.08, exec: 1 / 6 });

    // seam #3 resubmit — back to 32
    log.life('F/req', 'implemented', CLAUDE);
    check('seam#3 resubmit', { ev: 4, pct: 0.32, exec: 0 });

    // #6 re-returned — folded cost (AC↑) then revert (8)
    log.cost('F/req', 0.5, TARO);
    log.life('F/req', 'implementing', TARO);
    {
      const d = derive(log.all(), { asOf: ASOF, capacityOf: () => 1 });
      expect(d.ac, '#6 AC includes folded re-review cost').toBeCloseTo(0.5, 6);
    }
    check('#6 re-returned', { ev: 1, pct: 0.08, exec: 1 / 6 });

    // seam #4 resubmit — back to 32
    log.life('F/req', 'implemented', CLAUDE);
    check('seam#4 resubmit', { ev: 4, pct: 0.32 });

    // #7 accepted — approval adds no EV (stays 32), design starts
    log.cost('F/req', 0.5, TARO);
    log.life('F/req', 'accepted', TARO).life('F/review-req', 'accepted', TARO);
    check('#7 accepted (approval adds no EV)', { ev: 4, pct: 0.32 });
    log.life('F/design', 'implementing', CLAUDE);
    check('#7 design implementing', { ev: 4, pct: 0.32, exec: 1 / 6 });

    // #8 design completed — 32 → 72 (mid①) → 80 (mid②)
    log.life('F/design', 'implemented', CLAUDE);
    check('#8 mid①: design done', { ev: 9, pct: 0.72 });
    log.life('F/review-design', 'implementing', TARO).life('F/review-design', 'implemented', TARO);
    check('#8 mid②: design review done', { ev: 10, pct: 0.8 });
    log.cost('F/design', 0.5, TARO);
    log.life('F/design', 'accepted', TARO).life('F/review-design', 'accepted', TARO);
    log.life('F/tasks', 'implementing', CLAUDE);
    check('#8 design accepted, tasks implementing', { ev: 10, pct: 0.8, exec: 1 / 6 });

    // #9 tasks completed — 80 → 96 (mid①) → 100 apparent; then impl born → P2 75
    log.life('F/tasks', 'implemented', CLAUDE);
    check('#9 mid①: tasks done', { ev: 12, pct: 0.96 });
    log.life('F/review-tasks', 'implementing', TARO).life('F/review-tasks', 'implemented', TARO);
    check('#9 mid②: 100% apparent', { ev: 12.5, pct: 1, p2: 1 });
    log.cost('F/tasks', 0.25, TARO);
    log.life('F/tasks', 'accepted', TARO).life('F/review-tasks', 'accepted', TARO);
    log.decompose('F', [{ node: 'F/impl-1' }, { node: 'F/impl-2' }], CLAUDE); // unestimated birth
    check('#9 impl born unestimated → P2 75%', { ev: 12.5, pct: 1, p2: 0.75, exec: 0 });

    // #10 estimate-impl agreed — propose (P2 67% mid), then agree → denom 28.5, EV% 43.9
    log.decompose(
      'F',
      [
        { node: 'F/impl-1', estimate: 8 },
        { node: 'F/impl-2', estimate: 6 },
      ],
      CLAUDE,
    );
    log.decompose('F', [{ node: 'F/review-impl', estimate: 2 }], CLAUDE);
    check('#10 mid: proposed → P2 67%', { ev: 12.5, pct: 1, p2: 6 / 9 });
    log.dep('F/design', 'F/impl-1', 'implemented');
    log.dep('F/design', 'F/impl-2', 'implemented');
    log.dep('F/impl-1', 'F/review-impl', 'implemented');
    log.dep('F/impl-2', 'F/review-impl', 'implemented');
    log.agree('F/impl-1', 8, TARO).agree('F/impl-2', 6, TARO).agree('F/review-impl', 2, TARO);
    check('#10 agreed → EV% 43.9% (honest)', { ev: 12.5, pct: 12.5 / 28.5, p2: 1, exec: 0 });

    // #11 impl completed — 43.9 → (exec 22%) → 71.9 → 93.0 → 100 real, F accepted
    log.life('F/impl-1', 'implementing', CLAUDE).life('F/impl-2', 'implementing', CLAUDE);
    check('#11 both implementing → exec 2/9', { ev: 12.5, pct: 12.5 / 28.5, exec: 2 / 9 });
    log.life('F/impl-1', 'implemented', CLAUDE);
    check('#11 impl-1 done → 71.9%', { ev: 20.5, pct: 20.5 / 28.5 });
    log.life('F/impl-2', 'implemented', CLAUDE);
    check('#11 impl-2 done → 93.0%', { ev: 26.5, pct: 26.5 / 28.5 });
    log.life('F/review-impl', 'implementing', TARO).life('F/review-impl', 'implemented', TARO);
    check('#11 impl review done → 100% real', { ev: 28.5, pct: 1, p2: 1 });
    log.life('F/impl-1', 'accepted', TARO).life('F/impl-2', 'accepted', TARO);
    log.life('F/review-impl', 'accepted', TARO).life('F', 'accepted', TARO);
    check('#11 all accepted + F accepted', { ev: 28.5, pct: 1, p2: 1, exec: 0 });

    const final = derive(log.all(), { asOf: ASOF, capacityOf: () => 1 });
    expect(final.nodeStates.find((n) => n.node === 'F')?.lifecycle).toBe('accepted');
  });
});
