import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './commands.js';
import { MoiraRepo } from './store.js';

// Drive `moira member …` through the real dispatcher against a temp .moira home
// (MOIRA_DIR), asserting the two files it must touch: members.json + labels.json.
describe('moira member add / list (end-to-end via runCli)', () => {
  let dir: string;
  let repo: MoiraRepo;
  let stdout: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moira-member-'));
    repo = new MoiraRepo(dir);
    repo.init({ projectRoot: 'root', me: 'me' });
    process.env.MOIRA_DIR = dir;
    stdout = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
      stdout.push(String(s));
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MOIRA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('add writes members.json AND registers the display name in labels.json', async () => {
    await runCli(['member', 'add', 'nakao', '--label', '中尾', '--capacity', '0.8']);
    expect(repo.loadMembers()).toEqual([{ id: 'nakao', kind: 'human', label: '中尾', defaultCapacity: 0.8 }]);
    expect(repo.loadLabels().actorLabels.nakao).toBe('中尾');
  });

  it('add is an upsert (same id updates in place, capacity dropped when re-added without it)', async () => {
    await runCli(['member', 'add', 'nakao', '--label', '中尾', '--capacity', '0.8']);
    await runCli(['member', 'add', 'nakao', '--label', '中尾さん']);
    const members = repo.loadMembers();
    expect(members).toHaveLength(1);
    expect(members[0]).toEqual({ id: 'nakao', kind: 'human', label: '中尾さん' });
  });

  it('add infers agent kind from the agent: id prefix', async () => {
    await runCli(['member', 'add', 'agent:claude', '--label', 'Claude']);
    expect(repo.loadMembers()[0]!.kind).toBe('agent');
    expect(repo.loadLabels().actorLabels.claude).toBe('Claude'); // parseActor strips the prefix for the label id
  });

  it('list prints the roster', async () => {
    await runCli(['member', 'add', 'nakao', '--label', '中尾']);
    stdout.length = 0;
    await runCli(['member', 'list']);
    expect(stdout.join('')).toContain('中尾');
  });
});
