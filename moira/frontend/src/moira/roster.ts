// The ROSTER registry — who exists to be assigned/scheduled/shown. A module-level
// registry set once at boot from the injected fixture (main.tsx), mirroring
// labels.ts. Kept out of MoiraState so the surfaces stay pure projections.
//
// The whole point of this registry (issue #11): when a REAL project is connected
// (fixtureMode), the UI must show ONLY the names the user actually supplied —
// never the demo roster (田中/佐藤/…). See useRoster() in hooks.ts for the exact
// demo / members / observed-derivation rules.

import type { Actor } from './engine';

export interface RosterMember {
  id: string; // bare Actor.id (matches assignee / label / capacity ids)
  kind: 'human' | 'agent';
  label: string;
  defaultCapacity?: number;
}

export interface RosterState {
  /** flipped true the moment setRoster is called — the demo/real switch. */
  fixtureMode: boolean;
  /** the fixture roster (.moira/members.json). May be empty even in fixtureMode. */
  members: readonly RosterMember[];
  /** the viewpoint actor (.moira/config.json `me`), or null if not supplied. */
  me: Actor | null;
}

let state: RosterState = { fixtureMode: false, members: [], me: null };

/** Convert a stored id / spec string to an Actor (agent:xxx → agent). */
export function actorFromId(id: string): Actor {
  if (id.startsWith('agent:')) return { kind: 'agent', id: id.slice('agent:'.length) };
  if (id.startsWith('human:')) return { kind: 'human', id: id.slice('human:'.length) };
  return { kind: 'human', id };
}

/**
 * Install the fixture roster. Calling this AT ALL flips fixtureMode on — even
 * with an empty members list — because that is the signal that a real project
 * (not the demo) is connected. main.tsx calls it whenever a fixture is present.
 */
export function setRoster(members?: readonly RosterMember[], meId?: string): void {
  state = {
    fixtureMode: true,
    members: members ?? [],
    me: meId !== undefined && meId !== '' ? actorFromId(meId) : null,
  };
}

export function rosterState(): RosterState {
  return state;
}

/** Test-only reset (module state leaks across tests otherwise). */
export function resetRosterForTests(): void {
  state = { fixtureMode: false, members: [], me: null };
}
