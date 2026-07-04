// Roster import pipeline (pure, testable): parse → validate → plan.
//   parse{Members,Calendar,Holiday}Sheet — read each sheet into typed rows (+cell errors)
//   validateMembersImport — cross-row + against-existing-roster checks (all at once)
//   planMembersImport     — rows → upserted roster + actorLabels + CapacityEntry[]
// Nothing here writes to disk. commands.ts wires it to the repo and only commits
// when the error list is empty (all-or-nothing).
//
// Key model discipline (issue #11 guardrails):
//   - The roster is a SEPARATE tier, never events; the engine reads only c(i,d)
//     (D-16/D-30). A holiday is materialized as per-person c=0 rows — no new
//     "calendar" concept enters the engine.
//   - reason PREFIXES are a strict regime: CapacitySurface classifies a cell by
//     the reason's leading word (before ':'). We emit 'leave:' / 'holiday:' /
//     'temporary-reduction:' so the heatmap colors them correctly.

import ExcelJS from 'exceljs';
import type { CapacityEntry } from 'moira-backend';
import { parseActor } from '../actors.js';
import { capacityEntry } from '../emit.js';
import type { Stamper } from '../stamp.js';
import type { Member } from '../store.js';
import { cellIsoDate, cellNumber, cellString } from './util.js';

export interface MemberRow {
  rowIndex: number;
  id: string;
  name: string;
  defaultCapacity: number | null;
}
export interface CalendarRow {
  rowIndex: number;
  memberId: string;
  date: string; // ISO
  capacity: number;
  reason: string; // raw memo (no prefix); planMembersImport adds the regime prefix
}
export interface HolidayRow {
  rowIndex: number;
  date: string; // ISO
  name: string;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/:-]*$/; // allows the agent:xxx form

const MCOL = { id: 1, name: 2, cap: 3 } as const;
const CCOL = { member: 1, date: 2, cap: 3, reason: 4 } as const;
const HCOL = { date: 1, name: 2 } as const;

// --- parse ------------------------------------------------------------------

export function parseMembersSheet(ws: ExcelJS.Worksheet): { rows: MemberRow[]; errors: string[] } {
  const rows: MemberRow[] = [];
  const errors: string[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const id = cellString(row.getCell(MCOL.id));
    const name = cellString(row.getCell(MCOL.name));
    const capCell = cellNumber(row.getCell(MCOL.cap));
    if (id === '' && name === '' && capCell === null) return; // fully-empty row
    let defaultCapacity: number | null = null;
    if (capCell === 'invalid') errors.push(`要員 行${rowNumber}: 既定稼働率 が数値ではありません`);
    else defaultCapacity = capCell;
    rows.push({ rowIndex: rowNumber, id, name, defaultCapacity });
  });
  return { rows, errors };
}

export function parseCalendarSheet(ws: ExcelJS.Worksheet): { rows: CalendarRow[]; errors: string[] } {
  const rows: CalendarRow[] = [];
  const errors: string[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const memberId = cellString(row.getCell(CCOL.member));
    const dateCell = cellIsoDate(row.getCell(CCOL.date));
    const capCell = cellNumber(row.getCell(CCOL.cap));
    const reason = cellString(row.getCell(CCOL.reason));
    if (memberId === '' && dateCell === null && capCell === null && reason === '') return;
    let date = '';
    if (dateCell === 'invalid') errors.push(`個人カレンダー 行${rowNumber}: 日付 が読めません（YYYY-MM-DD）`);
    else if (dateCell === null) errors.push(`個人カレンダー 行${rowNumber}: 日付 は必須です`);
    else date = dateCell;
    let capacity = 0;
    if (capCell === 'invalid') errors.push(`個人カレンダー 行${rowNumber}: 稼働率 が数値ではありません`);
    else if (capCell === null) errors.push(`個人カレンダー 行${rowNumber}: 稼働率 は必須です`);
    else capacity = capCell;
    rows.push({ rowIndex: rowNumber, memberId, date, capacity, reason });
  });
  return { rows, errors };
}

export function parseHolidaySheet(ws: ExcelJS.Worksheet): { rows: HolidayRow[]; errors: string[] } {
  const rows: HolidayRow[] = [];
  const errors: string[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const dateCell = cellIsoDate(row.getCell(HCOL.date));
    const name = cellString(row.getCell(HCOL.name));
    if (dateCell === null && name === '') return;
    let date = '';
    if (dateCell === 'invalid') errors.push(`祝日 行${rowNumber}: 日付 が読めません（YYYY-MM-DD）`);
    else if (dateCell === null) errors.push(`祝日 行${rowNumber}: 日付 は必須です`);
    else date = dateCell;
    rows.push({ rowIndex: rowNumber, date, name });
  });
  return { rows, errors };
}

// --- validate ---------------------------------------------------------------

