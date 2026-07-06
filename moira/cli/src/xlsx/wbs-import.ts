// WBS import pipeline (pure, testable): parse → validate → plan.
//   parseWbsSheet  — read the `WBS` sheet into typed rows (+ cell-format errors)
//   validateWbs    — cross-row + against-existing-log semantic checks (all at once)
//   planWbsEvents  — rows + packed slots → the canonical event list (+ labels/warnings)
// Nothing here writes to disk. commands.ts wires it to the repo and only appends
// when the error list is empty (all-or-nothing).

import ExcelJS from 'exceljs';
import type { Actor, Event, IsoDate, ProjectedState } from 'moira-backend';
import { parseActor } from '../actors.js';
import {
  agreeEvent,
  assignEvent,
  costEvent,
  decomposeEvent,
  lifecycleEvent,
  relateEvent,
} from '../emit.js';
import type { Stamp, Stamper } from '../stamp.js';
import type { MoiraConfig } from '../store.js';
import { cellIsoDate, cellNumber, cellString } from './util.js';

export interface WbsRow {
  rowIndex: number; // 1-based Excel row (for error messages)
  id: string;
  parent: string | null; // null = project root
  name: string;
  assignee: string | null; // actor spec ('alice' | 'agent:claude'); null = none
  estimate: number | null; // null = blank
  plannedStart: string | null; // ISO or null
  plannedEnd: string | null; // ISO or null
  predecessors: string[]; // ids
  actualStart: string | null; // ISO or null — set = "already started"
  actualEnd: string | null; // ISO or null — set = "completed" (requires actualStart)
  actualCost: number | null; // spent MD (AC); requires actualStart
  accepted: boolean; // 検収済 = '済' (requires actualEnd)
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

// Column order — index-aligned with wbs-template.WBS_HEADERS (1-based cells).
const COL = {
  id: 1, parent: 2, name: 3, assignee: 4, estimate: 5, start: 6, end: 7, preds: 8,
  actualStart: 9, actualEnd: 10, actualCost: 11, accepted: 12,
} as const;

/**
 * Parse the `WBS` sheet from row 2. Fully-empty rows are skipped. Cell-format
 * problems (non-numeric estimate, unparseable date) become errors here; semantic
 * checks are validateWbs's job.
 */
export function parseWbsSheet(ws: ExcelJS.Worksheet): { rows: WbsRow[]; errors: string[] } {
  const rows: WbsRow[] = [];
  const errors: string[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const id = cellString(row.getCell(COL.id));
    const parentRaw = cellString(row.getCell(COL.parent));
    const name = cellString(row.getCell(COL.name));
    const assigneeRaw = cellString(row.getCell(COL.assignee));
    const estCell = cellNumber(row.getCell(COL.estimate));
    const startCell = cellIsoDate(row.getCell(COL.start));
    const endCell = cellIsoDate(row.getCell(COL.end));
    const predsRaw = cellString(row.getCell(COL.preds));
    const actualStartCell = cellIsoDate(row.getCell(COL.actualStart));
    const actualEndCell = cellIsoDate(row.getCell(COL.actualEnd));
    const actualCostCell = cellNumber(row.getCell(COL.actualCost));
    const acceptedRaw = cellString(row.getCell(COL.accepted));

    const predecessors = predsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const allEmpty =
      id === '' &&
      parentRaw === '' &&
      name === '' &&
      assigneeRaw === '' &&
      estCell === null &&
      startCell === null &&
      endCell === null &&
      predecessors.length === 0 &&
      actualStartCell === null &&
      actualEndCell === null &&
      actualCostCell === null &&
      acceptedRaw === '';
    if (allEmpty) return;

    let estimate: number | null = null;
    if (estCell === 'invalid') errors.push(`行${rowNumber}: 見積MD が数値ではありません`);
    else estimate = estCell;

    let plannedStart: string | null = null;
    if (startCell === 'invalid') errors.push(`行${rowNumber}: 予定開始日 が日付として読めません（YYYY-MM-DD）`);
    else plannedStart = startCell;

    let plannedEnd: string | null = null;
    if (endCell === 'invalid') errors.push(`行${rowNumber}: 予定終了日 が日付として読めません（YYYY-MM-DD）`);
    else plannedEnd = endCell;

    let actualStart: string | null = null;
    if (actualStartCell === 'invalid') errors.push(`行${rowNumber}: 実績開始日 が日付として読めません（YYYY-MM-DD）`);
    else actualStart = actualStartCell;

    let actualEnd: string | null = null;
    if (actualEndCell === 'invalid') errors.push(`行${rowNumber}: 実績終了日 が日付として読めません（YYYY-MM-DD）`);
    else actualEnd = actualEndCell;

    let actualCost: number | null = null;
    if (actualCostCell === 'invalid') errors.push(`行${rowNumber}: 実績MD が数値ではありません`);
    else actualCost = actualCostCell;

    let accepted = false;
    if (acceptedRaw === '済') accepted = true;
    else if (acceptedRaw !== '') errors.push(`行${rowNumber}: 検収済 は「済」または空欄のみ（"${acceptedRaw}"）`);

    rows.push({
      rowIndex: rowNumber,
      id,
      parent: parentRaw === '' ? null : parentRaw,
      name,
      assignee: assigneeRaw === '' ? null : assigneeRaw,
      estimate,
      plannedStart,
      plannedEnd,
      predecessors,
      actualStart,
      actualEnd,
      actualCost,
      accepted,
    });
  });

