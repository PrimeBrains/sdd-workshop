// 人横断 — the same Actor.id juxtaposed across projects (issue #23):
// active work / review waits / upcoming scheduled dates / declared capacity,
// with same-day multi-project markers（取り合いの見える化）. VISIBILITY ONLY —
// nothing is enforced or leveled (D-50); the disclosure banner is permanent.

import { useMemo } from 'react';
import { EVM } from '../../theme/tokens';
import { usePortfolio } from '../../moira/hooks';
import { computePersonOverlap, type PersonOverlapRow } from './person-overlap';

const WINDOW_DAYS = 14;

export function PersonView() {
  const { projects, asOf } = usePortfolio();
  const rows = useMemo(() => {
    const ok = projects.flatMap((p) => (p.kind === 'ok' ? [p.data] : []));
    return computePersonOverlap(ok, asOf, WINDOW_DAYS);
  }, [projects, asOf]);

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>人横断（掛け持ちの見える化）</div>

      {/* permanent disclosure — the D-50 line this view must never cross */}
      <div
        data-testid="person-view-disclosure"
        style={{
          fontSize: 11.5,
          color: EVM.ink2,
          background: EVM.paperWarm,
          border: `1px solid ${EVM.rule}`,
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 14,
          lineHeight: 1.7,
        }}
      >
        本ビューは見える化のみ。複数案件にわたる容量整合の強制・平準化は行いません（D-50）。
        人の同定は Actor.id の一致のみです — 案件ごとに別 id の同一人物は合流せず、同じ id の別人は混ざります。
        宣言容量の合計は明示的に宣言された c(i,d) のみ（未宣言日を 1.0 と見なして合算しません）。
        対象期間: 基準日から {WINDOW_DAYS} 日間。
      </div>

      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: EVM.ink3 }}>
          表示できる要員がいません（割当・レビュー担当・名簿・容量宣言のいずれも無し）。
        </div>
      )}

      {rows.map((r) => (
        <PersonCard key={r.actorId} row={r} />
      ))}
    </div>
  );
}

function PersonCard({ row }: { row: PersonOverlapRow }) {
  const multi = row.slices.length >= 2;
  return (
    <div
      data-testid={`person-row:${row.actorId}`}
      style={{
        background: EVM.card,
        border: `1px solid ${EVM.rule}`,
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          {row.displayNames.length > 0 ? row.displayNames.join(' / ') : row.actorId}
        </span>
        <span style={{ fontSize: 10.5, fontFamily: EVM.fontMono, color: EVM.ink3 }}>{row.actorId}</span>
        <span style={{ fontSize: 10.5, color: EVM.ink3 }}>{row.kinds.join('・')}</span>
        <span
          style={{
            fontSize: 10.5,
            color: multi ? EVM.brandDeep : EVM.ink3,
            fontWeight: multi ? 600 : 400,
          }}
        >
          {row.slices.length}案件
        </span>
        {row.overlapDates.length > 0 && (
          <span
            data-testid={`person-overlap:${row.actorId}`}
            style={{
              fontSize: 10.5,
              color: EVM.crit,
              background: EVM.critSoft,
              borderRadius: 999,
              padding: '2px 10px',
              fontWeight: 600,
            }}
          >
            同日複数案件: {row.overlapDates.join(', ')}
          </span>
        )}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
        <tbody>
          {row.slices.map((s) => (
            <tr key={s.projectKey}>
              <td style={{ fontSize: 11.5, fontWeight: 600, color: EVM.ink2, padding: '4px 10px 4px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                {s.projectLabel}
                {s.displayName !== null && (
                  <span style={{ color: EVM.ink4, fontWeight: 400 }}>（{s.displayName}）</span>
                )}
              </td>
              <td style={{ fontSize: 11.5, color: EVM.ink2, padding: '4px 0', lineHeight: 1.7 }}>
                実行中 {s.implementing.length > 0 ? s.implementing.join(' / ') : '—'}
                <span style={{ color: EVM.ink4 }}>｜</span>
                レビュー待ち {s.reviewWait.length > 0 ? s.reviewWait.join(' / ') : '—'}
                <span style={{ color: EVM.ink4 }}>｜</span>
                予定日{' '}
                <span style={{ fontFamily: EVM.fontMono, fontSize: 10.5 }}>
                  {s.scheduledDates.length > 0 ? s.scheduledDates.join(', ') : '—'}
                </span>
                <span style={{ color: EVM.ink4 }}>｜</span>
                宣言容量 Σ{' '}
                <span style={{ fontFamily: EVM.fontMono, fontSize: 10.5 }}>
                  {s.declaredDays > 0 ? `${s.declaredCapacitySum.toFixed(1)}（${s.declaredDays}日分）` : '宣言なし'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
