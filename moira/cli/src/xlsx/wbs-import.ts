// WBS import pipeline (pure, testable): parse → validate → plan.
//   parseWbsSheet  — read the `WBS` sheet into typed rows (+ cell-format errors)
//   validateWbs    — cross-row + against-existing-log semantic checks (all at once)
//   planWbsEvents  — rows + packed slots → the canonical event list (+ labels/warnings)
// Nothing here writes to disk. commands.ts wires it to the repo and only appends
// when the error list is empty (all-or-nothing).

import ExcelJS from 'exceljs';
import type { Actor, Event, IsoDate, ProjectedNode, ProjectedState } from 'moira-backend';
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

export interface ValidateWbsOptions {
  /**
   * `moira import wbs --update` (issue #37 item 4 / analysis §4.2#6): an id
   * already in the log is normally a hard error (re-import unsupported — the
   * default, unchanged). With this flag, existing ids are ALLOWED through
   * validation and become a diff-only row in planWbsEvents (below) instead of
   * a fresh-create row.
   */
  allowExisting?: boolean;
  /**
   * The raw prior event log — REQUIRED for the backdated-actual ordering
   * hazard check below when `allowExisting` is set. Optional only so a
   * non-update caller (or a test not exercising that check) doesn't have to
   * supply it.
   */
  priorEvents?: readonly Event[];
}

/**
 * Latest ts of each node's LIFECYCLE transitions ONLY (machine==='lifecycle'
 * — e.g. the assign-emitted `→ready`, or a plain `→implementing/implemented/
 * accepted`). Used ONLY by the ordering-hazard check below (validateWbs); NOT
 * a general-purpose "history of node X" query.
 *
 * issue #37-review item 3 (originally scanned EVERY event kind touching the
 * node — decompose/relate/cost included): that over-broad basis hard-rejected
 * a legitimate re-import whenever *anything* had touched the node today —
 * adding a dependency edge, booking cost, or a decompose re-baseline — even
 * though NONE of those replay LAST-wins over a lifecycle state and so cannot
 * cause the silent-rewind corruption this check exists to catch (see the
 * comment at its call site). Only a lifecycle transition can overwrite
 * `existing.lifecycle` on replay, so only lifecycle transitions are a valid
 * basis for the rejection; narrowing here can only REDUCE false-positive
 * rejections, never weaken the original defense (a later `ready`/`implemented`
 * transition is still caught exactly as before).
 */
