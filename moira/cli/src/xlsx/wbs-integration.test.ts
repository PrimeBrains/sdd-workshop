import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { runCli } from '../commands.js';

// End-to-end through the real CLI dispatcher (runCli) against a temp .moira/.
// The global `--dir` flag points log-home resolution at the temp dir.
async function writeFilled(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('WBS');
  ws.addRow(['ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID']);
  ws.addRow(['F1', '', '認証基盤', 'alice', 3, '', '', '']);
  ws.addRow(['F2', '', 'ログイン', 'alice', 2, '', '', 'F1']);
  ws.addRow(['F3', 'F2', 'バリデーション', 'agent:claude', 1, '', '', '']);
  await wb.xlsx.writeFile(path);
}

describe('moira import wbs — integration via runCli', () => {
  let dir: string;
  let file: string;
  const events = (): unknown[] => JSON.parse(readFileSync(join(dir, '.moira', 'events.json'), 'utf8'));

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'moira-wbs-int-'));
    file = join(dir, 'filled.xlsx');
    await writeFilled(file);
    await runCli(['--dir', dir, 'init', '--me', 'alice', '--root', 'root']);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('--dry-run writes nothing', async () => {
    await runCli(['--dir', dir, 'import', 'wbs', file, '--dry-run']);
    expect(events()).toHaveLength(0);
  });

  it('imports all rows in one append and registers labels', async () => {
    await runCli(['--dir', dir, 'import', 'wbs', file]);
    // 3 decompose + 1 relate + 3 agree + 3 assign = 10
    expect(events()).toHaveLength(10);
    const labels = JSON.parse(readFileSync(join(dir, '.moira', 'labels.json'), 'utf8'));
    expect(labels.nodeLabels.F1).toBe('認証基盤');
    expect(labels.actorLabels.claude).toBe('claude'); // unregistered actor id→id
  });

  it('a second import fails on existing nodes and changes nothing', async () => {
    await runCli(['--dir', dir, 'import', 'wbs', file]);
    const before = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');
    await expect(runCli(['--dir', dir, 'import', 'wbs', file])).rejects.toThrow(/検証エラー/);
    const after = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');
    expect(after).toBe(before); // byte-identical
  });

  it('imports completed / in-progress rows as backdated lifecycle transitions + cost (issue #24)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('WBS');
    ws.addRow([
      'ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID',
      '実績開始日', '実績終了日', '実績MD', '検収済',
    ]);
    ws.addRow(['D1', '', '完了済', 'alice', 3, '', '2026-07-02', '', '2026-07-01', '2026-07-03', 3.5, '済']);
    ws.addRow(['D2', '', '着手中', 'alice', 2, '', '', 'D1', '2026-07-04', '', 1, '']);
    ws.addRow(['D3', '', '計画のみ', 'alice', 1, '', '', 'D2', '', '', '', '']);
    const actualsFile = join(dir, 'actuals.xlsx');
    await wb.xlsx.writeFile(actualsFile);

    await runCli(['--dir', dir, 'import', 'wbs', actualsFile]);
    const evs = events() as Array<{ kind: string; node?: string; to?: string; ts: number; amount?: number }>;
    // 3 decompose + 2 relate + 3 agree + 3 assign + 4 lifecycle (start/done/accept D1, start D2) + 2 cost = 17
    expect(evs).toHaveLength(17);
    const to = (state: string): number => evs.filter((e) => e.kind === 'transition' && e.to === state).length;
    expect(to('implementing')).toBe(2); // start D1, start D2
    expect(to('implemented')).toBe(1); // done D1
    expect(to('accepted')).toBe(1); // accept D1
    expect(evs.filter((e) => e.kind === 'cost')).toHaveLength(2);
    // the actual dates ARE the transition ts (D-30 derivation source)
    const done = evs.find((e) => e.kind === 'transition' && e.to === 'implemented')!;
    expect(done.ts).toBe(Date.parse('2026-07-03T00:00:00Z'));
    const d1cost = evs.find((e) => e.kind === 'cost' && e.node === 'D1')!;
    expect(d1cost.ts).toBe(Date.parse('2026-07-03T00:00:00Z'));
    expect(d1cost.amount).toBe(3.5);
  });
});
