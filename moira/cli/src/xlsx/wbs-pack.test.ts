import { describe, expect, it } from 'vitest';
import { defaultCapacityLookup } from 'moira-backend';
import type { CapacityOf } from './wbs-pack.js';
import { packSchedule } from './wbs-pack.js';
import type { WbsRow } from './wbs-import.js';

const START = '2026-07-06';

function row(p: Partial<WbsRow> & { rowIndex: number; id: string }): WbsRow {
  return {
    parent: null,
    name: p.id,
    assignee: 'alice',
    estimate: 1,
    plannedStart: null,
    plannedEnd: null,
    predecessors: [],
    actualStart: null,
    actualEnd: null,
    actualCost: null,
    accepted: false,
    ...p,
  };
}

describe('packSchedule', () => {
  it('(a) same assignee, est=1 chain of 3 → three consecutive days', () => {
    const rows = [
      row({ rowIndex: 2, id: 'A' }),
      row({ rowIndex: 3, id: 'B', predecessors: ['A'] }),
      row({ rowIndex: 4, id: 'C', predecessors: ['B'] }),
    ];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('A')).toBe('2026-07-06');
    expect(s.get('B')).toBe('2026-07-07');
    expect(s.get('C')).toBe('2026-07-08');
  });

  it('(b) no predecessors → filled in row order (serial per assignee)', () => {
    const rows = [row({ rowIndex: 2, id: 'A' }), row({ rowIndex: 3, id: 'B' })];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('A')).toBe('2026-07-06');
    expect(s.get('B')).toBe('2026-07-07');
  });

  it('(c) c=0 days are skipped (leveler parity)', () => {
    const cap: CapacityOf = (_who, d) => (d === '2026-07-07' ? 0 : 1);
    const rows = [row({ rowIndex: 2, id: 'A', estimate: 2 })];
    const s = packSchedule(rows, cap, START);
    expect(s.get('A')).toBe('2026-07-08'); // 07-06 (1), skip 07-07, 07-08 (2)
  });

  it('(d) partial dates: end-fixed advances cursor; start-only honors user start', () => {
    const rows = [
      row({ rowIndex: 2, id: 'A', plannedEnd: '2026-07-10' }),
      row({ rowIndex: 3, id: 'B', estimate: 1 }),
      row({ rowIndex: 4, id: 'C', estimate: 2, plannedStart: '2026-07-20' }),
    ];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('A')).toBe('2026-07-10'); // adopted end
    expect(s.get('B')).toBe('2026-07-11'); // cursor advanced past A
    expect(s.get('C')).toBe('2026-07-21'); // filled from user start 07-20
  });

  it('(e) agent lead time = ceil(est) calendar days, not leveled', () => {
    const rows = [row({ rowIndex: 2, id: 'A', assignee: 'agent:claude', estimate: 2.5 })];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('A')).toBe('2026-07-08'); // ceil(2.5)=3 days from 07-06
  });

  it('no assignee or no estimate → null slot', () => {
    const rows = [
      row({ rowIndex: 2, id: 'A', assignee: null }),
      row({ rowIndex: 3, id: 'B', estimate: null }),
    ];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('A')).toBeNull();
    expect(s.get('B')).toBeNull();
  });

  it('(g) completed row with blank 予定終了日 → null slot, never packed forward, no capacity eaten', () => {
    const rows = [
      row({ rowIndex: 2, id: 'DONE', actualStart: '2026-06-01', actualEnd: '2026-06-03' }),
      row({ rowIndex: 3, id: 'NEXT' }),
    ];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('DONE')).toBeNull(); // no baseline fabrication
    expect(s.get('NEXT')).toBe('2026-07-06'); // DONE consumed no cursor day
  });

  it('(h) completed row with a WRITTEN 予定終了日 keeps it (baseline honored as written)', () => {
    const rows = [
      row({ rowIndex: 2, id: 'DONE', plannedEnd: '2026-06-02', actualStart: '2026-06-01', actualEnd: '2026-06-03' }),
    ];
    const s = packSchedule(rows, defaultCapacityLookup, START);
    expect(s.get('DONE')).toBe('2026-06-02');
  });

  it('(f) deterministic: same input twice → identical Map', () => {
    const build = (): WbsRow[] => [
      row({ rowIndex: 2, id: 'A' }),
      row({ rowIndex: 3, id: 'B', predecessors: ['A'] }),
      row({ rowIndex: 4, id: 'C', assignee: 'agent:claude', estimate: 3 }),
    ];
    const a = [...packSchedule(build(), defaultCapacityLookup, START).entries()];
    const b = [...packSchedule(build(), defaultCapacityLookup, START).entries()];
    expect(a).toEqual(b);
  });
});
