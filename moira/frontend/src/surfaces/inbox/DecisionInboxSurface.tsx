// decision インボックス — 「誰が何を判断すべきか」を4つの平易な見出しに束ね、各項目を
// その write サーフェスへ deep-link する。見出し＝判断種別（見積合意 / 担当割当 / 受入 / 警告）。
// NO self-state: no dismiss / seen / snooze button anywhere; an item is present iff its
// predicate holds now, and disappears only when an event/c-change falsifies it (§2.1).
// A standing count keeps everything in the accounting (P0). R-S4/R-S6 de-rates are NOT here
// (they modify health/spec-value metrics). 担当/未割当/自分での絞り込みは「表示の refine」であり
// 会計（総数 Pill）は常に全件を映す。

import { useMemo, useState, type ReactNode } from 'react';
import { EVM } from '../../theme/tokens';
import { Card, Pill, SectionTitle } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { computeInbox, itemMatchesActor, assigneeOptions } from '../../moira/warnings';
import type { DecisionType, InboxItem } from '../../moira/warnings';
import { DECISION_JA } from '../../moira/glossary';
import { actorLabel } from '../../moira/labels';
import type { ProjectedState } from '../../moira/engine';
import type { SurfaceId } from '../../app/types';

const SURFACE_LABEL: Record<SurfaceId, string> = {
  'spec-value': 'spec-value',
  'schedule-time': 'schedule-time',
  activity: 'activity',
  health: 'health',
  'decision-inbox': 'decision インボックス',
  capacity: 'capacity',
};

// 表示順＝人が上から片付ける順（見積→割当→受入→警告）。
const SECTIONS: Array<{ type: DecisionType; title: string; hint: string }> = [
  { type: 'estimate', title: '見積に合意する', hint: '提案中の見積を人間が合意（合意で消滅）' },
  { type: 'assign', title: '担当を割り当てる', hint: '合意済みだが未割当（担当付与で消滅）' },
  { type: 'accept', title: '受入判断する', hint: '完了・検収待ち（受入または差し戻しで消滅）' },
  { type: 'warning', title: '警告に対処する', hint: '条件が真の間だけ存在（行為で消滅）' },
];

type Filter = 'all' | 'mine' | 'unassigned' | 'assignee';

