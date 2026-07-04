// capacity · calendar — the ONLY write surface for c(i,d). Three zones:
//   ① 人×暦ヒートマップ (read projection; cell = latest-value射影)
//   ② 右 改定パネル (the single write; append-only, α_i read-only, what-if)
//   ③ R-U14 追記履歴 (ts desc; no edit/delete)
// c ∈ [0,1.0] (0含む) — the range slider here is the sole allowed type=range
// exception. reason carries the audit note (R-U14 reason-stamped).

import { useMemo, useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Card, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { actorLabel } from '../../moira/labels';
import { DEMO_ACTORS } from '../../moira/demo-data';
import {
  alphaOf,
  hasCapacityEntry,
  latestEntry,
  makeCapacityLookup,
  nextCapacityTs,
} from '../../moira/capacity';
import { addDaysIso } from '../schedule/gantt-geometry';
import type { CapacityEntry, IsoDate } from '../../moira/engine';

const HUMANS = Object.values(DEMO_ACTORS).filter((a) => a.actor.kind === 'human');
const WINDOW_START: IsoDate = '2026-06-15';
const WINDOW_DAYS = 12;
const REASONS = ['contract', 'holiday', 'leave', 'temporary-reduction'] as const;
type ReasonKind = (typeof REASONS)[number];

const REASON_LABEL: Record<ReasonKind, string> = {
  contract: '契約',
  holiday: '祝日',
  leave: '休暇',
  'temporary-reduction': '一時減',
};

function kindOf(reason: string): ReasonKind | null {
  const head = reason.split(/[:：]/)[0]!.trim();
  return (REASONS as readonly string[]).includes(head) ? (head as ReasonKind) : null;
}

const dates: IsoDate[] = Array.from({ length: WINDOW_DAYS }, (_, i) => addDaysIso(WINDOW_START, i));
const isWeekend = (d: IsoDate) => {
  const w = new Date(`${d}T00:00:00Z`).getUTCDay();
  return w === 0 || w === 6;
};
const dayLabel = (d: IsoDate) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
};

