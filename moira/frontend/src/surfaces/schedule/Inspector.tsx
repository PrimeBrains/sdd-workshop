// Task Inspector — read zone (projected attributes + derived per-node) and an
// action zone whose buttons stage a 4-event DRAFT, confirmed before append
// (UI-DESIGN-BRIEF §3.5). NO sliders / %-progress / cost coefficients (P1/A2):
// the only writes are TransitionEvent appends. Appending re-runs derive() — the
// metrics you see update live (R-S2).

import { useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Card, EstimatePill, LifecyclePill, Pill, Avatar } from '../../theme/atoms';
import { useMoira } from '../../moira/store';
import { actorLabel, labelOf } from '../../moira/labels';
import { DEMO_ACTORS } from '../../moira/demo-data';
import type { Actor, Event, LifecycleState, NodeId } from '../../moira/engine';

const FORWARD: LifecycleState[] = ['ready', 'implementing', 'implemented', 'accepted'];

function Field({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: EVM.ink3 }}>{k}</span>
      <span className="mono" style={{ color: tone ?? EVM.ink, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

export function Inspector({ node }: { node: NodeId | null }) {
  const { projected, derived, appendEvent, nextStamp } = useMoira();
  const [pending, setPending] = useState<{ ev: Event; desc: string } | null>(null);

  if (node === null) {
    return (
      <Card style={{ width: 360, flex: '0 0 auto' }}>
        <div style={{ color: EVM.ink3, fontSize: 12 }}>Gantt の行をクリックするとタスクの EVM が出ます。</div>
      </Card>
    );
  }
  const n = projected.nodes.get(node);
  if (n === undefined) return null;
  const fc = derived.forecast.find((f) => f.node === node);
  const ac = derived.acByNode.find((a) => a.node === node)?.ac ?? 0;
  const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';
  const agreed = n.estimateState === 'agreed';
  const evContribution = completed && agreed ? n.frozenBudget ?? 0 : 0;

  const stage = (ev: Event, desc: string) => setPending({ ev, desc });
  const commit = () => {
    if (pending !== null) {
      appendEvent(pending.ev);
      setPending(null);
    }
  };

  const actorFor = (preferHuman: boolean): Actor => {
    if (preferHuman) return DEMO_ACTORS.alice!.actor;
    return n.assignee ?? DEMO_ACTORS.alice!.actor;
  };

  const lifecycleDraft = (to: LifecycleState) => {
    const ev: Event = {
      kind: 'transition',
      ...nextStamp(),
      actor: actorFor(false),
      node,
      machine: 'lifecycle',
      to,
    };
    stage(ev, `lifecycle: ${n.lifecycle} → ${to}`);
  };
  const agreeDraft = () => {
    const ev: Event = {
      kind: 'transition',
      ...nextStamp(),
      actor: actorFor(true), // human only (R-U4)
      node,
      machine: 'estimate-agreement',
      to: 'agreed',
      ...(n.latestEstimate !== null ? { frozenBudget: n.latestEstimate } : {}),
    };
    stage(ev, `estimate: proposed → agreed（frozenBudget=${n.latestEstimate ?? '—'} MD, by 田中）`);
  };
  const reestimateDraft = () => {
    const ev: Event = {
      kind: 'transition',
      ...nextStamp(),
      actor: actorFor(true),
      node,
      machine: 'estimate-agreement',
      to: 'proposed',
    };
    stage(ev, 'estimate: agreed → proposed（再見積・要再合意）');
  };
  const reassignDraft = (a: Actor) => {
    const ev: Event = {
      kind: 'transition',
      ...nextStamp(),
      actor: a,
      node,
      machine: 'lifecycle',
      to: n.lifecycle === 'pending' ? 'ready' : n.lifecycle,
      assignee: a,
    };
    stage(ev, `担当 → ${actorLabel(a)}（latest-wins R-T5）`);
  };

  return (
    <Card style={{ width: 360, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{labelOf(node)}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <LifecyclePill state={n.lifecycle} />
          <EstimatePill state={n.estimateState} />
          {n.assignee !== null ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: EVM.ink2 }}>
              <Avatar actor={n.assignee} /> {actorLabel(n.assignee)}
            </span>
          ) : (
            <Pill tone="warn">未割当</Pill>
          )}
        </div>
      </div>

      {/* read zone */}
      <div style={{ borderTop: `1px solid ${EVM.ruleSoft}`, paddingTop: 6 }}>
        <Field k="latest 見積 (MD)" v={n.latestEstimate ?? '—'} />
        <Field k="frozenBudget (MD)" v={n.frozenBudget ?? '—'} />
        <Field k="frozenSlot (凍結PV)" v={fc?.frozenSlot ?? '—'} tone={fc?.frozenSlot ? EVM.ink : EVM.crit} />
        <Field k="predicted (生きた予測)" v={fc?.predictedCompletion ?? '—'} />
        <Field k="ownCost / AC (MD)" v={`${n.ownCost} / ${ac}`} />
        <Field k="EV_abs 寄与 (MD)" v={evContribution} tone={evContribution > 0 ? EVM.ok : EVM.ink3} />
      </div>

      {(!agreed || fc?.frozenSlot == null) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!agreed && <Pill tone="na">未合意 → EV_abs 寄与 0</Pill>}
          {fc?.frozenSlot == null && <Pill tone="crit">未スケジュール → PV 不算入</Pill>}
        </div>
      )}

      {/* action zone — drafts only, confirmed before append */}
      <div style={{ borderTop: `1px solid ${EVM.ruleSoft}`, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: EVM.ink3, marginBottom: 6 }}>行為（イベント追記・確認後に確定）</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {FORWARD.filter((s) => s !== n.lifecycle).map((s) => (
            <ActBtn key={s} onClick={() => lifecycleDraft(s)}>→{s}</ActBtn>
          ))}
          {!agreed ? (
            <ActBtn tone="ok" onClick={agreeDraft}>合意（人間のみ）</ActBtn>
          ) : (
            <ActBtn onClick={reestimateDraft}>再見積</ActBtn>
          )}
        </div>
        <div style={{ fontSize: 11, color: EVM.ink3, margin: '8px 0 4px' }}>担当付替</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.values(DEMO_ACTORS).map((a) => (
            <ActBtn key={a.actor.id} onClick={() => reassignDraft(a.actor)}>{a.label}</ActBtn>
          ))}
        </div>
      </div>

      {/* confirm bar */}
      {pending !== null && (
        <div
          style={{
            borderTop: `1px solid ${EVM.rule}`,
            paddingTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11.5, color: EVM.ink2 }}>追記内容: <span className="mono">{pending.desc}</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={commit}
              style={{ background: EVM.brandDeep, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              追記する
            </button>
            <button
              onClick={() => setPending(null)}
              style={{ background: EVM.paperWarm, color: EVM.ink2, border: `1px solid ${EVM.rule}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              取消
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: EVM.ink3 }}>追記すると derive() が再実行され、全画面のメトリクスがライブ更新されます（R-S2）。</div>
        </div>
      )}
    </Card>
  );
}

function ActBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: 'ok' }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        border: `1px solid ${tone === 'ok' ? '#c4d8a8' : EVM.rule}`,
        background: tone === 'ok' ? EVM.okSoft : EVM.paperWarm,
        color: tone === 'ok' ? '#3c6b22' : EVM.ink2,
        borderRadius: 6,
        padding: '3px 9px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
