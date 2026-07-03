// Landing-forecast burnup (issue #13) — 計画(PMB) / 実績 / 予想 の3階段曲線と
// 期限・目標日・基準日の縦線、着地判定。データは store の computeLandingCurve
// 一回導出（R-S2 同規律）を描くだけで、この面では何も再計算しない。
// 描画規律: H/V の階段パスのみ（スプライン・補間は禁止 — 実点表示の正直性）。
// 期限が曲線終端より後のときは最終値を水平ホールドで延長する（事実の保持であって
// 補間ではない）。予測不能な残作業は曲線に載せず、カバレッジ注記で開示する
// （MODEL:237 の de-rate 規律・P0 可視ギャップ）。

import { EVM } from '../../theme/tokens';
import { Card, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { verdictOf } from './landing-verdict';
import type { IsoDate } from '../../moira/engine';

const W = 640;
const H = 210;
const M = { l: 44, r: 46, t: 12, b: 26 };

const dayIndex = (from: IsoDate, d: IsoDate): number =>
  Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

interface Pt {
  x: number;
  y: number;
}

/** Step path: horizontal-then-vertical segments only (no interpolation). */
const stepPath = (pts: readonly Pt[]): string =>
  pts.length === 0
    ? ''
    : pts
        .slice(1)
        .reduce(
          (p, q) => `${p} H ${q.x.toFixed(1)} V ${q.y.toFixed(1)}`,
          `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`,
        );

export function LandingChart() {
  const { landing, deadline, targetDate } = useMoira();
  const verdict = verdictOf(landing, deadline, targetDate);

  const from = landing.points[0]?.date ?? landing.asOf;
  const lastDate = landing.points[landing.points.length - 1]?.date ?? landing.asOf;
  let xEnd = lastDate;
  if (deadline !== null && deadline > xEnd) xEnd = deadline;
  if (targetDate !== null && targetDate > xEnd) xEnd = targetDate;
  const totalDays = Math.max(1, dayIndex(from, xEnd));

  let yMax = Math.max(landing.bac, 1);
  for (const p of landing.points) {
    yMax = Math.max(yMax, p.pv, p.ev ?? 0, p.forecast ?? 0);
  }

  const x = (d: IsoDate): number => M.l + ((W - M.l - M.r) * dayIndex(from, d)) / totalDays;
  const y = (v: number): number => H - M.b - ((H - M.t - M.b) * v) / yMax;

  const pvPts: Pt[] = landing.points.map((p) => ({ x: x(p.date), y: y(p.pv) }));
  const evPts: Pt[] = landing.points
    .filter((p) => p.ev !== null)
    .map((p) => ({ x: x(p.date), y: y(p.ev!) }));
  const fcPts: Pt[] = landing.points
    .filter((p) => p.forecast !== null)
    .map((p) => ({ x: x(p.date), y: y(p.forecast!) }));
  // horizontal HOLD of the final value out to the window end (a held fact, not interpolation)
  if (xEnd > lastDate) {
    const last = landing.points[landing.points.length - 1];
    if (last !== undefined) {
      pvPts.push({ x: x(xEnd), y: y(last.pv) });
      if (last.forecast !== null) fcPts.push({ x: x(xEnd), y: y(last.forecast) });
    }
  }

  const vline = (d: IsoDate, color: string, dash: string | undefined, label: string) => (
    <g key={`${label}:${d}`}>
      <line
        x1={x(d)}
        y1={M.t}
        x2={x(d)}
        y2={H - M.b}
        stroke={color}
        strokeWidth={1.2}
        {...(dash !== undefined ? { strokeDasharray: dash } : {})}
      />
      <text x={x(d) + 3} y={M.t + 9} fontSize={9.5} fill={color}>
        {label}
      </text>
    </g>
  );

  const landingX = landing.landingDate !== null ? x(landing.landingDate) : null;
  const landingY =
    landing.landingDate !== null && fcPts.length > 0 ? fcPts[fcPts.length - 1]!.y : null;

  return (
    <Card style={{ flex: '1 1 460px' }} testid="landing-chart">
      <SectionTitle
        hint={
          <Pill tone={verdict.tone} testid="landing-verdict">
            {verdict.label}
            {verdict.deRated ? '＊' : ''}
          </Pill>
        }
      >
        着地予想（バーンアップ）
      </SectionTitle>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: EVM.ink2, marginBottom: 6 }}>
        <span>
          着地予想: <b data-testid="landing-date">{landing.landingDate ?? '—'}</b>
        </span>
        <span>
          期限: <b>{deadline ?? '未設定'}</b>
        </span>
        {targetDate !== null && (
          <span>
            目標日: <b>{targetDate}</b>
          </span>
        )}
        <span>
          BAC: <b>{landing.bac.toFixed(0)} MD</b>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img">
        <title>着地予想バーンアップ — 計画・実績・予想の階段曲線</title>
        {/* grid: BAC の 0%・50%・100% 水平線 */}
        {landing.bac > 0 &&
          [0, landing.bac / 2, landing.bac].map((v, i) => (
            <g key={i}>
              <line x1={M.l} y1={y(v)} x2={W - M.r} y2={y(v)} stroke={EVM.ruleSoft} strokeWidth={1} />
              <text x={M.l - 5} y={y(v) + 3} fontSize={9.5} fill={EVM.ink3} textAnchor="end">
                {v.toFixed(0)}
              </text>
              <text x={W - M.r + 5} y={y(v) + 3} fontSize={9.5} fill={EVM.ink4}>
                {`${Math.round((v / landing.bac) * 100)}%`}
              </text>
            </g>
          ))}
        {/* x axis */}
        <line x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} stroke={EVM.rule} strokeWidth={1} />
        <text x={M.l} y={H - M.b + 14} fontSize={9.5} fill={EVM.ink3}>
          {from}
        </text>
        <text x={W - M.r} y={H - M.b + 14} fontSize={9.5} fill={EVM.ink3} textAnchor="end">
          {xEnd}
        </text>

        {/* reference verticals */}
        {vline(landing.asOf, EVM.ink3, '3 3', '基準日')}
        {deadline !== null && deadline >= from && vline(deadline, EVM.crit, undefined, '期限')}
        {targetDate !== null && targetDate >= from && vline(targetDate, EVM.brandDeep, '4 3', '目標日')}

        {/* curves: 計画(PMB) / 実績 / 予想 — step paths only */}
        <path d={stepPath(pvPts)} fill="none" stroke={EVM.ink3} strokeWidth={1.2} />
        <path d={stepPath(evPts)} fill="none" stroke={EVM.ahead} strokeWidth={2} />
        <path d={stepPath(fcPts)} fill="none" stroke={EVM.behind} strokeWidth={1.6} strokeDasharray="5 3" />

        {/* landing marker on the forecast curve */}
        {landingX !== null && landingY !== null && (
          <g>
            <circle cx={landingX} cy={landingY} r={3.5} fill={EVM.behind} />
            <text x={landingX + 5} y={landingY - 5} fontSize={9.5} fill={EVM.behind}>
              着地予想
            </text>
          </g>
        )}
      </svg>

      {/* legend + honesty notes */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 10.5, color: EVM.ink3, marginTop: 6 }}>
        <span>
          <span style={{ borderBottom: `2px solid ${EVM.ink3}`, paddingInline: 8 }} /> 計画（PMB）
        </span>
        <span>
          <span style={{ borderBottom: `3px solid ${EVM.ahead}`, paddingInline: 8 }} /> 実績（EV）
        </span>
        <span>
          <span style={{ borderBottom: `2px dashed ${EVM.behind}`, paddingInline: 8 }} /> 予想（EAC）
        </span>
      </div>
      {landing.unforecastedLeaves.length > 0 && (
        <div data-testid="landing-caveat" style={{ fontSize: 10.5, color: EVM.warn, marginTop: 6 }}>
          ＊予想線は残作業 {landing.unforecastedLeaves.length} 件（未スケジュール/見積未合意）を含みません
          （予測カバレッジ {Math.round(landing.forecastCoverage * 100)}%）。
        </div>
      )}
      <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 6 }}>
        曲線は階段状の実点表示（補間なし）。実績線は各日時点のイベントログからの再導出値
        （記録時刻ベース）。予想線は生きた予測（各残作業の予測完了日に凍結予算を計上）。
        CCPM フィーバーチャートは将来対応。
      </div>
    </Card>
  );
}
