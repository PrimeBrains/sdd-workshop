// Verdict over the landing forecast vs the R-T6 reference dates (issue #13).
// Pure — unit-testable without a DOM. Implements MODEL:238's boundary cases
// faithfully: no deadline → undefined/neutral; target > deadline → CONFIG
// ERROR (the write path records it and warns — the system never rejects a
// human's declared dates); no D_pred → visible gap, never a guess. The
// 間に合わない branch carries the R-T4 overrun magnitude (導出完了 − 期日,
// MODEL:351-352) so a change in the amount reads as new information.

import type { IsoDate, LandingCurve } from '../../moira/engine';

export type VerdictTone = 'ok' | 'warn' | 'crit' | 'na' | 'neutral';

export interface LandingVerdict {
  label: string;
  tone: VerdictTone;
  /** forecastCoverage < 1 — the read is de-rated (R-S6-isomorphic; MODEL:237). */
  deRated: boolean;
}

const dayDiff = (a: IsoDate, b: IsoDate): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function verdictOf(
  landing: Pick<LandingCurve, 'landed' | 'landingDate' | 'forecastCoverage'>,
  deadline: IsoDate | null,
  target: IsoDate | null,
): LandingVerdict {
  const deRated = landing.forecastCoverage < 1;
  if (landing.landed) {
    return { label: '完了（残作業なし）', tone: 'ok', deRated: false };
  }
  if (landing.landingDate === null) {
    // no D_pred at all — uncomputable, surfaced as a gap (MODEL:238, P0)
    return { label: '算出不能（スケジュール済みの残作業なし）', tone: 'na', deRated };
  }
  if (deadline === null) {
    return { label: '期限未設定（moira deadline で設定）', tone: 'neutral', deRated };
  }
  if (target !== null && target > deadline) {
    return { label: '構成エラー（目標日が期限より後）— 判定不能', tone: 'na', deRated };
  }
  const land = landing.landingDate;
  if (land > deadline) {
    return { label: `間に合わない（${dayDiff(deadline, land)}日超過）`, tone: 'crit', deRated };
  }
  const slack = dayDiff(land, deadline);
  if (target !== null) {
    return land <= target
      ? { label: `余裕（期限まで${slack}日）`, tone: 'ok', deRated }
      : { label: `ギリギリ（期限まで${slack}日）`, tone: 'warn', deRated };
  }
  // no target: remaining slack is computable, 余裕/ギリギリ の線引きは不能 (MODEL:238)
  return { label: `期限内（期限まで${slack}日）`, tone: 'ok', deRated };
}
