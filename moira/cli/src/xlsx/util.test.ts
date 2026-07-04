import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { cellIsoDate, cellIsoDateFromSerial, cellNumber, cellString } from './util.js';

// The date choke point: exceljs can hand back a date cell as a UTC Date, an Excel
// serial number, or a plain 'YYYY-MM-DD' string. All three MUST fold to the same
// ISO date. This is the regression that guardrails against locale/tz corruption.
async function loadCell(value: unknown, numFmt?: string): Promise<ExcelJS.Cell> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('S');
  const cell = ws.getCell('A1');
  cell.value = value as ExcelJS.CellValue;
  if (numFmt) cell.numFmt = numFmt;
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  return wb2.getWorksheet('S')!.getCell('A1');
}

describe('cellIsoDate — three shapes fold to one ISO', () => {
  it('Date object (UTC) → ISO', async () => {
    const c = await loadCell(new Date('2026-07-06T00:00:00Z'), 'yyyy-mm-dd');
    expect(cellIsoDate(c)).toBe('2026-07-06');
  });
  it("string '2026-07-06' → ISO", async () => {
    const c = await loadCell('2026-07-06');
    expect(cellIsoDate(c)).toBe('2026-07-06');
  });
  it('Excel serial value → ISO', async () => {
    // 25569 = 1970-01-01; 2026-07-06 is 46'204 days later.
    const serial = 25569 + Math.round(Date.UTC(2026, 6, 6) / 86_400_000);
    expect(cellIsoDateFromSerial(serial)).toBe('2026-07-06');
    const c = await loadCell(serial, 'yyyy-mm-dd');
    expect(cellIsoDate(c)).toBe('2026-07-06');
  });
  it('empty → null; garbage → invalid', async () => {
    expect(cellIsoDate(await loadCell(null))).toBeNull();
    expect(cellIsoDate(await loadCell('not-a-date'))).toBe('invalid');
  });
});

describe('cellNumber / cellString', () => {
  it('numbers, numeric strings, empties, garbage', async () => {
    expect(cellNumber(await loadCell(3))).toBe(3);
    expect(cellNumber(await loadCell('2.5'))).toBe(2.5);
    expect(cellNumber(await loadCell(null))).toBeNull();
    expect(cellNumber(await loadCell('abc'))).toBe('invalid');
  });
  it('trims text', async () => {
    expect(cellString(await loadCell('  F1  '))).toBe('F1');
  });
});
