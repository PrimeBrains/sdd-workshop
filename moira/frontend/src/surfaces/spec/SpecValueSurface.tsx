// spec-value — review-grade (sdd-dashboard parity), re-grounded in Moira:
//   - node tree with lifecycle(6) + estimate(proposed/agreed) multi-pill
//   - coverage table fed by coverage.ts numbers (estimate/schedule), unagreed red
//   - EV% always paired with estimateCoverage, de-rated when low (R-S4)
//   - traceability: dependency vs supersede edges drawn distinctly (current effective
//     vs superseded), from projected (display projection)

import { useMemo, useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Bar, Card, EstimatePill, LifecyclePill, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { labelOf } from '../../moira/labels';
import { ESTIMATE_JA, EDGE_POLICY_JA } from '../../moira/glossary';
import { assigneeOptions, buildGanttModel, DEFAULT_ROW_FILTER, type RowFilter } from '../schedule/gantt-geometry';
import { SpecFilterBar } from './SpecFilterBar';

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export function SpecValueSurface() {
  const { projected, derived } = useMoira();
  // spec-value uses the STRICT completion sense (completed ∧ agreed = 本当に完了)
  const [filter, setFilter] = useState<RowFilter>({ ...DEFAULT_ROW_FILTER, completionStrict: true });
  const model = useMemo(() => buildGanttModel(projected, derived, filter), [projected, derived, filter]);
  const options = useMemo(() => assigneeOptions(projected), [projected]);
  const leaves = model.rows.filter((r) => r.isLeaf);
  const covLow = derived.estimateCoverage < 0.999;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
      {/* EV% + coverage (paired, de-rated) */}
      <Card>
        <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: EVM.ink3, fontWeight: 600 }}>EV%（現行有効集合）</div>
            <div data-testid="metric:ev-percent" className="serif" style={{ fontSize: 30, color: EVM.brandDeep, fontVariantNumeric: 'tabular-nums' }}>{pct(derived.evPercent, 1)}</div>
          </div>
          <div style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: EVM.ink3 }}>
              <span>見積カバレッジ</span>
              <span data-testid="metric:estimate-coverage" className="mono">{pct(derived.estimateCoverage)}</span>
            </div>
            <Bar value={derived.estimateCoverage} tone="brand" derate={covLow} />
            {covLow && <span style={{ fontSize: 10.5, color: EVM.ink3 }}>見積合意済みの範囲内での達成度（未合意分は含みません）</span>}
          </div>
        </div>
      </Card>

      {/* row filter (担当 / 完了(厳密) / 見積) — issue #8 */}
      <Card pad={12}>
        <SpecFilterBar filter={filter} onChange={setFilter} options={options} />
      </Card>

      {/* node tree */}
      <Card>
        <SectionTitle hint="feature ─ req/design/tasks/impl ／ 現行の木（置き換え/中止済みを除外）">ノード木 ＋ 状態</SectionTitle>
        {model.rows.length === 0 ? (
          <div data-testid="filter-empty" style={{ fontSize: 12, color: EVM.ink3, padding: '14px 6px' }}>
            条件に合う行がありません。
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {model.rows.map((r) => {
            const done = r.completed && r.estimateState === 'agreed';
            const ev = done ? r.frozenBudget ?? 0 : 0;
            const opacity = r.contextOnly ? 0.5 : done ? 0.55 : 1;
            return (
              <div
                key={r.node}
                data-testid={`spec-row:${r.node}`}
                data-context-only={r.contextOnly ? 'true' : undefined}
                className="evm-row"
                title={r.contextOnly ? '絞り込みの文脈として表示（祖先）' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderBottom: `1px solid ${EVM.ruleSoft}`, paddingLeft: 6 + r.depth * 16, opacity }}
              >
                <span style={{ color: EVM.ink4, fontSize: 10 }}>{r.isLeaf ? '·' : '▸'}</span>
                <span style={{ fontSize: 12.5, fontWeight: r.isLeaf ? 400 : 600, minWidth: 200 }}>{r.label}</span>
                <LifecyclePill state={r.lifecycle} />
                {r.isLeaf && <EstimatePill state={r.estimateState} />}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: EVM.ink3 }} className="mono">
                  {r.isLeaf ? `見積 ${r.latestEstimate ?? '—'} / EV寄与 ${ev}` : ''}
                </span>
              </div>
            );
          })}
        </div>
        )}
      </Card>

      {/* coverage table */}
      <Card>
        <SectionTitle hint="数値は単一の導出計算に基づく（画面側での再計算なし）">被覆マトリクス（有効葉）</SectionTitle>
        <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
          <CovStat label="見積カバレッジ" v={derived.estimateCoverage} tone="brand" />
          <CovStat label="スケジュールカバレッジ" v={derived.scheduleCoverage} tone="ok" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: EVM.ink3, textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>葉</th>
              <th style={{ padding: '4px 6px' }}>合意</th>
              <th style={{ padding: '4px 6px' }}>スケジュール</th>
              <th style={{ padding: '4px 6px' }}>完了</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>EV寄与 (MD)</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((r) => {
              const agreed = r.estimateState === 'agreed';
              const scheduled = r.frozenSlot !== null;
              const ev = r.completed && agreed ? r.frozenBudget ?? 0 : 0;
              return (
                <tr key={r.node} data-testid={`cov-row:${r.node}`} style={{ background: agreed ? 'transparent' : 'rgba(184,72,46,0.06)' }}>
                  <td style={{ padding: '4px 6px' }}>{r.label}</td>
                  <td style={{ padding: '4px 6px' }}>{agreed ? <Pill tone="ok" title="agreed">{ESTIMATE_JA.agreed}</Pill> : <Pill tone="crit" title="proposed">{ESTIMATE_JA.proposed}</Pill>}</td>
                  <td style={{ padding: '4px 6px' }}>{scheduled ? <Pill tone="brand">予定日あり</Pill> : <Pill tone="warn">未</Pill>}</td>
                  <td style={{ padding: '4px 6px' }}>{r.completed ? <Pill tone="ok">完了</Pill> : <span style={{ color: EVM.ink4 }}>—</span>}</td>
                  <td className="mono" style={{ padding: '4px 6px', textAlign: 'right', color: ev > 0 ? EVM.ok : EVM.ink4 }}>{ev}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* traceability */}
      <Card>
        <SectionTitle hint="依存と置き換えを別種で描き分け">トレーサビリティ（依存関係）</SectionTitle>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: 11, color: EVM.ink3, marginBottom: 4 }}>依存（dependency）</div>
            <div className="mono" style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {projected.dependencyEdges.map((e, i) => (
                <div key={i} style={{ color: EVM.ink2 }}>
                  {labelOf(e.from)} <span style={{ color: EVM.brandDeep }}>──{EDGE_POLICY_JA[e.policy]}──▸</span> {labelOf(e.to)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: 11, color: EVM.ink3, marginBottom: 4 }}>置き換え（新 → 旧・旧は現行集計から除外）</div>
            <div className="mono" style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {projected.supersedeEdges.length === 0 ? (
                <span style={{ color: EVM.ink4 }}>なし</span>
              ) : (
                projected.supersedeEdges.map((e, i) => (
                  <div key={i} style={{ color: EVM.ink2 }}>
                    {labelOf(e.from)} <span style={{ color: EVM.crit }}>══▸</span> <s style={{ color: EVM.ink4 }}>{labelOf(e.to)}</s>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CovStat({ label, v, tone }: { label: string; v: number; tone: 'brand' | 'ok' }) {
  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: EVM.ink3 }}>
        <span>{label}</span>
        <span className="mono">{pct(v)}</span>
      </div>
      <Bar value={v} tone={tone} derate={v < 0.999} />
    </div>
  );
}
