// .moira/ repository — the per-repo data dir the CLI reads and appends to.
//   events.json   append-only log of the four events (single source of truth)
//   capacity.json c(i,d) second tier (CapacityEntry[])
//   dates.json    deadline / target-date second tier (R-T6 MODEL:233-240;
//                 append-only, reason-stamped, timestamped — R-U14-isomorphic,
//                 project-level single via latest-ts resolution)
//   labels.json   presentation-only display labels (NOT model data)
//   members.json  the ROSTER — who exists to be assigned/scheduled (issue #11).
//                 A separate storage tier, NOT events and NOT a calendar concept:
//                 the engine still sees only c(i,d) (D-16/D-30). Used to seed the
//                 UI roster so no name the user never supplied leaks into a view.
//   config.json   projectRoot / me / default asOf
// Uses the engine's EventStore/CapacityStore for load+save (deterministic order).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CapacityStore, EventStore } from 'moira-backend';
import type { CapacityEntry, Event } from 'moira-backend';

export interface MoiraConfig {
  projectRoot: string;
  me: string;
  asOf?: string;
  startDate?: string;
}

export interface Labels {
  nodeLabels: Record<string, string>;
  actorLabels: Record<string, string>;
}

/**
 * A roster member — a person or agent that exists to be assigned/scheduled.
 * This is deliberately NOT an event and NOT a calendar concept: the engine reads
 * only c(i,d) (D-16), and membership lives in its own storage tier (D-30). It
 * exists so the UI can show ONLY the names the user actually supplied — never the
 * demo roster — even before any capacity/assignment data exists.
 *   defaultCapacity is retained for display/future use; v1 does NOT materialize it
 *   into c-entries (the engine default stays 1.0). Omit the key when absent
 *   (exactOptionalPropertyTypes).
 */
export interface Member {
  id: string;
  kind: 'human' | 'agent';
  label: string;
  defaultCapacity?: number;
}

/**
 * R-T6 reference dates (MODEL:233-240, §2.1#3 MODEL:67): the project deadline
 * (externally imposed hard ceiling) and target date (human-managed planned-
 * completion reference) are second-tier CONFIGURATION INPUTS — never events.
 * Stored as an append-only, reason-stamped, timestamped history (isomorphic to
 * capacity.json's R-U14 discipline); "project-level single" is realized by
 * latest-ts resolution, exactly like CapacityStore.capacityOf.
 */
export interface ReferenceDateEntry {
  kind: 'deadline' | 'target';
  date: string; // IsoDate 'YYYY-MM-DD'
  reason: string;
  ts: number;
}

export interface ReferenceDates {
  deadline?: string;
  targetDate?: string;
}

/** Strict 'YYYY-MM-DD' — shape AND calendar existence (rejects 2026-02-30). */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === s;
}

/** Latest-ts entry wins per kind (ties: the later entry, like CapacityStore). */
export function resolveReferenceDates(
  entries: readonly ReferenceDateEntry[],
): ReferenceDates {
  let deadline: ReferenceDateEntry | undefined;
  let target: ReferenceDateEntry | undefined;
  for (const e of entries) {
    if (e.kind === 'deadline' && (deadline === undefined || e.ts >= deadline.ts)) deadline = e;
    if (e.kind === 'target' && (target === undefined || e.ts >= target.ts)) target = e;
  }
  return {
    ...(deadline !== undefined ? { deadline: deadline.date } : {}),
    ...(target !== undefined ? { targetDate: target.date } : {}),
  };
}

export class MoiraRepo {
  readonly dir: string;
  readonly eventsPath: string;
  readonly capacityPath: string;
  readonly datesPath: string;
  readonly labelsPath: string;
  readonly membersPath: string;
  readonly configPath: string;

  constructor(cwd: string) {
    this.dir = join(cwd, '.moira');
    this.eventsPath = join(this.dir, 'events.json');
    this.capacityPath = join(this.dir, 'capacity.json');
    this.datesPath = join(this.dir, 'dates.json');
    this.labelsPath = join(this.dir, 'labels.json');
    this.membersPath = join(this.dir, 'members.json');
    this.configPath = join(this.dir, 'config.json');
  }

