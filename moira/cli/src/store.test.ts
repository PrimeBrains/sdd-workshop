import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from 'moira-backend';
import { agreeEvent, decomposeEvent } from './emit.js';
import { MoiraRepo } from './store.js';

const me: Actor = { kind: 'human', id: 'me' };

describe('MoiraRepo — .moira/ persistence round-trips', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moira-cli-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('init creates the dir; events append and reload in order', () => {
    const repo = new MoiraRepo(dir);
    expect(repo.exists()).toBe(false);
    repo.init({ projectRoot: 'root', me: 'me' });
    expect(repo.exists()).toBe(true);

    repo.appendEvents([decomposeEvent({ id: 'e1', ts: 1 }, me, 'root', [{ node: 'F', estimate: 5 }], 'r')]);
    repo.appendEvents([agreeEvent({ id: 'e2', ts: 2 }, me, 'F', 5)]);

    const events = repo.loadEvents();
    expect(events).toHaveLength(2);
    expect(events[0]!.kind).toBe('decompose');
    expect(events[1]!.kind).toBe('transition');
  });

  it('labels and capacity persist', () => {
    const repo = new MoiraRepo(dir);
    repo.init({ projectRoot: 'root', me: 'me' });

    repo.setNodeLabel('F', 'フィーチャー');
    repo.setActorLabel('alice', '田中');
    const labels = repo.loadLabels();
    expect(labels.nodeLabels.F).toBe('フィーチャー');
    expect(labels.actorLabels.alice).toBe('田中');

    repo.appendCapacity([{ humanId: 'me', date: '2026-06-22', capacity: 0.5, reason: 'part-time', ts: 1 }]);
    expect(repo.loadCapacity()).toHaveLength(1);
    expect(repo.loadCapacity()[0]!.capacity).toBe(0.5);
  });

  it('config persists projectRoot and me', () => {
    const repo = new MoiraRepo(dir);
    repo.init({ projectRoot: 'todo-app', me: 'taro' });
    const cfg = repo.loadConfig();
    expect(cfg.projectRoot).toBe('todo-app');
    expect(cfg.me).toBe('taro');
  });

  it('members: init seeds [] and save/load round-trips (defaultCapacity key omitted when absent)', () => {
    const repo = new MoiraRepo(dir);
    repo.init({ projectRoot: 'root', me: 'me' });
    expect(repo.loadMembers()).toEqual([]);

    repo.saveMembers([
      { id: 'nakao', kind: 'human', label: '中尾' },
      { id: 'agent:claude', kind: 'agent', label: 'Claude', defaultCapacity: 0.5 },
    ]);
    const members = repo.loadMembers();
    expect(members).toHaveLength(2);
    expect(members[0]).toEqual({ id: 'nakao', kind: 'human', label: '中尾' });
    expect('defaultCapacity' in members[0]!).toBe(false); // omitted, not undefined
    expect(members[1]!.defaultCapacity).toBe(0.5);
  });
});
