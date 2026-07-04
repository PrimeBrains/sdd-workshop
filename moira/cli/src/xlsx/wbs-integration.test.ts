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
});
