import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { defaultCapacityLookup, derive, fold } from 'moira-backend';
import type { Actor, ProjectedState } from 'moira-backend';
import { agreeEvent, assignEvent, costEvent, decomposeEvent, lifecycleEvent } from '../emit.js';
import { seqStamper } from '../stamp.js';
import type { MoiraConfig } from '../store.js';
import { packSchedule } from './wbs-pack.js';
import { parseWbsSheet, planWbsEvents, validateWbs, type WbsRow } from './wbs-import.js';

const me: Actor = { kind: 'human', id: 'me' };
const cfg: MoiraConfig = { projectRoot: 'root', me: 'me' };
const HEADERS = [
  'ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID',
  '実績開始日', '実績終了日', '実績MD', '検収済',
];
const TODAY = '2026-07-06';
const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

async function sheet(dataRows: unknown[][]): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('WBS');
  ws.addRow(HEADERS);
  for (const r of dataRows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  return wb2.getWorksheet('WBS')!;
}

describe('parseWbsSheet', () => {
  it('parses data rows, skips fully-empty rows, keeps Excel row index', async () => {
    const ws = await sheet([
      ['F1', '', '認証基盤', 'alice', 3, '', '', ''],
      ['', '', '', '', '', '', '', ''], // blank
      ['F2', 'F1', 'ログイン', 'agent:claude', 2, '', '', 'F1'],
    ]);
    const { rows, errors } = parseWbsSheet(ws);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.id)).toEqual(['F1', 'F2']);
    expect(rows[1]!.rowIndex).toBe(4); // header=1, F1=2, blank=3, F2=4
    expect(rows[1]!.parent).toBe('F1');
    expect(rows[1]!.predecessors).toEqual(['F1']);
    expect(rows[0]!.estimate).toBe(3);
  });

  it('flags unparseable estimate/date at the cell level', async () => {
    const ws = await sheet([['F1', '', 'x', 'alice', 'abc', 'not-a-date', '', '']]);
    const { errors } = parseWbsSheet(ws);
    expect(errors.some((e) => e.includes('見積MD'))).toBe(true);
    expect(errors.some((e) => e.includes('予定開始日'))).toBe(true);
  });

  it('parses the actual columns (実績開始日/実績終了日/実績MD/検収済)', async () => {
    const ws = await sheet([
      ['F1', '', '完了', 'alice', 3, '', '', '', '2026-07-01', '2026-07-03', 3.5, '済'],
      ['F2', '', '着手中', 'alice', 2, '', '', '', '2026-07-04', '', '', ''],
    ]);
    const { rows, errors } = parseWbsSheet(ws);
    expect(errors).toEqual([]);
    expect(rows[0]!.actualStart).toBe('2026-07-01');
    expect(rows[0]!.actualEnd).toBe('2026-07-03');
    expect(rows[0]!.actualCost).toBe(3.5);
    expect(rows[0]!.accepted).toBe(true);
    expect(rows[1]!.actualStart).toBe('2026-07-04');
    expect(rows[1]!.actualEnd).toBeNull();
    expect(rows[1]!.actualCost).toBeNull();
    expect(rows[1]!.accepted).toBe(false);
  });

  it('flags unparseable actual cells and a non-済 検収済', async () => {
    const ws = await sheet([['F1', '', 'x', 'alice', 1, '', '', '', 'bad-date', '', 'abc', 'yes']]);
    const { errors } = parseWbsSheet(ws);
    expect(errors.some((e) => e.includes('実績開始日'))).toBe(true);
    expect(errors.some((e) => e.includes('実績MD'))).toBe(true);
    expect(errors.some((e) => e.includes('検収済'))).toBe(true);
  });
});

