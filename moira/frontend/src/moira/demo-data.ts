// Rich demo project — DATA ONLY (no derivation/feature change; UI-DESIGN-BRIEF §7).
// Built with the same event builders as backend/src/fixtures/tiny-project.ts, so
// the fold is exercised exactly as the golden path. Deliberately covers every
// interesting case the surfaces must render:
//   - deep tree (a leaf decomposed into sub-tasks → 3 indent levels)
//   - all lifecycle states (pending/ready/implementing/implemented/accepted/cancelled)
//   - estimate gap (proposed-not-agreed leaves → estimateCoverage < 1)
//   - unassigned-but-agreed leaf → unassignedBacklog + scheduleCoverage < 1
//   - COMPLETED leaf with frozenSlot = null → the "third state" (PV-excluded, R-S6)
//   - supersede (old kept in cumulativeEvAbs, dropped from effective set)
//   - cancelled (sunk) leaf
//   - an agent-assigned node (distinct Gantt row, A5/R-U11)
//   - capacity reductions (holiday/leave/part-time contract) driving the forecast

import type { Actor, CapacityEntry, Event, IsoDate } from './engine';

export const DEMO_AS_OF: IsoDate = '2026-06-19';

const alice: Actor = { kind: 'human', id: 'alice' }; // 田中
const bob: Actor = { kind: 'human', id: 'bob' }; // 佐藤
const carol: Actor = { kind: 'human', id: 'carol' }; // 鈴木
const ai: Actor = { kind: 'agent', id: 'ai' };

export const DEMO_ACTORS: Record<string, { label: string; actor: Actor }> = {
  alice: { label: '田中', actor: alice },
  bob: { label: '佐藤', actor: bob },
  carol: { label: '鈴木', actor: carol },
  ai: { label: 'AIエージェント', actor: ai },
};

/** Human-readable label per node id (UI display only). */
export const DEMO_NODE_LABELS: Record<string, string> = {
  F1: '認証基盤',
  'req-1': 'req: 要件定義',
  'des-1': 'design: 設計',
  'tsk-1': 'tasks: タスク分解',
  login: 'impl: ログイン',
  'login-ui': 'ログイン UI',
  'login-api': 'ログイン API',
  token: 'impl: トークン更新',
  audit: 'impl: 監査ログ',
  reset: 'impl: パスワードリセット',
  ratelimit: 'impl: レート制限',
  hotfix: 'impl: 緊急修正',
  sso: 'impl: SSO（旧）',
  oauth: 'impl: OAuth 連携',
  legacy: 'impl: 旧ログイン撤去',
  F2: '通知基盤',
  'req-2': 'req: 要件定義',
  'des-2': 'design: 設計',
  'tsk-2': 'tasks: タスク分解',
  email: 'impl: メール通知',
  push: 'impl: プッシュ通知',
};

const events: Event[] = [];
let seq = 0;
const stamp = () => {
  seq += 1;
  return { id: `d${String(seq).padStart(3, '0')}`, ts: seq };
};

function decompose(
  parent: string,
  children: Array<{ node: string; estimate: number }>,
  reason: string,
  actor: Actor = ai,
): void {
  events.push({ kind: 'decompose', ...stamp(), actor, parent, reason, children });
}
function agree(node: string, frozenBudget: number, actor: Actor = alice): void {
  events.push({
    kind: 'transition',
    ...stamp(),
    actor,
    node,
    machine: 'estimate-agreement',
    to: 'agreed',
    frozenBudget,
  });
}
function dep(from: string, to: string, policy: 'accepted' | 'implemented'): void {
  events.push({
    kind: 'relate',
    ...stamp(),
    actor: ai,
    op: 'add',
    from,
    to,
    edgeKind: 'dependency',
    policy,
  });
}
function supersede(newNode: string, oldNode: string): void {
  events.push({
    kind: 'relate',
    ...stamp(),
    actor: alice,
    op: 'add',
    from: newNode, // NEW (R-D7)
    to: oldNode, // OLD
    edgeKind: 'supersede',
  });
}
function schedule(node: string, assignee: Actor, frozenSlot: IsoDate): void {
  events.push({
    kind: 'transition',
    ...stamp(),
    actor: assignee,
    node,
    machine: 'lifecycle',
    to: 'ready',
    assignee,
    frozenSlot,
  });
}
function life(
  node: string,
  to: 'implementing' | 'implemented' | 'accepted' | 'cancelled',
  actor: Actor,
): void {
  events.push({ kind: 'transition', ...stamp(), actor, node, machine: 'lifecycle', to });
}
function cost(node: string, amount: number, actor: Actor): void {
  events.push({ kind: 'cost', ...stamp(), actor, node, amount });
}

// ── F1 認証基盤 ──────────────────────────────────────────────────────────────
decompose(
  'F1',
  [
    { node: 'req-1', estimate: 4 },
    { node: 'des-1', estimate: 6 },
    { node: 'tsk-1', estimate: 2 },
    { node: 'login', estimate: 9 },
    { node: 'token', estimate: 5 },
    { node: 'audit', estimate: 3 },
    { node: 'reset', estimate: 4 },
    { node: 'ratelimit', estimate: 3 },
    { node: 'hotfix', estimate: 2 },
    { node: 'sso', estimate: 6 },
    { node: 'oauth', estimate: 7 },
    { node: 'legacy', estimate: 3 },
  ],
  '初期分解',
);
// login is decomposed further → 3-level tree (login is a non-leaf parent).
decompose('login', [{ node: 'login-ui', estimate: 5 }, { node: 'login-api', estimate: 4 }], 'ログイン詳細分解');

