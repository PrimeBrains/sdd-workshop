// schedule-time Gantt — HTML rows + SVG overlay, ported from mockup/shared.jsx
// (487-747) and re-grounded in Moira semantics:
//   - indent = effective-tree depth (no `level` field; UI-DESIGN-BRIEF §0 #6)
//   - assignee shown as avatar+name ONLY (no skill/level — A4)
//   - agent rows visually distinct, no overload marker (A5/R-U11)
//   - TWO bars: frozen PMB band (dashed) + live EAC bar (solid) — PMB≠EAC (R-S7)
//   - lightning markers in THREE states; %-midpoint REMOVED (P1):
//       A scheduled-complete → marker at frozenSlot x (earned position)
//       B incomplete         → marker on the asOf line (nothing earned yet)
//       C complete-unscheduled → NOT on lightning; PV-excluded hatch band (R-S6)
//   - colour = predicted vs frozenSlot divergence (R-S7), not progress%

import { EVM } from '../../theme/tokens';
import { Avatar } from '../../theme/atoms';
import type { IsoDate, NodeId } from '../../moira/engine';
import { daysBetween, nominalDays, type GanttModel, type GanttRow } from './gantt-geometry';

const ROW_H = 26;
const HEAD_H = 30;
const LABEL_W = 250;

interface Props {
  model: GanttModel;
  asOf: IsoDate;
  selected: NodeId | null;
  onSelect: (node: NodeId) => void;
  dayW?: number;
}

type DivTone = 'behind' | 'ahead' | 'none';
function divergence(row: GanttRow): DivTone {
  if (row.frozenSlot !== null && row.predicted !== null) {
    if (row.predicted > row.frozenSlot) return 'behind';
    if (row.predicted < row.frozenSlot) return 'ahead';
  }
  return 'none';
}
const divColor: Record<DivTone, string> = {
  behind: EVM.behind,
  ahead: EVM.ahead,
  none: EVM.ink3,
};

