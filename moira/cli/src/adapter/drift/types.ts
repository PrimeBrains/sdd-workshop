// Drift-engine vocabulary. Everything here speaks ONLY Moira terms (node ids,
// lifecycle/estimate states, missing events). Methodology-specific knowledge
// (cc-sdd's spec.json, tasks.md, the req/design/tasks naming) lives in a
// provider (../providers/*) which NORMALIZES its artifacts into these types —
// the same confinement principle as .kiro/specs/moira-ingestion-adapter.

import type { EstimateState, LifecycleState } from 'moira-backend';

// ---------------------------------------------------------------------------
// Expected side (provider output)
// ---------------------------------------------------------------------------

/** Progression order for "at least / at most" comparisons. `cancelled` is a
 * terminal side-branch (scope decision), handled as its own status. */
export const LIFECYCLE_ORDER: readonly LifecycleState[] = [
  'pending',
  'ready',
  'implementing',
  'implemented',
  'accepted',
];

export function lifecycleRank(state: LifecycleState): number {
  return LIFECYCLE_ORDER.indexOf(state); // cancelled → -1 (never compared; see core)
}

export type DriftSeverity = 'hard' | 'advisory';

/** One node the methodology's on-disk state implies should exist / have progressed. */
export interface ExpectedNode {
  node: string;
  /** Expected tree parent — used verbatim in suggested `moira add --parent`. */
  parent: string;
  /** Display label for a suggested `moira add --label` (off-model, labels.json). */
  label?: string;
  /** Lifecycle the node should have AT LEAST reached (null = existence only). */
  minLifecycle: LifecycleState | null;
  /** Lifecycle ceiling the artifacts can justify (null = no ceiling). Actual
   * beyond this is reported `ahead` (advisory — e.g. verbal approval not yet
   * reflected in the methodology's artifacts). */
  maxLifecycle: LifecycleState | null;
  severity: DriftSeverity;
  /** Human-readable: which artifact fact implies this expectation. */
  evidence: string;
}

/** Implementation-node group. The number of impl nodes is a human decomposition
 * decision (判断④), so existence is asserted as "at least one", never a count. */
export interface ExpectedImplGroup {
  /** Node-id prefix of implementation nodes, e.g. "task-add/impl-". */
  prefix: string;
  /** The implementation-review node id, e.g. "task-add/review-impl". */
  reviewNode: string;
  /** Expected parent of impl nodes (the feature node). */
  parent: string;
  /** true ⇒ ≥1 impl node and the review node must exist (hard). */
  requireExists: boolean;
  /** Task-progress corroboration (advisory only — task↔node granularity is human). */
  tasksChecked: number;
  tasksTotal: number;
  evidence: string;
}

export interface ExpectedFeature {
  /** Feature node id (= the methodology's unit-of-work name). */
  feature: string;
  /** Where the expectation came from, for the report (e.g. ".kiro/specs/task-add"). */
  sourcePath: string;
  /** The methodology's own phase string, verbatim (report context only). */
  sourcePhase: string;
  /** Artifact unreadable → surfaces in the report; no expectations derived. */
  parseError?: string;
  nodes: ExpectedNode[];
  implGroup?: ExpectedImplGroup;
}

// ---------------------------------------------------------------------------
// Report side (core output)
// ---------------------------------------------------------------------------

export type DriftStatus =
  | 'ok'
  | 'behind' // artifacts imply progress the log lacks; catch-up is mechanical
  | 'needs-human' // behind, but the catch-up chain crosses a human decision (①②)
  | 'ahead' // log is beyond what artifacts justify (advisory)
  | 'missing-node' // node not in the log at all
  | 'cancelled' // cancelled in moira (scope decision ③ assumed; advisory)
  | 'unknown-node'; // in the log but matches no known feature space (advisory)

/** A catch-up command proposal. NEVER auto-executed; values the log cannot know
 * (estimates, assignees, slots, measured costs) stay as `<...?>` placeholders. */
export interface SuggestedCommand {
  argv: string[];
  /** Which human gate the command crosses (5 判断の①②⑤ + 実測値の確認). */
  humanGate: 'agree' | 'assign' | 'capacity' | 'measure' | null;
  note: string;
}

export interface ActualNodeState {
  lifecycle: LifecycleState;
  estimate: EstimateState;
  latestEstimate: number | null;
  assignee: string | null; // "kind:id"
  frozenSlot: string | null;
}

export interface NodeDrift {
  /** Node id, or "<prefix>*" for an impl-group finding. */
  node: string;
  status: DriftStatus;
  severity: DriftSeverity;
  evidence: string;
  expected: { exists: boolean; minLifecycle: LifecycleState | null };
  actual: ActualNodeState | null;
  suggested: SuggestedCommand[];
}

export interface FeatureDrift {
  feature: string;
  sourcePath: string;
  sourcePhase: string;
  parseError?: string;
  nodes: NodeDrift[];
  /** Workflow guidance that is NOT drift (review progression, final feature accept). */
  nextSteps: string[];
}

export interface DriftSummary {
  hard: number;
  advisory: number;
  needsHuman: number;
  ok: number;
}

export interface DriftReport {
  schemaVersion: 1;
  adapterVersion: string;
  generatedAt: string; // ISO timestamp (stamped by the fs layer, not the core)
  projectRoot: string;
  provider: string;
  features: FeatureDrift[];
  unknownNodes: NodeDrift[];
  skipped: { features: string[]; nodes: string[] };
  summary: DriftSummary;
}

/** What the pure core computes; the fs layer stamps version/timestamp. */
export type DriftReportBody = Omit<DriftReport, 'adapterVersion' | 'generatedAt'>;
