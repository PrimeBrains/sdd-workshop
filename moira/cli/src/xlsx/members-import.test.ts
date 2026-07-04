import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { CapacityStore } from 'moira-backend';
import { seqStamper } from '../stamp.js';
import type { Member } from '../store.js';
import {
  parseCalendarSheet,
  parseHolidaySheet,
  parseMembersSheet,
  planMembersImport,
  validateMembersImport,
} from './members-import.js';

const M_HEADERS = ['ID', '氏名', '既定稼働率'];
const C_HEADERS = ['要員ID', '日付', '稼働率', '理由'];
const H_HEADERS = ['日付', '名称'];

// Build a 3-sheet workbook in memory, round-trip through xlsx so we exercise the
// same cell shapes the real reader sees.
async function workbook(
  members: unknown[][],
  calendar: unknown[][],
  holidays: unknown[][],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const m = wb.addWorksheet('要員');
  m.addRow(M_HEADERS);
  for (const r of members) m.addRow(r);
  const c = wb.addWorksheet('個人カレンダー');
  c.addRow(C_HEADERS);
  for (const r of calendar) c.addRow(r);
  const h = wb.addWorksheet('祝日');
  h.addRow(H_HEADERS);
  for (const r of holidays) h.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  return wb2;
}

async function parseAll(wb: ExcelJS.Workbook) {
  const m = parseMembersSheet(wb.getWorksheet('要員')!);
  const c = parseCalendarSheet(wb.getWorksheet('個人カレンダー')!);
  const h = parseHolidaySheet(wb.getWorksheet('祝日')!);
  return { m, c, h, errors: [...m.errors, ...c.errors, ...h.errors] };
}

describe('parse — members / calendar / holiday sheets', () => {
  it('reads typed rows, skips fully-empty rows, keeps Excel row index', async () => {
    const wb = await workbook(
      [['nakao', '中尾', 1], ['', '', ''], ['sato', '佐藤', 0.5]],
      [['nakao', '2026-07-10', 0, '私用']],
      [['2026-07-20', '海の日']],
    );
    const { m, c, h, errors } = await parseAll(wb);
    expect(errors).toEqual([]);
    expect(m.rows.map((r) => r.id)).toEqual(['nakao', 'sato']);
    expect(m.rows[1]!.rowIndex).toBe(4); // header=1, nakao=2, blank=3, sato=4
    expect(m.rows[1]!.defaultCapacity).toBe(0.5);
    expect(c.rows[0]).toMatchObject({ memberId: 'nakao', date: '2026-07-10', capacity: 0, reason: '私用' });
    expect(h.rows[0]).toMatchObject({ date: '2026-07-20', name: '海の日' });
  });

  it('flags unreadable numbers/dates at the cell level', async () => {
    const wb = await workbook(
      [['nakao', '中尾', 'abc']],
      [['nakao', 'not-a-date', 'x', '']],
      [['bad', '祝']],
    );
    const { errors } = await parseAll(wb);
    expect(errors.some((e) => e.includes('既定稼働率'))).toBe(true);
    expect(errors.some((e) => e.includes('日付'))).toBe(true);
    expect(errors.some((e) => e.includes('稼働率'))).toBe(true);
  });
});

