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
//   - frozen panes (issues #30/#31): the chart is a two-axis internal scroll box so
//     the task-name/assignee column sticks left and the date header sticks top.

import { useRef, useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Avatar } from '../../theme/atoms';
import type { DependencyEdge, IsoDate, NodeId } from '../../moira/engine';
import {
  buildAxisTicks,
  daysBetween,
  depSegments,
  divergence,
  nominalDays,
  type DivTone,
  type GanttModel,
} from './gantt-geometry';

const ROW_H = 26;
const HEAD_H = 30;
const DEFAULT_LABEL_W = 250; // task-name column width (issue #26)
// raised from 140 (issue #34): the label column now also carries the 3 fixed
// planned-metrics cells (132px total), so the floor keeps the name section legible.
const MIN_LABEL_W = 220;
const MAX_LABEL_W = 640;
const LABEL_W_KEY = 'moira.schedule.labelW';

// planned metrics sub-columns (issue #34) — fixed-width, non-resizable (v1),
// carved out of the (resizable) label column. Header + row cells share these
// same widths so the two rows line up.
const COST_COL_W = 48;
const DATE_COL_W = 42;

/** Short M/D date label (matches buildAxisTicks' week-tick convention — the
 * codebase's existing compact date format; the Gantt's label pane has no room
 * for a full ISO date). */
