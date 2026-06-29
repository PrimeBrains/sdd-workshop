// Display-only label lookups. Node ids and actor ids are model identities; these
// map them to human-readable Japanese labels for the UI. No model semantics.
//
// Resolution order: user-supplied labels (injected at boot from a real project's
// `.moira/labels.json` via window.__MOIRA_FIXTURE__) → DEMO labels → raw id.
// User labels are a module-level registry set once before render (main.tsx), so
// the call sites below stay pure functions — no surface changes needed.

import type { Actor, NodeId } from './engine';
import { DEMO_ACTORS, DEMO_NODE_LABELS } from './demo-data';

let userNodeLabels: Record<string, string> = {};
let userActorLabels: Record<string, string> = {};

/** Install user-supplied display labels (presentation-only; not model data). */
export function setUserLabels(
  nodeLabels?: Record<string, string>,
  actorLabels?: Record<string, string>,
): void {
  userNodeLabels = nodeLabels ?? {};
  userActorLabels = actorLabels ?? {};
}

export function labelOf(node: NodeId): string {
  return userNodeLabels[node] ?? DEMO_NODE_LABELS[node] ?? node;
}

export function actorLabel(actor: Actor): string {
  return userActorLabels[actor.id] ?? DEMO_ACTORS[actor.id]?.label ?? actor.id;
}