function latestLifecycleTsPerNode(events: readonly Event[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'transition' || e.machine !== 'lifecycle') continue;
    const cur = m.get(e.node);
    if (cur === undefined || e.ts > cur) m.set(e.node, e.ts);
  }
  return m;
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
  opts: ValidateWbsOptions = {},
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
    if (projected.nodes.has(r.id) && opts.allowExisting !== true) {
      errors.push(`${at}: ID "${r.id}" は既存ログに存在（再インポートは非対応 — 差分反映するには --update を付ける）`);
    }
    if (r.name === '') errors.push(`${at}: タスク名は必須です`);
    inFile.add(r.id);
  }

  const known = (id: string): boolean =>
    inFile.has(id) || projected.nodes.has(id) || id === projectRoot;

  // Backdated-actual ordering hazard (issue #37 item 4 follow-up — found via
  // empirical smoke test, not the original spec): `--update` anchors a
  // diff-mode lifecycle-actual event to r.actualStart/r.actualEnd (day epoch),
  // exactly like a fresh row. But for an EXISTING node, earlier events (from
  // the ORIGINAL import, e.g. an assign's `to:'ready'`) were very likely
  // stamped at THAT import's wall-clock "now" — which, for the realistic
  // "planned now, actuals reported later" flow, is chronologically BEFORE the
  // actual dates being reported now. If instead someone re-imports actuals
  // that predate the node's own prior events, fold's (ts,id) replay applies
  // the OLD "ready" transition LAST, silently regressing a completed node back
  // to `ready` and zeroing its EV_abs — with no error, no warning: exactly the
  // silent-corruption shape issue #37 exists to close. Rejected here (not
  // merely warned) because the corruption is severe (EV_abs/CPI silently
  // wrong) and undetectable after the fact from `moira show` alone.
  //
  // issue #37-review item 3: the basis is the node's LATEST LIFECYCLE
  // transition ONLY (not "any event that ever touched the node") — see
  // latestLifecycleTsPerNode's doc comment. A same-day relate/cost/decompose
  // done AFTER the actuals were last reported must NOT block a legitimate
  // `--update` of yesterday's actuals; only a lifecycle transition can be the
  // "later event silently wins on replay" hazard this check defends against.
  const latestTs = opts.allowExisting === true && opts.priorEvents !== undefined
    ? latestLifecycleTsPerNode(opts.priorEvents)
    : undefined;

  for (const r of rows) {
    const at = `行${r.rowIndex}`;
    if (latestTs !== undefined && projected.nodes.has(r.id) && r.actualStart !== null) {
      const anchorTs = Date.parse(`${r.actualStart}T00:00:00Z`);
      const priorMax = latestTs.get(r.id);
      if (priorMax !== undefined && anchorTs < priorMax) {
        errors.push(
          `${at}: ID "${r.id}" の実績開始日(${r.actualStart}) が既存ログの最終更新（lifecycle遷移、ts=${priorMax}）より過去 — ` +
            'このまま反映すると (ts,id) 順序で既存の新しい lifecycle 遷移が実績を追い越し、状態が silently 巻き戻る危険があります（issue #37）。' +
            '別 ID での再作成、または events.json を確認のうえ手動で整理してください。',
        );
      }
    }
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

/** No pre-existing nodes — the default, byte-identical to pre-#37 behavior. */
const EMPTY_PROJECTED: ProjectedState = {
  nodes: new Map(),
  childrenOf: new Map(),
  dependencyEdges: [],
  supersedeEdges: [],
  seenCostIds: new Set(),
  structuralErrors: [],
  appliedAt: 0,
};

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
 *
 * `projected` (issue #37 item 4 / analysis §4.2#6, `moira import wbs --update`):
 * when a row's id is ALREADY in `projected.nodes`, this row takes the DIFF
 * path instead of the fresh-create path — see the per-group comments below.
 * Omitted (default: no pre-existing nodes), this function is byte-identical to
 * its pre-#37 behavior — every row is a fresh-create row, exactly as before
 * (commands.ts only ever passes a non-empty `projected` when `--update` was
 * given; `validateWbs` without `{ allowExisting: true }` already guarantees no
 * row's id can collide with an existing node otherwise, so the diff branches
 * below are simply unreachable in the non-update call path).
 *
 * Diff-path events use the CURRENT wall-clock stamp (`stamp()`, not `at(...,
 * r.actualStart)`): a re-import correction (a re-baselined estimate, a newly
 * noticed dependency, a changed assignee) is a decision made NOW, distinct
 * from the row's historical actual dates. Lifecycle-actual and cost events
 * stay date-anchored even on the diff path — those really did happen on the
 * recorded 実績 date, re-import or not.
 */
export function planWbsEvents(
  rows: readonly WbsRow[],
  slots: ReadonlyMap<string, string | null>,
  cfg: MoiraConfig,
  me: Actor,
  stamp: Stamper,
  projected: ProjectedState = EMPTY_PROJECTED,
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

  interface RowDiff {
    existing: ProjectedNode | undefined;
    estimateChanged: boolean;
    parentChanged: boolean;
  }
  const diffOf = (r: WbsRow): RowDiff => {
    const existing = projected.nodes.get(r.id);
    if (existing === undefined) return { existing: undefined, estimateChanged: false, parentChanged: false };
    const newParent = r.parent ?? cfg.projectRoot;
    return {
      existing,
      // issue #37-review item 5 (仕様確定): 見積MD が空欄（r.estimate === null）の
      // --update 行は「見積を消す」ではなく「既存の見積を維持する」と定義する
      // (`r.estimate !== null &&` がその実装 — 空欄は estimateChanged=false に
      // 落ちて既存値に触れない)。空欄で見積を消したいという逆方向のユースケースは
      // 現状サポートしない（明示的な訂正は supersede/再合意で扱う）。挙動は元々
      // このとおりで変更なし — ここに定義を明文化するのみ。
      estimateChanged: r.estimate !== null && r.estimate !== existing.latestEstimate,
      parentChanged: existing.parent !== newParent,
    };
  };

  // 1. decompose (always explicit parent). Existing-id rows: skip entirely
  // when neither the estimate nor the parent differs from the log (no diff to
  // apply); otherwise re-decompose is latest-wins — exactly the correction
  // mechanism §2.8 already prescribes, just triggered from a re-import instead
  // of `moira add`.
  for (const r of rows) {
    nodeLabels[r.id] = r.name; // labels are presentation-only; always kept in sync
    const { existing, estimateChanged, parentChanged } = diffOf(r);
    const parent = r.parent ?? cfg.projectRoot;
    const child = r.estimate === null ? { node: r.id } : { node: r.id, estimate: r.estimate };
    if (existing !== undefined) {
      if (!estimateChanged && !parentChanged) continue; // nothing changed — no event
      const bits = [estimateChanged ? '見積変更' : null, parentChanged ? '親変更' : null].filter((b) => b !== null);
      events.push(decomposeEvent(stamp(), me, parent, [child], `import wbs --update: ${r.name}（${bits.join('・')}）`));
      continue;
    }
    events.push(decomposeEvent(at(stamp(), r.actualStart), me, parent, [child], `import wbs: ${r.name}`));
  }

  // 2. relate (dependency edge per predecessor; row order × predecessor order).
  // Existing-id rows: skip a predecessor whose edge is ALREADY in the log
  // (fold never dedups relate/add — analysis §3.1 — so re-emitting on every
  // re-import would silently mint duplicate edges).
  //
  // issue #37-review item 4 (仕様確定): `--update` NEVER auto-removes a
  // dependency edge that used to be in the file but is now missing (e.g. a
  // predecessor cell was cleared). Auto-deleting on a re-import would let a
  // sheet re-import silently undo an edge someone added by hand via
  // `moira relate` — a destructive action with no confirmation, exactly the
  // kind of surprise this CLI otherwise refuses to do implicitly. The existing
  // edge is retained; removing it is a deliberate, explicit act the operator
  // takes via `moira relate <X> <Y> --remove` — never a side effect of
  // re-importing a sheet. We only surface it, once per stale edge, as a
  // warning below so the gap is visible instead of silent.
  for (const r of rows) {
    const { existing } = diffOf(r);
    for (const p of r.predecessors) {
      if (existing !== undefined) {
        const dup = projected.dependencyEdges.some((e) => e.from === p && e.to === r.id);
        if (dup) {
          warnings.push(`行${r.rowIndex} (${r.id}): 先行 "${p}" への依存辺は既存 — 重複追加をスキップ`);
          continue;
        }
        events.push(relateEvent(stamp(), me, 'add', p, r.id, 'dependency'));
        continue;
      }
      events.push(relateEvent(at(stamp(), r.actualStart), me, 'add', p, r.id, 'dependency'));
    }
    if (existing !== undefined) {
      const stale = projected.dependencyEdges.filter(
        (e) => e.to === r.id && !r.predecessors.includes(e.from),
      );
      for (const e of stale) {
        warnings.push(
          `行${r.rowIndex} (${r.id}): 既存の依存辺 "${e.from}" → "${r.id}" がシートに見当たりません — ` +
            '--update は依存を削除しません（保持されます）。削除する場合は moira relate <X> <Y> --remove を使ってください。',
        );
      }
    }
  }

  // 3. agree (estimate agreement, frozenBudget = estimate) — estimate rows
  // only. Existing-id rows: a completed (implemented/accepted) node's agreed
  // estimate is I4-locked — re-agreeing it here would be exactly the kind of
  // silent post-completion budget change item 4's "don't re-punch a done node"
  // requirement is meant to prevent, so it's skipped with a warning (a
  // legitimate correction goes through supersede, §2.7, not a bulk reimport).
  // An unchanged, already-agreed estimate is also skipped (nothing to redo).
  for (const r of rows) {
    const { existing, estimateChanged } = diffOf(r);
    if (r.estimate === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 見積なし — 合意・スケジュール充填の対象外`);
      if (r.actualEnd !== null) {
        warnings.push(`行${r.rowIndex} (${r.id}): 完了行に見積なし — 合意予算がなく EV に乗りません`);
      }
      continue;
    }
    if (existing !== undefined) {
      const completed = existing.lifecycle === 'implemented' || existing.lifecycle === 'accepted';
      if (completed) {
        if (estimateChanged) {
          warnings.push(
            `行${r.rowIndex} (${r.id}): 完了済みノードの見積再合意はスキップしました（I4 done-lock — 訂正は supersede で扱う）`,
          );
        }
        continue;
      }
      if (!estimateChanged && existing.estimateState === 'agreed') continue; // already agreed at this value
      events.push(agreeEvent(stamp(), me, r.id, r.estimate));
      continue;
    }
    events.push(agreeEvent(at(stamp(), r.actualStart), me, r.id, r.estimate));
  }

  // 4. assign (assignee + frozenSlot when a slot was packed) — assignee rows
  // only. Existing-id rows: emit only when the assignee actually differs OR
  // the slot hasn't been frozen yet (fold's first-freeze rule — §3② — makes a
  // repeat frozenSlot a no-op anyway; skipping avoids log noise on every
  // re-import of an unchanged row). Cancelled is terminal (§2.5, issue #37
  // item 3): assignEvent's lifecycle `to` defaults to 'ready', so an assign on
  // a cancelled node would otherwise silently pull it back out of its
  // terminal state — the same hole cmdAssign closes for the interactive path.
  for (const r of rows) {
    if (r.assignee === null) {
      if (r.estimate !== null) warnings.push(`行${r.rowIndex} (${r.id}): 担当者なし — 割当なし・slot なし`);
      continue;
    }
    const { existing } = diffOf(r);
    if (existing?.lifecycle === 'cancelled') {
      warnings.push(`行${r.rowIndex} (${r.id}): cancelled（終端）— assign をスキップ（誤 cancel の場合は新規ノード再作成が正典の回復路）`);
      continue;
    }
    const slot = slots.get(r.id);
    const newActor = parseActor(r.assignee);
    let emit = true;
    let assignStamp = at(stamp(), r.actualStart);
    if (existing !== undefined) {
      const assigneeChanged =
        existing.assignee === null ||
        existing.assignee.id !== newActor.id ||
        existing.assignee.kind !== newActor.kind;
      const slotToFreeze = existing.frozenSlot === null && slot != null;
      emit = assigneeChanged || slotToFreeze;
      assignStamp = stamp(); // a diff correction — happens NOW, not anchored
    } else if (slot == null && r.estimate !== null && r.actualEnd === null) {
      warnings.push(`行${r.rowIndex} (${r.id}): 完了予定を充填できませんでした（slot なし）`);
    }
    if (emit) {
      const opts = slot != null ? { frozenSlot: slot } : {};
      events.push(assignEvent(assignStamp, me, r.id, newActor, opts));
    }

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
  // Existing-id rows: cancelled is terminal (§2.5, issue #37 item 3) — skip the
  // whole row rather than resurrect it. Otherwise each transition is emitted
  // ONLY if the node hasn't already reached (or passed) that lifecycle state —
  // "don't re-punch a done node" (item 4's explicit requirement): a re-import
  // of an already-done row must not re-emit `done`/`accept`.
  for (const r of rows) {
    if (r.actualStart === null) continue;
    const { existing } = diffOf(r);

    if (existing?.lifecycle === 'cancelled') {
      warnings.push(
        `行${r.rowIndex} (${r.id}): cancelled（終端）— 実績の遷移をスキップ（誤 cancel の場合は新規ノード再作成が正典の回復路）`,
      );
      continue;
    }

    const reasonPrefix = existing !== undefined ? 'import wbs --update' : 'import wbs';
    const notYetStarted = existing === undefined || existing.lifecycle === 'pending' || existing.lifecycle === 'ready';
    if (notYetStarted) {
      events.push(lifecycleEvent(at(stamp(), r.actualStart), me, r.id, 'implementing', `${reasonPrefix}: 実績開始`));
    }
    if (r.actualEnd === null) continue;

    const notYetDone =
      existing === undefined || (existing.lifecycle !== 'implemented' && existing.lifecycle !== 'accepted');
    if (notYetDone) {
      events.push(lifecycleEvent(at(stamp(), r.actualEnd), me, r.id, 'implemented', `${reasonPrefix}: 実績完了`));
    }
    if (r.accepted && (existing === undefined || existing.lifecycle !== 'accepted')) {
      events.push(lifecycleEvent(at(stamp(), r.actualEnd), me, r.id, 'accepted', `${reasonPrefix}: 検収済`));
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
  //    book the spent-so-far at import time (now). Existing-id rows: cost has
  //    NO correction event (§7#19(a) — an accumulative, add-only fact); a node
  //    that already carries recorded cost is skipped rather than double-booked
  //    on every re-import (item 4's "don't re-emit actuals duplicately").
  for (const r of rows) {
    if (r.actualCost === null || r.actualCost === 0) continue;
    const { existing } = diffOf(r);
    if (existing !== undefined && existing.ownCost !== 0) {
      warnings.push(
        `行${r.rowIndex} (${r.id}): 既に実績コスト ${existing.ownCost}MD が記録済み — 重複計上を避けるため cost の再発行をスキップ（cost に訂正機構は無い — MODEL §7#19(a)）`,
      );
      continue;
    }
    events.push(costEvent(at(stamp(), r.actualEnd), me, r.id, r.actualCost));
  }

  return { events, nodeLabels, warnings };
}
