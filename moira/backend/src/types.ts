// Moira S4 minimal backend — core types.
//
// Everything here is a direct encoding of moira/MODEL.md (v14). Citations use
// `MODEL:NNN` for line numbers in that document.
//
// Two data tiers (MODEL §5 / A2 MODEL:25, §5 MODEL:372):
//   1. The append-only log of the FOUR node-work events (transition / decompose
//      / relate / cost). This is the single source of truth for node work data.
//   2. The capacity input c(i,d) — a SEPARATE tier with its own append-only,
//      reason-stamped history (A4 MODEL:35, R-U14 MODEL:253). NOT one of the
//      four events.

export type NodeId = string;
export type EventId = string; // globally sortable; tie-breaks ts (I3 MODEL:146, R-D5 MODEL:343)
export type IsoDate = string; // 'YYYY-MM-DD' — c is per-date (A4 MODEL:34)

export type ActorKind = 'human' | 'agent'; // A5 MODEL:41
export interface Actor {
  kind: ActorKind;
  id: string;
}

// task + phase layers share ONE lifecycle machine (§2.5 MODEL:110, §2.6 MODEL:116).
// `cancelled` is terminal and reachable from any non-terminal state (MODEL:110).
export type LifecycleState =
  | 'pending'
  | 'ready'
  | 'implementing'
  | 'implemented'
  | 'accepted'
  | 'cancelled';

export type EstimateState = 'proposed' | 'agreed'; // §2.2 MODEL:79

export type StateMachine = 'lifecycle' | 'estimate-agreement'; // I5 MODEL:148, R-D6 MODEL:346
export type EdgeKind = 'dependency' | 'supersede'; // §2.7 MODEL:126, §2.8 MODEL:140
export type EdgePolicy = 'accepted' | 'implemented'; // per-edge; defaults R-D2 MODEL:334

// ----------------------------------------------------------------------------
// The four events (§2.8 MODEL:135-141, §4 requirements)
// ----------------------------------------------------------------------------

interface EventBase {
  id: EventId;
  ts: number; // epoch ms — total order with id (I3)
  actor: Actor;
}

export interface TransitionEvent extends EventBase {
  kind: 'transition';
  node: NodeId;
  machine: StateMachine; // I5/R-D6 — every transition names its machine
  to: LifecycleState | EstimateState;
  assignee?: Actor; // single assignee (§2.4 MODEL:106, R-T5 MODEL:315)
  frozenBudget?: number; // value frozen on the agreement transition (§3① MODEL:194)
  frozenSlot?: IsoDate; // slot frozen on the first-scheduling transition (§3② MODEL:194)
  reason?: string; // required on a reason-stamped re-baseline (R-U7 MODEL:232)
}

export interface DecomposeEvent extends EventBase {
  kind: 'decompose';
  parent: NodeId;
  reason: string; // reason required (§2.8 MODEL:139)
  children: Array<{ node: NodeId; estimate?: number }>; // latest proposed value, MD
}

export interface RelateEvent extends EventBase {
  kind: 'relate';
  op: 'add' | 'remove';
  from: NodeId; // dependency: predecessor; supersede: NEW node (R-D7 MODEL:349)
  to: NodeId; //   dependency: successor;   supersede: OLD node
  edgeKind: EdgeKind;
  policy?: EdgePolicy; // dependency only; default by edge type if absent (R-D2)
}

export interface CostEvent extends EventBase {
  kind: 'cost';
  node: NodeId;
  amount: number; // MD attention-time (A6 MODEL:44); deduped by id (§2.8 MODEL:141)
}

export type Event = TransitionEvent | DecomposeEvent | RelateEvent | CostEvent;

// ----------------------------------------------------------------------------
// c(i,d) — second data tier (A4 MODEL:35, R-U14 MODEL:253)
// ----------------------------------------------------------------------------

