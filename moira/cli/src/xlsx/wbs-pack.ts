// Bin-packing for the WBS import — fills in a predicted completion (frozenSlot)
// for rows that leave the date columns blank.
//
// WHY NOT reuse the leveler: the leveler is the FORECAST (EAC) side's sanctum and
//   (a) tie-breaks by nodeId ascending, not "top row first";
//   (b) can't honor a user's partially-written dates;
//   (c) returns only completions, with its own shared-capacity accounting.
// So this is a separate, simpler packer. It DOES keep the leveler's calendar
// discipline identical (skip c=0 days, human consumes c(i,d), agent = ceil(est)
// calendar days, MAX_DAYS guard). Only the completion (frozenSlot) reaches the
// event log — the start day is an internal packing quantity that has no place in
// the model (D-30).

import { parseActor } from '../actors.js';
import { addDays, maxDate } from '../dates.js';
import type { IsoDate } from 'moira-backend';
import type { WbsRow } from './wbs-import.js';

export type CapacityOf = (humanId: string, date: IsoDate) => number;

const MAX_DAYS = 3650; // guard against an all-zero-capacity run (leveler parity)
const EPSILON = 1e-9;

/**
 * Deterministic packing: Kahn topo order over the in-file dependency graph with
 * the ready set always taken in ROW order (先行なしは行順・先行ありはチェーン順),
 * one assignee = one task at a time (per-assignee cursor). Returns each row's
 * completion slot (null if not schedulable). Same input → identical Map.
 */
export function packSchedule(
  rows: readonly WbsRow[],
  capacityOf: CapacityOf,
  startDate: IsoDate,
): Map<string, IsoDate | null> {
  const byId = new Map<string, WbsRow>();
  for (const r of rows) byId.set(r.id, r);

  // In-file dependency graph only. A predecessor that names an EXISTING-log node
  // already has its slot in the log — out of scope for packing (disclosed).
  const preds = new Map<string, string[]>();
  const succ = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const r of rows) {
    preds.set(r.id, []);
    succ.set(r.id, []);
    indeg.set(r.id, 0);
  }
  for (const r of rows) {
    for (const p of r.predecessors) {
      if (!byId.has(p)) continue;
      preds.get(r.id)!.push(p);
      succ.get(p)!.push(r.id);
      indeg.set(r.id, (indeg.get(r.id) ?? 0) + 1);
    }
  }

  const rowOrder = new Map<string, number>();
  rows.forEach((r) => rowOrder.set(r.id, r.rowIndex));
  const ready = rows.filter((r) => (indeg.get(r.id) ?? 0) === 0).map((r) => r.id);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => rowOrder.get(a)! - rowOrder.get(b)!);
    const id = ready.shift()!;
    order.push(id);
    for (const s of succ.get(id) ?? []) {
      indeg.set(s, (indeg.get(s) ?? 0) - 1);
      if ((indeg.get(s) ?? 0) === 0) ready.push(s);
    }
  }
  // A leftover node implies a cycle — caught by validateWbs before we get here.

  const slot = new Map<string, IsoDate | null>();
  const cursor = new Map<string, IsoDate>(); // per-assignee next free day
  const advance = (who: string, nextFree: IsoDate): void => {
    const c = cursor.get(who);
    cursor.set(who, c === undefined ? nextFree : maxDate(c, nextFree));
  };

  for (const id of order) {
    const r = byId.get(id)!;

    // Earliest start from in-file predecessors = max(pred completion) + 1 day.
    let predStart: IsoDate | null = null;
    for (const p of preds.get(id) ?? []) {
      const pc = slot.get(p);
      if (pc) predStart = predStart === null ? addDays(pc, 1) : maxDate(predStart, addDays(pc, 1));
    }

    // Completed rows (実績終了日 present) are never packed forward: bin-packing
    // finished work into the future would fabricate a baseline and eat the
    // assignee's future capacity. A WRITTEN 予定終了日 is still honored (branch
    // below); a blank one stays null — disclosed via warning + scheduleCoverage.
    if (r.actualEnd !== null && r.plannedEnd === null) {
      slot.set(id, null);
      continue;
    }

    // No assignee → no assign (slot null). No estimate → no duration (slot null).
    if (r.assignee === null || r.estimate === null) {
      slot.set(id, null);
      continue;
    }

    // Both dates written: adopt the end as-is (capacity consumption is NOT
    // replayed — disclosed simplification), advance the cursor past it.
    if (r.plannedStart !== null && r.plannedEnd !== null) {
      slot.set(id, r.plannedEnd);
      advance(r.assignee, addDays(r.plannedEnd, 1));
      continue;
    }
    // End only: freeze that end, advance the cursor.
    if (r.plannedEnd !== null) {
      slot.set(id, r.plannedEnd);
      advance(r.assignee, addDays(r.plannedEnd, 1));
      continue;
    }

    // Determine the fill start.
    let start: IsoDate;
    if (r.plannedStart !== null) {
      // Start only: honor the user's start (cursor ignored), but never earlier
      // than a predecessor requires.
      start = predStart === null ? r.plannedStart : maxDate(r.plannedStart, predStart);
    } else {
      start = startDate;
      const c = cursor.get(r.assignee);
      if (c !== undefined) start = maxDate(start, c);
      if (predStart !== null) start = maxDate(start, predStart);
    }

    const actor = parseActor(r.assignee);
    let end: IsoDate | null;
    if (actor.kind === 'agent') {
      // Not leveled: lead time = ceil(est) calendar days (leveler parity, R-T2).
      const days = Math.max(1, Math.ceil(r.estimate));
      end = addDays(start, days - 1);
    } else {
      end = fillHuman(actor.id, r.estimate, start, capacityOf);
    }
    slot.set(id, end);
    if (end !== null) advance(r.assignee, addDays(end, 1));
  }

  for (const r of rows) if (!slot.has(r.id)) slot.set(r.id, null);
  return slot;
}

/** Human fill: consume c(i,d) per day, skip c=0 days, until the estimate is met. */
function fillHuman(
  humanId: string,
  est: number,
  start: IsoDate,
  capacityOf: CapacityOf,
): IsoDate | null {
  if (est <= EPSILON) return start;
  let remaining = est;
  let day = start;
  for (let g = 0; g < MAX_DAYS; g += 1) {
    const cap = capacityOf(humanId, day);
    if (cap > EPSILON) {
      remaining -= cap;
      if (remaining <= EPSILON) return day;
    }
    day = addDays(day, 1);
  }
  return null; // all-zero capacity within the guard window
}
