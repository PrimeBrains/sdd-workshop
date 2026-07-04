import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { defaultCapacityLookup, derive, fold } from 'moira-backend';
import type { Actor } from 'moira-backend';
import { decomposeEvent } from '../emit.js';
import { seqStamper } from '../stamp.js';
import type { MoiraConfig } from '../store.js';
import { packSchedule } from './wbs-pack.js';
import { parseWbsSheet, planWbsEvents, validateWbs } from './wbs-import.js';

const me: Actor = { kind: 'human', id: 'me' };
const cfg: MoiraConfig = { projectRoot: 'root', me: 'me' };
const HEADERS = ['ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID'];

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
    const errors = validateWbs(rows, fold([]), 'root');
    expect(errors.some((e) => e.includes('重複'))).toBe(true);
    expect(errors.some((e) => e.includes('親ID'))).toBe(true);
    expect(errors.some((e) => e.includes('先行の循環'))).toBe(true);
    expect(errors.some((e) => e.includes('0 以上'))).toBe(true);
  });

  it('rejects an id that already exists in the log (re-import unsupported)', async () => {
    const existing = fold([decomposeEvent(seqStamper()(), me, 'root', [{ node: 'F1' }], 'seed')]);
    const ws = await sheet([['F1', '', 'a', 'alice', 1, '', '', '']]);
    const { rows } = parseWbsSheet(ws);
    const errors = validateWbs(rows, existing, 'root');
    expect(errors.some((e) => e.includes('既存ログに存在'))).toBe(true);
  });

  it('a clean sheet yields no errors', async () => {
    const ws = await sheet([
      ['F1', '', 'a', 'alice', 3, '', '', ''],
      ['F2', 'F1', 'b', 'alice', 2, '', '', 'F1'],
    ]);
    const { rows } = parseWbsSheet(ws);
    expect(validateWbs(rows, fold([]), 'root')).toEqual([]);
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
});