  return { rows, errors };
}

/**
 * Collect EVERY semantic error at once (never write on any error). `projected`
 * is fold(existing log); its `nodes` are the already-existing node ids.
 * `today` bounds the actual-date columns — an actual in the future is a
 * contradiction, not data.
 */
export function validateWbs(
  rows: readonly WbsRow[],
  projected: ProjectedState,
  projectRoot: string,
  today: IsoDate,
): string[] {
  const errors: string[] = [];
  const inFile = new Set<string>();
  const seen = new Set<string>();

  for (const r of rows) {
    const at = `行${r.rowIndex}`;
    if (r.id === '') {
      errors.push(`${at}: ID は必須です`);
      continue;
    }
    if (!ID_RE.test(r.id)) errors.push(`${at}: ID "${r.id}" が不正（英数と . - _ / のみ）`);
    if (seen.has(r.id)) errors.push(`${at}: ID "${r.id}" がファイル内で重複`);
    seen.add(r.id);
    if (projected.nodes.has(r.id)) {
      errors.push(`${at}: ID "${r.id}" は既存ログに存在（再インポートは非対応）`);
    }
    if (r.name === '') errors.push(`${at}: タスク名は必須です`);
    inFile.add(r.id);
  }

  const known = (id: string): boolean =>
    inFile.has(id) || projected.nodes.has(id) || id === projectRoot;

  for (const r of rows) {
    const at = `行${r.rowIndex}`;
    if (r.parent !== null && !known(r.parent)) {
      errors.push(`${at}: 親ID "${r.parent}" を解決できません（ファイル内・既存ノード・root のいずれでもない）`);
    }
    if (r.estimate !== null && r.estimate < 0) {
      errors.push(`${at}: 見積MD は 0 以上（${r.estimate}）`);
    }
    if (r.plannedStart !== null && r.plannedEnd !== null && r.plannedStart > r.plannedEnd) {
      errors.push(`${at}: 予定開始日(${r.plannedStart}) が 予定終了日(${r.plannedEnd}) より後`);
    }
    // Actuals: transcription of what already happened — never in the future,
    // never an end without a start (D-30: these dates become transition ts).
    if (r.actualEnd !== null && r.actualStart === null) {
      errors.push(`${at}: 実績終了日には実績開始日が必要です`);
    }
    if (r.actualStart !== null && r.actualEnd !== null && r.actualStart > r.actualEnd) {
      errors.push(`${at}: 実績開始日(${r.actualStart}) が 実績終了日(${r.actualEnd}) より後`);
    }
    if (r.actualStart !== null && r.actualStart > today) {
      errors.push(`${at}: 実績開始日(${r.actualStart}) が未来です（今日=${today}）`);
    }
    if (r.actualEnd !== null && r.actualEnd > today) {
      errors.push(`${at}: 実績終了日(${r.actualEnd}) が未来です（今日=${today}）`);
    }
    if (r.actualCost !== null && r.actualStart === null) {
      errors.push(`${at}: 実績MD は実績開始日のある行のみ記入できます`);
    }
    if (r.actualCost !== null && r.actualCost < 0) {
      errors.push(`${at}: 実績MD は 0 以上（${r.actualCost}）`);
    }
    if (r.accepted && r.actualEnd === null) {
      errors.push(`${at}: 検収済 は実績終了日のある行のみ記入できます`);
    }
    for (const p of r.predecessors) {
      if (!inFile.has(p) && !projected.nodes.has(p)) {
        errors.push(`${at}: 先行ID "${p}" を解決できません（ファイル内・既存ノードのいずれでもない）`);
      }
    }
  }

  // Parent-chain cycle within the file (before fold ever sees it).
  const parentMap = new Map<string, string>();
  for (const r of rows) if (r.parent !== null && inFile.has(r.parent)) parentMap.set(r.id, r.parent);
  for (const id of detectCycle(rows.map((r) => r.id), (n) => {
    const p = parentMap.get(n);
    return p === undefined ? [] : [p];
  })) {
    errors.push(`所属の循環: "${id}" を含む親チェーンが循環しています`);
  }

  // In-file predecessor graph cycle (fold would reject, but we fail earlier).
  const predMap = new Map<string, string[]>();
  for (const r of rows) predMap.set(r.id, r.predecessors.filter((p) => inFile.has(p)));
  for (const id of detectCycle(rows.map((r) => r.id), (n) => predMap.get(n) ?? [])) {
    errors.push(`先行の循環: "${id}" を含む先行グラフが循環しています`);
  }

  return errors;
}

