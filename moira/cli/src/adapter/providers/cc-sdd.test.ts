import { describe, expect, it } from 'vitest';
import { buildExpectedFeature, parseSpecJson, parseTasksMd } from './cc-sdd.js';

const spec = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    feature_name: 'task-add',
    created_at: '2026-06-21T13:46:39Z',
    updated_at: '2026-06-22T01:00:00Z',
    language: 'ja',
    phase: 'initialized',
    approvals: {
      requirements: { generated: false, approved: false },
      design: { generated: false, approved: false },
      tasks: { generated: false, approved: false },
    },
    ready_for_implementation: false,
    ...over,
  });

const nodeOf = (f: ReturnType<typeof buildExpectedFeature>, id: string) => {
  const n = f.nodes.find((n) => n.node === id);
  if (n === undefined) throw new Error(`expected node ${id} missing`);
  return n;
};

describe('parseSpecJson — phase × approvals combinations', () => {
  it('initialized: nothing generated/approved', () => {
    const s = parseSpecJson('task-add', spec());
    expect(s.feature).toBe('task-add');
    expect(s.requirements).toEqual({ generated: false, approved: false });
    expect(s.tasks).toEqual({ generated: false, approved: false });
  });

  it('approvals flags are authoritative', () => {
    const s = parseSpecJson(
      'task-add',
      spec({
        phase: 'requirements-generated',
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: false, approved: false },
          tasks: { generated: false, approved: false },
        },
      }),
    );
    expect(s.requirements).toEqual({ generated: true, approved: true });
    expect(s.design.generated).toBe(false);
  });

  it('phase implies earlier phases were generated even if approvals is missing', () => {
    const s = parseSpecJson('task-add', spec({ phase: 'design-generated', approvals: {} }));
    expect(s.requirements.generated).toBe(true); // implied by design-generated
    expect(s.design.generated).toBe(true);
    expect(s.tasks.generated).toBe(false);
    expect(s.requirements.approved).toBe(false); // approval is NEVER implied by phase
  });

  it('tasks-generated implies all three generated', () => {
    const s = parseSpecJson('task-add', spec({ phase: 'tasks-generated', approvals: {} }));
    expect(s.requirements.generated).toBe(true);
    expect(s.design.generated).toBe(true);
    expect(s.tasks.generated).toBe(true);
  });

  it('feature name falls back: feature_name → name → dir name', () => {
    expect(parseSpecJson('dir', spec()).feature).toBe('task-add');
    expect(parseSpecJson('dir', JSON.stringify({ name: 'legacy-name' })).feature).toBe('legacy-name');
    expect(parseSpecJson('dir', '{}').feature).toBe('dir');
  });
});

describe('parseTasksMd — checkbox counting', () => {
  it('counts majors and sub-tasks, checked case-insensitively', () => {
    const md = [
      '# Tasks',
      '- [x] 1. Major one',
      '  - [X] 1.1 Sub done',
      '  - [ ] 1.2 Sub pending',
      '- [ ] 2. Major two (P)',
      'not a checkbox - [x] inline',
    ].join('\n');
    expect(parseTasksMd(md)).toEqual({ checked: 2, total: 4 });
  });

  it('tolerates the `- [x]*` marker variant and empty files', () => {
    expect(parseTasksMd('- [x]* 1. starred done\n- [ ]* 2. starred pending')).toEqual({
      checked: 1,
      total: 2,
    });
    expect(parseTasksMd('')).toEqual({ checked: 0, total: 0 });
  });
});

describe('buildExpectedFeature — expectation mapping', () => {
  it('initialized spec → existence-only expectations, no impl requirement', () => {
    const f = buildExpectedFeature('task-add', '.kiro/specs/task-add', 'root-x', spec(), null);
    expect(f.parseError).toBeUndefined();
    expect(nodeOf(f, 'task-add')).toMatchObject({ parent: 'root-x', minLifecycle: null, maxLifecycle: null });
    expect(nodeOf(f, 'task-add/req')).toMatchObject({ minLifecycle: null, maxLifecycle: 'implementing' });
    expect(f.implGroup).toMatchObject({ prefix: 'task-add/impl-', reviewNode: 'task-add/review-impl', requireExists: false });
  });

  it('generated → ≥implemented; approved → =accepted (with ceilings)', () => {
    const f = buildExpectedFeature(
      'task-add',
      '.kiro/specs/task-add',
      'root-x',
      spec({
        phase: 'design-generated',
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: false },
          tasks: { generated: false, approved: false },
        },
      }),
      null,
    );
    expect(nodeOf(f, 'task-add/req')).toMatchObject({ minLifecycle: 'accepted', maxLifecycle: 'accepted' });
    expect(nodeOf(f, 'task-add/design')).toMatchObject({ minLifecycle: 'implemented', maxLifecycle: 'implemented' });
    expect(nodeOf(f, 'task-add/tasks')).toMatchObject({ minLifecycle: null, maxLifecycle: 'implementing' });
  });

  it('tasks approved (or ready_for_implementation) requires impl nodes to exist', () => {
    const approved = buildExpectedFeature(
      't',
      'p',
      'r',
      spec({ approvals: { tasks: { generated: true, approved: true } } }),
      '- [ ] 1. a\n- [x] 2. b',
    );
    expect(approved.implGroup).toMatchObject({ requireExists: true, tasksChecked: 1, tasksTotal: 2 });

    const ready = buildExpectedFeature('t', 'p', 'r', spec({ ready_for_implementation: true }), null);
    expect(ready.implGroup?.requireExists).toBe(true);
  });

  it('malformed spec.json → parseError entry, never a throw', () => {
    const f = buildExpectedFeature('broken', '.kiro/specs/broken', 'r', '{not json', null);
    expect(f.parseError).toContain('spec.json');
    expect(f.nodes).toEqual([]);
    expect(f.feature).toBe('broken');
  });
});
