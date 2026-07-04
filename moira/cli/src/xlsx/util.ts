// exceljs cell readers — the DATE HANDLING CHOKE POINT. Read cell values ONLY
// through these helpers. exceljs represents a value cell in several shapes
// (primitive, formula-result object, JS Date, Excel serial number), and getting
// dates wrong is the classic silent corruption in this feature.
//
// FORBIDDEN (guardrails — see issue #9):
//   - Never use `cell.text` for a DATE. `.text` is the locale-formatted display
//     string ("7/6/2026" in en-US, "2026/7/6" elsewhere) — not parseable back.
//   - Never `new Date('MM/DD/YYYY')` / `Date.parse` a display string.
//   - Never use local-time getters (getFullYear/getMonth/getDate) on a cell Date;
//     exceljs returns date cells as a UTC Date — use the getUTC* family only.

import ExcelJS from 'exceljs'; // CJS package: default import (esModuleInterop on)

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Trimmed display text — safe for the text columns (ID / name / assignee). */
export function cellString(cell: ExcelJS.Cell): string {
  return (cell.text ?? '').trim();
}

/**
 * A numeric cell value. null = empty; 'invalid' = present but not a number.
 * Handles primitive numbers, formula-result objects, and numeric strings.
 */
export function cellNumber(cell: ExcelJS.Cell): number | null | 'invalid' {
  const v = cell.value;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v && typeof v.result === 'number') {
    return v.result;
  }
  const n = Number(cellString(cell));
  return Number.isFinite(n) ? n : 'invalid';
}

/**
 * An ISO date ('YYYY-MM-DD') from a cell. null = empty; 'invalid' = present but
 * not resolvable. exceljs may hand back a UTC Date (date-typed cell), an Excel
 * serial number, or a plain 'YYYY-MM-DD' text — all three are accepted here and
 * ONLY here.
 */
export function cellIsoDate(cell: ExcelJS.Cell): string | null | 'invalid' {
  const v = cell.value;
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    // exceljs returns date cells as a UTC Date. Local-time getters would shift
    // the day across timezones — getUTC* only.
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  }
  if (typeof v === 'number') {
    // Excel serial value (25569 = 1970-01-01).
    return cellIsoDateFromSerial(v);
  }
  const s = cellString(cell);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : 'invalid';
}

/**
 * Excel 1900 date serial → ISO date. 25569 = 1970-01-01 (UTC epoch). The
 * fractional part (time of day) is dropped; only the calendar day matters here.
 */
export function cellIsoDateFromSerial(serial: number): string | 'invalid' {
  if (!Number.isFinite(serial)) return 'invalid';
  const days = Math.floor(serial) - 25569;
  const d = new Date(days * 86_400_000);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
