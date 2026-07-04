// Pure drift computation: (expected features, folded log) → drift report body.
// No fs, no clock, no methodology vocabulary — fully table-testable.
//
// Honesty rules encoded here (mirrors moira-track provider-reference §P4):
//   - The 5 human decisions are NEVER inferred: a lag whose catch-up crosses
//     estimate agreement (①) or assignment (②) is `needs-human`, not `behind`.
//   - Suggested commands never invent values — estimates / assignees / slots /
//     measured costs stay `<...?>` placeholders.
//   - `moira assign` is never suggested for a node at implementing or beyond
//     (it forces lifecycle→ready and silently regresses EV% — landmine §E-2).
//   - impl-node COUNT is never asserted (decomposition depth = human 判断④).

import type { LifecycleState, ProjectedNode, ProjectedState } from 'moira-backend';
import type {
  ActualNodeState,
  DriftReportBody,
  DriftStatus,
  ExpectedFeature,
  ExpectedImplGroup,
  ExpectedNode,
  FeatureDrift,
  NodeDrift,
  SuggestedCommand,
} from './types.js';
import { lifecycleRank } from './types.js';

export interface DriftOptions {
  projectRoot: string;
  provider: string;
  ignoreFeatures?: readonly string[];
  ignoreNodes?: readonly string[];
  /**
   * Multi-repo (ADR-0003 Stage 3): the feature space THIS work repo claims
   * (`<id>` or `<prefix>/*`). When non-empty, log nodes matching NEITHER the
   * expected feature space NOR the claim are another repo's business — they
   * drop to skipped.nodes instead of flooding unknown-node. Empty = claim
   * everything (single-repo behavior, unchanged).
   */
  scopeClaim?: readonly string[];
}

const IMPLEMENTING = lifecycleRank('implementing');
const IMPLEMENTED = lifecycleRank('implemented');
const ACCEPTED = lifecycleRank('accepted');

export function computeDrift(
  expected: readonly ExpectedFeature[],
  projected: ProjectedState,
  opts: DriftOptions,
): DriftReportBody {
  const ignoreFeatures = new Set(opts.ignoreFeatures ?? []);
  const ignoreNodes = opts.ignoreNodes ?? [];
  const isIgnoredNode = (id: string): boolean =>
    ignoreNodes.some((p) => (p.endsWith('/*') ? id.startsWith(p.slice(0, -1)) : id === p));

  const claim = opts.scopeClaim ?? [];
  const inClaim = (id: string): boolean =>
    claim.some((p) =>
      p.endsWith('/*') ? id === p.slice(0, -2) || id.startsWith(p.slice(0, -1)) : id === p,
    );

  const active = expected.filter((f) => !ignoreFeatures.has(f.feature));
  const skippedFeatures = expected.filter((f) => ignoreFeatures.has(f.feature)).map((f) => f.feature);

  const features: FeatureDrift[] = active.map((f) => evaluateFeature(f, projected, isIgnoredNode));
  const { unknown: unknownNodes, outOfClaim } = findUnknownNodes(
    expected,
    projected,
    opts.projectRoot,
    isIgnoredNode,
    claim.length > 0 ? inClaim : null,
  );
  const skippedNodes = [
    ...new Set([...[...projected.nodes.keys()].filter(isIgnoredNode), ...outOfClaim]),
  ].sort();

  return {
    schemaVersion: 1,
    projectRoot: opts.projectRoot,
    provider: opts.provider,
    features,
    unknownNodes,
    skipped: { features: skippedFeatures, nodes: skippedNodes },
    summary: summarize([...features.flatMap((f) => f.nodes), ...unknownNodes]),
  };
}

/** Narrow a computed report to a single feature (drops unknown nodes — they
 * belong to no feature space) and recount the summary. */
export function filterReport(body: DriftReportBody, feature: string): DriftReportBody {
  const features = body.features.filter((f) => f.feature === feature);
  return {
    ...body,
    features,
    unknownNodes: [],
    summary: summarize(features.flatMap((f) => f.nodes)),
  };
}

// --- per-feature evaluation -------------------------------------------------