export interface CapacityEntry {
  humanId: string;
  date: IsoDate;
  capacity: number; // c(i,d) ∈ [0, 1.0] MD/day (MODEL:34); default 1.0 if absent
  reason: string; // contract | holiday | leave | temporary-reduction (MODEL:31)
  ts: number; // append-only, timestamped (R-U14); latest ts wins per (human, date)
}

export type CapacityLookup = (humanId: string, date: IsoDate) => number;

// ----------------------------------------------------------------------------
// Projected state (the fold output)
// ----------------------------------------------------------------------------

export interface DependencyEdge {
  from: NodeId;
  to: NodeId;
  policy: EdgePolicy;
}

export interface SupersedeEdge {
  from: NodeId; // NEW node (source of the supersede) — R-D7 MODEL:349
  to: NodeId; //   OLD node (superseded)
}

export interface ProjectedNode {
  id: NodeId;
  lifecycle: LifecycleState;
  reachedImplemented: boolean; // P5 context (MODEL:178); warning deferred
  estimateState: EstimateState;
  latestEstimate: number | null; // latest decompose value — drives EVM/forecast (R-U7 MODEL:232)
  frozenBudget: number | null; // frozen at agreement (§3① MODEL:194)
  frozenSlot: IsoDate | null; // frozen at first scheduling (§3② MODEL:194)
  assignee: Actor | null; // latest-wins (§2.4 MODEL:102)
  ownCost: number; // Σ deduped cost (P3 MODEL:172)
  parent: NodeId | null;
  agreedActorValues: Map<string, number>; // per distinct human's latest agreed value (R-U12 context)
}

export interface ProjectedState {
  nodes: Map<NodeId, ProjectedNode>;
  childrenOf: Map<NodeId, NodeId[]>;
  dependencyEdges: DependencyEdge[];
  supersedeEdges: SupersedeEdge[];
  seenCostIds: Set<EventId>;
  structuralErrors: string[]; // rejected cyclic relate / agent-issued agreement, etc.
  appliedAt: number; // ts of the last applied event
}

// ----------------------------------------------------------------------------
// DerivedState — the 11 S4 derivations (R-S2 MODEL:283, UI-ARCHITECTURE §4.1)
// ----------------------------------------------------------------------------

export interface NodeStateRow {
  node: NodeId;
  lifecycle: LifecycleState;
  estimate: EstimateState;
}

export interface AcRow {
  node: NodeId;
  ac: number;
}

export interface ForecastRow {
  node: NodeId;
  predictedCompletion: IsoDate | null; // live forecast (P7) — latest estimate + current c
  frozenSlot: IsoDate | null; // frozen baseline slot — so consumers can read R-S7 divergence
}

export interface DerivedState {
  asOf: IsoDate;
  // (1) node states
  nodeStates: NodeStateRow[];
  // (2) EV% achievement, (3) EV_abs absolute earned
  evPercent: number; // ∈ [0,1]
  evAbs: number; // MD, agreed-completed only (R-U8 MODEL:235)
  cumulativeEvAbs: number; // R-S5 distinct read — includes superseded (MODEL:128)
  // (4) estimate coverage, (5) schedule coverage
  estimateCoverage: number; // P2 MODEL:169
  scheduleCoverage: number; // R-S6 MODEL:295
  // (6) PV, (7) AC
  pv: number; // §3 MODEL:197
  ac: number; // P3 MODEL:172
  acByNode: AcRow[];
  // (8) SPI, (9) CPI — raw; presenter de-rates SPI by scheduleCoverage (R-S6)
  spi: number | null;
  spiScheduleCoverage: number; // == scheduleCoverage, returned for pair-reading
  cpi: number | null;
  // (10) queues — P4 same query, actor filter (MODEL:174)
  agentWorkQueue: NodeId[];
  humanReviewQueue: NodeId[];
  // (11) live forecast schedule + unassigned backlog
  forecast: ForecastRow[];
  unassignedBacklog: NodeId[]; // agreed nodes with no assignee (P0 MODEL:104)
  // supporting / honest gaps
  effectiveLeaves: NodeId[]; // currently-effective leaf set (R-S5)
  structuralErrors: string[];
}