/** Collect EVERY semantic error at once (never write on any error). */
export function validateMembersImport(
  members: readonly MemberRow[],
  calendar: readonly CalendarRow[],
  holidays: readonly HolidayRow[],
  existing: readonly Member[],
): string[] {
  const errors: string[] = [];
  const inFile = new Set<string>();
  const seen = new Set<string>();

  for (const m of members) {
    const at = `要員 行${m.rowIndex}`;
    if (m.id === '') {
      errors.push(`${at}: ID は必須です`);
      continue;
    }
    if (!ID_RE.test(m.id)) errors.push(`${at}: ID "${m.id}" が不正（英数と . - _ / : のみ）`);
    const bare = parseActor(m.id).id; // 'agent:claude' → 'claude' (Actor.id space)
    if (seen.has(bare)) errors.push(`${at}: ID "${m.id}" がファイル内で重複`);
    seen.add(bare);
    if (m.name === '') errors.push(`${at}: 氏名 は必須です`);
    if (m.defaultCapacity !== null && (m.defaultCapacity < 0 || m.defaultCapacity > 1)) {
      errors.push(`${at}: 既定稼働率 は 0〜1（${m.defaultCapacity}）`);
    }
    inFile.add(bare);
  }

  const known = new Set<string>([...inFile, ...existing.map((e) => e.id)]);

  for (const c of calendar) {
    const at = `個人カレンダー 行${c.rowIndex}`;
    if (c.memberId === '') errors.push(`${at}: 要員ID は必須です`);
    else if (!known.has(parseActor(c.memberId).id)) {
      errors.push(`${at}: 要員ID "${c.memberId}" はファイルにも既存名簿にも存在しません`);
    }
    if (c.date !== '' && (c.capacity < 0 || c.capacity > 1)) {
      errors.push(`${at}: 稼働率 は 0〜1（${c.capacity}）`);
    }
  }

  // holiday date/format errors are raised at parse time; nothing cross-row here.
  void holidays;
  return errors;
}

// --- plan -------------------------------------------------------------------

export interface MembersImportPlan {
  /** the roster after upsert (existing ∪ file; file wins on label/defaultCapacity). */
  members: Member[];
  /** id → 氏名, for a single setActorLabels call. */
  actorLabels: Record<string, string>;
  /** all capacity rows (personal calendar + holiday × human), ONE append. */
  capacityEntries: CapacityEntry[];
  warnings: string[];
}

/**
 * Build the commit plan. A SINGLE shared stamper must be passed so all c-rows of
 * one import share a monotonic ts run; a later re-import (new wall-clock ts) then
 * wins per (human,date) via CapacityStore's latest-ts rule. Holiday rows are
 * appended BEFORE calendar rows so a personal calendar entry overrides a blanket
 * holiday on the same (human,date) within one import (equal-ts → later wins).
 */
export function planMembersImport(
  members: readonly MemberRow[],
  calendar: readonly CalendarRow[],
  holidays: readonly HolidayRow[],
  existing: readonly Member[],
  stamp: Stamper,
): MembersImportPlan {
  const warnings: string[] = [];

  // upsert roster: start from existing, overwrite/append with file rows. Ids are
  // normalized to the bare Actor.id space (parseActor) so a roster entry matches
  // the assignee/label/capacity ids the rest of the system uses.
  const byId = new Map<string, Member>(existing.map((e) => [e.id, e]));
  const actorLabels: Record<string, string> = {};
  for (const m of members) {
    const actor = parseActor(m.id);
    const member: Member = { id: actor.id, kind: actor.kind, label: m.name };
    if (m.defaultCapacity !== null) member.defaultCapacity = m.defaultCapacity;
    byId.set(actor.id, member);
    actorLabels[actor.id] = m.name;
  }
  const roster = [...byId.values()];

  const capacityEntries: CapacityEntry[] = [];

  // 1. holidays → every current human member gets c=0 on that date.
  const humans = roster.filter((m) => m.kind === 'human');
  for (const h of holidays) {
    const reason = `holiday: ${h.name === '' ? '祝日' : h.name}`;
    for (const m of humans) {
      capacityEntries.push(capacityEntry(stamp(), m.id, h.date, 0, reason));
    }
  }
  if (holidays.length > 0 && humans.length === 0) {
    warnings.push('祝日行がありますが名簿に human がいないため展開されませんでした');
  }

  // 2. personal calendar rows → per (member,date). 0 = leave, else temporary-reduction.
  for (const c of calendar) {
    const memo = c.reason.trim();
    const reason =
      c.capacity === 0
        ? `leave: ${memo === '' ? '個人休' : memo}`
        : `temporary-reduction: ${memo === '' ? '個人カレンダー' : memo}`;
    capacityEntries.push(capacityEntry(stamp(), parseActor(c.memberId).id, c.date, c.capacity, reason));
  }

  // v1 honesty: defaultCapacity < 1.0 is retained on the roster but NOT
  // materialized into c-entries (engine default stays 1.0).
  for (const m of members) {
    if (m.defaultCapacity !== null && m.defaultCapacity < 1) {
      warnings.push(
        `要員 "${m.id}": 既定稼働率 ${m.defaultCapacity} は名簿に保持されますが c には反映しません（実レートは個人カレンダー/moira capacity で）`,
      );
    }
  }

  return { members: roster, actorLabels, capacityEntries, warnings };
}
