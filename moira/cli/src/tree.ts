// Tree-edge resolution for the write commands (issue #5). Pure functions over
// the folded ProjectedState — the command handlers fold the log, resolve here,
// then emit. No fs, no I/O: unit-testable in isolation.

import type { NodeId, ProjectedState } from 'moira-backend';

export interface ResolvedParent {
  parent: NodeId;
  /** stderr note/warning to surface (an honest fallback is a VISIBLE one, §2.1). */
  note?: string;
}

/**
 * Decide the decompose parent for `moira add <node>`:
 * 1. an explicit --parent always wins;
 * 2. the node already sits in the tree → reuse its current effective parent
 *    (the issue-#5 footgun: a --parent-less re-estimate must NOT re-root the
 *    node — it becomes a same-parent decompose whose edge already exists, so
 *    only the latest-wins estimate moves);
 * 3. otherwise (new node, or an orphan) → project root, but never silently.
 */
export function resolveAddParent(
  state: ProjectedState,
  node: NodeId,
  explicitParent: NodeId | undefined,
  projectRoot: NodeId,
): ResolvedParent {
  if (explicitParent !== undefined) return { parent: explicitParent };
  const existing = state.nodes.get(node)?.parent ?? null;
  if (existing !== null) {
    return {
      parent: existing,
      note: `note: --parent omitted — reusing existing parent '${existing}' for '${node}'`,
    };
  }
  return {
    parent: projectRoot,
    note: `warning: --parent omitted — attaching '${node}' under project root '${projectRoot}'`,
  };
}
