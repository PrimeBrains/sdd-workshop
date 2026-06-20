// Display-only label lookups. Node ids and actor ids are model identities; these
// map them to human-readable Japanese labels for the UI. No model semantics.

import type { Actor, NodeId } from './engine';
import { DEMO_ACTORS, DEMO_NODE_LABELS } from './demo-data';

export function labelOf(node: NodeId): string {
  return DEMO_NODE_LABELS[node] ?? node;
}

export function actorLabel(actor: Actor): string {
  return DEMO_ACTORS[actor.id]?.label ?? actor.id;
}
