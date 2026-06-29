// Actor parsing. Conventions for the --to / --reviewer / --actor flags:
//   "agent:claude" → { kind:'agent', id:'claude' }
//   "human:alice" or plain "alice" → { kind:'human', id:'alice' }
// Plain ids default to human (the common case: a developer recording their work).

import type { Actor } from 'moira-backend';

export function parseActor(spec: string): Actor {
  if (spec.startsWith('agent:')) return { kind: 'agent', id: spec.slice('agent:'.length) };
  if (spec.startsWith('human:')) return { kind: 'human', id: spec.slice('human:'.length) };
  return { kind: 'human', id: spec };
}

export function actorSpec(a: Actor): string {
  return `${a.kind}:${a.id}`;
}
