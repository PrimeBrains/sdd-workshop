// decision インボックス — aggregates the 8 action-warnings + the in-inbox commit
// decisions and deep-links each to its write surface. NO self-state: no dismiss /
// seen / snooze button anywhere; an item is present iff its predicate holds now,
// and disappears only when an event/c-change falsifies it (§2.1). A standing
// count keeps everything in the accounting (P0). R-S4/R-S6 de-rates are NOT here
// (they modify health/spec-value metrics).

import { useMemo } from 'react';
import { EVM } from '../../theme/tokens';
import { Card, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/store';
import { computeInbox } from '../../moira/warnings';
import type { SurfaceId } from '../../app/types';

const SURFACE_LABEL: Record<SurfaceId, string> = {
  'spec-value': 'spec-value',
  'schedule-time': 'schedule-time',
  health: 'health',
  'decision-inbox': 'decision インボックス',
  capacity: 'capacity',
};

export function DecisionInboxSurface({ onNavigate }: { onNavigate: (s: SurfaceId) => void }) {
  const { derived, projected } = useMoira();
  const items = useMemo(() => computeInbox(derived, projected), [derived, projected]);
  const warnings = items.filter((i) => i.kind === 'warning');
  const commits = items.filter((i) => i.kind === 'commit');

  return (
    <div style={{ padding: 16, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ fontSize: 12.5, color: EVM.ink2 }}>
          コミット判断と<b>判断を要する警告</b>を集約し、文脈ビューの write へ deep-link。
          <b>自前状態なし</b>（dismiss/既読ボタンはありません）。行為を追記→導出再評価で条件が偽化した項目は自動消滅します。
          de-rate 型（R-S4/R-S6）は health/spec-value の常時メトリクス修飾ゆえ非集約。
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
          <Pill tone={warnings.length > 0 ? 'warn' : 'ok'}>判断要 {items.length} 件</Pill>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>警告 {warnings.length} / コミット判断 {commits.length}（すべて会計に算入）</span>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="条件が真の間だけ存在（消滅は導出再評価のみ）">警告（行為を要する）</SectionTitle>
        {warnings.length === 0 ? (
          <div style={{ fontSize: 12, color: EVM.ink3 }}>該当する警告はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map((it) => (
              <Item key={it.key} it={it} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint="5コミット判断のうち4つ（第5=c宣言は capacity 面）">コミット判断</SectionTitle>
        {commits.length === 0 ? (
          <div style={{ fontSize: 12, color: EVM.ink3 }}>保留中のコミット判断はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {commits.map((it) => (
              <Item key={it.key} it={it} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Item({
  it,
  onNavigate,
}: {
  it: ReturnType<typeof computeInbox>[number];
  onNavigate: (s: SurfaceId) => void;
}) {
  return (
    <div style={{ border: `1px solid ${EVM.rule}`, borderRadius: 8, padding: '8px 10px', background: EVM.paperWarm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill tone={it.kind === 'warning' ? 'warn' : 'brand'}>{it.rid}</Pill>
        <span style={{ fontSize: 12.5, color: EVM.ink }}>{it.title}</span>
        <button
          onClick={() => onNavigate(it.surface)}
          style={{ marginLeft: 'auto', fontSize: 11, border: `1px solid ${EVM.rule}`, background: EVM.card, color: EVM.brandDeep, borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}
        >
          → {SURFACE_LABEL[it.surface]}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
        {it.actions.map((a) => (
          <span key={a} style={{ fontSize: 10.5, border: `1px solid ${EVM.rule}`, background: EVM.card, color: EVM.ink2, borderRadius: 5, padding: '2px 7px' }}>
            {a}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 5 }}>消滅条件: {it.clearWhen}</div>
    </div>
  );
}
