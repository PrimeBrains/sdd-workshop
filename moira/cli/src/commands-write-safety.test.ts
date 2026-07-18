// issue #37 — write-layer safety hardening (8 items from
// moira/analysis/issue-33-irreversibility.md §3-§4.2). End-to-end CLI coverage
// for the commands.ts changes not already covered elsewhere:
//   item 1: `assign --slot` honesty (2nd freeze attempt warns, doesn't lie)
//   item 2: `cost` input validation (finite, node existence, anomaly warning)
//   item 3: cancelled terminality (write-layer rejection of re-transition)
//   item 5: `capacity` date/range validation
//   item 6: `relate` duplicate-add rejection + policy-scoped remove
//   item 7: destructive-command confirm gate — non-TTY pass-through (the hard
//     constraint); interactive prompting itself is covered in confirm.test.ts.
// item 4 (wbs import --update) has its own coverage in
// xlsx/wbs-import.test.ts + xlsx/wbs-integration.test.ts. item 8 (fold
// frozenBudget clear) is a backend concern, covered in
// backend/src/fold.test.ts + backend/src/derivations/planned-cost.test.ts.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fold } from 'moira-backend';
import type { Event } from 'moira-backend';
import { runCli } from './commands.js';
import { CliError } from './errors.js';
import { MoiraRepo } from './store.js';

