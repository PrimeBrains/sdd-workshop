// Decision-inbox items = predicates over the CURRENT derived/projected state
// (the S4 warnings the backend defers to presentation — backend §8.4). These are
// NOT stored: an item exists iff its condition holds right now, so appending an
// event that falsifies it makes it vanish on the next derive (no dismiss/seen —
// §2.1 self-state ban). De-rate-type signals (R-S4/R-S6) are NOT here; they live
// on health/spec-value as metric modifiers (UI-DESIGN-BRIEF §2.4).

import type { Actor, DerivedState, NodeId, ProjectedState } from './engine';
import { labelOf } from './labels';
import type { SurfaceId } from '../app/types';

/** the human-facing category each inbox item falls under (issue #12 sections). */
export type DecisionType = 'estimate' | 'assign' | 'accept' | 'warning';

export interface InboxItem {
  key: string;
  rid: string;
  kind: 'warning' | 'commit';
  /** which of the 4 plain-language sections this item belongs to (issue #12). */
  decisionType: DecisionType;
  title: string;
  node?: NodeId;
  surface: SurfaceId;
  actions: string[];
  clearWhen: string;
}

export function computeInbox(derived: DerivedState, projected: ProjectedState): InboxItem[] {
  const items: InboxItem[] = [];
  const supersededOld = new Set(projected.supersedeEdges.map((e) => e.to));
  const effective = (id: NodeId) => {
    const n = projected.nodes.get(id);
    return n !== undefined && n.lifecycle !== 'cancelled' && !supersededOld.has(id);
  };

  for (const [id, n] of projected.nodes) {
    if (!effective(id)) continue;
    const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';

    // R-U12 conflicting agreement (distinct agreed values across actors)
    const vals = new Set(n.agreedActorValues.values());
    if (vals.size > 1) {
      items.push({
        key: `R-U12:${id}`,
        rid: 'R-U12',
        kind: 'warning',
        decisionType: 'warning',
        title: `見積合意の矛盾: ${labelOf(id)}（${[...n.agreedActorValues.entries()].map(([a, v]) => `${a}=${v}`).join(' / ')}）`,
        node: id,
        surface: 'spec-value',
        actions: ['現行値で見積合意をやり直す'],
        clearWhen: '一致する値で見積合意をやり直すと消えます',
      });
    }

    // R-U13 unagreed completion
    if (completed && n.estimateState === 'proposed') {
      items.push({
        key: `R-U13:${id}`,
        rid: 'R-U13',
        kind: 'warning',
        decisionType: 'warning',
        title: `未合意完了: ${labelOf(id)}`,
        node: id,
        surface: 'spec-value',
        actions: ['事後合意', '再見積→合意', '中止'],
        clearWhen: '合意または中止の追記で消滅',
      });
    }

    // P5 at-risk (reached implemented, then regressed)
    if (n.reachedImplemented && n.lifecycle !== 'implemented' && n.lifecycle !== 'accepted' && n.lifecycle !== 'cancelled') {
      items.push({
        key: `P5:${id}`,
        rid: 'P5',
        kind: 'warning',
        decisionType: 'warning',
        title: `差し戻しリスク: ${labelOf(id)}（完了後に作業中へ後退）`,
        node: id,
        surface: 'spec-value',
        actions: ['状態を戻す', '再見積', '依存の付け替え'],
        clearWhen: '再び完了に到達すると消えます（後続の完了では消えません）',
      });
    }
  }

  // R-C3 cancel-orphan: a dependent whose predecessor was cancelled
  for (const e of projected.dependencyEdges) {
    const from = projected.nodes.get(e.from);
    if (from?.lifecycle === 'cancelled' && effective(e.to)) {
      items.push({
        key: `R-C3:${e.from}->${e.to}`,
        rid: 'R-C3',
        kind: 'warning',
        decisionType: 'warning',
        title: `前提タスクの中止: ${labelOf(e.to)}（前提 ${labelOf(e.from)} が中止）`,
        node: e.to,
        surface: 'schedule-time',
        actions: ['依存を外す', '代替に付け替え', '後続も中止'],
        clearWhen: '依存の付け替えか状態変更で消滅',
      });
    }
  }

  // commit decisions (the 4 in-inbox commitments; c宣言 is the 5th, on capacity)
  // ① estimate agreement needed — effective leaves still proposed
  for (const id of derived.effectiveLeaves) {
    const n = projected.nodes.get(id);
    if (n !== undefined && n.estimateState === 'proposed') {
      items.push({
        key: `commit-agree:${id}`,
        rid: 'commit·合意',
        kind: 'commit',
        decisionType: 'estimate',
        title: `見積合意が必要: ${labelOf(id)}（提案中）`,
        node: id,
        surface: 'spec-value',
        actions: ['見積に合意する（人間のみ）'],
        clearWhen: '合意の追記で消滅',
      });
    }
  }
  // ② assignment needed — agreed-but-unassigned backlog
  for (const id of derived.unassignedBacklog) {
    items.push({
      key: `commit-assign:${id}`,
      rid: 'commit·割当',
      kind: 'commit',
      decisionType: 'assign',
      title: `担当割当が必要: ${labelOf(id)}（未割当）`,
      node: id,
      surface: 'schedule-time',
      actions: ['担当を割り当てる'],
      clearWhen: '担当付与で消滅',
    });
  }
  // ③ acceptance needed — 検収待ち（implemented）の有効葉（backend humanReviewQueue）。
  // R-U13（未合意のまま完了）と同一ノードで併存し得るが意図的：片方は警告、
  // 片方は「受け入れる／差し戻す」という通常のコミット判断で、別の行為を促す。
  for (const id of derived.humanReviewQueue) {
    items.push({
      key: `commit-accept:${id}`,
      rid: 'commit·受入',
      kind: 'commit',
      decisionType: 'accept',
      title: `受入判断が必要: ${labelOf(id)}（完了・検収待ち）`,
      node: id,
      surface: 'schedule-time', // Inspector に →検収 / 差し戻し操作がある
      actions: ['受け入れる（検収）', '差し戻す'],
      clearWhen: '検収または差し戻しの追記で消滅',
    });
  }

  return items;
}

/**
 * True iff the item's node has the given actor as its assignee OR reviewer
 * (acceptance is the reviewer's job, so reviewers match too). Pure — no state.
 * Node-less items (e.g. R-C3 keyed on an edge always carries a node) never match.
 */
export function itemMatchesActor(
  item: InboxItem,
  projected: ProjectedState,
  actorId: string,
): boolean {
  if (item.node === undefined) return false;
  const n = projected.nodes.get(item.node);
  return n?.assignee?.id === actorId || n?.reviewer?.id === actorId;
}

/** Distinct actors appearing as an assignee or reviewer, id-sorted (filter options). Pure. */
export function assigneeOptions(projected: ProjectedState): Actor[] {
  const byId = new Map<string, Actor>();
  for (const n of projected.nodes.values()) {
    if (n.assignee !== null) byId.set(n.assignee.id, n.assignee);
    if (n.reviewer !== null) byId.set(n.reviewer.id, n.reviewer);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