export function DecisionInboxSurface({ onNavigate }: { onNavigate: (s: SurfaceId) => void }) {
  const { derived, projected, me } = useMoira();
  const items = useMemo(() => computeInbox(derived, projected), [derived, projected]);

  const [filter, setFilter] = useState<Filter>('all');
  const [actorId, setActorId] = useState<string>('');

  const actors = useMemo(() => assigneeOptions(projected), [projected]);

  const shown = useMemo(
    () => items.filter((it) => matchesFilter(it, projected, filter, me, actorId)),
    [items, projected, filter, me, actorId],
  );

  const countOf = (type: DecisionType) => shown.filter((it) => it.decisionType === type).length;
  const filterActive = filter !== 'all';

  return (
    <div style={{ padding: 16, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ fontSize: 12.5, color: EVM.ink2 }}>
          いま<b>誰が何を判断すべきか</b>を種別ごとに束ね、それぞれの入力ビューへ deep-link します。
          <b>行為を追記すると該当項目は自動的に消えます</b>（既読ボタンはありません — 自前状態なし §2.1）。
          カバレッジ低下の注意表示は health / 仕様・価値ビューに常時表示のため、ここには集約しません。
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={items.length > 0 ? 'warn' : 'ok'} testid="inbox-total">判断要 {items.length} 件</Pill>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>
            {filterActive ? `絞り込み表示中 ${shown.length} 件（総数は全件を算入）` : 'すべて会計に算入'}
          </span>
        </div>

        {/* 担当者フィルタ（表示の refine のみ・会計は不変） */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>絞り込み</span>
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} testid="inbox-filter:all">
            全員
          </FilterBtn>
          <FilterBtn
            active={filter === 'mine'}
            onClick={() => setFilter('mine')}
            testid="inbox-filter:mine"
            disabled={me === null}
            title={me === null ? 'moira ui 起動時のみ利用可（.moira/config.json の me）' : `自分＝${me}`}
          >
            自分
          </FilterBtn>
          <FilterBtn
            active={filter === 'unassigned'}
            onClick={() => setFilter('unassigned')}
            testid="inbox-filter:unassigned"
          >
            未割当
          </FilterBtn>
          <select
            data-testid="inbox-filter:assignee"
            value={filter === 'assignee' ? actorId : ''}
            onChange={(e) => {
              setActorId(e.target.value);
              setFilter(e.target.value === '' ? 'all' : 'assignee');
            }}
            style={{ fontSize: 11.5, border: `1px solid ${EVM.rule}`, background: EVM.paperWarm, color: EVM.ink2, borderRadius: 6, padding: '3px 8px' }}
          >
            <option value="">担当者で絞り込み…</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {actorLabel(a)}
                {a.kind === 'agent' ? '（エージェント）' : ''}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card>
          <div data-testid="inbox-empty" style={{ fontSize: 13, color: EVM.ink2 }}>
            すべて判断済みです。
          </div>
        </Card>
      ) : (
        SECTIONS.map(({ type, title, hint }) => {
          const sectionItems = shown.filter((it) => it.decisionType === type);
          return (
            <Card key={type}>
              <div data-testid={`inbox-section:${type}`}>
                <SectionTitle
                  hint={
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Pill tone="neutral" testid={`inbox-count:${type}`}>{countOf(type)} 件</Pill>
                      <span style={{ fontSize: 10.5, color: EVM.ink3 }}>{hint}</span>
                    </span>
                  }
                >
                  {title}
                </SectionTitle>
                {sectionItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: EVM.ink3 }}>なし</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sectionItems.map((it) => (
                      <Item key={it.key} it={it} projected={projected} onNavigate={onNavigate} />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  testid,
  disabled = false,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testid: string;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      title={title}
      style={{
        fontSize: 11.5,
        border: `1px solid ${active ? EVM.brandDeep : EVM.rule}`,
        background: active ? EVM.brandSoft : EVM.paperWarm,
        color: disabled ? EVM.ink4 : active ? EVM.brandDeep : EVM.ink2,
        borderRadius: 999,
        padding: '3px 11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function AssigneeChips({ it, projected }: { it: InboxItem; projected: ProjectedState }) {
  const n = it.node === undefined ? undefined : projected.nodes.get(it.node);
  const assignee = n?.assignee ?? null;
  const reviewer = n?.reviewer ?? null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {assignee === null ? (
        <Pill tone="warn">未割当</Pill>
      ) : (
        <span style={{ fontSize: 10.5, border: `1px solid ${EVM.rule}`, background: EVM.card, color: EVM.ink2, borderRadius: 5, padding: '2px 7px' }}>
          担当: {actorLabel(assignee)}
        </span>
      )}
      {reviewer !== null && (
        <span style={{ fontSize: 10.5, border: `1px solid ${EVM.rule}`, background: EVM.card, color: EVM.ink2, borderRadius: 5, padding: '2px 7px' }}>
          レビュー: {actorLabel(reviewer)}
        </span>
      )}
    </div>
  );
}

function Item({
  it,
  projected,
  onNavigate,
}: {
  it: InboxItem;
  projected: ProjectedState;
  onNavigate: (s: SurfaceId) => void;
}) {
  return (
    <div style={{ border: `1px solid ${EVM.rule}`, borderRadius: 8, padding: '8px 10px', background: EVM.paperWarm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill tone={it.kind === 'warning' ? 'warn' : 'brand'} title={it.rid}>{DECISION_JA[it.rid] ?? it.rid}</Pill>
        <span style={{ fontSize: 12.5, color: EVM.ink }}>{it.title}</span>
        <button
          onClick={() => onNavigate(it.surface)}
          style={{ marginLeft: 'auto', fontSize: 11, border: `1px solid ${EVM.rule}`, background: EVM.card, color: EVM.brandDeep, borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}
        >
          → {SURFACE_LABEL[it.surface]}
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        <AssigneeChips it={it} projected={projected} />
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

function matchesFilter(
  it: InboxItem,
  projected: ProjectedState,
  filter: Filter,
  me: string | null,
  actorId: string,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'mine') return me !== null && itemMatchesActor(it, projected, me);
  if (filter === 'unassigned') {
    if (it.node === undefined) return false;
    return (projected.nodes.get(it.node)?.assignee ?? null) === null;
  }
  // assignee select
  return actorId === '' || itemMatchesActor(it, projected, actorId);
}