function evaluateFeature(
  f: ExpectedFeature,
  projected: ProjectedState,
  isIgnoredNode: (id: string) => boolean,
): FeatureDrift {
  const base: FeatureDrift = {
    feature: f.feature,
    sourcePath: f.sourcePath,
    sourcePhase: f.sourcePhase,
    nodes: [],
    nextSteps: [],
  };
  if (f.parseError !== undefined) return { ...base, parseError: f.parseError };

  const nodes: NodeDrift[] = [];
  for (const exp of f.nodes) {
    if (isIgnoredNode(exp.node)) continue;
    nodes.push(evaluateNode(exp, projected.nodes.get(exp.node)));
  }
  if (f.implGroup !== undefined) {
    nodes.push(...evaluateImplGroup(f.implGroup, projected, isIgnoredNode));
  }
  return { ...base, nodes, nextSteps: nextSteps(f, projected, isIgnoredNode) };
}

function evaluateNode(exp: ExpectedNode, node: ProjectedNode | undefined): NodeDrift {
  const expectedView = { exists: true, minLifecycle: exp.minLifecycle };
  if (node === undefined) {
    return {
      node: exp.node,
      status: 'missing-node',
      severity: exp.severity,
      evidence: exp.evidence,
      expected: expectedView,
      actual: null,
      suggested: catchUpChain(exp, null),
    };
  }
  const actual = actualView(node);
  if (node.lifecycle === 'cancelled') {
    return {
      node: exp.node,
      status: 'cancelled',
      severity: 'advisory',
      evidence: `${exp.evidence} — ただし moira 側で cancelled（スコープ判断③とみなす。意図的なら ignoreNodes へ）`,
      expected: expectedView,
      actual,
      suggested: [],
    };
  }
  const rank = lifecycleRank(node.lifecycle);
  if (exp.minLifecycle !== null && rank < lifecycleRank(exp.minLifecycle)) {
    const suggested = catchUpChain(exp, node);
    const crossesHumanGate = suggested.some((c) => c.humanGate === 'agree' || c.humanGate === 'assign');
    return {
      node: exp.node,
      status: crossesHumanGate ? 'needs-human' : 'behind',
      severity: exp.severity,
      evidence: exp.evidence,
      expected: expectedView,
      actual,
      suggested,
    };
  }
  if (exp.maxLifecycle !== null && rank > lifecycleRank(exp.maxLifecycle)) {
    return {
      node: exp.node,
      status: 'ahead',
      severity: 'advisory',
      evidence: `moira 側が先行: ${node.lifecycle}（根拠は「${exp.evidence}」まで） — 口頭承認が artifacts 未反映の可能性`,
      expected: expectedView,
      actual,
      suggested: [],
    };
  }
  return {
    node: exp.node,
    status: 'ok',
    severity: exp.severity,
    evidence: exp.evidence,
    expected: expectedView,
    actual,
    suggested: [],
  };
}

