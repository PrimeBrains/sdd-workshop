import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { agent, human, Log } from '../test-utils.js';
import { computeEffectiveSet } from './effective-set.js';
import { computeQueues } from './queues.js';

describe('queues (P4 MODEL:174)', () => {
  it('filters the same scan into agent-work and human-review queues', () => {
    const state = fold(
      new Log()
        .decompose('F', [
          { node: 'agentTask' },
          { node: 'reviewTask' },
          { node: 'humanWip' },
          { node: 'doneTask' },
        ])
        .assign('agentTask', agent('bot'), 'implementing') // agent, in progress
        .assign('humanWip', human('alice'), 'implementing') // human, in progress
        .life('reviewTask', 'implemented') // awaiting human review
        .life('doneTask', 'accepted') // finished — in neither queue
        .all(),
    );
    const eff = computeEffectiveSet(state);
    const { agentWorkQueue, humanReviewQueue } = computeQueues(state, eff);

    expect(agentWorkQueue).toEqual(['agentTask']);
    expect(humanReviewQueue).toEqual(['reviewTask']);
    // disjoint
    expect(agentWorkQueue.filter((n) => humanReviewQueue.includes(n))).toEqual([]);
  });
});
