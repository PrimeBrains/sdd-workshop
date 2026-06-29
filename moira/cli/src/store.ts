// .moira/ repository — the per-repo data dir the CLI reads and appends to.
//   events.json   append-only log of the four events (single source of truth)
//   capacity.json c(i,d) second tier (CapacityEntry[])
//   labels.json   presentation-only display labels (NOT model data)
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

export class MoiraRepo {
  readonly dir: string;
  readonly eventsPath: string;
  readonly capacityPath: string;
  readonly labelsPath: string;
  readonly configPath: string;

  constructor(cwd: string) {
    this.dir = join(cwd, '.moira');
    this.eventsPath = join(this.dir, 'events.json');
    this.capacityPath = join(this.dir, 'capacity.json');
    this.labelsPath = join(this.dir, 'labels.json');
    this.configPath = join(this.dir, 'config.json');
  }

  exists(): boolean {
    return existsSync(this.configPath);
  }

  init(config: MoiraConfig): void {
    mkdirSync(this.dir, { recursive: true });
    if (!existsSync(this.eventsPath)) writeFileSync(this.eventsPath, '[]\n', 'utf8');
    if (!existsSync(this.capacityPath)) writeFileSync(this.capacityPath, '[]\n', 'utf8');
    if (!existsSync(this.labelsPath)) this.writeLabels({ nodeLabels: {}, actorLabels: {} });
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
}