function fmtShortDate(iso: IsoDate): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** Planned cost (MD), same toFixed(0) convention as the other MD rollups
 * (LandingChart's BAC, HealthSurface's EV/PV/AC). null → '—' (existing
 * placeholder convention, e.g. Inspector's Field). */
function fmtCost(v: number | null): string {
  return v === null ? '—' : v.toFixed(0);
}

const EMPTY_SET: ReadonlySet<NodeId> = new Set();
const EMPTY_EDGES: readonly DependencyEdge[] = [];

function clampLabelW(w: number): number {
  return Math.min(MAX_LABEL_W, Math.max(MIN_LABEL_W, Math.round(w)));
}
function readLabelW(): number {
  try {
    const raw = localStorage.getItem(LABEL_W_KEY);
    // No saved preference at all → DEFAULT_LABEL_W (not clampLabelW(0), which
    // would land on MIN_LABEL_W and silently invent a "saved" width no user
    // ever chose). A saved value out of the CURRENT [MIN,MAX] range (e.g. a
    // pre-issue-#34 140–219px width, before MIN_LABEL_W was raised 140→220) is
    // CLAMPED into range, not discarded to the default — the user's resize
    // intent (narrower/wider than default) still holds, just bounded.
    if (raw === null) return DEFAULT_LABEL_W;
    const v = Number(raw);
    if (Number.isFinite(v)) return clampLabelW(v);
  } catch { /* localStorage unavailable (node/test) */ }
  return DEFAULT_LABEL_W;
}
function writeLabelW(w: number): void {
  try {
    localStorage.setItem(LABEL_W_KEY, String(w));
  } catch { /* localStorage unavailable (node/test) */ }
}

interface Props {
  model: GanttModel;
  asOf: IsoDate;
  selected: NodeId | null;
  onSelect: (node: NodeId) => void;
  /**
   * Nodes on the P7 dependency longest chain (critical path, issue #16) —
   * derived in the store, projected here read-only. Empty when the chain does
   * not cross a dependency edge (a single node is not a chain).
   */
  cpSet?: ReadonlySet<NodeId>;
  dayW?: number;
  /** Dependency edges (issue #29) — drawn as finish-to-start connectors when
   * `showDeps`. Pass projected.dependencyEdges as-is. */
  edges?: readonly DependencyEdge[];
  showWeeks?: boolean; // week gridlines (issue #28) — default on
  showDays?: boolean; // day gridlines (issue #28) — default off
  showDeps?: boolean; // dependency connectors (issue #29) — default off
}

const divColor: Record<DivTone, string> = {
  behind: EVM.behind,
  ahead: EVM.ahead,
  none: EVM.ink3,
};

export function ScheduleGantt({
  model,
  asOf,
  selected,
  onSelect,
  cpSet = EMPTY_SET,
  dayW = 18,
  edges = EMPTY_EDGES,
  showWeeks = true,
  showDays = false,
  showDeps = false,
}: Props) {
  const { rows, start, totalDays } = model;
  const trackW = totalDays * dayW;
  const xOf = (d: IsoDate) => daysBetween(start, d) * dayW;
  const baseX = xOf(asOf);
  const rowsH = rows.length * ROW_H;

  // resizable task-name column (issue #26) — width is component state, persisted
  // per browser; a drag handle on the column boundary sets it (dbl-click resets).
  const [labelW, setLabelW] = useState<number>(readLabelW);
  const drag = useRef<{ startX: number; startW: number; latest: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, startW: labelW, latest: labelW };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d === null) return;
    const next = clampLabelW(d.startW + (e.clientX - d.startX));
    d.latest = next;
    setLabelW(next);
  };
  const endResize = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d === null) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    writeLabelW(d.latest);
  };
  const resetResize = () => {
    setLabelW(DEFAULT_LABEL_W);
    writeLabelW(DEFAULT_LABEL_W);
  };

  // date-axis ticks (issue #28) & dependency connectors (issue #29)
  const ticks = buildAxisTicks(start, totalDays, dayW, { weeks: showWeeks, days: showDays });
  const segments = showDeps ? depSegments(rows, edges, start, dayW, cpSet) : [];

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
    <div>
      {/* two-axis internal scroll box (issues #30/#31): bounding the height gives the
          sticky date header a vertical scroll container to stick against, and the
          same overflow box lets the label column stick left on horizontal scroll. */}
      <div
        data-testid="gantt-scroll"
        style={{ overflow: 'auto', maxHeight: 'max(260px, calc(100vh - 300px))' }}
      >
        <div style={{ position: 'relative', width: labelW + trackW, minWidth: '100%' }}>
          {/* task-name column resizer (issue #26) — drag to widen, dbl-click resets.
              A zero-size sticky anchor placed FIRST (its natural flow position is the
              top-left origin) stays pinned to the frozen column boundary during
              horizontal/vertical scroll (issues #30/#31); the child spans the full
              height as a grab strip. Placed last, its natural position would be the
              content BOTTOM, so sticky-top would only pin it after scrolling down. */}
          <div style={{ position: 'sticky', top: 0, left: 0, width: 0, height: 0, zIndex: 7 }}>
            <div
              data-testid="gantt-col-resizer"
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onDoubleClick={resetResize}
              title="ドラッグでタスク名列の幅を変更 ／ ダブルクリックで既定に戻す"
              style={{
                position: 'absolute',
                left: labelW - 3,
                top: 0,
                width: 6,
                height: HEAD_H + rowsH,
                cursor: 'col-resize',
                zIndex: 7,
                touchAction: 'none',
              }}
            />
          </div>
          {/* header — sticks top (issue #31) */}
          <div
            data-testid="gantt-date-header"
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
            {/* frozen corner: sticks top AND left (issues #30/#31); opaque bg + z above
                the track ticks so labels sliding under it are covered. Split into the
                (resizable) name section + 3 fixed planned-metrics sub-headers (issue
                #34), matching the row label cell's layout below so columns line up. */}
            <div
              data-testid="gantt-corner"
              style={{
                width: labelW,
                flex: '0 0 auto',
                position: 'sticky',
                left: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'flex-end',
                fontSize: 10.5,
                color: EVM.ink3,
                fontWeight: 600,
                background: EVM.card,
                borderRight: `1px solid ${EVM.ruleSoft}`,
              }}
            >
              <div style={{ flex: '1 1 auto', minWidth: 0, padding: '0 8px 4px', overflow: 'hidden' }}>
                ノード（有効木）／担当
              </div>
              <div
                data-testid="gantt-col-head:cost"
                style={{ flex: '0 0 auto', width: COST_COL_W, padding: '0 4px 4px', textAlign: 'right' }}
              >
                工数
              </div>
              <div
                data-testid="gantt-col-head:start"
                style={{ flex: '0 0 auto', width: DATE_COL_W, padding: '0 4px 4px', textAlign: 'right' }}
              >
                開始
              </div>
              <div
                data-testid="gantt-col-head:end"
                style={{ flex: '0 0 auto', width: DATE_COL_W, padding: '0 8px 4px', textAlign: 'right' }}
              >
                終了
              </div>
            </div>
            <div style={{ position: 'relative', flex: '1 1 auto' }}>
              {ticks.map((t) =>
                t.kind === 'day' ? null : (
                  <div
                    key={`${t.kind}-${t.x}`}
                    style={{
                      position: 'absolute',
                      left: t.x,
                      bottom: 4,
                      fontSize: t.kind === 'month' ? 10 : 9,
                      color: t.kind === 'month' ? EVM.ink3 : EVM.ink4,
                      borderLeft: `1px solid ${t.kind === 'month' ? EVM.ruleSoft : EVM.rule}`,
                      paddingLeft: 3,
                      height: t.kind === 'month' ? HEAD_H - 6 : HEAD_H - 15,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* rows */}
          <div style={{ position: 'relative' }}>
            {rows.map((r, i) => {
              const selectedRow = r.node === selected;
              const isAgent = r.kind === 'agent';
              // dim done rows always; dim ancestor-scaffolding rows harder (issue #8)
              const opacity = r.contextOnly ? 0.5 : r.completed ? 0.55 : 1;
              const onCp = cpSet.has(r.node);
              // row background — reused by the sticky-left label cell so it stays
              // opaque over the track when scrolled horizontally (issue #30).
              const rowBg = selectedRow ? EVM.brandWash : i % 2 === 0 ? EVM.card : EVM.paperWarm;
              return (
                <div
                  key={r.node}
                  data-testid={`gantt-row:${r.node}`}
                  data-context-only={r.contextOnly ? 'true' : undefined}
                  data-critical-path={onCp ? 'true' : undefined}
                  className="evm-row"
                  onClick={() => onSelect(r.node)}
                  title={r.contextOnly ? '絞り込みの文脈として表示（祖先）' : undefined}
                  style={{
                    display: 'flex',
                    height: ROW_H,
                    alignItems: 'center',
                    cursor: 'pointer',
                    opacity,
                    background: rowBg,
                    borderBottom: `1px solid ${EVM.ruleSoft}`,
                    outline: selectedRow ? `1.5px solid ${EVM.brandDeep}` : 'none',
                    outlineOffset: -1,
                  }}
                >
                  {/* label column — sticks left (issue #30). Internally split into the
                      (resizable) name section + 3 fixed planned-metrics cells (issue #34:
                      予定工数・予定開始・予定終了) — ONE sticky boundary still, per #30/#31. */}
                  <div
                    style={{
                      width: labelW,
                      flex: '0 0 auto',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: rowBg,
                      display: 'flex',
                      alignItems: 'center',
                      borderRight: `1px solid ${EVM.ruleSoft}`,
                    }}
                  >
                    <div
                      style={{
                        flex: '1 1 auto',
                        minWidth: 0,
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
                    <span
                      data-testid={`gantt-col:cost:${r.node}`}
                      title={r.plannedCost === null ? undefined : `予定工数（合計） ${r.plannedCost} MD`}
                      className="mono"
                      style={{
                        flex: '0 0 auto',
                        width: COST_COL_W,
                        padding: '0 4px',
                        textAlign: 'right',
                        fontSize: 10.5,
                        color: r.plannedCost === null ? EVM.ink4 : EVM.ink2,
                      }}
                    >
                      {fmtCost(r.plannedCost)}
                    </span>
                    <span
                      data-testid={`gantt-col:start:${r.node}`}
                      title={r.plannedStart === null ? undefined : `予定開始 ${r.plannedStart}`}
                      className="mono"
                      style={{
                        flex: '0 0 auto',
                        width: DATE_COL_W,
                        padding: '0 4px',
                        textAlign: 'right',
                        fontSize: 10.5,
                        color: r.plannedStart === null ? EVM.ink4 : EVM.ink2,
                      }}
                    >
                      {r.plannedStart === null ? '—' : fmtShortDate(r.plannedStart)}
                    </span>
                    <span
                      data-testid={`gantt-col:end:${r.node}`}
                      title={r.plannedEnd === null ? undefined : `予定終了 ${r.plannedEnd}`}
                      className="mono"
                      style={{
                        flex: '0 0 auto',
                        width: DATE_COL_W,
                        padding: '0 8px 0 4px',
                        textAlign: 'right',
                        fontSize: 10.5,
                        color: r.plannedEnd === null ? EVM.ink4 : EVM.ink2,
                      }}
                    >
                      {r.plannedEnd === null ? '—' : fmtShortDate(r.plannedEnd)}
                    </span>
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
                        title={`基準完了日（ベースライン） ${r.frozenSlot}`}
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

                    {/* live EAC bar (solid); critical-path nodes get an outline (issue #16) */}
                    {r.isLeaf && r.predicted !== null && (
                      <div
                        title={
                          onCp
                            ? `生きた予測 完了 ${r.predicted} ／ クリティカルパス上（critical path = dependency longest chain・依存のつながりで最長の経路。同一担当者の詰まりによる律速は含みません）`
                            : `生きた予測 完了 ${r.predicted}`
                        }
                        style={{
                          position: 'absolute',
                          left: xOf(r.predicted) - nominalDays(r) * dayW,
                          width: nominalDays(r) * dayW,
                          top: 6,
                          height: ROW_H - 12,
                          borderRadius: 3,
                          outline: onCp ? `2px solid ${EVM.crit}` : 'none',
                          outlineOffset: 1.5,
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
                        title="完了・未スケジュール（PVに算入されません）"
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

            {/* SVG overlay: gridlines + dependency connectors + base line + lightning + markers */}
            <svg
              width={trackW}
              height={rowsH}
              style={{ position: 'absolute', left: labelW, top: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
              {/* date-axis gridlines (issue #28) — drawn FIRST so bars/asOf/lightning
                  paint over them; month > week > day in weight */}
              {ticks.map((t) => (
                <line
                  key={`grid-${t.kind}-${t.x}`}
                  x1={t.x}
                  x2={t.x}
                  y1={0}
                  y2={rowsH}
                  stroke={EVM.ink3}
                  strokeWidth={1}
                  opacity={t.kind === 'month' ? 0.18 : t.kind === 'week' ? 0.12 : 0.06}
                />
              ))}
              {/* dependency connectors (issue #29) — finish→start elbows, opt-in.
                  Arrowhead points into the successor bar's left edge; edges on the
                  critical path are emphasised (issue #16 colour). */}
              {showDeps &&
                segments.map((s) => {
                  const y1 = s.fromRow * ROW_H + ROW_H / 2;
                  const y2 = s.toRow * ROW_H + ROW_H / 2;
                  const midX = Math.max(s.fromX + 8, s.toX - 8);
                  const color = s.onCp ? EVM.crit : EVM.ink3;
                  return (
                    <g key={`dep-${s.from}-${s.to}`} opacity={s.onCp ? 0.9 : 0.55}>
                      <path
                        d={`M ${s.fromX} ${y1} H ${midX} V ${y2} H ${s.toX}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={s.onCp ? 1.6 : 1.2}
                        strokeDasharray="4 3"
                      />
                      <path d={`M ${s.toX} ${y2} l -5 -3 l 0 6 z`} fill={color} />
                    </g>
                  );
                })}
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
      </div>

      {/* legend — kept OUTSIDE the scroll box so it stays visible below the chart */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '8px 4px 2px', fontSize: 10.5, color: EVM.ink3 }}>
        <span>破線帯=計画（PMB・基準完了日）</span>
        <span>実線バー=生きた予測（EAC）</span>
        <span style={{ color: EVM.behind }}>● 遅れ（予測 &gt; 凍結）</span>
        <span style={{ color: EVM.ahead }}>● 先行（予測 &lt; 凍結）</span>
        <span>○ 未完=基準日上 / ●塗り=完了は凍結slot位置</span>
        {showDeps && <span>⇢ 依存（先行→後続・破線）</span>}
        <span style={{ color: EVM.crit }}>▨ PV不算入（完了・未スケジュール）</span>
        {cpSet.size > 0 && (
          <span
            style={{ color: EVM.crit }}
            title="critical path = dependency longest chain（P7）。依存関係で結ばれた作業のうち所要日数の合計が最長の経路。同一担当者の詰まり（資源起因の遅れ）は含みません"
          >
            ▣ クリティカルパス（依存のつながりで最長の経路）
          </span>
        )}
        <span>点は完了/未完了の事実のみ（進捗%の按分はしません）</span>
      </div>
    </div>
  );
}
