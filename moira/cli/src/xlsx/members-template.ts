// `moira template members` — build the blank roster workbook a user fills in and
// feeds back to `moira import members`. Four sheets: three data sheets (要員 /
// 個人カレンダー / 祝日, header row only — the data goes here) and 説明 (rules,
// a worked example, and the two HONEST LIMITS of v1). The example lives on 説明,
// NOT on the data sheets, so a fill-and-import can never pull in the sample rows
// (the事故 is prevented structurally — same discipline as the WBS template).

import ExcelJS from 'exceljs';

/** 要員 sheet columns — index-aligned with parseMembersSheet. ID / 氏名 required. */
export const MEMBER_HEADERS = ['ID', '氏名', '既定稼働率'] as const;
/** 個人カレンダー columns — index-aligned with parseCalendarSheet. */
export const CALENDAR_HEADERS = ['要員ID', '日付', '稼働率', '理由'] as const;
/** 祝日 columns — index-aligned with parseHolidaySheet. */
export const HOLIDAY_HEADERS = ['日付', '名称'] as const;

const DATE_FMT = 'yyyy-mm-dd';

export function buildMembersTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const members = wb.addWorksheet('要員');
  members.addRow([...MEMBER_HEADERS]);
  members.getRow(1).font = { bold: true };
  members.getColumn(1).width = 14;
  members.getColumn(2).width = 20; // 氏名
  members.getColumn(3).width = 12;

  const cal = wb.addWorksheet('個人カレンダー');
  cal.addRow([...CALENDAR_HEADERS]);
  cal.getRow(1).font = { bold: true };
  cal.getColumn(2).numFmt = DATE_FMT; // 日付
  cal.getColumn(1).width = 14;
  cal.getColumn(2).width = 14;
  cal.getColumn(3).width = 10;
  cal.getColumn(4).width = 24;

  const hol = wb.addWorksheet('祝日');
  hol.addRow([...HOLIDAY_HEADERS]);
  hol.getRow(1).font = { bold: true };
  hol.getColumn(1).numFmt = DATE_FMT; // 日付
  hol.getColumn(1).width = 14;
  hol.getColumn(2).width = 24;

  const help = wb.addWorksheet('説明');
  help.getColumn(1).width = 18;
  help.getColumn(2).width = 74;
  const say = (a: string, b = ''): void => {
    help.addRow([a, b]);
  };
  say('記入ルール', '');
  say('要員.ID*', '必須。英数と . - _ / : のみ（例: nakao, agent:claude）。ファイル内で一意。担当者=この actor ID。');
  say('要員.氏名*', '必須。画面に出る表示名。');
  say('要員.既定稼働率', '任意。0〜1。※ v1 は c エントリに実体化しない（下記「既知の限界」参照）。');
  say('個人カレンダー.要員ID*', '要員シート または既存の members.json に存在する ID。');
  say('個人カレンダー.日付*', 'YYYY-MM-DD（Excel の日付セルでも可）。');
  say('個人カレンダー.稼働率*', '0〜1。0＝その日は休み。');
  say('個人カレンダー.理由', '任意メモ（監査に残る）。');
  say(
    '祝日.日付*',
    'YYYY-MM-DD。名簿の human 全員がその日 c=0 に展開される。標準の土日・日本の祝日は組織カレンダーで' +
      '自動的に非稼働になるため（issue #32、moira config org-calendar で on/off）、ここには会社独自の' +
      '休業日（夏季休業・創立記念日など）のみ記載を推奨。',
  );
  say('祝日.名称', '任意。');
  say('', '');
  say('既知の限界（v1）', '');
  say('①祝日の展開', '祝日は「インポート時点の名簿」にのみ実体化されます。後から要員を足したら、祝日を効かせるには再インポートが必要です。');
  say('②既定稼働率', '既定稼働率 < 1.0 は v1 では稼働率エントリに実体化しません（エンジン既定 1.0 のまま）。実レートは個人カレンダー行か moira capacity で入れてください。members.json には保持され表示・将来機能に使います。');
  say('', '');
  say('記入例（この行はデータシートに書かないこと）', '');
  say('要員', 'nakao / 中尾 / 1');
  say('要員', 'sato / 佐藤 / 0.5');
  say('個人カレンダー', 'nakao / 2026-07-10 / 0 / 私用');
  say('祝日', '2026-07-20 / 海の日');
  say('祝日', '2026-08-11 / 山の日');

  return wb;
}

/** Write the template to `path`. Caller must guard against overwrite (CliError). */
export async function writeMembersTemplate(path: string): Promise<void> {
  const wb = buildMembersTemplate();
  await wb.xlsx.writeFile(path);
}
