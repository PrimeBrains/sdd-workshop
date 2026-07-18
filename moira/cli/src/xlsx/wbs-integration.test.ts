import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { fold } from 'moira-backend';
import type { Event } from 'moira-backend';
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

  // issue #37 item 4: `--update` opens the diff-reimport path this file's
  // "a second import fails on existing nodes" test above documents as the
  // (unchanged) default without the flag. Kept deliberately actuals-free here
  // (no lifecycle/cost diffing) so every event in both phases is a plain
  // wall-clock `stamp()` — no anchored-vs-unanchored ts interleaving to reason
  // about. The lifecycle/cost/cancelled diff branches get deterministic
  // coverage at the planWbsEvents unit level instead (wbs-import.test.ts),
  // where a hand-built `projected` avoids real-clock timing altogether.
  describe('--update: diff-only reimport (issue #37 item 4)', () => {
    async function writePhase2(path: string): Promise<void> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('WBS');
      ws.addRow(['ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID']);
      ws.addRow(['F1', '', '認証基盤', 'alice', 5, '', '', '']); // estimate corrected 3→5
      ws.addRow(['F2', '', 'ログイン', 'alice', 2, '', '', 'F1,F3']); // gains F3 as a 2nd predecessor
      ws.addRow(['F3', 'F2', 'バリデーション', 'agent:claude', 1, '', '', '']); // fully unchanged
      await wb.xlsx.writeFile(path);
    }

    it('without --update, existing ids are still a hard error (default unchanged)', async () => {
      await runCli(['--dir', dir, 'import', 'wbs', file]); // phase 1
      const before = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');
      const phase2 = join(dir, 'phase2.xlsx');
      await writePhase2(phase2);
      await expect(runCli(['--dir', dir, 'import', 'wbs', phase2])).rejects.toThrow(/検証エラー/);
      expect(readFileSync(join(dir, '.moira', 'events.json'), 'utf8')).toBe(before);
    });

    it('applies only the diff: re-decomposed+re-agreed estimate, one new predecessor edge — unchanged F3 and unchanged assignment contribute nothing', async () => {
      await runCli(['--dir', dir, 'import', 'wbs', file]); // phase 1: 10 events
      const phase2 = join(dir, 'phase2.xlsx');
      await writePhase2(phase2);
      await runCli(['--dir', dir, 'import', 'wbs', phase2, '--update']);

      const evs = events() as Array<{
        kind: string; node?: string; to?: string; from?: string; parent?: string;
        children?: Array<{ node: string; estimate?: number }>;
      }>;
      // phase1 (10) + phase2 diff: F1 re-decompose(1) + F1 re-agree(1) + F2 relate F3→F2(1) = 3
      expect(evs).toHaveLength(13);

      const phase2Evs = evs.slice(10);
      expect(phase2Evs.filter((e) => e.kind === 'decompose')).toHaveLength(1);
      const reDecompose = phase2Evs.find((e) => e.kind === 'decompose')!;
      expect(reDecompose.children?.[0]).toEqual({ node: 'F1', estimate: 5 });
      expect(phase2Evs.filter((e) => e.kind === 'relate')).toHaveLength(1);
      expect(phase2Evs.find((e) => e.kind === 'relate')).toMatchObject({ from: 'F3', to: 'F2' });
      expect(phase2Evs.filter((e) => e.kind === 'transition' && e.to === 'agreed')).toHaveLength(1);
      // no assign event for ANY row: all three assignees/slots are unchanged from phase 1
      expect(phase2Evs.filter((e) => e.kind === 'transition' && e.to === 'ready')).toHaveLength(0);

      const d = fold(events() as unknown as Event[]);
      expect(d.nodes.get('F1')?.latestEstimate).toBe(5);
      expect(d.nodes.get('F1')?.frozenBudget).toBe(5);
      expect(d.dependencyEdges).toContainEqual({ from: 'F3', to: 'F2', policy: 'implemented' });
      expect(d.dependencyEdges).toContainEqual({ from: 'F1', to: 'F2', policy: 'implemented' }); // original edge untouched
    });

    it('a THIRD identical --update reimport is a true no-op (nothing left to diff)', async () => {
      await runCli(['--dir', dir, 'import', 'wbs', file]);
      const phase2 = join(dir, 'phase2.xlsx');
      await writePhase2(phase2);
      await runCli(['--dir', dir, 'import', 'wbs', phase2, '--update']);
      const after13 = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');

      await runCli(['--dir', dir, 'import', 'wbs', phase2, '--update']); // identical reimport
      const afterThird = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');
      expect(afterThird).toBe(after13); // byte-identical — nothing new to apply
    });
  });

  // issue #37 item 4 follow-up (found via empirical smoke test, not the
  // original spec): the single most realistic --update flow — plan a node
  // with NO actuals, then --update it later with actuals reported — has a
  // (ts,id) ordering hazard. The original import's assign(→ready) is stamped
  // at THAT import's wall-clock "now"; a later --update anchors its
  // lifecycle-actual transitions to the row's actual dates (day epoch). If
  // those actual dates are chronologically BEFORE the original import's wall-
  // clock stamp (the common case: "planned on day 1, reimported on day 10
  // with actuals from days 5-8" only IS safe because day1 < day5 — but a
  // reimport whose actuals predate the ORIGINAL import itself is not), fold's
  // (ts,id) replay applies the OLD "ready" transition LAST, silently
  // regressing a completed node back to ready with EV_abs=0 — no error, no
  // warning. validateWbs now rejects this before any write (see
  // wbs-import.ts's `latestTsPerNode` ordering-hazard check).
  describe('--update: backdated-actual ordering hazard (issue #37 item 4 follow-up)', () => {
    async function writeActualsSheet(path: string, actualStart: string, actualEnd: string): Promise<void> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('WBS');
      ws.addRow([
        'ID', '親ID', 'タスク名', '担当者', '見積MD', '予定開始日', '予定終了日', '先行ID',
        '実績開始日', '実績終了日', '実績MD', '検収済',
      ]);
      ws.addRow(['F1', '', '認証基盤', 'alice', 3, '', '', '', actualStart, actualEnd, 3, '済']);
      await wb.xlsx.writeFile(path);
    }

    it('is REJECTED (no write at all) when the reported actuals predate the node\'s own prior events — the exact corruption this check exists to prevent', async () => {
      // No clock mocking: the initial import's assign(→ready) is stamped at
      // REAL "now" (2026-07-18-ish, per this repo's fixed test-environment
      // clock); 2026-07-01..03 is unconditionally further in the past.
      await runCli(['--dir', dir, 'import', 'wbs', file]); // F1 planned, no actuals
      const before = readFileSync(join(dir, '.moira', 'events.json'), 'utf8');

      const actuals = join(dir, 'actuals-hazard.xlsx');
      await writeActualsSheet(actuals, '2026-07-01', '2026-07-03');
      // The thrown CliError is a generic "検証エラー N 件"; the per-row detail
      // (the actual assertion of interest) goes to stderr via `err()` — same
      // discipline as every other validateWbs error in this file.
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      await expect(runCli(['--dir', dir, 'import', 'wbs', actuals, '--update'])).rejects.toThrow(/検証エラー/);
      const stderrText = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrText).toMatch(/実績開始日.*が既存ログの最終更新/s);
      stderrSpy.mockRestore();

      // nothing was written — the all-or-nothing validation discipline holds
      expect(readFileSync(join(dir, '.moira', 'events.json'), 'utf8')).toBe(before);
    });

    it('SUCCEEDS and derives correctly when the actuals genuinely postdate the prior events (the realistic flow: planned on day 1, actuals from days 5-8, reimported on day 10)', async () => {
      const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
      const clockSpy = vi.spyOn(Date, 'now');

      clockSpy.mockImplementation(() => day('2026-06-01') + 1000); // day 1, just after midnight
      await runCli(['--dir', dir, 'import', 'wbs', file]); // F1 planned on day 1 — assign(→ready) stamped ~day1

      clockSpy.mockImplementation(() => day('2026-06-10'));
      const actuals = join(dir, 'actuals-safe.xlsx');
      await writeActualsSheet(actuals, '2026-06-05', '2026-06-08'); // safely between day1 and "today"(day10)
      await runCli(['--dir', dir, 'import', 'wbs', actuals, '--update']);

      clockSpy.mockRestore();
      const state = fold(events() as unknown as Event[]);
      const f1 = state.nodes.get('F1')!;
      expect(f1.lifecycle).toBe('accepted'); // NOT regressed back to 'ready'
      expect(f1.estimateState).toBe('agreed');
      expect(f1.frozenBudget).toBe(3);
      expect(f1.ownCost).toBe(3);
    });
  });
});
