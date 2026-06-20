// Thin read interface (primary): print a derived-state snapshot as JSON, with a
// human-readable pair-read header. This is the "薄い口" of the S4 backbone —
// event log → derivation → display (R-S2 MODEL:283). It does NOT re-implement
// any calculation; it just calls derive().
//
// Usage:
//   npm run snapshot                       # bundled golden fixture
//   npm run snapshot -- --asOf 2026-01-15
//   npm run snapshot -- --log log.json --capacity capacity.json --asOf 2026-02-01

import { readFileSync } from 'node:fs';
import { CapacityStore } from '../capacity-store.js';
import { derive, type DeriveOptions } from '../derive.js';
import { TINY_AS_OF, tinyProjectEvents } from '../fixtures/tiny-project.js';
import type { Event } from '../types.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function fmt(n: number | null): string {
  return n === null ? '  n/a' : n.toFixed(2);
}

const logPath = arg('--log');
const capacityPath = arg('--capacity');
const asOf = arg('--asOf') ?? TINY_AS_OF;
const startDate = arg('--startDate');

const events: readonly Event[] = logPath
  ? (JSON.parse(readFileSync(logPath, 'utf8')) as Event[])
  : tinyProjectEvents;

const options: DeriveOptions = { asOf };
if (startDate !== undefined) options.startDate = startDate;
if (capacityPath !== undefined) {
  const store = new CapacityStore();
  store.loadJson(capacityPath);
  options.capacityOf = store.lookup();
}

const d = derive(events, options);

const lines = [
  `Moira S4 — derived snapshot @ ${d.asOf}`,
  `  EV%  ${fmt(d.evPercent)} | estimate coverage ${fmt(d.estimateCoverage)}   (pair-read R-S4)`,
  `  SPI  ${fmt(d.spi)} | schedule coverage ${fmt(d.scheduleCoverage)}   (pair-read R-S6)`,
  `  EV_abs ${d.evAbs} | PV ${d.pv} | AC ${d.ac} | CPI ${fmt(d.cpi)}`,
  `  review queue ${JSON.stringify(d.humanReviewQueue)} | agent queue ${JSON.stringify(
    d.agentWorkQueue,
  )} | unassigned ${JSON.stringify(d.unassignedBacklog)}`,
];
if (d.structuralErrors.length > 0) {
  lines.push(`  structural errors: ${d.structuralErrors.length}`);
}

// eslint-disable-next-line no-console
console.error(lines.join('\n'));
// eslint-disable-next-line no-console
console.log(JSON.stringify(d, null, 2));
