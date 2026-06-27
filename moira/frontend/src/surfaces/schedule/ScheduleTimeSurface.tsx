// schedule-time — the "母 view". actor filter = KIND (全員/人間/エージェント);
// 「自分」is greyed (no viewpoint actor in backend, §0 #2). Unassigned backlog is
// a time-less lane (P0/R-U9). SPI is shown ONLY paired with scheduleCoverage and
// de-rated (R-S6) — never as whole-project progress.

import { useMemo, useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Bar, Card, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { labelOf } from '../../moira/labels';
import { buildGanttModel } from './gantt-geometry';
import { ScheduleGantt } from './ScheduleGantt';
import { Inspector } from './Inspector';
import type { NodeId } from '../../moira/engine';

type Kind = 'all' | 'human' | 'agent';

export function ScheduleTimeSurface() {
  const { projected, derived, asOf } = useMoira();
  const [kind, setKind] = useState<Kind>('all');
  const [selected, setSelected] = useState<NodeId | null>(null);

  const model = useMemo(() => buildGanttModel(projected, derived, kind), [projected, derived, kind]);

  const spi = derived.spi;
  const cov = derived.scheduleCoverage;

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16 }}>
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* actor kind filter + de-rate strip */}
        <Card pad={12}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: EVM.ink3 }}>キュー</span>
              {(['all', 'human', 'agent'] as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  data-testid={`queue-filter:${k}`}
                  style={{
                    fontSize: 11.5,
                    border: `1px solid ${kind === k ? EVM.brandDeep : EVM.rule}`,
                    background: kind === k ? EVM.brandSoft : EVM.paperWarm,
                    color: kind === k ? EVM.brandDeep : EVM.ink2,
                    borderRadius: 999,
                    padding: '3px 11px',
                    cursor: 'pointer',
                    fontWeight: kind === k ? 600 : 400,
                  }}
                >
                  {k === 'all' ? '全員' : k === 'human' ? '人間（レビュー/作業）' : 'エージェント'}
                </button>
              ))}
              <span
                title="視点 actor が backend に無いためブロッカー（§0 #2）。valid-time/視点 actor 拡張で解禁。"
                style={{ fontSize: 11.5, border: `1px dashed ${EVM.rule}`, background: EVM.ruleSoft, color: EVM.ink4, borderRadius: 999, padding: '3px 11px', cursor: 'not-allowed' }}
              >
                自分（backend拡張待ち）
              </span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 280 }}>
              <span data-testid="metric:spi" className="mono" style={{ fontSize: 13, color: spi === null ? EVM.na : EVM.ink }}>
                SPI {spi === null ? '算出不能' : spi.toFixed(2)}
              </span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: EVM.ink3 }}>
                  <span>スケジュールカバレッジ</span>
                  <span data-testid="metric:schedule-coverage" className="mono">{(cov * 100).toFixed(0)}%</span>
                </div>
                <Bar value={cov} tone="brand" derate={cov < 0.999} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 6 }}>
            SPI＝スケジュール済み領域内の進捗率（全体進捗ではない・R-S6）。低カバレッジ時は淡色 de-rate。
          </div>
        </Card>

        {/* unassigned backlog lane */}
        <Card pad={12}>
          <SectionTitle hint={<Pill tone="warn">P0 可視ギャップ</Pill>}>未割当バックログ（時間軸を持たない）</SectionTitle>
          {derived.unassignedBacklog.length === 0 ? (
            <div style={{ fontSize: 12, color: EVM.ink3 }}>未割当の agreed ノードはありません。</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {derived.unassignedBacklog.map((id) => (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  data-testid={`backlog-item:${id}`}
                  style={{ fontSize: 11.5, border: `1px solid ${EVM.rule}`, background: EVM.paperWarm, color: EVM.ink2, borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}
                >
                  {labelOf(id)}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* gantt */}
        <Card pad={10}>
          <SectionTitle hint="木×DAG 射影／凍結PMB ＋ 生きた予測（R-S7）">Gantt</SectionTitle>
          <ScheduleGantt model={model} asOf={asOf} selected={selected} onSelect={setSelected} />
        </Card>
      </div>

      <Inspector node={selected} />
    </div>
  );
}
