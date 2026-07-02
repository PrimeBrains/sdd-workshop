// cc-sdd (Kiro-style spec-driven development) provider — the ONLY module that
// knows cc-sdd vocabulary: .kiro/specs/<feature>/spec.json (phase + approvals),
// tasks.md checkboxes, and the moira-track node-ID convention
// (<f>, <f>/req|design|tasks, <f>/impl-N, <f>/review-impl).
//
// Mapping contract (must stay in lockstep with moira-track reference §J):
//   spec.json exists                    → <f> + 3 phase children exist      [hard]
//   approvals.<p>.generated (or phase)  → <f>/<p> ≥ implemented             [hard]
//   approvals.<p>.approved              → <f>/<p> = accepted                [hard]
//   approvals.tasks.approved / ready    → ≥1 <f>/impl-* and <f>/review-impl [hard, count-free]
//   tasks.md checkboxes                 → impl progress corroboration       [advisory]
// NOT derivable (→ needs-human at the core): estimates/agreement(①),
// assignee/reviewer/slot(②), capacity(⑤), measured costs, cancellations(③).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LifecycleState } from 'moira-backend';
import type { ExpectedFeature, ExpectedNode } from '../drift/types.js';
import type { MethodologyProvider } from './provider.js';

interface ApprovalPair {
  generated: boolean;
  approved: boolean;
}

interface SpecState {
  feature: string;
  phase: string;
  requirements: ApprovalPair;
  design: ApprovalPair;
  tasks: ApprovalPair;
  readyForImplementation: boolean;
}

/** Phase names in generation order — `phase: "design-generated"` implies every
 * earlier phase was generated even if approvals is malformed/missing. */
const PHASE_ORDER = ['requirements', 'design', 'tasks'] as const;
type PhaseName = (typeof PHASE_ORDER)[number];

const PHASE_LABEL: Record<PhaseName, string> = {
  requirements: '要件定義',
  design: '設計',
  tasks: 'タスク分解',
};
const PHASE_CHILD: Record<PhaseName, string> = {
  requirements: 'req',
  design: 'design',
  tasks: 'tasks',
};

export function parseSpecJson(dirName: string, text: string): SpecState {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const feature = str(raw['feature_name']) ?? str(raw['name']) ?? dirName;
  const phase = str(raw['phase']) ?? 'unknown';
  const approvals = (raw['approvals'] ?? {}) as Record<string, unknown>;
  const pair = (key: PhaseName): ApprovalPair => {
    const p = (approvals[key] ?? {}) as Record<string, unknown>;
    const generatedByPhase = PHASE_ORDER.slice(PHASE_ORDER.indexOf(key)).some(
      (later) => phase === `${later}-generated`,
    );
    return {
      generated: p['generated'] === true || generatedByPhase,
      approved: p['approved'] === true,
    };
  };
  return {
    feature,
    phase,
    requirements: pair('requirements'),
    design: pair('design'),
    tasks: pair('tasks'),
    readyForImplementation: raw['ready_for_implementation'] === true,
  };
}

/** Count `- [ ]` / `- [x]` checkboxes (tolerates `- [x]*`, sub-task numbering). */
export function parseTasksMd(text: string): { checked: number; total: number } {
  let checked = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const m = /^\s*- \[( |x|X)\]/.exec(line);
    if (m === null) continue;
    total += 1;
    if (m[1] !== ' ') checked += 1;
  }
  return { checked, total };
}

/** Pure normalization: (spec dir name, file texts) → expected Moira state. */
export function buildExpectedFeature(
  dirName: string,
  sourcePath: string,
  projectRoot: string,
  specJsonText: string,
  tasksMdText: string | null,
): ExpectedFeature {
  let spec: SpecState;
  try {
    spec = parseSpecJson(dirName, specJsonText);
  } catch (e) {
    return {
      feature: dirName,
      sourcePath,
      sourcePhase: 'unknown',
      parseError: `spec.json を解析できない: ${e instanceof Error ? e.message : String(e)}`,
      nodes: [],
    };
  }
  const f = spec.feature;
  const nodes: ExpectedNode[] = [
    {
      node: f,
      parent: projectRoot,
      label: f,
      minLifecycle: null,
      maxLifecycle: null, // final feature accept is the human sign-off — never "ahead"
      severity: 'hard',
      evidence: `${sourcePath}/spec.json が存在（discovery 済み）`,
    },
  ];
  for (const phase of PHASE_ORDER) {
    const { generated, approved } = spec[phase];
    const node = `${f}/${PHASE_CHILD[phase]}`;
    const min: LifecycleState | null = approved ? 'accepted' : generated ? 'implemented' : null;
    // Ceiling: in-progress work (implementing) is always legitimate; implemented
    // needs `generated`, accepted needs `approved`.
    const max: LifecycleState = approved ? 'accepted' : generated ? 'implemented' : 'implementing';
    nodes.push({
      node,
      parent: f,
      label: PHASE_LABEL[phase],
      minLifecycle: min,
      maxLifecycle: max,
      severity: 'hard',
      evidence: approved
        ? `approvals.${phase}.approved=true`
        : generated
          ? `approvals.${phase}.generated=true（または phase=${spec.phase}）`
          : `${sourcePath}/spec.json が存在（discovery 済み）`,
    });
  }
  const tasksProgress = tasksMdText === null ? { checked: 0, total: 0 } : parseTasksMd(tasksMdText);
  const requireImpl = spec.tasks.approved || spec.readyForImplementation;
  return {
    feature: f,
    sourcePath,
    sourcePhase: spec.phase,
    nodes,
    implGroup: {
      prefix: `${f}/impl-`,
      reviewNode: `${f}/review-impl`,
      parent: f,
      requireExists: requireImpl,
      tasksChecked: tasksProgress.checked,
      tasksTotal: tasksProgress.total,
      evidence: requireImpl
        ? `approvals.tasks.approved=true → 実装ノード（未見積）と review-impl が誕生しているはず`
        : `tasks.md の進捗（${tasksProgress.checked}/${tasksProgress.total}）`,
    },
  };
}

export const ccSddProvider: MethodologyProvider = {
  id: 'cc-sdd',

  detect(cwd: string): boolean {
    return existsSync(join(cwd, '.kiro', 'specs'));
  },

  loadExpected(cwd: string, projectRoot: string): ExpectedFeature[] {
    const specsDir = join(cwd, '.kiro', 'specs');
    if (!existsSync(specsDir)) return [];
    const out: ExpectedFeature[] = [];
    for (const entry of readdirSync(specsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const specJsonPath = join(specsDir, entry.name, 'spec.json');
      if (!existsSync(specJsonPath)) continue; // not a spec dir
      const sourcePath = `.kiro/specs/${entry.name}`;
      const tasksPath = join(specsDir, entry.name, 'tasks.md');
      out.push(
        buildExpectedFeature(
          entry.name,
          sourcePath,
          projectRoot,
          readFileSync(specJsonPath, 'utf8'),
          existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : null,
        ),
      );
    }
    return out.sort((a, b) => a.feature.localeCompare(b.feature));
  },
};