describe('write-layer safety (issue #37)', () => {
  const cwd0 = process.cwd();
  let tmp: string;
  let stderrBuf: string[];

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'moira-safety-'));
    process.chdir(tmp);
    // realStamper() creates a FRESH stamper per CLI invocation (each `moira`
    // command is normally a separate OS process; only a single import call
    // shares one stamper — see wbs-import.ts). Driving several write commands
    // back-to-back in-process, as this suite does, can otherwise land two
    // Date.now() calls in the same millisecond and let (ts,id)'s random-suffix
    // tie-break scramble ordering. Mock a strictly-increasing clock so every
    // command gets a distinct, correctly-ordered ts — deterministic, no real
    // delays needed.
    let clock = Date.parse('2026-07-18T00:00:00Z');
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
    await runCli(['init', '--me', 'me', '--root', 'p']);
    stderrBuf = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrBuf.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const stderrText = (): string => stderrBuf.join('');
  const events = (): Event[] => JSON.parse(readFileSync(join(tmp, '.moira', 'events.json'), 'utf8')) as Event[];

  // --- item 1: assign --slot honesty ---------------------------------------
  describe('moira assign --slot', () => {
    beforeEach(async () => {
      await runCli(['add', 'a', '--estimate', '2']);
    });

    it('rejects a malformed --slot without appending', async () => {
      await expect(runCli(['assign', 'a', '--to', 'alice', '--slot', 'not-a-date'])).rejects.toThrow(CliError);
      expect(events()).toHaveLength(1); // only the decompose from beforeEach
    });

    it('a first --slot freezes silently (no warning)', async () => {
      await runCli(['assign', 'a', '--to', 'alice', '--slot', '2026-08-01']);
      expect(stderrText()).not.toContain('初回凍結済み');
      const n = fold(events()).nodes.get('a')!;
      expect(n.frozenSlot).toBe('2026-08-01');
    });

    it('a second --slot on the same node warns honestly, keeps the frozen value, but still lets the assignee change through', async () => {
      await runCli(['assign', 'a', '--to', 'alice', '--slot', '2026-08-01']);
      await runCli(['assign', 'a', '--to', 'bob', '--slot', '2026-09-01']);
      expect(stderrText()).toContain('初回凍結済みのため slot は無効');
      expect(stderrText()).toContain('2026-08-01'); // the frozen value is disclosed
      const n = fold(events()).nodes.get('a')!;
      expect(n.frozenSlot).toBe('2026-08-01'); // unchanged — fold's first-freeze rule
      expect(n.assignee).toEqual({ kind: 'human', id: 'bob' }); // but assignee latest-wins DID apply
    });

    it('rejects an assign onto a cancelled node (item 3 consistency — no lifecycle resurrection via assign)', async () => {
      await runCli(['cancel', 'a']);
      await expect(runCli(['assign', 'a', '--to', 'alice'])).rejects.toThrow(/cancelled/);
    });
  });

  // --- item 2: cost validation ----------------------------------------------
  describe('moira cost', () => {
    beforeEach(async () => {
      await runCli(['add', 'a', '--estimate', '2']);
    });

    it('rejects a non-numeric amount without appending (NaN cannot slip the <0 guard)', async () => {
      await expect(runCli(['cost', 'a', '5o'])).rejects.toThrow(CliError);
      expect(events()).toHaveLength(1);
    });

    it('rejects cost on a node id that never appeared in the log (ghost-node prevention)', async () => {
      await expect(runCli(['cost', 'nonexistent', '1'])).rejects.toThrow(/unknown node/);
      expect(events()).toHaveLength(1);
    });

    it('accepts a normal amount and applies it', async () => {
      await runCli(['cost', 'a', '1.5']);
      expect(fold(events()).nodes.get('a')?.ownCost).toBe(1.5);
    });

    it('warns (does not reject) on an anomalously large single entry', async () => {
      await runCli(['cost', 'a', '9']);
      expect(stderrText()).toContain('大きめ');
      expect(fold(events()).nodes.get('a')?.ownCost).toBe(9); // still applied
    });
  });

  // --- item 3: cancelled terminality ----------------------------------------
  describe('lifecycle terminality (cancelled)', () => {
    beforeEach(async () => {
      await runCli(['add', 'a', '--estimate', '2']);
    });

    it('rejects any further transition on an already-cancelled node', async () => {
      await runCli(['cancel', 'a']);
      const before = events().length;
      await expect(runCli(['start', 'a'])).rejects.toThrow(/cancelled/);
      await expect(runCli(['done', 'a'])).rejects.toThrow(/cancelled/);
      await expect(runCli(['accept', 'a'])).rejects.toThrow(/cancelled/);
      await expect(runCli(['cancel', 'a'])).rejects.toThrow(/cancelled/);
      expect(events()).toHaveLength(before); // nothing appended by any of the rejections
    });

    it('does NOT reject a forward-skip (ready→implemented without an intervening start) — §7#13(b) is in-scope, not this guard', async () => {
      await runCli(['assign', 'a', '--to', 'alice']); // → ready
      await expect(runCli(['done', 'a'])).resolves.not.toThrow();
      expect(fold(events()).nodes.get('a')?.lifecycle).toBe('implemented');
    });

    it('does NOT reject an honest backward move (implemented→implementing) — P5 non-monotonic signal stays legal', async () => {
      await runCli(['start', 'a']);
      await runCli(['done', 'a']);
      await expect(runCli(['start', 'a'])).resolves.not.toThrow();
      expect(fold(events()).nodes.get('a')?.lifecycle).toBe('implementing');
    });
  });

  // --- item 7: destructive confirm gate — non-TTY pass-through -------------
  describe('cancel/done confirm gate (non-TTY pass-through — the hard constraint)', () => {
    it('this test process is not a TTY, so cancel/done proceed WITHOUT hanging or requiring --yes', async () => {
      await runCli(['add', 'a', '--estimate', '2']);
      await expect(runCli(['done', 'a'])).resolves.not.toThrow();
      await runCli(['add', 'b', '--estimate', '1']);
      await expect(runCli(['cancel', 'b'])).resolves.not.toThrow();
      expect(fold(events()).nodes.get('a')?.lifecycle).toBe('implemented');
      expect(fold(events()).nodes.get('b')?.lifecycle).toBe('cancelled');
    });

    it('--yes/-y are accepted flags on cancel/done (harmless no-op off a TTY, but must not break parsing)', async () => {
      await runCli(['add', 'a', '--estimate', '2']);
      await expect(runCli(['done', 'a', '--yes'])).resolves.not.toThrow();
      await runCli(['add', 'b', '--estimate', '1']);
      await expect(runCli(['cancel', 'b', '-y'])).resolves.not.toThrow();
    });
  });

  // --- item 5: capacity validation -------------------------------------------
  describe('moira capacity', () => {
    it('rejects a malformed date', async () => {
      await expect(runCli(['capacity', 'alice', 'not-a-date', '0.5'])).rejects.toThrow(CliError);
    });

    it('rejects c outside [0,1]', async () => {
      await expect(runCli(['capacity', 'alice', '2026-08-01', '1.5'])).rejects.toThrow(CliError);
      // A bare leading-'-' positional needs Node's util.parseArgs `--` escape
      // (unrelated to this task — a pre-existing parseArgs behavior everywhere
      // in this CLI, not something #37 changes).
      await expect(runCli(['capacity', 'alice', '2026-08-01', '--', '-0.1'])).rejects.toThrow(CliError);
    });

    it('rejects a non-numeric c (symmetric with the isFinite guard)', async () => {
      await expect(runCli(['capacity', 'alice', '2026-08-01', 'x'])).rejects.toThrow(CliError);
    });

    it('accepts a valid entry', async () => {
      await runCli(['capacity', 'alice', '2026-08-01', '0.5']);
      const repo = new MoiraRepo(tmp);
      expect(repo.loadCapacity()).toEqual([
        expect.objectContaining({ humanId: 'alice', date: '2026-08-01', capacity: 0.5 }),
      ]);
    });
  });

  // --- item 6: relate duplicate-add rejection + policy-scoped remove --------
  describe('moira relate', () => {
    beforeEach(async () => {
      await runCli(['add', 'a', '--estimate', '1']);
      await runCli(['add', 'b', '--estimate', '1']);
    });

    it('rejects an exact duplicate add', async () => {
      await runCli(['relate', 'a', 'b']);
      await expect(runCli(['relate', 'a', 'b'])).rejects.toThrow(/既に存在/);
      expect(fold(events()).dependencyEdges).toHaveLength(1);
    });

    it('remove then re-add with a different policy is the sanctioned way to change policy', async () => {
      await runCli(['relate', 'a', 'b', '--policy', 'accepted']);
      await runCli(['relate', 'a', 'b', '--remove']);
      await runCli(['relate', 'a', 'b', '--policy', 'implemented']);
      expect(fold(events()).dependencyEdges).toEqual([{ from: 'a', to: 'b', policy: 'implemented' }]);
    });

    it('a policy-scoped --remove only clears the matching edge among coexisting duplicates (legacy/hand-authored log)', async () => {
      // Simulate a pre-#37 (or hand-authored) log where two policies coexist
      // for the same pair — cmdRelate's own dedup can't produce this going
      // forward, but fold must still handle logs that already have it.
      const repo = new MoiraRepo(tmp);
      const base = { kind: 'relate' as const, actor: { kind: 'human' as const, id: 'me' }, from: 'a', to: 'b', op: 'add' as const, edgeKind: 'dependency' as const };
      repo.appendEvents([
        { ...base, id: 'r1', ts: 1000, policy: 'accepted' },
        { ...base, id: 'r2', ts: 1001, policy: 'implemented' },
      ]);
      expect(fold(events()).dependencyEdges).toHaveLength(2);

      await runCli(['relate', 'a', 'b', '--remove', '--policy', 'accepted']);
      expect(fold(events()).dependencyEdges).toEqual([{ from: 'a', to: 'b', policy: 'implemented' }]);
    });

    it('an un-scoped --remove clears ALL (from,to) edges regardless of policy (unchanged default)', async () => {
      const repo = new MoiraRepo(tmp);
      const base = { kind: 'relate' as const, actor: { kind: 'human' as const, id: 'me' }, from: 'a', to: 'b', op: 'add' as const, edgeKind: 'dependency' as const };
      repo.appendEvents([
        { ...base, id: 'r1', ts: 1000, policy: 'accepted' },
        { ...base, id: 'r2', ts: 1001, policy: 'implemented' },
      ]);
      await runCli(['relate', 'a', 'b', '--remove']);
      expect(fold(events()).dependencyEdges).toEqual([]);
    });
  });
});
