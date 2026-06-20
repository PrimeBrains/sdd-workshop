// (10) Queues — P4 MODEL:174: the agent work queue and the human review queue
// are the SAME query over the DAG × log, differing only by an actor filter.
// One scan, two filters.
//
//   agentWorkQueue  = effective leaves in {ready, implementing} assigned to an agent
//   humanReviewQueue = effective leaves at `implemented` (the human
//                      implemented→accepted review, §2.5 MODEL:112)

import type { NodeId, ProjectedState } from '../types.js';
import type { EffectiveSet } from './effective-set.js';

export interface Queues {
  agentWorkQueue: NodeId[];
  humanReviewQueue: NodeId[];
}

export function computeQueues(
  state: ProjectedState,
  eff: EffectiveSet,
): Queues {
  const agentWorkQueue: NodeId[] = [];
  const humanReviewQueue: NodeId[] = [];

  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    const inProgress = n.lifecycle === 'ready' || n.lifecycle === 'implementing';
    if (inProgress && n.assignee?.kind === 'agent') {
      agentWorkQueue.push(id);
    }
    if (n.lifecycle === 'implemented') {
      humanReviewQueue.push(id);
    }
  }

  agentWorkQueue.sort();
  humanReviewQueue.sort();
  return { agentWorkQueue, humanReviewQueue };
}
