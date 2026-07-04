import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildMembersTemplate,
  CALENDAR_HEADERS,
  HOLIDAY_HEADERS,
  MEMBER_HEADERS,
} from './members-template.js';

// The template is generated (never committed as a binary). Round-trip it through
// writeBuffer → load so we assert what a user actually opens.
async function reload(): Promise<ExcelJS.Workbook> {
  const buf = await buildMembersTemplate().xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe('members template golden', () => {
  it('has 要員 / 個人カレンダー / 祝日 / 説明 sheets, header rows, no data on data sheets', async () => {
    const wb = await reload();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['要員', '個人カレンダー', '祝日', '説明']);
    const headerOf = (name: string) => (wb.getWorksheet(name)!.getRow(1).values as unknown[]).slice(1);
    expect(headerOf('要員')).toEqual([...MEMBER_HEADERS]);
    expect(headerOf('個人カレンダー')).toEqual([...CALENDAR_HEADERS]);
    expect(headerOf('祝日')).toEqual([...HOLIDAY_HEADERS]);
    // examples live on 説明 only — data sheets carry the header row only.
    expect(wb.getWorksheet('要員')!.rowCount).toBe(1);
    expect(wb.getWorksheet('個人カレンダー')!.rowCount).toBe(1);
    expect(wb.getWorksheet('祝日')!.rowCount).toBe(1);
  });

  it('formats the date columns as yyyy-mm-dd', async () => {
    const wb = await reload();
    expect(wb.getWorksheet('個人カレンダー')!.getColumn(2).numFmt).toBe('yyyy-mm-dd');
    expect(wb.getWorksheet('祝日')!.getColumn(1).numFmt).toBe('yyyy-mm-dd');
  });

  it('spells out the two v1 limits on 説明', async () => {
    const wb = await reload();
    const text = (wb.getWorksheet('説明')!.getSheetValues() as unknown[][])
      .flat()
      .filter((v): v is string => typeof v === 'string')
      .join('\n');
    expect(text).toContain('祝日は「インポート時点の名簿」にのみ実体化');
    expect(text).toContain('既定稼働率 < 1.0 は v1 では');
  });
});