export function ScheduleGantt({ model, asOf, selected, onSelect, dayW = 18 }: Props) {
  const { rows, start, totalDays } = model;
  const trackW = totalDays * dayW;
  const xOf = (d: IsoDate) => daysBetween(start, d) * dayW;
  const baseX = xOf(asOf);
  const rowsH = rows.length * ROW_H;

  // month ticks (1st of each month inside the window)
  const ticks: Array<{ x: number; label: string }> = [];
  {
    const startD = new Date(`${start}T00:00:00Z`);
    const d = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
    for (let i = 0; i < 24; i += 1) {
      const iso = d.toISOString().slice(0, 10);
      const x = daysBetween(start, iso) * dayW;
      if (x > trackW) break;
      if (x >= 0) ticks.push({ x, label: `${d.getUTCMonth() + 1}月` });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }

  // parent spans: descendants are the contiguous rows of greater depth (DFS order)
  const spanOf = (i: number): { x1: number; x2: number } | null => {
    const parent = rows[i]!;
    let x1 = Infinity;
    let x2 = -Infinity;
    for (let j = i + 1; j < rows.length && rows[j]!.depth > parent.depth; j += 1) {
      const r = rows[j]!;
      for (const dt of [r.frozenSlot, r.predicted]) {
        if (dt !== null) {
          x1 = Math.min(x1, xOf(dt) - nominalDays(r) * dayW);
          x2 = Math.max(x2, xOf(dt));
        }
      }
    }
    return x1 === Infinity ? null : { x1: Math.max(0, x1), x2 };
  };

  // lightning path over leaf rows that participate (states A and B)
  const pts: Array<{ x: number; y: number; tone: DivTone; filled: boolean }> = [];
  rows.forEach((r, i) => {
    if (!r.isLeaf) return;
    const y = i * ROW_H + ROW_H / 2;
    if (r.slotState === 'scheduled-complete' && r.frozenSlot !== null) {
      pts.push({ x: xOf(r.frozenSlot), y, tone: divergence(r), filled: true });
    } else if (r.slotState === 'incomplete') {
      pts.push({ x: baseX, y, tone: divergence(r), filled: false });
    }
  });
  let path = '';
  if (pts.length > 0) {
    path = `M ${baseX.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
    for (const p of pts) path += ` H ${p.x.toFixed(1)} H ${baseX.toFixed(1)} V ${p.y.toFixed(1)}`;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', width: LABEL_W + trackW, minWidth: '100%' }}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            height: HEAD_H,
            borderBottom: `1px solid ${EVM.rule}`,
            position: 'sticky',
            top: 0,
            background: EVM.card,
            zIndex: 4,
          }}
        >
          <div style={{ width: LABEL_W, flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', padding: '0 8px 4px', fontSize: 10.5, color: EVM.ink3, fontWeight: 600 }}>
            ノード（有効木）／担当
          </div>
          <div style={{ position: 'relative', flex: '1 1 auto' }}>
            {ticks.map((t) => (
              <div key={t.x} style={{ position: 'absolute', left: t.x, bottom: 4, fontSize: 10, color: EVM.ink3, borderLeft: `1px solid ${EVM.ruleSoft}`, paddingLeft: 3, height: HEAD_H - 6 }}>
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* rows */}
        <div style={{ position: 'relative' }}>
          {rows.map((r, i) => {
            const selectedRow = r.node === selected;
            const isAgent = r.kind === 'agent';
            return (
              <div
                key={r.node}
                data-testid={`gantt-row:${r.node}`}
                className="evm-row"
                onClick={() => onSelect(r.node)}
                style={{
                  display: 'flex',
                  height: ROW_H,
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: selectedRow ? EVM.brandWash : i % 2 === 0 ? EVM.card : EVM.paperWarm,
                  borderBottom: `1px solid ${EVM.ruleSoft}`,
                  outline: selectedRow ? `1.5px solid ${EVM.brandDeep}` : 'none',
                  outlineOffset: -1,
                }}
              >
                {/* label column */}
                <div
                  style={{
                    width: LABEL_W,
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: 8 + r.depth * 14,
                    paddingRight: 8,
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ color: EVM.ink4, fontSize: 10 }}>{r.isLeaf ? '·' : '▸'}</span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: r.isLeaf ? 400 : 600,
                      color: r.lifecycle === 'cancelled' ? EVM.ink4 : EVM.ink,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.label}
                  </span>
                  {r.assignee !== null && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Avatar actor={r.assignee} />
                    </span>
                  )}
                </div>

                {/* track column */}
                <div style={{ position: 'relative', flex: '1 1 auto', height: '100%' }}>
                  {/* parent span line */}
                  {!r.isLeaf &&
                    (() => {
                      const sp = spanOf(i);
                      if (sp === null) return null;
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            left: sp.x1,
                            width: Math.max(2, sp.x2 - sp.x1),
                            top: ROW_H / 2 - 1,
                            height: 2,
                            background: EVM.ink3,
                          }}
                        />
                      );
                    })()}

                  {/* frozen PMB band (dashed) */}
                  {r.isLeaf && r.frozenSlot !== null && (
                    <div
                      title={`凍結PV slot 完了 ${r.frozenSlot}`}
                      style={{
                        position: 'absolute',
                        left: xOf(r.frozenSlot) - nominalDays(r) * dayW,
                        width: nominalDays(r) * dayW,
                        top: 4,
                        height: ROW_H - 8,
                        borderRadius: 3,
                        border: `1px dashed ${EVM.ink4}`,
                        background: EVM.ruleSoft,
                      }}
                    />
                  )}

                  {/* live EAC bar (solid) */}
                  {r.isLeaf && r.predicted !== null && (
                    <div
                      title={`生きた予測 完了 ${r.predicted}`}
                      style={{
                        position: 'absolute',
                        left: xOf(r.predicted) - nominalDays(r) * dayW,
                        width: nominalDays(r) * dayW,
                        top: 6,
                        height: ROW_H - 12,
                        borderRadius: 3,
                        border: `1.5px solid ${isAgent ? EVM.agent : EVM.brandDeep}`,
                        background: r.completed
                          ? isAgent
                            ? '#dfe4d2'
                            : EVM.brandSoft
                          : isAgent
                            ? 'repeating-linear-gradient(135deg,#e7ebdd 0 4px,#fbf9f2 4px 8px)'
                            : EVM.card,
                      }}
                    />
                  )}

                  {/* state C: completed but frozenSlot = null → PV-excluded gap */}
                  {r.isLeaf && r.slotState === 'complete-unscheduled' && (
                    <div
                      title="完了・未スケジュール（PVに載らない可視ギャップ R-S6）"
                      style={{
                        position: 'absolute',
                        left: Math.max(0, baseX - nominalDays(r) * dayW),
                        width: nominalDays(r) * dayW,
                        top: 5,
                        height: ROW_H - 10,
                        borderRadius: 3,
                        border: `1px solid ${EVM.crit}`,
                        background: 'repeating-linear-gradient(45deg,#f1d5c8 0 4px,#fbf9f2 4px 8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8.5,
                        color: EVM.crit,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      PV不算入
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* SVG overlay: base line + lightning + markers */}
          <svg
            width={trackW}
            height={rowsH}
            style={{ position: 'absolute', left: LABEL_W, top: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            {/* asOf base line */}
            <line x1={baseX} x2={baseX} y1={0} y2={rowsH} stroke="rgba(91,142,193,0.5)" strokeWidth={1} strokeDasharray="3 3" />
            <rect x={baseX - 20} y={-2} width={40} height={13} rx={3} fill={EVM.brandSoft} />
            <text x={baseX} y={8} textAnchor="middle" style={{ fontSize: 9, fill: EVM.brandDeep }}>基準日</text>
            {/* lightning */}
            {path !== '' && <path d={path} fill="none" stroke={EVM.ink3} strokeWidth={1.5} opacity={0.55} />}
            {pts.map((p, k) => (
              <circle
                key={k}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={p.filled ? divColor[p.tone] : EVM.card}
                stroke={divColor[p.tone]}
                strokeWidth={1.5}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '8px 4px 2px', fontSize: 10.5, color: EVM.ink3 }}>
        <span>破線帯=凍結PV slot（PMB）</span>
        <span>実線バー=生きた予測（EAC）</span>
        <span style={{ color: EVM.behind }}>● 遅れ（予測 &gt; 凍結）</span>
        <span style={{ color: EVM.ahead }}>● 先行（予測 &lt; 凍結）</span>
        <span>○ 未完=基準日上 / ●塗り=完了は凍結slot位置</span>
        <span style={{ color: EVM.crit }}>▨ PV不算入（完了・未スケジュール）</span>
        <span>稲妻線の点は導出のみ・部分クレジット無し（P1）</span>
      </div>
    </div>
  );
}