export function CapacitySurface() {
  const { capacityEntries, appendCapacity, previewCapacity, derived, asOf } = useMoira();
  const lookup = useMemo(() => makeCapacityLookup(capacityEntries), [capacityEntries]);

  const [sel, setSel] = useState<{ humanId: string; date: IsoDate } | null>(null);
  const [value, setValue] = useState(1.0);
  const [reason, setReason] = useState<ReasonKind>('temporary-reduction');
  const [memo, setMemo] = useState('');
  const [preview, setPreview] = useState<{ schedCov: number; changed: number } | null>(null);

  const selectCell = (humanId: string, date: IsoDate) => {
    setSel({ humanId, date });
    const cur = latestEntry(capacityEntries, humanId, date);
    setValue(cur?.capacity ?? 1.0);
    setReason((cur && kindOf(cur.reason)) || 'temporary-reduction');
    setMemo('');
    setPreview(null);
  };

  const draft = (): CapacityEntry | null =>
    sel === null
      ? null
      : {
          humanId: sel.humanId,
          date: sel.date,
          capacity: value,
          reason: memo.trim() === '' ? reason : `${reason}: ${memo.trim()}`,
          ts: nextCapacityTs(capacityEntries),
        };

  const runPreview = () => {
    const d = draft();
    if (d === null) return;
    const pv = previewCapacity([d]);
    let changed = 0;
    const cur = new Map(derived.forecast.map((f) => [f.node, f.predictedCompletion]));
    for (const f of pv.forecast) if (cur.get(f.node) !== f.predictedCompletion) changed += 1;
    setPreview({ schedCov: pv.scheduleCoverage, changed });
  };

  const commit = () => {
    const d = draft();
    if (d === null) return;
    appendCapacity(d);
    setMemo('');
    setPreview(null);
  };

  const cellStyle = (humanId: string, date: IsoDate) => {
    const c = lookup(humanId, date);
    const explicit = hasCapacityEntry(capacityEntries, humanId, date);
    const ent = latestEntry(capacityEntries, humanId, date);
    const kind = ent ? kindOf(ent.reason) : null;
    let bg: string = EVM.card;
    let border = `1px solid ${EVM.ruleSoft}`;
    let color: string = EVM.ink2;
    if (!explicit) {
      bg = 'rgba(155,193,50,0.05)';
      border = `1px dashed ${EVM.ruleSoft}`;
      color = EVM.ink4;
    } else if (c === 0) {
      bg = kind === 'holiday' ? '#f5e3d9' : '#f1d5c8';
      color = EVM.crit;
    } else if (kind === 'contract') {
      bg = `rgba(155,193,50,${0.15 + c * 0.35})`;
      color = '#3c6b22';
    } else if (kind === 'temporary-reduction') {
      bg = 'repeating-linear-gradient(135deg,#f3e7c4 0 4px,#fff 4px 8px)';
      color = '#8a6c1a';
    } else {
      bg = EVM.warnSoft;
      color = '#8a6c1a';
    }
    return { background: bg, border, color };
  };

  const selDraft = draft();

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16 }}>
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card pad={12}>
          <SectionTitle hint="セル=最新値の射影／クリックで右パネルに改定起票（追記専用・上書きなし）">
            capacity ヒートマップ（人 × 日）
          </SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: EVM.card }} />
                  {dates.map((d) => (
                    <th
                      key={d}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: d === asOf ? EVM.brandDeep : isWeekend(d) ? EVM.ink4 : EVM.ink3,
                        padding: '2px 4px',
                        minWidth: 38,
                      }}
                    >
                      {dayLabel(d)}
                      {d === asOf && <div style={{ fontSize: 8 }}>基準日</div>}
                    </th>
                  ))}
                  <th title="α_i" style={{ fontSize: 10, color: EVM.ink3, padding: '2px 6px' }}>契約稼働率</th>
                </tr>
              </thead>
              <tbody>
                {HUMANS.map((h) => (
                  <tr key={h.actor.id}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        background: EVM.card,
                        fontWeight: 600,
                        color: EVM.ink,
                        padding: '2px 8px 2px 2px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h.label}
                    </td>
                    {dates.map((d) => {
                      const c = lookup(h.actor.id, d);
                      const st = cellStyle(h.actor.id, d);
                      const selected = sel?.humanId === h.actor.id && sel?.date === d;
                      return (
                        <td key={d} style={{ padding: 0 }}>
                          <button
                            onClick={() => selectCell(h.actor.id, d)}
                            title={`${h.label} ${d}: c=${c}${hasCapacityEntry(capacityEntries, h.actor.id, d) ? '（明示）' : '（未指定=1.0仮定）'}`}
                            className="mono"
                            style={{
                              width: '100%',
                              minWidth: 38,
                              height: 30,
                              cursor: 'pointer',
                              borderRadius: 4,
                              fontSize: 11,
                              ...st,
                              outline: selected ? `2px solid ${EVM.brandDeep}` : undefined,
                            }}
                          >
                            {c.toFixed(1)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="mono" style={{ fontSize: 10, color: EVM.ink3, padding: '0 6px', textAlign: 'center' }}>
                      {alphaOf(capacityEntries, h.actor.id, asOf).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 10.5, color: EVM.ink3 }}>
            <span>淡色破線=未指定（1.0仮定）</span>
            <span style={{ color: '#3c6b22' }}>■ 契約</span>
            <span style={{ color: '#8a6c1a' }}>▨ 一時減 / 祝日</span>
            <span style={{ color: EVM.crit }}>■ c=0（休暇/祝日）</span>
            <span title="α_i">契約稼働率 は c の契約成分の導出値（読取専用）</span>
          </div>
        </Card>

        <Card pad={12}>
          <SectionTitle hint="追記専用・理由付き（編集/削除なし）">改定履歴</SectionTitle>
          {capacityEntries.length === 0 ? (
            <div style={{ fontSize: 12, color: EVM.ink3 }}>改定はまだありません。</div>
          ) : (
            <div className="mono" style={{ fontSize: 11, color: EVM.ink2, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflow: 'auto' }}>
              {[...capacityEntries]
                .filter((e) => sel === null || e.humanId === sel.humanId)
                .sort((a, b) => b.ts - a.ts)
                .map((e, i) => (
                  <div key={i}>
                    ts{e.ts} / {actorLabel(DEMO_ACTORS[e.humanId]?.actor ?? { kind: 'human', id: e.humanId })} / {e.date} / c={e.capacity} / {e.reason}
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* editor — the single write entry */}
      <Card style={{ width: 380, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionTitle>c 改定（唯一の入力口）</SectionTitle>
        {sel === null ? (
          <div style={{ fontSize: 12, color: EVM.ink3 }}>左のヒートマップのセルをクリックすると、その人・日の c を改定できます。</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: EVM.ink2 }}>
              対象: <b>{DEMO_ACTORS[sel.humanId]?.label}</b> × <span className="mono">{sel.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: EVM.ink3, background: EVM.ruleSoft, borderRadius: 6, padding: '6px 8px', cursor: 'not-allowed' }}>
              <span title="α_i">契約稼働率（契約成分・読取専用）</span>
              <span className="mono">{alphaOf(capacityEntries, sel.humanId, sel.date).toFixed(1)}</span>
            </div>

            <label style={{ fontSize: 11, color: EVM.ink3 }}>
              c(i,d) = {value.toFixed(1)} MD/日（0含む・1.0上限）
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={value}
                onChange={(e) => {
                  setValue(Number(e.target.value));
                  setPreview(null);
                }}
                style={{ width: '100%', accentColor: EVM.brandDeep }}
              />
            </label>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setReason(r);
                    setPreview(null);
                  }}
                  style={{
                    fontSize: 11,
                    border: `1px solid ${reason === r ? EVM.brandDeep : EVM.rule}`,
                    background: reason === r ? EVM.brandSoft : EVM.paperWarm,
                    color: reason === r ? EVM.brandDeep : EVM.ink2,
                    borderRadius: 999,
                    padding: '3px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>

            {reason === 'contract' && (
              <div style={{ fontSize: 11, color: '#3c6b22', background: EVM.okSoft, border: '1px solid #c4d8a8', borderRadius: 6, padding: '6px 8px' }}>
                これは組織コミット（contract）。本来は decision インボックスへ第5コミット判断として記録されます。
                <b>（インボックス連動は今後対応）</b>
              </div>
            )}

            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="理由メモ（例: 2026 国民の祝日 / 体調不良）— reason に追記され監査に残る"
              rows={2}
              style={{ fontFamily: EVM.font, fontSize: 12, border: `1px solid ${EVM.rule}`, borderRadius: 6, padding: 6, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={runPreview}
                style={{ fontSize: 12, border: `1px solid ${EVM.rule}`, background: EVM.paperWarm, color: EVM.ink2, borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
              >
                影響プレビュー（what-if）
              </button>
              <button
                onClick={commit}
                style={{ fontSize: 12, fontWeight: 600, border: 'none', background: EVM.brandDeep, color: '#fff', borderRadius: 6, padding: '5px 13px', cursor: 'pointer' }}
              >
                追記する
              </button>
            </div>

            {preview !== null && selDraft !== null && (
              <div style={{ fontSize: 11.5, color: EVM.ink2, background: EVM.paperWarm, border: `1px dashed ${EVM.rule}`, borderRadius: 6, padding: '8px 9px' }}>
                <Pill tone="na">未確定ドラフト射影</Pill>
                <div style={{ marginTop: 6 }} className="mono">
                  scheduleCoverage {(derived.scheduleCoverage * 100).toFixed(0)}% → {(preview.schedCov * 100).toFixed(0)}%
                  <br />
                  予測完了が変わる葉: {preview.changed} 件
                </div>
                <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 4 }}>
                  プレビューと確定は同一の導出計算を通ります（画面側の近似なし）。
                </div>
              </div>
            )}

            <div style={{ fontSize: 10.5, color: EVM.ink3 }}>
              「追記する」は上書きでなく履歴の伸長（latest-ts wins）。恒久離脱は schedule-time の割当解除で。
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