function evaluateImplGroup(
  g: ExpectedImplGroup,
  projected: ProjectedState,
  isIgnoredNode: (id: string) => boolean,
): NodeDrift[] {
  const out: NodeDrift[] = [];
  const implNodes = [...projected.nodes.values()]
    .filter((n) => n.id.startsWith(g.prefix) && !isIgnoredNode(n.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const review = isIgnoredNode(g.reviewNode) ? undefined : projected.nodes.get(g.reviewNode);

  if (g.requireExists && implNodes.length === 0) {
    out.push({
      node: `${g.prefix}*`,
      status: 'missing-node',
      severity: 'hard',
      evidence: g.evidence,
      expected: { exists: true, minLifecycle: null },
      actual: null,
      suggested: [
        {
          argv: ['moira', 'add', `${g.prefix}1`, '--parent', g.parent, '--label', '実装-1', '--actor', 'agent:claude'],
          humanGate: null,
          note: `未見積で誕生（tasks の実装タスク数に応じて ${g.prefix}2… を追加。個数は分解の深さ＝人間判断④）`,
        },
      ],
    });
  }
  if (g.requireExists && review === undefined && !isIgnoredNode(g.reviewNode)) {
    out.push({
      node: g.reviewNode,
      status: 'missing-node',
      severity: 'hard',
      evidence: g.evidence,
      expected: { exists: true, minLifecycle: null },
      actual: null,
      suggested: [
        {
          argv: ['moira', 'add', g.reviewNode, '--parent', g.parent, '--label', '実装レビュー', '--actor', 'agent:claude'],
          humanGate: null,
          note: 'レビューも見積を持つ通常の作業ノード（省くと「レビュー作業も出来高」が成立しない）',
        },
      ],
    });
  }

  // Checkbox corroboration — advisory only (task↔impl-node granularity is human-decided).
  if (implNodes.length > 0 && g.tasksTotal > 0 && g.tasksChecked > 0) {
    const evidence = `tasks 進捗 ${g.tasksChecked}/${g.tasksTotal} 完了`;
    if (g.tasksChecked === g.tasksTotal) {
      for (const n of implNodes) {
        if (n.lifecycle === 'cancelled' || lifecycleRank(n.lifecycle) >= IMPLEMENTED) continue;
        const exp: ExpectedNode = {
          node: n.id,
          parent: g.parent,
          minLifecycle: 'implemented',
          maxLifecycle: null,
          severity: 'advisory',
          evidence: `${evidence}（全完了）だが ${n.id} は ${n.lifecycle}`,
        };
        const d = evaluateNode(exp, n);
        out.push({ ...d, severity: 'advisory' });
      }
    } else if (!implNodes.some((n) => lifecycleRank(n.lifecycle) >= IMPLEMENTED)) {
      const first = implNodes.find((n) => n.lifecycle !== 'cancelled');
      out.push({
        node: `${g.prefix}*`,
        status: 'behind',
        severity: 'advisory',
        evidence: `${evidence}だが implemented 以上の実装ノードが 1 つも無い`,
        expected: { exists: true, minLifecycle: 'implemented' },
        actual: first === undefined ? null : actualView(first),
        suggested:
          first === undefined
            ? []
            : catchUpChain(
                {
                  node: first.id,
                  parent: g.parent,
                  minLifecycle: 'implemented',
                  maxLifecycle: null,
                  severity: 'advisory',
                  evidence,
                },
                first,
              ),
      });
    }
  }
  return out;
}

// --- catch-up chain ----------------------------------------------------------
// Command order mirrors the skill's discipline: add(--parent 必須) → 見積提案 →
// agree(①) → assign+slot(②, 着手前のみ) → start(着手ゲート) → done → cost(実測) → accept.

function catchUpChain(exp: ExpectedNode, node: ProjectedNode | null): SuggestedCommand[] {
  const cmds: SuggestedCommand[] = [];
  const cur = node === null ? -1 : lifecycleRank(node.lifecycle); // -1 = not born yet
  const agreed = node !== null && node.estimateState === 'agreed';
  const hasBaseline = node !== null && node.assignee !== null && node.frozenSlot !== null;

  if (node === null) {
    const argv = ['moira', 'add', exp.node, '--parent', exp.parent];
    if (exp.label !== undefined) argv.push('--label', exp.label);
    argv.push('--actor', 'agent:claude');
    cmds.push({ argv, humanGate: null, note: 'ノード誕生（--parent 必須・省略は hook が deny）' });
  }
  const target = exp.minLifecycle === null ? null : lifecycleRank(exp.minLifecycle);
  if (target === null) return cmds;

  if (!agreed) {
    cmds.push({
      argv: ['moira', 'add', exp.node, '--parent', exp.parent, '--estimate', '<md?>', '--actor', 'agent:claude'],
      humanGate: null,
      note: '見積提案（proposed）。再 add でも --parent 必須',
    });
    cmds.push({
      argv: ['moira', 'agree', exp.node],
      humanGate: 'agree',
      note: '[人間確認] 見積合意（判断①・human 限定）',
    });
  }
  if (cur < IMPLEMENTING && target >= IMPLEMENTING) {
    if (!hasBaseline) {
      cmds.push({
        argv: ['moira', 'assign', exp.node, '--to', '<who?>', '--slot', '<YYYY-MM-DD?>'],
        humanGate: 'assign',
        note: '[人間確認] 割当＋着手予定（判断②）。baseline は必ず着手前',
      });
    }
    cmds.push({
      argv: ['moira', 'start', exp.node, '--actor', 'agent:claude'],
      humanGate: null,
      note: '着手ゲート（agreed＋担当＋slot）充足後のみ',
    });
  }
  if (cur < IMPLEMENTED && target >= IMPLEMENTED) {
    cmds.push({
      argv: ['moira', 'done', exp.node, '--actor', 'agent:claude'],
      humanGate: null,
      note: '作成完了の反映（artifacts で完了済みの事実）',
    });
    cmds.push({
      argv: ['moira', 'cost', exp.node, '<実測md?>', '--actor', 'agent:claude'],
      humanGate: 'measure',
      note: 'AC は実測のみ（捏造しない — 不明なら人間に確認）',
    });
  }
  if (cur < ACCEPTED && target >= ACCEPTED) {
    cmds.push({
      argv: ['moira', 'accept', exp.node],
      humanGate: null,
      note: '承認の反映（人間承認は artifacts で確認済み）',
    });
  }
  return cmds;
}

// --- unknown nodes / next steps / summary ------------------------------------

function findUnknownNodes(
  expected: readonly ExpectedFeature[],
  projected: ProjectedState,
  projectRoot: string,
  isIgnoredNode: (id: string) => boolean,
  inClaim: ((id: string) => boolean) | null,
): { unknown: NodeDrift[]; outOfClaim: string[] } {
  const inKnownSpace = (id: string): boolean =>
    expected.some((f) => id === f.feature || id.startsWith(`${f.feature}/`));
  const unknown: NodeDrift[] = [];
  const outOfClaim: string[] = [];
  for (const node of projected.nodes.values()) {
    if (node.id === projectRoot || isIgnoredNode(node.id) || inKnownSpace(node.id)) continue;
    if (inClaim !== null && !inClaim(node.id)) {
      // another work repo's feature space (multi-repo) — skipped, not noise
      outOfClaim.push(node.id);
      continue;
    }
    unknown.push({
      node: node.id,
      status: 'unknown-node',
      severity: 'advisory',
      evidence:
        'どの期待 feature 空間にも一致しない（方法論外の作業単位なら .moira/adapter.json の ignoreNodes/ignoreFeatures へ）',
      expected: { exists: false, minLifecycle: null },
      actual: actualView(node),
      suggested: [],
    });
  }
  return { unknown: unknown.sort((a, b) => a.node.localeCompare(b.node)), outOfClaim };
}

function nextSteps(
  f: ExpectedFeature,
  projected: ProjectedState,
  isIgnoredNode: (id: string) => boolean,
): string[] {
  const steps: string[] = [];
  const g = f.implGroup;
  if (g !== undefined) {
    const implNodes = [...projected.nodes.values()].filter(
      (n) => n.id.startsWith(g.prefix) && !isIgnoredNode(n.id) && n.lifecycle !== 'cancelled',
    );
    const review = projected.nodes.get(g.reviewNode);
    if (
      implNodes.length > 0 &&
      implNodes.every((n) => lifecycleRank(n.lifecycle) >= IMPLEMENTED) &&
      review !== undefined &&
      review.lifecycle !== 'cancelled' &&
      lifecycleRank(review.lifecycle) < IMPLEMENTED
    ) {
      steps.push(`実装レビュー ${g.reviewNode} を進める（start → done → cost → accept）`);
    }
  }
  const featNode = projected.nodes.get(f.feature);
  const children = (projected.childrenOf.get(f.feature) ?? []).filter(
    (c) => projected.nodes.get(c)?.lifecycle !== 'cancelled',
  );
  if (
    featNode !== undefined &&
    featNode.lifecycle !== 'accepted' &&
    children.length > 0 &&
    children.every((c) => projected.nodes.get(c)?.lifecycle === 'accepted')
  ) {
    steps.push(`moira accept ${f.feature} — 人間の最終サインオフ（全子ノード accepted）`);
  }
  return steps;
}

function summarize(nodes: readonly NodeDrift[]): DriftReportBody['summary'] {
  const s = { hard: 0, advisory: 0, needsHuman: 0, ok: 0 };
  for (const n of nodes) {
    if (n.status === 'ok') s.ok += 1;
    else if (n.status === 'needs-human') s.needsHuman += 1;
    else if ((n.status === 'behind' || n.status === 'missing-node') && n.severity === 'hard') s.hard += 1;
    else s.advisory += 1;
  }
  return s;
}

function actualView(node: ProjectedNode): ActualNodeState {
  return {
    lifecycle: node.lifecycle,
    estimate: node.estimateState,
    latestEstimate: node.latestEstimate,
    assignee: node.assignee === null ? null : `${node.assignee.kind}:${node.assignee.id}`,
    frozenSlot: node.frozenSlot,
  };
}

const statusOrder: Record<DriftStatus, number> = {
  'missing-node': 0,
  behind: 1,
  'needs-human': 2,
  ahead: 3,
  cancelled: 4,
  'unknown-node': 5,
  ok: 6,
};

/** Render order helper for reporters: most actionable first, stable otherwise. */
export function byActionability(a: NodeDrift, b: NodeDrift): number {
  return statusOrder[a.status] - statusOrder[b.status] || a.node.localeCompare(b.node);
}