describe('validateMembersImport — collects every error at once', () => {
  it('missing id/name, out-of-range capacity, dangling calendar member', async () => {
    const wb = await workbook(
      [['', '無名', ''], ['taro', '', ''], ['dup', 'A', 2], ['dup', 'B', '']],
      [['ghost', '2026-07-10', 0.5, '']],
      [],
    );
    const { m, c, h } = await parseAll(wb);
    const errs = validateMembersImport(m.rows, c.rows, h.rows, []);
    expect(errs.some((e) => e.includes('ID は必須'))).toBe(true);
    expect(errs.some((e) => e.includes('氏名 は必須'))).toBe(true);
    expect(errs.some((e) => e.includes('重複'))).toBe(true);
    expect(errs.some((e) => e.includes('既定稼働率 は 0〜1'))).toBe(true);
    expect(errs.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('a calendar member that exists in the prior roster is accepted', async () => {
    const wb = await workbook([], [['old', '2026-07-10', 0, '']], []);
    const { m, c, h } = await parseAll(wb);
    const existing: Member[] = [{ id: 'old', kind: 'human', label: '既存' }];
    expect(validateMembersImport(m.rows, c.rows, h.rows, existing)).toEqual([]);
  });
});

describe('planMembersImport — roster upsert + actorLabels + capacity expansion', () => {
  it('2 members + 1 personal leave + 2 holidays → capacity = 1 + 2×2 = 5, with reason prefixes', async () => {
    const wb = await workbook(
      [['nakao', '中尾', 1], ['sato', '佐藤', 1]],
      [['nakao', '2026-07-10', 0, '私用']],
      [['2026-07-20', '海の日'], ['2026-08-11', '山の日']],
    );
    const { m, c, h } = await parseAll(wb);
    const plan = planMembersImport(m.rows, c.rows, h.rows, [], seqStamper());

    expect(plan.members.map((x) => x.id)).toEqual(['nakao', 'sato']);
    expect(plan.actorLabels).toEqual({ nakao: '中尾', sato: '佐藤' });
    // 2 holidays × 2 humans + 1 personal leave = 5
    expect(plan.capacityEntries).toHaveLength(5);
    const leave = plan.capacityEntries.find((e) => e.humanId === 'nakao' && e.date === '2026-07-10');
    expect(leave!.reason).toBe('leave: 私用');
    expect(leave!.capacity).toBe(0);
    const holiday = plan.capacityEntries.find((e) => e.date === '2026-07-20' && e.humanId === 'sato');
    expect(holiday!.reason).toBe('holiday: 海の日');
    expect(holiday!.capacity).toBe(0);
  });

  it('holidays expand over the UPSERTED human roster (existing ∪ file), agents excluded', async () => {
    const wb = await workbook([['agent:claude', 'Claude', '']], [], [['2026-07-20', '海の日']]);
    const { m, c, h } = await parseAll(wb);
    const existing: Member[] = [{ id: 'nakao', kind: 'human', label: '中尾' }];
    const plan = planMembersImport(m.rows, c.rows, h.rows, existing, seqStamper());
    // roster = nakao (existing human) + claude (new agent, id normalized to bare).
    // Holiday hits humans only → nakao only.
    expect(plan.members.map((x) => `${x.kind}:${x.id}`).sort()).toEqual(['agent:claude', 'human:nakao']);
    expect(plan.capacityEntries).toHaveLength(1);
    expect(plan.capacityEntries[0]!.humanId).toBe('nakao');
  });

  it('defaultCapacity < 1 is retained on the roster but NOT materialized into c (v1 honesty)', async () => {
    const wb = await workbook([['sato', '佐藤', 0.5]], [], []);
    const { m, c, h } = await parseAll(wb);
    const plan = planMembersImport(m.rows, c.rows, h.rows, [], seqStamper());
    expect(plan.members[0]!.defaultCapacity).toBe(0.5);
    expect(plan.capacityEntries).toHaveLength(0); // no c-entry from defaultCapacity
    expect(plan.warnings.some((w) => w.includes('既定稼働率'))).toBe(true);
  });

  it('re-import overwrites the same (human,date) via latest-ts (CapacityStore lookup)', async () => {
    // first import: nakao 2026-07-10 leave (c=0)
    const wb1 = await workbook([['nakao', '中尾', 1]], [['nakao', '2026-07-10', 0, '私用']], []);
    const p1 = await parseAll(wb1);
    const plan1 = planMembersImport(p1.m.rows, p1.c.rows, p1.h.rows, [], seqStamper(0));

    // second import (later ts run): same cell now a half-day (c=0.5)
    const wb2 = await workbook([['nakao', '中尾', 1]], [['nakao', '2026-07-10', 0.5, '半日']], []);
    const p2 = await parseAll(wb2);
    const plan2 = planMembersImport(p2.m.rows, p2.c.rows, p2.h.rows, plan1.members, seqStamper(1000));

    const store = new CapacityStore();
    store.appendAll([...plan1.capacityEntries, ...plan2.capacityEntries]);
    const c = store.lookup();
    expect(c('nakao', '2026-07-10')).toBe(0.5); // latest-wins
  });
});
