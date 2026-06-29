// Activity log (history) derivation — a human-readable projection of the
// append-only event log, in deterministic (ts, id) order. This is a DERIVATION
// (read-side), not a new event kind: it never mutates state and is computed in
// derive(), so the activity surface reads it through the single DerivedState seam
// (R-S2) like every other surface — no second source of truth.
//
// Labels are inferred per-event with a light stateful pass over the prior
// lifecycle of each node, so a backslide (implemented→implementing, P5) reads as
// 「差し戻し」 rather than a generic 「着手」 — the rework signal the backbone flow
// carries (units/requirements-spec-returned §3).

import { sortEvents } from '../event-store.js';
import type { ActivityRow, Event, LifecycleState, NodeId } from '../types.js';

export function computeActivityLog(events: readonly Event[]): ActivityRow[] {
  const lifecycleOf = new Map<NodeId, LifecycleState>();
  const rows: ActivityRow[] = [];

  for (const ev of sortEvents(events)) {
    let node: NodeId | null = null;
    let label = '';

    switch (ev.kind) {
      case 'decompose': {
        node = ev.parent;
        const hasEstimate = ev.children.some((c) => c.estimate !== undefined);
        if (hasEstimate) label = '見積案を提示';
        else if (ev.parent === 'root') label = 'フィーチャーを発見';
        else label = 'ノードを展開（分解）';
        break;
      }
      case 'transition': {
        node = ev.node;
        if (ev.machine === 'estimate-agreement') {
          label = ev.to === 'agreed' ? '見積を承認' : '見積を提案';
        } else {
          const prior = lifecycleOf.get(ev.node);
          if (prior === ev.to) {
            // Same-state attendant transition (latest-wins attr update).
            if (ev.reviewer !== undefined) label = 'レビュー担当を指名';
            else if (ev.assignee !== undefined) label = '担当を割当';
            else label = '更新';
          } else {
            switch (ev.to) {
              case 'ready':
                label = '準備完了';
                break;
              case 'implementing':
                label =
                  prior === 'implemented' || prior === 'accepted'
                    ? '差し戻し（再着手）'
                    : '着手';
                break;
              case 'implemented':
                label = '作成完了（レビュー待ち）';
                break;
              case 'accepted':
                label = '承認';
                break;
              case 'cancelled':
                label = '中止';
                break;
              default:
                label = String(ev.to);
            }
          }
          lifecycleOf.set(ev.node, ev.to as LifecycleState);
        }
        break;
      }
      case 'relate': {
        node = ev.to;
        label =
          ev.edgeKind === 'supersede'
            ? '差し替え（supersede）'
            : `依存を追加（${ev.policy ?? 'implemented'}）`;
        break;
      }
      case 'cost': {
        node = ev.node;
        label = 'コストを計上';
        break;
      }
    }

    rows.push({ id: ev.id, ts: ev.ts, actor: ev.actor, node, kind: ev.kind, label });
  }

  return rows;
}
