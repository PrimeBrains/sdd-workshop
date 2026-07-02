import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from 'moira-backend';
import { agreeEvent, assignEvent, decomposeEvent, lifecycleEvent } from '../../emit.js';
import { seqStamper } from '../../stamp.js';
import { MoiraRepo } from '../../store.js';
import { cmdDrift, computeDriftReport } from './drift.js';

// End-to-end golden over a REAL repo layout: .kiro/specs/<f>/{spec.json,tasks.md}
// + .moira written through MoiraRepo — the same shape `moira adapter drift` sees.

const me: Actor = { kind: 'human', id: 'me' };
const ai: Actor = { kind: 'agent', id: 'claude' };

const tmp = mkdtempSync(join(tmpdir(), 'moira-drift-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function seedKiro(): void {
  const dir = join(tmp, '.kiro', 'specs', 'task-add');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'spec.json'),
    JSON.stringify(
      {
        feature_name: 'task-add',
        language: 'ja',
        phase: 'design-generated',
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: false },
          tasks: { generated: false, approved: false },
        },
        ready_for_implementation: false,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'tasks.md'), '- [ ] 1. impl a\n- [ ] 2. impl b\n');
}

function seedMoira(): void {
  const repo = new MoiraRepo(tmp);
  repo.init({ projectRoot: 'demo-root', me: 'me' });
  const s = seqStamper();
  const f = 'task-add';
  repo.appendEvents([
    decomposeEvent(s(), ai, 'demo-root', [{ node: f }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/req`, estimate: 0.5 }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/design`, estimate: 0.5 }], 'add'),
    decomposeEvent(s(), ai, f, [{ node: `${f}/tasks`, estimate: 0.5 }], 'add'),
    agreeEvent(s(), me, `${f}/req`),
    assignEvent(s(), me, `${f}/req`, me, { frozenSlot: '2026-07-01' }),
    lifecycleEvent(s(), ai, `${f}/req`, 'implementing'),
    lifecycleEvent(s(), ai, `${f}/req`, 'implemented'),
    lifecycleEvent(s(), me, `${f}/req`, 'accepted'),
    // design was agreed+assigned+started but done/cost never got tracked (firing miss)
    agreeEvent(s(), me, `${f}/design`),
    assignEvent(s(), me, `${f}/design`, me, { frozenSlot: '2026-07-02' }),
    lifecycleEvent(s(), ai, `${f}/design`, 'implementing'),
  ]);
}

describe('computeDriftReport — golden fixture repo', () => {
  seedKiro();
  seedMoira();
  const report = computeDriftReport(tmp);

  it('stamps metadata and the provider', () => {
    expect(report.schemaVersion).toBe(1);
    expect(report.provider).toBe('cc-sdd');
    expect(report.projectRoot).toBe('demo-root');
    expect(report.adapterVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('finds exactly the seeded drift: design behind (done missing), rest ok', () => {
    const f = report.features[0]!;
    expect(f.feature).toBe('task-add');
    const byId = new Map(f.nodes.map((n) => [n.node, n]));
    expect(byId.get('task-add')?.status).toBe('ok');
    expect(byId.get('task-add/req')?.status).toBe('ok');
    expect(byId.get('task-add/tasks')?.status).toBe('ok');
    const design = byId.get('task-add/design')!;
    expect(design.status).toBe('behind'); // agreed+assigned+implementing → mechanical catch-up
    expect(design.severity).toBe('hard');
    expect(design.suggested.map((c) => c.argv[1])).toEqual(['done', 'cost']);
    expect(report.summary).toEqual({ hard: 1, advisory: 0, needsHuman: 0, ok: 3 });
  });

  it('--feature filter narrows and errors on unknown features', () => {
    expect(computeDriftReport(tmp, 'task-add').features).toHaveLength(1);
    expect(() => computeDriftReport(tmp, 'nope')).toThrow(/nope/);
  });

  it('--check exits 1 on hard/needs-human drift (advisory-only would not)', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const saved = process.exitCode;
    try {
      cmdDrift(['--dir', tmp, '--check']);
      expect(process.exitCode).toBe(1); // the golden fixture has 1 hard drift
    } finally {
      process.exitCode = saved;
      spy.mockRestore();
    }
  });
});
