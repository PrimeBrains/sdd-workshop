// Display-only label lookups. Node ids and actor ids are model identities; these
// map them to human-readable Japanese labels for the UI. No model semantics.
//
// Resolution order:
//   - fixtureMode (a REAL project is connected): user labels → raw id. The DEMO
//     labels are BYPASSED, so a name the user never supplied (田中/佐藤/…) can
//     never leak into a real project's view (issue #11).
//   - demo mode (no fixture): user labels → DEMO labels → raw id (unchanged).
// User labels are a module-level registry set at boot (main.tsx) and refreshed by
// the live bridge, so the call sites below stay pure functions.

import type { Actor, NodeId } from './engine';
import { DEMO_ACTORS, DEMO_NODE_LABELS } from './demo-data';

let userNodeLabels: Record<string, string> = {};
let userActorLabels: Record<string, string> = {};
let fixtureMode = false;

/** Install user-supplied display labels (presentation-only; not model data). */
export function setUserLabels(
  nodeLabels?: Record<string, string>,
  actorLabels?: Record<string, string>,
): void {
  userNodeLabels = nodeLabels ?? {};
  userActorLabels = actorLabels ?? {};
}

/**
 * Mark that a real project (not the demo) is connected. Set ONCE at boot; the
 * live bridge's repeated setUserLabels calls must not flip it back. In this mode
 * DEMO label fallbacks are bypassed.
 */
export function setLabelsFixtureMode(on: boolean): void {
  fixtureMode = on;
}

export function labelOf(node: NodeId): string {
  if (fixtureMode) return userNodeLabels[node] ?? node;
  return userNodeLabels[node] ?? DEMO_NODE_LABELS[node] ?? node;
}

export function actorLabel(actor: Actor): string {
  if (fixtureMode) return userActorLabels[actor.id] ?? actor.id;
  return userActorLabels[actor.id] ?? DEMO_ACTORS[actor.id]?.label ?? actor.id;
}

/** Test-only reset (module state leaks across tests otherwise). */
export function resetLabelsForTests(): void {
  userNodeLabels = {};
  userActorLabels = {};
  fixtureMode = false;
}