// agreements (ratelimit & push deliberately left proposed → coverage gap)
agree('req-1', 4);
agree('des-1', 6);
agree('tsk-1', 2);
agree('login-ui', 5);
agree('login-api', 4);
agree('token', 5);
agree('audit', 3);
agree('reset', 4);
agree('hotfix', 2);
agree('sso', 6);
agree('oauth', 7);
agree('legacy', 3);

// dependencies (spec phases = accepted, impl = implemented)
dep('req-1', 'des-1', 'accepted');
dep('des-1', 'tsk-1', 'accepted');
dep('des-1', 'login', 'implemented');
dep('des-1', 'token', 'implemented');
dep('login', 'token', 'implemented');

// supersede: OAuth replaces the old SSO impl
supersede('oauth', 'sso');

// scheduling (freezes baseline slots). reset/ratelimit left UNassigned.
schedule('req-1', alice, '2026-06-02');
schedule('des-1', ai, '2026-06-05'); // agent-assigned → distinct Gantt row
schedule('tsk-1', alice, '2026-06-09');
schedule('login-ui', bob, '2026-06-12');
schedule('login-api', bob, '2026-06-16');
schedule('token', carol, '2026-06-22');
schedule('audit', carol, '2026-06-25');
schedule('sso', alice, '2026-05-20');
schedule('oauth', bob, '2026-06-24');

// lifecycle completions / progress
life('req-1', 'implemented', alice);
life('req-1', 'accepted', alice);
life('des-1', 'implemented', ai);
life('des-1', 'accepted', alice);
life('tsk-1', 'implemented', alice);
life('tsk-1', 'accepted', alice);
life('login-ui', 'implemented', bob);
life('login-api', 'implementing', bob);
life('token', 'implementing', carol);
life('sso', 'implemented', alice);
life('sso', 'accepted', alice);
life('oauth', 'implementing', bob);
life('legacy', 'cancelled', alice);
// hotfix: agreed + completed but NEVER scheduled → frozenSlot = null (third state).
life('hotfix', 'implementing', bob);
life('hotfix', 'implemented', bob);

// actual costs (MD)
cost('req-1', 4, alice);
cost('des-1', 5, ai);
cost('tsk-1', 2, alice);
cost('login-ui', 6, bob); // overran 5
cost('login-api', 3, bob);
cost('token', 3, carol);
cost('sso', 6, alice);
cost('oauth', 4, bob);
cost('hotfix', 2, bob);

// ── F2 通知基盤 ──────────────────────────────────────────────────────────────
decompose(
  'F2',
  [
    { node: 'req-2', estimate: 3 },
    { node: 'des-2', estimate: 5 },
    { node: 'tsk-2', estimate: 2 },
    { node: 'email', estimate: 5 },
    { node: 'push', estimate: 4 },
  ],
  '初期分解',
);
agree('req-2', 3);
agree('des-2', 5);
agree('tsk-2', 2);
agree('email', 5);
// push left proposed → coverage gap
dep('req-2', 'des-2', 'accepted');
dep('des-2', 'tsk-2', 'accepted');
dep('des-2', 'email', 'implemented');
schedule('req-2', alice, '2026-06-03');
schedule('des-2', bob, '2026-06-10');
schedule('tsk-2', carol, '2026-06-17');
schedule('email', bob, '2026-06-23');
life('req-2', 'implemented', alice);
life('req-2', 'accepted', alice);
life('des-2', 'implemented', bob);
// tsk-2 stays `ready` from its schedule() above.
cost('req-2', 3, alice);
cost('des-2', 5, bob);

// ── deliberate warning triggers (for the decision inbox) ────────────────────
// R-U12 conflicting agreement: a 2nd human agrees a DIFFERENT frozen value on token.
events.push({
  kind: 'transition',
  ...stamp(),
  actor: bob,
  node: 'token',
  machine: 'estimate-agreement',
  to: 'agreed',
  frozenBudget: 6, // alice agreed 5 earlier → latest-wins value differs per actor
});
// P5 at-risk: design-2 reached `implemented` then diff-back to `implementing`.
life('des-2', 'implementing', bob);

export const demoEvents: readonly Event[] = events;

// ── capacity c(i,d) — second tier (R-U14) ────────────────────────────────────
let cseq = 1000;
const cstamp = () => {
  cseq += 1;
  return cseq;
};
const cap = (humanId: string, date: IsoDate, capacity: number, reason: string): CapacityEntry => ({
  humanId,
  date,
  capacity,
  reason,
  ts: cstamp(),
});

export const demoCapacity: readonly CapacityEntry[] = [
  // 佐藤: 0.5 FTE contract across the sprint
  cap('bob', '2026-06-15', 0.5, 'contract'),
  cap('bob', '2026-06-16', 0.5, 'contract'),
  cap('bob', '2026-06-17', 0.5, 'contract'),
  cap('bob', '2026-06-18', 0.5, 'contract'),
  cap('bob', '2026-06-19', 0.5, 'contract'),
  cap('bob', '2026-06-22', 0.5, 'contract'),
  cap('bob', '2026-06-23', 0.5, 'contract'),
  cap('bob', '2026-06-24', 0.5, 'contract'),
  // 鈴木: leave 6/18–6/19
  cap('carol', '2026-06-18', 0, 'leave'),
  cap('carol', '2026-06-19', 0, 'leave'),
  // 田中: national holiday 6/15, explicit full day 6/16 (to show 明示1.0 vs 未指定)
  cap('alice', '2026-06-15', 0, 'holiday'),
  cap('alice', '2026-06-16', 1.0, 'temporary-reduction'),
];