describe('validateWbs — collects every error at once', () => {
  it('duplicate id, unresolved parent, predecessor cycle, negative estimate', async () => {
    const ws = await sheet([
      ['A', '', 'a', 'alice', -1, '', '', ''], // negative estimate
      ['A', '', 'dup', 'alice', 1, '', '', ''], // duplicate id
      ['B', 'nope', 'b', 'alice', 1, '', '', 'C'], // unresolved parent, pred C
      ['C', '', 'c', 'alice', 1, '', '', 'B'], // pred B → B↔C cycle
    ]);
    const { rows } = parseWbsSheet(ws);
    const errors = validateWbs(rows, fold([]), 'root', TODAY);
    expect(errors.some((e) => e.includes('重複'))).toBe(true);
    expect(errors.some((e) => e.includes('親ID'))).toBe(true);
    expect(errors.some((e) => e.includes('先行の循環'))).toBe(true);
    expect(errors.some((e) => e.includes('0 以上'))).toBe(true);
  });

  it('rejects an id that already exists in the log (re-import unsupported)', async () => {
    const existing = fold([decomposeEvent(seqStamper()(), me, 'root', [{ node: 'F1' }], 'seed')]);
    const ws = await sheet([['F1', '', 'a', 'alice', 1, '', '', '']]);
    const { rows } = parseWbsSheet(ws);
    const errors = validateWbs(rows, existing, 'root', TODAY);
    expect(errors.some((e) => e.includes('既存ログに存在'))).toBe(true);
  });

  it('actual-column rules: end without start, start>end, future dates, cost/accepted preconditions', async () => {
    const ws = await sheet([
      ['A', '', 'a', 'alice', 1, '', '', '', '', '2026-07-03', '', ''], // end without start
      ['B', '', 'b', 'alice', 1, '', '', '', '2026-07-05', '2026-07-03', '', ''], // start > end
      ['C', '', 'c', 'alice', 1, '', '', '', '2026-07-07', '', '', ''], // start in the future
      ['D', '', 'd', 'alice', 1, '', '', '', '2026-07-01', '2026-07-07', '', ''], // end in the future
      ['E', '', 'e', 'alice', 1, '', '', '', '', '', 2, ''], // cost without start
      ['G', '', 'g', 'alice', 1, '', '', '', '2026-07-01', '', -1, ''], // negative cost
      ['H', '', 'h', 'alice', 1, '', '', '', '2026-07-01', '', '', '済'], // accepted without end
    ]);
    const { rows } = parseWbsSheet(ws);
    const errors = validateWbs(rows, fold([]), 'root', TODAY);
    expect(errors.some((e) => e.startsWith('行2') && e.includes('実績終了日には実績開始日が必要'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行3') && e.includes('より後'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行4') && e.includes('実績開始日') && e.includes('未来'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行5') && e.includes('実績終了日') && e.includes('未来'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行6') && e.includes('実績MD は実績開始日のある行のみ'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行7') && e.includes('実績MD は 0 以上'))).toBe(true);
    expect(errors.some((e) => e.startsWith('行8') && e.includes('検収済 は実績終了日のある行のみ'))).toBe(true);
  });

  it('a clean sheet (with and without actuals) yields no errors', async () => {
    const ws = await sheet([
      ['F1', '', 'a', 'alice', 3, '', '', '', '2026-07-01', '2026-07-03', 3.5, '済'],
      ['F2', 'F1', 'b', 'alice', 2, '', '', 'F1', '2026-07-06', '', 1, ''],
      ['F3', '', 'c', 'alice', 1, '', '', ''],
    ]);
    const { rows } = parseWbsSheet(ws);
    expect(validateWbs(rows, fold([]), 'root', TODAY)).toEqual([]);
  });
});

describe('planWbsEvents', () => {
  it('emits grouped kinds decompose → relate → agree → assign (seqStamper golden)', async () => {
    const ws = await sheet([
      ['F1', '', '認証基盤', 'alice', 3, '', '', ''],
      ['F2', '', 'ログイン', 'alice', 2, '', '', 'F1'],
    ]);
    const { rows } = parseWbsSheet(ws);
    const slots = packSchedule(rows, defaultCapacityLookup, '2026-07-06');
    const { events, nodeLabels } = planWbsEvents(rows, slots, cfg, me, seqStamper());

    expect(events.map((e) => e.kind)).toEqual([
      'decompose',
      'decompose',
      'relate',
      'transition', // agree F1
      'transition', // agree F2
      'transition', // assign F1
      'transition', // assign F2
    ]);
    // monotonic (ts,id) from the single shared stamper
    expect(events.map((e) => e.ts)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(nodeLabels).toEqual({ F1: '認証基盤', F2: 'ログイン' });

    // agree carries frozenBudget; assign carries the packed frozenSlot (the
    // COMPLETION date: F1 est 3 @ 1.0/day from 07-06 → 07-08)
    const agreeF1 = events[3];
    const assignF1 = events[5];
    if (agreeF1?.kind === 'transition') expect(agreeF1.frozenBudget).toBe(3);
    if (assignF1?.kind === 'transition') expect(assignF1.frozenSlot).toBe('2026-07-08');
  });

  it('folds without structural errors and derives full coverage on a complete sheet', async () => {
    const ws = await sheet([
      ['F1', '', 'a', 'alice', 3, '', '', ''],
      ['F2', '', 'b', 'alice', 2, '', '', 'F1'],
    ]);
    const { rows } = parseWbsSheet(ws);
    const slots = packSchedule(rows, defaultCapacityLookup, '2026-07-06');
    const { events } = planWbsEvents(rows, slots, cfg, me, seqStamper());

    expect(fold(events).structuralErrors).toEqual([]);
    const d = derive(events, { asOf: '2026-07-06', startDate: '2026-07-06' });
    expect(d.estimateCoverage).toBe(1);
    expect(d.scheduleCoverage).toBe(1);
  });

  it('warns (not errors) on a row with an estimate but no assignee', async () => {
    const ws = await sheet([['F1', '', 'a', '', 3, '', '', '']]);
    const { rows } = parseWbsSheet(ws);
    const slots = packSchedule(rows, defaultCapacityLookup, '2026-07-06');
    const { warnings, events } = planWbsEvents(rows, slots, cfg, me, seqStamper());
    expect(warnings.some((w) => w.includes('担当者なし'))).toBe(true);
    // decompose + agree only (no assign)
    expect(events.map((e) => e.kind)).toEqual(['decompose', 'transition']);
  });

  it('anchors rows with actuals: whole chain at 実績開始日, done/accept/cost at 実績終了日 (issue #24)', async () => {
    const ws = await sheet([
      ['F1', '', '完了・検収済', 'alice', 3, '', '2026-07-02', '', '2026-07-01', '2026-07-03', 3.5, '済'],
      ['F2', '', '着手中', 'alice', 2, '', '', 'F1', '2026-07-04', '', 1, ''],
      ['F3', '', '計画のみ', 'alice', 1, '', '', 'F2', '', '', '', ''],
    ]);
    const { rows } = parseWbsSheet(ws);
    expect(validateWbs(rows, fold([]), 'root', TODAY)).toEqual([]);
    const slots = packSchedule(rows, defaultCapacityLookup, TODAY);
    const { events } = planWbsEvents(rows, slots, cfg, me, seqStamper());

    // grouped kinds: decompose ×3 → relate ×2 → agree ×3 → assign ×3 →
    // start F1, done F1, accept F1, start F2 → cost F1, cost F2
    expect(events.map((e) => e.kind)).toEqual([
      'decompose', 'decompose', 'decompose',
      'relate', 'relate',
      'transition', 'transition', 'transition', // agree
      'transition', 'transition', 'transition', // assign
      'transition', 'transition', 'transition', 'transition', // start/done/accept F1, start F2
      'cost', 'cost',
    ]);

    // F1's chain is anchored on its actual dates (D-30: the dates ARE the ts)…
    const a1 = day('2026-07-01');
    const e1 = day('2026-07-03');
    expect(events[0]!.ts).toBe(a1); // decompose F1
    expect(events[5]!.ts).toBe(a1); // agree F1
    expect(events[8]!.ts).toBe(a1); // assign F1
    expect(events[11]!.ts).toBe(a1); // start F1
    expect(events[12]!.ts).toBe(e1); // done F1
    expect(events[13]!.ts).toBe(e1); // accept F1
    expect(events[15]!.ts).toBe(e1); // cost F1
    // …F2 on its start; F2's spent-so-far cost books at import time (stamper ts)
    expect(events[1]!.ts).toBe(day('2026-07-04')); // decompose F2
    expect(events[14]!.ts).toBe(day('2026-07-04')); // start F2
    expect(events[16]!.ts).toBe(17); // cost F2 (17th stamp of the shared stamper)
    // plan-only F3 keeps plain stamper ts
    expect(events[2]!.ts).toBe(3); // decompose F3

    // the (ts,id)-ordered fold lands every node in the right final state
    const st = fold(events);
    expect(st.structuralErrors).toEqual([]);
    const f1 = st.nodes.get('F1')!;
    expect(f1.lifecycle).toBe('accepted');
    expect(f1.reachedImplemented).toBe(true);
    expect(f1.estimateState).toBe('agreed');
    expect(f1.frozenBudget).toBe(3);
    expect(f1.frozenSlot).toBe('2026-07-02'); // written 予定終了日 honored
    expect(f1.ownCost).toBe(3.5);
    const f2 = st.nodes.get('F2')!;
    expect(f2.lifecycle).toBe('implementing');
    expect(f2.ownCost).toBe(1);
    expect(st.nodes.get('F3')!.lifecycle).toBe('ready');

    // EVM: completed F1 earns EV; AC = 3.5 + 1
    const d = derive(events, { asOf: TODAY, startDate: TODAY });
    expect(d.evAbs).toBe(3);
    expect(d.ac).toBe(4.5);
    expect(d.cpi).toBeCloseTo(3 / 4.5);
    expect(d.scheduleCoverage).toBe(1);
  });

  it('discloses the honesty gaps of completed rows as warnings (no baseline fabrication)', async () => {
    const ws = await sheet([
      ['P1', '', '先行・着手中', 'alice', 2, '', '', '', '2026-07-01', '', '', ''],
      ['P2', '', '完了・情報欠け', 'alice', '', '', '', 'P1', '2026-07-02', '2026-07-03', '', ''],
    ]);
    const { rows } = parseWbsSheet(ws);
    expect(validateWbs(rows, fold([]), 'root', TODAY)).toEqual([]);
    const slots = packSchedule(rows, defaultCapacityLookup, TODAY);
    const { warnings } = planWbsEvents(rows, slots, cfg, me, seqStamper());
    expect(slots.get('P2')).toBeNull(); // completed + no 予定終了日 → never packed forward
    expect(warnings.some((w) => w.includes('P2') && w.includes('完了行に見積なし'))).toBe(true);
    expect(warnings.some((w) => w.includes('P2') && w.includes('実績MDなし') && w.includes('CPI'))).toBe(true);
    expect(warnings.some((w) => w.includes('P2') && w.includes('予定は凍結しません'))).toBe(true);
    expect(warnings.some((w) => w.includes('P2') && w.includes('未完了の先行'))).toBe(true);
  });

  it('a completed row without 予定終了日 drops scheduleCoverage instead of fabricating a slot', async () => {
    const ws = await sheet([
      ['C1', '', '完了・予定なし', 'alice', 2, '', '', '', '2026-07-01', '2026-07-02', 2, ''],
    ]);
    const { rows } = parseWbsSheet(ws);
    const slots = packSchedule(rows, defaultCapacityLookup, TODAY);
    const { events } = planWbsEvents(rows, slots, cfg, me, seqStamper());
    const d = derive(events, { asOf: TODAY, startDate: TODAY });
    expect(d.scheduleCoverage).toBe(0); // the gap is disclosed, not papered over
    expect(d.evAbs).toBe(2);
    expect(d.ac).toBe(2);
    expect(d.cpi).toBe(1);
    expect(d.pv).toBe(0); // no frozen slot → no PV (R-S6: read SPI with coverage)
  });
});

// issue #37 item 4 (analysis §4.2#6): planWbsEvents' diff branch, tested at the
// pure-function level against a HAND-BUILT `projected` (via seqStamper — no
// real wall-clock involved, unlike the CLI/xlsx integration path in
// wbs-integration.test.ts, which deliberately stays actuals-free to sidestep
// anchored-vs-wall-clock ts ordering; this is where the lifecycle/cost/
// cancelled diff behavior gets exercised deterministically).
describe('planWbsEvents --update diff mode (issue #37 item 4)', () => {
  const alice: Actor = { kind: 'human', id: 'alice' };

  /** F1: decomposed(est 3) → agreed(budget 3) → assigned(alice, frozen slot) →
   *  implementing → implemented → accepted, cost 3.5 — a fully "done" node. */
  function doneProjected(): ProjectedState {
    const s = seqStamper();
    return fold([
      decomposeEvent(s(), me, 'root', [{ node: 'F1', estimate: 3 }], 'seed'),
      agreeEvent(s(), me, 'F1', 3),
      assignEvent(s(), me, 'F1', alice, { frozenSlot: '2026-07-08' }),
      lifecycleEvent(s(), me, 'F1', 'implementing'),
      lifecycleEvent(s(), me, 'F1', 'implemented'),
      lifecycleEvent(s(), me, 'F1', 'accepted'),
      costEvent(s(), me, 'F1', 3.5),
    ]);
  }

  /** Same as doneProjected but cancelled instead of completed. */
  function cancelledProjected(): ProjectedState {
    const s = seqStamper();
    return fold([
      decomposeEvent(s(), me, 'root', [{ node: 'F1', estimate: 3 }], 'seed'),
      agreeEvent(s(), me, 'F1', 3),
      assignEvent(s(), me, 'F1', alice, { frozenSlot: '2026-07-08' }),
      lifecycleEvent(s(), me, 'F1', 'cancelled'),
    ]);
  }

  const rowBase: WbsRow = {
    rowIndex: 2, id: 'F1', parent: null, name: '認証基盤', assignee: 'alice',
    estimate: 3, plannedStart: null, plannedEnd: null, predecessors: [],
    actualStart: '2026-07-01', actualEnd: '2026-07-03', actualCost: 3.5, accepted: true,
  };

  it('a fully unchanged row against an already-done node emits NOTHING (true no-op)', () => {
    const { events } = planWbsEvents([rowBase], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events).toEqual([]);
  });

  it('a changed estimate against a COMPLETED node re-decomposes but skips re-agree (I4 done-lock), with a warning', () => {
    const row: WbsRow = { ...rowBase, estimate: 5 };
    const { events, warnings } = planWbsEvents([row], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'decompose', children: [{ node: 'F1', estimate: 5 }] });
    expect(warnings.some((w) => w.includes('I4 done-lock'))).toBe(true);
  });

  it('an unchanged estimate against a COMPLETED node re-agreeing is skipped silently (nothing to redo, no I4 warning)', () => {
    const { events, warnings } = planWbsEvents([rowBase], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events.some((e) => e.kind === 'transition' && e.machine === 'estimate-agreement')).toBe(false);
    expect(warnings.some((w) => w.includes('I4 done-lock'))).toBe(false);
  });

  // issue #37-review item 5 (仕様確定, doc-only — no behavior change): 空欄の
  // 見積MD は --update で「既存の見積を維持」を意味する。cheap lock: 空欄行は
  // decompose イベントを一切出さない（消去方向のイベントは無い）ことを確認する。
  it('a blank 見積MD on --update keeps the existing estimate (空欄=維持) — no decompose event is emitted', () => {
    const row: WbsRow = { ...rowBase, estimate: null };
    const { events } = planWbsEvents([row], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events.some((e) => e.kind === 'decompose')).toBe(false);
  });

  it('a repeated actualCost against an already-costed node is skipped (no double booking), with a warning', () => {
    const { events, warnings } = planWbsEvents([rowBase], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events.some((e) => e.kind === 'cost')).toBe(false);
    expect(warnings.some((w) => w.includes('既に実績コスト'))).toBe(true);
  });

  it('lifecycle actuals against an already-accepted node emit nothing (no re-punching implementing/implemented/accepted)', () => {
    const { events } = planWbsEvents([rowBase], new Map([['F1', null]]), cfg, me, seqStamper(), doneProjected());
    expect(events.some((e) => e.kind === 'transition' && e.machine === 'lifecycle')).toBe(false);
  });

  it('cancelled is terminal: lifecycle actuals AND assign are both skipped, with warnings (issue #37 item 3 consistency) — cost booking is UNAFFECTED (a sunk fact, ac.ts-isomorphic)', () => {
    const row: WbsRow = { ...rowBase, assignee: 'bob' }; // even a DIFFERENT assignee must not resurrect it
    const { events, warnings } = planWbsEvents([row], new Map([['F1', null]]), cfg, me, seqStamper(), cancelledProjected());
    // no assign(→ready), no lifecycle-actual transitions — only the cost fact
    // (cancelledProjected has ownCost=0 so far, so it isn't a duplicate booking)
    expect(events).toEqual([{ kind: 'cost', id: expect.any(String), ts: expect.any(Number), actor: me, node: 'F1', amount: 3.5 }]);
    expect(warnings.some((w) => w.includes('cancelled') && w.includes('assign'))).toBe(true);
    expect(warnings.some((w) => w.includes('cancelled') && w.includes('実績'))).toBe(true);
  });

  it('a new predecessor edge is added; an edge that already exists is skipped with a warning', () => {
    const s = seqStamper();
    const priorEvents = [
      decomposeEvent(s(), me, 'root', [{ node: 'F0', estimate: 1 }, { node: 'F1', estimate: 3 }], 'seed'),
      { kind: 'relate' as const, id: s().id, ts: 100, actor: me, op: 'add' as const, from: 'F0', to: 'F1', edgeKind: 'dependency' as const },
    ];
    const projected = fold(priorEvents);
    const row: WbsRow = { ...rowBase, predecessors: ['F0', 'F2'], estimate: 3, actualStart: null, actualEnd: null, actualCost: null, accepted: false };
    const row2: WbsRow = { rowIndex: 3, id: 'F2', parent: null, name: 'x', assignee: null, estimate: null, plannedStart: null, plannedEnd: null, predecessors: [], actualStart: null, actualEnd: null, actualCost: null, accepted: false };
    const { events, warnings } = planWbsEvents([row, row2], new Map([['F1', null], ['F2', null]]), cfg, me, seqStamper(), projected);
    const relates = events.filter((e) => e.kind === 'relate');
    expect(relates).toHaveLength(1); // F2→F1 is new; F0→F1 already exists
    expect(relates[0]).toMatchObject({ from: 'F2', to: 'F1' });
    expect(warnings.some((w) => w.includes('F0') && w.includes('重複追加をスキップ'))).toBe(true);
  });

  // issue #37-review item 4 (仕様確定): `--update` never auto-deletes a
  // dependency edge just because the sheet's 先行ID cell no longer lists it —
  // that would let a re-import silently undo an edge added by hand via
  // `moira relate`. The edge is retained; a warning surfaces the gap instead.
  it('a dependency edge removed from the sheet is RETAINED (not auto-deleted) — --update warns instead', () => {
    const s = seqStamper();
    const priorEvents = [
      decomposeEvent(s(), me, 'root', [{ node: 'F0', estimate: 1 }, { node: 'F1', estimate: 3 }], 'seed'),
      { kind: 'relate' as const, id: s().id, ts: 100, actor: me, op: 'add' as const, from: 'F0', to: 'F1', edgeKind: 'dependency' as const },
    ];
    const projected = fold(priorEvents);
    // F1's row no longer lists F0 as a predecessor (先行ID cell cleared).
    const row: WbsRow = { ...rowBase, predecessors: [], estimate: 3, actualStart: null, actualEnd: null, actualCost: null, accepted: false };
    const { events, warnings } = planWbsEvents([row], new Map([['F1', null]]), cfg, me, seqStamper(), projected);
    // no relate event at all — nothing added, and (critically) no removal emitted
    expect(events.some((e) => e.kind === 'relate')).toBe(false);
    expect(
      warnings.some((w) => w.includes('F0') && w.includes('見当たりません') && w.includes('--remove')),
    ).toBe(true);
    // the edge is still present after folding whatever this planned (retained)
    const st = fold([...priorEvents, ...events]);
    expect(st.dependencyEdges).toContainEqual({ from: 'F0', to: 'F1', policy: 'implemented' });
  });

  it('validateWbs: --update (allowExisting) lets an existing id through; without it, unchanged rejection', () => {
    const existing = fold([decomposeEvent(seqStamper()(), me, 'root', [{ node: 'F1' }], 'seed')]);
    const rows: WbsRow[] = [{ ...rowBase, actualStart: null, actualEnd: null, actualCost: null, accepted: false }];
    expect(validateWbs(rows, existing, 'root', TODAY)).not.toEqual([]); // default: still an error
    expect(validateWbs(rows, existing, 'root', TODAY, { allowExisting: true })).toEqual([]); // --update: allowed
  });

  // issue #37 item 4 follow-up: found empirically (a manual `moira import wbs
  // --update` smoke test against a real repo silently regressed a completed
  // node back to 'ready' with EV_abs=0) — not part of the original task spec,
  // but squarely the kind of silent corruption issue #37 exists to close.
  describe('validateWbs: backdated-actual ordering hazard (issue #37 item 4 follow-up)', () => {
    const epoch = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

    it('rejects a row whose actual start predates the node\'s own latest prior event', () => {
      const priorEvents = [
        decomposeEvent({ id: 't1', ts: epoch('2026-06-01') }, me, 'root', [{ node: 'F1', estimate: 3 }], 'seed'),
        // an unanchored event (e.g. an assign stamped at the ORIGINAL import's
        // wall-clock "now") chronologically AFTER the actual date the
        // reimport is about to report.
        { kind: 'transition' as const, id: 't2', ts: epoch('2026-06-15'), actor: me, node: 'F1', machine: 'lifecycle' as const, to: 'ready' as const },
      ];
      const existing = fold(priorEvents);
      const row: WbsRow = { ...rowBase, actualStart: '2026-01-01', actualEnd: '2026-01-02', estimate: 3 };
      const errors = validateWbs([row], existing, 'root', TODAY, { allowExisting: true, priorEvents });
      expect(errors.some((e) => e.includes('F1') && e.includes('既存ログの最終更新'))).toBe(true);
    });

    it('does NOT reject when the actual start postdates the node\'s latest prior event (the safe, realistic flow)', () => {
      const priorEvents = [
        decomposeEvent({ id: 't1', ts: epoch('2026-01-01') }, me, 'root', [{ node: 'F1', estimate: 3 }], 'seed'),
        { kind: 'transition' as const, id: 't2', ts: epoch('2026-01-02'), actor: me, node: 'F1', machine: 'lifecycle' as const, to: 'ready' as const },
      ];
      const existing = fold(priorEvents);
      const row: WbsRow = {
        ...rowBase,
        actualStart: '2026-06-01', // well after both prior events
        actualEnd: '2026-06-02',
        estimate: 3,
      };
      const errors = validateWbs([row], existing, 'root', TODAY, { allowExisting: true, priorEvents });
      expect(errors.some((e) => e.includes('既存ログの最終更新'))).toBe(false);
    });

    it('is inert without --update (priorEvents/allowExisting both required) — no new false positives on the default path', () => {
      const priorEvents = [decomposeEvent({ id: 't1', ts: epoch('2026-06-15') }, me, 'root', [{ node: 'F9' }], 'seed')];
      const existing = fold(priorEvents);
      const row: WbsRow = { ...rowBase, id: 'F9', actualStart: '2026-01-01', actualEnd: '2026-01-02', estimate: 3 };
      // no `allowExisting` at all: the existing-id rejection fires (expected,
      // unrelated to this check) but NOT the ordering-hazard message, since
      // the hazard check is scoped to the --update path only.
      const errors = validateWbs([row], existing, 'root', TODAY, { priorEvents });
      expect(errors.some((e) => e.includes('既存ログの最終更新'))).toBe(false);
    });

    // issue #37-review item 3: the ORIGINAL basis was "any event that ever
    // touched the node" (decompose/relate/cost included), which hard-rejected
    // a legitimate re-import of yesterday's actuals whenever a dependency
    // edge, a cost booking, or an estimate re-baseline happened TODAY — none
    // of which replay LAST over a lifecycle state, so none of them can cause
    // the silent-rewind corruption this check exists to catch. The basis is
    // narrowed to the node's latest LIFECYCLE transition only.
    it('a same-day relate/cost/decompose does NOT block --update of an earlier actual (only lifecycle transitions gate the hazard check)', () => {
      const priorEvents = [
        decomposeEvent({ id: 't1', ts: epoch('2026-06-01') }, me, 'root', [{ node: 'F0' }, { node: 'F1', estimate: 3 }], 'seed'),
        { kind: 'transition' as const, id: 't2', ts: epoch('2026-06-02'), actor: me, node: 'F1', machine: 'lifecycle' as const, to: 'ready' as const },
        // TODAY: a new dependency edge, a cost booking, and an estimate
        // re-baseline — all chronologically AFTER the actual date about to be
        // reported, but none of them a lifecycle transition.
        { kind: 'relate' as const, id: 't3', ts: epoch(TODAY), actor: me, op: 'add' as const, from: 'F0', to: 'F1', edgeKind: 'dependency' as const },
        costEvent({ id: 't4', ts: epoch(TODAY) }, me, 'F1', 1),
        decomposeEvent({ id: 't5', ts: epoch(TODAY) }, me, 'root', [{ node: 'F1', estimate: 4 }], 're-baseline'),
      ];
      const existing = fold(priorEvents);
      const row: WbsRow = { ...rowBase, actualStart: '2026-06-05', actualEnd: '2026-06-06', estimate: 4 };
      const errors = validateWbs([row], existing, 'root', TODAY, { allowExisting: true, priorEvents });
      expect(errors.some((e) => e.includes('既存ログの最終更新'))).toBe(false);
    });

    it('a later LIFECYCLE transition among other same-day event kinds still rejects (the original defense is preserved)', () => {
      const priorEvents = [
        decomposeEvent({ id: 't1', ts: epoch('2026-06-01') }, me, 'root', [{ node: 'F1', estimate: 3 }], 'seed'),
        costEvent({ id: 't2', ts: epoch('2026-06-02') }, me, 'F1', 1), // non-lifecycle — ignored by the gate
        { kind: 'transition' as const, id: 't3', ts: epoch('2026-06-15'), actor: me, node: 'F1', machine: 'lifecycle' as const, to: 'ready' as const },
      ];
      const existing = fold(priorEvents);
      const row: WbsRow = { ...rowBase, actualStart: '2026-06-10', actualEnd: '2026-06-11', estimate: 3 };
      const errors = validateWbs([row], existing, 'root', TODAY, { allowExisting: true, priorEvents });
      expect(errors.some((e) => e.includes('F1') && e.includes('既存ログの最終更新'))).toBe(true);
    });
  });
});
