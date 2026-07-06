// `moira template wbs` — build the blank WBS workbook a user fills in and feeds
// back to `moira import wbs`. Two sheets: `WBS` (header row only — the data goes
// here) and `説明` (rules + a worked example). The example lives on `説明`, NOT on
// `WBS`, so a user who just fills and imports can never accidentally import the
// sample rows (the事故 is prevented structurally, not by a warning).

import ExcelJS from 'exceljs';

/** WBS column order — index-aligned with parseWbsSheet. ID / タスク名 are required.
 * 実績〜検収済 (9-12) import already-started/completed work: actuals become the ts
 * of ordinary lifecycle transitions (D-30 — no new event kind, D-66 mechanical
 * translation only). */
export const WBS_HEADERS = [
  'ID',
  '親ID',
  'タスク名',
  '担当者',
  '見積MD',
  '予定開始日',
  '予定終了日',
  '先行ID',
  '実績開始日',
  '実績終了日',
  '実績MD',
  '検収済',
] as const;

const DATE_FMT = 'yyyy-mm-dd';

export function buildWbsTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('WBS');
  ws.addRow([...WBS_HEADERS]);
  ws.getRow(1).font = { bold: true };
  // Date columns (予定開始日=6, 予定終了日=7, 実績開始日=9, 実績終了日=10) display as YYYY-MM-DD.
  ws.getColumn(6).numFmt = DATE_FMT;
  ws.getColumn(7).numFmt = DATE_FMT;
  ws.getColumn(9).numFmt = DATE_FMT;
  ws.getColumn(10).numFmt = DATE_FMT;
  // Comfortable widths for reading; purely cosmetic.
  ws.columns.forEach((c, i) => {
    c.width = i === 2 ? 28 : 14; // タスク名 wider
  });

  const help = wb.addWorksheet('説明');
  help.getColumn(1).width = 16;
  help.getColumn(2).width = 70;
  const say = (a: string, b = ''): void => {
    help.addRow([a, b]);
  };
  say('記入ルール', '');
  say('ID*', '必須。英数と . - _ / のみ（例: F1, api.auth, ui/list）。ファイル内で一意。');
  say('親ID', '空欄＝プロジェクト root 直下。指定時は同ファイル内 or 既存ログのノード。');
  say('タスク名*', '必須。表示ラベルになる。');
  say('担当者', 'actor ID（表示名ではない）。エージェントは agent:claude の形式。');
  say('見積MD', '数値 ≥ 0。空欄なら合意見積・スケジュール充填の対象外（警告）。');
  say('予定開始日', 'YYYY-MM-DD（Excel の日付セルでも可）。空欄なら先行/容量から充填。');
  say('予定終了日', 'YYYY-MM-DD（Excel の日付セルでも可）。空欄なら見積からビンパッキング。');
  say('先行ID', 'カンマ区切り。同ファイル内 or 既存ログの ID。');
  say('実績開始日', 'YYYY-MM-DD・今日以前。記入＝着手済みとして取り込む（開始の遷移を実績日で記録）。');
  say('実績終了日', 'YYYY-MM-DD・今日以前。記入＝完了として取り込む（実績開始日が必須）。');
  say('実績MD', '数値 ≥ 0。かかった実工数（AC）。実績開始日のある行のみ。完了行で空欄だと CPI が楽観に振れる（警告）。');
  say('検収済', '「済」と記入で受入（検収）まで取り込む。実績終了日のある行のみ。記入＝取り込み実行者の受入コミット。');
  say('', '');
  say('完了行の予定終了日が空欄のときは予定を凍結しない（PV に乗らず scheduleCoverage が下がる＝正直開示）。', '');
  say('', '');
  say('記入例（この行は WBS シートに書かないこと）', '');
  say('ID', '親ID / タスク名 / 担当者 / 見積MD / 予定開始日 / 予定終了日 / 先行ID / 実績開始日 / 実績終了日 / 実績MD / 検収済');
  say('F1', ' / 認証基盤 / alice / 3 / 2026-07-01 / 2026-07-03 /  / 2026-07-01 / 2026-07-03 / 3.5 / 済');
  say('F2', ' / ログイン画面 / alice / 2 /  /  / F1 / 2026-07-04 /  / 1 / ');
  say('F3', 'F2 / 入力バリデーション / agent:claude / 1 /  /  /  /  /  /  / ');

  return wb;
}

/** Write the template to `path`. Caller must guard against overwrite (CliError). */
export async function writeWbsTemplate(path: string): Promise<void> {
  const wb = buildWbsTemplate();
  await wb.xlsx.writeFile(path);
}