  exists(): boolean {
    return existsSync(this.configPath);
  }

  init(config: MoiraConfig): void {
    mkdirSync(this.dir, { recursive: true });
    if (!existsSync(this.eventsPath)) writeFileSync(this.eventsPath, '[]\n', 'utf8');
    if (!existsSync(this.capacityPath)) writeFileSync(this.capacityPath, '[]\n', 'utf8');
    if (!existsSync(this.datesPath)) writeFileSync(this.datesPath, '[]\n', 'utf8');
    if (!existsSync(this.labelsPath)) this.writeLabels({ nodeLabels: {}, actorLabels: {} });
    if (!existsSync(this.membersPath)) writeFileSync(this.membersPath, '[]\n', 'utf8');
    this.writeConfig(config);
  }

  // --- config ---
  loadConfig(): MoiraConfig {
    return JSON.parse(readFileSync(this.configPath, 'utf8')) as MoiraConfig;
  }
  writeConfig(config: MoiraConfig): void {
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  // --- events ---
  loadEvents(): Event[] {
    if (!existsSync(this.eventsPath)) return [];
    return JSON.parse(readFileSync(this.eventsPath, 'utf8')) as Event[];
  }
  appendEvents(events: readonly Event[]): void {
    const store = new EventStore();
    if (existsSync(this.eventsPath)) store.loadJson(this.eventsPath);
    store.appendAll(events);
    store.saveJson(this.eventsPath);
  }

  // --- capacity ---
  loadCapacity(): CapacityEntry[] {
    if (!existsSync(this.capacityPath)) return [];
    return JSON.parse(readFileSync(this.capacityPath, 'utf8')) as CapacityEntry[];
  }
  appendCapacity(entries: readonly CapacityEntry[]): void {
    const store = new CapacityStore();
    if (existsSync(this.capacityPath)) store.loadJson(this.capacityPath);
    store.appendAll(entries);
    store.saveJson(this.capacityPath);
  }

  // --- reference dates (R-T6 second tier; append-only, latest-ts wins) ---
  loadDateEntries(): ReferenceDateEntry[] {
    if (!existsSync(this.datesPath)) return [];
    return JSON.parse(readFileSync(this.datesPath, 'utf8')) as ReferenceDateEntry[];
  }
  appendDateEntries(entries: readonly ReferenceDateEntry[]): void {
    const all = [...this.loadDateEntries(), ...entries];
    writeFileSync(this.datesPath, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  }

  // --- labels (presentation-only) ---
  loadLabels(): Labels {
    if (!existsSync(this.labelsPath)) return { nodeLabels: {}, actorLabels: {} };
    return JSON.parse(readFileSync(this.labelsPath, 'utf8')) as Labels;
  }
  private writeLabels(labels: Labels): void {
    writeFileSync(this.labelsPath, `${JSON.stringify(labels, null, 2)}\n`, 'utf8');
  }
  setNodeLabel(node: string, label: string): void {
    const labels = this.loadLabels();
    labels.nodeLabels[node] = label;
    this.writeLabels(labels);
  }
  setActorLabel(id: string, label: string): void {
    const labels = this.loadLabels();
    labels.actorLabels[id] = label;
    this.writeLabels(labels);
  }
  // Bulk variants for `import wbs` — one load + one write (avoid O(n²) per-row I/O).
  setNodeLabels(map: Record<string, string>): void {
    const labels = this.loadLabels();
    Object.assign(labels.nodeLabels, map);
    this.writeLabels(labels);
  }
  setActorLabels(map: Record<string, string>): void {
    const labels = this.loadLabels();
    Object.assign(labels.actorLabels, map);
    this.writeLabels(labels);
  }

  // --- members (the roster; separate tier, NOT events — D-16/D-30) ---
  loadMembers(): Member[] {
    if (!existsSync(this.membersPath)) return [];
    return JSON.parse(readFileSync(this.membersPath, 'utf8')) as Member[];
  }
  saveMembers(members: readonly Member[]): void {
    writeFileSync(this.membersPath, `${JSON.stringify(members, null, 2)}\n`, 'utf8');
  }
}
