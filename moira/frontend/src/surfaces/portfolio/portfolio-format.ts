// Presentation formatting for the portfolio overview (issue #23). Pure — no
// derivation: buffer remaining is MODEL R-T6 date arithmetic over the derived
// landing date + the declared deadline (the same presentation arithmetic
// health/landing-verdict.ts does; that module is another surface's internals,
// so the 3-line dayDiff is re-implemented rather than crossing the surface
// boundary — precedent: moira/capacity.ts).

import type { IsoDate, LandingCurve } from '../../moira/engine';

export const dayDiff = (a: IsoDate, b: IsoDate): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type CellTone = 'ok' | 'crit' | 'na' | 'neutral';

export interface BufferCell {
  text: string;
  tone: CellTone;
}

/** バッファ残 = max(0, 期日 − 導出完了) — honest boundary cases, never a guess:
 *  no deadline → neutral「—」; no derived completion → 算出不能; overdue →
 *  0日＋超過幅 (R-T4 magnitude). */
export function bufferCell(
  landing: Pick<LandingCurve, 'landed' | 'landingDate'>,
  deadline: IsoDate | null,
): BufferCell {
  if (landing.landed) return { text: '完了', tone: 'ok' };
  if (deadline === null) return { text: '—（期限未設定）', tone: 'neutral' };
  if (landing.landingDate === null) return { text: '算出不能', tone: 'na' };
  const remaining = dayDiff(landing.landingDate, deadline);
  if (remaining < 0) return { text: `0日（${-remaining}日超過）`, tone: 'crit' };
  return { text: `${remaining}日`, tone: 'ok' };
}

export const fmtPct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/** SPI/CPI cells: null (undefined denominator) stays a visible「—」. */
export const fmtIndex = (v: number | null): string => (v === null ? '—' : v.toFixed(2));