/** Return the set of node ids that participate in a cycle (dedup). */
function detectCycle(ids: readonly string[], next: (id: string) => string[]): Set<string> {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const onCycle = new Set<string>();
  for (const id of ids) color.set(id, WHITE);

  const visit = (id: string, stack: string[]): void => {
    color.set(id, GRAY);
    stack.push(id);
    for (const m of next(id)) {
      if (!color.has(m)) continue; // out-of-file target — not part of a file cycle
      if (color.get(m) === GRAY) {
        // record the back-edge cycle members
        const from = stack.lastIndexOf(m);
        if (from >= 0) for (const c of stack.slice(from)) onCycle.add(c);
      } else if (color.get(m) === WHITE) {
        visit(m, stack);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };

  for (const id of ids) if (color.get(id) === WHITE) visit(id, []);
  return onCycle;
}

/**
 * Build the canonical event list. Actor is ALWAYS `me` (human) — a human filled
 * the sheet, so the estimate agreement is a legitimate human commit (an agent
 * agree is rejected by fold R-U4). Kind order is grouped: decompose → relate →
 * agree → assign → lifecycle actuals (start/done/accept) → cost, so every
 * relate's endpoints already exist. A SINGLE shared stamper must be passed (so
 * (ts,id) ordering is preserved within one import).
 *
 * Rows with actuals are ANCHORED: every event of such a row is emitted with
 * ts = epoch(実績開始日) (done/accept/cost at epoch(実績終了日)). fold replays by
 * the (ts, id) total order, so backdating ONLY the transitions would apply
 * assign(→ready) after done and corrupt the state; anchoring the whole row keeps
 * the semantic order (id seq breaks ties within one anchored day). The actual
 * dates thereby BECOME the transition ts — the derivation source D-30 prescribes;
 * no new event kind or attribute is introduced (D-66).
 */
export function planWbsEvents(
  rows: readonly WbsRow[],
  slots: ReadonlyMap<string, string | null>,
  cfg: MoiraConfig,
  me: Actor,
  stamp: Stamper,
): { events: Event[]; nodeLabels: Record<string, string>; warnings: string[] } {
  const events: Event[] = [];
  const nodeLabels: Record<string, string> = {};
  const warnings: string[] = [];

  const byId = new Map<string, WbsRow>();
  for (const r of rows) byId.set(r.id, r);

  // Backdate a stamp onto an ISO day (00:00:00Z). The id keeps the stamper's
  // wall-clock+seq form, so same-anchor events order by emission.
  const at = (s: Stamp, day: string | null): Stamp =>
    day === null ? s : { id: s.id, ts: Date.parse(`${day}T00:00:00Z`) };

  // 1. decompose (always explicit parent)
  for (const r of rows) {
    const parent = r.parent ?? cfg.projectRoot;
    const child = r.estimate === null ? { node: r.id } : { node: r.id, estimate: r.estimate };
    events.push(decomposeEvent(at(stamp(), r.actualStart), me, parent, [child], `import wbs: ${r.name}`));
    nodeLabels[r.id] = r.name;
  }

  // 2. relate (dependency edge per predecessor; row order × predecessor order)
  for (const r of rows) {
    for (const p of r.predecessors) {
      events.push(relateEvent(at(stamp(), r.actualStart), me, 'add', p, r.id, 'dependency'));
    }
  }

  // 3. agree (estimate agreement, frozenBudget = estimate) — estimate rows only
  for (const r of rows) {
    if (r.estimate === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 見積なし — 合意・スケジュール充填の対象外`);
      if (r.actualEnd !== null) {
        warnings.push(`行${r.rowIndex} (${r.id}): 完了行に見積なし — 合意予算がなく EV に乗りません`);
      }
      continue;
    }
    events.push(agreeEvent(at(stamp(), r.actualStart), me, r.id, r.estimate));
  }

  // 4. assign (assignee + frozenSlot when a slot was packed) — assignee rows only
  for (const r of rows) {
    if (r.assignee === null) {
      if (r.estimate !== null) warnings.push(`行${r.rowIndex} (${r.id}): 担当者なし — 割当なし・slot なし`);
      continue;
    }
    const slot = slots.get(r.id);
    const opts = slot != null ? { frozenSlot: slot } : {};
    if (slot == null && r.estimate !== null && r.actualEnd === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 完了予定を充填できませんでした（slot なし）`);
    }
    events.push(assignEvent(at(stamp(), r.actualStart), me, r.id, parseActor(r.assignee), opts));

    // start-only rows that collide with a predecessor's packed completion
    if (r.plannedStart !== null) {
      for (const p of r.predecessors) {
        const pc = slots.get(p);
        if (pc != null && pc >= r.plannedStart) {
          warnings.push(
            `行${r.rowIndex} (${r.id}): 記入開始日(${r.plannedStart}) が先行 "${p}" の完了(${pc}) と矛盾 — 先行完了後に繰り下げ`,
          );
        }
      }
    }
  }

  // 5. lifecycle actuals — start(→implementing) at 実績開始日, done(→implemented)
  //    and accept(→accepted) at 実績終了日 (D-30: the actual dates ARE these ts).
  for (const r of rows) {
    if (r.actualStart === null) continue;
    events.push(lifecycleEvent(at(stamp(), r.actualStart), me, r.id, 'implementing', 'import wbs: 実績開始'));
    if (r.actualEnd === null) continue;
    events.push(lifecycleEvent(at(stamp(), r.actualEnd), me, r.id, 'implemented', 'import wbs: 実績完了'));
    if (r.accepted) {
      events.push(lifecycleEvent(at(stamp(), r.actualEnd), me, r.id, 'accepted', 'import wbs: 検収済'));
    }
    if (r.actualCost === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 完了行に実績MDなし — AC=0 のまま EV が入り CPI が楽観に振れます`);
    }
    if (r.plannedEnd === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 完了行に予定終了日なし — 予定は凍結しません（scheduleCoverage が下がります）`);
    }
    for (const p of r.predecessors) {
      const pr = byId.get(p);
      if (pr !== undefined && pr.actualEnd === null) {
        warnings.push(`行${r.rowIndex} (${r.id}): 完了行が未完了の先行 "${p}" に依存しています — 記入の食い違いの可能性`);
      }
    }
  }

  // 6. cost (実績MD → AC) — completed rows book it on 実績終了日; in-progress rows
  //    book the spent-so-far at import time (now).
  for (const r of rows) {
    if (r.actualCost === null || r.actualCost === 0) continue;
    events.push(costEvent(at(stamp(), r.actualEnd), me, r.id, r.actualCost));
  }

  return { events, nodeLabels, warnings };
}
