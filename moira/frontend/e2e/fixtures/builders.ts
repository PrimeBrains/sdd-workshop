// Deterministic event-log builder for scenario fixtures. Mirrors the builder shape
// in moira/backend/src/fixtures/tiny-project.ts (decompose/agree/dep/life) so a
// scenario unit's §5 event JSON maps 1:1 onto calls here. One monotonic `ts`
// counter per log → a stable total order (no Date.now / Math.random).
//
// Type-only imports from engine (erased at runtime) keep this safe to import from
// Playwright specs; the objects produced are plain serializable literals.
import { type Actor, type Event, type IsoDate } from '../../src/moira/engine';

/** The reviewer/approver human used across the spec-lifecycle scenarios (太郎). */
export const TARO: Actor = { kind: 'human', id: 'dev:taro' };
/** The authoring agent across the spec-lifecycle scenarios (Claude). */
export const CLAUDE: Actor = { kind: 'agent', id: 'claude' };

export type LifecycleTo = 'ready' | 'implementing' | 'implemented' | 'accepted' | 'cancelled';

export interface LifecycleExtra {
  assignee?: Actor;
  reviewer?: Actor;
  frozenSlot?: IsoDate;
  reason?: string;
}

export interface LogBuilder {
  decompose(
    parent: string,
    children: ReadonlyArray<{ node: string; estimate: number }>,
    reason: string,
    actor?: Actor,
  ): LogBuilder;
  agree(node: string, frozenBudget: number, actor?: Actor): LogBuilder;
  dep(from: string, to: string, policy: 'accepted' | 'implemented', actor?: Actor): LogBuilder;
  life(node: string, to: LifecycleTo, actor: Actor, extra?: LifecycleExtra): LogBuilder;
  build(): readonly Event[];
}

export function makeLog(): LogBuilder {
  const events: Event[] = [];
  let seq = 0;
  const stamp = () => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: seq };
  };

  const api: LogBuilder = {
    decompose(parent, children, reason, actor = CLAUDE) {
      events.push({
        kind: 'decompose',
        ...stamp(),
        actor,
        parent,
        reason,
        children: children.map((c) => ({ node: c.node, estimate: c.estimate })),
      });
      return api;
    },
    agree(node, frozenBudget, actor = TARO) {
      events.push({
        kind: 'transition',
        ...stamp(),
        actor,
        node,
        machine: 'estimate-agreement',
        to: 'agreed',
        frozenBudget,
      });
      return api;
    },
    dep(from, to, policy, actor = CLAUDE) {
      events.push({
        kind: 'relate',
        ...stamp(),
        actor,
        op: 'add',
        from,
        to,
        edgeKind: 'dependency',
        policy,
      });
      return api;
    },
    life(node, to, actor, extra) {
      events.push({
        kind: 'transition',
        ...stamp(),
        actor,
        node,
        machine: 'lifecycle',
        to,
        ...extra,
      });
      return api;
    },
    build() {
      return events;
    },
  };
  return api;
}
