// activity — the history surface (新規). A read-only projection of the append-only
// event log: it renders derived.activityLog (computed once in derive(), like every
// other metric — it does NOT re-derive or read events directly), so the single-seam
// discipline holds. Each row is one event, in chronological (ts,id) order: who did
// what to which node. This is where the backbone's narrative reads as a timeline —
// 「見積を承認」「作成完了」「差し戻し」「承認」「フィーチャー完了」.

import { EVM } from '../../theme/tokens';
import { Avatar, Card, Pill, SectionTitle, type Tone } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { labelOf } from '../../moira/labels';
import type { ActivityRow } from '../../moira/engine';

// label → tone, so the timeline double-encodes the kind of change (color + text).
function toneFor(row: ActivityRow): Tone {
  if (row.label.startsWith('差し戻し')) return 'crit';
  if (row.label === '承認' || row.label.includes('見積を承認')) return 'ok';
  if (row.label === '作成完了（レビュー待ち）') return 'brand';
  if (row.label === '着手' || row.label === '準備完了') return 'warn';
  if (row.kind === 'cost') return 'na';
  return 'neutral';
}

export function ActivitySurface() {
  const { derived } = useMoira();
  const rows = derived.activityLog;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      <Card>
        <SectionTitle hint="append-only イベントログの読み射影（who / what / which node・時系列）">
          活動履歴（activity）
        </SectionTitle>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: EVM.ink4 }}>まだ活動はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row) => (
              <div
                key={row.id}
                data-testid={`activity-row:${row.id}`}
                className="evm-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 6px',
                  borderBottom: `1px solid ${EVM.ruleSoft}`,
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, color: EVM.ink4, minWidth: 28, textAlign: 'right' }}>
                  {row.ts}
                </span>
                <Avatar actor={row.actor} />
                <Pill tone={toneFor(row)}>{row.label}</Pill>
                {row.node !== null && (
                  <span style={{ fontSize: 12, color: EVM.ink2 }}>{labelOf(row.node)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
