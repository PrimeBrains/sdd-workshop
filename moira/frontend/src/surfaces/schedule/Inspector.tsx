// Task Inspector — read zone (projected attributes + derived per-node) and an
// action zone whose buttons stage a 4-event DRAFT, confirmed before append
// (UI-DESIGN-BRIEF §3.5). NO sliders / %-progress / cost coefficients (P1/A2):
// the only writes are TransitionEvent appends. Appending re-runs derive() — the
// metrics you see update live (R-S2).

import { useState } from 'react';
import { EVM } from '../../theme/tokens';
import { Card, EstimatePill, LifecyclePill, Pill, Avatar } from '../../theme/atoms';
import { useMoira } from '../../moira/hooks';
import { actorLabel, labelOf } from '../../moira/labels';
import { DEMO_ACTORS } from '../../moira/demo-data';
import type { Actor, Event, LifecycleState, NodeId } from '../../moira/engine';

const FORWARD: LifecycleState[] = ['ready', 'implementing', 'implemented', 'accepted'];

function Field({ k, v, tone, testid }: { k: string; v: React.ReactNode; tone?: string; testid?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: EVM.ink3 }}>{k}</span>
      <span className="mono" data-testid={testid} style={{ color: tone ?? EVM.ink, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

export function Inspector({ node }: { node: NodeId | null }) {
  const { projected, derived, appendEvent, nextStamp, asOf } = useMoira();
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

  // Per-task standard EVM — PROJECTED from per-node attributes, NOT a second
  // derive() (R-S2): the same blessed flavor as the engine-bridge attribute
  // projection and the prior evContribution. taskPv mirrors pv.ts's single-leaf
  // inclusion rule (agreed ∧ scheduled ∧ frozenSlot ≤ asOf); taskEv is the
  // agreed-completed frozen budget (ev.ts). SV/CV are presentation identities
  // (differences of the above), not canon indices.
  const frozenSlot = fc?.frozenSlot ?? null;
  const predicted = fc?.predictedCompletion ?? null;
  const scheduledByNow = frozenSlot !== null && frozenSlot <= asOf;
  const taskEv = completed && agreed ? n.frozenBudget ?? 0 : 0;
  const taskPv = agreed && scheduledByNow && n.frozenBudget !== null ? n.frozenBudget : 0;
  const sv = taskEv - taskPv; // schedule variance (EV − PV)
  const cv = taskEv - ac; // cost variance (EV − AC)

  // Objective in-flight signals (date/cost only; no subjective % — P1/A2): a
  // coarse leaf reveals slip BEFORE completion while EV is still 0.
  const overdue = !completed && predicted !== null && predicted < asOf;
  const forecastBehind =
    !completed && predicted !== null && frozenSlot !== null && predicted > frozenSlot;
  const costAhead = !completed && ac > 0 && taskEv === 0;
  const fmtSigned = (v: number) => (v > 0 ? `+${v}` : String(v));
  const varianceTone = (v: number) => (v < 0 ? EVM.crit : v > 0 ? EVM.ok : EVM.ink3);

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
    <Card testid="inspector" style={{ width: 360, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      {/* read zone — standard EVM: PV / EV / AC, then variances, then context */}
      <div style={{ borderTop: `1px solid ${EVM.ruleSoft}`, paddingTop: 6 }}>
        <Field k="PV 計画価値 (MD)" v={taskPv} tone={taskPv > 0 ? EVM.ink : EVM.ink3} testid="field:pv" />
        <Field k="EV 出来高 (MD)" v={taskEv} tone={taskEv > 0 ? EVM.ok : EVM.ink3} testid="field:ev" />
        <Field k="AC 実コスト (MD)" v={ac} />
        <div style={{ borderTop: `1px solid ${EVM.ruleSoft}`, margin: '5px 0' }} />
        <Field k="SV 差異 (= EV − PV)" v={fmtSigned(sv)} tone={varianceTone(sv)} />
        <Field k="CV 差異 (= EV − AC)" v={fmtSigned(cv)} tone={varianceTone(cv)} />
        <div style={{ borderTop: `1px solid ${EVM.ruleSoft}`, margin: '5px 0' }} />
        <Field k="BAC 予算・確定 (MD)" v={n.frozenBudget ?? '—'} />
        <Field k="最新見積 (MD)" v={n.latestEstimate ?? '—'} />
        <Field k="基準完了日（ベースライン）" v={frozenSlot ?? '—'} tone={frozenSlot ? EVM.ink : EVM.crit} testid="field:frozen-slot" />
        <Field
          k="予測完了日（生きた予測）"
          v={predicted ?? '—'}
          tone={overdue || forecastBehind ? EVM.crit : EVM.ink}
          testid="field:predicted"
        />
      </div>

      {/* objective in-flight signals (date/cost only) + mandated visible gaps */}
      {(overdue || forecastBehind || costAhead || !agreed || frozenSlot === null) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {overdue && <Pill tone="crit">遅延中 — 予測 {predicted} を過ぎて未完了</Pill>}
          {forecastBehind && <Pill tone="warn">予測 {predicted} が基準 {frozenSlot} に遅延（R-S7）</Pill>}
          {costAhead && <Pill tone="warn">仕掛中 — AC {ac}MD 計上・EV 未計上</Pill>}
          {!agreed && <Pill tone="na">未合意 → EV 0</Pill>}
          {frozenSlot === null && <Pill tone="crit">未スケジュール → PV 不算入</Pill>}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: EVM.ink3 }}>
        SPI / CPI（指標）はタスク単位では二値化するため、プロジェクト全体は health で確認。
      </div>

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
