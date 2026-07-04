import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWbsTemplate, WBS_HEADERS } from './wbs-template.js';

// The template is generated (never committed as a binary). Round-trip it through
// writeBuffer → load so we assert what a user actually opens.
async function reload(): Promise<ExcelJS.Workbook> {
  const buf = await buildWbsTemplate().xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe('WBS template golden', () => {
  it('has WBS + 説明 sheets, header row, and no data rows on WBS', async () => {
    const wb = await reload();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['WBS', '説明']);
    const ws = wb.getWorksheet('WBS')!;
    const header = (ws.getRow(1).values as unknown[]).slice(1); // 1-based
    expect(header).toEqual([...WBS_HEADERS]);
    expect(ws.rowCount).toBe(1); // header only — the example lives on 説明
  });

  it('formats the two date columns as yyyy-mm-dd', async () => {
    const ws = (await reload()).getWorksheet('WBS')!;
    expect(ws.getColumn(6).numFmt).toBe('yyyy-mm-dd'); // 予定開始日
    expect(ws.getColumn(7).numFmt).toBe('yyyy-mm-dd'); // 予定終了日
  });
});
